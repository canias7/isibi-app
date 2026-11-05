// @CODER IN GITHUB (owner, 2026-11-05: "yea lets do it"). Like Claude Code's
// GitHub Actions: on an issue or a pull request, a comment with "@coder …"
// starts a Coder job on that repository; Coder answers in the same thread.
//
//   1. GitHub sends the comment to POST /api/coder/github/webhook, signed with
//      CODER_GITHUB_WEBHOOK_SECRET (checked first; anything else is refused).
//   2. Only someone who connected that GitHub account to Coder, with an email
//      on CODER_USERS, can wake it (so strangers cannot spend the owner's Grok).
//   3. Coder answers "On it" as the app (gofarther-coder[bot], signed with
//      CODER_GITHUB_APP_PRIVATE_KEY), then runs the job like a chat (it shows
//      in the person's chats on gofarther.dev). One chat per issue or PR: the
//      next @coder in the same thread continues it.
//   4. Every minute (the Worker's cron) unfinished jobs are checked; when one
//      ends, the "On it" comment is replaced by what Coder did, with links.
const enc = new TextEncoder();
export const MENTION = /(^|[^\w-])@coder\b/i;
const JOB_PREFIX = "coder/github-jobs/";
const THREAD_PREFIX = "coder/github-threads/";
export const JOB_MAX_MS = 2 * 60 * 60 * 1000;

// ── SIGNATURES ───────────────────────────────────────────────────────────────
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
/** GitHub's X-Hub-Signature-256 over the raw body, compared in constant time. */
export async function verifySignature(secret, body, header) {
  if (!secret || typeof header !== "string" || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = "sha256=" + hex(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  if (want.length !== header.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ header.charCodeAt(i);
  return d === 0;
}

// ── THE APP'S OWN TOKEN (so Coder comments as gofarther-coder[bot]) ─────────
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const der = (pem) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
/** GitHub gives PKCS#1 ("RSA PRIVATE KEY"); WebCrypto takes PKCS#8: wrap it. */
export function pkcs1ToPkcs8(pkcs1) {
  const len = (n) => (n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]);
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...len(pkcs1.length)];
  const inner = [0x02, 0x01, 0x00, ...algo, ...octet];
  return new Uint8Array([0x30, ...len(inner.length + pkcs1.length), ...inner, ...pkcs1]);
}
export async function appJwt(env, now = Date.now()) {
  const pem = String(env.CODER_GITHUB_APP_PRIVATE_KEY || "");
  const id = String(env.CODER_GITHUB_APP_ID || "");
  if (!pem || !id) return null;
  const raw = der(pem);
  const pkcs8 = /BEGIN RSA PRIVATE KEY/.test(pem) ? pkcs1ToPkcs8(raw) : raw;
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const iat = Math.floor(now / 1000) - 60;
  const head = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify({ iat, exp: iat + 540, iss: id })));
  return head + "." + body + "." + b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + body)));
}
/** A short-lived token for one installation, or null (then Coder comments as the person). */
export async function installationToken(env, installationId, fetchFn = fetch) {
  if (!installationId) return null;
  const jwt = await appJwt(env).catch(() => null);
  if (!jwt) return null;
  const r = await fetchFn("https://api.github.com/app/installations/" + Number(installationId) + "/access_tokens", { method: "POST", headers: { authorization: "Bearer " + jwt, accept: "application/vnd.github+json", "user-agent": "gofarther-coder" } });
  const j = await r.json().catch(() => null);
  return r.ok && j && j.token ? j.token : null;
}
async function ghApi(token, path, { method = "GET", body, fetchFn = fetch } = {}) {
  const r = await fetchFn("https://api.github.com" + path, { method, headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "user-agent": "gofarther-coder", ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}

// ── WHO IS ASKING ────────────────────────────────────────────────────────────
const getJson = async (bucket, key) => { const o = await bucket.get(key); if (!o) return null; try { return JSON.parse(await o.text()); } catch { return null; } };
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });
export const branchKey = (repo, branch) => "coder/github-branches/" + String(repo).replace("/", "__") + "__" + String(branch).replace(/\//g, "__") + ".json";
export const loginKey = (login) => "coder/logins/" + String(login).toLowerCase() + ".json";
export const profileKey = (uid) => "coder/" + uid + "/profile.json";
/** The Coder account that connected this GitHub login: `{ uid, email }`, or null. */
export async function accountForLogin(bucket, login) {
  if (!login) return null;
  let hit = await getJson(bucket, loginKey(login));
  if (!hit) {
    // Connections made before the index: look through them once.
    let cursor;
    do {
      const page = await bucket.list({ prefix: "coder/", cursor });
      for (const o of page.objects || []) {
        const m = /^coder\/([^/]+)\/github\.json$/.exec(o.key);
        if (!m) continue;
        const rec = await getJson(bucket, o.key);
        if (rec && String(rec.login || "").toLowerCase() === String(login).toLowerCase()) { hit = { uid: m[1] }; await putJson(bucket, loginKey(login), hit); break; }
      }
      cursor = !hit && page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  if (!hit) return null;
  const prof = await getJson(bucket, profileKey(hit.uid));
  return { uid: hit.uid, email: prof && prof.email ? String(prof.email) : "" };
}

// ── THE WEBHOOK ──────────────────────────────────────────────────────────────
/** What a webhook asks for: `{ repo, number, isPr, text, login, installation, extra, headRef? }`, or null. */
export function readMention(event, p) {
  if (!p || p.action !== "created" || !p.comment || !p.repository) return null;
  if (p.sender && p.sender.type === "Bot") return null;
  const body = String(p.comment.body || "");
  if (!MENTION.test(body)) return null;
  const base = { repo: String(p.repository.full_name), login: String((p.sender && p.sender.login) || p.comment.user?.login || ""), installation: p.installation && p.installation.id, text: body.slice(0, 6000) };
  if (event === "issue_comment" && p.issue) {
    const isPr = !!p.issue.pull_request;
    return { ...base, number: p.issue.number, isPr, extra: (isPr ? "Pull request" : "Issue") + " #" + p.issue.number + " \"" + String(p.issue.title || "").slice(0, 200) + "\"" + (p.issue.body ? ":\n" + String(p.issue.body).slice(0, 4000) : "") };
  }
  if (event === "pull_request_review_comment" && p.pull_request) {
    return { ...base, number: p.pull_request.number, isPr: true, headRef: p.pull_request.head && p.pull_request.head.ref, extra: "Pull request #" + p.pull_request.number + " \"" + String(p.pull_request.title || "").slice(0, 200) + "\", a comment on " + String(p.comment.path || "") + (p.comment.line ? " line " + p.comment.line : "") + (p.comment.diff_hunk ? ":\n" + String(p.comment.diff_hunk).slice(0, 2000) : "") };
  }
  return null;
}

/**
 * POST /api/coder/github/webhook. `deps.coder(request, user)` runs a Coder
 * route as that user (the Worker's own routes); `deps.fetchFn` reaches GitHub.
 */
export async function handleWebhook(request, env, ctx, deps) {
  const body = await request.text();
  if (!(await verifySignature(env.CODER_GITHUB_WEBHOOK_SECRET, body, request.headers.get("x-hub-signature-256")))) return new Response("bad signature", { status: 401 });
  const event = request.headers.get("x-github-event") || "";
  if (event === "ping") return new Response("pong");
  let p; try { p = JSON.parse(body); } catch { return new Response("bad body", { status: 400 }); }
  // AUTO-FIX (owner, 2026-11-05, "4"): a failed check or a review on a pull
  // request from one of Coder's branches starts a fix in that branch's chat.
  const fix = readAutofix(event, p);
  if (fix) {
    const work = startAutofix(env, deps, fix).catch((e) => console.log("coder autofix failed: " + String((e && e.message) || e).slice(0, 200)));
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work); else await work;
    return new Response("ok", { status: 202 });
  }
  const m = readMention(event, p);
  if (!m) return new Response("ignored", { status: 202 });
  const work = startMention(env, deps, m).catch((e) => console.log("coder mention failed: " + String((e && e.message) || e).slice(0, 200)));
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work); else await work;
  return new Response("ok", { status: 202 });
}

const allowed = (env, email) => String(env.CODER_USERS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(String(email || "").toLowerCase());

export async function startMention(env, deps, m) {
  const bucket = env.CODER_BUCKET;
  const fetchFn = deps.fetchFn || fetch;
  const acct = await accountForLogin(bucket, m.login);
  const botToken = await installationToken(env, m.installation, fetchFn);
  const say = async (text) => { if (botToken) return ghApi(botToken, "/repos/" + m.repo + "/issues/" + m.number + "/comments", { method: "POST", body: { body: text }, fetchFn }); return null; };
  if (!acct || !allowed(env, acct.email)) {
    await say("@" + m.login + " Coder only works for accounts that connected GitHub on https://gofarther.dev and are allowed to use it.");
    return { ok: false, why: "not allowed" };
  }
  const user = { id: acct.uid, email: acct.email };
  const run = (path, init = {}) => deps.coder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), user).then((r) => r.json().catch(() => ({})).then((j) => ({ status: r.status, data: j })));
  // ONE CHAT PER ISSUE OR PR: the next @coder in the thread continues it.
  const threadKey = THREAD_PREFIX + m.repo.replace("/", "__") + "__" + m.number + "__" + acct.uid + ".json";
  let thread = await getJson(bucket, threadKey);
  if (thread) { const look = await run("projects/" + thread.id); if (look.status !== 200) thread = null; }
  if (!thread) {
    const made = await run("projects", { method: "POST", body: JSON.stringify({ repo: m.repo, ...(m.headRef ? { base: m.headRef } : {}) }) });
    if (made.status !== 200 || !made.data.project) { await say("@" + m.login + " Coder could not open " + m.repo + ": " + String((made.data && made.data.error) || made.status).slice(0, 200)); return { ok: false, why: "open" }; }
    thread = { id: made.data.project.id };
    await putJson(bucket, threadKey, thread);
  }
  const ask = m.text.replace(MENTION, "$1").trim();
  const text = "From GitHub, " + m.repo + ", " + m.extra + "\n\n@" + m.login + " asks: " + ask + "\n\n(Your answer is posted back on GitHub. If they ask for a pull request, use the pull_request tool.)";
  const ack = await say("On it, @" + m.login + ". I'm working on `" + m.repo + "` and will update this comment when I'm done.\n\n— Coder (gofarther.dev)");
  const sent = await run("projects/" + thread.id + "/message", { method: "POST", body: JSON.stringify({ text: text.slice(0, 12000) }) });
  if (sent.status !== 200) {
    const why = "Coder could not start: " + String((sent.data && sent.data.error) || sent.status).slice(0, 200);
    if (ack && ack.ok && botToken) await ghApi(botToken, "/repos/" + m.repo + "/issues/comments/" + ack.data.id, { method: "PATCH", body: { body: "@" + m.login + " " + why }, fetchFn });
    return { ok: false, why };
  }
  await putJson(bucket, JOB_PREFIX + acct.uid + "__" + thread.id + ".json", { uid: acct.uid, email: acct.email, id: thread.id, repo: m.repo, number: m.number, login: m.login, installation: m.installation, ackId: ack && ack.ok ? ack.data.id : null, at: Date.now() });
  return { ok: true, id: thread.id };
}

// ── AUTO-FIX PULL REQUESTS (owner, 2026-11-05, "4") ─────────────────────────
// Like Claude Code's auto-fix: when a check fails, or someone allowed leaves a
// review, on a pull request whose branch is one of Coder's, Coder fixes it in
// that branch's chat. At most AUTOFIX_MAX tries in a row without a person
// writing in the chat, so it can never loop forever on a red check.
export const AUTOFIX_MAX = 3;
/** `{ kind, repo, branch, number, installation, login?, text }`, or null. */
export function readAutofix(event, p) {
  if (!p || !p.repository || !p.installation) return null;
  const repo = String(p.repository.full_name);
  if (event === "check_run" && p.action === "completed" && p.check_run && ["failure", "timed_out"].includes(p.check_run.conclusion)) {
    const pr = (p.check_run.pull_requests || [])[0];
    const branch = pr && pr.head && pr.head.ref || (p.check_run.check_suite && p.check_run.check_suite.head_branch);
    if (!branch || !/^coder\//.test(branch)) return null;
    const o = p.check_run.output || {};
    return { kind: "check", repo, branch, number: pr ? pr.number : null, installation: p.installation.id, checkId: p.check_run.id, appSlug: p.check_run.app && p.check_run.app.slug,
      text: "The check \"" + String(p.check_run.name || "").slice(0, 120) + "\" failed (" + p.check_run.conclusion + ")" + (o.title ? ": " + String(o.title).slice(0, 200) : "") + (o.summary ? "\n" + String(o.summary).slice(0, 2000) : "") + (o.text ? "\n" + String(o.text).slice(0, 3000) : "") };
  }
  if (event === "pull_request_review" && p.action === "submitted" && p.review && p.pull_request && /^coder\//.test(p.pull_request.head && p.pull_request.head.ref || "")) {
    if (p.sender && p.sender.type === "Bot") return null;
    if (p.review.state === "approved" || !String(p.review.body || "").trim() && p.review.state !== "changes_requested") return null;
    if (MENTION.test(String(p.review.body || ""))) return null; // an @coder mention is handled as one
    return { kind: "review", repo, branch: p.pull_request.head.ref, number: p.pull_request.number, installation: p.installation.id, login: String(p.sender && p.sender.login || ""),
      text: "@" + (p.sender && p.sender.login) + " reviewed your pull request (" + p.review.state.replace("_", " ") + "):\n" + String(p.review.body || "(no text; see their line comments)").slice(0, 4000) };
  }
  if (event === "pull_request_review_comment" && p.action === "created" && p.comment && p.pull_request && /^coder\//.test(p.pull_request.head && p.pull_request.head.ref || "")) {
    if (p.sender && p.sender.type === "Bot") return null;
    if (MENTION.test(String(p.comment.body || ""))) return null;
    return { kind: "review", repo, branch: p.pull_request.head.ref, number: p.pull_request.number, installation: p.installation.id, login: String(p.sender && p.sender.login || ""),
      text: "@" + (p.sender && p.sender.login) + " commented on " + String(p.comment.path || "") + (p.comment.line ? " line " + p.comment.line : "") + ":\n" + String(p.comment.body || "").slice(0, 3000) + (p.comment.diff_hunk ? "\n\nThe lines:\n" + String(p.comment.diff_hunk).slice(0, 1500) : "") };
  }
  return null;
}

export async function startAutofix(env, deps, f) {
  const bucket = env.CODER_BUCKET;
  const fetchFn = deps.fetchFn || fetch;
  const owner = await getJson(bucket, branchKey(f.repo, f.branch));
  if (!owner) return { ok: false, why: "not a Coder branch" };
  const prof = await getJson(bucket, profileKey(owner.uid));
  const gh = await getJson(bucket, "coder/" + owner.uid + "/github.json");
  if (!prof || !allowed(env, prof.email)) return { ok: false, why: "not allowed" };
  // A review counts only from the owner's own GitHub account (others cannot spend their Grok).
  if (f.kind === "review" && String(f.login).toLowerCase() !== String(gh && gh.login || "").toLowerCase()) return { ok: false, why: "reviewer is not the owner" };
  const user = { id: owner.uid, email: prof.email };
  const run = (path, init = {}) => deps.coder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), user).then((r) => r.json().catch(() => ({})).then((j) => ({ status: r.status, data: j })));
  const look = await run("projects/" + owner.id);
  if (look.status !== 200 || !look.data.project) return { ok: false, why: "chat gone" };
  const meta = look.data.project;
  if (meta.autofix === false) return { ok: false, why: "auto-fix off" };
  if (meta.status === "running") return { ok: false, why: "busy" };
  if ((meta.autofixTries || 0) >= AUTOFIX_MAX) return { ok: false, why: "too many tries" };
  const botToken = await installationToken(env, f.installation, fetchFn);
  // THE FAILED RUN'S LOG (GitHub Actions): its last lines tell Coder what broke.
  let log = "";
  if (f.kind === "check" && botToken && f.checkId && (!f.appSlug || f.appSlug === "github-actions")) {
    const r = await fetchFn("https://api.github.com/repos/" + f.repo + "/actions/jobs/" + Number(f.checkId) + "/logs", { headers: { authorization: "Bearer " + botToken, accept: "application/vnd.github+json", "user-agent": "gofarther-coder" } }).catch(() => null);
    if (r && r.ok) log = (await r.text().catch(() => "")).replace(/^\S+Z /gm, "").slice(-6000);
  }
  const text = "AUTO-FIX for pull request" + (f.number ? " #" + f.number : "") + " on " + f.branch + ".\n\n" + f.text + (log ? "\n\nThe end of the failed run's log:\n" + log : "") +
    "\n\nFix this on the branch with small, focused changes, and check them (run the same tests or build locally if you can). If the cause is not in your changes, or it is unclear what the reviewer wants, change nothing and explain instead.";
  const ack = f.number && botToken ? await ghApi(botToken, "/repos/" + f.repo + "/issues/" + f.number + "/comments", { method: "POST", body: { body: (f.kind === "check" ? "A check failed. " : "Thanks for the review. ") + "Coder is working on a fix (try " + ((meta.autofixTries || 0) + 1) + " of " + AUTOFIX_MAX + ") and will update this comment.\n\n— Coder (gofarther.dev)" }, fetchFn }) : null;
  const sent = await run("projects/" + owner.id + "/message", { method: "POST", body: JSON.stringify({ text: text.slice(0, 18000), autofix: true }) });
  if (sent.status !== 200) return { ok: false, why: "could not start" };
  if (f.number) await putJson(bucket, JOB_PREFIX + owner.uid + "__" + owner.id + ".json", { uid: owner.uid, email: prof.email, id: owner.id, repo: f.repo, number: f.number, login: (gh && gh.login) || "", installation: f.installation, ackId: ack && ack.ok ? ack.data.id : null, at: Date.now() });
  return { ok: true, id: owner.id };
}

// ── EVERY MINUTE: finished jobs get their answer on GitHub ───────────────────
export function finalText(job, project, events) {
  const after = (() => { let i = events.length - 1; while (i >= 0 && events[i].type !== "user") i--; return events.slice(i + 1); })();
  const done = [...after].reverse().find((e) => e.type === "done" || e.type === "text");
  const question = [...after].reverse().find((e) => e.type === "question");
  const err = [...after].reverse().find((e) => e.type === "error");
  const gh = after.filter((e) => e.type === "github").map((e) => e.text);
  const lines = ["@" + job.login + " " + (question ? "Coder has a question:" : err && !done ? "Coder ran into a problem:" : "Done.")];
  if (done && done.text) lines.push("", String(done.text).slice(0, 6000));
  if (question) lines.push("", "**" + question.text + "**", ...(question.options || []).map((o) => "- " + o), "", "Answer with `@coder <your choice>`.");
  if (err && !done) lines.push("", String(err.text).slice(0, 500));
  const branch = project && project.branch;
  if (project && project.pr && project.pr.url) lines.push("", "Pull request: " + project.pr.url);
  else if (branch && gh.some((t) => /Saved to the branch/.test(t))) lines.push("", "Branch: https://github.com/" + job.repo + "/tree/" + branch + " · [open a pull request](https://github.com/" + job.repo + "/compare/" + encodeURIComponent(project.base || "main") + "..." + encodeURIComponent(branch) + "?expand=1) or ask `@coder make a pull request`");
  lines.push("", "Continue this chat on https://gofarther.dev");
  return lines.join("\n");
}

export async function runMentionJobs(env, deps, now = Date.now()) {
  const bucket = env.CODER_BUCKET;
  const fetchFn = deps.fetchFn || fetch;
  const page = await bucket.list({ prefix: JOB_PREFIX });
  let finished = 0;
  for (const o of page.objects || []) {
    const job = await getJson(bucket, o.key);
    if (!job) { await bucket.delete(o.key); continue; }
    const user = { id: job.uid, email: job.email };
    const run = (path) => deps.coder(new Request("https://gofarther.dev/api/coder/" + path), user).then((r) => r.json().catch(() => ({})));
    const st = await run("projects/" + job.id + "/state?since=0").catch(() => null);
    const stillGoing = st && (st.running || (st.project && st.project.status === "running"));
    if (stillGoing && now - job.at < JOB_MAX_MS) continue;
    const full = await run("projects/" + job.id).catch(() => null);
    const events = (full && Array.isArray(full.events) ? full.events : []);
    const text = stillGoing ? "@" + job.login + " Coder is taking longer than 2 hours on this; check it on https://gofarther.dev" : finalText(job, full && full.project, events);
    const tok = await installationToken(env, job.installation, fetchFn);
    if (tok) {
      if (job.ackId) await ghApi(tok, "/repos/" + job.repo + "/issues/comments/" + job.ackId, { method: "PATCH", body: { body: text }, fetchFn });
      else await ghApi(tok, "/repos/" + job.repo + "/issues/" + job.number + "/comments", { method: "POST", body: { body: text }, fetchFn });
    }
    await bucket.delete(o.key);
    finished++;
  }
  return { finished };
}

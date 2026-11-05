// CODER'S ROUTES (2026-11-05), in Coder's own Worker. Off unless CODER_ON is
// "on" (free while testing: nothing is charged).
//
// THE CODE LIVES IN THE USER'S GITHUB (owner, 2026-11-05: "instead of the files
// going to R2 … the code goes through their GitHub account"). A project is one
// of their repositories: Coder clones it in its container, works on its own
// branch (coder/<project>), and after each piece of work commits, pushes that
// branch and opens a pull request into the repository's main branch, as the
// user. Coder's bucket keeps only the chat and the user's GitHub connection
// (encrypted), never their code.
//
// Kept in Coder's bucket, under coder/<user>/:
//   github.json             the GitHub connection (sealed)
//   index.json              the user's projects: [{ id, name, repo, at }]
//   <project>/meta.json     { id, name, repo, base, branch, turn, saved, ask, status, pr, at }
//   <project>/messages.json the conversation as Coder reads it
//   <project>/events.json   what the chat shows
//
//   GET  /api/coder/github                       connected? and where to connect
//   GET  /api/coder/github/start                 { url }: the GitHub sign-in to open
//   GET  /api/coder/github/callback?code&state   GitHub sends the user back here
//   GET  /api/coder/github/repos                 the repositories they let Coder use
//   POST /api/coder/github/disconnect
//   GET  /api/coder/projects                     their projects
//   POST /api/coder/projects    { repo, base? }  a project for one of their repositories
//   GET  /api/coder/projects/:id                 its meta and chat
//   POST /api/coder/projects/:id/message { text } start a turn (the text, or an answer)
//   GET  /api/coder/projects/:id/state?since=n   new chat lines; when the turn ends,
//                                                the branch is pushed and the pull request opened
//   POST /api/coder/projects/:id/stop
import { PROJECT_ID } from "../container/coder-checks.mjs";
import { githubReady, makeState, readState, signInUrl, installUrl, exchangeCode, saveConnection, forgetConnection, userToken, gh, listRepos, openPullRequest, REPO, BRANCH } from "./coder-github.mjs";

const MAX_PROJECTS = 50;
const MAX_TEXT = 20000;
const MAX_EVENTS = 4000;

export function coderOn(env) { return !!env && env.CODER_ON === "on"; }
/** Whether this signed-in user may use Coder: their email is in CODER_USERS (comma-separated). */
export function coderAllowed(env, user) {
  const email = user && typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email) return false;
  return String((env && env.CODER_USERS) || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(email);
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const keyOf = (uid, ...rest) => ["coder", uid, ...rest].join("/");
async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });

/** A project id from a repository's name: lowercase words joined by dashes, with a short suffix. */
export function projectIdFor(name, rand = Math.random) {
  const base = String(name || "project").split("/").pop().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "project";
  return (base.length < 3 ? "project-" + base : base) + "-" + Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0");
}

/** The first line of the agent's summary, as a commit message and a pull request title. */
export function commitTitle(summary) {
  const first = String(summary || "").split(/\n|(?<=\.)\s/)[0].trim();
  return (first || "Changes by Coder").slice(0, 120);
}

/**
 * Handle one /api/coder/ request. `deps`: `authUser(request) → { id } | null`,
 * `container(name) → { fetch(Request) }`, optional `fetchFn` (GitHub calls).
 */
export async function handleCoder(request, env, ctx, deps) {
  if (!coderOn(env)) return json({ error: "Coder is not switched on yet." }, 404);
  const bucket = env.CODER_BUCKET;
  if (!bucket) return json({ error: "storage is not available" }, 503);
  const fetchFn = deps.fetchFn || fetch;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/coder\/?/, "").split("/").filter(Boolean);

  // ── THE GITHUB SIGN-IN'S RETURN: a plain visit from GitHub, with no sign-in
  // header; the signed state says whose it is. ──
  if (parts[0] === "github" && parts[1] === "callback") {
    const back = String(env.APP_ORIGIN || "https://gofarther.dev") + "/home/coder";
    if (!githubReady(env)) return Response.redirect(back + "?github=unavailable", 302);
    const uid = await readState(env, url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    if (!uid || !code) return Response.redirect(back + "?github=failed", 302);
    try {
      const tok = await exchangeCode(env, code, fetchFn);
      const me = await gh(tok.access, "/user", { fetchFn });
      await saveConnection(env, bucket, uid, tok, me.ok && me.data ? String(me.data.login || "") : "");
    } catch { return Response.redirect(back + "?github=failed", 302); }
    return Response.redirect(back + "?github=connected", 302);
  }

  const user = await deps.authUser(request);
  if (!user || typeof user.id !== "string") return json({ error: "sign in first" }, 401);
  // WHILE TESTING (2026-11-05, the owner: "turn it on", free while testing):
  // only the emails in CODER_USERS may use it. Empty list = nobody.
  if (!coderAllowed(env, user)) return json({ error: "Coder is not open to this account yet." }, 403);
  const uid = user.id;

  if (parts[0] === "github") {
    if (!githubReady(env)) return json({ error: "GitHub is not set up for Coder yet." }, 503);
    const what = parts[1] || "";
    if (!what && request.method === "GET") {
      const t = await userToken(env, bucket, uid, { fetchFn });
      return json({ ok: true, connected: !!t, login: t ? t.login : "", install: installUrl(env) });
    }
    if (what === "start" && request.method === "GET") return json({ ok: true, url: signInUrl(env, await makeState(env, uid)) });
    if (what === "disconnect" && request.method === "POST") { await forgetConnection(bucket, uid); return json({ ok: true }); }
    if (what === "repos" && request.method === "GET") {
      const t = await userToken(env, bucket, uid, { fetchFn });
      if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
      try { return json({ ok: true, repos: await listRepos(t.token, fetchFn), install: installUrl(env) }); }
      catch { return json({ error: "GitHub could not be reached" }, 502); }
    }
    return json({ error: "not found" }, 404);
  }

  if (parts[0] !== "projects") return json({ error: "not found" }, 404);
  const indexKey = keyOf(uid, "index.json");

  if (parts.length === 1) {
    const index = await getJson(bucket, indexKey, []);
    if (request.method === "GET") return json({ ok: true, projects: index });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    if (!githubReady(env)) return json({ error: "GitHub is not set up for Coder yet." }, 503);
    if (index.length >= MAX_PROJECTS) return json({ error: "at most " + MAX_PROJECTS + " projects" }, 409);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const repo = String(body.repo || "").trim();
    if (!REPO.test(repo)) return json({ error: "pick one of your GitHub repositories" }, 400);
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
    // ONLY A REPOSITORY THIS USER GAVE CODER: GitHub itself says, as them.
    const r = await gh(t.token, "/repos/" + repo, { fetchFn });
    if (!r.ok || !r.data || !(r.data.permissions && r.data.permissions.push)) return json({ error: "Coder cannot write to " + repo + ": add it to Coder in GitHub first", install: installUrl(env) }, 403);
    const base = typeof body.base === "string" && BRANCH.test(body.base) ? body.base : String(r.data.default_branch || "main");
    const id = projectIdFor(repo);
    const meta = { id, name: repo, repo, base, branch: "coder/" + id, turn: 0, saved: 0, ask: null, status: "idle", pr: null, at: Date.now() };
    await putJson(bucket, keyOf(uid, id, "meta.json"), meta);
    await putJson(bucket, indexKey, [{ id, name: repo, repo, at: meta.at }, ...index]);
    return json({ ok: true, project: meta });
  }

  const id = parts[1];
  if (!PROJECT_ID.test(id)) return json({ error: "bad project" }, 400);
  const metaKey = keyOf(uid, id, "meta.json");
  const meta = await getJson(bucket, metaKey, null);
  if (!meta) return json({ error: "no such project" }, 404);
  const box = () => deps.container(uid.slice(0, 12) + "-" + id);
  const call = (path, init) => box().fetch(new Request("http://coder" + path, init));
  const post = (path, body) => call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const action = parts[2] || "";

  if (!action && request.method === "GET") return json({ ok: true, project: meta, events: await getJson(bucket, keyOf(uid, id, "events.json"), []) });

  if (action === "message" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const text = String(body.text || "").trim();
    if (!text) return json({ error: "write something first" }, 400);
    if (text.length > MAX_TEXT) return json({ error: "the message is over " + MAX_TEXT + " characters" }, 413);
    if (meta.status === "running") return json({ error: "Coder is still working on the last message" }, 409);
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub again: the connection has ended", connect: true }, 409);
    const messages = await getJson(bucket, keyOf(uid, id, "messages.json"), []);
    const r = await post("/turn", { project: id, text, messages, repo: meta.repo, base: meta.base, branch: meta.branch, token: t.token });
    if (!r.ok) {
      const why = await r.json().catch(() => ({}));
      return json({ error: r.status === 409 ? "Coder is still working on the last message" : "Coder could not open " + meta.repo + (why && why.error ? ": " + String(why.error).slice(0, 200) : "") }, r.status === 409 ? 409 : 502);
    }
    const next = { ...meta, turn: meta.turn + 1, status: "running", ask: null, at: Date.now() };
    await putJson(bucket, metaKey, next);
    return json({ ok: true, project: next });
  }

  if (action === "state" && request.method === "GET") {
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let s = null;
    try { const r = await call("/state?project=" + id + "&since=" + since, { method: "GET" }); s = r.ok ? await r.json() : null; } catch { s = null; }
    if (!s) return json({ ok: false, error: "Coder's machine could not be reached", project: meta }, 502);
    // THE TURN ENDED: the chat is kept, and the work goes to GitHub (a commit on
    // Coder's branch, pushed, and a pull request), once per turn.
    if (s.result && meta.status === "running" && meta.saved < meta.turn) {
      const all = await call("/state?project=" + id + "&since=0", { method: "GET" }).then((r) => r.json()).catch(() => ({ events: [] }));
      const old = await getJson(bucket, keyOf(uid, id, "events.json"), []);
      const fresh = Array.isArray(all.events) ? all.events.slice() : [];
      let pr = meta.pr || null, pushNote = "";
      const t = await userToken(env, bucket, uid, { fetchFn });
      if (!t) pushNote = "Not sent to GitHub: the connection has ended. Connect GitHub again and send a message to push it.";
      else {
        const p = await post("/push", { project: id, branch: meta.branch, token: t.token, message: commitTitle(s.result.summary) }).then((r) => r.json()).catch(() => ({ ok: false, why: "the machine could not be reached" }));
        if (!p.ok) pushNote = "Not sent to GitHub: " + String(p.why || "the push failed").slice(0, 200);
        else if (p.pushed || !pr) {
          if (!pr) pr = await openPullRequest(t.token, meta.repo, { head: meta.branch, base: meta.base, title: "Coder: " + commitTitle(s.result.summary), body: String(s.result.summary || "").slice(0, 4000) + "\n\nMade with Coder." }, fetchFn).catch(() => null);
          pushNote = p.pushed ? "Pushed to " + meta.branch + (pr ? " · pull request " + pr.url : "") : "";
        }
      }
      if (pushNote) fresh.push({ at: Date.now(), type: "github", text: pushNote });
      await putJson(bucket, keyOf(uid, id, "messages.json"), Array.isArray(s.result.messages) ? s.result.messages : []);
      await putJson(bucket, keyOf(uid, id, "events.json"), [...old, ...fresh].slice(-MAX_EVENTS));
      const ended = { ...meta, saved: meta.turn, pr, status: s.result.status === "ask" ? "waiting" : s.result.status === "done" ? "idle" : s.result.status, ask: s.result.ask || null, at: Date.now() };
      await putJson(bucket, metaKey, ended);
      return json({ ok: true, events: [...(s.events || []), ...(pushNote ? [fresh.at(-1)] : [])], next: s.next || since, running: false, project: ended });
    }
    return json({ ok: true, events: s.events || [], next: s.next || since, running: !!s.running, project: meta });
  }

  if (action === "stop" && request.method === "POST") {
    try { await post("/stop", { project: id }); } catch { /* the next look says */ }
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}

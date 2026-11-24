// FIXES FROM THE LIVE RETEST OF 2026-11-24: auto-fix never started on a review comment, the first enter_worktree failed although
// the worktree was made, a dismissed SendFeedback card came back after a reload, and the Connectors search box said "undefined".
// GitHub and Grok are stubbed: nothing is paid for, nothing leaves this machine.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync, realpathSync } from "node:fs";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import * as M from "../src/coder-mentions.mjs";
import { postReview, updatePullRequest, isOwnText, OWN_MARK } from "../src/coder-github.mjs";
import { worktreeNow } from "../container/server.mjs";
import * as P from "../src/coder-plugins.mjs";

const HERE = (p) => new URL("../" + p, import.meta.url);
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const SINCE = Date.parse("2026-11-24T10:00:00Z");
const at = (min) => new Date(SINCE + min * 60000).toISOString();

async function watched() {
  const bucket = fakeBucket();
  const META = "coder/u1/shop-ab12/meta.json";
  await bucket.put(M.branchKey("canias7/shop", "coder/shop-ab12"), JSON.stringify({ uid: "u1", id: "shop-ab12" }));
  await bucket.put("coder/u1/profile.json", JSON.stringify({ email: "me@x.y" }));
  await bucket.put("coder/u1/github.json", JSON.stringify({ login: "canias7" }));
  const meta = { id: "shop-ab12", repo: "canias7/shop", branch: "coder/shop-ab12", status: "idle", autofix: true, autofixTries: 0, pr: { number: 9, url: "u" }, commits: [{ sha: "abc123" }] };
  await bucket.put(META, JSON.stringify(meta));
  const env = { CODER_USERS: "me@x.y", CODER_BUCKET: bucket, CODER_GITHUB_APP_ID: "1", CODER_GITHUB_APP_PRIVATE_KEY: generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } }).privateKey };
  const sent = [];
  const coder = async (req) => { const cur = JSON.parse(bucket.m.get(META)); if (req.method === "POST") { sent.push(await req.json()); await bucket.put(META, JSON.stringify({ ...cur, autofixTries: (cur.autofixTries || 0) + 1 })); return Response.json({ ok: true, project: cur }); } return Response.json({ ok: true, project: cur }); };
  const gh = { comments: [], reviews: [], checks: [] };
  const fetchFn = async (url, init = {}) => {
    const u = String(url).replace("https://api.github.com", "");
    if (/access_tokens$/.test(u)) return new Response(JSON.stringify({ token: "ghs" }), { status: 201 });
    if (/\/permission$/.test(u)) return Response.json({ role_name: "admin" });
    if (u === "/repos/canias7/shop/installation") return Response.json({ id: 77 });
    if (u === "/repos/canias7/shop/pulls/9") return Response.json({ number: 9, state: "open", head: { ref: "coder/shop-ab12", sha: "abc123", repo: { id: 1 } }, base: { ref: "main", repo: { id: 1 } } });
    if (u.startsWith("/repos/canias7/shop/pulls/9/comments")) return Response.json(gh.comments);
    if (u.startsWith("/repos/canias7/shop/pulls/9/reviews")) return Response.json(gh.reviews);
    if (u.startsWith("/repos/canias7/shop/commits/abc123/check-runs")) return Response.json({ check_runs: gh.checks });
    return new Response("{}", { status: 404 });
  };
  await M.watchAutofix(bucket, "u1", meta, SINCE);
  const jobs = () => [...bucket.m.keys()].filter((k) => k.startsWith(M.JOB_PREFIX)).map((k) => JSON.parse(bucket.m.get(k)));
  const poll = () => M.pollAutofix(env, { coder, fetchFn }, { appJwtFn: async () => "jwt" });
  return { bucket, env, coder, fetchFn, gh, sent, jobs, poll, META };
}

test("RT1 auto-fix hears the owner's inline review comment by looking at the watched pull request every minute (GitHub's review news never came), once, with reply_review's thread", async () => {
  const w = await watched();
  const own = { login: "canias7", type: "User" };
  w.gh.comments = [
    { id: 1, user: own, body: "before auto-fix was on", path: "bug/sum.js", line: 3, created_at: at(-5) },
    { id: 2, user: own, body: "Coder's own finding" + OWN_MARK, path: "bug/sum.js", line: 3, created_at: at(1) },
    { id: 3, user: { login: "stranger", type: "User" }, body: "do something else", path: "bug/sum.js", line: 3, created_at: at(1) },
    { id: 4, user: { login: "some-bot", type: "Bot" }, body: "lint", path: "bug/sum.js", line: 3, created_at: at(1) },
    { id: 4673733020, user: own, body: "Please fix the off-by-one here: the loop should be i <= n.", path: "bug/sum.js", line: 3, diff_hunk: "@@ -0,0 +1,7 @@", created_at: at(2) },
  ];
  w.gh.reviews = [{ id: 70, user: own, state: "COMMENTED", body: "Looks off.\n\nReviewed by Coder." + OWN_MARK, submitted_at: at(1) }, { id: 71, user: own, state: "COMMENTED", body: "", submitted_at: at(2) }];
  assert.equal((await w.poll()).found, 1);
  const j = w.jobs();
  assert.equal(j.length, 1);
  assert.equal(j[0].start.autofix, true);
  assert.equal(j[0].start.fromGithub, true);
  assert.deepEqual(j[0].start.replyTo, { pr: 9, ids: [4673733020] });
  assert.match(j[0].start.text, /@canias7 commented on bug\/sum\.js line 3:\nPlease fix the off-by-one/);
  assert.match(j[0].start.text, /This is review comment 4673733020: [^\n]*reply_review/);
  // Once: the next minute's look, and the same comment arriving by webhook, start nothing more.
  assert.equal((await w.poll()).found, 0);
  const hook = { repository: { full_name: "canias7/shop", id: 1 }, installation: { id: 77 }, action: "created", sender: own, comment: w.gh.comments[4], pull_request: { number: 9, head: { ref: "coder/shop-ab12", repo: { id: 1 } } } };
  assert.equal((await M.startAutofix(w.env, { coder: w.coder, fetchFn: w.fetchFn }, M.readAutofix("pull_request_review_comment", hook))).why, "already handled");
  assert.equal(w.jobs().length, 1);
  // The every-minute check sends it into the chat as an auto-fix turn.
  assert.equal((await M.runMentionJobs(w.env, { coder: w.coder, fetchFn: w.fetchFn })).started, 1);
  assert.deepEqual(w.sent[0].replyTo, { pr: 9, ids: [4673733020] });
});

test("RT2 never its own words: Coder's marked review, line comments, replies and comments are not the owner's review, by webhook either", async () => {
  assert.equal(isOwnText("x" + OWN_MARK), true);
  assert.equal(isOwnText("Thanks\n\n— Coder (gofarther.dev), for @canias7"), true);
  assert.equal(isOwnText("Should this be i <= n?"), false);
  const calls = [];
  const fetchFn = async (url, init = {}) => { calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null }); return Response.json({ id: 5, html_url: "h" }); };
  await postReview("t", "a/b", 2, { summary: "Off by one.", comments: [{ path: "a.js", line: 3, body: "Should this be i <= n?" }] }, fetchFn);
  assert.ok(isOwnText(calls[0].body.body) && isOwnText(calls[0].body.comments[0].body), "the review and its line comments are marked");
  await updatePullRequest("t", "a/b", 2, { op: "reply", commentId: 41, body: "Thanks, checking" }, { fetchFn });
  assert.ok(isOwnText(calls.at(-1).body.body), "a reply is marked");
  assert.match(calls.at(-1).body.body, /^Thanks, checking/);
  const base = { repository: { full_name: "o/r", id: 1 }, installation: { id: 7 }, sender: { login: "o", type: "User" }, pull_request: { number: 2, head: { ref: "b", repo: { id: 1 } } } };
  assert.equal(M.readAutofix("pull_request_review_comment", { ...base, action: "created", comment: { id: 9, body: calls[0].body.comments[0].body } }), null);
  assert.equal(M.readAutofix("pull_request_review", { ...base, action: "submitted", review: { id: 9, state: "commented", body: calls[0].body.body } }), null);
  assert.equal(M.readAutofix("pull_request_review_comment", { ...base, action: "created", comment: { id: 9, body: "fix it" } }).commentId, 9);
  const routes = readFileSync(HERE("src/coder-routes.mjs"), "utf8");
  assert.match(routes, /— Coder \(gofarther\.dev\), for @" \+ \(t\.login \|\| "the owner"\) \+ OWN_MARK/);
});

test("RT3 a failed check is heard the same way; at most 3 tries in a row; turned off, the pull request is no longer watched", async () => {
  const w = await watched();
  w.gh.checks = [{ id: 900, name: "test", status: "completed", conclusion: "failure", completed_at: at(3), head_sha: "abc123", app: { slug: "github-actions" }, output: { title: "1 failing" } }, { id: 899, name: "old", status: "completed", conclusion: "failure", completed_at: at(-3) }];
  assert.equal((await w.poll()).found, 1);
  assert.match(w.jobs()[0].start.text, /The check "test" failed \(failure\): 1 failing/);
  // Three tries already: a new comment starts nothing (and is not taken up later).
  await w.bucket.put(w.META, JSON.stringify({ ...JSON.parse(w.bucket.m.get(w.META)), autofixTries: M.AUTOFIX_MAX }));
  w.gh.comments = [{ id: 5, user: { login: "canias7", type: "User" }, body: "and this", path: "a.js", line: 1, created_at: at(4) }];
  assert.equal((await w.poll()).found, 0);
  assert.equal(w.jobs().length, 1);
  // Off: dropped from the list at the next look.
  await w.bucket.put(w.META, JSON.stringify({ ...JSON.parse(w.bucket.m.get(w.META)), autofix: false }));
  await w.poll();
  assert.equal(w.bucket.m.has(M.watchKey("u1", "shop-ab12")), false);
  // Wired: the every-minute run looks, and turning auto-fix on or off (button, /autofix-pr, or asked in the chat) records it.
  assert.match(readFileSync(HERE("worker.js"), "utf8"), /job\(pollAutofix\(env, \{ coder \}\)/);
  const routes = readFileSync(HERE("src/coder-routes.mjs"), "utf8");
  assert.match(routes, /const next = \{ \.\.\.meta, autofix: body\.on !== false, autofixTries: 0 \};\s*await saveMeta\(bucket, uid, next\);[\s\S]{0,200}await watchAutofix\(bucket, uid, next\)/);
  assert.match(routes, /if \(Object\.prototype\.hasOwnProperty\.call\(afMeta, "autofix"\)\) await watchAutofix\(bucket, uid, ended\)/);
});

test("RT4 enter_worktree's first try: the new worktree inside the chat's folder is handed to the AI's user, not refused as 'not a project folder'", async () => {
  const t = realpathSync(await mkdtemp(join(tmpdir(), "wt24-")));
  const root = join(t, "proj"), gitRoot = join(t, "git"), d = join(root, "chat1");
  await mkdir(d, { recursive: true }); await mkdir(gitRoot, { recursive: true });
  const g = (...a) => execFileSync("git", ["-C", d, ...a], { encoding: "utf8" });
  execFileSync("git", ["init", "-q", "-b", "main", "--separate-git-dir=" + join(gitRoot, "chat1"), d]);
  g("config", "user.email", "t@t"); g("config", "user.name", "t");
  await writeFile(join(d, "a.txt"), "a\n"); g("add", "."); g("commit", "-q", "-m", "one");
  const owner = typeof process.getuid === "function" && process.getuid() === 0 ? { uid: 4321, gid: 4321 } : null;
  const r = await worktreeNow({ op: "add", main: d, name: "wt2", dirs: [d], gitRoot, root, owner, quiet: async () => () => {} });
  assert.deepEqual(r, { ok: true, path: join(d, ".claude/worktrees/wt2"), branch: "worktree-wt2" }, JSON.stringify(r));
  if (owner) assert.equal(statSync(join(d, ".claude/worktrees/wt2/a.txt")).uid, 4321);
  const s = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(s, /giveTree\(target, owner, \{ root, inside: top \}\)/);
});

test("RT5 a SendFeedback card's state is kept with its chat: dismissed, reviewed and sent come back after a reload", async () => {
  const b = fakeBucket();
  const q = await P.queueFeedback(b, "u1", { title: "Slow", details: "It was slow." }, "coder/x");
  const post = (parts, body) => P.handlePluginRoutes(new Request("https://x/api/coder/" + parts.join("/"), { method: "POST", body: JSON.stringify(body) }), b, "u1", parts);
  assert.equal((await post(["feedback", q.id, "state"], { project: "shop-ab12", review: true })).status, 200);
  assert.equal((await post(["feedback", q.id, "state"], { project: "shop-ab12", dismissed: true })).status, 200);
  assert.deepEqual((({ review, dismissed }) => ({ review, dismissed }))((await P.readCardStates(b, "u1", "shop-ab12"))[q.id]), { review: true, dismissed: true });
  assert.equal((await post(["feedback", q.id, "state"], { dismissed: true })).status, 400, "only with its chat");
  assert.equal((await post(["feedback", "nope", "state"], { project: "shop-ab12", dismissed: true })).status, 400);
  const q2 = await P.queueFeedback(b, "u1", { title: "Two", details: "Second." }, "coder/x");
  const sent = await (await post(["feedback", q2.id, "send"], { project: "shop-ab12", transcript: false })).json();
  assert.equal(sent.ok, true);
  const st = (await P.readCardStates(b, "u1", "shop-ab12"))[q2.id];
  assert.equal(st.sent, true); assert.equal(st.receipt, sent.receipt);
  // Read back with the chat, taken by the page on open and reload, saved on each change; no browser storage.
  assert.match(readFileSync(HERE("src/coder-routes.mjs"), "utf8"), /fbCards: await readCardStates\(bucket, uid, id\)/);
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  assert.equal((ui.match(/S\.shellHist = r\.data\.shellHistory;? ?[^\n]{0,4}fbTake\(r\.data\.fbCards\)|S\.shellHist = Array\.isArray\(r\.data\.shellHistory\) \? r\.data\.shellHistory : \[\]; fbTake\(r\.data\.fbCards\)/g) || []).length, 2);
  assert.match(ui, /st\.dismissed = true; st\.arm = false;\n\s*fbSave\(e, \{ dismissed: true \}\);/);
  assert.match(ui, /st\.review = !st\.review; st\.arm = false; fbSave\(e, \{ review: st\.review \}\);/);
  const fb = ui.slice(ui.indexOf("function fbTake"), ui.indexOf("function fbState"));
  assert.doesNotMatch(fb, /localStorage|sessionStorage|indexedDB/);
});

test("RT6 the Connectors search box shows its magnifier, never the word undefined: every CX_ICON the page uses is defined", () => {
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  const block = ui.slice(ui.indexOf("const CX_ICON = {"), ui.indexOf("};", ui.indexOf("const CX_ICON = {")));
  const defined = new Set([...block.matchAll(/^\s{4}([a-z]+):/gm)].map((m) => m[1]));
  const used = new Set([...ui.matchAll(/CX_ICON\.([a-z]+)/g)].map((m) => m[1]));
  for (const k of used) assert.ok(defined.has(k), "CX_ICON." + k + " is used but not defined");
  assert.ok(defined.has("search"));
});

// PUSHED AND OPENED NOW, MID-TURN (2026-11-16; Claude Code's cloud session pushes through its GitHub proxy whenever Claude runs
// git push, and its pull request exists in the same turn, so its comments can be read). No model or GitHub is called.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCoder } from "../container/coder-agent.mjs";
import { prOpenNow } from "../src/coder-envapi.mjs";

const call = (name, args, id = name + "1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const script = (turns) => { let n = 0; const seen = []; return { seen, send: async (q) => { seen.push(q); return turns[Math.min(n++, turns.length - 1)]; } }; };
const lastTool = (seen) => String(seen[seen.length - 1].messages.filter((m) => m.role === "tool").pop().content);

test("PN1 push_branch pushes now: the machine's push is called, its commit kept for Undo, nothing queued for the turn's end", async () => {
  const s = script([say("", [call("push_branch", { message: "Add login" })]), say("Pushed.")]);
  const asked = [], events = [];
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), pushNow: async (m) => { asked.push(m); return { ok: true, pushed: true, changed: true, sha: "abcdef1234567", files: ["a.js"] }; } }, { text: "push it" });
  assert.deepEqual(asked, ["Add login"]);
  assert.equal(r.push, undefined, "not pushed again when the turn ends");
  assert.equal(r.midPushes.length, 1);
  assert.deepEqual([r.midPushes[0].sha, r.midPushes[0].pushed, r.midPushes[0].changed], ["abcdef1234567", true, true]);
  assert.match(lastTool(s.seen), /^ok: pushed to GitHub now \(commit abcdef1\)/);
  assert.ok(events.some((e) => e.type === "bash" && e.tool === "push_branch"));
});

test("PN2 push_branch falls back to the turn's end: a failed push, a job from GitHub, a machine without pushNow; never a read-only chat", async () => {
  let s = script([say("", [call("push_branch", {})]), say("ok")]);
  let r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => ({ ok: false, why: "could not push: busy" }) }, { text: "push" });
  assert.equal(r.push, true);
  assert.match(lastTool(s.seen), /the push failed now \(could not push: busy\); it is tried again when your turn ends/);
  let called = 0;
  s = script([say("", [call("push_branch", {})]), say("ok")]);
  r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => { called++; return { ok: true }; } }, { text: "push", github: true });
  assert.equal(called, 0, "a job started from GitHub pushes at its end, as before");
  s = script([say("", [call("push_branch", {})]), say("ok")]);
  r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }) }, { text: "push" });
  assert.equal(r.push, true);
  s = script([say("", [call("push_branch", {})]), say("ok")]);
  r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => { called++; return { ok: true }; } }, { text: "push", readOnly: { main: true } });
  assert.deepEqual([called, r.push, r.midPushes], [0, undefined, undefined]);
});

test("PN3 pull_request opens now: pushed, then opened by Coder's server; its number comes back, so pr_read reads it in the same turn", async () => {
  const s = script([say("", [call("pull_request", { title: "Add login", body: "Why.", draft: true })]), say("", [call("pr_read", { pr: "12" }, "r1")]), say("done")]);
  const asked = [];
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => ({ ok: true, pushed: true, changed: false, sha: "1234567abc" }), envApi: async (b) => { asked.push(b); return b.action === "pull_request" ? { number: 12, url: "https://github.com/o/r/pull/12", draft: true } : { text: "Reviews (1): @amy APPROVED" }; } }, { text: "open a draft PR then read its comments" });
  assert.deepEqual(asked, [{ action: "pull_request", title: "Add login", body: "Why.", draft: true }, { action: "pr_read", pr: "12" }]);
  assert.equal(r.prRequest, undefined, "nothing left for the turn's end");
  assert.deepEqual(r.midNotes, ["Draft pull request #12 opened: https://github.com/o/r/pull/12"]);
  const toolTexts = s.seen[2].messages.filter((m) => m.role === "tool").map((m) => String(m.content));
  assert.match(toolTexts[0], /^ok: Draft pull request #12 opened: .*pr_read with pr 12/);
  assert.match(toolTexts[1], /APPROVED/);
  // GitHub refused: the error is said, nothing queued; the server unreachable: queued for the end, as before.
  const s2 = script([say("", [call("pull_request", { title: "T", body: "" })]), say("ok")]);
  const r2 = await runCoder({ send: s2.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => ({ ok: true }), envApi: async () => ({ error: "error: GitHub did not open the pull request" }) }, { text: "pr" });
  assert.equal(r2.prRequest, undefined);
  assert.match(lastTool(s2.seen), /GitHub did not open/);
  const s3 = script([say("", [call("pull_request", { title: "T", body: "" })]), say("ok")]);
  const r3 = await runCoder({ send: s3.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => ({ ok: true }), envApi: async () => { throw new Error("down"); } }, { text: "pr" });
  assert.deepEqual(r3.prRequest, { title: "T", body: "" });
});

function memBucket(init = {}) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return { m, get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, String(v)); } };
}

test("PN4 the server opens the pull request with the owner's token, draft as asked, saves it on the chat; an open one is reused; read-only and GitHub jobs refused", async () => {
  const key = "coder/u/c1/meta.json";
  const meta = { id: "c1", repo: "o/r", base: "main", branch: "coder/c1", turn: 3, repos: [{ repo: "o/x", base: "dev", readOnly: true }] };
  const bucket = memBucket({ [key]: meta });
  const sent = [];
  const fetchFn = async (url, init = {}) => {
    sent.push({ url: String(url), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    if (new URL(url).pathname === "/repos/o/r/pulls" && init.method === "POST") return Response.json({ number: 12, html_url: "https://github.com/o/r/pull/12" }, { status: 201 });
    if (new URL(url).pathname === "/repos/o/r/pulls/12") return Response.json({ state: "open", merged: false });
    return Response.json({ message: "no" }, { status: 404 });
  };
  const env = { CODER_PUBLIC_URL: "https://gofarther.dev" };
  const r = await prOpenNow(env, bucket, "u", "c1", meta, { title: "Add login", body: "Why.", draft: true }, { fetchFn, token: "tok" });
  assert.deepEqual(r, { number: 12, url: "https://github.com/o/r/pull/12", repo: "o/r", draft: true, existed: false });
  const made = sent.find((x) => x.method === "POST");
  assert.deepEqual([made.body.head, made.body.base, made.body.draft], ["coder/c1", "main", true]);
  assert.match(made.body.body, /Made with Coder/);
  const saved = JSON.parse(bucket.m.get(key));
  assert.deepEqual([saved.pr.number, saved.pushed], [12, true]);
  // Asked again: the open one is said to be updated, not opened twice.
  sent.length = 0;
  const again = await prOpenNow(env, bucket, "u", "c1", saved, { title: "Add login" }, { fetchFn, token: "tok" });
  assert.deepEqual([again.number, again.existed], [12, true]);
  assert.ok(!sent.some((x) => x.method === "POST"));
  assert.match((await prOpenNow(env, bucket, "u", "c1", meta, { title: "T", repo: "o/x" }, { fetchFn, token: "tok" })).error, /can read o\/x but not push/);
  assert.match((await prOpenNow(env, bucket, "u", "c1", { ...meta, jobFromGithub: true }, { title: "T" }, { fetchFn, token: "tok" })).error, /not in a job started from GitHub/);
  assert.match((await prOpenNow(env, bucket, "u", "c1", meta, { title: "T", repo: "z/z" }, { fetchFn, token: "tok" })).error, /not one of this chat's repositories/);
  assert.match((await prOpenNow(env, bucket, "u", "c1", meta, { title: "" }, { fetchFn, token: "tok" })).error, /needs a title/);
});

test("PN5 the machine's push now: what is on the disk is committed and pushed to the chat's branch on GitHub", async () => {
  const S = await import("../container/server.mjs");
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
  const gh = await mkdtemp(join(tmpdir(), "coder-gh-")), work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(gh, "ana"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "ana", "shop.git")]);
  const remote = gh + "/", root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const project = "shop-pn05", dir = join(root, project), branch = "coder/" + project;
  assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root })).ok, true);
  await writeFile(join(dir, "login.js"), "export const x = 1;\n");
  const p = await S.pushMidTurn({ body: { repo: "ana/shop", branch }, project, root, gitRoot, gitVia: false, remote, message: "Add login" });
  assert.equal(p.ok, true, p.why);
  assert.deepEqual([p.pushed, p.changed, p.unpushed], [true, true, 0]);
  assert.equal(git(join(gh, "ana", "shop.git"), "log", "-1", "--format=%s", branch).trim(), "Add login");
  // Nothing new since: nothing pushed again.
  const q = await S.pushMidTurn({ body: { repo: "ana/shop", branch }, project, root, gitRoot, gitVia: false, remote });
  assert.deepEqual([q.ok, q.pushed, q.changed], [true, false, false]);
});

test("PN6 the turn's end after a push made mid-turn: its commit kept for Undo (not local), the chat says Pushed and the draft pull request once, nothing pushed or opened again", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const UID = "user-1234567890abcdef", id = "shop-pn6";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const result = { status: "done", summary: "Added login.", messages: [], dirty: false, midPushes: [{ sha: "abcdef1", changed: true, pushed: true, edited: ["login.js"], files: ["login.js"] }], midNotes: ["Draft pull request #12 opened: https://github.com/ana/shop/pull/12"] };
  const calls = [], gh = [];
  const deps = { fetchFn: async (u, init = {}) => { gh.push([String(u), init.method || "GET"]); return new Response("{}", { status: 404 }); }, authUser: async () => ({ id: UID, email: "me@x.y" }), container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; calls.push(p); return p === "/state" ? Response.json({ running: false, result, events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: [{ type: "user", text: "push" }, { type: "done", text: "Done." }], result }) : Response.json({ ok: true }); } }) };
  // (The server saved the pull request on the chat when it opened it, mid-turn.)
  bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), unpushed: 2, unpushedSince: 5, commits: [{ sha: "0ld0ld0", turn: 0, title: "Old", local: true }], pr: { number: 12, url: "https://github.com/ana/shop/pull/12" } }));
  await R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/state?since=2"), env, {}, deps);
  assert.ok(!calls.includes("/push"), "nothing pushed again at the turn's end");
  assert.ok(!gh.some(([, mth]) => mth === "POST"), "no pull request opened again");
  const meta = JSON.parse(m.get("coder/" + UID + "/" + id + "/meta.json"));
  assert.deepEqual(meta.commits.map((c) => [c.sha, c.local, c.turn]), [["0ld0ld0", undefined, 0], ["abcdef1", undefined, 1]]);
  assert.deepEqual([meta.unpushed, meta.pushed, meta.pr.number], [0, true, 12]);
  const texts = JSON.parse(m.get("coder/" + UID + "/" + id + "/events.json")).filter((e) => e.type === "github").map((e) => e.text);
  assert.deepEqual(texts, ["Pushed to the branch coder/" + id, "Draft pull request #12 opened: https://github.com/ana/shop/pull/12"]);
});

test("PN9 a pull request just opened: its result asks Coder to end by asking the owner whether to watch it (Claude Code: \"After creating a PR, ask the user if they'd like you to watch it\"); not for one updated, nor from GitHub", async () => {
  const run = async (r, opts = {}) => {
    const s = script([say("", [call("pull_request", { title: "T", body: "" })]), say("done")]);
    await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => ({ ok: true, pushed: true, changed: true, sha: "1234567abc" }), envApi: async (b) => (b.action === "pull_request" ? r : {}) }, { text: "pr", ...opts });
    return lastTool(s.seen);
  };
  assert.match(await run({ number: 7, url: "https://github.com/o/r/pull/7", draft: true }), /end your answer by asking the owner whether you should watch it for new comments, reviews and CI results \(auto_fix turns that on, only once they say yes\)/);
  assert.doesNotMatch(await run({ number: 7, url: "https://github.com/o/r/pull/7", existed: true }), /watch it/);
});

// A FAILED FIRST PUSH STILL KEEPS ITS COMMIT (the audit, 2026-11-20; Claude Code's checkpoints do not depend on a push).
test("PN-L1 the machine's push fails after committing: the answer still names the commit and its files", async () => {
  const S = await import("../container/server.mjs");
  const { rename } = await import("node:fs/promises");
  const git = (cwd, ...a) => execFileSync("git", a, { cwd }).toString();
  const gh = await mkdtemp(join(tmpdir(), "coder-gh-")), work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(gh, "ana"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "ana", "shop.git")]);
  const remote = gh + "/", root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const project = "shop-pnl1", dir = join(root, project), branch = "coder/" + project;
  assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root })).ok, true);
  await writeFile(join(dir, "login.js"), "export const x = 1;\n");
  await rename(join(gh, "ana", "shop.git"), join(gh, "ana", "gone.git"));
  const p = await S.pushRepo({ dir, repo: "ana/shop", branch, token: "", remote, gitRoot, root, message: "Add login", netWaits: [] });
  assert.equal(p.ok, false);
  assert.equal(p.changed, true);
  assert.match(String(p.sha), /^[0-9a-f]{40}$/);
  assert.ok(Array.isArray(p.files) && p.files.includes("login.js"), JSON.stringify(p.files));
});

test("PN-L2 push_branch fails after committing: the commit is still kept with the result, marked not pushed", async () => {
  const s = script([say("", [call("push_branch", {})]), say("ok")]);
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => ({ ok: false, changed: true, sha: "abcdef1234567", files: ["a.js"], why: "could not push: busy" }) }, { text: "push" });
  assert.equal(r.push, true, "tried again when the turn ends");
  assert.equal(r.midPushes.length, 1);
  assert.deepEqual([r.midPushes[0].sha, r.midPushes[0].pushed, r.midPushes[0].changed], ["abcdef1234567", false, true]);
});

test("PN-L3 the first push failed and the turn's retry worked with nothing new: the chat still has the job's commit, so Undo and Create PR work", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const UID = "user-1234567890abcdef", id = "shop-pnl3";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const result = { status: "done", summary: "Added login.", messages: [], push: true, edited: ["login.js"], midPushes: [{ sha: "abcdef1", changed: true, pushed: false, edited: ["login.js"], files: ["login.js"] }] };
  const calls = [];
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; calls.push(p); return p === "/state" ? Response.json({ running: false, result, events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: [{ type: "user", text: "push" }, { type: "done", text: "Done." }], result }) : p === "/push" ? Response.json({ ok: true, pushed: true, changed: false, sha: "abcdef1", unpushed: 0 }) : Response.json({ ok: true }); } }) };
  bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), commits: [] }));
  await R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/state?since=2"), env, {}, deps);
  assert.ok(calls.includes("/push"), "the turn's end pushes again");
  const meta = JSON.parse(m.get("coder/" + UID + "/" + id + "/meta.json"));
  assert.deepEqual(meta.commits.map((c) => [c.sha, c.turn]), [["abcdef1", 1]]);
  assert.equal(meta.commits[0].local, undefined, "the retry sent it");
  assert.equal(meta.unpushed, 0);
});

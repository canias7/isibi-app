// BIGGER CLAUDE CODE FIXES, PART 12 (the owner, 2026-11-20: "yes start the 63 in batches"):
//   M-b-24  /compact and /rewind sent while Coder works wait for the job's end (Claude Code: "If you send a command while
//           Claude is responding, Claude Code queues it and runs it after the current turn finishes").
//   I65     Rewind and Undo hold the chat while they work, so a message sent meanwhile is never lost (Claude Code's changelog:
//           "Fixed the prompt sent after a `/rewind` being lost, and the removed turns coming back").
//   M-a-16  A message Coder read part-way through a turn is in the Rewind list, marked "No code restore" (checkpointing docs).
//   M-d-20  Coder's commits name the chat's owner as co-author (Claude Code's cloud runner adds a Co-authored-by line).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { execFileSync } from "node:child_process";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const UID = "user-1234567890abcdef", ID = "shop-m12a";
/** A chat on Coder's Worker, with a stand-in machine (`box`) and stand-in summary. */
async function chat({ machine = async () => Response.json({ ok: true }), summarize = async () => "THE SUMMARY", fetchFn = async () => new Response("{}", { status: 404 }) } = {}) {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const calls = [];
  const deps = { fetchFn, authUser: async () => ({ id: UID, email: "me@x.y" }), summarize,
    container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; const body = req.method === "POST" ? await req.json() : null; calls.push({ p, body }); return machine(p, body); } }) };
  const go = (p, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + p, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const send = async (p, b) => { const r = await go("projects/" + ID + "/" + p, { method: "POST", body: JSON.stringify(b) }); return { status: r.status, data: await r.json() }; };
  const k = (f) => "coder/" + UID + "/" + ID + "/" + f;
  const read = (f) => JSON.parse(bucket.m.get(k(f)));
  const put = (f, v) => bucket.put(k(f), JSON.stringify(v));
  const meta = (x = {}) => put("meta.json", { id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 2, saved: 2, status: "idle", at: Date.now(), title: "x", ...x });
  return { R, bucket, env, go, send, read, put, meta, calls };
}
const twoTurns = () => ({
  msgs: [{ role: "user", content: "ask 1" }, { role: "assistant", content: "answer 1" }, { role: "user", content: "ask 2" }, { role: "assistant", content: "answer 2" }],
  evs: [{ type: "user", text: "ask 1" }, { type: "done", text: "answer 1" }, { type: "user", text: "ask 2" }, { type: "done", text: "answer 2" }],
  marks: [{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 2, msg: 2 }],
});

// ── M-b-24 ────────────────────────────────────────────────────────────────────
test("M12-1 a /compact sent while Coder works waits in line as a command (never handed to the running job) and runs alone, as its own /compact, when the job ends", async () => {
  const R = await import("../src/coder-routes.mjs");
  assert.deepEqual(R.nextQueued([{ qid: "a", text: "/compact", cmd: "compact" }, { qid: "b", text: "hi" }]).map((q) => q.qid), ["a"]);
  assert.deepEqual(R.nextQueued([{ qid: "b", text: "hi" }, { qid: "a", text: "/compact keep tests", cmd: "compact" }, { qid: "c", text: "x" }]).map((q) => q.qid), ["b"]);
  assert.equal(R.isCompactCmd("/compact"), true);
  assert.equal(R.isCompactCmd("/compact the totals"), true);
  assert.equal(R.isCompactCmd("/compacting"), false);
  let claimed = false;
  const turns = [];
  const c = await chat({ machine: async (p, b) => {
    if (p === "/state") return Response.json(claimed ? { running: false, events: [] } : { running: false, events: [{ type: "done", text: "ok" }], next: 1, result: { status: "done", summary: "ok", messages: [...twoTurns().msgs, { role: "user", content: "ask 3" }, { role: "assistant", content: "ok" }], readQueued: [] } });
    if (p === "/claim") { claimed = true; return Response.json({ ok: true }); }
    if (p === "/turn") { turns.push(b); claimed = false; return Response.json({ ok: true }); }
    return Response.json({ ok: true, pushed: false });
  } });
  const t = twoTurns();
  await c.meta({ status: "running", turn: 3, saved: 2, marks: t.marks });
  await c.put("messages.json", t.msgs);
  await c.put("events.json", t.evs);
  const a = await c.send("message", { text: "/compact keep the tests" });
  assert.equal(a.status, 200, JSON.stringify(a.data));
  assert.equal(a.data.queued, true);
  const b = await c.send("message", { text: "then fix the footer" });
  assert.equal(b.data.queued, true);
  assert.deepEqual(c.read("queue.json").map((q) => [q.text, q.cmd || ""]), [["/compact keep the tests", "compact"], ["then fix the footer", ""]]);
  assert.deepEqual(c.calls.filter((x) => x.p === "/queue").map((x) => x.body.text), ["then fix the footer"], "the /compact never goes to the running job");
  // The job ends: the /compact goes out alone, as the owner's own /compact.
  const st = await (await c.go("projects/" + ID + "/state?since=0")).json();
  assert.equal(st.reload, true);
  assert.equal(turns.length, 1);
  assert.deepEqual(turns[0].compact, { focus: "keep the tests" });
  assert.deepEqual(c.read("queue.json").map((q) => q.text), ["then fix the footer"], "the message waits for the next end");
});

test("M12-2 a queued /compact that cannot run (a chat too short) leaves the line with its reason, never waiting for ever", async () => {
  let done = false;
  const c = await chat({ machine: async (p) => {
    if (p === "/state") return Response.json(done ? { running: false, events: [] } : { running: false, events: [{ type: "done", text: "ok" }], next: 1, result: { status: "done", summary: "ok", messages: [{ role: "user", content: "only" }, { role: "assistant", content: "ok" }], readQueued: [] } });
    if (p === "/claim") { done = true; return Response.json({ ok: true }); }
    return Response.json({ ok: true, pushed: false });
  } });
  await c.meta({ status: "running", turn: 1, saved: 0, marks: [{ turn: 1, ev: 0, msg: 0 }] });
  await c.put("messages.json", []);
  await c.put("events.json", [{ type: "user", text: "only" }]);
  assert.equal((await c.send("message", { text: "/compact" })).data.queued, true);
  const st = await (await c.go("projects/" + ID + "/state?since=0")).json();
  const { TOO_SHORT_TO_COMPACT } = await import("../container/coder-compact.mjs");
  assert.deepEqual(c.read("queue.json"), []);
  assert.ok(st.events.some((e) => e.type === "note" && e.text === TOO_SHORT_TO_COMPACT));
  assert.ok(c.read("events.json").some((e) => e.type === "note" && e.text === TOO_SHORT_TO_COMPACT));
});

// ── I65 ───────────────────────────────────────────────────────────────────────
test("M12-3 while Rewind's summary is being made the chat is held: a message sent then is refused with its text kept, and the summary is written over the chat as it is then", async () => {
  let release, entered;
  const into = new Promise((ok) => { entered = ok; });
  const gate = new Promise((ok) => { release = ok; });
  const c = await chat({ summarize: async () => { entered(); await gate; return "THE SUMMARY"; } });
  const t = twoTurns();
  await c.meta({ marks: t.marks });
  await c.put("messages.json", t.msgs);
  await c.put("events.json", t.evs);
  const rw = c.send("rewind", { turn: 2, summarize: "from" });
  await into;
  assert.ok(c.R.rewindingOf(c.read("meta.json")), "the chat is marked while the summary is made");
  const m = await c.send("message", { text: "add a footer" });
  assert.equal(m.status, 409);
  assert.equal(m.data.error, c.R.REWINDING_SAID);
  assert.equal(c.calls.filter((x) => x.p === "/turn").length, 0, "no job started");
  // (Something else written to the chat meanwhile, the mode, is kept: the end is written over the chat as it is now.)
  await c.put("meta.json", { ...c.read("meta.json"), mode: "plan" });
  release();
  const r = await rw;
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const after = c.read("meta.json");
  assert.equal(after.mode, "plan");
  assert.equal(c.R.rewindingOf(after), null, "the hold is gone");
  // And now a message goes through to a start (refused for other reasons in this stand-in, never for the rewind).
  const m2 = await c.send("message", { text: "add a footer" });
  assert.notEqual(m2.data.error, c.R.REWINDING_SAID);
});

test("M12-4 a summary that comes back after a job took the turn writes nothing: the job's answer is never removed", async () => {
  let release, entered;
  const into = new Promise((ok) => { entered = ok; });
  const gate = new Promise((ok) => { release = ok; });
  const c = await chat({ summarize: async () => { entered(); await gate; return "LATE"; } });
  const t = twoTurns();
  await c.meta({ marks: t.marks });
  await c.put("messages.json", t.msgs);
  await c.put("events.json", t.evs);
  const rw = c.send("rewind", { turn: 2, summarize: "upto" });
  await into;
  // (A job saved meanwhile: a stale hold, or another Worker.)
  const saved = [...t.msgs, { role: "user", content: "ask 3" }, { role: "assistant", content: "answer 3" }];
  await c.put("messages.json", saved);
  await c.put("meta.json", { ...c.read("meta.json"), turn: 3, saved: 3 });
  release();
  const r = await rw;
  assert.equal(r.status, 409);
  assert.match(r.data.error, /moved on while rewinding/);
  assert.deepEqual(c.read("messages.json"), saved);
});

test("M12-5 Undo holds the chat while Coder's machine puts the files back; a message sent then is refused; the hold always ends, also when the machine fails", async () => {
  let release, entered, fail = false;
  const c = await chat({ machine: async (p) => {
    if (p === "/undo") { entered(); await new Promise((ok) => { release = ok; }); return Response.json(fail ? { ok: false, why: "boom" } : { ok: true, files: ["a.txt"] }); }
    return Response.json({ ok: true });
  } });
  const t = twoTurns();
  for (const f of [false, true]) {
    fail = f;
    const into = new Promise((ok) => { entered = ok; });
    await c.meta({ marks: t.marks, commits: [{ sha: "abc1234", turn: 2, title: "ask 2", edited: ["a.txt"] }] });
    await c.put("messages.json", t.msgs);
    await c.put("events.json", t.evs);
    const u = c.send("undo", {});
    await into;
    const m = await c.send("message", { text: "next" });
    assert.equal(m.status, 409);
    assert.equal(m.data.error, c.R.REWINDING_SAID);
    // (A second Undo or Rewind meanwhile is refused too.)
    assert.equal((await c.send("rewind", { turn: 2, chat: true })).status, 409);
    release();
    const r = await u;
    assert.equal(r.status, f ? 409 : 200);
    assert.equal(c.R.rewindingOf(c.read("meta.json")), null);
  }
  // A hold older than REWIND_HOLD_MS (a Worker that died half-way) counts for nothing.
  assert.equal(c.R.rewindingOf({ rewinding: { id: "r1", at: Date.now() - c.R.REWIND_HOLD_MS - 1 } }), null);
  assert.ok(c.R.rewindingOf({ rewinding: { id: "r1", at: Date.now() } }));
});

// ── M-a-16 ────────────────────────────────────────────────────────────────────
test("M12-6 a message Coder read part-way through a turn gets a chat-only mark when the job is saved; rewinding to it restores the chat only, and code is refused with Claude Code's guidance", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { queuedNote, QUEUED_HEAD } = await import("../container/coder-agent.mjs");
  assert.equal(R.QUEUED_NOTE_HEAD, QUEUED_HEAD);
  let claimed = false;
  const t = twoTurns();
  const jobMsgs = [...t.msgs.slice(0, 2), { role: "user", content: "ask 2" }, { role: "assistant", content: "", tool_calls: [] }, { role: "user", content: queuedNote("also add a test") }, { role: "assistant", content: "answer 2" }];
  const end = { running: false, events: [{ type: "user", text: "ask 2" }, { type: "user", text: "also add a test", queued: true, qid: "q1abcdef" }, { type: "done", text: "answer 2" }], next: 3, result: { status: "done", summary: "answer 2", messages: jobMsgs, readQueued: ["q1abcdef"] } };
  const c = await chat({ machine: async (p) => {
    if (p === "/state") return Response.json(claimed ? { running: false, events: [] } : end);
    if (p === "/claim") { claimed = true; return Response.json({ ok: true, ...end }); }
    return Response.json({ ok: true, pushed: false });
  } });
  await c.meta({ status: "running", turn: 2, saved: 1, marks: t.marks.slice(0, 1).concat([{ turn: 2, ev: 2, msg: 2 }]), commits: [{ sha: "abc1234", turn: 2, title: "ask 2", edited: ["a.txt"] }] });
  await c.put("messages.json", t.msgs.slice(0, 2));
  await c.put("events.json", t.evs.slice(0, 2));
  await (await c.go("projects/" + ID + "/state?since=0")).json();
  const marks = c.read("meta.json").marks;
  assert.deepEqual(marks.find((m) => m.qid), { turn: 2, qid: "q1abcdef", ev: 3, msg: 4, noCode: true });
  assert.equal(c.read("events.json")[3].text, "also add a test");
  // Saved again: no second mark.
  assert.equal(R.queuedMarks(c.read("events.json"), c.read("messages.json"), c.read("meta.json")).length, 0);
  // Code: refused, as Claude Code guides (pick the message that started the turn).
  const code = await c.send("rewind", { turn: 2, qid: "q1abcdef", code: true, chat: true });
  assert.equal(code.status, 400);
  assert.equal(code.data.error, R.NO_CODE_RESTORE);
  assert.equal(c.calls.filter((x) => x.p === "/restore" || x.p === "/undo").length, 0);
  // The chat: back to before that message; the turn's own mark stays, the code is untouched.
  const r = await c.send("rewind", { turn: 2, qid: "q1abcdef", chat: true });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(c.read("events.json").slice(0, 3).map((e) => e.text), ["ask 1", "answer 1", "ask 2"]);
  assert.equal(c.read("messages.json").length, 4);
  assert.deepEqual(c.read("meta.json").marks.map((m) => m.turn + (m.qid ? "q" : "")), ["1", "2"]);
  assert.equal(c.read("meta.json").commits.length, 1);
});

// ── M-d-20 ────────────────────────────────────────────────────────────────────
test("M12-7 the chat's owner is named as co-author on Coder's commits (GitHub's private address), unless the repository's attribution turns it off; the author stays Coder's", async () => {
  const R = await import("../src/coder-routes.mjs");
  const S = await import("../container/server.mjs");
  assert.equal(R.coAuthorOf({ id: 583231, login: "ana", name: "Ana Diaz" }), "Ana Diaz <583231+ana@users.noreply.github.com>");
  assert.equal(R.coAuthorOf({ id: 583231, login: "ana" }), "ana <583231+ana@users.noreply.github.com>");
  assert.equal(R.coAuthorOf({ id: 583231, login: "ana", name: "Evil <x@y>\nCo-authored-by: z" }), "Evil x@y Co-authored-by: z <583231+ana@users.noreply.github.com>");
  assert.equal(R.coAuthorOf({ login: "ana" }), "");
  assert.equal(S.coAuthorTrailer("Ana <583231+ana@users.noreply.github.com>"), "Co-authored-by: Ana <583231+ana@users.noreply.github.com>");
  assert.equal(S.coAuthorTrailer("Ana <ana@evil.com>"), "", "only GitHub's private address");
  const link = "https://gofarther.dev/?chat=shop-m12a";
  assert.deepEqual(S.commitMarks(link, null, "Ana <1+ana@users.noreply.github.com>").trailer, ["Coder-Chat: " + link, "Co-authored-by: Ana <1+ana@users.noreply.github.com>"]);
  assert.equal(S.commitMarks(link, { off: false, coAuthor: false }, "Ana <1+ana@users.noreply.github.com>").trailer, "");
  assert.equal(S.commitMarks(link, { off: true }, "Ana <1+ana@users.noreply.github.com>").trailer, "");
  assert.equal(S.commitMarks(link, null).trailer, "Coder-Chat: " + link, "unchanged with no co-author");
  // For real: one commit carries both lines; the author is Coder's.
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
  const remote = await mkdtemp(join(tmpdir(), "coder-gh-")), work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  execFileSync("mkdir", ["-p", join(remote, "ana")]);
  execFileSync("git", ["clone", "-q", "--bare", work, join(remote, "ana/shop.git")]);
  const gitRoot = await mkdtemp(join(tmpdir(), "coder-git-")), root = await mkdtemp(join(tmpdir(), "coder-w-"));
  const dir = join(root, "shop-m12a");
  try {
    assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch: "coder/shop-m12a", token: "", remote: remote + "/", gitRoot, root })).ok, true);
    await writeFile(join(dir, "index.html"), "<h1>Shop</h1>\n");
    const p = await S.pushRepo({ dir, repo: "ana/shop", branch: "coder/shop-m12a", token: "", message: "Added the home page", ...S.commitMarks(link, null, "Ana Diaz <583231+ana@users.noreply.github.com>"), remote: remote + "/", gitRoot, root });
    assert.equal(p.ok, true, p.why);
    const bare = join(remote, "ana/shop.git");
    assert.equal(git(bare, "log", "-1", "--format=%B", "coder/shop-m12a").trim(), "Added the home page\n\nCoder-Chat: " + link + "\nCo-authored-by: Ana Diaz <583231+ana@users.noreply.github.com>");
    assert.doesNotMatch(git(bare, "log", "-1", "--format=%an", "coder/shop-m12a"), /Ana/);
  } finally { for (const x of [remote, work, gitRoot, root]) await rm(x, { recursive: true, force: true }); }
});

test("M12-8 Coder's Worker sends the owner as co-author with each commit it asks for (from the GitHub account kept at sign-in, or asked of GitHub once)", async () => {
  let asked = 0;
  const c = await chat({ fetchFn: async (u) => { if (String(u).endsWith("/user")) { asked++; return Response.json({ id: 583231, login: "ana", name: "Ana Diaz" }); } return new Response("{}", { status: 404 }); }, machine: async () => Response.json({ ok: true, files: ["a.txt"] }) });
  const t = twoTurns();
  for (let i = 0; i < 2; i++) {
    await c.meta({ marks: t.marks, commits: [{ sha: "abc1234", turn: 2, title: "ask 2", edited: ["a.txt"] }] });
    await c.put("messages.json", t.msgs);
    await c.put("events.json", t.evs);
    assert.equal((await c.send("undo", {})).status, 200);
  }
  const undos = c.calls.filter((x) => x.p === "/undo");
  assert.equal(undos.length, 2);
  for (const u of undos) assert.equal(u.body.coAuthor, "Ana Diaz <583231+ana@users.noreply.github.com>");
  assert.equal(asked, 1, "kept after the first ask");
  // The sign-in keeps it; the push route, the end of a job's save, Undo and Rewind all send it.
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /coder\/" \+ uid \+ "\/github-who\.json", \{ id: Number\(me\.data\.id\), login/);
  assert.equal((routes.match(/\.\.\.\(await commitWho\(env, bucket, uid, meta, id/g) || []).length, 4);
  assert.equal((routes.match(/chatUrl: chatLink, coAuthor: await coAuthorFor\(env, bucket, uid, fetchFn\)/g) || []).length, 2);
});

// ── THE PAGE ──────────────────────────────────────────────────────────────────
const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
async function openPage(browser, st) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const project = () => ({ id: "c1", title: "Shop", repo: "ana/shop", base: "main", branch: "coder/c1", status: st.running ? "running" : "idle", mode: "default", turn: 2, at, marks: st.marks, commits: st.commits || [] });
  const api = async (method, p, body) => {
    if (method === "POST" && p === "/api/coder/projects/c1/rewind") { st.rewinds.push(JSON.parse(body || "{}")); await new Promise((r) => setTimeout(r, st.slow || 0)); return { ok: true, project: { ...project(), marks: st.marks.slice(0, 1) }, events: st.events.slice(0, 2) }; }
    if (method === "POST" && p === "/api/coder/projects/c1/message") { st.posts.push(JSON.parse(body || "{}")); return { error: "no" }; }
    if (p === "/api/coder/projects/c1/state") return { running: st.running, events: [], next: st.events.length, project: project(), queue: [] };
    return { "GET /api/coder/github": { connected: true, login: "ana" }, "GET /api/coder/projects": { projects: [project()] }, "GET /api/coder/projects/c1": { project: project(), events: st.events, queue: [] }, "GET /api/coder/settings": { prefs: {} } }[method + " " + p] || {};
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(await api(route.request().method(), u.pathname, route.request().postData())) });
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, errors };
}
const pageState = (x = {}) => ({ running: false, rewinds: [], posts: [], events: [{ type: "user", text: "ask 1", at: 1 }, { type: "done", text: "answer 1", at: 2 }, { type: "user", text: "ask 2", at: 3 }, { type: "done", text: "answer 2", at: 4 }], marks: [{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 2, msg: 2 }], ...x });

test("M12-9 page: /rewind while Coder works shows 'Rewind opens when Coder finishes' and opens the Rewind list once the job ends", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const st = pageState({ running: true });
    const { page, errors } = await openPage(browser, st);
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.fill("#cdIn", "/rewind");
    await page.press("#cdIn", "Enter");
    await page.waitForFunction(() => /Rewind opens when Coder finishes/.test((document.querySelector(".cd-rewind-line") || {}).textContent || ""), null, { timeout: 5000 });
    assert.equal(await page.locator(".cd-sure-title").count(), 0, "not open while Coder works");
    assert.equal(st.posts.length, 0, "nothing sent to Coder");
    st.running = false;
    await page.waitForFunction(() => [...document.querySelectorAll(".cd-sure-title")].some((x) => x.textContent === "Rewind"), null, { timeout: 15000 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("M12-10 page: while Rewind works the send button is held and 'Rewinding…' shows; the chosen message comes back to the box after", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const st = pageState({ slow: 2500 });
    const { page, errors } = await openPage(browser, st);
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.fill("#cdIn", "/rewind");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector(".cd-pick-col button", { timeout: 5000 });
    await page.locator(".cd-pick-col button", { hasText: "ask 2" }).click();
    await page.locator(".cd-pick-col button", { hasText: "Restore chat" }).click();
    await page.waitForFunction(() => /Rewinding…/.test((document.querySelector(".cd-rewind-line") || {}).textContent || ""), null, { timeout: 5000 });
    assert.equal(await page.locator("button.cd-send[type=submit]").isDisabled(), true);
    await page.fill("#cdIn", "a new message");
    await page.press("#cdIn", "Enter");
    await page.waitForTimeout(300);
    assert.equal(st.posts.length, 0, "held, not sent");
    assert.equal(await page.inputValue("#cdIn"), "a new message", "kept in the box");
    await page.waitForFunction(() => !document.querySelector(".cd-rewind-line"), null, { timeout: 10000 });
    assert.deepEqual(st.rewinds, [{ turn: 2, code: false, chat: true }]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("M12-11 page: a message read part-way through a turn is in the Rewind list as 'No code restore', and offers the chat and summaries only", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const st = pageState({ commits: [{ sha: "abc", turn: 2, title: "ask 2", edited: ["a.txt"] }] });
    st.events.splice(3, 0, { type: "user", text: "also add a test", queued: true, qid: "q1abcdef", at: 3.5 });
    st.marks = [...st.marks, { turn: 2, qid: "q1abcdef", ev: 3, msg: 4, noCode: true }];
    const { page, errors } = await openPage(browser, st);
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.fill("#cdIn", "/rewind");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector(".cd-pick-col button", { timeout: 5000 });
    const item = page.locator(".cd-pick-col button", { hasText: "also add a test" });
    assert.match(await item.textContent(), /No code restore/);
    assert.match(await page.locator(".cd-pick-col button", { hasText: "ask 2" }).textContent(), /1 file changed/);
    await item.click();
    await page.waitForSelector(".cd-pick-col button", { timeout: 5000 });
    const labels = await page.locator(".cd-pick-col button").allTextContents();
    assert.deepEqual(labels, ["Restore chat", "Summarize from here", "Summarize up to here", "Never mind"]);
    assert.match(await page.locator(".cd-sure-text").textContent(), /No code restore/);
    await page.locator(".cd-pick-col button", { hasText: "Restore chat" }).click();
    await page.waitForFunction(() => !document.querySelector(".cd-sure"), null, { timeout: 5000 });
    for (let k = 0; k < 30 && !st.rewinds.length; k++) await page.waitForTimeout(100);
    assert.deepEqual(st.rewinds, [{ turn: 2, code: false, chat: true, qid: "q1abcdef" }]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

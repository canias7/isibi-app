// A FASTER END OF TURN (live test, 2026-11-16: the answer at 6.3 s, "saved" at 10.7 s, the message box free only at ~14 s).
// SV1: the page's early look says `ending` once the machine's answer is all sent, and the save then starts in the background;
// SV2: the page polls again soon while the answer comes in; SV3: a cheaper save (the claim brings the job, nothing to commit
// skips the commit step, reads and writes together, the memory only when changed); SV4: after "saved", nothing waits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fakeBucket() {
  const m = new Map(), puts = [];
  return { m, puts, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { puts.push(k); m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const ENV = (bucket) => ({ CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket });
const UID = "user-1234567890abcdef";
const R = await import("../src/coder-routes.mjs");
const { saveConnection } = await import("../src/coder-github.mjs");

async function world(machine) {
  const bucket = fakeBucket(); const env = ENV(bucket);
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const calls = [], waits = [];
  const ctx = { waitUntil: (p) => { waits.push(p); } };
  const box = () => ({ fetch: async (req) => {
    const u = new URL(req.url);
    const body = req.method === "POST" ? await req.json() : null;
    calls.push({ path: u.pathname, body, search: u.search });
    return machine(u.pathname, body, u);
  } });
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box };
  const go = (id, path, init, c = ctx) => R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + path, init), env, c, deps);
  const put = (id, meta) => bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, ...meta }));
  const read = (id, f) => JSON.parse(bucket.m.get("coder/" + UID + "/" + id + "/" + f) || "null");
  const settle = async () => { while (waits.length) await waits.shift(); };
  return { bucket, env, calls, waits, go, put, read, settle };
}
const ANSWER = [{ type: "user", text: "hi" }, { type: "done", text: "Hi." }];
const done = (more = {}) => ({ status: "done", summary: "Hi.", messages: [], ...more });

test("SV1 the answer shown at once even when its steps came on an earlier look: `answered` (the machine tidying up) or the end says `ending`; with the end there, the save starts in the background at once, once; the page's next look gets the save's lines, or follows the queued message it started", async () => {
  // THE LIVE CASE: the answer already sent (since=2, nothing new), the machine still tidying up (answered, no result yet).
  const w = await world((p) => (p === "/state" ? Response.json({ running: true, answered: true, events: [], next: 2 }) : Response.json({ ok: true })));
  await w.put("shop-s1", { turn: 1, saved: 0, status: "running", at: Date.now() });
  const r = await (await w.go("shop-s1", "/state?since=2&early=1")).json();
  assert.deepEqual([r.running, r.ending, r.events], [true, true, []]);
  assert.ok(!w.calls.some((c) => c.path === "/claim"), "no end to save yet");

  // THE END THERE, nothing new to show: `ending`, and the save runs in the background (overlapping the page's wait).
  let pushes = 0, claims = 0;
  const w2 = await world((p) => {
    if (p === "/state") return Response.json({ running: false, result: done(), events: [], next: 2 });
    if (p === "/claim") { claims++; return Response.json(claims === 1 ? { ok: true, events: ANSWER, result: done() } : { ok: false }); }
    if (p === "/push") { pushes++; return Response.json({ ok: true, pushed: true, changed: true, sha: "abc1234", unpushed: 0 }); }
    return Response.json({ ok: true });
  });
  await w2.put("shop-s2", { turn: 1, saved: 0, status: "running", at: Date.now() });
  const e = await (await w2.go("shop-s2", "/state?since=2&early=1")).json();
  assert.deepEqual([e.running, e.ending], [true, true]);
  assert.equal(w2.waits.length, 1, "the save started in the background");
  // A look while it runs (no early: the answer is shown): still "running", nothing saved twice.
  const mid = await (await w2.go("shop-s2", "/state?since=2&turn=1")).json();
  await w2.settle();
  assert.equal(mid.running, true);
  assert.equal(claims, 2);
  assert.equal(pushes, 1, "saved once");
  const meta = w2.read("shop-s2", "meta.json");
  assert.deepEqual([meta.status, meta.saved], ["idle", 1]);
  assert.equal(meta.endNote.turn, 1);
  // The page's next look: "done", with the save's own line, no reload.
  const fin = await (await w2.go("shop-s2", "/state?since=2&turn=1")).json();
  assert.equal(fin.running, false);
  assert.ok(!fin.reload);
  assert.ok(fin.events.some((x) => x.type === "github" && /^Pushed to the branch coder\/shop-s2/.test(x.text)), JSON.stringify(fin.events));
  assert.deepEqual(w2.read("shop-s2", "events.json").map((x) => x.type), ["user", "done", "github"], "saved with the chat");

  // A NEWER TURN (the queued message the background save started): the page loads the chat to follow it.
  await w2.put("shop-s3", { turn: 2, saved: 1, status: "running", at: Date.now() });
  const nx = await (await w2.go("shop-s3", "/state?since=2&turn=1")).json();
  assert.equal(nx.reload, true);

  // NO waitUntil (the every-minute run, tests of old): the early look only says `ending`, the next look saves, as before.
  const w3 = await world((p) => (p === "/state" ? Response.json({ running: false, result: done(), events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: ANSWER, result: done() }) : Response.json({ ok: true, pushed: false, changed: false })));
  await w3.put("shop-s4", { turn: 1, saved: 0, status: "running", at: Date.now() });
  assert.equal((await (await w3.go("shop-s4", "/state?since=2&early=1", undefined, {})).json()).ending, true);
  assert.ok(!w3.calls.some((c) => c.path === "/claim"));
  assert.equal((await (await w3.go("shop-s4", "/state?since=2", undefined, {})).json()).running, false);
  assert.equal(w3.read("shop-s4", "meta.json").endNote, null, "saved in the reply: nothing kept for later");
});

test("SV1b the machine: says `answered` once the answer's last steps are sent, refuses a queued message from then on (the Worker's line takes it), and its /claim hands over the job's steps and end", () => {
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("await lastSend(); t.answerDone = true; const messages"));
  assert.ok(src.includes("async (e) => { await lastSend(); t.answerDone = true; return"));
  assert.ok(src.includes("...(t.answerDone ? { answered: true } : {}), events: t.events.slice(since)"));
  assert.ok(src.includes("if (!t || !t.running || t.result || t.answerDone) return send(200, { ok: false, notRunning: true });"));
  assert.ok(src.includes("return send(200, { ok: true, events: t.events, result: t.result });"));
  // /push still waits for the machine to be quiet.
  const push = src.slice(src.indexOf('if (url.pathname === "/push" && req.method === "POST")'));
  assert.ok(push.slice(0, 300).includes("const go = await quietly();"));
});

test("SV2 the page: asks `early` only until the answer is shown, then with its turn; looks again after 300 ms while Coder's text comes in or the turn is being saved", () => {
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.ok(page.includes("(S.ending ? '&turn=' + (Number(S.project.turn) || 0) : '&early=1')"));
  assert.ok(page.includes("const QUICK_POLL_MS = 300;"));
  assert.ok(page.includes("S.poll = setTimeout(tick, quickLook(r) ? QUICK_POLL_MS : POLL_MS);"));
  const body = page.slice(page.indexOf("function quickLook(r) {"), page.indexOf("function stopPoll()"));
  const quickLook = new Function("S", body + "; return quickLook;");
  const q = (S, d) => quickLook(S)({ status: 200, data: d });
  assert.equal(q({}, { events: [{ type: "bash" }] }), false);
  assert.equal(q({}, { events: [{ type: "text", text: "Hi" }] }), true);
  assert.equal(q({}, { events: [], ending: true }), true);
  assert.equal(q({ ending: true }, { events: [] }), true);
  assert.equal(quickLook({})({ status: 500 }), false);
});

test("SV3 a cheaper save: the claim's steps are used (no second look); a turn that changed nothing and asked nothing of GitHub skips the commit step and the token; reads and writes go together; the memory is written only when it changed", async () => {
  const reads = [];
  const w = await world((p, b, u) => {
    if (p === "/state") { reads.push(u.search); return Response.json({ running: false, result: done({ dirty: false, memory: "same" }), events: [], next: 2 }); }
    if (p === "/claim") return Response.json({ ok: true, events: ANSWER, result: done({ dirty: false, memory: "same" }) });
    return Response.json({ ok: true, pushed: false, changed: false });
  });
  await w.bucket.put("coder/" + UID + "/memory/ana__shop.md", "same");
  await w.put("shop-c1", { turn: 1, saved: 0, status: "running", at: Date.now(), unpushed: 2, unpushedSince: 5 });
  w.bucket.puts.length = 0;
  const r = await (await w.go("shop-c1", "/state?since=2", undefined, {})).json();
  assert.equal(r.running, false);
  assert.deepEqual(w.calls.map((c) => c.path), ["/state", "/claim"], "no second /state, no /push");
  assert.deepEqual(w.read("shop-c1", "events.json").map((x) => x.type), ["user", "done"]);
  assert.ok(!w.bucket.puts.some((k) => k.includes("/memory/")), "the memory, unchanged, is not written again");
  const meta = w.read("shop-c1", "meta.json");
  assert.deepEqual([meta.unpushed, meta.saved], [2, 1], "the unpushed count kept");

  // Changed files (no `dirty: false`), a new memory: the commit step and the memory, as before.
  const w2 = await world((p) => (p === "/state" ? Response.json({ running: false, result: done({ memory: "new" }), events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: ANSWER, result: done({ memory: "new" }) }) : Response.json({ ok: true, pushed: false, local: true, changed: true, sha: "abc1234", unpushed: 1 })));
  await w2.put("shop-c2", { turn: 1, saved: 0, status: "running", at: Date.now() });
  await w2.go("shop-c2", "/state?since=2", undefined, {});
  assert.deepEqual(w2.calls.map((c) => c.path), ["/state", "/claim", "/push"]);
  assert.equal(w2.calls[2].body.commitOnly, true);
  assert.equal(w2.bucket.m.get("coder/" + UID + "/memory/ana__shop.md"), "new");
  const m2 = w2.read("shop-c2", "meta.json");
  assert.deepEqual([m2.unpushed, m2.commits.length, m2.commits[0].local], [1, 1, true], "Undo's commit kept");

  // Nothing changed but a pull request asked for: the commit step and GitHub still run.
  const w3 = await world((p) => (p === "/state" ? Response.json({ running: false, result: done({ dirty: false, prRequest: { title: "x" } }), events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: ANSWER, result: done({ dirty: false, prRequest: { title: "x" } }) }) : Response.json({ ok: true, pushed: false, changed: false })));
  await w3.put("shop-c3", { turn: 1, saved: 0, status: "running", at: Date.now() });
  await w3.go("shop-c3", "/state?since=2", undefined, {});
  assert.ok(w3.calls.some((c) => c.path === "/push"));

  // A machine from before (its claim says only ok): looked at again, as before.
  const w4 = await world((p) => (p === "/state" ? Response.json({ running: false, result: done(), events: ANSWER, next: 2 }) : p === "/claim" ? Response.json({ ok: true }) : Response.json({ ok: true, pushed: false, changed: false })));
  await w4.put("shop-c4", { turn: 1, saved: 0, status: "running", at: Date.now() });
  await w4.go("shop-c4", "/state?since=2", undefined, {});
  assert.deepEqual(w4.calls.map((c) => c.path).slice(0, 3), ["/state", "/claim", "/state"]);
  assert.deepEqual(w4.read("shop-c4", "events.json").map((x) => x.type), ["user", "done"]);

  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("const [old, t, chatLink, hidden, envNow, oldMemory] = await Promise.all(["));
});

test("SV3b the machine says `dirty: false` only for a work tree git reads cleanly (installed packages and caches ignored); a change, a new file or no repository at all is dirty", async () => {
  const { treeDirty, gitDirFor } = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const dir = join(root, "shop-d1");
  const g = (...a) => execFileSync("git", ["--git-dir=" + gitDirFor(dir, gitRoot), "--work-tree=" + dir, "-c", "user.name=a", "-c", "user.email=a@b", "-c", "safe.directory=*", ...a]).toString();
  assert.equal(await treeDirty([dir], gitRoot, root), true, "no repository: dirty");
  execFileSync("mkdir", ["-p", dir]);
  execFileSync("git", ["init", "-q", "-b", "main", "--bare", gitDirFor(dir, gitRoot)]);
  g("config", "core.bare", "false");
  await writeFile(join(dir, "README.md"), "# shop\n");
  g("add", "-A"); g("commit", "-q", "-m", "first");
  assert.equal(await treeDirty([dir], gitRoot, root), false, "clean");
  execFileSync("mkdir", ["-p", join(dir, "node_modules")]);
  await writeFile(join(dir, "node_modules", "x.js"), "x\n");
  assert.equal(await treeDirty([dir], gitRoot, root), false, "installed packages are never committed");
  await writeFile(join(dir, "README.md"), "# shop!\n");
  assert.equal(await treeDirty([dir], gitRoot, root), true, "a change");
  g("checkout", "--", "README.md");
  await writeFile(join(dir, "new.txt"), "n\n");
  assert.equal(await treeDirty([dir], gitRoot, root), true, "a new file");
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("if (!gloopy) dirty = await treeDirty([dir, ...extras.map((x) => x.dir)], gitRoot, root).catch(() => true);"));
  assert.ok(src.includes("...(dirty === false ? { dirty: false } : {}),"));
});

test("SV4 after \"saved\": the watch list, the live sendings and the pictures are tidied in the background; the line of waiting messages is written only when one left it", async () => {
  const w = await world((p) => (p === "/state" ? Response.json({ running: false, result: done({ dirty: false }), events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: ANSWER, result: done({ dirty: false }) }) : Response.json({ ok: true })));
  await w.put("shop-t1", { turn: 1, saved: 0, status: "running", at: Date.now() });
  await w.bucket.put("coder/" + UID + "/shop-t1/queue.json", "[]");
  w.bucket.puts.length = 0;
  const r = await (await w.go("shop-t1", "/state?since=2")).json();
  assert.equal(r.running, false);
  assert.equal(w.waits.length, 1, "the tidying waits in the background");
  await w.settle();
  assert.ok(!w.bucket.puts.some((k) => k.endsWith("/queue.json")), "the line, unchanged, is not written");
  // One Coder read in its turn leaves the line: written.
  const w2 = await world((p) => (p === "/state" ? Response.json({ running: false, result: done({ dirty: false, readQueued: ["qaaaaaaa1"] }), events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: ANSWER, result: done({ dirty: false, readQueued: ["qaaaaaaa1"] }) }) : Response.json({ ok: true })));
  await w2.put("shop-t2", { turn: 1, saved: 0, status: "running", at: Date.now() });
  await w2.bucket.put("coder/" + UID + "/shop-t2/queue.json", JSON.stringify([{ qid: "qaaaaaaa1", text: "x" }]));
  await w2.go("shop-t2", "/state?since=2", undefined, {});
  assert.deepEqual(w2.read("shop-t2", "queue.json"), []);
});

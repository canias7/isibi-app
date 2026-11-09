// MESSAGES SENT WHILE CODER WORKS (the owner, 2026-11-09: "yeah fix that separately"), as Claude Code's queue: "Type a message
// and press Enter while Claude is working. Claude Code queues the message instead of interrupting the turn, and lists the
// queued entries in the conversation until it sends them"; "if you queue a message while Claude is running tool calls, Claude
// Code passes it to Claude as soon as those tool calls finish, within the same turn. When the turn ends with messages still
// queued, they go out without another key press, in the order you typed them"; queued commands "run one at a time" after the
// turn; on the web, "To take a queued message back, click the ✕ on it … If Claude has already read the message, it stays".
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("CD287 the agent reads a message the owner sent while it worked as soon as its running tool calls finish, in this turn, in Claude Code's words; the chat shows it as the owner's from there", async () => {
  const { runCoder, queuedNote } = await import("../container/coder-agent.mjs");
  assert.equal(queuedNote("use port 3001 instead"), "The owner sent a new message while you were working:\nuse port 3001 instead\n\nThis is how Coder's app surfaces messages the owner sends mid-turn — within the running turn, often alongside the next tool result, rather than as a separate conversation turn. Address the message above as you continue this turn.");
  const events = [], seen = [];
  let n = 0, waiting = [];
  const steps = [say("", [call("bash", { command: "npm run build" }, "b1")]), say("", [call("bash", { command: "echo 3001" }, "b2")]), say("Done, on port 3001.")];
  const r = await runCoder({
    send: async (req) => { seen.push(req); if (n === 0) waiting.push({ qid: "q1abcdef", text: "use port 3001 instead" }); return steps[Math.min(n++, 2)]; },
    exec: async () => ({ code: 0, output: "ok\n" }),
    emit: (e) => events.push(e),
    queued: () => { const out = waiting; waiting = []; return out; },
  }, { text: "build it" });
  // Read after the first round's tool calls, before the second model call.
  const second = seen[1].messages;
  assert.equal(second.at(-1).role, "user");
  assert.equal(second.at(-1).content, queuedNote("use port 3001 instead"));
  assert.ok(second.findIndex((m) => m.tool_call_id === "b1") < second.length - 1, "after the tool result");
  const users = events.filter((e) => e.type === "user");
  assert.deepEqual(users.map((e) => [e.text, !!e.queued, e.qid || ""]), [["build it", false, ""], ["use port 3001 instead", true, "q1abcdef"]]);
  assert.match(seen[0].messages[0].content, /A message the owner sent while you were working comes in the middle of your turn/);
  assert.equal(r.status, "done");
});

test("CD288 Coder's machine takes a message for its running job, hands it to Coder once, can give one back that Coder has not read yet, and says which it read when the job ends", async () => {
  const { createApp } = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  const seen = [];
  let n = 0, gate = null;
  const steps = [say("", [call("bash", { command: "echo first" }, "s1")]), say("", [call("bash", { command: "echo second" }, "s2")]), say("Done.")];
  const srv = http.createServer(createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { seen.push(req); if (n === 0) await new Promise((ok) => { gate = ok; }); return steps[Math.min(n++, 2)]; } }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  try {
    assert.deepEqual(await post("/queue", { project: "shop-q1", qid: "q1abcdef", text: "hi" }), { ok: false, notRunning: true }, "no job: the Worker keeps it for the next");
    await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "shop-q1", text: "go", messages: [] }) });
    for (let i = 0; i < 100 && !gate; i++) await new Promise((ok) => setTimeout(ok, 20));
    assert.deepEqual(await post("/queue", { project: "shop-q1", qid: "q1abcdef", text: "also add a test" }), { ok: true });
    assert.deepEqual(await post("/queue", { project: "shop-q1", qid: "q2abcdef", text: "never mind this one" }), { ok: true });
    assert.equal((await post("/queue", { project: "shop-q1", qid: "bad", text: "x" })).ok, false);
    assert.deepEqual(await post("/unqueue", { project: "shop-q1", qid: "q2abcdef" }), { ok: true, removed: true }, "taken back before Coder read it");
    gate();
    let st; for (let i = 0; i < 100; i++) { st = await (await fetch(base + "/state?project=shop-q1&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.ok(seen[1].messages.some((m) => m.role === "user" && m.content.startsWith("The owner sent a new message while you were working:\nalso add a test\n")));
    assert.ok(!JSON.stringify(seen.map((x) => x.messages)).includes("never mind this one"), "the one taken back never reached Coder");
    assert.deepEqual(st.result.readQueued, ["q1abcdef"]);
    assert.ok(st.events.some((e) => e.type === "user" && e.queued && e.qid === "q1abcdef" && e.text === "also add a test"));
    assert.deepEqual(await post("/unqueue", { project: "shop-q1", qid: "q1abcdef" }), { ok: true, removed: false, read: true }, "read: it stays in the conversation");
  } finally { await new Promise((ok) => srv.close(ok)); }
});

test("CD289 Coder's Worker: a message sent while Coder works waits with the chat (a message goes to the running job at once, a ! command waits for its end); ✕ takes one back unless Coder read it; what is left when the job ends goes out next by itself, a command alone and in order; pictures or line comments wait for the end; the page shows them in grey with ✕", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  assert.deepEqual(R.nextQueued([{ qid: "a", text: "x" }, { qid: "b", text: "y" }, { qid: "c", text: "!ls", shell: true }, { qid: "d", text: "z" }]).map((q) => q.qid), ["a", "b"]);
  assert.deepEqual(R.nextQueued([{ qid: "c", text: "!ls", shell: true }, { qid: "d", text: "z" }]).map((q) => q.qid), ["c"]);
  assert.deepEqual(R.nextQueued([]), []);
  const uid = "user-1234567890abcdef", id = "shop-qq1";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json", qk = "coder/" + uid + "/" + id + "/queue.json";
  await bucket.put(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), title: "x" }));
  const toMachine = [], turns = [];
  let readOnMachine = new Set(), claimed = false, readQueued = [];
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (p === "/queue") { toMachine.push(await req.json()); return Response.json({ ok: true }); }
    if (p === "/unqueue") { const b = await req.json(); return Response.json(readOnMachine.has(b.qid) ? { ok: true, removed: false, read: true } : { ok: true, removed: true }); }
    if (p === "/state") return Response.json(claimed ? { running: false, events: [] } : { running: false, events: [{ type: "user", text: "go" }], next: 1, result: { status: "done", summary: "Did it.", messages: [], readQueued } });
    if (p === "/claim") { claimed = true; return Response.json({ ok: true }); }
    if (p === "/push") return Response.json({ ok: true, pushed: false });
    if (p === "/turn") { turns.push(await req.json()); claimed = false; return Response.json({ ok: true }); }
    return Response.json({ ok: true });
  } });
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box });
  const send = async (b) => { const r = await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify(b) }); return { status: r.status, data: await r.json() }; };
  // While Coder works: queued, kept with the chat; a message goes to the running job, a command does not.
  const a = await send({ text: "also update the README" });
  assert.equal(a.status, 200);
  assert.equal(a.data.queued, true);
  assert.match(a.data.qid, /^q[0-9a-z]{6,20}$/);
  const b = await send({ text: "! npm test" });
  const c = await send({ text: "and bump the version" });
  assert.deepEqual(JSON.parse(bucket.m.get(qk)).map((q) => [q.text, !!q.shell]), [["also update the README", false], ["! npm test", true], ["and bump the version", false]]);
  assert.deepEqual(toMachine.map((x) => x.text), ["also update the README", "and bump the version"], "the command waits for the job's end");
  assert.equal((await send({ text: "look", images: [{ type: "image/png", data: "iVBORw0KGgo=" }] })).status, 409, "pictures wait for the end");
  assert.equal((await send({ text: "x", comments: [{ file: "a.js", line: 1, quote: "q", text: "t" }] })).status, 409);
  assert.equal((await send({ text: "/compact" })).status, 409);
  // ✕: taken back (its words back for the box); one Coder already read stays.
  readOnMachine = new Set([a.data.qid]);
  const ta = await go("projects/" + id + "/queue", { method: "POST", body: JSON.stringify({ remove: a.data.qid }) });
  assert.equal(ta.status, 409);
  assert.match((await ta.json()).error, /already read it, so it stays in the conversation/);
  const tc = await (await go("projects/" + id + "/queue", { method: "POST", body: JSON.stringify({ remove: c.data.qid }) })).json();
  assert.deepEqual([tc.ok, tc.text, tc.queue.length], [true, "and bump the version", 2]);
  // The chat's own page shows what waits.
  assert.equal((await (await go("projects/" + id)).json()).queue.length, 2);
  // The job ends having read the first: the command left goes out next, alone, by itself.
  readQueued = [a.data.qid];
  const st = await (await go("projects/" + id + "/state?since=0")).json();
  assert.equal(st.reload, true, "the page loads the chat to follow the next message");
  assert.equal(turns.length, 1);
  assert.deepEqual([turns[0].shell, turns[0].text], ["npm test", ""], "the ! command, as the owner's own");
  assert.deepEqual(JSON.parse(bucket.m.get(qk)), [], "nothing waits now");
  assert.equal(JSON.parse(bucket.m.get(mk)).status, "running");
  // Messages left together go out as one, in the order typed.
  await bucket.put(qk, JSON.stringify([{ qid: "q1aaaaaa", text: "first", at: 1 }, { qid: "q2aaaaaa", text: "second", at: 2 }]));
  readQueued = [];
  const st2 = await (await go("projects/" + id + "/state?since=0")).json();
  assert.equal(st2.reload, true);
  assert.equal(turns.at(-1).text, "first\n\nsecond");
  // The page: grey with ✕, both buttons while Coder works, and its words for the box.
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /if \(q\.status === 200 && q\.data && q\.data\.queued\) \{ S\.queue = q\.data\.queue \|\| \[\]; S\.draft = ''; return draw\(true\); \}/);
  assert.match(page, /data-unqueue="' \+ esc\(q\.qid\) \+ '" aria-label="Take this message back"/);
  assert.match(page, /const read = new Set\(S\.events\.filter\(\(e\) => e\.type === 'user' && e\.qid\)\.map\(\(e\) => e\.qid\)\);/, "one Coder read shows once, as the owner's message");
  assert.match(page, /'<button type="submit" class="cd-send cd-queue-send" aria-label="Send \(it waits for Coder\)"/);
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(css, /\.cd-queued \.cd-bubble \{ background: #f1efeb; color: #6b7280; border: 1px dashed #d8d3ca; \}/);
  void b;
});

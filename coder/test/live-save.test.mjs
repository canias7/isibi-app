// THE CHAT SAVED AS IT GOES, like Claude Code (the owner, 2026-11-06: "Do
// this": "Claude Code saves the chat as it goes. Coder only saves it when the
// job ends, so a machine that crashed mid-job would lose that job's steps").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const ENV = (bucket) => ({ CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket });
const UID = "user-1234567890abcdef", ID = "shop-l1";
const liveKeys = (bucket) => [...bucket.m.keys()].filter((k) => k.includes("/live/"));
/** The machine's sending, handed straight to the Worker's real handler (both halves of one conversation). */
const toWorker = (env, seen = []) => async (url, init) => {
  const { handleLive } = await import("../src/coder-live.mjs");
  seen.push(JSON.parse(init.body));
  return handleLive(new Request(url, { method: init.method, headers: init.headers, body: init.body }), env);
};
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

test("CD118 Coder's conversation is shared as it goes (pictures left out; the history saved at the end keeps them as sent, since 2026-11-14)", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  let now = null; const seen = [];
  const call = (name, args) => ({ id: name + "1", type: "function", function: { name, arguments: JSON.stringify(args) } });
  const steps = [{ message: { role: "assistant", content: "", tool_calls: [call("bash", { command: "ls" })] } }, { message: { role: "assistant", content: "Done." } }];
  let i = 0;
  const r = await runCoder({
    watch: (get) => { now = get; },
    send: async () => { seen.push(now().length); return steps[i++]; },
    exec: async () => ({ code: 0, output: "a.txt" }),
  }, { text: "look", images: [{ type: "image/png", data: "iVBORw0KGgo=" }] });
  assert.equal(r.status, "done");
  // (And tool search's note on the chat's deferred tools, after the owner's message: tool-search.test.mjs; and auto mode's
  // note, Claude Code's auto_mode, in the conversation since fix round 3.)
  assert.deepEqual(seen, [3, 5], "the owner's message and the notes, then the step and its answer");
  const last = now();
  assert.equal(last.length, 6);
  assert.equal(last[0].content, "look\n[1 picture attached]");
  assert.equal("images" in last[0], false);
  // (The owner, 2026-11-14: "yes copy claude code": the history saved at the end is the conversation as Grok was sent it, its
  // pictures too, as Claude Code's transcript keeps its image blocks; the copy shared as it goes leaves them out, to stay small:
  // the Worker keeps it only in case the machine stops mid-job.)
  assert.deepEqual(r.messages[0], { role: "user", content: "look", images: ["data:image/png;base64,iVBORw0KGgo="] });
  assert.deepEqual(last.slice(1), r.messages.slice(1), "the same as the history saved at the end, but for the picture");
});

test("CD119 the machine sends a job's new steps every few seconds and its conversation every 15 seconds; fewer when too large; it stops when it is not this job's; the last ones go before the job's end is handed out", async () => {
  const { liveSender, liveTarget, LIVE_REFUSALS } = await import("../container/server.mjs");
  // Only a real address, chat, turn and pass.
  const pass = "p".repeat(43);
  assert.deepEqual(liveTarget({ url: "https://coder.gofarther.dev/api/coder/live", chat: UID + "/" + ID, turn: 2, pass }), { url: "https://coder.gofarther.dev/api/coder/live", chat: UID + "/" + ID, turn: 2, pass });
  for (const bad of [null, { url: "http://coder.gofarther.dev/x", chat: UID + "/" + ID, turn: 2, pass }, { url: "https://a:b@x.y/", chat: UID + "/" + ID, turn: 2, pass }, { url: "https://x.y/", chat: "../etc", turn: 2, pass }, { url: "https://x.y/", chat: UID + "/" + ID, turn: 0, pass }, { url: "https://x.y/", chat: UID + "/" + ID, turn: 2, pass: "short" }]) assert.equal(liveTarget(bad), null, JSON.stringify(bad));
  const live = { url: "https://coder.gofarther.dev/api/coder/live", chat: UID + "/" + ID, turn: 2, pass };
  // Steps every tick; the conversation only every 15 seconds (and at the end).
  let clock = 0; const sent = [];
  const t = { events: [{ type: "user", text: "go" }], convoNow: () => [{ role: "user", content: "go" }] };
  const ok = async (url, init) => { const b = JSON.parse(init.body); sent.push(b); assert.equal(init.headers["x-coder-live"], pass); assert.equal(init.headers["x-coder-turn"], "2"); return Response.json({ ok: true, have: b.from + b.events.length }); };
  const s = liveSender(t, live, ok, { every: 15, now: () => clock });
  await wait(60);
  assert.deepEqual(sent.map((b) => [b.from, b.events.length, !!b.messages]), [[0, 1, false]], "nothing new: nothing sent");
  t.events.push({ type: "bash", id: "1" }, { type: "result", id: "1", output: "ok" });
  clock = 16_000;
  await wait(60);
  assert.deepEqual(sent.slice(1).map((b) => [b.from, b.events.length, !!b.messages]), [[1, 2, true]]);
  t.events.push({ type: "done", text: "Done." });
  t.convoNow = () => [{ role: "user", content: "go" }, { role: "assistant", content: "Done." }];
  await s.flush();
  assert.deepEqual(sent.at(-1), { from: 3, events: [{ type: "done", text: "Done." }], messages: [{ role: "user", content: "go" }, { role: "assistant", content: "Done." }] }, "the rest, and the last conversation");
  const before = sent.length;
  await wait(50);
  assert.equal(sent.length, before, "nothing after the flush");
  // Too large: fewer steps at once, then the rest.
  const sizes = [];
  const t2 = { events: Array.from({ length: 10 }, (_, i) => ({ type: "text", text: "s" + i })) };
  const s2 = liveSender(t2, live, async (url, init) => { const b = JSON.parse(init.body); sizes.push(b.events.length); return b.events.length > 3 ? new Response("too large", { status: 413 }) : Response.json({ ok: true, have: b.from + b.events.length }); }, { every: 100000 });
  await s2.flush();
  assert.deepEqual(sizes, [10, 5, 2, 2, 2, 2, 2], "halved until it fits, then everything");
  assert.equal(s2.sent, 10);
  // One step too large on its own: a short note in its place, and the rest still go.
  const got = [];
  const t6 = { events: [{ type: "text", text: "a" }, { type: "result", output: "x".repeat(50) }, { type: "text", text: "c" }] };
  await liveSender(t6, live, async (url, init) => { const b = JSON.parse(init.body); if (init.body.includes("x".repeat(50))) return new Response("too large", { status: 413 }); got.push(...b.events); return Response.json({ ok: true, have: b.from + b.events.length }); }, { every: 100000 }).flush();
  assert.deepEqual(got.map((e) => e.text), ["a", "(a step too large to keep here)", "c"]);
  // Not this job's pass: stops at once. "Not running": tried again, and stops after LIVE_REFUSALS in a row.
  let calls = 0;
  const s3 = liveSender({ events: [{ type: "text" }] }, live, async () => { calls++; return new Response("no", { status: 403 }); }, { every: 5 });
  await wait(60); s3.stop();
  assert.equal(calls, 1); assert.equal(s3.over, true);
  calls = 0;
  const s4 = liveSender({ events: [{ type: "text" }] }, live, async () => { calls++; return new Response("not running", { status: 409 }); }, { every: 2 });
  for (let i = 0; i < 100 && !s4.over; i++) await wait(5);
  await wait(20); s4.stop();
  assert.equal(s4.over, true); assert.equal(calls, LIVE_REFUSALS);
  // One sending at a time, however slow the Worker is.
  let inFlight = 0, most = 0;
  const t5 = { events: [{ type: "text" }] };
  const s5 = liveSender(t5, live, async (url, init) => { inFlight++; most = Math.max(most, inFlight); await wait(30); inFlight--; const b = JSON.parse(init.body); t5.events.push({ type: "text" }); return Response.json({ ok: true, have: b.from + b.events.length }); }, { every: 2 });
  await wait(120); s5.stop();
  assert.equal(most, 1);
  // Wiring on the machine: only the real service sends; the last steps go before the end is handed out.
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /export function createApp\(\{ kept = null, gitVia = false, modelVia = false, liveFetch = null,/, "a machine made in a test never sends (nor uses the Worker's git)");
  // (Since 2026-11-11 the server is made first, so the link from the owner's computer can come as an upgrade: GL113.)
  assert.match(server, /const app = createApp\(\{ kept: bootKept\(\), gitVia: true, modelVia: true, room: true, sandbox: true, data: process\.env\.CODER_DATA \|\| null, image: process\.env\.CODER_IMAGE_REF \|\| imageId\(\), tools: process\.env\.CODER_TOOLS_REF \|\| "", liveFetch: \(url, init\) => fetch\(url, init\), home: DEV_HOME, \.\.\.dataDirs\(process\.env\.CODER_DATA\), checker: true \}\);\n[\s\S]{0,200}const srv = http\.createServer\(app\);\n\s+srv\.on\("upgrade", app\.upgrade\);\n\s+srv\.listen\(8080/);
  assert.match(server, /turns\.set\(project, t\);[\s\S]{0,300}const live = liveFetch \? liveTarget\(body\.live\) : null;\n\s+const sender = live \? liveSender\(t, live, liveFetch\) : null;\n\s+const fail = \(status, why\) => \{ if \(sender\) sender\.stop\(\);/, "from the start of the job, the setup included; stopped if the job does not start");
  // (Or all of it once the job's own auto-compact summarized it, since 2026-11-14: CD121b.)
  assert.match(server, /watch: \(now, o = \{\}\) => \{ const before = Array\.isArray\(body\.messages\) \? body\.messages\.length : 0; const whole = [^\n]*t\.convoNow = \(\) => \(whole\(\) \? now\(\) : now\(\)\.slice\(before\)\); \},/, "only this job's part of the conversation");
  // (A Gloopy turn's notes are backed up first, at most 30 seconds: Gloopy's, 2026-11-09.)
  // (Then, in Coder's chats, the job's pictures go to the Worker apart from the saved chat: picsOut, 2026-11-14,
  // test/worker-memory.test.mjs.)
  assert.match(server, /\.then\(async \(r\) => \{ const memory = memOn \? await readMemory\(memFile\) : undefined; const memoryFiles = gloopy \|\| !memOn \? undefined : await readMemoryFiles\(memDir\); if \(gloopy\) await Promise\.race\(\[backupGloopy\(\)\.catch\(\(\) => \{\}\), new Promise\(\(ok\) => setTimeout\(ok, 30_000\)\)\]\); await lastSend\(\); t\.answerDone = true; const messages = gloopy \|\| !Array\.isArray\(r && r\.messages\) \? r && r\.messages : await picsOut\(r\.messages, picsTo\)\.catch\(\(\) => r\.messages\); return \{ \.\.\.r, messages, memory, \.\.\.\(memoryFiles \? \{ memoryFiles \} : \{\}\), cwd: t\.cwd \}; \}, async \(e\) => crashed\(e, true\)\)/);
  // The end is handed out (t.result) only after the turn's commands are ended (its background ones kept): tool 4, part 2.
  // (What a Gloopy turn left waiting for the owner is kept before the turn is marked over: merged 2026-11-13.)
  assert.match(server, /try \{ const go = await quietly\(\); if \(go\) go\(\); \}[^\n]*\n\s+await tidyBg\(bgDir, project\)\.catch\(\(\) => \{\}\);\n(?:[^\n]*\n){0,3}?\s+\} finally \{\n(?:[^\n]*\n){0,8}?\s+t\.result = \{ \.\.\.result, \.\.\.\(dirty === false \? \{ dirty: false \} : \{\}\), background: jobsOf\(project\)[^\n]*\};\n(?:\s+\/\/[^\n]*\n){2}\s+\{ const r = t\.result; if \(gloopy && r && \(r\.approvalRequest \|\| r\.signinRequest \|\| r\.cardRequest \|\| r\.keyRequest\)\) pending\.set\(project, [^\n]*\n\s+if \(t\.writes\) t\.writes\.check = null;\n\s+t\.ended = Date\.now\(\);\n\s+t\.running = false;/);
});

test("CD120 the Worker keeps a job's steps sealed, in parts of 200, only for that job's pass while it runs; they come back in order", async () => {
  const L = await import("../src/coder-live.mjs");
  const bucket = fakeBucket(); const env = ENV(bucket);
  const meta = (o) => bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, turn: 2, status: "running", ...o }));
  await meta({});
  const chat = UID + "/" + ID, pass = await L.livePass(env, chat, 2);
  assert.ok(pass.length >= 40);
  assert.notEqual(pass, await L.livePass(env, chat, 3), "one pass per turn");
  const { egressPass } = await import("../src/coder-egress.mjs");
  assert.notEqual(pass, await egressPass(env, chat, 2), "not the key-adding pass");
  const send = (body, { p = pass, turn = "2", method = "POST", c = chat } = {}) => L.handleLive(new Request("https://coder.gofarther.dev" + L.LIVE_PATH, { method, headers: { "content-type": "application/json", "x-coder-chat": c, "x-coder-turn": turn, "x-coder-live": p }, ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) }), env);
  assert.equal((await send({}, { method: "GET" })).status, 405);
  assert.equal((await send({ from: 0, events: [] }, { p: "x".repeat(43) })).status, 403, "not this job's pass");
  assert.equal((await send({ from: 0, events: [] }, { turn: "3" })).status, 403, "another turn's");
  assert.equal((await send({ from: 0, events: [] }, { c: "../x" })).status, 403);
  assert.equal((await send({ from: -1, events: [] })).status, 400);
  assert.equal((await send({ from: 0, events: ["x"] })).status, 400);
  assert.equal((await send("x".repeat(L.LIVE_BODY_MAX + 1))).status, 413);
  // Kept sealed: the owner's value printed by a command is not in storage as it is.
  const steps = Array.from({ length: 250 }, (_, i) => ({ type: "result", id: String(i), output: i === 5 ? "TOKEN=sk-live-secret-999" : "line " + i }));
  const a = await (await send({ from: 0, events: steps.slice(0, 120), messages: [{ role: "user", content: "go" }] })).json();
  assert.deepEqual(a, { ok: true, have: 120 });
  assert.equal(JSON.stringify([...bucket.m.values()]).includes("sk-live-secret-999"), false, "sealed");
  // A part holds 200: a sending past its end keeps only up to it, and says where to go on.
  assert.deepEqual(await (await send({ from: 120, events: steps.slice(120, 250) })).json(), { ok: true, have: 200 });
  assert.deepEqual(await (await send({ from: 200, events: steps.slice(200, 250) })).json(), { ok: true, have: 250 });
  // Sent twice (an answer lost on the way): kept once.
  assert.deepEqual(await (await send({ from: 200, events: steps.slice(200, 250) })).json(), { ok: true, have: 250 });
  // A gap: told where to start again.
  assert.deepEqual(await (await send({ from: 260, events: [{ type: "text" }] })).json(), { ok: true, have: 250 });
  assert.deepEqual(liveKeys(bucket).map((k) => k.split("/").pop()).sort(), ["conversation.json", "part-000.json", "part-001.json"]);
  const back = await L.readLive(env, bucket, UID, ID, 2);
  assert.deepEqual(back.events, steps, "every step, in order, once");
  assert.deepEqual(back.messages, [{ role: "user", content: "go" }]);
  // Only while that job runs.
  await meta({ status: "idle" });
  assert.equal((await send({ from: 250, events: [{ type: "text" }] })).status, 409);
  // Gone with the save (or the chat).
  await L.dropLive(bucket, UID, ID);
  assert.deepEqual(liveKeys(bucket), []);
  assert.deepEqual(await L.readLive(env, bucket, UID, ID, 2), { events: [], messages: null });
  // A conversation cut off in the middle of a step ends at its last whole step.
  const tc = (id) => ({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name: "bash", arguments: "{}" } }] });
  const whole = [{ role: "user", content: "go" }, tc("a"), { role: "tool", tool_call_id: "a", content: "ok" }];
  assert.deepEqual(L.wholeSteps([...whole, tc("b")]), whole);
  assert.deepEqual(L.wholeSteps([...whole, { role: "assistant", content: "", tool_calls: [{ id: "c" }, { id: "d" }] }, { role: "tool", tool_call_id: "c", content: "x" }]), whole);
  assert.deepEqual(L.wholeSteps(whole), whole);
  assert.deepEqual(L.wholeSteps([...whole, { role: "assistant", content: "Done." }]), [...whole, { role: "assistant", content: "Done." }]);
});

async function chatWithMachine() {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket(); const env = ENV(bucket);
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  await bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 0, saved: 0, status: "idle", at: Date.now() }));
  const machine = { turn: null, gone: false, result: null, seen: [] };
  const box = () => ({ fetch: async (req) => {
    const u = new URL(req.url); machine.seen.push(u.pathname);
    if (machine.gone && u.pathname !== "/turn") return Response.json({ status: "idle", events: [], running: false });
    if (u.pathname === "/turn") { machine.turn = await req.json(); machine.gone = false; return Response.json({ ok: true }); }
    if (u.pathname === "/state") return Response.json({ running: !machine.result, events: [], next: 0, ...(machine.result ? { result: machine.result } : {}) });
    if (u.pathname === "/claim") return Response.json({ ok: !!machine.result });
    if (u.pathname === "/push") return Response.json({ ok: true, pushed: true, changed: true, sha: "abc1234" });
    if (u.pathname === "/stop") return Response.json({ ok: true, running: false, ...(machine.result ? { finished: true } : {}) });
    return Response.json({ ok: true });
  } });
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  return { bucket, env, machine, go };
}

test("CD121 a machine lost in the middle of a job: its steps so far stay in the chat (values hidden), Coder is told the job was cut off and its unsaved changes are gone, and the page loads the saved chat", async () => {
  const { liveSender, liveTarget } = await import("../container/server.mjs");
  const { bucket, env, machine, go } = await chatWithMachine();
  // An earlier job's history, already saved.
  await bucket.put("coder/" + UID + "/" + ID + "/messages.json", JSON.stringify([{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi." }]));
  // The owner's variable, which a command may print.
  assert.equal((await go("projects/" + ID + "/env", { method: "POST", body: JSON.stringify({ vars: { API_KEY: "sk-secret-123" } }) })).status, 200);
  assert.equal((await go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "Fix the total" }) })).status, 200);
  // The job is told where to send its steps, with a pass the Worker takes.
  const live = liveTarget(machine.turn.live);
  assert.deepEqual({ ...live, pass: "" }, { url: "https://coder.gofarther.dev/api/coder/live", chat: UID + "/" + ID, turn: 1, pass: "" });
  // The job works for a while; its steps go to the Worker as they come.
  const t = { events: [{ at: 1, type: "user", text: "Fix the total" }, { at: 2, type: "bash", id: "c1", tool: "bash", verb: "Ran", command: "env | grep API" }, { at: 3, type: "result", id: "c1", code: 0, output: "API_KEY=sk-secret-123" }] };
  const tc = (id) => ({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name: "bash", arguments: "{}" } }] });
  t.convoNow = () => [{ role: "user", content: "Fix the total" }, tc("c1"), { role: "tool", tool_call_id: "c1", content: "API_KEY=..." }, tc("c2")];
  const s = liveSender(t, live, toWorker(env), { every: 100000 });
  await s.flush();
  assert.equal(liveKeys(bucket).length, 2, "a part of steps and the conversation");
  // THE MACHINE IS LOST (restarted: it no longer has the job), a few minutes in.
  const mk = "coder/" + UID + "/" + ID + "/meta.json";
  const { START_GRACE_MS } = await import("../src/coder-routes.mjs");
  await bucket.put(mk, JSON.stringify({ ...JSON.parse(bucket.m.get(mk)), at: Date.now() - START_GRACE_MS - 60_000 }));
  machine.gone = true;
  const st = await (await go("projects/" + ID + "/state?since=3")).json();
  assert.equal(st.running, false);
  assert.equal(st.reload, true, "the page loads the saved chat");
  const events = JSON.parse(bucket.m.get("coder/" + UID + "/" + ID + "/events.json"));
  assert.deepEqual(events.map((e) => e.type), ["user", "bash", "result", "error"]);
  assert.equal(events[2].output, "API_KEY=[hidden]", "the owner's value is hidden");
  assert.match(events[3].text, /^Coder's machine restarted, so this job ended here\. What it did so far is above; its unsaved changes are gone\./);
  // Coder remembers the job up to its last whole step, and is told what happened.
  const msgs = JSON.parse(bucket.m.get("coder/" + UID + "/" + ID + "/messages.json"));
  assert.deepEqual(msgs.slice(0, 2).map((m) => m.content), ["Hello", "Hi."], "the earlier history, as saved");
  // (Batch 19, M-r2-07: the step that was running stays, marked "outcome unknown", like Claude Code's moved sessions.)
  assert.deepEqual(msgs.slice(2, 7).map((m) => m.role), ["user", "assistant", "tool", "assistant", "tool"], "this job's part, the unfinished step kept");
  assert.equal(msgs[6].tool_call_id, "c2");
  assert.match(msgs[6].content, /^Interrupted: Coder's machine stopped while this was running\. Outcome unknown: check what it did before running it again\.$/);
  assert.match(msgs[7].content, /^\(Note from Coder's app, not the owner: Coder's machine stopped during the last job, so the job ended there\. It stopped while running bash: the outcome of that step is unknown, so check what it did before running it again\. Its steps are kept in the chat, but the changes it made in the files since the last save are gone/);
  assert.equal(msgs[8].role, "assistant");
  assert.equal(msgs.length, 9);
  // The chat is free, and nothing of the job is left over.
  const meta = JSON.parse(bucket.m.get("coder/" + UID + "/" + ID + "/meta.json"));
  assert.equal(meta.status, "idle");
  assert.deepEqual(liveKeys(bucket), []);
  assert.equal([...bucket.m.keys()].some((k) => k.startsWith("coder/running-jobs/")), false, "off the watch list");
  assert.equal([...bucket.m.keys()].some((k) => k.endsWith("/hide.json")), false);
  // A late sending from the lost job is refused.
  assert.equal((await toWorker(env)(live.url, { method: "POST", headers: { "content-type": "application/json", "x-coder-chat": live.chat, "x-coder-turn": "1", "x-coder-live": live.pass }, body: JSON.stringify({ from: 3, events: [{ type: "text" }] }) })).status, 409);
});

test("CD121b a machine lost after the job's own auto-compact (Claude Code's, since 2026-11-14) summarized the whole conversation: the machine sends all of it, the summary first, marked `whole`; the Worker keeps it so and puts it in place of the saved chat, not after it, and drops the Rewind marks of what it summarized", async () => {
  const { liveSender, liveTarget } = await import("../container/server.mjs");
  const L = await import("../src/coder-live.mjs");
  const K = await import("../container/coder-compact.mjs");
  const { bucket, env, machine, go } = await chatWithMachine();
  await bucket.put("coder/" + UID + "/" + ID + "/messages.json", JSON.stringify([{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi." }]));
  assert.equal((await go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "Read every log" }) })).status, 200);
  const mk = "coder/" + UID + "/" + ID + "/meta.json";
  assert.deepEqual(JSON.parse(bucket.m.get(mk)).marks.map((m) => m.msg), [2], "this message's Rewind mark");
  const live = liveTarget(machine.turn.live);
  const tc = (id) => ({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name: "bash", arguments: "{}" } }] });
  const sum = K.summaryMessage("The owner asked to read every log; three are read.", "the conversation so far", [], null, { auto: true });
  const t = { events: [{ at: 1, type: "user", text: "Read every log" }, { at: 2, type: "note", text: "Conversation compacted" }], convoWhole: () => 1 };
  t.convoNow = () => [sum, { role: "user", appNote: true, content: "(Note from Coder's app, not the owner: …)" }, tc("c3"), { role: "tool", tool_call_id: "c3", content: "log 4" }, tc("c4")];
  const seen = [];
  await liveSender(t, live, toWorker(env, seen), { every: 100000 }).flush();
  assert.equal(seen.at(-1).whole, true, "sent marked whole");
  const kept = await L.readLive(env, bucket, UID, ID, 1);
  assert.equal(kept.whole, true);
  assert.ok(K.isSummary(kept.messages[0]));
  // The machine is lost.
  const { START_GRACE_MS } = await import("../src/coder-routes.mjs");
  await bucket.put(mk, JSON.stringify({ ...JSON.parse(bucket.m.get(mk)), at: Date.now() - START_GRACE_MS - 60_000 }));
  machine.gone = true;
  await go("projects/" + ID + "/state?since=2");
  const msgs = JSON.parse(bucket.m.get("coder/" + UID + "/" + ID + "/messages.json"));
  assert.ok(K.isSummary(msgs[0]), "the summary first, in place of the saved chat");
  assert.ok(!msgs.some((m) => m.content === "Hello"), "what it summarized is not there twice");
  assert.deepEqual(msgs.slice(1, 6).map((m) => m.role), ["user", "assistant", "tool", "assistant", "tool"], "then the job's part after it, the step that was running marked outcome unknown");
  assert.match(msgs[5].content, /Outcome unknown/);
  assert.match(msgs[6].content, /^\(Note from Coder's app, not the owner: Coder's machine stopped during the last job/);
  assert.equal(msgs.length, 8);
  const meta = JSON.parse(bucket.m.get(mk));
  assert.equal(meta.status, "idle");
  assert.deepEqual(meta.marks, [], "the Rewind marks of what was summarized go");
});

test("CD122 a job saved as usual leaves nothing behind; Stop with the machine gone keeps the steps; a lost job with nothing sent yet still tells Coder what was asked; a removed chat takes its steps with it", async () => {
  const { liveSender, liveTarget } = await import("../container/server.mjs");
  // SAVED AS USUAL: what it sent as it went is deleted with the save.
  let c = await chatWithMachine();
  await c.go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "Fix it" }) });
  const t = { events: [{ at: 1, type: "user", text: "Fix it" }, { at: 2, type: "done", text: "Fixed." }], convoNow: () => [{ role: "user", content: "Fix it" }] };
  await liveSender(t, liveTarget(c.machine.turn.live), toWorker(c.env), { every: 100000 }).flush();
  assert.ok(liveKeys(c.bucket).length > 0);
  c.machine.result = { status: "done", summary: "Fixed", messages: [{ role: "user", content: "Fix it" }, { role: "assistant", content: "Fixed." }] };
  const saved = await (await c.go("projects/" + ID + "/state?since=0")).json();
  assert.equal(saved.project.status, "idle");
  assert.deepEqual(liveKeys(c.bucket), [], "nothing left over");
  // STOP WITH THE MACHINE GONE: the steps so far, then "stopped"; the page loads the saved chat.
  await c.go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "Again" }) });
  c.machine.result = null;
  const t2 = { events: [{ at: 1, type: "user", text: "Again" }, { at: 2, type: "text", text: "Looking." }] };
  await liveSender(t2, liveTarget(c.machine.turn.live), toWorker(c.env), { every: 100000 }).flush();
  c.machine.gone = true;
  const stop = await (await c.go("projects/" + ID + "/stop", { method: "POST", body: "{}" })).json();
  assert.deepEqual(stop, { ok: true, reload: true });
  const events = JSON.parse(c.bucket.m.get("coder/" + UID + "/" + ID + "/events.json"));
  assert.deepEqual(events.slice(-3).map((e) => e.type), ["user", "text", "stopped"]);
  assert.deepEqual(liveKeys(c.bucket), []);
  // Only steps came (no conversation yet): Coder is still told what the owner had asked.
  const msgs = JSON.parse(c.bucket.m.get("coder/" + UID + "/" + ID + "/messages.json"));
  assert.match(msgs.at(-2).content, /The owner had asked: "Again"\./);
  // A page still waiting on a freed chat stops waiting.
  const late = await (await c.go("projects/" + ID + "/state?since=0")).json();
  assert.equal(late.running, false);
  // A REMOVED CHAT takes its saved steps with it.
  c = await chatWithMachine();
  await c.go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "x" }) });
  await liveSender({ events: [{ type: "user", text: "x" }] }, liveTarget(c.machine.turn.live), toWorker(c.env), { every: 100000 }).flush();
  const key = "coder/" + UID + "/" + ID + "/meta.json";
  await c.bucket.put(key, JSON.stringify({ ...JSON.parse(c.bucket.m.get(key)), status: "idle" }));
  assert.equal((await c.go("projects/" + ID, { method: "DELETE" })).status, 200);
  assert.deepEqual(liveKeys(c.bucket), []);
  // Wiring: the Worker's address for it, the page after Stop.
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /\} else if \(url\.pathname === LIVE_PATH\) \{[\s\S]{0,200}res = await handleLive\(request, env, \{ waitUntil: \(p\) => ctx\.waitUntil\(p\) \}\);/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /if \(r\.status === 200 && r\.data && r\.data\.reload && S\.project && S\.project\.id === id\) \{ stopPoll\(\); S\.running = false; return reloadChat\(id\); \}/);
});

test("batch 14: Stop pressed just as a job finished keeps the finished job: its answer and done line are saved", async () => {
  const c = await chatWithMachine();
  await c.go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "Fix it" }) });
  c.machine.result = { status: "done", summary: "Fixed", messages: [{ role: "user", content: "Fix it" }, { role: "assistant", content: "Fixed." }] };
  const stop = await (await c.go("projects/" + ID + "/stop", { method: "POST", body: "{}" })).json();
  assert.deepEqual(stop, { ok: true, reload: true });
  const meta = JSON.parse(c.bucket.m.get("coder/" + UID + "/" + ID + "/meta.json"));
  assert.equal(meta.status, "running", "not ended as lost");
  const saved = await (await c.go("projects/" + ID + "/state?since=0")).json();
  assert.equal(saved.project.status, "idle");
  const msgs = JSON.parse(c.bucket.m.get("coder/" + UID + "/" + ID + "/messages.json"));
  assert.equal(msgs.at(-1).content, "Fixed.");
  assert.ok(c.machine.seen.includes("/claim"), "the result was picked up");
});

test("B21e L-ops-09 a lost job on Fly.io (the chat's disk is kept) says its file changes are still in the folder; elsewhere they are gone", async () => {
  const R2 = await import("../src/coder-routes.mjs");
  const fly = { CODER_MACHINES: "fly", FLY_API_TOKEN: "dummy-not-a-real-token", CODER_FLY_APP: "coder-app", CODER_FLY_IMAGE: "registry.fly.io/coder-app:v1" };
  assert.equal(R2.lostKeepsFiles(fly), true);
  assert.match(R2.lostJobLine(fly, "Coder's machine restarted, so this job ended here."), /its file changes so far are still in the folder and will be saved with the next job\. Send your message again/);
  assert.doesNotMatch(R2.lostJobLine(fly, "x"), /gone/);
  assert.match(R2.lostJobLine({}, "x"), /its unsaved changes are gone\./);
  const src = (await import("node:fs")).readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(src, /keptDisk \? "Understood: that job was cut off; its file changes so far are still in the folder, not saved yet\."/);
});

test("CD-b23b a save leaves out new files that likely hold secrets (.env, keys), keeps .env.example, and still saves a .env the repository already tracks (audit M-g-01)", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync: w, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { treeDirty, LIKELY_SECRET, gitDirFor } = await import("../container/server.mjs");
  assert.ok(LIKELY_SECRET.includes(".env") && LIKELY_SECRET.includes("!.env.example"));
  const root = mkdtempSync(join(tmpdir(), "b23-")), dir = join(root, "p"), gitRoot = join(root, "g");
  mkdirSync(dir); mkdirSync(gitRoot);
  const gd = gitDirFor(dir, gitRoot);
  const g = (...a) => execFileSync("git", ["--git-dir=" + gd, "--work-tree=" + dir, ...a], { encoding: "utf8" });
  execFileSync("git", ["init", "-q", "--bare", gd]); g("config", "core.bare", "false");
  w(join(dir, "tracked.key"), "old"); g("add", "-f", "tracked.key"); g("-c", "user.name=a", "-c", "user.email=a@b.c", "commit", "-qm", "x");
  w(join(dir, ".env"), "A=1"); w(join(dir, ".env.example"), "A="); w(join(dir, "id_rsa"), "k"); w(join(dir, "app.js"), "1"); w(join(dir, "tracked.key"), "new");
  await treeDirty([dir], gitRoot, root);
  const st = g("status", "--porcelain");
  assert.match(st, /\?\? \.env\.example/); assert.match(st, /\?\? app\.js/); assert.match(st, / M tracked\.key/);
  assert.doesNotMatch(st, /\?\? \.env\n/); assert.doesNotMatch(st, /id_rsa/);
});

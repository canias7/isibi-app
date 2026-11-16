// A FASTER, SAFER FIRST MESSAGE (live test, 2026-11-15: a new chat's first message took 97 s, one got stuck and its message
// was lost, and a second message on an awake machine took ~14 s). FS1: the owner's message is never lost when a job is
// ended as lost; FS2: the turn's step times; FS3: the answer shown before the turn is saved; FS4: the machine started when
// the repository is picked (/warm; Fly.io's side, FS5: test/fly.test.mjs); FS6: the page. (The setup copy no longer holds
// the job: test/setup-copy.test.mjs, CD152 and CD153.)
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
const UID = "user-1234567890abcdef";
const R = await import("../src/coder-routes.mjs");
const { saveConnection } = await import("../src/coder-github.mjs");

async function world(machine) {
  const bucket = fakeBucket(); const env = ENV(bucket);
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const calls = [];
  const box = () => ({ fetch: async (req) => {
    const u = new URL(req.url);
    const body = req.method === "POST" ? await req.json() : null;
    calls.push({ path: u.pathname, body, search: u.search });
    return machine(u.pathname, body, u);
  } });
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box };
  const go = (id, path, init) => R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + path, init), env, {}, deps);
  const put = (id, meta) => bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, ...meta }));
  const read = (id, f) => JSON.parse(bucket.m.get("coder/" + UID + "/" + id + "/" + f) || "null");
  return { bucket, env, calls, go, put, read };
}
const pushOk = () => Response.json({ ok: true, pushed: false, changed: false });

test("FS1 the owner's message is never lost (live test, 2026-11-15): a job ended as lost before its machine sent a step keeps the message in the chat, before the error (marked `lost`), and Coder is told what was asked; a message whose start stopped half-way too; the message is recorded with the chat when its turn starts", async () => {
  // LOST WHILE STARTING (the machine never had it running): freed after the start's grace, the message kept.
  const w = await world((p) => (p === "/state" ? Response.json({ running: false, events: [], next: 0 }) : Response.json({ ok: true })));
  await w.put("shop-a1", { turn: 1, saved: 0, status: "running", at: Date.now() - R.START_GRACE_MS - 1000, asked: { turn: 1, at: 5, text: "Add a footer" } });
  const r = await (await w.go("shop-a1", "/state?since=0")).json();
  assert.equal(r.running, false);
  const evs = w.read("shop-a1", "events.json");
  assert.deepEqual(evs.map((e) => [e.type, e.text.slice(0, 40)]), [["user", "Add a footer"], ["error", "Coder's machine restarted, so this job e"]]);
  assert.equal(evs[1].lost, true, "the page knows this ending at once");
  assert.equal(r.events[0].lost, true);
  assert.match(JSON.stringify(w.read("shop-a1", "messages.json")), /The owner had asked: \\"Add a footer\\"/, "and Coder is told what was asked");
  // An older turn's record is not this turn's message.
  await w.put("shop-a2", { turn: 2, saved: 1, status: "running", at: Date.now() - R.START_GRACE_MS - 1000, asked: { turn: 1, text: "old" } });
  await w.go("shop-a2", "/state?since=0");
  assert.deepEqual(w.read("shop-a2", "events.json").map((e) => e.type), ["error"]);
  assert.equal(R.askedFor({ turn: 3, asked: { turn: 3, text: " " } }), null);

  // A START THAT STOPPED HALF-WAY: the message itself stays, before the error.
  await w.put("shop-a3", { turn: 0, saved: 0, status: "running", at: 0, starting: { id: "t1", mid: "", turn: 0, was: "idle", at: Date.now() - R.STARTING_MAX_MS - 1000, said: "Fix it", text: "Fix it\nplease" } });
  const r3 = await (await w.go("shop-a3", "/state?since=0")).json();
  assert.deepEqual(r3.events.map((e) => [e.type, e.text.slice(0, 13)]), [["user", "Fix it\nplease"], ["error", "Your last mes"]]);
  assert.deepEqual(w.read("shop-a3", "events.json").map((e) => e.type), ["user", "error"]);

  // RECORDED WHEN THE TURN STARTS: the message, its step times so far.
  const w2 = await world(() => Response.json({ ok: true }));
  await w2.put("shop-b1", { turn: 0, saved: 0, status: "idle", at: Date.now() });
  const s = await w2.go("shop-b1", "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Make the logo blue" }) });
  assert.equal(s.status, 200, await s.clone().text());
  const meta = w2.read("shop-b1", "meta.json");
  assert.deepEqual({ ...meta.asked, at: 0 }, { turn: 1, at: 0, text: "Make the logo blue" });
  assert.ok(meta.timing.got > 0 && meta.timing.asked >= meta.timing.got && meta.timing.machine >= meta.timing.asked, JSON.stringify(meta.timing));
  // (The setup copy never holds the job: no /go.)
  assert.deepEqual(w2.calls.map((c) => c.path), ["/turn"]);
});

test("FS2 the turn's step times (where a message's seconds go): the Worker's and the machine's, as milliseconds since the Worker got the message, kept with the chat when the turn is saved, and logged", async () => {
  assert.deepEqual(R.turnTiming({ got: 1000, asked: 1300, machine: 2000 }, { got: 1400, cloneStart: 1410, cloneEnd: 1900, ready: 1950, began: 1960, firstAsk: 2100, firstAnswer: 3300, answered: 3400, ended: 3500, junk: "x" }, 4000), { at: 1000, asked: 300, machine: 1000, "m.got": 400, "m.cloneStart": 410, "m.cloneEnd": 900, "m.ready": 950, "m.began": 960, "m.firstAsk": 1100, "m.firstAnswer": 2300, "m.answered": 2400, "m.ended": 2500, saved: 3000 });
  assert.deepEqual(R.turnTiming(null, null, 50), { at: 50, saved: 0 });
  const now = Date.now();
  const w = await world((p) => (p === "/state" ? Response.json({ running: false, result: { status: "done", summary: "Done.", messages: [], timing: { got: now + 10, began: now + 20, firstAsk: now + 30, firstAnswer: now + 40, answered: now + 50, ended: now + 60 } }, events: [], next: 0 }) : p === "/push" ? pushOk() : Response.json({ ok: true })));
  await w.put("shop-c1", { turn: 1, saved: 0, status: "running", at: now, timing: { got: now, asked: now + 5, machine: now + 25 } });
  const r = await (await w.go("shop-c1", "/state?since=0")).json();
  assert.equal(r.running, false);
  const t = w.read("shop-c1", "meta.json").timing;
  assert.deepEqual({ ...t, saved: 0 }, { at: now, asked: 5, machine: 25, "m.got": 10, "m.began": 20, "m.firstAsk": 30, "m.firstAnswer": 40, "m.answered": 50, "m.ended": 60, saved: 0 });
  assert.ok(t.saved >= 0);
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.ok(src.includes('console.log("coder: turn timing " + id + " #" + meta.turn + " " + JSON.stringify(ended.timing));'), "and logged");
});

test("FS3 the answer shown at once: a page asking with early=1 gets the job's last steps as soon as the machine has them, before the save (the push to GitHub takes seconds); its next look, with nothing new, saves the turn", async () => {
  const w = await world((p, b, u) => (p === "/state" ? Response.json({ running: false, result: { status: "done", summary: "Hi.", messages: [] }, events: u.searchParams.get("since") === "0" ? [{ type: "answer", text: "Hi." }] : [], next: 1 }) : p === "/push" ? pushOk() : Response.json({ ok: true })));
  await w.put("shop-d1", { turn: 1, saved: 0, status: "running", at: Date.now() });
  const r1 = await (await w.go("shop-d1", "/state?since=0&early=1")).json();
  assert.deepEqual([r1.running, r1.ending, r1.events.map((e) => e.text)], [true, true, ["Hi."]]);
  assert.ok(!w.calls.some((c) => c.path === "/claim" || c.path === "/push"), "nothing saved yet");
  assert.equal(w.read("shop-d1", "meta.json").status, "running");
  // (Once the answer is shown the page asks with its turn, not early: 2026-11-16.)
  const r2 = await (await w.go("shop-d1", "/state?since=1&turn=1")).json();
  assert.equal(r2.running, false);
  assert.equal(w.read("shop-d1", "meta.json").saved, 1, "saved on the next look");
  // Without early=1 (the every-minute run, another tab): saved at once, as before.
  const w2 = await world((p) => (p === "/state" ? Response.json({ running: false, result: { status: "done", summary: "Hi.", messages: [] }, events: [{ type: "answer", text: "Hi." }], next: 1 }) : p === "/push" ? pushOk() : Response.json({ ok: true })));
  await w2.put("shop-d2", { turn: 1, saved: 0, status: "running", at: Date.now() });
  assert.equal((await (await w2.go("shop-d2", "/state?since=0")).json()).running, false);
});

test("FS4 the machine started when the owner picks the repository (/warm): a new chat's machine is asked to start; never after the first message, nor while one runs", async () => {
  const w = await world(() => Response.json({ ok: true, warm: true }));
  await w.put("shop-e1", { turn: 0, saved: 0, status: "idle", at: Date.now() });
  assert.deepEqual(await (await w.go("shop-e1", "/warm", { method: "POST" })).json(), { ok: true, warm: true });
  assert.deepEqual(w.calls.map((c) => [c.path, c.body]), [["/warm", { project: "shop-e1" }]]);
  w.calls.length = 0;
  await w.put("shop-e2", { turn: 1, saved: 1, status: "idle", at: Date.now() });
  assert.deepEqual(await (await w.go("shop-e2", "/warm", { method: "POST" })).json(), { ok: true, warm: false });
  await w.put("shop-e3", { turn: 0, saved: 0, status: "running", at: Date.now() });
  assert.deepEqual(await (await w.go("shop-e3", "/warm", { method: "POST" })).json(), { ok: true, warm: false });
  assert.deepEqual(w.calls, [], "the machine is not asked");
  // The machine could not be started: said, nothing else.
  const w2 = await world(() => new Response("no", { status: 503 }));
  await w2.put("shop-e4", { turn: 0, saved: 0, status: "idle", at: Date.now() });
  assert.deepEqual(await (await w2.go("shop-e4", "/warm", { method: "POST" })).json(), { ok: false, warm: false });
});

test("FS6 the page: asks for its machine when the owner picks the repository; while a message is still being sent, an ending already saved for it (a lost job's error) is shown at once, not \"…\"; asks with early=1 and looks again at once once the answer is shown", () => {
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.ok(page.includes("call('/projects/' + encodeURIComponent(r.data.project.id) + '/warm', { method: 'POST' }).catch(() => {});"));
  assert.ok(page.indexOf("/warm'") < page.indexOf("openProject(r.data.project.id);", page.indexOf("/warm'")), "before the chat opens");
  assert.ok(page.includes("setTimeout(() => watchSend(sent), SEND_WATCH_MS);"));
  assert.ok(page.includes("const over = d && !d.running && p && p.status !== 'running' && (evs.some((e) => e && e.lost) || (Number(p.turn) > sent.turn && Number(p.saved) >= Number(p.turn)));"));
  assert.ok(page.includes("sent.gone = true; S.sendWatch = null;\n    S.sending = false; S.unsent = ''; S.running = false;"), "no longer shown as working");
  assert.ok(page.includes("if (sent.gone) return;"), "the message's late answer changes nothing");
  assert.ok(page.includes("'&early=1')"));
  assert.ok(page.includes("S.poll = setTimeout(tick, quickLook(r) ? QUICK_POLL_MS : POLL_MS);"));
});

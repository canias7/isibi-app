// A CODER MESSAGE CAN'T GET STUCK (owner, 2026-11-13: "fix 1", from the note Gloopy's session left: "a message can get
// stuck the same way Gloopy's did"). Gloopy's fix (GL137 in gloopy.test.mjs), the same in Coder's chats: the chat is marked
// as starting before the slow part; the same message sent twice is started (or queued) once; a failed start puts the chat
// back only while it is still its own; a start cut off half-way is undone and said; and the start goes on when the page goes.
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

/** A Coder chat (ana/shop) with GitHub connected, and a stand-in for its machine: the jobs it is handed, one at a time. */
async function setup() {
  const { handleCoder, STARTING_MAX_MS, startingOf } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-s9";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const metaKey = "coder/" + uid + "/" + id + "/meta.json";
  bucket.m.set(metaKey, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 0, saved: 0, status: "idle", at: Date.now() }));
  const t = { handed: [], asked: [], running: null, busyFor: null, sums: [], gate: null, waited: [] };
  t.machine = { fetch: async (req) => {
    const u = new URL(req.url), body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    t.asked.push(u.pathname);
    if (u.pathname === "/turn") {
      t.handed.push(body);
      if (t.busyFor) { await t.busyFor(body); return Response.json({ error: "busy" }, { status: 409 }); }
      if (t.running) return t.running.start && t.running.start === body.start ? Response.json({ ok: true, again: true }) : Response.json({ error: "busy" }, { status: 409 });
      t.running = { start: body.start };
      return Response.json({ ok: true });
    }
    if (u.pathname === "/state") return Response.json({ running: !!t.running, events: [], next: 0 });
    if (u.pathname === "/stop") { t.running = null; return Response.json({ ok: true, running: false }); }
    return Response.json({ ok: true });
  } };
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => t.machine,
    summarize: async (m) => { t.sums.push(m.length); if (t.gate) await t.gate.promise; return "Ana and Coder fixed the login button."; } };
  const ctx = { waitUntil: (p) => { t.waited.push(p); } };
  t.go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, ctx, deps);
  t.send = (o) => t.go("projects/" + id + "/message", { method: "POST", body: JSON.stringify(o) });
  t.meta = () => JSON.parse(bucket.m.get(metaKey));
  t.setMeta = (m) => bucket.m.set(metaKey, JSON.stringify(m));
  t.idle = () => { const m = t.meta(); t.running = null; t.setMeta({ ...m, status: "idle", saved: m.turn, starting: null }); };
  t.longChat = () => { const big = "x".repeat(60 * 1024); const m = []; for (let i = 0; i < 6; i++) m.push({ role: "user", content: "Fix " + i + " " + big }, { role: "assistant", content: "Done " + i }); bucket.m.set("coder/" + uid + "/" + id + "/messages.json", JSON.stringify(m)); };
  t.notes = () => JSON.parse(bucket.m.get("coder/" + uid + "/" + id + "/events.json") || "[]").filter((e) => /^Compacted:/.test(e.text || ""));
  t.queue = () => JSON.parse(bucket.m.get("coder/" + uid + "/" + id + "/queue.json") || "[]");
  t.open = () => { let ok; const promise = new Promise((r) => { ok = r; }); return { promise, ok }; };
  t.until = async (f) => { for (let i = 0; i < 400; i++) { if (f()) return; await new Promise((r) => setTimeout(r, 10)); } throw new Error("never happened"); };
  Object.assign(t, { uid, id, bucket, deps, env, STARTING_MAX_MS, startingOf });
  return t;
}

test("CS1 (2026-11-13) the same message twice, the second while the first waits for a long chat's summary: started once, both answered as started; another message meanwhile waits in the queue, once even if sent twice; a copy after it started is not started again", async () => {
  const t = await setup();
  t.longChat(); t.gate = t.open();
  const first = t.send({ mid: "mFIX00001", text: "Fix the login button" });
  await t.until(() => t.startingOf(t.meta()));
  assert.equal(t.meta().status, "running", "marked as starting before the summary");
  assert.equal(t.meta().starting.mid, "mFIX00001");
  assert.equal(t.meta().starting.said, "Fix the login button", "what was said, for if it is cut off");
  // Meanwhile the chat says Coder is working, and its machine isn't asked (it knows only the job before).
  const look = await (await t.go("projects/" + t.id + "/state?since=0")).json();
  assert.deepEqual([look.running, look.events], [true, []]);
  assert.ok(!t.asked.includes("/state"), "its machine was not asked");
  const again = t.send({ mid: "mFIX00001", text: "Fix the login button" });
  // Another message meanwhile goes in the queue (Claude Code's: it waits for the job), and nothing is started for it.
  const other = await (await t.send({ mid: "mOTHER001", text: "And add a test" })).json();
  assert.equal(other.queued, true);
  const twice = await (await t.send({ mid: "mOTHER001", text: "And add a test" })).json();
  assert.deepEqual([twice.queued, twice.qid], [true, other.qid], "the same queued message again: the same entry");
  assert.deepEqual(t.queue().map((q) => q.text), ["And add a test"], "queued once");
  t.gate.ok();
  const [a, b] = await Promise.all([first, again]);
  assert.deepEqual([a.status, b.status], [200, 200]);
  const pa = (await a.json()).project, pb = (await b.json()).project;
  assert.deepEqual([pa.status, pb.status, pa.turn, pb.turn], ["running", "running", 1, 1], "both copies answer with the one job");
  assert.equal(t.handed.length, 1, "the machine was handed the job once");
  assert.equal(t.sums.length, 1, "the chat was summarized once");
  assert.equal(t.notes().length, 1);
  const now = t.meta();
  assert.equal(now.mid, "mFIX00001");
  assert.equal(now.start, t.handed[0].start, "the start's id goes to the machine (the same start twice is one there)");
  assert.equal(t.startingOf(now), null);
  // The same message once more, after it started (its answer was lost on the way): answered, not started or queued.
  const late = await t.send({ mid: "mFIX00001", text: "Fix the login button" });
  assert.equal(late.status, 200);
  assert.equal((await late.json()).project.turn, 1);
  assert.equal(t.handed.length, 1);
  assert.equal(t.queue().length, 1);
});

test("CS2 (2026-11-13) both copies at the very same moment: started once (also in a long chat, summarized once); two different messages at once: one starts, the other is told so or waits in the queue", async () => {
  const t = await setup();
  const twin = { mid: "mTWIN00001", text: "Check the tests" };
  const [t1, t2] = await Promise.all([t.send(twin), t.send(twin)]);
  assert.deepEqual([t1.status, t2.status], [200, 200]);
  assert.equal(t.handed.length, 1, "handed to the machine once");
  t.idle(); t.longChat();
  const s0 = t.sums.length, n0 = t.handed.length;
  const twin2 = { mid: "mTWIN00002", text: "Check the tests again" };
  const [u1, u2] = await Promise.all([t.send(twin2), t.send(twin2)]);
  assert.deepEqual([u1.status, u2.status], [200, 200]);
  assert.equal(t.sums.length, s0 + 1, "summarized once");
  assert.equal(t.handed.length, n0 + 1);
  t.idle();
  const n1 = t.handed.length;
  const duo = await Promise.all([t.send({ mid: "mDUO000001", text: "One." }), t.send({ mid: "mDUO000002", text: "Two." })]);
  assert.equal(t.handed.length, n1 + 1, "one started");
  const said = await Promise.all(duo.map(async (r) => ({ status: r.status, ...(await r.json()) })));
  const notStarted = said.find((x) => x.status === 409 || x.queued === true);
  assert.ok(notStarted, "the other one didn't start");
  if (notStarted.status === 409) assert.equal(notStarted.error, "This message didn't start: Coder was stopped, or another message started first. Send it again if you still want it.");
});

test("CS3 (2026-11-13) stopped from another page while the message was starting: not started, and the chat stays stopped", async () => {
  const t = await setup();
  t.longChat(); t.gate = t.open();
  const stopMe = t.send({ mid: "mSTOPME01", text: "Rename the button" });
  await t.until(() => t.startingOf(t.meta()));
  assert.equal((await t.go("projects/" + t.id + "/stop", { method: "POST", body: "{}" })).status, 200);
  assert.equal(t.meta().status, "idle", "freed by Stop");
  t.gate.ok();
  const stopped = await stopMe;
  assert.equal(stopped.status, 409);
  assert.equal((await stopped.json()).error, "This message didn't start: Coder was stopped, or another message started first. Send it again if you still want it.");
  assert.equal(t.handed.length, 0, "nothing handed to the machine");
  assert.equal(t.meta().status, "idle");
});

test("CS4 (2026-11-13) a failed start never puts the chat back over a newer one (the bug: the machine said busy, and the old chat went back over the start that did begin); its own failed start puts the chat back as it was; an error half-way too", async () => {
  const t = await setup();
  t.busyFor = async () => { const m = t.meta(); t.setMeta({ ...m, status: "running", turn: m.turn + 5, start: "tNEWERSTART0001", starting: null }); };
  const lost = await t.send({ mid: "mBUSY0001", text: "Go on." });
  assert.equal(lost.status, 409);
  assert.equal((await lost.json()).error, "Coder is still working on the last message");
  assert.equal(t.meta().start, "tNEWERSTART0001", "the newer start's chat is kept");
  assert.equal(t.meta().status, "running");
  t.busyFor = null;
  // Its own failed start: the chat as it was, nothing left marked.
  t.idle();
  const before = t.meta();
  t.busyFor = async () => {};
  const refused = await t.send({ mid: "mBUSY0002", text: "Go on." });
  assert.equal(refused.status, 409);
  assert.deepEqual({ ...t.meta(), starting: null }, { ...before, starting: null }, "as it was");
  assert.equal(t.startingOf(t.meta()), null);
  t.busyFor = null;
  // An error half-way (the summary broke): put back, not left "working".
  t.idle(); t.longChat();
  t.deps.summarize = async () => { throw new Error("summary service down"); };
  await assert.rejects(t.send({ mid: "mBROKEN01", text: "Hello?" }), /summary service down/);
  assert.equal(t.meta().status, "idle");
  assert.equal(t.startingOf(t.meta()), null);
});

test("CS5 (2026-11-13) a start cut off half-way (its request ended, and nothing put the chat back): undone after STARTING_MAX_MS and said in the chat; the start goes on when the page goes (Cloudflare's waitUntil)", async () => {
  const t = await setup();
  const m = t.meta(), long = Date.now() - t.STARTING_MAX_MS - 1000;
  t.setMeta({ ...m, status: "running", at: long, starting: { id: "tCUTOFF00001", mid: "mCUT00001", turn: m.turn, was: "idle", at: long, said: "Fix the login button" } });
  const fresh = await (await t.go("projects/" + t.id + "/state?since=0")).json();
  assert.equal(fresh.running, false);
  assert.equal(fresh.project.status, "idle");
  assert.equal(fresh.events[0].text, "Your last message (“Fix the login button”) didn't reach Coder: sending it stopped half-way. Send it again.");
  assert.equal(t.startingOf(t.meta()), null);
  assert.ok(!t.asked.includes("/state"), "the machine was not asked about a job it never had");
  // A message's start is handed to waitUntil, so it finishes even when the page goes.
  t.waited.length = 0;
  assert.equal((await t.send({ mid: "mWAIT00001", text: "Go." })).status, 200);
  assert.equal(t.waited.length, 1);
});

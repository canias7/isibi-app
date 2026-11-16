// A QUICKER MESSAGE (owner-approved, 2026-11-15, after deploy 201's step times): QS1 the Worker asks the machine sooner (its
// reads of Coder's storage made together, not one after another: 3.6 s before); QS2 and QS3 the box is freed as soon as the
// answer is shown, and a message sent while the turn is saved goes out after the save, once, never lost; QS4 the page.
// (The spare machines: test/spares.test.mjs.) None of these depend on how fast this computer is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const KEY = Buffer.alloc(32, 7).toString("base64");
const ENV = (bucket) => ({ CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket });
const UID = "user-1234567890abcdef";
const R = await import("../src/coder-routes.mjs");
const { saveConnection } = await import("../src/coder-github.mjs");

/** R2 that answers each read after the event loop turns a few times (no clock), and counts how many reads are open at once. */
function slowBucket() {
  const m = new Map(); const st = { open: 0, most: 0, onPut: null };
  const later = async () => { for (let i = 0; i < 5; i++) await new Promise((ok) => setImmediate(ok)); };
  return { m, st,
    async get(k) { st.open++; st.most = Math.max(st.most, st.open); await later(); st.open--; return m.has(k) ? { text: async () => m.get(k) } : null; },
    async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); if (st.onPut) await st.onPut(k); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { await later(); return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function world(machine) {
  const bucket = slowBucket(); const env = ENV(bucket);
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const calls = [];
  const box = () => ({ fetch: async (req) => { const u = new URL(req.url); const body = req.method === "POST" ? await req.json() : null; calls.push({ path: u.pathname, body }); return machine(u.pathname, body, u); } });
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box };
  const go = (id, path, init) => R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + path, init), env, {}, deps);
  const put = (id, meta) => bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, ...meta }));
  const read = (id, f) => JSON.parse(bucket.m.get("coder/" + UID + "/" + id + "/" + f) || "null");
  const msg = (id, body) => go(id, "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { bucket, env, calls, go, put, read, msg };
}
const pushOk = () => Response.json({ ok: true, pushed: false, changed: false });

test("QS1 the message's start reads Coder's storage together, not one read after another (live: 3.6 s before the machine was asked): the GitHub sign-in, the running chats, the chat, the settings, the environment, the memory and the steps so far are all asked at once; the job is started as before", async () => {
  const w = await world(() => Response.json({ ok: true }));
  for (let i = 0; i < 6; i++) await w.put("other-" + i, { turn: 1, saved: 1, status: "idle", at: i });
  await w.put("shop-q1", { turn: 0, saved: 0, status: "idle", at: Date.now() });
  w.bucket.st.most = 0;
  // (Every chat is read to count those working only with a limit set, 2026-11-16: test/faster-start.test.mjs, FT1.)
  w.env.CODER_MAX_RUNNING = "50";
  const r = await w.msg("shop-q1", { text: "Make the logo blue", mid: "mQS1aaaaaaaa" });
  assert.equal(r.status, 200, await r.clone().text());
  assert.ok(w.bucket.st.most >= 6, "reads open together: " + w.bucket.st.most);
  assert.deepEqual(w.calls.map((c) => c.path), ["/turn"]);
  const t = w.calls[0].body;
  assert.ok(t.egress.pass && t.live.pass && t.model && t.emailMark, "the job's passes as before");
  assert.equal(w.read("shop-q1", "meta.json").status, "running");
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  for (const s of ["const t = await tokenP;", "const running = await runningP;", "const read0 = await read0P;", "const { envId, list: envList, setup } = await envP;", "const memory = await memoryP;"]) assert.ok(src.includes(s), s);
});

test("QS2 a message sent while the turn is being saved (the answer already shown) waits in line and goes out after the save, by itself, once", async () => {
  let turnN = 0;
  const w = await world((p, b, u) => {
    if (p === "/state") return Response.json({ running: false, result: { status: "done", summary: "Hi.", messages: [], readQueued: [] }, events: u.searchParams.get("since") === "0" ? [{ type: "answer", text: "Hi." }] : [], next: 1 });
    if (p === "/push") return pushOk();
    if (p === "/claim") return Response.json({ ok: true });
    if (p === "/queue") return Response.json({ ok: false, notRunning: true });
    if (p === "/turn") turnN++;
    return Response.json({ ok: true });
  });
  await w.put("shop-q2", { turn: 1, saved: 0, status: "running", at: Date.now() });
  const e = await (await w.go("shop-q2", "/state?since=0&early=1")).json();
  assert.equal(e.ending, true);
  const q = await (await w.msg("shop-q2", { text: "Now make it red", mid: "mQS2aaaaaaaa" })).json();
  assert.equal(q.queued, true, "in line while the save runs");
  assert.equal(turnN, 0);
  const s = await (await w.go("shop-q2", "/state?since=1&turn=1")).json();
  assert.equal(s.reload, true, "the save sent it, and the page follows it: " + JSON.stringify(s).slice(0, 400) + JSON.stringify(w.calls.map((c) => c.path)));
  assert.equal(turnN, 1, "once");
  assert.deepEqual(w.read("shop-q2", "queue.json"), []);
  assert.equal(w.read("shop-q2", "meta.json").turn, 2);
  assert.equal(w.read("shop-q2", "meta.json").mid, "mQS2aaaaaaaa", "with its own id, so a second copy is never started");
  // The same message again (its copy): not started a second time.
  await w.msg("shop-q2", { text: "Now make it red", mid: "mQS2aaaaaaaa" });
  assert.equal(turnN, 1);
});

test("QS3 the save ends at the very moment the message is put in line (its look at what waits came first): the message goes out at once instead of waiting for ever; never twice", async () => {
  let turnN = 0;
  const w = await world((p) => { if (p === "/turn") turnN++; return Response.json({ ok: true, notRunning: p === "/queue" }); });
  await w.put("shop-q3", { turn: 1, saved: 0, status: "running", at: Date.now() });
  // The save finishing just as the message is put in line: the chat is saved (idle) right after queue.json is written.
  const metaKey = "coder/" + UID + "/shop-q3/meta.json";
  w.bucket.st.onPut = async (k) => { if (k.endsWith("shop-q3/queue.json") && w.bucket.st.onPut) { w.bucket.st.onPut = null; const m = JSON.parse(w.bucket.m.get(metaKey)); w.bucket.m.set(metaKey, JSON.stringify({ ...m, status: "idle", saved: 1 })); } };
  const r = await (await w.msg("shop-q3", { text: "And bigger", mid: "mQS3aaaaaaaa" })).json();
  assert.equal(r.reload, true, "it went out at once");
  assert.equal(turnN, 1);
  assert.deepEqual(w.read("shop-q3", "queue.json"), []);
  assert.equal(w.read("shop-q3", "meta.json").turn, 2);
});

test("QS4 the page frees the box as soon as the answer is shown (`ending`): a normal Send button, no Stop, no dots; a message then waits in line with its own id and the page follows it when the save sends it; the save's line still comes", () => {
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.ok(page.includes("S.ending = S.running && (!!r.data.ending || !!S.ending);"));
  assert.ok(page.includes("const busy = (S.running && !S.ending) || S.sending;"));
  assert.ok(page.includes("((S.running && !S.ending) || (!GLOOPY && S.project && S.project.parked)"));
  assert.ok(page.includes("function startPoll() { stopPoll(); S.ending = false;"));
  assert.ok(page.includes("JSON.stringify({ text, mid: qmid })"));
  assert.ok(page.includes("if (q.status === 200 && q.data && q.data.reload && q.data.project)"));
  assert.ok(page.includes("S.poll = setTimeout(tick, quickLook(r) ? QUICK_POLL_MS : POLL_MS);"), "it keeps looking until the save is done");
});

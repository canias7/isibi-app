// A LOST BUILD, THROUGH ITS REAL LIFECYCLE (2026-10-08, Codex's review of
// `41731e86`).
//
// Two connected defects, each reproduced through what production does, not
// through fixtures that leave state production removes:
//
//   1  the queue consumer reads and DELETES the job envelope before it runs
//      the build; recovery read `fenced` from that deleted envelope, so a
//      staged-only build of the fenced protocol came back unknown and was
//      never refunded. The protocol is now kept in its own record
//      (`jobs/<id>.meta.json`, no credential), written before the envelope
//      goes.
//   2  recovery wrote `settled: true` before the customer's answer; an
//      answer write that failed was never repaired. Money and delivery are
//      now recorded apart, and the answer is rebuilt from the settlement
//      record until it is stored.
//
// The lifecycle: the real producer's envelope (`packJob`) is consumed by the
// real queue consumer (`worker.queue`), which is stopped where an evicted
// isolate stops — its first call after the delete never answers; the site is
// then staged or published with the real helpers (`stageBuild`,
// `activateBuild`, the fence); the row is lost; recovery runs repeatedly
// with injected failures; the customer's stored answer is read back.
//
// The ledger here is a stand-in that answers `credit_reverse` as the applied
// SQL does (a repeat of the same ref and reason gives nothing new and says
// what was given before). It is NOT a database: the row-lock protocol of
// `build_debit` is verified only as SQL text, never against Postgres.

import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, BUILD_USER } from "./fixtures/build-route.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { jobKey, jobMetaKey, resultKey, packJob, readResult, JOB_KIND } from "../builder/build-job.mjs";
import { stageBuild, activateBuild } from "../site-builds.mjs";

const SLUG = "harbour-loaf";
const V2 = "01791429280760-09n7s1";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "b2c3d4e5f60718293a4b5c6d7e8f9";

function depsOf(b) {
  return {
    get: (k) => b.get(k),
    put: (k, v, ct, onlyIf) => b.put(k, v, onlyIf ? { onlyIf } : undefined),
    remove: (k) => b.delete(k),
    list: async (prefix) => (await b.list({ prefix })).objects,
  };
}

/** THE REAL CONSUMER, stopped where an evicted isolate stops: its first call after consuming the envelope never answers. */
async function consume(b, id, envelope) {
  b.store.set(jobKey(id), JSON.stringify(envelope));
  const real = globalThis.fetch;
  let asked = false;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/edit_claim/.test(u)) { asked = true; return new Promise(() => {}); }
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    return json([]);
  };
  try {
    const worker = await loadWorker();
    void worker.queue({ messages: [{ body: { kind: JOB_KIND, id }, ack() {}, retry() {} }] }, { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, makeCtx());
    for (let i = 0; i < 200 && !asked; i++) await new Promise((r) => setTimeout(r, 5));
  } finally { globalThis.fetch = real; }
  assert.ok(asked, "the consumer never reached its claim");
  assert.equal(b.store.has(jobKey(id)), false, "the consumer did not consume the envelope, so this is not production's state");
}

const STATE = { pages: "[]", parts: "[]", config: "{}", sidecar: "{}", kit: "[]" };
async function stageOnly(b, id) {
  const st = await stageBuild(depsOf(b), { slug: SLUG, version: V2, files: { "index.html": { t: "x" } }, state: STATE, manifest: { job: id, at: Date.parse("2026-10-08T11:05:00Z") } });
  assert.ok(st && st.ok !== false);
}
async function publish(b, id) {
  const { claimBuildFence, markPublished } = await loadWorkerModule();
  await stageOnly(b, id);
  const env = { SITES_BUCKET: b };
  assert.equal((await claimBuildFence(env, id, "publish")).owner, "publish");
  assert.equal((await activateBuild(depsOf(b), { slug: SLUG, version: V2, job: id, expectEtag: null, putWorker: async () => ({ ok: true }) })).ok, true);
  await markPublished(env, id, V2);
}
async function claimOnly(b, id) {
  const { claimBuildFence } = await loadWorkerModule();
  await stageOnly(b, id);
  assert.equal((await claimBuildFence({ SITES_BUCKET: b }, id, "publish")).owner, "publish");
}

/** credit_reverse as the applied SQL answers it: bounded by the debit, a repeat gives nothing new and says what came back before. */
function ledger() {
  const back = new Map();
  const calls = [];
  return {
    calls,
    answer: (a) => {
      calls.push(a.p_ref);
      const key = a.p_ref + "|" + a.p_reason;
      if (back.has(key)) return { ok: true, refunded: 0, debited: 2, already: back.get(key), repeat: true };
      back.set(key, 2);
      return { ok: true, refunded: 2, already: 0, debited: 2, repeat: false };
    },
  };
}

async function tick(b, id, led, { now = Date.parse("2026-10-08T12:00:00Z") } = {}) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const row = { id, uid: BUILD_USER.id, slug: SLUG, op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) return json(led.answer(JSON.parse(String((init && init.body) || "{}"))));
    if (u.includes("/rest/v1/edit_jobs")) return json([row]);
    return json([]);
  };
  try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now }); }
  finally { globalThis.fetch = real; }
}
function answerOf(b, id) {
  const raw = b.store.get(resultKey(id));
  if (!raw) return null;
  const r = readResult(JSON.parse(raw));
  return { status: r.status, body: JSON.parse(r.body) };
}
const pending = (b, id) => b.store.has("recovery/pending/" + id);

// ── 1: the protocol survives the consumed envelope ─────────────────────────

test("1: a staged-only build of the fenced protocol, consumed by the real consumer, is recovered as NOT published and refunded in full", async () => {
  const id = newId();
  const b = buildBucket();
  await consume(b, id, packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: BUILD_USER.id, at: 1 }));
  assert.equal(b.store.has(jobMetaKey(id)), true, "the protocol record was not kept before the envelope went");
  assert.doesNotMatch(b.store.get(jobMetaKey(id)), /Bearer|auth|body/, "the protocol record carries the request");
  await stageOnly(b, id);
  const led = ledger();
  await tick(b, id, led);
  const a = answerOf(b, id);
  assert.ok(a, "no answer was stored: the consumed envelope left the job unknown (Codex's reproduction)");
  assert.equal(a.body.page, "placeholder");
  assert.equal(a.body.refunded, 6);
  assert.equal(pending(b, id), false);
});

test("1: a successful publication through the same lifecycle keeps what it charged and says the site is live", async () => {
  const id = newId();
  const b = buildBucket();
  await consume(b, id, packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: BUILD_USER.id, at: 1 }));
  await publish(b, id);
  const led = ledger();
  await tick(b, id, led);
  const a = answerOf(b, id);
  assert.equal(a.body.ok, true);
  assert.equal(a.body.page, "app");
  assert.equal(a.body.version, V2);
  assert.deepEqual(led.calls, [], "a published build was refunded");
});

test("1: a publish that claimed and left no record stays UNKNOWN through the same lifecycle — nothing moved, no answer, still listed, every tick", async () => {
  const id = newId();
  const b = buildBucket();
  await consume(b, id, packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: BUILD_USER.id, at: 1 }));
  await claimOnly(b, id);
  const led = ledger();
  for (let t = 0; t < 3; t++) await tick(b, id, led);
  assert.equal(answerOf(b, id), null);
  assert.deepEqual(led.calls, []);
  assert.equal(pending(b, id), true);
});

test("1: an OLDER envelope (no fenced flag), consumed the same way, is never guessed to be fenced — its staged-only build stays unknown", async () => {
  const id = newId();
  const b = buildBucket();
  const older = packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: BUILD_USER.id, at: 1 });
  delete older.fenced;
  await consume(b, id, older);
  assert.equal(JSON.parse(b.store.get(jobMetaKey(id))).fenced, false, "an older envelope was recorded as fenced");
  await stageOnly(b, id);
  const led = ledger();
  await tick(b, id, led);
  assert.equal(answerOf(b, id), null);
  assert.deepEqual(led.calls, []);
  assert.equal(pending(b, id), true);
});

test("1: no protocol record at all (one that could not be written, or a job from before it existed) is unknown, never fenced", async () => {
  const id = newId();
  const b = buildBucket({}, { beforePut: async (k) => { if (k.endsWith(".meta.json")) throw new Error("r2 down"); } });
  await consume(b, id, packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: BUILD_USER.id, at: 1 }));
  assert.equal(b.store.has(jobMetaKey(id)), false);
  await stageOnly(b, id);
  const led = ledger();
  await tick(b, id, led);
  assert.equal(answerOf(b, id), null, "a missing record was guessed to be the new protocol");
  assert.equal(pending(b, id), true);
});

// ── 2: money and delivery recorded apart ───────────────────────────────────

async function lostStaged() {
  const id = newId();
  const b = buildBucket();
  await consume(b, id, packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: BUILD_USER.id, at: 1 }));
  await stageOnly(b, id);
  return { id, b };
}
/** Fail the next `n` writes of the keys `match` picks — a crash or an outage between two steps. */
function failNext(b, match, n = 1) {
  const put = b.put.bind(b);
  let left = n;
  b.put = async (k, v, o) => { if (left > 0 && match(k, v)) { left--; throw new Error("r2 down"); } return put(k, v, o); };
}

test("2: the answer write fails after the refund (Codex's injection) — the next tick stores it, with the full amount, and refunds nothing again", async () => {
  const { id, b } = await lostStaged();
  const led = ledger();
  failNext(b, (k) => k === resultKey(id));
  await tick(b, id, led);
  assert.equal(answerOf(b, id), null);
  assert.equal(pending(b, id), true, "an undelivered answer was dropped from the pending list");
  const firstRefunds = led.calls.length;
  await tick(b, id, led);
  const a = answerOf(b, id);
  assert.ok(a, "the missing answer was never repaired");
  assert.equal(a.body.refunded, 6);
  assert.equal(led.calls.length, firstRefunds, "the refund was asked again");
  assert.equal(pending(b, id), false);
});

test("2: a crash between the refund and the settlement record — the next pass refunds idempotently and still reports the full amount", async () => {
  const { id, b } = await lostStaged();
  const led = ledger();
  failNext(b, (k) => k.endsWith(".lost.json"));
  await tick(b, id, led);
  assert.equal(answerOf(b, id), null);
  assert.equal(pending(b, id), true);
  await tick(b, id, led);
  const a = answerOf(b, id);
  assert.equal(a.body.refunded, 6, "after the restart the answer said less than came back: " + a.body.refunded);
  assert.match(a.body.msg, /\(6 credits\) has been returned/);
});

test("2: a crash after the answer and before its delivery is recorded — the next tick records it without changing the answer", async () => {
  const { id, b } = await lostStaged();
  const led = ledger();
  failNext(b, (k, v) => k.endsWith(".lost.json") && String(v).includes('"delivered":true'));
  await tick(b, id, led);
  const first = b.store.get(resultKey(id));
  assert.ok(first);
  assert.equal(pending(b, id), true);
  await tick(b, id, led);
  assert.equal(JSON.parse(b.store.get(resultKey(id))).body, JSON.parse(first).body, "the delivered answer changed");
  assert.equal(JSON.parse(b.store.get("jobs/" + id + ".lost.json")).delivered, true);
  assert.equal(pending(b, id), false);
});

test("2: a pending clean-up that fails is finished next tick; a collected answer is never rewritten; repeated ticks move nothing", async () => {
  const { id, b } = await lostStaged();
  const led = ledger();
  const del = b.delete.bind(b);
  let once = true;
  b.delete = async (k) => { if (once && k === "recovery/pending/" + id) { once = false; throw new Error("r2 down"); } return del(k); };
  await tick(b, id, led);
  assert.equal(pending(b, id), true);
  b.store.delete(resultKey(id)); // the browser collected it
  const calls = led.calls.length;
  for (let t = 0; t < 3; t++) await tick(b, id, led);
  assert.equal(pending(b, id), false);
  assert.equal(answerOf(b, id), null, "a collected answer was written again");
  assert.equal(led.calls.length, calls);
});

test("2: a newer authoritative answer — the build's own — is never overwritten by recovery's delivery", async () => {
  const { id, b } = await lostStaged();
  const led = ledger();
  failNext(b, (k) => k === resultKey(id));
  await tick(b, id, led);
  const own = JSON.stringify({ v: 1, status: 200, type: "application/json", uid: BUILD_USER.id, body: JSON.stringify({ ok: true, page: "app", slug: SLUG }) });
  b.store.set(resultKey(id), own);
  await tick(b, id, led);
  assert.equal(b.store.get(resultKey(id)), own, "recovery overwrote the build's own answer");
  assert.equal(pending(b, id), false);
});

test("2: a short refund is said, kept pending, and the finished refund replaces recovery's own earlier answer with the full amount", async () => {
  const { id, b } = await lostStaged();
  let down = true;
  const led = ledger();
  const wrapped = { calls: led.calls, answer: (a) => (down ? { ok: false } : led.answer(a)) };
  await tick(b, id, wrapped);
  assert.equal(answerOf(b, id).body.refundShort, true);
  assert.equal(pending(b, id), true);
  down = false;
  await tick(b, id, wrapped);
  const a = answerOf(b, id);
  assert.equal(a.body.refunded, 6);
  assert.equal(a.body.refundShort, undefined);
  assert.equal(pending(b, id), false);
});

test("1: the protocol record is written once — a later consumer of an envelope without the flag cannot change what the producer recorded", async () => {
  const id = newId();
  const b = buildBucket({ [jobMetaKey(id)]: JSON.stringify({ v: 1, fenced: true }) });
  const older = packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: BUILD_USER.id, at: 1 });
  delete older.fenced;
  await consume(b, id, older);
  assert.equal(JSON.parse(b.store.get(jobMetaKey(id))).fenced, true, "a later writer overwrote the record");
});

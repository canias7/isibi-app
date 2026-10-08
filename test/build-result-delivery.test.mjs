// A RECOVERED BUILD'S ANSWER, THROUGH THE REAL PRODUCER, CONSUMER AND RESUME
// (2026-10-08, Codex's review of `deb1fee5`).
//
// Two connected delivery defects, reproduced through what production stores:
//
//   1  the real queue consumer stores a 202 `stage: "resuming"` answer when it
//      fires a generation. Recovery took ANY stored answer that was not its
//      own for the build's newer authoritative one, so after it refunded the
//      lost build it kept the "still building" reply, recorded the answer as
//      delivered and dropped the job from pending — the customer never heard
//      the outcome (Codex's persisted state). Stored answers are now judged
//      by kind (`resultKind`): interim, recovery, terminal, unreadable.
//   2  delivery read the slot and then wrote unconditionally, so a final
//      answer landing between the two was overwritten. Every delivery write
//      is now conditional on what was read; a refused write reads the slot
//      again and judges it again. And the consumer's own "still building"
//      answer is written only into an empty slot, so it never lands over an
//      answer that is already there.
//
// THE LIFECYCLE, ALL REAL CODE: the producer's envelope (`packJob`) consumed
// by `worker.queue`, which designs (a supplied design answer), provisions
// nothing, fires the generation at a container stand-in that accepts it, and
// stores its real 202; the browser is closed (nobody collects it); the final
// answer, when there is one, is the real resume's (`RESUME_KIND` through
// `worker.queue` with a finished generation stored); recovery
// (`reconcileLostBuilds`) runs on the lost row, repeatedly, with writes
// failed or interleaved between its steps.
//
// THE LEDGER IS A STAND-IN, NOT A DATABASE. It answers `credit_reverse` as
// the applied SQL does — bounded by what the ref debited across every
// reason, a repeat of the same ref and reason gives nothing new and says
// what came back before — and it is shared by the build and recovery, so
// "no duplicate refund" is read off its totals. No Postgres transaction runs.

import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, BUILD_USER, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { resultKey, packResult, readResult, resultKind } from "../builder/build-job.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";

const SLUG = GOOD_DESIGN.slug;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "d2c3d4e5f60718293a4b5c6d7e8f9";

/** One recovery pass over the lost row. */
async function tick(b, id, led) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const row = { id, uid: BUILD_USER.id, slug: SLUG, op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) return json(led.answer(JSON.parse(String((init && init.body) || "{}"))));
    if (u.includes("/rest/v1/edit_jobs")) return json([row]);
    return json([]);
  };
  try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now: Date.parse("2026-10-08T12:00:00Z") }); }
  finally { globalThis.fetch = real; }
}

const stored = (b, id) => { const raw = b.store.get(resultKey(id)); return raw ? JSON.parse(raw) : null; };
const answerOf = (b, id) => { const raw = stored(b, id); if (!raw) return null; const r = readResult(raw); return { status: r.status, body: JSON.parse(r.body), kind: resultKind(raw) }; };
const settlement = (b, id) => JSON.parse(b.store.get("jobs/" + id + ".lost.json") || "null");
const pending = (b, id) => b.store.has("recovery/pending/" + id);
const refundsBy = (led, reason) => led.calls.filter((c) => c.endsWith("|" + reason)).length;

/** Hold the first write of `match` until released; `reached` resolves when it is held, `landed` when it has been written. */
function hold(b, match) {
  const put = b.put.bind(b);
  let release, reachedR, landedR;
  const gate = new Promise((r) => { release = r; });
  const reached = new Promise((r) => { reachedR = r; });
  const landed = new Promise((r) => { landedR = r; });
  let armed = true;
  b.put = async (k, v, o) => {
    if (armed && match(k, v)) {
      armed = false;
      reachedR();
      await gate;
      const out = await put(k, v, o);
      landedR(out);
      return out;
    }
    return put(k, v, o);
  };
  return { reached, landed, release: () => release() };
}
function failNext(b, match, n = 1) {
  const put = b.put.bind(b);
  let left = n;
  b.put = async (k, v, o) => { if (left > 0 && match(k, v)) { left--; throw new Error("r2 down"); } return put(k, v, o); };
}
const isRecoveryAnswer = (id) => (k, v) => k === resultKey(id) && String(v).includes('\\"lost\\":true');

// ── the kinds ──────────────────────────────────────────────────────────────

test("resultKind: the consumer's 202 is interim, recovery's is recovery, a build's own answers are terminal, junk is unreadable", () => {
  const r = (status, body) => packResult({ status, type: "application/json", uid: "u", body: JSON.stringify(body) });
  assert.equal(resultKind(r(202, { ok: false, stage: "resuming", slug: SLUG })), "interim");
  assert.equal(resultKind(r(200, { ok: false, lost: true, refunded: 6 })), "recovery");
  assert.equal(resultKind(r(200, { ok: true, slug: SLUG, page: "app" })), "terminal");
  assert.equal(resultKind(r(500, { ok: false, stage: "queue", error: "the build failed" })), "terminal");
  assert.equal(resultKind(r(409, { ok: false, error: "site-busy" })), "terminal");
  assert.equal(resultKind(r(202, { ok: true })), "terminal", "a 202 without the resuming stage is an answered build, as the row reads it");
  assert.equal(resultKind({ v: 1, status: 200, type: "application/json", body: "not json" }), "unreadable");
  assert.equal(resultKind(null), "unreadable");
});

// ── 1: a "still building" answer is not delivery ───────────────────────────

test("1 (Codex's reproduction): the real consumer's 202, browser closed, job lost — recovery refunds once and REPLACES the interim answer with the outcome; repeated ticks move nothing", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  const q = await fireInterim(b, id, led);
  assert.equal(answerOf(b, id).kind, "interim", "the consumer did not store its real 202: " + JSON.stringify(answerOf(b, id)));
  assert.equal(answerOf(b, id).status, 202);
  assert.ok(q.sent.length, "the generation was never fired");
  for (let t = 0; t < 3; t++) await tick(b, id, led);
  const a = answerOf(b, id);
  assert.equal(a.kind, "recovery", "the \"still building\" answer was kept as the build's outcome: " + JSON.stringify(a.body));
  assert.equal(a.body.page, "placeholder");
  assert.equal(a.body.refunded, 6);
  assert.match(a.body.msg, /\(6 credits\) has been returned/);
  const s = settlement(b, id);
  assert.equal(s.delivered, true);
  assert.equal(s.deliveredAs, "recovery");
  assert.equal(pending(b, id), false);
  assert.equal(refundsBy(led, "lost"), 3, "the refund was asked more than once per ref");
  // WHAT CAME BACK IN ALL, the build's own settle of its deposit included:
  // every ref's whole debit, never more, and the answer says that total.
  assert.equal(led.total(), 6);
  for (const [ref, n] of led.given) assert.equal(n, 2, ref);
});

test("1: the interim answer's replacement fails — kept pending, replaced on the next tick, refunded once", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  failNext(b, isRecoveryAnswer(id));
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "interim");
  assert.equal(settlement(b, id).delivered, false);
  assert.equal(pending(b, id), true, "an undelivered outcome was dropped from pending");
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "recovery");
  assert.equal(answerOf(b, id).body.refunded, 6);
  assert.equal(pending(b, id), false);
  assert.equal(refundsBy(led, "lost"), 3);
});

test("1: the delivery record fails after the interim is replaced — the next tick records it, the answer unchanged, no second refund", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  failNext(b, (k, v) => k.endsWith(".lost.json") && String(v).includes('"delivered":true'));
  await tick(b, id, led);
  const first = b.store.get(resultKey(id));
  assert.equal(answerOf(b, id).kind, "recovery");
  assert.equal(pending(b, id), true);
  await tick(b, id, led);
  assert.equal(b.store.get(resultKey(id)), first);
  assert.equal(settlement(b, id).delivered, true);
  assert.equal(pending(b, id), false);
  assert.equal(refundsBy(led, "lost"), 3);
});

test("1 CONTROL: a browser that was open collected the 202 — recovery stores its answer in the empty slot", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  b.store.delete(resultKey(id)); // the wait read it and deleted it
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "recovery");
  assert.equal(pending(b, id), false);
});

// ── 2: a final answer is never overwritten ─────────────────────────────────

test("2: the real resume's final answer lands BETWEEN delivery's read and its write — the write is refused, the slot judged again, the final kept; money settled once", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  // The resume passed its "recovery owns?" check before recovery claimed the
  // fence, and is held just before it writes its final answer.
  const resumeWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resumed"));
  const resumeRun = finishResume(b, id, led);
  await resumeWrite.reached;
  // Recovery's delivery reads the interim answer; between that read and its
  // write, the held final answer lands.
  const deliveryWrite = hold(b, isRecoveryAnswer(id));
  const tickRun = tick(b, id, led);
  await deliveryWrite.reached;
  resumeWrite.release();
  await resumeWrite.landed;
  deliveryWrite.release();
  await tickRun;
  await resumeRun;
  const a = answerOf(b, id);
  assert.equal(a.kind, "terminal", "recovery overwrote the build's final answer: " + JSON.stringify(a.body).slice(0, 200));
  assert.equal(a.body.resumed, "finish");
  assert.equal(settlement(b, id).delivered, true);
  assert.equal(settlement(b, id).deliveredAs, "build");
  assert.equal(pending(b, id), false);
  for (const [ref, n] of led.given) assert.ok(n <= 2, "ref " + ref + " gave back " + n + ", more than it debited");
  const before = led.calls.length;
  for (let t = 0; t < 2; t++) await tick(b, id, led);
  assert.equal(led.calls.length, before, "a later tick asked for money again");
  assert.equal(answerOf(b, id).kind, "terminal");
});

test("2: a final answer stored before recovery runs is kept, never replaced, and counts as delivered", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  await finishResume(b, id, led);
  const final = b.store.get(resultKey(id));
  assert.equal(answerOf(b, id).kind, "terminal");
  for (let t = 0; t < 2; t++) await tick(b, id, led);
  // KEPT, AND GIVEN THE SETTLEMENT FACTS (2026-10-08, the sixth batch): every
  // field the build wrote is unchanged; the refund recovery recorded is added.
  const was = JSON.parse(readResult(JSON.parse(final)).body);
  const now = answerOf(b, id);
  for (const [k, v] of Object.entries(was)) if (k !== "refunded" && k !== "refundShort") assert.deepEqual(now.body[k], v, k);
  assert.ok(settled6(now));
  assert.equal(settlement(b, id).deliveredAs, "build");
  assert.equal(pending(b, id), false);
});

test("2: the consumer's \"still building\" answer arriving AFTER recovery delivered never lands over the outcome", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  // The consumer passed its "recovery owns?" check and is held just before
  // it writes its 202; recovery runs to completion meanwhile.
  const interimWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resuming"));
  const consumer = fireInterim(b, id, led);
  await interimWrite.reached;
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "recovery");
  interimWrite.release();
  await consumer;
  assert.equal(await interimWrite.landed, null, "the interim write was not refused");
  assert.equal(answerOf(b, id).kind, "recovery", "a stale \"still building\" answer replaced the recovered outcome");
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "recovery");
});

test("2: delivery's conditional write is refused every time (a slot that keeps moving) — kept pending, never written blind, finished when it settles", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const put = b.put.bind(b);
  let churn = 7;
  b.put = async (k, v, o) => {
    if (churn > 0 && isRecoveryAnswer(id)(k, v)) {
      churn--;
      // another interim write moves the etag between the read and this write
      await put(k, b.store.get(resultKey(id)));
    }
    return put(k, v, o);
  };
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "interim", "a contended slot was written without its condition");
  assert.equal(pending(b, id), true);
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "recovery");
  assert.equal(pending(b, id), false);
  assert.equal(refundsBy(led, "lost"), 3);
});

// ── 3: one protocol for every writer — either order ends the same ──────────
//
// Codex's review of `366dc581`: the real resume held immediately before its
// final write, recovery allowed to finish (refund of 6, deliveredAs
// "recovery"), then the resume released — its unconditional write replaced
// recovery's answer and the refund with it, and later ticks left it. Now every
// writer applies one rule (`nextResult`) and writes conditionally: the build's
// final answer is the authority on publication, recovery's record on money,
// and the slot ends holding both, whichever wrote first.

const settled6 = (a) => a && a.body && a.body.settlement && a.body.settlement.refunded === 6 && a.body.refunded === 6;

test("3 (Codex's order): the resume held before its final write, recovery finishes first, the resume released — the final answer keeps the refund; later ticks agree and move no money", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const resumeWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resumed"));
  const resumeRun = finishResume(b, id, led);
  await resumeWrite.reached;
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "recovery");
  assert.equal(settlement(b, id).deliveredAs, "recovery");
  resumeWrite.release();
  await resumeRun;
  const a = answerOf(b, id);
  assert.equal(a.kind, "terminal", "the build's final answer did not land: " + JSON.stringify(a.body).slice(0, 200));
  assert.equal(a.body.resumed, "finish");
  assert.ok(settled6(a), "the final answer dropped the recorded refund: " + JSON.stringify(a.body.settlement || null));
  const before = led.calls.length;
  const after = b.store.get(resultKey(id));
  for (let t = 0; t < 2; t++) await tick(b, id, led);
  assert.equal(led.calls.length, before, "a later tick asked for money again");
  assert.equal(b.store.get(resultKey(id)), after, "a later tick changed a consistent answer");
});

test("3 (the other order): the resume past its check, recovery held at its write, the final lands first — recovery's write is refused, re-judged, and adds its refund to the final answer", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const resumeWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resumed"));
  const resumeRun = finishResume(b, id, led);
  await resumeWrite.reached;
  const deliveryWrite = hold(b, isRecoveryAnswer(id));
  const tickRun = tick(b, id, led);
  await deliveryWrite.reached;
  resumeWrite.release();
  await resumeRun;
  deliveryWrite.release();
  await tickRun;
  const a = answerOf(b, id);
  assert.equal(a.kind, "terminal");
  assert.equal(a.body.resumed, "finish");
  assert.ok(settled6(a), "the final answer lacks the refund: " + JSON.stringify(a.body.settlement || null));
  assert.equal(settlement(b, id).deliveredAs, "build");
  assert.equal(pending(b, id), false);
});

test("3 CONTROL: recovery claimed the outcome before the resume's check — the late resume writes nothing, and recovery's answer with its refund stands", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  await tick(b, id, led);
  await finishResume(b, id, led);
  const a = answerOf(b, id);
  assert.equal(a.kind, "recovery");
  assert.equal(a.body.refunded, 6);
});

test("3: a closed browser and a final answer stored before recovery — recovery adds its settlement facts to it once, keeps every field the build wrote, and is idle after", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  await finishResume(b, id, led);
  const own = JSON.parse(readResult(JSON.parse(b.store.get(resultKey(id)))).body);
  await tick(b, id, led);
  const a = answerOf(b, id);
  for (const [k, v] of Object.entries(own)) if (k !== "refunded" && k !== "refundShort") assert.deepEqual(a.body[k], v, "the build's own field " + k + " changed");
  assert.ok(settled6(a));
  const once = b.store.get(resultKey(id));
  await tick(b, id, led);
  assert.equal(b.store.get(resultKey(id)), once);
});

test("3: the queue consumer's own final answer (a build that ended before firing) racing recovery — either order ends with the answer and the refund", async () => {
  for (const order of ["consumer-held", "recovery-held"]) {
    const id = newId();
    const b = buildBucket();
    const led = ledger();
    if (order === "consumer-held") {
      const w = hold(b, (k, v) => k === resultKey(id) && !String(v).includes('\\"lost\\":true'));
      const run = fireInterim(b, id, led, { design: null });
      await w.reached;
      await tick(b, id, led);
      w.release();
      await run;
    } else {
      const w = hold(b, isRecoveryAnswer(id));
      // the consumer's terminal answer must exist before recovery's write lands
      const t = (async () => { await new Promise((r) => setTimeout(r, 0)); })();
      await fireInterim(b, id, led, { design: null });
      const tickRun = tick(b, id, led);
      await Promise.race([w.reached, tickRun]);
      w.release();
      await tickRun;
      await t;
    }
    const a = answerOf(b, id);
    assert.equal(a.kind, "terminal", order + ": " + JSON.stringify(a.body).slice(0, 200));
    assert.equal(a.body.settlement && a.body.settlement.outcome, "not-published", order);
    assert.equal(a.body.settlement.recovered, true, order);
  }
});

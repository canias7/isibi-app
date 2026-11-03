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

// THE FINISHED ANSWER WAKES ITS OWN COLLECTOR (2026-09-10).
//
// WHY THIS FILE EXISTS. `RESUME_FIRST_SECONDS` schedules the collector's first
// look 240 s after the fire, and its own comment gave the reason: five measured
// samples of one brief, 333,716–619,822 ms, so nothing had ever come back
// inside four minutes. The band split made that false — `kestrel-bindery`'s
// seven bands answered in 93,375 ms — so a finished page sat idle for ~147 s
// waiting for a look scheduled for a world where the answer could not exist.
// MEASURED as ~253 s of unaccounted wall clock on four consecutive builds
// (253,290 / 252,403 / 256,150 / 260,826) and ~506 s on a fifth.
//
// The fix is one enqueue in `/api/site/genresult`, and every property worth
// having about it is a property of a REQUEST rather than of the text: whether
// the wake happens, whether it happens only for a report we can bind, whether
// it happens only once the answer is safe, and whether a queue that throws can
// cost the container its answer. So this file DRIVES the real route through
// `worker.fetch` with a recording queue, and drives the two walls that make a
// second message harmless — because the second message is not an accident any
// more, it is what every build now produces.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit, loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { RESUME_FIRST_SECONDS, packResume, packResumeMessage, resumeKey, genKey } from "../builder/build-resume.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const RESUME_SRC = fs.readFileSync(new URL("../builder/build-resume.mjs", import.meta.url), "utf8");

const USER = { id: "11111111-2222-4333-8444-555555555555", email: "owner@example.test" };
const ENV_KEYS = { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };
const JOB = "fedcba9876543210fedcba9876543210";
const TOKEN = "0123456789abcdef0123456789abcdef";

// DERIVED FROM ITS REAL PRODUCER, never hand-typed — a stored record is what
// `packResume` writes, and a second copy of that shape drifts silently.
const RECORD = packResume({
  id: JOB, auth: "Bearer x", uid: USER.id, slug: "fold-lane", lane: "build-k-fold-lane",
  genId: "gen-1", report: TOKEN, firedAt: Date.now(), charged: ["deposit", "schema"], design: { brand: "Fold" },
});

/** An R2 stand-in over a Map. `failPut` is how "the answer did not land" is driven. */
function bucket(entries = {}, { failPut = false } = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    get: async (k) => (store.has(k) ? { text: async () => store.get(k), etag: "e1" } : null),
    put: async (k, v) => { if (failPut) throw new Error("r2 down"); store.set(k, String(v)); return {}; },
    delete: async (k) => { store.delete(k); },
  };
}

/** A queue that records what it was asked to send. `throws` drives the best-effort wall. */
function queue({ throws = false } = {}) {
  const sent = [];
  return { sent, send: async (body, opts) => { if (throws) throw new Error("queue down"); sent.push({ body, opts }); } };
}

/** Every fetch the Worker makes on this path: the RPCs answer ok, nothing else matters. */
function stubFetch() {
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (/\/rest\/v1\/rpc\//.test(u)) return json({ ok: true, state: "generating", owner: "container:gen-1" });
    return json([]);
  };
  return () => { globalThis.fetch = real; };
}

const REPORT = (body, env) => hit("/api/site/genresult", {
  method: "POST", headers: { "x-gen-report": TOKEN }, body: JSON.stringify(body), env,
});

const DONE = { state: "done", answer: { content: [] }, job: JOB, gen: "gen-1" };
const withRecord = () => ({ [resumeKey(JOB)]: JSON.stringify(RECORD) });

// ── DRIVEN: THE WAKE ─────────────────────────────────────────────────────────

test("a bound report wakes its collector, immediately and exactly once", async () => {
  const restore = stubFetch();
  try {
    const b = bucket(withRecord());
    const q = queue();
    const r = await REPORT(DONE, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: q });

    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { ok: true }, "the report's answer grew a field — the container needs one bit");
    assert.equal(q.sent.length, 1, `the answer did not wake its collector (${q.sent.length} sends)`);

    // THE MESSAGE IS THE COLLECTOR'S OWN, derived rather than retyped: a message
    // the consumer cannot dispatch on is dropped with a log line and no build.
    assert.deepEqual(q.sent[0].body, packResumeMessage(JOB), "the wake is not the resume message the consumer reads");

    // AND WITH NO DELAY. This is the whole change — a wake scheduled minutes out
    // is the 240 s timer wearing a different name.
    const delay = q.sent[0].opts && q.sent[0].opts.delaySeconds;
    assert.ok(!delay, `the wake was scheduled ${delay}s out — it must fire now, the answer is already in R2`);
  } finally { restore(); }
});

test("the wake comes after the answer is safe: a store that fails answers 503 and wakes nobody", async () => {
  const restore = stubFetch();
  try {
    const q = queue();
    const r = await REPORT(DONE, { ...ENV_KEYS, SITES_BUCKET: bucket(withRecord(), { failPut: true }), BUILD_QUEUE: q });

    // The pre-existing contract: a failed write must NOT answer 200, or the
    // container drops an answer nothing else holds.
    assert.equal(r.status, 503, `a failed store answered ${r.status}`);
    // AND THE ORDERING THAT MATTERS: a collector woken before the answer is
    // stored looks, finds nothing, and reads a finished generation as pending.
    assert.deepEqual(q.sent, [], "a collector was woken for an answer that was never stored");
  } finally { restore(); }
});

test("only a report we can bind wakes anything — the job id is proved, never taken from the caller", async () => {
  for (const [why, body, entries] of [
    ["a report naming nothing (an older image, the inline path)", { state: "done", answer: { content: [] } }, withRecord()],
    ["another generation's container", { state: "failed", message: "x", job: JOB, gen: "gen-9" }, withRecord()],
    ["no record to bind against", { state: "done", answer: {}, job: JOB, gen: "gen-1" }, {}],
    ["a malformed job id", { state: "done", answer: {}, job: "nope", gen: "gen-1" }, withRecord()],
  ]) {
    const restore = stubFetch();
    try {
      const b = bucket(entries);
      const q = queue();
      const r = await REPORT(body, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: q });
      // The answer still lands — it is stored under the TOKEN, which was checked.
      assert.equal(r.status, 200, `${why}: ${r.status}`);
      assert.ok(b.store.has(genKey(TOKEN)), `${why}: the answer did not land`);
      assert.deepEqual(q.sent, [], `${why} woke a collector for a job it had not proved`);
    } finally { restore(); }
  }
});

test("a queue that throws still answers the container 200 — the wake is best-effort and the belt is already queued", async () => {
  const restore = stubFetch();
  try {
    const b = bucket(withRecord());
    const r = await REPORT(DONE, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: queue({ throws: true }) });
    assert.equal(r.status, 200, "a failed wake told the container its answer did not land");
    assert.ok(b.store.has(genKey(TOKEN)), "a failed wake cost the answer");
  } finally { restore(); }
});

test("…and so does a Worker with no queue binding at all", async () => {
  const restore = stubFetch();
  try {
    const b = bucket(withRecord());
    const r = await REPORT(DONE, { ...ENV_KEYS, SITES_BUCKET: b });
    assert.equal(r.status, 200, "an absent binding failed a delivered answer");
    assert.ok(b.store.has(genKey(TOKEN)), "an absent binding cost the answer");
  } finally { restore(); }
});

// ── THE BELT IS STILL THERE ──────────────────────────────────────────────────

test("the scheduled look is NOT removed — it covers what a wake cannot", () => {
  // A container that dies after generating and before posting, and a report that
  // arrives with no binding, both reach the collector only this way. Deleting
  // the belt would trade four minutes for a lost build.
  assert.match(
    WORKER,
    /BUILD_QUEUE\.send\(packResumeMessage\(jobId\), \{ delaySeconds: queueDelay\(RESUME_FIRST_SECONDS\) \}\)/,
    "the fire no longer schedules the fallback look",
  );
  assert.equal(RESUME_FIRST_SECONDS, 240, "the fallback's first look moved — deliberate, or a guess about today's generation?");

  // AND THE CONSTANT'S OWN REASONING IS CORRECTED RATHER THAN LEFT STANDING.
  // "the answer cannot possibly be ready sooner" was measured and true, and the
  // band split falsified it; a comment that still claims it is what sends the
  // next session looking for a defect somewhere else.
  const at = RESUME_SRC.indexOf("export const RESUME_FIRST_SECONDS");
  assert.ok(at > 0, "RESUME_FIRST_SECONDS is gone");
  const why = RESUME_SRC.slice(Math.max(0, at - 1800), at);
  assert.doesNotMatch(why, /cannot possibly be\s+\/\/ ready sooner\./, "the falsified claim is still stated as fact");
  assert.match(why, /93,375 ms/, "the measurement that falsified it is not recorded beside it");
  assert.match(why, /FALLBACK/, "the constant does not say it is no longer the ordinary path");
});

// ── DRIVEN: WHY A SECOND MESSAGE IS HARMLESS ─────────────────────────────────
//
// Every build now produces TWO resume messages — the wake and the belt — so the
// walls that make the loser a no-op stopped being a redelivery edge case and
// became load-bearing. Both are pre-existing; neither had a driver here.

async function collect(entries) {
  const restore = stubFetch();
  try {
    const b = bucket(entries);
    const worker = await loadWorker();
    const ctx = makeCtx();
    let acked = 0;
    await worker.queue(
      { messages: [{ body: packResumeMessage(JOB), ack() { acked++; } }] },
      { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: queue() },
      ctx,
    );
    await Promise.allSettled(ctx.pending);
    return { acked, store: b.store };
  } finally { restore(); }
}

test("the second message finds no record — the first look deletes its own — and does nothing", async () => {
  const r = await collect({});
  assert.equal(r.acked, 1, "a resume with nothing to pick up was not acked");
});

test("…and a record whose paid half already ran is refused and cleared, never charged twice", async () => {
  const spent = packResume({ ...RECORD, charged: ["deposit", "schema", "pages"] });
  const r = await collect({ [resumeKey(JOB)]: JSON.stringify(spent) });
  assert.equal(r.acked, 1);
  assert.ok(!r.store.has(resumeKey(JOB)), "a record whose paid half ran was left for a third look to find");
});

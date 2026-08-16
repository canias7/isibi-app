// Webhook delivery that outlives the request that produced it.
//
// WHAT THE IN-REQUEST LADDER COULD NOT DO. `deliverWebhook` retries up to three
// times inside the `waitUntil` of the write that triggered it, which closes the
// transient case — a receiver that blinks for a second — and nothing else. Two
// failures survive it, and both are ordinary rather than exotic: the isolate is
// evicted mid-ladder (Cloudflare reclaims them constantly, and a detached
// promise dies with the context), and a receiver that is down for MINUTES,
// which is what a deploy or a restart on their side looks like. In both the
// event is simply gone, and the owner finds out from a customer.
//
// SO THE QUEUE IS NOT AN OPTIMISATION OF THE LADDER, it is the part that makes
// delivery a promise rather than an attempt. The ladder stays: it is the fast
// path, it costs no writes, and the overwhelming majority of deliveries succeed
// on the first attempt. Only a delivery that fails RETRYABLY is written down.
//
// THE SHAPE IS `neon_teardown`'S, deliberately — one platform table, drained by
// the existing 2-minute cron, escalating backoff, a row that stays visible with
// its last error. That module is the precedent for "this must happen eventually
// and the only record of it is a row".
//
// Every decision here is a pure function over injected side effects, so the two
// cases that actually matter — two cron ticks overlapping, and a worker dying
// with a row half-delivered — are driven in tests with no database, no clock and
// no network.

/** Attempts before a row is dead-lettered. The in-request ladder is not counted. */
export const MAX_ATTEMPTS = 8;
/** First backoff step. Doubles from here. */
export const BASE_DELAY_MS = 30_000;
/** Never wait longer than this between attempts, however many have failed. */
export const MAX_DELAY_MS = 6 * 60 * 60 * 1000;
/**
 * How long a claim is good for.
 *
 * THIS IS THE WORKER-DIED ANSWER. A claim marks the row `delivering`; if the
 * isolate vanishes between the claim and the result, nothing ever writes the
 * outcome and the row would sit `delivering` for ever — the queue silently
 * losing exactly the event it exists to protect. A claim older than the lease
 * is therefore reclaimable by the next tick.
 *
 * Longer than any single delivery can take (5s timeout x 3 attempts plus
 * backoff) and short enough that one lost isolate costs minutes, not hours.
 */
export const LEASE_MS = 120_000;
/** Rows drained per tick. Bounds one busy site's effect on every other. */
export const MAX_PER_TICK = 20;

/**
 * The four states, NOT exported individually and that is deliberate.
 *
 * `DONE`, `PENDING`, `DEAD` and `DELIVERING` are four of the most ordinary
 * words a codebase contains, and `test/worker-imports.test.mjs` scans for
 * UPPER_SNAKE names a site module exports being used without being imported.
 * Exported bare, `DONE` matched the SSE sentinel `"[DONE]"` in worker.js and
 * the guard correctly reported a name it could not see an import for — a false
 * alarm on perfectly good code, caused entirely by this file claiming a word.
 *
 * Making the scanner string-aware was the other option and is the wrong one:
 * this repo already deleted a string-blanking scanner once, because hand-lexing
 * nested templates got it wrong and an over-blanking scan HIDES real code, which
 * is the direction that costs a bug rather than a false alarm.
 *
 * So the states live behind one namespaced object. Nothing outside needs them
 * individually anyway.
 */
export const STATUS = Object.freeze({
  pending: "pending",
  delivering: "delivering",
  done: "done",
  dead: "dead",
});
const PENDING = STATUS.pending;
const DELIVERING = STATUS.delivering;
const DONE = STATUS.done;
const DEAD = STATUS.dead;

/**
 * How long before the next attempt, with jitter.
 *
 * EXPONENTIAL because a receiver that is down is usually down for a while, and
 * hammering it every thirty seconds helps nobody. JITTERED because without it
 * every event queued during one outage retries at the SAME INSTANT when the
 * outage ends — a thundering herd aimed at a server that has just come back up,
 * from the one system that should be being gentle with it.
 *
 * The jitter is +/-25% rather than the full "decorrelated" spread: the point is
 * to smear a burst across a window, and a delay that can collapse to nearly
 * zero re-creates the herd it exists to prevent.
 *
 * `rand` is injected so a test can pin it. A backoff nobody can reproduce is a
 * backoff nobody can assert.
 */
export function nextDelay(attempts, rand = Math.random) {
  const n = Math.max(0, Number(attempts) || 0);
  // Capped BEFORE the jitter, so the jitter cannot push a capped delay over the
  // ceiling — a ceiling that the last step can exceed is not a ceiling.
  const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, n));
  const spread = 0.75 + (Number(rand()) || 0) * 0.5;   // 0.75 .. 1.25
  // CLAMPED AFTER THE JITTER TOO, and the first version was not — it capped the
  // base and then multiplied by up to 1.25, so the ceiling could be exceeded by
  // a quarter while the comment above it claimed the opposite. Caught by its own
  // test on the first run. A ceiling the last step can exceed is not a ceiling.
  return Math.min(MAX_DELAY_MS, Math.max(1000, Math.round(base * spread)));
}

/**
 * What to do with a row after one delivery attempt.
 *
 * The classification is `retryable()`'s, passed in rather than re-derived —
 * two readings of "is this worth trying again" is how the queue and the
 * in-request ladder come to disagree about a 429.
 *
 * A PERMANENT REFUSAL IS DEAD IMMEDIATELY, not after eight attempts. A 404 or a
 * 401 is the receiver saying this delivery will never be accepted; retrying it
 * for six hours is load on somebody else's server to reach a conclusion we
 * already have.
 */
export function outcomeFor({ sent, status, attempts, retryable, now, rand = Math.random }) {
  const n = (Number(attempts) || 0) + 1;
  if (sent) return { status: DONE, attempts: n };
  // `status` is null for a throw or a timeout — no answer at all, the most
  // retryable outcome there is.
  if (!retryable(status)) {
    return { status: DEAD, attempts: n, reason: "receiver refused permanently" };
  }
  if (n >= MAX_ATTEMPTS) {
    return { status: DEAD, attempts: n, reason: "gave up after " + n + " attempts" };
  }
  return { status: PENDING, attempts: n, nextAttemptAt: new Date(now + nextDelay(n, rand)).toISOString() };
}

/**
 * May this tick take this row?
 *
 * TWO WAYS IN, and the second is the whole durability story. A `pending` row
 * whose time has come is the ordinary case. A `delivering` row whose claim has
 * expired is a row some earlier tick claimed and never reported on — the worker
 * died — and refusing to reclaim it is how a queue quietly loses events while
 * looking perfectly healthy.
 *
 * `done` and `dead` are never claimable, which is what stops a delivered event
 * being delivered twice.
 */
export function claimable(row, now, leaseMs = LEASE_MS) {
  if (!row) return false;
  const st = String(row.status || "");
  // BELT AND BRACES, and it says so rather than pretending to be load-bearing: a
  // mutation removing this line changes no answer today, because `done` and
  // `dead` match neither branch below and the final `return false` catches
  // them. It is kept because it states the invariant that matters most here —
  // a delivered event is never delivered again — at the top of the function
  // where a fifth status added below cannot accidentally step over it.
  if (st === DONE || st === DEAD) return false;
  if (st === PENDING) return !row.next_attempt_at || Date.parse(row.next_attempt_at) <= now;
  if (st === DELIVERING) {
    const at = Date.parse(row.claimed_at || "");
    // An unparseable or absent claim stamp reads as EXPIRED rather than fresh:
    // the alternative is a row nothing can ever pick up again.
    if (!Number.isFinite(at)) return true;
    return now - at >= leaseMs;
  }
  // An unknown status is not claimable. A typo in a status must not become a
  // row this loop delivers on every tick for ever.
  return false;
}

/**
 * The row to write when enqueuing a failed first attempt.
 *
 * THE BODY IS STORED VERBATIM AND NEVER REBUILT. It is the exact bytes the
 * first attempt sent, and it has to stay that way for two independent reasons:
 * the HMAC is computed over it, so a re-serialised object — different key
 * order, different number formatting — produces a signature the receiver
 * rejects while every hand-built test passes; and the event id lives INSIDE it,
 * so a receiver deduplicating on that id must see the same one every time.
 *
 * The timestamp is deliberately NOT in the body and is recomputed per attempt:
 * it is signed alongside the body so a receiver can refuse a stale replay, and
 * freezing it would make every retry look like a replay of the first.
 */
export function enqueueRow({ eventId, slug, table, action, body, status, error, attempts = 1, now, rand = Math.random }) {
  return {
    event_id: String(eventId),
    slug: String(slug),
    table_name: String(table),
    action: String(action),
    body: String(body),
    status: PENDING,
    attempts: Number(attempts) || 1,
    next_attempt_at: new Date(now + nextDelay(Number(attempts) || 1, rand)).toISOString(),
    last_status: status == null ? null : Number(status),
    last_error: error == null ? null : String(error).slice(0, 200),
  };
}

/**
 * Drain what is due. Never throws — a queue that can take the cron down with it
 * is worse than one that is briefly behind.
 *
 * ONE ROW AT A TIME, CLAIMED CONDITIONALLY. The claim is the only thing between
 * two overlapping ticks and a double delivery, and it is the database that
 * decides it: the update names the row AND the state it expects to find, so of
 * two ticks that both read the row as due, exactly one gets a row back. The
 * loser skips it and moves on rather than waiting, because the winner is
 * already doing the work.
 */
export async function drainQueue(deps, { now, max = MAX_PER_TICK, leaseMs = LEASE_MS, rand = Math.random } = {}) {
  const out = { claimed: 0, delivered: 0, retried: 0, dead: 0, lost: 0, skipped: 0 };
  let rows = [];
  try {
    rows = (await deps.due(now, max)) || [];
  } catch (e) {
    out.error = String((e && e.message) || e).slice(0, 200);
    return out;
  }

  for (const row of rows.slice(0, max)) {
    // Re-checked HERE as well as in the query. The read is a snapshot and the
    // claim below is what actually decides — but a row that has already gone
    // `done` between the two should not cost a write to find out.
    if (!claimable(row, now, leaseMs)) { out.skipped++; continue; }

    let won = false;
    try { won = !!(await deps.claim(row, now)); } catch { won = false; }
    // A CLAIM THAT CANNOT BE RECORDED IS A CLAIM LOST, exactly as in the jobs
    // runner: proceeding unclaimed is how two ticks both deliver.
    if (!won) { out.lost++; continue; }
    out.claimed++;

    let res;
    try {
      res = await deps.deliver(row);
    } catch (e) {
      res = { sent: false, status: null, error: String((e && e.message) || e).slice(0, 200) };
    }

    const next = outcomeFor({
      sent: !!(res && res.sent), status: res && res.status != null ? res.status : null,
      attempts: row.attempts, retryable: deps.retryable, now, rand,
    });

    try {
      await deps.finish(row, {
        status: next.status,
        attempts: next.attempts,
        next_attempt_at: next.nextAttemptAt || null,
        last_status: res && res.status != null ? Number(res.status) : null,
        last_error: next.reason || (res && res.error ? String(res.error).slice(0, 200) : null),
      });
    } catch (e) {
      // The delivery already happened. Losing the note means the lease expires
      // and it is tried again — at-least-once, which is the promise this makes,
      // and why the event id is stable so a receiver can deduplicate.
      out.writeFailed = (out.writeFailed || 0) + 1;
    }

    if (next.status === DONE) out.delivered++;
    else if (next.status === DEAD) out.dead++;
    else out.retried++;
  }
  return out;
}

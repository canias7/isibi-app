// The durable half of outbound webhooks.
//
// The two cases worth the most here are the ones no unit test usually reaches:
// two cron ticks running at the same time, and a worker that dies holding a
// row. Both are driven against a fake store that behaves the way Postgres does
// — a conditional update either matches a row or does not — because that is the
// only property the atomicity actually rests on.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  nextDelay, outcomeFor, claimable, enqueueRow, drainQueue, STATUS,
  MAX_ATTEMPTS, BASE_DELAY_MS, MAX_DELAY_MS, LEASE_MS, MAX_PER_TICK,
} from "../site-webhook-queue.mjs";
import { retryable } from "../site-webhooks.mjs";

/**
 * A store that enforces the ONE property the queue depends on: a claim is a
 * conditional update, so of two callers exactly one can win. Anything looser
 * (a plain `row.status = "delivering"`) makes every concurrency test below
 * pass against an implementation that has no atomicity at all.
 */
function store(rows) {
  const byId = new Map(rows.map((r) => [r.event_id, { ...r }]));
  return {
    rows: byId,
    all: () => [...byId.values()],
    due(now, max) {
      return [...byId.values()].filter((r) => claimable(r, now)).slice(0, max);
    },
    claim(row, now) {
      const cur = byId.get(row.event_id);
      // The WHERE clause, as the database would apply it.
      if (!cur || !claimable(cur, now)) return false;
      cur.status = STATUS.delivering;
      cur.claimed_at = new Date(now).toISOString();
      return true;
    },
    finish(row, patch) {
      const cur = byId.get(row.event_id);
      if (cur) Object.assign(cur, patch, { claimed_at: null });
    },
  };
}
const deps = (st, deliver) => ({
  due: (now, max) => st.due(now, max),
  claim: (row, now) => st.claim(row, now),
  finish: (row, patch) => st.finish(row, patch),
  deliver,
  retryable,
});
const row = (over = {}) => ({
  event_id: "evt_1", slug: "barber", table_name: "bookings", action: "created",
  body: '{"id":"evt_1","site":"barber"}', status: STATUS.pending, attempts: 1,
  next_attempt_at: new Date(0).toISOString(), claimed_at: null, ...over,
});

// ── backoff ────────────────────────────────────────────────────────────────

test("the backoff grows, is capped, and is jittered", () => {
  // Pinned rand, so the shape is assertable rather than approximately observed.
  const mid = () => 0.5;
  const d0 = nextDelay(0, mid), d1 = nextDelay(1, mid), d2 = nextDelay(2, mid);
  assert.equal(d0, BASE_DELAY_MS, "the first step is the base");
  assert.equal(d1, BASE_DELAY_MS * 2, "and it doubles");
  assert.equal(d2, BASE_DELAY_MS * 4);

  // CAPPED ON BOTH SIDES OF THE JITTER. The first implementation capped only the
  // base and then multiplied by up to 1.25, so the ceiling could be exceeded by
  // a quarter while the comment beside it claimed it could not — caught by this
  // line on its first run.
  assert.ok(nextDelay(40, () => 1) <= MAX_DELAY_MS, "the cap holds at the top of the jitter");
  assert.equal(nextDelay(40, mid), MAX_DELAY_MS);

  // THE JITTER IS THE POINT: without it every event queued during one outage
  // retries at the same instant when it ends — a herd aimed at a server that
  // has just come back up.
  const lo = nextDelay(3, () => 0), hi = nextDelay(3, () => 1);
  assert.ok(hi > lo, "the spread is real");
  assert.ok(lo >= BASE_DELAY_MS * 8 * 0.7, "and bounded below — a delay that collapses to zero rebuilds the herd");
  assert.ok(hi <= BASE_DELAY_MS * 8 * 1.3, "and bounded above");
  assert.ok(nextDelay(0, () => 0) >= 1000, "never less than a second");
});

// ── classification ─────────────────────────────────────────────────────────

test("a permanent refusal is dead at once; a transient one is scheduled", () => {
  const at = 1_000_000;
  for (const status of [400, 401, 403, 404, 410, 422]) {
    const o = outcomeFor({ sent: false, status, attempts: 0, retryable, now: at });
    assert.equal(o.status, STATUS.dead, status + " must not be retried for six hours to reach a conclusion we have");
    assert.equal(o.nextAttemptAt, undefined);
  }
  for (const status of [500, 502, 503, 429, 408, null]) {
    const o = outcomeFor({ sent: false, status, attempts: 0, retryable, now: at, rand: () => 0.5 });
    assert.equal(o.status, STATUS.pending, status + " must be scheduled again");
    assert.ok(Date.parse(o.nextAttemptAt) > at, "and in the future");
  }
  assert.equal(outcomeFor({ sent: true, status: 200, attempts: 3, retryable, now: at }).status, STATUS.done);
});

test("dead-lettered at the cap, and the count is what decides", () => {
  const at = 1;
  const last = outcomeFor({ sent: false, status: 503, attempts: MAX_ATTEMPTS - 1, retryable, now: at });
  assert.equal(last.status, STATUS.dead, "the attempt that reaches the cap is the last one");
  assert.match(last.reason, /gave up/);
  const before = outcomeFor({ sent: false, status: 503, attempts: MAX_ATTEMPTS - 2, retryable, now: at, rand: () => 0.5 });
  assert.equal(before.status, STATUS.pending, "the one before it still retries");
});

// ── claiming ───────────────────────────────────────────────────────────────

test("what may be claimed, and what may never be", () => {
  const now = 10_000_000;
  assert.equal(claimable(row({ next_attempt_at: new Date(now - 1).toISOString() }), now), true);
  assert.equal(claimable(row({ next_attempt_at: new Date(now + 60_000).toISOString() }), now), false,
    "a row whose time has not come is not due");

  // DELIVERED IS DELIVERED. This is what stops an event going out twice.
  assert.equal(claimable(row({ status: STATUS.done }), now), false);
  assert.equal(claimable(row({ status: STATUS.dead }), now), false);
  assert.equal(claimable(row({ status: "nonsense" }), now), false,
    "an unknown status must not become a row delivered on every tick for ever");

  // A FRESH CLAIM IS SOMEBODY ELSE'S.
  const fresh = row({ status: STATUS.delivering, claimed_at: new Date(now - 1000).toISOString() });
  assert.equal(claimable(fresh, now), false, "another worker is on it");
  const stale = row({ status: STATUS.delivering, claimed_at: new Date(now - LEASE_MS - 1).toISOString() });
  assert.equal(claimable(stale, now), true, "an expired claim is reclaimable — the worker-died case");
  assert.equal(claimable(row({ status: STATUS.delivering, claimed_at: null }), now), true,
    "a claim with no stamp reads as expired, or nothing could ever pick it up again");
});

// ── THE TWO CASES THAT MATTER ──────────────────────────────────────────────

test("TWO OVERLAPPING CRON TICKS deliver each event exactly once", async () => {
  // Cloudflare cron ticks overlap whenever one outlasts its two-minute
  // interval, which a queue of slow receivers does routinely.
  const st = store([row({ event_id: "a" }), row({ event_id: "b" }), row({ event_id: "c" })]);
  const sent = [];
  const deliver = async (r) => {
    // Both ticks are mid-flight at once: yielding here interleaves them the way
    // two isolates really would.
    await new Promise((res) => setTimeout(res, 1));
    sent.push(r.event_id);
    return { sent: true, status: 200 };
  };
  const now = 10_000_000;
  const [one, two] = await Promise.all([
    drainQueue(deps(st, deliver), { now }),
    drainQueue(deps(st, deliver), { now }),
  ]);

  assert.deepEqual(sent.sort(), ["a", "b", "c"], "every event went out EXACTLY once");
  assert.equal(one.claimed + two.claimed, 3, "and only three claims were won between them");
  // EITHER COUNTER, because which one fires depends on the interleaving and
  // both mean the same thing: this tick did not deliver that row. `skipped` is
  // the pre-check seeing a fresh claim; `lost` is the claim itself being
  // contended. Asserting one specifically was a test about scheduling — it
  // failed on the first run against perfectly correct behaviour.
  assert.ok(one.skipped + two.skipped + one.lost + two.lost > 0,
    "the tick that did not win must SEE that, rather than proceeding unclaimed");
  for (const r of st.all()) assert.equal(r.status, STATUS.done);
});

test("when both ticks pass the pre-check, the CLAIM is what separates them", async () => {
  // The interleaving above never contends the claim itself — the second tick's
  // pre-check already sees a fresh one. This drives the other order directly,
  // because `lost` is the counter that stands between two isolates and a double
  // delivery, and a counter nothing exercises is a counter that can stop working.
  const now = 10_000_000;
  const st = store([row({ event_id: "a" })]);
  const snapshot = st.all();               // both ticks read the row as due
  const sent = [];
  const d = (over) => ({
    ...deps(st, async () => { sent.push(1); return { sent: true, status: 200 }; }),
    due: async () => snapshot.map((r) => ({ ...r })),   // a stale read, deliberately
    ...over,
  });
  const [a, b] = await Promise.all([drainQueue(d(), { now }), drainQueue(d(), { now })]);
  assert.equal(sent.length, 1, "delivered exactly once despite both ticks reading it as due");
  assert.equal(a.claimed + b.claimed, 1, "one claim won");
  assert.equal(a.lost + b.lost, 1, "and the other tick lost AT THE CLAIM, not at the pre-check");
});

test("A WORKER DYING MID-DELIVERY loses the run, not the event", async () => {
  const now = 10_000_000;
  const st = store([row({ event_id: "a" })]);

  // The isolate is evicted between the claim and the result: the claim was
  // written, the outcome never was.
  const dying = deps(st, async () => { throw new Error("isolate evicted"); });
  dying.finish = async () => { throw new Error("nothing was ever written"); };
  await drainQueue(dying, { now });

  const parked = st.rows.get("a");
  assert.equal(parked.status, STATUS.delivering, "the row is left mid-flight, which is the real state");

  // The very next tick must NOT take it — the lease has not expired, and a
  // queue that ignores a live claim is the double-delivery bug.
  const soon = await drainQueue(deps(st, async () => ({ sent: true, status: 200 })), { now: now + 1000 });
  assert.equal(soon.claimed, 0, "a live claim is left alone");
  assert.equal(st.rows.get("a").status, STATUS.delivering);

  // Once the lease expires it is reclaimed and delivered. THIS is the durability
  // promise: the event survives the worker that was carrying it.
  const later = await drainQueue(deps(st, async () => ({ sent: true, status: 200 })), { now: now + LEASE_MS + 1 });
  assert.equal(later.claimed, 1, "the stale claim is reclaimed");
  assert.equal(later.delivered, 1);
  assert.equal(st.rows.get("a").status, STATUS.done, "and the event finally goes out");
});

test("a failed result write leaves the row recoverable, never lost", async () => {
  // The delivery happened and the note did not — at-least-once, which is why
  // the event id is stable and inside the signed body.
  const now = 10_000_000;
  const st = store([row({ event_id: "a" })]);
  const d = deps(st, async () => ({ sent: true, status: 200 }));
  d.finish = async () => { throw new Error("supabase down"); };
  const out = await drainQueue(d, { now });
  assert.equal(out.writeFailed, 1, "the failure is counted rather than swallowed");
  assert.equal(st.rows.get("a").status, STATUS.delivering, "so the lease will bring it back");
});

// ── the drain, generally ───────────────────────────────────────────────────

test("the drain never throws, and an unreadable queue is reported", async () => {
  const out = await drainQueue({
    due: async () => { throw new Error("supabase 500"); },
    claim: async () => true, finish: async () => {}, deliver: async () => ({ sent: true }), retryable,
  }, { now: 1 });
  assert.equal(out.claimed, 0);
  assert.match(out.error, /supabase 500/, "a queue that can take the cron down with it is worse than one behind");
});

test("a delivery that throws is a retry, not a lost row", async () => {
  const now = 10_000_000;
  const st = store([row({ event_id: "a" })]);
  const out = await drainQueue(deps(st, async () => { throw new Error("ECONNREFUSED"); }), { now });
  assert.equal(out.retried, 1);
  const r = st.rows.get("a");
  assert.equal(r.status, STATUS.pending, "back in the queue");
  assert.equal(r.attempts, 2, "with the attempt counted");
  assert.ok(Date.parse(r.next_attempt_at) > now, "and scheduled into the future");
});

test("the tick is bounded, so one busy site cannot starve the rest", async () => {
  const now = 10_000_000;
  const many = Array.from({ length: 50 }, (_, i) => row({ event_id: "e" + i }));
  const st = store(many);
  const out = await drainQueue(deps(st, async () => ({ sent: true, status: 200 })), { now, max: 5 });
  assert.equal(out.claimed, 5);
  assert.equal(st.all().filter((r) => r.status === STATUS.done).length, 5);
  assert.ok(MAX_PER_TICK > 0 && MAX_PER_TICK < 1000, "and the default is a real bound");
});

// ── the enqueued row ───────────────────────────────────────────────────────

test("the enqueued row carries the EXACT bytes and the id inside them", () => {
  // A BODY THAT DOES NOT SURVIVE A JSON ROUND TRIP, which is the whole point.
  // The obvious fixture — compact, integer-valued — re-serialises to itself, so
  // `assert.equal(r.body, body)` passed against an implementation that parsed
  // and re-stringified it. Whitespace and a trailing-zero float do not survive:
  // `{"a": 1}` becomes `{"a":1}` and `12.50` becomes `12.5`, and the HMAC is
  // over these exact characters, so either would make the receiver reject a
  // delivery that is otherwise perfectly correct.
  const body = '{"id":"evt_9", "site":"barber", "data":{"who":"Ada","paid":12.50}}';
  assert.notEqual(JSON.stringify(JSON.parse(body)), body,
    "the fixture must be one a round trip CHANGES, or this test proves nothing");
  const r = enqueueRow({
    eventId: "evt_9", slug: "barber", table: "bookings", action: "created",
    body, status: 503, error: "receiver refused", attempts: 3, now: 1_000_000, rand: () => 0.5,
  });
  assert.equal(r.body, body, "stored verbatim — the HMAC is over these characters");
  assert.equal(r.event_id, "evt_9");
  assert.ok(JSON.parse(r.body).id === "evt_9", "and the id the receiver dedups on is inside the signed body");
  assert.notEqual(r.body, JSON.stringify(JSON.parse(body)), "and it was NOT rebuilt on the way in");
  assert.equal(r.status, STATUS.pending);
  assert.equal(r.attempts, 3, "the in-request ladder's attempts are carried, not reset");
  assert.ok(Date.parse(r.next_attempt_at) > 1_000_000);
  assert.equal(r.last_status, 503);
});

// ── the wiring, which no module test can see ───────────────────────────────

test("the Worker enqueues only retryable failures, and drains on the cron", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // A 404 queued is a row that can never succeed, in a queue nobody reads.
  assert.match(w, /if \(!out\.sent && out\.body && webhookRetryable\(out\.status\)\)/,
    "the enqueue must be gated on the same classification the ladder uses");
  // The id must be minted BEFORE the attempt, or the body the first attempt
  // sent and the body the queue stores differ by exactly that field.
  assert.match(w, /eventId: crypto\.randomUUID\(\)/, "the stable id is minted at the call site");
  assert.match(w, /ctx\.waitUntil\(runWebhookQueue\(env\)\)/, "and the cron drains it");
  // The primary key is the event id, so a redelivery of a queued event is a
  // no-op rather than an error.
  assert.match(w, /resolution=ignore-duplicates[\s\S]{0,200}?webhook_queue|webhook_queue[\s\S]{0,400}?resolution=ignore-duplicates/,
    "the insert must tolerate an id already queued");
});

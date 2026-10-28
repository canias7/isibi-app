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
  nextDelay, outcomeFor, claimable, enqueueRow, drainQueue, STATUS, fairSlice, siteKeyOf,
  sameOwner, queueFull, retentionCutoffs,
  MAX_ATTEMPTS, BASE_DELAY_MS, MAX_DELAY_MS, LEASE_MS, MAX_PER_TICK, MAX_PER_SITE_PER_TICK, MAX_PENDING_PER_SITE,
  RETAIN_DONE_MS, RETAIN_DEAD_MS,
} from "../site-webhook-queue.mjs";
import { retryable } from "../site-webhooks.mjs";
import { loadTemplate } from "./fixtures/template-ts.mjs";
import { driveWrite, withFetch, memBucket } from "./fixtures/site-effects-drive.mjs";

/**
 * A store that enforces the ONE property the queue depends on: a claim is a
 * conditional update, so of two callers exactly one can win. Anything looser
 * (a plain `row.status = "delivering"`) makes every concurrency test below
 * pass against an implementation that has no atomicity at all.
 */
function store(rows) {
  const byId = new Map(rows.map((r) => [r.event_id, { ...r }]));
  // THE TENANCY FILTER, applied exactly where the Worker's URL applies it: every
  // write to this table names `owner_id` and `slug` as well as the id. A fake
  // that looked rows up by id alone would settle another account's row without
  // complaint, which is the property being asserted below.
  const scoped = (row) => {
    const cur = byId.get(row.event_id);
    if (!cur) return null;
    if (String(cur.owner_id) !== String(row.owner_id)) return null;
    if (String(cur.slug) !== String(row.slug)) return null;
    return cur;
  };
  return {
    rows: byId,
    all: () => [...byId.values()],
    due(now, max) {
      return [...byId.values()].filter((r) => claimable(r, now)).slice(0, max);
    },
    claim(row, now) {
      const cur = scoped(row);
      // The WHERE clause, as the database would apply it.
      if (!cur || !claimable(cur, now)) return false;
      cur.status = STATUS.delivering;
      cur.claimed_at = new Date(now).toISOString();
      return true;
    },
    finish(row, patch) {
      const cur = scoped(row);
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
  event_id: "evt_1", owner_id: "owner-A", slug: "barber", table_name: "bookings", action: "created",
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

test("ONE BROKEN RECEIVER CANNOT OCCUPY THE TICK", async () => {
  // The failure this prevents: a site whose endpoint is down produces rows
  // faster than anyone else and its retries come due together, so in read order
  // it fills every tick and every other site's deliveries wait behind an
  // endpoint that is not going to answer.
  const now = 10_000_000;
  const loud = Array.from({ length: 50 }, (_, i) => row({ event_id: "loud" + i, owner_id: "A", slug: "broken" }));
  const quiet = [row({ event_id: "q1", owner_id: "B", slug: "cafe" }), row({ event_id: "q2", owner_id: "C", slug: "salon" })];
  const st = store([...loud, ...quiet]);          // the backlog is read FIRST
  const out = await drainQueue(deps(st, async () => ({ sent: true, status: 200 })), { now, max: 10 });

  const done = st.all().filter((r) => r.status === STATUS.done).map((r) => r.event_id);
  assert.ok(done.includes("q1") && done.includes("q2"),
    "the quiet sites must get through on the SAME tick, not after 50 rows of somebody else's backlog");
  assert.equal(done.filter((id) => id.startsWith("loud")).length, MAX_PER_SITE_PER_TICK,
    "and the loud site takes its share and no more");
  assert.ok(out.claimed <= 10, "the global bound still holds");
  assert.ok(MAX_PER_TICK > 0 && MAX_PER_TICK < 1000, "and the default is a real bound");
});

test("fairSlice round-robins, and keeps stalest-first within each site", () => {
  const mk = (owner, slug, n) => Array.from({ length: n }, (_, i) => ({ owner_id: owner, slug, event_id: slug + i }));
  const picked = fairSlice([...mk("A", "a", 5), ...mk("B", "b", 5)], { max: 6, maxPerSite: 3 });
  assert.equal(picked.length, 6);
  assert.equal(picked.filter((r) => r.slug === "a").length, 3, "each site takes its share");
  assert.equal(picked.filter((r) => r.slug === "b").length, 3);
  // WITHIN a site the query's stalest-first order must survive, or the fairness
  // pass silently reorders the thing the ORDER BY exists to decide.
  assert.deepEqual(picked.filter((r) => r.slug === "a").map((r) => r.event_id), ["a0", "a1", "a2"]);
  // TWO OWNERS ON ONE SLUG ARE TWO SITES. A slug is re-claimable, so keying
  // fairness on it alone would let one account's backlog crowd out another's.
  const shared = fairSlice([...mk("A", "same", 4), ...mk("B", "same", 4)], { max: 6, maxPerSite: 3 });
  assert.equal(shared.filter((r) => r.owner_id === "A").length, 3);
  assert.equal(shared.filter((r) => r.owner_id === "B").length, 3);
});

test("delivered_at is written ONLY on success, and only once", async () => {
  const now = 10_000_000;
  const okSt = store([row({ event_id: "a" })]);
  await drainQueue(deps(okSt, async () => ({ sent: true, status: 200 })), { now });
  assert.equal(okSt.rows.get("a").delivered_at, new Date(now).toISOString(), "a landed event records when");

  // A FAILED ATTEMPT MUST NOT STAMP IT. `updated_at` already answers "when did
  // we last touch this"; the whole value of this column is that its presence
  // means the event got through.
  const badSt = store([row({ event_id: "b" })]);
  await drainQueue(deps(badSt, async () => ({ sent: false, status: 503 })), { now });
  assert.equal(badSt.rows.get("b").delivered_at, undefined, "a retry must leave it unset");
  const deadSt = store([row({ event_id: "c" })]);
  await drainQueue(deps(deadSt, async () => ({ sent: false, status: 404 })), { now });
  assert.equal(deadSt.rows.get("c").status, STATUS.dead);
  assert.equal(deadSt.rows.get("c").delivered_at, undefined, "and so must a dead letter");
});

// ── TWO OWNERS, ONE SLUG ───────────────────────────────────────────────────
//
// A slug is freed by a delete and claimable by anybody. Everything a delivery
// needs — the destination URL and the signing secret — is read out of whichever
// site holds the slug at delivery time, so the gap between queuing a row and
// retrying it is a window in which the addressee can change.

test("sameOwner refuses anything but an exact match, in both directions", () => {
  assert.equal(sameOwner({ owner_id: "A" }, "A"), true);
  assert.equal(sameOwner({ owner_id: "A" }, "B"), false, "the slug changed hands — this row is not deliverable");
  // AN EMPTY OWNER ON EITHER SIDE IS A REFUSAL, not a match. A row written
  // before this column existed, or a lookup that answered without a `uid`,
  // would otherwise authorise itself against anything.
  assert.equal(sameOwner({ owner_id: "" }, ""), false, "two absences are not an identity");
  assert.equal(sameOwner({}, "B"), false);
  assert.equal(sameOwner({ owner_id: "A" }, null), false);
  assert.equal(sameOwner({ owner_id: "A" }, undefined), false);
  assert.equal(sameOwner(null, "A"), false);
  // Compared as strings, so a uuid that arrives from one side as a String
  // object and the other as a primitive still matches.
  assert.equal(sameOwner({ owner_id: String("A") }, "A"), true);
});

test("A RE-CLAIMED SLUG NEVER DELIVERS THE OLD OWNER'S PAYLOAD", async () => {
  // The leak this exists to stop, driven end to end: owner A queued a booking
  // against `barber` and their site was deleted; owner B now holds `barber` and
  // has their own endpoint and their own signing secret. Both rows are in the
  // queue together, which is exactly what the table looks like on the day a
  // slug changes hands.
  const now = 10_000_000;
  const st = store([
    row({ event_id: "old", owner_id: "owner-A", slug: "barber", body: '{"customer":"Ada","phone":"07700900123"}' }),
    row({ event_id: "new", owner_id: "owner-B", slug: "barber", body: '{"customer":"Bo"}' }),
  ]);

  // The site directory, as the Worker reads it: the slug resolves to whoever
  // owns it NOW, and the endpoint comes with it.
  const siteNow = { barber: { uid: "owner-B", endpoint: "https://owner-b.example/hook" } };
  const posted = [];
  const deliver = async (r) => {
    const site = siteNow[r.slug];
    if (!site) return { sent: false, status: 410, error: "site no longer exists" };
    // THE CHECK, in the position the Worker puts it: before the vault is opened
    // and before anything is posted.
    if (!sameOwner(r, site.uid)) return { sent: false, status: 410, error: "slug now belongs to another account" };
    posted.push({ to: site.endpoint, body: r.body });
    return { sent: true, status: 200 };
  };

  const out = await drainQueue(deps(st, deliver), { now });

  assert.equal(posted.length, 1, "exactly one of the two rows was deliverable");
  assert.equal(posted[0].to, "https://owner-b.example/hook");
  assert.equal(JSON.parse(posted[0].body).customer, "Bo", "and it was B's own event");
  assert.ok(!posted.some((p) => p.body.includes("07700900123")),
    "owner A's customer data must never reach owner B's endpoint");

  assert.equal(st.rows.get("old").status, STATUS.dead,
    "the orphaned row is permanently refused rather than retried for six hours");
  assert.equal(st.rows.get("old").delivered_at, undefined, "and never marked delivered");
  assert.match(String(st.rows.get("old").last_error), /another account|refused permanently/);
  assert.equal(st.rows.get("new").status, STATUS.done);
  assert.equal(out.dead, 1);
  assert.equal(out.delivered, 1);
});

test("one owner's tick cannot claim or settle another owner's row on the same slug", async () => {
  // The other half of the same property: the WRITES. Every claim and every
  // result is scoped on (event_id, owner_id, slug), so a row handed to the
  // wrong tenant's update matches nothing rather than being quietly taken.
  const now = 10_000_000;
  const st = store([row({ event_id: "a", owner_id: "owner-A", slug: "barber" })]);

  const wrongTenant = { event_id: "a", owner_id: "owner-B", slug: "barber", status: STATUS.pending, attempts: 1 };
  assert.equal(st.claim(wrongTenant, now), false, "B cannot claim A's row by naming its id");
  assert.equal(st.rows.get("a").status, STATUS.pending, "and the row is untouched");
  st.finish(wrongTenant, { status: STATUS.done, attempts: 9 });
  assert.equal(st.rows.get("a").status, STATUS.pending, "nor settle it");
  assert.equal(st.rows.get("a").attempts, 1);

  // The rightful owner still works, or the assertions above pass against a
  // store that refuses everybody.
  assert.equal(st.claim(st.rows.get("a"), now), true);
});

test("two owners on one slug are two sites to every part of the drain", () => {
  const a = { owner_id: "owner-A", slug: "barber" };
  const b = { owner_id: "owner-B", slug: "barber" };
  assert.notEqual(siteKeyOf(a), siteKeyOf(b),
    "keyed on the slug alone, one account's backlog would spend the other's share of the tick");
  assert.equal(siteKeyOf(a), siteKeyOf({ owner_id: "owner-A", slug: "barber", event_id: "x" }));
  // An owner-less row must not merge with every other owner-less row into one
  // giant pseudo-site.
  assert.notEqual(siteKeyOf({ slug: "a" }), siteKeyOf({ slug: "b" }));
});

// ── the per-site cap ───────────────────────────────────────────────────────

test("the queue cap bounds a site, and an unreadable count fails OPEN", () => {
  assert.equal(queueFull(0), false);
  assert.equal(queueFull(MAX_PENDING_PER_SITE - 1), false);
  assert.equal(queueFull(MAX_PENDING_PER_SITE), true, "at the cap is full — the next row would exceed it");
  assert.equal(queueFull(MAX_PENDING_PER_SITE + 50), true);
  // FAILS OPEN. The cap bounds a pathological case; being unable to count is
  // not that case, and dropping a customer's event over a Supabase blip is the
  // failure this whole module exists to prevent.
  assert.equal(queueFull(null), false, "a count we could not read is not a full queue");
  assert.equal(queueFull(undefined), false);
  assert.equal(queueFull(NaN), false);
  assert.equal(queueFull("not a number"), false);
  assert.equal(queueFull(3, 3), true, "the cap is a parameter, so a caller can be stricter");
  assert.ok(MAX_PENDING_PER_SITE > MAX_PER_TICK, "a cap below a tick's budget would drop rows the drain could clear");
});

// ── retention ──────────────────────────────────────────────────────────────

test("settled rows expire, dead ones long after done ones", () => {
  const now = Date.parse("2026-08-16T12:00:00.000Z");
  const cut = retentionCutoffs(now);
  assert.equal(Date.parse(cut.done), now - RETAIN_DONE_MS);
  assert.equal(Date.parse(cut.dead), now - RETAIN_DEAD_MS);
  // A `dead` row is the only durable record that an event was LOST, which is
  // the thing somebody may come asking about weeks later. A `done` row is a
  // receipt nothing reads.
  assert.ok(Date.parse(cut.dead) < Date.parse(cut.done), "dead letters outlive receipts");
  // NOTHING JUST-SETTLED IS EVER ELIGIBLE, which is the only property of a
  // DELETE worth asserting without a database.
  assert.ok(Date.parse(cut.done) < now, "the cutoff is in the past");
  assert.ok(RETAIN_DONE_MS >= 24 * 60 * 60 * 1000, "a receipt survives at least a day");
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
    ownerId: "owner-A", eventId: "evt_9", slug: "barber", table: "bookings", action: "created",
    body, status: 503, error: "receiver refused", attempts: 3, now: 1_000_000, rand: () => 0.5,
  });
  assert.equal(r.body, body, "stored verbatim — the HMAC is over these characters");
  assert.equal(r.event_id, "evt_9");
  assert.equal(r.owner_id, "owner-A", "and the account it is addressed to");
  assert.equal(r.slug, "barber");
  assert.ok(JSON.parse(r.body).id === "evt_9", "and the id the receiver dedups on is inside the signed body");
  assert.notEqual(r.body, JSON.stringify(JSON.parse(body)), "and it was NOT rebuilt on the way in");
  assert.equal(r.status, STATUS.pending);
  assert.equal(r.attempts, 3, "the in-request ladder's attempts are carried, not reset");
  assert.ok(Date.parse(r.next_attempt_at) > 1_000_000);
  assert.equal(r.last_status, 503);
});

test("an owner-less row is REFUSED rather than written", () => {
  // `String(undefined)` is `"undefined"` — a fine string and not a uuid — so
  // without this the caller builds a row Postgres rejects, believing it queued
  // something. Worse, a row that DID land with a junk owner could never be
  // delivered (`sameOwner` refuses it) while looking, to anybody reading the
  // table, like a delivery still in flight.
  const args = { eventId: "e", slug: "barber", table: "t", action: "created", body: "{}", now: 1 };
  assert.throws(() => enqueueRow(args), /account it belongs to/);
  assert.throws(() => enqueueRow({ ...args, ownerId: "" }), /account it belongs to/);
  assert.throws(() => enqueueRow({ ...args, ownerId: null }), /account it belongs to/);
  assert.equal(enqueueRow({ ...args, ownerId: "owner-A" }).owner_id, "owner-A");
});

// ── the wiring, which no module test can see ───────────────────────────────

test("the Worker enqueues only retryable failures, and drains on the cron", async () => {
  // (2026-10-28: the site's own Worker — its bucket under `webhooks/q/`, drained
  // on the platform clock's wake, `POST /__gf/tick`.)
  const tables = [{ name: "bookings", access: "collect", columns: ["who"], webhooks: true }];
  const env = { WEBHOOK_URL: "https://hooks.example.com/x" };
  // A 404 queued is a row that can never succeed, in a queue nobody reads.
  const refused = await driveWrite({ tables, env, sent: '{"who":"Ada"}', body: '[{"id":4,"who":"Ada"}]',
    answer: () => new Response("no", { status: 404 }) });
  assert.equal(refused.calls.length, 1, "a refusal is not retried in line");
  assert.equal([...refused.bucket.map.keys()].filter((k) => k.startsWith("webhooks/q/")).length, 0,
    "the enqueue must be gated on the same classification the ladder uses");
  // A receiver that is down is kept, with the EXACT bytes first sent — the id
  // is minted BEFORE the attempt, or the body the first attempt sent and the
  // body the queue stores differ by exactly that field.
  const down = await driveWrite({ tables, env, sent: '{"who":"Ada"}', body: '[{"id":4,"who":"Ada"}]',
    answer: () => new Response("down", { status: 503 }) });
  const keys = [...down.bucket.map.keys()].filter((k) => k.startsWith("webhooks/q/"));
  assert.equal(keys.length, 1, "a retryable failure must be queued");
  const row = JSON.parse(down.bucket.map.get(keys[0]).v);
  assert.equal(row.body, down.calls[0].init.body, "the stored bytes are the bytes first sent");
  assert.equal(JSON.parse(row.body).id, row.event_id, "the id inside the bytes is the queue's key");
  assert.equal(keys[0], "webhooks/q/" + row.event_id + ".json");
  // The key is the event id, so a redelivery of a queued event is a no-op
  // rather than an error or a second row.
  const { queueFailed, siteTick } = await loadTemplate("lib/site-webhook-retry.ts");
  const again = await queueFailed({ OWN_BUCKET: "1", SITES: down.bucket }, { slug: "barber", table: "bookings", action: "created",
    out: { sent: false, body: row.body, status: 503, eventId: row.event_id } });
  assert.equal(typeof again, "string");
  assert.equal([...down.bucket.map.keys()].filter((k) => k.startsWith("webhooks/q/")).length, 1);
  // And the clock drains it: due now, delivered with the stored bytes, removed.
  down.bucket.map.get(keys[0]).v = JSON.stringify({ ...row, next_attempt_at: new Date(Date.now() - 1000).toISOString() });
  const tick = await withFetch({ answer: () => new Response("ok", { status: 200 }) }, () =>
    siteTick(new Request("https://barber.example/__gf/tick", { method: "POST", headers: { "x-gf-site-job": "1" } }),
      { ...env, OWN_BUCKET: "1", SITES: down.bucket }, new URL("https://barber.example/__gf/tick"), "barber", "x-gf-site-job"));
  assert.equal(tick.out.status, 200);
  const sent = tick.calls.filter((c) => c.url.startsWith("https://hooks.example.com/"));
  assert.equal(sent.length, 1, "the tick must drain the queue");
  assert.equal(sent[0].init.body, row.body);
  assert.equal(down.bucket.map.has(keys[0]), false, "a delivered row leaves the queue");
  // Only the clock's own wake drains: anything else is not this route.
  assert.equal(await siteTick(new Request("https://barber.example/__gf/tick", { method: "POST" }), { OWN_BUCKET: "1", SITES: down.bucket },
    new URL("https://barber.example/__gf/tick"), "barber", "x-gf-site-job"), null);
});



test("the enqueue resolves the owner, and reports which of the three things happened", async () => {
  // (2026-10-28: the site's own Worker. The bucket IS the tenant now — one
  // site's own R2 — so there is no owner to resolve; what remains is the
  // per-site cap, applied before the write, and saying which outcome it was.)
  // Without the sentences a full queue and a pending retry are the same red
  // line in the owner's only window.
  const { queueFailed } = await loadTemplate("lib/site-webhook-retry.ts");
  const out = (id) => ({ sent: false, body: '{"id":"' + id + '"}', status: 503, eventId: id });
  const B = memBucket();
  assert.equal(await queueFailed({ OWN_BUCKET: "1", SITES: B }, { slug: "s", table: "t", action: "created", out: out("a1") }), "queued for retry");
  // Not worth retrying, or nothing sent: nothing written, nothing claimed.
  assert.equal(await queueFailed({ OWN_BUCKET: "1", SITES: B }, { slug: "s", table: "t", action: "created", out: { ...out("a2"), status: 404 } }), null);
  assert.equal(await queueFailed({ OWN_BUCKET: "1", SITES: B }, { slug: "s", table: "t", action: "created", out: { ...out("a3"), sent: true } }), null);
  // At the cap: refused BEFORE the write, and it says so.
  const full = memBucket(Object.fromEntries(Array.from({ length: MAX_PENDING_PER_SITE }, (_, i) => ["webhooks/q/p" + i + ".json", "{}"])));
  const said = await queueFailed({ OWN_BUCKET: "1", SITES: full }, { slug: "s", table: "t", action: "created", out: out("z9") });
  assert.match(String(said), /not queued/);
  assert.equal(full.map.has("webhooks/q/z9.json"), false, "the per-site cap is applied before the write");
  // The queued row carries the failure the drain reads.
  const row = JSON.parse(B.map.get("webhooks/q/a1.json").v);
  assert.equal(row.status, STATUS.pending);
  assert.equal(row.last_status, 503);
});

// The async edit job: its clocks, its states, and the schema it has to agree with.
//
// ── WHAT THIS FILE IS FOR ──────────────────────────────────────────────────
//
// Two lists of the same thing drift, and the drift is silent. The job's states
// live in `builder/edit-job.mjs` AND in a CHECK constraint in the applied SQL;
// the idempotency-key shape lives in `cleanIdemKey` AND in a regex inside
// `edit_create`. Either pair can be edited alone, and the failure is a job that
// the Worker believes is fine and Postgres refuses — or worse, an id the Worker
// refuses and Postgres would have accepted, which reads to a customer as the
// edit path being broken.
//
// So every list here is DERIVED FROM THE OTHER SIDE and compared, in both
// directions, rather than typed twice.
//
// The budget half is driven with an injected clock rather than asserted by
// reading, because what matters is not that the arithmetic is written down but
// that it comes out right at the boundaries — and the boundary that matters
// most decides whether a customer's credits are spent on a correction round
// that cannot land.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EDIT_JOB_KIND, CONSUMER_CEILING_MS, EDIT_JOB_MS, PUBLISH_RESERVE_MS,
  TERMINAL_RESERVE_MS, CORRECT_FLOOR_MS, MIN_CORRECT_MS, MIN_BUILD_MS, MIN_VERIFY_MS,
  LEASE_TTL_S, HEARTBEAT_S, STALE_GRACE_S, PUBLISH_LEASE_S,
  EDIT_PHASES, TERMINAL_STATES, isTerminalEdit,
  makeEditBudget, cleanIdemKey, newLeaseOwner, editAsyncOn,
} from "../builder/edit-job.mjs";

const TABLES = readFileSync(new URL("../supabase/applied/20260901110738_edit_jobs_and_credit_events.sql", import.meta.url), "utf8");
const RPCS = readFileSync(new URL("../supabase/applied/20260901110952_edit_job_rpcs.sql", import.meta.url), "utf8");

// ── THE SCHEMA AND THE MODULE AGREE ───────────────────────────────────────

test("every state the module knows is a state the database admits, and back", () => {
  const ck = /edit_jobs_state_ck check \(state in \(([\s\S]*?)\)\)/.exec(TABLES);
  assert.ok(ck, "the state CHECK constraint is gone from the applied SQL");
  const inDb = [...ck[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  const inJs = [...EDIT_PHASES, ...TERMINAL_STATES].sort();
  // BOTH DIRECTIONS. A state added to the module and not the constraint is an
  // UPDATE Postgres refuses mid-job; one added to the constraint and not the
  // module is a state nothing can ever reach or read.
  assert.deepEqual(inJs, inDb, "the module's states and the CHECK constraint have drifted");
  assert.ok(inDb.length >= 13, `only ${inDb.length} states parsed — the regex stopped matching`);
});

test("the terminal states are exactly the ones the SQL refuses to move out of", () => {
  // DERIVED FROM THE SQL rather than retyped: every guard in there spells the
  // set as `state not in (...)`, and they must all spell the SAME set.
  const guards = [...RPCS.matchAll(/state not in \(([^)]*)\)/g)]
    .map((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort().join(","));
  assert.ok(guards.length >= 5, `only ${guards.length} terminal guards found — the scan stopped matching`);
  const want = [...TERMINAL_STATES].sort().join(",");
  // `finalize` deliberately guards a SUBSET (it may run on a job that is not
  // yet done), so the assertion is that every guard is a subset of the terminal
  // set and at least one is the whole of it — not that all are identical.
  for (const g of guards) {
    for (const s of g.split(",")) {
      assert.ok(TERMINAL_STATES.includes(s), `SQL guards on '${s}', which the module does not call terminal`);
    }
  }
  assert.ok(guards.includes(want), "no SQL guard names the full terminal set any more");
  assert.ok(isTerminalEdit("lost") && !isTerminalEdit("publishing"));
  // A NON-STRING IS NOT TERMINAL, rather than coerced into one. `String(["done"])`
  // is `"done"` — this repo has shipped that coercion three times.
  assert.equal(isTerminalEdit(["done"]), false);
});

test("the idempotency key means the same thing on both sides", () => {
  const re = /p_idem !~ '([^']+)'/.exec(RPCS);
  assert.ok(re, "edit_create no longer validates the idempotency key");
  const sqlRe = new RegExp(re[1]);
  // The SAME strings judged by both. Derived from the SQL's own pattern, so a
  // change on either side that is not made on the other fails here.
  for (const v of ["idem-aaaaaaaaaaaaaaaa", "a".repeat(64), "a".repeat(16), "x".repeat(15), "a".repeat(65), "has space aaaaaaaa", ""]) {
    assert.equal(!!cleanIdemKey(v), sqlRe.test(v), `the two validators disagree about ${JSON.stringify(v)}`);
  }
  // REFUSES A NON-STRING, NEVER COERCES ONE.
  assert.equal(cleanIdemKey(["idem-aaaaaaaaaaaaaaaa"]), null);
  assert.equal(cleanIdemKey(null), null);
  assert.equal(cleanIdemKey(12345678901234567890), null);
});

test("every edit RPC is revoked from the API roles and granted only to service_role", () => {
  // DERIVED FROM THE DEFINITIONS, so a function added without its two grant
  // lines fails here rather than shipping reachable by any signed-in user.
  const defined = [...RPCS.matchAll(/create or replace function (public\.edit_[a-z_]+)\(/g)].map((m) => m[1]);
  assert.ok(defined.length >= 13, `only ${defined.length} functions found — the scan stopped matching`);
  for (const fn of defined) {
    assert.ok(RPCS.includes(`revoke all on function ${fn}(`), `${fn} is never revoked from anon/authenticated`);
    assert.ok(RPCS.includes(`grant execute on function ${fn}(`), `${fn} has no service_role grant`);
  }
  // AND THE OTHER DIRECTION: a grant naming a function that no longer exists is
  // a line that will fail on re-apply, which is what this file is FOR.
  const granted = [...RPCS.matchAll(/grant execute on function (public\.edit_[a-z_]+)\(/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(granted)].sort(), [...new Set(defined)].sort());
  // Nothing may be granted to a role a browser can reach.
  assert.ok(!/grant execute on function public\.edit_[a-z_]+\([^)]*\) to (anon|authenticated)/.test(RPCS),
    "an edit RPC is granted to a role a browser holds");
});

test("both tables are service-role only, with no policies", () => {
  for (const t of ["public.edit_jobs", "public.credit_events"]) {
    assert.ok(RPCS.includes(t) || TABLES.includes(t.replace("public.", "")), `${t} is not in the applied SQL`);
  }
  assert.match(TABLES, /alter table public\.edit_jobs enable row level security/);
  assert.match(TABLES, /alter table public\.credit_events enable row level security/);
  // RLS ON WITH NO POLICIES is the posture, so a `create policy` here would be
  // the change that opens both tables to every signed-in user.
  assert.ok(!/create policy/i.test(TABLES), "a policy appeared — these tables are service-role only");
});

// ── THE CLOCKS ────────────────────────────────────────────────────────────

test("the whole job fits inside the consumer's ceiling with teardown room", () => {
  assert.ok(EDIT_JOB_MS < CONSUMER_CEILING_MS, "the job budget is at or past the platform's hard cap");
  // The gap has to cover what happens AFTER the deadline fires: the terminal
  // state write, the refund and the trace. Anything less and a job that runs
  // long dies without recording that it did — which is exactly the state run
  // 101 was in.
  assert.ok(CONSUMER_CEILING_MS - EDIT_JOB_MS >= TERMINAL_RESERVE_MS * 2,
    "there is not enough room between the budget and the ceiling to record an outcome");
});

test("the reserves are never spendable, and capMs never returns zero", () => {
  let t = 0;
  const b = makeEditBudget(EDIT_JOB_MS, () => t);
  assert.equal(b.spendable(), EDIT_JOB_MS - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS);
  // A call asking for more than the job has gets what the job has, less both
  // reserves — so no model call and no container call can eat the publish
  // window. That is the GUARANTEE; the correction floor below is only a gate.
  assert.equal(b.capMs(10 ** 9), EDIT_JOB_MS - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS);
  // Publishing releases the publish reserve and NOT the terminal one.
  assert.equal(b.capMs(10 ** 9, { publishing: true }), EDIT_JOB_MS - TERMINAL_RESERVE_MS);
  // A smaller per-call bound still wins.
  assert.equal(b.capMs(5000), 5000);

  // NEVER ZERO. A timer of 0 fires at once, which turns "no time left" into
  // "this call failed instantly" and hides the real reason under a wrong one.
  t = EDIT_JOB_MS + 60000;
  assert.equal(b.remaining(), 0);
  assert.equal(b.spendable(), 0);
  assert.ok(b.capMs(30000) >= 1, "capMs returned zero, which fires immediately");
  assert.equal(b.expired(), true);
});

test("nothing extends the budget — a heartbeat renews the lease, not the clock", () => {
  // THE STRUCTURAL VERSION OF THE RULE. The consumer is stopped by Cloudflare at
  // fifteen minutes and no lease renewal is going to change that, so the budget
  // must have no way to be pushed out. It closes over its start and exposes no
  // setter: this asserts the ABSENCE, and then that the clock really moved, so
  // the absence is not passing over a budget that does nothing at all.
  let t = 0;
  const b = makeEditBudget(600000, () => t);
  const before = b.remaining();
  for (const k of Object.keys(b)) {
    assert.ok(!/^(extend|renew|reset|bump|add)/i.test(k), `the budget exposes ${k}, which could push the deadline out`);
  }
  t = 100000;
  assert.equal(before - b.remaining(), 100000, "the budget's clock is not moving — the absence above proves nothing");
  assert.equal(b.startedAt, 0);
});

test("a correction round is not started unless it can plausibly land", () => {
  // The floor is the sum of its named parts, so a later measurement can move
  // one of them without this test needing to know which.
  assert.equal(CORRECT_FLOOR_MS,
    MIN_CORRECT_MS + MIN_BUILD_MS + MIN_VERIFY_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS);
  assert.ok(CORRECT_FLOOR_MS < EDIT_JOB_MS,
    "the correction floor is at or above the whole budget — no correction could ever start");

  let t = 0;
  const b = makeEditBudget(EDIT_JOB_MS, () => t);
  assert.equal(b.canCorrect(), true);
  // Exactly at the floor it may still start; one millisecond past, it may not.
  t = EDIT_JOB_MS - CORRECT_FLOOR_MS;
  assert.equal(b.canCorrect(), true, "refused a round with exactly enough time");
  t += 1;
  assert.equal(b.canCorrect(), false, "started a round that cannot finish");
});

test("a publish running its full reserve cannot be swept out from under itself", () => {
  // THE ONE PIECE OF LEASE ARITHMETIC THAT IS LOAD-BEARING. The sweep may act
  // only once a lease is `STALE_GRACE_S` past expiry, so the window granted at
  // the publish gate has to outlast the publish itself by that margin —
  // otherwise a job can be marked lost and refunded while its own consumer is
  // still uploading the site.
  assert.ok(PUBLISH_LEASE_S > PUBLISH_RESERVE_MS / 1000 + STALE_GRACE_S,
    `a ${PUBLISH_LEASE_S}s publish lease does not outlast a ${PUBLISH_RESERVE_MS / 1000}s publish plus ${STALE_GRACE_S}s of grace`);
  // And the ordinary lease has to survive several missed renewals, or a slow
  // Postgres round trip loses a healthy job.
  assert.ok(LEASE_TTL_S >= HEARTBEAT_S * 3, "the lease expires in under three heartbeats");
  assert.ok(STALE_GRACE_S >= HEARTBEAT_S * 2, "the sweep's grace is under two heartbeats");
});

// ── THE FLAG AND THE NAMES ────────────────────────────────────────────────

test("the async path is off unless something says so in as many words", () => {
  for (const on of ["1", "true", "on", "yes", "TRUE", " On "]) {
    assert.equal(editAsyncOn({ EDIT_ASYNC: on }), true, `${JSON.stringify(on)} should read as on`);
  }
  // OFF FOR EVERYTHING ELSE, including the shapes that are not strings at all.
  // An unreadable flag must never turn a customer-facing path on by accident,
  // and `off` is not a magic word — it is simply not one of the four.
  for (const off of ["off", "0", "false", "no", "", "maybe", undefined, null, 1, true, ["1"], {}]) {
    assert.equal(editAsyncOn({ EDIT_ASYNC: off }), false, `${JSON.stringify(off)} should read as off`);
  }
  assert.equal(editAsyncOn({}), false);
  assert.equal(editAsyncOn(null), false);
});

test("the queue kind is its own, and a lease owner is not a job id", () => {
  assert.equal(EDIT_JOB_KIND, "site-edit");
  assert.notEqual(EDIT_JOB_KIND, "site-build");
  // TWO CONSUMERS ON ONE JOB MUST BE DISTINGUISHABLE, which is the whole point
  // of the lease — so the owner is minted per invocation and never derived from
  // the job.
  const a = newLeaseOwner(() => 0.123456789);
  const b = newLeaseOwner(() => 0.987654321);
  assert.notEqual(a, b);
  assert.match(a, /^c_.{8}$/);
  // Even a degenerate random source produces a fixed-length name rather than a
  // short one — `Math.random().toString(36)` is sometimes shorter than the slice.
  assert.match(newLeaseOwner(() => 0), /^c_.{8}$/);
});

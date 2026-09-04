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
  TERMINAL_RESERVE_MS, CORRECT_FLOOR_MS, PUBLISH_FLOOR_MS, REPAIR_FLOOR_MS, MIN_CORRECT_MS, MIN_BUILD_MS, MIN_VERIFY_MS,
  LEASE_TTL_S, HEARTBEAT_S, STALE_GRACE_S, PUBLISH_LEASE_S,
  EDIT_PHASES, TERMINAL_STATES, isTerminalEdit,
  makeEditBudget, cleanIdemKey, newLeaseOwner, editAsyncOn, editAsyncFor, readCanaryList,
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

// ── THE CANARY GATE ───────────────────────────────────────────────────────
//
// The flag says WHETHER, the allowlist says WHO, and both have to say yes. The
// one mistake this must never make is turning a canary into general traffic
// because a value was typed wrong — so every case below is driven, and the
// malformed ones are checked in the direction that matters.

const CANARY_UID = "22175f41-6fbf-49d7-b039-a65078a0141c";

test("the flag OFF keeps every edit synchronous, whatever the allowlist says", () => {
  for (const flag of [undefined, "", "off", "0", "false", "no", "maybe"]) {
    assert.equal(editAsyncFor({ EDIT_ASYNC: flag, EDIT_ASYNC_CANARY: CANARY_UID }, { uid: CANARY_UID, slug: "fretwork-1" }),
      false, `flag ${JSON.stringify(flag)} routed an edit asynchronously`);
  }
});

test("the flag ON with an EMPTY allowlist keeps every edit synchronous", () => {
  // THE FIRST DEPLOYMENT OF THIS IS EXACTLY THIS STATE: the flag set, nobody
  // listed, and no behaviour changed at all.
  for (const list of [undefined, "", "   ", ",", " , ; ", null, 1, ["x"]]) {
    assert.equal(editAsyncFor({ EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: list }, { uid: CANARY_UID, slug: "fretwork-1" }),
      false, `allowlist ${JSON.stringify(list)} routed an edit asynchronously`);
  }
});

test("a MALFORMED allowlist is an empty one, never a wildcard", () => {
  // The direction of this failure is the whole point. A value nobody meant must
  // keep every edit synchronous — the cost is that a canary does not get the
  // new path, visible in one test edit. The opposite mistake is every customer
  // at once on a path that has never run.
  // THE PROPERTY IS BEHAVIOURAL, NOT LEXICAL — and the first draft got that
  // wrong. It asserted that `all` must not survive `readCanaryList`, and `all`
  // survives because it is a well-formed SLUG: a site could legitimately be
  // called that. Surviving as a literal entry is harmless; what would be a
  // wildcard is MATCHING something it does not name, and it does not. The check
  // was flagging correct code, which this repo rates worse than a miss.
  for (const bad of ["*", "all", "%", ".*", "ALL", "*,*", "'; drop", "..", "/", "http://x", "a".repeat(200)]) {
    const env = { EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: bad };
    assert.equal(editAsyncFor(env, { uid: CANARY_UID, slug: "fretwork-1" }), false,
      `${bad} routed an identity it does not name`);
    assert.equal(editAsyncFor(env, { uid: "someone", slug: "someone-else-1" }), false,
      `${bad} routed an unrelated identity`);
  }
  // The characters that could only ever be a wildcard are dropped outright.
  for (const never of ["*", "%", ".*", "?", "**"]) {
    assert.deepEqual(readCanaryList(never), [], `${never} survived the list at all`);
  }
});

test("the flag ON with a DIFFERENT uid or slug keeps that edit synchronous", () => {
  const env = { EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: CANARY_UID + ", fretwork-1" };
  assert.equal(editAsyncFor(env, { uid: "00000000-0000-0000-0000-000000000000", slug: "someone-else-1" }), false);
  assert.equal(editAsyncFor(env, { uid: "", slug: "fretwork-2" }), false);
  // A PREFIX IS NOT A MATCH. `fretwork-1` must not admit `fretwork-11`.
  assert.equal(editAsyncFor(env, { uid: "", slug: "fretwork-11" }), false);
  assert.equal(editAsyncFor(env, { uid: "", slug: "fretwork" }), false);
  // AND NEITHER IS A SHAPE MISTAKE. `String(["fretwork-1"])` is `"fretwork-1"`,
  // and a coercion here would widen the canary silently.
  assert.equal(editAsyncFor(env, { uid: [CANARY_UID], slug: ["fretwork-1"] }), false);
  assert.equal(editAsyncFor(env, {}), false);
  assert.equal(editAsyncFor(env), false);
});

test("the flag ON with the approved canary identity routes asynchronously", () => {
  const env = { EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: CANARY_UID + ", fretwork-1" };
  // EITHER AXIS, because the two questions a canary asks are different: one
  // account's every edit, or one site's every edit whoever makes it.
  assert.equal(editAsyncFor(env, { uid: CANARY_UID, slug: "anything-else" }), true);
  assert.equal(editAsyncFor(env, { uid: "someone-else", slug: "fretwork-1" }), true);
  assert.equal(editAsyncFor(env, { uid: CANARY_UID.toUpperCase(), slug: "" }), true, "the match is case-sensitive");
  // Separators: comma, space, semicolon and newline all list.
  for (const sep of [",", " ", ";", "\n", ", "]) {
    assert.equal(editAsyncFor({ EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: "other-site" + sep + "fretwork-1" }, { uid: "", slug: "fretwork-1" }),
      true, `separator ${JSON.stringify(sep)} did not list`);
  }
});

test("the deploy's own fallback is one the code reads as absent", () => {
  // THE TWO HALVES HAVE TO AGREE AND THEY LIVE IN DIFFERENT FILES. The workflow
  // needs a NON-EMPTY value (wrangler-action fails the whole deploy on an empty
  // one — it did, on 2026-09-01) and the code needs it to mean "nobody". A
  // sentinel that satisfied one and not the other is either a broken deploy or
  // a canary that is silently everybody.
  const yml = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  const m = /EDIT_ASYNC_CANARY: \$\{\{ secrets\.EDIT_ASYNC_CANARY \|\| '([^']*)' \}\}/.exec(yml);
  assert.ok(m, "the canary secret's fallback is gone or reshaped");
  assert.ok(m[1].length > 0, "the fallback is empty, which wrangler-action treats as a missing secret");
  assert.deepEqual(readCanaryList(m[1]), [], `the deploy's fallback ${JSON.stringify(m[1])} parses as a real allowlist entry`);
  assert.equal(editAsyncFor({ EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: m[1] }, { uid: CANARY_UID, slug: "fretwork-1" }), false,
    "the shipped default routes an edit asynchronously");
});

test("no build route reads the canary configuration", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // EXHAUSTIVE, NOT WINDOWED. A byte window from the build route ran past it
  // into the edit route twice while this was being proved, and reported symbols
  // that are not in it. Locating every occurrence and naming its enclosing
  // top-level definition cannot make that mistake.
  const lines = W.split("\n");
  const owner = (i) => {
    for (let j = i; j >= 0; j--) {
      const m = /^(?:async )?function ([a-zA-Z_$][\w$]*)|^const ([a-zA-Z_$][\w$]*) = |^  async (fetch|queue|scheduled)\(/.exec(lines[j]);
      if (m) return m[1] || m[2] || ("worker." + m[3]);
    }
    return "(top level)";
  };
  const readers = new Set();
  lines.forEach((l, i) => {
    const code = l.replace(/\/\/.*$/, "");
    if (code.includes("EDIT_ASYNC_CANARY") || code.includes("editAsyncFor(") || code.includes("editAsyncOn(")) readers.add(owner(i));
  });
  const BUILD = ["runQueuedSiteBuild", "runResumedSiteBuild", "runSiteBuild", "buildAndPublishPages",
                 "queueBuild", "awaitJobResult", "recompileAndPublish", "runSiteRebuild"];
  const leaked = [...readers].filter((f) => BUILD.includes(f));
  assert.deepEqual(leaked, [], `build-path functions read the canary config: ${leaked.join(", ")}`);
  // AND THE OBSERVER: the scan must have found the readers it does expect, or
  // an empty result would satisfy the absence above for the wrong reason.
  // THE FLOOR IS ONE, AND IT IS ONE ON PURPOSE. `editAsyncFor` subsumes
  // `editAsyncOn`, so worker.js reads the config at exactly one site — the
  // fork. A floor of two was written expecting both names here and would have
  // gone red for an honest simplification; the observer that matters is that
  // the scan found the fork at all.
  assert.ok(readers.size >= 1, `only ${readers.size} readers found — the scan stopped matching`);
  assert.ok(readers.has("handleRequest"), "the fork no longer reads the canary config");
  // AND EXACTLY ONE, which is the stronger statement: a second reader anywhere
  // is a second place the canary could be widened.
  assert.equal(readers.size, 1, `the canary config is read in ${readers.size} places: ${[...readers].join(", ")}`);
});

// ── the publish floor (run 33, 2026-09-03) ──────────────────────────────────

test("a publish needs room, not just time: the floor is the compile, the sweep and the terminal writes", () => {
  // Run 33: 235s left, the old gate said go, and the compile — capped at what
  // was left minus the reserves — was cut at 129s of the 157s it needed.
  assert.equal(PUBLISH_FLOOR_MS, MIN_BUILD_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS);
  let t = 0;
  const b = makeEditBudget(EDIT_JOB_MS, () => t);
  assert.equal(b.canPublish(), true);
  t = EDIT_JOB_MS - PUBLISH_FLOOR_MS;
  assert.equal(b.canPublish(), true, "exactly the floor is enough");
  t += 1;
  assert.equal(b.canPublish(), false, "one millisecond under the floor is not");
  // And the floor is below the point where `expired()` would already refuse,
  // or it would never be the thing that answers.
  assert.ok(PUBLISH_FLOOR_MS > PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS);
  // Run 33's shape fits now: the publish began at 545s; with fourteen minutes
  // the compile cap is what is left minus the reserves, and it must clear the
  // 157s a compile measured on run 32.
  const left = EDIT_JOB_MS - 545000;
  assert.ok(left >= PUBLISH_FLOOR_MS, "run 33's publish would still be refused by the floor");
  assert.ok(left - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS >= 157000 + 30000,
    "run 33's compile (157s) would still be cut by its cap, with no margin for a cold container");
});

// ── the repair floor (owner, 2026-09-04: "try to fix it, if not fix, send as it is") ──

test("a repair round needs a call, a compile and the publish: the floor is those parts, asked before anything is spent", () => {
  assert.equal(REPAIR_FLOOR_MS, MIN_CORRECT_MS + MIN_BUILD_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS);
  // More than a bare publish needs, less than the correction round (which
  // also verifies) — or one of the three would never be the one that answers.
  assert.ok(REPAIR_FLOOR_MS > PUBLISH_FLOOR_MS, "a repair needs the compile's room and a call's on top");
  assert.ok(REPAIR_FLOOR_MS <= CORRECT_FLOOR_MS, "a repair is a correction without the verification");
  let t = 0;
  const b = makeEditBudget(EDIT_JOB_MS, () => t);
  assert.equal(b.canRepair(), true);
  t = EDIT_JOB_MS - REPAIR_FLOOR_MS;
  assert.equal(b.canRepair(), true, "exactly the floor is enough");
  t += 1;
  assert.equal(b.canRepair(), false, "one millisecond under the floor is not");
  // RUN 34'S SHAPES, off `edit_jobs.phase_ms`: the function addon (picker 16s,
  // designer 22s, component 43s, page call 303s) reached its publish at ~385s
  // and would have had room; the two-kind table addon reached it at ~540s and
  // would not — shipped as it is, said so. The api addon (~200s) had room.
  t = 385000; assert.equal(b.canRepair(), true, "run 34's function addon would be denied a repair it had room for");
  t = 200000; assert.equal(b.canRepair(), true);
  t = 540000; assert.equal(b.canRepair(), false, "run 34's table addon would start a repair that cannot land");
});

test("the numbers are measurements, not guesses: the sweep reserve covers the measured sweep, the teardown room the measured teardown", () => {
  // Run 32's trace: container answered at 521.3s, publish:1 ok at 560.1s —
  // the R2 sweep took 38.8s. Run 33: the deadline fired at 674.5s and the
  // terminal state was written 4.3s later.
  assert.ok(PUBLISH_RESERVE_MS >= 38800 * 1.5, "the sweep reserve is under the measured sweep with half again");
  // AND NOT ABOVE TWICE IT: a reserve far past the measurement is what cut
  // run 33's compile — every second held back here is a second the compile
  // is not allowed. The old 90s was 2.3 times the sweep.
  assert.ok(PUBLISH_RESERVE_MS <= 38800 * 2, "the sweep reserve is more than twice the measured sweep, starving the compile");
  assert.ok(CONSUMER_CEILING_MS - EDIT_JOB_MS >= 4300 * 10, "the teardown room is under ten times the measured teardown");
  assert.ok(CONSUMER_CEILING_MS - EDIT_JOB_MS <= 120000, "the teardown room is back to a guess");
});

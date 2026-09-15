import test from "node:test";
import assert from "node:assert/strict";
import {
  LIMIT_DEFAULTS, LIMIT_NAMES, RUN_TOTALS, DURATION_LIMITS,
  okLimit, planLimits, narrowLimits, leftOf, stoppedBy, capMs,
} from "../src/limits.mjs";

// ── the observer ─────────────────────────────────────────────────────────────
// Every case below iterates a derived name list. A list that stopped being
// derived would make most of this file vacuously green, so the floor comes
// first: "a negative assertion must prove its observer is alive".
test("the name lists are derived and non-empty", () => {
  assert.ok(LIMIT_NAMES.length >= 8, `only ${LIMIT_NAMES.length} bounds found`);
  assert.deepEqual(LIMIT_NAMES, Object.keys(LIMIT_DEFAULTS),
    "LIMIT_NAMES has stopped being derived from LIMIT_DEFAULTS — two lists of one thing");
  for (const n of RUN_TOTALS) assert.ok(LIMIT_NAMES.includes(n), `${n} is a total but not a bound`);
  for (const n of DURATION_LIMITS) assert.ok(LIMIT_NAMES.includes(n), `${n} is a duration but not a bound`);
  assert.ok(Object.isFrozen(LIMIT_DEFAULTS), "the defaults are mutable");
});

test("RUN_TOTALS is the per-run bounds and excludes exactly the per-operation ones", () => {
  // Stated as a partition rather than a list, so a bound added next month is
  // forced into one side or the other instead of silently being neither.
  const perOp = ["callMs", "toolMs", "parallelTools"];
  assert.deepEqual([...RUN_TOTALS].sort(), LIMIT_NAMES.filter((n) => !perOp.includes(n)).sort());
  for (const n of perOp) assert.ok(!RUN_TOTALS.includes(n), `${n} would end a run, and it bounds one operation`);
});

// ── okLimit: refuses, never coerces ──────────────────────────────────────────
test("okLimit refuses everything that is not a number, and never coerces", () => {
  for (const good of [0, 1, 16, 300_000, Infinity]) assert.equal(okLimit(good), true, `${good} refused`);
  // `String(["8"])` is "8" and `Number(["8"])` is 8, so a coercing reader takes an
  // array as a bound and nothing anywhere complains.
  for (const bad of [["8"], "8", "", null, undefined, {}, true, false, NaN, -1, -Infinity, () => 8]) {
    assert.equal(okLimit(bad), false, `${JSON.stringify(bad) ?? String(bad)} accepted as a bound`);
  }
  // NaN specifically: every comparison against it is false, so a NaN bound is an
  // ABSENT bound wearing a number's clothes.
  assert.equal(okLimit(NaN), false);
  assert.equal(NaN >= 1, false, "the reason NaN must be refused, stated as the fact it rests on");
});

// ── planLimits ───────────────────────────────────────────────────────────────
test("planLimits with nothing asked is the defaults", () => {
  const p = planLimits();
  for (const n of LIMIT_NAMES) assert.equal(p[n], LIMIT_DEFAULTS[n], `${n} is not its default`);
  assert.deepEqual([...p.narrowed], []);
  assert.deepEqual([...p.refused], []);
  assert.deepEqual([...p.unknown], []);
});

test("planLimits is the TRUSTED door: an author may set any usable bound, up OR down", () => {
  // The trust boundary. An agent definition is code the developer wrote, and a
  // developer who wants a 200-step agent is entitled to one — the untrusted
  // parties are the model and the tenant, who narrow through `narrowLimits`.
  const smaller = planLimits({ steps: 4 });
  assert.equal(smaller.steps, 4);
  const bigger = planLimits({ steps: LIMIT_DEFAULTS.steps + 400 });
  assert.equal(bigger.steps, LIMIT_DEFAULTS.steps + 400, "the author could not raise their own bound");
  assert.deepEqual([...bigger.narrowed], [], "planLimits narrowed a trusted ask");
});

test("AN UNBOUNDED BUDGET IS REACHABLE FROM THE PUBLIC API", () => {
  // THE REGRESSION. The first draft clamped every ask to the default, so
  // `Infinity` could not be asked for at all and every Infinity branch in the
  // module was dead code from outside — correct in the module, unreachable in
  // practice. A container with no clock is a real thing this stack already has.
  const p = planLimits({ wallMs: Infinity, tokens: Infinity, costMicros: Infinity });
  assert.equal(p.wallMs, Infinity, "an unbounded run cannot be asked for");
  assert.equal(p.tokens, Infinity);
  assert.equal(stoppedBy(p, { tokens: null, costMicros: null, steps: 1 }), null,
    "an unbounded plan built through the public door still stopped");
});

test("narrowLimits IS THE UNTRUSTED DOOR — it may only ever reduce", () => {
  const base = planLimits({ steps: 10 });
  assert.equal(narrowLimits(base, { steps: 4 }).steps, 4, "a narrowing ask was ignored");
  const raised = narrowLimits(base, { steps: 4000 });
  assert.equal(raised.steps, 10, "an untrusted caller RAISED a bound");
  // And it says so: a filter on somebody's input is a silent drop, a record is a
  // sentence.
  assert.deepEqual([...raised.narrowed], ["steps"], "the raise was ignored SILENTLY");
  // A finite ask narrows an unbounded plan, and an unbounded ask cannot widen a
  // finite one. Both directions of Math.min's Infinity behaviour.
  assert.equal(narrowLimits(planLimits({ wallMs: Infinity }), { wallMs: 5 }).wallMs, 5);
  assert.equal(narrowLimits(planLimits({ wallMs: 5 }), { wallMs: Infinity }).wallMs, 5,
    "an unbounded ask widened a finite plan");
});

test("narrowLimits may only reduce for EVERY bound — no bound is exempt", () => {
  const base = planLimits();
  let raisesTried = 0;
  for (const n of LIMIT_NAMES) {
    if (base[n] !== Infinity) {
      // A base of Infinity cannot be raised above, so the raise half would be
      // VACUOUSLY green there. Counted and floored below rather than left to
      // look like a check that ran.
      const p = narrowLimits(base, { [n]: base[n] * 2 + 1 });
      assert.equal(p[n], base[n], `${n} could be raised by an untrusted caller`);
      assert.deepEqual([...p.narrowed], [n], `${n} was raised-then-ignored SILENTLY`);
      raisesTried++;
    }
    assert.equal(narrowLimits(base, { [n]: 0 })[n], 0, `${n} could not be narrowed to 0`);
  }
  assert.ok(raisesTried >= 8, `only ${raisesTried} bounds were actually tested for a raise`);
});

test("narrowLimits refuses what it cannot use, and reports it", () => {
  const base = planLimits();
  const p = narrowLimits(base, { steps: "4", nope: 1 });
  assert.equal(p.steps, base.steps, '"4" was coerced to 4');
  assert.deepEqual([...p.refused], ["steps"]);
  assert.deepEqual([...p.unknown], ["nope"]);
  for (const bad of [null, 4, "steps"]) {
    assert.throws(() => narrowLimits(bad, {}), TypeError);
    assert.throws(() => narrowLimits(base, bad), TypeError);
  }
});

test("an unusable bound falls back to the default and is REPORTED, not coerced", () => {
  const p = planLimits({ steps: "4", tokens: NaN, wallMs: -1 });
  assert.equal(p.steps, LIMIT_DEFAULTS.steps, '"4" was coerced to 4');
  assert.equal(p.tokens, LIMIT_DEFAULTS.tokens);
  assert.equal(p.wallMs, LIMIT_DEFAULTS.wallMs);
  assert.deepEqual([...p.refused].sort(), ["steps", "tokens", "wallMs"]);
});

test("a key that is not a bound is reported, so a typo is a sentence", () => {
  const p = planLimits({ maxSteps: 4 });
  assert.deepEqual([...p.unknown], ["maxSteps"]);
  assert.equal(p.steps, LIMIT_DEFAULTS.steps, "an unknown key changed a real bound");
});

test("planLimits refuses a non-object rather than reading past it", () => {
  for (const bad of [null, 4, "steps", true]) {
    assert.throws(() => planLimits(bad), TypeError, `planLimits(${String(bad)}) did not throw`);
  }
  // `Object.hasOwn`, never truthiness: `want["constructor"]` is truthy on every
  // object literal, so a truthiness reader invents a bound nobody asked for.
  const p = planLimits({});
  assert.equal(p.steps, LIMIT_DEFAULTS.steps);
  assert.deepEqual([...p.unknown], [], "an inherited key read as an asked-for one");
});

// ── Infinity is a stated answer ──────────────────────────────────────────────
test("Infinity survives every reader", () => {
  // The failure this guards against: a reader calls `Number.isFinite`, gets false
  // for a bound that was stated deliberately, and substitutes a default.
  assert.equal(okLimit(Infinity), true);
  assert.equal(leftOf(Infinity, 999_999_999), Infinity, "an unbounded budget was spent");
  assert.equal(capMs(Infinity, Infinity), Infinity, "two unbounded clocks produced a number");
  assert.equal(stoppedBy({ ...planLimits(), steps: Infinity }, { steps: 1e9 }), null,
    "an unbounded step budget ended a run");
  assert.equal(Number.isFinite(Infinity), false,
    "the fact the trap rests on: the obvious guard reads Infinity as unusable");
});

// ── leftOf ───────────────────────────────────────────────────────────────────
test("leftOf: an UNMEASURED spend answers null, never zero-spent", () => {
  assert.equal(leftOf(100, 40), 60);
  assert.equal(leftOf(100, 100), 0);
  assert.equal(leftOf(100, 140), 0, "a bound overshot went negative");
  assert.equal(leftOf(100, null), null, "an unknown spend read as no spend");
  assert.equal(leftOf(100, undefined), null);
  assert.equal(leftOf(100, NaN), null);
  assert.equal(leftOf(NaN, 1), null, "an unusable bound answered a number");
});

// ── stoppedBy ────────────────────────────────────────────────────────────────
test("stoppedBy answers null while the run is inside every bound", () => {
  assert.equal(stoppedBy(planLimits(), { steps: 1, tokens: 10, wallMs: 5, costMicros: 1, toolCalls: 1 }), null);
  assert.equal(stoppedBy(planLimits(), {}), null, "an untouched run read as spent");
});

test("stoppedBy NAMES the bound that ended the run, for every per-run bound", () => {
  // A census, not a case: a run ending on `steps` needs a different fix from one
  // ending on `costMicros`, so each must be reachable and each must say so.
  for (const bound of RUN_TOTALS) {
    const plan = planLimits();
    const hit = stoppedBy(plan, { [bound]: plan[bound] });
    assert.ok(hit, `${bound} could be reached without ending the run`);
    assert.equal(hit.bound, bound, `a stop on ${bound} reported ${hit.bound}`);
    assert.equal(hit.reason, "spent");
    assert.equal(hit.limit, plan[bound]);
    assert.equal(hit.used, plan[bound]);
  }
});

test("A PER-OPERATION BOUND NEVER ENDS THE RUN — with a live control", () => {
  const plan = planLimits();
  for (const bound of ["callMs", "toolMs", "parallelTools"]) {
    // Spend it far past its ceiling: it still must not end the run.
    assert.equal(stoppedBy(plan, { [bound]: plan[bound] * 10 }), null,
      `${bound} ended the run, and it bounds one operation rather than the run`);
  }
  // THE CONTROL. Without it this case also passes against a stoppedBy that can
  // never stop anything — the vacuous-negative trap.
  const control = stoppedBy(plan, { steps: plan.steps });
  assert.ok(control && control.bound === "steps",
    "the observer is dead: stoppedBy cannot report a stop at all");
});

test("A FINITE BOUND WITH A BROKEN METER IS A NAMED STOP, an infinite one is not", () => {
  const finite = stoppedBy(planLimits({ tokens: 1000 }), { tokens: null });
  assert.ok(finite, "a budget we cannot measure was treated as one we are inside");
  assert.equal(finite.bound, "tokens");
  assert.equal(finite.reason, "unmeasured");
  assert.equal(finite.used, null, "an unmeasured spend was reported as a number");

  // The other half, and it is the one that keeps this from being a nuisance:
  // against an unbounded budget there is nothing to be outside of.
  assert.equal(stoppedBy({ ...planLimits(), tokens: Infinity }, { tokens: null }), null,
    "an unmeasured spend stopped a run with no budget to exceed");

  // NaN is the same case as null, because it is a number that fails every
  // comparison — the meter is broken either way.
  const nan = stoppedBy(planLimits({ tokens: 1000 }), { tokens: NaN });
  assert.equal(nan?.reason, "unmeasured", "NaN slipped through as a measured spend");
});

// ── capMs ────────────────────────────────────────────────────────────────────
test("capMs is min(cap, room) and is correct at every Infinity", () => {
  assert.equal(capMs(120_000, 300_000), 120_000, "the cap did not bind");
  assert.equal(capMs(120_000, 5_000), 5_000, "the room did not bind");
  assert.equal(capMs(120_000, Infinity), 120_000, "an unbounded run lost its per-call cap");
  assert.equal(capMs(Infinity, 5_000), 5_000, "an uncapped call outran the room it had");
  assert.equal(capMs(Infinity, Infinity), Infinity);
  // The safety argument for an unbounded run is that every per-call ceiling
  // survives it. Easy to believe and worth nothing until it is driven, so here it
  // is driven.
  assert.equal(capMs(LIMIT_DEFAULTS.callMs, Infinity), LIMIT_DEFAULTS.callMs);
});

test("capMs answers something usable when handed rubbish, and prefers the real one", () => {
  assert.equal(capMs(NaN, 5_000), 5_000, "an unusable cap threw away a real room");
  assert.equal(capMs(120_000, NaN), 120_000, "an unusable room threw away a real cap");
  assert.equal(capMs(NaN, NaN), 0, "two unusable bounds produced an unbounded call");
});

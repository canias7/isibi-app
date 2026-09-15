/**
 * THE BOUNDS ON ONE AGENT RUN — the whole safety argument, in one module.
 *
 * An agent loop is a `while (true)` around a model that decides when to stop.
 * Every bound here exists because the model's own judgement is not a bound: a cap
 * the model is only told about is not a cap, which is why this is a file and not
 * a paragraph in a prompt.
 *
 * DEPENDENCY-FREE AND PURE. No clock, no fetch, no storage: `now` is passed in.
 * That is what lets every branch below be driven in a test instead of waited on.
 *
 * TWO LAWS ARE BAKED IN HERE ON PURPOSE:
 *
 *   1. `Infinity` IS A STATED ANSWER, never a missing one. Some things really do
 *      run without a clock, and the obvious guard — `Number.isFinite` — reads that
 *      stated answer as unusable and substitutes a default, for the one input
 *      where a default is the most wrong answer available. Every reader below
 *      takes `Infinity` and means it.
 *
 *   2. A STOP MUST NAME ITSELF. `stoppedBy` answers WHICH bound ended the run,
 *      never a boolean. A run that ended on `steps` needs a different fix from
 *      one that ended on `costMicros`, and collapsing them into "it failed" is
 *      the one way this module could mislead rather than go quiet.
 */

// ── the defaults ─────────────────────────────────────────────────────────────
//
// Deliberately conservative. A framework's default must be the one that cannot
// surprise somebody with a bill; an author who wants more says so.
export const LIMIT_DEFAULTS = Object.freeze({
  steps: 16,           // model calls in one run — the runaway-loop bound
  toolCalls: 64,       // tool executions in one run
  parallelTools: 8,    // how many may be in flight at once
  wallMs: 300_000,     // the whole run, 5 minutes
  callMs: 120_000,     // any ONE model call
  toolMs: 30_000,      // any ONE tool execution
  tokens: 1_000_000,   // the run's token budget, all kinds counted
  costMicros: 2_000_000, // the run's money budget, millionths of a unit
});

// The names, derived from the defaults so a bound added above is bounded below
// without anybody remembering to list it. Two lists of one thing is this
// repository's most repeated drift.
export const LIMIT_NAMES = Object.freeze(Object.keys(LIMIT_DEFAULTS));

// Which bounds are DURATIONS. Needed because a duration is spent by the clock
// and everything else is spent by a counter, and the two are compared against
// different things.
export const DURATION_LIMITS = Object.freeze(["wallMs", "callMs", "toolMs"]);

// Which bounds are PER-RUN TOTALS — the ones `stoppedBy` can end a run on. A
// per-call ceiling (`callMs`, `toolMs`, `parallelTools`) bounds one operation
// and never ends the run, so reading it as a stop would report a finished run
// as a refused one.
export const RUN_TOTALS = Object.freeze(
  LIMIT_NAMES.filter((n) => n !== "callMs" && n !== "toolMs" && n !== "parallelTools"),
);

/**
 * A number a bound may take: a non-negative finite number, or `Infinity`.
 *
 * REFUSES rather than coerces. `String(["8"])` is `"8"` and `Number("8")` is 8,
 * so a coercing reader accepts an array as a bound — shipped as a real bug three
 * a real bug. NaN is refused too: every comparison against NaN is
 * false, so a NaN bound is an ABSENT bound wearing a number's clothes.
 */
export function okLimit(v) {
  if (typeof v !== "number") return false;
  // NaN IS REFUSED, AND NOT BY A LINE OF ITS OWN. An explicit `Number.isNaN`
  // check used to sit here; a mutation sweep survived its removal, and measuring
  // both versions over 23 input classes found ZERO behavioural difference —
  // `Number.isFinite(NaN)` is false and `NaN >= 0` is false, so NaN is already
  // refused twice below, independently. The line was redundant rather than a
  // second wall worth keeping, so it is gone. Do not add it back: it cannot
  // change an answer, and a guard that cannot fail is one a sweep can only ever
  // report as a gap that is not there.
  return v === Infinity || (Number.isFinite(v) && v >= 0);
}

/**
 * The plan for one run: the defaults, overridden by what the AUTHOR asked for.
 *
 * **WHO IS TRUSTED HERE, AND WHY THIS IS NOT A CEILING.** The first draft let an
 * override only ever NARROW. That rule is right where every other number is
 * DERIVED AT IMPORT from one setting, because then a longer setting moves the
 * deadline past all of them — but nothing here is derived at import, `capMs`
 * computes per call, so the premise did not hold. Applying it anyway cost
 * something real: `Infinity` became unreachable from the public API, which made
 * every Infinity branch in this file dead code from outside. A rule is only as
 * true as the thing it rests on, and a feature that is correct in the module and
 * unreachable in practice is not a feature.
 *
 * So the trust boundary is drawn where it actually falls. **An agent definition
 * is CODE, written by the developer**, and a developer who wants a 200-step agent
 * or an unbounded token budget is entitled to one — the untrusted parties are the
 * MODEL and the TENANT, not the author. A caller who is not trusted narrows
 * through `narrowLimits` below, which is the half that may only ever reduce.
 *
 * A value this cannot read falls back to the default and is REPORTED in
 * `refused`, never coerced; a key that is not a bound is reported in `unknown`,
 * so a typo (`maxSteps` for `steps`) is a sentence instead of a setting that
 * silently does nothing.
 */
export function planLimits(want = {}) {
  if (want === null || typeof want !== "object") {
    throw new TypeError("planLimits: want must be an object");
  }
  const out = {};
  const refused = [];
  for (const name of LIMIT_NAMES) {
    const asked = Object.hasOwn(want, name) ? want[name] : undefined;
    if (asked === undefined) { out[name] = LIMIT_DEFAULTS[name]; continue; }
    if (!okLimit(asked)) { out[name] = LIMIT_DEFAULTS[name]; refused.push(name); continue; }
    out[name] = asked;
  }
  // `Object.hasOwn`, never truthiness: `want["constructor"]` is truthy on every
  // object literal, so a truthiness reader invents a bound nobody asked for.
  const unknown = Object.keys(want).filter((k) => !LIMIT_NAMES.includes(k));
  return Object.freeze({
    ...out,
    narrowed: Object.freeze([]),
    refused: Object.freeze(refused),
    unknown: Object.freeze(unknown),
  });
}

/**
 * NARROW A PLAN, FOR A CALLER THAT IS NOT TRUSTED TO RAISE ONE.
 *
 * This is the half the "may only shorten" rule really belongs to: a per-run
 * override that may come from a tenant, a request body or a config file. A
 * smaller number is taken; a larger one is IGNORED AND RECORDED in `narrowed`,
 * because a filter on somebody's input is a silent drop and a record is a
 * sentence — nobody should spend an afternoon on a setting that does nothing.
 *
 * `Math.min` is Infinity-correct in both directions: `min(Infinity, 16)` is 16
 * and `min(4, Infinity)` is 4, so a finite ask narrows an unbounded plan and an
 * unbounded ask cannot widen a finite one.
 */
export function narrowLimits(plan, want = {}) {
  if (plan === null || typeof plan !== "object") {
    throw new TypeError("narrowLimits: plan must be a plan from planLimits");
  }
  if (want === null || typeof want !== "object") {
    throw new TypeError("narrowLimits: want must be an object");
  }
  const out = {};
  const narrowed = [];
  const refused = [];
  for (const name of LIMIT_NAMES) {
    const base = okLimit(plan[name]) ? plan[name] : LIMIT_DEFAULTS[name];
    const asked = Object.hasOwn(want, name) ? want[name] : undefined;
    if (asked === undefined) { out[name] = base; continue; }
    if (!okLimit(asked)) { out[name] = base; refused.push(name); continue; }
    const kept = Math.min(asked, base);
    if (kept !== asked) narrowed.push(name);
    out[name] = kept;
  }
  const unknown = Object.keys(want).filter((k) => !LIMIT_NAMES.includes(k));
  return Object.freeze({
    ...out,
    narrowed: Object.freeze(narrowed),
    refused: Object.freeze(refused),
    unknown: Object.freeze(unknown),
  });
}

/**
 * How much of one bound is left. `Infinity` minus anything is `Infinity`.
 *
 * AN UNMEASURED SPEND IS NOT A ZERO SPEND. If a provider does not report token
 * usage, `spent.tokens` is `null` — and a reader that treats that as 0 lets a
 * run spend for ever against a budget it believes it is inside. `null` answers
 * `null` here, and `stoppedBy` below turns that into a named stop when, and
 * only when, the bound it cannot measure is finite.
 */
export function leftOf(limit, used) {
  if (used === null || used === undefined) return null;
  if (!okLimit(limit)) return null;
  if (limit === Infinity) return Infinity;
  if (typeof used !== "number" || Number.isNaN(used)) return null;
  return Math.max(0, limit - used);
}

/**
 * WHICH BOUND ENDED THE RUN, or `null` for "carry on".
 *
 * Answers a NAME so the caller can say what happened, and so two stops needing
 * opposite fixes are distinguishable from outside. The shape is
 * `{ bound, reason, limit, used }` where `reason` is:
 *
 *   `"spent"`      — the bound is finite and has been reached.
 *   `"unmeasured"` — the bound is FINITE and the meter is broken, so we cannot
 *                    prove we are inside it. Refusing to continue is the only
 *                    honest answer: the alternative is enforcing a budget by
 *                    assuming the thing we failed to measure was free. Against
 *                    an INFINITE bound an unknown meter is harmless and is not
 *                    a stop, because there is nothing to be outside of.
 *
 * `used.wallMs` is derived by the caller from its own clock and passed in, so
 * this stays pure and the wall-clock branch is drivable without waiting.
 */
export function stoppedBy(plan, used = {}) {
  for (const bound of RUN_TOTALS) {
    const limit = plan[bound];
    if (limit === Infinity) continue;           // nothing to be outside of
    const u = Object.hasOwn(used, bound) ? used[bound] : 0;
    if (u === null || u === undefined) {
      return { bound, reason: "unmeasured", limit, used: null };
    }
    if (typeof u !== "number" || Number.isNaN(u)) {
      return { bound, reason: "unmeasured", limit, used: null };
    }
    if (u >= limit) return { bound, reason: "spent", limit, used: u };
  }
  return null;
}

/**
 * The ceiling for ONE operation: never more than its own cap, and never more
 * than the run has left: `min(cap, room)`. The safety argument is that every
 * per-call ceiling survives an unbounded total — easy to believe and worth
 * nothing until it is driven, so it is driven.
 *
 * With `room` Infinity the answer is the cap; with a cap of Infinity it is the
 * room; with both Infinity it is Infinity, which is a real answer meaning "this
 * operation is not bounded by time" and must not be turned into a number here.
 */
export function capMs(cap, room) {
  if (!okLimit(cap)) return okLimit(room) ? room : 0;
  if (!okLimit(room)) return cap;
  return Math.min(cap, room);
}

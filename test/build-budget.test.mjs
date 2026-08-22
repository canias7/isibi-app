// One budget for the whole build.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeBudget, budgetNote, BUILD_BUDGET_MS, CONTAINER_CALL_MS } from "../builder/build-budget.mjs";

/** A clock a test drives, so nothing here waits on real time. */
function fakeClock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("the two bounds COMPOSE rather than compete", () => {
  // THE WHOLE POINT. A per-call bound of ten minutes and a build budget of
  // fifteen must not add up to twenty-five — a pages call started at minute
  // fourteen gets what is LEFT, which is a minute.
  const c = fakeClock();
  const b = makeBudget(900000, c.now);
  assert.equal(b.capMs(600000), 600000, "with the whole budget left, the call's own bound is what binds");
  c.advance(840000);                       // fourteen minutes in
  assert.equal(b.capMs(600000), 60000, "the call was given another ten minutes on a budget with one left");
});

test("a call with nothing left gets a real bound, never zero", () => {
  // `AbortSignal.timeout(0)` aborts on the next tick, which is indistinguishable
  // from the provider hanging up — the exact confusion `isCallTimeout` exists to
  // end. A caller with no time should ask `expired()` and refuse in words.
  const c = fakeClock();
  const b = makeBudget(900000, c.now);
  c.advance(999999);
  assert.equal(b.capMs(600000), 1000, "a spent budget produced a zero timeout");
  assert.equal(b.remainingMs(), 0);
  assert.equal(b.expired(), true);
});

test("expiry is the boundary, not past it", () => {
  const c = fakeClock();
  const b = makeBudget(1000, c.now);
  c.advance(999);
  assert.equal(b.expired(), false);
  c.advance(1);
  assert.equal(b.expired(), true, "a build exactly at its budget is out of time");
});

test("a nonsense budget is the DEFAULT, never zero", () => {
  // Read as zero, a config typo refuses every build on the platform instantly —
  // by a module whose whole job is to be unobtrusive. The same fail-safe
  // direction `pruneVersions` and the audit-log retention already take.
  for (const bad of [undefined, null, 0, -5, NaN, Infinity, "900000", {}]) {
    const b = makeBudget(bad, fakeClock().now);
    assert.equal(b.totalMs, BUILD_BUDGET_MS, `makeBudget(${JSON.stringify(bad)}) did not fall back`);
    assert.equal(b.expired(), false, `makeBudget(${JSON.stringify(bad)}) starts already expired`);
  }
});

test("a clock that throws reads as NO time elapsed, so the build finishes", () => {
  // The direction matters and it is the opposite of the usual fail-closed rule.
  // This module is not what the customer paid for: being wrong toward refusing a
  // healthy build is the more expensive mistake, and a broken clock is ours.
  const b = makeBudget(900000, () => { throw new Error("no clock"); });
  assert.equal(b.expired(), false);
  assert.equal(b.remainingMs(), 900000);
  assert.equal(b.capMs(600000), 600000);
});

test("a clock that goes BACKWARDS does not hand out more than the budget", () => {
  // Not hypothetical on a distributed runtime: `Date.now()` can step back. Read
  // naively that is negative elapsed time, which makes `capMs` exceed the call's
  // own bound and quietly un-does `BUILDER_CALL_MS`.
  let t = 100000;
  const b = makeBudget(900000, () => t);
  t = 0;
  assert.ok(b.capMs(600000) <= 600000, "a backwards clock widened the per-call bound");
  assert.ok(b.remainingMs() <= 900000, "a backwards clock created time that does not exist");
});

test("the budget sits below the runner cap and above the slowest build that ever published", () => {
  // MEASURED, not chosen. Builds that finished: 272s, 378s, 507s. The runner cap
  // is 30 minutes and a budget at or above it refuses nothing — it just fails
  // later, which is exactly what happens today.
  assert.ok(BUILD_BUDGET_MS > 507000 * 1.5,
    "the budget would refuse a build of a length that has really published");
  assert.ok(BUILD_BUDGET_MS < 30 * 60000,
    "the budget expires after the runner cap, so it can never be the thing that answers");
  // AND THE CONTAINER CEILING FITS INSIDE IT. A container bound longer than the
  // whole build's budget can never be what answers — `capMs` would clamp it on
  // every build, which is the ceiling silently not existing. Above the measured
  // 261s container slice with real room, since `STEP_TIMEOUT` is 150s a step and
  // a legitimately slow run is minutes.
  assert.ok(CONTAINER_CALL_MS > 261000 * 1.5,
    "the container ceiling would refuse a run of a length that has really published");
  assert.ok(CONTAINER_CALL_MS < BUILD_BUDGET_MS,
    "the container ceiling outlives the build budget, so it can never be the thing that answers");
});

test("the refusal names the stage, because the two ends mean opposite things", () => {
  // Out of time before the pages were written is a build that produced nothing;
  // out of time at the publish is work that exists and is not yet served. One
  // sentence for both sends half of them to do the wrong thing.
  const design = budgetNote("design");
  const generate = budgetNote("generate");
  const publish = budgetNote("publish");
  assert.notEqual(design, generate);
  assert.notEqual(generate, publish);
  assert.match(design, /nothing was set up/i);
  assert.match(generate, /database is live/i);
  assert.match(publish, /written/i);
  // AND IT PROMISES NOTHING ABOUT MONEY. `ourFault(stage)` decides that a layer
  // up, and a refund promised here that the ledger did not make is the worse of
  // the two lies.
  for (const s of ["design", "provision", "generate", "publish", "", null, "whatever"]) {
    assert.doesNotMatch(budgetNote(s), /refund|credit|charge|free/i,
      `budgetNote(${JSON.stringify(s)}) makes a promise about money it cannot keep`);
  }
});

test("nothing it does can throw", () => {
  // The recorder next door already lives under this rule, for the same reason: a
  // build must never be lost to the thing measuring it.
  const b = makeBudget(900000, () => { throw new Error("x"); });
  assert.doesNotThrow(() => { b.expired(); b.remainingMs(); b.usedMs(); b.capMs(1); b.capMs("x"); });
});

test("it is a leaf, so all of it is testable outside the Worker", () => {
  const src = fs.readFileSync(new URL("../builder/build-budget.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /^import /m, "the budget grew a dependency and stopped being drivable on its own");
});

/* ------------------------------------------------------------- the wiring */
//
// THE LAYER TWELVE FEATURES HAVE DIED IN. Every assertion above is about a
// module that could be perfect and reached by nothing — which is the state
// `teamScope` was in at five separate layers and `xaiSkipped` was in with zero
// callers. What has to hold is that the build route MAKES one, that both model
// calls GET it, and that it never reaches the wire.

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
/** Comments blanked length-preserving: this file explains the budget at length,
 *  and prose describing a thing contains that thing's spelling — the trap this
 *  repo has recorded in a lint, a router guard, an absence check and a scope
 *  scan. Length-preserving so every index below stays valid against the real
 *  text. */
// WHOLE-LINE COMMENTS ONLY, and that is not fussiness. Blanking from any `//`
// eats a line holding a URL — `c.fetch(new Request("http://build/build"` is
// blanked from `//build/build` onward, so the container scan below found ZERO
// fetches and reported a clean sweep over nothing. It did exactly that on its
// first run. The same rule `site-locale.mjs`'s guard already lives under.
// Length-preserving, so every index stays valid against the real text.
const CODE = WORKER.replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length));

/**
 * The parameter list of `async function <name>(…)`, read by BRACKET DEPTH.
 *
 * A flat `\(([^)]*)\)` is wrong here and my own first draft of these guards used
 * one: `designSiteSchema(env, brief, model = modelsFor().design, …)` has a
 * default value containing a call, so the flat form stops at `modelsFor(` and
 * reports a signature that ends four parameters early. It failed on its first
 * run, which is the guard working — and it is the fifth time this repo has
 * written a flat scan where a depth-aware one was needed.
 */
function paramsOf(src, name) {
  const at = src.indexOf(`async function ${name}(`);
  if (at < 0) return null;
  let i = src.indexOf("(", at), d = 0;
  const start = i + 1;
  for (; i < src.length; i++) {
    if (src[i] === "(") d++;
    else if (src[i] === ")" && --d === 0) return src.slice(start, i);
  }
  return null;
}

test("THE BUDGET NEVER REACHES THE WIRE — it is an argument, not a field on the request", () => {
  // THE BUG THIS EXISTS FOR WAS ONE EDIT AWAY FROM SHIPPING. The first draft set
  // `req.budget = budget` in both callers, which reads perfectly and is fatal:
  // the Anthropic branch sends `JSON.stringify(req)`, so the budget would have
  // gone out as `"budget":{"totalMs":900000}` — an unknown top-level field, which
  // that API answers 400 to. EVERY Anthropic build on the platform, refused, by
  // the thing added to stop builds being abandoned.
  //
  // AND THE xAI BRANCH WOULD HAVE BEEN FINE, which is what makes it worth a
  // guard: `toXaiRequest` names the fields it sends, so a Grok test run would
  // have passed clean and the failure would have arrived live on the other
  // provider.
  assert.doesNotMatch(CODE, /\breq\.budget\s*=/,
    "the budget is being parked on the request object, which is what gets stringified onto the wire");
  // …and the signature really takes one, so the property above is not satisfied
  // by a budget that reaches the call by no route at all.
  const sig = paramsOf(CODE, "callBuilderModel");
  assert.ok(sig, "callBuilderModel is gone");
  assert.match(sig, /\bbudget\b/, "callBuilderModel no longer takes the build's budget");
});

test("the build route makes ONE budget, and both model calls are given it", () => {
  // DERIVED FROM THE CALLS, not a list of the two that exist today. A third
  // model call added to the build later has to be covered without anybody
  // remembering this file — that is exactly how `xaiSkipped` came to be
  // exported, tested, documented and called by nothing.
  assert.match(CODE, /const budget = makeBudget\(\)/,
    "the build route no longer starts a budget — the whole build is unbounded again");

  // Every call that FORWARDS a budget must forward the same binding.
  const fwd = [...CODE.matchAll(/callBuilderModel\(env,\s*\w+,\s*(\w+)\)/g)].map((m) => m[1]);
  assert.ok(fwd.length >= 2, `expected both builder calls to forward a budget; found ${fwd.length}`);
  for (const name of fwd) {
    assert.equal(name, "budget", `a builder call forwards \`${name}\` rather than the build's budget`);
  }

  // THE ROUTE'S OWN CALL, which is the hop the plumbing above cannot see.
  // `designSiteSchema` takes a budget and forwards it, and both of those can be
  // perfectly true while the ROUTE omits the argument — then `budget` is null
  // inside, the design call falls back to the flat per-call ceiling, and every
  // guard here still passes. That mutant SURVIVED the first sweep.
  const dz = CODE.match(/designSiteSchema\(env, briefWithLinks,[^)]*\)/);
  assert.ok(dz, "the build route no longer calls designSiteSchema with the linked brief");
  assert.match(dz[0], /\bbudget\b/,
    "the build route does not give the design call the build's budget, so it is bounded only per call");

  // AND THE BOUND MUST ACTUALLY READ IT. `callMs` deriving from
  // `BUILDER_CALL_MS` is what the timeout guard in model-xai checks, and
  // `const callMs = BUILDER_CALL_MS` satisfies that completely while ignoring
  // the budget — the budget threaded through four functions and discarded at
  // the last line, which is the wiring failure this repo has recorded twelve
  // times. That mutant SURVIVED the first sweep too.
  const cm = CODE.match(/const callMs = ([^;]*);/);
  assert.ok(cm, "callBuilderModel no longer computes its bound in one place");
  assert.match(cm[1], /budget[\s\S]*capMs/,
    "the per-call bound ignores the build budget, so the two bounds stack instead of composing");

  // …AND EVERY BUILDER FETCH MUST USE IT. `callMs` can be computed correctly and
  // then not referenced — `AbortSignal.timeout(BUILDER_CALL_MS)` at the fetch
  // satisfies the per-call-ceiling guard in model-xai completely while throwing
  // the composition away, so a pages call starting at minute fourteen of a
  // fifteen-minute budget gets another ten. That mutant survived the first
  // sweep. Derived over the function body, so a third provider is covered.
  const cbAt = CODE.indexOf("async function callBuilderModel(");
  const cbBody = CODE.slice(cbAt, CODE.indexOf("\nasync function anthropicMessages(", cbAt));
  assert.ok(cbBody.length > 500, "the callBuilderModel window is empty — this check would be vacuous");
  const bounds = [...cbBody.matchAll(/signal:\s*AbortSignal\.timeout\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.ok(bounds.length >= 2, `expected a bounded fetch per provider; found ${bounds.length}`);
  for (const b of bounds) {
    assert.equal(b, "callMs",
      `a builder fetch is bounded by \`${b}\` rather than the composed bound — the build budget cannot reach it`);
  }

  // And the two functions that own those calls take one, or the forward above is
  // forwarding `undefined` and every bound silently falls back to the per-call
  // ceiling — the wiring failure wearing the shape of a working feature.
  for (const fn of ["designSiteSchema", "generateSitePages", "buildAndPublishPages"]) {
    const sig = paramsOf(CODE, fn);
    assert.ok(sig, `${fn} is gone`);
    assert.match(sig, /\bbudget\b/, `${fn} does not take the build's budget, so nothing it calls can be bounded`);
  }
});

test("EVERY container fetch on a publish path is bounded", () => {
  // THE LAST UNBOUNDED AWAIT, and the one that made a bound on the model calls
  // insufficient: once the model answered there was nothing anywhere that could
  // stop a build. Measured — run 9 ran 25m46s and run 12 ran 26.9 minutes, both
  // killed by a CI cap, and neither could be told from a slow model call because
  // both were unbounded.
  //
  // IT MATTERS MORE THAN ONE BUILD. `getContainer(env.SITE_BUILD_CONTAINER)` is
  // called with no id and the service is `oneAtATime` for the WHOLE PLATFORM, so
  // a wedged run does not stall one customer — every other build queues behind
  // it, on a fetch that also could not time out.
  //
  // DERIVED over every call rather than pinned to today's two, because the bug
  // WAS one unbounded fetch and a third spine added later has to be covered
  // without anybody remembering this file. The smoke routes are excluded by
  // name: they build a fixed fixture from CI and are not a customer's publish.
  const calls = [...CODE.matchAll(/c\.fetch\(new Request\("http:\/\/build\/build"/g)];
  assert.ok(calls.length >= 2, `expected a container fetch per publish spine; found ${calls.length}`);
  let bounded = 0;
  for (const m of calls) {
    // Read to the end of the call by bracket depth — a request init is full of
    // braces and a flat scan has been written wrong here five times.
    let i = CODE.indexOf("(", m.index + "c.fetch".length), d = 0;
    for (; i < CODE.length; i++) {
      if (CODE[i] === "(") d++;
      else if (CODE[i] === ")" && --d === 0) break;
    }
    assert.equal(d, 0, "could not find the end of a container fetch — the depth scan is broken, not the code");
    const init = CODE.slice(m.index, i + 1);
    if (/smoke:\s*true/.test(init)) continue;         // the CI fixture builds, not a publish
    assert.match(init, /signal:\s*AbortSignal\.timeout\(/,
      "a publish path's container fetch is unbounded — a wedged container stalls every build on the platform");
    assert.match(init, /\bCONTAINER_CALL_MS\b/,
      "the container bound no longer derives from the one ceiling, so the two spines can drift apart");
    bounded++;
  }
  assert.ok(bounded >= 2, `expected both publish spines to be bounded; found ${bounded}`);
});

test("the pages call gets what is LEFT, and the route refuses before spending it", () => {
  // THE ONE THING A PER-CALL BOUND CANNOT DO. `BUILDER_CALL_MS` has never fired
  // across five failed builds because 600s + 600s + ~500s of container is ~29
  // minutes with no hang anywhere. The budget only helps if the pages call is
  // handed the REMAINDER and if a route with nothing left says so instead of
  // starting a call that cannot finish.
  const at = CODE.indexOf("pages = await buildAndPublishPages(env, {");
  assert.ok(at > 0, "the build route no longer calls buildAndPublishPages");
  const close = CODE.indexOf("\n          });", at);
  assert.ok(close > at, "could not find the end of the options object — this check would be vacuous");
  assert.match(CODE.slice(at, close), /(^|[\s,{])budget\b/m,
    "the pages call is not given the build's budget, so it gets a fresh ten minutes on a spent build");

  // The refusal. Asserted on the CONDITION rather than on the sentence: a check
  // that `budgetNote` merely appears in the file is satisfied by an import.
  const gate = CODE.match(/if \(budget\.expired\(\)\) \{([\s\S]{0,600}?)\n      \} else if/);
  assert.ok(gate, "an expired budget no longer refuses before page generation");
  assert.match(gate[1], /budgetNote\("generate"\)/,
    "the refusal does not use the stage-named sentence, so it cannot say what was and was not set up");
  assert.match(gate[1], /stage = "generate"/,
    "the refusal does not name its stage, so `ourFault` cannot decide what it costs");
});

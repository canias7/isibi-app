// One budget for the whole build.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeBudget, budgetNote, budgetStage, raceDeadline, BUILD_BUDGET_MS, CONTAINER_CALL_MS } from "../builder/build-budget.mjs";
import { buildPathFn } from "./fixtures/build-path.mjs";

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

test("the budget cannot refuse a build of a length that has really published", () => {
  // MEASURED, not chosen. Builds that finished: 272s, 378s, 507s.
  //
  // ── THE UPPER BOUND IS GONE, AND IT WAS A POLICY RATHER THAN A PROPERTY ────
  //
  // This used to also assert `BUILD_BUDGET_MS < 30 * 60000`, on the reasoning
  // that the harness runner capped a run at 30 minutes and a budget above that
  // "can never be the thing that answers". Owner's call 2026-08-22 reversed the
  // policy in as many words — "delete any timeout there is anywhere, pls, just
  // let the model work" — and the runner cap moved to 350 minutes in the same
  // change, so the number it was measured against no longer exists either.
  //
  // WHAT SURVIVES IS THE HALF THAT PROTECTS A CUSTOMER: a budget BELOW a build
  // that has really finished refuses honest work, and that direction is a bug
  // whatever the policy is. The mechanism is untouched — `raceDeadline`,
  // `capMs` and every derived guard still hold — only the ceiling stopped
  // binding.
  assert.ok(BUILD_BUDGET_MS > 507000 * 1.5,
    "the budget would refuse a build of a length that has really published");
  // AND THE CONTAINER CEILING STILL FITS INSIDE IT. A container bound longer
  // than the whole build's budget can never be what answers — `capMs` would
  // clamp it on every build, which is the ceiling silently not existing. This
  // one is an ORDERING rather than a number, so raising both kept it true and
  // it is worth keeping for exactly that reason.
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
  // TWO SHAPES SINCE 2026-08-25. `generateSitePages` moved to build-call.mjs so
  // the container can make the call, and `worker.js` keeps a thin arrow-function
  // wrapper that does the `env`-to-keys hop. Reading only `async function` here
  // reported "generateSitePages is gone" about a function whose signature is
  // right there and still takes the budget — an anchor on the DECLARATION FORM
  // rather than on the property.
  const at = ["async function " + name + "(", "export async function " + name + "(",
              "const " + name + " = ("].map((d) => src.indexOf(d)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (at === undefined) return null;
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
  // FOLLOWED BY NAME. `callBuilderModel` moved to build-call.mjs so the
  // CONTAINER can make it, and this reported "is gone" about a function that is
  // right there — an anchor on WHICH FILE rather than on the property.
  const callSrc = buildPathFn("callBuilderModel").src;
  const sig = paramsOf(callSrc, "callBuilderModel");
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
  // THE THIRD ARGUMENT, NOT THE FIRST. Pinned to `(env, ...)` this went red the
  // day the keys became an argument so the container could pass its own — a
  // correct change failing a check about what the FIRST parameter is called,
  // when the property is that a budget rides third.
  // ACROSS THE BUILD PATH, not one file. `generateSitePages` moved to
  // build-call.mjs, so worker.js now holds ONE direct `callBuilderModel(...)`
  // and reaches the other through a wrapper — this counted 1 and reported that
  // a budget had stopped being forwarded, about a build where both still do.
  //
  // The wrapper is followed by NAME rather than assumed: it must pass a budget
  // on to the module, or the pages call really is unbounded again.
  const gen = buildPathFn("generateSitePages");
  const genFwd = [...gen.body.matchAll(/\bcall\(\w+,\s*\w+,\s*(\w+)\)|callBuilderModel\(\w+,\s*\w+,\s*(\w+)\)/g)]
    .map((m) => m[1] || m[2]);
  const fwd = [...CODE.matchAll(/callBuilderModel\(\w+,\s*\w+,\s*(\w+)\)/g)].map((m) => m[1]).concat(genFwd);
  assert.ok(fwd.length >= 2, `expected both builder calls to forward a budget; found ${fwd.length}`);
  for (const name of fwd) {
    assert.equal(name, "budget", `a builder call forwards \`${name}\` rather than the build's budget`);
  }

  // AND THE WORKER'S HOP INTO THE MODULE, WHICH IS POSITIONAL AND MOVED.
  //
  // This read the LAST argument of `genPages(...)` and required it to be
  // `budget` — true until the caller became an eleventh parameter, so a correct
  // change reported "a builder call forwards `call` rather than the build's
  // budget" about a hop that forwards both. A position is a fact about an
  // argument LIST; what has to hold is that the budget is IN it.
  //
  // DEPTH-AWARE, because `keysFrom(env)` is the first argument and a flat scan
  // stops at its closing paren — the mistake this repo has now written five
  // times where a depth-aware scan was needed.
  const argsOf = (src, call) => {
    const at = src.indexOf(call);
    if (at < 0) return null;
    let d = 0;
    for (let i = at + call.length - 1; i < src.length; i++) {
      if (src[i] === "(") d++;
      else if (src[i] === ")" && !--d) return src.slice(at + call.length, i);
    }
    return null;
  };
  const hopArgs = argsOf(CODE, "genPages(");
  assert.ok(hopArgs, "the Worker's generateSitePages no longer reaches genPages — rescope this guard");
  assert.match(hopArgs, /(^|[\s,])budget([\s,]|$)/,
    "the Worker's hop into page-gen drops the build budget, so the pages call is bounded only per call");

  // AND THE CONTAINER HOP READS IT AND SENDS IT.
  //
  // Generation runs in the container since 2026-08-25, which is a FOURTH place
  // the budget can be threaded in and discarded — and the container bounds the
  // call at exactly the number it is sent, so a hop that computes `callMs` from
  // the budget and then posts a constant restores the stacking these two bounds
  // exist to compose away. Both halves, because either alone passes with the
  // other broken.
  const cpc = buildPathFn("containerPagesCall").body;
  const hopMs = cpc.match(/const callMs = ([^;]*);/);
  assert.ok(hopMs, "containerPagesCall no longer computes its bound in one place");
  assert.match(hopMs[1], /budget[\s\S]*capMs/,
    "the container hop ignores the build budget, so a generation started at minute eleven gets a fresh ten");
  assert.match(cpc, /JSON\.stringify\(\{[^}]*\bcallMs\b/,
    "the container hop computes a bound and does not send it — the container then uses its own ceiling");

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
  // IN THE MODULE, where the call is. `callMs` moved with `callBuilderModel`,
  // and this reported "no longer computes its bound in one place" about a bound
  // that is computed in exactly one place — one file over.
  const cm = buildPathFn("callBuilderModel").body.match(/const callMs = ([^;]*);/);
  assert.ok(cm, "callBuilderModel no longer computes its bound in one place");
  assert.match(cm[1], /budget[\s\S]*capMs/,
    "the per-call bound ignores the build budget, so the two bounds stack instead of composing");

  // …AND EVERY BUILDER FETCH MUST USE IT. `callMs` can be computed correctly and
  // then not referenced — `AbortSignal.timeout(BUILDER_CALL_MS)` at the fetch
  // satisfies the per-call-ceiling guard in model-xai completely while throwing
  // the composition away, so a pages call starting at minute fourteen of a
  // fifteen-minute budget gets another ten. That mutant survived the first
  // sweep. Derived over the function body, so a third provider is covered.
  const cbBody = buildPathFn("callBuilderModel").body;
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
    // ASKED OF WHEREVER IT LIVES. `generateSitePages`'s wrapper is in worker.js
    // and its body is in build-call.mjs; both take a budget and both must, or
    // the forward above is forwarding into a signature that drops it.
    const sig = paramsOf(CODE, fn) || paramsOf(buildPathFn(fn).src, fn);
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

// ── THE DEADLINE ───────────────────────────────────────────────────────────
//
// RUN 13 IS WHY THIS TIER EXISTS, and it is worth stating as a measurement
// rather than a worry. Every bound the budget had was correct and correctly
// threaded — both model calls, both container fetches, and a derived guard
// above proving it. The arithmetic said the build must answer by minute
// fifteen. It ran 26.5 minutes, answered nothing, and its own stored trace
// stopped at `fonts` at 79 seconds.
//
// So the lesson is not "add another timeout". A per-call cap can only ever
// bound the calls somebody thought of, and the hang was in an await that had no
// signal because nobody had put one there — the R2 writes, the Supabase RPCs,
// the font fetch and whatever is added next are each one forgotten `signal:`
// away from being the next twenty-six minutes of silence. A race bounds work it
// knows nothing about, which is the only shape that cannot be incomplete.

test("a deadline answers whatever the work does not", async () => {
  // The four outcomes, all of them driven rather than read. `ms` is small on
  // purpose: the floor that keeps a real deadline off zero belongs to the
  // CALLER, which is about the budget, not about racing.
  assert.equal(await raceDeadline(Promise.resolve("BUILT"), { ms: 5000, onExpire: () => "LATE" }), "BUILT",
    "a build that finished was overtaken by its own deadline");
  assert.equal(await raceDeadline(new Promise(() => {}), { ms: 10, onExpire: () => "LATE" }), "LATE",
    "a build that never settles is still never answered — the whole point of the race");
  await assert.rejects(
    () => raceDeadline(Promise.reject(new Error("boom")), { ms: 5000, onExpire: () => "LATE" }),
    /boom/,
    "a rejection is being swallowed, so a build that fails fast no longer reports why");
});

test("a broken onExpire degrades to NO deadline, never to a 500", async () => {
  // The direction matters. Resolving with the throw would turn every slow build
  // into an error the customer cannot act on; leaving the race to the work
  // restores exactly the behaviour of not having a deadline, which costs nothing
  // that was not already being paid.
  const slow = new Promise((res) => setTimeout(() => res("SLOW"), 80));
  assert.equal(await raceDeadline(slow, { ms: 10, onExpire: () => { throw new Error("bad"); } }), "SLOW");
});

test("the deadline fires once, and the timer does not outlive the answer", async () => {
  let n = 0;
  await raceDeadline(new Promise(() => {}), { ms: 10, onExpire: () => { n++; return n; } });
  await new Promise((res) => setTimeout(res, 60));
  assert.equal(n, 1, "onExpire ran more than once — the answer is being recomputed after the race is decided");
  // A settled build must not hold a timer for the rest of its budget. Measured
  // by the handle count rather than by reading the source: a `clearTimeout` that
  // names the wrong variable reads perfectly and clears nothing.
  const before = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
  await raceDeadline(Promise.resolve("fast"), { ms: 3600000, onExpire: () => "LATE" });
  const after = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
  assert.ok(after <= before, `a finished build left its deadline timer armed (${before} -> ${after})`);
});

test("the stage walks BACK to the last step it knows, so a new mark cannot mislabel a build", () => {
  // The trace names steps for the engineer and the note speaks to the customer;
  // this is where the two vocabularies meet. Reading only the FINAL step means a
  // mark added later — and the build path is exactly the file that grows new
  // marks — falls to a default that can tell somebody with a live database that
  // nothing was set up.
  assert.equal(budgetStage([]), "design", "a build with no marks at all did get as far as something");
  assert.equal(budgetStage([{ s: "gate" }]), "design");
  assert.equal(budgetStage([{ s: "design" }, { s: "prov:database" }]), "provision",
    "a provisioning sub-step must read as provisioning — they are named by the provisioner, not by this file");
  assert.equal(budgetStage([{ s: "schema" }, { s: "fonts" }, { s: "gen" }]), "generate");
  assert.equal(budgetStage([{ s: "gen" }, { s: "img" }]), "publish",
    "by the images the pages ARE written, so the note must stop saying they were not");
  assert.equal(budgetStage([{ s: "compile" }]), "publish");
  // The property that survives the next mark.
  assert.equal(budgetStage([{ s: "schema" }, { s: "a-step-nobody-has-written-yet" }]), "generate");
  assert.equal(budgetStage([{ s: "compile" }, { s: "a-step-nobody-has-written-yet" }]), "publish");
  // Every stage it can answer must be a stage the note actually distinguishes,
  // or a walk that is perfectly correct still produces one sentence for two
  // situations that need opposite instructions.
  const notes = new Set(["design", "provision", "generate", "publish"].map((s) => budgetNote(s)));
  assert.ok(notes.size >= 3, "the four stages collapse to fewer than three sentences");
});

test("EVERY step of the build path maps to a stage — derived from the marks, not from a list", () => {
  // A mark whose name this table has never heard of is not a crash, it is a
  // build described by the step BEFORE it. That is safe and it is also silent,
  // so the check is here rather than left to the fallback: the build route is
  // the file that grows marks, and this is the one place that has to learn them.
  // SCOPED TO WHAT A TRACE CAN ACTUALLY CONTAIN, and its first run is why. A
  // bare `mark?.("route")` is not a step name: `ensureSiteBackend` reports
  // through `(n) => tr.at("prov:" + n)`, so it reaches the trace as
  // `prov:route`, which the prefix rule already answers. Reading the literal
  // flagged a step that does not exist — a false alarm on correct code, which
  // this repo rates worse than the miss. The build's own marks are the ones
  // inside `buildAndPublishPages`, which are passed through unprefixed.
  const bp = CODE.indexOf("async function buildAndPublishPages(env, {");
  assert.ok(bp > 0, "buildAndPublishPages is gone");
  const bpEnd = CODE.indexOf("\nasync function ", bp + 10);
  const body = CODE.slice(bp, bpEnd > bp ? bpEnd : CODE.length);
  const names = [...CODE.matchAll(/\btr\.at\("([^"]+)"/g)].map((m) => m[1])
    .concat([...body.matchAll(/\bmark\?\.\("([^"]+)"[,)]/g)].map((m) => m[1]));
  assert.ok(names.length >= 15, `expected the build's marks to be found; got ${names.length}`);
  const unknown = [...new Set(names)].filter((n) => budgetStage([{ s: n }]) === "design" && n !== "auth"
    && n !== "body" && n !== "links" && n !== "gate");
  assert.deepEqual(unknown, [],
    `these build marks have no stage, so a deadline there would tell the customer nothing was set up: ${unknown.join(", ")}`);
});

test("THE MIDDLE OF A BUILD IS MARKED — the void that made run 13 unanswerable", () => {
  // Eighteen marks in the first eighty seconds and then ONE unbroken gap over
  // generation, the photographs, the typecheck, vite, the prerender and the
  // render check. The `container` mark noticed that gap and closed the SPAN
  // rather than splitting it, which is right for attributing time and useless
  // for locating a hang — so the record built to answer "which step was it in?"
  // could not answer it on the very run it was built for.
  //
  // Each of these four names a DIFFERENT provider and a different fix, which is
  // the whole reason they have to be separate.
  for (const m of ["gen", "img", "compile", "container"]) {
    assert.match(CODE, new RegExp(`mark\\?\\.\\("${m}"[,)]`),
      `the \`${m}\` mark is gone — a build that hangs there is indistinguishable from one that hangs anywhere else after \`fonts\``);
  }
  // AND THEY MUST BE IN THE RIGHT DEPS, or four marks in one place is one mark
  // wearing four names. Derived from where each dep opens.
  const dep = (name) => {
    const at = CODE.indexOf(`\n    ${name}:`);
    assert.ok(at > 0, `the \`${name}\` dep is gone`);
    return CODE.slice(at, at + 2000);
  };
  assert.match(dep("generate"), /mark\?\.\("gen"[,)]/, "the model call is not marked, so a hung provider looks like a hung container");
  assert.match(dep("images"), /mark\?\.\("img"[,)]/, "the image models are not marked");
  assert.match(dep("compile"), /mark\?\.\("compile"[,)]/, "the container's turn is not marked");
});

test("the route RACES the build, and the deadline is a step rather than a finish", () => {
  // THE WIRING LAYER, where this repo has recorded twelve dead features: the
  // helper can be perfectly correct and reached by nothing, and the only symptom
  // is a build that runs to the runner's cap exactly as it did before.
  assert.match(CODE, /return raceDeadline\(buildDone, \{/,
    "the build route no longer races its own deadline, so a hang in an unbounded await is unbounded again");
  const at = CODE.indexOf("return raceDeadline(buildDone, {");
  const block = CODE.slice(at, CODE.indexOf("\n      });", at));
  assert.ok(block.length > 100, "could not read the deadline block — this check would be vacuous");

  // WHAT IS LEFT, never the whole budget: the wait started when the request did.
  assert.match(block, /budget\.remainingMs\(\)/,
    "the deadline is not measured from what is left of the budget");
  // A STEP, NEVER A FINISH. `finish` closes the recorder, so the row would say
  // "timeout" for ever even on a build that published two minutes later — and
  // the record has to end up saying what really happened.
  assert.match(block, /rec\.step\(/, "the deadline does not record itself, so the row stops at the last real mark");
  assert.doesNotMatch(block, /rec\.finish\(/,
    "the deadline CLOSES the recorder, so a build that publishes afterwards can never correct its own row");
  // It says where it got to in BOTH vocabularies — one for the person waiting,
  // one for the person fixing it.
  assert.match(block, /budgetNote\(stage\)/, "the customer is not told what survives");
  assert.match(block, /budgetStage\(/, "the stage is not derived from the trace, so the sentence is a guess");
});

test("the budget and the recorder are declared ABOVE the wrapper, or the race cannot see them", () => {
  // A SCOPE FACT WITH TEETH. They were the wrapper's first three statements,
  // which is fine for the build and useless for the thing that has to answer
  // when the build does not — `Promise.race` needs them in the same scope as the
  // promise it is racing. Moved back inside, this file's own `raceDeadline`
  // guard above still passes and the route stops compiling, which is the good
  // failure; the bad one is somebody "tidying" the declarations back in and
  // reaching for a side channel instead.
  // ANCHORED ON THE ASSIGNMENT, NOT ON WHAT IS ASSIGNED. This pinned the exact
  // spelling `const buildDone = (async () => {` and went red on 2026-08-23 when
  // the build became a named function so a queue consumer could call it — a
  // change that preserves this property completely, and in fact makes it
  // structural: `runSiteBuild(request, env, { rec, tr, budget })` cannot be
  // called at all unless the three are in the caller's scope. The recurring
  // own-goal, in a guard whose own comment is about a scope fact. It went red a
  // SECOND time within the hour, when the same declaration became `let buildDone;`
  // so the queue path could resolve it with an answer the consumer produced.
  //
  // ANCHORED ON THE RACE, AT BOTH ENDS, and that is what makes it non-vacuous.
  // `raceDeadline` is called in exactly one place — the route — so the call it
  // races is the last `runSiteBuild(` above it, which is neither the function's
  // own declaration nor the consumer's `await`ed call. Both of those come
  // earlier in the file and both would satisfy a bare `indexOf`: the declaration
  // is the mutation-matches-its-own-declaration trap this repo has recorded
  // three times, and the consumer's call is the same trap wearing a caller.
  const race = CODE.indexOf("raceDeadline(");
  assert.ok(race > 0, "the build route no longer races a deadline, so this guard is watching nothing");
  const wrapper = CODE.lastIndexOf("runSiteBuild(", race);
  assert.ok(wrapper > 0, "the build route no longer calls runSiteBuild, so there is nothing for the deadline to race");
  for (const decl of ["const rec = makeRecorder({", "const tr = makeTrace(", "const budget = makeBudget()"]) {
    // THE NEAREST ONE ABOVE THE CALL, never the first in the file. The queue
    // consumer declares all three too — it has to, it runs the same build — so
    // `indexOf` would assert about a scope this route cannot see, which passes
    // whatever the route does.
    const d = CODE.lastIndexOf(decl, wrapper);
    assert.ok(d > 0, `${decl} is gone`);
    assert.ok(d < wrapper, `${decl} moved below the build, where the deadline cannot reach it`);
  }
  // AND THE BUILD IS HANDED ALL THREE. Declaring them above is only half: a
  // build that stopped taking them would leave these three assertions passing
  // over declarations nothing reads, which is the vacuous shape this file
  // already guards against elsewhere.
  const call = CODE.slice(wrapper, wrapper + 200);
  for (const name of ["rec", "tr", "budget"]) {
    assert.match(call, new RegExp(`(?<![\\w$.])${name}(?![\\w$])`),
      `the build is no longer handed ${name} — the deadline and the trace are watching nothing`);
  }
});

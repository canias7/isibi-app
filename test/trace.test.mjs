// The build's own account of what it did.
//
// WHY THIS EXISTS. A build makes ~33 ordered steps across seven systems and
// reported one number about the journey: `buildMs`, the container's slice. Which
// step was slow, whether provisioning was skipped, how the schema call compared
// to the pages call — none of it was visible.
//
// And it is the only way to settle a question reading cannot: the build reaches
// the outside world through INJECTED dependencies (`deps.generate`,
// `deps.compile`, `deps.publish`), which is what makes `publishPages` testable
// and is exactly what stops a static walk following the call graph through it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeTrace, MAX_STEPS } from "../builder/trace.mjs";

/** A clock the test drives, so nothing has to sleep. */
function fakeClock(start = 1000) {
  let t = start;
  return { now: () => t, tick: (ms) => { t += ms; } };
}

test("it records each step and the gap since the last one", () => {
  const c = fakeClock();
  const tr = makeTrace(c.now);
  c.tick(120); tr.at("body");
  c.tick(2140); tr.at("design");
  c.tick(50); tr.at("normalize");
  const out = tr.done();
  assert.deepEqual(out.steps, [
    { s: "body", ms: 120 },
    { s: "design", ms: 2140 },
    { s: "normalize", ms: 50 },
  ]);
  assert.equal(out.totalMs, 2310, "total is the wall clock, not the sum of a subset");
});

test("extra values may only be NUMBERS", () => {
  // The one rule that makes this safe to return in a response. A connection
  // string carries a password; the model writes prose. Neither can reach a trace
  // if only finite numbers are accepted — and they are DROPPED rather than
  // stringified, because a trace that mangles its input is worse than one that
  // omits it.
  const c = fakeClock();
  const tr = makeTrace(c.now);
  c.tick(10);
  tr.at("pages", {
    out: 11418,
    credits: 26,
    conn: "postgres://user:hunter2@ep-x.neon.tech/db",
    note: "the model said something",
    nan: NaN,
    inf: Infinity,
    obj: { nested: 1 },
  });
  const [step] = tr.done().steps;
  assert.deepEqual(step, { s: "pages", ms: 10, out: 11418, credits: 26 });
  assert.ok(!JSON.stringify(step).includes("hunter2"));
});

test("it is bounded, so a runaway loop cannot fill a response", () => {
  const c = fakeClock();
  const tr = makeTrace(c.now);
  for (let i = 0; i < MAX_STEPS + 25; i++) { c.tick(1); tr.at("s" + i); }
  const out = tr.done();
  assert.equal(out.steps.length, MAX_STEPS);
  assert.equal(out.dropped, 25, "and it says how many it dropped rather than hiding them");
});

test("nothing it does can throw into a build", () => {
  const tr = makeTrace(() => { throw new Error("clock exploded"); });
  assert.doesNotThrow(() => tr.at("x"));
  assert.doesNotThrow(() => tr.line());
  const out = tr.done();
  assert.ok(out && Array.isArray(out.steps), "done() still answers a usable shape");
});

test("done() can be called twice and the steps cannot be mutated from outside", () => {
  const c = fakeClock();
  const tr = makeTrace(c.now);
  c.tick(5); tr.at("a");
  const first = tr.done();
  first.steps.push({ s: "forged", ms: 0 });
  assert.equal(tr.done().steps.length, 1, "done() hands back a copy");
});

test("the log line is one bounded string", () => {
  const c = fakeClock();
  const tr = makeTrace(c.now);
  c.tick(120); tr.at("body");
  c.tick(2140); tr.at("design");
  assert.equal(tr.line(), "body 120ms · design 2140ms");
  const big = makeTrace(c.now);
  for (let i = 0; i < MAX_STEPS; i++) { c.tick(1); big.at("averyverylongstepname" + i); }
  assert.ok(big.line().length <= 900);
});

/** worker.js, raw. Never comment-stripped: `strip()` on a six-thousand-line
 *  file eats from any `/*` inside a string or regex to the next `*​/`, which has
 *  reported present code as missing twice. Every pattern below is a construct
 *  prose cannot contain. */
const worker = () => fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the build route actually uses it", () => {
  // The failure this whole file exists to prevent is a recorder that records
  // nothing, so reachability is asserted on the source — the same check that
  // caught `notifyOwnerOfSubmission` having zero callers. And it has already
  // earned its keep: `makeTrace` was CALLED in the route and never imported,
  // which is a ReferenceError on every build.
  const w = worker();
  assert.match(w, /import \{ makeTrace \} from "\.\/builder\/trace\.mjs"/);
  // NAMED, not counted. A `>= 6` floor with seven marks present survives one
  // being deleted — proved by mutation. These are the steps whose duration is
  // the actual question ("which one was slow"), so each is asserted by name.
  for (const step of ["body", "design", "normalize", "provision", "schema", "seed", "pages"]) {
    assert.match(w, new RegExp('tr\\.at\\("' + step + '"'), `the route stopped recording "${step}"`);
  }
  assert.match(w, /trace: traced\.steps/, "the trace is built and then never returned");
  assert.match(w, /tr\.line\(\)/, "nothing logs it either");
});

test("the schema call's usage is captured and reported, but NOT billed on", () => {
  // Two separate claims, and the second matters as much as the first: measuring
  // a cost is not the same as changing what somebody is charged for it.
  const w = worker();
  // SCOPED TO designSiteSchema's own body. A bare /cache_creation_input_tokens/
  // matched the pages call — and a COMMENT about it — so it passed while the
  // schema call still threw its usage away. Fifth time a source-reading guard in
  // this repo has matched its own prose.
  const from = w.indexOf("async function designSiteSchema");
  assert.ok(from > 0, "designSiteSchema was renamed — this guard now checks nothing");
  const fn = w.slice(from, w.indexOf("\n}", from));
  for (const kind of ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]) {
    assert.ok(fn.includes(kind), `designSiteSchema does not return ${kind} — its cost cannot be priced`);
  }
  assert.match(w, /schemaUsage: schemaUsage \|\| undefined/, "the measurement is not reported");
  assert.match(w, /schemaCredits: schemaUsage \? pageCredits\(schemaUsage\)/,
    "nothing prices it, so the flat fee still cannot be compared against anything");
  // THE FEE ITSELF IS UNTOUCHED, and this is asserted by reading the whole
  // expression rather than a prefix of it: a substring match survives anything
  // APPENDED to the sum, which is exactly how a measurement turns into a charge
  // by accident. Proved by mutation — the prefix form let the schema cost be
  // added to the bill and passed.
  // Anchored on SITE_BUILD_FEE, not on the first `cost:` in the file — worker.js
  // has several and the first belongs to a different route entirely.
  const costs = w.match(/^\s*cost: .*SITE_BUILD_FEE.*$/gm) || [];
  assert.equal(costs.length, 1, "the build route's charge is no longer the only one — rescope this");
  const cost = costs[0];
  assert.match(cost, /cost: \(designed \? SITE_BUILD_FEE : 0\) \+ pages\.cost,/,
    "the charge changed — that is a pricing decision, not a side effect of a measurement");
  assert.ok(!/schema/i.test(cost), "the schema call's cost reached the customer's bill");
});

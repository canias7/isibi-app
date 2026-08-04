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
  for (const step of ["auth", "body", "gate", "owner", "design", "normalize", "provision",
                      "schema", "seed", "merge", "og", "pages"]) {
    assert.match(w, new RegExp('tr\\.at\\("' + step + '"'), `the route stopped recording "${step}"`);
  }
  // PROVISIONING IS SIX CALLS, not one step. A cold provision (create the Neon
  // project, poll, create the database, poll, enable auth, enable the Data API)
  // and a warm one (a single lookup) differed by tens of seconds and were the
  // same number. The module reports them through an injected callback, because
  // the interesting case is the build that THROWS half way through — a return
  // value never arrives.
  assert.match(w, /ensureSiteBackend\(env, slug, bu\.id, brief, \(n\) => tr\.at\("prov:" \+ n\)\)/,
    "provisioning is back to being one opaque number");
  assert.match(w, /^\s*mark,$/m, "the worker's wrapper takes a mark and never forwards it to the module");
  // THE PAGES CALL'S SPLIT. It was the model call, the container compile and ~20
  // R2 puts together.
  for (const k of ["genMs: pages.genMs", "buildMs: pages.buildMs", "publishMs: pages.publishMs",
                   "tscMs: pages.tscMs", "viteMs: pages.viteMs"]) {
    assert.ok(w.includes(k), `the pages step does not report ${k.split(":")[0]}`);
  }
  // THE TRACE STARTS BEFORE authUser, which is a round trip to GoTrue. Below it,
  // that call sat outside `totalMs` entirely and the reported total was not the
  // time the caller waited.
  const head = w.slice(w.indexOf("/api/site/react-build"));
  assert.ok(head.indexOf("const tr = makeTrace();") < head.indexOf("await authUser(request)"),
    "the trace starts after the auth round trip, so totalMs understates the build");
  // Fonts are DOWNLOADED inside what looks like setup; the mark has to reach the
  // function that does it.
  assert.match(w, /mark: \(n\) => tr\.at\(n\)/, "buildAndPublishPages is given no way to report its own steps");
  assert.match(w, /mark\?\.\("fonts"\)/, "the font download is untimed again");
  assert.match(w, /mark\?\.\("route"\)/, "the KV route write is untimed again");
  assert.match(w, /pagesUsage: pages\.usage \|\| undefined/,
    "the pages call is metered on four token kinds and reports none of them");
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

test("the build container times its three sub-steps and reports them every way out", () => {
  // Source-derived, because the container is an HTTP server the unit suite does
  // not start. The invariant is that EVERY exit from the build handler carries
  // the timings — a success, a `tsr generate` failure, a typecheck failure, a
  // vite failure and a missing index.html. Reporting them only on success is the
  // version that looks finished and is silent on exactly the runs somebody is
  // investigating.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(src, /const times = \{ routesMs: 0, tscMs: 0, viteMs: 0 \}/,
    "the container stopped timing its sub-steps");
  // AND SOMETHING HAS TO WRITE THEM. Asserting only that every exit spreads
  // `times` passes perfectly on a container where all three stay 0 — proved by
  // mutation, twice, by putting `tsc` and `vite` back on the bare `run()`. The
  // keys are derived from the declaration so a fourth one cannot be added and
  // left unwritten.
  const keys = [...src.match(/const times = \{([^}]*)\}/)[1].matchAll(/(\w+):/g)].map((m) => m[1]);
  assert.equal(keys.length, 3, "the timings object changed shape — rescope this");
  for (const k of keys) {
    assert.ok(src.includes('timed("' + k + '"'), `${k} is reported and never measured — it is always 0`);
  }
  // …and the wrapper has to WRITE what it measured. Called-and-spread-but-never-
  // assigned is a third way to report three zeros, and it survived the two checks
  // above.
  assert.match(src, /times\[key\] = Date\.now\(\) - t;/,
    "timed() measures nothing back into times — every duration is 0");

  const exits = [...src.matchAll(/send\(res, 200, \{ ok: (?:true|false)[^\n]*ms: Date\.now\(\) - t0[^\n]*\}\)/g)]
    .map((m) => m[0]);
  assert.ok(exits.length >= 5, `only ${exits.length} timed exits found — the scan stopped working`);
  const silent = exits.filter((e) => !e.includes("...times"));
  assert.deepEqual(silent, [], "these exits report a total and no breakdown");
});

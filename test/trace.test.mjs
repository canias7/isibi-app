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
  // `og` is NOT here any more, and that is the fix rather than an omission: the
  // link-preview image is resolved at PUBLISH time now, because photographs are
  // bought after the route's old capture point and land in the very prefix it
  // scans — so a build that made its own pictures published with no og:image at
  // all. It is timed one level down through `mark`, like `fonts`, and asserted
  // there. Route-level marks only, so a step that moved is caught rather than
  // matched by its new home.
  for (const step of ["auth", "body", "gate", "owner", "design", "normalize", "provision",
                      "schema", "seed", "merge", "pages"]) {
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
  // ANCHORED ON THE NAMES, not on `genMs: pages.genMs`. This pinned one exact
  // spelling and went red on a CORRECT change: the entry is DERIVED from what
  // the build reports now, precisely because the hand-written form it was
  // guarding is what let `renderMs` and `routesMs` go missing. A test about word
  // order failing a fix for the bug it describes is this repo's most-repeated
  // own-goal — assert the property.
  // DERIVED BY SHAPE, third form of this assertion and the reason is the
  // history: the name-spelling form failed a correct change, the name-list form
  // was caught by the 2026-08-13 audit already missing `preMs` — a hand list is
  // exactly how renderMs went missing before it. The entry now traces any
  // numeric `*Ms` key off the build result, so what is asserted is that
  // derivation, and publish-pages.test.mjs holds the passthrough list that
  // feeds it.
  const pagesEntry = w.slice(w.indexOf('tr.at("pages"'), w.indexOf('tr.at("pages"') + 700);
  assert.ok(/Object\.keys\(pages\)/.test(pagesEntry) && /Ms\$\//.test(pagesEntry),
    "the pages step no longer derives its timings from the build result");
  assert.ok(pagesEntry.includes("credits"), "the pages step stopped reporting its credit cost");
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
  assert.match(w, /mark\?\.\("og"\)/, "the link-preview lookup is untimed again");
  // AND IT IS RESOLVED WHERE IT IS TIMED. The image must come from inside the
  // publish closure — captured before the build, it predates the photographs
  // `deps.images` writes into the same prefix, and every share of a
  // picture-led site degrades to a small card.
  // FOUND BY THE ARGUMENTS IT MUST HAVE, not by the exact list — pinned to
  // `(dist, pages) => {` this failed the day the dep grew a third argument,
  // which is a check about word order rather than about tracing.
  const pub = w.search(/publish: async \(dist, pages\b/);
  assert.ok(pub > 0, "the publish closure moved — rescope this");
  const body = w.slice(pub, w.indexOf("writeSiteDistToR2(env, slug, dist", pub));
  assert.ok(body.length > 40, "the publish window is empty — rescope this");
  assert.match(body, /await siteOgImage\(env, slug\)/,
    "the link-preview image is resolved before the build again, so a build that generates photographs has none");
  // …AND THE MARK BEFORE IT IS WHAT MAKES `og` MEAN THE LOOKUP.
  //
  // This closure runs INSIDE publishPages, so without a mark ahead of the
  // lookup the `og` delta is the first one since `fonts` and swallows generate
  // + typecheck + vite + prerender + render. Measured on the first green
  // production run: `og 165294ms` on a 214s build, i.e. the trace reporting one
  // R2 list call as 77% of the work. A number that reads as the wrong thing is
  // worse than an absent one, because somebody acts on it.
  //
  // Asserted as the ORDER inside the closure rather than on the mark's
  // presence: a `container` mark that lands after the lookup fixes nothing, and
  // matching the string alone would pass on exactly that.
  const cAt = body.indexOf('mark?.("container")');
  const ogAt = body.indexOf("await siteOgImage(env, slug)");
  assert.ok(cAt >= 0, "nothing closes the container's turn, so `og` times the whole build again");
  assert.ok(cAt < ogAt,
    "the container mark is taken AFTER the og lookup, so `og` still swallows generate and compile");
  assert.match(w, /mark\?\.\("route"\)/, "the KV route write is untimed again");
  assert.match(w, /pagesUsage: pages\.usage \|\| undefined/,
    "the pages call is metered on four token kinds and reports none of them");
  assert.match(w, /trace: traced\.steps/, "the trace is built and then never returned");
  assert.match(w, /tr\.line\(\)/, "nothing logs it either");
});

test("the schema call is captured, reported, AND billed on measured usage", () => {
  // THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is the point of
  // keeping its shape. It said "measured, NOT billed on" — the right caution
  // when the measurement was new, because measuring a cost is not the same as
  // changing what somebody is charged for it. Having measured it, the owner
  // changed the charge (2026-08-08): every model call bills on what it used.
  //
  // The measurement half is unchanged and still asserted first, because the
  // billing half is meaningless without it — pricing a usage report nobody
  // captured is how a flat fee comes back wearing a new name.
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
    "nothing prices it, so the bill cannot be compared against the measurement");

  // THE FEE IS NOW A DEPOSIT, and the settlement is what makes it a usage
  // charge rather than a flat one. Both halves are asserted: taken up front,
  // because `use_credits` is atomic and is the only thing stopping an empty
  // account starting a paid call — and trued up afterwards, because a gate is
  // not a price.
  // ANCHORED ON THE CALL, NOT ON HOW THE CREDENTIAL IS SPELLED. This pinned
  // `request.headers.get("Authorization") || ""` and went red on 2026-08-23 when
  // that expression became a parameter — the build has to be callable by a queue
  // consumer, where there is no request to read a header off, and the four
  // ledger calls that read it now take it as `auth`. The property is that the
  // deposit is taken atomically before any paid call, which is unchanged.
  assert.match(w, /useCredits\([A-Za-z_$][\w$.]*(?:\([^)]*\))?[^,]*,\s*SITE_BUILD_FEE\)/,
    "the affordability gate is gone — an empty account can start a paid model call");
  // THE PROPERTY IS "THE DEPOSIT IS SETTLED AGAINST WHAT THE STEP REALLY COST",
  // not the exact argument list. Pinned to `schemaSettlement(schemaUsage, …)`
  // this went red when the schema step legitimately became two calls — the
  // designer plus the Haiku top-up that fills a missing `seed` — and had to
  // settle against both. A test about word order failing a correct change is
  // this repo's most repeated own-goal.
  const settle = w.match(/const settle = schemaSettlement\(([^)]*)\)/);
  assert.ok(settle, "the deposit is never settled, so the flat fee is back under another name");
  assert.ok(settle[1].includes("schemaUsage"), "the settlement no longer reads what the designer call cost");
  assert.ok(settle[1].includes("SITE_BUILD_FEE"), "the settlement is not against the deposit that was taken");
  // BOTH DIRECTIONS. A settlement that only ever charges more is a fee with a
  // surcharge; one that only ever refunds is a discount. Either alone passes a
  // check that merely looks for `settle`.
  // RUN TO A LANDMARK, NOT A BYTE COUNT. These were `{0,200}` and both broke the
  // moment a comment was added above the call they guard — this repo's recurring
  // window-drift bug, and the third time it has bitten. The settlement block is
  // bounded by its own `else if`, so both halves are read from the real branch.
  // The index comes from the match above rather than a second literal copy of
  // the call — two spellings of one anchor is how the half below silently stops
  // guarding the half above.
  const sIdx = settle.index;
  const sEnd = w.indexOf("schemaCredits:", sIdx);
  assert.ok(sIdx > 0 && sEnd > sIdx, "the settlement block moved; this guard checks nothing");
  const sBlock = w.slice(sIdx, sEnd);
  // COLLECTED, not merely asked for: `use_credits` refuses a bill larger than the
  // balance and debits ZERO, so a settlement that discards the answer trues the
  // deposit up against money that never moved.
  assert.match(sBlock, /if \(settle > 0\)[\s\S]*?collectCredits/, "a costlier call than the deposit is never charged for");
  assert.match(sBlock, /settle < 0[\s\S]*?creditBack/, "a cheaper call than the deposit is never refunded");

  // AND THE BILL REPORTS THE SETTLED NUMBER, not the deposit. Anchored on the
  // whole expression rather than a prefix — a substring match survives anything
  // APPENDED to the sum, which is exactly how a measurement turned into a charge
  // by accident once already.
  const costs = w.match(/^\s*cost: .*pages\.cost.*$/gm) || [];
  assert.equal(costs.length, 1, "the build route's charge is no longer the only one — rescope this");
  assert.match(costs[0], /cost: schemaCost \+ pages\.cost,/,
    "the reported bill is not the settled cost");
});

test("a refused build gives back what was actually taken, not the flat fee", () => {
  // Once the deposit settles to real usage the two are different numbers, and
  // refunding the fee would quietly keep the settlement — charging for a build
  // that 422s before anything is provisioned.
  //
  // THE `Math.min(10, …)` HERE WAS NOT DEAD HEADROOM. `credit_back` hard-caps a
  // single call at 10 credits, and a COLD OPUS schema call settles to 15 — so
  // the one path the rule says refunds in full returned 10 and kept 5, on the
  // exact case ("they are left with literally nothing") the exception exists for.
  // `refundCredits` chunks it instead, and the assertion moved with it.
  const w = worker();
  // ANCHORED FORWARD FROM THE CONDITION, not backward from the message by a
  // byte count. The refund and the wording are now separated by a ternary, and a
  // window sized in bytes stops covering what it was written for the moment a
  // comment lands between them — this session's recurring bug.
  //
  // THE CONDITION'S PREFIX, NOT THE WHOLE CONDITION. This pinned
  // `if (!spec.tables.length && !existing) {` and went red when a third,
  // honest term joined it — a first build is asked for no backend since
  // 2026-08-24, so "the designer declared nothing" stopped being a signal
  // there. The arity own-goal, which this repo has recorded a dozen times.
  const at = w.indexOf("if (!spec.tables.length && !existing");
  assert.ok(at > 0, "the no-tables refusal was reshaped — rescope this");
  // ENDING ON THE BRANCH'S OWN LAST STATEMENT rather than on whatever declaration
  // follows it: `let db;` gained an initialiser in the same change, and a window
  // that ends at a neighbour is a window the next edit moves.
  const end = w.indexOf("}, { status: 422 });", at);
  assert.ok(end > at, "the no-tables refusal no longer ends in a 422");
  const block = w.slice(at, end);
  assert.ok(block.length > 200 && block.length < 2000, "the refusal block scan lost its bounds");
  assert.match(block, /That brief didn't describe anything to store/,
    "the refusal no longer says anything a customer can act on");
  assert.match(block, /await refundFields\(schemaCost\)/,
    "a refused build refunds the deposit and keeps the settlement");
  // NO `|| SITE_BUILD_FEE` FALLBACK. This one refusal now serves the designer
  // path AND the explicit-schema path, and on the second one nothing was ever
  // taken (`schemaCost` is 0) — falling back to the fee there would hand back
  // credits the caller never spent.
  assert.ok(!/schemaCost \|\| SITE_BUILD_FEE/.test(block),
    "the fee fallback is back, so an explicit-schema refusal refunds money nobody paid");
  assert.ok(!/Math\.min\(10,[^)]*schemaCost/.test(block),
    "the 10-credit clamp is back, so a cold Opus refusal keeps 5 credits");

  // AND IT MUST NOT FIRE ON A REVISE — the live bug this moved for.
  //
  // The designer only sees the instruction on a revise, so "make the background
  // yellow" correctly declares no tables. Refused, that answered 422 and changed
  // nothing, which killed the whole token-override feature the day after it
  // shipped. Measured against the deployed Worker on 2026-08-09, not reasoned.
  //
  // Asserted on the CONDITION rather than on `existing` appearing somewhere in
  // the block: the flag being mentioned is not the flag being required.
  assert.ok(at > w.indexOf("existing = !!(owner && owner.uid)"),
    "the refusal sits before the ownership lookup again, where `existing` is not " +
    "known yet — which is exactly how it came to refuse every look-only revise");
  // And the chunker really chunks: one call would hit the same RPC ceiling.
  const rc = w.slice(w.indexOf("async function refundCredits"), w.indexOf("// Read the caller's balance"));
  assert.ok(rc.length > 100, "refundCredits moved — this checks nothing");
  assert.match(rc, /Math\.min\(10, left\)/, "it must split the refund into calls the RPC accepts");
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

test("the build reports WHICH template the container used", () => {
  // The stale-image trap, closed at the layer that can actually answer it. A
  // container image rolls out asynchronously, so a build seconds after a deploy
  // can be served by the previous image and publish a bundle of older code. The
  // smoke test used to look for a marker STRING, which proves only that the
  // image is at least as new as the change that introduced the marker — so the
  // check passed while a booking-form fix went untested, and the run reported a
  // bug that had already been fixed. A digest cannot be approximate that way.
  const srv = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(srv, /const TEMPLATE_ID = /, "the container no longer identifies its template");
  assert.match(srv, /"src", "lib", "rows\.ts"/, "the digest is taken over the wrong file");
  assert.match(srv, /templateId: TEMPLATE_ID/, "it is computed and never reported");

  const pub = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(pub, /out\.templateId = bd\.templateId/, "publishPages drops it");
  assert.match(worker(), /templateId: pages\.templateId/, "the route never returns it");

  const smoke = fs.readFileSync(new URL("../test/integration/build-smoke.mjs", import.meta.url), "utf8");
  assert.match(smoke, /d\.templateId === wantId/, "the smoke test does not compare digests");
  assert.ok(!/js\.includes\(marker\)/.test(smoke), "the old approximate marker check is still there");
});

// The part of a build that spends money and decides what a visitor sees.
//
// This logic ran in production for a day before anything tested it, because it
// lived in worker.js and worker.js cannot be imported. Every side effect is now
// injected, so the decisions can be driven against fakes: does a repair pass get
// paid for, is the repair kept, and does anything get published at all.
//
// The expensive mistakes it is here to catch are the quiet ones — publishing a
// worse retry over a good first attempt, charging for a call that was never made,
// or writing a broken dist to R2 after a failed compile.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publishPages, pageCredits, pageCost, citedLines, totalCost, RATES, MODEL_RATES,
  DEFAULT_RATE_MODEL, ratesFor, SEARCH_USD, MIN_CREDITS,
  ourFault, CHARGED_STAGES, schemaSettlement } from "../builder/publish-pages.mjs";
import { BUILD_MODELS } from "../builder/build-models.mjs";

const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "name", type: "text" }] },
    { name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] },
  ],
};

// A page that survives validatePages and lintPages: a real route, no fetch, and
// it reads the display table rather than the collect one.
const good = (path = "index.tsx") => ({
  path,
  source: `import { createFileRoute } from "@tanstack/react-router";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/")({ component: Page });
function Page() { const { data } = useRows("services"); return <div>{data?.length}</div>; }`,
});

// Compiles fine, lints badly: listing a `collect` table is the failure that
// typechecks, bundles, and then 403s the first time a visitor opens it.
const lintsBad = (path = "index.tsx") => ({
  path,
  source: `import { createFileRoute } from "@tanstack/react-router";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/")({ component: Page });
function Page() { const { data } = useRows("bookings"); return <div>{data?.length}</div>; }`,
});

// Two independent lint hits, so "fewer problems than last time" is testable.
const lintsWorse = (path = "index.tsx") => ({
  path,
  source: `import { createFileRoute } from "@tanstack/react-router";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/")({ component: Page });
function Page() { const { data } = useRows("bookings"); fetch("/x"); return <div>{data?.length}</div>; }`,
});

const USAGE = { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 };
const gen = (pages, extra = {}) => ({ input: { pages, notes: "" }, usage: { ...USAGE }, ...extra });

// Records every side effect so a test can assert on what was NOT done — the
// publish that should not have happened, the credit that should not have moved.
// Recording wraps the override rather than being one of the defaults, so a test
// that supplies its own `generate` still gets counted.
function harness(over = {}) {
  const calls = { generate: [], compile: [], publish: [], charges: [] };
  // The default dist is stamped with the attempt number, so a test can tell WHICH
  // attempt's build was published — otherwise "kept the first attempt" and "kept
  // the retry" produce identical, indistinguishable output.
  const base = {
    generate: async () => gen([good()]),
    compile: async () => ({ ok: true, files: { "index.html": { t: "<build-" + calls.compile.length + ">" } } }),
    publish: async () => {},
    readCredits: async () => 500,
    useCredits: async () => {},
  };
  const pick = (k) => over[k] || base[k];
  const deps = {
    // FORWARDED BY SPREAD, not as a named parameter. Written `(fix) => …(fix)`
    // the wrapper manufactures an `undefined` argument the caller never passed,
    // so "generate is called with nothing" could never be asserted through it —
    // a fake less faithful than the real thing, which is how setTotp hid a bug.
    generate: (...a) => { calls.generate.push(a[0] || null); return pick("generate")(...a); },
    compile: (pages) => { calls.compile.push(pages); return pick("compile")(pages); },
    publish: (dist) => { calls.publish.push(dist); return pick("publish")(dist); },
    readCredits: () => pick("readCredits")(),
    useCredits: (n) => { calls.charges.push(n); return pick("useCredits")(n); },
  };
  return { deps, calls };
}

test("pageCredits meters real usage, never free", () => {
  // 10k fresh in + 10k out = $0.18 → 23 credits at $0.008.
  assert.equal(pageCredits({ in: 10000, out: 10000 }), 23);
  // A call that used almost nothing still cost something.
  assert.equal(pageCredits({ in: 1, out: 1 }), 1);
  assert.equal(pageCredits({}), 1);
  assert.equal(pageCredits(), 1, "no usage at all must not throw");
  // Output is 5x fresh input; a generator is mostly output, so this is where the
  // money goes and getting the rates backwards would understate every build.
  assert.ok(pageCredits({ out: 1000 }) > pageCredits({ in: 1000 }));
});

test("the four token kinds are priced apart, not summed", () => {
  // THE BUG THIS REPLACES. `usedIn` was one summed number, so a cache read was
  // billed at the FRESH rate — ten times over, on the largest input component.
  // Measured on a real build: 35 credits charged against a true 26, +35% on
  // every warm build. It arrived the same day the meter started counting cached
  // tokens at all, so it was never long-standing and never anybody's decision.
  const N = 27170;
  assert.ok(pageCost({ cacheRead: N }) < pageCost({ in: N }), "a cache read must be cheaper than fresh input");
  assert.ok(pageCost({ cacheWrite: N }) > pageCost({ in: N }), "a cache write must be dearer than fresh input");
  // The ratios, not just the ordering — an order-only check passes on rates that
  // are merely in the right sequence and wrong by any amount. Compared with a
  // tolerance because 0.30e-6 / 3e-6 is 0.09999999999999999 in binary floating
  // point, which is the rates being right and the assertion being naive.
  const ratio = (a, b) => Math.abs(RATES[a] / RATES.in - b) < 1e-9;
  assert.ok(ratio("cacheRead", 0.1), `cacheRead is ${RATES.cacheRead / RATES.in}x fresh input, expected 0.1x`);
  assert.ok(ratio("cacheWrite", 1.25), `cacheWrite is ${RATES.cacheWrite / RATES.in}x, expected 1.25x`);
  assert.ok(ratio("out", 5), `out is ${RATES.out / RATES.in}x, expected 5x`);

  // The measured build, both ways round.
  const call = { in: 4977, out: 12222 };
  assert.equal(pageCredits({ ...call, cacheRead: N }), 26, "warm");
  assert.equal(pageCredits({ ...call, cacheWrite: N }), 38, "cold");
  // And what the summed version used to produce, which must no longer be reachable.
  assert.notEqual(pageCredits({ in: 4977 + N, out: 12222 }), pageCredits({ ...call, cacheRead: N }));
});

test("worker.js hands over the four kinds, not a sum", () => {
  // Derived: publish-pages can price them apart only if the caller keeps them
  // apart, and worker.js is the only caller that sees the real response.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const i = src.indexOf("cache_read_input_tokens");
  assert.ok(i > 0, "the worker no longer reads the cache fields at all");
  const block = src.slice(Math.max(0, i - 400), i + 400);
  assert.match(block, /cacheRead:/, "cache reads must reach publish-pages under their own name");
  assert.match(block, /cacheWrite:/, "and so must cache writes");
  assert.ok(!/input_tokens\s*\|\|\s*0\)\s*\+/.test(block), "the three input kinds are being summed again");
});

test("there is ONE rate table, and the eval reads it", () => {
  // Two tables disagreed: this one priced all input at the fresh rate while the
  // eval priced cache reads properly, so the customer's bill and our own cost
  // figure came from different numbers. Same class as pagesRequest.
  const evalSrc = fs.readFileSync(new URL("./integration/page-gen-eval.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  assert.match(evalSrc, /pageCost/, "the eval must price through the shared function");
  assert.ok(!/\d+(\.\d+)?e-6/.test(evalSrc), "the eval is keeping its own rate table again");
});

test("publishes the app when the first attempt is clean", async () => {
  const { deps, calls } = harness();
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.deepEqual(out.files, ["src/routes/index.tsx"]);
  assert.deepEqual(out.problems, []);
  assert.equal(calls.generate.length, 1, "a clean build must not pay for a repair pass");
  assert.equal(calls.publish.length, 1);
  assert.deepEqual(calls.publish[0], { "index.html": { t: "<build-1>" } });
  assert.ok(out.cost > 0, "the generation was billed");
});

test("does not generate when the balance is under the floor", async () => {
  const { deps, calls } = harness({ readCredits: async () => MIN_CREDITS - 1 });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.match(out.notes, /credits/);
  assert.equal(calls.generate.length, 0, "no model call the caller cannot pay for");
  assert.equal(calls.charges.length, 0, "and nothing charged for the call that never happened");
  assert.equal(out.cost, 0);
});

test("exactly the floor is enough", async () => {
  const { deps, calls } = harness({ readCredits: async () => MIN_CREDITS });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(calls.generate.length, 1);
});

test("an unreadable ledger fails closed", async () => {
  // Deliberate: a caller who cannot be billed does not get a paid call. The cost
  // is a placeholder when the ledger merely hiccups, which is the cheaper mistake.
  const { deps, calls } = harness({ readCredits: async () => { throw new Error("supabase down"); } });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.equal(calls.generate.length, 0);
});

test("a ledger that returns nonsense fails closed too", async () => {
  for (const bad of [null, undefined, NaN, "lots"]) {
    const { deps, calls } = harness({ readCredits: async () => bad });
    const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
    assert.equal(out.page, "placeholder", `balance ${String(bad)} must not authorise a call`);
    assert.equal(calls.generate.length, 0);
  }
});

test("a failed charge never fails the build", async () => {
  // The tokens are already spent by the time the ledger is asked. Losing the
  // credit is bad; throwing away a site the caller already paid for is worse.
  const { deps, calls } = harness({ useCredits: async () => { throw new Error("rpc down"); } });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(calls.publish.length, 1);
  assert.ok(out.cost > 0, "the cost is still reported even though the debit failed");
});

test("truncation is a failed generation, not a shipped half-file", async () => {
  const { deps, calls } = harness({ generate: async () => gen([], { input: null, truncated: true }) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.match(out.notes, /longer than one pass/);
  assert.equal(calls.compile.length, 0);
  assert.equal(calls.publish.length, 0);
  // BILLED NOTHING. The tokens really were spent on our side and `usage` still
  // says so — but the customer asked for a site and got a placeholder, and
  // charging the full price of a working site for that is the most expensive
  // outcome the pipeline can hand them.
  // BILLED. The model ran, consumed the tokens `usage` reports, and answered —
  // it simply answered at greater length than one pass allows. That is a result,
  // not an outage, and the rule since 2026-08-08 charges for what was used
  // rather than for whether the customer liked it.
  assert.equal(out.cost, pageCredits(USAGE), "a truncated generation still consumed its tokens");
  assert.equal(out.charged, true);
  assert.ok(out.usage, "what WE spent is still reported, or the failure cannot be costed");
  assert.match(out.notes, /used credits/);
});

test("no usable page stops before the container", async () => {
  const { deps, calls } = harness({ generate: async () => gen([{ path: "index.tsx", source: "  " }]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.match(out.notes, /didn't produce a usable page/);
  assert.equal(calls.compile.length, 0);
  assert.equal(calls.generate.length, 1, "nothing to repair from, so no second call");
});

// ── one call a build ────────────────────────────────────────────────────────
//
// The repair pass was removed 2026-08-04. These replace ten tests that drove it
// — was the retry better, was it billed, did it see the compiler error — and
// they run the opposite way round: the interesting assertion is now that a
// SECOND call never happens, on every route that used to trigger one.
//
// Worth stating because "no repair" is easy to half-implement: dropping the
// retry while leaving `generate` a one-argument function, or leaving one branch
// that still re-asks, would pass a test that only checked the happy path.

test("a compile failure is NOT retried — one call, no publish", async () => {
  const { deps, calls } = harness({
    compile: async () => ({ ok: false, stage: "typecheck", error: "src/routes/index.tsx(4,7): error TS2304" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.generate.length, 1, "a failed compile must not buy a second generation");
  assert.equal(calls.compile.length, 1);
  assert.equal(calls.publish.length, 0, "a broken dist must never reach storage");
  assert.equal(out.page, "placeholder");
  assert.equal(out.stage, "typecheck");
  assert.match(out.error, /TS2304/);
  assert.match(out.notes, /didn't compile/);
  // Still reports what it tried, so a failed build is debuggable from the response.
  assert.deepEqual(out.files, ["src/routes/index.tsx"]);
  // NO CHARGE. A page that does not compile is a placeholder, and a placeholder
  // is not the thing the customer asked for. `usage` still carries what the call
  // consumed, so the failure is still costable from the response.
  // BILLED — `typecheck` is the model's page not compiling, which is its output
  // being wrong rather than our infrastructure failing. The container-death case
  // one stage over (`build`) is the free one, and the pair of them is the whole
  // rule; asserting only this side would pass on code that charges for both.
  assert.equal(out.cost, pageCredits(USAGE), "a page that does not compile still consumed its tokens");
  assert.equal(out.charged, true);
  assert.ok(out.usage);
});

test("a lint problem does NOT buy a second call — it ships and says so", async () => {
  // This page compiles and 403s a visitor, which is exactly what the lint is for.
  // Before, that bought a repair. Now the problem is REPORTED and the site still
  // publishes: a page that works for most visitors beats a placeholder, and the
  // fix for a repeated lint hit belongs in the rules, once, not in every build.
  const { deps, calls } = harness({ generate: async () => gen([lintsBad()]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.generate.length, 1);
  assert.equal(out.page, "app");
  assert.equal(out.problems.length, 1, "the problem is surfaced, not silently swallowed");
  assert.ok(out.problems.some((x) => /collect/.test(x)));
});

test("a site with no home page is refused, not published", async () => {
  // A missing index.tsx is a validatePages PROBLEM, not something it repairs —
  // it cannot know which page should be home. It used to trigger the repair pass;
  // with that gone, publishing anyway would ship a site whose root URL, the only
  // address the customer shares, renders nothing.
  const { deps, calls } = harness({ generate: async () => gen([good("menu.tsx"), good("about.tsx")]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.generate.length, 1, "and it does not buy a second call either");
  assert.equal(calls.compile.length, 0, "there is nothing worth compiling");
  assert.equal(calls.publish.length, 0);
  assert.equal(out.page, "placeholder");
  assert.match(out.notes, /home page/);
  assert.ok(out.problems.some((x) => /no index\.tsx/.test(x)), "and it says why");
});

test("an index.tsx among other pages publishes normally", async () => {
  // The other half of the check above: it must refuse a MISSING home page, not
  // any multi-page site. Without this, tightening the rule to `pages.length === 1`
  // would pass the test above and silently refuse every real site.
  const { deps, calls } = harness({ generate: async () => gen([good("menu.tsx"), good("index.tsx")]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(calls.publish.length, 1);
  assert.deepEqual(out.files, ["src/routes/menu.tsx", "src/routes/index.tsx"]);
});

test("generate is called with NOTHING — no fix argument survives", async () => {
  // Pins the removal at the dep boundary rather than at the branch. A `generate`
  // that accepts no arguments is what worker.js now supplies, so a leftover
  // `deps.generate({pages, problems})` anywhere would be a silent no-op here and
  // a real second call in production.
  const seen = [];
  const { deps } = harness({
    generate: async (...args) => { seen.push(args); return gen([lintsBad()]); },
    compile: async () => ({ ok: false, stage: "typecheck", error: "TS2304" }),
  });
  await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(seen.length, 1, "exactly one generation, on the path that used to retry twice");
  assert.deepEqual(seen[0], [], "and it is passed no arguments at all");
});

test("the worst case is ONE generation, whatever else is retried", async () => {
  // The reason the repair pass went: a failing build used to cost two of the
  // EXPENSIVE half. That is the ceiling this asserts, and it is unchanged by the
  // container retry added on 2026-08-05 — a second compile costs ~40 seconds and
  // no tokens, a second generation costs ~80% of a build. The name used to say
  // "and one build", which stopped being true the moment a killed container was
  // retried; a test whose title claims more than it checks is how a guard gets
  // relaxed instead of read.
  //
  // Asserted over every failure mode, so a future branch that re-asks the MODEL
  // "just this once" fails here rather than on somebody's bill.
  // AND AT MOST ONE CHARGE, on every one of them. The ceiling is on the number
  // of billed model calls, not on the amount — a failure that bills once is the
  // rule working, and a failure that bills TWICE is a second generation nobody
  // noticed. `mine` says which side of the our-fault line each case sits on, so
  // this covers both directions rather than asserting one and hoping.
  for (const [compile, mine] of [
    [async () => ({ ok: false, stage: "typecheck", error: "TS2304" }), false],
    [async () => ({ ok: false, stage: "build", error: "vite exploded" }), true],
    [async () => { throw new Error("container boot timeout"); }, true],
    [async () => null, true],
  ]) {
    const { deps, calls } = harness({ generate: async () => gen([lintsWorse()]), compile });
    const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
    assert.equal(calls.generate.length, 1, "one model call, whatever went wrong");
    assert.ok(calls.compile.length <= 2, "the container is retried once, never looped: " + calls.compile.length);
    assert.equal(calls.charges.length, mine ? 0 : 1, "a placeholder is billed at most once, whatever produced it");
    assert.equal(out.cost, mine ? 0 : pageCredits(USAGE));
    assert.equal(out.charged, !mine);
    assert.equal(out.page, "placeholder");
  }
});

test("buildMs is the one build the caller waited for", async () => {
  const { deps } = harness({
    compile: async () => { const t = Date.now(); while (Date.now() - t < 12) {} return { ok: true, files: {} }; },
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.ok(out.buildMs >= 12, `a ~12ms build should report >=12ms, got ${out.buildMs}`);
  assert.ok(out.buildMs < 1000, "and not the sum of a second one that never ran");
});

test("an unreachable container is a build failure, not a crash", async () => {
  const { deps, calls } = harness({ compile: async () => { throw new Error("container boot timeout"); } });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.equal(out.stage, "build");
  assert.match(out.error, /unreachable/);
  assert.equal(calls.publish.length, 0);
});

test("a container that answers with nothing is a build failure", async () => {
  const { deps } = harness({ compile: async () => null });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.equal(out.stage, "build");
});

test("the generator's notes reach the caller", async () => {
  const { deps } = harness({
    generate: async () => ({ input: { pages: [good()], notes: "Left out the booking editor — published sites can't update rows yet." }, usage: { in: 10, out: 10 } }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.match(out.notes, /booking editor/);
});

test("multi-page sites are reported under src/routes", async () => {
  const { deps } = harness({ generate: async () => gen([good("index.tsx"), good("menu.tsx")]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.deepEqual(out.files, ["src/routes/index.tsx", "src/routes/menu.tsx"]);
});

test("the published index.html carries the share tags", async () => {
  // The head belongs to the built dist, which the model never sees, so this is
  // the only place the tags can be added. Asserted through the real publish
  // shape rather than on injectMeta alone, because the wiring is where it would
  // silently stop happening.
  const { injectMeta } = await import("../site-meta.mjs");
  const dist = { "index.html": { t: "<html><head><title>Shop</title></head><body></body></html>" } };
  const meta = { brand: "Sharp Fade", description: "Skin fades in Lisbon.", url: "https://gofarther.dev/s/x/" };
  dist["index.html"].t = injectMeta(dist["index.html"].t, meta);
  assert.match(dist["index.html"].t, /og:title" content="Sharp Fade"/);
  assert.match(dist["index.html"].t, /name="description" content="Skin fades in Lisbon."/);
});

test("worker.js injects on index.html and nothing else", async () => {
  // A stylesheet or a JS bundle must never be rewritten — asserted on the source,
  // because passing meta to every file would corrupt the dist silently.
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /if \(\/\^index\\\.html\$\/i\.test\(String\(rel\)\)/,
    "the injection must be gated on the filename");
  assert.match(src, /injectMeta\(v\.t, meta\)/);
});

test("a compile failure quotes the line it points at", () => {
  // A file and a column number are not a diagnosis. This is the same lesson as
  // `detail: "{}"`, `upstream: null` and `no JSON`: the system knew something
  // and threw it away, and a round went on inferring what the model wrote.
  const pages = [{ path: "index.tsx", source: 'import { useRows } from "@/lib/rows";\nconst q = useRows<PublicBooking>("bookings");\n' }];
  const cited = citedLines('src/routes/index.tsx(2,20): error TS2344: nope', pages);
  assert.deepEqual(cited, ['index.tsx:2: const q = useRows<PublicBooking>("bookings");']);
});

test("a citation never invents a line", () => {
  const pages = [{ path: "index.tsx", source: "one\ntwo\n" }];
  assert.deepEqual(citedLines("src/routes/nope.tsx(1,1): error", pages), [], "unknown file");
  assert.deepEqual(citedLines("src/routes/index.tsx(99,1): error", pages), [], "line past the end");
  assert.deepEqual(citedLines("no positions here", pages), [], "nothing to cite");
  assert.deepEqual(citedLines(undefined, undefined), [], "no input at all must not throw");
});

test("citations are bounded — count, length and duplicates", () => {
  // This rides in a response and every byte of it is model-written.
  const long = "x".repeat(500);
  const pages = [{ path: "index.tsx", source: Array.from({ length: 40 }, () => long).join("\n") }];
  const err = Array.from({ length: 12 }, (_, i) => `src/routes/index.tsx(${i + 1},1): error`).join("\n");
  const cited = citedLines(err, pages);
  assert.equal(cited.length, 4, "at most four citations");
  for (const c of cited) assert.ok(c.length < 260, `citation is ${c.length} chars`);
  // The same position twice is one citation, not two.
  const dupe = citedLines("src/routes/index.tsx(1,1): a\nsrc/routes/index.tsx(1,9): b", pages);
  assert.equal(dupe.length, 1);
});

test("the build route and the smoke both carry the citation", () => {
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // NOT /\bcited\b/. That was the first draft and it passed BEFORE the route
  // was wired at all: worker.js says "cited in the" and "uncited" in three
  // unrelated comments about image tags. The guard has to name the response key
  // AND where its value comes from, on one construct, which prose cannot be.
  assert.match(worker, /cited:[^\n]*pages\.cited/,
    "the route drops the citation before it reaches the caller");
  const smoke = fs.readFileSync(new URL("./integration/build-smoke.mjs", import.meta.url), "utf8");
  assert.match(smoke, /d\.cited/, "the smoke does not print it, so it may as well not exist");
});

// -------------------------------------------------- what the build trace sees

test("the model call, the compile and the publish are timed APART", async () => {
  // They were one `pages` number in the build trace — the majority of a build's
  // wall clock with no way to attribute it. `buildMs` already split out the
  // container; without the other two, "the build took four minutes" could mean
  // a slow model call or a slow publish and there was no way to tell.
  const { deps } = harness();
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  for (const k of ["genMs", "buildMs", "publishMs"]) {
    assert.equal(typeof out[k], "number", `${k} is not reported`);
    assert.ok(out[k] >= 0, `${k} is not a real duration`);
  }
});

test("the pages call's FOUR token kinds survive being priced", async () => {
  // `charge` collapsed them into a credit total and the breakdown was gone — so
  // the schema call reported its cache reads and writes while the pages call,
  // the one that actually costs money, reported a single number. Whether the
  // ~27k-token cached prefix pays for itself is answerable only from these.
  const usage = { in: 900, out: 11418, cacheRead: 27000, cacheWrite: 0 };
  const { deps } = harness({ generate: async () => ({ input: { pages: [good()] }, usage }) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.deepEqual(out.usage, usage);
  assert.equal(out.cost, pageCredits(usage), "the charge and the breakdown must describe the same call");
});

test("a build that never publishes still reports what it spent", async () => {
  // The failing path is the one where the numbers matter most: a compile failure
  // has already paid for the model call, so genMs and usage have to survive it.
  const { deps } = harness({ compile: async () => ({ ok: false, stage: "typecheck", error: "index.tsx(3,9): error TS2322" }) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.equal(typeof out.genMs, "number");
  assert.ok(out.usage, "the tokens were spent and the record of them was dropped");
  assert.equal(out.publishMs, undefined, "nothing was published, so nothing may claim to have been");
});

test("the container's own split is carried through, on success AND on failure", async () => {
  // `buildMs` is what the Worker waited for, including reaching the container at
  // all. These say where the time went INSIDE it, and they answer a different
  // question: `tsc` grows with the whole kit whether or not a page imports any
  // of it (4.97s → 8.02s when the charts landed), while `vite` only pays for
  // what is reachable. One number cannot tell a kit that is getting expensive
  // from a site that is getting big.
  const times = { routesMs: 400, tscMs: 8020, viteMs: 5170 };
  const ok = harness({ compile: async () => ({ ok: true, files: { "index.html": { t: "<x>" } }, ...times }) });
  const a = await publishPages(ok.deps, { spec: SPEC, slug: "cafe" });
  for (const k of Object.keys(times)) assert.equal(a[k], times[k], `${k} was dropped`);

  // The failing path matters MORE: a build that died in typecheck still spent
  // that time, and a slow typecheck is the symptom that says the kit has grown.
  const bad = harness({ compile: async () => ({ ok: false, stage: "typecheck", error: "index.tsx(3,9): error TS2322", ...times }) });
  const b = await publishPages(bad.deps, { spec: SPEC, slug: "cafe" });
  assert.equal(b.page, "placeholder");
  assert.equal(b.tscMs, times.tscMs, "a failed typecheck reports no duration, which is when it is most wanted");

  // A container that reports nothing must not invent numbers.
  const quiet = harness();
  const c = await publishPages(quiet.deps, { spec: SPEC, slug: "cafe" });
  assert.equal(c.tscMs, undefined);
});

test("a build that validated nothing says WHY, not just that it failed", async () => {
  // MEASURED LIVE 2026-08-04: a smoke build spent 23 credits on 10,297 output
  // tokens, every page was refused, and the response said `stage:-, problems:[]`
  // with a one-line note. `validatePages` had worked out exactly why and this
  // branch discarded it — while the branch immediately below already kept the
  // same field, so it was the odd one out rather than a policy.
  const { deps, calls } = harness({ generate: async () => gen([{ path: "../escape.tsx", source: "x" }]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.equal(out.stage, "validate", "the caller cannot tell this from a compile failure or an outage");
  assert.ok(out.problems.length > 0, "validatePages explained itself and the reasons were dropped");
  assert.match(out.error, /every page was refused/);
  // The breakdown must survive either way — that is what says whether the model
  // produced nothing or produced something unusable. It IS billed: `validate`
  // means the call ran and returned, and what it returned was the model's
  // answer. `usage` and `cost` are separate fields precisely so a path can
  // report the first without the second, which the our-fault cases do.
  assert.equal(out.cost, pageCredits(USAGE), "a refused generation still consumed its tokens");
  assert.equal(out.charged, true);
  assert.ok(out.usage, "usage is reported on every path, billed or not");
  // And nothing downstream ran.
  assert.equal(calls.compile.length, 0, "a build with no pages must not reach the container");
  assert.equal(calls.publish.length, 0);
});

test("and a generator that returned nothing at all is said plainly", async () => {
  // THREE OUTCOMES, NOT TWO, because they need three different responses: the
  // model answered in prose and never called the tool; it called the tool with
  // nothing in it; or it called it and every page was refused. A build spent
  // 9,810 output tokens and 22 credits on 2026-08-04 and the response could only
  // say "didn't produce a usable page", which is all three at once.
  const empty = harness({ generate: async () => gen([]) });
  const a = await publishPages(empty.deps, { spec: SPEC, slug: "cafe" });
  assert.equal(a.stage, "validate");
  assert.match(a.error, /called the tool with no pages/, a.error);

  // The one that actually happened: no tool_use block in the answer at all.
  const prose = harness({
    generate: async () => ({ ...gen([]), input: null, shape: { stopReason: "end_turn", blocks: ["text"] } }),
  });
  const b2 = await publishPages(prose.deps, { spec: SPEC, slug: "cafe" });
  assert.match(b2.error, /never called the tool/, b2.error);
  assert.match(b2.error, /end_turn/, "the stop reason is the first thing to look at and it is not reported");
  assert.match(b2.error, /text/, "which blocks came back says whether it answered in prose");
});

test("and the WORKER really produces that shape — the fake above is not proof", () => {
  // The test above hands publishPages a hand-made `shape`, so it proves the
  // reporting and says nothing about whether generateSitePages ever builds one.
  // Two mutants survived on exactly that gap: disabling the capture, and blanking
  // the stop reason, both passed the behavioural test.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const shape = use \? null : \{/,
    "generateSitePages no longer captures why there was no tool call");
  assert.match(w, /stopReason: String\(j\.stop_reason \|\| ""\)/,
    "the stop reason is the first thing to look at and it is not captured");
  assert.match(w, /blocks: \(Array\.isArray\(j\.content\) \? j\.content : \[\]\)\.map\(\(b\) => String\(b && b\.type\)\)/,
    "which block types came back is what says whether the model answered in prose");
  // NEVER THE TEXT. It is model-written prose about a customer's brief, and this
  // value is returned to the caller and logged.
  const at = w.indexOf("const shape = use ? null : {");
  assert.ok(!/b\.text/.test(w.slice(at, at + 400)), "the model's prose is being returned to the caller");
});

test("a published site IS billed, and billed AFTER it is live", async () => {
  // THE OTHER HALF OF THE RULE, and without it "don't charge for a placeholder"
  // is indistinguishable from "don't charge". The three failure tests above all
  // assert zero, so a charge deleted outright would pass every one of them.
  const { deps, calls } = harness();
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(calls.charges.length, 1, "a site that went live must be billed exactly once");
  assert.equal(out.cost, pageCredits(USAGE));

  // AFTER the publish, not before. A publish that throws leaves the customer
  // with no site, and billing first would take their credits for it. Asserted on
  // the source, because the ordering is invisible from the outside when both
  // succeed — which is the only case a fake can produce.
  //
  // `publish` is an our-fault stage with NO branch implementing it: a throw here
  // leaves the function with `useCredits` never called, so this ordering IS the
  // exemption rather than a rule beside it.
  const src = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const pub = src.indexOf("await deps.publish(");
  const chg = src.indexOf('await settle("published")');
  assert.ok(pub > 0 && chg > 0, "one of the two calls has been renamed");
  assert.ok(chg > pub, "the charge must come after the publish, or a failed publish still bills");
  // EXACTLY ONE PLACE SPENDS MONEY, or "billed once" is a property of this fake
  // rather than of the code. Anchored on `deps.useCredits(` — the actual spend —
  // and not on the name of whatever wraps it, because a helper can be renamed or
  // duplicated while this file keeps one charge in it.
  assert.equal((src.match(/deps\.useCredits\(/g) || []).length, 1, "a second charge site can double-bill");
});

// ── the container dying is not the code being wrong ──────────────────────────

test("a killed container is retried once, and the retry publishes", async () => {
  // MEASURED LIVE 2026-08-05: `vite build was killed by SIGTERM (no output)`,
  // 2.5 seconds into a bundle that normally takes 20 — because `build smoke`
  // started two seconds after a deploy and Cloudflare rolls the container image
  // out asynchronously, so the instance was drained underneath a running build.
  let n = 0;
  const { deps, calls } = harness({
    compile: async () => (++n === 1
      ? { ok: false, stage: "build", error: "vite build was killed by SIGTERM (no output)" }
      : { ok: true, files: { "index.html": { t: "<retry>" } } }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app", "the second attempt succeeded and must be published");
  assert.equal(calls.compile.length, 2);
  assert.equal(out.builds, 2);
  assert.match(out.retriedBuild, /SIGTERM/, "what was retried has to be visible, or this is invisible in production");
  // NOT the repair pass: the model is never asked again.
  assert.equal(calls.generate.length, 1, "a container failure must never buy a second generation");
  // And a site that went live is billed, once.
  assert.equal(calls.charges.length, 1);
  assert.equal(out.cost, pageCredits(USAGE));
});

test("a typecheck failure is NEVER retried", async () => {
  // The exclusion that stops this being a slow no-op on the common failure: a
  // page that does not compile does not compile the second time either, and the
  // customer would wait another 40 seconds for the same placeholder.
  const { deps, calls } = harness({
    compile: async () => ({ ok: false, stage: "typecheck", error: "src/routes/index.tsx(4,7): error TS2304" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.compile.length, 1, "a deterministic code failure must not be re-run");
  assert.equal(out.builds, 1);
  assert.equal(out.retriedBuild, undefined);
  assert.equal(out.page, "placeholder");
  assert.equal(out.cost, pageCredits(USAGE), "the model's own output failing is charged");
});

test("two container failures fall back, and still cost nothing", async () => {
  const { deps, calls } = harness({
    compile: async () => ({ ok: false, stage: "build", error: "the build service returned nothing" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.compile.length, 2, "exactly two — one retry, never a loop");
  assert.equal(calls.generate.length, 1);
  assert.equal(out.page, "placeholder");
  // FREE, and this is the case the whole our-fault rule exists for. Measured
  // live: `vite build was killed by SIGTERM`, 2.5s into a 20s bundle, two
  // seconds after a deploy — a container drained underneath a running build.
  // Nobody can be argued into paying for that.
  assert.equal(out.cost, 0, "the container dying is ours, not the customer's");
  assert.equal(out.charged, false);
  assert.equal(calls.publish.length, 0, "a broken dist must never reach storage");
  // buildMs covers BOTH attempts, because that is what the caller waited for.
  assert.ok(typeof out.buildMs === "number");
});

test("a thrown container is retried too — it is the same event", async () => {
  // `deps.compile` throwing becomes stage "build" inside `compile()`, so an
  // unreachable build service and a killed one are one case. Asserted, because
  // the throw takes a different route through the code to get there.
  let n = 0;
  const { deps, calls } = harness({
    compile: async () => { if (++n === 1) throw new Error("container boot timeout"); return { ok: true, files: { "index.html": { t: "<retry>" } } }; },
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.compile.length, 2);
  assert.equal(out.page, "app");
  assert.match(out.retriedBuild, /unreachable|boot timeout/);
});

// ── The web-research call ──────────────────────────────────────────────────
//
// Research runs BEFORE page generation, so it is a second model call whose cost
// lands on the same bill. The rule it has to obey is the one this whole file is
// built around and it is a single sentence: **if the customer got the
// placeholder, they were not charged.** Billing it where it happens would break
// that — a build that searched the web and then failed to publish would take
// credits and deliver nothing, which is the exact outcome this function was
// rewritten to stop.

test("a search is priced per search, not in tokens", () => {
  // It is invisible in the token counts — a research call reports a few hundred
  // tokens and can cost $0.04 on top. Counting only tokens would under-report a
  // searching build by more than the tokens came to.
  assert.equal(pageCost({ searches: 1 }), SEARCH_USD);
  assert.equal(pageCost({ searches: 4 }), SEARCH_USD * 4);
  assert.equal(pageCost({}), 0, "no searches must cost nothing");
  assert.equal(pageCost({ searches: 0 }), 0);
  // Four searches is five credits — worth more than a small generation's input.
  assert.equal(pageCredits({ searches: 4 }), 5);
});

test("usage from two calls is summed in MONEY, and rounded once", () => {
  // This used to sum the four TOKEN counts into one object and price the result,
  // which was correct exactly while every call in a build was on the same model.
  // It is not: under `auto` the designer is Opus and the pages are Sonnet, and a
  // merged token object has no honest rate to be priced at.
  assert.equal(totalCost({ in: 1, out: 2 }, { in: 10, searches: 3 }),
    pageCost({ in: 1, out: 2 }) + pageCost({ in: 10, searches: 3 }));
  assert.equal(totalCost(null, undefined, {}), 0, "nothing spent is nothing owed");
  assert.equal(totalCost(), 0);
  // THE PROPERTY THE OLD SHAPE EXISTED FOR, UNCHANGED: two small calls round to
  // one credit between them, not one credit each. Rounding per call would charge
  // twice for the rounding.
  assert.equal(pageCredits({ in: 1 }, { in: 1 }), 1);
  // And a cross-model pair is priced from two rows rather than one. Opus output
  // is 25/MTok against Sonnet's 15, so pricing both at either rate lands
  // somewhere this is not.
  const mixed = pageCredits({ out: 400_000, model: "claude-opus-5" }, { out: 400_000, model: "claude-sonnet-5" });
  assert.equal(mixed, Math.ceil((400_000 * 25e-6 + 400_000 * 15e-6) / 0.008));
  assert.notEqual(mixed, pageCredits({ out: 800_000, model: "claude-opus-5" }));
  assert.notEqual(mixed, pageCredits({ out: 800_000, model: "claude-sonnet-5" }));
});

test("every model priced is a model a build can actually send, and back", () => {
  // A DERIVED GUARD, BOTH WAYS, because this pair is how the picker ships a
  // silent undercharge: `build-models.mjs` names what runs, `MODEL_RATES` names
  // what it costs, and a model added to one and not the other is invisible —
  // `ratesFor` falls back rather than throwing, on purpose, so nothing fails.
  const named = new Set(Object.values(BUILD_MODELS).flatMap((m) => [m.design, m.pages]));
  assert.ok(named.size >= 2, "the pickers stopped naming distinct models");
  for (const m of named) {
    assert.ok(Object.hasOwn(MODEL_RATES, m), m + " can be selected by a picker and has no rate");
  }
  // The other direction is looser on purpose — the ask router's Haiku is priced
  // here and is not a picker choice — but every rate row must be a real model id
  // rather than a leftover, and the default must be one of them.
  for (const m of Object.keys(MODEL_RATES)) assert.match(m, /^claude-[a-z0-9-]+$/, m);
  assert.ok(Object.hasOwn(MODEL_RATES, DEFAULT_RATE_MODEL), "the default rate names no row");
  assert.equal(RATES, MODEL_RATES[DEFAULT_RATE_MODEL], "RATES must stay the default column");
});

test("an Opus build costs more than a Sonnet one, from the same usage", () => {
  // The whole reason the rate table went per-model on the day the picker was
  // wired: identical tokens, different bill. Opus is 5/25 against Sonnet's 3/15,
  // so a build that only changed its model must not cost the same.
  const u = { in: 3000, out: 12000, cacheRead: 27000, cacheWrite: 0 };
  const sonnet = pageCost({ ...u, model: "claude-sonnet-5" });
  const opus = pageCost({ ...u, model: "claude-opus-5" });
  const haiku = pageCost({ ...u, model: "claude-haiku-4-5" });
  assert.ok(opus > sonnet, "Opus priced at or below Sonnet");
  assert.ok(sonnet > haiku, "Sonnet priced at or below Haiku");
  // Not merely different — the right multiple. Every column is exactly 5/3 of
  // Sonnet's, so the whole bill is too.
  assert.ok(Math.abs(opus / sonnet - 5 / 3) < 1e-9, "Opus is not 5/3 of Sonnet");
  // A usage object naming NO model is priced at the default, which is what every
  // usage object written before the picker existed looks like.
  assert.equal(pageCost(u), sonnet, "an unnamed model must price as the default");
});

test("a model nobody priced fails DEAR, and says so", () => {
  // The direction is the decision. Only our own code can put a model id here —
  // the customer picks from a three-entry allow-list — so this branch means
  // somebody wired a model and forgot to price it. Failing cheap is a silent
  // undercharge that looks exactly like a working platform; failing dear shows
  // up on the meter the first time it happens, and visible mistakes get fixed.
  const errs = [];
  const real = console.error;
  console.error = (...a) => errs.push(a.join(" "));
  try {
    const u = { in: 1000, out: 1000, cacheRead: 1000, cacheWrite: 1000 };
    const unknown = pageCost({ ...u, model: "claude-something-6" });
    for (const m of Object.keys(MODEL_RATES)) {
      assert.ok(unknown >= pageCost({ ...u, model: m }), "cheaper than " + m);
    }
    assert.ok(errs.some((e) => e.includes("claude-something-6")), "priced silently");
    // DERIVED PER COLUMN, not one row picked by hand. Today every column's
    // maximum happens to be Opus, so hardcoding that row would satisfy the check
    // above — and would silently stop being the dearest the moment a model
    // arrives that is cheaper on input and dearer on output.
    const dear = ratesFor("claude-something-6");
    for (const col of ["in", "out", "cacheRead", "cacheWrite"]) {
      assert.equal(dear[col], Math.max(...Object.values(MODEL_RATES).map((r) => r[col])), col);
    }
    for (const row of Object.values(MODEL_RATES)) {
      assert.notEqual(dear, row, "the dearest rate is a single row rather than a per-column maximum");
    }
  } finally { console.error = real; }
  // Not an injection vector either: an object-shaped key must not resolve to a
  // rate through the prototype. This exact bug shipped once already, in the
  // Stripe plan lookup.
  const proto = pageCost({ out: 1000, model: "constructor" });
  assert.ok(proto > 0 && Number.isFinite(proto));
});

test("research is charged when the site actually publishes", async () => {
  const { deps, calls } = harness();
  const research = { in: 2000, out: 500, searches: 3 };
  const out = await publishPages(deps, { spec: SPEC, slug: "s", priorUsage: research });
  assert.equal(out.page, "app");
  assert.equal(calls.charges.length, 1, "exactly one charge");
  assert.equal(calls.charges[0], pageCredits(USAGE, research));
  // Strictly more than generation alone, or the research rode along free.
  assert.ok(calls.charges[0] > pageCredits(USAGE), "the research was not billed at all");
});

test("research rides on the SAME rule as generation, not a rule of its own", async () => {
  // A search is real money the moment it runs — $0.01 each, four of them is more
  // than a small generation's whole input — so where it lands has to be decided
  // by the same question as everything else: did WE break, or did the model just
  // answer badly. It used to be free on every placeholder; now it follows the
  // stage, and both directions are asserted from one table so a change that
  // makes it free everywhere (or charged everywhere) cannot pass half of it.
  const research = { in: 9000, out: 9000, searches: 4 };
  const both = pageCredits(USAGE, research);
  for (const [what, over, mine] of [
    ["no pages at all", { generate: async () => gen([]) }, false],
    ["pages, but no home page", { generate: async () => gen([good("about.tsx")]) }, false],
    ["compiled and failed", { compile: async () => ({ ok: false, stage: "typecheck", error: "TS2322" }) }, false],
    ["the container died", { compile: async () => ({ ok: false, stage: "build", error: "SIGTERM" }) }, true],
  ]) {
    const { deps, calls } = harness(over);
    const out = await publishPages(deps, { spec: SPEC, slug: "s", priorUsage: research });
    assert.equal(out.page, "placeholder", what);
    assert.deepEqual(calls.charges, mine ? [] : [both], what);
    // And the search is really IN that number rather than rounded away — a
    // charge equal to generation alone would satisfy the line above on a build
    // where the research was silently dropped.
    if (!mine) assert.ok(both > pageCredits(USAGE), what + ": the research rode along free");
  }

  // Could not afford the generation — no model call ran, so nothing to bill,
  // and the research never started either.
  {
    const { deps, calls } = harness({ readCredits: async () => 0 });
    const out = await publishPages(deps, { spec: SPEC, slug: "s", priorUsage: research });
    assert.equal(out.page, "placeholder");
    assert.equal(out.stage, "credits");
    assert.equal(out.charged, false);
    assert.deepEqual(calls.charges, []);
  }
});

test("a build with no research is billed exactly as before", async () => {
  // The feature must be invisible on the overwhelming majority of builds.
  const a = harness();
  await publishPages(a.deps, { spec: SPEC, slug: "s" });
  const b = harness();
  await publishPages(b.deps, { spec: SPEC, slug: "s", priorUsage: null });
  assert.deepEqual(a.calls.charges, b.calls.charges);
  assert.deepEqual(a.calls.charges, [pageCredits(USAGE)]);
});

test("the two calls' usage is reported apart, not merged", async () => {
  // Merging them would make the question the four-kind split exists to answer —
  // is the cached prefix paying for itself — unanswerable the moment a build
  // searches.
  const research = { in: 2000, out: 500, searches: 3 };
  const { deps } = harness();
  const out = await publishPages(deps, { spec: SPEC, slug: "s", priorUsage: research });
  assert.deepEqual(out.usage, USAGE, "generation usage was contaminated by the research");
  assert.deepEqual(out.priorUsage, research);
  // And absent entirely when there was none.
  const plain = await publishPages(harness().deps, { spec: SPEC, slug: "s" });
  assert.equal(plain.priorUsage, undefined);
});

// ── whose fault was it — the rule that decides who pays ──────────────────────

test("ourFault names the exempt stages, and an unknown one is exempt too", () => {
  // THE OUTPUT'S: the model ran and answered, the answer was unusable.
  for (const s of ["validate", "home", "typecheck"]) {
    assert.equal(ourFault(s), false, s + " is the model's own output and must be charged");
  }
  // OURS: nothing the customer did or asked for caused these.
  for (const s of ["build", "publish", "generate", "credits"]) {
    assert.equal(ourFault(s), true, s + " is our infrastructure and must not be charged");
  }
  // AND ANYTHING NOBODY CLASSIFIED. This is the important half: a failure mode
  // added later gets the free side by default, so the cost of forgetting to
  // classify it is revenue rather than somebody's trust. Asserted with values
  // that could plausibly appear — a new stage, and the three empty shapes.
  for (const s of ["bundle", "provision", "", null, undefined]) {
    assert.equal(ourFault(s), true, String(s) + " was never classified and must default to free");
  }
});

test("success goes through the same settle, so there is one place money moves", () => {
  // `published` is IN the charged set rather than short-circuiting past it. Two
  // charge sites is how a build eventually bills twice, and it is also how the
  // "charge comes after publish" source-read starts matching the wrong one.
  assert.ok(CHARGED_STAGES.has("published"));
  assert.equal(ourFault("published"), false);
});

test("the two sides of the rule are asserted from the same run", () => {
  // A test that only checks the charged side passes on an implementation that
  // charges for everything; only checking the free side passes on one that
  // charges for nothing. The set has to be exactly what it claims.
  assert.deepEqual([...CHARGED_STAGES].sort(), ["home", "published", "typecheck", "validate"]);
});

test("a publish that throws bills nothing, because it never reaches the charge", () => {
  // THE EXEMPTION WITH NO BRANCH BEHIND IT. `publish` is an our-fault stage and
  // nothing in publishPages tests for it — the ordering IS the implementation.
  // Driven rather than read, so it holds against the real control flow.
  return (async () => {
    const { deps, calls } = harness({ publish: async () => { throw new Error("R2 is down"); } });
    await assert.rejects(() => publishPages(deps, { spec: SPEC, slug: "cafe" }), /R2 is down/);
    assert.deepEqual(calls.charges, [], "a failed publish must never bill");
  })();
});

// ── the schema deposit, settled against what the call really used ────────────

test("schemaSettlement trues a deposit up to the measured cost", () => {
  // Costlier than the deposit: charge the difference.
  const big = { in: 40000, out: 4000, cacheRead: 0, cacheWrite: 0 };
  assert.equal(schemaSettlement(big, 2), pageCredits(big) - 2);
  assert.ok(schemaSettlement(big, 2) > 0, "a big schema call must settle upward");

  // Cheaper: give the difference back, as a negative.
  const small = { in: 200, out: 50, cacheRead: 0, cacheWrite: 0 };
  assert.equal(schemaSettlement(small, 2), pageCredits(small) - 2);
  assert.ok(schemaSettlement(small, 2) < 0, "a cheap schema call must settle downward");

  // Exactly right: nothing to do.
  const exact = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  assert.equal(schemaSettlement(exact, pageCredits(exact)), 0);
});

test("an unreadable usage report KEEPS the deposit rather than refunding it", () => {
  // The revenue hole this closes: if the provider renames its usage field, every
  // schema call reports nothing. Refunding on that turns a parsing change into
  // "the builder is free", which nobody notices for a month. Zero is also the
  // only answer that cannot over-charge.
  for (const nothing of [null, undefined, 0, "", NaN, false]) {
    assert.equal(schemaSettlement(nothing, 2), 0, String(nothing) + " must leave the deposit alone");
  }
});

test("a nonsense deposit is treated as zero, not as NaN", () => {
  // A settlement of NaN compares false against both > 0 and < 0, so the caller
  // silently does nothing and the customer is charged the deposit for a call
  // that may have cost far more. Coerced at the boundary instead.
  const u = { in: 1000, out: 1000 };
  for (const bad of [undefined, null, "two", NaN, {}]) {
    assert.equal(schemaSettlement(u, bad), pageCredits(u), String(bad) + " must read as no deposit");
  }
});

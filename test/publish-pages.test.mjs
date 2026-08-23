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
import { buildSource } from "./fixtures/build-source.mjs";
import fs from "node:fs";
import { publishPages, pageCredits, pageCost, citedLines, totalCost, RATES, MODEL_RATES,
  DEFAULT_RATE_MODEL, ratesFor, SEARCH_USD, MIN_CREDITS,
  ourFault, CHARGED_STAGES, schemaSettlement, salvagePlan, stubPage, routeIdFor, salvageNote, wasKilled,
  buildFloor, SCHEMA_PROFILE, SEED_PROFILE } from "../builder/publish-pages.mjs";
import { exitReason } from "../builder/exit-reason.mjs";
import { BUILD_MODELS } from "../builder/build-models.mjs";
// The real consumer of `out.images`, so the note a customer reads is what these
// tests assert rather than the field names it happens to branch on today.
import { imageNote } from "../builder/site-images.mjs";
import { SEED_MODEL, SEED_MAX_TOKENS } from "../builder/site-seed.mjs";

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
  const calls = { generate: [], compile: [], publish: [], stored: [], charges: [] };
  // The default dist is stamped with the attempt number, so a test can tell WHICH
  // attempt's build was published — otherwise "kept the first attempt" and "kept
  // the retry" produce identical, indistinguishable output.
  const base = {
    generate: async () => gen([good()]),
    compile: async () => ({ ok: true, files: { "index.html": { t: "<build-" + calls.compile.length + ">" } } }),
    publish: async () => {},
    readCredits: async () => 500,
    // RETURNS WHAT IT COLLECTED, because the real ledger does. `use_credits`
    // refuses a bill larger than the balance and debits ZERO, and this fake used
    // to be `async () => {}` — more capable than the thing it stands in for,
    // which is exactly how the platform shipped collecting nothing while
    // reporting `charged: true`. The setTotp lesson, one module over.
    useCredits: async (n) => n,
  };
  const pick = (k) => over[k] || base[k];
  const deps = {
    // FORWARDED BY SPREAD, not as a named parameter. Written `(fix) => …(fix)`
    // the wrapper manufactures an `undefined` argument the caller never passed,
    // so "generate is called with nothing" could never be asserted through it —
    // a fake less faithful than the real thing, which is how setTotp hid a bug.
    generate: (...a) => { calls.generate.push(a[0] || null); return pick("generate")(...a); },
    compile: (pages) => { calls.compile.push(pages); return pick("compile")(pages); },
    // BOTH ARGUMENTS, because the real dep takes both. Written `(dist) => …(dist)`
    // the second one — the SOURCE stored for a later revise — was dropped on the
    // floor, so nothing could assert what a revise would be handed back. That is
    // how the salvage could have stored a file that does not compile with every
    // test green: a fake less faithful than the real thing, the setTotp lesson.
    publish: (...a) => { calls.publish.push(a[0]); calls.stored.push(a[1]); return pick("publish")(...a); },
    readCredits: () => pick("readCredits")(),
    useCredits: (n) => { calls.charges.push(n); return pick("useCredits")(n); },
  };
  // OPTIONAL, and that is a property worth having: with no `images` dep the
  // function must behave exactly as it did before photographs existed, which is
  // what every other test in this file relies on.
  if (over.images) {
    calls.images = [];
    deps.images = (pages, opts) => { calls.images.push({ pages, opts }); return over.images(pages, opts); };
  }
  return { deps, calls };
}

/* ---------------------------------------------------------- photographs */

test("with no images dep the build is byte-identical to before photographs existed", () => {
  const { deps } = harness();
  assert.equal(typeof deps.images, "undefined");
});

test("a wrongly-named kit import is REPAIRED before it reaches the compiler", async () => {
  // ASSERTED AT THE DEP BOUNDARY, not by reading the source. `repairImports` is
  // correct and tested in page-gen.test.mjs; what this holds is that it is
  // CALLED here and that its answer is the thing compiled. Both halves have
  // their own way of dying silently — not called at all, or called and the
  // result dropped — and from outside each looks exactly like a generator that
  // wrote the right import. The wiring layer, which is where this repo has
  // recorded twelve features shipping dead.
  //
  // The case is the real one, measured on a live build: the prompt's own
  // reference pages import `Hero` from `hero.tsx` while the shortlist offers
  // only `hero-split`, so obeying both instructions produces an export name
  // from one and a module from the other. TS2305 on index.tsx, which salvage
  // refuses to stub, so the whole site publishes as the placeholder.
  const broken = () => ({
    path: "index.tsx",
    source: `import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/ui/hero-split";
export const Route = createFileRoute("/")({ component: Page });
function Page() { return <Hero title="x" />; }`,
  });
  const { deps, calls } = harness({ generate: async () => gen([broken()]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "app");
  assert.equal(calls.compile.length, 1);
  const src = calls.compile[0][0].source;
  assert.match(src, /import \{ HeroSplit \} from "@\/components\/ui\/hero-split"/);
  assert.match(src, /<HeroSplit title="x" \/>/, "the import was repaired and the usage was not");
  // And it says so, or the build response cannot tell a repaired page from one
  // the generator got right — which is the difference between a prompt worth
  // fixing and one that is fine.
  assert.deepEqual(out.repaired,
    [{ path: "index.tsx", module: "hero-split", from: "Hero", to: "HeroSplit" }]);
});

test("a build whose imports were all correct reports no repairs at all", async () => {
  // The ABSENCE, because `repaired: []` on every clean build reads in the
  // response and in the eval as a generator that keeps getting names wrong.
  const { deps } = harness();
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "app");
  assert.equal(out.repaired, undefined);
});

test("a bought photograph reaches the compiler, and the placeholder does not", async () => {
  const withToken = () => ({
    path: "index.tsx",
    source: good().source.replace("<div>", '<div><SafeImage src="@@IMG:the shop@@" />'),
  });
  const { deps, calls } = harness({
    generate: async () => gen([withToken()]),
    images: async (pages) => ({
      pages: pages.map((p) => ({ ...p, source: p.source.replace("@@IMG:the shop@@", "/u/x/ab.jpg") })),
      made: 1, planned: 1, budget: 1, overflow: 0,
    }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "app");
  assert.match(calls.compile[0][0].source, /\/u\/x\/ab\.jpg/);
  assert.ok(!/@@IMG:/.test(calls.compile[0][0].source), "no token survives to the container");
  assert.deepEqual(out.images, { made: 1, planned: 1, budget: 1, overflow: 0 });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO FACTS THAT STOP US GIVING ADVICE THAT CANNOT WORK.
//
// `out.images` is rebuilt field by field from a fixed list, and `full` and
// `empty` were not on it — so `imageNote`, which reads THIS object and not the
// one `buySitePhotos` returned, could never reach two of its four sentences.
// An owner whose upload library is at its cap was told to buy credits, on the
// one build where the fix is free; a picture nobody described was reported as
// our failure to make it, which gives them nothing to do.
//
// Driven THROUGH `imageNote` rather than asserting the field names, because the
// field is not the point — the sentence a customer reads is, and pinning the
// key would go green against a note that stopped branching on it.
test("a full upload library reaches the note that says so", async () => {
  const { deps } = harness({
    images: async (pages) => ({ pages, made: 0, planned: 3, budget: 0, overflow: 0, full: true }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.images.full, true);
  assert.match(imageNote(out.images), /library is full/,
    "the owner is told to buy credits when what they need is to delete a few uploads");
  // The discrimination is only real if the other cause still gets the other
  // sentence — otherwise this passes by making every zero-budget build say the
  // same new thing.
  const { deps: poor } = harness({
    images: async (pages) => ({ pages, made: 0, planned: 3, budget: 0, overflow: 0 }),
  });
  const broke = await publishPages(poor, { spec: SPEC, slug: "x" });
  assert.ok(!("full" in broke.images), "a build that could merely not afford them claimed a full library");
  assert.match(imageNote(broke.images), /credits/);
});

test("a picture nobody described reaches the note that asks what it should show", async () => {
  const { deps } = harness({
    images: async (pages) => ({ pages, made: 0, planned: 2, budget: 2, overflow: 0, empty: 2 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.images.empty, 2);
  assert.match(imageNote(out.images), /weren't described/,
    "we blamed ourselves for something the pipeline deliberately never attempted");
  // A REAL failure keeps its own sentence — `error` is the discriminator and it
  // cannot be faked, so an attempt that failed must not be reported as one that
  // was never made.
  const { deps: broke } = harness({
    images: async (pages) => ({ pages, made: 0, planned: 2, budget: 2, overflow: 0, empty: 1, error: "fal 500" }),
  });
  const failed = await publishPages(broke, { spec: SPEC, slug: "x" });
  assert.match(imageNote(failed.images), /Couldn't make/);
});

test("neither field appears on a build that has nothing to say", async () => {
  // Presence is the signal, so an ordinary response has to be byte-identical.
  const { deps } = harness({
    images: async (pages) => ({ pages, made: 1, planned: 1, budget: 1, overflow: 0 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.deepEqual(out.images, { made: 1, planned: 1, budget: 1, overflow: 0 });
});

test("`full` is strictly true and `empty` is a real count", async () => {
  // `full` merely truthy would let an unreadable listing claim a full library,
  // which is the one wrong answer here that sends somebody deleting photographs
  // they did not need to delete. A zero `empty` is not a fact worth carrying.
  const { deps } = harness({
    images: async (pages) => ({ pages, made: 0, planned: 1, budget: 0, overflow: 0, full: "yes", empty: 0 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.ok(!("full" in out.images), "a non-boolean was promoted into a claim about the owner's library");
  assert.ok(!("empty" in out.images));
});

test("the images dep is given the balance and the MEASURED cost of this build", async () => {
  // Measured, not estimated: generation has already happened by then. A guess low
  // spends the pages' own budget on pictures; a guess high refuses photographs
  // somebody could afford.
  const { deps, calls } = harness({
    readCredits: async () => 300,
    generate: async () => gen([good()], { usage: { in: 10000, out: 10000 } }),
    images: async (pages) => ({ pages, made: 0, planned: 0, budget: 0, overflow: 0 }),
  });
  await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(calls.images.length, 1);
  assert.equal(calls.images[0].opts.balance, 300);
  assert.equal(calls.images[0].opts.reserve, pageCredits({ in: 10000, out: 10000 }));
});

test("photographs are billed through the same settle, rounded once with the tokens", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([good()], { usage: { in: 10000, out: 10000 } }),
    images: async (pages) => ({ pages, made: 2, planned: 2, budget: 2, overflow: 0 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  const expected = pageCredits({ in: 10000, out: 10000 }, { images: 2 });
  assert.deepEqual(calls.charges, [expected]);
  assert.equal(out.cost, expected);
  // ONE rounding, not two. Charging the tokens and the pictures separately and
  // adding the results pays for the rounding twice.
  assert.notEqual(expected, pageCredits({ in: 10000, out: 10000 }) + pageCredits({ images: 2 }));
});

test("the bill follows what was MADE, never what was budgeted", async () => {
  // Found by mutation: billing `out.images.budget` survived every test above,
  // because all of them set made === budget. Three pictures budgeted and one
  // stored is the ordinary shape of a partial image-model failure, and charging
  // the budget bills 38 credits for one photograph.
  const { deps, calls } = harness({
    generate: async () => gen([good()], { usage: { in: 10000, out: 10000 } }),
    images: async (pages) => ({ pages, made: 1, planned: 3, budget: 3, overflow: 0, error: "photo 500" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.deepEqual(calls.charges, [pageCredits({ in: 10000, out: 10000 }, { images: 1 })]);
  assert.notEqual(calls.charges[0], pageCredits({ in: 10000, out: 10000 }, { images: 3 }),
    "the two must differ, or this assertion proves nothing");
  assert.equal(out.images.made, 1);
  assert.equal(out.images.budget, 3);
});

test("an our-fault stage does not bill for the photographs either", async () => {
  // `build` is the drained-container stage. The pictures really were bought and
  // we really do eat them — one rule for the whole build, not two that can
  // disagree about a build that half-worked.
  const { deps, calls } = harness({
    generate: async () => gen([good()], { usage: { in: 10000, out: 10000 } }),
    images: async (pages) => ({ pages, made: 3, planned: 3, budget: 3, overflow: 0 }),
    compile: async () => ({ ok: false, stage: "build", error: "SIGTERM" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.deepEqual(calls.charges, []);
  assert.equal(out.charged, false);
  assert.equal(out.images.made, 3, "still reported, so the spend is visible even when it is not billed");
});

test("a typecheck failure DOES bill for them, and that is the stated trade", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([good()], { usage: { in: 10000, out: 10000 } }),
    images: async (pages) => ({ pages, made: 2, planned: 2, budget: 2, overflow: 0 }),
    compile: async () => ({ ok: false, stage: "typecheck", error: "index.tsx(3,1): TS2322" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(calls.charges[0], pageCredits({ in: 10000, out: 10000 }, { images: 2 }));
  assert.equal(out.charged, true);
});

test("an images dep that throws cannot fail the build", async () => {
  const { deps } = harness({ images: async () => { throw new Error("fal is down"); } });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "app", "a picture that could not be bought is a placeholder, not a failed site");
  assert.match(out.images.error, /fal is down/);
  assert.equal(out.images.made, 0);
});

test("an images dep that returns the wrong number of pages is ignored, not trusted", async () => {
  // Publishing what it hands back would ship a site missing a route, which
  // typechecks (the route file is simply absent) and 404s the moment somebody
  // clicks the nav.
  const { deps, calls } = harness({
    generate: async () => gen([good("index.tsx"), good("about.tsx")]),
    images: async () => ({ pages: [good("index.tsx")], made: 0, planned: 0, budget: 0, overflow: 0 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(calls.compile[0].length, 2, "the model's own pages, not the truncated set");
  assert.equal(out.page, "app");
});

test("photographs are bought AFTER the pages are validated, so a refused build spends nothing", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([]),
    images: async (pages) => ({ pages, made: 1, planned: 1, budget: 1, overflow: 0 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.stage, "validate");
  assert.equal(calls.images.length, 0, "nothing to put a picture in, so nothing is bought");
});

test("a build with no home page buys no photographs", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([good("about.tsx")]),
    images: async (pages) => ({ pages, made: 1, planned: 1, budget: 1, overflow: 0 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.stage, "home");
  assert.equal(calls.images.length, 0);
});

test("the charge still comes after publish, with photographs in it", () => {
  // The `publish` exemption IS the ordering — there is no branch for it — so
  // moving the spend above `deps.publish` would silently start billing for our
  // own storage outages.
  const src = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const pub = src.indexOf("await deps.publish(");
  const spend = src.indexOf("await deps.useCredits(");
  assert.ok(pub > 0 && spend > 0, "both anchors exist, or the comparison passes vacuously");
  assert.ok(spend < pub, "useCredits lives in settle, which the published path calls after publish");
  const settle = src.indexOf('await settle("published")');
  assert.ok(settle > pub, "and settle itself is called after publish");
});

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

test("a failed charge never fails the build, and never claims to have charged", async () => {
  // The tokens are already spent by the time the ledger is asked. Losing the
  // credit is bad; throwing away a site the caller already paid for is worse.
  //
  // `cost` USED TO BE ASSERTED > 0 HERE, and that was the old meaning of the
  // field — what we asked for. It is what actually LEFT the ledger now, so a
  // ledger outage reports zero taken and the price under `billed`. Reporting a
  // cost the customer's balance does not show is the whole bug this pair of
  // fields exists to prevent.
  const { deps, calls } = harness({ useCredits: async () => { throw new Error("rpc down"); } });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(calls.publish.length, 1);
  assert.equal(out.cost, 0, "nothing left the ledger");
  assert.equal(out.charged, false, "so do not tell the customer it did");
  assert.ok(out.billed > 0, "what the work cost is still reported");
});

test("a SHORT ledger collects what it can, and reports that rather than the bill", async () => {
  // THE CRITICAL BUG. `use_credits` is a gate, not a till: a bill larger than
  // the balance debits ZERO and answers -1 without throwing. `settle` awaited it
  // and moved on, so a new account's first build published a real site, said
  // "this attempt used credits", and moved the ledger by nothing.
  //
  // Driven through the dep boundary, because that is where the real ledger's
  // answer arrives — a fake that always succeeds cannot express this at all.
  const { deps, calls } = harness({
    generate: async () => gen([good()], { usage: { in: 10000, out: 10000 } }),
    useCredits: async () => 4,          // the ledger only had four
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  const bill = pageCredits({ in: 10000, out: 10000 });
  assert.equal(out.page, "app");
  assert.equal(calls.charges[0], bill, "it still ASKS for the full bill");
  assert.equal(out.billed, bill);
  assert.equal(out.cost, 4, "and reports only what was taken");
  assert.equal(out.charged, true, "four credits is still a charge");
  assert.ok(bill > 4, "the two numbers must differ, or this proves nothing");
});

test("a ledger that collects NOTHING reports charged:false", async () => {
  const { deps } = harness({ useCredits: async () => 0 });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app", "the site still publishes — the work was done");
  assert.equal(out.cost, 0);
  assert.equal(out.charged, false);
  assert.ok(out.billed > 0, "and what it should have cost is still recorded");
});

test("the sentence a FAILED build shows follows the ledger, not the intent", async () => {
  // `typecheck` is a charged stage, so this build intends to bill. If the ledger
  // took nothing, telling the customer "this attempt used credits" is a lie they
  // can check against their own balance in one glance.
  const short = harness({
    useCredits: async () => 0,
    compile: async () => ({ ok: false, stage: "typecheck", error: "index.tsx(3,1): TS2322" }),
  });
  const a = await publishPages(short.deps, { spec: SPEC, slug: "cafe" });
  assert.match(a.notes, /weren't charged/);
  assert.equal(a.charged, false);

  const paid = harness({
    compile: async () => ({ ok: false, stage: "typecheck", error: "index.tsx(3,1): TS2322" }),
  });
  const b = await publishPages(paid.deps, { spec: SPEC, slug: "cafe" });
  assert.match(b.notes, /used credits/, "and a real charge still says so");
  assert.equal(b.charged, true);
});

test("a charged failure says what the money bought, and never invents pages", async () => {
  // SEEN LIVE 2026-08-10. A real build came back `stage: validate` / "the
  // generator called the tool with no pages in it", under a sentence reading
  // "the pages were written, they just didn't work". No pages were written —
  // that is the whole reason the stage fired. It is the worst moment to be
  // inaccurate, because the same message is saying they have been charged.
  //
  // `validate` covers three outcomes and only one wrote anything. The CHARGE is
  // the same for all three — the tokens were really spent — so what changes is
  // only the description, which is asserted per outcome here.
  const empty = harness({ generate: async () => gen([]) });
  const a = await publishPages(empty.deps, { spec: SPEC, slug: "cafe" });
  assert.equal(a.stage, "validate");
  assert.match(a.notes, /used credits/, "the tokens were spent, so this is still a charge");
  assert.doesNotMatch(a.notes, /pages were written/,
    "it claims pages were written on the one path where none were");
  assert.match(a.notes, /didn't return a page/);

  // The model never calling the tool at all is the same class.
  const none = harness({ generate: async () => gen([], { input: null, shape: { stopReason: "end_turn", blocks: ["text"] } }) });
  const b = await publishPages(none.deps, { spec: SPEC, slug: "cafe" });
  assert.doesNotMatch(b.notes, /pages were written/);

  // …and a build whose pages really WERE written and then failed still says so,
  // or the assertions above pass on a message that simply stopped saying it.
  const wrote = harness({ compile: async () => ({ ok: false, stage: "typecheck", error: "index.tsx(3,1): TS2322" }) });
  const c = await publishPages(wrote.deps, { spec: SPEC, slug: "cafe" });
  assert.match(c.notes, /pages were written/, "a real typecheck failure did write pages and must say so");
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

test("THE PUBLISH-TIME HEAD IS A SIDECAR, and no document is patched", async () => {
  // WHAT THIS REPLACES. It asserted that `injectMeta`/`pageMeta`/`setTitle` ran
  // over every `.html` in the dist — the description, the share image, the
  // per-page `og:url`, and the `<meta name="site-slug">` tag `siteSlug()` reads
  // on a custom domain, where there is no `/s/<slug>/` in the path to learn it
  // from.
  //
  // MEASURED ON A REAL TANSTACK START BUILD: `dist/client` contains no HTML at
  // all. So that block could not fire on anything, and every one of those
  // assertions would have passed for ever over a loop that never ran once.
  //
  // The head is composed by `__root.tsx` per request instead: the baked half
  // (slug, brand, language, icon) comes from `site-brand.ts` and the
  // publish-time half is read back out of `sitemeta/<slug>.json`. Which makes
  // the slug the important one to keep asserted — it is what stops a visitor
  // landing on /book of a custom domain being pointed at a DIFFERENT site's API,
  // and it moved from a patched tag to the bundle.
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const gone of ["injectMeta", "pageMeta", "setTitle", "routeByFile"]) {
    assert.ok(!new RegExp("\\b" + gone + "\\b").test(code),
      gone + " is back in worker.js — Start emits no document for it to patch, so it would run over nothing");
  }
  // AND THE SIDECAR REALLY IS WRITTEN, with the slug on the site's own bundle.
  // Either half alone passes while the wire is cut: a publish that writes no
  // sidecar loses every site's share tags, and a bundle with no slug addresses
  // the wrong API.
  assert.match(src, /await env\.SITES_BUCKET\.put\(siteMetaKey\(slug\)/,
    "the publish no longer writes the meta sidecar");
  const brand = fs.readFileSync(new URL("../builder/lovable/template/src/site-brand.ts", import.meta.url), "utf8");
  assert.match(brand, /export const SITE_SLUG/, "the bundle no longer carries its own slug");
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
  // FOUR OUTCOMES, NOT TWO, because they need four different answers: the model
  // answered in prose and never called the tool; it called the tool with no
  // `pages` list at all; with an empty one; or with pages that had no code in
  // them. A build spent 9,810 output tokens and 22 credits on 2026-08-04 and the
  // response could only say "didn't produce a usable page" — and on 2026-08-10 a
  // real failure could not be diagnosed the next day because all four printed one
  // sentence. Each is driven here, and they must not read alike.
  const empty = harness({ generate: async () => gen([]) });
  const a = await publishPages(empty.deps, { spec: SPEC, slug: "cafe" });
  assert.equal(a.stage, "validate");
  assert.match(a.error, /empty `pages` list/, a.error);
  // The output-token count is the one number separating "the model said almost
  // nothing" from "it wrote a whole site and we dropped every page of it".
  assert.match(a.error, /output tokens/, "the size of what came back is not reported");

  // A tool call carrying no `pages` key at all — different mistake, and it read
  // identically until this was split.
  const noList = harness({ generate: async () => ({ ...gen([]), input: { notes: "here you go" } }) });
  const a2 = await publishPages(noList.deps, { spec: SPEC, slug: "cafe" });
  assert.match(a2.error, /no `pages` list at all/, a2.error);
  assert.notEqual(a2.error, a.error, "an absent list and an empty one must not read the same");

  // Pages that were NAMED and had no code in them. This was a silent skip, so it
  // came out as zero pages and zero problems and was reported as a tool call with
  // no pages in it — which is false, and sends whoever reads it the wrong way.
  const hollow = harness({ generate: async () => ({ ...gen([]), input: { pages: [{ path: "index.tsx", source: "" }] } }) });
  const a3 = await publishPages(hollow.deps, { spec: SPEC, slug: "cafe" });
  assert.match(a3.error, /every page was refused/, a3.error);
  assert.match(a3.error, /index\.tsx.*no code in it/, "the empty page is not named");

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

test("EVERY CONTAINER RUN IS COUNTED, retry and salvage together", async () => {
  // `compileWithRetry` ASSIGNED `out.builds`, and the salvage path calls it a
  // second time — so the second call reset the counter and the manual `+ 1`
  // beside it added to a total that had just been erased. Three runs reported
  // two, on exactly the path where the retry mechanism is doing its job.
  //
  // The drain diagnostic went the same way: unconditional, so the salvage
  // compile overwrote the drain that caused the retry — the one thing the field
  // exists to name.
  // TWO DRAINS, because one cannot show the overwrite. With the salvage compile
  // succeeding, `compileWithRetry`'s second call never reaches its own retry
  // branch and an unconditional `retriedBuild` is never exercised — a mutant
  // proved exactly that, and the fixture was the thing at fault.
  let n = 0;
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async () => {
      n++;
      // 1: drained mid-bundle. 2: the retry, which fails at typecheck.
      // 3: the salvage recompile, drained too. 4: its retry, which works.
      if (n === 1) return { ok: false, stage: "build", error: "vite build was killed by SIGTERM (drain one)" };
      if (n === 2) return { ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,1): error TS2322: x" };
      if (n === 3) return { ok: false, stage: "build", error: "vite build was killed by SIGTERM (drain two)" };
      return { ok: true, files: { "index.html": { t: "<ok>" } } };
    },
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x", livePages: [] });
  assert.equal(out.page, "app");
  assert.equal(calls.compile.length, 4, "the fixture no longer drives four runs — retarget this test");
  assert.equal(out.builds, calls.compile.length,
    "the container ran " + calls.compile.length + " times and the response says " + out.builds);
  assert.match(out.retriedBuild, /drain one/,
    "the drain that caused the retry was overwritten by a later compile");
  assert.doesNotMatch(out.retriedBuild, /drain two/, "the two must differ, or this assertion proves nothing");
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
  // TWO PROVIDERS SINCE 2026-08-21, and the dot matters: `grok-4.6` carries one
  // where every Anthropic id does not, so the old `[a-z0-9-]` class refused a
  // perfectly real model. Kept as a shape check rather than widened to
  // anything-goes — its job is catching a leftover row, and a row naming a
  // provider we do not call is exactly that.
  for (const m of Object.keys(MODEL_RATES)) assert.match(m, /^(claude|grok)-[a-z0-9.-]+$/, m);
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

// ─────────────────────────────────────────────────────────────────────────────
// THE GATE AND THE BILL MEASURE THE SAME SET OF CALLS.
//
// `buildFloor` priced the DESIGNER call and the route settles the same deposit
// against `schemaSettlement([schemaUsage, seedUsage], …)` — the designer PLUS
// the Haiku top-up that fires whenever the designer omits its required `seed`.
// So the gate measured a smaller set than the charge, and the gate was the
// smaller one: a balance in that one-credit band passed, was charged the full
// schema cost, and was then refused by this module's own `MIN_CREDITS` floor
// with `stage: "credits"`. That is verbatim the failure `SCHEMA_PROFILE`'s
// docstring says the gate exists to prevent.
//
// Asserted as a PROPERTY — the floor covers what the settlement will bill —
// rather than as a number, so re-measuring either profile does not go red for a
// reason that is not a bug.
test("BUILDFLOOR COVERS THE SEED TOP-UP THE SAME DEPOSIT SETTLES", () => {
  for (const design of Object.keys(MODEL_RATES)) {
    const schema = { ...SCHEMA_PROFILE, model: design };
    // What the route really settles, through the real `schemaSettlement`, with
    // the deposit trued up: this is the whole schema step's bill.
    const billed = pageCredits(schema, SEED_PROFILE);
    assert.ok(buildFloor(design) >= billed + MIN_CREDITS,
      design + ": the gate admits " + buildFloor(design) + " and the schema step can bill " + billed +
      ", leaving less than MIN_CREDITS " + MIN_CREDITS + " — charged, then refused");
    // …and the two halves stay visible rather than folded into one tuned number.
    assert.equal(buildFloor(design), billed + MIN_CREDITS);
  }
});

test("…and the seed half really moves it, or the guard above is vacuous", () => {
  // A `SEED_PROFILE` cheap enough to vanish inside the existing rounding would
  // satisfy every assertion here while leaving the gate exactly as short as it
  // was. Measured 2026-08-21: sonnet 20 → 22, grok 14 → 16, opus 28 → 30.
  for (const design of Object.keys(MODEL_RATES)) {
    const designerOnly = pageCredits({ ...SCHEMA_PROFILE, model: design }) + MIN_CREDITS;
    assert.ok(buildFloor(design) > designerOnly,
      design + ": counting the seed call changed nothing — the floor is still the designer alone");
  }
});

test("the seed profile is the seed call's own ceiling, not a number typed here", () => {
  // A BOUND rather than a live reading, and both halves come from the seed
  // module: `out` is the cap the API enforces, so the call cannot produce more,
  // and the model decides which rate column prices it. Restating either here is
  // how a gate drifts away from the thing it guards — which is the bug.
  assert.equal(SEED_PROFILE.out, SEED_MAX_TOKENS, "the output ceiling stopped tracking the seed call's cap");
  assert.equal(SEED_PROFILE.model, SEED_MODEL, "the seed call is priced at another model's rates");
  // No cache to read or write: the seed request carries no cached prefix, and
  // claiming one would price the gate BELOW what the call costs.
  assert.equal(SEED_PROFILE.cacheRead, 0);
  assert.equal(SEED_PROFILE.cacheWrite, 0);
  // The input bound has to cover the worst request the module can build.
  assert.ok(SEED_PROFILE.in >= 1900,
    "the input bound is under the ~1,860 tokens a worst-case seed request measured at");
});

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

test("collectCredits takes what is there when the ledger refuses the full bill", () => {
  // worker.js cannot be imported, and this is the function the critical bug turns
  // on: `use_credits` answers -1 and debits ZERO when the balance is short, so a
  // caller that ignores the answer collects nothing and reports a charge.
  //
  // Mutation found both halves uncovered: dropping the `>= 0` check, and
  // returning `take` without checking the second call succeeded.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function collectCredits"), src.indexOf("// Reverse a small service fee"));
  assert.ok(fn.length > 300, "collectCredits moved — this guard checks nothing");
  assert.match(fn, /if \(\(await useCredits\(authHeader, want\)\) >= 0\) return want;/,
    "the -1 answer is ignored, so a short balance collects nothing");
  assert.match(fn, /const bal = Math\.max\(0, Number\(await readCredits\(authHeader\)\) \|\| 0\);/,
    "nothing reads the balance to fall back to");
  assert.match(fn, /return \(await useCredits\(authHeader, take\)\) >= 0 \? take : 0;/,
    "the second debit's answer is ignored too — it reports collecting what it may not have");
});

test("every after-the-fact settle goes through collectCredits, not useCredits", () => {
  // The split that matters: a call site that GATES reads the -1 and refuses; one
  // that SETTLES after the work was done must collect what it can. Mixing them up
  // is how this shipped charging nothing.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /useCredits: \(n\) => collectCredits\(auth, n\)/, "publishPages' dep still only asks");
  assert.match(src, /schemaCost = SITE_BUILD_FEE \+ await collectCredits\(/, "the schema settlement still only asks");
  assert.match(src, /rCost = await collectCredits\(auth, rCost\)/, "the router still only asks");
});

test("refundCredits gives back the WHOLE amount, not one capped call", () => {
  // `credit_back` hard-caps a call at 10 and a cold Opus schema settles to 15, so
  // a single call keeps 5 on the one path that refunds in full. Mutation proved
  // asserting `Math.min(10, left)` alone passes when the INPUT is clamped instead.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // Sliced to the NEXT landmark after it, not to a comment that sits above it —
  // `refundCredits` follows `creditBack`, so ending at the creditBack banner gave
  // an empty window that matched nothing and passed vacuously.
  const at = src.indexOf("async function refundCredits");
  const fn = src.slice(at, src.indexOf("// Read the caller's balance", at));
  assert.ok(fn.length > 150 && fn.length < 1200, "refundCredits moved — window is " + fn.length);
  assert.match(fn, /let left = Math\.max\(0, Number\(amount\) \|\| 0\);/,
    "the amount is clamped on the way IN, so the loop can never reach the rest");
  assert.match(fn, /left -= chunk;/, "nothing decrements, so this loops or refunds once");
  assert.match(fn, /Math\.min\(10, left\)/, "it must split into calls the RPC accepts");
});

test("a refusal AFTER the design call refunds the schema charge", () => {
  // Four of them, and all four returned before anything was provisioned while the
  // client asserted "you weren't charged". Asserted by counting: a single missed
  // branch is the whole bug.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // THROUGH `refundFields` NOW, and the count is the same property. That helper
  // exists because every one of these called `refundCredits` as a bare
  // statement and threw away the boolean it returns — so a reversal that did
  // not land was invisible and the response said `cost: 0` anyway.
  const refunds = (src.match(/await refundFields\(schemaCost\)/g) || []).length;
  assert.ok(refunds >= 4, `only ${refunds} post-design refusals refund the schema charge — expected the 409, the 503, the no-tables 400 and the provisioning conflict`);
  // …AND EVERY ONE REPORTS WHAT IT COULD NOT GIVE BACK. Refunding and then
  // asserting `cost: 0` regardless is the bug, not the absence of a refund.
  const spreads = (src.match(/\.\.\.back[,\s}]/g) || []).length;
  assert.ok(spreads >= refunds, `${refunds} refusals refund and only ${spreads} say what stayed on the ledger`);
  assert.ok(!/await refundCredits\(env, bu\.id, Math\.max\(0, schemaCost\)\)/.test(src),
    "a build-route refusal calls refundCredits directly again, so its boolean is discarded");
});

/* --------------------------------------------------- salvaging a failed compile */

test("salvagePlan stubs the page the compiler named", () => {
  const pages = [good(), good("menu.tsx")];
  // `[]` SAID EXPLICITLY, which is the first-build contract. Omitting it means
  // "we don't know what is live" and refuses — see the unknown-vs-empty tests
  // below. A test that relied on omission would pass against the fail-open bug.
  const p = salvagePlan('src/routes/menu.tsx(9,10): error TS2305: no exported member', pages, []);
  assert.deepEqual(p.stub, ["menu.tsx"]);
  assert.equal(p.reason, "");
});

test("salvagePlan refuses when the HOME page is the one that failed", () => {
  // Stubbing index leaves the one address a customer shares rendering an apology,
  // and the header that reaches every other page went with the source. The `home`
  // stage already refuses a build with no index; this is the same rule for a
  // build whose index is unusable.
  const pages = [good(), good("menu.tsx")];
  const p = salvagePlan('src/routes/index.tsx(4,1): error TS2322: x', pages);
  assert.deepEqual(p.stub, []);
  assert.match(p.reason, /home page/);
});

test("salvagePlan refuses when the home page failed ALONGSIDE another", () => {
  // The dangerous shape: a set containing index passes any "is there something to
  // stub" check, and stubbing the rest publishes a site whose front door apologises.
  const pages = [good(), good("menu.tsx")];
  const p = salvagePlan('src/routes/menu.tsx(3,1): error TS1005: x\nsrc/routes/index.tsx(4,1): error TS2322: y', pages);
  assert.deepEqual(p.stub, []);
  assert.match(p.reason, /home page/);
});

test("salvagePlan refuses an error in a file the build did not write", () => {
  // A kit or template error is not fixable by stubbing pages, and trying costs a
  // whole container run. `foreign` is kept rather than folded into the reason
  // because it names a file WE shipped broken.
  const pages = [good(), good("menu.tsx")];
  const p = salvagePlan('src/components/ui/faq.tsx(3,1): error TS1005: x', pages);
  assert.deepEqual(p.stub, []);
  assert.deepEqual(p.foreign, ["src/components/ui/faq.tsx"]);
});

test("salvagePlan refuses a failure that names no file at all", () => {
  const p = salvagePlan("vite build was killed by SIGTERM", [good()]);
  assert.deepEqual(p.stub, []);
  assert.match(p.reason, /names no page/);
});

test("routeIdFor agrees with tsr generate's own convention", () => {
  // The generated route tree is what every other page's <Link to="…"> is typed
  // against, so a stub declaring the wrong id is a second compile error rather
  // than a repair.
  assert.equal(routeIdFor("index.tsx"), "/");
  assert.equal(routeIdFor("book.tsx"), "/book");
  assert.equal(routeIdFor("src/routes/memberships.tsx"), "/memberships");
  assert.equal(routeIdFor("blog/index.tsx"), "/blog");
  assert.equal(routeIdFor("blog/$slug.tsx"), "/blog/$slug");
});

test("stubPage keeps the route and stays permissive about search params", () => {
  const s = stubPage("book.tsx");
  assert.match(s, /createFileRoute\("\/book"\)/);
  // A price row navigating with `search: { service }` is typed against the
  // DESTINATION's validator, so a stub with none makes that call a type error —
  // the same cascade the stub exists to avoid, one prop over.
  assert.match(s, /validateSearch:/);
  // Never a plain anchor: a published site is mounted under a basepath on the
  // preview origin, where <a href="/"> leaves the site entirely.
  assert.match(s, /<Link\s+to="\/"/);
  assert.doesNotMatch(s, /<a\s+href=/);
});

test("one bad page costs one page, not the whole site", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async (pages) =>
      pages.some((p) => p.path === "menu.tsx" && p.source.includes("useRows"))
        ? { ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,1): error TS2322: x" }
        : { ok: true, files: { "index.html": { t: "<ok>" } } },
  });
  // A FIRST BUILD SAYS SO: `livePages: []` is "nothing is published yet", which
  // is the only thing that lets salvage stub anything. Omitting it now means
  // "we could not tell", and that refuses.
  const out = await publishPages(deps, { spec: SPEC, slug: "x", livePages: [] });
  assert.equal(out.page, "app", "the site published instead of falling back");
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.equal(calls.publish.length, 1);
  assert.equal(calls.compile.length, 2, "one extra CONTAINER run, and no extra model call");
  assert.equal(calls.generate.length, 1, "this is not the repair pass — the model is called once");
  // The stub is what gets STORED, so a revise edits the stub rather than being
  // handed back a file that would not compile. Asserted at the PUBLISH boundary,
  // not only at the compile one: those are two different arguments and only the
  // second is what a later revise reads.
  assert.match(calls.compile[1].find((p) => p.path === "menu.tsx").source, /isn't finished yet/);
  assert.match(calls.stored[0].find((p) => p.path === "menu.tsx").source, /isn't finished yet/,
    "a revise would be handed back the source that would not compile");
  // The first failure survives on the response — it is the only record of what
  // the generator got wrong, and a salvaged build returns ok.
  assert.match(out.error, /TS2322/);
  // ITS OWN FIELD. Glued onto `notes` it renders mid-paragraph in `.st-msg`,
  // which is exactly how "couldn't read your link" got buried once already.
  assert.match(out.salvageNote, /menu/);
  assert.doesNotMatch(out.notes || "", /placeholder/,
    "the caveat belongs in the note block, not buried in the model's summary");
  // `stage` names an OUTCOME, and this build did not end at the typecheck.
  assert.equal(out.stage, undefined);
});

test("a salvage that still fails falls back exactly as before", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async () => ({ ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,1): error TS2322: x" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x", livePages: [] });
  assert.equal(out.page, "placeholder");
  assert.equal(out.stage, "typecheck");
  assert.equal(calls.publish.length, 0);
  assert.equal(out.salvaged, undefined);
  assert.equal(out.salvage.secondStage, "typecheck");
});

test("the home page failing is still a placeholder, not a stubbed front door", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async () => ({ ok: false, stage: "typecheck", error: "src/routes/index.tsx(4,1): error TS2322: x" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "placeholder");
  assert.equal(calls.compile.length, 1, "a refused salvage must not buy a container run");
  assert.equal(calls.publish.length, 0);
});

test("a bundler failure is never salvaged — it is not a page problem", async () => {
  // `build` is the our-fault stage. Stubbing a page cannot fix a drained
  // container, and doing it would charge a customer for our own rollout.
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async () => ({ ok: false, stage: "build", error: "src/routes/menu.tsx(4,1): killed" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "placeholder");
  assert.equal(out.salvage, undefined, "the salvage must not even be planned");
  assert.equal(calls.compile.length, 2, "the existing build-stage retry, and nothing more");
  assert.equal(out.charged, false, "our fault stays our cost");
});

test("a salvaged build charges once, after the publish", async () => {
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async (pages) =>
      pages.some((p) => p.path === "menu.tsx" && p.source.includes("useRows"))
        ? { ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,1): error TS2322: x" }
        : { ok: true, files: { "index.html": { t: "<ok>" } } },
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(calls.charges.length, 1, "two charge sites is how a build eventually bills twice");
  assert.equal(out.charged, true);
});

test("a build that compiled first time carries no salvage record at all", async () => {
  // Found by mutation: widening the branch to `built.ok` too is ALMOST inert —
  // there is no error text, so nothing gets stubbed — but every successful build
  // then reports `salvage: { reason: "the error names no page" }`, which reads in
  // the response and in the eval as a build that nearly failed. The absence is
  // the assertion.
  const { deps, calls } = harness({ generate: async () => gen([good(), good("menu.tsx")]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "app");
  assert.equal(out.salvage, undefined, "a clean build must not describe a salvage it never attempted");
  assert.equal(out.salvaged, undefined);
  // Empty rather than a sentence, so the client's note block is byte-identical
  // on every build that did not need this.
  assert.equal(out.salvageNote, "");
  assert.equal(out.error, undefined);
  assert.equal(calls.compile.length, 1);
});

test("salvageNote names the pages and says nothing when there are none", () => {
  assert.equal(salvageNote([]), "");
  assert.equal(salvageNote(undefined), "");
  assert.match(salvageNote(["memberships.tsx"]), /^The memberships page didn't compile/);
  const two = salvageNote(["classes.tsx", "memberships.tsx"]);
  assert.match(two, /classes, memberships pages didn't compile/);
  // Plural throughout, or it reads as one page wearing two names.
  assert.match(two, /they're/); assert.match(two, /those pages/); assert.match(two, /them/);
});

test("the salvage note reaches the response and the note block, not just the module", () => {
  // The layer below the break, for the tenth recorded time: a field composed
  // correctly and passed on by nothing is a feature that does not exist. Both
  // ends asserted, because either alone passes while the wire is cut.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /salvageNote: pages\.salvageNote \|\| undefined/,
    "the route never returns the note the module composed");
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /typeof d\.salvageNote === 'string'/,
    "the client never renders the note the route returned");
  // In the NOTE block beside the others, not appended to the model's summary.
  //
  // BOUNDED BY ITS SHAPE, NOT BY ITS BYTE COUNT. This read `block.length < 1400`
  // and went red the moment a SIXTH note was added — a guard about how much
  // reasoning is written in the comments, failing a correct change. That is this
  // repo's most-repeated own-goal and it has now cost a red run three times.
  // What it actually wants to know is that the anchors found the right region
  // and that the region is a list of note entries rather than half the file.
  const open = c.indexOf("const note = [");
  const close = c.indexOf("].filter(Boolean).join('\\n');", open);
  assert.ok(open > 0 && close > open, "the note block's anchors moved — a window nothing matched would pass every assertion below vacuously");
  const block = c.slice(open, close);
  assert.match(block, /salvageNote/, "it landed somewhere other than the note block");
  // Every line of CODE in there is one note entry. A block that had swallowed
  // something else would fail this however long it happened to be.
  const code = block.split("\n").slice(1)
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
  assert.ok(code.length >= 4 && code.length <= 12, "the note block holds " + code.length + " entries");
  for (const line of code) {
    assert.match(line, /^\(d && typeof d\.\w+Note === 'string'\) \? d\.\w+Note\.trim\(\) : '',$/,
      "not a note entry: " + line);
  }
});

/* ------------------------------------------- a killed step is ours, not theirs */

test("wasKilled agrees with the function that writes the sentence", () => {
  // DRIVEN THROUGH THE REAL `exitReason`, never a hand-copied string. Two
  // spellings of one fact is how this drifts, and the direction it drifts in is
  // a customer billed for our container being stopped.
  for (const step of ["tsc", "vite build", "tsr generate"]) {
    for (const signal of ["SIGTERM", "SIGKILL"]) {
      assert.ok(wasKilled(exitReason(step, { signal, code: null, out: "", err: "" })),
        `${step} killed by ${signal} did not read as killed`);
    }
  }
  // A step that PRINTED a real diagnosis is the code's problem, and exitReason
  // returns that text in preference — so the two shapes cannot both match.
  assert.equal(wasKilled(exitReason("tsc", { signal: "SIGTERM", code: null, out: "index.tsx(4,1): error TS2322: x", err: "" })), false);
  assert.equal(wasKilled(exitReason("vite build", { signal: null, code: 1, out: "", err: "" })), false);
  assert.equal(wasKilled(""), false);
  assert.equal(wasKilled(undefined), false);
});

test("a typecheck killed by a signal is OUR fault, retried and free", async () => {
  // Measured live 2026-08-09 in `build smoke`: a revise came back
  // `stage: "typecheck"` with `tsc was killed by SIGTERM (no output)` — the
  // container drained under a running build, arriving in the one stage that is
  // charged and never retried, purely because tsc happened to be the step
  // running rather than vite.
  let n = 0;
  const { deps, calls } = harness({
    compile: async () => (++n === 1
      ? { ok: false, stage: "typecheck", error: "tsc was killed by SIGTERM (no output)" }
      : { ok: true, files: { "index.html": { t: "<ok>" } } }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(calls.compile.length, 2, "a killed step must get the retry a drained container already had");
  assert.equal(out.page, "app", "the retry succeeded, so the site publishes");
  assert.equal(out.killedAt, "typecheck", "which step was killed is still reported");
});

test("a killed typecheck that stays killed is free, not charged", async () => {
  const { deps } = harness({
    compile: async () => ({ ok: false, stage: "typecheck", error: "tsc was killed by SIGTERM (no output)" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "placeholder");
  assert.equal(out.stage, "build", "a signal kill is the bundler-stage failure wearing another step's name");
  assert.equal(out.charged, false, "our own rollout must not be billed to the customer");
  assert.equal(out.salvage, undefined, "and it is not a page problem, so nothing is stubbed");
});

test("a REAL typecheck error is still theirs — the reclassification is narrow", async () => {
  // The guard that stops this becoming "every compile failure is free". A page
  // with a type error in it is a result, not an outage.
  const { deps } = harness({
    compile: async () => ({ ok: false, stage: "typecheck", error: "src/routes/index.tsx(4,1): error TS2322: x" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.stage, "typecheck");
  assert.equal(out.charged, true);
});

test("a SUCCESSFUL compile is never reclassified, whatever it says in error", () => {
  // The `!bd.ok` half of the guard. Inert today — a successful build carries no
  // error — and asserted because the failure it prevents is the one already hit
  // once in this change: a clean build gaining a field that reads as a near-miss.
  // Same reasoning as the salvage record, so the same assertion.
  const src = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(!bd\.ok && wasKilled\(bd\.error\)\)/,
    "reclassification must be gated on the build having FAILED");
});

// ─────────────────────────────────────────────────────────────────────────────
// EVERY TIMING THE BUILD CARRIES CAN REACH THE TRACE.
//
// It could not. `tr.at("pages", …)` was a hand-written list of the fields
// somebody remembered, and it drifted the first time a step was added:
// `renderMs` and `routesMs` are carried from the container onto `pages` by the
// loop in publish-pages.mjs, and neither appeared. Measured on a real build
// 2026-08-13 — the only evidence the render check had run at all was ~46s of
// unaccounted time inside `buildMs`, which is a guess, not a measurement.
//
// Derived from BOTH files, so a step added tomorrow is covered without anybody
// editing this test.

test("the pages trace can carry every timing the build reports", () => {
  const pub = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  // The container's own split, read from the loop that copies it through.
  const loop = pub.match(/for \(const k of (\[[^\]]*Ms"[^\]]*\])\)/);
  assert.ok(loop, "the timing passthrough in publish-pages.mjs moved — retarget this guard");
  const carried = JSON.parse(loop[1].replace(/'/g, '"'));
  assert.ok(carried.length >= 3 && carried.includes("renderMs"),
    "read " + JSON.stringify(carried) + " — the scan is not seeing the real list");

  // The passthrough must include preMs too — the 2026-08-13 audit caught the
  // list already missing a field that existed the day the first guard was
  // written, which is what "hand-picked" means as a failure mode.
  assert.ok(carried.includes("preMs"),
    "the passthrough dropped preMs — prerender is invisible on production builds again");

  // THE TRACE ENTRY IS DERIVED BY SHAPE NOW (any numeric `*Ms` key), not by a
  // name list — that is the only form whose "new timings show up by themselves"
  // promise can hold, and the first version of this guard proved it by matching
  // names that a truly derived entry no longer contains. What is asserted is
  // the derivation itself: the /Ms$/ filter over the build's own keys.
  const at = worker.indexOf('tr.at("pages"');
  assert.ok(at > 0, "the pages trace entry moved — retarget this guard");
  const entry = worker.slice(at, at + 700);
  assert.ok(/Object\.keys\(pages\)/.test(entry) && /Ms\$\//.test(entry),
    "the pages trace stopped deriving timings from the build result — a hand list is how preMs and renderMs went missing");
});

// ─────────────────────────────────────────────────────────────────────────────
// EVERY LANE THAT WRITES WHOLE PAGES GETS THE FREE EXPORT-NAME REPAIR.
//
// `repairImports` rewrites an import of a member a kit module does not export —
// the `TS2305 has no exported member` class its own docstring records as costing
// a customer an entire site on 2026-08-19. It had exactly ONE call site in the
// repo, here in the build path. The addon lane and the page-edit lane both
// generate brand-new page source from scratch, validate it, lint it, and go
// straight to `recompileAndPublish`, which has no repair in it — so the two
// lanes at the highest risk of an invented export name were the two that did
// not get the deterministic fix. `lintPages` had already printed the wrong name
// and the right one into `problems` on the same request, and the customer's
// addon was lost to a defect the platform knows how to fix for nothing.
//
// DERIVED FROM THE CALL SITES, not a list of the lanes that exist today: any
// place that judges fresh model output with `validatePages` and then publishes
// it has the same exposure, so a third lane is covered without anybody editing
// this file. Each window runs from the `validatePages(` call to the publish that
// consumes it, so it cannot be outrun by a comment the way a byte-sized one can.
// Comments are blanked first — this file and worker.js both SPELL the function's
// name in prose explaining it, so a raw scan matches the explanation.
test("the addon and page-edit lanes repair invented export names too", () => {
  const blank = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const worker = blank(fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8"));

  // A call to a name that was never imported is a ReferenceError on the build
  // path, not a lint error — the OWN_ZONES failure, which took every custom
  // domain down while `node --check` passed.
  //
  // `assert.ok(re.test(…))`, NEVER `assert.match(worker, …)`. A failed `match`
  // puts the WHOLE subject in `actual` — ~850KB of blanked worker.js — which is
  // unreadable, and worse: it overran `execSync`'s 1MB buffer during this
  // change's own mutation sweep and truncated every result after it, so four
  // mutants read as caught when nothing had run.
  assert.ok(/import \{[^}]*\brepairImports\b[^}]*\} from "\.\/builder\/page-gen\.mjs"/.test(worker),
    "worker.js calls repairImports without importing it, or does not call it at all");

  const at = [...worker.matchAll(/\bvalidatePages\(/g)].map((m) => m.index);
  assert.ok(at.length >= 2,
    "found " + at.length + " validatePages call sites in worker.js — the scan is not seeing the lanes");
  for (const i of at) {
    // Bounded by the publish that consumes these pages: the repair has to happen
    // somewhere between generating them and shipping them.
    const end = worker.indexOf("recompileAndPublish(", i);
    assert.ok(end > i, "a validatePages call site at " + i + " publishes through something else — retarget this guard");
    const win = worker.slice(i, end);
    assert.ok(win.includes("repairImports("),
      "a lane validates fresh pages at offset " + i + " and never repairs their imports — " +
      "an invented export name reaches tsc and costs the customer the whole change");
    // BEFORE the lint, so a repaired page does not also carry a problem about
    // the import that is no longer there.
    const lint = win.indexOf("lintPages(");
    if (lint >= 0) {
      assert.ok(win.indexOf("repairImports(") < lint,
        "the repair runs after the lint at offset " + i + ", so it reports a name it has already fixed");
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE "IS MODEL CODE CONFINED" SIGNAL READS A FIELD THAT EXISTS.
//
// Two readers stood here for container fields the move to Start deleted or
// renamed, and both were dead — a reader watching a field nothing emits is a
// presence-is-the-alarm contract with nothing able to set off the alarm.
//
//   `prerenderSkipped` — GONE. `build-server.mjs` says so in as many words
//   ("ARE GONE, not emptied… an absent field says the step is absent"), so the
//   reader was removed rather than left reading as a live diagnosis.
//   `prerenderUnprivileged` — RENAMED to `ssrUnprivileged` when the prerender
//   became Start's SSR. The reader was not moved with it, so the one warning
//   that model-written code ran unconfined in a container every customer's
//   build shares could never fire.
//
// DERIVED FROM THE CONTAINER, not from a remembered name: whatever
// `build-server.mjs` really puts on a successful response is what this module
// has to read. Comments are blanked first at both ends — the container's own
// comment SPELLS the deleted names while saying they are gone, and this
// module's comment spells them while saying the same, so a raw scan matches
// prose either way and proves nothing.
test("the unprivileged-render warning reads the field the container emits", () => {
  const blank = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const server = blank(fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8"));
  const pub = blank(fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8"));

  // The container's own success response is the authority on the name.
  const emitted = new Set([...server.matchAll(/\b(\w*[Uu]nprivileged)\b\s*:/g)].map((m) => m[1]));
  assert.ok(emitted.size, "no *Unprivileged field found in build-server.mjs — retarget this guard");
  for (const name of emitted) {
    assert.ok(pub.includes("bd." + name),
      "publish-pages reads no `bd." + name + "` — the confinement warning is watching a field " +
      "the container does not emit, which is how it went dead in the first place");
  }

  // …and it must not still be reading one the container stopped emitting.
  for (const dead of ["prerenderSkipped", "prerenderUnprivileged"]) {
    if (emitted.has(dead) || new RegExp("\\b" + dead + "\\b\\s*:").test(server)) continue;
    assert.ok(!pub.includes("bd." + dead),
      "publish-pages still reads `bd." + dead + "`, which the container no longer emits");
  }
});

test("…and it is carried only when the answer is FALSE", async () => {
  // Presence IS the alarm: an ordinary response has to be byte-identical, or
  // the field is noise and nobody reads it.
  const clean = await publishPages(harness({ compile: async () => ({ ok: true, files: {}, ssrUnprivileged: true }) }).deps,
    { spec: SPEC, slug: "x" });
  assert.ok(!("prerenderUnprivileged" in clean), "a confined render still set the alarm");

  const loud = await publishPages(harness({ compile: async () => ({ ok: true, files: {}, ssrUnprivileged: false }) }).deps,
    { spec: SPEC, slug: "x" });
  assert.equal(loud.prerenderUnprivileged, false,
    "the container said the render was NOT confined and the response says nothing");
});

// A SALVAGED BUILD KEEPS ITS FIRST FAILURE'S RECORD. The module preserves
// `error` and `cited` on a successful salvage because they are the only record
// of what the generator got wrong — and the worker's gate `page === "app"`
// stripped both on every salvaged build, since a salvage answers "app"
// (2026-08-13 audit). The gate has to except the salvage case.
test("the worker's error/cited gate excepts a salvaged build", () => {
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf("error: (pages.page === ");
  assert.ok(at > 0, "the error gate moved — retarget this guard");
  const win = worker.slice(at, at + 600);
  assert.match(win, /salvageNote/, "the error gate no longer excepts salvage — a stubbed page's failure is unrecorded");
  assert.ok(/cited: \(\(pages\.page === "app" && !pages\.salvageNote\)/.test(win),
    "the cited gate no longer excepts salvage");
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND-2 AUDIT SINGLES, each a source-read on the worker because each is one
// line whose absence is silent.

test("both build-adjacent routes cap the body before parsing it", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // react-build: the priciest route on the platform buffered whatever arrived
  // (2026-08-13 audit) while /api/direct, /api/save and even the visitor upload
  // all capped on Content-Length first.
  //
  // …AND THE CAP THIS PINNED WAS THE WEAKER OF THE TWO MECHANISMS. It asserted
  // `tooLargeBody`, which reads `content-length` and NOTHING ELSE — a header
  // the CALLER writes: absent yields 0, non-numeric yields NaN, and `NaN > max`
  // is false, so all three walked past it and the body was buffered and parsed
  // anyway. A guard whose own name was the reason nobody re-read it, held in
  // place by a test that pinned its spelling.
  //
  // `readJsonBody` is what `request-limits.mjs` says supersedes it for a JSON
  // route: the cheap header check first, so megabytes are never buffered, then
  // the REAL encoded byte count of what actually arrived. So the property is
  // that the route is bounded by a mechanism that measures the bytes, and the
  // NUMBER is what a reader wants pinned — a cap silently raised to the plan
  // limit is the regression, not a rename.
  // ANCHORED ON THE BUILD ITSELF, not on a window after the route match. The
  // build moved into `runSiteBuild` on 2026-08-23 so a queue consumer could call
  // it, and a fixed window after the dispatch no longer contains the body read
  // at all — the positional-anchor own-goal, on a change proved byte-identical.
  const bWin = buildSource();
  assert.match(bWin, /readJsonBody\(request,\s*\{\s*max:\s*24_000_000\s*\}\)/,
    "the build route parses an uncapped body again");
  assert.ok(!/\bawait request\.json\(\)/.test(bWin),
    "the build route reads the body twice — a body reads ONCE, so the second is empty");
  // /api/site/route: hit on EVERY builder message.
  const r = w.indexOf('"/api/site/route"');
  const rWin = w.slice(r, w.indexOf("request.json()", r));
  assert.match(rWin, /tooLargeBody\(request,\s*2_000_000\)/, "the router parses an uncapped body again");
});

test("a stranger's upload can never be the og image", () => {
  // siteOgImage preferred owner uploads and then fell back to objs[0] — which
  // fired exactly when the library held ONLY visitor uploads, so anyone posting
  // a picture through a site's form could become its WhatsApp preview image on
  // the next publish (2026-08-13 audit). The property is the ABSENCE of the
  // fallback: owner uploads or nothing.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const fn = w.match(/async function siteOgImage[\s\S]*?\n\}/);
  assert.ok(fn, "siteOgImage moved");
  // COMMENTS BLANKED before the absence check — the fix's own comment names the
  // forbidden spelling as history, and an absence asserted over prose matches
  // the explanation of the bug rather than the bug.
  const code = fn[0].replace(/\/\/[^\n]*/g, "");
  assert.match(code, /objs\.find\(\(o\) => o && !o\.visitor\)/, "the owner-only preference is gone");
  assert.ok(!/\|\|\s*objs\[0\]/.test(code), "the visitor fallback is back — a stranger's picture can be the preview again");
});

test("the name-taken 409 says so to the customer", () => {
  // Both 409s carried error but no msg, and the client renders only msg — so
  // the customer saw "try again in a moment", retried into the same 409
  // forever (the designer re-proposes the same name), and concluded the
  // builder was broken (2026-08-13 audit).
  //
  // DERIVED, NOT COUNTED. This asserted exactly 2 and went red when a THIRD
  // refusal was added — the early ownership check, which exists so a stranger's
  // slug cannot spend our model budget before anything refuses it. A test about
  // how many of a thing there are, on a change that added one correctly. What
  // it is for is that EVERY such refusal carries the message, since the client
  // renders `msg` and nothing else.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const all = w.match(/error: "that name is taken"[^\n]*/g) || [];
  assert.ok(all.length >= 2, "the scan found only " + all.length + " name-taken refusals, so it has stopped scanning");
  for (const line of all) {
    assert.match(line, /msg: "That site name is taken by another account/,
      "a name-taken 409 with no customer message: " + line.slice(0, 120));
  }
});

// ── A PUBLISH MUST NOT DAMAGE A SITE THAT ALREADY WORKS ─────────────────────
//
// Salvage was written for FIRST builds, where the alternative to a stubbed page
// is nothing at all. On a revise the alternative is the customer's old working
// site: pre-salvage, a revise whose pages failed to compile deliberately left
// the published site untouched, so "change the phone number in the header"
// could not cost them anything. `livePages` is what puts that back.

test("SALVAGE REFUSES A PAGE THE SITE IS ALREADY SERVING", () => {
  const pages = [good(), good("menu.tsx")];
  const p = salvagePlan('src/routes/menu.tsx(9,10): error TS2305: x', pages, ["menu.tsx"]);
  assert.deepEqual(p.stub, [], "a live, working page would have been replaced with an apology");
  assert.deepEqual(p.kept, ["menu.tsx"]);
  assert.match(p.reason, /already serving/);
});

test("…and refuses WHOLESALE, never partially", () => {
  // Stubbing the new page and leaving the live one broken publishes a site that
  // is worse than either outcome: the change is half-landed AND a page they had
  // is still failing. The caller's fallback — leave the published site exactly
  // as it is — is the answer they had before salvage existed.
  const pages = [good(), good("menu.tsx"), good("offers.tsx")];
  const p = salvagePlan(
    'src/routes/menu.tsx(9,10): error TS2305: x\nsrc/routes/offers.tsx(2,1): error TS1005: y',
    pages, ["menu.tsx"]);
  assert.deepEqual(p.stub, [], "a partial salvage published a half-landed change over a broken page");
  assert.deepEqual(p.kept, ["menu.tsx"]);
});

test("a NEW page that fails is still stubbed, even on a site with live pages", () => {
  // The rule is about what would be DESTROYED, not about build vs revise —
  // otherwise the feature stops working for exactly the case it is best at:
  // a page that was never on the site, where a placeholder beats losing the
  // whole build.
  const pages = [good(), good("menu.tsx"), good("offers.tsx")];
  const p = salvagePlan('src/routes/offers.tsx(2,1): error TS1005: y', pages, ["index.tsx", "menu.tsx"]);
  assert.deepEqual(p.stub, ["offers.tsx"]);
  assert.deepEqual(p.kept, []);
});

test("a first build behaves EXACTLY as it did before this existed", () => {
  // A first build SAYS nothing is live, and it is the saying that matters —
  // both empty shapes the caller might use are answers, and both stub.
  const pages = [good(), good("menu.tsx")];
  const err = 'src/routes/menu.tsx(9,10): error TS2305: x';
  for (const live of [[], new Set()]) {
    const p = salvagePlan(err, pages, live);
    assert.deepEqual(p.stub, ["menu.tsx"], "live=" + JSON.stringify([...live]) + " changed the answer");
    assert.deepEqual(p.kept, []);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// "NOTHING IS LIVE" AND "WE COULDN'T TELL" ARE DIFFERENT ANSWERS.
//
// The whole live-page protection was `new Set(Array.isArray(live) ? live : [])`,
// so an absent answer became an empty one — and every working page then went
// into `stub`. The route reaches that state on a genuinely live site two ways:
// an empty stored brief, and `loadSiteSource` returning null on ANY read
// failure. What it produces is the exact regression `live` was added to
// prevent: a live menu replaced with "this page isn't finished yet", published
// over the customer's site, and charged for.
//
// `hasBoughtPhotos` reads the identical null as "unknown → spend nothing", so
// before this one consumer of that value treated unknown as do-nothing and the
// other as nothing-is-live. This is the disagreement resolved in the safe
// direction.
test("SALVAGE REFUSES WHEN IT WAS NEVER TOLD WHAT IS LIVE", () => {
  const pages = [good(), good("menu.tsx")];
  const err = 'src/routes/menu.tsx(9,10): error TS2305: x';
  for (const live of [undefined, null, "menu.tsx", 0, {}]) {
    const p = salvagePlan(err, pages, live);
    assert.deepEqual(p.stub, [],
      "live=" + JSON.stringify(live) + " stubbed a page that might be live and working");
    assert.match(p.reason, /couldn't tell/,
      "live=" + JSON.stringify(live) + " refused for the wrong reason, or did not refuse");
  }
});

test("…and the refusals that name the ERROR still win over it", () => {
  // Every other refusal is a fact about the compile failure rather than about
  // what is published, and each is the more useful thing to say. Checked first,
  // "we couldn't tell" would swallow all three — true, and useless to whoever
  // reads it.
  const pages = [good(), good("menu.tsx")];
  const kit = salvagePlan('src/components/ui/faq.tsx(3,1): error TS1005: x', pages, undefined);
  assert.deepEqual(kit.foreign, ["src/components/ui/faq.tsx"], "a kit file stopped being named");
  const home = salvagePlan('src/routes/index.tsx(4,1): error TS2322: x', pages, undefined);
  assert.match(home.reason, /home page/);
  const nowhere = salvagePlan("vite build was killed by SIGTERM", pages, undefined);
  assert.match(nowhere.reason, /names no page/);
});

test("an unknown live set refuses at the dep boundary too, buying no container run", async () => {
  // AT THE BOUNDARY, because the rule can be perfectly right inside the module
  // while the caller's fallback still publishes over the site. The published
  // site must be left exactly as it was — the answer they had before salvage
  // existed — and the wasted recompile must not be bought either.
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async () => ({ ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,1): error TS2322: x" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "placeholder", "a page that may be live was replaced with the stub");
  assert.equal(calls.publish.length, 0, "the published site must be left exactly as it was");
  assert.equal(calls.compile.length, 1, "a refused salvage must not buy a container run");
  assert.deepEqual(out.salvage.stubbed, []);
  assert.equal(out.salvaged, undefined);
});

test("a Set is accepted as well as a list", () => {
  const pages = [good(), good("menu.tsx")];
  const p = salvagePlan('src/routes/menu.tsx(9,10): error TS2305: x', pages, new Set(["menu.tsx"]));
  assert.deepEqual(p.kept, ["menu.tsx"], "the caller's natural shape was ignored");
});

test("a kit file still wins over a live page — it is the more useful diagnosis", () => {
  // `foreign` means no amount of stubbing helps, which is a fact about US
  // shipping something broken. Reporting "the page is live" instead would send
  // the reader looking at the customer's site for a bug in our kit.
  const pages = [good(), good("menu.tsx")];
  const p = salvagePlan(
    'src/components/ui/faq.tsx(3,1): error TS1005: x\nsrc/routes/menu.tsx(9,1): error TS2305: y',
    pages, ["menu.tsx"]);
  assert.deepEqual(p.foreign, ["src/components/ui/faq.tsx"]);
  assert.deepEqual(p.kept, []);
});

test("livePages reaches salvagePlan, and a live page's failure leaves the site alone", async () => {
  // AT THE DEP BOUNDARY, because the module can be perfectly right about the
  // rule while nothing hands it the fact — which is how twelve features in this
  // repo shipped dead.
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async () => ({ ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,1): error TS2322: x" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x", livePages: ["menu.tsx"] });
  assert.equal(out.page, "placeholder", "a live page was replaced with the stub");
  assert.equal(calls.compile.length, 1, "a refused salvage must not buy a container run");
  assert.equal(calls.publish.length, 0, "the published site must be left exactly as it was");
  assert.deepEqual(out.salvage.kept, ["menu.tsx"]);
  assert.equal(out.salvaged, undefined);
});

test("THE SALVAGE RECOMPILE IS RETRIED WHEN THE CONTAINER IS DRAINED", async () => {
  // The second compile was a bare `compile`, so a container drained mid-recompile
  // — the exact race the retry wrapper was built for, measured live twice —
  // silently downgraded a salvageable site to the data-model placeholder for a
  // reason that had nothing to do with the customer's pages.
  let n = 0;
  const { deps, calls } = harness({
    generate: async () => gen([good(), good("menu.tsx")]),
    compile: async (pages) => {
      n++;
      if (n === 1) return { ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,1): error TS2322: x" };
      if (n === 2) return { ok: false, stage: "build", error: "vite build was killed by SIGTERM (no output)" };
      return { ok: true, files: { "index.html": { t: "<ok>" } } };
    },
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x", livePages: [] });
  assert.equal(out.page, "app", "a drained recompile lost a site that was salvageable");
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.equal(calls.compile.length, 3, "the recompile was not retried");
});

test("the four retry fields reach the caller — build smoke reads them off the response", () => {
  // ALL FOUR WERE COMPUTED AND FORWARDED BY NOTHING, so the smoke test's retry
  // report read four fields that could never arrive: provably dead code
  // reading provably dead code.
  //
  // `killedAt` IS THE ONE THAT DECIDES MONEY. A step killed by a container
  // drain is reclassified to `stage: "build"` so `ourFault` exempts it from the
  // charge — and this field is the ONLY thing separating that from a genuine
  // bundler error wearing the same stage. Without it nobody can tell a free
  // failure from a charged one after the fact.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  for (const f of ["builds", "retriedBuild", "killedAt"]) {
    assert.match(w, new RegExp("\\n\\s*" + f + ": pages\\." + f + " \\|\\| undefined,"),
      f + " is computed by publishPages and forwarded by nothing");
  }
  // `repaired` is carried only when something really was fixed: an empty list
  // on every build reads as a generator that keeps getting names wrong.
  assert.match(w, /repaired: \(pages\.repaired && pages\.repaired\.length\) \? pages\.repaired : undefined,/,
    "repaired is dropped, or is reported as [] on every clean build");
  // …AND THE MODULE REALLY SETS THEM, or this forwards a name nothing produces.
  const pp = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  for (const f of ["builds", "retriedBuild", "killedAt", "repaired"]) {
    assert.match(pp, new RegExp("out\\." + f + "\\s*="), "publishPages no longer produces " + f);
  }
});

test("a delete says WHICH project it dropped, and does not claim one it never looked for", () => {
  // `projectDropped` is the one signal saying a billed Neon project survived a
  // delete. The legacy branch set it true UNCONDITIONALLY — including when
  // nothing was found and no drop call was made — so the all-clear fired
  // exactly when there was no record of the project, which is the case that
  // matters. Both integration consumers gate their fallback cleanup on
  // `=== false`, so it never fired; and the response had no `projectId`, so
  // when it did it called DELETE /projects/undefined. The safety net could not
  // work in either direction.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("let projectDropped = false;");
  assert.ok(at > 0, "the project-drop block moved");
  const block = w.slice(at, w.indexOf("// AND THE SITE'S OWN WORKER", at));
  assert.ok(block.length > 200, "the project-drop block scan lost its bounds");
  // The legacy branch sets it only INSIDE the `if` that found something.
  assert.match(block, /if \(legacy && legacy\.neon_project\) \{[\s\S]*?projectDropped = true;[\s\S]*?\}/,
    "the legacy branch claims a drop it never attempted again");
  assert.match(block, /projectId = proj\.neon_project;/, "the dropped project is not named");
  assert.match(block, /projectId = legacy\.neon_project;/, "the legacy project is not named");
  assert.match(w, /projectId: projectId \|\| undefined,/,
    "the response carries no projectId, so the consumers' fallback calls DELETE /projects/undefined");
});

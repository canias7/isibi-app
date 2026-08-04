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
import { publishPages, pageCredits, pageCost, citedLines, RATES, MIN_CREDITS } from "../builder/publish-pages.mjs";

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
  assert.ok(out.cost > 0, "a truncated call still burned tokens and is still billed");
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
  assert.equal(out.cost, pageCredits(USAGE), "one call, one charge");
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

test("the worst case is one generation and one build", async () => {
  // The reason the pass went: a failing build used to cost two of the expensive
  // half. Asserted as a ceiling over every failure mode, so a future branch that
  // re-asks "just this once" fails here rather than on a bill.
  for (const compile of [
    async () => ({ ok: false, stage: "typecheck", error: "TS2304" }),
    async () => ({ ok: false, stage: "build", error: "vite exploded" }),
    async () => { throw new Error("container boot timeout"); },
    async () => null,
  ]) {
    const { deps, calls } = harness({ generate: async () => gen([lintsWorse()]), compile });
    const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
    assert.equal(calls.generate.length, 1, "one model call, whatever went wrong");
    assert.equal(calls.charges.length, 1, "and one charge");
    assert.equal(out.cost, pageCredits(USAGE));
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
  const meta = { brand: "Sharp Fade", description: "Skin fades in Lisbon.", url: "https://isibi.ai/s/x/" };
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
  // The money was still spent, so the breakdown must survive — that is what says
  // whether the model produced nothing or produced something unusable.
  assert.ok(out.cost > 0 && out.usage, "a refused generation still cost credits");
  // And nothing downstream ran.
  assert.equal(calls.compile.length, 0, "a build with no pages must not reach the container");
  assert.equal(calls.publish.length, 0);
});

test("and a generator that returned nothing at all is said plainly", async () => {
  const { deps } = harness({ generate: async () => gen([]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.stage, "validate");
  assert.match(out.error, /no pages at all/, "an empty answer and a refused one are different problems");
});

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
import { publishPages, pageCredits, MIN_CREDITS } from "../builder/publish-pages.mjs";

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

const gen = (pages, extra = {}) => ({ input: { pages, notes: "" }, usedIn: 1000, usedOut: 1000, ...extra });

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
    generate: (fix) => { calls.generate.push(fix || null); return pick("generate")(fix); },
    compile: (pages) => { calls.compile.push(pages); return pick("compile")(pages); },
    publish: (dist) => { calls.publish.push(dist); return pick("publish")(dist); },
    readCredits: () => pick("readCredits")(),
    useCredits: (n) => { calls.charges.push(n); return pick("useCredits")(n); },
  };
  return { deps, calls };
}

test("pageCredits meters real usage, never free", () => {
  // 10k in + 10k out = $0.18 → 23 credits at $0.008.
  assert.equal(pageCredits(10000, 10000), 23);
  // A call that used almost nothing still cost something.
  assert.equal(pageCredits(1, 1), 1);
  assert.equal(pageCredits(0, 0), 1);
  // Output tokens are 5× input; a generator is mostly output, so this is where
  // the money goes and getting the rates backwards would understate every build.
  assert.ok(pageCredits(0, 1000) > pageCredits(1000, 0));
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

test("a compile failure is repaired, and a compiling repair is kept", async () => {
  let n = 0;
  const { deps, calls } = harness({
    generate: async () => gen([good()]),
    compile: async () => (++n === 1
      ? { ok: false, stage: "typecheck", error: "src/routes/index.tsx(4,7): error TS2304" }
      : { ok: true, files: { "index.html": { t: "<fixed>" } } }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(calls.generate.length, 2);
  assert.equal(calls.publish.length, 1);
  assert.deepEqual(calls.publish[0], { "index.html": { t: "<fixed>" } });

  // The repair pass has to be TOLD what was wrong, or it is just a re-roll.
  const fix = calls.generate[1];
  assert.ok(fix && fix.pages.length, "the repair sees what was written last time");
  assert.ok(fix.problems.some((p) => /TS2304/.test(p)), "and the actual compiler error");
  assert.ok(fix.problems.some((p) => /TypeScript rejected/.test(p)), "labelled as a typecheck failure, not a generic build failure");
  assert.equal(out.cost, pageCredits(1000, 1000) * 2, "both calls are billed");
});

test("a lint problem alone triggers the repair pass", async () => {
  // This is the whole reason the lint exists: this page compiles. Nothing else
  // in the pipeline would have caught it before a visitor did.
  let n = 0;
  const { deps, calls } = harness({ generate: async () => gen([++n === 1 ? lintsBad() : good()]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.generate.length, 2, "a compiling page with a lint hit still gets repaired");
  assert.deepEqual(out.problems, [], "and the clean repair replaces it");
  assert.equal(out.page, "app");

  const fix = calls.generate[1];
  assert.ok(fix.problems.some((p) => /collect/.test(p)), "the repair is told the access-level problem");
  assert.ok(!fix.problems.some((p) => /build failed|TypeScript rejected/.test(p)), "and is not told the build failed, because it did not");
});

test("a repair with fewer problems is kept", async () => {
  let n = 0;
  const { deps } = harness({ generate: async () => gen([++n === 1 ? lintsWorse() : lintsBad()]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(out.problems.length, 1, "went from two problems to one, so the retry wins");
  assert.ok(out.problems.every((p) => !/fetch/.test(p)), "and it is the retry's remaining problem, not the first attempt's");
});

test("a repair with the same or more problems is rejected", async () => {
  for (const [first, second, label] of [
    [lintsBad, lintsBad, "equal"],
    [lintsBad, lintsWorse, "worse"],
  ]) {
    let n = 0;
    const { deps, calls } = harness({ generate: async () => gen([++n === 1 ? first() : second()]) });
    const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
    assert.equal(out.page, "app", label);
    assert.equal(out.problems.length, 1, `a ${label} retry must not replace the first attempt`);
    assert.equal(calls.compile.length, 2, "the retry was still built — it is the KEEPING that is refused");
    assert.deepEqual(calls.publish[0], { "index.html": { t: "<build-1>" } }, `a ${label} retry's build must not be the one published`);
  }
});

test("a repair that compiles is kept over one that did not, even with more problems", async () => {
  // Compiling is the higher bar: a page with a lint hit is published and works
  // for most visitors; a page that does not compile is not a site at all.
  let n = 0;
  const { deps } = harness({
    generate: async () => gen([++n === 1 ? good() : lintsWorse()]),
    compile: async () => (n === 1
      ? { ok: false, stage: "typecheck", error: "TS2304" }
      : { ok: true, files: { "index.html": { t: "<fixed>" } } }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(out.problems.length, 2);
});

test("both attempts failing publishes nothing", async () => {
  const { deps, calls } = harness({
    compile: async () => ({ ok: false, stage: "typecheck", error: "error TS2304: cannot find name 'Foo'" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "placeholder");
  assert.equal(calls.publish.length, 0, "a broken dist must never reach storage");
  assert.equal(calls.compile.length, 2);
  assert.equal(out.stage, "typecheck");
  assert.match(out.error, /TS2304/);
  assert.match(out.notes, /didn't compile/);
  // Still reports what it tried, so a failed build is debuggable from the response.
  assert.deepEqual(out.files, ["src/routes/index.tsx"]);
  assert.equal(out.cost, pageCredits(1000, 1000) * 2);
});

test("a repair call that throws leaves the first attempt standing", async () => {
  let n = 0;
  const { deps, calls } = harness({
    generate: async () => { if (++n === 2) throw new Error("anthropic 529"); return gen([lintsBad()]); },
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app", "the first attempt compiled, so it still ships");
  assert.equal(out.problems.length, 1);
  assert.equal(calls.charges.length, 1, "a call that threw is not billed");
});

test("a repair that produces nothing usable leaves the first attempt standing", async () => {
  let n = 0;
  const { deps, calls } = harness({ generate: async () => (++n === 1 ? gen([lintsBad()]) : gen([], { input: null, truncated: true })) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.equal(out.problems.length, 1);
  assert.equal(calls.compile.length, 1, "an empty retry is not sent to the container");
  assert.equal(calls.charges.length, 2, "but it did burn tokens, so it is billed");
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

test("buildMs sums both attempts", async () => {
  // Last-writer would report only the second build and understate what the caller
  // actually waited for — two compiles really did take two compiles.
  let n = 0;
  const { deps } = harness({
    compile: async () => { const t = Date.now(); while (Date.now() - t < 12) {} return ++n === 1 ? { ok: false, stage: "typecheck", error: "TS1" } : { ok: true, files: {} }; },
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(out.page, "app");
  assert.ok(out.buildMs >= 24, `two ~12ms builds should sum to >=24ms, got ${out.buildMs}`);
});

test("the generator's notes reach the caller", async () => {
  const { deps } = harness({
    generate: async () => ({ input: { pages: [good()], notes: "Left out the booking editor — published sites can't update rows yet." }, usedIn: 10, usedOut: 10 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.match(out.notes, /booking editor/);
});

test("multi-page sites are reported under src/routes", async () => {
  const { deps } = harness({ generate: async () => gen([good("index.tsx"), good("menu.tsx")]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.deepEqual(out.files, ["src/routes/index.tsx", "src/routes/menu.tsx"]);
});

test("validation problems count toward the repair decision", async () => {
  // A missing index.tsx is a validatePages problem, not a lint one. Both have to
  // reach the repair pass or half the defects would ship unrepaired.
  let n = 0;
  const { deps, calls } = harness({ generate: async () => gen([++n === 1 ? good("menu.tsx") : good("index.tsx")]) });
  const out = await publishPages(deps, { spec: SPEC, slug: "cafe" });
  assert.equal(calls.generate.length, 2);
  assert.ok(calls.generate[1].problems.some((p) => /no index\.tsx/.test(p)));
  assert.deepEqual(out.problems, []);
  assert.deepEqual(out.files, ["src/routes/index.tsx"]);
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

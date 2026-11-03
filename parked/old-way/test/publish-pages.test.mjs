// PARKED (2026-11-03, park-old-way): the old-way half of test/publish-pages.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { tweakInput, asEdits } from "../../../test/fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import { buildSource } from "../../../test/fixtures/build-source.mjs";
import { buildPathFn } from "../../../test/fixtures/build-path.mjs";
import fs from "node:fs";
import { publishPages, pageCredits, pageCost, citedLines, totalCost, RATES, MODEL_RATES,
  DEFAULT_RATE_MODEL, ratesFor, SEARCH_USD, MIN_CREDITS,
  ourFault, CHARGED_STAGES, schemaSettlement, salvagePlan, stubPage, routeIdFor, salvageNote, wasKilled,
  buildFloor, SCHEMA_PROFILE, SEED_PROFILE } from "../../../builder/publish-pages.mjs";
import { exitReason } from "../../../builder/exit-reason.mjs";
import { readPage } from "../../../builder/site-render.mjs";
import { BUILD_MODELS } from "../../../builder/build-models.mjs";
// The real consumer of `out.images`, so the note a customer reads is what these
// tests assert rather than the field names it happens to branch on today.
import { imageNote } from "../../../builder/site-images.mjs";
import { SEED_MODEL, SEED_MAX_TOKENS } from "../../../builder/site-seed.mjs";

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
  const calls = { generate: [], compile: [], compiledParts: [], publish: [], stored: [], charges: [] };
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
    // BOTH ARGUMENTS, the same lesson as `publish` below and found the same way:
    // written `(pages) => …(pages)` this wrapper manufactured a call with no
    // parts, so what the container is handed as the site's hand-written
    // components could not be asserted at all — and a sweep mutant that repaired
    // the parts and never forwarded them survived every case in this file.
    // `calls.compile` still holds the PAGES, which is what every older assertion
    // reads; the parts get their own list rather than changing that shape.
    compile: (...a) => { calls.compile.push(a[0]); calls.compiledParts.push(a[1]); return pick("compile")(...a); },
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
  // OPTIONAL, exactly like `images` and for the same reason: with no `repair`
  // dep the function must behave as it did before the repair pass existed, which
  // is what every other test in this file relies on.
  if (over.repair) {
    calls.repair = [];
    deps.repair = (req) => { calls.repair.push(req); return over.repair(req); };
  }
  // OPTIONAL, like the two above — but ALWAYS RECORDED when supplied, including
  // on the paths that return before a page is ever compiled. That is the whole
  // property being bought: the exits that lose the answer are exactly the ones
  // that never reach a compile.
  if (over.keep) {
    calls.keep = [];
    deps.keep = (a) => { calls.keep.push(a); return over.keep(a); };
  }
  return { deps, calls };
}

/* ------------------------------------------------------- the repair pass */

// The render report the container hands back when a route crashed into the
// kit's own error card. Shaped by `readPage`, not hand-written, so a change to
// the finding shape breaks this rather than silently passing.
const crashed = (route = "/book") => ({
  ok: true,
  findings: readPage({
    route, viewport: "desktop", text: 109, images: 0, crashed: true,
    consoleErrors: ["Error: useFormField should be used within <FormItem>"],
  }),
});
const FIXED = "// repaired\n" + good().source;
const repairReply = (req, source) => ({ content: [{ type: "tool_use", input: tweakInput({ source }, req) }], usage: { input_tokens: 10, output_tokens: 20 } });

/** `shapeOf_` cut out of page-gen.mjs and evaluated — it is module-private, and
 *  exporting a thing only a test wants is how a module grows a surface. */
function generateShapeOf(src) {
  const at = src.indexOf("function shapeOf_(");
  assert.ok(at > 0, "shapeOf_ is gone from page-gen.mjs");
  const end = src.indexOf("\n}", at) + 2;
  // eslint-disable-next-line no-new-func
  return new Function(src.slice(at, end) + "\nreturn shapeOf_;")();
}

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
  const worker = blank(fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8"));

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

  // RE-ANCHORED 2026-09-17: THE SUBJECT IS A LANE VALIDATING WHAT A MODEL JUST
  // WROTE, and a third call site now validates pages this route has ALREADY
  // repaired — the addon re-asks validate over what survives when a page is
  // withheld with a dead QR code, so a link into a withheld route is rewritten
  // instead of published dangling.
  //
  // TOLD APART BY WHAT THEY ARE HANDED, which is the real distinction rather
  // than a spelling: a fresh lane is given a generation result, the repair pass
  // is given a `{ pages: … }` literal it built itself. And the exemption is
  // CENSUSED both ways — exactly one such call, and a `repairImports(` must
  // occur BEFORE it, so "already repaired" is asserted rather than claimed.
  const all = [...worker.matchAll(/\bvalidatePages\(/g)].map((m) => m.index);
  const overOwn = all.filter((i) => /^validatePages\(\s*\{\s*pages:/.test(worker.slice(i, i + 40)));
  assert.equal(overOwn.length, 1,
    "expected exactly one re-validation of pages this route already repaired, found " + overOwn.length);
  assert.ok(worker.lastIndexOf("repairImports(", overOwn[0]) > 0,
    "the re-validation at offset " + overOwn[0] + " is not preceded by a repair, so its pages are not already repaired");
  const at = all.filter((i) => !overOwn.includes(i));
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

/* ------------------------------------ the answer a failed build leaves behind */

// RUN 90 IS THE WHOLE REASON THIS SECTION EXISTS (`coalhole-1`, 2026-08-30).
// The bundler refused with
//
//     Error transforming route file /app/src/routes/index.tsx:
//     SyntaxError: Identifier 'createFileRoute' has already been declared. (3:9)
//
// and the page was gone: the container had been recycled and the only other copy
// was in a Worker's memory. Four rounds of "why was it repeated" and the honest
// answer every time was that the file was in the bin. `keep` is the hop that
// ends that, and everything below asserts the property that makes it worth
// having — the answer survives the exits that used to lose it.

// The run-90 page, DERIVED rather than typed. `good()` already opens with the
// import, so prepending the same line makes a genuine duplicate that cannot
// drift away from the fixture it is built on — and it still satisfies
// `validatePages`, which is what put it in front of the bundler in the first
// place.
const duped = () => ({ path: "index.tsx", source: 'import { createFileRoute } from "@tanstack/react-router";\n' + good().source });

/* ------------------------------------------- the steps it now talks about */

// THE STEPS THAT USED TO RUN IN SILENCE (2026-10-19, owner: "it needs to talk
// more … like literally everything"): the browser check's result, the fix and
// its outcome, each handed to the caller's progress as numbers.
const noted = (deps) => { const said = []; deps.note = (s, x) => said.push([s, x || null]); return said; };

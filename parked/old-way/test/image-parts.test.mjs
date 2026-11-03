// PARKED (2026-11-03, park-old-way): the old-way half of test/image-parts.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A PHOTOGRAPH TOKEN IN A BAND IS A PHOTOGRAPH TOKEN.
//
// Owner, 2026-09-12, on a screenshot of `hebden-bike-repair.gofarther.app` with
// a sentence of alt text laid across its hero: *"LOOK AT THIS AND TELL ME WHAT
// HAPPENED HERE"*.
//
// WHAT WAS BROKEN. The model does not write a photograph; it writes a
// DESCRIPTION into the `src` as `@@IMG:…@@`, and a later step swaps every token
// for a URL it bought or for the empty string `SafeImage` draws as its
// placeholder. Five steps do that work — `planImages` (which to buy),
// `buySitePhotos` (buying), `countImageSlots` (the customer's sentence),
// `applyImages` (the sweep) and `lintPages` (the report) — and every one of
// them read `pages`. A band-split build writes its page SECTIONS as parts, so a
// photograph planned into a band was never planned, never bought, never
// counted and, worst of all, never SWEPT: the token shipped into the bundle as
// a literal `src="@@IMG:the stone shopfront of a small bike workshop…@@"`, which
// no browser can fetch, so the published page drew the alt text.
//
// MEASURED on the live site before the fix: 11 `SafeImage`s, 9 drawing their
// placeholder correctly and 2 raw `<img data-slot="photo">` carrying the token.
// The build's own render check SAW it — "/ has an image that did not load" —
// and published anyway, which is the ship-it rule working as designed; the
// finding simply had no reader.
//
// WHY THIS FILE DRIVES. Every hop here already existed and was already correct
// for pages: the recorded "a dropped field has a twin one hop over". Reading
// the source proves a call site mentions `parts`; only running the chain proves
// the swept parts are what reaches the container and what gets stored. This
// repo has shipped the first without the second more than a dozen times.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publishPages } from "../../../builder/publish-pages.mjs";
import { imageSources, partPath, applyImages, planImages, countImageSlots } from "../../../builder/site-images.mjs";

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const PUB = fs.readFileSync(new URL("../../../builder/publish-pages.mjs", import.meta.url), "utf8");

const SPEC = { tables: [] };
const TOKEN = "@@IMG:the stone shopfront of a small bike workshop@@";
const PAGE_TOKEN = "@@IMG:a mechanic truing a wheel@@";

const page = (src = PAGE_TOKEN) => ({
  path: "src/routes/index.tsx",
  source: 'import { createFileRoute } from "@tanstack/react-router";\n' +
    'import { SafeImage } from "@/components/ui/safe-image";\n' +
    'import Hero from "@/routes/-parts/hero";\n' +
    'export const Route = createFileRoute("/")({ component: Page });\n' +
    'function Page() { return <div><Hero /><SafeImage src="' + src + '" alt="a wheel" /></div>; }',
});
const band = (src = TOKEN) => ({
  name: "hero",
  source: 'import { SafeImage } from "@/components/ui/safe-image";\n' +
    'export default () => <SafeImage src="' + src + '" alt="the shopfront" />;',
});

const USAGE = { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 };

/**
 * The publish spine with recorders on the two deps this change moves: what the
 * images hook is HANDED, and what the container is handed afterwards.
 */
function harness(images) {
  const calls = { images: [], compiledPages: [], compiledParts: [], stored: [] };
  const deps = {
    generate: async () => ({ input: { pages: [page()], parts: [band()], notes: "" }, usage: { ...USAGE } }),
    compile: async (pages, parts) => {
      calls.compiledPages.push(pages); calls.compiledParts.push(parts);
      return { ok: true, files: { "index.html": { t: "<build>" } } };
    },
    publish: async (dist, src) => { calls.stored.push(src); },
    readCredits: async () => 500,
    useCredits: async (n) => n,
  };
  if (images) deps.images = (pages, opts) => { calls.images.push({ pages, opts }); return images(pages, opts); };
  return { deps, calls };
}

/* -------------------------------------------------------- the census */

/**
 * EVERY IMAGE STEP IN THE PRODUCT ASKS ABOUT PARTS.
 *
 * The defect was five call sites each reading `pages`, so the guard is not a
 * list of today's five: it DERIVES every call and requires each to name parts.
 * A sixth step added next month fails by existing, which is the only version of
 * this check worth having — the recorded "two lists of the same thing" says a
 * hand-typed list of call sites is a second copy of the call sites.
 */
test("the census: every image-pipeline call in worker.js reads the parts too", () => {
  // Comments blanked first, LINE COMMENTS BEFORE BLOCK OPENERS — this file's
  // own prose names every one of these functions while explaining them, and
  // `worker.js` is measured at 46% comments, so a raw scan reads the paragraphs
  // above each call as call sites. (The recorded blanker-order trap: a `/*`
  // inside a line comment otherwise opens a false block tens of thousands of
  // characters long.)
  const src = WORKER.split("\n").map((l) => {
    const i = l.indexOf("//");
    return i >= 0 ? l.slice(0, i) + " ".repeat(l.length - i) : l;
  }).join("\n").replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

  // THE LANDMARKS SURVIVED THE BLANKING, or every assertion below is vacuous.
  assert.match(src, /const plan = planImages\(/, "planImages' call was blanked away — the scan is reading the wrong text");
  assert.match(src, /import \{[^}]*imageSources[^}]*\}/, "imageSources is no longer imported — this whole census is over nothing");

  const FNS = ["planImages", "applyImages", "countImageSlots"];
  const sites = [];
  for (const fn of FNS) {
    for (const m of src.matchAll(new RegExp("\\b" + fn + "\\(", "g"))) {
      // The argument list, depth-aware: a flat `[^)]*` stops at the first `)`,
      // which here is usually inside a nested call.
      let d = 1, i = m.index + m[0].length;
      for (; i < src.length && d > 0; i++) { if (src[i] === "(") d++; else if (src[i] === ")") d--; }
      sites.push({ fn, args: src.slice(m.index + m[0].length, i - 1) });
    }
  }
  // THE OBSERVER IS ALIVE. A scan that found nothing passes every check below.
  assert.ok(sites.length >= 5, "the image-call scan found " + sites.length + " call sites, which is fewer than the product has");

  // ⚠ THE NEEDLE IS CASE-INSENSITIVE, RE-ANCHORED 2026-09-17. It was
  // `/\bparts\b/`, which cannot match `aParts` — the addon route's own merged
  // component list — so a sweep of the parts written in that variable read as a
  // sweep of PAGES and the pairing check below reported the product unpaired
  // over correct code. The property is that the ARGUMENT is a parts list; its
  // spelling is the caller's, and every page-side argument here (`pages`,
  // `aValid.pages`, `aMerge.pages`, `pValid.pages`) contains no `parts` in any
  // case, so the wider needle cannot read a page sweep as a part sweep.
  const namesParts = (args) => /parts/i.test(args);
  for (const s of sites) {
    // Each call either names parts itself, or is the deliberate ONE-LIST form:
    // `applyImages` writes each file back into the list it came from, so it is
    // called once per list — never over a union sliced apart by length.
    const parts = namesParts(s.args);
    const perList = s.fn === "applyImages";
    assert.ok(parts || perList,
      s.fn + " is called without the parts, so a photograph written into a band is invisible to it: " + s.fn + "(" + s.args + ")");
  }

  // AND THE `applyImages` CALLS COME IN PAIRS, which is what the per-list form
  // costs: one sweep of the pages needs a sweep of the parts beside it. Counted
  // rather than positioned, because `if (false) applyImages(parts, …)` leaves
  // the call exactly where a position check looks for it.
  const applied = sites.filter((s) => s.fn === "applyImages");
  const onParts = applied.filter((s) => namesParts(s.args)).length;
  assert.equal(applied.length - onParts, onParts,
    "the sweeps do not pair up: " + applied.length + " applyImages calls, " + onParts + " of them over parts — " +
    "a list swept on one side and not the other ships the token it was written to remove");
});

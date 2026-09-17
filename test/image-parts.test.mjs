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
import { publishPages } from "../builder/publish-pages.mjs";
import { imageSources, partPath, applyImages, planImages, countImageSlots } from "../builder/site-images.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const PUB = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");

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

/* ------------------------------------------------- the one reader, driven */

test("imageSources names every generated file a photograph can be written into", () => {
  const p = page(), b = band();
  const all = imageSources([p], [b]);
  assert.equal(all.length, 2, "a band is missing from the files the image steps operate on");
  assert.equal(all[0].path, "src/routes/index.tsx");

  // THE BAND CARRIES ITS REAL PATH, because `lintPages` and every message that
  // names a file destructure `{ path }` and a part carries `name`. Without it
  // every finding in a band reads "undefined: writes a @@IMG:@@ token".
  assert.equal(all[1].path, "src/routes/-parts/hero.tsx",
    "a band reached the image steps without a path it could be named by");
  assert.equal(all[1].name, "hero", "a band lost its own name");
  assert.equal(all[1].source, b.source);

  // AND THE ORIGINAL IS NOT TOUCHED — this reads, it never writes back.
  assert.equal(b.path, undefined, "imageSources mutated the part it was handed");

  // Both halves optional, because three callers hand it a list that can be
  // absent (a site with no components, an edit rung that generated none).
  assert.deepEqual(imageSources(null, null), []);
  assert.equal(imageSources([p], undefined).length, 1);
  assert.equal(imageSources(undefined, [b]).length, 1);
});

test("partPath is the one place a part's path is spelled, and every reader agrees with it", () => {
  assert.equal(partPath({ name: "tide-window" }), "src/routes/-parts/tide-window.tsx");
  // DERIVED FROM THE PRODUCT, not typed twice. `publish-pages` builds the same
  // string for its own file list, and two spellings of one path is this repo's
  // recorded "two lists of the same thing" — the explorer, the download and the
  // lint would then disagree about which file a finding is in.
  assert.match(PUB, /["'`]src\/routes\/-parts\/["'`]/,
    "publish-pages no longer spells the parts directory — check partPath still agrees with it");
});

test("planImages plans a band's photograph, and countImageSlots counts it", () => {
  const both = imageSources([page()], [band()]);
  const plan = planImages(both, 4);
  assert.equal(plan.shots.length, 2, "a photograph asked for inside a band was never planned: " + JSON.stringify(plan.shots));
  assert.ok(plan.shots.some((s) => s.token === TOKEN), "the band's own token is missing from the plan");
  assert.equal(countImageSlots(both), 2, "the customer's picture count does not see a band");

  // THE CONTROL: pages alone is what shipped, and it must read as one.
  assert.equal(planImages([page()], 4).shots.length, 1);
  assert.equal(countImageSlots([page()]), 1);
});

test("applyImages sweeps a band, whether or not a photograph was bought", () => {
  const bought = applyImages([band()], new Map([[TOKEN, "/u/x/a.jpg"]]));
  assert.match(bought[0].source, /src="\/u\/x\/a\.jpg"/, "a bought photograph never reached the band");
  assert.doesNotMatch(bought[0].source, /@@/, "a token survived in a band that had its photograph");

  const unbought = applyImages([band()], new Map());
  assert.match(unbought[0].source, /src=""/, "an unbought token was left in the band for the browser to fetch");
  assert.doesNotMatch(unbought[0].source, /@@/);
  assert.equal(unbought[0].name, "hero", "the band lost its name on the way through the sweep");
});

/* --------------------------------------------- the spine, end to end */

test("DRIVEN: the images hook is handed the parts, and the swept parts are what is compiled and stored", async () => {
  const seen = [];
  const { deps, calls } = harness(async (pages, opts) => {
    seen.push(opts && opts.parts);
    // What `buySitePhotos` really answers: both lists, swept with one map.
    const urls = new Map([[TOKEN, "/u/x/shopfront.jpg"], [PAGE_TOKEN, "/u/x/wheel.jpg"]]);
    return { pages: applyImages(pages, urls), parts: applyImages(opts.parts, urls), made: 2, planned: 2, budget: 2, overflow: 0 };
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(out.page, "app");

  // HANDED IN.
  assert.equal(calls.images.length, 1);
  assert.ok(Array.isArray(seen[0]) && seen[0].length === 1, "the images hook was never handed the site's parts: " + JSON.stringify(seen[0]));
  assert.match(seen[0][0].source, /@@IMG:/, "the hook was handed a part that had already been swept by something else");

  // AND BACK OUT, ALL THE WAY TO THE CONTAINER. This is the assertion that
  // matters: a sweep computed and left in a local is the shape that ships dead,
  // and `sitePartsForBuild` — what `deps.compile` is handed — is captured
  // BEFORE the hook runs, so a fix that forgot to move it changes nothing.
  assert.equal(calls.compiledParts.length, 1, "the compile was handed no parts");
  assert.equal(calls.compiledParts[0].length, 1);
  assert.match(calls.compiledParts[0][0].source, /src="\/u\/x\/shopfront\.jpg"/,
    "the container was handed the UNSWEPT part: " + calls.compiledParts[0][0].source);
  assert.doesNotMatch(calls.compiledParts[0][0].source, /@@/);
  assert.equal(calls.compiledParts[0][0].name, "hero", "the part lost its name through the sweep");
});

test("what reaches the container is also what is stored, so a swept part stays swept", () => {
  // WHY THIS MATTERS BEYOND THE ONE BUILD. The spine RE-SENDS a site's stored
  // parts on every later publish — that is not an optimisation, a page
  // importing a component that is not sent does not compile — so an unswept
  // part stored once carries its token into every typo fix for ever.
  //
  // It is already true and it is a SINGLE HOP, which is exactly the kind this
  // repo keeps shipping cut: `partsBuilt` is assigned from the compile hook's
  // second argument, and `saveSiteParts` is handed `partsBuilt`. The driven
  // case above proves the swept parts reach that argument; these two lines are
  // what make "reached the container" and "was stored" the same claim.
  assert.match(WORKER, /partsBuilt = Array\.isArray\(builtParts\) \? builtParts : \[\];/,
    "the parts the container was handed are no longer what is remembered for the store");
  assert.match(WORKER, /await saveSiteParts\(env, slug, partsBuilt\);/,
    "the store no longer writes the parts the container was handed");
});

test("DRIVEN: an unbought band still ships a placeholder rather than a token", async () => {
  const { deps, calls } = harness(async (pages, opts) => ({
    // The commonest path there is: nothing affordable, so the map is empty and
    // the sweep is the whole of what happens. A new account is granted 20
    // credits and a build costs about 21.
    pages: applyImages(pages, new Map()), parts: applyImages(opts.parts, new Map()),
    made: 0, planned: 2, budget: 0, overflow: 0,
  }));
  await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.match(calls.compiledParts[0][0].source, /src=""/,
    "a band nobody could afford a photograph for shipped its token: " + calls.compiledParts[0][0].source);
});

test("DRIVEN: a hook that answers the wrong number of parts changes nothing", async () => {
  // The pages' own rule, mirrored: a hook that hands back a different shape than
  // it was given has not swept these files, and half-applying is worse than not
  // applying. The build carries on with what it wrote.
  const { deps, calls } = harness(async (pages) => ({ pages, parts: [], made: 0, planned: 0, budget: 0, overflow: 0 }));
  await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(calls.compiledParts[0].length, 1, "an empty answer took the site's components off the build");
});

test("DRIVEN: with no images dep at all the parts are byte-identical to what was generated", async () => {
  const { deps, calls } = harness(null);
  await publishPages(deps, { spec: SPEC, slug: "x" });
  assert.equal(typeof deps.images, "undefined");
  assert.equal(calls.compiledParts[0].length, 1);
  assert.equal(calls.compiledParts[0][0].source, band().source,
    "a build with no photographs wired behaves differently from before this change");
});

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

test("the census: buySitePhotos takes the parts and hands them back", () => {
  const at = WORKER.indexOf("async function buySitePhotos(");
  assert.ok(at > 0, "buySitePhotos moved — rescope this guard");
  const end = WORKER.indexOf("\n}\n", WORKER.indexOf("\n  return done(", at));
  assert.ok(end > at, "buySitePhotos' return moved — rescope this guard");
  const body = WORKER.slice(at, end);

  assert.match(body, /^async function buySitePhotos\(env, \{[^}]*\bparts\b/,
    "buySitePhotos is not given the parts, so nothing in it can plan or sweep them");
  assert.match(body, /planImages\(imageSources\(pages, parts\)/,
    "the plan is made over the pages alone, so a band's photograph is never bought");
  assert.match(body, /parts: applyImages\(parts, urls\)/,
    "the one way out of buySitePhotos does not hand back swept parts");

  // AND THE CALLER PASSES THEM. The function taking a parameter nobody fills is
  // the recorded wiring trap in its purest form — every guard above this one
  // still passes while the value is `undefined` on every real build.
  //
  // READ OFF THE CALL, NEVER OFF A NEEDLE THAT THE DECLARATION ALSO SATISFIES.
  // The first draft of this line was `/buySitePhotos\(env, \{ slug, pages,
  // parts,/` and a sweep mutant SURVIVED it: that needle is a substring of the
  // function's own signature two thousand lines up, so the check meant to prove
  // the CALLER passes parts passed happily over a call site that had stopped.
  // The recorded substring-observer trap, third instance in two days — so the
  // call is found by its own `return`, its argument list walked depth-aware, and
  // the two are required to be different places in the file.
  const decl = WORKER.indexOf("async function buySitePhotos(");
  const call = WORKER.indexOf("return buySitePhotos(env, {");
  assert.ok(call > 0, "the build path no longer calls buySitePhotos — rescope this guard");
  assert.ok(call !== decl, "the call and the declaration resolved to one place, so this check cannot see either");
  let d = 1, i = call + "return buySitePhotos(".length;
  for (; i < WORKER.length && d > 0; i++) { if (WORKER[i] === "(") d++; else if (WORKER[i] === ")") d--; }
  const args = WORKER.slice(call + "return buySitePhotos(".length, i - 1);
  assert.match(args, /\bparts\b/,
    "the build path calls buySitePhotos without the parts it now takes: buySitePhotos(" + args + ")");
  assert.match(WORKER, /images: \(pages, \{ balance, reserve, parts \}\)/,
    "the images hook does not read the parts the spine hands it");
});

test("the census: the spine hands the parts in and takes the swept ones back", () => {
  assert.match(PUB, /deps\.images\(v\.pages, \{ balance, reserve, parts: v\.parts \}\)/,
    "the publish spine calls the images hook without the site's parts");
  assert.match(PUB, /r\.parts\.length === v\.parts\.length/,
    "the spine takes back a parts list it never checked the length of");
  // AND `sitePartsForBuild` MOVES WITH IT. It is captured before the hook runs
  // — deliberately, because parts are constant across a retry and salvage — so
  // a sweep that updated `v.parts` alone would send the container the unswept
  // list and change nothing at all. Read inside the taking-back branch.
  const take = PUB.indexOf("r.parts.length === v.parts.length");
  const close = PUB.indexOf("\n      }", take);
  assert.ok(close > take, "the take-back branch moved — rescope this guard");
  assert.match(PUB.slice(take, close), /sitePartsForBuild = v\.parts;/,
    "the swept parts never reach the list the compile is handed");
});

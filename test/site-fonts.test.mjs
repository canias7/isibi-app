import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SHORTLIST, DEFAULT_FONTS, SYSTEM_STACK,
  normalizeFontName, matchFontName, nearestFontName,
  resolveFont, resolvePair, fontCss, fontImports, shortlistForPrompt, stackFor,
} from "../builder/site-fonts.mjs";

import { mergeLook } from "../builder/site-edit.mjs";
import { PLAN_REQUIRED } from "../builder/site-plan.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("a name as somebody would type it reaches the font", () => {
  assert.equal(resolveFont("Playfair Display").id, "playfair-display");
  assert.equal(resolveFont("Space Grotesk Variable").id, "space-grotesk");
  assert.equal(resolveFont("  GEIST  ").id, "geist");
});

test("a typo CORRECTS rather than substituting a different real font", () => {
  // The bug this exists for: prefix matching ran first, so "playfair dsiplay"
  // looked like "playfair" + a suffix and resolved to `playfair` — a real family,
  // and not the one asked for. Substituting a font nobody chose is worse than
  // refusing, because nobody reviews a font they did not ask for.
  assert.equal(resolveFont("playfair dsiplay").id, "playfair-display");
  assert.equal(resolveFont("montserat").id, "montserrat");
  assert.notEqual(resolveFont("playfair dsiplay").id, "playfair");
});

test("a SHORT query never distance-matches, because near means different", () => {
  // `noto` is one edit from `doto`, a real and unrelated family. On a four-letter
  // query a single edit is a different word, not a slip.
  assert.notEqual(resolveFont("noto").id, "doto");
  assert.equal(resolveFont("noto sans").id, "noto-sans");
});

test("an ambiguous prefix prefers a font we actually have installed", () => {
  // ibm-plex-mono and ibm-plex-sans are the same length, and answering a bare
  // "ibm plex" with the monospace one is the wrong guess for body text.
  const r = resolveFont("ibm plex");
  assert.equal(r.id, "ibm-plex-sans");
  assert.equal(r.source, "installed");
});

test("a font that is not on Google Fonts is refused, not approximated", () => {
  const r = resolveFont("Helvetica");
  assert.equal(r.ok, false);
  assert.equal(r.source, "unknown");
});

test("a near miss is offered as a SUGGESTION on a looser threshold than a match", () => {
  // Acting on a guess and proposing one are different risks: a substitution is
  // silent, a suggestion is read by a person who can say no.
  const r = resolveFont("montserrrrat");
  if (r.ok) { assert.equal(r.id, "montserrat"); return; }
  assert.equal(r.suggestion, "montserrat");
});

test("the shortlist resolves as installed, never as a fetch", () => {
  for (const f of SHORTLIST) {
    const r = resolveFont(f.id);
    assert.equal(r.source, "installed", `${f.id} resolved as ${r.source}`);
    assert.equal(r.pkg, f.pkg);
  }
});

test("a font outside the shortlist resolves to a fetchable url", () => {
  const r = resolveFont("Bebas Neue");
  assert.equal(r.source, "fetch");
  assert.match(r.url, /^https:\/\/api\.fontsource\.org\/v1\/fonts\/bebas-neue$/);
});

test("resolvePair NEVER fails, because a wrong typeface beats no site", () => {
  const p = resolvePair({ heading: "Helvetica", body: "also not real at all" });
  assert.ok(p.heading && p.body);
  assert.equal(p.heading.id, DEFAULT_FONTS.heading);
  assert.equal(p.body.id, DEFAULT_FONTS.body);
  assert.equal(p.notes.length, 2, "both refusals should be reported");
  assert.match(p.notes[0], /Helvetica/);
});

test("an unset pairing falls back silently, since nothing was asked for", () => {
  const p = resolvePair({});
  assert.equal(p.heading.id, DEFAULT_FONTS.heading);
  assert.deepEqual(p.notes, [], "nothing was asked for, so there is nothing to report");
});

test("the system stack is LAST in both variables, and MATCHES the kind", () => {
  // A font file that fails to load must leave text rendered rather than
  // invisible, and a site built before any of this keeps working.
  //
  // The filter is on lines that DECLARE a variable. A first draft matched any
  // line containing "--font-", which also caught `font-family:var(--font-sans)`
  // and failed on correct output.
  const css = fontCss(resolvePair({ heading: "lora", body: "geist" })).vars;
  const decls = css.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("--font-"));
  assert.equal(decls.length, 2, css);
  // A serif heading falling back to Helvetica stops being a serif design.
  const heading = decls.find((l) => l.startsWith("--font-heading"));
  const body = decls.find((l) => l.startsWith("--font-sans"));
  assert.ok(heading.endsWith(stackFor("serif") + ";"), heading);
  assert.ok(body.endsWith(stackFor("sans") + ";"), body);
  assert.notEqual(stackFor("serif"), stackFor("sans"));
  assert.ok(fontCss(resolvePair({ heading: "geist-mono", body: "geist" })).vars
    .includes(stackFor("mono")), "a mono heading gets a mono fallback");
});

test("the TEMPLATE actually applies both variables", () => {
  // The whole failure this feature exists to fix is a token nothing references:
  // --font-heading could be set perfectly and change nothing on screen. Asserted
  // against styles.css rather than against generated CSS, because that is where
  // the application lives and where its absence would be invisible.
  const css = fs.readFileSync(path.join(ROOT, "builder/lovable/template/src/styles.css"), "utf8");
  assert.match(css, /h1,\s*h2,\s*h3,\s*h4\s*\{[^}]*font-family:\s*var\(--font-heading\)/);
  assert.match(css, /body\s*\{[^}]*font-family:\s*var\(--font-sans\)/);
  assert.match(css, /--font-sans:/, "the theme must declare a default");
  assert.match(css, /--font-heading:/);
  // ...and the per-site CSS must NOT restate it, or every build reissues a rule
  // that belongs to the template.
  assert.ok(!fontCss(resolvePair(DEFAULT_FONTS)).vars.includes("h1,h2,h3,h4"));
});

test("@font-face is emitted ONLY for a fetched font", () => {
  // An installed font brings its own via the package CSS; declaring it twice
  // makes the browser load both copies.
  const installed = fontCss(resolvePair({ heading: "geist", body: "geist" }));
  assert.equal(installed.faces, "", installed.faces);

  const pair = resolvePair({ heading: "Bebas Neue", body: "geist" });
  const withFile = fontCss(pair, { "bebas-neue": "/fonts/bebas-neue.woff2" }).faces;
  assert.match(withFile, /@font-face\{font-family:"Bebas Neue"/);
  assert.match(withFile, /url\("\/fonts\/bebas-neue\.woff2"\) format\("woff2"\)/);
  // @theme cannot contain an at-rule, so the two must stay separate.
  assert.ok(!fontCss(pair, { "bebas-neue": "/f.woff2" }).vars.includes("@font-face"));
});

test("a fetched font with no file yet emits no broken @font-face", () => {
  const pair = resolvePair({ heading: "Bebas Neue", body: "geist" });
  assert.equal(fontCss(pair, {}).faces, "");
});

test("only the chosen fonts are imported, never the whole shortlist", () => {
  // Importing all 24 statically would ship every font to every site.
  const imports = fontImports(resolvePair({ heading: "lora", body: "geist" }));
  assert.equal(imports.length, 2);
  assert.ok(imports.every((p) => p.startsWith("@fontsource")));
  assert.equal(fontImports(resolvePair({ heading: "geist", body: "geist" })).length, 1,
    "the same font in both slots is one import, not two");
  assert.equal(fontImports(resolvePair({ heading: "Bebas Neue", body: "Bebas Neue" })).length, 0,
    "a fetched font has no package to import");
});

test("every shortlist package is REALLY a dependency of the template", () => {
  // Derived, not listed. A shortlist entry that is not installed produces a site
  // whose CSS names a font that was never bundled — it renders as the fallback
  // and looks exactly like the feature doing nothing.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "builder/lovable/template/package.json"), "utf8"));
  const deps = new Set(Object.keys(pkg.dependencies || {}));
  assert.ok(SHORTLIST.length > 0);
  for (const f of SHORTLIST) {
    assert.ok(deps.has(f.pkg), `${f.id} is offered but ${f.pkg} is not in package.json`);
  }
});

test("the prompt cost of the shortlist stays small", () => {
  // The reason there is a shortlist at all: all 2,096 names is ~7,500 tokens on
  // every generation. If this ever creeps toward that, the tradeoff is gone.
  const chars = shortlistForPrompt().length;
  assert.ok(chars < 3000, `shortlist prompt is ${chars} chars`);
  assert.ok(shortlistForPrompt().includes("geist"));
});

test("the font index is the real Fontsource catalogue", () => {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "builder/font-index.json"), "utf8"));
  assert.ok(idx.length > 1500, `index has only ${idx.length} names`);
  for (const f of SHORTLIST) {
    assert.ok(idx.includes(f.id), `${f.id} is offered but is not in the font index`);
  }
});

test("normalizeFontName is total — no input throws", () => {
  for (const v of [null, undefined, 0, {}, [], "   ", "!!!"]) {
    assert.equal(typeof normalizeFontName(v), "string");
  }
  assert.equal(matchFontName(""), null);
  assert.equal(nearestFontName("").id, null);
});

test("the DESIGNER can actually declare a font, and only a real one", () => {
  // The failure this guards has happened five times in this repo: a feature that
  // is implemented, tested and enforced, and that nothing can ever declare. The
  // chain is asserted end to end because any one broken link makes the rest
  // useless — the tool must offer the field, the enum must be DERIVED from the
  // shortlist rather than restated, and the route must pass the answer on.
  const src = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  assert.match(src, /const SITE_FONT_IDS = SHORTLIST\.map\(/,
    "the enum must be derived from site-fonts.mjs, not a second copy that can drift");
  assert.match(src, /heading:\s*\{ type: "string", enum: SITE_FONT_IDS/);
  assert.match(src, /body:\s*\{ type: "string", enum: SITE_FONT_IDS/);
  // `fonts` IS REQUIRED AGAIN, AND THIS ASSERTION HAS NOW BEEN INVERTED TWICE —
  // which is worth reading as one story rather than as a flip-flop, because each
  // position was right on its own premise and the premise is what moved.
  //
  //   1. Required. The model answered from a prose hint on every build and could
  //      contradict the theme it had just chosen, with nothing checking the two
  //      agreed.
  //   2. Optional. Right once `themeFontPair` existed: an omitted pair was
  //      filled from the curated recommendation carried by whichever of the 500
  //      registry themes had been named, so skipping was the BETTER answer.
  //   3. Required again (2026-08-20). The registry is deleted — the designer
  //      authors the palette per site now — so there is no theme to recommend a
  //      pairing, and "usually leave it out" would put every site whose designer
  //      took that advice on the template's default face. The typeface is part
  //      of the same authoring act as the colours.
  //
  // ANCHORED ON THE TOOL'S OWN CLOSING SHAPE, not on the shape of its CONTENTS.
  // It was `\[("[a-z]+",\s*)*"[a-z]+"\]` — a list of nothing but quoted
  // lowercase names — and went red the day that list stopped being one, when the
  // six authored plan fields arrived as `...PLAN_REQUIRED`. A test about how the
  // entries are written, failing a correct change: this repo's most repeated
  // own-goal, and the same one `site-images.test.mjs` records one file over.
  const required = src.match(/required: \[[^\]]*\],\s*\n\s*\},\s*\n\};/);
  assert.ok(required, "could not find design_schema's required list");
  assert.match(required[0], /"fonts"/,
    "fonts is optional again — with no registry to recommend a pairing, that means the default face on every site whose designer omits it");
  // AND THE PREMISE THAT MAKES IT REQUIRED RATHER THAN MERELY WISHED FOR: there
  // is no longer any fallback to fill an omitted pair from. Asserted as an
  // ABSENCE, because restoring one without making the field optional again is
  // harmless, and making it optional without restoring one is the regression.
  //
  // COMMENTS BLANKED FIRST, and this guard caught its own author on the way in:
  // the note in worker.js recording that `themeFontPair` was removed CONTAINS
  // the name, so the check went red against a file that is exactly right. Prose
  // explaining a deletion spells the deleted thing — recorded here more than
  // half a dozen times, and the reason a negative assertion never reads raw
  // source.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /themeFontPair/,
    "themeFontPair is back — decide which of the two fills an omitted pair, rather than having both");
  // Resolved through the `look` object now — a revise keeps the fonts the site
  // already wears rather than re-rolling them from the instruction — but the
  // designer's answer is still what a FIRST build uses, and both halves of that
  // are asserted apart: the chain that computes it, and the value reaching the
  // build. Either alone passes while the other is broken.
  // THE PROPERTY, NOT THE CHAIN. This pinned the inline
  // `(priorLook && …) || (designed && …)` expression and went red when the merge
  // moved into `mergeLook` — word order again. What has to hold is that a
  // designer that NAMES a pair still reaches the build, on a first build and on
  // an instructed edit alike, so a brief asking for a typeface is not ignored.
  assert.deepEqual(mergeLook(null, { fonts: { heading: "lora", body: "geist" } }, null).fonts,
    { heading: "lora", body: "geist" }, "the designer's answer has to reach the build");
  assert.deepEqual(mergeLook({ fonts: { heading: "inter", body: "inter" } },
    { fonts: { heading: "lora", body: "geist" } }, null, { instructed: true }).fonts,
    { heading: "lora", body: "geist" }, "an edit that asks for a typeface cannot get one");
  // …and a half pair is NOT an answer, or `{heading:"x"}` reaches the build and
  // the body silently defaults — the same rule `themeFontPair` follows.
  assert.equal(mergeLook(null, { fonts: { heading: "lora" } }, null).fonts, null);
  assert.match(src, /const merged = mergeLook\(priorLook, designed, body/, "the route does not merge the look");
  assert.match(src, /fonts: look\.fonts,/, "the resolved fonts never reach buildAndPublishPages");
  assert.match(src, /fonts: \{ heading: fontPair\.heading\.id, body: fontPair\.body\.id \}/,
    "and the build request has to carry it");
});

test("an off-shortlist font is FETCHED by the Worker, and fails soft", () => {
  // The container is not assumed to have network; the Worker certainly does.
  const src = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  const fn = src.slice(src.indexOf("async function fetchSiteFonts"), src.indexOf("// brief + schema"));
  assert.ok(fn.length > 200, "fetchSiteFonts not found");
  assert.match(fn, /AbortSignal\.timeout\(/, "a third party on the build path must be bounded");
  assert.match(fn, /catch \(e\)/, "a font we cannot reach must cost a typeface, not a site");
  assert.match(fn, /f\.source !== "fetch"/, "an installed font must never be fetched");
});


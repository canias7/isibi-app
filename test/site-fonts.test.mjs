import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SHORTLIST, DEFAULT_FONTS, SYSTEM_STACK,
  normalizeFontName, matchFontName, nearestFontName,
  resolveFont, resolvePair, resolvePageFonts, fontCss, fontImports, shortlistForPrompt, stackFor,
} from "../builder/site-fonts.mjs";

import { mergeLook } from "../builder/site-edit.mjs";
import { fontsIn } from "../builder/site-freecss.mjs";
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

test("A TYPEFACE IS NAMED IN THE STYLESHEET NOW — the enum is gone and cannot come back", () => {
  // ── THIS ASSERTION IS INVERTED, AND IT IS THE FOURTH TIME FOR THIS FIELD ────
  //
  // The story is worth reading whole rather than as a flip-flop, because each
  // position was right on its own premise and it is the premise that keeps
  // moving:
  //
  //   1. REQUIRED. The model answered from a prose hint on every build and could
  //      contradict the theme it had just chosen, with nothing checking the two
  //      agreed.
  //   2. OPTIONAL. Right once `themeFontPair` existed: an omitted pair was
  //      filled from the curated recommendation carried by whichever of the 500
  //      registry themes had been named, so skipping was the BETTER answer.
  //   3. REQUIRED AGAIN (2026-08-20). The registry was deleted, so there was no
  //      theme to recommend a pairing and "usually leave it out" would have put
  //      every site whose designer took that advice on the template's default.
  //   4. GONE (2026-08-23, owner's call). Five look fields became one `css`
  //      string, and a typeface is not a special case inside a stylesheet — it
  //      is a `font-family` declaration like any other. `fontsIn` reads the
  //      families back out and they are fetched exactly as a named pair was.
  //
  // ASSERTED AS AN ABSENCE, which is the half that rots silently: `seeds` and
  // `fonts` are still stored, still merged and still SENT on every republish, so
  // a `fonts` field quietly restored to the tool would not fail anything obvious
  // — it would simply give the model two ways to choose a typeface and let them
  // disagree, with whichever ran last winning.
  const src = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /enum: SITE_FONT_IDS/,
    "the font enum is back in the tool — there are now two ways to choose a typeface and nothing decides between them");
  assert.doesNotMatch(code, /\n\s{6}fonts: \{/,
    "`fonts` is back on design_schema beside `css`, so a pairing and a stylesheet can name different faces");
  const required = src.match(/required: \[[^\]]*\],\s*\n\s*\},\s*\n\};/);
  assert.ok(required, "could not find design_schema's required list");
  assert.doesNotMatch(required[0], /"fonts"/, "a deleted field cannot be required");
  assert.match(required[0], /"css"/,
    "the stylesheet is not compelled, so a site whose designer omits it ships the template's plain default look");

  // ── AND THE STORED PAIR STILL FLOWS, WHICH IS THE COMPATIBILITY HALF ────────
  //
  // Every site built between 2026-08-20 and 2026-08-23 has a pairing in
  // `site_look`, and `mergeLook` rebuilds its output from `EDIT_FIELDS` alone —
  // so `fonts` leaving that list would strip the typeface off a live site
  // because its owner fixed a typo. Driven through the real merge rather than
  // read off the constant, because the constant containing the name proves
  // nothing about the merge keeping the value.
  assert.deepEqual(mergeLook({ fonts: { heading: "lora", body: "geist" } }, {}, null, { instructed: true }).fonts,
    { heading: "lora", body: "geist" },
    "an existing site loses its typeface on the next unrelated edit");
  assert.match(src, /fonts: look\.fonts,/, "the stored fonts never reach buildAndPublishPages");
  assert.match(src, /fonts: \{ heading: fontPair\.heading\.id, body: fontPair\.body\.id \}/,
    "and the build request has to carry it");
  // THE PROPERTY, NOT THE SPELLING. This pinned `const merged = mergeLook(...)`
  // and went red when the route grew a SECOND call — the probe that answers
  // which page a colour is for, which must run before the merge it feeds.
  assert.match(src, /mergeLook\(priorLook, [a-zA-Z]+, body/, "the route does not merge the look");
});

test("A FAMILY THE STYLESHEET NAMES IS FETCHED AND BUNDLED — the whole new chain", () => {
  // THE FAILURE THIS GUARDS is the one `site-fonts.mjs`'s own header is written
  // around, arriving through the door that has no font picker in front of it: a
  // `font-family` with no file behind it falls back SILENTLY, so the site ships
  // in the wrong typeface and every layer reports success. Six links, each
  // asserted apart, because any one of them broken makes the rest useless.
  const src = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  const container = fs.readFileSync(path.join(ROOT, "builder", "build-server.mjs"), "utf8");

  // 1. the families are read out of the sheet at all…
  assert.deepEqual(fontsIn(':root{--font-sans:"Lora",Georgia,serif}body{font-family:var(--font-sans)}').ids,
    ["lora"], "the template's own shape — a stack behind a custom property — is not read");
  // 2. …against the WHOLE catalogue rather than the installed 24, or a family we
  //    can fetch perfectly well is reported to the customer as a fallback.
  assert.deepEqual(fontsIn('body{font-family:"Cormorant Garamond",serif}').ids, ["cormorant-garamond"]);
  // 3. …and a system face is NOT reported, which is the false alarm that would
  //    tell somebody their working stylesheet had degraded.
  assert.deepEqual(fontsIn("body{font-family:Georgia,serif}").missing, []);

  // 4. the Worker fetches them, on BOTH publish paths — the build and the cheap
  //    spine every text fix, colour change and picture swap goes through. A path
  //    that does not fetch re-emits no @font-face, because the container rewrites
  //    the stylesheet from a pristine copy on every single build.
  // `await`, NOT A BARE NAME — the DECLARATION is `function fetchSiteFonts(pair,
  // pages = [], extra = [])` and matches a bare scan, so the first draft of this
  // reported a call site that does not exist and failed against correct code.
  // The `buildEffortHTML()` trap, which this repo has recorded three times: a
  // source-read must anchor on something only the thing being asserted can have.
  const fetches = [...src.matchAll(/await fetchSiteFonts\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(fetches.length >= 2, "the two publish paths no longer both fetch fonts");
  for (const args of fetches) {
    assert.match(args, /cssRead\.fonts/,
      "a publish path fetches the pair and not the stylesheet's own families: " + args);
  }
  // 5. …and the ids reach the container, so it can emit the face and the import.
  assert.equal((src.match(/cssFonts: \(cssRead\.fontIds \|\| \[\]\)/g) || []).length, 2,
    "both container payloads must name the stylesheet's families");
  // 6. …where BOTH halves happen. A @font-face with no npm import leaves an
  //    installed family unbundled; an import with no face leaves a fetched one
  //    with no file. Either alone renders the fallback and reports success.
  assert.match(container, /writeFonts\(payload\.fonts, payload\.fontFiles, payload\.pageFonts, payload\.cssFonts\)/,
    "the container never receives the stylesheet's families");
  assert.match(container, /fontCss\(pair, written, pageScopes, cssFaces\)/,
    "no @font-face is emitted for a family the stylesheet names");
  assert.match(container, /fontImports\(pair, pageScopes, cssFaces\)/,
    "an installed family the stylesheet names is bundled by nothing");
  // 7. …AND THE INSTALLED FAMILY'S PACKAGE IS @import-ED FROM THE STYLESHEET,
  //    which is the only thing that produces a rule. MEASURED on a real build:
  //    the npm import in `fonts.ts` emits every woff2 as an asset and puts ZERO
  //    `@font-face` in `dist/client` or `dist/server` — the files are there and
  //    nothing tells the browser to use them, so the site renders the system
  //    face and every layer reports the family it asked for. It was true of the
  //    template's own `geist` default too, i.e. of every published site.
  //
  //    ASSERTED AS THE PROPERTY, NOT THE SPELLING: what has to hold is that the
  //    package names become `@import` lines and that those lines are FIRST in
  //    what is written, because an `@import` after any rule is ignored per spec
  //    — and `decls.faces` (the fetched families' own @font-face) is written
  //    into the same string.
  const imports = container.match(/const cssImports = ([^\n]*)/);
  assert.ok(imports, "the installed families' packages are not turned into @import lines");
  assert.match(imports[1], /@import/, "…and what is built from them is not an @import");
  const write = container.match(/fs\.writeFileSync\(STYLES,\s*([\s\S]{0,160})/);
  assert.ok(write, "the stylesheet write moved and this guard is watching nothing");
  assert.match(write[1], /^\s*\(cssImports/,
    "the package @imports are not the FIRST thing in the stylesheet, so the browser ignores them");
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


/* ── a page's own typeface may not replace the site's other half ──────────── */

test("A HALF-NAMED PAGE PAIR KEEPS THE SITE'S OTHER HALF", () => {
  // WHAT WAS BROKEN. "Use something handwritten for the headings on the menu
  // page" names ONE slot, which is the ordinary shape of this ask, and both
  // lanes store it as `{heading:"caveat", body:""}`. `resolvePageFonts` handed
  // that to `resolvePair`, which fills an unasked slot from `DEFAULT_FONTS`,
  // and `fontCss` emitted BOTH properties for the scope — so the derived half
  // actively overrode the site's. Measured through the real module against a
  // site pair of fraunces/inter:
  //
  //   resolvePageFonts({'/menu':{heading:'caveat', body:''}})
  //     -> page pair: caveat / geist
  //   notes: []
  //
  // The page the customer asked to restyle lost the site's body typeface as
  // well, replaced by the PLATFORM default, and nothing reported it: the pair
  // produced no note because `resolvePair` only speaks up about a font it could
  // not resolve, and there was nothing to resolve.
  const site = resolvePair({ heading: "fraunces", body: "inter" });
  assert.equal(site.body.id, "inter", "the fixture's site body font is not what this test thinks");

  const { pages, notes } = resolvePageFonts({ "/menu": { heading: "caveat", body: "" } });
  assert.equal(pages.length, 1, "the page scope was dropped entirely");
  assert.equal(pages[0].pair.heading.id, "caveat", "the half that WAS asked for must still apply");
  assert.equal(pages[0].pair.body, null,
    "the unasked half was filled in — from " + (pages[0].pair.body && pages[0].pair.body.id));
  assert.deepEqual(notes, [], "a half-named pair is not a problem to report");

  // THE END OF THE WIRE, because a slot left null in the pair and then emitted
  // anyway is the same bug one function later. This is what actually reaches
  // the customer's stylesheet.
  const css = fontCss(site, {}, pages);
  assert.match(css.scoped, /--font-heading:"Caveat"/, "the asked-for half never reached the scope");
  assert.doesNotMatch(css.scoped, /--font-sans:/,
    "the scope declares a body font nobody asked for, overriding the site's: " + css.scoped);
  // And the site's own value is still declared, which is what the scope now
  // defers to — the whole reason emitting nothing is the right answer.
  assert.match(css.vars, /--font-sans: "Inter Variable"/, "the site's own body font is not being declared");
});

test("…and naming BOTH halves still overrides both", () => {
  // The negative, or "emit nothing" is equally satisfied by a scope that emits
  // nothing at all and the feature is dead rather than fixed.
  const site = resolvePair({ heading: "fraunces", body: "inter" });
  const { pages } = resolvePageFonts({ "/menu": { heading: "caveat", body: "lobster" } });
  const css = fontCss(site, {}, pages);
  assert.match(css.scoped, /--font-heading:"Caveat"/);
  assert.match(css.scoped, /--font-sans:"Lobster"/);
});

test("a page whose ONLY named font cannot be got is not a scope at all", () => {
  // Both halves unusable means the page simply keeps the site's typeface, so an
  // empty `body[data-page=…]{}` rule would be dead bytes — and counting it
  // against MAX_PAGE_FONTS would spend one of the two slots on a page that
  // changes nothing.
  const site = resolvePair({ heading: "fraunces", body: "inter" });
  const { pages, notes } = resolvePageFonts({ "/menu": { heading: "helvetica" } });
  assert.equal(pages.length, 0, "an empty scope was kept");
  assert.equal(fontCss(site, {}, pages).scoped, "");
  // AND THE SENTENCE HAS TO BE TRUE. "Used the default instead" is what a SITE
  // does; a page keeps the site's, and telling the customer otherwise is a
  // claim about their site that is simply wrong.
  assert.equal(notes.length, 1, "a font we could not get must still be reported");
  assert.match(notes[0], /Kept the site's instead\./, notes[0]);
  assert.doesNotMatch(notes[0], /Used the default instead\./, notes[0]);
});

test("a SITE's pair is still always filled — there is nothing under it", () => {
  // The asymmetry is the whole design, so it is asserted rather than left to
  // the default argument: a site with one half named has to end up with two
  // real faces, because `--font-sans` has no site-level value to cascade from.
  const site = resolvePair({ heading: "caveat" });
  assert.equal(site.heading.id, "caveat");
  assert.equal(site.body.id, DEFAULT_FONTS.body, "a site's unasked half must still fall back");
  assert.equal(resolvePair({}).body.id, DEFAULT_FONTS.body);
  assert.match(resolvePair({ heading: "helvetica" }).notes[0], /Used the default instead\./,
    "a site really does use the default, and must say so");
});

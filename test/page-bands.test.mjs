// A PAGE IS WRITTEN A BAND AT A TIME (2026-09-09, owner: "figure out if we can
// send different agents to do tasks at the same time" → "A").
//
// WHAT THESE GUARD, and every one is a way the split ships looking right and
// writes a page that does not compile — which on this path means a paid build
// that ends in a placeholder:
//
//   * the shell composing a name nothing declares (a refused band DROPPED
//     rather than stubbed) — the whole-page failure, one line later than the
//     band's own;
//   * two bands declaring the same helper, which vite refuses outright;
//   * an import header read wrong, swallowing the top of a band;
//   * the bands assembled in FINISHING order rather than the design's, which
//     is the whole point of running them at once and is invisible in a diff.
//
// THE STRONGEST CASE HERE IS THE CORPUS PARSE. Everything above is a claim
// about text; only running the template's own TypeScript over the assembled
// file answers "does this compile", and the 324 real generated pages are the
// only honest material — a hand-typed band is a second copy of what a band
// looks like, and this repository's own recorded trap is that such copies
// drift from the real producer.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";
import {
  MAX_BANDS, MIN_BAND_CHARS, bandsOf, bandName, splitBand, bandProblems,
  bandStub, pageShell, assembleBands, SHELL_IMPORTS,
  BAND_TOOL, bandPlan, bandPrompt, bandRequest,
} from "../builder/page-bands.mjs";
import { MAX_SECTIONS } from "../builder/site-plan.mjs";
import { pageRulesFor, SITE_PAGES_MAX_TOKENS } from "../builder/page-gen.mjs";
import { modelsFor } from "../builder/build-models.mjs";

const CHROME = { name: "Hartley & Voss", tagline: "Chartered accountants", action: { label: "Book", href: "#book" } };
const band = (name, extra = "") =>
  `import { Button } from "@/components/ui/button";\nimport { useState } from "react";\n\n` +
  `function ${name}() {\n  const [n, setN] = useState(0);\n${extra}` +
  `  return <section data-slot="${name}"><Button onClick={() => setN(n + 1)}>Go</Button></section>;\n}\n`;

// ── WHICH BANDS THERE ARE ───────────────────────────────────────────────────

test("MAX_BANDS is the design's own cap, by identity — never a second number", () => {
  // A separate ceiling could only ever disagree with the field that produces
  // the sections, and the direction it would disagree in is silent: a lower
  // number drops bands the customer was shown in the plan and nothing says so.
  assert.equal(MAX_BANDS, MAX_SECTIONS);
});

test("DRIVEN: bandsOf reads the page's own row out of shape, in order", () => {
  const shape = [
    { path: "menu.tsx", sections: ["Menu — a list"] },
    { path: "index.tsx", sections: ["Hero — full bleed", "Prices — three across", "Contact — a form"] },
  ];
  assert.deepEqual(bandsOf(shape, "index.tsx"), ["Hero — full bleed", "Prices — three across", "Contact — a form"]);
  assert.deepEqual(bandsOf(shape, "menu.tsx"), ["Menu — a list"]);
  // A page with NO row answers none, which the caller reads as "do not split
  // this one" and falls back to the single call. `shape` is compelled on a
  // build, but this module also has to survive a hand-made payload and a
  // version skew, so a missing row is an answer rather than a throw.
  assert.deepEqual(bandsOf(shape, "about.tsx"), []);
  for (const junk of [null, undefined, "", 0, [], {}, [null], [{ path: "index.tsx" }]])
    assert.deepEqual(bandsOf(junk, "index.tsx"), [], "junk shape " + JSON.stringify(junk));
  assert.deepEqual(bandsOf(shape, null), [], "a non-string path names no page");
});

test("DRIVEN: bandsOf caps at MAX_BANDS and drops a line that says nothing", () => {
  const many = Array.from({ length: MAX_BANDS + 4 }, (_, i) => "Band number " + i);
  assert.equal(bandsOf([{ path: "index.tsx", sections: many }], "index.tsx").length, MAX_BANDS);
  const thin = ["ok this one is real", "  ", "x".repeat(MIN_BAND_CHARS - 1), "also real", 7, null];
  assert.deepEqual(bandsOf([{ path: "index.tsx", sections: thin }], "index.tsx"), ["ok this one is real", "also real"]);
});

// ── THE NAMES ───────────────────────────────────────────────────────────────

test("DRIVEN: a band's name is unique BY THE INDEX, and readable by the word", () => {
  // THE CASE THAT MATTERS: two bands can legitimately open with the same word,
  // and a name derived from the words alone collides on exactly the page that
  // was planned most carefully. The index is what makes it safe.
  const lines = ["Prices for members — three across", "Prices for visitors — three across"];
  const names = lines.map(bandName);
  assert.equal(names[0], "Band1Prices");
  assert.equal(names[1], "Band2Prices");
  assert.notEqual(names[0], names[1], "two bands opening on the same word collided");
  // Readable: the word survives so the Code tab can be read.
  assert.match(bandName("Hero — full bleed", 0), /Hero$/);
});

test("DRIVEN: every name is a legal identifier, whatever the line is", () => {
  const awkward = ["", "   ", "— · —", "日本語の帯", "3 columns of prices", "!!!", null, undefined, 42, ["a"], {}];
  for (const [i, line] of awkward.entries()) {
    const n = bandName(line, i);
    assert.match(n, /^[A-Za-z_$][\w$]*$/, "not a legal identifier for " + JSON.stringify(line) + ": " + n);
    assert.ok(!/^\d/.test(n), "a name may never start with a digit: " + n);
  }
  // A line with no letters falls back to the bare index form rather than an
  // empty suffix — `Band3` is a name, `Band3` + "" must not become `Band`.
  assert.equal(bandName("— · —", 2), "Band3");
  // Every name in one page is distinct, which is the property the shell rests on.
  const names = awkward.map((l, i) => bandName(l, i));
  assert.equal(new Set(names).size, names.length, "names collided: " + names.join(" "));
});

// ── READING ONE BAND'S ANSWER ───────────────────────────────────────────────

test("DRIVEN: splitBand lifts the imports and keeps everything after them", () => {
  const { imports, body, decls } = splitBand(band("Band1Hero"));
  assert.deepEqual(imports, ['import { Button } from "@/components/ui/button";', 'import { useState } from "react";']);
  assert.ok(body.startsWith("function Band1Hero()"), "the body did not start at the component: " + body.slice(0, 40));
  assert.deepEqual(decls, ["Band1Hero"]);
  assert.ok(!body.includes("import "), "an import was left in the body");
});

test("DRIVEN: a band with no imports keeps its whole source", () => {
  const src = "function Band1Hero() {\n  return <section>hi</section>;\n}\n";
  const { imports, body, decls } = splitBand(src);
  assert.deepEqual(imports, []);
  assert.equal(body.trim(), src.trim());
  assert.deepEqual(decls, ["Band1Hero"]);
});

test("DRIVEN: declarations are read at the LEFT MARGIN — measured against the corpus", () => {
  // The rule is "a top-level declaration starts at column 0", and it is
  // measured rather than assumed: across the 324 real generated pages there
  // are 972 top-level declarations, every one at column 0, and ZERO indented
  // `function` or `class` declarations. A real parser would have to know when
  // it is inside JSX — where `didn't` is text and not an unterminated string,
  // this repository's own recorded trap — to answer a question the left margin
  // already answers.
  const { decls } = splitBand(
    "function Band1Hero() {\n" +
    "  function inner() { return 1; }\n" +      // indented: NOT top level
    "  const x = 2;\n" +
    "  return <p>we didn't forget</p>;\n" +      // an apostrophe in JSX text
    "}\n" +
    "const helper = 3;\n"                        // column 0: top level
  );
  assert.deepEqual(decls, ["Band1Hero", "helper"], "the margin rule read the wrong set");
});

// ── WHAT IS REFUSED ─────────────────────────────────────────────────────────

test("DRIVEN: a band may declare nothing at top level but itself", () => {
  // TWO BANDS THAT BOTH WRITE `function formatPrice` PRODUCE A FILE VITE
  // REFUSES. Renaming one means rewriting every reference to it in that band's
  // source, which is a source rewrite this repository has no business doing on
  // the money path — so the rule is the wall, and a helper goes inside the
  // component, which costs the writer nothing.
  const withHelper =
    'import { Button } from "@/components/ui/button";\n\n' +
    "function formatPrice(p: number) { return `£${p}`; }\n" +
    "function Band1Hero() { return <section>{formatPrice(3)}</section>; }\n";
  const why = bandProblems("Band1Hero", withHelper);
  assert.equal(why.length, 1);
  assert.match(why[0], /formatPrice/, "the refusal does not name what was declared: " + why[0]);
  assert.match(why[0], /inside the component/, "the refusal does not say what to do instead");
  // The clean one is clean.
  assert.deepEqual(bandProblems("Band1Hero", band("Band1Hero")), []);
});

test("DRIVEN: nothing, the wrong name, and an export are each refused by name", () => {
  assert.deepEqual(bandProblems("Band1Hero", ""), ["wrote nothing"]);
  assert.deepEqual(bandProblems("Band1Hero", "   \n\n"), ["wrote nothing"]);
  assert.deepEqual(bandProblems("Band1Hero", 'import { X } from "y";\n'), ["wrote nothing"]);
  assert.deepEqual(bandProblems("Band1Hero", "// just a comment\n"), ["declared no component"]);
  const wrong = bandProblems("Band1Hero", "function SomethingElse() { return null; }\n");
  assert.ok(wrong.some((w) => /did not declare Band1Hero/.test(w)), "a band under the wrong name passed: " + wrong.join(" | "));
  // An `export default` in a page file is a parse failure whose line number
  // points at the assembled file rather than at anything a writer wrote.
  const exported = bandProblems("Band1Hero", "export default function Band1Hero() { return null; }\n");
  assert.ok(exported.some((w) => /local component/.test(w)), "an exported band passed: " + exported.join(" | "));
});

test("DRIVEN: the stub is a real component, and cannot break out of its own comment", () => {
  const s = bandStub("Band4Gallery", "A gallery of the work */ ] } evil");
  assert.match(s, /^function Band4Gallery\(\)/, "the stub is not a component");
  assert.match(s, /return null;/, "the stub draws something");
  assert.ok(!s.includes("*/"), "the line closed the stub's own comment: " + s);
  // A stub with no line still says why.
  assert.match(bandStub("Band2X", null), /could not be written/);
});

// ── THE SHELL ───────────────────────────────────────────────────────────────

test("DRIVEN: the shell composes the bands by name and carries NO state", () => {
  const s = pageShell({ route: "/", chrome: CHROME, names: ["Band1Hero", "Band2Prices"] });
  assert.match(s, /createFileRoute\("\/"\)/);
  assert.match(s, /<Band1Hero \/>[\s\S]*<Band2Prices \/>/, "the bands are not composed in order");
  // THE SHELL HOLDING A HOOK IS THE DESIGN COLLAPSING: every band owns its own
  // state, which is the whole reason a band is a component rather than a
  // fragment, and a hook here would mean something is shared after all.
  assert.ok(!/useState|useEffect|useRef|useMemo/.test(s), "the shell grew state: " + s);
  assert.match(s, /name="Hartley & Voss"/, "the chrome lost the site's name");
  assert.match(s, /action=\{\{"label":"Book"/, "the chrome lost the action");
});

test("DRIVEN: the shell leaves out a chrome field the design did not answer", () => {
  const s = pageShell({ route: "/menu", chrome: { name: "X" }, names: ["Band1A"] });
  assert.ok(!s.includes("tagline"), "an unanswered field was written as empty: " + s);
  assert.ok(!s.includes("action"), "an unanswered field was written as empty: " + s);
  assert.match(s, /createFileRoute\("\/menu"\)/);
  // No route at all still names one — a route file with no path does not build.
  assert.match(pageShell({ route: null, chrome: {}, names: [] }), /createFileRoute\("\/"\)/);
});

// ── ASSEMBLY ────────────────────────────────────────────────────────────────

test("DRIVEN: the design's order is what lands, not the order the answers came in", () => {
  // THE WHOLE POINT OF RUNNING THE BANDS AT ONCE IS THAT THEY FINISH OUT OF
  // ORDER. A page assembled in finishing order is a page whose hero is wherever
  // the fastest agent happened to land, and nothing about it looks wrong in a
  // diff — it is simply a different site.
  const names = ["Band1Hero", "Band2Prices", "Band3Contact"];
  const { source } = assembleBands({
    route: "/", chrome: CHROME,
    bands: names.map((n) => ({ name: n, line: n, source: band(n) })),
  });
  const at = names.map((n) => source.indexOf("<" + n + " />"));
  assert.ok(at.every((i) => i > 0), "a band is missing from the shell");
  assert.deepEqual([...at].sort((a, b) => a - b), at, "the shell composed the bands out of order");

  // AND AGAIN WITH NAMES THAT DO NOT SORT INTO THE GIVEN ORDER, because the
  // case above cannot see a reordering and that was measured rather than
  // guessed: `bandName` puts the index first and `MAX_BANDS` is 8, so its
  // names are ALREADY in lexicographic order — over 2,000 random shapes,
  // sorting them reordered nothing, not once. A mutant that sorted the list
  // was therefore INERT and survived, reading exactly like a missing check.
  // `assembleBands` takes whatever names the caller hands it, so handing it a
  // deliberately unsorted set is what makes any reordering visible at all.
  const wild = ["Zulu", "Alpha", "Mike"];
  const out = assembleBands({
    route: "/", chrome: CHROME,
    bands: wild.map((n) => ({ name: n, line: n, source: band(n) })),
  });
  const wat = wild.map((n) => out.source.indexOf("<" + n + " />"));
  assert.ok(wat.every((i) => i > 0), "a band is missing from the shell");
  assert.deepEqual([...wat].sort((a, b) => a - b), wat,
    "the shell reordered the bands — the design's order is the only order there is");
});

test("DRIVEN: a refused band is STUBBED, never dropped — and it is stubbed as a FILE", () => {
  // RE-ANCHORED 2026-09-11, when a band became its own module. The property is
  // unchanged and the spelling moved: a dropped band used to leave the shell
  // composing a name nothing DECLARED; it now leaves the shell importing a
  // module that is not THERE, which is `vite` refusing the build rather than a
  // page missing a section — a strictly worse failure, so the stub matters more
  // than it did. Salvage's precedent either way: a page missing one band beats
  // no page.
  const { source, parts, refused } = assembleBands({
    route: "/", chrome: CHROME,
    bands: [
      { name: "Band1Hero", line: "Hero", source: band("Band1Hero") },
      { name: "Band2Bad", line: "Prices", source: "function helper() {}\nfunction Band2Bad() { return null; }\n" },
      { name: "Band3Contact", line: "Contact", source: band("Band3Contact") },
    ],
  });
  assert.equal(refused.length, 1);
  assert.equal(refused[0].name, "Band2Bad");
  assert.match(source, /<Band2Bad \/>/, "the refused band left the shell");
  assert.match(source, /import Band2Bad from "@\/routes\/-parts\/band-2-bad"/, "the refused band is not imported — the page cannot compile");
  const stub = parts.find((p) => p.name === "band-2-bad");
  assert.ok(stub, "the refused band got no file — the import names nothing and vite refuses the build");
  assert.match(stub.source, /function Band2Bad\(\)/, "the stub file does not declare the band");
  assert.match(stub.source, /export default Band2Bad;/, "the stub file does not export what the page imports");
  assert.ok(stub.stub, "the stub is not marked as one");
  // THE HELPER IS THE REASON IT WAS REFUSED, so it must not survive into any
  // file — not the page, and not the band's own.
  assert.ok(!source.includes("function helper"), "the refused band's helper reached the page");
  for (const p of parts) assert.ok(!p.source.includes("function helper"), "the refused band's helper reached " + p.name);
});

test("EVERY NAME THE SHELL COMPOSES IS IMPORTED FROM A FILE THAT EXPORTS IT — the invariant, over every shape", () => {
  // The one property that decides whether a page compiles at all, asserted over
  // clean bands, refused bands, and a band that answered nothing.
  //
  // RE-ANCHORED 2026-09-11 and STRONGER than the version it replaces. That one
  // asked whether the composed name was DECLARED in the same file. A band is
  // its own module now, so the chain is three links — composed, imported from a
  // path, and that path's file declaring AND default-exporting the name — and
  // any one of them broken is a page that does not build. All three are asked.
  const shapes = [
    [band("Band1A"), band("Band2B")],
    ["", band("Band2B")],
    ["function nope() {}\n", "export default function Band2B(){return null}\n"],
    ["// nothing\n", "// nothing\n", "// nothing\n"],
  ];
  for (const [n, sources] of shapes.entries()) {
    const bands = sources.map((s, i) => ({ name: bandName("Band " + i, i), line: "l" + i, source: s }));
    const { source, parts } = assembleBands({ route: "/", chrome: CHROME, bands });
    for (const b of bands) {
      assert.match(source, new RegExp("<" + b.name + " />"), "shape " + n + ": " + b.name + " is not composed");
      const m = new RegExp("import " + b.name + ' from "@/routes/-parts/([a-z0-9-]+)"').exec(source);
      assert.ok(m, "shape " + n + ": " + b.name + " is composed and never imported");
      const file = parts.find((p) => p.name === m[1]);
      assert.ok(file, "shape " + n + ": " + b.name + " is imported from " + m[1] + ", which no file answers");
      assert.match(file.source, new RegExp("function " + b.name + "\\("), "shape " + n + ": " + m[1] + " does not declare " + b.name);
      assert.match(file.source, new RegExp("export default " + b.name + ";"), "shape " + n + ": " + m[1] + " does not export " + b.name);
    }
    // AND NO FILE IS ORPHANED. A part in the list that the page never imports is
    // a component nobody will ever see — the failure `tsxDirective` warns about
    // for a declared component, and it would arrive here silently.
    assert.equal(parts.length, bands.length, "shape " + n + ": a band file has no band");
  }
});

test("DRIVEN: each band keeps its OWN imports, and the shell carries exactly one line per band", () => {
  // INVERTED DELIBERATELY 2026-09-11. This case used to assert that three bands
  // importing `Button` produced ONE import — the cross-band merge, which was the
  // wall against run 90's duplicate-declaration failure in the bundler. That
  // merge is gone because the collision it prevented is gone: each band is its
  // own module, so the repeats can no longer meet. Asserting the merge now would
  // report the change as a regression; what IS the property is that every band
  // still gets what it imported, in its own file, and that the SHELL — whose
  // imports this function writes itself — is still deduped.
  const names = ["Band1A", "Band2B", "Band3C"];
  const { source, parts } = assembleBands({
    route: "/", chrome: CHROME,
    bands: names.map((n) => ({ name: n, line: n, source: band(n) })),
  });
  for (const need of SHELL_IMPORTS) assert.ok(source.includes(need), "the shell's own import is missing: " + need);
  const count = (s, re) => (s.match(re) || []).length;
  assert.equal(count(source, /import \{ createFileRoute \}/g), 1, "the shell's own import was duplicated");
  assert.equal(count(source, /@\/routes\/-parts\//g), names.length, "the shell does not import exactly one file per band");
  // Each band kept what IT imported — nothing was hoisted away from it into a
  // shared header, which would leave the band's own file unable to compile.
  for (const p of parts) {
    assert.equal(count(p.source, /import \{ Button \}/g), 1, p.name + " lost or repeated its Button import");
    assert.equal(count(p.source, /import \{ useState \}/g), 1, p.name + " lost or repeated its useState import");
  }
  // The page itself imports NONE of the bands' own dependencies — that is the
  // whole of what "separate files" buys, and a hoist back into the shell would
  // be invisible without this.
  assert.ok(!source.includes("import { Button }"), "a band's own import was hoisted into the page");
});

test("assembleBands survives junk without throwing", () => {
  for (const bands of [null, undefined, [], [null], [{}], [{ name: "" }], "nope", 7])
    assert.doesNotThrow(() => assembleBands({ route: "/", chrome: CHROME, bands }), "threw on " + JSON.stringify(bands));
  assert.match(assembleBands({ route: "/", chrome: CHROME, bands: [] }).source, /createFileRoute/);
});

// ── THE PARSE, OVER REAL PAGES ──────────────────────────────────────────────

test("THE CORPUS: bands cut from real generated pages assemble into TSX that PARSES", () => {
  // A CHAIN ASSERTED BY READING IS ASSERTED AT THE LAYER BELOW THE BREAK — the
  // recorded trap, and the reason this case exists. Every assertion above is a
  // claim about text. Only the template's own TypeScript answers the question
  // that matters, and only real pages are honest material: a hand-typed band is
  // a second copy of what a band looks like, and copies drift from the producer.
  //
  // Each corpus page becomes ONE band — its imports and its component, renamed
  // — so three bands are three genuinely different real pages colliding on
  // their imports, which is the hardest case the merge will ever see.
  const req = createRequire(new URL("../builder/lovable/template/package.json", import.meta.url));
  let ts = null;
  try { ts = req("typescript"); } catch { ts = null; }
  if (!ts) { try { ts = createRequire(import.meta.url)("typescript"); } catch { ts = null; } }
  assert.ok(ts, "neither the kit's nor the root's TypeScript is installed — this guard cannot run");
  const errs = (src) =>
    (ts.transpileModule(src, { reportDiagnostics: true, fileName: "x.tsx", compilerOptions: { jsx: ts.JsxEmit.Preserve } }).diagnostics || [])
      .filter((d) => d.category === ts.DiagnosticCategory.Error);

  // A real page, as one band: the Route line removed (the shell writes it) and
  // the page component renamed to the band's assigned name.
  const asBand = (src, name) =>
    src
      .replace(/^export const Route[\s\S]*?\}\);?\s*$/m, "")
      .replace(/^export default function\s+[A-Za-z_$][\w$]*\s*\(/m, "function " + name + "(")
      .replace(/^function\s+[A-Za-z_$][\w$]*\s*\(\s*\)\s*\{/m, "function " + name + "() {");

  const pages = [];
  for (const site of fs.readdirSync(CORPUS_DIR)) {
    const sd = path.join(CORPUS_DIR, site);
    if (!fs.statSync(sd).isDirectory()) continue;
    for (const f of fs.readdirSync(sd)) if (f.endsWith(".tsx")) pages.push(path.join(sd, f));
  }
  assert.ok(pages.length >= 300, "the corpus scan found only " + pages.length + " pages — it has drifted");

  let built = 0;
  const broke = [];
  // Threes, walking the whole corpus, so every page is used and each group is
  // three different sites' imports meeting in one file.
  for (let i = 0; i + 2 < pages.length; i += 3) {
    const group = [pages[i], pages[i + 1], pages[i + 2]];
    const bands = group.map((p, n) => {
      const name = bandName("Band from " + path.basename(path.dirname(p)), n);
      const src = fs.readFileSync(p, "utf8");
      return { name, line: path.basename(p), source: asBand(src, name), clean: errs(src).length === 0 };
    });
    // A corpus page that does not parse on its own cannot be evidence about the
    // assembler — the observer has to be alive before an absence means anything.
    if (bands.some((b) => !b.clean)) continue;
    const { source, parts, refused } = assembleBands({ route: "/", chrome: CHROME, bands });
    built++;
    // EVERY FILE, NOT JUST THE PAGE — re-anchored 2026-09-11, and without this
    // the case would have quietly stopped being evidence. It used to parse one
    // concatenated file holding all three real pages; the shell it parses now is
    // a handful of imports and a composition, which would pass whatever the
    // bands contained. The real source moved into the parts, so the parse has to
    // follow it there or the corpus is scanned and never read.
    const files = [["index.tsx", source], ...parts.map((p) => ["-parts/" + p.name + ".tsx", p.source])];
    for (const [name, text] of files) {
      const bad = errs(text);
      if (!bad.length) continue;
      broke.push(group.map((p) => path.relative(CORPUS_DIR, p)).join(" + ") + " → " + name + ": " +
        bad.slice(0, 2).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join(" | ") +
        (refused.length ? "  [refused: " + refused.map((r) => r.name).join(",") + "]" : ""));
    }
    // AND THE BAND FILES ARE WHERE THE SOURCE WENT. A group of three clean
    // bands must produce three files; anything less means a band was dropped
    // and the parse above was reading an empty shell.
    assert.equal(parts.length, bands.length, "a band produced no file");
  }
  assert.ok(built >= 80, "only " + built + " pages were assembled — the scan is not exercising the assembler");
  assert.deepEqual(broke.slice(0, 5), [], built + " groups assembled, " + broke.length + " produced TSX that does not parse");
});

// ── WHAT ONE AGENT IS ASKED ─────────────────────────────────────────────────

const SPEC_NONE = { tables: [] };
const SPEC_DB = { tables: [{ name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] }] };
const LINES = ["Hero: book a lesson", "What we teach", "Prices", "Where to find us"];
const ask = (over = {}) => bandRequest({
  brief: "A guitar school in Sheffield.", spec: SPEC_NONE, brand: "Crookes Guitar School",
  lines: LINES, index: 1, name: "Band2What", kind: "shopfront", ...over,
});
const textOf = (req) => (typeof req.messages[0].content === "string"
  ? req.messages[0].content
  : req.messages[0].content.find((b) => b.type === "text").text);

test("DRIVEN: the tool has ONE property — there is nowhere to put a name or a route", () => {
  // THE WALL RATHER THAN THE RULE. A band writer that could answer its own name
  // would eventually answer one, and the assembler would be arbitrating between
  // that and the name we assigned — on eight calls at once, where the two that
  // disagree are the two that collide.
  assert.equal(BAND_TOOL.name, "write_band");
  assert.deepEqual(Object.keys(BAND_TOOL.input_schema.properties), ["source"]);
  assert.deepEqual(BAND_TOOL.input_schema.required, ["source"]);
  for (const forbidden of ["name", "path", "route", "pages", "parts"]) {
    assert.ok(!Object.hasOwn(BAND_TOOL.input_schema.properties, forbidden),
      "the band tool answers `" + forbidden + "` — the assembler would have to arbitrate");
  }
});

test("DRIVEN: the plan marks the band being written, and only that one", () => {
  const marked = bandPlan(LINES, 2).split("\n");
  assert.equal(marked.length, 4);
  assert.equal(marked.filter((l) => l.includes("YOURS")).length, 1, "more than one band is marked as ours");
  assert.ok(marked[2].includes("YOURS"), "the mark is on the wrong band: " + marked[2]);
  assert.ok(marked[2].startsWith("3. Prices"), "the plan is not numbered in the design's order");
  // An index nothing matches marks NOTHING rather than the first — a band told
  // "yours is the hero" when it is band 4 writes the hero, and so does band 1.
  assert.equal(bandPlan(LINES, -1).includes("YOURS"), false);
  assert.equal(bandPlan(LINES, 99).includes("YOURS"), false);
});

test("DRIVEN: the prompt names THIS band, shows the whole page, and shows no source", () => {
  const t = textOf(ask());
  // THE BRIEF, which nothing asserted until a sweep dropped it and every case
  // here still passed — a band writing for no business at all, from a prompt
  // that still named the band, the plan and every rule. The most ordinary gap
  // there is: the guard tested what the change added and not what it carried.
  assert.match(t, /\nBRIEF\nA guitar school in Sheffield\./);
  assert.ok(textOf(ask({ brief: "A laundrette in Hull." })).includes("A laundrette in Hull."),
    "the brief is not the caller's — the band is writing for a fixture");
  assert.match(t, /THE SITE IS CALLED\nCrookes Guitar School/);
  assert.match(t, /YOURS IS Band2What/);
  assert.match(t, /function Band2What\(\)/);
  for (const line of LINES) assert.ok(t.includes(line), "the plan is missing the band `" + line + "`");
  assert.match(t, /at the same time by someone else/,
    "the prompt does not say the neighbours are being written now — band 3 will write its own hero");
  assert.match(t, /do not close the page/);
  // A NEIGHBOUR'S SOURCE CANNOT BE SHOWN AND MUST NOT BE PROMISED: there is none
  // yet. The plan lines are the whole of what a band knows about its neighbours.
  assert.doesNotMatch(t, /the other bands' (source|code)/i);
});

test("DRIVEN: the schema clause tells the truth about a site with no database", () => {
  // The page call's own wording, and the reason it is that wording: "a schema
  // that came out empty" reads as an omission to fill.
  assert.match(textOf(ask()), /There is none, and that is the design/);
  const withDb = textOf(ask({ spec: SPEC_DB }));
  assert.match(withDb, /THE SCHEMA THAT EXISTS/);
  assert.ok(withDb.includes("bookings"), "a site WITH a database is not shown its own tables");
  assert.doesNotMatch(withDb, /There is none, and that is the design/);
});

test("DRIVEN: the rule the prompt states is the rule bandProblems enforces", () => {
  // TIED, rather than described twice. The prompt is what a model reads and
  // `bandProblems` is what refuses the answer — so a prompt that asked for
  // something the checker refuses would stub every band, and a checker that
  // refused something the prompt allows would do the same. The three shapes the
  // prompt forbids are each driven through the checker here.
  const t = textOf(ask());
  assert.match(t, /EXACTLY ONE top-level declaration/);
  assert.match(t, /No `export` of any kind, and no `createFileRoute`/);
  assert.match(t, /A helper goes INSIDE Band2What/);

  const one = "function Band2What() {\n  const fmt = (n) => n;\n  return <section>{fmt(1)}</section>;\n}";
  assert.deepEqual(bandProblems("Band2What", one), [], "the shape the prompt ASKS for is refused");
  const helperOutside = "function fmt(n) { return n; }\n" + one;
  assert.ok(bandProblems("Band2What", helperOutside).length, "a top-level helper is allowed after all");
  assert.ok(bandProblems("Band2What", "export " + one).length, "an export is allowed after all");
});

test("DRIVEN: the cached system block IS the page call's own, by identity", () => {
  // THE SINGLE MOST VALUABLE DECISION IN THIS REQUEST. A band-specific rules
  // block would be a second copy of ~27,000 tokens of rules AND a cold prefix
  // per build; sharing it means eight calls read one that every ordinary build
  // has already made warm.
  //
  // Asserted by IDENTITY against the real function rather than by matching a
  // fragment: a copy that starts the same and drifts later would pass a
  // fragment match and be a second cache entry from the first byte that differs.
  for (const [spec, kind] of [[SPEC_NONE, "shopfront"], [SPEC_NONE, "tool"], [SPEC_DB, "shopfront"], [SPEC_DB, "tool"]]) {
    const req = bandRequest({ brief: "b", spec, brand: "B", lines: LINES, index: 0, name: "Band1Hero", kind });
    assert.equal(req.system.length, 1);
    assert.equal(req.system[0].text, pageRulesFor(spec, kind),
      "the band's rules are not the page call's for spec/kind — a second cached prefix");
    assert.deepEqual(req.system[0].cache_control, { type: "ephemeral" }, "the rules block is not cached");
  }
});

test("DRIVEN: the ceiling is the page call's, and the tool is forced", () => {
  const req = ask();
  // Not a smaller number sized to one band: max_tokens is a CEILING, not a
  // reservation, so a tight one buys only a cheaper failure — and a truncated
  // tool_use block is a whole band lost after being paid for.
  assert.equal(req.max_tokens, SITE_PAGES_MAX_TOKENS);
  assert.deepEqual(req.tools, [BAND_TOOL]);
  assert.deepEqual(req.tool_choice, { type: "tool", name: "write_band" });
});

test("DRIVEN: the model is the picker's, and the fallback is the shared table's", () => {
  assert.equal(ask({ model: "grok-4.6-fast" }).model, "grok-4.6-fast");
  // Never a bare string here — a fourth copy of a model id is a fourth place
  // for it to go stale, which is `pagesRequest`'s own rule.
  assert.equal(ask({ model: undefined }).model, modelsFor().pages);
  assert.equal(ask({ model: "" }).model, modelsFor().pages);
});

test("DRIVEN: attachments ride the user message, before the text", () => {
  const img = { type: "image", source: { type: "base64", media_type: "image/png", data: "x" } };
  // With none the content stays a plain STRING — the shape every caller and
  // every existing test already sees, so the feature changes no request that
  // does not use it.
  assert.equal(typeof ask().messages[0].content, "string");
  const req = ask({ attachments: [img, null, undefined] });
  assert.ok(Array.isArray(req.messages[0].content));
  assert.equal(req.messages[0].content.length, 2, "a falsy attachment was not filtered out");
  assert.equal(req.messages[0].content[0], img, "the attachment is not first — the prompt says 'above this text'");
  assert.equal(req.messages[0].content[1].type, "text");
  // The cached prefix must be untouched by an attachment, or every build with a
  // picture is a cache miss on the whole rules block.
  assert.equal(req.system[0].text, ask().system[0].text);
});

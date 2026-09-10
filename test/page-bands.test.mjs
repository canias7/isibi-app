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
} from "../builder/page-bands.mjs";
import { MAX_SECTIONS } from "../builder/site-plan.mjs";

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

test("DRIVEN: a refused band is STUBBED, never dropped", () => {
  // A dropped band leaves the shell composing a name nothing declares, which
  // does not compile — the whole-page failure, arriving one line later than the
  // band's own. Salvage's precedent: a page missing one band beats no page.
  const { source, refused } = assembleBands({
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
  assert.match(source, /function Band2Bad\(\)/, "the refused band has no declaration — the page cannot compile");
  assert.ok(!source.includes("function helper"), "the refused band's helper reached the file");
});

test("EVERY NAME THE SHELL COMPOSES IS DECLARED — the invariant, over every shape", () => {
  // The one property that decides whether a page compiles at all, asserted over
  // clean bands, refused bands, and a band that answered nothing.
  const shapes = [
    [band("Band1A"), band("Band2B")],
    ["", band("Band2B")],
    ["function nope() {}\n", "export default function Band2B(){return null}\n"],
    ["// nothing\n", "// nothing\n", "// nothing\n"],
  ];
  for (const [n, sources] of shapes.entries()) {
    const bands = sources.map((s, i) => ({ name: bandName("Band " + i, i), line: "l" + i, source: s }));
    const { source } = assembleBands({ route: "/", chrome: CHROME, bands });
    for (const b of bands) {
      assert.match(source, new RegExp("<" + b.name + " />"), "shape " + n + ": " + b.name + " is not composed");
      assert.match(source, new RegExp("function " + b.name + "\\("), "shape " + n + ": " + b.name + " is composed and never declared");
    }
  }
});

test("DRIVEN: the imports are merged, and the shell's own two are always there", () => {
  const { source } = assembleBands({
    route: "/", chrome: CHROME,
    bands: ["Band1A", "Band2B", "Band3C"].map((n) => ({ name: n, line: n, source: band(n) })),
  });
  for (const need of SHELL_IMPORTS) assert.ok(source.includes(need), "the shell's own import is missing: " + need);
  // Three bands each imported Button and useState. A repeated import is what
  // killed run 90's build in the bundler; `dedupeImports` is the wall and this
  // is it doing the job it was built for.
  const count = (re) => (source.match(re) || []).length;
  assert.equal(count(/import \{ Button \}/g), 1, "Button was imported more than once");
  assert.equal(count(/import \{ useState \}/g), 1, "useState was imported more than once");
  assert.equal(count(/import \{ createFileRoute \}/g), 1, "the shell's own import was duplicated");
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
    const { source, refused } = assembleBands({ route: "/", chrome: CHROME, bands });
    built++;
    const bad = errs(source);
    if (bad.length) {
      broke.push(group.map((p) => path.relative(CORPUS_DIR, p)).join(" + ") + " → " +
        bad.slice(0, 2).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join(" | ") +
        (refused.length ? "  [refused: " + refused.map((r) => r.name).join(",") + "]" : ""));
    }
  }
  assert.ok(built >= 80, "only " + built + " pages were assembled — the scan is not exercising the assembler");
  assert.deepEqual(broke.slice(0, 5), [], built + " groups assembled, " + broke.length + " produced TSX that does not parse");
});

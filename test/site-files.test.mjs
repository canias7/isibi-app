// ONE EDITABLE VIEW: THE PAGES AND THE SITE'S OWN COMPONENTS (2026-09-11).
//
// The band split gives every section its own file under `-parts/`, so the prose
// a customer asks to change no longer lives in the page. `site-tweak.mjs` and
// `site-apply.mjs` contain ZERO references to `parts` — read them — so the two
// cheapest rungs were handed page source only, and after the split a `text` lane
// reading `pages` alone would look at a shell of imports, match none of the
// words and escalate a one-credit wording change to the full page rewrite. Every
// time.
//
// `editableFiles` presents a part with a path, which is all `textItems` and
// `applyEdits` ever look at — neither interprets one — so the rungs are
// unchanged and the mapping lives in one file. What these guards hold:
//
//   • the round trip is an IDENTITY, because a component that came back as a
//     page would be counted against the page cap and published in sitemap.xml;
//   • a page that merely looks like a part is not one;
//   • and the whole point, DRIVEN through the real rung: an edit reaches a
//     separated section and changes it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { editableFiles, splitEditable, partPath, partNameOf, PART_DIR, codeOnly, importSpecs, importsPart, partUse, partUses } from "../builder/site-files.mjs";
import { codeOnly as pictureCodeOnly } from "../builder/site-picture.mjs";
import { runTextEdit, textItems } from "../builder/site-apply.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = fs.readFileSync(path.join(here, "../worker.js"), "utf8");

test("the round trip is an identity — a component never comes back as a page", () => {
  // THE CONTRACT. `applyEdits` rebuilds every entry as `{path, source}` twice on
  // the way through, so anything but the path would not survive the trip this
  // function exists to complete — which is why the name is read back OFF the
  // path rather than carried beside it.
  const pages = [{ path: "index.tsx", source: "SHELL" }, { path: "menu.tsx", source: "MENU" }];
  const parts = [{ name: "band-1-hero", source: "HERO" }, { name: "tide-window-chart", source: "CHART" }];
  const files = editableFiles(pages, parts);
  assert.deepEqual(files.map((f) => f.path), ["index.tsx", "menu.tsx", "-parts/band-1-hero.tsx", "-parts/tide-window-chart.tsx"]);
  assert.deepEqual(splitEditable(files), { pages, parts }, "the two stores did not come back as they went in");
  // PAGES FIRST, AND IT IS LOAD-BEARING: `textItems` stops one past
  // MAX_TEXT_ITEMS, so a long component listed first could push every page
  // string past the cap and send an ordinary site to the expensive lane.
  assert.ok(files.findIndex((f) => f.path.startsWith(PART_DIR)) > files.findIndex((f) => !f.path.startsWith(PART_DIR)),
    "a component is listed before a page");
  // Empty in, empty out — and junk never invents an entry.
  assert.deepEqual(splitEditable(editableFiles([], [])), { pages: [], parts: [] });
  for (const junk of [null, undefined, "x", 7, [null], [{}], [{ path: 1 }], [{ source: "s" }]]) {
    assert.doesNotThrow(() => editableFiles(junk, junk), JSON.stringify(junk));
    assert.deepEqual(editableFiles(junk, junk), [], JSON.stringify(junk) + " produced an entry");
    assert.deepEqual(splitEditable(junk), { pages: [], parts: [] }, JSON.stringify(junk));
  }
});

test("a page that merely LOOKS like a component is not one", () => {
  // ANCHORED AND SUFFIXED, never a substring test. A page really called
  // `my-parts/x.tsx` read as a component would be filed into `parts.json` and
  // drop off the site — and it would be the edit that did it, silently.
  assert.equal(partNameOf("-parts/x.tsx"), "x");
  assert.equal(partNameOf("my-parts/x.tsx"), "", "a page whose name ends in the directory's was read as a component");
  assert.equal(partNameOf("-parts/x.ts"), "", "a file that is not .tsx was read as a component");
  assert.equal(partNameOf("-parts/x"), "");
  // AND A REALISTIC NAME, because the two short ones above cannot tell the
  // suffix check from its absence — MEASURED: `"-parts/x.ts".slice(7, -4)` is
  // `""` under both readings, so the fixture agreed with itself and a mutant
  // that deleted the `.endsWith(".tsx")` test survived every case in this file.
  // At a real length the two diverge: without the check `-parts/hero-band.ts`
  // answers `"hero-ban"` — a component filed under a mangled name, one
  // character short, which round-trips back as a file the page never imports.
  assert.equal(partNameOf("-parts/hero-band.ts"), "",
    "a .ts file under the parts directory was read as a component with a truncated name");
  assert.equal(partNameOf("-parts/styles.css"), "", "a stylesheet under the parts directory was read as a component");
  assert.equal(partNameOf("-parts/band-1-hero.tsx"), "band-1-hero", "a real part name did not survive the read");
  assert.equal(partNameOf("index.tsx"), "");
  for (const junk of [null, undefined, 7, ["-parts/x.tsx"], {}]) assert.equal(partNameOf(junk), "", JSON.stringify(junk));
  // A NAME THAT CANNOT MAKE A PATH MAKES NONE, and `editableFiles` then drops the
  // entry rather than inventing one: a file that cannot round-trip must never
  // enter a list whose whole contract is that it does.
  assert.equal(partPath("  "), "");
  assert.equal(partPath(""), "");
  assert.equal(partPath(null), "");
  assert.deepEqual(editableFiles([], [{ name: "   ", source: "S" }]), [], "a nameless component was given an invented path");
});

test("DRIVEN: a text edit reaches a separated section and changes it", async () => {
  // THE WHOLE REASON THIS MODULE EXISTS, run through the REAL rung rather than
  // asserted about it. A shell that imports its sections, and the words in the
  // sections — which is what every split build now stores.
  const pages = [{ path: "index.tsx", source:
    'import Band1Hero from "@/routes/-parts/band-1-hero";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' +
    'function P() { return <SiteChrome name="Saltmarsh Kayak Co"><Band1Hero /></SiteChrome>; }' }];
  const parts = [
    { name: "band-1-hero", source: 'function Band1Hero() { return <Hero title="Half day 45" />; }\n\nexport default Band1Hero;' },
    { name: "band-3-prices", source: 'function Band3Prices() { return <Card>Half day 45</Card>; }\n\nexport default Band3Prices;' },
  ];
  const files = editableFiles(pages, parts);

  // THE LANE CAN SEE THEM AT ALL — the half that was broken. Reading `pages`
  // alone here answers one string, the site's name, and nothing a customer asks
  // to change.
  const items = textItems(files);
  const seen = items.map((i) => i.path);
  assert.ok(seen.includes("-parts/band-1-hero.tsx") && seen.includes("-parts/band-3-prices.tsx"),
    "the words in a separated section are invisible to the text lane");
  assert.equal(textItems(pages).length, 1, "the control: reading pages alone sees only the shell");

  const targets = items.filter((i) => i.text.includes("45"));
  assert.equal(targets.length, 2, "the fixture no longer has the string in two components");
  const out = await runTextEdit({
    send: async () => ({
      content: [{ type: "tool_use", input: { edits: targets.map((t) => ({ id: items.indexOf(t), to: t.text.replace("45", "52") })) } }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  }, { instruction: "change the half day price to 52", pages: files, model: "grok-4.6" });

  assert.ok(out.ok !== false, "the text lane refused a change it could see: " + JSON.stringify(out));
  assert.equal(out.applied, 2, "only one of the two components was edited");
  const back = splitEditable(out.pages);
  assert.equal(back.pages.length, 1, "a component came back as a page");
  assert.equal(back.parts.length, 2, "a component was lost on the way back");
  for (const p of back.parts) {
    assert.ok(p.source.includes("52"), p.name + " was not edited");
    assert.ok(!p.source.includes("45"), p.name + " kept the old words");
  }
  // AND THE PAGE IS UNTOUCHED: a rung that rewrote the shell while editing a
  // section would take the site's own composition with it.
  assert.equal(back.pages[0].source, pages[0].source, "the page moved on an edit that was not about it");
});

test("the text lane reads BOTH stores, and both halves are published", () => {
  // A CHAIN ASSERTED AT THE LAYER BELOW THE BREAK is this repository's most
  // expensive recorded shape, so the two hops that carry the parts into and out
  // of the rung are read where they happen.
  const at = WORKER.indexOf('if (eLayer === "text") {');
  assert.ok(at > 0, "the text lane is gone");
  // LANDMARK TO LANDMARK, never a byte window, and the closing one is the NEXT
  // lane rather than a name that happens to sit below: `picture` is not the next
  // branch, `look` is, and windowing to an absent landmark gives `slice(a, -1)`
  // — the whole rest of the file, which passes on anything.
  const end = WORKER.indexOf('if (eLayer === "look"', at);
  assert.ok(end > at, "the lane after `text` moved — re-derive the closing landmark");
  const lane = WORKER.slice(at, end);
  assert.ok(lane.length > 200 && lane.length < 8000, "re-derive this window");
  assert.match(lane, /editableFiles\(eSrc, eParts\)/, "the lane no longer shows the rung the site's components");
  assert.match(lane, /loadSiteParts\(env, ownerSlug\)/, "the lane never reads the components");
  assert.match(lane, /splitEditable\(out\.pages\)/, "what came back is published without being split — a component would be stored as a page");
  // BOTH HALVES TO THE PUBLISH, and the parts EVERY time rather than only when
  // one changed: `recompileAndPublish` stores the list it is handed, so handing
  // it the changed ones alone would take every untouched component off the site.
  assert.match(lane, /pages: eSplit\.pages, parts: eSplit\.parts/, "the publish is handed one half of the source");
});

test("`loadSiteSourceForEdit` answers the PAGES, and every rung that needs the components reads them itself", () => {
  // RE-ANCHORED 2026-09-13, and the spelling that moved is named: this case used
  // to assert a SIBLING — `loadEditableFiles`, "the whole source a job is about
  // to edit" — existed beside this one and read both stores. That sibling had no
  // callers on any path (the dead-code census: zero references in the ship set,
  // in config and in scripts) and went with the rest of the dead declarations, so
  // the property is now the simpler one it always rested on: this function is
  // named for the whole and answers the PAGES, and a rung that needs the site's
  // own components asks `loadSiteParts` where it needs them (the text lane's case
  // above proves that hop for the lane that has it).
  const at = WORKER.indexOf("async function loadSiteSourceForEdit(env, slug) {");
  assert.ok(at > 0, "the pages reader moved — re-derive this landmark");
  const body = WORKER.slice(at, WORKER.indexOf("\n}", at));
  // ONE REPAIR, AND IT IS HERE: `ensureEditableState` is what puts a copy one
  // version behind the live site back from that version's own state, and it
  // covers BOTH stores in a single pass — which is why a second whole-source
  // reader asking for it again was never needed.
  assert.match(body, /ensureEditableState\(env, slug\)/, "the read no longer repairs the editable copy first");
  assert.match(body, /return loadSiteSource\(env, slug\)/, "it answers something other than the stored pages");
  assert.ok(!body.includes("loadSiteParts"), "it reads the components too — then it is the whole-source reader under a name that says half");
  // THE OBSERVER IS PROVED ALIVE BEFORE THE ABSENCE: the landmark above must be
  // findable for this to mean anything, and `loadSiteParts` must still exist
  // somewhere, or "not in this body" is true of a name nothing has.
  assert.match(WORKER, /async function loadSiteParts\(/, "the components reader is gone — this absence check is vacuous");
  assert.ok(!WORKER.includes("loadEditableFiles"), "the callerless whole-source reader is back; it was deleted with the dead set");
});

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORT EVIDENCE, AND THE PLACEMENT QUESTION UNDER IT (2026-09-20)

   Owner: *"importsPart matches commented-out imports… Exclude comments and
   quoted examples from import evidence. An unused import must not establish
   placement. Where placement cannot be established, preserve uncertainty."*

   DRIVEN AT THE MODULE BECAUSE THE ROUTE CANNOT REACH EVERY SHAPE. A namespace
   import, a dynamic one, a `require`, a clause spread over four lines and an
   identifier holding a regex metacharacter are all things these functions are
   exported and handed; `validatePages` stops most of them ever arriving through
   the product, which is exactly why they need a guard where they live.
   ═════════════════════════════════════════════════════════════════════════ */

const SPEC = "@/routes/-parts/photo-wall";

test("codeOnly is one function, shared with the picture reader", () => {
  // ⚠ IDENTITY, NOT BEHAVIOUR. Two copies of a lexer that agreed today is
  // exactly how a frame counter and an import reader come to disagree about
  // what a comment is next month — the `secretsNeeded` precedent, and the
  // reason this moved rather than forked.
  assert.equal(codeOnly, pictureCodeOnly, "the picture reader has its own copy of the lexer again");
  // …AND THE TWO COPIES IT PRODUCES ARE THE SAME LENGTH, which is what lets an
  // offset found in one be read in the other. Load-bearing here: a specifier's
  // BOUNDARIES come from the masked copy and its VALUE from the plain one.
  const src = "const a = 'x' // '\nconst b = `t${1}`\n/* ' */ const c = \"y\"";
  assert.equal(codeOnly(src).length, src.length, "the plain copy changed length");
  assert.equal(codeOnly(src, true).length, src.length, "the masked copy changed length");
  assert.equal(codeOnly(src, true).includes("x"), false, "a string's contents survived the masking");
  assert.equal(codeOnly(src).includes("x"), true, "the plain copy lost a value the import reader needs");
});

test("an import specifier is a string in an import POSITION, in code", () => {
  const spec = (src) => importSpecs(src).specs.map((m) => m.spec);
  // ── THE POSITIONS THAT ARE IMPORTS ───────────────────────────────────────
  for (const [what, src] of [
    ["from", "import { Band } from '" + SPEC + "'"],
    ["a side-effect import", "import '" + SPEC + "'"],
    ["a dynamic import", "const L = lazy(() => import('" + SPEC + "'))"],
    ["require", "const B = require('" + SPEC + "')"],
    ["an export-from", "export { Band } from '" + SPEC + "'"],
    ["a clause over four lines", "import {\n  Band,\n  Other,\n} from '" + SPEC + "'"],
    ["a double-quoted specifier", 'import { Band } from "' + SPEC + '"'],
  ]) assert.deepEqual(spec(src), [SPEC], what + " was not read as an import: " + src);

  // ── AND THE POSITIONS THAT ARE NOT ───────────────────────────────────────
  for (const [what, src] of [
    ["a line comment", "// import { Band } from '" + SPEC + "'"],
    ["a block comment", "/* import { Band } from '" + SPEC + "' */"],
    ["a jsdoc line", "/**\n * import { Band } from '" + SPEC + "'\n */"],
    ["an assignment", "const hint = \"import { Band } from '" + SPEC + "'\""],
    ["a prop", "<Doc path=\"" + SPEC + "\" />"],
    ["a link", "<a href='" + SPEC + "'>docs</a>"],
    ["a template literal", "const t = `import '" + SPEC + "'`"],
  ]) assert.deepEqual(spec(src), [], what + " was read as an import: " + src);

  // ⚠ THE LINE COMMENT AND THE STRING ARE ONE PASS, in both directions — this
  // repository's recorded trap is a `/*` inside a LINE comment, and its mirror
  // is the `//` in every `href="https://…"` on every page.
  assert.deepEqual(spec("const u = 'https://x/y' // /* \nimport { B } from '" + SPEC + "'"), [SPEC],
    "a url's slashes or a comment's opener swallowed a real import");

  // A SPECIFIER IS COMPARED WHOLE, which is what the substring form could not
  // do: a longer name cannot satisfy a shorter one and no name is a pattern.
  assert.equal(importsPart("import { B } from '" + SPEC + "-2'", "photo-wall", false), false,
    "a longer component name satisfied a shorter one");
  assert.equal(importsPart("import { B } from '@/routes/-parts/qrxcard'", "qr.card", false), false,
    "a name with a regex metacharacter was used as a pattern");
  // …AND AN EXTENSION IS THE SAME MODULE.
  assert.equal(importsPart("import { B } from '" + SPEC + ".tsx'", "photo-wall", false), true,
    "an explicit .tsx stopped resolving");
  // `inPart` IS THE DISCRIMINATOR: from a PAGE, `./x` is another PAGE.
  assert.equal(importsPart("import { C } from './card'", "card", false), false,
    "a page's relative import of a sibling page was read as a component import");
  assert.equal(importsPart("import { C } from './card'", "card", true), true,
    "a component's sibling import stopped resolving");
  // ⚠ A TEMPLATE IS NOT A SPECIFIER, AND THE TRADE IS STATED RATHER THAN
  // ASSUMED. `import(\`…\`)` and `require(\`…\`)` are valid JavaScript, so the
  // text between the backticks CAN be the module — and it can equally be
  // `${dir}/x`, where no reader of the source knows what was imported. Reading
  // it as a specifier would let an interpolation name any component at all;
  // refusing it means a dynamic import of a component is missed, which the
  // withholding cascade reads as "this page does not import it". Refusing is
  // the direction that cannot be wrong about which module is named, and no
  // prompt here teaches a template specifier — every one teaches
  // `@/routes/-parts/<name>`.
  for (const src of [
    "const L = lazy(() => import(`" + SPEC + "`))",
    "const B = require(`" + SPEC + "`)",
    "const t = `import { B } from '" + SPEC + "'`",
  ]) assert.deepEqual(spec(src), [], "a template literal was admitted as a specifier: " + src);

  // THE JUNK SHAPES, since these are exported and take what they are handed.
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.equal(importsPart(bad, "card", true), false, "threw or matched on " + JSON.stringify(bad));
    assert.equal(importsPart("import { C } from './card'", bad, true), false, "threw or matched on name " + JSON.stringify(bad));
  }
});

test("partUse tells a rendered import from a dead one, and says so when it cannot tell", () => {
  const page = (head, body) => "import { createFileRoute } from '@tanstack/react-router'\n" + head + "\n" + body;
  const of = (head, body) => partUse(page(head, body), "photo-wall", false);
  const LIVE = "import { Band } from '" + SPEC + "'";

  assert.equal(of(LIVE, "function P(){ return <Band /> }"), "rendered");
  assert.equal(of(LIVE, "function P(){ return <Band/> }"), "rendered", "a self-closing tag with no space");
  assert.equal(of("import Band from '" + SPEC + "'", "function P(){ return <Band /> }"), "rendered", "a default import");
  assert.equal(of("import { Band as Wall } from '" + SPEC + "'", "function P(){ return <Wall /> }"), "rendered", "an alias");

  // THE ONE DEFINITE NEGATIVE: the clause binds a name and the file never
  // mentions it again. The import statements are blanked before the test, or a
  // binding would always be "mentioned" by its own clause.
  assert.equal(of(LIVE, "function P(){ return <main/> }"), "unused");
  assert.equal(of("import { Band, Other } from '" + SPEC + "'", "<Other/>"), "rendered",
    "one bound name rendering is enough — the module IS on the page");

  // EVERYTHING ELSE IS UNCERTAINTY, and each of these can really reach the page.
  assert.equal(of(LIVE, "const all = [Band]\n{all.map((C) => <C/>)}"), "unsure", "a binding used as a value");
  assert.equal(of("import * as N from '" + SPEC + "'", "<N.Band/>"), "unsure", "a namespace member");
  assert.equal(of("import '" + SPEC + "'", "<main/>"), "unsure", "a side-effect import binds nothing to test");
  assert.equal(of("const L = lazy(() => import('" + SPEC + "'))", "<L/>"), "unsure", "a dynamic import");
  assert.equal(of("export { Band } from '" + SPEC + "'", "<main/>"), "unsure", "a re-export binds no local name");
  // …AND A CLAUSE THIS CANNOT PARSE IS UNCERTAINTY, NOT AN ABSENCE. A piece
  // that is not an identifier means the clause was not understood, so what it
  // binds is unknown — reading the pieces it DID recognise as the whole would
  // turn "we could not read it" into the one definite negative. These are the
  // four shapes MEASURED to separate the two readings, and every one of them
  // is source a model really can write.
  for (const bad of ["1bad", "...rest", "a.b", "a-b"]) {
    assert.equal(of("import { Band, " + bad + " } from '" + SPEC + "'", "<main/>"), "unsure",
      "an unparseable clause (" + bad + ") was read as binding only what it recognised");
  }
  // THE CONTROLS, so the arm above is about the piece it could not read and
  // not about the shape of the clause: a clause it CAN read is still the
  // definite negative, and `default as X` really does bind `X`.
  assert.equal(of("import { Band, Other } from '" + SPEC + "'", "<main/>"), "unused");
  assert.equal(of("import { default as D } from '" + SPEC + "'", "<main/>"), "unused");
  // ⚠ AND ONE SHAPE IS NOT SEEN AS AN IMPORT AT ALL, which is recorded rather
  // than claimed as uncertainty: an arbitrary module export name is valid
  // ES2022 and its QUOTE ends the clause the head pattern is matching, so the
  // specifier is never reached. `none`, not `unsure` — so the withholding
  // cascade would not see that import either. Nothing here writes one.
  assert.equal(of('import { Band, "other-name" as Other } from \'' + SPEC + "'", "<Other/>"), "none",
    "the quoted-export-name limit moved — check `importsPart`'s cascade, not just this answer");

  // ⚠ A `<Band` BETWEEN QUOTES IS TEXT, NOT A PLACEMENT (2026-09-20). Owner:
  // *"Import PhotoWall normally. Set const example = '<PhotoWall/>'. Render
  // {example}… The saved page renders escaped text and zero images. Coverage
  // still becomes configured."* REPRODUCED on all three quoting shapes, each
  // answering `rendered` — byte for byte what the rendered control above
  // answers. `importSpecs` excluded a quoted example by POSITION and this scan
  // searched string contents again, one line further down.
  for (const [what, head, body] of [
    ["a single-quoted example", LIVE + "\nconst example = '<Band />'", "function P(){ return <main>{example}</main> }"],
    ["a double-quoted example", LIVE + '\nconst example = "<Band />"', "function P(){ return <main>{example}</main> }"],
    ["a template example", LIVE + "\nconst example = `<Band />`", "function P(){ return <main>{example}</main> }"],
  ]) {
    assert.equal(of(head, body), "unsure", what + " was read as a placement");
  }
  // …AND REAL JSX SURVIVES THE MASKING, which is the half a naive strip-the-
  // strings-then-search gets wrong: the attribute's CONTENTS go and the
  // element's own opening tag is code either way.
  assert.equal(of(LIVE, 'function P(){ return <Band title="a <Band /> example" /> }'), "rendered",
    "a string attribute on a real element took its own placement with it");
  // ⚠ AND THE MENTION TEST READS THE OTHER COPY, DELIBERATELY. `scanSource`
  // masks a template WHOLE, `${…}` included, so masking both would claim the
  // one definite negative over a file that really does reference the binding —
  // the asymmetry rule above, in the direction that costs the customer a
  // "Still to do" about something on their site.
  assert.equal(of(LIVE + "\nconst el = `${Band}`", "function P(){ return <main>{el}</main> }"), "unsure",
    "a binding referenced in an interpolation was called a definite absence");
  // THE DEFINITE NEGATIVE IS UNMOVED: nothing mentions it anywhere at all.
  assert.equal(of(LIVE + "\nconst example = '<Other />'", "function P(){ return <main>{example}</main> }"), "unused",
    "a string naming something else stopped being an absence");

  // NOT IMPORTED AT ALL IS ITS OWN ANSWER, distinct from all three.
  assert.equal(of("// " + LIVE, "<Band/>"), "none", "a commented import was read as an import");
  assert.equal(partUse("", "photo-wall", false), "none");
  assert.equal(partUse("import { B } from '" + SPEC + "'", "", false), "none", "an empty name matched something");

  // ONE SCAN ANSWERS FOR EVERY CANDIDATE, which is what the walk in
  // `routedSources` calls once per file rather than once per pair.
  const many = partUses(page("import { A } from '@/routes/-parts/a'\nimport { B } from '@/routes/-parts/b'",
    "function P(){ return <A/> }"), ["a", "b", "c"], false);
  assert.equal(many.get("a"), "rendered");
  assert.equal(many.get("b"), "unused");
  assert.equal(many.has("c"), false, "a component nothing imports got an entry");
  assert.deepEqual([...partUses("x", null, false).keys()], [], "junk names threw or answered");
});

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
import { editableFiles, splitEditable, partPath, partNameOf, PART_DIR } from "../builder/site-files.mjs";
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

test("`loadSiteSourceForEdit` is named for a job it does HALF of, and the sibling does the whole", () => {
  // Said out loud rather than quietly fixed: its docblock calls it "THE SOURCE A
  // JOB IS ABOUT TO EDIT" and it answers the PAGES. Its four callers publish
  // what they read and either carry parts already or regenerate them, so the
  // whole-source reader is a sibling rather than a change of shape under them.
  assert.match(WORKER, /async function loadEditableFiles\(env, slug\) \{/, "the whole-source reader is gone");
  const at = WORKER.indexOf("async function loadEditableFiles(env, slug) {");
  const body = WORKER.slice(at, WORKER.indexOf("\n}", at));
  assert.match(body, /loadSiteSourceForEdit\(env, slug\)/, "it does not go through the repair");
  assert.match(body, /loadSiteParts\(env, slug\)/, "it does not read the components");
  // ONE REPAIR, NOT TWO: `ensureEditableState` covers both stores in a single
  // pass, and asking twice would leave a window in which the site could move
  // between the two reads.
  assert.ok(!body.includes("ensureEditableState"), "it repairs a second time instead of going through the one reader that does");
});

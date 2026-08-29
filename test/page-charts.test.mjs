// THE CHART CATALOGUE IS OFFERED TO THE SITES THAT COULD USE ONE.
//
// Owner, 2026-08-29: "let's get rid of unused stuff — remember that's why the
// design step is there, to not have everything on this step".
//
// The catalogue is 865 component names across 141 domain modules and it was 42%
// of the whole page prompt, sent to every barber shop, cafe and plumber. The
// design step decides `kind` four fields before any of this runs, and a
// `shopfront` — "nearly every brief", in the design step's own words — persuades
// a visitor; it has no readings to plot.
//
// MEASURED AGAINST THE CORPUS, NOT ASSUMED, and the measurement is repeated here
// rather than quoted: a number in a comment is a claim, and this one decides
// whether a capability is being taken away from sites that use it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";
import { pagesRequest, pageRulesFor, withoutCharts, PAGE_RULES, FRONTEND_PAGE_RULES } from "../builder/page-gen.mjs";

const SPEC_NO_DB = { tables: [], seed: {} };
const SPEC_DB = { tables: [{ name: "bookings", columns: [] }], seed: {} };

/** Every .tsx/.ts under the corpus, which is 324 real generated files. */
function corpusFiles() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(fs.readFileSync(p, "utf8"));
    }
  };
  walk(CORPUS_DIR);
  return out;
}

test("no site in the corpus has ever imported a chart — and the corpus can see them", () => {
  const files = corpusFiles();
  // AN OBSERVER THAT IS ALIVE. A zero over an empty list is not evidence, and
  // "no imports" would also be true of a corpus of blank files. The control is
  // that these same files import the OTHER half of the kit, heavily.
  assert.ok(files.length >= 300, "the corpus shrank to " + files.length + " files — this measurement is no longer about 324 real pages");
  const ui = files.filter((s) => /@\/components\/ui\//.test(s)).length;
  assert.equal(ui, files.length, "only " + ui + " of " + files.length + " files import the kit — this corpus is not generated output");

  const charts = files.filter((s) => /@\/components\/charts\/lib\//.test(s));
  assert.equal(charts.length, 0,
    charts.length + " corpus files import a chart — the catalogue IS used, and gating it on `kind` takes a working capability away");
});

test("a shopfront is not sent the catalogue; a tool is", () => {
  const shop = pagesRequest({ brief: "b", spec: SPEC_NO_DB, brand: "B", model: "x", kind: "shopfront" }).system[0].text;
  const tool = pagesRequest({ brief: "b", spec: SPEC_NO_DB, brand: "B", model: "x", kind: "tool" }).system[0].text;

  assert.ok(!/## Charts/.test(shop), "a shopfront is still handed the chart catalogue");
  assert.ok(/## Charts/.test(tool), "a tool has lost the chart catalogue — the capability is gone, not gated");
  // AND THE SAVING IS REAL, not a heading renamed. Anything under a third means
  // the cut stopped removing the catalogue and started removing a sentence.
  assert.ok(tool.length - shop.length > tool.length / 3,
    "the cut saves only " + (tool.length - shop.length) + " of " + tool.length + " — it is no longer removing the catalogue");
});

test("cannot-tell keeps everything — the safe direction", () => {
  // Only the build path knows `kind`. The edit and addon rungs pass no plan, and
  // a revise of a site whose pages already import a chart must still be told
  // those modules exist. Cannot-tell must never read as "shopfront".
  for (const kind of ["", undefined, null, "unknown", "Shopfront"]) {
    const t = pagesRequest({ brief: "b", spec: SPEC_NO_DB, brand: "B", model: "x", kind }).system[0].text;
    assert.ok(/## Charts/.test(t), "kind " + JSON.stringify(kind) + " dropped the catalogue — only an exact `shopfront` may");
  }
});

test("the cut removes the charts section and nothing else", () => {
  for (const [name, rules] of [["FRONTEND_PAGE_RULES", FRONTEND_PAGE_RULES], ["PAGE_RULES", PAGE_RULES]]) {
    const heads = (t) => t.split("\n").filter((l) => /^## /.test(l));
    const before = heads(rules);
    const after = heads(withoutCharts(rules));
    assert.ok(before.some((h) => /^## Charts/.test(h)), name + " has no charts section — this cut is watching nothing");
    assert.deepEqual(after, before.filter((h) => !/^## Charts/.test(h)),
      name + ": the cut removed a section that is not the catalogue");
    // EVERY OTHER SECTION SURVIVES BYTE FOR BYTE. A window that ran to the wrong
    // landmark would swallow the section after it, and the prompt would still
    // read perfectly — this repo's overlapping-window trap.
    assert.ok(withoutCharts(rules).includes("## The gate"), name + ": the cut swallowed the section after the catalogue");
  }
  // A TEXT WITH NO CATALOGUE COMES BACK WHOLE, rather than being trimmed to
  // nothing by two -1 landmarks.
  assert.equal(withoutCharts("## Hard rules\nx"), "## Hard rules\nx");
});

test("both database variants are gated, so the saving is not frontend-only", () => {
  const shopDb = pageRulesFor(SPEC_DB, "shopfront");
  const toolDb = pageRulesFor(SPEC_DB, "tool");
  assert.ok(!/## Charts/.test(shopDb), "a shopfront WITH a database is still handed the catalogue");
  assert.ok(/## Charts/.test(toolDb), "a tool with a database lost the catalogue");
  // And the with-database variant really is the bigger one, or this test is
  // reading the frontend text under a database spec.
  assert.ok(toolDb.length > pageRulesFor(SPEC_NO_DB, "tool").length,
    "the database variant is not larger — `siteHasTables` is not deciding");
});

test("a shopfront is left with no dangling reference to charts at all", () => {
  // THREE PLACES NAMED CHARTS, not one. Removing the catalogue alone left rule 5
  // explaining which path to import a chart from, and a sentence inside rule 3
  // promising the list "ARE listed in full below, by name" — both now false, and
  // a prompt that sends a model looking for something that is not there is worse
  // than one that never mentioned it: it invites a guess at a module name, and a
  // module that does not exist is a compile error that costs the page.
  const shop = pagesRequest({ brief: "b", spec: SPEC_NO_DB, brand: "B", model: "x", kind: "shopfront" }).system[0].text;
  for (const re of [/charts\/lib/, /chart component/i, /## Charts/, /A CHART COMES FROM/]) {
    assert.ok(!re.test(shop), "a shopfront still refers to charts: " + re);
  }
  // AND THE TOOL KEEPS ALL THREE, or this is a deletion rather than a gate.
  const tool = pagesRequest({ brief: "b", spec: SPEC_NO_DB, brand: "B", model: "x", kind: "tool" }).system[0].text;
  for (const re of [/charts\/lib/, /## Charts/, /A CHART COMES FROM/]) {
    assert.ok(re.test(tool), "a tool lost its chart guidance: " + re);
  }
});

test("the rules stay numbered 1..N with no gap, on both variants", () => {
  // A list that jumps 4 -> 6 reads as an instruction that went missing, and a
  // model asked to follow seven rules it can only find six of has been handed a
  // puzzle instead of a rule.
  for (const kind of ["shopfront", "tool"]) {
    const t = pagesRequest({ brief: "b", spec: SPEC_NO_DB, brand: "B", model: "x", kind }).system[0].text;
    const ns = [...t.matchAll(/^(\d+)\. [A-Z]/gm)].map((m) => Number(m[1]));
    assert.ok(ns.length >= 6, kind + ": found only " + ns.length + " numbered rules — this scan lost its subject");
    assert.deepEqual(ns, ns.map((_, i) => i + 1), kind + ": the numbering has a gap — " + ns.join(","));
  }
});

test("the 72 modules with no signature are named as real, not left unexplained", () => {
  // Rule 3 forbids hand-rolling "a button, input, select, checkbox or dialog"
  // AND says a name in neither list "is one you would be guessing at". Those
  // five are shadcn primitives whose props are typed as
  // `React.ComponentProps<typeof X>`, which the signature scan cannot read — so
  // they had no signature and the two sentences contradicted each other.
  // Measured on the corpus: 9 such modules imported 81 times, every one a guess
  // the prompt had told the model not to make.
  const t = pagesRequest({ brief: "b", spec: SPEC_NO_DB, brand: "B", model: "x", kind: "shopfront" }).system[0].text;
  assert.match(t, /standard shadcn\/ui/i, "the modules with no signature are no longer explained as real");
  assert.match(t, /ComponentProps/, "the prompt no longer says WHY they have no signature, so their absence still reads as absence");
  for (const n of ["button", "input", "select", "checkbox", "dialog"]) {
    assert.ok(t.includes(n), "`" + n + "` is forbidden to hand-roll and never named as available");
  }
});

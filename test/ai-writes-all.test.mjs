// THE FIRST BUILD WRITES EVERYTHING ITSELF (2026-10-23, owner: "the AI should
// write everything, that's the point").
//
// The guards for the owner's decision, each red on the code before it:
//   1. the section cap is ENFORCED where the plan is read, and what did not fit
//      is named in `notBuilt` rather than folded into the last band;
//   2. no kit menu is sent: the first build's design tool carries no
//      `components` and no `tsx`, and no first-build page brief carries the
//      manifest;
//   3. every writer — each band, the header and the footer — is told to write
//      its own components rather than import the kit's;
//   4. the header and the footer are model-written bands beside the page's
//      bands, and the shell draws no `SiteChrome`;
//   5. `notBuilt` and `noDatabase` reach the reply writer's facts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// NAMESPACE IMPORTS, so each case is red on its own on the code before the
// change (a missing export reads undefined there) rather than the whole file
// failing to load.
import * as sitePlan from "../builder/site-plan.mjs";
import * as pageBands from "../builder/page-bands.mjs";
import { briefWithLayout } from "../builder/page-gen.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { DESIGN_GRAPH } from "../builder/design-graph.mjs";
import { DESIGN_WAVES } from "../builder/design-waves.mjs";
import { readSchemaTool } from "./integration/schema-tool.mjs";

const { normalizePlan, withNotBuilt, directiveFromPlan, MAX_SECTIONS, NOT_BUILT_FIELD, COMPONENT_MENU } = sitePlan;
const { bandsOf, bandPrompt, framePrompt, generateSiteBands, OWN_PARTS_RULE, FRAME, slotName, bandMarks, kitImportCount } = pageBands;
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const PAGE = { purpose: "Sell sourdough", pages: [{ path: "/", name: "Home" }] };
const lines9 = Array.from({ length: 9 }, (_, i) => "section " + i + " in the design's own words");

// ── 1. NO SECTION CAP (2026-10-24; a six-band cap 2026-10-23 → 2026-10-24) ──

test("every section the design plans is kept at normalize, and none is moved to notBuilt", () => {
  assert.equal(MAX_SECTIONS, Infinity);
  const p = normalizePlan({ ...PAGE, shape: [{ path: "/", sections: lines9 }] });
  assert.deepEqual(p.shape[0].sections, lines9, "a band the design planned was cut");
  assert.equal(p.notBuilt, undefined, "a planned band was named not built — a cut by another name");
});

test("the design's own notBuilt survives normalize, goes first, and a non-string is refused", () => {
  const p = normalizePlan({ ...PAGE, shape: [{ path: "/", sections: lines9 }], notBuilt: ["a newsletter sign-up", ["coerced"], 7, "  "] });
  assert.deepEqual(p.notBuilt, ["a newsletter sign-up"]);
  const q = withNotBuilt(normalizePlan(PAGE), ["online ordering"]);
  assert.deepEqual(q.notBuilt, ["online ordering"]);
  assert.equal(withNotBuilt(null, ["x"]), null);
  assert.equal(withNotBuilt(normalizePlan(PAGE), null).notBuilt, undefined);
});

test("bandsOf never folds sections into the last band", () => {
  const bands = bandsOf([{ path: "/", sections: lines9 }], "/");
  assert.deepEqual(bands, lines9, "one band per section, every section");
  assert.ok(!bands.some((b) => b.includes(" — then — ")), "sections were folded into one band");
});

test("the page writers are told what is left for later, so none fakes it", () => {
  const d = directiveFromPlan({ ...PAGE, shape: [{ path: "/", sections: ["hero"] }], notBuilt: ["a newsletter sign-up"] });
  assert.match(d, /NOT built/);
  assert.match(d, /- a newsletter sign-up/);
});

// ── 2. NO KIT MENU ────────────────────────────────────────────────────────

test("the first build's design tool sends no kit menu and no custom-part declarations, and asks for notBuilt", async () => {
  const { tool, frontendTool } = await readSchemaTool();
  // PREMISE: the revise tool still has both, so the drop is the first build's.
  assert.ok(tool.input_schema.properties.components && tool.input_schema.properties.tsx, "the premise moved: the full tool lost the kit fields");
  const props = frontendTool.input_schema.properties;
  assert.ok(!("components" in props), "the first build is still sent the kit menu");
  assert.ok(!("tsx" in props), "the first build is still asked for custom parts");
  assert.ok(!frontendTool.input_schema.required.includes("components"), "the first build still compels a kit pick");
  assert.equal(props.notBuilt, NOT_BUILT_FIELD, "the first build is not asked what it leaves out");
  const sent = JSON.stringify(frontendTool);
  assert.ok(COMPONENT_MENU.length > 100, "the premise moved: the kit menu is gone");
  assert.ok(!sent.includes(COMPONENT_MENU.slice(0, 40).join(", ")), "the kit menu still rides in the first build's tool");
});

test("no design agent asks for the kit menu or custom parts, and one answers notBuilt", () => {
  for (const [name, fields] of [["graph", DESIGN_GRAPH.flatMap((a) => a.fields)], ["waves", DESIGN_WAVES.flat().flatMap((a) => a.fields)]]) {
    assert.ok(!fields.includes("components"), name + " still asks for the kit menu");
    assert.ok(!fields.includes("tsx"), name + " still asks for custom parts");
    assert.equal(fields.filter((f) => f === "notBuilt").length, 1, name + " does not answer notBuilt exactly once");
  }
});

test("a first build's page brief carries no component manifest", () => {
  const plan = normalizePlan({ ...PAGE, shape: [{ path: "/", sections: ["hero", "prices"] }] });
  const brief = briefWithLayout({ brief: "A bakery", plan });
  assert.doesNotMatch(brief, /THE COMPONENTS THIS SITE NEEDS/, "the kit manifest reached a first build's writers");
  assert.doesNotMatch(brief, /Reach first for:/);
});

// ── 3. EVERY WRITER WRITES ITS OWN PARTS ──────────────────────────────────

test("a band, the header and the footer are each told to write their own components", () => {
  const args = { brief: "A bakery", spec: {}, brand: "Fold Lane", lines: ["hero", "prices"] };
  const band = bandPrompt({ ...args, index: 0, name: "Band1Hero" });
  assert.ok(band.includes(OWN_PARTS_RULE), "a band is not told to write its own parts");
  assert.doesNotMatch(band, /Use <Section>/, "a band is still told to use the kit's Section");
  assert.match(OWN_PARTS_RULE, /do not import anything from \\?"@\/components\/ui\/\\?"/);
  assert.match(OWN_PARTS_RULE, /semantic tokens/, "the theme foundation is not kept");
  for (const role of ["header", "footer"]) {
    const t = framePrompt({ ...args, chrome: { name: "Fold Lane" }, role });
    assert.ok(t.includes(OWN_PARTS_RULE), "the " + role + " is not told to write its own parts");
    assert.match(t, new RegExp("function " + (role === "header" ? "SiteHeader" : "SiteFooter") + "\\(\\)"));
  }
});

test("the frame is told what is not built and, with no database, never to fake a form", () => {
  const t = framePrompt({ brief: "b", spec: { tables: [] }, brand: "B", lines: [], chrome: { name: "B" }, notBuilt: ["a newsletter sign-up"], role: "footer" });
  assert.match(t, /THIS SITE HAS NO DATABASE/);
  assert.match(t, /- a newsletter sign-up/);
  assert.match(t, /never invent a phone number/i, "the footer may invent contact details");
});

test("kit imports are counted on the row, plumbing excepted", () => {
  assert.equal(kitImportCount([
    { source: 'import { Button } from "@/components/ui/button";\nimport { SafeImage } from "@/components/ui/safe-image";\nfunction A() { return null; }' },
    { source: 'import { Link } from "@tanstack/react-router";\nfunction B() { return null; }' },
  ]), 1);
});

// ── 4. THE HEADER AND FOOTER ARE MODEL-WRITTEN BANDS ──────────────────────

const answer = (source) => ({ content: [{ type: "tool_use", input: { source } }], usage: {} });

test("a website's fan-out writes the header and the footer beside the bands, and draws no SiteChrome", async () => {
  let sent = null;
  const lines = ["hero with the name", "the prices"];
  const out = await generateSiteBands({
    brief: "A bakery", spec: {}, brand: "Fold Lane", model: "m", route: "/", lines,
    chrome: { name: "Fold Lane", tagline: "Sourdough in Leeds" }, actions: ["Order a loaf"], notBuilt: ["online ordering"],
  }, null, async (keys, reqs) => {
    sent = reqs;
    return [
      { i: 0, state: "done", ms: 10, answer: answer("function Band1Hero() { return <section>Fold Lane</section>; }") },
      { i: 1, state: "done", ms: 20, answer: answer("function Band2The() { return <section>£4</section>; }") },
      { i: 2, state: "done", ms: 30, answer: answer("function SiteHeader() { return <header>Fold Lane</header>; }") },
      { i: 3, state: "done", ms: 40, answer: answer("function SiteFooter() { return <footer>Leeds</footer>; }") },
    ];
  });
  assert.equal(sent.length, lines.length + FRAME.length, "the header and the footer were not asked for");
  const texts = sent.map((r) => r.messages[0].content);
  assert.match(texts[2], /Write the site's HEADER/);
  assert.match(texts[3], /Write the site's FOOTER/);
  assert.match(texts[2], /"Order a loaf"/, "the header is not told the primary action");
  assert.match(texts[3], /online ordering/, "the footer is not told what is not built");
  const src = out.input.pages[0].source;
  assert.doesNotMatch(src, /SiteChrome/, "the fixed chrome template is still drawn");
  assert.match(src, /<SiteHeader \/>[\s\S]*<Band1Hero \/>[\s\S]*<Band2The \/>[\s\S]*<SiteFooter \/>/);
  const files = out.input.parts.map((p) => p.name);
  assert.ok(files.includes("site-header") && files.includes("site-footer"), "the frame did not become its own files");
  assert.equal(out.frame, 2);
  assert.equal(out.wroteFrame, 2);
  assert.deepEqual(out.eachMs, { b1: 10, b2: 20, c1: 30, c2: 40 }, "the frame's time is not filed under its own slot");
  const m = bandMarks(out);
  assert.equal(m.c1Ms, 30);
  assert.equal(m.wroteFrame, 2);
});

test("a frame writer that fails leaves a stub, never a page that imports nothing", async () => {
  const out = await generateSiteBands({ brief: "b", spec: {}, brand: "B", model: "m", route: "/", lines: ["hero", "prices"], chrome: { name: "B" } },
    null, async () => [
      { i: 0, state: "done", answer: answer("function Band1Hero() { return <section/>; }") },
      { i: 1, state: "done", answer: answer("function Band2Prices() { return <section/>; }") },
      { i: 2, state: "failed", message: "no" },
    ]);
  const header = out.input.parts.find((p) => p.name === "site-header");
  assert.ok(header && /function SiteHeader\(\)/.test(header.source) && /export default SiteHeader;/.test(header.source));
  assert.equal(out.wroteFrame, 0);
});

test("a phone app keeps AppChrome and writes no frame", async () => {
  let n = 0;
  const out = await generateSiteBands({ brief: "b", spec: { surface: "app" }, brand: "B", model: "m", route: "/", lines: ["a", "b"], chrome: { name: "B" } },
    null, async (keys, reqs) => { n = reqs.length; return reqs.map((r, i) => ({ i, state: "done", answer: answer("function Band" + (i + 1) + (i ? "B" : "A") + "() { return null; }") })); });
  assert.equal(n, 2);
  assert.match(out.input.pages[0].source, /AppChrome/);
  assert.equal(slotName(2, 2, 2), "c1");
  assert.equal(slotName(4, 2, 2), "p1");
});

// ── 5. THE REPLY'S FACTS ──────────────────────────────────────────────────

test("notBuilt and noDatabase reach the reply writer's facts", () => {
  const bf = buildFacts({ notBuilt: ["a newsletter sign-up", 3, ""], noDatabase: true });
  assert.deepEqual(bf.notBuilt, ["a newsletter sign-up"]);
  assert.equal(bf.noDatabase, true);
  const facts = buildReplyFacts(bf).facts.map((f) => f.text);
  assert.ok(facts.some((t) => t.includes("a newsletter sign-up") && /asked for next/.test(t)), "what was not built is not a fact for the reply");
  assert.ok(facts.some((t) => /no database/i.test(t)), "the missing database is not a fact for the reply");
  // CANNOT-TELL IS NOT A VALUE.
  assert.equal(buildFacts({ noDatabase: "yes" }), null);
  assert.equal(buildFacts({ noDatabase: false }).noDatabase, false);
});

test("both build answers hand the reply writer notBuilt and noDatabase, on first builds only", () => {
  assert.match(WORKER, /\.\.\.\(firstBuild \? \{ notBuilt: buildArgs && buildArgs\.plan && buildArgs\.plan\.notBuilt, noDatabase: !db \} : \{\}\)/,
    "the inline first build's answer does not carry the two facts");
  assert.match(WORKER, /\.\.\.\(!design\.priorPages \? \{ notBuilt: design\.plan && design\.plan\.notBuilt, noDatabase: !rBackend \} : \{\}\)/,
    "the collected first build's answer does not carry the two facts");
  // AND THE DESIGN'S OWN LIST REACHES THE PLAN THE BUILD IS HANDED.
  assert.match(WORKER, /if \(firstBuild && designed\) buildArgs\.plan = withNotBuilt\(buildArgs\.plan, designed\.notBuilt\);\s*pages = await buildAndPublishPages\(env, buildArgs\);/,
    "the design's notBuilt never reaches the plan");
  // AND THE WRITERS ARE HANDED IT.
  assert.match(WORKER, /notBuilt: plan && Array\.isArray\(plan\.notBuilt\) \? plan\.notBuilt : \[\]/, "the frame writers are not handed notBuilt");
});

// IS IT REACHABLE? — the check this repo keeps needing and keeps not having.
//
// The pattern, five times over: something is written, tested, on disk, and
// reachable by NOTHING. The 27 blocks, the 196 examples, the 1,140 charts, and
// eleven schema-engine features all shipped that way. Every one of them
// compiled, every unit test passed, and none of it could be used.
//
// site-theme.mjs and site-layouts.mjs were the sixth and seventh: both were
// imported only by their own tests when this file was written, so no generated
// site could carry a theme or a layout family. These assertions are the chain
// from a module on disk to a value in a built site, checked link by link,
// because every previous instance had four of five links working.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { budgetFor } from "../builder/site-images.mjs";
import { mergeLook, movedFields, hasValue, EDIT_RULE, currentStateNote, EDIT_FIELDS } from "../builder/site-edit.mjs";
import { briefWithLayout } from "../builder/page-gen.mjs";
import { UI_COMPONENTS, ALWAYS_API_CORE, PAGE_RULES, schemaDigest, lintPages } from "../builder/page-gen.mjs";
import { PLAN_FIELDS, PLAN_KEYS, planFieldFor, PLAN_REQUIRED, KIT_PALETTE, COMPONENT_MENU, directiveFromPlan } from "../builder/site-plan.mjs";
import { normalizeSeeds } from "../builder/site-seeds.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
const buildServer = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");

test("THE PALETTE IS AUTHORED, AND THE WHOLE CHAIN IS WIRED", () => {
  // THE REPLACEMENT FOR SIX REGISTRY TESTS. They asserted that 500 named themes
  // resolved, that a promoted one beat its candidate, that worlds merged under,
  // and that the shortlist spread over every category. All six were about a
  // lookup table that left the product on 2026-08-20 — the designer writes three
  // anchor colours per site now and `paletteFor` derives the other 28 tokens,
  // which is what every one of those 500 already did.
  //
  // What replaces them is the CHAIN, asserted link by link, because this repo has
  // recorded a dozen features that were correct at every layer and dead at one:
  // the tool must offer the field, the field must be the real module's (not a
  // second copy that can drift), the route must merge it, the look must carry it,
  // the build must pass it, and the container must render it.
  assert.match(worker, /seeds: SEEDS_FIELD,/, "design_schema no longer offers a palette at all");
  assert.match(worker, /import \{[^}]*SEEDS_FIELD[^}]*\} from "\.\/builder\/site-seeds\.mjs"/,
    "SEEDS_FIELD is referenced and never imported — a ReferenceError building the tool");
  // THE PROPERTY, NOT THE SPELLING. This pinned `const merged = mergeLook(...)`
  // and went red when the route grew a SECOND call — the probe that answers
  // which page a colour is for, which must run before the merge it feeds. What
  // has to hold is that the route merges the look at all.
  assert.match(worker, /mergeLook\(priorLook, [a-zA-Z]+, body/, "the route does not merge the look");
  // The store is the WHOLE merge — the five-field literal this used to pin was
  // itself the bug, dropping lang, mode, langs and the plan on every build.
  assert.match(worker, /const look = merged;/, "the look no longer carries the authored palette");
  assert.match(worker, /\n\s*seeds: look\.seeds,/, "the merged palette never reaches buildAndPublishPages");
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\bseeds\b[^}]*\}\)/,
    "buildAndPublishPages is passed a palette it does not destructure");
  assert.match(worker, /\n\s*seeds: seeds \|\| null,/, "the palette never reaches the container payload");

  // AND THE NAME IS GONE, asserted as an ABSENCE with COMMENTS BLANKED — the
  // notes recording why `theme` was removed necessarily spell it, and this repo
  // has been caught by that more than half a dozen times.
  const code = worker.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\bTHEME_SHORTLIST\b|\bthemeFontPair\b|\bSITE_THEME_IDS\b/,
    "the theme registry is back in the Worker — two answers to what colour a site is");
});

test("the container is the ONE place a palette is judged", () => {
  // `normalizeSeeds` runs next to the `themeCss` call that consumes its answer,
  // so there is exactly one place a palette can be refused. Judging in the Worker
  // as well would put the derived 31-token result on the wire beside the three
  // seeds and let the two copies drift.
  assert.match(buildServer, /import \{[^}]*normalizeSeeds[^}]*\} from "\.\/site-seeds\.mjs"/,
    "the container does not import the normaliser");
  const code = worker.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /normalizeSeeds\(/,
    "the Worker judges the palette too — one of the two will eventually disagree");
});

test("the designer WRITES its own plan, and its own palette", () => {
  // Derived, not restated: a hand-typed copy here would drift from the module.
  // The palette half is asserted in full by "THE PALETTE IS AUTHORED" above; what
  // this adds is that the two authored tiers are BOTH spread in from their own
  // modules rather than either being restated in the tool.
  assert.match(worker, /seeds: SEEDS_FIELD,/, "the palette field is not the module's own");
  // THE `family` HALF OF THIS TEST IS GONE BECAUSE THE FIELD IS (2026-08-20).
  // It used to assert `const SITE_FAMILY_IDS = READY_FAMILIES` and an enum built
  // from it — the 100 pre-written trades the designer picked between. The owner's
  // call is that the model decides the shape per site, so there is no enum to
  // derive and no table to stay in step with: the six authored fields are
  // spread in from `site-plan.mjs`, which is the one definition of them.
  //
  // ASSERTED AS AN ABSENCE TOO. A later edit restoring a `family` field would
  // put a second, contradictory answer to "what are this site's pages" in front
  // of the designer, and the two would disagree silently — the directive is
  // composed from whichever the build path happens to read.
  assert.match(worker, /\.\.\.PLAN_FIELDS,/, "the six authored fields no longer reach the tool");
  // COMMENTS BLANKED BEFORE THE ABSENCE IS JUDGED, because the lines recording
  // WHY `SITE_FAMILY_IDS` was removed necessarily contain its spelling — so the
  // first draft of this assertion failed against the very change it was written
  // to protect. Eighth recorded instance of that trap in this repo, and the
  // first inside a guard written the same day as the entry warning about it.
  const code = worker.replace(/^[ \t]*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\bSITE_FAMILY_IDS\b/,
    "the family enum is back beside the authored plan — two answers to one question");
  for (const k of PLAN_KEYS) {
    // `planFieldFor`, not `PLAN_FIELDS` — the fragments are in two places since
    // `shape` moved to last (2026-08-21) and this asks whether the designer can
    // answer the key at all, which is true wherever its fragment happens to sit.
    assert.ok(planFieldFor(k), `${k} is a plan key with no field for the designer to answer`);
    // …AND IT REALLY REACHES THE TOOL. A fragment that exists and is spliced in
    // nowhere is the wiring failure this repo has recorded twelve times: every
    // module-level guard passes while the model is never asked the question.
    const reaches = k === "shape"
      ? /\n\s*shape:\s*SHAPE_FIELD,/.test(worker)
      : /\n\s*\.\.\.PLAN_FIELDS,/.test(worker);
    assert.ok(reaches, `${k}'s field exists but never reaches design_schema`);
  }
});

test("and REQUIRED to choose, or every site silently keeps the default look", () => {
  // The contents stopped being a list of quoted names when the plan arrived as
  // a spread, so this is anchored on the tool's own closing shape instead —
  // exactly the fix `site-fonts.test.mjs` needed for its copy of this read.
  const req = worker.match(/required: \[[^\]]*\],\s*\n\s*\},\s*\n\};/);
  assert.ok(req, "could not find design_schema's required list");
  assert.match(req[0], /"seeds"/,
    "the palette is optional, so a designer may skip it and the site keeps the template's own look");
  assert.match(req[0], /"fonts"/,
    "the typeface is optional again — with no registry to recommend a pairing that means the default face");
  // THE OTHER 23 DECISIONS, COMPELLED ON A FIRST BUILD (owner's call,
  // 2026-08-21). The description has told the model to author them since the
  // registry went, and telling is not compelling — which is the entire reason
  // `PLAN_REQUIRED` exists one line below. `seeds` is three colours and decides
  // none of these, so an unanswered `style` is not a design choice, it is the
  // template's plain default wearing one.
  assert.match(req[0], /"style"/,
    "style is optional on a first build, so every site can silently keep the template's type scale, corners, shadows and world layer");
  // DERIVED, so a seventh axis is required without anybody editing this file —
  // and required at all, which is the half that matters: every one of the six is
  // a LINE of the layout directive, so a skipped answer is a line the page
  // writer never sees.
  assert.match(req[0], /\.\.\.PLAN_REQUIRED/,
    "the plan's fields are no longer required, so a designer may skip the whole layout");
  assert.ok(PLAN_REQUIRED.length === PLAN_KEYS.length,
    "some plan axis is optional — a directive composed from it loses that line silently");
});

test("a caller-supplied palette is still the last resort", () => {
  // WHAT SURVIVES OF "the other 400 are bounded, not lost". That test was about a
  // registry: the shortlist bounded what the MODEL picked between, and a caller
  // naming any of the 500 directly on the request body reached it. There is no
  // list any more — the model authors the palette — but the precedence it rested
  // on is still real and still load-bearing, so it is asserted as the property
  // rather than deleted with the list.
  //
  // DRIVEN, NOT SPELLED. Its predecessor pinned the inline
  // `(priorLook && …) || (designed && …) || (body && …)` chain twice over and
  // went red when the merge moved into `mergeLook` — a correct change failing a
  // test about word order.
  const A = { name: "From Body", paper: "#ffffff", ink: "#111111", accent: "#c04a2e" };
  const B = { name: "Designed", paper: "#f7f2ea", ink: "#332a26", accent: "#b44a2e" };
  assert.deepEqual(mergeLook(null, null, { seeds: A }).seeds, A,
    "a palette named on the request body no longer reaches the build");
  assert.deepEqual(mergeLook(null, { seeds: B }, { seeds: A }).seeds, B,
    "the designer outranks the body on a first build");
});


test("the DESIGN call is cached, like the page call", () => {
  // It carries ~6,800 tokens that are byte-identical every build and was paying
  // full price for all of them, while the page call — three and a half times
  // bigger — was a cache read. The small call was the expensive one.
  const i = worker.indexOf("async function designSiteSchema");
  assert.ok(i > 0, "designSiteSchema moved");
  const call = worker.slice(i, i + 3500);
  assert.match(call, /tools: \[\{ \.\.\.SITE_SCHEMA_TOOL, cache_control: \{ type: "ephemeral" \} \}\]/);
  assert.match(call, /system: \[\{ type: "text", cache_control: \{ type: "ephemeral" \}/,
    "the system block must be a block array, or cache_control has nowhere to live");
});

test("the PLAN reaches the PAGE prompt as a directive, not as fields", () => {
  // FOURTH TIME THIS WENT RED FOR A CORRECT CHANGE — twice for the variant axis
  // arriving and leaving, once for the composition moving into page-gen.mjs, and
  // now for the family it named being replaced by the authored plan. Its own
  // comment already called that the sign of an assertion pinned too tightly, so
  // it asserts the PROPERTY: the worker hands the plan to the shared composer,
  // and that composer really does turn it into a directive.
  const call = worker.match(/briefWithLayout\(\{([^}]*)\}\)/s);
  assert.ok(call, "the worker no longer composes the brief through the shared function");
  assert.match(call[1], /\bplan\b/, "the worker no longer passes the authored plan to the composer");
  const out = briefWithLayout({ brief: "a shop", plan: {
    purpose: "browsing the stock IS the page",
    pages: [{ path: "/", role: "the shop" }],
  } });
  assert.match(out, /^a shop\n\n/, "the brief must still lead");
  assert.match(out, /LAYOUT — /, "the plan must arrive as a directive, not as fields");
  assert.match(out, /browsing the stock IS the page/, "the purpose must ride with it");
});

test("a null directive is never interpolated into the brief", () => {
  // layoutDirective answers null for an unknown family or structure, and the
  // unguarded form appends the literal word "null" and LOSES the layout.
  // Asserted behaviourally rather than by matching the guard's spelling.
  assert.equal(directiveFromPlan({ purpose: "p", pages: [] }), null, "the null case moved");
  for (const args of [
    { brief: "a shop" },
    { brief: "a shop", family: "not-a-family" },
  ]) {
    assert.equal(briefWithLayout(args), "a shop", JSON.stringify(args));
  }
});

test("`structure` IS GONE FROM EVERY LAYER IT LIVED AT", () => {
  // THE INVERSE OF THE TWO TESTS THAT STOOD HERE (owner's call, 2026-08-20), on
  // the precedent that replaced the repair-pass tests with "a second call never
  // happens": the field is deleted, so what has to be held is its ABSENCE, and
  // an absence rots silently where a presence goes red.
  //
  // It named one of eight page skeletons and was MEASURED as ignored — over the
  // pinned generator corpus `sidebar` produced no page importing `sidebar-layout`,
  // `single-scroll` produced four `<Link>`-navigated routes against its own
  // "one page, anchor links" definition, and `editorial` produced a centred
  // column. What it really decided was the photograph budget, and that cost is
  // asserted in `site-plan.test.mjs` rather than here.
  //
  // EVERY LAYER, because this feature was live at five and a half-deletion is
  // how a field comes back through one of them.
  assert.ok(!PLAN_KEYS.includes("structure"), "structure is back in the plan keys");
  assert.ok(!Object.hasOwn(PLAN_FIELDS, "structure"), "the designer is offered the skeleton again");
  assert.ok(!PLAN_REQUIRED.includes("structure"), "structure is required again");
  assert.ok(!EDIT_FIELDS.includes("structure"), "an edit can move the skeleton again");
  // The two places it reached CODE. A stored one is still legal input — every
  // site built before today carries one — so what must be true is that neither
  // the look the route stores nor the directive the model reads carries it on.
  assert.equal(mergeLook({ structure: "sidebar" }, { structure: "bento" }, null).structure, undefined,
    "the merged look still carries a skeleton, so the route would store it again");
  const d = directiveFromPlan({
    purpose: "a purpose", structure: "sidebar", pages: [{ path: "/", role: "the home page" }],
  });
  assert.ok(d, "a plan carrying a legacy skeleton stopped composing a directive");
  // BELT-AND-BRACES, AND IT SAYS SO RATHER THAN READING AS INDEPENDENT. Measured
  // by mutation: restoring the `Structure —` line to `directiveFromPlan` on its
  // own SURVIVES this, because `directiveFromPlan` normalises first and the
  // normaliser drops the field — so nothing is left for the restored line to
  // print. The assertion that does the work is the `mergeLook` one above and the
  // normaliser's own in `site-plan.test.mjs`; this one holds by a property of a
  // function one edit away from changing, which is exactly when this repo keeps
  // a guard and states what it rests on.
  assert.ok(!/Structure —|sidebar/.test(d), "the skeleton still reaches the page writer");
  // AND THE MODULE IT WAS THE LAST READER OF. `site-layouts.mjs` held STRUCTURES
  // and STRUCTURE_NAMES and nothing else, so it went with the field; a file
  // restored without a reader is the on-disk-and-reachable-by-nothing shape this
  // repo has deleted 289 files over.
  assert.ok(!fs.existsSync(new URL("../builder/site-layouts.mjs", import.meta.url)),
    "site-layouts.mjs is back, and nothing reads it");
  // AN IMPORT, NOT A MENTION. `worker.js` explains in prose where the directive
  // used to come from and that prose names the module — the trap this repo has
  // recorded in a lint, a router guard, an absence check, a scope scan and a
  // mutation. Prose describing a deletion spells the deleted thing, so the scan
  // reads code.
  assert.ok(!/from\s*["'][^"']*site-layouts/.test(worker),
    "worker.js imports the deleted layouts module");
});

test("the container turns the palette into real CSS, after the font write", () => {
  assert.match(buildServer, /function writeTheme\(/);
  assert.match(buildServer, /normalizeSeeds\(seeds\)/, "writeTheme no longer derives a theme from the seeds");
  // Ordering is the correctness argument: writeFonts restores styles.css from
  // the pristine base, so a theme written first is overwritten by it.
  const fontsAt = buildServer.indexOf("const fontsUsed = writeFonts(");
  const themeAt = buildServer.indexOf("const themeUsed = writeTheme(");
  assert.ok(fontsAt > 0 && themeAt > 0, "one of the two writes is missing");
  assert.ok(themeAt > fontsAt, "writeTheme runs BEFORE writeFonts and will be overwritten");
});

test("the theme write fails soft — an unusable palette never costs the site", () => {
  const fn = buildServer.slice(buildServer.indexOf("function writeTheme("));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(body, /if \(!theme\) return \{ applied: false/);
  assert.match(body, /catch/);
  assert.ok(!/throw/.test(body), "writeTheme can throw, which would take the build with it");
});

test("every plan field the designer must answer actually TELLS it something", () => {
  // THE REPLACEMENT FOR "the designer is told what each family BUILDS". That one
  // asserted `familiesForPrompt()` reached the tool and described all 100 —
  // right up until 2026-08-20, when the enum it described stopped existing.
  //
  // The invariant it was really protecting survives the change and is what is
  // asserted here: a field the model MUST answer and is told nothing about is a
  // field answered from the bare name, which is the failure that test existed
  // for. Six compelled fields, each carrying real instruction rather than a
  // label — and `shape` is the one that matters most, because it is 294 lines of
  // hand-written layout opinion being replaced by per-site writing, so a thin
  // description there produces a thin site.
  for (const k of PLAN_KEYS) {
    // THROUGH `planFieldFor`, NOT `PLAN_FIELDS` DIRECTLY. `shape` is spliced
    // into the tool after `mode` since 2026-08-21, so it is a plan key whose
    // fragment lives elsewhere — looking it up in `PLAN_FIELDS` alone would
    // report the most important field in the plan as described in 0 characters.
    const f = planFieldFor(k);
    const d = f && f.description;
    assert.ok(typeof d === "string" && d.length > 120,
      `\`${k}\` is compelled on every build and described in ${d ? d.length : 0} characters`);
  }
  // …AND THE ONE THAT DECIDES WHETHER THIS WHOLE CHANGE WORKS. `components` is a
  // manifest now, not a hint: the page writer sees the props of what it names
  // and nothing else. A description that still reads as "reach for these first"
  // is one that produces an 8-name list where the pages need 12.
  assert.match(PLAN_FIELDS.components.description, /MANIFEST, NOT A SHORTLIST/,
    "the component field no longer says it decides what the page writer can see");
});

/* THE FAMILY TABLE'S OWN GUARDS WENT WITH IT (2026-08-20).
 *
 * Three tests stood here: that `READY_FAMILIES` really filtered on the ready
 * flag rather than aliasing the full list, that every ready family produced a
 * directive, and that omitting a structure kept the family's own default. All
 * three were about a lookup table that no longer exists — the designer writes
 * the skeleton per site and `structure` is required, so there is no default to
 * keep and no readiness to gate.
 */

test("the DESIGNER's palette and the always-on core are all real components", () => {
  // THE SHORTLIST THIS REPLACES WAS DERIVED FROM WHAT THE 100 FAMILIES DECLARED,
  // and its guard was that the shortlist covered every declared name. Both are
  // gone with the family field. What took its place is two lists with different
  // jobs, and the one property they share is the one that was always doing the
  // work: a name offered to a model and absent from the kit is an import that
  // cannot resolve.
  // THE LEAF MUST STAY A LEAF. `ui-components.mjs` exists only because
  // `page-gen.mjs` imports `site-plan.mjs`, so the kit's names could not be read
  // from there without a cycle — which is why the designer was offered 279 of
  // 2,112 until 2026-08-21. One import here and the cycle is back, and an ESM
  // cycle does not throw: `KIT_PALETTE` would simply be undefined at the moment
  // the field's description is built, and the designer would be offered nothing.
  const leaf = fs.readFileSync(new URL("../builder/ui-components.mjs", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(leaf, /^\s*import\s/m,
    "builder/ui-components.mjs imports something — it is the cycle break and must stay a leaf");

  const real = new Set(UI_COMPONENTS);
  for (const c of KIT_PALETTE) assert.ok(real.has(c), `${c} is offered to the designer and does not exist`);
  for (const c of ALWAYS_API_CORE) assert.ok(real.has(c), `${c} is in the always-on core and does not exist`);
  // Floors, so a list that emptied would pass this vacuously.
  assert.ok(KIT_PALETTE.length > 200, `the palette shrank to ${KIT_PALETTE.length}`);
  assert.ok(ALWAYS_API_CORE.length >= 25, `the core shrank to ${ALWAYS_API_CORE.length}`);
});

test("the LINT knows all 2,112, so a real import is never refused", () => {
  // Unchanged in substance and MORE load-bearing than it was. The prompt now
  // names every module, so what the model may render and what the lint permits
  // are finally the same set — but narrowing the lint would still turn "a
  // component the model was not told about" into "a component the pipeline
  // rejects", which is a much worse failure and a silent one.
  assert.ok(UI_COMPONENTS.length > 2000, `the lint's allow-list shrank to ${UI_COMPONENTS.length}`);
  // THE ASSERTION THAT STOOD HERE SAID THE OPPOSITE and was removed rather than
  // relaxed: "the designer's palette is the whole kit — the +6% choice became
  // +46% without anybody deciding it". Somebody decided it (owner's call,
  // 2026-08-21) and the +46% is a token count, not a cost — the block is cached,
  // so it is 0.37 credits a build. What that guard was really protecting is the
  // ONE thing that still must not drift, and it is asserted here instead: the
  // lint and the menu are now the same set, so a name the designer may choose is
  // always a name the pipeline will accept.
  assert.equal(COMPONENT_MENU.length, UI_COMPONENTS.length,
    "the designer's menu and the lint's allow-list have come apart — a nameable component the lint refuses");
});

test("rule 3's absolute is SCOPED to the path, and names the whole kit under it", () => {
  // Rule 3 once said "these exist and nothing else does" about a 292-name
  // shortlist, ten rules above the one naming 882 chart components. A false
  // absolute in a prompt is how a whole tier goes unused.
  //
  // The sentence is now TRUE — it lists every module under that path — which is
  // what the per-site change bought: the model can never be wrong about what
  // exists. The scoping still has to survive, because the charts live elsewhere
  // and an unscoped "nothing else exists" would deny them all over again.
  const i = PAGE_RULES.indexOf("THE KIT FOR EVERY CONTROL");
  const rule = PAGE_RULES.slice(i, i + 400);
  assert.match(rule, /nothing else exists there/, "rule 3 no longer tells the model what the kit is");
  assert.match(rule, /under that path/, "rule 3's absolute is unscoped again — it now denies the charts too");

  // …AND THE LIST REALLY IS THE WHOLE KIT, not a subset wearing an absolute —
  // which is the half that decides whether the sentence above is true.
  //
  // FOUND BY MUTATION. This sampled `UI_COMPONENTS[0]` and the last entry, and
  // BOTH of them happen to be in the 279-name palette — so swapping rule 3's
  // list for the palette, leaving 1,833 real modules described as nonexistent,
  // passed it perfectly. A two-element sample that lands inside what the mutant
  // still prints discriminates nothing.
  //
  // Every name, and the assertion NAMES the missing ones rather than counting
  // them: "1,833 are absent" sends the reader looking, the list says where.
  const missing = UI_COMPONENTS.filter((c) => !PAGE_RULES.includes(c));
  assert.deepEqual(missing.slice(0, 8), [],
    `${missing.length} kit modules exist and the prompt never names them, e.g. ${missing.slice(0, 8).join(", ")}`);
});

/* ------------------------------------------------------------ photographs */

// THE CHAIN, link by link. This feature has the exact shape of the seven that
// were on disk and reachable by nothing: a module, a rule in the prompt, a
// budget, a dep. Four of the five links working is the state every one of those
// shipped in, so each link is asserted separately rather than end-to-end.

const clientJs = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8");

test("the build both ASKS for photographs and BUYS them", () => {
  // Either half alone is a dead feature wearing the other's clothes: state the
  // allowance with no dep and the model writes tokens nobody buys (every one
  // becomes a placeholder); supply the dep with no allowance and nothing ever
  // writes a token for it to find. The two live ~10 lines apart and it is
  // entirely possible to add one and forget the other.
  // ANCHORED ON THE DECISION, NOT ITS SPELLING — which is what the comment
  // already claimed while pinning `budgetFor(family, { revise, priorPages,
  // slug })` character for character, so it went red the day `plan` joined the
  // call. Rewriting the argument list is not a change to the decision, and a
  // guard that cannot tell the two apart is a guard that fails correct work.
  // What matters is that ONE call decides the budget and the model is told that
  // same number.
  const call = worker.match(/const imgBudget = budgetFor\(([^;]*?)\);/);
  assert.ok(call, "the budget is no longer derived in one place from the family and the site's own history");
  // `family` was the leading argument here until the families were deleted; the
  // plan answers everything this function asks.
  for (const arg of ["plan", "revise", "priorPages", "slug"]) {
    assert.match(call[1], new RegExp("\\b" + arg + "\\b"), "budgetFor is called without `" + arg + "`");
  }
  const stated = worker.match(/briefWithLayout\(\{([^}]*)\}\)/);
  assert.ok(stated, "the layout directive is no longer composed for the model");
  assert.match(stated[1], /\bimages: imgBudget\b/, "and stated to the model in the user turn");
  assert.match(stated[1], /\bplan\b/, "the authored plan never reaches the directive");
  assert.match(worker, /images: \(pages, \{ balance, reserve \}\) =>\s*\n?\s*buySitePhotos\(/,
    "and the dep that buys them is supplied to publishPages");
});

// The generate -> sniff -> hash -> put chain, wherever it lives. It was inline in
// `buySitePhotos` AND in `makeSitePhoto`, which claims in its own header to be the
// one copy — false from the day it was written. There is one now, and these guards
// read it rather than a window that happened to contain it.
const photoChain = () => {
  const at = worker.indexOf("async function makeSitePhoto");
  const fn = worker.slice(at, worker.indexOf("\nasync function buySitePhotos", at));
  assert.ok(fn.length > 400, "makeSitePhoto moved — rescope these guards");
  return fn;
};

test("a generated photograph is stored where /u/ actually looks for it", () => {
  // A second copy of `uploads/<slug>/` is a picture written where the serving
  // route does not look — a 404 the bundle compiles perfectly around, so
  // nothing else in the pipeline can catch it.
  const fn = photoChain();
  assert.match(fn, /uploadKey\(slug, name\)/);
  assert.match(fn, /uploadUrl\(slug, name\)/);
  assert.ok(!/["']uploads\//.test(fn), "it must not spell the prefix itself");
  assert.ok(!/["']\/u\//.test(fn), "nor the public path");
});

test("the bytes are sniffed and named by content, exactly like an owner upload", () => {
  const fn = photoChain();
  assert.match(fn, /sniffImage\(bytes\)/, "the declared type is what the image model sent, not what we asked for");
  assert.match(fn, /uploadName\(hex, kind\.ext\)/, "content hash, so /u/ can honestly serve it immutable");
  assert.match(fn, /MAX_UPLOAD_BYTES/, "the same size cap the upload route enforces");
});

test("what is BILLED is what was stored, not what was planned", () => {
  // Counting the shots would charge for an image-model outage: six planned, six
  // failures, six charges. `urls` is only written by a successful put.
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.match(fn, /made: urls\.size/);
  assert.ok(!/made: plan\.shots\.length/.test(fn));
});

test("one failed picture does not cost the others, or the build", () => {
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  // Per-shot try/catch inside the Promise.all, so a rejection cannot take the
  // whole batch down with it. KEPT even though `makeSitePhoto` does not throw:
  // `Promise.all` REJECTS if any element does, and that rejection propagates into
  // `publishPages` where `applyImages` never runs and the raw `@@IMG:…@@` tokens
  // ship — a truthy src and a broken-image glyph on the published page.
  // `lastIndexOf`, because there is an EARLY `return {` above the Promise.all
  // for the nothing-to-buy case — `indexOf` finds that one and slices an empty
  // window, which then matches nothing and reports a gap that is not there.
  const inMap = fn.slice(fn.indexOf("Promise.all"), fn.lastIndexOf("return {"));
  assert.ok(inMap.length > 200, "found the loop body, not an empty window");
  assert.match(inMap, /try \{/);
  assert.match(inMap, /\} catch \(e\) \{/);
  // COMMENTS BLANKED BEFORE THE ABSENCE IS JUDGED. This went red on a correct
  // change because the catch's own comment explains that `makeSitePhoto` "does
  // not throw today" — prose about the bug containing the bug's spelling, which
  // is the fourth time this class has bitten in this repo.
  const code = inMap.slice(inMap.indexOf("} catch")).replace(/^[ \t]*\/\/.*$/gm, "");
  assert.ok(!/throw /.test(code), "the catch must not rethrow");
});

test("the photograph sentence reaches the chat", () => {
  // Composed on the server and rendered by the client. `imageNote` returning a
  // string that nothing displays is this repo's most-repeated failure, and the
  // response field alone does not prove the other end exists.
  assert.match(worker, /imagesNote: imageNote\(pages\.images\)/);
  assert.match(clientJs, /d\.imagesNote === 'string'/,
    "public/chat.js must actually read it");
  // `[,)]` rather than a closing paren: the call grew a fifth argument (the
  // build's own failure diagnosis) and this pinned the ARITY while meaning to
  // pin the note. A guard that breaks on an added argument gets loosened by
  // whoever hits it, which is worse than one that never fired.
  assert.match(clientJs, /siteFinishBuild\(origin, .*, build, note[,)]/,
    "and pass it through as the note");
});

test("the image price and the image model are not two answers to one question", () => {
  // `IMAGE_USD` in publish-pages.mjs prices exactly what `SITE_IMG_MODEL`
  // generates. Moving the model without moving the price silently re-prices
  // every build, in whichever direction is worse.
  assert.match(worker, /const SITE_IMG_MODEL = "fal-ai\/nano-banana-pro"/);
  const priced = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8")
    .match(/"fal-ai\/nano-banana-pro":\s*([0-9.]+)/);
  assert.ok(priced, "the model has a row in IMAGE_USD");
  const table = fs.readFileSync(path.join(ROOT, "builder/publish-pages.mjs"), "utf8")
    .match(/export const IMAGE_USD = ([0-9.]+)/);
  assert.ok(table, "and publish-pages states the build's own price");
  assert.equal(Number(table[1]), Number(priced[1]),
    "the build price and the generation price must be the same number");
});

test("every way out of buySitePhotos sweeps the tokens", () => {
  // THE LIVE BUG THIS EXISTS FOR, found by `build smoke` and a screenshot.
  // The nothing-to-buy branch returned `pages` untouched, so the raw
  // `@@IMG:...@@` text shipped into the bundle, SafeImage saw a TRUTHY src, and
  // the published home page rendered a broken-image icon with its alt showing.
  //
  // It bit on the commonest path there is: a new account is granted 20 credits
  // and a build costs about 21, so nothing is affordable and that branch is what
  // EVERY first build takes. The graceful-degradation path the whole feature is
  // built around was the one that degraded to a broken page.
  //
  // Nothing in the unit suite could see it — `applyImages` is tested directly
  // and is correct; the bug was in not calling it — and worker.js cannot be
  // imported. So it is a source read, and it counts the EXITS rather than
  // looking for the call, because "applyImages appears somewhere in the
  // function" was true the whole time it was broken.
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.ok(fn.length > 400, "found the function, not an empty window");
  const exits = [...fn.matchAll(/return\s+(?:\{|done\()/g)];
  assert.ok(exits.length >= 2, "expected the early exit and the final one — found " + exits.length);
  for (const m of exits) {
    assert.match(m[0], /return done\(/,
      "an exit that does not go through `done` skips applyImages and ships raw tokens");
  }
  assert.match(fn, /const done = \([\s\S]{0,80}applyImages\(pages, urls\)/,
    "and `done` is what sweeps");
});

/* ------------------------------------------------- client -> route reachability */

test("every /api path the client calls is answered by a route in worker.js", () => {
  // THE CHECK THAT WOULD HAVE CAUGHT THREE SEPARATE LIVE BUGS AT ONCE.
  //
  // `/api/site/backend/delete` (the Delete-this-site button) and
  // `/api/site/backend/delete-all` (account deletion) were called by the client
  // and answered by nothing: both 404s were swallowed by a `catch {}`, so a
  // customer was told their site and data were permanently removed while the
  // published site, its Neon database and its claimed slug all kept running.
  // The real `DELETE /api/site/<slug>` route had zero callers.
  //
  // MATCHED AGAINST ROUTE MATCHERS, NOT AGAINST THE FILE TEXT. A plain
  // `worker.includes(path)` passes on a COMMENT explaining that a route was
  // deleted, which is the "matches its own prose" failure this repo keeps
  // hitting — and comment-blanking worker.js is not an option either: a stray
  // `/*` inside a string makes the blanker eat 46% of the file, which hides real
  // code and is the direction that costs a bug rather than a false alarm.
  //
  // STATIC PATHS ONLY. A path the client concatenates a slug onto is checked by
  // its prefix through the sub-router rule below, not as a literal.
  const client = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8") + "\n" +
    fs.readFileSync(path.join(ROOT, "public/auth.js"), "utf8");

  const literals = new Set();
  for (const m of worker.matchAll(/url\.pathname\s*===\s*"([^"]+)"/g)) literals.add(m[1]);
  const regexes = [];
  for (const m of worker.matchAll(/(\/(?:\\.|\[[^\]]*\]|[^/\n])+\/[a-z]*)\.test\(url\.pathname\)/g)) {
    try { regexes.push(new RegExp(m[1].replace(/^\//, "").replace(/\/[a-z]*$/, ""))); } catch { /* not a pathname regex */ }
  }
  assert.ok(literals.size > 30, `only ${literals.size} literal routes found — the scan broke`);
  assert.ok(literals.has("/api/credits"), "a known route is not being seen");
  assert.ok(regexes.length >= 1, "the pathname regexes are not being read");

  const answered = (p) => {
    if (literals.has(p) || regexes.some((r) => r.test(p))) return true;
    // `/api/site/<slug>/<verb>` and `/api/db/<slug>/...` are sub-routers: the
    // slug is dynamic, so the verb suffix is what has to exist.
    const seg = p.split("/").filter(Boolean);
    if (seg[0] === "api" && seg[1] === "site" && seg.length >= 3) {
      const tail = "/" + seg.slice(2).join("/");
      if (worker.includes('"' + tail + '"') || worker.includes('endsWith("' + tail)) return true;
    }
    return p.startsWith("/api/db/") || p.startsWith("/api/m/");
  };

  const dead = [];
  // A LITERAL ENDING IN `/` IS A PREFIX BEING CONCATENATED, not a path. Without
  // this, `apiFetch('/api/site/' + slug)` reads as a call to `/api/site` and
  // buries the one call that really is dead among three that are fine.
  for (const m of client.matchAll(/(?:apiFetch|fetch)\(\s*(["'`])(\/api\/[A-Za-z0-9/_-]*)\1/g)) {
    if (m[2].endsWith("/")) continue;
    if (!answered(m[2])) dead.push(m[2] + " (public/chat.js:" + client.slice(0, m.index).split("\n").length + ")");
  }
  assert.deepEqual([...new Set(dead)], [], "the client calls routes that do not exist — these 404 at runtime");
});

test("a REVISE buys no new photographs", () => {
  // Every revise re-derived the same family budget and the model wrote fresh
  // descriptions, so nothing matched what was bought last time: a customer
  // revising a 5-photo agency site paid ~94 credits in NEW photographs on every
  // revise, for pictures they already owned, and orphaned the originals. Even a
  // typo fix bought one, because the directive actively asks for a token.
  // THE PROPERTY, DRIVEN — not the spelling of the line that implements it.
  // Pinned to `revise ? 0 : imageBudget(family)`, this failed on the change that
  // fixed a second bug in the same rule: a site whose FIRST build died before
  // the image step has no photographs, and every attempt after it is a revise,
  // so it could never get one. Both halves are asserted through the real
  // function, and the wiring is checked separately below.
  const shown = [{ path: "index.tsx", source: '<SafeImage src="/u/cafe/a.jpg" />' }];
  const none = [{ path: "index.tsx", source: "<SafeImage src={row.photo} />" }];
  // THE BUDGET COMES FROM THE PLAN since the family table went; the rule under
  // test is unchanged and only its input has moved.
  const plan = { purpose: "the work is the page",
    pages: [{ path: "/", role: "the work" }, { path: "/work", role: "the gallery" }], components: ["gallery"] };
  assert.equal(budgetFor({ revise: true, priorPages: shown, slug: "cafe", plan }), 0,
    "a revise re-derives a photo budget and re-bills for pictures the owner has");
  assert.equal(budgetFor({ revise: true, priorPages: none, slug: "cafe", plan }), 2,
    "a site that never got a photograph can never get one, however often it is rebuilt");
  // …AND THE ROUTE STILL ASKS IT. Matched on the call rather than on its
  // argument list, for the third time in this file: the list grew a `plan` and
  // three separate guards went red on a change none of them was about.
  assert.match(worker, /const imgBudget = budgetFor\(/,
    "…and the route no longer asks that question");
  // AND THE FLAG HAS TO ARRIVE. The budget line above is correct and inert if
  // nothing ever passes `revise` — four of five layers working is this repo's
  // signature failure, so the parameter and the call site are asserted apart.
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\brevise\b[^}]*\}\)/,
    "buildAndPublishPages does not take the flag");
  assert.match(worker, /revise: existing,/,
    "nothing tells it this is a revise — `existing` is the free signal, off the ownership check");
  // AND THE SIGNAL IS OWNERSHIP, NOT THE STORED BRIEF. This was `!!priorBrief`,
  // which gives the same answer for every site built since the brief started
  // being recorded and the WRONG one for anything older: such a revise read as a
  // first build and would have re-bought every photograph on it at ~19 credits
  // each. The row is read once, for the ownership check, so this costs nothing.
  assert.match(worker, /existing = !!\(owner && owner\.uid\);/,
    "`existing` is not set from the ownership row — the flag arrives as undefined, " +
    "so every revise reads as a first build and buys photographs again");
});

test("a revise keeps the site's stored look instead of re-rolling it", () => {
  // A revise sends only the instruction, so the designer named a theme, a family
  // and a font pair from a few words — "fix a typo" could re-family a
  // booking-first barber shop and re-font the whole site. The fallback chain's
  // comment claimed `body.theme`/`body.family`/`body.fonts` anchored the look;
  // the client has never sent any of them, so that anchor did not exist.
  //
  // The chain is asserted link by link, because this feature is one missing link
  // from being decorative: read it back, prefer it, write it on a first build,
  // and only look it up on a revise.
  // Matched on the KEY rather than on the whole statement: the read was widened
  // to fetch `site_tokens` in the same round trip, and a guard anchored on the
  // exact SQL went red on a change that kept every property it was written to
  // protect. Anchoring on the literal a query cannot work without is the
  // durable form.
  assert.match(worker, /FROM _meta WHERE k[^\n]*'site_look'/, "nothing reads the stored look");
  assert.match(worker, /INSERT INTO _meta \(k,v\) VALUES \('site_look'/, "nothing ever writes it");
  assert.match(worker, /if \(priorBrief\) \{[\s\S]{0,400}site_look/,
    "the look is read on a FIRST build too, which would pin an empty one");
  // WRITTEN ON EVERY BUILD NOW, and this assertion is the inverse of what it
  // was. `if (!priorLook)` was correct while the look could never change after a
  // first build — anchoring made the stored value permanent, so re-writing it
  // was a no-op. An edit can move any of these now (owner's rule 2026-08-10),
  // and writing only on the first build would apply the change once and forget
  // it, so the NEXT edit would resurrect the old look. Safe because the value
  // written is the merged one, which is stored-unless-named.
  assert.ok(!/if \(!priorLook\) \{/.test(worker),
    "the look is written only on a first build again, so an edit to it is forgotten by the next edit");
  assert.match(worker, /INSERT INTO _meta \(k,v\) VALUES \('site_look'[\s\S]{0,120}JSON\.stringify\(look\)/,
    "the merged look is not what gets stored");

  // AND THE GUARANTEE ITSELF, driven rather than spelled. "A revise keeps the
  // stored look" is now "stored unless the change named it" — the same
  // protection, expressed so that asking CAN change it.
  const stored = { seeds: { name: "Cool Slate", paper: "#f4f6f8", ink: "#20262b", accent: "#2f6f85" }, family: "salon", brand: "Sharp Fade", description: "A barber shop." };
  // An instructed designer that named nothing changes nothing. This is the case
  // that used to re-roll the look, and it is the ordinary edit.
  const quiet = mergeLook(stored, { tokens: { background: "#ffff00" } }, null, { instructed: true });
  for (const k of ["seeds", "family", "brand", "description"]) {
    assert.deepEqual(quiet[k], stored[k], `a colour-only edit moved ${k}`);
  }
  assert.deepEqual(movedFields(stored, quiet), [], "a colour-only edit reports having moved something");
  // …and naming one moves exactly that one.
  const NEW = { name: "Sea Glass", paper: "#f2f7f6", ink: "#1c2a28", accent: "#2b7a6b" };
  const rethemed = mergeLook(stored, { seeds: NEW }, null, { instructed: true });
  assert.deepEqual(rethemed.seeds, NEW, "an edit that asks for a new palette cannot get one");
  assert.equal(rethemed.family, "salon", "re-colouring also changed the family");
  assert.deepEqual(movedFields(stored, rethemed), ["seeds"]);
  // WITHOUT the instruction the OLD precedence holds, which is the interlock:
  // an unread state must never let an untold designer re-roll a live site.
  assert.deepEqual(mergeLook(stored, { seeds: { name: "Sea Glass", paper: "#f2f7f6", ink: "#1c2a28", accent: "#2b7a6b" } }, null).seeds,
    stored.seeds, "an uninstructed designer re-themes the site again");
  // ANCHORED ON THE PROPERTY, NOT THE SPELLING. This asserted the exact text
  // `family: look.family,` and went red the moment that value legitimately
  // grew a conditional (`noFamily` — the experiment switch), reporting "family
  // does not reach the build" about a build it reaches perfectly well. A test
  // about word order, which is this repo's most repeated own-goal. What has to
  // hold is that each field is SOURCED from the merged look on its way to the
  // build — however the expression is written.
  // THE TWO SHAPES, because the plan stopped being passed field by field.
  // `seeds` and `fonts` are still their own parameters and are sourced from the
  // merged look by name — `seeds` being the authored palette that replaced the
  // theme NAME on 2026-08-20, and the one field where a re-roll changes every
  // colour on every page at once. The six plan axes — `structure` among them — go as ONE
  // `plan` object assembled from `PLAN_KEYS`, so naming each of them here would
  // fail on a correct route; what has to hold there is that the assembly reads
  // `look`, and that it reads it for EVERY key rather than a remembered few.
  for (const k of ["seeds", "fonts"]) {
    assert.ok(new RegExp(k + ":[^,\\n]*\\blook\\." + k + "\\b").test(worker),
      k + " does not reach the build from `look`");
  }
  assert.match(worker, /plan: normalizePlan\(Object\.fromEntries\(PLAN_KEYS\.map\(\(k\) => \[k, look\[k\]\]\)\)\)/,
    "the plan is not assembled from the merged look, so a revise re-rolls the layout");
  // `family` is deliberately NOT asserted to reach the build any more: nothing
  // reads it. It stays on `EDIT_FIELDS` so a site built before 2026-08-20 keeps
  // its record of itself, and `mergeLook` carries it for that reason alone.
});

test("a prototype key cannot masquerade as a palette", () => {
  // `ALL_THEMES["__proto__"]` was the object prototype — truthy, so it walked
  // past `|| null` and came back as `{}`: neither a real theme nor the null every
  // caller failed soft on. The registry that lookup guarded is gone, and the
  // hazard is not: the palette is an object off a model's tool call now, so the
  // same keys arrive as `seeds` instead. Asserted where the question moved to.
  for (const k of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
    const r = normalizeSeeds({ name: "x", paper: k, ink: k, accent: k });
    assert.equal(r.theme, null, k + " was accepted as a colour");
  }
  assert.ok(normalizeSeeds({ name: "Real", paper: "#f7f2ea", ink: "#332a26", accent: "#b44a2e" }).theme,
    "a real palette still resolves");
});

test("the third-party api tier is reachable by a generated page", () => {
  // `useApi` was the ONE hook in @/lib/rows that no rule and no digest ever
  // mentioned — so a site could declare an api, the platform would serve it, and
  // no generated page could ever call it. The whole tier reachable by nothing,
  // which is this repo's signature failure. Asserted as a chain: the hook exists,
  // the digest names what was declared, and the lint catches a name that was not.
  const rows = fs.readFileSync(path.join(ROOT, "builder/lovable/template/src/lib/rows.ts"), "utf8");
  assert.match(rows, /export function useApi\b/, "the hook is gone");
  const spec = { tables: [{ name: "m", access: "display", columns: ["a"] }], apis: [{ name: "rates", params: ["base"] }] };
  const digest = schemaDigest(spec);
  assert.match(digest, /useApi\(name, \{ params \}\)/, "the digest never names the hook");
  assert.match(digest, /rates\(base\)/, "a declared api is not described to the model");
  assert.deepEqual(lintPages([{ path: "index.tsx", source: 'useApi("rates", {})' }], spec), [],
    "a declared api is refused");
  assert.equal(lintPages([{ path: "index.tsx", source: 'useApi("weather", {})' }], spec).length, 1,
    "an undeclared api compiles, publishes and 404s — the lint has to catch it");
  // And a site that declares none says nothing at all, rather than an empty header.
  assert.ok(!/OUTSIDE DATA/.test(schemaDigest({ tables: spec.tables })), "an empty section is still tokens");
});

test("the client accepts a build that answered, flaws and all", () => {
  // `!d.error` refused every placeholder build that carried a reason — which is
  // all of them: the route returns `error` beside `ok:true` on validate, home,
  // typecheck, build and generate. The most common real failure took the ERROR
  // branch, which claims "you weren't charged" over charged stages and never
  // records the slug that WAS provisioned, so the project lost its own database
  // and the next message ran as a fresh first build against a claimed slug.
  //
  // `error: true` is the client's OWN stream sentinel; the server sends a string.
  assert.match(clientJs, /if \(r\.ok && d && d\.error !== true && d\.slug\) \{/,
    "a placeholder build with a reason is refused again");
  assert.ok(!/if \(r\.ok && d && !d\.error && d\.slug\)/.test(clientJs), "the truthiness check is back");
});

test("account deletion stops when the site sweep did not finish", () => {
  // Not best-effort: `site_backends.uid` cascades with `auth.users`, so deleting
  // the account over a half-finished sweep leaves sites serving publicly with
  // nothing left that can authorise removing them. There is no second chance.
  const i = clientJs.indexOf("/api/site/delete-all");
  assert.ok(i > 0, "account deletion no longer sweeps the sites");
  const block = clientJs.slice(i, i + 1200);
  assert.match(block, /if \(!dr\.ok \|\| !dj \|\| dj\.ok !== true\) \{/, "a partial sweep no longer stops the deletion");
  assert.match(block, /return;/, "it must not fall through to deleting the account");
  assert.match(block, /was NOT deleted/, "and the customer has to be told why");
});

// ── ONE BUILD MUST NOT LEAVE ANYTHING FOR THE NEXT ONE ──────────────────────
//
// `getContainer(env.SITE_BUILD_CONTAINER)` is called with no id, so EVERY build
// on the platform lands in ONE long-lived container. That is why `resetRoutes`
// exists, and why it wipes `src/routes`, the generated route tree and `dist`
// before a build writes anything: two sites sharing a working directory is how
// one customer's pages once got published to another customer's slug.
//
// `dist-ssr` is the newest member of that set — the server bundle the prerender
// imports. Left behind by a failed SSR build it is one site's pages waiting to
// be rendered into another site's snapshots, and the import is cache-busted per
// build precisely because the module system would otherwise hand back the first
// one forever.
//
// Asserted by NAME rather than derived, because "which constants are build
// outputs" is a judgement no scan makes reliably — and a wrong derivation here
// passes vacuously, which is the failure this file is full of.
test("every build output is wiped before the next build starts", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const at = src.indexOf("function resetRoutes()");
  assert.ok(at > 0, "resetRoutes moved — rescope this");
  const body = src.slice(at, src.indexOf("\n}", at));

  for (const [what, re] of [
    ["the generated route tree", /rmSync\(GEN,/],
    ["the client dist", /rmSync\(DIST,/],
    // THE LEAVINGS OF THE THREE-BUILD PIPELINE. `dist-ssr` and `dist-worker` are
    // no longer produced — Start's own build emits `dist/client` and
    // `dist/server` — but a long-lived instance that predates the deploy can
    // still be carrying them, so the wipes stay. Asserted by NAME rather than by
    // the old `SSR_DIR` constant, which went with the code that wrote there.
    ["the pre-Start build outputs", /"dist-ssr", "dist-worker"/],
    ["the stylesheet", /copyFileSync\(STYLES_BASE, STYLES\)/],
  ]) {
    assert.match(body, re, `resetRoutes no longer clears ${what} — the previous build's output survives into this one`);
  }

  // AND THE BUNDLE THE RENDER CHECK LOADS IS CACHE-BUSTED PER BUILD. This
  // container is long-lived and serves every build on the platform, so Node's
  // module cache would hand back the PREVIOUS site's server and every render
  // report after the first would be a statement about somebody else's pages.
  //
  // WHAT THIS REPLACES. The prerender ran model-written code in its own process
  // (`prerender-child.mjs`), and this asserted both ends of that — the parent
  // spawning a child per build, and the child being the only thing that loaded
  // the bundle. TanStack Start removed the build-time prerender entirely: the
  // document is rendered per REQUEST by the site's own Worker, in the customer's
  // own isolate on Cloudflare's side, which is a stronger boundary than a uid in
  // a shared container was.
  //
  // AND NOW THE OPPOSITE IS ASSERTED, because the mechanism this guarded was
  // deliberately removed and the replacement is strictly stronger.
  //
  // It used to demand a CACHE BUSTER on an in-process `import()` of the site's
  // server bundle: `?b=` + Date.now(), so the module cache could not hand back
  // the previous customer's server. That worked and it bought an unbounded
  // leak — a unique specifier per build means Node's ESM registry retains
  // EVERY site's bundle for the life of the container, so the fix for one leak
  // was the cause of another.
  //
  // Worse, the import itself was the sandbox hole: it ran model-written page
  // components in the build service's own event loop, as root, with no timeout,
  // in the same loop that answers /health and drives oneAtATime. The Dockerfile
  // claimed nothing in the image executed model code and contradicted itself
  // eleven lines later.
  //
  // The bundle is loaded by a SPAWNED CHILD now, so both go at once: nothing is
  // retained because nothing is registered, and a wedged render costs a child
  // rather than the container. The property to hold is therefore the ABSENCE of
  // the in-process load; `test/render-sandbox.test.mjs` drives the child itself.
  // COMMENTS BLANKED FIRST, and for an absence check that is not optional: the
  // moment somebody documents in build-server.mjs WHY the in-process import was
  // removed, the prose spells the very call being forbidden and this goes red
  // against correct code. Blanked line-wise and length-preserving, so nothing
  // shifts. This repo has recorded that trap ten-plus times, including inside
  // guards written the same day as the warning about it.
  const noComments = src.split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l))
    .join("\n");
  assert.ok(!/await import\(pathToFileURL\(SERVER_BUNDLE\)/.test(noComments),
    "the model's server bundle is imported into the build service's own process again — that is the sandbox hole and the ESM leak, both back");
  assert.ok(!fs.existsSync(new URL("../builder/prerender-child.mjs", import.meta.url)),
    "the prerender child is back without its spawn and privilege-drop guards, which went with it");
});

// ── THE PLATFORM MUST SAY WHY A BUILD FAILED ────────────────────────────────
//
// It diagnosed this completely and threw the diagnosis away at the last layer.
// `stage`, `error` and `cited` (the exact source lines the compiler pointed at)
// came back on every failed build; `problems` (the lint's findings) and
// `functionErrors` (model-written SQL that failed to create) came back even on a
// SUCCESSFUL one — and the client rendered none of the five. The owner saw "the
// pages didn't compile" and had to open devtools to learn anything more.
// Measured 2026-08-09 on a real ~20-credit build: fifteen minutes hunting for an
// answer the response already carried.
//
// THE CHAIN IS ASSERTED LINK BY LINK, because "computed, returned, rendered by
// nothing" is the exact shape being fixed and it is this repo's signature
// failure. Four of five links working is what every previous instance looked
// like.
test("a failed build's own diagnosis reaches the screen", () => {
  const client = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "public/styles.css"), "utf8");

  // 1. the server still sends all five
  for (const field of ["stage", "error", "cited", "problems", "functionErrors"]) {
    assert.ok(new RegExp(`\\b${field}:`).test(worker),
      `the build response stopped carrying ${field} — there is nothing left to render`);
  }

  // 2. the client reads each of them
  const i = client.indexOf("function buildWhy(");
  assert.ok(i > 0, "buildWhy is gone — the diagnosis is discarded again");
  const body = client.slice(i, client.indexOf("\n}", client.indexOf("return out.join", i)));
  // ANCHORED ON THE CONDITION, not on the name appearing. A mutation to
  // `if (false && Array.isArray(d.problems))` leaves `d.problems` right there in
  // the source and survived a first sweep — the same trap this repo records
  // against message strings, one field over.
  for (const field of ["cited", "problems", "functionErrors"]) {
    assert.ok(new RegExp(`if \\(Array\\.isArray\\(d\\.${field}\\)\\)`).test(body)
      || new RegExp(`if \\(Array\\.isArray\\(d\\.${field}\\)\\s*&&`).test(body),
      `buildWhy no longer guards on d.${field} being an array — it is either ignored or unguarded`);
  }
  for (const field of ["stage", "error"]) {
    assert.ok(new RegExp(`typeof d\\.${field} === 'string'`).test(body), `buildWhy ignores ${field}`);
  }
  // The lint's findings and a failed function are NOT gated on the placeholder:
  // a site can publish while carrying either, and those are the failures nobody
  // would otherwise notice, because the site looks fine until a visitor hits the
  // broken part.
  // Extracted by brace matching rather than by regex: `problems` and
  // `functionErrors` must sit OUTSIDE the placeholder branch, because a site can
  // publish while carrying either — a page the lint refused, or a confirmation
  // function that never got created — and those are the failures nobody would
  // otherwise notice, since the site looks fine until a visitor hits the broken
  // part.
  const ph = body.indexOf("if (d.page === 'placeholder') {");
  assert.ok(ph > 0, "the placeholder branch is gone");
  let depth = 0, close = ph;
  for (let k = ph; k < body.length; k++) {
    if (body[k] === "{") depth++;
    else if (body[k] === "}" && --depth === 0) { close = k; break; }
  }
  const inside = body.slice(ph, close);
  for (const field of ["problems", "functionErrors"]) {
    assert.ok(!inside.includes("d." + field),
      `${field} is trapped inside the placeholder branch — a site that PUBLISHED never reports it`);
  }

  // 3. IT IS CALLED. A helper that is defined and never invoked is the same bug
  //    wearing a fix — asserted apart from its definition, the Bookmarks lesson.
  assert.match(client, /siteFinishBuild\(origin, \(built \? '✅ ' : '⚠️ '\)[^;]*, build, note, buildWhy\(d\)\)/,
    "buildWhy is defined and never called on the build path");

  // 4. IT IS STORED, so it survives a reload — the thread is rebuilt from
  //    localStorage, and a diagnosis that vanishes on refresh is half a fix.
  assert.match(client, /s\.msgs\.push\(\{ r: 'a', t: reply, note: note \|\| undefined, why: why \|\| undefined/,
    "the diagnosis is not stored on the message");

  // 5. IT IS RENDERED.
  assert.match(client, /m\.why \? '<div class="st-why">' \+ esc\(m\.why\) \+ '<\/div>' : ''/,
    "nothing paints the diagnosis");

  // 6. AND IT IS READABLE. This carries file:line references and real source
  //    lines; without preserved newlines four errors become one unreadable
  //    sentence. `.st-note` had exactly that bug — it was split out of `.st-msg`
  //    to fix collapsing newlines and then never given a white-space of its own,
  //    so the notes it joins with "\n" ran together anyway.
  assert.match(css, /\.st-why \{[^}]*white-space: pre-wrap/, ".st-why collapses its newlines");
  assert.match(css, /\.st-why \{[^}]*monospace/, ".st-why is not monospace — source lines lose their shape");
  assert.match(css, /\.st-note \{[^}]*white-space: pre-line/, ".st-note runs its separate notes together again");
});

// ── A PUBLISH MUST NOT DAMAGE A SITE THAT ALREADY WORKS ─────────────────────

test("the Worker tells publishPages which pages the site is already serving", () => {
  // `salvagePlan` can be perfectly right about "never stub a page that works"
  // while nothing hands it the fact — the wiring layer, for the thirteenth
  // recorded time. Both ends: the value is DERIVED from the prior source, and
  // it is PASSED.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /const livePages = \(Array\.isArray\(priorPages\) \? priorPages : \[\]\)/,
    "livePages is no longer derived from the site's stored source");
  assert.match(src, /\{ spec, slug, priorUsage, livePages \}/,
    "livePages is computed and never handed to publishPages");
  // It must be the PATHS. Handing over the page objects would make
  // `published.has(bare)` false for every one of them, which reads exactly like
  // a first build and silently switches the protection off.
  const at = src.indexOf("const livePages =");
  assert.match(src.slice(at, at + 220), /\.map\(\(p\) => p && p\.path\)/,
    "livePages carries page objects rather than paths — every lookup would miss");
});

test("EVERY prerendered document is written after the assets it names", () => {
  // This sorted `index.html` alone, which was the whole truth exactly while a
  // site was one HTML file plus a bundle. Each route is prerendered to its own
  // document now — stable names, written in readdir order — so `book.html` PUT
  // before the hashed chunks it references is a blank page at a public URL for
  // the seconds of a republish.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const entries = Object.entries(dist || {})");
  assert.ok(at > 0, "the publish ordering moved — rescope this");
  const sortExpr = src.slice(at, src.indexOf(";", at));
  assert.ok(!/\^index\\\.html\$/.test(sortExpr),
    "only index.html is ordered last again — every other prerendered page can point at unwritten assets");

  // DRIVEN, not only read: a sort that matches the right pattern and compares
  // the wrong way round reads identically.
  // eslint-disable-next-line no-new-func
  const cmp = new Function("return (" + /\.sort\((\(a, b\) => [^;]+)\)/.exec(sortExpr)[1] + ")")();
  const order = ["index.html", "assets/app-abc.js", "book.html", "assets/x.css", "work.html"]
    .map((n) => [n, {}]).sort(cmp).map(([n]) => n);
  const firstHtml = order.findIndex((n) => /\.html$/.test(n));
  const lastAsset = order.map((n) => /\.html$/.test(n)).lastIndexOf(false);
  assert.ok(firstHtml > lastAsset,
    "a document is written before an asset: " + JSON.stringify(order));
});

test("a restore orders its documents the same way", () => {
  // Same one-file sort, same failure: a version's `book.html` copied in before
  // the assets it names is a blank page for the length of the rollback.
  const src = fs.readFileSync(new URL("../site-versions.mjs", import.meta.url), "utf8");
  const at = src.indexOf("const ordered = names.slice().sort(");
  assert.ok(at > 0, "the rollback ordering moved — rescope this");
  assert.ok(!/\^index\\\.html\$/.test(src.slice(at, src.indexOf(";", at))),
    "rollbackVersion orders only index.html last again");
});

test("why salvage could not rescue a build reaches the caller", () => {
  // `salvagePlan` has always computed this and the module has always returned
  // it, and NOTHING forwarded it — while a comment in that file claimed the eval
  // read `foreign`, and the eval never calls publishPages at all. So the signal
  // designed to catch "we shipped a broken kit component" died in the return.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /salvage: \(pages\.salvage && pages\.salvage\.reason\) \? pages\.salvage : undefined,/,
    "the salvage plan is computed and dropped at the route");
  // And the comment that was false is gone: a claim about a consumer that does
  // not exist is what gets believed next time somebody edits the line.
  const pub = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.ok(!/because the eval reads\s*\n?\s*\*?\s*it/.test(pub),
    "the false claim that the eval reads `foreign` is back");
});

test("a look that failed SOFT reaches the caller instead of publishing silently", () => {
  // `writeTheme` and `writeFonts` never fail a build — a site whose data layer
  // is live must not be lost over a typeface — so they answer `applied:false`
  // with a sentence instead. Both were reported by the container on every build
  // and forwarded by NOTHING, so the failure they exist to describe was
  // invisible at every layer above.
  //
  // Latent today and the class is not: a stored `site_look.theme` naming a theme
  // later REMOVED from the registry — a deletion this repo performs regularly —
  // would make every subsequent publish of that site ship the default look while
  // reporting success, for ever.
  const container = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");
  assert.match(container, /applied: false/, "the container no longer reports a soft failure at all");
  assert.match(container, /theme: themeUsed, /, "the container stopped carrying its theme result");

  const pub = fs.readFileSync(path.join(ROOT, "builder/publish-pages.mjs"), "utf8");
  assert.match(pub, /\[\["theme", bd && bd\.theme\], \["fonts", bd && bd\.fonts\]\]/,
    "publish-pages drops the container's applied-flags");
  assert.match(pub, /r\.applied !== false/,
    "a soft failure is judged by something other than the container's own flag");
  assert.match(pub, /if \(soft\.length\) out\.lookSoft = soft;/,
    "the soft-failure list is computed and dropped");

  // BOTH PUBLISH PATHS. Every cheap edit republishes through
  // `recompileAndPublish`, so a build-path-only fix leaves a text fix, a colour
  // change and a picture swap all shipping the default look in silence.
  assert.match(worker, /lookSoft: pages\.lookSoft \|\| undefined,/, "the build route drops it");
  // ANCHORED ON THE PROPERTY, not on what follows it. This pinned the closing
  // brace and went red the moment an honest `worker` field joined the return —
  // a correct change failing a test about word order, which is this repo's
  // most-recorded own-goal.
  assert.match(worker, /lookSoft: lookSoft\.length \? lookSoft : undefined/,
    "recompileAndPublish drops it, so every cheap edit is silent about it");

  // CARRIED ONLY WHEN SOMETHING WENT WRONG, at both layers: a build where the
  // theme and the fonts both applied must be byte-identical on the wire, so the
  // field's PRESENCE is the signal rather than its contents.
  assert.ok(!/lookSoft: soft,/.test(pub) && !/lookSoft: lookSoft,/.test(worker),
    "the soft-failure list is now on every response — a field nobody reads is not a warning");
});

test("a refused guarantee and a refused table name both reach the caller", () => {
  // Both were computed by nothing and both are the same class: a silent
  // subtraction from the customer's site. `refusedFields` did not exist, and a
  // bad table name did not survive normalisation at all — it 502'd the whole
  // build at `sqlIdent`.
  assert.match(worker, /import \{[^}]*refusedFields[^}]*\} from "\.\/site-schema\.mjs"/,
    "the route cannot see the refused-guarantee reader");
  assert.match(worker, /const refused = refusedFields\(body\.schema \|\| designed \|\| \{\}\)/,
    "the route never asks which declared guarantee was refused");
  assert.match(worker, /refused: refused\.length \? refused : undefined,/,
    "the refused list is computed and dropped");
  assert.match(worker, /const badNames = Array\.isArray\(spec && spec\.refusedTables\)/,
    "the route never reads which table name the engine refused");
  assert.match(worker, /refusedTables: badNames\.length \? badNames : undefined,/,
    "the refused table names are read and dropped");

  // PRESENT ONLY WHEN THERE IS SOMETHING TO SAY, at both, so an ordinary
  // build's response is byte-identical to what it was.
  assert.ok(!/refused: refused,/.test(worker) && !/refusedTables: badNames,/.test(worker),
    "a field carried on every build is not a warning");

  // AND THE SAME SOURCE AS `reached`, which is the raw answer before the
  // allow-list — after it there is nothing left to read.
  const at = worker.indexOf("const reached = droppedFields(");
  const to = worker.indexOf("const badNames =", at);
  assert.ok(at > 0 && to > at, "the reach/refuse block moved — rescope this");
  assert.match(worker.slice(at, to), /refusedFields\(body\.schema \|\| designed \|\| \{\}\)/,
    "the two readers disagree about which spec they are judging");
});

test("one customer's theme cannot survive into the next customer's stylesheet", () => {
  // THE TITLE ABOVE WAS FALSE FOR AS LONG AS `styles.css` WAS MISSING FROM THAT
  // LIST, and a source-read alone would not have caught it — `writeTheme` and
  // `writeTokens` both APPEND, and the only thing that ever put the sheet back
  // was a side effect of `writeFonts`, gated on two conditions that can each be
  // false. When either was, the fallback read `src/styles.css` ITSELF — the
  // previous customer's sheet — and appended to that.
  //
  // Driven rather than read: the real `resetRoutes` body is lifted out and run
  // against a sandbox, three builds in a row, each appending a distinct marker
  // the way a theme write does. Measured before the fix: 94 → 120 → 146 bytes
  // with markers accumulating 1 → 1,2 → 1,2,3.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const at = src.indexOf("function resetRoutes()");
  assert.ok(at > 0, "resetRoutes moved — rescope this");
  const body = src.slice(at, src.indexOf("\n}", at) + 2);
  assert.ok(body.length > 400, "the resetRoutes window is empty — rescope this");

  const run = (fnBody) => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), "resetroutes-"));
    fs.mkdirSync(path.join(app, "src", "routes"), { recursive: true });
    fs.mkdirSync(path.join(app, ".routes-base"), { recursive: true });
    fs.writeFileSync(path.join(app, ".routes-base", "__root.tsx"), "//root\n");
    const pristine = "@theme {\n  --font-sans: system-ui;\n}\n:root { --background: white; }\n";
    fs.writeFileSync(path.join(app, ".styles-base.css"), pristine);
    const styles = path.join(app, "src", "styles.css");
    fs.writeFileSync(styles, pristine);
    const reset = new Function("fs", "path", "APP", "ROUTES", "ROUTES_BASE", "GEN", "DIST", "SSR_DIR", "STYLES", "STYLES_BASE",
      fnBody + "\nreturn resetRoutes;")(fs, path, app,
      path.join(app, "src", "routes"), path.join(app, ".routes-base"),
      path.join(app, "src", "routeTree.gen.ts"), path.join(app, "dist"), "dist-ssr",
      styles, path.join(app, ".styles-base.css"));
    const seen = [];
    for (const n of [1, 2, 3]) {
      reset();
      fs.writeFileSync(styles, fs.readFileSync(styles, "utf8") + `\n:root { --marker-${n}: 1; }\n`);
      const s = fs.readFileSync(styles, "utf8");
      seen.push([1, 2, 3].filter((k) => s.includes("--marker-" + k)));
    }
    fs.rmSync(app, { recursive: true, force: true });
    return seen;
  };

  assert.deepEqual(run(body), [[1], [2], [3]],
    "a previous build's theme rules are still in the stylesheet the next build appends to");

  // AND IT DISCRIMINATES — without the restore the markers accumulate, so this
  // test cannot be passing because the harness never writes anything.
  assert.deepEqual(run(body.replace(/try \{ fs\.copyFileSync\(STYLES_BASE, STYLES\); \} catch \{\}/, "")),
    [[1], [1, 2], [1, 2, 3]],
    "the harness does not reproduce the leak, so a green run above proves nothing");
});

test("there is ONE generate → sniff → hash → put chain, and buySitePhotos goes through it", () => {
  // `makeSitePhoto`'s own header says "EXTRACTED SO THERE IS ONE COPY … the sniff
  // is the only thing standing between an image model's answer and an SVG served
  // inline from our own origin, so a second copy that forgets it is a stored
  // XSS." It was written the day that function shipped and was FALSE from the
  // first line: `buySitePhotos` kept the identical chain inline, and the guards
  // above were sliced from the duplicate rather than from the shared reader —
  // so they held the copy and said nothing about the original.
  //
  // KEYED ON THE IMAGE-MODEL CALL, not on the put. A first draft counted
  // `SITES_BUCKET.put(uploadKey(` and went red at 2 — the second is the LOGO
  // store, which writes bytes the OWNER attached and were sniffed by
  // `runLogoEdit` before they got there. A correct, separate path: exactly the
  // false alarm on correct code this comment was already warning about, produced
  // by the check written to prevent it. What must not be duplicated is the chain
  // that handles bytes an IMAGE MODEL sent, so that is what is counted.
  const code = worker.replace(/^[ \t]*\/\/.*$/gm, "");
  const gens = [...code.matchAll(/= await genSitePhoto\(/g)];
  assert.equal(gens.length, 1,
    `${gens.length} places take an image model's bytes — the sniff is the only thing between one of those and a stored XSS, and it can drift between copies`);

  // …and the caller reaches it, rather than having grown its own again.
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.match(fn, /await makeSitePhoto\(env, slug, prompt\)/, "buySitePhotos no longer goes through the shared reader");
  assert.ok(!/genSitePhoto\(env, p\)/.test(fn), "buySitePhotos has its own copy of the chain again");

  // BOTH CALL SITES READ THE OBJECT. `makeSitePhoto` answers `{url, error}`, and
  // a caller that kept `if (made)` would be truthy for `{ url: null }` — charging
  // for a photograph that was never made and handing a page `[object Object]` in
  // a `src`, which `SafeImage` paints as a broken image.
  for (const m of worker.matchAll(/(?:const|let) ([^=]+)= await makeSitePhoto\(/g)) {
    assert.match(m[1], /\{/, "a caller takes makeSitePhoto's answer as a bare value: " + m[0]);
  }
});

test("a picture that could not be made says WHY, and the caller carries it", () => {
  // "A site quietly missing its pictures looks exactly like a site that was never
  // meant to have any" — `buySitePhotos`' own words for why the reason exists. It
  // reaches `out.images.error` and rides the build response, and TWO mutations
  // proved nothing held it: dropping the reason from a refusal, and destructuring
  // only `url` at the call site, both passed the whole suite.
  const at = worker.indexOf("async function makeSitePhoto");
  const fn = worker.slice(at, worker.indexOf("\nasync function buySitePhotos", at));
  assert.ok(fn.length > 400, "makeSitePhoto moved — rescope this");

  const exits = [...fn.matchAll(/return \{ url: null[^}]*\}/g)].map((m) => m[0]);
  assert.ok(exits.length >= 4, `only ${exits.length} failure exits found — the scan stopped matching`);
  const silent = exits.filter((e) => !/error:/.test(e));
  // EXACTLY ONE IS SILENT, and it is the empty-prompt case: a token with no
  // description was never going to become a picture, so reporting it would set
  // `images.error` on builds where nothing failed.
  assert.equal(silent.length, 1, "a failure exit reports no reason: " + silent.join(" | "));
  assert.match(fn.slice(0, fn.indexOf(silent[0])), /imagePrompt\(prompt\)/,
    "the one silent exit is not the empty-prompt case any more");

  // …AND THE CALLER READS IT. Computed and dropped is the shape of a dead field.
  const buy = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.match(buy, /const \{ url, error \} = await makeSitePhoto\(/, "the per-shot reason is destructured away");
  assert.match(buy, /else if \(error\) failed = error;/, "the reason is read and then not kept");
});

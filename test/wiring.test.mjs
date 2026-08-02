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

import { THEME_IDS, THEME_SHORTLIST, ALL_THEMES, resolveTheme } from "../builder/site-theme-registry.mjs";
import { themeCss, THEMES } from "../builder/site-theme.mjs";
import { FAMILY_NAMES, READY_FAMILIES, STRUCTURE_NAMES, STRUCTURES, VARIANT_IDS, layoutDirective, familiesForPrompt, structuresForPrompt, variantsForPrompt, resolveVariant, FAMILIES } from "../builder/site-layouts.mjs";
import { UI_COMPONENTS, UI_SHORTLIST, PAGE_RULES } from "../builder/page-gen.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
const buildServer = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");

test("every theme the designer may pick actually resolves and renders", () => {
  assert.equal(THEME_IDS.length, Object.keys(ALL_THEMES).length);
  assert.ok(THEME_IDS.length >= 500, `only ${THEME_IDS.length} themes reachable`);
  for (const id of THEME_IDS) {
    const t = resolveTheme(id);
    assert.ok(t, `${id} is offered and does not resolve`);
    const css = themeCss(t);
    assert.ok(typeof css === "string" && css.length > 200, `${id} renders nothing usable`);
  }
});

test("a promoted theme wins over its candidate of the same name", () => {
  // The registry spreads THEMES last precisely so promotion — the version whose
  // `needs` capability is actually built — beats the swatch. Asserted rather
  // than left to the reader, because the ordering looks arbitrary.
  for (const name of Object.keys(THEMES)) {
    assert.deepEqual(ALL_THEMES[name], THEMES[name], `${name} is not the promoted version`);
  }
});

test("a world is merged UNDER its theme, so a hand-authored axis wins", () => {
  // worlds.mjs states this rule in its own header. Reversed, a generated world
  // silently overwrites an axis somebody chose by hand — invisible, because both
  // values are valid and the site still builds.
  const zine = resolveTheme("zine");
  assert.equal(zine.decor, "paper", "the world was not merged at all");
  assert.equal(zine.inputs, "underline", "the world overwrote the theme's own axis");
});

test("an unknown theme resolves to null rather than throwing", () => {
  // A theme is decoration on a site whose data layer is already live. Losing a
  // build over a misspelt name would be the tail wagging the dog.
  assert.equal(resolveTheme("no-such-theme"), null);
  assert.equal(resolveTheme(""), null);
  assert.equal(resolveTheme(undefined), null);
  assert.equal(resolveTheme(42), null);
});

test("the designer is OFFERED a theme and a family, both derived", () => {
  // Derived, not restated: a hand-typed list here would drift from the module
  // and offer a name that resolves to nothing.
  assert.match(worker, /const SITE_THEME_IDS = THEME_SHORTLIST;/);
  // READY only. The enum used to be every family while familiesForPrompt()
  // described ready ones alone, so the model could be offered a name it was
  // told nothing about and whose directive resolves to null.
  assert.match(worker, /const SITE_FAMILY_IDS = READY_FAMILIES;/);
  assert.match(worker, /enum: SITE_THEME_IDS/);
  assert.match(worker, /enum: SITE_FAMILY_IDS/);
});

test("and REQUIRED to choose, or every site silently keeps the default look", () => {
  const req = worker.match(/required: \[("[a-z]+", ?)+"[a-z]+"\],\s*\n\s*\},\s*\n\};/);
  assert.ok(req, "could not find design_schema's required list");
  assert.match(req[0], /"theme"/);
  assert.match(req[0], /"family"/);
});

test("the shortlist is 100, spread over every category, and still all resolve", () => {
  // A flat first-100 would be every print and tech theme and nothing else — a
  // shortlist that cannot dress a bakery. The round-robin is what stops that,
  // and it is invisible unless something checks the spread.
  assert.equal(THEME_SHORTLIST.length, 100);
  const allCats = new Set(Object.values(ALL_THEMES).map((t) => t.cat || "shipped"));
  const listCats = new Set(THEME_SHORTLIST.map((n) => ALL_THEMES[n].cat || "shipped"));
  assert.equal(listCats.size, allCats.size, `only ${listCats.size} of ${allCats.size} categories are offered`);
  for (const n of THEME_SHORTLIST) assert.ok(resolveTheme(n), `${n} is offered and does not resolve`);
  assert.equal(new Set(THEME_SHORTLIST).size, 100, "the shortlist repeats a theme");
});

test("the promoted themes are always offered", () => {
  // They are the two whose `needs` are actually built. Losing one because a
  // category lane filled first would make the best-supported themes the least
  // likely to be chosen.
  for (const name of Object.keys(THEMES)) {
    assert.ok(THEME_SHORTLIST.includes(name), `${name} is promoted and not offered`);
  }
});

test("the other 400 are bounded, not lost — any of the 500 still resolves", () => {
  // The fonts bargain: the shortlist bounds what the MODEL picks between, and a
  // caller naming one directly on the request body reaches any of them.
  const offList = THEME_IDS.filter((n) => !THEME_SHORTLIST.includes(n));
  assert.equal(offList.length, THEME_IDS.length - 100);
  for (const n of offList) assert.ok(resolveTheme(n), `${n} is unreachable even by name`);
  assert.match(worker, /theme: \(designed && designed\.theme\) \|\| \(body && body\.theme\)/,
    "the body fallback is gone, so off-list themes really are unreachable");
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

test("the chosen theme reaches the container, by name", () => {
  // The seam that was missing entirely: the enum existed in an earlier draft and
  // the value went nowhere, so the model chose a theme on every build and no
  // site ever wore one.
  assert.match(worker, /theme: theme \|\| null,/);
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\btheme\b[^}]*\}\)/);
});

test("the chosen family reaches the PAGE prompt as a directive, not a name", () => {
  // Matched on the SHAPE rather than one exact spelling: this asserted the
  // literal `layoutDirective(family, structure ? { structure } : {})` and went
  // red the day the variant axis was wired, which is a correct change. What
  // must hold is that the family arrives as a directive and that structure and
  // variant ride WITH it as options.
  assert.match(worker, /layoutDirective\(family, \{[^}]*structure[^}]*\}/s,
    "layoutDirective is no longer called with the family and its structure");
  assert.match(worker, /layoutDirective\(family, \{[\s\S]*?variant[\s\S]*?\)/,
    "the variant no longer rides with the directive");
  assert.ok(
    /generateSitePages\(env, withLayout, spec, brand\)/.test(worker),
    "the page generator is still called with the bare brief",
  );
});

test("the variant axis is reachable end to end", () => {
  // NINETEEN VARIANTS WERE DECLARED AND UNREACHABLE until 2026-08-02. Twelve
  // families named one, `layoutDirective` had accepted one since it was
  // written, and the designer's tool had no field for it — so no site could
  // ever use one. Eighth instance in this repo of built-and-unreachable, and
  // every previous one had most of the links working, which is why this is
  // asserted as a CHAIN rather than at any single point.
  const declared = FAMILY_NAMES.flatMap((n) =>
    Object.keys(FAMILIES[n].variants || {}).map((k) => `${n}/${k}`));
  assert.ok(declared.length > 0, "no family declares a variant — this guard is watching nothing");

  // 1. the module exposes them — and derives them from READY families, which
  //    with everything ready cannot be checked by VALUE: a filter and its
  //    superset agree exactly when nothing is filtered out. Same trap the
  //    READY_FAMILIES guard hit, so it is checked the same way, on the source.
  assert.deepEqual([...VARIANT_IDS].sort(), declared.filter((id) => READY_FAMILIES.includes(id.split("/")[0])).sort());
  const layouts = fs.readFileSync(path.join(ROOT, "builder/site-layouts.mjs"), "utf8");
  assert.match(layouts, /VARIANT_IDS = READY_FAMILIES\.flatMap\(/,
    "VARIANT_IDS no longer derives from READY_FAMILIES — a not-ready family's variant would be offered");
  assert.match(layouts, /function variantsForPrompt\(\)\s*\{[\s\S]*?for \(const n of READY_FAMILIES\)/,
    "variantsForPrompt no longer walks READY_FAMILIES");
  // 2. the prompt describes every one, so a name is never offered bare
  const blurbs = variantsForPrompt();
  for (const id of VARIANT_IDS) assert.ok(blurbs.includes(id + " —"), `${id} is offered with no description`);
  // 3. the tool offers them
  assert.match(worker, /variant: \{\s*\n\s*type: "string",\s*\n\s*enum: VARIANT_IDS,/,
    "the designer tool has no variant field again");
  assert.match(worker, /variantsForPrompt\(\)/, "the variant field describes nothing");
  // 4. it is OPTIONAL — a required variant would force one onto every site
  const req = worker.match(/required: \[("[a-z]+", ?)+"[a-z]+"\],\s*\n\s*\},\s*\n\};/);
  assert.ok(req, "the design tool's required list moved — this was matching some other tool's");
  assert.ok(!req[0].includes("variant"), "variant became required, so every site gets one forced on it");
  // 5. the route reads it off the designed schema and hands it to the build
  assert.match(worker, /variant: \(designed && designed\.variant\)/, "the design's variant is dropped at the route");
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\bvariant\b[^}]*\}\)/,
    "the build no longer takes a variant");
  // 6. it is RESOLVED before use, never passed through
  assert.match(worker, /resolveVariant\(family, variant\)/, "an unresolved variant reaches layoutDirective");
  // 7. and it lands in the directive
  for (const id of VARIANT_IDS) {
    const [fam, key] = id.split("/");
    const d = layoutDirective(fam, { variant: key });
    assert.ok(d && d.includes(`Variant — ${key}:`), `${id} produces no variant line`);
  }
});

test("a variant the family does not declare is DROPPED, not passed on", () => {
  // The load-bearing half. `layoutDirective` answers null for an unrecognised
  // variant and the call site turns a null directive into NO directive — so one
  // mismatched variant would cost the site its whole layout, silently. Losing
  // an optional refinement is the small loss.
  assert.equal(layoutDirective("store", { variant: "board" }), null, "the null case moved");
  assert.equal(resolveVariant("store", "crm/board"), null, "another family's variant is accepted");
  assert.equal(resolveVariant("store", "board"), null, "a bare key from another family is accepted");
  // THE ONE THAT ACTUALLY TESTS THE PREFIX. Every other cross-family case here
  // also fails the hasOwn check, so the two guards masked each other and
  // deleting the prefix check passed the whole suite. Here the key DOES exist
  // on the named family, so only the prefix can refuse it.
  assert.ok(Object.hasOwn(FAMILIES.restaurant.variants, "tap-list"), "premise moved: restaurant no longer declares tap-list");
  assert.equal(resolveVariant("restaurant", "gym/tap-list"), null,
    "a variant addressed to another family is applied anyway when the key happens to collide");
  assert.equal(resolveVariant("store", "store/single-product"), "single-product", "the namespaced form is refused");
  assert.equal(resolveVariant("store", "single-product"), "single-product", "the bare form is refused");
  assert.equal(resolveVariant("store", 7), null, "a non-string is not rejected");
  assert.equal(resolveVariant("nope", "single-product"), null, "an unknown family still resolves a variant");
});

test("a null directive is never interpolated into the brief", () => {
  // layoutDirective answers null for an unknown family or structure, and this
  // was `${brief}\n\n${layoutDirective(family)}` — so the brief would have
  // gained the literal word "null" and lost its layout, silently. Unreachable
  // while both come from enums; one hand-passed body.structure is all it takes.
  assert.equal(layoutDirective("store", { structure: "nope" }), null, "the null case moved");
  assert.match(worker, /const withLayout = directive \? /,
    "the directive is interpolated unguarded again");
});

test("the structure axis is offered, optional, and every name works", () => {
  // Optional on purpose, unlike the other three: every family declares a
  // sensible default, so a skipped answer is a good answer. The fonts field is
  // required because skipping it means no typeface at all — skipping this one
  // means "the shape this kind of site usually takes".
  assert.match(worker, /const SITE_STRUCTURE_IDS = STRUCTURE_NAMES;/);
  assert.match(worker, /enum: SITE_STRUCTURE_IDS/);
  const req = worker.match(/required: \[("[a-z]+", ?)+"[a-z]+"\],\s*\n\s*\},\s*\n\};/);
  assert.ok(req && !/"structure"/.test(req[0]), "structure is required, so a good default can never apply");
  for (const st of STRUCTURE_NAMES) {
    const d = layoutDirective("store", { structure: st });
    assert.ok(d && d.includes(STRUCTURES[st].text), `${st} is offered and does not reach the directive`);
  }
});

test("the structure reaches the route, and the model is told what each one is", () => {
  assert.match(worker, /structure: \(designed && designed\.structure\) \|\| \(body && body\.structure\)/);
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\bstructure\b[^}]*\}\)/);
  assert.match(worker, /structuresForPrompt\(\)/, "the eight are offered as bare names with no description");
  const blurbs = structuresForPrompt();
  for (const st of STRUCTURE_NAMES) assert.ok(blurbs.includes(st + " —"), `${st} is offered undescribed`);
});

test("omitting the structure keeps the family's own default", () => {
  // The whole reason it can be optional. If the override leaked in as undefined
  // and overwrote the default, every site would land on one shape.
  for (const name of READY_FAMILIES) {
    const fam = FAMILIES[name];
    const d = layoutDirective(name, {});
    assert.ok(d.includes(STRUCTURES[fam.structure].text), `${name} lost its default structure`);
  }
});

test("the container turns that name into real CSS, after the font write", () => {
  assert.match(buildServer, /function writeTheme\(/);
  assert.match(buildServer, /resolveTheme\(name\)/);
  // Ordering is the correctness argument: writeFonts restores styles.css from
  // the pristine base, so a theme written first is overwritten by it.
  const fontsAt = buildServer.indexOf("const fontsUsed = writeFonts(");
  const themeAt = buildServer.indexOf("const themeUsed = writeTheme(");
  assert.ok(fontsAt > 0 && themeAt > 0, "one of the two writes is missing");
  assert.ok(themeAt > fontsAt, "writeTheme runs BEFORE writeFonts and will be overwritten");
});

test("the theme write fails soft — a bad name never costs the site", () => {
  const fn = buildServer.slice(buildServer.indexOf("function writeTheme("));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(body, /if \(!theme\) return \{ applied: false/);
  assert.match(body, /catch/);
  assert.ok(!/throw/.test(body), "writeTheme can throw, which would take the build with it");
});

test("the designer is told what each family BUILDS, derived from the module", () => {
  // It described four of the 26 by hand and left the other 22 to be chosen from
  // a bare name. A hand-written sample is also the shape that drifts: the module
  // gains a family, the description does not, and nothing says so.
  assert.match(worker, /familiesForPrompt\(\)/, "the family field no longer carries the descriptions");
  const blurbs = familiesForPrompt();
  for (const name of READY_FAMILIES) {
    assert.ok(blurbs.includes(name + " —"), `${name} is offered with no description of what it builds`);
  }
});

test("the readiness gate is a real filter, not an alias", () => {
  // THIS ASSERTION USED TO DEMAND AT LEAST ONE NOT-READY FAMILY, on the ground
  // that with none the gate is never observed doing anything. True, and it made
  // the guard depend on the repo staying incomplete — it went red the day the
  // last family landed, which is the one day it should have been celebrating.
  //
  // Checking it against VALUES cannot work once every family is ready: an alias
  // and a filter agree exactly when nothing is filtered out. So it is checked
  // against the SOURCE instead, which is what stays true either way. Restore a
  // not-ready family tomorrow and this still holds.
  const layouts = fs.readFileSync(path.join(ROOT, "builder/site-layouts.mjs"), "utf8");
  assert.match(layouts, /READY_FAMILIES\s*=\s*FAMILY_NAMES\.filter\(\s*\(\s*\w+\s*\)\s*=>\s*FAMILIES\[\w+\]\.ready\s*\)/,
    "READY_FAMILIES no longer derives from the ready flag — a not-ready family would be offered to the designer");
  assert.match(layouts, /function familiesForPrompt\(\)\s*\{\s*return READY_FAMILIES/,
    "familiesForPrompt no longer reads READY_FAMILIES, so the gate has stopped applying to the prompt");
  // And the flag has to mean something: a family carrying `wants` is one the
  // gate exists for, so it may never also be ready.
  for (const [id, f] of Object.entries(FAMILIES)) {
    if (f.wants?.length) assert.equal(f.ready, false, `${id} wants components AND is offered to the designer`);
  }
});

test("every family the designer may pick produces a real directive", () => {
  assert.ok(READY_FAMILIES.length >= 26, `only ${READY_FAMILIES.length} ready families`);
  for (const name of READY_FAMILIES) {
    const d = layoutDirective(name);
    assert.ok(typeof d === "string" && d.length > 60, `${name} gives no usable directive`);
    assert.match(d, /LAYOUT —/, `${name}'s directive is not shaped like one`);
  }
});

test("the component shortlist covers every component a family declares", () => {
  // The floor. Each of the 26 families names the components its pages need, and
  // a shortlist missing one breaks that family rather than trimming a prompt —
  // which is why this is 157 and not the 100 originally asked for.
  const declared = new Set();
  for (const fam of Object.values(FAMILIES)) for (const c of fam.components || []) declared.add(c);
  const offered = new Set(UI_SHORTLIST);
  for (const c of declared) assert.ok(offered.has(c), `${c} is declared by a family and not offered to the model`);
});

test("every name in the shortlist is a real component", () => {
  const real = new Set(UI_COMPONENTS);
  for (const c of UI_SHORTLIST) assert.ok(real.has(c), `${c} is offered and does not exist`);
});

test("the LINT still knows all 2,058, so a real import is never refused", () => {
  // Only the PROMPT was shortened. Narrowing the lint too would turn "a
  // component the model was not told about" into "a component the pipeline
  // rejects", which is a much worse failure and a silent one.
  assert.ok(UI_COMPONENTS.length > 2000, `the lint's allow-list shrank to ${UI_COMPONENTS.length}`);
  assert.ok(UI_SHORTLIST.length < UI_COMPONENTS.length, "the shortlist is not actually shorter");
});

test("the rules do not claim the shortlist is everything that exists", () => {
  // Rule 3 used to say "these exist and nothing else does", which was already
  // wrong about the 882 charts and would now be wrong about 1,901 components
  // too. A false absolute in the prompt is how a whole tier goes unused.
  const i = PAGE_RULES.indexOf("THE KIT FOR EVERY CONTROL");
  const rule = PAGE_RULES.slice(i, i + 400);
  assert.ok(!/exist and nothing\s+else does/.test(rule), "rule 3 asserts a falsehood about the kit");
});

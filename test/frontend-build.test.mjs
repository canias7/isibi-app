// A FIRST BUILD IS FRONTEND ONLY — the design tool and the page prompt, split.
//
// Owner's call 2026-08-24: "at build time model only does frontend, the backend
// comes at later, when editing and when addon and whatever comes". Two prompts
// change and the two changes are one feature: a designer that declares no tables
// beside a generator still told to wire pages to them writes `useRows("menu")`
// against a schema with nothing in it.
//
// EVERY GUARD HERE IS DERIVED, and every one asserts BOTH directions. A
// derivation whose source stopped having a `backend` key would produce two
// identical tools and pass every check written for the smaller one; a drop list
// whose numbers stopped matching would produce two identical prompts and do the
// same. So each pair is "the frontend one lacks it" AND "the full one still has
// it" — the second is what keeps the first from going vacuous.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSchemaTool } from "./integration/schema-tool.mjs";
import { PAGE_RULES, FRONTEND_PAGE_RULES, frontendRules, siteHasTables, pagesRequest, pagesPrompt } from "../builder/page-gen.mjs";
import { PLAN_FIELDS } from "../builder/site-plan.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** Whole-line comments blanked, length-preserving — the convention every
 *  source-reading guard in this repo uses, because prose explaining a rule
 *  contains that rule's spelling. */
function bare(src) {
  const out = src.replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length))
    .replace(/^[ \t]*\*[^\n]*/gm, (m) => " ".repeat(m.length));
  assert.equal(out.length, src.length, "the comment blanker changed the length; offsets are no longer valid");
  return out;
}

/* ------------------------------------------------------------ the design tool */

test("the frontend tool is the full one with `backend` taken off, and only that", async () => {
  // THE REAL OBJECT, evaluated out of worker.js by `readSchemaTool` rather than
  // rebuilt here. A first draft restated the derivation and a mutation replacing
  // the destructure with a plain read SURVIVED — the test's own copy did the
  // right thing while the tool kept its backend. A test that reimplements the
  // thing under test agrees with itself.
  const { tool, frontendTool } = await readSchemaTool();
  const props = Object.keys(tool.input_schema.properties);
  const feProps = Object.keys(frontendTool.input_schema.properties);

  // THE PREMISE FIRST. Without this the assertions below are satisfied by a
  // tool that never had a backend, which is the vacuity this whole file is
  // arranged around.
  assert.ok(props.includes("backend"), "the FULL tool has no `backend` — this guard is measuring nothing");
  assert.ok(tool.input_schema.required.includes("backend"), "`backend` is no longer compelled on a build");

  // THE PROPERTY AND THE REQUIREMENT ARE TWO ASSERTIONS, because they fail
  // differently: a `backend` left in `properties` but out of `required` is a
  // designer that MAY still declare tables on a build that will not provision
  // them — a schema with no database under it — while the reverse is a build
  // refused for not answering a field it cannot see.
  assert.ok(!feProps.includes("backend"), "the frontend tool still OFFERS a backend, so a first build can declare one");
  assert.ok(!frontendTool.input_schema.required.includes("backend"), "the frontend tool still COMPELS a backend");

  // NOTHING ELSE MOVES. A frontend build must still be asked for the brand, the
  // slug, the stylesheet and the whole plan — a split that quietly dropped a
  // second field would leave a first build unable to name itself.
  assert.deepEqual(feProps, props.filter((k) => k !== "backend"),
    "the frontend tool differs from the full one by more than `backend`");
  assert.deepEqual(frontendTool.input_schema.required, tool.input_schema.required.filter((k) => k !== "backend"),
    "the frontend tool's required list differs from the full one by more than `backend`");
  for (const k of ["brand", "slug", "description", "css", "pages", "shape", "components", "images", "purpose", "action"]) {
    assert.ok(feProps.includes(k), "a first build can no longer be asked for `" + k + "`");
    assert.deepEqual(frontendTool.input_schema.properties[k], tool.input_schema.properties[k],
      "`" + k + "` was reworded on the frontend tool — the two must be the same field");
  }
  // And it is still the same tool by name, or `tool_choice` names something the
  // request does not carry and every first build 400s at the provider.
  assert.equal(frontendTool.name, tool.name, "the frontend tool was renamed — tool_choice would name nothing");
});

test("worker.js really derives the frontend tool rather than restating one", () => {
  const src = bare(WORKER);
  const at = src.indexOf("const FRONTEND_SCHEMA_TOOL = (() => {");
  assert.ok(at > 0, "FRONTEND_SCHEMA_TOOL is gone or was renamed");
  const block = src.slice(at, src.indexOf("})();", at));

  // BOTH HALVES COME OFF THE FULL TOOL. A hand-written copy is two tools that
  // drift, and the direction they drift in is a frontend build asked for
  // something the container cannot build.
  assert.match(block, /SITE_SCHEMA_TOOL\.input_schema\.properties/,
    "the frontend tool no longer takes its properties from the full one");
  assert.match(block, /SITE_SCHEMA_TOOL\.input_schema\.required\.filter/,
    "the frontend tool no longer derives its required list from the full one");
  assert.ok(!/properties: \{/.test(block), "the frontend tool declares properties of its own");
});

test("the two system prompts are different strings and each says the other's opposite", () => {
  const src = bare(WORKER);
  for (const name of ["SITE_SCHEMA_SYSTEM", "FRONTEND_SCHEMA_SYSTEM"]) {
    assert.ok(src.includes("const " + name + " ="), name + " is gone");
  }
  const full = src.slice(src.indexOf("const SITE_SCHEMA_SYSTEM ="));
  const fullText = full.slice(0, full.indexOf('";'));
  const fe = src.slice(src.indexOf("const FRONTEND_SCHEMA_SYSTEM ="));
  const feText = fe.slice(0, fe.indexOf('";'));

  // The full one is about tables; the frontend one says there are none. Both
  // are asserted, or a copy-paste that made them identical would pass.
  assert.match(fullText, /data model|tables/i, "the full designer prompt stopped being about the data model");
  assert.match(feText, /NO DATABASE/, "the frontend prompt does not say the site has no database");
  assert.ok(!/seed|access level|collect/i.test(feText),
    "the frontend prompt still talks about seeding, access levels or collect tables");

  // AND IT SAYS WHERE THE CONTENT LIVES. Deleting the table instructions leaves
  // a model that invents an API to fetch from — the `publicView` failure, where
  // a capability was conditioned on a fact the model was never given.
  assert.match(feText, /written into the page source/i,
    "the frontend prompt never says where the content actually goes");
});

test("the frontend prompt names both kinds — the mold is no longer hard-coded (2026-08-27)", () => {
  // THE ESPRESSO-MACHINE BUG. The prompt opened "You design a small business
  // website from one brief" — one kind of thing, asserted before the brief was
  // read — so a brief for a working tool ("a working tool rather than a
  // website", the owner's own CRM brief) was squeezed through the shopfront
  // mold: a marketing hero with a product photograph on a CRM. The prompt now
  // names the two kinds and the `kind` field carries the decision.
  const src = bare(WORKER);
  const fe = src.slice(src.indexOf("const FRONTEND_SCHEMA_SYSTEM ="));
  const feText = fe.slice(0, fe.indexOf('";'));
  // DERIVED FROM THE FIELD'S OWN ENUM, so a third kind added to the tool must
  // be described to the designer or this goes red — a value the model can
  // answer and was never told the meaning of is the `publicView` failure.
  assert.ok(Array.isArray(PLAN_FIELDS.kind && PLAN_FIELDS.kind.enum) && PLAN_FIELDS.kind.enum.length >= 2,
    "the kind field lost its enum — the answer is read by code and free text cannot be branched on");
  for (const k of PLAN_FIELDS.kind.enum) {
    assert.ok(feText.includes("`" + k + "`"), "the designer's prompt never names `" + k + "`");
  }
  // And the old single-kind opener must not come back as a tidy-up.
  assert.ok(!feText.includes("You design a small business website from one brief"),
    "the first sentence hard-codes one kind again — the espresso-machine mold restored");
});

test("a tool keeps one frame on every page — the css field says so (2026-08-27, run 47)", () => {
  // RUN 47's residue. The kind fix held (zero photographs, desk-first content),
  // and the designer's own stylesheet then gave the HOME page a 28rem centred
  // "front door" column while the inner pages got 72rem — the per-page scope
  // the css field documents, used exactly as documented, steered by the
  // world's own habit that "/" is an entry card. The guardrail is one sentence
  // beside the freedom, SCOPED TO `tool` so a shopfront's home page keeps the
  // whole freedom. Content floors rather than includes(""), and the sentence
  // must sit in the css FIELD — the layer that wrote the bad rule — not in a
  // prompt the stylesheet writer never reads.
  const src = bare(WORKER);
  const at = src.indexOf("THE SITE'S ENTIRE STYLESHEET");
  assert.ok(at > 0, "the css field description is no longer where this test looks");
  const end = src.indexOf("\n      },", at);
  assert.ok(end > at, "the css field never closes");
  // The field is a concatenation of string literals, so a phrase can span a
  // `" + "` seam — join them back into the wire text before asserting.
  const field = src.slice(at, end).replace(/" \+\s*"/g, "");
  assert.match(field, /ON A `tool`, ONE FRAME FOR EVERY PAGE/,
    "the css field no longer scopes the one-frame rule to a tool");
  assert.match(field, /same width and frame as the working screens/,
    "the rule stopped saying what the home page keeps");
  assert.match(field, /never a narrower centred column/,
    "the rule stopped forbidding the narrow home column — run 47's exact defect");
  // And it sits AFTER the per-page freedom it bounds, in the same field — a
  // guardrail printed before the freedom reads as contradicted by it.
  const scope = field.indexOf("ONE PAGE CAN HAVE ITS OWN LOOK");
  const rule = field.indexOf("ON A `tool`, ONE FRAME FOR EVERY PAGE");
  assert.ok(scope > 0 && rule > scope,
    "the one-frame rule does not follow the per-page scope it bounds");
});

test("an invented brand stays inside the brief (2026-08-27, owner's call)", () => {
  // Four runs of one nameless CRM brief invented four names and two named the
  // WRONG business — a machinery dealer branded like a coffee shop. The rule,
  // in the owner's words: "invent something that is related to what the
  // customer wants." Content floors on the three load-bearing clauses; no
  // example names are asserted because none may exist — an example name is a
  // name some site eventually wears.
  const src = bare(WORKER);
  const at = src.indexOf("Short display name for the site.");
  assert.ok(at > 0, "the brand field description is no longer where this test looks");
  const field = src.slice(at, at + 900).replace(/" \+\s*"/g, "");
  assert.match(field, /that name, exactly as written/,
    "the brand field no longer says a brief-given name wins verbatim");
  assert.match(field, /FOR THE BUSINESS THE BRIEF DESCRIBES/,
    "the brand field no longer ties an invented name to the described business");
  assert.match(field, /never a brand for the thing it sells/,
    "the field stopped forbidding the product-brand drift — the Brewline defect");
});

test("only the build route asks for the frontend tool, and it does so on a first build", () => {
  const src = bare(WORKER);
  const calls = [...src.matchAll(/designSiteSchema\(/g)];
  // The declaration plus three call sites. A fourth would need a decision.
  assert.equal(calls.length, 4, `designSiteSchema is named ${calls.length} times; the declaration plus three lanes`);

  // The default is FALSE, which is what keeps the two edit lanes whole by
  // saying nothing — and what a fourth lane would inherit.
  // THE WHOLE DECLARATION LINE, not `\(([^)]*)\)`. A parameter list containing
  // `modelsFor().design` closes at the FIRST `)`, so a flat scan reads the
  // signature four parameters short — the fifth recorded instance in this repo
  // of a flat scan where a depth-aware or line-anchored one was needed.
  const decl = (src.match(/^async function designSiteSchema\(.*$/m) || [""])[0];
  assert.match(decl, /frontendOnly = false\) \{$/,
    "the frontend flag is no longer the last parameter, defaulted off — a lane that says nothing would lose its backend");

  // Exactly one call passes it, and it passes the computed fact rather than a
  // literal — a hardcoded `true` there is every revise losing its backend.
  const passing = [...src.matchAll(/designSiteSchema\([^;]*?firstBuild[^;]*?\)/g)];
  assert.equal(passing.length, 1, `${passing.length} call sites pass firstBuild; exactly one can`);
  assert.ok(!/designSiteSchema\([^;]*?,\s*true\s*\)/.test(src),
    "a call site hardcodes the frontend flag");
});

test("`firstBuild` treats cannot-tell as a revise, not as a fresh site", () => {
  const src = bare(WORKER);
  const at = src.indexOf("const firstBuild =");
  assert.ok(at > 0, "the first-build decision is gone");
  const line = src.slice(at, src.indexOf("\n", at));

  // THREE STATES, AND THE THIRD DECIDES. `namedRow` is a row, `null` (free
  // name), or `undefined` (the lookup threw). Reading the third as a first build
  // would hand a revise of a real site a tool with no backend in it, silently,
  // on the one path where the customer is asking to change what it stores.
  assert.match(line, /namedRow === null/,
    "the first-build test is no longer an identity check against null, so a failed lookup reads as a fresh site");
  assert.ok(!/!namedRow\b/.test(line), "`!namedRow` treats a failed lookup as a first build");

  // And the row is fetched in a way that CAN be undefined on a throw.
  assert.match(src, /siteBackendRowFresh\(env, namedSlug\)\.catch\(\(\) => undefined\)/,
    "the ownership read no longer distinguishes a throw from an absent row");
});

/* ---------------------------------------------------------- the page prompt */

test("the frontend page prompt names no data hook outside the rule that forbids them", () => {
  // DERIVED FROM `rows.ts` ITSELF, so a hook added to the client is covered here
  // without anybody remembering this file.
  const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  const hooks = [...new Set([...rows.matchAll(/export function (use[A-Z]\w*)/g)].map((m) => m[1]))];
  assert.ok(hooks.length >= 8, `only ${hooks.length} hooks found in rows.ts — the scan stopped matching`);

  // The forbidding rule is where they are ALLOWED to appear, and it is the first
  // rule, so everything after it is the region under test. Both ends asserted:
  // the rule must exist and it must be where this thinks it is.
  const cut = FRONTEND_PAGE_RULES.indexOf("\n2. ");
  assert.ok(cut > 0, "the frontend prompt has no rule 2 — the numbering broke");
  const head = FRONTEND_PAGE_RULES.slice(0, cut);
  const body = FRONTEND_PAGE_RULES.slice(cut);
  assert.match(head, /NOTHING IS FETCHED AND NOTHING IS STORED/, "rule 1 is no longer the no-data rule");

  for (const h of hooks) {
    assert.ok(!body.includes(h), "the frontend prompt still teaches `" + h + "` — a page that imports it does not compile");
  }
  assert.ok(!body.includes("@/lib/rows"), "the frontend prompt still points at @/lib/rows outside rule 1");

  // THE PREMISE: the FULL prompt does teach them. Without this the loop above
  // passes against a pair of prompts neither of which mentions a hook.
  for (const h of ["useRows", "useCreateRow"]) {
    assert.ok(PAGE_RULES.includes(h), "the full prompt no longer teaches `" + h + "` — this guard is measuring nothing");
  }
});

test("the frontend prompt keeps every craft rule and renumbers without a dangling reference", () => {
  const nums = [...FRONTEND_PAGE_RULES.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepEqual(nums, nums.map((_, i) => i + 1), "the frontend rules are not numbered 1..N with no gaps");
  assert.ok(nums.length >= 6, `only ${nums.length} rules survived; the kit, pictures, charts and logical sides all have to`);

  // RENUMBERING IS ONLY SAFE WHILE NOTHING POINTS AT A NUMBER. The full prompt
  // has exactly one "rule N" cross-reference and it lives in a dropped section;
  // a new one added to a KEPT rule would silently point at the wrong rule here.
  assert.deepEqual([...FRONTEND_PAGE_RULES.matchAll(/\brule\s+\d+/gi)].map((m) => m[0]), [],
    "a rule cross-reference survived the renumbering and now points at the wrong rule");

  // The four that carry the craft rather than the data, by their own headline.
  for (const needle of [
    /THE KIT FOR EVERY CONTROL/,
    /EVERY PICTURE IS `<SafeImage>`/,
    /A CHART COMES FROM/,
    /SIDES ARE LOGICAL/,
    /## Routing/, /## Styling/, /## Motion/, /## Charts/, /## The gate/,
  ]) assert.match(FRONTEND_PAGE_RULES, needle, "a kept region is missing from the frontend prompt: " + needle);

  // And the ones that could only ever be about a database are gone.
  for (const needle of ["## Reading rows", "## Visitor accounts", "RESPECT THE ACCESS LEVEL", "FORMS ARE react-hook-form"]) {
    assert.ok(!FRONTEND_PAGE_RULES.includes(needle), "a data region survived: " + needle);
    assert.ok(PAGE_RULES.includes(needle), "the full prompt lost `" + needle + "` — this guard is measuring nothing");
  }
});

test("both prompts refuse CommonJS, which is the one rule the split duplicates", () => {
  // Rule 1 is written fresh rather than derived, so its CommonJS half is a
  // second copy. The PROPERTY is what is held, not the wording: a page that
  // calls `require()` typechecks, bundles, and then takes the section down.
  for (const [name, text] of [["full", PAGE_RULES], ["frontend", FRONTEND_PAGE_RULES]]) {
    assert.match(text, /require\(\)/, name + " no longer refuses require()");
    assert.match(text, /module\.exports/, name + " no longer names module.exports");
  }
});

test("a replacement that stops matching throws rather than shipping a stale prompt", () => {
  // The two sentences inside KEPT regions that say the wrong thing here were
  // found by the derived guard above, not by the drop list — `## Charts` told a
  // model with no database to "hand it `useRows(...)` data". A replacement whose
  // `from` stops matching is silent, so `frontendRules` refuses.
  assert.throws(() => frontendRules("## Hard rules\n\n1. nothing\n\n## The gate\n\nnothing here matches"),
    /a replacement no longer matches/,
    "frontendRules accepted rules it could not correct");
});

/* ------------------------------------------------ no database on a first build */

test("provisioning is decided by the schema, never by the frontend flag", () => {
  const src = bare(WORKER);
  const at = src.indexOf("const needsDb =");
  assert.ok(at > 0, "the provisioning decision is gone");
  const line = src.slice(at, src.indexOf("\n", at));

  // A FACT, NOT A FLAG. Keyed on `firstBuild` the answer would be wrong the
  // moment anything adds a site's first table — the addon lane, a full revise,
  // a caller-supplied schema — and the site would have a schema with no database
  // under it. Keyed on the spec it cannot go stale.
  assert.match(line, /spec\.tables\.length/, "provisioning no longer follows what was declared");
  assert.ok(!/firstBuild/.test(line), "provisioning follows the frontend flag, which cannot see a later table");

  // AND THE OTHER HALF: a revise that declares nothing must still resolve the
  // database the site already has, or `pageSpec` falls back to this request's
  // empty spec and the generator rewrites every page believing it stores nothing.
  assert.match(line, /ownerConn/, "a revise that declares no table would lose its own database");
});

test("everything downstream asks whether there IS a database, not whether one was wanted", () => {
  const src = bare(WORKER);
  // `db` is what exists; `needsDb` is a decision. Sending `null` into `neon()`
  // answers with a sentence about `[object Object]` and reads as a schema-engine
  // failure — the misread this repo has recorded three times.
  for (const [call, why] of [
    [/if \(db\) made = await applySiteSchema\(db, spec\)/, "the schema apply is not gated on the connection"],
    [/if \(db\) seeded = await seedSiteRows\(db, /, "seeding is not gated on the connection"],
    [/const stored = db \? await loadSiteSchema\(db\) : null/, "the merged-schema read is not gated on the connection"],
  ]) assert.match(src, call, why);

  // The response tells the truth about it rather than claiming one always exists.
  assert.match(src, /backend: !!db,/, "the build response hardcodes `backend` again");
});

test("a site with no database still claims its slug, and a revise never re-claims", () => {
  const src = bare(WORKER);
  assert.match(src, /async function claimSiteSlug\(env, slug, uid, brief\)/, "claimSiteSlug is gone");

  // ATOMIC, and the same header `ensureSiteBackend` uses. An upsert here would
  // let two overlapping first builds of one name both succeed — and would let a
  // revise blank a live site's `neon_db`.
  const fn = src.slice(src.indexOf("async function claimSiteSlug"), src.indexOf("\n}", src.indexOf("async function claimSiteSlug")));
  assert.match(fn, /resolution=ignore-duplicates,return=representation/,
    "the claim is not atomic on the primary key, so a race can overwrite somebody's site");
  assert.ok(!/merge-duplicates/.test(fn), "the claim upserts, so a revise could blank a live site's database name");
  assert.match(fn, /neon_db: ""/, "the claim no longer records an empty database name");
  assert.match(fn, /conflict: true/, "a lost claim no longer reports as a name clash");

  // AND IT IS ONLY REACHED WHEN THERE IS NOTHING TO PROVISION AND NO SITE THERE.
  const at = src.indexOf("if (needsDb) {");
  assert.ok(at > 0, "the provisioning branch was reshaped");
  const block = src.slice(at, src.indexOf("tr.at(\"provision\"", at));
  assert.match(block, /ensureSiteBackend\(env, slug, bu\.id, brief/, "the provisioning branch no longer provisions");
  assert.match(block, /else if \(!existing\) \{\s*await claimSiteSlug\(/,
    "the claim is not gated on the site being new — a revise would 409 itself");
});

test("the placeholder does not promise a database to a site that has none", () => {
  // IT IS THE ONE PAGE A FAILED BUILD LEAVES THE OWNER, so a false claim on it
  // is a claim they have nothing else to check against. The subtitle was
  // hardcoded "Database is live. These tables were created for this site." —
  // true on every build until 2026-08-25 and false on every first build since.
  const src = bare(WORKER);
  const at = src.indexOf("function schemaPlaceholderPage");
  assert.ok(at > 0, "schemaPlaceholderPage is gone");
  const fn = src.slice(at, src.indexOf("\n}", at));
  // ON THE GATE, NOT ON THE WHOLE EXPRESSION. This read `(tables ? "Database is
  // live` — pinned to `tables` being the FIRST test in the ternary — and went
  // red on 2026-08-25 when a third case (the stand-in published before the
  // pages exist) was added ahead of it. The claim was never about position: it
  // is that the database sentence is reachable only when there are tables.
  assert.match(fn, /\btables\s*\n?\s*\?\s*"Database is live/,
    "the placeholder claims a live database whether or not there is one");
  // Both halves exist, or a fix that deleted the true sentence would pass.
  assert.match(fn, /Database is live/, "the database sentence is gone from the tabled case");
  assert.match(fn, /Nothing was lost/, "a site with no tables gets no sentence of its own");
});

test("the no-tables refusal cannot fire on a build that was never asked for tables", () => {
  const src = bare(WORKER);
  const at = src.indexOf("if (!spec.tables.length && !existing");
  assert.ok(at > 0, "the no-tables refusal is gone");
  const line = src.slice(at, src.indexOf("\n", at));
  assert.match(line, /firstBuild && !body\.schema/,
    "a frontend build is refused for declaring nothing it was never asked for");
  // A CALLER-SUPPLIED SCHEMA IS STILL REFUSED. That path never went near the
  // frontend tool, so an integrator sending zero tables is still sending nonsense.
  assert.match(line, /!body\.schema/, "the explicit-schema refusal was widened away");
});

/* ------------------------------------------------------------- the wiring */

test("which prompt is sent follows the SPEC, so the addon lane moves a site over for free", () => {
  const withTables = { tables: [{ name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] }] };
  assert.equal(siteHasTables(withTables), true);
  for (const empty of [{ tables: [] }, {}, null, undefined, { tables: "menu" }]) {
    assert.equal(siteHasTables(empty), false, "a spec with no usable table list read as having tables");
  }

  const a = pagesRequest({ brief: "a cafe", spec: withTables, brand: "Cafe" });
  const b = pagesRequest({ brief: "a cafe", spec: { tables: [] }, brand: "Cafe" });
  assert.equal(a.system[0].text, PAGE_RULES, "a site with tables is not sent the data prompt");
  assert.equal(b.system[0].text, FRONTEND_PAGE_RULES, "a site with no tables is not sent the frontend prompt");

  // The schema block follows the same fact, or the rules and the brief disagree
  // about whether there is a database.
  assert.match(pagesPrompt("a cafe", withTables, "Cafe"), /THE SCHEMA THAT EXISTS/);
  const feBrief = pagesPrompt("a cafe", { tables: [] }, "Cafe");
  assert.match(feBrief, /THIS SITE'S DATA/, "a tableless brief still promises a schema that exists");
  assert.ok(!feBrief.includes("THE SCHEMA THAT EXISTS"), "both schema headings landed in one prompt");
});

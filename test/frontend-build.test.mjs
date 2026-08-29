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

// The css field's opening sentence — ONE anchor for the four guards below,
// because four copies of a spelling is four tests that go red together on a
// rewording (which is exactly what happened when the field's opener changed
// from "THE SITE'S ENTIRE STYLESHEET" to the on-request contract, 2026-08-27).
const CSS_FIELD_OPEN = "CSS ON TOP OF THE THEME, ONLY WHEN ASKED";

test("the css field carries the axes as a DECISION LIST — no options, no engine", () => {
  // Owner's call, 2026-08-27: "lets do the test build with this new axes."
  // The 65-axis list returns as decisions the model makes in its own
  // stylesheet — squared with the 2026-08-22 law ("no names, the model writes
  // its own css") by carrying no options and driving no engine. Since the
  // themes returned the same day, the list is GATED — it binds when the
  // customer asked for a whole custom look, not on every build.
  const src = bare(WORKER);
  const at = src.indexOf(CSS_FIELD_OPEN);
  assert.ok(at > 0, "the css field moved — this guard is reading nothing");
  const end = src.indexOf("\n      },", at);
  assert.ok(end > at, "the css field's close moved");
  const field = src.slice(at, end).replace(/" \+\s*"/g, "");
  // The load-bearing sentences, as content floors — each is an instruction
  // whose deletion is silent.
  assert.match(field, /WHEN THE CUSTOMER ASKS FOR A LOOK OF YOUR OWN[\s\S]{0,120}decide every axis below, in the stylesheet itself/,
    "the axes' framing sentence is gone — the list reads as a menu, or as unconditional again");
  assert.match(field, /For a single ask, write only the rules that answer it/,
    "the single-ask restraint is gone — every colour request invites a whole design");
  for (const group of ["MOTION —", "TYPE —", "LAYOUT —", "SURFACE & DEPTH —", "SCROLL —", "SCALE —"]) {
    assert.ok(field.includes(group), "the " + group.slice(0, -2) + " group is gone from the axes");
  }
  // The two reframes that must not quietly regress into choices:
  assert.match(field, /Always inside @media \(prefers-reduced-motion: no-preference\)/,
    "reduced motion stopped being a rule — removing animation for people who ask is accessibility, not taste");
  assert.match(field, /On a `tool`, motion is restraint/,
    "the tool restraint clause is gone — a work screen gets entrance animations again");
  // …AND THE OMISSION: `direction` is the language system's, and a style axis
  // for it re-breaks every right-to-left site. Asserted on the axes block
  // alone, because direction-adjacent words legitimately appear elsewhere in
  // the field. The block closes on the layering sentence now — the old close
  // was "The sheet itself IS the theme", a claim the registry's return made
  // false.
  const axes = field.slice(field.indexOf("WHEN THE CUSTOMER ASKS FOR A LOOK"), field.indexOf("A full sheet REPLACES the theme's answers"));
  assert.ok(axes.length > 500, "the axes block collapsed — the omission check below is reading nothing");
  assert.doesNotMatch(axes, /direction/i,
    "`direction` became an axis — a stylesheet fighting `dirFor` re-breaks RTL");
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
  const at = src.indexOf(CSS_FIELD_OPEN);
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

// ── THE COMPONENT CSS BLOCK AND THE HOOKS IT NAMES (2026-08-27, arm C) ──────
//
// Run 48 ("Brewline") wrote ~20 component rules and every one matched nothing:
// it guessed hooks (`side-nav`, `stat-card`, `data-table`…) that only 26 of
// 2,112 kit files carried. Two halves fix it and each alone is the other's
// dead half — a stamped kit the prompt never mentions is unreachable, and a
// prompt naming hooks the kit does not carry is the dead-selector bug
// REINTRODUCED BY US. So the guard is derived across the seam: every slot the
// css field names must be stamped in the kit, and the kit's census must hold.

function cssFieldText() {
  const src = bare(WORKER);
  const at = src.indexOf(CSS_FIELD_OPEN);
  assert.ok(at > 0, "the css field moved — this guard is reading nothing");
  const end = src.indexOf("\n      },", at);
  assert.ok(end > at, "the css field's close moved");
  // Seam-join the concatenated literals, then UNESCAPE the quotes: the source
  // spells `[data-slot=\"button\"]` and the floors below assert what the MODEL
  // reads, which is the unescaped form.
  return src.slice(at, end).replace(/" \+\s*"/g, "").replace(/\\"/g, '"');
}

test("the css field teaches the component hooks, the states, and the three rules", () => {
  const field = cssFieldText();
  // The framing sentence and the convention — without these the stamped kit
  // is invisible: a model that is not told the hooks are real goes back to
  // guessing, which is run 48 exactly.
  assert.match(field, /EVERY COMPONENT CAN BE RESTYLED/,
    "the component-css framing sentence is gone — the stamped kit is untold, i.e. unreachable");
  assert.ok(field.includes('data-slot="<its-name>"'),
    "the hook convention (kebab-case file name) is gone");
  assert.match(field, /A selector you invent matches nothing/,
    "the warning that stops hook-guessing is gone — run 48's failure mode reopens");
  // The state attributes, each a real DOM fact a model cannot guess:
  for (const state of ['[data-state="open"]', '[aria-invalid="true"]', '[aria-current="page"]', ":disabled", ":focus-visible"]) {
    assert.ok(field.includes(state), "the " + state + " state is no longer named");
  }
  // The component axis groups — the owner's 70, grouped. Deleting a header
  // silently drops a whole dimension of the list.
  for (const group of ["COMPONENT SIZE & SPACING —", "INTERNAL LAYOUT —", "COMPONENT COLOR & SURFACE —",
                       "TYPE IN COMPONENTS —", "PIECES —", "STATES —", "MOTION IN COMPONENTS —", "INTERACTION —"]) {
    assert.ok(field.includes(group), "the " + group.slice(0, -2) + " component group is gone");
  }
  // THE SKIN/STRUCTURE LAW (run 51) — the universal line the shell collision
  // proved was missing: the first hooked build re-gridded `site-chrome` and
  // dealt header/page/footer into columns. The cascade guard (SHELL_GUARD)
  // makes ignoring the law inert; the law is what makes the guard never
  // needed. Each floor is a sentence whose deletion is silent.
  assert.match(field, /A COMPONENT'S SKIN IS YOURS; ITS STRUCTURE IS ITS OWN/,
    "the skin/structure law is gone — the next sheet re-arranges a component again");
  assert.match(field, /never re-grid or re-position it/,
    "the shell's load-bearing sentence is gone");
  assert.match(field, /BELOW the header, never over it/,
    "the sticky-nav rule is gone — the next side nav parks over the header again");
  assert.match(field, /ONE navigation per site/,
    "the one-nav rule is gone — the next tool ships two menus again");
  // The three RULES inside the list — each is the difference between styling
  // a control and breaking it, and each deletion is silent:
  assert.match(field, /restyle the ring, never remove it/,
    "the focus-visible rule is gone — keyboard users lose the ring on the next styled build");
  assert.match(field, /comfortable under a thumb/,
    "the touch-target rule is gone — most visitors are on a phone");
  assert.match(field, /pointer-events stays ON every control/,
    "the pointer-events rule is gone — one decorative rule away from an unclickable button");
});

test("every hook the css field names is really stamped in the kit — and the census holds", () => {
  const field = cssFieldText();
  const block = field.slice(field.indexOf("EVERY COMPONENT CAN BE RESTYLED"),
                            field.indexOf("DECIDE THE COMPONENTS' OWN CSS"));
  assert.ok(block.length > 200, "the hook block collapsed — the slot scan below is reading nothing");
  // DERIVED, not listed: the slots are read out of the prompt itself, so a
  // name added there tomorrow is checked against the kit with nobody
  // remembering this file. Floor of 8 so a scan that stops matching cannot
  // report a clean seam over nothing.
  const named = [...block.matchAll(/\[data-slot=\\?"([a-z0-9-]+)\\?"\]/g)].map((m) => m[1]);
  assert.ok(named.length >= 8, "the prompt names fewer than 8 hooks — the scan or the list broke");
  const dir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
  for (const slot of named) {
    const file = new URL(slot + ".tsx", dir);
    assert.ok(fs.existsSync(file), `the prompt names [data-slot="${slot}"] and the kit has no ${slot}.tsx`);
    const src = fs.readFileSync(file, "utf8");
    assert.ok(src.includes(`data-slot="${slot}"`),
      `the prompt names [data-slot="${slot}"] and ${slot}.tsx does not stamp it — a dead selector WE published`);
  }
  // The census: the codemod stamped the kit wholesale, and a regression here
  // (a revert, a kit refresh from upstream) silently un-stamps components the
  // prompt promises are addressable. Floors, not exact counts, so ordinary
  // kit growth cannot go red.
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));
  assert.ok(files.length >= 2100, "the kit shrank below the census floor — recalibrate deliberately");
  let stamped = 0;
  for (const f of files) if (fs.readFileSync(new URL(f, dir), "utf8").includes("data-slot=")) stamped++;
  assert.ok(stamped >= 1900,
    `only ${stamped} of ${files.length} kit files carry data-slot — the stamping regressed`);
  // THE PASS-THROUGH PREMISES, each one edit from false. Three of the named
  // hooks reach the DOM only because a primitive forwards them: Card and
  // Button spread {...props} AFTER their own data-slot (so a passed slot
  // wins), and OverflowScroller forwards {...rest}. Proven in a real render
  // when they landed; held here as source facts so the render stays true.
  for (const [prim, own] of [["card", "card"], ["button", "button"]]) {
    const src = fs.readFileSync(new URL(prim + ".tsx", dir), "utf8");
    const at = src.indexOf(`data-slot="${own}"`);
    const spread = src.indexOf("{...props}", at);
    assert.ok(at > 0 && spread > at,
      `${prim}.tsx no longer spreads {...props} after its own data-slot — every composite stamped through it goes dead`);
  }
  const scroller = fs.readFileSync(new URL("overflow-scroller.tsx", dir), "utf8");
  assert.ok(scroller.indexOf("{...rest}") > scroller.indexOf('data-slot="overflow-scroller"') &&
            scroller.includes("...rest"),
    "OverflowScroller stopped forwarding — data-table, comparison-table and category-nav go dead");
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
  assert.match(field, /TYPE OF BUSINESS THE CUSTOMER ASKED FOR/,
    "the brand field no longer ties an invented name to what the customer asked for");
  assert.match(field, /never one for the thing it sells/,
    "the field stopped forbidding the product-brand drift — the Brewline defect");
});

test("the description is built from the brief and carries no worked example (2026-08-27)", () => {
  // Fourth field to lose its baked example — a barber shop ending "Book
  // online." sat in front of every build, tools included. The replacement is
  // the owner's law: every FACT comes from the brief, condensing allowed,
  // adding not. The 160-char cap and the where-it-appears sentence stay —
  // pipeline facts the model cannot know.
  const src = bare(WORKER);
  const at = src.indexOf("One sentence describing the business");
  assert.ok(at > 0, "the description field is no longer where this test looks");
  const field = src.slice(at, at + 900).replace(/" \+\s*"/g, "");
  assert.match(field, /built FROM THE BRIEF/,
    "the description field no longer sources its facts from the brief");
  assert.match(field, /never facts invented/,
    "the no-invented-facts law is gone");
  assert.match(field, /Under 160 characters/,
    "the length cap is gone — link previews truncate mid-word");
  assert.ok(!/Skin fades/.test(field), "the barber-shop example is back — every site will copy its shape");
  assert.ok(!/Book online/.test(field), "the shopfront call-to-action example is back, tools included");
});

test("only the build route asks for the frontend tool, and it does so on a first build", () => {
  const src = bare(WORKER);
  const calls = [...src.matchAll(/designSiteSchema\(/g)];
  // The declaration plus two call sites — the build/revise route and the addon
  // lane. Both really do re-DESIGN: they regenerate pages, so the whole design
  // tool is what they need.
  //
  // IT WAS THREE UNTIL 2026-08-29, and the one that went is the change (owner:
  // "it should be 2 separated path tho"). The `look` lane called this — the
  // BUILD's designer, with the build's tool and the build's system text — to
  // change one colour on a live site. It now runs the edit path
  // (`builder/site-lanes.mjs`), which imports nothing from this file.
  //
  // A COUNT IS THE WEAK HALF OF THIS TEST and is here only to make a new call
  // site a decision somebody makes on purpose; the two assertions below are the
  // property, and they hold however many callers there are.
  assert.equal(calls.length, 3, `designSiteSchema is named ${calls.length} times; the declaration plus the build route and the addon lane`);

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

// The site plan is AUTHORED, not looked up (owner's call, 2026-08-20).
//
// `design_schema` took `family` — one of 100 pre-written trades — and the
// platform looked up a table row for the purpose, the shape, the page set, the
// verb and the components. The owner's direction is that the model decides all
// six per site. This file holds what that module has to get right.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PLAN_KEYS, PLAN_EDIT_FIELDS, PLAN_FIELDS, PLAN_REQUIRED,
  normalizePlan, directiveFromPlan, hasPlan,
  MAX_SHAPE, MAX_PAGES, MAX_ACTION, MAX_COMPONENTS,
} from "../builder/site-plan.mjs";
import { FAMILIES, layoutDirective, STRUCTURE_NAMES } from "../builder/site-layouts.mjs";
import { planBudget, imageBudget, budgetFor } from "../builder/site-images.mjs";

const GOOD = {
  purpose: "the slot picker is the hero; everything else supports the appointment",
  structure: "sidebar",
  shape: ["the chair list leads", "prices, then the form", "a dead end is the failure"],
  pages: [{ path: "/", role: "book a chair" }, { path: "/prices", role: "what each cut costs" }],
  action: ["Book now"],
  components: ["availability-grid", "week-strip", "price-list"],
};

/* ── the field order IS the fix ─────────────────────────────────────────── */

test("COMPONENTS IS PICKED LAST, AFTER THE PAGE LIST IT IS FOR", () => {
  // THE WHOLE POINT OF THE CHANGE, and the one property that cannot be allowed
  // to drift. A tool schema's property order is the order the model fills the
  // fields in, so this decides what the designer knows when it picks each value.
  //
  // `components` names which components the page writer is shown the props of, so
  // a wrong pick is a component used blind, with invented props, refused by
  // `tsc` and turned into a stubbed page. Last means the model has already
  // written the purpose, the skeleton, the shape, THE PAGE LIST AND EVERY PAGE'S
  // ROLE, and the verb — it is choosing for four pages it has just decided to
  // build rather than for a trade in the abstract.
  //
  // Measured on the mechanism this replaced: over 324 exemplar pages a family
  // LISTED 8.0 components and its own pages IMPORTED 12.1, so 42% of every reach
  // lay outside the list and only 2 of 100 lists covered what their pages used.
  // That is what picking with no page list in hand is worth.
  assert.equal(PLAN_KEYS[PLAN_KEYS.length - 1], "components",
    "components is no longer the last field, so it is picked before the pages exist — the bug this change was made to fix");
  assert.ok(PLAN_KEYS.indexOf("pages") < PLAN_KEYS.indexOf("components"),
    "the page list is written AFTER the components that are supposed to serve it");
});

test("…and the TOOL's own key order is that order, which is what makes it true", () => {
  // `PLAN_KEYS` is a list in a module; what the model reads is the object spread
  // into `design_schema.properties`. If the two disagree the constant above is a
  // claim about nothing — asserted because it is invisible from either side.
  assert.deepEqual(Object.keys(PLAN_FIELDS), PLAN_KEYS,
    "the tool's fields are in a different order from PLAN_KEYS, so the ordering guard above proves nothing");
});

test("every axis is required, and the edit list is the same six", () => {
  // Each one is a LINE of the directive, so a skipped answer is a line the page
  // writer never sees. Derived at both ends rather than restated.
  assert.deepEqual([...PLAN_REQUIRED].sort(), [...PLAN_KEYS].sort());
  assert.deepEqual([...PLAN_EDIT_FIELDS].sort(), [...PLAN_KEYS].sort());
});

/* ── normalizePlan: the caps are in code, not only in the descriptions ──── */

test("A CAP A MODEL IS MERELY TOLD ABOUT IS NOT A CAP", () => {
  // This repo's standing distinction, and the reason `MAX_CLARIFY` is arithmetic
  // rather than a sentence. Every one of these is stated in a description AND
  // enforced here; a model that ignores the sentence still cannot exceed it.
  const big = normalizePlan({
    ...GOOD,
    shape: Array.from({ length: 20 }, (_, i) => "line " + i),
    action: Array.from({ length: 20 }, (_, i) => "Verb " + i),
    components: Array.from({ length: 200 }, (_, i) => "comp-" + i),
    pages: Array.from({ length: 40 }, (_, i) => ({ path: "/p" + i, role: "role " + i })),
  });
  assert.equal(big.shape.length, MAX_SHAPE);
  assert.equal(big.action.length, MAX_ACTION);
  assert.equal(big.components.length, MAX_COMPONENTS);
  assert.equal(big.pages.length, MAX_PAGES);
});

test("a value that merely STRINGIFIES is refused, not coerced", () => {
  // `String(["a","b"])` is `"a,b"` — one entry wearing two answers — which this
  // codebase has been bitten by four times (a role, an access level, a mode, a
  // build model). A list is not built out of a non-list either.
  const out = normalizePlan({ ...GOOD, shape: "not a list", components: ["ok", 7, null, ["a", "b"], {}] });
  assert.equal(out.shape, undefined, "a bare string became the shape");
  assert.deepEqual(out.components, ["ok"], "a non-string entry was coerced into a component name");
});

test("a page the pipeline could not address is DROPPED, never repaired", () => {
  // The same shape `validatePages` and `routeOf` already agree on. Repairing one
  // is guessing what the model meant, and a wrong guess names a page the
  // generator then writes at an address nothing routes to.
  const out = normalizePlan({
    ...GOOD,
    pages: [
      { path: "/", role: "home" },
      { path: "book", role: "no leading slash" },
      { path: "/book.tsx", role: "an extension" },
      { path: "/book/", role: "a trailing slash" },
      { path: "/my page", role: "a space" },
      { path: "/about/team", role: "nested is fine" },
      { path: "/x", role: "" },
      { role: "no path at all" },
    ],
  });
  assert.deepEqual(out.pages.map((p) => p.path), ["/", "/about/team"]);
});

test("…and CASE is the one thing it does normalise, on purpose", () => {
  // `/Book` and `/book` are one route written two ways, with no second thing it
  // could have meant — and these paths feed the DIRECTIVE rather than a
  // filename, so lowercasing tells the model to build a legal route where
  // dropping would silently delete a page it asked for. Asserted apart from the
  // refusals above so the exception cannot quietly widen into repairing them.
  const out = normalizePlan({ ...GOOD, pages: [{ path: "/Book", role: "book a chair" }] });
  assert.deepEqual(out.pages.map((p) => p.path), ["/book"]);
});

test("two entries for one path is a page set with a bug — first wins", () => {
  // The directive would otherwise list the same address twice with two different
  // jobs, and the generator would be asked to write one file to satisfy both.
  const out = normalizePlan({ ...GOOD, pages: [
    { path: "/", role: "the real home page" },
    { path: "/", role: "a second home page" },
  ] });
  assert.equal(out.pages.length, 1);
  assert.equal(out.pages[0].role, "the real home page");
});

test("an unrecognised structure is dropped and the rest of the plan survives", () => {
  // The directive already treats the skeleton line as optional, so a plan whose
  // structure we cannot name is a plan missing one line — not one that cannot be
  // used. Refusing here would throw away a good purpose and a good page set over
  // a typo in an enum.
  const out = normalizePlan({ ...GOOD, structure: "hexagonal" });
  assert.equal(out.structure, undefined);
  assert.equal(out.purpose, GOOD.purpose);
  assert.ok(directiveFromPlan(out), "a plan with an unusable structure stopped composing a directive");
});

test("a plan that cannot compose a directive answers NULL, not a half-plan", () => {
  // A half-plan would print a LAYOUT block naming no pages, which reads to the
  // generator as an instruction to build a site with none. Null instead, so the
  // caller falls back to whatever it had — for an existing site its stored
  // family, for a new one no directive at all, and the pipeline handles both.
  assert.equal(normalizePlan(null), null);
  assert.equal(normalizePlan("a plan"), null);
  assert.equal(normalizePlan([GOOD]), null, "an array is not a plan");
  assert.equal(normalizePlan({ ...GOOD, purpose: "  " }), null, "a blank purpose composed a directive");
  assert.equal(normalizePlan({ ...GOOD, pages: [] }), null, "a plan with no pages composed a directive");
  assert.equal(normalizePlan({ ...GOOD, pages: [{ path: "nope", role: "x" }] }), null,
    "a plan whose every page was refused still composed a directive");
  assert.equal(directiveFromPlan(null), null);
  assert.equal(hasPlan({ family: "salon" }), false, "a stored family read as an authored plan");
  assert.equal(hasPlan(GOOD), true);
});

test("it is an ALLOW-LIST — a field nobody added cannot ride along", () => {
  // The `coerceTable` shape. Its trap is the other direction and cost `teamScope`
  // five layers of silent death: a field added to the tool and forgotten here is
  // dropped without a word, which is why `PLAN_KEYS` is what the guards derive
  // from at both ends.
  const out = normalizePlan({ ...GOOD, sneaked: "value", __proto__: { polluted: true } });
  assert.deepEqual(Object.keys(out).sort(), [...PLAN_KEYS].sort());
});

/* ── the directive: same format, authored values ────────────────────────── */

test("THE COMPOSED DIRECTIVE IS layoutDirective's FORMAT, LINE FOR LINE", () => {
  // LOAD-BEARING RATHER THAN TIDY. The page-generation prompt, the four
  // reference pages and every rule that mentions the layout block were written
  // against that shape, so a plan emitting a different one would be a change to
  // the GENERATOR wearing the costume of a change to the designer.
  //
  // Driven by feeding each family its OWN row through the authored composer: if
  // the two agree, the pages call cannot tell which produced it. One word
  // differs on purpose — a site "has" pages where a family "ships" them.
  let checked = 0;
  for (const [name, f] of Object.entries(FAMILIES)) {
    if (!f.ready) continue;
    // Families declaring more verbs than MAX_ACTION are the deliberate exception:
    // the cap is a narrowing this change makes on purpose, since `action` is
    // "the ONE thing you want a visitor to do" and four alternatives is not one.
    if (f.cta.length > MAX_ACTION) continue;
    const composed = directiveFromPlan({
      purpose: `${f.md}: ${f.label}`,
      structure: f.structure,
      shape: f.shape,
      action: f.cta,
      components: f.components,
      pages: f.pages.filter((p) => !p.alt)
        .map((p) => ({ path: p.file === "index" ? "/" : "/" + p.file, role: p.role })),
    });
    const fromTable = layoutDirective(name).replace("This family ships", "This site has");
    assert.equal(composed, fromTable, `${name} composes differently through the authored path`);
    checked++;
  }
  assert.ok(checked > 80, "the sweep only compared " + checked + " families — it has stopped finding them");
});

test("the directive names every page, the verb and the skeleton", () => {
  const d = directiveFromPlan(GOOD);
  assert.match(d, /^LAYOUT — the slot picker is the hero/);
  assert.match(d, /- the chair list leads/);
  assert.match(d, /Primary action: "Book now" —/);
  assert.match(d, /Reach first for: availability-grid, week-strip, price-list\./);
  assert.match(d, /This site has 2 pages:/);
  assert.match(d, /- \/ — book a chair/);
  assert.match(d, /- \/prices — what each cut costs/);
  assert.match(d, /Structure — sidebar: /);
  // Singular reads correctly, because a one-page café is the commonest shape
  // this platform builds and "1 pages" is the sort of thing a model copies.
  assert.match(directiveFromPlan({ ...GOOD, pages: [{ path: "/", role: "everything" }] }), /This site has 1 page:/);
});

/* ── the image budget follows the plan ──────────────────────────────────── */

test("the SAME three rules, over a plan instead of a family row", () => {
  // terminal → nothing anywhere; the home page gets two where the structure is
  // built around an opening image and one otherwise; any other page gets one
  // only where the components say pictures are the content.
  const base = { purpose: "p", pages: [{ path: "/", role: "r" }] };
  assert.equal(planBudget({ ...base, structure: "terminal" }), 0, "a terminal site was budgeted a photograph");
  assert.equal(planBudget({ ...base, structure: "full-bleed-hero" }), 2, "a hero-led home page lost its second image");
  assert.equal(planBudget({ ...base, structure: "sidebar" }), 1);
  const two = { ...base, pages: [{ path: "/", role: "r" }, { path: "/work", role: "r" }] };
  assert.equal(planBudget({ ...two, structure: "sidebar" }), 1, "a second page was budgeted with no gallery in the kit list");
  assert.equal(planBudget({ ...two, structure: "sidebar", components: ["gallery"] }), 2,
    "a picture-led component list did not earn the second page an image");
});

test("NULL, NOT ZERO, when there is no usable plan — and that is the whole point", () => {
  // Zero is a REAL budget: it is what `terminal` gets. Returning it for "I
  // cannot read this" would make an unreadable plan indistinguishable from a
  // deliberate choice to have no pictures, and would silently suppress
  // photographs on every site that still has a stored family.
  assert.equal(planBudget(null), null);
  assert.equal(planBudget({}), null);
  assert.equal(planBudget({ purpose: "p", pages: [] }), null);
  assert.equal(planBudget("a plan"), null);
  // And the caller really does fall through rather than reading it as zero.
  assert.equal(budgetFor("salon", { plan: null }), imageBudget("salon"),
    "a site with no plan lost the budget its stored family gives it");
  assert.ok(imageBudget("salon") > 0, "the fallback family budgets nothing, so the assertion above proves nothing");
});

test("an authored plan BEATS a stored family, and a terminal plan really means none", () => {
  const plan = { purpose: "p", structure: "terminal", pages: [{ path: "/", role: "r" }] };
  assert.equal(budgetFor("salon", { plan }), 0,
    "the stored family overrode the plan, so the designer's own choice is ignored");
});

/* ── the transition: sites older than the change keep working ───────────── */

test("THE BUILD CALL IS HANDED A REAL PLAN, not a null the fallback swallows", () => {
  // FOUND BY MUTATION, and it is the wiring layer this repo has recorded a dozen
  // features dying in: `plan: null` at the call site passed the ENTIRE suite.
  // Every module test still holds — `normalizePlan` is correct, `directiveFromPlan`
  // is correct, `briefWithLayout` asks the plan first — and the value arriving is
  // null, so the composer falls through to the stored family on every build and
  // the whole change is dead. The fallback is exactly what hides it.
  //
  // ANCHORED ON `await`, because `buildAndPublishPages(env, {` matches the
  // DECLARATION too, whose destructuring braces close a few hundred characters
  // later: the `confirmSubmitter` failure this repo has recorded three times.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf("await buildAndPublishPages(env, {");
  assert.ok(at > 0, "nothing calls buildAndPublishPages");
  let depth = 0, i = worker.indexOf("{", at), end = i;
  for (; end < worker.length; end++) {
    if (worker[end] === "{") depth++;
    else if (worker[end] === "}") { depth--; if (!depth) { end++; break; } }
  }
  const args = worker.slice(i, end).replace(/^[ \t]*\/\/.*$/gm, "");
  assert.match(args, /\bplan:/, "the build is never handed a plan at all");
  assert.match(args, /\bnormalizePlan\(/,
    "the plan reaches the build unnormalised — a model's raw answer, uncapped and unchecked");
  assert.match(args, /\bPLAN_KEYS\b/,
    "the plan is assembled from a hand-written list of axes, so a seventh is answered, stored and dropped here");
  assert.doesNotMatch(args, /plan: null,/, "the plan is hardcoded null and the family fallback hides it");
});

test("A SITE BUILT BEFORE THE PLAN EXISTED KEEPS ITS LAYOUT", () => {
  // WHAT MAKES THIS SAFE TO DEPLOY. Nothing sets a `family` any more, but every
  // site built before 2026-08-20 has one stored, and a revise of one must not
  // silently lose its directive. Asserted through the real composer chain rather
  // than by reading the source, and paired with the case that would hide a
  // broken fallback: a plan present means the plan wins.
  const edit = fs.readFileSync(new URL("../builder/site-edit.mjs", import.meta.url), "utf8");
  assert.match(edit, /EDIT_FIELDS = \[[^\]]*"family"/,
    "`family` left EDIT_FIELDS, so the next revise of an existing site discards the only record of its layout");
  const gen = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  assert.match(gen, /directiveFromPlan\(plan\)\s*\|\|/,
    "the fallback order changed — a half-written plan no longer falls through to the stored family");
});

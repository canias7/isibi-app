// The site plan is AUTHORED, not looked up (owner's call, 2026-08-20).
//
// `design_schema` took `family` — one of 100 pre-written trades — and the
// platform looked up a table row for the purpose, the shape, the page set, the
// verb and the components. The owner's direction is that the model decides all
// six per site. This file holds what that module has to get right.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import {
  PLAN_KEYS, PLAN_EDIT_FIELDS, PLAN_FIELDS, PLAN_REQUIRED, KIT_PALETTE, COMPONENT_MENU, SHAPE_FIELD,
  normalizePlan, directiveFromPlan, hasPlan,
  MAX_SECTIONS, MAX_PAGES, MAX_ACTION, MAX_COMPONENTS,
} from "../builder/site-plan.mjs";
import { ALWAYS_API_CORE, UI_COMPONENTS, siteComponentApi, componentApiFor, briefWithLayout, PAGE_RULES } from "../builder/page-gen.mjs";
import { planBudget, budgetFor } from "../builder/site-images.mjs";

const GOOD = {
  purpose: "the slot picker is the hero; everything else supports the appointment",
  shape: [
    { path: "/", sections: ["hero — the shop and the Book now button", "availability-grid — this week's free chairs", "price-list — what each cut costs"] },
    { path: "/prices", sections: ["price-list — every cut, sectioned"] },
  ],
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
  //
  // THE TWO DELIBERATELY DISAGREE BY EXACTLY ONE FIELD SINCE 2026-08-21.
  // `shape` is spliced into the tool after `mode` rather than beside its
  // siblings, so it is answered last of every front-end field. Everything else
  // still has to line up, or the `components`-is-last guard above proves
  // nothing — which is why this asserts the split rather than dropping.
  assert.deepEqual(Object.keys(PLAN_FIELDS), PLAN_KEYS.filter((k) => k !== "shape"),
    "the tool's plan fields are in a different order from PLAN_KEYS, so the ordering guard above proves nothing");
  assert.ok(!("shape" in PLAN_FIELDS),
    "shape is back in the PLAN_FIELDS spread, so it is answered fifteenth again rather than last");
  assert.ok(SHAPE_FIELD && SHAPE_FIELD.type === "array",
    "SHAPE_FIELD is not a usable schema fragment — the tool would splice in nothing");
});

test("shape is answered LAST of the front-end fields, in the tool itself", () => {
  // THE MODULE CANNOT HOLD THIS. `site-plan.mjs` exports a fragment; whether it
  // lands after `mode` is a fact about `design_schema` in worker.js, and this
  // repo has recorded twelve features that were correct in a module and dead at
  // the wiring. Asserted on the source, comment-stripped, because the paragraph
  // explaining the move necessarily spells the field names it moves.
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  const tool = src.slice(src.indexOf("const SITE_SCHEMA_TOOL"));
  const at = (re) => tool.search(re);
  const spread = at(/\n\s*\.\.\.PLAN_FIELDS,/);
  const mode = at(/\n\s*mode:\s*\{/);
  const shape = at(/\n\s*shape:\s*SHAPE_FIELD,/);
  assert.ok(spread > 0 && mode > 0 && shape > 0,
    `an anchor is missing — spread ${spread}, mode ${mode}, shape ${shape}`);
  assert.ok(shape > spread, "shape is spliced in before the plan spread, not after it");
  assert.ok(shape > mode, "shape is answered before `mode`, so it is not last of the front-end fields");
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
    // BANDS ARE CAPPED PER PAGE, so the fixture has to declare a page that will
    // survive `pageList`'s own cap — `/p0` is inside MAX_PAGES and `/p39` is not,
    // and an entry for a dropped page is dropped with it. Pinned on `/p0` so the
    // band cap is what this assertion measures rather than the page cap twice.
    shape: [{ path: "/p0", sections: Array.from({ length: 30 }, (_, i) => "band " + i) }],
    action: Array.from({ length: 20 }, (_, i) => "Verb " + i),
    components: Array.from({ length: 200 }, (_, i) => "comp-" + i),
    pages: Array.from({ length: 40 }, (_, i) => ({ path: "/p" + i, role: "role " + i })),
  });
  assert.equal(big.shape[0].sections.length, MAX_SECTIONS);
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
  // …and one level down, on the bands themselves.
  const bands = normalizePlan({ ...GOOD, shape: [{ path: "/", sections: ["real", 7, null, ["a", "b"], {}, "real"] }] });
  assert.deepEqual(bands.shape, [{ path: "/", sections: ["real"] }],
    "a non-string band was coerced, or a repeated one kept twice");
});

/* ── shape: the arrangement, per page ───────────────────────────────────── */

test("AN ARRANGEMENT FOR A PAGE THE SITE DOES NOT HAVE IS DROPPED", () => {
  // Printed in the directive it reads as a page the generator forgot, and the
  // likeliest thing a model does with a numbered band list under an unknown
  // address is write that page — a route nothing links to, on a site whose page
  // set was decided one field earlier. Dropped rather than repaired: repairing
  // means guessing which page was meant, which this file refuses one function up.
  const out = normalizePlan({
    ...GOOD,
    shape: [
      { path: "/", sections: ["hero — the shop"] },
      { path: "/pricing", sections: ["a page this site does not have"] },
    ],
  });
  assert.deepEqual(out.shape.map((s) => s.path), ["/"]);
  assert.ok(!directiveFromPlan({ ...GOOD, shape: out.shape }).includes("/pricing"));
});

test("an entry with no usable band does not survive as an empty one", () => {
  // NEARLY INERT AND NOT QUITE, which is why it is asserted rather than trusted:
  // an empty `sections` array is TRUTHY, so `directiveFromPlan` prints nothing
  // for it and the block comes out identical either way. What it does change is
  // the stored plan — `movedFields` compares by `JSON.stringify`, so a kept empty
  // entry makes a revise report the layout as changed when nothing about it did.
  const out = normalizePlan({
    ...GOOD,
    shape: [{ path: "/", sections: [7, null, {}, "   "] }, { path: "/prices", sections: ["real"] }],
  });
  assert.deepEqual(out.shape, [{ path: "/prices", sections: ["real"] }],
    "an entry whose every band was junk was kept with an empty band list");
});

test("a page with NO arrangement keeps its role line and gains nothing", () => {
  // Not compelling one per page is deliberate: six pages of eight bands is a very
  // long answer, and a model made to fill every slot pads the thin pages rather
  // than admitting they are thin. An absent page is one the page writer lays out
  // itself, exactly as every page did before this field existed.
  const d = directiveFromPlan({ ...GOOD, shape: [{ path: "/", sections: ["hero — the shop"] }] });
  assert.match(d, /- \/prices — what each cut costs\n?$/,
    "a page with no arrangement did not come out as a bare role line");
  assert.match(d, /- \/ — book a chair\n {4}1\. hero — the shop/,
    "the arranged page's bands are not nested under it");
});

test("THE ORDER IS THE CONTENT, and the directive numbers it", () => {
  // `sections` is the page top to bottom and the first entry is what leads, so a
  // bulleted list would read as a set of things the page contains — the one
  // reading that loses the only fact this field carries.
  const d = directiveFromPlan({
    ...GOOD,
    shape: [{ path: "/", sections: ["first", "second", "third"] }],
  });
  const at = (s) => d.indexOf(s);
  assert.ok(at("1. first") > 0 && at("2. second") > at("1. first") && at("3. third") > at("2. second"),
    "the bands are not numbered in the order they were written:\n" + d);
});

test("A STORED FLAT SHAPE IS STILL LEGAL INPUT AND BUYS NOTHING", () => {
  // Every site built before 2026-08-21 has `shape: ["...", "...", "..."]` in its
  // stored look, and a revise hands that object straight to `normalizePlan`. So
  // this is a live shape, not a hypothetical. Refusing it would throw away a good
  // purpose and a good page set over a field WE changed the meaning of — the rule
  // the deleted `structure` field established.
  const legacy = normalizePlan({ ...GOOD, shape: ["the chair list leads", "prices, then the form"] });
  assert.ok(legacy, "a stored flat shape stopped the whole plan normalising");
  assert.equal(legacy.shape, undefined, "a flat shape was kept, so two shapes are live downstream");
  assert.equal(legacy.purpose, GOOD.purpose);
  assert.equal(legacy.pages.length, 2);
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

test("a plan STORED BEFORE `structure` went still normalises, and the skeleton never reaches the directive", () => {
  // `structure` left `design_schema` on 2026-08-20 and every site built before
  // that has one in its stored look. So this is a live shape, not a hypothetical:
  // a revise reads that object back and hands it to `normalizePlan`.
  //
  // BOTH HALVES MATTER AND ONLY THE SECOND IS OBVIOUS. Dropping it is right —
  // nothing reads it any more — and the reason to assert it is that the OTHER
  // outcome is a plan refused over a field we deleted, which would take a good
  // purpose and a good page set with it. And the directive must not print the
  // line, or the page writer is still being told a skeleton nothing enforces.
  const out = normalizePlan({ ...GOOD, structure: "sidebar" });
  assert.equal(out.structure, undefined, "a stored skeleton survived the normaliser");
  assert.equal(out.purpose, GOOD.purpose);
  const d = directiveFromPlan(out);
  assert.ok(d, "a plan carrying a legacy structure stopped composing a directive");
  assert.ok(!/Structure —/.test(d), "the directive still prints a Structure line");
  assert.ok(!/sidebar/.test(d), "the stored skeleton leaked into the directive");
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

/* THE BYTE-IDENTICAL PROOF WENT WITH THE TABLE IT COMPARED AGAINST (2026-08-20).
 *
 * It fed each of the 100 families its OWN row through `directiveFromPlan` and
 * required the output to equal `layoutDirective(name)` character for character,
 * one word aside — a site "has" pages where a family "shipped" them. **98 of 100
 * matched**, and the two that differed were the MAX_ACTION cap biting on
 * families declaring four verbs, which is the cap working.
 *
 * That measurement is why the change was safe to make, and it cannot be re-run:
 * both the table and `layoutDirective` are deleted. It is recorded here rather
 * than in a commit message because it was the evidence for the claim this test
 * carried — that the format the page-generation call reads did not change.
 *
 * THAT CLAIM NOW HAS ONE DELIBERATE EXCEPTION (2026-08-21, owner's call). The
 * three site-wide shape lines that sat between the purpose and the page list are
 * gone; the arrangement is per page and nests UNDER the page it arranges. Every
 * other line is where it was, which is what keeps the four reference pages and
 * the rules written against this block correct — and `PAGE_RULES` was checked
 * for a reader of the old lines before they moved: it names none of them, so
 * nothing in the prompt was parsing the block's interior.
 */
test("the directive names every page and the verb", () => {
  const d = directiveFromPlan(GOOD);
  assert.match(d, /^LAYOUT — the slot picker is the hero/);
  assert.match(d, /Primary action: "Book now" —/);
  assert.match(d, /Reach first for: availability-grid, week-strip, price-list\./);
  assert.match(d, /This site has 2 pages:/);
  assert.match(d, /- \/ — book a chair/);
  assert.match(d, /- \/prices — what each cut costs/);
  // The arrangement is UNDER its own page, and only under that one — an
  // instruction printed against the wrong address is worse than none.
  assert.match(d, /- \/ — book a chair\n {4}1\. hero — the shop and the Book now button/);
  assert.match(d, /- \/prices — what each cut costs\n {4}1\. price-list — every cut, sectioned/);
  // Singular reads correctly, because a one-page café is the commonest shape
  // this platform builds and "1 pages" is the sort of thing a model copies.
  assert.match(directiveFromPlan({ ...GOOD, pages: [{ path: "/", role: "everything" }] }), /This site has 1 page:/);
});

/* ── components are per site: names cached, signatures for this manifest ── */

test("THE DESIGNER IS GIVEN A PALETTE, because a compelled field with no list is guesswork", () => {
  // `components` compels 10-24 names out of a kit of 2,112 and, until this, named
  // not one of them — so the designer answered from imagination. Most of this kit
  // is named things no model would guess (`stats-band`, `trust-strip`,
  // `rate-card`, `week-strip`), and an invented name resolves to no signature at
  // all: the page writer is then blind on exactly the component the site needed.
  const d = PLAN_FIELDS.components.description;
  for (const n of KIT_PALETTE.slice(0, 30)) {
    assert.ok(d.includes(n), `${n} is in the palette and the designer is never shown it`);
  }
  assert.ok(KIT_PALETTE.length > 200, `the palette shrank to ${KIT_PALETTE.length}`);
});

test("the designer is offered the WHOLE KIT, not the 279 (owner's call, 2026-08-21)", () => {
  // THIS TEST IS THE INVERSE OF THE ONE IT REPLACES, which asserted the opposite
  // — "it is a PALETTE, not the whole kit, the +6% choice not the +46% one". That
  // was right on its own premise and the premise was measured wrong: the 279 are
  // every component the 324 exemplar pages import, and all 324 are brochures. So
  // "all 2,112 buys nothing a real site has needed" meant "nothing a BROCHURE has
  // needed" — a CRM's own components sit at median position #154 of that list and
  // twelve app parts are in it nowhere.
  //
  // AND THE COST WAS THE HALF THAT WAS OVERSTATED. +9,950 tokens on a block that
  // is CACHED: 0.37 credits a build warm, 1% of a 38-credit build, and 4.66 once
  // per prompt version. "+46%" is true of the token count and misleading as money.
  assert.equal(COMPONENT_MENU.length, UI_COMPONENTS.length,
    `the designer is offered ${COMPONENT_MENU.length} of ${UI_COMPONENTS.length} components again`);
  assert.equal(new Set(COMPONENT_MENU).size, COMPONENT_MENU.length, "the menu repeats a name");
  const real = new Set(UI_COMPONENTS);
  for (const c of COMPONENT_MENU) assert.ok(real.has(c), `${c} is offered and does not exist`);

  // AND IT REACHES THE FIELD. The menu can be perfectly correct and the
  // description still built from `KIT_PALETTE` — which is what every other test
  // in this file would still pass with, because the palette is deliberately
  // unchanged. Twelve features in this repo have died at exactly that seam.
  const d = PLAN_FIELDS.components.description;
  const deep = COMPONENT_MENU.slice(-40).filter((n) => !KIT_PALETTE.includes(n));
  assert.ok(deep.length > 10, "the tail of the menu is inside the old palette — this proves nothing");
  for (const n of deep.slice(0, 12)) {
    assert.ok(d.includes(n), `${n} is in the menu and the designer is never shown it — the field is still on KIT_PALETTE`);
  }
});

test("…and KIT_PALETTE stays frozen at 279, because the always-on core comes off its head", () => {
  // The palette does a SECOND job and that is why widening the menu did not
  // widen it: `ALWAYS_API_CORE` takes its first 20 as the signatures every site
  // gets. Re-sorting or growing this list silently re-picks that core.
  assert.ok(KIT_PALETTE.length > 200 && KIT_PALETTE.length < 400,
    `the palette is ${KIT_PALETTE.length} — it is the frozen measurement, not the menu`);
  assert.equal(new Set(KIT_PALETTE).size, KIT_PALETTE.length, "the palette repeats a name");
  // The menu leads with it, in order, so the head still carries the frequency
  // signal the field's own wording promises.
  assert.deepEqual(COMPONENT_MENU.slice(0, KIT_PALETTE.length), KIT_PALETTE,
    "the menu no longer leads with the measured order — its head stopped being 'most-commonly-needed first'");
});

test("the palette is ORDERED most-used-first, and the core comes off its front", () => {
  // The order is information rather than formatting: the head is what a small
  // business site nearly always needs. `page-gen.mjs` takes the always-on
  // signature core off that front rather than keeping a second frozen list, so
  // one measurement serves both — and a re-sort here silently re-picks the core.
  assert.equal(KIT_PALETTE[0], "site-chrome", "the palette is no longer ordered by how often pages import each one");
  const head = new Set(KIT_PALETTE.slice(0, 20));
  const inCore = ALWAYS_API_CORE.filter((n) => head.has(n));
  assert.ok(inCore.length >= 18,
    `only ${inCore.length} of the palette's top 20 are in the always-on core — the two lists have come apart`);
});

test("A NAME LISTED TWICE IS SENT ONCE, and does not spend two slots", () => {
  // FOUND BY MUTATION, at both ends and held by nothing at either. A repeated
  // name prints its signature twice — tokens paid for nothing, in the one block
  // that is billed fresh at 1x — and it spends one of MAX_COMPONENTS, so a model
  // that lists `faq` twice gets 23 components' props while believing it named 24.
  assert.equal(
    componentApiFor(["week-strip", "week-strip"]).split("\n").length, 1,
    "a component named twice in a manifest is printed twice",
  );
  const out = normalizePlan({ ...GOOD, components: ["faq", "faq", "week-strip"] });
  assert.deepEqual(out.components, ["faq", "week-strip"], "a duplicate spent a slot in the manifest");
});

test("A MANIFEST NAMING SOMETHING THAT DOES NOT EXIST COSTS NOTHING", () => {
  // The designer writes this list and a model can name a component the kit does
  // not have. There is nothing to validate separately — a name with no signature
  // has no line to print — and the lint refuses an import of it anyway. What
  // must not happen is the junk name reaching the prompt as an empty entry,
  // which reads to the model as a component with no props.
  const block = siteComponentApi(["totally-invented-thing", "week-strip", 7, null, ["a"]]);
  assert.ok(!block.includes("totally-invented-thing"), "an invented component name reached the prompt");
  assert.ok(block.includes("week-strip"), "the real one was lost with the junk");
});

/* ── the image budget follows the plan ──────────────────────────────────── */

test("TWO rules now: the home page gets one, another page gets one only if pictures are the content", () => {
  const base = { purpose: "p", pages: [{ path: "/", role: "r" }] };
  assert.equal(planBudget(base), 1);
  const two = { ...base, pages: [{ path: "/", role: "r" }, { path: "/work", role: "r" }] };
  assert.equal(planBudget(two), 1, "a second page was budgeted with no gallery in the kit list");
  assert.equal(planBudget({ ...two, components: ["gallery"] }), 2,
    "a picture-led component list did not earn the second page an image");
});

test("A STORED `structure` BUYS AND SAVES NOTHING — the two branches it drove are gone", () => {
  // The cost of deleting the field, asserted rather than left to be discovered
  // on a bill. `terminal` used to return 0 and the two hero-led skeletons used
  // to give the home page 2; both are now the ordinary 1. A site built before
  // 2026-08-20 still carries one of these in its stored look, so this is the
  // shape a real revise hands in — and the number must not depend on it either
  // way, or the field is still live through a back door.
  const base = { purpose: "p", pages: [{ path: "/", role: "r" }] };
  for (const s of ["terminal", "full-bleed-hero", "editorial", "sidebar", "hexagonal"]) {
    assert.equal(planBudget({ ...base, structure: s }), 1,
      `a stored "${s}" still moved the photograph budget`);
  }
});

test("NULL, NOT ZERO, when there is no usable plan — and that is the whole point", () => {
  // Zero is a REAL budget — `planBudget` returns it for a plan whose pages all
  // fail the path check. Returning it for "I cannot read this" would make an
  // unreadable plan indistinguishable from a site that genuinely wants no
  // pictures, and would silently suppress them on every site with a stored
  // family. (Until 2026-08-20 the worked example of a real zero was `terminal`;
  // that skeleton is gone and the distinction it illustrated is not.)
  assert.equal(planBudget(null), null);
  assert.equal(planBudget({}), null);
  assert.equal(planBudget({ purpose: "p", pages: [] }), null);
  assert.equal(planBudget("a plan"), null);
  // And the caller really does fall through rather than reading it as zero. The
  // family fallback it used to reach went with the family table; what is left is
  // the one opening image a site we cannot classify still deserves.
  assert.equal(budgetFor({ plan: null }), 1,
    "a site whose plan cannot be read buys nothing, which reads as a deliberate choice to have none");
});

test("an authored plan is what the budget follows", () => {
  const plan = { purpose: "p", pages: [{ path: "/", role: "r" }, { path: "/work", role: "r" }], components: ["gallery"] };
  assert.equal(budgetFor({ plan }), 2,
    "the plan's own page list and components did not decide the budget");
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

test("THE MANIFEST'S SIGNATURES REACH THE USER TURN, and only there", () => {
  // FOUND BY THE SAME CLASS OF MUTATION AS THE PLAN ITSELF: `siteComponentApi`
  // can be perfectly correct and called by nobody, and every module test still
  // passes while the page writer sees no site-specific props at all.
  const plan = {
    ...GOOD,
    components: ["week-strip", "menu-section", "countdown", "live-badge"],
  };
  const turn = briefWithLayout({ brief: "A barber shop in Leeds", plan });
  assert.match(turn, /THE COMPONENTS THIS SITE NEEDS/, "the manifest's signatures never reach the model");
  assert.match(turn, /week-strip — WeekStrip\(/, "a named component's props are not stated");

  // IN THE USER TURN, NEVER THE CACHED BLOCK. A block that varies per site would
  // miss the ~45,000-token prefix on every single build — measured at thirteen
  // times the input cost on the family exemplar. Asserted as the ABSENCE of the
  // per-site block's own heading from the cached rules, which is the one place
  // this could go wrong and is invisible from either side alone.
  assert.ok(!PAGE_RULES.includes("THE COMPONENTS THIS SITE NEEDS"),
    "the per-site component block was folded into the CACHED rules — every build now misses the prefix");

  // …and a caller with no plan sends what it always sent.
  const bare = briefWithLayout({ brief: "A barber shop in Leeds" });
  assert.ok(!bare.includes("THE COMPONENTS THIS SITE NEEDS"),
    "a build with no manifest now carries an empty component block");
});

test("A SITE BUILT BEFORE THE PLAN EXISTED KEEPS ITS LAYOUT", () => {
  // WHAT MAKES THIS SAFE TO DEPLOY. Nothing sets a `family` any more, but every
  // site built before 2026-08-20 has one stored, and a revise of one must not
  // silently lose its directive. Asserted through the real composer chain rather
  // than by reading the source, and paired with the case that would hide a
  // broken fallback: a plan present means the plan wins.
  const edit = fs.readFileSync(new URL("../builder/site-edit.mjs", import.meta.url), "utf8");
  assert.match(edit, /EDIT_FIELDS = \[[^\]]*"family"/,
    "`family` left EDIT_FIELDS — a stored family is the only record an older site has of its layout");
  // THE FALLBACK ITSELF IS GONE, and so is the table it fell back to. What has
  // to hold now is the weaker claim that made deleting it acceptable: a REVISE
  // carries the site's own page source, so its real layout is the pages rather
  // than the directive. Asserted at the composer, because a revise that stopped
  // sending them would make the loss total rather than small.
  const gen = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  assert.match(gen, /priorPagesBlock\(priorPages, mode, target\)/,
    "a revise no longer carries the site's own pages — the family fallback was deleted on the premise that it does");
});

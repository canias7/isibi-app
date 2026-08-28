// Dark is a COLOUR now, not a setting — and this holds what still has to be
// true for that, plus the absence of the field that used to decide it.
//
// `mode` WAS DELETED 2026-08-23 (owner's call): light or dark is something the
// designer writes in `css`, so a dark site is dark values on `:root`. The field
// made sense while a theme was a NAME off a 500-row registry — it chose which
// of two designed halves was activated. The registry went on 2026-08-20 and the
// model writes the palette itself, so `mode` could only ratify what `css` had
// already decided seven fields earlier.
//
// WHAT WAS MEASURED BEFORE PULLING IT, because the comment in `build-server.mjs`
// argued the opposite: it claimed the class "flips every `dark:` utility in the
// kit, which is why this beats emitting the dark values as `:root`". ZERO of the
// 2,112 kit components carry a `dark:` utility. Nothing branches on the class,
// so the whole of dark mode was token values.
//
// `.dark` IS NOT DEAD AND THAT IS THE PREMISE THIS FILE STILL GUARDS.
// `theme-toggle` toggles it on `documentElement`, so a page that renders one
// lets a VISITOR switch — and two things one layer down make that work, each of
// them one edit from being false:
//
//   `styles.css` declares `@custom-variant dark (&:is(.dark *))` — a CLASS,
//   not `prefers-color-scheme`.
//
//   `themeCss` emits a `.dark` block with a DIFFERENT palette. Emit the same
//   colours under both selectors and the toggle is inert.
//
// So they are asserted here as the premise, rather than left as luck.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { themeCss } from "../builder/site-theme.mjs";
import { resolveTheme, THEME_IDS } from "./fixtures/themes.mjs";
import { EDIT_FIELDS } from "../builder/site-edit.mjs";
import { PLAN_KEYS } from "../builder/site-plan.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const worker = read("../worker.js");
const server = read("../builder/build-server.mjs");
const root = read("../builder/lovable/template/src/routes/__root.tsx");
const styles = read("../builder/lovable/template/src/styles.css");
const brand = read("../builder/lovable/template/src/site-brand.ts");
const chat = read("../public/chat.js");

/* ── the premise ─────────────────────────────────────────────────────────── */

test("THE DARK VARIANT IS A CLASS, which is the whole reason this is one line", () => {
  // `&:is(.dark *)` — a DESCENDANT of an element carrying `.dark`. If this ever
  // becomes `@media (prefers-color-scheme: dark)` the site follows the VISITOR
  // rather than the owner, the class stops meaning anything, and every site the
  // owner asked to be dark renders light for anybody whose laptop is set to
  // light. Silent in every check this repo has.
  assert.match(styles, /@custom-variant\s+dark\s*\(&:is\(\.dark \*\)\)/);
  assert.doesNotMatch(styles, /@custom-variant\s+dark\s*\([^)]*prefers-color-scheme/);
});

test("EVERY THEME ALREADY CARRIES A DARK PALETTE, and it is a DIFFERENT one", () => {
  // Driven over the whole corpus rather than one hand-picked theme: the claim
  // is about the DERIVATION, and a single palette happening to have a dark half
  // proves nothing about the other 499. These are test fixtures now — the theme
  // registry left the product on 2026-08-20 — but they remain the only body of
  // hand-designed palettes there is to drive the engine over. `--background` is the load-bearing one — it is
  // what `bg-background` on every generated page's root div reads.
  let checked = 0;
  for (const id of THEME_IDS) {
    const t = resolveTheme(id);
    if (!t) continue;
    const css = themeCss(t);
    const light = (css.match(/:root\s*\{[^}]*--background:\s*([^;}]+)/) || [])[1];
    const dark = (css.match(/\.dark\s*\{[^}]*--background:\s*([^;}]+)/) || [])[1];
    assert.ok(light, id + " has no :root --background");
    assert.ok(dark, id + " emits no .dark --background — the class would apply to nothing");
    assert.notEqual(light.trim(), dark.trim(), id + " draws the same background in both modes");
    checked++;
  }
  // A LOOP THAT RAN OVER NOTHING PASSES EVERY ASSERTION IN IT. This repo has
  // shipped exactly that: `[].every(…)` reported a page clean while the render
  // had failed.
  assert.ok(checked >= 50, "only " + checked + " themes were checked, so the sweep has stopped sweeping");
});

/* ── the value ───────────────────────────────────────────────────────────── */
/* ── and the absence of the field that used to decide it ────────────────── */

test("`mode` IS GONE FROM design_schema, AND STAYS GONE", () => {
  // KEPT AS AN ABSENCE RATHER THAN ONLY DELETED, on the precedent that replaced
  // the repair-pass tests with "a second call never happens": an absence rots
  // silently where a presence goes red. A field quietly restored beside `css`
  // gives the model two ways to decide one thing, and the day they disagree the
  // site is drawn one way and reported the other.
  //
  // ASSERTED ON THE REAL TOOL, not on the source text — the paragraph recording
  // the deletion necessarily spells the field it deleted, which is this repo's
  // most repeated own-goal in an absence check.
  const at = worker.indexOf("      mode: {");
  assert.equal(at, -1, "the `mode` field is back in design_schema — see the header");
});

test("NOTHING BAKES A DARK CLASS ANY MORE — the container, the template, the payloads", () => {
  // FOUR LAYERS, because the feature was four hops and any one of them left
  // behind is a value computed and dropped, which is the shape this repo has
  // recorded twelve dead features in. The container stopped writing the const,
  // the template stopped reading it, and neither publish path carries a mode.
  assert.doesNotMatch(server, /^\s*export const SITE_MODE/m, "the container still writes SITE_MODE");
  assert.doesNotMatch(server, /normalizeMode/, "the container still normalises a mode");
  assert.doesNotMatch(brand, /^export const SITE_MODE/m, "the template placeholder still declares SITE_MODE");
  assert.doesNotMatch(root, /SITE_MODE/, "__root.tsx still stamps a class from SITE_MODE");
  // AND NEITHER PAYLOAD SENDS ONE. Both spines write `site-brand.ts` on every
  // build, so a path still carrying `mode:` is one whose container argument has
  // nowhere to land.
  assert.doesNotMatch(worker, /\n\s*mode: (look|payload)\.mode,/, "a publish payload still carries mode");
});

test("A DARK SITE IS EXPRESSIBLE, and the tool says how", () => {
  // THE HALF THAT MATTERS MORE THAN THE DELETION. Removing the field without
  // saying where darkness now lives leaves the model with no way to answer "make
  // it dark" at all — the `publicView` failure, which has cost a whole build
  // twice: a capability conditioned on a fact the model was never given.
  // Re-anchored 2026-08-27 when the field's opener became the on-request
  // contract ("CSS ON TOP OF THE THEME") with the registry's return.
  const at = worker.indexOf('"CSS ON TOP OF THE THEME');
  assert.ok(at > 0, "the css field description is no longer where this test looks");
  const end = worker.indexOf("\n      },", at);
  assert.ok(end > at, "the css field never closes");
  const field = worker.slice(at, end);
  assert.match(field, /:root` IS WHAT THE SITE LOOKS LIKE/,
    "the css field no longer says `:root` is the site's own look, so a dark site has no expression");
  assert.match(field, /dark values/i, "the css field never says a dark site is dark values");
  // AND IT SAYS WHAT `.dark` IS FOR, or the model writes one on every site and
  // ships a second palette nothing can reach.
  assert.match(field, /theme toggle/i, "the css field does not say `.dark` needs a toggle to do anything");
});

test("EDIT_FIELDS CANNOT MOVE A MODE, so a revise has nothing to keep in step", () => {
  // `mergeLook` rebuilds its output from this list alone, so a name left here
  // after the field went is a value the merge carries and nothing renders.
  assert.ok(!EDIT_FIELDS.includes("mode"), "mode is back on EDIT_FIELDS");
  // The plan axes are untouched by this — asserted so a careless widening of the
  // deletion cannot take them with it.
  for (const k of PLAN_KEYS) assert.ok(EDIT_FIELDS.includes(k), `${k} fell out of EDIT_FIELDS`);
});

test("the router still sends a dark ask to the CHEAP lane", () => {
  // NAMED IN THE `look` CLAUSE, or the router has no reason to route it there
  // and "make the whole site dark" escalates to a full rebuild that produces
  // the same recompile for ~27 credits.
  //
  // THE CLAUSE'S REASON CHANGED WITH THE FIELD. It used to say the theme
  // "already has a dark version drawn for it", which was true of a registry
  // theme and is not true of a stylesheet the model wrote. It is a colour
  // change like any other now, which is both simpler and still cheap.
  const ask = read("../builder/site-ask.mjs");
  const look = ask.slice(ask.indexOf('"\\"look\\" —'), ask.indexOf('"\\"rules\\" —'));
  assert.ok(look.length > 200, "the look clause window is " + look.length + " bytes");
  assert.match(look, /DARK OR LIGHT IS THIS LAYER TOO/);
  assert.doesNotMatch(look, /already has a dark version drawn/,
    "the look clause still explains dark by a designed half the site no longer has");
});

test("the client has no sentence for a field that cannot arrive", () => {
  // `SAY` maps a moved field name to words for the customer. `mode` can no
  // longer appear in `moved`, so an entry for it is a sentence nothing can
  // reach — the on-disk-and-reachable-by-nothing shape this repo has deleted
  // 289 files over, at one line.
  assert.doesNotMatch(chat, /const SAY = \{[^}]*\bmode:/,
    "the client still carries a sentence for `mode`, which no longer moves");
  // The three that DO still move are asserted present, or a careless widening
  // of the deletion empties the map and every look edit reads "Updated the
  // look." with no list.
  for (const k of ["lang", "brand", "description"]) {
    assert.match(chat, new RegExp("const SAY = \\{[^}]*\\b" + k + ":"), `SAY lost ${k}`);
  }
});

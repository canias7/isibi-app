// PARKED (2026-11-03, park-old-way): the old-way half of test/site-dark.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { themeCss } from "../../../builder/site-theme.mjs";
import { resolveTheme, THEME_IDS } from "../../../test/fixtures/themes.mjs";
import { EDIT_FIELDS } from "../../../builder/site-edit.mjs";
import { PLAN_KEYS } from "../../../builder/site-plan.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const worker = read("../../../worker.js");
const server = read("../../../builder/build-server.mjs");
const root = read("../../../builder/lovable/template/src/routes/__root.tsx");
const styles = read("../../../builder/lovable/template/src/styles.css");
const brand = read("../../../builder/lovable/template/src/site-brand.ts");
const chat = read("../../../public/chat.js");

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

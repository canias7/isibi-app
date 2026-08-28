// EVERY THEME A GENERATED SITE MAY WEAR — the engine's own shipped set plus the
// 498 candidates, composed into one registry the designer picks from.
//
// BACK IN THE PRODUCT, 2026-08-27 (owner's call: "we are gonna have the 500
// themes, and with the option if user wants a specific thing then the free css
// comes in as customer requested"). This file was deleted on 2026-08-20 when
// the model started authoring three anchor colours per site, and the 500
// survived as test fixtures because every number in `site-seeds.mjs` is
// calibrated against them. The seeds era is over: a theme is the BASE of every
// build again, and the model's free `css` is the on-request layer on top —
// so the registry moves back to `builder/`, the fixture path re-exports from
// here, and the Dockerfile copies it into the build image.
//
// WHY THIS IS A SEPARATE MODULE AND NOT A CHANGE TO site-theme.mjs. The engine
// is pure logic over a theme OBJECT; `theme-candidates/` is data. Keeping the
// engine free of that import is what lets `test/site-theme.test.mjs` drive it
// against hand-written objects, and what keeps 500 entries out of every module
// that only wanted `contrast()`. This file is the one place the two meet.
//
// WORLDS ARE MERGED UNDER, NEVER OVER. `worlds.mjs` assigns backdrop/decor/
// display per candidate, and its own header states the rule: a hand-authored
// axis on the batch theme always wins. Spreading the world FIRST and the theme
// SECOND is that rule; reversing it would let a generated world silently
// overwrite an axis somebody chose by hand.
import { THEMES } from "./site-theme.mjs";
import { CATALOGUE } from "./theme-candidates/batch-1.mjs";
import { CATALOGUE2 } from "./theme-candidates/batch-2.mjs";
import { CATALOGUE3 } from "./theme-candidates/batch-3.mjs";
import { CATALOGUE4 } from "./theme-candidates/batch-4.mjs";
import { CATALOGUE5 } from "./theme-candidates/batch-5.mjs";
import { CATALOGUE6 } from "./theme-candidates/batch-6.mjs";
import { WORLDS } from "./theme-candidates/worlds.mjs";

const CANDIDATES = { ...CATALOGUE, ...CATALOGUE2, ...CATALOGUE3, ...CATALOGUE4, ...CATALOGUE5, ...CATALOGUE6 };

// The shipped two are spread LAST so that if a candidate is ever promoted into
// `THEMES` under the same key, the promoted version — the one with its `needs`
// actually built — is what a site gets. Today no key collides; this is what
// keeps that true without anybody having to remember it.
export const ALL_THEMES = Object.fromEntries([
  ...Object.entries(CANDIDATES).map(([name, theme]) => [name, { ...(WORLDS[name] || {}), ...theme }]),
  ...Object.entries(THEMES).map(([name, theme]) => [name, theme]),
]);

export const THEME_IDS = Object.keys(ALL_THEMES);

// ALL 500, NOT THE OLD 100-NAME SHORTLIST, and that is the owner's own words —
// "we are gonna have the 500 themes". The shortlist existed to save ~1,200
// tokens on the design call; the full key list measures ~1,525 tokens and it
// rides in the CACHED tool block, so a warm build pays a tenth of that. Names
// only, never labels: the same list with its one-line labels is ~7,019 tokens,
// and the keys carry the meaning on their own (`broadsheet`, `bakery`,
// `jazz-club`, `apothecary`).
export function themeIdsForPrompt() {
  return THEME_IDS;
}

// Resolve a name the designer chose. Unknown -> null rather than a throw: a
// theme is decoration on a site whose data layer is already live, and losing a
// whole build over a misspelt name would be the tail wagging the dog. The
// caller falls back to the untouched template.
export function resolveTheme(name) {
  if (!name || typeof name !== "string") return null;
  // `Object.hasOwn`, NOT a plain lookup. `ALL_THEMES["__proto__"]` is the object
  // prototype — truthy, so it walked straight past the `|| null` and handed back
  // `{}` as a theme, which is neither a real theme nor the null every caller
  // fails soft on. `constructor` and `toString` come back as functions the same
  // way. The exact bug that shipped once in the Stripe plan lookup, and the
  // reason `modelsFor` uses `Object.hasOwn` too.
  return Object.hasOwn(ALL_THEMES, name) ? ALL_THEMES[name] : null;
}

/**
 * THE FONT PAIR A THEME ALREADY RECOMMENDS.
 *
 * Every one of the 500 themes carries `fonts: {heading, body}`, chosen for that
 * theme — `broadsheet` is built around a serif with tight leading and caps
 * kickers, and says so — and `site-theme-registry.test.mjs` asserts two things
 * about all of them: that the pair EXISTS and that both ids are real entries in
 * the 24-font installed shortlist. So this is a curated, validated answer.
 *
 * RESTORED WITH THE REGISTRY (2026-08-27). It was deleted with the shortlist on
 * 2026-08-20 because with no registry there was no theme to read a pair off.
 * With themes back this is where a site's typeface comes from again: the
 * `fonts` field never returned to the tool — the model's own `css` names any
 * family it wants when the customer asks — so an unasked site wears the pair
 * its theme was designed around, through the same `writeFonts` machinery.
 *
 * A COPY, not the registry's own object: the result is stored in the site's
 * config and handed around, and aliasing a module constant into stored state is
 * how a shared object eventually gets mutated by somebody.
 *
 * The `heading && body` ternary is unobservable today — 0 of the 500 carries a
 * half pair, asserted — and exists for the day somebody adds a theme with only
 * a heading: without it, `{heading:"x", body:""}` reaches the build and the
 * body silently falls back to the default face while everything reports
 * success.
 */
export function themeFontPair(name) {
  const t = resolveTheme(name);
  const f = t && t.fonts;
  if (!f || typeof f !== "object") return null;
  const heading = typeof f.heading === "string" ? f.heading : "";
  const body = typeof f.body === "string" ? f.body : "";
  return (heading && body) ? { heading, body } : null;
}

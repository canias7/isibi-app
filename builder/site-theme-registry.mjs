// EVERY THEME A GENERATED SITE MAY WEAR — the engine's own shipped set plus the
// 498 candidates, composed into one registry the designer picks from.
//
// WHY THIS IS A SEPARATE MODULE AND NOT A CHANGE TO site-theme.mjs. The engine
// is pure logic over a theme OBJECT; `theme-candidates/` is data. Keeping the
// engine free of that import is what lets `test/site-theme.test.mjs` drive it
// against hand-written objects, and what keeps 500 entries out of every module
// that only wanted `contrast()`. This file is the one place the two meet.
//
// THE OWNER'S CALL, 2026-08-01: "I made 500, name them if you want." The
// candidates' README says nothing there ships until promoted into `THEMES` with
// its `needs` capability built — that gate is what this overrides, deliberately
// and on the record. 138 of the 498 declare a `needs`; each renders honestly
// without it (palette, type and components all real, the missing capability
// simply absent), which is the same bargain the swatch sweep already made.
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

// Names only, never labels. Measured: the 500 keys are ~1,525 tokens on every
// design call and the same list with its one-line labels is ~7,019 — which is
// the precise cost the `fonts` field refused when it declined to name all 2,096
// Fontsource families. The keys carry the meaning on their own (`broadsheet`,
// `bauhaus`, `zine`), so the labels buy sharper picking at four and a half times
// the price, forever, on every build.
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

// THE SHORTLIST THE DESIGNER ACTUALLY PICKS FROM — 100 of the 500.
//
// Straight from the fonts playbook, and the same bargain: `site-fonts.mjs` offers
// 24 of 2,096 families because naming them all costs ~7,500 tokens on every
// design call, and anything off-list stays reachable by name. Themes were the
// same shape of waste — all 500 names cost ~1,525 tokens, and the shortlist
// costs ~312. The 400 not listed are still resolvable by `resolveTheme`, and the
// route falls back to `body.theme`, so a caller reaches any of them; what the
// shortlist bounds is what the MODEL chooses between.
//
// SPREAD ACROSS CATEGORIES, NOT THE FIRST 100. The candidates carry a `cat`
// (53 of them: print, tech, retro, materials, places, eras, land, trades, media…)
// and they are stored grouped, so a flat first-100 would be every print and tech
// theme and nothing else — a shortlist that cannot dress a bakery. Round-robin
// takes one from each category before a second from any, so all 53 are
// represented before depth is added anywhere.
//
// DERIVED AND DETERMINISTIC. No hand-picked list to drift from the catalogue,
// and no randomness — the same 100 every build, which is also what lets the
// prompt carrying it be cached at all.
const SHORTLIST_SIZE = 100;

function spreadByCategory(themes, size) {
  const byCat = new Map();
  for (const [name, t] of Object.entries(themes)) {
    const cat = t.cat || "shipped";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(name);
  }
  const lanes = [...byCat.values()];
  const out = [];
  for (let depth = 0; out.length < size; depth++) {
    let placed = false;
    for (const lane of lanes) {
      if (depth >= lane.length) continue;
      out.push(lane[depth]);
      placed = true;
      if (out.length >= size) break;
    }
    if (!placed) break; // every lane exhausted — fewer than `size` exist
  }
  return out;
}

// The promoted themes are always offered: they are the two whose `needs` are
// actually built, and dropping one because a category lane filled up first would
// make the best-supported themes the least likely to be chosen.
export const THEME_SHORTLIST = [
  ...Object.keys(THEMES),
  ...spreadByCategory(CANDIDATES, SHORTLIST_SIZE).filter((n) => !(n in THEMES)),
].slice(0, SHORTLIST_SIZE);

/**
 * THE FONT PAIR A THEME ALREADY RECOMMENDS.
 *
 * Every one of the 500 themes carries `fonts: {heading, body}`, chosen for that
 * theme — `broadsheet` is built around a serif with tight leading and caps
 * kickers, and says so — and `site-theme.test.mjs` already asserts two things
 * about all of them: that the pair EXISTS ("recommends no font pair" is its
 * failure message) and that both ids are real entries in the same 24-font
 * shortlist the designer picks from. So this is a curated, validated answer.
 *
 * IT WAS READ BY NOTHING. `themeCss` emits no `font-family` at all (measured),
 * and every reader on the build path takes `look.fonts` — the designer's own
 * separate pick, made from a prose hint, with no check that the two agree. Two
 * choices that must match, made independently, with the right answer sitting one
 * property away. The same shape as the charts that typechecked and rendered
 * grey: nothing fails, it just looks wrong, and only looking tells you.
 *
 * A COPY, not the registry's own object: the result is JSON-stringified into the
 * site's `_meta` and handed around, and aliasing a module constant into stored
 * state is how a shared object eventually gets mutated by somebody.
 *
 * TWO GUARDS HERE ARE BELT-AND-BRACES, AND THEY SAY SO RATHER THAN PRETENDING
 * TO BE TESTED. A mutation sweep found both, and measuring them showed neither
 * changes any observable behaviour today:
 *
 *   - going through `resolveTheme` rather than `ALL_THEMES[name]` cannot matter
 *     while the `.fonts` read below exists: `ALL_THEMES["__proto__"]` is truthy,
 *     but its `.fonts` is `undefined`, so the falsy check returns null anyway —
 *     same for `constructor` and `toString`. It stays because one guard for
 *     "is this a real theme" is better than two answers to that question, and
 *     because the `.fonts` check is one edit from being the thing that moves.
 *   - the `heading && body` ternary is unobservable because 0 of the 500 themes
 *     carries a half pair, which `site-theme.test.mjs` asserts for all of them.
 *     It exists for the day somebody adds a theme with only a heading: without
 *     it, `{heading:"x", body:""}` reaches the build and the body silently falls
 *     back to the default face while everything reports success.
 */
export function themeFontPair(name) {
  const t = resolveTheme(name);
  const f = t && t.fonts;
  if (!f || typeof f !== "object") return null;
  const heading = typeof f.heading === "string" ? f.heading : "";
  const body = typeof f.body === "string" ? f.body : "";
  return (heading && body) ? { heading, body } : null;
}

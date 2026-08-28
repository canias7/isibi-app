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

// THE SHORTLIST THE DESIGNER ACTUALLY PICKS FROM — 100 of the 500.
//
// The owner's second call, an hour after the first put all 500 in the enum:
// "Ok but the 500 ship at build, if so do only 100 and keep the otherones
// there." So the ENUM is 100 names (~312 tokens on the design call against
// ~1,525 for the full list) and the REGISTRY keeps all 500: everything below
// resolves any of them, the merge stores any of them, the container renders
// any of them — what the shortlist bounds is what the MODEL chooses between.
// The fonts playbook exactly: `site-fonts.mjs` offers 24 of 2,096 families for
// the same reason. Names only, never labels — the same list with its one-line
// labels is ~7,019 tokens for all 500, and the keys carry the meaning on their
// own (`broadsheet`, `bauhaus`, `zine`).
//
// SPREAD ACROSS CATEGORIES, NOT THE FIRST 100. The candidates carry a `cat`
// (53 of them: print, tech, retro, materials, places, eras, land, trades,
// media…) and they are stored grouped, so a flat first-100 would be every
// print and tech theme and nothing else — a shortlist that cannot dress a
// bakery. Round-robin takes one from each category before a second from any,
// so all 53 are represented before depth is added anywhere.
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

// The shipped themes are always offered — they are the ones whose `needs` are
// actually built, and dropping one because a category lane filled up first
// would make the best-supported themes the least likely to be chosen.
export const THEME_SHORTLIST = [
  ...Object.keys(THEMES),
  ...spreadByCategory(CANDIDATES, SHORTLIST_SIZE).filter((n) => !(n in THEMES)),
].slice(0, SHORTLIST_SIZE);

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

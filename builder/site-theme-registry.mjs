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
  return ALL_THEMES[name] || null;
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

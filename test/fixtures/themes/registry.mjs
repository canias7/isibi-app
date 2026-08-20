// THE 500 HAND-WRITTEN THEMES — TEST DATA, NOT PRODUCT (moved 2026-08-20).
//
// This was `builder/site-theme-registry.mjs`, and the designer picked a site's
// whole look by naming one of a 100-strong shortlist from it. The owner's call
// deleted that: the model AUTHORS three anchor colours per site now
// (`builder/site-seeds.mjs`) and `paletteFor` derives the other 28 tokens from
// them — which is exactly what every one of the 500 below already did.
//
// SO WHY IS IT STILL HERE. The same reason the 324 reference pages survive as
// `test/fixtures/corpus/` rather than being deleted with the families: these are
// the only corpus of complete, hand-designed palettes this repo has, and every
// number in `site-seeds.mjs` is calibrated against them —
//
//   · the contrast FLOORS (body 7, quiet 3, button 3, button-vs-page 1.5), each
//     set below the worst of the 500 so the check refuses nothing a person
//     designed;
//   · the light-to-dark MIRROR, whose offsets are the medians of what these
//     authors did (391 of 500 are exact hue mirrors) and whose neutral-accent
//     rule is what all 11 of them did without exception;
//   · the FALSE-ALARM RATE, which had to be zero over all 500 before the
//     validator was allowed to exist at all.
//
// Deleting them would not advance the goal — nothing here reaches a prompt, no
// site can name one, and the Dockerfile no longer copies it, so it ships in
// nothing. It would only remove the evidence that the checks do not cry wolf,
// and make the floors unre-verifiable the next time somebody wants to move one.
//
// IMPORTED THROUGH `test/fixtures/themes.mjs`, which is the one path — seven
// test files each spelling this location is seven things to keep in step.
import { THEMES } from "../../../builder/site-theme.mjs";
import { CATALOGUE } from "./batch-1.mjs";
import { CATALOGUE2 } from "./batch-2.mjs";
import { CATALOGUE3 } from "./batch-3.mjs";
import { CATALOGUE4 } from "./batch-4.mjs";
import { CATALOGUE5 } from "./batch-5.mjs";
import { CATALOGUE6 } from "./batch-6.mjs";
import { WORLDS } from "./worlds.mjs";

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

// `THEME_SHORTLIST` AND `themeFontPair` WENT WITH THE FEATURE (2026-08-20).
//
// The first bounded what the designer chose between; the second filled an
// omitted `fonts` from whichever theme had been named. Neither has a caller now
// — the model authors its palette AND its typeface per site — so keeping them
// here would be dead code wearing the shape of something still in use, which is
// the on-disk-and-reachable-by-nothing property this repo has deleted 289 files
// over. They are in git history if the round-robin spread is ever wanted again.

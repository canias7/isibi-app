/**
 * A heat ramp and the ink that stays readable on it — from ONE number.
 *
 * NOT a chart. `.ts`, not `.tsx`, so the catalogue and `gen-chart-api.mjs`
 * (which both glob `*.tsx`) do not offer it to the generator as a component.
 *
 * THE BUG THIS EXISTS TO PREVENT, measured 2026-08-13 across 29 chart modules.
 * A heat cell is painted from a normalised value `t`, scaled into a percentage:
 *
 *     background: `color-mix(in oklch, var(--foreground) ${8 + t * 84}%, ...)`
 *     color:      t > 0.45 ? "var(--background)" : "var(--foreground)"
 *
 * Those two lines look like they agree and do not. The fill runs 8%..92%, so
 * the ink flips when the cell is only `8 + 0.45 * 84` = **46%** — a light
 * cell — and white text lands on it at 2.2:1. The threshold was written
 * against the VALUE while the fill was written against the PERCENTAGE, and
 * nothing held them together.
 *
 * THE RAMP WAS NEVER THE PROBLEM, which is worth stating because the first
 * diagnosis said it was. Against this kit's real `--foreground`
 * (`oklch(0.129 …)`, relative luminance 0.002 — not the 0.018 of the
 * `-foreground` tokens) the two ink choices cross at N = 55%, and the contrast
 * AT that crossing is 4.52:1. It clears AA, by a hair, at the single worst
 * point on the ramp. So a full-range monochrome ramp is readable end to end
 * provided the ink flips in the right place, and no cell needs to lose tone.
 *
 * The fix is therefore not a new colour but a shared number: pass `inkOn` the
 * SAME percentage the fill was given, and the two cannot disagree.
 */

/**
 * Where the ink flips, as a ramp percentage.
 *
 * Below this the cell is light enough for `--foreground`; at or above it the
 * cell is dark enough for `--background`. Measured, not chosen — see above.
 */
export const INK_FLIP = 55;

/** Ink that reads on a cell painted at `pct`% of `--foreground`. */
export const inkOn = (pct: number) =>
  (pct >= INK_FLIP ? "var(--background)" : "var(--foreground)");

/**
 * The standard heat percentage: `t` in 0..1 to 8..92%.
 *
 * Starts at 8 rather than 0 so an empty cell is still visibly a cell, and
 * stops at 92 rather than 100 so the darkest cell is not pure ink. `t` is
 * clamped, because a caller normalising by a max of zero produces Infinity and
 * a percentage CSS cannot parse — which paints nothing at all and is exactly
 * how a label ends up on the page background.
 */
export const shadePct = (t: number) =>
  Math.round(8 + Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * 84);

/** The standard heat fill. Pair it with `inkOn(shadePct(t))`. */
export const SHADE = (t: number) =>
  `color-mix(in oklch, var(--foreground) ${shadePct(t)}%, var(--muted))`;

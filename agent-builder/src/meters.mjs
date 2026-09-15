/**
 * THE METERS — what a run has spent, and the one rule about not knowing.
 *
 * Lifted out of `run.mjs` when the journal needed them too: a replay has to
 * rebuild the meters from recorded entries, and the loop has to add to them
 * live. Two copies of this arithmetic is this repository's most repeated drift,
 * and here it would drift in the direction where a resumed run believes it has
 * spent less than it has.
 */

/**
 * The token kinds counted against a run's budget. ALL of them count in full: a
 * provider prices a cached read at a tenth, but a BUDGET is not a bill.
 */
export const USAGE_KEYS = Object.freeze([
  "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens",
]);

/**
 * Add to a meter, where `null` means UNMEASURED AND STAYS UNMEASURED.
 *
 * "Cannot-tell must never read as a value." Once one call has failed to report
 * its usage the run's total is unknowable, and a reader that treats the gap as
 * zero lets the run spend for ever against a budget it believes it is inside.
 * `stoppedBy` turns that `null` into a named stop, but only when the bound it
 * cannot measure is finite.
 */
export function addMeter(current, add) {
  if (current === null) return null;
  if (add === null || add === undefined) return null;
  if (typeof add !== "number" || Number.isNaN(add) || add < 0) return null;
  return current + add;
}

/**
 * Total one call's usage. `null` when nothing usable was reported, NEVER 0 — a
 * provider that says nothing and one that says "no tokens" are different facts
 * and only one of them is a measurement.
 */
export function usageTokens(usage) {
  if (usage === null || typeof usage !== "object" || Array.isArray(usage)) return null;
  let total = 0;
  let sawOne = false;
  for (const k of USAGE_KEYS) {
    if (!Object.hasOwn(usage, k)) continue;
    const v = usage[k];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0) return null;
    total += v; sawOne = true;
  }
  return sawOne ? total : null;
}

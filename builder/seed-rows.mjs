// WHAT HAPPENED TO EACH STARTER ROW (2026-10-07).
//
// `seedSiteRows` (site-schema.mjs) records, per table, every row the design
// gave by its 1-based place: which went in, which the database refused, which
// named none of the table's columns, and how many past the limit were never
// tried. The add-on's warnings, its fallback note and the reply's facts all
// read that one record through here, so what is said of a table's starter
// rows cannot contradict itself — Codex's review found "rows past the limit"
// read as "only the first ones went in" beside "none went in".

/**
 * THE ENGINE'S RECORD OF EACH TABLE'S STARTER ROWS (2026-10-07,
 * `seedSiteRows`'s `rows`), read strictly: `{ designed, cap, inserted,
 * refused, unusable, unattempted }`, each row by its 1-based place in the
 * design. An entry that does not read is left out, never guessed at.
 */
export function seedRowsOf(rows) {
  const out = new Map();
  if (!rows || typeof rows !== "object" || Array.isArray(rows)) return out;
  const places = (v, max) => Array.isArray(v) && v.every((n) => Number.isSafeInteger(n) && n >= 1 && n <= max) ? [...new Set(v)].sort((a, b) => a - b) : null;
  for (const [name, f] of Object.entries(rows)) {
    if (!name || !f || typeof f !== "object") continue;
    const designed = Number.isSafeInteger(f.designed) && f.designed >= 0 ? f.designed : -1;
    const cap = Number.isSafeInteger(f.cap) && f.cap > 0 ? f.cap : -1;
    const unattempted = Number.isSafeInteger(f.unattempted) && f.unattempted >= 0 ? f.unattempted : -1;
    if (designed < 0 || cap < 0 || unattempted < 0) continue;
    const tried = Math.min(designed, cap);
    const inserted = places(f.inserted, tried), refused = places(f.refused, tried), unusable = places(f.unusable, tried);
    if (!inserted || !refused || !unusable) continue;
    // ONE FATE PER ROW, AND EVERY ROW ONE: the record is consistent or it is not read.
    if (inserted.length + refused.length + unusable.length !== tried || new Set([...inserted, ...refused, ...unusable]).size !== tried) continue;
    if (unattempted !== Math.max(0, designed - cap)) continue;
    out.set(name, { designed, cap, inserted, refused, unusable, unattempted });
  }
  return out;
}
/** Did any of a table's designed rows not go in? */
export const seedMissed = (f) => f.refused.length > 0 || f.unusable.length > 0 || f.unattempted > 0;
/** Row places as words: [1,2,3,5,7,8] → "1–3, 5, 7 and 8" — a run of three or more as a range, every other place by itself. */
export function rowPlaces(list) {
  const runs = [];
  for (const n of list) {
    const last = runs[runs.length - 1];
    if (last && n === last[1] + 1) last[1] = n; else runs.push([n, n]);
  }
  const words = runs.flatMap(([a, b]) => (b - a >= 2 ? [a + "–" + b] : a === b ? [String(a)] : [String(a), String(b)]));
  return words.length <= 1 ? words.join("") : words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}

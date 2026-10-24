// EXACT OLD→NEW EDITS, ONE HELPER (2026-10-23, idea #18).
//
// The visual review (`visual-review.mjs`) and the tweak rung (`site-tweak.mjs`)
// both take a model's answer as a list of `{old, new}` replacements on one
// file. Each `old` is copied from the file and must occur in it EXACTLY ONCE
// at the moment it is applied; the edits apply in order, each on the result of
// the one before, all or none. An `old` that is absent or not unique refuses
// the whole list and names which edit and why, so a caller can say so back.
//
// PURE: no I/O. Shared rather than copied, so the two lanes cannot drift on
// what "exactly once" means.

/** How many times `needle` occurs in `hay` (0, 1, or 2 meaning "more than one"). */
export function occurrences(hay, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; if (n > 1) return n; i += needle.length; }
  return n;
}

/**
 * Apply `edits` to `source`. `{ok: true, source}` or
 * `{ok: false, reason: "malformed"|"old-missing"|"old-not-unique", index}`
 * where `index` is the 0-based edit that failed. An empty list is malformed.
 */
export function applyExactEdits(source, edits) {
  let s = String(source == null ? "" : source);
  const es = Array.isArray(edits) ? edits : null;
  if (!es || !es.length) return { ok: false, reason: "malformed", index: 0 };
  for (let k = 0; k < es.length; k++) {
    const e = es[k];
    if (!e || typeof e.old !== "string" || typeof e.new !== "string" || !e.old) return { ok: false, reason: "malformed", index: k };
    const n = occurrences(s, e.old);
    if (n === 0) return { ok: false, reason: "old-missing", index: k };
    if (n > 1) return { ok: false, reason: "old-not-unique", index: k };
    const at = s.indexOf(e.old);
    s = s.slice(0, at) + e.new + s.slice(at + e.old.length);
  }
  return { ok: true, source: s };
}

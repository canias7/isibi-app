// THE OWNER'S OWN WORDING IN A TRANSLATED LANGUAGE (#196, audit A32-3; the
// owner's choice 2026-10-23: "translated pages become editable").
//
// A translated page (`/es/book`) is produced on every publish from the primary
// page's strings and the translation cache (`langStrings[tag][english]`). An
// edit aimed at it is stored here, as that language's own override, keyed by
// the PRIMARY-LANGUAGE STRING it was made from:
//
//   langOverrides = { es: { "Book a chair": { said: "Reserva tu cita",
//                                             was: "Reserva una silla",
//                                             at: <ms>, stale?: true } } }
//
// The spine lays the overrides over the cache on every publish
// (`applyOverrides`), so a re-translation never undoes them: the cache is never
// written with them, and a cache started over keeps them all the same.
//
// WHEN THE ENGLISH IT CAME FROM CHANGES, the override is KEPT, not applied (its
// source string is no longer on the site) and flagged `stale`; the reply says
// so in one short sentence (`staleNote`) so the owner can check that page.

export const MAX_OVERRIDES_PER_LANG = 400;
const MAX_SAID = 400;

/**
 * The language a page address is in, when it is one of the site's other
 * languages: `{ tag, prefix, route }`, the route being the primary page's.
 * `null` for a primary page or an address that is not a page path.
 */
export function langTargetOf(page, langs) {
  if (typeof page !== "string" || !page.startsWith("/")) return null;
  const seg = page.split("/").filter(Boolean)[0];
  if (!seg) return null;
  const hit = (Array.isArray(langs) ? langs : []).find((l) => l && !l.primary && typeof l.prefix === "string" && l.prefix && l.prefix === seg.toLowerCase());
  if (!hit) return null;
  const rest = "/" + page.split("/").filter(Boolean).slice(1).join("/");
  return { tag: hit.tag, prefix: hit.prefix, route: rest };
}

/** The stored overrides, read strictly: `{ tag: { english: { said, was, at, stale? } } }`. Anything malformed is dropped. */
export function readOverrides(v) {
  const out = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [tag, m] of Object.entries(v)) {
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    const keep = {};
    for (const [from, o] of Object.entries(m)) {
      if (!from || !o || typeof o !== "object" || typeof o.said !== "string" || !o.said || o.said.length > MAX_SAID) continue;
      keep[from] = { said: o.said, was: typeof o.was === "string" ? o.was : "", at: Number.isFinite(o.at) ? o.at : 0, ...(o.stale === true ? { stale: true } : {}) };
    }
    if (Object.keys(keep).length) out[tag] = keep;
  }
  return out;
}

/**
 * One language's translations with its overrides laid over them. An override
 * whose source string is among this publish's strings is applied; one whose
 * source is gone is kept and named in `stale`.
 */
export function applyOverrides(merged, tagOverrides, strings) {
  const out = { ...(merged && typeof merged === "object" ? merged : {}) };
  const have = new Set(Array.isArray(strings) ? strings : []);
  const stale = [];
  for (const [from, o] of Object.entries(tagOverrides || {})) {
    if (!o || typeof o.said !== "string") continue;
    if (have.has(from)) out[from] = o.said;
    else stale.push(from);
  }
  return { merged: out, stale };
}

/**
 * The stored overrides with each one's `stale` flag set from this publish:
 * `{ next, changed }`. A source that came back clears its flag.
 */
export function flagStale(store, staleByTag) {
  const next = {};
  let changed = false;
  for (const [tag, m] of Object.entries(store || {})) {
    const gone = new Set((staleByTag && staleByTag[tag]) || []);
    next[tag] = {};
    for (const [from, o] of Object.entries(m)) {
      const s = gone.has(from);
      if (s !== (o.stale === true)) changed = true;
      const { stale: _drop, ...rest } = o;
      next[tag][from] = s ? { ...rest, stale: true } : rest;
    }
  }
  return { next, changed };
}

/**
 * The text step's edits, made on a translated page, read back to the primary
 * strings they came from. `current` is `{ english: translated }` as the page
 * shows it now. An edit whose wording is no string's translation is `missed`.
 */
export function overridesFromEdits(edits, current) {
  const found = [];
  const missed = [];
  const pairs = Object.entries(current || {});
  for (const e of Array.isArray(edits) ? edits : []) {
    if (!e || typeof e.from !== "string" || typeof e.to !== "string") continue;
    const want = e.from.trim();
    let hits = pairs.filter(([, tr]) => typeof tr === "string" && tr.trim() === want);
    let said = (tr) => e.to.trim();
    if (!hits.length && want) {
      hits = pairs.filter(([, tr]) => typeof tr === "string" && tr.includes(want));
      said = (tr) => tr.replace(want, e.to.trim());
    }
    if (!hits.length) { missed.push(e.from); continue; }
    for (const [from, tr] of hits) {
      const s = said(tr);
      if (!s || s.length > MAX_SAID) { missed.push(e.from); continue; }
      found.push({ from, was: tr, said: s });
    }
  }
  return { found, missed };
}

/** The store with these overrides added for one language (newest wins, bounded). */
export function addOverrides(store, tag, found, at = Date.now()) {
  const next = { ...(store || {}) };
  const m = { ...(next[tag] || {}) };
  for (const f of found || []) m[f.from] = { said: f.said, was: f.was, at };
  const keys = Object.keys(m);
  if (keys.length > MAX_OVERRIDES_PER_LANG) {
    keys.sort((a, b) => (m[a].at || 0) - (m[b].at || 0)).slice(0, keys.length - MAX_OVERRIDES_PER_LANG).forEach((k) => { delete m[k]; });
  }
  next[tag] = m;
  return next;
}

/** The reply's sentence for an override just made. */
export function overrideNote(tag, found) {
  const n = (found || []).length;
  if (!n) return "";
  const what = n === 1 ? "“" + found[0].said + "”" : n + " phrases";
  return "Changed the " + tag + " wording to " + what + ". It is kept as your own " + tag + " wording, so later translations won't replace it.";
}

/** The owner's note for overrides whose primary-language wording has changed since, or "". */
export function staleNote(staleByTag) {
  const out = [];
  for (const [tag, list] of Object.entries(staleByTag || {})) {
    const n = Array.isArray(list) ? list.length : 0;
    if (!n) continue;
    out.push((n === 1 ? "Your own " + tag + " wording for “" + list[0] + "” was kept" : n + " of your own " + tag + " wordings were kept") +
      ", but the original wording " + (n === 1 ? "it was" : "they were") + " made from has changed — check the " + tag + " pages.");
  }
  return out.join(" ");
}

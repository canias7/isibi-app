// KEEP GOING FROM WHERE IT LEFT OFF (2026-10-31, the owner: a part that ran
// out of credits "should keep going from where it left off"). Live, on
// northline-climbing, a Gallery part paused after 6 minutes of work and the
// resumed part began again from a blank sheet.
//
// When the agent stops for credits, the files it had written (never saved to
// the site) are kept beside the request part as a CARRY: each file with the
// site's own text it started from, plus the facts of how far it got. The
// resumed part (the same request part, a later attempt) opens the carry and
// starts from those files. A file the site has changed since (another part
// saved over it) is NOT carried: the site's newer text wins, and the agent is
// told to redo that file. Pure: storage is the caller's. The key lives under
// the site's own `source/` prefix: a container job's storage gateway refuses
// any other (live, 2026-10-31: a `carry/` key was refused, so nothing carried).

import { fileMap } from "./agent-guard.mjs";

/** The carry's storage key for a request part's job key (`<key>-p<n>-<seq>`); "" when the key is not a part's. */
export function carryKey(slug, idem) {
  const m = /^([A-Za-z0-9_-]+-p\d+)-\d+$/.exec(String(idem || ""));
  const s = String(slug || "");
  return m && /^[a-z0-9-]+$/.test(s) ? "source/" + s + "/carry/" + m[1] + ".json" : "";
}

/**
 * The carry from a stopped run: `before` is the site's files the run started
 * from, `ag` the run's answer (pages, parts, css, changed, removed). Null when
 * there is nothing to carry.
 */
export function makeCarry(before, ag, note = "") {
  const b = before instanceof Map ? before : fileMap(before);
  const a = fileMap({ pages: ag && ag.pages, parts: ag && ag.parts, css: ag && ag.css });
  const files = {};
  for (const k of Array.isArray(ag && ag.changed) ? ag.changed : []) {
    if (typeof k !== "string" || !a.has(k)) continue;
    files[k] = { base: b.has(k) ? b.get(k) : null, source: a.get(k) };
  }
  const removed = (Array.isArray(ag && ag.removed) ? ag.removed : []).filter((k) => typeof k === "string" && b.has(k)).map((k) => ({ key: k, base: b.get(k) }));
  if (!Object.keys(files).length && !removed.length) return null;
  return { v: 1, files, removed, note: String(note || "").slice(0, 2000) };
}

/**
 * The resumed run's starting files: the site as it is now (`now`, a fileMap
 * or `{pages, parts, css}`) with every carried file whose base is still the
 * site's text laid over it. `kept` and `stale` name the files carried and the
 * ones the site changed since. Null when the carry is unreadable.
 */
export function applyCarry(carry, now) {
  if (!carry || carry.v !== 1 || !carry.files || typeof carry.files !== "object") return null;
  const cur = now instanceof Map ? new Map(now) : fileMap(now);
  const kept = [], stale = [];
  for (const [k, f] of Object.entries(carry.files)) {
    if (!f || typeof f.source !== "string") continue;
    const base = cur.has(k) ? cur.get(k) : null;
    if (base === f.base) { cur.set(k, f.source); kept.push(k); } else stale.push(k);
  }
  for (const r of Array.isArray(carry.removed) ? carry.removed : []) {
    if (!r || typeof r.key !== "string") continue;
    if (cur.get(r.key) === r.base) { cur.delete(r.key); kept.push(r.key); } else if (cur.has(r.key)) stale.push(r.key);
  }
  if (!kept.length) return { kept, stale, files: null };
  return { kept, stale, files: cur };
}

/** A fileMap back to `{pages, parts, css}` (the agent's own shapes), `css` kept null when the site's was. */
export function fromFileMap(m, css0 = null) {
  const pages = [], parts = [];
  let css = css0;
  for (const [k, source] of m) {
    if (k === "styles.css") { css = source; continue; }
    if (k.startsWith("-parts/")) parts.push({ name: k.slice(7), source });
    else pages.push({ path: k, source });
  }
  return { pages, parts, css };
}

/** What the resumed agent is told. */
export function carryRequest(words, applied, note) {
  const said = ["THIS CHANGE WAS STARTED BEFORE AND PAUSED WHEN THE ACCOUNT RAN OUT OF CREDITS. Keep going from where it left off: do not start again."];
  if (applied.kept.length) said.push("Already written (in the files now, read them first and only finish what is missing): " + applied.kept.join(", ") + ".");
  if (applied.stale.length) said.push("Changed on the site since, so that earlier work was dropped and must be done again on the current text: " + applied.stale.join(", ") + ".");
  if (note) said.push("How far it got: " + String(note).slice(0, 1500));
  return String(words || "") + "\n\n" + said.join(" ");
}

// THE SITE AGENT'S GUARDRAILS (2026-10-30, the owner approved restoring the
// six the old router and lanes had). Plain functions, no I/O; `worker.js`'s
// `runAgentChange` wires them. Each one REUSES the older steps' own readers:
//
//   1. nothing else changed  `textItems` (the text rung's list of the site's
//      words), `pairLinks` and `partStates` (the page rung's link and component
//      preservation, `page-keep.mjs`), `quoteInMessage` (whether the request
//      names an item). A deterministic report of what moved; the agent is shown
//      it ONCE before it may finish, and what it kept reaches the reply's facts.
//      Never a block: a broad request ("redesign the site") answers the question
//      by finishing again.
//   2. only the part asked for  `importedParts` (the file picker's import walk):
//      a scoped part's agent writes its pages, the components they import, and
//      the stylesheet only on a `look` answer.
//   3. one retry  `retryAfterStop` / `retryableSave`: exactly one more run.
//   4. version names  `versionName`: the agent's own summary's first clause.
//   6. undo facts  `undoFacts`: what the change took away and the version
//      before it, as facts, never a sentence for the customer.
import { textItems } from "./site-apply.mjs";
import { pairLinks, partStates, quoteInMessage } from "./page-keep.mjs";
import { importedParts, partKey } from "./file-picker.mjs";

export const CSS_KEY = "styles.css";

/** A workspace's files as `key → source`, the agent's own keys. */
export function fileMap({ pages = [], parts = [], css = null } = {}) {
  const m = new Map();
  for (const p of Array.isArray(pages) ? pages : []) if (p && typeof p.path === "string" && typeof p.source === "string") m.set(p.path, p.source);
  for (const p of Array.isArray(parts) ? parts : []) if (p && typeof p.name === "string" && typeof p.source === "string") m.set(partKey(p.name), p.source);
  if (typeof css === "string") m.set(CSS_KEY, css);
  return m;
}

/** What moved between two workspaces: `{changed, removed, cssChanged}`, the agent's own shape. */
export function workspaceDiff(before, after) {
  const b = before instanceof Map ? before : fileMap(before), a = after instanceof Map ? after : fileMap(after);
  const keys = [...new Set([...b.keys(), ...a.keys()])];
  return {
    changed: keys.filter((k) => b.get(k) !== a.get(k) && !(k === CSS_KEY && !a.has(k))),
    removed: [...b.keys()].filter((k) => k !== CSS_KEY && !a.has(k)),
    cssChanged: b.has(CSS_KEY) && a.has(CSS_KEY) && b.get(CSS_KEY) !== a.get(CSS_KEY),
  };
}

const routeOfKey = (k) => (k === "index.tsx" ? "/" : "/" + k.replace(/\.tsx$/, "").replace(/\/index$/, ""));
const named = (request, s) => typeof s === "string" && s.trim() !== "" && quoteInMessage(request, s);
const textsOf = (k, src) => textItems([{ path: k, source: String(src || "") }]).map((t) => t.text);

/**
 * WHAT CHANGED, AND WHETHER THE REQUEST NAMED IT — `{files, items, unasked,
 * review}`. Every changed file is read; for each, the words that are gone
 * (the text rung's own list), the links lost or re-pointed and the site's own
 * components no longer drawn (the page rung's checks), and every file taken
 * away. An item is ASKED when the request quotes it (its words, link words or
 * destination, component name or page). `review` is true when something the
 * request did not name was TAKEN AWAY: a link, a component, a file, or more of
 * a file's words than the change put in (a one-for-one rewording is reported,
 * never sent back on its own).
 */
export function changeReport(before, after, request = "") {
  const b = before instanceof Map ? before : fileMap(before), a = after instanceof Map ? after : fileMap(after);
  const req = String(request || "");
  const d = workspaceDiff(b, a);
  const items = [];
  let review = false;
  for (const k of d.changed) {
    if (k === CSS_KEY) { items.push({ file: k, kind: "styles", asked: true }); continue; }
    if (!a.has(k)) {
      const asked = named(req, routeOfKey(k)) || named(req, k.replace(/^-parts\//, "").replace(/\.tsx$/, "").replace(/[-/]/g, " "));
      items.push({ file: k, kind: "file-removed", asked });
      if (!asked) review = true;
      continue;
    }
    if (!b.has(k)) { items.push({ file: k, kind: "file-added", asked: true }); continue; }
    const s0 = b.get(k), s1 = a.get(k);
    const now = textsOf(k, s1), left = [...now];
    const gone = [];
    for (const t of textsOf(k, s0)) { const i = left.indexOf(t); if (i >= 0) left.splice(i, 1); else gone.push(t); }
    const unaskedText = gone.filter((t) => !named(req, t));
    for (const t of gone) items.push({ file: k, kind: "text", text: t.slice(0, 120), asked: !unaskedText.includes(t) });
    if (unaskedText.length > left.length) review = true;
    const inPart = k.startsWith("-parts/");
    let links = { lost: [], retargeted: [] }, parts = { gone: [] };
    try { links = pairLinks(s0, s1); } catch { /* unreadable: no link facts */ }
    try { parts = partStates(s0, s1, { inPart }); } catch { /* unreadable: no component facts */ }
    for (const l of links.lost) { const asked = named(req, l.label) || named(req, l.href); items.push({ file: k, kind: "link-lost", label: l.label, href: l.href, asked }); if (!asked) review = true; }
    for (const l of links.retargeted) { const asked = named(req, l.label) || named(req, l.to); items.push({ file: k, kind: "link-moved", label: l.label, href: l.href, to: l.to, asked }); if (!asked) review = true; }
    for (const p of parts.gone) { const asked = named(req, p.name.replace(/[-_]/g, " ")); items.push({ file: k, kind: "part-gone", name: p.name, asked }); if (!asked) review = true; }
  }
  return { files: d.changed, items, unasked: items.filter((i) => !i.asked), review };
}

const say = (i) => {
  switch (i.kind) {
    case "text": return i.file + ": the words \"" + i.text + "\" are gone";
    case "link-lost": return i.file + ": the link \"" + (i.label || i.href) + "\" (" + i.href + ") is gone";
    case "link-moved": return i.file + ": the link \"" + (i.label || i.href) + "\" now points to " + i.to + " (was " + i.href + ")";
    case "part-gone": return i.file + ": the component " + i.name + " is no longer shown";
    case "file-removed": return i.file + " was removed";
    default: return i.file + " changed";
  }
};

/** The one message the agent is sent back with before it may finish: what it took away that the request did not name. Empty when nothing needs asking. */
export function reviewNote(report, max = 14) {
  if (!report || !report.review) return "";
  const list = report.unasked.filter((i) => i.kind !== "styles").slice(0, max).map((i) => "- " + say(i));
  return "BEFORE YOU FINISH, CHECK THESE: your change took away things the request did not name:\n" + list.join("\n") +
    "\nWere they asked for? If the request covers them (a redesign, a rewrite, a removal), finish again as you are. If not, put back each one that was not asked for, build, and finish.";
}

/** The facts the reply is told: which files changed, and what was taken away that the request did not name (after the agent was asked). */
export function reportFacts(report) {
  if (!report || !report.files.length) return "";
  const left = report.unasked.filter((i) => i.kind !== "styles" && i.kind !== "text");
  const texts = report.unasked.filter((i) => i.kind === "text");
  const bits = left.slice(0, 6).map(say);
  if (texts.length) bits.push(texts.length + (texts.length === 1 ? " piece" : " pieces") + " of wording the request did not quote changed or went");
  return bits.length ? "Also changed, not named in the request: " + bits.join("; ") + "." : "";
}

/**
 * ONLY THE PART ASKED FOR (2026-10-30): a check for the agent's writes when
 * the router or the part named pages (`routes`, "/visit"). Its pages, the
 * site's own components they import (followed through components), and the
 * stylesheet only when the answer is about the look. `null` when no scope is
 * known: the agent writes anywhere, as before.
 */
export function scopeGuard({ pages = [], parts = [], routes = null, look = false } = {}) {
  const want = (Array.isArray(routes) ? routes : []).filter((r) => typeof r === "string" && r.startsWith("/"));
  if (!want.length) return null;
  const files = new Map((Array.isArray(pages) ? pages : []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source || "")]));
  const partSrc = new Map((Array.isArray(parts) ? parts : []).filter((p) => p && typeof p.name === "string").map((p) => [p.name, String(p.source || "")]));
  const keys = new Set();
  const queue = [];
  for (const r of want) {
    const norm = r === "/" ? "/" : r.replace(/\/+$/, "").toLowerCase();
    for (const [k, src] of files) if (routeOfKey(k).toLowerCase() === norm) { keys.add(k); queue.push([src, false]); }
  }
  while (queue.length) {
    const [src, inParts] = queue.shift();
    for (const n of importedParts(src, { inParts })) {
      const k = partKey(n);
      if (partSrc.has(n) && !keys.has(k)) { keys.add(k); queue.push([partSrc.get(n), true]); }
    }
  }
  if (look) keys.add(CSS_KEY);
  const allowed = [...keys];
  return (key) => {
    const k = typeof key === "string" ? key.trim() : "";
    if (keys.has(k)) return "";
    if (k === CSS_KEY) return "this request is about " + want.join(", ") + ", not the site's look, so the stylesheet is not yours to change this time. If the change truly needs it, say so in your finish summary.";
    return "this part of the request is only about " + want.join(", ") + "; " + k + " is outside it. You may write: " + allowed.join(", ") + ". If the change truly needs another file, say so in your finish summary instead.";
  };
}

/** The stops one more run can get past: the step, time or length limits, an answer with no action, a model call that failed. Never `credits`. */
export const RETRY_STOPS = Object.freeze(["rounds", "time", "no-tool", "too-long", "send"]);
export const retryAfterStop = (stopped) => RETRY_STOPS.includes(stopped);

/** A failed save the agent can fix: its own code did not compile. A save lost to another job's overlap (`ours`) is re-run elsewhere, never here. */
export function retryableSave(out) {
  return !!(out && out.ok === false && out.ours !== true);
}

/** The request the second run is given: the same words, why the first stopped, and that the workspace is as it was left. */
export function retryRequest(words, why) {
  return String(words || "") + "\n\nA FIRST ATTEMPT AT THIS DID NOT FINISH: " + String(why || "it stopped") +
    ". The files are as that attempt left them (read them before you write). Table changes it queued were not kept: queue them again if they are needed. Finish the change, build, and finish.";
}

const SECRETISH = [/\b(?:sk|pk|rk|whsec|re|xai|key)[-_][A-Za-z0-9_-]{8,}/gi, /\b[A-Za-z0-9+/=_-]{32,}\b/g, /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/gi];

/** A short version name from the agent's own summary (its first clause), else the request's words, else `fallback`. At most `max` characters, nothing key-like. */
export function versionName(summary, words, fallback = "Changed by the site agent", max = 60) {
  const clean = (s) => {
    let t = String(s || "").replace(/\s+/g, " ").trim();
    for (const re of SECRETISH) t = t.replace(re, "…");
    t = t.split(/(?<=[.;:!?])\s|\s[—–]\s|\n/)[0].replace(/[.;:!?,\s]+$/, "").trim();
    if (t.length > max) { const cut = t.slice(0, max - 1); const sp = cut.lastIndexOf(" "); t = (sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[,\s]+$/, "") + "…"; }
    return /\p{L}{2,}/u.test(t) ? t : "";
  };
  return clean(summary) || clean(words) || fallback;
}

const PHOTO = /<(?:img|Image|picture)\b/g;
const photoCount = (src) => (String(src || "").match(PHOTO) || []).length;

/**
 * WHAT CAN BE UNDONE, AS FACTS (2026-10-30): the version before the change
 * (`restoreTo`, the live pointer read before the save), the pages taken off,
 * the photographs taken off with their space (`photosTakenOff`, the picture
 * step's own field, which the reply already knows how to offer a roll-back
 * for), and the table entries removed. Only keys that hold something.
 */
export function undoFacts({ before, after, version = "", rowsRemoved = 0 } = {}) {
  const b = before instanceof Map ? before : fileMap(before), a = after instanceof Map ? after : fileMap(after);
  const out = {};
  const pagesRemoved = [...b.keys()].filter((k) => k !== CSS_KEY && !k.startsWith("-parts/") && !a.has(k)).map(routeOfKey);
  if (pagesRemoved.length) out.pagesRemoved = pagesRemoved;
  let off = 0;
  for (const [k, src] of b) if (k !== CSS_KEY) off += Math.max(0, photoCount(src) - photoCount(a.get(k)));
  if (off) out.photosTakenOff = off;
  if (Number(rowsRemoved) > 0) out.rowsRemoved = Number(rowsRemoved);
  if (typeof version === "string" && version) out.restoreTo = version;
  return out;
}

/** The undo facts as one sentence for the reply writer, or "". */
export function undoSentence(u) {
  if (!u || !u.restoreTo || !(u.pagesRemoved || u.photosTakenOff || u.rowsRemoved)) return "";
  const what = [u.pagesRemoved && "the removed " + (u.pagesRemoved.length === 1 ? "page " : "pages ") + u.pagesRemoved.join(", "),
    u.photosTakenOff && (u.photosTakenOff === 1 ? "a photograph" : u.photosTakenOff + " photographs") + " taken off"].filter(Boolean);
  const rows = u.rowsRemoved ? " Removed table entries are not in a version; they would have to be added again." : "";
  return (what.length ? "To undo " + what.join(" and ") + ", the previous version (" + u.restoreTo + ") can be restored in Cloud → Versions." : "") + rows;
}

// An add-on answer about things the site already has, and a question asked
// after the request was paid for (2026-10-24, addon-existing).
//
// LIVE, AT MAIN 7956740c4: the router answered `addon` for parts whose every
// target already exists (`page:/shop`, `page:/cafe`, `data:lessons`). The add-on
// step then found nothing new to add — an empty pick (`no-add`), a judge that
// put every requirement elsewhere, or a single entry written into a list with
// a required column left out (Postgres 23502) — and the part ended with its
// routing charged and nothing done. And a part of a request that was already
// charged could still be answered with a question (`clarify`), against the
// owner's rule that nothing is asked after charging; its answer resumed the
// same request and paid for routing again.
//
// Plain module, no I/O. Every rule reads the router's own typed targets and
// the site's own page and table lists: no words of the message are read here.

import { readTargets, pagePath } from "./request-plan.mjs";
import { resolveAccess } from "../site-access.mjs";

/** The site's pages, as paths, from a digest's `pages` (strings or `{ path }`). */
export function sitePages(site) {
  const raw = site && Array.isArray(site.pages) ? site.pages : [];
  const out = [];
  for (const p of raw) {
    const v = pagePath(typeof p === "string" ? p : p && typeof p.path === "string" ? p.path : null);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** The site's tables, lower case, from a digest's `tables` (strings or `{ name }`). */
export function siteTables(site) {
  const raw = site && Array.isArray(site.tables) ? site.tables : [];
  const out = [];
  for (const t of raw) {
    const v = typeof t === "string" ? t : t && typeof t.name === "string" ? t.name : "";
    const k = v.trim().toLowerCase();
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** What one routed change names, writes then reads, each once. */
function namedOf(routed, change = 0) {
  const t = readTargets(routed && routed.targets)[change];
  return { writes: t ? t.writes : [], reads: t ? t.reads : [] };
}

/** `page:/x` or `new-page:/x` → `/x`; anything else → null. */
const pageOf = (t) => (t.startsWith("page:") ? t.slice(5) : t.startsWith("new-page:") ? t.slice(9) : null);
/** `data:x` or `new-data:x` → `x`; anything else → null. */
const tableOf = (t) => (t.startsWith("data:") ? t.slice(5) : t.startsWith("new-data:") ? t.slice(9) : null);

/**
 * WHAT A CHANGE CREATES BESIDE A PAGE (2026-10-25, feature-existing). Live on
 * driftwood-and-daughters-5 after b12dba52c: "each lesson bookable online ...
 * max 8 per group ... a switch to mark a day closed" on the Lessons page the
 * site has went to the page step, which rewrote the page's words and built no
 * booking. A change that creates a table, a component (a form, a section), a
 * stored function, a connection or a schedule is an addition even when the
 * page it goes on exists; `new-page` is not here (a new page is read below).
 */
const CREATES = ["new-data:", "new-component:", "new-function:", "new-api:", "new-job:"];
const creates = (t) => CREATES.some((k) => t.startsWith(k));

/**
 * AN ADD-ON ANSWER READ AGAINST THE SITE AS IT IS.
 *
 *   `{ act: "edit", page }`        every thing the change writes is a page or a
 *                                  list the site already has, and at least one
 *                                  is a page: nothing is new, so the change is
 *                                  the page step's, on that page, in the same
 *                                  words.
 *   `{ act: "feature", page }`     the change writes a page the site has AND
 *                                  creates something beside it (`CREATES`), or
 *                                  writes a table the site does not have: an
 *                                  addition on that page, kept on the add-on
 *                                  step with the page as its target.
 *   `{ act: "page-asked", page }`  the change writes a page (one the site has,
 *                                  or a new one): it is not one more entry in a
 *                                  list. `page` is the first written page the
 *                                  site has, or `""`.
 *   `null`                         anything else, including an answer with no
 *                                  readable targets or a site whose pages are
 *                                  not known: the add-on runs as before.
 *
 * Only change 0 is read — the part this answer runs; held parts are routed on
 * their own.
 */
export function addonOnExisting(routed, site) {
  if (!routed || routed.intent !== "addon") return null;
  const pages = sitePages(site);
  if (!pages.length) return null;
  const tables = siteTables(site);
  const { writes } = namedOf(routed, 0);
  if (!writes.length) return null;
  const written = writes.map(pageOf).filter(Boolean);
  const firstHad = written.find((p) => pages.includes(p)) || "";
  const allHad = writes.every((t) => {
    const p = pageOf(t);
    if (p) return pages.includes(p);
    const n = tableOf(t);
    if (n) return tables.includes(n);
    return false;
  });
  const newThing = writes.some((t) => creates(t) || (t.startsWith("data:") && !tables.includes(tableOf(t))));
  if (firstHad && newThing) return { act: "feature", page: firstHad };
  if (allHad && firstHad) return { act: "edit", page: firstHad };
  if (written.length) return { act: "page-asked", page: firstHad };
  return null;
}

/**
 * THE ROUTER'S ANSWER WITH AN ADD-ON ABOUT EXISTING THINGS SENT TO THE PAGE
 * STEP, or the answer unchanged. A changed answer names `addon-existing` in its
 * decision; a page-asked add-on carries a hand-over saying so (`page-asked`,
 * field `page`) unless it already carries one, so the add-on step never takes
 * the single-entry path for it.
 */
export function routeOnExisting(routed, site, { reason } = {}) {
  const read = addonOnExisting(routed, site);
  if (!read) return routed;
  const note = (d) => (d && typeof d === "object" && Array.isArray(d.reasons)
    ? { ...d, reasons: d.reasons.includes(reason) ? d.reasons : [...d.reasons, reason] } : d);
  if (read.act === "edit") {
    // THE HAND-OVER SAYS WHY (2026-10-25, frame-parallel): `existing`, so the
    // page step takes an unchanged page as "already there" instead of retrying
    // it into a whole-page rewrite.
    return { ...routed, intent: "edit", layer: "page", page: read.page, remove: false, rename: undefined, tab: false, handOver: { from: "route", reason: "existing", page: read.page }, model3d: undefined, decision: reason ? note(routed.decision) : routed.decision };
  }
  if (routed.handOver && typeof routed.handOver === "object") return routed;
  if (read.act === "feature") return { ...routed, handOver: { from: "route", reason: "feature-on-page", field: "component", page: read.page } };
  return { ...routed, handOver: { from: "route", reason: "page-asked", field: "page", ...(read.page ? { page: read.page } : {}) } };
}

/**
 * A QUESTION FOR A PART OF A REQUEST ALREADY CHARGED IS NEVER ASKED: it becomes
 * the obvious choice. A page the site has, named by the change (written or
 * read), is edited by the page step; otherwise the add-on step decides what to
 * make. A start-over confirmation (`confirm: "rewrite"`) is not converted: it
 * is the one question that must be asked before a rewrite, and it is never a
 * part's. Returns the answer unchanged when it is not a question.
 */
export function partClarifyChoice(routed, site, { reason } = {}) {
  if (!routed || routed.intent !== "clarify" || routed.confirm === "rewrite") return routed;
  const pages = sitePages(site);
  const { writes, reads } = namedOf(routed, 0);
  const named = [...writes, ...reads].map(pageOf).filter(Boolean);
  const page = named.find((p) => pages.includes(p)) || "";
  const decision = routed.decision && typeof routed.decision === "object" && Array.isArray(routed.decision.reasons) && reason
    ? { ...routed.decision, reasons: routed.decision.reasons.includes(reason) ? routed.decision.reasons : [...routed.decision.reasons, reason] }
    : routed.decision;
  const base = { ...routed, question: undefined, again: undefined, note: undefined, decision };
  if (page) return { ...base, intent: "edit", layer: "page", page, remove: false, tab: false };
  return { ...base, intent: "addon" };
}

/**
 * WHAT A LONE ENTRY DOES NOT DO (2026-10-25, owner: a lone `row` answer was
 * written and replied to as done while the feature asked for beside it — live,
 * bookings — was never built). The row designer lists its requirements as every
 * other designer does; each one not `covered` by the entries, grounded in the
 * customer's own words, is TOLD (never read as done) and, when its words are
 * not the whole message, HANDED ON as a part of its own. `wordsIn` is the
 * route's own reader (`builder/site-ask.mjs`), passed in.
 *   → { told: [{ need, status, step }], carry: [words] }
 */
export function rowUnmet(requirements, instruction, wordsIn) {
  const told = [];
  const carry = [];
  const msg = typeof instruction === "string" ? instruction : "";
  const whole = msg.trim();
  for (const r of Array.isArray(requirements) ? requirements : []) {
    if (!r || typeof r !== "object") continue;
    if (r.status !== "elsewhere" && r.status !== "unsupported") continue;
    const need = typeof r.need === "string" ? r.need.trim() : "";
    const w = typeof r.words === "string" && r.words.trim() ? wordsIn(msg, r.words) : "";
    if (!need || !w) continue;
    told.push({ need, status: r.status, ...(typeof r.step === "string" && r.step ? { step: r.step } : {}) });
    if (w.trim() !== whole && !carry.includes(w)) carry.push(w);
  }
  return { told, carry };
}

/**
 * A DESIGN THAT DESIGNS NOTHING (2026-10-25, row-hedge). Live on
 * driftwood-and-daughters-5 at a63451c3a: the Lessons booking reached the
 * component designer under `feature-on-page`, which answered an empty design
 * (not `undefined`) and handed every requirement to the page step. The
 * "designed nothing" retry read only `undefined`, so it never ran, the
 * cleaner refused the empty list (`nothing`), and the booking was never built.
 * Absent, null, an empty list, or a list with no object in it are all nothing.
 */
export function designedNothing(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return !value.some((v) => v && typeof v === "object" && !Array.isArray(v));
  return false;
}

/**
 * WHAT THE COMPONENT DESIGNER IS TOLD ABOUT A FEATURE HANDED TO IT ON A PAGE
 * THE SITE HAS (2026-10-25, row-hedge). The hand-over reached the picker only,
 * so the designer read "on the Lessons page" as the page step's work. `""` for
 * any other kind or hand-over. Model input, never a customer sentence.
 */
export function featureBrief(hand, kind) {
  if (kind !== "component" || !hand || typeof hand !== "object" || hand.reason !== "feature-on-page") return "";
  const page = typeof hand.page === "string" && hand.page ? hand.page : "";
  if (!page) return "";
  return "\n\nHow this reached you: the router read this as something new to build on " + page
    + ", a page the site already has. Build it here, as a component placed on " + page
    + ". What it has to do (a form, a limit, a switch) is this component's to make: do not hand it to the page step.";
}

/**
 * WHAT AN ADDITION NEEDED OF A TABLE THE SITE ALREADY HAS AND COULD NOT TAKE
 * (2026-10-25, run 6). The add-on never moves an existing table's read or
 * write level (`mergeAddonSchema` keeps only `ADDON_TABLE_FIELDS`), and that
 * is right; but a designer that put a level on such a table was saying what
 * the feature needs (live: a visitor form on `lesson_bookings`, which nobody
 * could write to), and the need went nowhere. Each designed level that
 * resolves differently from the stored one (`resolveAccess`, never a preset's
 * name) is returned: `{ table, read?, write? }`, only the halves that differ.
 */
export function accessShortfalls(prior, designed) {
  const priorTables = Array.isArray(prior) ? prior : (prior && Array.isArray(prior.tables) ? prior.tables : []);
  const designedTables = Array.isArray(designed) ? designed : (designed && Array.isArray(designed.tables) ? designed.tables : []);
  const byName = new Map();
  for (const t of priorTables) if (t && typeof t.name === "string") byName.set(t.name.toLowerCase(), t);
  const out = [];
  for (const d of designedTables) {
    if (!d || typeof d.name !== "string") continue;
    const have = byName.get(d.name.toLowerCase());
    if (!have) continue;
    if (d.access === undefined && d.read === undefined && d.write === undefined) continue;
    const before = resolveAccess(have);
    const viaPreset = d.access !== undefined;
    const wanted = resolveAccess({
      access: viaPreset ? d.access : have.access,
      read: d.read !== undefined ? d.read : (viaPreset ? undefined : have.read),
      write: d.write !== undefined ? d.write : (viaPreset ? undefined : have.write),
    });
    const gap = { table: have.name };
    if (wanted.read !== before.read) gap.read = wanted.read;
    if (wanted.write !== before.write) gap.write = wanted.write;
    if (gap.read !== undefined || gap.write !== undefined) out.push(gap);
  }
  return out;
}

/**
 * EACH UNMET NEED ON AN EXISTING TABLE HANDED TO THE RULES STEP AS A PART OF
 * ITS OWN (2026-10-25, run 6), through the request's existing carve
 * (`deferred`). Two sources, both structural:
 *   - a requirement the step did not cover (`unsupported` or `elsewhere`)
 *     whose own account (`need`, `why`) names a table the site already has —
 *     live: "lesson_bookings is not open for visitors to write";
 *   - a level the designer put on such a table (`accessShortfalls`), which the
 *     add-on never takes.
 * The part's words are the customer's own (the requirement's grounded
 * `words`, never the whole message); it goes straight to `rules`, shown that
 * one table. A shortfall with no words of theirs is `told`, never dropped and
 * never read as done.
 *   -> { handTo: [{ words, layer: "rules", table, read?, write? }], told: [gap] }
 */
export function accessHandTo(gaps, requirements, instruction, wordsInFn, priorTables = []) {
  const msg = typeof instruction === "string" ? instruction : "";
  const whole = msg.trim();
  const tables = (Array.isArray(priorTables) ? priorTables : (priorTables && Array.isArray(priorTables.tables) ? priorTables.tables : []))
    .map((t) => (t && typeof t.name === "string" ? t.name : "")).filter((n) => /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(n));
  const gapOf = new Map();
  for (const g of Array.isArray(gaps) ? gaps : []) if (g && typeof g.table === "string") gapOf.set(g.table.toLowerCase(), g);
  const names = (text, list) => list.filter((n) => new RegExp("(^|[^A-Za-z0-9_])" + n + "([^A-Za-z0-9_]|$)", "i").test(text));
  const open = [];
  for (const r of Array.isArray(requirements) ? requirements : []) {
    if (!r || typeof r !== "object" || (r.status !== "elsewhere" && r.status !== "unsupported")) continue;
    const w = typeof r.words === "string" && r.words.trim() && typeof wordsInFn === "function" ? wordsInFn(msg, r.words) : "";
    if (!w || w.trim() === whole) continue;
    const text = [r.need, r.why].filter((x) => typeof x === "string").join(" ");
    open.push({ w, text, tables: names(text, tables) });
  }
  const handTo = [];
  const seen = new Set();
  const push = (w, table) => {
    const key = w + "\n" + table.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const g = gapOf.get(table.toLowerCase()) || {};
    handTo.push({ words: w, layer: "rules", table, ...(g.read !== undefined ? { read: g.read } : {}), ...(g.write !== undefined ? { write: g.write } : {}) });
  };
  for (const o of open) for (const t of o.tables) push(o.w, t);
  const told = [];
  for (const g of gapOf.values()) {
    if (handTo.some((h) => h.table.toLowerCase() === g.table.toLowerCase())) continue;
    const unnamed = open.filter((o) => !o.tables.length);
    if (unnamed.length === 1) push(unnamed[0].w, g.table);
    else told.push(g);
  }
  return { handTo, told };
}

/** A `handTo` list as read off a step's answer: well-formed entries only, `[]` otherwise. */
export function readHandTo(v) {
  const LEVELS = /^[a-z]{2,16}$/;
  return (Array.isArray(v) ? v : []).filter((h) => h && typeof h === "object" && !Array.isArray(h)
    && typeof h.words === "string" && h.words.trim() && h.layer === "rules"
    && typeof h.table === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(h.table)
    && (h.read === undefined || (typeof h.read === "string" && LEVELS.test(h.read)))
    && (h.write === undefined || (typeof h.write === "string" && LEVELS.test(h.write)))
    )
    .map((h) => ({ words: h.words.trim(), layer: "rules", table: h.table, ...(h.read !== undefined ? { read: h.read } : {}), ...(h.write !== undefined ? { write: h.write } : {}) }));
}

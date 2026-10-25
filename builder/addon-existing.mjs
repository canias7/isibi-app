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
 * AN ADD-ON ANSWER READ AGAINST THE SITE AS IT IS.
 *
 *   `{ act: "edit", page }`        every thing the change writes is a page or a
 *                                  list the site already has, and at least one
 *                                  is a page: nothing is new, so the change is
 *                                  the page step's, on that page, in the same
 *                                  words.
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
    return { ...routed, intent: "edit", layer: "page", page: read.page, remove: false, rename: undefined, tab: false, handOver: undefined, model3d: undefined, decision: reason ? note(routed.decision) : routed.decision };
  }
  if (routed.handOver && typeof routed.handOver === "object") return routed;
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

// THE BUILD CHECKLIST (2026-10-22, the owner's idea #14): what the design step
// planned, checked against what the build really published, so the final reply
// can say exactly what was built and what was not.
//
// NO MODEL CALL. The list is derived in code from the design answer the build
// already holds (`plan.pages`, `plan.shape[].sections`, `spec.tables`), and each
// item is judged only from what the operations did: the files `publishPages`
// wrote (`files`), the pages salvage replaced with a stand-in (`salvaged`), the
// sections the band writers refused (`unwritten`), the browser check's serious
// findings per route (`render`, judged by `site-render.mjs`'s `SERIOUS`), and
// the table names the schema apply reports it made. Never the request's words.
//
// Components (`plan.components`) are free-text lines with no operation that
// reports them one by one, so they are deliberately not checklist items: an
// item nobody can verify would be a claim, not a fact.

import { bandsOf } from "./page-bands.mjs";
import { routeIdFor } from "./publish-pages.mjs";
import { SERIOUS } from "./site-render.mjs";

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * The checklist, from the design answer alone.
 *
 * `{kind:"page", path, name, sections}` for each planned page (sections are the
 * page's planned bands, as the band writer would split them), then
 * `{kind:"band", path, page, line}` for each band, then `{kind:"table", name}`
 * for each declared table. Anything that does not read is left out, never
 * guessed.
 */
export function checklistFromDesign(args) {
  const { plan, spec } = args && typeof args === "object" ? args : {};
  const p = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
  const items = [];
  const pages = Array.isArray(p.pages) ? p.pages : [];
  const seen = new Set();
  for (const pg of pages) {
    if (!pg || typeof pg !== "object" || Array.isArray(pg)) continue;
    const path = str(pg.path);
    if (!path || !path.startsWith("/") || seen.has(path)) continue;
    seen.add(path);
    const name = str(pg.name) || str(pg.role) || path;
    const bands = bandsOf(p.shape, path);
    items.push({ kind: "page", path, name, sections: bands.length });
    for (const line of bands) items.push({ kind: "band", path, page: name, line });
  }
  const tables = spec && typeof spec === "object" && Array.isArray(spec.tables) ? spec.tables : [];
  const tseen = new Set();
  for (const t of tables) {
    const name = str(t && t.name);
    if (!name || tseen.has(name)) continue;
    tseen.add(name);
    items.push({ kind: "table", name });
  }
  return items;
}

/**
 * Each item checked against what was published: `{item, done, why}`.
 *
 * `pages` is `publishPages`' out object (as it reaches the answer); `tables` is
 * the list of table names the schema apply made, or null when no database was
 * made. A build that did not publish the app checks nothing (empty list): its
 * own failure line already says so.
 */
export function verifyChecklist(items, { pages, tables = null } = {}) {
  const list = Array.isArray(items) ? items : [];
  const p = pages && typeof pages === "object" ? pages : null;
  if (!p || p.page !== "app") return [];
  const routeFiles = new Set();
  for (const f of Array.isArray(p.files) ? p.files : []) {
    if (typeof f !== "string" || f.includes("/-parts/")) continue;
    routeFiles.add(routeIdFor(f));
  }
  const stubbed = new Set((Array.isArray(p.salvaged) ? p.salvaged : []).filter((f) => typeof f === "string").map((f) => routeIdFor(f)));
  const broken = new Map();
  const render = p.render && typeof p.render === "object" ? p.render : null;
  for (const f of render && Array.isArray(render.findings) ? render.findings : []) {
    if (f && SERIOUS.has(f.kind) && typeof f.route === "string" && !broken.has(f.route)) broken.set(f.route, f.kind);
  }
  const unwritten = new Set((Array.isArray(p.unwritten) ? p.unwritten : []).map((u) => str(u && u.section)).filter(Boolean));
  const made = new Set((Array.isArray(tables) ? tables : []).filter((t) => typeof t === "string"));

  const pageVerdict = (path) => {
    if (!routeFiles.has(path)) return { done: false, why: "missing" };
    if (stubbed.has(path)) return { done: false, why: "stub" };
    if (broken.has(path)) return { done: false, why: broken.get(path) };
    return { done: true, why: render ? "rendered" : "written" };
  };
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    if (item.kind === "page") out.push({ item, ...pageVerdict(item.path) });
    else if (item.kind === "band") {
      const pv = pageVerdict(item.path);
      if (!pv.done) out.push({ item, done: false, why: "page-" + pv.why });
      else if (unwritten.has(item.line)) out.push({ item, done: false, why: "unwritten" });
      else out.push({ item, done: true, why: "written" });
    } else if (item.kind === "table") {
      out.push(made.has(item.name) ? { item, done: true, why: "provisioned" } : { item, done: false, why: tables === null ? "no-database" : "not-provisioned" });
    }
  }
  return out;
}

const PAGE_WHY = {
  missing: "it was not written",
  stub: "it would not compile, so it's a placeholder",
  threw: "it threw an error in the browser check",
  blank: "it showed a blank page in the browser check",
};
const TABLE_WHY = {
  "no-database": "no database was made",
  "not-provisioned": "the database did not take it",
};

/**
 * The one honest line for the customer's reply, or "" when there is nothing
 * to say. Pages first with their written section counts, then tables.
 */
export function checklistLine(results) {
  const r = Array.isArray(results) ? results : [];
  const pagesR = r.filter((x) => x && x.item && x.item.kind === "page");
  const bandsR = r.filter((x) => x && x.item && x.item.kind === "band");
  const tablesR = r.filter((x) => x && x.item && x.item.kind === "table");
  const built = [], notBuilt = [];
  for (const pr of pagesR) {
    const name = pr.item.name;
    if (!pr.done) { notBuilt.push(name + " (" + (PAGE_WHY[pr.why] || "it did not build") + ")"); continue; }
    const mine = bandsR.filter((b) => b.item.path === pr.item.path);
    const ok = mine.filter((b) => b.done).length;
    const missed = mine.length - ok;
    let label = name;
    if (mine.length > 1 || missed) label += " (" + ok + " section" + (ok === 1 ? "" : "s") + (missed ? ", " + missed + " left out" : "") + ")";
    built.push(label);
  }
  for (const tr of tablesR) {
    if (tr.done) built.push("the " + tr.item.name + " table");
    else notBuilt.push("the " + tr.item.name + " table (" + (TABLE_WHY[tr.why] || "it was not made") + ")");
  }
  const parts = [];
  if (built.length) parts.push("Built: " + built.join(", ") + ".");
  if (notBuilt.length) parts.push("Not built: " + notBuilt.join(", ") + ".");
  return parts.join(" ");
}

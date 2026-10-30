/**
 * A REQUIREMENT CHECKED AGAINST THE BUILT SITE, BEFORE THE REPLY (2026-10-25,
 * feature-verify).
 *
 * Live on driftwood-and-daughters-5 every behavioural need of an addition (a
 * booking form, an owner-editable menu, badges, a group limit, a closed-day
 * switch) was told "I can't see from here whether…". The pieces to check them
 * were already in hand and never joined: the judge names what carries each need
 * (`carriedBy`: `page:/lessons`, `table:lesson_bookings`, `function:x`,
 * `table:t.column`); the render check opens every route in Chromium; the
 * shipped page code is read for the content evidence; and the post-apply schema
 * is known. This joins them, in code, with no model call:
 *
 *   page:/p      the page's code was shipped and the browser drew the route;
 *                which tables its code writes (`useCreateRow`, `useUpdateRow`,
 *                `useUploadFile`) and reads
 *                (`useRows`, `useRow`, `usePublicRows`), which functions it
 *                calls (`useRpc`, `useRpcAction`), and the forms the browser
 *                drew there (field names).
 *   table:T      T is in the schema, with its columns, and the owner can edit
 *                its rows (the Data panel opens every table of the site). Its
 *                declared rules — CHECKs, a row cap, a no-overlap rule, unique
 *                columns — are named.
 *   table:T.c    the column is there.
 *   function:F   F is in the schema's functions — and, since a function is
 *                behaviour, it settles a need only where a page named beside
 *                it calls it.
 *
 * AND THE JOIN ITSELF IS CHECKED: a need carried by a page and a table is met
 * only when that page's code reads or writes that table (or calls a function
 * the need also names). A page and a table that never meet are a gap, named.
 *
 * NO KEYWORD RULES. Nothing reads the need's words: the verdict comes from the
 * carriers the judge named and what the site really has. A carrier of a kind
 * nothing here can read (a component, a job, a connection, an API) leaves the
 * need unverifiable — the only case still hedged.
 *
 * WHAT IT DOES NOT DO: send a form, or exercise a rule. "Present" says the
 * pieces are there and wired; the facts say exactly which pieces.
 */

import { TABLE_SETTINGS, TABLE_PARTS, tableSettings, pieceSaid } from "./site-requirements.mjs";

/**
 * A TABLE'S SETTING THE PLATFORM ENFORCES BY DECLARATION (a CHECK, a row cap,
 * no overlap, unique, one per person…): declared in the schema is in force,
 * so it is checkable here. What SENDS something (a confirmation, a text, a
 * payment, another system told) is behaviour nothing here exercised.
 */
export function declaredPart(part) {
  const p = String(part || "").toLowerCase();
  return TABLE_SETTINGS.includes(p) && !TABLE_PARTS.includes(p);
}

export const VERIFY_STATES = Object.freeze(["present", "missing", "unverifiable"]);

const WRITE_HOOKS = ["useCreateRow", "useUpdateRow", "useUploadFile", "useDeleteRow"];
const READ_HOOKS = ["useRows", "useRow", "usePublicRows"];
const RPC_HOOKS = ["useRpc", "useRpcAction", "useClaimedRow"];
const hookRe = (names) => new RegExp("\\b(" + names.join("|") + ")\\s*(?:<[^>()]*>)?\\s*\\(\\s*([\"'`])([A-Za-z0-9_]{1,63})\\2", "g");

/** What one route's code does with the site's data. Comments are blanked first. */
export function pageWiring(source) {
  const src = String(source || "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const grab = (names) => {
    const out = new Set();
    for (const m of src.matchAll(hookRe(names))) out.add(m[3].toLowerCase());
    return out;
  };
  const fields = new Set();
  for (const m of src.matchAll(/\bname\s*=\s*\{?\s*["'`]([A-Za-z0-9_]{1,40})["'`]/g)) fields.add(m[1].toLowerCase());
  for (const m of src.matchAll(/\bregister\s*\(\s*["'`]([A-Za-z0-9_]{1,40})["'`]/g)) fields.add(m[1].toLowerCase());
  return { writes: grab(WRITE_HOOKS), reads: grab(READ_HOOKS), rpcs: grab(RPC_HOOKS), fields };
}

/** A judge's carrier id (`carrierId`) read back: `{kind, name, part?, column?}`, or null. */
export function readCarrier(id) {
  if (typeof id !== "string") return null;
  const m = id.match(/^([a-z]+):(.+)$/);
  if (!m) return null;
  const kind = m[1];
  let rest = m[2];
  if (kind === "page") return rest.startsWith("/") ? { kind, name: rest.replace(/\/+$/, "") || "/" } : null;
  let column = "", part = "";
  const dot = rest.match(/^([^.:]+)(?::([^.]+))?\.([A-Za-z0-9_]+)$/);
  if (dot) { rest = dot[1]; part = dot[2] || ""; column = dot[3].toLowerCase(); }
  else { const c = rest.match(/^([^:]+):(.+)$/); if (c) { rest = c[1]; part = c[2]; } }
  return { kind, name: rest.trim().toLowerCase(), ...(part ? { part } : {}), ...(column ? { column } : {}) };
}

const colName = (c) => String((c && typeof c === "object" ? c.name : c) || "").toLowerCase();
const OPS = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", ne: "≠" };

/** The rules a table declares, each as a plain fact. */
export function tableRules(t) {
  const out = [];
  for (const ch of Array.isArray(t && t.checks) ? t.checks : []) {
    if (Array.isArray(ch) && ch.length >= 3) out.push("only accepts rows where " + ch[0] + " " + (OPS[ch[1]] || ch[1]) + " " + ch[2]);
  }
  if (t && Number.isFinite(t.maxRows) && t.maxRows > 0) out.push("holds at most " + t.maxRows + " rows");
  if (t && t.noOverlap && t.noOverlap.start) out.push("refuses overlapping " + t.noOverlap.start + "–" + t.noOverlap.end + (t.noOverlap.on && t.noOverlap.on.length ? " for the same " + t.noOverlap.on.join(", ") : ""));
  const uq = t && t.unique;
  if (Array.isArray(uq) && uq.length) out.push("keeps " + uq.map((u) => (Array.isArray(u) ? u.join(" + ") : String(u))).join(", ") + " unique");
  else if (typeof uq === "string" && uq) out.push("keeps " + uq + " unique");
  if (t && t.oncePerUser) out.push("takes one row per person");
  return out;
}

/**
 * ONE NEED, CHECKED. `carriers` are the judge's ids; `site` is
 * `{ pages: Map(route → shipped code), forms: Map(route → [{fields}]),
 *    drawn: Set(route), spec, functions? }`.
 * Answers `{ state, evidence: [fact], gaps: [fact] }`.
 */
export function verifyNeed(carriers, site) {
  const list = (Array.isArray(carriers) ? carriers : []).map(readCarrier);
  if (!list.length || list.some((c) => !c)) return { state: "unverifiable", evidence: [], gaps: [] };
  const s = site && typeof site === "object" ? site : {};
  const pages = s.pages instanceof Map ? s.pages : null;
  const spec = s.spec && typeof s.spec === "object" && Array.isArray(s.spec.tables) ? s.spec : null;
  const forms = s.forms instanceof Map ? s.forms : new Map();
  const drawn = s.drawn instanceof Set ? s.drawn : null;
  const fnNames = new Set((spec && Array.isArray(spec.functions) ? spec.functions : []).map((f) => String((f && f.name) || "").toLowerCase()).filter(Boolean));
  const evidence = [], gaps = [], fixes = [];
  const submits = s.submits instanceof Map ? s.submits : new Map();
  const exercised = s.exercised instanceof Map ? s.exercised : new Map();
  let unreadable = false;
  const tables = [], pageWires = [], fns = [];
  for (const c of list) {
    if (c.kind === "page") {
      if (!pages) { unreadable = true; continue; }
      if (!pages.has(c.name)) { gaps.push("there is no " + c.name + " page"); continue; }
      const w = pageWiring(pages.get(c.name));
      pageWires.push({ route: c.name, w });
      if (drawn && !drawn.has(c.name)) unreadable = true;
    } else if (c.kind === "table") {
      if (!spec) { unreadable = true; continue; }
      const t = spec.tables.find((x) => x && String(x.name || "").toLowerCase() === c.name);
      if (!t) { gaps.push("the site has no " + c.name + " table"); continue; }
      const cols = (Array.isArray(t.columns) ? t.columns : []).map(colName).filter(Boolean);
      if (c.column && !cols.includes(c.column)) { gaps.push("the " + c.name + " table has no " + c.column + " column"); continue; }
      if (c.part && !c.column) {
        if (!declaredPart(c.part)) { unreadable = true; continue; }
        if (!tableSettings(t).includes(c.part.toLowerCase())) { gaps.push("the " + c.name + " table does not have " + pieceSaid(c.part)); continue; }
      }
      tables.push({ name: c.name, t, cols, column: c.column || "", part: c.part && !c.column ? c.part.toLowerCase() : "" });
    } else if (c.kind === "function") {
      if (!spec) { unreadable = true; continue; }
      if (!fnNames.has(c.name)) { gaps.push("the site has no " + c.name + " function"); continue; }
      fns.push(c.name);
    } else unreadable = true;
  }
  // THE JOIN: every page named beside a table must touch it, directly or
  // through a function the need also names.
  for (const p of pageWires) {
    for (const tb of tables) {
      const writes = p.w.writes.has(tb.name), reads = p.w.reads.has(tb.name);
      const viaFn = fns.some((f) => p.w.rpcs.has(f));
      if (!writes && !reads && !viaFn) {
        gaps.push(p.route + " does not read or save " + tb.name);
        // WHAT ONE MORE PAGE PASS COULD MEND (`requirement-retry.mjs`): the
        // page is there and the table is there; only the join is not.
        fixes.push({ route: p.route, table: tb.name, columns: tb.cols.slice() });
        continue;
      }
      if (writes) {
        const drawnFields = (forms.get(p.route) || []).flatMap((f) => (Array.isArray(f && f.fields) ? f.fields : []).map((x) => String((x && x.name) || "").toLowerCase()));
        const from = drawnFields.length ? drawnFields : [...p.w.fields];
        const mapped = [...new Set(from.filter((x) => tb.cols.includes(x)))];
        const formSeen = drawnFields.length > 0;
        evidence.push(p.route + (formSeen ? " shows a form" : " has code") + " that saves to " + tb.name + (mapped.length ? " (" + mapped.join(", ") + ")" : ""));
        // EXERCISED (2026-10-25): the form was filled and submitted in the
        // render check, its request read and aborted before it left the page.
        const sent = (submits.get(p.route) || []).filter((x) => x && x.table === tb.name);
        if (sent.length) {
          const f = [...new Set(sent.flatMap((x) => (Array.isArray(x.fields) ? x.fields : []).filter((c) => tb.cols.includes(c))))];
          evidence.push("filled in and submitted in a test, the form on " + p.route + " sent " + (f.length ? f.join(", ") : "a row") + " to " + tb.name + " (stopped before anything was saved)");
        }
      }
      if (reads) evidence.push(p.route + " lists the rows of " + tb.name);
      if (viaFn && !writes && !reads) evidence.push(p.route + " calls " + fns.filter((f) => p.w.rpcs.has(f)).join(", "));
    }
    if (!tables.length) {
      const fn = fns.filter((f) => p.w.rpcs.has(f));
      evidence.push(p.route + " is on the site" + (fn.length ? " and calls " + fn.join(", ") : ""));
    }
  }
  for (const tb of tables) {
    if (tb.column) evidence.push(tb.name + " has a " + tb.column + " column");
    if (tb.part) evidence.push(tb.name + " has " + pieceSaid(tb.part) + " in its schema");
    evidence.push(tb.name + " is a table the owner can edit in the Data panel");
    for (const r of tableRules(tb.t)) evidence.push(tb.name + " " + r);
    // EXERCISED (2026-10-25, `requirement-exercise.mjs`): each rule tried with
    // a write that should be refused, always rolled back. A rule the need
    // rests on that let the write through is a gap; one that refused it is a
    // fact; a database that could not be reached leaves the declared fact.
    const ex = exercised.get(tb.name);
    for (const r of ex && ex.ran && Array.isArray(ex.results) ? ex.results : []) {
      const tried = r.value !== undefined ? "a test write with " + r.column + " = " + r.value : "a test write breaking " + r.says;
      if (r.outcome === "refused") evidence.push(tried + " was refused by " + tb.name + " (rolled back, nothing kept)");
      else if (r.outcome === "accepted" || r.outcome === "pass-refused") {
        const what = r.outcome === "accepted" ? tried + " was accepted by " + tb.name + ", against its rule " + r.says : "a test write meeting " + r.says + " was refused by " + tb.name;
        if (tb.part === r.rule) gaps.push(what); else evidence.push(what + " (rolled back)");
      }
    }
  }
  for (const f of fns) if (!pageWires.some((p) => p.w.rpcs.has(f))) evidence.push("the database has the " + f + " function");
  if (gaps.length) return { state: "missing", evidence, gaps, ...(fixes.length && fixes.length === gaps.length ? { fixes } : {}) };
  // A TABLE NAMED WHOLE AND NOTHING ELSE is a list that exists, not anything a
  // visitor sees or anything that happens (the row-hedge rule, kept): with no
  // page, function, column or declared setting beside it, it stays hedged.
  if (!pageWires.length && !fns.length && !tables.some((t) => t.column || t.part)) return { state: "unverifiable", evidence, gaps };
  // A FUNCTION IS BEHAVIOUR: being in the database says nothing of what it
  // does or who may call it. It counts only where a page named beside it calls
  // it — the wiring is what is checked; otherwise the need stays hedged, with
  // the function's presence kept as evidence.
  if (fns.some((f) => !pageWires.some((p) => p.w.rpcs.has(f)))) return { state: "unverifiable", evidence, gaps };
  if (unreadable) return { state: "unverifiable", evidence, gaps };
  return { state: "present", evidence, gaps };
}

/** The forms the render check drew, by route (`report.forms`). */
export function renderedForms(report) {
  const out = new Map();
  for (const f of report && Array.isArray(report.forms) ? report.forms : []) {
    if (f && typeof f.route === "string" && Array.isArray(f.forms)) out.set(f.route, f.forms);
  }
  return out;
}

/** The forms of the build that is published: the repair's report when it recompiled. */
export function publishedForms(built, repair) {
  if (repair && repair.built) return renderedForms(repair.built.render);
  return renderedForms(built && built.render);
}

/** What each form sent when filled and submitted in the render check, by route (`report.submits`). */
export function renderedSubmits(report) {
  const out = new Map();
  for (const x of report && Array.isArray(report.submits) ? report.submits : []) {
    if (!x || typeof x.route !== "string") continue;
    if (!out.has(x.route)) out.set(x.route, []);
    out.get(x.route).push({ ...(x.table ? { table: String(x.table) } : {}), ...(x.rpc ? { rpc: String(x.rpc) } : {}), fields: Array.isArray(x.fields) ? x.fields.map(String) : [] });
  }
  return out;
}

/**
 * Each route's shipped code, every file placed on it certainly joined
 * (`routedSources`' `routes`).
 */
export function routeCode(routed) {
  const out = new Map();
  for (const f of Array.isArray(routed) ? routed : []) {
    for (const r of Array.isArray(f && f.routes) ? f.routes : []) {
      if (typeof r !== "string" || !r) continue;
      out.set(r, (out.has(r) ? out.get(r) + "\n" : "") + String((f && f.source) || ""));
    }
  }
  return out;
}

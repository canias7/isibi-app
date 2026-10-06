// ── THE FORM AN ADDITION MADE, SENT ONCE BY A VISITOR, AND THE ROW IT LEFT ───
//
// The owner, preparing the release after the failure-reporting fix
// (2026-10-06): *"…one combined Edit/Add-on live verification with the exact
// request, expected results and estimated credit cost … Include checking the
// resulting pages and submitting any form created by that test."*
//
// The request batch's own checks judge the new page and its table
// (`requestBatchVerdict`). This module decides the rest: what the page's one
// form is filled with, whether the one request it sends may leave the
// browser, and whether the new table then holds exactly that one row, read
// back by the owner's own route — what the database holds.
//
// NOTHING IS GUESSED, the rules test's booking rule (`bookingGate`) carried
// over to a form nobody wrote in advance:
//   - a field this check cannot fill truthfully (a choice, a date, a number, a
//     file, a phone number) refuses the submission before anything is
//     pressed, and says which;
//   - EACH FIELD IS BOUND TO ITS COLUMN before anything is pressed
//     (`fieldBindings`), from the form's own fields and the new table's
//     columns: a field whose name, id or label is one column's name, or, for
//     the name and the address only, the table's one column for it. Where that
//     cannot be established, nothing is pressed and the check says it is a
//     limitation of the check, never a pass;
//   - the request is decided BEFORE it leaves: the first one, to the new
//     table's own data route, no query string, no credential, and a body
//     holding each entry under its own column and nothing else. Anything else
//     is stopped in the browser and recorded, never rewritten to pass;
//   - the stored row is judged by the same bindings: each entry in its own
//     column, and in no other;
//   - the marker's address is at example.com, a domain reserved for examples,
//     so no mail can reach anybody.
//
// Codex, reviewing this at `fb42ff16`: the gate and the row check asked only
// whether the marker's values were somewhere in the body or the row, so a body
// or row with the name and the address swapped passed, and so did one with
// both empty and the values in unrelated `note` and `source` keys.
//
// Pure and dependency-free: the canary hands in what the page and the routes
// answered, so every decision here is driven by tests with no site.

/** The one entry this check sends, marked so it can be told apart from anybody's. */
export function formMarker(run) {
  const id = String(run == null ? "" : run).replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "local";
  return Object.freeze({
    name: "Canary release " + id,
    email: "canary-release-" + id.toLowerCase() + "@example.com",
    text: "Canary release check " + id,
  });
}

/** The site's own data route for one table: where its forms send a visitor's entry. */
export const formDataPath = (slug, table) => `/api/db/${encodeURIComponent(String(slug || ""))}/data/${encodeURIComponent(String(table || ""))}`;

/**
 * THE ONE TABLE THE ADDITION MADE, from the owner's listing before and after
 * (`tablesOf`): exactly one new name, or a refusal saying why — never the first
 * of several, and never a table the site already had.
 */
export function addedTable(before, after) {
  if (!before || before.ok !== true) return { ok: false, why: `the table listing before: ${(before && before.why) || "not read"}` };
  if (!after || after.ok !== true) return { ok: false, why: `the table listing after: ${(after && after.why) || "not read"}` };
  const had = new Set(before.names || []);
  const added = (after.names || []).filter((n) => !had.has(n));
  if (added.length !== 1) return { ok: false, why: added.length ? `${added.length} new tables (${added.join(", ")}), not one` : "no new table" };
  const t = after.tables[added[0]] || {};
  return { ok: true, table: added[0], columns: Array.isArray(t.columns) ? t.columns.slice() : [], rows: t.rows };
}

const TEXTISH = new Set(["", "text", "search"]);
const SKIP = new Set(["hidden", "submit", "button", "reset", "image"]);
const cssIdent = (s) => String(s).replace(/(["\\])/g, "\\$1");

/**
 * WHAT THE FORM IS FILLED WITH, field by field, or a refusal before anything
 * is pressed. `fields` is the page's own reading (`formFieldsInPage`): each
 * `{ tag, type, name, id, label, required, visible, disabled }`.
 *
 * An email field gets the marker's address; a text field that says it is a
 * name gets the marker's name; a required text area or other required text
 * field gets the marker's sentence; a required checkbox is ticked. Optional
 * fields are left as they are. A required field of any other kind is a
 * refusal naming it, and so is a form with no email field, or none for a name,
 * or a field with neither a name nor an id (it cannot be filled exactly).
 * Each fill carries its role (`email`, `name`, `text`, `check`), which
 * `fieldBindings` reads.
 */
export function fieldPlan(fields, marker) {
  const list = (Array.isArray(fields) ? fields : []).filter((f) => f && typeof f === "object" && f.visible === true && f.disabled !== true);
  const fills = [];
  let emails = 0, names = 0;
  for (const f of list) {
    const tag = String(f.tag || "").toLowerCase();
    const type = String(f.type || "").toLowerCase();
    if (tag === "input" && SKIP.has(type)) continue;
    const what = [f.name, f.id, f.label].map((x) => String(x || "")).join(" ");
    const selector = f.name ? `[name="${cssIdent(f.name)}"]` : f.id ? `[id="${cssIdent(f.id)}"]` : "";
    const describe = String(f.label || f.name || f.id || tag).slice(0, 60);
    let fill = null;
    if (tag === "input" && type === "email") { fill = { kind: "fill", role: "email", value: marker.email }; emails++; }
    else if (tag === "input" && TEXTISH.has(type) && /name/i.test(what)) { fill = { kind: "fill", role: "name", value: marker.name }; names++; }
    else if ((tag === "textarea" || (tag === "input" && TEXTISH.has(type))) && f.required === true) fill = { kind: "fill", role: "text", value: marker.text };
    else if (tag === "input" && type === "checkbox" && f.required === true) fill = { kind: "check", role: "check" };
    else if (f.required === true) return { ok: false, fills: [], why: `the form asks for "${describe}" (${tag}${type ? " " + type : ""}), which this check does not fill — nothing was pressed` };
    if (!fill) continue;
    if (!selector) return { ok: false, fills: [], why: `the field "${describe}" has neither a name nor an id, so it cannot be filled exactly — nothing was pressed` };
    fills.push({ selector, ...fill, field: { tag, type, name: String(f.name || ""), id: String(f.id || ""), label: String(f.label || "") } });
  }
  if (emails !== 1) return { ok: false, fills: [], why: emails ? `the form has ${emails} email fields, not one — nothing was pressed` : "the form has no email field — nothing was pressed" };
  if (names < 1) return { ok: false, fills: [], why: "the form has no field for a name — nothing was pressed" };
  return { ok: true, fills, why: "" };
}

const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
const emailColumn = (c) => norm(c).includes("email");
const nameColumn = (c) => norm(c).includes("name");
const WHAT = { email: "email address", name: "name" };

/**
 * WHICH COLUMN EACH FILLED FIELD'S ENTRY BELONGS IN, from the form's own
 * fields (the plan) and the new table's columns (the owner's listing: its
 * declared, writable columns), decided before anything is pressed:
 *   1. a field whose name, id or label is one column's name, case and
 *      punctuation aside (`email_address` is `emailAddress` is "Email
 *      address"), is bound to that column; a field naming two columns binds
 *      to neither;
 *   2. otherwise, the name and the address only: the table's ONE column for
 *      it (one column with "email" in its name; one with "name"). A sentence
 *      or a box has no such reading.
 * Then: the address field never bound to a name column, the name field never
 * to an email column, and no column bound twice. ANYTHING ELSE IS NOT
 * ESTABLISHED: `ok` is false and `why` says what could not be told, a
 * limitation of this check that is reported as one and never passes.
 * Nothing here knows a site, and no column is expected to be called `name`
 * or `email`.
 */
export function fieldBindings(plan, columns) {
  const no = (why) => ({ ok: false, bindings: [], why });
  const fills = plan && plan.ok === true && Array.isArray(plan.fills) ? plan.fills : [];
  if (!fills.length) return no("there is no filled form to bind");
  const cols = (Array.isArray(columns) ? columns : []).filter((c) => typeof c === "string" && c !== "");
  if (!cols.length) return no("the new table's columns were not read, so no entry can be placed in one");
  const listed = cols.join(", ");
  const bindings = [];
  for (const f of fills) {
    const fd = f && f.field && typeof f.field === "object" ? f.field : {};
    const label = String(fd.label || fd.name || fd.id || fd.tag || "a field").slice(0, 60);
    const named = new Set();
    const via = [];
    for (const [key, v] of [["name", fd.name], ["id", fd.id], ["label", fd.label]]) {
      const n = norm(v);
      if (!n) continue;
      const hit = cols.filter((c) => norm(c) === n);
      if (hit.length > 1) return no(`the field "${label}" matches ${hit.length} columns (${hit.join(", ")})`);
      if (hit.length === 1) { named.add(hit[0]); via.push(key); }
    }
    if (named.size > 1) return no(`the field "${label}" names two different columns (${[...named].join(", ")})`);
    let column = named.size === 1 ? [...named][0] : "";
    let by = column ? `its ${via.join(" and ")}` : "";
    if (!column && (f.role === "email" || f.role === "name")) {
      const fit = cols.filter(f.role === "email" ? emailColumn : nameColumn);
      if (fit.length !== 1) {
        return no(fit.length
          ? `the field "${label}" names no column, and ${fit.length} columns could hold the ${WHAT[f.role]} (${fit.join(", ")})`
          : `the field "${label}" names no column, and no column of the table is for the ${WHAT[f.role]} (${listed})`);
      }
      column = fit[0];
      by = `the table's one ${f.role} column`;
    }
    if (!column) return no(`the field "${label}" names no column of the table (${listed}), so where its entry goes cannot be told`);
    if (f.role === "email" && nameColumn(column)) return no(`the email field "${label}" is named after the column "${column}", which is for a name`);
    if (f.role === "name" && emailColumn(column)) return no(`the name field "${label}" is named after the column "${column}", which is for an email address`);
    if (bindings.some((b) => b.column === column)) return no(`two fields are bound to the column "${column}"`);
    bindings.push({ column, role: String(f.role || ""), kind: f.kind === "check" ? "check" : "fill", value: f.kind === "check" ? true : f.value, label, by });
  }
  return { ok: true, bindings, why: "" };
}

/** The bindings, when they were established; null otherwise. */
const boundOf = (binding) => (binding && binding.ok === true && Array.isArray(binding.bindings) && binding.bindings.length ? binding.bindings : null);

/** What a value is, said against the entries: which field's, a value the check did not enter, empty, or absent. */
function sayer(bound) {
  const entered = new Map();
  for (const b of bound) if (b.kind === "fill" && !entered.has(b.value)) entered.set(b.value, b);
  const say = (v) => (v === undefined ? "nothing"
    : v === null || v === "" ? "an empty value"
      : typeof v === "string" && entered.has(v) ? `the value entered in "${entered.get(v).label}"`
        : typeof v === "string" && entered.has(v.trim()) ? `the value entered in "${entered.get(v.trim()).label}", with spaces around it`
          : typeof v === "string" ? "a value the check did not enter"
            : JSON.stringify(v).slice(0, 40));
  return { entered, say };
}

/**
 * WHETHER THE FORM'S REQUEST MAY LEAVE THE BROWSER, decided before it does:
 * the first one (`n`), with no query string, no credential (a visitor has
 * none) and no `prefer`, its body a JSON object holding each entry under the
 * column its field is bound to (`binding`, from `fieldBindings`): the value
 * typed into that field, or `true` for a box this check ticked. No entry may
 * appear under any other key, and nothing else may be sent but empty values.
 * Without established bindings nothing leaves, and the reason says so.
 * Checked afterwards, a wrong payload would already have reached the database.
 */
export function formGate({ n, raw, search, headers, marker, binding } = {}) {
  const fail = (why) => ({ ok: false, why });
  if (n !== 1) return fail("a second request from the form is stopped — the check sends exactly one");
  if (search) return fail("a request with a query string is not the form's plain send");
  const h = headers && typeof headers === "object" ? headers : {};
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [String(k).toLowerCase(), v]));
  if (lower.authorization) return fail("the request carries a credential, which a visitor's send never does");
  if (lower.prefer) return fail("the request carries a prefer header, which the site's own send does not");
  const bound = boundOf(binding);
  if (!bound) return fail(`which key each entry belongs under was not established (${(binding && binding.why) || "no bindings"}) — a limitation of this check, so the request is not sent`);
  const mk = marker && typeof marker === "object" ? marker : {};
  if (!bound.some((b) => b.role === "email" && b.value === mk.email) || !bound.some((b) => b.role === "name" && b.value === mk.name)) {
    return fail("the bindings do not carry the marker's name and email address — a limitation of this check, so the request is not sent");
  }
  let body;
  try { body = JSON.parse(String(raw == null ? "" : raw)); } catch { return fail("the body is not JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("the body is not one object");
  const { entered, say } = sayer(bound);
  for (const b of bound) {
    const v = Object.hasOwn(body, b.column) ? body[b.column] : undefined;
    if (b.kind === "check" ? v !== true : v !== b.value) {
      return fail(`"${b.column}" should carry ${b.kind === "check" ? "the box ticked in" : "the value entered in"} "${b.label}", and carries ${say(v)}`);
    }
  }
  const keys = new Set(bound.map((b) => b.column));
  for (const [k, v] of Object.entries(body)) {
    if (keys.has(k) || v === null || v === undefined || v === "" || v === false) continue;
    if (v === true) return fail(`"${k}" ticks a box the check did not tick`);
    if (typeof v !== "string") return fail(`"${k}" carries ${JSON.stringify(v).slice(0, 40)}, which the check did not enter`);
    if (entered.has(v.trim())) return fail(`"${k}" carries the value entered in "${entered.get(v.trim()).label}", which belongs under "${entered.get(v.trim()).column}"`);
    return fail(`"${k}" carries a value the check did not enter`);
  }
  return { ok: true, why: "" };
}

/** Each entry in its own column of the stored row, and in no other. */
function placed(row, bound) {
  if (!row || typeof row !== "object") return { ok: false, why: "no row" };
  const { entered, say } = sayer(bound);
  for (const b of bound) {
    const v = Object.hasOwn(row, b.column) ? row[b.column] : undefined;
    if (!(b.kind === "check" ? v === true : typeof v === "string" && v.trim() === b.value)) {
      return { ok: false, why: `"${b.column}" holds ${say(v)}, not ${b.kind === "check" ? "the box ticked in" : "the value entered in"} "${b.label}"` };
    }
  }
  const keys = new Set(bound.map((b) => b.column));
  for (const [k, v] of Object.entries(row)) {
    if (!keys.has(k) && typeof v === "string" && entered.has(v.trim())) {
      return { ok: false, why: `"${k}" also holds the value entered in "${entered.get(v.trim()).label}", which belongs in "${entered.get(v.trim()).column}"` };
    }
  }
  return { ok: true, why: "" };
}

/**
 * THE FORM STEP'S CHECKS, each by what happened: the page's one form filled
 * as planned; which column each entry belongs in established (a limitation of
 * the check when it is not, reported as one, never a pass); exactly one
 * request sent, to the new table's own route; the site taking it; the new
 * table empty before and holding exactly that one row after, read by the
 * owner's route, each entry in the column its field is bound to and in no
 * other. `submitted` is `submitFormInPage`'s record, with its `binding`;
 * `before` and `after` are `readRowList` readings of the owner route.
 */
export function formVerdict({ submitted, before, after, marker, table } = {}) {
  const checks = [];
  const add = (name, ok, why) => checks.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const s = submitted && typeof submitted === "object" ? submitted : {};
  const posts = Array.isArray(s.posts) ? s.posts : [];
  const status = s.response && Number.isSafeInteger(s.response.status) ? s.response.status : 0;
  const binding = s.binding && typeof s.binding === "object" ? s.binding : null;
  const bound = boundOf(binding);
  add("the new page has one form this check can fill — a name and an email address", !!(s.plan && s.plan.ok && s.filledOk === true), s.why || (s.plan && s.plan.why) || "the form was not filled");
  add(`which column of ${table || "the new table"} each entry belongs in was established from the form's fields and the table's columns`,
    !!bound, !(s.plan && s.plan.ok) ? "not reached: the form was not filled"
      : `a limitation of this check, not a pass: ${(binding && binding.why) || "no bindings were made"}`);
  add(`the form sent exactly one request, to ${table || "the new table"}'s own data route, and it left the browser`,
    posts.length === 1 && posts[0].sent === true, posts.length ? (posts[0].stopped || `${posts.length} requests`) : (s.why || "no request was made"));
  add("the site took it", status >= 200 && status < 300, status ? `HTTP ${status}${s.response && s.response.text ? ": " + String(s.response.text).slice(0, 160) : ""}` : (s.failed || "no answer was read"));
  const b = before && before.ok === true ? before.rows : null;
  const a = after && after.ok === true ? after.rows : null;
  add(`the new table held no row before the form was sent`, Array.isArray(b) && b.length === 0, b ? `it held ${b.length}` : `the owner's read: ${(before && before.why) || "not read"}`);
  const fresh = Array.isArray(a) && Array.isArray(b) ? a.filter((r) => !b.some((x) => x && r && x.id === r.id)) : [];
  const one = Array.isArray(a) && Array.isArray(b) && a.length === b.length + 1 && fresh.length === 1;
  const where = bound && one ? placed(fresh[0], bound) : null;
  add(`the new table now holds exactly that one row, each entry in the column its field is bound to and in no other${bound ? " (" + bound.map((x) => `${x.label} → ${x.column}`).join("; ") + ")" : ""}`,
    one && !!where && where.ok,
    !a ? `the owner's read: ${(after && after.why) || "not read"}`
      : `${a.length} rows; ${fresh.length} new${!bound ? "; not checked: which column holds which entry was not established" : where && !where.ok ? "; " + where.why : ""}`);
  return { ok: checks.every((c) => c.ok), checks, row: fresh.length === 1 ? fresh[0] : null };
}

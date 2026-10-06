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
//   - the request is decided BEFORE it leaves: the first one, to the new
//     table's own data route, no query string, no credential, and a body
//     holding exactly the marker's values. Anything else is stopped in the
//     browser and recorded, never rewritten to pass;
//   - the marker's address is at example.com, a domain reserved for examples,
//     so no mail can reach anybody.
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
    if (tag === "input" && type === "email") { fill = { kind: "fill", value: marker.email }; emails++; }
    else if (tag === "input" && TEXTISH.has(type) && /name/i.test(what)) { fill = { kind: "fill", value: marker.name }; names++; }
    else if ((tag === "textarea" || (tag === "input" && TEXTISH.has(type))) && f.required === true) fill = { kind: "fill", value: marker.text };
    else if (tag === "input" && type === "checkbox" && f.required === true) fill = { kind: "check" };
    else if (f.required === true) return { ok: false, fills: [], why: `the form asks for "${describe}" (${tag}${type ? " " + type : ""}), which this check does not fill — nothing was pressed` };
    if (!fill) continue;
    if (!selector) return { ok: false, fills: [], why: `the field "${describe}" has neither a name nor an id, so it cannot be filled exactly — nothing was pressed` };
    fills.push({ selector, ...fill, field: { tag, type, name: String(f.name || ""), id: String(f.id || ""), label: String(f.label || "") } });
  }
  if (emails !== 1) return { ok: false, fills: [], why: emails ? `the form has ${emails} email fields, not one — nothing was pressed` : "the form has no email field — nothing was pressed" };
  if (names < 1) return { ok: false, fills: [], why: "the form has no field for a name — nothing was pressed" };
  return { ok: true, fills, why: "" };
}

/**
 * WHETHER THE FORM'S REQUEST MAY LEAVE THE BROWSER, decided before it does:
 * the first one (`n`), with no query string, no credential (a visitor has
 * none) and no `prefer`, its body a JSON object whose every non-empty value is
 * one the plan filled — the marker's name and address each among them, and a
 * ticked box only where the plan ticked one. Checked afterwards, a wrong
 * payload would already have reached the database.
 */
export function formGate({ n, raw, search, headers, marker, plan } = {}) {
  const fail = (why) => ({ ok: false, why });
  if (n !== 1) return fail("a second request from the form is stopped — the check sends exactly one");
  if (search) return fail("a request with a query string is not the form's plain send");
  const h = headers && typeof headers === "object" ? headers : {};
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [String(k).toLowerCase(), v]));
  if (lower.authorization) return fail("the request carries a credential, which a visitor's send never does");
  if (lower.prefer) return fail("the request carries a prefer header, which the site's own send does not");
  let body;
  try { body = JSON.parse(String(raw == null ? "" : raw)); } catch { return fail("the body is not JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("the body is not one object");
  const fills = plan && Array.isArray(plan.fills) ? plan.fills : [];
  const texts = new Set(fills.filter((f) => f.kind === "fill").map((f) => f.value));
  const ticks = fills.filter((f) => f.kind === "check").length;
  let ticked = 0;
  const values = [];
  for (const [k, v] of Object.entries(body)) {
    if (v === null || v === undefined || v === "" || v === false) continue;
    if (v === true) { ticked++; continue; }
    if (typeof v !== "string") return fail(`"${k}" carries ${JSON.stringify(v).slice(0, 40)}, which the check did not enter`);
    if (!texts.has(v)) return fail(`"${k}" carries a value the check did not enter`);
    values.push(v);
  }
  if (ticked > ticks) return fail("the body ticks a box the check did not tick");
  if (!values.includes(marker.email)) return fail("the body does not carry the marker's email address");
  if (!values.includes(marker.name)) return fail("the body does not carry the marker's name");
  return { ok: true, why: "" };
}

const has = (row, value) => !!row && typeof row === "object" && Object.values(row).some((v) => typeof v === "string" && v.trim() === value);

/**
 * THE FORM STEP'S CHECKS, each by what happened: the page's one form filled
 * as planned; exactly one request sent, to the new table's own route; the
 * site taking it; the new table empty before and holding exactly that one
 * row after, read by the owner's route with the marker's name and address in
 * it. `submitted` is `submitFormInPage`'s record; `before` and `after` are
 * `readRowList` readings of the owner route.
 */
export function formVerdict({ submitted, before, after, marker, table } = {}) {
  const checks = [];
  const add = (name, ok, why) => checks.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const s = submitted && typeof submitted === "object" ? submitted : {};
  const posts = Array.isArray(s.posts) ? s.posts : [];
  const status = s.response && Number.isSafeInteger(s.response.status) ? s.response.status : 0;
  add("the new page has one form this check can fill — a name and an email address", !!(s.plan && s.plan.ok && s.filledOk === true), s.why || (s.plan && s.plan.why) || "the form was not filled");
  add(`the form sent exactly one request, to ${table || "the new table"}'s own data route, and it left the browser`,
    posts.length === 1 && posts[0].sent === true, posts.length ? (posts[0].stopped || `${posts.length} requests`) : (s.why || "no request was made"));
  add("the site took it", status >= 200 && status < 300, status ? `HTTP ${status}${s.response && s.response.text ? ": " + String(s.response.text).slice(0, 160) : ""}` : (s.failed || "no answer was read"));
  const b = before && before.ok === true ? before.rows : null;
  const a = after && after.ok === true ? after.rows : null;
  add(`the new table held no row before the form was sent`, Array.isArray(b) && b.length === 0, b ? `it held ${b.length}` : `the owner's read: ${(before && before.why) || "not read"}`);
  const fresh = Array.isArray(a) && Array.isArray(b) ? a.filter((r) => !b.some((x) => x && r && x.id === r.id)) : [];
  add(`the new table now holds exactly that one row, with the marker's name and email address`,
    Array.isArray(a) && Array.isArray(b) && a.length === b.length + 1 && fresh.length === 1 && has(fresh[0], marker.name) && has(fresh[0], marker.email),
    !a ? `the owner's read: ${(after && after.why) || "not read"}` : `${a.length} rows; ${fresh.length} new${fresh.length === 1 && !(has(fresh[0], marker.name) && has(fresh[0], marker.email)) ? ", without the marker's values" : ""}`);
  return { ok: checks.every((c) => c.ok), checks, row: fresh.length === 1 ? fresh[0] : null };
}

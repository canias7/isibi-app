// ─────────────────────────────────────────────────────────────────────────────
// THE RELEASE CHECK'S FORM STEP (2026-10-06)
//
// The owner, preparing the release after the failure-reporting fix: *"…one
// combined Edit/Add-on live verification with the exact request, expected
// results and estimated credit cost against the last recorded balance of 21.
// Include checking the resulting pages and submitting any form created by that
// test."*
//
// The request batch's checks already judge the new page and its table. These
// cases drive what the form step adds: what the page's one form is filled
// with (`fieldPlan`), whether its request may leave the browser (`formGate`),
// whether the table then holds exactly that row (`formVerdict`), the helper
// itself in a real Chromium against a page served here (`submitFormInPage`),
// and the wiring that keeps it inside the paid press and behind its gates.
//
// After Codex's review at `fb42ff16` (the gate and the row check passed the
// name and the address swapped, and both empty with the values in `note` and
// `source`): each entry is judged under the column its field is bound to
// (`fieldBindings`, from the form's fields and the table's columns), and a
// binding that cannot be established is a limitation, never a pass (BIND 1–3,
// FORM 8).
// ─────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { formMarker, formDataPath, addedTable, fieldPlan, fieldBindings, formGate, formVerdict } from "../scripts/canary-form.mjs";
import { submitFormInPage, UI_SCENARIOS, fundsRefusal, budgetRefusal } from "../scripts/canary-ui.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";

const M = formMarker("4242");
const field = (o) => ({ tag: "input", type: "", name: "", id: "", label: "", required: false, visible: true, disabled: false, ...o });
const NAME = field({ name: "name", label: "Your name", required: true });
const EMAIL = field({ type: "email", name: "email", label: "Email", required: true });
const okRows = (rows) => ({ ok: true, rows });

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE DECISIONS
// ─────────────────────────────────────────────────────────────────────────────

test("FORM 1 — the marker is one recognisable entry at a reserved address; the data route is the site's own", () => {
  assert.deepEqual({ ...M }, { name: "Canary release 4242", email: "canary-release-4242@example.com", text: "Canary release check 4242" });
  assert.equal(formMarker(null).email, "canary-release-local@example.com");
  assert.equal(formMarker("a b/c;9").name, "Canary release abc9", "junk in the run id reached the marker");
  assert.ok(Object.isFrozen(M));
  assert.equal(formDataPath("fold-lane-bakery", "tasting_waitlist"), "/api/db/fold-lane-bakery/data/tasting_waitlist");
});

test("FORM 2 — the one table the addition made: exactly one new name, never the first of several, never a listing that did not read", () => {
  const list = (names, extra = {}) => ({ ok: true, names, tables: Object.fromEntries(names.map((n) => [n, { columns: ["id", "name", "email"], rows: 0, ...extra }])) });
  const before = list(["bake_list", "loaves", "orders"]);
  assert.deepEqual(addedTable(before, list(["bake_list", "loaves", "orders", "tasting_waitlist"])), { ok: true, table: "tasting_waitlist", columns: ["id", "name", "email"], rows: 0 });
  assert.match(addedTable(before, before).why, /no new table/);
  assert.match(addedTable(before, list(["bake_list", "loaves", "orders", "a", "b"])).why, /2 new tables \(a, b\), not one/);
  assert.match(addedTable({ ok: false, why: "status 500" }, before).why, /before: status 500/);
  assert.match(addedTable(before, null).why, /after: not read/);
});

test("FORM 3 — what the form is filled with: the address and the name always, a required sentence or box when asked; a field it cannot fill truthfully refuses before anything is pressed", () => {
  const plan = fieldPlan([NAME, EMAIL], M);
  assert.deepEqual(plan.fills.map((f) => [f.selector, f.kind, f.value]), [['[name="name"]', "fill", M.name], ['[name="email"]', "fill", M.email]]);
  assert.equal(plan.ok, true);
  // OPTIONAL FIELDS ARE LEFT AS THEY ARE; REQUIRED ONES GET THE MARKER'S SENTENCE OR A TICK.
  const more = fieldPlan([NAME, EMAIL, field({ tag: "textarea", name: "note" }), field({ tag: "textarea", name: "message", required: true }), field({ type: "checkbox", name: "consent", required: true }), field({ type: "checkbox", name: "news" })], M);
  assert.deepEqual(more.fills.map((f) => [f.field.name, f.kind, f.value]), [["name", "fill", M.name], ["email", "fill", M.email], ["message", "fill", M.text], ["consent", "check", undefined]]);
  // NOTHING A VISITOR CANNOT SEE OR USE, AND NOTHING THAT IS NOT A FIELD.
  const ignored = fieldPlan([NAME, EMAIL, field({ type: "hidden", name: "source" }), field({ type: "submit" }), field({ name: "trap", required: true, visible: false }), field({ name: "locked", required: true, disabled: true })], M);
  assert.equal(ignored.fills.length, 2);
  // REFUSALS, EACH NAMING WHY, WITH NOTHING PRESSED.
  const refused = (fields, re) => { const p = fieldPlan(fields, M); assert.equal(p.ok, false); assert.deepEqual(p.fills, []); assert.match(p.why, re); assert.match(p.why, /nothing was pressed/); };
  refused([NAME, EMAIL, field({ tag: "select", name: "evening", label: "Which evening", required: true })], /asks for "Which evening" \(select\)/);
  refused([NAME, EMAIL, field({ type: "tel", name: "phone", label: "Phone", required: true })], /asks for "Phone" \(input tel\)/);
  refused([NAME, EMAIL, field({ type: "date", name: "when", required: true })], /input date/);
  refused([NAME], /no email field/);
  refused([NAME, EMAIL, field({ type: "email", name: "email2" })], /2 email fields, not one/);
  refused([EMAIL], /no field for a name/);
  refused([field({ label: "Your name", required: true }), EMAIL], /neither a name nor an id/);
  // AN ID SERVES WHERE THERE IS NO NAME, EXACTLY.
  assert.equal(fieldPlan([field({ id: "full-name", label: "Full name" }), EMAIL], M).fills[0].selector, '[id="full-name"]');
});

test("FORM 4 — whether the request may leave: the first one, no query, no credential, no prefer, and each entry under its own column with nothing else", () => {
  const plan = fieldPlan([NAME, EMAIL, field({ type: "checkbox", name: "consent", required: true })], M);
  const binding = fieldBindings(plan, ["name", "email", "consent"]);
  assert.equal(binding.ok, true, binding.why);
  const gate = (o) => formGate({ n: 1, raw: JSON.stringify({ name: M.name, email: M.email, consent: true }), search: "", headers: { "content-type": "application/json", "Idempotency-Key": "k" }, marker: M, binding, ...o });
  assert.deepEqual(gate({}), { ok: true, why: "" });
  // EMPTY, NULL AND FALSE ENTRIES ARE NOT VALUES.
  assert.equal(gate({ raw: JSON.stringify({ name: M.name, email: M.email, consent: true, note: "", extra: null, news: false }) }).ok, true);
  const stopped = (o, re) => { const g = gate(o); assert.equal(g.ok, false, JSON.stringify(o)); assert.match(g.why, re); };
  stopped({ n: 2 }, /second request/);
  stopped({ search: "?select=*" }, /query string/);
  stopped({ headers: { Authorization: "Bearer x" } }, /credential/);
  stopped({ headers: { prefer: "return=representation" } }, /prefer/);
  stopped({ raw: "name=x" }, /not JSON/);
  stopped({ raw: "[]" }, /not one object/);
  stopped({ raw: JSON.stringify({ name: M.name, email: M.email, consent: true, source: "homepage" }) }, /"source" carries a value the check did not enter/);
  stopped({ raw: JSON.stringify({ name: M.name, email: M.email, consent: true, guests: 2 }) }, /"guests" carries 2/);
  stopped({ raw: JSON.stringify({ name: M.name, consent: true }) }, /"email" should carry the value entered in "Email", and carries nothing/);
  stopped({ raw: JSON.stringify({ email: M.email, consent: true }) }, /"name" should carry the value entered in "Your name", and carries nothing/);
  stopped({ raw: JSON.stringify({ name: M.name, email: M.email }) }, /"consent" should carry the box ticked in "consent", and carries nothing/);
  stopped({ raw: JSON.stringify({ name: M.name, email: M.email, consent: true, news: true }) }, /ticks a box the check did not tick/);
  // WITHOUT ESTABLISHED BINDINGS NOTHING LEAVES, WHATEVER THE BODY.
  stopped({ binding: undefined }, /was not established \(no bindings\) — a limitation of this check, so the request is not sent/);
  stopped({ binding: { ok: false, bindings: [], why: "two columns could hold the name" } }, /\(two columns could hold the name\) — a limitation of this check/);
  stopped({ binding: fieldBindings(fieldPlan([NAME, EMAIL], formMarker("other")), ["name", "email"]) }, /do not carry the marker's name and email address/);
});

test("FORM 5 — the form step's checks, each by what happened: one form filled, its entries' columns established, one request sent, the site taking it, an empty table and then exactly that row", () => {
  const plan = fieldPlan([NAME, EMAIL], M);
  const sent = { plan, binding: fieldBindings(plan, ["name", "email"]), filledOk: true, posts: [{ sent: true }], response: { status: 201, text: "" } };
  const row = { id: 1, name: M.name, email: M.email, created_at: "2026-10-06T12:00:00Z" };
  const v = formVerdict({ submitted: sent, before: okRows([]), after: okRows([row]), marker: M, table: "tasting_waitlist" });
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.deepEqual(v.row, row);
  assert.equal(v.checks.length, 6);
  const failing = (o, name) => { const x = formVerdict({ submitted: sent, before: okRows([]), after: okRows([row]), marker: M, table: "tasting_waitlist", ...o }); assert.equal(x.ok, false); const bad = x.checks.filter((c) => !c.ok).map((c) => c.name); assert.ok(bad.some((n) => n.includes(name)), JSON.stringify(bad)); return x; };
  failing({ submitted: { ...sent, plan: { ok: false, why: "no email field" }, why: "the form has no email field — nothing was pressed" } }, "one form this check can fill");
  failing({ submitted: { ...sent, binding: { ok: false, bindings: [], why: "no column of the table is for the email address" } } }, "each entry belongs in");
  failing({ submitted: { ...sent, posts: [] } }, "exactly one request");
  failing({ submitted: { ...sent, posts: [{ sent: false, stopped: "a credential" }] } }, "exactly one request");
  failing({ submitted: { ...sent, response: { status: 403, text: "That isn't available." } } }, "the site took it");
  failing({ before: okRows([{ id: 9, name: "Someone", email: "s@x.test" }]), after: okRows([{ id: 9, name: "Someone", email: "s@x.test" }, row]) }, "held no row before");
  failing({ after: okRows([row, { ...row, id: 2 }]) }, "exactly that one row");
  // One more row than before, but a row went and two came: not "exactly that one row".
  failing({ before: okRows([{ id: 9, name: "Someone", email: "s@x.test" }]), after: okRows([row, { id: 2, name: "Another", email: "a@x.test" }]) }, "exactly that one row");
  failing({ after: okRows([{ ...row, email: "other@example.com" }]) }, "exactly that one row");
  failing({ after: { ok: false, why: "status 500" } }, "exactly that one row");
  assert.equal(formVerdict({}).ok, false, "an empty record passed");
  // A FORM THAT COULD NOT BE FILLED NEVER REACHED THE BINDING: said so, not called a limitation.
  const unfilled = formVerdict({ submitted: { plan: { ok: false, why: "no email field" }, why: "the form has no email field — nothing was pressed" }, before: okRows([]), after: okRows([]), marker: M, table: "t" });
  assert.equal(unfilled.checks.find((c) => c.name.includes("each entry belongs in")).why, "not reached: the form was not filled");
});

// ─────────────────────────────────────────────────────────────────────────────
// 1b. EACH ENTRY WHERE IT BELONGS (after Codex's review at fb42ff16)
// ─────────────────────────────────────────────────────────────────────────────

/** Three forms and their tables: the ordinary one, renamed columns its fields name, and renamed columns they do not. */
const ORDINARY = [[NAME, EMAIL], ["name", "email"]];
const RENAMED = [[field({ name: "full_name", label: "Full name", required: true }), field({ type: "email", name: "email_address", label: "Email address", required: true })], ["full_name", "email_address", "note", "source"]];
const BY_ROLE = [[field({ id: "f1", label: "Your name", required: true }), field({ type: "email", id: "f2", label: "Email", required: true })], ["guest_name", "contact_email", "party_size"]];

test("BIND 1 — each filled field is bound to its column from the form's own fields and the table's columns; renamed columns are found; what cannot be told is a limitation, never a guess", () => {
  const bind = (fields, cols) => fieldBindings(fieldPlan(fields, M), cols);
  const pairs = (b) => { assert.equal(b.ok, true, b.why); return b.bindings.map((x) => [x.label, x.column, x.by]); };
  // ORDINARY: the inputs named after their columns.
  assert.deepEqual(pairs(bind(...ORDINARY)), [["Your name", "name", "its name"], ["Email", "email", "its name and label"]]);
  // RENAMED COLUMNS THE FIELDS NAME: by the name attribute, by an id in another case, by a label.
  assert.deepEqual(pairs(bind(...RENAMED)), [["Full name", "full_name", "its name and label"], ["Email address", "email_address", "its name and label"]]);
  assert.deepEqual(pairs(bind([field({ id: "guestName", label: "Your name", required: true }), field({ type: "email", id: "guest-email", label: "Where we write", required: true })], ["guest_name", "guest_email"])),
    [["Your name", "guest_name", "its id"], ["Where we write", "guest_email", "its id"]]);
  assert.deepEqual(pairs(bind([field({ id: "a1", label: "Name *", required: true }), field({ type: "email", id: "a2", label: "E-mail", required: true })], ["name", "e_mail"])),
    [["Name *", "name", "its label"], ["E-mail", "e_mail", "its label"]]);
  // RENAMED COLUMNS THE FIELDS DO NOT NAME: the table's one column for each.
  assert.deepEqual(pairs(bind(...BY_ROLE)), [["Your name", "guest_name", "the table's one name column"], ["Email", "contact_email", "the table's one email column"]]);
  // A REQUIRED SENTENCE AND A BOX: bound where a field names its column.
  const more = bind([NAME, EMAIL, field({ tag: "textarea", name: "message", label: "Anything else?", required: true }), field({ type: "checkbox", id: "consent", label: "I agree", required: true })], ["name", "email", "message", "consent"]);
  assert.deepEqual(pairs(more).map((p) => p[1]), ["name", "email", "message", "consent"]);
  assert.deepEqual(more.bindings.map((b) => [b.role, b.kind, b.value]), [["name", "fill", M.name], ["email", "fill", M.email], ["text", "fill", M.text], ["check", "check", true]]);
  // NOT ESTABLISHED, EACH SAYING WHAT COULD NOT BE TOLD, WITH NOTHING BOUND.
  const limited = (fields, cols, re) => { const b = bind(fields, cols); assert.equal(b.ok, false, JSON.stringify(b)); assert.deepEqual(b.bindings, []); assert.match(b.why, re); };
  limited(...ORDINARY.slice(0, 1), [], /the new table's columns were not read/);
  limited(BY_ROLE[0], ["guest_name", "event_name", "contact_email"], /^the field "Your name" names no column, and 2 columns could hold the name \(guest_name, event_name\)$/);
  limited([field({ id: "f1", label: "Your name", required: true }), field({ type: "email", id: "f2", label: "Contact", required: true })], ["guest_name", "phone"], /^the field "Contact" names no column, and no column of the table is for the email address \(guest_name, phone\)$/);
  limited([field({ name: "name", label: "Full name", required: true }), EMAIL], ["name", "full_name", "email"], /^the field "Full name" names two different columns \(name, full_name\)$/);
  limited([field({ name: "guest", label: "Your name", required: true }), field({ type: "email", name: "name", label: "Contact", required: true })], ["guest", "name"], /^the email field "Contact" is named after the column "name", which is for a name$/);
  limited([field({ name: "email", label: "Your name", required: true }), field({ type: "email", name: "contact", label: "Contact", required: true })], ["email", "contact"], /^the name field "Your name" is named after the column "email", which is for an email address$/);
  limited([NAME, field({ name: "partner", label: "Partner's name", required: true }), EMAIL], ["name", "email"], /^two fields are bound to the column "name"$/);
  limited([NAME, EMAIL, field({ tag: "textarea", name: "msg", label: "Anything else?", required: true })], ["name", "email", "notes"], /^the field "Anything else\?" names no column of the table \(name, email, notes\), so where its entry goes cannot be told$/);
  limited([NAME, EMAIL], ["full_name", "fullname", "email"], /^the field "Your name" names no column, and 2 columns could hold the name \(full_name, fullname\)$/);
  // A COLUMN WHOSE NAME SAYS BOTH IS NEITHER'S FOR CERTAIN: the address field never lands in it by default.
  limited([NAME, field({ type: "email", name: "email_name", label: "Contact", required: true })], ["name", "email_name"], /^the email field "Contact" is named after the column "email_name", which is for a name$/);
  limited(BY_ROLE[0], ["guest_name", "name_email"], /^the field "Your name" names no column, and 2 columns could hold the name \(guest_name, name_email\)$/);
  limited([field({ name: "full_name", label: "Your name", required: true }), EMAIL], ["full_name", "fullname", "email"], /^the field "Your name" matches 2 columns \(full_name, fullname\)$/);
  assert.match(fieldBindings({ ok: false, fills: [] }, ["name"]).why, /no filled form/);
  assert.match(fieldBindings(null, ["name"]).why, /no filled form/);
});

test("BIND 2 — the gate reads each entry where it belongs: the name and address swapped, or both empty with the values in note and source, are stopped before they leave; the ordinary and renamed sends leave", () => {
  const send = ([fields, cols], body) => {
    const binding = fieldBindings(fieldPlan(fields, M), cols);
    assert.equal(binding.ok, true, binding.why);
    return formGate({ n: 1, raw: JSON.stringify(body), search: "", headers: { "content-type": "application/json" }, marker: M, binding });
  };
  const stopped = (g, re) => { assert.equal(g.ok, false); assert.match(g.why, re); };
  // CODEX'S TWO PAYLOADS, EACH STOPPED NAMING THE COLUMN AND WHAT IT CARRIES.
  stopped(send(ORDINARY, { name: M.email, email: M.name }), /^"name" should carry the value entered in "Your name", and carries the value entered in "Email"$/);
  stopped(send(ORDINARY, { name: "", email: "", note: M.name, source: M.email }), /^"name" should carry the value entered in "Your name", and carries an empty value$/);
  // THE SAME ON RENAMED COLUMNS, NAMED AND NOT.
  stopped(send(RENAMED, { full_name: M.email, email_address: M.name }), /^"full_name" should carry the value entered in "Full name", and carries the value entered in "Email address"$/);
  stopped(send(RENAMED, { full_name: "", email_address: "", note: M.name, source: M.email }), /^"full_name" should carry the value entered in "Full name", and carries an empty value$/);
  stopped(send(BY_ROLE, { guest_name: M.email, contact_email: M.name }), /^"guest_name" should carry the value entered in "Your name", and carries the value entered in "Email"$/);
  // AN ENTRY UNDER ITS OWN COLUMN AND UNDER ANOTHER TOO; A RENAMED TABLE SENT ITS OLD KEYS.
  stopped(send(ORDINARY, { name: M.name, email: M.email, source: M.email }), /^"source" carries the value entered in "Email", which belongs under "email"$/);
  stopped(send(RENAMED, { name: M.name, email: M.email }), /^"full_name" should carry the value entered in "Full name", and carries nothing$/);
  stopped(send(ORDINARY, { name: ` ${M.name} `, email: M.email }), /^"name" should carry the value entered in "Your name", and carries the value entered in "Your name", with spaces around it$/);
  // THE CONTROLS LEAVE.
  assert.deepEqual(send(ORDINARY, { name: M.name, email: M.email }), { ok: true, why: "" });
  assert.deepEqual(send(RENAMED, { full_name: M.name, email_address: M.email, note: "" }), { ok: true, why: "" });
  assert.deepEqual(send(BY_ROLE, { guest_name: M.name, contact_email: M.email }), { ok: true, why: "" });
});

test("BIND 3 — the stored row is judged by the same bindings: swapped or misplaced entries fail, saying where; the ordinary and renamed rows pass; without bindings nothing is checked and nothing passes", () => {
  const verdict = ([fields, cols], row) => {
    const plan = fieldPlan(fields, M);
    const submitted = { plan, binding: fieldBindings(plan, cols), filledOk: true, posts: [{ sent: true }], response: { status: 201, text: "" } };
    return formVerdict({ submitted, before: okRows([]), after: okRows([{ id: 7, created_at: "2026-10-06T12:00:00Z", ...row }]), marker: M, table: "tasting_waitlist" });
  };
  const rowCheck = (v) => v.checks.find((c) => c.name.includes("exactly that one row"));
  const fails = (v, re) => { assert.equal(v.ok, false); const c = rowCheck(v); assert.equal(c.ok, false); assert.match(c.why, re); assert.deepEqual(v.checks.filter((x) => !x.ok).map((x) => x.name), [c.name]); };
  // CODEX'S TWO ROWS.
  fails(verdict(ORDINARY, { name: M.email, email: M.name }), /^1 rows; 1 new; "name" holds the value entered in "Email", not the value entered in "Your name"$/);
  fails(verdict(ORDINARY, { name: "", email: "", note: M.name, source: M.email }), /^1 rows; 1 new; "name" holds an empty value, not the value entered in "Your name"$/);
  // ON RENAMED COLUMNS, NAMED AND NOT; A STRAY COPY; A COLUMN THE ROW DOES NOT HAVE.
  fails(verdict(RENAMED, { full_name: M.email, email_address: M.name, note: null, source: null }), /"full_name" holds the value entered in "Email address", not the value entered in "Full name"/);
  fails(verdict(RENAMED, { full_name: null, email_address: null, note: M.name, source: M.email }), /"full_name" holds an empty value/);
  fails(verdict(BY_ROLE, { guest_name: M.email, contact_email: M.name, party_size: null }), /"guest_name" holds the value entered in "Email"/);
  fails(verdict(ORDINARY, { name: M.name, email: M.email, source: M.email }), /"source" also holds the value entered in "Email", which belongs in "email"$/);
  fails(verdict(RENAMED, { name: M.name, email: M.email }), /"full_name" holds nothing, not the value entered in "Full name"/);
  // THE CONTROLS PASS, NAMING EACH BINDING.
  const ord = verdict(ORDINARY, { name: M.name, email: M.email });
  assert.equal(ord.ok, true, JSON.stringify(ord.checks));
  assert.match(rowCheck(ord).name, /\(Your name → name; Email → email\)$/);
  const ren = verdict(RENAMED, { full_name: M.name, email_address: M.email, note: null, source: null });
  assert.equal(ren.ok, true, JSON.stringify(ren.checks));
  assert.match(rowCheck(ren).name, /\(Full name → full_name; Email address → email_address\)$/);
  assert.equal(verdict(BY_ROLE, { guest_name: ` ${M.name} `, contact_email: M.email, party_size: null }).ok, true, "a stored value with the database's own spaces around it");
  // NO BINDINGS: the limitation is said as one, the row is not checked, and nothing passes, even a row holding every value.
  const plan = fieldPlan(BY_ROLE[0], M);
  const unbound = fieldBindings(plan, ["guest_name", "event_name", "contact_email"]);
  const v = formVerdict({ submitted: { plan, binding: unbound, filledOk: true, posts: [{ sent: true }], response: { status: 201 } }, before: okRows([]), after: okRows([{ id: 1, guest_name: M.name, event_name: null, contact_email: M.email }]), marker: M, table: "t" });
  assert.equal(v.ok, false);
  const lim = v.checks.find((c) => c.name.includes("each entry belongs in"));
  assert.equal(lim.ok, false);
  assert.equal(lim.why, 'a limitation of this check, not a pass: the field "Your name" names no column, and 2 columns could hold the name (guest_name, event_name)');
  assert.match(rowCheck(v).why, /not checked: which column holds which entry was not established$/);
  assert.equal(formVerdict({ submitted: { plan, filledOk: true, posts: [{ sent: true }], response: { status: 201 } }, before: okRows([]), after: okRows([{ id: 1, guest_name: M.name, contact_email: M.email }]), marker: M, table: "t" }).ok, false, "a record with no binding at all passed");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE HELPER, IN A REAL CHROMIUM
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = "https://tasting-bakery.gofarther.app";
const API = "/api/db/tasting-bakery/data/tasting_waitlist";
/** A page like the site's own: its form marked live as React marks it, its entry sent as the kit sends it (JSON, an Idempotency-Key). */
const pageWith = ({ fields, forms = 1, body = "values", auth = false, build = "" }) => `<!doctype html><meta charset="utf-8"><title>Tasting Evenings</title>
<main><h1>Tasting Evenings</h1>${Array.from({ length: forms }, (_, i) => `<form id="f${i}">${fields}<button type="submit">Join the waiting list</button></form>`).join("")}<p role="status" id="said"></p></main>
<script>
for (const f of document.querySelectorAll("form")) {
  f.__reactProps$canary = {}; f.querySelector("button").__reactProps$canary = {};
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    let values = {};
    for (const el of f.querySelectorAll("input, textarea")) values[el.name] = el.type === "checkbox" ? el.checked : el.value;
    ${body === "extra" ? 'values.source = "homepage";' : ""}
    ${build}
    const r = await fetch(${JSON.stringify(API)}, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": "k1"${auth ? ', Authorization: "Bearer member"' : ""} }, body: JSON.stringify(values) }).catch(() => null);
    document.getElementById("said").textContent = r && r.ok ? "Thanks — you're on the list." : "Something went wrong.";
  });
}
</script>`;
const FIELDS = '<label>Your name <input name="name" required></label><label>Email <input type="email" name="email" required></label>';

/** The site, served here: every request this page makes is answered by the test, and every POST that reaches it is counted. */
async function visit(html, { submit, columns = ["name", "email"] }) {
  const seen = [];
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const out = await submitFormInPage(browser, {
      origin: ORIGIN, path: "/tasting-evenings", api: API, marker: M, columns, submit, ms: 8000, answerMs: 5000, settleMs: 1500, pollMs: 50,
      route: async (ctx) => {
        await ctx.route("**/*", async (r) => {
          const req = r.request();
          const u = new URL(req.url());
          if (req.method() === "POST") {
            seen.push({ path: u.pathname, body: req.postData(), headers: await req.allHeaders() });
            return r.fulfill({ status: 201, contentType: "application/json", body: "" });
          }
          if (u.origin === ORIGIN && u.pathname === "/tasting-evenings") return r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
          return r.fulfill({ status: 404, body: "" });
        });
      },
    });
    return { out, seen };
  } finally { await browser.close(); }
}

test("FORM 6 — in a real browser, the paid press: the page's one form is filled with the marker, its one request leaves exactly as entered, the site takes it, and the verdict passes on the row read back", { skip: SKIP }, async () => {
  const { out, seen } = await visit(pageWith({ fields: FIELDS }), { submit: true });
  assert.equal(out.why, "", JSON.stringify(out).slice(0, 400));
  assert.equal(out.filledOk, true);
  assert.equal(out.pressed, true);
  assert.equal(seen.length, 1, "the site did not receive exactly one entry");
  assert.equal(seen[0].path, API);
  assert.deepEqual(JSON.parse(seen[0].body), { name: M.name, email: M.email });
  assert.equal(seen[0].headers.authorization, undefined);
  assert.deepEqual([out.posts.length, out.posts[0].sent, out.response.status], [1, true, 201]);
  assert.ok(out.message && out.message.said.some((x) => /on the list/.test(x)), JSON.stringify(out.message));
  const v = formVerdict({ submitted: out, before: okRows([]), after: okRows([{ id: 1, name: M.name, email: M.email }]), marker: M, table: "tasting_waitlist" });
  assert.equal(v.ok, true, JSON.stringify(v.checks));
});

test("FORM 7 — in a real browser, what never leaves: a rehearsal, a body with a value the check did not enter, a credential, a field it cannot fill and a page of two forms each send nothing", { skip: SKIP }, async () => {
  // A REHEARSAL: filled and pressed, stopped in the browser.
  const r = await visit(pageWith({ fields: FIELDS }), { submit: false });
  assert.equal(r.seen.length, 0, "a rehearsal reached the site");
  assert.deepEqual([r.out.posts.length, r.out.posts[0].sent, r.out.posts[0].stopped], [1, false, "a rehearsal stops the entry inside the browser"]);
  // A VALUE THE CHECK DID NOT ENTER, AND A CREDENTIAL: stopped before they leave, never rewritten.
  for (const [o, re] of [[{ body: "extra" }, /"source" carries a value the check did not enter/], [{ auth: true }, /credential/]]) {
    const x = await visit(pageWith({ fields: FIELDS, ...o }), { submit: true });
    assert.equal(x.seen.length, 0, "a request the gate refuses reached the site: " + JSON.stringify(o));
    assert.match(x.out.why, re);
    assert.equal(formVerdict({ submitted: x.out, before: okRows([]), after: okRows([]), marker: M, table: "t" }).ok, false);
  }
  // NOTHING PRESSED: a field this check does not fill, and two forms.
  const sel = await visit(pageWith({ fields: FIELDS + '<label>Which evening <select name="evening" required><option value="">Pick</option><option>Friday</option></select></label>' }), { submit: true });
  assert.deepEqual([sel.seen.length, sel.out.pressed], [0, false]);
  assert.match(sel.out.why, /asks for "Which evening/);
  const two = await visit(pageWith({ fields: FIELDS, forms: 2 }), { submit: true });
  assert.deepEqual([two.seen.length, two.out.pressed], [0, false]);
  assert.match(two.out.why, /2 forms/);
  // A FIELD THAT DOES NOT HOLD WHAT WAS TYPED (the page rewrites it): nothing pressed.
  const rewrites = await visit(pageWith({ fields: '<label>Your name <input name="name" required></label><label>Email <input type="email" name="email" required oninput="this.value=this.value.toUpperCase()"></label>' }), { submit: true });
  assert.deepEqual([rewrites.seen.length, rewrites.out.pressed, rewrites.out.filledOk], [0, false, false]);
  assert.match(rewrites.out.why, /does not hold the marker's values/);
});

test("FORM 8 — in a real browser, each entry where it belongs: a page that swaps the name and the address, or sends them under note and source, is stopped before anything leaves; a page on renamed columns, named by its fields or not, sends its one entry; a table whose columns cannot be told apart presses nothing, said as a limitation", { skip: SKIP }, async () => {
  // CODEX'S TWO PAYLOADS, AS A PAGE'S OWN CODE WOULD SEND THEM: stopped in the browser.
  const swap = await visit(pageWith({ fields: FIELDS, build: "values = { name: values.email, email: values.name };" }), { submit: true });
  assert.deepEqual([swap.seen.length, swap.out.pressed, swap.out.posts.length, swap.out.posts[0].sent], [0, true, 1, false], "a swapped entry reached the site");
  assert.equal(swap.out.why, 'the form\'s request was stopped in the browser and never sent — "name" should carry the value entered in "Your name", and carries the value entered in "Email"');
  assert.equal(formVerdict({ submitted: swap.out, before: okRows([]), after: okRows([]), marker: M, table: "tasting_waitlist" }).ok, false);
  const moved = await visit(pageWith({ fields: FIELDS, build: 'values = { name: "", email: "", note: values.name, source: values.email };' }), { submit: true, columns: ["name", "email", "note", "source"] });
  assert.deepEqual([moved.seen.length, moved.out.posts[0].sent], [0, false]);
  assert.match(moved.out.why, /— "name" should carry the value entered in "Your name", and carries an empty value$/);
  // RENAMED COLUMNS THE FIELDS NAME: one exact entry, and the row read back passes; the same row swapped does not.
  const RENAMED_FIELDS = '<label>Full name <input name="full_name" required></label><label>Email address <input type="email" name="email_address" required></label>';
  const ren = await visit(pageWith({ fields: RENAMED_FIELDS }), { submit: true, columns: ["full_name", "email_address", "note"] });
  assert.equal(ren.out.why, "", JSON.stringify(ren.out).slice(0, 400));
  assert.equal(ren.seen.length, 1);
  assert.deepEqual(JSON.parse(ren.seen[0].body), { full_name: M.name, email_address: M.email });
  assert.deepEqual(ren.out.binding.bindings.map((b) => [b.column, b.by]), [["full_name", "its name and label"], ["email_address", "its name and label"]]);
  const good = formVerdict({ submitted: ren.out, before: okRows([]), after: okRows([{ id: 1, full_name: M.name, email_address: M.email, note: null }]), marker: M, table: "tasting_waitlist" });
  assert.equal(good.ok, true, JSON.stringify(good.checks));
  assert.equal(formVerdict({ submitted: ren.out, before: okRows([]), after: okRows([{ id: 1, full_name: M.email, email_address: M.name, note: null }]), marker: M, table: "tasting_waitlist" }).ok, false, "a swapped stored row passed");
  assert.equal(formVerdict({ submitted: ren.out, before: okRows([]), after: okRows([{ id: 1, full_name: "", email_address: "", note: M.name }]), marker: M, table: "tasting_waitlist" }).ok, false, "a misplaced stored row passed");
  // RENAMED COLUMNS THE FIELDS DO NOT NAME (inputs the page's own code reads): the table's one name and one email column.
  const HELD = '<label for="f1">Your name</label><input id="f1" required><label for="f2">Email</label><input id="f2" type="email" required>';
  const SEND_HELD = 'values = { guest_name: document.getElementById("f1").value, contact_email: document.getElementById("f2").value };';
  const role = await visit(pageWith({ fields: HELD, build: SEND_HELD }), { submit: true, columns: ["guest_name", "contact_email", "party_size"] });
  assert.equal(role.out.why, "", JSON.stringify(role.out).slice(0, 400));
  assert.deepEqual(JSON.parse(role.seen[0].body), { guest_name: M.name, contact_email: M.email });
  assert.deepEqual(role.out.binding.bindings.map((b) => [b.column, b.by]), [["guest_name", "the table's one name column"], ["contact_email", "the table's one email column"]]);
  // THE SAME PAGE WITH ITS KEYS SWAPPED IN ITS CODE: stopped.
  const roleSwap = await visit(pageWith({ fields: HELD, build: 'values = { guest_name: document.getElementById("f2").value, contact_email: document.getElementById("f1").value };' }), { submit: true, columns: ["guest_name", "contact_email", "party_size"] });
  assert.deepEqual([roleSwap.seen.length, roleSwap.out.posts[0].sent], [0, false]);
  assert.match(roleSwap.out.why, /"guest_name" should carry the value entered in "Your name", and carries the value entered in "Email"$/);
  // NOT ESTABLISHED: two columns could hold the name and the field names neither. Nothing pressed, said as a limitation.
  const amb = await visit(pageWith({ fields: HELD, build: SEND_HELD }), { submit: true, columns: ["guest_name", "event_name", "contact_email"] });
  assert.deepEqual([amb.seen.length, amb.out.pressed, amb.out.posts.length, amb.out.filled], [0, false, 0, null]);
  assert.equal(amb.out.why, 'verification limitation: the field "Your name" names no column, and 2 columns could hold the name (guest_name, event_name) — nothing was pressed');
  const va = formVerdict({ submitted: amb.out, before: okRows([]), after: okRows([]), marker: M, table: "tasting_waitlist" });
  assert.equal(va.ok, false);
  assert.match(va.checks.find((c) => c.name.includes("each entry belongs in")).why, /^a limitation of this check, not a pass: the field "Your name" names no column/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE SCENARIO AND THE WIRING
// ─────────────────────────────────────────────────────────────────────────────

test("SCENE 1 — the release check is one message on the bakery, an edit and an add-on, its form step asked for, its table a visitor's to send to with an email column", () => {
  const s = UI_SCENARIOS["lv-release"];
  assert.ok(s, "no lv-release scenario");
  assert.deepEqual([s.site, s.request, s.addon, s.budget, s.fundsFirst], ["fold-lane-bakery", true, true, 30, true]);
  assert.deepEqual([...s.layers], ["text", "look", "nav", "page"]);
  assert.equal(s.steps.length, 1);
  assert.equal(s.steps[0].say, "Add a Tasting Evenings page where people can join the waiting list for our next tasting evening by leaving their name and email address, and change the Gallery page heading 'Photographs from Fold Lane' to 'Photographs from our ovens'.");
  assert.deepEqual(s.expect.headings.map((h) => [h.route, h.from, h.to]), [["/gallery", "Photographs from Fold Lane", "Photographs from our ovens"]]);
  assert.deepEqual([...s.expect.pages[0].about], ["tasting"]);
  assert.deepEqual({ ...s.expect.menu }, { label: "Tasting", page: 0 });
  assert.deepEqual({ added: s.expect.tables.added, pair: { ...s.expect.tables.pair }, column: s.expect.tables.column }, { added: 1, pair: { read: "none", write: "anyone" }, column: "email" });
  assert.deepEqual({ ...s.expect.form }, { page: 0 });
  // THE WORKFLOW'S BOX NAMES IT.
  assert.match(readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8"), /lv-release \(the release check on fold-lane-bakery/);
});

test("WIRE 1 — the form step runs inside the request press, after its money, only where a scenario asks; it sends nothing outside the paid press, before the new page and the one new, empty table are established, or before the owner's read answers", () => {
  const C = readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
  for (const at of ['import { formMarker, formDataPath, addedTable, formVerdict } from "./canary-form.mjs";', 'import { defaultLaunch, submitFormInPage } from "./canary-ui.mjs";', "async function formStep({ spec, verdict, tablesBefore, tablesAfter, origin, spend }) {"]) {
    assert.ok(C.includes(at), "landmark gone: " + at);
  }
  // THE SPEND GATE'S OWN LANDMARK STAYS ITS OWN: the step is handed the switch.
  assert.equal(C.split("if (!SPEND)").length - 1, 1, "the spend gate's landmark is no longer unique");
  const step = C.slice(C.indexOf("async function formStep("), C.indexOf("\n}\n", C.indexOf("async function formStep(")));
  const order = ["if (spend !== true) return stop(", "if (!path) return stop(", "if (!added.ok) return stop(", "const before = await rowsOf();", "if (!before.ok) return stop(", "if (before.rows.length) return stop(", "browser = await defaultLaunch();", "submitFormInPage(browser,", "columns: added.columns", "submit: true", "const after = await rowsOf();", "formVerdict("];
  let last = -1;
  for (const at of order) { const i = step.indexOf(at); assert.ok(i > last, "out of order or gone: " + at); last = i; }
  assert.match(step, /readRowList\(await call\("GET", `\/api\/site\/\$\{encodeURIComponent\(CANARY\)\}\/rows\/\$\{encodeURIComponent\(added\.table\)\}\?order=id&dir=asc&limit=\$\{OWNER_ROWS_LIMIT\}`\), \{ owner: true \}\)/, "the table is not read by the owner's route");
  // CALLED ONCE, IN THE REQUEST PRESS, AFTER ITS MONEY, ONLY WHERE ASKED, WITH THE SWITCH; ITS CHECKS COUNT.
  assert.equal(C.split("await formStep(").length - 1, 1);
  const money = C.indexOf("requests.money = money;");
  const call = C.indexOf("requests.form = await formStep({ spec: UI_ASK.scenario, verdict: requests, tablesBefore, tablesAfter, origin: BEFORE.origin, spend: SPEND });");
  const asked = C.lastIndexOf("if (UI_ASK.scenario.expect && UI_ASK.scenario.expect.form) {", call);
  assert.ok(money > 0 && asked > money && call > asked, "the form step is not after the money, behind its scenario's ask");
  const after = C.slice(call, C.indexOf("COVERAGE:", call));
  assert.match(after, /for \(const c of requests\.form\.checks\) check\(c\.name, c\.ok, c\.why\);/);
  assert.match(after, /requests\.ok = requests\.ok && requests\.form\.ok;/);
  assert.match(after, /requests\.checks = requests\.checks\.concat\(requests\.form\.checks\);/);
});

test("FUNDS 1 — a press that cannot be paid for whole sends nothing: the balance against the scenario's budget before the first message; an unreadable balance or a missing budget is a refusal", () => {
  assert.equal(fundsRefusal({ now: 21, budget: 30 }), "the balance (21) does not cover this press's budget of 30 credits");
  assert.equal(fundsRefusal({ now: 30, budget: 30 }), "");
  assert.equal(fundsRefusal({ now: 45, budget: 30 }), "");
  for (const now of [null, undefined, NaN, -1, "21"]) assert.match(fundsRefusal({ now, budget: 30 }), /could not be read/, String(now));
  for (const budget of [0, null, undefined, -5]) assert.match(fundsRefusal({ now: 50, budget }), /names no budget/, String(budget));
  // THE SPEND-SO-FAR CHECK IS UNCHANGED, AND ASKS SOMETHING ELSE: 21 left of a start of 21 has spent nothing.
  assert.equal(budgetRefusal({ start: 21, now: 21, budget: 30 }), "");
});

test("WIRE 2 — the funds check stands before the first send of a scenario that asks for it, after the spend-so-far check, and stops the press with nothing sent", () => {
  const U = readFileSync(ROOT + "scripts/canary-ui.mjs", "utf8");
  const over = U.indexOf("const over = budgetRefusal({ start: rec.balance.start, now: bal, budget: scenario.budget });");
  const short = U.indexOf('const short = n === 1 && scenario.fundsFirst === true ? fundsRefusal({ now: bal, budget: scenario.budget }) : "";');
  const stops = U.indexOf("if (short) { stop(`step ${n}`, `${short} — nothing is sent`); break; }");
  assert.ok(over > 0 && short > over && stops > short, "the funds check is gone or out of place");
  // BEFORE THE MESSAGE IS SENT: nothing between the check and the stop sends anything.
  assert.doesNotMatch(U.slice(short, stops), /press\(|click\(|fill\(/);
  assert.equal(U.split("fundsRefusal({ now: bal").length - 1, 1, "the funds check is asked more than once");
  // ONLY THE RELEASE CHECK ASKS FOR IT: every other scenario's behaviour is as it was.
  assert.deepEqual(Object.entries(UI_SCENARIOS).filter(([, v]) => v.fundsFirst === true).map(([k]) => k), ["lv-release"]);
});

test("WIRE 3 — the helper binds each field to its column after reading the form and before filling or pressing anything, stops there when the binding is not established, and hands the gate those bindings", () => {
  const U = readFileSync(ROOT + "scripts/canary-ui.mjs", "utf8");
  assert.ok(U.includes('import { fieldPlan, fieldBindings, formGate } from "./canary-form.mjs";'), "the binding is not imported");
  const start = U.indexOf("export async function submitFormInPage(browser, {");
  const helper = U.slice(start, U.indexOf("\n}\n", start));
  assert.ok(start > 0 && helper.includes("columns = null,"), "the helper does not take the table's columns");
  const order = ["out.plan = fieldPlan(out.ready.fields, marker);", "if (!out.plan.ok) { out.why = out.plan.why; return out; }", "out.binding = fieldBindings(out.plan, columns);",
    "if (!out.binding.ok) { out.why = `verification limitation: ${out.binding.why} — nothing was pressed`; return out; }", "for (const f of out.plan.fills) {", ".click();"];
  let last = -1;
  for (const at of order) { const i = helper.indexOf(at); assert.ok(i > last, "out of order or gone: " + at); last = i; }
  assert.equal(helper.split("formGate(").length - 1, 1);
  assert.ok(helper.includes("const gate = formGate({ n: out.posts.length + 1, raw, search, headers, marker, binding: out.binding });"), "the gate is not handed the bindings");
});

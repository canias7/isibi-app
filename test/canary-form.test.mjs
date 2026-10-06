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
// ─────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { formMarker, formDataPath, addedTable, fieldPlan, formGate, formVerdict } from "../scripts/canary-form.mjs";
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

test("FORM 4 — whether the request may leave: the first one, no query, no credential, no prefer, and a body of exactly what the check entered", () => {
  const plan = fieldPlan([NAME, EMAIL, field({ type: "checkbox", name: "consent", required: true })], M);
  const gate = (o) => formGate({ n: 1, raw: JSON.stringify({ name: M.name, email: M.email, consent: true }), search: "", headers: { "content-type": "application/json", "Idempotency-Key": "k" }, marker: M, plan, ...o });
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
  stopped({ raw: JSON.stringify({ name: M.name, email: M.email, source: "homepage" }) }, /"source" carries a value the check did not enter/);
  stopped({ raw: JSON.stringify({ name: M.name, email: M.email, guests: 2 }) }, /"guests" carries 2/);
  stopped({ raw: JSON.stringify({ name: M.name }) }, /email address/);
  stopped({ raw: JSON.stringify({ email: M.email }) }, /marker's name/);
  stopped({ raw: JSON.stringify({ name: M.name, email: M.email, consent: true, news: true }) }, /ticks a box the check did not tick/);
});

test("FORM 5 — the form step's checks, each by what happened: one form filled, one request sent, the site taking it, an empty table and then exactly that row", () => {
  const sent = { plan: { ok: true }, filledOk: true, posts: [{ sent: true }], response: { status: 201, text: "" } };
  const row = { id: 1, name: M.name, email: M.email, created_at: "2026-10-06T12:00:00Z" };
  const v = formVerdict({ submitted: sent, before: okRows([]), after: okRows([row]), marker: M, table: "tasting_waitlist" });
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.deepEqual(v.row, row);
  assert.equal(v.checks.length, 5);
  const failing = (o, name) => { const x = formVerdict({ submitted: sent, before: okRows([]), after: okRows([row]), marker: M, table: "tasting_waitlist", ...o }); assert.equal(x.ok, false); const bad = x.checks.filter((c) => !c.ok).map((c) => c.name); assert.ok(bad.some((n) => n.includes(name)), JSON.stringify(bad)); return x; };
  failing({ submitted: { ...sent, plan: { ok: false, why: "no email field" }, why: "the form has no email field — nothing was pressed" } }, "one form this check can fill");
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
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE HELPER, IN A REAL CHROMIUM
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = "https://tasting-bakery.gofarther.app";
const API = "/api/db/tasting-bakery/data/tasting_waitlist";
/** A page like the site's own: its form marked live as React marks it, its entry sent as the kit sends it (JSON, an Idempotency-Key). */
const pageWith = ({ fields, forms = 1, body = "values", auth = false }) => `<!doctype html><meta charset="utf-8"><title>Tasting Evenings</title>
<main><h1>Tasting Evenings</h1>${Array.from({ length: forms }, (_, i) => `<form id="f${i}">${fields}<button type="submit">Join the waiting list</button></form>`).join("")}<p role="status" id="said"></p></main>
<script>
for (const f of document.querySelectorAll("form")) {
  f.__reactProps$canary = {}; f.querySelector("button").__reactProps$canary = {};
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = {};
    for (const el of f.querySelectorAll("input, textarea")) values[el.name] = el.type === "checkbox" ? el.checked : el.value;
    ${body === "extra" ? 'values.source = "homepage";' : ""}
    const r = await fetch(${JSON.stringify(API)}, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": "k1"${auth ? ', Authorization: "Bearer member"' : ""} }, body: JSON.stringify(values) }).catch(() => null);
    document.getElementById("said").textContent = r && r.ok ? "Thanks — you're on the list." : "Something went wrong.";
  });
}
</script>`;
const FIELDS = '<label>Your name <input name="name" required></label><label>Email <input type="email" name="email" required></label>';

/** The site, served here: every request this page makes is answered by the test, and every POST that reaches it is counted. */
async function visit(html, { submit }) {
  const seen = [];
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const out = await submitFormInPage(browser, {
      origin: ORIGIN, path: "/tasting-evenings", api: API, marker: M, submit, ms: 8000, answerMs: 5000, settleMs: 1500, pollMs: 50,
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
  const order = ["if (spend !== true) return stop(", "if (!path) return stop(", "if (!added.ok) return stop(", "const before = await rowsOf();", "if (!before.ok) return stop(", "if (before.rows.length) return stop(", "browser = await defaultLaunch();", "submitFormInPage(browser,", "submit: true", "const after = await rowsOf();", "formVerdict("];
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

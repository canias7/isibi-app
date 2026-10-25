// A requirement checked against the built site before the reply (2026-10-25,
// feature-verify). Live on driftwood-and-daughters-5 (edit_jobs c0bf4e6c,
// 3550321d, ee7a60b0) every behavioural need of an addition was told "I can't
// see from here whether…": a booking form, an owner-editable menu, badges, a
// group limit, a closed-day switch. The render check had opened every page and
// the schema was known; nothing joined them to the judge's carriers. Supplied
// inputs only: no model call, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageWiring, readCarrier, verifyNeed, tableRules, routeCode, renderedForms, declaredPart } from "../builder/requirement-verify.mjs";
import { requirementReport, toldNote } from "../builder/site-requirements.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
import { formProbe, renderReport } from "../builder/site-render.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const RC = readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
const at = (src, s, from = 0) => { const i = src.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };

const LESSONS = `import { useCreateRow, useRows } from "@/lib/rows";
// useCreateRow("not_this_one") in a comment is not wiring
export default function Lessons() {
  const book = useCreateRow<Booking>("lesson_bookings");
  const closed = useRows("closed_days");
  return <form><input name="date" type="date"/><input name="time"/><input name="people" type="number"/><input name="nickname"/></form>;
}`;
const CAFE = `const items = useRows("menu_items"); /* useCreateRow("x") */`;
const spec = { tables: [
  { name: "lesson_bookings", access: "collect", columns: [{ name: "date" }, { name: "time" }, { name: "people" }], checks: [["people", "lte", "8"]] },
  { name: "closed_days", access: "display", columns: [{ name: "day" }] },
  { name: "menu_items", access: "display", columns: [{ name: "name" }, { name: "price" }, { name: "vegan" }] },
  { name: "enquiries", access: "collect", columns: [{ name: "message" }], confirm: { to: "email" } },
], functions: [{ name: "book_lesson" }] };
const site = (over = {}) => ({
  pages: new Map([["/lessons", LESSONS], ["/cafe", CAFE]]),
  forms: new Map([["/lessons", [{ fields: [{ name: "date", type: "date", label: "Date" }, { name: "time", type: "text", label: "Time" }, { name: "people", type: "number", label: "People" }] }]]]),
  drawn: new Set(["/lessons", "/cafe"]),
  spec, ...over,
});

test("a page's wiring is read from its code, comments blanked", () => {
  const w = pageWiring(LESSONS);
  assert.deepEqual([...w.writes], ["lesson_bookings"]);
  assert.deepEqual([...w.reads], ["closed_days"]);
  assert.ok(w.fields.has("people"));
  assert.deepEqual([...pageWiring(CAFE).writes], []);
  assert.deepEqual([...pageWiring('const go = useRpcAction("book_lesson");').rpcs], ["book_lesson"]);
});

test("carrier ids read back as the judge writes them", () => {
  assert.deepEqual(readCarrier("page:/lessons/"), { kind: "page", name: "/lessons" });
  assert.deepEqual(readCarrier("table:lesson_bookings.people"), { kind: "table", name: "lesson_bookings", column: "people" });
  assert.deepEqual(readCarrier("table:lesson_bookings:checks"), { kind: "table", name: "lesson_bookings", part: "checks" });
  assert.equal(readCarrier("nonsense"), null);
  assert.equal(readCarrier(42), null);
});

test("a booking form wired to its table, and the group limit in the schema, are present with the evidence named", () => {
  const v = verifyNeed(["page:/lessons", "table:lesson_bookings"], site());
  assert.equal(v.state, "present", JSON.stringify(v));
  assert.ok(v.evidence.includes("/lessons shows a form that saves to lesson_bookings (date, time, people)"), JSON.stringify(v.evidence));
  const cap = verifyNeed(["table:lesson_bookings:checks"], site());
  assert.equal(cap.state, "present", JSON.stringify(cap));
  assert.ok(cap.evidence.some((e) => e === "lesson_bookings only accepts rows where people ≤ 8"), JSON.stringify(cap.evidence));
  // The form as drawn wins over the code's field names (nickname is no column, and not drawn).
  const code = verifyNeed(["page:/lessons", "table:lesson_bookings"], site({ forms: new Map() }));
  assert.ok(code.evidence.includes("/lessons has code that saves to lesson_bookings (date, time, people)"), JSON.stringify(code.evidence));
  const drawnOnly = verifyNeed(["page:/lessons", "table:lesson_bookings"], site({ forms: new Map([["/lessons", [{ fields: [{ name: "date", type: "date", label: "" }] }]]]) }));
  assert.ok(drawnOnly.evidence.includes("/lessons shows a form that saves to lesson_bookings (date)"), JSON.stringify(drawnOnly.evidence));
  // An owner switch and an owner-editable list: the page reads the table the owner edits.
  const sw = verifyNeed(["page:/lessons", "table:closed_days"], site());
  assert.equal(sw.state, "present");
  assert.ok(sw.evidence.includes("closed_days is a table the owner can edit in the Data panel"));
  assert.ok(sw.evidence.includes("/lessons lists the rows of closed_days"));
});

test("what is not there, or not joined, is missing, with the gap named", () => {
  assert.deepEqual(verifyNeed(["page:/cafe", "table:lesson_bookings"], site()).gaps, ["/cafe does not read or save lesson_bookings"]);
  assert.deepEqual(verifyNeed(["page:/hire", "table:lesson_bookings"], site()).gaps, ["there is no /hire page"]);
  assert.deepEqual(verifyNeed(["page:/cafe", "table:hire_requests"], site()).gaps, ["the site has no hire_requests table"]);
  assert.deepEqual(verifyNeed(["page:/cafe", "table:menu_items.gluten_free"], site()).gaps, ["the menu_items table has no gluten_free column"]);
  const noCap = verifyNeed(["table:menu_items:maxrows"], site());
  assert.equal(noCap.state, "missing");
  assert.match(noCap.gaps[0], /menu_items table does not have a limit/);
});

test("only what nothing here can read stays unverifiable", () => {
  for (const by of [["component:lesson-booker"], ["job:nightly"], ["table:menu_items"], ["function:book_lesson"], ["table:enquiries:confirm"], [], ["page:/lessons", "api:stripe"]]) {
    assert.equal(verifyNeed(by, site()).state, "unverifiable", JSON.stringify(by));
  }
  // A function settles a need only when a page named beside it calls it.
  const s = site({ pages: new Map([["/lessons", 'const go = useRpcAction("book_lesson");']]) });
  assert.equal(verifyNeed(["page:/lessons", "function:book_lesson"], s).state, "present");
  // A page the browser did not draw is not seen.
  assert.equal(verifyNeed(["page:/lessons", "table:lesson_bookings"], site({ drawn: new Set() })).state, "unverifiable");
  assert.equal(declaredPart("checks"), true);
  assert.equal(declaredPart("confirm"), false);
  assert.equal(declaredPart("notify"), false);
  assert.deepEqual(tableRules({ maxRows: 50, oncePerUser: true }), ["holds at most 50 rows", "takes one row per person"]);
});

// The real producer's shape: a judged entry, found among what this change made.
const made = [{ kind: "table", name: "lesson_bookings", columns: ["date", "time", "people"] }, { kind: "page", name: "/lessons" }, { kind: "table", name: "closed_days" }];
const judged = (need, by) => ({ need, status: "covered", from: "page", basis: "asked", id: need, by: "it", judged: { follows: "asked", carried: "yes", by, reason: "r" } });

test("the report says a checked need as a fact, a missing one as not done, and keeps the hedge only where nothing could be read", () => {
  const list = [
    judged("Each lesson can be booked online with a date, a time and a number of people", ["page:/lessons", "table:lesson_bookings"]),
    judged("The owner can mark a day closed", ["page:/lessons", "table:closed_days"]),
    judged("Hire can be booked", ["page:/lessons", "table:menu_items"]),
    judged("A reminder is texted", ["table:lesson_bookings"]),
  ];
  const before = requirementReport(list, { made, judged: true });
  const after = requirementReport(list, { made, judged: true, site: site() });
  const by = (r) => Object.fromEntries(r.told.map((o) => [o.need, o]));
  const b = by(before), a = by(after);
  assert.notEqual(b["Each lesson can be booked online with a date, a time and a number of people"].told, "checked", "the control: without the site nothing is checked");
  const book = a["Each lesson can be booked online with a date, a time and a number of people"];
  assert.equal(book.told, "checked", JSON.stringify(after.told));
  assert.ok(book.evidence.includes("/lessons shows a form that saves to lesson_bookings (date, time, people)"));
  assert.equal(a["The owner can mark a day closed"].told, "checked");
  assert.equal(a["Hire can be booked"].told, "still-to-do");
  assert.deepEqual(a["Hire can be booked"].gaps, ["/lessons does not read or save menu_items"]);
  assert.equal(a["A reminder is texted"].told, b["A reminder is texted"].told, "a table alone stays as it was");
  const note = toldNote(after.told);
  assert.match(note, /Each lesson can be booked online with a date, a time and a number of people: \/lessons shows a form that saves to lesson_bookings \(date, time, people\)/);
  assert.match(note, /Still to do: Hire can be booked \(\/lessons does not read or save menu_items\)/);
  assert.ok(!/can't see from here whether Each lesson/.test(note), note);
  // The reply model hears the evidence as a done fact, and the gap as not done.
  const facts = addonReplyFacts({ ok: true, requirementsTold: after.told }).facts.map((f) => f.kind + ": " + f.text);
  assert.ok(facts.some((f) => f.startsWith("changed: Checked on the built site: Each lesson can be booked") && f.includes("saves to lesson_bookings (date, time, people)")), JSON.stringify(facts));
  assert.ok(facts.some((f) => f.startsWith("not-done: Not done: Hire can be booked.") && f.includes("does not read or save menu_items")), JSON.stringify(facts));
});

test("the render check reports each route's forms, and the route checks requirements against the built site", () => {
  // The probe is self-contained (serialised into the page) and the report keeps what it read.
  assert.ok(!/\bimport\b|require\(/.test(formProbe.toString()));
  const rep = renderReport([], { forms: [{ route: "/lessons", forms: [{ fields: [{ name: "date", type: "date", label: "" }] }] }] });
  assert.deepEqual([...renderedForms(rep).keys()], ["/lessons"]);
  assert.equal(renderReport([], {}).forms, undefined);
  at(RC, "const f = await page.evaluate(formProbe, { route, maxForms: MAX_ROUTE_FORMS, maxFields: MAX_FORM_FIELDS });");
  at(RC, "...(forms.length ? { forms } : {}),");
  at(RC, "if (f && Array.isArray(f.forms)) forms.push({ route, forms: f.forms });");
  assert.deepEqual([...routeCode([{ source: "a", routes: ["/x"] }, { source: "b", routes: ["/x", "/y"] }]).entries()], [["/x", "a\nb"], ["/y", "b"]]);
  // Wired: forms from the published build, the site built after the pages ship, passed only on a change that shipped.
  const forms = at(W, "aForms = publishedForms(built, aRepairRound);");
  assert.ok(forms > at(W, "aRendered = publishedTexts(built, aRepairRound);") - 1);
  const built = at(W, "aVerifySite = {");
  at(W, "pages: routeCode(routedSources(", built);
  at(W, "spec: aSpec,", built);
  at(W, "site: failed ? null : aVerifySite });");
});

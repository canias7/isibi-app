// PARKED (2026-11-03, park-old-way): the old-way half of test/feature-verify.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { pageWiring, readCarrier, verifyNeed, tableRules, routeCode, renderedForms, declaredPart } from "../../../builder/requirement-verify.mjs";
import { requirementReport, toldNote } from "../../../builder/site-requirements.mjs";
import { addonReplyFacts } from "../../../builder/site-reply.mjs";
import { formProbe, renderReport } from "../../../builder/site-render.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const RC = readFileSync(new URL("../../../builder/render-check.mjs", import.meta.url), "utf8");
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

// The real producer's shape: a judged entry, found among what this change made.
const made = [{ kind: "table", name: "lesson_bookings", columns: ["date", "time", "people"] }, { kind: "page", name: "/lessons" }, { kind: "table", name: "closed_days" }];
const judged = (need, by) => ({ need, status: "covered", from: "page", basis: "asked", id: need, by: "it", judged: { follows: "asked", carried: "yes", by, reason: "r" } });

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

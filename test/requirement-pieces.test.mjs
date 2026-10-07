// EACH SETTING AND EACH COLUMN OF A TABLE ACCOUNTED FOR ON ITS OWN (2026-10-07).
//
// The owner: *"where an item contains independently supported and unsupported
// properties or columns, account for each material requirement instead of
// letting one item-level judgment hide partial support; use existing
// validation and execution evidence."* A requirement resting on one column of
// a table (each dish's allergens) or one setting (no two bookings overlapping)
// was judged against the table as a whole, so it read as set up whatever
// became of that piece — and the engine swallowed a column it could not add,
// while its refusals of rules reached no reply at all.
//
//   CARRIERS   `table:<name>.<column>` and `table:<name>:<setting>` are carriers
//              of their own, listed for the judgment where this request
//              designed them, and checked against the table as applied.
//   REFUSED    a column the engine could not add, or a rule it could not put in
//              place, is taken off what the table holds and does, told as a
//              warning of its own, and named beside a requirement whose table
//              was named whole — never hidden behind "set up".
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every judgment and design here is supplied.
import test from "node:test";
import assert from "node:assert/strict";
import {
  carrierOf, carrierId, TABLE_SETTING_KEYS, TABLE_SETTINGS, SETTING_SAYS, tableSettings, pieceSaid,
  requirementOutcomes, requirementReport, requirementRecord,
} from "../builder/site-requirements.mjs";
import { appliedFacts, existingFacts, judgeItems, judgeRequest, warningReport, refusedPieces, refusedNote } from "../builder/site-add.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
import { notDoneOf } from "../builder/request.mjs";
import { applySiteSchema, TOOL_TABLE_FIELDS } from "../site-schema.mjs";
import { addon, writtenPage, storedAnswer } from "./fixtures/addon-route.mjs";

const J = (carried, by = []) => ({ follows: "asked", carried, by, reason: "r" });
let seq = 0;
const E = (o) => ({ basis: "asked", words: "w", status: "covered", from: "table", kind: "table", id: "table#" + seq++, ...o });
const facts = (body) => (addonReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);

const SPEC = {
  tables: [
    { name: "dishes", access: "display", columns: [{ name: "name" }, { name: "price" }, { name: "allergens" }] },
    { name: "bookings", access: "collect", columns: [{ name: "start_at" }, { name: "end_at" }, { name: "email" }], noOverlap: { start: "start_at", end: "end_at" }, maxRows: 50 },
  ],
};
const REFUSED = [
  { table: "dishes", feature: "column", rule: "allergens", why: "the database refused it" },
  { table: "bookings", feature: "noOverlap", rule: "start_at/end_at", why: "start and end must be integer columns" },
];

test("PIECE 1 — A COLUMN AND A SETTING ARE CARRIERS OF THEIR OWN: read and written back, refused when they name nothing a table can have; the column form belongs to tables alone; and the settings are the tool's own table fields, less the table's identity, access and columns", () => {
  assert.deepEqual(carrierOf("table:Dishes.Allergens"), { kind: "table", name: "dishes", column: "allergens" });
  assert.equal(carrierId(carrierOf("table:dishes.allergens")), "table:dishes.allergens");
  assert.deepEqual(carrierOf("table:bookings:noOverlap"), { kind: "table", name: "bookings", part: "nooverlap" });
  assert.equal(carrierId(carrierOf("table:bookings:nooverlap")), "table:bookings:nooverlap");
  // THE PARTS STAND AS THEY WERE.
  assert.deepEqual(carrierOf("table:bookings:confirm"), { kind: "table", name: "bookings", part: "confirm" });
  assert.deepEqual(carrierOf("table:bookings"), { kind: "table", name: "bookings" });
  for (const bad of ["table:bookings:colour", "table:dishes.all-ergens", "table:dishes.", "table:.allergens", "table:a.b:confirm"]) assert.equal(carrierOf(bad), null, bad);
  assert.deepEqual(carrierOf("page:/menu.html"), { kind: "page", name: "/menu.html" }, "a page's dot was read as a column");
  // THE CENSUS: every tool field that is a setting, and nothing else.
  const tool = [...TOOL_TABLE_FIELDS].filter((k) => !["name", "retired", "access", "read", "write", "columns"].includes(k)).sort();
  assert.deepEqual([...TABLE_SETTING_KEYS].sort(), tool);
  assert.deepEqual(Object.keys(SETTING_SAYS).sort(), [...TABLE_SETTINGS].sort(), "a setting has no words");
  assert.deepEqual(tableSettings(SPEC.tables[1]), ["maxrows", "nooverlap"]);
  assert.deepEqual(tableSettings({ name: "x", unique: [], checks: null, fts: false, payment: {} }), [], "an empty declaration read as a setting");
  assert.equal(pieceSaid("column allergens"), "the allergens column");
  assert.equal(pieceSaid("nooverlap"), SETTING_SAYS.nooverlap);
});

test("PIECE 2 — WHAT THE DATABASE REFUSED IS TAKEN OFF THE TABLE AS APPLIED: its columns, its parts, what a claim may name as held, and named as refused; the table beside it keeps everything; the site's existing tables carry their columns and settings too", () => {
  const [dishes, bookings] = appliedFacts({ spec: SPEC, tables: ["dishes", "bookings"], refused: REFUSED });
  assert.deepEqual(dishes.columns, ["name", "price"]);
  assert.ok(!dishes.holds.includes("allergens") && dishes.fails.includes("allergens"), JSON.stringify(dishes));
  assert.deepEqual(dishes.refused, ["column allergens"]);
  assert.deepEqual(bookings.parts, ["notify", "maxrows"], "a refused setting is still one of the table's parts");
  assert.deepEqual(bookings.refused, ["nooverlap"]);
  assert.ok(bookings.fails.includes("nooverlap"));
  // CONTROL: nothing refused, nothing taken off, and no `refused` at all.
  const [clean] = appliedFacts({ spec: SPEC, tables: ["dishes"] });
  assert.deepEqual(clean.columns, ["name", "price", "allergens"]);
  assert.equal(clean.refused, undefined);
  const ex = existingFacts({ spec: SPEC }).items;
  assert.deepEqual(ex.map((i) => [i.name, i.parts, i.columns]), [["dishes", [], ["name", "price", "allergens"]], ["bookings", ["notify", "maxrows", "nooverlap"], ["start_at", "end_at", "email"]]]);
});

test("PIECE 3 — A REQUIREMENT IS CHECKED AGAINST THE PIECE IT RESTS ON: a column that did not go in, and a setting the database refused, read as still to do with why, while the table stands; one naming the table whole is set up and carries the piece that is missing, told in its fact; a table with nothing missing says nothing more", () => {
  const made = appliedFacts({ spec: SPEC, tables: ["dishes", "bookings"], refused: REFUSED });
  const list = [
    E({ need: "Each dish lists its allergens", item: "dishes", judged: J("yes", ["table:dishes.allergens"]) }),
    E({ need: "No two bookings overlap", item: "bookings", judged: J("yes", ["table:bookings:nooverlap"]) }),
    E({ need: "A list of dishes and prices", item: "dishes", judged: J("yes", ["table:dishes"]) }),
    E({ need: "At most fifty bookings", item: "bookings", judged: J("yes", ["table:bookings:maxrows"]) }),
    E({ need: "Each dish shows its price", item: "dishes", judged: J("yes", ["table:dishes.price"]) }),
  ];
  const out = requirementOutcomes(list, { made, reportable: ["table"], judged: true });
  const by = (need) => out.find((r) => r.need === need);
  assert.deepEqual([by("Each dish lists its allergens").state, by("Each dish lists its allergens").why], ["missing", "the dishes table has no allergens column"]);
  assert.deepEqual([by("No two bookings overlap").state, by("No two bookings overlap").why], ["missing", "the bookings table does not have this setting: " + SETTING_SAYS.nooverlap]);
  assert.equal(by("A list of dishes and prices").state, "unverified");
  assert.deepEqual(by("A list of dishes and prices").partly, ["column allergens"]);
  assert.deepEqual([by("At most fifty bookings").state, by("At most fifty bookings").partly], ["unverified", undefined], "a piece that went in was told as missing");
  assert.deepEqual([by("Each dish shows its price").state, by("Each dish shows its price").partly], ["unverified", undefined]);
  // A TABLE NOBODY READ THE COLUMNS OF ANSWERS `unknown` for a column — never absent.
  const legacy = requirementOutcomes([E({ need: "Each guest has a seat", item: "guests", judged: J("yes", ["table:guests.seat"]) })],
    { made: [{ kind: "table", name: "guests", holds: [], fails: [], checked: [], parts: [] }], reportable: ["table"], judged: true });
  assert.equal(legacy[0].state, "unknown", JSON.stringify(legacy[0]));
  // TOLD, each with what it rests on.
  const rep = requirementReport(list, { made, reportable: ["table"], judged: true });
  const told = (need) => rep.told.find((o) => o.need === need);
  assert.equal(told("Each dish lists its allergens").told, "still-to-do");
  assert.equal(told("No two bookings overlap").told, "still-to-do");
  assert.deepEqual([told("A list of dishes and prices").told, told("A list of dishes and prices").partly], ["set-up", ["column allergens"]]);
  const f = facts({ ok: true, changed: ["src/routes/menu.tsx"], requirementsTold: rep.told });
  assert.ok(f.includes("note: Set up, but nothing here can check that it works: A list of dishes and prices. Part of what this change asked of the table it rests on did not go in: the allergens column."), JSON.stringify(f));
  assert.ok(f.includes("not-done: Not done: Each dish lists its allergens."), JSON.stringify(f));
  // A TOLD ENTRY WHOSE `partly` DOES NOT READ IS NOT READ AS ANOTHER: the whole list is cannot-tell.
  const bad = facts({ ok: true, changed: ["x"], requirementsTold: [{ need: "A", told: "set-up", state: "unverified", partly: [3] }], coverNote: "The whole note." });
  assert.ok(!bad.some((t) => t.includes("Set up")) && bad.includes("not-done: The whole note."), JSON.stringify(bad));
});

test("PIECE 4 — THE JUDGMENT IS SHOWN EACH SETTING AND COLUMN THIS REQUEST DESIGNED, and nothing more of what the site already has; a part is listed once; what its list cannot show is counted, never dropped without a number", () => {
  const designed = { name: "bookings", access: "collect", columns: [{ name: "start_at" }, { name: "Email" }], noOverlap: { start: "start_at", end: "end_at" }, confirm: { to: "email", subject: "s", body: "b" } };
  const items = judgeItems({ answers: [{ kind: "table", value: [{ table: designed }] }], existing: { items: [{ kind: "table", name: "dishes", parts: [] }] }, spec: SPEC });
  assert.deepEqual(items.map((i) => i.id), [
    "table:bookings", "table:bookings:notify", "table:bookings:confirm", "table:bookings:nooverlap",
    "table:bookings.start_at", "table:bookings.email", "table:dishes",
  ]);
  assert.match(items.find((i) => i.id === "table:bookings:nooverlap").text, /a setting of the table bookings: no two entries overlapping in time/);
  // AND THE JUDGMENT IS TOLD TO NAME THE PIECE, as it is told to name a part.
  const sys = judgeRequest({ message: "m", entries: [], items, model: "x" }).system.map((b) => b.text).join("\n");
  assert.ok(sys.includes("When it rests on one setting or one column of a table, name that setting or column (ids like `table:bookings:nooverlap` or `table:dishes.allergens`), not only the table."), sys.slice(0, 200));
  // A TABLE WITH MORE COLUMNS THAN ITS LINE SAYS, SAID AS MORE.
  const wide = { name: "wide", access: "display", columns: Array.from({ length: 15 }, (_, i) => ({ name: "c" + i })) };
  const w = judgeItems({ answers: [], existing: { items: [{ kind: "table", name: "wide", parts: [] }] }, spec: { tables: [wide] } });
  assert.match(w[0].text, /c11 and 3 more/);
  // THE LIST'S LIMIT: eighty shown, the rest counted.
  const huge = { name: "huge", access: "display", columns: Array.from({ length: 90 }, (_, i) => ({ name: "k" + i })) };
  const report = {};
  const all = judgeItems({ answers: [{ kind: "table", value: [{ table: huge }] }], report });
  assert.equal(all.length, 80);
  assert.equal(report.over, 11, "what did not fit was not counted");
  const none = {};
  judgeItems({ answers: [{ kind: "table", value: [{ table: designed }] }], report: none });
  assert.equal(none.over, undefined, "a list that fit counted something");
});

test("PIECE 5 — WHAT THE DATABASE REFUSED IS TOLD, EVERY ONE: a warning each, deduplicated, a fact each, in the note, on the record with its reason, and the part done in part; the reason never reaches the customer's facts", () => {
  const raw = [...REFUSED, REFUSED[0], null, { table: "", feature: "unique" }, { table: "pies", feature: "column", rule: "" }, { table: "pies", feature: "write", rule: "columns", why: "no declared columns" }];
  assert.deepEqual(refusedPieces(raw), [{ table: "dishes", piece: "column allergens" }, { table: "bookings", piece: "nooverlap" }, { table: "pies", piece: "write" }]);
  const w = warningReport({ refused: raw });
  assert.deepEqual(w, [{ what: "refused", name: "dishes", piece: "column allergens" }, { what: "refused", name: "bookings", piece: "nooverlap" }, { what: "refused", name: "pies", piece: "write" }]);
  const note = refusedNote(raw);
  for (const bit of ["the allergens column on dishes", SETTING_SAYS.nooverlap + " on bookings", "adding entries through the site on pies"]) assert.ok(note.includes(bit), note);
  const body = { ok: true, changed: ["src/routes/menu.tsx"], warningsTold: w };
  const f = facts(body);
  assert.ok(f.includes("not-done: The allergens column could not be added to the table dishes, so nothing can be kept in it yet."), JSON.stringify(f));
  assert.ok(f.includes("not-done: The table bookings could not be given " + SETTING_SAYS.nooverlap + ": the database refused it, so the table does not do that yet."), JSON.stringify(f));
  assert.ok(!f.some((t) => /integer columns|refused it\b.*because/.test(t) && t.includes("start and end")), "the database's reason reached the customer's facts");
  assert.deepEqual(notDoneOf(body, "addon").map((x) => [x.what, x.why]), [["dishes", "refused"], ["bookings", "refused"], ["pies", "refused"]]);
  const rec = requirementRecord({ refusedRules: REFUSED, judgeItemsOver: 4 });
  assert.deepEqual(rec.refusedRules, REFUSED);
  assert.equal(rec.judgeItemsOver, 4);
  assert.equal(requirementRecord({}).refusedRules, undefined);
});

test("PIECE 6 — THE ENGINE SAYS A COLUMN IT COULD NOT ADD: the failed ALTER joins its refusals with the table and the column, the columns beside it are added, and the apply goes on", async () => {
  const statements = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "";
    try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { /* not ours */ }
    if (q) statements.push(String(q));
    if (/^ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "(allergens|name)"/.test(String(q))) {
      return new Response(JSON.stringify({ message: "column refused", code: "XX000", severity: "ERROR" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  let made = null;
  try { made = await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", { tables: [SPEC.tables[0]] }); }
  finally { globalThis.fetch = real; }
  assert.ok(statements.length > 10, "the engine sent almost nothing — the fetch seam moved");
  const mine = ((made && made.refusedRules) || []).filter((r) => r && r.feature === "column");
  // EVERY ONE: two columns refused, two named.
  assert.deepEqual(mine.map((r) => [r.table, r.rule]), [["dishes", "name"], ["dishes", "allergens"]]);
  assert.match(String(mine[0].why), /column refused/);
  assert.ok(statements.some((q) => /^ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "price"/.test(q)), "the column beside it was not added");
  assert.ok(statements.some((q) => /GRANT/.test(q)), "the apply stopped at the refused column");
});

test("PIECE 7 — THROUGH THE ROUTE: a column the engine could not add to a table the site already has is told — the requirement resting on it as still to do, one naming the table whole as set up with the column missing, a warning and a fact of its own, the record keeping the database's reason, and the wire naming it without one", async () => {
  const MSG = "Add allergens to our dishes and show them on the menu page";
  const stored = { tables: [{ name: "dishes", access: "display", columns: [{ name: "name", type: "text" }, { name: "price", type: "text" }] }] };
  const r = await addon("rp-column", MSG, {
    kinds: ["table", "page"], publishes: true, stored, written: [writtenPage("/menu")],
    sqlFail: /^ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "allergens"/,
    answers: {
      table: {
        table: [{ table: { name: "dishes", access: "display", columns: [{ name: "name", type: "text" }, { name: "price", type: "text" }, { name: "allergens", type: "text" }] } }],
        requirements: [
          { need: "Each dish lists its allergens", status: "covered", item: "dishes", kind: "table", basis: "asked", words: MSG },
          { need: "The dishes stay listed", status: "covered", item: "dishes", kind: "table", basis: "asked", words: MSG },
        ],
      },
      page: { page: [{ path: "/menu", name: "Menu", purpose: "the menu", sections: ["a band"], components: ["section-header"] }] },
    },
    judge: ({ entries }) => ({
      verdicts: entries.map((e) => ({ id: e.id, follows: "asked", carried: "yes", by: [/allergens/.test(e.need) ? "table:dishes.allergens" : "table:dishes"], reason: "supplied" })),
    }),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  const told = (need) => (r.body.requirementsTold || []).find((o) => o.need === need);
  assert.equal(told("Each dish lists its allergens").told, "still-to-do", JSON.stringify(r.body.requirementsTold));
  // THIS CHANGE ALTERED THE TABLE, so a requirement it carries was set up by it.
  assert.deepEqual([told("The dishes stay listed").told, told("The dishes stay listed").partly], ["set-up", ["column allergens"]]);
  assert.ok((r.body.warningsTold || []).some((w) => w.what === "refused" && w.name === "dishes" && w.piece === "column allergens"), JSON.stringify(r.body.warningsTold));
  assert.deepEqual(r.body.refusedRules, [{ table: "dishes", feature: "column", rule: "allergens" }], "the wire did not name the refusal, or carried its reason");
  assert.match(r.body.coverNote, /the allergens column on dishes/);
  const f = facts(r.body);
  assert.ok(f.includes("not-done: The allergens column could not be added to the table dishes, so nothing can be kept in it yet."), JSON.stringify(f));
  const rec = storedAnswer(r, "rp-column");
  assert.ok(rec && rec.coverage, "no developer record");
  assert.equal(rec.coverage.refusedRules.length, 1);
  assert.equal(rec.coverage.refusedRules[0].rule, "allergens");
  assert.ok(typeof rec.coverage.refusedRules[0].why === "string" && rec.coverage.refusedRules[0].why, "the record lost the database's reason");
});

test("PIECE 8 — THROUGH THE ROUTE, WITH NO PAGE: every apply adds the stored tables' columns again, so a change that only adds a function still meets a stored column the database cannot add — named on its answer, warned of, and kept with the database's reason on the record", async () => {
  const MSG = "Count our dishes every night";
  const stored = { tables: [{ name: "dishes", access: "display", columns: [{ name: "name", type: "text" }, { name: "allergens", type: "text" }] }] };
  const r = await addon("rp-pageless", MSG, {
    kinds: ["function"], stored,
    sqlFail: /^ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "allergens"/,
    answers: { function: { function: [{ name: "count_dishes", internal: true, returns: "bigint", body: "SELECT count(*) FROM dishes" }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.deepEqual(r.body.refusedRules, [{ table: "dishes", feature: "column", rule: "allergens" }], JSON.stringify(r.body).slice(0, 600));
  assert.ok((r.body.warningsTold || []).some((w) => w.what === "refused" && w.piece === "column allergens"), JSON.stringify(r.body.warningsTold));
  const rec = storedAnswer(r, "rp-pageless");
  assert.equal(rec && rec.coverage && rec.coverage.refusedRules && rec.coverage.refusedRules[0].rule, "allergens");
});

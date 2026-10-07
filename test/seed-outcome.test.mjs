// WHAT HAPPENED TO EACH STARTER ROW, SAID FROM ONE RECORD (2026-10-07).
//
// Codex's review of the cleanup batch: a table whose rows ran past the limit
// AND whose every tried row was refused produced contradictory claims in both
// the fallback note (`seedSkipNote`) and the reply's facts (`addonReplyFacts`):
// "I put in only the first starter rows" beside "none of the starter rows went
// in". Exceeding a limit proves nothing about what went in.
//
// The engine (`seedSiteRows`) now records each table's designed rows by their
// place: which went in, which the database refused, which named none of the
// table's columns, and how many past the limit were never tried. The warning
// list, the fallback note and the facts all derive from that record
// (`builder/seed-rows.mjs`), so each table is one consistent account that keeps
// every row's identity — and the customer's explanation stays the reply
// model's, written from those facts.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY where a route runs: every model answer is the case's.
import test from "node:test";
import assert from "node:assert/strict";
import { seedSiteRows } from "../site-schema.mjs";
import { warningReport, seedSkipNote, replayedCoverNote, failureOutcome, addDirective, cleanAdd } from "../builder/site-add.mjs";
import { seedRowsOf, rowPlaces } from "../builder/seed-rows.mjs";
import { addonReplyFacts, warnedEntries } from "../builder/site-reply.mjs";
import { addon, writtenPage } from "./fixtures/addon-route.mjs";

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const SPEC = (name, access = "display") => ({ tables: [{ name, access, columns: [{ name: "dish", type: "text" }, { name: "price", type: "integer" }] }] });
const facts = (body) => (addonReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);
/** The engine against a database stand-in that refuses the rows `refuse` says, and starts every table empty. */
async function seedWith(spec, seed, refuse = () => false) {
  const tried = [];
  const sqlQuery = async (uuid, q, params = []) => {
    if (/^SELECT 1 FROM/i.test(q.trim())) return [];
    if (/^INSERT INTO/i.test(q.trim())) {
      tried.push(params);
      if (refuse(params, tried.length)) throw Object.assign(new Error("invalid input syntax for type integer"), { detail: "invalid input" });
      return [];
    }
    return [];
  };
  return { out: await seedSiteRows("u", spec, seed, { sqlQuery }), tried };
}
const dish = (n, price = n) => ({ dish: "Dish " + n, price });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/**
 * WHAT A TABLE'S ACCOUNT MUST CARRY, read from its record — the designed
 * count and every fate's places — never a sentence to match: the wording is
 * the writer's, the evidence is the record's.
 */
const evidence = (r) => [String(r.designed), ...[r.inserted, r.refused, r.unusable].filter((l) => l.length).map(rowPlaces), ...(r.unattempted ? [rowPlaces(range(r.cap + 1, r.cap + r.unattempted))] : [])];
const lacks = (text, r) => evidence(r).filter((e) => !String(text).includes(e));
/** The one fact told of a table's starter rows. */
const seedFact = (f, name) => f.filter((t) => t.startsWith("not-done: ") && t.includes(" " + name) && /starter rows/i.test(t));
/** A claim that rows went in when the record says none did: a count of rows going in, or the old "only the first". */
const claimsIn = (text) => /only the first|I put in only/i.test(text) || /\b[1-9]\d* went in\b/.test(text);

test("SEED-OUT 1 — EVERY TRIED ROW REFUSED AND ROWS PAST THE LIMIT, TOGETHER (Codex's combination): one account per table — none went in, which rows were refused, which were never tried — in the warnings, the facts and the fallback note; never \"only the first went in\"", async () => {
  const seed = { menu: Array.from({ length: 15 }, (_, i) => dish(i + 1)) };
  const { out } = await seedWith(SPEC("menu"), seed, () => true);
  assert.deepEqual(out.rows.menu, { designed: 15, cap: 12, inserted: [], refused: Array.from({ length: 12 }, (_, i) => i + 1), unusable: [], unattempted: 3 });
  // THE OLD STRINGS STAY ON THE DEVELOPER'S RECORD, beside the record.
  assert.ok(out.skipped.includes("menu: 3 starter rows past the first 12 were not put in"));
  assert.ok(out.skipped.includes("menu: none of its 12 starter rows went in"));
  const w = warningReport({ seedSkips: out.skipped, seedRows: out.rows });
  assert.deepEqual(w, [{ what: "seed", name: "menu", why: "rows", rows: out.rows.menu }], "the table was not told as one account: " + JSON.stringify(w));
  const f = facts({ ok: true, changed: ["src/routes/menu.tsx"], warningsTold: w });
  const one = seedFact(f, "menu");
  assert.equal(one.length, 1, "the table was not one account: " + JSON.stringify(f));
  assert.deepEqual(lacks(one[0], out.rows.menu), [], "the account left out evidence: " + one[0]);
  assert.ok(!f.some(claimsIn), "a limit was told as rows going in: " + JSON.stringify(f));
  assert.match(one[0], /\bnone\b/i, "none went in, and the account does not say so: " + one[0]);
  // THE FALLBACK NOTE, read from the same record: the same evidence, no claim of rows going in.
  const note = seedSkipNote(out.skipped, out.rows);
  assert.deepEqual(lacks(note, out.rows.menu), [], note);
  assert.ok(!claimsIn(note) && /\bnone\b/i.test(note), note);
  assert.equal(note.split("menu").length - 1, 1, "the table was told more than once: " + note);
});

test("SEED-OUT 2 — SOME IN, SOME REFUSED, SOME NAMING NO COLUMN, AND OVERFLOW, ALL IN ONE TABLE: every row accounted for by its place, once, and what went in counted from the rows that did", async () => {
  const rows = [dish(1), dish(2, "two"), { nothing: 1 }, dish(4), "not a row", dish(6, "six"), dish(7), dish(8), dish(9), dish(10), dish(11), dish(12), dish(13), dish(14)];
  const { out } = await seedWith(SPEC("menu"), { menu: rows }, (params) => typeof params[1] === "string");
  assert.deepEqual(out.rows.menu, { designed: 14, cap: 12, inserted: [1, 4, 7, 8, 9, 10, 11, 12], refused: [2, 6], unusable: [3, 5], unattempted: 2 });
  assert.equal(out.seeded.menu, 8);
  const w = warningReport({ seedSkips: out.skipped, seedRows: out.rows });
  assert.equal(w.length, 1, "the table was told more than once: " + JSON.stringify(w));
  const f = facts({ ok: true, changed: ["src/routes/menu.tsx"], warningsTold: w });
  const one = seedFact(f, "menu");
  assert.equal(one.length, 1, JSON.stringify(f));
  assert.deepEqual(lacks(one[0], out.rows.menu), [], "the account left out evidence: " + one[0]);
  assert.match(one[0], /\b8 went in\b/, "what went in is not counted from the rows that did: " + one[0]);
  assert.deepEqual(rowPlaces(out.rows.menu.inserted), "1, 4 and 7–12");
  // THE NOTE COUNTS WHAT WENT IN and names every row that did not, by its place.
  const note = seedSkipNote(out.skipped, out.rows);
  assert.deepEqual(lacks(note, { ...out.rows.menu, inserted: [] }), [], note);
  assert.match(note, /\b8 of the 14\b/, note);
  // EVERY ROW IN: nothing is said of the table at all.
  const clean = await seedWith(SPEC("menu"), { menu: [dish(1), dish(2)] });
  assert.deepEqual(warningReport({ seedSkips: clean.out.skipped, seedRows: clean.out.rows }), []);
  assert.equal(seedSkipNote(clean.out.skipped, clean.out.rows), "");
  // EVERY TRIED ROW IN, AND ROWS PAST THE LIMIT: the overflow alone is still told, by its places.
  const over = await seedWith(SPEC("menu"), { menu: range(1, 14).map((n) => dish(n)) });
  assert.deepEqual(over.out.rows.menu, { designed: 14, cap: 12, inserted: range(1, 12), refused: [], unusable: [], unattempted: 2 });
  const wo = warningReport({ seedSkips: over.out.skipped, seedRows: over.out.rows });
  assert.deepEqual(wo, [{ what: "seed", name: "menu", why: "rows", rows: over.out.rows.menu }], "rows past the limit went untold: " + JSON.stringify(wo));
  const fo = seedFact(facts({ ok: true, changed: ["src/routes/menu.tsx"], warningsTold: wo }), "menu");
  assert.equal(fo.length, 1);
  assert.deepEqual(lacks(fo[0], over.out.rows.menu), [], fo[0]);
  assert.deepEqual(lacks(seedSkipNote(over.out.skipped, over.out.rows), { ...over.out.rows.menu, inserted: [] }), []);
});

test("SEED-OUT 3 — EVERY ROW UNUSABLE, PLUS OVERFLOW: none went in because none named a column, and the rest were never tried — never \"the database refused\"; a table skipped whole keeps its own reason beside a recorded one", async () => {
  const { out } = await seedWith(SPEC("menu"), { menu: Array.from({ length: 13 }, () => ({ nothing: true })) });
  assert.deepEqual(out.rows.menu, { designed: 13, cap: 12, inserted: [], refused: [], unusable: Array.from({ length: 12 }, (_, i) => i + 1), unattempted: 1 });
  const f = facts({ ok: true, changed: ["src/routes/menu.tsx"], warningsTold: warningReport({ seedSkips: out.skipped, seedRows: out.rows }) });
  const one = seedFact(f, "menu");
  assert.equal(one.length, 1, JSON.stringify(f));
  assert.deepEqual(lacks(one[0], out.rows.menu), [], "the account left out evidence: " + one[0]);
  assert.ok(!claimsIn(one[0]), one[0]);
  assert.ok(!f.some((t) => /refused/.test(t)), "rows that named no column were told as refused: " + JSON.stringify(f));
  // A TABLE SKIPPED WHOLE (only display tables are seeded) has no record, and keeps its reason.
  const two = await seedWith({ tables: [...SPEC("menu").tables, { name: "orders", access: "collect", columns: [{ name: "email", type: "text" }] }] }, { menu: [dish(1), { nothing: 1 }], orders: [{ email: "a@b.c" }] });
  const w2 = warningReport({ seedSkips: two.out.skipped, seedRows: two.out.rows });
  assert.deepEqual(w2.map((x) => [x.name, x.why]), [["orders", "not-display"], ["menu", "rows"]]);
});

test("SEED-OUT 4 — A RECORD THAT DOES NOT ADD UP IS NEVER READ: a row in two fates, a missing row, or a wrong overflow count leaves the record out — the old strings speak, past the limit claims nothing went in — and a stored entry carrying such a record is cannot-tell", () => {
  const good = { designed: 3, cap: 12, inserted: [1], refused: [2], unusable: [3], unattempted: 0 };
  assert.ok(seedRowsOf({ t: good }).has("t"));
  for (const bad of [{ ...good, refused: [1] }, { ...good, unusable: [] }, { ...good, unattempted: 2 }, { ...good, inserted: [0] }, { ...good, unusable: [4] }, { ...good, designed: -1 }, { ...good, refused: "2" }]) {
    assert.equal(seedRowsOf({ t: bad }).has("t"), false, JSON.stringify(bad));
  }
  const skipped = ["t: 3 starter rows past the first 12 were not put in", "t: none of its 12 starter rows went in"];
  const w = warningReport({ seedSkips: skipped, seedRows: { t: { ...good, unattempted: 9 } } });
  assert.deepEqual(w.map((x) => x.why), ["over-cap", "none-went-in"]);
  const f = facts({ ok: true, changed: ["src/routes/x.tsx"], warningsTold: w });
  assert.ok(!f.some((t) => /Only the first|only the first/.test(t)), JSON.stringify(f));
  // THE LEGACY OVER-CAP ENTRY claims only that rows were not tried, nothing of rows going in.
  const over = f.filter((t) => t.startsWith("not-done: ") && t.includes(" t ") && /not tried/.test(t));
  assert.equal(over.length, 1, JSON.stringify(f));
  assert.ok(!/went in/.test(over[0]), over[0]);
  // A STORED ENTRY WHOSE RECORD DOES NOT READ: the whole list is cannot-tell, never a count.
  assert.equal(warnedEntries({ warningsTold: [{ what: "seed", name: "t", why: "rows", rows: { ...good, unattempted: 9 } }] }), null);
  assert.equal(rowPlaces([1, 2, 3, 5, 7, 8]), "1–3, 5, 7 and 8");
});

test("SEED-OUT 5 — A STORED ANSWER IS TOLD AS IT WAS STORED: a failed addition's note, replayed, says each table's rows from the record the answer carried", () => {
  const rows = { designed: 15, cap: 12, inserted: [], refused: Array.from({ length: 12 }, (_, i) => i + 1), unusable: [], unattempted: 3 };
  const stored = { ok: false, error: "compile", msg: "That didn't compile.", outcome: failureOutcome({ database: "applied", made: { tables: ["menu"] } }), warningsTold: [{ what: "seed", name: "menu", why: "rows", rows }] };
  const note = replayedCoverNote(stored);
  assert.deepEqual(lacks(note, rows), [], note);
  assert.ok(!claimsIn(note) && /\bnone\b/i.test(note), note);
});

test("SEED-OUT 6 — THROUGH THE ROUTE: a list whose every tried row is refused and whose rows run past the limit is one account on the answer, in its facts and on the screen", async () => {
  const r = await addon("so-route", "add a menu of fifteen dishes", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/menu")], rowFail: /^menu$/,
    answers: {
      table: { table: [{ table: { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] }, seed: Array.from({ length: 15 }, (_, i) => ({ dish: "Dish " + (i + 1) })) }] },
      page: { page: [PAGE("/menu", "Menu")] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  const rows = { designed: 15, cap: 12, inserted: [], refused: Array.from({ length: 12 }, (_, i) => i + 1), unusable: [], unattempted: 3 };
  assert.deepEqual(r.body.seedRows, { menu: rows });
  assert.deepEqual(r.body.warningsTold.filter((w) => w.what === "seed"), [{ what: "seed", name: "menu", why: "rows", rows }]);
  const f = facts(r.body);
  const one = seedFact(f, "menu");
  assert.equal(one.length, 1, JSON.stringify(f));
  assert.deepEqual(lacks(one[0], rows), [], "the account left out evidence: " + one[0]);
  assert.ok(!f.some(claimsIn), JSON.stringify(f));
  const note = String(r.body.coverNote || r.body.msg || "");
  assert.deepEqual(lacks(note, rows), [], note);
  assert.ok(!claimsIn(note), note);
});

test("SEED-OUT 7 — THROUGH THE ROUTE, EVERY ROW KEEPS THE PLACE THE DESIGN GAVE IT: a malformed row, a refused row, rows in and rows past the limit, together — the cleaner no longer drops or cuts rows before the engine can account for them", async () => {
  const design = [dish(1), "not a row", dish(3), ...range(4, 14).map((n) => dish(n))];
  const refuse = (q, params) => (/^INSERT INTO "menu"/i.test(q.trim()) && params.includes("Dish 3")
    ? new Response(JSON.stringify({ message: "invalid input syntax for type integer", code: "22P02" }), { status: 400, headers: { "content-type": "application/json" } })
    : null);
  const r = await addon("so-places", "add a menu of fourteen dishes", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/menu")], db: { answer: refuse },
    answers: {
      table: { table: [{ table: { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }, { name: "price", type: "integer" }] }, seed: design }] },
      page: { page: [PAGE("/menu", "Menu")] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  const rows = { designed: 14, cap: 12, inserted: [1, ...range(4, 12)], refused: [3], unusable: [2], unattempted: 2 };
  assert.deepEqual(r.body.seedRows, { menu: rows }, "a row lost the place the design gave it");
  assert.deepEqual(r.body.warningsTold.filter((w) => w.what === "seed"), [{ what: "seed", name: "menu", why: "rows", rows }]);
  const one = seedFact(facts(r.body), "menu");
  assert.equal(one.length, 1, JSON.stringify(facts(r.body)));
  assert.deepEqual(lacks(one[0], rows), [], one[0]);
  const note = String(r.body.coverNote || r.body.msg || "");
  assert.deepEqual(lacks(note, { ...rows, inserted: [] }), [], note);
  // EVERY ROW IN: the route says nothing of the table's rows.
  const clean = await addon("so-clean", "add a menu of two dishes", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/menu")],
    answers: {
      table: { table: [{ table: { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] }, seed: [{ dish: "A" }, { dish: "B" }] }] },
      page: { page: [PAGE("/menu", "Menu")] },
    },
  });
  assert.equal(clean.body.ok, true);
  assert.deepEqual((clean.body.warningsTold || []).filter((w) => w.what === "seed"), []);
});

test("SEED-OUT 8 — THE PAGE WRITER IS TOLD THE ROWS THE ENGINE WILL TRY: within the ceiling and rows at all, never the design's whole list", () => {
  const DB = { tables: [], rowTables: new Map(), backend: "ready" };
  const design = [...range(1, 5).map((n) => dish(n)), "not a row", ...range(7, 15).map((n) => dish(n))];
  const c = cleanAdd("table", { table: { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] }, seed: design }, DB);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(c.value[0].seed.length, 15, "the design's rows were cut before the engine");
  const brief = String(addDirective("table", c.value[0], DB));
  // Rows 1–12 of the design, less the one that is not a row: 11 the engine will try.
  assert.match(brief, /\bwith 11 starter rows\b/, brief);
  const none = String(addDirective("table", { ...c.value[0], seed: ["x", 3] }, DB));
  assert.doesNotMatch(none, /starter rows/, none);
});

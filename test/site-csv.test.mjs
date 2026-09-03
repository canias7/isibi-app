// A spreadsheet into the owner's own table — the reader, driven.
//
// The parser and the cell rules are decisions, and every one of them is a way
// a real export can go wrong: Excel's semicolons, a quoted address with a
// comma in it, a BOM, a blank trailing line, "1/2/2026". Each is a case here
// rather than a comment, so a future "simplification" of the state machine
// meets the file it would break.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCsv, sniffDelimiter, headerKey, coerceCell, importPlan,
  MAX_IMPORT_ROWS, MAX_IMPORT_COLS, IMPORT_BATCH, MAX_IMPORT_BYTES,
} from "../site-csv.mjs";

// ── the parser ───────────────────────────────────────────────────────────────

test("a plain file: header line, then rows, as strings", () => {
  const p = parseCsv("title,price\nCut,25\nShave,18\n");
  assert.equal(p.error, null);
  assert.deepEqual(p.headers, ["title", "price"]);
  assert.deepEqual(p.rows, [["Cut", "25"], ["Shave", "18"]]);
  assert.equal(p.truncated, 0);
});

test("CRLF, a bare CR, and a BOM are all the same file", () => {
  const lf = parseCsv("a,b\n1,2\n3,4");
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n3,4\r\n").rows, lf.rows);
  assert.deepEqual(parseCsv("a,b\r1,2\r3,4").rows, lf.rows);
  const bom = parseCsv("﻿a,b\n1,2");
  assert.deepEqual(bom.headers, ["a", "b"], "the BOM became part of the first header");
});

test("quotes: a comma inside, a doubled quote, and a line break inside", () => {
  const p = parseCsv('name,address\n"Ada, Countess","12 ""The"" Lane\nSheffield"\n');
  assert.deepEqual(p.rows, [["Ada, Countess", '12 "The" Lane\nSheffield']]);
});

test("Excel's semicolons and a tab-separated export are read as what they are", () => {
  assert.equal(sniffDelimiter("a;b;c"), ";");
  assert.equal(sniffDelimiter("a\tb\tc"), "\t");
  assert.equal(sniffDelimiter('"a;b",c'), ",", "a semicolon inside quotes does not vote");
  assert.equal(sniffDelimiter("a,b;c"), ",", "a tie goes to the comma");
  assert.deepEqual(parseCsv("title;price\nCut;25").rows, [["Cut", "25"]]);
  assert.deepEqual(parseCsv("title\tprice\nCut\t25").rows, [["Cut", "25"]]);
});

test("blank lines are skipped, not read as empty rows", () => {
  const p = parseCsv("a,b\n\n1,2\n\n\n3,4\n\n");
  assert.deepEqual(p.rows, [["1", "2"], ["3", "4"]]);
});

test("an unclosed quote is the one thing the file cannot recover from", () => {
  const p = parseCsv('a,b\n"open,2\n3,4');
  assert.equal(p.error, "unterminated quote");
  assert.deepEqual(p.rows, []);
});

test("nothing at all is 'no header', not a crash", () => {
  for (const t of ["", "\n\n", "﻿", null, undefined]) assert.equal(parseCsv(t).error, "no header", JSON.stringify(t));
});

test("rows past the cap are COUNTED, never silently dropped", () => {
  const lines = ["n"];
  for (let i = 0; i < 12; i++) lines.push(String(i));
  const p = parseCsv(lines.join("\n"), { maxRows: 10 });
  assert.equal(p.rows.length, 10);
  assert.equal(p.truncated, 2);
  assert.equal(MAX_IMPORT_ROWS, 5000);
});

test("columns past the cap are dropped per row, and the cap is the row's own", () => {
  const p = parseCsv("a,b,c,d\n1,2,3,4", { maxCols: 2 });
  assert.deepEqual(p.headers, ["a", "b"]);
  assert.deepEqual(p.rows, [["1", "2"]]);
  assert.equal(MAX_IMPORT_COLS, 60, "the same ceiling pickWritable puts on a row");
});

test("the batch and the byte cap are what the route and the reply promise", () => {
  assert.equal(IMPORT_BATCH, 100);
  assert.equal(MAX_IMPORT_BYTES, 2 * 1024 * 1024);
});

// ── headers ──────────────────────────────────────────────────────────────────

test("a spreadsheet's 'Customer Name' is the table's customer_name", () => {
  for (const h of ["Customer Name", "customer name", " CUSTOMER-NAME ", "customer_name", "Customer  Name"]) {
    assert.equal(headerKey(h), "customer_name", JSON.stringify(h));
  }
});

// ── cells ────────────────────────────────────────────────────────────────────

test("an empty cell is NULL whatever the column is", () => {
  for (const t of ["text", "integer", "numeric", "boolean", "json", "date", "uuid", "timestamptz", "whatever"]) {
    assert.deepEqual(coerceCell("", t, "c"), { value: null }, t);
    assert.deepEqual(coerceCell("   ", t, "c"), { value: null }, t);
  }
});

test("text is trimmed of outer whitespace and nothing else", () => {
  assert.deepEqual(coerceCell("  Ada  Lovelace ", "text", "name"), { value: "Ada  Lovelace" });
  assert.deepEqual(coerceCell("x", "sometype", "c"), { value: "x" }, "an unknown type is text");
});

test("whole numbers: read, refused, and kept as digits past 2^53", () => {
  assert.deepEqual(coerceCell("25", "integer", "price"), { value: 25 });
  assert.deepEqual(coerceCell("-3", "int", "n"), { value: -3 });
  assert.deepEqual(coerceCell("99999999999999999999", "bigint", "n"), { value: "99999999999999999999" });
  assert.deepEqual(coerceCell("25.5", "integer", "price"), { error: "price is not a whole number" });
  assert.deepEqual(coerceCell("£25", "integer", "price"), { error: "price is not a whole number" });
});

test("decimals", () => {
  assert.deepEqual(coerceCell("25.50", "numeric", "price"), { value: 25.5 });
  assert.deepEqual(coerceCell(".5", "real", "x"), { value: 0.5 });
  assert.deepEqual(coerceCell("1e3", "numeric", "x"), { value: 1000 });
  assert.deepEqual(coerceCell("25,50", "numeric", "price"), { error: "price is not a number" });
});

test("yes/no words are booleans; anything else is refused by name", () => {
  for (const w of ["true", "Yes", "y", "1", "ON"]) assert.deepEqual(coerceCell(w, "boolean", "paid"), { value: true }, w);
  for (const w of ["false", "No", "n", "0", "off"]) assert.deepEqual(coerceCell(w, "bool", "paid"), { value: false }, w);
  assert.deepEqual(coerceCell("maybe", "boolean", "paid"), { error: "paid is not yes or no" });
});

test("json is re-serialised so it is stored the way pickWritable stores an object", () => {
  assert.deepEqual(coerceCell('{"a": 1}', "json", "meta"), { value: '{"a":1}' });
  assert.deepEqual(coerceCell("[1, 2]", "jsonb", "tags"), { value: "[1,2]" });
  assert.deepEqual(coerceCell("not json", "json", "meta"), { error: "meta is not valid JSON" });
});

test("dates: ISO as is, day-first slashes converted, and never month-first", () => {
  assert.deepEqual(coerceCell("2026-09-03", "date", "day"), { value: "2026-09-03" });
  assert.deepEqual(coerceCell("3/9/2026", "date", "day"), { value: "2026-09-03" }, "3 September, not 9 March");
  assert.deepEqual(coerceCell("03.09.2026", "date", "day"), { value: "2026-09-03" });
  assert.deepEqual(coerceCell("September 3", "date", "day"), { error: "day is not a date (YYYY-MM-DD)" });
});

test("a date and time is normalised to ISO; an id is a UUID", () => {
  assert.deepEqual(coerceCell("2026-09-03T09:00:00Z", "timestamptz", "at"), { value: "2026-09-03T09:00:00.000Z" });
  assert.deepEqual(coerceCell("nope", "timestamptz", "at"), { error: "at is not a date and time" });
  assert.deepEqual(coerceCell("6BA7B810-9DAD-11D1-80B4-00C04FD430C8", "uuid", "ref"), { value: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" });
  assert.deepEqual(coerceCell("12", "uuid", "ref"), { error: "ref is not an id" });
});

// ── the plan ─────────────────────────────────────────────────────────────────

const COLS = [{ name: "title", type: "text" }, { name: "price", type: "integer" }, { name: "on_menu", type: "boolean" }];

test("headers match columns case- and space-insensitively; strangers are ignored and named", () => {
  const plan = importPlan(COLS, parseCsv("Title,Price,Notes,ON MENU\nCut,25,walk-in,yes"));
  assert.deepEqual(plan.columns.map((c) => c.name), ["title", "price", "on_menu"]);
  assert.deepEqual(plan.columns.map((c) => c.index), [0, 1, 3], "the file's own positions");
  assert.deepEqual(plan.ignored, ["Notes"]);
  assert.deepEqual(plan.rows, [{ line: 2, values: ["Cut", 25, true] }]);
  assert.deepEqual(plan.skipped, []);
});

test("two headers naming one column keep the first", () => {
  const plan = importPlan(COLS, parseCsv("title,TITLE\nCut,Shave"));
  assert.deepEqual(plan.columns.map((c) => c.index), [0]);
  assert.deepEqual(plan.ignored, ["TITLE"]);
  assert.deepEqual(plan.rows[0].values, ["Cut"]);
});

test("a row with a cell the column cannot take is skipped BY LINE NUMBER, and the rest go on", () => {
  // The header is line 1, so the first row is line 2 — the number the owner
  // can find in their spreadsheet.
  const plan = importPlan(COLS, parseCsv("title,price\nCut,25\nShave,eighteen\nBeard,12"));
  assert.deepEqual(plan.rows.map((r) => r.line), [2, 4]);
  assert.deepEqual(plan.skipped, [{ line: 3, reason: "price is not a whole number" }]);
});

test("a row empty in every matched column is skipped rather than written as NULLs", () => {
  const plan = importPlan(COLS, parseCsv("title,price,notes\n,,something\nCut,25,"));
  assert.deepEqual(plan.rows.map((r) => r.line), [3]);
  assert.deepEqual(plan.skipped, [{ line: 2, reason: "nothing in any of the table's columns" }]);
});

test("a short row reads its missing cells as empty", () => {
  const plan = importPlan(COLS, parseCsv("title,price,on_menu\nCut"));
  assert.deepEqual(plan.rows, [{ line: 2, values: ["Cut", null, null] }]);
});

test("no header matches at all is an empty plan, which the route turns into a sentence", () => {
  const plan = importPlan(COLS, parseCsv("name,cost\nCut,25"));
  assert.deepEqual(plan.columns, []);
  assert.deepEqual(plan.ignored, ["name", "cost"]);
  assert.deepEqual(plan.rows, [], "nothing can be written when nothing matched");
});

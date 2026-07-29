// The schema parser and the identifier guard.
//
// `normalizeSchema` turns what the model emitted into what the database will
// enforce. Every declaration it drops is dropped SILENTLY — the build succeeds,
// the site works, and the guarantee is simply not there. Lose `noOverlap` and
// the barber takes two people for the same chair; lose `unique` and duplicates
// land; lose `maxRows` and a table grows without bound. Nothing surfaces until
// it has already happened to a real customer.
//
// It is also the least reviewable code in the repo — one function of inline
// ternaries — which is exactly why it needs tests rather than reading.
//
// `sqlIdent` is the other half: every table and column name reaching SQL goes
// through it, so it is the boundary between "allow-listed identifier" and
// injection.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSchema, sqlIdent } from "../site-schema.mjs";
import fs from "node:fs";

const one = (def) => normalizeSchema({ tables: [{ name: "t", ...def }] }).tables[0];

// ------------------------------------------------------------- sqlIdent

test("accepts ordinary identifiers", () => {
  for (const n of ["services", "customer_email", "_private", "T2", "a"]) {
    assert.equal(sqlIdent(n), '"' + n + '"', n);
  }
});

test("refuses anything that could break out of an identifier", () => {
  for (const bad of [
    'a"; DROP TABLE users; --',
    'a"b',
    "a'b",
    "a b",
    "a;b",
    "a-b",
    "a.b",
    "a(b)",
    "1abc",        // leading digit
    "",
    "   ",
    null,
    undefined,
    "ünïcode",
    "a\nb",
    "a\\b",
    "a".repeat(42), // over the 41-char bound
  ]) {
    assert.throws(() => sqlIdent(bad), /bad identifier/, JSON.stringify(bad));
  }
});

test("the length bound is exact", () => {
  assert.equal(sqlIdent("a".repeat(41)), '"' + "a".repeat(41) + '"');
  assert.throws(() => sqlIdent("a".repeat(42)), /bad identifier/);
});

// ------------------------------------------------- access, the one that leaks

test("the five access levels survive", () => {
  for (const access of ["collect", "display", "user", "feed", "admin"]) {
    assert.equal(one({ access }).access, access);
  }
});

test("an unrecognised access level falls back to collect, not display", () => {
  // The safe direction. `collect` is write-only, so a typo makes the table
  // unreadable — visibly broken — rather than publishing rows that were meant to
  // be private. Getting this backwards would leak submissions.
  for (const access of ["public", "Display", "readonly", "", null, undefined, 1, {}]) {
    assert.equal(one({ access }).access, "collect", JSON.stringify(access));
  }
});

// --------------------------------------- guarantees whose loss is invisible

test("noOverlap survives, because losing it means double bookings", () => {
  const t = one({ noOverlap: { start: "starts_at", end: "ends_at", on: ["staff_id"] } });
  assert.deepEqual(t.noOverlap, { start: "starts_at", end: "ends_at", on: ["staff_id"], where: null });
});

test("noOverlap is refused rather than half-applied", () => {
  // A half-parsed exclusivity rule that silently does nothing is worse than an
  // obvious absence: the booking form looks like it is protected.
  for (const bad of [
    { start: "starts_at" },                          // no end
    { end: "ends_at" },                              // no start
    { start: "a b", end: "ends_at" },                // not an identifier
    { start: "same", end: "same" },                  // identical columns
    "noOverlap", [], 1, true,
  ]) {
    assert.equal(one({ noOverlap: bad }).noOverlap, null, JSON.stringify(bad));
  }
});

test("its aliases are honoured", () => {
  // The model does not always pick the documented spelling.
  const want = { start: "a", end: "b", on: [], where: null };
  assert.deepEqual(one({ noDoubleBooking: { start: "a", end: "b" } }).noOverlap, want);
  assert.deepEqual(one({ exclusive: { start: "a", end: "b" } }).noOverlap, want);
});

test("maxRows survives and is bounded", () => {
  assert.equal(one({ maxRows: 500 }).maxRows, 500);
  assert.equal(one({ cap: "250" }).maxRows, 250);
  assert.equal(one({ maxRows: 99_999_999 }).maxRows, 10_000_000, "clamped, not honoured verbatim");
  for (const bad of [0, -5, "lots", null, undefined, NaN]) {
    assert.equal(one({ maxRows: bad }).maxRows, 0, String(bad));
  }
});

test("boolean feature flags survive", () => {
  assert.equal(one({ trash: true }).trash, true);
  assert.equal(one({ fts: true }).fts, true);
  assert.equal(one({ timestamps: true }).timestamps, true);
  assert.equal(one({ ordered: true }).ordered, true);
  assert.equal(one({}).trash, false);
  assert.equal(one({}).fts, null);
});

test("fts accepts a column list as well as a flag", () => {
  assert.deepEqual(one({ fts: ["title", "body"] }).fts, ["title", "body"]);
  assert.equal(one({ fts: ["bad name"] }).fts, null, "an unusable column list is not a silent true");
});

// ------------------------------------------------------------- columns

test("columns are accepted as strings or objects", () => {
  assert.deepEqual(one({ columns: ["title", "price"] }).columns.map((c) => c.name), ["title", "price"]);
  assert.deepEqual(one({ columns: [{ name: "title", type: "text" }] }).columns[0], { ...one({ columns: [{ name: "title", type: "text" }] }).columns[0], name: "title", type: "text" });
});

test("columns can arrive as an object map", () => {
  const t = normalizeSchema({ tables: { t: { access: "display", columns: { title: "text", price: "real" } } } }).tables[0];
  assert.deepEqual(t.columns.map((c) => [c.name, c.type]), [["title", "text"], ["price", "real"]]);
});

test("a column with no name is dropped, not carried as undefined", () => {
  const t = one({ columns: ["ok", null, 42, {}, { type: "text" }, { name: "fine" }] });
  assert.deepEqual(t.columns.map((c) => c.name), ["ok", "fine"]);
});

test("column aliases the model actually emits are understood", () => {
  const c = one({ columns: [{ name: "email", required: true, maxLength: 120, references: "users" }] }).columns[0];
  assert.equal(c.notnull, true, "required → notnull");
  assert.equal(c.max, 120, "maxLength → max");
  assert.equal(c.ref, "users", "references → ref");
});

test("the field list is read under any of its names", () => {
  for (const key of ["columns", "fields", "cols", "schema"]) {
    const t = one({ [key]: ["title"] });
    assert.deepEqual(t.columns.map((c) => c.name), ["title"], key);
  }
});

// ------------------------------------------------------------- shape

test("tables arrive as an array or an object map", () => {
  assert.deepEqual(normalizeSchema({ tables: [{ name: "a" }, { name: "b" }] }).tables.map((t) => t.name), ["a", "b"]);
  assert.deepEqual(normalizeSchema({ tables: { a: {}, b: {} } }).tables.map((t) => t.name), ["a", "b"]);
  assert.deepEqual(normalizeSchema({ a: {}, b: {} }).tables.map((t) => t.name), ["a", "b"], "a bare map is also accepted");
});

test("junk in, empty out — never a throw", () => {
  // This runs on model output inside a route that has already spent money and
  // provisioned a database. A parser crash there is a 500 on a paid build.
  for (const bad of [null, undefined, "text", 42, [], { tables: null }, { tables: "x" },
    { tables: [null, 7, "x", {}] }, { tables: [{ name: "" }] }]) {
    const r = normalizeSchema(bad);
    assert.ok(Array.isArray(r.tables), JSON.stringify(bad));
  }
});

test("a nameless table is dropped", () => {
  assert.deepEqual(normalizeSchema({ tables: [{ columns: ["a"] }, { name: "keeper" }] }).tables.map((t) => t.name), ["keeper"]);
});

test("per-app rate limits are parsed and clamped", () => {
  assert.deepEqual(normalizeSchema({ tables: [], rateLimits: 100 }).rateLimits, { read: 100, write: 100 });
  assert.deepEqual(normalizeSchema({ tables: [], rateLimits: { read: 5, write: 2 } }).rateLimits, { read: 5, write: 2 });
  assert.equal(normalizeSchema({ tables: [] }).rateLimits, undefined, "absent means platform defaults");
});

// ------------------------------------------------- the PII projection

test("publicView never exposes id or owner_id, whatever it asks for", () => {
  // It is a read-only projection of an OWNER-SCOPED table, readable by anyone.
  // Letting owner_id through would tie every public row to a real account.
  const t = one({ publicView: { columns: ["starts_at", "owner_id", "id", "ends_at"] } });
  assert.deepEqual(t.publicView.columns, ["starts_at", "ends_at"]);
});

test("a publicView with nothing safe left is null, not empty", () => {
  // An empty allow-list must not read as "no filter".
  assert.equal(one({ publicView: { columns: ["id", "owner_id"] } }).publicView, null);
  assert.equal(one({ publicView: { columns: [] } }).publicView, null);
  assert.equal(one({ publicView: {} }).publicView, null);
});

// ═══════════════════════════════ the constraints the designer can now declare
//
// All four are enforced by real Postgres constraints and have been since the
// schema engine was written — and until 2026-07-28 the design_schema tool could
// emit NONE of them, so no generated site had one. Measured live that day: two
// customers booked the same 14:00 slot on a generated barber shop and both were
// accepted. These assert the declarations survive parsing, because a value
// dropped here is a constraint that silently never exists.

test("a unique group survives parsing, in every shape the tool allows", () => {
  const spec = normalizeSchema({ tables: [
    { name: "bookings", access: "collect", columns: [{ name: "d" }, { name: "t" }, { name: "status" }],
      unique: [["d", "t"]] },
    { name: "partial", access: "collect", columns: [{ name: "d" }, { name: "status" }],
      unique: [{ columns: ["d"], where: "status:eq:confirmed" }] },
  ] });
  assert.deepEqual(spec.tables[0].unique, [["d", "t"]]);
  assert.deepEqual(spec.tables[1].unique, [{ columns: ["d"], where: "status:eq:confirmed" }],
    "the partial form is what stops a CANCELLED booking holding the slot forever");
});

test("uniqueCI and maxRows survive parsing", () => {
  const spec = normalizeSchema({ tables: [
    { name: "signups", access: "collect", columns: [{ name: "email" }], uniqueCI: ["email"], maxRows: 20 },
  ] });
  assert.deepEqual(spec.tables[0].uniqueCI, ["email"]);
  assert.equal(spec.tables[0].maxRows, 20);
});

test("noOverlap survives parsing with its scope columns", () => {
  const spec = normalizeSchema({ tables: [
    { name: "slots", access: "collect", columns: [{ name: "day" }, { name: "start_min", type: "integer" }, { name: "end_min", type: "integer" }],
      noOverlap: { start: "start_min", end: "end_min", on: ["day"] } },
  ] });
  assert.deepEqual(spec.tables[0].noOverlap, { start: "start_min", end: "end_min", on: ["day"], where: null });
});

test("a nonsense constraint is dropped rather than half-applied", () => {
  // A malformed declaration must not become a constraint that half-exists.
  const spec = normalizeSchema({ tables: [
    { name: "t", access: "collect", columns: [{ name: "a" }],
      noOverlap: { start: "same", end: "same" }, maxRows: -5 },
  ] });
  assert.equal(spec.tables[0].noOverlap, null, "start and end may not be the same column");
  assert.equal(spec.tables[0].maxRows, 0, "a negative cap is no cap, not a locked table");
});

test("teamRead survives parsing, and the designer can now ask for it", () => {
  // Enforced in site-data.mjs since 2026-07-28: a `user` table with teamRead
  // shows a manager their reports' rows as well as their own. It had been
  // parsed and stored in _meta since the engine was written with nothing
  // reading it — and even now that it is enforced it would be unreachable if
  // the designer's tool could not emit it, which is how `unique` spent months
  // fully implemented and never once declared.
  const spec = normalizeSchema({ tables: [
    { name: "deals", access: "user", teamRead: true, columns: [{ name: "value" }] },
  ] });
  assert.equal(spec.tables[0].teamRead, true);

  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf('name: "design_schema"');
  assert.ok(i > 0, "the designer tool must exist");
  const tool = src.slice(i, i + 12000);
  assert.match(tool, /teamRead: \{/, "the designer must be able to declare teamRead or no site can ever have it");
});

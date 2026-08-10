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


// ------------- every flag the DDL acts on must survive the normaliser
//
// `normalizeSchema` is an ALLOW-LIST: `coerceTable` builds its output field by
// field, so a table property nobody added to that literal is dropped, silently,
// on every build. `teamScope` was exactly that until 2026-07-29 — declarable by
// the designer, given a `team_id INTEGER` column by `applySiteSchema`, stored in
// `_meta`, read by the data path, and **stripped by the one function every
// schema passes through** before any of that could see it. It made the fifth
// layer that feature has been dead at, and the production audit is what found
// it: a generated row came back with no `team_id` column at all.
//
// Derived at both ends. The read side is scanned out of `applySiteSchema`, so a
// flag added to the DDL and forgotten here fails immediately; the write side is
// the real function's real output, so this cannot pass on a literal that only
// LOOKS right.
test("every table flag applySiteSchema reads survives normalizeSchema", () => {
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const apply = src.slice(src.indexOf("export async function applySiteSchema"));
  assert.ok(apply.length > 1000, "applySiteSchema was not found to scan");

  // What the DDL reads off a table definition.
  const reads = [...new Set([...apply.matchAll(/\bt\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]))].sort();
  assert.ok(reads.includes("teamScope"), "applySiteSchema must read teamScope, or this test is watching nothing");

  // What the normaliser actually produces. Key PRESENCE is the invariant, not
  // the value: every entry in the literal assigns its key even when the
  // coercion returns null, so a missing key means the field was never carried.
  const out = normalizeSchema({ tables: [{ name: "t", access: "user", columns: ["a"] }] }).tables[0];
  const missing = reads.filter((f) => !(f in out));
  assert.deepEqual(missing, [],
    "applySiteSchema reads " + missing.join(", ") + " and normalizeSchema does not emit it — " +
    "the declaration is dropped on every build, the build succeeds, and the guarantee simply is not there");
});

// ------------------------------------------------- owner_id is a uuid, in BOTH places
//
// `owner_id` was INTEGER because it referenced a hand-rolled `_users` whose ids
// were sequential integers. Identity is Neon Auth's as of 2026-07-30 and
// `neon_auth."user".id` is a `uuid` — measured against a real project, and not
// what this repo's own notes predicted (they said text, and named a table that
// does not exist).
//
// The reason this is a test and not just an edit: the type appears TWICE, in the
// CREATE and in the schema-evolution ALTER, and `ADD COLUMN IF NOT EXISTS` does
// not change the type of a column that is already there. So a CREATE saying uuid
// and an ALTER saying integer is not a compile error, not a runtime error on a
// fresh site, and a silent wrong type on every revised one. Derived from the
// source at both ends rather than asserting the string twice.
test("owner_id is declared uuid in the CREATE and the ALTER, and they agree", () => {
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  // Every type this file ever gives owner_id, wherever it says it. Anchored to
  // real type tokens rather than \w+, because `"owner_id" IS NOT DISTINCT FROM`
  // appears in two trigger predicates and a loose pattern reads "IS" as a type.
  const TYPE = "UUID|INTEGER|BIGINT|TEXT|REAL|NUMERIC|BYTEA|BOOLEAN|SERIAL";
  const decls = [...src.matchAll(new RegExp('"owner_id"\\s+(' + TYPE + ')\\b', "g"))].map((m) => m[1]);
  // At least two: the CREATE and the schema-evolution ALTER. This is the half
  // that makes it a two-ended guard — with one site found, "they agree" is
  // vacuous and the ALTER could say anything.
  assert.ok(decls.length >= 2,
    "expected owner_id declared in both the CREATE and the ALTER; found " + decls.length);
  assert.deepEqual([...new Set(decls)], ["UUID"],
    "owner_id must be UUID in every declaration; found " + [...new Set(decls)].join(", ") +
    " — a CREATE and an ALTER that disagree leave every REVISED site with the old type, silently");

  // The audit log's actor IS an owner_id, so it moves with it or a trigger
  // writing NEW."owner_id" into it fails on type at insert time.
  const actor = [...new Set([...src.matchAll(/actor_id\s+([A-Z]+)/g)].map((m) => m[1]))];
  assert.deepEqual(actor, ["UUID"], "_audit.actor_id stores an owner_id, so it must be the same type");

  // And nothing may still be stamping the old integer team column: `teamScope`
  // is undeclarable now, and Neon Auth's teams are uuid-keyed, so an INTEGER
  // team_id would be the wrong shape to leave lying around.
  assert.ok(!/"team_id"\s+INTEGER/.test(src),
    "team_id INTEGER is the pre-Neon-Auth shape; teams get rebuilt on organization/member, which are uuid keyed");
});


test("the normaliser carries read and write through", () => {
  // `coerceTable` builds its output field by field, so anything not named in
  // that literal is dropped SILENTLY on every build — the failure that left
  // `teamScope` declarable, DDL'd, stored and stripped for months. A mutation
  // removing these two survived the whole suite: the pair-declared table simply
  // became `collect`, which reads nothing, so the site looked merely broken.
  const n = normalizeSchema({ tables: [
    { name: "listings", read: "public", write: "own", columns: [{ name: "title", type: "text" }] },
    { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] },
  ] });
  const by = Object.fromEntries(n.tables.map((t) => [t.name, t]));
  assert.equal(by.listings.read, "public", "the read axis was dropped by the normaliser");
  assert.equal(by.listings.write, "own", "the write axis was dropped by the normaliser");
  // A preset-declared table carries no pair, and must not be given one here —
  // `resolveAccess` is the single place that decides what an absent half means.
  assert.equal(by.menu.read, undefined);
  assert.equal(by.menu.write, undefined);
  assert.equal(by.menu.access, "display");
});

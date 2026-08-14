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
  assert.equal(one({}).fts, null);
});

test("THE POLICY FLAGS TELL ABSENT FROM EXPLICITLY-OFF — retiredOf's contract, generalised", () => {
  // 2026-08-14 audit. `!!()` collapsed an OMITTED flag to `false`, and `false`
  // is a value the absent-means-unchanged merge keeps — so a build-revise
  // re-declaring a table without restating expires/scheduled/teamScope/trash
  // recorded them as CLEARED and rebuilt the read policy without their
  // clauses: team members lost each other's rows, expired offers reappeared,
  // scheduled posts went public early.
  for (const flag of ["trash", "expires", "scheduled", "teamScope"]) {
    assert.equal(one({ [flag]: true })[flag], true, flag);
    // An explicit false still clears — that IS the removal verb, exactly
    // `retired`'s contract.
    assert.equal(one({ [flag]: false })[flag], false, flag + " explicit false must survive as false");
    // Absent is UNDEFINED, so the merge can read silence as silence. Every
    // consumer tests these by truthiness, so undefined behaves as false
    // everywhere else.
    assert.equal(one({})[flag], undefined, flag + " absent must be undefined, not false");
  }
  // The aliases carry the same distinction — an aliased declaration is a
  // declaration.
  assert.equal(one({ ttl: true }).expires, true);
  assert.equal(one({ publishable: false }).scheduled, false);
});

test("A BARE RE-DECLARATION KEEPS ITS POLICY CLAUSES — proven through the real policiesFor", async () => {
  // The whole chain, by composition, because applySiteSchema needs a live
  // database: the stored table fills the bare re-declaration's silences, and
  // the REAL policy emitter then keeps every clause the delta omitted. Before
  // the fill the audit's exact failure reproduces — a teamScope+expires+
  // scheduled+trash `deals` re-declared bare emits USING(owner_id=...) alone.
  const { policiesFor } = await import("../site-rls.mjs");
  const { fillFromStored } = await import("../site-schema.mjs");
  const stored = normalizeSchema({ tables: [{ name: "deals", access: "user", teamScope: true, expires: true, scheduled: true, trash: true, columns: ["title"] }] }).tables[0];
  const bare = normalizeSchema({ tables: [{ name: "deals", access: "user", columns: ["title", "stage"] }] }).tables[0];
  const before = policiesFor({ ...bare, access: "user" }).join("\n");
  const CLAUSES = { app_team_id: "team members lose each other's rows", expires_at: "expired rows reappear", publish_at: "scheduled rows go public early", deleted_at: "trashed rows come back" };
  for (const tok of Object.keys(CLAUSES)) {
    assert.equal(before.includes(tok), false,
      tok + " already present on the bare table — this test stopped reproducing the failure it guards");
  }
  fillFromStored(bare, stored);
  const after = policiesFor({ ...bare, access: "user" }).join("\n");
  for (const [tok, cost] of Object.entries(CLAUSES)) {
    assert.ok(after.includes(tok), tok + " clause lost on a bare re-declaration — " + cost);
  }
  // An EXPLICIT false still clears — that is the removal verb, and filling
  // over it would make the flags un-turn-off-able forever.
  const cleared = normalizeSchema({ tables: [{ name: "deals", access: "user", expires: false, columns: ["title"] }] }).tables[0];
  fillFromStored(cleared, stored);
  assert.equal(cleared.expires, false, "an explicit false was overwritten by the stored true");
});

test("the fill runs BEFORE the DDL and the policies, and the merge reuses its read", () => {
  // The wiring half — the helper is correct in isolation and worthless if
  // applySiteSchema still emits policies from the unfilled delta, which is the
  // guard-watching-the-layer-below failure this repo has recorded twelve
  // times. Ordering with both anchors proven, never a vacuous indexOf pair.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const at = src.indexOf("export async function applySiteSchema");
  assert.ok(at > 0, "applySiteSchema moved — rescope this");
  const body = src.slice(at);
  const fill = body.indexOf("fillFromStored(t, prevT)");
  const pol = body.indexOf("policiesFor(");
  assert.ok(fill > 0, "the pre-DDL fill is gone from applySiteSchema");
  assert.ok(pol > 0, "the policy emit is gone — rescope this");
  assert.ok(fill < pol, "the fill runs after the policies are emitted — the delta decides the policy again");
  // ONE read of the stored schema, shared by the fill and the late merge — two
  // reads of one schema are two chances to disagree about what is stored.
  const loads = [...body.matchAll(/await loadSiteSchema\(uuid\)/g)];
  assert.equal(loads.length, 1, "the fill and the merge read the schema separately");
  assert.match(body, /const prev = prevStored;/, "the late merge no longer reuses the fill's read");
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

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO HALVES OF THE TOOL SPOKE DIFFERENT TYPE LANGUAGES.
//
// A column may be text/integer/real/boolean/json. A function argument was
// offered seven types no column can ever be — date, timestamptz, bigint,
// numeric, uuid, jsonb, int. A function body compares its arguments to columns,
// so `{name:"d", type:"date"}` against a TEXT `slot_date` is
// `operator does not exist: text = date`: the function fails to CREATE, and the
// page's lookup silently is not there. Non-fatal and reported in
// `functionErrors`, so the site builds without the capability it asked for.
//
// The tool already knew the trap existed — its own example warns a claim token
// is TEXT "not uuid" — so somebody hit that version and documented that one
// case while the date, numeric and bigint versions stayed open.
test("what the tool OFFERS as an argument type, the engine accepts", () => {
  // DERIVED FROM BOTH FILES, because the failure is a disagreement between
  // them. A type in the tool that the engine drops means the argument silently
  // vanishes from the function's signature, and the body then references a
  // parameter that does not exist.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("Arguments, matched to the COLUMN");
  assert.ok(at > 0, "the args description moved — retarget this test");
  // FROM INSIDE THE BRACKETS, not from the property. Anchored at
  // `type: { type: "string", enum: [` the scan swallowed that literal
  // `"string"` and reported it as an offered type the engine drops — a false
  // alarm about a type nobody declared. Found by the test failing on correct
  // code, which is the cheap direction for this mistake.
  const enumAt = w.indexOf("enum: [", w.indexOf('type: { type: "string", enum: [', at)) + "enum: [".length;
  const offered = [...w.slice(enumAt, w.indexOf("]", enumAt)).matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(offered.length > 5, "read only " + offered.length + " arg types — the scan is broken");
  assert.ok(!offered.includes("string"), "the scan is reading the property, not the enum");

  const s = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const sets = [...s.matchAll(/const TYPES = new Set\(\[([^\]]*)\]\)/g)].map((m) =>
    [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]));
  // Two `TYPES` live in this file at different scopes — columns and functions.
  // The function one is whichever contains `uuid`; picking by position would
  // break the day somebody reorders the file.
  const engine = sets.find((set) => set.includes("uuid"));
  assert.ok(engine, "the function TYPES allow-list is gone — retarget this test");

  const orphan = offered.filter((t) => !engine.includes(t));
  assert.deepEqual(orphan, [],
    "the tool offers argument types the engine drops: " + orphan.join(", ") +
    " — the argument disappears from the signature and the body references a parameter that is not there");
});

test("no argument type is offered that no column can ever be matched to", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("Arguments, matched to the COLUMN");
  const enumAt = w.indexOf("enum: [", w.indexOf('type: { type: "string", enum: [', at)) + "enum: [".length;
  const offered = [...w.slice(enumAt, w.indexOf("]", enumAt)).matchAll(/"([a-z]+)"/g)].map((m) => m[1]);

  // GONE, because no column is ever either. A date or a time lives in a TEXT
  // column, so a `date` argument can only be right through an explicit cast
  // that nothing asks for — an option that is almost always the wrong answer.
  for (const dead of ["date", "timestamptz"])
    assert.ok(!offered.includes(dead),
      "`" + dead + "` is offered again, and no column can ever be one");

  // KEPT DELIBERATELY, and these are not oversights: `owner_id` and `team_id`
  // really are UUID columns, and a `hook_*` handler takes exactly one jsonb
  // payload. Removing them would break the two features that need them.
  for (const needed of ["uuid", "jsonb"])
    assert.ok(offered.includes(needed),
      "`" + needed + "` was removed — owner_id is UUID and an inbound hook takes jsonb");

  // `integer` alongside `int`, because that is the word the COLUMNS use and the
  // engine has always taken both. Offering one spelling while the other half of
  // the tool uses the other is the whole mismatch in miniature.
  assert.ok(offered.includes("integer") && offered.includes("int"),
    "the columns say `integer` and the arguments must accept that spelling");
});

test("the args description states what a declared column REALLY is", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("Arguments, matched to the COLUMN");
  const end = w.indexOf("items: {", at);
  assert.ok(end > at, "the args description could not be read whole");
  const desc = w.slice(at, end);

  // THE TWO SURPRISING ONES, which a model cannot infer and will get wrong.
  // A `boolean` column is INTEGER 0/1 in Postgres and a `json` column is TEXT —
  // so a `boolean` or `jsonb` argument compared to one is the same mismatch as
  // the date case, arriving from a type the tool still offers.
  assert.match(desc, /`boolean` is INTEGER 0\/1, NOT boolean/,
    "nothing says a boolean column is an INTEGER, so a boolean argument compared to one fails");
  assert.match(desc, /`json` is TEXT, NOT jsonb/,
    "nothing says a json column is TEXT, so a jsonb argument compared to one fails");
  // And the fact that makes the removal above make sense from the model's side.
  assert.match(desc, /THERE IS NO DATE COLUMN/,
    "the model is not told that a date lives in a TEXT column");
  // The managed columns, which a function is most likely to be handed.
  assert.match(desc, /`owner_id` and `team_id` are UUID/,
    "the only UUID columns on the platform are not named");
});

// ─────────────────────────────────────────────────────────────────────────────
// A STRINGIFIED `tables`, recovered rather than dropped.
//
// Measured in `schema gen eval` 2026-08-13: 1 sample in 20 returned `tables` as
// a STRING. `stop_reason: "tool_use"` and 1,680 output tokens, so the model
// finished normally and wrote a full answer — it just serialised the array. It
// matched neither branch of the dispatch and fell through to zero tables, which
// the build route reports as "that brief didn't describe anything to store": a
// 422 on a schema the model actually got right.

test("a stringified list of tables is recovered, not dropped", () => {
  const real = [
    { name: "classes", access: "display", columns: [{ name: "title", type: "text" }] },
    { name: "bookings", read: "none", write: "none", columns: [{ name: "who", type: "text" }] },
  ];
  const direct = normalizeSchema({ tables: real });
  const viaString = normalizeSchema({ tables: JSON.stringify(real) });

  assert.equal(direct.tables.length, 2, "the plain array stopped working");
  assert.deepEqual(
    viaString.tables.map((t) => t.name), direct.tables.map((t) => t.name),
    "a stringified list must produce the same tables as the list itself");
  // The ACCESS has to survive too, not just the names — a recovered table that
  // lost its read/write pair would be a public table silently turned private,
  // or worse.
  assert.deepEqual(
    viaString.tables.map((t) => t.access), direct.tables.map((t) => t.access),
    "the recovered tables lost their access level");
});

test("a stringified MAP is recovered too, like the map form beside it", () => {
  // The dispatch already accepts a name→definition map instead of a list, for
  // the same class of model habit. A string wrapping one has to land in that
  // branch rather than being handled only for arrays.
  const out = normalizeSchema({ tables: JSON.stringify({ classes: { access: "display", columns: ["title"] } }) });
  assert.equal(out.tables.length, 1, "a stringified map was dropped");
  assert.equal(out.tables[0].name, "classes");
});

test("a string that is not JSON still yields nothing, and does not throw", () => {
  // The honest answer. Recovering only what is really recoverable is what keeps
  // this from papering over an answer that is genuinely broken — and it runs on
  // model output, so throwing here would take the whole build down rather than
  // reporting a bad schema.
  for (const junk of ["classes and bookings", "", "{", "null", "12"]) {
    let out;
    assert.doesNotThrow(() => { out = normalizeSchema({ tables: junk }); }, "threw on " + JSON.stringify(junk));
    assert.equal(out.tables.length, 0, "junk string produced tables: " + JSON.stringify(junk));
  }
});

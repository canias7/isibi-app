// The 2026-08-21 audit's findings against the schema engine.
//
// Five separate failures, one theme: every one of them is SILENT. The build
// succeeds, the site publishes, the response says `ok: true`, and something the
// customer asked for is simply not there — an empty price list, a row cap that
// stopped capping, a booking constraint that was never created, a definer
// function reading the owner's Stripe key.
//
// Each test below was proved to FAIL against the bug it describes: the old
// expression was put back, the test went red, and it was put back again.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeSchema, fillFromStored, seedSiteRows, checkSql, sqlIdent,
  derivedName, derivedIdent, MAX_PG_IDENT, INTERNAL_TABLES, INTERNAL_TABLE_RE,
  refusedFields, droppedFields,
} from "../site-schema.mjs";

const SRC = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");

// Length-preserving, line-wise. Prose describing a rule spells that rule, so an
// absence or an ordering read against the raw text matches the paragraph
// explaining the fix rather than the code — this repo has recorded that trap in
// a lint, a router guard, an absence check and a scope scan.
function blankComments(src) {
  return src.split("\n").map((line) => {
    const t = line.trimStart();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return " ".repeat(line.length);
    const at = line.indexOf("//");
    return at < 0 ? line : line.slice(0, at) + " ".repeat(line.length - at);
  }).join("\n");
}
const CODE = blankComments(SRC);

// A window between two landmarks. Never sized in bytes: a byte window rots the
// moment somebody documents the line it was measured against.
function between(src, from, to) {
  const a = src.indexOf(from);
  assert.ok(a > 0, "landmark moved: " + from);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > a, "landmark moved: " + to);
  return src.slice(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Seed rows and the DDL must agree about a column's NAME.
// ─────────────────────────────────────────────────────────────────────────────

// Records the statements a seed run emits, with no database anywhere.
function recorder() {
  const calls = [];
  return { calls, deps: { sqlQuery: async (_u, sql, params) => { calls.push({ sql, params }); return []; } } };
}
const insertsOf = (calls) => calls.filter((c) => /^INSERT/.test(c.sql));
const colsOf = (sql) => (sql.match(/\(([^)]*)\) VALUES/) || [, ""])[1].split(",").map((s) => s.trim().replace(/"/g, ""));

test("a seed row is inserted into the column the DDL actually created", async () => {
  // `applySiteSchema` creates a column with `sqlIdent(c.name)` — QUOTED, so
  // case-preserved, and a quoted identifier is case-sensitive in Postgres. The
  // seeder lower-cased both its allow-list and the name it emitted, so a
  // designer that wrote `priceGbp` got `"priceGbp"` in the table and
  // `INSERT INTO "menu_items" ("name","pricegbp")` from here. Measured
  // 2026-08-21 with exactly this fake.
  //
  // The cost is the whole table, not the column: one INSERT carries every column
  // of the row, so a single capital letter loses EVERY row — and nothing can
  // write to a `display` table after the build, so the menu is empty forever and
  // any form whose required Select reads it renders with zero options.
  const spec = normalizeSchema({
    tables: [{ name: "menu_items", access: "display", columns: [{ name: "Name" }, { name: "priceGbp", type: "real" }] }],
  });
  const { calls, deps } = recorder();
  await seedSiteRows("conn", spec, { menu_items: [{ Name: "Flat white", priceGbp: 3.2 }] }, deps);

  const [ins] = insertsOf(calls);
  assert.ok(ins, "nothing was inserted at all");
  // DERIVED FROM THE DDL'S OWN RULE, not from a spelling: whatever the DDL
  // quotes is what the INSERT must quote. `sqlIdent(c.name)` is the DDL's
  // expression, so the expected names come from running it.
  const ddlNames = spec.tables[0].columns.map((c) => sqlIdent(c.name).replace(/"/g, ""));
  assert.deepEqual(colsOf(ins.sql), ddlNames);
});

test("the lower-cased keys the seed top-up produces still match", async () => {
  // `builder/site-seed.mjs` asks the model for lower-cased column names
  // (`writableColumns`) and stores the answer lower-cased (`readSeedRows`), so
  // the rescue path fails identically if the match becomes case-SENSITIVE. That
  // is why the lookup stays lower-cased and only the emitted name is the
  // declared one — it fixes both ends with one change.
  const spec = normalizeSchema({
    tables: [{ name: "menu_items", access: "display", columns: [{ name: "Name" }, { name: "priceGbp" }] }],
  });
  const { calls, deps } = recorder();
  await seedSiteRows("conn", spec, { menu_items: [{ name: "Flat white", pricegbp: "3.20" }] }, deps);
  const [ins] = insertsOf(calls);
  assert.ok(ins, "the top-up's lower-cased keys were dropped");
  assert.deepEqual(colsOf(ins.sql), ["Name", "priceGbp"]);
});

test("two keys differing only in case are one column, not a duplicate", async () => {
  // The DDL loop dedupes on the lower-cased name (`seen`) and keeps the FIRST,
  // so `Name` and `name` are ONE column in the database. Emitting both would
  // produce `("Name","Name")` and lose the row.
  const spec = normalizeSchema({
    tables: [{ name: "t", access: "display", columns: [{ name: "Name" }, { name: "name" }] }],
  });
  const { calls, deps } = recorder();
  await seedSiteRows("conn", spec, { t: [{ Name: "a", name: "b" }] }, deps);
  const [ins] = insertsOf(calls);
  assert.deepEqual(colsOf(ins.sql), ["Name"]);
  assert.equal(ins.params.length, 1);
});

test("an all-lowercase schema seeds byte-identically to before", async () => {
  // The direction that matters second: every site built to date has lower-case
  // columns, and this change must be invisible to all of them.
  const spec = normalizeSchema({
    tables: [{ name: "services", access: "display", columns: [{ name: "name" }, { name: "price" }] }],
  });
  const { calls, deps } = recorder();
  await seedSiteRows("conn", spec, { services: [{ name: "Cut", price: 18 }] }, deps);
  assert.equal(insertsOf(calls)[0].sql, 'INSERT INTO "services" ("name","price") VALUES (?,?)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Silence stays silence — for EVERY flag, not four of fourteen.
// ─────────────────────────────────────────────────────────────────────────────

test("NO field collapses an omitted declaration to false or zero", () => {
  // THE DERIVED FORM, so it needs no list and cannot be shrunk by editing one.
  // `fillFromStored` restores a key the new declaration left `undefined` or
  // `null`; `false` and `0` are neither, so any field that answers a SILENCE
  // with one of those is a guarantee a bare re-declaration destroys.
  //
  // Measured 2026-08-21: ten did. `boolOf` was written for exactly this class in
  // the 2026-08-14 audit and reached four of them.
  const bare = normalizeSchema({ tables: [{ name: "t", columns: [{ name: "a" }] }] }).tables[0];
  const collapsed = Object.entries(bare).filter(([, v]) => v === false || v === 0).map(([k]) => k);
  assert.deepEqual(collapsed, [], "these answer silence with a value the merge keeps");
  // Floor: a bare table really does carry the fields being checked, or the
  // assertion above is a clean sweep over nothing.
  assert.ok(Object.keys(bare).length > 40, "the normaliser's output shrank — retarget this guard");
});

test("a bare re-declaration keeps every guarantee the stored table had", () => {
  // The ordinary revise: the designer sees only the instruction ("add a
  // due_date to tasks") and re-declares the table without restating flags it
  // was never told about. Before this, the trigger-hygiene loop DROPped `_pos`,
  // `_max`, `_aud_*` and `_hist` and the recreates were gated on flags that had
  // just been read as `false` — so the row cap went, new rows got a NULL
  // position, delete tombstones stopped, and the audit trail silently stopped
  // recording. Reported as a successful build.
  const FLAGS = {
    audit: true, history: true, sync: true, ordered: true, version: true,
    timestamps: true, archivable: true, pinnable: true, enforceRefs: true,
    teamRead: true, requireVerified: true, expires: true, trash: true,
    maxRows: 50, rateLimit: 30,
  };
  const stored = normalizeSchema({ tables: [{ name: "tasks", access: "user", columns: [{ name: "title" }], ...FLAGS }] }).tables[0];
  const bare = normalizeSchema({ tables: [{ name: "tasks", columns: [{ name: "title" }, { name: "due_date" }] }] }).tables[0];
  const filled = fillFromStored({ ...bare }, stored);

  for (const k of Object.keys(FLAGS)) {
    assert.equal(stored[k], FLAGS[k], "the normaliser dropped " + k + " on the way IN");
    assert.equal(filled[k], FLAGS[k], k + " was lost by a bare re-declaration");
  }
  // The new column still lands — the whole point of naming the table.
  assert.ok(filled.columns.some((c) => c.name === "due_date"));
});

test("an explicit false or zero still clears — that is the removal verb", () => {
  // The asymmetry `retiredOf` states and `boolOf` generalises: "did not mention
  // it" and "wants it off" are different things, and a boolean cannot tell them
  // apart unless absence has its own value.
  const one = (def) => normalizeSchema({ tables: [{ name: "t", columns: ["a"], ...def }] }).tables[0];
  assert.equal(one({ audit: false }).audit, false);
  assert.equal(one({ ordered: false }).ordered, false);
  assert.equal(one({ maxRows: 0 }).maxRows, 0);
  const stored = one({ audit: true, maxRows: 50 });
  const cleared = fillFromStored({ ...one({ audit: false, maxRows: 0 }) }, stored);
  assert.equal(cleared.audit, false, "an explicit false must survive the merge");
  assert.equal(cleared.maxRows, 0, "an explicit 0 must survive the merge");
});

test("the trigger hygiene loop is what makes a lost flag lose real DDL", () => {
  // Belt-and-braces for the two tests above, and the reason they matter: the
  // DROP is UNCONDITIONAL and every recreate is gated on its flag, so a flag
  // read as `false` removes a trigger and does not put it back. Asserted on
  // comment-blanked source between landmarks.
  const loop = between(CODE, 'for (const suf of ["_del"', "if (t.sync) {");
  assert.match(loop, /DROP TRIGGER IF EXISTS/);
  for (const suf of ["_pos", "_max", "_aud_i", "_hist"]) assert.ok(loop.includes(suf), suf + " left the drop list");
  assert.match(CODE, /if \(t\.ordered\) \{/, "the position trigger must stay gated on the flag");
  assert.match(CODE, /if \(t\.maxRows > 0\) \{/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. A derived name is not a declared name.
// ─────────────────────────────────────────────────────────────────────────────

test("the tool's own worked example on an ordinary table name survives", () => {
  // `SAFE_IDENT` caps at 41 — a policy about what a customer's TABLE may be
  // called — and it was applied to names composed FROM a table name. The
  // `checks` field's own documented example is `["end_time","gt","start_time"]`,
  // which on `booking_requests` (16 characters, an ordinary snake_case plural)
  // is 42. Postgres allows 63.
  const t = { name: "booking_requests", checks: [["end_time", "gt", "start_time"]] };
  const [ck] = checkSql(t, new Set(["end_time", "start_time"]));
  assert.ok(ck, "the rule was dropped before it reached a name");
  assert.equal(ck.name, "ck_booking_requests_end_time_gt_start_time");
  assert.ok(ck.name.length > 41 && ck.name.length <= MAX_PG_IDENT);
  // And it must be renderable, which is where the throw used to happen.
  assert.equal(derivedIdent(ck.name), '"' + ck.name + '"');
});

test("a name over Postgres's own limit is shortened, not thrown away", () => {
  const long = "ck_" + "a".repeat(40) + "_" + "b".repeat(40);
  assert.ok(long.length > MAX_PG_IDENT);
  const got = derivedName(long);
  assert.equal(got.length, MAX_PG_IDENT);
  assert.match(got, /^[a-z_][a-z0-9_]*$/i);
});

test("the shortening is stable across calls — DROP and CREATE must agree", () => {
  // Every one of these names is used twice, `DROP … IF EXISTS` then the create,
  // and a revise re-applies the whole schema. A name that differed between runs
  // would leave the old constraint standing and add a second beside it.
  const long = "ex_" + "t".repeat(60) + "_nooverlap";
  assert.equal(derivedName(long), derivedName(long));
  assert.equal(derivedName(long), derivedName("ex_", "t".repeat(60), "_nooverlap"));
});

test("two long names that differ do not collide into one constraint", () => {
  // Plain truncation is the obvious alternative and is wrong: `ck_` + table +
  // col + op + col means two rules on one table can share a 63-character
  // prefix, and Postgres's own silent truncation has the identical failure —
  // one constraint silently replacing the other.
  const table = "t".repeat(38);
  const a = derivedName("ck_", table, "_", "start_time_column", "_gt_", "aaa");
  const b = derivedName("ck_", table, "_", "start_time_column", "_gt_", "bbb");
  assert.notEqual(a, b);
  assert.ok(a.length <= MAX_PG_IDENT && b.length <= MAX_PG_IDENT);
});

test("a name that already applied is returned untouched", () => {
  // Nothing existing may change: every name that applied successfully before
  // this was ≤41 characters, so no live site gets a second constraint on its
  // next revise.
  for (const n of ["ck_bookings_a_gt_b", "ux_menu_g_0", "trg_posts_aud_i", "ex_slots_nooverlap"]) {
    assert.equal(derivedName(n), n);
    assert.equal(derivedIdent(n), sqlIdent(n));
  }
});

test("a derived name is still an identifier, not a quoting hole", () => {
  for (const bad of ['a" DROP TABLE x --', "1abc", "", null, undefined, "a-b", "a b"]) {
    assert.throws(() => derivedIdent(bad), /bad derived identifier/, JSON.stringify(bad));
  }
});

test("the three uncaught derived names cannot 502 a whole build any more", () => {
  // There is no per-table try in the apply loop, so a throw at any of these
  // three reached the route's catch — 502 "could not apply the schema" on a
  // build whose Neon project was already provisioned, with the log reading as
  // the schema engine failing when the cause was a name seven characters too
  // long. Comment-blanked source, landmark-scoped.

  // (a) the position trigger's name was computed, never read, and could only
  //     ever fail. It is gone.
  const ordered = between(CODE, "if (t.ordered) {", "if (t.expires)");
  assert.ok(!/const trg = /.test(ordered), "the dead ident is back — its only behaviour was the throw");

  // (b) the unique index name is INSIDE the try that reports the failure.
  const mk = between(CODE, "const mkIndexes = async (groups, perUser)", "await mkIndexes(t.unique, false);");
  const tryAt = mk.indexOf("try {");
  const nameAt = mk.indexOf("derivedIdent(\"ux_\"");
  assert.ok(tryAt > 0 && nameAt > tryAt, "the index name must be computed inside the try, not above it");

  // (c) so is the exclusion constraint's, and a failure to name it is reported
  //     rather than swallowed.
  const no = between(CODE, "if (t.noOverlap && t.noOverlap.start", "await mkIndexes(t.oncePerUser, true);");
  assert.match(no, /try \{ cname = derivedIdent\("ex_"/);
  assert.match(no, /refused\.push\(\{ table: t\.name, feature: "noOverlap"/);
});

test("a column name the DDL cannot render loses the column, not the site", () => {
  // THE FOURTH UNCAUGHT `sqlIdent` SITE, found while fixing the other three.
  // `coerceCol` validated every property except the NAME, so the name was first
  // judged at the DDL loop's `const cn = sqlIdent(c.name)` — outside every try,
  // in a loop with no per-table try — and one over-long or odd column name 502'd
  // the whole build with a Neon project already provisioned. Exactly what
  // `coerceTable`'s own name check was added to end, one level down.
  //
  // 43 characters is ordinary model output, not an attack.
  const long = "estimated_completion_date_confirmed_by_the_owner";
  assert.ok(long.length > 41);
  const t = normalizeSchema({ tables: [{ name: "jobs", access: "collect", columns: [{ name: long }, { name: "ok" }] }] }).tables[0];
  assert.deepEqual(t.columns.map((c) => c.name), ["ok"], "the bad column must go, and only it");
  assert.equal(t.name, "jobs", "the table survives");
  // DERIVED FROM THE DDL'S OWN EXPRESSION: every column that survives must be
  // one `sqlIdent` can render, or the loop throws and the build is lost.
  for (const c of t.columns) assert.doesNotThrow(() => sqlIdent(c.name));
});

test("a guarantee the database refused is named, never only logged", () => {
  // `refused` is the one channel that can say "the guarantee you asked for is
  // not there", which is the single thing an owner cannot discover for
  // themselves. `unique` on a booking table is the headline case — two
  // customers in one chair is what it stops.
  const loop = between(CODE, "const mkIndexes = async (groups, perUser)", "await mkIndexes(t.unique, false);");
  assert.match(loop, /refused\.push\(\{ table: t\.name, feature: perUser \? "oncePerUser" : "unique"/);
  // And the silently-skipped case: `noOverlap` on non-integer columns emits no
  // constraint at all, which this repo has already measured as two customers
  // booking one slot.
  assert.match(CODE, /why: "start and end must be integer columns"/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. The model-function deny-list.
// ─────────────────────────────────────────────────────────────────────────────

const fnSpec = (body, language) => ({
  tables: [{ name: "bookings", access: "collect", columns: ["customer_name"] }],
  functions: [{ name: "peek", returns: "text", body, language: language || "sql" }],
});
const fns = (body, language) => (normalizeSchema(fnSpec(body, language)).functions || []).map((f) => f.name);

test("the deny-list covers every internal table this file creates", () => {
  // DERIVED AT BOTH ENDS, because the hand-written list is what went stale:
  // `_errors` was created 2026-08-14 to hold reported stacks and routes and was
  // never added, and `_deletes` and `_history` were missing too.
  // COMMENT-BLANKED, and it caught its own author on the first run: the
  // paragraph in site-schema.mjs explaining this derivation spells
  // `CREATE TABLE IF NOT EXISTS _x`, so a scan of the raw text reported a table
  // called `_x`. Prose describing a rule spells that rule.
  const created = [...CODE.matchAll(/CREATE TABLE IF NOT EXISTS (_[a-z_]+)/g)].map((m) => m[1]);
  assert.ok(created.length >= 6, "the scan found nothing — a broken regex reports a clean file");
  for (const name of created) {
    assert.ok(INTERNAL_TABLES.includes(name), name + " is created here and is not in the deny-list");
    assert.deepEqual(fns("SELECT * FROM " + name + " LIMIT 1"), [], "a body naming " + name + " must be refused");
  }
});

test("_errors specifically — the table the old list left out", () => {
  assert.deepEqual(fns("SELECT stack, route FROM _errors"), []);
  assert.deepEqual(fns('SELECT * FROM "_errors"'), []);
  assert.deepEqual(fns("SELECT * FROM public._errors"), []);
});

test("a plpgsql body cannot compose an internal table name at run time", () => {
  // THE BYPASS THE LITERAL REGEX COULD NEVER SEE. The body's language may be
  // plpgsql, where the name need not appear in one piece — measured 2026-08-21,
  // this exact body came back as a live function.
  //
  // Every model function is SECURITY DEFINER and a non-`internal` one is
  // GRANTed to `anonymous`, so the blast radius is the owner's encrypted Stripe
  // key and every member's live session token, read by any visitor.
  for (const b of [
    "DECLARE r text; BEGIN EXECUTE 'SELECT cipher FROM ' || '_sec' || 'rets' INTO r; RETURN r; END;",
    "BEGIN RETURN QUERY EXECUTE format('SELECT * FROM %I', 'neon_auth.session'); END;",
    "BEGIN EXECUTE 'SELECT 1'; RETURN 'x'; END;",
  ]) {
    assert.deepEqual(fns(b, "plpgsql"), [], "must refuse dynamic SQL: " + b.slice(0, 50));
  }
});

test("the outbound extensions go with it", () => {
  // `dblink` and `postgres_fdw` are installable on Neon (measured in
  // `neon-e2e`), and `dblink('…', 'SELECT cipher FROM ' || '_sec' || 'rets')`
  // composes the same name inside a remote query string with no EXECUTE at all.
  for (const b of [
    "SELECT * FROM dblink('host=evil', 'SELECT 1') AS t(x text)",
    "SELECT dblink_exec('host=evil', 'SELECT 1')",
    "SELECT * FROM postgres_fdw_handler()",
  ]) {
    assert.deepEqual(fns(b), [], "must refuse: " + b);
  }
});

test("the guard is not a blanket refusal", () => {
  // A guard that refused everything would pass every test above while silently
  // removing the whole RPC tier — this repo rates that direction worse than the
  // miss, so it is asserted directly.
  assert.deepEqual(fns("SELECT customer_name FROM bookings WHERE id = 1"), ["peek"]);
  assert.deepEqual(fns("BEGIN RETURN (SELECT customer_name FROM bookings LIMIT 1); END;", "plpgsql"), ["peek"]);
  // An ordinary table whose name merely contains an internal one is untouched:
  // the list is word-bounded on both sides, so `users` is not `_users`.
  const s = {
    tables: [{ name: "users", access: "display", columns: ["name"] }],
    functions: [{ name: "ok_fn", returns: "text", body: "SELECT name FROM users", language: "sql" }],
  };
  assert.deepEqual((normalizeSchema(s).functions || []).map((f) => f.name), ["ok_fn"]);
  assert.equal(INTERNAL_TABLE_RE.test("SELECT * FROM site_users_archive"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. The two diagnostics and the shape the normaliser deliberately recovers.
// ─────────────────────────────────────────────────────────────────────────────

test("a stringified `tables` is read by the diagnostics too, not only the build", () => {
  // `normalizeSchema` recovers a serialised list on purpose — measured at about
  // 1 sample in 20 in `schema gen eval` — so on those builds the tables were
  // real while both diagnostics reported a clean sweep over nothing. `reached`
  // exists so "do we need another capability?" is a count rather than an
  // opinion, and `refused` is the only trace of a declared guarantee that failed
  // its shape check.
  const tables = [{ name: "menu", access: "display", columns: ["a"], sla: { mins: 5 }, publicView: { columns: ["owner_id"] } }];
  const asArray = { tables };
  const asString = { tables: JSON.stringify(tables) };

  assert.deepEqual(normalizeSchema(asString).tables.map((t) => t.name), ["menu"], "the build still gets its tables");
  assert.deepEqual(refusedFields(asString), refusedFields(asArray));
  assert.deepEqual(droppedFields(asString), droppedFields(asArray));
  // Floor: the array form really does report something, or "they agree" is two
  // empty lists agreeing about nothing.
  assert.ok(refusedFields(asArray).length > 0 || droppedFields(asArray).length > 0);
});

test("a `tables` string that is not JSON is still no tables, honestly", () => {
  assert.deepEqual(refusedFields({ tables: "not json at all" }), []);
  assert.deepEqual(droppedFields({ tables: "not json at all" }), []);
  assert.deepEqual(normalizeSchema({ tables: "not json at all" }).tables, []);
});

test("one reading of `tables`, shared by all three", () => {
  // Two copies of "what shape did the tables arrive in" is how these came to
  // disagree in the first place.
  assert.equal((CODE.match(/typeof spec\.tables === "object"/g) || []).length, 0,
    "a private copy of the shape test is back");
  assert.equal((CODE.match(/= declaredTables\(spec\)/g) || []).length, 2, "both diagnostics must go through it");
});

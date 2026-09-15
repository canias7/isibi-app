// THE DATABASE-DISCOVERY REPAIR (2026-09-15).
//
// Run 47 published a page reading `0` to a shop with three bookings, because
// `siteBackendBySlug` answers one `null` for four different facts and the addon
// read it as "this site has no tables". These are the two modules that replace
// that collapse, plus the script that closes the five live sites already in it.
//
// EVERY PERMISSION FIXTURE HERE IS DERIVED FROM THE REAL PRODUCER —
// `grantsFor` and `policiesFor` in `site-rls.mjs` — and read back as the rows
// `information_schema` and `pg_policies` would report. Nothing about who may
// read or write a table is typed by hand in this file, because a hand-typed
// permission is a second copy of the emitter and the two drift.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { backendState, repairPlan, unsetDbFilter, dbNameFromConn, BACKEND_STATES } from "../site-backend-state.mjs";
import {
  reconcileSpec, deriveAccess, RECOVER_QUERIES, MANAGED_COLUMNS, UNPROVABLE_FLAGS, isInternalName,
  readSchemaState, deriveFlags, verifyDeclaration, predicateShape, splitPrivileges, emittedGrantAccess,
  liveGrantAccess, DERIVED_FLAGS, UNDERIVABLE_EVIDENCE, SCHEMA_STATES, META_SCHEMA_SQL, readParens,
} from "../site-schema-recover.mjs";
import { grantsFor, policiesFor } from "../site-rls.mjs";
import { READ_LEVELS, WRITE_LEVELS } from "../site-access.mjs";
import { dbNameForSite } from "../site-db.mjs";
import { parseArgs, safeErr, proveIdentity, recoverSchema, survey, workList, writeRef, repairSite, verifySite, EMIT } from "../scripts/backend-repair.mjs";

/** The real emitters, as the product hands them in. Nothing here verifies against a copy. */
const REAL = { policiesFor, grantsFor };

const SITE = { neon_db: "site_x" }, PROJ = { neon_conn: "postgres://u:p@h.neon.tech/neondb" };

// ── The four states ──────────────────────────────────────────────────────────

test("the four states are told apart, and cannot-tell is asked first", () => {
  assert.equal(backendState({ site: SITE, project: PROJ }).state, "ready");
  assert.equal(backendState({ site: { neon_db: "" }, project: null }).state, "none");
  assert.equal(backendState({ site: { neon_db: "" }, project: PROJ }).state, "incomplete");
  assert.equal(backendState({ failed: new Error("supabase 503") }).state, "unreadable");
  // ASKED FIRST: a failure that also carried rows must still read as unreadable,
  // or a partial answer decides a state it has no business deciding.
  assert.equal(backendState({ site: SITE, project: PROJ, failed: new Error("x") }).state, "unreadable",
    "a failed lookup was overruled by the rows it came back with");
  // A ROW WITH WHITESPACE IS NOT A RECORDED NAME.
  assert.equal(backendState({ site: { neon_db: "   " }, project: PROJ }).state, "incomplete");
  // THE CENSUS: every state the module can answer is in the exported list, so a
  // fifth added next month cannot be produced and unnamed.
  const seen = new Set([
    backendState({ site: SITE }).state, backendState({ site: { neon_db: "" } }).state,
    backendState({ site: { neon_db: "" }, project: PROJ }).state, backendState({ failed: 1 }).state,
  ]);
  for (const s of seen) assert.ok(BACKEND_STATES.includes(s), "unnamed state: " + s);
});

test("the repair is repeatable, creates nothing, and overwrites nothing valid", () => {
  const plan = (o) => repairPlan({ slug: "repairbench-1", derive: dbNameForSite, ...o });
  // THE ONLY STATE THAT IS REPAIRED.
  const go = plan({ site: { neon_db: "" }, project: PROJ });
  assert.equal(go.act, "backfill");
  assert.equal(go.db, dbNameForSite("repairbench-1"), "the plan did not derive the platform's own name");
  // NEVER OVERWRITES A VALID SETTING — by name, not by a filter to get right.
  assert.equal(plan({ site: { neon_db: "site_other" }, project: PROJ }).act, "skip");
  assert.equal(plan({ site: { neon_db: "site_other" }, project: PROJ }).db, "site_other",
    "a skipped site's recorded name is not carried through, so a verify cannot read it");
  // NEVER INVENTS A DATABASE for a frontend-only site.
  assert.equal(plan({ site: { neon_db: "" }, project: null }).act, "skip");
  // NEVER ACTS ON CANNOT-TELL.
  assert.equal(plan({ failed: new Error("down") }).act, "skip");
  // REPEATABLE: the state AFTER a repair is `ready`, which skips. That is the
  // whole of "running it twice is running it once".
  assert.equal(plan({ site: { neon_db: go.db }, project: PROJ }).act, "skip");
  // A DERIVER THAT THROWS DOES NOT PRODUCE A WRITE.
  assert.equal(repairPlan({ slug: "x", site: { neon_db: "" }, project: PROJ, derive: () => { throw new Error("bad"); } }).act, "skip");
});

test("the heal's filter is what enforces 'never overwrite', and it covers both spellings of unset", () => {
  const f = unsetDbFilter();
  // BOTH SPELLINGS EXIST IN THE LIVE TABLE: `claimSiteSlug` writes "" and a row
  // that never had the column written carries NULL. A filter covering one would
  // leave half the affected sites unrepaired.
  assert.match(f, /neon_db\.is\.null/);
  assert.match(f, /neon_db\.eq\./);
  assert.match(f, /^or=\(/, "the two conditions are ANDed, so nothing would ever match");
  // AND IT NAMES NO OTHER COLUMN — a filter that admitted a set `neon_db` is
  // the overwrite this exists to prevent.
  assert.equal(/neon_db/g.test(f) && f.split("neon_db").length - 1, 2);
});

test("the recorded name comes from the connection, not from a second derivation", () => {
  assert.equal(dbNameFromConn("postgres://u:p@ep-x.neon.tech/site_repairbench_1?sslmode=require"), "site_repairbench_1");
  assert.equal(dbNameFromConn("not a url"), "", "an unparseable connection produced a name");
  assert.equal(dbNameFromConn(null), "");
  assert.equal(dbNameFromConn("postgres://u:p@h/"), "", "an empty path produced a name");
});

// ── The access derivation, round-tripped through the real emitters ───────────

/**
 * Grant rows as `information_schema` reports them, from `grantsFor` itself.
 *
 * TWO LEVELS, because Postgres has two views and they disagree on purpose:
 * `role_table_grants` holds only table-wide privileges, while
 * `column_privileges` ALSO EXPANDS a table-wide grant across every column —
 * measured on a real PostgreSQL 16, not read off the docs. So a column-scoped
 * grant emits one `column` row per column and a table-wide one emits a single
 * `table` row, which is exactly what `liveGrantAccess` has to tell apart.
 *
 * SPLIT WITH THE PRODUCT'S OWN `splitPrivileges`, never a second parser here:
 * `INSERT ("a","b"), UPDATE ("a","b")` is one statement whose commas are inside
 * the column lists, and a flat split on it is what produced the column
 * `"update(title"` before a real Postgres disagreed.
 */
function grantRows(t, cols) {
  const out = [];
  for (const stmt of grantsFor(t, cols)) {
    const m = /^GRANT\s+([\s\S]+?)\s+ON\s+"([^"]+)"\s+TO\s+(\w+)/i.exec(stmt);
    if (!m) continue; // a REVOKE is not a privilege held
    for (const { verb, cols: c } of splitPrivileges(m[1])) {
      if (c) for (const one of c) out.push({ t: m[2], g: m[3], p: verb, lvl: "column", col: one });
      else out.push({ t: m[2], g: m[3], p: verb, lvl: "table", col: "" });
    }
  }
  return out;
}

/**
 * Policy rows as `pg_policies` reports them, from `policiesFor` itself.
 *
 * READ WITH THE PRODUCT'S OWN `readParens`, never a flat `[\s\S]*?\)`. A
 * `trash` table's predicate is `((owner_id = app_user_id()) AND "t"."deleted_at"
 * IS NULL)` and a flat reader stops at the first `)` — dropping exactly the
 * token this file's whole flag-preservation case is about, and passing.
 */
function policyRows(t) {
  const out = [];
  for (const stmt of policiesFor(t)) {
    const s = String(stmt);
    const m = /CREATE POLICY\s+\S+\s+ON\s+"([^"]+)"\s+FOR\s+(\w+)/i.exec(s);
    if (!m) continue;
    const u = /\bUSING\s*\(/i.exec(s), c = /\bWITH\s+CHECK\s*\(/i.exec(s);
    out.push({
      t: m[1], c: m[2].toUpperCase(),
      q: u ? readParens(s, u.index + u[0].length - 1) : "",
      w: c ? readParens(s, c.index + c[0].length - 1) : "",
    });
  }
  return out;
}

test("every read x write cell round-trips through the real grant and policy emitters", () => {
  const cols = ["a", "b"];
  let exact = 0, ambiguous = [];
  for (const read of READ_LEVELS) {
    for (const write of WRITE_LEVELS) {
      const t = { name: "t", read, write, columns: cols.map((n) => ({ name: n, type: "text" })) };
      const got = deriveAccess({ table: "t", grants: grantRows(t, cols), policies: policyRows(t) });
      // `read: own` + `write: anyone` is the ONE combination the engine refuses
      // and rewrites (`resolveAccess` answers `read: none`), so the emitter
      // never produces it and the derivation cannot be expected to answer it.
      const expect = (read === "own" && write === "anyone") ? { read: "none", write } : { read, write };
      if (got && got.read === expect.read && got.write === expect.write) { exact++; continue; }
      ambiguous.push({ read, write, got });
    }
  }
  // THE OBSERVER IS PROVED ALIVE before any absence is believed: a derivation
  // that answered null for everything would have an empty `ambiguous` list of
  // its own kind and look like a clean run.
  // ALL SIXTEEN, and the number is exact rather than a floor: a floor is what
  // let the `members`-reads-as-`own` bug sit under a passing assertion while
  // seven cells were wrong.
  assert.equal(exact, 16, `only ${exact} of 16 cells round-tripped: ${JSON.stringify(ambiguous)}`);
  // AND WHATEVER DOES NOT ROUND-TRIP ANSWERS null, NEVER A GUESS. A wrong pair
  // written back would have the next apply re-issue grants on a live table.
  for (const a of ambiguous) assert.equal(a.got, null, "an underivable cell was guessed at: " + JSON.stringify(a));
});

test("with the policies unread, own and members are refused rather than guessed", () => {
  const cols = ["a"];
  const t = { name: "t", read: "own", write: "own", columns: [{ name: "a", type: "text" }] };
  const grants = grantRows(t, cols);
  assert.ok(deriveAccess({ table: "t", grants, policies: policyRows(t) }), "the control: with policies it derives");
  assert.equal(deriveAccess({ table: "t", grants, policies: [], policiesRead: false }), null,
    "with the policies unread, own and members were separated anyway — on what evidence?");
});

test("the collect table run 46 really made derives as read none / write anyone", () => {
  // THE LIVE SHAPE, not an invented one: `bookings` on repairbench-1.
  const cols = ["customer_name", "bike", "drop_off_day"];
  const t = { name: "bookings", access: "collect", columns: cols.map((n) => ({ name: n, type: "text" })) };
  assert.deepEqual(deriveAccess({ table: "bookings", grants: grantRows(t, cols), policies: policyRows(t) }),
    { read: "none", write: "anyone" });
});

// ── The reconcile ────────────────────────────────────────────────────────────

function liveOf(tables) {
  const columns = [], grants = [], policies = [];
  for (const t of tables) {
    const cols = t.columns.map((c) => c.name);
    // The engine's own columns, from the table's own flags — so a `trash` table
    // really carries `deleted_at` here and `deriveFlags` has something to read.
    const managed = ["id", "created_at"];
    for (const d of DERIVED_FLAGS) if (d.column && t[d.flag]) managed.push(d.column);
    if (["own", "members"].includes(String(t.write || ""))) managed.push("owner_id");
    for (const c of [...managed, ...cols]) columns.push({ t: t.name, c, ty: "text" });
    grants.push(...grantRows(t, cols));
    policies.push(...policyRows(t));
  }
  return { columns, grants, policies, triggers: [] };
}

test("run 47's own state: bookings is recovered, repairs is kept, and the spec is otherwise untouched", () => {
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "customer_name", type: "text" }, { name: "bike", type: "text" }, { name: "drop_off_day", type: "text" }] };
  const repairs = { name: "repairs", read: "none", write: "none", columns: [{ name: "customer_name", type: "text" }] };
  // What run 47 left in `_meta.schema`: only the table it made.
  const stored = { tables: [repairs], functions: [{ name: "count_booked_repairs" }], apis: [], jobs: [] };
  const out = reconcileSpec({ stored, live: liveOf([bookings, repairs]), emit: REAL });

  assert.deepEqual(out.kept, ["repairs"]);
  assert.deepEqual(out.recovered.map((r) => r.name), ["bookings"]);
  assert.deepEqual(out.ambiguous, []);
  assert.equal(out.changed, true);
  // THE ACCESS IS RECOVERED, not defaulted: `collect` is what run 46 declared.
  const back = out.spec.tables.find((t) => t.name === "bookings");
  assert.equal(back.read, "none");
  assert.equal(back.write, "anyone");
  // THE STORED ENTRY IS UNTOUCHED — it carries metadata no catalog can rebuild.
  assert.equal(out.spec.tables.find((t) => t.name === "repairs"), repairs, "the stored table was rewritten rather than kept");
  // AND EVERYTHING ELSE IN THE SPEC SURVIVES.
  assert.deepEqual(out.spec.functions, stored.functions);
  // MANAGED COLUMNS ARE NOT DECLARED — the engine creates them from the flags.
  assert.deepEqual(back.columns.map((c) => c.name), ["customer_name", "bike", "drop_off_day"]);
});

test("a second run of the reconcile finds nothing to do", () => {
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  const first = reconcileSpec({ stored: { tables: [] }, live, emit: REAL });
  assert.equal(first.changed, true);
  const second = reconcileSpec({ stored: first.spec, live, emit: REAL });
  assert.equal(second.changed, false, "the recovery is not idempotent");
  assert.deepEqual(second.recovered, []);
});

test("a table whose access cannot be derived is NAMED and left out, never guessed into the spec", () => {
  const t = { name: "members_only", read: "own", write: "own", columns: [{ name: "a", type: "text" }] };
  const live = liveOf([t]);
  const out = reconcileSpec({ stored: { tables: [] }, live: { ...live, policies: [], policiesRead: false }, emit: REAL });
  assert.deepEqual(out.recovered, []);
  assert.deepEqual(out.ambiguous.map((a) => a.name), ["members_only"]);
  assert.equal(out.changed, false, "an underivable table was written into the spec anyway");
});

test("internal tables are never recovered, and the flags a catalog cannot prove are named", () => {
  const t = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([t]);
  live.columns.push({ t: "_meta", c: "k", ty: "text" }, { t: "_users", c: "id", ty: "text" });
  const out = reconcileSpec({ stored: { tables: [] }, live, emit: REAL });
  assert.deepEqual(out.recovered.map((r) => r.name), ["bookings"], "an internal table was recovered into the spec");
  assert.ok(isInternalName("_meta") && !isInternalName("bookings"));
  // THE LIMITATION IS REPORTED RATHER THAN LEFT TO BE INFERRED.
  //
  // RE-ANCHORED 2026-09-15 ON THE PROPERTY, NOT THE NAME. This asserted
  // `unprovable.includes("payment")`, and `payment` moved OFF that list for a
  // reason worth stating: it is not a flag a recovery merely fails to rebuild,
  // it is one whose presence STOPS the table (`UNDERIVABLE_EVIDENCE`), because
  // `normalizePayment` answers a configuration object naming a catalogue table
  // and its two columns, and the round-trip cannot see the difference — a
  // payable table's permission surface is empty either way. So both halves are
  // asserted: the list still names flags nothing in the database can show, and
  // `payment` is refused at the table instead of listed as a caveat.
  assert.ok(UNPROVABLE_FLAGS.includes("writeRoles"), "the flags a recovery cannot rebuild are not named");
  assert.ok(out.unprovable.length > 0, "nothing was named as unprovable on a run that recovered a table");
  assert.ok(!UNPROVABLE_FLAGS.includes("payment"), "payment is a refusal, not a caveat — it must not be both");
  assert.ok(UNDERIVABLE_EVIDENCE.some((e) => e.columns.includes("payment_status")),
    "a payable table is no longer stopped, so its checkout configuration would be silently dropped");
  assert.deepEqual(reconcileSpec({ stored: { tables: [t] }, live, emit: REAL }).unprovable, [],
    "flags are named even when nothing was recovered, which reads as a warning about nothing");
});

test("a payable table is REFUSED rather than recovered, and the round-trip cannot see why", () => {
  // `payment` is `{from, price, name, currency}` — the catalogue a basket is
  // priced from. No catalog read can rebuild it.
  const t = { name: "orders", access: "collect", columns: [{ name: "item", type: "text" }], payment: { from: "menu", price: "price", name: "dish" } };
  const live = liveOf([t]);
  for (const c of ["payment_status", "payment_ref", "amount_total", "currency", "paid_at"]) live.columns.push({ t: "orders", c, ty: "text" });
  const out = reconcileSpec({ stored: { tables: [] }, live, emit: REAL });
  assert.deepEqual(out.recovered, []);
  assert.deepEqual(out.uncertain.map((u) => u.why), ["payment-config-not-derivable"]);

  // AND THE ROUND-TRIP WOULD HAVE PASSED IT — measured, not asserted from the
  // shape of the code. A payable table emits no write grant and no write policy,
  // and neither does a `{read:"none", write:"none"}` declaration, so the
  // comparison is between two empty surfaces. This is why the refusal is a
  // separate check rather than something the verification catches.
  const asIfNotPayable = { name: "orders", columns: [{ name: "item", type: "text" }], read: "none", write: "none" };
  assert.equal(verifyDeclaration({ table: "orders", declared: asIfNotPayable, live, emit: REAL }).ok, true,
    "the round-trip now sees the payment difference, so the separate refusal may be redundant — measure before removing it");
});

test("MANAGED_COLUMNS is the set the engine really creates", () => {
  // A SECOND COPY OF THE ENGINE'S OWN LIST, so it is checked against the engine
  // rather than trusted. `site-schema.mjs` adds each of these itself, from the
  // table's flags; a recovered table must declare none of them.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  for (const c of ["owner_id", "deleted_at", "updated_at", "position", "pinned"]) {
    assert.ok(new RegExp('ADD COLUMN IF NOT EXISTS "' + c + '"').test(src),
      c + " is in MANAGED_COLUMNS and the engine no longer creates it");
    assert.ok(MANAGED_COLUMNS.has(c));
  }
  assert.ok(MANAGED_COLUMNS.has("id") && MANAGED_COLUMNS.has("created_at"));
  assert.ok(!MANAGED_COLUMNS.has("who"), "an ordinary column is being stripped from recovered tables");
});

test("the catalog queries ask for what the derivation reads, including COLUMN privileges", () => {
  // THE COLUMN HALF IS LOAD-BEARING. Since 2026-09-13 the write grants are
  // column-scoped, so a reader that consulted only `role_table_grants` would
  // derive `write: "none"` for every booking form on the platform — the
  // commonest table there is.
  assert.match(RECOVER_QUERIES.grants, /column_privileges/);
  assert.match(RECOVER_QUERIES.grants, /role_table_grants/);
  assert.match(RECOVER_QUERIES.columns, /BASE TABLE/, "views would be recovered as tables");
  assert.match(RECOVER_QUERIES.policies, /pg_policies/);
});

// ── The fingerprints, and the two real Postgres found wrong ─────────────────

test("a predicate is fingerprinted by the facts it turns on, not by its text", () => {
  // POSTGRES DOES NOT STORE A PREDICATE AS IT WAS WRITTEN. `policiesFor` emits
  // `"notes"."owner_id" = app_user_id()`; `pg_policies` reports
  // `(owner_id = app_user_id())`. Both must fingerprint the same or every
  // correct pair reads as a mismatch.
  assert.equal(predicateShape('("notes"."owner_id" = app_user_id())'), predicateShape("(owner_id = app_user_id())"));
  assert.equal(predicateShape('(("notes"."owner_id" = app_user_id()) AND "notes"."deleted_at" IS NULL)'),
    predicateShape("((owner_id = app_user_id()) AND (deleted_at IS NULL))"));

  // THE TABLE QUALIFIER WAS THE BUG, found by a real Postgres 16 and by nothing
  // else: the emitted side carried a bare `notes` into the residue and fired
  // `other` on all four commands of every member table. A fixture could not
  // show it, because a fixture writes both sides in one hand.
  assert.ok(!predicateShape('("notes"."owner_id" = app_user_id())').includes("other"),
    "the table qualifier is being read as an unrecognised term again");

  // OWN AND MEMBERS ARE THE EQUALITY, not the function — both mention it.
  assert.equal(predicateShape("(owner_id = app_user_id())"), "own");
  assert.equal(predicateShape("(app_user_id() IS NOT NULL)"), "members");
  assert.notEqual(predicateShape("(owner_id = app_user_id())"), predicateShape("(app_user_id() IS NOT NULL)"));

  // `other` IS THE FAIL-CLOSED CASE. Without it an unrecognised predicate and
  // `USING (true)` would both fingerprint empty, so a hand-written policy on
  // somebody's table would compare equal to no policy at all.
  assert.equal(predicateShape("(true)"), "");
  assert.equal(predicateShape(""), "");
  assert.equal(predicateShape("(status = 'live')"), "other");
  assert.notEqual(predicateShape("(status = 'live')"), predicateShape("(true)"));
});

test("a GRANT's privileges split at depth zero, and the verb comes from before the ON", () => {
  // THE MEMBER-WRITE CELL EMITS ONE STATEMENT WITH TWO COLUMN LISTS, and a flat
  // `split(",")` on it produced the column `"update(title"`. That is `user` and
  // `feed` — half the platform.
  assert.deepEqual(splitPrivileges('INSERT ("body","title"), UPDATE ("body","title")'), [
    { verb: "INSERT", cols: ["body", "title"] },
    { verb: "UPDATE", cols: ["body", "title"] },
  ]);
  assert.deepEqual(splitPrivileges("SELECT, DELETE"), [{ verb: "SELECT", cols: null }, { verb: "DELETE", cols: null }]);

  // AND THE VERB COMES FROM BEFORE THE `ON`: `GRANT SELECT ON "update"` contains
  // the word UPDATE, the recorded on-split finding.
  const onUpdate = emittedGrantAccess(['GRANT SELECT ON "update" TO anonymous;']);
  assert.deepEqual(Object.keys(onUpdate), ["anonymous:SELECT"]);
});

test("a table-wide grant and a column-scoped one are told apart by `lvl`, which is why the query carries it", () => {
  // MEASURED ON A REAL POSTGRES 16: `column_privileges` EXPANDS a table-level
  // grant across every column. So the column list means "column-scoped" only
  // where `role_table_grants` has no row for the same pair — and reading the
  // view alone would call a table-wide grant a narrow one.
  const rows = [
    { t: "t", g: "anonymous", p: "SELECT", lvl: "table", col: "" },
    { t: "t", g: "anonymous", p: "SELECT", lvl: "column", col: "a" },
    { t: "t", g: "anonymous", p: "SELECT", lvl: "column", col: "b" },
    { t: "t", g: "anonymous", p: "INSERT", lvl: "column", col: "a" },
  ];
  const live = liveGrantAccess(rows, "t");
  assert.equal(live["anonymous:SELECT"], "*", "a table-wide grant was read as a column list");
  assert.deepEqual(live["anonymous:INSERT"], ["a"]);
  assert.match(RECOVER_QUERIES.grants, /'table' AS lvl/, "the query stopped carrying the level, so the two are indistinguishable");
  assert.match(RECOVER_QUERIES.grants, /'column' AS lvl/);
});

test("the round-trip is the wall: `trash` survives, and a widening never does", () => {
  // THE NAMED DEFECT. A `trash` table recovered without the flag emits
  // `USING (owner_id = app_user_id())` where the database has
  // `... AND deleted_at IS NULL` — every soft-deleted row visible again on the
  // next schema change, days later, with nothing connecting the two.
  const notes = { name: "notes", read: "own", write: "own", trash: true, columns: [{ name: "body", type: "text" }] };
  const live = liveOf([notes]);

  const withFlag = { name: "notes", read: "own", write: "own", trash: true, columns: [{ name: "body", type: "text" }] };
  assert.equal(verifyDeclaration({ table: "notes", declared: withFlag, live, emit: REAL }).ok, true);

  const without = { name: "notes", read: "own", write: "own", columns: [{ name: "body", type: "text" }] };
  const bad = verifyDeclaration({ table: "notes", declared: without, live, emit: REAL });
  assert.equal(bad.ok, false);
  assert.equal(bad.why, "policy-would-change");
  assert.ok(bad.policyDiff.some((d) => d.cmd === "SELECT" && /deleted_at/.test(d.live) && !/deleted_at/.test(d.would)),
    "the diff does not name the filter that would be lost: " + JSON.stringify(bad.policyDiff));

  // AND THE GRANT HALF IS ONE-SIDED ON PURPOSE. A recovery may not let a client
  // write a column the database does not already let them write; a NARROWING —
  // which is what the 2026-09-13 column-scope fix does on its own — passes.
  const wide = liveOf([notes]);
  for (const g of wide.grants) if (g.lvl === "column") { g.lvl = "table"; g.col = ""; }
  assert.equal(verifyDeclaration({ table: "notes", declared: withFlag, live: wide, emit: REAL }).ok, true,
    "a site still on table-wide write grants cannot be repaired, which punishes the sites that need it most");

  // THE WIDENING THAT MATTERS IS A COLUMN THE DATABASE REALLY HAS AND DOES NOT
  // GRANT — `approval` and `sequence` name their column in the flag, so it is
  // indistinguishable from an ordinary declared one and recovering it that way
  // makes an endpoint-set column client-writable. `grantsFor` is handed the
  // REALLY-CREATED list, so the column has to be in `live.columns` for the
  // emitter to name it: without that this case proves nothing.
  const withCol = { columns: [...live.columns, { t: "notes", c: "approval_status", ty: "text" }], grants: live.grants, policies: live.policies };
  const widened = { ...withFlag, columns: [{ name: "body", type: "text" }, { name: "approval_status", type: "text" }] };
  const w = verifyDeclaration({ table: "notes", declared: widened, live: withCol, emit: REAL });
  assert.equal(w.ok, false, "a recovery that would make an engine-owned column client-writable was accepted");
  assert.equal(w.why, "grant-would-widen");
  assert.ok(JSON.stringify(w.grantDiff).includes("approval_status"), "the diff does not name the column that would be opened");

  // WITH NO EMITTERS, NOTHING IS VERIFIABLE AND NOTHING MAY BE STORED.
  assert.equal(verifyDeclaration({ table: "notes", declared: withFlag, live }).ok, false);
  assert.equal(verifyDeclaration({ table: "notes", declared: withFlag, live }).why, "no-emitters");
  assert.deepEqual(reconcileSpec({ stored: { tables: [] }, live }).recovered, [],
    "a reconcile with no way to verify recovered something anyway");
});

test("flags are derived from the artifacts the engine leaves, and the trigger separates sync from timestamps", () => {
  const cols = (t, names) => names.map((c) => ({ t, c, ty: "text" }));
  assert.deepEqual(deriveFlags({ table: "n", columns: cols("n", ["id", "deleted_at", "position"]), triggers: [] }),
    { trash: true, ordered: true });
  // `sync` AND `timestamps` BOTH CREATE `updated_at`. Without the trigger read a
  // `sync` table recovers as `timestamps` and its `_deletes` machinery stops
  // being re-created.
  assert.deepEqual(deriveFlags({ table: "n", columns: cols("n", ["updated_at"]), triggers: [] }), { timestamps: true });
  assert.deepEqual(deriveFlags({ table: "n", columns: cols("n", ["updated_at"]), triggers: [{ t: "n", g: "trg_n_del" }] }),
    { timestamps: true, sync: true });
  // ANOTHER TABLE'S COLUMNS ARE NOT THIS TABLE'S EVIDENCE.
  assert.deepEqual(deriveFlags({ table: "n", columns: cols("other", ["deleted_at"]), triggers: [] }), {});
  // AND THE MAPPING IS CHECKED AGAINST THE ENGINE'S OWN DDL, DERIVED FROM IT.
  //
  // The trigger names are COMPOSED (`"trg_" + t.name + "_aud_" + suffix`), so
  // the literal in the source is a PREFIX of the name the engine creates. The
  // prefixes are read out of the file rather than typed here, or this census
  // becomes the second copy it exists to prevent.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const prefixes = [...src.matchAll(/"trg_" \+ t\.name \+ "_([a-z_]*)"/g)].map((m) => m[1]);
  assert.ok(prefixes.length >= 4, "the trigger-name scan found nothing, so every absence below is the scanner's");
  for (const d of DERIVED_FLAGS) {
    if (d.column) assert.ok(new RegExp('"' + d.column + '"').test(src), d.flag + " names a column the engine never creates");
    if (d.trigger) {
      assert.ok(prefixes.some((p) => p && d.trigger.startsWith(p)),
        d.flag + " names a trigger the engine never creates: trg_<t>_" + d.trigger + " (engine writes " + JSON.stringify(prefixes) + ")");
      assert.ok(new RegExp("t\\." + d.flag + "\\b").test(src), d.flag + " is not a flag the engine reads");
    }
  }
});

test("prior metadata is preferred verbatim over anything derived, and is still verified", () => {
  // "RECOVER FROM AUTHORITATIVE PRIOR METADATA WHERE AVAILABLE" — the parameter
  // exists because a derived declaration should never be preferred to a
  // recorded one. THIS REPOSITORY HAS NO AUTOMATIC SOURCE FOR IT and the module
  // says so: the migration record keeps NAMES only, and
  // `source/<slug>/addon-answer.json` is one file per site, overwritten by each
  // addon. Asserted here so a later session does not read the parameter as a
  // promise that one exists.
  const notes = { name: "notes", read: "own", write: "own", trash: true, columns: [{ name: "body", type: "text" }] };
  const live = liveOf([notes]);
  const prior = [{ name: "notes", read: "own", write: "own", trash: true, timestamps: true, columns: [{ name: "body", type: "text" }] }];
  const out = reconcileSpec({ stored: { tables: [] }, live, prior, emit: REAL });
  assert.deepEqual(out.recovered.map((r) => r.source), ["prior"]);
  const back = out.spec.tables.find((t) => t.name === "notes");
  assert.equal(back.timestamps, true, "a recorded flag the catalog cannot see was dropped");

  // STILL VERIFIED. A prior declaration that no longer matches the database is
  // uncertain like any other — the store may be stale.
  const stale = [{ name: "notes", read: "public", write: "anyone", columns: [{ name: "body", type: "text" }] }];
  const bad = reconcileSpec({ stored: { tables: [] }, live, prior: stale, emit: REAL });
  assert.deepEqual(bad.recovered, []);
  assert.deepEqual(bad.uncertain.map((u) => u.source), ["prior"]);

  const mod = fs.readFileSync(new URL("../site-schema-recover.mjs", import.meta.url), "utf8");
  assert.match(mod, /NO AUTOMATIC SOURCE FOR `prior`/,
    "the module stopped saying that nothing here supplies prior metadata, which reads as a promise that something does");
});

// ── The script ───────────────────────────────────────────────────────────────

test("the script previews by default and writes only under --apply", () => {
  assert.equal(parseArgs([]).mode, "preview");
  assert.equal(parseArgs(["--apply"]).mode, "apply");
  assert.equal(parseArgs(["--verify"]).mode, "verify");
  assert.equal(parseArgs(["--apply", "--slug", "repairbench-1"]).slug, "repairbench-1");
  // AND NOTHING HERE DESTROYS ANYTHING.
  const src = fs.readFileSync(new URL("../scripts/backend-repair.mjs", import.meta.url), "utf8");
  assert.ok(!/\bDROP\s+(TABLE|DATABASE|COLUMN)\b/i.test(src), "the repair script contains a DROP");
  assert.ok(!/\bDELETE\s+FROM\b/i.test(src), "the repair script deletes rows");
});

test("the apply gate is DRIVEN, not read: a preview writes nothing and an apply writes the reference", async () => {
  // RE-ANCHORED 2026-09-15, and the anchor is GONE rather than moved. This was
  // `indexOf('if (args.mode !== "apply")')` in `main` with the two writes
  // asserted to sit below it — a POSITION, which is a claim about run order only
  // while the code between is straight-line, and the gate has since moved into
  // `repairSite`. Driving it answers the same question and cannot be satisfied
  // by an `if (false)` that leaves every landmark where it was.
  const writes = [];
  const site = { slug: "s1", state: "incomplete", act: "backfill", db: "site_s1", uid: "u1",
                 conn: "postgres://u:p@h/site_s1", projectSlug: "s1" };
  const sql = async (q) => {
    if (/current_database/.test(q)) return [{ db: "site_s1" }];
    if (/INSERT INTO _meta/.test(q)) { writes.push("meta"); return []; }
    return [];
  };
  const write = async () => { writes.push("ref"); return { wrote: true }; };

  const pre = await repairSite({ site, sql, write, mode: "preview", emit: REAL });
  assert.deepEqual(writes, [], "a preview wrote something");
  assert.equal(pre.ref.act, "would-write");

  const app = await repairSite({ site, sql, write, mode: "apply", emit: REAL });
  assert.deepEqual(writes, ["ref"], "the apply did not write the reference");
  assert.equal(app.ref.act, "written");
});

test("a credential can never reach the log, and the host deliberately survives", () => {
  const msg = "connect ECONNREFUSED postgres://neondb_owner:npg_SECRET@ep-cool-1.neon.tech/site_x";
  const out = safeErr(new Error(msg));
  assert.ok(!out.includes("npg_SECRET"), "a password reached the log: " + out);
  assert.ok(out.includes("ep-cool-1.neon.tech"), "the host was scrubbed too, so the report names no database");
  assert.match(out, /postgres:\/\/\*\*\*@/);
});

test("identity is the AUTHORITATIVE MAPPING, and nothing less than the whole chain is proof", async () => {
  // RE-ANCHORED 2026-09-15 — and this is a PROPERTY change, not a spelling one,
  // so the old assertions are gone rather than moved. `proveIdentity` used to
  // compare the catalog with `_meta` FROM THAT SAME DATABASE, which establishes
  // that a database is internally consistent and says nothing whatever about
  // whose it is; and it answered `ok: true, unproven: true` for a database
  // holding a stranger's tables, which the only caller read as `ok`. The chain
  // is from the site's own slug outward now, and every link is required.
  const server = (name) => async (q) => (/current_database/.test(q) ? [{ db: name }] : []);
  const base = { slug: "repairbench-1", expectDb: "site_repairbench_1", conn: "postgres://u:p@h/site_repairbench_1", projectSlug: "repairbench-1" };

  const yes = await proveIdentity({ ...base, sql: server("site_repairbench_1") });
  assert.equal(yes.proven, true);
  assert.equal(yes.ok, true);

  // LINK 1: the credential must be THIS site's `site_project` row.
  const wrongProject = await proveIdentity({ ...base, projectSlug: "someone-else-1", sql: server("site_repairbench_1") });
  assert.equal(wrongProject.proven, false);
  assert.equal(wrongProject.why, "no-project-row-for-this-slug");
  const noProject = await proveIdentity({ ...base, projectSlug: null, sql: server("site_repairbench_1") });
  assert.equal(noProject.proven, false);

  // LINK 2: the connection must NAME the database about to be recorded, or the
  // row ends up naming a database nothing connects to.
  const wrongPath = await proveIdentity({ ...base, conn: "postgres://u:p@h/neondb", sql: server("site_repairbench_1") });
  assert.equal(wrongPath.proven, false);
  assert.equal(wrongPath.why, "connection-does-not-name-the-intended-database");

  // LINK 3: THE SERVER MUST AGREE. This is the link a pooler, a rewritten path
  // or a copied credential cannot fake, and it is the one the old shape had no
  // equivalent of at all.
  const wrongServer = await proveIdentity({ ...base, sql: server("site_someone_else") });
  assert.equal(wrongServer.proven, false);
  assert.equal(wrongServer.why, "server-answers-a-different-database");
  const silent = await proveIdentity({ ...base, sql: async () => [] });
  assert.equal(silent.proven, false, "a server that answered nothing was read as agreeing");

  // AND THERE IS NO "PROBABLY". Every answer is `proven` true or false; a
  // field that said `ok: true` beside `unproven: true` is what let the write
  // happen.
  for (const r of [yes, wrongProject, noProject, wrongPath, wrongServer, silent]) {
    assert.equal(typeof r.proven, "boolean");
    assert.equal(r.ok, r.proven, "ok and proven disagree, which is how the old shape leaked");
    assert.equal(r.unproven, undefined, "the `unproven` half-answer is back");
  }
});

test("the WRITER is the wall: an unproven identity never reaches the network", async () => {
  // A WALL NOBODY CAN DRIVE IS A WALL NOBODY IS GUARDING, so the refusal sits
  // in the only function that can write rather than at its call site — and a
  // mutation removing it has an observable effect from outside. `fetch` is
  // replaced by a recorder that FAILS the case if it is ever reached.
  const real = globalThis.fetch;
  let reached = 0;
  globalThis.fetch = async () => { reached++; return new Response("[]", { headers: { "content-type": "application/json" } }); };
  try {
    for (const proof of [null, undefined, {}, { ok: true }, { proven: false, why: "x" }, { proven: "yes" }]) {
      const w = await writeRef("KEY", "s", "u", "db", proof);
      assert.equal(w.wrote, false);
      assert.equal(w.refused, "identity-not-proven", "a proof of " + JSON.stringify(proof) + " was accepted");
    }
    assert.equal(reached, 0, "an unproven identity reached Supabase");
    // THE CONTROL: with a real proof it DOES go. Without this the refusal above
    // could be a function that never writes at all.
    await writeRef("KEY", "s", "u", "db", { ok: true, proven: true });
    assert.equal(reached, 1, "a proven identity did not reach the store — the refusal is unconditional");
  } finally { globalThis.fetch = real; }
});

test("the reference and the schema are separate tasks, and a `ready` site is still visited", async () => {
  // THE SEPARATION ITSELF. `main` filtered on `act === "backfill"`, so the
  // moment a reference was written that site dropped out of the work list and a
  // rerun could never finish its schema recovery.
  const rows = [
    { slug: "a", state: "ready", act: "skip" },
    { slug: "b", state: "incomplete", act: "backfill" },
    { slug: "c", state: "none", act: "skip" },
    { slug: "d", state: "unreadable", act: "skip" },
  ];
  assert.deepEqual(workList(rows).map((r) => r.slug), ["a", "b"],
    "a site with a good reference and a broken declaration is not visited");

  // AND THE RERUN IS WHAT FINISHES THE JOB — driven end to end. Run one writes
  // the reference and the recovery fails; run two, with the site now `ready`,
  // completes the recovery. Neither task gates the other.
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  let meta = null, permsWork = false;
  const sql = async (q, p) => {
    if (/current_database/.test(q)) return [{ db: "site_s1" }];
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/role_table_grants/.test(q)) { if (!permsWork) throw new Error("connection terminated"); return live.grants; }
    if (/pg_policies/.test(q)) return live.policies;
    if (/pg_trigger/.test(q)) return [];
    if (/INSERT INTO _meta/.test(q)) { meta = JSON.parse(p[0]); return []; }
    if (/_meta/.test(q)) return [{ v: JSON.stringify({ tables: [] }) }];
    return [];
  };
  let wrote = 0;
  const write = async () => { wrote++; return { wrote: true }; };
  const first = { slug: "s1", state: "incomplete", act: "backfill", db: "site_s1", uid: "u1", conn: "postgres://u:p@h/site_s1", projectSlug: "s1" };

  const r1 = await repairSite({ site: first, sql, write, mode: "apply", emit: REAL });
  assert.equal(r1.ref.act, "written", "the reference did not go");
  assert.equal(r1.schema.act, "failed", "the recovery was expected to fail on the permission read");
  assert.equal(meta, null, "a failed recovery wrote a spec anyway");
  assert.equal(wrote, 1);

  // THE RERUN. The site is `ready` now — the state that used to drop it.
  permsWork = true;
  const second = { ...first, state: "ready", act: "skip" };
  assert.ok(workList([second]).length, "the repaired site fell out of the work list");
  const r2 = await repairSite({ site: second, sql, write, mode: "apply", emit: REAL });
  assert.equal(r2.ref.act, "skip", "a ready reference was written over");
  assert.equal(r2.ref.why, "already-recorded");
  assert.equal(wrote, 1, "the rerun wrote the reference a second time");
  assert.equal(r2.schema.act, "recovered");
  assert.deepEqual(r2.schema.recovered.map((x) => x.name), ["bookings"]);
  assert.deepEqual((meta.tables || []).map((t) => t.name), ["bookings"], "the recovered spec never reached `_meta`");
});

test("--verify CONNECTS and reads the postconditions back", async () => {
  // IT USED TO PARSE THE FLAG AND THEN DO NOTHING BUT SKIP THE WRITES, which is
  // a mode that reports on a run it never made.
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  const sqlFor = (dbName, spec) => async (q) => {
    if (/current_database/.test(q)) return [{ db: dbName }];
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/_meta/.test(q)) return [{ v: JSON.stringify(spec) }];
    return [];
  };
  const db = dbNameForSite("repairbench-1");
  const site = { slug: "repairbench-1", state: "ready", act: "skip", db, uid: "u", conn: "postgres://u:p@h/" + db, projectSlug: "repairbench-1" };

  const ok = await verifySite({ site, sql: sqlFor(db, { tables: [bookings] }) });
  assert.equal(ok.ok, true, JSON.stringify(ok.checks));
  assert.ok(ok.checks.length >= 5, "a verify that asked fewer than five questions cannot have connected");

  // THE POSTCONDITION THAT MATTERS: a live table the stored spec does not
  // declare is the run-47 state, and it must FAIL the verify.
  const missing = await verifySite({ site, sql: sqlFor(db, { tables: [] }) });
  assert.equal(missing.ok, false);
  assert.ok(missing.checks.some((c) => !c.ok && /every live table declared/.test(c.name)));

  // A SITE WHOSE REFERENCE IS STILL BLANK FAILS TOO.
  const blank = await verifySite({ site: { ...site, state: "incomplete", db: "" }, sql: sqlFor(db, { tables: [bookings] }) });
  assert.equal(blank.ok, false);
});

test("a stored spec that cannot be READ stops the recovery; one that is merely ABSENT does not", async () => {
  // RE-ANCHORED 2026-09-15 on the distinction that was missing. The first cut
  // answered `stored-spec-unreadable` for BOTH of these, so a database with no
  // `_meta` row and real tables — the exact state this repair is for — had its
  // one table left unrecovered with nothing saying so. Both halves are asserted
  // here, because appeasing the first without adding the second would be the
  // same as deleting the check.
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  const sql = (metaAnswer) => async (q) => {
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/role_table_grants/.test(q)) return live.grants;
    if (/pg_policies/.test(q)) return live.policies;
    if (/pg_trigger/.test(q)) return [];
    if (/_meta/.test(q)) return metaAnswer();
    return [];
  };

  // A READ THAT THREW: unknown, and nothing may be written.
  const broke = await recoverSchema(sql(() => { throw new Error("connection terminated"); }), { emit: REAL });
  assert.equal(broke.ok, false);
  assert.match(broke.why, /^unreadable:/);

  // STORED AND UNPARSEABLE: also unknown.
  const junk = await recoverSchema(sql(() => [{ v: "{not json" }]), { emit: REAL });
  assert.equal(junk.ok, false);
  assert.match(junk.why, /^unreadable:/);

  // ABSENT, with the catalog holding a table: RECOVERABLE, and recovered.
  const gone = await recoverSchema(sql(() => { throw new Error('relation "_meta" does not exist'); }), { emit: REAL });
  assert.equal(gone.ok, true, "a missing `_meta` was read as a read failure");
  assert.equal(gone.why, "tables-without-metadata");
  assert.deepEqual(gone.recovered.map((r) => r.name), ["bookings"]);

  // ABSENT, with the catalog holding NOTHING: genuinely empty, nothing to do.
  const emptySql = async (q) => {
    if (/_meta/.test(q)) return [];
    return [];
  };
  const empty = await recoverSchema(emptySql, { emit: REAL });
  assert.equal(empty.ok, true);
  assert.equal(empty.why, "empty");
  assert.equal(empty.changed, false);

  // AND THE PERMISSION SURFACE IS REQUIRED. Recovering against an empty grant
  // list would derive `read:"none", write:"none"` for every table on the site.
  const noPerms = async (q) => {
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/role_table_grants/.test(q)) throw new Error("connection terminated");
    if (/_meta/.test(q)) return [{ v: JSON.stringify({ tables: [] }) }];
    return [];
  };
  const blind = await recoverSchema(noPerms, { emit: REAL });
  assert.equal(blind.ok, false);
  assert.equal(blind.why, "permissions-unreadable");
});

test("the catalog is asked BEFORE `_meta`, so `empty` is a measurement and not an inference", async () => {
  // THE ORDER IS THE FIX. Asking `_meta` first and answering `{tables: []}` on a
  // miss is an inference from the absence of ONE ROW to the absence of every
  // table — run 47's own defect, with a different cause.
  const asked = [];
  const sql = async (q) => {
    asked.push(/information_schema\.columns/.test(q) ? "catalog" : (/_meta/.test(q) ? "meta" : "other"));
    if (/information_schema\.columns/.test(q)) return [{ t: "bookings", c: "who", ty: "text" }];
    return [];
  };
  const st = await readSchemaState({ sql });
  assert.equal(asked[0], "catalog", "`_meta` was asked first, so an absent row could decide emptiness");
  assert.equal(st.state, "tables-without-metadata");
  assert.deepEqual(st.missing, ["bookings"]);
  assert.equal(st.ok, true, "a readable database with tables and no spec is not an error");

  // A STORED SPEC THAT IS MISSING A LIVE TABLE IS THE SAME DISAGREEMENT, and it
  // must be visible on an `ok` answer — this is literally repairbench-1 today.
  const partial = await readSchemaState({
    sql: async (q) => {
      if (/information_schema\.columns/.test(q)) return [{ t: "bookings", c: "a", ty: "text" }, { t: "repairs", c: "b", ty: "text" }];
      if (/_meta/.test(q)) return [{ v: JSON.stringify({ tables: [{ name: "repairs" }] }) }];
      return [];
    },
  });
  assert.equal(partial.state, "stored");
  assert.deepEqual(partial.missing, ["bookings"]);

  // THE CENSUS: every state is named, so a fifth cannot be produced unnamed.
  for (const s of ["stored", "tables-without-metadata"]) assert.ok(SCHEMA_STATES.includes(s));
  const thrown = await readSchemaState({ sql: async () => { throw new Error("down"); } });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.state, "unreadable");
  assert.equal(thrown.why, "catalog-unreadable", "a catalog we cannot see was read as no tables");
  for (const st2 of [st, partial, thrown]) assert.ok(SCHEMA_STATES.includes(st2.state), "unnamed schema state: " + st2.state);
});

test("the survey decides with the shared function, so a hand run and a build agree", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const url = String(u);
    if (url.includes("site_project")) return new Response(JSON.stringify([{ slug: "inc", neon_conn: PROJ.neon_conn }]), { status: 200 });
    return new Response(JSON.stringify([
      { slug: "ready", uid: "u", neon_db: "site_ready" },
      { slug: "inc", uid: "u", neon_db: "" },
      { slug: "front", uid: "u", neon_db: "" },
    ]), { status: 200 });
  };
  try {
    const rows = await survey("k");
    assert.deepEqual(rows.map((r) => [r.slug, r.act, r.state]), [
      ["ready", "skip", "ready"],
      ["inc", "backfill", "incomplete"],
      ["front", "skip", "none"],
    ]);
    assert.equal(rows.find((r) => r.slug === "inc").db, dbNameForSite("inc"));
    // THE SLUG FILTER NARROWS AND NOTHING ELSE.
    assert.deepEqual((await survey("k", "inc")).map((r) => r.slug), ["inc"]);
  } finally { globalThis.fetch = real; }
});

// ── The population check and the seed report (owner, 2026-09-15) ─────────────
//
// CLOSED AT THE MODULE because the ROUTE path that applies a table wants a
// container and a compile, so most of these shapes cannot be reached there —
// the recorded "a wall nobody can drive is a wall nobody is guarding", met in
// the branch whose wrong answer blocks a legitimate table.

test("the population check reports and never refuses: five legitimate shapes stay silent", async () => {
  const A = await import("../builder/site-add.mjs");
  const table = (o) => ({ name: "repairs", columns: [{ name: "who", type: "text" }], ...o });
  const ask = (spec, seed) => A.missingPopulation({ spec, seed: seed || {}, readers: A.readTables({ spec }) });

  // THE ONE THAT MUST FIRE — run 47's shape.
  const read = { tables: [table({ read: "none", write: "none" })], functions: [{ name: "c", body: "SELECT COUNT(*) FROM repairs" }] };
  assert.deepEqual(ask(read), ["repairs"], "the observer is dead: run 47's own table is not reported");

  // 1. NOBODY READS IT. A read-only lookup table nobody has queried yet is not
  //    a problem to raise, and reporting it would fire on half the platform.
  assert.deepEqual(ask({ tables: [table({ read: "none", write: "none" })] }), []);
  // 2. A SEED FILLS IT.
  assert.deepEqual(ask(read, { repairs: [{ who: "a" }] }), []);
  // 3. A DECLARED FUNCTION WRITES IT — the owner's own example.
  assert.deepEqual(ask({ ...read, functions: [{ name: "w", body: "INSERT INTO repairs (who) VALUES ('x'); SELECT COUNT(*) FROM repairs" }] }), []);
  // 4. A JOB WRITES IT — the other half of the owner's example, and the bodies
  //    are scanned separately, so this is not the same assertion as 3.
  assert.deepEqual(ask({ ...read, jobs: [{ name: "j", body: "INSERT INTO repairs (who) VALUES ('x')" }] }), []);
  // 5. THE CLIENT WRITES IT — every booking form on the platform.
  assert.deepEqual(ask({ tables: [table({ access: "collect" })], functions: [{ name: "c", body: "SELECT COUNT(*) FROM repairs" }] }), []);
  // AND AN UPDATE COUNTS AS A WRITER, not only an INSERT.
  assert.deepEqual(ask({ ...read, functions: [{ name: "u", body: "UPDATE repairs SET who='x'; SELECT COUNT(*) FROM repairs" }] }), []);
});

test("the reader scan is word-bounded, so repairs_archive is not repairs", async () => {
  const A = await import("../builder/site-add.mjs");
  const spec = {
    tables: [{ name: "repairs", columns: [] }, { name: "repairs_archive", columns: [] }],
    functions: [{ name: "c", body: "SELECT COUNT(*) FROM repairs_archive" }],
  };
  // THE RECORDED `bookings` / `bookings_old` RULE. A substring match would read
  // the archive's name as a read of `repairs` and report the wrong table.
  assert.deepEqual(A.readTables({ spec }), ["repairs_archive"],
    "a longer name matched a shorter one, so the check reports a table nothing reads");
});

test("a seed skip is said as an effect, and nothing is said when nothing was skipped", async () => {
  const A = await import("../builder/site-add.mjs");
  // NOTHING SKIPPED, NOTHING SAID — "do not imply seeding was required when it
  // wasn't" is the owner's own wording, and an empty list is the case that
  // tests it.
  assert.equal(A.seedSkipNote([]), "");
  assert.equal(A.seedSkipNote(null), "");
  assert.equal(A.seedSkipNote(["   "]), "", "a blank entry produced a sentence about nothing");
  // THE ENGINE'S OWN SENTENCE, rendered as an effect rather than as our rule.
  const one = A.seedSkipNote(["repairs: only display tables are seeded (read none / write none)"]);
  assert.match(one, /starter rows ready for repairs/);
  assert.match(one, /starts empty/, "the sentence does not say what it means for the feature");
  assert.ok(!/display table/.test(one), "our own vocabulary reached the customer");
  // TWO READS AS TWO.
  assert.match(A.seedSkipNote(["a: x", "b: y"]), /\ba, b\b/);
});

test("the unfillable sentence names the table and offers the ways out", async () => {
  const A = await import("../builder/site-add.mjs");
  assert.equal(A.populationNote([]), "");
  const s = A.populationNote(["repairs"]);
  assert.match(s, /repairs/, "the table is not named, so the customer cannot act on it");
  assert.match(s, /form|import|yourself/, "no way out is offered");
});

// ── The repairbench-1 count function (gap 5) ─────────────────────────────────

test("the count-function correction is scoped to one site by name and refuses to guess", async () => {
  const fix = await import("../scripts/repairbench-count-fix.mjs");
  // SCOPED BY NAME, not by a flag somebody can pass. The owner's instruction is
  // exact: keep repairs and test writes to the identified sites.
  assert.equal(fix.ONLY_SLUG, "repairbench-1");
  const src = fs.readFileSync(new URL("../scripts/repairbench-count-fix.mjs", import.meta.url), "utf8");
  assert.ok(!/--slug/.test(src), "the one-site scope became an argument, so it is no longer a scope");
  assert.ok(!/\bDROP\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i.test(src), "the correction can destroy something");
  assert.equal(fix.parseArgs([]).mode, "preview", "it writes by default");
  assert.equal(fix.parseArgs(["--apply"]).mode, "apply");
  assert.equal(fix.parseArgs(["--verify"]).mode, "verify");

  // THE REWRITE IS WORD-BOUNDED and the function's own name survives it —
  // `count_booked_repairs` ends in the word being replaced, and `_` is a word
  // character, so `\brepairs\b` does not match inside it. Asserted rather than
  // reasoned about: being wrong renames the function and takes `/status` down.
  const def = 'CREATE OR REPLACE FUNCTION public.count_booked_repairs()\n RETURNS bigint\n LANGUAGE sql\n SECURITY DEFINER\nAS $function$ SELECT count(*) FROM repairs $function$\n';
  const rw = fix.rewriteDefinition(def);
  assert.equal(rw.ok, true, JSON.stringify(rw));
  assert.equal(rw.replaced, 1, "the function's own name was rewritten too");
  assert.ok(rw.sql.includes("count_booked_repairs"), "the function was renamed");
  assert.ok(/FROM bookings/.test(rw.sql));
  assert.ok(!/FROM repairs/.test(rw.sql));
  // AND EVERY OTHER ATTRIBUTE SURVIVES, because the statement is Postgres's own
  // `pg_get_functiondef` output with one identifier changed — not a template
  // rebuilt from a guess at the language, the volatility or SECURITY DEFINER.
  for (const keep of ["RETURNS bigint", "LANGUAGE sql", "SECURITY DEFINER"]) {
    assert.ok(rw.sql.includes(keep), "the rewrite dropped " + keep);
  }

  // THREE REFUSALS, so it cannot clobber a function somebody already fixed and
  // running it twice is running it once.
  assert.equal(fix.rewriteDefinition("").why, "no-definition");
  assert.equal(fix.rewriteDefinition(def.replace("repairs $function$", "bookings $function$")).why, "already-names-bookings");
  assert.equal(fix.rewriteDefinition("CREATE OR REPLACE FUNCTION f() AS $$ SELECT 1 $$").why, "does-not-name-repairs");
});

// ── THE SWEEP'S TWELVE SURVIVORS, EACH CLOSED BY DRIVING IT ──────────────────
//
// Every one was a gap in the guards above rather than a defect in the product,
// except one: the payable refusal keyed on all five `PAYMENT_COLUMNS`, so a
// price list with a `currency` column read as payable and was refused recovery
// for a feature it has not got. Measured, then fixed, then pinned below.

test("a `currency` column does not make a table payable", () => {
  // THE FALSE ALARM THE SWEEP FOUND. `currency` and `amount_total` are ordinary
  // words a designer writes; `payment_status` is not. Keying the refusal on all
  // five refused a `display` price list — a false alarm, which this repository
  // holds to zero before anything ships.
  const prices = { name: "prices", access: "display", columns: [{ name: "dish", type: "text" }] };
  const live = liveOf([prices]);
  live.columns.push({ t: "prices", c: "currency", ty: "text" });
  const out = reconcileSpec({ stored: { tables: [] }, live, emit: REAL });
  assert.deepEqual(out.uncertain, [], "an ordinary `currency` column was read as a payment configuration");
  assert.deepEqual(out.recovered.map((r) => r.name), ["prices"]);
  assert.deepEqual(UNDERIVABLE_EVIDENCE.map((e) => e.columns).flat(), ["payment_status"]);

  // AND THE PAYMENT COLUMNS ARE NOT IN `MANAGED_COLUMNS`, which is the other
  // half of the same correction: `site-schema.mjs:1011` adds them to its managed
  // set only FOR A PAYABLE TABLE, so an unconditional union here would strip
  // `currency` off every ordinary table — a narrowing the one-sided grant check
  // allows through in silence.
  assert.ok(!MANAGED_COLUMNS.has("currency") && !MANAGED_COLUMNS.has("payment_status"));
  const back = out.spec.tables.find((t) => t.name === "prices");
  assert.deepEqual(back.columns.map((c) => c.name), ["dish", "currency"], "an ordinary column was stripped from the recovered table");
});

test("a DERIVED table keeps its flags through the reconcile, not only through verifyDeclaration", () => {
  // THE SWEEP'S OWN NAMED DEFECT, and it survived because every case above that
  // recovered a table recovered a FLAGLESS one (`bookings` is `collect`), and
  // the flagged case went through `verifyDeclaration` directly. Drop
  // `deriveFlags` from the candidate and this is what changes.
  const notes = { name: "notes", read: "own", write: "own", trash: true, timestamps: true, columns: [{ name: "body", type: "text" }] };
  const out = reconcileSpec({ stored: { tables: [] }, live: liveOf([notes]), emit: REAL });
  assert.deepEqual(out.uncertain, [], JSON.stringify(out.uncertain));
  const back = out.spec.tables.find((t) => t.name === "notes");
  assert.equal(back.trash, true, "the recovered declaration lost `trash`, so the next apply emits USING (true)");
  assert.equal(back.timestamps, true);
  // AND THE NEXT APPLY REALLY EMITS THE SAME POLICY — asserted on the emitter's
  // own output, because "the flag is on the object" is one hop short of the
  // property that matters.
  const sel = policiesFor(back).find((s) => /FOR SELECT/i.test(s));
  assert.ok(/deleted_at/.test(String(sel)), "the next apply would stop hiding soft-deleted rows: " + sel);
});

test("the round-trip is handed the columns the table REALLY has, which is what a prior declaration needs", () => {
  // MEASURED: for a DERIVED declaration the two lists emit identical grants, so
  // this only shows on a PRIOR one — a recorded declaration naming a column the
  // table has not got yet. `grantsFor` is handed the really-created list, so the
  // phantom column is dropped and the grant matches; handed the declared list it
  // would name a column Postgres has never heard of, the declaration would read
  // as a widening, and a perfectly good recorded declaration would be refused.
  const notes = { name: "notes", read: "own", write: "own", columns: [{ name: "body", type: "text" }] };
  const live = liveOf([notes]);
  const prior = [{ name: "notes", read: "own", write: "own", columns: [{ name: "body", type: "text" }, { name: "not_yet", type: "text" }] }];
  const out = reconcileSpec({ stored: { tables: [] }, live, prior, emit: REAL });
  assert.deepEqual(out.uncertain, [], "a recorded declaration naming a not-yet-added column was refused: " + JSON.stringify(out.uncertain));
  assert.deepEqual(out.recovered.map((r) => r.source), ["prior"]);
});

test("an unproven identity stops BOTH tasks, and neither task gates the other", async () => {
  const site = { slug: "s1", state: "incomplete", act: "backfill", db: "site_s1", uid: "u1",
                 conn: "postgres://u:p@h/site_s1", projectSlug: "s1" };
  const writes = [];
  const write = async () => { writes.push("ref"); return { wrote: true }; };

  // THE SERVER DISAGREES: nothing may be written, and that includes the SCHEMA.
  // Writing a recovered spec into a database that is not this site's is worse
  // than writing a reference to it.
  const wrong = await repairSite({
    site, write, mode: "apply", emit: REAL,
    sql: async (q) => {
      if (/current_database/.test(q)) return [{ db: "site_someone_else" }];
      if (/INSERT INTO _meta/.test(q)) { writes.push("meta"); return []; }
      return [];
    },
  });
  assert.equal(wrong.identity.proven, false);
  assert.equal(wrong.ref.act, "refused");
  assert.equal(wrong.schema.act, "refused", "a database we could not prove was this site's was written a schema");
  assert.deepEqual(writes, [], "something was written on an unproven identity");

  // A REFERENCE THAT FAILED DOES NOT STOP THE RECOVERY. The rerun rule depends
  // on the two being independent in BOTH directions.
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  let meta = null;
  const sql = async (q, p) => {
    if (/current_database/.test(q)) return [{ db: "site_s1" }];
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/role_table_grants/.test(q)) return live.grants;
    if (/pg_policies/.test(q)) return live.policies;
    if (/pg_trigger/.test(q)) return [];
    if (/INSERT INTO _meta/.test(q)) { meta = JSON.parse(p[0]); return []; }
    if (/_meta/.test(q)) return [{ v: JSON.stringify({ tables: [] }) }];
    return [];
  };
  const refBroke = await repairSite({ site, sql, mode: "apply", emit: REAL, write: async () => { throw new Error("supabase 503"); } });
  assert.equal(refBroke.ref.act, "failed");
  assert.equal(refBroke.schema.act, "recovered", "a failed reference write stopped a recovery that could have run");
  assert.ok(meta && (meta.tables || []).some((t) => t.name === "bookings"));
});

test("a preview writes neither the reference nor the recovered schema", async () => {
  // THE APPLY GATE ON THE SCHEMA HALF. The earlier gate case has nothing to
  // recover, so `rec.changed` is false and the `_meta` write never happens
  // either way — the branch was never driven.
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  const writes = [];
  const sql = async (q) => {
    if (/current_database/.test(q)) return [{ db: "site_s1" }];
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/role_table_grants/.test(q)) return live.grants;
    if (/pg_policies/.test(q)) return live.policies;
    if (/pg_trigger/.test(q)) return [];
    if (/INSERT INTO _meta/.test(q)) { writes.push("meta"); return []; }
    if (/_meta/.test(q)) return [{ v: JSON.stringify({ tables: [] }) }];
    return [];
  };
  const site = { slug: "s1", state: "incomplete", act: "backfill", db: "site_s1", uid: "u1", conn: "postgres://u:p@h/site_s1", projectSlug: "s1" };
  const pre = await repairSite({ site, sql, write: async () => { writes.push("ref"); return { wrote: true }; }, mode: "preview", emit: REAL });
  assert.equal(pre.schema.act, "would-recover");
  assert.deepEqual(pre.schema.recovered.map((r) => r.name), ["bookings"]);
  assert.deepEqual(writes, [], "a preview wrote: " + JSON.stringify(writes));

  // THE CONTROL: the same call under --apply writes both.
  const app = await repairSite({ site, sql, write: async () => { writes.push("ref"); return { wrote: true }; }, mode: "apply", emit: REAL });
  assert.equal(app.schema.act, "recovered");
  assert.deepEqual(writes.sort(), ["meta", "ref"]);
});

test("--verify fails a reference that is not the derived name, and one that does not answer", async () => {
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  const db = dbNameForSite("repairbench-1");
  const sqlFor = (dbName) => async (q) => {
    if (/current_database/.test(q)) return [{ db: dbName }];
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/_meta/.test(q)) return [{ v: JSON.stringify({ tables: [bookings] }) }];
    return [];
  };
  const site = { slug: "repairbench-1", state: "ready", act: "skip", db, uid: "u", conn: "postgres://u:p@h/" + db, projectSlug: "repairbench-1" };

  // RECORDED, BUT NOT THE DERIVED NAME. The reference resolves to some other
  // database, which the repair would never have written and nothing else checks.
  const wrongName = await verifySite({ site: { ...site, db: "site_something_else", conn: "postgres://u:p@h/site_something_else" }, sql: sqlFor("site_something_else") });
  assert.equal(wrongName.ok, false);
  assert.ok(wrongName.checks.some((c) => !c.ok && /derived name/.test(c.name)));

  // AND IT REALLY CONNECTS: a database that will not answer fails the verify
  // even when both Supabase-side checks pass.
  const dead = await verifySite({ site, sql: async () => { throw new Error("connect ECONNREFUSED"); } });
  assert.equal(dead.ok, false);
  assert.ok(dead.checks.some((c) => !c.ok && /answers/.test(c.name)), JSON.stringify(dead.checks));
  // THE CONTROL, so "it fails" is not just "it always fails".
  assert.equal((await verifySite({ site, sql: sqlFor(db) })).ok, true);
});

test("the route never recovers blind: without the permission surface it stops", async () => {
  // Recovering against an empty grant list derives `read:"none", write:"none"`
  // for every table on the site — a whole site's access, rewritten from a failed
  // query. Driven at the module the route uses.
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([bookings]);
  const blind = await recoverSchema(async (q) => {
    if (/information_schema\.columns/.test(q)) return live.columns;
    if (/role_table_grants/.test(q)) throw new Error("connection terminated");
    if (/_meta/.test(q)) return [{ v: JSON.stringify({ tables: [] }) }];
    return [];
  }, { emit: REAL });
  assert.equal(blind.ok, false);
  assert.equal(blind.why, "permissions-unreadable");
  // AND THE WORKER'S OWN COPY OF THE RULE IS THE SAME ONE.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /return \{ ok: false, why: "permissions-unreadable" \};/,
    "the route recovers without the permission surface, so a failed grant read rewrites a site's access");
});

test("the one-site scope is a literal, not a setting", () => {
  // THE MUTANT THAT SURVIVED BY BEING INVISIBLE: `process.env.SLUG ||
  // "repairbench-1"` evaluates to the same string in a test and to anything at
  // all in a shell. The property is that the scope is NOT configurable, which is
  // a property of the declaration rather than of its value.
  const src = fs.readFileSync(new URL("../scripts/repairbench-count-fix.mjs", import.meta.url), "utf8");
  const line = src.split("\n").find((l) => /^export const ONLY_SLUG/.test(l));
  assert.ok(line, "ONLY_SLUG is no longer declared at the top level");
  assert.equal(line.trim(), 'export const ONLY_SLUG = "repairbench-1";',
    "the one-site scope became configurable, so it is no longer a scope");
});

test("the rename guard is a SECOND wall, and the pair is what must not both go", async () => {
  // DECLARED DELIBERATE, because a sweep cannot say so and the next session
  // deletes what nothing appears to need. `\brepairs\b` cannot match inside
  // `count_booked_repairs` (`_` is a word character), so the rename guard never
  // fires while the boundary is there — it is the belt to the boundary's braces.
  // MUTATING EITHER ALONE IS INERT-ISH; mutating the PAIR renames the function,
  // and that is what this asserts.
  const def = 'CREATE OR REPLACE FUNCTION public.count_booked_repairs()\n RETURNS bigint\nAS $function$ SELECT count(*) FROM repairs $function$\n';
  const src = fs.readFileSync(new URL("../scripts/repairbench-count-fix.mjs", import.meta.url), "utf8");
  // BOTH WALLS ARE PRESENT.
  assert.match(src, /new RegExp\("\\\\b" \+ WRONG_TABLE \+ "\\\\b", "g"\)/, "the word boundary went");
  assert.match(src, /if \(!out\.includes\(FN\)\) return \{ ok: false, why: "rewrite-would-rename-the-function" \}/, "the rename guard went");
  // AND THE PAIR'S EFFECT IS MEASURED HERE rather than argued: without the
  // boundary the function's own name is rewritten, which the rename guard is
  // there to catch if the boundary ever goes.
  const unbounded = def.replace(/repairs/g, "bookings");
  assert.ok(!unbounded.includes("count_booked_repairs"), "the pair is not redundant on this definition — re-derive the argument");
  const rw = (await import("../scripts/repairbench-count-fix.mjs")).rewriteDefinition(def);
  assert.ok(rw.sql.includes("count_booked_repairs"));
});

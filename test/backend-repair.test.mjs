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
import { reconcileSpec, deriveAccess, RECOVER_QUERIES, MANAGED_COLUMNS, UNPROVABLE_FLAGS, isInternalName } from "../site-schema-recover.mjs";
import { grantsFor, policiesFor } from "../site-rls.mjs";
import { READ_LEVELS, WRITE_LEVELS } from "../site-access.mjs";
import { dbNameForSite } from "../site-db.mjs";
import { parseArgs, safeErr, proveIdentity, recoverSchema, survey } from "../scripts/backend-repair.mjs";

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

/** Grant rows as `information_schema` reports them, from `grantsFor` itself. */
function grantRows(t, cols) {
  const out = [];
  for (const stmt of grantsFor(t, cols)) {
    const m = /^GRANT\s+(.+?)\s+ON\s+"([^"]+)"\s+TO\s+(\w+)/i.exec(stmt);
    if (!m) continue; // a REVOKE is not a privilege held
    for (const p of m[1].replace(/\([^)]*\)/g, "").split(",").map((s) => s.trim()).filter(Boolean)) {
      out.push({ t: m[2], g: m[3], p: p.toUpperCase() });
    }
  }
  return out;
}

/** Policy rows as `pg_policies` reports them, from `policiesFor` itself. */
function policyRows(t) {
  const out = [];
  for (const stmt of policiesFor(t)) {
    const m = /CREATE POLICY\s+\S+\s+ON\s+"([^"]+)"\s+FOR\s+(\w+)/i.exec(String(stmt));
    if (!m) continue;
    const using = /USING\s*\(([\s\S]*?)\)\s*(?:WITH CHECK|;|$)/i.exec(String(stmt));
    const check = /WITH CHECK\s*\(([\s\S]*?)\)\s*;?\s*$/i.exec(String(stmt));
    out.push({ t: m[1], c: m[2].toUpperCase(), q: (using && using[1]) || "", w: (check && check[1]) || "" });
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
    for (const c of ["id", "created_at", ...cols]) columns.push({ t: t.name, c, ty: "text" });
    grants.push(...grantRows(t, cols));
    policies.push(...policyRows(t));
  }
  return { columns, grants, policies };
}

test("run 47's own state: bookings is recovered, repairs is kept, and the spec is otherwise untouched", () => {
  const bookings = { name: "bookings", access: "collect", columns: [{ name: "customer_name", type: "text" }, { name: "bike", type: "text" }, { name: "drop_off_day", type: "text" }] };
  const repairs = { name: "repairs", read: "none", write: "none", columns: [{ name: "customer_name", type: "text" }] };
  // What run 47 left in `_meta.schema`: only the table it made.
  const stored = { tables: [repairs], functions: [{ name: "count_booked_repairs" }], apis: [], jobs: [] };
  const out = reconcileSpec({ stored, live: liveOf([bookings, repairs]) });

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
  const first = reconcileSpec({ stored: { tables: [] }, live });
  assert.equal(first.changed, true);
  const second = reconcileSpec({ stored: first.spec, live });
  assert.equal(second.changed, false, "the recovery is not idempotent");
  assert.deepEqual(second.recovered, []);
});

test("a table whose access cannot be derived is NAMED and left out, never guessed into the spec", () => {
  const t = { name: "members_only", read: "own", write: "own", columns: [{ name: "a", type: "text" }] };
  const live = liveOf([t]);
  const out = reconcileSpec({ stored: { tables: [] }, live: { ...live, policies: [], policiesRead: false } });
  assert.deepEqual(out.recovered, []);
  assert.deepEqual(out.ambiguous.map((a) => a.name), ["members_only"]);
  assert.equal(out.changed, false, "an underivable table was written into the spec anyway");
});

test("internal tables are never recovered, and the flags a catalog cannot prove are named", () => {
  const t = { name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] };
  const live = liveOf([t]);
  live.columns.push({ t: "_meta", c: "k", ty: "text" }, { t: "_users", c: "id", ty: "text" });
  const out = reconcileSpec({ stored: { tables: [] }, live });
  assert.deepEqual(out.recovered.map((r) => r.name), ["bookings"], "an internal table was recovered into the spec");
  assert.ok(isInternalName("_meta") && !isInternalName("bookings"));
  // THE LIMITATION IS REPORTED RATHER THAN LEFT TO BE INFERRED.
  assert.ok(out.unprovable.includes("payment"), "the flags a recovery cannot rebuild are not named");
  assert.deepEqual(reconcileSpec({ stored: { tables: [t] }, live }).unprovable, [],
    "flags are named even when nothing was recovered, which reads as a warning about nothing");
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

// ── The script ───────────────────────────────────────────────────────────────

test("the script previews by default and writes only under --apply", () => {
  assert.equal(parseArgs([]).mode, "preview");
  assert.equal(parseArgs(["--apply"]).mode, "apply");
  assert.equal(parseArgs(["--verify"]).mode, "verify");
  assert.equal(parseArgs(["--apply", "--slug", "repairbench-1"]).slug, "repairbench-1");
  // THE SOURCE'S OWN WALL: the only write paths are behind the apply branch.
  const src = fs.readFileSync(new URL("../scripts/backend-repair.mjs", import.meta.url), "utf8");
  const applyAt = src.indexOf('if (args.mode !== "apply")');
  assert.ok(applyAt > 0, "the apply gate moved; re-anchor rather than deleting this");
  assert.ok(src.indexOf("await writeRef(") > applyAt, "the reference is written before the apply gate");
  assert.ok(src.indexOf("INSERT INTO _meta") > applyAt, "the schema is written before the apply gate");
  // AND NOTHING HERE DESTROYS ANYTHING.
  assert.ok(!/\bDROP\s+(TABLE|DATABASE|COLUMN)\b/i.test(src), "the repair script contains a DROP");
  assert.ok(!/\bDELETE\s+FROM\b/i.test(src), "the repair script deletes rows");
});

test("a credential can never reach the log, and the host deliberately survives", () => {
  const msg = "connect ECONNREFUSED postgres://neondb_owner:npg_SECRET@ep-cool-1.neon.tech/site_x";
  const out = safeErr(new Error(msg));
  assert.ok(!out.includes("npg_SECRET"), "a password reached the log: " + out);
  assert.ok(out.includes("ep-cool-1.neon.tech"), "the host was scrubbed too, so the report names no database");
  assert.match(out, /postgres:\/\/\*\*\*@/);
});

test("identity is proved before a reference is written, and an unproven one is named as unproven", async () => {
  const sql = (rows) => async (q) => {
    if (/information_schema\.columns/.test(q)) return rows.columns || [];
    if (/_meta WHERE k = 'schema'/.test(q)) return rows.meta ? [{ v: JSON.stringify(rows.meta) }] : [];
    return [];
  };
  // VERIFIED: the database holds the tables the stored spec declares.
  const yes = await proveIdentity(sql({ columns: [{ t: "bookings", c: "who", ty: "text" }], meta: { tables: [{ name: "bookings" }] } }));
  assert.equal(yes.ok, true);
  assert.ok(!yes.unproven);
  assert.deepEqual(yes.overlap, ["bookings"]);
  // REFUSED: it answers, and holds none of this site's tables. Writing the
  // reference here would point the platform at somebody else's data.
  const no = await proveIdentity(sql({ columns: [{ t: "invoices", c: "x", ty: "text" }], meta: { tables: [{ name: "bookings" }] } }));
  assert.equal(no.ok, false);
  assert.equal(no.why, "stored-spec-names-none-of-these-tables");
  // UNPROVEN, NOT VERIFIED: an empty database is legitimate — a site
  // provisioned and never applied to — but it is not evidence of identity, and
  // rounding that to "verified" is the reading this whole change exists to stop.
  const empty = await proveIdentity(sql({ columns: [], meta: null }));
  assert.equal(empty.ok, true);
  assert.equal(empty.unproven, true);
  // INTERNAL TABLES ARE NOT EVIDENCE — every site has `_meta`, so counting it
  // would make every database look like every site's.
  const onlyMeta = await proveIdentity(sql({ columns: [{ t: "_meta", c: "k", ty: "text" }], meta: { tables: [{ name: "bookings" }] } }));
  assert.equal(onlyMeta.ok, false, "a database holding only platform tables was accepted as this site's");
});

test("a stored spec that cannot be read stops the recovery instead of appending every live table to nothing", async () => {
  const sql = async (q) => {
    if (/information_schema\.columns/.test(q)) return [{ t: "bookings", c: "who", ty: "text" }];
    if (/_meta WHERE k = 'schema'/.test(q)) throw new Error("connection terminated");
    return [];
  };
  const out = await recoverSchema(sql);
  assert.equal(out.ok, false);
  assert.equal(out.why, "stored-spec-unreadable");
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

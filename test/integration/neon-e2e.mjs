// End-to-end proof against a REAL Neon account.
//
// Provisions a throwaway project, applies a schema through the actual schema
// engine, exercises the features whose SQL changed in the D1 -> Postgres port,
// then deletes the project. Nothing is mocked: if the generated DDL is invalid
// Postgres, this fails.
//
// Needs NEON_API_KEY. Run: node test/integration/neon-e2e.mjs
import {
  createUserProject, createSiteDatabase, dropUserProject, enableNeonAuth, enableDataApi,
  connForDatabase, sqlQuery, sqlExec, neonConfigured,
} from "../../site-db.mjs";
import { applySiteSchema, normalizeSchema } from "../../site-schema.mjs";

const env = { NEON_API_KEY: process.env.NEON_API_KEY };
if (!neonConfigured(env)) {
  console.error("NEON_API_KEY is not set");
  process.exit(1);
}

let passed = 0, failed = 0;
const ok = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? "  -> " + extra : ""}`); }
};

// A schema that turns on every feature the port touched.
const SCHEMA = normalizeSchema({
  tables: [
    {
      name: "posts",
      access: "public",
      columns: [
        { name: "title", type: "text" },
        { name: "body", type: "text" },
        { name: "views", type: "integer" },
      ],
      timestamps: true,
      fts: true,        // generated tsvector + GIN  (was FTS5 virtual table)
      ordered: true,    // BEFORE INSERT position trigger
      audit: true,      // AFTER insert/update/delete triggers
      history: true,    // BEFORE UPDATE snapshot trigger, json_build_object
      trash: true,
      version: true,
    },
    {
      name: "slots",
      access: "public",
      columns: [
        { name: "room", type: "text" },
        { name: "start_min", type: "integer" },
        { name: "end_min", type: "integer" },
      ],
      noOverlap: { on: ["room"], start: "start_min", end: "end_min" },
    },
    {
      // The one table here that is NOT public: a booking form nobody may read,
      // publishing exactly two columns to strangers through a view.
      name: "bookings",
      access: "collect",
      columns: [
        { name: "appointment_date", type: "text" },
        { name: "appointment_time", type: "text" },
        { name: "status", type: "text" },
        { name: "customer_name", type: "text" },
        { name: "customer_email", type: "text" },
      ],
      publicView: { columns: ["appointment_date", "appointment_time"], where: ["status:ne:cancelled"] },
      // A PARTIAL unique index, which is the headline booking constraint. The
      // `where` is what stops a CANCELLED booking holding its slot forever —
      // asserted below, because "the slot is free again after a cancellation" is
      // the half a plain unique index gets wrong.
      unique: [{ columns: ["appointment_date", "appointment_time"], where: "status:ne:cancelled" }],
    },
    {
      // uniqueCI: one address, however it was typed. A plain UNIQUE would let
      // Ada@Example.com and ada@example.com both sign up, which is two accounts
      // for one person and a password reset that reaches the wrong one.
      name: "members",
      access: "public",
      columns: [
        { name: "email", type: "text" },
        { name: "nickname", type: "text" },
      ],
      uniqueCI: ["email"],
    },
    {
      // teamScope widens a `user` table to the caller's organization. Its policy
      // carries a subquery against neon_auth.member — by far the most complex SQL
      // this engine emits, and a policy that fails to parse is CAUGHT AND LOGGED,
      // so the table silently ends up with no read policy at all.
      name: "deals",
      access: "user",
      columns: [
        { name: "title", type: "text" },
        { name: "value", type: "integer" },
      ],
      teamScope: true,
    },
    {
      name: "comments",
      access: "public",
      columns: [
        { name: "post_id", type: "integer", ref: "posts" },
        { name: "text", type: "text" },
      ],
      enforceRefs: true,  // BEFORE INSERT/UPDATE guard triggers
      maxRows: 5,         // BEFORE INSERT row-cap trigger
    },
    // THE CLAIM CASE, against real Postgres. A `collect` table is write-only —
    // an INSERT grant and no SELECT anywhere — so the customer who booked can
    // never read their own booking back. The only way to hand them one row is a
    // SECURITY DEFINER function that takes a token and returns exactly that row.
    {
      name: "bookings",
      access: "collect",
      columns: [
        { name: "customer_name", type: "text" },
        { name: "slot", type: "text" },
        { name: "claim_token", type: "uuid", default: "gen_random_uuid()" },
      ],
    },
  ],
  functions: [
    { name: "booking_by_claim", args: [{ name: "tok", type: "uuid" }], returns: "setof bookings",
      body: "SELECT * FROM bookings WHERE claim_token = tok" },
    { name: "cancel_booking_by_claim", args: [{ name: "tok", type: "uuid" }], returns: "void",
      body: "DELETE FROM bookings WHERE claim_token = tok" },
  ],
});

const stamp = Date.now().toString(36);
let project = null;

try {
  console.log("provisioning a throwaway Neon project…");
  project = await createUserProject(env, "e2e-" + stamp);
  ok("create project returns id + connection uri", !!(project.projectId && project.conn));

  const dbName = await createSiteDatabase(env, project.projectId, project.branchId, project.roleName, "e2e" + stamp);
  const db = connForDatabase(project.conn, dbName);
  ok("create database inside the project", !!dbName);

  // ── the two enable calls, which nothing tested and which broke every build ──
  //
  // THIS IS THE GAP THAT LET IT SHIP. This file provisions a REAL project and
  // then never called either of them, so `neon e2e` was green the whole time
  // build smoke was dying on them. Measured 2026-08-04: every build answered
  // "could not provision the database" because the Data API path was
  // `/data_api` with an underscore and no database name, where Neon's is
  // `/data-api/{database}`. A wrong URL is exactly what an e2e is for, and it
  // costs nothing extra here — the project is already up and already paid for.
  //
  // FATAL in production, so asserted rather than tolerated: a site without auth
  // is one nobody can sign in to, and without the Data API every list is empty
  // and every form fails.
  console.log("enabling Neon Auth…");
  const auth = await enableNeonAuth(env, project.projectId, project.branchId, dbName);
  ok("Neon Auth enables", !!(auth && auth.enabled), JSON.stringify(auth).slice(0, 300));

  console.log("enabling the Data API…");
  const dataApi = await enableDataApi(env, project.projectId, project.branchId, dbName);
  ok("the Data API enables", !!(dataApi && dataApi.enabled), JSON.stringify(dataApi).slice(0, 300));

  // Idempotent, because a retried build re-runs both against a project that
  // already has them — that is the NORMAL path, not an edge case, and treating
  // "already enabled" as a failure would break every rebuild.
  const dataApiAgain = await enableDataApi(env, project.projectId, project.branchId, dbName);
  ok("enabling the Data API twice is not an error", !!(dataApiAgain && dataApiAgain.enabled), JSON.stringify(dataApiAgain).slice(0, 200));
  const authAgain = await enableNeonAuth(env, project.projectId, project.branchId, dbName);
  ok("enabling Neon Auth twice is not an error", !!(authAgain && authAgain.enabled), JSON.stringify(authAgain).slice(0, 200));

  console.log("applying the schema…");
  const made = await applySiteSchema(db, SCHEMA);
  // Derived from the fixture, like the idempotence check below. I fixed that one
  // when adding `bookings` and missed this one, and it failed the whole run for a
  // reason that had nothing to do with what changed — a number somebody has to
  // remember is a test that breaks on unrelated work.
  ok("applySiteSchema reports every table", made.length === SCHEMA.tables.length,
    `${made.length} of ${SCHEMA.tables.length}: ${JSON.stringify(made)}`);

  // --- identity column + text timestamp default ---------------------------
  await sqlQuery(db, 'INSERT INTO "posts" ("title","body","views") VALUES (?,?,?)', ["Hello", "world of postgres", 1]);
  const rows = await sqlQuery(db, 'SELECT * FROM "posts"');
  ok("row inserted, id auto-assigned", rows.length === 1 && rows[0].id > 0);
  ok("created_at matches SQLite's text format",
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(rows[0].created_at)), String(rows[0].created_at));

  // --- ordered: BEFORE INSERT assigns position ----------------------------
  ok("position auto-assigned by trigger", rows[0].position !== null && rows[0].position !== undefined, String(rows[0].position));
  await sqlQuery(db, 'INSERT INTO "posts" ("title","body") VALUES (?,?)', ["Second", "another"]);
  const two = await sqlQuery(db, 'SELECT "position" FROM "posts" ORDER BY id');
  ok("second row gets a higher position", Number(two[1].position) > Number(two[0].position),
    two.map((r) => r.position).join(","));

  // --- fts: generated tsvector + GIN --------------------------------------
  const hit = await sqlQuery(db, `SELECT id FROM "posts" WHERE "_fts" @@ websearch_to_tsquery('english', ?)`, ["postgres"]);
  ok("full-text search finds the row", hit.length === 1, JSON.stringify(hit));
  const miss = await sqlQuery(db, `SELECT id FROM "posts" WHERE "_fts" @@ websearch_to_tsquery('english', ?)`, ["kangaroo"]);
  ok("full-text search excludes non-matches", miss.length === 0);

  // --- audit triggers -----------------------------------------------------
  await sqlQuery(db, 'UPDATE "posts" SET "title"=? WHERE id=?', ["Hello edited", rows[0].id]);
  const audit = await sqlQuery(db, `SELECT action FROM _audit WHERE row_table='posts' ORDER BY id`);
  ok("audit trigger logged insert+update", audit.length >= 3 && audit.some((a) => a.action === "update"),
    audit.map((a) => a.action).join(","));

  // --- history trigger: json_build_object snapshot ------------------------
  const hist = await sqlQuery(db, `SELECT snapshot FROM _history WHERE row_table='posts'`);
  ok("history trigger snapshotted the old row", hist.length === 1);
  ok("snapshot is valid json holding the pre-edit title",
    hist.length === 1 && JSON.parse(hist[0].snapshot).title === "Hello",
    hist.length ? String(hist[0].snapshot).slice(0, 120) : "no rows");

  // --- enforceRefs guard --------------------------------------------------
  await sqlQuery(db, 'INSERT INTO "comments" ("post_id","text") VALUES (?,?)', [rows[0].id, "fine"]);
  ok("comment against a real parent is accepted", true);
  let refused = false;
  try { await sqlQuery(db, 'INSERT INTO "comments" ("post_id","text") VALUES (?,?)', [999999, "orphan"]); }
  catch (e) { refused = /missing parent/i.test(String(e && (e.message || e))); }
  ok("comment against a missing parent is refused", refused);

  // --- maxRows cap --------------------------------------------------------
  for (let i = 0; i < 4; i++) {
    await sqlQuery(db, 'INSERT INTO "comments" ("post_id","text") VALUES (?,?)', [rows[0].id, "c" + i]);
  }
  let capped = false;
  try { await sqlQuery(db, 'INSERT INTO "comments" ("post_id","text") VALUES (?,?)', [rows[0].id, "over"]); }
  catch (e) { capped = /row limit reached/i.test(String(e && (e.message || e))); }
  ok("row cap refuses the 6th comment", capped);

  // --- noOverlap: a real EXCLUDE constraint, not a checked-then-written race
  await sqlQuery(db, 'INSERT INTO "slots" ("room","start_min","end_min") VALUES (?,?,?)', ["a", 600, 660]);
  ok("first booking is accepted", true);
  await sqlQuery(db, 'INSERT INTO "slots" ("room","start_min","end_min") VALUES (?,?,?)', ["a", 660, 720]);
  ok("a booking starting exactly when the last ends is allowed (half-open)", true);
  await sqlQuery(db, 'INSERT INTO "slots" ("room","start_min","end_min") VALUES (?,?,?)', ["b", 600, 660]);
  ok("the same time in a different room is allowed", true);
  let clashed = false;
  try { await sqlQuery(db, 'INSERT INTO "slots" ("room","start_min","end_min") VALUES (?,?,?)', ["a", 630, 690]); }
  catch (e) { clashed = /exclusion constraint|nooverlap/i.test(String(e && (e.message || e))); }
  ok("an overlapping booking is refused by the database", clashed);

  // --- sqlExec change counts ----------------------------------------------
  const upd = await sqlExec(db, 'UPDATE "posts" SET "views"=? WHERE id=?', [42, rows[0].id]);
  ok("sqlExec reports rows changed", upd.changes === 1, JSON.stringify(upd));
  const none = await sqlExec(db, 'UPDATE "posts" SET "views"=? WHERE id=?', [1, 987654]);
  ok("sqlExec reports 0 when nothing matched", none.changes === 0, JSON.stringify(none));

  // --- re-applying a schema must be safe (revise path) --------------------
  const again = await applySiteSchema(db, SCHEMA);
  // --- the public projection, against a real database -----------------------
  //
  // Strings are asserted in test/public-view.test.mjs; this is the half that
  // catches a view which is valid JavaScript and invalid SQL. `publicView` spent
  // its whole life parsed and never created, so "it produces the right DDL" is
  // exactly the claim that was never worth anything on its own.
  await sqlQuery(db, 'INSERT INTO "bookings" ("appointment_date","appointment_time","status","customer_name","customer_email") VALUES (?,?,?,?,?)',
    ["2026-08-04", "14:00", "booked", "Ada", "ada@example.com"]);
  await sqlQuery(db, 'INSERT INTO "bookings" ("appointment_date","appointment_time","status","customer_name","customer_email") VALUES (?,?,?,?,?)',
    ["2026-08-04", "15:00", "cancelled", "Bob", "bob@example.com"]);

  const pubCols = await sqlQuery(db,
    "SELECT column_name FROM information_schema.columns WHERE table_name='bookings_public' ORDER BY ordinal_position");
  ok("the public view exists with exactly the declared columns",
    pubCols.map((r) => r.column_name).join(",") === "appointment_date,appointment_time",
    JSON.stringify(pubCols));

  const pubRows = await sqlQuery(db, 'SELECT * FROM "bookings_public" ORDER BY "appointment_time"');
  ok("it publishes the booked slot", pubRows.length === 1 && pubRows[0].appointment_time === "14:00", JSON.stringify(pubRows));
  ok("and the WHERE really excluded the cancelled one", pubRows.length === 1, JSON.stringify(pubRows));
  ok("and it carries no id and no name", pubRows[0] && pubRows[0].id === undefined && pubRows[0].customer_name === undefined,
    JSON.stringify(pubRows[0]));

  // THE SECURITY PROPERTY, asked of Postgres rather than reasoned about: a
  // stranger may read the projection and may NOT read the table it comes from.
  // If the second of these ever flips, the feature is publishing customers'
  // names and addresses to anyone who knows the slug.
  const priv = await sqlQuery(db,
    "SELECT has_table_privilege('anonymous','bookings_public','SELECT') AS view_ok, " +
    "has_table_privilege('anonymous','bookings','SELECT') AS table_ok");
  ok("anonymous may SELECT the view", priv[0] && priv[0].view_ok === true, JSON.stringify(priv));
  ok("anonymous may NOT SELECT the table underneath", priv[0] && priv[0].table_ok === false, JSON.stringify(priv));

  const opts = await sqlQuery(db, "SELECT reloptions FROM pg_class WHERE relname='bookings_public'");
  const ro = String((opts[0] && opts[0].reloptions) || "");
  ok("the view runs as its owner, or it would return nothing to a stranger",
    /security_invoker=false/.test(ro), ro);
  ok("and it is a security barrier", /security_barrier=true/.test(ro), ro);

  // --- the constraints a designer can actually declare -----------------------
  //
  // These are the last three of the eight declarable features that had never run
  // against a real database. Strings-only tests cannot see the difference between
  // valid JavaScript and valid SQL, and `unique` in particular was implemented,
  // tested and UNREACHABLE for the builder's whole life until a week ago — while
  // two customers booked the same 14:00 slot and both were accepted.

  // bookings already holds 14:00 (booked) and 15:00 (cancelled).
  let dupRefused = false;
  try {
    await sqlQuery(db, 'INSERT INTO "bookings" ("appointment_date","appointment_time","status","customer_name","customer_email") VALUES (?,?,?,?,?)',
      ["2026-08-04", "14:00", "booked", "Cara", "cara@example.com"]);
  } catch { dupRefused = true; }
  ok("a second booking for a taken slot is refused by the database", dupRefused);

  // THE PARTIAL HALF. Without the `where` this would also be refused, and a
  // cancellation would take its slot out of the shop's day permanently.
  let freedAgain = true;
  try {
    await sqlQuery(db, 'INSERT INTO "bookings" ("appointment_date","appointment_time","status","customer_name","customer_email") VALUES (?,?,?,?,?)',
      ["2026-08-04", "15:00", "booked", "Dev", "dev@example.com"]);
  } catch (e) { freedAgain = false; console.log("      " + String(e && e.message).slice(0, 120)); }
  ok("a CANCELLED booking does not hold its slot", freedAgain);

  await sqlQuery(db, 'INSERT INTO "members" ("email","nickname") VALUES (?,?)', ["Ada@Example.com", "ada"]);
  let ciRefused = false;
  try { await sqlQuery(db, 'INSERT INTO "members" ("email","nickname") VALUES (?,?)', ["ada@example.com", "ada2"]); }
  catch { ciRefused = true; }
  ok("the same address in a different case is refused", ciRefused);

  const teamCol = await sqlQuery(db,
    "SELECT data_type FROM information_schema.columns WHERE table_name='deals' AND column_name='team_id'");
  ok("a teamScope table gets a uuid team_id", teamCol[0] && teamCol[0].data_type === "uuid", JSON.stringify(teamCol));

  // The policy EXISTING is the assertion. Its subquery reads neon_auth.member,
  // and applySiteSchema catches and logs a failed policy — so a clause that does
  // not parse leaves the table with no read policy and nothing says so.
  const pol = await sqlQuery(db,
    "SELECT policyname, qual FROM pg_policies WHERE tablename='deals' AND cmd='SELECT'");
  ok("its read policy was created, so the team clause parsed", pol.length === 1, JSON.stringify(pol));
  // Anchored on `organizationId` rather than on `neon_auth.member`: Postgres
  // stores a policy as a parsed expression and RE-RENDERS it here, so whether the
  // schema qualifier survives is its choice and not ours. A quoted camelCase
  // column cannot be re-rendered away, and it appears nowhere in the plain
  // own-rows policy — so its presence is exactly the widening.
  ok("and the policy really widens to the organization",
    !!(pol[0] && /organizationId/.test(String(pol[0].qual))), JSON.stringify(pol[0] || {}).slice(0, 300));
  // A member in NO organization must still see their own rows — every naive
  // "same team" clause fails outward here, and a fresh site is entirely in that
  // state, so it is the default rather than an edge case.
  ok("and it still falls back to the caller's own rows",
    !!(pol[0] && /owner_id/.test(String(pol[0].qual))), JSON.stringify(pol[0] || {}).slice(0, 300));

  // Derived from the fixture, not a number somebody has to remember: adding a
  // table to SCHEMA must not fail a test about idempotence.
  ok("schema re-apply is idempotent", again.length === SCHEMA.tables.length,
    `${again.length} of ${SCHEMA.tables.length}`);
  const stillOne = await sqlQuery(db, 'SELECT COUNT(*)::int AS n FROM "posts" WHERE "title"=?', ["Hello edited"]);
  ok("re-apply did not destroy existing rows", stillOne[0].n === 1);

  // ── the claim flow, against a real database ──────────────────────────────
  //
  // The one thing only Postgres can settle: SECURITY DEFINER actually reaching
  // past the grants. Every layer above was asserted without a database — the
  // designer can declare it, the normaliser keeps it, the DDL is emitted, the
  // model is told, the lint checks the name — and all five would pass on a
  // function that returns nothing at runtime.
  console.log("\nthe claim flow…");
  ok("applySiteSchema reports which functions it made", Array.isArray(made.functions) && made.functions.length === 2,
    JSON.stringify(made.functions || null));
  ok("and reports no failures", !made.functionErrors, JSON.stringify(made.functionErrors || null));

  const fnRows = await sqlQuery(db,
    "SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
    "WHERE n.nspname='public' AND p.proname IN ('booking_by_claim','cancel_booking_by_claim') ORDER BY p.proname");
  ok("both declared functions exist in the database", fnRows.length === 2, JSON.stringify(fnRows));
  ok("and both are SECURITY DEFINER — without it a claim read sees nothing",
    fnRows.every((r) => r.prosecdef === true), JSON.stringify(fnRows));

  // EXECUTE has to be granted or the function exists and the Data API answers
  // 404 to it — the publicView failure, one object over.
  const canExec = await sqlQuery(db,
    "SELECT has_function_privilege('anonymous', 'booking_by_claim(uuid)', 'EXECUTE') AS anon, " +
    "has_function_privilege('authenticated', 'booking_by_claim(uuid)', 'EXECUTE') AS auth");
  ok("a signed-out visitor may EXECUTE it", canExec[0].anon === true, JSON.stringify(canExec[0]));
  ok("and so may a member", canExec[0].auth === true, JSON.stringify(canExec[0]));

  // …while the TABLE stays shut. This is the pair that makes the feature a
  // narrow hole rather than a read policy: no SELECT for anyone, and exactly one
  // row reachable through a token.
  const canRead = await sqlQuery(db,
    "SELECT has_table_privilege('anonymous', 'bookings', 'SELECT') AS sel, " +
    "has_table_privilege('anonymous', 'bookings', 'INSERT') AS ins");
  ok("but may NOT select the table it reads from", canRead[0].sel === false, JSON.stringify(canRead[0]));
  ok("and may still submit the form", canRead[0].ins === true, JSON.stringify(canRead[0]));

  await sqlQuery(db, 'INSERT INTO "bookings" ("customer_name","slot") VALUES (?,?)', ["Ada", "10:30"]);
  const mine = await sqlQuery(db, 'SELECT claim_token FROM "bookings" WHERE customer_name=?', ["Ada"]);
  const tok = mine[0] && mine[0].claim_token;
  ok("the collect row minted a claim token", !!tok, JSON.stringify(mine[0] || {}));

  const got = await sqlQuery(db, "SELECT * FROM booking_by_claim(?)", [tok]);
  ok("the claim function returns exactly that row", got.length === 1 && got[0].customer_name === "Ada",
    JSON.stringify(got).slice(0, 200));

  // A wrong token is EMPTY, never an error: a bad link and a cancelled booking
  // must look the same, or the response is an oracle for which tokens exist.
  const wrongTok = await sqlQuery(db, "SELECT * FROM booking_by_claim('00000000-0000-0000-0000-000000000000')");
  ok("a wrong token returns nothing rather than erroring", wrongTok.length === 0, JSON.stringify(wrongTok));

  await sqlQuery(db, "SELECT cancel_booking_by_claim(?)", [tok]);
  const after = await sqlQuery(db, "SELECT * FROM booking_by_claim(?)", [tok]);
  ok("cancelling by the same token removes it", after.length === 0, JSON.stringify(after));

} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + (e && (e.detail || e.message || e)));
  if (e && e.stack) console.log(e.stack.split("\n").slice(0, 4).join("\n"));
} finally {
  if (project && project.projectId) {
    try { await dropUserProject(env, project.projectId); console.log("\ntore down the throwaway project"); }
    catch (e) { console.log("\nWARNING: could not delete project " + project.projectId + " — remove it by hand"); }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

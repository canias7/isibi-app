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
import { isManagedColumn } from "../../site-access.mjs";

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
      // THE FIXTURE HAD NO DISPLAY TABLE, found 2026-08-05 when a new check
      // asserted a stranger could read one and got "permission denied for table
      // posts". Every `access: "public"` below normalizes to `collect` — the
      // level list is collect/display/user/feed/admin and anything else falls
      // back to the default — so the level a menu, a price list and every
      // brochure page uses had never been exercised against a real database.
      name: "menu",
      access: "display",
      columns: [
        { name: "dish", type: "text" },
        { name: "price", type: "real" },
      ],
    },
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
      // ── THE MANAGED COLUMNS, ON A TABLE A MEMBER CAN WRITE ────────────────
      //
      // Owner, 2026-09-13: "Resolve … direct PostgREST access to managed
      // columns using ordinary member permissions. Report actual allowed and
      // denied behavior."
      //
      // `MANAGED_COLUMNS` says of every name on it: set by the engine, not the
      // app, never writable through the API at any level. `isManagedColumn`
      // enforces that on OUR routes. The Data API is PostgREST talking to
      // Postgres directly, so the only things between a member and `pinned`
      // there are the column privilege and the UPDATE policy — and
      // `test/schema-uncertainties.test.mjs` drives every grant the engine
      // emits and finds NO column-scoped one anywhere. That is what the engine
      // WRITES. This table is what lets a real Postgres say what it DOES.
      //
      // NO TABLE HERE COULD ANSWER IT BEFORE, which is why one is added rather
      // than a flag moved: `deals` is the only member-writable table in this
      // fixture and declares none of these flags, and every table that declares
      // them is `collect` or `display`, which grant no UPDATE to anybody.
      name: "notes",
      access: "user",
      columns: [{ name: "title", type: "text" }],
      ordered: true,     // position
      pinnable: true,    // pinned
      trash: true,       // deleted_at
      version: true,     // _version
      timestamps: true,  // updated_at
      scheduled: true,   // publish_at
      expires: true,     // expires_at
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
    // NOT called `bookings` — the fixture already has one, with a publicView and
    // noOverlap, and reusing the name silently REPLACED it: the run failed on
    // `relation "bookings_public" does not exist`, six checks away from anything
    // to do with functions. A fixture is a namespace like any other.
    {
      name: "enquiries",
      access: "collect",
      columns: [
        { name: "customer_name", type: "text" },
        { name: "message", type: "text" },
        // `default:"uuid"` is the engine's reserved token → gen_random_uuid()::text.
        // The column is TEXT, so the function argument is text: declaring the column
        // `type:"uuid"` silently became TEXT (PG_TYPES has no uuid) and the body then
        // failed with `operator does not exist: text = uuid`.
        { name: "claim_token", type: "text", default: "uuid" },
      ],
    },
  ],
  functions: [
    { name: "enquiry_by_claim", args: [{ name: "tok", type: "text" }], returns: "setof enquiries",
      body: "SELECT * FROM enquiries WHERE claim_token = tok" },
    { name: "cancel_enquiry_by_claim", args: [{ name: "tok", type: "text" }], returns: "void",
      body: "DELETE FROM enquiries WHERE claim_token = tok" },
    // AN INTERNAL FUNCTION — the confirmation-email case, and the one whose
    // failure is silent. A `confirm: {fn}` function reads a `collect` row and
    // returns the customer's address, subject and body; the platform calls it on
    // the owner's connection when a booking lands. `internal: true` withholds the
    // EXECUTE grant precisely so it is NOT one of the site's public RPCs, because
    // a caller who could invoke it would be reading customer records out of a
    // write-only table by guessing row ids.
    //
    // Every layer above this was asserted without a database — the designer can
    // declare it, the normaliser keeps the flag, `functionSql` skips the GRANT —
    // and all three pass on a build where the grant is emitted anyway. Only
    // Postgres can say whether the privilege is actually absent.
    { name: "confirm_enquiry", args: [{ name: "row_id", type: "integer" }], returns: "setof enquiries",
      internal: true,
      body: "SELECT * FROM enquiries WHERE id = row_id" },
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

  // --- can the role EVALUATE the policy, not merely ask? ---------------------
  //
  // `has_table_privilege` answers whether a role is allowed to ask the question.
  // It says nothing about whether the policy attached to the table can be
  // evaluated once it does — and those are two different failures wearing the
  // same green tick. Measured live 2026-08-05: every grant was right, every
  // policy existed, and every member read and write answered `42501 permission
  // denied for schema auth`, because `app_user_id()` is SECURITY INVOKER and the
  // Data API's roles had no USAGE on the schema `pg_session_jwt` creates. This
  // whole suite was green throughout, and so was `build smoke` — the levels with
  // no coverage were exactly the broken ones.
  //
  // The precise form first, because it cannot fail for an unrelated reason.
  // THE GRANT IS REPORTED, NOT ASSERTED, and that distinction was earned: the
  // first version of this check demanded the privilege and the fix was to grant
  // it — the statements raised no error and the privilege stayed false, so
  // `auth` is Neon's to open and not ours. Asserting it would sit red forever
  // saying nothing. What IS asserted is the property that matters, below:
  // whether the policy can actually be evaluated.
  const schemaPriv = await sqlQuery(db,
    "SELECT has_schema_privilege('authenticated','auth','USAGE') AS u, " +
    "has_schema_privilege('anonymous','auth','USAGE') AS a " +
    "WHERE EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth')");
  console.log("   auth-schema USAGE: " + (schemaPriv.length ? JSON.stringify(schemaPriv[0]) : "(no auth schema — the fallback body needs none)"));
  console.log("   grants attempted:  " + JSON.stringify(made.authGrants || []).slice(0, 240));
  // app_user_id() must therefore run as its DEFINER, which is what makes the
  // schema reachable at all. Read back from the database, not from our source.
  const idFn = await sqlQuery(db, "SELECT prosecdef FROM pg_proc WHERE proname='app_user_id'");
  ok("app_user_id runs as its definer, or nothing can reach auth.user_id()",
    !!(idFn[0] && idFn[0].prosecdef === true), JSON.stringify(idFn[0] || {}));

  // And the general property: run a real SELECT under the role, so RLS actually
  // applies. Every query above this line runs as the table's OWNER, which
  // bypasses its own policies — which is why none of them could ever have caught
  // this.
  const asRole = async (role, body) => {
    try {
      await sqlQuery(db, "DO $isibi$ DECLARE n bigint; BEGIN SET LOCAL ROLE " +
        role + "; " + body + " END $isibi$;");
      return null;
    } catch (e) { return String((e && (e.detail || e.message)) || e); }
  };
  const probe = await asRole("authenticated", 'SELECT count(*) INTO n FROM "deals";');
  // An honest skip rather than a pass or a failure: if this connection cannot
  // assume the role at all, the check never ran and saying so is the only
  // truthful report. Silence here would read as coverage.
  if (probe && /permission denied to set role/i.test(probe)) {
    console.log("   (cannot SET ROLE from this connection — policy evaluation not exercised)");
  } else {
    ok("a member's own-rows policy can be EVALUATED, not just granted", probe === null, String(probe));
    const team = await asRole("authenticated", 'SELECT count(*) INTO n FROM "deals" WHERE "team_id" IS NOT NULL;');
    ok("and so can the team clause it widens to", team === null, String(team));
    const stranger = await asRole("anonymous", 'SELECT count(*) INTO n FROM "menu";');
    ok("a stranger can still read a display table", stranger === null, String(stranger));
    // And the level next to it must still refuse — otherwise "the roles can read
    // things" is all this proves.
    const nosy = await asRole("anonymous", 'SELECT count(*) INTO n FROM "bookings";');
    ok("and still cannot read a collect table", /permission denied/i.test(String(nosy)), String(nosy));
  }

  // --- what a member may ACTUALLY write on a managed column ------------------
  //
  // ACTUAL BEHAVIOUR, read off a real Postgres under the real role, and kept
  // apart from inference on purpose (owner, 2026-09-13: "Report actual behavior
  // separately from inference"). The unit guard drives what the engine EMITS —
  // no grant it writes is column-scoped — and stops there, because what
  // Postgres then does with those statements is not something a unit test can
  // answer. This is the half that answers it.
  //
  // WHY THIS IS THE SAME QUESTION AS "through PostgREST". A Data API request is
  // run as: assume `authenticated`, set the request's JWT claims, run the SQL.
  // `asMember` below is those three steps, so a column this lets through is a
  // column a member can PATCH. What PostgREST adds on top — parsing the body,
  // choosing the columns — is not a privilege gate.
  const MEMBER_UID = "11111111-2222-3333-4444-555555555555";
  const asMember = async (body) => {
    try {
      await sqlQuery(db, "DO $isibi$ BEGIN SET LOCAL ROLE authenticated; " +
        "PERFORM set_config('request.jwt.claims', '{\"sub\":\"" + MEMBER_UID + "\"}', true); " +
        body + " END $isibi$;");
      return null;
    } catch (e) { return String((e && (e.detail || e.message)) || e); }
  };
  // A FRESH ROW PER PROBE, written as the OWNER so RLS is out of the way while
  // it is created. One row reused would make the probes depend on each other —
  // setting `deleted_at` hides the row from its own member, and re-pointing
  // `owner_id` takes it away — so a later "denied" could be an earlier probe's
  // doing rather than the database's.
  const freshNote = async () => {
    await sqlQuery(db, 'INSERT INTO "notes" ("title","owner_id") VALUES (?, ?::uuid)', ["Draft", MEMBER_UID]);
    const r = await sqlQuery(db, 'SELECT "id" FROM "notes" ORDER BY "id" DESC LIMIT 1');
    return r[0] && r[0].id;
  };
  const roleProbe = await asMember("PERFORM 1;");
  if (roleProbe && /permission denied to set role/i.test(roleProbe)) {
    // An honest skip, never silence: a check that did not run must say so, or
    // its absence reads as coverage.
    console.log("   (cannot SET ROLE from this connection — the managed-column question was NOT answered here)");
  } else {
    // THE CONTROL FIRST. If an ordinary column cannot be written either, every
    // "denied" below is this fixture's doing and means nothing — the recorded
    // "a negative assertion must prove its observer is alive".
    const ctlId = await freshNote();
    const ctlErr = await asMember('UPDATE "notes" SET "title" = \'Edited\' WHERE "id" = ' + ctlId + ';');
    const ctlRow = await sqlQuery(db, 'SELECT "title" FROM "notes" WHERE "id" = ?', [ctlId]);
    const ctlWorked = !ctlErr && ctlRow[0] && ctlRow[0].title === "Edited";
    ok("a member can write an ORDINARY column on their own row (the control)", ctlWorked,
      String(ctlErr || JSON.stringify(ctlRow[0] || {})));

    if (ctlWorked) {
      // DERIVED FROM THE COLUMNS POSTGRES REPORTS, never a list typed here, so a
      // managed column added to the engine appears in this answer by existing.
      const cols = await sqlQuery(db,
        "SELECT column_name FROM information_schema.columns WHERE table_name='notes' ORDER BY column_name");
      const present = cols.map((c) => String(c.column_name)).filter((c) => isManagedColumn(c));
      ok("the fixture really carries managed columns", present.length >= 6, JSON.stringify(present));
      // A value that is genuinely DIFFERENT from what the row holds, or an
      // allowed write would read as a refusal. `owner_id` gets a stranger's id
      // for the same reason — re-pointing it at the member changes nothing.
      const VALUE = {
        id: "999999", pinned: "1", position: "99", _version: "99",
        created_at: "'2026-01-01 00:00:00'", updated_at: "'2026-01-01 00:00:00'",
        deleted_at: "'2026-01-01 00:00:00'", publish_at: "'2026-01-01 00:00:00'",
        expires_at: "'2026-01-01 00:00:00'", archived_at: "'2026-01-01 00:00:00'",
        owner_id: "'99999999-8888-7777-6666-555555555555'::uuid",
        team_id: "'99999999-8888-7777-6666-555555555555'::uuid",
      };
      const allowed = [], denied = [], unprobed = [];
      for (const c of present) {
        if (!VALUE[c]) { unprobed.push(c); continue; }
        const id = await freshNote();
        const before = await sqlQuery(db, 'SELECT "' + c + '"::text AS v FROM "notes" WHERE "id" = ?', [id]);
        const err = await asMember('UPDATE "notes" SET "' + c + '" = ' + VALUE[c] + ' WHERE "id" = ' + id + ';');
        // Read back as the OWNER, which bypasses RLS — so a row the member's own
        // read policy would now hide is still visible to this check.
        const after = await sqlQuery(db, 'SELECT "' + c + '"::text AS v FROM "notes" WHERE "id" = ' +
          (c === "id" ? VALUE.id : String(id)));
        const was = String((before[0] && before[0].v) === null ? "" : (before[0] && before[0].v));
        const now = String((after[0] && after[0].v) === null ? "" : (after[0] && after[0].v));
        if (!err && after.length && now !== was) allowed.push(c);
        else denied.push(c + (err ? " [" + String(err).slice(0, 70) + "]" : " [no error, nothing changed]"));
      }
      console.log("   MANAGED COLUMNS A MEMBER COULD WRITE: " + (allowed.join(", ") || "(none)"));
      console.log("   MANAGED COLUMNS A MEMBER COULD NOT:   " + (denied.join(" | ") || "(none)"));
      if (unprobed.length) console.log("   NOT PROBED (no value defined):        " + unprobed.join(", "));
      // REPORTED, NOT ASSERTED EITHER WAY, and that is the decision rather than
      // an omission. The audit's finding is that nothing in the SQL
      // distinguishes a managed column from any other one; which of the two
      // lists SHOULD be empty is a product call the owner has not made, and an
      // assertion here would pin today's answer as though it were intended.
      // What IS asserted is that the question was really asked.
      ok("the managed-column question was answered by a real database",
        allowed.length + denied.length >= 6, "allowed=" + allowed.length + " denied=" + denied.length);
    }
  }

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
  // THE MEMBERSHIP READ MOVED ONE LEVEL DOWN, into `app_team_id()`, because a
  // policy that selects `neon_auth.member` is evaluated as the CALLER and the
  // caller cannot reach it. So this is asserted as a chain: the policy calls the
  // function, and the function — read back out of the database, not out of our
  // source — is the thing that reads the organization.
  ok("and the policy really widens to the organization",
    !!(pol[0] && /app_team_id\(\)/.test(String(pol[0].qual))), JSON.stringify(pol[0] || {}).slice(0, 300));
  // OWNER_ID MUST FILL ITSELF IN. Nothing stamps it since the Worker's data path
  // was deleted, so without a default every member insert carries NULL and the
  // policy's WITH CHECK refuses it — read worked, write did not, on every site.
  const ownerDef = await sqlQuery(db,
    "SELECT column_default FROM information_schema.columns WHERE table_name='deals' AND column_name='owner_id'");
  ok("owner_id defaults to the caller, or no member can write anything",
    !!(ownerDef[0] && /app_user_id\(\)/.test(String(ownerDef[0].column_default))), JSON.stringify(ownerDef[0] || {}));

  // MEASURED 2026-08-05 and it is `uuid`, which is what let `team_id` gain a
  // default at all — until this run it was deliberately left without one,
  // because a bare `::uuid` cast on a non-uuid throws and every write to a team
  // table would have failed. Still printed rather than asserted: it is Neon's
  // column, so a change there is news rather than a broken build, and the
  // default is guarded by a regex either way.
  const orgType = await sqlQuery(db,
    "SELECT data_type FROM information_schema.columns WHERE table_schema='neon_auth' AND table_name='member' AND column_name='organizationId'");
  console.log("   neon_auth.member.organizationId is: " + (orgType[0] ? orgType[0].data_type : "(no such column)"));
  const teamDef = await sqlQuery(db,
    "SELECT column_default FROM information_schema.columns WHERE table_name='deals' AND column_name='team_id'");
  ok("team_id defaults to the caller's team, or the widening shares nothing",
    !!(teamDef[0] && /app_team_id\(\)/.test(String(teamDef[0].column_default))), JSON.stringify(teamDef[0] || {}));
  // A member in NO organization gets NULL rather than an error — which is the
  // state a fresh site is entirely in, so it is the default path and not an edge.
  const teamNull = await sqlQuery(db, "SELECT " + "app_team_id() IS NULL AS none");
  ok("and a member in no organization simply gets none", teamNull[0] && teamNull[0].none === true,
    JSON.stringify(teamNull[0] || {}));

  const teamFn = await sqlQuery(db,
    "SELECT prosecdef, pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='app_team_id'");
  ok("app_team_id exists and reads neon_auth.member",
    !!(teamFn[0] && /neon_auth\.member/.test(String(teamFn[0].def))), JSON.stringify(teamFn[0] || {}).slice(0, 200));
  // Definer rights are what let it read that table at all; without them the
  // clause is the same permission wall wearing a function call.
  ok("and it runs as its definer", !!(teamFn[0] && teamFn[0].prosecdef === true), JSON.stringify(teamFn[0] || {}).slice(0, 120));
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
  // Derived from the fixture, not a remembered number — adding a function must
  // not fail a test about whether functions are reported at all.
  ok("applySiteSchema reports which functions it made",
    Array.isArray(made.functions) && made.functions.length === SCHEMA.functions.length,
    `${(made.functions || []).length} of ${SCHEMA.functions.length}`);
  ok("and reports no failures", !made.functionErrors, JSON.stringify(made.functionErrors || null));

  const fnRows = await sqlQuery(db,
    "SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
    "WHERE n.nspname='public' AND p.proname IN ('enquiry_by_claim','cancel_enquiry_by_claim') ORDER BY p.proname");
  ok("both declared functions exist in the database", fnRows.length === 2, JSON.stringify(fnRows));
  // `.every()` ON AN EMPTY ARRAY IS TRUE, so this reported "ok" on the run where
  // NEITHER function had been created — the most reassuring possible way to say
  // nothing exists. The length is part of the assertion now.
  ok("and both are SECURITY DEFINER — without it a claim read sees nothing",
    fnRows.length === 2 && fnRows.every((r) => r.prosecdef === true), JSON.stringify(fnRows));

  // EXECUTE has to be granted or the function exists and the Data API answers
  // 404 to it — the publicView failure, one object over.
  const canExec = await sqlQuery(db,
    "SELECT has_function_privilege('anonymous', 'enquiry_by_claim(text)', 'EXECUTE') AS anon, " +
    "has_function_privilege('authenticated', 'enquiry_by_claim(text)', 'EXECUTE') AS auth");
  ok("a signed-out visitor may EXECUTE it", canExec[0].anon === true, JSON.stringify(canExec[0]));
  ok("and so may a member", canExec[0].auth === true, JSON.stringify(canExec[0]));

  // …while the TABLE stays shut. This is the pair that makes the feature a
  // narrow hole rather than a read policy: no SELECT for anyone, and exactly one
  // row reachable through a token.
  const canRead = await sqlQuery(db,
    "SELECT has_table_privilege('anonymous', 'enquiries', 'SELECT') AS sel, " +
    "has_table_privilege('anonymous', 'enquiries', 'INSERT') AS ins");
  ok("but may NOT select the table it reads from", canRead[0].sel === false, JSON.stringify(canRead[0]));
  ok("and may still submit the form", canRead[0].ins === true, JSON.stringify(canRead[0]));

  // ── search_path ON MODEL FUNCTIONS: PINNED SINCE 2026-09-16 ───────────────
  //
  // RE-ANCHORED, NOT APPEASED, AND THE PREMISE IS WHAT MOVED. This block used to
  // assert the opposite — "a model function does NOT [pin] — recorded, and safe
  // only while the four checks above hold" — resting on the claim that the
  // escalation "needs BOTH halves … a caller can put a schema of their own ahead
  // of `public`, and they can create an object in it", with four `CREATE`
  // privileges measured to say nobody can.
  //
  // **THE FOUR CHECKS WERE TRUE AND THE PREMISE WAS INCOMPLETE.** There is a
  // third kind of conflicting object that needs no `CREATE` at all: a TEMPORARY
  // relation. `TEMP` on the database is granted to PUBLIC by Postgres's own
  // default, and an unlisted `pg_temp` is searched FIRST for relations, so the
  // caller never touches its own `search_path` either. Measured on a real
  // PostgreSQL 16 by `test/integration/local-pg-searchpath.mjs`: a role refused
  // `SELECT` on the table outright creates `pg_temp.<table>` and the definer
  // function that counts the owner's rows answers the ATTACKER's count.
  //
  // So the four checks stay — they are still the two halves of the SCHEMA route
  // and they are still worth measuring on a live project — and the TEMP question
  // that was never asked is asked beside them. What changed is that none of them
  // is load-bearing any more: the pin is.
  const creates = await sqlQuery(db,
    "SELECT has_database_privilege('anonymous', current_database(), 'CREATE') AS anon_db, " +
    "has_database_privilege('authenticated', current_database(), 'CREATE') AS auth_db, " +
    "has_schema_privilege('anonymous', 'public', 'CREATE') AS anon_public, " +
    "has_schema_privilege('authenticated', 'public', 'CREATE') AS auth_public, " +
    "has_database_privilege('anonymous', current_database(), 'TEMP') AS anon_temp, " +
    "has_database_privilege('authenticated', current_database(), 'TEMP') AS auth_temp");
  const c = creates[0] || {};
  ok("anonymous cannot create a schema to hide in", c.anon_db === false, JSON.stringify(c));
  ok("authenticated cannot create a schema to hide in", c.auth_db === false, JSON.stringify(c));
  ok("anonymous cannot create an object in public", c.anon_public === false, JSON.stringify(c));
  ok("authenticated cannot create an object in public", c.auth_public === false, JSON.stringify(c));
  // REPORTED, NOT ASSERTED EITHER WAY. Postgres grants TEMP to PUBLIC by default,
  // so `true` is the expected answer and is not a finding — `false` would mean
  // Neon revokes it, which is worth knowing and is not something to depend on.
  // The line exists so the answer is on the record instead of being re-derived.
  console.log("  note TEMP on this database: anonymous=" + c.anon_temp + " authenticated=" + c.auth_temp +
    " — PUBLIC holds TEMP by Postgres's default, which is why the pin and not these four is the wall");
  // THE WALL ITSELF, now that it exists. Both the model's function and the
  // engine's helper, because one of them passing says nothing about the other.
  const pinned = await sqlQuery(db,
    "SELECT proname, proconfig FROM pg_proc WHERE proname IN ('enquiry_by_claim','app_user_id') ORDER BY proname");
  const byName = Object.fromEntries((pinned || []).map((r) => [r.proname, r.proconfig]));
  const pathOf = (n) => (Array.isArray(byName[n]) ? byName[n] : []).find((s) => /^search_path=/.test(s)) || "";
  ok("the engine's own helper pins search_path", /^search_path=/.test(pathOf("app_user_id")), JSON.stringify(byName));
  ok("and so does the model's function, since 2026-09-16", /^search_path=/.test(pathOf("enquiry_by_claim")),
    JSON.stringify(byName));
  // THE ORDER IS THE FIX, not the presence — `pg_temp, public` pins, parses, and
  // leaves the hole exactly where it was.
  ok("with pg_temp LAST, which is the whole of it",
    /,\s*pg_temp$/.test(pathOf("enquiry_by_claim")), pathOf("enquiry_by_claim"));
  // A SITE THAT HAS NOT RE-APPLIED ITS SCHEMA SINCE THE FIX STILL CARRIES THE OLD
  // FUNCTION, because `CREATE OR REPLACE` only runs on the next schema change.
  // This probe builds its own project, so it can assert; a check against a live
  // customer site would have to report rather than assert.

  // ── `internal: true` withholds the grant ─────────────────────────────────
  //
  // The confirmation-email function. It exists and the platform calls it on the
  // owner's connection; what must NOT be true is that the internet can. Asserted
  // as a PAIR with the public function above — "anonymous cannot execute it" is
  // also what you get from a function that was never created, from a typo in the
  // privilege string, or from an account where nothing is granted to anybody, so
  // on its own it passes for all the wrong reasons.
  const internalExists = await sqlQuery(db,
    "SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
    "WHERE n.nspname='public' AND p.proname='confirm_enquiry'");
  ok("the internal function was created", internalExists.length === 1, JSON.stringify(internalExists));

  const internalExec = await sqlQuery(db,
    "SELECT has_function_privilege('anonymous', 'confirm_enquiry(integer)', 'EXECUTE') AS anon, " +
    "has_function_privilege('authenticated', 'confirm_enquiry(integer)', 'EXECUTE') AS auth");
  ok("a signed-out visitor may NOT execute an internal function",
    internalExec[0].anon === false, JSON.stringify(internalExec[0]));
  ok("and neither may a signed-in member",
    internalExec[0].auth === false, JSON.stringify(internalExec[0]));
  // The contrast is the assertion. Same database, same roles, same call — one
  // function is reachable and one is not, which is the only way to show the flag
  // did the work rather than the environment.
  ok("while the public function next to it still is",
    canExec[0].anon === true && internalExec[0].anon === false,
    `public=${canExec[0].anon} internal=${internalExec[0].anon}`);

  // The platform still has to be able to CALL it — an internal function nobody
  // can invoke sends no confirmation, which is the failure this whole tier keeps
  // producing. The Worker connects as the owner, which is this connection.
  await sqlQuery(db, 'INSERT INTO "enquiries" ("customer_name","message") VALUES (?,?)', ["Grace", "confirm me"]);
  const target = await sqlQuery(db, 'SELECT id FROM "enquiries" WHERE customer_name=?', ["Grace"]);
  const built = await sqlQuery(db, "SELECT * FROM confirm_enquiry(?)", [target[0].id]);
  ok("but the owner's own connection can call it",
    built.length === 1 && built[0].customer_name === "Grace", JSON.stringify(built).slice(0, 200));

  // ── the vault is not a table the site can reach ──────────────────────────
  //
  // `_secrets` holds the owner's Stripe and mail keys and lives in this same
  // database, beside the declared tables. It is safe only because grants are
  // emitted PER DECLARED TABLE and it is not one — there is no GRANT ON ALL
  // TABLES and no USAGE on the schema for the Data API roles. That is an
  // argument about code; this is the measurement.
  const vault = await sqlQuery(db,
    "SELECT to_regclass('public._secrets') IS NOT NULL AS present, " +
    "has_table_privilege('anonymous','public._secrets','SELECT') AS anon_sel, " +
    "has_table_privilege('authenticated','public._secrets','SELECT') AS auth_sel, " +
    "has_table_privilege('anonymous','public._secrets','INSERT') AS anon_ins");
  // Created by applySiteSchema on EVERY build — the `_sessions` lesson, where a
  // table existing only where somebody used a feature 500s everywhere else. If
  // it were absent the privilege checks below would error rather than pass, but
  // stating it separately is what makes their result mean something.
  ok("_secrets exists on every site", vault[0].present === true, JSON.stringify(vault[0]));
  ok("no anonymous SELECT on the vault", vault[0].anon_sel === false, JSON.stringify(vault[0]));
  ok("no member SELECT on the vault", vault[0].auth_sel === false, JSON.stringify(vault[0]));
  ok("and no anonymous INSERT either", vault[0].anon_ins === false, JSON.stringify(vault[0]));

  await sqlQuery(db, 'INSERT INTO "enquiries" ("customer_name","message") VALUES (?,?)', ["Ada", "10:30"]);
  const mine = await sqlQuery(db, 'SELECT claim_token FROM "enquiries" WHERE customer_name=?', ["Ada"]);
  const tok = mine[0] && mine[0].claim_token;
  ok("the collect row minted a claim token", !!tok, JSON.stringify(mine[0] || {}));

  const got = await sqlQuery(db, "SELECT * FROM enquiry_by_claim(?)", [tok]);
  ok("the claim function returns exactly that row", got.length === 1 && got[0].customer_name === "Ada",
    JSON.stringify(got).slice(0, 200));

  // A wrong token is EMPTY, never an error: a bad link and a cancelled booking
  // must look the same, or the response is an oracle for which tokens exist.
  const wrongTok = await sqlQuery(db, "SELECT * FROM enquiry_by_claim('not-a-real-token')");
  ok("a wrong token returns nothing rather than erroring", wrongTok.length === 0, JSON.stringify(wrongTok));

  await sqlQuery(db, "SELECT cancel_enquiry_by_claim(?)", [tok]);
  const after = await sqlQuery(db, "SELECT * FROM enquiry_by_claim(?)", [tok]);
  ok("cancelling by the same token removes it", after.length === 0, JSON.stringify(after));

  // ── the sandbox boundary, MEASURED rather than quoted from a note ──────────
  //
  // This lived only in CLAUDE.md, from one uncommitted session, and in the gap
  // it drifted into two self-contradictions: the file said `pg_cron` was
  // unavailable while another entry said it was, and said "the database has no
  // internet" while another entry recorded that exact claim being measured and
  // found FALSE. Both were being used to justify where platform code lives.
  //
  // The four that ARE allowed are REPORTED, not asserted. Neon curates that
  // list; it is their platform property, not our invariant, and a test that
  // goes red because a vendor added an extension is a test that gets muted.
  console.log("\nsandbox boundary");
  const extRows = await sqlQuery(db,
    "SELECT name FROM pg_available_extensions WHERE name IN " +
    "('http','pg_net','dblink','postgres_fdw','pg_cron','plpython3u','plperlu','file_fdw')");
  const have = new Set((extRows || []).map((r) => r.name));

  // THE LOAD-BEARING ONE, and the only assertion here. Payments and site email
  // live in the Worker because Postgres cannot make an HTTPS call. If that ever
  // stops being true the decision is worth revisiting, so it fails loudly.
  ok("no HTTP client in Postgres — http and pg_net both absent",
    !have.has("http") && !have.has("pg_net"), "present: " + [...have].join(", "));

  // LISTED IS NOT INSTALLABLE, and the first version of this probe conflated
  // them. `pg_available_extensions` is the CATALOG; Neon refuses several of the
  // things in it at CREATE time. Measured here: file_fdw is listed and Neon's
  // own docs call it unsupported ("files would not remain accessible when Neon
  // scales to zero"), which is exactly the pair that exposes the difference.
  //
  // So absence is read from the catalog — not listed means it cannot possibly
  // be installed — and presence is proved by actually running CREATE EXTENSION.
  // Anything less makes "egress is open" an inference, and inference is what
  // put two contradictions in CLAUDE.md.
  const installable = async (n) => {
    if (!have.has(n)) return "absent from the catalog";
    try { await sqlQuery(db, "CREATE EXTENSION IF NOT EXISTS " + n); return "INSTALLED"; }
    catch (e) { return "listed, REFUSED: " + String((e && (e.detail || e.message)) || e).slice(0, 60); }
  };
  const state = {};
  for (const n of ["dblink", "postgres_fdw", "pg_cron", "plpython3u", "plperlu", "file_fdw"]) {
    state[n] = await installable(n);
    console.log("  note " + n.padEnd(13) + state[n]);
  }

  // The honest counterweight, printed so nobody re-derives "the database cannot
  // reach the network" from the assertion above. That inference HAS been drawn
  // in this repo, twice, and it is wrong both times.
  const egress = ["dblink", "postgres_fdw"].filter((n) => state[n] === "INSTALLED");
  console.log("  note EGRESS IS " + (egress.length ? "OPEN via: " + egress.join(", ") : "CLOSED — no outbound extension installed") +
    " — 'no HTTP' is the claim, never 'no internet'");

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

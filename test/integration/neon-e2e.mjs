// End-to-end proof against a REAL Neon account.
//
// Provisions a throwaway project, applies a schema through the actual schema
// engine, exercises the features whose SQL changed in the D1 -> Postgres port,
// then deletes the project. Nothing is mocked: if the generated DDL is invalid
// Postgres, this fails.
//
// Needs NEON_API_KEY. Run: node test/integration/neon-e2e.mjs
import {
  createUserProject, createSiteDatabase, dropUserProject,
  connForDatabase, sqlQuery, sqlExec, neonConfigured, enableNeonAuth,
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
      name: "comments",
      access: "public",
      columns: [
        { name: "post_id", type: "integer", ref: "posts" },
        { name: "text", type: "text" },
      ],
      enforceRefs: true,  // BEFORE INSERT/UPDATE guard triggers
      maxRows: 5,         // BEFORE INSERT row-cap trigger
    },
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

  console.log("applying the schema…");
  const made = await applySiteSchema(db, SCHEMA);
  ok("applySiteSchema reports every table", made.length === 3, JSON.stringify(made));

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
  ok("schema re-apply is idempotent", again.length === 3);
  const stillOne = await sqlQuery(db, 'SELECT COUNT(*)::int AS n FROM "posts" WHERE "title"=?', ["Hello edited"]);
  ok("re-apply did not destroy existing rows", stillOne[0].n === 1);
  // ================================================= Neon Auth, against Neon
  //
  // The whole backend is Neon as of 2026-07-30, and every claim below was taken
  // from documentation rather than measured — including the one the entire
  // migration rests on. `owner_id` stops being an integer because
  // `users_sync.id` is text; if that is wrong, the migration is wrong.
  console.log("\nenabling Neon Auth…");
  const authConn = connForDatabase(project.conn, dbName);
  let enabled = null;
  try {
    enabled = await enableNeonAuth(env, project.projectId, project.branchId, dbName);
    ok("Neon Auth can be enabled through the API", !!(enabled && enabled.enabled), JSON.stringify(enabled));
  } catch (e) {
    ok("Neon Auth can be enabled through the API", false, String((e && (e.detail || e.message)) || e));
  }

  if (enabled) {
    // Idempotence is load-bearing: `enableNeonAuth` runs on EVERY build, so a
    // second call on an already-enabled project must be a no-op and not a
    // failure, or every retried build of an existing site breaks on it.
    try {
      const again = await enableNeonAuth(env, project.projectId, project.branchId, dbName);
      ok("enabling it twice is a no-op, not a failure", !!(again && again.enabled), JSON.stringify(again));
    } catch (e) {
      ok("enabling it twice is a no-op, not a failure", false, String((e && (e.detail || e.message)) || e));
    }

    // Does the schema exist by the time the call returns? `enableNeonAuth` waits
    // on the project's operations, and if that is the wrong wait then a schema
    // apply racing it would not see `neon_auth` — which is exactly the race that
    // `waitForProject` exists for elsewhere.
    const schemas = await sqlQuery(authConn, "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'neon_auth'");
    ok("the neon_auth schema is there once the call returns", schemas.length === 1, JSON.stringify(schemas));

    // `users_sync` is NOT there when the enable call returns, even though the
    // schema is (measured 2026-07-30: schema yes, table no, 50ms later). So the
    // question is whether it is merely late or whether it does not exist until
    // Better Auth first syncs a user — which decides whether a build can
    // reference it at all. Poll rather than guess.
    const colsFor = () => sqlQuery(authConn,
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns" +
      " WHERE table_schema='neon_auth' AND table_name='users_sync' ORDER BY ordinal_position");
    let cols = await colsFor();
    const waitedFrom = Date.now();
    for (let i = 0; cols.length === 0 && i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      cols = await colsFor();
    }
    const waitedMs = Date.now() - waitedFrom;
    ok("users_sync exists (polled)", cols.length > 0,
      "still absent after " + Math.round(waitedMs / 1000) + "s — the table is created by Better Auth, not by enabling auth");
    if (cols.length) console.log("   users_sync appeared after " + Math.round(waitedMs / 1000) + "s:",
      cols.map((c) => c.column_name + ":" + c.data_type).join(", "));

    // Both of the next two are only ANSWERABLE if the table is there. Reporting
    // them as failures when it is absent would turn one finding into three and
    // hide which thing actually broke.
    if (!cols.length) {
      console.log("   skipped: id type + foreign key are unknowable while users_sync is absent");
    } else {
      // THE fact the migration rests on.
      const idCol = cols.find((c) => c.column_name === "id");
      ok("users_sync.id is TEXT, so owner_id must be text and not integer",
        !!idCol && /character|text/i.test(String(idCol.data_type)),
        JSON.stringify(idCol));

      // Can an application table actually reference it? If a foreign key to
      // users_sync is refused, row ownership has to be an unenforced text column
      // rather than a real reference, and that is worth knowing before the schema
      // engine is rewritten around it.
      try {
        await sqlExec(authConn, "CREATE TABLE fk_probe (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, owner_id TEXT REFERENCES neon_auth.users_sync(id))");
        ok("an app table can FOREIGN KEY to neon_auth.users_sync(id)", true);
        await sqlExec(authConn, "DROP TABLE fk_probe");
      } catch (e) {
        ok("an app table can FOREIGN KEY to neon_auth.users_sync(id)", false, String((e && (e.detail || e.message)) || e).slice(0, 200));
      }
    }

    // What the site's own role may do. The direction rests on the database being
    // the sandbox for model-written SQL, so the boundary has to be stated exactly
    // rather than assumed — and it is not "no extensions". Neon lets a project
    // role install from a CURATED allow-list, which is a platform property we
    // cannot switch off. So: assert the things that would be arbitrary code
    // execution or host access, and merely REPORT what the allow-list opens up.
    const mustRefuse = [
      ["read a file", "SELECT pg_read_file('/etc/passwd')"],
      ["shell out via COPY", "COPY (SELECT 1) TO PROGRAM 'id'"],
      // Untrusted procedural languages are arbitrary code in the backend
      // process — the one that would make "the database is the sandbox" false.
      ["run untrusted python", "CREATE EXTENSION IF NOT EXISTS plpython3u"],
      ["run untrusted perl", "CREATE EXTENSION IF NOT EXISTS plperlu"],
      // A filesystem read that routes around pg_read_file's ACL.
      ["read files through file_fdw", "CREATE EXTENSION IF NOT EXISTS file_fdw"],
    ];
    for (const [what, sql] of mustRefuse) {
      let refused = false, why = "";
      try { await sqlQuery(authConn, sql); } catch (e) { refused = true; why = String((e && (e.detail || e.message)) || e).slice(0, 120); }
      ok("the site's role CANNOT " + what, refused, "it was ALLOWED — model-written SQL would not be sandboxed");
      if (refused) console.log("      refused:", why);
    }

    // Reported, not asserted. These install, and each is outbound network from
    // inside the database. Nothing we generate uses them; the point of printing
    // it is that the sandbox has a documented hole in exactly this shape, so a
    // future decision to run less-trusted SQL knows what it is inheriting.
    const allowed = [];
    for (const ext of ["dblink", "postgres_fdw", "http", "pg_cron"]) {
      try { await sqlQuery(authConn, "CREATE EXTENSION IF NOT EXISTS " + ext); allowed.push(ext); } catch { /* refused */ }
    }
    console.log("   NOTE allow-listed extensions this role CAN install:", allowed.length ? allowed.join(", ") : "none");
  }

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

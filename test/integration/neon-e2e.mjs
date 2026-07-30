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

    // ENUMERATE the schema rather than looking for one name. `users_sync` is the
    // name from Neon Auth's Stack Auth era; managed Better Auth may create its
    // own tables (`user`, `session`, `account`, …) instead — and a probe that
    // asks for a single hardcoded name cannot tell "auth was not provisioned"
    // from "provisioned under a different name". Measured 2026-07-30: the
    // neon_auth SCHEMA appears at once and `users_sync` was still absent after
    // 90s of polling, so the name was the thing in doubt, not the wait.
    const tablesIn = () => sqlQuery(authConn,
      "SELECT table_name FROM information_schema.tables WHERE table_schema='neon_auth' ORDER BY table_name");
    let authTables = await tablesIn();
    const waitedFrom = Date.now();
    for (let i = 0; authTables.length === 0 && i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      authTables = await tablesIn();
    }
    const waitedMs = Math.round((Date.now() - waitedFrom) / 1000);
    const names = authTables.map((t) => t.table_name);
    console.log("   neon_auth tables after " + waitedMs + "s:", names.length ? names.join(", ") : "(none)");
    ok("enabling auth creates tables in neon_auth", names.length > 0,
      "the schema exists but is EMPTY after " + waitedMs + "s — identity tables are created by Better Auth at first use, " +
      "so a build cannot reference them");

    // Every column of every one of them, because the next decision (what
    // `owner_id` becomes) is made from these types and nothing else.
    const allCols = names.length ? await sqlQuery(authConn,
      "SELECT table_name, column_name, data_type FROM information_schema.columns" +
      " WHERE table_schema='neon_auth' ORDER BY table_name, ordinal_position") : [];
    for (const t of names) {
      console.log("     " + t + ": " + allCols.filter((c) => c.table_name === t)
        .map((c) => c.column_name + ":" + c.data_type).join(", "));
    }

    // Whichever of them holds people. Named by what it IS rather than by one
    // guessed name, so this keeps answering if Neon renames the table again.
    const userTable = names.find((n) => /^users_sync$/.test(n)) || names.find((n) => /^users?$/.test(n)) ||
      names.find((n) => /user/.test(n));
    const cols = userTable ? allCols.filter((c) => c.table_name === userTable) : [];
    if (userTable) console.log("   treating neon_auth." + userTable + " as the identity table");

    // Both of the next two are only ANSWERABLE if the table is there. Reporting
    // them as failures when it is absent would turn one finding into three and
    // hide which thing actually broke.
    if (!cols.length) {
      console.log("   skipped: id type + foreign key are unknowable with no identity table");
    } else {
      // THE fact the migration rests on, and it is NOT what CLAUDE.md said.
      // Measured 2026-07-30: managed Better Auth types this column `uuid`, not
      // `text` — `text` was the Stack Auth era's `users_sync.id`. So `owner_id`
      // becomes UUID. Asserted as uuid rather than "not integer" so a silent
      // change back to text fails here instead of in the schema engine.
      const idCol = cols.find((c) => c.column_name === "id");
      const idType = String((idCol && idCol.data_type) || "");
      ok(userTable + ".id is UUID, so owner_id must be uuid — not integer, and not text",
        /^uuid$/i.test(idType), JSON.stringify(idCol));

      // Can an application table actually reference it? The referencing column
      // takes its type FROM the measured one rather than a hardcoded guess: a
      // mismatch answers "incompatible types" and would read exactly like the
      // platform refusing the reference, which is what happened on the run
      // before this one.
      const ref = 'neon_auth."' + userTable + '"(id)';
      try {
        await sqlExec(authConn, "CREATE TABLE fk_probe (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, owner_id " +
          (/^[a-z ]{1,30}$/i.test(idType) ? idType : "text") + " REFERENCES " + ref + ")");
        ok("an app table can FOREIGN KEY to " + ref, true);
        await sqlExec(authConn, "DROP TABLE fk_probe");
      } catch (e) {
        ok("an app table can FOREIGN KEY to " + ref, false, String((e && (e.detail || e.message)) || e).slice(0, 200));
      }

      // The table is called "user", which Postgres RESERVES — but only in
      // unqualified position. After a schema qualifier the parser takes reserved
      // words as names, so `neon_auth.user` is fine and `FROM user` is a syntax
      // error. Worth pinning both ways round: the first assertion below is the
      // one I got wrong writing this (I claimed the qualified form failed), and
      // the second is why the schema engine and the model must always keep the
      // schema on the front of it.
      if (userTable === "user") {
        let qualifiedWorks = true;
        try { await sqlQuery(authConn, "SELECT 1 FROM neon_auth.user LIMIT 1"); } catch { qualifiedWorks = false; }
        ok("neon_auth.user parses unquoted — a schema qualifier admits a reserved word", qualifiedWorks);

        // And bare `user` does NOT error either — measured, twice, after I twice
        // claimed it would. Postgres resolves it to the USER value function, so a
        // query that forgets the schema qualifier quietly returns the current role
        // instead of the identity table. That is WORSE than a syntax error and is
        // the real reason identity must always be schema-qualified: the failure is
        // a wrong answer, not a loud one. Asserted on what comes back rather than
        // on my model of the grammar, which is what got this wrong both times.
        let bareRow = null;
        try { const r = await sqlQuery(authConn, "SELECT * FROM user LIMIT 1"); bareRow = (r && r[0]) || null; }
        catch (e) { bareRow = { __errored: String((e && e.message) || e).slice(0, 80) }; }
        console.log("      bare `FROM user` yielded:", JSON.stringify(bareRow));
        const looksLikeIdentity = !!(bareRow && "email" in bareRow && "emailVerified" in bareRow);
        ok("bare unqualified `user` does NOT reach the identity table — identity is ALWAYS schema-qualified",
          !looksLikeIdentity, JSON.stringify(bareRow));
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

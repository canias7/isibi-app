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

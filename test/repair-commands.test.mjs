// THE TWO REPAIR COMMANDS, RUN AS PROCESSES, WITH THEIR EXIT CODES READ.
//
// Owner, 2026-09-15: *"Both verification commands can exit successfully on
// failure. backend-repair --verify printed '0 verified, 1 not verified' and
// exited 0. repairbench-count-fix --verify observed bookings=3, direct=0,
// route=0, then fell through to preview and exited 0 because the function still
// needed rewriting. Make verification an explicit mode that always checks its
// postconditions and exits nonzero when they fail. Test both commands as
// processes, including exit codes."*
//
// AN EXIT CODE IS NOT OBSERVABLE FROM INSIDE THE MODULE. `main()` is not
// exported, `process.exitCode` is set on the way out, and a guard that imports
// a helper and calls it is asserting about a different thing entirely — which
// is exactly how a verification that printed its own failure came to exit 0.
//
// So every case here SPAWNS the real script. `test/fixtures/repair-process.mjs`
// is a `--import` preload that installs ONE `fetch` before the script's module
// graph loads, which covers both halves — Supabase is plain `fetch`, and Neon
// is `@neondatabase/serverless`, which is `fetch` over HTTP. Nothing is mocked,
// re-implemented or monkey-patched inside the scripts: the real argument
// parsing, the real `main()`, the real exit.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbNameForSite } from "../site-db.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRELOAD = path.join(ROOT, "test/fixtures/repair-process.mjs");
const DIR = mkdtempSync(path.join(tmpdir(), "repaircmd-"));
process.on("exit", () => { try { rmSync(DIR, { recursive: true, force: true }); } catch { /* best effort */ } });

let n = 0;
/**
 * One real run. The scenario is written to disk and MUTATED BY THE SCRIPT's own
 * writes, so `apply` then `verify` then `apply` reads one evolving database
 * rather than three independent fixtures — which is the only way "repeat
 * succeeds" means anything.
 */
function run(script, args, scenarioFile) {
  const sent = path.join(DIR, `sent-${++n}.json`);
  const env = {
    ...process.env,
    REPAIR_SCENARIO: scenarioFile, REPAIR_SENT: sent,
    SUPABASE_SERVICE_KEY: "service-key", SUPABASE_URL: "https://sb.test", OWNER_BASE_URL: "https://site.test",
  };
  let code = 0, out = "";
  try {
    out = execFileSync("node", ["--import", PRELOAD, path.join(ROOT, "scripts", script), ...args],
      { encoding: "utf8", cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    code = e.status === undefined ? -1 : e.status;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  let statements = [];
  try { statements = JSON.parse(readFileSync(sent, "utf8")); } catch { /* the run may not have reached Neon */ }
  return { code, out, statements };
}

/** A scenario file whose contents the spawned process rewrites as it works. */
function scenario(obj) {
  const f = path.join(DIR, `scen-${++n}.json`);
  writeFileSync(f, JSON.stringify(obj, null, 1));
  return f;
}

const PROJ = "postgres://u:p@ep-x.neon.tech/neondb?sslmode=require";
/** A `collect` table as the catalog reports one. Shapes come from the real emitters elsewhere; here only reachability matters. */
const BOOKINGS = {
  columns: ["id", "created_at", "who"],
  grants: [{ g: "anonymous", p: "INSERT", lvl: "column", col: "who" }, { g: "authenticated", p: "INSERT", lvl: "column", col: "who" }],
  policies: [{ c: "INSERT", q: "", w: "true" }],
};

// ── backend-repair ──────────────────────────────────────────────────────────

test("backend-repair --verify exits NONZERO when a postcondition fails", () => {
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    meta: JSON.stringify({ tables: [] }),
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--verify", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 1, "a failing verification exited " + r.code + ":\n" + r.out);
  assert.match(r.out, /not verified/);
  assert.match(r.out, /FAIL .*reference recorded/);
  assert.match(r.out, /FAIL .*every live table declared/, "the run-47 postcondition is not being asked");
  // AND IT REALLY CONNECTED. A mode that reports on a run it never made is the
  // defect; the statements the process sent are the proof it made one.
  assert.ok(r.statements.some((s) => /current_database/i.test(s.q || "")), "--verify never reached the database");
});

test("backend-repair --verify reaches the SITE's database, not the project's", () => {
  // The first defect this round: identity was asked about `/neondb` while the
  // queries went to `/site_<slug>`. Read off the statements the process really
  // sent, which is the only place the two could still disagree.
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: dbNameForSite("repairbench-1") }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    meta: JSON.stringify({ tables: [{ name: "bookings", read: "none", write: "anyone", columns: [{ name: "who", type: "text" }] }] }),
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--verify", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 0, "a passing verification exited " + r.code + ":\n" + r.out);
  assert.match(r.out, /VERIFIED/);
  const dbs = [...new Set(r.statements.map((s) => s.db).filter(Boolean))];
  assert.deepEqual(dbs, [dbNameForSite("repairbench-1")], "statements went to: " + JSON.stringify(dbs));
});

test("backend-repair --verify fails when the named site has no reachable database", () => {
  // "nothing to do" is not a pass in verify mode: the site was supposed to have
  // a database by now.
  const f = scenario({ sites: [{ slug: "frontend-only", uid: "u1", neon_db: "" }], projects: [] });
  const r = run("backend-repair.mjs", ["--verify", "--slug", "frontend-only"], f);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /VERIFY FAILED/);
});

test("apply -> verify -> repeat, on a database with no `_meta` at all", () => {
  // THE FOURTH DEFECT, END TO END AND AS PROCESSES. The site's reference is
  // blank, its database holds `bookings`, and it has no `_meta` — so the
  // recovery has to create the metadata table before it can write the
  // declaration it just rebuilt. Then the verify must pass, and a second apply
  // must find nothing to do.
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    metaTable: false, meta: null,
    tables: { bookings: BOOKINGS },
  });

  const first = run("backend-repair.mjs", ["--apply", "--slug", "repairbench-1"], f);
  assert.equal(first.code, 0, "the apply exited " + first.code + ":\n" + first.out);
  assert.match(first.out, /reference: written/);
  assert.match(first.out, /schema: recovered .*bookings/);
  assert.ok(first.statements.some((s) => /CREATE TABLE IF NOT EXISTS _meta/i.test(s.q || "")), "`_meta` was never created");
  assert.ok(first.statements.some((s) => /INSERT INTO _meta/i.test(s.q || "")), "the declaration was never written");

  const verify = run("backend-repair.mjs", ["--verify", "--slug", "repairbench-1"], f);
  assert.equal(verify.code, 0, "the verify after a good apply exited " + verify.code + ":\n" + verify.out);
  assert.match(verify.out, /1 verified, 0 not verified/);

  const again = run("backend-repair.mjs", ["--apply", "--slug", "repairbench-1"], f);
  assert.equal(again.code, 0, "the repeat exited " + again.code + ":\n" + again.out);
  assert.match(again.out, /reference: (skip|already-set)/, "the repeat wrote the reference again");
  assert.match(again.out, /schema: nothing missing/, "the repeat rewrote the declaration");

  // AND NOT ONE APPLICATION TABLE WAS TOUCHED, across all three runs.
  for (const r of [first, verify, again]) {
    for (const s of r.statements) {
      const q = String(s.q || "");
      if (!q) continue;
      assert.ok(!/\b(DROP|ALTER|TRUNCATE|DELETE FROM)\b/i.test(q), "a repair run issued: " + q);
      assert.ok(!/CREATE TABLE(?! IF NOT EXISTS _meta)/i.test(q), "a repair run created an application table: " + q);
      assert.ok(!/INSERT INTO (?!_meta)/i.test(q), "a repair run wrote an application row: " + q);
    }
  }
});

test("backend-repair --preview writes nothing and still exits 0", () => {
  // A preview is a REPORT. It exits 0 whatever it found, which is what keeps
  // the nonzero exits above meaningful.
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    metaTable: false, meta: null,
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--preview", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /preview — nothing written/);
  assert.ok(!r.statements.some((s) => /INSERT INTO _meta|CREATE TABLE/i.test(s.q || "")), "the preview wrote something");
  assert.ok(!r.statements.some((s) => s.supabase), "the preview wrote to Supabase");
});

test("backend-repair --apply exits NONZERO when identity refuses", () => {
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    serverDb: "site_someone_else",
    meta: JSON.stringify({ tables: [] }),
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--apply", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /NOT PROVEN/);
  assert.ok(!r.statements.some((s) => s.supabase), "a refused identity still wrote the reference");
});

// ── repairbench-count-fix ───────────────────────────────────────────────────

const COUNT_SCENARIO = (fnTable, counts) => ({
  sites: [{ slug: "repairbench-1", uid: "u1", neon_db: dbNameForSite("repairbench-1") }],
  projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
  meta: JSON.stringify({ tables: [] }),
  tables: { bookings: BOOKINGS },
  fnDef: "CREATE OR REPLACE FUNCTION public.count_booked_repairs()\n RETURNS bigint\n LANGUAGE sql\n SECURITY DEFINER\nAS $function$ SELECT count(*) FROM " + fnTable + " $function$\n",
  counts,
});

test("count-fix --verify exits NONZERO while the function still counts the wrong table", () => {
  // THE EXACT OBSERVATION: bookings=3, direct=0, route=0 — and it exited 0,
  // because `--verify` was a branch inside the "nothing to rewrite" arm and
  // fell through to the preview.
  const f = scenario(COUNT_SCENARIO("repairs", { bookings: 3, repairs: 0 }));
  const r = run("repairbench-count-fix.mjs", ["--verify"], f);
  assert.equal(r.code, 1, "a failing verification exited " + r.code + ":\n" + r.out);
  assert.match(r.out, /VERIFY FAILED/);
  assert.match(r.out, /the three counts disagree/);
  assert.match(r.out, /still counts "repairs"/);
  assert.ok(!/preview — nothing written/.test(r.out), "verify fell through to the preview again");
  // AND IT WROTE NOTHING.
  assert.ok(!r.statements.some((s) => /CREATE OR REPLACE FUNCTION/i.test(s.q || "")), "--verify rewrote the function");
});

test("count-fix apply -> verify: the three numbers agree and the verify passes", () => {
  const f = scenario(COUNT_SCENARIO("repairs", { bookings: 3, repairs: 0 }));
  const apply = run("repairbench-count-fix.mjs", ["--apply"], f);
  assert.equal(apply.code, 0, "the apply exited " + apply.code + ":\n" + apply.out);
  assert.match(apply.out, /PASS — all three agree/);
  // THE REWRITE KEPT EVERY OTHER ATTRIBUTE, because it is Postgres's own
  // `pg_get_functiondef` output with one identifier changed.
  const ddl = (apply.statements.find((s) => /CREATE OR REPLACE FUNCTION/i.test(s.q || "")) || {}).q || "";
  assert.match(ddl, /count_booked_repairs/, "the function was renamed");
  assert.match(ddl, /SECURITY DEFINER/, "the rewrite dropped SECURITY DEFINER");
  assert.match(ddl, /FROM bookings/);

  const verify = run("repairbench-count-fix.mjs", ["--verify"], f);
  assert.equal(verify.code, 0, "the verify after a good apply exited " + verify.code + ":\n" + verify.out);
  assert.match(verify.out, /VERIFY PASSED/);

  // AND A SECOND APPLY REFUSES rather than clobbering a function already fixed.
  const again = run("repairbench-count-fix.mjs", ["--apply"], f);
  assert.equal(again.code, 1, again.out);
  assert.match(again.out, /REFUSED: already-names-bookings/);
});

test("count-fix --verify fails when the site's own route disagrees with the database", () => {
  // The route is the call `/status` really makes, and it is the reader the
  // other two cannot stand in for. A 200 from the page is deliberately not one
  // of the three numbers.
  const f = scenario(COUNT_SCENARIO("bookings", { bookings: 3 }));
  const ok = run("repairbench-count-fix.mjs", ["--verify"], f);
  assert.equal(ok.code, 0, ok.out);
  assert.ok(ok.statements.some((s) => s.route === "count_booked_repairs"), "the verify never called the site's own route");

  const broken = scenario(COUNT_SCENARIO("bookings", { bookings: 3, ...{} }));
  // The function reads `bookings` but the table is empty: direct and route both
  // answer 0 while the row count says 3 — a real disagreement, and a failure.
  const r = run("repairbench-count-fix.mjs", ["--verify"], scenario({ ...JSON.parse(readFileSync(broken, "utf8")), counts: { bookings: 3 }, fnDef: "CREATE OR REPLACE FUNCTION public.count_booked_repairs()\n RETURNS bigint\nAS $function$ SELECT count(*) FROM archive $function$\n" }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /VERIFY FAILED/);
});

test("the count correction never leaves repairbench-1, and never touches an application table", () => {
  const f = scenario(COUNT_SCENARIO("repairs", { bookings: 3, repairs: 0 }));
  const r = run("repairbench-count-fix.mjs", ["--apply"], f);
  assert.equal(r.code, 0, r.out);
  for (const s of r.statements) {
    if (s.slug !== undefined) assert.equal(s.slug, "repairbench-1", "a call left the one site: " + JSON.stringify(s));
    if (s.db) assert.equal(s.db, dbNameForSite("repairbench-1"), "a statement went to " + s.db);
    const q = String(s.q || "");
    if (!q) continue;
    assert.ok(!/\b(DROP|ALTER|TRUNCATE|DELETE FROM)\b/i.test(q), "the correction issued: " + q);
    assert.ok(!/INSERT INTO |CREATE TABLE/i.test(q), "the correction wrote a row or a table: " + q);
  }
});

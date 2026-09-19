// A LIVE PROBE: does a declared `plpgsql` function really reach the database
// as plpgsql, and does the same body really fail as `sql`?
//
// THE DISCRIMINATOR IS THE WHOLE POINT. `test/addon-route.test.mjs` asserts the
// emitted statement says `LANGUAGE plpgsql`, which is a claim about a STRING.
// This is a claim about Postgres: a body with `DECLARE`, an assignment and a
// `RETURN` is a syntax error under `LANGUAGE sql` and is ordinary under
// `plpgsql`, so a run that creates it as SQL fails to CREATE and the site ships
// without the feature it was asked for. That is the failure the whole round is
// about, and only a real server can say it happened.
//
// WHAT THIS PROBE SETTLES AND WHAT IT DOES NOT:
//
//   - IT SETTLES the language reaching Postgres and the function ANSWERING.
//     The DDL comes out of the real `applySiteSchema` through the `fetch` seam
//     — nothing is typed — and the functions are then CALLED and their answers
//     compared against rows this probe inserted itself.
//   - IT SETTLES the negative: the identical body declared `sql` is refused by
//     Postgres, which is what makes the positive mean anything. Without it
//     "plpgsql worked" is consistent with the language being ignored entirely.
//   - IT DOES NOT SETTLE anything about a real model writing such a body, nor
//     about a live customer database. No live database is touched: it creates
//     its own throwaway one and drops it at the end.
//
// NEEDS A LOCAL POSTGRES and nothing else — no Neon, no Supabase, no network.
//   pg_ctlcluster 16 main start
//   node test/integration/local-pg-language.mjs
import { execFileSync } from "node:child_process";
import { applySiteSchema } from "../../site-schema.mjs";

function findPsql() {
  for (const c of ["psql", "/usr/lib/postgresql/16/bin/psql", "/usr/bin/psql"]) {
    try { execFileSync("sh", ["-c", `command -v ${c} >/dev/null 2>&1 || test -x ${c}`]); return c; } catch { /* next */ }
  }
  return "";
}
const PSQL = findPsql();
if (!PSQL) {
  console.error("no psql on this machine. This probe needs a local PostgreSQL:");
  console.error("  apt-get install -y postgresql && pg_ctlcluster 16 main start");
  process.exit(1);
}

const DB = "isibi_lang_" + process.pid;
const run = (db, sql, opts = {}) => execFileSync("sudo", ["-u", "postgres", PSQL, "-v", "ON_ERROR_STOP=1", "-tAq", "-d", db, "-c", sql],
  { encoding: "utf8", ...opts }).trim();

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; console.log("  ok   " + what); } else { fail++; console.log("  FAIL " + what); } };

// THE DDL IS CAPTURED FROM THE REAL ENGINE, never written here — a hand-typed
// CREATE would be a second emitter and this probe would be testing itself. The
// seam is `local-pg-searchpath.mjs`'s, deliberately: a second capture helper
// beside it would be two ideas of what the engine sends.
async function ddlFor(spec) {
  const statements = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let body = {};
    try { body = JSON.parse(String((init && init.body) || "{}")); } catch { /* not ours */ }
    const q = String(body.query || "");
    if (q) statements.push(q);
    // REFUSE NEON'S EXTENSION so the engine takes its own FALLBACK identity
    // function — the one a local Postgres can honour.
    if (/pg_session_jwt/.test(q)) {
      return new Response(JSON.stringify({ message: "extension pg_session_jwt is not available" }), { status: 400 });
    }
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  try { await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  return statements;
}

/** Statements a LOCAL Postgres cannot run, for reasons unrelated to language. */
const EXPECTED_SKIPS = [/pg_session_jwt/, /\bneon_auth\b/, /\b_meta\b/];

// A BODY THAT GENUINELY NEEDS plpgsql: a variable, an assignment and a RETURN.
// Not decoration — `SELECT count(*)` alone would run under either language and
// the probe would discriminate nothing.
const BODY = "DECLARE n int; BEGIN SELECT count(*) INTO n FROM bookings; RETURN n * 10; END";
const TABLE = { name: "bookings", columns: [{ name: "who", type: "text" }], access: "collect" };
const FN = (language) => ({ name: "counted", args: [], returns: "int", body: BODY, internal: false, ...(language ? { language } : {}) });

try {
  run("postgres", `DROP DATABASE IF EXISTS ${DB}`);
  run("postgres", `CREATE DATABASE ${DB}`);

  const plStmts = await ddlFor({ tables: [TABLE], functions: [FN("plpgsql")] });
  const sqlStmts = await ddlFor({ tables: [TABLE], functions: [FN("sql")] });
  const noneStmts = await ddlFor({ tables: [TABLE], functions: [FN(null)] });
  const createOf = (list, n) => list.find((s) => s.includes(`CREATE OR REPLACE FUNCTION "${n}"`));

  // ── ARM 1: the emitter ────────────────────────────────────────────────────
  ok(/LANGUAGE plpgsql/.test(createOf(plStmts, "counted")), "a declared plpgsql reaches the DDL");
  ok(/LANGUAGE sql/.test(createOf(sqlStmts, "counted")), "a declared sql reaches the DDL");
  ok(/LANGUAGE sql/.test(createOf(noneStmts, "counted")), "an undeclared language is still sql");

  // ── ARM 2: Postgres refuses the body as sql ───────────────────────────────
  // Every non-function statement first, so the two arms differ only in the function.
  // ⚠ SPLIT AT THE CREATE, NEVER "EVERYTHING BUT THE CREATE". The engine emits
  // a REVOKE and two GRANTs immediately AFTER the function, and they name it —
  // so holding the CREATE back and replaying the rest makes those three fail
  // on a function that does not exist yet, which reads as a product failure
  // and is the probe's own ordering. Everything BEFORE the create runs now;
  // the create and its grants run in arm 3, after the refusal has been proved.
  const at = plStmts.findIndex((s) => s.includes("CREATE OR REPLACE FUNCTION \"counted\""));
  const unexpected = [];
  const replay = (list) => {
    for (const s of list) {
      if (EXPECTED_SKIPS.some((re) => re.test(s))) continue;
      try { run(DB, s); } catch (e) { unexpected.push(s.slice(0, 80) + " :: " + String((e && e.stderr) || e).split("\n").filter(Boolean).pop()); }
    }
  };
  replay(plStmts.slice(0, at));
  run(DB, "INSERT INTO bookings (who) VALUES ('a'), ('b'), ('c')");
  let sqlRefused = false, sqlErr = "";
  try { run(DB, createOf(sqlStmts, "counted"), { stdio: ["pipe", "pipe", "pipe"] }); }
  catch (e) { sqlRefused = true; sqlErr = String((e && e.stderr) || e).slice(0, 160); }
  ok(sqlRefused, "the same body declared `sql` is REFUSED by Postgres" + (sqlRefused ? " — " + sqlErr.split("\n")[0] : ""));

  // ── ARM 3: it is created as plpgsql and ANSWERS ───────────────────────────
  replay(plStmts.slice(at));
  // NAMED RATHER THAN SWALLOWED, so a replay failure of this probe's own can
  // never be mistaken for the product's.
  ok(!unexpected.length, "every statement the engine sent replayed, bar the known Neon-only ones" +
    (unexpected.length ? "\n       " + unexpected.join("\n       ") : ""));
  const answer = run(DB, "SELECT counted()");
  ok(answer === "30", "the plpgsql function answers over rows this probe inserted (got " + answer + ", wanted 30)");

  // ── ARM 4: Postgres agrees about the language it stored ───────────────────
  const lang = run(DB, "SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.proname = 'counted'");
  ok(lang === "plpgsql", "pg_proc says the live function is plpgsql (got " + lang + ")");

  // ── ARM 5: the language took nothing else with it ─────────────────────────
  const meta = run(DB, "SELECT p.prosecdef::text || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') FROM pg_proc p WHERE p.proname = 'counted'");
  ok(meta.startsWith("true"), "SECURITY DEFINER survived the language change (got " + meta + ")");
  ok(/search_path=public,\s*pg_temp|search_path=public, pg_temp/.test(meta), "the search_path pin survived the language change (got " + meta + ")");

  // ── ARM 6: an ordinary sql function is untouched ──────────────────────────
  const plain = await ddlFor({ tables: [TABLE], functions: [{ name: "plain_count", args: [], returns: "int", body: "SELECT count(*)::int FROM bookings", internal: false }] });
  run(DB, createOf(plain, "plain_count"));
  ok(run(DB, "SELECT plain_count()") === "3", "an ordinary SQL function still works");
  ok(run(DB, "SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.proname = 'plain_count'") === "sql",
    "an ordinary SQL function is still stored as sql");
} finally {
  try { run("postgres", `DROP DATABASE IF EXISTS ${DB}`); } catch { /* best effort */ }
}

console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);

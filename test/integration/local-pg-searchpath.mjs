// A LIVE PROBE: can a conflicting object redirect a generated function?
//
// Every function the model declares is created SECURITY DEFINER — it is the
// point of the feature, because a `collect` table has no read policy and only a
// function running as the owner can hand a row back. Until 2026-09-16 none of
// them pinned `search_path`, while the engine's own two helpers have pinned it
// since they were written, on the argument spelled out above them in
// `site-rls.mjs`: *a SECURITY DEFINER function that resolves names through the
// caller's `search_path` is the classic escalation*.
//
// THE ARGUMENT FOR LEAVING THE MODEL'S FUNCTIONS UNPINNED WAS A PERMISSION
// CLAIM, and `neon-e2e` wrote it down: the escalation "needs BOTH halves … a
// caller can put a schema of their own ahead of `public`, and they can create
// an object in it", and it measures four `CREATE` privileges to say nobody can.
// **That premise is incomplete and this probe is what says so.** `TEMP` on the
// database is granted to PUBLIC by Postgres's own default, an unlisted
// `pg_temp` is searched FIRST for relations, and a temp relation is a
// conflicting object. So the attack needs NO `CREATE` anywhere and never
// touches the caller's own `search_path`.
//
// WHAT THIS PROBE CAN AND CANNOT SETTLE, stated up front because the two get
// run together and they are different claims:
//
//   - IT SETTLES THE MECHANISM. Given a caller who can create a temp relation,
//     an unpinned definer function reads the caller's table instead of the
//     owner's, and the pin stops it. Both directions, on real DDL.
//   - IT DOES NOT SETTLE REACHABILITY on a live site. Whether `anonymous` can
//     get a `CREATE TEMP TABLE` executed through Neon's Data API is a property
//     of PostgREST and of Neon, neither of which is here. That question is
//     answered in the review, and the missing live measurement is named there.
//
// NOTHING IS TYPED HERE. The DDL comes out of the real `applySiteSchema`
// through the `fetch` seam, for both trees; the PRE-FIX side is the real
// emitter loaded out of git, so the negative control is the code that shipped
// rather than a hand-written imitation of it.
//
// NEEDS A LOCAL POSTGRES and nothing else — no Neon, no Supabase, no network.
//   pg_ctlcluster 16 main start
//   node test/integration/local-pg-searchpath.mjs
// It creates its own throwaway databases and drops them at the end.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applySiteSchema } from "../../site-schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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
const AS_POSTGRES = (() => { try { return process.getuid() === 0; } catch { return false; } })();
const shq = (s) => "'" + String(s).replace(/'/g, `'\\''`) + "'";

function psql(db, args, input) {
  const cmd = `${PSQL} -X ${args}`.replace("__DB__", db);
  const stdio = [input === undefined ? "ignore" : "pipe", "pipe", "pipe"];
  const opts = { encoding: "utf8", stdio, ...(input === undefined ? {} : { input }) };
  return AS_POSTGRES ? execFileSync("su", ["postgres", "-c", cmd], opts) : execFileSync("sh", ["-c", cmd], opts);
}

/**
 * One statement, optionally as another role. `tag` drops -q so psql prints the
 * command tag, which is the only way to tell a write that happened from one a
 * policy silently filtered to nothing — the recorded reading from the grants
 * probe, kept because the same trap is live here.
 */
function sql(db, text, { role = null, pathTo = null, tag = false } = {}) {
  const pre = [];
  if (role) pre.push(`SET ROLE ${role};`);
  if (pathTo) pre.push(`SET search_path = ${pathTo};`);
  const body = pre.join("\n") + (pre.length ? "\n" : "") + text;
  try {
    const out = psql(db, `${tag ? "" : "-q "}-v ON_ERROR_STOP=1 -d __DB__ -At -c ${shq(body)}`);
    const lines = out.trim().split("\n").filter((l) => l.trim());
    return { ok: true, out: out.trim(), tag: lines[lines.length - 1] || "" };
  } catch (e) {
    return { ok: false, err: String((e.stderr || "") + (e.stdout || "")).trim() };
  }
}
/** A one-value read, or "" when the statement was refused. */
const one = (db, text, opts) => { const r = sql(db, text, opts); return r.ok ? r.out : ""; };

let pass = 0, fail = 0;
const failures = [];
function ok(what, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; failures.push(what); console.log("  FAIL " + what + (detail ? "\n         " + detail : "")); }
}

// ── the PRE-FIX emitter, out of git ──────────────────────────────────────────
//
// `site-schema.mjs` and `site-rls.mjs` both moved, so BOTH are restored and the
// old schema module is pointed at the old rls module — otherwise the "before"
// tree would import the fixed emitter and the control would be the fix wearing
// the control's name. Every other relative import is rewritten to the REAL
// module at the repository root, because nothing else in this change moved and
// a second copy of `site-db.mjs` would be a second thing to keep in step.
async function loadOldEngine(ref) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sp-old-"));
  const show = (f) => execFileSync("git", ["show", `${ref}:${f}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const rewrite = (src, keepLocal) => src.replace(/from "\.\/([a-z0-9-]+\.mjs)"/g, (m, f) =>
    keepLocal.includes(f) ? m : `from ${JSON.stringify(path.join(ROOT, f))}`);
  writeFileSync(path.join(dir, "site-rls.mjs"), rewrite(show("site-rls.mjs"), []));
  writeFileSync(path.join(dir, "site-schema.mjs"), rewrite(show("site-schema.mjs"), ["site-rls.mjs"]));
  return import(path.join(dir, "site-schema.mjs"));
}

/**
 * Run an engine and collect every statement it SENT.
 *
 * `meta` is an optional box the seam writes the engine's own `_meta.schema`
 * payload into and serves reads back from. It exists for arm 10: what a site's
 * NEXT schema change sends is decided by what `_meta` really persisted, and
 * that is NOT the spec the first build was handed. The `_meta` write is
 * PARAMETERISED, so a seam reading only `query` never sees it — which is how
 * the first version of arm 9 came to replay the original full-body definitions
 * and call that an upgrade.
 */
async function capture(applyFn, spec, meta) {
  const statements = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let body = {};
    try { body = JSON.parse(String((init && init.body) || "{}")); } catch { /* not ours */ }
    const q = String(body.query || "");
    const params = Array.isArray(body.params) ? body.params : [];
    if (q) statements.push(q);
    if (meta) {
      if (/_meta/i.test(q) && /INSERT|UPDATE/i.test(q)) {
        for (const v of params) { try { const o = JSON.parse(v); if (o && o.tables) meta.value = o; } catch { /* another column */ } }
      }
      if (/FROM _meta/i.test(q)) {
        return new Response(JSON.stringify({ command: "SELECT", rowCount: meta.value ? 1 : 0,
          rows: meta.value ? [{ v: JSON.stringify(meta.value) }] : [], fields: [] }),
          { status: 200, headers: { "content-type": "application/json" } });
      }
    }
    // REFUSE NEON'S EXTENSION so the engine takes its own FALLBACK identity
    // function — the one that reads `request.jwt.claims`, which is what a local
    // Postgres can honour, and which this change also pins.
    if (/pg_session_jwt/.test(q)) {
      return new Response(JSON.stringify({ message: "extension pg_session_jwt is not available" }), { status: 400 });
    }
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  try { await applyFn("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  return statements;
}

/**
 * Statements a LOCAL Postgres cannot run for reasons that have nothing to do
 * with name resolution. Named rather than swallowed, so the replay's own
 * failures can never be mistaken for the product's.
 */
const EXPECTED_REPLAY_FAILURES = [
  { re: /pg_session_jwt/, why: "Neon's own extension, absent locally — the engine falls back by design" },
  { re: /\bneon_auth\b/, why: "Neon Auth's schema, created by Neon and not by us" },
  { re: /\b_meta\b/, why: "the platform creates _meta elsewhere; not part of the resolution surface" },
];

function replay(db, statements, label) {
  const unexpected = [];
  let refused = 0;
  for (const s of statements) {
    const r = sql(db, s);
    if (r.ok) continue;
    refused++;
    if (EXPECTED_REPLAY_FAILURES.find((k) => k.re.test(s))) continue;
    unexpected.push({ sql: s.replace(/\s+/g, " ").slice(0, 110), err: (r.err.split("\n").find((l) => /ERROR/.test(l)) || r.err.split("\n")[0] || "").slice(0, 110) });
  }
  console.log(`  ${label}: ${statements.length} statements, ${refused} refused (${unexpected.length} unexpected)`);
  for (const u of unexpected) console.log(`      UNEXPECTED: ${u.sql}\n                  ${u.err}`);
  return unexpected;
}

// ── the spec, shaped like a real site ────────────────────────────────────────
//
// `bookings` is `collect` — anyone submits, NOBODY reads — which is the shape
// that makes a definer function the only door and is the commonest table this
// platform builds. Every function body is written the way a model writes one:
// unqualified, because the tool never asks it to qualify and no rule tells it
// to.
const SPEC = {
  tables: [
    { name: "bookings", access: "collect", columns: ["who", "bike", "drop_off_day"] },
    { name: "notes", access: "display", columns: ["title"] },
  ],
  functions: [
    // The subject: a public definer function reading a table the caller cannot.
    { name: "count_bookings", returns: "bigint", language: "sql", body: "SELECT count(*) FROM bookings" },
    // The same thing in the other language the tool offers.
    { name: "count_plpgsql", returns: "bigint", language: "plpgsql",
      body: "DECLARE n bigint; BEGIN SELECT count(*) INTO n FROM bookings; RETURN n; END;" },
    // THE INVOKER HOP. A SECURITY INVOKER function called from inside a definer
    // one runs with the DEFINER's rights, so an unpinned callee is the same hole
    // one step along. A model may declare both; nothing stops it.
    { name: "inner_count", returns: "bigint", language: "sql", definer: false, body: "SELECT count(*) FROM bookings" },
    { name: "outer_count", returns: "bigint", language: "sql", body: "SELECT inner_count()" },
    // COMPATIBILITY, not attack: the references a real body actually makes.
    { name: "list_notes", returns: "setof notes", language: "sql", body: "SELECT * FROM notes" },
    { name: "who_am_i", returns: "uuid", language: "sql", body: "SELECT app_user_id()" },
    { name: "catalog_call", returns: "text", language: "sql", body: "SELECT upper(md5('x'))" },
  ],
};

const DB_NEW = "sp_new", DB_OLD = "sp_old";
const ROLE = "anonymous"; // the real Data API role name, not a stand-in

function makeDb(db) {
  sql("postgres", `DROP DATABASE IF EXISTS ${db}`);
  sql("postgres", `CREATE DATABASE ${db}`);
}

console.log("\nsearch_path on generated functions — a real PostgreSQL 16\n");
console.log("  server: " + one("postgres", "SELECT version()").split(" on ")[0]);

// The two Data API roles, cluster-wide, created once and granted NOTHING here:
// every privilege they end up with comes from the engine's own statements.
sql("postgres", `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anonymous') THEN CREATE ROLE anonymous LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated LOGIN; END IF;
END $$;`);

makeDb(DB_NEW);
makeDb(DB_OLD);

// AN IMMUTABLE SHA, AND NEITHER `HEAD` NOR A BRANCH NAME. Both moving forms
// have been tried and both stop being a control the moment the pin lands:
// `HEAD` inverted every BEFORE case on the first run after the commit (the
// probe then reports the FIX as broken), and `origin/main` does exactly the
// same thing one merge later — so the command written in CLAUDE.md would stop
// working the day this ships, which is the day somebody reruns it.
// `0fff5317` is `71c2c4b8^` (the commit before the pin), is an ancestor of
// `origin/main`, and was measured pre-fix: its `site-rls.mjs` has no
// `FN_SEARCH_PATH` at all and its `site-schema.mjs` no `search_path` anywhere,
// so both the model functions and the trigger functions are unpinned there.
// A CONTROL THAT HAS STOPPED BEING A CONTROL IS WORSE THAN NO CONTROL, so the
// refusal below is KEPT rather than retired by the sha: an immutable ref makes
// the default reproducible and says nothing about an `OLD_REF=` somebody
// passes, which is the whole reason the override exists.
const OLD_REF = process.env.OLD_REF || "0fff5317";
const oldEngine = await loadOldEngine(OLD_REF);

const stmtsNew = await capture(applySiteSchema, structuredClone(SPEC));
const stmtsOld = await capture(oldEngine.applySiteSchema, structuredClone(SPEC));

// THE CONTROL IS PROVED TO BE ONE, BEFORE ANY ARM READS IT. Every "BEFORE"
// case below asserts a redirect; if `OLD_REF` already carries the pin they all
// fail and the probe reads as the FIX being broken rather than as the ref being
// wrong. Refuse loudly instead.
const oldModelDdl = stmtsOld.find((s) => /CREATE OR REPLACE FUNCTION "count_bookings"/.test(s)) || "";
if (!oldModelDdl || /search_path/.test(oldModelDdl)) {
  console.error(`\nOLD_REF (${OLD_REF}) is not a pre-fix tree — its model functions already pin, so`);
  console.error("there is no control here and every BEFORE case would be meaningless.");
  console.error("Pass OLD_REF=<a ref before the pin>. Saw: " + (oldModelDdl.slice(0, 120) || "<no such function>"));
  process.exit(2);
}

console.log("\n─ replaying both trees ─");
const badNew = replay(DB_NEW, stmtsNew, "after  (working tree)");
const badOld = replay(DB_OLD, stmtsOld, `before (${OLD_REF})`);
ok("the fixed engine's DDL replays with no unexpected refusal", badNew.length === 0, JSON.stringify(badNew));
ok("the pre-fix engine's DDL replays with no unexpected refusal", badOld.length === 0, JSON.stringify(badOld));

// ── 1. THE REACHABILITY FACTS, measured rather than recalled ─────────────────
console.log("\n─ 1. what a role with no grants already holds ─");
const privs = one(DB_NEW,
  "SELECT has_database_privilege('anonymous', current_database(), 'CREATE')::text || ' ' ||" +
  " has_database_privilege('anonymous', current_database(), 'TEMP')::text || ' ' ||" +
  " has_schema_privilege('anonymous', 'public', 'CREATE')::text || ' ' ||" +
  " has_schema_privilege('anonymous', 'public', 'USAGE')::text");
const [dbCreate, dbTemp, pubCreate, pubUsage] = privs.split(" ");
ok("anonymous cannot create a schema — the premise neon-e2e measures", dbCreate === "false", privs);
ok("anonymous cannot create an object in public — the other half of it", pubCreate === "false", privs);
ok("BUT anonymous CAN create TEMPORARY objects — PUBLIC holds TEMP by Postgres's default", dbTemp === "true", privs);
ok("and it has USAGE on public, so it can see the functions", pubUsage === "true", privs);

// ── 2. THE DOOR IS THE FUNCTION, not the table ───────────────────────────────
console.log("\n─ 2. the caller cannot read the table at all ─");
sql(DB_NEW, "INSERT INTO bookings (who, bike, drop_off_day) VALUES ('a','x','mon'),('b','y','tue'),('c','z','wed')");
sql(DB_OLD, "INSERT INTO bookings (who, bike, drop_off_day) VALUES ('a','x','mon'),('b','y','tue'),('c','z','wed')");
const direct = sql(DB_NEW, "SELECT count(*) FROM bookings", { role: ROLE });
ok("a direct SELECT is refused — `collect` means nobody reads", !direct.ok && /permission denied/.test(direct.err),
  direct.ok ? "it answered " + direct.out : direct.err.split("\n")[0]);
ok("the definer function is the one way to that count, and it answers 3",
  one(DB_NEW, "SELECT count_bookings()", { role: ROLE }) === "3");

// ── 3. THE REDIRECT, both directions ─────────────────────────────────────────
//
// One session, so the temp table survives across the calls in it. Everything
// after the CREATE TEMP runs with the caller's DEFAULT search_path — the
// attacker never sets one, which is the part that makes `CREATE` irrelevant.
console.log("\n─ 3. a temp relation against both trees ─");
const ATTACK = [
  "CREATE TEMP TABLE bookings (id int, who text, bike text, drop_off_day text);",
  "INSERT INTO bookings (id, who) VALUES (99, 'attacker');",
  "SELECT current_setting('search_path') || ' | sql=' || count_bookings()::text" +
  " || ' plpgsql=' || count_plpgsql()::text || ' via-invoker=' || outer_count()::text;",
].join("\n");
const before = one(DB_OLD, ATTACK, { role: ROLE });
const after = one(DB_NEW, ATTACK, { role: ROLE });
console.log("      before: " + before);
console.log("      after : " + after);
ok("BEFORE — the caller's own search_path is untouched", /^"\$user", public \|/.test(before), before);
ok("BEFORE — an unpinned sql definer function reads the ATTACKER's table", / sql=1 /.test(before), before);
ok("BEFORE — so does the plpgsql one", /plpgsql=1 /.test(before), before);
ok("BEFORE — and so does a definer function whose callee is INVOKER", /via-invoker=1$/.test(before), before);
ok("AFTER — the pinned sql definer function reads the owner's table", / sql=3 /.test(after), after);
ok("AFTER — so does the plpgsql one", /plpgsql=3 /.test(after), after);
ok("AFTER — and the invoker hop is closed too", /via-invoker=3$/.test(after), after);

// ── 4. A SCHEMA AHEAD OF `public`, the shape the old premise was about ───────
//
// This one needs CREATE, which no live role has — it is here because the owner
// asked whether a conflicting object can redirect resolution, and a schema is
// the other kind of conflicting object. Granted explicitly, so the measurement
// is about RESOLUTION and never about whether the grant exists.
console.log("\n─ 4. a schema ahead of public, with CREATE granted on purpose ─");
for (const db of [DB_OLD, DB_NEW]) {
  sql(db, "CREATE SCHEMA evil AUTHORIZATION anonymous");
  sql(db, "GRANT USAGE ON SCHEMA evil TO anonymous");
}
const SCHEMA_ATTACK = [
  "CREATE TABLE evil.bookings (id int, who text, bike text, drop_off_day text);",
  "INSERT INTO evil.bookings (id, who) VALUES (7, 'attacker');",
  "SELECT 'sql=' || count_bookings()::text || ' plpgsql=' || count_plpgsql()::text;",
].join("\n");
const sBefore = one(DB_OLD, SCHEMA_ATTACK, { role: ROLE, pathTo: "evil, public" });
const sAfter = one(DB_NEW, SCHEMA_ATTACK, { role: ROLE, pathTo: "evil, public" });
console.log("      before: " + sBefore + "      after: " + sAfter);
ok("BEFORE — a schema on the caller's path redirects both bodies", sBefore === "sql=1 plpgsql=1", sBefore);
ok("AFTER — the pin ignores the caller's path entirely", sAfter === "sql=3 plpgsql=3", sAfter);

// A FUNCTION cannot be shadowed by pg_temp — Postgres's own rule, measured so
// the review can say it rather than cite it — but it CAN be shadowed by a
// schema, which is what makes `app_user_id()`'s own pin load-bearing.
const FN_ATTACK = [
  "CREATE FUNCTION evil.app_user_id() RETURNS uuid LANGUAGE sql AS $f$ SELECT '11111111-1111-1111-1111-111111111111'::uuid $f$;",
  "SELECT coalesce(who_am_i()::text, 'null');",
].join("\n");
const fBefore = one(DB_OLD, FN_ATTACK, { role: ROLE, pathTo: "evil, public" });
const fAfter = one(DB_NEW, FN_ATTACK, { role: ROLE, pathTo: "evil, public" });
ok("BEFORE — an unpinned body's unqualified FUNCTION call is redirected too", fBefore.startsWith("11111111"), fBefore);
ok("AFTER — it is not", fAfter === "null", fAfter);

const tempFn = one(DB_NEW, [
  "CREATE FUNCTION pg_temp.app_user_id() RETURNS uuid LANGUAGE sql AS $f$ SELECT '22222222-2222-2222-2222-222222222222'::uuid $f$;",
  "SELECT coalesce(who_am_i()::text, 'null');",
].join("\n"), { role: ROLE });
ok("pg_temp can never shadow a FUNCTION — relations only, which is why the pin's order is the fix",
  tempFn === "null", tempFn);

// ── 5. COMPATIBILITY: every intended reference still resolves ────────────────
console.log("\n─ 5. the references a real body makes ─");
sql(DB_NEW, "INSERT INTO notes (title) VALUES ('one'),('two')");
sql(DB_OLD, "INSERT INTO notes (title) VALUES ('one'),('two')");
for (const [what, q] of [
  ["an unqualified table read", "SELECT count_bookings()"],
  ["a plpgsql body", "SELECT count_plpgsql()"],
  ["a `setof <table>` return", "SELECT count(*) FROM list_notes()"],
  ["a call to the engine's own app_user_id()", "SELECT coalesce(who_am_i()::text,'null')"],
  ["a pg_catalog function the body never qualifies", "SELECT catalog_call()"],
  ["one model function calling another", "SELECT outer_count()"],
]) {
  const a = one(DB_OLD, q, { role: ROLE }), b = one(DB_NEW, q, { role: ROLE });
  ok(`${what} answers the same before and after (${JSON.stringify(a)})`, a === b && a !== "", `before=${a} after=${b}`);
}

// ── 6. PERMISSIONS ARE UNTOUCHED ─────────────────────────────────────────────
//
// The whole surface, not a spot check: every function's ACL and every role's
// effective EXECUTE, plus the table grants and policies the change never went
// near. A pin that quietly widened or narrowed one of these would be a worse
// bug than the one it fixes.
console.log("\n─ 6. the permission surface, before vs after ─");
const ACL = `SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') acl=' ||
  coalesce(array_to_string(p.proacl::text[], ','), '<default>') ||
  ' anon=' || has_function_privilege('anonymous', p.oid, 'EXECUTE')::text ||
  ' auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text ||
  ' definer=' || p.prosecdef::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' ORDER BY 1`;
const aclOld = one(DB_OLD, ACL), aclNew = one(DB_NEW, ACL);
ok("every function's ACL, EXECUTE and SECURITY DEFINER flag are byte-identical",
  aclOld === aclNew && aclOld.length > 0, "before:\n" + aclOld + "\nafter:\n" + aclNew);
ok("the observer is alive — it found the functions", (aclNew.match(/\n/g) || []).length >= 6, aclNew);

const TABLE_ACL = `SELECT grantee || ' ' || table_name || ' ' || privilege_type || ' ' || coalesce(column_name,'*')
  FROM (
    SELECT grantee, table_name, privilege_type, NULL::text AS column_name FROM information_schema.role_table_grants WHERE table_schema='public'
    UNION ALL
    SELECT grantee, table_name, privilege_type, column_name FROM information_schema.column_privileges WHERE table_schema='public'
  ) x WHERE grantee IN ('anonymous','authenticated') ORDER BY 1`;
ok("the table and column grants are byte-identical", one(DB_OLD, TABLE_ACL) === one(DB_NEW, TABLE_ACL));
const POL = "SELECT tablename||' '||policyname||' '||cmd||' '||coalesce(qual,'-')||' '||coalesce(with_check,'-') FROM pg_policies WHERE schemaname='public' ORDER BY 1";
ok("every policy is byte-identical", one(DB_OLD, POL) === one(DB_NEW, POL));

// ── 7. THE PIN IS REALLY ON THE FUNCTIONS, and only where it belongs ─────────
console.log("\n─ 7. what the catalog says the pin is ─");
const CFG = `SELECT p.proname || '=' || coalesce(array_to_string(p.proconfig, ','), '<none>')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1`;
const cfgNew = one(DB_NEW, CFG).split("\n").filter(Boolean);
const cfgOld = one(DB_OLD, CFG).split("\n").filter(Boolean);
ok("BEFORE — the model's functions pinned nothing",
  cfgOld.some((l) => /^count_bookings=<none>$/.test(l)), cfgOld.join(" | "));
ok("AFTER — every model function pins public, pg_temp",
  ["count_bookings", "count_plpgsql", "inner_count", "outer_count", "list_notes", "who_am_i", "catalog_call"]
    .every((n) => cfgNew.includes(n + "=search_path=public, pg_temp")), cfgNew.join(" | "));
ok("AFTER — the fallback app_user_id() pins pg_catalog, pg_temp, like the native form it mirrors",
  cfgNew.includes("app_user_id=search_path=pg_catalog, pg_temp"), cfgNew.join(" | "));
// EVERY PINNED PATH ENDS WITH pg_temp, with no exception to read a body for.
// MEASURED in this same probe: `pg_catalog, public` with an unqualified body is
// redirected exactly as an unpinned function is, so naming `public` is not the
// fix and naming `pg_temp` is — and a per-function exception would be an
// argument about that function's body, which expires when the body changes.
const pins = cfgNew.filter((l) => /=search_path=/.test(l));
ok("AFTER — every pinned path ends with pg_temp, uniformly",
  pins.length >= 7 && pins.every((l) => /,\s*pg_temp$/.test(l)), pins.join(" | "));
// ASSERTED ON THE STATEMENT THE ENGINE SENT, not on the catalog, and the
// distinction is the probe being honest about its own reach: `app_team_id()`
// reads `neon_auth.member`, which is Neon Auth's table and does not exist on a
// local Postgres, so its CREATE is one of the four expected replay failures and
// the function is not in `pg_proc` here at all. Reading the catalog for it would
// be asserting that a statement that never ran left no trace.
// RE-ANCHORED ONTO THE PROPERTY, NOT THE SPELLING. This case read "byte-identical
// before and after — it was already pinned", which was true until the helpers'
// pins were made uniform (`pg_catalog` → `pg_catalog, pg_temp`). Byte-equality
// was never the property; what matters is that it was pinned BEFORE and is
// pinned with pg_temp LAST now — a change that TIGHTENS a pin must not read as
// one that introduced it.
const teamStmt = (s) => s.find((x) => /CREATE OR REPLACE FUNCTION app_team_id/.test(x)) || "";
ok("app_team_id() was already pinned before this change", /SET search_path = pg_catalog/.test(teamStmt(stmtsOld)),
  teamStmt(stmtsOld).slice(0, 160));
ok("and its pin now ends with pg_temp, like every other", /SET search_path = pg_catalog, pg_temp AS/.test(teamStmt(stmtsNew)),
  teamStmt(stmtsNew).slice(0, 160));
const userStmt = (s) => s.find((x) => /CREATE OR REPLACE FUNCTION app_user_id/.test(x)) || "";
ok("and the fallback app_user_id()'s DDL is the one that MOVED",
  userStmt(stmtsOld) !== userStmt(stmtsNew) && !/search_path/.test(userStmt(stmtsOld)),
  userStmt(stmtsOld).slice(0, 160));

// ── 8. THE TRIGGER HALF — a guarantee, not a privilege ───────────────────────
//
// SEPARABLE, and said so: these bodies are the ENGINE's and they are SECURITY
// INVOKER, so nothing is escalated. What is redirected is `enforceRefs`' own
// wall — it asks `SELECT 1 FROM <parent>` and a temp relation answers.
console.log("\n─ 8. enforceRefs under a temp parent ─");
const REF_SPEC = {
  tables: [
    { name: "owners", access: "display", columns: ["title"] },
    // A REF IS A COLUMN PROPERTY, not a table-level list — `refs` is built from
    // each column's own `ref` at site-schema.mjs:1073. Declared the wrong way the
    // engine emits no ref trigger at all and the arm passes by measuring nothing,
    // which is how the first run of this probe read.
    { name: "pets", access: "collect", enforceRefs: true,
      columns: ["title", { name: "owners_id", type: "int", ref: "owners" }] },
  ],
};
const DB_R_NEW = "sp_ref_new", DB_R_OLD = "sp_ref_old";
makeDb(DB_R_NEW); makeDb(DB_R_OLD);
replay(DB_R_NEW, await capture(applySiteSchema, structuredClone(REF_SPEC)), "after  (refs)");
replay(DB_R_OLD, await capture(oldEngine.applySiteSchema, structuredClone(REF_SPEC)), "before (refs)");
const REF_ATTACK = [
  "CREATE TEMP TABLE owners (id bigint, title text);",
  "INSERT INTO owners (id, title) VALUES (4242, 'invented');",
  "INSERT INTO pets (title, owners_id) VALUES ('ghost', 4242);",
  "SELECT 'inserted';",
].join("\n");
const rBefore = sql(DB_R_OLD, REF_ATTACK, { role: ROLE });
const rAfter = sql(DB_R_NEW, REF_ATTACK, { role: ROLE });
ok("BEFORE — a temp parent satisfies the enforceRefs wall", rBefore.ok && rBefore.out.includes("inserted"),
  rBefore.ok ? rBefore.out : rBefore.err.split("\n")[0]);
ok("AFTER — it raises 'missing parent' as it should",
  !rAfter.ok && /missing parent/.test(rAfter.err), rAfter.ok ? "it inserted" : rAfter.err.split("\n")[0]);
// THE CONTROL: the wall must still let a REAL parent through, or "it refuses"
// would be true of a trigger that refuses everything.
sql(DB_R_NEW, "INSERT INTO owners (title) VALUES ('real')");
const realId = one(DB_R_NEW, "SELECT id FROM owners WHERE title='real'");
const good = sql(DB_R_NEW, `INSERT INTO pets (title, owners_id) VALUES ('rex', ${realId})`, { role: ROLE, tag: true });
ok("AFTER — and a real parent still inserts (the control)", good.ok && /INSERT 0 1/.test(good.tag),
  good.ok ? good.tag : good.err.split("\n")[0]);

// ── 9. WHAT A SITE'S NEXT SCHEMA CHANGE REALLY RE-EMITS ──────────────────────
//
// **THIS ARM REPLACED A WRONG ONE, and the correction is the finding.** The
// first version stood a site up on the pre-fix DDL and then replayed
// `stmtsNew` over it — the statements from the ORIGINAL spec, with every
// function's full body — and read the resulting pin as "its next schema change
// upgrades it". That is not what a next change sends. **A real one is built
// from what `_meta.schema` PERSISTED**, and `applySiteSchema` writes a function
// there as `{name, args, returns, internal}` with **NO BODY** — after which
// `normalizeSchema` drops it, because a body is what makes a function a
// function. So nothing re-declares it, and nothing re-pins it.
//
// The arm below is the lifecycle: first build → read back what was really
// stored → an UNRELATED addition, exactly as an addon composes one → apply.
console.log("\n─ 9. the real lifecycle: persisted metadata, then an unrelated addition ─");
const LIFE_SPEC = {
  // `audit` is what gives the table TRIGGER FUNCTIONS, so this arm can tell the
  // two families apart instead of reporting one number for both. `trash` was
  // the first choice and creates a COLUMN and no function — measured, and the
  // arm read as a failure of the product until the spec was corrected.
  tables: [{ name: "bookings", access: "collect", columns: ["who", "bike", "drop_off_day"], audit: true }],
  functions: [
    { name: "count_bookings", returns: "bigint", language: "sql", body: "SELECT count(*) FROM bookings" },
  ],
};
const DB_LIFE = "sp_lifecycle";
makeDb(DB_LIFE);
// The site as it stands today: built by the PRE-FIX engine, so its functions
// are unpinned and carry their grants.
const metaBox = { value: null };
const lifeFirst = await capture(oldEngine.applySiteSchema, structuredClone(LIFE_SPEC), metaBox);
replay(DB_LIFE, lifeFirst, "  the site as built (pre-fix)");
sql(DB_LIFE, "INSERT INTO bookings (who, bike, drop_off_day) VALUES ('a','x','mon'),('b','y','tue'),('c','z','wed')");
ok("the persisted function entry carries NO body — which is the whole mechanism",
  Array.isArray(metaBox.value && metaBox.value.functions)
    && metaBox.value.functions.length === 1
    && !("body" in metaBox.value.functions[0]),
  JSON.stringify(metaBox.value && metaBox.value.functions));
const aclLife = one(DB_LIFE, ACL);
const lifeBefore = one(DB_LIFE, "SELECT 'sql=' || count_bookings()::text", { role: ROLE });
ok("and the function answers the owner's rows before anything else happens", lifeBefore === "sql=3", lifeBefore);

// THE NEXT CHANGE, composed the way the addon route composes one: the stored
// spec plus the new thing. Nothing here invents a body it does not have.
const nextSpec = {
  ...JSON.parse(JSON.stringify(metaBox.value)),
  tables: [...metaBox.value.tables, { name: "notes", access: "display", columns: ["title"] }],
};
ok("the spec a next change is built from still names the function",
  (nextSpec.functions || []).some((f) => f && f.name === "count_bookings"), JSON.stringify(nextSpec.functions));
const lifeNext = await capture(applySiteSchema, nextSpec);
const badLife = replay(DB_LIFE, lifeNext, "  its next schema change (fixed engine)");
ok("the next change replays with no unexpected refusal", badLife.length === 0, JSON.stringify(badLife));

const CREATE_FN = /CREATE (?:OR REPLACE )?FUNCTION/i;
const created = lifeNext.filter((s) => CREATE_FN.test(s));
const namedIn = (s) => (s.match(/FUNCTION\s+"?([a-z0-9_]+)/i) || [])[1] || "";
/** `pg_temp` last, read out of the STATEMENT — the unit guard's rule, restated here. */
const safelyPinned = (s) => {
  const m = String(s).match(/SET\s+search_path\s*=\s*([^\n]*?)\s+AS\s/i) || String(s).match(/SET\s+search_path\s*=\s*([a-z_, ]+)\s*$/i);
  const parts = (m ? m[1] : "").split(",").map((x) => x.trim()).filter(Boolean);
  return parts.length > 0 && parts[parts.length - 1] === "pg_temp";
};
const reissued = created.map(namedIn);
console.log("      re-emitted: " + reissued.join(", "));
// WHAT IS PINNED, and it is real: the identity helpers are created at the head
// of EVERY apply, and every trigger function is rebuilt for every table in the
// merged spec.
ok("the identity helpers ARE re-issued, so they are pinned by any schema change",
  reissued.includes("app_user_id") && reissued.includes("app_team_id"), reissued.join(","));
ok("and so is the existing table's trigger function",
  reissued.some((n) => /^trg_bookings_/.test(n)), reissued.join(","));
for (const s of created) ok("  re-issued " + namedIn(s) + " is pinned", safelyPinned(s), s.slice(0, 120));
// WHAT IS NOT, and this is the corrected claim.
ok("NO statement re-declares the model's function",
  !lifeNext.some((s) => /count_bookings/i.test(s) && /(CREATE|ALTER)\s+(OR REPLACE\s+)?FUNCTION/i.test(s)),
  lifeNext.filter((s) => /count_bookings/i.test(s)).join(" | ").slice(0, 200));
ok("and no ALTER FUNCTION anywhere — there is no other way it could be reached",
  !lifeNext.some((s) => /ALTER\s+FUNCTION/i.test(s)));
ok("so the catalog still shows it UNPINNED after the change",
  one(DB_LIFE, CFG).split("\n").includes("count_bookings=<none>"), one(DB_LIFE, CFG));
// THE CONSEQUENCE, stated as the attack rather than as a catalog reading.
const lifeAttack = one(DB_LIFE, [
  "CREATE TEMP TABLE bookings (id int, who text, bike text, drop_off_day text);",
  "INSERT INTO bookings (id, who) VALUES (99, 'attacker');",
  "SELECT 'sql=' || count_bookings()::text;",
].join("\n"), { role: ROLE });
ok("AND IT IS STILL REDIRECTED — the pin does not reach an existing model function",
  lifeAttack === "sql=1", lifeAttack);
// The half that DID hold everywhere: nothing was damaged by the change.
ok("no grant moved across the whole lifecycle", aclLife === one(DB_LIFE, ACL),
  "before:\n" + aclLife + "\nafter:\n" + one(DB_LIFE, ACL));
ok("and the site's rows are where they were", one(DB_LIFE, "SELECT count(*) FROM bookings") === "3");

// ── 10. RE-DECLARING THE FUNCTION IS THE ONE PATH THAT PINS IT ───────────────
//
// Not a proposal — a measurement of what the engine already does, so the
// corrected scope says which sites are reachable today and which are not. An
// addon that declares a function WITH a body emits `CREATE OR REPLACE`, and
// that carries the pin. It reaches the function it re-declares and no other.
console.log("\n─ 10. the one path that does pin an existing function ─");
const redeclare = await capture(applySiteSchema, {
  ...JSON.parse(JSON.stringify(metaBox.value)),
  functions: [{ name: "count_bookings", returns: "bigint", language: "sql", body: "SELECT count(*) FROM bookings" }],
});
replay(DB_LIFE, redeclare, "  an addon that re-declares it");
ok("a re-declared function IS pinned", one(DB_LIFE, CFG).split("\n").includes("count_bookings=search_path=public, pg_temp"),
  one(DB_LIFE, CFG));
ok("and the redirect closes for it", one(DB_LIFE, [
  "CREATE TEMP TABLE bookings (id int, who text, bike text, drop_off_day text);",
  "INSERT INTO bookings (id, who) VALUES (99, 'attacker');",
  "SELECT 'sql=' || count_bookings()::text;",
].join("\n"), { role: ROLE }) === "sql=3");
ok("its grants survived the replace", aclLife === one(DB_LIFE, ACL),
  "before:\n" + aclLife + "\nafter:\n" + one(DB_LIFE, ACL));

// ── 11. THE PREREQUISITE THE PIN DOES NOT REMOVE ─────────────────────────────
//
// `SET search_path = public, pg_temp` TRUSTS `public`. It closes the `pg_temp`
// vector and it does nothing whatever about a `public` an untrusted role can
// write to — so "public is not writable by untrusted roles" is a REQUIREMENT
// this change keeps rather than a premise it retired. Asserted here on a local
// server; the LIVE reading belongs to `neon-e2e`, which is the only thing that
// can ask a real project, and this probe cannot stand in for it.
console.log("\n─ 11. public must stay unwritable — the pin assumes it ─");
const pub = one(DB_LIFE,
  "SELECT has_schema_privilege('anonymous','public','CREATE')::text || ' ' ||" +
  " has_schema_privilege('authenticated','public','CREATE')::text");
ok("neither Data API role may create in public (local server)", pub === "false false", pub);
// AND WHAT IS *NOT* ASSERTED HERE, deliberately. A first draft tried to
// DEMONSTRATE the consequence by granting CREATE on public and redirecting a
// pinned function; it could not, because within one schema there is nothing to
// shadow — the real table is already there, and a low-privilege role cannot
// drop an object it does not own. Whether a writable `public` is exploitable
// against a `public, pg_temp` pin (function overload resolution is the
// candidate) is **UNMEASURED, and is recorded as unmeasured rather than
// claimed either way**. What IS certain and is the whole point: the pin names
// `public`, so `public` is trusted, so the requirement that untrusted roles
// cannot write there is one this change KEEPS rather than one it retires.
console.log("      (whether a writable public is exploitable under this pin is UNMEASURED —");
console.log("       the requirement is retained, not the exploit demonstrated)");

// ── done ─────────────────────────────────────────────────────────────────────
for (const db of [DB_NEW, DB_OLD, DB_R_NEW, DB_R_OLD, DB_LIFE]) sql("postgres", `DROP DATABASE IF EXISTS ${db}`);
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail) { for (const f of failures) console.log("  FAILED: " + f); process.exit(1); }

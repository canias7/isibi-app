// A LIVE PROBE: the column-scoped write grants, driven against a REAL Postgres.
//
// Everything the unit guards prove is what the engine EMITS, and
// test/managed-column-writes.mjs says so out loud: "That Postgres then enforces
// the grant is Postgres's own documented behaviour and is not re-proved here."
// This is where it is re-proved. It runs the engine's own statements into a
// real PostgreSQL and measures what Postgres does with them.
//
// It answers the four questions a fix to a LIVE site has to answer:
//   1. normal submissions and edits still succeed
//   2. a write to a platform-managed column is refused
//   3. applying the fix over an EXISTING table takes the old broad privilege
//      off, and loses no data
//   4. applying it a second time is safe
//
// NOTHING IS TYPED HERE. The DDL comes out of the real `applySiteSchema`
// through the `fetch` seam. The OLD grants come from the real pre-fix
// `grantsFor`, extracted from git at run time, so the "existing table" half is
// the state a real pre-fix apply left and not a fixture of one. The NEW grants
// come from the shipping emitter.
//
// EVERY ANSWER IS READ FOR ITS REASON, never merely for its exit status, and
// both directions of that mattered while this was being written:
//
//   * A REFUSAL for the wrong reason reads exactly like the fix working. A
//     column that does not exist, a NOT NULL violation, or RLS rather than the
//     grant all come back as "it was refused" — so each case names the gate it
//     is about and a refusal from a different gate FAILS it.
//   * An ALLOWED that touched no row is not an allowed write. `UPDATE ... WHERE`
//     matching nothing SUCCEEDS, and RLS's USING clause filters rows out in
//     silence, so a member's attempt on somebody else's row comes back with no
//     error at all. Three cases read as successful writes until the command tag
//     was parsed. The recorded "a zero from a blind instrument is not evidence
//     of absence", in both directions at once.
//
// NEEDS A LOCAL POSTGRES and nothing else — no Neon, no Supabase, no network.
//   sudo pg_ctlcluster 16 main start
//   node test/integration/local-pg-grants.mjs
// It creates its own throwaway database, its own roles and its own stubs, and
// drops the database at the end.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applySiteSchema } from "../../site-schema.mjs";
import { grantsFor as grantsNew, writableColumns } from "../../site-rls.mjs";
import { MANAGED_COLUMNS } from "../../site-access.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DB = process.env.PROBE_DB || ("permprobe_" + process.pid);

/** Where psql is. A cluster that is not running is a named refusal, never a skip. */
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
/** Run psql as a superuser. `postgres` when we are root, otherwise whoever we are. */
const AS_POSTGRES = (() => { try { return process.getuid() === 0; } catch { return false; } })();
function psql(db, args, input) {
  const cmd = `${PSQL} -X ${args}`.replace("__DB__", db);
  // stdin MUST be a pipe when `input` is given. It was "ignore" here, so the
  // setup script was handed to a process that could not read it — psql exited
  // 0 having done nothing, and `neon_auth.member` never existed. Caught by the
  // probe's own UNEXPECTED line rather than by anything failing.
  const stdio = [input === undefined ? "ignore" : "pipe", "pipe", "pipe"];
  const opts = { encoding: "utf8", stdio, ...(input === undefined ? {} : { input }) };
  return AS_POSTGRES
    ? execFileSync("su", ["postgres", "-c", cmd], opts)
    : execFileSync("sh", ["-c", cmd], opts);
}

/**
 * THE PRE-FIX EMITTER, OUT OF GIT rather than copied into this file.
 *
 * A second copy of the old `grantsFor` here would be two lists of the same
 * thing with nothing between them, and the older one would be the one nobody
 * updates. `git show` keeps exactly one.
 */
const PRE_FIX = process.env.PRE_FIX_REF || "8e8ac5eb^"; // the commit that column-scoped the write grants
const TMP = mkdtempSync(path.join(tmpdir(), "permprobe-"));
function loadOldEmitter() {
  const src = execFileSync("git", ["-C", ROOT, "show", `${PRE_FIX}:site-rls.mjs`], { encoding: "utf8" });
  // THE OBSERVER IS ALIVE: the extracted file must really be the pre-fix one.
  // `writableColumns` is the function the fix added, so a copy that has it is
  // the CURRENT emitter and this whole half of the probe would be comparing the
  // fix with itself and passing.
  if (/export function writableColumns/.test(src)) {
    throw new Error(`${PRE_FIX}:site-rls.mjs already has writableColumns — that is the post-fix file, so PRE_FIX points at the wrong commit`);
  }
  const file = path.join(TMP, "site-rls-old.mjs");
  writeFileSync(file, src.replace('from "./site-access.mjs"', `from ${JSON.stringify(path.join(ROOT, "site-access.mjs"))}`));
  return import(file);
}
const { grantsFor: grantsOld } = await loadOldEmitter();

function sql(text, { role = null, claims = null, tag = false } = {}) {
  const pre = [claims !== null
    ? `SELECT set_config('request.jwt.claims', ${lit(claims)}, false);`
    : `SELECT set_config('request.jwt.claims', NULL, false);`];
  if (role) pre.push(`SET ROLE ${role};`);
  const body = pre.join("\n") + "\n" + text;
  // `tag` DROPS -q so psql prints the command tag ("UPDATE 0"), which is the
  // only way to tell a write that happened from one RLS silently filtered to
  // nothing. Without it every no-op reads as a successful write.
  const quiet = tag ? "" : "-q ";
  try {
    const out = psql(DB, `${quiet}-v ON_ERROR_STOP=1 -d __DB__ -At -c ${shq(body)}`);
    const lines = out.trim().split("\n").filter((l) => l.trim());
    return { ok: true, out: out.trim(), tag: lines[lines.length - 1] || "" };
  } catch (e) {
    return { ok: false, err: String((e.stderr || "") + (e.stdout || "")).trim() };
  }
}
const shq = (s) => "'" + String(s).replace(/'/g, `'\\''`) + "'";
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

/** Run the real engine and collect every statement it SENT. */
async function capture(spec) {
  const statements = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "";
    try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { /* not ours */ }
    if (q) statements.push(String(q));
    // REFUSE THE NEON EXTENSION so the engine takes its own FALLBACK identity
    // function — the one that reads `request.jwt.claims`, which is exactly what
    // PostgREST sets and what a local Postgres can honour.
    if (/pg_session_jwt/.test(q)) {
      return new Response(JSON.stringify({ message: "extension pg_session_jwt is not available" }), { status: 400 });
    }
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  let made = null;
  try { made = await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  return { statements, made };
}

/**
 * Statements a LOCAL Postgres cannot run for reasons that have nothing to do
 * with permissions. Named rather than swallowed, so the replay's own failures
 * can never be mistaken for the product's.
 */
const EXPECTED_REPLAY_FAILURES = [
  { why: "Neon's own extension, absent locally — the engine falls back by design", re: /pg_session_jwt/ },
  { why: "the platform creates _meta elsewhere; not part of the permission surface", re: /\b_meta\b/ },
];

function replay(statements, label) {
  const unexpected = [];
  let refused = 0;
  for (const s of statements) {
    const r = sql(s);
    if (r.ok) continue;
    refused++;
    const known = EXPECTED_REPLAY_FAILURES.find((k) => k.re.test(s));
    if (known) continue;
    unexpected.push({ sql: s.replace(/\s+/g, " ").slice(0, 120), err: r.err.split("\n").find((l) => /ERROR/.test(l)) || r.err.split("\n")[0] });
  }
  console.log(`  ${label}: ${statements.length} statements, ${refused} refused (${unexpected.length} unexpected)`);
  for (const u of unexpected) console.log(`      UNEXPECTED: ${u.sql}\n                  ${u.err}`);
  return unexpected;
}

/** Table-level privileges ONLY — the ones a column grant is meant to replace. */
function tablePrivs(table) {
  const t = sql(`SELECT grantee||' '||privilege_type FROM information_schema.role_table_grants
    WHERE table_name=${lit(table)} AND grantee IN ('anonymous','authenticated') ORDER BY 1;`);
  return t.ok && t.out ? t.out.split("\n") : [];
}
/** REAL column-level ACLs, out of pg_attribute — never role_column_grants, which EXPANDS a table grant across every column. */
function columnPrivs(table) {
  const c = sql(`SELECT a.attname||' -> '||array_to_string(a.attacl,',') FROM pg_attribute a
    JOIN pg_class c ON c.oid=a.attrelid WHERE c.relname=${lit(table)} AND a.attacl IS NOT NULL ORDER BY a.attnum;`);
  return c.ok && c.out ? c.out.split("\n") : [];
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const claimsFor = (uid) => JSON.stringify({ sub: uid, role: "authenticated" });

/**
 * One attempted write, classified by WHY Postgres answered as it did.
 *
 * `grant` — the column/table privilege refused it. That is this fix.
 * `rls`   — a row-level policy refused it. A different gate, and saying so is
 *           what stops the fix taking credit for a wall it did not build.
 * `other` — anything else (a missing column, a constraint). A case that lands
 *           here proves nothing and is reported as broken, not as a pass.
 */
function attempt(what, statement, { role, uid = null, expect, by }) {
  const r = sql(statement, { role, claims: uid ? claimsFor(uid) : null, tag: true });
  if (r.ok) {
    // A WRITE THAT TOUCHED NO ROW IS NOT AN ALLOWED WRITE. `UPDATE ... WHERE`
    // matching nothing SUCCEEDS, and RLS's USING clause filters rows out
    // silently — so a member's attempt to edit somebody else's row comes back
    // "UPDATE 0" with no error at all. Reading only the exit status reported
    // three of those as successful writes. The command tag is the measurement.
    const m = /^(INSERT|UPDATE|DELETE)\s+(?:\d+\s+)?(\d+)$/.exec(r.tag || "");
    if (m && Number(m[2]) === 0) return { what, ok: false, cause: "rls", why: `${m[1]} touched 0 rows — the policy filtered every row out`, expect, by };
    return { what, ok: true, cause: "allowed", why: "", expect, by };
  }
  const line = (r.err.split("\n").find((l) => /ERROR/.test(l)) || r.err.split("\n")[0]).replace(/^psql:[^:]*:\d+:\s*/, "").trim();
  const cause = /permission denied/i.test(line) ? "grant"
    : /row-level security/i.test(line) ? "rls"
    : "other";
  return { what, ok: false, cause, why: line, expect, by };
}

function report(rows) {
  const bad = [];
  for (const r of rows) {
    const outcome = r.ok ? "ALLOWED" : "REFUSED";
    const wrongOutcome = r.ok !== r.expect;
    // A refusal must come from the gate the case names. `by: "grant"` on a case
    // refused by RLS or by a missing column is a case that measured nothing.
    const wrongCause = !r.ok && r.by && r.cause !== r.by;
    const mark = wrongOutcome || wrongCause ? "FAIL" : " ok ";
    console.log(`  ${mark} ${outcome.padEnd(7)} [${r.cause}] ${r.what}${r.ok ? "" : "  — " + r.why}`);
    if (wrongOutcome) bad.push(`${r.what}: expected ${r.expect ? "ALLOWED" : "REFUSED"}, got ${outcome}`);
    else if (wrongCause) bad.push(`${r.what}: refused by ${r.cause}, not by the ${r.by} this case is about (${r.why})`);
  }
  return bad;
}

// ── the spec ────────────────────────────────────────────────────────────────
// Three shapes, chosen so every managed column the engine can create is really
// on a table something is allowed to write:
//   requests — `collect`, write:anyone   (the commonest table this builder makes)
//   saved    — `user`,    write:own      (a member's own rows)
//   posts    — `feed`,    write:members  (the WIDER member shape: the UPDATE
//              policy is "signed in" on both clauses, so it reaches ANY row)
// `ordered`, `pinnable` and `trash` are what put `position`, `pinned` and
// `deleted_at` on a real table — without them those names are not columns and
// a refusal naming them proves nothing.
const SPEC = {
  tables: [
    { name: "requests", access: "collect", columns: [
      { name: "name", type: "text" }, { name: "email", type: "text" }, { name: "detail", type: "text" },
    ], timestamps: true },
    { name: "saved", access: "user", columns: [
      { name: "title", type: "text" }, { name: "note", type: "text" },
    ], timestamps: true, trash: true },
    { name: "posts", access: "feed", columns: [
      { name: "body", type: "text" },
    ], timestamps: true, ordered: true, pinnable: true },
  ],
};

const problems = [];

// ── STEP 0: a throwaway database, the two Data API roles, and Neon's stubs ──
//
// `anonymous` and `authenticated` are the roles Neon's Data API runs a request
// as, and every grant this file is about names one of them. `neon_auth` is
// stubbed because `app_team_id()` is a SQL function that resolves its table at
// creation — without the schema the function fails to parse and every policy
// built on it fails with it.
console.log(`── STEP 0: a throwaway database (${DB}) ──`);
psql("postgres", `-q -d postgres -c ${shq(`DROP DATABASE IF EXISTS ${DB};`)} -c ${shq(`CREATE DATABASE ${DB};`)}`);
psql(DB, `-q -v ON_ERROR_STOP=1 -d __DB__ -f -`, `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anonymous') THEN CREATE ROLE anonymous NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anonymous, authenticated;
CREATE SCHEMA IF NOT EXISTS neon_auth;
CREATE TABLE IF NOT EXISTS neon_auth.member ("userId" uuid, "organizationId" uuid, "createdAt" timestamptz);
CREATE TABLE IF NOT EXISTS neon_auth."user" (id uuid primary key, email text);
`);
process.on("exit", () => {
  try { psql("postgres", `-q -d postgres -c ${shq(`DROP DATABASE IF EXISTS ${DB};`)}`); } catch { /* best effort */ }
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
});

console.log("\n── STEP 1: the real engine's DDL, replayed into a real Postgres ──");
const { statements, made } = await capture(SPEC);
problems.push(...replay(statements, "engine stream").map((u) => "engine statement refused locally: " + u.sql));

console.log("\n── STEP 2: the columns Postgres really created ──");
// DERIVED, never typed: a hand-written copy of the managed set is a second
// list of the same thing, and the one that drifts is the one in the test.
const MANAGED = [...MANAGED_COLUMNS];
const realCols = {};
for (const t of SPEC.tables) {
  const r = sql(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name=${lit(t.name)};`);
  realCols[t.name] = (r.out || "").split(",").filter(Boolean);
  const managedHere = realCols[t.name].filter((c) => MANAGED.includes(c));
  console.log(`  ${t.name}: ${r.out}`);
  console.log(`      managed columns really present: ${managedHere.join(", ")}`);
}

console.log("\n── STEP 3: put all three tables into the PRE-FIX privilege state ──");
// The old emitter revokes then grants, so running it over the new state leaves
// exactly what a pre-fix apply left behind.
for (const t of SPEC.tables) {
  for (const s of grantsOld(t)) { const r = sql(s); if (!r.ok) problems.push("old-emitter statement refused: " + s); }
  console.log(`  ${t.name} table-level: ${tablePrivs(t.name).join(" | ") || "(none)"}`);
  console.log(`  ${t.name} REAL column ACLs: ${columnPrivs(t.name).join(" | ") || "(none)"}`);
}

console.log("\n── STEP 4: seed rows through the owner, so the fix has data to preserve ──");
sql(`INSERT INTO "requests" ("name","email","detail") VALUES ('Existing One','a@example.com','before the fix');`);
sql(`INSERT INTO "saved" ("owner_id","title","note") VALUES ('${USER_A}','A row','before the fix');`);
sql(`INSERT INTO "saved" ("owner_id","title","note") VALUES ('${USER_B}','B row','before the fix');`);
sql(`INSERT INTO "posts" ("owner_id","body") VALUES ('${USER_B}','B post, before the fix');`);
sql(`INSERT INTO "posts" ("owner_id","body") VALUES ('${USER_A}','A post, before the fix');`);
const before = {};
for (const t of SPEC.tables) before[t.name] = sql(`SELECT count(*) FROM ${JSON.stringify(t.name)};`).out;
console.log("  rows before: " + JSON.stringify(before));

console.log("\n── STEP 5: MEASURED UNDER THE OLD GRANTS — what a client really could do ──");
console.log("  (every row here is the state an existing site is STILL in today)");
report([
  attempt(`anonymous inserts a legitimate request`,
    `INSERT INTO "requests" ("name","email","detail") VALUES ('Legit','l@example.com','old grants');`, { role: "anonymous", expect: true }),
  attempt(`anonymous chooses its own id`,
    `INSERT INTO "requests" ("id","name") VALUES (999001,'Chosen id');`, { role: "anonymous", expect: true }),
  attempt(`anonymous backdates created_at`,
    `INSERT INTO "requests" ("name","created_at") VALUES ('Backdated','2001-01-01');`, { role: "anonymous", expect: true }),
  attempt(`anonymous forges updated_at`,
    `INSERT INTO "requests" ("name","updated_at") VALUES ('Forged','2001-01-01');`, { role: "anonymous", expect: true }),
  attempt(`member edits created_at on its own row`,
    `UPDATE "saved" SET "created_at"='2001-01-01' WHERE "title"='A row';`, { role: "authenticated", uid: USER_A, expect: true }),
  // TWO MANAGED COLUMNS WERE ALREADY OUT OF REACH BEFORE THIS FIX, AND RLS IS
  // WHY — said here rather than letting the fix take credit for a wall it did
  // not build. `owner_id` fails `WITH CHECK (owner_id = app_user_id())`, and
  // `deleted_at` fails the same clause's live-row predicate, since a row with a
  // deletion stamp is no longer one the policy admits. The fix adds a SECOND
  // gate over both; it is the only gate over `id`, `created_at`, `updated_at`,
  // `pinned` and `position`.
  attempt(`member soft-deletes its own row by hand`,
    `UPDATE "saved" SET "deleted_at"=now() WHERE "title"='A row';`, { role: "authenticated", uid: USER_A, expect: false, by: "rls" }),
  attempt(`member hands its row to somebody else (owner_id)`,
    `UPDATE "saved" SET "owner_id"='${USER_B}' WHERE "title"='A row';`, { role: "authenticated", uid: USER_A, expect: false, by: "rls" }),
  // THE FEED TABLE IS WHERE `pinned` AND `position` LIVE, and those are the two
  // managed columns with a visible consequence: a row that sorts above everyone
  // else's. On the member's OWN row, because RLS already decides WHOSE row —
  // this fix decides WHICH COLUMNS, and the two questions must not be mixed up.
  attempt(`FEED: member pins its OWN post to the top`,
    `UPDATE "posts" SET "pinned"=1 WHERE "body" LIKE 'A post%';`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`FEED: member sets position on its OWN post`,
    `UPDATE "posts" SET "position"=-1 WHERE "body" LIKE 'A post%';`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`FEED: member rewrites ANOTHER member's post`,
    `UPDATE "posts" SET "body"='hijacked' WHERE "body" LIKE 'B post%';`, { role: "authenticated", uid: USER_A, expect: false, by: "rls" }),
].map((r) => r)).forEach((m) => problems.push("OLD-state reading changed: " + m));

console.log("\n── STEP 6: APPLY THE FIX (the shipping emitter's own statements) ──");
const colNames = {};
for (const t of SPEC.tables) {
  colNames[t.name] = realCols[t.name].filter((c) => !MANAGED.includes(c));
  const fresh = grantsNew(t, colNames[t.name]);
  console.log(`  ${t.name}: writableColumns = [${writableColumns(t, colNames[t.name]).join(", ")}]`);
  for (const s of fresh) {
    console.log(`      ${s}`);
    const rr = sql(s);
    if (!rr.ok) { console.log(`        REFUSED: ${rr.err.split("\n")[0]}`); problems.push("fix statement refused: " + s); }
  }
}

console.log("\n── STEP 7: the OLD BROAD PRIVILEGE IS GONE, read from the catalogue ──");
for (const t of SPEC.tables) {
  const tp = tablePrivs(t.name);
  console.log(`  ${t.name} table-level: ${tp.join(" | ") || "(none)"}`);
  console.log(`  ${t.name} REAL column ACLs: ${columnPrivs(t.name).join(" | ") || "(none)"}`);
  const wide = tp.filter((s) => /\b(INSERT|UPDATE)$/.test(s));
  if (wide.length) problems.push(`${t.name}: table-wide write privilege survived the fix: ${wide.join(", ")}`);
}

console.log("\n── STEP 8: NO DATA WAS LOST ──");
for (const t of SPEC.tables) {
  const n = sql(`SELECT count(*) FROM ${JSON.stringify(t.name)};`).out;
  console.log(`  ${t.name}: ${before[t.name]} before the fix, ${n} now`);
  if (Number(n) < Number(before[t.name])) problems.push(`${t.name}: rows were lost`);
}
const seeded = sql(`SELECT count(*) FROM "requests" WHERE "detail"='before the fix';`).out;
console.log(`  the pre-fix seeded row still reads back: ${seeded === "1" ? "yes" : "NO"}`);
if (seeded !== "1") problems.push("the pre-fix row is gone");

console.log("\n── STEP 9: MEASURED UNDER THE FIX ──");
problems.push(...report([
  attempt(`anonymous inserts a legitimate request`,
    `INSERT INTO "requests" ("name","email","detail") VALUES ('After','a2@example.com','after the fix');`, { role: "anonymous", expect: true }),
  attempt(`anonymous chooses its own id`,
    `INSERT INTO "requests" ("id","name") VALUES (999002,'Chosen id');`, { role: "anonymous", expect: false, by: "grant" }),
  attempt(`anonymous backdates created_at`,
    `INSERT INTO "requests" ("name","created_at") VALUES ('Backdated','2001-01-01');`, { role: "anonymous", expect: false, by: "grant" }),
  attempt(`anonymous forges updated_at`,
    `INSERT INTO "requests" ("name","updated_at") VALUES ('Forged','2001-01-01');`, { role: "anonymous", expect: false, by: "grant" }),
  attempt(`member inserts a legitimate saved row`,
    `INSERT INTO "saved" ("title","note") VALUES ('Mine 2','after the fix');`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`member EDITS its own row legitimately`,
    `UPDATE "saved" SET "note"='edited after the fix' WHERE "title"='A row';`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`member edits created_at`,
    `UPDATE "saved" SET "created_at"='2001-01-01' WHERE "title"='A row';`, { role: "authenticated", uid: USER_A, expect: false, by: "grant" }),
  attempt(`member soft-deletes its own row by hand`,
    `UPDATE "saved" SET "deleted_at"=now() WHERE "title"='A row';`, { role: "authenticated", uid: USER_A, expect: false, by: "grant" }),
  attempt(`member edits id`,
    `UPDATE "saved" SET "id"=999003 WHERE "title"='A row';`, { role: "authenticated", uid: USER_A, expect: false, by: "grant" }),
  attempt(`member inserts choosing owner_id`,
    `INSERT INTO "saved" ("owner_id","title") VALUES ('${USER_B}','Planted');`, { role: "authenticated", uid: USER_A, expect: false, by: "grant" }),
  attempt(`member reads its rows`,
    `SELECT count(*) FROM "saved";`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`member deletes its own row`,
    `DELETE FROM "saved" WHERE "title"='Mine 2';`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`FEED: member posts legitimately`,
    `INSERT INTO "posts" ("body") VALUES ('A post, after the fix');`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`FEED: member pins its OWN post to the top`,
    `UPDATE "posts" SET "pinned"=1 WHERE "body" LIKE 'A post%';`, { role: "authenticated", uid: USER_A, expect: false, by: "grant" }),
  attempt(`FEED: member sets position on its OWN post`,
    `UPDATE "posts" SET "position"=-1 WHERE "body" LIKE 'A post%';`, { role: "authenticated", uid: USER_A, expect: false, by: "grant" }),
  attempt(`FEED: member edits its OWN post's body legitimately`,
    `UPDATE "posts" SET "body"='A post, edited' WHERE "body" LIKE 'A post%';`, { role: "authenticated", uid: USER_A, expect: true }),
  attempt(`FEED: member rewrites ANOTHER member's post (RLS, not this fix)`,
    `UPDATE "posts" SET "body"='hijacked' WHERE "body" LIKE 'B post%';`, { role: "authenticated", uid: USER_A, expect: false, by: "rls" }),
]));

console.log("\n── STEP 10: REAPPLYING THE FIX IS SAFE ──");
const rowsBefore = {}; for (const t of SPEC.tables) rowsBefore[t.name] = sql(`SELECT count(*) FROM ${JSON.stringify(t.name)};`).out;
const privsBefore = JSON.stringify(SPEC.tables.map((t) => [tablePrivs(t.name), columnPrivs(t.name)]));
for (const t of SPEC.tables) for (const s of grantsNew(t, colNames[t.name])) {
  const rr = sql(s); if (!rr.ok) problems.push("re-apply refused: " + s);
}
const privsAfter = JSON.stringify(SPEC.tables.map((t) => [tablePrivs(t.name), columnPrivs(t.name)]));
const rowsAfter = {}; for (const t of SPEC.tables) rowsAfter[t.name] = sql(`SELECT count(*) FROM ${JSON.stringify(t.name)};`).out;
console.log(`  privileges byte-identical after a second apply: ${privsBefore === privsAfter ? "yes" : "NO"}`);
console.log(`  rows unchanged: ${JSON.stringify(rowsBefore) === JSON.stringify(rowsAfter) ? "yes" : "NO"} ${JSON.stringify(rowsAfter)}`);
if (privsBefore !== privsAfter) problems.push("a second apply changed the privileges");
if (JSON.stringify(rowsBefore) !== JSON.stringify(rowsAfter)) problems.push("a second apply changed the rows");
problems.push(...report([
  attempt(`anonymous still inserts a legitimate request`,
    `INSERT INTO "requests" ("name") VALUES ('After rerun');`, { role: "anonymous", expect: true }),
  attempt(`anonymous still cannot backdate created_at`,
    `INSERT INTO "requests" ("name","created_at") VALUES ('Backdated 2','2001-01-01');`, { role: "anonymous", expect: false, by: "grant" }),
]));

console.log("\n════════════════════════════════════════════");
if (problems.length) { console.log("PROBLEMS:"); for (const p of problems) console.log("  - " + p); process.exitCode = 1; }
else console.log("ALL CHECKS PASSED");
console.log("engine reported refusedRules:", JSON.stringify((made && made.refusedRules) || []));

// A LIVE PROBE: does recovering a lost declaration change the database?
//
// `reconcileSpec` rebuilds a declaration for a table the stored schema forgot,
// and the next schema change applies that declaration. So the question this
// whole module turns on is not "does the recovered entry look right" — it is
// "does APPLYING it leave the database as it was". That cannot be answered by
// comparing strings, because Postgres does not store a policy predicate as it
// was written: it re-quotes, re-parenthesises and adds casts. It can only be
// answered by a real Postgres, twice.
//
//   apply the true spec -> snapshot -> forget the declarations -> recover ->
//   apply the recovery -> snapshot -> DIFF
//
// A clean diff is the claim. And the NEGATIVE CONTROL is what makes it worth
// anything: the same run with the flags stripped — the shape that shipped
// before 2026-09-15 — must DIRTY the diff, and must dirty it on `deleted_at`.
// Without that arm a probe that compared nothing at all would also print two
// clean diffs.
//
// NOTHING IS TYPED HERE. The DDL comes out of the real `applySiteSchema`
// through the `fetch` seam; the catalog is read with the real
// `RECOVER_QUERIES`; the recovery is the real `reconcileSpec` handed the real
// `policiesFor`/`grantsFor`.
//
// NEEDS A LOCAL POSTGRES and nothing else — no Neon, no Supabase, no network.
//   pg_ctlcluster 16 main start
//   node test/integration/local-pg-recover.mjs
// It creates its own throwaway databases and drops them at the end.
import { execFileSync } from "node:child_process";
import { applySiteSchema } from "../../site-schema.mjs";
import { policiesFor, grantsFor } from "../../site-rls.mjs";
import { RECOVER_QUERIES, reconcileSpec, deriveAccess, MANAGED_COLUMNS } from "../../site-schema-recover.mjs";

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
function run(db, text) {
  try {
    const out = psql(db, `-q -v ON_ERROR_STOP=1 -d __DB__ -At -c ${shq(text)}`);
    return { ok: true, out: out.trim() };
  } catch (e) { return { ok: false, err: String((e.stderr || "") + (e.stdout || "")).trim() }; }
}

/**
 * The catalog read, through the REAL queries, in the row shape the module
 * expects. The UNIT SEPARATOR is psql's field separator here because a policy
 * predicate contains commas, quotes, parens and spaces — any friendlier
 * character would split a row down the middle and the probe would be comparing
 * rubbish with rubbish.
 */
const SEP = String.fromCharCode(31);
function catalog(db) {
  const read = (q, cols) => {
    let out;
    try { out = psql(db, `-q -v ON_ERROR_STOP=1 -d __DB__ -At -F ${shq(SEP)} -c ${shq(q.replace(/;\s*$/, ""))}`).trim(); }
    catch (e) { throw new Error("catalog read failed: " + String(e.stderr || e.stdout || e.message).split("\n")[0]); }
    return (out ? out.split("\n") : []).filter((l) => l.length).map((line) => {
      const parts = line.split(SEP), o = {};
      cols.forEach((c, i) => { o[c] = parts[i] === undefined ? "" : parts[i]; });
      return o;
    });
  };
  return {
    columns: read(RECOVER_QUERIES.columns, ["t", "c", "ty"]),
    grants: read(RECOVER_QUERIES.grants, ["t", "g", "p", "lvl", "col"]),
    policies: read(RECOVER_QUERIES.policies, ["t", "c", "q", "w"]),
    triggers: read(RECOVER_QUERIES.triggers, ["t", "g"]),
  };
}

/** Run the real engine and replay every statement it SENT into `db`. */
async function applyInto(db, spec) {
  const statements = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "";
    try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { /* not ours */ }
    if (q) statements.push(String(q));
    // REFUSE THE NEON EXTENSION so the engine takes its own FALLBACK identity
    // function — the one that reads `request.jwt.claims`, which is what a local
    // Postgres can honour.
    if (/pg_session_jwt/.test(q)) {
      return new Response(JSON.stringify({ message: "extension pg_session_jwt is not available" }), { status: 400 });
    }
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  try { await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  // Statements a LOCAL Postgres cannot run for reasons that have nothing to do
  // with this probe. Named rather than swallowed.
  const EXPECTED = [/pg_session_jwt/, /\b_meta\b/];
  const unexpected = [];
  for (const s of statements) {
    const r = run(db, s.replace(/;\s*$/, ""));
    if (r.ok || EXPECTED.some((re) => re.test(s))) continue;
    unexpected.push({ sql: s.replace(/\s+/g, " ").slice(0, 110), err: (r.err.split("\n").find((l) => /ERROR/.test(l)) || r.err.split("\n")[0] || "").slice(0, 120) });
  }
  return { statements: statements.length, unexpected };
}

/**
 * The permission surface of one table, as Postgres really holds it: its
 * policies keyed by command, and its real column ACLs out of `pg_attribute`.
 *
 * `pg_attribute.attacl`, NEVER `column_privileges` — that view EXPANDS a
 * table-level grant across every column, so a table-wide GRANT and a
 * column-scoped one would look identical here. Measured on this very cluster
 * while the fingerprint was being written.
 */
function surface(db, table) {
  const pol = run(db, `SELECT cmd||'${SEP}'||coalesce(qual,'')||'${SEP}'||coalesce(with_check,'') FROM pg_policies WHERE schemaname='public' AND tablename='${table}' ORDER BY cmd`);
  const tbl = run(db, `SELECT grantee||' '||privilege_type FROM information_schema.role_table_grants WHERE table_name='${table}' AND grantee IN ('anonymous','authenticated') ORDER BY 1`);
  const col = run(db, `SELECT a.attname||' -> '||array_to_string(a.attacl,',') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='${table}' AND a.attacl IS NOT NULL ORDER BY a.attnum`);
  const cols = run(db, `SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}'`);
  return {
    policies: (pol.out || "").split("\n").filter(Boolean),
    tableGrants: (tbl.out || "").split("\n").filter(Boolean),
    columnAcls: (col.out || "").split("\n").filter(Boolean),
    columns: (cols.out || "").split(",").filter(Boolean),
  };
}

const diffSurface = (a, b) => {
  const out = [];
  for (const k of ["policies", "tableGrants", "columnAcls", "columns"]) {
    const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]);
    if (x !== y) out.push({ what: k, before: a[k], after: b[k] });
  }
  return out;
};

// ── THE SPEC: one table per interesting corner of the flag space ─────────────
//
// `bookings` is run 47's own shape, the one the whole repair is about. The rest
// each carry a flag that changes a POLICY (`trash`, `expires`, `scheduled`) or
// that changes which columns a client may write (`ordered`, `pinnable`,
// `payment`), because those are the two ways a recovery can do harm.
const SPEC = {
  tables: [
    { name: "bookings", access: "collect", columns: [
      { name: "customer_name", type: "text" }, { name: "bike", type: "text" }, { name: "drop_off_day", type: "text" },
    ] },
    { name: "notes", access: "user", columns: [
      { name: "title", type: "text" }, { name: "body", type: "text" },
    ], trash: true, timestamps: true },
    { name: "menu", access: "display", columns: [
      { name: "dish", type: "text" }, { name: "price", type: "integer" },
    ], ordered: true, pinnable: true },
    { name: "posts", access: "feed", columns: [
      { name: "body", type: "text" },
    ], scheduled: true, expires: true },
    // `display` + `trash` is the one shape that makes Postgres CONSTANT-FOLD:
    // `read: "public"` emits `USING (true AND "t"."deleted_at" IS NULL)` and
    // Postgres stores whatever it makes of that. The canonical form has to
    // agree with it, which is why this table is here rather than reasoned about.
    { name: "notices", access: "display", columns: [
      { name: "headline", type: "text" },
    ], trash: true },
    // `payment` IS AN OBJECT, NOT A BOOLEAN — `normalizePayment` wants the
    // catalogue table a basket is priced from and its two columns, and answers
    // `null` for anything else. The first draft of this probe wrote
    // `payment: true`, the engine created no payment columns at all, and the
    // arm below passed while proving nothing about a payable table. The
    // recorded "a fixture in a different shape from reality", caught by a real
    // Postgres printing three columns where five were expected.
    { name: "orders", access: "collect", columns: [
      { name: "item", type: "text" }, { name: "qty", type: "integer" },
    ], payment: { from: "menu", price: "price", name: "dish" } },
  ],
};
const TABLES = SPEC.tables.map((t) => t.name);

const BOOT = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anonymous') THEN CREATE ROLE anonymous NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anonymous, authenticated;
CREATE SCHEMA IF NOT EXISTS neon_auth;
CREATE TABLE IF NOT EXISTS neon_auth.member ("userId" uuid, "organizationId" uuid, "createdAt" timestamptz);
CREATE TABLE IF NOT EXISTS neon_auth."user" (id uuid primary key, email text);
`;

const made = [];
process.on("exit", () => {
  for (const db of made) { try { psql("postgres", `-q -d postgres -c ${shq(`DROP DATABASE IF EXISTS ${db};`)}`); } catch { /* best effort */ } }
});

/**
 * THE PRE-FIX RECOVERY, written out here rather than derived from the new one.
 *
 * It is `{name, columns: the non-managed ones, read, write}` — no flags, no
 * verification — which is exactly what `reconcileSpec` built before
 * 2026-09-15. A control produced by stripping fields off the NEW answer would
 * only ever see the tables the new code agreed to recover, which is none of
 * the interesting ones; the whole point of the control is that the old
 * algorithm recovered them all and asked nothing.
 */
function oldRecovery(live) {
  const byTable = new Map();
  for (const r of live.columns) {
    if (!r || !r.t || /^_/.test(r.t)) continue;
    if (!byTable.has(r.t)) byTable.set(r.t, []);
    byTable.get(r.t).push({ name: r.c, type: r.ty });
  }
  const tables = [];
  for (const [name, columns] of byTable) {
    const access = deriveAccess({ table: name, grants: live.grants, policies: live.policies });
    if (!access) continue;
    tables.push({
      name,
      columns: columns.filter((c) => !MANAGED_COLUMNS.has(String(c.name).toLowerCase())),
      read: access.read, write: access.write,
    });
  }
  return { tables };
}

/** One arm: apply, snapshot, forget the declarations, recover, apply, snapshot. */
async function arm(label, recover) {
  const db = `recprobe_${process.pid}_${label}`;
  made.push(db);
  psql("postgres", `-q -d postgres -c ${shq(`DROP DATABASE IF EXISTS ${db};`)} -c ${shq(`CREATE DATABASE ${db};`)}`);
  psql(db, `-q -v ON_ERROR_STOP=1 -d __DB__ -f -`, BOOT);

  const first = await applyInto(db, SPEC);
  const before = {};
  for (const t of TABLES) before[t] = surface(db, t);

  // THE CATALOG, THROUGH THE REAL QUERIES. This is what the Worker and the
  // repair script hand `reconcileSpec`, so reading it any other way here would
  // prove something about a fixture.
  const live = catalog(db);

  // FORGET EVERY DECLARATION — run 47's own state, at its worst.
  const { out, spec } = recover(live);
  const second = await applyInto(db, spec);
  const after = {};
  for (const t of TABLES) after[t] = surface(db, t);

  return { db, out, before, after, first, second, spec };
}

const problems = [];

console.log("── ARM 1: recovery WITH derived flags, verified through the emitters ──");
const keep = await arm("keep", (live) => {
  const out = reconcileSpec({ stored: { tables: [] }, live, emit: { policiesFor, grantsFor } });
  return { out, spec: out.spec };
});
if (keep.first.unexpected.length) problems.push(...keep.first.unexpected.map((u) => "first apply refused locally: " + u.sql + " — " + u.err));
if (keep.second.unexpected.length) problems.push(...keep.second.unexpected.map((u) => "recovery apply refused locally: " + u.sql + " — " + u.err));
console.log(`  recovered: ${JSON.stringify(keep.out.recovered.map((r) => r.name + "[" + r.flags.join(",") + "]"))}`);
console.log(`  uncertain: ${JSON.stringify(keep.out.uncertain.map((u) => u.name + " (" + u.why + ")"))}`);
console.log(`  ambiguous: ${JSON.stringify(keep.out.ambiguous.map((a) => a.name))}`);

let dirty = 0;
for (const t of TABLES) {
  const d = diffSurface(keep.before[t], keep.after[t]);
  if (!d.length) { console.log(`  ${t}: unchanged`); continue; }
  dirty++;
  console.log(`  ${t}: CHANGED`);
  for (const x of d) console.log(`      ${x.what}\n        before ${JSON.stringify(x.before)}\n        after  ${JSON.stringify(x.after)}`);
  problems.push(`${t}: applying the recovered declaration changed its ${d.map((x) => x.what).join(", ")}`);
}

// EVERY TABLE MUST HAVE BEEN LOOKED AT. `[].every(...)` is true, and a
// reconcile that recovered nothing would print five "unchanged" lines.
const covered = keep.out.recovered.length + keep.out.uncertain.length + keep.out.ambiguous.length;
if (covered !== TABLES.length) problems.push(`the reconcile accounted for ${covered} of ${TABLES.length} tables — the observer is not alive`);
if (!keep.out.recovered.length) problems.push("nothing was recovered at all, so the clean diff above proves nothing");

console.log("\n── ARM 2 (control): the PRE-FIX recovery, no flags and no verification ──");
const drop = await arm("drop", (live) => {
  const spec = oldRecovery(live);
  return { out: { recovered: spec.tables.map((t) => ({ name: t.name, flags: [] })), uncertain: [], ambiguous: [] }, spec };
});
let controlDirty = [];
for (const t of TABLES) {
  const d = diffSurface(drop.before[t], drop.after[t]);
  if (!d.length) { console.log(`  ${t}: unchanged`); continue; }
  controlDirty.push(t);
  console.log(`  ${t}: CHANGED`);
  for (const x of d) console.log(`      ${x.what}\n        before ${JSON.stringify(x.before)}\n        after  ${JSON.stringify(x.after)}`);
}
if (!controlDirty.length) {
  problems.push("the control changed nothing — with the flags stripped a `trash` table must lose its deleted_at filter, so this probe is measuring nothing");
} else {
  const notes = diffSurface(drop.before.notes, drop.after.notes);
  const mentionsTrash = JSON.stringify(notes).includes("deleted_at");
  console.log(`  control changed: ${controlDirty.join(", ")}${mentionsTrash ? "  (and `notes` lost its deleted_at filter, which is the named defect)" : ""}`);
  if (!mentionsTrash) problems.push("the control changed something, but not `notes`'s deleted_at filter — that is the defect this arm is the control for");
}

console.log("\n── RESULT ──");
if (problems.length) {
  for (const p of problems) console.log("  FAIL: " + p);
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`  PASS — ${keep.out.recovered.length} table(s) recovered and re-applied with no change to any policy, grant or column;`);
console.log(`         the flag-stripped control changed ${controlDirty.length} table(s).`);

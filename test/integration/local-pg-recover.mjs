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
import { RECOVER_QUERIES, reconcileSpec, deriveAccess, MANAGED_COLUMNS, predicateShape, readParens } from "../../site-schema-recover.mjs";

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

// ── ARM 3: THE COMPARATOR'S OWN NEGATIVE CASES, AGAINST REAL STORED TEXT ─────
//
// Arms 1 and 2 ask "does a recovery this code ACCEPTS change the database".
// They cannot see the opposite failure: a live policy the comparator accepts as
// equivalent when it is NOT. That is the 2026-09-15 defect — the normaliser
// lowercased the whole predicate and deleted every `"` before parsing, so a
// column really named `true`, a string literal's case and a qualifier naming
// ANOTHER table were all erased before anything could compare them.
//
// Every predicate below is CREATEd as a real policy and read back out of
// `pg_policies`, so the text compared is Postgres's own — which is the whole
// point: the bug was a disagreement between what Postgres preserves and what
// this code threw away.

/**
 * THE PRE-FIX NORMALISER, written out rather than derived — the one line that
 * changed. `canonPredicate` on the scrubbed string reproduces the old
 * behaviour exactly, because a string this has been through carries no quotes,
 * no qualifier and no cast for the new lexer to preserve.
 */
const oldScrub = (s) => String(s || "").toLowerCase().replace(/"/g, "")
  .replace(/\b[a-z_][a-z0-9_]*\s*\.\s*(?=[a-z_])/g, "")
  .replace(/::\s*[a-z_][a-z0-9_]*(\s+[a-z]+)?/g, "")
  .replace(/\s+/g, " ").trim();
const oldShape = (text) => predicateShape(oldScrub(text));

console.log("\n── ARM 3a: an adversarial live policy the OLD comparator accepted ──");
{
  const db = `recprobe_${process.pid}_adv`;
  made.push(db);
  psql("postgres", `-q -d postgres -c ${shq(`DROP DATABASE IF EXISTS ${db};`)} -c ${shq(`CREATE DATABASE ${db};`)}`);
  psql(db, `-q -v ON_ERROR_STOP=1 -d __DB__ -f -`, BOOT);
  await applyInto(db, SPEC);

  // A boolean column really named `true`, and the site's own SELECT policy
  // narrowed by it. `deriveAccess` still reads `own` off the second conjunct,
  // so this isolates the PREDICATE COMPARATOR and nothing else.
  const setup = [
    `ALTER TABLE "notes" ADD COLUMN "true" boolean DEFAULT false`,
    `DROP POLICY IF EXISTS "isibi_notes_read" ON "notes"`,
    `CREATE POLICY "isibi_notes_read" ON "notes" FOR SELECT USING (("true") AND ("notes"."owner_id" = app_user_id()) AND ("notes"."deleted_at" IS NULL))`,
  ];
  for (const s of setup) {
    const r = run(db, s);
    if (!r.ok) problems.push("arm 3a setup refused: " + s + " — " + r.err);
  }

  const liveAdv = catalog(db);
  const advPolicy = (liveAdv.policies.find((p) => p.t === "notes" && String(p.c).toUpperCase() === "SELECT") || {}).q || "";
  const mine = (policiesFor(SPEC.tables.find((t) => t.name === "notes")) || [])
    .find((s) => /FOR\s+SELECT/i.test(s)) || "";
  const mineUsing = readParens(mine, /USING\s*\(/i.exec(mine).index + /USING\s*\(/i.exec(mine)[0].length - 1);
  console.log(`  live  (pg_policies): ${advPolicy}`);
  console.log(`  would (policiesFor): ${mineUsing}`);

  // THE CONTROL: the old normaliser called these two the same, which is why
  // this case is a real defect and not an invented one.
  const oldSame = oldShape(advPolicy) === oldShape(mineUsing);
  const nowSame = predicateShape(advPolicy, "notes") === predicateShape(mineUsing, "notes");
  console.log(`  old comparator: ${oldSame ? "EQUAL (would have recovered, dropping the `true` conjunct)" : "different"}`);
  console.log(`  new comparator: ${nowSame ? "EQUAL" : "different (refused)"}`);
  if (!oldSame) problems.push("arm 3a proves nothing: the OLD comparator already told these apart, so the case is not the defect");
  if (nowSame) problems.push("arm 3a: the new comparator still reads a `\"true\"` conjunct as the boolean literal — the next apply would widen this policy");

  // AND END TO END: the reconcile must leave the table alone.
  const before = surface(db, "notes");
  const out = reconcileSpec({ stored: { tables: [] }, live: liveAdv, emit: { policiesFor, grantsFor } });
  const refused = [...out.uncertain, ...out.ambiguous].find((x) => x.name === "notes");
  const recovered = out.recovered.find((r) => r.name === "notes");
  console.log(`  reconcile: ${recovered ? "RECOVERED notes" : `refused notes (${(refused && refused.why) || "not listed"})`}`);
  if (recovered) problems.push("arm 3a: the reconcile recovered `notes` from an adversarial policy — applying it would drop the `true` conjunct");
  await applyInto(db, out.spec);
  const advDiff = diffSurface(before, surface(db, "notes"));
  if (advDiff.length) {
    for (const x of advDiff) console.log(`      ${x.what}\n        before ${JSON.stringify(x.before)}\n        after  ${JSON.stringify(x.after)}`);
    problems.push("arm 3a: applying the reconcile changed the adversarial table's " + advDiff.map((x) => x.what).join(", "));
  } else console.log("  applying the reconcile left `notes` exactly as it was");
}

console.log("\n── ARM 3b: pairs Postgres really stores, canonicalised ──");
{
  const db = `recprobe_${process.pid}_pairs`;
  made.push(db);
  psql("postgres", `-q -d postgres -c ${shq(`DROP DATABASE IF EXISTS ${db};`)} -c ${shq(`CREATE DATABASE ${db};`)}`);
  psql(db, `-q -v ON_ERROR_STOP=1 -d __DB__ -f -`, BOOT);
  const boot = [
    `CREATE FUNCTION app_user_id() RETURNS text LANGUAGE sql AS $fn$ SELECT 'x'::text $fn$`,
    `CREATE TABLE "m" ("true" boolean, status text, owner_id text, kind int, expires_at text)`,
    `CREATE TABLE "other" (owner_id text)`,
    `ALTER TABLE "m" ENABLE ROW LEVEL SECURITY`,
  ];
  for (const s of boot) { const r = run(db, s); if (!r.ok) problems.push("arm 3b boot refused: " + s + " — " + r.err); }

  let nth = 0;
  /** CREATE the predicate as a real policy and hand back what Postgres stored. */
  const stored = (expr) => {
    const name = `p${++nth}`;
    const r = run(db, `CREATE POLICY "${name}" ON "m" FOR SELECT USING (${expr})`);
    if (!r.ok) { problems.push(`arm 3b could not create ${expr}: ${r.err}`); return null; }
    const q = run(db, `SELECT qual FROM pg_policies WHERE tablename='m' AND policyname='${name}'`);
    return q.ok ? q.out : null;
  };

  const Q = String.fromCharCode(39);
  const PAIRS = [
    // want === true means the two MUST canonicalise the same.
    { want: true, why: "our own qualifier is what Postgres drops", a: `"m"."owner_id" = app_user_id()`, b: `owner_id = app_user_id()` },
    { want: true, why: "Postgres adds ::text to a string literal", a: `expires_at > to_char(now() AT TIME ZONE ${Q}UTC${Q}, ${Q}YYYY-MM-DD HH24:MI:SS${Q})`, b: `expires_at > to_char(now() AT TIME ZONE ${Q}UTC${Q}::text, ${Q}YYYY-MM-DD HH24:MI:SS${Q}::text)` },
    { want: false, why: "a column named `true` is not the literal", a: `"true"`, b: `true` },
    { want: false, why: "`true` is AND's identity, so the conjunct would vanish", a: `("true") AND (owner_id = app_user_id())`, b: `owner_id = app_user_id()` },
    { want: false, why: "a string literal's case is data", a: `status = ${Q}APPROVED${Q}`, b: `status = ${Q}approved${Q}` },
    // Postgres cannot STORE a bare `other.owner_id` in a policy on `m` — a
    // predicate reaching another table has to be a subquery — so this row is
    // about what Postgres really keeps. The bare foreign qualifier, which the
    // old scrub deleted whatever it named, is driven in `backend-repair`.
    { want: false, why: "a predicate reading ANOTHER table is not this table's", a: `"m"."owner_id" = app_user_id()`, b: `(SELECT owner_id FROM "other" LIMIT 1) = app_user_id()` },
    { want: false, why: "a cast that is not ::text-on-a-literal is kept", a: `kind = 1`, b: `kind::text = ${Q}1${Q}` },
    { want: false, why: "IS NULL is not IS NOT NULL", a: `expires_at IS NULL`, b: `expires_at IS NOT NULL` },
  ];
  for (const p of PAIRS) {
    const A = stored(p.a), B = stored(p.b);
    if (A === null || B === null) continue;
    const now = predicateShape(A, "m") === predicateShape(B, "m");
    const old = oldShape(A) === oldShape(B);
    const ok = now === p.want;
    if (!ok) problems.push(`arm 3b: ${p.why} — stored ${JSON.stringify(A)} vs ${JSON.stringify(B)} canonicalise ${now ? "the SAME" : "DIFFERENTLY"}, wanted ${p.want ? "the same" : "different"}`);
    const note = !p.want && old ? "  <- the OLD comparator called these equal" : "";
    console.log(`  ${ok ? "ok  " : "FAIL"} ${p.want ? "same " : "differ"}  ${p.why}${note}`);
  }
  // THE OBSERVER, PROVED ALIVE IN BOTH DIRECTIONS: a run where every pair
  // answered "different" would pass every `want: false` row for free.
  if (!PAIRS.some((p) => p.want) || !PAIRS.some((p) => !p.want)) {
    problems.push("arm 3b has no positive or no negative pair, so it is asserting in one direction only");
  }
}

console.log("\n── RESULT ──");
if (problems.length) {
  for (const p of problems) console.log("  FAIL: " + p);
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`  PASS — ${keep.out.recovered.length} table(s) recovered and re-applied with no change to any policy, grant or column;`);
console.log(`         the flag-stripped control changed ${controlDirty.length} table(s);`);
console.log(`         an adversarial policy the old comparator accepted is refused, and every stored pair reads as it should.`);

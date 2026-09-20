/**
 * THE ROLLOUT CHECK — what is pending, in what order it has to go, and does it apply.
 *
 * ⚠ **THIS TOUCHES NO HOSTED PROJECT AND APPLIES NOTHING LIVE.** Everything here happens in
 * two throwaway local PostgreSQL databases, built from this tree's own migration files.
 *
 * Four questions, and each is answered by measurement rather than by a list somebody typed:
 *
 *   1. WHICH MIGRATIONS ARE PENDING — derived TWO WAYS and required to agree: the last
 *      version the live project records, and this folder's own naming convention (an applied
 *      file is renamed to its remote version; an unapplied one keeps a round number). Either
 *      alone is a claim; the two together catch a stale constant and a file applied without
 *      being renamed.
 *   2. A FRESH DATABASE — every migration in order onto an empty cluster.
 *   3. AN UPGRADE FROM THE LAST DEPLOYED SCHEMA — the applied ones, SEEDED WITH REAL ROWS
 *      through the real functions, then the pending ones one at a time. **The seed is the
 *      point**: a migration that adds a `not null` column with no default is fine on an
 *      empty database and refuses on one with a customer's rows in it. Then the two
 *      fingerprints must be IDENTICAL — a fresh apply and an upgrade converging on the same
 *      schema is what says nothing depends on a state only a fresh database has.
 *   4. THE THREE-DEPLOYMENT ORDER — migration → engine → site. Not a database question, so
 *      what is measured is the FAILURE each link prevents: the schema DIFF names every
 *      object the pending set adds, and each side's own source is asked which of them it
 *      calls. A name the ENGINE calls is what an engine-first deploy answers `PGRST202` for;
 *      a name the SITE calls is what a site-first deploy answers 400 for.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haveCluster, standUp, MIGRATIONS } from "./lib/local-stack.mjs";
import { CAPABILITY_RPC } from "../src/capabilities.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SITE = path.resolve(ROOT, "..");

/**
 * ⚠ **THE LAST VERSION THE LIVE PROJECT RECORDS**, read from `ujrqdmmtcptvimazlhom`'s own
 * migration list on 2026-09-20 — not inferred from the filenames, which is the other half
 * of the census below. There is also a remote-only `20260916031852`
 * (`agent_send_function_bodies_verbatim`) with no file here: it re-applied three function
 * bodies VERBATIM after a tool trimmed their comments, and a second file would have been a
 * second copy of the same DDL. It is recorded in `CLAUDE.md` and changes nothing here.
 */
const LAST_DEPLOYED = "20260917003304";

/** A round-number version is this folder's own tell for a file nobody has applied. */
const roundNumber = (v) => /0{4}$/.test(v);
const versionOf = (f) => f.slice(0, 14);

let failed = 0;
const fails = [];
const check = (what, cond, detail = "") => {
  if (!cond) { failed++; fails.push(what + (detail ? ` — ${detail}` : "")); }
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

if (!haveCluster()) {
  console.log("no local PostgreSQL — skipping (a missing cluster is not a failing rollout)");
  process.exit(0);
}

/** The fingerprint: every object in the `agent` schema, one line each, sorted. */
const FINGERPRINT = `
with cols as (
  select format('COL %s.%s %s null=%s def=%s gen=%s', c.table_name, c.column_name, c.data_type,
                c.is_nullable, coalesce(c.column_default,'-'), coalesce(c.is_generated,'-')) s
    from information_schema.columns c where c.table_schema = 'agent'
), cons as (
  select format('CON %s %s', conname, pg_get_constraintdef(oid)) s
    from pg_constraint where connamespace = 'agent'::regnamespace
), idx as (
  select format('IDX %s', indexdef) s from pg_indexes where schemaname = 'agent'
), fns as (
  select format('FN %s(%s) %s', p.proname, pg_get_function_identity_arguments(p.oid),
                md5(pg_get_functiondef(p.oid))) s
    from pg_proc p where p.pronamespace = 'agent'::regnamespace
), vws as (
  select format('VIEW %s %s opts=%s', c.relname, md5(pg_get_viewdef(c.oid)),
                coalesce(array_to_string(c.reloptions, ','), '-')) s
    from pg_class c where c.relnamespace = 'agent'::regnamespace and c.relkind = 'v'
), trg as (
  select format('TRG %s', pg_get_triggerdef(t.oid)) s
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relnamespace = 'agent'::regnamespace and not t.tgisinternal
), rls as (
  select format('RLS %s rowsec=%s forced=%s', relname, relrowsecurity, relforcerowsecurity) s
    from pg_class where relnamespace = 'agent'::regnamespace and relkind = 'r'
), pol as (
  select format('POL %s %s %s roles=%s using=%s check=%s', tablename, policyname, cmd,
                array_to_string(roles, ','), coalesce(qual, '-'), coalesce(with_check, '-')) s
    from pg_policies where schemaname = 'agent'
), acl as (
  select format('ACL %s %s', relname, coalesce(array_to_string(relacl, ','), '-')) s
    from pg_class where relnamespace = 'agent'::regnamespace and relkind in ('r','v')
), cacl as (
  select format('CACL %s.%s %s', c.relname, a.attname, array_to_string(a.attacl, ',')) s
    from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'agent'::regnamespace and a.attnum > 0 and a.attacl is not null
), sacl as (
  select format('SCHEMA usage(%s)=%s create(%s)=%s', r, has_schema_privilege(r, 'agent', 'usage'),
                r, has_schema_privilege(r, 'agent', 'create')) s
    from (values ('authenticated'),('service_role'),('anon')) v(r)
)
select s from (
  select s from cols union all select s from cons union all select s from idx
  union all select s from fns union all select s from vws union all select s from trg
  union all select s from rls union all select s from pol union all select s from acl
  union all select s from cacl union all select s from sacl
) t order by s;
`;

/** Run a multi-line query through a readable temp file — `psql -c` mangles this one. */
const fingerprint = (su, db) => {
  const tmp = `/tmp/rollout-fp-${process.pid}.sql`;
  fs.writeFileSync(tmp, FINGERPRINT);
  fs.chmodSync(tmp, 0o644);
  try {
    return su(`psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} -f ${tmp}`).trim().split("\n").filter(Boolean);
  } finally { fs.rmSync(tmp, { force: true }); }
};

const DB_FRESH = `rollout_fresh_${process.pid}`;
const DB_UP = `rollout_upgrade_${process.pid}`;

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n1. WHAT IS PENDING — derived two ways, and they have to agree");
// ═══════════════════════════════════════════════════════════════════════════════

const atLast = MIGRATIONS.findIndex((f) => f.startsWith(LAST_DEPLOYED));
check("the last deployed version names a real migration in this tree",
  atLast >= 0, `${LAST_DEPLOYED} → ${atLast >= 0 ? MIGRATIONS[atLast] : "NOT FOUND"}`);
if (atLast < 0) { console.log("\n1 FAILED"); process.exit(1); }

const APPLIED = MIGRATIONS.slice(0, atLast + 1);
const PENDING = MIGRATIONS.slice(atLast + 1);

check(`${APPLIED.length} applied, ${PENDING.length} pending, ${MIGRATIONS.length} in all`,
  APPLIED.length + PENDING.length === MIGRATIONS.length);

// ⚠ THE CENSUS, BOTH WAYS. The convention and the live list are independent facts, so
// requiring them to agree catches the two ways this can go stale: a migration applied and
// renamed without the constant moving, and one applied without being renamed at all.
const appliedRound = APPLIED.filter((f) => roundNumber(versionOf(f)));
const pendingReal = PENDING.filter((f) => !roundNumber(versionOf(f)));
check("no APPLIED migration keeps a round-number name", appliedRound.length === 0,
  appliedRound.join(", ") || "none");
check("no PENDING migration carries a real remote version", pendingReal.length === 0,
  pendingReal.join(", ") || "none");

console.log("\n  the ten to apply, in this order:");
for (const f of PENDING) console.log(`    ${f}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n2. A FRESH DATABASE — every migration onto an empty cluster");
// ═══════════════════════════════════════════════════════════════════════════════

const fresh = await standUp({ db: DB_FRESH, quiet: true });
let up = null;
try {
  check("every migration applied", fresh.applied.length === MIGRATIONS.length,
    `${fresh.applied.length} of ${MIGRATIONS.length}`);

  const freshFp = fingerprint(fresh.su, DB_FRESH);
  const count = (k) => freshFp.filter((l) => l.startsWith(k)).length;
  console.log(`  ${freshFp.length} objects: ${count("COL ")} columns · ${count("CON ")} constraints`
    + ` · ${count("IDX ")} indexes · ${count("FN ")} functions · ${count("VIEW ")} views`
    + ` · ${count("TRG ")} triggers · ${count("POL ")} policies`);
  check("the fresh schema really has something in it", freshFp.length > 400, `${freshFp.length}`);

  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n3. AN UPGRADE — the deployed schema, SEEDED, then the ten one at a time");
  // ═════════════════════════════════════════════════════════════════════════════

  up = await standUp({ db: DB_UP, quiet: true, upTo: LAST_DEPLOYED });
  check("only the deployed migrations applied", up.applied.length === APPLIED.length,
    `${up.applied.length} of ${MIGRATIONS.length}`);
  const q = up.q;

  // ⚠ THE DEPLOYED SCHEMA IS FINGERPRINTED **BEFORE** ANYTHING IS APPLIED TO IT, which is
  // what makes "what the ten add" a subtraction between two databases rather than a list
  // read off the files. It is also why there is no third stand-up: the same database
  // answers the before and the after.
  const deplFp = fingerprint(up.su, DB_UP);
  const fnName = (l) => l.slice(3, l.indexOf("("));
  const colOf = (l) => l.split(" ")[1];
  const deplFns = new Set(deplFp.filter((l) => l.startsWith("FN ")).map(fnName));
  const deplCols = new Set(deplFp.filter((l) => l.startsWith("COL ")).map(colOf));

  // ⚠ SEEDED THROUGH THE REAL FUNCTIONS, never by hand. Rows written by hand are rows in a
  // shape nothing produces, and the whole point of this half is whether the pending
  // migrations survive rows a customer really has.
  const T = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
  const AG = "11111111-1111-4111-8111-111111111111";
  const MSG = "22222222-2222-4222-8222-222222222222";
  const RUN = "33333333-3333-4333-8333-333333333333";
  const AUTO = "44444444-4444-4444-8444-444444444444";
  const EXEC = "55555555-5555-4555-8555-555555555555";

  q(`insert into agent.agents (id, tenant_id, name, instructions)
       values ('${AG}', '${T}', 'the workshop', 'answer politely');`);
  const sent = q(`select agent.send_to_agent('${T}', '${AG}', '${MSG}', 'when do you open?', 'k1', '${RUN}');`);
  check("the seed's message and run were accepted by the real function",
    /"ok"\s*:\s*true/.test(sent), sent.slice(0, 80));
  const made = q(`select agent.create_automation('${T}', '${AG}', '${AUTO}', 'nightly',
      true, 'daily', '09:00', 'Europe/London', '[{"type":"note","text":"hello"}]'::jsonb);`);
  check("the seed's automation was created by the real function",
    /"ok"\s*:\s*true/.test(made), made.slice(0, 80));
  const started = q(`select agent.accept_automation_run('${T}', '${AUTO}', '${EXEC}', 'manual');`);
  check("the seed's execution was accepted by the real function",
    /"ok"\s*:\s*true/.test(started), started.slice(0, 80));

  const before = {
    agents: q(`select count(*) from agent.agents;`),
    messages: q(`select count(*) from agent.agent_messages;`),
    runs: q(`select count(*) from agent.runs;`),
    entries: q(`select count(*) from agent.run_entries;`),
    work: q(`select count(*) from agent.run_work;`),
    autos: q(`select count(*) from agent.automations;`),
    execs: q(`select count(*) from agent.automation_runs;`),
    log: q(`select md5(string_agg(body::text, '|' order by run_id, seq)) from agent.run_entries;`),
  };
  console.log(`  seeded: ${before.agents} agent · ${before.messages} message · ${before.runs} runs`
    + ` · ${before.entries} journal entries · ${before.work} work rows · ${before.autos} automation`
    + ` · ${before.execs} execution`);
  check("the seed really put rows in every table the upgrade touches",
    Object.entries(before).every(([k, v]) => k === "log" || Number(v) > 0),
    Object.entries(before).filter(([k]) => k !== "log").map(([k, v]) => `${k}=${v}`).join(" "));

  // ⚠ ONE AT A TIME, so a refusal names its own file rather than arriving as "the upgrade
  // failed". Each is applied over rows, which is the half an empty database cannot test.
  for (const f of PENDING) {
    let why = "";
    let ok = true;
    try { up.apply(f); } catch (e) { ok = false; why = String(e?.stderr || e?.message || e).slice(-200); }
    check(`${f} applies over a seeded database`, ok, why);
    if (!ok) break;
  }

  // WHAT THE TEN ADD — the subtraction, now that both ends are in hand.
  const freshFns = new Set(freshFp.filter((l) => l.startsWith("FN ")).map(fnName));
  const addedFns = [...freshFns].filter((n) => !deplFns.has(n)).sort();
  const addedCols = freshFp.filter((l) => l.startsWith("COL ")).map(colOf)
    .filter((c) => !deplCols.has(c)).sort();
  check("the ten really add objects, so the sections below have a subject",
    addedFns.length > 0 && addedCols.length > 0,
    `${addedFns.length} new functions, ${addedCols.length} new columns`);

  const after = {
    agents: q(`select count(*) from agent.agents;`),
    messages: q(`select count(*) from agent.agent_messages;`),
    runs: q(`select count(*) from agent.runs;`),
    entries: q(`select count(*) from agent.run_entries;`),
    work: q(`select count(*) from agent.run_work;`),
    autos: q(`select count(*) from agent.automations;`),
    execs: q(`select count(*) from agent.automation_runs;`),
    log: q(`select md5(string_agg(body::text, '|' order by run_id, seq)) from agent.run_entries;`),
  };
  for (const k of Object.keys(before)) {
    check(`the upgrade kept every ${k === "log" ? "journal entry byte for byte" : k + " row"}`,
      before[k] === after[k], `${before[k]} → ${after[k]}`);
  }
  check("the seeded agent is still readable by id", q(`select name from agent.agents where id = '${AG}';`) === "the workshop");
  check("the seeded automation is still readable by id", q(`select name from agent.automations where id = '${AUTO}';`) === "nightly");

  // ⚠ AND EVERY NEW COLUMN ON A ROW THAT PREDATES IT HOLDS WHAT ITS OWN DEFAULT SAYS —
  // a CENSUS over the whole added set, and over EVERY row rather than one, instead of
  // values transcribed into this file. A default is a decision a migration makes, so
  // comparing a row against the COLUMN'S OWN evaluated default is the property; a copied
  // string is a spelling, and the first version of this was wrong about two of the nine
  // columns it named (`days` is an empty ARRAY, which prints `{}` and not NULL, and
  // `loops` is an empty OBJECT and not a list).
  const SEEDED = ["agents", "agent_messages", "runs", "run_entries", "run_work",
                  "automations", "automation_runs"];
  const newHere = [...addedCols].filter((c) => SEEDED.includes(c.split(".")[0]));
  const defs = q(`select c.table_name || '|' || c.column_name || '|' || c.column_default
    from information_schema.columns c
   where c.table_schema = 'agent' and c.table_name in (${SEEDED.map((t) => `'${t}'`).join(",")})
     and c.column_default is not null and c.column_default not ilike '%now()%'
   order by 1;`).split("\n").filter(Boolean).map((l) => {
     const i = l.indexOf("|"); const j = l.indexOf("|", i + 1);
     return { t: l.slice(0, i), c: l.slice(i + 1, j), d: l.slice(j + 1) };
   }).filter((r) => newHere.includes(`${r.t}.${r.c}`));

  const odd = defs.length === 0 ? "no defaults to compare" : q(defs.map((r) =>
    `select '${r.t}.${r.c}' k, count(*) n from agent.${r.t}
      where "${r.c}"::text is distinct from (${r.d})::text`).join(" union all ")
    + `;`).split("\n").filter((l) => l && !/\|0$/.test(l)).join(" ");
  check(`every one of the ${defs.length} new defaulted columns holds its own default on every pre-existing row`,
    odd === "", odd.slice(0, 300));
  check("...and there were really columns to compare", defs.length >= 5,
    defs.map((r) => `${r.t}.${r.c}`).join(", ").slice(0, 200));

  // ⚠ AND THE OTHER HALF IS A DECLARED REDUNDANCY, said here rather than left to look like
  // an independent wall: an ADDED column that is `not null` with no default cannot exist
  // once the applies above have succeeded, because Postgres would have refused the ALTER on
  // a table with rows in it. What it is worth is DIAGNOSIS — the day a migration does that,
  // this line names the column instead of leaving somebody reading a psql error. It is
  // restricted to the columns the ten ADD, because a `not null` primary key that has been
  // there since the table was created is not this check's business, and asking over every
  // column of the seven named twenty-four of them.
  const nulled = newHere.length === 0 ? "" : q(`select coalesce(string_agg(bad, ', '), '') from (
      select format('%s.%s', c.table_name, c.column_name) bad
        from information_schema.columns c
       where c.table_schema='agent'
         and c.table_name || '.' || c.column_name in (${newHere.map((c) => `'${c}'`).join(",")})
         and c.column_default is null and c.is_nullable = 'NO') z;`);
  check(`none of the ${newHere.length} columns added to a table with rows is NOT NULL with no default`,
    nulled === "", nulled);

  // ⚠ THE CONVERGENCE, and it is the check with the most in it. A fresh apply and an
  // upgrade landing on the SAME schema is what says the pending set is correctly ordered
  // and that nothing in it depends on a state only an empty database has.
  const upFp = fingerprint(up.su, DB_UP);
  const onlyFresh = freshFp.filter((l) => !upFp.includes(l));
  const onlyUp = upFp.filter((l) => !freshFp.includes(l));
  check("the upgraded schema is IDENTICAL to a fresh one, object for object",
    onlyFresh.length === 0 && onlyUp.length === 0,
    `${onlyFresh.length} only fresh, ${onlyUp.length} only upgraded`);
  for (const l of onlyFresh.slice(0, 6)) console.log(`      only fresh: ${l}`);
  for (const l of onlyUp.slice(0, 6)) console.log(`      only upgraded: ${l}`);
  check("...and both fingerprints were really read", freshFp.length > 0 && upFp.length > 0,
    `${freshFp.length} / ${upFp.length}`);

  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n4. THE ORDER WITHIN THE TEN IS LOAD-BEARING, not a convention");
  // ═════════════════════════════════════════════════════════════════════════════

  // If the ten could go in any order, "in this order" would be advice. Applied backwards
  // onto the same deployed schema they must REFUSE — and the refusal is read for its own
  // file, because one that failed at the last step would say nothing about the order.
  const DB_REV = `rollout_reverse_${process.pid}`;
  const rev = await standUp({ db: DB_REV, quiet: true, upTo: LAST_DEPLOYED });
  try {
    let broke = null;
    for (const f of [...PENDING].reverse()) {
      try { rev.apply(f); } catch (e) { broke = { f, why: String(e?.stderr || e?.message || e) }; break; }
    }
    check("applied in REVERSE order the pending set refuses", broke !== null,
      broke ? `${broke.f}` : "every one applied — the order is not load-bearing");
    if (broke) {
      const first = broke.why.split("\n").find((l) => /ERROR/.test(l)) || broke.why.slice(0, 160);
      console.log(`      ${first.trim().slice(0, 160)}`);
      check("...and it refused before the last of them, so the order is the reason",
        broke.f !== PENDING[0], broke.f);
    }
  } finally { await rev.tearDown(); }

  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n5. MIGRATION → ENGINE → SITE — each link's own failure, derived");
  // ═════════════════════════════════════════════════════════════════════════════

  // WHO CALLS EACH ONE — a grep for a name that came out of the DATABASE, so a function
  // added next month is covered by existing rather than by somebody remembering to list it.
  const read = (p) => fs.readFileSync(p, "utf8");
  const engineSrc = fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".mjs"))
    .map((f) => read(path.join(ROOT, "src", f))).join("\n");
  const siteSrc = read(path.join(SITE, "agent-store.mjs"));
  const names = (src, n) => new RegExp(`\\b${n}\\b`).test(src);

  // ⚠ A LITERAL GREP CANNOT SEE A NAME THE CODE COMPOSES, and sixteen of these are exactly
  // that: the capability store reaches every write as `` `${CAPABILITY_RPC[op]}_once` ``, so
  // `save_memory_once` appears nowhere in the source and IS called on every write. Reading
  // the list without this says the opposite of the truth about the money path. Derived from
  // `CAPABILITY_RPC` rather than by matching the suffix, because a suffix is a spelling.
  const templated = new Set(Object.values(CAPABILITY_RPC).map((n) => `${n}_once`));
  const engineFns = addedFns.filter((n) => names(engineSrc, n) || templated.has(n));
  const siteFns = addedFns.filter((n) => names(siteSrc, n));
  check("the templated wrappers are read as called, not as dead",
    addedFns.filter((n) => templated.has(n)).length > 0,
    `${addedFns.filter((n) => templated.has(n)).length} reached by a composed name`);

  // ⚠ AND A NAME USED INSIDE ANOTHER SQL FUNCTION IS NOT UNCALLED EITHER. Asked by
  // subtracting the lines that DEFINE, comment on or grant it — what is left is a use.
  const migSrc = MIGRATIONS.map((f) =>
    read(path.join(ROOT, "supabase", "migrations", f))).join("\n");
  const usedInSql = (n) => migSrc.split("\n").some((l) =>
    new RegExp(`\\b${n}\\b`).test(l)
    && !/^\s*(create or replace function|create function|comment on function|grant|revoke|--)/.test(l.trim())
    && !/^\s*'agent\./.test(l.trim()));
  const nobodyFns = addedFns.filter((n) =>
    !names(engineSrc, n) && !names(siteSrc, n) && !templated.has(n) && !usedInSql(n));
  const engineCols = addedCols.filter((c) => names(engineSrc, c.split(".")[1]));
  const siteCols = addedCols.filter((c) => names(siteSrc, c.split(".")[1]));

  console.log(`  of ${addedFns.length} new functions: the ENGINE names ${engineFns.length},`
    + ` the SITE names ${siteFns.length}, neither names ${nobodyFns.length}`);
  console.log(`  of ${addedCols.length} new columns: the ENGINE names ${engineCols.length},`
    + ` the SITE names ${siteCols.length}`);

  check("MIGRATION FIRST: the engine calls functions the deployed schema has not got",
    engineFns.length > 0, `${engineFns.length}, e.g. ${engineFns.slice(0, 4).join(", ")}`);
  check("MIGRATION FIRST: the site calls some too, so neither Worker may go first",
    siteFns.length > 0, `${siteFns.length}, e.g. ${siteFns.slice(0, 4).join(", ")}`);
  check("ENGINE BEFORE SITE: the site reads columns only the migration adds",
    siteCols.length > 0, `${siteCols.length}, e.g. ${siteCols.slice(0, 4).join(", ")}`);
  // ⚠ AND THE OBSERVER: a grep that matched nothing would satisfy every "> 0" above by
  // being wrong in the other direction, so an existing function both sides really call has
  // to be found too.
  check("...and the reader is alive — both sides are found naming a function they do call",
    names(engineSrc, "claim_run") && names(siteSrc, "send_to_agent"));

  // ⚠ WHAT IS LEFT IS A FUNCTION WITH NO CALLER ANYWHERE — not a Worker, not another SQL
  // function, not a composed name. It is a REPORT and not a refusal: shipping one is not
  // wrong, and the rollout is not the place to decide what to do about it. But it is the
  // one line here somebody should read, because *a value computed and never forwarded* is
  // this repository's most-recorded defect and a function is the largest form of it.
  // ⚠ AND "A CHECK DRIVES IT" IS A DIFFERENT STATE FROM "NOTHING TOUCHES IT", so the two are
  // told apart rather than reported as one alarm: a function only a check drives is one
  // whose guarantees are proved and whose PRODUCT caller is missing, which is the actionable
  // half. Without the split this line reads as untested dead code, which would be wrong.
  const checkSrc = read(path.join(ROOT, "test", "integration", "pg-schema.mjs"));
  const onlyChecked = nobodyFns.filter((n) => names(checkSrc, n));
  console.log(`\n  functions the ten add that NO PRODUCT CODE calls (${nobodyFns.length}):`);
  for (const n of nobodyFns) {
    console.log(`    agent.${n} — ${onlyChecked.includes(n) ? "driven by pg-schema.mjs, so its guarantees are proved and its caller is what is missing" : "nothing anywhere touches it"}`);
  }
  if (nobodyFns.length === 0) console.log("    none");

  console.log(`\n  ── THE ORDER, AND EACH LINK'S OWN REASON ─────────────────────────`);
  console.log(`  1. MIGRATION — ${PENDING.length} files, in the order printed above.`);
  console.log(`     Both Workers call functions this schema has not got; against it PostgREST`);
  console.log(`     answers PGRST202 and every such call fails. Not degraded — refused.`);
  console.log(`  2. ENGINE  (agent-builder, its own Worker) — it is the half that ACTS.`);
  console.log(`     A tool tick or a workflow step the live engine cannot honour is a control`);
  console.log(`     that answers, wrongly, which is what this product's notes record twice.`);
  console.log(`  3. SITE    (the root Worker) — the only half a person touches, so it goes`);
  console.log(`     last: a screen must not offer what the engine cannot yet run.`);

  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${fails.length} FAILED`}`);
  if (failed) for (const f of fails) console.log(`  - ${f}`);
} finally {
  if (up) await up.tearDown();
  await fresh.tearDown();
}
process.exit(failed === 0 ? 0 : 1);

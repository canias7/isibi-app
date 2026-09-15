// REPAIR THE TWO THINGS RUN 47 BROKE, AND THE ONE THAT BROKE IT.
//
// 1. THE REFERENCE. `site_backends.neon_db` is blank on five live sites whose
//    database was provisioned AFTER their first build, because `saveBackend` is
//    an INSERT with `resolution=ignore-duplicates` and cannot update a row that
//    already exists. `worker.js` writes it on every provision now; this closes
//    the ones that will never provision again.
//
// 2. THE DECLARATION. An addon writes `_meta.schema` WHOLE from the spec it read
//    at the top of the route, so a route that read `{tables: []}` — which is
//    what a blank reference produced — published a spec with the site's earlier
//    tables missing. The tables are still in Postgres; only the declaration
//    went. `site-schema-recover.mjs` reconciles the two.
//
// ── THREE TASKS, NOT ONE (2026-09-15) ────────────────────────────────────────
//
// The first cut ran one loop over the sites whose REFERENCE needed writing, so
// a site with a good reference and a broken declaration was never looked at —
// and every site is in exactly that state the moment its reference is repaired.
// A run that wrote the reference and then failed the recovery could never
// finish the job, because the rerun skipped the site it had just fixed. They
// are separate now and each is decided on its own:
//
//   REFERENCE  — only where `repairPlan` says `backfill`. A `ready` reference is
//                never overwritten; that is what makes this repeatable.
//   SCHEMA     — wherever a database can be reached, `ready` included.
//   VERIFY     — `--verify` CONNECTS and reads the postconditions back. It used
//                to parse the flag and then do nothing but skip the writes,
//                which is a mode that reports on a run it never made.
//
// ── IDENTITY IS PROVED AGAINST THE MAPPING, NOT AGAINST THE DATABASE ─────────
//
// The first cut compared the catalog with `_meta` FROM THAT SAME DATABASE,
// which establishes that a database is internally consistent and says nothing
// whatever about whose it is — and it answered `ok: true, unproven: true` for a
// database holding a stranger's tables, which `main` then wrote a reference to.
// Driven before the fix: a database answering with `["orders","products"]` and
// no `_meta` came back `ok: true`.
//
// Identity is the AUTHORITATIVE MAPPING now, and it is a chain from the site's
// own slug to the live server:
//
//   site_project.slug = <this slug>  ->  its neon_conn
//   dbNameForSite(<this slug>)       ->  the database that connection must name
//   SELECT current_database()        ->  the server agreeing it is that one
//
// THE WRITER IS THE WALL, not the caller. `writeRef` refuses a proof that is
// not `proven: true` before it opens a socket, so no later edit of the loop can
// write around it — "a wall nobody can drive is a wall nobody is guarding", and
// this one is driven from both sides.
//
// REPEATABLE BY CONSTRUCTION. The reference write is fenced in the STORE to a
// row whose `neon_db` is still unset (`unsetDbFilter`), and the schema recovery
// only ADDS declarations the spec is missing — a second run finds nothing to do
// and says so. Nothing here creates a database, drops a table, deletes a row or
// rewrites a stored declaration.
//
// Needs SUPABASE_SERVICE_KEY. Run:
//   node scripts/backend-repair.mjs --preview
//   node scripts/backend-repair.mjs --apply --slug repairbench-1
//   node scripts/backend-repair.mjs --verify
import { repairPlan, backendState, unsetDbFilter, dbNameFromConn } from "../site-backend-state.mjs";
import { readSchemaState, reconcileSpec, RECOVER_QUERIES, META_SCHEMA_SQL } from "../site-schema-recover.mjs";
import { policiesFor, grantsFor } from "../site-rls.mjs";
import { connForDatabase, dbNameForSite, sqlQuery } from "../site-db.mjs";
// The ENGINE'S OWN `_meta` statement. A recovery meets databases that have
// tables and no `_meta` at all, and a fourth hand-written copy of two column
// definitions is how a repair creates a store the product cannot read.
import { META_TABLE_SQL } from "../site-schema.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";

/** The real emitters, handed to the reconcile so the verification is never against a copy. */
export const EMIT = { policiesFor, grantsFor };

/**
 * NOTHING THIS SCRIPT PRINTS MAY CARRY A CONNECTION STRING.
 *
 * Same rule and same implementation as `grants-backfill.mjs`, for the same
 * reason: the risk is not the deliberate log line, it is a driver error whose
 * MESSAGE quotes the URL it was handed. The rule is the URL's own grammar
 * rather than a list of secrets, because a list has to be kept and the one it
 * misses is the one that leaks. The HOST is deliberately kept — the owner asked
 * for database identities reported, and the credential is the half that must go.
 */
export function safeErr(e) {
  const text = String((e && (e.detail || e.message)) || e || "");
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]*@/gi, "$1***@");
}

export function parseArgs(argv) {
  const out = { mode: "preview", slug: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.mode = "apply";
    else if (a === "--preview") out.mode = "preview";
    else if (a === "--verify") out.mode = "verify";
    else if (a === "--slug") out.slug = String(argv[++i] || "");
  }
  return out;
}

const headers = (key, extra) => ({ apikey: key, Authorization: "Bearer " + key, ...(extra || {}) });

async function rest(key, path, init) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, { ...(init || {}), headers: headers(key, (init && init.headers) || {}) });
  if (!r.ok) throw new Error("supabase " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

/**
 * EVERY SITE AND ITS STATE, decided by the shared pure function so a repair run
 * by hand and a repair run by a build can never disagree about what a site is.
 *
 * `projectSlug` rides on every row and is the mapping's own half of the
 * identity chain: the `site_project` row is looked up BY SLUG, so carrying the
 * slug it came back under is what lets `proveIdentity` check that the
 * credential really belongs to this site rather than trusting the lookup.
 */
export async function survey(key, only = "") {
  const sites = await rest(key, "site_backends?select=slug,uid,neon_db&order=slug");
  const projects = await rest(key, "site_project?select=slug,neon_conn");
  const byProject = new Map(projects.map((p) => [p.slug, p]));
  const out = [];
  for (const site of sites) {
    if (only && site.slug !== only) continue;
    const project = byProject.get(site.slug) || null;
    const plan = repairPlan({ slug: site.slug, site, project, derive: dbNameForSite });
    const state = backendState({ site, project });
    // The database to CONNECT to: the recorded name where there is one, the
    // derived name where the reference is what is missing.
    const db = plan.act === "backfill" ? plan.db : state.db;
    // ── THE RESOLVED CONNECTION, BUILT ONCE (2026-09-15) ──────────────────
    //
    // `site_project.neon_conn` is the PROJECT's connection and its path is the
    // project's default database — `/neondb` on every real row. `main` built
    // its SQL client with `connForDatabase(site.conn, site.db)` and then handed
    // the raw `site.conn` to `repairSite` and `verifySite`, so identity was
    // asked about `/neondb` while every query went to `/site_<slug>`:
    //
    //   connection-does-not-name-the-intended-database (named neondb,
    //   expected site_repairbench_1)
    //
    // — a refusal before the database was asked anything, on every site there
    // is. One connection is resolved here and it is the one BOTH use, so the
    // thing proved and the thing queried cannot come apart again.
    let conn = null;
    if (project && db) { try { conn = connForDatabase(project.neon_conn, db); } catch { conn = null; } }
    out.push({
      ...plan,
      state: state.state,
      db,
      uid: site.uid,
      conn,
      // The project's own connection is kept for the record, and is NEVER what
      // a query or an identity check is given.
      projectConn: project ? project.neon_conn : null,
      projectSlug: project ? project.slug : null,
    });
  }
  return out;
}

/**
 * THE FIVE SITES THIS REPAIR IS FOR, BY NAME.
 *
 * The scope is a WALL IN THE SCRIPT, not a promise in a workflow input, because
 * an input is a thing somebody types and this is a thing that writes to
 * customers' databases. These are the five the survey found `incomplete` —
 * measured over the whole corpus, 27 of 27 recorded names equal
 * `dbNameForSite(slug)` and exactly these five carry a project row with a blank
 * `neon_db`. Three more sites are blank with NO project row and must not be
 * touched at all; every other site is `ready` and is nobody's business here.
 *
 * A NAME OFF THIS LIST IS REFUSED BY NAME rather than filtered out — a silent
 * drop reads exactly like "that site was already fine", which is the one answer
 * a person running a repair must never be given by accident.
 */
export const REPAIR_SITES = ["ashgrove-1", "fretwork-1", "northgroup-5", "repairbench-1", "washhouse-1"];

/**
 * THE SITES THE LOOP VISITS — in scope, and with a database.
 *
 * SPELLED ONCE AND EXPORTED, because this line IS the separation. It used to be
 * `rows.filter(r => r.act === "backfill")` inline in `main`, which visits only
 * the sites whose REFERENCE is missing — so the moment a reference was written
 * that site dropped out of the work list and its schema could never be
 * recovered by a rerun. A `ready` site is here for its schema; its reference is
 * skipped by name inside `repairSite`.
 *
 * TWO QUESTIONS, BOTH ASKED HERE: is this site in scope, and does it have a
 * database. The scope is asked FIRST, so a site outside it is never reached by
 * anything downstream whatever state it is in.
 */
export function workList(rows) {
  const scope = new Set(REPAIR_SITES);
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && scope.has(String(r.slug || "")))
    .filter((r) => r.state === "ready" || r.state === "incomplete");
}

/**
 * IS THIS REALLY THIS SITE'S DATABASE? — asked before the reference is written.
 *
 * Every link is from the AUTHORITATIVE MAPPING outward, and none of it is the
 * database's opinion of itself:
 *
 *   1. the `site_project` row was found under THIS slug, so the credential is
 *      this site's and not one inherited from a lookup that fell through;
 *   2. the connection built from it NAMES the database about to be recorded, so
 *      the row cannot end up naming a database nothing connects to;
 *   3. the SERVER agrees — `current_database()` read down that connection,
 *      which is the only link a pooler, a rewritten path or a copied
 *      credential cannot fake.
 *
 * ANY LINK THAT CANNOT BE ESTABLISHED IS `proven: false`. There is deliberately
 * no "probably" here: the previous shape answered `unproven: true` beside
 * `ok: true`, and the only caller read `ok`.
 */
export async function proveIdentity({ slug, expectDb, conn, projectSlug, sql } = {}) {
  const want = String(slug || "").toLowerCase();
  const db = String(expectDb || "");
  if (!want || !db) return { ok: false, proven: false, why: "no-slug-or-no-database-name" };
  if (String(projectSlug || "").toLowerCase() !== want) {
    return { ok: false, proven: false, why: "no-project-row-for-this-slug", projectSlug: projectSlug || null };
  }
  const named = dbNameFromConn(conn);
  if (!named || named !== db) {
    return { ok: false, proven: false, why: "connection-does-not-name-the-intended-database", named: named || "", expectDb: db };
  }
  const rows = await sql("SELECT current_database() AS db", []);
  const actual = String(((rows || [])[0] || {}).db || "");
  if (actual !== db) {
    return { ok: false, proven: false, why: "server-answers-a-different-database", actual, expectDb: db };
  }
  return { ok: true, proven: true, why: "project-row-for-this-slug-names-a-database-the-server-confirms", db: actual };
}

/**
 * WHAT THE DATABASE HOLDS, for the log — and it is NOT evidence of identity.
 *
 * Reported because "which tables" is what a person reading a preview wants to
 * see before approving a write. Kept out of `proveIdentity` on purpose: the
 * first cut made exactly this comparison the identity test, and comparing a
 * database's catalog with that database's own `_meta` establishes consistency,
 * never ownership.
 */
export async function describeContents(sql) {
  const st = await readSchemaState({ sql, scrub: safeErr });
  return {
    state: st.state,
    tables: st.tables,
    declared: st.spec && Array.isArray(st.spec.tables) ? st.spec.tables.map((t) => t && t.name).filter(Boolean) : [],
    missing: st.missing,
    why: st.why,
  };
}

/**
 * The reference write, fenced in the store — and REFUSED without proof.
 *
 * The refusal is here rather than at the call site because this is the only
 * function that can write, so a later edit of the loop cannot get past it and
 * a mutation that removes it has an observable effect from outside.
 */
export async function writeRef(key, slug, uid, db, proof) {
  if (!proof || proof.proven !== true) {
    return { wrote: false, refused: "identity-not-proven", why: (proof && proof.why) || "no-proof" };
  }
  const rows = await rest(key,
    `site_backends?slug=eq.${encodeURIComponent(slug)}&uid=eq.${encodeURIComponent(uid)}&${unsetDbFilter()}`,
    { method: "PATCH", headers: { "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ neon_db: db }) });
  return { wrote: Array.isArray(rows) && rows.length > 0, rows };
}

/**
 * The declaration repair, over one site's live database.
 *
 * FOUR ANSWERS, because "no stored spec" and "could not read the stored spec"
 * are not the same fact and the first cut returned one refusal for both. A
 * database with no `_meta` row and real tables is the state this repair exists
 * for — refusing it, as the first cut did, left the one table on the site
 * unrecovered and said nothing about it.
 */
export async function recoverSchema(sql, { prior = null, emit = EMIT } = {}) {
  const st = await readSchemaState({ sql, scrub: safeErr });
  if (!st.ok) return { ok: false, why: st.state + ":" + st.why, detail: st.detail || "" };
  // ABSENT TABLE AND ABSENT ROW ARE DIFFERENT FACTS, and the write needs the
  // difference: `INSERT INTO _meta` on a database that has no `_meta` fails
  // with `relation "_meta" does not exist`, which is what a recovery on exactly
  // the kind of site this repair is for met every time.
  const metaTable = st.why !== "no-meta-table";
  if (st.state === "empty") return { ok: true, changed: false, why: "empty", metaTable, kept: [], recovered: [], uncertain: [], ambiguous: [] };
  const live = { columns: st.columns, grants: [], policies: [], triggers: [] };
  try {
    const [grants, policies, triggers] = await Promise.all([
      sql(RECOVER_QUERIES.grants, []),
      sql(RECOVER_QUERIES.policies, []),
      sql(RECOVER_QUERIES.triggers, []),
    ]);
    live.grants = grants || []; live.policies = policies || []; live.triggers = triggers || [];
  } catch (e) {
    // WITHOUT THE PERMISSION SURFACE NOTHING CAN BE VERIFIED, so nothing may be
    // stored. Recovering against an empty grant list would derive `read:"none",
    // write:"none"` for every table on the site.
    return { ok: false, why: "permissions-unreadable", detail: safeErr(e) };
  }
  return { ok: true, ...reconcileSpec({ stored: st.spec, live, prior, emit }), why: st.state, metaTable };
}

/**
 * ONE SITE, THREE INDEPENDENT ANSWERS — exported so the whole decision can be
 * driven without Supabase, a Neon credential or a `main`.
 *
 * `ref` and `schema` never gate one another: a reference that could not be
 * written must not stop a recovery that can be, and a recovery that failed must
 * not undo a reference that succeeded. The rerun is what finishes the job, and
 * it can only finish it because a `ready` site is still visited here.
 */
export async function repairSite({ site, sql, write, mode = "preview", prior = null, emit = EMIT } = {}) {
  const report = { slug: site.slug, state: site.state, db: site.db, ref: null, schema: null, identity: null };

  // IDENTITY FIRST, and it gates BOTH tasks — a database we cannot prove is
  // this site's is one we must neither record nor write a schema into.
  try {
    report.identity = await proveIdentity({ slug: site.slug, expectDb: site.db, conn: site.conn, projectSlug: site.projectSlug, sql });
  } catch (e) {
    report.identity = { ok: false, proven: false, why: "database-did-not-answer", detail: safeErr(e) };
  }
  if (!report.identity.proven) {
    report.ref = { act: "refused", why: report.identity.why };
    report.schema = { act: "refused", why: report.identity.why };
    return report;
  }

  // ── THE REFERENCE ──────────────────────────────────────────────────────
  if (site.act !== "backfill") {
    report.ref = { act: "skip", why: site.state === "ready" ? "already-recorded" : site.why };
  } else if (mode !== "apply") {
    report.ref = { act: "would-write", db: site.db };
  } else {
    try {
      const w = await write(site.slug, site.uid, site.db, report.identity);
      report.ref = w.refused ? { act: "refused", why: w.refused } : { act: w.wrote ? "written" : "already-set", db: site.db };
    } catch (e) { report.ref = { act: "failed", why: safeErr(e) }; }
  }

  // ── THE SCHEMA, decided on its own ─────────────────────────────────────
  let rec;
  try { rec = await recoverSchema(sql, { prior, emit }); }
  catch (e) { rec = { ok: false, why: "threw", detail: safeErr(e) }; }
  if (!rec.ok) { report.schema = { act: "failed", why: rec.why, detail: rec.detail || "" }; return report; }
  report.schema = {
    act: rec.changed ? (mode === "apply" ? "recovered" : "would-recover") : "nothing-missing",
    recovered: rec.recovered || [], uncertain: rec.uncertain || [], ambiguous: rec.ambiguous || [], kept: rec.kept || [],
  };
  if (rec.changed && mode === "apply") {
    try {
      // THE METADATA TABLE FIRST, and only where it is absent. `CREATE TABLE IF
      // NOT EXISTS` is idempotent, so this is safe either way; asking first is
      // what keeps a run that has nothing to create from issuing DDL at all.
      // It touches no application table: `_meta` is the platform's own store.
      if (!rec.metaTable) { await sql(META_TABLE_SQL, []); report.schema.created = "_meta"; }
      await sql("INSERT INTO _meta (k,v) VALUES ('schema', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v", [JSON.stringify(rec.spec)]);
    } catch (e) { report.schema = { ...report.schema, act: "failed", why: "write-failed", detail: safeErr(e) }; }
  }
  return report;
}

/**
 * THE POSTCONDITIONS, READ BACK — `--verify` connects and inspects rather than
 * trusting what the writes answered.
 *
 * Three checks, each the thing an apply claimed: the reference is recorded and
 * is the derived name, the database that name resolves to answers and agrees
 * it is that database, and the stored spec now declares every application table
 * the catalog holds — except the ones the recovery NAMED as uncertain, which is
 * the honest exception rather than a pass.
 */
export async function verifySite({ site, sql } = {}) {
  const out = { slug: site.slug, ok: false, checks: [] };
  const add = (name, ok, detail) => { out.checks.push({ name, ok, detail: detail || "" }); };

  const want = dbNameForSite(site.slug);
  add("reference recorded", site.state === "ready", site.state === "ready" ? String(site.db) : "state is " + site.state);
  add("reference is the derived name", String(site.db || "") === want, `${site.db || "(none)"} vs ${want}`);

  let id;
  try { id = await proveIdentity({ slug: site.slug, expectDb: site.db, conn: site.conn, projectSlug: site.projectSlug, sql }); }
  catch (e) { id = { proven: false, why: "database-did-not-answer", detail: safeErr(e) }; }
  add("database answers and is this site's", !!id.proven, id.why + (id.detail ? " — " + id.detail : ""));

  if (id.proven) {
    const st = await describeContents(sql);
    add("stored schema readable", st.state !== "unreadable", st.state + " (" + st.why + ")");
    add("every live table declared", st.missing.length === 0,
      st.missing.length ? "missing: " + JSON.stringify(st.missing) : `${st.tables.length} table(s), all declared`);
  }
  out.ok = out.checks.every((c) => c.ok);
  return out;
}

const fmt = (r) => JSON.stringify(r);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) { console.error("SUPABASE_SERVICE_KEY is not set"); process.exit(2); }
  console.log(`mode: ${args.mode}${args.slug ? "  slug: " + args.slug : ""}`);
  console.log(`scope: ${REPAIR_SITES.join(", ")}`);
  // A SLUG OFF THE LIST IS REFUSED BY NAME AND NOTHING RUNS. Filtering it out
  // would print "nothing to do", which reads as "that site was already fine".
  if (args.slug && !REPAIR_SITES.includes(args.slug)) {
    console.error(`${args.slug} is not one of the five sites this repair is for — refusing, nothing was read or written`);
    process.exit(2);
  }

  const rows = await survey(key, args.slug);
  const reachable = workList(rows);
  const byState = {};
  for (const r of rows) byState[r.state] = (byState[r.state] || 0) + 1;
  console.log(`${rows.length} site(s): ${reachable.length} with a database ` +
    `(${Object.entries(byState).map(([k, v]) => k + " " + v).join(", ") || "none"})`);
  // IN VERIFY MODE "nothing to do" IS NOT A PASS — a named slug that matched no
  // reachable site is a postcondition that FAILED, because the site was
  // supposed to have a database by now. It falls THROUGH to the tally rather
  // than returning with its own copy of the exit rule: one place decides, and
  // `!verified` there is load-bearing instead of a second belt.
  if (!reachable.length) {
    console.log("nothing to do.");
    if (args.mode !== "verify") return;
    console.log(args.slug ? `VERIFY FAILED: ${args.slug} has no reachable database.` : "VERIFY FAILED: nothing was verified.");
  }

  const write = (slug, uid, db, proof) => writeRef(key, slug, uid, db, proof);
  let refs = 0, schemas = 0, refused = 0, failed = 0, verified = 0;

  for (const site of reachable) {
    // ONE CONNECTION, RESOLVED IN `survey`. Re-resolving here is what let the
    // identity check and the queries address different databases.
    const sql = (q, p) => sqlQuery(site.conn, q, p || []);

    if (args.mode === "verify") {
      const v = await verifySite({ site, sql });
      console.log(`${site.slug}: ${v.ok ? "VERIFIED" : "NOT VERIFIED"}`);
      for (const c of v.checks) console.log(`    ${c.ok ? "ok  " : "FAIL"} ${c.name} — ${c.detail}`);
      if (v.ok) verified++; else failed++;
      continue;
    }

    const r = await repairSite({ site, sql, write, mode: args.mode });
    console.log(`${site.slug} [${r.state}]: identity ${r.identity.proven ? "PROVEN" : "NOT PROVEN"} (${r.identity.why})`);
    if (!r.identity.proven) { refused++; console.log(`    nothing written — the reference and the schema both need this`); continue; }

    console.log(`    reference: ${r.ref.act}${r.ref.db ? " " + r.ref.db : ""}${r.ref.why ? " (" + r.ref.why + ")" : ""}`);
    if (r.ref.act === "written") refs++;
    if (r.ref.act === "failed" || r.ref.act === "refused") failed++;

    const s = r.schema;
    if (s.act === "failed") { failed++; console.log(`    schema: CANNOT RECONCILE (${s.why})${s.detail ? " — " + s.detail : ""}`); continue; }
    if (s.act === "nothing-missing") { console.log(`    schema: nothing missing (${s.kept.length} declared)`); }
    else {
      console.log(`    schema: ${s.act} ${fmt(s.recovered.map((x) => x.name + "[" + x.flags.join(",") + "]"))}`);
      if (s.act === "recovered") schemas++;
    }
    if (s.uncertain && s.uncertain.length) console.log(`    schema: LEFT ALONE (would change behaviour): ${fmt(s.uncertain.map((u) => u.name + " — " + u.why))}`);
    if (s.ambiguous && s.ambiguous.length) console.log(`    schema: LEFT ALONE (access not derivable): ${fmt(s.ambiguous.map((a) => a.name))}`);
  }

  // ── THE EXIT CODE IS THE ANSWER (2026-09-15) ────────────────────────────
  //
  // `--verify` printed "0 verified, 1 not verified" and exited 0. Anything
  // reading this as a command — a shell, a runbook, a workflow step — read that
  // as a pass. A verification that cannot fail the process is a report, not a
  // verification.
  if (args.mode === "verify") {
    console.log(`\n${verified} verified, ${failed} not verified.`);
    if (failed || !verified) process.exitCode = 1;
    return;
  }
  console.log(`\n${refs} reference(s) written, ${schemas} schema(s) recovered, ${refused} refused on identity, ${failed} failed.`);
  if (args.mode === "apply") {
    console.log("re-run with --verify to read the result back.");
    // AN APPLY THAT REFUSED OR FAILED IS NOT A SUCCESSFUL APPLY. A preview is a
    // report and exits 0 whatever it found; an apply is an action.
    if (failed || refused) process.exitCode = 1;
  } else console.log("(preview — nothing written. --apply writes.)");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(safeErr((e && e.stack) || e)); process.exit(1); });
}

// `META_SCHEMA_SQL` is re-exported so the guard can assert the script and the
// module read `_meta` with ONE query rather than two spellings of it — the
// recorded "assert the property, not the spelling", met from the answering side
// when a fixture pinned to `WHERE k = 'schema'` fell through for a caller that
// wrote `WHERE k='schema'`.
export { META_SCHEMA_SQL };

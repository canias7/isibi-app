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
// ── AND THE TWO CAN BE APPROVED SEPARATELY (`--apply-reference`) ─────────────
//
// Separating the TASKS is not the same as bounding a RUN. `--apply` still does
// both, and a preview before it bounds nothing, because `repairSite` plans and
// writes in one pass — there is no moment in between for a person to refuse.
// `--apply-reference` is the bound itself: identity is proved by the same
// checks, the reference is written under the same conditional fence, and the
// schema is COMPUTED, REPORTED and NOT WRITTEN. `WRITES_META` is the single
// list that decides, so the narrow mode cannot acquire the wider power by an
// edit somewhere else.
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
//   node scripts/backend-repair.mjs --apply-reference --slug repairbench-1
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

// ── WHAT EACH MODE MAY WRITE, IN ONE PLACE ──────────────────────────────────
//
// Owner, 2026-09-15: *"Keep the approval limited to the one reference write.
// Another preview does not enforce that boundary, and retrospective checking
// cannot undo an unauthorized schema change."*
//
// That is right, and the reason it is right is structural: `repairSite`
// computes the plan and writes in the SAME pass, so there is no moment between
// "what would change" and "it changed" for a person to stand in. A preview
// bounds nothing about the run after it. The boundary has to be IN the run.
//
// `apply-reference` is that boundary as a MODE rather than as a second input.
// A mode is one selection with one meaning; a `--reference-only` flag beside
// `--apply` would be a two-field invariant, and this repository's own rule is
// that an input cannot be the wall — an input is a thing somebody types, and a
// forgotten one fails OPEN.
//
// BOTH GATES READ THESE TWO LISTS AND NOTHING ELSE, so the question "may this
// mode write X" has exactly one answer per X and a mutant widening either list
// is a red run rather than a silent change of scope.
export const WRITES_REFERENCE = Object.freeze(["apply", "apply-reference"]);
export const WRITES_META = Object.freeze(["apply"]);
/** May this mode write `site_backends.neon_db`? */
export const writesReference = (mode) => WRITES_REFERENCE.includes(mode);
/** May this mode create or update `_meta`? `apply-reference` MUST NOT. */
export const writesMeta = (mode) => WRITES_META.includes(mode);

/**
 * A READ-ONLY AGGREGATE, SO AN EXPECTED RESULT CAN BE ESTABLISHED WITHOUT
 * TOUCHING THE DATA (2026-09-16, owner: *"check whether the existing
 * credentialed verification workflow can run a narrowly scoped, read-only
 * aggregate… Return dates and counts only, no customer details."*).
 *
 * WHY IT LIVES HERE RATHER THAN IN A NEW SCRIPT: this tool already holds the
 * credential, the scope wall (`REPAIR_SITES`) and the identity chain, and all
 * three are proven. A second script would be a second copy of each.
 *
 * **IT WRITES NOTHING BY CONSTRUCTION, not by care.** `counts` is on NEITHER
 * `WRITES_REFERENCE` nor `WRITES_META`, and both gates are `includes` over a
 * frozen list, so a mode they have never heard of writes nothing without any
 * new check being added. The census asserts that, because it is the property
 * that makes this mode safe to add at all.
 *
 * **AND IT CANNOT RETURN A NAME, WHICH IS A PROPERTY RATHER THAN A PROMISE.**
 * The one column it may group by has to be a DATE OR TIME type, asked of the
 * catalog — a positive, type-derived rule, never a deny-list of column names
 * (this repository's recorded "a negative list is the wrong wall"). So
 * `customer_name` is refused by the tool and not by the caller's discipline,
 * and the answer is a date and a count with nowhere for anything else to sit.
 */
export const COUNTS_TYPES = Object.freeze(["date", "timestamp", "time"]);
/** A bare, unquoted-safe SQL identifier. */
const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * May this aggregate run, and over what? PURE, so every refusal is drivable
 * with no database at all — which is the half that decides whether a
 * credentialed run is worth pressing.
 *
 * `inventory` is `columnInventory`'s answer: `{table: ["name type", …]}`. The
 * TWO checks are not redundant — catalog membership answers "is there such a
 * column", and `PLAIN_NAME` answers "is its name safe to interpolate" — and a
 * real Postgres identifier may legally contain characters that make the second
 * question a different one from the first.
 */
export function countsPlan(inventory, table, column) {
  const inv = inventory && typeof inventory === "object" ? inventory : {};
  const t = typeof table === "string" ? table : "";
  const c = typeof column === "string" ? column : "";
  if (!t || !c) return { ok: false, why: "need-table-and-column" };
  if (!Object.prototype.hasOwnProperty.call(inv, t)) {
    return { ok: false, why: "no-such-table", detail: t, tables: Object.keys(inv).sort() };
  }
  const hit = (inv[t] || []).find((e) => String(e).split(" ")[0] === c);
  if (!hit) return { ok: false, why: "no-such-column", detail: `${t}.${c}`, columns: (inv[t] || []).map((e) => String(e).split(" ")[0]) };
  const ty = String(hit).slice(c.length + 1).trim().toLowerCase();
  if (!COUNTS_TYPES.some((p) => ty.startsWith(p))) {
    return { ok: false, why: "not-a-date-column", detail: `${t}.${c} is ${ty || "(untyped)"}`, allowed: [...COUNTS_TYPES] };
  }
  if (!PLAIN_NAME.test(t) || !PLAIN_NAME.test(c)) return { ok: false, why: "name-not-plain", detail: `${t}.${c}` };
  // GROUP BY 1 / ORDER BY 2 DESC, 1 — the ordinals, so the emitted text names
  // each identifier exactly once and the tie-break is deterministic, which is
  // what makes "busiest first" a reproducible reading rather than a lucky one.
  return { ok: true, table: t, column: c, type: ty,
    sql: `SELECT "${c}" AS v, COUNT(*)::bigint AS n FROM "${t}" GROUP BY 1 ORDER BY 2 DESC, 1` };
}

/** Run the planned aggregate. No parameters, because the plan has already
 *  established both identifiers against the catalog and nothing else varies. */
export async function countsOf(sql, plan) {
  if (!plan || plan.ok !== true) return { ok: false, why: (plan && plan.why) || "no-plan" };
  const rows = (await sql(plan.sql, [])) || [];
  const out = rows.map((r) => ({ value: r && r.v === null ? null : String(r && r.v), count: Number(r && r.n) || 0 }));
  return { ok: true, rows: out, total: out.reduce((a, r) => a + r.count, 0), groups: out.length };
}

/**
 * EVERY MODE THIS SCRIPT HAS, IN ONE PLACE — and `parseArgs` DERIVES its flags
 * from it rather than listing them a second time.
 *
 * The census in `test/backend-repair.test.mjs` compares this list with the
 * workflow form's own `options:` BOTH WAYS, so a mode that exists and is not
 * offered (unreachable by the only person who can press it) and a mode offered
 * and not implemented (a button that answers `preview`) are each a red run.
 * That guard used to pin the option list as a LITERAL and went red on the first
 * honest addition — this repository's own "assert the property, not the
 * spelling", met in the guard written for the write boundary.
 */
export const MODES = Object.freeze(["preview", "apply-reference", "apply", "verify", "counts"]);

export function parseArgs(argv) {
  const out = { mode: "preview", slug: "", table: "", column: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const named = a.startsWith("--") && MODES.includes(a.slice(2)) ? a.slice(2) : "";
    if (named) out.mode = named;
    else if (a === "--slug") out.slug = String(argv[++i] || "");
    else if (a === "--table") out.table = String(argv[++i] || "");
    else if (a === "--column") out.column = String(argv[++i] || "");
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
    // THE COLUMNS WERE ALWAYS READ AND NEVER CARRIED OUT (2026-09-16).
    // `RECOVER_QUERIES.columns` is `information_schema.columns` joined to the
    // base tables, so this reader has held every column of every application
    // table since it was written — and dropped them one hop later, which left
    // "no new columns" with nothing authoritative behind it. A per-NAME probe
    // from outside is exact per name and is NOT an enumeration; this is.
    columns: Array.isArray(st.columns) ? st.columns : [],
    declared: st.spec && Array.isArray(st.spec.tables) ? st.spec.tables.map((t) => t && t.name).filter(Boolean) : [],
    missing: st.missing,
    why: st.why,
  };
}

/**
 * The live column inventory, `{ table: ["name type", …] }`, from the catalog.
 *
 * A REPORT AND NEVER A CHECK. There is no expectation to compare it against —
 * the whole point is that a person holds a BEFORE and an AFTER beside each
 * other — so it must not touch `out.ok`, or a verification would start failing
 * on a site whose schema is perfectly fine and merely different from last week.
 */
export function columnInventory(rows) {
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const t = r && typeof r.t === "string" ? r.t : "";
    const c = r && typeof r.c === "string" ? r.c : "";
    if (!t || !c) continue;
    (out[t] = out[t] || []).push(r.ty ? `${c} ${r.ty}` : c);
  }
  return out;
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
  } else if (!writesReference(mode)) {
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
    act: rec.changed ? (writesMeta(mode) ? "recovered" : "would-recover") : "nothing-missing",
    // WITHHELD IS NOT THE SAME AS NOT-YET. A preview reports what an apply
    // would do; `apply-reference` reports what it DELIBERATELY DID NOT DO on a
    // run that wrote something else, and those two need different sentences or
    // the customer of this output cannot tell "come back and apply" from
    // "this run was scoped to exclude that".
    withheld: rec.changed && !writesMeta(mode) && mode === "apply-reference" ? "reference-only" : "",
    recovered: rec.recovered || [], uncertain: rec.uncertain || [], ambiguous: rec.ambiguous || [], kept: rec.kept || [],
  };
  if (rec.changed && writesMeta(mode)) {
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
    // THE INVENTORY RIDES BESIDE THE CHECKS AND IS NOT ONE OF THEM. A verify
    // that FAILED because a column list differs from some remembered one would
    // be asserting a thing nobody declared; what this is for is a person
    // holding a before and an after beside each other and reading the diff.
    out.inventory = columnInventory(st.columns);
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
    // `counts` joins `verify` here for the same reason: a run asked for a
    // number that reached no database must not exit 0 with a blank where the
    // number goes.
    if (args.mode !== "verify" && args.mode !== "counts") return;
    // THE SENTENCE NAMES THE MODE THAT ASKED, derived from `args.mode` rather
    // than written per branch: a `counts` run that reached nothing must not
    // report itself as a failed verification, and a verification must not lose
    // its own word to a mode added beside it.
    console.log(`${args.mode.toUpperCase()} FAILED: ` +
      (args.slug ? `${args.slug} has no reachable database.` : "nothing was read."));
  }

  const write = (slug, uid, db, proof) => writeRef(key, slug, uid, db, proof);
  let refs = 0, schemas = 0, refused = 0, failed = 0, verified = 0, withheldSchemas = 0;

  for (const site of reachable) {
    // ONE CONNECTION, RESOLVED IN `survey`. Re-resolving here is what let the
    // identity check and the queries address different databases.
    const sql = (q, p) => sqlQuery(site.conn, q, p || []);

    if (args.mode === "verify") {
      const v = await verifySite({ site, sql });
      console.log(`${site.slug}: ${v.ok ? "VERIFIED" : "NOT VERIFIED"}`);
      for (const c of v.checks) console.log(`    ${c.ok ? "ok  " : "FAIL"} ${c.name} — ${c.detail}`);
      // PRINTED WHENEVER IT WAS READ, pass or fail — a NOT VERIFIED run is
      // exactly when somebody wants to see what is really there. Absent means
      // the catalog was never reached (identity refused), which is a different
      // thing from a site with no tables and is why this is not a blank line.
      if (v.inventory) {
        const names = Object.keys(v.inventory).sort();
        console.log(`    live columns (${names.length} table(s), from information_schema):`);
        for (const t of names) console.log(`      ${t}: ${JSON.stringify(v.inventory[t])}`);
      }
      if (v.ok) verified++; else failed++;
      continue;
    }

    if (args.mode === "counts") {
      // IDENTITY FIRST, exactly as the verify does. An aggregate read out of a
      // database nobody proved belongs to this site is a number about somebody
      // else's rows, which is worse than no number at all.
      let id;
      try { id = await proveIdentity({ slug: site.slug, expectDb: site.db, conn: site.conn, projectSlug: site.projectSlug, sql }); }
      catch (e) { id = { proven: false, why: "database-did-not-answer", detail: safeErr(e) }; }
      console.log(`${site.slug}: identity ${id.proven ? "PROVEN" : "NOT PROVEN"} (${id.why}${id.detail ? " — " + id.detail : ""})`);
      if (!id.proven) { failed++; continue; }

      const st = await describeContents(sql);
      const plan = countsPlan(columnInventory(st.columns), args.table, args.column);
      if (!plan.ok) {
        // A REFUSAL IS A SENTENCE AND A NONZERO EXIT. "Nothing came back"
        // and "we refused to ask" are two readings a blank collapses.
        console.log(`    REFUSED (${plan.why})${plan.detail ? " — " + plan.detail : ""}`);
        if (plan.tables) console.log(`    tables here: ${JSON.stringify(plan.tables)}`);
        if (plan.columns) console.log(`    columns there: ${JSON.stringify(plan.columns)}`);
        if (plan.allowed) console.log(`    only a date or time column may be grouped: ${JSON.stringify(plan.allowed)}`);
        failed++; continue;
      }
      console.log(`    reading: ${plan.sql}`);
      let agg;
      try { agg = await countsOf(sql, plan); }
      catch (e) { console.log(`    FAILED — ${safeErr(e)}`); failed++; continue; }
      for (const r of agg.rows) console.log(`      ${r.value === null ? "(no date)" : r.value}  ${r.count}`);
      console.log(`    ${agg.groups} group(s), ${agg.total} row(s) in total`);
      verified++;
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
      // REPORTED, NOT APPLIED — and said in its own words rather than left to
      // be inferred from the mode line at the top. This is the one line that
      // tells a reader the run found schema work and chose not to do it.
      if (s.withheld === "reference-only") {
        console.log(`    schema: NOT APPLIED — this run is reference-only; no _meta was created or updated`);
        console.log(`    schema: to apply it, re-run with mode apply (a separate, separately approved decision)`);
        withheldSchemas++;
      }
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
  // THE AGGREGATE EXITS THE SAME WAY, and for the reason the `--verify` defect
  // taught: a read that refused or could not run must not be readable as a
  // successful read of nothing.
  if (args.mode === "counts") {
    console.log(`\n${verified} read, ${failed} not read. (read-only: this mode writes nothing.)`);
    if (failed || !verified) process.exitCode = 1;
    return;
  }
  console.log(`\n${refs} reference(s) written, ${schemas} schema(s) recovered, ${refused} refused on identity, ${failed} failed.`);
  if (withheldSchemas) console.log(`${withheldSchemas} schema(s) REPORTED AND NOT APPLIED (reference-only).`);
  // AN APPLY THAT REFUSED OR FAILED IS NOT A SUCCESSFUL APPLY, and that is true
  // of the narrow apply too — it writes, so it is an action and not a report.
  // A WITHHELD SCHEMA IS NOT A FAILURE: withholding is what was asked for, so
  // it is printed loudly and changes no exit code.
  if (writesReference(args.mode)) {
    console.log(`re-run with --verify to read the result back.`);
    if (failed || refused) process.exitCode = 1;
  } else console.log("(preview — nothing written. --apply writes; --apply-reference writes only the reference.)");
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

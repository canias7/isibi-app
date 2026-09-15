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
// READ-ONLY BY DEFAULT. `--preview` writes nothing and is what runs with no
// mode given. Every write is behind `--apply`, and `--verify` re-reads
// afterwards rather than trusting what the writes answered.
//
// IT VERIFIES IDENTITY BEFORE IT WRITES ANYTHING, which is the owner's own
// condition. A site is repaired only when ALL of:
//   * `repairPlan` says `backfill` — `site_backends` has no name AND
//     `site_project` has a row. `ready` and `none` are skipped BY NAME, so this
//     can never overwrite a valid setting or invent a database for a
//     frontend-only site.
//   * the derived database ANSWERS. `dbNameForSite(slug)` is a derivation, and a
//     name that derives is not a database that exists — so it is connected to
//     and asked, and a site that will not answer is reported and left alone.
//   * the objects it holds LOOK like this site's. A database that answers but
//     holds none of the site's tables is not evidence of identity, and writing
//     the reference then would point the platform at the wrong data.
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
import { repairPlan, backendState, unsetDbFilter } from "../site-backend-state.mjs";
import { RECOVER_QUERIES, reconcileSpec } from "../site-schema-recover.mjs";
import { connForDatabase, dbNameForSite, sqlQuery } from "../site-db.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";

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
    out.push({ ...plan, uid: site.uid, conn: project ? project.neon_conn : null });
  }
  return out;
}

/**
 * IS THIS REALLY THIS SITE'S DATABASE? — asked before the reference is written.
 *
 * Two questions, and the second is the one that matters. Answering at all proves
 * the name resolves to a live database; holding tables this site's own schema
 * declares proves it is the RIGHT one. A database that answers and is empty is
 * `unproven` rather than `no` — a site provisioned and never applied to is
 * exactly that, and it is legitimate — but it is reported so the difference is
 * never silently rounded to "verified".
 */
export async function proveIdentity(sql) {
  const objects = await sql(RECOVER_QUERIES.columns, []);
  const tables = [...new Set((objects || []).map((r) => r.t).filter((n) => n && !/^_/.test(n)))];
  let stored = null;
  try {
    const rows = await sql("SELECT v FROM _meta WHERE k = 'schema'", []);
    const row = (rows || [])[0];
    if (row && row.v) stored = JSON.parse(row.v);
  } catch { stored = null; }
  const declared = (stored && Array.isArray(stored.tables) ? stored.tables : []).map((t) => t && t.name).filter(Boolean);
  const overlap = declared.filter((n) => tables.includes(n));
  if (declared.length && overlap.length) return { ok: true, why: "declared-tables-present", tables, declared, overlap };
  if (!tables.length && !declared.length) return { ok: true, why: "empty-but-answering", unproven: true, tables, declared, overlap };
  if (!declared.length) return { ok: true, why: "tables-present-no-stored-spec", unproven: true, tables, declared, overlap };
  return { ok: false, why: "stored-spec-names-none-of-these-tables", tables, declared, overlap };
}

/** The reference write, fenced in the store. Answers what really changed. */
export async function writeRef(key, slug, uid, db) {
  const rows = await rest(key,
    `site_backends?slug=eq.${encodeURIComponent(slug)}&uid=eq.${encodeURIComponent(uid)}&${unsetDbFilter()}`,
    { method: "PATCH", headers: { "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ neon_db: db }) });
  return { wrote: Array.isArray(rows) && rows.length > 0, rows };
}

/** The declaration repair, over one site's live database. */
export async function recoverSchema(sql) {
  const [columns, grants, policies] = await Promise.all([
    sql(RECOVER_QUERIES.columns, []),
    sql(RECOVER_QUERIES.grants, []),
    sql(RECOVER_QUERIES.policies, []),
  ]);
  let stored = null;
  try {
    const rows = await sql("SELECT v FROM _meta WHERE k = 'schema'", []);
    const row = (rows || [])[0];
    if (row && row.v) stored = JSON.parse(row.v);
  } catch { stored = null; }
  // A STORED SPEC WE COULD NOT READ IS NOT AN EMPTY ONE. Recovering against
  // `null` would append every live table to a spec that may already declare
  // them, which is the run-47 defect pointed the other way.
  if (!stored) return { ok: false, why: "stored-spec-unreadable" };
  return { ok: true, ...reconcileSpec({ stored, live: { columns, grants, policies } }) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) { console.error("SUPABASE_SERVICE_KEY is not set"); process.exit(2); }
  console.log(`mode: ${args.mode}${args.slug ? "  slug: " + args.slug : ""}`);

  const rows = await survey(key, args.slug);
  const doing = rows.filter((r) => r.act === "backfill");
  const skipped = rows.filter((r) => r.act !== "backfill");
  const byState = {};
  for (const r of skipped) byState[r.state] = (byState[r.state] || 0) + 1;
  console.log(`${rows.length} site(s): ${doing.length} to repair, ${skipped.length} skipped ` +
    `(${Object.entries(byState).map(([k, v]) => k + " " + v).join(", ") || "none"})`);
  if (!doing.length) { console.log("nothing to do."); return; }

  let repaired = 0, refused = 0;
  for (const site of doing) {
    const sql = (q, p) => sqlQuery(connForDatabase(site.conn, site.db), q, p || []);
    let id;
    try { id = await proveIdentity(sql); }
    catch (e) { console.log(`${site.slug}: REFUSED — ${site.db} did not answer (${safeErr(e)})`); refused++; continue; }
    if (!id.ok) {
      console.log(`${site.slug}: REFUSED — ${site.db} answers but is not this site's database (${id.why}; holds ${JSON.stringify(id.tables)}, spec declares ${JSON.stringify(id.declared)})`);
      refused++; continue;
    }
    console.log(`${site.slug}: identity ${id.unproven ? "UNPROVEN" : "verified"} (${id.why}) — ${site.db} holds ${JSON.stringify(id.tables)}`);

    const rec = await recoverSchema(sql);
    if (!rec.ok) console.log(`  schema: cannot reconcile (${rec.why}) — leaving the declaration alone`);
    else if (!rec.changed) console.log(`  schema: nothing missing (${rec.kept.length} table(s) declared)`);
    else console.log(`  schema: would recover ${JSON.stringify(rec.recovered)}${rec.ambiguous.length ? "; ambiguous, left alone: " + JSON.stringify(rec.ambiguous) : ""}`);

    if (args.mode !== "apply") { console.log(`  (preview — nothing written)`); continue; }
    const w = await writeRef(key, site.slug, site.uid, site.db);
    console.log(`  reference: ${w.wrote ? "written " + site.db : "already set — nothing written"}`);
    if (rec.ok && rec.changed) {
      await sql("INSERT INTO _meta (k,v) VALUES ('schema', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v", [JSON.stringify(rec.spec)]);
      console.log(`  schema: recovered ${rec.recovered.map((r) => r.name).join(", ")}`);
    }
    repaired++;
  }
  console.log(`\n${repaired} repaired, ${refused} refused, ${doing.length - repaired - refused} previewed.`);
  if (args.mode === "apply") console.log("re-run with --verify to read the result back.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(safeErr((e && e.stack) || e)); process.exit(1); });
}

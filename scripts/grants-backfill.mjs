// Re-issue every site's client write grants, so an EXISTING site gets the
// column-scoped ones.
//
// WHY A BACKFILL EXISTS AT ALL. `applySiteSchema` re-issues REVOKE-then-GRANT
// for every table in `spec.tables` on every call, so one ordinary schema touch
// puts a site right. But it has exactly three callers and all three are
// customer-driven — the build path, the `rules` rung and the addon route — and
// `site_rebuild` republishes the bundle WITHOUT calling it. There is no cron and
// no migration. So a site built before the fix keeps its table-wide write grants
// until its owner next changes something schema-shaped, which may be never.
//
// WHAT IT DOES AND DELIBERATELY DOES NOT DO. Grants only: the REVOKE pair and
// the GRANTs `grantsFor` emits, per table, and nothing else. No DDL, no
// `CREATE TABLE IF NOT EXISTS`, no `ALTER`, no trigger, no policy, no `_meta`
// write. That is the whole point of it being targeted rather than "call
// applySiteSchema on everything": the wide path would re-run a hundred
// statements per site to change two, and every one of those is a chance to
// touch data this is supposed to leave alone.
//
// THE REVOKE IS NOT INCIDENTAL, it is the mechanism. Postgres keeps a
// table-level and a column-level grant side by side, and the table-level one
// still covers every column — so adding a narrow grant beside the old wide one
// changes NOTHING. `grantsFor` emits `REVOKE ALL ON <t> FROM anonymous` and the
// same for `authenticated` ahead of every grant it makes, and the Postgres
// documentation is explicit that revoking a table privilege automatically
// revokes that role's column privileges on it too. Those two facts are what
// make re-issuing the set idempotent and what make it reach an old site.
//
// READ-ONLY BY DEFAULT. `--preview` is the default mode and writes nothing.
// `--apply` is the only mode that issues a statement, and it records the
// before-state first so `--rollback` can put a site back exactly as it was.
//
// Needs SUPABASE_SERVICE_KEY (to list the sites and read their connections).
// Run:  node scripts/grants-backfill.mjs --preview
//       node scripts/grants-backfill.mjs --apply --slug fretwork-1
//       node scripts/grants-backfill.mjs --verify
//       node scripts/grants-backfill.mjs --rollback <before-state.json>
import { grantsFor, writableColumns, DATA_API_ROLES } from "../site-rls.mjs";
import { resolveAccess } from "../site-access.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";

/** ACL letters Postgres records, and the privilege each one is. */
const ACL_LETTERS = { r: "SELECT", a: "INSERT", w: "UPDATE", d: "DELETE", D: "TRUNCATE", x: "REFERENCES", t: "TRIGGER" };

/**
 * NOTHING THIS SCRIPT PRINTS MAY CARRY A CONNECTION STRING.
 *
 * It holds one per site — `site_project.neon_conn`, a live database credential —
 * and never logs it deliberately. The risk is the accidental path: a driver
 * error, or a `fetch` failure, whose MESSAGE quotes the URL it was given. That
 * is not a hypothetical shape; it is how credentials usually reach a log.
 *
 * So every message that reaches the console goes through here first, and the
 * rule is the URL's own grammar rather than a list of secrets to look for: any
 * `scheme://user:password@` becomes `scheme://***@`. A list of what to redact is
 * a list that has to be kept, and the one it misses is the one that leaks.
 */
export function safeErr(e) {
  const text = String((e && (e.detail || e.message)) || e || "");
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]*@/gi, "$1***@");
}
/**
 * The roles Neon's Data API runs a request as. Nothing else is touched.
 *
 * DERIVED from the emitter's own list rather than typed again: a third role
 * added there and forgotten here would be one this backfill silently leaves
 * holding whatever it holds, which is the failure it exists to prevent.
 */
export const CLIENT_ROLES = Object.values(DATA_API_ROLES);

/**
 * What a site's tables currently grant the two client roles, read from the
 * catalogue rather than inferred from the spec.
 *
 * TABLE-LEVEL AND COLUMN-LEVEL ARE READ APART, and that separation is the whole
 * measurement. `information_schema.role_column_grants` EXPANDS a table-level
 * grant across every column, so a table-wide INSERT reads there as one entry per
 * column and is indistinguishable from the column-scoped grant this replaces it
 * with. `pg_class.relacl` and `pg_attribute.attacl` are the two real stores.
 */
export async function readAcls(sql, table) {
  const rows = await sql(
    `SELECT 'table' AS kind, NULL AS col, (aclexplode(c.relacl)).grantee::regrole::text AS grantee,
            (aclexplode(c.relacl)).privilege_type AS priv
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=$1 AND c.relacl IS NOT NULL
      UNION ALL
     SELECT 'column', a.attname, (aclexplode(a.attacl)).grantee::regrole::text,
            (aclexplode(a.attacl)).privilege_type
       FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=$1 AND a.attacl IS NOT NULL`,
    [table]);
  return (rows || []).filter((r) => CLIENT_ROLES.includes(r.grantee));
}

/** The GRANT statements that would put a recorded ACL set back, for --rollback. */
export function grantsFromAcls(table, acls) {
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const out = [];
  for (const role of CLIENT_ROLES) out.push(`REVOKE ALL ON ${q(table)} FROM ${role};`);
  const tableVerbs = {}, colVerbs = {};
  for (const a of acls) {
    if (!CLIENT_ROLES.includes(a.grantee)) continue;
    if (a.kind === "table") (tableVerbs[a.grantee] ||= new Set()).add(a.priv);
    else ((colVerbs[a.grantee] ||= {})[a.priv] ||= new Set()).add(a.col);
  }
  for (const role of CLIENT_ROLES) {
    const tv = tableVerbs[role];
    if (tv && tv.size) out.push(`GRANT ${[...tv].sort().join(", ")} ON ${q(table)} TO ${role};`);
    const cv = colVerbs[role];
    if (!cv) continue;
    // ONE STATEMENT PER ROLE, never one per verb: Postgres takes
    // `GRANT INSERT (a), UPDATE (a)` and the emitter writes it that way, so
    // rebuilding it verb-by-verb would put a site back in a shape it was never
    // in. The verbs are sorted so a rollback file and a re-read compare equal.
    const parts = Object.keys(cv).sort().map((priv) => `${priv} (${[...cv[priv]].sort().map(q).join(", ")})`);
    if (parts.length) out.push(`GRANT ${parts.join(", ")} ON ${q(table)} TO ${role};`);
  }
  return out;
}

/** A compact, comparable reading of what the client roles hold on a table. */
export function aclSummary(acls) {
  const byRole = {};
  for (const a of acls) {
    const k = a.kind === "table" ? a.priv : `${a.priv}(${a.col})`;
    (byRole[a.grantee] ||= []).push(k);
  }
  for (const r of Object.keys(byRole)) byRole[r] = byRole[r].sort();
  return byRole;
}

/** Which table-level privileges let a client WRITE. These are what the fix removes. */
export function tableWideWrites(acls) {
  return acls.filter((a) => a.kind === "table" && (a.priv === "INSERT" || a.priv === "UPDATE"))
    .map((a) => `${a.grantee} ${a.priv}`).sort();
}

/**
 * Plan one site: what its tables grant now, and what the fix would make them
 * grant. Reads only.
 *
 * THE COLUMN LIST IS CROSS-CHECKED AGAINST THE DATABASE, never taken from the
 * spec alone. A GRANT naming a column the table has not got fails WHOLE, and a
 * failed grant statement here leaves a table with no write grant and a site that
 * silently stopped accepting form submissions. `_meta.schema` stores the columns
 * that were really created at the last apply — but a site whose last apply
 * failed part-way, or whose `_meta` predates a column, would disagree. So the
 * plan uses the INTERSECTION, and NAMES anything the spec claims and the table
 * does not have.
 */
export async function planSite(sql, slug) {
  const metaRows = await sql("SELECT v FROM _meta WHERE k='schema'", []);
  const raw = metaRows && metaRows[0] && metaRows[0].v;
  if (!raw) return { slug, error: "no _meta.schema — nothing to plan from", tables: [] };
  let spec = null;
  try { spec = JSON.parse(raw); } catch (e) { return { slug, error: "_meta.schema is not JSON", tables: [] }; }
  const list = Array.isArray(spec) ? spec : (spec && Array.isArray(spec.tables) ? spec.tables : []);
  if (!list.length) return { slug, error: "the stored schema declares no tables", tables: [] };

  const realRows = await sql(
    `SELECT c.relname AS tbl, a.attname AS col FROM pg_attribute a
       JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`, []);
  const real = {};
  for (const r of realRows || []) (real[r.tbl] ||= new Set()).add(r.col);

  const tables = [];
  for (const t of list) {
    const name = t && t.name;
    if (!name) continue;
    if (!real[name]) { tables.push({ table: name, skipped: "the table does not exist in this database" }); continue; }
    const declared = (Array.isArray(t.columns) ? t.columns : []).map((c) => (typeof c === "string" ? c : c && c.name)).filter(Boolean);
    const present = declared.filter((c) => real[name].has(c));
    const missing = declared.filter((c) => !real[name].has(c));
    const before = await readAcls(sql, name);
    const statements = grantsFor(t, present);
    tables.push({
      table: name,
      access: resolveAccess(t),
      writable: writableColumns(t, present),
      missingColumns: missing,
      tableWideWritesBefore: tableWideWrites(before),
      before: aclSummary(before),
      beforeAcls: before,
      statements,
      // A table that needs nothing is still listed, so the preview is a census
      // of the site rather than a list of hits.
      changes: tableWideWrites(before).length > 0,
    });
  }
  return { slug, tables };
}

/** Issue a plan's statements. The ONLY writing path in this file. */
export async function applyPlan(sql, plan, { log = () => {} } = {}) {
  const failures = [];
  for (const t of plan.tables) {
    if (t.skipped) { log(`    ${t.table}: skipped — ${t.skipped}`); continue; }
    for (const s of t.statements) {
      try { await sql(s, []); }
      catch (e) { failures.push({ table: t.table, sql: s, err: safeErr(e) }); }
    }
    log(`    ${t.table}: ${t.statements.length} statements`);
  }
  return failures;
}

/**
 * Read the site back and say whether it is now right.
 *
 * TWO ASSERTIONS, and the second is what stops the first being vacuous: no
 * client role holds a table-level INSERT or UPDATE, AND the column grants that
 * replaced them name exactly the writable columns. A site where the REVOKE ran
 * and the GRANT did not satisfies the first perfectly and cannot take a booking.
 */
export async function verifySite(sql, plan) {
  const rows = [];
  for (const t of plan.tables) {
    if (t.skipped) continue;
    const acls = await readAcls(sql, t.table);
    const wide = tableWideWrites(acls);
    const wantsWrite = t.access && t.access.write !== "none";
    const granted = new Set(acls.filter((a) => a.kind === "column" && (a.priv === "INSERT" || a.priv === "UPDATE")).map((a) => a.col));
    const expected = new Set(t.writable);
    const sameSet = granted.size === expected.size && [...expected].every((c) => granted.has(c));
    rows.push({
      table: t.table,
      tableWideWrites: wide,
      ok: wide.length === 0 && (!wantsWrite || t.writable.length === 0 || sameSet),
      grantedColumns: [...granted].sort(),
      expectedColumns: [...expected].sort(),
      after: aclSummary(acls),
    });
  }
  return rows;
}

// ── the runner ──────────────────────────────────────────────────────────────
// Everything above is a pure-ish function over an injected `sql`, so the whole
// file is drivable against any Postgres. What follows is the only part that
// needs Supabase and Neon.

function parseArgs(argv) {
  const a = { mode: "preview", slugs: [], out: "", file: "" };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--preview") a.mode = "preview";
    else if (v === "--apply") a.mode = "apply";
    else if (v === "--verify") a.mode = "verify";
    else if (v === "--rollback") { a.mode = "rollback"; a.file = argv[++i] || ""; }
    else if (v === "--slug") a.slugs.push(argv[++i] || "");
    else if (v === "--out") a.out = argv[++i] || "";
  }
  return a;
}

async function listSites(svcKey, only) {
  const url = `${SUPABASE_URL}/rest/v1/site_project?select=slug,neon_conn&order=slug`;
  const r = await fetch(url, { headers: { apikey: svcKey, Authorization: "Bearer " + svcKey } });
  if (!r.ok) throw new Error("site_project read " + r.status);
  const rows = await r.json();
  const dbs = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?select=slug,neon_db`, { headers: { apikey: svcKey, Authorization: "Bearer " + svcKey } });
  if (!dbs.ok) throw new Error("site_backends read " + dbs.status);
  const byslug = {};
  for (const b of await dbs.json()) byslug[b.slug] = b.neon_db || "";
  return rows
    .filter((r2) => !only.length || only.includes(r2.slug))
    .map((r2) => ({ slug: r2.slug, conn: r2.neon_conn, db: byslug[r2.slug] || "" }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const svc = process.env.SUPABASE_SERVICE_KEY || "";
  if (!svc) { console.error("SUPABASE_SERVICE_KEY is required"); process.exit(1); }
  const { connForDatabase, sqlQuery, dbNameForSite } = await import("../site-db.mjs");
  const fs = await import("node:fs");

  const sites = await listSites(svc, args.slugs);
  console.log(`${sites.length} site${sites.length === 1 ? "" : "s"} with a Neon project\n`);

  const record = { at: new Date().toISOString(), mode: args.mode, sites: [] };
  let needing = 0, tablesNeeding = 0, failedSites = 0;

  for (const site of sites) {
    // A SITE WITH NO RECORDED DATABASE NAME IS STILL REACHED, AND SAID.
    //
    // `site_backends.neon_db` is what every platform reader resolves through,
    // and it is EMPTY on a site whose first build was frontend-only and whose
    // database arrived later: `claimSiteSlug` writes the row with `neon_db: ""`
    // and the only writer of that column is `saveBackend`, a POST carrying
    // `resolution=ignore-duplicates` — an insert, which cannot update the row
    // that is already there. Nothing else in the Worker ever PATCHes it
    // (measured: the only two PATCHes to `site_backends` are the offline flag
    // and the notify flag). So the column stays empty for ever and
    // `siteBackendBySlug` answers `conn: null` for that site.
    //
    // Measured 2026-09-13: FOUR of the thirty-one sites with a Neon project are
    // in this state. Recorded as its own finding; this script must not inherit
    // it, because a backfill that silently skips the sites the platform cannot
    // resolve leaves exactly the sites nobody is watching un-fixed.
    //
    // THE NAME IS DERIVABLE: a site's database is `dbNameForSite(slug)`, which
    // is what the build smoke already uses to reach a site's own database. The
    // recorded name is preferred when there is one, so a site that does not
    // follow the derivation is still read at the name it really has.
    const dbName = site.db || dbNameForSite(site.slug);
    if (!site.db) console.log(`${site.slug}: no neon_db recorded — reaching it at the derived name ${dbName} (the platform's own reader cannot resolve this site)`);
    const conn = connForDatabase(site.conn, dbName);
    const sql = (text, params) => sqlQuery(conn, text, params);
    let plan;
    try { plan = await planSite(sql, site.slug); }
    catch (e) { console.log(`${site.slug}: could not read — ${safeErr(e)}`); failedSites++; continue; }
    if (plan.error) { console.log(`${site.slug}: ${plan.error}`); continue; }

    const hits = plan.tables.filter((t) => t.changes);
    if (hits.length) { needing++; tablesNeeding += hits.length; }
    console.log(`${site.slug}: ${plan.tables.length} table(s), ${hits.length} carrying a table-wide client write`);
    for (const t of plan.tables) {
      if (t.skipped) { console.log(`    ${t.table}: ${t.skipped}`); continue; }
      const mark = t.changes ? "NEEDS" : "  ok ";
      console.log(`    ${mark} ${t.table}  [read=${t.access.read} write=${t.access.write}]  now: ${t.tableWideWritesBefore.join(", ") || "(no table-wide write)"}`);
      if (t.changes) console.log(`          would grant: ${t.writable.join(", ") || "(nothing writable — a refusal, see below)"}`);
      if (t.missingColumns.length) console.log(`          the stored schema names columns this table has not got, left out of the grant: ${t.missingColumns.join(", ")}`);
      if (t.changes && !t.writable.length) console.log(`          WARNING: no writable column, so this table would end with no write grant at all`);
    }
    record.sites.push({ slug: site.slug, tables: plan.tables.map((t) => ({ table: t.table, before: t.before, beforeAcls: t.beforeAcls, statements: t.statements })) });

    if (args.mode === "apply") {
      const failures = await applyPlan(sql, plan, { log: (m) => console.log(m) });
      for (const f of failures) console.log(`    REFUSED ${f.table}: ${f.sql}\n            ${f.err}`);
      const rows = await verifySite(sql, plan);
      for (const r of rows) console.log(`    ${r.ok ? "  ok " : "FAIL"} ${r.table}: ${r.tableWideWrites.join(", ") || "no table-wide write"}; columns granted [${r.grantedColumns.join(", ")}]`);
    } else if (args.mode === "verify") {
      const rows = await verifySite(sql, plan);
      for (const r of rows) console.log(`    ${r.ok ? "  ok " : "FAIL"} ${r.table}: ${r.tableWideWrites.join(", ") || "no table-wide write"}; columns granted [${r.grantedColumns.join(", ")}]`);
    } else if (args.mode === "rollback") {
      const saved = JSON.parse(fs.readFileSync(args.file, "utf8"));
      const s = (saved.sites || []).find((x) => x.slug === site.slug);
      if (!s) { console.log(`    no recorded state for ${site.slug} in ${args.file} — left alone`); continue; }
      for (const t of s.tables) {
        for (const stmt of grantsFromAcls(t.table, t.beforeAcls || [])) {
          try { await sql(stmt, []); } catch (e) { console.log(`    REFUSED ${stmt} — ${safeErr(e)}`); }
        }
        console.log(`    ${t.table}: put back as recorded`);
      }
    }
  }

  const out = args.out || `grants-backfill-${record.at.replace(/[:.]/g, "-")}.json`;
  if (args.mode === "preview" || args.mode === "apply") {
    fs.writeFileSync(out, JSON.stringify(record, null, 2));
    console.log(`\nbefore-state written to ${out} — pass it to --rollback to put every site back exactly as it was`);
  }
  console.log(`\n${needing} site(s) and ${tablesNeeding} table(s) carry a table-wide client write; ${failedSites} site(s) could not be read`);
}

// Only when run, never when imported by a guard.
if (import.meta.url === `file://${process.argv[1]}`) {
  // THE TOP-LEVEL CATCH TOO, and it is the one that matters most: a stack from
  // deep in a driver is exactly where a DSN would surface.
  main().catch((e) => { console.error(safeErr((e && e.stack) || e)); process.exit(1); });
}

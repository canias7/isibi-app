// THE ONE FUNCTION RUN 47 POINTED AT THE WRONG TABLE.
//
// Run 47 asked for "a page at /status that shows how many repairs are booked,
// and a function the page calls to count them" on a site whose `bookings` table
// was twelve minutes old. The addon had been told the site had no tables (the
// four-state defect), so it designed a SECOND table — `repairs` — and wrote
// `count_booked_repairs` to count that one. `/status` publishes, loads,
// reaches its function through the site's own public route, and answers `0` to
// a shop with three bookings.
//
// RESTORING THE `bookings` DECLARATION DOES NOT FIX THIS, and saying so is the
// whole reason this file exists separately from `backend-repair.mjs`. That
// repair puts the table back into `_meta.schema`; the function's body is a
// different object and still reads `FROM repairs`.
//
// ── WHY THE BODY IS TAKEN FROM POSTGRES AND NOT FROM `_meta` ─────────────────
//
// `_meta.functions` stores `{name, args, returns, internal}` and NO BODY —
// `applySiteSchema` writes exactly those four fields, and `normalizeSchema`
// drops a function whose body is empty (`if (!body) continue`). So the stored
// declaration has nothing to correct, and a later apply will not re-create this
// function from it. The live definition in Postgres is the only copy, which
// makes correcting it durable rather than something the next addon undoes.
//
// AND IT IS REWRITTEN FROM `pg_get_functiondef`, not rebuilt from a template.
// That output is already a complete `CREATE OR REPLACE FUNCTION` statement
// carrying the exact signature, language, volatility, SECURITY DEFINER and
// search_path Postgres really has — so changing ONE identifier inside it
// changes one identifier and nothing else. Rebuilding the statement from a
// guess at those attributes is how a repair quietly takes SECURITY DEFINER off
// a function every RLS-bypassing read depends on.
//
// SCOPED TO ONE SITE BY NAME. `repairbench-1` is the only slug this will act
// on, because the owner's instruction is exact: keep repairs and test writes to
// the identified sites. A different slug is a named refusal, not a flag.
//
// IT REFUSES TO GUESS. The current body must name `repairs` and must NOT
// already name `bookings`; a function that is absent, already correct, or
// shaped some other way stops the run and says which. So it cannot clobber a
// function somebody has already fixed, and running it twice is running it once.
//
// Needs SUPABASE_SERVICE_KEY (to find the site's connection). Run:
//   node scripts/repairbench-count-fix.mjs            # preview, writes nothing
//   node scripts/repairbench-count-fix.mjs --apply
//   node scripts/repairbench-count-fix.mjs --verify
import { connForDatabase, dbNameForSite, sqlQuery } from "../site-db.mjs";
import { safeErr, survey, proveIdentity } from "./backend-repair.mjs";

/** The one site this may touch. A slug is checked against it, never passed through. */
export const ONLY_SLUG = "repairbench-1";
/** The function run 47 wrote, and the two tables in play. */
export const FN = "count_booked_repairs";
export const WRONG_TABLE = "repairs";
export const RIGHT_TABLE = "bookings";

const SITE_ORIGIN = process.env.OWNER_BASE_URL || "https://gofarther.dev";

export function parseArgs(argv) {
  const out = { mode: "preview" };
  for (const a of argv) {
    if (a === "--apply") out.mode = "apply";
    else if (a === "--verify") out.mode = "verify";
    else if (a === "--preview") out.mode = "preview";
  }
  return out;
}

/** The live definition, as a complete CREATE OR REPLACE statement, or null. */
export const DEFINITION_SQL =
  "SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p " +
  "JOIN pg_namespace n ON n.oid = p.pronamespace " +
  "WHERE n.nspname = 'public' AND p.proname = $1";

/**
 * THE REWRITE, and the three refusals that come before it.
 *
 * WORD-BOUNDED, so `repairs` never matches inside `repairbench` or
 * `repairs_old`. The recorded `evidenceName` rule one module over, for the same
 * reason: a substring match here would rename part of another identifier inside
 * a function body nobody is reading.
 */
export function rewriteDefinition(def) {
  const s = String(def || "");
  if (!s.trim()) return { ok: false, why: "no-definition" };
  const wrong = new RegExp("\\b" + WRONG_TABLE + "\\b", "g");
  const right = new RegExp("\\b" + RIGHT_TABLE + "\\b");
  if (right.test(s)) return { ok: false, why: "already-names-" + RIGHT_TABLE };
  if (!wrong.test(s)) return { ok: false, why: "does-not-name-" + WRONG_TABLE };
  const out = s.replace(wrong, RIGHT_TABLE);
  // THE NAME ITSELF MUST SURVIVE. `count_booked_repairs` ends in the word this
  // is replacing — but `\brepairs\b` does not match inside it, because `_` is a
  // word character. Asserted rather than reasoned about, because being wrong
  // here renames the function and takes `/status` down.
  if (!out.includes(FN)) return { ok: false, why: "rewrite-would-rename-the-function" };
  const n = (s.match(wrong) || []).length;
  return { ok: true, sql: out, replaced: n };
}

/** The site's connection, through the same survey and the same identity proof. */
async function connect(key) {
  const rows = await survey(key, ONLY_SLUG);
  const site = rows[0];
  if (!site) throw new Error(`no site_backends row for ${ONLY_SLUG}`);
  const db = site.db || dbNameForSite(ONLY_SLUG);
  // THE CONNECTION `survey` ALREADY RESOLVED. Re-resolving here was harmless
  // only because `connForDatabase` is idempotent; taking the row's own is what
  // keeps identity and the queries on one connection, which is the defect this
  // round fixed one file over.
  const conn = site.conn || connForDatabase(site.projectConn, db);
  const sql = (q, p) => sqlQuery(conn, q, p || []);
  const id = await proveIdentity({ slug: ONLY_SLUG, expectDb: db, conn, projectSlug: site.projectSlug, sql });
  if (!id.proven) throw new Error(`identity not proven for ${ONLY_SLUG}: ${id.why}`);
  return { site, db, sql };
}

/**
 * THE THREE NUMBERS THAT MUST AGREE, and the third is the only one that is
 * about the customer's page.
 *
 *   rows   — `SELECT COUNT(*) FROM bookings`, established independently.
 *   direct — the function, called on the owner's connection.
 *   route  — the function through the site's OWN public RPC route, which is the
 *            call `/status` really makes.
 *
 * A 200 FROM `/status` IS NOT ONE OF THEM. Fetching the document proves the
 * script is up and serving and exercises no query at all — this repository's
 * own recorded "a 200 is an availability check and never a health check", and
 * run 47 is the instance: a perfect 200 over a count of zero.
 */
export async function readCounts(sql) {
  const out = { rows: null, direct: null, route: null, routeStatus: 0 };
  const r = await sql(`SELECT COUNT(*)::int AS n FROM "${RIGHT_TABLE}"`, []);
  out.rows = Number(((r || [])[0] || {}).n);
  try {
    const d = await sql(`SELECT ${FN}() AS n`, []);
    out.direct = Number(((d || [])[0] || {}).n);
  } catch (e) { out.direct = "error: " + safeErr(e); }
  try {
    const res = await fetch(`${SITE_ORIGIN}/api/db/${ONLY_SLUG}/data/rpc/${FN}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    out.routeStatus = res.status;
    const t = await res.text();
    try { const j = JSON.parse(t); out.route = typeof j === "number" ? j : (Array.isArray(j) ? j[0] : j); }
    catch { out.route = t.slice(0, 120); }
  } catch (e) { out.route = "error: " + safeErr(e); }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) { console.error("SUPABASE_SERVICE_KEY is not set"); process.exit(2); }
  console.log(`mode: ${args.mode}  site: ${ONLY_SLUG}  function: ${FN}`);

  const { db, sql } = await connect(key);
  console.log(`database: ${db} (identity proven)`);

  const before = await readCounts(sql);
  console.log(`before: ${RIGHT_TABLE} holds ${before.rows} row(s); ${FN}() answers ${before.direct}; ` +
    `the site's own route answers ${JSON.stringify(before.route)} (HTTP ${before.routeStatus})`);

  const rows = await sql(DEFINITION_SQL, [FN]);
  const def = String(((rows || [])[0] || {}).def || "");
  if (!def) { console.error(`${FN} does not exist in this database — nothing to correct.`); process.exit(1); }
  console.log(`current definition (${def.length} chars):\n${def}`);

  // ── VERIFY IS ITS OWN MODE, AND IT ALWAYS DECIDES (2026-09-15) ──────────
  //
  // It used to be a branch INSIDE the "the function does not need rewriting"
  // arm, so a `--verify` run on a function that still counted the wrong table
  // read the three numbers, saw 3 / 0 / 0, fell through to the preview and
  // exited 0. Driven and measured. A verification has exactly one job: check
  // the postconditions and fail the process when they do not hold — whatever
  // state the function is in, and never writing anything.
  if (args.mode === "verify") {
    const agree = before.rows === before.direct && before.direct === before.route;
    const pending = rewriteDefinition(def);
    const lines = [];
    if (!agree) lines.push(`the three counts disagree: ${RIGHT_TABLE}=${before.rows}, ${FN}()=${JSON.stringify(before.direct)}, route=${JSON.stringify(before.route)}`);
    if (before.routeStatus !== 200) lines.push(`the site's own route answered HTTP ${before.routeStatus}`);
    if (pending.ok) lines.push(`the function still counts "${WRONG_TABLE}" — the correction has not been applied`);
    console.log(lines.length ? "\nVERIFY FAILED:\n  " + lines.join("\n  ") : "\nVERIFY PASSED — all three counts agree and the function reads " + RIGHT_TABLE + ".");
    process.exit(lines.length ? 1 : 0);
  }

  const rw = rewriteDefinition(def);
  if (!rw.ok) {
    console.error(`\nREFUSED: ${rw.why}. Nothing written.`);
    process.exit(1);
  }
  console.log(`\nwould replace ${rw.replaced} occurrence(s) of "${WRONG_TABLE}" with "${RIGHT_TABLE}":\n${rw.sql}`);

  if (args.mode !== "apply") { console.log("\n(preview — nothing written. --apply writes.)"); return; }
  await sql(rw.sql, []);
  console.log("\napplied.");

  const after = await readCounts(sql);
  console.log(`after: ${RIGHT_TABLE} holds ${after.rows} row(s); ${FN}() answers ${after.direct}; ` +
    `the site's own route answers ${JSON.stringify(after.route)} (HTTP ${after.routeStatus})`);
  const ok = after.rows === after.direct && after.direct === after.route;
  console.log(ok ? "\nPASS — all three agree." : "\nFAIL — the three do not agree; look before doing anything else.");
  if (!ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(safeErr((e && e.stack) || e)); process.exit(1); });
}

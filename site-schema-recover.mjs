// PUTTING BACK A TABLE THE STORED SCHEMA FORGOT — AND PROVING IT SAFE FIRST.
//
// `_meta.schema` is the application's picture of its own database, and an addon
// writes it WHOLE: `mergeAddonSchema(prior, designed)` where `prior` is what was
// read at the top of the route. Run 47 read `{ tables: [] }` — the four-state
// defect one file over — so the merge answered `["repairs"]` where it should
// have answered `["bookings","repairs"]`, and `bookings` lost its DECLARATION
// while the table itself carried on holding rows. Measured by driving the real
// merge both ways.
//
// A LOST DECLARATION IS NOT A LOST TABLE, and the difference is the whole shape
// of this module. Postgres still has the table, its columns, its grants and its
// policies; what went is the metadata that only ever lived in `_meta`. So the
// repair is a RECONCILE, not a restore from a backup there isn't one of: keep
// every stored entry exactly as it stands, and rebuild an entry for each table
// the database has and the spec does not.
//
// ── THE PART THAT WAS MISSING (2026-09-15) ───────────────────────────────────
//
// The first cut rebuilt `{name, columns, read, write}` and dropped every flag,
// which is a SILENT BEHAVIOUR CHANGE ONE APPLY LATER. Driven: a `trash` table
// whose live SELECT policy reads
//
//     USING ((owner_id = app_user_id()) AND (deleted_at IS NULL))
//
// recovered without the flag, and `policiesFor` on that declaration emits
//
//     USING (owner_id = app_user_id())
//
// so every soft-deleted row becomes visible to its owner again on the next
// schema change. The recovery would have caused it, days later, with nothing
// connecting the two.
//
// TWO THINGS FIX IT AND ONLY THE SECOND IS A WALL.
//
//   1. FLAGS ARE DERIVED FROM WHAT THE ENGINE LEFT BEHIND. Nearly every table
//      flag creates an observable artifact — a column it owns (`deleted_at`,
//      `updated_at`, `position`, `payment_status`, …) or a trigger it names
//      (`trg_<t>_del`, `trg_<t>_aud_i`, `trg_<t>_hist`). `DERIVED_FLAGS` is that
//      mapping, read off `site-schema.mjs`'s own DDL.
//
//   2. THE RECOVERED DECLARATION IS RUN BACK THROUGH THE REAL EMITTERS AND
//      COMPARED WITH THE DATABASE. `policiesFor` and `grantsFor` are INJECTED
//      (`emit`) rather than imported, so this module stays dependency-free and
//      the comparison can never be against a second copy of them. A declaration
//      whose policies do not match the live ones, or whose grants would WIDEN
//      what a client may write, is `uncertain`: reported, and kept out of the
//      spec entirely, so the next apply does not touch that table at all.
//
//      WITH NO `emit`, EVERY RECOVERY IS UNCERTAIN. Fail-closed: a caller that
//      cannot verify must not write.
//
// THE POLICY COMPARISON IS EXACT AND THE GRANT COMPARISON IS ONE-SIDED, and the
// asymmetry is deliberate. Every apply DROPs and re-CREATEs a table's policies
// from its declaration, so the live policy IS the fingerprint of the true
// declaration and any difference is ours. Grants are not like that: a site that
// has not had a schema change since 2026-09-13 still carries TABLE-WIDE write
// grants, and the next apply narrows them to columns — the platform's own fix,
// not damage from this. So grants are asked only "could this recovery let a
// client write something the database does not already let them write", and a
// narrowing passes.
//
// ── AND "THE DATABASE IS EMPTY" IS A MEASUREMENT, NOT AN INFERENCE ───────────
//
// `readSchemaState` is the other half. A missing `_meta`, or a `_meta` with no
// schema row, says nothing whatever about whether the database holds tables —
// and treating it as `{tables: []}` is the run-47 defect with a different
// cause. The catalog is asked FIRST and every answer carries `missing`: the
// application tables the catalog has and the spec does not.
//
// Pure, and its ONE import is the import-free sibling that OWNS the list it
// would otherwise copy: which columns the engine manages. "Two lists of the
// same thing" on the question of what a client may write is this repository's
// most expensive recurring mistake, and a hand-kept copy here would be exactly
// that.
import { MANAGED_COLUMNS as ENGINE_MANAGED, isManagedColumn } from "./site-access.mjs";
// `PAYMENT_COLUMNS` is deliberately NOT imported: see `MANAGED_COLUMNS` below.
// The one payment column this module reads is named in `UNDERIVABLE_EVIDENCE`,
// because only one of the five is distinctive enough to key a refusal on.

/** The catalog reads this module's inputs come from. One copy, four readers. */
export const RECOVER_QUERIES = {
  // Base tables in `public`, with their columns, ordered so the answer is stable.
  columns:
    "SELECT c.table_name AS t, c.column_name AS c, c.data_type AS ty " +
    "FROM information_schema.columns c " +
    "JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name " +
    "WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE' " +
    "ORDER BY c.table_name, c.ordinal_position",
  // Table-level AND column-level privileges, told apart by `lvl`.
  //
  // MEASURED ON A REAL POSTGRES 16 rather than read off the docs, because the
  // whole grant comparison turns on it: `information_schema.column_privileges`
  // EXPANDS a table-level grant to every column of the table. A table-wide
  // `GRANT SELECT` on a four-column table shows up there as four SELECT rows.
  // So the column list in that view is the real column-scoped grant only when
  // the same (grantee, privilege) is ABSENT from `role_table_grants` — which is
  // exactly what `lvl` lets a reader ask.
  //
  // Reading only `role_table_grants` would derive `write: "none"` for every
  // booking form on the platform, since 2026-09-13 made the write grants
  // column-scoped. Reading only `column_privileges` would call every table-wide
  // grant a column-scoped one. Both are needed and they must stay separable.
  grants:
    "SELECT table_name AS t, grantee AS g, privilege_type AS p, 'table' AS lvl, ''::text AS col " +
    "FROM information_schema.role_table_grants WHERE table_schema = 'public' " +
    "UNION ALL " +
    "SELECT table_name AS t, grantee AS g, privilege_type AS p, 'column' AS lvl, column_name AS col " +
    "FROM information_schema.column_privileges WHERE table_schema = 'public'",
  policies:
    "SELECT tablename AS t, cmd AS c, coalesce(qual,'') AS q, coalesce(with_check,'') AS w " +
    "FROM pg_policies WHERE schemaname = 'public'",
  // Triggers name the flags that leave no column of their own — `sync`'s
  // tombstone, `audit`'s three, `history`'s snapshot, `ordered`'s positioner.
  // `tgisinternal` excludes the ones Postgres writes for constraints.
  triggers:
    "SELECT c.relname AS t, tg.tgname AS g FROM pg_trigger tg " +
    "JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace " +
    "WHERE n.nspname = 'public' AND NOT tg.tgisinternal",
};

/**
 * The stored schema read, spelled ONCE.
 *
 * It was written out inline in `worker.js` and again in the repair script, two
 * copies of one query with two different reactions to the same three failures.
 */
export const META_SCHEMA_SQL = "SELECT v FROM _meta WHERE k = 'schema'";

/** Postgres's own wording for a relation that is not there. Matched on nothing else. */
export const MISSING_RELATION = /relation .* does not exist|undefined_table|42P01/i;

/** The two Data API roles, spelled as Postgres reports them. */
export const ROLES = { anon: "anonymous", user: "authenticated" };

/** A row is internal when its name starts with `_`. The engine's own prefix. */
export const isInternalName = (n) => /^_/.test(String(n || ""));

/** The application tables a catalog read found: `public`, base, not internal. */
export function appTables(columns) {
  const out = [];
  for (const r of Array.isArray(columns) ? columns : []) {
    if (!r || !r.t || isInternalName(r.t)) continue;
    if (!out.includes(r.t)) out.push(r.t);
  }
  return out;
}

/** The names a stored spec declares, lowercased, as a Set. */
export function declaredNames(spec) {
  const list = spec && Array.isArray(spec.tables) ? spec.tables : [];
  return new Set(list.map((t) => String((t && t.name) || "").toLowerCase()).filter(Boolean));
}

/**
 * WHAT THE DATABASE REALLY HOLDS AND WHAT THE SPEC SAYS IT HOLDS — four
 * outcomes, and the two that used to be one are the reason this exists.
 *
 *   stored                   — a spec parsed. `missing` may still name tables it
 *                              does not declare; that is run 47's own state.
 *   empty                    — no stored spec AND the catalog confirms no
 *                              application tables. The honest empty: a database
 *                              provisioned and never applied to, where refusing
 *                              would make the first backend addition impossible.
 *   tables-without-metadata  — no stored spec and the catalog HAS tables. `ok`
 *                              is still true (both reads succeeded); `missing`
 *                              names every one of them and the caller must
 *                              recover or stop.
 *   unreadable               — a read threw, or the stored JSON will not parse.
 *                              `ok: false`. The schema is UNKNOWN.
 *
 * THE CATALOG IS ASKED FIRST, and that order is the fix. Asking `_meta` first
 * and answering `{tables: []}` on a miss is an INFERENCE from the absence of
 * one row to the absence of every table, and it is the same inference run 47
 * was built on.
 *
 * `sql` is injected so this module stays dependency-free and so the Worker, the
 * job child and the repair script all read one decision.
 */
export const SCHEMA_STATES = ["stored", "empty", "tables-without-metadata", "unreadable"];

export async function readSchemaState({ sql, scrub } = {}) {
  const clean = typeof scrub === "function" ? scrub : (s) => String(s || "");
  const detailOf = (e) => clean(String((e && (e.detail || e.message)) || e)).slice(0, 200);

  let columns = [];
  try { columns = (await sql(RECOVER_QUERIES.columns, [])) || []; }
  catch (e) {
    // CANNOT SEE THE CATALOG IS CANNOT TELL. Never "no tables" — that is the
    // exact rounding this function exists to stop.
    return { ok: false, state: "unreadable", why: "catalog-unreadable", detail: detailOf(e), spec: null, tables: [], columns: [], missing: [] };
  }
  const tables = appTables(columns);

  let spec = null, why = "stored";
  try {
    const rows = await sql(META_SCHEMA_SQL, []);
    const row = (rows || [])[0];
    if (!row || !row.v) why = "no-row";
    else {
      try { spec = JSON.parse(row.v); }
      catch { return { ok: false, state: "unreadable", why: "unparseable", detail: "", spec: null, tables, columns, missing: [] }; }
      if (!spec || typeof spec !== "object") {
        return { ok: false, state: "unreadable", why: "not-an-object", detail: "", spec: null, tables, columns, missing: [] };
      }
    }
  } catch (e) {
    const m = String((e && (e.detail || e.message)) || e);
    // `_meta` NOT EXISTING IS "NOTHING STORED", not an error: `ensureSiteBackend`
    // creates it when it records the auth and data endpoints, so a database that
    // predates those writes has no table and no rows. Anything we cannot
    // recognise is UNKNOWN, which is the safe direction.
    if (MISSING_RELATION.test(m)) why = "no-meta-table";
    else return { ok: false, state: "unreadable", why: "query-failed", detail: detailOf(e), spec: null, tables, columns, missing: [] };
  }

  if (spec) {
    const known = declaredNames(spec);
    const missing = tables.filter((n) => !known.has(String(n).toLowerCase()));
    return { ok: true, state: "stored", why, spec, tables, columns, missing };
  }
  if (!tables.length) return { ok: true, state: "empty", why, spec: { tables: [] }, tables, columns, missing: [] };
  return { ok: true, state: "tables-without-metadata", why, spec: { tables: [] }, tables, columns, missing: tables.slice() };
}

/**
 * EVERY FLAG THE ENGINE LEAVES A TRACE OF, and the trace it leaves.
 *
 * Read off `site-schema.mjs`'s own DDL (the column list around 1124–1152 and the
 * trigger blocks at 1213, 1227, 1419 and 1439), so this list and the emitter can
 * be read side by side when one of them changes.
 *
 * `column` is a column ONLY that flag creates; `trigger` is a trigger name the
 * engine composes as `trg_<table>_<suffix>`.
 */
export const DERIVED_FLAGS = [
  { flag: "trash", column: "deleted_at" },
  { flag: "timestamps", column: "updated_at" },
  { flag: "ordered", column: "position", trigger: "pos" },
  { flag: "expires", column: "expires_at" },
  { flag: "pinnable", column: "pinned" },
  { flag: "scheduled", column: "publish_at" },
  { flag: "archivable", column: "archived_at" },
  { flag: "version", column: "_version" },
  { flag: "teamScope", column: "team_id" },
  { flag: "sync", trigger: "del" },
  { flag: "audit", trigger: "aud_i" },
  { flag: "history", trigger: "hist" },
];

/**
 * A COLUMN THAT PROVES A FLAG AND CANNOT PROVE ITS VALUE.
 *
 * `payment` is not a boolean: `normalizePayment` answers
 * `{from, price, name, currency}` — the CATALOGUE table a basket is priced
 * from and the two columns in it — and the five columns it creates prove only
 * that the table is payable. So a payable table is `uncertain`, never derived.
 *
 * AND THE ROUND-TRIP CANNOT SEE IT, which is why this is a separate check
 * rather than something the verification would have caught. A payable table
 * emits no write grant and no write policy at all, and a recovered declaration
 * of `{read: "none", write: "none"}` emits exactly the same nothing — so the
 * comparison passes on two declarations that behave completely differently at
 * `/checkout`. Measured on a real Postgres while this was being written.
 */
// KEYED ON `payment_status` ALONE, and the first draft keyed on all five —
// which made a PRICE LIST with a `currency` column read as payable. Measured:
// a `display` table declaring `dish` and `currency` came back
// `uncertain: payment-config-not-derivable`, refused for a feature it has not
// got. `currency` and `amount_total` are ordinary words a designer writes; the
// engine creates all five together, so the one nobody writes by accident is
// sufficient evidence and is the only one that carries no false alarm.
export const UNDERIVABLE_EVIDENCE = [
  { columns: ["payment_status"], why: "payment-config-not-derivable" },
];

/**
 * The flags a table's own artifacts prove.
 *
 * `sync` AND `timestamps` BOTH CREATE `updated_at`, so the tombstone trigger is
 * what separates them — without the trigger read, a `sync` table would recover
 * as `timestamps` and its `_deletes` machinery would stop being re-created.
 */
export function deriveFlags({ table, columns = [], triggers = [] } = {}) {
  const cols = new Set((Array.isArray(columns) ? columns : [])
    .filter((r) => r && r.t === table).map((r) => String(r.c || "").toLowerCase()));
  const trg = new Set((Array.isArray(triggers) ? triggers : [])
    .filter((r) => r && r.t === table).map((r) => String(r.g || "").toLowerCase()));
  const out = {};
  for (const d of DERIVED_FLAGS) {
    const byCol = d.column ? cols.has(d.column) : false;
    const byTrg = d.trigger ? trg.has("trg_" + String(table).toLowerCase() + "_" + d.trigger) : false;
    if (byCol || byTrg) out[d.flag] = true;
  }
  return out;
}

/**
 * FLAGS NOTHING IN THE DATABASE CAN SHOW, named rather than silently dropped.
 *
 * `writeRoles` decides who may write through the WORKER'S own door on an
 * `admin` table and leaves no trace in Postgres at all. `retired` is the
 * absence of grants and policies, which is also what a table nobody has applied
 * to looks like. `approval` and `sequence` name their column in the flag, so
 * their column is indistinguishable from an ordinary declared one — which is
 * exactly why the grant comparison below is a wall and not a report: recovering
 * such a column as ordinary would make it client-writable, and that widening is
 * refused whatever this list says.
 */
export const UNPROVABLE_FLAGS = ["writeRoles", "retired", "approval", "sequence", "fts", "slug"];

/**
 * The columns the engine writes for itself: `id` and `created_at` with the
 * table, the rest from the table's own flags.
 *
 * A recovered table declares NONE of them, because the engine creates them from
 * the flags; declaring `id` as an ordinary column would have the next apply try
 * to add a column that is already there under another definition — and would
 * put it in the WRITE GRANT, which is how a recovery hands a visitor their own
 * `created_at`.
 *
 * `site-access.mjs` OWNS THE LIST. Copying it here would be a second answer to
 * "which columns may a client write", beside the one `writableColumns` and
 * `pickWritable` already share.
 *
 * THE PAYMENT COLUMNS ARE DELIBERATELY NOT IN IT, and the first draft added
 * them. `site-schema.mjs:1011` adds them to its managed set only FOR A PAYABLE
 * TABLE; adding them unconditionally here strips `currency` and `amount_total`
 * from every ordinary table that happens to declare one — a narrowing the
 * one-sided grant check would allow through in silence. A payable table is
 * refused whole by `UNDERIVABLE_EVIDENCE` above, so there is nothing left for a
 * second wall to do.
 */
export const MANAGED_COLUMNS = new Set(ENGINE_MANAGED);

// ── THE FINGERPRINTS ─────────────────────────────────────────────────────────
//
// Postgres does not store a policy predicate as it was written: it re-quotes,
// re-parenthesises and adds casts, so `"t"."deleted_at" IS NULL` comes back as
// `(deleted_at IS NULL)`. Comparing text would report every correct pair as a
// mismatch. What survives that rewriting is WHICH FACTS the predicate turns on,
// and that is a small closed set here because `policiesFor` composes from four
// pieces (`true`, the member test, the owner test, the team widening) and three
// live conditions.

/**
 * Is the predicate keyed on the caller's identity — `own`, not `members`?
 *
 * IT IS THE COMPARISON, NOT THE FUNCTION, and reading it as the function was a
 * real bug the sixteen-cell round-trip caught. `policiesFor` writes BOTH levels
 * against `app_user_id()`:
 *
 *   own      USING ("t"."owner_id" = app_user_id())
 *   members  USING (app_user_id() IS NOT NULL)
 *
 * so "mentions `app_user_id`" is true of both and called every `members` table
 * `own` — seven of sixteen cells wrong, and in the direction that narrows a
 * live table's access on the next apply. What separates them is the EQUALITY.
 */
const OWN_TEST = /app_user_id\s*\(\s*\)\s*=|=\s*app_user_id\s*\(/i;
const ownish = (p) => OWN_TEST.test(String((p && p.q) || "") + " " + String((p && p.w) || ""));

/**
 * One predicate as the set of facts it turns on.
 *
 * `other` IS THE FAIL-CLOSED CASE and it is why an unrecognised predicate can
 * never read as an open one: an empty token list would otherwise be produced
 * both by `USING (true)` and by `USING (status = 'live')`, so a hand-written
 * policy on somebody's table would compare equal to no policy at all.
 */
export function predicateShape(text) {
  const s = String(text || "");
  if (!s.trim()) return "";
  const out = [];
  if (/\bdeleted_at\b/i.test(s)) out.push("deleted_at");
  if (/\bexpires_at\b/i.test(s)) out.push("expires_at");
  if (/\bpublish_at\b/i.test(s)) out.push("publish_at");
  if (/\bteam_id\b/i.test(s)) out.push("team_id");
  if (OWN_TEST.test(s)) out.push("own");
  else if (/app_user_id\s*\(\s*\)\s*IS\s+NOT\s+NULL/i.test(s)) out.push("members");
  // Whatever is left once the recognised pieces are struck out. `true`, the
  // parens and the boolean glue are expected; anything else is a predicate this
  // vocabulary does not describe.
  //
  // THE TABLE QUALIFIER IS STRUCK FIRST, and forgetting it made every correct
  // pair read as a mismatch. `policiesFor` writes `"notes"."owner_id" =
  // app_user_id()` and Postgres stores `(owner_id = app_user_id())` — so the
  // emitted side carried a bare `notes` into the residue and fired `other` on
  // all four commands of every member table. Found by running both sides
  // through a real Postgres 16; no fixture would have shown it, because a
  // fixture writes both sides in one hand.
  const rest = s
    .replace(/"?[a-z_][a-z0-9_]*"?\s*\./gi, "")
    .replace(/\bdeleted_at\b|\bexpires_at\b|\bpublish_at\b|\bteam_id\b|\bowner_id\b/gi, "")
    .replace(/app_user_id\s*\(\s*\)|app_team_id\s*\(\s*\)/gi, "")
    .replace(/to_char\s*\(/gi, "(")
    .replace(/now\s*\(\s*\)|AT TIME ZONE|'UTC'|'YYYY-MM-DD HH24:MI:SS'/gi, "")
    .replace(/\bIS\s+NOT\s+NULL\b|\bIS\s+NULL\b|\bAND\b|\bOR\b|\btrue\b|\bNOT\b/gi, "")
    .replace(/::\s*\w+/g, "")
    .replace(/["'()\s.<>=]/g, "");
  if (rest) out.push("other");
  return out.sort().join("+");
}

/**
 * Read a balanced parenthesised group starting at the `(` at `from`.
 *
 * Exported so a guard building `pg_policies`-shaped fixtures out of the real
 * `policiesFor` reads a predicate the SAME way this does. A second, flat parser
 * on the test side truncates `((owner_id = app_user_id()) AND deleted_at IS
 * NULL)` at the first `)` and silently drops the token the comparison is about.
 */
export function readParens(text, from) {
  if (text[from] !== "(") return "";
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") { depth--; if (!depth) return text.slice(from + 1, i); }
  }
  return text.slice(from + 1);
}

/**
 * The policy shapes one CREATE POLICY statement carries: `{cmd, using, check}`.
 *
 * DEPTH-AWARE, never `[^)]*`. `USING ((a = b) AND (c IS NULL))` stops at the
 * first `)` under a flat scan — this repository's own most-repeated regex trap,
 * and the predicates here are nested by construction.
 */
export function statementShape(stmt) {
  const s = String(stmt || "");
  const m = /\bFOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b/i.exec(s);
  if (!/CREATE\s+POLICY/i.test(s) || !m) return null;
  const cmd = m[1].toUpperCase();
  const u = /\bUSING\s*\(/i.exec(s);
  const c = /\bWITH\s+CHECK\s*\(/i.exec(s);
  const using = u ? readParens(s, u.index + u[0].length - 1) : "";
  const check = c ? readParens(s, c.index + c[0].length - 1) : "";
  return { cmd, shape: predicateShape(using) + "|" + predicateShape(check) };
}

/** Every policy a table has, live, as `{cmd: shape}`. */
export function livePolicyShapes(policies, table) {
  const out = {};
  for (const p of Array.isArray(policies) ? policies : []) {
    if (!p || p.t !== table) continue;
    out[String(p.c || "ALL").toUpperCase()] = predicateShape(p.q) + "|" + predicateShape(p.w);
  }
  return out;
}

/** Every policy a declaration would emit, as `{cmd: shape}`. */
export function emittedPolicyShapes(statements) {
  const out = {};
  for (const s of Array.isArray(statements) ? statements : []) {
    const sh = statementShape(s);
    if (sh) out[sh.cmd] = sh.shape;
  }
  return out;
}

/**
 * What a role may really write, per privilege: `"*"` for a table-wide grant, or
 * the sorted column list for a column-scoped one.
 *
 * THE `lvl` COLUMN IS WHAT MAKES THIS ANSWERABLE — see `RECOVER_QUERIES.grants`.
 * `column_privileges` expands a table-level grant across every column, measured
 * on a real Postgres 16, so the column list means "column-scoped" only where
 * `role_table_grants` has no row for the same pair.
 */
export function liveGrantAccess(grants, table) {
  const tableLevel = new Set(), cols = new Map();
  for (const g of Array.isArray(grants) ? grants : []) {
    if (!g || g.t !== table) continue;
    const key = String(g.g || "") + ":" + String(g.p || "").toUpperCase();
    if (String(g.lvl || "table") === "table") tableLevel.add(key);
    else {
      if (!cols.has(key)) cols.set(key, new Set());
      cols.get(key).add(String(g.col || "").toLowerCase());
    }
  }
  const out = {};
  for (const key of tableLevel) out[key] = "*";
  for (const [key, set] of cols) if (!out[key]) out[key] = [...set].sort();
  return out;
}

/**
 * The same shape, read off our own emitted GRANT statements.
 *
 * THE VERB COMES FROM BEFORE THE `ON`, because `GRANT SELECT ON "update"`
 * contains the word UPDATE — the recorded on-split finding, which diverged on
 * 7 of 16 cells for a table with that name.
 */
export function emittedGrantAccess(statements) {
  const out = {};
  for (const raw of Array.isArray(statements) ? statements : []) {
    const s = String(raw || "");
    const m = /^\s*GRANT\s+([\s\S]*?)\s+ON\s+/i.exec(s);
    if (!m) continue;
    const to = /\bTO\s+([a-z_][a-z0-9_]*)/i.exec(s);
    if (!to) continue;
    const role = to[1];
    for (const { verb, cols } of splitPrivileges(m[1])) {
      out[role + ":" + verb] = cols ? cols.slice().sort() : "*";
    }
  }
  return out;
}

/**
 * `SELECT, DELETE` or `INSERT ("a","b"), UPDATE ("a","b")` into its entries.
 *
 * SPLIT AT DEPTH ZERO, because a column list contains the commas this is
 * splitting on. A flat `split(",")` read `INSERT ("body","title"), UPDATE
 * ("body","title")` as the verb `INSERT` with the columns
 * `["body", "body)", "title", "update(title"]` — the repository's own
 * most-repeated regex trap, on the emitter for the member-write cell, which is
 * `user` and `feed`: half the platform. Found by a real Postgres disagreeing
 * with it, not by reading it.
 */
export function splitPrivileges(head) {
  const s = String(head || "");
  const parts = [];
  let depth = 0, at = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) { parts.push(s.slice(at, i)); at = i + 1; }
  }
  parts.push(s.slice(at));
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    const withCols = /^([A-Za-z]+)\s*\(([\s\S]*)\)$/.exec(t);
    if (withCols) {
      out.push({
        verb: withCols[1].toUpperCase(),
        cols: withCols[2].split(",").map((c) => c.replace(/["\s]/g, "").toLowerCase()).filter(Boolean),
      });
    } else out.push({ verb: t.toUpperCase(), cols: null });
  }
  return out;
}

/** Is `a` within `b`? `"*"` is the universal set on either side. */
function within(a, b) {
  if (b === "*") return true;
  if (a === "*") return false;
  const have = new Set(Array.isArray(b) ? b : []);
  return (Array.isArray(a) ? a : []).every((x) => have.has(x));
}

/**
 * IS THIS DECLARATION SAFE TO STORE? — the wall, run through the real emitters.
 *
 * Two comparisons with two different verdicts, and the asymmetry is the point:
 *
 *   POLICIES, EXACTLY. Every apply DROPs and re-CREATEs a table's policies from
 *   its declaration, so the live policy set IS the fingerprint of the true
 *   declaration. Any difference is a difference this recovery would cause.
 *
 *   GRANTS, ONE-SIDED. A site that has had no schema change since 2026-09-13
 *   still carries table-wide write grants, and the next apply narrows them to
 *   columns — the platform's own fix, not damage from here. So the only
 *   question asked is whether this declaration could let a client reach
 *   something the database does not already let them reach.
 */
export function verifyDeclaration({ table, declared, live = {}, emit = null } = {}) {
  if (!emit || typeof emit.policiesFor !== "function" || typeof emit.grantsFor !== "function") {
    return { ok: false, why: "no-emitters" };
  }
  const columns = Array.isArray(live.columns) ? live.columns : [];
  // THE COLUMNS REALLY CREATED, which is what a real apply hands `grantsFor`.
  // Handing it the declared list instead would compare against a grant the
  // engine would never emit.
  const created = columns.filter((r) => r && r.t === table).map((r) => String(r.c || ""));

  let policyStmts, grantStmts;
  try {
    policyStmts = emit.policiesFor(declared);
    grantStmts = emit.grantsFor(declared, created);
  } catch (e) {
    return { ok: false, why: "emitter-threw", detail: String((e && e.message) || e).slice(0, 160) };
  }

  const liveP = livePolicyShapes(live.policies, table);
  const mineP = emittedPolicyShapes(policyStmts);
  const cmds = [...new Set([...Object.keys(liveP), ...Object.keys(mineP)])].sort();
  const policyDiff = cmds.filter((c) => (liveP[c] || "") !== (mineP[c] || ""))
    .map((c) => ({ cmd: c, live: liveP[c] || "(none)", would: mineP[c] || "(none)" }));
  if (policyDiff.length) return { ok: false, why: "policy-would-change", policyDiff };

  const liveG = liveGrantAccess(live.grants, table);
  const mineG = emittedGrantAccess(grantStmts);
  const grantDiff = [];
  for (const key of Object.keys(mineG)) {
    if (!within(mineG[key], liveG[key] === undefined ? [] : liveG[key])) {
      grantDiff.push({ grant: key, live: liveG[key] === undefined ? "(none)" : liveG[key], would: mineG[key] });
    }
  }
  if (grantDiff.length) return { ok: false, why: "grant-would-widen", grantDiff };

  return { ok: true, why: "policies-match-and-grants-do-not-widen" };
}

/**
 * A table's `{read, write}` as the DATABASE has it, or `null` when the evidence
 * does not separate two levels.
 *
 * The inverse of `grantsFor` in `site-rls.mjs`, and it is written as the inverse
 * on purpose: every branch below names the statement that produced it, so the
 * two can be read side by side when one of them changes.
 */
const has = (rows, table, grantee, priv) =>
  (Array.isArray(rows) ? rows : []).some((r) => r && r.t === table && r.g === grantee && String(r.p || "").toUpperCase() === priv);

export function deriveAccess({ table, grants = [], policies = [], policiesRead = true } = {}) {
  const pol = policies.filter((p) => p && p.t === table);
  const sel = pol.find((p) => /SELECT|ALL/i.test(String(p.c || "")));
  const upd = pol.find((p) => /UPDATE|INSERT|ALL/i.test(String(p.c || "")));

  // READ. `GRANT SELECT … TO anonymous` is emitted only for `read: "public"`.
  // Otherwise a member SELECT means `own` or `members`, told apart by the
  // policy; no SELECT to either role is `read: "none"` — the write-only
  // guarantee, which is the ABSENCE of a statement.
  let read = null;
  if (has(grants, table, ROLES.anon, "SELECT")) read = "public";
  else if (has(grants, table, ROLES.user, "SELECT")) {
    if (!policiesRead || !sel) read = null; // cannot separate own from members
    else read = ownish(sel) ? "own" : "members";
  } else read = "none";

  // WRITE. Same shape. A payable table emits no write grant at all, so it
  // derives as `write: "none"` — true of the GRANTS, and `payment` is derived
  // separately from the columns it owns.
  let write = null;
  if (has(grants, table, ROLES.anon, "INSERT")) write = "anyone";
  else if (has(grants, table, ROLES.user, "INSERT") || has(grants, table, ROLES.user, "UPDATE")) {
    if (!policiesRead || !upd) write = null;
    else write = ownish(upd) ? "own" : "members";
  } else write = "none";

  if (read === null || write === null) return null;
  return { read, write };
}

/**
 * THE RECONCILE.
 *
 * `stored` — the spec as `_meta.schema` has it (may be `{tables: []}`).
 * `live`   — `{ columns, grants, policies, triggers, policiesRead }`.
 * `prior`  — AUTHORITATIVE PRIOR METADATA, where a caller has any: declarations
 *            from a store that recorded them, preferred VERBATIM over anything
 *            derived here, and still verified before being stored.
 * `emit`   — `{ policiesFor, grantsFor }`, the real ones.
 *
 * THIS REPOSITORY HAS NO AUTOMATIC SOURCE FOR `prior`, and saying so is better
 * than implying one: the migration record keeps table NAMES only
 * (`site-migrations.mjs`'s `names()`), and `source/<slug>/addon-answer.json`
 * holds one file per site, overwritten by each addon — so run 46's declaration
 * of `bookings` was gone before run 47 finished. The parameter exists because a
 * caller may have a file, and because a derived declaration should never be
 * preferred to a recorded one when both are in hand.
 *
 * Answers `{ spec, recovered, uncertain, ambiguous, kept, unprovable, changed }`:
 *
 *   recovered  — put back, each with its derived access, flags and evidence.
 *   uncertain  — NOT put back: the round-trip says storing it would change
 *                behaviour. Left out entirely, so the next apply does not touch
 *                that table at all and its policies stay exactly as they are.
 *   ambiguous  — NOT put back: the access pair could not be derived.
 *
 * STORED ENTRIES ARE NEVER TOUCHED. A stored table carries metadata no catalog
 * can rebuild, so even where the database disagrees with it the stored entry
 * wins — this repairs an OMISSION, and rewriting a declaration somebody's site
 * is running on is a different and much larger decision.
 */
export function reconcileSpec({ stored = null, live = {}, prior = null, emit = null } = {}) {
  const base = stored && typeof stored === "object" ? stored : {};
  const storedTables = Array.isArray(base.tables) ? base.tables : [];
  const kept = storedTables.map((t) => t && t.name).filter(Boolean);
  const known = new Set(kept.map((n) => String(n).toLowerCase()));

  const cols = Array.isArray(live.columns) ? live.columns : [];
  const grants = Array.isArray(live.grants) ? live.grants : [];
  const policies = Array.isArray(live.policies) ? live.policies : [];
  const triggers = Array.isArray(live.triggers) ? live.triggers : [];
  const policiesRead = live.policiesRead !== false;
  const priorBy = new Map((Array.isArray(prior) ? prior : [])
    .filter((t) => t && t.name).map((t) => [String(t.name).toLowerCase(), t]));

  // Column rows in, one entry per table out, order preserved.
  const byTable = new Map();
  for (const r of cols) {
    if (!r || !r.t || isInternalName(r.t)) continue;
    if (!byTable.has(r.t)) byTable.set(r.t, []);
    byTable.get(r.t).push({ name: r.c, type: String(r.ty || "text") });
  }

  const recovered = [], ambiguous = [], uncertain = [], add = [];
  for (const [name, columns] of byTable) {
    if (known.has(String(name).toLowerCase())) continue;

    // A FLAG WHOSE VALUE CANNOT BE DERIVED STOPS THE TABLE, before anything is
    // built for it — and before the round-trip, which cannot see it (a payable
    // table's permission surface is empty either way). A caller holding real
    // prior metadata is exempt, because then the value is not being derived.
    const here = new Set(columns.map((c) => String(c.name).toLowerCase()));
    const fromPrior = priorBy.get(String(name).toLowerCase()) || null;
    if (!fromPrior) {
      const blocked = UNDERIVABLE_EVIDENCE.find((e) => e.columns.some((c) => here.has(String(c).toLowerCase())));
      if (blocked) { uncertain.push({ name, source: "derived", why: blocked.why }); continue; }
    }
    let candidate, source;
    if (fromPrior) {
      candidate = { ...fromPrior, name };
      source = "prior";
    } else {
      const access = deriveAccess({ table: name, grants, policies, policiesRead });
      if (!access) { ambiguous.push({ name, why: "access-not-derivable" }); continue; }
      // MANAGED COLUMNS ARE LEFT OUT of the recovered declaration, because the
      // engine CREATES them from the table's own flags. Declaring `deleted_at`
      // as an ordinary column would put it in the write grant, which is the
      // widening the verification below refuses.
      const declared = columns.filter((c) => !MANAGED_COLUMNS.has(String(c.name).toLowerCase()));
      candidate = { name, columns: declared, read: access.read, write: access.write, ...deriveFlags({ table: name, columns: cols, triggers }) };
      source = "derived";
    }

    const check = verifyDeclaration({ table: name, declared: candidate, live: { columns: cols, grants, policies }, emit });
    if (!check.ok) {
      uncertain.push({ name, source, why: check.why, ...(check.policyDiff ? { policyDiff: check.policyDiff } : {}), ...(check.grantDiff ? { grantDiff: check.grantDiff } : {}) });
      continue;
    }
    add.push(candidate);
    const flags = Object.keys(candidate).filter((k) => !["name", "columns", "read", "write"].includes(k));
    recovered.push({ name, source, read: candidate.read, write: candidate.write, columns: (candidate.columns || []).length, flags });
  }

  const spec = { ...base, tables: [...storedTables, ...add] };
  return {
    spec,
    recovered,
    uncertain,
    ambiguous,
    kept,
    changed: add.length > 0,
    unprovable: add.length ? UNPROVABLE_FLAGS.slice() : [],
  };
}

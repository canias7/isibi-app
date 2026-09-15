// PUTTING BACK A TABLE THE STORED SCHEMA FORGOT.
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
// WHAT CAN BE PROVEN AND WHAT CANNOT, stated rather than papered over. The
// catalog proves a table's name, its columns and — through the grants and the
// policies the engine itself emitted — its `read`/`write` pair. It cannot prove
// `payment`, `timestamps`, `writeRoles`, `trash`, `ordered` or any other
// application flag, because those leave no distinguishable trace once their DDL
// has run. So a recovered entry carries what the database can show and is
// REPORTED as recovered; the caller tells somebody. Inventing a flag would be
// the recorded "cannot-tell must never read as a value", in a writer.
//
// AND AN AMBIGUOUS ACCESS IS REFUSED, NEVER GUESSED. `read: "own"` and
// `read: "members"` differ only in the SELECT policy's predicate, and `write`
// the same way — so with the policies unread the two are indistinguishable and
// this answers `null`. A table whose access cannot be derived is left out of
// the recovery and named, because writing a wrong pair back would have the NEXT
// apply re-issue grants that change who can read a live table.
//
// Dependency-free and pure. The queries are exported as strings so the script
// that runs them and the guard that drives this module read one copy.

/** The catalog reads this module's inputs come from. One copy, three readers. */
export const RECOVER_QUERIES = {
  // Base tables in `public`, with their columns, ordered so the answer is stable.
  columns:
    "SELECT c.table_name AS t, c.column_name AS c, c.data_type AS ty " +
    "FROM information_schema.columns c " +
    "JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name " +
    "WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE' " +
    "ORDER BY c.table_name, c.ordinal_position",
  // Table-level AND column-level privileges both matter: since 2026-09-13 the
  // write grants are column-scoped, so a table that looks ungranted at the
  // table level may hold `GRANT INSERT ("a","b")`. Reading only
  // `role_table_grants` would derive `write: "none"` for every booking form on
  // the platform.
  grants:
    "SELECT table_name AS t, grantee AS g, privilege_type AS p FROM information_schema.role_table_grants " +
    "WHERE table_schema = 'public' " +
    "UNION " +
    "SELECT table_name AS t, grantee AS g, privilege_type AS p FROM information_schema.column_privileges " +
    "WHERE table_schema = 'public'",
  policies:
    "SELECT tablename AS t, cmd AS c, coalesce(qual,'') AS q, coalesce(with_check,'') AS w " +
    "FROM pg_policies WHERE schemaname = 'public'",
};

/** The two Data API roles, spelled as Postgres reports them. */
export const ROLES = { anon: "anonymous", user: "authenticated" };

/** A row is internal when its name starts with `_`. The engine's own prefix. */
export const isInternalName = (n) => /^_/.test(String(n || ""));

const has = (rows, table, grantee, priv) =>
  rows.some((r) => r && r.t === table && r.g === grantee && String(r.p || "").toUpperCase() === priv);

/**
 * Does a policy predicate key on the caller's identity — `own`, not `members`?
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
 * live table's access on the next apply. What separates them is the EQUALITY:
 * `own` compares a column to the caller, `members` only asserts there is one.
 *
 * Asked on BOTH the USING and the WITH CHECK text, because an INSERT policy
 * carries only the latter — reading one alone would call every insert-only
 * `own` table `members`, which is the widening of the same mistake.
 */
const ownish = (p) => /app_user_id\s*\(\s*\)\s*=|=\s*app_user_id\s*\(/i.test(String((p && p.q) || "") + " " + String((p && p.w) || ""));

/**
 * A table's `{read, write}` as the DATABASE has it, or `null` when the evidence
 * does not separate two levels.
 *
 * The inverse of `grantsFor` in `site-rls.mjs`, and it is written as the inverse
 * on purpose: every branch below names the statement that produced it, so the
 * two can be read side by side when one of them changes.
 */
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
  // derives as `write: "none"` — true of the GRANTS and silent about the
  // `payment` flag, which is named in `unprovable` below rather than invented.
  let write = null;
  if (has(grants, table, ROLES.anon, "INSERT")) write = "anyone";
  else if (has(grants, table, ROLES.user, "INSERT") || has(grants, table, ROLES.user, "UPDATE")) {
    if (!policiesRead || !upd) write = null;
    else write = ownish(upd) ? "own" : "members";
  } else write = "none";

  if (read === null || write === null) return null;
  return { read, write };
}

/** Flags a catalog read can never prove, named so a caller can say so. */
export const UNPROVABLE_FLAGS = ["payment", "timestamps", "writeRoles", "trash", "ordered", "audit", "history", "sync", "slug"];

/**
 * The columns the engine writes for itself: `id` and `created_at` with the
 * table, the rest from the table's own flags (`owner_id` on a member-scoped
 * pair, `deleted_at` from `trash`, `updated_at` from `timestamps`/`sync`,
 * `position` from `ordered`, `pinned` from `pinnable` — `site-schema.mjs`
 * around 1174–1251).
 *
 * A recovered table declares NONE of them, because the engine creates them
 * from the flags; declaring `id` as an ordinary column would have the next
 * apply try to add a column that is already there under another definition.
 *
 * DECLARED ABOVE ITS ONLY READER, which in this file is a function and so
 * would have been safe either way — but "a `const` called above its own line"
 * is this repository's own recorded trap and the cheap habit is to not have
 * to think about which side of it a new caller lands on.
 */
export const MANAGED_COLUMNS = new Set([
  "id", "created_at", "updated_at", "owner_id", "deleted_at", "pinned", "position",
]);

/**
 * THE RECONCILE.
 *
 * `stored` — the spec as `_meta.schema` has it (may be `{tables: []}`).
 * `live`   — `{ columns, grants, policies, policiesRead }`, the catalog rows.
 *
 * Answers `{ spec, recovered, ambiguous, kept, unprovable, changed }`:
 *
 *   spec       — the reconciled spec, safe to write back.
 *   recovered  — names put back, each with the access derived for it.
 *   ambiguous  — names NOT put back because their access could not be derived.
 *   kept       — stored names left exactly as they were.
 *   changed    — false when nothing was recovered, so a caller can skip the write.
 *
 * STORED ENTRIES ARE NEVER TOUCHED. A stored table carries metadata no catalog
 * can rebuild, so even where the database disagrees with it the stored entry
 * wins — this repairs an OMISSION, and rewriting a declaration somebody's site
 * is running on is a different and much larger decision.
 */
export function reconcileSpec({ stored = null, live = {} } = {}) {
  const base = stored && typeof stored === "object" ? stored : {};
  const storedTables = Array.isArray(base.tables) ? base.tables : [];
  const kept = storedTables.map((t) => t && t.name).filter(Boolean);
  const known = new Set(kept.map((n) => String(n).toLowerCase()));

  const cols = Array.isArray(live.columns) ? live.columns : [];
  const grants = Array.isArray(live.grants) ? live.grants : [];
  const policies = Array.isArray(live.policies) ? live.policies : [];
  const policiesRead = live.policiesRead !== false;

  // Column rows in, one entry per table out, order preserved.
  const byTable = new Map();
  for (const r of cols) {
    if (!r || !r.t || isInternalName(r.t)) continue;
    if (!byTable.has(r.t)) byTable.set(r.t, []);
    byTable.get(r.t).push({ name: r.c, type: String(r.ty || "text") });
  }

  const recovered = [], ambiguous = [], add = [];
  for (const [name, columns] of byTable) {
    if (known.has(String(name).toLowerCase())) continue;
    const access = deriveAccess({ table: name, grants, policies, policiesRead });
    if (!access) { ambiguous.push({ name, why: "access-not-derivable" }); continue; }
    // MANAGED COLUMNS ARE LEFT OUT of the recovered declaration, because the
    // engine CREATES them from the table's own flags. Declaring `id` or
    // `created_at` as an ordinary column would have the next apply try to add a
    // column that is already there under a different definition.
    const declared = columns.filter((c) => !MANAGED_COLUMNS.has(String(c.name).toLowerCase()));
    add.push({ name, columns: declared, read: access.read, write: access.write });
    recovered.push({ name, read: access.read, write: access.write, columns: declared.length });
  }

  const spec = { ...base, tables: [...storedTables, ...add] };
  return {
    spec,
    recovered,
    ambiguous,
    kept,
    changed: add.length > 0,
    unprovable: add.length ? UNPROVABLE_FLAGS.slice() : [],
  };
}

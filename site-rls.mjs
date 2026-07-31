// Row-level security for a site's tables.
//
// Access control has lived in the Worker since the schema engine was written:
// `site-data.mjs` decides whether a caller may read a table and appends
// `owner_id=?` to their query. That works and is tested — and it only works for
// callers that come THROUGH the Worker. Postgres itself will hand any connected
// role every row.
//
// This puts the same rules in the database. The immediate reason is Neon's Data
// API: it serves tables directly over REST as the `anon` and `authenticated`
// roles, so without policies it is either everything or nothing. The better
// reason is that a rule the database enforces cannot be forgotten by a new route.
//
// **These policies are the destination, not a second opinion.** The direction is
// Neon-only (owner's call, 2026-07-30): the Worker's `/api/db` data routes go, and
// the published site talks to Neon's Data API directly, so what is written here
// becomes the ONLY thing standing between a stranger and a booking list.
//
// They land BEFORE that happens, and that ordering is the whole safety property.
// Applying them changes nothing for anyone today — a table's owner bypasses its
// policies and the Worker connects as the owner — so they can be written, reviewed
// and asserted while the tested Worker path is still carrying the traffic. The
// alternative was to delete and replace in one step, where a policy that permits
// one clause too much is discovered by a customer.
//
// Why enabling RLS is safe for everything that exists today: a table's OWNER
// bypasses its policies unless `FORCE ROW LEVEL SECURITY` is set, and the Worker
// connects as the owner. So turning this on changes nothing about the current
// data path — it only decides what a DIFFERENT role would be allowed to see, and
// no such role has been granted anything yet.
//
// Pure string building. Every statement this produces is asserted in
// test/site-rls.test.mjs and applied against a real Postgres in the e2e.

/**
 * Who the caller is, according to the database.
 *
 * **`pg_session_jwt` is NEON'S OWN extension for exactly this**, and it is on the
 * available list (0.5.0, measured 2026-07-30 by asking
 * `pg_available_extensions` rather than guessing names). It verifies the session
 * JWT inside Postgres and exposes `auth.user_id()`. The first version of this file
 * hand-rolled the same thing out of `current_setting('request.jwt.claims')` —
 * PostgREST's convention, and a guess I flagged as one.
 *
 * Both forms are emitted, chosen by whether the extension actually installed,
 * because the fallback is not dead weight: a project where the extension is
 * unavailable would otherwise get a function that fails to parse, and every policy
 * built on it would fail with it.
 *
 * `true` as the second argument to `current_setting` is missing_ok — without it the
 * fallback RAISES whenever the setting is unset, which is every connection the
 * Worker makes, turning each policy into an error rather than a refusal.
 *
 * Returns UUID either way, because `neon_auth."user".id` is a uuid and so is
 * `owner_id`.
 */
export const SESSION_JWT_EXT = "CREATE EXTENSION IF NOT EXISTS pg_session_jwt;";

export const APP_USER_FN_NATIVE = `
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.user_id(), '')::uuid
$$;`;

export const APP_USER_FN_FALLBACK = `
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;`;

/** Kept as the default export name so callers do not have to know which won. */
export const APP_USER_FN = APP_USER_FN_FALLBACK;

/** Every policy this module creates is named with this prefix, so they can be replaced idempotently. */
export const POLICY_PREFIX = "isibi_";

const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';

/**
 * The policies for one table.
 *
 * Returns a list of statements. Ordering matters only in that the DROPs come
 * first: `CREATE POLICY` has no `IF NOT EXISTS`, and a revise re-runs all of this,
 * so each policy is dropped and recreated rather than left to fail. Dropping is
 * `IF EXISTS`, which makes the first run and every later one identical.
 *
 * The access levels are the same five the Worker enforces, and each maps to a
 * different SHAPE of policy rather than a different filter:
 *
 *   display — anyone reads, nobody writes. A menu, a price list.
 *   collect — anyone writes, NOBODY reads. A booking form. The absence of a
 *             SELECT policy is what makes it write-only: with RLS on, no policy
 *             means no rows, so this is enforced by omission and cannot be
 *             weakened by adding a filter to the wrong clause.
 *   user    — a signed-in member reads and writes their OWN rows, or their team's
 *             when the table is team-shared.
 *   feed    — any signed-in member reads everything; each writes their own.
 *   admin   — any signed-in member reads; writes are left to the Worker, because
 *             the roles a table names in `writeRoles` are ours and not something
 *             the database has been told about.
 */
export function policiesFor(t) {
  const access = String((t && t.access) || "collect").toLowerCase();
  const tn = q(t.name);
  const p = (suffix) => q(POLICY_PREFIX + t.name + "_" + suffix);
  const out = [`ALTER TABLE ${tn} ENABLE ROW LEVEL SECURITY;`];

  // Named so a site built before this, or one whose access level CHANGED on a
  // revise, does not keep a policy from its previous shape. A display table that
  // became `user` would otherwise still be readable by everyone.
  for (const s of ["read", "insert", "update", "delete"]) {
    out.push(`DROP POLICY IF EXISTS ${p(s)} ON ${tn};`);
  }

  // A soft-deleted row is gone as far as any reader is concerned. Applied in the
  // policy as well as in the Worker's query, or the Data API would serve rows the
  // site itself treats as deleted.
  const live = t && t.trash ? ` AND ${tn}."deleted_at" IS NULL` : "";
  const signedIn = "app_user_id() IS NOT NULL";
  // The team widening, and the null case is the one that matters: a member in no
  // organization must fall back to their own rows. `team_id = app_...` would be
  // null = null, which is NULL and therefore not true — correct here by accident,
  // so it is written explicitly instead of relied on.
  const mine = `${tn}."owner_id" = app_user_id()`;
  const ours = (t && t.teamScope && access === "user")
    ? `(${mine} OR (${tn}."team_id" IS NOT NULL AND ${tn}."team_id" = (SELECT m."organizationId" FROM neon_auth.member m WHERE m."userId" = app_user_id() ORDER BY m."createdAt" ASC NULLS LAST LIMIT 1)))`
    : `(${mine})`;

  if (access === "display") {
    out.push(`CREATE POLICY ${p("read")} ON ${tn} FOR SELECT USING (true${live});`);
    return out; // no write policy: content is the owner's, changed through their own door
  }
  if (access === "collect") {
    // Write-only. No SELECT policy at all, deliberately — see above.
    out.push(`CREATE POLICY ${p("insert")} ON ${tn} FOR INSERT WITH CHECK (true);`);
    return out;
  }
  if (access === "user") {
    out.push(`CREATE POLICY ${p("read")} ON ${tn} FOR SELECT USING (${ours}${live});`);
    // WITH CHECK on the NEW row, so a member cannot insert a row owned by somebody
    // else. USING on the existing row for an update, so they cannot reach one.
    out.push(`CREATE POLICY ${p("insert")} ON ${tn} FOR INSERT WITH CHECK (${mine});`);
    out.push(`CREATE POLICY ${p("update")} ON ${tn} FOR UPDATE USING (${ours}) WITH CHECK (${ours});`);
    out.push(`CREATE POLICY ${p("delete")} ON ${tn} FOR DELETE USING (${ours});`);
    return out;
  }
  if (access === "feed") {
    out.push(`CREATE POLICY ${p("read")} ON ${tn} FOR SELECT USING (${signedIn}${live});`);
    out.push(`CREATE POLICY ${p("insert")} ON ${tn} FOR INSERT WITH CHECK (${mine});`);
    out.push(`CREATE POLICY ${p("update")} ON ${tn} FOR UPDATE USING (${mine}) WITH CHECK (${mine});`);
    out.push(`CREATE POLICY ${p("delete")} ON ${tn} FOR DELETE USING (${mine});`);
    return out;
  }
  // admin. Read for anyone signed in; writing is the Worker's call, because
  // `writeRoles` names roles that mean something to this application and nothing
  // to Postgres. Omitting the write policy REFUSES the write at the database,
  // which is the safe direction — the Worker's own door still allows it.
  out.push(`CREATE POLICY ${p("read")} ON ${tn} FOR SELECT USING (${signedIn}${live});`);
  return out;
}

/**
 * Whether anything outside the Worker may reach these tables at all.
 *
 * Policies decide what a role MAY see; a GRANT decides whether it can ask. Both
 * are needed, and they are deliberately separate calls: enabling RLS and writing
 * policies changes nothing for anyone, while granting is the step that makes a
 * table reachable over Neon's Data API. Nothing calls this yet, and when
 * something does it should be per-site and off by default.
 */
export function grantsFor(t) {
  const access = String((t && t.access) || "collect").toLowerCase();
  const tn = q(t.name);
  if (access === "display") return [`GRANT SELECT ON ${tn} TO anon, authenticated;`];
  if (access === "collect") return [`GRANT INSERT ON ${tn} TO anon, authenticated;`];
  if (access === "admin") return [`GRANT SELECT ON ${tn} TO authenticated;`];
  return [`GRANT SELECT, INSERT, UPDATE, DELETE ON ${tn} TO authenticated;`];
}

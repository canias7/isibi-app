// THE SITE'S LIMITED LOGIN (2026-10-26, owner: "a second, limited login used
// for everyday work, so a bug or a leaked password can only change rows, never
// drop or alter tables or change permissions").
//
// Every site database has had ONE login: the Neon project's owner role, which
// owns every table and may create, alter and drop anything, grant anything, and
// bypasses row-level security as the tables' owner. This adds a second Postgres
// role per site database, `<db>_app`, that can only read and write rows:
//
//   - LOGIN, and NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
//     NOBYPASSRLS, a member of no other role, the owner of nothing;
//   - CONNECT on its own database, USAGE (never CREATE) on `public`;
//   - SELECT/INSERT/UPDATE/DELETE on every table, USAGE/SELECT on every
//     sequence, EXECUTE on every function in `public`, and the same by default
//     for whatever the owner creates there later (ALTER DEFAULT PRIVILEGES);
//   - ONE ROW POLICY per RLS table, `gf_app_rows`, `TO <db>_app USING (true)
//     WITH CHECK (true)`. Today every server path connects as the tables'
//     owner, and an owner is not subject to its tables' policies — so the
//     Worker's own reads and writes see every row and the Worker applies its
//     own filters (`owner_id = ?`). The policy keeps that EXACTLY for this
//     role without the BYPASSRLS attribute: RLS still applies to it (a table
//     with RLS and no `gf_app_rows` policy returns it nothing), the visitor
//     roles (`anonymous`, `authenticated`) are untouched, and dropping the
//     policy takes the access away.
//
// MADE IN SQL, NOT THROUGH NEON'S ROLES ENDPOINT. A role created by the Neon
// API is made a member of `neon_superuser` (CREATEROLE, CREATEDB, BYPASSRLS
// through membership): exactly the powers this login exists not to have. SQL
// run on the owner's own connection states every attribute, and the check at
// the end (`APP_ROLE_CHECK_SQL`) reads them back from `pg_roles` and refuses
// a role that is anything more than a row login. Nothing is stored unless the
// check passes.
//
// THE PASSWORD: 32 random bytes as hex, made here, written into the ALTER
// ROLE statement (a utility statement takes no parameters; hex can hold no
// quote) and into the connection string, and nowhere else. Neither statement
// text nor connection string is ever logged or returned: an error is rethrown
// with its message scrubbed of both (`safeLoginError`).

import { sqlQuery } from "./site-db.mjs";

export const APP_ROLE_SUFFIX = "_app";
/** The row policy's name, one per RLS table (see `site-rls.mjs`'s `appRowPolicySql`). */
export const APP_ROW_POLICY = "gf_app_rows";

/** `<db>_app`, at most 63 characters (Postgres's name limit): the database name cut to 59. */
export function appRoleName(dbName) {
  const d = String(dbName || "");
  if (!/^[a-z0-9_]{1,63}$/.test(d)) throw Object.assign(new Error("not a site database name"), { bad: true });
  return d.slice(0, 63 - APP_ROLE_SUFFIX.length) + APP_ROLE_SUFFIX;
}

/** A fresh password: 32 random bytes, hex. */
export function newAppPassword() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const HEX_PASSWORD = /^[0-9a-f]{32,128}$/;

/**
 * The role's statements, in order, every one idempotent: run twice, the
 * second run changes nothing but the password. `owner`-side, so the default
 * privileges are the owner's (the role that creates the site's tables).
 */
export function appLoginStatements(dbName, password) {
  const role = appRoleName(dbName);
  if (!HEX_PASSWORD.test(String(password || ""))) throw new Error("the limited login's password must be hex");
  const r = '"' + role + '"';
  const lit = "'" + role + "'";
  return [
    // CREATE only when absent (CREATE ROLE has no IF NOT EXISTS). The NO*
    // attributes are the defaults, stated so nobody has to know that.
    `DO $gf$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${lit}) THEN CREATE ROLE ${r} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS; END IF; END $gf$`,
    // Only LOGIN and the password on an existing role: naming SUPERUSER,
    // REPLICATION or BYPASSRLS at all in an ALTER needs a superuser, which the
    // owner is not. The check below reads them instead.
    `ALTER ROLE ${r} WITH LOGIN PASSWORD '${password}'`,
    // No CREATE on `public` for anyone but its owner (already so on Postgres
    // 15 and later; this closes Postgres 14's PUBLIC default).
    `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
    `REVOKE CREATE ON SCHEMA public FROM ${r}`,
    `GRANT CONNECT ON DATABASE "${dbName}" TO ${r}`,
    `GRANT USAGE ON SCHEMA public TO ${r}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${r}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${r}`,
    `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${r}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${r}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${r}`,
    // The row policy on every table that has RLS on today; a table made later
    // gets it from `applySiteSchema` (`appRowPolicySql`).
    `DO $gf$ DECLARE t text; BEGIN FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity LOOP EXECUTE format('DROP POLICY IF EXISTS ${APP_ROW_POLICY} ON public.%I', t); EXECUTE format('CREATE POLICY ${APP_ROW_POLICY} ON public.%I TO %I USING (true) WITH CHECK (true)', t, ${lit}); END LOOP; END $gf$`,
  ];
}

/**
 * The read-back: one row, every field must come back as below or the login is
 * refused (never stored). `owns` counts what the role owns in this database;
 * `member_of` the roles it belongs to; `can_create` CREATE on `public`.
 */
export function appRoleCheckSql(dbName) {
  const lit = "'" + appRoleName(dbName) + "'";
  return "SELECT r.rolcanlogin AS login, r.rolsuper AS super, r.rolcreatedb AS createdb, r.rolcreaterole AS createrole, " +
    "r.rolreplication AS replication, r.rolbypassrls AS bypassrls, r.rolinherit AS inherit, " +
    "(SELECT count(*)::int FROM pg_auth_members m WHERE m.member = r.oid) AS member_of, " +
    "(SELECT count(*)::int FROM pg_class c WHERE c.relowner = r.oid) AS owns, " +
    "has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create " +
    "FROM pg_roles r WHERE r.rolname = " + lit;
}

/**
 * THE ROW POLICY FOR ONE TABLE, emitted by `applySiteSchema` after the table's
 * own policies, so a table made after the login keeps the same access the
 * login has on the others. The role is named from the database the statement
 * runs in (`left(current_database(), 59) || '_app'`, `appRoleName`'s rule), and
 * nothing happens on a database whose site has no limited login yet.
 */
export function appRowPolicySql(table) {
  const lit = "'" + String(table || "").replace(/'/g, "''") + "'";
  return `DO $gf$ DECLARE r text := left(current_database(), ${63 - APP_ROLE_SUFFIX.length}) || '${APP_ROLE_SUFFIX}'; BEGIN ` +
    `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN ` +
    `EXECUTE format('DROP POLICY IF EXISTS ${APP_ROW_POLICY} ON public.%I', ${lit}); ` +
    `EXECUTE format('CREATE POLICY ${APP_ROW_POLICY} ON public.%I TO %I USING (true) WITH CHECK (true)', ${lit}, r); ` +
    `END IF; END $gf$`;
}

/** What the read-back must say. Anything else, or no row, is a refusal. */
export const APP_ROLE_EXPECTED = Object.freeze({
  login: true, super: false, createdb: false, createrole: false, replication: false,
  bypassrls: false, inherit: false, member_of: 0, owns: 0, can_create: false,
});

/** The fields that disagree with `APP_ROLE_EXPECTED` (all of them when there is no row). */
export function appRoleProblems(row) {
  if (!row || typeof row !== "object") return Object.keys(APP_ROLE_EXPECTED);
  return Object.keys(APP_ROLE_EXPECTED).filter((k) => !Object.hasOwn(row, k) || row[k] !== APP_ROLE_EXPECTED[k]);
}

/** The owner's connection with the limited role's name and password, same host and database. */
export function appConnFor(ownerDbConn, dbName, password) {
  const u = new URL(ownerDbConn);
  u.username = appRoleName(dbName);
  u.password = password;
  u.pathname = "/" + dbName;
  return u.toString();
}

/** The database a connection string names. */
export function dbNameOfConn(conn) {
  return decodeURIComponent(new URL(conn).pathname.replace(/^\//, ""));
}

/** An error's text with every connection string and the password taken out. */
export function safeLoginError(e, password) {
  let s = String((e && e.message) || e || "");
  s = s.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[redacted]");
  if (password) s = s.split(password).join("[redacted]");
  return s.replace(/PASSWORD\s+'[^']*'/gi, "PASSWORD '[redacted]'").slice(0, 300);
}

/**
 * MAKE (OR REMAKE) THE LIMITED LOGIN on one site database, over the OWNER's
 * connection to it. Answers `{ role, conn }` only after the read-back passes;
 * throws otherwise (`code: "app-login-refused"` when the role came back with
 * more than a row login's powers). Idempotent: a second run keeps the role,
 * its grants and its policies, and gives it a new password.
 */
export async function ensureAppLogin(ownerDbConn, { exec = sqlQuery, password = newAppPassword() } = {}) {
  const dbName = dbNameOfConn(ownerDbConn);
  const role = appRoleName(dbName);
  for (const stmt of appLoginStatements(dbName, password)) {
    try { await exec(ownerDbConn, stmt, []); }
    catch (e) {
      // `REVOKE … FROM PUBLIC` on a schema the owner does not own is only a
      // warning in Postgres; anything thrown is a real failure, and the
      // statement (which may carry the password) is never in the message.
      throw Object.assign(new Error("limited login: " + safeLoginError(e, password)), { code: "app-login-failed" });
    }
  }
  let rows;
  try { rows = await exec(ownerDbConn, appRoleCheckSql(dbName), []); }
  catch (e) { throw Object.assign(new Error("limited login check: " + safeLoginError(e, password)), { code: "app-login-failed" }); }
  const bad = appRoleProblems(Array.isArray(rows) ? rows[0] : null);
  if (bad.length) throw Object.assign(new Error("limited login refused: " + bad.join(", ")), { code: "app-login-refused", problems: bad });
  return { role, conn: appConnFor(ownerDbConn, dbName, password) };
}

/**
 * THE BACKFILL: older sites get their limited login, a few per tick.
 *
 * deps:
 *   listMissing(after, limit) → [slug]   sites whose `app_conn` is empty, slug > after, by slug
 *                                        (null when the column is not there yet: nothing to do)
 *   ownerConnFor(slug)       → conn | null   the owner's connection to the site's database
 *   ensure(ownerConn)        → { conn }      `ensureAppLogin`
 *   save(slug, conn)         → boolean       write `site_project.app_conn`
 *   readCursor() / writeCursor(slug)        where the last tick stopped ("" = start)
 *   warn(line)
 *
 * BOUNDED (`limit` sites a tick), RETRYABLE (a failure leaves `app_conn` empty,
 * so a later lap finds it again), IDEMPOTENT (`ensureAppLogin` is, and a site
 * that has a login is not listed). The cursor walks past a site that keeps
 * failing, so one broken database never holds the others back; at the end of
 * the list it starts again from the top.
 */
export async function backfillAppLogins(deps, { limit = 3 } = {}) {
  const out = { tried: 0, made: 0, failed: 0, skipped: 0 };
  let after = "";
  try { after = String((await deps.readCursor()) || ""); } catch { after = ""; }
  let slugs = await deps.listMissing(after, limit);
  if (slugs === null) return { ...out, notReady: true };
  if (!slugs.length && after) slugs = await deps.listMissing("", limit) || [];
  let last = "";
  for (const slug of slugs.slice(0, limit)) {
    last = slug;
    out.tried++;
    let owner = null;
    try { owner = await deps.ownerConnFor(slug); }
    catch (e) { out.failed++; deps.warn?.("limited login backfill: " + slug + " backend unreadable: " + safeLoginError(e)); continue; }
    if (!owner) { out.skipped++; continue; }
    let made = null;
    try { made = await deps.ensure(owner); }
    catch (e) { out.failed++; deps.warn?.("limited login backfill: " + slug + ": " + safeLoginError(e)); continue; }
    let saved = false;
    try { saved = !!(await deps.save(slug, made.conn)); } catch { saved = false; }
    if (saved) out.made++;
    else { out.failed++; deps.warn?.("limited login backfill: " + slug + ": could not record the login"); }
  }
  try { await deps.writeCursor(slugs.length < limit ? "" : last); } catch { /* the next tick starts where this one did */ }
  return out;
}

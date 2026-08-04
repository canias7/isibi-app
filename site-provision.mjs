// Getting a site its Neon backend: ONE PROJECT PER SITE, a database inside it,
// and the two rows that remember both.
//
// Per-site rather than per-user (changed 2026-07-29, owner's call) buys genuine
// isolation: a connection string can be handed to somebody without exposing that
// owner's other sites, each site scales to zero on its own, and deleting a site
// means deleting a project rather than dropping one database out of a shared one.
// The cost is the project CAP — Neon limits projects per account, and this
// multiplies consumption of that limit by sites-per-user rather than by users.
//
// This is the step where a failure costs something that is not recoverable by
// retrying. A Neon project is a CAPPED, billed resource, and the only record
// that a user has one is a Supabase row — so a project created and not written
// down is invisible: the next build sees no row, creates another, and the orphan
// bills forever with nothing pointing at it. The original build of this code
// awaited both writes without checking either, which is very likely how the two
// loose projects in the handoff notes got there.
//
// Every side effect is injected, the way publish-pages.mjs and site-data.mjs
// take theirs, so the ordering and the failure paths can be driven against fakes
// with no Neon project and no Supabase.

/**
 * deps:
 *   lookupSite(slug)            → conn | null      does this slug already have a database
 *   lookupProject(slug)         → proj | null      does this SITE already have a Neon project
 *   createProject(slug)         → {projectId, branchId, roleName, conn}
 *   dropProject(projectId)      → void             cleanup for a project we failed to record
 *   saveProject(slug, uid, proj)→ {ok}             write the site_project row
 *   enableAuth(proj, dbName)    → void             turn Neon Auth on; idempotent
 *   createDatabase(proj, slug)  → dbName
 *   saveBackend(slug, uid, db)  → {ok}             write the site_backends row
 *   connFor(projectConn, dbName)→ conn
 *   dbNameFor(slug)             → dbName
 */
export async function ensureSiteBackend(deps, { slug, uid }) {
  // Deliberately NOT the cached read used on the request path. This is the write
  // path: a cached connection string for a slug another isolate has since
  // deleted would send a schema apply at a dropped database. A build takes tens
  // of seconds, so one uncached lookup here costs nothing worth having.
  // `lookupSite` returns {conn, uid} so ownership is decided HERE, not only by
  // whatever the caller checked first. The route's own check is wrapped in a
  // try/catch and used to fail OPEN, so a Supabase hiccup during someone's build
  // let them adopt an existing slug: the lookup handed back the current owner's
  // connection and the schema apply, the seed and the publish all went at
  // another user's site. Ownership belongs in the layer that returns the
  // connection.
  const existing = await deps.lookupSite(slug);
  if (existing && existing.conn) {
    if (existing.uid && existing.uid !== uid) {
      throw Object.assign(new Error("that name is taken"), { stage: "owner", conflict: true });
    }
    return existing.conn;
  }
  // Exists but with no usable connection recorded, owned by someone else: still
  // not ours to build over.
  if (existing && existing.uid && existing.uid !== uid) {
    throw Object.assign(new Error("that name is taken"), { stage: "owner", conflict: true });
  }

  // Keyed by SLUG now, not by uid. A retried build for the same site must find
  // the project it made last time — otherwise every retry creates another one
  // and burns the cap, which is the per-site version of the leak this module was
  // written to stop.
  let proj = await deps.lookupProject(slug);
  if (!proj) {
    const made = await deps.createProject(slug);
    proj = { neon_project: made.projectId, neon_branch: made.branchId, neon_role: made.roleName, neon_conn: made.conn };

    // Record it, or destroy it. Those are the only two acceptable outcomes —
    // an unrecorded project is a permanent leak against a capped quota, and the
    // NEXT build of this slug would create yet another one.
    let saved = { ok: false };
    try { saved = await deps.saveProject(slug, uid, proj); } catch (e) { saved = { ok: false, error: e }; }
    if (!saved || !saved.ok) {
      try { await deps.dropProject(made.projectId); } catch { /* best effort; logged by the caller */ }
      throw Object.assign(new Error("could not record the Neon project"), {
        detail: String((saved && saved.detail) || (saved && saved.error && saved.error.message) || "").slice(0, 300),
        stage: "save_project",
      });
    }
  }

  // A retried build can hit an already-created database; that is success, not
  // failure — the schema apply below is additive and idempotent.
  let dbName;
  try {
    dbName = await deps.createDatabase(proj, slug);
  } catch (e) {
    if (!/already exists/i.test(String((e && e.detail) || (e && e.message) || ""))) throw e;
    dbName = deps.dbNameFor(slug);
  }

  // Neon Auth, every time — not only when the project was just created.
  //
  // AFTER the database, because the enable call has to NAME it: a site's
  // project holds two databases and Neon refuses to guess between them. Still
  // before the caller applies any schema, which is the ordering that matters —
  // `neon_auth` has to exist before a table can reference it.
  //
  // The whole backend is Neon (2026-07-30), so a site without auth enabled is a
  // site whose member pages return nothing. A project can exist without it: the
  // create succeeded and this call failed, or the project predates the change.
  // Since a retried build REUSES the project, enabling only at creation would
  // leave that site permanently broken while every retry reported success.
  //
  // Not best-effort. Identity is load-bearing now, and a build that quietly
  // produced a site nobody can sign in to is worse than one that failed and said
  // so — the caller can retry a failure, and cannot retry a success.
  //
  // The provisioning answer is KEPT, because it is where the site's auth endpoint
  // comes from and a published page has no other way to learn it. Recording it is
  // best-effort while enabling is not: auth being ON is what makes the site
  // usable, and a missing note of WHERE it is can be re-fetched by a later build
  // from a call that is idempotent anyway.
  let authInfo = null;
  if (deps.enableAuth) {
    try { authInfo = (await deps.enableAuth(proj, dbName)) || null; }
    catch (e) {
      // STATUS CARRIED THROUGH. Both of these wrappers kept `detail` and dropped
      // `status`, so a build that died here reported `upstream: null` and the
      // caller could not tell a 404 (wrong path) from a 401 (dead key) from a
      // 5xx. That is the whole reason the status was surfaced one layer up.
      throw Object.assign(new Error("could not enable Neon Auth for this site"), {
        detail: String((e && (e.detail || e.message)) || "").slice(0, 300),
        status: e && e.status,
        stage: "enable_auth",
      });
    }
    // LOGGED, NOT SWALLOWED. Best-effort is right — a site whose auth is ON but
    // whose endpoint was not written is still recoverable — but a `catch {}` with
    // no log is how a one-word bug (`.conn` for `.neon_conn`) survived from the
    // day it was written: it threw on every build of every site, and nothing
    // anywhere said so. The build still succeeds; somebody can now see why the
    // site is a shell.
    if (authInfo && authInfo.info && deps.saveAuthInfo) {
      try { await deps.saveAuthInfo(dbName, authInfo.info); }
      catch (e) { deps.warn?.("saveAuthInfo failed for " + slug + ": " + ((e && e.message) || e)); }
    }
  }

  // The Data API. Fatal for the same reason auth is: with the Worker's own row
  // routes gone this IS the site's backend, so a build that could not enable it
  // produced a site whose every list is empty and whose every form fails — and a
  // caller can retry a failure, not a success.
  if (deps.enableData) {
    let dataInfo = null;
    try { dataInfo = (await deps.enableData(proj, dbName)) || null; }
    catch (e) {
      throw Object.assign(new Error("could not enable the Neon Data API for this site"), {
        detail: String((e && (e.detail || e.message)) || "").slice(0, 400),
        status: e && e.status,
        stage: "enable_data_api",
      });
    }
    if (dataInfo && dataInfo.info && deps.saveDataInfo) {
      try { await deps.saveDataInfo(dbName, dataInfo.info); }
      catch (e) { deps.warn?.("saveDataInfo failed for " + slug + ": " + ((e && e.message) || e)); }
    }
  }

  // The database exists now, but nothing points at it until this row lands: the
  // slug stays unclaimed and every read 404s. Reporting a successful build for a
  // site nobody can reach is worse than failing.
  let backend = { ok: false };
  try { backend = await deps.saveBackend(slug, uid, dbName); } catch (e) { backend = { ok: false, error: e }; }
  if (!backend || !backend.ok) {
    throw Object.assign(new Error("could not record the site's database"), {
      detail: String((backend && backend.detail) || (backend && backend.error && backend.error.message) || "").slice(0, 300),
      stage: "save_backend",
    });
  }

  return deps.connFor(proj.neon_conn, dbName);
}

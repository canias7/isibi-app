// Getting a user their Neon backend: a project on first build, a database per
// site, and the two rows that remember both.
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
 *   lookupProject(uid)          → proj | null      does this user already have a Neon project
 *   createProject(uid)          → {projectId, branchId, roleName, conn}
 *   dropProject(projectId)      → void             cleanup for a project we failed to record
 *   saveProject(uid, proj)      → {ok}             write the user_site_project row
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
  const existing = await deps.lookupSite(slug);
  if (existing) return existing;

  let proj = await deps.lookupProject(uid);
  if (!proj) {
    const made = await deps.createProject(uid);
    proj = { neon_project: made.projectId, neon_branch: made.branchId, neon_role: made.roleName, neon_conn: made.conn };

    // Record it, or destroy it. Those are the only two acceptable outcomes —
    // an unrecorded project is a permanent leak against a capped quota, and the
    // user's NEXT build would create yet another one.
    let saved = { ok: false };
    try { saved = await deps.saveProject(uid, proj); } catch (e) { saved = { ok: false, error: e }; }
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

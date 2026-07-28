// slug → connection string, at the edge.
//
// A published site's data read has to answer "which Neon database is this slug?"
// before it can do anything. Today that is TWO sequential HTTPS calls to
// Supabase — `site_backends` by slug, then `user_site_project` by uid — and the
// answer is fixed the moment the site is built and never changes again.
// Supabase is the app's auth and user store; using it as a per-request routing
// table for public traffic means every visitor read makes a cross-region hop to
// a Postgres REST API before touching the site's own database.
//
// Write-once, read-always, never-changes, needed at the edge is what KV is for.
//
// **Only the connection string lives here, deliberately.** KV is eventually
// consistent — a write can take up to a minute to reach every colo — which is
// harmless for a value that never changes after the build, and would be a real
// bug for the site's SCHEMA: a revise adds tables, and a stale schema 404s the
// site's own new tables for as long as the staleness lasts. The schema keeps its
// short in-isolate cache and its read from `_meta`.
//
// Supabase stays the source of truth. KV is a projection: a miss falls back and
// backfills, so an empty or unbound namespace is slow, never wrong.

export const routeKey = (slug) => "route:" + String(slug || "").toLowerCase();

/**
 * deps:
 *   kv                        → the KV namespace binding, or null/undefined
 *   fromSource(slug)          → conn | null      the Supabase lookup (2 round trips)
 *   onBackfillError?(err)     → void             observability only; never throws
 */
export async function lookupRoute(deps, slug) {
  const key = routeKey(slug);

  if (deps.kv) {
    try {
      const hit = await deps.kv.get(key);
      if (hit) return hit;
    } catch (e) {
      // KV being unavailable must degrade to the old path, not fail the request.
      if (deps.onBackfillError) deps.onBackfillError(e);
    }
  }

  const conn = await deps.fromSource(slug);
  if (!conn) return null; // never cache absence — a build may still be finishing

  // Backfill so the next request skips Supabase entirely. Best-effort: a failed
  // write costs latency, never correctness.
  if (deps.kv) {
    try { await deps.kv.put(key, conn); }
    catch (e) { if (deps.onBackfillError) deps.onBackfillError(e); }
  }
  return conn;
}

/** Called at build time, where the connection string is already in hand. */
export async function saveRoute(deps, slug, conn) {
  if (!deps.kv || !conn) return false;
  try { await deps.kv.put(routeKey(slug), conn); return true; }
  catch (e) { if (deps.onBackfillError) deps.onBackfillError(e); return false; }
}

/**
 * Called when a site is deleted, BEFORE its database is dropped — a route that
 * outlives its database answers reads with a connection error rather than an
 * honest 404, and KV's own propagation delay makes that window longer than the
 * in-memory one.
 */
export async function dropRoute(deps, slug) {
  if (!deps.kv) return false;
  try { await deps.kv.delete(routeKey(slug)); return true; }
  catch (e) { if (deps.onBackfillError) deps.onBackfillError(e); return false; }
}

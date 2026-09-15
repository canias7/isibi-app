// WHICH OF FOUR THINGS "THIS SITE HAS NO DATABASE" ACTUALLY MEANT.
//
// `siteBackendBySlug` answers a connection string or `null`, and for months
// every caller read that `null` as "frontend-only site, no tables". It is four
// different facts wearing one value, and run 47 (2026-09-15) is what that cost:
// the addon's table designer was told `{ tables: [] }` about a site whose
// `bookings` table was twelve minutes old, so it designed a SECOND table,
// counted that one, and published a page reading `0` to a shop with three
// bookings.
//
// THE FOUR:
//
//   ready       — `site_backends.neon_db` names a database. The ordinary case.
//   none        — no `neon_db` AND no `site_project` row. Genuinely a
//                 frontend-only site; `{ tables: [] }` is TRUE here and is the
//                 only state in which it is.
//   incomplete  — no `neon_db` but a `site_project` row EXISTS. The database
//                 was provisioned and the ownership row never learned its name
//                 (the backlog defect: `saveBackend` is an INSERT with
//                 `resolution=ignore-duplicates`, so it cannot update the row
//                 already there). The database is real and reachable; only the
//                 REFERENCE is missing.
//   unreadable  — a lookup threw. Supabase being down must never read as a site
//                 having no tables — the recorded "cannot-tell must never read
//                 as a value", in the money path.
//
// AND THE KV CACHE IS WHY THIS HID FOR SO LONG. `lookupRoute` checks
// `env.SITE_ROUTES` before Supabase, so in the WORKER an `incomplete` site
// resolves from the cache written by whichever build last provisioned it, and
// everything works. `builder/container-env.mjs` says in as many words that
// `SITE_ROUTES` is ABSENT in the container — so when the addon moved behind
// `JOB_RUNNER_EVERYONE` it started reading Supabase directly, got the blank
// column, and the defect became reachable. *A rule true because of a layer
// below it expires when that layer moves*, again, and again in the path that
// spends money.
//
// Dependency-free and pure: the Worker, the job child and
// `scripts/backend-repair.mjs` all decide with this one function, so a repair
// run by hand and a repair run by a build can never disagree about what a site
// is.

/** Every state this module can answer. Exported so a census can assert on it. */
export const BACKEND_STATES = ["ready", "none", "incomplete", "unreadable"];

/**
 * Decide from the two rows, and nothing else.
 *
 * `site`     — the `site_backends` row, or null when there is none.
 * `project`  — the `site_project` row, or null.
 * `failed`   — truthy when EITHER lookup threw. Asked FIRST, because a state
 *              derived from rows we could not read is a guess wearing a fact.
 */
export function backendState({ site = null, project = null, failed = null } = {}) {
  if (failed) {
    return { state: "unreadable", db: null, why: "lookup-failed", detail: String((failed && failed.message) || failed || "").slice(0, 300) };
  }
  if (!site) return { state: "none", db: null, why: "no-site-row" };
  const db = typeof site.neon_db === "string" ? site.neon_db.trim() : "";
  if (db) return { state: "ready", db, why: "recorded" };
  if (project) return { state: "incomplete", db: null, why: "project-without-db-name" };
  return { state: "none", db: null, why: "no-database" };
}

/**
 * WHAT A REPAIR WOULD DO, as a decision separate from doing it.
 *
 * The owner's three conditions are the three branches: repeatable (a `ready`
 * site is skipped, so running it twice is running it once), never creates a
 * database (there is no create here — only `incomplete`, which by definition
 * already has one), and never overwrites a valid setting (`ready` is skipped by
 * name, not by a filter somebody has to keep getting right).
 *
 * `derive(slug)` is `dbNameForSite`, injected so this module stays
 * dependency-free and so a case can drive a deliberately wrong deriver.
 *
 * A `none` site is skipped rather than "fixed": writing a database name onto a
 * frontend-only site would make every later reader try to reach a database that
 * does not exist, which is a worse state than the one it is in.
 */
export function repairPlan({ slug, site = null, project = null, failed = null, derive } = {}) {
  const st = backendState({ site, project, failed });
  if (st.state !== "incomplete") {
    return { act: "skip", state: st.state, db: st.db, why: st.why, slug };
  }
  let db = "";
  try { db = String(derive(slug) || ""); } catch (e) { db = ""; }
  if (!db) return { act: "skip", state: st.state, db: null, why: "no-derivable-name", slug };
  return { act: "backfill", state: st.state, db, why: st.why, slug };
}

/**
 * THE PATCH'S OWN FILTER, spelled once.
 *
 * `neon_db` is written ONLY where it is still unset — the store enforces "never
 * overwrite a valid setting", not us. Both spellings of unset are covered
 * because both exist in the live table: `claimSiteSlug` writes `""` and a row
 * that never had the column written carries NULL.
 *
 * Exported so the guard can assert the exact string rather than trusting that
 * the call site got it right, and so the Worker and the script cannot drift.
 */
export function unsetDbFilter() { return "or=(neon_db.is.null,neon_db.eq.)"; }

/**
 * The database a connection string really points at — its path, minus the slash.
 *
 * Preferred over re-deriving from the slug when a connection is already in
 * hand: it records what the caller will ACTUALLY use, so the row cannot end up
 * naming a database nothing connects to. Answers "" rather than throwing on a
 * string that will not parse, because this only ever decorates a record.
 */
export function dbNameFromConn(conn) {
  try {
    const p = new URL(String(conn || "")).pathname || "";
    return decodeURIComponent(p.replace(/^\/+/, "")).trim();
  } catch { return ""; }
}

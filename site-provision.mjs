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
 * DESTROY A PROJECT WE COULD NOT RECORD — and be able to say we failed to.
 *
 * Both cleanup sites used to swallow the rejection under a comment saying the
 * caller logged it — and the caller logs only the ATTEMPT (`console.error(
 * "dropping unrecorded neon project:", id)`) BEFORE making the call, whose own
 * rejection was then discarded here. So a successful cleanup and a failed one
 * emitted byte-identical output — and the failed one is the single event this
 * module exists to make visible: we created a billed project, could not record
 * it, and could not remove it.
 *
 * There is nothing else holding it. `neon_teardown` is fired by a BEFORE DELETE
 * trigger on the `site_project` row, and the whole point of this path is that no
 * row was ever written — so the log is the only record there will ever be, which
 * is why it names the project and says what state it is in rather than being one
 * more swallowed rejection.
 */
async function dropOrphan(deps, projectId, why) {
  if (!projectId) return false;
  try { await deps.dropProject(projectId); return true; }
  catch (e) {
    deps.warn?.("ORPHANED NEON PROJECT " + projectId + " (" + why + ") — the drop failed and nothing else holds it: " +
      String((e && e.message) || e).slice(0, 200));
    return false;
  }
}

/**
 * A PROJECT ROW IS AN OWNERSHIP RECORD, and this module used to reuse one
 * without ever reading the owner off it.
 *
 * `lookupSite` decides ownership for `site_backends` — it returns `{conn, uid}`
 * and throws `conflict` when the uid differs, because "ownership belongs in the
 * layer that returns the connection". `lookupProject` is the parallel slug-keyed
 * lookup and had no such check, so when `site_project` held a row and
 * `site_backends` did not — which is exactly what any failure between the two
 * writes leaves behind — a DIFFERENT account building that slug was silently
 * given the first account's project. Measured 2026-08-21: account B's database
 * was created inside account A's project and B's returned connection string was
 * A's host, role and PASSWORD. A deleting their account cascades `site_project`,
 * which enqueues that project for teardown and destroys B's live site.
 *
 * It also closes the same hole in the race converge below: the losing racer used
 * to adopt the winner's project unconditionally, so two DIFFERENT accounts
 * racing one free slug produced precisely that cross-account state by design.
 *
 * ABSENT `uid` IS A REFUSAL, NOT A SHRUG. `site_project.uid` is NOT NULL
 * (measured against the live schema 2026-08-21, and all 11 rows carry one), so a
 * row can never lack an owner — an absent KEY means the dep's SELECT did not ask
 * for it, i.e. our own wiring is wrong. Failing open there is the bug this
 * function exists to close, and it would be silent; failing closed is loud, is
 * fixed by one column in one SELECT, and cannot mis-decide anything.
 */
function assertProjectOurs(proj, uid, slug) {
  if (!proj) return proj;
  if (!("uid" in proj)) {
    throw Object.assign(new Error("the site's project row was read without its owner"), {
      stage: "project_owner",
      detail: "lookupProject(" + slug + ") must select uid — site_project.uid is NOT NULL, so an absent key means the SELECT did not ask for it",
    });
  }
  if (String(proj.uid) !== String(uid)) {
    throw Object.assign(new Error("that name is taken"), { stage: "project_owner", conflict: true });
  }
  return proj;
}

/**
 * deps:
 *   lookupSite(slug)            → conn | null      does this slug already have a database
 *   lookupProject(slug)         → proj | null      does this SITE already have a Neon project
 *   createProject(slug)         → {projectId, branchId, roleName, conn}
 *   dropProject(projectId)      → void             cleanup for a project we failed to record
 *   saveProject(slug, uid, proj)→ {ok, claimed?}   ATOMIC insert of the site_project row —
 *                                                  claimed:false = the slug's row already existed
 *                                                  (another racer got there first); absent = the
 *                                                  dep cannot tell, treated as claimed
 *   enableAuth(proj, dbName)    → void             turn Neon Auth on; idempotent
 *   createDatabase(proj, slug)  → dbName
 *   saveBackend(slug, uid, db)  → {ok, claimed?}   ATOMIC insert of the site_backends row —
 *                                                  same contract as saveProject
 *   connFor(projectConn, dbName)→ conn
 *   dbNameFor(slug)             → dbName
 *   missingServices(conn)       → ["auth"|"data"]  OPTIONAL — which _meta service endpoints
 *                                                  the site lacks, asked through the same
 *                                                  reader the proxy uses; drives the reuse-
 *                                                  path heal and nothing else
 *
 * `lookupProject` MUST return the row's `uid`. See `assertProjectOurs`.
 */
export async function ensureSiteBackend(deps, { slug, uid }) {
  // OPTIONAL, like `deps.warn`. Provisioning is six Neon/Supabase calls behind
  // one number in the build trace, and a COLD provision (create the project,
  // poll until it exists, create the database, poll again, enable auth, enable
  // the Data API) takes tens of seconds while a WARM one — the slug already has
  // a database — is a single lookup. They were indistinguishable from outside.
  // Injected rather than returned, because the interesting case is the build
  // that THROWS half way through: a return value never arrives.
  const mark = (name) => { try { deps.mark?.(name); } catch { /* never break a build */ } };
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
    // HEAL THE SERVICE ENDPOINTS, on the one path every recorded site takes.
    //
    // `auth_info` and `data_api` are written exactly once each, on the
    // non-reuse path, and both saves are best-effort — so a transient blip
    // during either one used to yield a build that answered ok:true over a
    // site whose every visitor read, form and sign-in answers 501, FOREVER:
    // this reuse path called zero deps, so no rebuild ever re-ran the enables
    // or the saves, while the 501's own copy promised a rebuild would fix it
    // (2026-08-14 audit). Now it does. `missingServices` asks the SAME reader
    // the proxy uses, so the heal and the 501 cannot disagree about what
    // "recorded" means.
    //
    // BEST-EFFORT END TO END, in both directions. A reader that cannot tell
    // answers nothing — a database blip must not read as "missing" and spend
    // Neon API calls on every build of every healthy site — and a heal that
    // fails must not fail a text edit that never needed the endpoint; the
    // next build retries it. An enable answering `info: null` saves nothing,
    // because overwriting a stored endpoint with null is the one way this
    // could make a site worse.
    if (deps.missingServices) {
      let missing = [];
      try { missing = (await deps.missingServices(existing.conn)) || []; } catch { missing = []; }
      if (Array.isArray(missing) && missing.length) {
        try {
          // Ownership is asked here too, for one rule rather than two. On this
          // path `lookupSite` has already settled that the SITE is ours, so a
          // project row wearing another uid is the cross-account state
          // `assertProjectOurs` now prevents — and enabling services inside
          // somebody else's project is not a thing to do quietly. The throw is
          // caught below, so this warns and skips the heal rather than failing
          // an edit that never needed the endpoint.
          const proj = assertProjectOurs(await deps.lookupProject(slug), uid, slug);
          if (proj) {
            const dbName = deps.dbNameFor(slug);
            if (missing.includes("auth") && deps.enableAuth) {
              const a = await deps.enableAuth(proj, dbName);
              if (a && a.info && deps.saveAuthInfo) await deps.saveAuthInfo(dbName, a.info);
            }
            if (missing.includes("data") && deps.enableData) {
              const d2 = await deps.enableData(proj, dbName);
              if (d2 && d2.info && deps.saveDataInfo) await deps.saveDataInfo(dbName, d2.info);
            }
            mark("heal");
          }
        } catch (e) { deps.warn?.("service heal failed for " + slug + ": " + ((e && e.message) || e)); }
      }
    }
    mark("reuse");
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
  //
  // AND OWNERSHIP-CHECKED. A project row for this slug is a record of who owns
  // the project; reusing one without reading its owner is how account B's
  // database ends up inside account A's project — see `assertProjectOurs`.
  let proj = assertProjectOurs(await deps.lookupProject(slug), uid, slug);
  if (!proj) {
    // THE CREATE ITSELF CAN LEAVE A PROJECT BEHIND, and the cleanup below could
    // not reach it.
    //
    // Neon creates the project when the POST returns, and `createSiteProject`
    // then does two more things that can throw (a response-shape guard, and
    // `waitForProject`). The only cleanup used to be keyed on this call having
    // RETURNED, so a project created by a call that threw was invisible: no
    // row, no `neon_teardown` entry (its trigger is a row DELETE and no row was
    // ever written), and the next build of this slug creates another one
    // against a capped quota. `projectFromCreate` attaches the id to the error
    // precisely so this catch has something to drop.
    let made;
    try {
      made = await deps.createProject(slug);
    } catch (e) {
      await dropOrphan(deps, e && e.projectId, "the create call threw after Neon had made it");
      // NAMED, so a failure here is not reported as whatever ran before it. The
      // original error is rethrown rather than wrapped: its status and detail
      // are the diagnosis, and `waitForProject`'s message is the useful part.
      if (e && typeof e === "object" && !e.stage) e.stage = "create_project";
      throw e;
    }
    proj = { neon_project: made.projectId, neon_branch: made.branchId, neon_role: made.roleName, neon_conn: made.conn };

    // Record it, or destroy it. Those are the only two acceptable outcomes —
    // an unrecorded project is a permanent leak against a capped quota, and the
    // NEXT build of this slug would create yet another one.
    let saved = { ok: false };
    try { saved = await deps.saveProject(slug, uid, proj); } catch (e) { saved = { ok: false, error: e }; }
    if (!saved || !saved.ok) {
      await dropOrphan(deps, made.projectId, "the project could not be recorded");
      throw Object.assign(new Error("could not record the Neon project"), {
        detail: String((saved && saved.detail) || (saved && saved.error && saved.error.message) || "").slice(0, 300),
        stage: "save_project",
      });
    }
    // LOST THE SLUG RACE — CONVERGE, DO NOT ORPHAN. `claimed === false` means
    // the row already existed: another build of this same free name got its
    // project recorded between our lookup and our write (2026-08-13 audit —
    // both racers used to succeed via upsert, the second overwriting the
    // first's connection row, so the winner's live site pointed at the loser's
    // project and the loser's project billed forever with no teardown entry).
    // The losing racer destroys its own just-created project and CONTINUES on
    // the winner's — the database create below is idempotent ("already
    // exists" is the one recoverable error) and every later step is too.
    // Strictly `=== false`: an older dep that cannot tell reports nothing and
    // behaves exactly as before.
    //
    // A retried build after a crash can NEVER land here on its own stale row:
    // `lookupProject` runs before `createProject`, so its own earlier row is
    // found and reused — losing the claim always means a LIVE competitor.
    //
    // THE CONVERGE IS OWNERSHIP-CHECKED TOO, and it was the second door onto
    // the cross-account state. Two DIFFERENT accounts racing one free slug: A
    // wins the project claim, B drops its own and adopts A's — so B's database
    // is created inside A's project, and if B then wins the `site_backends`
    // claim the site is B's and the project is A's. `assertProjectOurs` turns
    // that into the same 409 the slug race already gives; nothing is orphaned,
    // because B's own project is dropped first.
    if (saved.claimed === false) {
      await dropOrphan(deps, made.projectId, "lost the slug race");
      proj = assertProjectOurs(await deps.lookupProject(slug), uid, slug);
      if (!proj) {
        throw Object.assign(new Error("could not record the Neon project"), {
          detail: "lost the slug race and the winner's project could not be read back",
          stage: "save_project",
        });
      }
    }
    mark("project");
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
  mark("database");

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
    mark("auth");
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
    mark("data_api");
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
  // THE SLUG BELONGS TO WHOEVER RECORDED IT FIRST — enforced here, not merely
  // stated. Under the old upsert, two racers both "succeeded" and the LAST
  // writer owned the slug, silently unseating a build that had already
  // reported success. `claimed === false` means another build recorded this
  // slug while ours was provisioning; the honest answer is the same 409 the
  // route already gives a name that was taken before the build began — with a
  // refund and the message naming the cause. Nothing is orphaned by refusing:
  // the project is recorded in site_project (the claim above converged us onto
  // one project), and the winner is building on it.
  if (backend.claimed === false) {
    // …BUT OUR OWN ROW IS NOT SOMEBODY ELSE'S SITE, and this reported it as one.
    //
    // `claimed === false` says only that a row already exists. By here the
    // reuse branch has established that if one existed it belongs to THIS uid —
    // so the second cause is the caller's own row, skipped at the top because
    // `existing.conn` was null. `siteBackendRowFresh` answers conn:null whenever
    // the `site_project` row cannot be resolved, which is exactly what a
    // half-failed delete leaves behind (the `site_backends` DELETE is swallowed,
    // the `site_project` DELETE succeeds). Measured 2026-08-21: the owner
    // rebuilding their own slug got "That site name is taken by another
    // account", every retry repeated it, and each attempt created and recorded a
    // brand-new billed Neon project that no site would ever use.
    //
    // So ASK WHO HOLDS IT rather than inferring. One read on the losing path
    // only, mirroring the project race's read-back exactly, and it answers the
    // one question that matters — is the winner us? If it is, the row is ours,
    // the database name is derived from the slug so it already matches, and the
    // build continues: the site heals instead of being permanently unbuildable.
    //
    // A read-back that fails or finds nothing REFUSES. Fail-closed is the cheap
    // direction here: refusing costs the customer a retry, while adopting a slug
    // we cannot prove is ours writes a schema, seeds rows and publishes over
    // another account's site.
    let winner = null;
    try { winner = await deps.lookupSite(slug); } catch { winner = null; }
    if (!winner || !winner.uid || String(winner.uid) !== String(uid)) {
      throw Object.assign(new Error("that name is taken"), { stage: "save_backend", conflict: true });
    }
    mark("reclaim");
  }

  mark("record");
  return deps.connFor(proj.neon_conn, dbName);
}

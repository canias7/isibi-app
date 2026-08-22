// Republishing every site, one at a time, across cron ticks.
//
// WHY THIS EXISTS. Each published site is its OWN Cloudflare Worker script, and
// `vite build` bundles React, TanStack and every component the pages import INTO
// that script. A Worker cannot load code at runtime, so there is no shared
// framework layer to patch: every site is frozen at the version it was built
// with. The day a React or TanStack advisory lands, the only fix is to republish
// every site — and until this module there was no operation that could.
//
// It is much cheaper than it sounds and that is the whole reason it is worth
// having ready. `recompileAndPublish` reads the site's own stored page source
// out of R2 and drives the container; it makes NO model call. So a platform-wide
// bump is container time, not credits.
//
// THE REASON TO BUILD IT BEFORE IT IS WANTED: when it is wanted there will be a
// CVE with a clock on it, and that is the worst moment to be writing a queue,
// calibrating a backoff, and discovering that some 2026 site's stored source no
// longer compiles against the current kit.
//
// THE SHAPE IS `site-teardown.mjs`'s, deliberately — a queue table, a bounded
// batch per tick, escalating backoff, and no silent give-up. That design was
// already argued out for a different resource and the arguments transfer. Where
// this one DIFFERS from it is written down below, because the differences are
// the parts somebody would otherwise "fix" back.
//
// Pure. The clock, the storage and the rebuild itself are all arguments, so
// every decision here is driven directly in test/site-rebuild.test.mjs — no
// container, no R2, no Supabase.

/**
 * How long to wait before trying a failed rebuild again.
 *
 * The same ladder as the teardown queue, and the same rule: THE LAST VALUE
 * REPEATS AND THERE IS NO GIVE-UP. Deleting a row to stop the noise would leave
 * a site silently un-upgraded and nothing anywhere recording that — which is the
 * exact state this queue exists to end. A parked row costs one rebuild attempt a
 * day and stays visible with its `last_error`.
 */
export const BACKOFF_SEC = [120, 600, 3600, 21600, 86400];

export function backoffFor(attempts) {
  const n = Number(attempts);
  const i = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), BACKOFF_SEC.length) - 1 : 0;
  return BACKOFF_SEC[Math.max(0, i)];
}

/**
 * ONE PER TICK, AND THIS IS THE ONE NUMBER THAT MUST NOT BE COPIED FROM THE
 * TEARDOWN QUEUE.
 *
 * That one uses 5 because a Neon DELETE is a single fast API call. A rebuild is
 * a container run, and the build service is `oneAtATime` — one build at a time
 * for the WHOLE PLATFORM, which is not an implementation detail but a deliberate
 * fix: two concurrent builds used to interleave in a shared `src/routes` and
 * publish each other's pages.
 *
 * Measured recompile cost from a real build: vite ~37s, render ~12s, tsc ~9s,
 * publish ~7s — call it ~65s. The cron fires every 120s. So a batch of 2 is
 * ~130s and ticks start overlapping, which means a rebuild sits queued behind
 * another rebuild while a REAL CUSTOMER EDIT waits behind both. A bulk operation
 * must never be able to starve the interactive path.
 *
 * Throughput at 1: 30 an hour, 720 a day. That is the honest number, and it is
 * ample — a platform-wide bump is not an emergency measured in minutes.
 */
export const BATCH = 1;

/**
 * What a rebuild outcome means. THREE answers, not two, and the third is the
 * one this queue needs that the teardown queue did not.
 *
 *   done  → the site republished. Forget the row.
 *   gone  → the site no longer exists. Forget the row: unlike a Neon project,
 *           where the row is the ONLY record of a billed resource, a rebuild row
 *           for a deleted site protects nothing and is pure noise.
 *   retry → OUR side failed (container drained, an unreadable store). Back off
 *           and try again; this is transient by definition.
 *   stuck → the site's own stored source does not compile against the current
 *           kit. Retrying is pointless — it will fail identically forever — but
 *           dropping it loses the one record that this site did not get the
 *           upgrade. So it is PARKED at the last backoff rung rather than
 *           climbing to it, and stays in the queue where somebody can see it.
 *
 * `ours` is the field `recompileAndPublish` already sets for exactly this
 * distinction: "our container went away" against "your change has an error in
 * it". Read rather than re-derived, so the two cannot drift apart.
 */
export function verdictFor(res) {
  if (!res || typeof res !== "object") {
    // Not an answer at all. Treated as ours, because a rebuild that returned
    // nothing recognisable is a fault in the platform and not in the site's
    // pages — and being wrong that way costs a retry, where being wrong the
    // other way parks a healthy site for a day.
    return { state: "retry", reason: "no answer from the rebuild" };
  }
  if (res.ok === true) return { state: "done", reason: "republished" };
  if (res.gone === true) return { state: "gone", reason: "the site no longer exists" };

  const why = String(res.detail || res.error || "failed").slice(0, 300);
  // OURS IS ALWAYS A RETRY, whatever the stage. A drained container, an
  // unreadable `_meta`, a missing backend read — every one of those heals.
  if (res.ours === true) return { state: "retry", reason: why };
  // A COMPILE FAILURE THAT IS NOT OURS IS THE SITE'S OWN SOURCE. This is the
  // case a framework bump produces and the reason `stuck` exists.
  if (res.error === "compile") return { state: "stuck", reason: why };
  // Anything else unclassified retries. Same asymmetry as above.
  return { state: "retry", reason: why };
}

/**
 * Drain one tick.
 *
 * deps:
 *   due(limit)                  → [{slug, attempts}]   rows whose next_try_at has passed
 *   exists(slug)                → boolean | throws     is this site still registered
 *   rebuild(slug)               → the spine's result object
 *   forget(slug)                → void   delete the queue row
 *   defer(slug, attempts, sec, why) → void   push next_try_at out and record why
 *
 * Returns a summary rather than logging it, so the caller decides whether a tick
 * is worth a line — the same reason publish-pages.mjs returns `stage`.
 *
 * IT CANNOT THROW. A queue drain that takes down the cron takes the nightly
 * backups, the teardown queue, the domain watch and the webhook queue with it.
 */
export async function drainRebuild(deps, { limit = BATCH } = {}) {
  const out = { attempted: 0, rebuilt: 0, gone: 0, deferred: 0, parked: 0, errors: [] };
  let rows = [];
  try { rows = (await deps.due(limit)) || []; }
  catch (e) {
    // A queue we cannot read is not an empty queue. Reported, so a tick that did
    // nothing because Supabase was down is distinguishable from one with nothing
    // to do.
    out.errors.push("due: " + String((e && e.message) || e).slice(0, 200));
    return out;
  }

  for (const row of rows) {
    const slug = row && String(row.slug || "");
    if (!slug) continue;

    // ── IS THE SITE STILL THERE? ─────────────────────────────────────────────
    //
    // ASKED, NEVER INFERRED FROM AN ERROR MESSAGE. `recompileAndPublish` answers
    // a deleted site with `error: "read"` and a sentence saying no backend is
    // recorded — and matching on that sentence is exactly the class of check
    // this repo keeps getting burned by. One cheap read gives an unambiguous
    // answer, and it separates the three cases a message cannot:
    //   throws → we could not look. Retry; do NOT spend a container run.
    //   false  → deleted between enqueue and now. Forget the row.
    //   true   → rebuild it.
    let alive;
    try { alive = await deps.exists(slug); }
    catch (e) {
      const attempts = Number(row.attempts || 0) + 1;
      try {
        await deps.defer(slug, attempts, backoffFor(attempts), "could not check the site exists: " + String((e && e.message) || e).slice(0, 160));
        out.deferred++;
      } catch (e2) { out.errors.push("defer " + slug + ": " + String((e2 && e2.message) || e2).slice(0, 120)); }
      out.errors.push(slug + ": lookup failed");
      continue;
    }
    if (!alive) {
      try { await deps.forget(slug); out.gone++; }
      catch (e) { out.errors.push("forget " + slug + ": " + String((e && e.message) || e).slice(0, 120)); }
      continue;
    }

    out.attempted++;
    let verdict;
    try { verdict = verdictFor(await deps.rebuild(slug)); }
    catch (e) {
      // A THROW IS OURS. The spine returns its failures; anything that escapes
      // it is a fault in the platform, so it retries rather than parking a site
      // whose pages may be perfectly good.
      verdict = { state: "retry", reason: String((e && e.message) || e).slice(0, 300) };
    }

    if (verdict.state === "done" || verdict.state === "gone") {
      // The row goes only after the work does — the teardown queue's ordering,
      // for the same reason: forgetting first and then failing loses the site
      // from the queue with nothing recording that it never got the upgrade.
      try {
        await deps.forget(slug);
        if (verdict.state === "gone") out.gone++; else out.rebuilt++;
      } catch (e) { out.errors.push("forget " + slug + ": " + String((e && e.message) || e).slice(0, 120)); }
      continue;
    }

    // PARKED, NOT CLIMBING. A source that does not compile will not compile in
    // ten minutes either, so a stuck site jumps straight to the last rung
    // instead of spending four more container runs proving the same thing.
    const attempts = Number(row.attempts || 0) + 1;
    const wait = verdict.state === "stuck" ? BACKOFF_SEC[BACKOFF_SEC.length - 1] : backoffFor(attempts);
    try {
      await deps.defer(slug, attempts, wait, verdict.reason);
      if (verdict.state === "stuck") out.parked++; else out.deferred++;
    } catch (e) { out.errors.push("defer " + slug + ": " + String((e && e.message) || e).slice(0, 120)); }
    out.errors.push(slug + ": " + verdict.reason);
  }
  return out;
}

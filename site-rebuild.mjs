// Republishing every site, a few at a time, across cron ticks.
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
 * A FEW PER TICK, SIDE BY SIDE — and the number this replaced rested on a
 * reason that expired (2026-09-04, the capacity review).
 *
 * It was 1, because "the build service is `oneAtATime` — one build at a time
 * for the WHOLE PLATFORM": a second rebuild queued behind the first and a real
 * customer edit waited behind both, and a bulk operation must never starve the
 * interactive path. True until 2026-08-25, when every site got its own
 * container lane (`builder/build-lane.mjs`, `laneName(slug)`): two builds of
 * DIFFERENT sites share nothing any more, and `oneAtATime` serialises only two
 * builds of ONE site. So N rebuilds of N sites run side by side, each in its
 * own container, and the only edit that waits behind a rebuild is an edit of
 * the very site being rebuilt — exactly as at 1. The recorded "a rule true
 * because of a layer below it expires when that layer moves" trap: at 1 per
 * two-minute tick a kit fix reached 30 sites an hour — 100 sites in ~3 h,
 * 1,000 in 33 h, 100,000 in 139 days.
 *
 * WHAT BOUNDS IT NOW IS THE CRON INVOCATION, not the container. Every rebuild
 * in a tick is awaited inside ONE scheduled invocation, which the platform
 * allows fifteen minutes. A recompile is ~65 s of container (vite ~37 s,
 * render ~12 s, tsc ~9 s) plus the publish's archive (27–139 s measured), so a
 * batch finishes in two to four minutes when it runs CONCURRENTLY — and it
 * must, because eight in series is sixteen minutes and the invocation is dead
 * at fifteen. `drainRebuild` runs the rows side by side for that reason. The
 * claim (`CLAIM_SEC`) covers the overlap with the next tick as before.
 *
 * Throughput at 8: 240 an hour, 5,760 a day. A batch size, not a ceiling
 * anywhere else; raise it once a real platform-wide republish has been
 * measured at this number.
 */
export const BATCH = 8;

/**
 * HOW LONG A CLAIM HOLDS THE ROW WHILE A REBUILD IS IN FLIGHT.
 *
 * The row is not touched until the rebuild RETURNS — the ordering that stops a
 * crashed run losing the site from the queue — and that leaves a window: the
 * cron fires every 120s and a recompile is ~65s, so one slow site is enough for
 * two ticks to read the same row as due and both start a container run. The
 * site's own lane is `oneAtATime`, so the second queues behind the first and
 * then republishes identical content: a wasted run, and a real customer edit
 * of that site waiting behind both.
 *
 * `runScheduledSiteJobs` closed exactly this hole and its comment is the rule —
 * *"an overlapping tick that reads the same row as due loses here and sends
 * nothing"*. Same mechanism, milder consequence: there it was re-mailing a
 * customer's whole batch, here it is a duplicate publish of the same bytes.
 *
 * TEN MINUTES: ~9x the measured run, so an overlap cannot squeeze through, and
 * short enough that a run whose ISOLATE DIED — leaving neither a forget nor a
 * defer — is picked up again soon rather than being stuck until somebody looks.
 * That dead-isolate case is the only thing this number bounds; every ordinary
 * outcome overwrites `next_try_at` on its way out.
 */
export const CLAIM_SEC = 600;

/**
 * HOW LONG A REBUILD WAITS BEHIND A JOB THAT HOLDS THE SITE (stage 6,
 * 2026-09-05). The claim asks the same question an edit's claim asks, under
 * the site's own lock (`rebuild_claim`), and a site somebody's edit or build
 * holds is not rebuilt under it: the row is pushed out by this much and asked
 * again, NO ATTEMPT COUNTED and no rung climbed — a busy site is not a
 * failing one. Five minutes: past most edits, and a rebuild is never urgent
 * to the minute.
 */
export const BUSY_DEFER_SEC = 300;

/**
 * HOW LONG THE DRAIN WAITS AFTER HANDING A SITE TO A JOB (stage 9,
 * 2026-09-06).
 *
 * The rebuild itself is a job now — filed against the site's owner, claimed
 * and run by the same consumer that runs their edits, in the site's own
 * container when the runner flags admit it. The tick that files one has
 * nothing more to do with the row, so it pushes it out by this much and
 * looks again. From the SECOND look on the job holds the site's own lease,
 * so the claim answers `busy` and the wait becomes `BUSY_DEFER_SEC` on its
 * own; this is only the gap between filing and the job taking hold, which is
 * a queue delivery. Two minutes: long enough that the ordinary case is one
 * look, short enough that a job which never started is picked up again soon.
 */
export const PENDING_DEFER_SEC = 120;

/**
 * THE JOB'S NAME FOR A ROW'S CURRENT ATTEMPT.
 *
 * `edit_create` keys on `(uid, slug, op, idem_key)`, so this only has to
 * distinguish one filing of one site from the next — and it must do so
 * WITHOUT a column to remember the job id in. Two things make a filing new:
 * the row itself (a site queued, drained and queued again months later is a
 * different piece of work) and the attempt count (a rebuild that failed and
 * backed off deserves a fresh job, not the old one's answer). So the key is
 * the row's enqueue stamp and its attempts, and asking for it twice inside
 * one attempt answers the SAME job — which is how the drain finds a job it
 * filed on an earlier tick and reads its result.
 *
 * `enqueued_at` is written once by the operator sweep's insert and never
 * touched by the drain, which is what makes it the generation stamp. A row
 * whose stamp cannot be read has no stable key and is REFUSED (null) rather
 * than given a guessed one: a key that changes every tick would file a new
 * job every two minutes.
 */
/**
 * The op a rebuild's row carries. Its own, never `edit`: the op is part of
 * `edit_jobs`' idempotency key, so a rebuild and a customer's edit of the same
 * site can never collapse into one job, and a row reading `rebuild` says at a
 * glance that nobody was charged for it.
 */
export const REBUILD_OP = "rebuild";

/**
 * A FEW SECONDS BEFORE THE JOB'S OWN MESSAGE IS DELIVERED, and it is not
 * politeness.
 *
 * The drain claims the row through `rebuild_claim`, which MARKS it
 * (`running_until`) — and that mark is exactly what `site_busy` reads as "the
 * platform is rebuilding this site". The mark is cleared by the deferral this
 * tick makes immediately afterwards, but the job's own `edit_claim` would race
 * it: a claim that lands first meets the drain's own mark, reads the site as
 * busy, and waits a minute for nothing. The delay is longer than the two
 * writes between, so the ordinary case never races; a delivery that beats it
 * anyway costs one deferral and heals itself, which is why this is a delay and
 * not a lock.
 */
export const REBUILD_START_DELAY_S = 5;

export function rebuildIdem(enqueuedAt, attempts) {
  const ms = typeof enqueuedAt === "number" ? enqueuedAt : Date.parse(String(enqueuedAt || ""));
  if (!Number.isFinite(ms)) return null;
  const n = Number(attempts);
  const tries = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 99999) : 0;
  return "rebuild-" + Math.floor(ms) + "-" + tries;
}

/**
 * What a rebuild outcome means. THREE answers, not two, and the third is the
 * one this queue needs that the teardown queue did not.
 *
 *   pending → the work is a JOB now (stage 9) and it has not answered yet:
 *           this tick filed it, or an earlier tick did and it is still
 *           running. Nothing has failed, so no attempt is counted and no rung
 *           climbed — the row is pushed out and asked again, exactly as a busy
 *           site is. It is read FIRST because a pending answer carries no
 *           verdict of its own to misread.
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
  // THE JOB HAS NOT ANSWERED YET (stage 9). Read before `ok` and before
  // `gone`, because a pending answer is about the JOB rather than the site and
  // carries neither.
  if (res.pending === true) {
    // A pending answer may name its own wait — a site under review waits for a
    // person and is asked again on the busy cadence rather than the job one.
    const wait = Number(res.wait);
    return { state: "pending", reason: String(res.reason || "handed to a job").slice(0, 300), wait: Number.isFinite(wait) && wait > 0 ? Math.floor(wait) : PENDING_DEFER_SEC };
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
 *   claim(slug, sec)            → true | false | "busy"  push next_try_at out, atomically; did we win —
 *                                 "busy" is a site a job holds (stage 6): deferred, never a failure
 *   rebuild(slug, row)          → the spine's result object, or `{pending: true,
 *                                 reason, wait?}` when the work is a job that
 *                                 has not answered yet (stage 9)
 *   forget(slug)                → void   delete the queue row
 *   defer(slug, attempts, sec, why) → void   push next_try_at out and record why
 *
 * Returns a summary rather than logging it, so the caller decides whether a tick
 * is worth a line — the same reason publish-pages.mjs returns `stage`.
 *
 * IT CANNOT THROW. A queue drain that takes down the cron takes the nightly
 * backups, the teardown queue, the domain watch and the webhook queue with it.
 *
 * THE ROWS RUN SIDE BY SIDE (2026-09-04). Each site has its own container lane,
 * so nothing is gained by waiting for one site's rebuild before starting the
 * next — and something is lost: a batch in series outruns the fifteen minutes
 * a cron invocation is allowed (see BATCH). Every row's chain — exists, claim,
 * rebuild, forget or defer — is its own promise and settles on its own; the
 * summary counts them as they land, and nothing in one chain can throw into
 * another.
 */
export async function drainRebuild(deps, { limit = BATCH } = {}) {
  const out = { attempted: 0, rebuilt: 0, gone: 0, deferred: 0, parked: 0, lost: 0, busy: 0, pending: 0, errors: [] };
  let rows = [];
  try { rows = (await deps.due(limit)) || []; }
  catch (e) {
    // A queue we cannot read is not an empty queue. Reported, so a tick that did
    // nothing because Supabase was down is distinguishable from one with nothing
    // to do.
    out.errors.push("due: " + String((e && e.message) || e).slice(0, 200));
    return out;
  }

  await Promise.all(rows.map((row) => drainOne(deps, row, out)));
  return out;
}

/** One row's whole chain. Never throws: every step reports into `out`. */
async function drainOne(deps, row, out) {
  {
    const slug = row && String(row.slug || "");
    if (!slug) return;

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
      return;
    }
    if (!alive) {
      try { await deps.forget(slug); out.gone++; }
      catch (e) { out.errors.push("forget " + slug + ": " + String((e && e.message) || e).slice(0, 120)); }
      return;
    }

    // ── CLAIM IT BEFORE SPENDING A CONTAINER RUN ─────────────────────────────
    //
    // The row is not touched again until the rebuild RETURNS — the ordering that
    // stops a crashed run losing the site from the queue — so without this an
    // overlapping tick reads the same row as due and starts a second container
    // run for the same site. See CLAIM_SEC.
    //
    // A CLAIM THAT CANNOT BE RECORDED IS A CLAIM LOST, in `runScheduledSiteJobs`'s
    // own words: false, a throw and an unreadable answer are all a loss. Being
    // wrong that way skips one site for ten minutes; being wrong the other way is
    // the duplicate run this exists to prevent.
    let won = false;
    try { won = await deps.claim(slug, CLAIM_SEC); }
    catch { won = false; }
    if (won === "busy") {
      // THE SITE IS SOMEBODY'S RIGHT NOW (stage 6): an edit, a build or an
      // addon holds it, and a rebuild that published under it would carry
      // their pages back to before their change. Pushed out and asked again
      // later — no attempt, no rung, the reason on the row for anyone reading
      // it — because a busy site is not a failing one.
      try {
        await deps.defer(slug, Number(row.attempts || 0), BUSY_DEFER_SEC, "site busy: a job holds it");
        out.busy++;
      } catch (e) { out.errors.push("defer " + slug + ": " + String((e && e.message) || e).slice(0, 120)); }
      return;
    }
    if (won !== true) {
      // LOSING A RACE IS NOT A FAILURE. No attempt counted, no backoff climbed,
      // no `last_error` written — the tick that won is doing the work, and
      // recording this as a failure would park a healthy site after five ticks
      // of ordinary contention.
      out.lost++;
      return;
    }

    out.attempted++;
    let verdict;
    // THE ROW GOES WITH THE SLUG (stage 9): the rebuild is a job now, and its
    // name is derived from this row's own generation and attempt so that
    // asking twice inside one attempt finds the job already filed rather than
    // filing a second one. A dep that only wants the slug ignores the rest.
    try { verdict = verdictFor(await deps.rebuild(slug, row)); }
    catch (e) {
      // A THROW IS OURS. The spine returns its failures; anything that escapes
      // it is a fault in the platform, so it retries rather than parking a site
      // whose pages may be perfectly good.
      verdict = { state: "retry", reason: String((e && e.message) || e).slice(0, 300) };
    }

    // ── THE JOB HAS IT (stage 9) ─────────────────────────────────────────
    //
    // Filed this tick, or filed earlier and still running. NOT a failure: no
    // attempt, no rung, the reason on the row for anyone reading it — the
    // busy branch's rule, for the same reason. The next look meets the job's
    // own lease on the site and waits behind it.
    if (verdict.state === "pending") {
      try {
        await deps.defer(slug, Number(row.attempts || 0), verdict.wait || PENDING_DEFER_SEC, verdict.reason);
        out.pending++;
      } catch (e) { out.errors.push("defer " + slug + ": " + String((e && e.message) || e).slice(0, 120)); }
      return;
    }

    if (verdict.state === "done" || verdict.state === "gone") {
      // The row goes only after the work does — the teardown queue's ordering,
      // for the same reason: forgetting first and then failing loses the site
      // from the queue with nothing recording that it never got the upgrade.
      try {
        await deps.forget(slug);
        if (verdict.state === "gone") out.gone++; else out.rebuilt++;
      } catch (e) { out.errors.push("forget " + slug + ": " + String((e && e.message) || e).slice(0, 120)); }
      return;
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
}

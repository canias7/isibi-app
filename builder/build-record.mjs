// What a build did, written down while it is still happening.
//
// WHY THIS EXISTS, and it is a measurement rather than a precaution.
//
// `makeTrace` records every step of a build and hands the result back ON THE
// RESPONSE. That is the whole account of what happened — and it is exactly the
// thing a failing build does not produce. Measured five times running
// (2026-08-22): design and Neon provisioning completed in 46-93 seconds, then
// the request ran for between 4.5 and 27 minutes and answered nothing. Three
// died with `ECONNRESET` from the far end at 286.0s, 285.3s and 274.3s; two were
// killed by the CI runner's own 30-minute cap.
//
// So for every one of those the trace existed, was correct, and was lost — and
// the only question anybody had ("which step was it in?") was the one question
// nothing could answer. Cloudflare's own log has it, and a session here cannot
// read that log, which is what makes an in-band record worth the round trips.
//
// WHAT MAKES IT SAFE TO PUT ON THE BUILD PATH. Three properties, and each is a
// test below rather than a hope:
//
//   - IT CANNOT THROW. A build must never be lost to the thing measuring it —
//     the rule `makeTrace` next door already lives under, extended to a
//     component that does I/O and therefore has far more ways to fail.
//   - IT CANNOT BLOCK. Nothing here is ever awaited on the critical path. A
//     Supabase that has gone away costs a warning and no time.
//   - IT COALESCES. A build makes ~15 marks; naively that is 15 sequential
//     round trips of a Worker's subrequest budget spent on diagnostics. Only the
//     LATEST snapshot is ever in flight, so the writes are bounded by how fast
//     Supabase answers rather than by how many steps a build has.
//
// AND IT CARRIES NO SECRET, by construction rather than by filtering: a trace
// step is a NAME and finite NUMBERS — `makeTrace` has deliberately no way to
// attach free text — so a connection string, a customer's brief or a model's
// prose cannot reach this table by any route.

/** Only one row per SLUG, upserted, so the table is bounded by sites and not by
 *  builds. A site rebuilt fifty times has one row: its latest attempt. */
export const BUILD_RECORD_TABLE = "site_builds";

/**
 * A recorder.
 *
 *   const rec = makeRecorder({ write, hold: (p) => ctx.waitUntil(p) });
 *   const tr  = makeTrace(undefined, () => rec.step(tr.done()));   // see below
 *   rec.identify(slug, uid);          // as soon as the slug is decided
 *   rec.finish({ stage: "published", ok: true });
 *
 * `write(row)` is injected — the whole point, so every decision here is driven
 * against a fake and none of it needs Supabase, a network or a Worker.
 *
 * `hold(promise)` is `ctx.waitUntil`. WITHOUT IT THE LAST WRITE IS LOST, and the
 * last write is the interesting one: a fire-and-forget promise started as the
 * isolate finishes is cancelled with it, so the row would stop one step short of
 * whatever went wrong. Optional, because a caller with no request context is
 * better off recording most of a build than none of it.
 */
/** How many carried-forward marks a row may hold. A fire's whole trace is ~16
 *  and a bound is what stops a record that keeps being re-read growing without
 *  one. The OLDEST are dropped, because a truncated tail loses the marks nearest
 *  the failure and those are the ones anybody is reading for. */
export const MAX_PRIOR_STEPS = 40;

export function makeRecorder({ write, hold = null, now = () => Date.now(), prior = null } = {}) {
  let slug = null;
  let uid = null;
  // WHAT AN EARLIER INVOCATION OF THIS BUILD ALREADY RECORDED.
  //
  // `site_builds` is one row per SLUG, upserted — which was the whole truth
  // while a build was ONE invocation. Stage 2 makes it several: a fire, then a
  // look every minute, then the one that finishes. Each starts a fresh recorder,
  // so each REPLACED the row and the build's history was whatever the last
  // invocation happened to do. Measured on `northgroup-5`, the run that lost two
  // generations: the row read `[{resume:stop}, {fonts}] total_ms 56` — the
  // design call, the provisioning and the fire were all gone, and the trace is
  // the record that is supposed to survive nobody looking.
  //
  // NARROWED THE SAME WAY A LIVE MARK IS. `makeTrace` accepts a name and finite
  // numbers and nothing else, deliberately, so a connection string cannot reach
  // this table by any route — and a mark read back off a stored record has to
  // clear the same bar rather than being trusted for having been ours once.
  const carried = [];
  let carriedMs = 0;
  if (Array.isArray(prior)) {
    for (const s of prior.slice(-MAX_PRIOR_STEPS)) {
      if (!s || typeof s !== "object") continue;
      const name = typeof s.s === "string" ? s.s.slice(0, 40) : "";
      if (!name) continue;
      const step = { s: name };
      for (const [k, v] of Object.entries(s)) {
        if (k === "s") continue;
        if (typeof v === "number" && Number.isFinite(v)) step[k] = v;
      }
      if (typeof step.ms === "number") carriedMs += Math.max(0, step.ms);
      carried.push(step);
    }
  }
  // THE NEWEST SNAPSHOT NOT YET WRITTEN — the SNAPSHOT, not a finished row.
  //
  // Built into a row at step time instead, a buffered step captures `slug` as it
  // was THEN, which before `identify` is null — so the whole prologue that
  // buffering exists to keep would be flushed as a row with no key, dropped by
  // the writer, and lost exactly as if it had never been held. Caught by the
  // first test that drove it.
  let latest = null;
  let inflight = false;
  let closed = false;

  const clock = () => {
    try {
      const t = now();
      return typeof t === "number" && Number.isFinite(t) ? t : 0;
    } catch { return 0; }
  };
  const started = clock();

  /** Registered on `hold` so a dying isolate cannot cancel it. */
  const keep = (p) => {
    try { if (hold && p && typeof p.then === "function") hold(p.then(() => {}, () => {})); } catch { /* never */ }
    return p;
  };

  function pump() {
    // NOTHING TO SAY, OR NOWHERE TO SAY IT. Before the slug is decided there is
    // no key to upsert on — the design call and everything above it happen
    // first — so the snapshot is HELD rather than dropped, and `identify`
    // flushes it. A build that dies before it has a slug leaves no row, which is
    // honest: it never got as far as being a site.
    if (closed || inflight || !slug || !latest || typeof write !== "function") return;
    // Built HERE, with the slug in hand — see the declaration of `latest`.
    const row = rowFor(latest.snapshot, latest.extra);
    latest = null;
    inflight = true;
    let p;
    try {
      p = write(row);
    } catch (e) {
      // A `write` that throws SYNCHRONOUSLY must not leave the pump wedged —
      // otherwise one bad call silences every later step of the build.
      inflight = false;
      return;
    }
    if (!p || typeof p.then !== "function") { inflight = false; pump(); return; }
    keep(p.then(
      () => { inflight = false; pump(); },
      () => { inflight = false; pump(); },
    ));
  }

  /** The row as it stands. Only names and finite numbers reach it — see above. */
  function rowFor(snapshot, extra) {
    const mine = (snapshot && Array.isArray(snapshot.steps)) ? snapshot.steps : [];
    const steps = carried.length ? carried.concat(mine) : mine;
    const own = snapshot && Number.isFinite(snapshot.totalMs) ? snapshot.totalMs : Math.max(0, clock() - started);
    // TIME SPENT, NOT TIME ELAPSED, which is what `total_ms` has always meant
    // and is why the carried total is ADDED rather than the wall clock since the
    // fire being used. A fired build spends most of its life waiting in a queue
    // and none of that is work; how long it has been waiting is `looks` against
    // the schedule, which `build flight` already prints.
    const total = own + carriedMs;
    return {
      slug,
      uid: uid || null,
      steps,
      total_ms: Math.max(0, Math.round(total)),
      // `at` is the LAST step's name, which is what "where did it get to" means.
      // Read off the trace rather than tracked separately, so the two can never
      // disagree about how far a build got.
      at: steps.length ? String(steps[steps.length - 1].s).slice(0, 40) : null,
      ...(extra || {}),
    };
  }

  return {
    /**
     * The slug and the account, as soon as the route knows them. Flushes
     * whatever was buffered above.
     *
     * IT NEVER CHANGES THE SLUG ONCE SET. A second call with a different one
     * would move the whole build's history onto another site's row — and there
     * is exactly one build per request, so a second slug is a bug rather than a
     * rename.
     */
    identify(s, u) {
      try {
        if (!slug && typeof s === "string" && s) slug = s.slice(0, 80);
        if (!uid && typeof u === "string" && u) uid = u.slice(0, 64);
        pump();
      } catch { /* a recorder must never break a build */ }
    },

    /** A step happened. Cheap: it stores a snapshot and maybe starts a write. */
    step(snapshot, extra) {
      try {
        if (closed) return;
        latest = { snapshot, extra };
        pump();
      } catch { /* never */ }
    },

    /**
     * The build is over, however it ended.
     *
     * `finish` CLOSES the recorder, so a late step from a straggling promise
     * cannot overwrite the outcome with a row that says the build is still
     * running. The final row is written even if one is in flight — this is the
     * one that matters, and it is the reason `hold` exists.
     */
    finish(snapshot, outcome) {
      try {
        if (closed) return;
        const final = rowFor(snapshot, { done: true, ...(outcome || {}) });
        closed = true;
        latest = null;
        if (typeof write !== "function" || !slug) return;
        let p;
        try { p = write(final); } catch { return; }
        keep(p);
      } catch { /* never */ }
    },

    /** For the tests, and for a caller that wants to know whether it is armed. */
    state() {
      try { return { slug, uid, closed, inflight, buffered: !!latest }; }
      catch { return { slug: null, uid: null, closed: true, inflight: false, buffered: false }; }
    },
  };
}

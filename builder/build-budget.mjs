// One budget for the whole build, not one per call.
//
// WHY THIS EXISTS, and it is a measurement rather than a precaution.
// `BUILDER_CALL_MS` bounds a MODEL CALL at ten minutes and is correctly applied
// to both providers. It has never once fired, across four failed builds, and
// the reason is arithmetic:
//
//     design    up to 600s
//     provision      ~40s
//     pages     up to 600s
//     container     ~500s   (STEP_TIMEOUT 150s, several steps)
//                 = ~1740s  ≈ 29 minutes
//
// So a build with NO hang anywhere can legitimately run past half an hour, and
// a per-call bound cannot refuse it — there is no single call to refuse.
// Measured live: run 12 (2026-08-22) ran 26.9 minutes and was killed by the
// runner's own 30-minute cap, having provisioned its Neon project 46 seconds in.
// Bounding two calls does not bound a build.
//
// WHAT A BUDGET BUYS THAT A TIMEOUT DOES NOT. A timeout answers "is this ONE
// thing taking too long"; a budget answers "is there still time to finish", and
// only the second can refuse honestly BEFORE spending the next expensive step.
// A customer who waits fifteen minutes and is told what happened is in a
// completely different position from one whose socket dies at twenty-seven.
//
// EVERY READ IS GUARDED, the same rule `makeTrace` next door already follows: a
// clock that throws must not take down the build it was measuring. A broken
// clock reads as NO time elapsed — the direction that lets the build finish,
// because being wrong toward refusing a healthy build is the more expensive
// mistake and this module is not what the customer paid for.

/**
 * Fifteen minutes.
 *
 * BELOW THE RUNNER CAP AND ABOVE THE SLOWEST HONEST BUILD, which is the whole
 * calibration. Measured builds that PUBLISHED: 378s (run 6), 507s (run 7), 272s
 * (GatherHire). The slowest thing ever observed finishing is ~8.5 minutes, so
 * fifteen is roughly 1.8x it — enough that an unlucky-but-real build is not
 * refused, short enough that a customer is answered rather than abandoned.
 *
 * IT IS NOT 30. The point is to answer BEFORE the surrounding cap kills us:
 * `build as owner` stops at 30 minutes and Cloudflare will eventually stop a
 * request too, and a budget that expires after its container has already been
 * torn down refuses nothing — it just fails later, which is what happens today.
 */
export const BUILD_BUDGET_MS = 900000;

/**
 * The ceiling on ONE container run — ten minutes.
 *
 * THE OTHER UNBOUNDED AWAIT, and until 2026-08-22 the only bound anywhere near
 * the build path was `BUILDER_CALL_MS` on the two MODEL calls. The container
 * fetch on both publish spines carried no signal at all, so once the model
 * answered there was nothing left that could ever stop a build.
 *
 * That matters more than it looks, because the container is shared: it is
 * `oneAtATime` for the WHOLE PLATFORM and `getContainer` is called with no id,
 * so one wedged run does not stall one build — every other customer's build
 * queues behind it, on a fetch that also cannot time out.
 *
 * CALIBRATED ON THE MEASURED RUNS. The container's own slice was 261s on run 6
 * (vite 37s, render 12s, tsc 9s, publish 7s, generation the rest) and it runs
 * several steps each bounded by `STEP_TIMEOUT` at 150s — so a legitimately slow
 * run is minutes, not seconds. Ten is roughly 2.3x the worst measured, and it
 * composes with the build budget through `capMs`, so a container starting late
 * in a build gets what is left rather than a fresh ten.
 */
export const CONTAINER_CALL_MS = 600000;

/**
 * The clock a build is measured against.
 *
 * `capMs(cap)` is the one callers should reach for: it hands back whichever is
 * SOONER, the per-call bound or what is left of the build. That is what makes
 * the two bounds compose rather than compete — a pages call started at minute
 * fourteen gets sixty seconds, not another ten minutes.
 */
export function makeBudget(ms = BUILD_BUDGET_MS, now = () => Date.now()) {
  const clock = () => {
    try {
      const t = now();
      return typeof t === "number" && Number.isFinite(t) ? t : 0;
    } catch { return 0; }
  };
  // A NON-NUMBER BUDGET IS THE DEFAULT, NOT ZERO. `makeBudget(undefined)` and a
  // config typo both have to mean "the ordinary budget"; read as zero they mean
  // "refuse everything", which is every build on the platform refused instantly
  // by a module whose whole job is to be unobtrusive.
  const total = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : BUILD_BUDGET_MS;
  const t0 = clock();
  const used = () => Math.max(0, clock() - t0);

  return {
    totalMs: total,
    usedMs: used,
    remainingMs: () => Math.max(0, total - used()),
    /** Has the build run out of time? */
    expired: () => used() >= total,
    /**
     * The bound for one call: the sooner of its own cap and what is left.
     *
     * NEVER ZERO, and that is deliberate rather than defensive. `AbortSignal
     * .timeout(0)` aborts on the next tick, so a call started with nothing left
     * fails in a way indistinguishable from the provider hanging up — the exact
     * confusion `isCallTimeout` exists to end. A caller with no time should ask
     * `expired()` and refuse in words; if it asks anyway it gets one second,
     * which fails fast and reads as a timeout because it is one.
     */
    capMs(cap) {
      const c = typeof cap === "number" && Number.isFinite(cap) && cap > 0 ? cap : total;
      return Math.max(1000, Math.min(c, total - used()));
    },
  };
}

/**
 * What to tell the customer when the budget runs out.
 *
 * NAMED BY STAGE, because the two ends of a build mean opposite things to
 * somebody deciding what to do next: out of time before the pages were written
 * is a build that produced nothing, and out of time at the publish is a build
 * whose work exists and is not yet served. A single sentence for both sends
 * half of them to do the wrong thing.
 *
 * IT SAYS NOTHING ABOUT MONEY, and the reason is that this module cannot know.
 * `ourFault(stage)` decides that one layer up, and a sentence here promising a
 * refund the ledger did not make would be the worse of the two lies.
 */
export function budgetNote(stage) {
  const s = String(stage || "").trim();
  if (s === "design" || s === "provision") {
    return "This build ran out of time before your data model was ready, so nothing was set up.";
  }
  if (s === "generate") {
    return "Your database is live, but the pages took longer than a build is allowed and were not written.";
  }
  return "Your pages were written, but the build ran out of time before they could be published.";
}

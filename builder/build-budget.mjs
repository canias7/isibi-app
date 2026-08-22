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
// RAISED TO TWO HOURS (2026-08-22, owner's call): "just let the model work,
// forget about time". Raised rather than deleted so `raceDeadline`, `capMs` and
// every guard over them stay exactly as they are — what goes is the number's
// ability to bind, not the mechanism.
//
// AND IT HAD ALREADY BEEN MEASURED INERT. The first build ever to run past
// fifteen minutes (2026-08-22, `css-axes-lido`, 26m48s) did NOT get this
// answer: no response, and no `deadline` step in its trace, which `onExpire`
// writes. Both this and `BUILDER_CALL_MS` are setTimeout inside the Worker
// isolate, and when the isolate stopped they stopped with it. So this is a
// bound that has never once fired, being raised past where it could.
export const BUILD_BUDGET_MS = 7200000;

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
// RAISED TO AN HOUR with the rest (2026-08-22, owner's call). The reasoning
// above still stands for why the bound EXISTS — the container is `oneAtATime`
// for the whole platform, so a wedged run queues every other customer behind it
// — and that is why this is raised rather than removed. An hour still ends a
// genuinely stuck container; it just cannot end a slow one.
export const CONTAINER_CALL_MS = 3600000;

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
 * Race some work against a deadline, and answer with whichever lands first.
 *
 * THE POINT IS THAT IT BOUNDS WORK IT KNOWS NOTHING ABOUT. Every other bound on
 * the build path is an `AbortSignal` somebody remembered to attach to a specific
 * fetch, and a per-call cap can only ever cover the calls you thought of.
 * Measured on run 13 (2026-08-22): the budget was threaded correctly into both
 * model calls and both container fetches, the arithmetic said the build must
 * answer by minute fifteen, and it ran 26.5 minutes and answered nothing — the
 * hang was in an await that had no signal because nobody had put one there. A
 * race cannot be incomplete that way.
 *
 * IT DOES NOT CANCEL THE WORK, and cannot: a promise has no cancel. What it
 * bounds is the WAIT. The caller keeps the work alive (`ctx.waitUntil`) so a
 * build that was two minutes from finishing still finishes and still publishes.
 *
 * A REJECTION PROPAGATES UNCHANGED. `Promise.race` forwards whichever settles
 * first, including a throw — so a build that fails fast behaves exactly as it
 * did before this existed.
 *
 * AND `onExpire` THROWING DEGRADES TO NO DEADLINE, never to a 500. If the thing
 * that builds the timeout answer is itself broken, resolving with the throw
 * would turn every slow build into an error the customer cannot act on; leaving
 * the race to the work restores precisely the behaviour of not having a deadline
 * at all, which is the direction that costs nothing it was not already costing.
 */
export function raceDeadline(work, { ms, onExpire }) {
  let timer = null;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      let answer;
      try { answer = onExpire(); } catch { return; }
      resolve(answer);
    }, ms);
  });
  // Cleared on either outcome so a settled build does not hold a timer for the
  // rest of its budget. `finally` forwards the value and the rejection alike.
  return Promise.race([work, deadline]).finally(() => {
    try { clearTimeout(timer); } catch { /* never */ }
  });
}

/**
 * Where a build had got to, in the three words `budgetNote` speaks.
 *
 * The trace names steps for the ENGINEER (`prov:database`, `seedrows`, `og`);
 * the note has to speak to the CUSTOMER, and the only distinction that matters
 * to them is what survives: nothing, a live database, or written pages. This is
 * the one place those two vocabularies meet.
 *
 * IT WALKS BACKWARDS TO THE LAST NAME IT KNOWS, rather than reading only the
 * final step, and that is what makes it survive a mark being added later. A new
 * step this table has never heard of would otherwise fall to a default and
 * could tell a customer with a live database that nothing was set up — and the
 * build path is exactly the file that grows new marks. Falling back to the last
 * RECOGNISED step is the honest floor: it says "at least this far", which is
 * always true, where a default is a guess that can be wrong in either direction.
 */
export function budgetStage(steps) {
  const STAGE = {
    auth: "design", body: "design", links: "design", gate: "design",
    design: "provision", seedrows: "provision", owner: "provision",
    normalize: "provision", provision: "provision",
    schema: "generate", jobs: "generate", seed: "generate", look: "generate",
    merge: "generate", research: "generate", fonts: "generate", gen: "generate",
    // From here the pages exist, so the note stops saying they were not written.
    img: "publish", compile: "publish", container: "publish", og: "publish",
    // The build route's last mark, taken after `buildAndPublishPages` returns.
    // A deadline that lands here is a build that did everything and was not told
    // so — rare, and the note has to be the one that says the pages exist.
    pages: "publish",
  };
  const list = Array.isArray(steps) ? steps : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const raw = list[i] && (typeof list[i] === "string" ? list[i] : list[i].s);
    const name = String(raw || "");
    // Every provisioning sub-step (`prov:project`, `prov:auth`, …) means the
    // same thing to a customer, and they are named by the provisioner rather
    // than by this file, so a prefix is the only reading that cannot go stale.
    if (name.startsWith("prov:")) return "provision";
    if (Object.hasOwn(STAGE, name)) return STAGE[name];
  }
  // Nothing recognised — including an empty trace, which is a build that died
  // before its first mark. "Nothing was set up" is exactly right there.
  return "design";
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

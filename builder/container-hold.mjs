// WHETHER A CONTAINER THAT NOBODY IS CONNECTED TO MAY BE STOPPED.
//
// ── THE BUG THIS EXISTS TO PREVENT, WHICH HAS NOT HAPPENED YET ───────────────
//
// Today every build has a Worker awaiting it, so this file is inert: the
// library's `isActivityExpired()` short-circuits on `inflightRequests > 0` and
// `onActivityExpired` is never called at all. It exists for the change that is
// coming — moving page generation into the container so the Worker can stop
// waiting — and that change fails at exactly five minutes without it.
//
// Traced through `@cloudflare/containers/dist/lib/container.js` rather than
// assumed:
//
//   catch (e) { this.decrementInflight(); … }        ← an ABANDONED fetch lands here
//
//   decrementInflight() {
//     this.inflightRequests = Math.max(0, this.inflightRequests - 1);
//     if (this.inflightRequests === 0) this.renewActivityTimeout();
//   }                                                 ← sleepAfterMs = now + sleepAfter
//
//   isActivityExpired() {
//     if (this.inflightRequests > 0) { … return false; }
//     return this.sleepAfterMs <= Date.now();
//   }
//
//   if (this.isActivityExpired()) { await this.onActivityExpired(); }   → this.stop()
//
// So the moment the Worker walks away, the inflight counter drops to zero, the
// idle clock starts, and roughly `sleepAfter` later the alarm STOPS the
// container — mid-build, with no error anywhere. `SiteBuildContainer` sleeps
// after five minutes and the work being moved in takes seven to twelve. Every
// such build would have died at five, silently, and the symptom would have read
// as the container crashing rather than as a timer doing its job.
//
// `onActivityExpired()` is the library's own documented override point ("If you
// want to shutdown the container, you should call this.stop() here"), which is
// why this is a hook rather than a fork. Raising `sleepAfter` to twenty minutes
// also works and is worse: every IDLE container then lingers twenty minutes and
// bills for it, where this stops an idle one immediately and holds only a
// working one.
//
// ── WHY THE DECISION IS HERE AND THE WIRING IS IN worker.js ──────────────────
//
// The class extends `Container` from the library and is constructed by the
// runtime, so nothing about it can be driven by a unit test. The RULE is
// arithmetic over one small object and every way of getting it wrong is silent,
// so it lives where it can be driven with literals — the shape `build-lane.mjs`
// and `site-rebuild.mjs` already use.

// TWO IMPORTS, AND THEY ARE WHAT STOPS `MAX_BUSY_HOLD_MS` BEING A SECOND COPY
// OF THE JOB'S CLOCK. This module was dependency-free until 2026-09-14; the
// ceiling below is DERIVED from the deadline it has to outlive, and deriving it
// is the whole point — a number typed here beside `BUILD_JOB_MS` drifts the next
// time either moves, which is exactly how the two came to be equal at thirty
// minutes. Both are Worker-side modules this one already ships beside.
import { jobDurationPlan } from "./job-duration.mjs";

import { BUILD_JOB_MS } from "./build-job.mjs";
import { JOB_KILL_GRACE_MS, JOB_TERM_GRACE_MS } from "./job-clock.mjs";

// HOW LONG A CONTAINER MAY BE HELD PAST ITS IDLE TIMEOUT, and it is a backstop
// rather than a tuned number. Inside the container `STEP_TIMEOUT` bounds every
// subprocess and `oneAtATime` serialises the queue, but a job that hangs in an
// await that is not a subprocess has no bound at all — and with nobody connected
// there is no `CONTAINER_CALL_MS` on the other end either. Without a cap, one
// `/busy` that answers `true` forever is a container that bills forever.
//
// ── IT MUST SIT ABOVE THE JOB'S OWN DEADLINE, AND UNTIL 2026-09-14 IT DID NOT ─
//
// This was 30 minutes while `BUILD_JOB_MS` was ALSO 30 minutes, and the two
// being equal was a defect rather than a coincidence. The build service stops a
// child at its deadline plus `JOB_KILL_GRACE_MS` (60 s) and kills it
// `JOB_TERM_GRACE_MS` (30 s) after that — so a job that ran to its deadline had
// its CONTAINER stopped a minute BEFORE the SIGTERM that lets it end as a job.
// The graceful path — the runner answering `stopped` at its own gate, the money
// going back through the row's own door — was unreachable at exactly the moment
// it exists for, and the symptom would have read as the container crashing.
//
// So this is DERIVED from the job's clock rather than chosen beside it: the
// deadline, both graces, and a minute of slack for a slow last RPC. A number
// typed here independently is a second copy of `BUILD_JOB_MS` that drifts the
// next time either moves — which is what happened.
//
// AND IT IS THE ONE BOUND HERE THAT IS ABOUT MONEY. `CONTAINER_*_BUDGET_MS` is
// `Infinity` since 2026-09-14 (owner: "Containers shouldn't have a time limit")
// and the deadline is a credential lifetime; this is the only one whose cost is
// a bill. It holds a container that says it is BUSY, so a finished job stops
// being held at once and the ceiling is only ever reached by a job still
// working — or wedged, which is what the deadline below it ends.
export const MAX_BUSY_HOLD_MS = jobDurationPlan().holdMs;

// HOW LONG TO WAIT FOR THE CONTAINER TO SAY WHETHER IT IS BUSY. Generous on
// purpose: a healthy build spends nearly all its time awaiting a subprocess or a
// fetch, so the event loop is free and `/busy` answers in milliseconds. The case
// this bound exists for is a build spinning the CPU, which cannot answer at all —
// and that is precisely the container we want stopped, so a timeout resolving to
// "cannot tell" lands on the right side by construction.
//
// It also protects the Durable Object: `onActivityExpired` is awaited by the
// alarm handler, so a probe with no ceiling would wedge the alarm as well as the
// container.
export const BUSY_PROBE_MS = 5000;

/**
 * Should this container be stopped, given what it said about itself?
 *
 * @param {unknown} state    the parsed `/busy` answer, or null if it could not be asked
 * @param {{maxHoldMs?: number}} [opts]
 * @returns {{hold: boolean, why: string}}
 *
 * `why` is returned rather than logged so the caller can log it once, in the one
 * place that knows which container this was. Five reasons, and they are kept
 * apart because they call for five different responses from whoever reads the
 * log: `idle` is the ordinary path and means nothing, `busy` is this feature
 * working, and `no-answer` / `unreadable` / `stuck` are each a different fault.
 */
export function holdDecision(state, { maxHoldMs = MAX_BUSY_HOLD_MS } = {}) {
  // A NONSENSE CAP FALLS BACK TO THE DEFAULT RATHER THAN DISABLING THE CAP.
  // `undefined` already means "use the default" through the parameter, so what
  // this catches is a caller passing something computed and wrong — and the
  // failure direction matters: read as "no ceiling", a hung container is held
  // for ever. Same rule `pruneVersions` and the audit-log retention already use.
  const cap = typeof maxHoldMs === "number" && Number.isFinite(maxHoldMs) && maxHoldMs > 0
    ? maxHoldMs
    : MAX_BUSY_HOLD_MS;

  // COULD NOT ASK, OR IT ANSWERED SOMETHING THAT IS NOT AN ANSWER → STOP.
  //
  // The library only calls `onActivityExpired` on a container it believes is
  // RUNNING, so silence here is not "not started yet" — it is a container that
  // is up and will not answer a trivial GET, i.e. wedged. Stopping a wedged
  // container is both correct and the only way to reclaim it.
  //
  // The cost of being wrong this way is stated rather than glossed: a build that
  // was merely slow to answer loses its container. That is why `BUSY_PROBE_MS`
  // is five seconds against a handler that answers in one — and why the
  // alternative (hold when we cannot tell) is worse, since it makes an
  // unreachable container unreclaimable for ever.
  if (!state || typeof state !== "object") return { hold: false, why: "no-answer" };

  // STRICTLY `=== true`. Anything merely truthy keeping a container alive is a
  // billing decision made by a typo — `"false"`, `1`, `{}` are all truthy, and
  // this repo has shipped that exact coercion as a real bug three times.
  if (state.busy !== true) return { hold: false, why: "idle" };

  // A CONTAINER THAT CANNOT SAY HOW LONG IT HAS BEEN BUSY CANNOT BE CAPPED, so
  // it is not held. Reported apart from `no-answer` because they are different
  // faults: one is a container that would not speak, this is one whose answer we
  // do not understand — a version skew between the image and the Worker, which
  // is a deploy problem rather than a wedge.
  const since = state.sinceMs;
  if (typeof since !== "number" || !Number.isFinite(since) || since < 0) {
    return { hold: false, why: "unreadable" };
  }

  // BUSY FOR LONGER THAN ANY REAL BUILD → STOP. This is the backstop above: the
  // job is not coming back, and holding costs money for ever.
  if (since > cap) return { hold: false, why: "stuck" };

  return { hold: true, why: "busy" };
}

// THE CLOCK A JOB CHILD RUNS UNDER, AND HOW IT IS STOPPED (stage 5d, 2026-09-06).
//
// ── WHY A CHILD NEEDS A CLOCK OF ITS OWN ─────────────────────────────────────
//
// A queued job that runs INSIDE the site's container (builder/container-job.mjs)
// is a child process the build service spawned. The job's own budget
// (`makeEditBudget`, EDIT_JOB_MS from its claim) refuses the next phase once it
// is spent, and the lease sweep closes a row nobody renews — but nothing
// stopped the PROCESS. A child wedged in an await that never settles (a
// provider socket that neither answers nor closes, a compile whose service
// hung) held the container busy for ever: `_busy` stays raised for the child's
// life, so the idle clock never stops the container, and the SIGTERM drain
// waits its thirteen minutes on it. A job that had already been refunded by
// the sweep went on costing a container.
//
// So the launch carries the job's DEADLINE (the consumer's clock: when it
// fired plus the job's whole budget), the build service TERMINATES a child
// that outlives it by a grace, and KILLS one that ignores the termination.
// Two signals, in order, on purpose: SIGTERM is the child's chance to end its
// job as a job — the runner turns it into a `stopped` answer at the next
// gate, which refunds through the row's own door — and SIGKILL is for a child
// that cannot reach a gate. The same pair serves a cancel from outside
// (`DELETE /job/<id>` on the build service) and the service's own drain when
// it gives up waiting.
//
// Every number here is read by the build service, the runner and the guard,
// and every decision is a pure function of a clock handed in, so the whole
// policy is driven with literals and no real timer.
//
// DEPENDENCY-FREE, for the container's sake: the build service and the runner
// import this, and the service's image copies its imports one file at a time
// (Dockerfile) — a chain through edit-job.mjs would drag build-job.mjs in
// behind it. The one number shared with the edit path is spelled here and
// held equal by test/job-clock.test.mjs, the way job-gateway.mjs spells the
// sidecar key rather than importing it.

/** The job's whole budget — `EDIT_JOB_MS`, spelled (see above). */
export const DEFAULT_JOB_MS = 840_000;

/**
 * How long after the job's deadline the child is asked to stop. The job's
 * own budget keeps TERMINAL_RESERVE_MS (15 s) for its last writes and the
 * token outlives the clock by JOB_TOKEN_GRACE_S for the finalize; a minute is
 * room for both and for a slow answer to the last RPC — a child still running
 * a minute past its deadline is not finishing, it is stuck.
 */
export const JOB_KILL_GRACE_MS = 60_000;

/** How long a terminated child has to end its job as a job before it is killed. */
export const JOB_TERM_GRACE_MS = 30_000;

/**
 * Inside the child, how long the runner waits after SIGTERM for the job to
 * reach a gate and answer `stopped` before it exits on its own. UNDER the
 * service's kill grace, so a child that can still run code always ends
 * itself and the SIGKILL is only ever for one that cannot.
 */
export const JOB_STOP_GRACE_MS = 20_000;

/** The exit code a runner uses when it ended itself after SIGTERM. */
export const STOPPED_EXIT_CODE = 4;

/**
 * The deadline a launch names, read strictly: a finite positive number of
 * milliseconds since the epoch, or the fallback — now plus the job's whole
 * budget — for a launch that names none (a hand-written one, or a Worker
 * from before this stage). Never a past time read as "kill at once": a
 * deadline already behind `now` is still honoured as a deadline, and the
 * grace is what decides when the child is stopped.
 */
export function readDeadline(raw, now = Date.now(), fallbackMs = DEFAULT_JOB_MS) {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0 && typeof raw !== "boolean" && !Array.isArray(raw)) return Math.floor(n);
  return now + fallbackMs;
}

/**
 * When the service stops a child: `termAt` (SIGTERM) and `killAt` (SIGKILL),
 * both absolute, both at least `now` — a child started after its own deadline
 * is stopped in one grace, not at once, so a runner that can answer still does.
 */
export function killPlan(deadlineAt, now = Date.now()) {
  const termAt = Math.max(now, Number(deadlineAt) + JOB_KILL_GRACE_MS);
  return { termAt, killAt: termAt + JOB_TERM_GRACE_MS };
}

/**
 * THE TERMINATION SEQUENCE, driven with the timers handed in. `kill(signal)`
 * sends to the child; `setTimeout`/`clearTimeout` are the service's (fakes in
 * tests); `onState(state)` says what the record should show. Answers a
 * controller: `stop(why)` starts the sequence now (a cancel, the drain giving
 * up), `arm(deadlineAt)` schedules it for the deadline's grace, `clear()`
 * cancels every pending timer (the child ended), and `state()` reads it.
 * Idempotent: a second `stop` or `arm` after `stop` changes nothing.
 */
export function makeTerminator({ kill, setTimeout: st = setTimeout, clearTimeout: ct = clearTimeout, now = () => Date.now(), onState = () => {} } = {}) {
  let termTimer = null;
  let killTimer = null;
  let state = "running";
  let why = "";
  const set = (s) => { state = s; onState(s, why); };
  const sendKill = () => {
    killTimer = null;
    try { kill("SIGKILL"); } catch { /* gone already */ }
    set("killed");
  };
  const sendTerm = (reason) => {
    termTimer = null;
    if (state !== "running") return;
    why = reason;
    try { kill("SIGTERM"); } catch { /* gone already */ }
    set("stopping");
    killTimer = st(sendKill, JOB_TERM_GRACE_MS);
  };
  return {
    state: () => state,
    why: () => why,
    arm(deadlineAt) {
      if (state !== "running" || termTimer) return;
      const plan = killPlan(deadlineAt, now());
      termTimer = st(() => sendTerm("deadline"), Math.max(0, plan.termAt - now()));
    },
    stop(reason = "cancel") {
      if (termTimer) { ct(termTimer); termTimer = null; }
      sendTerm(reason);
    },
    clear() {
      if (termTimer) { ct(termTimer); termTimer = null; }
      if (killTimer) { ct(killTimer); killTimer = null; }
    },
  };
}

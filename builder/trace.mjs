// What a build actually did, step by step, with the time each one took.
//
// WHY THIS EXISTS. A build makes ~33 ordered steps across seven systems, and
// until now the only thing it reported about the journey was `buildMs` — the
// container's slice of it. Everything else was invisible: which step was slow,
// which one was skipped because the project already existed, whether the schema
// call or the pages call dominated.
//
// It is also the only way to settle a question that reading cannot. The build
// path reaches the outside world through INJECTED dependencies —
// `deps.generate`, `deps.compile`, `deps.publish` — which is what makes
// `publishPages` testable against fakes, and is exactly what stops any static
// walk of the source following the call graph through it. A trace taken at
// runtime is the only complete account.
//
// Constraints this is written under:
//   - it must never throw into a build. Every method swallows.
//   - it must cost nothing. Two `Date.now()` calls per step, no allocation
//     beyond one small object, no I/O.
//   - it must be BOUNDED. It rides in a response and, once, in a log line.
//   - it must never carry a secret. Callers pass a step NAME and small numbers;
//     there is deliberately no way to attach a free-text payload.

/** How many steps are kept. A build has ~33; the cap is for a runaway loop. */
export const MAX_STEPS = 60;

/**
 * A recorder.
 *
 *   const tr = makeTrace();
 *   tr.at("design");                  // time since the previous mark
 *   tr.at("pages", { out: 11418 });   // plus a few numbers worth keeping
 *   tr.done();                        // { steps, totalMs }
 *
 * `now` is injectable so the tests do not have to sleep, and because
 * `Date.now()` is the one thing here that cannot be asserted otherwise.
 */
export function makeTrace(now = () => Date.now()) {
  // EVERY clock read is guarded, including this first one. `at()` and `done()`
  // swallow, but the constructor did not — so a `now` that threw took the build
  // down before it had even read the request body, which is the exact opposite
  // of what a recorder is for. Caught by the "nothing it does can throw" test.
  //
  // A broken clock yields ms 0 rather than losing the step: a step recorded with
  // a wrong duration still answers "did this run", which is the question the
  // trace exists for. A missing step answers it WRONGLY.
  const clock = () => {
    try {
      const t = now();
      return typeof t === "number" && Number.isFinite(t) ? t : 0;
    } catch { return 0; }
  };
  const t0 = clock();
  let last = t0;
  const steps = [];
  let dropped = 0;

  return {
    /**
     * Mark the end of a step. `extra` may carry only finite NUMBERS — no
     * strings, so a connection string or a model's prose can never end up in a
     * trace by accident. Anything else is dropped silently rather than
     * stringified, because a trace that mangles its input is worse than one
     * that omits it.
     */
    at(name, extra) {
      try {
        const t = clock();
        const ms = t - last;
        last = t;
        if (steps.length >= MAX_STEPS) { dropped++; return; }
        const step = { s: String(name).slice(0, 40), ms };
        if (extra && typeof extra === "object") {
          for (const [k, v] of Object.entries(extra)) {
            if (typeof v === "number" && Number.isFinite(v)) step[String(k).slice(0, 16)] = v;
          }
        }
        steps.push(step);
      } catch { /* a trace must never break a build */ }
    },

    /** Everything recorded, plus the wall clock. Safe to call more than once. */
    done() {
      try {
        return { steps: steps.slice(), totalMs: now() - t0, ...(dropped ? { dropped } : {}) };
      } catch { return { steps: [], totalMs: 0 }; }
    },

    /**
     * One line for the log, newest last: `design 2140ms · schema 3980ms · …`.
     * Truncated hard — this goes to console on every build.
     */
    line() {
      try {
        return steps.map((x) => x.s + " " + x.ms + "ms").join(" · ").slice(0, 900);
      } catch { return ""; }
    },
  };
}

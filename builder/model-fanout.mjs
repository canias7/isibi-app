// N MODEL CALLS AT ONCE, AND ONE BAD ONE IS NOT ALL OF THEM (2026-09-09).
//
// Pulled out of `build-server.mjs`'s `/model/start` handler so it can be DRIVEN,
// and that is not tidiness — it is the second sweep of this change saying so.
// Two mutants survived a source-read guard and both were real:
//
//   * a `catch` that rethrows still contains the text `catch (e) {`, so a scan
//     for "each call catches its own failure" passes over a fan-out where the
//     first failure destroys every band that succeeded;
//   * an entry that loses its index still leaves `{ i,` elsewhere in the block,
//     so a scan for it passes over answers that can no longer be lined up with
//     the bands they were asked for.
//
// Both are the recorded "a chain asserted by reading is asserted at the layer
// below the break". Neither is expressible as a claim about text, and both are
// one line to assert once the thing can be run.
//
// DEPENDENCY-FREE, because the container imports it — and the Dockerfile has to
// COPY it. `test/dockerfile.test.mjs` walks the import graph and will say so if
// it is missed, which is the guard that caught `site-qr-list.mjs` missing from
// that line within the hour it was written.

/**
 * How many model calls run AT ONCE (2026-09-09, the band split; moved here
 * 2026-09-11; narrowed to concurrency the same day).
 *
 * IT USED TO MEAN TWO THINGS AND THE OWNER SPLIT THEM (2026-09-11: "whatever
 * the designer does then it should go to the generate, if the designer does 9
 * the generate needs 9 if 8, 8"). One number answered both "how many calls may
 * be in the air" and "how long a list may one job carry", so a page that
 * planned nine pieces of work was REFUSED THE SPLIT ENTIRELY and written in one
 * call — `bands:wide`, measured live on `ben-crowe-guitar` at a `genMs` of
 * 407,694, the longest page call this platform has recorded. The two questions
 * are now two constants: this one bounds the SOCKETS, `MAX_FANOUT_REQS` bounds
 * the LIST, and a list longer than this one queues instead of being refused.
 *
 * A RESOURCE BOUND, AND DELIBERATELY NOT DERIVED FROM `MAX_SECTIONS`. It is
 * tempting to tie this to the design's band cap, and it would be the wrong
 * list: that one answers "how many bands may a page have", a question about the
 * product, and this one answers "how many calls may a single container hold
 * open", a question about this process's memory and its sockets. The day the
 * plan allows twelve bands is the day this has to be re-decided ON ITS OWN
 * TERMS rather than dragged along — and since the split it no longer HAS to
 * move for that, because twelve bands now queue behind eight permits.
 *
 * 8 IS WHAT THIS PLATFORM HAS EVIDENCE FOR: seven at once, measured on
 * `kestrel-bindery`. Twelve is not refused for being wrong; it is refused
 * because nothing here has run it. `MAX_GRAPH_INFLIGHT` is the same number for
 * the same reason, one path over.
 */
export const MAX_MODEL_FANOUT = 8;

/**
 * How long a list ONE job may carry (2026-09-11).
 *
 * A DIFFERENT QUESTION FROM `MAX_MODEL_FANOUT`, and conflating the two is what
 * this constant exists to undo. Concurrency costs SOCKETS and is bounded at
 * eight by the permit pool below whatever the list length is; a long list costs
 * one entry in the job's answer store per request — a model answer each, which
 * is real memory but is spent as the answers arrive rather than all at once.
 *
 * 16: twice the concurrency, which leaves the store's worst case at the same
 * order as `MAX_MODEL_JOBS` (8) times a single answer, and clears what the
 * producers can actually compose — `MAX_BANDS` (8) plus `MAX_TSX` (3) is
 * eleven — with room for either cap to move without the old refusal creeping
 * back. THAT CLEARANCE IS A GUARD, NOT A CLAIM IN THIS COMMENT:
 * `test/page-parts.test.mjs` asserts `MAX_BANDS + MAX_TSX <= MAX_FANOUT_REQS`,
 * so the day a product cap outgrows this, a test goes red and somebody decides
 * on purpose rather than a build quietly going back to one call.
 *
 * IT LIVES HERE BECAUSE TWO SIDES NEED IT, exactly as the bound above does. The
 * container ENFORCES it (a longer list is a 400) and the Worker has to know it
 * before it composes one. Two copies of a bound where one side refuses and the
 * other side decides is "two lists of the same thing" with a build as the thing
 * that breaks.
 *
 * AND A LIST OVER IT IS NOT A FAILED BUILD. The container's 400 leaves the fire
 * with no job id, which is `noFanoutError()` — the named fallback to the single
 * call that an older image mid-rollout already produces — so the page is still
 * written, and the trace says `bands:nofanout`.
 */
export const MAX_FANOUT_REQS = 16;

/**
 * A permit pool. `n` calls may be in the air at once; the rest queue and take a
 * permit as one is released.
 *
 * LIVES HERE, NOT IN `design-graph.mjs` WHERE IT WAS WRITTEN (moved
 * 2026-09-11). Two callers now hold one back: the design graph's sixteen agents
 * and this module's own fan-out. A second copy is "two lists of the same thing"
 * over a semaphore, whose failure mode is a hang — every caller past the bound
 * waiting for a permit nobody released. It comes here rather than the other way
 * round because this module is DEPENDENCY-FREE and the container imports it;
 * `design-graph.mjs` already imports `runFanout` from here, so nothing new is
 * pulled into the image and there is no cycle.
 *
 * Its own function so the bound can be DRIVEN — a source read cannot tell a
 * semaphore that admits eight from one that admits everybody, and that is the
 * recorded "a chain asserted by reading is asserted at the layer below the
 * break".
 */
export function permits(n) {
  const max = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  let live = 0;
  const waiting = [];
  const release = () => {
    live--;
    const next = waiting.shift();
    if (next) { live++; next(); }
  };
  return {
    async take() {
      if (live < max) { live++; return release; }
      await new Promise((r) => waiting.push(r));
      return release;
    },
  };
}

/**
 * Run every request, `MAX_MODEL_FANOUT` at a time; answer one outcome per
 * request, in order.
 *
 * EVERY REQUEST GETS A CALL — a list longer than the bound QUEUES, it is never
 * refused and never truncated (2026-09-11, the owner's rule: "if the designer
 * does 9 the generate needs 9 if 8, 8"). Before this it really did run every
 * request at once, so the caller had to refuse any plan whose piece count
 * exceeded the bound, and the pages that most wanted splitting — a rich page
 * that also needs a component the kit has not got — were exactly the ones that
 * overflowed and got written in one call.
 *
 * `Promise.all` REJECTS ON THE FIRST FAILURE, and that is the whole reason this
 * function exists rather than being a one-liner at the call site. A page split
 * into eight bands where the fourth call fails would lose the seven that
 * worked — after paying for all eight — and come back as a bare rejection with
 * nothing to publish. Each call catches its own instead, so a failure is an
 * ENTRY rather than the end of the fan-out, and the assembler stubs it.
 *
 * EVERY ENTRY CARRIES ITS INDEX. Calls finish out of order — that is the point
 * of running them together — so the position in the answer is the only thing
 * tying an answer back to the band that was asked for. Without it the caller
 * has N answers and no way to know which is the hero.
 *
 * `now` is injected so the elapsed times can be driven; nothing in the product
 * passes it. `inflight` likewise, and it CAN ONLY EVER REDUCE the bound
 * (`Math.min`): the ceiling is ours, not the caller's — the same rule
 * `/model/start` states about `callMs` and `laneMaxTokens` about its own cap —
 * so a caller that asks for a hundred sockets gets eight.
 */
export async function runFanout(reqs, callOne, now = () => Date.now(), inflight = MAX_MODEL_FANOUT) {
  const list = Array.isArray(reqs) ? reqs : [];
  const want = Number(inflight);
  // NO `Number.isFinite` HERE, AND THAT IS A DELETION RATHER THAN AN OVERSIGHT.
  // The first draft read `Number.isFinite(want) && want > 0`, a sweep mutant
  // dropped the check, and it SURVIVED — measured inert over forty caller shapes,
  // and inert by algebra rather than by the fixtures: `NaN > 0` is already false
  // so a junk bound falls back here, `Infinity` is already clamped by the
  // `Math.min` on the same line, and `permits` floors anything left at 1. Two
  // spellings of one wall are not two walls — this repository's own rule, with
  // the smallest possible subject — so the duplicate went rather than being kept
  // as a second defence a sweep can never kill and the next session deletes
  // wondering what it was for.
  const max = Math.min(want > 0 ? want : MAX_MODEL_FANOUT, MAX_MODEL_FANOUT);
  // A LIST THAT FITS TAKES NO PERMIT AT ALL, AND THAT IS A PROPERTY RATHER THAN
  // AN OPTIMISATION. `list.map(async …)` invokes every callback synchronously as
  // far as its first `await`, so with nothing to queue behind, every call of a
  // fan-out starts in ONE synchronous pass — which is what the no-timer guards
  // rest on (`test/split-timing.test.mjs` says so in its own helper: by the time
  // the promise is returned, every call has started and parked on a gate). An
  // unconditional `await pool.take()` would push every start one microtask out
  // and those guards would have to await ticks or use timers, and timers here
  // have already drifted under sweep load once and come back with a
  // comment-only CONTROL killed. So the queue engages only when there is
  // something to queue, and every fan-out shipping today behaves exactly as it
  // did before this change.
  const pool = list.length > max ? permits(max) : null;
  const free = () => {};
  // ── WHAT THE FAN-OUT COST IN WALL TIME, STAMPED ON WHAT COMES BACK ─────────
  //
  // The question a split has to answer is "was running these together faster
  // than running them one after another", and it takes TWO numbers: the sum of
  // the per-call times (already on every entry as `ms` — what serial would have
  // cost) and the WALL time of the whole fan-out. The difference is the overlap,
  // and it can be read off ONE run with no baseline — which is the only way to
  // ask it at all, since build-to-build variance here is wider than any saving.
  //
  // MEASURED RATHER THAN DERIVED FROM `max(ms)`, AND THE DAY THIS COMMENT
  // PREDICTED HAS ARRIVED (2026-09-11). It used to say the two agree, because
  // every call's `at` was read in the same synchronous pass as `fanAt` — and it
  // named the exact thing that would end that: "the day anything staggers them —
  // a semaphore, a connection pool, a `callOne` that awaits before it dials".
  // The permit pool above IS that semaphore. A list longer than the bound starts
  // its tail late, so `max(ms)` now reports the slowest single call while the
  // fan-out really took longer — wrong in the FLATTERING direction, which is the
  // worst one for a number somebody decides with: a queued fan-out would read as
  // a fast one. One clock read buys immunity to that, and the guard pins it with
  // a fixture whose starts really do stagger.
  //
  // STAMPED ON EVERY ENTRY RATHER THAN RETURNED BESIDE THEM, and that is a
  // deliberate choice against the tidier shape. This value has to survive the
  // container's job store, its pushed report, its poll answer, the R2 record and
  // the resume — and `build-resume.mjs` says in as many words why a sibling
  // field is refused there: "a second field here would be a second set of
  // branches, one of which nobody drives". The entries already travel every one
  // of those hops intact, so riding on them costs no hop anybody can forget.
  // The price is the same number repeated N times, which is said here so nobody
  // later reads it as an accident. An array property would be tidier and is not
  // an option: `JSON.stringify` drops non-index properties, and every hop above
  // is JSON.
  // NOT `at`: every call has its own `at` inside the map, and one name for two
  // clocks is how a per-call time gets read as a wall time.
  const fanAt = now();
  const out = await Promise.all(list.map(async (r, i) => {
    const release = pool ? await pool.take() : free;
    // THE CALL'S CLOCK STARTS AFTER ITS PERMIT, NEVER BEFORE IT, and that is the
    // one line the pool could have quietly broken. `ms` means "what this call
    // cost", and the caller SUMS them into `agentMs` — the number that answers
    // "what would this have cost one after another". Started before the permit,
    // a queued call's `ms` would include the time it spent doing nothing, every
    // waiter would be charged for the calls ahead of it, and `agentMs` would
    // grow with the QUEUE rather than with the work. The overlap
    // (`agentMs - waveMs`) would then inflate itself: the longer the wait, the
    // better the split would appear to have done.
    const at = now();
    try {
      const answer = await callOne(r, i);
      return { i, state: "done", answer, ms: now() - at };
    } catch (e) {
      // THE SHAPE IS PRESERVED, exactly as the single-call path preserves it:
      // the Worker parses `detail` for the provider's own error type and reads
      // `status` to decide whether money was spent. Flattened to a message, a
      // real 429 arrives wearing a container fault.
      return {
        i,
        state: "failed",
        status: (e && e.status) || null,
        detail: e && typeof e.detail === "string" ? e.detail : "",
        message: String((e && e.message) || e).slice(0, 300),
        kind: String((e && e.name) || "Error"),
        ms: now() - at,
      };
    } finally {
      // RELEASED WHATEVER HAPPENED. The `catch` above already answers every
      // failure as an entry, so nothing here rejects today and the release would
      // run without the `finally` — which is exactly why it is written as one: a
      // permit not released is every call past the bound waiting for one, and
      // that hang would arrive from a change one layer down with nothing here
      // touched. `design-graph.mjs` states the same reasoning about the same
      // pool.
      release();
    }
  }));
  // AFTER EVERY CALL HAS SETTLED, which is what makes it the wall time of the
  // fan-out rather than of the slowest call: a call that fails early and one
  // that answers late are both inside it.
  const waveMs = now() - fanAt;
  return out.map((e) => ({ ...e, waveMs }));
}

/** Did every call in a fan-out fail? The caller has nothing to assemble. */
export function allFailed(results) {
  const list = Array.isArray(results) ? results : [];
  return list.length > 0 && list.every((r) => r && r.state === "failed");
}

/** How many answered, out of how many were asked — for the log line. */
export function fanoutTally(results) {
  const list = Array.isArray(results) ? results : [];
  return { done: list.filter((r) => r && r.state === "done").length, of: list.length };
}

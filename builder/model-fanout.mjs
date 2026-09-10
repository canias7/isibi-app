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
 * Run every request at once; answer one outcome per request, in order.
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
 * passes it.
 */
export async function runFanout(reqs, callOne, now = () => Date.now()) {
  const list = Array.isArray(reqs) ? reqs : [];
  // ── WHAT THE FAN-OUT COST IN WALL TIME, STAMPED ON WHAT COMES BACK ─────────
  //
  // The question a split has to answer is "was running these together faster
  // than running them one after another", and it takes TWO numbers: the sum of
  // the per-call times (already on every entry as `ms` — what serial would have
  // cost) and the WALL time of the whole fan-out. The difference is the overlap,
  // and it can be read off ONE run with no baseline — which is the only way to
  // ask it at all, since build-to-build variance here is wider than any saving.
  //
  // MEASURED RATHER THAN DERIVED FROM `max(ms)`, AND TODAY THE TWO AGREE — said
  // plainly, because the first draft of this comment claimed they did not and
  // that was wrong. Every call's `at` is read in the same synchronous pass as
  // `fanAt`, so the starts are simultaneous and the wall time IS the slowest
  // call. The reason to measure anyway is that the agreement is a PROPERTY OF
  // THE STARTS, not of the arithmetic: the day anything staggers them — a
  // semaphore, a connection pool, a `callOne` that awaits before it dials —
  // `max(ms)` keeps reporting the slowest call while the fan-out really took
  // longer. That is wrong in the FLATTERING direction, which is the worst one
  // for a number somebody decides with: a serialised fan-out would read as a
  // fast one. One clock read buys immunity to that, and the guard pins it with a
  // fixture whose starts really do stagger.
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

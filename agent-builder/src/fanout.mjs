/**
 * RUN N THINGS AT ONCE, BOUNDED, AND LOSE NONE OF THEM.
 *
 * DEPENDENCY-FREE AND PURE apart from what is injected: `now` is a parameter, so
 * the timings below are drivable in a test rather than waited on.
 *
 * WHY THIS IS ITS OWN MODULE AND IS SHARED. `Promise.all` REJECTS ON THE FIRST
 * FAILURE, which here means throwing away every tool that answered because one
 * did not — and the model needs the answers that worked *and* the failure, or it
 * cannot recover. There is exactly one of these for that reason, and for a
 * second: EVERY ENTRY CARRIES ITS INDEX, which is the only thing tying an answer
 * back to what it was asked of once they finish out of order.
 *
 * A FAILED ITEM IS AN ANSWER, NEVER AN ABSENCE. `{ ok: false, error }` sits in
 * the output at its own index. Nothing is dropped, so the caller's list is
 * always the same length as its input and position still means what it meant.
 */

/**
 * `runFanout(items, worker, { limit, now })`
 *
 * Answers an array the same length as `items`, in INPUT ORDER, of
 * `{ index, ok, value | error, startedAt, ms }`.
 *
 * `limit` is how many may be in flight. A list that FITS inside the limit takes
 * no queueing at all — every worker starts before any finishes — and a longer
 * list queues: `limit` start, and the rest begin as permits free.
 *
 * **EACH ITEM'S CLOCK STARTS AFTER ITS PERMIT, NEVER BEFORE IT.** Time the wait
 * as well as the work and `ms` grows with the QUEUE rather than with the thing:
 * the overlap flatters itself and the slowest item cannot be identified.
 */
export async function runFanout(items, worker, opts = {}) {
  if (!Array.isArray(items)) throw new TypeError("runFanout: items must be an array");
  if (typeof worker !== "function") throw new TypeError("runFanout: worker must be a function");

  const list = items;
  const now = typeof opts.now === "function" ? opts.now : Date.now;

  // A limit we cannot read is no limit — run the whole list at once, which is
  // the behaviour with no limit asked for. NOTE `Math.max(1, NaN)` is NaN, so
  // NaN is refused explicitly rather than clamped: this is the "values that lie"
  // class, where the obvious guard silently produces the broken answer.
  let limit = opts.limit;
  if (typeof limit !== "number" || Number.isNaN(limit) || limit < 1) limit = list.length;
  if (limit === Infinity) limit = list.length;
  limit = Math.min(Math.floor(limit), Math.max(1, list.length));

  const out = new Array(list.length);
  let next = 0;

  // One lane per permit. A lane takes the next index and keeps going until the
  // list is done, so a fast item frees its permit for the queue immediately
  // rather than waiting for its whole batch — batching would make the wall the
  // slowest item of each group instead of the slowest item overall.
  async function lane() {
    for (;;) {
      const i = next++;
      if (i >= list.length) return;
      const startedAt = now();
      try {
        const value = await worker(list[i], i);
        out[i] = { index: i, ok: true, value, startedAt, ms: now() - startedAt };
      } catch (error) {
        // The lane NEVER rejects. That is the whole point: one thrown worker must
        // not take the others with it.
        out[i] = { index: i, ok: false, error, startedAt, ms: now() - startedAt };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => lane()));
  return out;
}

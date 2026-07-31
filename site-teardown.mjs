// Draining the Neon teardown queue.
//
// A Neon project is a capped, billed resource whose only record is a Supabase
// row. Those rows cascade from `auth.users`, so deleting an account used to
// destroy the record and leave the project running — invisible, and billing
// forever. `delete_account()` cannot help: it is a Postgres RPC and cannot call
// the Neon API.
//
// So a BEFORE DELETE trigger records the project into `neon_teardown` as its row
// disappears, and this drains that queue from the Worker, which is the only side
// holding NEON_API_KEY.
//
// Pure. The clock, the Neon call and the storage are all arguments, so the
// decisions that matter — what counts as done, what must never count as done,
// and how hard to keep trying — are driven directly in test/site-teardown.test.mjs.

/**
 * How long to wait before trying a failed teardown again.
 *
 * The cron fires every two minutes. Without a backoff, one project that cannot
 * be dropped is a Neon API call every two minutes forever, which is both rude
 * and a way to get rate-limited out of provisioning that actually matters.
 *
 * The last value repeats. There is deliberately no "give up": the row IS the
 * record, so deleting it to stop the noise would recreate the exact failure this
 * queue exists to fix — a billed project nothing knows about. A stuck row costs
 * one call a day and stays visible.
 */
export const BACKOFF_SEC = [120, 600, 3600, 21600, 86400];

export function backoffFor(attempts) {
  const n = Number(attempts);
  const i = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), BACKOFF_SEC.length) - 1 : 0;
  return BACKOFF_SEC[Math.max(0, i)];
}

/** How many to attempt per cron tick. */
export const BATCH = 5;

/**
 * What the Neon API's answer means.
 *
 * `done` deletes the queue row. Getting this wrong in either direction is
 * expensive: too eager and a live project's only record is thrown away; too shy
 * and the queue never empties.
 *
 *   404 → DONE. The project is gone, which is the entire goal. A teardown is
 *         idempotent by nature and the row must not outlive it — the site-delete
 *         route drops the project inline and the trigger queues it anyway, so
 *         "already gone" is the NORMAL case, not an error.
 *   401/403 → NEVER done. Our key is wrong or revoked. The project is almost
 *         certainly still there, and treating this as success would delete the
 *         only record of it at the exact moment we cannot see Neon at all. This
 *         is the one that would quietly empty the whole queue during a key
 *         rotation.
 *   429/5xx → retry. Neon's problem, not ours.
 */
export function verdictFor({ ok, status, error } = {}) {
  if (ok) return { done: true, reason: "dropped" };
  const s = Number(status);
  if (s === 404) return { done: true, reason: "already gone" };
  if (s === 401 || s === 403) return { done: false, reason: "not authorised — the key, not the project" };
  if (s === 429) return { done: false, reason: "rate limited" };
  if (Number.isFinite(s) && s >= 500) return { done: false, reason: "neon " + s };
  if (Number.isFinite(s)) return { done: false, reason: "neon " + s };
  return { done: false, reason: String((error && error.message) || error || "unknown").slice(0, 200) };
}

/**
 * Drain one tick.
 *
 * deps:
 *   due(limit)                  → [{id, project_id, attempts}]  rows whose next_try_at has passed
 *   drop(projectId)             → {ok, status} | throws
 *   forget(id)                  → void   delete the queue row (the teardown is done)
 *   defer(id, attempts, sec, e) → void   push next_try_at out and record why
 *
 * Returns a summary rather than logging it, so the caller can decide whether a
 * tick is worth a line in the log — the same reason publish-pages.mjs returns
 * `stage` instead of printing it.
 */
export async function drainTeardown(deps, { limit = BATCH, nowMs } = {}) {
  const out = { attempted: 0, dropped: 0, gone: 0, deferred: 0, errors: [] };
  let rows = [];
  try { rows = (await deps.due(limit)) || []; }
  catch (e) {
    // A queue we cannot read is not an empty queue. Reported, so a tick that did
    // nothing because Supabase was down is distinguishable from one with nothing
    // to do.
    out.errors.push("due: " + String((e && e.message) || e).slice(0, 200));
    return out;
  }

  for (const row of rows) {
    if (!row || !row.project_id) continue;
    out.attempted++;
    let verdict;
    try { verdict = verdictFor(await deps.drop(row.project_id)); }
    catch (e) { verdict = verdictFor({ ok: false, status: e && e.status, error: e }); }

    if (verdict.done) {
      // The row goes only after the project does. In the other order a failed
      // `forget` would leave a queue row for a project that no longer exists,
      // which is harmless — whereas forgetting first and then failing to drop
      // loses the project entirely.
      try {
        await deps.forget(row.id);
        if (verdict.reason === "already gone") out.gone++; else out.dropped++;
      } catch (e) { out.errors.push("forget " + row.project_id + ": " + String((e && e.message) || e).slice(0, 120)); }
      continue;
    }

    const attempts = Number(row.attempts || 0) + 1;
    try {
      await deps.defer(row.id, attempts, backoffFor(attempts), verdict.reason);
      out.deferred++;
    } catch (e) { out.errors.push("defer " + row.project_id + ": " + String((e && e.message) || e).slice(0, 120)); }
    out.errors.push(row.project_id + ": " + verdict.reason);
  }
  return out;
}

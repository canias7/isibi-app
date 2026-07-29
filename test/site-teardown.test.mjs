// Draining the Neon teardown queue.
//
// Almost every test here is about one of two mistakes, because they are the only
// two this code can make and they cost real money in opposite directions:
// deleting a queue row for a project that is still running (an invisible billed
// orphan, forever), or never deleting one (a queue that grows and a Neon API call
// every two minutes for eternity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { drainTeardown, verdictFor, backoffFor, BACKOFF_SEC, BATCH } from "../site-teardown.mjs";

const harness = (over = {}) => {
  const calls = { drop: [], forget: [], defer: [] };
  const deps = {
    due: async (limit) => (over.rows || [{ id: 1, project_id: "p1", attempts: 0 }]).slice(0, limit),
    drop: async (id) => { calls.drop.push(id); return over.drop ? over.drop(id) : { ok: true, status: 200 }; },
    forget: async (id) => { calls.forget.push(id); if (over.forgetThrows) throw new Error("supabase down"); },
    defer: async (id, attempts, sec, why) => { calls.defer.push({ id, attempts, sec, why }); },
    ...(over.deps || {}),
  };
  return { deps, calls };
};

// ------------------------------------------------------------- the verdict

test("a dropped project is done", () => {
  assert.deepEqual(verdictFor({ ok: true, status: 200 }), { done: true, reason: "dropped" });
});

test("404 is DONE, because already-gone is the normal case", () => {
  // The site-delete route drops the project inline and the trigger queues it
  // anyway, so most rows in this queue describe a project that is already gone.
  // Treating 404 as a failure would mean the queue never empties.
  assert.equal(verdictFor({ ok: false, status: 404 }).done, true);
});

test("401 and 403 are NEVER done — that is the key, not the project", () => {
  // The expensive mistake. During a key rotation every call answers 403, and a
  // sweeper that took that for success would delete the only record of every
  // project in the queue while unable to see Neon at all.
  for (const s of [401, 403]) {
    const v = verdictFor({ ok: false, status: s });
    assert.equal(v.done, false, "status " + s);
    assert.match(v.reason, /key, not the project/);
  }
});

test("rate limits, server errors and thrown errors all retry", () => {
  for (const s of [429, 500, 502, 503]) assert.equal(verdictFor({ ok: false, status: s }).done, false, "status " + s);
  assert.equal(verdictFor({ ok: false, error: new Error("socket hang up") }).done, false);
  assert.equal(verdictFor({}).done, false, "an answer with no shape at all must not read as success");
  assert.equal(verdictFor().done, false);
});

// ------------------------------------------------------------- the backoff

test("the backoff escalates and then holds, and never gives up", () => {
  assert.equal(backoffFor(1), BACKOFF_SEC[0]);
  assert.equal(backoffFor(2), BACKOFF_SEC[1]);
  assert.equal(backoffFor(BACKOFF_SEC.length), BACKOFF_SEC[BACKOFF_SEC.length - 1]);
  // Past the end it REPEATS rather than returning something falsy. There is no
  // "give up": the row is the only record of the project, so dropping it to stop
  // the noise recreates the exact failure this queue exists to fix.
  assert.equal(backoffFor(99), BACKOFF_SEC[BACKOFF_SEC.length - 1]);
  assert.ok(BACKOFF_SEC.every((s) => s > 0), "a zero would be a call every tick forever");
  // Monotonic, or a later attempt would retry sooner than an earlier one.
  for (let i = 1; i < BACKOFF_SEC.length; i++) assert.ok(BACKOFF_SEC[i] > BACKOFF_SEC[i - 1], "not monotonic at " + i);
  // And a nonsense attempt count still yields a real delay.
  for (const bad of [0, -3, NaN, undefined, null, "soon"]) assert.ok(backoffFor(bad) > 0, String(bad));
});

// ------------------------------------------------------------- the drain

test("a successful drop forgets the row", async () => {
  const { deps, calls } = harness();
  const out = await drainTeardown(deps);
  assert.deepEqual(calls.drop, ["p1"]);
  assert.deepEqual(calls.forget, [1]);
  assert.deepEqual(calls.defer, []);
  assert.equal(out.dropped, 1);
});

test("an already-gone project is forgotten too, and counted apart", async () => {
  const { deps, calls } = harness({ drop: () => ({ ok: false, status: 404 }) });
  const out = await drainTeardown(deps);
  assert.deepEqual(calls.forget, [1]);
  assert.equal(out.gone, 1);
  assert.equal(out.dropped, 0, "already-gone is not the same event as we-dropped-it");
});

test("an unauthorised drop KEEPS the row and defers it", async () => {
  const { deps, calls } = harness({ drop: () => ({ ok: false, status: 403 }) });
  const out = await drainTeardown(deps);
  assert.deepEqual(calls.forget, [], "the record must survive — it is the only one");
  assert.equal(calls.defer.length, 1);
  assert.equal(calls.defer[0].attempts, 1);
  assert.equal(calls.defer[0].sec, BACKOFF_SEC[0]);
  assert.equal(out.deferred, 1);
  assert.ok(out.errors.some((e) => /p1/.test(e)), JSON.stringify(out.errors));
});

test("a thrown drop is a deferral, not a lost project", async () => {
  const { deps, calls } = harness({ drop: () => { throw new Error("network"); } });
  await drainTeardown(deps);
  assert.deepEqual(calls.forget, []);
  assert.equal(calls.defer.length, 1);
});

test("the attempt count carries the backoff forward", async () => {
  const { deps, calls } = harness({ rows: [{ id: 7, project_id: "p7", attempts: 3 }], drop: () => ({ ok: false, status: 500 }) });
  await drainTeardown(deps);
  assert.equal(calls.defer[0].attempts, 4);
  assert.equal(calls.defer[0].sec, BACKOFF_SEC[3]);
});

test("one bad row does not stop the rest of the batch", async () => {
  // The reason this loops instead of Promise.all-ing: a queue is drained to
  // empty over many ticks, and a single project that can never be dropped must
  // not starve every other one behind it.
  const { deps, calls } = harness({
    rows: [{ id: 1, project_id: "bad", attempts: 0 }, { id: 2, project_id: "good", attempts: 0 }],
    drop: (id) => (id === "bad" ? { ok: false, status: 500 } : { ok: true, status: 200 }),
  });
  const out = await drainTeardown(deps);
  assert.deepEqual(calls.drop, ["bad", "good"]);
  assert.deepEqual(calls.forget, [2]);
  assert.equal(out.dropped, 1);
  assert.equal(out.deferred, 1);
});

test("a failed forget is reported, and never loses the project", async () => {
  // Forgetting after dropping is the deliberate order. A queue row for a project
  // that is already gone is harmless — the next tick 404s and clears it. The
  // other order loses the project.
  const { deps, calls } = harness({ forgetThrows: true });
  const out = await drainTeardown(deps);
  assert.deepEqual(calls.drop, ["p1"]);
  assert.equal(out.dropped, 0);
  assert.ok(out.errors.some((e) => /forget p1/.test(e)), JSON.stringify(out.errors));
});

test("an unreadable queue is not an empty queue", async () => {
  // A tick that did nothing because Supabase was down has to be tellable apart
  // from one with nothing to do, or a broken sweeper looks exactly like a drained
  // one.
  const { deps, calls } = harness({ deps: { due: async () => { throw new Error("supabase down"); } } });
  const out = await drainTeardown(deps);
  assert.deepEqual(calls.drop, []);
  assert.equal(out.attempted, 0);
  assert.ok(out.errors.some((e) => /^due: /.test(e)), JSON.stringify(out.errors));
});

test("the batch is bounded, so one tick cannot run away", async () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ id: i, project_id: "p" + i, attempts: 0 }));
  const { deps, calls } = harness({ rows: many });
  await drainTeardown(deps);
  assert.equal(calls.drop.length, BATCH);
  assert.ok(BATCH > 0 && BATCH <= 20, "BATCH must be a real, small number: " + BATCH);
});

test("a row with no project id is skipped rather than dropped as undefined", async () => {
  const { deps, calls } = harness({ rows: [{ id: 1, project_id: null }, { id: 2, project_id: "p2" }] });
  const out = await drainTeardown(deps);
  assert.deepEqual(calls.drop, ["p2"], "a null project id must never reach the Neon API as a path segment");
  assert.equal(out.attempted, 1);
});

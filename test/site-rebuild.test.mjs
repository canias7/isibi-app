// Draining the site rebuild queue.
//
// The two mistakes this code can make, and they are not symmetric:
//
//   PARK A HEALTHY SITE — read one of OUR failures (a drained container, an
//   unreadable store) as the site's own broken source, and a perfectly good site
//   sits at the 24-hour rung un-upgraded, on the one operation whose whole point
//   is that no site is left behind.
//
//   SPIN FOREVER ON A BROKEN ONE — read a deterministic compile failure as
//   transient, and one site burns a container run every two minutes forever
//   while real customer edits queue behind it.
//
// Almost every test below is about one of those two, or about the third thing
// that matters: a failed rebuild must leave the live site exactly as it was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { drainRebuild, verdictFor, backoffFor, BACKOFF_SEC, BATCH } from "../site-rebuild.mjs";

const harness = (over = {}) => {
  const calls = { exists: [], rebuild: [], forget: [], defer: [] };
  const deps = {
    due: async (limit) => {
      if (over.dueThrows) throw new Error("supabase down");
      return (over.rows || [{ slug: "cafe", attempts: 0 }]).slice(0, limit);
    },
    exists: async (slug) => {
      calls.exists.push(slug);
      if (over.existsThrows) throw new Error("supabase down");
      return over.exists === undefined ? true : over.exists;
    },
    rebuild: async (slug) => {
      calls.rebuild.push(slug);
      if (over.rebuildThrows) throw new Error("boom");
      return over.result === undefined ? { ok: true } : over.result;
    },
    forget: async (slug) => { calls.forget.push(slug); if (over.forgetThrows) throw new Error("supabase down"); },
    defer: async (slug, attempts, sec, why) => {
      calls.defer.push({ slug, attempts, sec, why });
      if (over.deferThrows) throw new Error("supabase down");
    },
    ...(over.deps || {}),
  };
  return { deps, calls };
};

// ------------------------------------------------------------- the verdict

test("a republished site is done", () => {
  assert.deepEqual(verdictFor({ ok: true }), { state: "done", reason: "republished" });
});

test("OURS is always a retry, whatever the stage", () => {
  // The expensive mistake in one direction. `recompileAndPublish` sets `ours`
  // for a drained container and an unreadable store — both heal on their own,
  // and both would otherwise look exactly like a site whose pages are broken.
  assert.equal(verdictFor({ ok: false, error: "compile", ours: true, detail: "killed by SIGTERM" }).state, "retry");
  assert.equal(verdictFor({ ok: false, error: "read", ours: true }).state, "retry");
});

test("a compile failure that is NOT ours parks the site rather than retrying", () => {
  // The expensive mistake in the other direction. A framework bump breaks some
  // sites at `tsc`, and that source will not compile in ten minutes either — so
  // retrying it every two minutes burns a container run each time while real
  // customer edits wait behind it.
  const v = verdictFor({ ok: false, error: "compile", ours: false, detail: "TS2305" });
  assert.equal(v.state, "stuck");
  assert.match(v.reason, /TS2305/);
});

test("a stuck site is still IN the queue — parked is not deleted", async () => {
  // The whole reason `stuck` is not just `forget`. Dropping the row loses the
  // one record that this site did not get the upgrade, silently, which is the
  // state this queue exists to end.
  const { deps, calls } = harness({ result: { ok: false, error: "compile", ours: false, detail: "TS2305" } });
  const out = await drainRebuild(deps);
  assert.equal(calls.forget.length, 0, "a stuck site must not be forgotten");
  assert.equal(calls.defer.length, 1);
  assert.equal(out.parked, 1);
});

test("a stuck site jumps to the LAST rung rather than climbing to it", async () => {
  // Climbing spends four more container runs proving the same thing.
  const { deps, calls } = harness({ result: { ok: false, error: "compile", ours: false, detail: "TS2305" } });
  await drainRebuild(deps);
  assert.equal(calls.defer[0].sec, BACKOFF_SEC[BACKOFF_SEC.length - 1]);
  assert.notEqual(calls.defer[0].sec, backoffFor(1), "it must not take the first rung");
});

test("an unrecognisable answer retries rather than parking", () => {
  // Being wrong this way costs a retry. Being wrong the other way parks a site
  // whose pages may be perfectly good.
  for (const bad of [null, undefined, "nope", 42, []]) {
    assert.equal(verdictFor(bad).state, "retry", JSON.stringify(bad));
  }
});

test("an unclassified failure retries", () => {
  assert.equal(verdictFor({ ok: false, error: "publish" }).state, "retry");
});

test("a gone site is done, not retried", () => {
  assert.equal(verdictFor({ gone: true }).state, "gone");
});

// ------------------------------------------------------------- existence

test("a deleted site is forgotten WITHOUT spending a container run", async () => {
  const { deps, calls } = harness({ exists: false });
  const out = await drainRebuild(deps);
  assert.deepEqual(calls.rebuild, [], "a deleted site must not reach the container");
  assert.deepEqual(calls.forget, ["cafe"]);
  assert.equal(out.gone, 1);
  assert.equal(out.attempted, 0);
});

test("an unanswerable lookup defers and spends NOTHING", async () => {
  // "We could not look" is not "it is deleted". Being wrong that way would
  // forget a live site from the queue and it would never be rebuilt.
  const { deps, calls } = harness({ existsThrows: true });
  const out = await drainRebuild(deps);
  assert.deepEqual(calls.rebuild, [], "a container run must not be spent on a site we cannot resolve");
  assert.deepEqual(calls.forget, [], "an unanswerable lookup must NEVER forget the row");
  assert.equal(out.deferred, 1);
  assert.match(calls.defer[0].why, /could not check/i);
});

test("the answer is ASKED, never read out of an error message", async () => {
  // `recompileAndPublish` answers a deleted site with a sentence about no
  // backend being recorded. Matching on that sentence is the class of check this
  // repo keeps getting burned by — and it cannot separate "deleted" from
  // "Supabase is down", which need opposite responses.
  const { deps, calls } = harness({
    exists: true,
    result: { ok: false, error: "read", ours: true, detail: "no backend recorded for cafe — the stored look could not be read" },
  });
  const out = await drainRebuild(deps);
  assert.deepEqual(calls.forget, [], "a message mentioning a missing backend must not be read as deletion");
  assert.equal(out.deferred, 1);
  assert.equal(calls.exists.length, 1);
});

// ------------------------------------------------------------- the drain

test("a rebuilt site is forgotten, and only after the rebuild", async () => {
  const order = [];
  const { deps } = harness({
    deps: {
      rebuild: async () => { order.push("rebuild"); return { ok: true }; },
      forget: async () => { order.push("forget"); },
    },
  });
  const out = await drainRebuild(deps);
  assert.deepEqual(order, ["rebuild", "forget"], "forgetting first loses the site if the rebuild then fails");
  assert.equal(out.rebuilt, 1);
});

test("a throw out of the rebuild is OURS — retry, never park", async () => {
  const { deps, calls } = harness({ rebuildThrows: true });
  const out = await drainRebuild(deps);
  assert.equal(out.deferred, 1);
  assert.equal(out.parked, 0, "an escaped throw is a platform fault, not the site's source");
  assert.equal(calls.defer[0].sec, backoffFor(1));
});

test("attempts climb, and the backoff climbs with them", async () => {
  const { deps, calls } = harness({
    rows: [{ slug: "cafe", attempts: 2 }],
    result: { ok: false, error: "read", ours: true },
  });
  await drainRebuild(deps);
  assert.equal(calls.defer[0].attempts, 3);
  assert.equal(calls.defer[0].sec, BACKOFF_SEC[2]);
});

test("the last rung repeats — there is no give-up", () => {
  assert.equal(backoffFor(99), BACKOFF_SEC[BACKOFF_SEC.length - 1]);
  assert.equal(backoffFor(0), BACKOFF_SEC[0]);
  assert.equal(backoffFor(-1), BACKOFF_SEC[0]);
  assert.equal(backoffFor("x"), BACKOFF_SEC[0]);
});

test("an unreadable queue is reported, not read as empty", async () => {
  // A tick that did nothing because Supabase was down must be distinguishable
  // from one with nothing to do.
  const { deps, calls } = harness({ dueThrows: true });
  const out = await drainRebuild(deps);
  assert.equal(out.attempted, 0);
  assert.equal(out.errors.length, 1);
  assert.match(out.errors[0], /^due:/);
  assert.deepEqual(calls.rebuild, []);
});

test("a row with no slug is skipped rather than crashing the tick", async () => {
  const { deps, calls } = harness({ rows: [{ attempts: 0 }, { slug: "cafe", attempts: 0 }] });
  const out = await drainRebuild(deps, { limit: 2 });
  assert.deepEqual(calls.rebuild, ["cafe"]);
  assert.equal(out.rebuilt, 1);
});

test("a failing forget is reported and does not stop the tick", async () => {
  const { deps } = harness({ rows: [{ slug: "a", attempts: 0 }, { slug: "b", attempts: 0 }], forgetThrows: true });
  const out = await drainRebuild(deps, { limit: 2 });
  assert.equal(out.errors.length, 2);
  assert.equal(out.rebuilt, 0, "a row that could not be forgotten is not counted as done");
});

test("a failing defer is reported and does not stop the tick", async () => {
  const { deps } = harness({ result: { ok: false, ours: true }, deferThrows: true });
  const out = await drainRebuild(deps);
  assert.equal(out.deferred, 0);
  assert.ok(out.errors.some((e) => /^defer /.test(e)));
});

test("the drain never throws, whatever the deps do", async () => {
  const { deps } = harness({ existsThrows: true, deferThrows: true, forgetThrows: true });
  // A drain that throws takes the nightly backups, the teardown queue, the
  // domain watch and the webhook queue down with it — they share one tick.
  await assert.doesNotReject(() => drainRebuild(deps));
});

// ------------------------------------------------------------- the batch

test("ONE per tick, because the build service is one-at-a-time", () => {
  // The number that must not be copied from the teardown queue's 5. A recompile
  // is ~65s of container against a 120s tick, and the container serves the whole
  // platform — so a batch of 2 puts a real customer edit behind two bulk
  // rebuilds. A bulk operation must never starve the interactive path.
  assert.equal(BATCH, 1);
});

test("the batch is passed to the query rather than sliced after it", async () => {
  // Reading 200 rows and using one is 200 rows of Supabase read every two
  // minutes for as long as the queue is non-empty.
  let asked = null;
  const { deps } = harness({ deps: { due: async (limit) => { asked = limit; return []; } } });
  await drainRebuild(deps);
  assert.equal(asked, BATCH);
});

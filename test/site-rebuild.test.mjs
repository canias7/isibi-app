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
import { drainRebuild, verdictFor, backoffFor, BACKOFF_SEC, BATCH, CLAIM_SEC, BUSY_DEFER_SEC } from "../site-rebuild.mjs";

const harness = (over = {}) => {
  const calls = { exists: [], claim: [], rebuild: [], forget: [], defer: [] };
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
    claim: async (slug, sec) => {
      calls.claim.push({ slug, sec });
      if (over.claimThrows) throw new Error("supabase down");
      return over.claim === undefined ? true : over.claim;
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

// ------------------------------------------------------------- the claim

test("the row is CLAIMED before a container run is spent", async () => {
  // Without this an overlapping tick reads the same row as due and starts a
  // second run for the same site — and the build service is one-at-a-time for
  // the whole platform, so a real customer edit waits behind both.
  const order = [];
  const { deps } = harness({
    deps: {
      claim: async () => { order.push("claim"); return true; },
      rebuild: async () => { order.push("rebuild"); return { ok: true }; },
    },
  });
  await drainRebuild(deps);
  assert.deepEqual(order, ["claim", "rebuild"], "the claim must come first or it protects nothing");
});

test("losing the claim spends NOTHING and is not a failure", async () => {
  // The tick that won is doing the work. Counting this as a failure would climb
  // the backoff and park a healthy site after five ticks of ordinary contention.
  const { deps, calls } = harness({ claim: false });
  const out = await drainRebuild(deps);
  assert.deepEqual(calls.rebuild, [], "a lost claim must not reach the container");
  assert.deepEqual(calls.defer, [], "a lost race must not climb the backoff");
  assert.deepEqual(calls.forget, []);
  assert.equal(out.lost, 1);
  assert.equal(out.attempted, 0);
  assert.equal(out.errors.length, 0, "losing a race is not an error worth logging");
});

test("a claim that cannot be RECORDED is a claim lost", async () => {
  // `runScheduledSiteJobs`'s own rule. Being wrong this way skips one site for
  // ten minutes; being wrong the other way is the duplicate run.
  const { deps, calls } = harness({ claimThrows: true });
  const out = await drainRebuild(deps);
  assert.deepEqual(calls.rebuild, []);
  assert.equal(out.lost, 1);
});

test("a site a job holds is DEFERRED, not rebuilt and not failed: no attempt, no rung, the mark's own delay (stage 6)", async () => {
  // The claim answers "busy" when an edit, an addon or a build holds the
  // site's lease (rebuild_claim asks under the site's own lock). A rebuild
  // published under it would carry their pages back to before their change,
  // so the row is pushed out by BUSY_DEFER_SEC and asked again — attempts
  // untouched, because a busy site is not a failing one, and the reason on
  // the row for anyone reading it.
  const { deps, calls } = harness({ claim: "busy", rows: [{ slug: "cafe", attempts: 3 }] });
  const out = await drainRebuild(deps);
  assert.deepEqual(calls.rebuild, [], "a busy site reached the container");
  assert.deepEqual(calls.forget, []);
  assert.equal(calls.defer.length, 1);
  assert.equal(calls.defer[0].slug, "cafe");
  assert.equal(calls.defer[0].attempts, 3, "a busy site was counted as an attempt");
  assert.equal(calls.defer[0].sec, BUSY_DEFER_SEC);
  assert.match(calls.defer[0].why, /site busy/);
  assert.equal(out.busy, 1);
  assert.equal(out.lost, 0, "a busy site was counted as a lost claim");
  assert.equal(out.attempted, 0);
  assert.deepEqual(out.errors, [], "a busy site was reported as an error");
  // THE DELAY IS THE MODULE'S OWN AND A REAL WAIT: past most edits, never
  // longer than the first backoff rung would make a failure wait ten times.
  assert.ok(BUSY_DEFER_SEC >= 120 && BUSY_DEFER_SEC <= 1200, "the busy delay is not a few minutes: " + BUSY_DEFER_SEC);
  // A DEFER THAT FAILS IS REPORTED, and still spends nothing.
  const bad = harness({ claim: "busy", deferThrows: true });
  const o2 = await drainRebuild(bad.deps);
  assert.deepEqual(bad.calls.rebuild, []);
  assert.equal(o2.busy, 0);
  assert.ok(o2.errors.some((e) => /^defer cafe/.test(e)));
});

test("only a literal true wins the claim", async () => {
  // A dep answering `{}` or a row count would otherwise read as a win, and
  // everything truthy wins is how this silently stops protecting anything.
  for (const answer of [1, "yes", {}, [], "true"]) {
    const { deps, calls } = harness({ claim: answer });
    await drainRebuild(deps);
    assert.deepEqual(calls.rebuild, [], "claim answered " + JSON.stringify(answer) + " must not win");
  }
});

test("the claim window is the module's own, and long enough to cover a run", async () => {
  const { deps, calls } = harness();
  await drainRebuild(deps);
  assert.equal(calls.claim[0].sec, CLAIM_SEC);
  // ~65s is the measured recompile. A window at or under that lets the overlap
  // straight back through, which is the whole bug.
  assert.ok(CLAIM_SEC >= 300, "a claim shorter than five minutes does not cover a slow rebuild");
  assert.ok(CLAIM_SEC <= 3600, "and a dead isolate must not hold the row for an hour");
});

test("the claim comes AFTER the existence check", async () => {
  // A deleted site must cost neither a container run nor a write. Claiming
  // first would PATCH a row we are about to delete.
  const order = [];
  const { deps } = harness({
    deps: {
      exists: async () => { order.push("exists"); return false; },
      claim: async () => { order.push("claim"); return true; },
    },
  });
  await drainRebuild(deps);
  assert.deepEqual(order, ["exists"], "a deleted site must not be claimed");
});

// ------------------------------------------------------------- the batch

test("A FEW per tick, side by side — every site has its own container lane", () => {
  // RE-ANCHORED 2026-09-04: this pinned 1, "because the build service is
  // one-at-a-time" — true until 2026-08-25, when every site got its own
  // container lane, after which one-at-a-time serialises only two builds of
  // ONE site and a rebuild of somebody else's site waits behind nothing. The
  // batch is a small number now, bounded by the cron invocation's fifteen
  // minutes (the rows run concurrently, below), not by the container.
  assert.ok(Number.isInteger(BATCH) && BATCH >= 4 && BATCH <= 20, "BATCH must be a real, small number: " + BATCH);
});

test("the rows of one tick are rebuilt CONCURRENTLY, not one after another", async () => {
  // Eight in series is sixteen minutes, and a cron invocation is dead at
  // fifteen. Driven, not read: every rebuild of the tick must have STARTED
  // before any of them is allowed to RETURN.
  const started = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const { deps, calls } = harness({
    rows: [{ slug: "a", attempts: 0 }, { slug: "b", attempts: 0 }, { slug: "c", attempts: 0 }],
    deps: { rebuild: async (slug) => { started.push(slug); await gate; return { ok: true }; } },
  });
  const done = drainRebuild(deps);
  for (let i = 0; i < 20 && started.length < 3; i++) await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual([...started].sort(), ["a", "b", "c"], "a later site waited for an earlier one to finish");
  release();
  const out = await done;
  assert.equal(out.attempted, 3);
  assert.equal(out.rebuilt, 3);
  assert.deepEqual([...calls.forget].sort(), ["a", "b", "c"]);
  // And a failure in one chain reaches the summary without touching the others.
  const { deps: d2, calls: c2 } = harness({
    rows: [{ slug: "a", attempts: 0 }, { slug: "b", attempts: 2 }],
    deps: { rebuild: async (slug) => (slug === "b" ? { ok: false, error: "compile", ours: true, detail: "drained" } : { ok: true }) },
  });
  const o2 = await drainRebuild(d2);
  assert.equal(o2.rebuilt, 1);
  assert.equal(o2.deferred, 1);
  assert.deepEqual(c2.forget, ["a"]);
  assert.equal(c2.defer.length, 1);
  assert.equal(c2.defer[0].slug, "b");
  assert.deepEqual(o2.errors, ["b: drained"]);
});

test("the batch is passed to the query rather than sliced after it", async () => {
  // Reading 200 rows and using one is 200 rows of Supabase read every two
  // minutes for as long as the queue is non-empty.
  let asked = null;
  const { deps } = harness({ deps: { due: async (limit) => { asked = limit; return []; } } });
  await drainRebuild(deps);
  assert.equal(asked, BATCH);
});

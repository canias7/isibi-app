import test from "node:test";
import assert from "node:assert/strict";
import { runFanout } from "../src/fanout.mjs";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("every item answers, in input order, carrying its index", async () => {
  const out = await runFanout([10, 20, 30], async (n, i) => n * 2 + i);
  assert.deepEqual(out.map((r) => r.value), [20, 41, 62]);
  assert.deepEqual(out.map((r) => r.index), [0, 1, 2]);
  assert.ok(out.every((r) => r.ok));
});

test("ORDER IS INPUT ORDER even when they finish backwards", async () => {
  // The index is the only thing tying an answer back to what it was asked of.
  const out = await runFanout([3, 2, 1], async (n) => {
    await new Promise((r) => setTimeout(r, n * 10));
    return n;
  });
  assert.deepEqual(out.map((r) => r.value), [3, 2, 1], "answers came back in completion order");
  assert.deepEqual(out.map((r) => r.index), [0, 1, 2]);
});

test("ONE FAILURE DOES NOT TAKE THE OTHERS — the reason this module exists", async () => {
  const boom = new Error("tool exploded");
  const out = await runFanout([1, 2, 3], async (n) => {
    if (n === 2) throw boom;
    return n;
  });
  assert.equal(out.length, 3, "the failed item was DROPPED, so position stopped meaning anything");
  assert.deepEqual(out.map((r) => r.ok), [true, false, true]);
  assert.equal(out[1].error, boom, "the error itself was not carried back");
  assert.equal(out[1].value, undefined);
  // Proof that the naive implementation is what is being avoided: Promise.all
  // over the same work rejects and yields nothing at all.
  await assert.rejects(Promise.all([1, 2, 3].map(async (n) => { if (n === 2) throw boom; return n; })));
});

test("EVERY item can fail without the call itself rejecting", async () => {
  const out = await runFanout([1, 2], async () => { throw new Error("all of them"); });
  assert.deepEqual(out.map((r) => r.ok), [false, false]);
});

test("a list that FITS the limit takes no queueing — all start before any finishes", async () => {
  let inFlight = 0, peak = 0;
  await runFanout([1, 2, 3, 4], async () => {
    inFlight++; peak = Math.max(peak, inFlight);
    await tick();
    inFlight--;
  }, { limit: 8 });
  assert.equal(peak, 4, `only ${peak} of 4 ran at once, so a fitting list was queued`);
});

test("a longer list QUEUES at the limit, and never exceeds it", async () => {
  let inFlight = 0, peak = 0, done = 0;
  const out = await runFanout([...Array(9).keys()], async () => {
    inFlight++; peak = Math.max(peak, inFlight);
    await tick(); await tick();
    inFlight--; done++;
  }, { limit: 4 });
  assert.equal(peak, 4, `the limit was exceeded: ${peak} in flight against a limit of 4`);
  assert.equal(done, 9, "the queue lost an item");
  assert.equal(out.length, 9);
});

test("EACH ITEM'S CLOCK STARTS AFTER ITS PERMIT, never before", async () => {
  // A fake clock, so this measures the property rather than the machine. One
  // slow item and a limit of 1: the second item's `ms` must be ITS OWN work, not
  // its work plus the wait for the permit.
  let t = 0;
  const now = () => t;
  const out = await runFanout([100, 5], async (cost) => { t += cost; return cost; },
    { limit: 1, now });
  assert.equal(out[0].ms, 100);
  assert.equal(out[1].ms, 5,
    `the queued item reported ${out[1].ms}ms — its wait was timed as work, so ms grows with the QUEUE`);
  assert.equal(out[1].startedAt, 100, "the second item's clock started before its permit");
});

test("a limit that cannot be read is no limit, and NaN does not slip through", async () => {
  // `Math.max(1, NaN)` is NaN — the obvious clamp silently produces the broken
  // answer, which is why NaN is refused by name.
  for (const limit of [undefined, null, NaN, 0, -1, "4", {}, Infinity]) {
    let peak = 0, inFlight = 0;
    await runFanout([1, 2, 3], async () => {
      inFlight++; peak = Math.max(peak, inFlight); await tick(); inFlight--;
    }, { limit });
    assert.equal(peak, 3, `limit ${String(limit)} produced ${peak} in flight instead of the whole list`);
  }
  assert.ok(Number.isNaN(Math.max(1, NaN)), "the fact the guard rests on");
});

test("an empty list is an empty answer, not a hang", async () => {
  const out = await runFanout([], async () => { throw new Error("never"); });
  assert.deepEqual(out, []);
});

test("runFanout refuses arguments it cannot use", async () => {
  await assert.rejects(() => runFanout("ab", async () => 1), { name: "TypeError" });
  await assert.rejects(() => runFanout([1], "worker"), { name: "TypeError" });
});

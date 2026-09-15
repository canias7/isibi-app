import test from "node:test";
import assert from "node:assert/strict";
import { addMeter, usageTokens, USAGE_KEYS } from "../src/meters.mjs";

// Lifted out of run.test.mjs with the module itself, when the journal's replay
// needed the same arithmetic. Two copies of these would drift in the direction
// where a RESUMED run believes it has spent less than it has.

test("addMeter: unmeasured is sticky, and rubbish is unmeasured rather than ignored", () => {
  assert.equal(addMeter(0, 5), 5);
  assert.equal(addMeter(5, 5), 10);
  assert.equal(addMeter(null, 5), null, "a broken meter repaired itself and started lying");
  for (const bad of [null, undefined, NaN, -1, "5", ["5"], {}]) {
    assert.equal(addMeter(10, bad), null, `${String(bad)} was counted as a spend`);
  }
});

test("usageTokens: every kind counts, and nothing reported is null rather than 0", () => {
  assert.equal(usageTokens({ inputTokens: 10, outputTokens: 5 }), 15);
  // A cached read is priced at a tenth and counts in FULL here: a budget is not
  // a bill.
  assert.equal(usageTokens({ inputTokens: 1, outputTokens: 1, cacheReadTokens: 100, cacheWriteTokens: 8 }), 110);
  assert.equal(usageTokens({}), null, "a provider that said nothing was read as having spent nothing");
  for (const bad of [null, undefined, "10", [1], { inputTokens: "10" }, { inputTokens: NaN }, { inputTokens: -1 }]) {
    assert.equal(usageTokens(bad), null, `${JSON.stringify(bad) ?? String(bad)} produced a number`);
  }
  assert.ok(USAGE_KEYS.length >= 4, "the kinds list shrank — the observer is dead");
});


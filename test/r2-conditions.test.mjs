// THE FIXTURE'S R2 CONDITIONS, PINNED TO MINIFLARE'S (2026-10-15, after
// Codex's review). `_testR2Conditional` in workers-sdk's
// miniflare/src/workers/r2/validator.worker.ts: a matching etagMatches
// overrides uploadedBefore; a non-matching etagDoesNotMatch overrides
// uploadedAfter; a missing object passes only with neither etagMatches nor
// uploadedAfter; a wildcard matches any object. A fixture stricter than R2
// once hid a race (a stale writer conditional on etag + upload time over a
// rewrite of the same bytes): these cases keep it from drifting again.
import test from "node:test";
import assert from "node:assert/strict";
import { r2Conditional as ok } from "./fixtures/request-flow.mjs";

const obj = { etag: "abc", at: 1_000_000 };
const before = (ms) => new Date(ms);

test("a matching etagMatches overrides uploadedBefore — the same bytes rewritten later still pass", () => {
  assert.equal(ok({ etagMatches: "abc", uploadedBefore: before(obj.at - 400) }, obj), true, "R2 lets a matching etag through whatever the upload time");
  assert.equal(ok({ etagMatches: "zzz", uploadedBefore: before(obj.at + 400) }, obj), false);
  assert.equal(ok({ uploadedBefore: before(obj.at - 400) }, obj), false, "alone, uploadedBefore refuses a later upload");
  assert.equal(ok({ uploadedBefore: before(obj.at + 1) }, obj), true);
});

test("a non-matching etagDoesNotMatch overrides uploadedAfter; the wildcard; a missing object", () => {
  assert.equal(ok({ etagDoesNotMatch: "zzz", uploadedAfter: before(obj.at + 400) }, obj), true);
  assert.equal(ok({ etagDoesNotMatch: "abc" }, obj), false);
  assert.equal(ok({ etagDoesNotMatch: "*" }, obj), false);
  assert.equal(ok({ etagMatches: "*" }, obj), true);
  assert.equal(ok({ etagDoesNotMatch: "*" }, null), true, "create-if-absent");
  assert.equal(ok({ etagMatches: "abc" }, null), false);
  assert.equal(ok({ uploadedAfter: before(1) }, null), false);
  assert.equal(ok({ uploadedBefore: before(1) }, null), true);
  assert.equal(ok({}, obj), true);
});

test("secondsGranularity truncates both times", () => {
  assert.equal(ok({ uploadedBefore: before(obj.at + 1), secondsGranularity: true }, { etag: "x", at: 1_000_500 }), false);
  assert.equal(ok({ uploadedBefore: before(1_001_000), secondsGranularity: true }, { etag: "x", at: 1_000_500 }), true);
});

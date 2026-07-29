// Slowing down a password guesser.
//
// Two failure modes pull in opposite directions and both are tested here: a
// delay so weak that an attacker gets unlimited guesses, and a lock so strong
// that anybody who knows a customer's address can shut them out of their own
// account. The design is an escalating, self-healing delay because that is the
// only shape where neither one happens.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  delayFor, lockState, afterFailure, afterSuccess,
  LOCKOUT_THRESHOLD, LOCKOUT_STEPS_SEC, LOCKOUT_MAX_SEC, LOCKOUT_DECAY_SEC,
} from "../site-lockout.mjs";

const NOW = 1_780_000_000_000;
const secs = (ms) => Math.floor(ms / 1000);

test("a few fumbles cost nothing", () => {
  // Typing a password wrong three times is a Tuesday, not an attack.
  for (let n = 0; n <= LOCKOUT_THRESHOLD; n++) assert.equal(delayFor(n), 0, "failure " + n);
  assert.ok(delayFor(LOCKOUT_THRESHOLD + 1) > 0);
});

test("the delay escalates and then stops escalating", () => {
  let prev = 0;
  for (let n = LOCKOUT_THRESHOLD + 1; n <= LOCKOUT_THRESHOLD + LOCKOUT_STEPS_SEC.length; n++) {
    const d = delayFor(n);
    assert.ok(d >= prev, "must not go backwards at " + n);
    prev = d;
  }
  // Capped: a mistyped password can never cost somebody a day.
  assert.equal(delayFor(50), LOCKOUT_MAX_SEC);
  assert.equal(delayFor(5000), LOCKOUT_MAX_SEC);
  assert.ok(LOCKOUT_MAX_SEC <= 3600, "an unbounded lock is a denial of service");
});

test("the guess rate collapses — that is the whole point", () => {
  // Twenty failures cost hours, not twenty round trips.
  let total = 0;
  for (let n = 1; n <= 20; n++) total += delayFor(n);
  assert.ok(total > 3 * 3600, "twenty guesses must cost hours, got " + total + "s");
});

test("junk counts do not produce a delay", () => {
  for (const v of [null, undefined, NaN, "abc", -3, {}]) assert.equal(delayFor(v), 0, JSON.stringify(v));
});

// ------------------------------------------------------------- state

test("an account with nothing recorded is not locked", () => {
  assert.equal(lockState({}, NOW).locked, false);
  assert.equal(lockState(null, NOW).locked, false);
  assert.equal(lockState({ locked_until: 0 }, NOW).locked, false);
});

test("a lock in the future locks, one in the past does not", () => {
  assert.equal(lockState({ locked_until: secs(NOW) + 60 }, NOW).locked, true);
  assert.equal(lockState({ locked_until: secs(NOW) - 1 }, NOW).locked, false);
  // ...and it heals on its own, with no owner and no support ticket.
  const user = { locked_until: secs(NOW) + 30 };
  assert.equal(lockState(user, NOW).locked, true);
  assert.equal(lockState(user, NOW + 31_000).locked, false);
});

test("retryAfter is the wait, and is never negative", () => {
  assert.equal(lockState({ locked_until: secs(NOW) + 90 }, NOW).retryAfter, 90);
  assert.equal(lockState({ locked_until: secs(NOW) - 90 }, NOW).retryAfter, 0);
});

// ------------------------------------------------------------- transitions

test("failures accumulate and eventually earn a delay", () => {
  let user = { failed: 0 };
  for (let n = 1; n <= LOCKOUT_THRESHOLD; n++) {
    user = afterFailure(user, NOW);
    assert.equal(user.failed, n);
    assert.equal(user.locked_until, 0, "no delay yet at " + n);
  }
  const locked = afterFailure(user, NOW);
  assert.equal(locked.failed, LOCKOUT_THRESHOLD + 1);
  assert.ok(locked.locked_until > secs(NOW), "the next one costs time");
});

test("failing while already delayed changes nothing", () => {
  // Otherwise a person hammering their own forgotten password pushes their own
  // wait from thirty seconds to an hour — and so can somebody doing it to them.
  const user = { failed: 9, locked_until: secs(NOW) + 600 };
  assert.equal(afterFailure(user, NOW), null);
});

test("a long quiet spell forgets the count", () => {
  // A year-old fumble must not start the next bad day at the top of the curve.
  const stale = { failed: 9, locked_until: 0, last_failed_at: secs(NOW) - LOCKOUT_DECAY_SEC - 10 };
  const next = afterFailure(stale, NOW);
  assert.equal(next.failed, 1);
  assert.equal(next.locked_until, 0);
});

test("a recent failure does NOT decay", () => {
  const recent = { failed: 9, locked_until: 0, last_failed_at: secs(NOW) - 60 };
  assert.equal(afterFailure(recent, NOW).failed, 10);
});

test("success forgets everything", () => {
  const r = afterSuccess();
  assert.equal(r.failed, 0);
  assert.equal(r.locked_until, 0);
  assert.equal(r.last_failed_at, 0);
  // And an account that just succeeded is not locked by the result.
  assert.equal(lockState(r, NOW).locked, false);
});

test("the counter starts again after a success", () => {
  let user = afterSuccess();
  for (let n = 1; n <= LOCKOUT_THRESHOLD; n++) user = afterFailure(user, NOW);
  assert.equal(user.locked_until, 0, "a good login really does reset the curve");
});

test("a corrupt count is treated as zero, not as a negative delay", () => {
  const next = afterFailure({ failed: -50 }, NOW);
  assert.equal(next.failed, 1);
  assert.equal(next.locked_until, 0);
});

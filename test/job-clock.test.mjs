// STAGE 5d (2026-09-06): A JOB CHILD IS STOPPED PAST ITS DEADLINE, AND A STOP
// IS TWO SIGNALS IN ORDER — the policy module, driven with fake timers.
//
// The wiring (the build service arming the terminator per child, `DELETE
// /job/<id>`, the drain stopping its children, the runner turning SIGTERM into
// a `stopped` gate answer, the launch carrying the deadline) is
// test/job-stop.test.mjs's; this file holds the numbers and the sequence.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JOB_KILL_GRACE_MS, JOB_TERM_GRACE_MS, JOB_STOP_GRACE_MS, STOPPED_EXIT_CODE, DEFAULT_JOB_MS,
  readDeadline, killPlan, makeTerminator,
} from "../builder/job-clock.mjs";
import { EDIT_JOB_MS, TERMINAL_RESERVE_MS, JOB_TOKEN_GRACE_S } from "../builder/edit-job.mjs";

test("the module is dependency-free, and its one shared number is the edit path's budget", () => {
  const src = readFileSync(new URL("../builder/job-clock.mjs", import.meta.url), "utf8").replace(/^(\s*)\/\/.*$/gm, "");
  assert.equal(/^\s*import\b/m.test(src), false, "job-clock.mjs imports something — the service image copies its imports one file at a time");
  assert.equal(DEFAULT_JOB_MS, EDIT_JOB_MS, "the spelled budget drifted from EDIT_JOB_MS");
});

/** Fake timers: every scheduled callback with its delay, run by hand. */
function fakeTimers() {
  const timers = [];
  let id = 0;
  return {
    timers,
    setTimeout(fn, ms) { const t = { id: ++id, fn, ms, cleared: false }; timers.push(t); return t; },
    clearTimeout(t) { if (t) t.cleared = true; },
    pending: () => timers.filter((t) => !t.cleared && !t.ran),
    fire(t) { t.ran = true; t.fn(); },
  };
}

test("the numbers: the child is asked to stop a minute past its deadline, killed half a minute after that, and ends itself before the kill", () => {
  assert.equal(JOB_KILL_GRACE_MS, 60_000);
  assert.equal(JOB_TERM_GRACE_MS, 30_000);
  assert.ok(JOB_STOP_GRACE_MS < JOB_TERM_GRACE_MS, "a child that can still run code must end itself before the service kills it");
  assert.ok(JOB_KILL_GRACE_MS > TERMINAL_RESERVE_MS, "the grace is shorter than the job's own last writes");
  assert.ok(JOB_KILL_GRACE_MS + JOB_TERM_GRACE_MS < JOB_TOKEN_GRACE_S * 1000, "a child could outlive its gateway token");
  assert.equal(STOPPED_EXIT_CODE, 4);
  for (const taken of [0, 1, 2]) assert.notEqual(STOPPED_EXIT_CODE, taken, "the stopped exit code collides with an exit the runner already uses");
});

test("readDeadline: a finite positive epoch as it is; anything else is now plus the job's whole budget", () => {
  const now = 1_700_000_000_000;
  assert.equal(readDeadline(now + 5000, now), now + 5000);
  assert.equal(readDeadline(String(now + 5000), now), now + 5000);
  assert.equal(readDeadline(now + 5000.7, now), now + 5000);
  assert.equal(readDeadline(now - 5000, now), now - 5000, "a deadline already behind now is still a deadline");
  for (const bad of [undefined, null, "", "soon", 0, -1, NaN, Infinity, true, [now], {}]) {
    assert.equal(readDeadline(bad, now), now + EDIT_JOB_MS, "admitted " + JSON.stringify(bad));
  }
  assert.equal(readDeadline(undefined, now, 1000), now + 1000);
});

test("killPlan: the term a grace past the deadline, the kill a grace past the term, never before now", () => {
  const now = 1_000_000;
  assert.deepEqual(killPlan(now + 10_000, now), { termAt: now + 10_000 + JOB_KILL_GRACE_MS, killAt: now + 10_000 + JOB_KILL_GRACE_MS + JOB_TERM_GRACE_MS });
  // A child started after its deadline's grace is stopped now, not in the past.
  assert.deepEqual(killPlan(now - 500_000, now), { termAt: now, killAt: now + JOB_TERM_GRACE_MS });
});

test("the terminator, armed: SIGTERM at the deadline's grace, SIGKILL a grace later, the record saying stopping then killed", () => {
  const t = fakeTimers();
  const sent = [];
  const states = [];
  const now = 1_000_000;
  const term = makeTerminator({ kill: (s) => sent.push(s), setTimeout: t.setTimeout, clearTimeout: t.clearTimeout, now: () => now, onState: (s, why) => states.push([s, why]) });
  assert.equal(term.state(), "running");
  term.arm(now + 10_000);
  assert.equal(t.pending().length, 1);
  assert.equal(t.pending()[0].ms, 10_000 + JOB_KILL_GRACE_MS, "the term is not scheduled at the deadline's grace");
  term.arm(now + 999_999);
  assert.equal(t.pending().length, 1, "a second arm scheduled a second term");
  assert.deepEqual(sent, [], "a signal was sent before the deadline");
  t.fire(t.pending()[0]);
  assert.deepEqual(sent, ["SIGTERM"]);
  assert.equal(term.state(), "stopping");
  assert.equal(term.why(), "deadline");
  assert.deepEqual(states, [["stopping", "deadline"]]);
  assert.equal(t.pending().length, 1);
  assert.equal(t.pending()[0].ms, JOB_TERM_GRACE_MS, "the kill is not a grace past the term");
  t.fire(t.pending()[0]);
  assert.deepEqual(sent, ["SIGTERM", "SIGKILL"]);
  assert.equal(term.state(), "killed");
  assert.deepEqual(states[1], ["killed", "deadline"]);
  assert.equal(t.pending().length, 0);
});

test("the terminator, stopped from outside: the armed term is dropped, SIGTERM goes now with the reason, a second stop changes nothing", () => {
  const t = fakeTimers();
  const sent = [];
  const term = makeTerminator({ kill: (s) => sent.push(s), setTimeout: t.setTimeout, clearTimeout: t.clearTimeout, now: () => 5 });
  term.arm(999_999);
  const armed = t.pending()[0];
  term.stop("cancel");
  assert.equal(armed.cleared, true, "the deadline's term is still pending under a stop");
  assert.deepEqual(sent, ["SIGTERM"]);
  assert.equal(term.state(), "stopping");
  assert.equal(term.why(), "cancel");
  term.stop("drain");
  assert.deepEqual(sent, ["SIGTERM"], "a second stop sent a second SIGTERM");
  assert.equal(term.why(), "cancel", "a second stop rewrote the reason");
  term.arm(1);
  assert.equal(t.pending().filter((x) => x.ms !== JOB_TERM_GRACE_MS).length, 0, "an arm after a stop scheduled a term");
  assert.equal(t.pending().length, 1);
  t.fire(t.pending()[0]);
  assert.deepEqual(sent, ["SIGTERM", "SIGKILL"]);
  assert.equal(term.state(), "killed");
});

test("the terminator, cleared: a child that ended on its own leaves no timer behind; a kill that throws (the child already gone) is swallowed", () => {
  const t = fakeTimers();
  const term = makeTerminator({ kill: () => { throw new Error("ESRCH"); }, setTimeout: t.setTimeout, clearTimeout: t.clearTimeout, now: () => 0 });
  term.arm(100);
  term.clear();
  assert.equal(t.pending().length, 0, "the deadline's term outlived the child");
  const t2 = fakeTimers();
  const term2 = makeTerminator({ kill: () => { throw new Error("ESRCH"); }, setTimeout: t2.setTimeout, clearTimeout: t2.clearTimeout, now: () => 0 });
  term2.stop("cancel");
  assert.equal(term2.state(), "stopping");
  term2.clear();
  assert.equal(t2.pending().length, 0, "the kill outlived the child");
  // The defaults are the real timers, so a controller with only a kill works.
  const real = makeTerminator({ kill: () => {} });
  assert.equal(real.state(), "running");
  real.clear();
});

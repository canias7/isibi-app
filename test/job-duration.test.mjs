// ONE SETTING, AND EVERY NUMBER DOWNSTREAM OF IT.
//
// Owner, 2026-09-14: *"Make the overall job duration one explicit, configurable
// setting… Align the supporting deadlines, database allowance, container hold,
// and browser polling with that setting."*
//
// What this file is for is the ALIGNMENT, not the value. Fifty minutes is a
// choice and it can move; what must never happen again is the chain going out
// of step, because every way it can is silent:
//
//   the hold below the deadline  → the container is stopped BEFORE the SIGTERM
//                                  that lets the job end as a job, so the
//                                  graceful path is unreachable at exactly the
//                                  moment it exists for. SHIPPED ONCE.
//   the ttl above 3600           → `edit_handoff` raises `bad ttl` and every
//                                  handoff fails, at the first long job.
//   the browser below the job    → a customer is told their edit is lost while
//                                  it is running and about to publish.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  JOB_MAX_MS, HOLD_SLACK_MS, HANDOFF_MAX_S,
  jobDurationPlan, maxJobMs, readJobMaxMs, assertJobDuration,
} from "../builder/job-duration.mjs";
import { JOB_KILL_GRACE_MS, JOB_TERM_GRACE_MS } from "../builder/job-clock.mjs";
import { BUILD_JOB_MS } from "../builder/build-job.mjs";
import { CONTAINER_EDIT_JOB_MS, CONTAINER_EDIT_BUDGET_MS, EDIT_JOB_MS, SITE_BUSY_DEFER_S, MAX_SITE_BUSY_DEFERRALS } from "../builder/edit-job.mjs";
import { CONTAINER_BUILD_BUDGET_MS } from "../builder/build-budget.mjs";
import { MAX_BUSY_HOLD_MS } from "../builder/container-hold.mjs";
import { HANDOFF_TTL_S } from "../builder/build-lease.mjs";

test("every deadline downstream of the setting IS the setting — by identity, not by matching", () => {
  // BY IDENTITY. Two constants that happen to be `50 * 60_000` agree until
  // somebody changes one, which is what they were before this.
  assert.equal(BUILD_JOB_MS, JOB_MAX_MS, "a build's deadline is no longer the one setting");
  assert.equal(CONTAINER_EDIT_JOB_MS, JOB_MAX_MS, "an edit's deadline is no longer the one setting");
});

test("the WORK is unbounded and the DEADLINE is finite — the two must not be confused", () => {
  // The owner's instruction was that containers have no time limit on the WORK.
  // The deadline is a credential lifetime and a wedge-breaker, and it has to
  // stay finite or a job that loops holds its site's lease for ever.
  assert.equal(CONTAINER_EDIT_BUDGET_MS, Infinity, "the container's edit work grew a stopwatch again");
  assert.equal(CONTAINER_BUILD_BUDGET_MS, Infinity, "the container's build work grew a stopwatch again");
  assert.ok(Number.isFinite(JOB_MAX_MS) && JOB_MAX_MS > 0, "the outer bound went infinite with the budget — nothing would end a wedged job");
});

test("the hold is ABOVE the SIGKILL, which is the defect this file exists for", () => {
  const p = jobDurationPlan();
  assert.equal(p.termMs, JOB_MAX_MS + JOB_KILL_GRACE_MS);
  assert.equal(p.killMs, p.termMs + JOB_TERM_GRACE_MS);
  assert.equal(p.holdMs, p.killMs + HOLD_SLACK_MS);
  assert.ok(p.holdMs > p.killMs, "the container is let go before the SIGKILL");
  assert.ok(p.holdMs > p.termMs, "the container is let go before the SIGTERM — the graceful stop is unreachable");
  assert.equal(MAX_BUSY_HOLD_MS, p.holdMs, "the hold is no longer derived from the setting");
  // And the shipped defect stated as its own case: equal is NOT enough.
  assert.notEqual(MAX_BUSY_HOLD_MS, JOB_MAX_MS, "the hold equals the deadline again — the exact 2026-09-14 defect");
});

test("the DATABASE's ceiling is respected, and it is the real cap on the setting", () => {
  const p = jobDurationPlan();
  assert.equal(HANDOFF_TTL_S, p.handoffTtlS, "the handoff ttl is no longer derived from the setting");
  assert.ok(p.handoffTtlS <= HANDOFF_MAX_S,
    `the chain asks edit_handoff for ${p.handoffTtlS}s and it refuses anything past ${HANDOFF_MAX_S}s`);
  assert.equal(p.fits, true);
  // The cap is DERIVED, so it moves on its own if a grace ever does.
  assert.equal(maxJobMs(), HANDOFF_MAX_S * 1000 - JOB_KILL_GRACE_MS - JOB_TERM_GRACE_MS - HOLD_SLACK_MS);
  assert.equal(jobDurationPlan(maxJobMs()).fits, true, "the largest setting the arithmetic allows does not fit");
  assert.equal(jobDurationPlan(maxJobMs() + 1000).fits, false, "a setting past the ceiling reads as fitting");
});

test("assertJobDuration REFUSES a setting the database cannot serve, and names the migration", () => {
  assert.deepEqual(assertJobDuration(JOB_MAX_MS), jobDurationPlan(JOB_MAX_MS));
  assert.throws(() => assertJobDuration(90 * 60_000), /edit_handoff refuses/,
    "an hour-and-a-half setting was accepted — the handoff would fail at the first long job");
  // AND IT NAMES THE LARGEST SETTING THAT WOULD WORK. "Too big" on its own is a
  // refusal somebody has to go and do the arithmetic for, and it is the one
  // thing `maxJobMs()` is for outside a test — an exported function whose only
  // reader is the suite is a value nothing forwards, one layer over.
  assert.throws(() => assertJobDuration(90 * 60_000),
    new RegExp("largest setting this chain can carry is " + Math.floor(maxJobMs() / 60_000) + " minutes"),
    "the refusal does not say how long a job the chain WOULD carry");
  // AND THE OBSERVER IS ALIVE: the shipped default must pass, or this case is
  // an absence check over a function that refuses everything.
  assert.doesNotThrow(() => assertJobDuration());
});

test("readJobMaxMs takes a real setting, refuses junk, and NEVER throws", () => {
  assert.deepEqual(readJobMaxMs({}), { ms: JOB_MAX_MS, from: "default", why: "" });
  assert.equal(readJobMaxMs({ JOB_MAX_MINUTES: "30" }).ms, 30 * 60_000);
  assert.equal(readJobMaxMs({ JOB_MAX_MINUTES: " 45 " }).ms, 45 * 60_000);
  // NON-STRINGS REFUSED, NOT COERCED — `String(["50"])` is `"50"`, shipped as a
  // real bug in this repository three times.
  for (const junk of [["50"], 50, {}, null, undefined, true, "", "  ", "fifty", "-5", "0", "NaN", "1e999"]) {
    const r = readJobMaxMs({ JOB_MAX_MINUTES: junk });
    assert.equal(r.ms, JOB_MAX_MS, "junk setting " + JSON.stringify(junk) + " was taken");
    assert.equal(r.from, "default");
  }
  // THE ENVIRONMENT MAY ONLY SHORTEN. Every other number in the chain is
  // compiled from the built-in default — the hold, the handoff ttl, the queue's
  // cadence, and a literal in a browser file that cannot import at all — so a
  // LONGER setting moves the deadline past all four and nothing moves with it.
  // Refused, and it SAYS WHY rather than being taken and going wrong silently.
  for (const longer of ["51", "90", "57.5", "600", String(JOB_MAX_MS / 60_000 + 0.001)]) {
    const past = readJobMaxMs({ JOB_MAX_MINUTES: longer });
    assert.equal(past.ms, JOB_MAX_MS, "a setting longer than the compiled chain was taken: " + longer);
    assert.equal(past.from, "default");
    assert.match(past.why, /shorten|compiled/, "the refusal does not say why: " + past.why);
  }
  // …AND THE OBSERVER IS ALIVE IN BOTH DIRECTIONS: the setting's own value is
  // taken (the edge, not merely something smaller), and a shorter one is taken
  // as the env's — so a deploy can tell "taken" from "fell back", which the two
  // are otherwise indistinguishable on.
  assert.deepEqual(readJobMaxMs({ JOB_MAX_MINUTES: String(JOB_MAX_MS / 60_000) }), { ms: JOB_MAX_MS, from: "env", why: "" });
  assert.equal(readJobMaxMs({ JOB_MAX_MINUTES: "30" }).from, "env");
  // A SHORTENED SETTING IS SERVEABLE BY EVERY COMPILED NUMBER, which is the
  // reason the ceiling is the compiled default and not the database's.
  for (const shorter of [1, 5, 30, 49, JOB_MAX_MS / 60_000]) {
    const ms = readJobMaxMs({ JOB_MAX_MINUTES: String(shorter) }).ms;
    assert.ok(jobDurationPlan(ms).fits, "a setting the reader accepted does not fit the chain: " + shorter);
    assert.ok(MAX_BUSY_HOLD_MS > ms + JOB_KILL_GRACE_MS + JOB_TERM_GRACE_MS, "the compiled hold is short of an accepted setting's SIGKILL: " + shorter);
    assert.ok(HANDOFF_TTL_S * 1000 >= ms, "the compiled handoff ttl is short of an accepted setting: " + shorter);
    assert.ok(SITE_BUSY_DEFER_S * MAX_SITE_BUSY_DEFERRALS * 1000 >= ms, "a queued job gives up before an accepted setting can finish: " + shorter);
  }
});

test("readJobMaxMs has a CONSUMER — a setting nothing reads is not a setting", () => {
  // THIS REPOSITORY'S MOST-REPEATED DEFECT, and it was in the first cut of this
  // very change: the reader shipped with no call site, which reads exactly like
  // a configurable setting and is a constant with extra steps. `fireContainerJob`
  // is the ONE place a job's clock is minted — the launch's `deadlineAt` and the
  // token's `exp` both come off `budgetMs` — so it is the one place the setting
  // has to be asked, and the guards in build-runner/job-stop pin the hops.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    // Prose about the reader names the reader — the recorded own-goal.
    .split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  assert.match(src, /import \{ readJobMaxMs \} from "\.\/builder\/job-duration\.mjs";/, "worker.js no longer imports the setting's reader");
  // DERIVED BOTH WAYS, and re-anchored the same day when the job probe became a
  // SECOND legitimate mint: the property was never "read once", it is that
  // EVERY place minting a job's clock reads the setting. A mint with no read is
  // a deadline that ignores the deploy; a read with no mint is the unwired
  // reader this case exists for. Counting them and requiring them equal says
  // both at once and survives a third mint being added honestly.
  const mints = src.match(/deadlineAt: Date\.now\(\) \+ budgetMs/g) || [];
  const reads = src.match(/readJobMaxMs\(/g) || [];
  assert.ok(mints.length >= 1, "nothing in worker.js mints a job deadline — this case is checking a file that no longer fires jobs");
  assert.equal(reads.length, mints.length,
    "worker.js mints " + mints.length + " job deadlines and reads the setting " + reads.length + " times — one of them is not configurable");
  // AND EACH MINT'S `budgetMs` COMES OFF THE READER, never a constant: the
  // count alone is satisfied by two reads feeding one mint.
  assert.equal((src.match(/const budgetMs = (?:setting\.ms|readJobMaxMs\(env\)\.ms);/g) || []).length, mints.length,
    "a job deadline is minted from something other than the setting's answer");
});

test("the BROWSER watches at least as long as the job can run", () => {
  // chat.js and edit-poll.js cannot import, so the horizon is a second copy of
  // the setting BY CONSTRUCTION. This is what stops it drifting.
  const src = fs.readFileSync(new URL("../public/edit-poll.js", import.meta.url), "utf8");
  const m = /var POLL_GIVE_UP_MS = (\d+);/.exec(src);
  assert.ok(m, "POLL_GIVE_UP_MS moved — rescope this guard");
  const browser = Number(m[1]);
  const p = jobDurationPlan();
  assert.equal(browser, p.watchMs,
    `the page gives up after ${browser}ms and the job can run ${p.watchMs}ms — a customer would be told a running edit was lost`);
  assert.ok(browser >= JOB_MAX_MS, "the page gives up before the work's own deadline");
});

test("shouldGiveUp is a CLOCK, and cannot-tell never reads as expired — DRIVEN", async () => {
  const { default: nothing } = { default: null };
  void nothing;
  const src = fs.readFileSync(new URL("../public/edit-poll.js", import.meta.url), "utf8");
  const root = {};
  new Function("root", src + "\n")(root);
  const EP = root.EditPoll || globalThis.EditPoll;
  assert.ok(EP && typeof EP.shouldGiveUp === "function", "edit-poll does not export shouldGiveUp");

  const w = EP.makeWatch("job1", "slug1", 1_000_000);
  assert.equal(w.startedAt, 1_000_000, "the watch does not record when it started");
  assert.equal(EP.shouldGiveUp(w, 1_000_000), false, "a watch gives up the moment it starts");
  assert.equal(EP.shouldGiveUp(w, 1_000_000 + EP.POLL_GIVE_UP_MS), false, "the horizon is exclusive at its own edge");
  assert.equal(EP.shouldGiveUp(w, 1_000_000 + EP.POLL_GIVE_UP_MS + 1), true, "the page watches past the job's whole horizon");
  // A JOB THAT IS STILL WELL INSIDE ITS DEADLINE IS NEVER ABANDONED — the case
  // that matters, and the one the attempt counter could not express.
  assert.equal(EP.shouldGiveUp(w, 1_000_000 + JOB_MAX_MS - 1), false, "the page gave up on a job still inside its deadline");
  // CANNOT-TELL MUST NOT READ AS EXPIRED: a watch with no start time (an older
  // record, a hand-built object) keeps watching rather than abandoning a live
  // edit — this repo's most-recorded shape, in the direction that costs least.
  for (const bad of [{}, { startedAt: 0 }, { startedAt: "nope" }, { startedAt: NaN }, null, undefined]) {
    assert.equal(EP.shouldGiveUp(bad, 9e15), false, "a watch with no start time was abandoned: " + JSON.stringify(bad));
  }
});

test("the browser's give-up is the CLOCK, not the old attempt counter", () => {
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8")
    // Prose explains the change and therefore spells the thing it replaced —
    // this repository's most-recorded own-goal in a guard.
    .split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  assert.match(chat, /EditPoll\.shouldGiveUp\(w\)/, "the give-up is no longer asked of the poll module");
  assert.ok(!/w\.attempt\s*>\s*\d+/.test(chat), "the attempt-count give-up came back — the horizon would move with the backoff curve");
  // ALIVE OBSERVER: the attempt counter still exists and still drives backoff;
  // this case is about what it is NOT used for.
  assert.match(chat, /pollDelayMs\(w\.attempt\)/, "the backoff stopped reading the attempt count — this guard is checking a file that no longer polls");
});

test("a job QUEUED behind a long one waits longer than that job can run", () => {
  // The fifth thing downstream of the setting, and the one that was silently
  // short: 60s × 45 refusals = 2,700s of waiting in front of a job that can run
  // 3,000. A job behind a long one was failed — nothing charged, but the
  // customer told to ask again — before the job it waited for could finish.
  // The cap is the DATABASE's literal, so the cadence is what gives.
  assert.ok(SITE_BUSY_DEFER_S * MAX_SITE_BUSY_DEFERRALS >= JOB_MAX_MS / 1000,
    `a queued job waits ${SITE_BUSY_DEFER_S * MAX_SITE_BUSY_DEFERRALS}s in front of one that may run ${JOB_MAX_MS / 1000}s`);
  assert.equal(SITE_BUSY_DEFER_S, Math.ceil(JOB_MAX_MS / 1000 / MAX_SITE_BUSY_DEFERRALS),
    "the cadence stopped being derived from the setting");
  // …and it is still a cadence a person would call "about a minute", not an
  // hour spent hiding a misalignment.
  assert.ok(SITE_BUSY_DEFER_S >= 30 && SITE_BUSY_DEFER_S <= 300, "the re-send delay is no longer a real minute: " + SITE_BUSY_DEFER_S);
});

test("EDIT_JOB_MS is the WORKER's number and stays where it is", () => {
  // The inline path is a Cloudflare isolate, which really is stopped at fifteen
  // minutes — so its budget is NOT the container's setting and must not be
  // pulled into this chain. Named here so a session aligning everything does
  // not align this one too.
  assert.equal(EDIT_JOB_MS, 840000, "the Worker's own inline budget moved — it is sized for a 15-minute isolate, not for the container");
  assert.ok(EDIT_JOB_MS < JOB_MAX_MS, "the inline budget outgrew the container's, which would be backwards");
});

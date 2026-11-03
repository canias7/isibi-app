// PARKED (2026-11-03, park-old-way): the old-way half of test/publish-clock.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The publish clock, read off the Worker (run 33, 2026-09-03).
//
// A two-kind addon spent eleven minutes on a picker, two designers and a page
// call, reached the publish with 235 seconds left, and the compile — capped
// at what was left minus the reserves — was cut at 129 seconds of the 157 it
// needed. Three things were wrong at once and each is pinned here by the
// property it must keep, never by a spelling:
//
//   1. the job's gate let a publish START that could not fit;
//   2. the timeout reached the customer as "didn't compile — try describing
//      it differently", their words blamed for our clock;
//   3. the harness overwrote the route's own `failed` with "reply says ok".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const harness = fs.readFileSync(new URL("../../../scripts/addon-sweep.mjs", import.meta.url), "utf8");

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

test("the addon asks the gate BEFORE it reserves credits, so a refusal for time charges nothing", () => {
  const route = between(worker, "// ── MAY THIS STILL PUBLISH? (async path)", "aMark(\"publish:1\", \"start\"", "the addon's publish gate");
  const gate = route.indexOf('aJob.gate("build")');
  // RE-ANCHORED 2026-09-05 (stage 1a-ii): the PAGE PATH's reserve — the one
  // bill, or sequence #4 once #1 went ahead of a schema apply — still sits
  // after the gate. Sequence #1 sits before the schema apply by design, so
  // a job refused for time after a backend addon is charged #1 and refunded
  // by the consumer, the same road a failed compile already takes; what this
  // guard keeps is that the page call's spend is never reserved before the
  // floor has been asked.
  const charge = route.indexOf("aCost = aFirstPlaced ?");
  assert.ok(gate > 0 && charge > gate, "the page path's reserve is placed before the gate — a job refused for time would be charged and refunded instead of never charged");
  assert.match(route, /return await editStopped\(env, \{ job: aJob, why: aGatePub\.why/, "a refused gate no longer stops the job through editStopped");
});

test("a stopped job refused for time says so, and leaves what it cost to the reader", () => {
  // ANCHORED ON THE NAME, not the whole parameter list, which gains a field
  // whenever a caller has something new to hand it (`kept`, 2026-09-25).
  const fn = between(worker, "async function editStopped(env, {", "async function runLostEditJobs(", "editStopped");
  const time = fn.indexOf('why === "time"');
  assert.ok(time > 0, "no sentence for a job refused for time");
  const sentence = fn.slice(time, fn.indexOf("\n", fn.indexOf("?", time) + 1));
  assert.match(sentence, /longer than the time we allow/);
  // (2026-09-25) It said "nothing was charged", and the routing call that chose
  // the edit is a charge nothing refunds. What the edit cost is the reader's to
  // say, from the job's own row (`servedEditReply`), beside the routing call's.
  assert.doesNotMatch(sentence, /charg|refund|cost/i, "the stop claims something about money: " + sentence);
  assert.match(sentence, /two smaller steps/);
});

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

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const harness = fs.readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8");

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

test("the job gate refuses a publish below the floor, by name, after cancel and expiry", () => {
  const gate = between(worker, "    gate(phase) {", "      return { go: true, phase };", "makeJobCtx.gate");
  const cancel = gate.indexOf('why: "cancelled"');
  const expired = gate.indexOf('why: "budget"');
  const time = gate.indexOf('why: "time"');
  assert.ok(cancel > 0 && expired > cancel && time > expired, "the time check must come after cancel and expiry, so a cancelled job is still reported as cancelled");
  assert.match(gate, /phase === "build" && budget && typeof budget\.canPublish === "function" && !budget\.canPublish\(\)/,
    "the floor is asked of the budget's own canPublish, only for the build phase, and only when the budget has one");
});

test("the addon asks the gate BEFORE it reserves credits, so a refusal for time charges nothing", () => {
  const route = between(worker, "// ── MAY THIS STILL PUBLISH? (async path)", "aMark(\"publish:1\", \"start\"", "the addon's publish gate");
  const gate = route.indexOf('aJob.gate("build")');
  const charge = route.indexOf("aCost = await aCharge(aBill)");
  assert.ok(gate > 0 && charge > gate, "the reserve is placed before the gate — a job refused for time would be charged and refunded instead of never charged");
  assert.match(route, /return await editStopped\(env, \{ job: aJob, why: aGatePub\.why/, "a refused gate no longer stops the job through editStopped");
});

test("a stopped job refused for time says so, and says nothing was charged", () => {
  const fn = between(worker, "async function editStopped(env, { job, why, phase, trace, ctx, msg }) {", "async function runLostEditJobs(", "editStopped");
  const time = fn.indexOf('why === "time"');
  assert.ok(time > 0, "no sentence for a job refused for time");
  const sentence = fn.slice(time, fn.indexOf("\n", fn.indexOf("?", time) + 1));
  assert.match(sentence, /longer than the time we allow/);
  assert.match(sentence, /nothing was charged/);
  assert.match(sentence, /two smaller steps/);
});

test("the spine tells the clock apart from the code: a timed-out container call is `timedOut`, ours, and worded as time", () => {
  const spine = between(worker, "async function recompileAndPublish(", "// ── A RULE THAT SELECTS NOTHING DOES NOT SHIP YET", "recompileAndPublish's compile");
  // The catch classes the error and carries the class out.
  const caught = between(spine, 'tm("container", "fail", { name:', "  let built = await compile();", "the container catch");
  assert.match(caught, /timedOut: !!\(e && \(e\.name === "TimeoutError" \|\| e\.name === "AbortError"\)\)/, "the catch does not carry the class");
  // The failure return forwards it and counts it as ours.
  const fail = between(spine, "if (!built || built.ok !== true || !built.files) {", "  }", "the compile failure return");
  assert.match(fail, /const timedOut = !!\(built && built\.timedOut\);/);
  assert.match(fail, /ours: \(killed && wasKilled\(built && built\.error\)\) \|\| timedOut, timedOut,/, "a timeout is not ours, or is not forwarded");
  // And the sentence reads it before the two older `ours` sentences.
  const msg = between(worker, "function compileMsg(pub, theirs) {", "\n}\n", "compileMsg");
  const timed = msg.indexOf("if (pub.timedOut) {");
  const read = msg.indexOf('return pub.error === "read"');
  assert.ok(timed > 0 && read > timed, "the timeout sentence must be decided before the read/restarting fallback");
  assert.match(msg.slice(timed, read), /longer than the time we allow for one change/);
  assert.match(msg.slice(timed, read), /Nothing was charged/);
});

test("the harness keeps a verdict it already gave: a 422 is `failed` with the route's reason, never `LIE: reply says ok`", () => {
  const chain = between(harness, 'if (verdict === "failed" && String(body.error) === "declined") {', "const kinds = Array.isArray(body.kinds) ? body.kinds : [];", "the verdict chain");
  const keep = chain.indexOf("else if (verdict) {");
  const pageless = chain.indexOf("else if (c.pageless) {");
  // Searched AFTER the pageless branch: the guard's own comment quotes the
  // sentence it forbids, which is this repo's recorded trap.
  const lie = chain.indexOf("reply says ok but the build did not move", pageless);
  assert.ok(keep > 0 && pageless > keep && lie > pageless, "the 'verdict already given' guard must sit before the pageless branch and the LIE branch");
});

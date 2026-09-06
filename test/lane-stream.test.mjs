// THE SMALL CALLS STREAM, AND THAT IS WHAT EARNS THEM A LONGER CEILING.
//
// RUN 40 (2026-09-06) is why, and it is the THIRD wordmark timeout on Grok:
// `waitedMs: 240000`, `call: "lane"`, `kind: "TimeoutError"`. That number is
// `QUICK_CALL_MS` exactly — our own `AbortSignal`, not the provider and not
// the egress. Task #47 had answered the previous two by capping the ANSWER
// (`max_tokens` 16,000 → 3,334 for a drawn wordmark) on the reasoning that a
// smaller budget buys a shorter generation. It does not: generation time
// follows the tokens actually EMITTED, not the ceiling they may reach. The
// tell is WHICH failure came back — a bound ceiling stops with `max_tokens`,
// and run 40 stopped with a timeout, so the model had not reached 3,334 when
// we cut it. The fix was correct plumbing on a wrong bound.
//
// THE 240 WAS NEVER ABOUT THE MODEL. `QUICK_CALL_MS`'s own comment sets it
// against an egress that hangs up an IDLE connection at ~270s. Streaming is
// what stops the connection being idle, and the module has folded a streamed
// transcript back into the non-streaming shape — usage and all — since the
// container needed one. So the flag is the whole change, and the longer
// ceiling is what the flag buys.
//
// WHY THIS FILE DRIVES RATHER THAN READS. The hop that was missing is
// `callBuilderModel`'s fourth argument: the module has taken an `opts.stream`
// for months and the Worker's wrapper dropped it. Every static check reads
// that as correct — the parameter exists downstream, the constant is defined,
// the module is perfect. Only running the real closure and inspecting what it
// hands on shows a value that never arrives. That is `picked-model`'s own
// lesson (`routeMessage` took a `model` and never passed it), and it is why
// `quickSend` is EVALUATED out of worker.js here instead of grepped.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILDER_CALL_MS } from "../builder/build-call.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/**
 * The REAL `quickSend` closure, with `callBuilderModel` replaced by a recorder.
 *
 * The window runs from `QUICK_CALL_MS`'s declaration to the close of
 * `quickSend`'s own `.catch`, so it carries every constant the closure reads
 * from module scope. Both landmarks are asserted: `indexOf` answering -1
 * gives an empty slice, which would pass every assertion made inside it.
 */
function quickSendFn() {
  const at = WORKER.indexOf("const QUICK_CALL_MS = 240000;");
  const mark = WORKER.indexOf("const quickSend = (env, what = \"\", budget = null) =>", at);
  assert.ok(at > 0, "QUICK_CALL_MS moved — rescope this guard");
  assert.ok(mark > at, "quickSend moved — rescope this guard");
  const end = WORKER.indexOf("\n});\n", mark);
  assert.ok(end > mark, "quickSend's catch moved — rescope this guard");
  const text = WORKER.slice(at, end + 4);
  const calls = [];
  // eslint-disable-next-line no-new-func
  const make = new Function(
    "callBuilderModel", "BUILDER_CALL_MS",
    text + "\nreturn quickSend;",
  );
  const quickSend = make(
    (env, req, budget, opts) => { calls.push({ env, req, budget, opts }); return Promise.resolve({ ok: true }); },
    BUILDER_CALL_MS,
  );
  return { quickSend, calls };
}

test("a small call ASKS TO STREAM — the flag reaches the module, on every caller", async () => {
  const { quickSend, calls } = quickSendFn();
  // The synchronous shape and the queued shape both, because they take
  // different branches of the budget expression and only one of them was
  // ever going to be exercised by the lanes in practice.
  await quickSend({}, "lane")({ model: "grok-4.6" });
  await quickSend({}, "lane", { capMs: (c) => c })({ model: "grok-4.6" });
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.ok(c.opts, "quickSend handed no opts at all — the wrapper's fourth argument is unwired again");
    assert.equal(c.opts.stream, true, "the small call stopped asking to stream — run 40's timeout is back");
  }
});

test("THE QUEUED CALL IS BOUND BY THE JOB, NOT BY A FLAT 240s ANY MORE", () => {
  const { quickSend, calls } = quickSendFn();
  // A job with plenty left: the clamp must now admit more than the old flat
  // ceiling, or streaming bought nothing and the wordmark is cut at 240s for
  // a fourth time.
  quickSend({}, "lane", { capMs: (c) => c })({ model: "grok-4.6" });
  const cap = calls[0].budget.capMs(BUILDER_CALL_MS);
  assert.ok(cap > 240000, `a queued small call is still capped at ${cap}ms — the streamed ceiling never took effect`);
  assert.ok(cap < BUILDER_CALL_MS, `the streamed ceiling is ${cap}ms — a small call must never be given a build's clock`);
});

test("…and the JOB still only ever makes it SMALLER — a late call gets what is left", () => {
  const { quickSend, calls } = quickSendFn();
  // The job has 30s left. Composition, not replacement: the clock wins.
  quickSend({}, "lane", { capMs: (c) => Math.min(c, 30000) })({ model: "grok-4.6" });
  assert.equal(calls[0].budget.capMs(BUILDER_CALL_MS), 30000,
    "a lane starting near the end of its job was handed more time than the job has");
});

test("THE SYNCHRONOUS PATH KEEPS 240s — streaming to the provider does not move the CUSTOMER'S wire", () => {
  const { quickSend, calls } = quickSendFn();
  quickSend({}, "lane")({ model: "grok-4.6" });
  assert.equal(calls[0].budget.capMs(BUILDER_CALL_MS), 240000,
    "the un-queued ceiling moved — off the queue the bound is the customer's own connection (~273s, run 21), " +
    "which streaming to a provider does nothing for");
});

test("the wrapper FORWARDS opts — the hop run 40 found missing", () => {
  // Read as well as driven, because the driven test above stubs the very
  // function this asserts about: it proves quickSend HANDS opts on, and this
  // proves the thing it hands them to passes them to the module.
  const at = WORKER.indexOf("const callBuilderModel = (env, req, budget = null");
  assert.ok(at > 0, "the wrapper moved — rescope this");
  const line = WORKER.slice(at, WORKER.indexOf("\n", at));
  assert.match(line, /opts\s*=\s*null/, "the wrapper stopped taking opts");
  assert.match(line, /callModel\(keysFrom\(env\), req, budget, null, opts\)/,
    "the wrapper takes opts and does not pass them on — exactly the shape that cost run 40");
});

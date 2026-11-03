// PARKED (2026-11-03, park-old-way): the old-way half of test/container-model.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE CONTAINER CAN MAKE THE MODEL CALL — the wiring, at both ends.
//
// This is the layer this repo has recorded TWELVE dead features in, every one
// of them the same shape: a module that was correct, a caller that never
// reached it, and a suite that stayed green. Three hops have to hold and each
// fails silently on its own:
//
//   the Worker SETS the keys on the container's start config
//   the container TAKES them out of its own environment  (build-keys.test.mjs)
//   the container's /model route CALLS THROUGH with them
//
// The middle one is proven by driving real processes. The other two are source
// reads, because `worker.js` cannot be imported and `build-server.mjs` listens
// on a port at import time — so both are asserted on PROPERTIES rather than
// spellings, which is the own-goal this repo has recorded most often.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { keyEnv, SECRET_ENV, BUILDER_CALL_MS } from "../../../builder/build-call.mjs";
import { WORKER_SRC } from "../../../test/fixtures/build-path.mjs";

const SERVER_SRC = fs.readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");

/** Whole-line comments blanked, length-preservingly — a scan over prose that
 *  ARGUES for a rule matches the rule's own spelling and passes against code
 *  that no longer does it. This file's subject is documented at length in both
 *  sources it reads, so the trap is live rather than theoretical. */
const blank = (src) =>
  src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

/* --------------------------------------- and the BUILD really goes through it */

test("THE BUILD'S PAGE GENERATION IS MADE IN THE CONTAINER, and the edit lanes are not", () => {
  // THE WIRE, which is the half a module test cannot see. `/model` shipped
  // UNREACHABLE on purpose so it could be proven before anything depended on
  // it — and a route nothing calls is exactly the state twelve features in this
  // repo have shipped and stayed in.
  const w = blank(WORKER_SRC);

  // ONE caller into the module carries a container caller, and it is the BUILD's.
  const calls = [...w.matchAll(/generateSitePages\(env,[\s\S]*?\);/g)].map((m) => m[0]);
  assert.ok(calls.length >= 3, `expected the build and both edit lanes to generate; found ${calls.length}`);
  // THE BUILD IS IDENTIFIED BY ITS BRIEF, not by the caller it happens to pass.
  // This filtered on `containerPagesCall(` appearing in the call expression —
  // true until the caller became a VARIABLE, resolved one statement above so a
  // resume can replay the same function with the answer already in hand. The
  // filter then matched nothing and reported that no build makes its generation
  // in the container, about a build that always does.
  const build = calls.filter((c) => /briefWithLayout\(\{ brief, plan/.test(c));
  assert.equal(build.length, 1,
    `${build.length} generation calls are the build's own — expected exactly one`);
  // PASSED, NOT LAST. This read `/,\s*call\)/` — the caller as the final
  // argument — and went red the moment an honest one arrived after it
  // (`plan && plan.kind`, 2026-08-29, so the page prompt can drop the chart
  // catalogue for a shopfront). It reported the build as making its own request
  // from the Worker, which was never true. Assert the property: the caller is
  // handed over.
  assert.match(build[0], /,\s*call\s*[,)]/,
    "the build's generation is handed no caller, so it makes its own request from the Worker");

  // AND THE VARIABLE RESOLVES TO A CONTAINER CALLER ON BOTH LIVE PATHS. Asserted
  // as a pair, because a ternary collapsed to one branch would silently un-split
  // it: only `containerPagesFire` leaves the Worker free, and only
  // `containerPagesCall` still works where firing is not available.
  const at = w.indexOf("const call = resumeCall");
  assert.ok(at > 0, "the build no longer resolves its caller — rescope this guard");
  const resolve = w.slice(at, w.indexOf(";", at));
  assert.match(resolve, /containerPagesFire\(/,
    "the build can no longer FIRE its generation at the container, so a consumer invocation holds the whole wait");
  assert.match(resolve, /containerPagesCall\(/,
    "the build has no synchronous container caller left, so any path that cannot fire has no hop at all");

  // AND THE LANES STAY ON THE WORKER. Explicit rather than implied by the count
  // above, because a lane silently gaining the hop buys a new failure mode on
  // the CHEAP path for a call that takes seconds.
  for (const c of calls.filter((x) => !build.includes(x))) {
    assert.ok(!/containerPages/.test(c) && !/,\s*call\)/.test(c),
      "an edit lane now makes its model call in the container");
  }
});

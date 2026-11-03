// PARKED (2026-11-03, park-old-way): the old-way half of test/edit-queue.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The queued edit path: the fork, the message, the replay, and the gates.
//
// ── WHAT IS DRIVEN AND WHAT IS READ ───────────────────────────────────────
//
// Everything that can be DRIVEN is: the message reader, the replay builder, the
// duration arithmetic and the budget gates all run here against literal inputs.
// A handful of properties are about where a call sits inside an 800-line route —
// whether the publish gate really precedes the first R2 write, whether the
// synchronous path still reaches the same code — and those are read, because
// there is nothing to run them against short of a Worker runtime.
//
// The reads are anchored on ORDER and on ABSENCE, never on a call's spelling.
// Three existing guards went red for this commit and every one of them was
// pinned to an argument list; each described something nobody did.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EDIT_JOB_KIND, REPLAY_HEADER, EDIT_JOB_MS, PUBLISH_RESERVE_MS, TERMINAL_RESERVE_MS,
  CORRECT_FLOOR_MS, readEditMessage, replayEditRequest, phaseDurations, makeEditBudget,
  newReplaySecret, packReplayMarker, readReplayMarker, packEditJob, readEditJob,
} from "../../../builder/edit-job.mjs";

const ID = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
const SEC = "0f1e2d3c4b5a69780f1e2d3c4b5a6978";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

/** Length-preserving comment blanking, string-aware. See wall-probe.test.mjs. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const CODE = blankComments(W);

/**
 * The condition of the last `if (` in a chunk, counting parentheses.
 *
 * DEPTH-AWARE, AND THE FLAT VERSION IS WHY. `if \(([^)]*)\)` stops at the first
 * `)`, which here is inside `if (job && !(wput && wput.uploaded === false))` —
 * so the flat scan found no condition at all and the guard reported a perfectly
 * guarded call as unguarded. This repo's own recorded trap, written wrong for
 * the sixth time.
 */
function lastCondition(chunk) {
  const open = chunk.lastIndexOf("if (");
  if (open < 0) return null;
  let depth = 0;
  for (let i = open + 3; i < chunk.length; i++) {
    if (chunk[i] === "(") depth++;
    else if (chunk[i] === ")") { depth--; if (depth === 0) return chunk.slice(open + 4, i).trim(); }
  }
  return null;
}

/** `indexOf` that refuses -1, so no assertion below is made about `slice(-1, -1)`. */
function at(src, needle, label) {
  const i = src.indexOf(needle);
  assert.ok(i > 0, `${label}: landmark gone (${needle})`);
  return i;
}

/**
 * A window between two landmarks, PROVING BOTH EXIST AND ARE IN ORDER.
 *
 * `at()` alone is not enough and this file learned that the hard way: a closing
 * landmark that sits EARLIER in the file than the opening one passes both
 * existence checks and yields `slice(big, small)` — the empty string, which
 * contains none of the things the assertions then look for. So the guard
 * reported a function it had never looked at as missing every property it has.
 *
 * The same shape as the -1 case this repo already records, one step along: it is
 * not that a landmark is gone, it is that the two are the wrong way round.
 */
function between(src, open, close, label) {
  const a = at(src, open, label);
  const b = src.indexOf(close, a);
  assert.ok(b > a, `${label}: the closing landmark does not follow the opening one (${close})`);
  return src.slice(a, b);
}

test("a queued edit reads its balance by uid, not by a token it does not have", () => {
  // ITEM 7, IN THE ONE PLACE IT STILL BIT. Without this the picture lane reads a
  // balance of zero on every async edit and declines a photograph the customer
  // can afford — a wrong answer wearing the shape of a policy.
  assert.match(CODE, /eJob \? readCreditsFor\(env, eJob\.uid\) : readCredits\(eAuth\)/,
    "the queued path no longer reads the balance by uid");
  const fn = CODE.slice(at(CODE, "async function readCreditsFor", "balance"), at(CODE, "async function readCredits(", "balance end"));
  assert.match(fn, /svcHeaders\(env\)/, "the uid balance read no longer uses the service role");
  assert.doesNotMatch(fn, /get_credits/, "the uid read goes through get_credits, which resolves auth.uid() and grants on first touch");
});

test("a stop publishes nothing and refunds through the database", () => {
  const fn = CODE.slice(at(CODE, "async function editStopped", "stop"),
                        at(CODE, "async function runLostEditJobs", "stop end"));
  assert.match(fn, /edit_refund/, "the stop path no longer refunds");
  // "WHEN APPROPRIATE" IS POSTGRES'S DECISION. It refuses a published job and
  // routes a mid-publish one to needs_review with the money untouched — so this
  // function must not be making that judgement itself.
  assert.doesNotMatch(fn, /published_at|publish_started_at/,
    "the stop path is deciding for itself whether to refund — that belongs in the RPC");
  // AND IT WRITES NOTHING TO R2, which is what makes "retain the live site" a
  // property of the code rather than a claim about it.
  assert.doesNotMatch(fn, /SITES_BUCKET|putSiteWorker|writeSiteDistToR2/,
    "the stop path touches storage");
});

test("the correction gate is asked before the round, not during", () => {
  // BOTH LANDMARKS ARE CODE. The first draft closed this window on a comment
  // heading — in a file whose comments this test blanks — so the slice was empty
  // and the window's own guard caught it. Twice in three commits now.
  // THE WINDOW CLOSES ON THE SECOND PUBLISH'S OWN LIST (2026-09-26): it read
  // `verifyCss: !!eJob`, the spelling that became the rules the message wrote.
  const region = CODE.slice(at(CODE, "const eCanFix =", "correct gate"),
                            at(CODE, "const cssVerify2 =", "correct gate end"));
  const gate = region.indexOf("canCorrect(");
  const call = region.indexOf("runLane(");
  // THE GATE MUST ASK THE BUDGET, not merely be named. A mutation replacing the
  // whole expression with `true` kept the variable and survived — the assertion
  // was about a spelling appearing in a window, which is not a gate.
  assert.ok(gate >= 0, "the correction gate no longer asks the budget whether a round can finish");
  assert.ok(call > gate, "the correction round starts before the budget is consulted");
  assert.match(region, /editStopped/, "a refused correction no longer ends the job properly");
});

// ── THE SYNCHRONOUS PATH IS UNCHANGED ─────────────────────────────────────

test("every async mechanism is reached only through a job that may be null", () => {
  // THE ROLLBACK PROOF, and the reason it is stated as a property rather than a
  // diff: with the flag off `eJob` is null at the fork, so each of these is an
  // `if` that does not fire. A mechanism reached unconditionally would change
  // the synchronous path — which is the one thing this commit must not do.
  for (const [name, needle] of [
    ["the publish gate", "edit_may_publish"],
    ["the commit point", "edit_committed"],
    ["the deployment identity", "edit_publish_mark"],
  ]) {
    const i = at(CODE, needle, name);
    const before = CODE.slice(Math.max(0, i - 400), i);
    // `if (job` or its inverse `if (!job) return` — the commit rides inside the
    // activation's own closure since stage 7 (2026-09-05), and an early return
    // is the same gate written the other way round.
    assert.match(before, /if \(job|if \(!job\) return/, `${name} is not gated on a job being present`);
  }
  // AND THE GUARD IS THE JOB, WITH NOTHING ELSE IN IT. A sweep that turned one
  // of these into `if (job && false)` survived an order assertion perfectly: the
  // call had not moved, it had simply become unreachable. So the condition
  // itself is read, and a disabled branch is what this catches.
  const spine = CODE.slice(at(CODE, "async function recompileAndPublish", "spine"),
                           at(CODE, "async function siteOgImage", "spine end"));
  const rpcs = [...spine.matchAll(/editRpc\(env, "edit_/g)].map((m) => m.index);
  assert.ok(rpcs.length >= 3, `only ${rpcs.length} async mechanisms found in the spine`);
  for (const i of rpcs) {
    const before = spine.slice(Math.max(0, i - 400), i);
    const cond = lastCondition(before);
    assert.ok(cond, "an async mechanism in the spine sits under no condition at all");
    assert.match(cond, /\bjob\b/, `an async mechanism is guarded by "${cond}", which does not mention the job`);
    // A LITERAL `false` OPERAND, NOT THE WORD. The first draft rejected any
    // `false` in the condition and flagged
    // `job && !(wput && wput.uploaded === false)` — a real comparison, and
    // correct code. A check that teaches the next session away from something
    // that works is worse than no check, which is this repo's stated bar.
    assert.doesNotMatch(cond, /(^|&&|\|\|)\s*!?\s*false\s*(&&|\|\||$)/,
      `an async mechanism is guarded by "${cond}" — a disabled branch`);
  }

  // The billing fork keeps `collectCredits` reachable — that IS the synchronous
  // path's charge, and losing it would leave the flag-off route billing nothing.
  // RE-ANCHORED 2026-09-05 (stage 1a-iii): the bill is priced once into
  // `bill` so the funnel can tell a collect that took nothing from a bill of
  // nothing; the property is unchanged — the flag-off route charges through
  // `collectCredits`, on the caller's own token.
  assert.match(CODE, /collectCredits\(eAuth, bill\)/,
    "the synchronous edit no longer charges through collectCredits");
  const charge = CODE.slice(at(CODE, "const eCharge = async", "billing"), at(CODE, "const modelDown =", "billing end"));
  // BOTH ANCHORS PROVED FIRST. `indexOf` answers -1 for a missing one, and
  // `-1 < anything` is true — so an ordering assertion passes most convincingly
  // exactly when the thing it orders has been deleted. A sweep removing the
  // async fork survived on that, which is this repo's own vacuous-ordering trap.
  const forkAt = charge.indexOf("if (eJob)");
  const syncAt = charge.indexOf("collectCredits");
  assert.ok(forkAt >= 0, "the async billing fork is gone — a queued edit would charge through the customer's JWT");
  assert.ok(syncAt >= 0, "the synchronous charge is gone — a flag-off edit would bill nothing");
  assert.ok(forkAt < syncAt, "the async billing fork does not precede the synchronous charge, so both would run");
});

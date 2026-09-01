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
} from "../builder/edit-job.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

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

// ── THE MESSAGE ───────────────────────────────────────────────────────────

test("an edit message is read as an edit and nothing else is", () => {
  assert.deepEqual(readEditMessage({ kind: EDIT_JOB_KIND, id: "a".repeat(32) }), { kind: EDIT_JOB_KIND, id: "a".repeat(32) });
  // A BUILD MESSAGE IS NOT AN EDIT. Guessing here would put an edit through
  // `runQueuedSiteBuild`, which replays the request as a BUILD — a second design
  // call and a second charge on a job that has already been billed.
  assert.equal(readEditMessage({ kind: "site-build", id: "a".repeat(32) }), null);
  assert.equal(readEditMessage({ kind: EDIT_JOB_KIND }), null);
  assert.equal(readEditMessage({ kind: EDIT_JOB_KIND, id: "short" }), null);
  assert.equal(readEditMessage(null), null);
  // AND A NON-STRING ID IS REFUSED, NOT COERCED. `String(["a…"])` is `"a…"`.
  assert.equal(readEditMessage({ kind: EDIT_JOB_KIND, id: ["a".repeat(32)] }), null);
});

test("the queue dispatches an edit to the edit handler, never the build one", () => {
  const q = CODE.slice(at(CODE, "async queue(batch, env, ctx)", "queue"), at(CODE, "async function runLostEditJobs", "queue end"));
  const edit = q.indexOf("runQueuedSiteEdit");
  const build = q.indexOf("runQueuedSiteBuild");
  assert.ok(edit > 0 && build > 0, "a queue branch is missing");
  // ORDER IS THE PROPERTY. `readMessage` refuses a `site-edit` body, so today
  // either order works — but that is a fact about ANOTHER module one edit away
  // from changing, and the cost of being wrong is an edit replayed as a build.
  assert.ok(edit < build, "the build branch is tried before the edit branch");
});

// ── THE REPLAY ────────────────────────────────────────────────────────────

test("the replay carries the marker, and the marker is the base case", () => {
  const r = replayEditRequest({ url: "https://x/api/site/s/edit", auth: "Bearer t", body: '{"a":1}', job: "j1" });
  assert.equal(r.method, "POST");
  assert.equal(r.headers.get(REPLAY_HEADER), "j1");
  assert.equal(r.headers.get("authorization"), "Bearer t");
  assert.equal(r.headers.get("content-type"), "application/json");
  // NOTHING ELSE. `content-length` would describe a body that has been through
  // JSON, and any conditional header would apply to a request nobody awaits.
  assert.deepEqual([...r.headers.keys()].sort(), ["authorization", "content-type", REPLAY_HEADER]);
});

test("the fork checks the marker before the flag, so a replay cannot re-enqueue", () => {
  const fork = CODE.slice(at(CODE, "const eJobId = request.headers.get(REPLAY_HEADER)", "fork"),
                          at(CODE, "editTrace = newTrace(", "fork end"));
  // WITHOUT THE MARKER IN THE CONDITION the consumer's own replay reaches this
  // fork, sees the flag on, and files another job — for ever.
  assert.match(fork, /if \(!eJobId && editAsyncOn\(env\)\)/,
    "the fork no longer requires the marker to be ABSENT before enqueueing");
  assert.match(fork, /enqueueEditJob/, "the fork no longer enqueues");
});

test("the enqueue stores the request before it sends the message", () => {
  const fn = CODE.slice(at(CODE, "async function enqueueEditJob", "enqueue"),
                        at(CODE, "async function runQueuedSiteEdit", "enqueue end"));
  const row = fn.indexOf("edit_create");
  const store = fn.indexOf("SITES_BUCKET.put");
  const send = fn.indexOf("BUILD_QUEUE.send");
  assert.ok(row > 0 && store > row, "the job row is not created before the request is stored");
  assert.ok(send > store, "the message is sent before the request it names has been stored");
});

// ── THE CONSUMER ──────────────────────────────────────────────────────────

test("the consumer claims before it reads, spends or replays anything", () => {
  const fn = CODE.slice(at(CODE, "async function runQueuedSiteEdit", "consumer"),
                        at(CODE, "const EDIT_JOBS = new Map()", "consumer end"));
  const claim = fn.indexOf("edit_claim");
  assert.ok(claim > 0, "the consumer no longer claims the job");
  for (const later of ["SITES_BUCKET.get", "handleRequest(", "replayEditRequest"]) {
    assert.ok(fn.indexOf(later) > claim, `the consumer reaches ${later} before claiming — a duplicate delivery would too`);
  }
  // THE TOKEN GOES ONCE IT HAS BEEN READ. It is the customer's own bearer token.
  assert.ok(fn.indexOf("SITES_BUCKET.delete") > fn.indexOf("SITES_BUCKET.get"),
    "the stored request is deleted before it is read, or not at all");
  // AND THE HEARTBEAT IS A TIMER. A boundary-only heartbeat expires during every
  // container call, which is a single await of up to ten minutes.
  assert.match(fn, /setInterval\(/, "the heartbeat is not a timer — it would expire inside the container call");
  assert.match(fn, /clearInterval\(/, "the heartbeat timer is never cleared");
});

test("the consumer cannot throw out of the queue handler", () => {
  const fn = CODE.slice(at(CODE, "async function runQueuedSiteEdit", "consumer"),
                        at(CODE, "const EDIT_JOBS = new Map()", "consumer end"));
  // A throw is a message the runtime may redeliver, and a redelivered edit is a
  // second set of model calls on a job that has already been charged.
  assert.match(fn, /\} catch \(e\) \{/, "the consumer has no catch");
  assert.match(fn, /\} finally \{/, "the consumer has no finally — the heartbeat would outlive it");
});

// ── THE GATES ─────────────────────────────────────────────────────────────

test("the publish gate precedes every R2 write in the spine", () => {
  const spine = CODE.slice(at(CODE, "async function recompileAndPublish", "spine"),
                           at(CODE, "async function siteRedirectFor", "spine end"));
  const gate = spine.indexOf("edit_may_publish");
  const dist = spine.indexOf("writeSiteDistToR2");
  const source = spine.indexOf("saveSiteSource");
  const put = spine.indexOf("putSiteWorker");
  assert.ok(gate > 0, "the publish gate is gone from the spine");
  // THE ORDER IS THE WHOLE GUARANTEE. A stale or cancelled consumer must lose
  // before anything is written, or "the live site is retained" stops being true.
  for (const [name, i] of [["writeSiteDistToR2", dist], ["saveSiteSource", source], ["putSiteWorker", put]]) {
    assert.ok(i > gate, `${name} runs before the publish gate — a stolen lease could still write`);
  }
  // AND THE COMMIT POINT IS RECORDED AFTER THE UPLOAD, never before: it is what
  // the two billing interlocks read, so recording it early would let a refund be
  // refused for a publication that had not happened.
  assert.ok(spine.indexOf("edit_committed") > put, "the commit point is recorded before the upload it attests to");
  // The deployment identity is written BEFORE the upload, which is the opposite
  // rule and for the opposite reason: recorded after, it would be missing on
  // exactly the failure it exists to resolve.
  assert.ok(spine.indexOf("edit_publish_mark") < put, "the deployment identity is written after the upload");
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
  const region = CODE.slice(at(CODE, "const eCanFix =", "correct gate"),
                            at(CODE, "verifyCss: !!eJob", "correct gate end"));
  const gate = region.indexOf("canCorrect(");
  const call = region.indexOf("runLane(");
  // THE GATE MUST ASK THE BUDGET, not merely be named. A mutation replacing the
  // whole expression with `true` kept the variable and survived — the assertion
  // was about a spelling appearing in a window, which is not a gate.
  assert.ok(gate >= 0, "the correction gate no longer asks the budget whether a round can finish");
  assert.ok(call > gate, "the correction round starts before the budget is consulted");
  assert.match(region, /editStopped/, "a refused correction no longer ends the job properly");
});

// ── THE CLOCKS, DRIVEN ────────────────────────────────────────────────────

test("a correction is refused exactly when it cannot finish", () => {
  let t = 0;
  const b = makeEditBudget(EDIT_JOB_MS, () => t);
  assert.equal(b.canCorrect(), true);
  t = EDIT_JOB_MS - CORRECT_FLOOR_MS + 1;
  assert.equal(b.canCorrect(), false);
  // AND THE PUBLISH RESERVE SURVIVES IT. Refusing the round is only safe because
  // there is still room to publish a build that DID verify — which is the
  // owner's rule: publish nothing unless the current build has passed.
  assert.ok(b.remaining() >= PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS,
    "a refused correction leaves no room to publish a verified build");
});

test("phase durations are durations, not timestamps", () => {
  // THE WHOLE REASON THIS FUNCTION EXISTS. The trace's numbers are
  // elapsed-since-job-start, so a percentile over them would be a percentile of
  // "how late in the job this happened" — a different quantity that looks
  // entirely plausible in a report.
  const events = [
    { p: "pick_lanes", s: "start", ms: 100 },
    { p: "pick_lanes", s: "ok", ms: 1600 },
    { p: "container", s: "start", ms: 2000 },
    { p: "container", s: "ok", ms: 62000 },
    { p: "publish", s: "start", ms: 62500 },
  ];
  assert.deepEqual(phaseDurations(events), { pick_lanes: 1500, container: 60000 });
  // A PHASE THAT NEVER FINISHED CONTRIBUTES NOTHING, not a zero: it is the one
  // that was running when the job died, and folding it in as 0ms would drag
  // every percentile down at the moment the evidence is about a job that ran long.
  assert.equal("publish" in phaseDurations(events), false);
  assert.deepEqual(phaseDurations(null), {});
  assert.deepEqual(phaseDurations([{ p: "x", s: "ok", ms: 5 }]), {});
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
    assert.match(before, /if \(job/, `${name} is not gated on a job being present`);
  }
  // AND THE GUARD IS THE JOB, WITH NOTHING ELSE IN IT. A sweep that turned one
  // of these into `if (job && false)` survived an order assertion perfectly: the
  // call had not moved, it had simply become unreachable. So the condition
  // itself is read, and a disabled branch is what this catches.
  const spine = CODE.slice(at(CODE, "async function recompileAndPublish", "spine"),
                           at(CODE, "async function siteRedirectFor", "spine end"));
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
  assert.match(CODE, /collectCredits\(eAuth, pageCredits\(\.\.\.parts\)\)/,
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

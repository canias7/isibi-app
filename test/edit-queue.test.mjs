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
} from "../builder/edit-job.mjs";

const ID = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
const SEC = "0f1e2d3c4b5a69780f1e2d3c4b5a6978";

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

test("the replay carries the marker and NO bearer token", () => {
  const r = replayEditRequest({ url: "https://x/api/site/s/edit", body: '{"a":1}', marker: packReplayMarker(ID, SEC) });
  assert.equal(r.method, "POST");
  assert.equal(r.headers.get(REPLAY_HEADER), ID + "." + SEC);
  assert.equal(r.headers.get("content-type"), "application/json");
  // ── THE ABSENT HEADER IS THE POINT ──────────────────────────────────────
  //
  // A queued edit does not carry the customer's token, so it cannot fail
  // because one expired while the job sat in the queue, and there is no live
  // credential at rest to leak. Asserted as an exhaustive header list rather
  // than "authorization is absent", because the next header somebody adds
  // should have to be argued for.
  assert.deepEqual([...r.headers.keys()].sort(), ["content-type", REPLAY_HEADER]);
});

test("the fork REFUSES a marker it cannot verify, rather than falling through", () => {
  const fork = CODE.slice(at(CODE, "const eRawMarker = request.headers.get(REPLAY_HEADER)", "fork"),
                          at(CODE, "editTrace = newTrace(", "fork end"));
  // THE HOLE THIS CLOSES WAS REAL. The first cut asked whether the header was
  // PRESENT, so any signed-in owner could send one and drop into the inline
  // pipeline — past the queue, the budget, the lease, and `edit_create`, which
  // is the only place a site under `needs_review` is stopped.
  assert.match(fork, /if \(eRawMarker && !eJob\) return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\)/,
    "an unverifiable replay marker no longer refuses the request");
  // AND THE ENQUEUE IS GATED ON THE VERIFIED JOB, not on the raw header — or a
  // forged one would still skip it.
  // GATED ON THE VERIFIED JOB, whatever decides the flag. This pinned
  // `editAsyncOn(env)` and went red when a canary allowlist replaced it with
  // `editAsyncFor(env, …)` — the gate had not moved, only what follows it. The
  // property is `!eJob`: a forged header must not be able to skip the enqueue.
  assert.match(fork, /if \(!eJob && editAsync[A-Za-z]*\(env/,
    "the enqueue is gated on the raw header again, so a forged one would skip it");
  assert.doesNotMatch(fork, /if \(!eRawMarker && editAsync/,
    "the enqueue is gated on the raw header, which a forger controls");
  assert.match(fork, /enqueueEditJob/, "the fork no longer enqueues");
});

// ── THE TRUST BOUNDARY ────────────────────────────────────────────────────

test("a marker is two halves and both must be exactly right", () => {
  assert.deepEqual(readReplayMarker(ID + "." + SEC), { id: ID, secret: SEC });
  // A HEADER NAME AND A JOB ID ARE PUBLIC. The id is handed to the customer in
  // the 202, so anything they can assemble from it alone must be refused.
  assert.equal(readReplayMarker(ID), null, "a bare job id parses as a marker");
  assert.equal(readReplayMarker(ID + "."), null);
  assert.equal(readReplayMarker("." + SEC), null);
  assert.equal(readReplayMarker(ID + "." + SEC.slice(0, 31)), null, "a short secret parses");
  assert.equal(readReplayMarker(ID.toUpperCase() + "." + SEC), null, "case is not pinned, so a near-miss parses");
  assert.equal(readReplayMarker(""), null);
  assert.equal(readReplayMarker(null), null);
  // AND A NON-STRING IS REFUSED, NOT COERCED.
  assert.equal(readReplayMarker([ID + "." + SEC]), null);
});

test("the secret is minted from real randomness and is not derivable", () => {
  // 128 BITS FROM THE PLATFORM'S CSPRNG. The fill function is injected so this
  // can assert the LENGTH the caller must supply rather than trusting it.
  let asked = 0;
  const sec = newReplaySecret((b) => { asked = b.length; b.fill(0xab); });
  assert.equal(asked, 16, "the secret is drawn from fewer than 128 bits");
  assert.match(sec, /^[0-9a-f]{32}$/);
  assert.equal(sec, "ab".repeat(16));
  // It is called with crypto.getRandomValues in the Worker — asserted at the
  // call site below, because that is the half a fake cannot prove.
  assert.match(CODE, /newReplaySecret\(\(b\) => crypto\.getRandomValues\(b\)\)/,
    "the replay secret is no longer drawn from the platform CSPRNG");
});

test("the stored job carries the identity and NOT a bearer token", () => {
  const packed = packEditJob({ url: "https://x/y", body: "{}", uid: "u1", slug: "S1", secret: SEC, at: 5 });
  assert.deepEqual(packed, { v: 1, url: "https://x/y", body: "{}", uid: "u1", slug: "s1", secret: SEC, at: 5 });
  // NO `auth` FIELD EXISTS TO FILL. The build path's packJob keeps one because
  // `use_credits` resolves the user from auth.uid() and a service key cannot
  // charge on somebody's behalf; an async edit's money moves through
  // service-role RPCs that take the uid, so the token buys nothing.
  assert.equal("auth" in packed, false, "the stored edit job has somewhere to put a bearer token");
  assert.ok(!/auth/i.test(JSON.stringify(packed)), "a credential-shaped field survived");
  // The slug is normalised on the way in, so the consumer's comparison against
  // the row is between two values that were lowercased by the same rule.
  assert.equal(packed.slug, "s1");
  // AND IT REFUSES ANY SHAPE WE DID NOT WRITE.
  assert.equal(readEditJob({ ...packed, v: 2 }), null);
  assert.equal(readEditJob({ ...packed, secret: "short" }), null);
  assert.equal(readEditJob({ ...packed, uid: "" }), null);
  assert.equal(readEditJob(null), null);
  assert.deepEqual(readEditJob(packed), { url: "https://x/y", body: "{}", uid: "u1", slug: "s1", secret: SEC, at: 5 });
});

test("the replay identity is scoped to one uid, one slug, one running job", () => {
  const fn = between(CODE, "function editReplayUser(request, slug)", "async function recordRefire", "replay user");
  // FOUR CHECKS, and each closes a different hole. Asserted as properties of the
  // function's text because there is no Worker runtime here to drive it — but
  // every one of them is a comparison this file can name exactly.
  assert.match(fn, /readReplayMarker\(/, "the marker is no longer parsed");
  assert.match(fn, /EDIT_JOBS\.get\(m\.secret\)/, "the lookup is no longer by the secret");
  assert.match(fn, /j\.id !== m\.id/, "a secret is no longer tied to the job it was minted for");
  assert.match(fn, /j\.slug !== String\(slug/, "the grant is no longer scoped to one slug");
  assert.match(fn, /return \{ id: j\.uid/, "the identity no longer comes from the job's stored uid");
  // AND IT IS NOT A SESSION. Nothing here reads a cookie, a token or a header
  // other than the marker itself.
  assert.doesNotMatch(fn, /Authorization|authUser|cookie/i, "the replay identity reaches for a credential");
});

test("the replay identity is offered to the EDIT route and to no other", () => {
  // THIS BLOCK GATES NINETEEN ROUTES. Without the route check a replay marker
  // would authenticate a request to the domains panel, the secrets editor or
  // the delete route — the same grant, aimed anywhere.
  const auth = CODE.slice(at(CODE, "const eReplay = ed ?", "auth"), at(CODE, "const ownerDeps = {", "auth end"));
  assert.match(auth, /const eReplay = ed \? editReplayUser\(request, ownerSlug\) : null;/,
    "the replay identity is no longer restricted to the edit route");
  assert.match(auth, /const ou = \(await authUser\(request\)\) \|\| eReplay;/,
    "a real token no longer takes precedence over the replay identity");
  assert.match(auth, /if \(!ou\) return UNAUTHED\(\);/, "an unidentified request is no longer refused");
});

test("the consumer checks the stored request against the row it claimed", () => {
  const fn = CODE.slice(at(CODE, "async function runQueuedSiteEdit", "consumer"),
                        at(CODE, "const EDIT_JOBS = new Map()", "consumer end"));
  // THE ROW IS THE AUTHORITY. Until this check the claim came from Postgres and
  // the request came from R2 with nothing tying them together — a job object
  // whose uid or slug disagreed would have been replayed under a lease that says
  // nothing about whose site it is.
  assert.match(fn, /String\(claim\.uid \|\| ""\) !== job\.uid/, "the stored uid is no longer checked against the claim");
  assert.match(fn, /String\(claim\.slug \|\| ""\) !== job\.slug/, "the stored slug is no longer checked against the claim");
  const mismatch = fn.indexOf("String(claim.uid");
  const replay = fn.indexOf("replayEditRequest");
  assert.ok(mismatch > 0 && replay > mismatch, "the mismatch check runs after the replay it is meant to prevent");
  // AND THE MAP IS KEYED BY THE SECRET. Keyed by the id, a customer who knows
  // their own job id could look up its live context.
  assert.match(fn, /EDIT_JOBS\.set\(job\.secret,/, "the job map is keyed by something the customer knows");
  assert.match(fn, /EDIT_JOBS\.delete\(job\.secret\)/, "the map entry outlives the job under a different key");
});

test("the claim is what proves the job may run at all", () => {
  // Everything item 3 asks for is decided by ONE conditional UPDATE, which is
  // the only way these can be checked without a race: exists, not terminal, not
  // under review, not already settled, and the lease free to take.
  const sql = readFileSync(new URL("../supabase/applied/20260901110952_edit_job_rpcs.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("edit_claim"), "the claim RPC is not in the applied record");
  // The live definition is the one that matters and it is asserted by driving it
  // against the real database in the pre-flag checks; here the property is that
  // the consumer ACTS on the answer rather than assuming it.
  const fn = CODE.slice(at(CODE, "async function runQueuedSiteEdit", "consumer"),
                        at(CODE, "const EDIT_JOBS = new Map()", "consumer end"));
  assert.match(fn, /claim\.claimed !== true/, "the consumer no longer stops when the claim is refused");
  const claimAt = fn.indexOf("edit_claim");
  for (const later of ["SITES_BUCKET.get", "handleRequest(", "replayEditRequest", "EDIT_JOBS.set"]) {
    assert.ok(fn.indexOf(later) > claimAt, `${later} runs before the claim`);
  }
});

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

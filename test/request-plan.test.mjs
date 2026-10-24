// THE REQUEST'S DECISIONS, DRIVEN WITH LITERALS (2026-10-03, the combined
// request flow). `builder/request.mjs` holds every decision of the flow and
// touches no storage or network, so each one is driven here with the exact
// inputs: the plan a routing answer makes, the parts a job leaves for later,
// what a job's stored answer means for its part, which part may run, the job
// filed next, the bodies those jobs post, and what the page is shown. The
// grouped tests (test/request-flow.test.mjs) drive the same decisions through
// the real Worker; these pin each branch on its own.
import test from "node:test";
import assert from "node:assert/strict";
import {
  planParts, carveParts, newRequest, readRequest, nextStep, settleState, answerless, readRun, readRoute, handOff,
  jobKey, readJobKey, parseLiveKey, liveKey, recordKey, isRequestKey, answerPart, askedAgain, cancelPart, noteJobId,
  noteFilingRefused, noteOffered, questionsToOffer, jobBody, readRequestOf, requestView, liveJobIds, doneSummary, RETRIES, WAIT_MS,
  LIVE_ROOT, SWEEP_CURSOR_KEY, chargedOf, notDoneOf, notePrepared, takePrep, partOf, SPLIT_MAX,
} from "../builder/request.mjs";
import { readDepends, readPartOf, partBlock, withPart, PART_HEADING } from "../builder/site-ask.mjs";
import { requestReplyFacts } from "../builder/site-reply.mjs";

const KEY = "rqunit000000000001";
const MSG = "Change the description to say we bake overnight, and add a gallery page.";
const ADD = "add a gallery page";
const row = (state, result, more = {}) => ({ ok: true, state, billing: "finalized", needs_review: false, result: result === undefined ? null : { status: 200, body: JSON.stringify(result) }, ...more });
const rec0 = (routed = { intent: "edit", layer: "look", alsoAsked: [ADD] }, message = MSG) => {
  const planned = planParts(message, routed);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  return newRequest({ key: KEY, uid: "u1", slug: "fold-lane", message, picker: "sonnet", tz: "Europe/London", accepted: routed, parts: planned.parts });
};
/** One step with the given rows by job key. */
const step = (rec, byKey = {}, now = Date.now()) => {
  const rows = {};
  for (const p of rec.parts) for (const j of p.jobs) if (j.id && byKey[j.key]) rows[j.id] = byKey[j.key];
  return nextStep(rec, rows, now);
};
const filed = (r, id) => noteJobId(r.record, r.file.key, id);

// ── THE PLAN ────────────────────────────────────────────────────────────────

test("plan: part 0 runs the routing answer on the whole message with its held parts beside it; each held part is its own, routed later", () => {
  const r = planParts(MSG, { intent: "edit", layer: "look", alsoAsked: [ADD], cost: 2 });
  assert.equal(r.ok, true);
  assert.equal(r.parts.length, 2);
  const [p0, p1] = r.parts;
  assert.equal(p0.phase, "run");
  assert.equal(p0.route.layer, "look");
  assert.equal(p0.route.cost, 2);
  assert.equal(p0.runs, MSG);
  assert.deepEqual(p0.held, [ADD]);
  assert.equal(p0.shown, "Change the description to say we bake overnight, and …");
  assert.equal(p1.words, ADD);
  assert.equal(p1.phase, "route");
  assert.equal(p1.route, null);
  assert.deepEqual(r.parts.map((p) => p.status), ["ready", "ready"]);
});

test("plan: a held part that is not the customer's own words, or that cannot be read, plans nothing at all", () => {
  assert.deepEqual(planParts(MSG, { intent: "edit", alsoAsked: ["add a contact form"] }), { ok: false, why: "held-not-found" });
  assert.deepEqual(planParts(MSG, { intent: "edit", alsoAsked: [7] }), { ok: false, why: "held-unread" });
  assert.deepEqual(planParts(MSG, { intent: "edit" }, { putOff: [7] }), { ok: false, why: "put-off-unread" });
});

test("plan: a part put off by an earlier question joins as its own; the model's relations are taken as numbered, a held part inside another folded into it", () => {
  const m = "Change the description, add a gallery page with a map of the bakery, and add a contact form.";
  const r = planParts(m, { intent: "edit", alsoAsked: ["add a gallery page with a map of the bakery", "a map of the bakery"], dependsOn: [{ change: 0, after: [2] }] }, { putOff: ["add a contact form"] });
  assert.equal(r.ok, true);
  // THE INNER HELD PART IS THE OUTER ONE: three parts, not four.
  assert.deepEqual(r.parts.map((p) => p.words), [r.parts[0].words, "add a gallery page with a map of the bakery", "add a contact form"]);
  assert.equal(r.parts[2].source, "put-off");
  // change 0 needs held #2 (the inner one), which is part 1: part 0 waits for it, and is routed again.
  assert.deepEqual(r.parts[0].needs, [1]);
  assert.equal(r.parts[0].phase, "route");
  assert.equal(r.parts[0].runs, null);
  assert.deepEqual(r.parts[0].held, []);
  assert.deepEqual(r.parts.map((p) => p.status), ["blocked", "ready", "ready"]);
});

test("plan: parts whose relations form a cycle are refused, each said, and no order is guessed", () => {
  const r = planParts(MSG, { intent: "edit", alsoAsked: [ADD], dependsOn: [{ change: 0, after: [1] }, { change: 1, after: [0] }] });
  assert.deepEqual(r.parts.map((p) => [p.status, p.why]), [["refused", "order-unclear"], ["refused", "order-unclear"]]);
});

test("relations: read whole or not at all — a change that is not there, or one that needs itself, leaves the parts with no stated order", () => {
  const trace = [];
  assert.deepEqual(readDepends({ dependsOn: [{ change: 1, after: [0, 0] }, { change: 1, after: [2] }] }, 2), [{ change: 1, after: [0, 2] }]);
  assert.deepEqual(readDepends({ dependsOn: [{ change: 1, after: [3] }] }, 2, trace), []);
  assert.deepEqual(readDepends({ dependsOn: [{ change: 1, after: [1] }] }, 2), []);
  assert.deepEqual(readDepends({ dependsOn: "after" }, 2), []);
  assert.deepEqual(readDepends({}, 2), []);
});

// ── WHAT A JOB'S ANSWER MEANS ───────────────────────────────────────────────

test("answers: a run job's hand-over, climb, question, refusal and success are read as the page reads them; anything else is unknown", () => {
  assert.deepEqual(readRun({ status: 200, body: { ok: false, escalate: true, layer: "text", reason: "no-backend" } }), { act: "hop", layer: "text", page: "", reason: "no-backend", field: "", deferred: [] });
  assert.equal(readRun({ status: 200, body: { ok: false, escalate: true, reason: "too-much-text" } }).act, "climb");
  assert.equal(readRun({ status: 503, body: { ok: false, escalate: true, layer: "text" } }).act, "unknown");
  assert.equal(readRun({ status: 200, body: { ok: false, error: "clarify", clarify: { id: "a".repeat(32), text: "Which?", options: ["A"] } } }).act, "clarify");
  assert.equal(readRun({ status: 422, body: { ok: false, error: "no-page", msg: "x" } }).act, "refusal");
  assert.equal(readRun({ status: 200, body: { ok: true, recovered: true } }).act, "recovered");
  assert.deepEqual(readRun({ status: 200, body: { ok: true, deferred: ["a"] } }), { act: "success", ask: null, deferred: ["a"] });
  assert.equal(readRun({ status: 500, body: { ok: true } }).act, "unknown");
  assert.equal(readRun({ status: 200, body: { ok: "true" } }).act, "unknown");
  assert.equal(readRoute({ status: 200, body: { ok: true, intent: "addon", alsoAsked: ["x"], dependsOn: [{ change: 1, after: [0] }] } }).act, "route");
  assert.equal(readRoute({ status: 200, body: { ok: true, intent: "build" } }).act, "rewrite");
  assert.equal(readRoute({ status: 200, body: { ok: true, intent: "ask", answer: "Yes." } }).answer, "Yes.");
  assert.equal(readRoute({ status: 200, body: { ok: true, failed: true, intent: "addon" } }).act, "failed");
  assert.equal(readRoute({ status: 200, body: { ok: true, intent: "clarify", question: { id: "b".repeat(32), text: "Which?" }, questionFor: { request: "r", stage: "route", round: 1, queued: true } } }).ask.queued, true);
  assert.equal(readRoute({ status: 200, body: { ok: false, error: "cancelled" } }).act, "refusal");
});

test("answers: a job that never ran to an answer is told apart from one that answered — stale, no container, shut down — and never when money was kept", () => {
  assert.equal(answerless(row("failed", undefined, { billing: "none" })), true);
  assert.equal(answerless(row("failed", { ok: false, error: "stale" }, { billing: "refunded" })), true);
  assert.equal(answerless(row("failed", { ok: false, error: "no-container" }, { billing: "none" })), true);
  assert.equal(answerless(row("failed", { ok: false, error: "stopped" }, { billing: "refunded" })), true);
  assert.equal(answerless(row("failed", { ok: false, error: "no-page" }, { billing: "none" })), false);
  assert.equal(answerless(row("failed", undefined, { billing: "reserved" })), false);
  assert.equal(answerless(row("failed", undefined, { billing: "finalized" })), false);
  assert.equal(answerless(row("failed", undefined, { billing: "none", needs_review: true })), false);
  assert.equal(answerless(row("claimed", undefined, { billing: "none" })), false);
});

// ── THE NEXT STEP ───────────────────────────────────────────────────────────

test("next step: one job at a time, in the order the parts start; a finished part is settled from its job's answer, and the next part is routed", () => {
  let rec = rec0();
  let r = step(rec);
  assert.deepEqual(r.file, { n: 0, key: KEY + "-p0-1", kind: "run", op: "edit" });
  rec = filed(r, "j1");
  // WHILE IT RUNS, NOTHING ELSE IS FILED.
  r = step(rec, { [KEY + "-p0-1"]: row("editing") });
  assert.equal(r.file, null);
  assert.equal(r.record.parts[0].status, "started");
  r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: true, layer: "look", lanes: ["description"] }) });
  assert.equal(r.record.parts[0].status, "done");
  assert.deepEqual(r.file, { n: 1, key: KEY + "-p1-1", kind: "route", op: "route" });
  assert.equal(r.record.parts[0].done, "changed it with the look step");
});

test("next step: a routing job's answer gives its part a route; held parts of its own are carved beside it, and one it needs first makes it wait", () => {
  let rec = rec0();
  rec = filed(step(rec), "j1");
  let r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: true }) });
  rec = filed(r, "j2");
  // part 1's routing: an addition, holding back part of its own words that it needs first.
  const m2 = "Change the description, and add a gallery page with a map.";
  let rr = rec0({ intent: "edit", alsoAsked: ["add a gallery page with a map"] }, m2);
  rr = filed(step(rr), "k1");
  rr = filed(step(rr, { [KEY + "-p0-1"]: row("done", { ok: true }) }), "k2");
  const s3 = step(rr, { [KEY + "-p1-1"]: row("done", { ok: true, intent: "addon", alsoAsked: ["a map"], dependsOn: [{ change: 0, after: [1] }] }) });
  assert.equal(s3.record.parts.length, 3);
  assert.equal(s3.record.parts[2].words, "a map");
  assert.deepEqual(s3.record.parts[1].needs, [2]);
  assert.equal(s3.record.parts[1].phase, "route");
  assert.equal(s3.file.n, 2, "the part it needs first was not run first");
  assert.equal(r.record.parts[1].status, "queued");
});

test("A02-2 — a held entry skipped before the one a part needs first does not shift the need onto another part (routing job and answer)", () => {
  const m2 = "Change the description, and add a gallery page with a map.";
  // The first entry ends in a full stop, so it is not shorter than the part and is skipped.
  const also = ["add a gallery page with a map.", "a map"];
  let rr = rec0({ intent: "edit", alsoAsked: ["add a gallery page with a map"] }, m2);
  rr = filed(step(rr), "k1");
  rr = filed(step(rr, { [KEY + "-p0-1"]: row("done", { ok: true }) }), "k2");
  const s3 = step(rr, { [KEY + "-p1-1"]: row("done", { ok: true, intent: "addon", alsoAsked: also, dependsOn: [{ change: 0, after: [2] }] }) });
  assert.equal(s3.record.parts[2].words, "a map");
  assert.deepEqual(s3.record.parts[1].needs, [2], "the part needed first was dropped");
  assert.equal(s3.file.n, 2, "the part it needs first was not run first");
  // The same through an answer's routing: a paraphrased first entry is skipped.
  let ra = rec0({ intent: "edit", alsoAsked: ["add a gallery page with a map"] }, m2);
  ra = filed(step(ra), "q1");
  const Q = { id: "d".repeat(32), text: "Which?", options: [] };
  ra = step(ra, { [KEY + "-p0-1"]: row("done", { ok: false, error: "clarify", clarify: { ...Q, request: "Change the description", stage: "look", round: 1 } }) }).record;
  const a = answerPart(ra, 0, { routed: { intent: "edit", layer: "look", alsoAsked: ["alter the wording", "the description"], dependsOn: [{ change: 0, after: [2] }] }, round: 1 });
  const carved = a.parts.findIndex((q) => q.words === "the description");
  assert.ok(carved > 1, JSON.stringify(a.parts.map((q) => q.words)));
  assert.deepEqual(a.parts[0].needs, [carved], "the answer's part waits on the wrong part, or none");
  // An entry that already is a part is that part.
  const rec = rec0({ intent: "edit", alsoAsked: [ADD] });
  const made = carveParts(rec, 0, [ADD]);
  assert.deepEqual([made.length, made.byChange[1]], [0, 1]);
});

test("A37-3 — a part longer than the rewrite reads is never offered the go-ahead: it ends with that reason, at no cost; one within it is offered", () => {
  let rec = rec0({ intent: "edit", alsoAsked: [ADD] });
  rec = filed(step(rec), "j1");
  const Q = { id: "d".repeat(32), text: "Which?", options: [] };
  rec = step(rec, { [KEY + "-p0-1"]: row("done", { ok: false, error: "clarify", clarify: { ...Q, request: "Change the description", stage: "look", round: 1 } }) }).record;
  const long = "Redo the whole site around this: " + "we bake overnight. ".repeat(250);
  assert.ok(long.length > 4000);
  const a = answerPart(rec, 0, { routed: { intent: "build" }, resume: long, round: 1 });
  assert.deepEqual([a.parts[0].status, a.parts[0].why], ["failed", "rewrite-too-long"]);
  assert.equal(a.parts[0].approvalAt, undefined, "it was offered");
  const said = requestReplyFacts({ parts: [{ n: 0, words: "part 0", jobs: [], status: "failed", why: "rewrite-too-long" }] }).facts.map((x) => x.text).join(" | ");
  assert.match(said, /reads at most 4,000 characters/);
  const b = answerPart(rec, 0, { routed: { intent: "build" }, resume: long.slice(0, 4000), round: 1 });
  assert.equal(b.parts[0].status, "approval", "a part within the bound was not offered");
});

test("next step: a part's routing that fails is asked once more, then fails; one with no answer at all likewise — and a prerequisite that fails leaves what needed it not run", () => {
  // THE NEED NAMES WHAT IT USES (2026-10-24, request-needs): the page the addition makes.
  let rec = rec0({ intent: "edit", alsoAsked: [ADD], dependsOn: [{ change: 0, after: [1] }], targets: [{ change: 1, writes: ["new-page:/gallery"] }, { change: 0, reads: ["page:/gallery"] }] });
  let r = step(rec);
  assert.equal(r.file.n, 1);
  rec = filed(r, "j1");
  r = step(rec, { [KEY + "-p1-1"]: row("done", { ok: true, failed: true, intent: "addon" }) });
  assert.equal(r.record.parts[1].retries, RETRIES);
  assert.equal(r.file.key, KEY + "-p1-2");
  rec = filed(r, "j2");
  r = step(rec, { [KEY + "-p1-2"]: row("done", { ok: true, failed: true, intent: "addon" }) });
  assert.deepEqual([r.record.parts[1].status, r.record.parts[1].why], ["failed", "routing-failed"]);
  assert.deepEqual([r.record.parts[0].status, r.record.parts[0].why], ["not-run", "needs:1"]);
  assert.deepEqual(r.record.parts[0].missing, ["page:/gallery"]);
  assert.equal(r.record.state, "failed");
  assert.equal(r.record.ended, true);
});

test("next step: a stop cancels what has not started, files nothing new, and a job chosen before the stop and never filed is filed so its id can be cancelled", () => {
  let rec = rec0();
  let r = step(rec);
  // THE FILER DIED: the job is on the record with no id.
  rec = { ...r.record, stop: true };
  r = step(rec);
  assert.equal(r.file && r.file.key, KEY + "-p0-1", "a job chosen before the stop was not filed to learn its id");
  assert.equal(r.record.parts[1].status, "cancelled");
  assert.equal(r.record.parts[1].why, "stopped");
  rec = filed(r, "j1");
  r = step(rec, { [KEY + "-p0-1"]: row("failed", { ok: false, error: "compile", detail: "cancelled" }, { billing: "refunded" }) });
  assert.deepEqual(r.record.parts.map((p) => p.status), ["cancelled", "cancelled"]);
  assert.equal(r.record.state, "stopped");
  assert.equal(r.file, null);
});

test("next step: a part waiting on its question lets an independent part run; it expires after a day, and what needed it is not run", () => {
  let rec = rec0({ intent: "edit", alsoAsked: [ADD] });
  rec = filed(step(rec), "j1");
  const Q = { id: "c".repeat(32), text: "Which?", options: ["A", "B"] };
  let r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: false, error: "clarify", clarify: { ...Q, request: "Change it", stage: "look", round: 1, queued: false } }) });
  assert.equal(r.record.parts[0].status, "waiting");
  assert.equal(r.record.parts[0].question.request, "Change it");
  assert.equal(r.file.n, 1, "the independent part did not go ahead");
  r = step({ ...r.record }, {}, Date.now() + WAIT_MS + 1);
  assert.deepEqual([r.record.parts[0].status, r.record.parts[0].why], ["expired", "unanswered"]);
});

test("next step: a job under review holds the request — nothing else is filed — and a job the sweep kept as published is done, unrecorded", () => {
  let rec = rec0();
  rec = filed(step(rec), "j1");
  let r = step(rec, { [KEY + "-p0-1"]: row("publishing", undefined, { needs_review: true }) });
  assert.equal(r.record.parts[0].status, "unverified");
  assert.equal(r.record.state, "review");
  assert.equal(r.file, null);
  r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: true, recovered: true, job: "j1" }) });
  assert.deepEqual([r.record.parts[0].status, r.record.parts[0].why], ["done", "unrecorded"]);
  r = step(rec, { [KEY + "-p0-1"]: row("done", undefined) });
  assert.deepEqual([r.record.parts[0].status, r.record.parts[0].why], ["done", "unrecorded"]);
});

test("next step: a hand-over files the next step with the same words, marked; a second hand-over is too big for the smaller steps and ends, never offered the full rewrite (owner, 2026-10-24)", () => {
  let rec = rec0({ intent: "edit", layer: "data", alsoAsked: [ADD] });
  rec = filed(step(rec), "j1");
  let r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: false, escalate: true, layer: "text", reason: "no-backend" }) });
  assert.deepEqual(r.file, { n: 0, key: KEY + "-p0-2", kind: "run", op: "edit" });
  assert.equal(r.record.parts[0].route.layer, "text");
  assert.equal(r.record.parts[0].route.handedOff, true);
  rec = filed(r, "j2");
  // ⚠ RE-ANCHORED 2026-10-24 (auto-split): below the bound the part splits
  // itself (routed again, `splitAsk`); at the bound it ends as before.
  const below = step(rec, { [KEY + "-p0-2"]: row("done", { ok: false, escalate: true, layer: "look", reason: "x" }) });
  assert.deepEqual([below.record.parts[0].status, below.record.parts[0].phase, below.record.parts[0].splitAsk], ["queued", "route", { why: "handed-off", reason: "x" }]);
  rec.parts[0].splitDepth = SPLIT_MAX;
  r = step(rec, { [KEY + "-p0-2"]: row("done", { ok: false, escalate: true, layer: "look", reason: "x" }) });
  // NO GO-AHEAD FOR THE FULL REWRITE (owner, 2026-10-24): too big for the
  // smaller steps, said and ended; the request goes on for the other part.
  assert.deepEqual([r.record.parts[0].status, r.record.parts[0].why, r.record.parts[0].split], ["failed", "too-big", "handed-off"]);
  assert.equal(r.record.parts[0].approvalAt, undefined, "the full rewrite was offered");
  assert.equal(r.record.ended, false);
  // RE-ANCHORED 2026-10-08 (the parallel-tasks batch): the independent part's
  // routing is prepared beside the first part's job, and the part is filed
  // when that preparation answers — filed before, its job would make the same
  // call again. Still: it goes ahead while the first part waits.
  let go = r;
  if (!go.file) {
    const p1 = go.record.parts[1];
    assert.equal(p1.prep && p1.prep.state, "attempting", "the independent part was neither filed nor being prepared");
    const took = takePrep(go.record, 1, p1.prep.seq, "c1");
    go = nextStep(notePrepared(took.record, 1, p1.prep.seq, { ok: true, outcome: "routed", owner: "c1" }).record, {});
  }
  assert.equal(go.file && go.file.n, 1, "the independent part did not go ahead");
  // THE PAGE IS SHOWN NO HAND-OVER JOB AS A PART'S REPLY.
  assert.deepEqual(requestView(r.record).parts[0].jobs, []);
  // NOTHING TO PRESS: no go-ahead is offered for it.
  assert.equal(requestView(r.record).parts[0].ask, undefined);
});

test("next step (owner, 2026-10-24): a climb is never the full rewrite — a site with no pages is offered its build tried again; any other climb ends too big", () => {
  // A SITE WHOSE FIRST BUILD NEVER FINISHED: the add-on's `no-source` climb.
  let rec = rec0({ intent: "addon" });
  rec = filed(step(rec), "j1");
  let r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: false, escalate: true, reason: "no-source", cost: 0 }) });
  assert.deepEqual([r.record.parts[0].status, r.record.parts[0].why, r.record.parts[0].retry], ["approval", "retry-build", true]);
  assert.equal(requestView(r.record).parts[0].retry, true, "the page cannot tell the retry from a rewrite");
  // AND A DAY WITHOUT A PRESS LAPSES, SAID AS THE RETRY.
  const lapsed = step({ ...r.record }, {}, Date.now() + WAIT_MS + 1).record;
  assert.deepEqual([lapsed.parts[0].status, lapsed.parts[0].why], ["expired", "unapproved"]);
  const lapsedSaid = requestReplyFacts(requestView(lapsed)).facts.map((x) => x.text).join(" | ");
  assert.match(lapsedSaid, /the build tried again, which it needed, was not given the go-ahead/);
  // ANY OTHER CLIMB: too big for the smaller steps, ended, no go-ahead.
  rec = rec0({ intent: "edit", layer: "text" });
  rec = filed(step(rec), "j1");
  // ⚠ RE-ANCHORED 2026-10-24 (auto-split): at the split bound.
  rec.parts[0].splitDepth = SPLIT_MAX;
  r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: false, escalate: true, reason: "too-much-text", cost: 0 }) });
  assert.deepEqual([r.record.parts[0].status, r.record.parts[0].why, r.record.parts[0].split], ["failed", "too-big", "climb"]);
  assert.equal(r.record.parts[0].approvalAt, undefined);
  const said = requestReplyFacts(requestView(r.record)).facts.map((x) => x.text).join(" | ");
  assert.match(said, /never rewritten for one change/);
  assert.doesNotMatch(said, /full rewrite/);
  // A CHAIN PAST THE BOUND AND A HAND-OVER TO ITS OWN LAYER: the same.
  assert.deepEqual(handOff({ act: "hop", layer: "text" }, { op: "edit", layer: "look", hops: 99 }), { act: "split", why: "hops" });
  assert.deepEqual(handOff({ act: "hop", layer: "look" }, { op: "edit", layer: "look" }), { act: "split", why: "same-layer" });
  assert.deepEqual(handOff({ act: "climb", reason: "no-source" }, { op: "edit", layer: "look" }), { act: "retry-build" });
});

// ── AN ANSWER, A QUESTION ASKED AGAIN, A QUESTION CANCELLED ──────────────────

test("answer: the waiting part runs with the decision read with the answer, its request what the answer must still do; held parts of the answer's routing are carved", () => {
  let rec = rec0({ intent: "edit", alsoAsked: [ADD] });
  rec = filed(step(rec), "j1");
  const Q = { id: "d".repeat(32), text: "Which?", options: [] };
  rec = step(rec, { [KEY + "-p0-1"]: row("done", { ok: false, error: "clarify", clarify: { ...Q, request: "Change the description to say we bake overnight", stage: "look", round: 1 } }) }).record;
  const a = answerPart(rec, 0, { routed: { intent: "edit", layer: "look", alsoAsked: ["say we bake overnight"] }, resume: "Change the description to say we bake overnight", context: [{ q: "Which?", a: "That one" }], round: 1 });
  assert.equal(a.parts[0].status, "ready");
  assert.equal(a.parts[0].resume, "Change the description to say we bake overnight");
  assert.deepEqual(a.context, [{ q: "Which?", a: "That one" }]);
  assert.equal(a.parts[2].words, "say we bake overnight");
  assert.equal(a.parts[2].parent, 0);
  // THE RUN SENDS THE ANSWER'S REQUEST, AND TAKES OUT ONLY WHAT IS IN IT.
  const b = jobBody(a, 0, "run", KEY + "-p0-9");
  assert.equal(b.body.instruction, "Change the description to say we bake overnight");
  assert.deepEqual(b.body.alsoAsked, "say we bake overnight");
  assert.equal(b.body.putOff, undefined);
  assert.equal(answerPart(rec, 1, { routed: { intent: "edit" } }), null, "a part not waiting took an answer");
  assert.equal(answerPart(rec, 0, { routed: { intent: "ask", answer: "Yes" } }).parts[0].status, "done");
  assert.equal(answerPart(rec, 0, { routed: { intent: "build" } }).parts[0].status, "approval");
  // A YES TO THE START-OVER QUESTION (2026-10-24): the go-ahead, marked for the route to record at once.
  const yes = answerPart(rec, 0, { routed: { intent: "build", startOver: true, confirmed: true } }).parts[0];
  assert.deepEqual([yes.status, yes.why, yes.confirmed], ["approval", "start-over", true]);
  assert.equal(answerPart(rec, 0, { routed: { intent: "build" } }).parts[0].confirmed, undefined, "a plain rebuild was read as confirmed");
  assert.equal(answerPart(rec, 0, { routed: { intent: "clarify" } }), null);
  // ASKED AGAIN: the part keeps waiting, on the new question.
  const q2 = { id: "e".repeat(32), text: "Which one, exactly?", options: ["A"], request: "r", stage: "route", round: 2 };
  const again = askedAgain(rec, 0, { ask: q2, context: [{ q: "Which?", a: "?" }] });
  assert.equal(again.parts[0].question.id, q2.id);
  assert.equal(again.parts[0].question.queued, false);
  // CANCELLED: that part ends there.
  const c = cancelPart(rec, 0, Q.id);
  assert.deepEqual([c.parts[0].status, c.parts[0].why], ["cancelled", "question-cancelled"]);
  assert.equal(cancelPart(rec, 0, "f".repeat(32)), null);
});

test("questions: a part's question waits its turn while another holds the slot, and is offered in the order parts asked", () => {
  const rec = rec0();
  rec.parts[0].status = "waiting"; rec.parts[0].question = { id: "1".repeat(32), text: "A?", request: "r", at: 2, queued: true };
  rec.parts[1].status = "waiting"; rec.parts[1].question = { id: "2".repeat(32), text: "B?", request: "r", at: 1, queued: true };
  assert.deepEqual(questionsToOffer(rec, null).map((p) => p.n), [1, 0]);
  assert.deepEqual(questionsToOffer(rec, { id: "2".repeat(32), status: "pending" }).map((p) => p.n), [0]);
  assert.deepEqual(questionsToOffer(rec, { id: "2".repeat(32), status: "answered" }).map((p) => p.n), [1, 0]);
  assert.equal(noteOffered(rec, 1, "2".repeat(32)).parts[1].question.queued, false);
  assert.equal(noteOffered(rec, 1, "x").parts[1].question.queued, true);
});

test("filing: an id is recorded once, under its own key; a site paused for review is said on the part, and cleared when the job is filed", () => {
  let rec = step(rec0()).record;
  const k = rec.parts[0].jobs[0].key;
  rec = noteFilingRefused(rec, k, "needs-review");
  assert.equal(rec.parts[0].why, "site-review");
  assert.equal(noteFilingRefused(rec0(), k, "queue").parts[0].why, null);
  rec = noteJobId(rec, k, "j1");
  assert.equal(rec.parts[0].jobs[0].id, "j1");
  assert.equal(rec.parts[0].why, null);
  assert.equal(noteJobId(rec, k, "j2").parts[0].jobs[0].id, "j1", "a recorded id was replaced");
  assert.deepEqual(liveJobIds(rec), ["j1"]);
});

// ── THE BODIES ──────────────────────────────────────────────────────────────

test("bodies: a part's routing job is routed against the site as it is then — the names kept at acceptance only as the fallback — and carries the whole request it came from", () => {
  const rec = newRequest({ key: KEY, uid: "u1", slug: "fold-lane", message: MSG, digest: { name: "N", pages: ["/"], tables: ["loaves"] }, parts: planParts(MSG, { intent: "edit", alsoAsked: [ADD] }).parts });
  const b = jobBody(rec, 1, "route", KEY + "-p1-1");
  assert.equal(b.url, "/api/site/route");
  // THE NAMES KNOWN AT ACCEPTANCE STAY AS THE FALLBACK (2026-10-23, audit A36-5).
  assert.deepEqual(b.body.site, { name: "N", pages: ["/"], tables: ["loaves"] });
  assert.equal(b.body.message, ADD);
  assert.equal(b.body.idem, KEY + "-p1-1");
  assert.equal(b.body.request.original, MSG);
  assert.equal(b.body.hasSite, true);
  assert.equal(b.body.firstBuild, false);
  // WHERE THE OTHER PART'S WORDS STAND (2026-10-12, run 137): part 0's words
  // are the message outside this part's, to the letter.
  const others = [[0, MSG.indexOf(ADD) - 1]];
  assert.equal(MSG.slice(...others[0]), "Change the description to say we bake overnight, and");
  assert.deepEqual(readRequestOf(b.body.request), { key: KEY, part: 1, original: MSG, done: [], others, context: [] });
});

test("bodies: what a replayed body says about its request is read with the size policy's bounds, or not at all", () => {
  assert.equal(readRequestOf({ key: "short", part: 0, original: "x", context: [] }), null);
  assert.equal(readRequestOf({ key: KEY, part: -1, original: "x", context: [] }), null);
  assert.equal(readRequestOf({ key: KEY, part: 0, original: "   ", context: [] }), null);
  assert.equal(readRequestOf({ key: KEY, part: 0, original: "x", context: "no" }), null);
  assert.equal(readRequestOf({ key: KEY, part: 0, original: "x".repeat(200000), context: [] }), null);
  assert.deepEqual(readRequestOf({ key: KEY, part: 0, original: " x ", done: [{ words: "a", said: "b" }, { words: 1 }], context: [] }).done, [{ words: "a", said: "b" }]);
});

test("the request a model is shown beside a part: its whole message and what the parts before it did, after everything else, or nothing for an ordinary message", () => {
  assert.equal(readPartOf(null), null);
  assert.equal(readPartOf({ original: "" }), null);
  const part = readPartOf({ original: MSG, done: [{ words: "change the description", said: "changed it with the look step" }] });
  assert.ok(part);
  const block = partBlock(part);
  assert.ok(block.includes(PART_HEADING) && block.includes(MSG) && block.includes("changed it with the look step"));
  const req = { messages: [{ role: "user", content: "THEIR MESSAGE:\nadd a gallery page" }] };
  assert.deepEqual(withPart(req, null), req);
  assert.ok(String(withPart(req, part).messages[0].content).endsWith(block.trimEnd()) || String(withPart(req, part).messages[0].content).includes(block.trim()));
});

test("ISO 1 — A PART IS SHOWN EVERY OTHER PART'S WORDS MARKED AS ANOTHER PART'S, AND ITS OWN NEVER (2026-10-12, run 137): the whole message stays whole, for its references", () => {
  const rec = newRequest({ key: KEY, uid: "u1", slug: "fold-lane", message: MSG, digest: { name: "N", pages: ["/"], tables: [] }, parts: planParts(MSG, { intent: "edit", alsoAsked: [ADD] }).parts });
  for (const [n, other, own] of [[0, ADD, "Change the description to say we bake overnight"], [1, "Change the description to say we bake overnight, and", ADD]]) {
    const block = partBlock(partOf(rec, n));
    assert.ok(block.includes("⟦ANOTHER PART: " + other + "⟧"), "part " + n + " was not shown the other part marked: " + block);
    const quoted = block.slice(block.indexOf("“") + 1, block.lastIndexOf("”"));
    assert.equal(quoted.split("⟦ANOTHER PART:").length, 2, "part " + n + ": one marked stretch, never its own words");
    assert.ok(!block.includes("⟦ANOTHER PART: " + own), "part " + n + "'s own words were marked as another part's");
    assert.ok(block.includes("Never make any change they ask for"), "part " + n + " was not told the marked words are not its work");
    assert.equal(quoted.replace(/⟦ANOTHER PART: |⟧/g, ""), MSG, "the message was not kept whole");
  }
  // A PLAIN MESSAGE, OR AN UNREADABLE LIST, IS SHOWN AS BEFORE: nothing marked.
  assert.ok(!partBlock({ original: MSG, done: [] }).includes("⟦"));
  for (const bad of [[[5, 2]], [[0, 9999]], [[0, 5], [3, 9]], [["0", 5]], "0-5", [[0.5, 3]]]) {
    assert.ok(!partBlock({ original: MSG, done: [], others: bad }).includes("⟦"), JSON.stringify(bad));
    assert.equal(readRequestOf({ key: KEY, part: 0, original: MSG, others: bad, context: [] }).others, undefined, JSON.stringify(bad));
  }
  // OFFSETS ARE READ ONLY AGAINST THE MESSAGE EXACTLY AS SENT.
  assert.ok(!partBlock({ original: " " + MSG, done: [], others: [[0, 5]] }).includes("⟦"));
  // A PART CARVED FROM ANOTHER: its parent's words hold its own, and its own are never marked.
  const M2 = "Add a gallery page with a short intro saying we bake overnight.";
  const r2 = newRequest({ key: KEY, uid: "u1", slug: "fold-lane", message: M2, digest: { name: "N", pages: ["/"], tables: [] }, parts: planParts(M2, { intent: "addon" }).parts });
  assert.deepEqual(carveParts(r2, 0, ["a short intro saying we bake overnight"]), [1]);
  assert.ok(!partBlock(partOf(r2, 1)).slice(0, partBlock(partOf(r2, 1)).lastIndexOf("”")).includes("⟦ANOTHER PART: a short intro"), "a carved part's own words were marked as another part's");
  assert.ok(!partBlock(partOf(r2, 1)).includes("⟦ANOTHER PART: Add a gallery page with a short intro"), "the parent holding the part's words was marked whole");
  // A REFUSED PART IS NO OTHER PART'S WORK: nothing of it is marked.
  rec.parts[1].status = "refused";
  assert.ok(!partBlock(partOf(rec, 0)).includes("⟦"));
});

// ── KEYS, RECORDS AND THE VIEW ──────────────────────────────────────────────

test("keys: every job of a request has its own key inside edit_create's bounds, read back exactly; markers and records are named under the site", () => {
  assert.equal(jobKey(KEY, 3, 12), KEY + "-p3-12");
  assert.deepEqual(readJobKey(KEY + "-p3-12"), { key: KEY, n: 3, seq: 12 });
  assert.equal(readJobKey("x".repeat(60) + "-p3-12"), null);
  assert.ok(/^[A-Za-z0-9_-]{16,64}$/.test(jobKey("a".repeat(40), 99, 99)));
  assert.equal(isRequestKey("a".repeat(15)), false);
  assert.deepEqual(parseLiveKey(liveKey("fold-lane", KEY)), { slug: "fold-lane", key: KEY });
  assert.equal(parseLiveKey("requests-live/fold-lane/" + KEY + "/x"), null);
  // A SITE CALLED "live" CANNOT REACH THE MARKERS: its records' prefix is not theirs.
  assert.ok(!liveKey("fold-lane", KEY).startsWith(recordKey("live", KEY).replace(/[^/]+$/, "")), "a site called live shares the markers' prefix");
  assert.ok(!SWEEP_CURSOR_KEY.startsWith(LIVE_ROOT), "the sweep's cursor sits among the markers it lists");
  assert.equal(recordKey("fold-lane", KEY), "requests/fold-lane/" + KEY + ".json");
});

test("records: a request is made only whole, and read back only in the shape it was written", () => {
  assert.equal(newRequest({ key: "bad", uid: "u", slug: "s", message: "m" }), null);
  assert.equal(newRequest({ key: KEY, uid: "", slug: "s", message: "m" }), null);
  assert.equal(newRequest({ key: KEY, uid: "u", slug: "S!", message: "m" }), null);
  assert.equal(newRequest({ key: KEY, uid: "u", slug: "s", message: "  " }), null);
  assert.equal(newRequest({ key: KEY, uid: "u", slug: "s", message: "m", context: "x" }), null);
  const rec = rec0();
  assert.deepEqual(readRequest(JSON.stringify(rec)), rec);
  assert.equal(readRequest("{"), null);
  assert.equal(readRequest({ ...rec, v: 2 }), null);
  assert.equal(readRequest({ ...rec, parts: [{ n: "0" }] }), null);
});

test("state: a request is running, waiting or in review while any part is, and ends done, partial, failed or stopped from its parts alone", () => {
  const rec = rec0();
  const at = (statuses, stop = false) => settleState({ ...rec, stop, ended: false, parts: rec.parts.map((p, i) => ({ ...p, status: statuses[i] })) }).state;
  assert.equal(at(["done", "done"]), "done");
  assert.equal(at(["done", "failed"]), "partial");
  assert.equal(at(["failed", "not-run"]), "failed");
  assert.equal(at(["cancelled", "cancelled"], true), "stopped");
  assert.equal(at(["done", "waiting"]), "waiting");
  assert.equal(at(["unverified", "ready"]), "review");
  assert.equal(at(["done", "queued"]), "running");
  assert.equal(at(["blocked", "waiting"]), "waiting");
});

test("the view: each part's words, status and why, its question while it waits, the jobs whose replies explain it — and nothing private", () => {
  let rec = rec0();
  rec = filed(step(rec), "j1");
  const r = step(rec, { [KEY + "-p0-1"]: row("done", { ok: true }) });
  const v = requestView(r.record);
  assert.deepEqual(v.parts.map((p) => [p.n, p.status]), [[0, "done"], [1, "queued"]]);
  assert.deepEqual(v.parts[0].jobs, ["j1"]);
  assert.equal(v.parts[0].words, "Change the description to say we bake overnight, and …");
  assert.equal(JSON.stringify(v).includes("u1"), false);
  assert.equal(Object.hasOwn(v, "files"), false);
});

test("a short account of what a part did, for the parts after it — from its job's answer, never the customer's words", () => {
  assert.equal(doneSummary({ added: ["src/routes/gallery.tsx"] }), "added the page /gallery");
  assert.equal(doneSummary({ removed: ["visit.tsx"], tables: ["orders"] }), "removed /visit; added the table orders");
  assert.equal(doneSummary({ steps: [{ status: "done", layer: "look" }, { status: "failed", layer: "page" }] }), "changed it with the look step");
  assert.equal(doneSummary({ addon: true }), "made the addition");
  assert.equal(doneSummary({}), "made the change");
});

test("the request's own reply facts: one per part, a part with its own reply named only as done, nothing to add when every part has one", () => {
  const view = (parts) => ({ parts: parts.map((p, n) => ({ n, words: "part " + n, jobs: [], ...p })) });
  assert.equal(requestReplyFacts(view([{ status: "done", jobs: ["j"] }, { status: "done", jobs: ["k"] }])).skip, "nothing-to-add");
  const f = requestReplyFacts(view([{ status: "done", jobs: ["j"] }, { status: "not-run", why: "needs:0" }, { status: "queued", why: "site-review" }])).facts.map((x) => x.text);
  // WHAT ITS STEP DID, NEVER "Done: <asked words>" (2026-10-23, fix-edit-flow).
  assert.match(f[0], /^Finished the part that asked for “part 0”\. Its own reply above says what changed\./);
  assert.match(f[1], /^Not started: “part 1”, because it needed “part 0” done first/);
  assert.match(f[2], /Their site takes no new changes until an earlier change that stopped part-way through publishing has been checked/);
});

test("money: a part's charge is its jobs' rows' — finalized reserves only — and the reply says it, never assuming nothing; the message's routing charge is said once", () => {
  // THE ROW SAYS, OR NOTHING DOES.
  assert.equal(chargedOf({ billing: "finalized", cost: 2 }), 2);
  for (const row of [{ billing: "refunded", cost: 2 }, { billing: "exempt", cost: 0 }, { billing: "none", cost: 0 }, { billing: "reserved", cost: 3 }, { billing: "finalized", cost: "2" }, null]) {
    assert.equal(chargedOf(row), 0, JSON.stringify(row));
  }
  // A PART'S CHARGE IN THE VIEW, from every job it ran: its routing and its runs.
  const r = nextStep(rec0({ intent: "edit", alsoAsked: [ADD], cost: 1 }), {}, 1);
  const rec = r.record;
  rec.routedCost = 1;
  rec.parts[1].jobs = [
    { key: "a", kind: "route", op: "route", id: "j1", end: { act: "route", cost: 1 } },
    { key: "b", kind: "run", op: "addon", id: "j2", end: { act: "cancelled", cost: 0 } },
  ];
  const v = requestView(rec);
  assert.equal(v.parts[1].charged, 1);
  assert.equal(v.parts[0].charged, 0);
  // PART 0 HAS A RUN ON THE ACCEPTING ANSWER THAT WILL WRITE A REPLY? Not yet: unsaid.
  assert.equal(v.routedUnsaid, 1, "the message's routing charge was taken as said by a reply that does not exist");
  rec.parts[0].jobs[0].id = "j0";
  rec.parts[0].jobs[0].end = { act: "success", cost: 2 };
  assert.equal(requestView(rec).routedUnsaid, 0, "part 0's own reply carries it");
  rec.parts[0].jobs.unshift({ key: "z", kind: "route", op: "route", id: "jz", end: { act: "route", cost: 1 } });
  assert.equal(requestView(rec).routedUnsaid, 1, "a part 0 routed again carries its own routing's charge, not the message's");
  // THE REPLY'S FACTS.
  const view = (parts, extra = {}) => ({ ...extra, parts: parts.map((p, n) => ({ n, words: "part " + n, jobs: [], ...p })) });
  const said = (vv) => requestReplyFacts(vv).facts.map((x) => x.text).join(" | ");
  assert.match(said(view([{ status: "done", jobs: ["j"], charged: 2 }, { status: "cancelled", why: "stopped", charged: 1 }])), /“part 1”\. The steps it had already taken were charged one credit\./);
  assert.match(said(view([{ status: "done", jobs: ["j"] }, { status: "cancelled", why: "question-cancelled", charged: 0 }])), /Cancelled with the question it asked, before it changed anything: “part 1”\. Nothing was charged for it\./);
  // CANNOT TELL IS NEVER NOTHING: no number, no claim.
  assert.doesNotMatch(said(view([{ status: "done", jobs: ["j"] }, { status: "cancelled", why: "stopped" }])), /charged/);
  assert.match(said(view([{ status: "not-run", why: "needs:1", charged: 0 }, { status: "failed", jobs: ["k"], charged: 3 }], { routedUnsaid: 1 })), /Reading their message cost one credit\./);
  // EVERY PART DONE WITH ITS OWN REPLY, BUT THE MESSAGE'S ROUTING UNSAID: the reply is still written, for that.
  const only = requestReplyFacts(view([{ status: "done", jobs: ["j"] }, { status: "done", jobs: ["k"] }], { routedUnsaid: 2 }));
  assert.equal(only.skip, null);
  assert.match(only.facts.map((x) => x.text).join(" | "), /Reading their message cost 2 credits\./);
});

test("partial outcomes: an ok answer that names what it did not do is partial, never done — and what needs it runs when what it needs exists", () => {
  // THE READER, PER KIND OF ANSWER.
  assert.deepEqual(notDoneOf({ ok: true, partial: [{ layer: "nav", page: "/visit", error: "no-menu" }, { layer: "look", ask: { text: "?" } }] }), [{ what: "/visit", why: "no-menu" }]);
  assert.deepEqual(notDoneOf({ ok: true, dropped: [{ label: "Old", why: "no-such-page" }, { label: "Twice", why: "duplicate" }] }), [{ what: "Old", why: "no-such-page" }]);
  assert.deepEqual(notDoneOf({ ok: true, failed: 2 }), [{ what: "2 rows", why: "failed" }]);
  assert.deepEqual(notDoneOf({ ok: true, skipped: ["frame"], notAdded: [{ kind: "row", why: "row-alone" }], declined: ["qr"] }, "addon"),
    [{ what: "row", why: "row-alone" }, { what: "qr", why: "declined" }, { what: "frame", why: "set-aside" }]);
  assert.deepEqual(notDoneOf({ ok: true, kinds: ["page"], skipped: [] }, "addon"), []);
  // AN EDIT'S `skipped` IS NOT AN ADDITION'S: read only where it means a kind set aside.
  assert.deepEqual(notDoneOf({ ok: true, skipped: ["frame"] }, "edit"), []);
  // THROUGH THE STEP (2026-10-24, request-needs): a partial part 0 that made
  // what the next part needs lets it run — gated on what was needed, never on
  // how the part ended overall.
  const MSG2 = "Add a gallery page with a link in the menu, then make the link say Photos.";
  const rec = rec0({ intent: "addon", alsoAsked: ["make the link say Photos"], dependsOn: [{ change: 1, after: [0] }] }, MSG2);
  let r = step(rec);
  r = { record: filed(r, "j0"), file: null };
  const job = r.record.parts[0].jobs[0];
  r = step(r.record, { [job.key]: row("done", { ok: true, kinds: ["page"], skipped: ["frame"], added: ["src/routes/gallery.tsx"] }) });
  assert.equal(r.record.parts[0].status, "partial");
  assert.deepEqual(r.record.parts[0].created, ["page:/gallery"]);
  assert.equal(r.record.parts[1].status, "queued");
  assert.equal(r.file && r.file.n, 1, "the part was held although the page it needs was made");
  // AND WORDS LEFT FOR LATER THAT NO PART HOLDS ARE NOT DONE EITHER.
  const rec2 = rec0({ intent: "addon" }, "Add a gallery page.");
  let s2 = step(rec2);
  s2 = { record: filed(s2, "j9"), file: null };
  const j2 = s2.record.parts[0].jobs[0];
  s2 = step(s2.record, { [j2.key]: row("done", { ok: true, kinds: ["page"], deferred: ["something nobody said"] }) });
  assert.equal(s2.record.parts[0].status, "partial");
  assert.deepEqual(s2.record.parts[0].notDone, [{ what: "something nobody said", why: "left-over" }]);
  // THE CUSTOMER'S OWN WORDS, BUT ALL OF THIS PART'S: no part can be carved
  // from them and none holds them, so they are not done either.
  const rec3 = rec0({ intent: "addon" }, "Add a gallery page.");
  let s3 = step(rec3);
  s3 = { record: filed(s3, "j8"), file: null };
  const j3 = s3.record.parts[0].jobs[0];
  const whole = s3.record.parts[0].words;
  s3 = step(s3.record, { [j3.key]: row("done", { ok: true, kinds: ["page"], deferred: [whole] }) });
  assert.equal(s3.record.parts.length, 1, "a part was carved from all of its parent's words");
  assert.equal(s3.record.parts[0].status, "partial");
  assert.deepEqual(s3.record.parts[0].notDone, [{ what: whole, why: "left-over" }]);
});

test("hand-overs: an unknown layer named by the add-on is not followed, and an escalate that is not one is unknown", () => {
  assert.deepEqual(handOff({ act: "success" }, { op: "edit" }), { act: "unknown" });
  assert.deepEqual(handOff({ act: "hop", layer: "nonsense" }, { op: "edit", layer: "look" }), { act: "unknown" });
});

test("a part carved from another is a part only when it is the customer's own words, shorter than its parent and not already a part", () => {
  const rec = rec0({ intent: "edit", alsoAsked: [ADD] });
  assert.deepEqual(carveParts(rec, 0, ["not in the message"]), []);
  assert.deepEqual(carveParts(rec, 0, [ADD]), [], "a part already there was carved again");
  assert.deepEqual(carveParts(rec, 0, [MSG]), [], "a part as long as its parent was carved");
  const made = carveParts(rec, 0, ["say we bake overnight"]);
  assert.deepEqual(made, [2]);
  assert.equal(rec.parts[2].parent, 0);
  assert.ok(rec.parts[0].held.includes("say we bake overnight"));
  assert.deepEqual(carveParts(rec, 9, ["x"]), []);
});

test("the view: a part the add-on step handed to an edit says so (`addition`), as its job's body does; a part routed straight to that edit does not", () => {
  const rec = rec0({ intent: "edit", layer: "nav", alsoAsked: [ADD] });
  rec.parts[0].route = { ...rec.parts[0].route, op: "edit", layer: "nav", fromAddon: true };
  assert.equal(requestView(rec).parts[0].addition, true);
  rec.parts[0].route = { ...rec.parts[0].route, fromAddon: false };
  assert.equal(Object.hasOwn(requestView(rec).parts[0], "addition"), false);
  rec.parts[0].route = { ...rec.parts[0].route, op: "addon", layer: "", fromAddon: true };
  assert.equal(Object.hasOwn(requestView(rec).parts[0], "addition"), false, "the add-on step's own part reads as an addition handed to an edit");
});

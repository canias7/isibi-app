// PARKED (2026-11-03, park-old-way): the old-way half of test/request-plan.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
} from "../../../builder/request.mjs";
import { readDepends, readPartOf, partBlock, withPart, PART_HEADING } from "../builder/site-ask.mjs";
import { requestReplyFacts } from "../../../builder/site-reply.mjs";

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

test("relations: read whole or not at all — a change that is not there, or one that needs itself, leaves the parts with no stated order", () => {
  const trace = [];
  assert.deepEqual(readDepends({ dependsOn: [{ change: 1, after: [0, 0] }, { change: 1, after: [2] }] }, 2), [{ change: 1, after: [0, 2] }]);
  assert.deepEqual(readDepends({ dependsOn: [{ change: 1, after: [3] }] }, 2, trace), []);
  assert.deepEqual(readDepends({ dependsOn: [{ change: 1, after: [1] }] }, 2), []);
  assert.deepEqual(readDepends({ dependsOn: "after" }, 2), []);
  assert.deepEqual(readDepends({}, 2), []);
});

// The two decisions run 14 got wrong, DRIVEN.
//
// ── WHY THESE ARE DRIVEN AND NOT READ ──────────────────────────────────────
//
// `test/edit-canary.test.mjs` reads `scripts/edit-canary.mjs` as SOURCE,
// because that file has top-level await and spends money — importing it to
// reach a function would run the harness. That is the right shape for asserting
// where a block sits, and it is the wrong shape for asserting what a decision
// ANSWERS: a source read cannot tell a wired reader from an unwired one, and
// this repo has shipped twelve features dead behind exactly that gap.
//
// So the two decisions live in `scripts/canary-watch.mjs` and this file runs
// them with literal inputs and a fake clock. Both defects reviewed out of run
// 14 would have been caught here and by nothing else in the suite:
//
//   * a blank instruction silently becoming a paid request for something else;
//   * a completed failure (HTTP 503 under `x-gf-edit: final`) read as a
//     transient poll failure and polled past until the watch ran out.
import test from "node:test";
import assert from "node:assert/strict";
import { EditPoll, readInstruction, instructionRefusal, watchEdit, watchReport } from "../scripts/canary-watch.mjs";
import { readFileSync } from "node:fs";

const CANARY_RAW = readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");

// A poll response in the shape `edit-canary.mjs`'s `call` really returns.
const res = (status, json, headers = {}) => ({ status, json, headers, text: JSON.stringify(json || null) });
const FINAL = { [EditPoll.FINAL_HEADER]: EditPoll.FINAL_VALUE };

// A fake clock: the watch must never really sleep, or a 260-poll timeout case
// takes thirteen minutes.
const noSleep = () => Promise.resolve();
const feed = (list) => {
  let n = 0;
  return () => Promise.resolve(list[Math.min(n++, list.length - 1)]);
};

// ── 1. A BLANK INSTRUCTION IS A REFUSAL, NOT A DEFAULT ─────────────────────

test("a missing, blank or unreadable instruction refuses rather than substituting one", () => {
  // Every one of these was a run that could be pressed before today, and the
  // first is exactly what run 14 was dispatched with.
  assert.equal(readInstruction(undefined).ok, false, "an absent env var must refuse");
  assert.equal(readInstruction("").ok, false, "an empty string must refuse");
  assert.equal(readInstruction("   \t\n ").ok, false, "whitespace must refuse — it looks filled in every form that shows it");

  // FAIL CLOSED ON A NON-STRING rather than coercing. `String(["a"])` is "a",
  // which this repo has shipped as a real bug three times; here it would be a
  // paid request assembled out of an array.
  assert.equal(readInstruction(["a"]).ok, false, "a non-string must refuse, never stringify");
  assert.equal(readInstruction(42).ok, false);
  assert.equal(readInstruction({}).ok, false);

  // The two operator mistakes are NAMED apart, because they are different
  // mistakes and the sentence for each is different.
  assert.equal(readInstruction("").why, "missing");
  assert.equal(readInstruction("  ").why, "blank");
  assert.equal(readInstruction(7).why, "not-a-string");

  // And a real ask survives, trimmed.
  const ok = readInstruction("  count down the places left  ");
  assert.equal(ok.ok, true);
  assert.equal(ok.instruction, "count down the places left", "the ask is trimmed, not rejected for its whitespace");
});

test("the refusal names the spend it is preventing, and every arm has a sentence", () => {
  for (const why of ["missing", "blank", "not-a-string"]) {
    const s = instructionRefusal(why);
    assert.match(s, /REFUSING TO SPEND/, `${why} must say what it is refusing`);
    assert.match(s, /CANARY_INSTRUCTION/, `${why} must name the field the operator can fix`);
    assert.ok(s.length > 60, `${why} must explain, not just decline`);
  }
  // The three sentences are three sentences — a single shared one would make
  // "nobody filled it in" and "it is not text" the same operator problem.
  const said = new Set(["missing", "blank", "not-a-string"].map(instructionRefusal));
  assert.equal(said.size, 3, "each refusal must be distinguishable from outside");
});

/**
 * Whole-line `//` comments blanked, length preserved.
 *
 * ⚠ NOT OPTIONAL, AND THIS FILE PROVED IT ON ITSELF. The census below forbids
 * a fallback on the instruction, and the first cut of `canary-watch.mjs`
 * EXPLAINED that defect in a comment that spelled it — so the guard reported
 * the paragraph arguing for the rule as a breach of it. Tenth-plus recorded
 * instance in this repo, several of them inside the guard written for the trap.
 *
 * Whole-line only, and that is deliberate rather than lazy: a scan that also
 * blanked trailing comments would have to track strings, and `chat.js`'s own
 * blanker records what a half-right one costs (a `//` inside a URL opening a
 * false block that ran 71,729 characters).
 */
function blankLineComments(src) {
  return src.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
}

test("THE HARNESS HAS NO INSTRUCTION DEFAULT AT ALL, and the gate is above the routing call", () => {
  const SRC = blankLineComments(CANARY_RAW);
  // THE OBSERVER IS PROVED ALIVE BEFORE ANY ABSENCE IS BELIEVED. A blanker
  // that erased the whole file would make the census below vacuously true.
  assert.ok(SRC.includes("CANARY_INSTRUCTION"), "the blanker must leave the code it is about to scan");

  // THE CENSUS IS THE PROPERTY: nothing anywhere supplies a fallback ask.
  const fallback = SRC.match(/CANARY_INSTRUCTION\s*(\|\||\?\?)/g) || [];
  assert.equal(fallback.length, 0, "a default on the instruction is the run-14 defect restored");

  // AND THE ORDER IS THE OTHER HALF. Routing is billed on its own — run 14
  // moved the balance by 2 for it and published nothing — so a gate below the
  // routing call is a gate that has already spent. Landmark to landmark, with
  // BOTH ends asserted, because `indexOf` answering -1 makes every comparison
  // below it vacuous.
  const gate = SRC.indexOf("readInstruction(process.env.CANARY_INSTRUCTION)");
  const route = SRC.indexOf('"/api/site/route"');
  // ⚠ THE EDIT POST IS SEARCHED FROM THE PAID HEADING, NOT FROM THE TOP. The
  // free half posts to the same route with an empty instruction — that is the
  // zero-cost async-shape confirmation — so a bare `indexOf` finds THAT one,
  // sits above the gate, and fails a correct file. `PAID CANARY EDIT` is the
  // section's own heading and survives the blanker because it is a string the
  // script prints, not a comment.
  const paid = SRC.indexOf("PAID CANARY EDIT");
  assert.ok(paid > 0, "the paid section's heading must exist — the observer is alive");
  const post = SRC.indexOf("${encodeURIComponent(CANARY)}/edit`", paid);
  assert.ok(gate > 0, "the instruction gate must exist");
  assert.ok(route > 0, "the routing call must exist — the observer is alive");
  assert.ok(post > paid, "the paid edit POST must sit inside the paid half — the observer is alive");
  assert.ok(gate < route, "the instruction is demanded ABOVE the routing call, which is itself billed");
  assert.ok(gate < post, "and above the edit POST");
});

test("the exact submitted instruction is written into the evidence", () => {
  // Run 14's bundle recorded the routing answer, the terminal body and the
  // customer's screen — and nowhere the one input that decides all three, so
  // a run that asked for X and one that asked for Y were the same artifact.
  assert.match(CANARY_RAW, /request\.json/, "the request must be recorded as its own artifact");
  const at = CANARY_RAW.indexOf("request.json");
  const win = CANARY_RAW.slice(at, at + 400);
  assert.match(win, /instruction:\s*INSTRUCTION/, "the recorded instruction must be the one that was sent");
});

// ── 2. THE WATCH USES THE BROWSER'S OWN READER ─────────────────────────────

test("a completed failure — HTTP 503 under the final header — is the ANSWER, not a retry", async () => {
  // THIS IS RUN 14'S DEFECT. `edit_finalize` stores the reply a failed edit
  // produced, and the poll route hands it back with its OWN status: 503 for a
  // model outage. The old loop tested `status === 200`, so it read a finished
  // edit as a failed read and polled past it for the rest of its watch.
  const w = await watchEdit(feed([
    res(200, { status: "claimed" }),
    res(200, { status: "routing" }),
    res(503, { ok: false, error: "model", msg: "The model that writes pages did not answer.", cost: 0 }, FINAL),
  ]), { sleep: noSleep, waitMs: 0, tries: 20 });

  assert.equal(w.kind, "reply", "a stored reply arrived and the watch must end on it");
  assert.equal(w.polls, 3, "it must end on the third poll, not run out the loop");
  assert.equal(w.q.status, 503, "the stored reply's OWN status is preserved");

  const rep = watchReport(w);
  assert.equal(rep.compose, true, "there IS a body, so the customer's composer runs on it");
  assert.equal(rep.pass, false, "a completed failure answered — and is not a pass");
  assert.match(rep.headline, /503/, "the headline carries the status rather than hiding it");
});

test("a transient poll failure is not an edit failure — the same 503 WITHOUT the header retries", async () => {
  // The discriminator is the header and only the header. By number alone these
  // two responses are identical, which is the whole reason `x-gf-edit` exists
  // and the whole reason the harness had to stop reading the number.
  const w = await watchEdit(feed([
    res(503, { error: "could not read that job" }),          // the POLL failed
    res(429, { error: "slow down" }),                        // and again
    res(0, null),                                            // a dropped connection
    res(200, { ok: true, layer: "page", cost: 20 }, FINAL),  // then the edit answered
  ]), { sleep: noSleep, waitMs: 0, tries: 20 });

  assert.equal(w.kind, "reply");
  assert.equal(w.polls, 4, "the three transient failures were retried, not mistaken for the answer");
  assert.equal(w.retries, 3, "and they are COUNTED — a watch spent retrying must be distinguishable from one spent waiting");
  assert.equal(watchReport(w).pass, true, "the successful control still passes");
});

test("a terminal job with no stored reply ends the watch and is NOT composed over", async () => {
  // `lost` and `cancelled` store no reply at all — the route describes the job
  // instead. There is nothing for the customer's composer to read, and the
  // browser prints a fixed sentence, so the harness prints the same one rather
  // than inventing a second copy of it.
  const w = await watchEdit(feed([
    res(200, { status: "running" }),
    res(200, { status: "lost" }),
  ]), { sleep: noSleep, waitMs: 0, tries: 20 });

  assert.equal(w.kind, "ended");
  assert.equal(w.outcome, "lost");
  const rep = watchReport(w);
  assert.equal(rep.compose, false, "no stored reply means nothing to compose FROM");
  assert.equal(rep.message, EditPoll.outcomeMessage("lost"), "the sentence is the browser's own, by identity");
  assert.equal(rep.pass, false);
});

test("a genuine watch timeout reports OUTCOME UNKNOWN and never runs the composer", async () => {
  // ⚠ THE SENTENCE RUN 14 PRINTED WAS "the job did not finish inside the
  // watch", which is a claim about the JOB made from a fact about the HARNESS.
  // The job runs in a queue consumer that has never heard of this process; a
  // watch that stopped looking establishes nothing about whether it finished.
  const w = await watchEdit(feed([res(200, { status: "running", phase: "verify" })]),
    { sleep: noSleep, waitMs: 0, tries: 6 });

  assert.equal(w.kind, "timeout");
  assert.equal(w.polls, 6, "it really ran its whole watch");

  const rep = watchReport(w);
  assert.equal(rep.compose, false, "THE NULL BODY NEVER REACHES THE COMPOSER — that is what recorded a phantom ~25-credit rewrite");
  assert.match(rep.headline, /unknown/i, "the honest word is unknown");
  assert.doesNotMatch(rep.headline, /did not finish/i, "and it must not claim the job did not finish");
  assert.equal(rep.pass, false);
});

test("a 404 stops the watch and says nothing about whether the id exists", async () => {
  const w = await watchEdit(feed([res(404, { error: "not found" })]), { sleep: noSleep, waitMs: 0, tries: 20 });
  assert.equal(w.kind, "gone");
  assert.equal(w.polls, 1, "a 404 is not worth retrying");
  const rep = watchReport(w);
  assert.equal(rep.compose, false);
  // The same answer a job belonging to somebody else gets, deliberately — so
  // the sentence must not let a caller tell those apart.
  assert.doesNotMatch(rep.headline, /does not exist|never existed/i);
});

test("the header is read case-insensitively, so a capital cannot read as absence", async () => {
  const w = await watchEdit(feed([res(422, { ok: false, error: "compile" }, { "X-GF-Edit": "final" })]),
    { sleep: noSleep, waitMs: 0, tries: 5 });
  assert.equal(w.kind, "reply", "a capitalised header is the same header");
});

test("the harness asks EditPoll rather than re-deriving the rule", () => {
  // TWO COPIES OF ONE THING DRIFT SILENTLY. The browser and the harness must
  // never disagree about what a given response meant, so the census is that
  // the old hand-rolled test is gone and the shared reader is called.
  assert.match(CANARY_RAW, /watchEdit\(/, "the harness must use the shared watch");
  const bare = CANARY_RAW.match(/q\.status === 200/g) || [];
  assert.equal(bare.length, 0, "`q.status === 200` is the run-14 defect verbatim");

  // And the reader really is the browser's file, not a copy of it.
  assert.equal(typeof EditPoll.readPoll, "function");
  assert.equal(EditPoll.FINAL_HEADER, "x-gf-edit");
  assert.deepEqual(EditPoll.readPoll(503, "final", null), { act: "reply" });
  assert.deepEqual(EditPoll.readPoll(503, undefined, null), { act: "retry" });
});

test("the response headers survive the harness's own call helper", () => {
  // THE WIRING HOP, and it is the one that makes everything above reachable:
  // `call` dropped `res.headers`, so the final marker could not arrive however
  // correctly it was read. From outside, "the server did not send it" and "we
  // did not keep it" are the same absence.
  const at = CANARY_RAW.indexOf("function call(");
  assert.ok(at > 0, "the call helper must exist — the observer is alive");
  const end = CANARY_RAW.indexOf("let failed = 0", at);
  assert.ok(end > at, "and its window must close on the next sibling");
  assert.match(CANARY_RAW.slice(at, end), /headers:\s*res\.headers/, "the call helper must keep the response headers");
});

// PARKED (2026-11-03, park-old-way): the old-way half of test/requirement-coverage.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ── WHAT THE CHANGE NEEDED, AND WHETHER IT GOT IT ───────────────────────────
//
// Owner, 2026-09-13, on the Tables step of the add path. Six properties, and
// they are separate on purpose:
//
//   1. the metadata shape is explicit, cleaned, and REFUSES what it cannot read
//   2. it is NOT part of `TABLE_ITEM`, which `design_schema` binds by identity
//   3. it survives all eight hops, INCLUDING a skipped entry and an answer that
//      designed nothing — the two shapes it exists for
//   4. an unresolved requirement reaches completion reporting
//   5. a model-authored property the engine cannot keep gets feedback
//   6. the acceptance case: the requirement the 2026-09-13 audit reproduced as
//      omitted is now named rather than dropped
//
// THE ACCEPTANCE CASE IS DRIVEN, NOT DESCRIBED. `scratchpad/repro-table-gap.mjs`
// reproduced it deterministically: a customer asks to "book a repair and see
// the history of what changed on it", the tool cannot express `history` (0
// mentions in 20,127 characters) and offers four column properties, so the word
// "history" left the design and NOTHING RECORDED THAT. `droppedFields` could
// not report it either — `history` is un-offered but LIVE, the third category
// neither diagnostic has. What is asserted below is the fix: the requirement is
// answered `unsupported`, survives to the reply, and reaches the customer.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  COVERAGE, COVERAGE_STEPS, REQUIREMENT_ITEM, BASES, REQUIREMENT_STATES, SITE_KINDS, OPAQUE_KINDS,
  ITEM_KINDS, referenceOf, evidenceItems, implementationOf,
  cleanRequirements, unresolvedRequirements, requirementsByStep, requirementCounts,
  requirementBrief, requirementNote, requirementRecord, requirementOutcomes, evidenceName, claimEvidence,
} from "../../../builder/site-requirements.mjs";
import { addTool, readAddAnswer, runAdd, foldAdds, REQUIREMENT_ADDS, siteNote, tableFacts, ADD_KINDS, addLayer, OWN_ADDS, PLACING_ADDS, DISPATCHED_ADDS, pickTool, pickRequest } from "../../../builder/site-add.mjs";
import { TABLE_ITEM } from "../../../builder/site-table.mjs";
import { droppedFields, refusedFields, normalizeSchema } from "../../../site-schema.mjs";

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

/** Length-preserving, LINE COMMENTS FIRST — the recorded blanker-order trap. */
function blank(src) {
  let out = "", i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "/") {
      let j = i; while (j < src.length && src[j] !== "\n") j++;
      out += " ".repeat(j - i); i = j; continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      let j = src.indexOf("*/", i + 2); j = j < 0 ? src.length : j + 2;
      out += src.slice(i, j).replace(/[^\n]/g, " "); i = j; continue;
    }
    out += src[i]; i++;
  }
  return out;
}
const W = blank(WORKER);
const C = blank(CHAT);
// THE BLANKER'S OWN OBSERVER. Every scan below looks for a landmark in the
// blanked text, and a blanker that ate the file satisfies each absence check
// perfectly — this repository's most-recorded trap, met in a lint, a router
// guard, an absence check and a scope scan.
// RE-ANCHORED 2026-10-06, TWICE: the composer took `{ refused }`, so a
// refusal's note says nothing that describes a change that was built; it takes
// a failure's outcome now (`{ failed, said }`), so every failure's note is
// composed against what its evidence says it left behind.
assert.ok(C.includes("function addonReplyText"), "the blanker ate the browser's addon reader");

const toolReply = (name, input) => ({ content: [{ type: "tool_use", name, input }], usage: { input_tokens: 1, output_tokens: 1 } });

test("HOPS 3, 5, 6, 7 and 8 are wired in the route, each read by its own condition", () => {
  const at = (needle, what) => {
    const i = W.indexOf(needle);
    assert.ok(i > 0, "landmark moved: " + what);
    return i;
  };
  // RE-ANCHORED 2026-10-11 (the parallel-work goal): one statement, the
  // designer's early answer when its request is unchanged or a call made now.
  // RE-ANCHORED 2026-10-13 (correction reuse): `let`, since a prior refusal
  // the turn declines asks the first request again into the same name.
  const runAt = at("let ranFirst = aEarlyOne ? await aEarlyOne : await runAdd(", "the designer call");
  // HOP 3 IS ABOVE EVERY EXIT BELOW IT. A list collected after the decline
  // check, after the cleaner's refusal or after the truncation check is a list
  // that vanishes in exactly the three cases worth reading it in.
  // RE-ANCHORED 2026-10-05: what is collected is what the customer's words
  // hold up (`groundRequirements`), worked out in the same unconditional span.
  const collect = at("for (const r of aGround.list) aReq.push(r);", "the collect");
  const decline = W.indexOf("if (ran.value === undefined) { aDeclined.push(k); continue; }", runAt);
  // RE-ANCHORED 2026-10-22: a refused kind is set aside by name (`aNotAdded`)
  // and the loop goes on; its coverage is still collected before that.
  const refuse = W.indexOf("aNotAdded.push({ kind: k, why: clean.why, msg: addRefusal(clean.why, k) });", runAt);
  assert.ok(collect > runAt, "the coverage is collected before the designer ran");
  assert.ok(decline > collect, "a declined designer's coverage is collected after the decline returns — it never is");
  assert.ok(refuse > collect, "a refused answer's coverage is collected after the refusal returns");
  // ── AND IT IS UNCONDITIONAL, WHICH POSITION CANNOT SEE ───────────────────
  //
  // A SWEEP SURVIVOR, and it is the recorded "a positional guard cannot see a
  // dead branch" landing in a guard written the same hour. Wrapping the two
  // lines in `if (ran.value !== undefined) { … }` leaves them at exactly the
  // offset the three assertions above look for, so all three pass over a route
  // that collects nothing from the answer that declined — which is the one
  // answer this whole shape exists to read. The span between the designer call
  // and the collect must open no branch at all.
  // MEASURED FROM THE END OF THE `runAdd` STATEMENT, not from its head: the
  // call's own argument object carries braces (`{ send: aQuick(…) }`), so a
  // brace check from the head reports the call itself. The first `;` after the
  // call closes it.
  // RE-ANCHORED 2026-09-14: the call gained `brief` — what an earlier step in
  // this same message handed to this kind — so the tail that ends the
  // statement moved. Anchored on the LAST argument, and asserted to exist.
  const tail = W.indexOf("brief: aBrief });", runAt);
  assert.ok(tail > runAt, "the designer call no longer carries the hand-off brief");
  const runEnd0 = W.indexOf(";", tail) + 1;
  assert.ok(runEnd0 > runAt && runEnd0 < collect, "the designer call's own end could not be found");
  // RE-ANCHORED 2026-10-11 (round 10): the cleaner now reads the answer first,
  // and corrects a refused one ONCE, between the call and the collect, so the
  // collect processes whichever answer is final. That one block may branch —
  // it is the correction — but it can never leave the turn: no `continue`,
  // `return` or `break` inside it, so the collect after it is still reached by
  // every answer, the declined one included. The unconditional span is measured
  // from the block's end.
  const corrAt = at("let aSupersededReq = null;", "the correction block");
  const corrEndMark = 'if (clean && !clean.ok && clean.why !== "nothing") rejectReply(ran.raw, "add:" + clean.why);\n              }';
  const corrEnd = W.indexOf(corrEndMark, corrAt);
  assert.ok(corrAt > runEnd0 && corrEnd > corrAt && corrEnd < collect, "the correction block is not between the call and the collect");
  assert.doesNotMatch(W.slice(corrAt, corrEnd), /\b(continue|return|break)\b/, "the correction block can leave the turn before the collect");
  const runEnd = corrEnd + corrEndMark.length;
  const between = W.slice(runEnd, collect);
  assert.doesNotMatch(between, /\bif\s*\(/, "the collect sits behind a condition — a declined designer's reason is lost again");
  assert.doesNotMatch(between, /[{}]/, "a block opens between the designer call and the collect");
  // …AND THE SPAN IS REAL: an empty one satisfies both absences perfectly.
  assert.ok(between.length > 100, "the span is too short to have tested anything: " + between.length);
  // …AND WHAT IS COLLECTED IS GROUNDED THERE, from this designer's own answer.
  assert.match(between, /const aGround = groundRequirements\(ran\.requirements, aGrounding\);/, "the collect no longer keeps only what their words hold up");
  // HOP 5 AND 6: every exit carries it. Four of them, and the two failures are
  // the ones that matter — an `ok: false` is where a customer most needs to
  // hear what the change could not do.
  // RE-ANCHORED 2026-10-06 (TWICE THAT DAY): the two successes spread it, and
  // every failure after the design carries it through ONE door, `aFail`, which
  // composes it against what that failure's evidence says it left behind — so
  // the count is the successes' spreads plus the door's own, and the door must
  // really be the way every one of those failures answers.
  assert.equal(W.split("...aCoverage()").length - 1, 2, "a success no longer carries the coverage");
  // RE-ANCHORED 2026-10-07: the door composes the coverage once (`told`),
  // writes the developer record from that same reading, and answers with it —
  // read from the door's opening to its last line.
  const doorAt = W.indexOf("const aFail = async (body, status");
  const doorEnd = doorAt < 0 ? -1 : W.indexOf("return Response.json({ ...told, ...body, outcome: failed }, { status });", doorAt);
  assert.ok(doorAt >= 0 && doorEnd > doorAt, "the failure door's landmarks are gone");
  const door = W.slice(doorAt, doorEnd);
  assert.match(door, /const told = aCoverage\(\{ failed, said: body\.msg \}\);/, "the failure door does not compose the coverage against its own outcome");
  assert.match(door, /requirementsTold: told\.requirementsTold, warningsTold: told\.warningsTold/, "the developer record does not hold what the answer tells");
  const doors = W.split("return aFail(").length - 1;
  assert.ok(doors >= 14, "not every failure after the design answers through the door: " + doors);
  // RE-ANCHORED 2026-10-22: when every kind is refused, the first refusal is
  // the answer through the same door.
  assert.match(W, /return aFail\(\{ ok: false, error: "add", kind: r0\.kind, reason: r0\.why, cost: 0, msg: addRefusal\(r0\.why, r0\.kind\) \}, 422\);/,
    "a cleaner's refusal drops the coverage");
  assert.match(W, /return aFail\(\{ ok: false, error: "declined", kinds: aDeclined, cost: 0, msg: addRefusal\("nothing"\) \}, 422\);/,
    "the all-declined answer drops the coverage — the one shape this was built for");
  // RE-ANCHORED 2026-09-14. The composer took the kinds that RAN and decided a
  // hand-off against them; it reads `aTold` — the steps really handed an
  // outstanding requirement — so every call site is the same call, and the
  // argument that used to distinguish a failure from a success is gone. What
  // replaces that assertion is the pair below: the composer reads `aTold` and
  // the loop fills it only where the brief is really composed.
  assert.match(W, /told: \[\.\.\.aTold\]/, "the composer no longer reads which steps were really told");
  // RE-ANCHORED 2026-10-05: the brief is composed from what the judgment kept
  // (`aReq.filter((r) => r.judged)` — an extra or an unjudged entry is never
  // handed on to be built), and `aTold` is still filled only where it is.
  // RE-ANCHORED 2026-10-11 (round 12): the hand-off brief is `aBriefHanded`;
  // what was held across a pause is appended after `aTold` is filled, so a
  // step is still recorded as told only where hand-offs were composed for it.
  assert.match(W, /const aBriefHanded = requirementBrief\(aReq\.filter\(\(r\) => r\.judged\), k\);\s*\n\s*if \(aBriefHanded\) aTold\.add\(k\);/,
    "a step is recorded as told without the brief being composed, or the brief is composed and not recorded");
  // RE-ANCHORED 2026-10-25 (row-hedge): a feature's hand-over line follows.
  assert.match(W, /const aBrief = aBriefHanded \+ aHeldShown\(k\)( \+ featureBrief\(aHand, k\))?;/,"the designer is no longer handed the composed brief");
  // ── AND THE COMPOSER READS WHAT REALLY HAPPENED ──────────────────────────
  //
  // RE-ANCHORED 2026-09-14. This used to check that the composer did not
  // overwrite the `ranKinds` argument it was handed — a real sweep survivor,
  // and a parameter that no longer exists: a hand-off is settled by whether
  // the receiving step was TOLD, not by whether it ran, so there is one call
  // and one set. What replaces the old assertion is the pair below, which is
  // the same property one layer over: the composer must read the recorded
  // `aTold` and the APPLIED result, and must not reach for the picked kinds.
  const covAt = at('const aCoverage = ({ failed = null, said = "" } = {}) => {', "the coverage composer");
  const covBody = W.slice(covAt, W.indexOf("\n            };", covAt));
  assert.ok(covBody.length > 200, "the composer's body could not be found: " + covBody.length);
  assert.match(covBody, /told: \[\.\.\.aTold\]/, "the note is not told which steps were handed a requirement");
  // RE-ANCHORED 2026-10-06: told what the failure settled, when it is one.
  assert.match(covBody, /made: aMade\(failed\), reportable: aReportable\(failed\)/, "the note is not told what was really applied");
  // AND IT DOES NOT REACH FOR THE PICKED KINDS: `aKinds` is every kind the
  // PICKER named, including ones that declined and ones nobody handed
  // anything, and reading it here is the lie this whole shape is about.
  assert.doesNotMatch(covBody, /\baKinds\b/, "the composer reads the picked kinds instead of what really happened");
  assert.doesNotMatch(covBody, /aNewNames|aMadeNames/, "the note is decided from the PROPOSED design again, not the applied result");
  // HOP 7: the developer record, beside the raw replies.
  //
  // RE-ANCHORED 2026-09-14 — BY FIELD, NOT BY THE WHOLE ARGUMENT LIST. This
  // pinned the exact four-property call and went red the moment three honest
  // inputs arrived, reporting the record as GONE: this repository's single
  // most repeated own-goal, met here in the guard written for it. What each
  // field is remains asserted; their order and their number do not.
  // RE-ANCHORED 2026-09-14: the literal moved into `aRecord`, because the record
  // is written TWICE now — once here and once after the apply — and two copies
  // of an argument list is the drift this file is full of warnings about.
  // RE-ANCHORED 2026-10-07: the record is told what a failure settled
  // (`failed`, null on a success), as the customer's sentence is, so a record
  // re-written by the failure door says what that answer says.
  const recAt = W.indexOf("const aRecord = (failed = null) => requirementRecord({");
  assert.ok(recAt > 0, "the developer record is not stored with the answer");
  assert.ok(W.indexOf("coverage: aRecord()") > recAt, "the saved answer does not carry the record");
  const recCall = W.slice(recAt, W.indexOf("})", recAt) + 2);
  for (const field of ["list: aReq", "skipped: aReqSkipped", "invalid: [...aBadProps]", "ran: aAnswers.map((a) => a.kind)"]) {
    assert.ok(recCall.includes(field), "the developer record lost `" + field + "`");
  }
  // …AND IT IS WRITTEN AGAIN ONCE THE APPLY HAS LANDED (owner, 2026-09-14:
  // "Update the stored coverage after application too"). The write above the
  // loop is decided against an EMPTY applied result, which is honest at that
  // point and is not the final answer; both apply paths re-save.
  // RE-ANCHORED 2026-09-14: THREE writes, not two, and the third is the
  // missing-page one. The copy stored in the publish seam is composed BEFORE
  // the publish, so on a change whose page never arrived it says the page step
  // succeeded; the write below the publish is the last moment anything knows
  // better. The count is asserted rather than ">= 2" because each write is a
  // decision about WHEN the record is honest, and a fourth appearing without a
  // reason is the thing worth going red over.
  assert.equal(W.split("await aSaveAnswer();").length - 1, 4,
    "the stored coverage is not re-written after the apply on both paths and after a missing page");
  // …AND THE THREE THAT MAKE COMPLETION HONEST (owner, 2026-09-14). Without
  // them every `covered` claim and every hand-off to a step that ran reads as
  // delivered, which is the reading the correction overturned.
  for (const field of ["failed: [...aFailedKinds]", "made: aMade(failed)", "told: [...aTold]", "altered: [...aChanged]", "unbuilt: aUnbuilt"]) {
    assert.ok(recCall.includes(field), "the developer record cannot tell delivered from unverified: no `" + field + "`");
  }
  // …AND THE CUSTOMER'S OWN SENTENCE GETS THEM TOO. A SWEEP SURVIVOR: the
  // record can carry every input and the NOTE be composed without them, so the
  // developer file is honest and the customer is still told a change is
  // finished that is not. Both readers, or neither is asserted.
  // RE-ANCHORED 2026-09-14: `coverNote` is a JOINED PAIR of sentences now — the
  // requirements' own and the missing pages' — so the anchor is the CALL rather
  // than the field. The property this case is about is unchanged: whatever else
  // the field carries, `requirementNote` must be handed the three inputs that
  // let it tell delivered from unverified.
  // RE-ANCHORED 2026-10-06: the note and the reply's facts are written from
  // one report (`requirementReport`), so the call that must carry the three
  // inputs is the report's.
  const noteAt = W.indexOf("requirementReport(aReq, { told:");
  assert.ok(noteAt > 0, "the customer's coverage sentence is gone");
  const noteCall = W.slice(noteAt, W.indexOf("})", noteAt) + 2);
  // RE-ANCHORED 2026-10-06: `aMade` is told what a failure settled (`failed`,
  // null on a success), so its call carries the outcome.
  for (const field of ["failed: [...aFailedKinds]", "made: aMade(failed)", "told: [...aTold]"]) {
    assert.ok(noteCall.includes(field), "the customer's sentence cannot tell delivered from unverified: no `" + field + "`");
  }
  // …AND THE EVIDENCE IS WHAT WAS REALLY APPLIED, never what the model said and
  // never what it was going to be. A SWEEP SURVIVOR: `aMade` can answer `[]`
  // and every call site stay perfect, which turns every `covered` claim into
  // `unverified` — the opposite failure to the one the states exist for.
  //
  // RE-ANCHORED 2026-09-14 (owner: "`aMadeNames` comes from proposed designs
  // before application. Use actual results"). It read `aNewNames` — the names
  // off the CLEANED DESIGNS — so a function Postgres refused to create counted
  // as evidence for the job that names it. The lists it must read now are the
  // APPLIED ones.
  // RE-ANCHORED 2026-10-06: the reader takes a failure's outcome, and on one
  // whose database changes did not go in it answers none of them (`db`) — the
  // lists it reads otherwise are still the applied ones, by name.
  const madeAt = W.indexOf("const aMade = (failed = null) => {");
  assert.ok(madeAt > 0, "the evidence reader is gone");
  const made = W.slice(madeAt, W.indexOf("});", madeAt) + 3);
  for (const list of ["tables: db ? aTables : []", "altered: db ? aAltered : []", "functions: db ? aFunctions : []", "fnErrors: db ? aFnErrors : []"]) {
    assert.ok(made.includes(list), "the evidence does not read what this change really applied: no `" + list + "`");
  }
  assert.match(made, /const db = !failed \|\| failed\.database === "applied";/, "the database's results count where its apply did not go in");
  // NOT the model's answer, and NOT the proposal: `aAnswers`/`aDesigned` are
  // what was SAID, and `aNewNames` is what was going to be done.
  assert.doesNotMatch(made, /aAnswers|aDesigned|aNewNames/, "a claim is checked against itself, or against the proposal");
  // …AND THE GUARANTEES ARE THE ENGINE'S OWN VOCABULARY, read where they can be
  // DRIVEN. This lived inline in the route until a sweep mutant that emptied
  // `fails` survived: the only route path that applies a table wants a
  // container, so the wall could not be reached from a unit test at all.
  // `test/addon-steps.test.mjs` drives `appliedFacts`; what is asserted here is
  // that the route still goes through it.
  const FACTS = fs.readFileSync(new URL("../../../builder/site-add.mjs", import.meta.url), "utf8");
  const tfAt = FACTS.indexOf("export function appliedFacts(");
  assert.ok(tfAt > 0, "the per-item guarantee reader is gone");
  const facts = FACTS.slice(tfAt, FACTS.indexOf("\n}", tfAt));
  assert.match(facts, /resolveAccess\(t\)/, "a table's applied permissions are not read");
  assert.match(facts, /\[\.\.\.new Set\(\[\.\.\.Object\.keys\(ACCESS_PRESETS\), \.\.\.READ_LEVELS, \.\.\.WRITE_LEVELS\]\)\]/,
    "the access vocabulary is a second list instead of the engine's own");
  // HOP 8: the trace, counts only — `tr.at` keeps finite numbers and drops
  // everything else, and the needs are the customer's words.
  // RE-ANCHORED 2026-10-07: THREE MARKS NOW — the trace keeps eight keys a
  // mark (`MAX_DETAIL_KEYS`) and the one mark carried seventeen, so the nine
  // after `lost` were dropped unread. Read from the first to the end of the
  // last; the keys reaching the stored trace are a route case's
  // (addon-judgment's JUDGE 7).
  const markAt = W.indexOf('aMark("coverage", "ok", {');
  const lastAt = markAt < 0 ? -1 : W.indexOf('aMark("coverage:unbuilt", "ok", {', markAt);
  assert.ok(markAt > 0 && lastAt > markAt, "the coverage leaves no trace mark");
  const markCall = W.slice(markAt, W.indexOf("});", lastAt) + 3);
  assert.ok(markCall.includes("...requirementCounts(aReq, aReqSkipped)"), "the mark lost the counts");
  assert.ok(markCall.includes("bad: aBadProps.size"), "the mark lost the invalid-property count");
  // …AND THE THREE STATES BESIDE THE THREE STATUSES, or a run where every
  // claim was unverifiable is indistinguishable from one where every claim held.
  // RE-ANCHORED 2026-09-15: `gone` and `unsent` join them, because a run whose
  // implementation is MISSING and one whose hand-off was never DELIVERED are
  // two different facts and both were previously folded into `broke`.
  // …AND `unseen:` JOINS THEM, 2026-09-15: a run where nothing could be SEEN
  // either way is not a run where everything was built and unchecked, and folded
  // into `unsure` the two are indistinguishable from a mark.
  for (const k of ["done:", "broke:", "unsure:", "gone:", "unseen:", "unsent:", "unbuilt:"]) {
    assert.ok(markCall.includes(k), "the mark cannot say what really became of the requirements: no `" + k + "`");
  }
  // …AND EACH IS COUNTED RATHER THAN WRITTEN. A SWEEP SURVIVOR: `done: 0`
  // leaves the key exactly where a key check looks for it and reports every run
  // as having delivered nothing, which is a wrong number wearing a right one's
  // name — the one way an instrument misleads rather than going quiet.
  //
  // RE-ANCHORED OFF THE EXACT PREDICATE AND ONTO THE PROPERTY, 2026-09-15: two
  // of these keys now count a PAIR of states (`broke` is failed-or-blocked,
  // `unsure` is unverified-or-configured), and pinning the one-state spelling
  // reported an honest widening as the counter being gone — this repo's own
  // "assert the property, not the spelling". What must hold is that the value
  // is a filter over the outcomes naming the states it claims to count.
  for (const [k, field, states] of [
    ["done", "state", ["delivered"]],
    ["broke", "state", ["failed", "blocked"]],
    ["unsure", "state", ["unverified", "configured"]],
    ["gone", "state", ["missing"]],
    ["unseen", "state", ["unknown"]],
    ["unsent", "handoff", ["undelivered"]],
  ]) {
    const m = markCall.match(new RegExp("\\b" + k + ": ([^\\n]*?),?\\n"));
    assert.ok(m, "`" + k + "` is not on the mark at all");
    assert.match(m[1], new RegExp("^st\\.filter\\(\\(r\\) => .*\\)\\.length$"),
      "`" + k + "` on the mark is not counted from the outcomes: " + m[1]);
    for (const s of states) {
      assert.ok(m[1].includes('r.' + field + ' === "' + s + '"'),
        "`" + k + "` does not count `" + s + "`: " + m[1]);
    }
  }
  // BY FIELD, NOT BY THE WHOLE ARGUMENT LIST — re-anchored 2026-09-14 when
  // `ran`/`names` became `told`/`made`. A byte window from a fixed offset is
  // this file's own recorded trap; the landmark is the call itself.
  const stAt = W.lastIndexOf("requirementOutcomes(aReq, {", markAt);
  assert.ok(stAt > 0 && stAt < markAt, "the mark's outcomes are not computed at all");
  const stCall = W.slice(stAt, W.indexOf("});", stAt) + 3);
  // RE-ANCHORED 2026-09-15: the two evidence sources this change added are on
  // the list too, and both are on it for the same reason the three above are —
  // the mark recomputes the outcomes from ITS OWN arguments, so a field dropped
  // here leaves the reply and the stored record right and the telemetry saying
  // something else about the same run.
  for (const field of ["told: [...aTold]", "failed: [...aFailedKinds]", "made: aMade()",
    "failedItems: aFailedItems()", "existing: aExisting()"]) {
    assert.ok(stCall.includes(field), "the mark's outcomes lose `" + field + "`");
  }
  // THE NEEDS THEMSELVES STAY OFF THE MARK — they are the customer's own words.
  assert.doesNotMatch(markCall, /\baReq\b(?!, aReqSkipped)/, "a customer's words reached a telemetry row");
  // AND THE PICKER GETS THE SITE, not a digest of names.
  // RE-ANCHORED 2026-10-02 (the audit's W24): and why the request was handed
  // here, when it was (`handOverLine`).
  // RE-ANCHORED 2026-10-09 (round 8): and whether files it was said to carry
  // never arrived (`filesMissing`, read from the request part's own body).
  // RE-ANCHORED 2026-10-11 (round 11): shown what the picker uses (`noteFor`,
  // no photographs), still the site and not a digest.
  assert.match(W, /\{ message: aInstruction, current: siteNote\(noteFor\("pick", aSite\)\), model: aModels\.quick, handOver: handOverLine\(aHand\), filesMissing: !!\(aPart && ab && ab\.filesMissing === true\) \}/,
    "the picker is still shown a digest instead of the site");
  // ── THE ROUTE REALLY HANDS THE TABLE FACTS IN ────────────────────────────
  //
  // A SWEEP SURVIVOR: `tableFacts` is driven in its own case and `siteNote`
  // prints what it is given, so both halves passed while the route handed in
  // `{}` — the module perfect, the note correct, and every designer shown a
  // site with no permissions, relationships or constraints on it. The recorded
  // wiring trap, and the reason a module test is never the whole of one.
  // RE-ANCHORED 2026-09-14: `const aSite = {` became `const siteFacts = (spec)
  // => ({`, because the facts are REBUILT after each kind now — each designer
  // sees what the ones before it proposed. `aSpec` became the function's own
  // `spec` parameter for the same reason: read off the accumulating proposal,
  // never off the stored baseline alone.
  const factsAt = W.indexOf("const siteFacts = (spec, names = aNewNames, pages = aNewPages) => ({");
  assert.ok(factsAt > 0, "the site facts are not built from a spec — the designers cannot be shown the proposal");
  const siteLit = W.slice(factsAt, W.indexOf("});", factsAt));
  assert.ok(siteLit.length > 500, "the site literal could not be read: " + siteLit.length);
  assert.match(siteLit, /tableInfo: tableFacts\(spec\),/, "the designers are shown a site with no table facts on it");
  // …AND IT IS REALLY RE-BUILT, not built once. A `siteFacts` with one caller
  // is the old behaviour wearing a function's name.
  assert.ok((W.match(/siteFacts\(a(?:Baseline|Proposed)\)/g) || []).length >= 2,
    "the site facts are built once — a later designer is shown the site as it was before this message");
  // ONE FOLD SINCE 2026-10-11 (`aFoldInto`, shared with a designer's own view
  // of the site): it accumulates the proposal, and the loop keeps the result.
  assert.match(W, /st\.spec = proposedSpec\(st\.spec, k, value\)/, "the proposal never accumulates");
  assert.match(W, /aFoldInto\(st, k, clean\.value\);\s*aProposed = st\.spec;/, "the proposal never accumulates");
  assert.match(W, /const aBaseline = aSpec;/, "the stored baseline is not kept apart from the proposal");
  assert.match(W, /import \{[^}]*\btableFacts\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "tableFacts is called and never imported");
});

test("HOP 6b: the browser prints the server's sentence and composes none of its own", () => {
  assert.match(C, /if \(typeof a\.coverNote === 'string' && a\.coverNote\) out \+= ' ' \+ a\.coverNote;/,
    "the addon reply does not say what the change still owes");
  // A SECOND COMPOSER HERE WOULD BE TWO SENTENCES ABOUT ONE FACT, and the one
  // with the facts is the server's — it knows which steps really ran.
  assert.doesNotMatch(C, /unsupported.{0,40}requirement/i, "the browser composes its own coverage sentence");
  // `coverNote`, NOT `note`: the reply already carries `notes` (the salvage
  // note), and two fields one character apart is how a reader prints the wrong
  // one. Asserted on BOTH sides, because either alone is half a wire.
  // RE-ANCHORED 2026-09-14: `coverNote` is composed from TWO sentences now —
  // the requirements' own and the missing pages'. The property is unchanged
  // and is what this asserts: the field the browser prints is the field the
  // server fills, and the server is still the only composer.
  // RE-ANCHORED 2026-10-06: the requirements' sentences come from the report
  // the reply's facts are written from (`toldNote(aRep.told)`), and the rest
  // from one list (`aOther`) the field spreads whole.
  // RE-ANCHORED 2026-10-06: the note is `aNote` — the same two halves, and on
  // a refusal the counted sentences left out.
  assert.match(W, /coverNote: aNote\.filter\(Boolean\)\.join\(" "\),/, "the server sends a field the browser does not read");
  assert.match(W, /: \[toldNote\(aRep\.told\), \.\.\.aOther\];/, "the note's success half is not the requirements' sentences and the rest");
  const otherAt = W.indexOf("const aOther = [");
  assert.ok(otherAt > 0, "the note's other sentences are not composed in one list");
  const other = W.slice(otherAt, W.indexOf("].filter(Boolean);", otherAt));
  assert.match(other, /missingPagesNote\(aMissing\),/, "the missing-page sentence never reaches the field the browser prints");
  // …AND A THIRD, 2026-09-17: what went WITH a missing page. A new QR code
  // pointing at a page that did not survive is dropped before anything is
  // stored, and the customer hears it beside the page's own sentence rather
  // than discovering it by scanning the code.
  assert.match(other, /deadQrNote\(aDeadQr\),/, "the dead-QR sentence never reaches the field the browser prints");
  // ── AND THE SECOND SENTENCE THAT FOLLOWS THIS RULE (2026-09-17) ──────────
  //
  // A component the page writer was not shown and would have replaced: the
  // decision is entirely the server's, because it is the only thing that knows
  // which component sources fitted in the request. Asserted on BOTH sides for
  // the reason above — either alone is half a wire — and the browser must
  // compose nothing of its own about it, which is what the third assertion is:
  // the only sentence in that file naming a kept component is the one it
  // prints verbatim.
  assert.match(C, /if \(typeof a\.keptPartsNote === 'string' && a\.keptPartsNote\) out \+= ' ' \+ a\.keptPartsNote;/,
    "the addon reply does not say a component was kept rather than replaced");
  // RE-ANCHORED 2026-09-17 onto the PROPERTY, because an honest second
  // composer moved the spelling. There are two reasons a returned component is
  // refused and they need different sentences — one named component too long
  // to carry, and a component store that could not be read at all — so the
  // field the browser prints is filled from either. Read as the composers
  // reaching that one field, never as one call's exact text.
  // …AND RE-ANCHORED AGAIN 2026-09-17, for the same reason one turn later: a
  // THIRD composer joined it — a PAGE the window could not carry and would
  // therefore have been replaced unseen — so the field is an array join rather
  // than one line and a single-line window could not see it. WINDOWED TO THE
  // NEXT SIBLING, never sized, and the three composers are asserted by name.
  const knAt = W.indexOf("keptPartsNote: [");
  assert.ok(knAt > 0, "the server sends no sentence for the field the browser prints");
  const knEnd = W.indexOf("problems:", knAt);
  assert.ok(knEnd > knAt, "the sentence block runs past the field that follows it — rescope this");
  const kn = W.slice(knAt, knEnd);
  assert.ok(kn.includes("keptPartsNote(aKeptParts)"), "the too-long sentence is not composed: " + kn);
  assert.ok(kn.includes("unseenPartsNote(aUnseenParts)"), "a store that could not be read gets no sentence of its own: " + kn);
  assert.ok(kn.includes("unseenPagesNote(aRewrote)"), "a page nobody was shown gets no sentence of its own: " + kn);
  assert.doesNotMatch(C, /too long for me to read in one go/, "the browser composes its own kept-component sentence");
  assert.doesNotMatch(C, /couldn't load the components/, "the browser composes its own unreadable-store sentence");
  assert.doesNotMatch(C, /a code that opens nothing/, "the browser composes its own dead-QR sentence");
  assert.doesNotMatch(C, /won't write over a page I haven't read/, "the browser composes its own unseen-page sentence");
});

test("the route validates the MODEL's tables, not the folded spec or the engine's output", () => {
  // "Distinguish model input from stored or internally generated
  // configuration" (owner, 2026-09-13). The difference between "the model asked
  // for something the engine cannot do" — which is feedback somebody can act on
  // — and "the engine derived a field", which is not.
  // RE-ANCHORED 2026-09-14. This was pinned to `if (k === "table") {`, which is
  // exactly what the change removed: the gate, AND the two readers under it,
  // read TABLES ONLY, so three of the four tiers the engine normalises had no
  // reach report and no refusal report at all. What is unchanged — and is the
  // property this test is really about — is that the validator reads the
  // MODEL'S OWN items and never the folded spec or the normaliser's output.
  const at = W.indexOf("const tier = SPEC_OF_KIND[k];");
  assert.ok(at > 0, "the validation block is gone");
  // RE-ANCHORED 2026-09-14 (third time), and the spelling that moved is the
  // CLOSING landmark, not anything this test is about. The window ran to
  // `for (const sk of Array.isArray(clean.skipped)` — a distant neighbour — and
  // the frontend kinds' own audit was inserted between the two, so the window
  // silently grew from ~2.6 KB to 4,261 bytes and a byte-size assertion
  // reported the schema tier's validator as broken by a block that is not it.
  // That is this repository's own recorded pair of traps in one line: NEVER SIZE
  // A SOURCE-READ WINDOW IN BYTES, and derive the closing landmark from the NEXT
  // SIBLING rather than from whatever comes eventually. The sibling is the
  // frontend audit's own first statement — CODE, never its heading comment,
  // because `W` is the blanked source and a comment landmark is erased before
  // the scan runs (this repository's own "a blanker erases the landmark the
  // guard needs", met while fixing the trap one line above it). Both landmarks
  // are asserted, and the window is asserted not to have swallowed the sibling.
  const end = W.indexOf("const fa = auditFrontend(", at);
  assert.ok(end > at, "the schema tier's validator no longer ends at the frontend audit — re-anchor, don't widen");
  const block = W.slice(at, end);
  assert.doesNotMatch(block, /auditFrontend/, "the window swallowed the frontend audit: it is a different validator for a different pipeline");
  // RE-ANCHORED 2026-09-14 AGAIN, and this is the correction the owner named:
  // *"Validation still happens after information is lost."* It read
  // `clean.value` — the CLEANED item — and for three of the four tiers the
  // cleaner builds a fresh object out of the keys it knows, so a property the
  // tool never offered was gone one hop before the observer looked. The audit
  // reads `ran.value` (the model's own declaration) with `sent` naming what
  // really goes into the engine, keyed by NAME.
  assert.match(block, /\(Array\.isArray\(ran\.value\) \? ran\.value : \[ran\.value\]\)\s*\.map\(itemOf\)/,
    "the validator does not read the model's own declaration");
  assert.match(block, /const sent = new Map\(\(Array\.isArray\(clean\.value\)/,
    "the audit is not told what really goes into the engine");
  assert.match(block, /\.map\(\(t\) => \[String\(t\.name\)\.toLowerCase\(\), t\]\)/,
    "the cleaned items are paired by position — a refused one shifts every index behind it");
  // RE-ANCHORED 2026-09-19 (fourth time), and the spelling that moved is the
  // CONTEXT ARGUMENT, not anything this test is about. It read
  // `auditTier({ [tier]: mine }, k, withMine, { sent })`; the third argument is
  // now a `const context` that is `withMine` for every tier but `job`, which
  // gets the site's own functions present. Pinning an argument's NAME is the
  // recorded "assert the property, not the spelling" — met, again, in a guard
  // whose own comments record two earlier instances of it. The properties are
  // what the audit is HANDED and that its context is built from the proposal.
  assert.match(block, /auditTier\(\{ \[tier\]: mine \}, k, context, \{ sent \}\)/, "the per-tier audit is gone");
  // RE-ANCHORED 2026-10-30: the job tier is gone, so the context is the
  // proposal this message has built, for every tier.
  assert.match(block, /const context = proposedSpec\(aProposed, k, clean\.value\);/,
    "the audit's context is no longer the proposal this message has built");
  // …AND THE THIRD REPORT IS READ. A declared value the pipeline kept under a
  // DIFFERENT value is neither reached-for nor refused, and it is the one shape
  // where the customer is told the thing they asked for was done and it
  // quietly does something else.
  assert.match(block, /for \(const n of audit\.changed\) aChanged\.add\(n\)/, "a changed declaration is not recorded");
  // A SWEEP SURVIVOR, and it is the recorded "a positional guard cannot see a
  // dead branch" in its NARROWING form: putting `if (k === "table")` back leaves
  // the audit call at exactly the offset every assertion above looks for, and
  // all of them pass over a route that audits one tier again. So the GATE is
  // read, not just the call under it — and as a property (no kind literal
  // between the tier lookup and the audit) rather than as a spelling.
  const gateAt = block.indexOf("if (tier) {");
  assert.ok(gateAt > 0 && gateAt < block.indexOf("auditTier("), "the validation is not gated on the tier — a kind it does not know is audited, or one it does is not");
  // THE GATE ONLY, not the block under it. The first draft of this line forbade
  // a kind literal anywhere above the audit and went red on the item reader's
  // own `k === "table" ? (e && e.table) : e`, which is CORRECT and has to stay:
  // a table's cleaned entry wraps its definition and the other three do not.
  // A guard that cannot tell the gate from the thing it gates is a false alarm,
  // and a false alarm is worse than a miss.
  const gateLine = block.slice(block.indexOf("SPEC_OF_KIND[k];") + 16, gateAt + "if (tier) {".length);
  assert.doesNotMatch(gateLine, /k === "/,
    "the audit is gated on a kind by name again — three of the four tiers stop being checked");
  assert.ok(gateLine.trim().length < 40, "something was inserted between the tier lookup and its gate: " + JSON.stringify(gateLine.trim()));
  assert.match(block, /audit\.reached/, "the un-offered check is gone");
  assert.match(block, /audit\.refused/, "the offered-but-binned check is gone");
  // …AND THE ITEM IS CHECKED WITH ITS DEPENDENCIES PRESENT (owner, 2026-09-14:
  // "Validate each item with its dependencies present"). A job normalised alone
  // vanishes — its function is absent — so the context is the ACCUMULATED
  // proposal with this kind's own items folded in, never the bare answer.
  assert.match(block, /const context = proposedSpec\(aProposed, k, clean\.value\)/,
    "the item is validated without the schema its dependencies live in");
  // …AND AN ITEM THE ENGINE DROPS WHOLE IS RECORDED AND COUNTS AS A FAILURE.
  // Above the table tier there is no field to point at, so without this a
  // function that vanished had no trace anywhere and its requirements still
  // read as delivered.
  assert.match(block, /aUnbuilt\[k\] = \[\.\.\.\(aUnbuilt\[k\] \|\| \[\]\), \.\.\.audit\.unbuilt\]/, "a dropped item is not recorded");
  assert.match(block, /aFailedKinds\.add\(k\)/, "a dropped item does not make its step a failure");
  // NOT the folded spec, and NOT the normaliser's answer.
  assert.doesNotMatch(block, /aDesigned|folded|normalizeSchema/, "the validator reads something other than the model's input");
  // BEFORE ANYTHING IS APPLIED. `applySiteSchema` is the writer; the validation
  // must sit above it or "before applying changes" is not what happens.
  const apply = W.indexOf("applySiteSchema", at);
  assert.ok(apply > at, "the validation runs after the schema is applied");
});

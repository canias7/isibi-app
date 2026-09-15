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
  COVERAGE, COVERAGE_STEPS, MAX_REQUIREMENTS, REQUIREMENT_ITEM, REQUIREMENT_STATES,
  cleanRequirements, unresolvedRequirements, requirementsByStep, requirementCounts,
  requirementBrief, requirementNote, requirementRecord, requirementOutcomes, evidenceName, claimEvidence,
} from "../builder/site-requirements.mjs";
import { addTool, readAddAnswer, runAdd, foldAdds, REQUIREMENT_ADDS, siteNote, tableFacts, ADD_KINDS, addLayer, pickTool, pickRequest } from "../builder/site-add.mjs";
import { TABLE_ITEM } from "../builder/site-table.mjs";
import { droppedFields, refusedFields, normalizeSchema } from "../site-schema.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

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
assert.ok(W.includes("const aCoverage = () =>"), "the blanker ate the worker's coverage composer");
assert.ok(C.includes("function addonReplyText"), "the blanker ate the browser's addon reader");

const toolReply = (name, input) => ({ content: [{ type: "tool_use", name, input }], usage: { input_tokens: 1, output_tokens: 1 } });

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE SHAPE
// ─────────────────────────────────────────────────────────────────────────────

test("the three statuses are genuinely different answers and the item asks for all three", () => {
  assert.deepEqual(COVERAGE, ["covered", "elsewhere", "unsupported"]);
  assert.deepEqual(REQUIREMENT_ITEM.required, ["need", "status"]);
  // THE ENUM IS THE CONSTANT, not a second copy of it: a status the cleaner
  // accepts and the tool never offers is a status no model will ever send, and
  // the reverse is a status the tool asks for and the cleaner bins.
  assert.equal(REQUIREMENT_ITEM.properties.status.enum, COVERAGE);
  assert.equal(REQUIREMENT_ITEM.properties.step.enum, COVERAGE_STEPS);
  // EVERY STEP NAMED IS ONE THE ADD PATH RUNS, plus `edit`. A requirement handed
  // to a step that does not exist is one dropped with extra ceremony.
  for (const s of COVERAGE_STEPS) {
    assert.ok(s === "edit" || ADD_KINDS.includes(s), "a requirement may be handed to a step no add kind owns: " + s);
  }
  // …AND THE OBSERVER IS ALIVE: the loop above is vacuous over an empty list.
  assert.ok(COVERAGE_STEPS.length >= 5, "the step list is too short to have tested anything");
});

test("cleanRequirements refuses what it cannot read and never repairs it to covered", () => {
  const { list, skipped } = cleanRequirements([
    { need: "a visitor can book a slot", status: "covered", by: "bookings.slot" },
    { need: "the page shows the bookings", status: "elsewhere", step: "page" },
    { need: "the owner sees what changed", status: "unsupported", why: "no row history" },
    // `String(["covered"])` IS `"covered"` — shipped here as a real bug three
    // times (a role, an access level, a language). A non-string is refused.
    { need: "x".repeat(10), status: ["covered"] },
    { need: "", status: "covered" },
    { need: "a need", status: "maybe" },
    "not an object",
    null,
  ]);
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((r) => r.status), ["covered", "elsewhere", "unsupported"]);
  assert.equal(list[0].by, "bookings.slot");
  assert.equal(list[1].step, "page");
  assert.equal(list[2].why, "no row history");
  // A REFUSED ENTRY IS COUNTED, NEVER SILENTLY DROPPED, and keeps its `need`
  // where there was one — the developer record has to say WHAT was unreadable.
  assert.equal(skipped.length, 5);
  assert.deepEqual(skipped.map((s) => s.why).sort(), ["bad-status", "bad-status", "no-need", "not-an-entry", "not-an-entry"]);
  assert.equal(skipped.find((s) => s.why === "bad-status" && s.need === "a need").need, "a need");
  // CANNOT-TELL MUST NEVER READ AS COVERED. The one field whose wrong reading
  // hides the gap this whole shape exists to surface.
  assert.ok(!list.some((r) => r.need === "a need"), "an unreadable status was repaired into the list");
});

test("a step nobody runs becomes unsupported, not a silent hand-off", () => {
  const { list } = cleanRequirements([{ need: "send them a postcard", status: "elsewhere", step: "postcard" }]);
  assert.equal(list.length, 1, "the requirement was dropped with its bad step");
  assert.equal(list[0].status, "unsupported");
  assert.match(list[0].why, /step this change does not run/);
  // THE REQUIREMENT IS STILL REAL — only the claim about who owns it was wrong,
  // and the customer should hear it either way.
  assert.equal(list[0].need, "send them a postcard");
  // AND A PROTOTYPE KEY IS NOT A STEP: `COVERAGE_STEPS.includes` over values,
  // never `Object.hasOwn` on a map — `"constructor"` is simply not one.
  assert.equal(cleanRequirements([{ need: "n", status: "elsewhere", step: "constructor" }]).list[0].status, "unsupported");
});

test("an unsupported answer with no reason says so rather than reading as reasoned", () => {
  const { list } = cleanRequirements([{ need: "n", status: "unsupported" }]);
  assert.equal(list[0].why, "no reason was given");
});

test("the list is bounded, and a bare object is a list of one", () => {
  const many = Array.from({ length: MAX_REQUIREMENTS + 8 }, (_, i) => ({ need: "need " + i, status: "covered" }));
  assert.equal(cleanRequirements(many).list.length, MAX_REQUIREMENTS);
  assert.equal(cleanRequirements({ need: "one", status: "covered" }).list.length, 1);
  assert.deepEqual(cleanRequirements(null).list, []);
  assert.deepEqual(cleanRequirements(undefined).skipped, []);
});

test("unresolved is everything but covered, and the counts separate the three", () => {
  const list = cleanRequirements([
    { need: "a", status: "covered", by: "x" },
    { need: "b", status: "elsewhere", step: "page" },
    { need: "c", status: "unsupported", why: "no" },
  ]).list;
  assert.deepEqual(unresolvedRequirements(list).map((r) => r.need), ["b", "c"]);
  assert.deepEqual(requirementsByStep(list), { page: ["b"] });
  assert.deepEqual(requirementCounts(list, [{ need: "", why: "no-need" }]),
    { total: 3, covered: 1, elsewhere: 1, unsupported: 1, unreadable: 1 });
  assert.deepEqual(unresolvedRequirements(null), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEPARATE FROM THE DATABASE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

test("the coverage list is a sibling of the kind and never a field inside TABLE_ITEM", () => {
  // INSIDE `TABLE_ITEM` IT WOULD REACH `design_schema`, which binds that item by
  // identity — so it would enlarge the build's tool (93,598 characters, of
  // which `components` alone is 32,603) and become a promise
  // `declarable-enforced.test.mjs` requires the schema ENGINE to keep. It is
  // neither: no DDL is emitted from it and nothing is stored in `_meta`.
  assert.ok(!Object.keys(TABLE_ITEM.properties).includes("requirements"),
    "the coverage list is inside TABLE_ITEM, which design_schema binds by identity");
  const cols = TABLE_ITEM.properties.columns.items.properties;
  assert.ok(!Object.keys(cols).includes("requirements"), "the coverage list leaked into the column shape");
  // AND THE ENGINE NEVER SEES IT. Handed one on a table, `normalizeSchema` must
  // not keep it — driven rather than reasoned, because "the engine ignores it"
  // is exactly the kind of claim that is true until somebody adds an alias.
  const n = normalizeSchema({ tables: [{ name: "t", columns: [{ name: "c", type: "text" }], requirements: [{ need: "x", status: "covered" }] }] });
  assert.equal(n.tables[0].requirements, undefined, "the engine kept the coverage metadata as if it were a guarantee");
  // THE TOOL OFFERS IT WHERE THE KIND ASKS, and the set is DERIVED from the
  // kinds' own flag — one word adds a second kind and no list disagrees.
  // RE-ANCHORED 2026-09-14: this asserted `["table"]`, and the change is that
  // it spread to EVERY kind that designs something. The property is not the
  // one-ness — it is that the list is exactly the kinds with a tool of their
  // own, so a kind that DISPATCHES (photo) can never be on it, and a kind that
  // designs can never be off it by an oversight. Both directions, derived.
  const designing = ADD_KINDS.filter((k) => !addLayer(k));
  assert.deepEqual(REQUIREMENT_ADDS, ["table", "function", "api", "job", "page", "component"],
    "the six designing kinds that answer coverage changed — say which and why");
  for (const k of REQUIREMENT_ADDS) {
    assert.ok(designing.includes(k), "`" + k + "` answers coverage and has no tool of its own to answer it in");
  }
  for (const k of ADD_KINDS) {
    if (addLayer(k)) assert.ok(!REQUIREMENT_ADDS.includes(k), "`" + k + "` dispatches and cannot answer coverage");
  }
  assert.ok(designing.length >= REQUIREMENT_ADDS.length, "the census read nothing");
  // ONE ITEM OBJECT, BY IDENTITY, ACROSS ALL SIX. The prose is kind-neutral
  // rather than per-kind on purpose: six copies of the shape would be six
  // places for the wording to drift, and the only thing that was ever
  // table-specific was two nouns.
  for (const k of REQUIREMENT_ADDS) {
    const t = addTool(k);
    assert.equal(t.input_schema.properties.requirements.items, REQUIREMENT_ITEM, k + "'s tool carries a second copy of the item");
    assert.equal(t.input_schema.properties.requirements.maxItems, MAX_REQUIREMENTS);
  }
  // …AND IT NAMES NO ONE TIER. `table` in the prose is an example among five,
  // never the subject — a function step told to name "the table" would have
  // nothing to name.
  const itemText = JSON.stringify(REQUIREMENT_ITEM);
  assert.ok(!/the tables you designed here/.test(itemText), "the item still addresses the table step alone");
  // …AND A KIND THAT DOES NOT DESIGN DOES NOT CARRY IT. `qr` and `three` have
  // tools of their own and answer no coverage, so their tools are byte-identical
  // to what they were.
  assert.equal(addTool("qr").input_schema.properties.requirements, undefined);
  assert.equal(addTool("three").input_schema.properties.requirements, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE EIGHT HOPS — including the two shapes it exists for
// ─────────────────────────────────────────────────────────────────────────────

test("HOP 2: the reader hands back an explicit shape, and a sibling is not dropped", async () => {
  // THE DEFECT THIS CLOSES. `readAddAnswer` returned `use.input[kind]`, so a
  // sibling property the model wrote was dropped ONE HOP after it was written —
  // the tool correct, the model correct, every later step correct. This
  // repository's most-repeated defect, and the reason the list could not simply
  // be added to the tool.
  const reply = toolReply("add_to_site", {
    table: [{ table: { name: "bookings", columns: [{ name: "slot", type: "text" }] } }],
    requirements: [{ need: "a visitor can book", status: "covered", by: "bookings.slot" }],
  });
  const answer = readAddAnswer(reply, "table");
  assert.ok(Array.isArray(answer.value), "the kind's own answer is gone");
  assert.equal(answer.requirements.length, 1);
  assert.equal(answer.requirements[0].need, "a visitor can book");
});

test("HOP 3: the runner carries both arrays on EVERY return, failures included", async () => {
  const reqs = [{ need: "n", status: "unsupported", why: "w" }];
  // (a) AN ANSWER THAT DESIGNED NOTHING. The shape this exists for: the model
  // could not express the ask, so `value` is undefined and the REASON is the
  // only thing worth reading.
  const declined = await runAdd({ send: async () => toolReply("add_to_site", { table: null, requirements: reqs }) },
    { kind: "table", message: "x", site: {}, model: "m" });
  assert.equal(declined.value, undefined, "a declined answer is not nothing");
  assert.equal(declined.requirements.length, 1, "a declined answer lost the reason it declined");
  assert.equal(declined.requirements[0].status, "unsupported");
  // (b) A THROW, and (c) A TRUNCATION. Both must still carry the arrays, or a
  // consumer that iterates without checking throws on the failure paths — which
  // are exactly where nobody looks.
  const dead = await runAdd({ send: async () => { throw new Error("boom"); } }, { kind: "table", message: "x", site: {}, model: "m" });
  assert.deepEqual(dead.requirements, []); assert.deepEqual(dead.reqSkipped, []);
  const cut = await runAdd({ send: async () => ({ ...toolReply("add_to_site", { requirements: reqs }), stop_reason: "max_tokens" }) },
    { kind: "table", message: "x", site: {}, model: "m" });
  assert.equal(cut.failed, true);
  assert.deepEqual(cut.requirements, [], "a truncated answer's half-read list was kept");
  // (d) THE UNREADABLE ENTRIES RIDE OUT TOO, so the record can say what it
  // could not read rather than only how many it could.
  const messy = await runAdd({ send: async () => toolReply("add_to_site", { table: [], requirements: [{ need: "n", status: "??" }] }) },
    { kind: "table", message: "x", site: {}, model: "m" });
  assert.equal(messy.reqSkipped.length, 1);
});

test("HOP 4: the fold carries the list even when the answer designed nothing", () => {
  // THE FILTER IS THE POINT. `foldAdds` drops an answer with no `value` —
  // correctly, there is nothing to fold — so a list read off the FOLDED answers
  // vanishes for exactly the answer that matters most.
  const fold = foldAdds([{ kind: "table", value: null, requirements: [{ need: "row history", status: "unsupported", why: "not offered" }] }], null, null);
  assert.equal(fold.requirements.length, 1, "the fold dropped the coverage list with the empty answer");
  assert.equal(fold.requirements[0].need, "row history");
  assert.deepEqual(fold.designed, {}, "an answer with no value folded into a design anyway");
  // AND A SKIPPED ENTRY'S COVERAGE SURVIVES: the cleaner kept one table and
  // refused another, and the list is the DESIGNER's, not the cleaner's.
  const partial = foldAdds([{
    kind: "table",
    value: [{ table: { name: "bookings", columns: [{ name: "slot", type: "text" }] } }],
    requirements: [{ need: "a", status: "covered", by: "bookings" }, { need: "b", status: "elsewhere", step: "page" }],
  }], null, null);
  assert.equal(partial.requirements.length, 2);
  assert.deepEqual(partial.designed.tables.map((t) => t.name), ["bookings"]);
});

test("HOP 4b: a requirement handed to the page step reaches the page step's directive", () => {
  const list = cleanRequirements([
    { need: "the page lists the customer's own bookings", status: "elsewhere", step: "page" },
    { need: "a nightly reminder goes out", status: "elsewhere", step: "job" },
    { need: "the slot cannot be double booked", status: "covered", by: "unique slot" },
  ]).list;
  const brief = requirementBrief(list, "page");
  assert.match(brief, /the page lists the customer's own bookings/);
  // ONLY ITS OWN, and only the NEED — the page writer is being told what the
  // page has to make possible, and "the table step could not express this" is
  // our bookkeeping, not an instruction.
  assert.doesNotMatch(brief, /nightly reminder/, "another step's requirement leaked into the page brief");
  assert.doesNotMatch(brief, /double booked/, "a covered requirement was handed on as outstanding");
  assert.doesNotMatch(brief, /elsewhere|unsupported|covered/, "the status tokens reached the page writer");
  assert.equal(requirementBrief(list, "qr"), "", "a step that owns nothing still gets a block");
  // AND IT REALLY LANDS IN THE FOLD'S DIRECTIVE, after the additions' own
  // blocks — read off the fold rather than off the composer, because a
  // composer nobody calls is the wiring trap one layer down.
  const fold = foldAdds([{
    kind: "table",
    value: [{ table: { name: "bookings", columns: [{ name: "slot", type: "text" }] } }],
    requirements: list,
  }], null, null);
  assert.match(fold.directive, /the page lists the customer's own bookings/, "the page brief never reached the directive");
  assert.ok(fold.directive.indexOf("bookings") < fold.directive.lastIndexOf("the page lists"),
    "the outstanding work is printed before the addition it belongs to");
});

test("HOPS 3, 5, 6, 7 and 8 are wired in the route, each read by its own condition", () => {
  const at = (needle, what) => {
    const i = W.indexOf(needle);
    assert.ok(i > 0, "landmark moved: " + what);
    return i;
  };
  const runAt = at("const ran = await runAdd(", "the designer call");
  // HOP 3 IS ABOVE EVERY EXIT BELOW IT. A list collected after the decline
  // check, after the cleaner's refusal or after the truncation check is a list
  // that vanishes in exactly the three cases worth reading it in.
  const collect = at("for (const r of Array.isArray(ran.requirements) ? ran.requirements : []) aReq.push(r);", "the collect");
  const decline = W.indexOf("if (ran.value === undefined) { aDeclined.push(k); continue; }", runAt);
  const refuse = W.indexOf('error: "add", kind: k, reason: clean.why', runAt);
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
  const runEnd = W.indexOf(";", tail) + 1;
  assert.ok(runEnd > runAt && runEnd < collect, "the designer call's own end could not be found");
  const between = W.slice(runEnd, collect);
  assert.doesNotMatch(between, /\bif\s*\(/, "the collect sits behind a condition — a declined designer's reason is lost again");
  assert.doesNotMatch(between, /[{}]/, "a block opens between the designer call and the collect");
  // …AND THE SPAN IS REAL: an empty one satisfies both absences perfectly.
  assert.ok(between.length > 100, "the span is too short to have tested anything: " + between.length);
  // HOP 5 AND 6: every exit carries it. Four of them, and the two failures are
  // the ones that matter — an `ok: false` is where a customer most needs to
  // hear what the change could not do.
  const spread = W.split("...aCoverage(").length - 1;
  assert.ok(spread >= 4, "not every exit carries the coverage: " + spread + " of 4");
  assert.match(W, /error: "add", kind: k, reason: clean\.why, cost: 0, msg: addRefusal\(clean\.why, k\), \.\.\.aCoverage\(\)/,
    "a cleaner's refusal drops the coverage");
  assert.match(W, /error: "declined", kinds: aDeclined, cost: 0, msg: addRefusal\("nothing"\), \.\.\.aCoverage\(\)/,
    "the all-declined answer drops the coverage — the one shape this was built for");
  // RE-ANCHORED 2026-09-14. The composer took the kinds that RAN and decided a
  // hand-off against them; it reads `aTold` — the steps really handed an
  // outstanding requirement — so every call site is the same call, and the
  // argument that used to distinguish a failure from a success is gone. What
  // replaces that assertion is the pair below: the composer reads `aTold` and
  // the loop fills it only where the brief is really composed.
  assert.match(W, /told: \[\.\.\.aTold\]/, "the composer no longer reads which steps were really told");
  assert.match(W, /const aBrief = requirementBrief\(aReq, k\);\s*\n\s*if \(aBrief\) aTold\.add\(k\);/,
    "a step is recorded as told without the brief being composed, or the brief is composed and not recorded");
  // ── AND THE COMPOSER READS WHAT REALLY HAPPENED ──────────────────────────
  //
  // RE-ANCHORED 2026-09-14. This used to check that the composer did not
  // overwrite the `ranKinds` argument it was handed — a real sweep survivor,
  // and a parameter that no longer exists: a hand-off is settled by whether
  // the receiving step was TOLD, not by whether it ran, so there is one call
  // and one set. What replaces the old assertion is the pair below, which is
  // the same property one layer over: the composer must read the recorded
  // `aTold` and the APPLIED result, and must not reach for the picked kinds.
  const covAt = at("const aCoverage = () => {", "the coverage composer");
  const covBody = W.slice(covAt, W.indexOf("\n            };", covAt));
  assert.ok(covBody.length > 200, "the composer's body could not be found: " + covBody.length);
  assert.match(covBody, /told: \[\.\.\.aTold\]/, "the note is not told which steps were handed a requirement");
  assert.match(covBody, /made: aMade\(\)/, "the note is not told what was really applied");
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
  const recAt = W.indexOf("const aRecord = () => requirementRecord({");
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
  for (const field of ["failed: [...aFailedKinds]", "made: aMade()", "told: [...aTold]", "altered: [...aChanged]", "unbuilt: aUnbuilt"]) {
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
  const noteAt = W.indexOf("requirementNote(aReq, { told:");
  assert.ok(noteAt > 0, "the customer's coverage sentence is gone");
  const noteCall = W.slice(noteAt, W.indexOf("})", noteAt) + 2);
  for (const field of ["failed: [...aFailedKinds]", "made: aMade()", "told: [...aTold]"]) {
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
  const madeAt = W.indexOf("const aMade = () => appliedFacts({");
  assert.ok(madeAt > 0, "the evidence reader is gone");
  const made = W.slice(madeAt, W.indexOf("});", madeAt) + 3);
  for (const list of ["tables: aTables", "altered: aAltered", "functions: aFunctions", "apis: aApis", "jobs: aJobs", "fnErrors: aFnErrors"]) {
    assert.ok(made.includes(list), "the evidence does not read what this change really applied: no `" + list + "`");
  }
  // NOT the model's answer, and NOT the proposal: `aAnswers`/`aDesigned` are
  // what was SAID, and `aNewNames` is what was going to be done.
  assert.doesNotMatch(made, /aAnswers|aDesigned|aNewNames/, "a claim is checked against itself, or against the proposal");
  // …AND THE GUARANTEES ARE THE ENGINE'S OWN VOCABULARY, read where they can be
  // DRIVEN. This lived inline in the route until a sweep mutant that emptied
  // `fails` survived: the only route path that applies a table wants a
  // container, so the wall could not be reached from a unit test at all.
  // `test/addon-steps.test.mjs` drives `appliedFacts`; what is asserted here is
  // that the route still goes through it.
  const FACTS = fs.readFileSync(new URL("../builder/site-add.mjs", import.meta.url), "utf8");
  const tfAt = FACTS.indexOf("export function appliedFacts(");
  assert.ok(tfAt > 0, "the per-item guarantee reader is gone");
  const facts = FACTS.slice(tfAt, FACTS.indexOf("\n}", tfAt));
  assert.match(facts, /resolveAccess\(t\)/, "a table's applied permissions are not read");
  assert.match(facts, /\[\.\.\.new Set\(\[\.\.\.Object\.keys\(ACCESS_PRESETS\), \.\.\.READ_LEVELS, \.\.\.WRITE_LEVELS\]\)\]/,
    "the access vocabulary is a second list instead of the engine's own");
  // HOP 8: the trace, counts only — `tr.at` keeps finite numbers and drops
  // everything else, and the needs are the customer's words.
  const markAt = W.indexOf('aMark("coverage", "ok", {');
  assert.ok(markAt > 0, "the coverage leaves no trace mark");
  const markCall = W.slice(markAt, W.indexOf("});", markAt) + 3);
  assert.ok(markCall.includes("...requirementCounts(aReq, aReqSkipped)"), "the mark lost the counts");
  assert.ok(markCall.includes("bad: aBadProps.size"), "the mark lost the invalid-property count");
  // …AND THE THREE STATES BESIDE THE THREE STATUSES, or a run where every
  // claim was unverifiable is indistinguishable from one where every claim held.
  // RE-ANCHORED 2026-09-15: `gone` and `unsent` join them, because a run whose
  // implementation is MISSING and one whose hand-off was never DELIVERED are
  // two different facts and both were previously folded into `broke`.
  for (const k of ["done:", "broke:", "unsure:", "gone:", "unsent:", "unbuilt:"]) {
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
  for (const field of ["told: [...aTold]", "failed: [...aFailedKinds]", "made: aMade()"]) {
    assert.ok(stCall.includes(field), "the mark's outcomes lose `" + field + "`");
  }
  // THE NEEDS THEMSELVES STAY OFF THE MARK — they are the customer's own words.
  assert.doesNotMatch(markCall, /\baReq\b(?!, aReqSkipped)/, "a customer's words reached a telemetry row");
  // AND THE PICKER GETS THE SITE, not a digest of names.
  assert.match(W, /\{ message: aInstruction, current: siteNote\(aSite\), model: aModels\.quick \}/,
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
  const factsAt = W.indexOf("const siteFacts = (spec) => ({");
  assert.ok(factsAt > 0, "the site facts are not built from a spec — the designers cannot be shown the proposal");
  const siteLit = W.slice(factsAt, W.indexOf("});", factsAt));
  assert.ok(siteLit.length > 500, "the site literal could not be read: " + siteLit.length);
  assert.match(siteLit, /tableInfo: tableFacts\(spec\),/, "the designers are shown a site with no table facts on it");
  // …AND IT IS REALLY RE-BUILT, not built once. A `siteFacts` with one caller
  // is the old behaviour wearing a function's name.
  assert.ok((W.match(/siteFacts\(a(?:Baseline|Proposed)\)/g) || []).length >= 2,
    "the site facts are built once — a later designer is shown the site as it was before this message");
  assert.match(W, /aProposed = proposedSpec\(aProposed, k, clean\.value\)/, "the proposal never accumulates");
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
  assert.match(W, /coverNote: \[\n\s*requirementNote\(/, "the server sends a field the browser does not read");
  assert.match(W, /missingPagesNote\(aMissing\),/, "the missing-page sentence never reaches the field the browser prints");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. COMPLETION REPORTING
// ─────────────────────────────────────────────────────────────────────────────

test("requirementNote says only what is still outstanding, in the customer's terms", () => {
  const list = cleanRequirements([
    { need: "a visitor can book a slot", status: "covered", by: "bookings.slot" },
    { need: "the page shows their bookings", status: "elsewhere", step: "page" },
    { need: "the owner sees what changed on a repair", status: "unsupported", why: "row history is not something I can switch on" },
  ]).list;
  // RE-ANCHORED 2026-09-14, TWICE. First (owner: "Something existing does not
  // prove the requirement works") a requirement whose step merely RAN stopped
  // reading as covered. Then (owner: "'Delivered' still means a name matched …
  // Use actual results and evidence for the specific requirement") the evidence
  // itself changed: `names` — the identifiers off the PROPOSED design — became
  // `made`, what was really APPLIED, with the guarantees each item really
  // carries; and `ran` became `told`, the steps that were really handed an
  // outstanding requirement, because the kinds run in order and a hand-off to a
  // step that already ran reaches nobody.
  // RE-ANCHORED A THIRD TIME, 2026-09-14 (owner: "Matching configuration words
  // must not mark an entire business requirement delivered"). `holds` is
  // CONFIGURATION — a setting read back off what was applied — and matching one
  // no longer settles a behavioural need; only a `checked` token does, and
  // nothing produces those. So the covered claim below joins the unverified
  // clause instead of disappearing from the sentence.
  const made = [{ name: "bookings", holds: ["slot", "unique", "own"], fails: ["anyone", "public", "members"], checked: [] }];
  const done = requirementNote(list, { told: ["page"], made });
  assert.match(done, /owner sees what changed/);
  assert.match(done, /row history is not something I can switch on/);
  assert.doesNotMatch(done, /Still to do: the page shows their bookings/,
    "a requirement whose step was really told is reported as outstanding");
  assert.match(done, /can't confirm from here that/,
    "a step that was merely told is read as proof the need was met");
  assert.match(done, /can book a slot/,
    "a configuration word settled a behavioural requirement");
  // RE-ANCHORED A FOURTH TIME, 2026-09-15 (owner, on run 48: "A requirement
  // sent backward to an earlier step is an unresolved handoff; that alone does
  // not establish that its implementation is missing"). **Both halves are
  // asserted here, because separating them IS the fix.**
  //
  // THE PAGE STEP WAS NEVER TOLD — a job-only addition runs no page call — so
  // the hand-off is outstanding either way; what changes the SENTENCE is
  // whether this layer can see that no page was made. `reportable` is what
  // says so: a kind this change never ran made nothing, definitionally.
  const owing = requirementNote(list, { told: ["job"], made, reportable: ["page"] });
  assert.match(owing, /Still to do: the page shows their bookings/);
  // …AND RUN 48'S OWN SHAPE: the same undelivered hand-off, with the work
  // really there. "Still to do" about a live page is the sentence that failed
  // live; the hand-off is still counted, in the record, where it is actionable.
  const shipped = [...made, { kind: "page", name: "/bookings", holds: [], fails: [], checked: [] }];
  const late = requirementNote(list, { told: ["job"], made: shipped, reportable: ["page"] });
  assert.doesNotMatch(late, /Still to do: the page shows their bookings/,
    "a hand-off nobody delivered was reported as work that is not there");
  assert.match(late, /can't confirm from here that[^.]*the page shows their bookings/,
    "the page was built and the customer heard nothing about it at all");
  const lateOut = requirementOutcomes(list, { told: ["job"], made: shipped, reportable: ["page"] });
  assert.equal(lateOut.filter((r) => r.handoff === "undelivered").length, 1,
    "the undelivered hand-off stopped being reported once it stopped being said as `missing`");
  // A STEP THAT WAS TOLD AND FAILED IS NOT A STEP THAT DELIVERED. This is the
  // one reading that must never collapse into `unverified`: we have positive
  // evidence of a problem, which is the only kind this layer ever really gets.
  // It is `blocked` rather than `missing` since 2026-09-15 — the dependency
  // this need was handed to failed, which points a customer somewhere else.
  const broke = requirementNote(list, { told: ["page"], failed: ["page"], made });
  assert.match(broke, /waiting on another part of the same change that didn't work: the page shows their bookings/);
  // NOTHING OUTSTANDING AND NOTHING UNCONFIRMED IS AN EMPTY STRING, never a
  // reassuring sentence: a `✅ Done.` with nothing after it has always meant
  // nothing was left over. It takes a CHECKED GUARANTEE now.
  // A CHECKED BEHAVIOUR — the only thing that answers `delivered` — is what
  // buys silence now. The configuration version of the same claim is the line
  // below it, and it speaks.
  const exercised = [{ name: "bookings", holds: [], fails: [], checked: ["own"] }];
  assert.equal(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings, one row per owner (own)" }]).list,
    { told: [], made: exercised }), "");
  assert.match(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings, one row per owner (own)" }]).list,
    { told: [], made }), /can't confirm from here/,
    "a configuration fact bought silence about a behaviour nobody checked");
  // …AND EXISTENCE ALONE IS NOT SILENCE: a claim that names the table and
  // nothing checkable about it is exactly the shape the owner corrected.
  assert.match(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings holds them" }]).list, { told: [], made }),
    /can't confirm from here/, "a bare name match passed as delivered");
  // …and a claim that CONTRADICTS what was applied is not evidence either.
  assert.match(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings, readable by anyone" }]).list, { told: [], made }),
    /can't confirm from here/, "a claim disagreeing with the applied permissions passed as delivered");
  assert.match(requirementNote(cleanRequirements([{ need: "a", status: "covered" }]).list, { told: [], made }),
    /can't confirm from here/, "a claim with nothing to check against passed as delivered");
  assert.equal(requirementNote([], {}), "");
  assert.equal(requirementNote(null, {}), "");
});

test("the six states separate implementation from hand-off, and evidence is asymmetric", () => {
  // RE-ANCHORED 2026-09-15 (owner, on run 48): three states could not express
  // what run 48 met — a hand-off nobody delivered whose work was nonetheless
  // live. `configured` splits a matched SETTING off `unverified`; `missing`
  // and `blocked` split "this layer looked and it is not there" and "the part
  // it needed failed" off `failed`, which now means only our own refusal.
  assert.deepEqual(REQUIREMENT_STATES,
    ["delivered", "configured", "unverified", "missing", "blocked", "failed"]);
  const list = cleanRequirements([
    { need: "book a slot", status: "covered", by: "bookings.slot is unique" },
    { need: "only the owner sees a number", status: "covered", by: "a row-level guarantee" },
    { need: "show the diary", status: "elsewhere", step: "page" },
    { need: "text a reminder", status: "elsewhere", step: "job" },
    { need: "take crypto", status: "unsupported", why: "cards only" },
  ], "table").list;
  const made = [{ name: "bookings", holds: ["slot", "unique", "own"], fails: ["anyone", "public", "members"], checked: [] }];
  const got = requirementOutcomes(list, { told: ["page"], failed: ["job"], made });
  // RE-ANCHORED 2026-09-14 (owner: "Matching configuration words must not mark
  // an entire business requirement delivered"). `holds` is CONFIGURATION, so
  // the first entry reads UNVERIFIED with the fact it matched recorded beside
  // it — a different kind of unverified from the second, which matched nothing.
  // RE-ANCHORED AGAIN 2026-09-15: the first entry's matched setting is its own
  // STATE rather than a note beside `unverified`, and the hand-off to the step
  // that FAILED is `blocked` — a dependency to point at, not our own refusal.
  assert.deepEqual(got.map((r) => r.state), ["configured", "unverified", "unverified", "blocked", "failed"]);
  assert.equal(got[0].configuredBy, "bookings: slot", "the configuration that was checked is not recorded");
  assert.equal(got[1].configuredBy, undefined, "a claim that matched nothing was recorded as checked configuration");
  // …AND A BEHAVIOUR SOMETHING REALLY EXERCISED IS STILL DELIVERED. The door
  // is real and nothing on this path fills it, which is the honest state and
  // is said in as many words in `appliedFacts`.
  const exercised = [{ name: "bookings", holds: [], fails: [], checked: ["unique"] }];
  assert.equal(requirementOutcomes(list, { told: ["page"], failed: ["job"], made: exercised })[0].state, "delivered");
  assert.match(got[3].why, /job step could not do its part/);
  // THE OWNING STEP OF A `covered` ENTRY IS THE ONE THAT ANSWERED IT, stamped
  // by `cleanRequirements` — without it a step that refused everything would
  // still have its own claims read as delivered.
  assert.equal(list[0].from, "table");
  const refused = requirementOutcomes(list, { told: ["page"], failed: ["table"], made: exercised });
  assert.equal(refused[0].state, "failed", "a claim made by a step that then failed was read as delivered");
  // ── A STEP NOBODY TOLD, SPLIT IN TWO (owner, 2026-09-15) ─────────────────
  //
  // *"A requirement sent backward to an earlier step is an unresolved handoff;
  // that alone does not establish that its implementation is missing."* The
  // hand-off is reported either way; what decides the STATE is whether this
  // layer can see that nothing of that kind was made. `reportable` is what
  // says so, and without it the honest answer is that we cannot tell.
  const untold = requirementOutcomes(list, { told: [], made: [] })[2];
  assert.equal(untold.handoff, "undelivered", "a hand-off that reached nobody stopped being reported");
  assert.equal(untold.state, "unverified", "a hand-off nobody delivered was read as proof the work is absent");
  const looked = requirementOutcomes(list, { told: [], made: [], reportable: ["page"] })[2];
  assert.equal(looked.state, "missing", "a kind this change never ran made nothing, and that is knowable");
  assert.match(looked.why, /never got it/);
  // …AND THE SAME UNDELIVERED HAND-OFF OVER WORK THAT IS REALLY THERE — run
  // 48's own shape — is not missing, however loudly the hand-off is owed.
  const live = requirementOutcomes(list,
    { told: [], made: [{ kind: "page", name: "/diary", holds: [], fails: [], checked: [] }], reportable: ["page"] })[2];
  assert.equal(live.handoff, "undelivered");
  assert.equal(live.state, "unverified", "a page that was really built was reported as still to do");
  // EVIDENCE IS WORD-BOUNDED. `bookings` must not be found inside
  // `bookings_old`, or a claim name-dropping a table we did NOT make reads as
  // proof we did — the one way this check can lie rather than go quiet.
  assert.equal(evidenceName("bookings.slot is unique", ["bookings"]), "bookings");
  assert.equal(evidenceName("bookings_old holds it", ["bookings"]), "");
  assert.equal(evidenceName("see no_bookings", ["bookings"]), "");
  assert.equal(evidenceName("anything", []), "", "the observer answered with nothing to observe");
  // A ONE- OR TWO-LETTER NAME IS NOT EVIDENCE: it matches by accident.
  assert.equal(evidenceName("a is fine", ["a"]), "");
  // ── AND EXISTENCE IS NOT DELIVERY (owner, 2026-09-14) ────────────────────
  //
  // `claimEvidence` is what `requirementOutcomes` asks, and it needs a CHECKED
  // GUARANTEE on top of the name: the owner's own example is "customers see
  // only their own bookings" marked delivered because `by` mentioned
  // `bookings`, with nothing anywhere having looked at the permissions.
  assert.equal(claimEvidence("bookings holds them", made), null, "a bare name match is still evidence");
  // …AND WHAT IT ANSWERS NAMES ITS KIND: a configuration fact and a checked
  // behaviour are the same shape on the wire and mean opposite things to the
  // caller, so the kind rides on the answer rather than being inferred.
  assert.equal(claimEvidence("bookings, one row per owner (own)", made).token, "own");
  assert.equal(claimEvidence("bookings, one row per owner (own)", made).kind, "config");
  assert.equal(claimEvidence("bookings.slot is unique", made).name, "bookings");
  assert.equal(claimEvidence("bookings.slot is unique", [{ name: "bookings", holds: [], fails: [], checked: ["unique"] }]).kind, "checked");
  // A TOKEN THAT IS FALSE DENIES THE CLAIM, and it is asked FIRST: a claim
  // saying `anyone` about a table applied as `own` is not merely unproven, it
  // disagrees with the database, and reading on for an incidental word that
  // happens to hold would let it buy itself a verdict.
  assert.equal(claimEvidence("bookings is readable by anyone, one row per owner (own)", made), null,
    "a claim that contradicts the applied permissions was read as evidence");
  // A NAME NOBODY APPLIED IS NOT EVIDENCE WHATEVER IT CLAIMS.
  assert.equal(claimEvidence("waitlist.slot is unique", made), null);
  assert.equal(claimEvidence("bookings.slot is unique", []), null, "the observer answered with nothing applied");
  assert.equal(claimEvidence("", made), null);
  assert.equal(claimEvidence(["bookings.slot"], made), null, "String(['x']) is 'x' — a non-string was coerced");
});

test("an invalid property is said as a lost guarantee, never by its name", () => {
  const one = requirementNote([], { invalid: ["encryptAtRest"] });
  assert.match(one, /guarantee it doesn't offer/);
  assert.doesNotMatch(one, /encryptAtRest/, "a schema property name reached the customer");
  const many = requirementNote([], { invalid: ["encryptAtRest", "gdprMode"] });
  assert.match(many, /2 guarantees/, "the count is not said, so the customer cannot tell one from several");
  assert.doesNotMatch(many, /gdprMode/);
  // …AND IT IS SAID BESIDE the outstanding requirements, not instead of them.
  const both = requirementNote(cleanRequirements([{ need: "n", status: "unsupported", why: "w" }]).list, { invalid: ["x"] });
  assert.match(both, /can't do yet/);
  assert.match(both, /guarantee it doesn't offer/);
});

test("the developer record keeps everything the customer is not told", () => {
  const rec = requirementRecord({
    list: cleanRequirements([{ need: "a", status: "elsewhere", step: "page" }, { need: "b", status: "covered" }]).list,
    skipped: [{ need: "c", why: "bad-status" }],
    invalid: ["encryptAtRest"],
    ran: ["table"],
  });
  // RE-ANCHORED 2026-09-14: the counts gained the three STATES beside the three
  // statuses. A status is what the model SAID; a state is what really became of
  // it, and keeping both is what makes "the designer said covered and nothing
  // here could confirm it" countable.
  // RE-ANCHORED AGAIN 2026-09-15: six states, and `a` is no longer counted as a
  // failure. It was handed to a step that never heard it — a HAND-OFF defect,
  // which is its own ledger now — and with no `reportable` this record cannot
  // see whether a page was made, so `unverified` is the whole truth available.
  assert.deepEqual(rec.counts, { total: 2, covered: 1, elsewhere: 1, unsupported: 0, unreadable: 1,
    delivered: 0, configured: 0, unverified: 2, missing: 0, blocked: 0, failed: 0 });
  assert.deepEqual(rec.requirements.map((r) => r.state), ["unverified", "unverified"]);
  // …AND THE HAND-OFF IS STILL REPORTED, which is the half that must not be
  // lost when it stops being said as work that is not there.
  assert.deepEqual(rec.handoffs, { delivered: 0, undelivered: 1 },
    "the hand-off ledger stopped counting a step that never heard its requirement");
  // …AND A RECORD THAT CAN SEE THE PAGE STEP MADE NOTHING SAYS SO.
  const sighted = requirementRecord({
    list: cleanRequirements([{ need: "a", status: "elsewhere", step: "page" }, { need: "b", status: "covered" }]).list,
    ran: ["table"], reportable: ["page"],
  });
  assert.equal(sighted.counts.missing, 1, "a kind this change never ran is not read as having made nothing");
  assert.deepEqual(sighted.handoffs, { delivered: 0, undelivered: 1 });
  assert.deepEqual(rec.invalidProps, ["encryptAtRest"], "the property name is not kept for the developer either");
  assert.deepEqual(rec.handedTo, { page: ["a"] });
  assert.deepEqual(rec.unreadable, [{ need: "c", why: "bad-status" }]);
  assert.deepEqual(rec.ran, ["table"]);
  // WHAT THE ENGINE DROPPED WHOLE, PER TIER — the report that did not exist
  // above the table tier at all, so a job that vanished had no record anywhere.
  const withUnbuilt = requirementRecord({ failed: ["job"], unbuilt: { job: ["remind"] } });
  assert.deepEqual(withUnbuilt.unbuilt, { job: ["remind"] });
  assert.deepEqual(withUnbuilt.failedSteps, ["job"]);
  assert.deepEqual(requirementRecord().counts, { total: 0, covered: 0, elsewhere: 0, unsupported: 0, unreadable: 0,
    delivered: 0, configured: 0, unverified: 0, missing: 0, blocked: 0, failed: 0 });
  assert.deepEqual(requirementRecord().handoffs, { delivered: 0, undelivered: 0 });
  assert.deepEqual(requirementRecord().unbuilt, {});
  // THE COUNTS COVER EVERY STATE THE MODULE CAN PRODUCE, asked of the list
  // rather than of this fixture — a state added next month with no counter is a
  // run whose record silently under-reports it.
  for (const s of REQUIREMENT_STATES) {
    assert.ok(Object.hasOwn(requirementRecord().counts, s), "the record has no counter for `" + s + "`");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. VALIDATING WHAT THE MODEL WROTE
// ─────────────────────────────────────────────────────────────────────────────

test("a property the engine cannot keep is reported, and every documented alias survives", () => {
  // DERIVED, NEVER A LIST. `droppedFields` reports a property only when removing
  // it changes NOTHING the engine keeps — so an alias passes by construction,
  // because an alias changes the answer. A list of accepted names here would be
  // the second copy of the parser's alias map.
  const invented = { name: "repairs", columns: [{ name: "bike", type: "text" }], encryptAtRest: "aes" };
  assert.deepEqual(droppedFields({ tables: [invented] }), ["encryptAtRest"]);
  // THE ALIASES ARE THE CONTROL, and without them this check cannot tell "the
  // engine refused it" from "the reader does not know the name". Each of these
  // is a DOCUMENTED alias in the parser and must NOT be reported.
  for (const [alias, canonical] of [["softDelete", "trash"], ["optimisticLock", "version"], ["updatedAt", "timestamps"], ["sortable", "ordered"], ["auditLog", "audit"], ["revisions", "history"]]) {
    const t = { name: "t", columns: [{ name: "c", type: "text" }], [alias]: true };
    assert.deepEqual(droppedFields({ tables: [t] }), [], alias + " reads as invented, but it is the documented alias for " + canonical);
    assert.equal(normalizeSchema({ tables: [t] }).tables[0][canonical], true, alias + " no longer reaches " + canonical);
  }
  // AN OFFERED PROPERTY THE ENGINE BINNED is the other half, and it is a
  // different report: `refusedFields`, not `droppedFields`.
  assert.deepEqual(refusedFields({ tables: [{ name: "t", columns: [{ name: "c", type: "text" }], transitions: [{ nonsense: true }] }] }), ["transitions"]);
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
  assert.match(block, /auditTier\(\{ \[tier\]: mine \}, k, withMine, \{ sent \}\)/, "the per-tier audit is gone");
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
  assert.match(block, /const withMine = proposedSpec\(aProposed, k, clean\.value\)/,
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. THE EXISTING-SITE CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

test("the site note carries structures, relationships, permissions and constraints", () => {
  // DERIVED FROM A REAL STORED SPEC through `normalizeSchema`, never a
  // hand-typed fixture of what one looks like — the recorded "a fixture in a
  // different shape from reality" trap, which this repository has met with a
  // trailing slash and with a list of one.
  const spec = normalizeSchema({
    tables: [
      { name: "bookings", access: "user", columns: [{ name: "slot_id", type: "integer", ref: "slots" }, { name: "name", type: "text" }], unique: ["slot_id"] },
      { name: "slots", access: "display", columns: [{ name: "starts_at", type: "text" }] },
    ],
  });
  // `refs` and `rules` are DERIVED AT APPLY TIME, not by the normaliser (they
  // are in `DERIVED_TABLE_FIELDS`), so a stored spec read back from `_meta`
  // carries them and this one does not. Supplied here the way the store does.
  spec.tables[0].refs = { slot_id: "slots" };
  const facts = tableFacts(spec);
  assert.equal(facts.bookings.access, "user", "the access is not resolved from the pair");
  assert.deepEqual(facts.bookings.refs, { slot_id: "slots" });
  assert.ok(facts.bookings.guarantees.includes("unique"), "a declared constraint is not named");
  assert.ok(!facts.slots.guarantees.includes("unique"), "a guarantee is claimed for a table that has none");
  // A GUARANTEE NAME THE TOOL DOES NOT OFFER IS NOT NAMED to a designer that
  // could not ask for it — the set is DERIVED from `TABLE_ITEM`, so it cannot
  // drift and a property added there appears here by existing.
  const offered = Object.keys(TABLE_ITEM.properties);
  for (const g of facts.bookings.guarantees) assert.ok(offered.includes(g), "the note names a guarantee the tool does not offer: " + g);
  // ── AND EVERY OFFERED GUARANTEE THE TABLE DECLARES IS NAMED ───────────────
  //
  // A SWEEP SURVIVOR. The check above is one-directional — it catches a name
  // the tool does not offer and passes over a reader that names only a handful
  // it happens to know. Replacing the derived set with a hand-typed list
  // survived every case in this file, because the fixture declared one
  // guarantee the list happened to contain. DRIVEN over a table declaring many,
  // so a reader missing any of them dies.
  const rich = normalizeSchema({
    tables: [{
      name: "orders", access: "feed",
      columns: [{ name: "email", type: "text" }, { name: "total", type: "integer" }],
      unique: ["email"], uniqueCI: ["email"], maxRows: 500, timestamps: true, expires: "email",
      scheduled: true, enforceRefs: true, oncePerUser: ["email"], defaultSort: "total",
    }],
  });
  const declared = Object.keys(TABLE_ITEM.properties)
    .filter((k) => !["name", "columns", "access", "read", "write", "retired"].includes(k))
    .filter((k) => {
      const v = rich.tables[0][k];
      if (!v) return false;
      return Array.isArray(v) ? v.length > 0 : (typeof v === "object" ? Object.keys(v).length > 0 : true);
    });
  assert.ok(declared.length >= 8, "the rich fixture declares too few guarantees to have tested anything: " + declared.length);
  assert.deepEqual(tableFacts(rich).orders.guarantees.slice().sort(), declared.slice().sort(),
    "the note names a different set than the table declares — a hand-typed list drifts from what the tool offers");
  // AND IT REACHES THE NOTE, worded once.
  const note = siteNote({ name: "X", hasDatabase: true, tables: ["bookings", "slots"], columns: { bookings: ["slot_id integer"] }, tableInfo: facts });
  assert.match(note, /bookings \(slot_id integer\) — access user; slot_id points at slots; keeps unique/);
  // A SITE DESCRIBED WITHOUT THE FACTS READS EXACTLY AS IT DID, so every
  // caller that does not supply them is unaffected.
  assert.match(siteNote({ name: "X", hasDatabase: true, tables: ["bookings"], columns: { bookings: ["slot_id integer"] } }),
    /It stores: bookings \(slot_id integer\)\./);

  // ── ONE TABLE PER LINE, AND WHY A CONTAINS-CHECK CANNOT SEE THIS ──────────
  //
  // FOUND BY PRINTING THE REAL NOTE, not by a guard: every assertion above is
  // about what the sentence CONTAINS, and the broken sentence contained all of
  // it. Joined with ", " the tables ran into one another —
  //
  //   It stores: bookings (…) — access user; keeps oncePerUser, enforceRefs,
  //   unique, sessions (title text) — access display.
  //
  // — in which `sessions` is indistinguishable from a fourth guarantee of
  // `bookings`, because the guarantee list and the table list used the same
  // separator. A designer that reads it that way designs a second table to
  // hold sessions, which is the exact failure this context exists to prevent.
  const two = siteNote({
    name: "X", hasDatabase: true, tables: ["bookings", "sessions"],
    columns: { bookings: ["slot text"], sessions: ["title text"] },
    tableInfo: {
      bookings: { access: "user", refs: {}, guarantees: ["oncePerUser", "enforceRefs", "unique"] },
      sessions: { access: "display", refs: {}, guarantees: [] },
    },
  });
  const rows = two.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(rows.length, 2, "the two tables are not two rows: " + JSON.stringify(two));
  assert.ok(rows[0].startsWith("- bookings ") && rows[1].startsWith("- sessions "),
    "a table does not begin its own row: " + JSON.stringify(rows));
  // THE PROPERTY ITSELF: no row may name another table, so a guarantee list
  // cannot swallow the next table's name however long it gets.
  assert.ok(!rows[0].includes("sessions"), "bookings' row names the next table: " + rows[0]);
  // AND THE OBSERVER IS ALIVE — this is partly an absence check, and a note
  // that said nothing at all would satisfy it perfectly.
  assert.match(rows[0], /keeps oncePerUser, enforceRefs, unique$/, "the guarantees left the row");
  assert.match(two, /It stores:\n- /, "the list lost its heading");
});

test("the picker is told a feature needing storage needs a table, without the word", () => {
  // ── WHAT THIS CAN AND CANNOT PROVE, SAID OUT LOUD ────────────────────────
  //
  // The owner asked to "test whether the picker recognizes features that need
  // storage without the customer explicitly asking for a database". Whether a
  // REAL model picks `table` for "add a login page" needs a paid call and is
  // NOT run here — it is named in the report as unproven. What is provable for
  // free, and is the half that was actually missing, is that the instruction
  // and the vocabulary are on the wire at all: the picker's system text was 402
  // characters with no site and no word connecting a feature to its storage, so
  // "add a login page" had nothing to route on.
  const req = pickRequest({ message: "add a login page", current: siteNote({ name: "X", hasDatabase: false }), model: "m" });
  const system = req.system[0].text;
  // THE IMPLICATION RULE, and the words a customer really uses.
  assert.match(system, /READ WHAT THE ASK NEEDS, NOT ONLY WHAT IT NAMES/);
  assert.match(system, /remembers something between one visit and the next/);
  for (const word of ["Signing in", "accounts", "members", "profiles", "favourite", "bookings"]) {
    assert.ok(system.includes(word), "the picker's vocabulary does not cover: " + word);
  }
  // AND THE KIND'S OWN HINT CARRIES IT TOO, because the hint is what the enum
  // describes — the system text and the hint are two hops and either alone is
  // half the instruction, exactly as `ADD_DESIGN_RULE` rides two.
  const hint = pickTool().input_schema.properties.kinds.description;
  assert.match(hint, /CANNOT WORK WITHOUT REMEMBERING SOMETHING BETWEEN VISITS/);
  assert.match(hint, /whether or not they mention a database/);
  // THE SITE IS ON THE WIRE, which is what lets it answer "does this already
  // exist" rather than guessing.
  assert.match(req.messages[0].content, /^Their site as it stands:\nThe site is called X\./);
  assert.match(req.messages[0].content, /It has NO database yet/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. THE ACCEPTANCE CASE
// ─────────────────────────────────────────────────────────────────────────────

test("ACCEPTANCE: the reproduced omitted requirement is now named rather than dropped", async () => {
  // THE CASE, as `scratchpad/repro-table-gap.mjs` reproduced it on 2026-09-13:
  // "let customers book a repair and see the history of what changed on it".
  // The tool cannot express `history` (0 mentions) and offers four column
  // properties, so the word left the design and nothing recorded it. The engine
  // DOES support `history` — it creates `_history` and a snapshot trigger — but
  // `droppedFields` cannot report it either, because it is un-offered and LIVE:
  // the third category neither diagnostic has.
  const tool = addTool("table");
  const text = JSON.stringify(tool);
  // THE GAP IS STILL REAL — this change does not expose `history`, deliberately
  // (owner: verify behaviour through the real application path first). What
  // changed is that it is now SAID.
  assert.equal(text.toLowerCase().split("history").length - 1, 0, "history became expressible — this case needs rewriting, not deleting");
  // …AND THE ENGINE REALLY DOES SUPPORT IT, which is what makes the silence
  // the defect rather than an honest limit.
  assert.equal(normalizeSchema({ tables: [{ name: "repairs", history: true, columns: [{ name: "c", type: "text" }] }] }).tables[0].history, true);
  assert.deepEqual(droppedFields({ tables: [{ name: "repairs", history: true, columns: [{ name: "c", type: "text" }] }] }), [],
    "droppedFields now reports an un-offered LIVE property — the third category got a diagnostic");

  // WHAT THE DESIGNER CAN NOW DO ABOUT IT: answer the table it can express, and
  // say the requirement it cannot.
  const ran = await runAdd({
    send: async () => toolReply("add_to_site", {
      table: [{ table: { name: "repairs", access: "user", columns: [{ name: "bike", type: "text", required: true }, { name: "status", type: "text" }] } }],
      requirements: [
        { need: "a customer can book a repair", status: "covered", by: "repairs, access user, so each customer sees only their own" },
        { need: "a customer sees the repair listed on a page", status: "elsewhere", step: "page" },
        { need: "a customer sees the history of what changed on their repair", status: "unsupported", why: "I can store the repair and its current status, but not a record of every change to it" },
      ],
    }),
  }, { kind: "table", message: "let customers book a repair and see the history of what changed on it", site: {}, model: "m" });

  assert.equal(ran.requirements.length, 3);
  const open = unresolvedRequirements(ran.requirements);
  assert.equal(open.length, 2);
  // THE FIX, IN ONE LINE: the word "history" survives to the customer, on a
  // change that could not implement it. Before this, it left at the tool.
  // RE-ANCHORED 2026-09-14, twice over. `made` is what the change really
  // APPLIED, with the guarantees each item really carries, and it is what turns
  // the first requirement's claim from an assertion into evidence: the designer
  // named `repairs` AND named its access level, and the applied table really
  // has that level. A claim naming the table alone would not be enough.
  const made = [{ name: "repairs", holds: ["user", "own", "bike", "status"], fails: ["anyone", "public", "members", "none"], checked: [] }];
  const note = requirementNote(ran.requirements, { told: ["page"], made });
  assert.match(note, /history of what changed/, "the omitted requirement is still omitted");
  assert.match(note, /not a record of every change/, "the reason did not survive");
  // RE-ANCHORED 2026-09-14 (third time), for the owner's own correction:
  // *"Matching configuration words must not mark an entire business requirement
  // delivered."* "A customer can book a repair" is a BEHAVIOURAL need; what the
  // applied table proves is a permission SETTING, and this claim used to buy
  // `delivered` off the word `user`. It reads unverified now — which is not the
  // same as reading it back as a gap, and the assertion is re-anchored to the
  // distinction rather than to the string: the need is NOT in the can't-do
  // clause, and IS in the can't-confirm one.
  //
  // THE CLAUSE IS READ, NOT THE WHOLE SENTENCE. The two unverified needs share
  // one "I can't confirm from here that …; or that …" clause, so pinning either
  // to its own copy of the opening words is a spelling, not the property.
  const split = note.indexOf("I can't confirm from here that ");
  assert.ok(split > 0, "the can't-confirm clause is gone");
  const cantDo = note.slice(0, split);
  const cantConfirm = note.slice(split);
  assert.doesNotMatch(cantDo, /can book a repair/, "a covered requirement is read back as something the site cannot do");
  assert.match(cantConfirm, /a customer can book a repair/,
    "a permission setting was taken as proof of the behaviour it is supposed to support");
  assert.doesNotMatch(note, /Still to do: a customer sees the repair listed on a page/,
    "the page step was told and its requirement is still reported outstanding");
  // …AND THE PAGE'S HAND-OFF IS SAID AS UNCONFIRMED RATHER THAN AS DONE. A
  // page existing does not prove a customer can see their repair on it, which
  // is the whole of the owner's second correction.
  assert.match(cantConfirm, /a customer sees the repair listed on a page/);
  // …AND THE SAME CLAIM AGAINST A TABLE APPLIED THE OTHER WAY IS NOT EVIDENCE.
  // This is the owner's own example — "customers see only their own bookings"
  // read as delivered because `by` mentioned the table — and the permissions
  // are what decide it now.
  //
  // THE TWO NOW SAY THE SAME SENTENCE TO THE CUSTOMER, and that is correct:
  // neither has been exercised, so neither is delivered. What still separates
  // them is the RECORD — a claim whose words the applied table CONTRADICTS
  // records no configuration at all, and one whose words it holds records which
  // fact was matched. Asserting the sentence alone here would be vacuous, which
  // is this repository's own "a fixture too shallow to separate the two
  // readings" met in the guard rather than in the product.
  const wrong = [{ name: "repairs", holds: ["anyone", "bike"], fails: ["user", "own", "members", "none"], checked: [] }];
  assert.match(requirementNote(ran.requirements, { told: ["page"], made: wrong }),
    /can't confirm from here that a customer can book a repair/,
    "a claim naming permissions the applied table does not have was read as delivered");
  assert.equal(requirementRecord({ list: ran.requirements, ran: ["table", "page"], told: ["page"], made: wrong }).counts.configured, 0,
    "a claim the applied table contradicts was recorded as configuration that holds");
  // …AND `delivered` IS STILL REACHABLE, which is what makes the three states
  // three rather than a demotion of one. `checked` is the behaviour really
  // exercised; NOTHING on the addon path fills it today (declared in
  // `appliedFacts`), so the demonstration is the module's.
  const proven = [{ name: "repairs", holds: ["user", "own"], fails: ["anyone"], checked: ["repairs"] }];
  const provenNote = requirementNote(ran.requirements, { told: ["page"], made: proven });
  assert.doesNotMatch(provenNote, /can book a repair/, "a requirement with exercised behaviour behind it is still not delivered");
  assert.equal(requirementRecord({ list: ran.requirements, ran: ["table", "page"], told: ["page"], made: proven }).counts.delivered, 1);
  // AND THE DEVELOPER RECORD KEEPS THE WHOLE OF IT, including the hand-off.
  const rec = requirementRecord({ list: ran.requirements, ran: ["table", "page"], told: ["page"], made });
  assert.equal(rec.counts.covered, 1);
  assert.equal(rec.counts.unsupported, 1);
  assert.deepEqual(rec.counts.delivered, 0, "configuration bought a delivery again");
  assert.deepEqual(rec.counts.configured, 1, "the configuration fact that WAS matched is not on the record");
  // RE-ANCHORED 2026-09-15: `configured` is a STATE now rather than a note
  // beside `unverified`, so the matched claim is counted once and not twice.
  // The pair is what the customer hears as one sentence, and it is asserted as
  // the pair — the two clauses above already read the sentence itself.
  assert.deepEqual(rec.counts.unverified, 1);
  assert.equal(rec.counts.configured + rec.counts.unverified, 2, "the two unconfirmed needs stopped being two");
  assert.deepEqual(rec.counts.failed, 1);
  assert.deepEqual(rec.counts.missing, 0, "a hand-off that was really delivered was read as work that is not there");
  assert.deepEqual(rec.handoffs, { delivered: 1, undelivered: 0 });
  assert.deepEqual(rec.handedTo, { page: ["a customer sees the repair listed on a page"] });
});

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
  COVERAGE, COVERAGE_STEPS, MAX_REQUIREMENTS, REQUIREMENT_ITEM,
  cleanRequirements, unresolvedRequirements, requirementsByStep, requirementCounts,
  requirementBrief, requirementNote, requirementRecord,
} from "../builder/site-requirements.mjs";
import { addTool, readAddAnswer, runAdd, foldAdds, REQUIREMENT_ADDS, siteNote, tableFacts, ADD_KINDS, pickTool, pickRequest } from "../builder/site-add.mjs";
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
assert.ok(W.includes("const aCoverage = (ranKinds) =>"), "the blanker ate the worker's coverage composer");
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
  assert.deepEqual(REQUIREMENT_ADDS, ["table"], "the coverage list moved off the Tables step, or spread beyond it");
  const t = addTool("table");
  assert.equal(t.input_schema.properties.requirements.items, REQUIREMENT_ITEM);
  assert.equal(t.input_schema.properties.requirements.maxItems, MAX_REQUIREMENTS);
  // …AND A KIND THAT DOES NOT ASK FOR IT DOES NOT CARRY IT, so the other tools
  // are byte-identical to what they were.
  assert.equal(addTool("component").input_schema.properties.requirements, undefined);
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
  const runEnd = W.indexOf(";", W.indexOf("model: aModels.quick });", runAt)) + 1;
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
  assert.match(W, /error: "add", kind: k, reason: clean\.why, cost: 0, msg: addRefusal\(clean\.why, k\), \.\.\.aCoverage\(\[\]\)/,
    "a cleaner's refusal drops the coverage");
  assert.match(W, /error: "declined", kinds: aDeclined, cost: 0, msg: addRefusal\("nothing"\), \.\.\.aCoverage\(\[\]\)/,
    "the all-declined answer drops the coverage — the one shape this was built for");
  // A FAILED EXIT CLAIMS NOTHING COVERED. `aCoverage([])` says no step ran, so
  // a requirement handed to the page step is still outstanding; `aCoverage(kinds)`
  // on a success says the steps that really produced work are done.
  assert.match(W, /\.\.\.aCoverage\(aAnswers\.map\(\(a\) => a\.kind\)\)/, "a success claims no step ran");
  // ── AND THE COMPOSER USES THE ARGUMENT IT WAS GIVEN ──────────────────────
  //
  // A SWEEP SURVIVOR, the same shape one layer in: every call site can pass the
  // right kinds and the closure reassign `ranKinds = aKinds` on its first line,
  // so a requirement handed to a step that never ran reads as covered and the
  // customer is told a change is finished that is not. Reading the call sites
  // cannot see it. Read the BODY.
  const covAt = at("const aCoverage = (ranKinds) => {", "the coverage composer");
  const covBody = W.slice(covAt, W.indexOf("\n            };", covAt));
  assert.ok(covBody.length > 200, "the composer's body could not be found: " + covBody.length);
  assert.doesNotMatch(covBody, /ranKinds\s*=[^=]/, "the composer overwrites the kinds it was told really ran");
  assert.match(covBody, /ran: ranKinds \|\| \[\]/, "the note is not told which steps ran, or is told something else");
  // AND IT DOES NOT REACH PAST ITS ARGUMENT for that answer: `aKinds` is every
  // kind the PICKER named, including ones that declined, and using it here is
  // precisely the lie above.
  assert.doesNotMatch(covBody, /\baKinds\b/, "the composer reads the picked kinds instead of the ones that ran");
  // HOP 7: the developer record, beside the raw replies.
  assert.match(W, /coverage: requirementRecord\(\{ list: aReq, skipped: aReqSkipped, invalid: \[\.\.\.aBadProps\], ran: aAnswers\.map\(\(a\) => a\.kind\) \}\)/,
    "the developer record is not stored with the answer");
  // HOP 8: the trace, counts only — `tr.at` keeps finite numbers and drops
  // everything else, and the needs are the customer's words.
  assert.match(W, /aMark\("coverage", "ok", \{ \.\.\.requirementCounts\(aReq, aReqSkipped\), bad: aBadProps\.size \}\)/,
    "the coverage leaves no trace mark");
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
  const siteLit = W.slice(W.indexOf("const aSite = {"), W.indexOf("};", W.indexOf("const aSite = {")));
  assert.ok(siteLit.length > 500, "the site literal could not be read: " + siteLit.length);
  assert.match(siteLit, /tableInfo: tableFacts\(aSpec\),/, "the designers are shown a site with no table facts on it");
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
  assert.match(W, /coverNote: requirementNote\(/, "the server sends a field the browser does not read");
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
  // THE PAGE STEP RAN, so its requirement is covered and is NOT said.
  const done = requirementNote(list, { ran: ["table", "page"] });
  assert.match(done, /owner sees what changed/);
  assert.match(done, /row history is not something I can switch on/);
  assert.doesNotMatch(done, /shows their bookings/, "a requirement whose step really ran is reported as outstanding");
  assert.doesNotMatch(done, /can book a slot/, "a covered requirement is read back to the customer");
  // THE PAGE STEP DID NOT RUN — a job-only addition changes no page — so the
  // hand-off is still outstanding and saying otherwise is the "doing less than
  // was asked while reporting success" failure this path exists to avoid.
  const owing = requirementNote(list, { ran: ["job"] });
  assert.match(owing, /Still to do: the page shows their bookings/);
  // NOTHING OUTSTANDING IS AN EMPTY STRING, never a reassuring sentence: a
  // `✅ Done.` with nothing after it has always meant nothing was left over.
  assert.equal(requirementNote(cleanRequirements([{ need: "a", status: "covered" }]).list, { ran: ["table"] }), "");
  assert.equal(requirementNote([], {}), "");
  assert.equal(requirementNote(null, {}), "");
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
  assert.deepEqual(rec.counts, { total: 2, covered: 1, elsewhere: 1, unsupported: 0, unreadable: 1 });
  assert.deepEqual(rec.invalidProps, ["encryptAtRest"], "the property name is not kept for the developer either");
  assert.deepEqual(rec.handedTo, { page: ["a"] });
  assert.deepEqual(rec.unreadable, [{ need: "c", why: "bad-status" }]);
  assert.deepEqual(rec.ran, ["table"]);
  assert.deepEqual(requirementRecord().counts, { total: 0, covered: 0, elsewhere: 0, unsupported: 0, unreadable: 0 });
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
  const at = W.indexOf('if (k === "table") {');
  assert.ok(at > 0, "the validation block is gone");
  const block = W.slice(at, at + 900);
  assert.match(block, /\(Array\.isArray\(clean\.value\) \? clean\.value : \[clean\.value\]\)\s*\.map\(\(e\) => e && e\.table\)/,
    "the validator does not read the model's own tables");
  assert.match(block, /droppedFields\(\{ tables: mine \}\)/, "the un-offered check is gone");
  assert.match(block, /refusedFields\(\{ tables: mine \}\)/, "the offered-but-binned check is gone");
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
  const note = requirementNote(ran.requirements, { ran: ["table", "page"] });
  assert.match(note, /history of what changed/, "the omitted requirement is still omitted");
  assert.match(note, /not a record of every change/, "the reason did not survive");
  assert.doesNotMatch(note, /can book a repair/, "a covered requirement is read back as a gap");
  assert.doesNotMatch(note, /repair listed on a page/, "the page step ran and its requirement is still reported outstanding");
  // AND THE DEVELOPER RECORD KEEPS THE WHOLE OF IT, including the hand-off.
  const rec = requirementRecord({ list: ran.requirements, ran: ["table", "page"] });
  assert.equal(rec.counts.covered, 1);
  assert.equal(rec.counts.unsupported, 1);
  assert.deepEqual(rec.handedTo, { page: ["a customer sees the repair listed on a page"] });
});

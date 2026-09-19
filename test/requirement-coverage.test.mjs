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
  COVERAGE, COVERAGE_STEPS, MAX_REQUIREMENTS, REQUIREMENT_ITEM, REQUIREMENT_STATES, SITE_KINDS, OPAQUE_KINDS,
  ITEM_KINDS, referenceOf, evidenceItems, implementationOf,
  cleanRequirements, unresolvedRequirements, requirementsByStep, requirementCounts,
  requirementBrief, requirementNote, requirementRecord, requirementOutcomes, evidenceName, claimEvidence,
} from "../builder/site-requirements.mjs";
import { addTool, readAddAnswer, runAdd, foldAdds, REQUIREMENT_ADDS, siteNote, tableFacts, ADD_KINDS, addLayer, OWN_ADDS, PLACING_ADDS, DISPATCHED_ADDS, pickTool, pickRequest } from "../builder/site-add.mjs";
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
  // ── THE ITEM IS OFFERED FOR BOTH REFERENCING STATUSES (2026-09-15) ───────
  //
  // A SWEEP SURVIVOR, and the shape is this repository's wiring trap in prose:
  // the reconciliation reads `item` for `covered` now, and if the tool still
  // says *"For \"elsewhere\" only"* no model will ever send one — the feature
  // is perfect and unreachable, and from outside "the model didn't name it"
  // and "we told it not to" are the same missing field. What each status means
  // by the reference differs and is said; that it is available does not.
  const item = String(REQUIREMENT_ITEM.properties.item.description);
  assert.doesNotMatch(item, /for\s+"?elsewhere"?\s+only/i,
    "the item is offered for one status again, so a covered claim can never name its own thing");
  assert.match(item, /"elsewhere"/, "the item no longer says what it means for a hand-off");
  assert.match(item, /"covered"/, "the item no longer says what it means for a claim");
  // ⚠ AND IT SAYS A PHOTOGRAPH HAS TWO (2026-09-19) — the picture's own name
  // for a need about ONE of them, the page's route for a need about all of
  // them. THE PROSE HALF OF THE WIRING TRAP, and it is asserted here because
  // nothing else can see it: the reconciliation resolves a named picture
  // perfectly whether or not any designer is told it may name one, so a sweep
  // mutant that cut this sentence SURVIVED every behaviour case in the suite.
  // From outside, "the model did not name the picture" and "we never told it
  // it could" are the same missing field.
  assert.match(item, /short name you gave a photograph/i,
    "a designer is no longer told it may name one picture, so the reconciliation is unreachable for a photo");
  assert.match(item, /about ONE\s*"?\s*\+?\s*"?\s*picture names that picture/i,
    "the item no longer says which of a photograph's two identities means what");
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
  // …AND THE ITEM GOES WITH THE STEP. An `item` is a reference — for
  // `elsewhere` to the thing that step was asked to make, for `covered` to the
  // thing the design says does the work — so on an entry that is now
  // `unsupported` it refers to nothing this change will ever run, and leaving
  // it on the record invites a later reader to reconcile against it.
  assert.equal(cleanRequirements([{ need: "n", status: "elsewhere", step: "postcard", item: "card_fn" }]).list[0].item, undefined,
    "a reference to a step we do not run survived onto an entry nothing can check it against");
  assert.equal(cleanRequirements([{ need: "n", status: "unsupported", why: "w", item: "card_fn" }]).list[0].item, undefined,
    "a thing we said we could not do carries a reference to the thing that would have done it");
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
  // identity — so it would enlarge the build's tool (97,142 characters, of
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
  // ⚠ RE-ANCHORED AGAIN 2026-09-19: `qr` IS THE SEVENTH, and it is on the list
  // for the OTHER half of what the list is for. The wording above reads as
  // "every kind that designs" and that was only ever the sufficient half — a
  // kind is on it so it can RAISE a gap, and equally so it can ECHO a hand-off
  // it was given. The qr step is already handed the page step's requirement in
  // its brief and had nowhere to answer, so a code that really opens the page
  // asked for could never be tied to the asking.
  //
  // ⚠ AND AGAIN, THE SAME DAY, WITH `three` AND `photo` — AND THE PROXY THIS
  // CENSUS USED HAD EXPIRED. It derived "can answer" as `!addLayer(k)`, on the
  // reasoning that a kind which DISPATCHES has no tool to answer in. That was
  // true until `PLACING_ADDS` shipped: `photo` carries a tool AND names a
  // layer, so the two stopped being the same question and this filter went on
  // agreeing with the answer by accident. The real property is whether the
  // kind HAS A TOOL — `ADDS[k].shape`, which is what `PLACING_ADDS` and
  // `DISPATCHED_ADDS` are themselves split on — so the census asks that, and a
  // kind with NO tool still cannot be on the list.
  //
  // `three` needed one word: it was already in `APPLIED_KINDS` and
  // `SITE_KINDS`, and both fact readers already emitted `{kind:"three",
  // name:"three"}`. `photo` needed an IDENTITY as well, which is its
  // PLACEMENT — see `SITE_KINDS` in `site-requirements.mjs`.
  const designing = [...OWN_ADDS, ...PLACING_ADDS];
  assert.deepEqual(REQUIREMENT_ADDS, ["table", "function", "api", "job", "page", "component", "qr", "three", "photo"],
    "the designing kinds that answer coverage changed — say which and why");
  for (const k of REQUIREMENT_ADDS) {
    assert.ok(designing.includes(k), "`" + k + "` answers coverage and has no tool of its own to answer it in");
  }
  for (const k of DISPATCHED_ADDS) {
    assert.ok(!REQUIREMENT_ADDS.includes(k), "`" + k + "` has no tool at all and cannot answer coverage");
  }
  assert.ok(designing.length >= REQUIREMENT_ADDS.length, "the census read nothing");
  // AND THE TWO GROUPS REALLY ARE "HAS A TOOL", proved rather than assumed —
  // without this the filter above could be any list at all and the loop would
  // still pass.
  for (const k of designing) assert.ok(addTool(k), "`" + k + "` is counted as having a tool and has none");
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
  // …AND THE PROPERTY IS PRESENT EXACTLY WHERE THE KIND DECLARES IT.
  //
  // ⚠ THIS EXPECTATION MOVED RATHER THAN BROKE (2026-09-19). It read
  // `assert.equal(addTool("three").…requirements, undefined)` with the note
  // "`three` has a tool of its own and answers no coverage" — and that is the
  // very thing this round changes, so it is the SUBJECT and not a casualty.
  // Why the new behaviour is correct: the owner's own instruction for a 3D
  // scene is to distinguish "a scene declared" from "the scene actually
  // included in the page", and from "a refused addition, including the
  // one-scene-per-site restriction". Those are three different answers about
  // one ask, and a step with nowhere to write a requirement can give none of
  // them — the qr step's own gap, one kind over, for the same reason.
  //
  // ⚠ AND THE NEGATIVE HAS NO MEMBER LEFT, which is worth saying out loud
  // rather than quietly dropping. MEASURED: every one of the nine kinds has a
  // tool and every one of the nine declares the flag, so `addTool`'s own gate
  // (`if (add.requirements)`) is INERT TODAY — removing it adds the property to
  // a set that already has it. The census below is therefore the live half: it
  // reads the flag off the tool for every kind that has one, and the hardcoded
  // list above is what goes red if a kind loses its flag. The day a tenth kind
  // arrives without one, this loop is an observer again with no edit needed.
  const flagless = designing.filter((k) => !REQUIREMENT_ADDS.includes(k));
  assert.deepEqual(flagless, [],
    "a kind now has a tool and no coverage flag — this census's negative direction is live again, so drive it");
  for (const k of designing) {
    const has = !!addTool(k).input_schema.properties.requirements;
    assert.equal(has, REQUIREMENT_ADDS.includes(k),
      "`" + k + "`'s tool and the derived list disagree about whether it answers coverage");
  }
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
  // …AND A THIRD, 2026-09-17: what went WITH a missing page. A new QR code
  // pointing at a page that did not survive is dropped before anything is
  // stored, and the customer hears it beside the page's own sentence rather
  // than discovering it by scanning the code.
  assert.match(W, /deadQrNote\(aDeadQr\),/, "the dead-QR sentence never reaches the field the browser prints");
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. COMPLETION REPORTING
// ─────────────────────────────────────────────────────────────────────────────

test("requirementNote says only what is still outstanding, in the customer's terms", () => {
  const list = cleanRequirements([
    { need: "a visitor can book a slot", status: "covered", by: "bookings.slot" },
    { need: "the page shows their bookings", status: "elsewhere", step: "page" },
    { need: "the owner sees what changed on a repair", status: "unsupported", why: "row history is not something I can switch on" },
  ], "table").list;
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
  // RE-ANCHORED 2026-09-16, a FIXTURE that had drifted from its producer rather
  // than an expectation that moved. `appliedFacts` stamps a `kind` on every item
  // it makes and the route always hands `cleanRequirements` the kind that
  // answered; this fixture predates both and carried neither, which was free
  // while the evidence lookup searched `made` whole. It is scoped now
  // (`evidenceItems`), so an item with no kind is in no haystack and a claim
  // with no `from` has no haystack — and a fixture in a shape the product
  // cannot produce would have reported that scoping as broken.
  const made = [{ kind: "table", name: "bookings", holds: ["slot", "unique", "own"], fails: ["anyone", "public", "members"], checked: [] }];
  const done = requirementNote(list, { told: ["page"], made });
  assert.match(done, /owner sees what changed/);
  assert.match(done, /row history is not something I can switch on/);
  assert.doesNotMatch(done, /Still to do: the page shows their bookings/,
    "a requirement whose step was really told is reported as outstanding");
  assert.match(done, /can't confirm from here that/,
    "a step that was merely told is read as proof the need was met");
  // RE-ANCHORED 2026-09-15: this fixture hands no page inventory and no page
  // in `made`, so the page hand-off is `unknown` and gets the OTHER clause.
  // The two are asserted apart here on purpose — the covered claim is the one
  // that was set up, the hand-off is the one nobody could see.
  assert.match(done, /can't see from here whether the page shows their bookings/,
    "an implementation nobody could establish was folded into the set-up clause");
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
  // `existing` NOW CARRIES ITS WEIGHT: `page` is a kind a site can hold, so
  // "the change added none" is half an answer — the site's own routes are the
  // other half, and without them nothing is absent.
  const noPages = { items: [], kinds: ["page"] };
  const owing = requirementNote(list, { told: ["job"], made, reportable: ["page"], existing: noPages });
  assert.match(owing, /Still to do: the page shows their bookings/);
  assert.doesNotMatch(
    requirementNote(list, { told: ["job"], made, reportable: ["page"] }),
    /Still to do: the page shows their bookings/,
    "absence was declared for a kind whose site inventory nobody read");
  // …AND RUN 48'S OWN SHAPE: the same undelivered hand-off, with the work
  // really there. "Still to do" about a live page is the sentence that failed
  // live; the hand-off is still counted, in the record, where it is actionable.
  const shipped = [...made, { kind: "page", name: "/bookings", holds: [], fails: [], checked: [] }];
  const late = requirementNote(list, { told: ["job"], made: shipped, reportable: ["page"], existing: noPages });
  assert.doesNotMatch(late, /Still to do: the page shows their bookings/,
    "a hand-off nobody delivered was reported as work that is not there");
  // RE-ANCHORED 2026-09-15 onto the clause the need really earns. The entry
  // names no `item`, so a shipped page cannot be tied to it — that is the
  // asymmetry, not a regression — and the honest sentence is the one that says
  // nobody could see either way rather than the one claiming it was set up.
  assert.match(late, /can't see from here whether the page shows their bookings/,
    "the page was built and the customer heard nothing about it at all");
  assert.doesNotMatch(late, /I've set that up[^.]*the page shows their bookings/,
    "an unnamed hand-off was reported as work that was done");
  const lateOut = requirementOutcomes(list, { told: ["job"], made: shipped, reportable: ["page"], existing: noPages });
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
  const exercised = [{ kind: "table", name: "bookings", holds: [], fails: [], checked: ["own"] }];
  assert.equal(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings, one row per owner (own)" }], "table").list,
    { told: [], made: exercised }), "");
  assert.match(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings, one row per owner (own)" }], "table").list,
    { told: [], made }), /can't confirm from here/,
    "a configuration fact bought silence about a behaviour nobody checked");
  // …AND EXISTENCE ALONE IS NOT SILENCE: a claim that names the table and
  // nothing checkable about it is exactly the shape the owner corrected.
  assert.match(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings holds them" }], "table").list, { told: [], made }),
    /can't confirm from here/, "a bare name match passed as delivered");
  // …and a claim that CONTRADICTS what was applied is not evidence either. It
  // stays in the can't-confirm clause deliberately: the claim NAMED a table
  // this change really applied, so the implementation is established and only
  // the guarantee is denied — and the other clause's *"nothing I can check says
  // either way"* would be false, since something can be checked and it says the
  // opposite.
  assert.match(requirementNote(cleanRequirements([{ need: "a", status: "covered", by: "bookings, readable by anyone" }], "table").list, { told: [], made }),
    /can't confirm from here/, "a claim disagreeing with the applied permissions passed as delivered");
  // RE-ANCHORED 2026-09-15 (owner: *"covered + no implementation evidence still
  // produces 'I've set that up.'"*). A `covered` label with no `by`, no `item`
  // and nothing of its step's kind applied has NOTHING behind it — the label is
  // the model's word and may not stand in for evidence — so it earns the
  // can't-SEE clause. The property is unchanged and stronger: it is not
  // delivered, and now it does not claim to have been set up either.
  const bare = requirementNote(cleanRequirements([{ need: "a", status: "covered" }], "table").list, { told: [], made });
  assert.match(bare, /can't see from here whether a/, "a claim with nothing to check against passed as delivered");
  assert.doesNotMatch(bare, /I've set that up/, "a covered label with no evidence behind it claimed the work was set up");
  assert.equal(requirementNote([], {}), "");
  assert.equal(requirementNote(null, {}), "");
});

test("the six states separate implementation from hand-off, and evidence is asymmetric", () => {
  // RE-ANCHORED 2026-09-15 (owner, on run 48): three states could not express
  // what run 48 met — a hand-off nobody delivered whose work was nonetheless
  // live. `configured` splits a matched SETTING off `unverified`; `missing`
  // and `blocked` split "this layer looked and it is not there" and "the part
  // it needed failed" off `failed`, which now means only our own refusal.
  // RE-ANCHORED AGAIN 2026-09-15: `unknown` splits off `unverified`, because
  // that one's customer sentence opens *"I've set that up"* and an
  // implementation nobody could find is not something anybody set up.
  assert.deepEqual(REQUIREMENT_STATES,
    ["delivered", "configured", "unverified", "unknown", "missing", "blocked", "failed"]);
  // …AND THE THREE STEP GROUPS ARE A TOTAL, DISJOINT PARTITION of the steps a
  // requirement may name — a census both ways, so a step added next month must
  // be placed deliberately rather than falling into whichever branch it meets.
  // The groups decide whether ABSENCE is establishable at all: a site can hold
  // one and something can list them; a site can hold one and nothing can; or
  // it names no artifact a site holds (`edit` alone).
  assert.deepEqual([...SITE_KINDS, ...OPAQUE_KINDS, "edit"].slice().sort(), COVERAGE_STEPS.slice().sort(),
    "the step groups and COVERAGE_STEPS disagree");
  for (const k of SITE_KINDS) assert.ok(!OPAQUE_KINDS.includes(k), k + " is both enumerable and unobservable");
  // …AND `ITEM_KINDS` IS THE SAME LIST LESS `edit` ALONE (2026-09-15), censused
  // both ways so neither end can drift. It is what a `covered` reference may
  // name, and each exclusion and each inclusion is a decision:
  //
  //   * `edit` is OUT BY MEANING — it names no artifact a site holds, so
  //     `{kind: "edit", item: "x"}` could never be looked up in anything.
  //   * `component` and `photo` are deliberately IN, although they always
  //     answer `unknown`: the designer can say what it made and this layer
  //     says it cannot see one. Refusing the kind leaves them naming nothing.
  assert.deepEqual(ITEM_KINDS.slice().sort(), COVERAGE_STEPS.filter((k) => k !== "edit").slice().sort(),
    "ITEM_KINDS and COVERAGE_STEPS disagree about what a reference may name");
  assert.ok(!ITEM_KINDS.includes("edit"), "edit names no artifact and cannot be a reference's kind");
  for (const k of OPAQUE_KINDS) assert.ok(ITEM_KINDS.includes(k),
    k + " must be nameable even though this layer can never see one");
  // The tool offers exactly that set, so the model cannot name a kind the
  // reader has no list for — and cannot be refused one the reader does.
  assert.deepEqual(REQUIREMENT_ITEM.properties.kind.enum, [...ITEM_KINDS],
    "the tool's kind enum and ITEM_KINDS disagree");
  // ── `referenceOf` IS THE ONE PRODUCER OF THAT IDENTITY, driven here ──────
  //
  // Three lookups read it — applied, existing and failed — so where the kind
  // comes from is asserted per status rather than left to whichever call site
  // happens to be exercised. A `covered` entry's kind is DECLARED (`from` is
  // which call answered, not where the thing lives); an `elsewhere` entry's IS
  // its step, and carrying a second field there would be a two-field invariant
  // that can disagree with itself.
  assert.deepEqual(referenceOf({ status: "covered", item: "Count_OK", kind: "function", step: "table" }),
    { kind: "function", name: "count_ok" }, "a covered reference did not take its DECLARED kind");
  assert.deepEqual(referenceOf({ status: "elsewhere", item: " /Diary ", step: "page", kind: "function" }),
    { kind: "page", name: "/diary" }, "a hand-off's kind is its step and nothing else");
  // `null` IS UNIDENTIFIABLE, NOT ABSENT, and every caller reads it as
  // `unknown`: a reference we cannot resolve is one we may not answer either
  // way. Both halves of it — no name at all, and a name with no kind beside it.
  assert.equal(referenceOf({ status: "covered", item: "count_ok" }), null,
    "a covered name with no kind was resolved anyway");
  assert.equal(referenceOf({ status: "elsewhere", item: "count_ok" }), null);
  assert.equal(referenceOf({ status: "covered", kind: "function" }), null, "a kind with no name is not a reference");
  assert.equal(referenceOf({ status: "covered", item: "   ", kind: "function" }), null);
  assert.equal(referenceOf(null), null);
  assert.equal(referenceOf("bookings"), null);
  const list = cleanRequirements([
    { need: "book a slot", status: "covered", by: "bookings.slot is unique" },
    { need: "only the owner sees a number", status: "covered", by: "a row-level guarantee" },
    { need: "show the diary", status: "elsewhere", step: "page" },
    { need: "text a reminder", status: "elsewhere", step: "job" },
    { need: "take crypto", status: "unsupported", why: "cards only" },
  ], "table").list;
  // RE-ANCHORED 2026-09-16 onto the producer's own shape: `appliedFacts`
  // stamps `kind`, and the evidence lookup is scoped by it since the bypass
  // fix. A kindless item is in no haystack, which is right and is not this
  // case's subject.
  const made = [{ kind: "table", name: "bookings", holds: ["slot", "unique", "own"], fails: ["anyone", "public", "members"], checked: [] }];
  const got = requirementOutcomes(list, { told: ["page"], failed: ["job"], made });
  // RE-ANCHORED 2026-09-14 (owner: "Matching configuration words must not mark
  // an entire business requirement delivered"). `holds` is CONFIGURATION, so
  // the first entry reads UNVERIFIED with the fact it matched recorded beside
  // it — a different kind of unverified from the second, which matched nothing.
  // RE-ANCHORED AGAIN 2026-09-15: the first entry's matched setting is its own
  // STATE rather than a note beside `unverified`, and the hand-off to the step
  // that FAILED is `blocked` — a dependency to point at, not our own refusal.
  // RE-ANCHORED AGAIN 2026-09-15: the third is an `elsewhere` hand-off with no
  // `item`, no page in `made` and no site inventory handed in — three silences,
  // so `unknown` rather than an `unverified` that claims it was set up.
  // RE-ANCHORED A FOURTH TIME, 2026-09-15 (owner: *"covered + no implementation
  // evidence still produces 'I've set that up' … Do not let the model's covered
  // label substitute for implementation evidence"*). The SECOND entry is that
  // shape exactly: a `covered` claim whose `by` names no applied item, with no
  // `item` reference and nothing of its own step's kind applied. It used to
  // fall through to the initial `unverified` — the label standing in for the
  // evidence — and it reads `unknown` now, the same answer the hand-off beside
  // it gets for the same reason. **The two are asserted as the SAME state on
  // purpose**: that both statuses are reconciled against the same results is
  // the property, and a fixture where only one of them could reach it would
  // pass with the `covered` half of the reconcile deleted.
  assert.deepEqual(got.map((r) => r.state), ["configured", "unknown", "unknown", "blocked", "failed"]);
  assert.equal(got[0].configuredBy, "bookings: slot", "the configuration that was checked is not recorded");
  assert.equal(got[1].configuredBy, undefined, "a claim that matched nothing was recorded as checked configuration");
  // …AND A CLAIM THE APPLIED ITEM CONTRADICTS IS THE OTHER SIDE OF THAT SAME
  // line, which is why it is asserted here beside it: it NAMED an applied item,
  // so the implementation is established and the answer is `unverified`, with
  // the fact that denied it on the record. `unknown` would say *"nothing I can
  // check says either way"* about a table that says the opposite.
  const denied = requirementOutcomes(
    cleanRequirements([{ need: "anyone can read them", status: "covered", by: "bookings, readable by anyone" }], "table").list,
    { told: [], made })[0];
  assert.equal(denied.state, "unverified", "a contradicted claim was read as nothing anybody could see");
  assert.equal(denied.contradictedBy, "bookings: anyone", "the fact that denied the claim is not on the record");
  assert.equal(denied.configuredBy, undefined, "a contradicted claim was recorded as configuration that holds");
  // …AND A BEHAVIOUR SOMETHING REALLY EXERCISED IS STILL DELIVERED. The door
  // is real and nothing on this path fills it, which is the honest state and
  // is said in as many words in `appliedFacts`.
  const exercised = [{ kind: "table", name: "bookings", holds: [], fails: [], checked: ["unique"] }];
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
  // RE-ANCHORED 2026-09-15: `unknown` is what "nobody looked" is called now,
  // and the property this line is about — that an undelivered hand-off is NOT
  // read as proof the work is absent — is unchanged and is what `missing`
  // below is contrasted against.
  assert.equal(untold.state, "unknown", "a hand-off nobody delivered was read as proof the work is absent");
  // …AND BOTH READERS MUST SPEAK FOR `missing` (owner's item 2). `page` is a
  // kind a site can hold, so "this change added none" is half the answer; the
  // site's own routes are the other half, and the empty inventory supplies it.
  const noPages = { items: [], kinds: ["page"] };
  const looked = requirementOutcomes(list, { told: [], made: [], reportable: ["page"], existing: noPages })[2];
  assert.equal(looked.state, "missing", "a kind this change never ran made nothing, and that is knowable");
  assert.match(looked.why, /never got it/);
  // THE CONTROL FOR THAT HALF: reportable alone is not enough for a holdable
  // kind — without the site inventory nobody established absence.
  assert.equal(requirementOutcomes(list, { told: [], made: [], reportable: ["page"] })[2].state, "unknown",
    "absence was declared for a kind whose site inventory nobody read");
  // …AND THE SITE ALREADY HAVING IT IS THE OTHER DIRECTION: not added by this
  // change, present on the site, so it is there and unchecked rather than
  // still to do. (`item` is what makes the match exact; see the pair below.)
  const hasIt = requirementOutcomes(
    [{ need: "show the diary", status: "elsewhere", step: "page", item: "/diary" }],
    { told: [], made: [], reportable: ["page"], existing: { items: [{ kind: "page", name: "/diary" }], kinds: ["page"] } },
  )[0];
  assert.equal(hasIt.state, "unverified", "a page the site already has was reported as work that is not there");
  assert.equal(hasIt.implementation, "found");
  assert.equal(hasIt.foundIn, "existing", "the record does not say the site already had it rather than this change making it");
  // …AND THE SAME UNDELIVERED HAND-OFF OVER WORK THAT IS REALLY THERE — run
  // 48's own shape — is not missing, however loudly the hand-off is owed.
  const live = requirementOutcomes(list,
    { told: [], made: [{ kind: "page", name: "/diary", holds: [], fails: [], checked: [] }], reportable: ["page"], existing: noPages })[2];
  assert.equal(live.handoff, "undelivered");
  assert.equal(live.state, "unknown", "a page that was really built was reported as still to do");
  // ── ONE IDENTITY, `{kind, name}`, FOR ALL THREE LOOKUPS ──────────────────
  //
  // REWRITTEN 2026-09-15 onto the property that replaced this block's subject.
  // It used to assert a cross-kind search BY NAME for `covered`, and the owner
  // reproduced two collisions out of exactly that: an applied TABLE answering a
  // claim about a FUNCTION of the same name, and a FAILED function blocking a
  // claim about the applied table. `bookings` is the ordinary name for both.
  //
  // So the reference carries its KIND, declared for `covered` (`from` is which
  // call answered, not where the thing lives) and taken from `step` for
  // `elsewhere`. Asserted both ways round: matching the kind alone would let a
  // hand-off be satisfied by something nobody asked that step for, and matching
  // the name alone is the collision.
  const applied = [{ kind: "function", name: "count_ok", holds: [], fails: [], checked: [] }];
  const seenSite = { items: [{ kind: "function", name: "count_had" }], kinds: ["page", "function"] };
  const reach = { made: applied, reportable: ["page", "function"], existing: seenSite };
  const claim = (extra, opts = reach) => requirementOutcomes(
    cleanRequirements([{ need: "the total is counted", status: "covered", by: "a counter", ...extra }], "page").list, opts)[0];
  // A CLAIM MAY NAME A KIND ITS OWN STEP DOES NOT MAKE — the `page` step's
  // claim resting on a FUNCTION — which is what the declared kind is for.
  const asClaim = claim({ item: "count_ok", kind: "function" });
  assert.equal(asClaim.state, "unverified", "a covered claim naming its kind explicitly was not resolved");
  assert.equal(asClaim.implementedBy, "count_ok");
  // …AND THE SAME NAME UNDER THE WRONG KIND IS NOT IT. This is the owner's
  // first collision in miniature: only the kind separates the two.
  const wrongKind = claim({ item: "count_ok", kind: "page" });
  assert.notEqual(wrongKind.implementation, "found",
    "a claim about a page was answered by a function of the same name");
  // …AND A REFERENCE WITH NO KIND IS AMBIGUOUS, never widened back into a
  // search: the designer named a thing and not what it is.
  const vagueRef = claim({ item: "count_ok" });
  assert.equal(vagueRef.state, "unknown", "an unidentifiable reference was resolved anyway");
  assert.equal(vagueRef.implementation, "unknown");
  assert.equal(vagueRef.unresolved, "no-kind", "the record cannot tell an unreadable reference from nobody looking");
  // …AND AMBIGUITY OUTRANKS THE PROSE MATCH BELOW IT, which is the whole of
  // why that branch exists and is the only case where it changes an answer:
  // with nothing in `by` the fall-through lands on `unknown` anyway. Here `by`
  // NAMES an applied item, so `claimEvidence` would answer — and it matches on
  // prose across every kind, which is the same collision one layer over. The
  // designer did not say what kind of thing they meant; answering the question
  // they did not ask with evidence about a thing they may not have meant, and
  // saying *"I've set that up"* off it, is the reading this refuses.
  const vagueButNamed = claim({ item: "count_ok", by: "count_ok returns the total" });
  assert.equal(vagueButNamed.state, "unknown",
    "an unidentifiable reference was rescued by a kind-blind name match in its own prose");
  assert.equal(vagueButNamed.unresolved, "no-kind");
  // THE CONTROL that makes that mean something: the SAME prose with the kind
  // declared really does resolve, so the refusal above is about the missing
  // kind and not about the evidence being unreadable.
  assert.equal(claim({ item: "count_ok", kind: "function", by: "count_ok returns the total" }).state, "unverified");
  // …AND A KIND NOTHING RECOGNISES IS DROPPED AT THE CLEANER, so the reference
  // goes ambiguous rather than becoming a lookup in a list that does not exist.
  // `unknown` would be the state either way; what differs is whether the record
  // can say WHY — and a kind on the wire that no reader has a haystack for is a
  // field that reads as answered.
  const junk = cleanRequirements(
    [{ need: "n", status: "covered", by: "b", item: "count_ok", kind: "nonsense" }], "page").list[0];
  assert.equal(junk.kind, undefined, "a kind outside ITEM_KINDS was carried through cleaning");
  assert.equal(claim({ item: "count_ok", kind: "nonsense" }).unresolved, "no-kind",
    "a junk kind was read as an identity rather than as no identity at all");
  // …AND AN `elsewhere` ENTRY CARRIES NO KIND AT ALL, even when the model wrote
  // one. Its kind IS its step, and a second field holding the same fact is a
  // two-field invariant that can disagree with itself.
  const strayKind = cleanRequirements(
    [{ need: "n", status: "elsewhere", step: "page", item: "/diary", kind: "function" }], "table").list[0];
  assert.equal(strayKind.kind, undefined, "a hand-off kept a kind beside the step that already says it");
  assert.equal(strayKind.step, "page");
  // THE CONTROL FOR THE SAME RULE ON THE OTHER STATUS: a hand-off's kind IS its
  // step, so a thing of another kind is not what that step was asked for.
  const asAsk = requirementOutcomes(
    [{ need: "the total is counted", status: "elsewhere", step: "page", item: "count_ok" }], reach)[0];
  assert.equal(asAsk.state, "missing", "a hand-off to the page step was satisfied by a function of the same name");
  // …AND THE SITE'S OWN CONTENTS ARE READ THROUGH THE SAME IDENTITY, which is
  // the other half of *"the same … applied, existing, and failed items"*.
  const reused = claim({ item: "count_had", kind: "function" });
  assert.equal(reused.state, "unverified", "a covered claim resting on something the site already has was not resolved");
  assert.equal(reused.foundIn, "existing", "the record does not say the site already had it");
  assert.equal(reused.implementedBy, "count_had");
  // …AND A CLAIM WHOSE OWN THING IS NOWHERE NAMES IT. The sentence has to point
  // at something, or "still to do" gives nobody anything to do.
  const nowhere = claim({ item: "count_gone", kind: "function" });
  assert.equal(nowhere.state, "missing");
  assert.match(nowhere.why, /count_gone/, "a covered claim whose own thing is not there does not name it");
  // …AND "COULD WE HAVE SEEN ONE" IS ASKED OF THE REFERENCE'S KIND, NEVER OF
  // THE STEP'S. The two are the same thing on a claim about the step's own
  // work and part company on exactly the claim the declared kind exists for:
  // the `page` step resting on a FUNCTION. Nothing enumerated functions here,
  // so nobody looked — and the step's own kind WAS enumerated, which is what
  // would turn "nobody looked" into "still to do" about somebody else's kind.
  const pagesOnly = { made: [], reportable: ["page"], existing: { items: [], kinds: ["page"] } };
  assert.equal(claim({ item: "count_gone", kind: "function" }, pagesOnly).state, "unknown",
    "absence was declared for a function on the strength of having read the pages");
  // THE CONTROL: with functions really enumerable the same claim IS missing, so
  // the line above is about which haystack was read and not about the reader
  // having gone quiet.
  const bothRead = { made: [], reportable: ["page", "function"], existing: { items: [], kinds: ["page", "function"] } };
  assert.equal(claim({ item: "count_gone", kind: "function" }, bothRead).state, "missing");
  // …AND IF THAT THING REALLY FAILED IT IS BLOCKED — matched on the SAME
  // identity, so the kind has to agree as well as the name.
  const broke = { ...reach, failedItems: [{ kind: "function", name: "count_gone" }] };
  const depFail = claim({ item: "count_gone", kind: "function" }, broke);
  assert.equal(depFail.state, "blocked", "a covered claim naming a thing that failed was not tied to it");
  assert.match(depFail.why, /count_gone/);
  // THE OWNER'S SECOND COLLISION, AT THE MODULE: the same name failed under
  // ANOTHER kind is not this claim's dependency failing.
  const other = claim({ item: "count_gone", kind: "page" }, broke);
  assert.notEqual(other.state, "blocked", "a claim about a page blocked on a FUNCTION of the same name");
  const crossAsk = requirementOutcomes(
    [{ need: "the total is counted", status: "elsewhere", step: "page", item: "count_gone" }], broke)[0];
  assert.equal(crossAsk.state, "missing", "a hand-off to the page step blocked on a FUNCTION of the same name");
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
  //
  // RE-ANCHORED 2026-09-15 ONTO THE PROPERTY THAT MATTERED ALL ALONG. A bare
  // name used to answer `null`, and the assertion pinned the SPELLING of that
  // answer rather than what it buys: the reading it forbids is `delivered` or
  // `configured`, and that is unchanged. What changed is that the existence
  // half is no longer thrown away — a claim naming an item this change really
  // applied LOCATES the implementation, which is worth `unverified` and is not
  // worth anything more.
  const bare = claimEvidence("bookings holds them", made);
  assert.equal(bare.kind, "named", "a bare name match is still evidence");
  assert.equal(bare.name, "bookings");
  assert.equal(bare.token, "", "a bare name answered with a guarantee it never matched");
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
  //
  // RE-ANCHORED 2026-09-15 onto the same property, for the same reason: this
  // answered `null` too, and `null` now means "nothing here could see either
  // way" — which is FALSE of a contradiction, where something can be seen and
  // it says the opposite. The kind is its own, and what it buys is asserted
  // rather than the shape of the refusal.
  const against = claimEvidence("bookings is readable by anyone, one row per owner (own)", made);
  assert.equal(against.kind, "contradicted", "a claim that contradicts the applied permissions was read as evidence");
  assert.equal(against.token, "anyone", "the fact that denied the claim is not carried out");
  assert.notEqual(against.kind, "config", "a contradicted claim read on to an incidental word that happens to hold");
  // THE BARE NAME IS KEPT, NEVER RETURNED, and this is the fixture that can
  // tell the two apart: an earlier item matched by name alone, a later one
  // carrying a real guarantee. Returning the first would hide the stronger
  // answer behind the weaker one — this file's own asked-in-order rule broken.
  assert.equal(claimEvidence("bookings and waitlist, one row per owner (own)", [
    { name: "bookings", holds: [], fails: [], checked: [] },
    { name: "waitlist", holds: ["own"], fails: [], checked: [] },
  ]).kind, "config", "a bare name match hid the stronger answer behind it");
  // A NAME NOBODY APPLIED IS NOT EVIDENCE WHATEVER IT CLAIMS.
  assert.equal(claimEvidence("waitlist.slot is unique", made), null);
  assert.equal(claimEvidence("bookings.slot is unique", []), null, "the observer answered with nothing applied");
  assert.equal(claimEvidence("", made), null);
  assert.equal(claimEvidence(["bookings.slot"], made), null, "String(['x']) is 'x' — a non-string was coerced");
  // ── AND WHAT IT IS ASKED ABOUT IS SCOPED ABOVE IT (owner, 2026-09-16) ─────
  //
  // *"claimEvidence(r.by, made) still searches every applied kind."* This
  // function is kind-blind by design — it weighs a sentence against a list —
  // so the identity has to reach it in the LIST. `evidenceItems` is that one
  // scope, derived from what `implementationOf` already resolved rather than
  // re-resolved, and the three answers are asserted here with the haystack in
  // hand because every one of them is a different claim about what may count.
  const KINDED = [
    { kind: "table", name: "bookings", holds: ["user"], fails: ["collect"], checked: [] },
    { kind: "function", name: "bookings", holds: ["internal"], fails: ["public"], checked: [] },
    { kind: "function", name: "count_rows", holds: ["internal"], fails: ["public"], checked: [] },
  ];
  const seen = (impl) => evidenceItems(KINDED, impl).map((m) => m.kind + "::" + m.name);
  // AN ITEM REFERENCE IS THAT ITEM AND NOTHING ELSE — `{kind, name}`, both
  // halves, which is the whole of the owner's correction. The same NAME under
  // another kind is a different thing, and the same KIND under another name is
  // a different thing; both are driven, because a scope that kept either would
  // read as working from one side.
  assert.deepEqual(seen({ state: "found", by: "item", kind: "table", name: "bookings" }), ["table::bookings"]);
  assert.deepEqual(seen({ state: "found", by: "item", kind: "function", name: "bookings" }), ["function::bookings"]);
  assert.deepEqual(seen({ state: "found", by: "item", kind: "function", name: "count_rows" }), ["function::count_rows"]);
  // A MISS IS AN EMPTY HAYSTACK, whichever way the implementation read it —
  // `unknown` (nobody could look) as much as `absent` (it is not there). This
  // is the owner's reproduction at the module: a reference of an unseeable kind
  // against an applied item of another kind that the sentence names.
  assert.deepEqual(seen({ state: "unknown", by: "item", kind: "component", name: "bookings" }), []);
  assert.deepEqual(seen({ state: "absent", by: "item", kind: "job", name: "bookings" }), []);
  // …AND THE SAME SHAPE FOR A FUNCTION WHOSE INVENTORY IS UNAVAILABLE, which is
  // the owner's second reproduction. It is asserted HERE rather than through
  // the route deliberately: on the route `aSpec` is always read (`specForAddon`
  // recovers or stops), so `existingFacts` always speaks for `function` and
  // that state is not reachable there — saying so beats a route case that fakes
  // it.
  assert.deepEqual(seen({ state: "unknown", by: "item", kind: "function", name: "count_missing" }), []);
  // NO REFERENCE AT ALL IS THE RESPONSIBLE STEP'S OWN OUTPUT — restricted, and
  // the same haystack `implementationOf`'s no-name branch already asks about.
  // MEASURED before it was chosen: emptying this arm instead moves nine cases
  // rather than four, and the five extra are real findings — a claim resting on
  // a guarantee its own step's applied item really carries would be reported as
  // *"nothing I can check says either way"*, which is false when something can
  // be checked and it holds.
  assert.deepEqual(seen({ state: "unknown", by: "kind", kind: "function", name: "" }),
    ["function::bookings", "function::count_rows"]);
  assert.deepEqual(seen({ state: "absent", by: "kind", kind: "api", name: "" }), []);
  // AN AMBIGUOUS REFERENCE SCOPES TO NOTHING, and so does an unreconciled one:
  // *"Missing or ambiguous references must not regain certainty through an
  // unrestricted prose match."* Both carry `kind: ""`, and THAT is the test —
  // filtering for the empty kind would match every item whose own kind is
  // missing rather than none of them, which is the empty-needle shape in the
  // one branch whose whole job is to answer nothing.
  assert.deepEqual(seen({ state: "unknown", by: "ambiguous", kind: "", name: "bookings" }), []);
  assert.deepEqual(seen({ state: "unknown", by: "", kind: "", name: "" }), []);
  assert.deepEqual(evidenceItems(KINDED, null), [], "a requirement nothing reconciled was weighed against everything");
  assert.deepEqual(evidenceItems([{ name: "bookings", holds: ["user"] }], { state: "unknown", by: "kind", kind: "", name: "" }), [],
    "an item with no kind was matched by a reference with no kind");
  assert.deepEqual(evidenceItems(null, { state: "found", by: "item", kind: "table", name: "bookings" }), []);
  // AN APPLIED ITEM WITH NO KIND IS IN NO HAYSTACK, which is the other side of
  // the same coin and needs a NON-empty reference kind to be visible at all.
  // Every real item carries one (`appliedFacts` stamps it), so admitting a
  // kindless one everywhere is invisible in the product and is exactly the
  // pre-`kind` fixture shape leaking back in — the drift that hid this gap.
  assert.deepEqual(evidenceItems([{ name: "bookings", holds: ["user"] }], { state: "found", by: "item", kind: "table", name: "bookings" }), [],
    "an item with no kind was admitted to a table's haystack");
  assert.deepEqual(evidenceItems([{ name: "bookings" }], { state: "unknown", by: "kind", kind: "table", name: "" }), [],
    "an item with no kind was admitted to the step's haystack");
  // THE NAME IS COMPARED FOLDED, because `referenceOf` folds its half and a
  // real applied name need not be lowercase — a route is `/Status` as readily
  // as `/status`. Folding only one side is a lookup that misses by case.
  assert.deepEqual(
    evidenceItems([{ kind: "page", name: "/Status" }], { state: "found", by: "item", kind: "page", name: "/status" }).map((m) => m.name),
    ["/Status"], "the reference was folded and the applied name was not");
  // AN UNKNOWN `by` IS FAIL-CLOSED. `implementationOf` answers only the four
  // above, so this is the default nothing reaches today — and a default that
  // fell through to the whole of `made` would restore the bypass for whatever
  // fifth answer that reader grows next.
  assert.deepEqual(evidenceItems(KINDED, { state: "unknown", by: "sideways", kind: "table", name: "bookings" }), [],
    "an unrecognised reconciliation was weighed against everything of its kind");
  // A NON-ARRAY `made` ANSWERS NOTHING RATHER THAN THROWING — the same
  // tolerance `claimEvidence` has one line down, and this reader is exported.
  assert.deepEqual(evidenceItems("bookings", { state: "found", by: "item", kind: "table", name: "bookings" }), []);
  assert.deepEqual(evidenceItems({ 0: KINDED[0] }, { state: "unknown", by: "kind", kind: "table", name: "" }), []);
  // ── AND THE SCOPE IS REALLY THE ONE THE LOOKUP USES, driven end to end ───
  //
  // The two above are pure functions; this is the hop between them, which is
  // the layer the bypass lived in and the one a module test of either alone
  // cannot see. Same claim, same applied items, three references.
  const scoped = (kind) => requirementOutcomes(
    cleanRequirements([{ need: "n", status: "covered", by: "bookings is kept and count_rows is internal", item: kind === "table" ? "bookings" : "count_rows", kind }], "table").list,
    { made: KINDED, reportable: ["table", "function", "page", "api", "job"], existing: { items: [], kinds: ["table", "function"] } })[0];
  assert.equal(scoped("function").configuredBy, "count_rows: internal",
    "the referenced item's own configuration stopped being recorded");
  assert.equal(scoped("table").configuredBy, undefined,
    "the function's setting was recorded against a claim about the table");
  assert.equal(scoped("table").state, "unverified", "another item's configuration promoted a claim about the table");
  assert.equal(scoped("component").state, "unknown",
    "an applied item of another kind rescued a claim nobody can see");
  // …AND A HAND-OFF'S `by` IS NEVER READ, whatever it says. `cleanRequirements`
  // drops `by` for `elsewhere` — a requirement asking another step for
  // something has made no claim of its own — so this is the SECOND wall, and it
  // is the one that holds for a caller handing an uncleaned list, which
  // `requirementOutcomes` accepts. The two are asserted apart: the raw entry
  // keeps its `by`, and the outcome must ignore it.
  const handoff = { need: "n", status: "elsewhere", step: "function", by: "count_rows is internal" };
  const [hoff] = requirementOutcomes([handoff], { told: ["function"], made: KINDED, reportable: ["table", "function"], existing: { items: [], kinds: ["table", "function"] } });
  assert.equal(handoff.by, "count_rows is internal", "the fixture lost the claim this case is about");
  assert.equal(hoff.configuredBy, undefined, "a hand-off's prose was read as a claim it never made");
  assert.equal(hoff.contradictedBy, undefined, "a hand-off's prose was weighed against the applied items");
  // ⚠ RE-ANCHORED 2026-09-19, AND THE EXPECTATION MOVED RATHER THAN BROKE. It
  // asserted `state === "unknown"`, which was a PROXY for "the prose bought
  // nothing" and stopped being one: the `function` step here was told this
  // hand-off and did apply a function, so `unverified` is earned by the step's
  // own output and not by a word in `by`. The two assertions above are the
  // property, and the isolating control below is what keeps them honest —
  // take the step's output away and the prose still buys nothing at all.
  assert.notEqual(hoff.state, "configured", "a hand-off's prose bought a configuration reading");
  assert.notEqual(hoff.state, "delivered", "a hand-off's prose bought a delivery reading");
  const [alone] = requirementOutcomes([handoff], { told: ["function"], made: [], reportable: ["table", "function"], existing: { items: [], kinds: ["table", "function"] } });
  assert.equal(alone.state, "missing", "with nothing applied, a hand-off's prose settled it anyway");
  assert.equal(alone.configuredBy, undefined);
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
  // RE-ANCHORED AGAIN 2026-09-15: `a` is an `elsewhere` hand-off with nothing
  // applied, no site inventory and no `item` — nobody looked, so `unknown`.
  // RE-ANCHORED A FOURTH TIME, 2026-09-15 (owner: *"Do not let the model's
  // covered label substitute for implementation evidence"*). `b` used to read
  // `unverified` here on the reasoning that "its own step ran and answered" —
  // which is the label doing the work, since this record carries no `by`, no
  // `item`, nothing applied and no site inventory. **BOTH ENTRIES ARE NOW THE
  // SAME STATE, and that IS the property**: two different statuses with the
  // same nothing behind them get the same honest answer.
  assert.deepEqual(rec.counts, { total: 2, covered: 1, elsewhere: 1, unsupported: 0, unreadable: 1,
    delivered: 0, configured: 0, unverified: 0, unknown: 2, missing: 0, blocked: 0, failed: 0 });
  assert.deepEqual(rec.requirements.map((r) => r.state), ["unknown", "unknown"]);

  // ── THREE FINDINGS THAT REACHED THE REPLY AND NOT THE RECORD (2026-09-17) ──
  //
  // ⚠ THE FIRST TWO WERE PASSED IN AND DROPPED. The addon route has handed
  // `missingPages` and `unknownKit` to this function since each was written and
  // neither was in the destructure — measured, both answered `undefined`. So a
  // page that did not survive and a kit name that is not in the kit were on the
  // reply and absent from the thing anybody comes back to. The third is the
  // pages a large site's prompt window could not carry.
  const carried = requirementRecord({
    list: [], missingPages: ["/gallery"], unknownKit: ["not-a-kit-part"], unseenPages: ["src/routes/about.tsx"],
  });
  assert.deepEqual(carried.missingPages, ["/gallery"], "a page that did not survive is on the reply and not the record");
  assert.deepEqual(carried.unknownComponents, ["not-a-kit-part"], "a kit name that is not a kit name never reaches the record");
  assert.deepEqual(carried.unseenPages, ["src/routes/about.tsx"], "what the prompt window could not carry never reaches the record");
  // …AND AN ORDINARY CHANGE CARRIES THREE EMPTY LISTS rather than three absent
  // keys, so a reader can tell "nothing was dropped" from "this record predates
  // the field".
  assert.deepEqual([rec.missingPages, rec.unknownComponents, rec.unseenPages], [[], [], []]);
  // …AND THE CONTROL THAT KEEPS `unknown` FROM BEING A NEW DEFAULT: give the
  // same `covered` entry something real to reconcile against and it moves. A
  // record where every state collapses to one is not a reader, it is a stamp.
  // RE-ANCHORED 2026-09-15: a `covered` reference is `{kind, item}`, so the
  // control declares the kind. Without it the reference is ambiguous and the
  // honest answer is `unknown` — which the line below asserts, because a
  // control that no longer moves is not a control.
  const backed = requirementRecord({
    list: cleanRequirements([{ need: "b", status: "covered", item: "bookings", kind: "table" }], "table").list,
    made: [{ kind: "table", name: "bookings", holds: [], fails: [], checked: [] }],
  });
  assert.deepEqual(backed.requirements.map((r) => r.state), ["unverified"],
    "an applied item named by the claim stopped establishing the implementation");
  assert.equal(backed.requirements[0].implementedBy, "bookings");
  // …AND THE KIND IS WHAT MADE IT RESOLVABLE: the same claim without it is a
  // reference nothing can identify, which is the owner's *"ambiguous references
  // should remain unknown"* and is what the two collisions cost when it was a
  // name search instead.
  const vague = requirementRecord({
    list: cleanRequirements([{ need: "b", status: "covered", item: "bookings" }], "table").list,
    made: [{ kind: "table", name: "bookings", holds: [], fails: [], checked: [] }],
  });
  assert.deepEqual(vague.requirements.map((r) => r.state), ["unknown"],
    "a reference with no kind was resolved against an applied item anyway");
  assert.equal(vague.requirements[0].unresolved, "no-kind");
  // …AND THE HAND-OFF IS STILL REPORTED, which is the half that must not be
  // lost when it stops being said as work that is not there.
  assert.deepEqual(rec.handoffs, { delivered: 0, undelivered: 1 },
    "the hand-off ledger stopped counting a step that never heard its requirement");
  // …AND A RECORD THAT CAN SEE THE PAGE STEP MADE NOTHING SAYS SO.
  const sighted = requirementRecord({
    list: cleanRequirements([{ need: "a", status: "elsewhere", step: "page" }, { need: "b", status: "covered" }]).list,
    ran: ["table"], reportable: ["page"], existing: { items: [], kinds: ["page"] },
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
    delivered: 0, configured: 0, unverified: 0, unknown: 0, missing: 0, blocked: 0, failed: 0 });
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
  // RE-ANCHORED 2026-09-16 onto the producer's own shape — see the note in
  // "requirementNote says only what is still outstanding". `ran.requirements`
  // already carry `from: "table"` (they come off the real `runAdd`), so the
  // kind on the applied item is the half this fixture was missing.
  const made = [{ kind: "table", name: "repairs", holds: ["user", "own", "bike", "status"], fails: ["anyone", "public", "members", "none"], checked: [] }];
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
  // RE-ANCHORED 2026-09-15 onto the clause this need really earns: the page
  // step was TOLD, and nothing establishes that a page for it exists — no
  // `item`, nothing of that kind applied, no site inventory. "I've set that up"
  // would be the claim item 3 rules out.
  assert.match(note.slice(note.indexOf("I can't see from here whether ")),
    /a customer sees the repair listed on a page/);
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
  const wrong = [{ kind: "table", name: "repairs", holds: ["anyone", "bike"], fails: ["user", "own", "members", "none"], checked: [] }];
  assert.match(requirementNote(ran.requirements, { told: ["page"], made: wrong }),
    /can't confirm from here that a customer can book a repair/,
    "a claim naming permissions the applied table does not have was read as delivered");
  assert.equal(requirementRecord({ list: ran.requirements, ran: ["table", "page"], told: ["page"], made: wrong }).counts.configured, 0,
    "a claim the applied table contradicts was recorded as configuration that holds");
  // …AND `delivered` IS STILL REACHABLE, which is what makes the three states
  // three rather than a demotion of one. `checked` is the behaviour really
  // exercised; NOTHING on the addon path fills it today (declared in
  // `appliedFacts`), so the demonstration is the module's.
  const proven = [{ kind: "table", name: "repairs", holds: ["user", "own"], fails: ["anyone"], checked: ["repairs"] }];
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
  // RE-ANCHORED AGAIN 2026-09-15: the page hand-off names no `item` and no page
  // is in `made`, so it is `unknown` rather than `unverified`. The PAIR the
  // customer hears as one sentence is now configured + unverified, and the
  // hand-off's own sentence is the unknown clause — asserted on the note above.
  assert.deepEqual(rec.counts.unverified, 0);
  assert.deepEqual(rec.counts.unknown, 1, "the page hand-off nobody could tie to a route was not counted as unseen");
  assert.equal(rec.counts.configured + rec.counts.unverified + rec.counts.unknown, 2,
    "the two unconfirmed needs stopped being two");
  assert.deepEqual(rec.counts.failed, 1);
  assert.deepEqual(rec.counts.missing, 0, "a hand-off that was really delivered was read as work that is not there");
  assert.deepEqual(rec.handoffs, { delivered: 1, undelivered: 0 });
  assert.deepEqual(rec.handedTo, { page: ["a customer sees the repair listed on a page"] });
});

// ── ONE NEED, ONE OUTCOME: THE HAND-OFF RECONCILED BY EXPLICIT ID ────────────
//
// Run 50's finding. Two designers both spoke to "that count runs every night at
// 11": the function step handed it on with no item (read `unknown`), the job
// step covered it naming `nightly_booking_count` (read `configured`), and the
// customer heard the pessimistic half about a job that was registered and had
// just been fired successfully.
test("a hand-off is reconciled by the id the receiving step echoes, never by prose", async () => {
  const m = await import("../builder/site-requirements.mjs");
  const MADE = [{ kind: "job", name: "nightly_booking_count", holds: ["1440", "23:00"], fails: [], checked: [] }];
  const OPTS = { told: ["job"], made: MADE, reportable: ["job", "function"] };
  const NEED = "That count runs every night at 11";

  // THE ID IS OURS AND DETERMINISTIC, and it reaches the receiving designer.
  const handed = m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job" }], "function").list;
  assert.equal(handed[0].id, "function#0");
  const brief = m.requirementBrief(handed, "job");
  assert.match(brief, /\[function#0\] That count runs every night at 11/, "the brief must print the id the answer is to echo");
  assert.match(brief, /put its id in `answers`/, "and must say to echo it");

  // RUN 50'S CASE, with the echo. Both entries survive for diagnosis, the
  // hand-off reads `configured`, and the customer hears it ONCE.
  const answered = m.cleanRequirements([{ need: NEED, status: "covered", by: "nightly_booking_count job at 23:00 every 1440 minutes", kind: "job", item: "nightly_booking_count", answers: "function#0" }], "job").list;
  assert.equal(answered[0].answers, "function#0", "the echo must survive cleaning");
  const both = [...handed, ...answered];
  const out = m.requirementOutcomes(both, OPTS);
  assert.equal(out.length, 2, "both entries are preserved for diagnosis");
  const ho = out.find((r) => r.status === "elsewhere");
  assert.equal(ho.state, "configured", "the reconciled hand-off must stop reading `unknown`");
  assert.equal(ho.reconciledBy, "job#0");
  assert.equal(ho.reconciledItem, "nightly_booking_count", "the receiving step's IMPLEMENTED item is attached");
  const note = m.requirementNote(both, OPTS);
  assert.equal(note.split(NEED).length - 1, 1, `the need must be said to the customer exactly once, got: ${note}`);

  // WITHOUT THE ECHO IT IS EXACTLY TODAY'S BEHAVIOUR. Additive and fail-closed:
  // an older caller, a designer that did not echo, or a list with no ids at all
  // reconciles nothing rather than guessing.
  const noEcho = m.cleanRequirements([{ need: NEED, status: "covered", by: "nightly_booking_count job at 23:00", kind: "job", item: "nightly_booking_count" }], "job").list;
  const before = m.requirementOutcomes([...handed, ...noEcho], OPTS).find((r) => r.status === "elsewhere");
  // ⚠ RE-ANCHORED 2026-09-19: `unknown` was a PROXY for "the reconciliation did
  // nothing", and it stopped being one when a hand-off the step really heard
  // started reading its own step's output (run 51's fix). The property is the
  // reconciliation, so it is asserted directly: no link, and none of the
  // readings only an echo can buy.
  assert.equal(before.reconciledBy, undefined, "a hand-off with no echo was linked to something");
  assert.equal(before.reconciledItem, undefined, "a hand-off with no echo was credited an item");
  assert.notEqual(before.state, "configured", "with no echo the hand-off took the echo's reading");
  assert.equal(before.reconciledBy, undefined);

  // PROSE MUST NOT JOIN THEM. The needs are word-for-word identical here and
  // the echo is absent, so anything that matched descriptions would reconcile.
  assert.equal(noEcho[0].need, handed[0].need, "this control is only meaningful while the two needs read alike");
  // …AND THE RECONCILER MUST BE RUNNING WHILE IT REFUSES. With nothing echoing
  // anywhere the function returns early, so the case above cannot see a prose
  // fallback inside the join — a sweep survivor proved exactly that. A SECOND,
  // echoing pair arms the join; the identical-prose pair beside it must still
  // come back unreconciled.
  const other = [
    ...m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job" }, { need: "Something else entirely", status: "elsewhere", step: "job" }], "function").list,
    ...m.cleanRequirements([
      { need: NEED, status: "covered", by: "nightly_booking_count at 23:00", kind: "job", item: "nightly_booking_count" },
      { need: "Something else entirely", status: "covered", by: "nightly_booking_count at 23:00", kind: "job", item: "nightly_booking_count", answers: "function#1" },
    ], "job").list,
  ];
  const armed = m.requirementOutcomes(other, OPTS);
  assert.equal(armed.find((r) => r.status === "elsewhere" && r.need === "Something else entirely").reconciledBy, "job#1",
    "the join must be armed, or the assertion below proves nothing");
  const proseOnly = armed.find((r) => r.status === "elsewhere" && r.need === NEED);
  assert.equal(proseOnly.reconciledBy, undefined, "identical prose must not reconcile while the join is running");
  assert.equal(proseOnly.state, "unknown");
});

test("the reconciliation clears only the requirement it names", async () => {
  const m = await import("../builder/site-requirements.mjs");
  const MADE = [{ kind: "job", name: "nightly_booking_count", holds: ["1440", "23:00"], fails: [], checked: [] }];
  const OPTS = { told: ["job"], made: MADE, reportable: ["job", "function"] };
  // THE CONTROL THE OWNER ASKED FOR: two DISTINCT requirements handed to one
  // step, one of them answered. "The step ran" must not clear the other.
  const handed = m.cleanRequirements([
    { need: "That count runs every night at 11", status: "elsewhere", step: "job" },
    { need: "The count is of bookings, not repairs", status: "elsewhere", step: "job" },
  ], "function").list;
  const answered = m.cleanRequirements([{ need: "That count runs every night at 11", status: "covered", by: "nightly_booking_count at 23:00", kind: "job", item: "nightly_booking_count", answers: "function#0" }], "job").list;
  const out = m.requirementOutcomes([...handed, ...answered], OPTS);
  const byNeed = (n) => out.find((r) => r.status === "elsewhere" && r.need === n);
  assert.equal(byNeed("That count runs every night at 11").state, "configured");
  assert.equal(byNeed("The count is of bookings, not repairs").state, "unknown", "an unanswered hand-off to the same step must stay unreconciled");
  assert.equal(byNeed("The count is of bookings, not repairs").reconciledBy, undefined);
  // AND IT IS STILL SAID TO THE CUSTOMER, in the clause for its own state.
  const note = m.requirementNote([...handed, ...answered], OPTS);
  assert.match(note, /I can't see from here whether The count is of bookings, not repairs/);
});

test("reconciliation refuses the three shapes that would launder a verdict", async () => {
  const m = await import("../builder/site-requirements.mjs");
  const NEED = "That count runs every night at 11";
  // EVERY ANSWER CARRIES `from: "job"`, because the hand-off names that step and
  // an answer from anywhere else is refused before any of these three are asked.
  // These fixtures omitted it while nothing read it, and the step check is what
  // made the omission matter — a fake less specified than the real thing.
  const handed = { need: NEED, status: "elsewhere", step: "job", from: "function", id: "function#0" };
  const ho = (outs) => outs.find((r) => r.status === "elsewhere");

  // 1. AN ANSWER WHOSE OWN IMPLEMENTATION WAS NOT FOUND cannot settle anything
  //    — that is an unknown laundering into a configured through a claim
  //    nobody could check.
  //    ITS STATE IS `configured`, DELIBERATELY: with `unknown` the entry would
  //    be skipped by the state test as well, so the implementation test would
  //    never be reached and cutting it would change nothing — which is exactly
  //    the survivor that sent this case back. One reason to skip at a time.
  const unfound = m.reconcileHandoffs([handed, { status: "covered", from: "job", answers: "function#0", state: "configured", implementation: "absent", id: "job#0" }]);
  assert.equal(ho(unfound).state, undefined, "an answer nobody could verify must not reconcile");
  const control = m.reconcileHandoffs([handed, { status: "covered", from: "job", answers: "function#0", state: "configured", implementation: "found", implementedBy: "j", id: "job#0" }]);
  assert.equal(ho(control).state, "configured", "…and the same entry WITH its implementation found does reconcile, or the line above forbids nothing");

  // 2. AN `unsupported` ANSWER — the step saying it could NOT — must not
  //    settle what it was asked for. (The cleaner drops `answers` there too,
  //    which is the belt; this is the wall.)
  const refused = m.reconcileHandoffs([handed, { status: "unsupported", from: "job", answers: "function#0", state: "failed", implementation: "found", id: "job#0" }]);
  assert.equal(ho(refused).state, undefined, "a step that refused must not reconcile the hand-off it refused");
  assert.equal(m.cleanRequirements([{ need: "x", status: "unsupported", why: "no", answers: "function#0" }], "job").list[0].answers, undefined,
    "the cleaner must not keep an echo on a refusal");

  // 3. CONFIGURATION MUST NEVER IMPLY DELIVERED BEHAVIOUR. Even an answering
  //    entry that reached `delivered` hands the hand-off `configured`: the
  //    hand-off is evidence about what was SET UP, and behaviour is the
  //    answering entry's own claim to make.
  const deliv = m.reconcileHandoffs([handed, { status: "covered", from: "job", answers: "function#0", state: "delivered", implementation: "found", implementedBy: "j", kind: "job", id: "job#0" }]);
  assert.equal(ho(deliv).state, "configured", "a delivered answer must cap the hand-off at configured");

  // AND AN ECHO NAMING NOTHING reconciles nothing rather than matching loosely.
  const stray = m.reconcileHandoffs([handed, { status: "covered", from: "job", answers: "function#9", state: "configured", implementation: "found", id: "job#0" }]);
  assert.equal(ho(stray).state, undefined);
});

test("a scheduled job says the schedule is set and its automatic running is not verified", async () => {
  const m = await import("../builder/site-requirements.mjs");
  // THE INTENDED CUSTOMER MEANING (owner, 2026-09-16): "Scheduled nightly at
  // 23:00 Europe/London. Automatic execution has not yet been verified."
  const MADE = [{ kind: "job", name: "nightly_booking_count", holds: ["1440", "23:00"], fails: [], checked: [] }];
  const OPTS = { told: ["job"], made: MADE, reportable: ["job", "function"] };
  const list = [
    ...m.cleanRequirements([{ need: "That count runs every night at 11", status: "elsewhere", step: "job" }], "function").list,
    ...m.cleanRequirements([{ need: "That count runs every night at 11", status: "covered", by: "nightly_booking_count at 23:00", kind: "job", item: "nightly_booking_count", answers: "function#0" }], "job").list,
  ];
  const note = m.requirementNote(list, OPTS);
  assert.match(note, /Scheduled as you asked/, "the schedule half must be stated, not hedged");
  assert.match(note, /Automatic running hasn't been verified from here yet/, "the unverified half is specific to a job and must be said");
  // AND IT MUST NOT CLAIM WHAT NOTHING CHECKED. A job's applied facts carry
  // `everyMinutes` and `at` and NO timezone, so a clause quoting one would be
  // stating a fact this function cannot see.
  assert.doesNotMatch(note, /Europe\/London|UTC/, "the zone is not available here and must not be invented");
  // A NON-JOB KEEPS THE GENERAL CLAUSE — the job sentence is about one specific
  // unverified thing and must not be said of a table or a function.
  const tbl = m.cleanRequirements([{ need: "Bookings are stored", status: "covered", by: "bookings", kind: "table", item: "bookings" }], "table").list;
  const n2 = m.requirementNote(tbl, { told: [], made: [{ kind: "table", name: "bookings", holds: ["collect"], fails: [], checked: [] }], reportable: ["table"] });
  assert.match(n2, /I've set that up, but I can't confirm/);
  assert.doesNotMatch(n2, /Scheduled as you asked/);
});

test("an echoed id cannot overwrite a known dependency failure", async () => {
  const m = await import("../builder/site-requirements.mjs");
  // THE OWNER'S REPRODUCTION (2026-09-16). A hand-off naming a job the database
  // REFUSED reads `blocked`; an answering entry naming a DIFFERENT job that
  // applied, echoing the id, overwrote it — and the customer was told
  // "scheduled as you asked" about work that had failed.
  const MADE = [{ kind: "job", name: "good_job", holds: ["1440", "23:00"], fails: [], checked: [] }];
  const OPTS = { told: ["job"], made: MADE, reportable: ["job", "function"],
                 failedItems: [{ kind: "job", name: "broken_job" }], failed: ["job"] };
  const NEED = "The nightly reminder goes out";
  const list = [
    ...m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job", item: "broken_job" }], "function").list,
    ...m.cleanRequirements([{ need: NEED, status: "covered", by: "good_job at 23:00", kind: "job", item: "good_job", answers: "function#0" }], "job").list,
  ];
  const out = m.requirementOutcomes(list, OPTS);
  const ho = out.find((r) => r.status === "elsewhere");
  assert.equal(ho.state, "blocked", "a known dependency failure must survive an echoed id");
  assert.equal(ho.reconciledBy, undefined);
  assert.match(ho.why, /broken_job/, "and must still name the thing that failed");

  // AND THE ANSWER DOES NOT SPEAK OVER THE FINDING. Refusing to reconcile is
  // half of it; the answering entry is still `configured` and carries the same
  // need in its own words, so without this the customer hears both "waiting on
  // another part that didn't work" AND "scheduled as you asked" about one
  // sentence — and the reassuring half is the wrong one to leave standing.
  const note = m.requirementNote(list, OPTS);
  assert.match(note, /waiting on another part of the same change that didn't work/);
  assert.doesNotMatch(note, /Scheduled as you asked/, "the answer must not report success over a failure it was refused against");
  assert.equal(note.split(NEED).length - 1, 1, `one need, one sentence — got: ${note}`);
  // THE RECORD KEEPS BOTH, which is what makes this a reporting decision rather
  // than a deletion: the developer can still see what each designer said.
  const ans = out.find((r) => r.status === "covered");
  assert.equal(ans.state, "configured");
  assert.equal(ans.overruledBy, "function#0");
  assert.equal(ans.overruledAs, "blocked");

  // ── AND THE STATE GUARD IS ISOLATED, because in the case above the REFERENCE
  // check stops it too — two walls, and a sweep mutant proved they could not be
  // killed one at a time. Here the hand-off names NO item, so `referenceOf` is
  // null and that check passes; the step it was handed to failed, so the state
  // is `blocked` and the state guard is the only thing left standing.
  const noRef = [
    ...m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job" }], "function").list,
    ...m.cleanRequirements([{ need: NEED, status: "covered", by: "good_job at 23:00", kind: "job", item: "good_job", answers: "function#0" }], "job").list,
  ];
  const alone = m.requirementOutcomes(noRef, { told: ["job"], made: MADE, reportable: ["job", "function"], failed: ["job"], failedItems: [{ kind: "job", name: "other_job" }] });
  const hoAlone = alone.find((r) => r.status === "elsewhere");
  assert.equal(m.referenceOf(noRef[0]), null, "this case is only meaningful while the hand-off names nothing to check");
  assert.equal(hoAlone.state, "blocked", "a hand-off to a step that failed is blocked");
  assert.equal(hoAlone.reconciledBy, undefined, "and an echo must not overwrite it, with no reference check to fall back on");

  // ── THE OVERRULE IS ARMED BY A REFUSED ANSWER, NEVER BY A BLOCKED HAND-OFF ──
  //
  // A sweep survivor is why this is here. The silencing exists for an answer
  // that WOULD have reconciled and was refused over a finding; an entry that
  // could never have reconciled — its own implementation was not found — is not
  // that answer, it is an independent `missing` finding about its OWN item, and
  // losing it would cost the customer a "Still to do" they can act on.
  // `answering` is what tells those apart, so the arming reads it.
  const NEED_B = "Bookings are stored";
  // BOTH HAND-OFFS COME OUT OF ONE `cleanRequirements` CALL, because the id is
  // `<owner>#<position in THIS list>` — two separate calls would stamp both
  // `function#0`, and the second echo would be a stray one. A fixture that mints
  // its ids the way the product does is the only one whose echoes mean anything.
  const mixed = [
    ...m.cleanRequirements([
      { need: NEED, status: "elsewhere", step: "job", item: "broken_job" },   // function#0 → blocked
      { need: NEED_B, status: "elsewhere", step: "table" },                   // function#1 → answered
    ], "function").list,
    ...m.cleanRequirements([{ need: NEED, status: "covered", by: "ghost_job", kind: "job", item: "ghost_job", answers: "function#0" }], "job").list,
    ...m.cleanRequirements([{ need: NEED_B, status: "covered", by: "bookings", kind: "table", item: "bookings", answers: "function#1" }], "table").list,
  ];
  const MOPTS = { told: ["job", "table"], reportable: ["job", "function", "table"], failed: ["job"],
                  failedItems: [{ kind: "job", name: "broken_job" }],
                  made: [{ kind: "table", name: "bookings", holds: ["collect"], fails: [], checked: [] }] };
  const mo = m.requirementOutcomes(mixed, MOPTS);
  const ghost = mo.find((r) => r.item === "ghost_job");
  // THIS CASE IS ABOUT THE ARMING, not about WHICH disqualifier applies — so it
  // asserts only that the entry is disqualified, which is what keeps it out of
  // `answering`. (Nothing here made a `ghost_job`, so its implementation is not
  // `found` and its state is not reconcilable; either alone is enough.)
  assert.notEqual(ghost.implementation, "found", "this case is only meaningful while that answer could never have reconciled");
  assert.ok(!["delivered", "configured", "unverified"].includes(ghost.state), `…nor reached a reconcilable state — got ${ghost.state}`);
  assert.equal(ghost.overruledBy, undefined, "an entry that was never an answer must not be silenced by a blocked hand-off");
  const mnote = m.requirementNote(mixed, MOPTS);
  assert.match(mnote, /Still to do/, "and its own finding must still reach the customer");
  assert.equal(mnote.split(NEED_B).length - 1, 1, `the answered hand-off is still said once — got: ${mnote}`);
});

test("an answer is refused when it comes from the wrong step or names a different thing", async () => {
  const m = await import("../builder/site-requirements.mjs");
  // MIRRORS RUN 50: the claim names the schedule and the applied job holds it,
  // so the answer is `configured` and the cap has something to cap.
  const MADE = [{ kind: "job", name: "good_job", holds: ["1440", "23:00"], fails: [], checked: [] }];
  const OPTS = { told: ["job"], made: MADE, reportable: ["job", "function"] };
  const NEED = "X happens nightly";
  const ho = (l) => m.requirementOutcomes(l, OPTS).find((r) => r.status === "elsewhere");

  // THE ANSWER MUST COME FROM THE STEP THE REQUEST WAS ADDRESSED TO.
  const wrongStep = [
    ...m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job" }], "function").list,
    ...m.cleanRequirements([{ need: NEED, status: "covered", by: "good_job at 23:00", kind: "job", item: "good_job", answers: "function#0" }], "page").list,
  ];
  assert.equal(ho(wrongStep).reconciledBy, undefined, "a step that was never asked must not answer");

  // AND WHERE THE REQUEST NAMED ITS OWN THING, THE ANSWER MUST BE THAT THING.
  const wrongItem = [
    ...m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job", item: "other_job" }], "function").list,
    ...m.cleanRequirements([{ need: NEED, status: "covered", by: "good_job at 23:00", kind: "job", item: "good_job", answers: "function#0" }], "job").list,
  ];
  assert.equal(ho(wrongItem).reconciledBy, undefined, "an answer about a different item is not an answer");

  // ── AND THE KIND IS HALF THE IDENTITY, which a sweep survivor is why. A name
  // alone collides: `bookings` is the commonest thing on this platform to be a
  // table AND the thing a job is named after, so an answer naming an applied
  // TABLE would have settled a request for a JOB. This is the `{kind, name}`
  // identity this file already records, met one function later.
  // THE TWO LISTS ARE IDENTICAL AND ONLY THE ANSWER'S OWN KIND MOVES, so the
  // control is about the kind and not about which items exist.
  const BOTH = [
    { kind: "table", name: "bookings", holds: ["collect"], fails: [], checked: [] },
    { kind: "job", name: "bookings", holds: ["1440", "23:00"], fails: [], checked: [] },
  ];
  const kindPair = (k) => m.requirementOutcomes([
    ...m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job", item: "bookings" }], "function").list,
    ...m.cleanRequirements([{ need: NEED, status: "covered", by: "bookings at 23:00", kind: k, item: "bookings", answers: "function#0" }], "job").list,
  ], { told: ["job"], made: BOTH, reportable: ["job", "function", "table"] }).find((r) => r.status === "elsewhere");
  assert.equal(kindPair("table").reconciledBy, undefined, "a table named like the job must not answer a request for the job");
  assert.equal(kindPair("job").reconciledBy, "job#0", "…and the same answer as a JOB does reconcile, or the line above forbids nothing");

  // RUN 50'S LEGITIMATE CASE IS THE CONTROL AND MUST STILL WORK: the hand-off
  // named NO item, so there is nothing to contradict and the echo stands.
  const unnamed = [
    ...m.cleanRequirements([{ need: NEED, status: "elsewhere", step: "job" }], "function").list,
    ...m.cleanRequirements([{ need: NEED, status: "covered", by: "good_job at 23:00", kind: "job", item: "good_job", answers: "function#0" }], "job").list,
  ];
  assert.equal(ho(unnamed).reconciledBy, "job#0", "an unnamed hand-off answered by its own step must still reconcile");
  assert.equal(ho(unnamed).state, "configured");
});

// ─────────────────────────────────────────────────────────────────────────────
// THIS CHANGE'S OWN OUTPUT IS NOT THE SITE'S BACK CATALOGUE (2026-09-19)
//
// Owner, after run 51: *"Check why the reply says it cannot establish the QR
// implementation when this run created and published it. Keep configuration
// separate from verified behavior."*
// ─────────────────────────────────────────────────────────────────────────────

test("a kind this layer cannot see at all is never reportable", () => {
  // THE `reportable` LIST IS WHAT SAYS "NOBODY LOOKED", and a kind off
  // `APPLIED_KINDS` has to stay off it however the route computes readiness —
  // otherwise an unenumerable kind answers `absent`, which is "still to do"
  // over work that may be perfectly there. A sweep survivor is why this is
  // here: the route's filter is what enforces it and no case asked.
  const ASK = { need: "the page shows opening hours", status: "elsewhere", step: "component", item: "hours-band", kind: "component" };
  const told = { heard: new Set(["component"]), resting: new Map() };
  // WITH THE KIND ADMITTED TO `reportable` IT IS STILL UNKNOWN, because
  // `OPAQUE_KINDS` is the wall — the two are separate and both must hold.
  assert.equal(implementationOf(ASK, [], ["component"], { items: [], kinds: [] }, told).state, "unknown",
    "an unenumerable kind was read as absent");
  // …AND A KIND THE SITE CAN HOLD NEEDS ITS INVENTORY READ. `qr` is on
  // `SITE_KINDS`, so "this change made none" is half an answer.
  const CODE = { need: "a code for the gallery", status: "elsewhere", step: "qr", item: "gallery", kind: "qr" };
  assert.equal(implementationOf(CODE, [], ["qr"], null, told).state, "unknown",
    "a kind whose site inventory was never read answered absent");
  assert.equal(implementationOf(CODE, [], ["qr"], { items: [], kinds: ["qr"] }, told).state, "absent",
    "the control: with the inventory read, both readers empty IS absence");
  // AND A KIND NOT REPORTABLE AT ALL IS UNKNOWN whatever the inventory says.
  assert.equal(implementationOf(CODE, [], [], { items: [], kinds: ["qr"] }, told).state, "unknown",
    "a kind this change cannot answer for was read as absent");
});

test("a count of a step's output is not an association with a requirement", () => {
  // ⚠ THE REPRODUCTION (owner, 2026-09-19): *"Remove output-count matching as
  // proof of requirement implementation. A gallery handoff currently becomes
  // 'set up' when the step produces only a Wi-Fi code."*
  //
  // RE-ANCHORED, NOT APPEASED. This case asserted the mechanism that is gone —
  // *"one ask on the step, one thing made by it"* — and its own fixture is what
  // shows why: the `made` list here and a Wi-Fi code are the SAME ARITHMETIC,
  // so the reading it pinned could not tell the two apart. The property it
  // should always have asserted is below, and it is about the things rather
  // than about how many of them there are.
  const ASK = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr" };
  const told = { heard: new Set(["qr"]), resting: new Map([["qr", 1]]) };
  const GALLERY = [{ kind: "qr", name: "gallery", holds: ["gallery"], fails: [], checked: [] }];
  const WIFI = [{ kind: "qr", name: "wifi", holds: [], fails: [], checked: [] }];
  // THE DEFECT: one ask, one code made, and the code opens no page at all.
  assert.equal(implementationOf(ASK, WIFI, COVERAGE_STEPS, null, told).state, "unknown",
    "a Wi-Fi code answered a hand-off about a gallery page");
  // AND THE CASE'S OWN POINT: the RIGHT code answers the same way, because a
  // count cannot tell them apart and nothing here may pretend otherwise.
  assert.equal(implementationOf(ASK, GALLERY, COVERAGE_STEPS, null, told).state, "unknown",
    "an un-named hand-off was still settled by its step's output");
  // ⚠ AND THE FIFTH ARGUMENT IS GONE. `implementationOf` took an `asked` bag
  // whose only reader was the count; a caller still passing one must change no
  // answer, or the removal left a door open.
  assert.deepEqual(implementationOf(ASK, GALLERY, COVERAGE_STEPS, null, told),
    implementationOf(ASK, GALLERY, COVERAGE_STEPS, null),
    "the removed argument still reaches a reader");
  // ── THE ASSOCIATION THAT DOES ANSWER, and it is the one that already existed:
  // `{kind, name}`, the requirement's own `item`, resolved by identity.
  const NAMED = { ...ASK, item: "gallery" };
  assert.deepEqual(implementationOf(NAMED, GALLERY, COVERAGE_STEPS, null),
    { state: "found", by: "item", where: "applied", name: "gallery", kind: "qr" });
  // …AND IT SEPARATES THE TWO CODES, which is the whole of what the count could
  // not do. `missing` is the actionable answer rather than the reassuring one.
  assert.equal(implementationOf(NAMED, WIFI, COVERAGE_STEPS, { items: [], kinds: ["qr"] }).state, "absent",
    "a named gallery code was satisfied by a Wi-Fi one");
  // …AND THE SITE'S OWN CODES ARE NOT THIS CHANGE'S. A change that made
  // nothing, on a site that carries five, still cannot say which one was asked.
  const site = { items: [{ kind: "qr", name: "wifi" }], kinds: ["qr"] };
  assert.equal(implementationOf(ASK, [], COVERAGE_STEPS, site, told).state, "unknown",
    "the site's existing codes answered for one this change did not make");
});

test("an un-named hand-off is unknown however its step was reached", () => {
  // ⚠ RE-ANCHORED, NOT APPEASED, and the property it protected is now
  // STRUCTURAL. This case drove the `heard` condition — a hand-off BACKWARD
  // names a step that already ran, so whatever that step made it made for its
  // own reasons — and `heard` existed only to bound the count. With the count
  // gone no un-named hand-off is settled by any output, forward or backward, so
  // the old fixture's two arms answer alike and it discriminates nothing.
  //
  // WHAT IT ASSERTS NOW is that the two directions really are one answer, with
  // a CONTROL that naming the thing is what resolves it — otherwise "always
  // unknown" would pass with the whole reader deleted.
  const BACK = { need: "the reminder shows their booking time", status: "elsewhere", step: "function" };
  const made = [{ kind: "function", name: "send_reminder", holds: [], fails: [], checked: [] }];
  assert.equal(implementationOf(BACK, made, COVERAGE_STEPS, null).state, "unknown",
    "a step's earlier output answered a need written after it ran");
  const FWD = { need: "a code for the gallery", status: "elsewhere", step: "qr" };
  const code = [{ kind: "qr", name: "gallery", holds: [], fails: [], checked: [] }];
  assert.equal(implementationOf(FWD, code, COVERAGE_STEPS, null).state, "unknown",
    "a forward hand-off was settled by its step's output with nothing naming it");
  // THE CONTROL: the same forward hand-off, naming what it wants.
  assert.equal(implementationOf({ ...FWD, item: "gallery" }, code, COVERAGE_STEPS, null).state, "found",
    "the control: a named hand-off resolves by identity");
});

test("a bare `covered` label earns nothing from its own step's output", () => {
  // ⚠ THE OTHER CONDITION, and the first cut of this change had it backwards.
  // A step ALWAYS produces something, so letting its output answer its own
  // unidentified claim makes every bare `covered` label buy *"I've set that
  // up"* — the exact sentence the owner struck out on 2026-09-15 (*"covered +
  // no implementation evidence still produces 'I've set that up.'"*). The
  // reading is for a HAND-OFF, which is a request addressed to a named step.
  const OWN = { need: "the codes are on the site", status: "covered", from: "qr" };
  const made = [{ kind: "qr", name: "gallery", holds: [], fails: [], checked: [] }];
  assert.equal(implementationOf(OWN, made, COVERAGE_STEPS, null).state,
    "unknown", "a step's own output answered its own unidentified claim");
  // ⚠ RE-ANCHORED: the CONTROL was a hand-off reaching the removed `made`, so
  // it asserted the mechanism rather than the property. The property is that a
  // bare label earns nothing WHERE A NAMED ONE EARNS SOMETHING — without the
  // second half "always unknown" passes with the reader deleted.
  assert.equal(implementationOf({ ...OWN, item: "gallery", kind: "qr" }, made, COVERAGE_STEPS, null).state,
    "found", "the control: a `covered` claim naming its item resolves by identity");
  // AND A HAND-OFF WITH NOTHING NAMED IS THE SAME ANSWER — the two statuses
  // differ in which haystack they search, never in whether a count may stand in.
  const ASK = { need: "the codes are on the site", status: "elsewhere", step: "qr" };
  assert.equal(implementationOf(ASK, made, COVERAGE_STEPS, null).state,
    "unknown", "a hand-off was settled by its step's output with nothing naming it");
});

test("no number of things made settles a requirement that names none", () => {
  // ⚠ RE-ANCHORED, NOT APPEASED. This case pinned the arithmetic — *"two asks
  // and one thing made: at least one of them has nothing"* — which was the
  // sound half of an unsound reading: it was exact about CARDINALITY and said
  // nothing about CORRESPONDENCE, so one ask and one thing made passed, and
  // that is precisely run 51's Wi-Fi code answering a gallery hand-off.
  //
  // THE PROPERTY NOW IS THAT THE COUNT CANNOT SETTLE ANYTHING AT ALL, driven
  // across every shape the old arithmetic separated — which is what makes this
  // a replacement rather than a deletion.
  const A = { need: "a code for the gallery", status: "elsewhere", step: "qr" };
  const one = [{ kind: "qr", name: "gallery", holds: [], fails: [], checked: [] }];
  const two = [...one, { kind: "qr", name: "order", holds: [], fails: [], checked: [] }];
  for (const made of [one, two]) {
    assert.equal(implementationOf(A, made, COVERAGE_STEPS, null).state, "unknown",
      "a count of " + made.length + " settled a requirement that names nothing");
  }
  // AND THE ANSWER IS THE SAME WHETHER THE STEP HEARD IT OR NOT — `heard` was
  // the count's own bound and went with it, so an older caller's bag changes
  // nothing rather than reaching a reader that is gone.
  assert.equal(implementationOf(A, one, COVERAGE_STEPS, null, { heard: new Set(["qr"]), resting: new Map([["qr", 1]]) }).state,
    "unknown", "the removed argument still reaches a reader");
  // THE CONTROL: the same two codes, and a requirement that names one of them.
  assert.equal(implementationOf({ ...A, item: "order" }, two, COVERAGE_STEPS, null).state, "found",
    "the control: an explicit item resolves against the same list");
});

test("an explicit item earns the set-up sentence and never the delivered one", () => {
  // CONFIGURATION, NEVER BEHAVIOUR — the owner's own instruction. The code is
  // there; nothing scanned it; the customer hears *"I've set that up, but I
  // can't confirm"* rather than *"I can't see from here whether"*.
  //
  // ⚠ RE-ANCHORED onto the association rather than the count: the requirement
  // names its code, which is what the sentence has always meant and what the
  // by-kind reading could only ever approximate.
  const ASK = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr", id: "page#0", item: "gallery" };
  const made = [{ kind: "qr", name: "gallery", holds: ["gallery"], fails: [], checked: [] }];
  const opts = { told: ["qr"], made, reportable: COVERAGE_STEPS };
  const out = requirementOutcomes([ASK], opts);
  assert.equal(out[0].state, "unverified", JSON.stringify(out[0]));
  assert.equal(out[0].implementation, "found", "the record does not say which reader answered");
  assert.equal(out[0].implementedBy, "gallery", "the record does not name the code it resolved");
  assert.equal(out[0].foundIn, "applied", "the site's back catalogue was credited with this change's work");
  assert.equal(out[0].handoff, "delivered");
  // THE NOTE TAKES THE RAW LIST AND THE SAME OPTIONS — it recomputes the
  // outcomes itself, so handing it `out` with nothing else asks a second,
  // evidence-free question and answers `unknown` about everything.
  const note = requirementNote([ASK], opts);
  assert.match(note, /I've set that up/, note);
  assert.doesNotMatch(note, /can't see from here whether A QR code/, note);
  assert.doesNotMatch(note, /Still to do/, note);
});

test("an unresolved answer cannot regain certainty through prose, and is spoken for", () => {
  // ⚠ Owner, 2026-09-19, reproduced before anything was touched: *"Reproduce an
  // echo with answers: "page#0", no item, and by: "the gallery code points at
  // /gallery". It currently produces both "I've set that up" and "I can't see
  // whether" for the same need. An unresolved answering entry must not regain
  // certainty through prose and contradict its original handoff."*
  //
  // THE ECHO SAYS WHICH REQUEST IS BEING ANSWERED; IT IS NOT EVIDENCE THAT IT
  // WAS. With no item the answer's own implementation is `unknown`, so
  // `reconcileHandoffs` refuses it — and `claimEvidence` then matched the word
  // `gallery` inside the sentence against the qr step's own applied code and
  // called it `configured`, which is a claim lifted above the request it
  // answers by prose alone.
  const NEED = "A QR code opens the gallery page.";
  const ASK = { need: NEED, status: "elsewhere", step: "qr", from: "page", id: "page#0" };
  const PROSE = "the gallery code points at /gallery";
  const made = [{ kind: "qr", name: "gallery", holds: ["gallery"], fails: [], checked: [] }];
  const existing = { kinds: ["qr", "page"], items: [{ kind: "page", name: "/" }] };
  const opts = { told: ["qr"], made, reportable: COVERAGE_STEPS, existing };
  const echo = (extra) => ({ need: NEED, status: "covered", from: "qr", id: "qr#0", answers: "page#0", ...extra });

  const list = [ASK, echo({ by: PROSE })];
  const out = requirementOutcomes(list, opts);
  const hand = out.find((r) => r.status === "elsewhere");
  const ans = out.find((r) => r.status === "covered");
  assert.equal(ans.state, "unknown", "a prose match lifted an answer that resolved to nothing: " + JSON.stringify(ans));
  assert.equal(ans.configuredBy, undefined, "the answer took a configuration verdict off its own sentence");
  assert.equal(hand.state, "unknown", "the hand-off moved: " + JSON.stringify(hand));
  // …AND THE TWO AGREE IN ONE SENTENCE. Gating the prose removes the
  // contradiction and leaves the need said TWICE in the customer's own words,
  // which is the duplicate half of the same incoherence; `spokenForBy` names
  // the request that says it, and the answer keeps every field in the record.
  assert.equal(ans.spokenForBy, "page#0", "the answer is not spoken for by its request: " + JSON.stringify(ans));
  assert.equal(ans.by, PROSE, "the answer's own words were rewritten rather than left alone");
  const note = requirementNote(list, opts);
  assert.equal(note, "I can't see from here whether " + NEED + " — nothing I can check says either way, "
    + "so have a look, and ask me for it again if it isn't there.", "not one honest sentence: " + note);
  assert.equal((note.match(/A QR code opens the gallery page/g) || []).length, 1, "one need was said twice: " + note);

  // ── CONTROL: THE LEGITIMATE ASSOCIATION IS UNTOUCHED. Same echo, naming its
  // item, so its implementation is FOUND, the gate opens and the reconciliation
  // runs exactly as before — which is what the owner asked be kept working.
  const good = requirementOutcomes([ASK, echo({ by: PROSE, kind: "qr", item: "gallery" })], opts);
  assert.equal(good.find((r) => r.status === "elsewhere").state, "configured",
    "the legitimate association stopped working: " + JSON.stringify(good));
  assert.equal(good.find((r) => r.status === "covered").spokenForBy, undefined,
    "a resolved answer was silenced as though it had resolved to nothing");
  assert.match(requirementNote([ASK, echo({ by: PROSE, kind: "qr", item: "gallery" })], opts), /I've set that up/);

  // ── CONTROL: AN ANSWER THAT LOOKED AND FOUND NOTHING IS A FINDING, NOT A
  // SILENCE. `absent` is resolved — resolved to NOT THERE — and *"Still to do"*
  // is the most actionable line in the reply. Silencing it would delete it, and
  // this is the case that made the rule ask for `unknown` rather than
  // `!== "found"`: the first cut used the looser test and ate this.
  const gone = requirementOutcomes([ASK, echo({ kind: "qr", item: "wifi" })], opts);
  const ga = gone.find((r) => r.status === "covered");
  assert.equal(ga.state, "missing", "the fixture does not reach the finding: " + JSON.stringify(ga));
  assert.equal(ga.spokenForBy, undefined, "a real finding was silenced as an unresolved answer: " + JSON.stringify(ga));
  assert.match(requirementNote([ASK, echo({ kind: "qr", item: "wifi" })], opts), /Still to do/);

  // ── CONTROL: AN ECHO NAMING A REQUEST NOBODY SENT KEEPS SPEAKING. It is the
  // only record of its own need, and silencing it would lose the need entirely
  // rather than say it once.
  const orphan = requirementOutcomes([ASK, echo({ by: PROSE, answers: "nobody#9" })], opts);
  assert.equal(orphan.find((r) => r.status === "covered").spokenForBy, undefined,
    "an echo answering nothing was silenced into thin air");

  // ── CONTROL: A BARE `covered` CLAIM KEEPS ITS PROSE MATCH. The gate asks for
  // an echo, so a claim that answers nobody is judged exactly as before — the
  // stricter reading was measured to lose five real findings and is not this.
  const plain = requirementOutcomes([{ need: NEED, status: "covered", from: "qr", id: "qr#0", by: PROSE }], opts);
  assert.equal(plain[0].state, "configured", "a bare claim lost its prose match: " + JSON.stringify(plain[0]));
});

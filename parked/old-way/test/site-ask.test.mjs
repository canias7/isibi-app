// PARKED (2026-11-03, park-old-way): the old-way half of test/site-ask.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The router that lets the builder be asked a question.
//
// Before this, `siteSend` had one decision in it and every message on an
// existing site ran a full rebuild — so a question cost ~21 credits and
// rewrote the customer's site. The failure mode this file guards is the
// opposite one: a router that swallows a real build request is worse than no
// router at all, because the customer cannot tell it from the builder being
// broken.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { modelsFor } from "../../../builder/build-models.mjs";
import {
  ASK_TOOL, ASK_MODEL, ASK_MAX_TOKENS, MAX_MESSAGE,
  MAX_CLARIFY, MIN_OPTIONS, MAX_OPTIONS, MAX_OPTION_CHARS, MAX_QUESTION_CHARS,
  EDIT_LAYERS, REMOVABLE_LAYERS, FALLBACK_WITH_SITE, FALLBACK_NO_SITE,
  askRequest, readRouting, readEdit, readQuestion, clipOption, clarifiedBrief, askUsage, routeMessage,
  siteDigest, normalizePagePath,
  readAlso, MAX_ALSO_CHARS, heldBack,
} from "../builder/site-ask.mjs";
import { MAX_INPUT_CHARS } from "../../../builder/input-budget.mjs";
import { CONVERSE_SYSTEM } from "../../../builder/site-converse.mjs";
// ⚠ `editBrowserReply`, the browser's own edit composer executed — the add
// composer answers a plausible "✅ Done." for an edit body.
import { editBrowserReply } from "../../../scripts/addon-sweep.mjs";

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };

const toolReply = (input, usage) => ({
  content: [{ type: "tool_use", name: "route_message", input }],
  usage: usage || { input_tokens: 900, output_tokens: 60 },
});

// ── the call ─────────────────────────────────────────────────────────────────

test("one call, forced to the tool, on the cheap model", () => {
  const r = askRequest({ message: "what pages do I have?", site: SITE });
  assert.equal(r.model, ASK_MODEL);
  // THE MODEL COMES FROM THE PICKER TABLE, NOT A LITERAL (2026-08-31). This
  // asserted /haiku/i until run 93 died on an Anthropic billing refusal with
  // the whole cheap ladder pinned to that one provider. What it was really
  // protecting is that this is a SMALL call rather than the design call, and
  // that property is asserted below by the tool, the forcing and the token
  // ceiling. What the model must be is the one the customer picked.
  assert.equal(ASK_MODEL, modelsFor().quick, "the router is pinned to a model instead of the picker's");
  // FORCED. Without tool_choice the model answers in prose and there is no field
  // to branch on — the point is a decision the code can read.
  assert.deepEqual(r.tool_choice, { type: "tool", name: "route_message" });
  assert.equal(r.tools.length, 1);
  assert.equal(r.tools[0].name, "route_message");
  assert.equal(r.max_tokens, ASK_MAX_TOKENS);
});

test("the message and the site both reach the model", () => {
  const r = askRequest({ message: "add a gallery", site: SITE });
  const sent = r.messages[0].content;
  assert.match(sent, /add a gallery/);
  assert.match(sent, /Sharp Fade/, "a question about their own site needs to know what it is");
  assert.match(sent, /services, bookings/);
});

test("an over-long message is cut before it is sent, not after", () => {
  const r = askRequest({ message: "x".repeat(MAX_MESSAGE * 3), site: SITE });
  assert.ok(r.messages[0].content.length < MAX_MESSAGE * 2,
    "an unbounded message is an unbounded bill on a public route");
});

test("a brand new project says so rather than describing nothing", () => {
  // "" would read to the model as a site with no pages AND no explanation, which
  // is the state most likely to produce an invented answer.
  assert.match(siteDigest(null), /new, empty project/);
  assert.match(siteDigest({}), /new, empty project/);
  assert.match(siteDigest({ pages: [] }), /new, empty project/);
});

test("the digest carries names and never contents", () => {
  // A `collect` table holds customer names and phone numbers. This call runs on
  // EVERY builder message; row data has no business in it.
  const d = siteDigest({ ...SITE, rows: [{ email: "ada@example.com" }] });
  assert.match(d, /bookings/);
  assert.ok(!/ada@example\.com/.test(d), "row data reached the routing call");
});

test("the digest names every page the site has, and still caps the table names", () => {
  // EVERY PAGE (2026-10-03, the owner: *"route decisions use complete,
  // authoritative page identities"*): the addresses were cut at 24, so a
  // site's 25th page could not be named by the router or the lane picker. A
  // page address is a few dozen characters and the list is the site's own;
  // table names keep a cap, 64 since router-b1 (2026-10-25).
  const many = Array.from({ length: 500 }, (_, i) => "/p" + i);
  const d = siteDigest({ name: "x".repeat(400), pages: many, tables: many });
  assert.ok(d.includes("/p25,") && d.includes("/p499."), "a page past the 24th was left out of the digest");
  const tables = d.slice(d.indexOf("Its database tables are: "));
  assert.ok(tables.includes("/p63") && !tables.includes("/p64"), "the table names are no longer capped at 64");
});

test("junk in the site object does not become junk in the prompt", () => {
  const d = siteDigest({ pages: [null, 42, "", "  ", "/real", {}], tables: [undefined, "orders"] });
  assert.match(d, /\/real/);
  assert.match(d, /orders/);
  assert.ok(!/\[object Object\]|null|undefined|42/.test(d), "non-strings leaked into the prompt: " + d);
});

// ── reading the answer ───────────────────────────────────────────────────────

test("a question comes back as a question, with its answer", () => {
  const r = readRouting(toolReply({ intent: "ask", answer: "You have two pages: the home page and a booking page." }));
  assert.equal(r.intent, "ask");
  assert.match(r.answer, /two pages/);
});

test("a build request comes back as build, and carries no answer", () => {
  const r = readRouting(toolReply({ intent: "build", answer: "I'll add that for you!" }));
  assert.equal(r.intent, "build");
  assert.equal(r.answer, "", "a build must not render a chat reply — the build reports itself");
});

test("EVERY unclear case resolves to build", () => {
  // The asymmetry, and the reason for it: a wrong "build" costs a build they can
  // see and undo. A wrong "ask" answers "add a booking form" with a paragraph and
  // silently does not build it, which is indistinguishable from being broken.
  for (const bad of [
    null, undefined, {}, { content: [] }, { content: null },
    toolReply({}), toolReply({ intent: "" }), toolReply({ intent: "ASK" }),
    toolReply({ intent: "question" }), toolReply({ intent: 1 }), toolReply({ intent: true }),
    { content: [{ type: "text", text: "sure, I'll do that" }] },
  ]) {
    assert.equal(readRouting(bad).intent, "build", "unclear input must fall through to build: " + JSON.stringify(bad));
  }

  // AND THE SAME UNCLEAR INTENTS *WITH AN ANSWER ATTACHED*, which is the case
  // that actually bites. Found by mutation: every case above happens to have an
  // empty `answer`, so the answerless-ask guard below caught them all and the
  // intent check itself was covered by nothing — inverting it to
  // `=== "build" ? "build" : "ask"` passed the entire suite. A model that
  // capitalises its enum value, or returns "question", would then have every
  // build request swallowed and answered with a paragraph.
  for (const intent of ["ASK", "Build", "question", "change", "", 1, true, null, {}, ["ask"]]) {
    const r = readRouting(toolReply({ intent, answer: "Sure — I can help with that." }));
    assert.equal(r.intent, "build", "an unrecognised intent with an answer must still build: " + JSON.stringify(intent));
    assert.equal(r.answer, "", "and must not render the answer it came with");
  }
  // Only the exact string opens the cheap path.
  assert.equal(readRouting(toolReply({ intent: "ask", answer: "Two pages." })).intent, "ask");
});

test("an 'ask' with nothing to say is a build", () => {
  // The model took the cheap branch and wrote no reply. Honouring it shows the
  // customer an empty message and does nothing — worse than an extra build.
  for (const empty of ["", "   ", null, undefined]) {
    const r = readRouting(toolReply({ intent: "ask", answer: empty }));
    assert.equal(r.intent, "build", "an answerless ask must not swallow the message");
  }
});

test("usage comes back in the four kinds the price table takes", () => {
  const u = askUsage(toolReply({ intent: "ask", answer: "hi" }, {
    input_tokens: 900, output_tokens: 60, cache_read_input_tokens: 500, cache_creation_input_tokens: 20,
  }));
  // FIVE FIELDS, and the fifth is the rate column. Derived from `ASK_MODEL`
  // rather than spelled out, so this asserts the usage names whatever model the
  // request sends — a literal here would keep passing after the two diverged,
  // which is the state that billed a Haiku call at Sonnet rates.
  assert.deepEqual(u, { in: 900, out: 60, cacheRead: 500, cacheWrite: 20, model: ASK_MODEL });
  assert.equal(askRequest({ message: "hi", site: SITE }).model, ASK_MODEL,
    "the price column and the request must name the same model");
  // A response with no usage block must read as zeros, never as NaN — NaN
  // propagates into pageCredits and comes out as a charge nobody can explain.
  assert.deepEqual(askUsage({}), { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model: ASK_MODEL });
  assert.deepEqual(askUsage(null), { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model: ASK_MODEL });
});

// ── the whole route ──────────────────────────────────────────────────────────

test("routeMessage answers a question and reports what it cost", async () => {
  const sent = [];
  const deps = { send: async (req) => { sent.push(req); return toolReply({ intent: "ask", answer: "Two pages." }); } };
  const r = await routeMessage(deps, { message: "how many pages?", site: SITE });
  assert.equal(r.intent, "ask");
  assert.equal(r.answer, "Two pages.");
  assert.equal(r.usage.in, 900);
  assert.equal(sent.length, 1, "ONE call — classify-and-answer, never classify then answer");
});

test("a model failure is a build, not an error the caller has to handle", async () => {
  // This sits in front of a path that already works. The worst thing it can do
  // is stop that path running, so a failure must fall through rather than 500.
  const deps = { send: async () => { throw new Error("upstream 529"); } };
  const r = await routeMessage(deps, { message: "add a gallery", site: SITE });
  assert.equal(r.intent, "build");
  assert.equal(r.failed, true);
  assert.equal(r.usage, null, "a call that failed must not be billable");
});

test("an empty message never reaches the model", async () => {
  let called = 0;
  const deps = { send: async () => { called++; return toolReply({ intent: "ask", answer: "hi" }); } };
  for (const nothing of ["", "   ", null, undefined]) {
    const r = await routeMessage(deps, { message: nothing, site: SITE });
    assert.equal(r.intent, "build");
    assert.equal(r.usage, null);
  }
  assert.equal(called, 0, "a paid call behind a public route must not fire on an empty body");
});

// ── the guards that stop this rotting ────────────────────────────────────────

test("the enum and the reader agree, and every declared value is reachable", () => {
  // DERIVED AT BOTH ENDS. An intent added to the schema and not to the reader is
  // silently coerced to "build" — the schema advertises a branch that does not
  // exist, and nothing anywhere fails. That is the shape this repo has recorded
  // six times over, so the check runs in BOTH directions rather than pinning a
  // list somebody has to remember to update.
  const declared = ASK_TOOL.input_schema.properties.intent.enum;
  assert.deepEqual([...declared].sort(), ["addon", "ask", "build", "clarify", "edit"]);

  // Every declared value produces itself when the caller allows it. A well-formed
  // payload is built per intent, because each branch needs a different field AND a
  // different caller state — an intent starved of either falls through to the
  // fallback for the WRONG reason, which would let a genuinely unreachable intent
  // pass this test. `edit` and `addon` are gated on `hasSite`, so a fixture that
  // forgot it would report them unreachable when they are merely not offered.
  const wellFormed = {
    build: [{}, {}],
    ask: [{ answer: "Two pages." }, {}],
    clarify: [{ question: { text: "Do customers book?", options: ["Yes", "No"] } }, { canClarify: true }],
    edit: [{ layer: "text" }, { hasSite: true }],
    addon: [{}, { hasSite: true }],
  };
  for (const v of declared) {
    assert.ok(Object.hasOwn(wellFormed, v), "a new intent was declared and this guard was not taught its shape: " + v);
    const [input, opts] = wellFormed[v];
    const r = readRouting(toolReply({ intent: v, ...input }), opts);
    assert.equal(r.intent, v, "declared intent " + v + " is unreachable through the reader");
  }
});

test("the router writes only a reply's gist, and its ceiling stays a routing call's", () => {
  // REWRITTEN 2026-10-14 (the owner: *"Remove the rigid 1–3-sentence/no-Markdown
  // restriction … Give conversational answers an appropriate output budget
  // without blindly increasing every routing call."*). The reply they read is
  // written by its own call (`builder/site-converse.mjs`); the router's `answer`
  // is its gist, so the routing ceiling did not have to grow for it.
  const d = ASK_TOOL.input_schema.properties.answer.description;
  assert.match(d, /gist/, "the router is writing the whole reply again");
  assert.match(d, /written separately/, "nothing says the reply they read is written elsewhere");
  assert.doesNotMatch(d, /one to three sentences|no markdown/i, "the old reply rules are back on the router");
  assert.ok(ASK_MAX_TOKENS <= 1000, "the routing call's ceiling has drifted upward: " + ASK_MAX_TOKENS);
});

// ── wiring: the layers this feature has to be alive at ───────────────────────

const worker = () => fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const chat = () => fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

// A named declaration's body, closed on the NEXT top-level declaration whatever
// it is called (2026-09-13). Lifted out of `routeBlock` below, which had already
// been re-anchored this way once, because two windows in this file closed on
// `"function buildActiveText("` — a literal that names a NEIGHBOUR — and that
// neighbour was deleted with the pre-React activity log. A missing END landmark
// is a window that swallows the file; here the guards had an alive check and
// failed loudly rather than quietly, which is the only reason this was a red run
// and not a silent one. Deriving the end is what stops the next neighbour's
// departure being either.
const declBlock = (src, from) => {
  const i = src.indexOf(from);
  const re = /\n(?:async )?function |\nconst |\nlet /g;
  re.lastIndex = i + 1;
  const m = re.exec(src);
  const end = m ? m.index : -1;
  assert.ok(i > 0 && end > i, from + " moved — this guard now checks nothing");
  return src.slice(i, end);
};

// The router's own body, to its closing brace rather than to a byte count.
const routeBlock = () => {
  const src = chat();
  const i = src.indexOf("function siteRoute(");
  // THE CLOSING LANDMARK IS THE NEXT TOP-LEVEL DECLARATION, not a named
  // comment hundreds of lines on. It was `// What to say when a build could
  // not run.`, which sits past siteEdit, the watcher and the resume — so the
  // window swallowed every function between them, and stage 2b's resumed
  // tail (one more `s.msgs.push`, in `resumeOpenSite`) read as siteRoute
  // pushing a third message. The recorded overlapping-window trap; the end
  // is derived from the real neighbour now, whatever its name.
  const re = /\n(?:async )?function |\nconst |\nlet /g;
  re.lastIndex = i + 1;
  const m = re.exec(src);
  const end = m ? m.index : -1;
  assert.ok(i > 0 && end > i, "siteRoute moved; this guard checks nothing");
  return src.slice(i, end);
};

// ── the builder asking THEM (2026-08-08) ─────────────────────────────────────
//
// A third intent, and the risk it carries is the mirror of the one `readRouting`
// was written around. That rule — every unclear case builds — exists because a
// wrong "ask" answers "add a booking form" with a paragraph and silently does
// not build. A wrong "clarify" is worse: it stops in front of a brief that was
// already good enough, on the ONE path where somebody is waiting to see whether
// this product works at all. So every guard below is about the same thing:
// nothing here may become a reason a build does not happen.

test("a question the interface can render, and every shape it cannot", () => {
  const ok = readQuestion({ text: "Do customers book online?", options: ["Book a slot", "Enquire", "Neither"] });
  assert.deepEqual(ok, { text: "Do customers book online?", options: ["Book a slot", "Enquire", "Neither"] });

  // ONE OPTION IS NOT A CHOICE, and a question with nothing to click is a dead
  // end the customer cannot get past — worse than never asking.
  assert.equal(readQuestion({ text: "x", options: ["only"] }), null);
  assert.equal(readQuestion({ text: "x", options: [] }), null);
  assert.equal(readQuestion({ text: "x" }), null);
  // No question to ask.
  assert.equal(readQuestion({ options: ["a", "b"] }), null);
  assert.equal(readQuestion({ text: "   ", options: ["a", "b"] }), null);
  // Not an object at all.
  for (const junk of [null, undefined, "a question?", 7, ["a", "b"]]) {
    assert.equal(readQuestion(junk), null, JSON.stringify(junk));
  }
});

test("options are cleaned, and the count is checked AFTER the cleaning", () => {
  // Deduped case-insensitively and after trimming: "Book online" twice is one
  // choice wearing two buttons.
  assert.deepEqual(readQuestion({ text: "x", options: ["Book", " book ", "BOOK", "Call"] }).options,
    ["Book", "Call"]);
  // AND THAT IS WHY THE COUNT IS CHECKED LAST. Four options that dedupe to one
  // is a question with a single button on it — the check has to run on what will
  // actually be rendered, not on what arrived.
  assert.equal(readQuestion({ text: "x", options: ["Yes", "yes", "YES", " yes"] }), null);
  // A STRING, not anything stringifiable: String(["a","b"]) is "a,b", which
  // renders as one button offering two different answers.
  assert.deepEqual(readQuestion({ text: "x", options: [["a", "b"], "c", "d"] }).options, ["c", "d"]);
  assert.deepEqual(readQuestion({ text: "x", options: [null, 7, {}, "c", "d"] }).options, ["c", "d"]);
  // Empty and whitespace-only options are dropped rather than rendered blank.
  assert.deepEqual(readQuestion({ text: "x", options: ["", "  ", "c", "d"] }).options, ["c", "d"]);
  // Capped at four, and each capped in length — a paragraph does not fit a button.
  assert.equal(readQuestion({ text: "x", options: ["a", "b", "c", "d", "e", "f"] }).options.length, MAX_OPTIONS);
  const long = readQuestion({ text: "x", options: ["y".repeat(500), "b"] });
  assert.equal(long.options[0].length, MAX_OPTION_CHARS);
  // Newlines collapse — an option is one line on one button.
  assert.equal(readQuestion({ text: "x", options: ["two\n\nlines", "b"] }).options[0], "two lines");
});

test("clarify is the CALLER's to allow, never the model's to take", () => {
  const q = { text: "Do customers book?", options: ["Yes", "No"] };
  const reply = toolReply({ intent: "clarify", question: q });
  // Allowed: honoured.
  assert.equal(readRouting(reply, { canClarify: true }).intent, "clarify");
  assert.deepEqual(readRouting(reply, { canClarify: true }).question, q);
  // NOT allowed: overruled into a build, not an error and not an empty reply.
  // This is what stops a revise being interviewed about its own colour scheme,
  // and what makes the question budget a real ceiling rather than a request.
  assert.equal(readRouting(reply, { canClarify: false }).intent, "build");
  assert.equal(readRouting(reply).intent, "build", "the default must be closed");
});

test("a clarify with no usable question is a BUILD", () => {
  // Same rule as an answerless "ask", for the same reason: honouring it shows an
  // empty prompt and builds nothing, which the customer cannot tell apart from
  // the builder being broken.
  for (const bad of [
    { intent: "clarify" },
    { intent: "clarify", question: {} },
    { intent: "clarify", question: { text: "x" } },
    { intent: "clarify", question: { text: "x", options: ["one"] } },
    { intent: "clarify", question: { text: "", options: ["a", "b"] } },
    { intent: "clarify", question: "a question?" },
  ]) {
    const r = readRouting(toolReply(bad), { canClarify: true });
    assert.equal(r.intent, "build", JSON.stringify(bad));
    assert.equal(r.question, undefined);
  }
});

test("the question budget is spent in arithmetic, before the model is asked", async () => {
  const sent = [];
  const deps = { send: async (req) => { sent.push(req); return toolReply({ intent: "clarify", question: { text: "q?", options: ["a", "b"] } }); } };
  const qa = (n) => Array.from({ length: n }, (_, i) => ({ q: "q" + i, a: "a" + i }));

  // A first build with room: allowed.
  assert.equal((await routeMessage(deps, { message: "a cafe", firstBuild: true, brief: "a cafe", qa: [] })).intent, "clarify");
  assert.equal((await routeMessage(deps, { message: "x", firstBuild: true, brief: "a cafe", qa: qa(MAX_CLARIFY - 1) })).intent, "clarify");

  // AT the cap: refused, even though the model said clarify. `MAX_CLARIFY` is a
  // number here, not a sentence in a schema description — "have you got another
  // question?" is a thing a model says yes to.
  assert.equal((await routeMessage(deps, { message: "x", firstBuild: true, brief: "a cafe", qa: qa(MAX_CLARIFY) })).intent, "build");
  assert.equal((await routeMessage(deps, { message: "x", firstBuild: true, brief: "a cafe", qa: qa(MAX_CLARIFY + 5) })).intent, "build");

  // NEVER on a revise, whatever the model says and whatever the qa claims.
  assert.equal((await routeMessage(deps, { message: "make it blue", firstBuild: false, qa: [] })).intent, "build");
  assert.equal((await routeMessage(deps, { message: "make it blue", qa: [] })).intent, "build", "the default is closed");
  // Only a real boolean opens it — `firstBuild: "yes"` is not a first build.
  assert.equal((await routeMessage(deps, { message: "x", firstBuild: "yes", qa: [] })).intent, "clarify",
    "routeMessage coerces; the ROUTE is what requires === true");

  // Half-written pairs do not count against the budget: a pair with no answer is
  // a question that was asked and never answered, which must not silently spend
  // one of the three.
  const halves = [{ q: "q", a: "" }, { q: "", a: "a" }, null, "x"];
  assert.equal((await routeMessage(deps, { message: "x", firstBuild: true, qa: halves })).intent, "clarify");
});

test("the request tells the model where it is in the round", () => {
  const first = askRequest({ message: "a cafe", canClarify: true, brief: "a cafe", qa: [] });
  const body = String(first.messages[0].content);
  assert.match(body, /FIRST build/, "the model is not told questions are open");
  assert.match(body, /3 questions left/, "the remaining budget is not stated");
  assert.match(body, /THE BRIEF THEY STARTED WITH\na cafe/, "the original brief is not carried");

  // WHAT HAS ALREADY BEEN ASKED, or one question at a time becomes the same
  // question three times.
  const second = String(askRequest({
    message: "Book a slot", canClarify: true, brief: "a barber shop",
    qa: [{ q: "Do customers book?", a: "Book a slot" }],
  }).messages[0].content);
  assert.match(second, /already asked/i);
  assert.match(second, /Do customers book\? -> Book a slot/);
  assert.match(second, /2 questions left/);
  // Singular reads as English at one, because "1 questions left" in a prompt is
  // the kind of sloppiness a model mirrors back into its own writing.
  assert.match(String(askRequest({ message: "x", canClarify: true, qa: [{ q: "a", a: "b" }, { q: "c", a: "d" }] }).messages[0].content),
    /1 question left/);

  // A REVISE IS TOLD PLAINLY, not left to infer it from an absent section — and
  // it is never handed the round's state.
  const closed = String(askRequest({ message: "make it blue", canClarify: false, brief: "secret brief", qa: [{ q: "a", a: "b" }] }).messages[0].content);
  assert.match(closed, /Questions are closed/);
  assert.ok(!closed.includes("secret brief"));
  assert.ok(!/already asked/i.test(closed));
});

test("THE CLOSED-QUESTIONS BLOCK NAMES NO WORK INTENT — one enumeration, not two", () => {
  // The 2026-08-14 audit: this sentence read `answer "build" or "ask" only` —
  // written when those were the only intents, never updated for the escalation
  // ladder — so every message about a LIVE site carried two contradictory
  // instructions, and the stale one pointed at the ~25-credit rebuild. The
  // state block is the ONE place legal answers are enumerated; the closed
  // block owns exactly one fact, that clarify is over. Derived over the
  // tool's own intent enum, so a sixth intent added later is covered too.
  const live = String(askRequest({ message: "make it blue", canClarify: false, hasSite: true,
    site: { slug: "s", pages: ["/"], tables: ["bookings"] } }).messages[0].content);
  const at = live.indexOf("Questions are closed");
  assert.ok(at > 0, "the closed sentence is gone — rescope this");
  const msgAt = live.indexOf("THEIR MESSAGE", at);
  assert.ok(msgAt > at, "the message section moved — rescope this");
  const closedBlock = live.slice(at, msgAt);
  for (const intent of ASK_TOOL.input_schema.properties.intent.enum) {
    if (intent === "clarify") continue;
    assert.equal(closedBlock.includes('"' + intent + '"'), false,
      "the closed block enumerates work intents again — it said \"" + intent + "\", " +
      "and a second list is what went stale last time");
  }
  assert.match(closedBlock, /never answer "clarify"/, "the one fact this block owns is missing");
  // And the state block still forbids the rebuild on a live site, unshadowed.
  assert.match(live, /never "build"/, "the live-site state block lost its never-build rule");
});

test("the answers are folded back into the ORIGINAL brief", () => {
  // THE FAILURE THIS PREVENTS. The composer sends the message just typed, and
  // after a round that message is "Book a time slot" — so building on it makes a
  // site about booking a time slot and loses "a barber shop in Leeds" entirely.
  const out = clarifiedBrief("a barber shop in Leeds", [
    { q: "Do customers book?", a: "Book a time slot" },
    { q: "How should it feel?", a: "Quiet and classic" },
  ]);
  assert.match(out, /^a barber shop in Leeds/, "the brief is no longer first, or no longer there");
  assert.match(out, /Do customers book\? Book a time slot/);
  assert.match(out, /How should it feel\? Quiet and classic/);

  // A NO-OP WHEN NOTHING WAS ASKED, which is every revise and every build that
  // went straight through — so this changes no request that did not use it.
  assert.equal(clarifiedBrief("a cafe", []), "a cafe");
  assert.equal(clarifiedBrief("a cafe", null), "a cafe");
  assert.equal(clarifiedBrief("a cafe", undefined), "a cafe");
  assert.equal(clarifiedBrief("a cafe", "nonsense"), "a cafe");
  assert.equal(clarifiedBrief("  a cafe  ", [{ q: "", a: "" }]), "a cafe");
  // Half-written pairs are dropped rather than rendered as a dangling question.
  assert.equal(clarifiedBrief("a cafe", [{ q: "why?", a: "" }, { q: "", a: "yes" }]), "a cafe");
  // EVERY ANSWER IS KEPT SINCE 2026-10-08 (the parallel-tasks batch): the
  // designer can ask after the router's MAX_CLARIFY, and a count dropped
  // decisions the customer made. The SIZE is held where it always was — the
  // route refuses a brief and answers past what one request may carry
  // (`input-budget.mjs`) before any model call.
  const many = clarifiedBrief("a cafe", Array.from({ length: 40 }, (_, i) => ({ q: "q" + i, a: "a" + i })));
  assert.equal(many.split("\n").filter((l) => l.startsWith("- ")).length, 40);
  assert.ok(MAX_CLARIFY < 40, "OBSERVER: the count is past the asking budget");
});

test("a first build asks only when the answer changes the build — with a floor", () => {
  // THE POLICY CHANGED (owner's call 2026-08-10: "they gotta be smart with the
  // questions, not all the time"), and this test is rewritten rather than
  // deleted because what it was protecting is still live.
  //
  // It used to pin "a first build begins with a question, every time". That
  // wording exists because the version BEFORE it was measured live and the
  // feature came out dead: "ask if you genuinely need to", three separate
  // otherwise-build clauses and "When in doubt, build" produced `build` for "a
  // website for my business", which is as thin as a brief gets. Softening in
  // that direction has failed once already.
  //
  // So the new policy is not "ask if you feel like it". It is a NAMED test with
  // a HARD FLOOR under it: ask when the answer changes what gets built, and
  // always ask when the trade is unknown — which is exactly the brief that
  // defeated the last attempt. Both halves are asserted, because the floor is
  // the only thing standing between "be smart" and "never ask", and the
  // discouraging tiebreak that killed it must stay gone.
  const sys = askRequest({ message: "a cafe", canClarify: true, brief: "a cafe" }).system[0].text;
  assert.match(sys, /ONLY IF THE ANSWER WOULD CHANGE WHAT YOU BUILD/,
    "the question is unconditional again — a good brief gets interrogated anyway");
  assert.match(sys, /IF THE BRIEF DOES NOT SAY WHAT THE BUSINESS ACTUALLY IS, YOU MUST ASK/,
    "the floor is gone: 'a website for my business' will build a site out of a guess, which is the measured failure");
  assert.match(sys, /a website for my business/,
    "the worked example went with it — the rule is abstract again");
  assert.ok(!/when in doubt,?\s*build/i.test(sys),
    "the prompt tells the model to prefer building — this is the exact line that made clarify dead");
  // A UNIT TEST CANNOT PROVE A PROMPT PRODUCES A BEHAVIOUR. Only a live probe
  // can, and that is what caught the last regression. Two briefs settle it after
  // a deploy: "a website for my business" must ask, and a brief naming the trade
  // AND what visitors do must build.

  // AN ORDERED DECISION, not three competing paragraphs. The first attempt at
  // strengthening clarify made it beat the greeting rule: "hey" came back as a
  // multiple-choice form. Both rules were present and correct; nothing said
  // which one wins, so the louder one did.
  assert.match(sys, /DECIDE IN THIS ORDER/, "the decision is unordered again — the loudest rule will win");
  const greeting = sys.indexOf("greeting");
  const clarify = sys.search(/"clarify"/);
  assert.ok(greeting > 0 && clarify > 0, "one of the two branches is gone");
  assert.ok(greeting < clarify, "clarify is stated before the greeting exception and will swallow it");

  // TALKS LIKE A PERSON, which is the whole point of putting a conversation in
  // front of a build rather than a wizard.
  // MOVED 2026-10-14 to the reply's own call, which writes what they read; the
  // router is told conversation is not work instead.
  // RESTATED 2026-10-15 (the conversation batch): warm by being useful, not excited.
  assert.match(CONVERSE_SYSTEM, /warm, plain and direct/, "the tone instruction is gone");
  assert.match(sys, /CONVERSATION IS NOT WORK/, "the router is no longer told conversation is not work");
  const q = ASK_TOOL.input_schema.properties.question.properties.text.description;
  assert.match(q, /TWO SHORT SENTENCES/, "the question went back to a bare one-liner");
  assert.match(q, /pick up what they just told you/i,
    "nothing tells it to acknowledge the brief before asking");

  // And the round text carries the same test the system block does. It used to
  // read "ask ONE question about it rather than building", which is the
  // unconditional form — the two blocks would then disagree about whether a good
  // brief still gets interrogated, and the model would be picking between them.
  const round = String(askRequest({ message: "a cafe", canClarify: true, brief: "a cafe" }).messages[0].content);
  assert.match(round, /only if its answer changes what you would build/i,
    "the round text still tells the model to ask unconditionally, against the system block");
  assert.match(round, /questions? left/,
    "the remaining budget is gone from the round text");

  // The greeting exception has to survive, or a first build interrogates
  // somebody who typed "hey" — measured working, and easy to lose while
  // strengthening the clause above it.
  assert.match(sys, /"hey"/, "the greeting examples are gone");
  assert.match(sys, /has not told you anything yet/i, "nothing tells the model a greeting is not a brief");
  assert.match(sys, /NEVER open with a question of your own here/,
    "a greeting can be met with a multiple-choice form again");

  // A REVISE IS UNTOUCHED by all of this. The strengthened wording lives in the
  // system block, which a revise also sees, so the closed-questions line is what
  // keeps it from applying — assert the two together or one can be lost.
  const closed = String(askRequest({ message: "make it blue", canClarify: false }).messages[0].content);
  assert.match(closed, /Questions are closed/);
  assert.ok(!/ask ONE question/.test(closed));
});

test("an option too long for a button is cut at a word, never mid-word", () => {
  // MEASURED LIVE. The model answered with "Tell me what you do and I'll ask
  // what people should be able to do" and the blunt slice rendered it as
  // "...and I'll ask what people sho" — a button ending in a fragment, which
  // reads as the interface being broken rather than as the model having written
  // the wrong thing.
  const long = "Tell me what you do and I'll ask what people should be able to do";
  const clipped = clipOption(long);
  assert.ok(clipped.length <= MAX_OPTION_CHARS);
  assert.ok(!clipped.endsWith(" "), "a trailing space on a button label");
  assert.ok(long.startsWith(clipped), "the clip changed the words rather than shortening them");
  // The last word is whole — that is the entire point.
  const lastWord = clipped.split(" ").pop();
  assert.ok(long.split(" ").includes(lastWord), "clipped mid-word: " + JSON.stringify(clipped));

  // Short enough already: untouched apart from whitespace tidying.
  assert.equal(clipOption("  Book a  time slot "), "Book a time slot");
  assert.equal(clipOption("Book a time slot"), "Book a time slot");
  // A single word longer than the cap has no boundary to honour — cut it rather
  // than throwing the whole option away.
  const oneWord = "x".repeat(120);
  assert.equal(clipOption(oneWord).length, MAX_OPTION_CHARS);
  // An early space must not leave a stub: "Yes " + a very long word keeps more
  // than the first three characters.
  assert.ok(clipOption("Yes " + "y".repeat(120)).length >= MAX_OPTION_CHARS * 0.5);
  // Junk in, empty out — the caller drops empties.
  for (const junk of [null, undefined, "", "   "]) assert.equal(clipOption(junk), "");
});

// ── the two bugs a live round shipped on 2026-08-09 ─────────────────────────

test("a question is never cut mid-word", () => {
  // WHAT THE CUSTOMER SAW: "…welcoming and community-focused, or hardcore and
  // inte". A bare `.slice(0, 240)` on the one message whose whole job is to
  // read like a person talking.
  const long = "So visitors can book without signing in, but members can log in to see their bookings and "
    + "history. Got it — one last thing before we build it. What's the vibe you want? Sleek and modern, "
    + "welcoming and community-focused, or hardcore and intense for the serious lifters.";
  const q = readQuestion({ text: long, options: ["Sleek", "Welcoming", "Hardcore"] });
  assert.ok(q, "a long question must still be a question");
  assert.ok(q.text.length <= MAX_QUESTION_CHARS + 1, q.text.length);
  assert.ok(q.text.endsWith("…"), "a clipped sentence must trail off, not simply stop: " + q.text.slice(-24));
  // The property that failed: the last word is whole.
  const words = q.text.replace(/…$/, "").trim().split(" ");
  assert.ok(long.includes(words[words.length - 1] + " ") || long.endsWith(words[words.length - 1]),
    "the question was cut mid-word: ends " + JSON.stringify(words[words.length - 1]));
  // A short one is untouched, or every question would gain an ellipsis.
  assert.equal(readQuestion({ text: "Who books?", options: ["A", "B"] }).text, "Who books?");
});

test("an answer PICKED from our own options is never answered with prose", () => {
  // MEASURED LIVE: two questions answered, third button press, and the reply was
  // "I'm not sure what you'd like me to build. Tell me about your business." —
  // to somebody who had just told us three times, using our own buttons.
  // NARROWED 2026-10-14 to a picked answer: a TYPED reply may be a side
  // question, which stays conversation (the owner's batch).
  const askReply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "I'm not sure what you'd like me to build." } }] };
  assert.equal(readRouting(askReply, { picked: true }).intent, "build",
    "an ask in reply to a pressed answer is a dead end");
  assert.equal(readRouting(askReply, { picked: true }).answer, "",
    "the prose must not be shown as though it were a reply");
  // …a typed reply that is a side question is answered, and outside a round it
  // is a perfectly good answer.
  assert.equal(readRouting(askReply, { answering: true }).intent, "ask");
  assert.equal(readRouting(askReply, { picked: false }).intent, "ask");
  assert.equal(readRouting(askReply, {}).intent, "ask");
});

test("answering does not close off another question", () => {
  // The round must still be able to continue — `answering` bounds `ask`, not
  // `clarify`. Collapsing the two would make every answer start the build and
  // silently cap the interview at one question.
  const q = { text: "What's the vibe?", options: ["Sleek", "Warm"] };
  const clarifyReply = { content: [{ type: "tool_use", input: { intent: "clarify", question: q } }] };
  assert.equal(readRouting(clarifyReply, { canClarify: true, answering: true }).intent, "clarify");
});

test("routeMessage passes `picked` through to the reader, and a typed reply stays conversation", async () => {
  // The flag is read in `readRouting`, so a `routeMessage` that forgets to hand
  // it over leaves the bug exactly where it was with every unit test green.
  const reply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "hmm" } }] };
  const r = await routeMessage({ send: async () => reply },
    { message: "Sleek and modern", site: {}, firstBuild: true, brief: "Book classes", answering: true, picked: true, qa: [] });
  assert.equal(r.intent, "build", "`picked` did not reach readRouting");
  let sent = null;
  const typed = await routeMessage({ send: async (q) => { sent = q; return reply; } },
    { message: "wait, can you take payments?", site: {}, firstBuild: true, brief: "Book classes", answering: true, qa: [{ q: "Who books?", a: "wait, can you take payments?" }] });
  assert.equal(typed.intent, "ask", "a typed side question during a round was turned into work");
  assert.match(String(sent.messages[0].content), /TYPED REPLY WHILE YOUR LAST QUESTION IS ON SCREEN/,
    "the router is not told a typed reply may be a side question");
});

test("an attachment no longer closes off conversation, nor the question", () => {
  // REVERSED 2026-10-14 (the owner: *"attachment discussion … must remain
  // conversation; don't turn them into work merely because attached … is
  // true"*). A file with "what do you think of this logo?" is talk, and the
  // router decides; it must still not bound `clarify`.
  const askReply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "Nice logo!" } }] };
  assert.equal(readRouting(askReply, { attached: true }).intent, "ask",
    "a message with a file attached was turned into work by the flag alone");
  assert.equal(readRouting(askReply, { attached: false }).intent, "ask");

  const q = { text: "What do people do on it?", options: ["Book a slot", "Send an enquiry"] };
  const clarifyReply = { content: [{ type: "tool_use", input: { intent: "clarify", question: q } }] };
  assert.equal(readRouting(clarifyReply, { canClarify: true, attached: true }).intent, "clarify",
    "an attachment must not suppress the first-build question");
});

test("routeMessage leaves an attached message's conversation to the router", () => {
  const reply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "hmm" } }] };
  return routeMessage({ send: async () => reply },
    { message: "what do you think of this logo?", site: {}, firstBuild: true, brief: "a barber shop", attached: true, qa: [] })
    .then((r) => assert.equal(r.intent, "ask", "`attached` turned conversation into work"));
});

// ── the escalation ladder: edit → addon → build ───────────────────────────────
//
// The rule this whole section defends is that being wrong DOWN the ladder is
// recoverable and being wrong UP it is not. A cheap answer that cannot do the
// job hands off to the next rung; an expensive answer nobody asked for has
// already rewritten a customer's pages by the time anyone notices.

test("with a site, the fallback is addon; with none it is still build", () => {
  // THE OLD RULE WAS "every unclear case builds" and on an existing site that
  // meant a ~25-credit rewrite of every page, triggered by a model that failed
  // to answer cleanly. Unclear still resolves to WORK — that half is unchanged
  // and is what stops a build request being swallowed by a paragraph.
  const junk = [
    { intent: "nonsense" },
    { intent: "" },
    { intent: 7 },
    {},
    { intent: ["edit"] },
  ];
  for (const input of junk) {
    assert.equal(readRouting(toolReply(input), { hasSite: true }).intent, "addon",
      "on an existing site an undecided router must take the cheap recoverable rung: " + JSON.stringify(input));
    assert.equal(readRouting(toolReply(input), { hasSite: false }).intent, "build",
      "with no site there is nothing to add to: " + JSON.stringify(input));
  }
  assert.equal(FALLBACK_WITH_SITE, "addon");
  assert.equal(FALLBACK_NO_SITE, "build");
});

test("edit and addon are unreachable until a site exists", () => {
  // Not a policy — a lane with no input. An "edit" on an empty project has
  // nothing to locate, so honouring it would report success having done nothing.
  for (const intent of ["edit", "addon"]) {
    const r = readRouting(toolReply({ intent, layer: "text" }), { hasSite: false });
    assert.equal(r.intent, "build", intent + " must not be routable before there is a site");
  }
});

test("a build on an EXISTING site is still honoured, narrowly", () => {
  // "Scrap this and make me a different site" is a real request. The tool
  // description is what keeps it rare; the reader must not make it impossible.
  const r = readRouting(toolReply({ intent: "build" }), { hasSite: true });
  assert.equal(r.intent, "build");
});

test("every edit layer survives the reader, and an unknown one goes UP", () => {
  for (const layer of EDIT_LAYERS) {
    const input = layer === "page" ? { intent: "edit", layer, page: "/book" } : { intent: "edit", layer };
    const r = readRouting(toolReply(input), { hasSite: true, pages: SITE.pages });
    assert.equal(r.intent, "edit", "declared layer " + layer + " is unreachable");
    assert.equal(r.layer, layer);
  }
  for (const layer of [undefined, "", "colours", "TEXT", 3, ["text"]]) {
    const r = readRouting(toolReply({ intent: "edit", layer }), { hasSite: true, pages: SITE.pages });
    assert.equal(r.intent, "addon",
      "an edit whose layer nobody recognises is an undecided router, and must escalate: " + JSON.stringify(layer));
  }
});

test("a page edit naming a page the site does not have IS an addon", () => {
  // The useful half of the ladder, and it costs nothing: "change the gallery
  // page" on a site with no gallery is not a broken edit, it is somebody asking
  // for a gallery.
  const r = readRouting(toolReply({ intent: "edit", layer: "page", page: "/gallery" }),
    { hasSite: true, pages: SITE.pages });
  assert.equal(r.intent, "addon");

  const ok = readRouting(toolReply({ intent: "edit", layer: "page", page: "/book" }),
    { hasSite: true, pages: SITE.pages });
  assert.equal(ok.intent, "edit");
  assert.equal(ok.page, "/book");
});

test("a page edit with no page named escalates rather than guessing the home page", () => {
  for (const page of [undefined, "", "   ", null, 5]) {
    const r = readRouting(toolReply({ intent: "edit", layer: "page", page }), { hasSite: true, pages: SITE.pages });
    assert.equal(r.intent, "addon", "no page named must escalate, not default to '/': " + JSON.stringify(page));
  }
});

test("NOT KNOWING BUYS NOTHING: with no page list, a page edit passes through", () => {
  // An older caller, or a digest that carried no pages. Inventing a refusal out
  // of evidence we do not have would send every page edit on those sites to a
  // lane that tries to ADD a page they already have.
  const r = readRouting(toolReply({ intent: "edit", layer: "page", page: "/menu" }), { hasSite: true, pages: [] });
  assert.equal(r.intent, "edit");
  assert.equal(r.page, "/menu");
});

test("a page path is normalised before it is compared", () => {
  // The model copies these out of a list we wrote and still returns "menu",
  // "/menu/" and "/Menu". None is a different page, and all three would fail an
  // equality check and escalate an ordinary edit into an attempted duplicate.
  assert.equal(normalizePagePath("menu"), "/menu");
  assert.equal(normalizePagePath("/menu/"), "/menu");
  assert.equal(normalizePagePath("/Menu"), "/menu");
  assert.equal(normalizePagePath("  /book  "), "/book");
  assert.equal(normalizePagePath("/book?x=1"), "/book");
  assert.equal(normalizePagePath("/"), "/");
  assert.equal(normalizePagePath(""), "");
  assert.equal(normalizePagePath(null), "");
  for (const raw of ["menu", "/menu/", "/MENU"]) {
    assert.equal(readEdit({ layer: "page", page: raw }, ["/", "/menu"]).intent, "edit",
      "a page written as " + raw + " should still match /menu");
  }
});

test("the model is TOLD which case it is in, in words", () => {
  // The digest describes the site; this is an instruction about the decision.
  // A model asked to derive the second from the first gets it wrong occasionally
  // — on the one call where wrong means a site rebuilt over a colour change.
  const withSite = askRequest({ message: "make it blue", site: SITE, hasSite: true }).messages[0].content;
  assert.match(withSite, /THE SITE ALREADY EXISTS/);
  assert.match(withSite, /never "build"/i);

  const without = askRequest({ message: "a barber shop", site: null, hasSite: false }).messages[0].content;
  assert.match(without, /THERE IS NO SITE YET/);
  assert.match(without, /never "edit" or "addon"/i);
});

test("a router that throws takes the cheap rung, not the expensive one", async () => {
  // An unreachable Haiku call used to mean the customer paid ~25 credits and had
  // every page rewritten because a routing request timed out.
  const boom = { send: async () => { throw new Error("upstream"); } };
  const withSite = await routeMessage(boom, { message: "make it blue", site: SITE, hasSite: true });
  assert.equal(withSite.intent, "addon");
  assert.equal(withSite.failed, true);
  assert.equal(withSite.usage, null, "a call that failed bills nothing");

  const without = await routeMessage(boom, { message: "a barber shop", hasSite: false });
  assert.equal(without.intent, "build");
});

test("routeMessage passes the site's own pages to the reader", async () => {
  // The wiring between the digest and the page check. Without it every page edit
  // on every site escalates, and nothing anywhere fails.
  let sent = null;
  const deps = { send: async (req) => { sent = req; return toolReply({ intent: "edit", layer: "page", page: "/book" }); } };
  const r = await routeMessage(deps, { message: "move the form up", site: SITE, hasSite: true });
  assert.equal(r.intent, "edit", "a page the site really has must not escalate");
  assert.equal(r.page, "/book");
  assert.match(sent.messages[0].content, /\/book/, "the model was never shown the pages it must choose from");

  const miss = { send: async () => toolReply({ intent: "edit", layer: "page", page: "/gallery" }) };
  assert.equal((await routeMessage(miss, { message: "x", site: SITE, hasSite: true })).intent, "addon");
});

test("an answerless ask on an existing site becomes addon, not a rebuild", async () => {
  // The existing doctrine — an "ask" with nothing to say is work — with the
  // ladder applied. Before this it cost a full revise.
  const r = readRouting(toolReply({ intent: "ask", answer: "   " }), { hasSite: true });
  assert.equal(r.intent, "addon");
  const bounded = readRouting(toolReply({ intent: "ask", answer: "Sure!" }), { hasSite: true, picked: true });
  assert.equal(bounded.intent, "addon");
  // A file no longer makes conversation work (2026-10-14).
  const attached = readRouting(toolReply({ intent: "ask", answer: "Sure!" }), { hasSite: true, attached: true });
  assert.equal(attached.intent, "ask");
});

test("a real question on an existing site is still answered", () => {
  // The ladder must not eat the ask path. This is the failure the router exists
  // to prevent, pointed the other way.
  const r = readRouting(toolReply({ intent: "ask", answer: "You have two pages." }), { hasSite: true });
  assert.equal(r.intent, "ask");
  assert.equal(r.answer, "You have two pages.");
});

// ── the router decides a deletion ────────────────────────────────────────────
//
// THREE ATTEMPTS AT PERSUASION FAILED. Asked to delete a page, the pages model
// rewrites the site and never sets the field that deletes one — with the
// instruction directly under the header, the tool description leading on it, and
// the schema constraint that once made the honest answer impossible removed.
// Ruled out along the way: the block is not being truncated, since every one of
// the 100 family exemplars fits under MAX_PRIOR_CHARS (max 50,646 of 90,000).
//
// So it stops being something a model volunteers. The router has just resolved
// the page against the site's real list; deleting is then a merge rather than a
// generation — ~0.3 credits and a recompile, against ~28 for a rewrite.

test("a removal is carried, and only when it is unmistakable", () => {
  const pages = ["/", "/book", "/gallery"];
  const ask = (input) => readEdit(input, pages);
  const cut = ask({ layer: "page", page: "/gallery", remove: true });
  assert.equal(cut.intent, "edit");
  assert.equal(cut.layer, "page");
  assert.equal(cut.page, "/gallery");
  assert.equal(cut.remove, true);

  // THE BIAS IS INVERTED HERE AND NOWHERE ELSE IN THIS FILE. Everywhere else an
  // unclear answer resolves to WORK, because a wrong refusal is worse than a
  // wrong action. Removal is the one verb where that is false: a wrong edit
  // costs a page the customer can see and undo, a wrong removal takes their page
  // away. So nothing merely truthy may do it.
  for (const v of ["yes", 1, "true", {}, [], "no"]) {
    const r = ask({ layer: "page", page: "/gallery", remove: v });
    assert.equal(r.remove, undefined, "a removal fired on " + JSON.stringify(v));
    assert.equal(r.intent, "edit", "…and it must still be an ordinary page edit");
  }
  // Absent is an ordinary edit, and the field is not invented on other layers.
  assert.equal(ask({ layer: "page", page: "/book" }).remove, undefined);
  assert.equal(ask({ layer: "text", remove: true }).remove, undefined, "text has no page to remove");

  // A PAGE THE SITE DOES NOT HAVE, REMOVED, IS NOT AN ADDITION (2026-10-02, the
  // audit's W5): it used to become the add-on step, which cannot take a page
  // away, while the part held back for later waited. It stays the edit the
  // router chose, and the page step answers it with the site's real pages at
  // no cost before any removal can run — an exact match of a stored route
  // (`page/no-page`; driven through the route in `handover-batch2.test.mjs`).
  const gone = ask({ layer: "page", page: "/nope", remove: true });
  assert.equal(gone.intent, "edit");
  assert.equal(gone.page, "/nope");
  assert.equal(gone.remove, true);
});

test("…and the conservatism below it is NOT loosened by that", () => {
  // The bias on `remove` is deliberately inverted from everything else in this
  // file: unclear resolves to WORK everywhere except here, because a wrong edit
  // costs a page they can undo and a wrong removal takes their page away. The
  // fix above is about the model REACHING the layer, and must not touch this.
  assert.deepEqual(
    readEdit({ layer: "page", page: "/gallery", remove: "true" }, ["/gallery"]),
    { intent: "edit", answer: "", layer: "page", page: "/gallery" },
    "a truthy string took a page away");
  // RE-ANCHORED 2026-10-02 (the audit's W5): a removal of a page the site does
  // not have stays the edit — its page names no stored route, so the page step
  // refuses it before anything is removed (`page/no-page`) — where it used to
  // become an add-on that could not remove it.
  assert.deepEqual(
    readEdit({ layer: "page", page: "/nope", remove: true }, ["/gallery"]),
    { intent: "edit", answer: "", layer: "page", page: "/nope", remove: true },
    "a removal of a page the site does not have was turned into something else");
  assert.equal(
    readEdit({ layer: "page", page: "/gallery", remove: true }, ["/gallery"]).remove, true);
});

test("EVERY FIELD `readEdit` DECIDES REACHES THE CLIENT", () => {
  // DERIVED AT BOTH ENDS, because listing them by hand is how the third one was
  // missed. `layer` and `page` were added to the route response on 2026-08-11
  // after a live run showed `layer=undefined`; `remove` was decided by the same
  // function, read by the same client, and never added — so page deletion was
  // unreachable in the product from the day it shipped, and five prompt
  // rewrites chased a field the wire could not carry. From outside, "the model
  // did not set it" and "we did not forward it" are the same `undefined`.
  //
  // worker.js cannot be imported, so this is a source read — and it is derived
  // from what `readEdit` really returns rather than from a list, so a fourth
  // field added to that shape has to be forwarded or this goes red.
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const client = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  const decided = new Set();
  for (const page of ["/", "/gallery"]) {
    for (const extra of [{}, { remove: true }]) {
      const out = readEdit({ layer: "page", page, ...extra }, ["/", "/gallery"]);
      Object.keys(out).forEach((k) => decided.add(k));
    }
  }
  decided.delete("answer");   // only meaningful for `ask`, and carried separately
  decided.delete("intent");   // always returned
  assert.ok(decided.has("remove"), "the scan sees no `remove` — readEdit changed shape, rescope this");
  const body = worker.slice(worker.indexOf("intent: routed.intent,"));
  const resp = body.slice(0, body.indexOf("usage: routed.usage"));
  for (const field of decided) {
    assert.match(resp, new RegExp("\\b" + field + ":\\s*routed\\."),
      `the route decides \`${field}\` and never sends it — the edit lane cannot act on it`);
  }
  // AND THE CLIENT READS IT. Either end alone passes while the wire is cut,
  // which is exactly the state this was found in.
  assert.match(client, /remove:\s*d\.remove === true/,
    "the composer no longer carries the deletion flag to the edit route");
});

// ─────────────────────────────────────────────────────────────────────────
// `remove` REACHES EVERY LAYER THAT HAS ONE.
//
// It was read only inside the page branch, BELOW the early return for every
// other layer — so when the logo layer landed and its tool description asked
// for the same field ("true when they want the logo TAKEN OFF"), the flag was
// stripped here before the route ever saw it. Everything downstream was correct
// and starved, and "drop the logo, just the name is fine" was answered with
// "Attach the logo with the 📎 button" — the exact inversion the flag exists to
// prevent, and not escalated, so there was no working removal at all.
//
// DERIVED FROM `REMOVABLE_LAYERS`, not from a list of the two known today: the
// point of naming that constant is that a third removable layer cannot arrive
// with the flag silently dropped.
test("every removable layer carries `remove` off the router", () => {
  const pages = ["/", "/gallery"];
  assert.ok(REMOVABLE_LAYERS.length >= 2, "the constant must name real layers");
  for (const layer of REMOVABLE_LAYERS) {
    assert.ok(EDIT_LAYERS.includes(layer), layer + " is not an edit layer at all");
    const extra = layer === "page" ? { page: "/gallery" } : {};
    const on = readEdit({ layer, remove: true, ...extra }, pages);
    assert.equal(on.layer, layer);
    assert.equal(on.remove, true, layer + " lost the removal flag");
    // ABSENT, not `false` — the route gates on `=== true` and an explicit
    // false would read the same, but a caller inspecting the object should see
    // the same shape a plain edit has.
    const off = readEdit({ layer, ...extra }, pages);
    assert.equal(off.remove, undefined, layer + " invented a removal nobody asked for");
  }
});

test("a layer with no removal path never carries the flag", () => {
  // A flag nothing acts on is how this repo's dead features start: it reads at
  // the route as a capability and there is no code behind it.
  for (const layer of EDIT_LAYERS.filter((l) => !REMOVABLE_LAYERS.includes(l))) {
    const r = readEdit({ layer, remove: true }, ["/"]);
    assert.equal(r.layer, layer);
    assert.equal(r.remove, undefined, layer + " must not carry a flag no lane reads");
  }
});

test("only a real boolean removes anything", () => {
  // The one verb where guessing wrong takes something away rather than adding
  // something visible and undoable, so nothing merely truthy counts.
  for (const bad of ["true", 1, {}, [], "yes"]) {
    for (const layer of REMOVABLE_LAYERS) {
      const extra = layer === "page" ? { page: "/gallery" } : {};
      assert.equal(readEdit({ layer, remove: bad, ...extra }, ["/", "/gallery"]).remove, undefined,
        layer + " accepted " + JSON.stringify(bad) + " as a removal");
    }
  }
});

// ── The router can say WHERE a page is moving to ────────────────────────────

test("readEdit carries a new address for a page the site really has", () => {
  const out = readEdit({ layer: "page", page: "/what-we-do", rename: "/services" }, ["/", "/what-we-do"]);
  assert.equal(out.intent, "edit");
  assert.equal(out.layer, "page");
  assert.equal(out.page, "/what-we-do", "the page being moved must still be named");
  assert.equal(out.rename, "/services");
});

test("A REMOVAL BEATS A MOVE, because a model answering both has contradicted itself", () => {
  // Of the two readings, "delete it" is the one they plainly asked for if they
  // asked for it at all — moving a page on its way out is work nobody wanted.
  const out = readEdit({ layer: "page", page: "/gallery", remove: true, rename: "/work" }, ["/", "/gallery"]);
  assert.equal(out.remove, true);
  assert.ok(!("rename" in out), "a page was moved and deleted in one answer");
});

test("a heading is not an address", () => {
  // The field's whole risk: "call that page Services" is about the WORDS on it.
  // Anything that is not a path must not reach `renameRoute` as one.
  for (const junk of ["Services", "", "   ", null, 7, {}, ["/a"], true]) {
    const out = readEdit({ layer: "page", page: "/what-we-do", rename: junk }, ["/", "/what-we-do"]);
    assert.equal(out.intent, "edit", "a junk rename broke the edit: " + JSON.stringify(junk));
    assert.ok(!("rename" in out), "a non-path reached the renamer: " + JSON.stringify(junk));
  }
});

test("moving a page to the address it already has is not a move", () => {
  const out = readEdit({ layer: "page", page: "/book", rename: "/book" }, ["/", "/book"]);
  assert.ok(!("rename" in out), "a page was 'moved' to where it already is");
});

test("only the page layer can move anything", () => {
  // Every other layer would carry a field nothing acts on, which is how this
  // repo's dead features start — the same reason `remove` is scoped to
  // REMOVABLE_LAYERS rather than read for all seven.
  for (const layer of EDIT_LAYERS.filter((l) => l !== "page")) {
    const out = readEdit({ layer, rename: "/services" }, ["/", "/what-we-do"]);
    assert.ok(!("rename" in out), layer + " carries a rename it cannot act on");
  }
});

// ── THE SECOND THING THEY ASKED FOR ─────────────────────────────────────────
//
// `layer` is ONE value and always has been, so "make the background yellow and
// add a booking form" does the colour and drops the rest — then reports the half
// that ran as a plain success. Structural, not probabilistic: there was no field
// a second ask could arrive in.

test("readAlso carries the leftover in the customer's own words", () => {
  assert.deepEqual(readAlso({ alsoAsked: "  add a booking form  " }), { alsoAsked: "add a booking form" });
});

test("ABSENT MEANS ABSENT — an empty object, not an empty string", () => {
  // A response with no leftover must be byte-identical to what it was before
  // this existed, so the FIELD's presence is the signal rather than its value.
  assert.deepEqual(readAlso({}), {});
  assert.deepEqual(readAlso({ alsoAsked: "" }), {});
  assert.deepEqual(readAlso({ alsoAsked: "   " }), {});
  assert.deepEqual(readAlso(null), {});
  assert.deepEqual(readAlso(undefined), {});
});

test("a non-string is refused rather than coerced", () => {
  // `String(["a","b"])` is "a,b", which would be shown to the customer as their
  // own words — the coercion bug this repo has recorded on `normalizeRole`.
  // A LIST OF STRINGS IS SEVERAL PARTS SINCE 2026-10-03 (the mixed-work fixes:
  // *"Support multiple distinct deferred passages"*), each kept as given and
  // never joined; a list holding anything else is refused whole.
  assert.deepEqual(readAlso({ alsoAsked: ["a", "b"] }), { alsoAsked: ["a", "b"] });
  assert.deepEqual(readAlso({ alsoAsked: ["a", " a ", ""] }), { alsoAsked: "a" }, "one part, given twice, is one part");
  assert.deepEqual(readAlso({ alsoAsked: ["a", 7] }), {});
  assert.deepEqual(readAlso({ alsoAsked: ["a", ["b"]] }), {});
  assert.deepEqual(readAlso({ alsoAsked: 7 }), {});
  assert.deepEqual(readAlso({ alsoAsked: {} }), {});
  assert.deepEqual(readAlso({ alsoAsked: true }), {});
});

test("it is bounded ON THE SCREEN — one more sentence, not a second brief — and never cut where it is held back", () => {
  // RE-ANCHORED 2026-09-29. This asserted that the copy was CUT to
  // `MAX_ALSO_CHARS`. The copy is now also what the edit and add-on routes hold
  // back (`heldBack`), and a copy cut between two words is still found in the
  // message: only its first 200 characters would be held back and the rest of
  // the part promised for later would run this turn. So the copy is kept whole,
  // and the bound moved to where it always protected the customer — the
  // reply's last sentence, which shows at most `MAX_ALSO_CHARS` of it.
  const clause = ("on the Visit page only, put the order band above the opening hours and the map, " +
    "and keep the counter photograph where it is ").repeat(3).trim();
  assert.ok(clause.length > MAX_ALSO_CHARS, "the clause must be longer than the screen shows");
  assert.equal(readAlso({ alsoAsked: clause }).alsoAsked, clause, "a long copy was cut");
  const message = "Make the headings dark green. " + clause + ".";
  assert.equal(heldBack(message, readAlso({ alsoAsked: clause }).alsoAsked).run, "Make the headings dark green.", "a long held-back part left words in the turn");
  // A COPY NO MESSAGE COULD HOLD IS NOT ONE: dropped, never cut.
  // (One message of the size policy, 2026-10-03; it was 2,000.)
  assert.deepEqual(readAlso({ alsoAsked: "x".repeat(MAX_INPUT_CHARS + 1) }), {});
  assert.equal(readAlso({ alsoAsked: "x".repeat(MAX_INPUT_CHARS) }).alsoAsked.length, MAX_INPUT_CHARS);
  assert.equal(readAlso({ alsoAsked: "x".repeat(2001) }).alsoAsked.length, 2001, "a part past the old 2,000 was dropped");
  // THE SCREEN'S BOUND is this constant, read off the browser's own composer.
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  const open = chat.indexOf("\nfunction alsoTail(");
  const shut = chat.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, "alsoTail's landmarks are gone from chat.js");
  assert.ok(chat.slice(open, shut).includes(".slice(0, " + MAX_ALSO_CHARS + ")"), "the reply does not bound what it shows");
});

test("it rides on BOTH work rungs, because either can drop half a message", () => {
  const also = "add a booking form";
  const edit = readRouting(
    { content: [{ type: "tool_use", input: { intent: "edit", layer: "look", alsoAsked: also } }] },
    { hasSite: true });
  assert.equal(edit.intent, "edit");
  assert.equal(edit.alsoAsked, also);
  const addon = readRouting(
    { content: [{ type: "tool_use", input: { intent: "addon", alsoAsked: also } }] },
    { hasSite: true });
  assert.equal(addon.intent, "addon");
  assert.equal(addon.alsoAsked, also);
});

test("NOT ON A BUILD, WHICH FOLDS A SECOND ASK IN BY CONSTRUCTION", () => {
  // A build rewrites everything from the whole message, so telling somebody to
  // ask again for something it has just done is worse than saying nothing.
  const built = readRouting(
    { content: [{ type: "tool_use", input: { intent: "build", alsoAsked: "add a booking form" } }] },
    { hasSite: false });
  assert.equal(built.intent, "build");
  assert.equal(built.alsoAsked, undefined);
});

test("NOT ON ask OR clarify, where no work happened for a leftover to sit beside", () => {
  const asked = readRouting(
    { content: [{ type: "tool_use", input: { intent: "ask", answer: "Yes, I can.", alsoAsked: "x" } }] },
    { hasSite: true });
  assert.equal(asked.intent, "ask");
  assert.equal(asked.alsoAsked, undefined);
  const clar = readRouting(
    { content: [{ type: "tool_use", input: { intent: "clarify", alsoAsked: "x", question: { text: "What trade?", options: ["Barber", "Café"] } } }] },
    { hasSite: false, canClarify: true });
  assert.equal(clar.intent, "clarify");
  assert.equal(clar.alsoAsked, undefined);
});

test("A LEFTOVER NEVER CHANGES WHAT GETS DONE", () => {
  // It is a note. Everything else about the decision must be identical with and
  // without it, or a wrong one costs more than a stray sentence.
  const input = { intent: "edit", layer: "page", page: "/book", remove: true };
  const without = readRouting({ content: [{ type: "tool_use", input }] }, { hasSite: true, pages: ["/book"] });
  const withIt = readRouting({ content: [{ type: "tool_use", input: { ...input, alsoAsked: "and make it blue" } }] },
    { hasSite: true, pages: ["/book"] });
  const { alsoAsked, ...rest } = withIt;
  assert.deepEqual(rest, without);
  assert.equal(alsoAsked, "and make it blue");
});

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
import {
  ASK_TOOL, ASK_MODEL, ASK_MAX_TOKENS, MAX_MESSAGE,
  MAX_CLARIFY, MIN_OPTIONS, MAX_OPTIONS, MAX_OPTION_CHARS, MAX_QUESTION_CHARS,
  askRequest, readRouting, readQuestion, clipOption, clarifiedBrief, askUsage, routeMessage, siteDigest,
} from "../builder/site-ask.mjs";

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };

const toolReply = (input, usage) => ({
  content: [{ type: "tool_use", name: "route_message", input }],
  usage: usage || { input_tokens: 900, output_tokens: 60 },
});

// ── the call ─────────────────────────────────────────────────────────────────

test("one call, forced to the tool, on the cheap model", () => {
  const r = askRequest({ message: "what pages do I have?", site: SITE });
  assert.equal(r.model, ASK_MODEL);
  assert.match(ASK_MODEL, /haiku/i, "this is a routing decision, not a design task");
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

test("the digest is bounded, however much is thrown at it", () => {
  const many = Array.from({ length: 500 }, (_, i) => "/p" + i);
  const d = siteDigest({ name: "x".repeat(400), pages: many, tables: many });
  assert.ok(d.length < 2000, "the digest rides on every message and must stay small: " + d.length);
  assert.ok(!d.includes("/p400"), "the page list is not capped");
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
  assert.deepEqual([...declared].sort(), ["ask", "build", "clarify"]);

  // Every declared value produces itself when the caller allows it. A well-formed
  // payload is built per intent, because each branch needs a different field and
  // an intent starved of its field falls through to build for the WRONG reason —
  // which would let a genuinely unreachable intent pass this test.
  const wellFormed = {
    build: {},
    ask: { answer: "Two pages." },
    clarify: { question: { text: "Do customers book?", options: ["Yes", "No"] } },
  };
  for (const v of declared) {
    assert.ok(Object.hasOwn(wellFormed, v), "a new intent was declared and this guard was not taught its shape: " + v);
    const r = readRouting(toolReply({ intent: v, ...wellFormed[v] }), { canClarify: true });
    assert.equal(r.intent, v, "declared intent " + v + " is unreachable through the reader");
  }
});

test("the answer's length is capped in the DESCRIPTION, not only in max_tokens", () => {
  // max_tokens truncates mid-word; a description shortens. Output bills at 5x
  // input, so this is the field that moves the bill on the cheap path.
  const d = ASK_TOOL.input_schema.properties.answer.description;
  assert.match(d, /sentences/, "nothing bounds the reply's length in words");
  assert.ok(ASK_MAX_TOKENS <= 1000, "the routing call's ceiling has drifted upward: " + ASK_MAX_TOKENS);
});

test("the tool refuses to let the model invent a site", () => {
  // The one thing a wrong answer here does that a wrong build does not: state a
  // fact about the customer's own site that is not true.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  assert.match(ASK_TOOL.input_schema.properties.answer.description, /never invent/i);
  assert.match(src, /Never claim the site has a page, a table, or a feature that is not named below/);
});

test("intent is required and answer is not", () => {
  // Reversed, every build request would have to carry a reply nobody shows.
  const req = ASK_TOOL.input_schema.required;
  assert.deepEqual(req, ["intent"]);
});

// ── wiring: the layers this feature has to be alive at ───────────────────────

const worker = () => fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = () => fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("the route exists, is auth-gated, and is reachable", () => {
  // THE FAILURE THIS PREVENTS HAS HAPPENED SIX TIMES IN THIS REPO: a feature
  // built, tested, and dead at one layer. `dm2` was the last one — a matcher
  // missing from the condition guarding its own handler, answering 404 for a
  // month while every unit test passed.
  const src = worker();
  assert.match(src, /url\.pathname === "\/api\/site\/route"/, "the route matcher is gone");
  const i = src.indexOf('url.pathname === "/api/site/route"');
  // TO A LANDMARK, NOT A BYTE COUNT. This was `slice(i, i + 2200)` and went red
  // on a correct change the moment a comment was added inside the handler — a
  // guard about character counts rather than about the handler. The block runs
  // to where the NEXT route begins, so it covers this one however it grows.
  const end = src.indexOf('url.pathname === "/api/site/react-build"', i);
  assert.ok(end > i, "could not find the end of the routing handler");
  const block = src.slice(i, end);
  assert.match(block, /await authUser\(request, env\)/, "a paid model call must not be open to the world");
  assert.match(block, /routeMessage\(/, "the matcher is there and calls nothing");
});

test("worker.js imports what it calls", () => {
  // `OWN_ZONES` was read on the first line of a function, outside every try, and
  // never imported — so every Cloudflare custom-hostname call the platform ever
  // made threw before reaching the API. node --check passes on that.
  assert.match(worker(), /import \{[^}]*routeMessage[^}]*\} from "\.\/builder\/site-ask\.mjs"/);
});

test("the router is BILLED, and only when the model answered", () => {
  const src = worker();
  const i = src.indexOf('url.pathname === "/api/site/route"');
  // TO THE END OF THE HANDLER, not a fixed number of characters. A window sized
  // in bytes silently stops covering the thing it was written for the moment
  // somebody adds a comment above it — which is exactly what happened here.
  const end = src.indexOf("usage: routed.usage || undefined", i);
  assert.ok(i > 0 && end > i, "the routing handler moved; this guard checks nothing");
  const block = src.slice(i, end);
  // Charged on measured usage from the same price table as every other call —
  // this is the whole "every time a model is used, charge for it" rule, and a
  // routing call is not exempt for being cheap.
  assert.match(block, /pageCredits\(routed\.usage\)/, "the routing call is not metered");
  // COLLECTED, not merely asked for. `use_credits` refuses a bill larger than
  // the balance and debits zero, so a bare `useCredits` here would meter the
  // call and take nothing from anyone who is short.
  assert.match(block, /collectCredits\(auth, rCost\)/, "metered and never debited");
  // GUARDED on usage being present. `routeMessage` returns null usage when the
  // call failed, so this is where our-fault-is-our-cost lands on this path.
  assert.match(block, /if \(routed\.usage\)/, "a failed routing call would be billed");
});

// The router's own body, to its closing brace rather than to a byte count.
const routeBlock = () => {
  const src = chat();
  const i = src.indexOf("function siteRoute(");
  const end = src.indexOf("\n// What to say when a build could not run.", i);
  assert.ok(i > 0 && end > i, "siteRoute moved; this guard checks nothing");
  return src.slice(i, end);
};

test("the composer asks before it builds, and falls through on anything unexpected", () => {
  const src = chat();
  assert.match(src, /function siteRoute\(/, "the composer-side router is gone");
  assert.match(src, /siteRoute\(site, t, origin, isBuild, imgs, finish\)/, "siteSend no longer calls it");
  const block = routeBlock();
  // EVERY failure mode reaches the build. A router that can swallow a build
  // request is worse than no router: the customer cannot tell it from broken.
  //
  // Two fall-throughs now rather than one, because the clarify branch sits
  // between them — so the property is asserted as "an unusable answer of ANY
  // kind returns go()", which is what it always meant.
  assert.match(block, /if \(!r\.ok \|\| !d\) return go\(\)/, "a bad response no longer builds");
  assert.match(block, /if \(d\.intent !== 'ask' \|\| !d\.answer\) return go\(\)/,
    "the fall-through has been narrowed — some failure now stops the build");
  assert.match(block, /\.catch\(go\)/, "a network failure must still build");
  // AND THE CLARIFY BRANCH IS GUARDED THE SAME WAY. A question with fewer than
  // two options reaching the thread is a dead end nobody can click past, so it
  // has to fall through here as well as being refused server-side.
  assert.match(block, /d\.intent === 'clarify' && d\.question && Array\.isArray\(d\.question\.options\) && d\.question\.options\.length >= 2/,
    "a malformed question would render as a dead end");
});

test("an answer renders as an ordinary message, with no build attached", () => {
  // A steps block over an answer claims a build that did not happen, and a
  // `build` field is what makes the thread render one.
  const block = routeBlock();
  const pushes = block.match(/s0?\.msgs\.push\(\{[^}]*\}\)/g) || [];
  assert.equal(pushes.length, 2, "expected exactly the question push and the answer push: " + pushes.length);
  for (const p of pushes) {
    assert.ok(!/build:/.test(p), "neither a question nor an answer may carry build steps: " + p);
  }
  // The question push carries what makes it a question; the answer push does not,
  // or an ordinary reply would render buttons under it.
  const [question, answer] = pushes;
  assert.match(question, /q: /);
  assert.match(question, /opts: /);
  assert.ok(!/\bq: |\bopts: /.test(answer), "a plain answer is being rendered as a question: " + answer);
});

test("the balance refreshes after a routing charge", () => {
  // It debits before it answers, exactly like /api/direct — so it belongs on the
  // same list, or the ✦ pill silently drifts from the ledger.
  assert.match(chat(), /p === '\/api\/site\/route'/,
    "the router debits credits and nothing re-reads the balance");
});

test("an attachment on a REVISE skips the router, and on a first build does not", () => {
  // THIS TEST USED TO PIN THE BYPASS ITSELF (`!imgs.length`), and the bypass was
  // too wide. Its reasoning was right about one outcome — a file plus a sentence
  // is "use this", so answering with a paragraph drops the file — and `attached`
  // now bounds exactly that at the router. What the bypass ALSO removed was the
  // first-build question, which has nothing to do with build-vs-ask.
  //
  // So the property is no longer "attachments skip the call". It is: skip it
  // only when it could not change the answer. On a revise both non-build
  // outcomes are already closed, so the call is a credit spent on a known
  // result; on a first build the question is live.
  assert.match(chat(), /if \(reactPath && \(!imgs\.length \|\| isBuild\)\) \{ siteRoute\(/,
    "the routing condition changed — a first build with a file may be skipping its question again");
});

test("the digest the client sends is names only", () => {
  // Derived from the client rather than restated: a `collect` table's ROWS are
  // customer names and phone numbers, and this call fires on every message.
  const src = chat();
  const i = src.indexOf("const digest = {");
  assert.ok(i > 0, "the digest has been renamed or inlined");
  const block = src.slice(i, src.indexOf("};", i));
  for (const leak of ["rows", "msgs", "html", "conn", "brief"]) {
    assert.ok(!new RegExp("\\b" + leak + "\\b").test(block), leak + " reached the routing call: " + block);
  }
});

// ── what a build cost goes to the meter, not into the sentence ───────────────

test("no builder reply states what it cost", () => {
  // Owner's call 2026-08-08. Scoped to the two builder send paths rather than
  // the whole file — `openCredits` and the not-enough-credits messages legitimately
  // talk about the ✦ balance, and a file-wide check would forbid those too.
  const src = chat();
  for (const [name, from, to] of [
    ["the React engine", "function reactSend(", "function buildActiveText("],
    ["the router", "function siteRoute(", "// The React build/revise send path"],
  ]) {
    const a = src.indexOf(from);
    const b = src.indexOf(to, a);
    assert.ok(a > 0 && b > a, name + ": the send path was renamed — this guard now checks nothing");
    const block = src.slice(a, b).replace(/\/\/[^\n]*/g, "");
    assert.ok(!/✦'?\s*\+/.test(block), name + " still prints the cost into the reply");
    assert.ok(!/used\)/.test(block), name + " still appends a used-credits suffix");
  }
});

test("...and the meter is refreshed instead, which is the half that matters", () => {
  // REMOVING THE TEXT WITHOUT THIS IS THE BUG, not the fix. That suffix was the
  // ONLY signal a build had spent anything: the build response carries `cost`
  // and no `balance`, and nothing on that path ever called setCredits. Deleting
  // one without adding the other makes the spend invisible rather than quiet.
  // ONLY the React engine now. The legacy path was checked here too, and it no
  // longer spends anything: its POST went to `/api/site`, deleted 2026-07-27, so
  // it has been answering 404 to every message on a pre-React project. It makes
  // no request at all now, so there is no balance for it to re-read.
  const src = chat();
  for (const [name, from, to] of [
    ["the React engine", "function reactSend(", "function buildActiveText("],
  ]) {
    const a = src.indexOf(from);
    const b = src.indexOf(to, a);
    assert.ok(a > 0 && b > a, name + ": the send path was renamed — this guard now checks nothing");
    assert.match(src.slice(a, b), /scheduleCreditRefresh\(\)/,
      name + " spends credits and nothing re-reads the balance");
  }
  // And the retired path really does spend nothing — asserted, or "we removed
  // the refresh" and "we removed the spend" look identical here.
  const a = src.indexOf("function siteSend(");
  const b = src.indexOf("function siteStop(", a);
  assert.ok(a > 0 && b > a, "siteSend was renamed");
  assert.ok(!/apiFetch\(['"]\/api\/site['"]/.test(src.slice(a, b)),
    "the legacy engine is posting to a deleted route again");
});

test("the build routes stay OUT of apiFetch's refresh list", () => {
  // Not an oversight — a correctness requirement. apiFetch fires on the response
  // HEADERS, which on an NDJSON build is when the build STARTS; the charge lands
  // after publish, minutes later. A refresh there reads the pre-charge balance
  // and paints a number that is wrong in the reassuring direction.
  const src = chat();
  const i = src.indexOf("const p = path.split('?')[0];");
  const block = src.slice(i, i + 400);
  for (const route of ["/api/site/react-build", "/api/site/react-revise", "/api/site/build"]) {
    assert.ok(!block.includes(route), route + " would refresh the balance before the build has been charged");
  }
  // The router IS in it, and belongs there: a plain JSON response whose charge
  // is settled before it answers.
  assert.ok(block.includes("/api/site/route"));
});

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

test("the tool offers all three intents and describes the question", () => {
  const p = ASK_TOOL.input_schema.properties;
  assert.deepEqual(p.intent.enum, ["build", "ask", "clarify"]);
  assert.equal(p.question.properties.options.minItems, MIN_OPTIONS);
  assert.equal(p.question.properties.options.maxItems, MAX_OPTIONS);
  assert.deepEqual(p.question.required, ["text", "options"]);
  // The enum is the only place `clarify` can come from, so the description has
  // to say when NOT to use it — a model given a third option uses it.
  assert.match(p.intent.description, /first build/i);
  assert.match(p.intent.description, /[Nn]ever on a change|already exists/);
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
  // Bounded by the same cap the round is, so a caller cannot append fifty lines
  // of its own text to a brief by claiming they were answers.
  const many = clarifiedBrief("a cafe", Array.from({ length: 40 }, (_, i) => ({ q: "q" + i, a: "a" + i })));
  assert.equal(many.split("\n").filter((l) => l.startsWith("- ")).length, MAX_CLARIFY);
});

// ── the chain ────────────────────────────────────────────────────────────────

test("the route passes the round through, and requires a real boolean", () => {
  const w = worker();
  const i = w.indexOf('url.pathname === "/api/site/route"');
  const block = w.slice(i, w.indexOf("cost: rCost", i));
  assert.match(block, /firstBuild: rb\.firstBuild === true/,
    "a truthy firstBuild would let any caller open the question path");
  assert.match(block, /brief: rb\.brief/);
  assert.match(block, /qa: rb\.qa/);
  // The question is returned, or the whole tier is computed and rendered by
  // nothing — the dead-field shape this repo has recorded six times. Read to the
  // NEXT ROUTE rather than to `i + 4000`: a byte window stops covering what it
  // was written for as soon as a comment is added above the line, which is this
  // repo's recurring source-guard bug and is how this one failed.
  const end = w.indexOf('url.pathname === "/api/site/react-build"', i);
  assert.ok(end > i, "could not find the end of the routing handler");
  assert.match(w.slice(i, end), /question: routed\.intent === "clarify" \? routed\.question/);
});

test("the BUILD route folds the answers in, and does it in one place", () => {
  const w = worker();
  assert.match(w, /import \{ routeMessage, clarifiedBrief \}/, "the build route cannot compose the brief");
  const i = w.indexOf("const brief = clarifiedBrief(");
  assert.ok(i > 0, "the build route no longer folds the answers into the brief");
  assert.match(w.slice(i, i + 300), /body\.qa/, "the answers never reach it");
  // ONE implementation. The composer cannot import the module, so a copy there
  // is a second version of the sentence the designer reads.
  assert.ok(!/They were asked/.test(chat()), "public/chat.js is composing the brief itself");
});

test("the composer keeps the ORIGINAL brief across the round", () => {
  const src = chat();
  const i = src.indexOf("function siteRoute(");
  const block = src.slice(i, src.indexOf("function buildDownMsg", i));
  assert.ok(block.length > 400, "siteRoute moved; this guard checks nothing");
  // The brief comes off the ROUND when there is one, and the build is sent that
  // — never `t`, which after a round is whichever button was clicked.
  assert.match(block, /const brief = round \? round\.brief : t/);
  assert.match(block, /reactSend\(site, brief,/, "the build is sent the clicked answer instead of the brief");
  // The round ends when a build starts, or the next thing typed is read as an
  // answer to a question that is no longer on screen.
  assert.match(block, /s\.clarify = null/);
});

test("only a build sends the answers, and only the live question keeps its buttons", () => {
  const src = chat();
  const i = src.indexOf("const body = mode === 'build'");
  const body = src.slice(i, i + 460);
  const halves = body.split("slug: site.slug");
  assert.equal(halves.length, 2, "the build/revise split is no longer recognisable");
  assert.match(halves[0], /qa: qa \|\| \[\]/, "a build does not send the answers");
  assert.ok(!/\bqa:/.test(halves[1]), "a revise sends answers it can never have");

  // The buttons are rendered only while that question is live. Left on an
  // answered one, they offer a second answer to something already built.
  const a = src.indexOf("function siteAskHTML(");
  const askBlock = src.slice(a, src.indexOf("function siteAnswer(", a));
  assert.match(askBlock, /if \(!site \|\| !site\.clarify\) return ''/);
  assert.match(askBlock, /data-skip/, "there is no way past the questions");
  assert.match(askBlock, /data-ans=/);
  // THE LAST QUESTION ONLY, and this is the one a mutation found nothing
  // holding. A round asks one at a time, so an earlier question left clickable
  // records an answer against the wrong `q` — the pair goes into the brief
  // attached to a question that was already answered two messages ago.
  assert.match(askBlock, /reverse\(\)\.find\(/, "the live question is no longer identified");
  assert.match(askBlock, /if \(!live \|\| live !== m\) return ''/,
    "every past question in the thread keeps its buttons");
});

test("the printed key hints are keys that really work", () => {
  // A HINT THAT LIES IS WORSE THAN NO HINT: it teaches a shortcut and then
  // ignores it. The numbers are the whole reason this treatment was chosen over
  // the other three, so the rendering and the handler are checked against each
  // other rather than each on its own.
  const src = chat();
  const a = src.indexOf("function siteAskHTML(");
  const render = src.slice(a, src.indexOf("document.addEventListener('keydown'", a));
  // Rendered 1-based, in order, one per option.
  assert.match(render, /<kbd>' \+ \(i \+ 1\) \+ '<\/kbd>/, "the options are no longer numbered from 1");
  assert.match(render, /<kbd>esc<\/kbd>/, "the skip key hint is gone");

  const k = src.indexOf("document.addEventListener('keydown'", a);
  const keys = src.slice(k, src.indexOf("\n});", k));
  assert.ok(keys.length > 300, "the key handler moved; this guard checks nothing");
  // The digit maps back 1-based, off the SAME live question the buttons come
  // from — so a number and a click cannot answer differently.
  assert.match(keys, /siteAnswer\(opts\[n - 1\]\)/, "the numbers are off by one, or wired to nothing");
  // BOUNDED AT BOTH ENDS. Without the upper bound, pressing 9 on a three-option
  // question calls preventDefault and swallows the keypress to do nothing —
  // `siteAnswer` refuses the empty string, so it is silent rather than wrong,
  // which is exactly the kind of inert wiring that survives a whole suite.
  assert.match(keys, /n >= 1 && n <= opts\.length/, "a digit past the end of the list is still handled");
  assert.match(keys, /reverse\(\)\.find\(/, "the keys read a different question from the buttons");
  assert.match(keys, /e\.key === 'Escape'.*siteAnswer\('', true\)/s, "esc does not skip");
  // ENTER IS NOT BOUND, and that is the deviation from the mockup. Enter is the
  // composer's send key; bound here it either fights that or works only when the
  // box happens to be empty — one shortcut doing two different things.
  assert.ok(!/'Enter'/.test(keys), "Enter is bound here and collides with send");
});

test("the keys never fire where somebody is typing", () => {
  // THE WHOLE DIFFICULTY OF THIS TREATMENT. The composer is a text field and the
  // customer has just typed a brief into it, so a bare "1" bound globally would
  // put a digit in the box on some paths and answer a question on others.
  const src = chat();
  const k = src.indexOf("document.addEventListener('keydown'", src.indexOf("function siteAskHTML("));
  const keys = src.slice(k, src.indexOf("\n});", k));
  for (const guard of ["input", "textarea", "select", "isContentEditable"]) {
    assert.ok(keys.includes(guard), "typing into a " + guard + " would be swallowed");
  }
  // Modifiers are the browser's: Cmd+1 and Alt+1 switch tabs.
  assert.match(keys, /e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey/, "a browser shortcut would be hijacked");
  // And only while a question is actually live — otherwise every digit typed
  // anywhere on the page would look for one.
  assert.match(keys, /if \(!site \|\| !site\.clarify \|\| siteBusy\) return;/,
    "the keys fire with no question on screen, or during a build");
});

test("the answers are one per line, which is why this layout was chosen", () => {
  // These are short sentences the model writes, not chips we choose, so any
  // row-based layout wraps unevenly on exactly the wording that turns up in
  // practice. A column cannot degrade — that was the decision.
  const css = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const i = css.indexOf(".st-opts {");
  assert.ok(i > 0, "the option styling is gone");
  assert.match(css.slice(i, i + 200), /flex-direction: column/, "the answers wrap in a row again");
  // The key chips are a FIXED width, or "esc" is wider than "1" and the labels
  // sit on a ragged left edge. Measured before this was pinned: 28px out.
  const kbd = css.indexOf(".st-opt kbd {");
  assert.ok(kbd > 0);
  assert.match(css.slice(kbd, kbd + 260), /width: [\d.]+em/, "the key hints are not a fixed width");
});

test("a typed reply during a round is an ANSWER, not a new brief", () => {
  // Typing instead of clicking is normal — the options cover the likely answers,
  // not every answer. Routed down the ordinary path it would start a fresh build
  // from those few words and lose the brief the round was about.
  const src = chat();
  const i = src.indexOf("function siteSend(");
  const block = src.slice(i, i + 1200);
  assert.match(block, /if \(site\.clarify\) \{ siteAnswer\(t\); return; \}/);
  // And skipping goes STRAIGHT to the build — paying a model to reclassify
  // "just build it" is the one question too many the button exists to avoid.
  const a = src.indexOf("function siteAnswer(");
  const ans = src.slice(a, src.indexOf("function siteSend(", a));
  assert.match(ans, /if \(skip\)/);
  assert.match(ans, /reactSend\(site, round\.brief, origin, 'build'/);
  assert.ok(!/siteRoute\([^)]*\)\s*;?\s*\}\s*$/.test(ans.slice(ans.indexOf("if (skip)"), ans.indexOf("siteRoute("))),
    "the skip path calls the router");
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
  assert.match(sys, /TALK LIKE A PERSON/, "the tone instruction is gone");
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

test("the options must be the CUSTOMER's answers, not the assistant's next line", () => {
  // The other half of the same live failure: the model filled the buttons with
  // its own dialogue ("I'll come back with more details in a moment"), which
  // renders as a control that means nothing when pressed. And the question it
  // was attached to — "what does your business do?" — is open-ended, so there
  // were no answers to name in the first place.
  const opts = ASK_TOOL.input_schema.properties.question.properties.options.description;
  assert.match(opts, /never your own next sentence/i, "nothing stops the assistant's own lines becoming buttons");
  assert.match(opts, /IF YOU CANNOT NAME TWO OR THREE CONCRETE ANSWERS/,
    "an open-ended question can still be dressed up as a multiple choice");
  assert.match(opts, /answer "ask"/, "no route out for a question that has no options");

  // And the reply is told to answer what was SAID, because a stock opening line
  // in the description came back verbatim for a greeting, a "wassup" AND a
  // "thanks!" — three different messages, one identical reply.
  const ans = ASK_TOOL.input_schema.properties.answer.description;
  assert.match(ans, /ANSWER WHAT THEY ACTUALLY SAID/);
  assert.match(ans, /thank-you gets/i, "a thank-you and a greeting are still one case");
  assert.ok(!/Hey\. What are we building\?/.test(ans),
    "the stock line is back in the description and will be parroted verbatim");
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

test("an answer to our own question is never answered with prose", () => {
  // MEASURED LIVE: two questions answered, third button press, and the reply was
  // "I'm not sure what you'd like me to build. Tell me about your business." —
  // to somebody who had just told us three times, using our own buttons.
  const askReply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "I'm not sure what you'd like me to build." } }] };
  assert.equal(readRouting(askReply, { answering: true }).intent, "build",
    "an ask in reply to our own question is a dead end");
  assert.equal(readRouting(askReply, { answering: true }).answer, "",
    "the prose must not be shown as though it were a reply");
  // …and OUTSIDE a round it is still a perfectly good answer, or this fix would
  // have removed the feature rather than bounded it.
  assert.equal(readRouting(askReply, { answering: false }).intent, "ask");
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

test("routeMessage passes `answering` through to the reader", () => {
  // The flag is read in `readRouting`, so a `routeMessage` that forgets to hand
  // it over leaves the bug exactly where it was with every unit test green.
  const reply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "hmm" } }] };
  return routeMessage({ send: async () => reply },
    { message: "Sleek and modern", site: {}, firstBuild: true, brief: "Book classes", answering: true, qa: [] })
    .then((r) => assert.equal(r.intent, "build", "`answering` did not reach readRouting"));
});

test("the route hands `answering` to the router, strictly", () => {
  // WHERE THE FIX CAN DIE SILENTLY. `readRouting` is unit-tested and correct;
  // worker.js cannot be imported, so nothing else notices if the flag simply
  // never arrives. That is the shape this repo has recorded six times — every
  // layer right but one, and the one is quiet.
  const w = worker();
  const i = w.indexOf("await routeMessage(");
  assert.ok(i > 0, "the routing call is gone");
  // TO A LANDMARK, not a byte count — a window sized in characters stops
  // covering what it was written for the moment a comment is added above the
  // line, which is this repo's recurring source-guard bug. The call ends at the
  // `);` that closes it.
  const end = w.indexOf("\n      );", i);
  assert.ok(end > i, "could not find the end of the routing call");
  const call = w.slice(i, end);
  assert.match(call, /qa: rb\.qa/, "this is not the call it was written for");
  assert.match(call, /answering:\s*rb\.answering === true/,
    "the answer flag never reaches routeMessage, so a button press can still be answered with prose");
});

test("the composer says a button press is an answer", () => {
  // The other half. `siteAnswer` is the ONLY caller that may set it — a plain
  // message must still be routable as a question, which is the whole feature.
  const c = chat();
  const i = c.indexOf("function siteAnswer(");
  assert.ok(i > 0, "siteAnswer is gone");
  const body = c.slice(i, c.indexOf("\nfunction ", i + 10));
  assert.match(body, /siteRoute\(site, said, origin, true, imgs, finish, true\)/,
    "the composer no longer tells the server this is an answer");
  // …and it is actually put on the wire.
  assert.match(c, /answering:\s*!!answering/, "siteRoute drops the flag before sending it");
  // A plain first message must NOT claim to be an answer, or the ask feature is
  // gone: `siteSend` routes with no such argument.
  const j = c.indexOf("function siteSend(");
  const send = c.slice(j, c.indexOf("\nfunction ", j + 10));
  assert.doesNotMatch(send, /siteRoute\([^)]*,\s*true\s*\)\s*;/,
    "an ordinary message is being sent as though it answered a question");
});

test("the trade is the first question when the brief does not name it", () => {
  // NOT ENFORCEABLE IN CODE — "does this brief say what the business is" is a
  // judgement, so the tool description is the only lever and this is a guard on
  // the description rather than on behaviour. Worth having anyway: the rule was
  // added because a live round spent BOTH its questions on logins and mood and
  // still did not know whether "Book classes" meant a gym or a pottery studio,
  // and a rule nobody asserts is one a later edit quietly drops.
  const d = ASK_TOOL.input_schema.properties.question.description;
  assert.match(d, /WHAT THE BUSINESS IS COMES FIRST/);
  assert.match(d, /trade/i, "the rule must name the thing it is about");
  // The example is what makes it concrete rather than a slogan.
  assert.match(d, /Book classes/, "the measured case is what stops this reading as generic advice");
});

test("an attachment closes off prose without closing off the question", () => {
  // AN ATTACHMENT USED TO SKIP THE ROUTING CALL ENTIRELY, which was right about
  // one outcome and silently took a second one with it. A file plus a sentence
  // is an instruction, so answering it with a paragraph drops the file on the
  // floor — `attached` bounds that. It must NOT bound `clarify`, or attaching a
  // logo opts a first build out of the one question the owner asked for.
  const askReply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "Nice logo!" } }] };
  assert.equal(readRouting(askReply, { attached: true }).intent, "build",
    "a message with a file attached must not be answered with prose");
  assert.equal(readRouting(askReply, { attached: true }).answer, "",
    "the prose must not be shown as though it were a reply");
  // With nothing attached it is still an ordinary question, or this bounded
  // nothing and removed the feature instead.
  assert.equal(readRouting(askReply, { attached: false }).intent, "ask");

  const q = { text: "What do people do on it?", options: ["Book a slot", "Send an enquiry"] };
  const clarifyReply = { content: [{ type: "tool_use", input: { intent: "clarify", question: q } }] };
  assert.equal(readRouting(clarifyReply, { canClarify: true, attached: true }).intent, "clarify",
    "an attachment must not suppress the first-build question");
});

test("routeMessage passes `attached` through to the reader", () => {
  // Where it dies silently: `readRouting` is correct and never told. The same
  // hole `answering` had, one flag over.
  const reply = { content: [{ type: "tool_use", input: { intent: "ask", answer: "hmm" } }] };
  return routeMessage({ send: async () => reply },
    { message: "use this logo", site: {}, firstBuild: true, brief: "a barber shop", attached: true, qa: [] })
    .then((r) => assert.equal(r.intent, "build", "`attached` did not reach readRouting"));
});

test("the route hands `attached` to the router, strictly", () => {
  const w = worker();
  const i = w.indexOf("await routeMessage(");
  assert.ok(i > 0, "the routing call is gone");
  const end = w.indexOf("\n      );", i);
  assert.ok(end > i, "could not find the end of the routing call");
  assert.match(w.slice(i, end), /attached:\s*rb\.attached === true/,
    "the attachment flag never reaches routeMessage, so a file can still be answered with prose");
});

test("the composer routes a first build even with a file attached", () => {
  // THE HALF THAT WAS THE BUG. `siteSend` skipped `siteRoute` whenever anything
  // was attached, so no first build with a logo was ever asked anything.
  const c = chat();
  const j = c.indexOf("function siteSend(");
  assert.ok(j > 0, "siteSend is gone");
  const send = c.slice(j, c.indexOf("\nfunction ", j + 10));
  assert.match(send, /if \(reactPath && \(!imgs\.length \|\| isBuild\)\)/,
    "an attachment skips the router again, so a first build with a file is never asked a question");
  // …and the flag is actually put on the wire, derived from the attachments
  // rather than taken as an argument nobody passes.
  assert.match(c, /attached:\s*!!\(imgs && imgs\.length\)/,
    "siteRoute drops the attachment flag before sending it");
  // The round keeps the files, or answering the question builds without them.
  const a = c.indexOf("function siteAnswer(");
  assert.match(c.slice(a, c.indexOf("\nfunction ", a + 10)), /site\.clarify\.imgs \|\| \[\]/,
    "the attachments do not survive the clarify round");
});

test("an unreadable balance still gets routed; an empty one does not", () => {
  // TWO DIFFERENT ANSWERS THAT WERE READ AS ONE. `catch { rBal = 0 }` made an
  // unreachable Supabase look exactly like an empty account, so every ledger
  // blip turned every question into a build — and that build then failed on its
  // own gate against the same ledger.
  const w = worker();
  const i = w.indexOf('url.pathname === "/api/site/route"');
  assert.ok(i > 0, "the routing route is gone");
  const block = w.slice(i, w.indexOf("await routeMessage(", i));
  assert.match(block, /catch \{ rBal = null; \}/,
    "an unreadable ledger is being read as a zero balance again");
  assert.match(block, /if \(rBal !== null && !\(rBal > 0\)\)/,
    "the gate no longer separates 'no credits' from 'could not tell'");
  // A REAL zero must still short-circuit, or this turned the gate off entirely
  // and every empty account pays for routing.
  assert.match(block, /intent: "build", cost: 0/,
    "an account with no credits no longer skips the paid call");
});

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
  askRequest, readRouting, askUsage, routeMessage, siteDigest,
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
  assert.deepEqual(u, { in: 900, out: 60, cacheRead: 500, cacheWrite: 20 });
  // A response with no usage block must read as zeros, never as NaN — NaN
  // propagates into pageCredits and comes out as a charge nobody can explain.
  assert.deepEqual(askUsage({}), { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 });
  assert.deepEqual(askUsage(null), { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 });
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

test("the enum and the reader agree on the same two values", () => {
  // Derived at both ends. A third intent added to the schema and not to the
  // reader would be silently coerced to "build" — the schema would advertise a
  // branch that does not exist.
  const declared = ASK_TOOL.input_schema.properties.intent.enum;
  assert.deepEqual([...declared].sort(), ["ask", "build"]);
  for (const v of declared) {
    const r = readRouting(toolReply({ intent: v, answer: "something" }));
    assert.ok(["ask", "build"].includes(r.intent));
  }
  // And the one the reader treats specially really is in the schema, or the
  // whole cheap path is unreachable.
  assert.ok(declared.includes("ask"), "the reader branches on a value the model is never offered");
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
  const block = src.slice(i, i + 2200);
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
  const block = src.slice(i, i + 2200);
  // Charged on measured usage from the same price table as every other call —
  // this is the whole "every time a model is used, charge for it" rule, and a
  // routing call is not exempt for being cheap.
  assert.match(block, /pageCredits\(routed\.usage\)/, "the routing call is not metered");
  assert.match(block, /useCredits\(auth, rCost\)/, "metered and never debited");
  // GUARDED on usage being present. `routeMessage` returns null usage when the
  // call failed, so this is where our-fault-is-our-cost lands on this path.
  assert.match(block, /if \(routed\.usage\)/, "a failed routing call would be billed");
});

test("the composer asks before it builds, and falls through on anything unexpected", () => {
  const src = chat();
  assert.match(src, /function siteRoute\(/, "the composer-side router is gone");
  assert.match(src, /siteRoute\(site, t, origin, isBuild, imgs, finish\)/, "siteSend no longer calls it");
  const i = src.indexOf("function siteRoute(");
  const block = src.slice(i, i + 2000);
  // EVERY failure mode reaches the build. A router that can swallow a build
  // request is worse than no router: the customer cannot tell it from broken.
  assert.match(block, /if \(!r\.ok \|\| !d \|\| d\.intent !== 'ask' \|\| !d\.answer\) return go\(\)/,
    "the fall-through has been narrowed — some failure now stops the build");
  assert.match(block, /\.catch\(go\)/, "a network failure must still build");
});

test("an answer renders as an ordinary message, with no build attached", () => {
  // A steps block over an answer claims a build that did not happen, and a
  // `build` field is what makes the thread render one.
  const src = chat();
  const i = src.indexOf("function siteRoute(");
  const block = src.slice(i, i + 2000);
  const push = block.match(/s\.msgs\.push\(\{[^}]*\}\)/);
  assert.ok(push, "the answer is never pushed onto the thread");
  assert.ok(!/build:/.test(push[0]), "an answered question must not carry build steps: " + push[0]);
});

test("the balance refreshes after a routing charge", () => {
  // It debits before it answers, exactly like /api/direct — so it belongs on the
  // same list, or the ✦ pill silently drifts from the ledger.
  assert.match(chat(), /p === '\/api\/site\/route'/,
    "the router debits credits and nothing re-reads the balance");
});

test("an attachment skips the router entirely", () => {
  // A file plus a sentence is the shape of "use this". The router would have to
  // guess which, and guessing "ask" answers a build request with a paragraph and
  // drops the attachment — the one case where paying for the call is worse than
  // not asking.
  assert.match(chat(), /if \(reactPath && !imgs\.length\) \{ siteRoute\(/,
    "the attachment bypass is gone, so a file can be answered instead of used");
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
  const src = chat();
  for (const [name, from, to] of [
    ["the React engine", "function reactSend(", "function buildActiveText("],
    ["the legacy engine", "function siteSend(", "function siteStop("],
  ]) {
    const a = src.indexOf(from);
    const b = src.indexOf(to, a);
    assert.ok(a > 0 && b > a, name + ": the send path was renamed — this guard now checks nothing");
    assert.match(src.slice(a, b), /scheduleCreditRefresh\(\)/,
      name + " spends credits and nothing re-reads the balance");
  }
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

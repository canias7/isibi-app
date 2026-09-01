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
import { modelsFor } from "../builder/build-models.mjs";
import {
  ASK_TOOL, ASK_MODEL, ASK_MAX_TOKENS, MAX_MESSAGE,
  MAX_CLARIFY, MIN_OPTIONS, MAX_OPTIONS, MAX_OPTION_CHARS, MAX_QUESTION_CHARS,
  EDIT_LAYERS, REMOVABLE_LAYERS, FALLBACK_WITH_SITE, FALLBACK_NO_SITE,
  askRequest, readRouting, readEdit, readQuestion, clipOption, clarifiedBrief, askUsage, routeMessage,
  siteDigest, normalizePagePath,
  readAlso, MAX_ALSO_CHARS,
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

test("EVERY builder message is routed, attachment or not", () => {
  // THIS ASSERTION HAS NOW BEEN WRONG TWICE, BOTH TIMES FOR THE SAME REASON: it
  // pinned the exact spelling of the routing condition, so it went red on a
  // correct change and said nothing about what it was protecting.
  //
  // The bypass it first pinned (`!imgs.length`) was too wide — it also skipped
  // the first-build question. Narrowed to revises-only, it was still a claim
  // about the LAYERS THAT EXISTED: "on a revise both non-build outcomes are
  // closed, so the call could only answer build". The `logo` layer made that
  // false — an attached picture plus "this is my logo" has a real cheap answer —
  // and a skip would have made that rung unreachable for the one message shape
  // it exists to serve.
  //
  // So the durable property is the one asserted here: NOTHING bypasses the
  // router, because a bypass is how a rung silently stops existing. The
  // narrower rule that a file is never answered with prose is a separate thing,
  // held one assertion down, where it belongs — at the router, not at the door.
  const c = chat();
  const j = c.indexOf("function siteSend(");
  assert.ok(j > 0, "siteSend is gone");
  const send = c.slice(j, c.indexOf("\nfunction ", j + 10));
  assert.match(send, /if \(reactPath\) \{ siteRoute\(/,
    "something is bypassing the router again — whatever it skips is a rung nobody can reach");
  assert.ok(!/imgs\.length[^\n]*siteRoute|siteRoute[^\n]*imgs\.length/.test(send),
    "the routing decision reads the attachments again, which is the bypass this replaced");
});

test("…and a file is still never answered with a paragraph", () => {
  // The half of the old rule that survives, and it is enforced at the ROUTER
  // rather than by refusing to call it: `attached` closes off `ask`, so a
  // message carrying a file always gets work back. Answering it with prose
  // drops the file on the floor, which is the original failure.
  assert.match(chat(), /attached:\s*!!\(imgs && imgs\.length\)/,
    "siteRoute drops the attachment flag, so `ask` is no longer closed off for a message with a file");
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

test("THE DIGEST'S TABLE LIST IS FED — the client stores what the responses name", () => {
  // The routing tool conditions its edit-vs-addon tie-break and its cheapest
  // "data" layer on "the tables it has are named above" — and nothing in the
  // client ever WROTE site.tables, so the digest sent `tables: []` on every
  // message of every site and the router decided blind on the one fact that
  // separates a free data edit from a ~25-credit addon (2026-08-14 audit).
  // Invisible to edit-smoke, whose digest is built from the build response's
  // own tables field — a fixture more capable than reality.
  const src = chat();
  // The digest reads site.tables (the consumer)…
  const i = src.indexOf("const digest = {");
  const dig = src.slice(i, src.indexOf("};", i));
  assert.match(dig, /site\.tables/, "the digest no longer reads site.tables");
  // …and BOTH producers write it: the build finish handler and the addon
  // handler. A UNION, never a replace — a revise's response names the DELTA
  // the apply touched, and replacing would erase the rest of the site's list.
  const fin = src.indexOf("if (r.ok && d && d.error !== true && d.slug) {");
  assert.ok(fin > 0, "the build finish handler moved — rescope this");
  // COMMENTS BLANKED before judging. The comment explaining this very fix
  // names `d.schema`, so an unblanked match passed while the code read only
  // `d.tables` — a mutant proved it, and it is the recorded shape (the og
  // guard's comment match): prose explaining a fix contains the fix's
  // spelling. Line comments only; the window holds no block comments and a
  // whole-file blanker on chat.js has its own recorded hazards.
  const finBlock = src.slice(fin, src.indexOf("siteSnap(s, t);", fin)).replace(/\/\/[^\n]*/g, "");
  assert.match(finBlock, /s\.tables = \[\.\.\.new Set\(\[\.\.\.\(Array\.isArray\(s\.tables\) \? s\.tables : \[\]\), \.\.\.tnames\]\)\]/,
    "the build response's table names are not merged into the site record");
  assert.match(finBlock, /d\.schema/, "the merged spec (d.schema) is not consulted — d.tables alone is the revise delta");
  const add = src.indexOf("function siteAddon(");
  assert.ok(add > 0, "siteAddon moved — rescope this");
  const addBlock = src.slice(add, src.indexOf("function sitePathOf(", add));
  assert.match(addBlock, /s\.tables = \[\.\.\.new Set\(/,
    "the addon lane adds tables and never tells the digest about them");
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

test("the tool offers every intent and describes the question", () => {
  const p = ASK_TOOL.input_schema.properties;
  assert.deepEqual(p.intent.enum, ["build", "ask", "clarify", "edit", "addon"]);
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
  // THE PROPERTY IS THAT BOTH NAMES ARRIVE, not that they arrive alone. Pinned
  // to the exact two-name list, this went red the moment an honest third import
  // (`siteDigest`, 2026-08-29) joined them — reporting that the build route
  // could no longer compose the brief, which was never true. The single most
  // repeated own-goal in this repo: assert the property, not the spelling.
  const askImport = (w.match(/^import \{([^}]*)\} from "\.\/builder\/site-ask\.mjs";$/m) || [])[1];
  assert.ok(askImport, "nothing is imported from site-ask.mjs at all — this scan has lost its subject");
  for (const name of ["routeMessage", "clarifiedBrief"]) {
    assert.ok(askImport.split(",").map((s) => s.trim()).includes(name),
      "the build route cannot compose the brief — `" + name + "` is no longer imported");
  }
  const i = w.indexOf("const brief = clarifiedBrief(");
  assert.ok(i > 0, "the build route no longer folds the answers into the brief");
  // TO THE CALL'S OWN CLOSE, not `i + 300` — and the guard directly above this
  // one says exactly that about itself, having already been bitten. This is the
  // ninth byte-sized window in this repo outrun by its own subject: the brief
  // argument grew a comment explaining that a non-string is no longer coerced
  // (the `String(["a","b"])` class, which the two readers beside it already
  // refused), and `body.qa` on the next line fell out of range.
  const callEnd = w.indexOf("\n      ).slice(", i);
  assert.ok(callEnd > i, "the clarifiedBrief call was reshaped — rescope this");
  assert.match(w.slice(i, callEnd), /body\.qa/, "the answers never reach it");
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
  assert.match(send, /if \(reactPath\) \{ siteRoute\(/,
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

test("the deploy check probes the question policy, as a PAIR", () => {
  // THE POLICY IS PROMPT TEXT, and no unit test can prove a prompt produces a
  // behaviour — this file's own clarify tests assert wording, which is all they
  // can do. `build smoke` is where it is actually measured, so what this holds
  // is that the measurement still exists and is still the shape that means
  // something.
  const smoke = fs.readFileSync(new URL("./integration/build-smoke.mjs", import.meta.url), "utf8");
  const at = smoke.indexOf("const routeIntent =");
  assert.ok(at > 0, "the routing probes are gone, so the question policy is measured by nothing");
  const block = smoke.slice(at, smoke.indexOf("--- the actual build", at));
  assert.ok(block.length > 0, "the probe block no longer sits before the build");

  // BOTH DIRECTIONS, because either alone is passed by a broken router: one that
  // asks every time passes the floor, one that never asks passes the ceiling.
  assert.match(block, /a website for my business/,
    "the floor probe is gone — the brief that measured this dead last time");
  assert.match(block, /thin\.intent === "clarify"/,
    "nothing asserts a trade-less brief is still asked about");
  assert.match(block, /full\.intent === "build"/,
    "nothing asserts a complete brief is built rather than interrogated");

  // AND THE ONE ASSERTION A STUCK ROUTER CANNOT PASS. Two green lines read as
  // "it works" while being "it always asks" plus a coincidence; this is the one
  // that cannot be true of a router jammed either way.
  assert.match(block, /thin\.intent !== full\.intent/,
    "the pair is no longer compared, so a router stuck on one answer reads as healthy");

  // WITHOUT THIS THE WHOLE PAIR IS VACUOUS. `canClarify` is false on a revise, so
  // a probe that forgets `firstBuild` gets "build" for both briefs and passes the
  // floor check by accident — the exact shape of failure this test exists for.
  assert.match(block, /firstBuild: true/,
    "the probes do not open the question path, so both answer 'build' and prove nothing");

  // It must stay a ROUTING call. Reaching /api/site/react-build here would spend
  // a designer call, a Neon project and a compile per probe.
  assert.match(block, /\/api\/site\/route/, "the probe no longer hits the routing endpoint");
  assert.ok(!/react-build/.test(block), "a probe is calling the build route — that is a real site per probe");
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

test("the tool says what separates an edit from an addon, and where to fail", () => {
  const d = ASK_TOOL.input_schema.properties.intent.description;
  // The English question is the wrong one — "add a testimonials section" is an
  // edit. This is the measured trap, so the description must name it.
  assert.match(d, /testimonials/i, "the description does not name the case the boundary gets wrong");
  assert.match(d, /page the site does not have|table it does not have/i);
  assert.match(d, /cannot tell.*addon/is, "the description must say which way to fail");
  // And the layer field has to explain what each one costs to pick between them.
  const l = ASK_TOOL.input_schema.properties.layer.description;
  for (const layer of EDIT_LAYERS) assert.ok(l.includes('"' + layer + '"'), "layer " + layer + " is undescribed");
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
  const bounded = readRouting(toolReply({ intent: "ask", answer: "Sure!" }), { hasSite: true, answering: true });
  assert.equal(bounded.intent, "addon");
  const attached = readRouting(toolReply({ intent: "ask", answer: "Sure!" }), { hasSite: true, attached: true });
  assert.equal(attached.intent, "addon");
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

  // A page the site does not have is still an addon, removal or not — the same
  // resolution that protects every other page edit.
  assert.equal(ask({ layer: "page", page: "/nope", remove: true }).intent, "addon");
});

test("the router can express a removal at all, and says when not to", () => {
  const f = ASK_TOOL.input_schema.properties.remove;
  assert.ok(f, "the router has no way to say a page should go");
  assert.equal(f.type, "boolean");
  // The distinction that decides whether this is safe: a section coming off a
  // page is not the page coming off the site.
  assert.match(f.description, /ONLY WHEN THEY PLAINLY MEAN DELETE THE WHOLE PAGE/);
  assert.match(f.description, /takes\s+a page off their site/, "the consequence is not stated");
});

test("THE ROUTER IS TOLD A PAGE DELETION IS AN EDIT, and told not to ask about it", () => {
  // MEASURED LIVE 2026-08-12, and this is the failure the whole deletion path
  // was invisible behind: `edit smoke` asked the deployed router to
  // "Remove the gallery page" and it came back
  // `intent=ask layer=undefined remove=undefined page=undefined`.
  //
  // The CODE was fine — `readEdit` resolves the page and honours `remove === true`
  // — so nothing below the router could have caught it. What was missing was in
  // the tool description: the `edit` clause said only "something taken away",
  // the `page` layer said "take one out" about a SECTION, and nothing anywhere
  // told the model not to check first. Asking "are you sure?" is the natural
  // thing a helpful model does with a destructive instruction, and it is the one
  // answer this interface cannot accept — there is no yes button, so it reads as
  // the builder refusing to work.
  //
  // Asserted on the description because that is where the fix lives, and a
  // prompt fix with nothing holding it is one a later edit drops silently.
  const t = JSON.stringify(ASK_TOOL);
  assert.match(t, /NEVER ANSWER \\"ask\\" TO CHECK THAT THEY MEANT IT/,
    "nothing stops the router asking for confirmation before a destructive change");
  assert.match(t, /TAKING A WHOLE PAGE OFF THE SITE IS AN EDIT/,
    "the intent field never says a page deletion is an edit");
  assert.match(t, /THIS IS ALSO WHERE A PAGE IS DELETED/,
    "the page layer never says a deletion belongs to it");
  // THE TIE-BREAK IS THE LAST SENTENCE AND THEREFORE THE STRONGEST ONE. With
  // the three above in place and this one absent, the live router stopped
  // answering "ask" and started answering "addon" — measured on the very next
  // run — because it read "addon can do everything an edit can", which is
  // FALSE for a removal: no addon can take a page off a site, so the answer
  // spends a full page-generation call and comes back `no-change`. The
  // exception has to sit at the tie-break, not eight lines above it.
  assert.match(t, /A REMOVAL IS NEVER AN ADDON/,
    "the addon tie-break can swallow a deletion again, which costs a real call and changes nothing");
  const tie = t.slice(t.indexOf("WHEN YOU CANNOT TELL"));
  assert.ok(tie.length > 0 && /A REMOVAL IS NEVER AN ADDON/.test(tie),
    "the exception is stated somewhere ABOVE the tie-break, where the model has already stopped reading");
  // AND THE SAME LESSON ONE FIELD OVER. `remove`'s page clause used to CLOSE on
  // "getting it wrong the other way takes a page off their site" — a warning
  // against the action as its final word. Measured live with everything else
  // correct (`layer=page page=/gallery remove=undefined`) against this field's
  // own first example. It closes on the consequence of OMITTING it now.
  assert.match(t, /WITHOUT THIS FIELD THE PAGE STAYS/,
    "the remove field never says what happens when it is left out, which is the failure the customer sees");
  const rm = t.slice(t.indexOf("WITHOUT THIS FIELD THE PAGE STAYS"));
  assert.ok(!/takes a page off their site/.test(rm.slice(0, 400)),
    "the clause still ends on the warning, which is the position that lost it twice");
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
  assert.equal(
    readEdit({ layer: "page", page: "/nope", remove: true }, ["/gallery"]).intent,
    "addon", "a removal was honoured for a page the site does not have");
  assert.equal(
    readEdit({ layer: "page", page: "/gallery", remove: true }, ["/gallery"]).remove, true);
});

test("the deletion path reaches the route and calls no model", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('if (eLayer === "page") {');
  assert.ok(at > 0, "the page layer moved");
  const branch = w.slice(at, w.indexOf('const eModels = modelsFor(', at));
  // `eRemove`, NOT `eb.remove` DIRECTLY (2026-08-29). The flag is read once at
  // the top of the route into a name the front door can also SET, because the
  // `pages` lane decides a removal from the customer's sentence and has no body
  // field to put it in. The property is unchanged and is asserted in both
  // halves: the body is still `=== true` and nothing merely truthy, and the
  // branch still gates on it.
  assert.match(w, /let eRemove = eb && eb\.remove === true;/,
    "the route no longer reads the removal off the body, or reads it loosely");
  assert.match(branch, /if \(eRemove\) \{/, "the page branch never reads the removal");
  assert.match(branch, /mergeAddonPages\(eSrc, \[\], \[target\.path\]\)/,
    "the removal does not go through the merge that holds the guards");
  // THE WHOLE POINT: it returns before the model call. If `generateSitePages`
  // appears above the merge, the cheap path is not cheap.
  assert.equal(/generateSitePages/.test(branch), false,
    "a deletion still pays for page generation");
  assert.match(branch, /cost: 0/, "a deletion that generated nothing must not be billed as if it had");
  // And the client sends it as a real boolean, or something truthy on the wire
  // takes a page away.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /remove: d\.remove === true/, "the client never sends it, or sends it loosely");
  assert.match(chat, /Took ' \+ \(gone/, "the customer is not told the page went");
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
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const client = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
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

test("the tool description asks for `remove` on exactly the removable layers", () => {
  // The schema is what the model reads; if it offers the field for a layer the
  // reader drops, the model answers a question nobody listens to.
  const desc = ASK_TOOL.input_schema.properties.remove.description;
  for (const layer of REMOVABLE_LAYERS) {
    assert.ok(desc.includes('"' + layer + '"'), "the remove field never mentions layer " + layer);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// A FALLBACK MUST SAY IT IS ONE. `routeMessage` computes failed:true when the
// routing model itself threw, and the worker dropped it — so an Anthropic
// outage answered {ok:true, intent:"addon"} wearing the costume of a real
// routing decision, on the one route whose never-5xx design makes a response
// field the only possible signal (2026-08-13 audit; the 2026-08-12 billing
// outage cost a whole diagnosis for exactly this reason).
test("the route response carries `failed` when the routing model threw", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // Windowed to the NEXT feature's landmark, not a byte count — a byte window
  // here was 3k short on its first run because the handler is well-commented,
  // which is this repo's recorded overlapping-window trap.
  const at = w.indexOf('"/api/site/route"');
  const end = w.indexOf("Website builder — provision this site's database", at);
  assert.ok(at > 0 && end > at, "the route handler's anchors moved — retarget this guard");
  const win = w.slice(at, end);
  assert.match(win, /failed:\s*routed\.failed === true \|\| undefined/,
    "the routing fallback flag is dropped again — an outage reads as a decision");
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

// EVERY FIELD `readEdit` READS MUST REACH THE ROUTE — derived from the FUNCTION'S
// SOURCE, not from inputs somebody remembered to drive.
//
// The sweep below it drives `readEdit` and collects the keys it RETURNS, which
// is derived at one end and hand-listed at the other: it drove `{}` and
// `{remove: true}`, so a field the model can send and nobody thought to pass in
// never appears in the result and the guard stays green. `rename` went straight
// through it. Reading the function for `input.<name>` cannot miss one, because
// the read is the thing that makes the field exist at all.
test("every field readEdit READS off the model is forwarded by the route", () => {
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export function readEdit"));
  const fn = body.slice(0, body.indexOf("\n}\n"));
  assert.ok(fn.length > 200, "the readEdit window is empty — the anchor moved");
  const read = new Set([...fn.matchAll(/\binput\.([a-zA-Z][\w$]*)/g)].map((m) => m[1]));
  assert.ok(read.has("rename") && read.has("remove") && read.has("page"),
    "the scan sees no fields at all — readEdit changed shape, rescope this");
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const resp = worker.slice(worker.indexOf("intent: routed.intent,"));
  const window = resp.slice(0, resp.indexOf("usage: routed.usage"));
  for (const field of read) {
    assert.match(window, new RegExp("\\b" + field + ":\\s*routed\\."),
      `readEdit reads \`${field}\` off the model and the route never sends it — the edit lane cannot act on it`);
  }
});

test("the composer carries the new address to the edit route", () => {
  // The other end of the same wire. Either alone passes while it is cut, which
  // is the state `remove` was found in.
  const client = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(client, /rename:\s*typeof d\.rename === "string"/,
    "the composer no longer carries the new address to the edit route");
});

test("THE PAGE BRANCH ACTUALLY MOVES THE PAGE, and spends no model call doing it", () => {
  // The layer below every test above. `renameRoute` was written, committed,
  // tested and had ZERO CALLERS — correct and unreachable — which is the exact
  // failure this guard exists to make impossible to repeat.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /import \{[^}]*\brenameRoute\b[^}]*\} from "\.\/builder\/site-apply\.mjs"/,
    "renameRoute is used without being imported — a ReferenceError on the edit path");
  const at = worker.indexOf("const wantRename =");
  assert.ok(at > 0, "the rename branch is gone from the page layer");
  // BOUNDED BY THE BRANCH'S OWN CLOSING BRACE, not by whatever happens to come
  // next. This ran to `const eDb = await siteBackendBySlug` — a landmark far
  // below — so the cheap tweak rung inserted between the two landed INSIDE the
  // window and the "a rename makes no model call" assertion went red about a
  // model call in a different branch. That is this repo's most-repeated
  // own-goal, and the fix is a window that cannot be outrun by an insertion.
  const branch = (() => {
    const open = worker.indexOf("if (wantRename) {", at);
    if (open < 0) return "";
    let depth = 0;
    for (let i = worker.indexOf("{", open); i < worker.length; i++) {
      if (worker[i] === "{") depth++;
      else if (worker[i] === "}" && --depth === 0) return worker.slice(at, i + 1);
    }
    return "";
  })();
  assert.ok(branch.length > 200, "the rename window is empty — the anchor moved");
  // …and it really did stop before the next thing, or the bound proves nothing.
  assert.ok(!branch.includes("const eDb = await siteBackendBySlug"),
    "the rename window still runs past the branch it is meant to bound");
  assert.match(branch, /renameRoute\(eSrc, wantRoute, wantRename, routeOf\)/,
    "the branch never calls the renamer");
  // THE REDIRECT PAIR IS THE POINT. Without it the publish sees a delete plus an
  // add and 301s the old address to the home page — the customer's indexed links
  // land on the wrong page, which is the whole reason renameRoute returns one.
  assert.match(branch, /renamed: rn\.redirect/,
    "the move publishes without its redirect pair — the old address 301s to home");
  // AND IT IS FREE. A path is not prose: the router has already resolved which
  // page and where it is going, so there is nothing for a model to work out —
  // the same argument the deletion branch above it makes.
  assert.ok(!/generateSitePages|anthropicMessages/.test(branch),
    "the rename branch makes a model call — a path needs no generation");
  assert.match(branch, /cost: 0/, "a rename is billed as though something was generated");
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
  assert.deepEqual(readAlso({ alsoAsked: ["a", "b"] }), {});
  assert.deepEqual(readAlso({ alsoAsked: 7 }), {});
  assert.deepEqual(readAlso({ alsoAsked: {} }), {});
  assert.deepEqual(readAlso({ alsoAsked: true }), {});
});

test("it is bounded — one more sentence, not a second brief", () => {
  const long = "x".repeat(MAX_ALSO_CHARS + 200);
  assert.equal(readAlso({ alsoAsked: long }).alsoAsked.length, MAX_ALSO_CHARS);
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

test("the tool tells the model to stay silent when unsure", () => {
  // The whole design constraint: nothing branches on this, so over-reporting
  // costs the customer a sentence about something they did not ask for — which
  // reads as the builder misunderstanding them, and is worse than the miss.
  const d = ASK_TOOL.input_schema.properties.alsoAsked.description;
  assert.match(d, /ALMOST ALWAYS LEAVE THIS OUT/);
  assert.match(d, /When in doubt, say nothing/);
  // AND IT NAMES THE DISTINCTION THAT DECIDES IT: two things said about one
  // change is still one change.
  assert.match(d, /DIFFERENT part of the site/);
  assert.match(d, /in their own words/);
  assert.equal(ASK_TOOL.input_schema.properties.alsoAsked.type, "string");
  // Never required — a leftover is the exception, not the shape of every turn.
  assert.ok(!(ASK_TOOL.input_schema.required || []).includes("alsoAsked"));
});

test("the wire is not cut, at either end", () => {
  // THE THIRTEENTH FIELD OF THIS SHAPE. Twelve have been decided correctly and
  // dropped between `readRouting` and the client, and from outside "the model
  // did not set it" and "we did not forward it" are the same `undefined`.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("question: routed.intent === \"clarify\"");
  assert.ok(at > 0, "the routing response literal moved");
  const block = w.slice(w.lastIndexOf("intent: routed.intent", at), at);
  assert.match(block, /alsoAsked: typeof routed\.alsoAsked === "string"/);

  // And the CLIENT renders it — on both rungs, since either can drop half a
  // message. Asserted as the count, because one `finish` learning it and the
  // other not is exactly how half this feature would ship dead.
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  // AND IT SAYS SOMETHING. Asserting the function EXISTS and is CALLED passes
  // perfectly against one that returns "" — the works-but-cannot-say-so disease
  // one layer further out, and a mutant proved it. The sentence must carry the
  // customer's own words and tell them what to do with them.
  const tailAt = c.indexOf("function alsoTail(d)");
  assert.ok(tailAt > 0, "alsoTail is gone");
  const tail = c.slice(tailAt, c.indexOf("\n}", tailAt));
  assert.match(tail, /return[^;]*\balso\b/, "alsoTail never returns the leftover itself");
  assert.match(tail, /I only did one thing this time/, "the sentence that explains one change per turn is gone");
  assert.match(tail, /I\\u2019ll do that next/, "the sentence does not say what happens if they send it back");
  // THE PROPERTY, NOT THE SPELLING — the sibling guard on `renderTail` was
  // pinned to an exact expression and went red the moment this tail was added
  // beside it. What must hold is that BOTH replies carry it, since one `finish`
  // learning it and the other not is exactly how half a feature ships dead.
  // `o.finish(...)` SINCE 2026-09-01: the edit reply is rendered by
  // `applyEditResult`, which both the synchronous and the queued path call —
  // the queued one having had its own copy that carried this correctly and got
  // the escalate and the undo wrong. Matched on the shape rather than the
  // receiver's name, so it reads the same either side of that move.
  assert.match(c, /finish\(editReply\(e\)[^;]*alsoTail\(o?\.?d\)/, "the edit reply drops the leftover");
  assert.match(c, /finish\(addonReplyText\(a\)[^;]*alsoTail\(d\)/, "the addon reply drops the leftover");
  // The addon lane had no routing decision in scope at all until this landed.
  assert.match(c, /function siteAddon\(site, instruction, origin, finish, fallback, d\)/);
  assert.match(c, /siteAddon\(site, t, origin, finish, go, d\)/);
});

// ── WHICH LANES THE LIVE CHECK ACTUALLY DRIVES ──────────────────────────────

test("every edit layer is driven by the live check, or is named as a known gap", () => {
  // `edit smoke` drove FOUR of the eight layers — data, look, page, rules — so
  // half the edit path had unit tests, mutation sweeps and no live proof at all.
  // That gap is invisible from either end: the lanes pass their own tests and
  // the check passes its own assertions, and nothing compares the two lists.
  //
  // DERIVED FROM BOTH SIDES rather than a count somebody remembers to bump, so
  // a NINTH layer added later is covered here without anybody thinking of it —
  // which is exactly how the first four came to be the only ones.
  const t = fs.readFileSync(new URL("../test/integration/edit-smoke.mjs", import.meta.url), "utf8");
  const driven = new Set([...t.matchAll(/layer: "([a-z]+)"/g)].map((m) => m[1]));

  // THE ONE STILL UNCOVERED, NAMED RATHER THAN LEFT AS A SILENT ABSENCE. The
  // picture lane swaps a `SafeImage` slot to a photograph, and both ways of
  // getting one are unavailable to a check: buying costs real fal money on an
  // empty balance, and reusing an owner upload means chaining this to whatever
  // an earlier step happened to store. A named gap is a decision; an unnamed one
  // is the state this test exists to end.
  // ── `rename` JOINED THE GAP LIST 2026-08-29, AND IT IS WRITTEN DOWN ───────
  //
  // ONE REASON NOW. The first — that `site_aliases` did not exist — was retired
  // on 2026-08-30 when the table was created by hand (there is no migration
  // runner here). Kept in the history rather than deleted because the DEGRADE it
  // describes is still live and still deliberate: `aliasRowFor` answers null on
  // any read failure and `resolveAlias` reads a null row as "no alias", so the
  // platform falls back to its pre-alias behaviour instead of erroring.
  //
  // The reason that remains: a live rename CLAIMS a real
  // address on the real platform and leaves a real site answering at a new name.
  // Every other layer's live check is undoable; this one would litter the
  // namespace with test names that can never be released, because releasing them
  // is precisely what the old-name-stays-claimed rule forbids.
  const KNOWN_GAPS = ["picture", "rename"];
  const missing = EDIT_LAYERS.filter((l) => !driven.has(l) && !KNOWN_GAPS.includes(l));
  assert.deepEqual(missing, [],
    "these lanes have no live proof at all: " + missing.join(", "));

  // AND THE GAP LIST MAY NOT GROW QUIETLY EITHER — a layer added to it is a
  // decision to ship something unproven, which should have to be written down.
  assert.ok(KNOWN_GAPS.length <= 2, "more lanes are being shipped without live proof");
  // The floor: a scan that stopped matching would report full coverage.
  assert.ok(driven.size >= EDIT_LAYERS.length - KNOWN_GAPS.length,
    "the scan found only " + driven.size + " layers in the live check");
  for (const l of driven) {
    assert.ok(EDIT_LAYERS.includes(l), "the live check drives a layer that does not exist: " + l);
  }
});

// THE SIZE POLICY FOR A SITE'S CONVERSATION — ITS NUMBERS, WHERE EACH COMES
// FROM, AND THAT EVERY MODEL REQUEST CARRIES THE WHOLE MESSAGE (2026-10-03).
//
// Owner: *"remove the arbitrary 2,000-character request and 500-character
// clarification-answer restrictions throughout the affected browser, server,
// model-input, persistence, queue, and resume paths; do not merely replace
// silent clipping with rejection at those same numbers or raise one constant
// while another hop still cuts the input. Use a consistent technical size
// policy supported by actual request, storage, and model-context constraints,
// and document its rationale."*
//
// This file holds the policy's own claims against the code that sets each
// constraint (the stored answer's bound, the routing route's body cap, the
// models' windows and output limits), the page's copy of the numbers against
// the server's, and every step's model request against a message whose last
// words are the ones that matter. The routes, the queue and the page are driven
// in test/input-handoffs.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { MAX_INPUT_CHARS, MAX_CARRIED_CHARS, REWRITE_MAX_CHARS, ECHO_CHARS_PER_TOKEN, echoTokens, carriedChars } from "../builder/input-budget.mjs";
import { MODEL_LIMITS } from "../builder/build-models.mjs";
import { MAX_ATTACHMENTS } from "../builder/site-context.mjs";
import { askRequest, routeMessage, ASK_MAX_TOKENS, MAX_MESSAGE, MAX_ANSWER_CHARS, readContext, appendAnswer, heldList } from "../builder/site-ask.mjs";
import { textRequest, dataRequest } from "../builder/site-apply.mjs";
import { rulesRequest } from "../builder/site-rules.mjs";
import { navRequest } from "../builder/site-nav.mjs";
import { pictureRequest } from "../builder/site-picture.mjs";
import { tweakRequest } from "../builder/site-tweak.mjs";
import { renameRequest } from "../builder/site-alias.mjs";
import { keepRequest } from "../builder/page-keep.mjs";
import { pickRequest as lanePickRequest, editRequest, takeOffRequest, pickLanes, LANE_PICK_MAX_TOKENS } from "../builder/site-lanes.mjs";
import { pickRequest as addPickRequest, addRequest, MAX_MESSAGE as ADD_MAX_MESSAGE } from "../builder/site-add.mjs";
import { packAsk } from "../builder/clarify.mjs";
import { MAX_RESUME_DEFERRED_CHARS } from "../builder/build-resume.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const WORKER = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

/** A message well past the old 2,000 whose LAST words are the instruction that matters. */
const END = "Then change the site's search description to “Overnight sourdough from a Bristol side street”.";
const LONG = "Some background before the change, so you know the shop: ".repeat(60) + END;
const text = (req) => {
  const m = req && req.messages && req.messages[req.messages.length - 1];
  const c = m && m.content;
  return typeof c === "string" ? c : JSON.stringify(c || "");
};

test("THE TWO NUMBERS: one message is 16,000 characters and one request carries 48,000 — far past the old 2,000 and 500, and the request still has room for answers", () => {
  assert.equal(MAX_INPUT_CHARS, 16000);
  assert.equal(MAX_CARRIED_CHARS, 48000);
  assert.ok(LONG.length > 2000 && LONG.length < MAX_INPUT_CHARS, "the test message is not past the old cut and inside the policy: " + LONG.length);
  assert.ok(MAX_CARRIED_CHARS >= 3 * MAX_INPUT_CHARS, "a request at the bound would have no room for its answers");
  // AN ANSWER IS ONE MESSAGE, and a first build's own bound is untouched.
  assert.equal(MAX_ANSWER_CHARS, MAX_INPUT_CHARS);
  assert.equal(MAX_MESSAGE, 2000, "a first build's bound moved: the build is unchanged");
});

test("WHY THESE NUMBERS — each constraint the rationale cites is read from the code that sets it, and the arithmetic holds", () => {
  // 1. THE STORED ANSWER OF A QUEUED JOB (`edit_finalize`): the binding one.
  const store = WORKER.match(/p_result: \{ status: res\.status, type: [^}]*body: bodyText\.slice\(0, (\d+)\)/);
  assert.ok(store, "the stored answer's bound could not be found in worker.js");
  const storeBound = Number(store[1]);
  assert.equal(storeBound, 200000);
  // replyFor (the carried whole) + four message-sized copies + pages and reply + the largest stored answer measured.
  const worst = MAX_CARRIED_CHARS + 4 * MAX_INPUT_CHARS + 6000 + 27961;
  assert.ok(worst < storeBound * 0.75, "a job's stored answer could come within a quarter of its bound: " + worst);
  // 2. THE ROUTING ROUTE'S BODY.
  const routeAt = WORKER.indexOf('url.pathname === "/api/site/route" && request.method === "POST"');
  const cap = WORKER.slice(routeAt, routeAt + 1200).match(/tooLargeBody\(request, ([\d_]+)\)/);
  assert.ok(routeAt > 0 && cap, "the routing route's body cap could not be found");
  assert.ok(MAX_INPUT_CHARS * 6 < Number(cap[1].replace(/_/g, "")) / 10, "one message at its worst encoding is not small beside the routing route's cap");
  // 3. THE MODELS' WINDOWS: the page writer's own content and answer, plus the carried whole, against the smallest.
  const smallest = Math.min(...Object.values(MODEL_LIMITS).map((m) => m.context));
  assert.equal(smallest, 500000);
  assert.ok(Math.ceil((90000 + 36000 + 16000 + MAX_CARRIED_CHARS) / 3) + 30000 < smallest / 4, "the largest call would pass a quarter of the smallest window");
  // 4. WHAT A MODEL COPIES BACK: the router's and the picker's ceilings at the bound fit every picker's stated output limit.
  const outFloor = Math.min(...Object.values(MODEL_LIMITS).map((m) => m.maxOutput).filter(Number.isFinite));
  assert.ok(Number.isFinite(outFloor));
  assert.ok(ASK_MAX_TOKENS + echoTokens("x".repeat(MAX_INPUT_CHARS)) <= outFloor, "the router's ceiling at the bound passes a picker's output limit");
  assert.ok(LANE_PICK_MAX_TOKENS + echoTokens("x".repeat(MAX_INPUT_CHARS)) <= outFloor, "the picker's ceiling at the bound passes a picker's output limit");
});

test("THE PAGE READS THE SAME NUMBERS: one message, one request, the rewrite's read and the files one request carries", () => {
  assert.equal(EditPoll.ASK_MAX, MAX_INPUT_CHARS);
  assert.equal(EditPoll.CARRIED_MAX, MAX_CARRIED_CHARS);
  assert.equal(EditPoll.REWRITE_MAX, REWRITE_MAX_CHARS);
  const files = CHAT.match(/\nconst SITE_MAX_FILES = (\d+);\n/);
  assert.ok(files, "the page's file limit could not be found");
  assert.equal(Number(files[1]), MAX_ATTACHMENTS);
  // AND THE REWRITE'S READ IS THE CONSTANT, its value unchanged (the build is unchanged).
  const at = WORKER.indexOf("\nfunction buildHeld(body) {");
  const body = WORKER.slice(at, WORKER.indexOf("\n}\n", at));
  assert.ok(at > 0 && body.includes(".slice(0, REWRITE_MAX_CHARS)"), "the rewrite's read is not the named bound");
  assert.equal(REWRITE_MAX_CHARS, 4000);
  // A HELD PART, THE BUILD'S RESUME RECORD AND THE ADD-ON HARNESS: one message.
  assert.equal(MAX_RESUME_DEFERRED_CHARS, MAX_INPUT_CHARS);
  assert.equal(ADD_MAX_MESSAGE, MAX_INPUT_CHARS);
  assert.deepEqual(heldList(["x".repeat(MAX_INPUT_CHARS)]), ["x".repeat(MAX_INPUT_CHARS)]);
  assert.equal(heldList(["x".repeat(MAX_INPUT_CHARS + 1)]), null);
});

test("WHAT A REQUEST CARRIES is the request, every put-off part and every question and answer; the room to copy words back grows with the words", () => {
  assert.equal(carriedChars({ request: "abcd", held: ["ef", "g"], context: [{ q: "Which?", a: "That" }, { q: "Q", a: "A", handled: true }] }), 4 + 3 + 10 + 2);
  assert.equal(carriedChars({ request: "abc", held: "de" }), 5);
  assert.equal(carriedChars({ request: 7, held: [3, "xy"], context: [null, "z", { q: 1, a: "ok" }] }), 4, "something that is not text was counted");
  assert.equal(carriedChars(), 0);
  assert.equal(ECHO_CHARS_PER_TOKEN, 2);
  assert.equal(echoTokens("x".repeat(9)), 5);
  assert.equal(echoTokens("ab", "x".repeat(100)), 50, "the longest text a model may copy sets the room");
  assert.equal(echoTokens(), 0);
});

test("EVERY STEP'S MODEL REQUEST CARRIES THE WHOLE MESSAGE — its last words, past the old 2,000, reach the model that acts on them", () => {
  const each = {
    "text step": textRequest({ instruction: LONG, items: [{ path: "index.tsx", text: "Bread from the harbour" }] }),
    "data step": dataRequest({ instruction: LONG, tables: [], recent: [], lists: [] }),
    "rules step": rulesRequest({ instruction: LONG, tables: [] }),
    "menu step": navRequest({ instruction: LONG, slots: [], routes: ["/"], actions: [], links: [], contacts: [], lists: [], layouts: [], seconds: [] }),
    "picture step": pictureRequest({ instruction: LONG, slots: [], library: [] }),
    "quick writer": tweakRequest({ instruction: LONG, path: "index.tsx", source: "export default function Page() { return null; }" }),
    "address change": renameRequest({ message: LONG, current: "harbour-loaf", former: [] }),
    "keep check": keepRequest({ message: LONG, items: [] }),
    "lane picker": lanePickRequest({ message: LONG, current: "Its pages are: /." }),
    "a look lane": editRequest({ field: "description", message: LONG, value: "Neighbourhood sourdough.", model: "m" }),
    "a take-off": takeOffRequest({ field: "langs", message: LONG, value: ["fr"], model: "m" }),
    "add-on picker": addPickRequest({ message: LONG, model: "m" }),
    "add-on designer": addRequest({ kind: "component", message: LONG, site: { name: "Harbour Loaf", pages: ["/"] }, model: "m" }),
    "router, a site that exists": askRequest({ message: LONG, site: { name: "Harbour Loaf", pages: ["/"] }, hasSite: true, live: true }),
  };
  for (const [name, req] of Object.entries(each)) {
    assert.ok(text(req).includes(LONG), name + " did not carry the whole message: it ends " + JSON.stringify(text(req).slice(-80)));
  }
  // A FIRST BUILD IS CUT TO ITS OWN BOUND, AS IT ALWAYS WAS.
  const build = text(askRequest({ message: LONG, site: {}, hasSite: false }));
  assert.ok(build.includes(LONG.slice(0, MAX_MESSAGE)) && !build.includes(END), "a first build's message is no longer cut to its own bound");
});

test("ROOM TO COPY THE CUSTOMER'S WORDS BACK: the router's and the picker's ceilings grow with the message; a first build's is unchanged", () => {
  const site = { name: "Harbour Loaf", pages: ["/"] };
  assert.equal(askRequest({ message: LONG, site, hasSite: true, live: true }).max_tokens, ASK_MAX_TOKENS + echoTokens(LONG));
  const waiting = { request: "y".repeat(9000), question: { text: "Which?", options: [] } };
  assert.equal(askRequest({ message: "the first", site, hasSite: true, live: true, pending: waiting }).max_tokens, ASK_MAX_TOKENS + echoTokens(waiting.request),
    "a held-back part of the waiting request has no room to be copied");
  assert.equal(askRequest({ message: LONG, site: {}, hasSite: false }).max_tokens, ASK_MAX_TOKENS, "a first build's ceiling moved");
  // TWICE THE COPY ROOM SINCE THE LANE CAP WENT (2026-10-03): every change's own
  // words and every part no lane here can make (`elsewhere`) are copied back.
  assert.equal(lanePickRequest({ message: LONG }).max_tokens, LANE_PICK_MAX_TOKENS + 2 * echoTokens(LONG));
});

test("AN ANSWER CUT OFF AT ITS CEILING IS NO ANSWER: the router fails the call on a site that exists, the picker fails as a call that did not answer", async () => {
  const cut = (input) => ({ stop_reason: "max_tokens", content: [{ type: "tool_use", name: "route_message", input }], usage: { input_tokens: 9, output_tokens: 700 } });
  const r = await routeMessage({ send: async () => cut({ intent: "addon", alsoAsked: "and make the foo" }) }, { message: "Add a gallery and make the footer green", site: { pages: ["/"] }, hasSite: true });
  assert.equal(r.failed, true, "a cut routing answer was acted on: " + JSON.stringify(r));
  assert.equal(r.usage, null, "a cut answer was billed");
  assert.ok(r.decision.reasons.includes("answer-cut"));
  assert.equal(r.alsoAsked, undefined, "half a held-back part survived");
  // A FIRST BUILD READS ITS ANSWER EXACTLY AS BEFORE.
  const b = await routeMessage({ send: async () => ({ ...cut({ intent: "build" }) }) }, { message: "a bakery site", site: {}, firstBuild: true });
  assert.notEqual(b.failed, true, "a first build's answer is now refused for its stop reason");
  const p = await pickLanes({ send: async () => ({ stop_reason: "max_tokens", content: [{ type: "tool_use", name: "pick_lanes", input: { fields: ["description"] } }] }) }, { message: "change the description" });
  assert.equal(p.failed, true, "a cut lane pick was acted on");
  assert.deepEqual(p.fields, []);
  assert.equal(p.error && p.error.truncated, true);
});

test("THE ANSWERS A REQUEST KEEPS: one past the old 500 is kept whole; one past one message is refused, never cut", () => {
  const a = "We open at 7 on weekdays and 8 at weekends, " + "and the counter is on the left as you come in, ".repeat(20) + "so put the band under the hours.";
  assert.ok(a.length > 500);
  assert.deepEqual(readContext([{ q: "Which band?", a }]), [{ q: "Which band?", a }]);
  assert.deepEqual(appendAnswer([], { q: "Which band?", a }), [{ q: "Which band?", a }]);
  assert.equal(readContext([{ q: "Which band?", a: "x".repeat(MAX_INPUT_CHARS + 1) }]), null);
  assert.equal(appendAnswer([], { q: "Which band?", a: "x".repeat(MAX_INPUT_CHARS + 1) }), null);
  // AND A STORED QUESTION KEEPS A REQUEST PAST THE OLD 2,000 WHOLE.
  const rec = packAsk({ id: "a".repeat(32), uid: "u", slug: "harbour-loaf", stage: "route", round: 1, question: { text: "Which band?" }, request: LONG, at: Date.now(), context: [{ q: "Which band?", a }] });
  assert.ok(rec, "a request inside the policy could not be stored");
  assert.equal(rec.request, LONG);
  assert.equal(rec.context[0].a, a);
});

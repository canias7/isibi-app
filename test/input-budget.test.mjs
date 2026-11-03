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
import { readContext, appendAnswer, heldList } from "../builder/route-shared.mjs";
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

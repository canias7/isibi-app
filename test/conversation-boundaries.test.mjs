// WHERE TALK ENDS AND WORK BEGINS (2026-10-15, the conversation batch): the
// real route (`POST /api/site/route`), its storage, and the model wire
// supplied (`test/fixtures/live-ask.mjs`).
//
// What a real model decides, and what it writes, is a live reading (the
// `converse` mode of `scripts/media-verify.mjs`). These cases pin what the
// route does with each decision, and what each model is shown so that it can
// decide well:
//   - discussing and refining a plan is answered by the reply's own call, and
//     starts nothing;
//   - a clear follow-up ("use the second idea") runs the request written out
//     from the conversation, with no conversational reply and no question
//     back — and the idea it leans on, past 800 characters of a long reply, is
//     shown to the router whole;
//   - "do that on every page" is answered from the site's own page list;
//   - an ambiguous or unavailable reference is "ask", and the reply is told
//     exactly what to ask about;
//   - a cut history is said to both models;
//   - returning from a side question: the question waited through it, and the
//     answer that follows is the answer to it.
// No sentence a model writes is asserted: only what was shown, what ran, and
// what stayed open.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { freshSlug, bucket, question, seedQuestion, withWire, envFor, routeCall, ROUTES } from "./fixtures/live-ask.mjs";
import { ROUTER_TURN_CHARS, ROUTER_LAST_REPLY_CHARS, routerHistory, CONVERSE_SYSTEM } from "../builder/site-converse.mjs";
// THE REPLY'S MESSAGE IS BLOCKS WHEN IT CARRIES A CONVERSATION (2026-10-20, so
// each reply reuses the last one's cache); its words are the blocks' words, in order.
const textOf = (req) => { const c = req.messages[0].content; return typeof c === "string" ? c : c.map((b) => b.text).join("\n"); };

const workStarted = (seen) => seen.rpc.filter((r) => /edit_(claim|reserve|publish|create)/.test(r.fn)).length + seen.lanes.length + seen.writers.length + seen.pageWriters.length + seen.designers.length + seen.picks.length;

// A REPLY WITH FIVE NUMBERED IDEAS, the second of which starts well past the
// router's ordinary 800 characters for a turn.
const pad = " It suits a bakery whose loaves sell out early, and it reads well on a phone, where most of your visitors arrive.";
const IDEAS = "Here are five headline ideas for your home page, each with why it might work.\n\n" +
  "1. **Bread at dawn.**" + pad.repeat(8) + "\n\n" +
  "2. **Baked while the harbour sleeps.**" + pad.repeat(3) + "\n\n" +
  "3. **Sourdough from the side street.**" + pad + "\n\n" +
  "4. **Collect it warm.**" + pad + "\n\n" +
  "5. **Your loaf, held for you.**" + pad;
const IDEAS_THREAD = [
  { role: "user", text: "Give me some headline ideas for my home page." },
  { role: "assistant", text: IDEAS },
];

test("THE ROUTER SEES THE LATEST REPLY WHOLE: an idea past 800 characters is in its window, and older turns keep their 800", () => {
  assert.ok(IDEAS.indexOf("2. **Baked") > ROUTER_TURN_CHARS, "the fixture does not put the second idea past the ordinary cut");
  assert.ok(IDEAS.length < ROUTER_LAST_REPLY_CHARS, "the fixture is longer than the latest reply's room");
  const shown = routerHistory([{ role: "assistant", text: "x".repeat(2000) }, ...IDEAS_THREAD]);
  const last = shown.turns.at(-1);
  assert.equal(last.text, IDEAS, "the latest reply was cut for the router");
  assert.equal(last.cut, undefined);
  // AN OLDER ASSISTANT TURN KEEPS ITS ORDINARY CUT.
  assert.equal(shown.turns[0].text.length, ROUTER_TURN_CHARS);
  assert.equal(shown.turns[0].cut, true);
});

test("THE REPLY'S INSTRUCTIONS: natural length, no stock enthusiasm, numbered options, no redundant confirmation — and no fixed reply anywhere in them", () => {
  assert.match(CONVERSE_SYSTEM, /Match the length to the need/);
  assert.match(CONVERSE_SYSTEM, /no stock openings/);
  assert.match(CONVERSE_SYSTEM, /number them, so they can answer/);
  assert.match(CONVERSE_SYSTEM, /Do not\s+end every reply with a question or an offer/);
  // THE REPLY IS THE MODEL'S: nothing in the instructions is a sentence to send as is.
  assert.doesNotMatch(CONVERSE_SYSTEM, /reply with exactly|always say|respond with "/i);
});

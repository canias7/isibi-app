// PARKED (2026-11-03, park-old-way): the old-way half of test/conversation.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE CONVERSATION'S OWN PIECES (2026-10-14, the owner's two-area batch).
//
// Owner: *"Make the assistant naturally helpful, conversational and
// appropriately detailed … Connect normal conversation history … preserving
// roles, project isolation and honest context limits … Never claim
// inspection, browsing or execution that did not happen."*
//
// What these establish: the history the page sends is windowed and every cut
// said; the reply's call has its own ceiling and the router's does not grow
// for it; the reply is told what it knows and what it did not do; the site is
// described without a row; the page draws the reply's small Markdown with
// nothing else let through. What they cannot: what a real model writes. That
// is a live reading, not one of these.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  readHistory, routerHistory, historyBlock, converseRequest, readConverse, converse, siteContextBlock, attachedBlock,
  CONVERSE_MAX_TOKENS, CONVERSE_SYSTEM, CAPABILITIES, HONESTY, HISTORY_TURNS, HISTORY_CHARS, ROUTER_HISTORY_TURNS,
} from "../../../builder/site-converse.mjs";
import { askRequest, ASK_MAX_TOKENS, RESOLVED_TOKENS } from "../builder/site-ask.mjs";
import { echoTokens } from "../../../builder/input-budget.mjs";

const ChatTalk = createRequire(import.meta.url)("../../../public/chat-talk.js");

test("the reply's call has its own ceiling, and the router's does not grow without a conversation", () => {
  const req = converseRequest({ message: "Compare a booking page with an enquiry form", model: "m" });
  assert.equal(req.max_tokens, CONVERSE_MAX_TOKENS);
  assert.ok(CONVERSE_MAX_TOKENS > ASK_MAX_TOKENS * 2, "the reply has no more room than the router");
  assert.equal(req.tools, undefined, "the reply's call is forced into a tool");
  const plain = askRequest({ message: "hi", site: {} });
  assert.equal(plain.max_tokens, ASK_MAX_TOKENS, "a routing call with no conversation grew");
  const withTalk = askRequest({ message: "do that", site: {}, history: { turns: [{ role: "assistant", text: "I could add a gallery." }], left: 0 } });
  // …and twice the longest shown turn, to restate it and copy held parts from it (2026-10-23, audit A36-3).
  assert.equal(withTalk.max_tokens, ASK_MAX_TOKENS + RESOLVED_TOKENS + 2 * echoTokens("I could add a gallery."), "a routing call shown a conversation has no room to write the request out");
});

test("the capabilities say what is known, what is not offered, and to be honest about the rest", () => {
  assert.match(CAPABILITIES, /NOT OFFERED today/);
  assert.match(CAPABILITIES, /ANYTHING ELSE you are asked about is something you are not sure of/);
  assert.match(CAPABILITIES, /never flatly say it is impossible when you only do not know/);
  assert.doesNotMatch(CAPABILITIES, /It cannot do anything else/, "the blanket refusal is back");
  // The router reads the same statement, so the two never describe two products.
  // THE ROUTER HAS NO CAPABILITIES LIST (owner, 2026-11-02): it does not answer the owner.
  assert.ok(!askRequest({ message: "hi", site: {} }).system[0].text.includes(CAPABILITIES), "the router describes the product again");
  assert.doesNotMatch(askRequest({ message: "hi", site: {} }).system[0].text, /It cannot do anything else/);
});

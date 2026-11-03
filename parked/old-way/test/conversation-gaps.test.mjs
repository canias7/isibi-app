// PARKED (2026-11-03, park-old-way): the old-way half of test/conversation-gaps.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// WHAT THE PAGE CUT FROM THE CONVERSATION IS SAID, END TO END (2026-10-15,
// Codex's review of `7ca339d1`).
//
// Codex: `historyWire` cuts each message to 4,000 characters and drops the
// earlier turns before `readHistory` sees them, so the models were shown
// those prefixes as complete. Now the page sends what it cut — `full` on a
// cut turn, `{ omitted: n }` opening the list — the server checks both, and
// both the router and the reply are told, with the rule that a reference to
// a part not shown is asked about, never guessed. These cases drive the
// page's own `historyWire` (`public/chat-talk.js`) into the real route.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadWorker } from "../../../test/fixtures/worker-harness.mjs";
import { freshSlug, bucket, withWire, envFor, routeCall } from "../../../test/fixtures/live-ask.mjs";
import { readHistory, routerHistory, historyBlock, HISTORY_TURN_CHARS } from "../../../builder/site-converse.mjs";
import { askRequest } from "../builder/site-ask.mjs";
// THE REPLY'S MESSAGE IS BLOCKS WHEN IT CARRIES A CONVERSATION (2026-10-20, so
// each reply reuses the last one's cache); its words are the blocks' words, in order.
const textOf = (req) => { const c = req.messages[0].content; return typeof c === "string" ? c : c.map((b) => b.text).join("\n"); };

const ChatTalk = createRequire(import.meta.url)("../../../public/chat-talk.js");
const workStarted = (seen) => seen.rpc.filter((r) => /edit_(claim|reserve|publish|create)/.test(r.fn)).length + seen.lanes.length + seen.writers.length + seen.pageWriters.length + seen.designers.length + seen.picks.length;

/** A project's thread as the page keeps it: 34 turns, the 33rd a long reply holding three versions of a headline. */
function thread() {
  const msgs = [];
  for (let i = 0; i < 32; i++) msgs.push({ r: i % 2 ? "a" : "u", t: (i % 2 ? "Reply " : "Question ") + i });
  const filler = " A sentence about the bakery's mornings.".repeat(140);
  msgs.push({ r: "a", t: "Here are three versions of your headline. Version one: Bread at dawn." + filler + " Version three: Loaves from the harbour wall." });
  msgs.push({ r: "u", t: "ok, use the third version you wrote" });
  return msgs;
}

test("THE MODELS ARE TOLD: the cut with its real length, the dropped turns counted, and to ask rather than guess", () => {
  const b = historyBlock(readHistory(ChatTalk.historyWire(thread(), "ok, use the third version you wrote")));
  assert.match(b, /\(3 earlier messages are not shown here\. Do not assume what they said\.\)/);
  assert.match(b, /\[cut: only the first 4000 of its \d{4,} characters are shown; the rest is not\]/);
  assert.match(b, /PARTS OF THIS CONVERSATION ARE NOT SHOWN/);
  assert.match(b, /do not guess or fill it in: say which part you cannot see and ask them to say it again/);
  assert.doesNotMatch(historyBlock(readHistory([{ role: "user", text: "hi" }])), /NOT SHOWN/, "a whole conversation was said to be cut");
  // THE ROUTER'S RULE FOR WRITING A REQUEST OUT.
  const req = askRequest({ text: "ok, use the third version you wrote", hasSite: true, site: { pages: [{ path: "/" }] }, history: ChatTalk.historyWire(thread(), "ok, use the third version you wrote") });
  const tool = req.tools[0].input_schema.properties.resolved.description;
  assert.match(tool, /NEVER write it from a part of the conversation marked as not shown/);
  assert.match(req.system.map((s) => s.text).join(""), /unless what it leans on is in a part of the conversation marked as not shown/);
});

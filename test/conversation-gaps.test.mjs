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
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { freshSlug, bucket, withWire, envFor, routeCall } from "./fixtures/live-ask.mjs";
import { readHistory, routerHistory, historyBlock, HISTORY_TURN_CHARS } from "../builder/site-converse.mjs";
import { askRequest } from "../builder/site-ask.mjs";
// THE REPLY'S MESSAGE IS BLOCKS WHEN IT CARRIES A CONVERSATION (2026-10-20, so
// each reply reuses the last one's cache); its words are the blocks' words, in order.
const textOf = (req) => { const c = req.messages[0].content; return typeof c === "string" ? c : c.map((b) => b.text).join("\n"); };

const ChatTalk = createRequire(import.meta.url)("../public/chat-talk.js");
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

test("THE PAGE SAYS WHAT IT CUT: a cut turn carries its whole length, and the dropped turns are counted ahead of the rest", () => {
  const wire = ChatTalk.historyWire(thread(), "ok, use the third version you wrote");
  assert.deepEqual(wire[0], { omitted: 3 }, "the turns the page dropped were not counted");
  assert.equal(wire.length, 31);
  const long = wire[wire.length - 1];
  assert.equal(long.role, "assistant");
  assert.equal(long.text.length, HISTORY_TURN_CHARS);
  assert.ok(long.full > HISTORY_TURN_CHARS, "a cut turn did not say its length");
  assert.doesNotMatch(long.text, /Version three/, "this case needs the third version to be in the cut");
  // NOTHING CUT, NOTHING SAID.
  assert.deepEqual(ChatTalk.historyWire([{ r: "u", t: "hi" }, { r: "a", t: "hello" }], "next"), [{ role: "user", text: "hi" }, { role: "assistant", text: "hello" }]);
});

test("THE SERVER READS IT STRICTLY: a believable count and length are kept; a figure that does not add up claims nothing", () => {
  const h = readHistory(ChatTalk.historyWire(thread(), "ok, use the third version you wrote"));
  assert.equal(h.left, 3, "the page's own count was lost");
  const last = h.turns[h.turns.length - 1];
  assert.deepEqual([last.cut, last.full > last.text.length], [true, true]);
  // A FORGED LENGTH no longer than the text is not a cut.
  assert.deepEqual(readHistory([{ role: "user", text: "whole", full: 3 }]).turns, [{ role: "user", text: "whole" }]);
  assert.deepEqual(readHistory([{ role: "user", text: "whole", full: "9000" }]).turns, [{ role: "user", text: "whole" }]);
  // THE COUNT ONLY OPENS THE LIST, AND ONLY AS AN INTEGER IN RANGE: anything else is one unreadable item.
  assert.equal(readHistory([{ role: "user", text: "a" }, { omitted: 5 }]).left, 1);
  assert.equal(readHistory([{ omitted: 2.5 }, { role: "user", text: "a" }]).left, 1);
  assert.equal(readHistory([{ omitted: 1e9 }, { role: "user", text: "a" }]).left, 1);
  assert.equal(readHistory([{ omitted: 4, role: "user" }, { role: "user", text: "a" }]).left, 1);
  // THE ROUTER'S SMALLER WINDOW cuts on top, and keeps the page's length.
  const r = routerHistory(ChatTalk.historyWire(thread(), "ok, use the third version you wrote"));
  const lastR = r.turns[r.turns.length - 1];
  assert.equal(lastR.full, h.turns[h.turns.length - 1].full, "the router lost the turn's real length");
  assert.equal(r.left, 3 + 30 - 8, "the router was not told how much it does not see");
});

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

test("THROUGH THE ROUTE: a reference into the cut part is asked about — both models are shown the gap, nothing runs, nothing is written out", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("gap");
  const store = bucket(slug);
  const history = ChatTalk.historyWire(thread(), "ok, use the third version you wrote");
  await withWire({
    // THE ROUTER DOES WHAT IT IS TOLD: "ask", with no `resolved`.
    route: { intent: "ask", answer: "I can't see the third version." },
    converse: "I can see the start of the versions I wrote, but not the third — could you paste it, or say which wording you'd like?",
  }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "ok, use the third version you wrote", extra: { history } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "ask");
    assert.equal(r.body.resolved, undefined);
    const routed = seen.routerAsked[0].messages[0].content;
    assert.match(routed, /\[cut: only the first \d+ of its \d{4,} characters are shown; the rest is not\]/, "the router took a cut turn for the whole");
    assert.match(routed, /earlier messages are not shown here/);
    assert.match(routed, /PARTS OF THIS CONVERSATION ARE NOT SHOWN/);
    const said = textOf(seen.converse[0]);
    assert.match(said, /\(3 earlier messages are not shown here/, "the reply was not told the page dropped turns");
    assert.match(said, /\[cut: only the first 4000 of its \d{4,} characters are shown; the rest is not\]/, "the reply took a cut turn for the whole");
    assert.doesNotMatch(said, /Version three/);
    assert.ok(r.body.decision.reasons.includes("history-cut"));
    assert.equal(workStarted(seen), 0, "a reference to a part nobody could see started work");
  });
});

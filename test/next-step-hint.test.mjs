// ONE OCCASIONAL NEXT STEP IN THE FINAL REPLY (2026-10-24, the owner's idea
// #24, adapted): the reply writer may sometimes add one soft next-step
// suggestion as an ordinary sentence of its reply, never a button or a list,
// decided by the model from the facts. It names the topic in `suggested`; the
// page keeps that on the chat's stored message, and the next reply is shown
// the last few so it does not repeat one. No sentence is written by code.
//
// These assert properties of the instructions (not their spelling), that the
// facts and context carry what a suggestion may stand on and what it must not
// repeat, that the marker round-trips from the writer's answer to the stored
// chat and back, and that a supplied answer's suggestion reaches the page as
// plain reply text only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  REPLY_SYSTEM, REPLY_TOOL, replyRequest, replyContext, readReply, writeReply, withReplyText,
  readReplyRecord, recentSuggestions, offMenuPages, suggestedOf, buildReplyFacts, editReplyFacts,
} from "../builder/site-reply.mjs";

import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const require = createRequire(import.meta.url);
const EditPoll = require("../public/edit-poll.js");
const WORKER = readFileSync(new URL("../worker.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

/** The writer's forced tool answer, as a provider returns it. */
const answer = (input) => ({ content: [{ type: "tool_use", name: REPLY_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });

/** The section of the instructions about a next step: found by its subject, never by its exact heading. */
function nextStepSection() {
  const parts = REPLY_SYSTEM.split(/\n\n/);
  const sec = parts.find((p) => /next step/i.test(p.split("\n")[0]));
  assert.ok(sec, "the reply writer's instructions have no section about a next step");
  return sec.toLowerCase();
}

test("THE RULES: optional, model-decided, at most one, a sentence not a button or list, grounded, no repeat, skipped more often than not", () => {
  const s = nextStepSection();
  assert.match(s, /optional|may add/, "a suggestion is offered as optional");
  assert.match(s, /never required|optional/, "never required");
  assert.match(s, /more often than not|most replies have none/, "skipped more often than not");
  assert.match(s, /at most one/, "at most one");
  assert.match(s, /sentence/, "a sentence of the reply");
  assert.match(s, /button/, "buttons are named as forbidden");
  assert.match(s, /list/, "lists are named as forbidden");
  assert.match(s, /not built|not done/, "grounded in what was not built or not done");
  assert.match(s, /menu/, "a new page not in the menu is a ground");
  assert.match(s, /unanswered/, "an unanswered part is a ground");
  assert.match(s, /simple change|self-contained|complete in itself/, "none after a simple self-contained change");
  assert.match(s, /already suggested/, "never repeat a recent suggestion");
  assert.match(s, /first person/, "the same first-person voice");
  assert.match(s, /suggested/, "the topic goes back in the tool's field");
  // THE OLDER "never claim a next step no fact states" RULE NOW ADMITS THIS ONE EXCEPTION, AND ONLY THAT.
  assert.match(REPLY_SYSTEM, /next step that no[\s\S]{0,200}except[\s\S]{0,80}suggestion/i);
});

test("THE TOOL: a `suggested` topic field, optional, and the reply stays the one text field", () => {
  const props = REPLY_TOOL.input_schema.properties;
  assert.equal(props.suggested && props.suggested.type, "string");
  assert.ok(!REPLY_TOOL.input_schema.required.includes("suggested"), "a suggestion is never required");
  assert.deepEqual(Object.keys(props).filter((k) => props[k].type === "array" && k !== "covers"), [], "no list of options or buttons in the answer");
});

test("THE FACTS: notBuilt and notDone reach the writer as facts, beside the menu and the recent suggestions", () => {
  const b = buildReplyFacts({ notBuilt: ["online booking"] });
  const e = editReplyFacts({ ok: true, layer: "text", applied: 1, changed: ["Open daily"], notDone: [{ what: "the opening hours line" }] });
  const facts = [...b.facts, ...e.facts];
  const ctx = replyContext({ request: "x", site: { slug: "s" }, recent: ["add Gallery to the menu", "  "], offMenu: ["/gallery", "/gallery", "nope"] });
  const req = replyRequest({ facts, context: ctx, model: "m" });
  const body = req.messages[0].content;
  assert.ok(facts.some((f) => f.kind === "not-done" && /online booking/.test(f.text)), "notBuilt is a not-done fact");
  assert.ok(facts.some((f) => f.kind === "not-done" && /opening hours line/.test(f.text)), "notDone is a not-done fact");
  for (const f of facts) assert.ok(body.includes("[" + f.id + "] " + f.text), "fact " + f.id + " is sent whole");
  assert.match(body, /already suggested[^\n]*\n- .add Gallery to the menu./i, "the recent suggestion is shown, by its topic");
  assert.equal((body.match(/\/gallery/g) || []).length, 1, "a page not known to be in the menu is named once");
  assert.match(body, /menu[^\n]*\/gallery/i);
  assert.match(req.system[0].text, /already suggested/i, "the rules ride on every request");
  // NOTHING TO SAY, NOTHING SHOWN: no empty headings.
  assert.doesNotMatch(replyContext({ request: "x" }), /suggested|menu/i);
});

test("OFF THE MENU: added pages less every page a menu was reported to link", () => {
  assert.deepEqual(offMenuPages({ ok: true, added: ["/gallery", "/faq"], linked: [{ path: "/", to: ["/faq"] }] }), ["/gallery"]);
  assert.deepEqual(offMenuPages({ ok: true, added: ["/a"], restored: [{ path: "/", to: ["/a"] }] }), []);
  assert.deepEqual(offMenuPages({ ok: false, added: ["/a"] }), []);
  assert.deepEqual(offMenuPages(null), []);
});

test("THE MARKER ROUND-TRIPS: writer answer, served body, reply record, stored chat message, and back to the next writer", async () => {
  const facts = buildReplyFacts({ notBuilt: ["online booking"] }).facts;
  const text = "Your site is live. Online booking was not part of this build; I can add it next if you would like.";
  const out = await writeReply({ send: async () => answer({ reply: text, covers: facts.map((f) => f.id), suggested: "add online booking" }) }, { facts, model: "m" });
  assert.equal(out.ok, true);
  assert.equal(out.suggested, "add online booking");
  const served = withReplyText({ ok: true }, out.text, out.suggested);
  assert.equal(served.suggested, "add online booking");
  // KEPT ON A BACKGROUND REPLY'S RECORD.
  assert.equal(readReplyRecord({ v: 2, state: "written", text, suggested: "add online booking" }).suggested, "add online booking");
  assert.equal(readReplyRecord({ v: 2, state: "written", text, suggested: ["x"] }).suggested, undefined, "never coerced");
  // THE PAGE: the model reply read, its topic remembered by its words, put on the message it stores.
  assert.equal(EditPoll.modelReply(served), text);
  assert.equal(EditPoll.suggestedFor(text), "add online booking");
  const open = CHAT.indexOf("\nfunction siteReplyMsg(");
  assert.ok(open > 0, "siteReplyMsg is gone from chat.js");
  const src = CHAT.slice(open, CHAT.indexOf("\n}\n", open) + 3);
  const siteReplyMsg = new Function("EditPoll", src + "\nreturn siteReplyMsg;")({ ...EditPoll, heldOf: () => null });
  const msg = siteReplyMsg(text);
  assert.deepEqual(msg, { r: "a", t: text, suggested: "add online booking" });
  assert.deepEqual(siteReplyMsg({ t: text }).suggested, "add online booking");
  assert.equal(siteReplyMsg("Done.").suggested, undefined, "a reply without one carries no marker");
  // THE STORED CHAT KEEPS IT (the server writes the page's messages whole), and the next writer is shown it.
  const { chatStoreApi } = await loadWorkerModule();
  const stored = chatStoreApi.readChatPut({ baseRev: 0, msgs: [{ r: "u", t: "hi", suggested: "spoof" }, msg, { r: "a", t: "Done." }] });
  assert.equal(stored.msgs[1].suggested, "add online booking");
  assert.deepEqual(recentSuggestions(stored.msgs), ["add online booking"], "only the builder's own messages count");
  assert.match(replyContext({ recent: recentSuggestions(stored.msgs) }), /add online booking/);
});

test("RECENT: the last few within the recent window, oldest first", () => {
  const msgs = [{ r: "a", suggested: "old" }, ...Array.from({ length: 25 }, (_, i) => ({ r: "a", t: "m" + i, ...(i % 5 === 0 ? { suggested: "s" + i } : {}) }))];
  assert.deepEqual(recentSuggestions(msgs), ["s10", "s15", "s20"]);
  assert.deepEqual(recentSuggestions(null), []);
  assert.equal(suggestedOf("x".repeat(81)), "");
  assert.equal(suggestedOf(" a \n b "), "a b");
});

test("PLAIN TEXT: a supplied answer's suggestion is the reply's own sentence, with no button, option or list field", () => {
  const facts = editReplyFacts({ ok: true, layer: "text", applied: 1, changed: ["Open daily"], notDone: [{ what: "the phone number" }] }).facts;
  const text = "I changed the wording to \"Open daily\". I could not find the phone number on the site, so it is unchanged; if you tell me where it appears I can update it.";
  const read = readReply(answer({ reply: text, covers: facts.map((f) => f.id), suggested: "where the phone number appears" }), facts);
  assert.equal(read.ok, true);
  const body = withReplyText({ ok: true, layer: "text" }, read.text, read.suggested);
  assert.equal(body.reply, text, "the suggestion is inside the reply text, unchanged");
  assert.deepEqual(Object.keys(body).sort(), ["layer", "ok", "reply", "replySource", "suggested"]);
  assert.equal(typeof body.suggested, "string", "the marker is a topic, not something to draw");
  assert.equal(EditPoll.modelReply(body), text);
  // A REPLY WITHOUT ONE IS EXACTLY AS BEFORE.
  assert.deepEqual(withReplyText({ ok: true }, "Done."), { ok: true, reply: "Done.", replySource: "model" });
});

test("WIRING: the Worker shows the writer the chat's recent suggestions and the off-menu pages, and keeps the topic on what it serves", () => {
  const at = (a, b) => {
    const i = WORKER.indexOf(a);
    assert.ok(i > 0, a + " is gone from worker.js");
    const j = WORKER.indexOf(b, i);
    assert.ok(j > i, b + " is gone after " + a);
    return WORKER.slice(i, j);
  };
  const compose = at("async function composeModelReply(", "\n}\n");
  assert.match(compose, /recentSuggestedFor\(env, ask\.uid, ask\.chat\)/);
  assert.match(compose, /offMenuPages\(body\)/);
  assert.match(compose, /replyContext\(\{[^)]*recent, offMenu \}\)/);
  assert.match(compose, /suggested: out\.suggested/);
  assert.match(at("function replyAsked(", "\n}\n"), /body\.chat/);
  assert.match(at("async function recentSuggestedFor(", "\n}\n"), /recentSuggestions\(cur\.chat\.msgs\)/);
  assert.match(at("async function withModelReply(", "\n}\n"), /withReplyText\(body, out\.text, out\.suggested\)/);
  assert.match(at("async function settleReply(", "\n}\n"), /suggested: out\.suggested/);
  assert.match(at("function askOfReplyFor(", "\n}\n"), /chat:/);
  // THE PAGE SENDS ITS CHAT WITH AN EDIT AND AN ADDITION.
  for (const head of ["\nfunction siteEdit(", "\nfunction siteAddon("]) {
    const i = CHAT.indexOf(head);
    assert.ok(i > 0, head + " is gone from chat.js");
    assert.match(CHAT.slice(i, CHAT.indexOf("\n}\n", i)), /chat: \(site && typeof chatKeyOf === 'function' && chatKeyOf\(site\)\)/);
  }
});

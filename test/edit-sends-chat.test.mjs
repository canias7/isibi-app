// An edit carries its chat id, so the site agent is given the conversation so
// far (2026-11-04: Market Lane's "delete that" reached the agent alone, with no
// history, and was read as the whole home page).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// Blank line comments so prose cannot satisfy or spoil the scan.
const code = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");

function editBody() {
  const start = chat.indexOf("slug: site.slug, instruction: t,");
  assert.ok(start > 0, "the edit body's landmark exists");
  const end = chat.indexOf("};", start);
  assert.ok(end > start, "the edit body's end exists");
  return code(chat.slice(start, end));
}

test("the edit body sends the chat it was sent from", () => {
  assert.match(editBody(), /\bchat:\s*origin\b/);
});

test("the build body still sends it too (control)", () => {
  const b = chat.indexOf("? { brief: t, images: imgs");
  assert.ok(b > 0);
  assert.match(chat.slice(b, b + 300), /\bchat:\s*origin\b/);
});

test("both agent callers hand the body's chat to runAgentChange, which reads history from it", () => {
  const calls = [...code(worker).matchAll(/await runAgentChange\(env, \{([\s\S]{0,600})/g)].map((m) => m[1]);
  assert.equal(calls.length, 2, "two callers");
  assert.match(calls[0], /chat:\s*eb && eb\.chat/);
  assert.match(calls[1], /chat:\s*ab && ab\.chat/);
  assert.match(worker, /history = historyText\(cur\.chat\.msgs, \{ summary:/);
});

// ── THE REQUEST PATH (2026-11-04, carry-over G4) ─────────────────────────────
// Most messages are filed as a request and run as a job; that path dropped the
// chat id, so the agent still heard no history. Driven through the real
// producers: the request record, its step, and the job body it files.
import { planParts, newRequest, nextStep, jobBody } from "../builder/request.mjs";
import { historyText, HISTORY_UNREADABLE } from "../builder/site-agent.mjs";

const CHAT = "site_1757000000000_abcde";
function filed(chat) {
  const routed = { intent: "edit", layer: "page" };
  const planned = planParts("delete that, that's weird", routed);
  const rec = newRequest({ key: "rqchat0000000001", uid: "u1", slug: "market-lane", message: "delete that, that's weird", chat, picker: "grok", tz: "UTC", accepted: routed, parts: planned.parts });
  const step = nextStep(rec, {}, Date.now());
  assert.ok(step.file, "the observer is alive: the request filed a job");
  return { rec: step.record, body: jobBody(step.record, 0, step.file.kind, "k1").body };
}

test("a request keeps the chat it came from, and every job it files carries it", () => {
  const { rec, body } = filed(CHAT);
  assert.equal(rec.chat, CHAT);
  assert.equal(body.chat, CHAT, "the job sent to the agent carries no chat: the agent hears no history");
});

test("a chat id that is not one is never kept or sent (control)", () => {
  const { rec, body } = filed("../../etc/passwd");
  assert.equal(rec.chat, "");
  assert.equal("chat" in body, false);
});

test("the server passes the message's chat into the request", () => {
  assert.match(worker, /key, uid, slug, message,\s*\n\s*chat: typeof rb\.chat === "string" \? rb\.chat : "",/);
});

test("history is never cut silently, and an unreadable chat is said, never read as empty", () => {
  const msgs = Array.from({ length: 40 }, (_, i) => ({ r: i % 2 ? "a" : "u", t: "message " + i }));
  const h = historyText(msgs);
  assert.match(h, /10 earlier messages not shown/);
  assert.match(h, /message 39$/);
  assert.match(historyText(msgs, { summary: "They run a shop called Market Lane." }), /^Earlier in this chat \(summary\): They run a shop/);
  assert.equal(historyText(msgs.slice(0, 3)).includes("not shown"), false, "a short chat was marked as cut");
  assert.match(HISTORY_UNREADABLE, /could not be read/);
  assert.match(worker, /else if \(!cur\.read\) history = HISTORY_UNREADABLE;/);
});

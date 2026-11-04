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
  assert.match(worker, /history = historyText\(cur\.chat\.msgs\)/);
});

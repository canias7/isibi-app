// "GO CLAUDE CODE WAY", BATCH 2 (2026-11-22): /model and /effort typed, notify by Claude Code's name, "Remove anyway".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ccTool, hooksFor } from "../container/coder-hooks.mjs";

const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
const src = /  function pickCmd\(text, models, pick\) \{[\s\S]*?\n  \}\n/.exec(ui);
const pickCmd = src ? new Function("return (" + src[0].trim().replace(/^function pickCmd/, "function") + ")")() : null;
const MODELS = [{ id: "grok-4.7", name: "Grok 4.7", efforts: ["low", "medium", "high", "xhigh"], effort: "low" }, { id: "grok-5", name: "Grok 5", efforts: ["low", "high"], effort: "high" }];

test("M-r2-36 /model <name> and /effort <level> switch at once, as Claude Code's; a bad value lists the choices; nothing goes to the AI", () => {
  assert.ok(pickCmd, "pickCmd is on the page");
  const p = { model: "grok-4.7", effort: "medium" };
  assert.deepEqual(pickCmd("/model grok-5", MODELS, p).pick, { model: "grok-5", effort: "high" });
  assert.equal(pickCmd("/model Grok 5", MODELS, p).text, "Set model to Grok 5");
  assert.equal(pickCmd("/model nope", MODELS, p).pick, undefined);
  assert.match(pickCmd("/model nope", MODELS, p).text, /Choose one of: grok-4\.7, grok-5/);
  assert.deepEqual(pickCmd("/effort high", MODELS, p).pick, { model: "grok-4.7", effort: "high" });
  assert.equal(pickCmd("/effort high", MODELS, p).text, "Set effort level to high");
  assert.match(pickCmd("/effort max", MODELS, p).text, /^Unknown effort: max\. Choose one of: low, medium, high, xhigh\.$/);
  assert.match(pickCmd("/effort", MODELS, p).text, /^Effort: medium\./);
  assert.ok(ui.includes("['/model', ") && ui.includes("['/effort', "), "in the / list");
  assert.match(ui, /\/\^\\\/\(model\|effort\)\(\?:\\s\|\$\)\/i\.test\(text\)\) \{ boxEmpty\(\); const r = pickCmd/, "caught before sending");
});

test("M-b-36 Coder's notify answers to Claude Code's PushNotification in hooks and rules", () => {
  assert.equal(ccTool("notify"), "PushNotification");
  const hooks = [{ event: "PreToolUse", matcher: "PushNotification", type: "command", command: "true" }];
  assert.equal(hooksFor(hooks, "PreToolUse", ccTool("notify"), {}).length, 1);
});

test("M-r2-37 a delete whose push failed asks 'Remove anyway' and then deletes with force=1", () => {
  assert.match(ui, /'Remove anyway and lose ' \+ n \+ ' commit'/);
  assert.match(ui, /'\?force=1', \{ method: 'DELETE' \}/);
});

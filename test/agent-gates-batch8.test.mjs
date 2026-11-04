// Carry-over batch 8 (2026-11-04): a provider outage in the middle of an edit
// (M-74) keeps the part's unsaved work and says the provider is down.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const fn = W.slice(W.indexOf("async function runAgentChange("), W.indexOf("\nasync function recompileAndPublish(", W.indexOf("async function runAgentChange(")));

test("M-74 a provider outage keeps the part's work as its carry and says the provider is down, at no charge", () => {
  assert.ok(fn.length > 1000, "the landmark exists");
  assert.match(fn, /const providerDown = ag\.stopped === "send" && !!ag\.wait;/);
  assert.match(fn, /if \(cKey && ag\.stopped !== "no-credits" && !providerDown\) \{ try \{ await env\.SITES_BUCKET\.delete\(cKey\); \}/, "the carry is not deleted");
  const at = fn.indexOf("if (providerDown) {");
  assert.ok(at > 0 && at < fn.indexOf("if (!ag.ok) {\n    return { status: 200, body: { ok: false, error: \"agent-stopped\","), "before the generic stop");
  const block = fn.slice(at, at + 900);
  assert.match(block, /makeCarry\(before, ag, stoppedFacts\(ag\)\)/);
  assert.match(block, /waiting: true, wait: ag\.wait, layer: "agent", cost: 0/);
  assert.match(block, /The AI provider is not answering right now/);
});

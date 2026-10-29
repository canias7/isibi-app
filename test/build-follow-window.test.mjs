// The page follows a build at least as long as the site agent may run, plus
// the steps after it (2026-10-29: kiln-lane-4 ran 22½ minutes; the page gave up
// at 20 and said it had not come together).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_MAX_MS } from "../builder/site-agent.mjs";

test("BF1 the follow window outlasts the agent's own limit by the steps after it", () => {
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const m = src.match(/const BUILD_FOLLOW_MS = (\d+) \* 60 \* 1000;/);
  assert.ok(m, "the constant is where it was");
  const follow = Number(m[1]) * 60 * 1000;
  assert.ok(follow >= AGENT_MAX_MS + 8 * 60 * 1000, "follow " + follow + "ms against the agent's " + AGENT_MAX_MS + "ms");
});

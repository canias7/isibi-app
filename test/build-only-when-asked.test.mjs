// A CONVERSATION FIRST (owner, 2026-11-03): Market Lane started building on a
// side question ("what about this?") because the rule built whenever a site
// had been described. The build starts only when the current message asks for
// it; chat and ideas get words; a settled plan gets a Build it / Not yet question.
// On an existing site, ideas talked through change nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { newProjectMessage } from "../builder/site-agent.mjs";

test("BW1 a new project builds only when this message asks; chat and ideas are answered; a settled plan is asked", () => {
  const m = newProjectMessage({ request: "what about a cake shop instead?", history: "Owner: make me a site for my bakery" });
  assert.match(m, /only when this message asks for it/);
  assert.match(m, /even when a site was described earlier in the conversation/);
  assert.match(m, /"Build it" and "Not yet"/);
});

test("BW2 start_build's own description says the same, and the site rule talks ideas through", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../builder/site-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /Call this only when the current message asks for the build/);
  assert.match(src, /thinking out loud or weighing ideas[^]*change nothing/);
  assert.match(src, /Change the site only when the message asks for a change/);
});

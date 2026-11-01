// THE AGENT'S QUESTIONS ARE KEPT (2026-11-01). Live on northline-climbing
// (2026-10-31) the agent asked "Which page should be linked in the header?"
// and the customer saw "couldn't keep track of the question": its answer's
// step is "agent", which the question store refused.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packAsk, newAskId, ASK_STAGES } from "../builder/clarify.mjs";

const base = () => ({ id: newAskId(), uid: "u1", slug: "northline-climbing", round: 1, question: { text: "Which email service do you use?", options: ["Resend", "SendGrid"] }, request: "send emails to my customers", held: [], at: Date.now(), attached: false, context: [] });

test("AK1 a question the site agent asks is packed for keeping, alone or as a request's part", () => {
  assert.ok(ASK_STAGES.includes("agent"));
  assert.ok(packAsk({ ...base(), stage: "agent" }), "the agent's question is refused");
  assert.ok(packAsk({ ...base(), stage: "agent", requestKey: "ac703719746ef2c04be4b7b5ba4bd69b", part: 1 }), "a part's question is refused");
  assert.equal(packAsk({ ...base(), stage: "nonsense" }), null, "the check is alive");
});

test("AK2 the agent's answers carry the step the store now keeps", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function runAgentChange("), src.indexOf("async function recompileAndPublish(env, {"));
  assert.ok(fn.length > 1000);
  assert.match(fn, /layer: "agent"/);
});

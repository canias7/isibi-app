// TWO RECOVERY GAPS CARRIED INTO THE PARALLEL-TASKS BATCH (2026-10-08, from
// Codex's review of the ninth Build batch):
//   1. every clarification answer is kept — the designer can ask after the
//      router's three, and an answer past a count was dropped on the page
//      (8), in the router's prompt (3) and in the designer's brief (3);
//   2. a corrective design call that meets a busy provider is retried WITH
//      the same correction and the same question field, never the plain
//      request.

import test from "node:test";
import assert from "node:assert/strict";
import { clarifiedBrief, MAX_CLARIFY } from "../builder/site-ask.mjs";
import { GOOD_DESIGN, buildBucket } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const QA = Array.from({ length: MAX_CLARIFY + 3 }, (_, i) => ({ q: "Question " + (i + 1) + "?", a: "Answer " + (i + 1) }));

test("1: the designer's brief keeps EVERY answered question, past the router's own budget", () => {
  const b = clarifiedBrief("A bakery in Leeds.", QA);
  for (const p of QA) assert.match(b, new RegExp(p.a + "$|" + p.a + "\\n"), p.a + " was dropped");
  assert.equal(clarifiedBrief("A bakery.", []), "A bakery.", "CONTROL: no answers, the brief alone");
});

test("1: through the real build route — a seventh answer reaches the designer", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: QA, chat: "c" }, design: () => ({ input: GOOD_DESIGN }) });
  assert.match(r.seen.designer[0], /Answer 6/, "the last answer never reached the designer");
});

test("1: the page sends every answer of the round, none cut at eight", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = src.indexOf("function siteRoute(site, t, origin, isBuild");
  assert.ok(at > 0, "siteRoute is gone");
  const body = src.slice(at, src.indexOf("\nfunction ", at + 10));
  assert.match(body, /const qa = round \? round\.qa\.slice\(\) : \[\];/);
  assert.doesNotMatch(body, /round\.qa\.slice\(0,/);
});

test("2: a corrective call that meets a busy provider is retried with the SAME correction and question field", async () => {
  const { recoverDesign } = await loadWorkerModule();
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const bd = JSON.parse(String((init && init.body) || "{}"));
    sent.push(bd);
    if (sent.length === 1) return json({ type: "error", error: { type: "overloaded_error" } }, 529);
    return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "design_schema", input: { question: { text: "Delivery or collection?", options: ["Delivery", "Collection"] } } }], usage: { input_tokens: 1, output_tokens: 1 } });
  };
  try {
    const rec = await recoverDesign({ SITES_BUCKET: buildBucket(), ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" }, { dz: { input: null, shape: { tool: false }, usage: { in: 1, out: 1 } }, jobId: "rc1", brief: "a bakery", model: "claude-sonnet-4-5", frontendOnly: true });
    assert.equal(sent.length, 2);
    const told = (b) => JSON.stringify(b.messages);
    assert.match(told(sent[0]), /COULD NOT BE USED/);
    assert.match(told(sent[1]), /COULD NOT BE USED/, "the retry lost the correction");
    assert.ok(sent[1].tools[0].input_schema.properties.question, "the retry lost the question field");
    assert.deepEqual(rec.question && rec.question.text, "Delivery or collection?", "a question asked on the retry was not read");
    assert.deepEqual(rec.attempts.map((a) => a.retry), ["repair", "again"]);
  } finally { globalThis.fetch = real; }
});

test("2 CONTROL: a busy provider on the FIRST call is asked the plain request — there is nothing to correct", async () => {
  const { recoverDesign } = await loadWorkerModule();
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    sent.push(JSON.parse(String((init && init.body) || "{}")));
    return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 1, output_tokens: 1 } });
  };
  try {
    const e = Object.assign(new Error("busy"), { status: 529 });
    const rec = await recoverDesign({ SITES_BUCKET: buildBucket(), ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" }, { err: e, jobId: "rc2", brief: "a bakery", model: "claude-sonnet-4-5", frontendOnly: true });
    assert.equal(rec.ok, true);
    assert.doesNotMatch(JSON.stringify(sent[0].messages), /COULD NOT BE USED/);
    assert.equal(sent[0].tools[0].input_schema.properties.question, undefined);
  } finally { globalThis.fetch = real; }
});

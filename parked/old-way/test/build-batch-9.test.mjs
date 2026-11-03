// PARKED (2026-11-03, park-old-way): the old-way half of test/build-batch-9.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE NINTH BUILD BATCH (2026-10-08): a first Build whose design comes back
// wrong is RECOVERED, not abandoned.
//
// Codex reviewed `8180a7cf` and reproduced a first Build receiving an unusable
// design: exactly one `design_schema` call, then `design-unusable`, and no
// corrective attempt. These cases drive the real route (inline and queued),
// the real recovery and the real designer request with every model answer
// supplied — never a paid call:
//   - the model's own mistake (no tool call, required parts missing) and an
//     answer cut off at its room are corrected once, told the validation
//     failures and shown what it already wrote, and the SAME build goes on;
//   - a busy provider or a dropped connection is asked once more;
//   - an account refusal, a request the provider rejects and our own time
//     ceiling are never retried;
//   - a decision only the customer can make comes back as the designer's own
//     question through the first build's existing question round;
//   - attempts are recorded beside the job BEFORE they are made, so a
//     redelivered job never repeats one, and an attempt that cannot be
//     recorded is not made;
//   - every design call's usage is the one the ledger settles.

import test from "node:test";
import assert from "node:assert/strict";
import { GOOD_DESIGN, BRIEF, buildBucket } from "../../../test/fixtures/build-route.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import { ledger, fireInterim, finishResume } from "../../../test/fixtures/build-lifecycle.mjs";
import { resultKey, readResult } from "../../../builder/build-job.mjs";
import { designFailure, mayRetry, repairNote, repairOutcome, addUsage, DESIGN_RETRY_FLOOR_MS, REPAIR_SHOWN_CHARS } from "../../../builder/design-repair.mjs";
import { buildFacts } from "../../../builder/build-answer.mjs";
import { buildReplyFacts } from "../../../builder/site-reply.mjs";
import { designInWaves } from "../../../builder/design-waves.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const BODY = { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: [], chat: "c" };
const told = (bd) => JSON.stringify(bd.messages || "");
const isRepair = (s) => /COULD NOT BE USED/.test(s);
const factText = (bf) => buildReplyFacts(bf).facts.map((f) => f.text || f).join("\n");
const { purpose: _p, ...NO_PURPOSE } = GOOD_DESIGN;

// ── the job: durable attempts, redelivery, time ─────────────────────────

const W = async () => loadWorkerModule();
const stubFetch = (answer) => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const bd = JSON.parse(String((init && init.body) || "{}"));
    calls.push(bd);
    return answer(calls.length - 1, bd);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
};
const ok = (input) => json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "design_schema", input }], usage: { input_tokens: 5, output_tokens: 5 } });
const ENV = (b) => ({ SITES_BUCKET: b, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" });
const unusable = { input: null, shape: { tool: false }, usage: { in: 100, out: 50, cacheRead: 0, cacheWrite: 0 } };

const Q9 = "9e9c3d4e5f60718293a4b5c6d7e8f9ab";
test("THE QUEUED JOB (browser closed): the consumer repairs the design and fires the same build; a REDELIVERY of that job makes no second corrective call", async () => {
  const b = buildBucket();
  const led = ledger();
  const designs = [];
  const onDesign = (n, bd) => (isRepair(told(bd)) ? ok(GOOD_DESIGN) : json({ stop_reason: "end_turn", content: [{ type: "text", text: "no" }], usage: { input_tokens: 100, output_tokens: 50 } }));
  await fireInterim(b, Q9, led, { onDesign, designs });
  assert.equal(designs.length, 2);
  assert.equal(designs.filter((d) => isRepair(told(d))).length, 1);
  const kept = JSON.parse(b.store.get("jobs/" + Q9 + ".design.json"));
  assert.deepEqual(kept.attempts.map((a) => a.retry), ["repair"]);
  const resume = [...b.store.keys()].find((k) => /resume/.test(k));
  assert.ok(resume, "the build did not fire its generation: " + [...b.store.keys()].join(", "));
  // THE BUILD FINISHES IN THE RESUME, and its final answer tells the corrected
  // design: what the first invocation did rides on its record.
  await finishResume(b, Q9, led, { credits: 400 });
  const raw = b.store.get(resultKey(Q9));
  assert.ok(raw, "the resume wrote no answer");
  const fin = JSON.parse(readResult(JSON.parse(raw)).body);
  assert.deepEqual(fin.buildFacts && fin.buildFacts.design, { outcome: "repaired", attempts: ["malformed:repair"] }, JSON.stringify(fin).slice(0, 300));
  // The same job delivered again makes no second corrective call. Since
  // 2026-10-10 (round 4, one execution per job) it makes no call at all: the
  // job's execution record is held by the consumer that ran it, so a
  // redelivery never executes it again — the stronger form of this guard.
  const again = [];
  await fireInterim(b, Q9, led, { onDesign, designs: again });
  assert.equal(JSON.parse(b.store.get("builds-run/" + Q9 + ".json")).owner, "queue", "OBSERVER: the first delivery holds no execution record, so this proves nothing");
  assert.equal(again.length, 0, "the redelivery executed the job a second time");
  assert.equal(again.filter((d) => isRepair(told(d))).length, 0, "the redelivery made a second corrective call");
});

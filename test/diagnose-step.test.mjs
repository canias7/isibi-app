// THE FAILURE DIAGNOSIS STEP, PHASE 1 (shadow mode), 2026-10-24.
// Supplied answers only; no model is called.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  diagnoseOn, diagnosisKey, needsDiagnosis, failureEvidence, diagnoseRequest, readDiagnosis, diagnose,
  diagnoseJobEnded, DIAGNOSE_SKILL, DIAGNOSE_TOOL, DIAGNOSIS_KINDS, FIX_MOVES,
} from "../builder/diagnose.mjs";
import { DRIFTWOOD, suppliedReply, answerFor } from "./fixtures/diagnose-driftwood.mjs";
import { toXaiRequest, XAI_EFFORTS } from "../builder/model-xai.mjs";

// XHIGH, the owner's "next update with the skill" (2026-10-24): in the picker
// since 2026-10-19 as "Extra high"; held here end to end, picker to wire.
test("DG13 xhigh is offered by the picker, accepted by the server and sent as reasoning_effort", () => {
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /^\s+xhigh: +\{ label: '[^']+'/m);
  assert.ok(XAI_EFFORTS.includes("xhigh"));
  const out = toXaiRequest({ model: "grok-4.7", max_tokens: 10, effort: "xhigh", messages: [{ role: "user", content: "x" }] });
  assert.equal(out.body.reasoning_effort, "xhigh");
  const none = toXaiRequest({ model: "grok-4.7", max_tokens: 10, effort: "ultra", messages: [{ role: "user", content: "x" }] });
  assert.equal(none.body.reasoning_effort, undefined);
});

const ON = { DIAGNOSE_FAILURES: "on" };

function harness(reply) {
  const sent = [];
  const puts = [];
  return {
    sent, puts,
    deps: {
      env: ON, model: "quick-model", now: () => 1000,
      send: async (req) => { sent.push(req); if (reply instanceof Error) throw reply; return reply; },
      put: async (k, v) => { puts.push([k, v]); },
    },
  };
}

test("DG1 the switch is off unless it says on, and off makes no call and writes nothing", async () => {
  assert.equal(diagnoseOn(undefined), false);
  assert.equal(diagnoseOn({}), false);
  assert.equal(diagnoseOn({ DIAGNOSE_FAILURES: "off" }), false);
  assert.equal(diagnoseOn({ DIAGNOSE_FAILURES: ["on"] }), false);
  assert.equal(diagnoseOn({ DIAGNOSE_FAILURES: " On " }), true);
  const h = harness(suppliedReply(answerFor(DRIFTWOOD[1])));
  h.deps.env = {};
  const out = await diagnoseJobEnded(h.deps, { id: "j1", ...DRIFTWOOD[1].job });
  assert.equal(out, null);
  assert.equal(h.sent.length, 0);
  assert.equal(h.puts.length, 0);
});

test("DG2 only a failure is diagnosed: not shipped, not ok, partial; never a cancel or a plain success", () => {
  assert.equal(needsDiagnosis({ status: 200, payload: { ok: true } }), false);
  assert.equal(needsDiagnosis({ status: 200, payload: { ok: true }, shipped: true }), false);
  assert.equal(needsDiagnosis({ status: 200, payload: { ok: false } }), true);
  assert.equal(needsDiagnosis({ status: 200, payload: { ok: true }, shipped: false }), true);
  assert.equal(needsDiagnosis({ status: 500, payload: null }), true);
  assert.equal(needsDiagnosis({ status: 200, payload: { ok: true, partial: true } }), true);
  assert.equal(needsDiagnosis({ status: 410, payload: { cancelled: true } }), false);
});

test("DG3 the skill states the iron law and the four steps, and the request forces the one tool", () => {
  assert.match(DIAGNOSE_SKILL, /NO PROPOSED FIX WITHOUT A ROOT CAUSE/);
  for (const s of ["1. READ THE REAL ERROR", "2. LOCATE WHERE IT BROKE", "3. ONE HYPOTHESIS", "4. ONE TARGETED FIX"]) assert.ok(DIAGNOSE_SKILL.includes(s), s);
  const req = diagnoseRequest({ evidence: "E", model: "m" });
  assert.equal(req.tool_choice.name, DIAGNOSE_TOOL.name);
  assert.equal(req.system[0].text, DIAGNOSE_SKILL);
  assert.deepEqual(DIAGNOSE_TOOL.input_schema.properties.kind.enum, [...DIAGNOSIS_KINDS]);
  assert.deepEqual(DIAGNOSE_TOOL.input_schema.properties.fix_move.enum, [...FIX_MOVES]);
});

test("DG4 the evidence carries the recorded facts of each Driftwood failure", () => {
  const ev = DRIFTWOOD.map((f) => failureEvidence(f.job));
  assert.ok(ev[0].includes("23502") && ev[0].includes("ANSWER.route: addon") && ev[0].includes("ANSWER.partial"));
  assert.ok(ev[1].includes("pick_adds") && ev[1].includes("no-add"));
  assert.ok(ev[2].includes("ANSWER.question") && ev[2].includes("ANSWER.charged: 12"));
  for (const [i, e] of ev.entries()) assert.ok(e.includes(DRIFTWOOD[i].job.words), "words in evidence " + i);
  // a non-string is never coerced into a word
  assert.equal(failureEvidence({ op: ["addon"], words: ["x"] }), "");
});

for (const f of DRIFTWOOD) {
  test("DG5 Driftwood, " + f.name + ": recorded in shadow, charged 0, nothing else touched", async () => {
    const h = harness(suppliedReply(answerFor(f)));
    const rec = await diagnoseJobEnded(h.deps, { id: "abc", ...f.job });
    assert.equal(h.sent.length, 1, "one call, no retry");
    assert.equal(h.puts.length, 1);
    assert.equal(h.puts[0][0], diagnosisKey("abc"));
    assert.equal(h.puts[0][0], "jobs/abc.diagnosis.json");
    const stored = JSON.parse(h.puts[0][1]);
    assert.deepEqual(stored, rec);
    assert.equal(stored.shadow, true);
    assert.equal(stored.charged, 0);
    assert.equal(stored.diagnosis.kind, f.kind);
    assert.equal(stored.diagnosis.fix_move, f.fix_move);
    assert.equal(stored.diagnosis.retry_would_succeed, f.retry);
    assert.deepEqual(stored.diagnosis.evidence, [f.quote]);
    assert.ok(h.sent[0].messages[0].content.includes(f.quote));
  });
}

test("DG6 a quote the model did not see is a guess, and is refused", () => {
  const f = DRIFTWOOD[0];
  const ev = failureEvidence(f.job);
  const bad = { ...answerFor(f), evidence: ["ANSWER.code: 42P01"] };
  const r = readDiagnosis(suppliedReply(bad), ev);
  assert.equal(r.ok, false);
  assert.equal(r.why, "unseen-evidence");
  assert.equal(readDiagnosis(suppliedReply(answerFor(f)), ev).ok, true);
});

test("DG7 every field is checked: kind, move, retry, the texts, the evidence list", () => {
  const f = DRIFTWOOD[1];
  const ev = failureEvidence(f.job);
  const good = answerFor(f);
  assert.equal(readDiagnosis(suppliedReply({ ...good, kind: "guess" }), ev).why, "kind");
  assert.equal(readDiagnosis(suppliedReply({ ...good, fix_move: "retry" }), ev).why, "fix-move");
  assert.equal(readDiagnosis(suppliedReply({ ...good, retry_would_succeed: "maybe" }), ev).why, "retry");
  assert.equal(readDiagnosis(suppliedReply({ ...good, root_cause: "  " }), ev).why, "root_cause");
  assert.equal(readDiagnosis(suppliedReply({ ...good, evidence: [] }), ev).why, "evidence");
  assert.equal(readDiagnosis({ content: [{ type: "text", text: "x" }] }, ev).why, "unreadable");
  assert.equal(readDiagnosis(null, ev).why, "unreadable");
});

test("DG8 a failed call is recorded as unread, never as a diagnosis, and never throws", async () => {
  const h = harness(new Error("provider down"));
  const rec = await diagnoseJobEnded(h.deps, { id: "j2", ...DRIFTWOOD[2].job });
  assert.equal(rec.unread, "call");
  assert.equal(rec.diagnosis, undefined);
  assert.equal(rec.charged, 0);
  const h2 = harness(suppliedReply(answerFor(DRIFTWOOD[2])));
  h2.deps.put = async () => { throw new Error("bucket down"); };
  assert.equal(await diagnoseJobEnded(h2.deps, { id: "j3", ...DRIFTWOOD[2].job }), null);
  assert.equal((await diagnose({}, { evidence: "x" })).why, "send");
});

test("DG9 a success writes nothing and calls nothing", async () => {
  const h = harness(suppliedReply(answerFor(DRIFTWOOD[0])));
  assert.equal(await diagnoseJobEnded(h.deps, { id: "j4", op: "edit", status: 200, payload: { ok: true }, shipped: true }), null);
  assert.equal(h.sent.length, 0);
  assert.equal(h.puts.length, 0);
});

// ── THE WIRING: the worker calls it after the outcome is final, and only to record ──
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
function between(src, a, b) {
  const i = src.indexOf(a); const j = src.indexOf(b, i + a.length);
  assert.ok(i >= 0, "landmark " + a); assert.ok(j > i, "landmark " + b);
  return src.slice(i, j);
}

test("DG10 the edit consumer diagnoses after the refund and the reply, the build after its row closes", () => {
  const edit = between(W, "const fin = await editRpc(env, \"edit_finalize\"", "export async function runContainerJob");
  const iRefund = edit.indexOf("\"edit_refund\"");
  const iReply = edit.indexOf("await replyJobEnded(env, { id, uid: job.uid }, payload);");
  const iDiag = edit.indexOf("await diagnoseEnded(env, ctx, {");
  assert.ok(iRefund >= 0 && iReply > iRefund && iDiag > iReply, "edit order");
  const build = between(W, "async function runQueuedSiteBuild(", "WHAT A FINISHED EDIT COST");
  const iClose = build.indexOf("await closeBuildRow(env, id, buildOutcome(");
  const iBDiag = build.indexOf("await diagnoseEnded(env, ctx, { id, op: \"build\"");
  assert.ok(iClose >= 0 && iBDiag > iClose, "build order");
});

test("DG11 the worker's helper only records: no ledger, no reply, no customer record", () => {
  const helper = between(W, "async function diagnoseEnded(", "async function replyJobEnded(");
  assert.ok(helper.includes("diagnoseJobEnded("), "it runs the step");
  assert.ok(helper.includes("SITES_BUCKET.put("), "it writes the record");
  const code = helper.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const bad of ["editRpc", "credit_", "edit_reserve", "edit_refund", "askReply", "progressUpdate", "storeBuildResult"]) assert.ok(!code.includes(bad), bad);
});

test("DG12 the deploy defaults the switch off and uploads it; the container receives it", () => {
  const deploy = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(deploy, /^\s+DIAGNOSE_FAILURES: \$\{\{ secrets\.DIAGNOSE_FAILURES \|\| 'off' \}\}$/m);
  assert.match(deploy, /^\s+DIAGNOSE_FAILURES$/m);
  const ej = readFileSync(new URL("../builder/edit-job.mjs", import.meta.url), "utf8");
  assert.ok(ej.includes("\"DIAGNOSE_FAILURES\","));
});

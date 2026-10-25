// THE DIAGNOSIS INVESTIGATES (2026-10-25): a short read-only tool loop before
// `record_diagnosis`, and a `fault` field. Supplied answers only; no model is
// called, nothing is written but the record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  investigate, investigateRequest, diagnoseJobEnded, readDiagnosis, failureEvidence, diagnosisKey,
  DIAGNOSE_READ_TOOLS, DIAGNOSE_READ_TOOL_NAMES, DIAGNOSE_MAX_TOOL_CALLS, DIAGNOSE_TOOL, DIAGNOSE_INVESTIGATE, FAULTS,
} from "../builder/diagnose.mjs";
import { FAILURES, toolsFor, scriptedSend, recordInput } from "./fixtures/diagnose-tools-driftwood.mjs";

const ON = { DIAGNOSE_FAILURES: "on" };

test("DT1 five read-only tools plus the record; the fault field is required and checked", () => {
  assert.deepEqual([...DIAGNOSE_READ_TOOL_NAMES], ["read_job", "read_trace", "read_route", "list_site", "read_page"]);
  const req = investigateRequest({ evidence: "E", model: "m" });
  assert.deepEqual(req.tools.map((t) => t.name), [...DIAGNOSE_READ_TOOL_NAMES, DIAGNOSE_TOOL.name]);
  assert.equal(req.tool_choice.type, "any");
  assert.equal(investigateRequest({ evidence: "E", model: "m", forced: true }).tool_choice.name, DIAGNOSE_TOOL.name);
  assert.ok(req.system[0].text.includes(DIAGNOSE_INVESTIGATE));
  assert.ok(DIAGNOSE_INVESTIGATE.includes("at most " + DIAGNOSE_MAX_TOOL_CALLS + " tool calls"));
  assert.deepEqual([...FAULTS], ["ours", "model", "provider", "customer", "unknown"]);
  assert.ok(DIAGNOSE_TOOL.input_schema.required.includes("fault"));
  const f = FAILURES[2];
  const ev = failureEvidence(f.job) + "\n" + JSON.stringify(f.results.read_job);
  const good = recordInput(f);
  const reply = (i) => ({ content: [{ type: "tool_use", name: DIAGNOSE_TOOL.name, input: i }] });
  assert.equal(readDiagnosis(reply(good), ev).ok, true);
  assert.equal(readDiagnosis(reply({ ...good, fault: "theirs" }), ev).why, "fault");
  const { fault, ...noFault } = good;
  assert.equal(readDiagnosis(reply(noFault), ev).why, "fault");
});

for (const f of FAILURES) {
  test("DT2 " + f.name + ": the loop reaches its tools, and the correct answer validates and is recorded", async () => {
    const log = [], sent = [], puts = [];
    const rec = await diagnoseJobEnded({
      env: ON, model: "quick", now: () => 5, tools: toolsFor(f, log),
      send: scriptedSend(f.script, recordInput(f), sent),
      put: async (k, v) => { puts.push([k, v]); },
    }, { id: f.id, ...f.job });
    assert.deepEqual(log.map((x) => x.name), f.script, "the tools it asked for were run, in order");
    assert.equal(sent.length, f.script.length + 1);
    assert.ok(rec.diagnosis, "diagnosis recorded: " + rec.unread);
    assert.equal(rec.diagnosis.kind, f.answer.kind);
    assert.equal(rec.diagnosis.fault, f.answer.fault);
    assert.equal(rec.diagnosis.fix_move, f.answer.fix_move);
    assert.deepEqual(rec.investigation.map((c) => c.tool), f.script);
    assert.equal(rec.shadow, true);
    assert.equal(rec.charged, 0);
    assert.equal(puts.length, 1);
    assert.equal(puts[0][0], diagnosisKey(f.id));
    // at least one quote came only from a tool result, not the final answer
    assert.ok(f.answer.quotes.some((q) => !rec.evidence.includes(q)), "a quote the job's answer alone did not hold");
    for (const q of f.answer.quotes) assert.ok(rec.seen.includes(q), q);
    // each later turn carries the tool's result back to the model
    const last = sent[sent.length - 1].messages;
    assert.equal(last[last.length - 1].content[0].type, "tool_result");
  });
}

test("DT3 a quote from nowhere is refused, even after reading", async () => {
  const f = FAILURES[1];
  const out = await investigate({ send: scriptedSend(["read_route"], { ...recordInput(f), evidence: ["\"layer\":\"page\""] }) }, { evidence: failureEvidence(f.job), model: "m", tools: toolsFor(f) });
  assert.equal(out.ok, false);
  assert.equal(out.why, "unseen-evidence");
  // and without the read, the route's quote is unseen
  const out2 = await investigate({ send: scriptedSend([], recordInput(f)) }, { evidence: failureEvidence(f.job), model: "m", tools: toolsFor(f) });
  assert.equal(out2.why, "unseen-evidence");
});

test("DT4 the budget: at most six reads, then the record is forced", async () => {
  const f = FAILURES[0];
  const sent = [];
  let n = 0;
  const send = async (req) => {
    sent.push(req);
    if (req.tool_choice.type === "tool") return { content: [{ type: "tool_use", name: DIAGNOSE_TOOL.name, input: recordInput(f) }] };
    n++;
    return { content: [{ type: "tool_use", id: "a" + n, name: "read_job", input: {} }, { type: "tool_use", id: "b" + n, name: "read_route", input: {} }] };
  };
  const out = await investigate({ send }, { evidence: failureEvidence(f.job), model: "m", tools: { ...toolsFor(f), list_site: async () => f.results.list_site } });
  assert.equal(out.calls.length, DIAGNOSE_MAX_TOOL_CALLS);
  assert.equal(sent[sent.length - 1].tool_choice.name, DIAGNOSE_TOOL.name);
  // two reads a turn: three turns spend the six, and the very next is forced
  assert.equal(sent.length, 4);
  assert.equal(sent[2].tool_choice.type, "any");
  assert.equal(sent[3].tool_choice.name, DIAGNOSE_TOOL.name);
});

test("DT5 a failing tool answers unavailable; prose is nudged; a failed call is unread; nothing throws", async () => {
  const f = FAILURES[2];
  const tools = { ...toolsFor(f), read_trace: async () => { throw new Error("supabase down"); } };
  const sent = [];
  let i = 0;
  const send = async (req) => {
    sent.push(req);
    i++;
    if (i === 1) return { content: [{ type: "text", text: "Let me think." }] };
    if (i === 2) return { content: [{ type: "tool_use", id: "x", name: "read_trace", input: {} }] };
    if (i === 3) return { content: [{ type: "tool_use", id: "y", name: "read_job", input: {} }] };
    return { content: [{ type: "tool_use", name: DIAGNOSE_TOOL.name, input: recordInput(f) }] };
  };
  const out = await investigate({ send }, { evidence: failureEvidence(f.job), model: "m", tools });
  assert.equal(out.ok, true);
  assert.ok(out.seen.includes("unavailable: supabase down"));
  assert.equal(sent[1].messages[2].content, "Call one of the read tools, or record_diagnosis.");
  const bad = await investigate({ send: async () => { throw new Error("down"); } }, { evidence: "E", model: "m", tools });
  assert.equal(bad.why, "call");
  const missing = await investigate({ send: scriptedSend(["read_page"], recordInput(f)) }, { evidence: failureEvidence(f.job), model: "m", tools: {} });
  assert.ok(missing.seen.includes("unavailable: not provided"));
});

// ── THE WIRING ──
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
function between(src, a, b) {
  const i = src.indexOf(a); const j = src.indexOf(b, i + a.length);
  assert.ok(i >= 0, "landmark " + a); assert.ok(j > i, "landmark " + b);
  return src.slice(i, j);
}
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("DT6 the worker binds the five tools to the job, reads only, and hands them to the step", () => {
  const tools = code(between(W, "function diagnoseTools(", "async function diagnoseEnded("));
  for (const n of DIAGNOSE_READ_TOOL_NAMES) assert.ok(tools.includes(n + ": async"), n);
  assert.ok(tools.includes("fetch("), "it reads");
  for (const bad of ["method:", ".put(", ".delete(", "editRpc", "credit_", "/rpc/", "auth"]) assert.ok(!tools.includes(bad), bad);
  const cols = between(W, "const DIAGNOSE_JOB_COLS = \"", "\";");
  for (const bad of ["lease_owner", "uid", "idem_key"]) assert.ok(!cols.includes(bad), bad);
  const helper = code(between(W, "async function diagnoseEnded(", "async function replyJobEnded("));
  // 2026-10-25: the stop reader is split off; the rest go to the step as its tools.
  assert.ok(helper.includes("const { stoppedByPerson, ...tools } = diagnoseTools(env, { id, slug, b })"));
  assert.ok(/\btools,\n/.test(helper) && helper.includes("stopped: stoppedByPerson"));
});

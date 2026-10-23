// A PROVIDER'S ERROR SENT DOWN AN OPEN STREAM IS ITS ANSWER (2026-10-23,
// audit A23-3). It carries no status, so `retryHere` read it as "no request
// was made" and the Worker or the resume bought the call again; `patientCall`
// asked twice more; and `routeFailure` told an exhausted account as a
// transport failure. A stream merely cut short still refires (kept as it was).
import { test } from "node:test";
import assert from "node:assert/strict";
import { callBuilderModel, retryHere, patientCall } from "../builder/build-call.mjs";
import { routeFailure } from "../builder/site-ask.mjs";

const KEYS = { anthropic: "A-KEY", xai: "X-KEY" };
const XAI_REQ = { model: "grok-4.6", max_tokens: 10, messages: [{ role: "user", content: "hi" }] };
const sseChunk = (o) => "data: " + JSON.stringify(o);
function textSend(text) {
  let calls = 0;
  const send = async () => { calls++; return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) }; };
  return { send, calls: () => calls };
}
const QUOTA = [
  sseChunk({ choices: [{ delta: { content: "st" }, finish_reason: null }] }),
  sseChunk({ error: { message: "Your credit balance is too low", code: "insufficient_quota" } }),
].join("\n\n") + "\n\n";
const CUT = sseChunk({ choices: [{ delta: { content: "st" }, finish_reason: null }] }) + "\n\n";

async function thrown(text) {
  try { await callBuilderModel(KEYS, XAI_REQ, null, textSend(text).send, { stream: true }); }
  catch (e) { return e; }
  assert.fail("the stream did not throw");
}

test("SE1 a streamed provider error is never re-bought by retryHere, in the container's failure shape", async () => {
  const e = await thrown(QUOTA);
  assert.ok(e.detail, "the envelope is kept");
  assert.equal(e.status, undefined);
  // The shape `/model` and `/model/start` send: status, detail, message, kind.
  assert.equal(retryHere({ status: null, detail: e.detail, message: e.message, kind: String(e.name) }), false);
});

test("SE2 a stream cut short still refires (the recorded choice), and a plain no-request failure too", async () => {
  const e = await thrown(CUT);
  assert.equal(retryHere({ status: null, kind: String(e.name) }), true);
  assert.equal(retryHere({ status: null, kind: "TypeError" }), true);
});

test("SE3 patientCall throws a streamed provider error at once, and still asks again after a cut", async () => {
  const q = textSend(QUOTA);
  await assert.rejects(() => patientCall(() => callBuilderModel(KEYS, XAI_REQ, null, q.send, { stream: true })));
  assert.equal(q.calls(), 1, "the provider's answer was asked for again");
  const c = textSend(CUT);
  await assert.rejects(() => patientCall(() => callBuilderModel(KEYS, XAI_REQ, null, c.send, { stream: true })));
  assert.equal(c.calls(), 3);
});

test("SE4 routeFailure reads a streamed envelope: an exhausted account is billing, not transport", async () => {
  const e = await thrown(QUOTA);
  const classify = (x) => { const d = JSON.parse(x.detail); return { type: d.error.type, billing: d.error.type === "insufficient_quota" }; };
  const f = routeFailure("call", e, { model: "grok-4.6", classify });
  assert.equal(f.kind, "provider");
  assert.equal(f.billing, true);
  assert.equal(f.status, null);
  // A cut stream stays a transport failure.
  const cut = await thrown(CUT);
  assert.equal(routeFailure("call", cut, { model: "grok-4.6", classify }).kind, "transport");
});

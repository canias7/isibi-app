// The owner's group 5 test (2026-11-17): Grok's answer cut off while it came ("terminated") ended the turn. Now tried again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { coderSend } from "../container/coder-model.mjs";

const answer = { output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "hi" }] }], usage: { input_tokens: 1, output_tokens: 1 } };
const cut = () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new TypeError("terminated"); }, text: async () => "" });
const good = () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => answer, text: async () => "" });

test("an answer cut off while it arrives is asked for again, and the retry is told", async () => {
  let n = 0; const told = [];
  const send = coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => (++n < 3 ? cut() : good()), wait: async () => {}, rand: () => 0 });
  const r = await send({ model: "m", messages: [{ role: "user", content: "hi" }], onRetry: (x) => told.push(x.error) });
  assert.equal(r.message.content, "hi");
  assert.equal(n, 3);
  assert.equal(told.length, 2);
  assert.match(told[0], /the answer was cut off \(terminated\)/);
});

test("a cut-off answer every time still ends, after the retries", async () => {
  const send = coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => cut(), wait: async () => {}, rand: () => 0 });
  await assert.rejects(send({ model: "m", messages: [{ role: "user", content: "hi" }] }), /terminated/);
});

test("CD-B20b the service's marks: x-should-retry false is not retried; retry-after over 60 s ends at once; retry-after 5 waits 5 s", async () => {
  const run = async (hdrs, status = 503) => {
    let n = 0; const waits = [];
    const fetchFn = async () => { n++; return n === 1 ? new Response("busy", { status, headers: hdrs }) : new Response(JSON.stringify({ output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "hi" }] }], usage: {} }), { status: 200, headers: { "content-type": "application/json" } }); };
    const send = coderSend({ XAI_API_KEY: "k" }, { fetchFn, wait: async (ms) => { waits.push(ms); }, rand: () => 0 });
    const out = await send({ messages: [{ role: "user", content: "x" }] }).then(() => "ok", (e) => e.message);
    return { n, waits, out };
  };
  let x = await run({ "x-should-retry": "false" });
  assert.deepEqual([x.n, x.waits.length], [1, 0]); assert.match(x.out, /AI call failed: 503/);
  x = await run({ "retry-after": "120" });
  assert.deepEqual([x.n, x.waits.length], [1, 0]); assert.match(x.out, /AI call failed: 503/);
  x = await run({ "retry-after": "5" });
  assert.deepEqual([x.n, x.waits, x.out], [2, [5000], "ok"]);
  x = await run({ "x-should-retry": "true" }, 400);
  assert.deepEqual([x.n, x.out], [2, "ok"]);
});

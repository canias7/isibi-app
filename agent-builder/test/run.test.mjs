import test from "node:test";
import assert from "node:assert/strict";
import { runAgent, addMeter, usageTokens, USAGE_KEYS } from "../src/run.mjs";
import { defineAgent, defineTool, PUBLIC } from "../src/define.mjs";
import { LIMIT_DEFAULTS } from "../src/limits.mjs";

// ── fixtures, DERIVED from the real producers ────────────────────────────────
// A fake that is MORE capable hides bugs exactly like one that is less, so the
// agent and tools here come from defineAgent/defineTool rather than being typed.
const tool = (name, run, scope = PUBLIC) => defineTool({
  name, description: `does ${name}`, input: { type: "object" }, scope, run,
});
const agentWith = (tools = [], limits = {}) => defineAgent({
  name: "t", model: "claude-sonnet-5", instructions: "do the thing", tools, limits,
});
// A `send` driven by a script. Records every call so the per-call arguments can
// be read back, and NEVER invents an answer past the end of its script.
function scripted(answers) {
  const calls = [];
  const send = async (req) => {
    calls.push(req);
    const a = answers[calls.length - 1];
    if (a === undefined) throw new Error("scripted send ran past its script");
    if (typeof a === "function") return a(req);
    return a;
  };
  send.calls = calls;
  return send;
}
const says = (text, usage = { inputTokens: 1, outputTokens: 1 }) => ({ text, toolCalls: [], usage, costMicros: 1 });
const wants = (...names) => ({
  text: "", usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1,
  toolCalls: names.map((n, i) => ({ id: `c${i}`, name: n, args: {} })),
});

// ── the happy paths ──────────────────────────────────────────────────────────
test("a model that asks for nothing has ANSWERED, and the run says so", async () => {
  const send = scripted([says("all done")]);
  const r = await runAgent({ agent: agentWith(), prompt: "hi", send });
  assert.equal(r.ok, true);
  assert.equal(r.stop.reason, "answered");
  assert.equal(r.text, "all done");
  assert.equal(r.used.steps, 1);
  assert.equal(r.used.toolCalls, 0);
  assert.equal(send.calls.length, 1);
  assert.ok(Object.isFrozen(r), "the run record can be mutated after the fact");
});

test("a tool is called, its answer goes back to the model, and the model then answers", async () => {
  const seen = [];
  const t = tool("look", async (args, ctx) => { seen.push({ args, ctx }); return { found: 7 }; });
  const send = scripted([wants("look"), says("it is 7")]);
  const r = await runAgent({ agent: agentWith([t]), prompt: "how many", send, });
  assert.equal(r.text, "it is 7");
  assert.equal(r.used.toolCalls, 1);
  assert.equal(r.steps.length, 2);
  assert.deepEqual(r.steps[0].results[0].value, { found: 7 });
  // The second call must SEE the tool's answer, or the loop is not a loop.
  const second = JSON.stringify(send.calls[1].messages);
  assert.ok(second.includes("found"), "the tool result never reached the next model call");
  // The tool is told who it is acting for — the tenancy thread.
  assert.equal(seen[0].ctx.agent, "t");
  assert.equal(seen[0].ctx.step, 1);
});

test("the tools put on the wire are the provider's shape, with no run and no scope", async () => {
  const send = scripted([says("ok")]);
  await runAgent({ agent: agentWith([tool("look", async () => 1)]), prompt: "x", send });
  assert.deepEqual(send.calls[0].tools, [
    { name: "look", description: "does look", input_schema: { type: "object" } },
  ]);
  assert.equal(send.calls[0].model, "claude-sonnet-5");
  assert.equal(send.calls[0].system, "do the thing");
});

// ── the bounds, each NAMED ───────────────────────────────────────────────────
test("A RUNAWAY LOOP IS STOPPED BY `steps`, AND THE BOUND NAMES ITSELF", async () => {
  // A model that asks for a tool for ever. This is the case the whole module
  // exists for: "a cap the model is only told about is not a cap".
  const t = tool("look", async () => 1);
  const send = async () => wants("look");
  const r = await runAgent({ agent: agentWith([t], { steps: 3 }), prompt: "go", send });
  assert.equal(r.ok, false);
  assert.equal(r.stop.reason, "spent", `stopped for "${r.stop.reason}" instead of a spent bound`);
  assert.equal(r.stop.bound, "steps");
  assert.equal(r.stop.limit, 3);
  assert.equal(r.used.steps, 3, "the step meter did not stop where the bound is");
  assert.equal(r.steps.length, 3);
});

test("A STEP IS COUNTED BEFORE THE CALL — or a send that always throws never ends", async () => {
  // Counted after, `used.steps` would stay 0 while `send` threw, and the loop
  // would spin for ever. Proven two ways: the meter moves on a thrown call, and
  // the run terminates.
  let calls = 0;
  const send = async () => { calls++; throw new Error("provider down"); };
  const r = await runAgent({ agent: agentWith([], { steps: 2 }), prompt: "x", send });
  assert.equal(r.used.steps, 1, "a thrown call did not count against the step budget");
  assert.equal(calls, 1, "the run RETRIED a failed call — nobody asked it to spend that");
  assert.equal(r.stop.reason, "call-failed");
  assert.match(r.stop.error, /provider down/);
  assert.equal(r.steps[0].failed, true);
});

test("the wall clock ends a run, on a FAKE clock so the branch is driven not waited on", async () => {
  let t = 0;
  const now = () => t;
  const send = async () => { t += 400; return wants("look"); };
  const r = await runAgent({
    agent: agentWith([tool("look", async () => 1)], { wallMs: 1000 }), prompt: "x", send, now,
  });
  assert.equal(r.stop.bound, "wallMs");
  assert.equal(r.stop.reason, "spent");
  assert.ok(r.used.wallMs >= 1000, `wall reported ${r.used.wallMs}`);
});

test("the per-call ceiling is min(its own cap, what the run has LEFT)", async () => {
  let t = 0;
  const now = () => t;
  const send = scripted([
    (req) => { assert.equal(req.callMs, Math.min(LIMIT_DEFAULTS.callMs, 10_000)); t += 9_500; return wants("look"); },
    (req) => { assert.equal(req.callMs, 500, `second call got ${req.callMs}ms of a 10s run 9.5s in`); return says("done"); },
  ]);
  const r = await runAgent({
    agent: agentWith([tool("look", async () => 1)], { wallMs: 10_000 }), prompt: "x", send, now,
  });
  assert.equal(r.ok, true);
  assert.equal(send.calls.length, 2);
});

test("a money bound ends the run and names itself", async () => {
  const send = async () => ({ ...wants("look"), costMicros: 400 });
  const r = await runAgent({
    agent: agentWith([tool("look", async () => 1)], { costMicros: 1000 }), prompt: "x", send,
  });
  assert.equal(r.stop.bound, "costMicros");
  assert.equal(r.used.costMicros, 1200, "the meter stopped short of what was really spent");
});

test("AN UNMEASURED SPEND AGAINST A FINITE BUDGET STOPS THE RUN, and names why", async () => {
  // A provider that reports no usage. Reading that as "no tokens" would let the
  // run spend for ever against a budget it believes it is inside.
  const send = async () => ({ text: "", toolCalls: [{ id: "a", name: "look", args: {} }], usage: null, costMicros: null });
  const r = await runAgent({
    agent: agentWith([tool("look", async () => 1)], { tokens: 5000 }), prompt: "x", send,
  });
  assert.equal(r.stop.reason, "unmeasured", `stopped for "${r.stop.reason}"`);
  assert.ok(["tokens", "costMicros"].includes(r.stop.bound));
  assert.equal(r.used.tokens, null, "an unmeasured total was reported as a number");
});

test("...AND AN UNMEASURED SPEND AGAINST AN UNBOUNDED BUDGET IS NOT A STOP", async () => {
  // The other half. Without it the rule above is a nuisance that stops every run
  // on a provider that happens not to report usage.
  const send = scripted([
    { text: "", toolCalls: [{ id: "a", name: "look", args: {} }], usage: null, costMicros: null },
    { text: "fine", toolCalls: [], usage: null, costMicros: null },
  ]);
  const r = await runAgent({
    agent: agentWith([tool("look", async () => 1)], { tokens: Infinity, costMicros: Infinity }),
    prompt: "x", send,
  });
  assert.equal(r.ok, true, `an unbounded budget stopped on "${r.stop.reason}"`);
  assert.equal(r.text, "fine");
});

test("A BATCH THAT WOULD OUTRUN THE TOOL BUDGET IS REFUSED WHOLE, never as a prefix", async () => {
  // A prefix would perform real side effects whose results nobody reads.
  let ran = 0;
  const t = (n) => tool(n, async () => { ran++; return 1; });
  const send = async () => wants("a", "b", "c");
  const r = await runAgent({
    agent: agentWith([t("a"), t("b"), t("c")], { toolCalls: 2 }), prompt: "x", send,
  });
  assert.equal(r.stop.bound, "toolCalls");
  assert.equal(r.stop.reason, "batch-would-exceed");
  assert.equal(r.stop.asked, 3);
  assert.equal(ran, 0, `${ran} tools ran for a batch that was refused — side effects nobody reads`);
});

// ── failures that must not end the run ───────────────────────────────────────
test("A TOOL THAT THROWS IS A RESULT, NOT A DEAD RUN — the model is shown the error", async () => {
  const bad = tool("bad", async () => { throw new Error("upstream 500"); });
  const good = tool("good", async () => ({ ok: 1 }));
  const send = scripted([wants("bad", "good"), says("recovered")]);
  const r = await runAgent({ agent: agentWith([bad, good]), prompt: "x", send });
  assert.equal(r.ok, true, "one failing tool ended the whole run");
  const res = r.steps[0].results;
  assert.equal(res.length, 2, "the failed tool was dropped, so position stopped meaning anything");
  assert.equal(res[0].ok, false);
  assert.match(res[0].error, /upstream 500/);
  assert.equal(res[1].ok, true);
  // And the model SAW it, or it waits for an answer that never comes.
  assert.match(JSON.stringify(send.calls[1].messages), /upstream 500/);
});

test("A TOOL THE MODEL INVENTED IS A READABLE RESULT, and fails closed", async () => {
  const send = scripted([wants("nope"), says("ok then")]);
  const r = await runAgent({ agent: agentWith([tool("real", async () => 1)]), prompt: "x", send });
  assert.equal(r.ok, true);
  assert.equal(r.steps[0].results[0].ok, false);
  assert.match(r.steps[0].results[0].error, /no such tool/);
});

test("A WITHHELD TOOL NAMED BY THE MODEL SAYS IT IS NOT PERMITTED, not 'no such tool'", async () => {
  // The two need different fixes — one is a grant, one is a hallucination — so
  // collapsing them is the one way this could mislead rather than go quiet.
  const secret = tool("refund", async () => "paid", "money:write");
  const send = scripted([wants("refund"), says("cannot")]);
  const r = await runAgent({ agent: agentWith([secret]), prompt: "x", send, tenant: { id: "t1", grants: [] } });
  assert.match(r.steps[0].results[0].error, /not permitted for this tenant/);
  assert.equal(r.steps[0].results[0].ok, false);
  // THE CONTROL: with the grant it really runs, so the refusal is about the wall.
  const send2 = scripted([wants("refund"), says("done")]);
  const ok = await runAgent({
    agent: agentWith([secret]), prompt: "x", send: send2, tenant: { id: "t1", grants: ["money:write"] },
  });
  assert.equal(ok.steps[0].results[0].value, "paid", "the observer is dead: the tool never runs at all");
});

test("THE TENANCY WALL KEEPS A WITHHELD TOOL OFF THE WIRE, and says which", async () => {
  const send = scripted([says("ok")]);
  const r = await runAgent({
    agent: agentWith([tool("open", async () => 1), tool("refund", async () => 1, "money:write")]),
    prompt: "x", send, tenant: { id: "t9", grants: [] },
  });
  assert.deepEqual(send.calls[0].tools.map((t) => t.name), ["open"],
    "a tool this tenant cannot use was described to the model anyway");
  assert.deepEqual([...r.withheld], [{ name: "refund", scope: "money:write" }],
    "the withholding was silent — nobody can say why the agent could not do it");
  assert.equal(r.tenant, "t9");
});

test("tools run in parallel, bounded by the run's own parallelTools", async () => {
  let inFlight = 0, peak = 0;
  const t = (n) => tool(n, async () => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 0));
    inFlight--; return n;
  });
  const names = ["a", "b", "c", "d", "e"];
  const send = scripted([wants(...names), says("done")]);
  const r = await runAgent({
    agent: agentWith(names.map(t), { parallelTools: 2 }), prompt: "x", send,
  });
  assert.equal(peak, 2, `${peak} tools ran at once against a bound of 2`);
  assert.equal(r.steps[0].results.length, 5);
});

// ── the meters ───────────────────────────────────────────────────────────────
test("addMeter: unmeasured is sticky, and rubbish is unmeasured rather than ignored", () => {
  assert.equal(addMeter(0, 5), 5);
  assert.equal(addMeter(5, 5), 10);
  assert.equal(addMeter(null, 5), null, "a broken meter repaired itself and started lying");
  for (const bad of [null, undefined, NaN, -1, "5", ["5"], {}]) {
    assert.equal(addMeter(10, bad), null, `${String(bad)} was counted as a spend`);
  }
});

test("usageTokens: every kind counts, and nothing reported is null rather than 0", () => {
  assert.equal(usageTokens({ inputTokens: 10, outputTokens: 5 }), 15);
  // A cached read is priced at a tenth and counts in FULL here: a budget is not
  // a bill.
  assert.equal(usageTokens({ inputTokens: 1, outputTokens: 1, cacheReadTokens: 100, cacheWriteTokens: 8 }), 110);
  assert.equal(usageTokens({}), null, "a provider that said nothing was read as having spent nothing");
  for (const bad of [null, undefined, "10", [1], { inputTokens: "10" }, { inputTokens: NaN }, { inputTokens: -1 }]) {
    assert.equal(usageTokens(bad), null, `${JSON.stringify(bad) ?? String(bad)} produced a number`);
  }
  assert.ok(USAGE_KEYS.length >= 4, "the kinds list shrank — the observer is dead");
});

test("A PER-RUN LIMIT OVERRIDE NARROWS THE AGENT'S OWN, AND CANNOT RAISE IT", async () => {
  // The untrusted door, DRIVEN. A value computed and never forwarded looks
  // identical from outside to one the caller never sent — twelve-plus features
  // have shipped dead in the root product for exactly that reason, so the wiring
  // is asserted by behaviour rather than by reading the call.
  const t = tool("look", async () => 1);
  const send = async () => wants("look");

  // Narrowing takes effect: the agent allows 8 steps, the run asks for 2.
  const narrow = await runAgent({ agent: agentWith([t], { steps: 8 }), prompt: "x", send, limits: { steps: 2 } });
  assert.equal(narrow.stop.bound, "steps");
  assert.equal(narrow.used.steps, 2, `the per-run override did nothing — ran ${narrow.used.steps} steps`);

  // Raising does NOT: an untrusted caller cannot buy a longer run.
  const raise = await runAgent({ agent: agentWith([t], { steps: 2 }), prompt: "x", send, limits: { steps: 99 } });
  assert.equal(raise.used.steps, 2, `a per-run override RAISED the agent's bound to ${raise.used.steps}`);

  // And with no override the agent's own bound still governs — the control,
  // without which both cases above pass against a runAgent that ignores limits
  // entirely and always stops at 2.
  const plain = await runAgent({ agent: agentWith([t], { steps: 5 }), prompt: "x", send });
  assert.equal(plain.used.steps, 5, "the observer is dead: the agent's own limits are not being read");
});

test("A PROMPT IS REFUSED, NEVER COERCED INTO AN EMPTY RUN", async () => {
  // This used to become `""`: a model asked nothing, an answer about nothing, and
  // a bill. `String(["hi"])` is `"hi"`, so coercing would not have been better.
  let calls = 0;
  const send = async () => { calls++; return says("ok"); };
  for (const bad of [undefined, null, 4, ["hi"], {}, "", "   ", true]) {
    await assert.rejects(() => runAgent({ agent: agentWith(), prompt: bad, send }), { name: "TypeError" },
      `prompt ${JSON.stringify(bad) ?? String(bad)} was accepted`);
  }
  assert.equal(calls, 0, "a refused prompt still reached the model and was billed for");
  // The control: a real prompt still runs, so the refusal is about the input.
  const r = await runAgent({ agent: agentWith(), prompt: "hi", send });
  assert.equal(r.ok, true, "the observer is dead: no prompt is accepted at all");
});

test("an agent exposes NO unscoped dispatch table", () => {
  // `Object.freeze` does not freeze a Map's contents, so a `byName` Map hanging
  // off the frozen agent was one `.set()` away from being a way round the
  // tenancy wall — and nothing read it.
  const a = agentWith([tool("look", async () => 1)]);
  assert.equal(a.byName, undefined, "an unscoped dispatch table is exposed on the agent again");
  for (const [k, v] of Object.entries(a)) {
    assert.ok(!(v instanceof Map), `${k} is a Map on a frozen object, which freeze does not protect`);
  }
});

test("runAgent refuses arguments it cannot use, rather than failing later", async () => {
  await assert.rejects(() => runAgent({ agent: { kind: "nope" }, send: async () => says("x") }), { name: "TypeError" });
  await assert.rejects(() => runAgent({ agent: agentWith(), send: "send" }), { name: "TypeError" });
  await assert.rejects(() => runAgent({}), { name: "TypeError" });
});

import test from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../src/run.mjs";
import { replay } from "../src/journal.mjs";
import { argsHash } from "../src/approvals.mjs";
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

test("A PER-RUN LIMIT OVERRIDE NARROWS THE AGENT'S OWN, AND CANNOT RAISE IT", async () => {
  // The untrusted door, DRIVEN. A value computed and never forwarded looks
  // identical from outside to one the caller never sent, which is how a whole
  // feature ships dead, so the wiring is asserted by behaviour rather than by
  // reading the call.
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

// ════════════════════════════════════════════════════════════════════════════
// THE JOURNAL AND RESUME
// ════════════════════════════════════════════════════════════════════════════

const journalOf = () => { const log = []; return { log, append: async (e) => { log.push(e); } }; };

test("the journal records started, model, tool and stopped — in that order", async () => {
  const j = journalOf();
  const send = scripted([wants("look"), says("done")]);
  const r = await runAgent({ agent: agentWith([tool("look", async () => 1)]), prompt: "go", send, journal: j, tenant: { id: "t1" } });
  assert.equal(r.ok, true);
  assert.deepEqual(j.log.map((e) => e.kind), ["started", "model", "tool", "model", "stopped"]);
  assert.equal(j.log[0].prompt, "go");
  assert.equal(j.log[0].tenant, "t1");
  assert.equal(j.log.at(-1).stop.reason, "answered");
});

test("THE MODEL ANSWER IS WRITTEN BEFORE ANY TOOL RUNS", async () => {
  // It cost money. It is the one artifact a crash must never take, and every
  // later entry is cheap by comparison.
  const order = [];
  const j = { log: [], append: async (e) => { order.push("journal:" + e.kind); j.log.push(e); } };
  const send = scripted([wants("look"), says("done")]);
  await runAgent({
    agent: agentWith([tool("look", async () => { order.push("tool ran"); return 1; })]),
    prompt: "go", send, journal: j,
  });
  // BOTH ANCHORS PROVED PRESENT FIRST. `indexOf(a) < indexOf(b)` is satisfied by
  // -1 for a missing `a`, so without these two lines this case stays green against
  // a loop that never records the model answer at all — the vacuous-ordering trap.
  assert.ok(order.includes("journal:model"), `no model answer was recorded at all: ${order.join(" → ")}`);
  assert.ok(order.includes("tool ran"), `the tool never ran: ${order.join(" → ")}`);
  assert.ok(order.indexOf("journal:model") < order.indexOf("tool ran"),
    `the tool ran before its model answer was recorded: ${order.join(" → ")}`);
});

test("A JOURNAL THAT CANNOT WRITE STOPS THE RUN AND SAYS SO", async () => {
  // A caller who passed a journal asked for durability. Carrying on without it
  // produces a run that looks resumable and is not, and the work is then paid for
  // twice. Nothing is lost by stopping: the record still carries everything.
  let calls = 0;
  const send = async () => { calls++; return says("done"); };
  const j = { append: async () => { throw new Error("disk gone"); } };
  const r = await runAgent({ agent: agentWith(), prompt: "go", send, journal: j });
  assert.equal(r.ok, false);
  assert.equal(r.stop.reason, "journal-failed");
  assert.match(r.stop.error, /disk gone/);
  assert.equal(calls, 0, "the model was called before durability was established");
});

test("EVERY KIND OF JOURNAL WRITE IS CHECKED — a census, one failing kind at a time", async () => {
  // A SWEEP SURVIVOR IS WHY THIS EXISTS. The first version used a journal that
  // failed on everything, so when a mutant made the loop ignore the MODEL write
  // the run reached the STOPPED write, failed there instead, and came back
  // `journal-failed` anyway — the assertion passing for the wrong reason. A
  // fixture too shallow to separate two readings certifies neither.
  const failOn = (kind) => ({ append: async (e) => { if (e.kind === kind) throw new Error(`no ${kind}`); } });
  const withTool = () => agentWith([tool("look", async () => 1)]);

  // started: nothing has been spent, so nothing is lost.
  const a = await runAgent({ agent: agentWith(), prompt: "go", send: async () => says("x"), journal: failOn("started") });
  assert.equal(a.stop.reason, "journal-failed");
  assert.equal(a.stop.step, 0);

  // model: the expensive artifact. The run stops, and the step it paid for is
  // still on the returned record.
  let modelCalls = 0;
  const b = await runAgent({
    agent: agentWith(), prompt: "go",
    send: async () => { modelCalls++; return says("hi"); }, journal: failOn("model"),
  });
  assert.equal(b.stop.reason, "journal-failed", `a failed MODEL write produced "${b.stop.reason}"`);
  assert.equal(b.stop.step, 1);
  assert.equal(b.used.steps, 1, "the step that happened was not on the record");
  assert.equal(modelCalls, 1);

  // tool: a result that cannot be recorded means the batch is unreadable later.
  const c = await runAgent({
    agent: withTool(), prompt: "go", send: scripted([wants("look"), says("done")]), journal: failOn("tool"),
  });
  assert.equal(c.stop.reason, "journal-failed", `a failed TOOL write produced "${c.stop.reason}"`);
  assert.equal(c.stop.step, 1);

  // stopped: the run really did answer, and it says which stop it could not write.
  const d = await runAgent({ agent: agentWith(), prompt: "go", send: async () => says("hi"), journal: failOn("stopped") });
  assert.equal(d.stop.reason, "journal-failed");
  assert.equal(d.stop.was, "answered", "the stop it could not record was not named");

  // THE CONTROL: a journal that writes everything lets the run finish, or every
  // case above passes against a loop that always reports journal-failed.
  const ok = await runAgent({ agent: withTool(), prompt: "go", send: scripted([wants("look"), says("done")]), journal: journalOf() });
  assert.equal(ok.ok, true, "the observer is dead: no run can finish with a journal at all");
});

test("runAgent refuses a journal it cannot write to, and a `from` that is not a log", async () => {
  await assert.rejects(() => runAgent({ agent: agentWith(), prompt: "x", send: async () => says("a"), journal: {} }), { name: "TypeError" });
  await assert.rejects(() => runAgent({ agent: agentWith(), send: async () => says("a"), from: "entries" }), { name: "TypeError" });
});

// ── resume. Every fixture below is a REAL run's log, truncated. ──────────────
// A hand-typed "crashed log" is a fake in a different shape from reality; this
// derives them from the real producer, which is the rule.
// ════════════════════════════════════════════════════════════════════════════
// WHAT A TOOL IS TOLD ITS CALL IS — and every case here exists because a sweep
// said so. ELEVEN mutants survived the M5 round and EIGHT of them were in this
// one region: nothing in `test/*.test.mjs` had ever read `ctx.operation` as
// `run.mjs` BUILDS it, or resumed a batch holding two different calls. The
// identity was proved end to end by `verify:tools`, which the sweep cannot run —
// *a property proven only by an instrument the sweep cannot run is a property no
// mutant can be caught by*, recorded once already in this directory.
// ════════════════════════════════════════════════════════════════════════════

/** A tool that records the context it was handed, so the identity can be read. */
const watcher = (name, over = {}) => {
  const seen = [];
  return { seen, tool: defineTool({
    name, description: `does ${name}`, input: { type: "object" }, scope: PUBLIC,
    repeatable: true, run: async (args, ctx) => { seen.push({ args, operation: ctx.operation }); return { ok: true }; },
    ...over }) };
};

test("⚠ A TOOL IS TOLD ITS CALL'S OWN IDENTITY — the run, the position AND the arguments", async () => {
  const w = watcher("act");
  const r = await runAgent({
    agent: agentWith([w.tool]), prompt: "go", operationSeed: "run-77",
    send: scripted([{ text: "", usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1,
                      toolCalls: [{ id: "c0", name: "act", args: { id: "a" } },
                                  { id: "c1", name: "act", args: { id: "b" } }] }, says("done")]),
  });
  assert.equal(r.ok, true);
  assert.equal(w.seen.length, 2);
  // ⚠ **PAIRED BY THE ARGUMENTS, NEVER BY POSITION IN `seen` — this case read
  // `w.seen[0]` and was INTERMITTENTLY RED, about 1 run in 30 and only with the whole
  // suite running.** The tools of one batch go through `runFanout`, and this module
  // `await`s `operationKey` — which is `crypto.subtle.digest` — INSIDE the per-call
  // worker, before the tool is invoked. Two concurrent digests may resolve in either
  // order, so the tools are invoked in either order and `seen` is pushed in THAT order.
  // The product is right: `fanout`'s own note says every entry carries its INDEX
  // precisely because answers finish out of order — and this case then read by position.
  // A flake is worse here than anywhere else, because in a sweep an intermittent
  // failure reads as a KILL, which says a property is guarded when nothing asked.
  const opOf = (id) => w.seen.find((s) => s.args?.id === id)?.operation;
  // EVERY PART IS ASSERTED, and the hash is the REAL one rather than a pattern: a
  // shape check would pass for an identity built out of the wrong pieces. The INDEX is
  // asserted too — it is what ties a call back to its slot — so pairing by arguments
  // gives up no part of the claim.
  assert.equal(opOf("a"), `run-77:1:0:${await argsHash({ id: "a" })}`);
  assert.equal(opOf("b"), `run-77:1:1:${await argsHash({ id: "b" })}`);
  // AND THE TWO ARE DIFFERENT, which is the property a single call cannot show.
  assert.notEqual(opOf("a"), opOf("b"));
  // AND THE READING IS ORDER-INDEPENDENT, ASSERTED RATHER THAN HOPED — the same finder
  // over a REVERSED `seen` answers the same two identities. Without this the fix would
  // rest on the order that happens to come back on the machine it was written on, which
  // is what the flake was.
  const rev = [...w.seen].reverse();
  const revOf = (id) => rev.find((x) => x.args?.id === id)?.operation;
  assert.equal(revOf("a"), opOf("a"));
  assert.equal(revOf("b"), opOf("b"));
});

test("...AND THE ARGUMENTS ARE PART OF IT, so a re-filled slot cannot inherit an identity", async () => {
  // THE CASE THE POSITION ALONE CANNOT SEE. Two runs ask the same tool at the same
  // step and index; only the arguments differ, and the identities must differ with
  // them — or a redelivery that answered differently would be absorbed into work
  // nobody asked for.
  const ask = async (args) => {
    const w = watcher("act");
    await runAgent({
      agent: agentWith([w.tool]), prompt: "go", operationSeed: "run-77",
      send: scripted([{ text: "", usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1,
                        toolCalls: [{ id: "c0", name: "act", args }] }, says("done")]),
    });
    return w.seen[0].operation;
  };
  const one = await ask({ id: "a" });
  const two = await ask({ id: "b" });
  assert.notEqual(one, two, "two different calls at one position share an identity");
  // AND THE SAME CALL IS THE SAME IDENTITY — without this, "they differ" is satisfied
  // by an identity that is simply random.
  assert.equal(await ask({ id: "a" }), one, "the same call derived a different identity");
  // The seed is part of it too, so two runs never collide.
  const w = watcher("act");
  await runAgent({
    agent: agentWith([w.tool]), prompt: "go", operationSeed: "run-88",
    send: scripted([{ text: "", usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1,
                      toolCalls: [{ id: "c0", name: "act", args: { id: "a" } }] }, says("done")]),
  });
  assert.notEqual(w.seen[0].operation, one, "two runs derive one identity");
});

test("⚠ AND WITH NO SEED THERE IS NO IDENTITY, rather than a partial one", async () => {
  const w = watcher("act");
  await runAgent({
    agent: agentWith([w.tool]), prompt: "go",   // no operationSeed
    send: scripted([wants("act"), says("done")]),
  });
  assert.equal(w.seen[0].operation, null,
    "a run with no seed handed a tool an identity built out of what it had");
});

test("⚠ ARGUMENTS THAT CANNOT BE WRITTEN DOWN ARE ANSWERED, NOT RUN", async () => {
  // A call that cannot be RECORDED cannot be resumed, approved or identified — so it
  // is the one call none of this product's guarantees apply to, and it comes back as a
  // readable tool result the model can correct itself from. The same wall shape as
  // "no such tool", for the same reason.
  const w = watcher("act");
  const cycle = {}; cycle.self = cycle;
  const r = await runAgent({
    agent: agentWith([w.tool]), prompt: "go", operationSeed: "run-77",
    send: scripted([{ text: "", usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1,
                      toolCalls: [{ id: "c0", name: "act", args: cycle }] }, says("done")]),
  });
  assert.equal(r.ok, true, "the run should carry on and tell the model");
  assert.deepEqual(w.seen, [], "a call whose arguments cannot be recorded was made");
  const said = r.steps[0].results[0];
  assert.equal(said.ok, false);
  assert.match(said.error, /cannot be recorded/);
  assert.match(said.error, /^act:/, "the refusal does not name the tool");
  // NOT read as an unresolved write: nothing was sent, so nothing can have happened.
  assert.equal("unresolved" in said, false);
});

async function logOfInterruptedRun({ tools, script, killAfter }) {
  const j = journalOf();
  const send = scripted(script);
  await runAgent({ agent: agentWith(tools), prompt: "go", send, journal: j, tenant: { id: "t1" } });
  return j.log.slice(0, killAfter);
}

test("A RESUMED RUN CARRIES ON, and does not redo the step it already paid for", async () => {
  const t = tool("look", async () => ({ hit: 1 }));
  // started, model(1), tool(0), model(2), stopped → cut the last two: the process
  // died after the tool answered and before the next model call.
  const entries = await logOfInterruptedRun({
    tools: [t], script: [wants("look"), says("done")], killAfter: 3,
  });
  assert.deepEqual(entries.map((e) => e.kind), ["started", "model", "tool"]);

  const send = scripted([says("finished after resume")]);
  const r = await runAgent({ agent: agentWith([t]), send, from: entries, tenant: { id: "t1" } });
  assert.equal(r.ok, true);
  assert.equal(r.text, "finished after resume");
  assert.equal(r.resumed, true);
  // ONE model call in this segment: step 1 was not bought again.
  assert.equal(send.calls.length, 1, `the resume re-sent ${send.calls.length} calls`);
  // It continued at step 2, and the meters carried over rather than restarting.
  assert.equal(send.calls[0].step, 2, `resumed at step ${send.calls[0].step}`);
  assert.equal(r.used.steps, 2, `the step meter restarted at ${r.used.steps}`);
  assert.equal(r.used.toolCalls, 1);
  // And the model was handed the WHOLE conversation, tool result included.
  const sent = JSON.stringify(send.calls[0].messages);
  assert.match(sent, /"go"/);
  assert.match(sent, /hit/);
});

test("A FINISHED RUN IS NOT RESTARTED — it answers what it answered", async () => {
  const j = journalOf();
  await runAgent({ agent: agentWith(), prompt: "go", send: scripted([says("the answer")]), journal: j });
  let calls = 0;
  const r = await runAgent({ agent: agentWith(), send: async () => { calls++; return says("a second bill"); }, from: j.log });
  assert.equal(calls, 0, "replaying a finished run bought another model call");
  assert.equal(r.ok, true);
  assert.equal(r.stop.reason, "answered");
  assert.equal(r.stop.text, "the answer");
});

test("A LOG THAT CANNOT BE READ IS NOT RESUMED", async () => {
  let calls = 0;
  const send = async () => { calls++; return says("x"); };
  const r = await runAgent({ agent: agentWith(), send, from: [{ kind: "nope" }] });
  assert.equal(r.stop.reason, "journal-unreadable");
  assert.ok(r.stop.problems.length >= 1, "it refused without saying what was wrong");
  assert.equal(calls, 0, "it spent money on a log it could not read");
});

test("A PENDING NON-REPEATABLE TOOL REFUSES THE RESUME, AND NAMES IT", async () => {
  // The log cannot say whether the tool ran — the process died before it could.
  // So the question is not "did it run" but "is running it again safe".
  const charge = tool("charge", async () => "paid");   // repeatable defaults to false
  const entries = await logOfInterruptedRun({
    tools: [charge], script: [wants("charge"), says("done")], killAfter: 2,
  });
  assert.deepEqual(entries.map((e) => e.kind), ["started", "model"]);

  let ran = 0, calls = 0;
  const again = tool("charge", async () => { ran++; return "paid"; });
  const r = await runAgent({
    agent: agentWith([again]), send: async () => { calls++; return says("x"); }, from: entries,
  });
  assert.equal(r.stop.reason, "cannot-resume");
  // RE-ANCHORED, NOT APPEASED: the refusal now says whether each blocked call is
  // UNRESOLVED — a `writes` tool that may have changed something outside this run —
  // because that is what somebody deciding about a stranded run has to know, and the stop
  // is the only place they can read it. `charge` here declares neither, so it is a call
  // that blocked the resume and changed nothing outside the run.
  assert.deepEqual([...r.stop.pending], [{ step: 1, index: 0, name: "charge", unresolved: false }]);
  assert.equal(ran, 0, "a tool that might already have charged somebody was run again");
  assert.equal(calls, 0);
});

test("⚠ A RESUMED BATCH GIVES EACH CALL ITS OWN ARGUMENTS AND ITS OWN IDENTITY", async () => {
  // **TWO PENDING CALLS IS THE ONLY SHAPE THAT SEPARATES THE TWO READINGS.** With one,
  // "its own arguments" and "the first pending call's arguments" are the same object and
  // the same identity — so every earlier resume case passed with the pairing reversed, and
  // a sweep mutant reading `prior.pending[0]` survived all of them.
  const w = watcher("act");
  // A journal that keeps the model answer and REFUSES both tool results: the process died
  // after the batch was dispatched, which is what a resume is for.
  const log = [];
  const j = { log, append: async (e) => { if (e.kind === "tool") throw new Error("store died"); log.push(e); } };
  await runAgent({
    agent: agentWith([w.tool]), prompt: "go", journal: j, operationSeed: "run-77",
    send: scripted([{ text: "", usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1,
                      toolCalls: [{ id: null, name: "act", args: { id: "a" } },
                                  { id: null, name: "act", args: { id: "b" } }] }]),
  });
  assert.deepEqual(log.map((e) => e.kind), ["started", "model"], "the results were recorded after all");

  // THE IDS ARE BOTH NULL ON PURPOSE — a model is not obliged to give one, and that is
  // exactly the log in which the arguments used to be mixed up.
  const w2 = watcher("act");
  const r = await runAgent({
    agent: agentWith([w2.tool]), from: [...log], operationSeed: "run-77",
    journal: { append: async () => {} }, send: scripted([says("done")]),
  });
  assert.equal(r.ok, true, JSON.stringify(r.stop));
  assert.deepEqual(w2.seen.map((c) => c.args), [{ id: "a" }, { id: "b" }],
    "a resumed call ran with another call's arguments");
  assert.deepEqual(w2.seen.map((c) => c.operation), [
    `run-77:1:0:${await argsHash({ id: "a" })}`,
    `run-77:1:1:${await argsHash({ id: "b" })}`,
  ], "a resumed call's identity was not built from its own arguments");
});

test("⚠ AND A RESUMED WRITE THAT THREW IS UNRESOLVED TOO, not just a live one", async () => {
  // The resume path records its own entries, so it has its own copy of this decision —
  // and a sweep mutant that dropped it there survived the live-path case entirely.
  const writer = defineTool({
    name: "charge", description: "takes money", input: { type: "object" }, scope: PUBLIC,
    writes: true, repeatable: true, run: async () => { throw new Error("the wire went"); },
  });
  const log = [];
  const j = { log, append: async (e) => { if (e.kind === "tool") throw new Error("store died"); log.push(e); } };
  await runAgent({
    agent: agentWith([writer]), prompt: "go", journal: j,
    send: scripted([wants("charge")]),
  });
  const kept = [];
  const r = await runAgent({
    agent: agentWith([writer]), from: [...log], journal: { append: async (e) => { kept.push(e); } },
    send: scripted([says("done")]),
  });
  assert.equal(r.ok, true, JSON.stringify(r.stop));
  const entry = kept.find((e) => e.kind === "tool");
  assert.equal(entry.ok, false);
  assert.equal(entry.unresolved, true, "a resumed write that threw was recorded as a plain failure");
  // AND THE MODEL WAS TOLD, through the replay the resume rebuilds the conversation from.
  const said = replay([...log, entry]).messages.at(-1).content[0];
  assert.match(said.result, /UNRESOLVED/);
});

test("⚠ AND A BLOCKED CALL THAT WRITES IS NAMED AS UNRESOLVED", async () => {
  // `writes` says this tool changes something outside the run, so a pending one may have
  // done it. A tool that only reads cannot have, and the two are different things for a
  // person to act on — one needs checking, the other needs nothing.
  //
  // It is declared WITH `repeatable: false` by hand rather than through `defineTool`,
  // because that door refuses the pair: a write that cannot be repeated can never finish
  // after an interruption. This is the shape a caller can still build, and the stop has
  // to read correctly for it.
  const writer = { ...tool("charge", async () => "paid"), writes: true };
  const entries = await logOfInterruptedRun({
    tools: [writer], script: [wants("charge"), says("done")], killAfter: 2,
  });
  const r = await runAgent({ agent: agentWith([writer]), send: async () => says("x"), from: entries });
  assert.equal(r.stop.reason, "cannot-resume");
  assert.deepEqual([...r.stop.pending], [{ step: 1, index: 0, name: "charge", unresolved: true }]);
});

test("⚠ AN UNRESOLVED WRITE IS SAID TO THE MODEL, not only recorded beside it", async () => {
  // A SWEEP SURVIVOR IS WHY THIS EXISTS. Every assertion I first wrote was about the
  // ENTRY, so the argument `toolResultFor` takes could be cut and nothing noticed — and
  // the model's view is the whole reason the distinction exists at all. A flag a model is
  // not shown changes nothing about what it does next.
  const writer = defineTool({
    name: "charge", description: "takes money", input: { type: "object" }, scope: PUBLIC,
    writes: true, repeatable: true, run: async () => { throw new Error("the wire went"); },
  });
  const reader = defineTool({
    name: "look", description: "reads", input: { type: "object" }, scope: PUBLIC,
    repeatable: true, run: async () => { throw new Error("the wire went"); },
  });
  const j = journalOf();
  // The send is HELD, because what the model was shown is its SECOND request's messages —
  // the only place the tool results reach it.
  const send = scripted([wants("charge", "look"), says("done")]);
  const r = await runAgent({ agent: agentWith([writer, reader]), prompt: "go", journal: j, send });
  assert.equal(r.ok, true, "a failed tool should not end the run");

  // THE ENTRY, and only for the write.
  const entries = j.log.filter((e) => e.kind === "tool");
  assert.equal(entries.find((e) => e.name === "charge").unresolved, true);
  assert.equal("unresolved" in entries.find((e) => e.name === "look"), false,
    "a read that failed was recorded as maybe-having-happened");

  // ⚠ WHAT THE MODEL WAS SHOWN, off the request that really went out.
  assert.equal(send.calls.length, 2, "the model was not asked a second time");
  const shown = send.calls[1].messages.at(-1).content;
  const chargeResult = shown.find((x) => x.name === "charge");
  const lookResult = shown.find((x) => x.name === "look");
  assert.equal(chargeResult.unresolved, true);
  assert.match(chargeResult.result, /UNRESOLVED/, "the model was not told in the text");
  assert.match(chargeResult.result, /check before doing it again/);
  assert.match(chargeResult.result, /the wire went/, "the real error was dropped");
  assert.equal("unresolved" in lookResult, false);
  assert.doesNotMatch(lookResult.result, /UNRESOLVED/, "a read that failed was said to be unknown");

  // AND THE RUN'S OWN RECORD, which is what a caller reads.
  const results = r.steps[0].results;
  assert.equal(results.find((x) => x.name === "charge").unresolved, true);
  assert.equal("unresolved" in results.find((x) => x.name === "look"), false);
});

test("...AND A REPLAY SAYS THE SAME THING, so a resumed conversation is not a different one", () => {
  // The other half, and a sweep survivor too: `replay` reads `unresolved` back off the
  // entry and hands it to the SAME composer the live loop uses. Without it a resumed run
  // would show the model a plain failure where the first attempt showed an unknown — two
  // conversations for one log, which is the thing `journal.mjs` exists to prevent.
  const calls = [{ id: "c0", name: "charge", args: {} }];
  const state = replay([
    { kind: "started", at: 1, prompt: "go", tenant: "t", agent: "a" },
    { kind: "model", at: 2, step: 1, ms: 1, text: "", toolCalls: calls },
    { kind: "tool", at: 3, step: 1, index: 0, name: "charge", ms: 1, ok: false,
      error: "the wire went", unresolved: true },
  ]);
  const said = state.messages.at(-1).content[0];
  assert.equal(said.unresolved, true);
  assert.match(said.result, /UNRESOLVED/);
  // AND THE OBSERVER IS ALIVE: the same entry without the flag reads as a plain failure.
  const plain = replay([
    { kind: "started", at: 1, prompt: "go", tenant: "t", agent: "a" },
    { kind: "model", at: 2, step: 1, ms: 1, text: "", toolCalls: calls },
    { kind: "tool", at: 3, step: 1, index: 0, name: "charge", ms: 1, ok: false, error: "the wire went" },
  ]).messages.at(-1).content[0];
  assert.equal("unresolved" in plain, false);
  assert.doesNotMatch(plain.result, /UNRESOLVED/);
});

test("...AND A PENDING REPEATABLE TOOL IS RE-RUN, so the run carries on", async () => {
  // The other half, and without it `repeatable` would be decoration.
  const readSpec = { name: "look", description: "reads", input: { type: "object" }, scope: PUBLIC, repeatable: true };
  const look = defineTool({ ...readSpec, run: async () => ({ hit: 1 }) });
  const entries = await logOfInterruptedRun({
    tools: [look], script: [wants("look"), says("done")], killAfter: 2,
  });

  let ran = 0;
  const look2 = defineTool({ ...readSpec, run: async (args) => { ran++; return { hit: 1, args }; } });
  const send = scripted([says("done after resume")]);
  const r = await runAgent({ agent: agentWith([look2]), send, from: entries });
  assert.equal(ran, 1, `a repeatable pending tool ran ${ran} times`);
  assert.equal(r.ok, true);
  assert.equal(r.text, "done after resume");
  // Its answer reached the model, which is the point of re-running it.
  assert.match(JSON.stringify(send.calls[0].messages), /hit/);
  // And the tool was handed the args it was originally called with, out of the log.
  assert.match(JSON.stringify(send.calls[0].messages), /args/);
});

test("the journal keeps growing across a resume, so the log stays the whole story", async () => {
  const t = defineTool({ name: "look", description: "d", input: { type: "object" }, scope: PUBLIC, repeatable: true, run: async () => 1 });
  const first = journalOf();
  await runAgent({ agent: agentWith([t]), prompt: "go", send: scripted([wants("look"), says("done")]), journal: first });
  const entries = first.log.slice(0, 3);

  const second = journalOf();
  await runAgent({ agent: agentWith([t]), send: scripted([says("after")]), from: entries, journal: second });
  // The resume's OWN journal records only what happened in its segment — it does
  // not rewrite history, because the log is append-only and the caller owns where
  // the entries are kept.
  assert.deepEqual(second.log.map((e) => e.kind), ["model", "stopped"]);
  assert.equal(second.log.at(-1).stop.reason, "answered");
});

test("an unbounded limit survives the log, where JSON would turn it into null", async () => {
  // `JSON.stringify(Infinity)` is `"null"`, and a later reader would take that
  // null as "no limit recorded" — cannot-tell reading as a value, arriving
  // through a serialiser rather than through a reader.
  const j = journalOf();
  await runAgent({
    agent: agentWith([], { wallMs: Infinity }), prompt: "go",
    send: scripted([says("ok")]), journal: j,
  });
  assert.equal(j.log[0].limits.wallMs, "Infinity");
  assert.equal(JSON.parse(JSON.stringify(j.log[0].limits)).wallMs, "Infinity",
    "the unbounded limit did not survive a round trip through JSON");
});

// ── the backend a tool reaches ───────────────────────────────────────────────

test("⚠ THE SCOPED BACKEND REACHES THE TOOL — the hop a capability dies at in silence", async () => {
  // **THE WIRING LAYER**, in the one place a capability can be perfectly correct and
  // completely dead. `runAgent` takes the already-scoped operations and puts them on the
  // tool context; if that one assignment is cut, every capability tool answers
  // `no-backend` and the run still completes, still answers, and still reads as success
  // from every other angle. MEASURED: a mutant replacing `opts.capabilities ?? null` with
  // `null` SURVIVED the whole suite — nothing drove a tool through `runAgent` with a
  // backend behind it.
  const reached = [];
  const can = { listMemory: async () => { reached.push("listMemory"); return [{ name: "tone" }]; } };
  const t = defineTool({
    name: "recall", description: "recall", input: { type: "object" }, scope: PUBLIC,
    run: async (_args, ctx) => {
      if (!ctx?.capabilities) return { ok: false, error: "no-backend" };
      return { ok: true, memories: await ctx.capabilities.listMemory() };
    },
  });
  const r = await runAgent({
    agent: agentWith([t]), prompt: "what do you remember", capabilities: can,
    send: scripted([wants("recall"), says("your tone is plain")]),
  });
  assert.equal(r.ok, true, r.stop?.reason);
  assert.deepEqual(reached, ["listMemory"], "the tool never reached the backend");
  assert.deepEqual(r.steps[0].results[0].value, { ok: true, memories: [{ name: "tone" }] });

  // THE CONTROL, without which "it reached the backend" is satisfied by a tool that
  // reaches one however it was built: the SAME run with no capabilities refuses by name.
  const none = await runAgent({
    agent: agentWith([t]), prompt: "what do you remember",
    send: scripted([wants("recall"), says("nothing")]),
  });
  assert.deepEqual(none.steps[0].results[0].value, { ok: false, error: "no-backend" });
  assert.deepEqual(reached, ["listMemory"], "a run with no backend reached one anyway");
});

test("⚠ AND SO DOES THE ONE THAT REACHES OUTSIDE — a SECOND seam, a second hop to lose", async () => {
  // The same wiring layer one seam over, and the one place it can be correct and dead. This
  // is the fourteenth-odd instance of the class in this repository, so it gets its own case
  // rather than being assumed to ride along with `capabilities`: they are two assignments
  // and cutting either leaves the run completing, answering and reading as success.
  const reached = [];
  const via = { perform: async (a) => { reached.push(a.action); return { ok: true, result: { sent: true } }; } };
  const t = defineTool({
    name: "post", description: "post", input: { type: "object" }, scope: PUBLIC,
    run: async (_args, ctx) => {
      if (!ctx?.connections) return { ok: false, error: "no-connections" };
      return ctx.connections.perform({ connection: "c", action: "send_message" });
    },
  });
  const r = await runAgent({
    agent: agentWith([t]), prompt: "send it", connections: via,
    send: scripted([wants("post"), says("sent")]),
  });
  assert.equal(r.ok, true, r.stop?.reason);
  assert.deepEqual(reached, ["send_message"], "the tool never reached the connection seam");

  // ⚠ THE CONTROL, AND IT IS THE ONE THAT MATTERS HERE: the same run with `capabilities` and
  // NO `connections` must still refuse. Without it, "it reached a seam" is satisfied by a
  // tool that read whichever object happened to be on the context.
  const wrong = await runAgent({
    agent: agentWith([t]), prompt: "send it", capabilities: { listMemory: async () => [] },
    send: scripted([wants("post"), says("no")]),
  });
  assert.deepEqual(wrong.steps[0].results[0].value, { ok: false, error: "no-connections" });
  assert.deepEqual(reached, ["send_message"], "a run with no connections reached one anyway");

  // AND A JUNK SEAM IS REFUSED AT THE DOOR rather than becoming a context a tool calls a
  // method on, which is a TypeError in front of a customer instead of a sentence.
  for (const bad of ["ops", 4, true]) {
    await assert.rejects(
      () => runAgent({ agent: agentWith(), prompt: "go", send: scripted([says("ok")]), connections: bad }),
      /already scoped/, `connections of ${JSON.stringify(bad)} was accepted`);
  }
});

test("capabilities that are not operations are refused at the door, not at the tool", async () => {
  // A junk backend must not become a tool context a tool then calls a method on — that is
  // a TypeError in front of a customer instead of a sentence.
  for (const bad of ["ops", 4, true]) {
    await assert.rejects(
      () => runAgent({ agent: agentWith(), prompt: "go", send: scripted([says("ok")]), capabilities: bad }),
      /already scoped/, `capabilities of ${JSON.stringify(bad)} was accepted`);
  }
  // `null` and absent are the same real answer — a deployment with no store behind it.
  for (const none of [null, undefined]) {
    const r = await runAgent({ agent: agentWith(), prompt: "go", send: scripted([says("ok")]), capabilities: none });
    assert.equal(r.ok, true);
  }
});

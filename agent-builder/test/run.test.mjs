import test from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../src/run.mjs";
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

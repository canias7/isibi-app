import test from "node:test";
import assert from "node:assert/strict";
import {
  replay, startedEntry, modelEntry, toolEntry, stoppedEntry,
  userMessage, assistantMessage, toolMessage, toolResultFor, ENTRY_KINDS,
  limitsToJson, limitsFromJson, UNBOUNDED,
} from "../src/journal.mjs";

// ── fixtures, DERIVED from the real constructors ──────────────────────────────
const started = (o = {}) => startedEntry({ at: 0, tenant: "t1", agent: "a", model: "m", prompt: "go", limits: { steps: 8 }, ...o });
const model = (o = {}) => modelEntry({ at: 0, step: 1, ms: 100, text: "", toolCalls: [], usage: { inputTokens: 5, outputTokens: 5 }, costMicros: 20, ...o });
const call = (id, name) => ({ id, name, args: { q: id } });
const toolOk = (o = {}) => toolEntry({ at: 0, step: 1, index: 0, name: "look", ms: 10, ok: true, value: { hit: 1 }, ...o });

test("the kind list is derived and every constructor produces one of them", () => {
  assert.deepEqual([...ENTRY_KINDS], ["started", "model", "tool", "stopped"]);
  for (const e of [started(), model(), toolOk(), stoppedEntry({ at: 0, stop: { reason: "answered" } })]) {
    assert.ok(ENTRY_KINDS.includes(e.kind), `${e.kind} is not a journal kind`);
    assert.ok(Object.isFrozen(e), `a ${e.kind} entry can be mutated after it is written`);
  }
});

// ── status ───────────────────────────────────────────────────────────────────
test("an empty log is NEW, a started log is RUNNING, a stopped log is STOPPED", () => {
  assert.equal(replay([]).status, "new");
  assert.equal(replay([started()]).status, "running");
  assert.equal(replay([started(), stoppedEntry({ at: 9, stop: { reason: "answered", text: "hi" } })]).status, "stopped");
  // The absence of a stop is what says "still going" — so an interrupted run and
  // a finished one are different logs rather than the same log read two ways.
  assert.equal(replay([started(), model()]).status, "running");
});

test("a stopped log carries the original stop back", () => {
  const r = replay([started(), model({ text: "done" }), stoppedEntry({ at: 9, stop: { reason: "answered", text: "done", step: 1 } })]);
  assert.deepEqual(r.stop, { reason: "answered", text: "done", step: 1 });
});

// ── the conversation ─────────────────────────────────────────────────────────
test("the conversation is rebuilt in order: user, assistant, tool", () => {
  const calls = [call("c0", "look"), call("c1", "count")];
  const r = replay([
    started(), model({ toolCalls: calls, text: "checking" }),
    toolOk({ index: 0, name: "look", value: { hit: 1 } }),
    toolEntry({ at: 0, step: 1, index: 1, name: "count", ms: 5, ok: false, error: "boom" }),
    model({ step: 2, text: "it is 1" }),
  ]);
  assert.deepEqual(r.messages, [
    userMessage("go"),
    assistantMessage("checking", calls.map((c) => ({ id: c.id, name: c.name, args: c.args }))),
    toolMessage([
      toolResultFor(calls[0], true, { hit: 1 }),
      toolResultFor(calls[1], false, "boom"),
    ]),
    assistantMessage("it is 1"),
  ]);
});

test("a step with no tool calls gets no tool message", () => {
  const r = replay([started(), model({ text: "just words" })]);
  assert.equal(r.messages.length, 2);
  assert.equal(r.messages[1].toolCalls, undefined, "an assistant message with no calls carried a toolCalls key");
});

test("STEPS ARE REBUILT IN ASCENDING ORDER, not in append order", () => {
  // A log is evidence, not a promise. Rebuilding a conversation out of order
  // would be worse than refusing to.
  const r = replay([started(), model({ step: 2, text: "second" }), model({ step: 1, text: "first" })]);
  assert.deepEqual(r.messages.map((m) => m.content), ["go", "first", "second"]);
  assert.equal(r.step, 2);
});

// ── the meters ───────────────────────────────────────────────────────────────
test("the meters are rebuilt from the log, counting the whole asked-for batch", () => {
  const r = replay([
    started(),
    model({ step: 1, toolCalls: [call("c0", "look"), call("c1", "x")], usage: { inputTokens: 10, outputTokens: 2 }, costMicros: 30 }),
    toolOk({ index: 0 }), toolOk({ index: 1, name: "x" }),
    model({ step: 2, usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 5 }),
  ]);
  assert.equal(r.used.steps, 2);
  assert.equal(r.used.tokens, 14);
  assert.equal(r.used.costMicros, 35);
  // Counted the way the live loop counts it — the whole batch when it was asked
  // for — or a resumed run believes it has more tool budget left than it does.
  assert.equal(r.used.toolCalls, 2);
});

test("`used.wallMs` IS WORK TIME, NOT CALENDAR TIME", () => {
  // A run that died at midnight and resumes at nine did not spend nine hours
  // working. Charging it nine hours would fail every resumed run on arrival.
  const r = replay([
    started({ at: 0 }),
    model({ step: 1, at: 1_000, ms: 100, toolCalls: [call("c0", "look")] }),
    toolOk({ at: 50_000_000, index: 0, ms: 10 }),        // hours later by the clock
    model({ step: 2, at: 60_000_000, ms: 200 }),
  ]);
  assert.equal(r.used.wallMs, 310, `wall read ${r.used.wallMs} — calendar time leaked into the budget`);
  // A missing or nonsense ms contributes nothing rather than NaN, which would
  // make every later comparison false and silently disable the wall bound.
  const junk = replay([started(), model({ ms: undefined }), model({ step: 2, ms: -5 })]);
  assert.equal(junk.used.wallMs, 0);
  assert.ok(!Number.isNaN(junk.used.wallMs));
});

test("an unreported usage makes the replayed total UNMEASURED, not smaller", () => {
  const r = replay([started(), model({ usage: null, costMicros: null })]);
  assert.equal(r.used.tokens, null, "a gap in the log was rebuilt as zero spend");
  assert.equal(r.used.costMicros, null);
});

// ── pending: the resume hazard ───────────────────────────────────────────────
test("A TOOL CALL WITH NO RESULT IS PENDING, and is named", () => {
  const calls = [call("c0", "look"), call("c1", "charge")];
  const r = replay([started(), model({ toolCalls: calls }), toolOk({ index: 0, name: "look" })]);
  // RE-ANCHORED, NOT APPEASED: the slot carries its OWN arguments now, which is a
  // strictly stronger claim than the four fields this used to assert. They are taken off
  // `calls[index]` at the moment the slot is made, so nothing later can pair a slot with
  // another slot's arguments — see the case below, which is the defect that bought this.
  assert.deepEqual([...r.pending], [{ step: 1, index: 1, name: "charge", id: "c1", args: { q: "c1" } }]);
  // The results we DO have are still in the conversation — a partial batch is not
  // a lost batch.
  assert.deepEqual(r.messages[2], toolMessage([toolResultFor(calls[0], true, { hit: 1 })]));
});

test("⚠ EACH PENDING SLOT CARRIES ITS OWN ARGUMENTS, and an absent call id cannot mix them", () => {
  // MEASURED as a real defect before this: the arguments were looked up LATER, by the
  // call's `id` — and a model is not obliged to give one. `modelEntry` stores
  // `id: c.id ?? null`, so with two ids null a `.find` answered the FIRST call's
  // arguments for both, and on a resume `forget` ran with `remember`'s arguments: the
  // agent forgot the fact it had just been told to keep, and the name it was asked to
  // forget was never touched.
  const calls = [
    { id: null, name: "remember", args: { name: "tone", value: "warm" } },
    { id: null, name: "forget", args: { name: "old_note" } },
  ];
  const r = replay([started(), model({ toolCalls: calls })]);
  assert.deepEqual([...r.pending], [
    { step: 1, index: 0, name: "remember", id: null, args: { name: "tone", value: "warm" } },
    { step: 1, index: 1, name: "forget", id: null, args: { name: "old_note" } },
  ]);
  // A call that legitimately takes no arguments keeps that answer — `undefined` here is
  // "this tool takes none", not "we could not recover them".
  const none = replay([started(), model({ toolCalls: [{ id: "c0", name: "list_memory" }] })]);
  assert.equal(none.pending[0].args, undefined);
});

test("⚠ A STORED `toolCalls` THAT IS NOT A LIST IS NAMED, and invents no slots", () => {
  // MEASURED before this: `toolCalls: "junk"` came back as FOUR pending calls named
  // `null` and four tool calls on the meter, with `problems` EMPTY — a string is
  // iterable by index and `.length` is its character count. A run resumed from such a
  // log was billed for calls nobody made and told "cannot resume" about calls that do
  // not exist. This is the function whose own documentation says a junk entry is named.
  // ⚠ WRITTEN AS A RAW ENTRY, because `modelEntry` CANNOT PRODUCE THIS SHAPE — it maps
  // the list and throws on a string. That is the producer being right, and it is exactly
  // why the reader still has to be checked: this log came back from STORAGE, which means
  // it came from outside, and nothing outside goes through the producer.
  const junkEntry = { kind: "model", at: 1, step: 1, ms: 1, text: "thinking", toolCalls: "junk" };
  assert.throws(() => model({ toolCalls: "junk" }), TypeError, "the producer can build this after all");
  const r = replay([started(), junkEntry]);
  assert.equal(r.pending.length, 0);
  assert.equal(r.used.toolCalls, 0);
  assert.equal(r.problems.length, 1, "an unreadable tool-call list was accepted");
  assert.match(r.problems[0], /step 1: the model entry's tool calls are not a list/);
  // The step itself is still counted and its text still reaches the conversation — the
  // answer was paid for, and dropping it would rebuild a shorter run than really happened.
  assert.equal(r.used.steps, 1);
  assert.deepEqual(r.messages.at(-1), { role: "assistant", content: "thinking" });
  // AND THE OBSERVER IS ALIVE: a real list is still read.
  const ok = replay([started(), model({ toolCalls: [call("c0", "look")] })]);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.pending.length, 1);
});

test("nothing is pending when every call has an answer", () => {
  const calls = [call("c0", "look")];
  assert.deepEqual([...replay([started(), model({ toolCalls: calls }), toolOk({ index: 0 })]).pending], []);
});

// ── problems: a junk entry is named, never skipped ───────────────────────────
test("A JUNK ENTRY IS NAMED, NEVER SILENTLY SKIPPED", () => {
  // Skipping one rebuilds a SHORTER conversation and a SMALLER bill than the run
  // really had: the model sent a history missing a step, the meters
  // under-reporting. Entries come back from storage, so they come from outside.
  for (const junk of [null, undefined, 4, "model", [], {}, { kind: "nope" }]) {
    const r = replay([started(), junk]);
    assert.equal(r.problems.length, 1, `${JSON.stringify(junk) ?? String(junk)} was accepted as an entry`);
    assert.match(r.problems[0], /entry 1/);
  }
});

test("a contradictory log is named rather than resolved by guessing", () => {
  assert.match(replay([started(), started()]).problems[0], /a second "started"/);
  assert.match(replay([started(), model(), model()]).problems[0], /a second model answer for step 1/);
  assert.match(
    replay([started(), model({ toolCalls: [call("c0", "look")] }), toolOk(), toolOk()]).problems[0],
    /a second result for step 1 tool 0/);
  assert.match(replay([started(), stoppedEntry({ at: 1, stop: {} }), stoppedEntry({ at: 2, stop: {} })]).problems[0], /a second "stopped"/);
  // A log with entries but no start cannot say whose run it was or what was asked.
  assert.match(replay([model()]).problems[0], /no "started" entry/);
  // A model or tool entry with no usable position cannot be placed at all.
  assert.match(replay([started(), model({ step: 0 })]).problems[0], /model with no usable step/);
  assert.match(replay([started(), toolEntry({ at: 0, step: 1, index: "0", ms: 1, ok: true })]).problems[0], /no usable step\/index/);
  // THE CONTROL: a healthy log has no problems, or every case above passes
  // against a replay that complains about everything.
  assert.deepEqual([...replay([started(), model(), stoppedEntry({ at: 1, stop: { reason: "answered" } })]).problems], []);
});

test("replay refuses a non-array rather than reading past it", () => {
  for (const bad of [null, undefined, 4, "entries", {}]) {
    assert.throws(() => replay(bad), { name: "TypeError" });
  }
});

test("what the started entry recorded comes back", () => {
  const r = replay([started()]);
  assert.equal(r.prompt, "go");
  assert.equal(r.tenant, "t1");
  assert.equal(r.agent, "a");
  assert.equal(r.model, "m");
  assert.deepEqual(r.limits, { steps: 8 });
});

// ── the limits codec: the one place Infinity crosses JSON ────────────────────
test("THE FACT THE CODEC EXISTS FOR: JSON.stringify(Infinity) is \"null\"", () => {
  // Written out straight, an unbounded limit arrives as a null — and a reader
  // cannot tell that null from "no limit was recorded".
  assert.equal(JSON.stringify(Infinity), "null");
  assert.equal(JSON.parse(JSON.stringify({ wallMs: Infinity })).wallMs, null);
});

test("an unbounded limit survives a full JSON round trip as a number", () => {
  const limits = { steps: 8, wallMs: Infinity, tokens: Infinity, costMicros: 2000 };
  const back = limitsFromJson(JSON.parse(JSON.stringify(limitsToJson(limits))));
  assert.equal(back.wallMs, Infinity, "an unbounded limit did not come back unbounded");
  assert.equal(back.tokens, Infinity);
  assert.equal(back.steps, 8);
  assert.equal(back.costMicros, 2000);
  assert.equal(limitsToJson(limits).wallMs, UNBOUNDED, "the marker is not what is stored");
});

test("A STORED NULL STAYS NULL AND DOES NOT BECOME UNBOUNDED", () => {
  // The most expensive possible reading of a missing value: a limit that failed to
  // record becoming no limit at all.
  const back = limitsFromJson({ wallMs: null, steps: 4 });
  assert.equal(back.wallMs, null, "a null limit decoded to unbounded");
  assert.notEqual(back.wallMs, Infinity);
  assert.equal(back.steps, 4);
});

test("the codec drops the report arrays and refuses what is not an object", () => {
  // `narrowed`/`refused`/`unknown` are a record of what a plan ignored, not bounds.
  const encoded = limitsToJson({ steps: 4, narrowed: ["steps"], refused: [], unknown: [] });
  assert.deepEqual(Object.keys(encoded), ["steps"]);
  for (const bad of [null, undefined, 4, "limits"]) assert.equal(limitsToJson(bad), null);
  for (const bad of [null, undefined, 4, "limits", ["steps"]]) assert.equal(limitsFromJson(bad), null);
});

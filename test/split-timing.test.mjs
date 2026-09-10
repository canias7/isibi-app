// BOTH SPLITS LEAVE A MARK A STORED ROW CAN BE READ FOR
// (2026-09-10, owner: "lets fix that", after the first split build measured
// 203,000 ms against a single-call spread of 131,000–252,000 and settled
// nothing).
//
// TWO INSTRUMENTS, AND THEY FAILED IN OPPOSITE DIRECTIONS.
//
//   * THE BAND SPLIT LEFT NOTHING AT ALL. The design step has recorded which
//     designer ran since the day it shipped; the page side recorded nothing, so
//     "the fan-out ran" and "it fell through to the one call" were the same
//     stored row — and the only band-related line in worker.js was a
//     `console.log` in the branch where the fan-out is REFUSED, a log nobody
//     reads on the path nobody takes.
//   * THE DESIGN SPLIT LEFT ONE NUMBER. Whether the agents of a wave really
//     overlapped could only be asked by comparing whole builds, and the spread
//     BETWEEN builds is wider than any saving a split can produce, so that
//     comparison can never answer it.
//
// WHAT THIS FILE IS FOR, case by case, and every one is a way this ships
// looking right:
//
//   * `agentMs`/`waveMs` measured on two different clocks — the subtraction
//     that IS the instrument then reads as a number rather than as nonsense,
//     and nothing about the row says so;
//   * a wave's agents run one call after another while every landmark stays
//     where a source read looks for it (the recorded "a position is not a
//     behaviour"), which is a split that costs three round trips and buys
//     nothing;
//   * the mark handed the SHAPE rather than the projection — `shape.waves` is a
//     BOOLEAN and `tr.at` drops everything that is not a finite number, so the
//     row comes back reading exactly like a build that never split;
//   * `agents` counted off the PLAN rather than off the loop, which is true
//     until a design breaks mid-way and is a lie from then on;
//   * and the one the live database found: BOTH suppliers of the build's `mark`
//     hook were written `(n) => …` and DROPPED the second argument, so
//     `mark?.("img", { viaContainer })` has recorded the step and none of the
//     number since the day it was written. Measured on eight stored builds.
//     A new mark carrying numbers inherits that silently.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { designInWaves, waveMarks } from "../builder/design-waves.mjs";
import { generateSiteBands, splitPlan } from "../builder/page-bands.mjs";
import { makeTrace } from "../builder/trace.mjs";
import { budgetStage } from "../builder/build-budget.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
// WHOLE-LINE COMMENTS BLANKED, LENGTH PRESERVED, and this file needs it more
// than most: the comment beside the fixed hook SPELLS the broken form it
// forbids, word for word, so an unblanked scan reports the fix as the defect.
// The recorded "prose contains the thing it forbids", in the guard written for
// the change that introduced the prose.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const WORKER = read("worker.js");
const WCODE = code(WORKER);

/** Window from landmark to landmark, both asserted, the closing one searched
 *  FROM the opening one — `indexOf(end)` alone finds an earlier mention and
 *  gives `slice(bigger, smaller)`, the empty string, which passes everything
 *  inside it. */
function between(src, open, close, what) {
  const a = src.indexOf(open);
  assert.ok(a >= 0, what + ": the opening landmark is gone — " + open);
  const b = src.indexOf(close, a + open.length);
  assert.ok(b > a, what + ": the closing landmark is gone — " + close);
  return src.slice(a, b);
}

/** Let every pending microtask settle. A gate resolved this tick is read by
 *  `runFanout` on the next one, and the clock must not move in between. */
const flush = () => new Promise((r) => setImmediate(r));

/** A tool small enough to reason about, in the real one's shape. */
const toyTool = (props, required) => ({
  name: "design_schema",
  description: "toy",
  input_schema: { type: "object", properties: props, required },
});

const answer = (input) => ({ stop_reason: "tool_use", usage: {}, content: [{ type: "tool_use", input }] });

/**
 * A design run against a clock the test drives and gates the test opens.
 *
 * NO TIMERS, DELIBERATELY. Two concurrency guards one file over used
 * `setTimeout`, drifted under sweep load and came back with the comment-only
 * CONTROL killed — a guard reporting correct code as broken, which this
 * repository rates worse than a miss. `list.map(async …)` invokes every callback
 * synchronously as far as its first `await`, so by the time `designInWaves` has
 * returned its promise every call of the wave has started and parked on a gate.
 */
function driven(waves, props, required = []) {
  let t = 0;
  const gates = [];
  const call = (req) => new Promise((res) => {
    const field = Object.keys(req.tools[0].input_schema.properties)[0];
    gates.push({ field, res });
  });
  const p = designInWaves(
    { tool: toyTool(props, required), system: "s", brief: "b", model: "m", maxTokens: 1, waves },
    call,
    () => t,
  );
  return {
    gates,
    p,
    /** Move the clock, then finish one parked call, then let it be read. */
    async finish(i, at, input) {
      t = at;
      const g = gates[i];
      g.res(answer(input === undefined ? { [g.field]: g.field } : input));
      await flush();
    },
    /** Finish a call with nothing declared, so the field comes back empty. */
    async declineNothing(i, at) {
      t = at;
      gates[i].res({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "no" }] });
      await flush();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PROJECTION — one reader, numbers only
// ─────────────────────────────────────────────────────────────────────────────

test("waveMarks answers three numbers and never lets the boolean through", () => {
  // THE WALL THIS EXISTS FOR. `tr.at` keeps finite numbers and drops the rest
  // SILENTLY, so a mark handed `shape` straight records `waves: true` as
  // nothing at all — a row that reads exactly like a build that never split.
  const m = waveMarks({ tool: true, waves: true, agents: 4, agentMs: 300000, waveMs: 200000, lost: [], blocks: ["a:?"] });
  assert.deepEqual(m, { agents: 4, agentMs: 300000, waveMs: 200000 },
    "the projection let something through that is not one of the three numbers");
});

test("…and a shape it cannot read answers zeros rather than nothing", () => {
  // ABSENT AND ZERO ARE THE SAME FROM A STORED ROW, so the three keys are on
  // the answer either way. What must never happen is a number being invented.
  for (const junk of [null, undefined, "shape", 7, [], { agents: "4" }, { agentMs: NaN, waveMs: Infinity }]) {
    assert.deepEqual(waveMarks(junk), { agents: 0, agentMs: 0, waveMs: 0 },
      "a shape that cannot be read produced something other than zeros: " + JSON.stringify(junk));
  }
  // `String(["4"])` is `"4"` — the recorded coercion trap. A one-element array
  // must not read as the number it stringifies to.
  assert.deepEqual(waveMarks({ agents: ["4"], agentMs: ["1"], waveMs: ["2"] }), { agents: 0, agentMs: 0, waveMs: 0 });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE OVERLAP — the case the whole change exists for
// ─────────────────────────────────────────────────────────────────────────────

test("THE OVERLAP IS MEASURED: two agents side by side cost less wall than they cost work", async () => {
  // The instrument, stated: `agentMs` is what the work would have cost run one
  // call after another; `waveMs` is what it actually cost. The difference is
  // the overlap, answerable from ONE build with no baseline — which is the
  // whole point, because the spread between builds is wider than any saving.
  const d = driven(
    [[{ name: "a", fields: ["brand"] }, { name: "b", fields: ["slug"] }]],
    { brand: { type: "string" }, slug: { type: "string" } },
  );
  assert.equal(d.gates.length, 2, "the second agent had not started — they ran one after another");

  await d.finish(0, 100);   // agent a: 0 → 100
  await d.finish(1, 160);   // agent b: 0 → 160, overlapping a entirely
  const out = await d.p;

  assert.equal(out.shape.agentMs, 260, "the agents' own call times are not summed");
  assert.equal(out.shape.waveMs, 160, "the wave's wall time is not the wave's wall time");
  assert.equal(out.shape.agentMs - out.shape.waveMs, 100, "the overlap the two numbers exist to express");
  assert.equal(out.shape.agents, 2);
  // BOTH NUMBERS OFF ONE CLOCK. `runFanout` takes an injectable `now` and it is
  // handed THIS one; on two clocks the subtraction is between incomparable
  // things and nothing about the stored row says so.
  assert.deepEqual(waveMarks(out.shape), { agents: 2, agentMs: 260, waveMs: 160 });
});

test("…and a design that really ran one call after another says so: no overlap", async () => {
  // THE CONTROL, and without it a single case cannot tell "measures the
  // overlap" from "always reports an overlap" — a guard proves the branch it
  // drives. Two waves of one agent each is the same total work with none of it
  // shared, and the two numbers must come out EQUAL.
  const d = driven(
    [[{ name: "a", fields: ["brand"] }], [{ name: "b", fields: ["slug"] }]],
    { brand: { type: "string" }, slug: { type: "string" } },
  );
  assert.equal(d.gates.length, 1, "wave 2 started before wave 1 finished — the waves are not ordered");
  await d.finish(0, 100);
  assert.equal(d.gates.length, 2, "wave 2 never started");
  await d.finish(1, 200);
  const out = await d.p;

  assert.equal(out.shape.agentMs, 200, "100 + 100 of work");
  assert.equal(out.shape.waveMs, 200, "…and 200 of wall, because nothing overlapped");
  assert.equal(out.shape.agentMs - out.shape.waveMs, 0, "an instrument that always finds an overlap finds nothing");
});

test("a failed agent's time counts — it was spent", async () => {
  // `runFanout` puts `ms` on a FAILED entry too, and a fan-out where one call
  // died still paid for the wall clock it held. Reading only the answers would
  // report a wave as cheaper than it was, in exactly the case worth reading.
  let t = 0;
  const gates = [];
  const call = () => new Promise((res, rej) => gates.push({ res, rej }));
  const p = designInWaves(
    {
      tool: toyTool({ brand: { type: "string" }, slug: { type: "string" } }, []),
      system: "s", brief: "b", model: "m", maxTokens: 1,
      waves: [[{ name: "a", fields: ["brand"] }, { name: "b", fields: ["slug"] }]],
    },
    call,
    () => t,
  );
  t = 90;
  gates[0].rej(Object.assign(new Error("upstream said no"), { status: 429 }));
  await flush();
  t = 140;
  gates[1].res(answer({ slug: "slug" }));
  await flush();
  const out = await p;

  assert.equal(out.shape.agentMs, 230, "the failed agent's 90 ms was dropped");
  assert.equal(out.shape.waveMs, 140);
  assert.equal(out.shape.agents, 2, "an agent that failed still ran");
});

// ─────────────────────────────────────────────────────────────────────────────
// `agents` IS WHAT RAN
// ─────────────────────────────────────────────────────────────────────────────

test("agents counts what RAN, not what was planned — a broken design stops early", async () => {
  // THE DIFFERENCE THE ROUTE COULD NOT SEE. It counted `designWaves.flat()`,
  // the plan, which is right on every build that finishes and wrong on every
  // one that does not: a required field lost in wave 1 ends the design there,
  // so wave 2's agent never runs and never costs anything. The first split
  // build's trace said four agents because four were planned.
  const waves = [[{ name: "a", fields: ["brand"] }], [{ name: "b", fields: ["slug"] }]];
  const planned = waves.flat().length;
  assert.equal(planned, 2, "the fixture no longer plans two agents");

  const d = driven(waves, { brand: { type: "string" }, slug: { type: "string" } }, ["brand"]);
  await d.declineNothing(0, 120);
  const out = await d.p;

  assert.equal(d.gates.length, 1, "wave 2 ran on a design that had already lost a required field");
  assert.equal(out.input, null, "a design missing a required field is not a usable design");
  assert.equal(out.shape.agents, 1, "the loop counted the plan, not the run");
  assert.notEqual(out.shape.agents, planned, "…and the two are indistinguishable on this build");
  assert.equal(out.shape.agentMs, 120, "the one agent that ran was still paid for");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WORKER'S SIDE — the design mark
// ─────────────────────────────────────────────────────────────────────────────

test("the design mark takes the projection, and the numbers are spelled in one place", () => {
  const block = between(WCODE, 'tr.at("design"', "knownTables", "the design trace mark");
  assert.ok(/\.\.\.waveMarks\(designedShape\)/.test(block), "the mark no longer asks the projection");
  assert.ok(/waves: designWaves\.length/.test(block),
    "the PLANNED wave count is gone — a design that broke must read as fewer agents than waves, which needs both");
  // ONE PROJECTION. The two millisecond names must not be spelled in worker.js
  // at all: a second reader there is "two lists of the same thing" with the one
  // subject where a drift is a number nobody can check.
  assert.ok(!/\bagentMs\b|\bwaveMs\b/.test(WCODE),
    "worker.js spells the wave timings itself — a second copy of the projection");
  assert.ok(/import \{[^}]*\bwaveMarks\b[^}]*\} from "\.\/builder\/design-waves\.mjs"/.test(WCODE),
    "waveMarks is not imported from the module that owns it");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WORKER'S SIDE — the band mark
// ─────────────────────────────────────────────────────────────────────────────

test("a page written in pieces leaves a bands step; a page written in one call leaves none", () => {
  // THE STEP'S PRESENCE IS THE FLAG, so where it sits is the whole property.
  // Inside the fan-out branch it says "this build split"; anywhere below the
  // fallback it would fire on every build and say nothing.
  const fanBranch = between(WCODE, "const fan = await generateSiteBands({", "if (!isNoFanout(e)) throw e;", "the fan-out branch");
  assert.ok(/mark\?\.\("bands"/.test(fanBranch), "the fan-out records nothing — a split page and a single-call page are one row again");
  assert.ok(/bands: Number\(fan && fan\.bands\) \|\| 0/.test(fanBranch), "the mark does not carry how many bands were asked for");
  assert.ok(/wrote: Number\(fan && fan\.wrote\) \|\| 0/.test(fanBranch), "the mark does not carry how many answered");
  assert.ok(/return fan;/.test(fanBranch), "the fan-out's answer is no longer returned — the mark ate it");

  // Exactly one, and it is that one. A second `bands` mark on the single-call
  // path is the flag saying "split" about a build that did not.
  assert.equal((WCODE.match(/mark\?\.\("bands"/g) || []).length, 1, "the bands mark is written more than once");

  // The single call is BELOW the fan-out's catch and must carry no mark of its
  // own — asserted against the real neighbour rather than by position.
  const single = between(WCODE, "console.log(\"build: the container would not take a fan-out", "return await generateSitePages(env, briefWithLayout", "the fallback to one call");
  assert.ok(!/mark\?\.\("bands"/.test(single), "the fallback marks the build as split after falling back to the one call");

  // A TRACE MUST NEVER BREAK A BUILD. Every other mark in this function is
  // wrapped; this one carries an expression that reads a field off an answer.
  assert.ok(/try \{ mark\?\.\("bands"[\s\S]{0,200}?\} catch \{/.test(fanBranch),
    "the bands mark is not wrapped — a trace that throws takes the build with it");
});

test("a deadline landing on the bands mark says the pages are not written YET", () => {
  // THE MARK IS A SUB-STEP OF `gen`, and the case that settles which stage it
  // belongs to is the fan-out where every band failed: the mark still fires,
  // carrying `wrote: 0`, and there is no page. "Publish" would tell that
  // customer their pages exist. "Generate" is true then and briefly understated
  // otherwise — `img` corrects it a moment later — which is the direction that
  // costs nothing.
  assert.equal(budgetStage([{ s: "gen" }, { s: "bands" }]), "generate",
    "the bands mark reads as a stage that promises the customer more than happened");
  // And it must be KNOWN, not merely falling through: an unknown name walks
  // back to `gen` and answers "generate" too, so the two are indistinguishable
  // from this call alone. Asked with nothing before it, an unknown name answers
  // the default.
  assert.equal(budgetStage([{ s: "bands" }]), "generate",
    "the bands mark is not in the table at all — it is being described by the step before it");
});

test("generateSiteBands really answers bands and wrote, on BOTH of its return paths", async () => {
  // DRIVEN, because `Number(undefined) || 0` is 0 — a mark reading a field the
  // producer does not have records a clean build for every page and nothing
  // says so. The recorded "assert the CHAIN": the producer, then the hop, then
  // the reader.
  //
  // THE PATH WORTH DRIVING HERE IS THE SECOND ONE. `band-build` already drives
  // the ordinary return with a failed band (4 asked, 3 written); the EARLY
  // return — every band empty, `input: null` — is a separate `return` statement
  // with its own copy of both fields, and it is exactly the build whose trace
  // is most worth reading.
  const shape = [{ path: "/", sections: ["a hero", "three prices", "a footer"] }];
  const lines = splitPlan({ shape, route: "/", mode: "build" });
  assert.equal(lines.length, 3, "the fixture no longer splits into three bands");
  const args = {
    brief: "A guitar school in Sheffield.", spec: { tables: [] }, brand: "Crookes Guitar School",
    attachments: [], model: "grok-4.6", kind: "shopfront", route: "/",
    chrome: { name: "Crookes Guitar School", links: [{ label: "Home", to: "/" }] }, lines,
  };
  const band = (source) => ({ stop_reason: "tool_use", usage: {}, content: [{ type: "tool_use", input: { source } }] });
  const src = (i) => "function Band" + i + "X() { return <div>band " + i + "</div>; }";

  // One band lost. It is STUBBED rather than dropped, so `wrote < bands` is a
  // page missing a section — which is the whole reading the two numbers buy.
  const one = await generateSiteBands(args, {}, async (keys, reqs) => reqs.map((r, i) => (i === 1
    ? { i, state: "failed", status: 429, detail: "", message: "no", kind: "HttpError" }
    : { i, state: "done", answer: band(src(i)) })), null);
  assert.equal(one.bands, 3, "the fan-out does not say how many bands it asked for");
  assert.equal(one.wrote, 2, "a lost band is invisible in the count — a stubbed page reads as a clean one");

  // EVERY BAND LOST. A different `return`, and a build that published nothing.
  const none = await generateSiteBands(args, {}, async (keys, reqs) =>
    reqs.map((r, i) => ({ i, state: "failed", status: 500, detail: "", message: "no", kind: "HttpError" })), null);
  assert.equal(none.input, null, "a page of nothing but stubs is not a page");
  assert.equal(none.bands, 3, "the early return dropped the count — the mark then records a build that asked for nothing");
  assert.equal(none.wrote, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE HOOK — the defect the live database found
// ─────────────────────────────────────────────────────────────────────────────

test("every mark hook handed to the build forwards its numbers, and they are DRIVEN", () => {
  // WHAT THIS COST BEFORE IT WAS FOUND: both suppliers were written to take one
  // argument, so `mark?.("img", { viaContainer })` recorded the step and none of
  // the number — on eight stored builds every `img` step reads `{s, ms}` and
  // nothing else. Three source reads in `container-model` asserted the CALL and
  // no stored row asserted the hop, which is "a chain asserted by reading is
  // asserted at the layer below the break".
  //
  // CUT OUT AND RUN, never read, for exactly that reason: a supplier that takes
  // two arguments and forwards one satisfies every text match there is.
  const lines = WCODE.split("\n").map((l, i) => [l, i]).filter(([l]) => /^\s*mark: \(/.test(l));
  assert.equal(lines.length, 2, "there are " + lines.length + " mark suppliers, not 2 — a hop was added or cut");

  for (const [line, at] of lines) {
    const src = line.trim().replace(/^mark:\s*/, "").replace(/,\s*$/, "");
    const tr = makeTrace(() => 0);
    // The REAL trace module, because the wall that drops a boolean is its wall
    // and a fake with a different rule is "a fixture in a different shape from
    // reality".
    const fn = new Function("tr", "return (" + src + ");")(tr);
    fn("bands", { bands: 4, wrote: 3 });
    const step = tr.done().steps.at(-1);
    assert.equal(step.s, "bands", "worker.js:" + (at + 1) + " — the supplier did not record the step at all");
    assert.equal(step.bands, 4, "worker.js:" + (at + 1) + " — the supplier dropped its second argument");
    assert.equal(step.wrote, 3, "worker.js:" + (at + 1) + " — the supplier dropped part of its second argument");
  }
});

test("…and the trace keeps the numbers and drops everything else, which is why the projection exists", () => {
  // DRIVEN AGAINST THE REAL `tr.at`, since `waveMarks` is written entirely
  // because of this rule and a claim about it in a comment is not a test.
  const tr = makeTrace(() => 0);
  tr.at("design", { waves: true, agents: 4, agentMs: 300000, waveMs: 200000, stop: "", blocks: [] });
  const step = tr.done().steps.at(-1);
  assert.equal(step.agents, 4);
  assert.equal(step.agentMs, 300000);
  assert.equal(step.waveMs, 200000);
  assert.ok(!("waves" in step), "a boolean reached a trace — the wall this is all written around is gone");
  assert.ok(!("stop" in step) && !("blocks" in step), "a string or an array reached a trace");

  // AND THE SHAPE HANDED STRAIGHT IN RECORDS NOTHING, which is the failure the
  // projection prevents: the row then reads exactly like a build that never
  // split.
  const raw = makeTrace(() => 0);
  raw.at("design", { waves: true });
  assert.deepEqual(raw.done().steps.at(-1), { s: "design", ms: 0 },
    "the boolean landed after all — then handing the shape straight in would have worked and the projection is dead code");
});

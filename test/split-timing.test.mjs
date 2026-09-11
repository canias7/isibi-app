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
import { designInWaves, waveMarks, agentMark, DESIGN_WAVES } from "../builder/design-waves.mjs";
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
  //
  // RE-ANCHORED 2026-09-10 (the per-agent numbers). This was an exact
  // `deepEqual` against the three, so it went red the moment the projection
  // started carrying a number per agent — reporting a feature as gone for a
  // change that adds to it. Being exactly three was never the property; the
  // three being right is, and now so is each agent's own.
  assert.deepEqual(waveMarks(out.shape), { agents: 2, agentMs: 260, waveMs: 160, aMs: 100, bMs: 160 });
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
  // ONE PROJECTION FOR THE DESIGN'S PAIR. A second reader of the DESIGN shape
  // in worker.js is "two lists of the same thing" with the one subject where a
  // drift is a number nobody can check.
  //
  // RE-ANCHORED 2026-09-10 (the band split's own pair). This read
  // `!/agentMs|waveMs/.test(WCODE)` — absent from the WHOLE FILE — which was a
  // true proxy only while the design split was the only thing that had those
  // two numbers. The band mark now carries its own, legitimately, and the old
  // form reported that as a second copy of the design's projection. Being
  // absent from the file was never the property; the DESIGN mark going through
  // `waveMarks` is, so it is asked of the design block.
  assert.ok(!/\bagentMs\b|\bwaveMs\b/.test(block),
    "the design mark spells the wave timings itself — a second copy of the projection");
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

  // AND THE TWO NUMBERS THAT SAY WHETHER THE SPLIT PAID (2026-09-10).
  // `agentMs` is the serial cost, `waveMs` the parallel one; their difference is
  // the overlap, readable off ONE build — which is the only way to ask it, since
  // the single-call page step's own spread (334k-620k ms) is wider than any
  // saving a split can produce.
  assert.ok(/agentMs: Number\(fan && fan\.agentMs\) \|\| 0/.test(fanBranch), "the mark does not carry what the bands cost in turn");
  assert.ok(/waveMs: Number\(fan && fan\.waveMs\) \|\| 0/.test(fanBranch), "the mark does not carry what they cost together");

  // A TRACE MUST NEVER BREAK A BUILD. Every other mark in this function is
  // wrapped; this one carries expressions that read fields off an answer.
  //
  // RE-ANCHORED 2026-09-10: this was `try \{ mark…[\s\S]{0,200}?\} catch` — a
  // 200-BYTE window, and the mark outgrew it the moment it carried four fields
  // instead of two. Never size a source-read window in bytes; this repository
  // has been caught by that eleven times. Asked by POSITION between the nearest
  // enclosing `try` and the next `catch`, which is what "wrapped" means.
  const markAt = fanBranch.indexOf('mark?.("bands"');
  assert.ok(markAt > 0, "the bands mark is gone");
  const tryAt = fanBranch.lastIndexOf("try {", markAt);
  const catchAt = fanBranch.indexOf("} catch {", markAt);
  assert.ok(tryAt >= 0 && catchAt > markAt,
    "the bands mark is not wrapped — a trace that throws takes the build with it");
  // …and the `try` is THIS mark's, not one belonging to something above it:
  // nothing but whitespace and comments may sit between them.
  assert.equal(code(fanBranch.slice(tryAt + "try {".length, markAt)).trim(), "",
    "the bands mark rides inside somebody else's try — a wrap it does not own");
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

// ─────────────────────────────────────────────────────────────────────────────
// THE FIELD THE HOOK FIX REVIVED — and the lie it started telling
// ─────────────────────────────────────────────────────────────────────────────

/** One line of worker.js, cut out by a landmark, ready to be RUN. */
function lineHolding(needle, what) {
  const at = WCODE.indexOf(needle);
  assert.ok(at >= 0, what + ": the landmark is gone — " + needle);
  assert.equal(WCODE.indexOf(needle, at + needle.length), -1, what + ": the landmark is not unique");
  const a = WORKER.lastIndexOf("\n", at) + 1;
  const b = WORKER.indexOf("\n", at);
  return WORKER.slice(a, b < 0 ? WORKER.length : b);
}

test("the img mark answers THREE states, and 'we do not know' is not 'the Worker did it'", () => {
  // THE DEFECT THIS EXISTS FOR, found by review the day the field first landed.
  // The expression was written unguarded on the reasoning that "1/0 says the
  // whole of what has to be known". It does not: `containerPagesFire` writes
  // only `tried`, and the collector starts a fresh `genPath`, so `via` is
  // undefined on every fired build and 1/0 answered 0 — "the Worker did it" —
  // about the builds the CONTAINER held. It was invisible until the `mark` hook
  // was fixed to forward its second argument; that fix turned a silent nothing
  // into a wrong answer.
  //
  // CUT OUT AND RUN, because the property is what the trace ENDS UP HOLDING.
  // THE GUARD IS THE LANDMARK, and that is deliberate: an unguarded mark has no
  // `if (genPath.via)` to find, so the case goes red at the anchor rather than
  // silently testing something else. (A bare `mark?.("img"` is not unique — the
  // fixed line calls it on both sides of the branch.)
  const line = lineHolding('if (genPath.via) mark?.("img"', "the img mark");
  const fn = new Function("genPath", "mark", line);
  const seen = [];
  for (const genPath of [{ via: "container" }, { via: "worker" }, { tried: 1 }, {}]) {
    const tr = makeTrace(() => 0);
    fn(genPath, (n, x) => tr.at(n, x));
    seen.push(tr.done().steps.at(-1));
  }
  assert.equal(seen[0].viaContainer, 1, "a container generation is not recorded as one");
  assert.equal(seen[1].viaContainer, 0, "a worker generation is not recorded as one");
  assert.ok(!("viaContainer" in seen[2]), "a fired build with no answer yet is recorded as the WORKER — the defect");
  assert.ok(!("viaContainer" in seen[3]), "an empty genPath is recorded as the WORKER — the defect");
  // AND THE STEP IS STILL TAKEN, all four times. Dropping the mark entirely
  // would also stop the lie, and would lose the timing the step exists for.
  for (const s of seen) assert.equal(s.s, "img", "the img step stopped being recorded at all");

  // The three siblings that already read presence as the signal — so this is
  // the convention, not a new invention.
  assert.ok(/if \(genPath\.via\) out\.genVia = genPath\.via;/.test(WCODE), "the reply's genVia stopped being guarded");
  assert.ok(/\.\.\.\(genPath\.via \? \[\["genVia", genPath\.via === "container" \? 1 : 0\]\] : \[\]\)/.test(WCODE),
    "the pages mark's genVia stopped being guarded");
});

test("the collector states what it KNOWS: a collected answer is a container answer", () => {
  // `act === "finish"` is answered only for `state === "done"` on the
  // container's own job store, so the generation demonstrably ran there. The
  // collector never builds a `genPath`, so without this the one path where the
  // answer is CERTAIN was the one path that recorded nothing.
  const line = lineHolding('if (decision.act === "finish") { genPath.tried = 1;', "the collector's genPath");
  const fn = new Function("decision", "genPath", line);

  const finished = {};
  fn({ act: "finish" }, finished);
  assert.deepEqual(finished, { tried: 1, via: "container" }, "a collected answer does not record the container");

  // AND ONLY ON `finish`. A refire has not got an answer, and a give-up never
  // had one — either claiming `via` would be the same lie pointing the other
  // way.
  for (const act of ["refire", "stop", "here", ""]) {
    const g = {};
    fn({ act }, g);
    assert.deepEqual(g, {}, `act "${act}" claimed a container answer it has not got`);
  }
});

test("THE READER: a fired build reads as the container, driven through its own source", () => {
  // THE CONSUMER, and the reason this was a defect rather than an untidy row.
  // scripts/build-as-owner.mjs prefers the `pages` step and falls back to
  // `img.viaContainer` only when there is none — and a fired build HAS none,
  // because the route returns its 202 before the `pages` mark. So the fallback
  // written for exactly this case was the branch that went wrong.
  //
  // The reader's own source is cut out and RUN, never paraphrased: a
  // re-implementation here would be a second copy of the thing under test.
  const src = read("scripts/build-as-owner.mjs");
  const a = src.indexOf("const pg = steps.find");
  const b = src.indexOf("const shape = [db, tabs, via]");
  assert.ok(a >= 0 && b > a, "the owner-build reader's gen line moved — retarget this case");
  const readGen = new Function("steps", src.slice(a, b) + " return via;");

  const fired = (img) => [{ s: "fired", genTried: 1 }, { s: "resume:finish" }, { s: "gen" }, ...(img ? [{ s: "img", ...img }] : [])];

  assert.equal(readGen(fired({ viaContainer: 1 })), "gen=container",
    "a fired build whose answer came from the container does not read as the container");
  assert.equal(readGen(fired({ viaContainer: 0 })), "gen=worker",
    "the shape the defect produced no longer reads as the Worker — the case has stopped testing anything");
  assert.equal(readGen(fired({})), "",
    "an img step with no viaContainer must say nothing, not guess");

  // THE TWO STATES THAT WERE ALREADY RIGHT, so the fix cannot have moved them.
  assert.equal(readGen([{ s: "pages", genTried: 1, genVia: 1 }, { s: "img", viaContainer: 1 }]), "gen=container",
    "a synchronous build stopped reading off its pages step");
  assert.equal(readGen([{ s: "pages", genTried: 1 }]), "gen=container-holding",
    "the third answer is gone — the one that says the container has it and has not answered");
});

test("the design mark's comment no longer states a tell that does not work", () => {
  // IT WAS WRITTEN AS ONE AND IT IS FALSE. Wave widths are 1, 2, 1: a COMPLETE
  // design reads agents 4 against waves 3, and a design that broke after wave 2
  // reads 3 against 3. "Fewer agents than waves" holds only for a break in
  // wave 1, so a reader using it would call two of the three cases healthy.
  const widths = DESIGN_WAVES.map((w) => w.length);
  const waves = widths.length;
  const complete = widths.reduce((a, b) => a + b, 0);
  assert.ok(complete > waves, "the arithmetic that makes the old tell false has changed — re-read the comment");
  let ran = 0;
  const rel = widths.map((n) => { ran += n; return ran < waves; });
  assert.deepEqual(rel, [true, false, false],
    "a break is only 'fewer agents than waves' in wave 1 — if that changed, the comment can be simplified");

  // THE RAW SOURCE, NOT THE BLANKED COPY — and the first draft of this case got
  // it wrong, which is the recorded "a blanker erases the landmark the guard
  // needs". Blanking is for scans that FORBID a spelling in CODE; this one is
  // about PROSE, and against `WCODE` every comment is spaces, so the assertion
  // could never fail. Caught by applying the mutant and watching it pass.
  const at = WORKER.indexOf('tr.at("design"');
  assert.ok(at > 0, "the design trace mark is gone");
  const end = WORKER.indexOf("knownTables", at);
  assert.ok(end > at, "the closing landmark is gone");
  const around = WORKER.slice(WORKER.lastIndexOf("// AND HOW MUCH THE SPLIT SAVED", at), end);
  assert.ok(around.length > 200, "the comment block around the design mark did not resolve");
  assert.ok(!/reads as fewer agents than waves/.test(around),
    "the comment states a tell that is false for two of the three break points");
  assert.ok(/NOT A TEST FOR A BROKEN DESIGN/.test(around),
    "the correction that replaced the false tell is gone");
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

// ─────────────────────────────────────────────────────────────────────────────
// THE BAND SPLIT'S OWN PAIR (2026-09-10, owner: "YEAH WE NEED TO FIGURE THIS
// OUT , CUZ SPLITTING THEM SHOULD MAKE IT FASTER")
//
// The design split has had `agentMs`/`waveMs` since the day it shipped, and
// three runs could therefore be read for whether it pays. (It does not: the
// overlap and the extra work of splitting one call into four cancel, because
// the waves are 1-2-1 and only two agents ever run at once.) The band split had
// `bands`/`wrote` and no timings, so the same question needed a baseline — and
// the single-call page step's own spread, 334,000-620,000 ms, is wider than any
// saving a split can produce, so no number of paid runs would have settled it.
//
// These two numbers answer it off ONE build, which is the whole point.
// ─────────────────────────────────────────────────────────────────────────────

test("the fan-out measures its own wall time, and measuring is what makes it survive a stagger", async () => {
  // DRIVEN ON A CLOCK THE TEST OWNS — no timers. Two concurrency guards one
  // file over used `setTimeout`, drifted under sweep load and came back with the
  // comment-only control KILLED, which is a guard reporting correct code as
  // broken.
  const { runFanout } = await import("../builder/model-fanout.mjs");

  // ── SIMULTANEOUS STARTS: the ordinary case, where the wall time IS the
  //    slowest call. Both numbers are still right; this pins the arithmetic.
  let t = 0;
  const open = [];
  const p = runFanout([0, 1, 2], () => new Promise((res) => open.push(res)), () => t);
  await flush();
  assert.equal(open.length, 3, "the calls did not all start — a fan-out that is not one is not measuring one");
  t = 100; open[0]("a"); await flush();
  t = 250; open[2]("c"); await flush();
  t = 300; open[1]("b"); await flush();
  const out = await p;

  assert.deepEqual(out.map((e) => e.ms), [100, 300, 250], "the per-call times are wrong");
  assert.equal(out.reduce((a, e) => a + e.ms, 0), 650, "the serial cost is not the sum of the calls");
  assert.equal(out[0].waveMs, 300, "the wall time is not measured from before the fan-out to after every call settled");
  assert.equal(new Set(out.map((e) => e.waveMs)).size, 1, "the entries disagree about how long the fan-out took");

  // ── STAGGERED STARTS: the case measuring exists for, and the ONLY one where
  //    the two answers differ. Every start moves the clock, and the call that
  //    starts LAST settles last — so the slowest call ran 80 while the fan-out
  //    really took 100. `max(ms)` would report 80: a fan-out that was partly
  //    serialised, reading as a fast one. That is the flattering direction, and
  //    it is what a derived number would get wrong.
  let s2 = 0;
  const later = [];
  const q = runFanout([0, 1, 2], () => { s2 += 10; return new Promise((res) => later.push(res)); }, () => s2);
  await flush();
  s2 = 50;  later[0]("a"); await flush();   // started at 0  → 50
  s2 = 60;  later[1]("b"); await flush();   // started at 10 → 50
  s2 = 100; later[2]("c"); await flush();   // started at 20 → 80, and settles last
  const stag = await q;
  assert.deepEqual(stag.map((e) => e.ms), [50, 50, 80]);
  assert.equal(stag[0].waveMs, 100, "the wall time collapsed to the slowest call — derived, not measured");
  assert.ok(stag[0].waveMs > Math.max(...stag.map((e) => e.ms)),
    "a staggered fan-out reports the same wall time as a simultaneous one — the stagger is invisible");

  // A FAILED CALL'S TIME COUNTS — it was spent — and it carries the stamp too,
  // or a fan-out whose slowest band failed would under-report both numbers.
  let s3 = 0;
  const bad = await runFanout([0, 1], (r, i) => (i ? Promise.reject(new Error("no")) : Promise.resolve("ok")), () => (s3 += 10));
  assert.equal(bad.length, 2);
  assert.ok(bad.every((e) => Number.isFinite(e.ms) && Number.isFinite(e.waveMs)), "a failed call lost its timings");
  assert.equal(bad[1].state, "failed", "the failure stopped being an entry");
});

test("generateSiteBands carries the pair out, on both of its returns", async () => {
  // DRIVEN THROUGH THE REAL GENERATOR against a fake container, because a sum
  // computed and never forwarded is this repository's most-shipped failure —
  // and the `bands` mark reads these two fields by name.
  const args = {
    lines: ["hero", "prices", "find us"], route: "/", brief: "a fishmonger", brand: "Ashcombe",
    spec: {}, kind: "shopfront", model: "grok-4.6",
    chrome: { name: "Ashcombe", tagline: "", links: [], action: null },
  };
  // Entries shaped the way `runFanout` really shapes them, INCLUDING the stamp.
  const entry = (i, source, ms) => ({
    i, state: "done", ms, waveMs: 900,
    answer: { content: [{ type: "tool_use", name: "write_band", input: { source } }], usage: {} },
  });
  const band = (n) => `export function ${n}() {\n  return <section data-slot="${n}">${n}</section>;\n}`;

  const ok = await generateSiteBands(args, null,
    async (keys, reqs) => reqs.map((r, i) => entry(i, band("Band" + i), 100 * (i + 1))));
  assert.equal(ok.agentMs, 600, "the bands' own times were not summed (100+200+300)");
  assert.equal(ok.waveMs, 900, "the fan-out's wall time did not come through");
  assert.ok(ok.input && ok.input.pages && ok.input.pages.length, "the page was not assembled");

  // THE EARLY RETURN CARRIES THEM TOO. Every band empty is the outcome where
  // knowing what the attempt cost matters MOST, and an early return that
  // quietly carries less than the late one is a recorded shape here.
  const none = await generateSiteBands(args, null,
    async (keys, reqs) => reqs.map((r, i) => ({ i, state: "failed", ms: 50, waveMs: 70, message: "no" })));
  assert.equal(none.input, null, "a page of nothing was assembled");
  assert.equal(none.agentMs, 150, "the failed fan-out lost what it cost");
  assert.equal(none.waveMs, 70, "the failed fan-out lost its wall time");

  // AND A CONTAINER THAT NEVER STAMPED — an older image, mid-rollout — reads as
  // ZERO rather than as a wrong number. `tr.at` keeps the key either way, so the
  // stored row says "asked and not answered" instead of inventing an overlap.
  const old = await generateSiteBands(args, null,
    async (keys, reqs) => reqs.map((r, i) => { const e = entry(i, band("Band" + i), 100); delete e.waveMs; return e; }));
  assert.equal(old.waveMs, 0, "an unstamped fan-out invented a wall time");
  assert.equal(old.agentMs, 300, "an unstamped fan-out lost the per-call times as well");
});

// ─────────────────────────────────────────────────────────────────────────────
// WHICH AGENT IS THE WAVE'S WALL (2026-09-10, owner, having drawn four lines of
// different lengths meeting one barrier: "THATS WHY I TOLD YOU ABOUT SEPARATING
// IT , SO ITS FASTER")
//
// The drawing IS the arithmetic. Fire N agents together and the wave costs its
// SLOWEST one; every other agent answers and then waits at the barrier. So
// separating turns a SUM into a MAX — which `agentMs - waveMs` already measures
// — and the only lever left on a wave's wall time is which agent is the max.
// Halving a fast agent buys exactly nothing.
//
// `agentMs` cannot say. It is the sum, and three of these four builds' agents
// are invisible inside it. One number per agent is what makes the owner's next
// question askable off one build.
// ─────────────────────────────────────────────────────────────────────────────

test("an agent's name becomes its trace key, and the names that cannot are refused", () => {
  // THE ORDINARY ANSWER, for the four agents that really run.
  assert.equal(agentMark("identity"), "identityMs");
  assert.equal(agentMark("plan"), "planMs");
  assert.equal(agentMark("look"), "lookMs");
  assert.equal(agentMark("detail"), "detailMs");

  // A NAME THAT COLLIDES IS STILL KEYED HERE, and that is the split of
  // responsibility rather than a hole: `agent` and `wave` make perfectly legal
  // keys, and whether one is already TAKEN is a question about the row being
  // built — asked in `waveMarks`, derived from that row, so the three fixed
  // names are never written out a second time beside it.
  assert.equal(agentMark("agent"), "agentMs", "the collision rule migrated back here as a hand-written list");
  assert.equal(agentMark("wave"), "waveMs");

  // `tr.at` TRUNCATES A KEY AT 16 CHARACTERS, and a truncated key is where the
  // collisions live: two long names that agree far enough in are cut down to ONE
  // key, and the later agent silently overwrites the earlier. So the rule is not
  // "short names are tidier" — it is that a key which reaches the trace WHOLE
  // cannot merge with anything, and one that is cut might.
  assert.equal(agentMark("a".repeat(14)), "a".repeat(14) + "Ms", "14 characters keys exactly, whole, and must be kept");
  assert.equal(agentMark("a".repeat(15)), "", "a name whose key outruns the trace's 16-character key was kept");
  // AND THE TRUNCATION IS REAL, driven against the trace itself rather than read
  // off its source — without this the number 16 is a claim in two places. Two
  // keys that differ only past the cut arrive as one.
  const tr = makeTrace(() => 0);
  tr.at("x", { ["a".repeat(16) + "X"]: 1, ["a".repeat(16) + "Y"]: 2 });
  const keys = Object.keys(tr.done().steps.at(-1)).filter((k) => k.startsWith("a"));
  assert.equal(keys.length, 1, "two keys differing past the 16th character stayed apart — the refusal above guards nothing");

  // EVERY CANNOT-TELL IS A REFUSAL, never a repaired name: a key nobody can read
  // back is worse than no key, and repairing invents a name the waves do not use.
  for (const junk of ["", " ", "a b", "a-b", "a.b", "1st", "_x", null, undefined, 7, {}, ["plan"], ["a"]]) {
    assert.equal(agentMark(junk), "", "a name that cannot be keyed was keyed: " + JSON.stringify(junk));
  }
  // `String(["plan"])` is `"plan"` — the recorded coercion trap. A one-element
  // array must not read as the string it stringifies to.
  assert.equal(agentMark(["plan"]), "", "a one-element array coerced into an agent name");
});

test("the projection carries one number per agent, and an agent that did not run has no key", () => {
  const m = waveMarks({
    waves: true, agents: 3, agentMs: 300, waveMs: 200,
    eachMs: { identity: 40, plan: 110, look: 150 },
  });
  assert.deepEqual(m, { agents: 3, agentMs: 300, waveMs: 200, identityMs: 40, planMs: 110, lookMs: 150 });

  // ABSENT MEANS ABSENT — the opposite rule from the three fixed numbers, and
  // deliberately so. A design that broke in wave 2 never ran `detail`, and
  // `detailMs: 0` reads as an agent that answered instantly. The three can
  // afford a zero because a missing one and a zero one mean the same thing
  // there; a per-agent key cannot.
  assert.ok(!("detailMs" in m), "an agent that never ran was recorded as having taken no time");

  // A SHAPE WITH NOTHING PER-AGENT IS EXACTLY WHAT IT WAS. Every existing
  // reading of this projection has to keep working.
  assert.deepEqual(waveMarks({ agents: 4, agentMs: 300000, waveMs: 200000 }),
    { agents: 4, agentMs: 300000, waveMs: 200000 });

  // AND NOTHING BUT A FINITE NUMBER GETS A KEY. `tr.at` would drop these
  // silently, so a projection that passed them through would read from the
  // stored row exactly like a projection that refused them — and the refusal
  // here is what makes the rule visible to a guard at all.
  const junky = waveMarks({
    agents: 1, agentMs: 1, waveMs: 1,
    eachMs: { plan: "110", look: NaN, detail: Infinity, three: null, tsx: ["9"], [" x"]: 5 },
  });
  assert.deepEqual(junky, { agents: 1, agentMs: 1, waveMs: 1 },
    "something that is not a finite number under a keyable name reached the projection");

  // NO AGENT MAY STAND WHERE THE THREE STAND. `agent` and `wave` make exactly
  // the keys the SUM and the WALL CLOCK are stored under, and one agent's time
  // in either place is the one way this instrument LIES rather than going quiet:
  // the row still reads as a wave that cost 9, and nothing about it says which
  // number it really is. The neighbours are admitted, so this is a collision
  // test and not a ban on words beginning with `a` or `w`.
  const taken = waveMarks({
    agents: 2, agentMs: 300, waveMs: 200,
    eachMs: { agent: 9, wave: 9, agents: 9, look: 150, waves: 9 },
  });
  assert.equal(taken.agentMs, 300, "an agent's own time was written over the sum of every agent's");
  assert.equal(taken.waveMs, 200, "an agent's own time was written over the wave's wall clock");
  assert.equal(taken.agents, 2, "an agent's own time was written over the count");
  assert.deepEqual(taken, { agents: 2, agentMs: 300, waveMs: 200, agentsMs: 9, lookMs: 150, wavesMs: 9 },
    "the keys that do NOT collide were refused too — the test is not a collision test");

  // AND A NON-OBJECT `eachMs` IS NOT AN ERROR, it is nothing — the same rule the
  // shape itself follows one line up.
  for (const junk of [null, undefined, "plan", 7, true]) {
    assert.deepEqual(waveMarks({ agents: 1, agentMs: 2, waveMs: 3, eachMs: junk }),
      { agents: 1, agentMs: 2, waveMs: 3 }, "eachMs = " + JSON.stringify(junk));
  }
  // An ARRAY has entries, and its keys are "0", "1" — which `agentMark` refuses
  // because a name must start with a letter. Driven, not reasoned about.
  assert.deepEqual(waveMarks({ agents: 1, agentMs: 2, waveMs: 3, eachMs: [10, 20] }),
    { agents: 1, agentMs: 2, waveMs: 3 }, "an array's indices became agent names");

  // AND A FUNCTION IS THE ONE SHAPE THAT MAKES `typeof === "object"` DO ANY
  // WORK, which is why it is driven rather than assumed. MEASURED against the
  // looser `s.eachMs || {}` over nineteen shapes: they agree on every one but
  // this — a string's, an array's and a number's own keys are all indices, and
  // `agentMark` refuses those anyway because a name must start with a letter.
  // A function is truthy, is not an object, and its own enumerable properties
  // are real names. Without this case the wall reads as dead code and the next
  // session deletes it.
  const carrier = function () {};
  carrier.plan = 5;
  assert.deepEqual(waveMarks({ agents: 1, agentMs: 2, waveMs: 3, eachMs: carrier }),
    { agents: 1, agentMs: 2, waveMs: 3 }, "a function's own properties became agent times");
});

test("THE WALL NAMES ITSELF: the wave costs its slowest agent, and the row says which", async () => {
  // THE OWNER'S DRAWING, DRIVEN. Three agents at once, one of them much slower
  // than the other two: the wave's wall time IS that agent's time, and the two
  // fast ones spent their last 130 and 100 ms waiting at the barrier.
  const d = driven(
    [[{ name: "identity", fields: ["brand"] }, { name: "plan", fields: ["slug"] }, { name: "look", fields: ["theme"] }]],
    { brand: { type: "string" }, slug: { type: "string" }, theme: { type: "string" } },
  );
  assert.equal(d.gates.length, 3, "the three agents did not all start");
  await d.finish(0, 20);    // identity: fast
  await d.finish(1, 50);    // plan:     middling
  await d.finish(2, 150);   // look:     the wall
  const out = await d.p;

  const m = waveMarks(out.shape);
  assert.deepEqual(m, { agents: 3, agentMs: 220, waveMs: 150, identityMs: 20, planMs: 50, lookMs: 150 });
  // THE PROPERTY THE OWNER ASKED FOR, stated as arithmetic rather than as
  // prose: on simultaneous starts the wave costs its slowest agent, so the
  // largest per-agent number IS the wall time — and cutting any of the others
  // in half moves the wall by nothing at all.
  const per = [m.identityMs, m.planMs, m.lookMs];
  assert.equal(Math.max(...per), m.waveMs, "the wave did not cost its slowest agent — re-derive what these numbers mean");
  assert.ok(per.filter((x) => x < m.waveMs).length === 2, "only one agent should be at the wall");
  // AND THE SUM ALONE CANNOT SAY IT. This is why the parts exist: the same
  // 220/150 would come out of three agents at 73 each, where there is no wall
  // to cut and the split has already bought everything it can.
  assert.deepEqual(waveMarks({ agents: 3, agentMs: 220, waveMs: 150 }), { agents: 3, agentMs: 220, waveMs: 150 });
});

test("the parts always sum to the whole, and a repeated name adds rather than replaces", async () => {
  // THE TIE THAT KEEPS THEM HONEST. `agentMs` and the per-agent numbers are
  // read off ONE `a.ms` under ONE test, so a row whose parts do not add up to
  // its sum is a row that has lost an agent.
  //
  // AND A NAME USED TWICE IS WHAT DRIVES IT. `DESIGN_WAVES` names its four
  // agents distinctly (a census below), but this function takes its waves as an
  // ARGUMENT — so `=` instead of `+=` answers a wrong number for one agent
  // rather than a caught mistake for the design.
  const d = driven(
    [[{ name: "look", fields: ["brand"] }], [{ name: "look", fields: ["slug"] }]],
    { brand: { type: "string" }, slug: { type: "string" } },
  );
  await d.finish(0, 90);
  await d.finish(1, 250);
  const out = await d.p;

  assert.equal(out.shape.agentMs, 250, "90 of work in wave 1 and 160 in wave 2");
  assert.equal(out.shape.eachMs.look, 250, "the second wave's `look` replaced the first's instead of adding to it");
  const parts = Object.values(out.shape.eachMs).reduce((a, b) => a + b, 0);
  assert.equal(parts, out.shape.agentMs, "the per-agent numbers no longer add up to the sum");
});

test("an agent with no readable name is filed nowhere, and never under a coerced one", async () => {
  // `String(["plan"])` IS `"plan"` — shipped as a real bug three times in this
  // repository — so a name read with `String(...)` rather than by type would
  // file a one-element array's time under a real agent's key. The sum still
  // counts it (the call was made and paid for); only the NAME is refused.
  const d = driven(
    [[{ name: ["plan"], fields: ["brand"] }, { name: null, fields: ["slug"] }]],
    { brand: { type: "string" }, slug: { type: "string" } },
  );
  await d.finish(0, 40);
  await d.finish(1, 90);
  const out = await d.p;

  assert.deepEqual(out.shape.eachMs, {}, "an agent with no readable name was filed under one anyway");
  assert.equal(out.shape.agentMs, 130, "the calls were still made and still cost what they cost");
  assert.deepEqual(waveMarks(out.shape), { agents: 2, agentMs: 130, waveMs: 90 });
});

test("a failed agent is filed under its own name — it was spent", async () => {
  // `agentMs` has counted a failed agent since the pair shipped; the parts must
  // agree, or the one row worth reading — the wave where an agent died holding
  // the wall — under-reports exactly the agent that cost the most.
  let t = 0;
  const gates = [];
  const call = () => new Promise((res, rej) => gates.push({ res, rej }));
  const p = designInWaves(
    {
      tool: toyTool({ brand: { type: "string" }, slug: { type: "string" } }, []),
      system: "s", brief: "b", model: "m", maxTokens: 1,
      waves: [[{ name: "identity", fields: ["brand"] }, { name: "look", fields: ["slug"] }]],
    },
    call,
    () => t,
  );
  t = 210;
  gates[0].rej(Object.assign(new Error("upstream said no"), { status: 429 }));
  await flush();
  t = 240;
  gates[1].res(answer({ slug: "slug" }));
  await flush();
  const out = await p;

  assert.equal(out.shape.eachMs.identity, 210, "the agent that failed lost the time it spent");
  assert.equal(out.shape.eachMs.look, 240);
  assert.equal(out.shape.agentMs, 450, "the sum and the parts disagree about a failed agent");
  assert.equal(waveMarks(out.shape).identityMs, 210, "…and it never reached the projection");
});

test("a design that stops early records the agents that RAN and no others", async () => {
  // PRESENCE IS THE SIGNAL, end to end. A required field lost in wave 1 ends the
  // design there, so wave 2 never runs and never costs anything — and the row
  // must say that rather than claim two agents took no time.
  const d = driven(
    [[{ name: "identity", fields: ["brand"] }], [{ name: "plan", fields: ["slug"] }, { name: "look", fields: ["theme"] }]],
    { brand: { type: "string" }, slug: { type: "string" }, theme: { type: "string" } },
    ["brand"],
  );
  await d.declineNothing(0, 120);
  const out = await d.p;

  assert.equal(d.gates.length, 1, "wave 2 ran on a design that had already lost a required field");
  const m = waveMarks(out.shape);
  assert.equal(m.identityMs, 120, "the agent that ran was not recorded");
  assert.ok(!("planMs" in m) && !("lookMs" in m),
    "an agent whose wave never ran was recorded as having taken no time");
  assert.equal(m.agents, 1);
});

test("THE CHAIN: a driven design's per-agent numbers reach a real trace, through worker.js's own mark", async () => {
  // A VALUE BUILT IS NOT A VALUE THAT ARRIVES — this repository's most-shipped
  // failure, and the one the hook fix above found on the live database. Every
  // case before this proves the numbers are COMPUTED; this one proves they land
  // on a stored step, and it proves it by RUNNING the Worker's own line rather
  // than by matching text, because `tr.at(name)` instead of `tr.at(name, marks)`
  // satisfies every text match there is.
  const at = WORKER.indexOf('tr.at("design"');
  assert.ok(at > 0, "the design trace mark is gone");
  const close = ": undefined);";
  const end = WORKER.indexOf(close, at);
  assert.ok(end > at, "the design mark's closing landmark is gone — re-derive this window");
  const stmt = WORKER.slice(at, end + close.length);
  assert.ok(/waveMarks/.test(stmt), "the statement cut out is not the one that asks the projection");

  // A REAL DESIGN, RUN. Not a hand-typed shape: a fixture in a different shape
  // from the real producer is a recorded trap, and the whole question here is
  // whether what `designInWaves` really returns survives the hop.
  const d = driven(
    [[{ name: "identity", fields: ["brand"] }], [{ name: "plan", fields: ["slug"] }, { name: "look", fields: ["theme"] }]],
    { brand: { type: "string" }, slug: { type: "string" }, theme: { type: "string" } },
  );
  // Wave 1 runs 0 → 30. Wave 2 STARTS AT 30, so `plan` costs 60 and `look` 170
  // — the numbers are per agent, never from the build's own origin, which is
  // exactly the difference a wave boundary makes and the reason this fixture has
  // two waves rather than one.
  await d.finish(0, 30);
  await d.finish(1, 90);
  await d.finish(2, 200);
  const out = await d.p;

  // The REAL trace module, whose numbers-only wall is the reason the projection
  // exists at all.
  const tr = makeTrace(() => 0);
  // `useGraph` IS SUPPLIED FALSE, and it has to be supplied at all because this
  // runs the REAL statement — which grew a third arm on 2026-09-11. That is the
  // guard doing its job rather than a spelling pin: a driver that stopped
  // compiling is a driver that is still executing the product's own line.
  new Function("tr", "waveMarks", "schemaUsage", "useWaves", "useGraph", "designWaves", "designGraph", "designedShape", stmt)(
    tr, waveMarks, { in: 5, out: 7 }, true, false, [[1], [1, 1]], [], out.shape,
  );
  const step = tr.done().steps.at(-1);
  assert.equal(step.s, "design", "the mark did not record a step at all");
  assert.equal(step.identityMs, 30, "the per-agent numbers never reached the trace");
  assert.equal(step.planMs, 60);
  assert.equal(step.lookMs, 170);
  assert.equal(step.agentMs, 260, "the sum stopped arriving");
  assert.equal(step.waveMs, 200, "the wall time stopped arriving");
  assert.equal(step.agents, 3);
  assert.equal(step.waves, 2, "the PLANNED wave count is what the route contributes, and it stopped arriving");
  assert.equal(step.out, 7);
  assert.ok(!("eachMs" in step), "the nested object reached the trace — then the projection is dead code");

  // AND A SINGLE-CALL DESIGN CARRIES NONE OF IT, which is what makes the step's
  // own shape the flag: `useWaves` false must leave a row that says nothing
  // about waves at all.
  const one = makeTrace(() => 0);
  new Function("tr", "waveMarks", "schemaUsage", "useWaves", "useGraph", "designWaves", "designGraph", "designedShape", stmt)(
    one, waveMarks, { in: 5, out: 7 }, false, false, [[1], [1, 1]], [], out.shape,
  );
  const plain = one.done().steps.at(-1);
  assert.deepEqual(plain, { s: "design", ms: 0, out: 7, in: 5 },
    "a single-call design left wave numbers on its row");

  // AND THE THIRD ARM: a GRAPH design says `graph` and carries the SAME
  // projection (2026-09-11). The three numbers below are what makes a graph
  // build readable at all — and the arm is driven rather than read, because
  // `useGraph ? { graph: n } : …` without the spread satisfies every text match
  // while leaving the row unable to say which agent was the wall.
  const gr = makeTrace(() => 0);
  new Function("tr", "waveMarks", "schemaUsage", "useWaves", "useGraph", "designWaves", "designGraph", "designedShape", stmt)(
    gr, waveMarks, { in: 5, out: 7 }, false, true, [[1], [1, 1]], [1, 1, 1, 1, 1, 1], out.shape,
  );
  const gstep = gr.done().steps.at(-1);
  assert.equal(gstep.graph, 6, "the graph's own agent count never reached the row");
  assert.ok(!("waves" in gstep), "a graph design left a wave count on its row — the two designers are indistinguishable");
  assert.equal(gstep.identityMs, 30, "the per-agent numbers do not reach the row on a graph build");
  assert.equal(gstep.agentMs, 260, "the sum does not reach the row on a graph build");
  assert.equal(gstep.waveMs, 200, "the wall clock does not reach the row on a graph build");
});

test("THE CENSUS: every agent the waves really plan can be keyed, and no two share a key", () => {
  const names = DESIGN_WAVES.flat().map((a) => a.name);
  assert.ok(names.length >= 4, "only " + names.length + " agents found — the census is not reading the waves");

  const keys = names.map((n) => {
    const k = agentMark(n);
    assert.ok(k, "the agent `" + n + "` cannot be keyed, so its time is recorded nowhere at all");
    return k;
  });
  // DISTINCT AFTER THE TRACE'S OWN TRUNCATION, not merely distinct as written —
  // which is the whole reason `agentMark` has a length rule. Asked of the real
  // `tr.at`, so the number 16 is never a claim in two places.
  const tr = makeTrace(() => 0);
  tr.at("design", Object.fromEntries(keys.map((k, i) => [k, i + 1])));
  const step = tr.done().steps.at(-1);
  for (let i = 0; i < keys.length; i++) {
    assert.equal(step[keys[i]], i + 1,
      "the agent `" + names[i] + "` lost its number to another agent's key once the trace truncated it");
  }
  // …and the names are distinct in the first place, which is what makes the
  // per-agent numbers readable as agents rather than as totals.
  assert.equal(new Set(names).size, names.length, "two agents share a name: " + names.join(","));
});

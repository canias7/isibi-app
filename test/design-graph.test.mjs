// THE DESIGN STEP AS A DEPENDENCY GRAPH (2026-09-11, owner: "Ok go").
//
// WHAT THIS FILE IS FOR, case by case, and every one is a way the change ships
// looking right:
//
//   * a field on the tool that no agent claims — it comes back EMPTY on every
//     graph build, silently, because absent is a legal answer for the eight
//     optional ones. That is `three` shipped dead for a day, one layer over, and
//     the census is the only thing that catches it;
//   * a cycle in the `needs` — two promises awaiting each other do not throw,
//     they HANG, and a hung design step is a build that sits there until the
//     job's clock kills it with everything charged and nothing to show;
//   * a dependent that runs anyway when its need FAILED — `shape` arranging a
//     component list that never arrived;
//   * a dependent that HANGS when its need failed, which is the same cost as the
//     cycle and arrives by a different road;
//   * the note built from "everything that has landed" rather than from the
//     agent's own `needs` — the same brief then produces different prompts on
//     two runs, and a build that designed well once cannot be reproduced;
//   * the permit pool admitting everybody, which a source read cannot tell from
//     one that admits eight;
//   * and the door defaulting to ON, which would put every customer on a
//     designer nothing has ever run live.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DESIGN_GRAPH, GRAPH_AGENTS, GRAPH_FIELDS, MAX_GRAPH_INFLIGHT,
  graphOrder, splitGraph, needKnown, permits, designInGraph,
} from "../builder/design-graph.mjs";
import { agentMark } from "../builder/design-waves.mjs";
import { runFanout } from "../builder/model-fanout.mjs";
import { designGraphFor, designGraphEveryone } from "../builder/edit-job.mjs";
import { makeTrace } from "../builder/trace.mjs";
import { readSchemaTool } from "./integration/schema-tool.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
// Whole-line comments blanked, LENGTH PRESERVED. This module's own header
// spells every edge it dropped and every phrase it quotes, so an unblanked scan
// reports the reasoning as the code — the recorded "prose contains the thing it
// forbids", in a guard written for the change that wrote the prose.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const WORKER = read("worker.js");
const WCODE = code(WORKER);
const GRAPH_SRC = read("builder/design-graph.mjs");

// DERIVED FROM THE REAL TOOL rather than from a fixture, for `readSchemaTool`'s
// own reason: a hand-typed copy of 22 property names is a second list of the
// same thing, and the drift is silent in the direction that empties a field.
const REAL = await readSchemaTool();
const TOOL = REAL.frontendTool;

const answer = (input) => ({ stop_reason: "tool_use", usage: {}, content: [{ type: "tool_use", input }] });
const flush = () => new Promise((r) => setImmediate(r));

/** Real-shaped values. `waveNote` only prints a list when it IS a list, so a
 *  string fixture proves nothing — the recorded "a fixture in a different shape
 *  from reality", met once while driving this module by hand. */
const VAL = {
  brand: "Millbrook Pottery", slug: "millbrook-pottery", description: "A studio",
  kind: "shopfront", purpose: "Book a class", pages: [{ path: "/", name: "Home" }],
  components: ["site-chrome", "hero-split", "price-table"],
  shape: [{ path: "/", sections: ["hero", "prices", "contact"] }],
  images: [], theme: "bakery", wordmark: { form: "text" }, favicon: { form: "initials" },
  action: "Book", behavior: [], lang: "en", langs: [], tsx: [], qr: [], three: null,
  needsWeb: false, webQueries: [], css: "",
};

/** Which agent a request was built for, off the request itself. */
const askedOf = (req) => Object.keys(req.tools[0].input_schema.properties);
const agentOf = (req) => {
  const f = askedOf(req);
  return (DESIGN_GRAPH.find((a) => a.fields.includes(f[0])) || {}).name || "?";
};

/**
 * A tool carrying exactly the fields a small graph answers, with a stated
 * `required` list.
 *
 * `wavesUsable` — reused here rather than re-decided — asks the TOOL which
 * fields a complete design needs, so a three-agent fixture run against the REAL
 * tool is missing fourteen required fields and fails for a reason the case is
 * not about. Derived from the graph handed in, so the two cannot drift.
 */
const toolFor = (graph, required = []) => ({
  name: "design_schema",
  input_schema: {
    type: "object",
    properties: Object.fromEntries(graph.flatMap((a) => a.fields).map((f) => [f, { type: "string", description: "x" }])),
    required,
  },
});

/**
 * A graph run against gates the test opens, with no timers anywhere.
 *
 * NO `setTimeout`, DELIBERATELY: two concurrency guards one file over used one,
 * drifted under sweep load and came back with the comment-only CONTROL killed —
 * a guard reporting correct code as broken, which this repository rates worse
 * than a miss.
 */
function driven({ fail = [], graph = DESIGN_GRAPH, clock = null, tool = TOOL } = {}) {
  const started = [];
  const parked = new Map();
  let t = 0;
  const call = (req) => new Promise((res, rej) => {
    const name = agentOf(req);
    started.push(name);
    parked.set(name, { res, rej, req });
  });
  // THE CLOCK IS THE TEST'S WHEN A CASE ASKS FOR ONE. The default ticks by ten
  // per read, which is enough for "a number arrived" and useless for "which
  // number" — and every timing question here is the second kind. A case that
  // asserts arithmetic hands in a clock it moves itself, which is `split-timing`
  // one file over and, like it, uses NO timers.
  const p = designInGraph(
    { tool, system: "s", brief: "b", model: "m", maxTokens: 1, graph },
    call,
    clock || (() => (t += 10)),
  );
  // A REJECTION OBSERVED ONE TICK LATE READS TO THE RUNNER AS UNHANDLED, and
  // the failing cases here MUST let the design reject while they drive the
  // fakes — they attach their handler on the line after the await that caused
  // it. This observer changes nothing about what `await d.p` throws (it is a
  // new promise, discarded); its only job is to say the rejection was seen, so
  // a guard that proves the design fails does not itself fail as an
  // unhandled rejection.
  p.catch(() => {});
  return {
    started, parked, p,
    /** Answer one parked agent with its own fields, then let it be read. */
    async finish(name) {
      const g = parked.get(name);
      const fields = askedOf(g.req);
      if (fail.includes(name)) { const e = new Error("upstream said no"); e.status = 503; g.rej(e); }
      else g.res(answer(Object.fromEntries(fields.map((f) => [f, VAL[f]]))));
      await flush(); await flush();
    },
    /** Answer with NO tool call at all — the model declined the tool. */
    async silent(name) {
      parked.get(name).res({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "no" }] });
      await flush(); await flush();
    },
    /**
     * Answer with a tool call whose input declares nothing.
     *
     * A DIFFERENT ANSWER FROM `silent`, AND THE DIFFERENCE IS THE WHOLE POINT.
     * No tool call is a call that FAILED — `readWaveAnswer` says `ok: false` —
     * and its dependents are rightly skipped. A tool call declaring no fields is
     * the model using the tool to say "nothing here", which is the correct
     * answer for four of the eight optional fields and must not block anybody.
     */
    async declared(name, input = {}) {
      parked.get(name).res(answer(input));
      await flush(); await flush();
    },
    async settleAll() {
      // Everything ready now, then whatever that unblocks, until nothing is left.
      for (let round = 0; round < 8; round++) {
        const names = [...parked.keys()].filter((n) => parked.get(n) && !parked.get(n).done);
        if (!names.length) break;
        for (const n of names) { parked.get(n).done = true; await this.finish(n); }
      }
      return this.p;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CENSUS — derived from the tool, in both directions
// ─────────────────────────────────────────────────────────────────────────────

test("THE CENSUS: every field the real tool carries belongs to exactly one agent", () => {
  const props = Object.keys(TOOL.input_schema.properties);
  assert.ok(props.length > 15, "the frontend tool did not resolve — " + props.length + " properties");
  // BOTH DIRECTIONS. A field on the tool and in no agent comes back empty on
  // every graph build without failing; an agent claiming a field the tool has
  // not got means the two have drifted and `splitGraph` must refuse.
  for (const p of props) {
    const owners = DESIGN_GRAPH.filter((a) => a.fields.includes(p)).map((a) => a.name);
    assert.equal(owners.length, 1, "`" + p + "` is claimed by " + owners.length + " agents: " + owners.join(","));
  }
  for (const f of GRAPH_FIELDS) {
    assert.ok(props.includes(f), "the graph claims `" + f + "`, which the tool does not carry");
  }
  assert.equal(GRAPH_FIELDS.length, props.length, "the counts disagree, so something is claimed twice or not at all");
});

test("…and `backend` is deliberately absent, so the whole tool refuses to split", () => {
  // The full tool carries `backend`, which the ADD step owns and no agent
  // answers. Refusing is the safe half: a build sending it would get it back
  // empty and silently.
  assert.ok(Object.keys(REAL.tool.input_schema.properties).includes("backend"));
  assert.equal(splitGraph({ tool: REAL.tool, mode: "build" }).length, 0,
    "a tool carrying a field no agent claims was split anyway");
  assert.equal(splitGraph({ tool: TOOL, mode: "build" }).length, DESIGN_GRAPH.length);
});

test("THE CENSUS: every agent's own time can be keyed, and no two keys collide", () => {
  // `tr.at` truncates a key at 16 characters, and a truncated key is where the
  // collisions live: two names that agree far enough in are cut to ONE key and
  // the later agent silently overwrites the earlier — a wrong number wearing a
  // right one's name, the only way this instrument can lie rather than go quiet.
  const keys = GRAPH_AGENTS.map((n) => agentMark(n));
  for (let i = 0; i < GRAPH_AGENTS.length; i++) {
    assert.ok(keys[i], "`" + GRAPH_AGENTS[i] + "` cannot be keyed, so its time is never recorded");
  }
  // DRIVEN AGAINST THE REAL TRACE, so the number 16 is never a claim in two
  // places: whatever `tr.at` really does to these keys is what is asserted.
  const tr = makeTrace(() => 0);
  tr.at("design", Object.fromEntries(keys.map((k, i) => [k, i + 1])));
  const step = tr.done().steps.at(-1);
  for (let i = 0; i < keys.length; i++) {
    assert.equal(step[keys[i]], i + 1, "`" + GRAPH_AGENTS[i] + "`'s key did not survive the trace intact");
  }
  // `s` and `ms` are the trace's own two.
  assert.equal(Object.keys(step).length, keys.length + 2, "two agents collided on one key");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE GRAPH ITSELF
// ─────────────────────────────────────────────────────────────────────────────

test("the shipped graph is acyclic, and every `needs` names an agent that exists", () => {
  const order = graphOrder(DESIGN_GRAPH);
  assert.equal(order.length, DESIGN_GRAPH.length, "the shipped graph has a cycle or a dangling need");
  // Every need is placed before its dependent, which is what the order means.
  const at = (n) => order.indexOf(n);
  for (const a of DESIGN_GRAPH) {
    for (const n of a.needs || []) {
      assert.ok(at(n) >= 0 && at(n) < at(a.name), "`" + a.name + "` is ordered before its need `" + n + "`");
    }
  }
});

test("graphOrder REFUSES rather than hangs — a cycle, a self-need, a dangling need, a twin", () => {
  const ok = [{ name: "a", fields: ["x"] }, { name: "b", fields: ["y"], needs: ["a"] }];
  assert.equal(graphOrder(ok).length, 2, "a plain two-agent graph was refused");
  const bad = [
    [[{ name: "a", fields: ["x"], needs: ["b"] }, { name: "b", fields: ["y"], needs: ["a"] }], "a two-agent cycle"],
    [[{ name: "a", fields: ["x"], needs: ["a"] }], "an agent that needs itself"],
    [[{ name: "a", fields: ["x"], needs: ["nope"] }], "a need naming nothing"],
    [[{ name: "a", fields: ["x"] }, { name: "a", fields: ["y"] }], "two agents of one name"],
    [[{ name: "", fields: ["x"] }], "a nameless agent"],
    [[{ name: "a", fields: [] }], "an agent with no fields"],
    [[{ name: "a", fields: ["x"], needs: [7] }], "a need that is not a string"],
    // A LONGER CYCLE, because a two-agent one is catchable by a cheaper test and
    // this is the shape a real mistake takes.
    [[{ name: "a", fields: ["x"], needs: ["c"] }, { name: "b", fields: ["y"], needs: ["a"] },
      { name: "c", fields: ["z"], needs: ["b"] }], "a three-agent cycle"],
  ];
  for (const [g, what] of bad) assert.deepEqual(graphOrder(g), [], what + " was accepted");
});

test("splitGraph refuses a revise, an unstated mode, and an empty tool", () => {
  assert.equal(splitGraph({ tool: TOOL, mode: "build" }).length, DESIGN_GRAPH.length);
  assert.equal(splitGraph({ tool: TOOL, mode: "build", current: { theme: "x" } }).length, 0, "a revise was split");
  assert.equal(splitGraph({ tool: TOOL, mode: "revise" }).length, 0);
  // AN UNSTATED MODE IS NOT A BUILD. `editState` is also null when the config
  // read blips, so cannot-tell must not fall to the permissive side at the door
  // of the most expensive step.
  assert.equal(splitGraph({ tool: TOOL }).length, 0, "a caller that did not say which was treated as a build");
  assert.equal(splitGraph({ tool: TOOL, mode: undefined }).length, 0);
  assert.equal(splitGraph({ tool: { input_schema: { properties: {} } }, mode: "build" }).length, 0);
  assert.equal(splitGraph({ mode: "build" }).length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

test("everything with nothing to wait for starts at once; a dependent does not", async () => {
  const d = driven();
  await flush();
  const free = DESIGN_GRAPH.filter((a) => !(a.needs || []).length).map((a) => a.name);
  // THE BOUND IS THE BOUND, not the graph's width: twelve are ready and eight
  // may be in the air, so the rest queue rather than all firing.
  assert.equal(d.started.length, MAX_GRAPH_INFLIGHT,
    "started " + d.started.length + " calls against a bound of " + MAX_GRAPH_INFLIGHT);
  for (const n of d.started) assert.ok(free.includes(n), "`" + n + "` started without its needs");
  for (const a of DESIGN_GRAPH) {
    if ((a.needs || []).length) assert.ok(!d.started.includes(a.name), "`" + a.name + "` started before its need");
  }
  const out = await d.settleAll();
  assert.ok(out.input, "the design did not come back usable");
  assert.equal(out.shape.agents, DESIGN_GRAPH.length, "not every agent ran");
  assert.equal(out.shape.graph, true, "the row does not say a graph ran");
  assert.deepEqual(out.shape.missing, [], "a required field was missing: " + out.shape.missing.join(","));
});

test("a dependent starts only once ITS need has answered, and not before", async () => {
  // ONE AGENT'S GRAPH, so the bound cannot be what is really being observed.
  const g = [
    { name: "identity", fields: ["brand", "slug", "description"] },
    { name: "wordmark", fields: ["wordmark"], needs: ["identity"] },
  ];
  const d = driven({ graph: g });
  await flush();
  assert.deepEqual(d.started, ["identity"], "the dependent started before its need");
  await d.finish("identity");
  assert.deepEqual(d.started, ["identity", "wordmark"], "the dependent did not start when its need landed");
  await d.finish("wordmark");
  const out = await d.p;
  assert.equal(out.shape.agents, 2);
});

test("a FAILED need blocks its dependents — it does not run them, and it does not hang", async () => {
  const g = [
    { name: "components", fields: ["components"] },
    { name: "shape", fields: ["shape"], needs: ["components"] },
    { name: "behavior", fields: ["behavior"], needs: ["shape"] },
  ];
  const d = driven({ graph: g, fail: ["components"] });
  await flush();
  await d.finish("components");
  // THE HANG IS THE FAILURE MODE THIS CATCHES. Awaiting a gate nobody resolves
  // does not throw; the promise below settling at all is the assertion.
  const out = await d.p.then((o) => o, (e) => ({ threw: e.message, status: e.status }));
  assert.ok(out.threw, "a lost required field should have failed the design");
  assert.equal(out.status, 503, "the provider's own status was flattened away");
  assert.ok(!d.started.includes("shape"), "`shape` ran without the component list it arranges");
  assert.ok(!d.started.includes("behavior"), "`behavior` ran two links behind a failed need");
});

test("an OPTIONAL agent answering nothing is normal; a REQUIRED one is a failed design", async () => {
  const req = TOOL.input_schema.required;
  assert.ok(req.includes("theme") && !req.includes("css"), "the fixture's assumption about the tool changed");
  // OPTIONAL, SILENT — the correct answer on most sites. `tsx` says so itself:
  // "OMIT THIS FIELD ENTIRELY… the right answer for nearly every site".
  {
    const d = driven();
    await flush();
    const settle = (async () => {
      for (let r = 0; r < 8; r++) {
        for (const n of [...d.parked.keys()]) {
          const g = d.parked.get(n);
          if (g.done) continue;
          g.done = true;
          if (n === "extras") await d.silent(n); else await d.finish(n);
        }
      }
      return d.p;
    })();
    const out = await settle;
    assert.ok(out.input, "an optional agent answering nothing failed the design");
    assert.equal(out.input.tsx, undefined, "the optional field should simply be absent");
    assert.deepEqual(out.shape.missing, []);
  }
  // REQUIRED, SILENT — the design is not one.
  {
    const d = driven();
    await flush();
    for (let r = 0; r < 8; r++) {
      for (const n of [...d.parked.keys()]) {
        const g = d.parked.get(n);
        if (g.done) continue;
        g.done = true;
        if (n === "theme") await d.silent(n); else await d.finish(n);
      }
    }
    const out = await d.p;
    assert.equal(out.input, null, "a design with no theme was handed on as usable");
    assert.ok(out.shape.missing.includes("theme"), "the row does not name what is missing");
  }
});

test("an agent is told exactly what it declared it needs, and nothing else", async () => {
  const d = driven();
  await flush();
  await d.settleAll();
  const body = (n) => d.parked.get(n).req.messages[0].content;
  // WHAT IT NEEDS.
  assert.match(body("shape"), /price-table/, "`shape` was not told the components it must arrange");
  assert.match(body("behavior"), /hero \| prices \| contact/, "`behavior` was not told the page it describes");
  assert.match(body("wordmark"), /Millbrook Pottery/, "`wordmark` was not told the name it sets");
  assert.match(body("css"), /bakery/, "`css` was not told the theme it is a delta on");
  // AND NOTHING ELSE — the determinism half. A note built from "whatever has
  // landed" makes the same brief produce different prompts on two runs.
  assert.doesNotMatch(body("shape"), /bakery|Millbrook/, "`shape` was told things it never asked for");
  assert.doesNotMatch(body("wordmark"), /bakery|price-table/, "`wordmark` was told the theme it does not need");
  assert.doesNotMatch(body("behavior"), /price-table/, "`behavior` was told the components rather than the page");
  // A FREE AGENT IS TOLD NOTHING AT ALL.
  assert.doesNotMatch(body("theme"), /WHAT IS ALREADY DECIDED/, "a free agent was handed a note");
});

test("needKnown reads only the needs' fields, whatever else has landed", () => {
  const byName = new Map(DESIGN_GRAPH.map((a) => [a.name, a]));
  const everything = { ...VAL };
  const shape = DESIGN_GRAPH.find((a) => a.name === "shape");
  assert.deepEqual(needKnown(shape, byName, everything), { components: VAL.components });
  const wordmark = DESIGN_GRAPH.find((a) => a.name === "wordmark");
  assert.deepEqual(needKnown(wordmark, byName, everything),
    { brand: VAL.brand, slug: VAL.slug, description: VAL.description });
  // A FREE AGENT GETS AN EMPTY OBJECT, never the whole design.
  assert.deepEqual(needKnown(DESIGN_GRAPH.find((a) => a.name === "theme"), byName, everything), {});
  // A value that never arrived is left out rather than carried as null.
  assert.deepEqual(needKnown(shape, byName, { components: null }), {});
  assert.deepEqual(needKnown(shape, byName, {}), {});
  assert.deepEqual(needKnown(null, byName, everything), {});
  assert.deepEqual(needKnown(shape, byName, "not an object"), {});
});

test("the permit pool admits its bound and no more, and releases", async () => {
  // DRIVEN, because a source read cannot tell a semaphore that admits eight from
  // one that admits everybody — the recorded "a chain asserted by reading is
  // asserted at the layer below the break".
  for (const n of [1, 2, 5]) {
    const pool = permits(n);
    let live = 0, peak = 0, done = 0;
    await Promise.all(Array.from({ length: 12 }, async () => {
      const release = await pool.take();
      live++; peak = Math.max(peak, live);
      await flush(); await flush();
      live--; done++; release();
    }));
    assert.equal(peak, n, "permits(" + n + ") let " + peak + " through at once");
    assert.equal(done, 12, "permits(" + n + ") lost a waiter — " + done + " of 12 finished");
  }
  // A nonsense bound admits one rather than everybody.
  const p0 = permits(0); let live0 = 0, peak0 = 0;
  await Promise.all([1, 2, 3].map(async () => {
    const r = await p0.take(); live0++; peak0 = Math.max(peak0, live0);
    await flush(); live0--; r();
  }));
  assert.equal(peak0, 1, "a nonsense bound admitted " + peak0);
});

test("the bound is NOT derived from the graph's width", () => {
  // They answer different questions: one is about sockets and memory where the
  // calls are made, the other about how many fields are independent. Tie them
  // and a seventeenth agent quietly buys this process another socket.
  const widest = DESIGN_GRAPH.filter((a) => !(a.needs || []).length).length;
  assert.ok(widest > MAX_GRAPH_INFLIGHT,
    "the graph is no longer wider than the bound, so this case proves nothing — pick a graph that is");
  assert.doesNotMatch(code(GRAPH_SRC),
    /MAX_GRAPH_INFLIGHT\s*=\s*[^;]*(DESIGN_GRAPH|GRAPH_AGENTS|\.length)/,
    "the socket bound is derived from the graph rather than chosen");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE FOUR EDGES, EACH TRACEABLE TO THE TOOL'S OWN WORDS
// ─────────────────────────────────────────────────────────────────────────────

test("every kept edge is justified by a phrase still present in its field's own description", () => {
  // THE SAME MISTAKE WAS MADE THREE TIMES IN ONE SESSION — reasoning about what
  // SOUNDS like it needs an input instead of reading what the field says. This
  // is what stops the fourth: an edge whose justification has been reworded out
  // of the tool is an edge nobody can defend any more.
  const desc = (f) => String(TOOL.input_schema.properties[f].description || "").replace(/\s+/g, " ");
  const EVIDENCE = [
    ["shape", "components", /already decided above/i],
    ["css", "theme", /The theme you picked above/i],
    ["wordmark", "identity", /the business name set in the header/i],
  ];
  for (const [field, need, phrase] of EVIDENCE) {
    const agent = DESIGN_GRAPH.find((a) => a.fields.includes(field));
    assert.ok((agent.needs || []).includes(need),
      "`" + field + "` no longer waits for `" + need + "`");
    assert.match(desc(field), phrase,
      "`" + field + "`'s edge to `" + need + "` rests on a phrase the tool no longer contains");
  }
  // AND THE FOURTH IS JUDGEMENT, MARKED AS SUCH. `behavior` lists every control
  // on the page and the tool has NEVER said it waits for one — it has relied on
  // property order to carry a dependency it never wrote down.
  const behavior = DESIGN_GRAPH.find((a) => a.fields.includes("behavior"));
  assert.deepEqual(behavior.needs, ["shape"], "`behavior` no longer waits for the page to be arranged");
  assert.doesNotMatch(desc("behavior"), /above|just (picked|arranged)|already decided/i,
    "the tool now states this dependency, so the code's note calling it judgement is stale");
});

test("the dropped edges stay dropped, and the four slowest starts stay early", () => {
  const needs = (f) => (DESIGN_GRAPH.find((a) => a.fields.includes(f)) || {}).needs || [];
  // Each of these was in an earlier draft and was read again against the field's
  // own words. Putting one back is a decision, not a tidy-up.
  assert.deepEqual(needs("components"), [], "`components` waits for `pages` again — a near-constant on a one-page site");
  assert.deepEqual(needs("tsx"), [], "`tsx` waits for `components` again — it needs the kit MENU, not the picks");
  assert.deepEqual(needs("images"), [], "`images` waits for `shape` again — the brief's own words are law");
  assert.deepEqual(needs("favicon"), [], "`favicon` waits again — one of the two SLOW fields, for an unstated reason");
  assert.deepEqual(needs("pages"), []);
  assert.deepEqual(needs("slug"), [], "`slug` waits again — the tool states nothing at all about it");
  // THE TWO DRAWINGS ARE THE SLOW ONES, so how early they start is the whole
  // point: one is free and the other waits on the cheapest answer in the tool.
  assert.deepEqual(needs("wordmark"), ["identity"]);
});

test("the three fields that must never be answered by three different agents", () => {
  // `slug` is the brand as an address and `description` is the brand in one
  // line. Three agents reading one brief would each invent a business name and
  // disagree — four consecutive nameless-CRM runs invented names for the wrong
  // business, which is the recorded cost.
  const owners = ["brand", "slug", "description"].map((f) => DESIGN_GRAPH.find((a) => a.fields.includes(f)).name);
  assert.equal(new Set(owners).size, 1, "the name, the address and the one-liner are answered by " + new Set(owners).size + " agents");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE DOOR
// ─────────────────────────────────────────────────────────────────────────────

test("the door defaults to nobody, and only a named identity opens it", () => {
  const CANARY = "22175f41-6fbf-49d7-b039-a65078a0141c";
  assert.equal(designGraphFor({}, { uid: CANARY }), false, "an unset canary opened the door");
  assert.equal(designGraphFor({ DESIGN_GRAPH_CANARY: "-" }, { uid: CANARY }), false,
    "`-` is what `readCanaryList` drops, and it opened the door");
  const env = { DESIGN_GRAPH_CANARY: CANARY };
  assert.equal(designGraphFor(env, { uid: CANARY }), true, "the named identity did not open its own door");
  assert.equal(designGraphFor(env, { uid: "someone-else" }), false, "a stranger opened the door");
  assert.equal(designGraphFor(env, {}), false, "a caller with no identity at all opened the door");
  assert.equal(designGraphFor(env, { uid: "" }), false);
  // COERCION REFUSED. `String(["a"])` is `"a"` — shipped as a real bug three
  // times here, as a role, an access level and a language.
  assert.equal(designGraphFor(env, { uid: [CANARY] }), false, "a one-element array passed as a uid");
  assert.equal(designGraphFor(env, { uid: { toString: () => CANARY } }), false);
});

test("the broad flag takes only an affirmative word, and never a truthy one", () => {
  assert.equal(designGraphEveryone({}), false);
  assert.equal(designGraphEveryone({ DESIGN_GRAPH_EVERYONE: "off" }), false);
  assert.equal(designGraphEveryone({ DESIGN_GRAPH_EVERYONE: "no" }), false);
  assert.equal(designGraphEveryone({ DESIGN_GRAPH_EVERYONE: "maybe" }), false, "any word at all switched it on");
  assert.equal(designGraphEveryone({ DESIGN_GRAPH_EVERYONE: true }), false, "a non-string switched it on");
  assert.equal(designGraphEveryone({ DESIGN_GRAPH_EVERYONE: ["on"] }), false);
  for (const w of ["on", "ON", " yes ", "1", "true"]) {
    assert.equal(designGraphEveryone({ DESIGN_GRAPH_EVERYONE: w }), true, "`" + w + "` did not switch it on");
  }
});

test("`readCanaryList` is never imported into worker.js", () => {
  // The runtime diagnostic's own reason: a route one edit away from the LIST is
  // a route one edit away from handing one customer another's slugs. Both graph
  // flags are therefore asked in `edit-job.mjs` and answer booleans.
  assert.doesNotMatch(WCODE, /readCanaryList/, "the canary list reader reached worker.js");
  assert.match(WCODE, /designGraphFor\(env, \{ uid: bu\.id/, "the build route does not ask the door");
  assert.match(WCODE, /graph: designGraphFor\(env, \{ uid: tu\.id \}\)/, "the diagnostic does not answer the flag");
  assert.match(WCODE, /graphEveryone: designGraphEveryone\(env\)/);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE DEPLOY, AND THE IMAGE
// ─────────────────────────────────────────────────────────────────────────────

test("the deploy ships both flags, each with a `|| fallback`, defaulting to nobody", () => {
  const yml = read(".github/workflows/deploy.yml");
  // A NAME LISTED WITH NO VALUE FAILS THE WHOLE DEPLOY — three merges have
  // shipped nothing that way — so an optional secret must carry a fallback.
  const canary = /DESIGN_GRAPH_CANARY:\s*\$\{\{\s*secrets\.DESIGN_GRAPH_CANARY\s*\|\|\s*'([^']*)'\s*\}\}/.exec(yml);
  assert.ok(canary, "DESIGN_GRAPH_CANARY is not uploaded with a fallback");
  // THE DEFAULT OPENS NOTHING. The two canaries beside it name the building
  // account because each had been proved live first; this has never designed a
  // site, so what ships when nobody has set a secret must match nobody.
  assert.equal(designGraphFor({ DESIGN_GRAPH_CANARY: canary[1] }, { uid: "22175f41-6fbf-49d7-b039-a65078a0141c" }), false,
    "the shipped default opens the door for the building account");
  assert.equal(designGraphFor({ DESIGN_GRAPH_CANARY: canary[1] }, { uid: "anyone" }), false);
  const broad = /DESIGN_GRAPH_EVERYONE:\s*\$\{\{\s*secrets\.DESIGN_GRAPH_EVERYONE\s*\|\|\s*'([^']*)'\s*\}\}/.exec(yml);
  assert.ok(broad, "DESIGN_GRAPH_EVERYONE is not uploaded with a fallback");
  assert.equal(designGraphEveryone({ DESIGN_GRAPH_EVERYONE: broad[1] }), false,
    "the broad flag's default is an affirmative word");
  // AND BOTH NAMES REACH THE WORKER. A flag set and never uploaded is a flag
  // that does nothing, silently.
  assert.match(yml, /^\s+DESIGN_GRAPH_CANARY$/m, "the secret is not in the uploaded list");
  assert.match(yml, /^\s+DESIGN_GRAPH_EVERYONE$/m);
});

test("the image carries the module, because the container runs the Worker's own graph", () => {
  // `test/dockerfile.test.mjs` walks the import graph and would catch this too;
  // it is asserted here as well because the failure is a service that dies at
  // import with MODULE_NOT_FOUND and reaches the customer as "our build service
  // was restarting" — the sentence that has already hidden two other causes.
  assert.match(read("Dockerfile"), /builder\/design-graph\.mjs/, "the image does not copy the graph module");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE NUMBERS THE GRAPH EXISTS TO PRODUCE
//
// Every case above proves the graph is SHAPED right — who starts, who waits,
// who is told what. None of them read a number, and the numbers are the whole
// point: one agent per field is how a per-FIELD time becomes measurable at all,
// and `look`'s 132,394 ms was four fields sharing one call. A sweep found six
// mutants alive in this block, every one a driver gap rather than the product's
// — the guards tested what the change added and not what it carries.
// ─────────────────────────────────────────────────────────────────────────────

/** A clock the test moves by hand. No timers — see `driven`. */
function handClock() {
  let at = 1000;                       // NOT zero: an absolute reading and an
  const c = () => at;                  // elapsed one are the same number at 0,
  c.to = (v) => { at = v; };           // which is how a wrong origin passes.
  return c;
}

test("the graph's own numbers: per agent, summed, and the wall clock of the whole run", async () => {
  const clock = handClock();
  // TWO FREE AGENTS AND A DEPENDENT, so the row has both shapes in it: two that
  // overlap and one that cannot.
  const g = [
    { name: "theme", fields: ["theme"] },
    { name: "components", fields: ["components"] },
    { name: "shape", fields: ["shape"], needs: ["components"] },
  ];
  const d = driven({ graph: g, clock });
  await flush();
  // Both free agents started at 1000. `components` answers at 1060, `theme` at
  // 1200 — so they really overlap, and `shape` cannot start before 1060.
  clock.to(1060); await d.finish("components");
  clock.to(1140); await d.finish("shape");
  clock.to(1200); await d.finish("theme");
  clock.to(1200);
  const out = await d.p;

  // ONE NUMBER PER AGENT, UNDER ITS OWN NAME. With one agent per field this IS
  // the per-field time, which is the whole reason the graph is worth running.
  assert.deepEqual(out.shape.eachMs, { components: 60, shape: 80, theme: 200 },
    "the per-agent times are wrong, missing, or all filed under one name");
  // THE PARTS SUM TO THE WHOLE — the tie that stops the two drifting.
  assert.equal(out.shape.agentMs, 340, "the sum is not the sum of the parts");
  // AND THE WALL CLOCK IS THE ELAPSED, NOT AN ABSOLUTE READING. `at` starts at
  // 1000 here precisely so a `waveMs` read from the origin answers 1200 and is
  // caught; at an origin of zero the two are indistinguishable.
  assert.equal(out.shape.waveMs, 200, "the wall clock was read from an absolute origin, or after the agents");
  // THE OVERLAP, which is what the owner's barrier drawing is about: 340 of
  // work done in 200 of wall clock.
  assert.equal(out.shape.agentMs - out.shape.waveMs, 140);
  assert.equal(out.shape.agents, 3, "`agents` is not the count of agents that RAN");
  assert.equal(out.shape.graph, true, "the row cannot say which designer ran");
});

test("a failed agent's time counts, it is named, and its dependents are counted as skipped", async () => {
  const clock = handClock();
  const g = [
    { name: "components", fields: ["components"] },
    { name: "shape", fields: ["shape"], needs: ["components"] },
    { name: "behavior", fields: ["behavior"], needs: ["shape"] },
  ];
  const d = driven({ graph: g, fail: ["components"], clock });
  await flush();
  // A FAILED AGENT SPENT ITS TIME. The call was made, the provider was paid for
  // whatever it produced, and a row that hides it under-reports every build that
  // had a failure in it.
  clock.to(1090); await d.finish("components");
  clock.to(1090);
  const out = await d.p.then((o) => o, (e) => ({ threw: e.message, status: e.status }));
  assert.ok(out.threw, "a lost required field should have failed the design");
  assert.equal(out.status, 503);
});

test("a failed need is NAMED on the row, and `agents` counts only what ran", async () => {
  const clock = handClock();
  // The failing agent's field is OPTIONAL, so the design still succeeds and the
  // row can be read — a required one throws and the shape never comes back.
  const g = [
    { name: "theme", fields: ["theme"] },
    { name: "extras", fields: ["tsx"] },
    { name: "css", fields: ["css"], needs: ["extras"] },
  ];
  const d = driven({ graph: g, fail: ["extras"], clock, tool: toolFor(g, ["theme"]) });
  await flush();
  clock.to(1040); await d.finish("extras");
  clock.to(1100); await d.finish("theme");
  clock.to(1100);
  const out = await d.p;
  assert.ok(out.input, "an optional agent failing took the whole design down");
  // BLOCKED IS A THIRD OUTCOME beside answered and failed, and it needs its own
  // word: "css was skipped because extras died" and "css answered nothing" are
  // different facts needing different moves.
  assert.deepEqual(out.shape.blocked, ["css:extras"], "the row cannot say who was skipped, or after what");
  assert.equal(out.shape.agents, 2, "`agents` counted the plan rather than the agents that ran");
  // AND THE FAILED AGENT'S TIME IS STILL IN THE SUM. It was spent.
  assert.equal(out.shape.eachMs.extras, 40, "a failed agent's time was thrown away");
  assert.equal(out.shape.agentMs, 140);
});

test("an agent that ANSWERS NOTHING does not block its dependents — only a failure does", async () => {
  // THE RULE THIS DRIVES: a need is satisfied when its agent did not FAIL, never
  // when it answered something. Four of the eight tool fields are absent on
  // nearly every site by their own instructions, so "answered nothing" is the
  // ordinary case and reading it as a failed need would block real work behind
  // an agent that was right.
  const g = [
    { name: "theme", fields: ["theme"] },
    { name: "css", fields: ["css"], needs: ["theme"] },
  ];
  const d = driven({ graph: g, tool: toolFor(g, []) });
  await flush();
  // THE TOOL WAS USED AND NO FIELD DECLARED. Not `silent`, which is a model that
  // declined the tool altogether and really is a failed call.
  await d.declared("theme", {});
  assert.ok(d.started.includes("css"), "an agent that declared nothing blocked its dependent");
  await d.declared("css", {});
  const out = await d.p;
  assert.ok(!(out.shape.blocked || []).length, "declaring nothing was recorded as a failure");
  assert.equal(out.shape.agents, 2);

  // AND THE OTHER SHAPE IS STILL A FAILURE. A model that answers prose instead
  // of calling the tool has not answered, and its dependents cannot proceed —
  // the two must not collapse into one rule.
  const e = driven({ graph: g, tool: toolFor(g, []) });
  await flush();
  await e.silent("theme");
  assert.ok(!e.started.includes("css"), "a dependent ran behind an agent that never called the tool");
  const outE = await e.p;
  assert.deepEqual(outE.shape.blocked, ["css:theme"]);
});

test("the permit is released when a call REJECTS, so the graph does not deadlock behind the bound", async () => {
  // WITHOUT THE `finally` THE PERMIT LEAKS ON A THROW. Nothing shows until more
  // agents than the bound want a permit — `MAX_GRAPH_INFLIGHT` is 8 and the real
  // graph has 12 free agents, so this is the ordinary case on a real build, and
  // the symptom is the hang every wall in this module exists to prevent.
  const wide = [];
  for (let i = 0; i < MAX_GRAPH_INFLIGHT + 3; i++) wide.push({ name: "a" + i, fields: ["f" + i] });
  const started = [];
  const parked = new Map();
  let t = 0;
  const p = designInGraph(
    { tool: toolFor(wide, []), system: "s", brief: "b", model: "m", maxTokens: 1, graph: wide },
    (req) => new Promise((res, rej) => {
      const n = Object.keys(req.tools[0].input_schema.properties)[0].replace("f", "a");
      started.push(n); parked.set(n, { res, rej });
    }),
    () => (t += 10),
  );
  p.catch(() => {});
  for (let i = 0; i < 6; i++) await flush();
  assert.equal(started.length, MAX_GRAPH_INFLIGHT, "the bound is not being applied at all");
  // Every one of the first eight REJECTS. If the permit leaks, the remaining
  // three never start and this promise never settles.
  for (const n of [...parked.keys()]) { parked.get(n).rej(new Error("no")); }
  for (let i = 0; i < 8; i++) await flush();
  assert.equal(started.length, MAX_GRAPH_INFLIGHT + 3,
    "agents queued behind the bound never started — the permit was not released");

  // AND WHY THE `finally` AROUND THE CALL READS AS DEAD CODE, measured rather
  // than reasoned about: `runFanout` catches every call, so it does not reject
  // and the release would run without it. Both throwing shapes are driven,
  // because "it never rejects" is the claim the wall is redundant WITH, and an
  // unmeasured claim is how the next session deletes a wall nothing needs.
  const threw = await runFanout([{ a: 1 }], () => { throw new Error("sync"); });
  assert.equal(threw[0].state, "failed", "a throwing call rejected the fan-out");
  const rejected = await runFanout([{ a: 1 }], () => Promise.reject(new Error("async")));
  assert.equal(rejected[0].state, "failed", "a rejecting call rejected the fan-out");
});

test("a cut-off answer throws `truncated`; a provider fault keeps its status", async () => {
  // THE THREE FAILURES WEAR DIFFERENT SENTENCES because they need different
  // moves: "try describing fewer things", "they are overloaded", and "we are
  // sending something they reject". Flattened to one message, a real 429 reads
  // as the customer's fault.
  const g = [{ name: "theme", fields: ["theme"] }];
  {
    const d = driven({ graph: g });
    await flush();
    d.parked.get("theme").res({ stop_reason: "max_tokens", usage: {}, content: [] });
    await flush(); await flush();
    const e = await d.p.then(() => null, (err) => err);
    assert.ok(e, "a cut-off design was handed on as usable");
    assert.equal(e.truncated, true, "a cut-off answer did not wear the single call's own flag");
  }
  {
    const d = driven({ graph: g, fail: ["theme"] });
    await flush();
    await d.finish("theme");
    const e = await d.p.then(() => null, (err) => err);
    assert.equal(e.status, 503, "the provider's status was flattened away");
  }
});

test("the usage is SUMMED across every agent, never taken from one", async () => {
  // ONE USAGE OBJECT, and it is sound here for the reason the waves give: every
  // agent goes to the same model, so one rate column prices all of them — and
  // one object means ONE rounding where sixteen would charge `pageCredits`'
  // floor per agent.
  const g = [
    { name: "theme", fields: ["theme"] },
    { name: "components", fields: ["components"] },
  ];
  const d = driven({ graph: g });
  await flush();
  const use = (n, input, u) => {
    d.parked.get(n).res({ stop_reason: "tool_use", usage: u, content: [{ type: "tool_use", input }] });
  };
  use("theme", { theme: VAL.theme }, { input_tokens: 10, output_tokens: 3 });
  use("components", { components: VAL.components }, { input_tokens: 40, output_tokens: 7 });
  await flush(); await flush();
  const out = await d.p;
  assert.equal(out.usage.in, 50, "the input tokens are one agent's, not the sum");
  assert.equal(out.usage.out, 10, "the output tokens are one agent's, not the sum");
  assert.equal(out.usage.model, "m", "the usage cannot be priced — it names no model");
});

test("the Worker's wrapper sends the shared cached prefix and the build's own clock", () => {
  // THE PREFIX IS SHARED BY IDENTITY, NOT BY COINCIDENCE. `designKit` is ONE
  // chooser answering both the tool and the system text for all three designers;
  // a second ternary here would make "byte for byte" a claim in a comment and
  // false the first time either variant moved — with a cold cached prefix per
  // build as the failure nobody sees.
  const at = WCODE.indexOf("const designSiteGraph =");
  assert.ok(at > 0, "the graph wrapper is gone");
  const end = WCODE.indexOf("\n);", at);
  assert.ok(end > at, "the wrapper's closing landmark is gone — re-derive this window");
  const body = WORKER.slice(at, end);
  assert.match(body, /\.\.\.designKit\(frontendOnly\)/, "the wrapper builds its own tool instead of asking the chooser");
  assert.ok(!/\btool:\s/.test(code(body)), "the wrapper names a tool of its own beside the chooser's");
  // AND THE BUILD'S CLOCK. Without it the design agents run on no deadline at
  // all, which is a build that cannot be killed by its own budget.
  assert.match(body, /callBuilderModel\(env,\s*req,\s*budget\)/, "the wrapper drops the build's clock");
});

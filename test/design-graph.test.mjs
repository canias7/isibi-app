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
 * A graph run against gates the test opens, with no timers anywhere.
 *
 * NO `setTimeout`, DELIBERATELY: two concurrency guards one file over used one,
 * drifted under sweep load and came back with the comment-only CONTROL killed —
 * a guard reporting correct code as broken, which this repository rates worse
 * than a miss.
 */
function driven({ fail = [], graph = DESIGN_GRAPH } = {}) {
  const started = [];
  const parked = new Map();
  let t = 0;
  const call = (req) => new Promise((res, rej) => {
    const name = agentOf(req);
    started.push(name);
    parked.set(name, { res, rej, req });
  });
  const p = designInGraph(
    { tool: TOOL, system: "s", brief: "b", model: "m", maxTokens: 1, graph },
    call,
    () => (t += 10),
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
    /** Answer with a tool call that declares nothing. */
    async silent(name) {
      parked.get(name).res({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "no" }] });
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

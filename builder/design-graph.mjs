// THE DESIGN STEP AS A DEPENDENCY GRAPH, NOT WAVES (2026-09-11, owner, drawing
// it twice: "instead of three waves, it should be one wave… everything at the
// same time, and then one arrives first" → "it should be split into all the 23,
// and if there's one that requires the next then together" → "Ok go").
//
// ── WHAT THE WAVES COST, MEASURED ─────────────────────────────────────────
//
// `DESIGN_WAVES` is 1-2-1: `identity` alone, then `plan` ∥ `look`, then
// `detail` alone. A wave waits for EVERY agent of the wave before it, so on
// `ravenscroft-and-fyne` (2026-09-10) `detail` waited out the whole of `look`
// — 132,394 ms — while needing nothing `look` answers. Three of the four
// agents ran by themselves, and the only overlap in the entire design step was
// `plan` (78,560) hiding under `look`.
//
// A graph has no barriers: an agent starts the moment ITS OWN inputs land.
//
// ── AND MOST OF THE WAITS DO NOT SURVIVE BEING ASKED ABOUT ────────────────
//
// The waves were derived from the tool's STATED dependencies — the sequencing
// phrases in each field's own prose ("the theme you picked above", "you have
// just picked from the kit", "already decided above", "only when needsWeb is").
// SEVEN of the 22 first-build fields carry one. Fifteen carry none.
//
// Of the seven, only FOUR earn an edge, and the other three were read again
// against the field's own words and dropped:
//
//   * `components` ← `pages` — DROPPED. `pages` is "This site is ONE page (at
//     most 1)… One entry: what the site is called, route /". A near-constant,
//     left over from when `MAX_PAGES` was 5 — and it was sitting at the head of
//     the longest chain in the graph doing nothing.
//   * `tsx` ← `components` — DROPPED. It needs the kit's MENU, not which
//     fifteen were picked, and its own field says "OMIT THIS FIELD ENTIRELY…
//     that is the right answer for nearly every site". Worst case: one
//     duplicate part.
//   * `images` ← `shape` — DROPPED. "THE BRIEF'S OWN WORDS ABOUT PHOTOGRAPHS
//     ARE LAW"; the shape only tinted the wording.
//   * `wordmark` ← `theme` — DROPPED. Colour contrast only, and the tool names
//     its own safe answer: "a plate behind the letters is the safe shape".
//
// This module records that history because the same mistake was made three
// times in one session — reasoning about what SOUNDS like it needs an input
// instead of reading what the field says. Every edge below traces to a sentence
// that can be quoted, or is marked as judgement.
//
// ── AND NOT EVERY FIELD IS REQUIRED, WHICH CHANGES THE FAILURE RULE ───────
//
// 14 of the 22 are required; `tsx`, `qr`, `css`, `lang`, `langs`, `three`,
// `needsWeb` and `webQueries` are not, and four of those are ABSENT on nearly
// every site by their own instructions. One agent per field would mean four
// agents each buying a model call to answer "nothing" — so the usually-absent
// optional fields share ONE agent. It costs no parallelism, because a "nothing"
// answer is instant either way, and it saves three calls on every build.
//
// `wavesUsable` already asks the TOOL which fields are required, so an agent
// that answers nothing is fatal or fine depending on its fields and not on
// anything written here. That is reused rather than re-decided.
//
// DEPENDENCY-FREE of `worker.js`, like `design-waves.mjs` beside it, and the
// Dockerfile has to COPY it: the Worker's module graph is the container's job
// runtime, and `test/dockerfile.test.mjs` walks the imports.

import { runFanout } from "./model-fanout.mjs";
import { usageOf } from "./page-gen.mjs";
import {
  waveRequest,
  mergeWaves,
  wavesUsable,
} from "./design-waves.mjs";

/**
 * THE GRAPH. Sixteen agents over the 22 first-build fields.
 *
 * `needs` NAMES OTHER AGENTS, never fields. An agent is the unit that runs, so
 * an edge to a field would have to be resolved to the agent holding it on every
 * read — and two ways of spelling one edge is how they drift.
 *
 * NO `needs` MEANS IT STARTS IMMEDIATELY. Twelve of the sixteen do, so this
 * list IS the running order and nothing anywhere says "wave 1, wave 2".
 *
 * `backend` IS DELIBERATELY ABSENT, exactly as in the waves: a first build does
 * not send it and the ADD step owns it. `graphFields` refuses a field the tool
 * does not carry, which is what keeps that true rather than remembered.
 */
export const DESIGN_GRAPH = [
  // ── NOTHING TO WAIT FOR ──────────────────────────────────────────────────
  {
    name: "identity",
    // THE THREE STAY TOGETHER, AND IT IS NOT A PERFORMANCE CHOICE. A `slug` is
    // the brand as an address and a `description` is the brand in one line;
    // three agents reading the same brief would each invent a business name and
    // they would disagree. Four consecutive nameless-CRM runs invented names for
    // the wrong business, which is the recorded cost of getting this wrong.
    // They are also the three cheapest answers in the tool, so nothing is lost.
    fields: ["brand", "slug", "description"],
  },
  { name: "theme", fields: ["theme"] },
  {
    name: "components",
    // NOT WAITING FOR `pages`, and that is the single biggest change here. Its
    // prose says "you have just arranged the page above" — but `pages` answers
    // one page at route "/" on every first build, so the edge carried no
    // information and stood at the head of the longest chain.
    fields: ["components"],
  },
  { name: "pages", fields: ["pages"] },
  { name: "kind", fields: ["kind"] },
  { name: "purpose", fields: ["purpose"] },
  { name: "action", fields: ["action"] },
  { name: "images", fields: ["images"] },
  {
    name: "favicon",
    // ONE OF THE TWO DRAWINGS, AND IT WAITS FOR NOTHING. An earlier draft had it
    // waiting for `identity` and `theme`; the tool states neither, and it is one
    // of the two SLOW fields, so that edge cost the most and bought the least.
    fields: ["favicon"],
  },
  {
    name: "extras",
    // THE USUALLY-ABSENT OPTIONAL FIELDS, IN ONE CALL. Each says so itself —
    // `tsx` "OMIT THIS FIELD ENTIRELY… the right answer for nearly every site",
    // `three` is absent on nearly every site, and `qr`'s never-invent rule means
    // a first build almost never has one. Three agents answering "nothing" cost
    // three calls and save no time at all, because a "nothing" answer is instant.
    fields: ["tsx", "qr", "three"],
  },
  { name: "lang", fields: ["lang", "langs"] },
  {
    name: "web",
    // ONE DECISION, NOT TWO. `webQueries` says "Only when needsWeb is true" —
    // the one stated dependency in the whole tool that is really the back half
    // of a single yes/no, so sharing an agent removes the edge rather than
    // scheduling around it.
    fields: ["needsWeb", "webQueries"],
  },

  // ── THE FOUR THAT GENUINELY WAIT ─────────────────────────────────────────
  {
    name: "wordmark",
    // "`text` means the business name set in the header's own type" — you cannot
    // set a name you have not been given. The tool ALSO says "draw in colours
    // that read against the theme you just picked", and that half is dropped:
    // it is contrast only, and the field names its own safe answer, "a plate
    // behind the letters is the safe shape".
    fields: ["wordmark"],
    needs: ["identity"],
  },
  {
    name: "css",
    // "CSS ON TOP OF THE THEME… The theme you picked above is the whole look…
    // OMIT this field entirely unless the customer's own words ask for something
    // specific the theme does not give." It IS the delta on the theme, so it
    // cannot be written without one.
    fields: ["css"],
    needs: ["theme"],
  },
  {
    name: "shape",
    // "The page and the component manifest are already decided above, so arrange
    // what you have chosen." It arranges a list; it cannot arrange one it has not
    // got. The `pages` half of that sentence is dropped for the reason
    // `components` gives above.
    fields: ["shape"],
    needs: ["components"],
  },
  {
    name: "behavior",
    // THIS EDGE IS JUDGEMENT, NOT THE TOOL'S, AND IT IS A CORRECTION.
    // `behavior` is "EVERYTHING ON THIS SITE THAT DOES SOMETHING… this list is
    // the WHOLE set", which nobody can write before the page is arranged — and
    // the tool has NEVER said so. It has relied on property order to carry a
    // dependency it never wrote down, which works by accident under the waves
    // (it sits in the last one) and would not here. Stated as an edge so it
    // stops depending on luck.
    fields: ["behavior"],
    needs: ["shape"],
  },
];

/** Every agent by name. Derived, never a second list. */
export const GRAPH_AGENTS = DESIGN_GRAPH.map((a) => a.name);

/** Every field the graph claims, in list order. Derived. */
export const GRAPH_FIELDS = DESIGN_GRAPH.flatMap((a) => a.fields);

/**
 * How many model calls the graph may hold open at once.
 *
 * NOT DERIVED FROM THE GRAPH'S WIDEST POINT, and that is the same decision
 * `MAX_WAVE_AGENTS` and `MAX_MODEL_FANOUT` both make for the same reason: this
 * answers *how many sockets and how much memory one process may hold*, which is
 * a question about where the calls are made, while the graph's width answers
 * *how many fields are independent*, which is a question about the product. Tie
 * them and the day somebody adds a seventeenth agent is the day this process
 * quietly gets another socket without anybody deciding to.
 *
 * 8 rather than 12, matching `MAX_MODEL_FANOUT`: the band split already runs
 * eight concurrent calls out of the same runtime and has been measured doing it
 * (seven at once on `kestrel-bindery`), so eight is the widest fan-out this
 * platform has evidence for. Twelve is not refused because it is wrong — it is
 * refused because nothing here has run it.
 */
export const MAX_GRAPH_INFLIGHT = 8;

/**
 * Is this a graph a scheduler can actually run?
 *
 * Answers `[]` — "use the waves, or the one call" — for every problem, so a
 * malformed graph is a fallback to a path that works rather than a failure.
 * That is `splitDesign`'s convention and `splitPlan`'s before it.
 *
 * THE CYCLE CHECK IS NOT DEFENSIVE DECORATION. The scheduler gives each agent a
 * promise that awaits its needs; a cycle is two promises awaiting each other,
 * which does not throw — it HANGS, and a hung design step is a build that sits
 * there until the job's clock kills it with nothing to show and everything
 * charged. A refused graph costs one ordinary design call.
 */
export function graphOrder(graph) {
  const list = Array.isArray(graph) ? graph : [];
  if (!list.length) return [];
  const byName = new Map();
  for (const a of list) {
    if (!a || typeof a.name !== "string" || !a.name) return [];
    if (!Array.isArray(a.fields) || !a.fields.length) return [];
    if (byName.has(a.name)) return [];           // two agents of one name
    byName.set(a.name, a);
  }
  // EVERY `needs` NAMES AN AGENT THAT EXISTS. A need naming nothing is an agent
  // whose gate no one ever resolves — the hang above, wearing a typo.
  for (const a of list) {
    for (const n of a.needs || []) {
      if (typeof n !== "string" || !byName.has(n)) return [];
      if (n === a.name) return [];               // its own need is a cycle of one
    }
  }
  // A TOPOLOGICAL ORDER, AND ITS EXISTENCE IS THE ACYCLIC PROOF. Kahn's
  // algorithm: repeatedly take every agent whose needs are already placed. If a
  // pass places nobody and agents remain, what remains is a cycle.
  const placed = new Set();
  const order = [];
  while (order.length < list.length) {
    const ready = list.filter((a) => !placed.has(a.name) && (a.needs || []).every((n) => placed.has(n)));
    if (!ready.length) return [];                // a cycle
    for (const a of ready) { placed.add(a.name); order.push(a.name); }
  }
  return order;
}

/**
 * Whether to run this design as a graph, and every reason not to.
 *
 * Mirrors `splitDesign` exactly — a revise is never split, an unstated mode is
 * NOT a build (cannot-tell must not fall to the permissive side at the door of
 * the most expensive step), and a tool carrying a field no agent answers is a
 * tool that has drifted from the graph. Each refusal answers `[]`.
 */
export function splitGraph({ tool, current, mode } = {}) {
  if (current) return [];
  if (mode !== "build") return [];
  const props = (tool && tool.input_schema && tool.input_schema.properties) || {};
  const names = Object.keys(props);
  if (!names.length) return [];
  // EVERY FIELD THE TOOL CARRIES MUST BELONG TO AN AGENT. A field the tool asks
  // for and nobody answers comes back empty on every graph build — silently,
  // because absent is a legal answer for the optional ones. That is `three`
  // shipped dead for a day, one layer over.
  for (const n of names) if (!GRAPH_FIELDS.includes(n)) return [];
  if (!graphOrder(DESIGN_GRAPH).length) return [];
  return DESIGN_GRAPH;
}

/**
 * What ONE agent is told, and it is exactly what it declared it needs.
 *
 * NOT "everything answered so far", and the reason is determinism rather than
 * tidiness. In a graph the set of finished agents at any instant depends on how
 * fast the calls came back, so a note built from "whatever has landed" makes the
 * same brief produce different prompts on two runs — and then a build that
 * designed well once cannot be reproduced. Scoped to `needs`, the note is a
 * function of the graph and nothing else.
 *
 * `waveNote` does the writing; this only chooses what it may see.
 */
export function needKnown(agent, byName, known) {
  const have = known && typeof known === "object" ? known : {};
  const out = {};
  for (const n of (agent && agent.needs) || []) {
    const dep = byName.get(n);
    for (const f of (dep && dep.fields) || []) {
      if (have[f] !== undefined && have[f] !== null) out[f] = have[f];
    }
  }
  return out;
}

/**
 * A permit pool. `MAX_GRAPH_INFLIGHT` calls may be in the air at once; the rest
 * queue and take a permit as one is released.
 *
 * Its own function so the bound can be DRIVEN — a source read cannot tell a
 * semaphore that admits eight from one that admits everybody, and that is the
 * recorded "a chain asserted by reading is asserted at the layer below the
 * break".
 */
export function permits(n) {
  const max = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  let live = 0;
  const waiting = [];
  const release = () => {
    live--;
    const next = waiting.shift();
    if (next) { live++; next(); }
  };
  return {
    async take() {
      if (live < max) { live++; return release; }
      await new Promise((r) => waiting.push(r));
      return release;
    },
  };
}

/**
 * Run the design as a graph.
 *
 * Every agent gets a promise that waits for its needs and then fires. There is
 * no round, no barrier and no wave: the list's own `needs` ARE the schedule.
 *
 * A DEAD DESIGN IS NOT ABORTED MID-WAY, and that is a decision against the
 * waves' behaviour rather than an omission. `designInWaves` breaks between waves
 * when a required field has gone missing, which is worth doing there because a
 * whole wave of expensive calls sits on the other side of the barrier. Here
 * twelve of the sixteen are already in flight before anything can fail, so the
 * abort could save at most the four dependents — on a build whose design failed,
 * which the route's catch refunds IN FULL. Buying four calls with determinism is
 * the wrong trade: whether an agent got skipped would depend on how fast some
 * unrelated call came back.
 *
 * A FAILED NEED BLOCKS ITS DEPENDENTS RATHER THAN HANGING THEM. `shape` cannot
 * arrange a component list that never arrived, so it is skipped and named —
 * `blocked` is a third outcome beside answered and failed, because the three
 * need different sentences and collapsing them is this repository's most
 * recorded failure.
 */
export async function designInGraph({ tool, system, brief, model, files = [], maxTokens, graph } = {}, call, now = () => Date.now()) {
  const list = Array.isArray(graph) ? graph : [];
  const byName = new Map(list.map((a) => [a.name, a]));
  const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model };
  const known = {};
  const lost = [];
  const strayed = [];
  const faults = [];
  const blocked = [];
  const eachMs = {};
  let agentMs = 0;
  let ran = 0;

  // A GATE PER AGENT, ALL CREATED BEFORE ANY RUNS. Built inside the loop below,
  // an agent whose need appears LATER in the list would await a gate that does
  // not exist yet — so the map is filled first and the order of `DESIGN_GRAPH`
  // stops being load-bearing.
  const gate = new Map(list.map((a) => {
    let open;
    return [a.name, { done: new Promise((r) => { open = r; }), open }];
  }));
  const pool = permits(MAX_GRAPH_INFLIGHT);

  // THE WHOLE GRAPH'S WALL CLOCK, read before anything starts and after
  // everything settles — the same pair `runFanout` stamps on a fan-out, and it
  // keeps the same name (`waveMs`) so `waveMarks` projects it unchanged and the
  // stored row means the same thing whichever designer ran.
  const at = now();

  await Promise.all(list.map(async (agent, i) => {
    const needs = agent.needs || [];
    const from = await Promise.all(needs.map((n) => gate.get(n).done));
    if (from.some((r) => !r || !r.ok)) {
      blocked.push({ agent: agent.name, after: needs.join(",") });
      gate.get(agent.name).open({ ok: false });
      return;
    }
    const req = waveRequest({
      tool, system, brief, agent, model, files, maxTokens,
      known: needKnown(agent, byName, known),
    });
    const release = await pool.take();
    let out;
    // ONE CALL, THROUGH THE FAN-OUT RATHER THAN BESIDE IT. `runFanout` owns the
    // try/catch that keeps a provider's `status` and `detail` intact and the
    // per-call elapsed that both timing numbers are read from; a second copy
    // here is the recorded "two lists of the same thing" with error handling as
    // its subject, and a sweep cannot kill a `catch` that rethrows.
    try { out = await runFanout([req], (r) => call(r), now); }
    finally { release(); }
    const entry = out[0];
    ran++;
    const u = usageOf(entry && entry.answer, model);
    usage.in += u.in; usage.out += u.out; usage.cacheRead += u.cacheRead; usage.cacheWrite += u.cacheWrite;
    if (entry && Number.isFinite(entry.ms)) {
      agentMs += entry.ms;
      // ONE NUMBER PER AGENT, under its own name. With one agent per field for
      // most of this list, these ARE the per-field times nothing has ever been
      // able to measure — `look`'s 132,394 ms was four fields sharing one call.
      eachMs[agent.name] = (eachMs[agent.name] || 0) + entry.ms;
    }
    if (entry && entry.state === "failed") faults.push(entry);
    // `mergeWaves` FOR ONE AGENT, which is what drops a field it was not asked
    // for. The entry's index is 0 because the fan-out held one call; the agent
    // list handed in is this agent alone, so they line up by construction.
    const merged = mergeWaves([agent], [{ ...entry, i: 0 }]);
    Object.assign(known, merged.input);
    lost.push(...merged.failed);
    strayed.push(...merged.strayed);
    // A NEED IS SATISFIED WHEN ITS AGENT DID NOT FAIL, never when it answered
    // something. An optional field answering nothing is the CORRECT answer on
    // most sites, so treating an empty answer as a failed need would block
    // `shape` behind an `extras` agent that rightly said nothing.
    gate.get(agent.name).open({ ok: !merged.failed.length });
  }));

  const waveMs = now() - at;
  const usable = wavesUsable(tool, known, lost);
  const shape = {
    tool: Object.keys(known).length > 0,
    stop: usable.ok ? "" : String((lost[0] && lost[0].stop) || "short"),
    blocks: lost.map((f) => f.agent + ":" + (f.stop || "?")).slice(0, 8),
    // WHICH DESIGNER RAN, and it is not `waves`. A graph design and a wave
    // design would otherwise be indistinguishable in every stored row, which is
    // the one thing a canary this invisible cannot do without — and the waves'
    // own flag stays false so a reader never has to tell them apart by counting.
    graph: true,
    agents: ran,
    agentMs,
    waveMs,
    eachMs,
    lost: usable.lostAgents,
    missing: usable.missing,
    ...(blocked.length ? { blocked: blocked.map((b) => b.agent + ":" + b.after).slice(0, 8) } : {}),
    ...(strayed.length ? { strayed: strayed.map((s) => s.agent + ":" + s.field).slice(0, 8) } : {}),
  };
  if (strayed.length) console.warn("design graph: an agent answered a field it was not asked for —", shape.strayed.join(" "));
  if (blocked.length) console.warn("design graph: agents skipped behind a failed need —", shape.blocked.join(" "));
  if (usable.ok) return { input: known, shape, usage };
  console.warn("design graph unusable:", "missing=" + usable.missing.join(","), "lost=" + usable.lostAgents.join(","));
  // THE THREE FAILURES KEEP THE WAVES' OWN SENTENCES, word for word, because
  // the route above them is the same route: a cut-off answer wears the single
  // call's `truncated` message so the existing "try describing fewer things"
  // covers it, and a provider fault is re-thrown in `callBuilderModel`'s shape
  // so `upstreamKind` can still tell "they are overloaded" from "we are sending
  // something they reject". Flattened to a message, a real 429 arrives wearing
  // "the designer is busy".
  const cut = lost.find((f) => f.stop === "max_tokens");
  if (cut) {
    const e = new Error("schema truncated at max_tokens");
    e.truncated = true;
    throw e;
  }
  const fault = faults[0];
  if (fault) {
    const e = new Error(String(fault.message || "design agent failed"));
    e.name = String(fault.kind || "Error");
    if (fault.status) e.status = fault.status;
    if (fault.detail) e.detail = fault.detail;
    throw e;
  }
  return { input: null, shape, usage };
}

// THE DESIGN STEP, ANSWERED BY SEVERAL AGENTS AT ONCE
// (2026-09-10, owner: "split the design step too" → "ok go").
//
// `test/band-build.test.mjs` is this file's sibling — the same shape one step
// over, for the PAGE call — and the split of labour is the same: the module is
// driven, the wiring is read, and the one case that settles it runs the real
// orchestration against a fake caller and looks at the design that comes out.
//
// WHAT EACH CASE IS FOR, and every one is a way this ships looking right:
//
//   * a field on the tool that no wave claims — it would come back empty on
//     every split build, silently, because absent is a legal answer for the
//     optional ones. That is `three` shipped dead for a day, one layer over,
//     and only a CENSUS derived from the real tool catches it;
//   * the flag asked in the wrong file — `readCanaryList` is deliberately not
//     imported into `worker.js`, and a second copy of that reader is the
//     widening-by-typo failure it exists to prevent;
//   * the system block not shared — four agents each minting their own cached
//     prefix is a cold read per agent on every build, and nothing fails;
//   * a wave's answers paired by FINISHING order, which is invisible until two
//     agents disagree and impossible to see from the answer;
//   * `action` leaking into the note the shape agent reads, when `shape`'s own
//     description tells that agent the action is not yet named;
//   * the module missing from the image's COPY line, which is a container that
//     dies at import with the sentence a customer reads as "our build service
//     was restarting".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DESIGN_WAVES, DESIGN_AGENTS, WAVE_FIELDS, MAX_WAVE_AGENTS,
  waveTool, waveFields, waveNote, waveRequest,
  splitDesign, readWaveAnswer, mergeWaves, wavesUsable, wavesMissing, designInWaves,
} from "../builder/design-waves.mjs";
import { designSplitFor, designSplitEveryone, readCanaryList } from "../builder/edit-job.mjs";
import { readSchemaTool } from "./integration/schema-tool.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
// WHOLE-LINE COMMENTS BLANKED, LENGTH PRESERVED. Every offset below stays
// honest and no scan can be satisfied by prose that names the thing it forbids
// — which this repository has hit nine times, several of them inside the guard
// written for that trap.
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

// The REAL tool, once. Every case below that asks about a real field asks this
// rather than a fixture, for the reason `readSchemaTool`'s own header gives: a
// stubbed schema measures a prompt nobody sends.
const REAL = await readSchemaTool();

/** A tool small enough to reason about, in the real one's shape. */
const toyTool = (props, required) => ({
  name: "design_schema",
  description: "toy",
  input_schema: { type: "object", properties: props, required },
});

// ─────────────────────────────────────────────────────────────────────────────
// THE CENSUS — the case this file exists for
// ─────────────────────────────────────────────────────────────────────────────

test("every field a first build's tool asks for belongs to exactly one wave", () => {
  const props = Object.keys(REAL.frontendTool.input_schema.properties);
  assert.ok(props.length > 15, "the frontend tool did not resolve — " + props.length + " properties");

  const unclaimed = props.filter((f) => !WAVE_FIELDS.includes(f));
  assert.deepEqual(unclaimed, [], "these fields are on the tool and no agent answers them, so they come back empty on every split build");

  const phantom = WAVE_FIELDS.filter((f) => !props.includes(f));
  assert.deepEqual(phantom, [], "these fields are claimed by an agent and are not on the tool");

  // DISJOINT, not merely covering. Two agents claiming one field is two answers
  // to one question, decided by whichever wave ran last — and on the same wave,
  // by nothing at all.
  const seen = new Map();
  for (const a of DESIGN_AGENTS) for (const f of a.fields) {
    assert.ok(!seen.has(f), "`" + f + "` is claimed by both " + seen.get(f) + " and " + a.name);
    seen.set(f, a.name);
  }
  assert.equal(seen.size, WAVE_FIELDS.length, "a field is listed twice inside one agent");
});

test("`backend` is on the full tool, on no wave, and the full tool is never split", () => {
  const full = Object.keys(REAL.tool.input_schema.properties);
  assert.ok(full.includes("backend"), "the full tool lost `backend` — retarget this case");
  assert.ok(!WAVE_FIELDS.includes("backend"), "no wave may claim `backend`: the ADD step owns it");
  // AND THE CENSUS IS WHAT ENFORCES IT. A tool carrying a field no wave answers
  // is not split at all, so the full tool falls back to the one call rather
  // than designing a site with no backend and calling it done.
  assert.deepEqual(splitDesign({ tool: REAL.tool, current: null, mode: "build" }), [], "the full tool must not split");
  assert.ok(waveFields(REAL.frontendTool, ["brand", "backend"]).indexOf("backend") < 0, "`backend` cannot be asked for off a tool that has none");
});

test("a first build's tool DOES split, into the waves as written", () => {
  const waves = splitDesign({ tool: REAL.frontendTool, current: null, mode: "build" });
  assert.equal(waves, DESIGN_WAVES, "the split must answer the wave list itself, not a copy");
  assert.equal(waves.length, 3);
  assert.deepEqual(waves.map((w) => w.map((a) => a.name)), [["identity"], ["plan", "look"], ["detail"]]);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE DOOR
// ─────────────────────────────────────────────────────────────────────────────

test("the design split is off unless somebody switched it on, and both doors work", () => {
  const uid = "11111111-2222-3333-4444-555555555555";
  assert.equal(designSplitFor({}, { uid }), false, "nothing set must split nothing");
  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: "" }, { uid }), false);
  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: "-" }, { uid: "-" }), false, "`-` is the deploy default and means nobody");

  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: uid }, { uid }), true);
  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: uid }, { uid: "somebody-else" }), false);
  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: uid.toUpperCase() }, { uid }), true, "a uid is matched case-insensitively");

  // EVERYONE, and it is a word rather than a truthiness test.
  assert.equal(designSplitEveryone({ DESIGN_SPLIT_EVERYONE: "on" }), true);
  assert.equal(designSplitEveryone({ DESIGN_SPLIT_EVERYONE: " YES " }), true);
  assert.equal(designSplitEveryone({ DESIGN_SPLIT_EVERYONE: "off" }), false);
  assert.equal(designSplitEveryone({ DESIGN_SPLIT_EVERYONE: "maybe" }), false, "an unknown word is not consent");
  assert.equal(designSplitEveryone({ DESIGN_SPLIT_EVERYONE: true }), false, "a non-string is refused, never coerced");
  assert.equal(designSplitEveryone({}), false);
  assert.equal(designSplitFor({ DESIGN_SPLIT_EVERYONE: "on" }, { uid }), true, "everyone wins over an empty canary");

  // `String(["…"])` is the bare string. Shipped as a real bug three times here.
  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: uid }, { uid: [uid] }), false, "an array must not coerce into a uid");
  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: uid }, {}), false, "no identity is not everybody");
  assert.equal(readCanaryList("*").length, 0, "the reader must never admit a wildcard");
});

test("the door lives with the other doors, and `readCanaryList` stays out of worker.js", () => {
  assert.ok(/designSplitFor,\s*designSplitEveryone/.test(WCODE), "worker.js must import the door rather than spell it");
  assert.ok(!/\breadCanaryList\b/.test(WCODE),
    "readCanaryList is deliberately not imported into worker.js — a route one edit from the list is a route one edit from handing one customer another's slugs");
  const job = code(read("builder/edit-job.mjs"));
  assert.ok(/export function designSplitFor\b/.test(job) && /export function designSplitEveryone\b/.test(job));
  assert.ok(/readCanaryList\(env && env\.DESIGN_SPLIT_CANARY\)/.test(job), "the canary must be read through the one reader");
});

test("the deploy uploads both flags with a fallback, and defaults to nobody", () => {
  const dep = read(".github/workflows/deploy.yml");
  // A NAME LISTED WITH NO VALUE FAILS THE WHOLE DEPLOY — three merges have
  // shipped nothing that way — so an optional secret must carry a `|| fallback`.
  assert.match(dep, /DESIGN_SPLIT_CANARY: \$\{\{ secrets\.DESIGN_SPLIT_CANARY \|\| '-' \}\}/);
  assert.match(dep, /DESIGN_SPLIT_EVERYONE: \$\{\{ secrets\.DESIGN_SPLIT_EVERYONE \|\| 'off' \}\}/);
  // …and named in the secret list, or the Worker never receives them.
  const list = between(dep, "BAND_SPLIT_CANARY", "        env:", "the uploaded secret list");
  assert.ok(list.includes("DESIGN_SPLIT_CANARY") && list.includes("DESIGN_SPLIT_EVERYONE"),
    "a flag that is set and never uploaded is a flag the Worker cannot read");
  // The defaults are what a fresh deploy runs, and they must split nothing.
  assert.equal(designSplitFor({ DESIGN_SPLIT_CANARY: "-", DESIGN_SPLIT_EVERYONE: "off" }, { uid: "anyone" }), false);
});

test("the runtime diagnostic answers the two flags and never the list", () => {
  const block = between(WCODE, '"/api/site/runtime"', "\n    }\n", "the runtime route");
  assert.ok(/design: designSplitFor\(env, \{ uid: tu\.id \}\)/.test(block), "the effective answer must be asked, not restated");
  assert.ok(/designEveryone: designSplitEveryone\(env\)/.test(block));
  assert.ok(!/DESIGN_SPLIT_CANARY/.test(block), "the route must never hand back the canary list itself");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE MODULE, DRIVEN
// ─────────────────────────────────────────────────────────────────────────────

test("an agent's tool carries its own fields, its own required, and the REAL prose", () => {
  const look = DESIGN_AGENTS.find((a) => a.name === "look");
  const t = waveTool(REAL.frontendTool, look.fields);
  assert.deepEqual(Object.keys(t.input_schema.properties), look.fields);
  // BY IDENTITY, never by shape: a copy is a tool that starts the same and
  // drifts, which is a second cache entry from the first byte that differs and
  // — worse — a 1-entry enum where production sends 100.
  assert.equal(t.input_schema.properties.theme, REAL.frontendTool.input_schema.properties.theme,
    "the field must be the tool's own object");
  assert.ok((REAL.frontendTool.input_schema.properties.theme.enum || []).length > 50,
    "the theme shortlist did not resolve — this case would pass against a stub");
  assert.equal(t.name, REAL.frontendTool.name, "the tool keeps its name, or `tool_choice` names nothing");

  // REQUIRED IS INTERSECTED, never restated.
  const req = REAL.frontendTool.input_schema.required;
  assert.deepEqual(t.input_schema.required, req.filter((f) => look.fields.includes(f)));
  assert.ok(t.input_schema.required.includes("theme") && !t.input_schema.required.includes("pages"),
    "an agent must require its own fields and none of anybody else's");
  // …and every required field of the whole design is required of exactly one
  // agent, which is what makes `wavesUsable` able to answer at all.
  const spread = DESIGN_AGENTS.flatMap((a) => waveTool(REAL.frontendTool, a.fields).input_schema.required);
  assert.deepEqual([...spread].sort(), [...req].sort(), "a required field is required of exactly one agent");
});

test("an agent carrying no required field requires nothing — the branch, driven", () => {
  const t = waveTool(toyTool({ a: { type: "string" }, b: { type: "string" } }, ["a"]), ["b"]);
  assert.deepEqual(t.input_schema.required, [], "not `undefined`, and not the whole design's list");
  assert.deepEqual(Object.keys(t.input_schema.properties), ["b"]);
});

test("the note states what an earlier wave answered, and never guesses", () => {
  assert.equal(waveNote({}), "", "nothing decided is nothing said");
  assert.equal(waveNote(null), "");
  const n = waveNote({ brand: "Hartley's", slug: "hartleys-barbers", kind: "shopfront", lang: "en" });
  assert.ok(n.includes("WHAT IS ALREADY DECIDED"));
  assert.ok(n.includes("Hartley's") && n.includes("hartleys-barbers") && n.includes("shopfront"));
  // ABSENT MEANS ABSENT. A note that invents a kind for an agent whose wave
  // never settled it is worse than one that says nothing.
  assert.ok(!/It is a:/.test(waveNote({ brand: "x" })), "an unanswered field must not appear at all");
  assert.ok(!waveNote({ brand: "x", kind: "" }).includes("It is a"), "an empty answer is not an answer");
  // NON-STRINGS ARE REFUSED, NOT COERCED.
  assert.ok(!waveNote({ brand: ["Hartley's"] }).includes("Hartley"), "an array must not become a brand");
});

test("`action` is answered in wave 1 and is never in the note the shape agent reads", () => {
  const n = waveNote({ brand: "Hartley's", kind: "shopfront", action: ["Book a cut"] });
  assert.ok(!n.includes("Book a cut"),
    "`shape`'s own description says the primary action is NOT yet named — carrying it here makes that a lie");
  // …and the field really is in wave 1, so this is a decision rather than an
  // accident of a field nobody answers early.
  assert.ok(DESIGN_AGENTS.find((a) => a.name === "identity").fields.includes("action"));
  assert.match(REAL.frontendTool.input_schema.properties.shape.description, /NOT yet named/i,
    "the tool stopped saying it — re-decide whether the note may carry `action`");
});

test("the note carries the page top to bottom, which is what wave 3 answers against", () => {
  const n = waveNote({
    brand: "Hartley's",
    components: ["SiteChrome", { name: "PriceList" }],
    shape: [{ path: "/", sections: ["hero — the name and a booking button", "prices — three across"] }],
  });
  assert.ok(n.includes("SiteChrome") && n.includes("PriceList"), "a component may be a name or an object");
  assert.ok(n.includes("The page / reads, top to bottom"));
  assert.ok(n.includes("hero — the name and a booking button") && n.includes("prices — three across"),
    "`behavior` cannot describe a control on a page it has not been shown");
  assert.ok(!waveNote({ shape: [{ path: "/", sections: [] }] }).includes("reads, top to bottom"),
    "a page with no bands says nothing rather than an empty line");
  assert.ok(!waveNote({ shape: "not a list" }).includes("reads"), "a non-list shape is not read");
});

test("one agent's request: the shared system block, its own tool, the brief, the ceiling", () => {
  const plan = DESIGN_AGENTS.find((a) => a.name === "plan");
  const req = waveRequest({
    tool: REAL.frontendTool, system: REAL.system, brief: "A barber in Sheffield",
    agent: plan, known: { brand: "Hartley's" }, model: "grok-4.6", maxTokens: 16000,
  });
  // THE SYSTEM BLOCK IS THE DESIGN CALL'S OWN, BYTE FOR BYTE — the most
  // valuable decision here. Four agents read a prefix every ordinary build has
  // already made warm; a wave-specific block would be a cold prefix per agent
  // AND a second copy of every rule.
  assert.equal(req.system[0].text, REAL.system, "the system text must be the single call's, unchanged");
  assert.deepEqual(req.system[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(req.tools[0].cache_control, { type: "ephemeral" });
  // …AND THE TOOL IS NOT SHARED, which is the other half and the one that saves
  // the money: the plan agent carries the kit menu and nobody else does.
  assert.deepEqual(Object.keys(req.tools[0].input_schema.properties), plan.fields);
  assert.equal(req.tool_choice.type, "tool");
  assert.equal(req.tool_choice.name, REAL.frontendTool.name);
  assert.equal(req.model, "grok-4.6");
  assert.equal(req.max_tokens, 16000, "the ceiling is the caller's, never a number invented here");

  const text = typeof req.messages[0].content === "string" ? req.messages[0].content : "";
  assert.ok(text.includes("A barber in Sheffield"), "THE BRIEF MUST REACH THE AGENT — without it an agent designs a section for no business at all");
  assert.ok(text.includes("Hartley's"), "the earlier wave's answers ride in the message, never the cached prefix");
  for (const f of plan.fields) assert.ok(text.includes(f), "the agent must be told which parts are its own — missing " + f);
  assert.ok(/AT THE SAME TIME/.test(text), "an agent must be told the other parts are being decided beside it, or it answers them too");
});

test("attached files ride before the text, and no files keeps the message a plain string", () => {
  const agent = DESIGN_AGENTS[0];
  const bare = waveRequest({ tool: REAL.frontendTool, system: "s", brief: "b", agent, model: "m", maxTokens: 10 });
  assert.equal(typeof bare.messages[0].content, "string", "a request with no attachment must not change shape");
  const img = { type: "image", source: { type: "base64", media_type: "image/png", data: "x" } };
  const withFile = waveRequest({ tool: REAL.frontendTool, system: "s", brief: "b", agent, model: "m", maxTokens: 10, files: [img, null] });
  assert.equal(withFile.messages[0].content[0], img, "the block is the caller's own");
  assert.equal(withFile.messages[0].content.length, 2, "a falsy entry is dropped, and the text is last");
  assert.equal(withFile.messages[0].content[1].type, "text");
});

test("every reason not to split is a fallback to the one call, never a failure", () => {
  const t = REAL.frontendTool;
  assert.equal(splitDesign({ tool: t, current: { theme: "x" }, mode: "build" }).length, 0, "a revise anchored on a stored design is never split");
  assert.equal(splitDesign({ tool: t, current: null, mode: "revise" }).length, 0, "and `mode` says so even when the state could not be read");
  assert.equal(splitDesign({ tool: t, current: null, mode: "" }).length, 0, "an unstated mode is not a build");
  assert.equal(splitDesign({ tool: toyTool({}, []), current: null, mode: "build" }).length, 0, "a tool with no properties splits into nothing");
  assert.equal(splitDesign({}).length, 0);
  assert.equal(splitDesign({ tool: toyTool({ brand: {}, mystery: {} }, []), current: null, mode: "build" }).length, 0,
    "a field no wave claims means the two have drifted, and the safe answer is the call that asks for everything");
});

test("the socket bound is not derived from the wave list", () => {
  assert.equal(typeof MAX_WAVE_AGENTS, "number");
  const widest = Math.max(...DESIGN_WAVES.map((w) => w.length));
  assert.ok(MAX_WAVE_AGENTS >= widest, "today's waves must fit under the bound");
  // They agree by coincidence at 2 vs 4; what must never happen is the bound
  // BEING the widest wave, which hands the container N more sockets the day
  // somebody adds an agent, without anybody deciding to.
  const mod = code(read("builder/design-waves.mjs"));
  assert.ok(/MAX_WAVE_AGENTS = \d+/.test(mod), "the bound must be a number somebody chose");
  assert.ok(!/MAX_WAVE_AGENTS = Math\.max|MAX_WAVE_AGENTS = DESIGN_WAVES/.test(mod));
  // AND THE CHECK IT GUARDS IS PROVED BY LOWERING THE BOUND, NOT BY A WIDE
  // FIXTURE. `splitDesign` reads the module's own waves, so a fixture cannot
  // reach it — and the check cannot fire at 2 against 4, which makes deleting
  // it an INERT mutant that reads exactly like a test gap. What kills that
  // pair is `MAX_WAVE_AGENTS = 1`: wave 2 becomes too wide and a first build
  // stops splitting, which the case above catches. This asserts the two halves
  // that make that true.
  assert.ok(/wave\.length > MAX_WAVE_AGENTS\) return \[\];/.test(mod), "the width check is gone");
  assert.ok(widest > 1, "the waves have no wave wider than one — lowering the bound would prove nothing");
});

test("an answer is read, and a cut-off one is a failed agent", () => {
  const ok = { i: 0, state: "done", answer: { stop_reason: "tool_use", content: [{ type: "tool_use", input: { brand: "x" } }] } };
  assert.equal(readWaveAnswer(ok).ok, true);
  assert.deepEqual(readWaveAnswer(ok).input, { brand: "x" });

  assert.equal(readWaveAnswer({ i: 0, state: "failed", status: 429, kind: "Error" }).ok, false);
  assert.equal(readWaveAnswer({ i: 0, state: "done", answer: { stop_reason: "end_turn", content: [{ type: "text", text: "no" }] } }).ok, false,
    "a model that made no tool call answered nothing");
  // A TRUNCATED tool_use CARRIES HALF-WRITTEN JSON, and merged it looks exactly
  // like an agent that answered fully and declared fewer fields.
  const cut = { i: 0, state: "done", answer: { stop_reason: "max_tokens", content: [{ type: "tool_use", input: { pages: [] } }] } };
  assert.equal(readWaveAnswer(cut).ok, false, "a cut-off answer must never be merged");
  assert.equal(readWaveAnswer(cut).stop, "max_tokens", "and the reason must survive, or the customer gets the wrong sentence");
  assert.equal(readWaveAnswer(undefined).ok, false);

  // A FAILED CALL CARRYING A TRANSCRIPT IS STILL A FAILED CALL, and this is
  // the case that makes the `state === "done"` test load-bearing on its own.
  // Every failure `runFanout` produces today carries no `answer` at all, so
  // `use && use.input` refuses them anyway and dropping the state test changes
  // nothing — an INERT mutant wearing a test gap's clothes. The shape below is
  // one change away: a cut-off stream relayed as a failure with what it got.
  assert.equal(readWaveAnswer({
    i: 0, state: "failed", status: 500,
    answer: { stop_reason: "tool_use", content: [{ type: "tool_use", input: { brand: "half" } }] },
  }).ok, false, "a call that failed must never be read as an answer, whatever it came back with");
});

test("answers are paired by INDEX, not by the order they came back", () => {
  const agents = [{ name: "one", fields: ["brand"] }, { name: "two", fields: ["slug"] }];
  // Deliberately handed back reversed: this is what a fan-out really produces.
  const out = [
    { i: 1, state: "done", answer: { content: [{ type: "tool_use", input: { slug: "b" } }] } },
    { i: 0, state: "done", answer: { content: [{ type: "tool_use", input: { brand: "a" } }] } },
  ];
  assert.deepEqual(mergeWaves(agents, out).input, { brand: "a", slug: "b" },
    "paired by finishing order this reads brand:'b' — which is invisible from the answer");
});

test("an agent may only write its own fields; a stray one is dropped and named", () => {
  const agents = [{ name: "plan", fields: ["pages"] }, { name: "look", fields: ["theme"] }];
  const out = [
    { i: 0, state: "done", answer: { content: [{ type: "tool_use", input: { pages: [1], theme: "mine" } }] } },
    { i: 1, state: "failed", kind: "TimeoutError" },
  ];
  const m = mergeWaves(agents, out);
  assert.deepEqual(m.input, { pages: [1] }, "the plan agent must not answer the look agent's field");
  assert.deepEqual(m.strayed, [{ agent: "plan", field: "theme" }], "and it must be named rather than silently dropped");
  assert.equal(m.failed.length, 1);
  assert.equal(m.failed[0].agent, "look");
  assert.equal(m.failed[0].stop, "TimeoutError");
});

test("a design is usable when every required field it asked for came back", () => {
  const t = toyTool({ a: {}, b: {}, c: {} }, ["a", "b"]);
  assert.deepEqual(wavesUsable(t, { a: 1, b: 2, c: 3 }, []), { ok: true, missing: [], lostAgents: [] });
  assert.equal(wavesUsable(t, { a: 1 }, [{ agent: "two" }]).ok, false);
  assert.deepEqual(wavesUsable(t, { a: 1 }, [{ agent: "two" }]).missing, ["b"]);
  assert.deepEqual(wavesUsable(t, { a: 1 }, [{ agent: "two" }]).lostAgents, ["two"]);
  assert.equal(wavesUsable(t, { a: 1, b: null }, []).ok, false, "null is not an answer");
  // AN AGENT WHOSE FIELDS ARE ALL OPTIONAL MAY FAIL AND THE DESIGN GOES ON.
  // Nothing in today's waves is that agent — every one carries a required field
  // — so the branch is driven here rather than asserted about the real tool.
  assert.equal(wavesUsable(t, { a: 1, b: 2 }, [{ agent: "extras" }]).ok, true);
});

test("part-way through, only the fields already ASKED FOR can be missing", () => {
  const t = toyTool({ a: {}, b: {}, c: {} }, ["a", "b", "c"]);
  assert.deepEqual(wavesMissing(t, { a: 1 }, ["a"]), [], "b and c belong to later waves and are legitimately absent");
  assert.deepEqual(wavesMissing(t, {}, ["a"]), ["a"], "a required field this wave asked for and did not get ends the design");
  assert.deepEqual(wavesMissing(t, { a: 1, b: 2 }, ["a", "b", "c"]), ["c"]);
  assert.deepEqual(wavesMissing(t, { a: 1 }, []), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE ORCHESTRATION, RUN — the case that settles it
// ─────────────────────────────────────────────────────────────────────────────

/** What each agent answers, in the real tool's field names. */
const ANSWERS = {
  identity: {
    brand: "Hartley's", slug: "hartleys-barbers", description: "A barber in Sheffield",
    kind: "shopfront", action: ["Book a cut"], lang: "en", needsWeb: false,
  },
  plan: {
    purpose: "Get people booked in", pages: [{ path: "/", name: "Home" }],
    components: ["SiteChrome", "PriceList"],
    shape: [{ path: "/", sections: ["hero — the name and a booking button", "prices — three across"] }],
    images: [],
  },
  look: { theme: "ink-and-chalk", wordmark: { text: "Hartley's" }, favicon: { initials: "H" } },
  detail: { behavior: [{ control: "Book a cut", on: "click", does: "opens the form", affects: "the form", result: "a form", source: "component" }] },
};

/**
 * A caller in `callBuilderModel`'s shape, with two knobs a real fan-out has and
 * a synchronous stub does not: answers that arrive out of order, and one call
 * that fails.
 */
function fakeCaller({ fail = [], usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 } } = {}) {
  const sent = [];
  const call = async (req) => {
    sent.push(req);
    const name = Object.keys(req.tools[0].input_schema.properties).join(",");
    const agent = DESIGN_AGENTS.find((a) => a.fields.filter((f) => name.split(",").includes(f)).length && name.split(",").every((f) => a.fields.includes(f)));
    assert.ok(agent, "the request did not resolve to an agent: " + name);
    if (fail.includes(agent.name)) {
      const e = new Error("upstream said no");
      e.status = 429;
      e.detail = '{"type":"rate_limit_error"}';
      e.name = "HttpError";
      throw e;
    }
    return { stop_reason: "tool_use", usage, content: [{ type: "tool_use", input: ANSWERS[agent.name] }] };
  };
  return { call, sent };
}

test("THE WHOLE DESIGN, RUN: three waves, four agents, one answer per field", async () => {
  const { call, sent } = fakeCaller();
  const out = await designInWaves({
    ...REAL, tool: REAL.frontendTool, brief: "A barber in Sheffield",
    model: "grok-4.6", maxTokens: 16000, waves: DESIGN_WAVES,
  }, call);

  assert.equal(sent.length, 4, "four agents, one call each");
  // THE RETURN SHAPE IS `designSiteSchema`'S, EXACTLY — everything below the
  // call site reads it and none of it knows which designer ran.
  assert.deepEqual(Object.keys(out).sort(), ["input", "shape", "usage"]);
  for (const [agent, fields] of Object.entries(ANSWERS)) {
    for (const [k, v] of Object.entries(fields)) {
      assert.deepEqual(out.input[k], v, agent + " lost `" + k + "` between its answer and the design");
    }
  }
  assert.equal(out.shape.tool, true);
  assert.equal(out.shape.waves, true, "the trace must be able to say which designer ran");
  assert.equal(out.shape.agents, 4);
  assert.deepEqual(out.shape.lost, []);
  assert.deepEqual(out.shape.missing, []);

  // ONE USAGE OBJECT, SUMMED, priced off ONE model — four rows would charge
  // `pageCredits`' floor four times.
  assert.deepEqual(out.usage, { in: 400, out: 80, cacheRead: 4000, cacheWrite: 0, model: "grok-4.6" });
});

test("the agents of a wave really run AT THE SAME TIME", () => {
  // THE PROPERTY THE WHOLE CHANGE EXISTS FOR, and the one a source read cannot
  // see: a loop that awaits each agent in turn is textually almost the same and
  // buys nothing at all — the design still takes as long as the sum of its
  // parts, and every number in the entry describing it is wrong.
  //
  // STAGED WITH A GATE, NEVER A TIMER. `list.map(async …)` invokes every
  // callback synchronously as far as its first `await`, so by the time
  // `designInWaves` has returned its promise every call of the wave has started
  // and parked. Timers drift under sweep load and killed a comment-only control
  // once already, which is a guard reporting correct code as broken.
  const gates = [];
  const tool = toyTool({ brand: { type: "string" }, slug: { type: "string" } }, []);
  const waves = [[{ name: "a", fields: ["brand"] }, { name: "b", fields: ["slug"] }]];
  const call = (req) => new Promise((res) => {
    const field = Object.keys(req.tools[0].input_schema.properties)[0];
    gates.push(() => res({ stop_reason: "tool_use", usage: {}, content: [{ type: "tool_use", input: { [field]: field } }] }));
  });
  const p = designInWaves({ tool, system: "s", brief: "b", model: "m", maxTokens: 1, waves }, call);
  assert.equal(gates.length, 2, "the second agent of the wave had not started — they ran one after another");
  // Finish BACKWARDS, by hand, so the finishing order is a fact.
  for (let i = gates.length - 1; i >= 0; i--) gates[i]();
  return p.then((out) => assert.deepEqual(out.input, { brand: "brand", slug: "slug" }));
});

test("…and wave 3 is told what waves 1 and 2 answered, which is the whole point of ordering", async () => {
  const { call, sent } = fakeCaller();
  await designInWaves({ ...REAL, tool: REAL.frontendTool, brief: "b", model: "m", maxTokens: 10, waves: DESIGN_WAVES }, call);

  const textOf = (req) => (typeof req.messages[0].content === "string" ? req.messages[0].content : req.messages[0].content.at(-1).text);
  const first = textOf(sent[0]);
  assert.ok(!first.includes("WHAT IS ALREADY DECIDED"), "wave 1 has nothing to be told");

  // Wave 2 knows the identity and nothing of the plan (it is being written
  // beside it).
  const planReq = sent.find((r) => Object.hasOwn(r.tools[0].input_schema.properties, "components"));
  const planText = textOf(planReq);
  assert.ok(planText.includes("Hartley's") && planText.includes("shopfront"), "the plan agent must know the name and the kind");
  assert.ok(!planText.includes("ink-and-chalk"), "the look is being decided at the same moment and cannot be known");
  assert.ok(!planText.includes("Book a cut"), "and the action must not reach the agent writing `shape`");

  const lookText = textOf(sent.find((r) => Object.hasOwn(r.tools[0].input_schema.properties, "wordmark")));
  assert.ok(lookText.includes("Hartley's"), "a mark cannot draw a brand nobody told it");

  // Wave 3 knows both.
  const detail = textOf(sent.at(-1));
  assert.ok(detail.includes("Hartley's"), "wave 3 lost the identity");
  assert.ok(detail.includes("PriceList"), "wave 3 lost the component manifest, which `tsx` is answered against");
  assert.ok(detail.includes("hero — the name and a booking button"), "wave 3 lost the page, which `behavior` is answered against");
  assert.ok(detail.includes("ink-and-chalk"), "wave 3 lost the theme");
});

test("a lost agent that takes a required field with it stops the design, free and named", async () => {
  const { call, sent } = fakeCaller({ fail: ["look"] });
  await assert.rejects(
    () => designInWaves({ ...REAL, tool: REAL.frontendTool, brief: "b", model: "m", maxTokens: 10, waves: DESIGN_WAVES }, call),
    (e) => {
      // RE-THROWN IN `callBuilderModel`'S OWN SHAPE — the route reads `status`,
      // `detail` and the class to tell "they are overloaded" from "we are
      // sending something they reject". Flattened to a message, a real 429
      // arrives wearing "the designer is busy".
      assert.equal(e.status, 429);
      assert.ok(e.detail.includes("rate_limit_error"));
      assert.equal(e.name, "HttpError");
      assert.ok(!e.truncated, "this is a provider fault, not a ceiling");
      return true;
    },
  );
  // WAVE 3 NEVER RAN. Continuing buys a wave that designs against a design that
  // is already dead, and charges for it.
  assert.equal(sent.length, 3, "the design must stop at the end of the wave that lost the field");
});

test("a cut-off agent wears the truncation sentence, not the provider's", async () => {
  const call = async (req) => {
    const has = (f) => Object.hasOwn(req.tools[0].input_schema.properties, f);
    if (has("theme")) return { stop_reason: "max_tokens", usage: {}, content: [{ type: "tool_use", input: { theme: "half-" } }] };
    const agent = has("brand") ? "identity" : has("components") ? "plan" : "detail";
    return { stop_reason: "tool_use", usage: {}, content: [{ type: "tool_use", input: ANSWERS[agent] }] };
  };
  await assert.rejects(
    () => designInWaves({ ...REAL, tool: REAL.frontendTool, brief: "b", model: "m", maxTokens: 10, waves: DESIGN_WAVES }, call),
    (e) => {
      assert.equal(e.truncated, true, "the route says 'try describing fewer things' off this flag alone");
      assert.equal(e.message, "schema truncated at max_tokens", "the single call's own error, word for word");
      return true;
    },
  );
});

test("agents that answered nothing usable, with no fault to blame, come back as an empty design", async () => {
  // Every call succeeds and none of them calls the tool: `input: null` is the
  // same answer a single call gives for a model that declared nothing, which
  // the route already refuses.
  const call = async () => ({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "I'd rather not" }] });
  const out = await designInWaves({ ...REAL, tool: REAL.frontendTool, brief: "b", model: "m", maxTokens: 10, waves: DESIGN_WAVES }, call);
  assert.equal(out.input, null);
  assert.equal(out.shape.tool, false);
  assert.deepEqual(out.shape.lost, ["identity"], "and it names who, so the 422 is not a guess");
  assert.equal(out.shape.agents, 1, "the design stopped after the wave that answered nothing");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WIRING — every hop a value has to travel
// ─────────────────────────────────────────────────────────────────────────────

test("the build route decides, and the decision reaches the call", () => {
  const block = between(WCODE, "const designWaves = splitDesign({", "liftBackend(dz && dz.input)", "the design call site");
  assert.ok(/tool: designKit\(firstBuild\)\.tool/.test(block), "the split must be asked about the tool that is really going out");
  assert.ok(/current: editState/.test(block));
  assert.ok(/mode: firstBuild \? "build" : "revise"/.test(block),
    "`mode` must be stated: `editState` is also null when the config read blips, and cannot-tell must not read as a first build");
  assert.ok(/const useWaves = designWaves\.length > 0 && designSplitFor\(env, \{ uid: bu\.id/.test(block),
    "the door must be asked with a real identity, and only when there are waves");
  // THE HOP THAT SHIPS DEAD IF IT IS CUT: the decision made and never used.
  assert.ok(/useWaves\s*\n?\s*\? await designSiteWaves\(/.test(block), "the split answer must choose the designer");
  assert.ok(/: await designSiteSchema\(env, briefWithLinks, models\.design, editState, attached\.blocks, budget, firstBuild\)/.test(block),
    "the single call must remain untouched as the other side of the ternary");
});

test("the wrapper hands the module the tool, the system, the ceiling and the caller", () => {
  const block = between(WCODE, "const designSiteWaves = (env, brief, model, files, budget, waves, frontendOnly)", "\n);\n", "the wrapper");
  assert.ok(/designInWaves\(/.test(block));
  assert.ok(/\.\.\.designKit\(frontendOnly\)/.test(block), "the tool and system must come off the ONE chooser, or 'byte for byte' is a coincidence");
  assert.ok(/maxTokens: SITE_SCHEMA_MAX_TOKENS/.test(block), "the ceiling is the single call's own — no number invented");
  assert.ok(/\(req\) => callBuilderModel\(env, req, budget\)/.test(block), "the build's own clock must ride on every agent's call");
  assert.ok(/brief, model, files, waves/.test(block));
});

test("one chooser for the tool and the system text, asked by both designers", () => {
  assert.ok(/const designKit = \(frontendOnly\) => \(\{/.test(WCODE));
  // The single call must ASK it rather than keep its own ternary — two lists of
  // the same thing, with a cache miss per agent as the failure nobody sees.
  const single = between(WCODE, "async function designSiteSchema(", "const j = await callBuilderModel", "the single design call");
  assert.ok(/designKit\(frontendOnly\)\.tool/.test(single), "the single call must take its tool from the chooser");
  assert.ok(/designKit\(frontendOnly\)\.system/.test(single), "…and its system text");
  assert.ok(!/frontendOnly \? FRONTEND_SCHEMA_TOOL : SITE_SCHEMA_TOOL/.test(single), "a second ternary is a second list");
  assert.ok(!/frontendOnly \? FRONTEND_SCHEMA_SYSTEM : SITE_SCHEMA_SYSTEM/.test(single));
});

test("the trace records which designer ran", () => {
  const block = between(WCODE, 'tr.at("design"', "knownTables", "the design trace mark");
  assert.ok(/useWaves \? \{ waves: designWaves\.length, agents: designWaves\.flat\(\)\.length \}/.test(block),
    "a split build and a single-call build publish the same site to the same address — the trace is the only thing that can tell them apart");
});

test("the image carries the module and the fan-out it imports", () => {
  const dockerfile = read("Dockerfile");
  const worker = dockerfile.split("\n").find((l) => l.includes("./worker/builder/"));
  assert.ok(worker, "the worker COPY line is gone — retarget this case");
  assert.ok(worker.includes("builder/design-waves.mjs"),
    "the container imports the Worker's own module graph; a missing COPY is a service that dies at import");
  assert.ok(worker.includes("builder/model-fanout.mjs"), "design-waves imports it, so the image needs it too");
});

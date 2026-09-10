// THE DESIGN STEP, ANSWERED BY SEVERAL AGENTS INSTEAD OF ONE
// (2026-09-10, owner: "split the design step too" → "ok go").
//
// ── WHAT THE DESIGN STEP IS TODAY ──────────────────────────────────────────
//
// ONE model call carrying a 64,076-character tool (a first build; 93,598 with
// the backend) and answering 22 properties in order. Property order IS
// generation order — a field can see every field answered before it and none
// after — so the whole thing is one long sequential write, measured at ~170 s.
//
// ── WHY IT CAN BE CUT, AND WHY THE OBVIOUS DERIVATION IS WRONG ─────────────
//
// The tempting move is to derive the dependency graph from the tool's own
// prose: read each field's description, find the other field names in it, sort.
// MEASURED, and it does not work — the graph that falls out is CYCLIC
// (`components` names `theme`, `theme` names `css`, `css` names `components`)
// because a mention is not a dependency. A field's prose names another to say
// "answered before this", "do not repeat what is there", or "this is what will
// consume you", and those are three different relations wearing one shape.
//
// So the waves below are the STATED dependencies, the ones the design step's
// own reasoning gives as reasons:
//
//   * every planning answer is an answer about `kind`, so `kind` precedes the
//     plan;
//   * `tsx` is answered "by a model that has just searched the kit and come up
//     short" — it cannot be answered before `components`;
//   * `behavior` "cannot be described before the page that holds it exists" —
//     it cannot be answered before `components` and `shape`;
//   * the two marks DRAW the brand, so they cannot precede `brand`;
//   * `css` is the layer over the theme, so it cannot precede `theme`.
//
// Everything else is independent, and the independence is the whole feature.
//
// ── WHERE THE TIME ACTUALLY IS, AND IT IS NOT THE PLAN ────────────────────
//
// `wordmark` and `favicon` DRAW SVG, and this repository has measured what a
// drawn answer costs: the `wordmark` EDIT LANE — one call drawing one mark —
// ran 292,336 ms on Grok (run 41), after three earlier attempts were cut dead
// at the 240 s wall. In the single-call design step those two drawings sit in
// sequence with the plan, so the plan waits for them and they wait for the
// plan. Wave 2 is what puts them side by side.
//
// ── AND EACH AGENT CARRIES ONLY ITS OWN SCHEMA ────────────────────────────
//
// The second, quieter win. `components` alone is 32,603 characters — HALF of
// what a first build sends — because it carries the kit's component menu. The
// look agent has no business with it and no longer pays to be shown it:
//
//     identity   7,016      plan  41,082      look  10,820      detail  4,636
//
// against 64,076 for the one call that answers all of them. The plan agent is
// still most of it, which is the honest shape: the kit menu has to reach
// whoever picks components, and nobody else.

import { runFanout } from "./model-fanout.mjs";
import { usageOf } from "./page-gen.mjs";

/**
 * THE WAVES, AND THEY ARE A TOTAL, DISJOINT PARTITION OF THE FRONTEND FIELDS.
 *
 * One entry per wave, in order; each wave is a list of AGENTS that run at the
 * same time. A wave waits for every agent of the wave before it, because that
 * is what "can see what was answered earlier" means once the answers are in
 * different calls.
 *
 * `backend` IS DELIBERATELY ABSENT. A first build does not send it
 * (`FRONTEND_SCHEMA_TOOL` destructures it out), and the ADD step owns it now —
 * so a wave carrying it would be a fourth copy of a decision two other paths
 * already made. `waveFields` refuses a field the tool does not carry, which is
 * what keeps that true rather than remembered.
 */
export const DESIGN_WAVES = [
  [
    {
      name: "identity",
      // WHAT THE BRIEF ALONE ANSWERS. `brand`/`slug`/`description` are answered
      // FIRST in the single call too, before anything about the look, and
      // `kind` immediately after because every planning answer depends on it.
      // The rest are here because nothing in the plan or the look is an input
      // to them: a language, the one action, a QR destination, a 3D scene and
      // the search gate all read the brief and stop.
      fields: ["brand", "slug", "description", "kind", "lang", "langs", "action", "qr", "three", "needsWeb", "webQueries"],
    },
  ],
  [
    {
      name: "plan",
      // THE PLAN. Needs `kind` and nothing from the look — a theme does not
      // decide how many bands a page has, and a band does not decide a theme.
      fields: ["purpose", "pages", "components", "shape", "images"],
    },
    {
      name: "look",
      // THE LOOK, AND THE TWO DRAWINGS. Needs `brand` (the marks draw it) and
      // `kind` (a tool's front page is the tool). This is the agent that was
      // making the plan wait.
      fields: ["theme", "css", "wordmark", "favicon"],
    },
  ],
  [
    {
      name: "detail",
      // THE TWO THAT GENUINELY CANNOT BE ANSWERED EARLIER, both by the design
      // step's own stated reasoning rather than by our convenience.
      fields: ["tsx", "behavior"],
    },
  ],
];

/** Every agent, flattened, in wave order — for the guards and the merge. */
export const DESIGN_AGENTS = DESIGN_WAVES.flat();

/** Every field the waves claim, in wave order. Derived, never a second list. */
export const WAVE_FIELDS = DESIGN_AGENTS.flatMap((a) => a.fields);

/**
 * The widest a wave gets, and it is not a product number.
 *
 * It answers *how many calls may one container hold open* — memory and
 * sockets — which is the same question `MAX_MODEL_FANOUT` answers for the
 * bands, and it is deliberately NOT derived from the wave list: the day
 * somebody adds a fifth agent to wave 2 is a day to decide about sockets on
 * purpose rather than to get four more of them for free.
 *
 * THE CHECK IT GUARDS CANNOT FIRE TODAY, and that is stated rather than left
 * to be rediscovered: the widest wave is 2 and this is 4, so a sweep mutant
 * that deletes the check in `splitDesign` changes no answer and reads exactly
 * like a test gap. It is proved instead by LOWERING this number, which makes
 * wave 2 too wide and the whole design unsplittable — that mutant dies. Do not
 * delete the check because nothing appears to need it.
 */
export const MAX_WAVE_AGENTS = 4;

/**
 * A tool carrying ONE agent's fields and nothing else.
 *
 * Built off the REAL tool that was going to be sent, never off a copy: the
 * properties, their prose, their enums and their `required` all come from the
 * one literal, so an agent cannot end up asking for a 1-entry enum where
 * production sends 100 — the trap `test/integration/schema-tool.mjs` states in
 * its own header, one layer over.
 *
 * `required` is INTERSECTED rather than restated. A field required of the whole
 * design is required of the agent that carries it, and an agent carrying none
 * of them requires nothing — which is the correct answer and not a special
 * case.
 */
export function waveTool(tool, fields) {
  const src = (tool && tool.input_schema && tool.input_schema.properties) || {};
  const want = Array.isArray(fields) ? fields.filter((f) => Object.hasOwn(src, f)) : [];
  const properties = {};
  for (const f of want) properties[f] = src[f];
  const req = (tool && tool.input_schema && tool.input_schema.required) || [];
  return {
    ...tool,
    input_schema: {
      ...tool.input_schema,
      properties,
      required: req.filter((f) => want.includes(f)),
    },
  };
}

/**
 * Which of an agent's fields the tool actually carries.
 *
 * THE FILTER IS THE WALL THAT KEEPS `backend` OUT, and it works in both
 * directions: a first build's tool has no `backend`, so no wave can ask for
 * one; and a field added to the tool and to no wave is caught by
 * `test/design-waves.test.mjs`'s census rather than silently going unanswered
 * — which is this repository's most-shipped failure with a design field
 * (`three`, shipped dead for a day) wearing its other face.
 */
export function waveFields(tool, fields) {
  const src = (tool && tool.input_schema && tool.input_schema.properties) || {};
  return (Array.isArray(fields) ? fields : []).filter((f) => Object.hasOwn(src, f));
}

/**
 * What an agent is TOLD about the waves before it.
 *
 * Not the raw JSON of everything answered so far — that is the whole design
 * echoed back, and most of it is nothing to do with this agent. What it needs
 * is the handful of facts its own fields rest on, in the words the design step
 * already uses for them.
 *
 * ABSENT MEANS ABSENT, never a guess. A field the earlier wave did not answer
 * is simply not stated, because a note that invents `kind: "shopfront"` for an
 * agent whose wave never settled it is worse than one that says nothing: the
 * agent would design confidently against a fact nobody established.
 *
 * `action` IS ANSWERED IN WAVE 1 AND IS DELIBERATELY NOT SAID HERE. `shape`'s
 * own description tells the agent writing it that "the primary action is NOT
 * yet named — decide where it sits and let the words come later", which is true
 * of the single call (property order puts `action` after `shape`) and would
 * become a lie the moment this note carried it. The field is genuinely
 * brief-only, so it belongs in wave 1; what it does not belong in is the
 * paragraph the shape agent reads.
 */
export function waveNote(known) {
  const k = known && typeof known === "object" ? known : {};
  const lines = [];
  const say = (label, v) => { if (v !== undefined && v !== null && v !== "") lines.push(label + ": " + v); };
  say("The site is called", typeof k.brand === "string" ? k.brand : "");
  say("Its address will be", typeof k.slug === "string" ? k.slug : "");
  say("In one line it is", typeof k.description === "string" ? k.description : "");
  say("It is a", typeof k.kind === "string" ? k.kind : "");
  say("Written in", typeof k.lang === "string" ? k.lang : "");
  if (Array.isArray(k.pages) && k.pages.length) {
    say("Its pages are", k.pages.map((p) => (p && typeof p.path === "string" ? p.path : "")).filter(Boolean).join(", "));
  }
  if (Array.isArray(k.components) && k.components.length) {
    say("It is built from", k.components.map((c) => (typeof c === "string" ? c : (c && c.name) || "")).filter(Boolean).join(", "));
  }
  // THE PAGE ITSELF, TOP TO BOTTOM, which wave 3 cannot do without: `behavior`
  // describes what every control on the page DOES, and the design step's own
  // reasoning is that a control "cannot be described before the page that holds
  // it exists". The page that holds it is this list. Wave 2 never sees it —
  // `shape` is answered by the agent this would be describing to.
  for (const s of Array.isArray(k.shape) ? k.shape : []) {
    if (!s || typeof s !== "object") continue;
    const path = typeof s.path === "string" ? s.path : "";
    const bands = (Array.isArray(s.sections) ? s.sections : []).filter((x) => typeof x === "string" && x);
    if (path && bands.length) say("The page " + path + " reads, top to bottom", bands.join(" | "));
  }
  if (typeof k.theme === "string" && k.theme) say("Its theme is", k.theme);
  return lines.length ? "\n\nWHAT IS ALREADY DECIDED\n" + lines.join("\n") : "";
}

/**
 * One agent's request.
 *
 * THE SYSTEM BLOCK IS THE DESIGN CALL'S OWN, BYTE FOR BYTE, and that is the
 * most valuable line here — the same decision the band split made and for the
 * same reason. It is cached; sharing it means four agents read a prefix every
 * ordinary build has already made warm, and a rule fixed for the single call is
 * fixed for the agents in the same edit. A wave-specific block would be a
 * second copy of every rule AND a cold prefix per wave.
 *
 * THE TOOL IS NOT SHARED, deliberately, and that is the difference from the
 * bands: each agent's tool is its own fields only, which is what stops the look
 * agent paying for 32,603 characters of component menu it will never use.
 * The cost, stated: four tool prefixes instead of one, each cold until it has
 * been sent once. They stay warm for the same reason the two design variants
 * do — every split build reads all four, so none is an occasional miss.
 */
export function waveRequest({ tool, system, brief, agent, known, model, files = [], maxTokens } = {}) {
  const fields = waveFields(tool, agent && agent.fields);
  const note = waveNote(known);
  const text =
    "Answer ONLY these parts of the design: " + fields.join(", ") + ".\n\n" +
    "BRIEF\n" + String(brief == null ? "" : brief) +
    note +
    "\n\nThe other parts of this design are being decided AT THE SAME TIME by " +
    "someone else. Answer your own and no others — anything you are not asked " +
    "for here is not yours to decide, and a second opinion about it is a second " +
    "answer that has to be thrown away.";
  const blocks = Array.isArray(files) ? files.filter(Boolean) : [];
  return {
    model,
    max_tokens: maxTokens,
    tools: [{ ...waveTool(tool, fields), cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: (tool && tool.name) || "design_schema" },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: String(system == null ? "" : system) }],
    messages: [{ role: "user", content: blocks.length ? [...blocks, { type: "text", text }] : text }],
  };
}

/**
 * Whether to split this design at all, and every reason not to.
 *
 * Answers the waves, or `[]` meaning "use the one call" — so every refusal is a
 * fallback to the path that already works rather than a failure, exactly as
 * `splitPlan` is for the bands.
 *
 * A REVISE IS NOT SPLIT. `currentStateNote` + `EDIT_RULE` anchor a revise on
 * the STORED design, and `EDIT_REQUIRED` empties `required` so absent means
 * unchanged — a contract about one answer, which four answers would have to
 * reproduce four times and could disagree about. The revise is also the cheap
 * half already (~17 credits against ~45), so it is the wrong half to spend risk
 * on.
 *
 * A TOOL THAT DOES NOT CARRY EVERY FIELD A WAVE CLAIMS IS NOT SPLIT either.
 * That is the `backend` case inverted: the frontend tool is expected to be
 * missing it and the waves never ask, but a tool missing something a wave DOES
 * ask for means the two have drifted, and the safe answer to drift is the call
 * that asks for everything at once.
 */
export function splitDesign({ tool, current, mode } = {}) {
  if (current) return [];
  // AN UNSTATED MODE IS NOT A BUILD. Written `mode && mode !== "build"` this
  // reads perfectly and falls to the PERMISSIVE side for the one input nobody
  // supplied — cannot-tell read as a first build, which is this repository's
  // most-cited trap pointed at the door of the most expensive step. The caller
  // always says which; a caller that does not gets the call that asks for
  // everything at once.
  if (mode !== "build") return [];
  const props = (tool && tool.input_schema && tool.input_schema.properties) || {};
  const names = Object.keys(props);
  if (!names.length) return [];
  // EVERY FIELD THE TOOL CARRIES MUST BELONG TO A WAVE. A field the tool asks
  // for and no agent answers is a design field that comes back empty on every
  // split build — silently, because absent is a legal answer for the optional
  // ones. Refusing to split is the safe half of that.
  for (const n of names) if (!WAVE_FIELDS.includes(n)) return [];
  for (const wave of DESIGN_WAVES) if (wave.length > MAX_WAVE_AGENTS) return [];
  return DESIGN_WAVES;
}

/**
 * One agent's answer, out of the model's reply.
 *
 * The SHAPE is kept beside the value for the same reason `designSiteSchema`
 * keeps it: `input: null` from a model that made no tool call and `{}` from one
 * that called the tool and declared nothing are different failures, and a
 * caller that cannot tell them apart writes one sentence for both.
 *
 * `state === "done"` AND `use.input` ARE TWO WALLS, AND THE REDUNDANCY IS
 * DELIBERATE. MEASURED: a failure `runFanout` produces today carries no
 * `answer` at all, so the second test alone refuses every one of them and
 * cutting the first changes no answer — which reads exactly like a test gap and
 * is not one. It stays because the two are claims about different things: one
 * about whether the CALL succeeded, one about whether the model said anything.
 * The day a failure carries a half-written transcript — the shape a cut-off
 * stream is one change away from producing — only the first refuses it.
 *
 * A TRUNCATED ANSWER IS A FAILED AGENT, which is `designSiteSchema`'s own rule
 * (it throws on `max_tokens`) and matters more here, not less: a tool_use block
 * cut off at the ceiling carries half-written JSON, so `input` is a partial
 * object — and merged into the design it would look exactly like an agent that
 * answered fully and declared fewer fields. One wave's half-written `pages` is
 * a site built to a plan nobody finished writing.
 */
export function readWaveAnswer(entry) {
  const j = (entry && entry.answer) || null;
  const content = Array.isArray(j && j.content) ? j.content : [];
  const use = content.find((b) => b && b.type === "tool_use");
  const stop = String((j && j.stop_reason) || (entry && entry.kind) || "");
  return {
    // `!!` BECAUSE A FIELD CALLED `ok` MUST BE A BOOLEAN. Without it a missing
    // entry answers `undefined` — falsy, so the product is right, and one
    // `=== false` written anywhere downstream reads a lost agent as fine.
    ok: !!(entry && entry.state === "done" && stop !== "max_tokens" && use && use.input && typeof use.input === "object"),
    input: use && use.input && typeof use.input === "object" ? use.input : null,
    stop,
    blocks: content.map((b) => String((b && b.type) || "?")).slice(0, 8),
  };
}

/**
 * Every agent's answer, folded into ONE design object.
 *
 * KEYED BY FIELD, NEVER BY AGENT, and an agent may only write the fields it was
 * asked for. An agent that volunteers `theme` when it was asked for `pages` is
 * answering a question somebody else was asked at the same moment, and the two
 * cannot be arbitrated after the fact — so the extra is DROPPED and named
 * rather than merged. `waveTool` makes it nearly unreachable (there is nowhere
 * in that agent's schema to put the answer); this is the belt, because the
 * schema is a request and the model is not obliged by it.
 */
export function mergeWaves(agents, answers) {
  const list = Array.isArray(agents) ? agents : [];
  const got = Array.isArray(answers) ? answers : [];
  const input = {};
  const failed = [];
  const strayed = [];
  for (let i = 0; i < list.length; i++) {
    const agent = list[i];
    const read = readWaveAnswer(got.find((a) => a && a.i === i));
    if (!read.ok) { failed.push({ agent: agent.name, stop: read.stop, blocks: read.blocks }); continue; }
    for (const [k, v] of Object.entries(read.input)) {
      if (!agent.fields.includes(k)) { strayed.push({ agent: agent.name, field: k }); continue; }
      input[k] = v;
    }
  }
  return { input, failed, strayed };
}

/**
 * Did the split produce a design a build can proceed on?
 *
 * ── THIS IS WHERE THE DESIGN SPLIT DIFFERS FROM THE BAND SPLIT ────────────
 *
 * A failed BAND is stubbed and the page ships one section short, because a page
 * missing a strip is still a page. A failed AGENT is not that: a design with no
 * `pages` cannot be built at all, and one with no `theme` has no look. So there
 * is no stub here — a required field that nobody answered is a failed design,
 * reported the way `designSiteSchema` already reports one so the route's
 * existing refusal covers it.
 *
 * THE TOOL IS THE AUTHORITY ON WHAT A COMPLETE DESIGN IS, and the alternative
 * was considered and rejected: a shorter hand-written list of "the fields a
 * build really needs" is the recorded "two lists of the same thing" with the
 * design step as its subject, and it drifts the first time a field becomes
 * load-bearing.
 *
 * SO ANY LOST AGENT FAILS THE DESIGN TODAY, and that is MEASURED rather than
 * intended: every one of the four carries at least one required field
 * (`identity` brand/slug/description/kind/action, `plan`
 * purpose/pages/components/shape/images, `look` theme/wordmark/favicon,
 * `detail` behavior), so there is no such thing as an optional agent right
 * now. This code says "a design missing a required field is a failed design"
 * rather than "an agent that fails fails the build", which is the property
 * that survives a field becoming optional; `test/design-waves.test.mjs` drives
 * an agent whose fields are all optional to prove the branch exists.
 *
 * THE TRADE, STATED. This is STRICTER than the single call, which never checks
 * `required` at all and hands a partial answer straight on. It is the right
 * direction because of what the two failures cost: a refused design is FREE —
 * the build route's catch reverses the deposit in full and says why — where a
 * design that ships with no plan charges for a site that is not one. The
 * owner's "ship it as it is" rule was about a type error in a page that works,
 * not about a design with a hole in it.
 */
export function wavesUsable(tool, input, failed) {
  const req = (tool && tool.input_schema && tool.input_schema.required) || [];
  const have = input && typeof input === "object" ? input : {};
  const missing = req.filter((f) => have[f] === undefined || have[f] === null);
  return { ok: missing.length === 0, missing, lostAgents: (failed || []).map((f) => f.agent) };
}

/**
 * The same question ASKED PART-WAY THROUGH: which required fields that have
 * already been asked for came back empty.
 *
 * Why it is not `wavesUsable` again: between waves, every field of every LATER
 * wave is legitimately absent, so the whole-tool answer says "missing: pages,
 * theme, …" about a design that is going perfectly. Scoped to what has been
 * asked, an answer means the design is already dead.
 *
 * AND THAT IS WORTH ASKING BETWEEN WAVES RATHER THAN ONLY AT THE END. A design
 * that has lost `brand` cannot be rescued by wave 3, so running wave 3 buys
 * nothing and is charged for — and worse, wave 3 would be designing against a
 * note that does not name the business. Stopping is the cheap half AND the
 * honest one.
 */
export function wavesMissing(tool, input, asked) {
  const req = (tool && tool.input_schema && tool.input_schema.required) || [];
  const seen = new Set(Array.isArray(asked) ? asked : []);
  const have = input && typeof input === "object" ? input : {};
  return req.filter((f) => seen.has(f) && (have[f] === undefined || have[f] === null));
}

/**
 * The trace key ONE agent's own time is stored under, or `""` for a name that
 * cannot have one.
 *
 * `<name>Ms`, because the row it lands on is all milliseconds and a bare
 * `identity: 12000` says nothing about what the number is.
 *
 * `tr.at` TRUNCATES A KEY AT 16 CHARACTERS, and a truncated key is where the
 * collisions live: two long names that agree far enough in are cut down to ONE
 * key and the later agent silently overwrites the earlier — a wrong number
 * wearing a right one's name, which is the only way this instrument can lie
 * rather than merely go quiet. So the rule is not that short names are tidier;
 * it is that a key reaching the trace WHOLE cannot merge with anything, and one
 * that is cut might.
 *
 * The charset is refused for the reason a slug's is: a key with a space or a dot
 * in it is one nobody can read back, and repairing it invents a name the waves
 * do not use. Presence is the signal, so recording NOTHING is the honest answer
 * to a name we cannot key — and `waveMarks` is where a key that WOULD be legal
 * but is already taken is refused, because that question is about the row.
 */
export function agentMark(name) {
  if (typeof name !== "string" || !/^[a-z][a-z0-9]*$/i.test(name)) return "";
  const key = name + "Ms";
  return key.length > 16 ? "" : key;
}

/**
 * The wave design's numbers, as the trace can store them — ONE projection.
 *
 * `tr.at` keeps FINITE NUMBERS ONLY and drops everything else silently, which is
 * a deliberate wall (a connection string or a model's prose can never reach a
 * trace by accident) and a trap for exactly this: `shape.waves` is a BOOLEAN,
 * so handing the shape straight to the mark records nothing at all and reads,
 * from the stored row, precisely like a build that never split.
 *
 * AND `agents` IS READ HERE RATHER THAN COUNTED AT THE ROUTE. The route knows
 * how many agents were PLANNED; only the loop knows how many RAN, and those
 * differ the moment a required field goes missing mid-way and the design stops
 * early. The first split build's trace said four agents because the route
 * counted the plan — true that time, and a lie on any build that breaks.
 *
 * A shape it cannot read answers ZEROS rather than nothing, so the three keys
 * are on the row either way: a missing key and a key reading 0 are the same
 * from the stored trace, and inventing a number would be worse than both.
 *
 * ── AND ONE NUMBER PER AGENT BESIDE THEM (2026-09-10, owner, having drawn the
 *    barrier: "THATS WHY I TOLD YOU ABOUT SEPARATING IT , SO ITS FASTER") ─────
 *
 * `agentMs - waveMs` says what the wave saved and cannot say WHERE. A wave costs
 * its SLOWEST agent — the others reach the barrier and wait — so the only lever
 * on a wave's wall time is which agent is the wall, and the sum hides exactly
 * that. `identityMs`, `planMs`, `lookMs`, `detailMs` name it off one build.
 *
 * THESE ARE ABSENT WHEN THE AGENT DID NOT RUN, which is the opposite rule from
 * the three above and deliberately so. A design that broke in wave 2 never ran
 * `detail`, and `detailMs: 0` would read as an agent that answered instantly;
 * the three fixed numbers can afford a zero because a missing one and a zero one
 * mean the same thing there, and a per-agent key does not.
 */
export function waveMarks(shape) {
  const s = shape && typeof shape === "object" ? shape : {};
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const marks = { agents: num(s.agents), agentMs: num(s.agentMs), waveMs: num(s.waveMs) };
  const each = s.eachMs && typeof s.eachMs === "object" ? s.eachMs : {};
  for (const [name, ms] of Object.entries(each)) {
    const key = agentMark(name);
    // NEVER OVER ONE OF THE THREE ABOVE, and the test is DERIVED from the row
    // being built rather than written out as a list of their names beside them
    // — which would be "two lists of the same thing" with the row itself as the
    // other list. An agent called `agent` or `wave` makes exactly the key the
    // sum or the wall clock is stored under, and one agent's time standing
    // where the whole wave's belongs is a lie rather than a silence.
    if (!key || Object.hasOwn(marks, key)) continue;
    if (typeof ms === "number" && Number.isFinite(ms)) marks[key] = ms;
  }
  return marks;
}

/**
 * THE WHOLE DESIGN, RUN AS WAVES OF AGENTS.
 *
 * ── THE RETURN SHAPE IS `designSiteSchema`'S, EXACTLY ─────────────────────
 *
 * `{ input, shape, usage }`, so `liftBackend`, the seed top-up, the settlement
 * and every refusal below the call site cannot tell which designer ran, and
 * none of them needed changing. The same decision `generateSiteBands` made one
 * step over and for the same reason: the moment the two answers differ in
 * shape, the money path forks and one of the two forks is the one nobody
 * drives.
 *
 * ── ONE USAGE OBJECT, SUMMED ─────────────────────────────────────────────
 *
 * Sound HERE and nowhere else: every agent goes to the same model, so one rate
 * column prices all of them. The rule it must not break is that a build's
 * DESIGN usage (Opus under `auto`) and its PAGE usage (Sonnet) come from two
 * rows and must never be merged — these are all the design's. One object also
 * means ONE rounding, where N would charge `pageCredits`' floor per agent.
 *
 * ── A FAILURE WEARS ITS OWN SENTENCE ─────────────────────────────────────
 *
 * Three outcomes, deliberately told apart, because they need different moves:
 * a design that lost a required field to a CUT-OFF agent throws `truncated`
 * (the customer is told to describe fewer things); one that lost it to a
 * PROVIDER fault re-throws that fault's own status, detail and class, so
 * `upstreamKind` still separates "they are overloaded" from "we are sending
 * something they reject"; and one where the agents answered and the design is
 * still short comes back `input: null` — the same answer a single call gives
 * for a model that declared nothing, which the route already refuses.
 *
 * A THROW LOSES THE USAGE, and that is today's behaviour rather than a gap: the
 * build route's design catch reverses the deposit in full, so a failed design
 * is free and has been since long before this. A design that IS usable bills
 * for every agent, including the ones that failed beside the ones that worked.
 */
export async function designInWaves({ tool, system, brief, model, files = [], maxTokens, waves } = {}, call, now = () => Date.now()) {
  const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model };
  const known = {};
  const asked = [];
  const lost = [];
  const strayed = [];
  const faults = [];
  let ran = 0;
  // WHAT THE SPLIT ACTUALLY SAVED, AND IT IS ANSWERABLE FROM ONE BUILD
  // (2026-09-10, owner: "lets fix that", after the first split build measured
  // 203 s against a single-call spread of 131–252 s and settled nothing).
  //
  // The design step stored ONE number, so "did the agents of a wave really run
  // side by side" could only ever be asked by comparing whole builds — and the
  // spread between builds is wider than any saving a split could produce, so
  // that comparison can never answer it. These two can, on their own, with no
  // baseline at all:
  //
  //   agentMs  every agent's OWN call time, summed — what the work would have
  //            cost end to end if the waves had run one call after another
  //   waveMs   each wave's WALL time, summed — what it actually cost
  //
  // `agentMs - waveMs` IS the overlap, in milliseconds, and it needs no other
  // run to be read. Equal means nothing overlapped. It is stored as the two
  // numbers rather than the difference for the standing reason: a derived value
  // beside the values it derives from is "two lists of the same thing", and the
  // subtraction is free wherever it is read.
  let agentMs = 0;
  let waveMs = 0;
  // AND ONE NUMBER PER AGENT, keyed by the agent's own name.
  //
  // A WAVE COSTS ITS SLOWEST AGENT. The others answer and then wait at the
  // barrier for it, so the sum above says what running side by side SAVED and
  // has no way of saying which agent set the price — and that is the only thing
  // anybody can act on: cutting a fast agent in half buys nothing at all.
  // `identity`, `plan`, `look` and `detail` under their own names answer it off
  // one build, exactly as the pair above answers the overlap off one build.
  const eachMs = {};
  for (const wave of Array.isArray(waves) ? waves : []) {
    // NOT SLICED TO `MAX_WAVE_AGENTS` HERE. `splitDesign` refuses to split at
    // all when a wave is wider than the socket bound, so a second, quieter
    // truncation in this loop would be a wall nothing can kill on its own —
    // the recorded "two redundant defences cannot be killed one at a time" —
    // and of the two, the half that silently drops an agent is the worse one
    // to keep.
    const reqs = wave.map((agent) => waveRequest({ tool, system, brief, agent, known, model, files, maxTokens }));
    // ONE FAN-OUT, SHARED WITH THE BAND SPLIT rather than copied. `Promise.all`
    // rejects on the first failure, which here would throw away every agent
    // that answered because one did not; and every entry carries its index,
    // which is the only thing tying an answer back to the agent it was asked
    // of once they finish out of order. Neither is expressible as a claim about
    // text, which is why that module exists.
    // THE WAVE'S OWN WALL CLOCK, and `runFanout` is handed the SAME clock so the
    // two numbers can never be read off two different ones — which is what would
    // make `agentMs - waveMs` a subtraction between incomparable things.
    const waveAt = now();
    const out = await runFanout(reqs, (r) => call(r), now);
    waveMs += now() - waveAt;
    ran += out.length;
    for (const a of out) {
      // ONE READING OF WHAT A CALL COST, shared with every other paid step —
      // see `usageOf`, whose own comment forbids a second copy of the four
      // token kinds.
      const u = usageOf(a && a.answer, model);
      usage.in += u.in; usage.out += u.out; usage.cacheRead += u.cacheRead; usage.cacheWrite += u.cacheWrite;
      // `runFanout` HAS ALWAYS MEASURED THIS AND THIS LOOP THREW IT AWAY — the
      // per-call elapsed is on every entry, done or failed, and reading it is
      // the whole of the agent half of the instrument. A failed agent's time
      // counts: it was spent.
      if (a && Number.isFinite(a.ms)) {
        agentMs += a.ms;
        // THE SAME NUMBER FILED UNDER THE AGENT THAT SPENT IT, off ONE reading
        // of `a.ms` and one test — a second test here is a second way for the
        // sum and the parts to disagree about which entries counted.
        //
        // THE ENTRY'S INDEX IS WHAT NAMES IT. `reqs` is `wave.map(...)`, so
        // entry `i` is agent `i`; the calls finish out of order, which is the
        // point, so nothing but the index ties an answer to who was asked.
        //
        // `+=` AND NOT `=`, so the parts ALWAYS sum to `agentMs`. Two agents of
        // one name in the same design is a mistake a census catches, but this
        // function takes its waves as an argument and `=` would answer a wrong
        // number for one rather than a caught mistake for the design.
        const agent = wave[a.i];
        const name = agent && typeof agent.name === "string" ? agent.name : "";
        if (name) eachMs[name] = (eachMs[name] || 0) + a.ms;
      }
      if (a && a.state === "failed") faults.push(a);
    }
    const merged = mergeWaves(wave, out);
    // THE NEXT WAVE'S NOTE IS BUILT FROM THIS, which is the whole reason the
    // waves are ordered at all: a mark cannot draw a brand nobody told it.
    Object.assign(known, merged.input);
    lost.push(...merged.failed);
    strayed.push(...merged.strayed);
    for (const agent of wave) asked.push(...agent.fields);
    // A REQUIRED FIELD LOST HERE ENDS THE DESIGN NOW, rather than two waves
    // later after the rest has been bought — and, worse, after those waves have
    // designed against a note that does not name the business.
    if (wavesMissing(tool, known, asked).length) break;
  }
  const usable = wavesUsable(tool, known, lost);
  const shape = {
    tool: Object.keys(known).length > 0,
    stop: usable.ok ? "" : String((lost[0] && lost[0].stop) || "short"),
    // The single call's `blocks` is a list of block TYPES; a wave design's is
    // the agents that did not answer and why, which is the same question one
    // layer up and the only one a reader of this can act on.
    blocks: lost.map((f) => f.agent + ":" + (f.stop || "?")).slice(0, 8),
    // WHICH DESIGNER RAN. Without it a split design and a single-call design
    // are indistinguishable from every log line and every stored trace, which
    // is the one property a canary this invisible cannot do without.
    waves: true,
    agents: ran,
    // THE OVERLAP, AS TWO NUMBERS — see the comment where they are summed.
    agentMs,
    waveMs,
    // AND WHERE THE WALL IS, one number per agent that ran. Nested rather than
    // flattened here because `waveMarks` owns everything about what a trace key
    // may be — the 16-character truncation and the two names that would collide
    // with the pair above — and that knowledge belongs in the one place that
    // knows about `tr.at`, not in the loop that measures.
    eachMs,
    lost: usable.lostAgents,
    missing: usable.missing,
    ...(strayed.length ? { strayed: strayed.map((s) => s.agent + ":" + s.field).slice(0, 8) } : {}),
  };
  // An agent answering somebody else's field is a PROMPT fault, never a build
  // fault — `mergeWaves` drops it and the build goes on. Said out loud because
  // it is invisible from the answer.
  if (strayed.length) console.warn("design waves: an agent answered a field it was not asked for —", shape.strayed.join(" "));
  if (usable.ok) return { input: known, shape, usage };
  console.warn("design waves unusable:", "missing=" + usable.missing.join(","), "lost=" + usable.lostAgents.join(","));
  const cut = lost.find((f) => f.stop === "max_tokens");
  if (cut) {
    // The single call's own error, word for word, so the route's existing
    // sentence covers it rather than a second one drifting beside it.
    const e = new Error("schema truncated at max_tokens");
    e.truncated = true;
    throw e;
  }
  const fault = faults[0];
  if (fault) {
    // RE-THROWN IN `callBuilderModel`'S OWN SHAPE. `runFanout` flattens a
    // failure into fields so the entry can be serialised; the route above reads
    // `status`, `detail` and `name`, so flattening it to a message here would
    // deliver a real 429 wearing "the designer is busy".
    const e = new Error(String(fault.message || "design agent failed"));
    e.name = String(fault.kind || "Error");
    if (fault.status) e.status = fault.status;
    if (fault.detail) e.detail = fault.detail;
    throw e;
  }
  return { input: null, shape, usage };
}

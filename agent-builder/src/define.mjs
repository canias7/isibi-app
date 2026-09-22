/**
 * WHAT AN AGENT AND A TOOL ARE — the two declarations the framework takes.
 *
 * DEPENDENCY-FREE AND PURE. These build frozen plain objects and validate them;
 * nothing here calls a model, touches storage or reads a clock.
 *
 * THE VALIDATION THROWS RATHER THAN REPAIRS, and that is the point. The root
 * product's `laneRule` throws when a part is missing "so a lane cannot ship as a
 * description with no ceiling" — a half-declared thing that loads is a thing
 * that fails later, somewhere else, in a way that does not name this file. A
 * declaration is written once by a developer at author time, which is the one
 * moment when throwing is cheap and being told is useful.
 */

import { planLimits } from "./limits.mjs";

/**
 * A tool name goes out to the provider as part of the request, so its grammar is
 * NOT ours to choose — this is the shape the Anthropic and OpenAI tool APIs both
 * accept. Pinned as a real external constraint rather than a house style, so
 * nobody "tidies" it into something a provider rejects at run time.
 */
export const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * THE SCOPE A TOOL NEEDS, AND WHY IT IS COMPELLED.
 *
 * Every tool must say which permission a tenant needs before it may run. It may
 * answer `PUBLIC` — "this needs no permission" — but it must ANSWER: an omitted
 * scope would default to something, and both defaults are wrong. Default-public
 * makes a dangerous tool callable by anyone the day somebody forgets a line;
 * default-private makes a pure-arithmetic tool need a grant, which teaches
 * authors to grant everything. So the answer is compelled, the way a field whose
 * empty value is meaningful has to be: `PUBLIC` is a real answer, absence is not.
 */
export const PUBLIC = "public";

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// A non-empty string, REFUSED rather than coerced. `String(["hi"])` is `"hi"`, so
// a coercing reader takes an array as a description and nothing ever complains.
const isText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * Declare a tool.
 *
 *   defineTool({ name, description, input, scope, run })
 *
 * `input` is a JSON Schema object describing the arguments, passed to the
 * provider verbatim. It is NOT validated into a shape of our own: a schema
 * dialect we half-implement is a second copy of the provider's, and the two
 * drift. What IS checked is that it is an object, because a string here reaches
 * the provider as a malformed request and the error names the provider.
 *
 * `run(args, ctx)` may be async. It is never called by this module.
 */
export function defineTool(spec) {
  if (!isPlainObject(spec)) throw new TypeError("defineTool: spec must be an object");
  const where = isText(spec.name) ? `defineTool(${spec.name})` : "defineTool";

  if (!isText(spec.name)) throw new TypeError(`${where}: name must be a non-empty string`);
  if (!TOOL_NAME.test(spec.name)) {
    throw new TypeError(
      `${where}: name must match ${TOOL_NAME} — this is the provider's grammar, not ours`,
    );
  }
  // The description is what the model reads to decide whether to call this at
  // all, so an empty one is a tool the model cannot use correctly. It is
  // required for the same reason the name is.
  if (!isText(spec.description)) throw new TypeError(`${where}: description must be a non-empty string`);
  if (!isPlainObject(spec.input)) throw new TypeError(`${where}: input must be a JSON Schema object`);
  if (typeof spec.run !== "function") throw new TypeError(`${where}: run must be a function`);
  if (!isText(spec.scope)) {
    throw new TypeError(
      `${where}: scope is required — the permission a tenant needs, or PUBLIC ("${PUBLIC}") ` +
      "to say out loud that this one needs none. It is compelled because both defaults are wrong.",
    );
  }
  // `repeatable` IS OPTIONAL AND ITS DEFAULT PROTECTS. It answers one question,
  // and only a resume ever asks it: *if we cannot tell whether this tool already
  // ran, is running it again safe?* A read is; taking a payment is not.
  //
  // UNLIKE `scope` THIS IS NOT COMPELLED, and the difference is which way being
  // wrong hurts. Both of scope's defaults are actively wrong, so the author must
  // choose. Here one default is simply safe: `false` means a resume REFUSES and
  // names the tool rather than risking a second charge, which is an inconvenience
  // — where a wrong `true` is somebody billed twice. "The flag defaults to
  // protect, because of which way being wrong hurts."
  //
  // REFUSED IF IT IS NOT A BOOLEAN, never coerced: `Boolean("false")` is true,
  // and a string from a config file must not be the thing that makes a payment
  // tool repeatable.
  if (Object.hasOwn(spec, "repeatable") && typeof spec.repeatable !== "boolean") {
    throw new TypeError(`${where}: repeatable must be true or false — Boolean("false") is true, so it is not coerced`);
  }
  // ⚠ `approval` SAYS A PERSON HAS TO SAY YES BEFORE THIS RUNS, and **it is declared
  // HERE, in code, and nowhere else**. Not in an instruction, not in a retrieved
  // document, not in a memory, not in a tool result — because none of those may grant a
  // capability, and a requirement that DATA can set is one data can unset. What a
  // customer ticks on a screen can only ever take a tool AWAY; it cannot make a gated
  // one ungated.
  //
  // LIKE `repeatable` AND UNLIKE `scope`, the default is simply safe rather than wrong:
  // a tool that asks for nothing outside this conversation needs no person, and the ones
  // that do say so. Refused if it is not a boolean, for `repeatable`'s own reason —
  // `Boolean("false")` is true, and a string out of a config file must not be the thing
  // that makes a gated tool ungated.
  if (Object.hasOwn(spec, "approval") && typeof spec.approval !== "boolean") {
    throw new TypeError(`${where}: approval must be true or false — Boolean("false") is true, so it is not coerced`);
  }
  // ⚠ `writes` SAYS THIS TOOL CHANGES SOMETHING OUTSIDE THIS RUN, and it decides what a
  // FAILURE MEANS rather than whether the tool may run.
  //
  // A read that throws did not happen: re-reading is free and nothing moved. A WRITE that
  // throws may have happened — the store may have committed and the answer been lost —
  // and recording that as a failure is a claim nothing here can support, in the direction
  // that loses somebody's data. So a `writes` tool whose call throws is recorded
  // `unresolved`, and the model is told to CHECK rather than invited to do it again.
  //
  // **AND A WRITE MUST BE REPEATABLE**, which is enforced below rather than trusted: a
  // write that is not safe to repeat has no way to finish after an interruption at all —
  // the resume refuses it and names it, for ever, so the tool is a control that holds and
  // never completes. The two flags answer different questions and this is the one pair
  // where one implies the other.
  //
  // Refused if it is not a boolean, for `repeatable`'s own reason.
  if (Object.hasOwn(spec, "writes") && typeof spec.writes !== "boolean") {
    throw new TypeError(`${where}: writes must be true or false — Boolean("false") is true, so it is not coerced`);
  }
  if (spec.writes === true && spec.repeatable !== true) {
    throw new TypeError(`${where}: a tool that writes must be repeatable — a write that cannot be repeated can never finish after an interruption`);
  }
  // ⚠ `waits` SAYS THIS CALL CANNOT BE ANSWERED IN THE DELIVERY THAT MAKES IT — the tool
  // starts work that finishes somewhere else, and the model's answer arrives in a LATER
  // delivery. It is the shape delegation needs and nothing else here has: an approval is
  // held BEFORE the dispatch, and this is held AFTER it, because the work really did
  // start and its result is what is missing.
  //
  // **IT IS A DECLARATION AND NOT A SHAPE THE VALUE CAN CLAIM.** `run.mjs` holds a run
  // only where this flag AND the answer's own marker agree, so an ordinary tool that
  // happens to answer a `waiting` key cannot suspend a run by accident — and a tool that
  // declares this and answers an ordinary value is answered ordinarily.
  //
  // Refused if it is not a boolean, for `repeatable`'s own reason.
  if (Object.hasOwn(spec, "waits") && typeof spec.waits !== "boolean") {
    throw new TypeError(`${where}: waits must be true or false — Boolean("false") is true, so it is not coerced`);
  }
  // **AND A WAITING TOOL MUST BE REPEATABLE**, which is the same implication `writes` has
  // and for a sharper reason: a waiting call is resumed BY DEFINITION — that is the whole
  // of what waiting means here — so one that is not safe to repeat is refused by the
  // resume and named, for ever. The tool would be a control that holds and never
  // completes, which is the one shape this product refuses to ship.
  if (spec.waits === true && spec.repeatable !== true) {
    throw new TypeError(`${where}: a tool that waits must be repeatable — a call that cannot be repeated can never be answered by the delivery that resumes it`);
  }
  return Object.freeze({
    kind: "tool",
    name: spec.name,
    description: spec.description,
    input: spec.input,
    scope: spec.scope,
    repeatable: spec.repeatable === true,
    approval: spec.approval === true,
    writes: spec.writes === true,
    waits: spec.waits === true,
    run: spec.run,
  });
}

/**
 * Declare an agent.
 *
 *   defineAgent({ name, model, instructions, tools, limits })
 *
 * `limits` goes through `planLimits`, so a caller cannot raise a bound here
 * either — see that module's "MAY ONLY NARROW" rule.
 */
export function defineAgent(spec) {
  if (!isPlainObject(spec)) throw new TypeError("defineAgent: spec must be an object");
  const where = isText(spec.name) ? `defineAgent(${spec.name})` : "defineAgent";

  if (!isText(spec.name)) throw new TypeError(`${where}: name must be a non-empty string`);
  if (!isText(spec.model)) throw new TypeError(`${where}: model must be a non-empty string`);
  if (!isText(spec.instructions)) throw new TypeError(`${where}: instructions must be a non-empty string`);

  const tools = spec.tools === undefined ? [] : spec.tools;
  if (!Array.isArray(tools)) throw new TypeError(`${where}: tools must be an array`);
  for (const t of tools) {
    // Checked by SHAPE, not by identity: a tool that came back from JSON, or from
    // another copy of this module in a bundle, is still a tool. An `instanceof`
    // wall here would refuse a legitimate one for a reason nobody can see.
    if (!isPlainObject(t) || t.kind !== "tool" || !isText(t.name) || typeof t.run !== "function") {
      throw new TypeError(`${where}: every tool must come from defineTool`);
    }
  }
  // ⚠ `authored` SAYS THIS AGENT RUNS SOMEBODY ELSE'S WRITING, and it changes what
  // its own declarations MEAN. An ordinary agent's tool list is what its runs get;
  // an authored agent's list is the CATALOG a customer may choose from, and each run
  // gets the subset its own journal recorded. Its instructions are a placeholder for
  // the same reason.
  //
  // **IT IS DECLARED IN CODE BECAUSE THE DECISION MUST NOT BE READABLE OFF A LOG.**
  // A run started through the engine's own `/runs` door carries no snapshot at all,
  // and such a run must get NOTHING rather than everything — so "is this agent's tool
  // list a catalog?" is answered by the registry and never by the entry a caller
  // supplied.
  //
  // REFUSED IF IT IS NOT A BOOLEAN, never coerced, exactly as `repeatable` is:
  // `Boolean("false")` is true, and a string must not be the thing that turns an
  // agent's catalog into its permissions.
  if (Object.hasOwn(spec, "authored") && typeof spec.authored !== "boolean") {
    throw new TypeError(`${where}: authored must be true or false — Boolean("false") is true, so it is not coerced`);
  }
  // TWO TOOLS WITH ONE NAME IS A SILENT SHADOW — the provider sees one name
  // twice and the loop can only ever dispatch to whichever we looked up first,
  // so the other is dead code that reads as live. Refused by name.
  const seen = new Map();
  for (const t of tools) {
    if (seen.has(t.name)) throw new TypeError(`${where}: two tools are both named "${t.name}"`);
    seen.set(t.name, t);
  }

  return Object.freeze({
    kind: "agent",
    name: spec.name,
    model: spec.model,
    instructions: spec.instructions,
    // `=== true` AND THE REFUSAL ABOVE ARE A DECLARED PAIR, and a sweep cannot see
    // that on its own. MEASURED: with that refusal in place the only inputs reaching
    // this line are an absent key or a real boolean, and `!!` answers identically for
    // all three — so a mutant swapping them survives everything and is not a gap. The
    // refusal is the wall; this is the belt. What is NOT interchangeable is the
    // DIRECTION: `!== false` would make an absent key mean authored, which narrows
    // every code agent in the registry against its own tool list.
    authored: spec.authored === true,
    tools: Object.freeze([...tools]),
    // NO `byName` DISPATCH TABLE IS EXPOSED, deliberately. An earlier draft put
    // the `seen` Map on the agent as a convenience. Two things were wrong with
    // it: nothing read it (the loop builds its own table from the tools this
    // TENANT may use), and `Object.freeze` does not freeze a Map's contents — so
    // it was a mutable, UNSCOPED dispatch table hanging off a frozen object,
    // one `.set()` away from being a way round the tenancy wall. Dead and a
    // footgun at the same time.
    limits: planLimits(spec.limits ?? {}),
  });
}

/**
 * WHICH OF AN AGENT'S TOOLS THIS TENANT MAY USE — and which it may not, BY NAME.
 *
 * `grants` is a POSITIVE list, deliberately. A deny-list is the wrong wall when
 * the input is caller-supplied: it is a claim about the producer rather than
 * about the input, and the one tool somebody forgets to deny is the one that
 * matters.
 *
 * TWO ANSWERS, AND BOTH HALVES ARE LOAD-BEARING:
 *
 *   `allowed`  — offered to the model.
 *   `withheld` — NOT offered, and NAMED.
 *
 * Withholding rather than refusing-on-call is the right shape: a tool the tenant
 * cannot use costs tokens to describe, and the model will plan around it and
 * then fail in a way that reads as the model's mistake. But withholding SILENTLY
 * leaves nobody able to say why the agent could not do the thing, so the names
 * come back: a filter is a silent drop, a check is a sentence.
 *
 * FAILS CLOSED at every unclear point: no grants at all, a grants value that is
 * not a list, a tenant that is absent. Anything we cannot read as a grant is not
 * a grant.
 */
export function toolsFor(agent, grants) {
  const list = Array.isArray(grants) ? grants : [];
  // A Set of strings only. A caller-supplied array can hold anything, and
  // `["constructor"]` or a number must not match a scope.
  const granted = new Set(list.filter((g) => typeof g === "string"));
  const allowed = [];
  const withheld = [];
  for (const t of agent.tools) {
    if (t.scope === PUBLIC || granted.has(t.scope)) allowed.push(t);
    else withheld.push({ name: t.name, scope: t.scope });
  }
  return Object.freeze({ allowed: Object.freeze(allowed), withheld: Object.freeze(withheld) });
}

/**
 * The tools as the provider wants them. Kept here rather than in the run loop so
 * there is ONE place that knows the wire shape, and `run` never invents a second.
 */
export function wireTools(tools) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input }));
}

/**
 * THE SAME AGENT, RUNNING A CUSTOMER'S OWN INSTRUCTIONS.
 *
 * **TOOLS AND BOUNDS ARE COPIED ACROSS UNTOUCHED, AND THAT IS THE ENTIRE
 * SECURITY ARGUMENT OF THIS FUNCTION.** The rule is that an agent is NAMED and
 * never described, because letting a request supply an agent is letting a request
 * supply code. Instructions are the one part of an agent that is not code — they
 * are the prompt — and a product whose whole point is that a person writes them
 * has to be able to carry them. So this is the narrowest possible door: it can
 * change the text handed to the model as `system`, and it cannot change which
 * tools exist, which the tenant may use, how many steps there are, how long they
 * may take or what they may cost. Those stay whatever `defineAgent` said.
 *
 * **THE NAME IS KEPT, DELIBERATELY.** A run records its agent's name and the
 * runner looks that name up in the registry to execute it again — so a copy under
 * a different name would be a run nothing can resume. The customer's own agent is
 * identified by the `authoredAgent` id in the run's first entry, not by this name.
 *
 * REFUSED RATHER THAN COERCED, and an absent snapshot is not a reason to build
 * anything: a caller with no instructions to substitute should use the agent it
 * already has, and silently handing back the original would make "did the
 * snapshot arrive" unanswerable from outside.
 */
export function withInstructions(agent, instructions) {
  // ⚠ THE TOOL LIST AND THE BOUNDS ARE CHECKED TOO, and that is not belt-and-braces.
  // `kind: "agent"` is a property anybody can write, and an object carrying it with no
  // tool list threw from `[...agent.tools]` four lines down — "undefined is not
  // iterable", a TypeError that names neither this function nor the argument. Found by
  // a guard whose own census had been satisfied by the wrong gate. `defineAgent`
  // guarantees both, so nothing legitimate is turned away.
  if (!isPlainObject(agent) || agent.kind !== "agent"
      || !Array.isArray(agent.tools) || !isPlainObject(agent.limits)) {
    throw new TypeError("withInstructions: agent must come from defineAgent");
  }
  if (!isText(instructions)) {
    throw new TypeError("withInstructions: instructions must be a non-empty string");
  }
  return Object.freeze({
    ...agent,
    instructions,
    // Frozen again because the spread copies the references, not the freeze.
    tools: Object.freeze([...agent.tools]),
    limits: agent.limits,
  });
}

/**
 * THE SAME AGENT, HOLDING ONLY THE TOOLS ONE RUN WAS GIVEN.
 *
 * **IT MAY ONLY EVER REDUCE, and that is the whole security argument** — the same
 * rule `narrowLimits` follows one module over, for the same reason. `names` is a
 * POSITIVE list looked up IN THE AGENT'S OWN TOOLS: a name the agent does not
 * declare is not a tool, so there is nothing for it to resolve to and nothing to
 * add. A customer chooses FROM a catalog; they can never extend it, whatever they
 * write into their instructions and whatever a request body says.
 *
 * WHY IT EXISTS BESIDE `withInstructions` RATHER THAN INSIDE IT. They answer two
 * different questions and one of them has a safe default: an agent with no
 * instruction snapshot runs on the text it was declared with, which is correct.
 * An agent with no TOOL snapshot must run with NOTHING — the opposite default —
 * so folding the two together would give one function two defaults and hide the
 * dangerous one behind the harmless one.
 *
 * `unknown` COMES BACK BY NAME, because a filter is a silent drop and a check is
 * a sentence. Its caller does not refuse on it: a stored selection naming a tool
 * this deployment has retired should still run the tools that remain, rather than
 * failing a customer's agent because we removed something. But it must be
 * SAYABLE, or a retired tool is a capability that quietly stops working.
 *
 * REFUSED RATHER THAN COERCED, on both arguments. A caller with no selection to
 * apply passes `[]` and means it; `undefined` would be a caller that lost its
 * snapshot, and reading that as "no tools" would be right by luck and as "every
 * tool" would be a widening. Neither is a guess this function should make.
 */
export function narrowTools(agent, names) {
  if (!isPlainObject(agent) || agent.kind !== "agent"
      || !Array.isArray(agent.tools) || !isPlainObject(agent.limits)) {
    throw new TypeError("narrowTools: agent must come from defineAgent");
  }
  if (!Array.isArray(names)) throw new TypeError("narrowTools: names must be an array");
  // A Set of STRINGS ONLY. This list has come out of a database column and a JSON
  // log, so it can hold anything: `["constructor"]`, a number, an object. The same
  // rule `toolsFor` follows about grants, for the same reason.
  const want = new Set(names.filter((n) => typeof n === "string"));
  // ORDER IS THE AGENT'S, NOT THE SELECTION'S. The tool list goes to the provider
  // in this order, so taking it from the caller would let a stored selection decide
  // how the model sees its tools — a thing nobody meant to make configurable.
  const tools = agent.tools.filter((t) => want.has(t.name));
  const have = new Set(tools.map((t) => t.name));
  const unknown = Object.freeze([...want].filter((n) => !have.has(n)));
  // TWO ANSWERS, A PAIR RATHER THAN A FIELD ON THE AGENT — the shape `toolsFor`
  // already uses for the same division. An agent carrying its own diagnostics would
  // travel through `withInstructions`' spread into every later copy, where nothing
  // reads it and nobody can tell whether it is still true.
  return Object.freeze({
    agent: Object.freeze({
      ...agent,
      // Frozen again because the spread copies the reference, not the freeze — and
      // `filter` has already made a new array, so this is a fresh list either way.
      tools: Object.freeze(tools),
      limits: agent.limits,
    }),
    unknown,
  });
}

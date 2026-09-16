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
  return Object.freeze({
    kind: "tool",
    name: spec.name,
    description: spec.description,
    input: spec.input,
    scope: spec.scope,
    repeatable: spec.repeatable === true,
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

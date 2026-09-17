/**
 * THE TOOLS AN AGENT MAY BE GIVEN — each one a real backend operation.
 *
 * **EVERY `run` HERE ENDS IN A DATABASE FUNCTION and none of them composes an answer.**
 * That is the milestone's own wording — *returning canned success messages does not
 * complete this* — so the shape is deliberately thin: read the arguments, refuse what is
 * not usable, call one capability, and hand back what came out of Postgres.
 *
 * ── ⚠ AN ARGUMENT CAN NEVER BECOME AUTHORITY ────────────────────────────────
 *
 * The tenant and the agent are closures inside `ctx.capabilities` — see
 * `capabilities.mjs` — so there is no parameter on any operation for a tool to pass one
 * into, and no schema below declares a tenant, an account, an owner or an agent. **That
 * is asserted as a census over the real input schemas rather than promised here**, and it
 * is the whole reason the boundary is a closure instead of a convention: a model writes
 * these arguments, and the ones it cannot write are the ones that decide whose data this
 * is.
 *
 * ── AND A TOOL WITH NOWHERE TO GO SAYS SO ───────────────────────────────────
 *
 * A deployment with no capability seam — a local driver, a test — makes every tool
 * answer `{ok: false, error: "no-backend"}` rather than a plausible success. **A tool
 * that cannot do its work must not read like one that did it**: that is this
 * repository's dead-control finding in its worst form, the control that ANSWERS.
 *
 * ── WHICH ARE SAFE TO REPEAT, AND WHY EACH ──────────────────────────────────
 *
 * `repeatable` decides whether a run may finish a tool call whose result was never
 * recorded — a process that died between the call and the write. The question is never
 * "did it run" but "is running it again SAFE", which is about the state it leaves:
 *
 *   * the reads are pure, so they are repeatable by construction;
 *   * `remember` is an upsert keyed by the fact's own name and `forget` is a delete of
 *     one — running either twice leaves exactly the state running it once does, which is
 *     what the word means here even though `forget`'s ANSWER differs the second time;
 *   * `change_automation` and `pause_automation` are writes to a named row with the
 *     caller's own values, so the end state does not depend on how many times they ran;
 *   * **`make_automation` and `run_automation` are NOT repeatable, and that is honest
 *     rather than cautious.** Each mints an id per call today, so a redelivery would make
 *     a second automation or a second execution. Giving them an identity derived from
 *     their arguments is the next milestone's work, and until it is done the default that
 *     protects is the correct answer.
 */

import { defineTool, PUBLIC } from "./define.mjs";

/** How long a piece of text a tool may be handed, so a schema states its own bound. */
export const TOOL_TEXT_MAX = 4000;

/**
 * The one door to the backend, and the one refusal when there is none.
 *
 * ⚠ IT IS A FUNCTION RATHER THAN A CHECK EACH TOOL REMEMBERS TO MAKE. Fourteen copies
 * of "if there is no backend" is thirteen chances to forget one, and the one that is
 * forgotten is a tool that throws a TypeError at a customer instead of saying what is
 * wrong.
 */
const NO_BACKEND = Object.freeze({ ok: false, error: "no-backend", say: "this deployment has no store behind it, so that could not be done" });

const withBackend = (fn) => async (args, ctx) => {
  const can = ctx?.capabilities;
  if (!can || typeof can !== "object") return NO_BACKEND;
  return fn(args && typeof args === "object" ? args : {}, can, ctx);
};

/** Text, refused rather than coerced — `String(["x"])` is `"x"`. */
const text = (v) => (typeof v === "string" ? v.trim() : "");

const tool = (spec) => defineTool({ ...spec, scope: PUBLIC, run: withBackend(spec.run) });

// ── reference material ──────────────────────────────────────────────────────

const searchReference = tool({
  name: "search_reference",
  description:
    "Search this agent's own reference material for a phrase and get back the matching " +
    "passages, each with the name of the source it came from and that source's version.",
  input: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to look for. Ordinary words; it matches on word stems." },
      limit: { type: "number", description: "How many passages at most (1 to 20, 5 by default)." },
    },
    required: ["query"],
  },
  repeatable: true,
  run: async (args, can) => {
    const query = text(args.query);
    if (!query) return { ok: false, error: "no-query", say: "say what to look for" };
    const found = await can.searchKnowledge({ query, limit: args.limit });
    // NOTHING FOUND IS AN ANSWER AND NOT A FAILURE, and it is said in as many words so
    // that a model does not read an empty list as the search having gone wrong.
    return { ok: true, found: found.length, passages: found,
      say: found.length ? `${found.length} passage(s) matched` : "nothing in the reference material matched that" };
  },
});

const listReference = tool({
  name: "list_reference",
  description:
    "List the names of this agent's reference sources, with how long each one is. " +
    "It never returns the material itself — read one by name to do that.",
  input: { type: "object", properties: {} },
  repeatable: true,
  run: async (_args, can) => {
    const sources = await can.listKnowledge();
    return { ok: true, count: sources.length, sources };
  },
});

const readReference = tool({
  name: "read_reference",
  description: "Read one reference source in full, by the id the list gives.",
  input: {
    type: "object",
    properties: { id: { type: "string", description: "The source's id, from list_reference." } },
    required: ["id"],
  },
  repeatable: true,
  run: async (args, can) => {
    const row = await can.readKnowledge({ id: text(args.id) });
    return row ? { ok: true, source: row } : { ok: false, error: "no-source", say: "there is no source of this agent's with that id" };
  },
});

// ── memory ──────────────────────────────────────────────────────────────────

const listMemory = tool({
  name: "list_memory",
  description: "List the facts and preferences this agent has been asked to remember.",
  input: { type: "object", properties: {} },
  repeatable: true,
  run: async (_args, can) => {
    const memories = await can.listMemory();
    return { ok: true, count: memories.length, memories };
  },
});

const remember = tool({
  name: "remember",
  description:
    "Remember a fact or preference under a short name, or correct one already remembered. " +
    "The name is lower-case letters, digits and underscores.",
  input: {
    type: "object",
    properties: {
      name: { type: "string", description: "What to call it, e.g. `preferred_tone`." },
      value: { type: "string", description: `What to remember, up to ${TOOL_TEXT_MAX} characters.` },
    },
    required: ["name", "value"],
  },
  repeatable: true,
  run: async (args, can) => {
    // ⚠ `source: "run"` IS SET HERE AND IS NOT A FIELD THE MODEL CAN WRITE. It is the one
    // honest answer to "where did this come from" for a fact an agent saved, and leaving
    // it to an argument would let a run's own memory claim a person typed it.
    const answer = await can.saveMemory({ name: text(args.name), value: text(args.value), source: "run" });
    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused", say: sayMemory(answer?.error) };
    return { ok: true, saved: answer.saved, memory: answer.memory };
  },
});

const forget = tool({
  name: "forget",
  description: "Forget one remembered fact, by its name.",
  input: {
    type: "object",
    properties: { name: { type: "string", description: "The name it was remembered under." } },
    required: ["name"],
  },
  repeatable: true,
  run: async (args, can) => {
    const answer = await can.deleteMemory({ name: text(args.name) });
    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused" };
    // ⚠ WHETHER THERE WAS ONE IS SAID. "Forgot" and "there was nothing to forget" are two
    // different things for somebody to act on, and collapsing them is how a name got
    // wrong reads as a thing successfully removed.
    return { ok: true, forgot: answer.forgot === true,
      say: answer.forgot === true ? "forgotten" : "there was nothing remembered under that name" };
  },
});

/** The database's refusal, as a sentence. One place, so two tools cannot word it apart. */
function sayMemory(error) {
  if (error === "bad-name") return "a name is lower-case letters, digits and underscores, starting with a letter";
  if (error === "empty") return "say what to remember — to remove it, forget it instead";
  if (error === "too-long") return `that is longer than one memory can be (${TOOL_TEXT_MAX} characters)`;
  if (error === "too-many") return "this agent is already remembering as much as it can — forget something first";
  return "that could not be remembered";
}

// ── automations ─────────────────────────────────────────────────────────────

const listAutomations = tool({
  name: "list_automations",
  description:
    "List this agent's automations: what each is called, whether it is on, when it next " +
    "runs and how many steps it has.",
  input: { type: "object", properties: {} },
  repeatable: true,
  run: async (_args, can) => {
    const automations = await can.listAutomations();
    return { ok: true, count: automations.length, automations };
  },
});

const readAutomation = tool({
  name: "read_automation",
  description: "Read one automation in full, including every step, by the id the list gives.",
  input: {
    type: "object",
    properties: { id: { type: "string", description: "The automation's id, from list_automations." } },
    required: ["id"],
  },
  repeatable: true,
  run: async (args, can) => {
    const row = await can.readAutomation({ id: text(args.id) });
    return row ? { ok: true, automation: row } : { ok: false, error: "no-automation", say: "there is no automation of this agent's with that id" };
  },
});

const pauseAutomation = tool({
  name: "pause_automation",
  description: "Turn one automation on or off. Turning it off stops it running; nothing else changes.",
  input: {
    type: "object",
    properties: {
      id: { type: "string", description: "The automation's id." },
      enabled: { type: "boolean", description: "true to turn it on, false to turn it off." },
    },
    required: ["id", "enabled"],
  },
  repeatable: true,
  // ⚠ A PERSON SAYS YES FIRST. The line is what the call changes OUTSIDE this
  // conversation: this one turns scheduled work on or off, which keeps happening after
  // the conversation is over and which nobody may be watching. The reads and the agent's
  // own notes are not gated — they change nothing a person has to be told about, and
  // gating everything is how an approval becomes a thing people click through.
  approval: true,
  run: async (args, can) => {
    const answer = await can.setAutomationEnabled({ id: text(args.id), enabled: args.enabled });
    if (answer?.ok !== true) {
      return { ok: false, error: answer?.error ?? "refused",
        say: answer?.error === "bad-enabled" ? "say true to turn it on or false to turn it off" : "there is no automation of this agent's with that id" };
    }
    return { ok: true, enabled: answer.enabled, nextRunAt: answer.next_run_at ?? null };
  },
});

/**
 * ⚠ STARTING ONE IS DURABLE AND IS NOT INSTANT, and the difference from the screen's own
 * button is deliberate rather than an oversight.
 *
 * A route that starts an automation RINGS the queue afterwards, so a person pressing the
 * button waits a second. A TOOL cannot: it runs inside the consumer, and **the consumer
 * never produces** — that is this engine's own rule, and it is why the consumer's
 * configuration asks for the project and not for a queue binding. Making a tool ring
 * would put a producer inside the consumer and a queue binding into a deployment that
 * has never needed one.
 *
 * **WHAT IT COSTS IS ONE CRON TICK**, at most a minute: `accept_automation_run` commits
 * the execution and its work row in one transaction, and `sweep_run_work` offers a row
 * with no holder **with no grace at all**. So nothing is lost and nothing is at risk —
 * the work is a ROW before this tool returns — and the only thing that changes is when it
 * begins. The answer says so, because a tool that implies "now" and means "shortly" is a
 * tool whose customer thinks it failed.
 */
const runAutomation = tool({
  name: "run_automation",
  description:
    "Start one of this agent's automations. It is queued straight away and begins within " +
    "the minute, then runs in the background; ask about its progress with list_executions.",
  input: {
    type: "object",
    properties: {
      id: { type: "string", description: "The automation's id." },
      input: { type: "object", description: "Answers to whatever the automation asks for, by name." },
    },
    required: ["id"],
  },
  // A PERSON SAYS YES FIRST, for the reason above: this starts work that goes on after
  // the conversation ends.
  approval: true,
  run: async (args, can, ctx) => {
    // THE RUN ID IS MINTED HERE AND NEVER TAKEN FROM AN ARGUMENT. A model naming the id
    // of a run is a model that can point one execution's record at another.
    const runId = typeof ctx?.newId === "function" ? ctx.newId() : null;
    if (!runId) return { ok: false, error: "no-id", say: "this deployment cannot mint a run id, so nothing was started" };
    const answer = await can.startAutomation({ id: text(args.id), runId, input: args.input ?? {} });
    if (answer?.ok !== true) {
      return { ok: false, error: answer?.error ?? "refused",
        say: answer?.error === "disabled" ? "that automation is turned off" : "that automation could not be started" };
    }
    return { ok: true, execution: answer.id ?? runId, started: answer.repeat !== true,
      say: answer.repeat === true ? "that was already running" : "queued — it begins within the minute" };
  },
});

// ── what an execution did ───────────────────────────────────────────────────

const listExecutions = tool({
  name: "list_executions",
  description:
    "What one automation's recent runs did — newest first, each with its state, what any " +
    "pause is waiting for, and the result.",
  input: {
    type: "object",
    properties: {
      automation: { type: "string", description: "The automation's id." },
      limit: { type: "number", description: "How many at most (1 to 50, 10 by default)." },
    },
    required: ["automation"],
  },
  repeatable: true,
  run: async (args, can) => {
    const executions = await can.listExecutions({ automation: text(args.automation), limit: args.limit });
    return { ok: true, count: executions.length, executions };
  },
});

const readExecution = tool({
  name: "read_execution",
  description: "One run of an automation in full: every step's outcome, and how it ended.",
  input: {
    type: "object",
    properties: { id: { type: "string", description: "The execution's id, from list_executions." } },
    required: ["id"],
  },
  repeatable: true,
  run: async (args, can) => {
    const row = await can.readExecution({ id: text(args.id) });
    return row ? { ok: true, execution: row } : { ok: false, error: "no-execution", say: "there is no run of this agent's with that id" };
  },
});

/**
 * ⚠ THE CAPABILITY TOOLS, and this array is what `OFFERED` is built from.
 *
 * `make_automation` and `change_automation` are deliberately NOT here yet: creating a
 * workflow means writing STEPS, and a step list a model composes has to be validated
 * against the same reader a saved workflow goes through — which is the shared
 * `readWorkflow`, in this product, and it is not reachable from a tool argument without
 * the identity work the next milestone does. **Offering a tool that saves a workflow
 * nothing validated would be offering a control that answers and then fails at the first
 * execution**, and the capability store already holds `createAutomation` for the day it
 * is wired, so the gap is one wiring hop rather than a missing feature.
 */
export const CAPABILITY_TOOLS = Object.freeze([
  searchReference, listReference, readReference,
  listMemory, remember, forget,
  listAutomations, readAutomation, pauseAutomation, runAutomation,
  listExecutions, readExecution,
]);

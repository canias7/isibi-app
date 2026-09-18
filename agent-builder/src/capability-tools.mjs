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
 *     what the word means here even though `forget`'s ANSWER differs the second time.
 *     **And `remember`'s version does not move either**, which is the database's own rule
 *     rather than this module's care: `agent.save_memory` answers `unchanged` for the same
 *     words, so a retry is absorbed instead of counted;
 *   * `pause_automation` is a write to a named row with the caller's own values, so the
 *     end state does not depend on how many times it ran;
 *   * **`run_automation` is repeatable BECAUSE ITS IDENTITY IS DERIVED, and that is the
 *     one entry here where the reason had to be built rather than observed.** It minted a
 *     fresh id per call, so a redelivery made a SECOND execution and `false` was the
 *     honest answer — but `false` also made it unusable the moment it was gated: the run
 *     holds, a person approves, and the resume refuses a pending non-repeatable call.
 *     MEASURED, in the live demonstration. Its id now comes from `ctx.operation`, so
 *     running it again asks the database for the same execution and there is nothing left
 *     for the flag to protect.
 *
 * ── AND `writes` SAYS WHAT A FAILURE MEANS, WHICH IS A DIFFERENT QUESTION ───
 *
 * Four of the twelve change something outside the run: `remember`, `forget`,
 * `pause_automation`, `run_automation`. A read that throws did not happen; one of those
 * four that throws MAY have, because the store can commit and the answer be lost — so its
 * result is recorded `unresolved` and the model is told to CHECK rather than invited to do
 * it again. **It is a CENSUS, not a label**: `test/capabilities.test.mjs` drives every
 * tool against a recording capability seam and requires the flag to be true exactly when
 * one of `CAPABILITY_WRITES` was touched, so neither a forgotten flag nor a spurious one
 * survives. `defineTool` also refuses a write that is not `repeatable`, because a write
 * that cannot be repeated can never finish after an interruption at all.
 *
 * ⚠ THIS LIST ONCE NAMED `make_automation` AND `change_automation`, WHICH DO NOT EXIST.
 * Creating and editing an automation are `CAPABILITIES` a person's screen reaches; no
 * TOOL offers either, so the paragraph was reasoning about a surface an agent has never
 * had. The twelve tools are censused against the catalog both ways in
 * `test/capabilities.test.mjs`; this prose is not, and that is why it drifted.
 */

import { defineTool, PUBLIC } from "./define.mjs";
// ⚠ `approvals.mjs` IS THE IDENTITY MODULE as well as the approval store: `argsHash`
// and `uuidFrom` are both "the same call always reads the same way", and splitting
// them into two files would be two answers to one question.
import { uuidFrom } from "./approvals.mjs";
// ⚠ THE STEP CATALOG AND THE VALIDATOR ARE THE PLATFORM'S OWN, imported rather than
// described: a model reads what `AUTOMATION_STEPS` really holds and its workflow goes
// through the same `readWorkflow` a person's save does. Two descriptions of one catalog is
// how a tool comes to offer a step no executor can run.
import { AUTOMATION_STEPS, AUTOMATION_SCHEDULES, MAX_WORKFLOW_STEPS, readWorkflow } from "./automations.mjs";

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

/**
 * A TOOL THAT NEEDS NO BACKEND AT ALL — and the distinction is real rather than tidy.
 *
 * Ten of these tools are about what ONE ACCOUNT holds, so without a store there is nothing
 * for them to answer and `withBackend`'s refusal is the honest reply. Two are about what THE
 * PLATFORM can do: the catalog of actions, and whether a step list reads. Both are answered
 * out of this repository's own code, so refusing them for want of a store would be a control
 * failing for a reason that has nothing to do with the request — and worse, it would tell a
 * model there is no store when what it asked for never needed one.
 *
 * ⚠ **AND THE COMMENT ON `list_actions` ALREADY CLAIMED THIS BEFORE THE CODE DID.** It said
 * in as many words that the tool "does not go through `withBackend`", while `tool()` wrapped
 * it like every other — so on a deployment with no backend the catalog answered `no-backend`
 * and a model could not read the actions it needs to compose a workflow. Found by a case
 * written to census the catalog. *A claim in a comment is not a property of the code.*
 *
 * The arguments are normalised the same way, because that is about the MODEL's output and not
 * about the store.
 */
const pureTool = (spec) => defineTool({
  ...spec, scope: PUBLIC,
  run: async (args, ctx) => spec.run(args && typeof args === "object" ? args : {}, null, ctx),
});

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
  writes: true,
  repeatable: true,
  run: async (args, can, ctx) => {
    // ⚠ `source: "run"` IS SET HERE AND IS NOT A FIELD THE MODEL CAN WRITE. It is the one
    // honest answer to "where did this come from" for a fact an agent saved, and leaving
    // it to an argument would let a run's own memory claim a person typed it.
    //
    // ⚠ AND `operation` IS THIS CALL'S OWN IDENTITY, NOT AN ARGUMENT EITHER. It comes from
    // `ctx`, which the loop built from the run and the position — so the model has nowhere
    // to write it and cannot make two different calls look like one. A redelivery of THIS
    // call answers what it answered the first time and writes nothing; a DIFFERENT call in
    // the same slot is refused rather than becoming a second write. The reasoning that used
    // to stand here — "an upsert by the fact's own name leaves the same state" — is true of
    // a world where nothing else wrote in between, and a person correcting the fact is
    // exactly something else writing in between.
    const answer = await can.saveMemory({ name: text(args.name), value: text(args.value), source: "run", operation: ctx?.operation });
    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused", say: sayMemory(answer?.error) };
    // ⚠ **A REPEAT IS CARRIED THROUGH, AND THE SENTENCE IS DIFFERENT.** The answer is what
    // this call did the FIRST time — a historical fact, not a reading of the row as it
    // stands — so a model told plainly "saved" would believe the value it sent is what is
    // remembered now, when somebody may have corrected it since. Saying so is the whole
    // point of having recorded the operation rather than repeating it.
    return { ok: true, saved: answer.saved, memory: answer.memory,
      ...(answer.repeat === true ? { repeat: true, say: "that was already saved by this same request; check it if you need what is remembered now" } : {}) };
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
  writes: true,
  repeatable: true,
  run: async (args, can, ctx) => {
    const answer = await can.deleteMemory({ name: text(args.name), operation: ctx?.operation });
    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused" };
    // ⚠ WHETHER THERE WAS ONE IS SAID. "Forgot" and "there was nothing to forget" are two
    // different things for somebody to act on, and collapsing them is how a name got
    // wrong reads as a thing successfully removed.
    // ⚠ AND A REPEAT SAYS SO, because the state now may not be the state this call left:
    // a fact forgotten by this call and written again since is present, and answering a bare
    // "forgotten" would be a claim about the present made from a record of the past.
    /**
     * ⚠ **WHAT FORGETTING REACHES IS CARRIED TO THE MODEL, because `deleted` is not `erased`.**
     *
     * The row is gone, so no LATER run will see it. An execution already under way keeps the
     * snapshot it was accepted with, and the journal keeps whatever was quoted — both on
     * purpose. A model told a bare "forgotten" would tell somebody it had been removed
     * everywhere, which is false about two of the three places it exists.
     *
     * **THE FIELDS COME FROM THE FUNCTION'S OWN ANSWER** rather than being written here, and
     * an answer that does not carry them is `null` rather than an invented set: a claim about
     * reach that this code composed would be a claim nothing verified.
     */
    const reach = answer.affects && typeof answer.affects === "object" && !Array.isArray(answer.affects)
      ? answer.affects
      : null;
    const REACH = "later runs will not see it; a run already under way keeps what it started with,"
      + " and the history keeps whatever it quoted";
    if (answer.repeat === true) {
      return { ok: true, forgot: answer.forgot === true, repeat: true, affects: reach,
        say: `that was already forgotten by this same request; it may have been written again since — ${REACH}` };
    }
    return { ok: true, forgot: answer.forgot === true, affects: reach,
      say: answer.forgot === true ? `forgotten — ${REACH}`
        : "there was nothing remembered under that name" };
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
  writes: true,
  repeatable: true,
  // ⚠ A PERSON SAYS YES FIRST. The line is what the call changes OUTSIDE this
  // conversation: this one turns scheduled work on or off, which keeps happening after
  // the conversation is over and which nobody may be watching. The reads and the agent's
  // own notes are not gated — they change nothing a person has to be told about, and
  // gating everything is how an approval becomes a thing people click through.
  approval: true,
  run: async (args, can, ctx) => {
    const answer = await can.setAutomationEnabled({ id: text(args.id), enabled: args.enabled, operation: ctx?.operation });
    if (answer?.ok !== true) {
      return { ok: false, error: answer?.error ?? "refused",
        say: answer?.error === "bad-enabled" ? "say true to turn it on or false to turn it off" : "there is no automation of this agent's with that id" };
    }
    // ⚠ A REPEAT IS THIS SAME CALL, ABSORBED — and `enabled` is what it set at the time,
    // which is not necessarily what the automation is now. Somebody may have switched it
    // back, and the record deliberately does not overwrite them.
    return { ok: true, enabled: answer.enabled, nextRunAt: answer.next_run_at ?? null,
      ...(answer.repeat === true ? { repeat: true, say: "that was already done by this same request; it may have been changed since" } : {}) };
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
  // ⚠ SAFE TO REPEAT, AND THAT IS THE DERIVED IDENTITY BELOW RATHER THAN A CLAIM.
  //
  // It was `false`, and `false` was right while the id was minted per call: a redelivery
  // made a SECOND execution. But a gated tool that is not repeatable is a tool nobody can
  // use — MEASURED, in the live demonstration: the run holds, a person approves, the
  // resume finds a pending non-repeatable call and answers `cannot-resume`. **A control
  // that holds, is approved, and then refuses is a dead control that ANSWERS**, which is
  // this repository's own worst shape of that defect.
  //
  // With the id derived from the CALL, running it again asks the database for the same
  // execution and `accept_automation_run` answers `repeat` — so there is nothing left for
  // `repeatable: false` to protect.
  //
  // ⚠ **AND THAT LAST SENTENCE WAS FALSE WHEN IT WAS WRITTEN — corrected 2026-09-17.**
  // `accept_automation_run` named the partial occurrence index as its conflict target, and
  // a manual execution has no occurrence, so a duplicate run id met the PRIMARY KEY and
  // RAISED. MEASURED on a real PostgreSQL: `duplicate key value violates unique constraint
  // "automation_runs_pkey"`, with one execution, one run and one work row — so no second
  // execution was ever possible and the guarantee held, while the ANSWER was an exception.
  // A redelivered call therefore came back a FAILURE about work that really is queued.
  // The flag was right and the reason under it was not; the function absorbs either
  // identity now, and the repeat is proved in `test/integration/pg-schema.mjs`.
  writes: true,
  repeatable: true,
  run: async (args, can, ctx) => {
    // ⚠ THE RUN ID IS DERIVED FROM THIS CALL, NEVER MINTED AND NEVER TAKEN FROM AN
    // ARGUMENT. A model naming the id of a run is a model that can point one execution's
    // record at another; a FRESH id per call is a redelivery becoming a second execution.
    // `ctx.operation` is `<run>:<step>:<index>:<the arguments' own hash>` — the position
    // AND the arguments, so the same call always asks for the same execution **and a
    // different call never does**. Without the arguments in it, a slot re-filled with some
    // other request would inherit this one's identity and come back "already running"
    // about work that is not what was asked for.
    //
    // **A DEPLOYMENT THAT CANNOT IDENTIFY THE CALL IS REFUSED, not quietly minted for.**
    // Minting here would restore exactly the behaviour this removes, in the one case
    // nobody is watching.
    const runId = typeof ctx?.operation === "string" && ctx.operation
      ? await uuidFrom(ctx.operation) : null;
    if (!runId) return { ok: false, error: "no-id", say: "this deployment cannot identify the call, so nothing was started" };
    const answer = await can.startAutomation({ id: text(args.id), runId, input: args.input ?? {}, operation: ctx.operation });
    if (answer?.ok !== true) {
      return { ok: false, error: answer?.error ?? "refused",
        say: answer?.error === "disabled" ? "that automation is turned off" : "that automation could not be started" };
    }
    // ⚠ A REPEAT HERE IS THIS SAME CALL, and the sentence says so rather than implying
    // somebody else started it. The id is derived from the call, so the only way this
    // answer comes back is a redelivery of this very request — which is exactly what
    // `repeatable: true` is for, and telling the model "that was already running" would
    // invite it to go looking for who did.
    return { ok: true, execution: answer.id ?? runId, started: answer.repeat !== true,
      say: answer.repeat === true
        ? "that was already started by this same request, and is running"
        : "queued — it begins within the minute" };
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

// ── writing a workflow ──────────────────────────────────────────────────────

/**
 * ⚠ **THE SAME READER A SAVED WORKFLOW GOES THROUGH, AND THAT IS THE WHOLE DESIGN.**
 *
 * `readWorkflow` is what the screen's own save is validated by: it mints each step's id from
 * its POSITION, refuses an unknown type, a note past its cap, a day that is not a day, a
 * reference nothing produces (by name AND by position) and a branch that does not balance —
 * and it never SHORTENS, because a workflow quietly missing the step it could not read is one
 * that looks saved and does something else. A model composing steps meets exactly those
 * rules, in exactly that function, and the verdict is turned into a sentence rather than
 * thrown.
 *
 * **WHAT COMES BACK IS `readWorkflow`'S OWN `steps`, NEVER THE MODEL'S LIST.** Passing the
 * raw list on would put an unvalidated step into the database with a validation having
 * happened beside it, which is the shape of every "it was checked" defect this repository
 * records.
 */
const checkSteps = (raw) => {
  const read = readWorkflow(Array.isArray(raw) ? raw : []);
  if (read.error) return { ok: false, error: "bad-workflow", say: read.error };
  return { ok: true, steps: read.steps, produces: read.produces };
};

/** The one description of a step list, so the two authoring tools cannot disagree. */
const STEPS_FIELD = Object.freeze({
  type: "array",
  description:
    "The steps, in the order they run. Each is an object with a `type` from list_actions " +
    "and that action's own fields. Use check_workflow first if you are unsure.",
  items: { type: "object", properties: { type: { type: "string" } }, required: ["type"] },
});
/**
 * WHICH SCHEDULES A TOOL MAY ASK FOR, and it is a SUBSET of what the platform has.
 *
 * ⚠ **A SCHEDULE A TOOL CAN NAME AND CANNOT FULLY DESCRIBE IS A DEAD CONTROL THAT ANSWERS.**
 * `weekly` needs a day list and `once` needs a date; this tool has `schedule` and `atLocal`
 * and nothing else, so a model told "weekly or once" would save a schedule the database's own
 * wholeness check then refuses — a Postgres exception where a customer wanted a sentence. The
 * platform gained both the day this file did not, which is exactly how that happens.
 *
 * **IT IS CENSUSED AS A SUBSET rather than listed twice**: every name here must be a real
 * platform schedule, so a typo cannot quietly offer one that does not exist, and a name the
 * platform drops fails by existing. Widening it means giving the tool the fields first.
 */
export const AUTHORABLE_SCHEDULES = Object.freeze(["manual", "daily"]);

/**
 * ⚠ **THE WALL, BECAUSE A DESCRIPTION IS NOT ONE.** `SCHEDULE_FIELDS` tells a model which
 * schedules exist for it; nothing stops a model writing one that does not, and a tool
 * argument is a model's own output. Refused BY NAME and with the list, so the answer is
 * something the model can act on rather than a Postgres exception several layers down.
 *
 * `manual` for an absent one is the same default the site's own reader has: making an
 * automation is not asking for it to be scheduled.
 *
 * ⚠ **ABSENT AND WRONG-KIND ARE TWO ANSWERS, AND THE FIRST DRAFT COLLAPSED THEM.** `text()`
 * answers `""` for anything that is not a string, so `schedule: ["daily"]` fell through to
 * `manual` — the automation was created UNSCHEDULED, the model was told `ok: true`, and the
 * daily run it asked for would never have fired. **A filter on somebody's input is a silent
 * drop; a check is a sentence**, and here the somebody is a model that cannot see the row.
 * Found by a guard written for a different mutant.
 */
function authorableSchedule(raw) {
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    return { error: "bad-schedule", say: `when it runs has to be one of ${AUTHORABLE_SCHEDULES.join(" or ")}, written as a word` };
  }
  // ⚠ **ONLY AN ABSENT ONE IS `manual`, and `""` IS NOT ABSENT.** The site's own reader answers
  // an empty string with its list refusal, so reading it as "by hand" here would be the two
  // doors disagreeing about a blank — and a blank silently becoming a real schedule is the
  // same silent drop as a wrong kind becoming one. It gets its OWN sentence rather than the
  // list's, because the list's reads as `"; has to be set on the screen"` with nothing in
  // front of the semicolon, which names nothing a model can act on.
  const asked = raw === undefined || raw === null ? "manual" : text(raw);
  if (!asked) {
    return { error: "bad-schedule", say: `say when it runs: ${AUTHORABLE_SCHEDULES.join(" or ")}` };
  }
  if (!AUTHORABLE_SCHEDULES.includes(asked)) {
    return {
      error: "bad-schedule",
      say: `this tool can set ${AUTHORABLE_SCHEDULES.join(" or ")}; ${asked} has to be set on the screen, which asks for the rest of what it needs`,
    };
  }
  return { schedule: asked };
}

/** ...and the one description of when it runs. The ZONE is never the model's — see below. */
const SCHEDULE_FIELDS = Object.freeze({
  schedule: { type: "string", description: `When it runs: ${AUTHORABLE_SCHEDULES.join(" or ")}.` },
  atLocal: { type: "string", description: 'For a daily one, the local time as "HH:MM".' },
});

const listActions = pureTool({
  name: "list_actions",
  description:
    "The actions a workflow can be built from: each one's type, what it does, and the " +
    "fields it takes. Read this before writing a workflow — a type that is not here is refused.",
  input: { type: "object", properties: {} },
  repeatable: true,
  // ⚠ THE CATALOG IS THE SERVER'S AND THE MODEL ONLY READS IT. It comes from
  // `AUTOMATION_STEPS` — code in this repository — so a step a model invents is not a step,
  // and neither an instruction sheet nor a saved document can add one. **No backend is
  // needed for it**, which is why it is a `pureTool`: it describes what the platform can do,
  // not what one account holds.
  run: async () => ({
    ok: true,
    max: MAX_WORKFLOW_STEPS,
    actions: AUTOMATION_STEPS.map((d) => ({
      type: d.type, kind: d.stepKind, label: d.label, does: d.does,
      fields: d.configless ? [] : d.fields.map((f) => ({
        name: f.name, kind: f.kind, says: f.does ?? f.label ?? f.name,
        ...(f.required === true ? { required: true } : {}),
        ...(f.options ? { options: [...f.options] } : {}),
        ...(f.when ? { onlyWhen: f.when } : {}),
        ...(f.refs === true ? { takesReferences: true } : {}),
      })),
    })),
  }),
});

const checkWorkflow = pureTool({
  name: "check_workflow",
  description:
    "Check a workflow without saving it: whether every action is real, every field readable, " +
    "every branch balanced and every {{reference}} produced by a step that has already run. " +
    "Answers what is wrong, or what the workflow would produce.",
  input: { type: "object", properties: { steps: STEPS_FIELD }, required: ["steps"] },
  repeatable: true,
  // ⚠ IT WRITES NOTHING, so it is not `writes` and needs no operation identity — which is
  // what makes it usable as many times as a model needs to get a workflow right.
  run: async (args) => {
    const read = checkSteps(args.steps);
    if (!read.ok) return read;
    return { ok: true, steps: read.steps.length, produces: read.produces,
      say: `that reads as ${read.steps.length} step${read.steps.length === 1 ? "" : "s"}` };
  },
});

const makeAutomation = tool({
  name: "make_automation",
  description:
    "Create a new automation for this agent: a name, when it runs, and the steps. " +
    "Check the steps with check_workflow first — an unreadable one is refused whole.",
  input: {
    type: "object",
    properties: {
      name: { type: "string", description: "What to call it." },
      steps: STEPS_FIELD,
      ...SCHEDULE_FIELDS,
      enabled: { type: "boolean", description: "Whether it should start running. Absent means yes." },
    },
    required: ["name", "steps"],
  },
  writes: true,
  repeatable: true,
  /**
   * ⚠ **A PERSON SAYS YES, AND THE GATE IS ON THE TOOL RATHER THAN ON ITS ARGUMENTS.**
   *
   * The requirement is that scheduling or enabling persistent work follows the approval
   * policy — and the obvious reading, "gate it only when `enabled` is true or a schedule is
   * set", is a decision made FROM ARGUMENTS A MODEL WROTE. That is the one thing this whole
   * surface forbids: tool arguments cannot grant capabilities, and a gate a model can turn
   * off by writing `enabled: false` and then editing is not a gate.
   *
   * So both authoring tools are gated, always. The cost is a person approving a disabled
   * draft; the alternative is a model choosing whether a person is asked.
   */
  approval: true,
  run: async (args, can, ctx) => {
    const read = checkSteps(args.steps);
    if (!read.ok) return read;
    const when = authorableSchedule(args.schedule);
    if (when.error) return { ok: false, error: when.error, say: when.say };
    const answer = await can.createAutomation({
      // ⚠ THE ID IS DERIVED FROM THE CALL, never minted and never an argument — the same
      // rule `run_automation` follows, for the same reason: a fresh id per call makes a
      // redelivery a second automation, and a model naming one can point at another's row.
      id: await uuidFrom(`automation:${ctx?.operation ?? ""}`),
      name: text(args.name), steps: read.steps,
      schedule: when.schedule,
      atLocal: text(args.atLocal) || null,
      // ⚠ THE ZONE IS NOT THE MODEL'S AND IS NOT AN ARGUMENT AT ALL. It belongs to whoever
      // owns the automation; a model choosing it would make "every day at nine" mean nine
      // somewhere nobody lives. Absent, the database keeps what the row already had — which
      // for a create is its own default.
      enabled: args.enabled !== false,
      operation: ctx?.operation,
    });
    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused", say: sayAutomation(answer?.error) };
    return { ok: true, automation: answer.automation ?? answer.id ?? null, steps: read.steps.length,
      ...(answer.repeat === true ? { repeat: true, say: "that was already created by this same request" } : {}) };
  },
});

const changeAutomation = tool({
  name: "change_automation",
  description:
    "Change one of this agent's automations: its name, when it runs, or its steps. " +
    "The whole workflow is replaced, so send every step it should have.",
  input: {
    type: "object",
    properties: {
      id: { type: "string", description: "The automation's id, from list_automations." },
      name: { type: "string", description: "What to call it." },
      steps: STEPS_FIELD,
      ...SCHEDULE_FIELDS,
      enabled: { type: "boolean", description: "Whether it should run. Absent means yes." },
    },
    required: ["id", "name", "steps"],
  },
  writes: true,
  repeatable: true,
  approval: true,
  run: async (args, can, ctx) => {
    // ⚠ THE SIBLING WALL FIRST, so an automation of another agent of the same account is
    // `no-automation` rather than something this one may rewrite. The account filter is the
    // database's; this is the one no tenant filter can see.
    if (!(await can.readAutomation({ id: text(args.id) }))) {
      return { ok: false, error: "no-automation", say: "there is no automation of this agent's with that id" };
    }
    const read = checkSteps(args.steps);
    if (!read.ok) return read;
    const when = authorableSchedule(args.schedule);
    if (when.error) return { ok: false, error: when.error, say: when.say };
    const answer = await can.updateAutomation({
      id: text(args.id), name: text(args.name), steps: read.steps,
      schedule: when.schedule,
      atLocal: text(args.atLocal) || null,
      enabled: args.enabled !== false,
      operation: ctx?.operation,
    });
    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused", say: sayAutomation(answer?.error) };
    return { ok: true, automation: answer.automation ?? text(args.id), steps: read.steps.length,
      ...(answer.repeat === true ? { repeat: true, say: "that was already changed by this same request" } : {}) };
  },
});

/** What a refused save means, in words a model can act on. */
const sayAutomation = (error) => ({
  "no-agent": "this agent is not one this account has",
  "no-automation": "there is no automation of this agent's with that id",
  "too-many": "this agent already has as many automations as it can hold — change one instead",
  "bad-name": "that automation needs a name",
  "bad-schedule": "that is not a schedule this platform runs",
  "bad-time": 'a daily automation needs a local time as "HH:MM"',
  "bad-zone": "that time zone is not one this platform knows",
  "operation-mismatch": "a different request already used this slot, so nothing was changed",
}[error] ?? "that automation could not be saved");

/**
 * ⚠ THE CAPABILITY TOOLS, and this array is what `OFFERED` is built from.
 *
 * **THE AUTHORING FOUR ARRIVED 2026-09-17**, and the paragraph that used to stand here said
 * `make_automation` and `change_automation` were deliberately absent because a step list a
 * model composes has to go through the same reader a saved workflow does. That reason is
 * satisfied rather than retired: `checkSteps` IS `readWorkflow`, the same function the
 * screen's save goes through, and what reaches the database is its output and never the
 * model's list.
 */
export const CAPABILITY_TOOLS = Object.freeze([
  searchReference, listReference, readReference,
  listMemory, remember, forget,
  listActions, checkWorkflow,
  listAutomations, readAutomation, makeAutomation, changeAutomation,
  pauseAutomation, runAutomation,
  listExecutions, readExecution,
]);

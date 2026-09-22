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
import { splitOperation, uuidFrom } from "./approvals.mjs";
import { readSearch, searchOutcome } from "./knowledge-search.mjs";
// ⚠ THE DELEGATION READING IS THE MODULE'S AND NOT THIS FILE'S. `src/delegation.mjs`
// holds every rule about a task tree that is not the database's — what a context entry may
// be, how a grant narrows, what one child's row adds up to, what a roster of states means
// under a policy, and one sentence per refusal the door already reached. Two readings of any
// of those is how a screen and a model come to disagree about the same tree.
import { CONTEXT_KINDS, POLICY_NAMES, WAITING_MARK, childState, combineResults,
  narrowDelegatedTools, sayDelegation, selectContext, waitVerdict } from "./delegation.mjs";
// ⚠ THE STEP CATALOG AND THE VALIDATOR ARE THE PLATFORM'S OWN, imported rather than
// described: a model reads what `AUTOMATION_STEPS` really holds and its workflow goes
// through the same `readWorkflow` a person's save does. Two descriptions of one catalog is
// how a tool comes to offer a step no executor can run.
import { AUTOMATION_STEPS, AUTOMATION_SCHEDULES, WEEKDAYS, MAX_WORKFLOW_STEPS, VALUE_TYPES, readWorkflow,
  workflowNeeds } from "./automations.mjs";

/** How long a piece of text a tool may be handed, so a schema states its own bound. */
export const TOOL_TEXT_MAX = 4000;

/**
 * How long a delegated task may be, and it is the COLUMN's own bound rather than a number
 * chosen here. `agent.delegations.task` is `check (length(btrim(task)) between 1 and 4000)`,
 * so a schema stating anything else would be a promise the database refuses — and the
 * refusal would arrive as a raise from inside the filing transaction rather than as a
 * sentence a model can act on.
 */
export const TASK_MAX = 4000;

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
    /**
     * ⚠ **READ THROUGH THE SHARED READER, ALTHOUGH THE STORE HAS ALREADY USED IT — because
     * `can` IS INJECTED.** `makeCapabilities` applies `readSearch` on its way out, so on this
     * repository's own surface the second call is the identity; a deployment supplying its own
     * surface is what makes it worth making, and a tool that trusted the shape would throw a
     * `TypeError` at a model instead of saying it could not tell. It is not a second reading:
     * one function applied twice cannot disagree with itself.
     */
    const read = readSearch(await can.searchKnowledge({ query, limit: args.limit }));
    const passages = read.excerpts;
    /**
     * NOTHING FOUND IS AN ANSWER AND NOT A FAILURE, and it is said in as many words so that a
     * model does not read an empty list as the search having gone wrong.
     *
     * ⚠ **AND WHICH NOTHING IT IS, because one sentence covered three facts.** *"nothing in
     * the reference material matched that"* was said whether the ask held nothing searchable,
     * whether this agent has no reference material at all, or whether it has some and none of
     * it matched — and only the last of the three is what those words claim. A model told the
     * documents do not mention something asks the customer about their documents; told there
     * are none, it asks them to add one; told its own phrase had nothing searchable in it, it
     * asks again differently. Three next moves, so three sentences.
     *
     * **`searchOutcome` MAKES THE CHOICE, shared with the workflow's own `knowledge` step**, so
     * the two cannot decide it differently — and the words are each their own, because this
     * one is read by a model and that one by a person reading an execution's history.
     *
     * **THE SHAPE A MODEL WAS PROMISED IS UNCHANGED**: `found` is still the count and
     * `passages` still the list. `searched` and `sources` ride beside them because they are
     * what the sentence rests on, and a model that wants to check it can.
     */
    const say = {
      "matched": `${passages.length} passage(s) matched`,
      "not-searched": "there was nothing searchable in that — try ordinary words rather than only short ones",
      "no-sources": "this agent has no reference material yet, so there was nothing to search",
      "no-match": "nothing in the reference material matched that",
      "unknown": "no passages came back, and whether there was anything to match is not something this can say",
    }[searchOutcome(read)];
    return { ok: true, found: passages.length, passages,
      searched: read.searched, sources: read.sources, say };
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

/**
 * ⚠ **WHAT FORGETTING REACHES, FOR A DATABASE THAT DOES NOT SAY — and it is a FALLBACK, not
 * a second copy.** `agent.delete_memory` answers this sentence and `forget` forwards it; this
 * is what a deployment older than that answer gets, because a model told only "forgotten"
 * tells somebody it was removed everywhere, which is false about two of the three places a
 * memory exists. The SITE's route answers `null` there instead, deliberately: a screen showing
 * nothing extra says nothing untrue, while a model composes prose from whatever it holds.
 *
 * **IT IS EXPORTED SO THAT IT CANNOT DRIFT FROM THE FUNCTION'S OWN WORDS.** The cross-product
 * census in the site's `test/agent-send.test.mjs` reads the migration and compares them, which
 * is the same treatment the memory caps already get for the same reason.
 */
export const FORGET_REACH =
  "later runs will not see it; a run already under way keeps what it started with,"
  + " and the history keeps whatever it quoted";

/**
 * ⚠ **WHAT A SCHEDULE WITH NO MOMENT LEFT HAS TO SAY, in one place for the four tools that
 * can produce one.**
 *
 * `agent.schedule_spent` is the fact and this is the sentence. **MEASURED before either
 * existed: every writing door answered `{"ok": true, …, "next_run_at": null}` for a one-off
 * whose day had gone AND for an automation with no schedule at all** — so a model was told the
 * work landed and had no way to tell that it had made, edited or re-enabled something that
 * will never run. A screen can tell them apart because it holds the schedule beside the
 * answer; a model reads the answer and nothing else.
 *
 * **IT IS A SENTENCE AND NOT A REFUSAL.** Saving a one-off for a day already gone is a thing
 * somebody may legitimately want — a record of something that has happened — so the write
 * stands and what changes is that the answer says so.
 */
export const SPENT_SAY =
  "its one-off date has already gone, so it is saved and will never run"
  + " — give it a date still to come, or a repeating schedule, if it should";

/**
 * `spent` off an answer, and `=== true` because cannot-tell must read as nothing-to-say.
 *
 * ⚠ **A DEPLOYMENT WHOSE DATABASE PREDATES `agent.schedule_spent` CARRIES NO SUCH KEY**, and
 * `"false"` is truthy. Read either as spent and every working daily automation would be
 * reported as one that will never run, which is far worse than the silence this replaces —
 * so the absent reading is the old behaviour rather than a new false alarm.
 */
const isSpent = (answer) => answer?.spent === true;

/**
 * The two facts a write can earn beside its own answer: it was absorbed as a repeat, and the
 * schedule it leaves has no moment in it. Flags AND one sentence.
 *
 * ⚠ **BOTH ARE REACHABLE AT ONCE AND SPREADING TWO `say`s WOULD DELETE ONE.** The recorded
 * outcome a repeat is answered from carries `spent` too, so `{…repeat, …spent}` would hand a
 * model whichever object came last and silently drop the other — which is why the sentences
 * are JOINED here rather than composed at three call sites.
 *
 * The repeat's words are the caller's, because each write says something different about having
 * already happened; `SPENT_SAY` is one sentence because the fact is one fact.
 */
const alsoSay = (answer, repeatSay) => {
  const said = [answer?.repeat === true ? repeatSay : null, isSpent(answer) ? SPENT_SAY : null]
    .filter((s) => typeof s === "string" && s !== "");
  return {
    ...(answer?.repeat === true ? { repeat: true } : {}),
    ...(isSpent(answer) ? { spent: true } : {}),
    ...(said.length ? { say: said.join("; ") } : {}),
  };
};

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
     *
     * ⚠ **AND SO DO THE WORDS NOW, WHICH THIS FILE USED TO CLAIM AND NOT DO.** The sentence was
     * a constant here and the site's own route wrote its own three fields out, so one delete
     * had two accounts of what it reaches — and the fields were said to be undriftable while
     * the sentence beside them was a second copy nothing compared. `agent.delete_memory`
     * answers `note`, both doors read it, and a caller that composes another is a caller with
     * a copy of it.
     *
     * **A FUNCTION THAT ANSWERS NO SENTENCE STILL GETS ONE**, because the reach is a fact about
     * how forgetting works rather than about this row — and an older database answering nothing
     * must not leave a model saying only "forgotten".
     */
    const reach = answer.affects && typeof answer.affects === "object" && !Array.isArray(answer.affects)
      ? answer.affects
      : null;
    const REACH = text(answer.note) || FORGET_REACH;
    if (answer.repeat === true) {
      return { ok: true, forgot: answer.forgot === true, repeat: true, affects: reach,
        say: `that was already forgotten by this same request; it may have been written again since — ${REACH}` };
    }
    return { ok: true, forgot: answer.forgot === true, affects: reach,
      say: answer.forgot === true ? `forgotten — ${REACH}`
        : `there was nothing remembered under that name — ${REACH}` };
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
    // ⚠ AND A RE-ARM THAT ARMED NOTHING SAYS SO. Turning a one-off back on after its day has
    // gone answers exactly what a `manual` automation answers, and this is the only reader that
    // can tell a model the difference. See `SPENT_SAY`.
    return { ok: true, enabled: answer.enabled, nextRunAt: answer.next_run_at ?? null,
      ...alsoSay(answer, "that was already done by this same request; it may have been changed since") };
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
        // ⚠ **THE THREE REFUSALS A MODEL CAN ACT ON ARE NAMED, AND THEY NAME THE ANSWER.**
        // Everything but `disabled` came back as one sentence — *"that automation could not
        // be started"* — so a call that left out a required answer, sent a list where text
        // was wanted, or named something the automation does not ask for was told only that
        // it failed. **A failure that cannot name itself** is this repository's own recorded
        // trap, and here it is in the one place a second attempt would have worked: these
        // are the model's own arguments, and it cannot fix a field nobody named.
        say: sayStart(answer?.error, answer?.name, answer?.wanted) };
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

const cancelExecution = tool({
  name: "cancel_execution",
  description:
    "Stop one run of one of this agent's automations. Anything it has already done stays " +
    "done — this stops what is left, releases any wait, and withdraws anything waiting for " +
    "a person. It cannot undo work.",
  input: {
    type: "object",
    properties: {
      id: { type: "string", description: "The execution's id, from list_executions." },
      reason: { type: "string", description: "Why, in a few words. It is recorded on the run." },
    },
    required: ["id"],
  },
  writes: true,
  repeatable: true,
  /**
   * ⚠ **A PERSON SAYS YES, for the same reason the authoring tools are gated: the decision is
   * about persistent work, and a gate a model can route around is not a gate.** Stopping is
   * strictly less than starting — this can never begin anything — but it ends work somebody
   * is waiting on, and an approval is what makes that theirs.
   *
   * ⚠ **AND IT IS NOT ONE OF THE USER-ONLY ACTIONS, which is worth saying because it sits
   * beside them.** Approving a request, granting a permission and connecting an account are
   * powers an agent must never hold, and none of them has a tool: there is no `approve_*`, no
   * `allow_tool`, no `connect_*` on this surface, asserted as a census. Stopping one of the
   * agent's OWN executions is not in that family — it takes nothing away from a person and
   * grants the agent nothing it did not already have.
   */
  approval: true,
  run: async (args, can, ctx) => {
    const answer = await can.cancelExecution({
      execution: text(args.id), reason: text(args.reason) || null, operation: ctx?.operation,
    });
    if (answer?.ok !== true) {
      return { ok: false, error: answer?.error ?? "refused",
        say: answer?.error === "no-execution"
          ? "there is no run of this agent's with that id"
          : "that run could not be stopped" };
    }
    /**
     * ⚠ **WHAT HAD ALREADY HAPPENED IS SAID, AND IT IS NEVER CALLED UNDONE.** The counts are
     * the database's — *don't claim completed effects were undone* — and a run that had
     * already stopped answers what it really ended as rather than being stopped again.
     */
    return { ok: true, execution: text(args.id),
      stopped: answer.repeat !== true,
      ...(answer.repeat === true ? { repeat: true, alreadyStopped: true } : {}),
      completedSteps: answer.completedSteps ?? 0,
      completedCalls: answer.completedCalls ?? 0,
      ...(answer.withdrewApprovals ? { withdrewApprovals: answer.withdrewApprovals } : {}),
      say: answer.repeat === true
        ? "that run had already stopped, so nothing changed — what it did is still done"
        : "stopped — what had already run has already run and was not undone" };
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
/**
 * ⚠ **WHAT AN AUTOMATION ASKS FOR WHEN IT STARTS, AND IT HAD TO REACH `readWorkflow`.**
 *
 * **THE DEFECT, REPRODUCED before this existed**: `readWorkflow(raw, { inputs })` has taken a
 * list of declarations since inputs were built, and `checkSteps` passed none — so a step
 * saying `hello {{customer}}` was refused *"nothing here produces a value called customer"*
 * by `check_workflow` and by both authoring tools, while the same steps with the same
 * declarations were accepted by the reader itself. Measured side by side. And no tool schema
 * had an `inputs` property at all, so there was no way to send them: the declarations, the
 * validation and the column were each correct and the hop between them was missing. *A value
 * a caller cannot supply is a feature nobody can reach*, which is this repository's wiring
 * defect in the layer whose whole job is to carry it.
 *
 * ⚠ **AND IT IS A REFUSAL, NEVER A COERCION.** `readWorkflow` normalises an unknown type to
 * `text` internally, which is right for a stored row it must not reject; here the input came
 * from a MODEL, and a `list` misspelt `lsit` silently stored as text is a loop that will be
 * refused days later for a reason nobody can see. Every rule below is the shape the database
 * column and the person's own form already enforce — the same names, the same caps.
 */
const INPUT_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
/** The column's own ceiling: `automations_inputs_shaped` caps the array at eight. */
export const MAX_TOOL_INPUTS = 8;
export const INPUT_LABEL_MAX = 120;
export const INPUT_DEFAULT_MAX = 2000;

export function readInputs(raw) {
  if (raw === undefined || raw === null) return { ok: true, inputs: null };
  if (!Array.isArray(raw)) return { ok: false, error: "bad-inputs", say: "the things it asks for have to arrive as a list" };
  if (raw.length > MAX_TOOL_INPUTS) {
    return { ok: false, error: "bad-inputs",
      say: `that is more things to ask for than one automation can have (${MAX_TOOL_INPUTS})` };
  }
  const inputs = [];
  const seen = new Set();
  for (let i = 0; i < raw.length; i++) {
    const at = i + 1;
    const d = raw[i];
    const no = (say) => ({ ok: false, error: "bad-inputs", say: `input ${at}: ${say}` });
    if (d === null || typeof d !== "object" || Array.isArray(d)) return no("that did not arrive as a declaration");
    const name = typeof d.name === "string" ? d.name.trim().toLowerCase() : "";
    if (!name) return no("give it a name, so a step can use it");
    if (!INPUT_NAME_RE.test(name)) {
      return no(`"${String(d.name)}" cannot be a name — lower-case letters, digits and underscores, starting with a letter`);
    }
    // TWO INPUTS OF ONE NAME IS A REFERENCE NOBODY CAN RESOLVE — which of them?
    if (seen.has(name)) return no(`there is already something called "${name}"`);
    seen.add(name);
    const label = typeof d.label === "string" ? d.label.trim() : "";
    if (label.length > INPUT_LABEL_MAX) return no(`that label is longer than a label can be (${INPUT_LABEL_MAX})`);
    const dflt = typeof d.default === "string" ? d.default : "";
    if (dflt.length > INPUT_DEFAULT_MAX) return no(`that default is longer than it can be (${INPUT_DEFAULT_MAX})`);
    // REFUSED, NEVER COERCED: `Boolean("false")` is `true`, and a required flag out of a
    // string would make every input required.
    if (d.required !== undefined && typeof d.required !== "boolean") {
      return no("whether it has to be answered did not arrive as a yes or no");
    }
    if (d.type !== undefined && !VALUE_TYPES.includes(d.type)) {
      return no(`"${String(d.type)}" is not a kind of thing — it has to be one of: ${VALUE_TYPES.join(", ")}`);
    }
    // A DEFAULT IS TEXT EVEN FOR A LIST, because it is what a box holds; a list's default is
    // the empty list, which is what an unanswered one already means.
    inputs.push({ name, label: label || name, required: d.required === true,
                  default: dflt, type: d.type === undefined ? "text" : d.type });
  }
  return { ok: true, inputs };
}

/**
 * ⚠ THE STEPS ARE CHECKED AGAINST THE DECLARATIONS, and the order matters: a `{{reference}}`
 * is refused unless something produces it, and a declared input is half of what can. Reading
 * them the other way round would make every reference to an input fail on the one save that
 * introduces it — which is the site's own note, one product over, for the same reason.
 */
const checkSteps = (raw, inputs = []) => {
  const read = readWorkflow(Array.isArray(raw) ? raw : [], { inputs: Array.isArray(inputs) ? inputs : [] });
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
export const AUTHORABLE_SCHEDULES = Object.freeze([...AUTOMATION_SCHEDULES]);

/**
 * ⚠ **WHAT EACH SCHEDULE NEEDS BEFORE IT IS A SCHEDULE — the table's own wholeness rules, in
 * the one place a tool can refuse them with a sentence.**
 *
 * `automations_schedule_is_whole` refuses a `weekly` with no days and a `once` with no date;
 * a constraint RAISES, and what reaches a model then is a PL/pgSQL exception. So the rules
 * are asked here, named per field — and `test/integration/pg-schema.mjs` drives both, so a
 * tool that admitted what the column refuses is a red run rather than an exception in
 * somebody's face.
 *
 * **AND IT IS A TABLE RATHER THAN A CHAIN OF `if`s** because it is also what the census in
 * `test/capabilities.test.mjs` reads: every schedule this tool may NAME must have every
 * field it needs among the tool's own properties. That is the property the old narrowing was
 * a stand-in for, and it holds as the set widens.
 */
export const SCHEDULE_NEEDS = Object.freeze({
  manual: Object.freeze([]),
  daily: Object.freeze(["atLocal"]),
  weekly: Object.freeze(["atLocal", "days"]),
  once: Object.freeze(["atLocal", "onDate"]),
});

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
    return { error: "bad-schedule", say: `when it runs has to be one of ${AUTHORABLE_SCHEDULES.join(", ")}, written as a word` };
  }
  // ⚠ **ONLY AN ABSENT ONE IS `manual`, and `""` IS NOT ABSENT.** The site's own reader answers
  // an empty string with its list refusal, so reading it as "by hand" here would be the two
  // doors disagreeing about a blank — and a blank silently becoming a real schedule is the
  // same silent drop as a wrong kind becoming one. It gets its OWN sentence rather than the
  // list's, because the list's reads as `"; has to be set on the screen"` with nothing in
  // front of the semicolon, which names nothing a model can act on.
  const asked = raw === undefined || raw === null ? "manual" : text(raw);
  if (!asked) {
    return { error: "bad-schedule", say: `say when it runs: ${AUTHORABLE_SCHEDULES.join(", ")}` };
  }
  if (!AUTHORABLE_SCHEDULES.includes(asked)) {
    return {
      error: "bad-schedule",
      say: `this tool can set ${AUTHORABLE_SCHEDULES.join(", ")}; ${asked} is not a schedule this platform runs`,
    };
  }
  return { schedule: asked };
}

/**
 * ⚠ **THE EVENT NAME'S SHAPE, AND THE BOUND IS THE SITE'S OWN (64), not a rounder number.**
 *
 * It is WIDER than an input's on purpose: an event comes from somebody else's system, so dots
 * and dashes are the ordinary way one is named (`order.paid`, `invoice-sent`). **The first
 * draft of this admitted 80 characters** — a name this door accepts and the other refuses is
 * an endpoint nothing can ever match, and `test/agent-send.test.mjs` censuses the two so a
 * drift is a red run rather than a customer whose trigger never fires.
 *
 * DECLARED ABOVE ITS READER, because *declare what a closure reads above its first POSSIBLE
 * call, not above its obvious one* — this module has paid for that rule twice.
 */
export const AGENT_EVENT_SHAPE = /^[a-z][a-z0-9._-]{0,63}$/;

/**
 * ⚠ **A LOCAL TIME AS THIS TOOL SENDS ONE — and it has to ACCEPT the shape the row answers.**
 *
 * `"HH:MM"`, whole minutes, because `09:00:30` is a schedule no screen shows and the column
 * refuses it. **But a stored `time` comes back as `"09:00:00"`**, so a reader that only took
 * `HH:MM` could not read a schedule's own time back — and that is not theoretical: moving a
 * weekly automation's DAYS without repeating its time was refused `bad-time` about a time the
 * row really holds. **Found by driving the real tool against a real PostgreSQL**, where the
 * module guard had passed because its fixture wrote `"23:00"` — the shape the TOOL sends —
 * and the database answers `"23:00:00"`. *A fixture less capable than the thing it stands in
 * for hides a defect exactly as well as one that is more*, and here the less capable one was
 * the one written by hand.
 *
 * `readAt` answers the canonical `HH:MM` for either, and `""` for anything else, so one shape
 * reaches the store whichever door the value came through.
 */
const AT_SHAPE = /^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$/;
const readAt = (v) => {
  const t = typeof v === "string" ? v.trim() : "";
  return AT_SHAPE.test(t) ? t.slice(0, 5) : "";
};
/** A calendar date, and the cast is what decides whether it is one. `2026-13-45` matches this. */
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ⚠ **THE DAYS OF A WEEKLY SCHEDULE — the platform's own names, refused rather than repaired.**
 *
 * `WEEKDAYS` is the engine's list and the column's check is built from it, so a tool that
 * accepted `Monday` would store a day the constraint refuses. The names come back in the
 * WEEK'S order and duplicates collapse, so two saves of one selection are byte-identical —
 * the rule the site's own reader follows, for the same reason.
 */
function readDays(raw) {
  if (!Array.isArray(raw)) return { error: "bad-days", say: "the days have to arrive as a list of day names" };
  const seen = new Set();
  for (const d of raw) {
    if (typeof d !== "string") return { error: "bad-days", say: "each day has to be a name like mon" };
    const name = d.trim().toLowerCase();
    if (!WEEKDAYS.includes(name)) {
      return { error: "bad-days", say: `"${d}" is not a day — use ${WEEKDAYS.join(", ")}` };
    }
    seen.add(name);
  }
  if (!seen.size) return { error: "bad-days", say: "a weekly schedule needs at least one day" };
  return { days: WEEKDAYS.filter((d) => seen.has(d)) };
}

/**
 * ⚠ **THE WHOLE TRIGGER, AND IT IS ONE READER FOR BOTH AUTHORING TOOLS.**
 *
 * **THE GAP THIS CLOSES**: `AUTHORABLE_SCHEDULES` was `["manual", "daily"]` and the tool had
 * `schedule` and `atLocal` and nothing else — so `weekly` and `once` existed in the engine, in
 * the column and on the person's own form, and an agent could not ask for either. The comment
 * that stood where this does said a schedule a tool can NAME and cannot DESCRIBE is a dead
 * control that answers, which was right; the answer is the fields, not the narrowing.
 *
 * **AN EVENT IS NOT A SCHEDULE, and this is the site's own correction carried across.** "Every
 * morning AND whenever a payment lands" is a thing somebody wants, so `onEvent` is answered
 * for every schedule rather than being a fifth one — and a manual automation that also listens
 * is the ordinary shape of "I can run this myself, and it runs itself when something happens".
 *
 * Every field is refused rather than coerced, and each refusal names the field.
 */
function readTrigger(args, { at: storedAt = null, days: storedDays = null,
                             onDate: storedDate = null, onEvent: storedEvent = null } = {}) {
  const when = authorableSchedule(args.schedule);
  if (when.error) return when;
  const schedule = when.schedule;
  const needs = SCHEDULE_NEEDS[schedule] ?? [];
  const out = { schedule, atLocal: null, days: [], onDate: null };

  if (needs.includes("atLocal")) {
    const at = readAt(Object.hasOwn(args, "atLocal") ? args.atLocal : storedAt);
    if (!at) {
      return { error: "bad-time", say: `a ${schedule} schedule needs a time of day as "HH:MM"` };
    }
    out.atLocal = at;
  }
  if (needs.includes("days")) {
    const read = readDays(Object.hasOwn(args, "days") ? args.days : (storedDays ?? []));
    if (read.error) return read;
    out.days = read.days;
  }
  if (needs.includes("onDate")) {
    const on = Object.hasOwn(args, "onDate") ? text(args.onDate) : (storedDate === null ? "" : text(storedDate));
    // SHAPED, THEN A REAL DATE. `2026-13-45` matches the shape and is not a date, and the
    // cast's own refusal several layers down is not a sentence.
    //
    // ⚠ **THE SHAPE TEST IS A DELIBERATE REDUNDANCY AND MUST NOT BE TIDIED AWAY.**
    // MEASURED over twelve real spellings: not one is refused by `DATE_SHAPE` alone, so
    // cutting it moves no answer and a sweep reads it as an untested line. It is kept because
    // the two refuse different things — the shape says the ask is not a date at all, the
    // round-trip says it is not a real day (`2027-02-29` passes both the shape and the parse)
    // — and because `Date.parse` has a LENIENT FALLBACK: `Date.parse("4 JulyT00:00:00Z")` is
    // not NaN. The sweep mutates the PAIR for exactly this reason.
    if (!DATE_SHAPE.test(on) || Number.isNaN(Date.parse(`${on}T00:00:00Z`))
        || new Date(`${on}T00:00:00Z`).toISOString().slice(0, 10) !== on) {
      return { error: "bad-date", say: "a one-off schedule needs the date to run, as YYYY-MM-DD" };
    }
    out.onDate = on;
  }

  // ⚠ THE EVENT, FOR EVERY SCHEDULE. Absent leaves whatever is stored; `null` or `""` clears
  // it, which is how somebody stops an automation listening without deleting it.
  if (Object.hasOwn(args, "onEvent")) {
    if (args.onEvent === null || args.onEvent === "") out.onEvent = null;
    else if (typeof args.onEvent !== "string") {
      return { error: "bad-event", say: "the event to listen for has to be a name, as text" };
    } else {
      const name = args.onEvent.trim().toLowerCase();
      if (!AGENT_EVENT_SHAPE.test(name)) {
        return { error: "bad-event",
          say: "an event's name is lower-case letters, digits, dots, dashes and underscores, starting with a letter" };
      }
      out.onEvent = name;
    }
  } else if (storedEvent !== null) {
    out.onEvent = storedEvent;
  } else {
    out.onEvent = null;
  }
  return out;
}


/**
 * ...and the one description of when it runs. The ZONE is never the model's — see below.
 *
 * ⚠ **EVERY FIELD EVERY AUTHORABLE SCHEDULE NEEDS IS HERE, and that is asserted rather than
 * described**: `test/capabilities.test.mjs` reads `SCHEDULE_NEEDS` against these properties,
 * so a schedule the tool may name and cannot describe is a red run. That is the property the
 * old two-name narrowing stood in for.
 */
const SCHEDULE_FIELDS = Object.freeze({
  schedule: { type: "string", description: `When it runs: ${AUTHORABLE_SCHEDULES.join(", ")}.` },
  atLocal: { type: "string", description: 'The local time as "HH:MM", for anything but a manual one.' },
  days: { type: "array", items: { type: "string" },
    description: `For a weekly one, which days: ${WEEKDAYS.join(", ")}.` },
  onDate: { type: "string", description: "For a one-off, the date to run, as YYYY-MM-DD." },
  onEvent: { type: "string",
    description: "Optional, and separate from the schedule: an event name that also starts it, " +
      "like order.paid. Send null to stop it listening." },
});

/**
 * ⚠ THE ONE DESCRIPTION OF WHAT AN AUTOMATION ASKS FOR, so no two tools can disagree about
 * it — the same reason `STEPS_FIELD` and `SCHEDULE_FIELDS` are shared.
 */
const INPUTS_FIELD = Object.freeze({
  type: "array",
  description:
    "What it should ask for when it is started, so a step can use {{the_name}}. Each is " +
    `{name, label, type (${VALUE_TYPES.join("|")}), required, default}; name is lower-case ` +
    `letters, digits and underscores. Up to ${MAX_TOOL_INPUTS}.`,
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "What a step refers to it by." },
      label: { type: "string", description: "What to call it on a form. Absent means the name." },
      type: { type: "string", description: `One of: ${VALUE_TYPES.join(", ")}. Absent means text.` },
      required: { type: "boolean", description: "Whether it has to be answered." },
      default: { type: "string", description: "What to use when it is not answered." },
    },
    required: ["name"],
  },
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

/**
 * ⚠ **WHAT A WORKFLOW NEEDS FROM THE ACCOUNT, asked through whatever seams this run has and
 * NEVER refused for want of them.** The structure is answered out of this repository's own
 * code, so a deployment with no store must still be able to check a step list — which is why
 * this is a `pureTool` and why the absence of a seam is `unchecked` rather than `no-backend`.
 * *A check that cannot be made is not a check that passed*, and the two have to be told apart
 * on the answer or a model reads "nothing is missing" about a question nobody asked.
 *
 * Every read is in its own `try`: three dependencies with one `catch` between them would make
 * one outage silence the other two.
 */
async function askAround(steps, schedule, ctx) {
  const conn = ctx?.connections;
  const can = ctx?.capabilities;
  let connections = null;
  let sendScopes = null;
  let automations = null;
  let zone = null;
  const wantsConnection = steps.some((st) => st?.type === "send");
  const wantsSub = steps.some((st) => st?.type === "workflow");
  if (wantsConnection && conn && typeof conn.list === "function") {
    try {
      const rows = await conn.list();
      connections = Array.isArray(rows) ? rows : [];
    } catch { connections = null; }
    // THE SCOPE MAP NEEDS NO ROW, so it is asked separately: an outage reading the
    // connections must not also lose which permission a send needs.
    if (typeof conn.sendScopes === "function") {
      try { sendScopes = conn.sendScopes(); } catch { sendScopes = null; }
    }
  }
  if (wantsSub && can && typeof can.listAutomations === "function") {
    try {
      const rows = await can.listAutomations();
      automations = Array.isArray(rows) ? rows : (Array.isArray(rows?.automations) ? rows.automations : null);
    } catch { automations = null; }
  }
  /**
   * ⚠ **THE ZONE IS ASKED ONLY FOR A SCHEDULE THAT NEEDS ONE, and `null` means not asked.**
   * A manual automation has no local time to be in, so reading the settings for one would be
   * a round trip that can only answer a question nobody put — and reporting "no zone" against
   * it would be a dependency that is not one.
   */
  if (NEEDS_A_ZONE.includes(schedule)) {
    if (can && typeof can.readAgentSettings === "function") {
      try {
        const settings = await can.readAgentSettings();
        const z = settings && typeof settings.zone === "string" ? settings.zone.trim() : "";
        zone = { needed: true, have: !!z, schedule };
      } catch { zone = null; }
    }
  }
  const out = workflowNeeds(steps, { connections, automations, zone, sendScopes });
  // ⚠ WHAT WAS NOT ASKED AT ALL IS ALSO UNCHECKED, and `workflowNeeds` cannot know it: it is
  // handed `null` for a list nobody read and for a seam that is not there, and those are the
  // same absence to it. The difference is only visible here, so the sentence is composed here.
  if (NEEDS_A_ZONE.includes(schedule) && zone === null) {
    out.unchecked.push({ kind: "zone", what: schedule,
      why: "this agent's own settings could not be read, so whether it has a time zone is unknown" });
  }
  return out;
}

const checkWorkflow = pureTool({
  name: "check_workflow",
  description:
    "Check a workflow without saving it: whether every action is real, every field readable, " +
    "every branch balanced, every {{reference}} produced by a step that has already run, and " +
    "whether the schedule is a whole one. It also reports what the workflow NEEDS that is not " +
    "in it — an account to send from, a permission, another automation, a time zone — and what " +
    "it could not check. Those can be put right without changing a step. A check is not " +
    "permission: a save still asks a person, and a run still checks everything again.",
  input: {
    type: "object",
    properties: { steps: STEPS_FIELD, inputs: INPUTS_FIELD, ...SCHEDULE_FIELDS },
    required: ["steps"],
  },
  repeatable: true,
  // ⚠ IT WRITES NOTHING, so it is not `writes` and needs no operation identity — which is
  // what makes it usable as many times as a model needs to get a workflow right.
  //
  // ⚠ **AND IT HAS TO TAKE THE DECLARATIONS OR IT IS CHECKING A DIFFERENT WORKFLOW.** Without
  // them a step using `{{customer}}` is refused here and accepted by the save, or the other
  // way round — and a check that disagrees with the thing it is checking is worse than none,
  // because a model believes it.
  //
  // ⚠ **AND THE SCHEDULE IS PART OF THE WORKFLOW FOR THIS PURPOSE.** `automations_schedule_is_whole`
  // refuses a weekly one with no days and a manual one carrying a time, so a check that read
  // only the steps would pass a configuration the save then refuses — which is the one thing a
  // pre-flight check must not do. It goes through `readTrigger`, the SAME reader both authoring
  // tools use, so there is one answer about what a whole schedule is rather than two.
  run: async (args, _can, ctx) => {
    const asked = readInputs(args.inputs);
    if (!asked.ok) return asked;
    const read = checkSteps(args.steps, asked.inputs ?? []);
    if (!read.ok) return read;
    const when = readTrigger(args);
    if (when.error) return { ok: false, error: when.error, say: when.say };
    const around = await askAround(read.steps, when.schedule, ctx);
    const n = read.steps.length;
    const parts = [`that reads as ${n} step${n === 1 ? "" : "s"}`];
    if (around.needs.length) {
      // THE VERB AGREES TOO, not only the noun — "1 thing have to be in place" is a sentence a
      // model quotes back to somebody.
      parts.push(`${around.needs.length} thing${around.needs.length === 1 ? " has" : "s have"} `
        + "to be in place before it can run");
    }
    if (around.unchecked.length) {
      parts.push(`${around.unchecked.length} thing${around.unchecked.length === 1 ? "" : "s"} `
        + "I could not check from here");
    }
    return {
      ok: true, steps: n, produces: read.produces,
      inputs: (asked.inputs ?? []).map((i) => i.name),
      trigger: { schedule: when.schedule, atLocal: when.atLocal, days: when.days,
                 onDate: when.onDate, onEvent: when.onEvent },
      needs: around.needs, unchecked: around.unchecked,
      /**
       * ⚠ **A CHECK IS NOT AUTHORISATION, AND IT SAYS SO ON EVERY ANSWER.** Nothing is
       * recorded by this call, so there is no state for a later save or run to read as "it was
       * checked" — which is the structural half. This sentence is the half a model reads, and
       * it is here because a tool that answers "that is fine" invites one that believes the
       * next step is permitted.
       */
      say: `${parts.join(", and ")}. Checking is not permission: saving it still needs a person, `
        + "and running it checks everything again.",
    };
  },
});

/**
 * ⚠ **WHICH TIME ZONE A SCHEDULE IS WRITTEN IN — RESOLVED, NEVER GUESSED.**
 *
 * **THE DEFECT, REPRODUCED before this existed.** `make_automation` offers
 * `schedule: "daily"` and sends no zone, because a zone is the one thing a MODEL must not
 * choose: "every day at nine" somewhere nobody lives is worse than no schedule at all. So
 * the database's own arithmetic raised — *a daily schedule needs a local time and a zone* —
 * PostgREST turned that into HTTP 400 and the TOOL THREW. Measured through the real tool
 * against a real PostgreSQL: zero rows written, the model handed a PL/pgSQL context line,
 * and EVERY daily automation authored through a tool failing the same way. A dead control
 * that does not merely answer wrongly but throws.
 *
 * **THE ZONE IS A SETTING A PERSON OWNS**, read here and never written: `agent.agents.zone`,
 * set on the settings form and answered by `readAgentSettings`. There is no argument for one
 * and no operation on this surface can set one, which is what makes "a model does not choose
 * the zone" a property of the surface rather than a rule somebody has to keep.
 *
 * ⚠ **AND WHERE NOBODY HAS SET ONE IT ASKS. It does not pick UTC, and it does not read one
 * off another automation.** UTC is a guess wearing a standard's clothes — it is right for
 * almost nobody and wrong invisibly. Another automation's zone is derived state that moves
 * when unrelated rows move, so "why did mine get that zone" would have no stable answer.
 * `no-zone` is a refusal with a sentence naming what to do, and NOTHING is written.
 *
 * **A MANUAL SCHEDULE ASKS FOR NOTHING**, because it has no time to be local to — so a tool
 * making an unscheduled automation never touches the settings and never refuses for a zone.
 */
/**
 * ⚠ **WHICH SCHEDULES NEED ONE — derived from `SCHEDULE_NEEDS` rather than listed.** Every
 * timed schedule is local to somewhere, so the day `weekly` and `once` became authorable this
 * had to cover them; a hand-kept list would have let a weekly schedule through with no zone
 * and met the column's own refusal instead of a sentence.
 */
const NEEDS_A_ZONE = Object.freeze(
  Object.keys(SCHEDULE_NEEDS).filter((k) => SCHEDULE_NEEDS[k].includes("atLocal")));

/**
 * ⚠ **AN EDIT KEEPS THE ZONE THE AUTOMATION ALREADY HAS, and only a CREATE reads the
 * account's.** This is the requirement's own wording — *preserve the existing timezone during
 * unrelated edits* — and it is a real choice rather than a convenience: an automation's zone
 * is what it was written in, and re-zoning a live one because somebody later changed the
 * account setting would move the absolute time it fires at, silently, on an edit about
 * something else. `held` is absent on a create, so the account setting is the only source
 * there; it is the fallback on an edit, for an automation that has none.
 */
async function zoneFor(can, schedule, held = null) {
  if (!NEEDS_A_ZONE.includes(schedule)) return { zone: null };
  const kept = held && typeof held.zone === "string" && held.zone.trim() ? held.zone.trim() : null;
  if (kept) return { zone: kept };
  const settings = typeof can.readAgentSettings === "function" ? await can.readAgentSettings() : null;
  const zone = settings && typeof settings.zone === "string" && settings.zone.trim()
    ? settings.zone.trim() : null;
  if (!zone) {
    return { error: "no-zone",
      say: "a scheduled automation needs to know which time zone its time is in, and this " +
           "agent has none set — ask whoever owns it to set the time zone in the agent's " +
           "settings, then ask me again. Nothing has been saved." };
  }
  return { zone };
}

/**
 * ⚠ **WHAT THE RECORD ALREADY SAYS ABOUT THIS CALL — asked BEFORE any refusal computed
 * from the state of the row.**
 *
 * **THE DEFECT, REPRODUCED before this existed**, through the real tool and adapter against
 * a real PostgreSQL: `change_automation` moved a daily automation from 09:00 to 10:00, the
 * answer was lost, and the retry of the SAME operation read the stored row, found 10:00
 * already there, computed an empty patch and answered `nothing-asked`. It never reached
 * `patch_automation_once`, which was holding `{ok: true, version: 1, next_run_at: …}` for
 * exactly that identity. **The database had the answer all along and the tool refused above
 * it**, which is why the fix is here and not in any migration.
 *
 * ⚠ **A COMPLETED OPERATION'S ANSWER IS A HISTORICAL FACT, NEVER A READING OF THE ROW AS
 * IT STANDS.** That is the whole reason to answer the record rather than re-deriving: between
 * the two attempts somebody may have edited the automation, or deleted it, or changed the
 * account's time zone — and none of that alters what this operation did.
 *
 * **`changed` IS DELIBERATELY NOT REPORTED ON A REPEAT.** It is computed from the patch this
 * attempt would have sent, and on a retry that is a patch against a row somebody may have
 * moved since — so it is a fact about this attempt's arithmetic and not about the edit that
 * really happened. The record does not hold it, so it is left out rather than invented.
 *
 * ⚠ **AND `unknown` IS NOT `fresh`.** A record we could not read must send the caller down
 * the ordinary path — where the `_once` wrapper asks this same function INSIDE the
 * transaction and is the second wall — rather than becoming an answer. Reading it as a
 * repeat would invent a success with no outcome to answer from.
 */
async function recordFor(can, ctx, op) {
  if (typeof can?.checkOperation !== "function") return { state: "unknown" };
  const seen = await can.checkOperation({ op, operation: ctx?.operation });
  const state = typeof seen?.state === "string" ? seen.state : null;
  if (state === null) return { state: "unknown" };
  return { state,
    outcome: seen.outcome && typeof seen.outcome === "object" ? seen.outcome : null,
    action: typeof seen.action === "string" ? seen.action : null };
}

/**
 * ⚠ **THE SAME IDENTITY USED FOR DIFFERENT WORK IS REFUSED, and it is refused HERE as well
 * as in the wrapper.** `operation_check` compares the action AND the arguments' hash, so a
 * key recorded for something else can only be a caller that reused one — and answering the
 * other operation's outcome would be answering a question nobody asked. The wrapper makes the
 * same refusal in its own transaction; this one exists because the tools above it may never
 * reach the wrapper at all.
 */
/**
 * ⚠ **A RECORDED OUTCOME IS ANSWERED AS WHAT IT WAS, AND A RECORDED FAILURE STAYS A
 * FAILURE.** The wrapper records whatever the plain function answered — a refusal included —
 * so a record is not evidence that the work succeeded, only that it HAPPENED. The first draft
 * of this fix read every repeat as `ok: true`, which would have turned *"that edit named
 * something an automation does not have"* into *"done"* on the second delivery: a refusal
 * laundered into a success by a retry, which is worse than the defect being fixed.
 *
 * So the refusal is composed by the SAME `sayAutomation` the live path uses — one sentence
 * per error, from one place — and `recorded: true` rides beside it, because a model that
 * asked twice should be able to tell a fresh refusal from one it has already been given.
 */
function recalled(seen, fallbackId, said) {
  const was = seen.outcome && typeof seen.outcome === "object" ? seen.outcome : {};
  if (was.ok !== true) {
    return { ok: false, recorded: true,
      error: typeof was.error === "string" ? was.error : "refused",
      say: sayAutomation(typeof was.error === "string" ? was.error : null, was) };
  }
  return { ok: true, repeat: true,
    ...(typeof was.id === "string" ? { automation: was.id }
        : fallbackId ? { automation: fallbackId } : {}),
    ...(was.next_run_at !== undefined ? { nextRunAt: was.next_run_at } : {}),
    ...(was.version !== undefined ? { version: was.version } : {}),
    say: said };
}

const REUSED = (seen) => ({
  ok: false, error: "operation-mismatch",
  say: "that identity was already used for different work" +
    (seen.action ? ` (${seen.action})` : "") +
    ", so nothing was done — this needs a call of its own.",
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
      inputs: INPUTS_FIELD,
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
    const asked = readInputs(args.inputs);
    if (!asked.ok) return asked;
    const read = checkSteps(args.steps, asked.inputs ?? []);
    if (!read.ok) return read;
    const when = readTrigger(args);
    if (when.error) return { ok: false, error: when.error, say: when.say };

    /**
     * ⚠ **THE RECORD, ABOVE THE ONE REFUSAL HERE THAT DEPENDS ON SOMETHING A PERSON CAN
     * CHANGE.** Every refusal above this line is about the model's OWN arguments, which a
     * retry carries unchanged — so a retry whose arguments were fine the first time reaches
     * here. `zoneFor` is different: it READS the account's settings, so clearing the zone
     * between the two attempts would answer `no-zone` about an automation that already
     * exists, and the model would be told to go and ask somebody to set a setting for work
     * that is done. **The same class as the edit defect, one tool over**, which is why the
     * census of the other write tools matters as much as the fix itself.
     */
    const seen = await recordFor(can, ctx, "createAutomation");
    if (seen.state === "mismatch") return REUSED(seen);
    if (seen.state === "repeat") {
      return recalled(seen, null,
        "that was already created by this same request, and nothing was created again");
    }

    const zone = await zoneFor(can, when.schedule);
    if (zone.error) return { ok: false, error: zone.error, say: zone.say };
    const answer = await can.createAutomation({
      // ⚠ THE ID IS DERIVED FROM THE CALL, never minted and never an argument — the same
      // rule `run_automation` follows, for the same reason: a fresh id per call makes a
      // redelivery a second automation, and a model naming one can point at another's row.
      id: await uuidFrom(`automation:${ctx?.operation ?? ""}`),
      name: text(args.name), steps: read.steps,
      schedule: when.schedule,
      atLocal: when.atLocal,
      days: when.days,
      onDate: when.onDate,
      onEvent: when.onEvent,
      zone: zone.zone,
      inputs: asked.inputs ?? [],
      enabled: args.enabled !== false,
      operation: ctx?.operation,
    });
    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused", say: sayAutomation(answer?.error) };
    return { ok: true, automation: answer.automation ?? answer.id ?? null, steps: read.steps.length,
      ...(asked.inputs ? { inputs: asked.inputs.map((i) => i.name) } : {}),
      ...(zone.zone ? { zone: zone.zone } : {}),
      // ⚠ WHEN IT WILL REALLY RUN, from the database's own arithmetic. A model that asked for a
      // weekly schedule has no other way to check it got the one it meant.
      ...(answer.next_run_at ? { nextRunAt: answer.next_run_at } : {}),
      ...alsoSay(answer, "that was already created by this same request") };
  },
});

const changeAutomation = tool({
  name: "change_automation",
  description:
    "Change one of this agent's automations. Send ONLY the fields you are changing — " +
    "anything you leave out stays exactly as it is. To turn one off send enabled: false; " +
    "to stop it running on a schedule send schedule: \"manual\". If you send steps, send " +
    "every step it should have, because the workflow is replaced whole.",
  input: {
    type: "object",
    properties: {
      id: { type: "string", description: "The automation's id, from list_automations." },
      name: { type: "string", description: "A new name. Leave it out to keep the one it has." },
      steps: STEPS_FIELD,
      inputs: INPUTS_FIELD,
      ...SCHEDULE_FIELDS,
      enabled: { type: "boolean", description: "Whether it should run. Leave it out to keep it as it is." },
      ifVersion: { type: "number",
        description: "Optional. The version from list_automations. If the workflow has " +
          "changed since you read it, the edit is refused instead of overwriting it." },
    },
    // ⚠ **ONLY THE ID IS REQUIRED NOW, AND THAT IS THE FIX RATHER THAN A RELAXATION.** It
    // demanded `name` AND `steps` on every call, so renaming one meant re-sending its whole
    // workflow — and a model that sent a name with a plausible step list was how a live
    // automation's real steps got replaced by a guess.
    required: ["id"],
  },
  writes: true,
  repeatable: true,
  approval: true,
  /**
   * ⚠ **AN EDIT CHANGES ONLY WHAT IT NAMES, AND THIS USED TO BE A WHOLE REPLACE.**
   *
   * **REPRODUCED before it was touched**, through the real tool against a real PostgreSQL:
   * one `change_automation` asking for a new name moved a stored automation from
   *
   *     enabled=false | daily | 23:00 | Europe/London | 1 input  | v1
   *  to enabled=true  | manual| -     | -             | 0 inputs | v2
   *
   * A disabled automation was REACTIVATED, its schedule and zone erased and its input
   * declarations deleted — by a call that asked for a new name. The cause is one line per
   * field: `enabled: args.enabled !== false` reads absent as ON, `schedule ?? "manual"` reads
   * absent as UNSCHEDULED, and no `inputs` was sent at all so the store's `?? []` cleared
   * them.
   *
   * **AND IT MADE THE APPROVAL GATE MISLEADING, which is the worse half.** A person approved
   * `{id, name: "Payroll (renamed)"}` — the arguments are what the approval is bound to —
   * and what happened was a reset. What was approved was not what was done.
   *
   * ⚠ **THE PATCH CARRIES ONLY KEYS THE CALL REALLY HAS**, asked with `Object.hasOwn`. A
   * truthiness test would drop `enabled: false` and an empty `steps: []`, which are the two
   * edits somebody most needs to be able to make.
   */
  run: async (args, can, ctx) => {
    // ⚠ THE SIBLING WALL FIRST, so an automation of another agent of the same account is
    // `no-automation` rather than something this one may rewrite. The account filter is the
    // database's; this is the one no tenant filter can see.
    const held = await can.readAutomation({ id: text(args.id) });
    if (!held) {
      return { ok: false, error: "no-automation", say: "there is no automation of this agent's with that id" };
    }

    /**
     * ⚠ **THEN THE RECORD, BEFORE ANYTHING IS DECIDED FROM THE ROW.**
     *
     * Everything below reads `held`, so every refusal below is a refusal computed from the
     * state of the automation NOW — and on a retry of a completed edit that state is the one
     * this operation itself produced, or one somebody has moved since. The empty patch is the
     * reproduced case (`nothing-asked` over a recorded success) and it is not the only one:
     * a person changing the input declarations between attempts can make `checkSteps` refuse,
     * and clearing the account's zone can make `zoneFor` refuse. **Asking once, here, covers
     * all of them and makes this tool's answer independent of which field somebody else
     * happened to touch.**
     *
     * **THE OWNERSHIP CHECK STAYS FIRST, deliberately.** An automation this agent may not
     * edit is `no-automation` whatever any record says, and so is one that has since been
     * deleted — which is true, actionable, and the answer the requirement asks for.
     *
     * ⚠ **AND THE WRAPPER'S OWN REPEAT ANSWER IS NOW A SECOND WALL RATHER THAN DEAD CODE**,
     * which is declared because a sweep cannot see it: two deliveries in flight at once both
     * read `fresh` here, both compute a patch and both call `patch_automation_once`, and the
     * loser of its primary key re-reads the record inside the transaction. That race is the
     * wrapper's to settle and no check up here can.
     */
    const seen = await recordFor(can, ctx, "patchAutomation");
    if (seen.state === "mismatch") return REUSED(seen);
    if (seen.state === "repeat") {
      return recalled(seen, text(args.id),
        "that was already changed by this same request, and nothing was changed again");
    }

    const patch = {};
    if (Object.hasOwn(args, "name")) patch.name = text(args.name);
    if (Object.hasOwn(args, "enabled")) patch.enabled = args.enabled;

    /**
     * ⚠ **THE STEPS AND THE DECLARATIONS ARE VALIDATED TOGETHER, AGAINST WHATEVER THE
     * AUTOMATION WILL REALLY HAVE.** A reference is refused unless something produces it and
     * a declared input is half of what can — so checking a new step list against an EMPTY
     * declaration set would refuse `{{customer}}` on an automation that has always had a
     * `customer` input, and checking new declarations against no steps would let a rename of
     * an input orphan every reference to it. Either side the call omits comes from the stored
     * row, which is what the automation will still have when this is done.
     */
    const asked = readInputs(args.inputs);
    if (!asked.ok) return asked;
    const inputs = asked.inputs ?? (Array.isArray(held.inputs) ? held.inputs : []);
    if (Object.hasOwn(args, "steps") || asked.inputs) {
      const steps = Object.hasOwn(args, "steps") ? args.steps
        : (Array.isArray(held.steps) ? held.steps : []);
      const read = checkSteps(steps, inputs);
      if (!read.ok) return read;
      if (Object.hasOwn(args, "steps")) patch.steps = read.steps;
      if (asked.inputs) patch.inputs = asked.inputs;
    }

    /**
     * ⚠ **A SCHEDULE AND EVERY FIELD IT NEEDS MOVE TOGETHER, or the row cannot be whole.**
     *
     * `automations_schedule_is_whole` refuses `daily` with no time, `weekly` with no days,
     * `once` with no date and `manual` WITH a time — so a call saying `schedule: "weekly"`
     * has to carry or inherit the days, and one saying `manual` has to clear everything. That
     * is why the trigger is read as ONE thing rather than field by field: a field left behind
     * is a constraint raising several layers from the model that can act on it.
     *
     * **A FIELD OF THE TRIGGER NAMED WITHOUT A SCHEDULE IS A CHANGE TO THE STORED ONE'S**,
     * so the stored schedule is read and the same wholeness rules applied to it. Moving a
     * weekly automation's days without repeating the word "weekly" is the ordinary edit.
     */
    const TRIGGER_FIELDS = ["schedule", "atLocal", "days", "onDate", "onEvent"];
    if (TRIGGER_FIELDS.some((f) => Object.hasOwn(args, f))) {
      const when = readTrigger(
        Object.hasOwn(args, "schedule") ? args : { ...args, schedule: text(held.schedule) || "manual" },
        { at: held.atLocal ?? null, days: Array.isArray(held.days) ? held.days : null,
          onDate: held.onDate ?? null, onEvent: held.onEvent ?? null });
      if (when.error) return { ok: false, error: when.error, say: when.say };
      /**
       * ⚠ **ONLY WHAT REALLY MOVED GOES ON THE PATCH, and that is not tidiness: the patch's
       * own contract is that a key it carries is a field this call is about.** A trigger read
       * answers every field, so putting all five on would make "I changed the days" arrive as
       * an edit of the schedule, the time and the event too — and the approval a person gave
       * would again be for less than what happened.
       */
      const sameDays = (a, b) => a.length === b.length && a.every((d, i) => d === b[i]);
      const heldDays = Array.isArray(held.days) ? held.days : [];
      if (when.schedule !== text(held.schedule)) patch.schedule = when.schedule;
      // ⚠ COMPARED IN THE CANONICAL FORM, because the row answers `"23:00:00"` and this tool
      // sends `"23:00"` — a raw comparison would call every unchanged time a change and put it
      // on a patch that is not about it.
      if (when.atLocal !== (readAt(held.atLocal) || null)) patch.atLocal = when.atLocal;
      if (!sameDays(when.days, heldDays)) patch.days = when.days;
      if (when.onDate !== (held.onDate ?? null)) patch.onDate = when.onDate;
      if (when.onEvent !== (held.onEvent ?? null)) patch.onEvent = when.onEvent;
      const zone = await zoneFor(can, when.schedule, held);
      if (zone.error) return { ok: false, error: zone.error, say: zone.say };
      // THE ZONE IS LEFT ALONE WHERE THE SCHEDULE DOES NOT NEED ONE. It is the automation's
      // own — a `weekday` condition reads it on an unscheduled automation too — so clearing
      // it on a move to `manual` would take away something nothing asked about.
      if (zone.zone && zone.zone !== (held.zone ?? null)) patch.zone = zone.zone;
    }

    if (Object.keys(patch).length === 0) {
      // ⚠ A CALL THAT NAMES NOTHING IS A REFUSAL AND NOT A NO-OP THAT ANSWERS `ok`. It cost a
      // person an approval, so answering "done" about nothing is the dead control again.
      return { ok: false, error: "nothing-asked",
        say: "that named no change — send the field you want different, or `enabled: false` to turn it off" };
    }

    const answer = await can.patchAutomation({
      id: text(args.id), patch,
      version: Number.isInteger(args.ifVersion) ? args.ifVersion : undefined,
      operation: ctx?.operation,
    });
    if (answer?.ok !== true) {
      return { ok: false, error: answer?.error ?? "refused", say: sayAutomation(answer?.error, answer),
        ...(answer?.error === "stale" ? { version: answer.version ?? null } : {}) };
    }
    return { ok: true, automation: answer.automation ?? text(args.id),
      // WHAT REALLY CHANGED, by name, so the answer is about the edit rather than the row.
      changed: Object.keys(patch).sort(),
      // ...AND WHEN IT WILL NEXT RUN, which is the one thing a schedule edit is really about.
      ...(answer.next_run_at !== undefined ? { nextRunAt: answer.next_run_at } : {}),
      ...(answer.version !== undefined ? { version: answer.version } : {}),
      ...alsoSay(answer, "that was already changed by this same request") };
  },
});

/**
 * What a refused save means, in words a model can act on.
 *
 * ⚠ **IT TAKES THE WHOLE ANSWER for the one refusal whose sentence needs a number.** `stale`
 * is the only useful thing to say beside it — *the version I have is N* — and a sentence that
 * said "it has changed" without saying to what leaves a model with the same read it came in
 * with. Every other refusal is a fixed sentence and does not look at the second argument.
 */
const sayAutomation = (error, answer = null) => {
  if (error === "stale") {
    const now = answer && Number.isInteger(answer.version) ? answer.version : null;
    return "somebody else changed that workflow since you read it" +
      (now === null ? "" : ` — it is at version ${now} now`) +
      ", so nothing was changed. Read it again before editing.";
  }
  return {
    "no-agent": "this agent is not one this account has",
    "no-automation": "there is no automation of this agent's with that id",
    "too-many": "this agent already has as many automations as it can hold — change one instead",
    "bad-name": "that automation needs a name",
    "bad-schedule": "that is not a schedule this platform runs",
    "bad-time": 'a daily automation needs a local time as "HH:MM"',
    "bad-zone": "that time zone is not one this platform knows",
    // ⚠ THE PATCH'S OWN REFUSALS, each naming the field rather than the call. A model that
    // sent one bad value must be able to send the call again with that value fixed; a single
    // "could not be saved" makes it guess which field to change.
    "bad-patch": "that edit did not arrive as a set of changes",
    "bad-field": "that edit named something an automation does not have",
    "bad-enabled": "whether it runs is a yes or a no, not a word",
    "bad-inputs": "the things it asks for did not arrive as a list of declarations",
    "bad-steps": "the steps did not arrive as a list",
    "bad-days": "the days did not arrive as a list of day names",
    "bad-date": "that is not a date this platform can read",
    "bad-event": "that event name did not arrive as text",
    "operation-mismatch": "a different request already used this slot, so nothing was changed",
  }[error] ?? "that automation could not be saved";
};

/**
 * ⚠ WHY A RUN WAS NOT STARTED, in words that say what to change.
 *
 * `accept_automation_run` answers `name` for every refusal about one answer and `wanted` for
 * the kind it expected, so the sentence is composed from the FUNCTION'S OWN fields rather
 * than from a second guess about which field a model got wrong. A kind it has never heard of
 * falls through to the general sentence, which is the fail-closed direction: a made-up
 * explanation is worse than none.
 *
 * **A FUNCTION DECLARATION AND NOT A `const`**, because `run_automation` is defined above it
 * and reads it — the temporal dead zone, which `node --check` cannot see.
 */
export function sayStart(error, name, wanted) {
  const of = (typeof name === "string" && name) ? `"${name}"` : "one of the answers";
  const kind = { text: "text", number: "a number", list: "a list of text",
                 "list-of-text": "a list whose every item is text" }[wanted] ?? null;
  return {
    disabled: "that automation is turned off",
    paused: "this agent is paused, so it is not starting anything new",
    "no-automation": "there is no automation of this agent's with that id",
    "unknown-input": `that automation does not ask for ${of}, so nothing was started`,
    "missing-input": `${of} has to be answered, so nothing was started`,
    "bad-input": kind === null
      ? `${of} did not arrive as the kind of thing that automation asks for`
      : `${of} has to arrive as ${kind}`,
    "bad-inputs": "that automation's own declarations could not be read, so nothing was started",
  }[error] ?? "that automation could not be started";
}

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
// ── what can start its automations from outside ─────────────────────────────
//
// ⚠ **TWO TOOLS AND NOT THREE: THERE IS NO `make_event_endpoint`, AND THAT IS THE WHOLE
// SAFETY ARGUMENT RATHER THAN A GAP.**
//
// Creating an endpoint is the one and only moment its signing secret exists outside the
// database — `agent.create_webhook` takes it and never hands it back, and
// `agent.list_webhooks` does not select the column — so a tool that created one would have
// to answer a secret, into model context, into a conversation, and into every log that
// records a tool result. That is a user-only action for exactly the reason connecting an
// account is, and the wall is that `makeCapabilities` offers no operation to call: not a
// rule in a prompt, and not a filter on an answer.
//
// **SO THESE TWO ARE THE MANAGEABLE HALF**: see what exists, and turn one off. Both are
// bounded to this agent's own endpoints by `capabilities`' own list, because
// `agent.set_webhook_enabled` filters by tenant and the agent is the scope no function-level
// filter can see.

const listEventEndpoints = tool({
  name: "list_event_endpoints",
  description:
    "List the inbound endpoints that can start this agent's automations from outside — what " +
    "each is called, which event it emits, whether it is switched on, and the path deliveries " +
    "are posted to. It never returns a signing secret; there is no way to read one.",
  input: { type: "object", properties: {} },
  repeatable: true,
  run: async (_args, can) => {
    const endpoints = await can.listEventEndpoints();
    return { ok: true, count: endpoints.length, endpoints };
  },
});

const setEventEndpoint = tool({
  name: "set_event_endpoint",
  description:
    "Switch one of this agent's inbound endpoints on or off. Switching it off stops every " +
    "delivery to it being accepted at all, so nothing it would have started runs. It does not " +
    "delete the endpoint and does not change its secret.",
  input: {
    type: "object",
    properties: {
      id: { type: "string", description: "The endpoint's id, from list_event_endpoints." },
      enabled: { type: "boolean", description: "true to accept deliveries again, false to stop them." },
    },
    required: ["id", "enabled"],
  },
  writes: true,
  repeatable: true,
  /**
   * ⚠ **A PERSON SAYS YES, for the same reason the authoring tools are gated.** Switching an
   * endpoint off silently stops work an account depends on arriving at all, and back on
   * re-opens a door somebody closed — and neither is visible until something does or does not
   * happen. The decision is about a durable setting, so an approval is what makes it theirs.
   */
  approval: true,
  run: async (args, can, ctx) => {
    // ⚠ REFUSED HERE AS WELL AS IN THE CAPABILITY, and the two are about different things: a
    // model may write anything into an argument, and the capability is the wall for every
    // caller. `Boolean("false")` is `true`, so the coercing reading keeps taking deliveries
    // for an endpoint somebody meant to close.
    if (typeof args.enabled !== "boolean") {
      return { ok: false, error: "bad-enabled",
               say: "say whether it should be on or off — true or false, not a word" };
    }
    const answer = await can.setEventEndpoint({
      endpoint: text(args.id), enabled: args.enabled, operation: ctx?.operation,
    });
    if (answer?.ok !== true) {
      return { ok: false, error: answer?.error ?? "refused",
        say: answer?.error === "no-endpoint"
          ? "this agent has no inbound endpoint with that id"
          : answer?.error === "bad-enabled"
            ? "say whether it should be on or off — true or false, not a word"
            : "that endpoint could not be changed" };
    }
    return { ok: true, endpoint: text(args.id), enabled: answer.enabled === true,
      say: answer.enabled === true
        ? "it is on again — deliveries to it will be accepted"
        : "it is off — deliveries to it will not be accepted, so nothing it would have started will run" };
  },
});

// ── acting through a connection to something outside ────────────────────────
//
// ⚠ **THE CONNECTION SEAM IS ITS OWN, AND THAT IS NOT TIDINESS.** `ctx.capabilities` is
// what an agent may do to its OWN account's records; `ctx.connections` is what it may do to
// somebody else's system. They fail differently (a record is ours to fix, an outbound call
// may have landed and cannot be recalled), they are configured differently (one needs a
// credential per connection), and a deployment can honestly have one and not the other — so
// a tool that asked `capabilities` for a connection would answer `no-backend` for a reason
// that has nothing to do with what is missing.
const NO_CONNECTIONS = Object.freeze({
  ok: false, error: "no-connections",
  say: "this deployment cannot reach anything outside, so that could not be done",
});

const acting = (fn) => async (args, ctx) => {
  const via = ctx?.connections;
  if (!via || typeof via !== "object") return NO_CONNECTIONS;
  return fn(args && typeof args === "object" ? args : {}, via, ctx);
};

const actTool = (spec) => defineTool({ ...spec, scope: PUBLIC, run: acting(spec.run) });

const listConnections = actTool({
  name: "list_connections",
  description:
    "List the outside accounts this agent is connected to — what each one is called, which " +
    "account it is, what it is allowed to do, and whether it is usable right now. It never " +
    "returns any credential.",
  input: { type: "object", properties: {} },
  repeatable: true,
  run: async (_args, via) => {
    const rows = await via.list();
    return { ok: true, count: rows.length, connections: rows,
      say: rows.length ? `${rows.length} connection(s)` : "this agent is not connected to anything yet" };
  },
});

const readMessages = actTool({
  name: "read_messages",
  description:
    "Read what is in one connected account. Give the id of a connection from " +
    "list_connections. This only reads — it changes nothing.",
  input: {
    type: "object",
    properties: {
      connection: { type: "string", description: "The connection's id, from list_connections." },
    },
    required: ["connection"],
  },
  // A READ IS REPEATABLE BY CONSTRUCTION: running it twice leaves the provider as it was.
  repeatable: true,
  run: async (args, via) => via.perform({ connection: text(args.connection), action: "read_messages" }),
});

const sendMessage = actTool({
  name: "send_message",
  description:
    "Send a message from one connected account. Give the id of a connection from " +
    "list_connections, who it is to, and what it says. A person has to approve this before " +
    "it goes out.",
  input: {
    type: "object",
    properties: {
      connection: { type: "string", description: "The connection's id, from list_connections." },
      to: { type: "string", description: "Who it is for." },
      body: { type: "string", description: "What it says." },
    },
    required: ["connection", "to", "body"],
  },
  /**
   * ⚠ **A PERSON APPROVES THIS, AND THE REQUIREMENT IS DECLARED HERE — IN CODE, ON THE
   * TOOL.** Not in an instruction, a retrieved document, a memory or a tool result, because
   * a requirement DATA can set is one data can unset. It is gated on the TOOL and never on
   * its arguments: a gate that read `to` or `body` to decide would be a gate a model turns
   * off by writing something innocuous.
   *
   * The line is what the call changes OUTSIDE this conversation, and this leaves the
   * platform entirely — which is exactly why `read_messages` beside it is not gated.
   */
  approval: true,
  /**
   * ⚠ **`writes` SAYS WHAT A FAILURE MEANS**: the provider may have sent it and we may not
   * have heard. So a failure here is `unresolved` rather than `ok: false`, and the model is
   * told to CHECK rather than invited to try again.
   */
  writes: true,
  /**
   * ⚠ **AND IT IS REPEATABLE BECAUSE `perform` RECONCILES RATHER THAN RE-SENDING, which is
   * a property of the platform and not of the provider.** The fake provider has no
   * idempotency key at all — a second call is a second message — so `false` would be the
   * honest reading of the PROVIDER. What makes `true` true is the operation record: a
   * redelivery finds the slot already claimed and either reads the outcome or asks the
   * provider what it has, and in neither case does it send. `defineTool` requires this of
   * a write anyway, because a write that cannot be repeated can never finish after an
   * interruption — the resume refuses it and names it, for ever.
   */
  repeatable: true,
  run: async (args, via, ctx) => {
    const to = text(args.to), body = text(args.body);
    if (!to) return { ok: false, error: "no-recipient", say: "say who it is for" };
    if (!body) return { ok: false, error: "no-body", say: "say what it should say" };
    if (body.length > TOOL_TEXT_MAX) {
      return { ok: false, error: "too-long", say: `keep it under ${TOOL_TEXT_MAX} characters` };
    }
    return via.perform({
      connection: text(args.connection), action: "send_message", args: { to, body },
      // ⚠ THE IDENTITY IS THE CALL'S OWN AND IS NEVER AN ARGUMENT — see `run.mjs`. It is
      // what makes a redelivery ask about the same send instead of making a second one.
      operation: ctx?.operation,
    });
  },
});

// ── handing work to a specialist agent of the same account ──────────────────
//
// ⚠ **THE DELEGATION SEAM IS ITS OWN, FOR THE REASON `ctx.connections` IS.**
// `ctx.capabilities` is what an agent may do to its own account's RECORDS; this is what it
// may ask other AGENTS of that account to do. They fail differently (a record is ours to
// fix, a child is durable work somebody has to wait for or stop), they are configured
// differently (this one needs the parent run's own id and the asking agent's), and a
// deployment can honestly have one and not the other — so a tool that asked `capabilities`
// for a delegation would answer `no-backend` for a reason that has nothing to do with what
// is missing.
const NO_DELEGATION = Object.freeze({
  ok: false, error: "no-delegation",
  say: "this deployment cannot hand work to other agents, so that could not be done",
});

const delegating = (fn) => async (args, ctx) => {
  const to = ctx?.delegation;
  if (!to || typeof to !== "object") return NO_DELEGATION;
  return fn(args && typeof args === "object" ? args : {}, to, ctx);
};

const delTool = (spec) => defineTool({ ...spec, scope: PUBLIC, run: delegating(spec.run) });

const listSpecialists = delTool({
  name: "list_specialists",
  description:
    "List the other agents of this account that work can be handed to — each one's id, what " +
    "it is called, what it is for, which tools it has and whether it is taking work. Never " +
    "this agent itself.",
  input: { type: "object", properties: {} },
  // ⚠ **THIS IS THE READ THAT MAKES THE WRITE USABLE.** `delegate` requires a specialist's
  // id, and a model cannot know an id it was never told — so without this the tool is a
  // control whose one required argument nobody can supply.
  repeatable: true,
  run: async (_args, to) => {
    const rows = await to.specialists();
    const taking = rows.filter((r) => r?.status === "active").length;
    return { ok: true, count: rows.length, specialists: rows,
      say: rows.length === 0
        ? "this account has no other agents, so there is nobody to hand work to"
        : `${rows.length} specialist(s), ${taking} taking work` };
  },
});

/**
 * ⚠ **`delegate` — AND IT RUNS NOTHING ITSELF.** It files one child run per task on the
 * durable queue and answers the waiting marker; an ORDINARY consumer claims each child, and
 * a later delivery of THIS run reads what they left. **So the parent holds no open request
 * while its specialists work**, which is the requirement rather than an optimisation — and
 * it is why the tool declares `waits: true`.
 *
 * ⚠ **IT TAKES NO BOUND OF ANY KIND, AND THERE IS NOWHERE TO PUT ONE.** How many children,
 * how many at once, how deep and how long to wait are the deployment's: they are read into
 * the store's closure from `DELEGATION_DEFAULTS` and recorded at the tree's root by its
 * first writer, FIRST WRITER WINS — so a child cannot widen what its own tree was started
 * with, and a model cannot widen anything at all. The one thing a caller states is the
 * POLICY, which is not a permission: it decides only whether the PARENT's own step may go
 * on, and `waitVerdict` reads an unknown one as `all`, the strictest.
 *
 * ⚠ **AND IT IS DELIBERATELY NOT `approval: true`, which is the one design decision here
 * worth arguing.** The line this repository draws is what a call changes OUTSIDE the
 * conversation, and a child cannot do anything the parent could not have done itself: its
 * tools are `specialist ∩ granted − revoked`, the revocations subtracted by the database
 * inside the filing transaction, and **a child is an ordinary agent run, so a gated tool it
 * calls is gated for the child exactly as it would be for the parent.** That is what
 * "delegation cannot bypass approvals or revocations" really rests on — the gate travels
 * with the TOOL rather than with who calls it — and gating the fan-out itself would put a
 * person in front of every parallel step while moving no wall at all.
 */
const delegate = delTool({
  name: "delegate",
  description:
    "Hand bounded pieces of this task to specialist agents of this account and wait for " +
    "their answers. Give each one the id of a specialist from list_specialists and a task in " +
    "its own words. They work at the same time and you get every answer back together. " +
    "Nothing you pass here can give a specialist a tool it does not already have.",
  input: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        description: "One entry per specialist to ask. They run at the same time.",
        items: {
          type: "object",
          properties: {
            specialist: { type: "string", description: "The specialist's id, from list_specialists." },
            task: { type: "string", description: "What this one is to do, in its own words.", maxLength: TASK_MAX },
            tools: {
              type: "array", items: { type: "string" },
              description:
                "Which of that specialist's own tools it may use for this. Leave it out to " +
                "give it none. A name it does not already have is dropped and named back to you.",
            },
            context: {
              type: "array",
              description:
                "What to tell this specialist, by name. Nothing is passed on unless it is here.",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: [...CONTEXT_KINDS], description: "What sort of thing this is." },
                  name: { type: "string", description: "What to call it." },
                  value: { type: "string", description: "The text itself." },
                },
                required: ["kind", "name", "value"],
              },
            },
          },
          required: ["specialist", "task"],
        },
      },
      policy: {
        type: "string", enum: [...POLICY_NAMES],
        description:
          "What to do if not every specialist delivers: all (the default — every one has to), " +
          "any (one delivered answer is enough), best_effort (carry on with whoever answered).",
      },
    },
    required: ["tasks"],
  },
  /**
   * ⚠ **BOTH, AND NEITHER IS SUFFICIENT.** `waits` is what lets `run.mjs` hold this run
   * when the answer says it is unfinished; `repeatable` is what lets a later delivery ask
   * again — which is the ORDINARY case rather than the exception, because every delivery
   * after the first is a repeat of this same call. And the repeat is safe because the
   * identity is the SLOT's: the unique index on `(parent, step, position)` absorbs it, so
   * asking is the same act as filing.
   */
  waits: true,
  repeatable: true,
  /**
   * ⚠ **`writes` SAYS WHAT A FAILURE MEANS.** The children may be filed and the answer
   * lost, so a throw here is `unresolved` rather than `ok: false` and the model is told to
   * CHECK rather than invited to ask again — and checking is exactly what a redelivery
   * does, because `open` absorbs.
   */
  writes: true,
  run: async (args, to, ctx) => {
    /**
     * ⚠ **THE IDENTITY IS THE CALL'S OWN, AND WITHOUT ONE NOTHING IS FILED.** Each child's
     * ids are derived from it, so a redelivery asks about the same children instead of
     * making a second set — and a server-minted id would be a fresh one on every delivery
     * by construction. The `no-id` shape `run_automation` already takes.
     */
    const at = splitOperation(typeof ctx?.operation === "string" ? ctx.operation : "");
    if (!at) {
      return { ok: false, error: "no-id",
        say: "this call has no identity, so nothing was delegated — ask again" };
    }
    /**
     * ⚠ **THE STEP KEY IS SHORT BY NECESSITY.** `agent.delegations.step` is capped at 64
     * characters and `ctx.operation` is a uuid, a position and a hash — well past it. The
     * POSITION half is what makes it the same key on every redelivery, so the derivation
     * takes that and nothing else: `d<step>.<index>`.
     */
    const step = `d${at.key.slice(at.key.indexOf(":") + 1).replace(":", ".")}`;

    const asked = Array.isArray(args.tasks) ? args.tasks : null;
    if (!asked) {
      return { ok: false, error: "no-tasks",
        say: "say which specialists to ask and what each one is to do" };
    }
    const roster = await to.specialists();
    const byId = new Map(roster.map((r) => [String(r?.id), r]));

    const children = [];
    const refused = [];
    const dropped = [];
    asked.forEach((t, n) => {
      if (!t || typeof t !== "object" || Array.isArray(t)) { refused.push({ at: n, why: "not-an-entry" }); return; }
      const who = text(t.specialist);
      const task = text(t.task);
      if (!who) { refused.push({ at: n, why: "no-specialist" }); return; }
      if (!task) { refused.push({ at: n, why: "no-task" }); return; }
      if (task.length > TASK_MAX) { refused.push({ at: n, why: "task-too-long" }); return; }
      const spec = byId.get(who);
      // ⚠ NOT FOUND AND NOT THIS ACCOUNT'S ARE ONE ANSWER, because the roster IS the
      // account's — and the door refuses it again inside the transaction, which is the wall.
      // This is the sentence, so a model reads which of its own arguments was wrong.
      if (!spec) { refused.push({ at: n, why: "unknown-specialist" }); return; }
      if (spec.status !== "active") { refused.push({ at: n, why: "specialist-paused" }); return; }
      // CONTEXT IS THIS TOOL'S OWN WALL AND THE ONLY ONE THERE IS. `delegate_children`
      // stores it verbatim, so "passed by name, never by default, and a secret not at all"
      // lives here or nowhere.
      const chosen = selectContext(t.context);
      if (chosen.refused.length) {
        for (const r of chosen.refused) refused.push({ at: n, why: r.why, name: r.name });
        return;
      }
      /**
       * ⚠ **THE NARROWING HAPPENS TWICE AND THE TWO ARE NOT ONE WALL.** The DATABASE's,
       * inside the transaction, is authoritative and also subtracts this account's
       * revocations — which this tool cannot see at all. This one exists to SAY what the
       * grant asked for and the specialist has not got: a filter is a silent drop, a check
       * is a sentence. So `withheld` is deliberately NOT reported from here, because with no
       * revocations to read it could only ever be empty — an absence wearing a value's
       * clothes.
       */
      const narrowed = narrowDelegatedTools({
        specialist: Array.isArray(spec.tools) ? spec.tools : [],
        granted: Array.isArray(t.tools) ? t.tools : [],
        revoked: [],
      });
      // NAMED AND DROPPED, NOT REFUSED. A grant naming a tool the specialist has not got
      // asks for LESS than it meant to, which is the safe direction — so the child runs with
      // what it really may use and the caller is told the rest. Refusing a whole batch over
      // one mistyped name would leave a model unable to delegate at all.
      for (const name of narrowed.unknown) dropped.push({ at: n, tool: name, specialist: who });
      children.push({
        id: uuidFrom(`delegation:${ctx.operation}:${n}`),
        run_id: uuidFrom(`child:${ctx.operation}:${n}`),
        agent_id: who,
        task,
        tools: [...narrowed.tools],
        context: chosen.context.map((c) => ({ kind: c.kind, name: c.name, value: c.value })),
      });
    });

    // ⚠ **REFUSED WHOLE, NEVER AS A PREFIX** — the rule the door itself keeps in a
    // subtransaction, and kept here too rather than left to it: a batch this can name is one
    // nothing needs to be filed for. A context entry quietly dropped would be a specialist
    // asked to do a job without the thing it was meant to be told.
    if (refused.length) {
      return { ok: false, error: "bad-tasks", refused,
        say: `nothing was delegated — ${refused.map((r) => `task ${r.at + 1}: ${r.why}`).join("; ")}` };
    }

    const filed = await to.open({ step, children });
    if (!filed || filed.ok !== true) {
      const e = typeof filed?.error === "string" ? filed.error : "";
      return { ok: false, error: e || "not-delegated",
        say: sayDelegation(e, filed && typeof filed === "object" ? filed : {}) };
    }

    /**
     * ⚠ **THE ANSWER IS READ FROM THE ROWS, NEVER FROM WHAT WAS JUST FILED.** On a
     * redelivery the children may have settled, been cancelled or run out of time since, and
     * `filed` says only what is on record about the ASKING. One reader, so a first delivery
     * and a fiftieth take the same path.
     */
    const rows = await to.look();
    const waitMs = to.bounds?.waitMs;
    const states = rows.map((r) => childState(r, { waitMs }));
    const verdict = waitVerdict(states, text(args.policy) || undefined);

    if (!verdict.over) {
      return {
        [WAITING_MARK]: true,
        policy: verdict.policy,
        counts: verdict.counts,
        working: verdict.blocking,
        ...(dropped.length ? { dropped } : {}),
        say: `${verdict.counts.done} of ${verdict.total} specialist(s) have answered; waiting for the rest`,
      };
    }

    const { results, roster: seen } = combineResults(rows.map((r, i) => ({
      index: Number.isInteger(r?.idx) ? r.idx : i,
      agent: typeof r?.agent_name === "string" ? r.agent_name : null,
      task: typeof r?.task === "string" ? r.task : null,
      state: states[i],
      result: r?.outcome?.result,
    })));
    return {
      ok: verdict.ok,
      ...(verdict.ok ? {} : { error: verdict.why }),
      policy: verdict.policy,
      counts: verdict.counts,
      results,
      specialists: seen,
      ...(dropped.length ? { dropped } : {}),
      say: verdict.ok
        ? `${results.length} of ${verdict.total} specialist(s) answered`
        : `${verdict.counts.done} of ${verdict.total} specialist(s) answered, and `
          + (verdict.policy === "all" ? "this step needs every one" : "none delivered anything to carry on with"),
    };
  },
});

export const CAPABILITY_TOOLS = Object.freeze([
  searchReference, listReference, readReference,
  listMemory, remember, forget,
  listActions, checkWorkflow,
  listAutomations, readAutomation, makeAutomation, changeAutomation,
  pauseAutomation, runAutomation,
  listExecutions, readExecution, cancelExecution,
  listEventEndpoints, setEventEndpoint,
  listConnections, readMessages, sendMessage,
  listSpecialists, delegate,
]);

/**
 * ⚠ **THE THREE THAT REACH OUTSIDE, DECLARED AS A LIST so a census can tell them from the
 * rest.** They need `ctx.connections` rather than `ctx.capabilities`, and a guard that
 * drove them against the wrong seam would report the refusal as working.
 *
 * **AND STORING A CREDENTIAL IS NOT ON IT, DELIBERATELY.** `connect` exists in
 * `connections.mjs` and is not offered as a tool at all: an agent that could store a
 * credential is an agent that could store one it wrote, and a connection a person did not
 * make is a connection nobody granted. Connecting is a PERSON's act, through the site.
 */
export const CONNECTION_TOOLS = Object.freeze(["list_connections", "read_messages", "send_message"]);

/**
 * ⚠ **THE TWO THAT REACH OTHER AGENTS, DECLARED AS A LIST so a census can tell them from
 * the rest.** They need `ctx.delegation` rather than `ctx.capabilities` or
 * `ctx.connections`, and a guard that drove them against the wrong seam would report the
 * refusal as working — which is why the three absences say three different things.
 *
 * **AND FILING A CHILD IS THE ONLY WRITE ON IT.** Settling one, stopping them and sweeping
 * overdue parents are the RUNNER's and the cron's, in `delegation-store.mjs`' flat
 * operations, and none of them is on this seam at all: a tool that could settle a child
 * could write its sibling's answer, and one that could sweep could reach every account's
 * trees.
 */
export const DELEGATION_TOOLS = Object.freeze(["list_specialists", "delegate"]);

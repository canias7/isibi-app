/**
 * THE AGENT REGISTRY — agents are CODE, and this is where that code lives.
 *
 * A request NAMES an agent; it can never describe one. An agent is tools,
 * instructions and bounds, and letting a request supply that would be letting a
 * request supply code. `api.mjs` looks names up in here and nowhere else.
 */

import { defineAgent, defineTool, PUBLIC } from "./define.mjs";

/**
 * A tool with no side effects at all, so the first agent through the real API
 * cannot do anything to anybody. `repeatable: true` is honest for a pure
 * function: running it twice is the same as running it once.
 */
const echo = defineTool({
  name: "echo",
  description: "Repeat a short piece of text back. Useful only for checking the pipe.",
  input: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  scope: PUBLIC,
  repeatable: true,
  run: async (args) => ({ echoed: typeof args?.text === "string" ? args.text.slice(0, 200) : "" }),
});

const support = Object.freeze({
  support: defineAgent({
    name: "support",
    model: "stand-in",
    instructions: "Answer the customer's question. Use echo only to check the pipe.",
    tools: [echo],
    // Deliberately tight for a first live agent: a runaway loop costs nothing here
    // because the model is a stand-in, and it will cost money the day it is not.
    limits: { steps: 4, toolCalls: 4, wallMs: 60_000 },
  }),
});

/**
 * ⚠ THE CATALOG — every tool a CUSTOMER-AUTHORED agent may be given, and nothing
 * else in this file is offerable.
 *
 * **IT IS A POSITIVE LIST IN CODE, which is the whole wall.** A customer's
 * selection is a list of NAMES, stored in `agent.agents.tools` and recorded in each
 * run's own first journal entry; `narrowTools` looks those names up IN HERE. So a
 * name nobody put in this array resolves to no tool, whatever a request body, a
 * database column or an instruction sheet says. A deny-list would be a claim about
 * the producer rather than about the input, and the one tool somebody forgets to
 * deny is the one that matters.
 *
 * **ONLY WHAT IS REALLY IMPLEMENTED AND REALLY COMPLETABLE GOES IN, and today that
 * is `echo` alone.** `wait` and `commit` are implemented and are deliberately NOT
 * offered: they exist to demonstrate duration and the no-repeat refusal, and the
 * stand-in answers them with the SLOW shape — `SLOW_ROUNDS` (8) tool calls —
 * against an authored budget of two. **MEASURED, not reasoned about: an authored
 * agent given `wait` stops `{reason: "spent", bound: "toolCalls"}` after one round
 * and never answers.** Offering it would be offering a control that always fails,
 * which is this repository's recorded dead-control finding in its worst form.
 *
 * **EVERY CATALOG TOOL MUST BE `PUBLIC`-SCOPED**, and a guard censuses it. The
 * tenancy wall (`toolsFor`) runs after this one and withholds anything the tenant
 * has no grant for; a scoped tool in the catalog would be a tool the settings screen
 * offers, a customer selects, and the run then withholds — a promise the layer below
 * refuses, with nobody able to see why.
 */
export const OFFERED = Object.freeze([echo]);

/** The catalog's names, DERIVED, so nothing can hold a second copy of the list. */
export const OFFERED_NAMES = Object.freeze(OFFERED.map((t) => t.name));

/**
 * A TOOL THAT TAKES TIME AND NOTHING ELSE.
 *
 * It exists to demonstrate the thing that is hardest to believe without seeing it:
 * that a run outlives the request that asked for it. Sleeping is the honest
 * stand-in for real work — a model call, a container build, a page compile — and it
 * costs nothing and touches nothing.
 *
 * **`repeatable: true` IS CORRECT HERE AND IS NOT THE EASY CHOICE.** Waiting twice
 * is the same as waiting once, so a redelivery may safely finish it. A tool that
 * did anything at all would have to say `false` and would refuse the resume, which
 * is the behaviour the payment case in the runner tests pins.
 */
const wait = defineTool({
  name: "wait",
  description: "Do nothing for a while. Used to stand in for work that takes time.",
  input: { type: "object", properties: { ms: { type: "number" } }, required: ["ms"] },
  scope: PUBLIC,
  repeatable: true,
  run: async (args) => {
    // BOUNDED HERE TOO, not only by the run's `toolMs`. A tool is the agent
    // author's own code and the loop has nowhere to interrupt it from, so a tool
    // that can be asked for an unbounded sleep is a tool that can hold a lease
    // open for ever.
    const ms = Math.min(Math.max(Number(args?.ms) || 0, 0), 25_000);
    await new Promise((r) => setTimeout(r, ms));
    return { waited: ms };
  },
});

/**
 * THE SAME WAIT, DECLARED UNSAFE TO REPEAT.
 *
 * It exists to make the refusal provable against a real deployment. The rule that
 * matters — a tool call with no recorded result may have run, so running it again is
 * only allowed when running it twice is harmless — can otherwise only be shown with
 * a tool that really does something, and a verification run must not do anything to
 * anybody.
 *
 * **SO THIS IS A PAYMENT'S SHAPE WITHOUT A PAYMENT: `repeatable` is absent, which
 * means false.** It waits, it returns, and the platform must still refuse to resume
 * past it — because the refusal is decided by the DECLARATION and never by what the
 * tool happens to do.
 */
const commit = defineTool({
  name: "commit",
  description: "Stands in for an action that must not happen twice. It only waits.",
  input: { type: "object", properties: { ms: { type: "number" } }, required: ["ms"] },
  scope: PUBLIC,
  // repeatable is deliberately NOT set. The default protects.
  run: async (args) => {
    const ms = Math.min(Math.max(Number(args?.ms) || 0, 0), 25_000);
    await new Promise((r) => setTimeout(r, ms));
    return { committed: true, waited: ms };
  },
});

/**
 * The long-running agent. Its bounds are deliberately wide enough for a run that
 * lasts minutes, because that is the case the queue exists for — and every one of
 * them is still enforced in code.
 */
export const SLOW = Object.freeze({
  slow: defineAgent({
    name: "slow",
    model: "stand-in",
    instructions: "Work through the task in stages, waiting between them.",
    tools: [wait],
    limits: { steps: 16, toolCalls: 16, wallMs: 900_000, toolMs: 30_000 },
  }),
});


/**
 * ⚠ THE AGENT EVERY CUSTOMER-AUTHORED AGENT RUNS UNDER.
 *
 * **THE DIVISION IS THE WHOLE POINT: the customer owns the INSTRUCTIONS AND THE
 * SELECTION, and this file owns everything else.** A person writes a name and an
 * instruction in the browser and ticks the tools they want; all of that is data,
 * stored in `agent.agents`, and a run is started with a snapshot of it in its first
 * journal entry. The CATALOG those ticks choose from, the bounds and the model come
 * from HERE, are code, and cannot be reached from a request at all — which is what
 * keeps "an agent is named, never described" true while still letting the described
 * half be somebody's own writing.
 *
 * **`tools` IS THE CATALOG, NOT THE PERMISSIONS — and `authored: true` is what says
 * so.** For an ordinary agent this list is what its runs get. For this one it is the
 * most any run may have, and each run gets the subset its own journal entry recorded:
 * `narrowTools(agent, entry.tools)`, which may only ever reduce. A run whose entry
 * lists no tools gets NONE, which is both the old behaviour and the safe default.
 *
 * **THE FLAG IS READ FROM CODE AND NEVER FROM THE LOG, and that closes the one door
 * that would otherwise widen.** `POST /runs` can name any registered agent with no
 * snapshot at all; deciding "narrow this one" off a log field the caller may omit
 * would hand such a run the whole catalog. `registered.authored` cannot be omitted by
 * anybody.
 *
 * **⚠ THE BOUNDS ARE MEASURED, AND `toolCalls` HAD TO MOVE THE DAY A TOOL BECAME
 * REACHABLE.** It was ONE, chosen as "the smallest number that lets the run start"
 * when the tool list was empty and nothing could be called. `toolCalls` is a RUN
 * TOTAL and `stoppedBy` asks `used >= limit`, so a budget of one is a budget already
 * spent the instant one call is made: **measured, an authored agent holding `echo`
 * stopped `{reason: "spent", bound: "toolCalls", limit: 1, used: 1}` after its tool
 * call and never reached the step that answers.** A tool selection under that bound
 * would have been a control that always fails.
 *
 * So the budget must EXCEED the spend rather than equal it: **`toolCalls: 2` for one
 * call, measured green** (answer at step 2, `used {steps: 2, toolCalls: 1}`). And
 * `steps` is **3** by this file's own older rule — the one-tool shape really takes
 * two steps, call then answer, and a bound that is exactly the happy path cannot tell
 * the ordinary path from something having changed. Zero let the run not start, one let
 * it not finish; both were found by driving it rather than by reading it.
 *
 * **ITS OWN `instructions` ARE A PLACEHOLDER AND SHOULD NEVER BE USED.**
 * `defineAgent` compels them, and every run of this agent substitutes the
 * customer's snapshot through `withInstructions`. A run reaching the model with
 * THIS text is a run whose snapshot did not arrive, and the stand-in quotes its
 * instructions back so that says so out loud rather than reading as an answer.
 */
export const AUTHORED_AGENT = "authored";

export const AUTHORED = Object.freeze({
  [AUTHORED_AGENT]: defineAgent({
    name: AUTHORED_AGENT,
    model: "stand-in",
    instructions:
      "This text is a placeholder and is replaced per run by the instructions the " +
      "customer wrote. Seeing it means the run's snapshot did not arrive.",
    authored: true,
    tools: OFFERED,
    limits: { steps: 3, toolCalls: 2, wallMs: 60_000, callMs: 30_000 },
  }),
});

/**
 * THE REGISTRY. Built LAST, from the agents above, so adding one is adding it here
 * rather than remembering to — a request can only ever NAME what is in this object.
 */
/**
 * The agent a live verification uses to prove the refusal. Same model, same shape as
 * `slow`, one difference: its tool may not be repeated.
 */
export const GUARDED = Object.freeze({
  guarded: defineAgent({
    name: "guarded",
    model: "stand-in",
    instructions: "Work through the task in stages, committing between them.",
    tools: [commit],
    limits: { steps: 16, toolCalls: 16, wallMs: 900_000, toolMs: 30_000 },
  }),
});

export const AGENTS = Object.freeze({ ...support, ...SLOW, ...GUARDED, ...AUTHORED });

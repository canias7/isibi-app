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
 * **THE DIVISION IS THE WHOLE POINT: the customer owns the INSTRUCTIONS and this
 * file owns everything else.** A person writes a name and an instruction in the
 * browser; they are data, stored in `agent.agents`, and a run is started with a
 * snapshot of them in its first journal entry. The tools, the bounds and the model
 * come from HERE, are code, and cannot be reached from a request at all — which is
 * what keeps "an agent is named, never described" true while still letting the
 * described half be somebody's own writing.
 *
 * **NO TOOLS, AND THAT IS A STATEMENT RATHER THAN AN OVERSIGHT.** A customer's
 * instructions can ask for anything; with an empty tool list there is nothing for
 * them to reach. `toolsFor` is a positive list and fails closed, and dispatch
 * fails closed too, so a name the model invents comes back as a readable "no such
 * tool" result and nothing runs.
 *
 * **⚠ AND THE OBVIOUS SECOND WALL IS A BRICK WALL — MEASURED, by a guard, before
 * this shipped.** This agent was first written with `toolCalls: 0`, meaning "and
 * no budget to call one either". `toolCalls` is a RUN TOTAL, and `stoppedBy` asks
 * `used >= limit`: at the very start that is `0 >= 0`, so the run stops with
 * `{reason: "spent", bound: "toolCalls", limit: 0, used: 0}` **before its first
 * model call**. Every customer-authored agent would have answered nothing at all,
 * and the failure would have read as a limit doing its job.
 *
 * So the bound below is ONE, and it is **not a second wall — it is the smallest
 * number that lets the run start**, which is worth saying because a number with
 * no stated author is how the next reader talks themselves into changing it. The
 * tool list is the only wall here, and it is sufficient: with `tools: []` there is
 * nothing to dispatch TO, so the bound could be sixty-four and no tool would run.
 * *Saying a thing twice is not available when one of the two ways is a brick.*
 *
 * **ITS OWN `instructions` ARE A PLACEHOLDER AND SHOULD NEVER BE USED.**
 * `defineAgent` compels them, and every run of this agent substitutes the
 * customer's snapshot through `withInstructions`. A run reaching the model with
 * THIS text is a run whose snapshot did not arrive, and the stand-in quotes its
 * instructions back so that says so out loud rather than reading as an answer.
 *
 * **THE BOUNDS ARE DELIBERATELY WIDER THAN THE SHAPE NEEDS.** The stand-in answers
 * in one step, so `steps: 2` means a stop on `steps` is something having changed
 * rather than the ordinary path — a bound that is exactly the happy path cannot
 * tell the two apart.
 */
export const AUTHORED_AGENT = "authored";

export const AUTHORED = Object.freeze({
  [AUTHORED_AGENT]: defineAgent({
    name: AUTHORED_AGENT,
    model: "stand-in",
    instructions:
      "This text is a placeholder and is replaced per run by the instructions the " +
      "customer wrote. Seeing it means the run's snapshot did not arrive.",
    tools: [],
    limits: { steps: 2, toolCalls: 1, wallMs: 60_000, callMs: 30_000 },
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

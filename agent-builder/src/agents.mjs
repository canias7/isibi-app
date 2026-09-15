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

export const AGENTS = Object.freeze({
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

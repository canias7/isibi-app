/**
 * THE MODEL STAND-IN — no provider, no network, no spend.
 *
 * It exists so the whole pipe can be driven for real: a real request, real
 * storage, real auth, a real queue, and a model-shaped answer that costs nothing.
 * It reports usage and cost the way a provider does, so the meters and the budget
 * are exercised rather than bypassed.
 *
 * **IT IS NOT A MOCK OF A PROVIDER'S WIRE FORMAT.** `send` is the translator in
 * this design, so a stand-in and a real provider are two implementations of the
 * same one-function contract — which is exactly why swapping in the real one later
 * changes nothing above it.
 *
 * **IT CHOOSES WHAT TO DO FROM THE TOOLS IT IS OFFERED, which is the one thing
 * that makes it model-like rather than scripted.** One `send` serves every agent
 * in the registry, because that is how a deployment really works: there is one
 * model and several agents, and the model sees a different tool list each time. A
 * stand-in that had to be configured per agent would be a second registry.
 */

/**
 * The tools that mean "this agent's work takes time". See `agents.mjs`.
 *
 * TWO NAMES, ONE SHAPE. `wait` is repeatable and `commit` is not, which is the only
 * difference between them — and it is a difference the MODEL must not see, because
 * whether a tool may be retried is the platform's business and not something a model
 * decides. So the stand-in treats them identically.
 */
export const SLOW_TOOLS = Object.freeze(["wait", "commit"]);

/** Kept as its own name: the first is what a plain long run uses. */
export const SLOW_TOOL = SLOW_TOOLS[0];

/**
 * How a long run is shaped: this many rounds, each waiting this long.
 *
 * **SEVERAL ROUNDS RATHER THAN ONE LONG SLEEP, and that is the point.** Each round
 * writes a model entry and a tool result, so PROGRESS accumulates in the log and a
 * reader can watch it move. One sixty-second sleep would be a minute of silence
 * followed by an answer, which demonstrates nothing about progress.
 */
export const SLOW_ROUNDS = 8;
export const SLOW_STEP_MS = 8_000;

/** What a run of the slow shape lasts, at least. Derived, so the two cannot drift. */
export const SLOW_TOTAL_MS = SLOW_ROUNDS * SLOW_STEP_MS;

/**
 * WHAT EVERY STAND-IN ANSWER SAYS ABOUT ITSELF.
 *
 * **THE LABEL IS IN THE TEXT, not only in the screen that draws it**, and the
 * redundancy is deliberate: a label in the chrome is gone the moment somebody
 * copies the answer into an email, and a label in the text survives being quoted.
 * Neither replaces the other — the chrome's label is visible before you read a
 * word, and this one travels. Both are asserted.
 *
 * **IT IS NOT A DISCLAIMER BOLTED ON.** No model is connected, so there is no
 * answer here to soften: this text IS the whole of what the stand-in produced,
 * and saying anything that reads as an AI's reply would be the recorded
 * dead-control finding in its worst form — a control that ANSWERS, wrongly.
 */
export const SIMULATED = "[simulated]";

/** How much of an agent's own instructions an answer quotes back. A bound, not a style. */
export const SIMULATED_QUOTE = 120;

/**
 * The answer a customer-authored agent gets today.
 *
 * **IT QUOTES THE INSTRUCTIONS AND COUNTS THE HISTORY ON PURPOSE.** Those two are
 * the things this milestone connects, and they are invisible from outside unless
 * the answer says what arrived: a run that was handed the wrong snapshot, or none,
 * produces visibly different text rather than a plausible one nobody can check.
 * So this doubles as the verification's own instrument.
 */
export function simulatedAnswer({ system, messages }) {
  const said = [...(messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? "";
  const turns = (messages ?? []).filter((m) => m.role === "user").length - 1;
  const brief = String(system ?? "").trim().slice(0, SIMULATED_QUOTE);
  return [
    `${SIMULATED} No model is connected to this agent yet, so this is a stand-in test`,
    "result rather than an answer from an AI.",
    brief ? `\n\nYour instructions begin: "${brief}".` : "\n\nThis agent has no instructions.",
    `\nYou said: "${String(said).slice(0, SIMULATED_QUOTE)}".`,
    turns > 0 ? `\nIt was given ${turns} earlier ${turns === 1 ? "turn" : "turns"} of this conversation.`
              : "\nThis is the first message in the conversation.",
  ].join(" ").replace(/ +\n/g, "\n");
}

export function makeStandIn({ toolName = "echo", rounds = null, waitMs = null } = {}) {
  return async function send({ messages, step, tools, system }) {
    const offered = Array.isArray(tools) ? tools : [];

    // ── an agent with no tools at all ─────────────────────────────────────────
    //
    // **A MODEL WITH NOTHING TO CALL ANSWERS, and this branch is what makes that
    // shape reachable.** Without it the ordinary shape below asks for `echo` on
    // step 1 whatever it was offered, dispatch fails closed, and the run spends a
    // step and a tool slot discovering that a tool it was never shown does not
    // exist. That is a correct refusal and a wrong conversation.
    //
    // It is also the shape a CUSTOMER-AUTHORED agent runs in: the registered
    // agent it executes under offers no tools, so a customer's instructions can
    // never reach one in this milestone.
    if (!offered.length) {
      return {
        text: simulatedAnswer({ system, messages }),
        toolCalls: [],
        usage: { inputTokens: 24, outputTokens: 14 },
        costMicros: 70,
      };
    }

    // ── an agent whose work takes time ────────────────────────────────────────
    const slow = offered.find((t) => SLOW_TOOLS.includes(t?.name));
    if (slow) {
      const n = Number.isInteger(rounds) && rounds >= 1 ? rounds : SLOW_ROUNDS;
      const ms = Number.isFinite(waitMs) && waitMs > 0 ? waitMs : SLOW_STEP_MS;
      if (step <= n) {
        return {
          text: "", toolCalls: [{ id: `call-${step}`, name: slow.name, args: { ms } }],
          usage: { inputTokens: 10, outputTokens: 4 }, costMicros: 30,
        };
      }
      // How long it really waited, read back off the log rather than assumed — the
      // answer should be about what happened, not about what was planned.
      const waited = messages
        .filter((m) => m.role === "tool")
        .flatMap((m) => m.content ?? [])
        .reduce((sum, c) => sum + (Number(c?.result?.waited) || 0), 0);
      return {
        text: `worked through ${n} stages over ${waited} ms`,
        toolCalls: [], usage: { inputTokens: 18, outputTokens: 9 }, costMicros: 50,
      };
    }

    // ── the ordinary shape: one tool call, then an answer ─────────────────────
    // So a driven run exercises a step, a tool, a second step and a stop, rather
    // than the shortest path through it.
    const first = messages.find((m) => m.role === "user")?.content ?? "";
    const n = Number.isInteger(rounds) && rounds >= 1 ? rounds : 1;
    if (step <= n) {
      return {
        text: "",
        toolCalls: [{ id: `call-${step}`, name: toolName, args: { text: String(first).slice(0, 200) } }],
        usage: { inputTokens: 12, outputTokens: 5 },
        costMicros: 40,
      };
    }
    const tool = [...messages].reverse().find((m) => m.role === "tool");
    const echoed = tool?.content?.[0]?.result?.echoed ?? "";
    return {
      text: `stand-in answer. you said: ${echoed}`,
      toolCalls: [],
      usage: { inputTokens: 20, outputTokens: 11 },
      costMicros: 60,
    };
  };
}

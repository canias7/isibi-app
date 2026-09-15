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

/** The tool that means "this agent's work takes time". See `agents.mjs`. */
export const SLOW_TOOL = "wait";

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

export function makeStandIn({ toolName = "echo", rounds = null, waitMs = null } = {}) {
  return async function send({ messages, step, tools }) {
    const offered = Array.isArray(tools) ? tools : [];

    // ── an agent whose work takes time ────────────────────────────────────────
    if (offered.some((t) => t?.name === SLOW_TOOL)) {
      const n = Number.isInteger(rounds) && rounds >= 1 ? rounds : SLOW_ROUNDS;
      const ms = Number.isFinite(waitMs) && waitMs > 0 ? waitMs : SLOW_STEP_MS;
      if (step <= n) {
        return {
          text: "", toolCalls: [{ id: `call-${step}`, name: SLOW_TOOL, args: { ms } }],
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

/**
 * THE MODEL STAND-IN — no provider, no network, no spend.
 *
 * It exists so the whole pipe can be driven for real: a real request, real
 * storage, real auth, and a model-shaped answer that costs nothing. It reports
 * usage and cost the way a provider does, so the meters and the budget are
 * exercised rather than bypassed.
 *
 * **IT IS NOT A MOCK OF A PROVIDER'S WIRE FORMAT.** `send` is the translator in
 * this design, so a stand-in and a real provider are two implementations of the
 * same one-function contract — which is exactly why swapping in the real one later
 * changes nothing above it.
 *
 * ONE TOOL CALL, THEN AN ANSWER, so a driven run exercises a step, a tool, a
 * second step and a stop — the whole shape rather than the shortest path through
 * it.
 */
export function makeStandIn({ toolName = "echo" } = {}) {
  return async function send({ messages, step }) {
    const first = messages.find((m) => m.role === "user")?.content ?? "";
    if (step === 1) {
      return {
        text: "",
        toolCalls: [{ id: "call-1", name: toolName, args: { text: String(first).slice(0, 200) } }],
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

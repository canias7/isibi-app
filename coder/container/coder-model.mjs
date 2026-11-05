// CODER'S AI CALL (2026-11-05). One request to Grok's chat/completions endpoint
// (OpenAI-shaped: messages, tools, tool_calls), the builder's default model.
// Runs inside Coder's container with the key it was started with; the key is
// never handed to a command (`cleanEnv`).
export const CODER_ENDPOINT = "https://api.x.ai/v1/chat/completions";
export const CODER_DEFAULT_MODEL = "grok-4.7";
export const CODER_CALL_MS = 4 * 60 * 1000;

// THE MODEL PICKER (owner, 2026-11-05: "put the model picker, put grok 4.7
// attached to its effort levels"). Each model with the effort levels it takes;
// the screen shows this list and the Worker refuses anything not on it.
export const CODER_MODELS = [
  { id: "grok-4.7", name: "Grok 4.7", efforts: ["low", "medium", "high"], effort: "medium" },
];
/** A model and effort from the list: `{ model, effort }`, the defaults for anything else. */
export function pickModel(model, effort) {
  const m = CODER_MODELS.find((x) => x.id === model) || CODER_MODELS[0];
  return { model: m.id, effort: m.efforts.includes(effort) ? effort : m.effort };
}

/** The model to use: CODER_MODEL when it looks like a model id, else the default. */
export function coderModel(env) {
  const m = env && typeof env.CODER_MODEL === "string" ? env.CODER_MODEL.trim() : "";
  // `default` is the deploy's own word for "not set" (an empty secret fails a deploy).
  return m !== "default" && /^[a-z0-9][a-z0-9._-]{1,60}$/i.test(m) ? m : CODER_DEFAULT_MODEL;
}

/**
 * A `send` for `runCoder`: `{ model, messages, tools, tool_choice } → { message, usage }`.
 * Throws on a missing key, a failed call or an answer with no message (the loop says so).
 * Retries once on 429 / 5xx after a short wait.
 */
export function coderSend(env, { fetchFn = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const key = env && typeof env.XAI_API_KEY === "string" ? env.XAI_API_KEY : "";
  return async (req) => {
    if (!key) throw Object.assign(new Error("no AI key in Coder's container"), { status: 0 });
    const body = JSON.stringify({ model: req.model || coderModel(env), messages: req.messages, tools: req.tools, tool_choice: req.tool_choice || "auto", ...(req.effort ? { reasoning_effort: req.effort } : {}) });
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetchFn(CODER_ENDPOINT, {
        method: "POST", body,
        headers: { authorization: "Bearer " + key, "content-type": "application/json" },
        signal: AbortSignal.timeout(CODER_CALL_MS),
      });
      if ((r.status === 429 || r.status >= 500) && attempt === 0) { await wait(3000); continue; }
      if (!r.ok) throw Object.assign(new Error("AI call failed: " + r.status), { status: r.status });
      const j = await r.json();
      const message = j && Array.isArray(j.choices) && j.choices[0] && j.choices[0].message;
      if (!message) throw new Error("the AI answered with no message");
      const u = j.usage || {};
      return { message, usage: { in: u.prompt_tokens || 0, out: u.completion_tokens || 0 } };
    }
    throw new Error("AI call failed");
  };
}

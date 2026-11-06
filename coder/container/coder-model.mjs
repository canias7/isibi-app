// CODER'S AI CALL (2026-11-05). One request to xAI's Responses endpoint, so
// Grok can search the web itself (owner: "no free search", and after one test
// call: "yes" to Grok's own search). Coder keeps its conversation in the
// OpenAI chat shape (messages, tool_calls, tool answers); this file turns it
// into the Responses shape and back, so nothing else changes.
// Runs inside Coder's container with the key it was started with; the key is
// never handed to a command (`cleanEnv`).
export const CODER_ENDPOINT = "https://api.x.ai/v1/responses";
export const CODER_DEFAULT_MODEL = "grok-4.7";
export const CODER_CALL_MS = 4 * 60 * 1000;

// THE MODEL PICKER (owner, 2026-11-05: "put the model picker, put grok 4.7
// attached to its effort levels"). Each model with the effort levels it takes;
// the screen shows this list and the Worker refuses anything not on it.
export const CODER_MODELS = [
  // xAI's docs (docs.x.ai/docs/guides/reasoning, checked 2026-11-06): grok-4.7 takes
  // reasoning.effort low / medium / high (its default) / xhigh; reasoning cannot be turned off.
  { id: "grok-4.7", name: "Grok 4.7", efforts: ["low", "medium", "high", "xhigh"], effort: "high" },
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

/** Coder's chat-shaped messages as Responses input: `{ instructions, input }`. */
export function toResponsesInput(messages) {
  const sys = [], input = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "system") { sys.push(String(m.content || "")); continue; }
    if (m.role === "tool") { input.push({ type: "function_call_output", call_id: String(m.tool_call_id || ""), output: String(m.content ?? "") }); continue; }
    if (m.role === "assistant") {
      if (m.content) input.push({ role: "assistant", content: String(m.content) });
      for (const c of Array.isArray(m.tool_calls) ? m.tool_calls : []) {
        const f = (c && c.function) || {};
        input.push({ type: "function_call", call_id: String(c.id || ""), name: String(f.name || ""), arguments: typeof f.arguments === "string" ? f.arguments : JSON.stringify(f.arguments || {}) });
      }
      continue;
    }
    if (m.role === "user") {
      const imgs = Array.isArray(m.images) ? m.images : [];
      input.push(imgs.length ? { role: "user", content: [{ type: "input_text", text: String(m.content ?? "") }, ...imgs.map((u) => ({ type: "input_image", image_url: u, detail: "auto" }))] } : { role: "user", content: String(m.content ?? "") });
    }
  }
  return { instructions: sys.join("\n\n"), input };
}
/** Coder's function tools in the Responses shape, plus Grok's own web search. */
export function toResponsesTools(tools) {
  const out = (Array.isArray(tools) ? tools : []).filter((x) => x && x.type === "function" && x.function).map((x) => ({ type: "function", name: x.function.name, description: x.function.description, parameters: x.function.parameters }));
  return [{ type: "web_search" }, ...out];
}
/** A Responses answer as `{ message, searches }`: the chat-shaped message, and the web searches Grok made. */
export function fromResponsesOutput(j) {
  let text = "";
  const tool_calls = [], searches = [];
  for (const item of Array.isArray(j && j.output) ? j.output : []) {
    if (!item) continue;
    // Two messages (say, one before a web search and one after) are two paragraphs (live test, 2026-11-06: "tips.- Keep…").
    if (item.type === "message") { const part = (Array.isArray(item.content) ? item.content : []).map((c) => (c && typeof c.text === "string" ? c.text : "")).join(""); text += text && part ? "\n\n" + part : part; }
    else if (item.type === "function_call") tool_calls.push({ id: String(item.call_id || item.id || ""), type: "function", function: { name: String(item.name || ""), arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments || {}) } });
    else if (item.type === "web_search_call") {
      const a = item.action || {};
      searches.push({ query: String(a.query || ""), sources: (Array.isArray(a.sources) ? a.sources : []).map((s) => String((s && s.url) || "")).filter(Boolean).slice(0, 10) });
    }
  }
  if (!text && !tool_calls.length && !searches.length) return { message: null, searches };
  return { message: { role: "assistant", content: text, ...(tool_calls.length ? { tool_calls } : {}) }, searches };
}

/**
 * A `send` for `runCoder`: `{ model, messages, tools, tool_choice } → { message, searches, usage }`.
 * Throws on a missing key, a failed call or an answer with no message (the loop says so).
 * Retries once on 429 / 5xx after a short wait.
 */
export function coderSend(env, { fetchFn = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const key = env && typeof env.XAI_API_KEY === "string" ? env.XAI_API_KEY : "";
  return async (req) => {
    if (!key) throw Object.assign(new Error("no AI key in Coder's container"), { status: 0 });
    let withEffort = !!req.effort;
    const { instructions, input } = toResponsesInput(req.messages);
    const make = () => JSON.stringify({ model: req.model || coderModel(env), instructions, input, tools: toResponsesTools(req.tools), tool_choice: req.tool_choice || "auto", store: false, ...(withEffort ? { reasoning: { effort: req.effort } } : {}) });
    let body = make();
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetchFn(CODER_ENDPOINT, {
        method: "POST", body,
        headers: { authorization: "Bearer " + key, "content-type": "application/json" },
        signal: AbortSignal.timeout(CODER_CALL_MS),
      });
      if ((r.status === 429 || r.status >= 500) && attempt === 0) { await wait(3000); continue; }
      // THE EFFORT SAFETY NET: a model that refuses the effort setting is asked
      // again without it (once), rather than failing every message.
      if (r.status === 400 && withEffort && attempt === 0) {
        const t = await r.text().catch(() => "");
        if (/reasoning|effort/i.test(t)) { withEffort = false; body = make(); continue; }
        throw Object.assign(new Error("AI call failed: 400 " + t.replace(/\s+/g, " ").slice(0, 160)), { status: 400 });
      }
      if (!r.ok) { const t = await r.text().catch(() => ""); throw Object.assign(new Error("AI call failed: " + r.status + (t ? " " + t.replace(/\s+/g, " ").slice(0, 160) : "")), { status: r.status }); }
      const j = await r.json();
      const { message, searches } = fromResponsesOutput(j);
      if (!message) throw new Error("the AI answered with no message");
      const u = j.usage || {};
      const web = (u.server_side_tool_usage_details && u.server_side_tool_usage_details.web_search_calls) || searches.length;
      return { message, searches, usage: { in: u.input_tokens || 0, out: u.output_tokens || 0, searches: web || 0, cost_ticks: u.cost_in_usd_ticks || 0 } };
    }
    throw new Error("AI call failed");
  };
}

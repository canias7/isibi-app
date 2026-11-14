// CODER'S AI CALL (2026-11-05). One request to xAI's Responses endpoint, so
// Grok can search the web itself (owner: "no free search", and after one test
// call: "yes" to Grok's own search). Coder keeps its conversation in the
// OpenAI chat shape (messages, tool_calls, tool answers); this file turns it
// into the Responses shape and back, so nothing else changes.
// On Coder's machines it runs with no key at all (owner, 2026-11-07, step 1:
// "the Grok key out of the machine"): each call goes to Coder's Worker with the
// job's pass (`via`), and the Worker adds the key. A machine made in a test, or
// a key in the environment, still calls xAI itself.
export const CODER_ENDPOINT = "https://api.x.ai/v1/responses";
export const CODER_DEFAULT_MODEL = "grok-4.7";
export const CODER_CALL_MS = 4 * 60 * 1000;

// THE MODEL PICKER (owner, 2026-11-05: "put the model picker, put grok 4.7
// attached to its effort levels"). Each model with the effort levels it takes;
// the screen shows this list and the Worker refuses anything not on it.
export const CODER_MODELS = [
  // xAI's docs (docs.x.ai/docs/guides/reasoning, checked 2026-11-06): grok-4.7 takes
  // reasoning.effort low / medium / high (xAI's default) / xhigh; reasoning cannot be turned off.
  // CODER'S DEFAULT IS LOW (owner, 2026-11-10: "can you do the effort level on low and make sure it's actually on low"):
  // xAI's "Uses some reasoning tokens, but still fast", for "latency-sensitive agentic use and simple tool calling".
  { id: "grok-4.7", name: "Grok 4.7", efforts: ["low", "medium", "high", "xhigh"], effort: "low" },
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
/**
 * Coder's function tools in the Responses shape, and xAI's own web search only for a request that asks for it (`webSearch`:
 * true, or its domain filters, { allowed_domains } or { excluded_domains }). Since web search became Coder's own tool, like
 * Claude Code's WebSearch (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; coder-websearch.mjs),
 * only that tool's own request asks: every other call, Coder's and Gloopy's included, searches only through the tool.
 */
export function toResponsesTools(tools, { webSearch = false } = {}) {
  const out = (Array.isArray(tools) ? tools : []).filter((x) => x && x.type === "function" && x.function).map((x) => ({ type: "function", name: x.function.name, description: x.function.description, parameters: x.function.parameters }));
  if (!webSearch) return out;
  // (xAI's filters: "allowed_domains cannot be set together with excluded_domains in the same request".)
  const w = typeof webSearch === "object" ? webSearch : {};
  const list = (k) => (Array.isArray(w[k]) ? w[k].filter((x) => typeof x === "string" && x) : []);
  const filters = list("allowed_domains").length ? { allowed_domains: list("allowed_domains") } : list("excluded_domains").length ? { excluded_domains: list("excluded_domains") } : null;
  return [{ type: "web_search", ...(filters ? { filters } : {}) }, ...out];
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
 * CLAUDE CODE'S RETRIES FOR A MODEL CALL (the owner, 2026-11-11: "use the same claude code wording", after a live test where
 * xAI answered "Internal error during token generation" twice in a row and Coder, which tried once more, gave up; read from
 * Claude Code 2.1.322's own program): 10 more tries by default (its CLAUDE_CODE_MAX_RETRIES, at most 15; here
 * CODER_MAX_RETRIES), for 408, 409, 429, any 5xx and a connection that failed; each after the server's retry-after, else
 * 500 ms doubling each time up to 32 seconds, with up to a quarter more at random. While it waits, the chat says so in its
 * words: "API error · Retrying in 1s · attempt 1/10", the error itself from the third try on.
 */
export const MAX_RETRIES = 10, MAX_RETRIES_CLAMP = 15, RETRY_BASE_MS = 500, RETRY_MAX_MS = 32_000;
export const retryable = (status) => status === 408 || status === 409 || status === 429 || status >= 500;
export function maxRetriesOf(env) {
  const v = env && env.CODER_MAX_RETRIES;
  const n = v === undefined || v === null || String(v).trim() === "" ? NaN : Number(v);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, MAX_RETRIES_CLAMP) : MAX_RETRIES;
}
export function retryWaitMs(attempt, retryAfter = null, rand = Math.random) {
  const ra = retryAfter === null || retryAfter === undefined || String(retryAfter).trim() === "" ? NaN : Number(retryAfter);
  if (Number.isFinite(ra) && ra >= 0) return Math.min(Math.round(ra * 1000), 10 * 60_000);
  const base = Math.min(RETRY_BASE_MS * Math.pow(2, Math.max(1, attempt) - 1), RETRY_MAX_MS);
  return Math.round(base + rand() * 0.25 * base);
}
export const retryLine = ({ attempt, maxRetries, waitMs, error }) =>
  (attempt >= Math.min(3, maxRetries) ? String(error || "API error").replace(/\s+/g, " ").slice(0, 300) : "API error") +
  " · Retrying in " + Math.max(1, Math.ceil((Number(waitMs) || 0) / 1000)) + "s · attempt " + attempt + "/" + maxRetries;

/**
 * A `send` for `runCoder`: `{ model, messages, tools, tool_choice, onRetry } → { message, searches, usage }`.
 * Throws on a missing key, a failed call (after Claude Code's retries, above) or an answer with no message (the loop says so).
 * `onRetry({ attempt, maxRetries, waitMs, error })`: told before each wait.
 * `via` `{ url, headers }`: through Coder's Worker with the job's pass (no key here).
 */
export function coderSend(env, { fetchFn = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)), via = null, rand = Math.random } = {}) {
  const key = env && typeof env.XAI_API_KEY === "string" ? env.XAI_API_KEY : "";
  const maxRetries = maxRetriesOf(env);
  return async (req) => {
    if (!via && !key) throw Object.assign(new Error("no AI key in Coder's container"), { status: 0 });
    let withEffort = !!req.effort;
    const { instructions, input } = toResponsesInput(req.messages);
    // (A web search's own request, coder-websearch.mjs: xAI's search with its filters, its turns limited, max_turns, and
    // its sources asked for, include. 2026-11-14.)
    const make = () => JSON.stringify({ model: req.model || coderModel(env), instructions, input, ...(() => { const t = toResponsesTools(req.tools, { webSearch: req.webSearch || false }); return t.length ? { tools: t, tool_choice: req.tool_choice || "auto" } : {}; })(), ...(Number.isInteger(req.maxTurns) && req.maxTurns > 0 ? { max_turns: req.maxTurns } : {}), ...(Array.isArray(req.include) && req.include.length ? { include: req.include.filter((x) => typeof x === "string") } : {}), store: false, ...(withEffort ? { reasoning: { effort: req.effort } } : {}) });
    let body = make();
    let attempt = 0, effortAsked = false;
    const again = async (ms, error) => {
      attempt++;
      if (typeof req.onRetry === "function") { try { req.onRetry({ attempt, maxRetries, waitMs: ms, error }); } catch { /* the call goes on */ } }
      await wait(ms);
    };
    for (;;) {
      let r;
      try {
        r = await fetchFn(via ? via.url : CODER_ENDPOINT, {
          method: "POST", body,
          headers: via ? { ...via.headers, "content-type": "application/json" } : { authorization: "Bearer " + key, "content-type": "application/json" },
          signal: AbortSignal.timeout(CODER_CALL_MS),
        });
      } catch (e) {
        // A connection that failed is tried again; a call that ran past its own time limit is not.
        const timedOut = e && (e.name === "TimeoutError" || e.name === "AbortError");
        if (!timedOut && attempt < maxRetries) { await again(retryWaitMs(attempt + 1, null, rand), "Connection error: " + String((e && e.message) || e).slice(0, 200)); continue; }
        throw e;
      }
      if (retryable(r.status) && attempt < maxRetries) {
        const t = await r.text().catch(() => "");
        await again(retryWaitMs(attempt + 1, r.headers && typeof r.headers.get === "function" ? r.headers.get("retry-after") : null, rand), "AI call failed: " + r.status + (t ? " " + t.replace(/\s+/g, " ").slice(0, 160) : ""));
        continue;
      }
      // THE EFFORT SAFETY NET: a model that refuses the effort setting is asked
      // again without it (once), rather than failing every message.
      if (r.status === 400 && withEffort && !effortAsked) {
        const t = await r.text().catch(() => "");
        if (/reasoning|effort/i.test(t)) { withEffort = false; effortAsked = true; body = make(); continue; }
        throw Object.assign(new Error("AI call failed: 400 " + t.replace(/\s+/g, " ").slice(0, 160)), { status: 400 });
      }
      if (!r.ok) { const t = await r.text().catch(() => ""); throw Object.assign(new Error("AI call failed: " + r.status + (t ? " " + t.replace(/\s+/g, " ").slice(0, 160) : "")), { status: r.status }); }
      const j = await r.json();
      const { message, searches } = fromResponsesOutput(j);
      if (!message) throw new Error("the AI answered with no message");
      const u = j.usage || {};
      const web = (u.server_side_tool_usage_details && u.server_side_tool_usage_details.web_search_calls) || searches.length;
      // WHAT THE CALL REALLY USED (owner, 2026-11-10: "make sure it's actually on low", and the prompt cache): the input
      // tokens xAI's cache served (usage.input_tokens_details.cached_tokens, a quarter of the input price), the reasoning
      // tokens (usage.output_tokens_details.reasoning_tokens), the effort sent ("" when the safety net above had to leave it
      // out) and the effort xAI's answer says it used (its `reasoning.effort`, when it says).
      const num = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : 0);
      const said = j.reasoning && typeof j.reasoning.effort === "string" ? j.reasoning.effort.slice(0, 20) : "";
      // (xAI's own items too, in order, for a web search's result: its words before and after each search, coder-websearch.mjs.)
      return { message, searches, output: Array.isArray(j.output) ? j.output : [], usage: { in: u.input_tokens || 0, out: u.output_tokens || 0, searches: web || 0, cost_ticks: u.cost_in_usd_ticks || 0, cached: num(u.input_tokens_details && u.input_tokens_details.cached_tokens), reasoning: num(u.output_tokens_details && u.output_tokens_details.reasoning_tokens), effort: withEffort ? String(req.effort) : "", ...(said ? { effortSaid: said } : {}) } };
    }
  };
}

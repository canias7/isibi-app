// Grok, spoken to in Anthropic's shape.
//
// xAI has NO Anthropic-compatible endpoint — it is OpenAI-shaped
// (`/v1/chat/completions`), verified against their API reference 2026-08-21. So
// something has to translate, and the decision this file encodes is WHERE.
//
// AT THE BOUNDARY, AND ONLY THERE. Both build call sites read `j.stop_reason`,
// `j.content[].input` off a `tool_use` block, and the four Anthropic usage
// fields — and so do the truncation guard, the `shape` diagnostic, `pageCredits`
// and the ledger. Translating the RESPONSE back into that shape means not one
// line downstream knows which provider answered. The alternative — teaching
// every reader two shapes — is how a provider difference becomes a billing bug
// in a month.
//
// Pure functions, no I/O, like site-plan.mjs and site-images.mjs: the whole
// translation is driven in tests with no network and no Worker.

/** Where an xAI chat completion is created. */
export const XAI_ENDPOINT = "https://api.x.ai/v1/chat/completions";

/**
 * Is this model id one xAI serves?
 *
 * A PREFIX, not an allow-list, deliberately — the opposite of `modelsFor`. That
 * one reads a CALLER-CONTROLLED field, so it must refuse anything it does not
 * recognise. This reads a model id our own `BUILD_MODELS` put there, and the
 * question is only "which endpoint does this belong to". A new `grok-5` should
 * route to xAI without also needing an entry here; what it must NOT do is route
 * to xAI without a RATE, and `ratesFor` is the guard for that — it fails dear
 * and a test asserts every pickable model is priced.
 */
export function isXaiModel(model) {
  // A STRING, not anything stringifiable — `String(["grok-4.6"])` is
  // `"grok-4.6"`, and this codebase has shipped that coercion as a real bug
  // twice (a one-element array passing as a role, and again as an access level).
  // A model id is a string; anything else reaching here is a shape mistake, and
  // routing it to a provider on the strength of `String()` would send somebody
  // else's key a request built from it.
  return typeof model === "string" && /^grok/i.test(model);
}

/** Anthropic's system block list (or a bare string) as one plain string. */
function systemText(system) {
  if (typeof system === "string") return system;
  if (!Array.isArray(system)) return "";
  return system.map((b) => (b && typeof b.text === "string" ? b.text : "")).filter(Boolean).join("\n\n");
}

/**
 * One Anthropic content block as an OpenAI content part, or null to drop it.
 *
 * A PDF IS DROPPED AND SAID SO. Anthropic takes `{type:"document"}` natively and
 * the chat/completions shape has no equivalent, so an attached PDF cannot reach
 * Grok at all. Silently sending the rest would produce a build that ignored the
 * customer's price list with nothing anywhere saying why — so `toXaiRequest`
 * reports what it dropped and the caller can tell them.
 */
function contentPart(b) {
  if (!b || typeof b !== "object") return null;
  if (b.type === "text") return { type: "text", text: String(b.text || "") };
  if (b.type === "image" && b.source && b.source.type === "base64") {
    const mt = String(b.source.media_type || "image/png");
    return { type: "image_url", image_url: { url: `data:${mt};base64,${b.source.data || ""}` } };
  }
  return null;
}

/**
 * An Anthropic-shaped request as an xAI one.
 *
 * THE NESTED TOOL FORM (`{type:"function", function:{name, description,
 * parameters}}`) is what `/v1/chat/completions` accepts and what xAI's OpenAI
 * compatibility guarantees. Their function-calling page shows a FLAT form beside
 * a nested `tool_choice`, which is the Responses API's shape leaking into the
 * example — so this is the safer of the two, and it is in one place precisely so
 * a live 400 is a one-line flip rather than a hunt.
 *
 * `cache_control` markers are DROPPED rather than translated. xAI caches by
 * prefix automatically and takes `prompt_cache_key` for sticky routing instead;
 * there is no per-block marker to carry them to. What survives is the PROPERTY
 * the markers exist for — the big invariant blocks stay at the front of the
 * request — because the caller already orders them that way.
 */
export function toXaiRequest(req) {
  const r = req && typeof req === "object" ? req : {};
  const messages = [];
  const sys = systemText(r.system);
  if (sys) messages.push({ role: "system", content: sys });

  let droppedDocs = 0;
  for (const m of Array.isArray(r.messages) ? r.messages : []) {
    if (!m || typeof m !== "object") continue;
    if (typeof m.content === "string") { messages.push({ role: m.role || "user", content: m.content }); continue; }
    const parts = [];
    for (const b of Array.isArray(m.content) ? m.content : []) {
      const p = contentPart(b);
      if (p) parts.push(p);
      else if (b && b.type === "document") droppedDocs++;
    }
    // A single text part goes as a bare string: it is the shape every request
    // that uses no attachment produces, and the plainer body is the one least
    // likely to meet an edge in somebody else's parser.
    if (parts.length === 1 && parts[0].type === "text") messages.push({ role: m.role || "user", content: parts[0].text });
    else if (parts.length) messages.push({ role: m.role || "user", content: parts });
  }

  const tools = (Array.isArray(r.tools) ? r.tools : [])
    .filter((t) => t && t.name)
    .map((t) => ({ type: "function", function: { name: t.name, description: String(t.description || ""), parameters: t.input_schema || { type: "object", properties: {} } } }));

  const body = { model: r.model, messages, max_tokens: r.max_tokens };
  if (tools.length) body.tools = tools;
  // A FORCED TOOL STAYS FORCED. Every builder call uses `tool_choice` to compel
  // one specific tool, and the whole pipeline is built on the answer arriving as
  // structured output — degrading this to "auto" would let the model reply in
  // prose and turn a working build into the no-tool-call diagnostic.
  if (r.tool_choice && r.tool_choice.type === "tool" && r.tool_choice.name) {
    body.tool_choice = { type: "function", function: { name: r.tool_choice.name } };
  }
  // Sticky routing for the prefix cache. Keyed on the tool, which is what
  // identifies a call site here: the design call and the pages call have
  // different invariant prefixes and should not chase each other's cache.
  const key = (r.tool_choice && r.tool_choice.name) || (tools[0] && tools[0].function.name);
  if (key) body.prompt_cache_key = `gofarther-${key}`;
  return { body, droppedDocs };
}

/**
 * An xAI response as an Anthropic-shaped one.
 *
 * THE CACHED TOKENS ARE SUBTRACTED, and getting this backwards is a real
 * overcharge rather than a tidiness point. Anthropic's `input_tokens` EXCLUDES
 * cache reads and reports them separately, which is what lets `pageCredits`
 * price them at 0.1x; OpenAI's `prompt_tokens` INCLUDES them. Passing
 * `prompt_tokens` straight through as `in` prices every cached token at the
 * fresh rate — the exact 35%-overcharge bug this repo already shipped once by
 * summing the four kinds into one.
 *
 * `cacheWrite` is 0 because xAI HAS no write surcharge: a cached prefix is
 * written at the ordinary input rate, so those tokens are already inside `in`
 * where they belong. The rate table carries a `cacheWrite` for grok anyway, so
 * the column is priced rather than absent if that ever changes.
 *
 * ARGUMENTS ARE A JSON STRING and a broken one is not an empty answer. A tool
 * call cut off at the token ceiling carries half-written JSON, which is exactly
 * what `finish_reason: "length"` means — reported as `max_tokens` so the callers'
 * existing truncation guards fire unchanged. A parse failure WITHOUT length is a
 * malformed answer: no `tool_use` block, so the callers' `shape` diagnostic
 * describes it rather than a page half-built from a partial object.
 */
export function fromXaiResponse(j) {
  const res = j && typeof j === "object" ? j : {};
  const choice = (Array.isArray(res.choices) ? res.choices : [])[0] || {};
  const msg = choice.message || {};
  const u = res.usage || {};
  const cached = Math.max(0, Number((u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0) || 0);
  const prompt = Math.max(0, Number(u.prompt_tokens || 0) || 0);
  const usage = {
    input_tokens: Math.max(0, prompt - cached),
    output_tokens: Math.max(0, Number(u.completion_tokens || 0) || 0),
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: 0,
  };
  const truncated = choice.finish_reason === "length";
  const content = [];
  for (const tc of Array.isArray(msg.tool_calls) ? msg.tool_calls : []) {
    const fn = (tc && tc.function) || {};
    let input = null;
    try { input = JSON.parse(String(fn.arguments || "")); } catch { input = null; }
    // An argument list that parses to a non-object is not a tool call we can
    // read — `"null"`, `"[]"` and `"7"` all parse fine and none of them is an
    // input object. Dropping it here means the caller sees "no tool call",
    // which is true and is a case it already reports.
    if (input && typeof input === "object" && !Array.isArray(input)) {
      content.push({ type: "tool_use", name: String(fn.name || ""), input });
    }
  }
  if (typeof msg.content === "string" && msg.content) content.unshift({ type: "text", text: msg.content });
  return { content, usage, stop_reason: truncated ? "max_tokens" : (choice.finish_reason || "end_turn") };
}

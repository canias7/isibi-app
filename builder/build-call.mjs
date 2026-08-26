// THE MODEL CALL, AS A PLAIN MODULE — so the CONTAINER can make it.
//
// ── WHY THIS MOVED OUT OF worker.js ─────────────────────────────────────────
//
// The build's two long calls are the designer and the page writer, and both ran
// in the Worker. A queue consumer is guaranteed FIFTEEN MINUTES; run 38 spent
// 595,405ms in generation alone and died at the 780,000ms budget. So the step
// that takes ten minutes was on the side with a hard cap, while the side with
// NO fixed maximum runtime — the container — was used for the last ~100
// seconds. Cloudflare's own words for a container: "no fixed maximum runtime".
//
// Nothing here is new logic. `callBuilderModel` and `generateSitePages` are
// moved verbatim from `worker.js`, with ONE change: they take the two API keys
// instead of the Worker's `env`, because a container has no `env` binding and
// reaching for one is the difference between a module that runs in both places
// and a module that runs in neither.
//
// ── WHY KEYS RATHER THAN `env` ──────────────────────────────────────────────
//
// `env` is a Cloudflare binding object. Passing it would make this module
// importable only from a Worker, which is the exact coupling being removed —
// and it would hand the container far more than the two strings it needs
// (R2 buckets, the dispatch namespace, the service key). Two named strings is
// the whole surface, and a caller that forgets one gets a named throw rather
// than a request with an empty Authorization header, which some providers
// answer 200 to with degraded data.
import { XAI_ENDPOINT, isXaiModel, toXaiRequest, fromXaiResponse, xaiErrorDetail } from "./model-xai.mjs";

// HOW LONG ONE MODEL CALL MAY RUN. Ten minutes, and it composes with the build
// clock through `capMs` rather than adding to it — a pages call started at
// minute eleven gets what is LEFT rather than a fresh ten, which is the
// difference between a site with placeholder pictures and no site at all.
//
// Moved here with the call it bounds. `worker.js` re-exports it so nothing
// that reads it has to learn a second name.
export const BUILDER_CALL_MS = 600000;

/**
 * Call whichever provider this model belongs to, and answer in ANTHROPIC'S
 * SHAPE whichever one served it — so every line downstream is unchanged and
 * cannot tell the difference.
 *
 * @param {{anthropic?: string, xai?: string}} keys
 * @param {object} req      the Anthropic-shaped request
 * @param {object|null} budget  the BUILD's remaining time, or null
 *
 * THE BUDGET IS A THIRD ARGUMENT AND NOT A FIELD ON `req`, and the reason is
 * one line below: the Anthropic branch sends `JSON.stringify(req)`. A budget
 * parked on the request would be serialised as `"budget":{"totalMs":900000}` —
 * an unknown top-level field, which that API answers 400 to. Every Anthropic
 * build on the platform, refused, by the thing added to stop builds being
 * abandoned. The xAI branch happens to be safe (`toXaiRequest` names the fields
 * it sends), which is exactly what would have made this survive a test run and
 * bite live.
 *
 * Null on every path but the build, so the ordinary per-call bound is unchanged.
 *
 * THE TRANSPORT IS THE FOURTH PARAMETER, AND IT EXISTS BECAUSE `fetch` MEANS
 * TWO DIFFERENT THINGS ON THE TWO SIDES THAT SHARE THIS MODULE. In the Worker,
 * `fetch` is workerd's, which held ten-minute generations for months. In the
 * container it is Node's undici, whose HEADERS TIMEOUT is 300 seconds and is
 * not raisable from the fetch options — the AbortSignal above never gets a
 * say, because a non-streaming provider sends its headers only when the whole
 * generation is done. This brief measures 333–620s, so EVERY fired generation
 * died at exactly 300s as `TypeError: fetch failed` — no status, classified
 * `no-request`, refired into the same wall, and stopped. Runs 41 and 42, four
 * attempts, four identical deaths; the "identical 7–8 minute instance ages"
 * were this timeout plus the resume's look schedule, not the platform killing
 * anything. The repo already learned this ceiling once, in the harness — it is
 * the whole reason `postLong` exists — and stage 2 walked the same fetch into
 * the same wall by moving it into Node.
 *
 * `send` defaults to the global fetch, so the Worker is byte-for-byte
 * unchanged; the container passes its own `node:https` sender, which has no
 * headers timeout at all and honours the same AbortSignal.
 *
 * `opts.stream` ASKS THE PROVIDER TO STREAM, AND IT EXISTS BECAUSE THE WALL
 * THAT KILLED RUN 44 WAS NOT A TIMEOUT OF OURS AT ALL. With the undici ceiling
 * gone (longPost, no headers timeout), the fired generation still died — the
 * container's own log says how: `model call failed after 270036 ms — socket
 * hang up`. Something on the container's egress closes a connection that has
 * carried no application bytes for ~270 seconds, and a non-streaming
 * generation is exactly that: one silent connection for 333–620s while the
 * provider thinks. TCP keepalive at 30s did not save it, because keepalive
 * frames are not data and an L7 proxy does not count them.
 *
 * `stream: true` makes the provider send tokens AS THEY ARE GENERATED, so real
 * bytes cross the connection every few seconds and there is no quiet period to
 * kill. THE TRANSPORT AND EVERYTHING DOWNSTREAM ARE UNCHANGED: the sender
 * buffers until the connection closes (an SSE body is still one body), and the
 * transcript is reassembled HERE into the exact non-streaming shape, so
 * `fromXaiResponse` and every reader after it cannot tell the difference. The
 * Worker keeps sending exactly what it always sent — workerd's fetch held
 * ten-minute quiet generations for months, and a path that works is not
 * re-plumbed for a wall it does not have. Only the container asks to stream.
 */
export async function callBuilderModel(keys, req, budget = null, send = null, opts = null) {
  const doFetch = send || fetch;
  const streaming = !!(opts && opts.stream === true);
  const k = keys || {};
  // The sooner of the call's own ceiling and what is left of the build. See
  // `builder/build-budget.mjs`: the two bounds have to COMPOSE, or a pages call
  // starting at minute fourteen of a fifteen-minute budget gets another ten.
  const callMs = budget && typeof budget.capMs === "function" ? budget.capMs(BUILDER_CALL_MS) : BUILDER_CALL_MS;
  if (isXaiModel(req.model)) {
    if (!k.xai) {
      // NO `status`, DELIBERATELY. This used to synthesise 503, and the route
      // returns `upstream: (e && e.status) || null` under a comment saying that
      // field is "the numeric status from the model API and nothing else" — so
      // a key we forgot to set was byte-identical on the wire to xAI answering
      // 503 (overloaded), on the one field built to tell those apart. One is a
      // deploy we have to fix and the other is a retry that will work.
      //
      // The route's own `kind` carries `Error` for this, and the message names
      // the variable, so the diagnosis is not lost — it just stops pretending
      // to be a provider's answer.
      // "…is not set", NOT "…is not set on the Worker", which is what this said
      // until the container started making this call too. A message naming the
      // wrong side of the system is one somebody believes: they would go and
      // check the Worker's secrets, find the key perfectly well set, and be no
      // closer. The environment is named and where it is missing is left to the
      // log line that carries it.
      throw new Error("XAI_API_KEY is not set");
    }
    const { body, droppedDocs } = toXaiRequest(req);
    // `stream_options.include_usage` is the OpenAI-compatible way to get the
    // usage totals on a stream — without it the final chunk carries none and
    // the build would be billed off an empty object. xAI-only: Anthropic's API
    // refuses unknown top-level fields, so its branch must never gain this.
    const wireBody = streaming ? { ...body, stream: true, stream_options: { include_usage: true } } : body;
    const r = await doFetch(XAI_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${k.xai}`, "content-type": "application/json" },
      body: JSON.stringify(wireBody),
      signal: AbortSignal.timeout(callMs),
    });
    if (!r.ok) {
      const e = new Error("xai " + r.status);
      e.status = r.status;
      // TRANSLATED LIKE EVERYTHING ELSE AT THIS BOUNDARY. The raw body went
      // straight into `e.detail`, and `upstreamKind` downstream parses
      // Anthropic's envelope — so `upstreamType` was always null and `billing`
      // always false on a Grok build, and the one actionable message on the
      // build path could not fire. `toXaiRequest`/`fromXaiResponse` exist
      // precisely so no line downstream has to know which provider answered;
      // the error body was the half that never got the same treatment.
      e.detail = xaiErrorDetail(await r.text().catch(() => ""));
      throw e;
    }
    const out = fromXaiResponse(streaming ? await readXaiStream(r) : await r.json());
    // Reported rather than swallowed: a PDF cannot cross into the chat shape, so
    // a customer whose attached price list was ignored has a reason for it.
    if (droppedDocs) console.error("xai: dropped", droppedDocs, "document attachment(s) — no chat-shape equivalent");
    return out;
  }
  // ASKED THE SAME WAY THE xAI BRANCH IS, and it was not before this moved.
  // `env.ANTHROPIC_API_KEY` being unset sent `"x-api-key": undefined`, which
  // reaches the provider as the literal string and comes back 401 — a real
  // provider status wearing the costume of a bad key, on the branch whose
  // sibling already refuses by name for exactly that reason. The asymmetry was
  // invisible while both lived beside `env`; it is obvious once the keys are
  // two named arguments.
  if (!k.anthropic) throw new Error("ANTHROPIC_API_KEY is not set");
  const r = await doFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": k.anthropic, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    // `stream: true` and NOTHING ELSE — no `stream_options`, which is the
    // OpenAI-compatible spelling and an unknown top-level field here. This API
    // 400s unknown fields, so gaining it would refuse every Anthropic build on
    // the platform (the exact reason `budget` is an argument, not a field).
    body: JSON.stringify(streaming ? { ...req, stream: true } : req),
    signal: AbortSignal.timeout(callMs),
  });
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    e.status = r.status;
    e.detail = (await r.text().catch(() => "")).slice(0, 300);
    throw e;
  }
  return streaming ? readAnthropicStream(r) : r.json();
}

// ── SSE REASSEMBLY — a stream read back into the non-streaming shape ────────
//
// The point of streaming here is the WIRE, not the interface: bytes flowing
// every few seconds is what keeps the container's egress from killing a quiet
// connection at ~270s (run 44's `socket hang up`). Nothing downstream wants a
// stream — the parsers read one finished answer — so the transcript is folded
// back into exactly the shape the non-streaming call returns, and the seam is
// invisible from both sides.
//
// THE TRANSPORT ALREADY BUFFERS. `longPost` resolves when the connection
// closes with everything it carried, SSE or not — so there is no mid-flight
// parser, no chunk boundary handling against a live socket, and the whole of
// this is string processing that a unit test can drive with a literal.

/** Server-sent events out of a buffered transcript: `[{event, data}]`.
 * A data field spanning several `data:` lines is joined with newlines, per the
 * SSE spec; comment lines (`:`) and bare `event:` lines carry no data of their
 * own. An input with no `data:` lines at all answers an empty list, which the
 * callers read as "this was never SSE" and fall back to plain JSON. */
function sseEvents(text) {
  const out = [];
  let event = "", data = [];
  const flush = () => {
    if (data.length) out.push({ event, data: data.join("\n") });
    event = ""; data = [];
  };
  for (const raw of String(text == null ? "" : text).split(/\r?\n/)) {
    if (raw === "") { flush(); continue; }
    if (raw.startsWith(":")) continue;
    if (raw.startsWith("event:")) { event = raw.slice(6).trim(); continue; }
    if (raw.startsWith("data:")) { data.push(raw.slice(5).replace(/^ /, "")); continue; }
  }
  flush();
  return out;
}

/**
 * An OpenAI-shaped SSE transcript as the non-streaming response body.
 *
 * Answers null when the text holds no SSE at all (a provider that ignored the
 * stream flag answers plain JSON — read it as such rather than failing a build
 * over a flag). Otherwise `{error}` for a mid-stream error chunk, `{complete:
 * false}` for a transcript that ends without `[DONE]` or a finish_reason —
 * which is a connection cut mid-generation, the exact death being defended
 * against, and must NOT be read as "the model answered with nothing" — or
 * `{complete: true, response}` in the shape `fromXaiResponse` reads.
 *
 * TOOL-CALL ARGUMENTS ARE CONCATENATED BY INDEX. The arguments arrive as
 * string fragments across many chunks; the name and id arrive once on the
 * first. Assigning instead of appending keeps only the last fragment — a page
 * of TSX reduced to its final brace, which parses to nothing and reads
 * downstream as an empty tool call.
 */
export function joinXaiStream(text) {
  const evs = sseEvents(text);
  if (!evs.length) return null;
  let content = "", finish = null, usage = null, done = false, error = null;
  const calls = [];
  for (const ev of evs) {
    if (ev.data.trim() === "[DONE]") { done = true; continue; }
    let j; try { j = JSON.parse(ev.data); } catch { continue; }
    if (!j || typeof j !== "object") continue;
    if (j.error) { error = j; continue; }
    // Later wins: with `include_usage` the totals ride the final chunk, and
    // earlier chunks may carry `usage: null`, which the typeof guard drops.
    if (j.usage && typeof j.usage === "object") usage = j.usage;
    const ch = (Array.isArray(j.choices) ? j.choices : [])[0];
    if (!ch) continue;
    if (ch.finish_reason) finish = ch.finish_reason;
    const d = ch.delta || {};
    if (typeof d.content === "string") content += d.content;
    for (const tc of Array.isArray(d.tool_calls) ? d.tool_calls : []) {
      const i = Math.max(0, Number(tc && tc.index) || 0);
      const slot = calls[i] || (calls[i] = { function: { name: "", arguments: "" } });
      const fn = (tc && tc.function) || {};
      if (typeof fn.name === "string" && fn.name) slot.function.name = fn.name;
      if (typeof fn.arguments === "string") slot.function.arguments += fn.arguments;
    }
  }
  if (error) return { error };
  // `finish_reason: "length"` without [DONE] is still a finished response —
  // the provider stopped at its token cap and said so. Neither marker is a
  // wire that died mid-generation.
  if (!done && !finish) return { complete: false };
  return {
    complete: true,
    response: {
      choices: [{ message: { content: content || null, tool_calls: calls.filter(Boolean) }, finish_reason: finish || "stop" }],
      usage: usage || {},
    },
  };
}

/**
 * An Anthropic SSE transcript as the non-streaming message object.
 *
 * Same contract as `joinXaiStream`: null for not-SSE, `{error}` for the API's
 * own `error` event, `{complete: false}` for a cut wire, else the message.
 *
 * A TOOL_USE BLOCK WHOSE ACCUMULATED JSON DOES NOT PARSE IS AN INCOMPLETE
 * STREAM, never `input: {}`. Downstream reads an empty input as "the model
 * called the tool with nothing in it" — a recorded misdiagnosis this repo has
 * already paid for once — and the truth here is that bytes were lost. An
 * incomplete answer throws upstream with no status, which `retryHere` reads as
 * no-request and refires: the honest outcome for a half-delivered generation.
 */
export function joinAnthropicStream(text) {
  const evs = sseEvents(text);
  if (!evs.length) return null;
  let msg = null, stop = null, usageDelta = null, stopped = false, error = null;
  const blocks = [];
  for (const ev of evs) {
    let j; try { j = JSON.parse(ev.data); } catch { continue; }
    if (!j || typeof j !== "object") continue;
    const t = j.type || ev.event;
    if (t === "message_start") { msg = j.message && typeof j.message === "object" ? j.message : {}; continue; }
    if (t === "content_block_start") {
      const i = Math.max(0, Number(j.index) || 0);
      blocks[i] = { start: j.content_block && typeof j.content_block === "object" ? j.content_block : {}, json: "", text: "" };
      continue;
    }
    if (t === "content_block_delta") {
      const i = Math.max(0, Number(j.index) || 0);
      const b = blocks[i] || (blocks[i] = { start: {}, json: "", text: "" });
      const d = j.delta || {};
      if (d.type === "text_delta" && typeof d.text === "string") b.text += d.text;
      if (d.type === "input_json_delta" && typeof d.partial_json === "string") b.json += d.partial_json;
      continue;
    }
    if (t === "message_delta") {
      if (j.delta && j.delta.stop_reason) stop = j.delta.stop_reason;
      // The final cumulative output count rides here; the input and cache
      // counts came with message_start. Merged below, delta winning.
      if (j.usage && typeof j.usage === "object") usageDelta = j.usage;
      continue;
    }
    if (t === "message_stop") { stopped = true; continue; }
    if (t === "error") { error = j; continue; }
  }
  if (error) return { error };
  if (!msg || !stopped) return { complete: false };
  const content = [];
  for (const b of blocks) {
    if (!b) continue;
    const s = b.start || {};
    if (s.type === "tool_use") {
      let input = null;
      try { input = JSON.parse(b.json === "" ? "{}" : b.json); } catch { input = null; }
      if (!input || typeof input !== "object" || Array.isArray(input)) return { complete: false };
      content.push({ ...s, input });
    } else if (s.type === "text" || b.text) {
      content.push({ type: "text", text: String(s.text || "") + b.text });
    } else {
      // A block type this reader does not know (nothing on these calls emits
      // one today) passes through as its start block rather than vanishing.
      content.push(s);
    }
  }
  return {
    complete: true,
    response: {
      ...msg,
      content,
      stop_reason: stop || msg.stop_reason || null,
      usage: { ...(msg.usage || {}), ...(usageDelta || {}) },
    },
  };
}

/** The streamed xAI response, read and folded — or thrown, with the same
 * shapes the non-streaming path throws: a mid-stream error keeps the
 * provider's envelope in `detail` (so `upstreamKind` and the billing sentence
 * still fire), and a cut wire throws with NO status, which is the truth — the
 * request went out and no priced answer came back. */
async function readXaiStream(r) {
  const text = await r.text();
  const joined = joinXaiStream(text);
  // Not SSE at all: the provider (or a proxy) answered plain JSON despite the
  // flag. It is the non-streaming body — read it as one.
  if (joined === null) return JSON.parse(text);
  if (joined.error) {
    const e = new Error("xai stream error");
    e.detail = xaiErrorDetail(JSON.stringify(joined.error));
    throw e;
  }
  if (!joined.complete) throw new Error("model stream ended early — the connection closed mid-generation");
  return joined.response;
}

/** The streamed Anthropic response, same contract as `readXaiStream`. The
 * API's own `error` event already IS the envelope `upstreamKind` parses, so it
 * rides `detail` verbatim at the non-streaming path's cap. */
async function readAnthropicStream(r) {
  const text = await r.text();
  const joined = joinAnthropicStream(text);
  if (joined === null) return JSON.parse(text);
  if (joined.error) {
    const e = new Error("anthropic stream error");
    e.detail = JSON.stringify(joined.error).slice(0, 300);
    throw e;
  }
  if (!joined.complete) throw new Error("model stream ended early — the connection closed mid-generation");
  return joined.response;
}

/** WHICH ENVIRONMENT VARIABLE CARRIES WHICH KEY — the one list.
 *
 * Three places need to agree about these two names and they are on three
 * different sides of the system: the Worker READS them off its bindings, the
 * Worker SETS them on the container's start config, and the container TAKES
 * them out of its own `process.env`. Three spellings of one secret ends with a
 * key set under the name nothing reads — a build that fails at the provider
 * with a 401, on a deploy that reported success.
 *
 * It lives here rather than in `build-keys.mjs` because this is the leaf both
 * sides already import; `build-keys.mjs` is container-only, and the Worker
 * cannot import it (it deletes from `process.env` at evaluation time, and
 * workerd has no `process`).
 */
export const SECRET_ENV = { anthropic: "ANTHROPIC_API_KEY", xai: "XAI_API_KEY" };

/**
 * The two keys, off whatever object carries them.
 *
 * ONE READING, so the Worker and the container cannot disagree about which
 * environment variable is which. Both surfaces spell them the same way — the
 * Worker gets them as bindings, the container as `process.env` — so the
 * difference is only where the object comes from, and that is the caller's.
 */
export function keysFrom(src) {
  const s = src || {};
  return { anthropic: s[SECRET_ENV.anthropic], xai: s[SECRET_ENV.xai] };
}

/**
 * A CALL THE CONTAINER COULD NOT MAKE — may the Worker make it instead?
 *
 * @param {{status?: number|null, kind?: string}} fail  the container's `/model` refusal
 * @returns {boolean}
 *
 * THE ONE QUESTION IS WHETHER MONEY WAS SPENT. A model call that reached a
 * provider is paid for whatever came back, so repeating it here bills the
 * customer twice for one page of pages — and the answer it produces is not
 * better, it is the same answer from the same model.
 *
 * TWO REFUSALS, and each is a fact rather than a guess:
 *
 *  · A NUMERIC `status` IS A PROVIDER'S OWN ANSWER. 429, 400, 401, 529 — the
 *    request was made and the tokens for it are gone. It is also the shape
 *    `upstreamKind` downstream parses for the one actionable billing sentence,
 *    so swallowing it and retrying would replace a message the customer can act
 *    on with a second identical failure.
 *
 *  · A TIMEOUT MAY HAVE SPENT EVERYTHING. `AbortSignal.timeout` rejects with no
 *    response, so `status` is absent — but the provider was reached and may
 *    well be mid-generation. Retrying is a second ten-minute wait on top of the
 *    first, which is precisely the clock this whole change exists to get under.
 *
 * EVERYTHING ELSE MEANS NO REQUEST WAS EVER MADE: a key the container was not
 * given (a named throw before `fetch`), DNS or egress refusing the provider (a
 * `TypeError` out of `fetch`), the container answering something that is not a
 * model answer at all. Nothing was spent, so the Worker — which has the key and
 * has always made this call — makes it, and the build succeeds.
 *
 * THE ONE CASE THIS GETS WRONG, STATED: a container that reached the provider,
 * got an answer, and then failed while sending it back reports no status and no
 * timeout, so it is retried and the account pays for two calls. Bounded at one
 * extra call, against a build that otherwise fails outright on a container
 * hiccup — and it is REPORTED (`genVia`), so a platform where that keeps
 * happening is visible rather than merely expensive.
 */
export function retryHere(fail) {
  const f = fail || {};
  if (f.status) return false;
  // BOTH SPELLINGS. One abort reaches workerd as `TimeoutError` and Node as
  // `AbortError`, which is the same cross-engine difference `isCallTimeout`
  // already exists for — and this decides whether a customer is billed twice,
  // so it may not depend on which runtime happened to raise it.
  if (f.kind === "TimeoutError" || f.kind === "AbortError") return false;
  return true;
}

/**
 * The same two keys, in the shape a container's start config wants: the
 * ENVIRONMENT-VARIABLE names, and only the ones that carry a usable value.
 *
 * @param {object} src  the Worker's `env`
 * @returns {Record<string, string>}
 *
 * A MISSING KEY IS OMITTED RATHER THAN SENT AS `undefined`. The start config is
 * serialised, and a property whose value is undefined is not a variable set to
 * nothing — it is a variable that may arrive as the literal string
 * "undefined", which reaches the provider as a bad key and comes back 401. A
 * name that is simply absent produces the container's own named refusal
 * instead ("ANTHROPIC_API_KEY is not set"), which says what to fix.
 *
 * NON-MUTATING, unlike `takeKeys` in `build-keys.mjs`. That one removes what it
 * reads because its whole purpose is that nothing downstream can see it; this
 * one is handed the Worker's live bindings, which the Worker still needs.
 */
export function keyEnv(src) {
  const s = src || {};
  const out = {};
  for (const name of Object.values(SECRET_ENV)) {
    const v = s[name];
    if (typeof v === "string" && v) out[name] = v;
  }
  return out;
}

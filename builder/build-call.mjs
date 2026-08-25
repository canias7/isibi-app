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
import { pagesRequest } from "./page-gen.mjs";

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
 */
export async function callBuilderModel(keys, req, budget = null) {
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
      throw new Error("XAI_API_KEY is not set on the Worker");
    }
    const { body, droppedDocs } = toXaiRequest(req);
    const r = await fetch(XAI_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${k.xai}`, "content-type": "application/json" },
      body: JSON.stringify(body),
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
    const out = fromXaiResponse(await r.json());
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
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": k.anthropic, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(callMs),
  });
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    e.status = r.status;
    e.detail = (await r.text().catch(() => "")).slice(0, 300);
    throw e;
  }
  return r.json();
}

/**
 * Write this site's pages. THE LONG CALL — seven to twelve minutes on a real
 * brief, and the reason this module exists.
 *
 * @param {{anthropic?: string, xai?: string}} keys
 */
export async function generateSitePages(keys, brief, spec, brand, attachments, model, priorPages, mode, target, budget = null) {
  // One definition, shared with the eval harness — see pagesRequest. Restating
  // it here would mean the harness tunes against a different request from the
  // one production runs. Held in a const so the usage below can be stamped with
  // the model that was actually sent.
  const req = pagesRequest({ brief, spec, brand, attachments, model, priorPages, mode, target });
  // Provider decided in ONE place — see callBuilderModel. It answers in
  // Anthropic's shape whichever one served it, so every line below this is
  // unchanged and cannot tell the difference.
  //
  // `budget` is the BUILD's remaining time — see designSiteSchema. Passed as an
  // argument rather than set on `req`, which is shared with the eval AND is what
  // gets stringified onto the wire.
  const j = await callBuilderModel(keys, req, budget);
  const usage = j.usage || {};
  // CACHED TOKENS ARE REPORTED SEPARATELY AND WERE NOT BEING COUNTED. The
  // Anthropic API excludes cache hits from `input_tokens` and returns them as
  // `cache_read_input_tokens` / `cache_creation_input_tokens` — and PAGE_RULES,
  // the thing cache_control exists for, is ~18,300 tokens. So the meter saw a few
  // hundred input tokens on a call that really carried nineteen thousand, and on
  // a COLD cache the creation tokens bill at 1.25x and were invisible.
  //
  // Counted at face value rather than reweighted: a credit is 1/8000 of a dollar
  // of MODEL spend, and pretending a cache read costs a tenth would mean the
  // ledger tracks a different number from the invoice. Reweighting belongs in the
  // rate, not in the token count, and today the rate is one number.
  // THE FOUR KINDS, KEPT APART. Summing them into one `usedIn` is what made
  // pageCredits price a cache read at the fresh rate — ten times over, on the
  // largest input component — and overcharge a warm build by 35%. They are
  // priced 1x / 5x / 0.1x / 1.25x and only the caller can tell them apart.
  const used = {
    usage: {
      in: usage.input_tokens || 0,
      out: usage.output_tokens || 0,
      cacheRead: usage.cache_read_input_tokens || 0,
      cacheWrite: usage.cache_creation_input_tokens || 0,
      // The rate column, off the request that was sent. Under `auto` this call
      // is Sonnet while the designer above it is Opus, so a build's two usage
      // objects are priced from two different rows and must never be merged.
      model: req.model,
    },
  };
  // A tool_use block cut off at max_tokens carries half-written JSON, which parses
  // into a page whose last file is truncated. Treat it as a failed generation
  // rather than shipping a file that ends mid-expression.
  if (j.stop_reason === "max_tokens") return { input: null, truncated: true, ...used };
  const use = (Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use");
  // WHY THERE ARE NO PAGES, when there are none. Measured live 2026-08-04: a
  // build spent 9,810 output tokens and 22 credits, `validatePages` got null, and
  // the response could say only "the generator didn't produce a usable page" —
  // which does not distinguish a model that answered in prose from one that
  // called the tool with an empty argument. Third layer in a row where a failure
  // could not name itself; the pages are gone the moment this returns, so the
  // answer has to be captured here or not at all.
  //
  // `stop_reason` and the block TYPES only — never the text, which is
  // model-written prose about a customer's brief.
  const shape = use ? null : {
    stopReason: String(j.stop_reason || "").slice(0, 40),
    blocks: (Array.isArray(j.content) ? j.content : []).map((b) => String(b && b.type)).slice(0, 6),
  };
  return { input: (use && use.input) || null, ...(shape ? { shape } : {}), ...used };
}

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
  return { anthropic: s.ANTHROPIC_API_KEY, xai: s.XAI_API_KEY };
}

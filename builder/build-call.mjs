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
      // "…is not set", NOT "…is not set on the Worker", which is what this said
      // until the container started making this call too. A message naming the
      // wrong side of the system is one somebody believes: they would go and
      // check the Worker's secrets, find the key perfectly well set, and be no
      // closer. The environment is named and where it is missing is left to the
      // log line that carries it.
      throw new Error("XAI_API_KEY is not set");
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

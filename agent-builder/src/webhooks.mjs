/**
 * AN INBOUND DELIVERY, AND WHO IT BELONGS TO.
 *
 * ⚠ **THE ACCOUNT COMES FROM THE VERIFIED ENDPOINT, NEVER FROM THE PAYLOAD.** A delivery
 * is anonymous text from outside: anybody can POST anything to a URL, so a `tenant` field
 * in a body is a claim and not an identity. The endpoint's own row carries the account, and
 * the row is found by the id IN THE PATH and then PROVED by a signature made with that
 * row's secret — so the only thing a sender can influence is whether the check passes.
 *
 * **AND IT IS INDEPENDENT OF MODEL REASONING BY CONSTRUCTION.** Nothing here reads a
 * prompt, an instruction, a memory or a tool result, and no model runs before the verdict.
 * A delivery that fails is refused before anything is written, so there is nothing for a
 * model to have influenced.
 *
 * **THE SECRET NEVER LEAVES THIS MODULE.** `agent.webhook_for_delivery` is the one reader
 * of it in the database and `service_role`-only; here it lives in one local, is used for
 * one comparison, and is never returned, logged, put in an error or written into the event.
 * The refusals carry no value at all.
 */

/** How long a signed delivery stays fresh. A window is what bounds replay. */
export const DELIVERY_WINDOW_MS = 5 * 60 * 1000;

/** The headers a sender must set. Pinned as OUR grammar, so a rename is a deliberate one. */
export const SIG_HEADER = "x-agent-signature";
export const TS_HEADER = "x-agent-timestamp";
export const ID_HEADER = "x-agent-delivery";

/**
 * Every reason a delivery is refused, for a LOG. The response is one sentence and one
 * status, because naming the reason turns the endpoint into an oracle for probing ids and
 * secrets — the same rule `auth.mjs` already follows for a token.
 */
export const DELIVERY_REFUSALS = Object.freeze([
  "no-endpoint", "disabled", "no-signature", "no-timestamp", "stale", "bad-signature",
  "bad-body", "unavailable",
]);

const isText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * A constant-time comparison of two hex strings.
 *
 * **LENGTH IS COMPARED FIRST AND THAT IS NOT A LEAK.** A signature's length is fixed by the
 * algorithm, so a wrong length is a malformed header rather than a near-miss, and looping
 * over a shorter string would read past its end. What must not vary with the input is the
 * time taken over two signatures of the RIGHT length, which the loop below does not.
 */
export function sameSignature(a, b) {
  if (!isText(a) || !isText(b) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * What a sender signs: the timestamp, a dot, and the body EXACTLY as it arrived.
 *
 * ⚠ **THE RAW TEXT, NEVER A RE-SERIALISATION.** `JSON.stringify(JSON.parse(body))` reorders
 * keys and drops whitespace, so a signature made over the sender's bytes would not verify
 * against ours — and the failure would look like a wrong secret. The timestamp is INSIDE the
 * signed text, or moving it would not invalidate the signature and the window would bound
 * nothing.
 */
export async function signDelivery(secret, timestamp, rawBody) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = `${timestamp}.${rawBody}`;
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed)));
}

/**
 * Verify one delivery, and answer WHOSE it is.
 *
 * `readEndpoint(id)` is injected — it is the one call that reads a secret, and injecting it
 * keeps this whole function drivable with no database. It answers
 * `{id, tenantId, agentId, name, event, secret, enabled}` or null.
 */
export async function verifyDelivery({ id, headers, rawBody, readEndpoint, now = Date.now }) {
  if (typeof rawBody !== "string") return { ok: false, why: "bad-body" };
  const sig = headers?.get?.(SIG_HEADER) ?? null;
  const ts = headers?.get?.(TS_HEADER) ?? null;
  // ⚠ ASKED BEFORE THE ROW IS READ, so a delivery with no signature at all cannot make this
  // Worker read a secret out of the database — and a probe of invented ids costs nothing.
  if (!isText(sig)) return { ok: false, why: "no-signature" };
  if (!isText(ts)) return { ok: false, why: "no-timestamp" };
  const at = Number(ts);
  if (!Number.isFinite(at)) return { ok: false, why: "no-timestamp" };
  // THE WINDOW IS TWO-SIDED. A delivery timestamped in the future is as much a replay as one
  // timestamped in the past, and a one-sided window is one a sender can simply step over.
  if (Math.abs(now() - at) > DELIVERY_WINDOW_MS) return { ok: false, why: "stale" };

  let row;
  try { row = await readEndpoint(id); }
  // OUR OWN OUTAGE IS ITS OWN ANSWER. Reading it as "no such endpoint" would report every
  // customer's integration as deleted for as long as the database is unreachable.
  catch { return { ok: false, why: "unavailable" }; }
  if (!row || !isText(row.secret)) return { ok: false, why: "no-endpoint" };
  if (row.enabled !== true) return { ok: false, why: "disabled" };

  const want = await signDelivery(row.secret, ts, rawBody);
  if (!sameSignature(sig.trim().toLowerCase(), want)) return { ok: false, why: "bad-signature" };

  /**
   * ⚠ **THE DELIVERY'S IDENTITY IS THE SENDER'S WHEN IT GIVES ONE, AND THE SIGNATURE WHEN IT
   * DOES NOT.** `agent.events_one_per_key` is what makes a retried delivery one event, so a
   * key that changed per attempt would deduplicate nothing. The signature is deterministic
   * over (body, timestamp, secret), which is exactly what "the same delivery" means — and it
   * is not a secret: it is what the sender already put in a header.
   */
  const given = headers?.get?.(ID_HEADER) ?? null;
  return Object.freeze({
    ok: true,
    tenantId: row.tenantId,
    agentId: row.agentId,
    event: row.event,
    // THE NAME IS THE ENDPOINT'S, never the body's — the same rule as the account.
    key: isText(given) ? given.trim().slice(0, 200) : `sig:${want.slice(0, 64)}`,
  });
}

/**
 * THE DELIVERY HANDLER — its own named surface, and that is deliberate.
 *
 * ⚠ **`api.mjs`'s WHOLE SHAPE IS "verify the token, take the tenant from the verified
 * claims, scope the store, THEN look at what was asked", and this route has no token at
 * all.** Putting an unauthenticated route above that gate would make the gate something a
 * later reader has to notice an exception to, and the next route added above it would be
 * open by accident. One function, named for what it is, dispatched before the API — exactly
 * as `/health` is.
 *
 * What it takes is injected, so every branch is drivable with no database and no queue:
 * `readEndpoint` (the one reader of a secret), `emit` (which writes the event), `newId` and
 * `now`.
 */
export function makeDeliveryApi(opts = {}) {
  const readEndpoint = opts.readEndpoint;
  const emit = opts.emit;
  if (typeof readEndpoint !== "function") throw new TypeError("makeDeliveryApi: readEndpoint must be a function");
  if (typeof emit !== "function") throw new TypeError("makeDeliveryApi: emit must be a function");
  const newId = typeof opts.newId === "function" ? opts.newId : () => crypto.randomUUID();
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const onError = typeof opts.onError === "function" ? opts.onError : () => {};
  /** The largest delivery this will read at all. A body is somebody else's text. */
  const maxBody = Number.isInteger(opts.maxBody) && opts.maxBody > 0 ? opts.maxBody : 64 * 1024;

  /**
   * ⚠ **ONE SENTENCE AND ONE STATUS, WHATEVER WENT WRONG — the rule `auth.mjs` already
   * follows for a token.** Naming the reason turns this into an oracle: a sender could tell
   * a real endpoint id from an invented one, or a wrong secret from a disabled endpoint, by
   * reading the difference. The reason goes to the LOG, where it is what an operator needs.
   */
  const refused = () => new Response(JSON.stringify({ error: "this delivery was not accepted" }),
    { status: 401, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  return {
    /** `true` for a path this handler owns, so the dispatcher does not have to know the shape. */
    handles(path, method) {
      return method === "POST" && /^\/deliver\/[^/]+$/.test(path.replace(/\/+$/, "") || "/");
    },

    async fetch(request) {
      const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
      const id = /^\/deliver\/([^/]+)$/.exec(path)?.[1] ?? null;
      if (!id) return refused();

      // ⚠ THE RAW TEXT IS READ ONCE AND SIGNED OVER AS IT ARRIVED. A re-serialisation
      // reorders keys and drops whitespace, so a signature made over the sender's own bytes
      // would not verify and the failure would read as a wrong secret.
      let raw;
      try { raw = await request.text(); }
      catch { onError({ at: "deliver", id, reason: "bad-body" }); return refused(); }
      // BOUNDED BEFORE IT IS PARSED, because the bound is the whole point of having one.
      if (raw.length > maxBody) { onError({ at: "deliver", id, reason: "bad-body" }); return refused(); }

      const seen = await verifyDelivery({ id, headers: request.headers, rawBody: raw, readEndpoint, now });
      if (!seen.ok) { onError({ at: "deliver", id, reason: seen.why }); return refused(); }

      /**
       * ⚠ **THE PAYLOAD IS THE BODY AND NOTHING ELSE IS TAKEN FROM IT.** The account, the
       * agent and the event's NAME all come from the verified endpoint row — so a body
       * carrying `tenant`, `agent_id` or `name` changes nothing, and there is nowhere in this
       * call for one to be mistaken for authority. That is stronger than refusing those keys:
       * there is no code path that reads them at all.
       */
      let payload;
      try { payload = JSON.parse(raw); } catch { payload = null; }
      if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
        // A BODY THAT IS NOT AN OBJECT IS AN EVENT WITH NO DETAILS, not a refusal: the
        // signature proved who sent it, and `agent.events.payload` is an object by its own
        // constraint. Refusing would make a sender's formatting decide whether a real,
        // verified delivery counts.
        payload = {};
      }

      let answer;
      try {
        answer = await emit({
          tenant: seen.tenantId, agentId: seen.agentId, id: newId(),
          name: seen.event, payload, source: "webhook", key: seen.key,
        });
      } catch (e) {
        onError({ at: "deliver", id, reason: "unavailable", error: String(e?.message ?? e) });
        // OUR OWN OUTAGE IS A 503 AND NOT A 401. A sender retries a 503 and gives up on a
        // 401, so collapsing them would lose a delivery over a blip — and the `key` is what
        // makes that retry safe.
        return new Response(JSON.stringify({ error: "could not record this delivery" }),
          { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
      }

      /**
       * ⚠ **A DUPLICATE IS A SUCCESS, AND SAYS SO.** `agent.events_one_per_key` absorbs a
       * retried delivery, so `repeat: true` means this exact delivery is already recorded —
       * which is what a sender needs to hear to stop retrying. Reading it as a failure would
       * have a well-behaved sender retry for ever.
       */
      const ok = answer?.ok === true;
      if (!ok) {
        onError({ at: "deliver", id, reason: "refused", error: String(answer?.error ?? "unknown") });
        // A REFUSAL FROM THE DATABASE IS THE SENDER'S PROBLEM ONLY IF IT IS ABOUT THEIR
        // DELIVERY. `too-deep` is about a chain of our own making, so it is a 503: the
        // sender did nothing wrong and nothing they change would help.
        return new Response(JSON.stringify({ error: "this delivery could not be recorded" }),
          { status: answer?.error === "too-deep" ? 503 : 400,
            headers: { "content-type": "application/json", "cache-control": "no-store" } });
      }
      // ⚠ **202, NOT 200, AND NOTHING RUNS IN THIS REQUEST.** The event is committed; what it
      // triggers is the cron's own job, exactly as an accepted run's work is. Answering 200
      // would imply the automations it triggers have run.
      return new Response(JSON.stringify({ accepted: true, repeat: answer?.repeat === true }),
        { status: 202, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    },
  };
}

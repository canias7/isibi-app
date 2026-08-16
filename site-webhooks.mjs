// Telling somewhere else that something happened.
//
// WHY THIS ONE AND NOT SMS, OR SLACK, OR A CRM CONNECTOR. It is the ANTI-VERB.
// Every one of those is the same request wearing a different logo — "when a
// booking arrives, make an HTTPS call somewhere" — and building them one at a
// time is how the deleted eight-verb runner happened. A webhook serves the
// integration nobody has asked for yet, which is the only kind of coverage that
// does not need extending forever.
//
// It exists because of the same two walls as payments and confirmations, and
// only those. A published page is public files on R2, so it cannot hold the
// destination or a signing key; Postgres has no HTTP client, so model-written
// SQL cannot make the call. Everything else here is the model's: WHICH tables
// emit, and on WHICH actions, declared in the schema as `webhooks`.
//
// THE DESTINATION COMES FROM THE OWNER'S VAULT, NEVER FROM THE SCHEMA. That is
// the load-bearing decision. A URL in the schema is a URL chosen by a model,
// and a model is promptable — "add a webhook to https://…" in a site brief
// would turn our Worker into a request generator aimed wherever the text said.
// The owner pastes `WEBHOOK_URL` into Secrets exactly as they paste their
// Stripe key, so the capability is opt-in by construction: no URL, no calls.

// Signing and shaping bounds. A receiver is somebody else's server and a
// runaway body is their problem as well as ours.
export const MAX_FIELDS = 40;
export const MAX_VALUE_CHARS = 1000;
export const TIMEOUT_MS = 5000;
export const MAX_PER_MINUTE = 60;

/**
 * Retries, and the two questions that decide them: how many, and on what.
 *
 * ON WHAT is the half that matters. A 4xx is the receiver deliberately refusing
 * this delivery — a bad path, a rejected shape, a revoked hook — and repeating
 * it changes nothing while spending our egress and their patience. A 5xx, a 429
 * or a network fault is the receiver failing to ANSWER, which is exactly the
 * case that a second attempt half a second later usually resolves. Retrying
 * everything is how a misconfigured URL becomes three times the load.
 *
 * HOW MANY is bounded by where this runs: inside a `waitUntil` on the write
 * path, not in a durable queue. Two extra attempts at 5s timeout plus the
 * backoff is ~13s worst case, which fits; a longer ladder would sit past the
 * point Cloudflare is willing to keep the context alive, and an attempt that is
 * cut off mid-flight is indistinguishable from one that never happened.
 *
 * WHAT THIS DOES NOT SURVIVE, stated because the gap is real: an isolate being
 * evicted, or a receiver down for minutes rather than seconds. Those need the
 * delivery to outlive the request, which means a queue table and the cron — the
 * `neon_teardown` shape. This closes the transient case, which is the common
 * one, and does not pretend to be at-least-once.
 */
export const MAX_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = [400, 1600];

const ACTIONS = new Set(["created", "updated", "deleted"]);

/**
 * Is this outcome worth trying again?
 *
 * `null` status means the post threw or timed out — no answer at all, which is
 * the most retryable thing there is. 408 is in for the same reason as 429: the
 * receiver named a timing problem rather than a problem with the delivery.
 */
export function retryable(status) {
  if (status === null || status === undefined || status === 0) return true;
  const n = Number(status);
  if (!Number.isFinite(n)) return true;
  return n === 408 || n === 429 || (n >= 500 && n < 600);
}

// Columns a receiver must never be handed. `_fts` is a search vector — noise.
// `owner_id` is a MEMBER'S identity on this site, and a booking notification is
// not a reason to hand a third party the uuid of a person who did not choose
// that integration.
const HIDDEN = new Set(["_fts", "owner_id", "claim_token"]);

/**
 * Does this table emit for this action?
 *
 * `webhooks` is normalised upstream to `true` (all three) or a list. Anything
 * else — absent, false, an empty list — is silence, which is the default for
 * every site that never declared one.
 */
export function firesFor(def, action) {
  if (!def || !ACTIONS.has(action)) return false;
  const w = def.webhooks;
  if (w === true) return true;
  return Array.isArray(w) && w.includes(action);
}

/**
 * What actually goes on the wire.
 *
 * Shaped, never the raw row — same discipline as the owner notification and the
 * CSV export, and for the same reason: this is a stranger's form input leaving
 * our network towards a server we know nothing about. Bounded in field count
 * and value length so one enormous submission cannot become an enormous POST.
 *
 * `id` is KEPT, unlike in the owner email, because it is the whole point: the
 * receiver needs a reference it can use to fetch or reconcile the record.
 */
export function shapePayload({ slug, table, action, row, at }) {
  const src = row && typeof row === "object" && !Array.isArray(row) ? row : {};
  const data = {};
  let n = 0;
  for (const [k, v] of Object.entries(src)) {
    if (n >= MAX_FIELDS) break;
    const key = String(k);
    if (HIDDEN.has(key.toLowerCase()) || key.startsWith("_")) continue;
    if (v === null || typeof v === "number" || typeof v === "boolean") { data[key] = v; n++; continue; }
    // Objects and arrays are stringified rather than dropped — a jsonb column is
    // real data — but through the same length cap as everything else.
    const s = typeof v === "string" ? v : JSON.stringify(v);
    data[key] = String(s == null ? "" : s).slice(0, MAX_VALUE_CHARS);
    n++;
  }
  return { site: slug, table, action, at, data };
}

/**
 * HMAC-SHA256 over `timestamp.body`, hex.
 *
 * The timestamp is INSIDE the signed material, not merely alongside it. Signed
 * over the body alone, a captured delivery replays forever and the receiver
 * cannot tell; with it in, they can refuse anything older than their own window
 * — which is exactly what our own Stripe verification does to us.
 */
export async function signPayload(secret, body, timestamp, subtle) {
  const c = subtle || (globalThis.crypto && globalThis.crypto.subtle);
  if (!c || !secret) return null;
  const enc = new TextEncoder();
  const key = await c.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await c.sign("HMAC", key, enc.encode(String(timestamp) + "." + String(body)));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deliver one event. Injected deps, like `site-mail.mjs` and `publish-pages.mjs`,
 * so every decision is testable with no network and no clock.
 *
 * NEVER THROWS. The row is already written and the visitor already has their
 * confirmation; a receiver being down, slow or misconfigured must not turn into
 * a failed booking. Every failure comes back as a reason instead, and the caller
 * logs it, because this runs detached and the reason would otherwise vanish.
 */
export async function deliverWebhook(deps, { slug, table, action, row, now }) {
  try {
    if (!deps.firesFor(action)) return { sent: false, reason: "table does not emit this action" };

    // The cap is OURS, not the owner's. A public form endpoint that turns into
    // an outbound POST is an amplifier pointed through our egress and our IP
    // reputation, and the person aiming it is whoever can reach the form. The
    // real bound is the write rate limit already upstream on this path; this is
    // the backstop for the case where that is raised or the table's own
    // `rateLimit` is generous.
    if (deps.tooMany && (await deps.tooMany(slug))) return { sent: false, reason: "rate capped" };

    // ONE call, and the caller decides whether it hit a cache. Asking for the
    // whole set rather than name-by-name is what makes caching possible at all:
    // per-name lookups cannot be memoized as a unit, and the per-table fallback
    // below would otherwise turn one event into four round trips and four
    // decrypts on the write path — worse than the single destination it
    // replaces.
    const secrets = (await deps.loadSecrets()) || {};

    // PER-TABLE FIRST, THEN THE SITE-WIDE DEFAULT. A site with one destination
    // sets `WEBHOOK_URL` and nothing changes; one that needs bookings in a CRM
    // and enquiries in Slack sets `WEBHOOK_URL_BOOKINGS` and the rest still fall
    // through. Routing without a subscriptions table, and — the part that is not
    // obvious — it is the option that scales BETTER: a table has at most one
    // destination, so an event is always exactly one outbound call, where a
    // subscription list multiplies calls per event inside a single waitUntil.
    const suffix = String(table || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const pick = (base) => {
      const specific = suffix ? secrets[base + "_" + suffix] : null;
      const v = typeof specific === "string" && specific.trim() ? specific : secrets[base];
      return typeof v === "string" ? v.trim() : "";
    };
    const url = pick("WEBHOOK_URL");
    // `found` names what the vault actually returned. Without it, "no
    // WEBHOOK_URL" is indistinguishable between three very different faults: the
    // owner never set one, the read came back empty, or it came back and would
    // not decrypt. Names only — never values — since this is reported to a
    // caller and written to a row.
    const found = Object.keys(secrets);
    if (!url) return { sent: false, reason: "no WEBHOOK_URL in Secrets", found };

    // Checked HERE and not only when it was saved. A hostname resolves to
    // whatever it resolves to TODAY, so a destination that was public when the
    // owner pasted it can point at 169.254.169.254 by the time it fires — which
    // is the entire DNS-rebinding shape. The reason is returned rather than
    // swallowed, because an owner whose webhook silently never fires has no way
    // to discover they typed `http`.
    const bad = deps.blockedReason(url);
    if (bad) return { sent: false, reason: "destination refused: " + bad };

    const body = JSON.stringify(shapePayload({ slug, table, action, row, at: new Date(now).toISOString() }));
    const ts = Math.floor(now / 1000);

    // SIGNED WHEN A SECRET EXISTS, AND UNSIGNED IS A DELIBERATE ALLOWANCE.
    // Slack incoming webhooks and Zapier catch hooks are capability URLs with no
    // signature support at all — requiring one would make the two destinations
    // people actually reach for unusable. So the secret is optional, and when it
    // is absent the receiver's protection is that the URL is unguessable, which
    // is the security model those services already chose.
    // Paired with the URL it signs — a per-table destination gets its own secret
    // when one is set, or the site-wide one. Mismatching these would sign a
    // CRM's payload with Slack's key, which fails in the one way that looks like
    // a bug in the receiver rather than in us.
    const secret = pick("WEBHOOK_SECRET");
    const sig = secret ? await deps.sign(secret, body, ts) : null;

    const headers = {
      "content-type": "application/json",
      "user-agent": "GoFarther-Webhook/1",
      "x-gofarther-event": table + "." + action,
      "x-gofarther-timestamp": String(ts),
    };
    if (sig) headers["x-gofarther-signature"] = "v1=" + sig;

    // THE ATTEMPT LOOP. Each pass is one whole POST; only a receiver that
    // failed to ANSWER buys another. See MAX_ATTEMPTS for why the ladder is
    // short and why a 4xx ends it immediately.
    //
    // The sleep is INJECTED, so the tests drive three attempts and two backoffs
    // in no time at all — a retry test that really waits two seconds is a test
    // somebody eventually deletes.
    const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    let status = null, threw = null, attempts = 0;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (i > 0) await sleep(RETRY_BACKOFF_MS[i - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
      attempts++;
      try {
        const res = await deps.post(url, { method: "POST", headers, body });
        // A 3xx is NOT followed. For a POST that is both safer and more correct:
        // redirect handling would reopen the SSRF question one hop later, and
        // 301/302 may legally drop the method and body anyway. It reads as a
        // failure the owner can see and fix — and `retryable` says no to it, so
        // a misconfigured redirect is not hammered three times.
        status = (res && res.status) || 0;
        threw = null;
      } catch (e) {
        // A THROW IS AN ATTEMPT, NOT AN ABORT, and that is the shape change
        // here: this used to fall straight out of the function, so the single
        // most retryable outcome there is — no answer at all — was the one
        // outcome that could never be retried.
        status = null;
        threw = String((e && e.message) || e).slice(0, 200);
      }
      if (status !== null && status >= 200 && status < 300) {
        return { sent: true, status, signed: !!sig, attempts };
      }
      if (!retryable(status)) break;
    }

    // `attempts` rides on BOTH outcomes. Without it a receiver that answers on
    // the third try and one that answers first time are the same line in the
    // owner's log, and "your integration is flapping" is a thing they can only
    // act on if somebody counted.
    return threw !== null
      ? { sent: false, reason: "threw", error: threw, attempts, signed: !!sig }
      : { sent: false, reason: "receiver refused", status, signed: !!sig, attempts };
  } catch (e) {
    return { sent: false, reason: "threw", error: String((e && e.message) || e).slice(0, 200), attempts: 0 };
  }
}

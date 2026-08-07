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

const ACTIONS = new Set(["created", "updated", "deleted"]);

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

    const secrets = await deps.loadSecrets();
    const url = secrets && typeof secrets.WEBHOOK_URL === "string" ? secrets.WEBHOOK_URL.trim() : "";
    // Not an error, and not logged as one: no URL is the state of every site
    // that never wanted this, which is most of them.
    if (!url) return { sent: false, reason: "no WEBHOOK_URL in Secrets" };

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
    const secret = secrets && typeof secrets.WEBHOOK_SECRET === "string" ? secrets.WEBHOOK_SECRET.trim() : "";
    const sig = secret ? await deps.sign(secret, body, ts) : null;

    const headers = {
      "content-type": "application/json",
      "user-agent": "GoFarther-Webhook/1",
      "x-gofarther-event": table + "." + action,
      "x-gofarther-timestamp": String(ts),
    };
    if (sig) headers["x-gofarther-signature"] = "v1=" + sig;

    const res = await deps.post(url, { method: "POST", headers, body });
    // A 3xx is NOT followed. For a POST that is both safer and more correct:
    // redirect handling would reopen the SSRF question one hop later, and 301/302
    // may legally drop the method and body anyway. It reads as a failure the
    // owner can see and fix.
    const status = (res && res.status) || 0;
    return status >= 200 && status < 300
      ? { sent: true, status, signed: !!sig }
      : { sent: false, reason: "receiver refused", status, signed: !!sig };
  } catch (e) {
    return { sent: false, reason: "threw", error: String((e && e.message) || e).slice(0, 200) };
  }
}

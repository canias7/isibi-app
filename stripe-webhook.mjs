// The money path: who gets credited, how much, and whether the caller is Stripe.
//
// `/api/stripe/webhook` is the ONLY route on the platform with no Supabase auth
// — Stripe cannot hold a session — so this signature check is the entire thing
// standing between a stranger and `add_credits`. It ran untested because it
// lived inline in worker.js, which cannot be imported.
//
// Everything here is pure or takes its clock as an argument, so a forged
// signature, a replayed timestamp, a mid-rotation second secret and every
// minting decision can all be driven directly.

// Stripe's own tolerance. A replayed request older than this is refused even
// with a valid signature, which is what makes a captured webhook body useless
// to an attacker five minutes later.
export const SIGNATURE_TOLERANCE_SEC = 300;

// Stripe-Signature: t=<unix>,v1=<hmac>,v1=<hmac>,...
// Split on the FIRST "=" only: the scheme is k=v and a base64-ish value can
// legitimately contain one.
export function parseStripeSignature(header) {
  let t = 0;
  const v1s = [];
  for (const p of String(header || "").split(",")) {
    const i = p.indexOf("=");
    if (i <= 0) continue;
    const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
    if (k === "t") t = Number(v);
    else if (k === "v1") v1s.push(v);
  }
  return { t, v1s };
}

// Length-independent equality. The length XOR is what makes a short candidate
// fail: without it, charCodeAt past the end is NaN, NaN^x coerces to 0, and a
// truncated signature would compare equal to a prefix.
export function ctEq(a, b) {
  a = String(a); b = String(b);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/**
 * Is this request really from Stripe?
 *
 * `secrets` is a list because Stripe signs with EVERY active secret during a
 * rotation — accepting only the newest would 400 a legitimately paid invoice
 * for the whole overlap window, and Stripe would give up retrying.
 *
 * Returns a reason rather than a bare false so a rejection is diagnosable
 * without a debugger on a route nobody can replay by hand.
 */
export async function verifyStripeSignature({ header, raw, secrets, nowMs, tolerance = SIGNATURE_TOLERANCE_SEC }) {
  const list = (Array.isArray(secrets) ? secrets : [secrets]).filter(Boolean);
  if (!list.length) return { ok: false, reason: "no_secret" };
  const { t, v1s } = parseStripeSignature(header);
  if (!t || !Number.isFinite(t)) return { ok: false, reason: "no_timestamp" };
  if (!v1s.length) return { ok: false, reason: "no_signature" };
  // Absolute, so a timestamp from the future is refused too — a clock skew big
  // enough to matter is indistinguishable from a forged one.
  if (Math.abs((nowMs == null ? Date.now() : nowMs) / 1000 - t) > tolerance) return { ok: false, reason: "stale" };
  const signed = `${t}.${raw}`;
  for (const secret of list) {
    const want = await hmacHex(secret, signed);
    if (v1s.some((sig) => ctEq(want, sig))) return { ok: true, reason: "ok" };
  }
  return { ok: false, reason: "bad_signature" };
}

// Storage tier from the plan's monthly credit size (Plus 2000 / Pro 4000 / Max 8000).
export function tierForCredits(credits) {
  const n = Number(credits) || 0;
  return n >= 8000 ? "max" : n >= 4000 ? "pro" : "plus";
}

// Subscription metadata moved between API versions; all three shapes are live
// in the wild depending on which version signed the event.
function invoiceMeta(inv) {
  return (inv && inv.subscription_details && inv.subscription_details.metadata) ||
    (inv && inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.metadata) ||
    (inv && inv.lines && inv.lines.data && inv.lines.data[0] && inv.lines.data[0].metadata) ||
    {};
}

/**
 * What, if anything, this event should mint. `null` means "acknowledge and do
 * nothing" — the common case, since Stripe delivers far more event types than
 * we act on.
 *
 * The guards are the point. Every one of them is a way to mint credits nobody
 * paid for:
 *   - mode must be `payment` — a subscription's session mints via its invoice,
 *     so crediting both would double-grant the first month
 *   - payment_status must be `paid` — an unpaid/async session can complete
 *   - amount_paid must be > 0 on an invoice — a fully-discounted or $0
 *     proration invoice is `paid` and must NOT buy a month of credits
 *   - credits must come from metadata WE set at checkout, never from a price
 * `ref` is what makes the whole thing idempotent: add_credits is unique on it,
 * so a Stripe retry (or both invoice events) cannot double-credit.
 */
export function mintFromEvent(event) {
  const type = event && event.type;
  const obj = (event && event.data && event.data.object) || null;
  if (!obj) return null;

  if (type === "checkout.session.completed") {
    const uid = obj.metadata && obj.metadata.user_id;
    const credits = Number(obj.metadata && obj.metadata.credits) || 0;
    if (obj.mode !== "payment") return null;
    if (obj.payment_status !== "paid") return null;
    if (!obj.id || !uid || !(credits > 0)) return null;
    return { kind: "topup", uid, credits, cents: Number(obj.amount_total) || 0, ref: obj.id, tier: null };
  }

  // Memberships mint on invoice.paid — the first charge AND every renewal.
  // Deliberately NOT invoice.payment_succeeded: Stripe emits both for the same
  // invoice, and acting on both is a wasted call (harmless only because of `ref`).
  if (type === "invoice.paid") {
    const meta = invoiceMeta(obj);
    const uid = meta.user_id;
    const credits = Number(meta.credits) || 0;
    const paid = obj.status === "paid" || obj.paid === true;
    const amountPaid = Number(obj.amount_paid) || 0;
    if (!uid || !(credits > 0) || !paid || !(amountPaid > 0) || !obj.id) return null;
    return { kind: "membership", uid, credits, cents: amountPaid, ref: obj.id, tier: tierForCredits(credits) };
  }

  return null;
}

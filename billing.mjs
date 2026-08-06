// The purchase and refund decisions, out of worker.js so they can be tested.
//
// Everything here is a way to lose money in a direction nobody notices: a plan
// priced wrong, subscription metadata written where the renewal invoice will not
// carry it (so month two silently grants nothing), a live-subscription status
// missed so a second membership double-bills, or a refund handed out for a
// render that actually succeeded.

// Memberships. `credits` is the monthly refill AND what the webhook derives the
// storage tier from, so these numbers must stay aligned with tierForCredits.
export const PLANS = {
  "25": { cents: 2499, credits: 2000, name: "Go Farther Plus — 2,000 credits / month" },
  "50": { cents: 4999, credits: 4000, name: "Go Farther Pro — 4,000 credits / month" },
  "100": { cents: 9999, credits: 8000, name: "Go Farther Max — 8,000 credits / month" },
};

// One-time top-ups at $0.014/credit — dearer than membership on purpose.
export const TOPUPS = {
  "15": { cents: 1500, credits: 1070 },
  "30": { cents: 3000, credits: 2140 },
  "50": { cents: 5000, credits: 3570 },
  "75": { cents: 7500, credits: 5350 },
  "100": { cents: 10000, credits: 7140 },
};

// Stripe statuses that still bill, or still could. A status missing from this
// list is a subscription the duplicate-buy guard will not see, and a second
// membership means the customer is charged twice.
export const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "unpaid", "paused"];
export const isLiveSubscription = (s) => LIVE_SUBSCRIPTION_STATUSES.includes(s && s.status);

/**
 * Which product the caller asked for. `plan` wins over `topup` so a body
 * carrying both cannot buy a membership at a top-up price.
 */
export function selectPurchase(body) {
  const b = body && typeof body === "object" ? body : {};
  // hasOwn, not a plain lookup. `PLANS["__proto__"]` is Object.prototype and
  // `PLANS["constructor"]` is a function — both TRUTHY, so a plain lookup
  // accepted them as products and sent Stripe `unit_amount: "undefined"`. It
  // fails closed at Stripe today (502 "checkout failed"), but it is a
  // caller-controlled key reaching straight into an object lookup, which is one
  // refactor away from being worth more than a broken checkout.
  // Only a string or a number is a product key. `["15"]` stringifies to "15" and
  // would resolve at the right price, but a caller sending an array is confused,
  // and quietly agreeing with them is how a shape mismatch survives to the next
  // refactor.
  const pick = (table, key) => {
    if (typeof key !== "string" && typeof key !== "number") return null;
    const k = String(key);
    return Object.hasOwn(table, k) ? table[k] : null;
  };
  if (b.plan != null) {
    const p = pick(PLANS, b.plan);
    return p ? { kind: "plan", ...p } : null;
  }
  if (b.topup != null) {
    const t = pick(TOPUPS, b.topup);
    return t ? { kind: "topup", ...t } : null;
  }
  return null;
}

/**
 * The Stripe Checkout Session body.
 *
 * The metadata placement is the part that matters and the part that is invisible
 * when wrong. A membership must put user_id/credits under
 * `subscription_data[metadata]`, because that is what rides along onto EVERY
 * future invoice — put it in the session's own `metadata` instead and the first
 * month works, then every renewal arrives with no user to credit and the
 * customer silently stops being paid for what they are paying for.
 */
export function checkoutForm(purchase, user) {
  const sub = purchase.kind === "plan";
  const form = new URLSearchParams({
    mode: sub ? "subscription" : "payment",
    success_url: "https://gofarther.dev/?credits=added",
    cancel_url: "https://gofarther.dev/",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(purchase.cents),
  });
  if (sub) {
    form.set("line_items[0][price_data][recurring][interval]", "month");
    form.set("line_items[0][price_data][product_data][name]", purchase.name);
    form.set("subscription_data[metadata][user_id]", user.id);
    form.set("subscription_data[metadata][credits]", String(purchase.credits));
  } else {
    form.set("line_items[0][price_data][product_data][name]", purchase.credits.toLocaleString("en-US") + " Go Farther credits");
    form.set("metadata[user_id]", user.id);
    form.set("metadata[credits]", String(purchase.credits));
  }
  if (user.email) form.set("customer_email", user.email);
  return form;
}

// A fal status URL, and the request id inside it. Anchored and character-bounded
// so this cannot be pointed at an arbitrary host — the Worker fetches whatever
// it is given with the platform's FAL_KEY attached.
const FAL_STATUS = /^https:\/\/queue\.fal\.run\/[^?#]+\/requests\/([A-Za-z0-9_-]+)\/status\b/;
export function falRequestId(statusUrl) {
  const m = String(statusUrl || "").match(FAL_STATUS);
  return m ? m[1] : null;
}

/**
 * Should a failed generation be refunded?
 *
 *   "refund"  — fal reports a terminal failure; it did not bill us
 *   "inspect" — COMPLETED, but a completed job can still carry a client-error
 *               RESULT (a 422 on input validation). fal does not bill those
 *               either, and the status alone misses them
 *   "no"      — still running, or genuinely done
 *
 * Getting this wrong in either direction costs real money: refund a successful
 * render and we paid for it; refuse a failed one and the user paid for nothing.
 */
export function refundVerdict(status) {
  const s = String(status || "").toUpperCase();
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(s)) return "refund";
  if (s === "COMPLETED") return "inspect";
  return "no";
}

/**
 * Given the result fetch for a COMPLETED job, is it actually a failure?
 *
 * Only a 4xx means the render terminally failed validation. 2xx is real output.
 * 5xx and network errors are transient — the result may still be retrievable,
 * and refunding on those would refund successful renders during an outage.
 */
export function refundOnResultStatus(httpStatus) {
  const n = Number(httpStatus);
  return Number.isFinite(n) && n >= 400 && n < 500;
}

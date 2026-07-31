// Purchases and refunds — the decisions that move real money.
//
// Each of these fails silently in production. A membership whose metadata sits
// in the wrong object bills month two and grants nothing, and neither the
// customer nor the logs notice until someone asks where their credits went. A
// refund verdict that is too generous pays for renders that succeeded.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLANS, TOPUPS, LIVE_SUBSCRIPTION_STATUSES, isLiveSubscription,
  selectPurchase, checkoutForm, falRequestId, refundVerdict, refundOnResultStatus,
} from "../billing.mjs";
import { tierForCredits } from "../stripe-webhook.mjs";

const USER = { id: "u1", email: "buyer@example.com" };

// ------------------------------------------------------------ the price list

test("plan prices and credit amounts are what is advertised", () => {
  assert.deepEqual(
    Object.entries(PLANS).map(([k, v]) => [k, v.cents, v.credits]),
    [["25", 2499, 2000], ["50", 4999, 4000], ["100", 9999, 8000]],
  );
});

test("every plan lands on the tier its name promises", () => {
  // The webhook derives storage tier from the credit COUNT, not the price, so a
  // plan and its tier can drift apart with nothing to catch it. Plus/Pro/Max in
  // the names have to match what tierForCredits returns.
  assert.equal(tierForCredits(PLANS["25"].credits), "plus");
  assert.equal(tierForCredits(PLANS["50"].credits), "pro");
  assert.equal(tierForCredits(PLANS["100"].credits), "max");
});

test("top-ups really are dearer per credit than membership", () => {
  // The whole pricing story. If a top-up ever became the cheaper way to buy
  // credits, memberships would stop making sense and nobody would notice.
  const centsPer = (x) => x.cents / x.credits;
  const dearestPlan = Math.max(...Object.values(PLANS).map(centsPer));
  const cheapestTopup = Math.min(...Object.values(TOPUPS).map(centsPer));
  assert.ok(cheapestTopup > dearestPlan,
    `cheapest top-up ${cheapestTopup.toFixed(4)}¢/credit must exceed the dearest plan ${dearestPlan.toFixed(4)}¢/credit`);
  // ~$0.014/credit, i.e. 1.4 cents.
  assert.ok(Object.values(TOPUPS).every((t) => centsPer(t) > 1.35 && centsPer(t) < 1.45),
    JSON.stringify(Object.values(TOPUPS).map((t) => +centsPer(t).toFixed(4))));
});

test("no plan or top-up is free", () => {
  for (const [k, v] of [...Object.entries(PLANS), ...Object.entries(TOPUPS)]) {
    assert.ok(v.cents > 0 && v.credits > 0, k);
  }
});

// ------------------------------------------------------------ what was bought

test("picks the plan the caller asked for", () => {
  assert.deepEqual(selectPurchase({ plan: "50" }), { kind: "plan", ...PLANS["50"] });
  assert.deepEqual(selectPurchase({ topup: "30" }), { kind: "topup", ...TOPUPS["30"] });
  assert.deepEqual(selectPurchase({ plan: 50 }), { kind: "plan", ...PLANS["50"] }, "a numeric key still resolves");
});

test("a plan beats a top-up when both are sent", () => {
  // Otherwise a body carrying {plan:"100", topup:"15"} could buy the Max
  // membership at the $15 price.
  const p = selectPurchase({ plan: "100", topup: "15" });
  assert.equal(p.kind, "plan");
  assert.equal(p.cents, 9999);
});

test("an unknown or forged product is refused", () => {
  for (const body of [{}, null, undefined, "nope", { plan: "9999" }, { topup: "1" },
    { plan: "__proto__" }, { plan: "constructor" }, { plan: "toString" },
    { plan: { cents: 1, credits: 999999 } }, { topup: ["15"] }]) {
    assert.equal(selectPurchase(body), null, JSON.stringify(body));
  }
});

test("a caller cannot name their own price", () => {
  // The only numbers that reach Stripe come from the tables above.
  assert.equal(selectPurchase({ plan: "25", cents: 1, credits: 99999 }).cents, 2499);
  assert.equal(selectPurchase({ plan: "25", cents: 1, credits: 99999 }).credits, 2000);
});

// ------------------------------------------------------------ the Stripe body

test("a membership is a subscription with monthly recurrence", () => {
  const f = checkoutForm(selectPurchase({ plan: "25" }), USER);
  assert.equal(f.get("mode"), "subscription");
  assert.equal(f.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "2499");
});

test("membership metadata rides on the SUBSCRIPTION, not the session", () => {
  // The invisible bug this exists for: session metadata is not copied onto
  // renewal invoices. Put it there and month one credits, then every renewal
  // arrives with no user_id and mints nothing — the customer keeps paying and
  // silently stops receiving credits.
  const f = checkoutForm(selectPurchase({ plan: "100" }), USER);
  assert.equal(f.get("subscription_data[metadata][user_id]"), "u1");
  assert.equal(f.get("subscription_data[metadata][credits]"), "8000");
  assert.equal(f.get("metadata[user_id]"), null, "session-level metadata would not survive to the renewal invoice");
});

test("a top-up is a one-time payment with session metadata", () => {
  // The mirror image: a top-up has no invoice to carry metadata, so it MUST be
  // on the session — that is what checkout.session.completed reads.
  const f = checkoutForm(selectPurchase({ topup: "50" }), USER);
  assert.equal(f.get("mode"), "payment");
  assert.equal(f.get("metadata[user_id]"), "u1");
  assert.equal(f.get("metadata[credits]"), "3570");
  assert.equal(f.get("subscription_data[metadata][user_id]"), null);
  assert.equal(f.get("line_items[0][price_data][recurring][interval]"), null, "a top-up must never recur");
});

test("the credits in the metadata match the product bought", () => {
  // The webhook mints whatever this says. A mismatch here IS the amount granted.
  for (const k of Object.keys(PLANS)) {
    const f = checkoutForm(selectPurchase({ plan: k }), USER);
    assert.equal(f.get("subscription_data[metadata][credits]"), String(PLANS[k].credits), "plan " + k);
    assert.equal(f.get("line_items[0][price_data][unit_amount]"), String(PLANS[k].cents), "plan " + k);
  }
  for (const k of Object.keys(TOPUPS)) {
    const f = checkoutForm(selectPurchase({ topup: k }), USER);
    assert.equal(f.get("metadata[credits]"), String(TOPUPS[k].credits), "topup " + k);
    assert.equal(f.get("line_items[0][price_data][unit_amount]"), String(TOPUPS[k].cents), "topup " + k);
  }
});

test("a user with no email still gets a valid session", () => {
  const f = checkoutForm(selectPurchase({ topup: "15" }), { id: "u2" });
  assert.equal(f.get("customer_email"), null);
  assert.equal(f.get("metadata[user_id]"), "u2");
});

// ------------------------------------------------------ duplicate-buy guard

test("every status that still bills counts as live", () => {
  // A status missing here is a subscription the duplicate guard cannot see, and
  // a second membership means the customer is charged twice a month.
  for (const status of ["active", "trialing", "past_due", "unpaid", "paused"]) {
    assert.equal(isLiveSubscription({ status }), true, status);
  }
  assert.equal(LIVE_SUBSCRIPTION_STATUSES.length, 5);
});

test("finished subscriptions are not live", () => {
  for (const status of ["canceled", "incomplete", "incomplete_expired", "ended", undefined, null]) {
    assert.equal(isLiveSubscription({ status }), false, String(status));
  }
  assert.equal(isLiveSubscription(null), false);
  assert.equal(isLiveSubscription({}), false);
});

// ------------------------------------------------------------ refunds

test("pulls the request id out of a fal status url", () => {
  assert.equal(falRequestId("https://queue.fal.run/fal-ai/flux/requests/abc-123_XY/status"), "abc-123_XY");
  assert.equal(falRequestId("https://queue.fal.run/a/b/c/requests/r1/status?logs=1"), "r1");
});

test("refuses a url that is not fal's queue", () => {
  // The Worker fetches whatever this points at with the platform's FAL_KEY
  // attached, so anything but fal is a credential-leak primitive.
  for (const u of [
    "https://evil.example.com/requests/x/status",
    "http://queue.fal.run/a/requests/x/status",
    "https://queue.fal.run.evil.com/a/requests/x/status",
    "https://queue.fal.run/a/requests/x/statuses",
    "https://attacker.com/#https://queue.fal.run/a/requests/x/status",
    "", null, undefined, 42, {},
  ]) {
    assert.equal(falRequestId(u), null, JSON.stringify(u));
  }
});

test("a terminal failure earns a refund", () => {
  for (const s of ["FAILED", "ERROR", "CANCELED", "CANCELLED", "failed", "Error"]) {
    assert.equal(refundVerdict(s), "refund", s);
  }
});

test("a still-running job is never refunded", () => {
  // Refunding here would give credits back for a render that then succeeds.
  for (const s of ["IN_QUEUE", "IN_PROGRESS", "", null, undefined, "SOMETHING_NEW"]) {
    assert.equal(refundVerdict(s), "no", String(s));
  }
});

test("COMPLETED gets a second look, not an automatic pass", () => {
  // A completed job can still carry a client-error result (a 422 on input
  // validation). fal does not bill those, so charging the user would be wrong.
  assert.equal(refundVerdict("COMPLETED"), "inspect");
});

test("only a 4xx result means the render terminally failed", () => {
  assert.equal(refundOnResultStatus(422), true);
  assert.equal(refundOnResultStatus(400), true);
  assert.equal(refundOnResultStatus(499), true);
  // 2xx is real output — refunding it gives away a render we paid for.
  assert.equal(refundOnResultStatus(200), false);
  assert.equal(refundOnResultStatus(206), false);
  // 5xx and network trouble are transient; the result may still be retrievable,
  // and refunding during an outage would refund successful renders.
  assert.equal(refundOnResultStatus(500), false);
  assert.equal(refundOnResultStatus(502), false);
  assert.equal(refundOnResultStatus(NaN), false);
  assert.equal(refundOnResultStatus(undefined), false);
});

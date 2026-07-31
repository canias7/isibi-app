// The only unauthenticated route on the platform, and the one that mints money.
//
// Two distinct jobs are tested here. First: is the caller really Stripe — this
// signature check is all that stands between a stranger and `add_credits`.
// Second: given a genuine event, what should be minted — every guard in
// mintFromEvent is a way to hand out credits nobody paid for.
//
// The HMAC is the real one (WebCrypto, same primitive the Worker uses); only the
// clock is injected, because a replay test needs to move time.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStripeSignature, ctEq, hmacHex, verifyStripeSignature, mintFromEvent,
  tierForCredits, SIGNATURE_TOLERANCE_SEC,
} from "../stripe-webhook.mjs";

const SECRET = "whsec_test_1234567890";
const NOW = 1_780_000_000_000; // fixed clock; Date.now() is never consulted
const T = Math.floor(NOW / 1000);

const sign = async (raw, secret = SECRET, t = T) => `t=${t},v1=${await hmacHex(secret, `${t}.${raw}`)}`;

// ------------------------------------------------------------ header parsing

test("parses a Stripe-Signature header", () => {
  assert.deepEqual(parseStripeSignature("t=123,v1=abc"), { t: 123, v1s: ["abc"] });
});

test("keeps every v1 during a secret rotation", () => {
  // Stripe signs with ALL active secrets while a rotation overlaps. Keeping only
  // the last would 400 a legitimately paid invoice for the whole window.
  assert.deepEqual(parseStripeSignature("t=123,v1=aaa,v1=bbb,v0=ccc"), { t: 123, v1s: ["aaa", "bbb"] });
});

test("splits on the first = only", () => {
  // A base64-ish value can legitimately contain one; splitting on every "="
  // would truncate the signature and reject a real request.
  assert.deepEqual(parseStripeSignature("t=1,v1=ab=cd"), { t: 1, v1s: ["ab=cd"] });
});

test("survives junk instead of a header", () => {
  for (const bad of [undefined, null, "", "garbage", ",,,", "=nope", "v1="]) {
    const r = parseStripeSignature(bad);
    assert.ok(typeof r.t === "number" && Array.isArray(r.v1s), JSON.stringify(bad));
  }
});

// ------------------------------------------------------------ the compare

test("constant-time compare matches only identical strings", () => {
  assert.equal(ctEq("abc", "abc"), true);
  assert.equal(ctEq("abc", "abd"), false);
  assert.equal(ctEq("", ""), true);
});

test("a truncated signature is not equal to a prefix", () => {
  // Without the length XOR, charCodeAt past the end is NaN and NaN^x coerces to
  // 0 — so "abc" would compare equal to "abcdef". That is a forgery.
  assert.equal(ctEq("abcdef", "abc"), false);
  assert.equal(ctEq("abc", "abcdef"), false);
});

// ------------------------------------------------------------ verification

test("accepts a genuine signature", async () => {
  const raw = '{"id":"evt_1","type":"invoice.paid"}';
  const r = await verifyStripeSignature({ header: await sign(raw), raw, secrets: [SECRET], nowMs: NOW });
  assert.deepEqual(r, { ok: true, reason: "ok" });
});

test("rejects a signature made with a different secret", async () => {
  const raw = '{"id":"evt_1"}';
  const header = await sign(raw, "whsec_attacker");
  const r = await verifyStripeSignature({ header, raw, secrets: [SECRET], nowMs: NOW });
  assert.deepEqual(r, { ok: false, reason: "bad_signature" });
});

test("rejects a genuine signature over a DIFFERENT body", async () => {
  // The attack this exists for: capture a real webhook, swap the body for one
  // that credits your own user id, keep the signature.
  const header = await sign('{"amount":100}');
  const r = await verifyStripeSignature({ header, raw: '{"amount":100000}', secrets: [SECRET], nowMs: NOW });
  assert.equal(r.ok, false);
});

test("the timestamp is part of what is signed", async () => {
  // Re-labelling a captured signature with a fresh `t` must not make it valid,
  // or the staleness window would be trivially bypassable.
  const raw = '{"id":"evt_1"}';
  const real = await sign(raw, SECRET, T - 1000);
  const sig = real.split("v1=")[1];
  const r = await verifyStripeSignature({ header: `t=${T},v1=${sig}`, raw, secrets: [SECRET], nowMs: NOW });
  assert.equal(r.ok, false, "a re-stamped signature is a forgery");
});

test("rejects a replay from outside the tolerance", async () => {
  const raw = '{"id":"evt_1"}';
  const old = T - SIGNATURE_TOLERANCE_SEC - 1;
  const r = await verifyStripeSignature({ header: await sign(raw, SECRET, old), raw, secrets: [SECRET], nowMs: NOW });
  assert.deepEqual(r, { ok: false, reason: "stale" });
});

test("accepts right up to the tolerance", async () => {
  const raw = '{"id":"evt_1"}';
  const edge = T - SIGNATURE_TOLERANCE_SEC;
  const r = await verifyStripeSignature({ header: await sign(raw, SECRET, edge), raw, secrets: [SECRET], nowMs: NOW });
  assert.equal(r.ok, true);
});

test("rejects a timestamp too far in the FUTURE", async () => {
  // Absolute window on purpose: a clock skew big enough to matter is
  // indistinguishable from an attacker post-dating a capture.
  const raw = '{"id":"evt_1"}';
  const ahead = T + SIGNATURE_TOLERANCE_SEC + 1;
  const r = await verifyStripeSignature({ header: await sign(raw, SECRET, ahead), raw, secrets: [SECRET], nowMs: NOW });
  assert.deepEqual(r, { ok: false, reason: "stale" });
});

test("either secret works mid-rotation", async () => {
  const raw = '{"id":"evt_1"}';
  const secrets = ["whsec_old", "whsec_new"];
  for (const s of secrets) {
    const r = await verifyStripeSignature({ header: await sign(raw, s), raw, secrets, nowMs: NOW });
    assert.equal(r.ok, true, s);
  }
});

test("refuses everything when no secret is configured", async () => {
  // Fails closed. An empty secret must never make the HMAC trivially matchable.
  const raw = '{"id":"evt_1"}';
  for (const secrets of [[], [""], null, undefined]) {
    const r = await verifyStripeSignature({ header: await sign(raw), raw, secrets, nowMs: NOW });
    assert.deepEqual(r, { ok: false, reason: "no_secret" }, JSON.stringify(secrets));
  }
});

test("refuses a header with no timestamp or no signature", async () => {
  const raw = "{}";
  assert.equal((await verifyStripeSignature({ header: "v1=abc", raw, secrets: [SECRET], nowMs: NOW })).reason, "no_timestamp");
  assert.equal((await verifyStripeSignature({ header: `t=${T}`, raw, secrets: [SECRET], nowMs: NOW })).reason, "no_signature");
  assert.equal((await verifyStripeSignature({ header: "", raw, secrets: [SECRET], nowMs: NOW })).reason, "no_timestamp");
  assert.equal((await verifyStripeSignature({ header: "t=nope,v1=abc", raw, secrets: [SECRET], nowMs: NOW })).reason, "no_timestamp");
});

// ------------------------------------------------------------ what gets minted

const session = (over = {}) => ({
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", mode: "payment", payment_status: "paid", amount_total: 1500, metadata: { user_id: "u1", credits: "1070" }, ...over } },
});
const invoice = (over = {}, metaOver = {}) => ({
  type: "invoice.paid",
  data: { object: { id: "in_1", status: "paid", amount_paid: 2499, subscription_details: { metadata: { user_id: "u1", credits: "2000", ...metaOver } }, ...over } },
});

test("a paid top-up session mints", () => {
  assert.deepEqual(mintFromEvent(session()), { kind: "topup", uid: "u1", credits: 1070, cents: 1500, ref: "cs_1", tier: null });
});

test("a top-up grants NO storage tier", () => {
  // Only memberships grant storage. A top-up-only buyer has cap 0 — deliberate,
  // and it would be silently reversed by returning a tier here.
  assert.equal(mintFromEvent(session()).tier, null);
});

test("a subscription's session does not mint — its invoice does", () => {
  // Both events arrive for a new membership. Crediting both would double-grant
  // the first month.
  assert.equal(mintFromEvent(session({ mode: "subscription" })), null);
});

test("an unpaid or incomplete session does not mint", () => {
  for (const over of [{ payment_status: "unpaid" }, { payment_status: "no_payment_required" }, { payment_status: undefined }]) {
    assert.equal(mintFromEvent(session(over)), null, JSON.stringify(over));
  }
});

test("a session with no user, no credits or no id does not mint", () => {
  assert.equal(mintFromEvent(session({ metadata: { credits: "1070" } })), null, "no user_id");
  assert.equal(mintFromEvent(session({ metadata: { user_id: "u1" } })), null, "no credits");
  assert.equal(mintFromEvent(session({ metadata: { user_id: "u1", credits: "0" } })), null, "zero credits");
  assert.equal(mintFromEvent(session({ metadata: { user_id: "u1", credits: "-500" } })), null, "negative credits");
  assert.equal(mintFromEvent(session({ id: undefined })), null, "no id to be idempotent on");
});

test("a paid invoice mints and carries its tier", () => {
  assert.deepEqual(mintFromEvent(invoice()), { kind: "membership", uid: "u1", credits: 2000, cents: 2499, ref: "in_1", tier: "plus" });
});

test("a $0 invoice never mints", () => {
  // A fully-discounted, paused or proration invoice is `paid`. Minting on it
  // would buy a month of credits with a coupon.
  assert.equal(mintFromEvent(invoice({ amount_paid: 0 })), null);
  assert.equal(mintFromEvent(invoice({ amount_paid: undefined })), null);
});

test("an unpaid invoice never mints", () => {
  assert.equal(mintFromEvent(invoice({ status: "open", paid: false })), null);
  assert.equal(mintFromEvent(invoice({ status: "draft", paid: undefined })), null);
});

test("paid:true is honoured when status is absent", () => {
  const e = invoice({ status: undefined, paid: true });
  assert.equal(mintFromEvent(e).kind, "membership");
});

test("finds subscription metadata in all three API-version shapes", () => {
  const want = { kind: "membership", uid: "u2", credits: 4000, cents: 4999, ref: "in_2", tier: "pro" };
  const base = { id: "in_2", status: "paid", amount_paid: 4999 };
  const meta = { user_id: "u2", credits: "4000" };
  for (const [label, obj] of [
    ["subscription_details", { ...base, subscription_details: { metadata: meta } }],
    ["parent.subscription_details", { ...base, parent: { subscription_details: { metadata: meta } } }],
    ["lines.data[0]", { ...base, lines: { data: [{ metadata: meta }] } }],
  ]) {
    assert.deepEqual(mintFromEvent({ type: "invoice.paid", data: { object: obj } }), want, label);
  }
});

test("tiers follow the plan sizes", () => {
  assert.equal(tierForCredits(2000), "plus");
  assert.equal(tierForCredits(4000), "pro");
  assert.equal(tierForCredits(8000), "max");
  // Boundaries: one credit short must not be promoted.
  assert.equal(tierForCredits(3999), "plus");
  assert.equal(tierForCredits(7999), "pro");
  assert.equal(tierForCredits(99999), "max");
});

test("events we do not act on mint nothing", () => {
  for (const type of [
    "invoice.payment_succeeded", // Stripe sends this for the SAME invoice — acting on both is a wasted call
    "customer.subscription.created", "charge.succeeded", "payment_intent.succeeded",
    "invoice.payment_failed", "checkout.session.expired",
  ]) {
    assert.equal(mintFromEvent({ type, data: { object: { id: "x", status: "paid", amount_paid: 9999, metadata: { user_id: "u1", credits: "9999" } } } }), null, type);
  }
});

test("a malformed event mints nothing rather than throwing", () => {
  // This runs on a public endpoint. A crash here is a 500 Stripe will retry
  // forever, and an exception thrown past the guards is a bypass.
  for (const e of [null, undefined, {}, { type: "invoice.paid" }, { type: "invoice.paid", data: {} },
    { type: "invoice.paid", data: { object: null } }, { data: { object: { id: "x" } } }, "string", 42]) {
    assert.equal(mintFromEvent(e), null, JSON.stringify(e));
  }
});

test("credits are never taken from anywhere but our own metadata", () => {
  // The amount charged must not be able to set the credits granted — otherwise a
  // $1 payment with a crafted amount_total would mint whatever it liked.
  const e = session({ amount_total: 999999, metadata: { user_id: "u1", credits: "10" } });
  assert.equal(mintFromEvent(e).credits, 10);
});

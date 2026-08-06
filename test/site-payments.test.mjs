// The money path. Every test here is about a way a customer could be charged
// the wrong amount, or a shop could be robbed by a request it trusted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ZERO_DECIMAL, DEFAULT_CURRENCY, normalizeCurrency, toMinorUnits,
  normalizePayment, parseCart, priceCart, formEncode, checkoutSessionArgs,
  paidFromEvent, failedFromEvent, MAX_CART_LINES, MAX_LINE_QTY,
} from "../site-payments.mjs";

// ── money ────────────────────────────────────────────────────────────────────

test("a decimal price becomes integer minor units", () => {
  assert.equal(toMinorUnits("285.00", "gbp"), 28500);
  assert.equal(toMinorUnits("285", "gbp"), 28500);
  assert.equal(toMinorUnits("285.5", "gbp"), 28550);
  assert.equal(toMinorUnits("0.01", "gbp"), 1);
  assert.equal(toMinorUnits("1,234.56", "gbp"), 123456);
});

test("every two-decimal price in a range converts exactly", () => {
  // NOT a claim that this beats Math.round(x * 100): a sweep of the accepted
  // domain found zero values where the two disagree, so a mutant swapping in
  // the float form survives on purpose. The integer path is here because it
  // needs no rounding step and because zero-decimal currencies share it.
  assert.equal(toMinorUnits("19.99", "usd"), 1999);
  for (let cents = 0; cents < 100; cents++) {
    const s = `19.${String(cents).padStart(2, "0")}`;
    assert.equal(toMinorUnits(s, "usd"), 1900 + cents, s);
  }
});

test("a zero-decimal currency has NO minor unit — ¥100 is 100, not 10000", () => {
  assert.equal(toMinorUnits("100", "jpy"), 100);
  assert.equal(toMinorUnits("100", "krw"), 100);
  assert.equal(toMinorUnits("100", "gbp"), 10000);
  assert.ok(ZERO_DECIMAL.has("jpy") && ZERO_DECIMAL.has("vnd"));
});

test("an unreadable price is null, NEVER zero — a silent 0 is stock given away", () => {
  for (const bad of ["", "   ", "free", "£285.00", "$1", "abc", "-5", "1e3", null, undefined, {}, "12..3", ".5"]) {
    assert.equal(toMinorUnits(bad, "gbp"), null, JSON.stringify(bad));
  }
});

test("more precision than the currency has is REFUSED, not rounded away", () => {
  // 1.005 is a mistake in the owner's data. Charging 1.00 is a decision nobody
  // made, and it is wrong in the customer's favour on every sale forever.
  assert.equal(toMinorUnits("1.005", "gbp"), null);
  assert.equal(toMinorUnits("100.5", "jpy"), null);
  assert.equal(toMinorUnits("100", "jpy"), 100);
});

test("a currency code must be three letters or it falls back to the default", () => {
  assert.equal(normalizeCurrency("GBP"), "gbp");
  for (const bad of ["", "g", "gbpx", "g1p", null, 7, {}]) assert.equal(normalizeCurrency(bad), null, JSON.stringify(bad));
  assert.equal(toMinorUnits("1.00", "nonsense"), 100);   // defaults to a 2-place currency
  assert.equal(DEFAULT_CURRENCY, "usd");
});

// ── the declaration ──────────────────────────────────────────────────────────

test("payment declares which table the prices come from", () => {
  const p = normalizePayment({ payment: { from: "products", price: "price", currency: "GBP" } });
  assert.deepEqual(p, { from: "products", price: "price", name: "name", currency: "gbp" });
});

test("a declaration with no source table is refused — the price has to come from somewhere", () => {
  for (const bad of [{}, { payment: {} }, { payment: { from: "" } }, { payment: { from: "bad name" } }, { payment: { from: "1products" } }, { payment: true }, { payment: [] }]) {
    assert.equal(normalizePayment(bad), null, JSON.stringify(bad));
  }
});

test("the source table name stays in the identifier alphabet — it reaches SQL", () => {
  assert.equal(normalizePayment({ payment: { from: "products; DROP TABLE x" } }), null);
  assert.equal(normalizePayment({ payment: { from: "products", price: "price; --" } }), null);
});

// ── the cart ─────────────────────────────────────────────────────────────────

test("THE CLIENT MAY ONLY CHOOSE WHICH ROW AND HOW MANY", () => {
  // Everything else a page could post is dropped rather than validated, so it
  // cannot be wrong about the total later.
  const r = parseCart({ items: [{ id: 3, qty: 2, price: "0.01", unit_amount: 1, amount: 1, total: 1, currency: "xxx", discount: 99 }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.items, [{ id: 3, qty: 2 }]);
  assert.deepEqual(Object.keys(r.items[0]).sort(), ["id", "qty"]);
});

test("a missing quantity is one — a bare Buy button is the common case", () => {
  assert.deepEqual(parseCart({ items: [{ id: 5 }] }).items, [{ id: 5, qty: 1 }]);
  assert.deepEqual(parseCart({ items: [{ id: 5, quantity: 3 }] }).items, [{ id: 5, qty: 3 }]);
  // An EXPLICIT null is the same as omitted, not a malformed quantity: a page
  // building {id, qty: cart[id] ?? null} means "not set", and `== null` is
  // exactly that convention. Pinned, so it stays a decision rather than a
  // side effect of the nullish check.
  assert.deepEqual(parseCart({ items: [{ id: 5, qty: null }] }).items, [{ id: 5, qty: 1 }]);
  assert.deepEqual(parseCart({ items: [{ id: 5, qty: undefined }] }).items, [{ id: 5, qty: 1 }]);
});

test("a quantity that could drive the total down is refused", () => {
  for (const qty of [0, -1, -100, 1.5, "-2", "1.5", "", NaN, Infinity, true, ["2"], {}, MAX_LINE_QTY + 1]) {
    assert.equal(parseCart({ items: [{ id: 1, qty }] }).ok, false, JSON.stringify(qty));
  }
});

test("a DIGIT STRING is accepted — an <input type=number> hands back a string", () => {
  // Refusing it would break the ordinary way a basket is built, and the value
  // that reaches SQL is the same integer either way.
  assert.deepEqual(parseCart({ items: [{ id: "3", qty: "2" }] }).items, [{ id: 3, qty: 2 }]);
});

test("a boolean or a one-element array is NOT a count, though Number() says otherwise", () => {
  // Number(true) is 1 and Number(["3"]) is 3, so both would sail through
  // isSafeInteger as a real quantity.
  assert.equal(parseCart({ items: [{ id: true, qty: 1 }] }).ok, false);
  assert.equal(parseCart({ items: [{ id: ["3"], qty: 1 }] }).ok, false);
  assert.equal(parseCart({ items: [{ id: 1, qty: true }] }).ok, false);
});

test("a bad id is refused — it reaches SQL", () => {
  for (const id of [0, -1, 1.5, "3; DROP", "0x10", " 3;", NaN, null, undefined, {}, []]) {
    assert.equal(parseCart({ items: [{ id, qty: 1 }] }).ok, false, JSON.stringify(id));
  }
});

test("an empty or oversized basket is refused", () => {
  assert.equal(parseCart({}).ok, false);
  assert.equal(parseCart({ items: [] }).ok, false);
  assert.equal(parseCart({ items: "nope" }).ok, false);
  assert.equal(parseCart({ items: Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => ({ id: i + 1, qty: 1 })) }).ok, false);
});

test("the same product twice is MERGED, not refused — that is a page, not an attack", () => {
  const r = parseCart({ items: [{ id: 7, qty: 2 }, { id: 7, qty: 3 }, { id: 8, qty: 1 }] });
  assert.deepEqual(r.items, [{ id: 7, qty: 5 }, { id: 8, qty: 1 }]);
});

test("merging cannot be used to exceed the per-line cap", () => {
  const r = parseCart({ items: Array.from({ length: 40 }, () => ({ id: 1, qty: MAX_LINE_QTY })) });
  assert.equal(r.items[0].qty, MAX_LINE_QTY);
});

// ── pricing ──────────────────────────────────────────────────────────────────

const PAY = { from: "products", price: "price", name: "name", currency: "gbp" };
const CATALOGUE = [
  { id: 1, name: "Gyuto 210mm", price: "285.00" },
  { id: 2, name: "Petty 135mm", price: "165.00" },
  { id: 3, name: "Unpriced sample", price: "" },
];
const deps = { readRows: async (_t, ids) => CATALOGUE.filter((r) => ids.includes(r.id)) };

test("the total is computed from the DATABASE rows", async () => {
  const r = await priceCart(deps, { payment: PAY, items: [{ id: 1, qty: 1 }, { id: 2, qty: 2 }] });
  assert.equal(r.ok, true);
  assert.equal(r.total, 28500 + 2 * 16500);
  assert.equal(r.currency, "gbp");
  assert.deepEqual(r.lines.map((l) => [l.name, l.unit, l.qty]), [["Gyuto 210mm", 28500, 1], ["Petty 135mm", 16500, 2]]);
});

test("A PRICE SENT BY THE CLIENT IS IGNORED — the £285 knife cannot be bought for a penny", async () => {
  const cart = parseCart({ items: [{ id: 1, qty: 1, price: "0.01", unit_amount: 1, amount: 1 }] });
  const r = await priceCart(deps, { payment: PAY, items: cart.items });
  assert.equal(r.total, 28500);
});

test("...and priceCart ignores it DIRECTLY, not merely because parseCart stripped it", async () => {
  // Found by mutation: a mutant making priceCart prefer it.price survived the
  // whole suite, because every test reached it through parseCart. That made the
  // security property a fact about the STRIPPER, with nothing holding the layer
  // that actually computes money. Called here with the raw shape a future
  // caller might pass.
  const raw = [{ id: 1, qty: 1, price: "0.01", unit: 1, unit_amount: 1, amount: 1, total: 1 }];
  const r = await priceCart(deps, { payment: PAY, items: raw });
  assert.equal(r.total, 28500);
  assert.equal(r.lines[0].unit, 28500);
});

test("a client-sent currency cannot change what is charged either", async () => {
  // The currency comes from the DECLARATION, so a cart claiming a zero-decimal
  // currency cannot turn £285.00 into 285 minor units of anything.
  const r = await priceCart(deps, { payment: PAY, items: [{ id: 1, qty: 1, currency: "jpy" }] });
  assert.equal(r.currency, "gbp");
  assert.equal(r.total, 28500);
});

test("an id the catalogue does not have refuses the whole checkout", async () => {
  const r = await priceCart(deps, { payment: PAY, items: [{ id: 1, qty: 1 }, { id: 999, qty: 1 }] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
});

test("an unpriced row refuses rather than charging a guess", async () => {
  const r = await priceCart(deps, { payment: PAY, items: [{ id: 3, qty: 1 }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /not priced/);
});

test("a basket coming to zero is refused — Stripe rejects it and that reads as a broken button", async () => {
  const free = { readRows: async () => [{ id: 1, name: "Sample", price: "0.00" }] };
  const r = await priceCart(free, { payment: PAY, items: [{ id: 1, qty: 2 }] });
  assert.equal(r.ok, false);
});

test("a nameless row still gets a line label rather than an empty one", async () => {
  const anon = { readRows: async () => [{ id: 4, name: null, price: "5.00" }] };
  const r = await priceCart(anon, { payment: PAY, items: [{ id: 4, qty: 1 }] });
  assert.equal(r.lines[0].name, "#4");
});

test("a long product name is clipped — Stripe refuses an over-long one and the sale fails", async () => {
  const big = { readRows: async () => [{ id: 5, name: "x".repeat(900), price: "5.00" }] };
  const r = await priceCart(big, { payment: PAY, items: [{ id: 5, qty: 1 }] });
  assert.equal(r.lines[0].name.length, 250);
});

// ── the Stripe body ──────────────────────────────────────────────────────────

test("form encoding produces Stripe's bracketed paths", () => {
  const s = formEncode({ mode: "payment", line_items: [{ quantity: 2, price_data: { currency: "gbp", unit_amount: 28500 } }] });
  assert.ok(s.includes("mode=payment"));
  assert.ok(s.includes(encodeURIComponent("line_items[0][quantity]") + "=2"));
  assert.ok(s.includes(encodeURIComponent("line_items[0][price_data][unit_amount]") + "=28500"));
});

test("form encoding escapes values — a product name is owner text", () => {
  const s = formEncode({ product_data: { name: "Salt & Pepper=1" } });
  assert.ok(s.includes("Salt%20%26%20Pepper%3D1") || s.includes("Salt+%26+Pepper%3D1"), s);
  assert.equal(s.split("&").length, 1);
});

test("a null is omitted rather than sent as the string 'null'", () => {
  assert.equal(formEncode({ a: 1, b: null, c: undefined }), "a=1");
});

test("the session carries slug, table and order id in BOTH the reference and metadata", () => {
  const a = checkoutSessionArgs({
    slug: "store", table: "orders", orderId: 42, currency: "gbp",
    lines: [{ name: "Gyuto", unit: 28500, qty: 1 }],
    successUrl: "https://isibi.ai/s/store/thanks", cancelUrl: "https://isibi.ai/s/store/basket",
  });
  assert.equal(a.client_reference_id, "store:orders:42");
  assert.deepEqual(a.metadata, { isibi_slug: "store", isibi_table: "orders", isibi_order: "42" });
  assert.equal(a.mode, "payment");
  assert.equal(a.line_items[0].price_data.unit_amount, 28500);
});

test("no email means no customer_email key at all, rather than an empty one", () => {
  const a = checkoutSessionArgs({ slug: "s", table: "o", orderId: 1, currency: "gbp", lines: [], successUrl: "u", cancelUrl: "c" });
  assert.equal("customer_email" in a, false);
  assert.equal(checkoutSessionArgs({ slug: "s", table: "o", orderId: 1, currency: "gbp", lines: [], successUrl: "u", cancelUrl: "c", email: "a@b.c" }).customer_email, "a@b.c");
});

// ── the webhook ──────────────────────────────────────────────────────────────

const paidEvent = (over = {}) => ({
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_123", payment_status: "paid", amount_total: 28500, currency: "gbp",
    client_reference_id: "store:orders:42", metadata: { isibi_slug: "store", isibi_table: "orders", isibi_order: "42" },
    customer_details: { email: "buyer@example.com" }, ...over } },
});

test("a completed, paid session names the order to mark", () => {
  const r = paidFromEvent(paidEvent());
  assert.equal(r.slug, "store");
  assert.equal(r.table, "orders");
  assert.equal(r.orderId, 42);
  assert.equal(r.ref, "cs_test_123");
  assert.equal(r.amount, 28500);
  assert.equal(r.email, "buyer@example.com");
});

test("AN UNPAID COMPLETED SESSION IS NOT PAID — a delayed method settles later", () => {
  // checkout.session.completed also fires for a bank debit that has not cleared.
  // Treating it as paid ships the goods before the money arrives.
  assert.equal(paidFromEvent(paidEvent({ payment_status: "unpaid" })), null);
  // ...and the async success event that follows it IS.
  const later = { ...paidEvent(), type: "checkout.session.async_payment_succeeded" };
  assert.equal(paidFromEvent(later).orderId, 42);
});

test("payment_status is an ALLOW-LIST OF ONE — 'complete' is not a substitute for 'paid'", () => {
  // no_payment_required is a fully-discounted or zero-amount session. We never
  // create one, so seeing it means a session we did not make — the last thing
  // that should mark goods as sold. An earlier draft accepted
  // `status === "complete"` as an alternative and would have.
  for (const ps of ["no_payment_required", "unpaid", "processing", "", null, undefined, "PAID"]) {
    assert.equal(paidFromEvent(paidEvent({ payment_status: ps, status: "complete" })), null, String(ps));
  }
  assert.equal(paidFromEvent(paidEvent({ payment_status: "paid", status: "complete" })).orderId, 42);
});

test("every OTHER event type means nothing — an owner may subscribe to more than we asked", () => {
  for (const type of ["payment_intent.succeeded", "invoice.paid", "customer.created", "charge.refunded", "checkout.session.expired", "", null]) {
    assert.equal(paidFromEvent({ ...paidEvent(), type }), null, String(type));
  }
});

test("a malformed reference is refused rather than guessed — slug and table reach SQL", () => {
  for (const bad of [
    { client_reference_id: "", metadata: {} },
    { client_reference_id: "store:orders:notanumber", metadata: {} },
    { client_reference_id: "store:orders:-1", metadata: {} },
    { client_reference_id: "store:orders:0", metadata: {} },
    { client_reference_id: "BAD SLUG:orders:1", metadata: {} },
    { client_reference_id: "store:bad table:1", metadata: {} },
    { client_reference_id: "store:orders", metadata: {} },
  ]) {
    assert.equal(paidFromEvent(paidEvent(bad)), null, JSON.stringify(bad));
  }
});

test("metadata WINS over the reference — code should key on metadata, a human reads the reference", () => {
  const r = paidFromEvent(paidEvent({ client_reference_id: "other:wrong:9", metadata: { isibi_slug: "store", isibi_table: "orders", isibi_order: "42" } }));
  assert.equal(r.slug, "store");
  assert.equal(r.orderId, 42);
});

test("the reference alone is enough — metadata can be edited away in the dashboard", () => {
  const r = paidFromEvent(paidEvent({ metadata: {} }));
  assert.equal(r.slug, "store");
  assert.equal(r.table, "orders");
  assert.equal(r.orderId, 42);
});

test("an expired session names the order so it does not sit pending forever", () => {
  const r = failedFromEvent({ type: "checkout.session.expired", data: { object: { id: "cs_x", client_reference_id: "store:orders:42", metadata: {} } } });
  assert.equal(r.orderId, 42);
  assert.equal(r.amount, null);
  assert.equal(failedFromEvent(paidEvent()), null);
});

// ── the shared verifier ──────────────────────────────────────────────────────

test("the per-site webhook reuses stripe-webhook.mjs rather than a second verifier", () => {
  // Two signature checks is two places to get constant-time comparison, the
  // rotation window and the replay tolerance right, and one of them will drift.
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "site-payments.mjs"), "utf8");
  assert.equal(/hmac|createHmac|subtle\.sign/i.test(src), false, "site-payments.mjs must not hand-roll a signature check");
});

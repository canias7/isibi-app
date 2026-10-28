// The money path. Every test here is about a way a customer could be charged
// the wrong amount, or a shop could be robbed by a request it trusted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadTemplate } from "./fixtures/template-ts.mjs";
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
    successUrl: "https://gofarther.dev/s/store/thanks", cancelUrl: "https://gofarther.dev/s/store/basket",
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

// ── the schema side ──────────────────────────────────────────────────────────
//
// This feature has to be reachable at every layer or it joins the eleven
// documented in CLAUDE.md that parse, persist, and are acted on by nothing.
// Asserted as a CHAIN, because each of those was fine at four links out of five.

import { normalizeSchema, parseSchemaSpec } from "../site-schema.mjs";
import { grantsFor } from "../site-rls.mjs";
import { PAYMENT_COLUMNS } from "../site-payments.mjs";

const payableSpec = {
  tables: [
    { name: "products", access: "display", columns: [{ name: "name" }, { name: "price" }] },
    { name: "orders", access: "collect", payment: { from: "products", price: "price", currency: "gbp" }, columns: [{ name: "customer_name" }, { name: "email" }] },
  ],
};

test("link 1: the declaration SURVIVES the normaliser's allow-list", () => {
  // coerceTable builds its output field by field, so a property nobody added to
  // that literal is dropped silently on every build — the build succeeds, the
  // site works, and the guarantee is simply absent. teamScope was dead here for
  // five separate layers.
  const norm = normalizeSchema(payableSpec).tables;
  const orders = norm.find((t) => t.name === "orders");
  assert.ok(orders, "orders must survive normalisation");
  assert.deepEqual(orders.payment, { from: "products", price: "price", name: "name", currency: "gbp" });
});

test("link 2: A PAYABLE TABLE GETS NO PUBLIC INSERT — the hole closes by construction", () => {
  const norm = normalizeSchema(payableSpec).tables;
  const orders = norm.find((t) => t.name === "orders");
  // No WRITE grant on any pair — hoisted out of the `anyone` branch, where it
  // protected `collect` and nothing else. The read grant may stand: a customer
  // has to see what they are buying.
  assert.deepEqual(grantsFor(orders).filter((s) => /^GRANT (INSERT|UPDATE|DELETE|ALL)/.test(s)), []);
});

test("...while an ORDINARY collect table keeps its public INSERT", () => {
  // Or every contact form on the platform stops working.
  const plain = normalizeSchema({ tables: [{ name: "enquiries", access: "collect", columns: [{ name: "email" }] }] }).tables[0];
  const g = grantsFor(plain).filter((s) => /^GRANT /.test(s));
  assert.equal(g.length, 2);
  assert.ok(g.every((s) => /GRANT INSERT/.test(s)), g.join(" "));
});

test("link 3: the payment columns are dropped from the DECLARED list, not only the DDL", () => {
  // Both matter and they are different functions. The DDL filter stops a
  // CREATE TABLE collision; this one stops the column reaching _meta and so
  // schemaDigest, which prints every declared column with no managed filter —
  // a declared payment_status would be described to the generator as an
  // ordinary field and land on the checkout form.
  const withClash = normalizeSchema({
    tables: [{
      name: "orders", access: "collect", payment: { from: "products" },
      columns: [{ name: "email" }, ...PAYMENT_COLUMNS.map((c) => ({ name: c }))],
    }],
  }).tables[0];
  const names = withClash.columns.map((c) => c.name.toLowerCase());
  for (const c of PAYMENT_COLUMNS) assert.equal(names.includes(c), false, c);
  assert.ok(names.includes("email"));
});

test("...and they are NOT managed on a table that is not payable", () => {
  // A shop may legitimately have a `currency` column of its own on a non-payable
  // table; the reservation is scoped to the feature that owns those columns.
  const plain = normalizeSchema({ tables: [{ name: "quotes", access: "collect", columns: [{ name: "currency" }, { name: "amount_total" }] }] }).tables[0];
  const names = plain.columns.map((c) => c.name.toLowerCase());
  assert.ok(names.includes("currency") && names.includes("amount_total"));
});

test("link 4: the DDL really emits the payment columns", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "site-schema.mjs"), "utf8");
  const block = src.slice(src.indexOf("if (t.payment) {"), src.indexOf("if (t.trash)"));
  assert.ok(block.length > 40, "the payment DDL block must exist");
  for (const c of PAYMENT_COLUMNS) assert.ok(block.includes(`"${c}"`), c);
  // pending by default: the row is created BEFORE the customer reaches Stripe,
  // so a lost webhook leaves an order to reconcile rather than nothing at all.
  assert.match(block, /"payment_status" TEXT NOT NULL DEFAULT \\'pending\\'/);
  // An integer of the minor unit, so it compares exactly against Stripe.
  assert.match(block, /"amount_total" INTEGER/);
});

test("link 5: ONE list of payment columns, not two that drift", () => {
  // The engine, the lint and the generator's rules must ask the same question.
  const schema = fs.readFileSync(path.join(import.meta.dirname, "..", "site-schema.mjs"), "utf8");
  assert.match(schema, /import \{[^}]*PAYMENT_COLUMNS[^}]*\} from "\.\/site-payments\.mjs"/);
  assert.equal(/PAYMENT_COLUMNS\s*=/.test(schema), false, "site-schema.mjs must not define its own copy");
});

test("the whole chain holds from the file a build actually posts", () => {
  // parseSchemaSpec reads the declaration file; normalizeSchema is what every
  // later layer sees. Driven end to end so a break anywhere between shows here.
  const spec = parseSchemaSpec({ "isibi.schema.json": JSON.stringify(payableSpec) });
  assert.ok(spec, "the schema file must parse");
  const orders = normalizeSchema(spec).tables.find((t) => t.name === "orders");
  assert.ok(orders && orders.payment, "payment must reach the normalised table");
  assert.equal(orders.payment.from, "products");
  assert.deepEqual(grantsFor(orders).filter((s) => /^GRANT (INSERT|UPDATE|DELETE|ALL)/.test(s)), [],
    "and the table must still lose every direct write");
});

test("link 0: THE DESIGNER CAN DECLARE IT — otherwise the whole chain is unreachable", () => {
  // `unique`, `noOverlap`, `maxRows` and `uniqueCI` were fully implemented,
  // tested and UNREACHABLE on every site the builder ever made, because the
  // designer's tool never offered them. Measured consequence: two customers
  // booked the same 14:00 slot and both were accepted.
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  const window = src.slice(src.indexOf('name: "design_schema"'), src.indexOf('tool_choice: { type: "tool", name: "design_schema" }'));
  assert.ok(window.length > 500, "the design_schema tool must be findable");
  // THE PER-TABLE FIELDS LIVE IN THEIR OWN MODULE (2026-09-02): `TABLE_ITEM`
  // in builder/site-table.mjs, shared with the ADD step and bound into the
  // tool by name — asserted here, so a module nobody sends cannot satisfy
  // what follows; the field's own text is read where it lives.
  assert.match(window, /items: TABLE_ITEM,/, "the tool no longer binds the shared table item");
  const tool = fs.readFileSync(path.join(import.meta.dirname, "..", "builder", "site-table.mjs"), "utf8");
  assert.match(tool, /payment: \{/);
  assert.match(tool, /required: \["from"\]/);
  // The model must be told the platform owns these columns, or it will put
  // payment_status on the checkout form for the customer to set.
  for (const c of PAYMENT_COLUMNS) assert.ok(tool.includes(c), c);
  // And told NOT to declare it for a business that is paid in person, or every
  // barber shop gets a card form it never asked for.
  assert.match(tool, /invoices later|paid in the chair/);
});

test("both filters exist, and the DDL one is documented as the unreachable backstop", () => {
  // A mutant removing the DDL-layer guard SURVIVES on purpose: coerceTable
  // strips those columns first, so it cannot fire on any spec built today. It
  // is kept for a spec read back from an older `_meta`, where a duplicate
  // column would fail CREATE TABLE and take the whole backend with it. Asserted
  // so that reason cannot quietly become "nobody remembers why this is here".
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "site-schema.mjs"), "utf8");
  assert.match(src, /if \(normalizePayment\(def\)\) cols = cols\.filter/, "the declared-list filter must exist");
  assert.match(src, /if \(normalizePayment\(t\)\) for \(const c of PAYMENT_COLUMNS\) MANAGED\.add\(c\);/, "the DDL backstop must exist");
  assert.match(src, /DEFENCE IN DEPTH, AND UNREACHABLE TODAY/, "and must say so");
});

// ── the two routes ───────────────────────────────────────────────────────────
//
// Derived from worker.js, which cannot be imported. Read RAW: strip() on a
// six-thousand-line file eats from any /* inside a string or regex to the next
// */ and reports present code as missing.

const WORKER = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
const between = (from, to) => {
  const a = WORKER.indexOf(from);
  assert.ok(a > 0, "missing anchor: " + from);
  const b = WORKER.indexOf(to, a);
  assert.ok(b > a, "missing end anchor: " + to);
  return WORKER.slice(a, b);
};
const webhookRoute = () => between('url.pathname.startsWith("/api/stripe/site/")', 'url.pathname === "/api/stripe/webhook"');

// Checkout and the site's Stripe webhook moved into the site's own Worker
// (2026-10-28: the site's own Worker): builder/lovable/template/src/lib/site-pay.ts.
// They are DRIVEN here, with a stubbed fetch standing in for the site's own
// database (Neon's /sql) and Stripe, rather than read as text.

const PAY_TABLES = [
  { name: "orders", columns: ["email", "note"], payment: { from: "menu", name: "name", price: "price", currency: "gbp" } },
  { name: "menu", access: "display" },
  { name: "signups", columns: ["email"] },
];
const PAY_ENV = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/db", SITE_TABLES: JSON.stringify(PAY_TABLES),
  STRIPE_SECRET_KEY: "sk_owner", STRIPE_WEBHOOK_SECRET: "whsec_owner" };
const CHECKOUT_URL = new URL("https://ember-cart.gofarther.app/api/db/ember-cart/checkout");
const HOOK_URL = new URL("https://gofarther.dev/api/stripe/site/ember-cart");

/** A fresh copy of site-pay.ts (its per-isolate rate limiter starts empty) and a recording fetch. */
async function payHarness({ stripe = () => new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" })), sql = null } = {}) {
  const mod = await loadTemplate("lib/site-pay.ts");
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u);
    if (url.endsWith("/sql")) {
      const q = JSON.parse(init.body);
      calls.push({ kind: "sql", query: q.query, params: q.params });
      if (sql) return sql(q);
      if (/^SELECT id/.test(q.query)) return new Response(JSON.stringify({ rows: [{ id: 1, name: "Flat white", price: 3.5 }] }));
      if (/^INSERT/.test(q.query)) return new Response(JSON.stringify({ rows: [{ id: 42 }] }));
      return new Response(JSON.stringify({ rows: [] }));
    }
    if (url === "https://api.stripe.com/v1/checkout/sessions") {
      calls.push({ kind: "stripe", headers: init.headers, body: String(init.body), signal: init.signal });
      return stripe();
    }
    calls.push({ kind: "other", url });
    return new Response("{}", { status: 404 });
  };
  const restore = () => { globalThis.fetch = real; };
  const checkout = async (body, env = PAY_ENV, ip = "1.2.3.4") => {
    const req = new Request(CHECKOUT_URL, { method: "POST", headers: { "CF-Connecting-IP": ip }, body: typeof body === "string" ? body : JSON.stringify(body) });
    const r = await mod.siteCheckout(req, env, CHECKOUT_URL, "ember-cart");
    return { r, j: await r.clone().json().catch(() => null) };
  };
  const hook = async (raw, sig, env = PAY_ENV) => {
    const r = await mod.stripeSiteWebhook(new Request(HOOK_URL, { method: "POST", headers: sig ? { "Stripe-Signature": sig } : {}, body: raw }), env, HOOK_URL, "ember-cart");
    return { r, j: await r.clone().json().catch(() => null) };
  };
  return { calls, restore, checkout, hook, sqls: () => calls.filter((c) => c.kind === "sql"), stripes: () => calls.filter((c) => c.kind === "stripe") };
}
async function stripeSig(secret, raw, t = Math.floor(Date.now() / 1000)) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(t + "." + raw));
  return "t=" + t + ",v1=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const paidEventFor = (over = {}) => ({ type: "checkout.session.completed", data: { object: {
  id: "cs_1", payment_status: "paid", client_reference_id: "ember-cart:orders:42",
  metadata: { isibi_slug: "ember-cart", isibi_table: "orders", isibi_order: "42" }, ...over } } });
const ITEMS = { table: "orders", items: [{ id: 1, qty: 2 }] };

test("checkout REFUSES a table that does not declare payment", async () => {
  // Otherwise this is a way to insert into any collect table while bypassing
  // that table's own rate limit. (2026-10-28: the site's own Worker)
  const h = await payHarness();
  try {
    for (const table of ["signups", "menu", "nosuch"]) {
      const { r } = await h.checkout({ table, items: [{ id: 1, qty: 1 }] });
      assert.equal(r.status, 404, table);
    }
    assert.equal(h.calls.length, 0, "nothing read, written or sent to Stripe");
    const { r } = await h.checkout(ITEMS);
    assert.equal(r.status, 200, "the control: a payable table opens a session");
  } finally { h.restore(); }
});

test("checkout NEVER takes the total, the price or the currency from the body", async () => {
  // The only things read off the request are the table, the cart, and the
  // declared form fields. A body key that could name money must not reach the
  // order or Stripe. (2026-10-28: the site's own Worker)
  const h = await payHarness();
  try {
    const { r } = await h.checkout({ ...ITEMS, total: 0.01, amount: 1, price: 0.01, currency: "jpy", unit_amount: 1,
      items: [{ id: 1, qty: 2, price: 0.01, unit_amount: 1, currency: "jpy" }] });
    assert.equal(r.status, 200);
    const ins = h.sqls().find((c) => /^INSERT/.test(c.query));
    assert.deepEqual(ins.params.slice(0, 3), ["pending", 700, "gbp"], "the order's total is the database's 2 × £3.50");
    const body = new URLSearchParams(h.stripes()[0].body);
    assert.equal(body.get("line_items[0][price_data][unit_amount]"), "350");
    assert.equal(body.get("line_items[0][price_data][currency]"), "gbp");
    assert.equal(body.get("line_items[0][quantity]"), "2");
  } finally { h.restore(); }
});

test("checkout builds BOTH return URLs itself — a body-supplied one is an open redirect on our domain", async () => {
  const h = await payHarness();
  try {
    await h.checkout({ ...ITEMS, success_url: "https://evil.example/", successUrl: "https://evil.example/", cancel_url: "https://evil.example/", cancelUrl: "https://evil.example/", return: "https://evil.example/" });
    const body = new URLSearchParams(h.stripes()[0].body);
    assert.equal(body.get("success_url"), CHECKOUT_URL.origin + "/?paid=42");
    assert.equal(body.get("cancel_url"), CHECKOUT_URL.origin + "/?cancelled=42");
    assert.equal(h.stripes()[0].body.includes("evil"), false);
  } finally { h.restore(); }
});

test("payment.from must name a table the site DECLARED — otherwise it could read _secrets", async () => {
  const tables = [{ name: "orders", columns: ["email"], payment: { from: "_secrets", name: "name", price: "cipher" } }];
  const h = await payHarness();
  try {
    const { r } = await h.checkout(ITEMS, { ...PAY_ENV, SITE_TABLES: JSON.stringify(tables) });
    assert.notEqual(r.status, 200);
    assert.equal(h.calls.length, 0, "no query reached _secrets: " + JSON.stringify(h.calls));
  } finally { h.restore(); }
});

test("the customer's fields are filtered to DECLARED columns", async () => {
  // The payment columns are not in that list (the schema engine strips them),
  // so a body claiming payment_status cannot reach the row. (2026-10-28: the site's own Worker)
  const h = await payHarness();
  try {
    await h.checkout({ ...ITEMS, fields: { email: "a@b.c", payment_status: "paid", amount_total: 0, owner_uid: "x", note: "ring twice" } });
    const ins = h.sqls().find((c) => /^INSERT/.test(c.query));
    assert.match(ins.query, /^INSERT INTO "orders" \("payment_status","amount_total","currency","email","note"\)/);
    assert.deepEqual(ins.params, ["pending", 700, "gbp", "a@b.c", "ring twice"]);
  } finally { h.restore(); }
});

test("a missing or empty key is refused, never sent to Stripe as no key", async () => {
  // Calling Stripe with an empty key tells a customer with a good card that
  // their payment failed. On the platform the key was decrypted, and a key that
  // would not decrypt was not treated as no key; the site holds the owner's key
  // as its own secret, so absent and empty are the cases left: 503 and say so.
  // (2026-10-28: the site's own Worker)
  const h = await payHarness();
  try {
    for (const STRIPE_SECRET_KEY of [undefined, ""]) {
      const { r } = await h.checkout(ITEMS, { ...PAY_ENV, STRIPE_SECRET_KEY });
      assert.equal(r.status, 503);
    }
    assert.equal(h.stripes().length, 0);
  } finally { h.restore(); }
});

test("the order row is written BEFORE Stripe is called", async () => {
  const h = await payHarness();
  try {
    await h.checkout(ITEMS);
    const i = h.calls.findIndex((c) => c.kind === "sql" && /^INSERT INTO/.test(c.query));
    const j = h.calls.findIndex((c) => c.kind === "stripe");
    assert.notEqual(i, -1); assert.notEqual(j, -1);
    assert.ok(i < j, "a customer who paid while the callback was lost must still have an order");
  } finally { h.restore(); }
  // And with no order row, Stripe is never called.
  const h2 = await payHarness({ sql: (q) => /^INSERT/.test(q.query) ? new Response("no", { status: 500 }) : new Response(JSON.stringify({ rows: [{ id: 1, name: "Flat white", price: 3.5 }] })) });
  try {
    const { r } = await h2.checkout(ITEMS);
    assert.equal(r.status, 500);
    assert.equal(h2.stripes().length, 0);
  } finally { h2.restore(); }
});

test("the Stripe call is idempotent, keyed on the order", async () => {
  // The platform's call was also bounded (AbortSignal.timeout); the site's is not
  // (2026-10-28: the site's own Worker) — recorded as a finding, not asserted here.
  const h = await payHarness();
  try {
    await h.checkout(ITEMS);
    assert.equal(h.stripes()[0].headers["Idempotency-Key"], "isibi-ember-cart-orders-42");
  } finally { h.restore(); }
});

test("a Stripe error is never echoed — the request carries the site's line items", async () => {
  const h = await payHarness({ stripe: () => new Response(JSON.stringify({ error: { message: "Flat white sk_owner line_items[0] secret detail" } }), { status: 400 }) });
  try {
    const { r, j } = await h.checkout(ITEMS);
    assert.equal(r.status, 502);
    const text = JSON.stringify(j);
    for (const leak of ["Flat white", "sk_owner", "line_items", "secret detail"]) assert.equal(text.includes(leak), false, leak);
  } finally { h.restore(); }
});

test("the webhook verifies the HMAC against THAT SITE's own secret", async () => {
  const h = await payHarness({ sql: () => new Response(JSON.stringify({ rows: [{ id: 42, payment_status: "paid" }] })) });
  try {
    // Over the RAW bytes: re-serialising JSON changes them and the signature fails.
    const raw = JSON.stringify(paidEventFor(), null, 3) + "\n";
    const forged = await h.hook(raw, await stripeSig("whsec_someone_else", raw));
    assert.equal(forged.r.status, 400);
    assert.equal(h.calls.length, 0);
    const reser = await h.hook(raw, await stripeSig("whsec_owner", JSON.stringify(JSON.parse(raw))));
    assert.equal(reser.r.status, 400, "a signature over re-serialised JSON does not verify");
    const ok = await h.hook(raw, await stripeSig("whsec_owner", raw));
    assert.equal(ok.r.status, 200);
    assert.ok(h.sqls().some((c) => /SET payment_status='paid'/.test(c.query)));
  } finally { h.restore(); }
});

test("THE WEBHOOK FAILS CLOSED with no secret — it is the thing that marks orders paid", async () => {
  const h = await payHarness();
  try {
    const raw = JSON.stringify(paidEventFor());
    for (const STRIPE_WEBHOOK_SECRET of [undefined, ""]) {
      const { r } = await h.hook(raw, await stripeSig("x", raw), { ...PAY_ENV, STRIPE_WEBHOOK_SECRET });
      assert.equal(r.status, 503);
    }
    assert.equal(h.calls.length, 0);
  } finally { h.restore(); }
});

test("a bad signature is refused before the body is believed", async () => {
  const h = await payHarness();
  try {
    const raw = JSON.stringify(paidEventFor());
    for (const sig of [null, "t=1,v1=00", "garbage"]) {
      const { r, j } = await h.hook(raw, sig);
      assert.equal(r.status, 400);
      assert.equal(j.error, "bad signature");
    }
    // Even a body that is not JSON is refused for its signature, not its shape.
    const { j } = await h.hook("{not json", "t=1,v1=00");
    assert.equal(j.error, "bad signature");
    assert.equal(h.calls.length, 0, "an unsigned body must never reach the thing that marks orders paid");
  } finally { h.restore(); }
});

test("the event's own slug must be THIS site's", async () => {
  // Belt and braces over the signature. (2026-10-28: the site's own Worker)
  const h = await payHarness();
  try {
    const raw = JSON.stringify(paidEventFor({ client_reference_id: "other-site:orders:42", metadata: { isibi_slug: "other-site", isibi_table: "orders", isibi_order: "42" } }));
    const { r } = await h.hook(raw, await stripeSig("whsec_owner", raw));
    assert.equal(r.status, 200);
    assert.equal(h.calls.length, 0);
  } finally { h.restore(); }
});

test("the update is IDEMPOTENT — Stripe delivers at least once and retries", async () => {
  const h = await payHarness({ sql: () => new Response(JSON.stringify({ rows: [] })) });
  try {
    const raw = JSON.stringify(paidEventFor());
    const { r } = await h.hook(raw, await stripeSig("whsec_owner", raw));
    assert.equal(r.status, 200, "a repeat delivery of an already-paid order is still acknowledged");
    const upd = h.sqls().filter((c) => /^UPDATE/.test(c.query));
    assert.equal(upd.length, 1);
    assert.match(upd[0].query, /payment_status<>'paid'/);
    assert.equal(h.sqls().length, 1, "no follow-ups run for an order that was already paid");
  } finally { h.restore(); }
});

test("an event this site cannot place answers 200, or Stripe retries for days and disables the endpoint", async () => {
  // On the platform this was an unknown slug; the site knows only itself, so
  // the cases are an event for a table that takes no payment and one that means
  // nothing. (2026-10-28: the site's own Worker)
  const h = await payHarness();
  try {
    for (const ev of [
      paidEventFor({ client_reference_id: "ember-cart:signups:42", metadata: { isibi_slug: "ember-cart", isibi_table: "signups", isibi_order: "42" } }),
      { type: "customer.created", data: { object: {} } },
    ]) {
      const raw = JSON.stringify(ev);
      const { r } = await h.hook(raw, await stripeSig("whsec_owner", raw));
      assert.equal(r.status, 200, raw);
    }
    assert.equal(h.calls.length, 0);
  } finally { h.restore(); }
});

test("a failure to RECORD answers 500, so Stripe retries — the money is real", async () => {
  const h = await payHarness({ sql: () => new Response("down", { status: 500 }) });
  try {
    const raw = JSON.stringify(paidEventFor());
    const { r } = await h.hook(raw, await stripeSig("whsec_owner", raw));
    assert.equal(r.status, 500);
  } finally { h.restore(); }
});

test("the checkout rate limit is ACTED ON, not merely present", async () => {
  // A mutant deleting the refusal once left the limiter's call in place and
  // survived, so the endpoint was unlimited while the invariant read as
  // satisfied: so the refusal is driven. (2026-10-28: the site's own Worker)
  const h = await payHarness();
  try {
    for (let i = 0; i < 6; i++) assert.equal((await h.checkout(ITEMS, PAY_ENV, "9.9.9.9")).r.status, 200, "try " + (i + 1));
    // And before the body is read, or a flood still gets us to buffer it: an
    // unreadable body is refused for the limit, not for its JSON.
    const { r } = await h.checkout("{not json", PAY_ENV, "9.9.9.9");
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get("retry-after")) > 0);
    assert.equal(h.stripes().length, 6);
    assert.equal((await h.checkout(ITEMS, PAY_ENV, "8.8.8.8")).r.status, 200, "another visitor is not limited");
  } finally { h.restore(); }
});

test("the two webhooks are separate handlers — one must never mint platform credits", () => {
  // isibi's own billing and a barber shop's order are different accounts with
  // different signing secrets.
  const w = webhookRoute();
  assert.equal(/add_credits|mintFromEvent|credit/i.test(w), false, "the per-site webhook must not touch the credit ledger");
  // And the handler that now does the work, in the site's own Worker. (2026-10-28: the site's own Worker)
  const pay = fs.readFileSync(path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "lib", "site-pay.ts"), "utf8");
  const a = pay.indexOf("export async function stripeSiteWebhook(");
  assert.notEqual(a, -1, "missing anchor: stripeSiteWebhook");
  assert.match(pay.slice(a), /verifyStripeSignature\(/, "the observer is alive");
  assert.equal(/add_credits|mintFromEvent|credit/i.test(pay.slice(a)), false, "the site's webhook must not touch the credit ledger");
});

// AUDIT A12-5 (2026-10-22, owner: "fix 29"): three-decimal currencies were
// charged a tenth. Red on the old code: "12.50" kwd was 1250, "12.500" null.
test("three-decimal currencies are charged in thousandths, never a tenth", async () => {
  const { toMinorUnits, THREE_DECIMAL } = await import("../site-payments.mjs");
  assert.deepEqual([...THREE_DECIMAL].sort(), ["bhd", "jod", "kwd", "omr", "tnd"]);
  assert.equal(toMinorUnits("12.50", "kwd"), 12500, "12.50 KWD is 12500 thousandths");
  assert.equal(toMinorUnits("12.500", "KWD"), 12500, "the local three-digit way is read");
  assert.equal(toMinorUnits("12", "bhd"), 12000);
  assert.equal(toMinorUnits("5.125", "bhd"), null, "Stripe needs the last digit 0: refused, not rounded");
  assert.equal(toMinorUnits("1.0005", "omr"), null, "more digits than the currency has is refused");
  // Controls: two- and zero-decimal currencies are unchanged.
  assert.equal(toMinorUnits("12.50", "gbp"), 1250);
  assert.equal(toMinorUnits("1200", "jpy"), 1200);
});

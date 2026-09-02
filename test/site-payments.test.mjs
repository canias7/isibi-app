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
const checkout = () => between("async function handleCheckout(", "async function proxySiteService(");
/**
 * `a` must appear before `b`, WITH BOTH PROVEN PRESENT FIRST.
 *
 * A bare indexOf(a) < indexOf(b) passes vacuously when `a` is deleted, because
 * indexOf returns -1 and -1 is less than everything. Three ordering assertions
 * here were written that way and a mutation removing the signature check
 * survived the whole suite as a result — the check whose entire job is to stop
 * an unsigned body being believed.
 */
const orderedIn = (src, a, b, why) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  assert.notEqual(i, -1, `missing: ${a}`);
  assert.notEqual(j, -1, `missing: ${b}`);
  assert.ok(i < j, why);
};
const webhookRoute = () => between('url.pathname.startsWith("/api/stripe/site/")', 'url.pathname === "/api/stripe/webhook"');

test("checkout REFUSES a table that does not declare payment", () => {
  // Otherwise this is a way to insert into any collect table while bypassing
  // that table's own rate limit.
  assert.match(checkout(), /const payment = table && normalizePayment\(table\);/);
  assert.match(checkout(), /if \(!table \|\| !payment\) return Response\.json[^;]*404/);
});

test("checkout NEVER takes the total, the price or the currency from the body", () => {
  const c = checkout();
  // The only things read off the request are the table, the cart, and the
  // declared form fields. A body key that could name money must not appear.
  for (const k of ["body.total", "body.amount", "body.price", "body.currency", "body.unit_amount"]) {
    assert.equal(c.includes(k), false, k);
  }
  assert.match(c, /const cart = parseCart\(body\)/);
  assert.match(c, /await priceCart\(/);
});

test("checkout builds BOTH return URLs itself — a body-supplied one is an open redirect on our domain", () => {
  const c = checkout();
  assert.equal(/body\.success_url|body\.successUrl|body\.cancel_url|body\.cancelUrl|body\.return/.test(c), false);
  assert.match(c, /successUrl: `\$\{base\}/);
  assert.match(c, /cancelUrl: `\$\{base\}/);
});

test("payment.from must name a table the site DECLARED — otherwise it could read _secrets", () => {
  assert.match(checkout(), /if \(!tables\.some\(\(t\) => String\(t\.name\)\.toLowerCase\(\) === from\)\)/);
});

test("the customer's fields are filtered to DECLARED columns", () => {
  // The payment columns are not in that list (the schema engine strips them),
  // so a body claiming payment_status cannot reach the row.
  assert.match(checkout(), /declared\.has\(low\)/);
});

test("a key that will not DECRYPT is not treated as no key", () => {
  // Calling Stripe with an empty key tells a customer with a good card that
  // their payment failed. Absent is 503-and-say-so; broken is 503 too, but by a
  // different path that logs.
  const c = checkout();
  assert.match(c, /catch \(e\)[\s\S]{0,400}?checkout key:/);
  assert.match(c, /if \(!key\) return Response\.json/);
});

test("the order row is written BEFORE Stripe is called", () => {
  const c = checkout();
  orderedIn(c, "INSERT INTO", "api.stripe.com",
    "a customer who paid while the callback was lost must still have an order");
});

test("the Stripe call is bounded and idempotent", () => {
  const c = checkout();
  assert.match(c, /AbortSignal\.timeout\(/);
  assert.match(c, /"Idempotency-Key"/);
});

test("a Stripe error is logged, never echoed — the request carries the site's line items", () => {
  const c = checkout();
  const returned = c.slice(c.indexOf("if (!res.ok"));
  const body = returned.match(/Response\.json\(\{ error: ([^}]*)\}/);
  assert.ok(body, "the failure must return a Response");
  assert.equal(/out\.error|e\.message|String\(e\)/.test(body[1]), false, body[1]);
});

test("the webhook verifies the HMAC against THAT SITE's own secret", () => {
  const w = webhookRoute();
  assert.match(w, /STRIPE_WEBHOOK_SECRET/);
  assert.match(w, /verifyStripeSignature\(/);
  assert.match(w, /secrets: \[secret\]/);
  // Over the RAW bytes: re-serialising JSON changes them and the signature fails.
  assert.match(w, /const raw = await request\.text\(\)/);
  orderedIn(w, "request.text()", "JSON.parse(raw)", "the signature is over exact bytes");
});

test("THE WEBHOOK FAILS CLOSED with no secret — it is the thing that marks orders paid", () => {
  const w = webhookRoute();
  assert.match(w, /if \(!secret\) return Response\.json[^;]*503/);
});

test("a bad signature is refused before the body is believed", () => {
  orderedIn(webhookRoute(), "if (!ver.ok)", "paidFromEvent",
    "an unsigned body must never reach the thing that marks orders paid");
});

test("the event's own slug must be THIS site's", () => {
  // Belt and braces over the signature — but the alternative is a slug from a
  // request body reaching a connection lookup, which is never worth leaving open.
  assert.match(webhookRoute(), /if \(paid\.slug !== wslug\)/);
});

test("the update is IDEMPOTENT — Stripe delivers at least once and retries", () => {
  assert.match(webhookRoute(), /payment_status<>'paid'/);
});

test("an unknown slug answers 200, or Stripe retries for days and disables the endpoint", () => {
  const w = webhookRoute();
  assert.match(w, /if \(!wconn\) return Response\.json\(\{ ok: true/);
});

test("a failure to RECORD answers 500, so Stripe retries — the money is real", () => {
  const w = webhookRoute();
  const c = w.slice(w.indexOf("wh apply:"));
  assert.match(c, /status: 500/);
});

test("the checkout rate limit is ACTED ON, not merely present", () => {
  // api-auth.test.mjs asserts a limiter is mentioned in every /api/db block. A
  // mutant deleting the refusal left `_dataLimiter.hit(` in place and survived
  // it, so the endpoint was unlimited while the invariant read as satisfied.
  const block = between('url.pathname.endsWith("/checkout")', 'url.pathname.endsWith("/uploads")');
  assert.match(block, /_dataLimiter\.hit\(/);
  assert.match(block, /if \(!chit\.ok\)[\s\S]{0,120}?tooMany\(chit\)/);
  // And before the body is read, or a flood still gets us to buffer it.
  orderedIn(block, "_dataLimiter.hit(", "request.json()", "limit before reading the body");
});

test("the two webhooks are separate handlers — one must never mint platform credits", () => {
  // isibi's own billing and a barber shop's order are different accounts with
  // different signing secrets.
  const w = webhookRoute();
  assert.equal(/add_credits|mintFromEvent|credit/i.test(w), false, "the per-site webhook must not touch the credit ledger");
});

// Taking a card payment on a published site, with the owner's OWN Stripe key.
//
// Not Stripe Connect: the owner pastes their own `sk_live_…` into Secrets, the
// Worker decrypts it and calls Stripe AS THEM. The charge lands in their
// account, their payouts, their fees. Go Farther is never in the money flow.
//
// The single rule this file exists to enforce: THE PRICE COMES FROM THE SITE'S
// OWN DATABASE, NEVER FROM THE BROWSER. The client sends {id, qty} and nothing
// else that costs money. Every "cart total" sent from a page is a number an
// attacker types, and a shop that trusts it sells a £285 knife for a penny.
//
// Pure, or injected, so the pricing, the session body and the webhook decision
// can all be driven without Stripe, a database, or a Worker — the same reason
// stripe-webhook.mjs was lifted out of worker.js.

// ── Money ────────────────────────────────────────────────────────────────────

/**
 * Currencies with no minor unit. Stripe wants the amount in the currency's
 * smallest unit, so ¥100 is 100 and £1.00 is 100 — passing 10000 for the former
 * charges a customer a hundred times the price. This list is the difference.
 */
export const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export const DEFAULT_CURRENCY = "usd";

export function normalizeCurrency(code) {
  const c = String(code == null ? "" : code).trim().toLowerCase();
  return /^[a-z]{3}$/.test(c) ? c : null;
}

/**
 * A price column into an integer of the currency's smallest unit.
 *
 * Returns null rather than 0 on anything it cannot read, and every caller
 * treats that as a refusal. A price that silently becomes zero is a shop giving
 * stock away, and the owner's first sign is the money not arriving.
 *
 * The decimals are read as digits and padded, so the arithmetic is integer
 * throughout. 19.99 * 100 really is 1998.9999999999998 in IEEE 754 — but be
 * accurate about what that buys: `Math.round(x * 100)` recovers every value in
 * the domain this accepts, and a sweep of it found ZERO divergences. So this is
 * not fixing a live rounding bug. It is here because it needs no rounding step
 * to be correct, and because the same path already has to handle zero-decimal
 * currencies, where a hardcoded ×100 is wrong by a factor of a hundred.
 */
export function toMinorUnits(value, currency) {
  const cur = normalizeCurrency(currency) || DEFAULT_CURRENCY;
  const raw = String(value == null ? "" : value).trim();
  // A bare number or a decimal, optionally with thousands separators the owner
  // typed. No currency symbols: a column holding "£285.00" is the owner's data
  // to fix, and guessing which symbol means which currency is how a site starts
  // charging dollars for pounds.
  const m = raw.replace(/,/g, "").match(/^(\d+)(?:\.(\d{1,}))?$/);
  if (!m) return null;
  const places = ZERO_DECIMAL.has(cur) ? 0 : 2;
  const whole = m[1];
  const frac = (m[2] || "").slice(0, places).padEnd(places, "0");
  // Refuse more precision than the currency has rather than rounding it away:
  // a price of 1.005 is a mistake in the owner's data, and silently charging
  // 1.00 is a decision nobody made.
  if (m[2] && m[2].length > places) return null;
  const n = Number(whole + frac);
  return Number.isSafeInteger(n) ? n : null;
}

// ── What a payable table declares ────────────────────────────────────────────

export const MAX_CART_LINES = 50;
export const MAX_LINE_QTY = 999;

/**
 * The columns a payable table carries. Platform-managed: written by the
 * checkout route and the webhook, by nothing else, and never by a form. Named
 * here rather than in the schema engine so the engine, the lint and the
 * generator's rules all read one list.
 */
export const PAYMENT_COLUMNS = ["payment_status", "payment_ref", "amount_total", "currency", "paid_at"];

/**
 * The `payment` block on a `collect` table, normalised.
 *
 * `from` is the DISPLAY table the prices are read out of, and it must be a real
 * table on this site — the checkout route puts it into SQL, so it is checked
 * against the declared schema and never trusted from a request.
 */
export function normalizePayment(def) {
  const p = def && (def.payment || def.checkout || def.pay);
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const from = String(p.from || p.items || p.catalogue || p.catalog || "").toLowerCase();
  const price = String(p.price || p.priceColumn || p.price_column || "price").toLowerCase();
  const name = String(p.name || p.nameColumn || p.name_column || "name").toLowerCase();
  if (!/^[a-z_][a-z0-9_]{0,40}$/.test(from) || !/^[a-z0-9_]{1,40}$/.test(price) || !/^[a-z0-9_]{1,40}$/.test(name)) return null;
  return { from, price, name, currency: normalizeCurrency(p.currency) || DEFAULT_CURRENCY };
}

/**
 * The cart the browser sent, reduced to the only two things it is allowed to
 * decide: WHICH row, and HOW MANY. Anything else a page might post — a price, a
 * total, a discount, a currency — is dropped here rather than validated later,
 * because a field that never enters the calculation cannot be wrong about it.
 */
/**
 * A count, from a number or a string of digits, and from nothing else.
 *
 * Number() alone is too generous in a way that matters here: Number(true) is 1
 * and Number(["3"]) is 3, so a boolean or a one-element array would sail
 * through `isSafeInteger` as a real quantity. A plain string IS accepted,
 * because `<input type="number">` hands back a string and refusing it would
 * break the ordinary way a basket is built.
 */
function countFrom(v) {
  if (typeof v === "number") return Number.isSafeInteger(v) ? v : null;
  if (typeof v === "string" && /^\d{1,15}$/.test(v.trim())) return Number(v.trim());
  return null;
}

export function parseCart(body) {
  const raw = body && (body.items || body.cart || body.lines);
  if (!Array.isArray(raw) || !raw.length) return { ok: false, error: "the basket is empty" };
  if (raw.length > MAX_CART_LINES) return { ok: false, error: "too many items in the basket" };
  const items = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") return { ok: false, error: "that basket could not be read" };
    // An id is a positive integer: it goes into SQL, and a row id in this
    // schema engine is always a sequential integer.
    const id = countFrom(it.id);
    if (id == null || id <= 0) return { ok: false, error: "that basket could not be read" };
    // A missing quantity is one — a "Buy" button that posts a bare id is the
    // common case and refusing it would be pedantry. A present one must be a
    // real count: 0 is a line that should not be there, and a fraction or a
    // negative is somebody probing whether the total can be driven down.
    const qtyRaw = it.qty == null && it.quantity == null ? 1 : countFrom(it.qty != null ? it.qty : it.quantity);
    if (qtyRaw == null || qtyRaw < 1 || qtyRaw > MAX_LINE_QTY) return { ok: false, error: "check the quantities in your basket" };
    items.push({ id, qty: qtyRaw });
  }
  // Two lines for one product are merged rather than refused: a page that adds
  // the same item twice is a page, not an attack, and merging keeps the Stripe
  // line items matching what the customer sees.
  const byId = new Map();
  for (const it of items) byId.set(it.id, Math.min((byId.get(it.id) || 0) + it.qty, MAX_LINE_QTY));
  return { ok: true, items: [...byId].map(([id, qty]) => ({ id, qty })) };
}

/**
 * Price the cart against the site's own rows.
 *
 * deps.readRows(from, ids) → the catalogue rows, by id, from the site's database.
 *
 * Every refusal here is deliberate and none of them fall through to a charge:
 * an id the catalogue does not have is a cart built against another site or a
 * deleted product; an unreadable price is the owner's data, not the customer's
 * problem, and charging a guess would be worse than saying so.
 */
export async function priceCart(deps, { payment, items }) {
  const rows = (await deps.readRows(payment.from, items.map((i) => i.id))) || [];
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  const lines = [];
  let total = 0;
  for (const it of items) {
    const row = byId.get(it.id);
    if (!row) return { ok: false, status: 409, error: "something in your basket is no longer available" };
    const unit = toMinorUnits(row[payment.price], payment.currency);
    if (unit == null) return { ok: false, status: 409, error: "something in your basket is not priced yet" };
    // A free line is allowed to EXIST — a shop may list a £0 sample — but the
    // order total is checked below, because Stripe refuses a zero-amount
    // session and a silent failure at that point looks like a broken button.
    const label = String(row[payment.name] == null ? "" : row[payment.name]).slice(0, 250) || `#${it.id}`;
    lines.push({ id: it.id, name: label, unit, qty: it.qty, amount: unit * it.qty });
    total += unit * it.qty;
  }
  if (total <= 0) return { ok: false, status: 409, error: "that basket comes to nothing" };
  if (!Number.isSafeInteger(total)) return { ok: false, status: 409, error: "that basket is too large" };
  return { ok: true, lines, total, currency: payment.currency };
}

// ── The Stripe call ──────────────────────────────────────────────────────────

/**
 * Stripe's API is form-encoded with bracketed paths, not JSON, and there is no
 * helper for it in a Worker. Written here rather than inline so the exact body
 * can be asserted — a wrong bracket is a silently different request.
 */
export function formEncode(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((el, i) => out.push(typeof el === "object" ? formEncode(el, `${key}[${i}]`) : `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(el))}`));
    else if (typeof v === "object") out.push(formEncode(v, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.filter(Boolean).join("&");
}

/**
 * The Checkout Session body.
 *
 * `price_data` inline rather than a Stripe Price id, deliberately: the prices
 * live in the site's own table and the owner edits them in the Data panel. A
 * Price id would mean maintaining the catalogue twice, in two places that
 * silently disagree — which is exactly the trade that made Payment Links the
 * cheap option rather than the right one.
 *
 * `client_reference_id` carries slug and order id, because the webhook arrives
 * on a request that knows nothing else. Metadata carries them too: the
 * reference is what a human reads in the dashboard, metadata is what code
 * should key on, and having both costs nothing.
 */
export function checkoutSessionArgs({ slug, table, orderId, lines, currency, successUrl, cancelUrl, email }) {
  return {
    mode: "payment",
    // Stripe returns to the site with the id in the URL so a success page can
    // say what was bought. It is NOT proof of payment — anyone can visit that
    // URL — which is why the paid flag is only ever set by the webhook.
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: `${slug}:${table}:${orderId}`,
    metadata: { isibi_slug: slug, isibi_table: table, isibi_order: String(orderId) },
    ...(email ? { customer_email: email } : {}),
    line_items: lines.map((l) => ({
      quantity: l.qty,
      price_data: { currency, unit_amount: l.unit, product_data: { name: l.name } },
    })),
  };
}

// ── The webhook ──────────────────────────────────────────────────────────────

/**
 * What this event means for an order, or null for the many it means nothing for.
 *
 * Stripe sends an endpoint everything it is subscribed to, and an owner may
 * subscribe to more than we asked; a handler that assumed the shape of what it
 * got would mark orders paid off unrelated events.
 *
 * `payment_status` is checked as well as the event type, because
 * checkout.session.completed ALSO fires for a session completed without an
 * immediate payment — a delayed method like a bank debit is `unpaid`, and
 * treating it as paid ships the goods before the money settles.
 */
export function paidFromEvent(event) {
  const type = event && event.type;
  const o = (event && event.data && event.data.object) || {};
  if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") return null;
  // EXACTLY "paid", and nothing else. The first draft accepted
  // `status === "complete"` as an alternative, which also matches
  // `payment_status: "no_payment_required"` — a fully-discounted or
  // zero-amount session — and would have marked such an order paid. We never
  // create one (priceCart refuses a zero total), so seeing one means a session
  // we did not make, which is the last thing that should mark goods as sold.
  // An allow-list of one, for the same reason verifySession became one.
  if (o.payment_status !== "paid") return null;
  const meta = o.metadata || {};
  const ref = String(o.client_reference_id || "");
  const parts = ref.split(":");
  const slug = String(meta.isibi_slug || parts[0] || "").toLowerCase();
  const table = String(meta.isibi_table || parts[1] || "").toLowerCase();
  const orderId = Number(meta.isibi_order != null ? meta.isibi_order : parts[2]);
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) return null;
  if (!/^[a-z_][a-z0-9_]{0,40}$/.test(table)) return null;
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null;
  return {
    slug, table, orderId,
    ref: String(o.id || ""),
    // Recorded so the owner can reconcile against Stripe, and so a mismatch
    // between what we charged and what settled is visible rather than assumed.
    amount: Number.isSafeInteger(o.amount_total) ? o.amount_total : null,
    currency: normalizeCurrency(o.currency),
    email: (o.customer_details && o.customer_details.email) || o.customer_email || null,
  };
}

/**
 * A failed or abandoned checkout. Worth recording because the alternative is an
 * order stuck at `pending` forever, indistinguishable from one still being paid.
 */
export function failedFromEvent(event) {
  if (!event || event.type !== "checkout.session.expired") return null;
  const paid = paidFromEvent({ ...event, type: "checkout.session.completed", data: { object: { ...(event.data && event.data.object), payment_status: "paid" } } });
  return paid ? { ...paid, amount: null } : null;
}

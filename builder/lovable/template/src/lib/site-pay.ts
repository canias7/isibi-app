// THIS SITE TAKES ITS OWN PAYMENTS (2026-10-27): the owner's own Stripe
// account, this site's own database, nothing of the platform's.
//
// `POST /api/db/<this site>/checkout`: the cart priced from this site's own
// rows, a pending order written as the site's limited login, and a Stripe
// Checkout Session opened with the OWNER'S key. `POST /api/stripe/site/<this
// site>`: Stripe's "paid" / "expired" message, checked against the OWNER'S
// webhook secret, the order flipped, and what follows a payment run here.
// The pricing, the session's shape and the signature check are the platform's
// own modules, copied byte for byte into ./effects.
import { normalizePayment, parseCart, priceCart, checkoutSessionArgs, formEncode, paidFromEvent, failedFromEvent } from "./effects/site-payments.mjs";
import { verifyStripeSignature } from "./effects/stripe-webhook.mjs";
import { siteSql, runEffectsFor, type EffectEnv } from "./site-effects";

type Ctx = { waitUntil(p: Promise<unknown>): void };
type Table = { name: string; columns?: (string | { name: string })[] } & Record<string, unknown>;
export type PayEnv = EffectEnv & { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string };

/** A double-quoted SQL identifier, as the platform's `sqlIdent`. */
export const ident = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';

function tablesOf(env: PayEnv): Table[] {
  try { const t = JSON.parse(String(env.SITE_TABLES || "[]")); return Array.isArray(t) ? t : []; } catch { return []; }
}

const own = { "x-site-data": "own" };
const answer = (body: unknown, status = 200) => Response.json(body, { status, headers: own });

// Checkouts per visitor per minute, per isolate: each one reaches Stripe, so an
// unlimited endpoint spends the owner's Stripe rate budget. The platform's guard, kept here.
const CHECKOUTS_PER_MIN = 6;
const hits = new Map<string, { n: number; until: number }>();
function tooMany(ip: string): number {
  const now = Date.now();
  const b = hits.get(ip);
  if (!b || now >= b.until) { hits.set(ip, { n: 1, until: now + 60_000 }); if (hits.size > 5000) hits.clear(); return 0; }
  return ++b.n > CHECKOUTS_PER_MIN ? Math.ceil((b.until - now) / 1000) : 0;
}

export async function siteCheckout(request: Request, env: PayEnv, url: URL, slug: string, ctx?: Ctx): Promise<Response | null> {
  if (url.pathname.toLowerCase() !== "/api/db/" + slug + "/checkout" || request.method !== "POST") return null;
  if (!env.APP_CONN || !env.SITE_TABLES) return null;
  const wait = tooMany(request.headers.get("CF-Connecting-IP") || "unknown");
  if (wait) return Response.json({ error: "too many tries — wait a moment" }, { status: 429, headers: { ...own, "retry-after": String(wait) } });
  const conn = env.APP_CONN as string;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return answer({ error: "invalid JSON" }, 400); }
  const tables = tablesOf(env);
  const table = tables.find((t) => t && String(t.name).toLowerCase() === String(body.table || "").toLowerCase());
  const payment = table && normalizePayment(table);
  if (!table || !payment) return answer({ error: "that isn't something you can pay for here" }, 404);
  const cart = parseCart(body);
  if (!cart.ok) return answer({ error: cart.error }, 400);
  let priced;
  try {
    priced = await priceCart({
      readRows: async (from: string, ids: unknown[]) => {
        if (!tables.some((t) => String(t.name).toLowerCase() === from)) throw new Error("payment.from names no declared table");
        return siteSql(conn, `SELECT id, ${ident(payment.name)}, ${ident(payment.price)} FROM ${ident(from)} WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
      },
    }, { payment, items: cart.items });
  } catch { return answer({ error: "we couldn't price that just now" }, 503); }
  if (!priced.ok) return answer({ error: priced.error }, priced.status || 409);
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return answer({ error: "this shop hasn't finished setting up payments yet" }, 503);

  const declared = new Set((table.columns || []).map((c) => String(typeof c === "string" ? c : c.name).toLowerCase()));
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries((body.fields as Record<string, unknown>) || {})) {
    const low = String(k).toLowerCase();
    if (declared.has(low) && v != null && typeof v !== "object") fields[low] = String(v).slice(0, 2000);
  }
  const cols = ["payment_status", "amount_total", "currency", ...Object.keys(fields)];
  const vals = ["pending", priced.total, priced.currency, ...Object.values(fields)];
  let orderId: unknown;
  try {
    const ins = await siteSql(conn, `INSERT INTO ${ident(table.name)} (${cols.map(ident).join(",")}) VALUES (${cols.map(() => "?").join(",")}) RETURNING id`, vals);
    orderId = ins && ins[0] && ins[0].id;
  } catch { orderId = null; }
  if (!orderId) return answer({ error: "we couldn't start that payment — please try again" }, 500);
  runEffectsFor(env, ctx, { slug, def: table, table: String(table.name).toLowerCase(), action: "created", submission: false,
    row: { id: orderId, payment_status: "pending", amount_total: priced.total, currency: priced.currency, ...fields } });

  const base = url.origin + "/";
  const args = checkoutSessionArgs({
    slug, table: table.name, orderId, lines: priced.lines, currency: priced.currency,
    successUrl: `${base}?paid=${orderId}`, cancelUrl: `${base}?cancelled=${orderId}`,
    email: fields.email || fields.customer_email || null,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `isibi-${slug}-${table.name}-${orderId}` },
    body: formEncode(args),
  });
  const out = (await res.json().catch(() => ({}))) as { url?: string; id?: string };
  if (!res.ok || !out.url) return answer({ error: "we couldn't start that payment — please try again" }, 502);
  const ref = siteSql(conn, `UPDATE ${ident(table.name)} SET payment_ref=? WHERE id=?`, [String(out.id || ""), orderId]).catch(() => []);
  if (ctx) ctx.waitUntil(ref); else await ref;
  return answer({ ok: true, url: out.url, orderId });
}

export async function stripeSiteWebhook(request: Request, env: PayEnv, url: URL, slug: string, ctx?: Ctx): Promise<Response | null> {
  if (url.pathname.toLowerCase() !== "/api/stripe/site/" + slug || request.method !== "POST") return null;
  if (!env.APP_CONN || !env.SITE_TABLES) return null;
  const conn = env.APP_CONN as string;
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return answer({ error: "not configured" }, 503);
  const raw = await request.text();
  const ver = await verifyStripeSignature({ header: request.headers.get("Stripe-Signature") || "", raw, secrets: [secret], nowMs: Date.now() });
  if (!ver.ok) return answer({ error: "bad signature" }, 400);
  let event: unknown;
  try { event = JSON.parse(raw); } catch { return answer({ error: "bad body" }, 400); }
  const tables = tablesOf(env);
  const payable = (name: string) => tables.find((x) => String(x.name).toLowerCase() === name && normalizePayment(x));
  const paid = paidFromEvent(event);
  const lapsed = paid ? null : failedFromEvent(event);
  if (lapsed && lapsed.slug === slug) {
    const t = payable(lapsed.table);
    if (!t) return answer({ ok: true, ignored: "not a payable table" });
    try { await siteSql(conn, `UPDATE ${ident(t.name)} SET payment_status=?, payment_ref=? WHERE id=? AND payment_status='pending'`, [lapsed.status, lapsed.ref, lapsed.orderId]); }
    catch { return answer({ error: "could not record that checkout" }, 500); }
    return answer({ ok: true });
  }
  if (!paid) return answer({ ok: true, ignored: true });
  if (paid.slug !== slug) return answer({ ok: true, ignored: "slug mismatch" });
  const t = payable(paid.table);
  if (!t) return answer({ ok: true, ignored: "not a payable table" });
  let stored: unknown = null;
  try {
    const flipped = await siteSql(conn,
      `UPDATE ${ident(t.name)} SET payment_status='paid', payment_ref=?, paid_at=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') WHERE id=? AND payment_status<>'paid' RETURNING *`,
      [paid.ref, paid.orderId]);
    stored = flipped && flipped[0];
  } catch { return answer({ error: "could not record that payment" }, 500); }
  if (stored) runEffectsFor(env, ctx, { slug, def: t, table: String(t.name).toLowerCase(), action: "updated", submission: true, row: stored });
  return answer({ ok: true });
}

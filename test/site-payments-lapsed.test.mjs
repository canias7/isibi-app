// Audit A12-6: an expired session or a delayed debit that failed must move a
// pending order off `pending`, and the Payments panel must ask the owner to
// subscribe to the events that say so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { failedFromEvent, paidFromEvent } from "../site-payments.mjs";
import { loadTemplate } from "./fixtures/template-ts.mjs";

const ev = (type, extra = {}) => ({ type, data: { object: { id: "cs_x", client_reference_id: "store:orders:42", metadata: {}, ...extra } } });

test("an expired session reads as expired, a failed delayed debit as failed", () => {
  assert.equal(failedFromEvent(ev("checkout.session.expired")).status, "expired");
  const f = failedFromEvent(ev("checkout.session.async_payment_failed"));
  assert.equal(f.status, "failed");
  assert.equal(f.orderId, 42);
  assert.equal(f.amount, null);
});

test("neither reads as paid, and a paid or unrelated event is not a lapse", () => {
  assert.equal(paidFromEvent(ev("checkout.session.async_payment_failed")), null);
  assert.equal(failedFromEvent(ev("checkout.session.completed", { payment_status: "paid" })), null);
  assert.equal(failedFromEvent(ev("checkout.session.async_payment_succeeded", { payment_status: "paid" })), null);
  assert.equal(failedFromEvent(ev("toString")), null);
  assert.equal(failedFromEvent(null), null);
});

// The site webhook now runs in the site's own Worker (2026-10-28: the site's
// own Worker): builder/lovable/template/src/lib/site-pay.ts, driven here.
async function stripeSig(secret, raw, t = Math.floor(Date.now() / 1000)) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(t + "." + raw));
  return "t=" + t + ",v1=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

test("the site webhook moves only a pending order with the lapse's status", async () => {
  const { stripeSiteWebhook } = await loadTemplate("lib/site-pay.ts");
  const sql = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    if (String(u).endsWith("/sql")) { sql.push(JSON.parse(init.body)); return new Response(JSON.stringify({ rows: [] })); }
    return new Response("{}", { status: 404 });
  };
  const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/db", STRIPE_WEBHOOK_SECRET: "whsec_owner",
    SITE_TABLES: JSON.stringify([{ name: "orders", payment: { from: "menu", name: "name", price: "price" } }]) };
  const url = new URL("https://gofarther.dev/api/stripe/site/store");
  const send = async (event) => {
    const raw = JSON.stringify(event);
    return stripeSiteWebhook(new Request(url, { method: "POST", headers: { "Stripe-Signature": await stripeSig("whsec_owner", raw) }, body: raw }), env, url, "store");
  };
  try {
    for (const [type, status] of [["checkout.session.expired", "expired"], ["checkout.session.async_payment_failed", "failed"]]) {
      sql.length = 0;
      const r = await send(ev(type));
      assert.equal(r.status, 200);
      assert.equal(sql.length, 1, type);
      assert.match(sql[0].query, /SET payment_status=\$1, payment_ref=\$2 WHERE id=\$3 AND payment_status='pending'$/);
      assert.deepEqual(sql[0].params, [status, "cs_x", 42]);
    }
    // Another site's lapse moves nothing here.
    sql.length = 0;
    const other = await send(ev("checkout.session.expired", { client_reference_id: "elsewhere:orders:42" }));
    assert.equal(other.status, 200);
    assert.equal(sql.length, 0);
  } finally { globalThis.fetch = real; }
});

test("the Payments panel lists all four checkout events", () => {
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const line = chat.split("\n").find((l) => l.includes("Developers \\u2192 Webhooks"));
  assert.ok(line, "landmark");
  for (const e of ["completed", "async_payment_succeeded", "async_payment_failed", "expired"]) {
    assert.ok(line.includes("<code>checkout.session." + e + "</code>"), e);
  }
});

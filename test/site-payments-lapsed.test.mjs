// Audit A12-6: an expired session or a delayed debit that failed must move a
// pending order off `pending`, and the Payments panel must ask the owner to
// subscribe to the events that say so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { failedFromEvent, paidFromEvent } from "../site-payments.mjs";

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

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the site webhook moves only a pending order with the lapse's status", () => {
  const a = worker.indexOf('if (url.pathname.startsWith("/api/stripe/site/")');
  const b = worker.indexOf('if (url.pathname === "/api/stripe/webhook"', a);
  assert.ok(a > 0 && b > a, "landmarks");
  const route = worker.slice(a, b);
  assert.match(worker, /import \{[^}]*\bfailedFromEvent\b[^}]*\} from "\.\/site-payments\.mjs"/);
  const call = route.indexOf("failedFromEvent(event)");
  const ignored = route.indexOf("if (!paid) return Response.json({ ok: true, ignored: true });");
  assert.ok(call > 0 && ignored > call, "the lapse is read before an unpaid event is ignored");
  assert.match(route, /SET payment_status=\?, payment_ref=\? WHERE id=\? AND payment_status='pending'`, \[lapsed\.status, lapsed\.ref, lapsed\.orderId\]/);
  assert.match(route, /lapsed && lapsed\.slug === wslug/);
});

test("the Payments panel lists all four checkout events", () => {
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const line = chat.split("\n").find((l) => l.includes("Developers \\u2192 Webhooks"));
  assert.ok(line, "landmark");
  for (const e of ["completed", "async_payment_succeeded", "async_payment_failed", "expired"]) {
    assert.ok(line.includes("<code>checkout.session." + e + "</code>"), e);
  }
});

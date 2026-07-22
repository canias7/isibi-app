// Batch 137 — promotions / promo engine: percent/fixed/free-shipping, min-order, expiry, usage caps, atomic redeem
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 137");
const slug = "b137";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const mk = (body) => c.post(`/api/db/${slug}/promotions`, body, { token: ADMIN });
const validate = (code, body, tok) => c.post(`/api/db/${slug}/promotions/${code}/validate`, body, { token: tok || A });
const redeem = (code, body) => c.post(`/api/db/${slug}/promotions/${code}/redeem`, body, { token: ADMIN });

// Percent, fixed, free-shipping.
await mk({ code: "SAVE10", kind: "percent", value: 10 });
await mk({ code: "TENOFF", kind: "fixed", value: 10, min_order: 50 });
await mk({ code: "FREESHIP", kind: "free_shipping" });

// Validate computes the discount (codes are case-insensitive).
t.eq((await validate("save10", { order_total: 200 })).json.discount, 20, "10% of 200 = 20 (case-insensitive)");
t.eq((await validate("TENOFF", { order_total: 80 })).json.discount, 10, "fixed 10 off");
t.ok((await validate("FREESHIP", { order_total: 30 })).json.free_shipping, "free_shipping flag");
// fixed discount can't exceed the order.
t.eq((await validate("TENOFF", { order_total: 60 })).json.discount, 10, "fixed within order");

// Min-order gate.
let low = await validate("TENOFF", { order_total: 40 });
t.ok(!low.json.valid && low.json.reason === "min_order", "below min_order → invalid");

// Expiry / not-started.
await mk({ code: "EXPIRED", kind: "percent", value: 50, expires: "2020-01-01T00:00:00Z" });
t.eq((await validate("EXPIRED", { order_total: 100 })).json.reason, "expired", "past expiry → expired");
await mk({ code: "FUTURE", kind: "percent", value: 50, starts: "2099-01-01T00:00:00Z" });
t.eq((await validate("FUTURE", { order_total: 100 })).json.reason, "not_started", "before start → not_started");
// Inactive.
await mk({ code: "OFF", kind: "percent", value: 5, active: false });
t.eq((await validate("OFF", { order_total: 100 })).json.reason, "invalid", "inactive → invalid");

// Total usage cap — atomic; the 3rd redemption of a max_uses:2 code is refused.
await mk({ code: "LIMIT2", kind: "fixed", value: 5, max_uses: 2 });
t.eq((await redeem("LIMIT2", { order_total: 100 })).status, 200, "redeem 1");
t.eq((await redeem("LIMIT2", { order_total: 100 })).status, 200, "redeem 2");
let over = await redeem("LIMIT2", { order_total: 100 });
t.eq(over.status, 409, "redeem 3 over the cap → 409");
t.eq(over.json.reason, "exhausted", "409 reason exhausted (the pre-check catches it; the atomic insert is the race backstop)");
// validate now reports exhausted.
t.eq((await validate("LIMIT2", { order_total: 100 })).json.reason, "exhausted", "exhausted after cap");

// Per-user cap.
await mk({ code: "ONEPER", kind: "fixed", value: 5, per_user_max: 1 });
t.eq((await redeem("ONEPER", { order_total: 100, account: "u1" })).status, 200, "u1 first redeem ok");
t.eq((await redeem("ONEPER", { order_total: 100, account: "u1" })).status, 409, "u1 second → 409 (per-user cap)");
t.eq((await redeem("ONEPER", { order_total: 100, account: "u2" })).status, 200, "u2 can still redeem");
// per-user coupon needs an account to validate.
t.eq((await validate("ONEPER", { order_total: 100 })).json.reason, "account_required", "per-user coupon needs account");

// redeem is admin-only; validate is open to members.
t.eq((await c.post(`/api/db/${slug}/promotions/SAVE10/redeem`, { order_total: 100 }, { token: A })).status, 403, "member can't redeem");
t.eq((await validate("SAVE10", { order_total: 100 }, A)).status, 200, "member can validate");

// Management + guards.
t.eq((await c.get(`/api/db/${slug}/promotions/LIMIT2`, { token: ADMIN })).json.promotion.used, 2, "usage count on the coupon");
t.ok((await c.get(`/api/db/${slug}/promotions`, { token: ADMIN })).json.promotions.length >= 5, "list coupons");
t.eq((await mk({ code: "BAD", kind: "percent", value: 200 })).status, 400, "percent > 100 → 400");
t.eq((await mk({ code: "BAD2", kind: "nonsense" })).status, 400, "bad kind → 400");
t.eq((await validate("NOPE", { order_total: 100 })).json.valid, false, "unknown code → invalid");
t.eq((await c.del(`/api/db/${slug}/promotions/SAVE10`, { token: ADMIN })).status, 200, "delete coupon");
t.eq((await c.post(`/api/db/${slug}/promotions/SAVE10/validate`, { order_total: 100 })).status, 401, "signed-out → 401");

t.done(); h.restore();

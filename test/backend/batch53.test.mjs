import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 53");
const slug = "b53";
await c.ensure(slug);
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
// admin mints SAVE10 (2 uses) and EXPIRED
t.ok((await c.post(`/api/db/${slug}/coupons`, { code: "SAVE10", discount: { percent: 10 }, max_uses: 2 }, { token: ADMIN })).json.ok, "mint SAVE10");
await c.post(`/api/db/${slug}/coupons`, { code: "OLD", discount: { percent: 5 }, expires_at: new Date(Date.now()-86400e3).toISOString() }, { token: ADMIN });
// validate (public, no consume)
let r = await c.get(`/api/db/${slug}/coupon/save10`);
t.ok(r.json.valid === true && r.json.discount.percent === 10 && r.json.remaining === 2, "validate SAVE10 -> valid, discount, remaining 2");
t.ok((await c.get(`/api/db/${slug}/coupon/old`)).json.valid === false, "expired coupon -> not valid");
t.ok((await c.get(`/api/db/${slug}/coupon/nope`)).json.valid === false, "unknown -> not valid");
// validate doesn't consume
t.ok((await c.get(`/api/db/${slug}/coupon/save10`)).json.remaining === 2, "validate did not consume (still 2)");
// redeem twice (member) then 3rd fails
r = await c.post(`/api/db/${slug}/coupon/save10/redeem`, {}, { token: B });
t.ok(r.json.ok && r.json.discount.percent === 10, "redeem 1 -> ok");
t.ok((await c.post(`/api/db/${slug}/coupon/save10/redeem`, {}, { token: B })).json.ok, "redeem 2 -> ok");
r = await c.post(`/api/db/${slug}/coupon/save10/redeem`, {}, { token: B });
t.ok(r.status === 409 && r.json.ok === false, "redeem 3 -> 409 (used up)");
// redeem needs auth
t.ok((await c.post(`/api/db/${slug}/coupon/save10/redeem`, {})).status === 401, "redeem needs auth -> 401");
// admin list + delete
t.ok((await c.get(`/api/db/${slug}/coupons`, { token: ADMIN })).json.coupons.length === 2, "admin list -> 2 coupons");
t.ok((await c.get(`/api/db/${slug}/coupons`, { token: B })).status === 403, "non-admin list -> 403");
await c.del(`/api/db/${slug}/coupons/old`, { token: ADMIN });
t.ok((await c.get(`/api/db/${slug}/coupons`, { token: ADMIN })).json.coupons.length === 1, "after delete -> 1");
t.done(); h.restore();

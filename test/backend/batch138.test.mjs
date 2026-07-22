// Batch 138 — entitlements / subscriptions: grant a plan/feature, check active-now, expiry, ownership
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 138");
const slug = "b138";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2 (account "2")
const grant = (body) => c.post(`/api/db/${slug}/entitlements`, body, { token: ADMIN });
const check = (account, feature, tok) => c.get(`/api/db/${slug}/entitlements/check?account=${account}${feature ? "&feature=" + feature : ""}`, { token: tok || ADMIN });

// Grant a whole-account Pro plan with a future expiry → active.
let g = await grant({ account: "2", plan: "pro", expires: "2099-01-01T00:00:00Z" });
t.eq(g.status, 200, "grant → 200");
t.ok(g.json.active, "granted plan is active");
t.eq((await check("2")).json.active, true, "check (default feature) → active");
t.eq((await check("2")).json.plan, "pro", "check returns the plan");

// An expired entitlement is not active.
await grant({ account: "3", plan: "pro", expires: "2020-01-01T00:00:00Z" });
t.eq((await check("3")).json.active, false, "expired → not active");
t.eq((await check("3")).json.status, "active", "…even though status is still 'active' (expiry wins)");

// A not-yet-started entitlement is not active.
await grant({ account: "4", plan: "trial", starts: "2099-01-01T00:00:00Z" });
t.eq((await check("4")).json.active, false, "future start → not active yet");

// Cancelled status → not active regardless of expiry.
await grant({ account: "2", feature: "premium_reports", plan: "addon", status: "cancelled", expires: "2099-01-01T00:00:00Z" });
t.eq((await check("2", "premium_reports")).json.active, false, "cancelled → not active");
// but the default plan is still active (features are independent).
t.eq((await check("2")).json.active, true, "default plan unaffected by the feature's status");

// An account with no entitlement checks false.
t.eq((await check("999")).json.active, false, "unknown account → not active");

// List all of an account's entitlements.
let list = (await c.get(`/api/db/${slug}/entitlements?account=2`, { token: ADMIN })).json;
t.eq(list.entitlements.length, 2, "account 2 has 2 entitlements");
t.ok(list.entitlements.find((e) => e.feature === "default").active, "default active in the list");
t.ok(!list.entitlements.find((e) => e.feature === "premium_reports").active, "premium_reports inactive in the list");

// Upsert updates in place (renew → change expiry/plan).
await grant({ account: "2", plan: "max", expires: "2100-01-01T00:00:00Z" });
t.eq((await check("2")).json.plan, "max", "upsert renewed the plan");
t.eq((await c.get(`/api/db/${slug}/entitlements?account=2`, { token: ADMIN })).json.entitlements.length, 2, "upsert didn't duplicate");

// Ownership: a member checks/reads their OWN (account = their id "2") but not others; can't grant.
t.eq((await check("2", null, A)).json.active, true, "member checks own entitlement");
t.eq((await check("3", null, A)).status, 403, "member can't check another account");
t.eq((await grant({ account: "2", plan: "free" }) && await c.post(`/api/db/${slug}/entitlements`, { account: "2", plan: "hacked" }, { token: A })).status, 403, "member can't grant");

// Revoke.
t.eq((await c.del(`/api/db/${slug}/entitlements/premium_reports?account=2`, { token: ADMIN })).status, 200, "revoke a feature");
t.eq((await c.get(`/api/db/${slug}/entitlements?account=2`, { token: ADMIN })).json.entitlements.length, 1, "one entitlement left after revoke");

// Guards.
t.eq((await grant({ plan: "pro" })).status, 400, "missing account → 400");
t.eq((await c.get(`/api/db/${slug}/entitlements/check?account=2`)).status, 401, "signed-out → 401");

t.done(); h.restore();

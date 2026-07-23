// Batch 241 — LOYALTY TIERS. An admin defines spend thresholds with benefits; a member's running spend
// resolves to a tier + progress toward the next. Covers ladder replace/read, add spend, tier resolution,
// to_next, /me, admin per-member, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 241");
const slug = "b241";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const setTiers = (tok, tiers) => c.post(`/api/db/${slug}/loyalty/tiers`, { tiers }, tok === null ? {} : { token: tok });
const getTiers = () => c.get(`/api/db/${slug}/loyalty/tiers`).then((r) => r.json);
const addSpend = (tok, user, amount) => c.post(`/api/db/${slug}/loyalty/spend`, { user, amount }, { token: tok }).then((r) => r.json);
const me = (tok) => c.get(`/api/db/${slug}/loyalty/me`, { token: tok }).then((r) => r.json);
const ofUser = (tok, id) => c.get(`/api/db/${slug}/loyalty/${id}`, { token: tok }).then((r) => r.json);

// --- Define the ladder ---
t.eq((await setTiers(A, [
  { tier: "bronze", name: "Bronze", min_spend: 0, benefits: "5% off" },
  { tier: "silver", name: "Silver", min_spend: 100, benefits: "10% off" },
  { tier: "gold", name: "Gold", min_spend: 500, benefits: "20% off" },
])).json.tiers, 3, "admin sets a 3-tier ladder");
t.eq((await getTiers()).tiers.length, 3, "the ladder reads back");
t.eq((await getTiers()).tiers[1].min_spend, 100, "…thresholds in dollars");

// --- Add spend → tier resolution ---
let r = await addSpend(A, bId, 50);
t.eq(r.tier.tier, "bronze", "$50 → bronze");
t.eq(r.to_next, 50, "…$50 to silver");
r = await addSpend(A, bId, 60); // total 110
t.eq(r.spend, 110, "spend accumulates to $110");
t.eq(r.tier.tier, "silver", "…now silver");
t.eq(r.next.tier, "gold", "…next is gold");
t.eq(r.to_next, 390, "…$390 to gold");

// --- Top tier: no next ---
r = await addSpend(A, bId, 500); // total 610
t.eq(r.tier.tier, "gold", "$610 → gold (top)");
t.eq(r.next, null, "…no next tier");
t.eq(r.to_next, null, "…nothing to next");

// --- /me + admin per-member ---
t.eq((await me(B)).tier.tier, "gold", "B reads their own tier");
t.eq((await me(B)).tier.benefits, "20% off", "…with benefits");
t.eq((await ofUser(A, bId)).spend, 610, "admin reads a member's spend");

// --- Validation + authz ---
t.eq((await setTiers(A, [])).status, 400, "empty tiers → 400");
t.eq((await setTiers(A, [{ tier: "x", min_spend: 0 }, { tier: "x", min_spend: 5 }])).status, 400, "duplicate tier → 400");
t.eq((await c.post(`/api/db/${slug}/loyalty/spend`, { user: 999999, amount: 10 }, { token: A })).status, 404, "spend for a missing user → 404");
t.eq((await setTiers(B, [{ tier: "x", min_spend: 0 }])).status, 403, "a member can't set tiers → 403");
t.eq((await c.post(`/api/db/${slug}/loyalty/spend`, { user: bId, amount: 10 }, { token: B })).status, 403, "a member can't add spend → 403");
t.eq((await c.get(`/api/db/${slug}/loyalty/${bId}`, { token: B })).status, 403, "a member can't read another's status → 403");
t.eq((await c.get(`/api/db/${slug}/loyalty/me`)).status, 401, "signed-out /me → 401");

t.done(); h.restore();

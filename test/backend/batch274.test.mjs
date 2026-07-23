// Batch 274 — REWARDS CATALOG. An admin lists rewards (a points cost, optional stock); a member redeems by
// spending gamification points. Covers create, list, redeem (deduct points + stock), insufficient points →
// 409 (stock refunded), out-of-stock → 409, unlimited stock, my/all redemptions, patch, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 274");
const slug = "b274";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const create = (tok, body) => c.post(`/api/db/${slug}/rewards-catalog`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/rewards-catalog${q || ""}`, tok ? { token: tok } : {}).then((r) => r.json);
const redeem = (tok, id) => c.post(`/api/db/${slug}/rewards-catalog/${id}/redeem`, {}, { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/rewards-catalog/mine`, { token: tok }).then((r) => r.json);
const reds = (tok) => c.get(`/api/db/${slug}/rewards-catalog/redemptions`, { token: tok }).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/rewards-catalog/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/rewards-catalog/${id}`, { token: tok });
const bal = () => h.getDb(uuid).prepare("SELECT COALESCE(SUM(delta),0) AS b FROM _points_ledger WHERE user_id=?").all(bId)[0].b;

// Give B 200 points.
await c.post(`/api/db/${slug}/points/award`, { user: bId, amount: 200 }, { token: A });

// --- Create rewards ---
const mug = (await create(A, { name: "Mug", cost: 50, stock: 2 })).json.id;
const sticker = (await create(A, { name: "Sticker", cost: 10 })).json.id; // unlimited
t.ok(mug && sticker, "admin creates rewards");

// --- List ---
t.eq((await list(null)).rewards.length, 2, "public sees 2 rewards");
t.ok((await list(null)).rewards.find((r) => r.id === sticker).unlimited, "…sticker is unlimited");

// --- Redeem (deduct points + stock) ---
let r = (await redeem(B, mug)).json;
t.eq(r.balance, 150, "redeem Mug (50) → 150 points left");
t.eq(bal(), 150, "…points ledger reflects it");
t.eq((await list(null)).rewards.find((x) => x.id === mug).stock, 1, "…stock drops to 1");

// --- Out of stock ---
await redeem(A, mug); // A has 0 points... will 409 on points. Let's redeem the 2nd via B instead
// B redeems the last mug
r = await redeem(B, mug);
t.ok(r.status === 200 || r.json.ok, "B redeems the 2nd mug");
t.eq((await list(null)).rewards.find((x) => x.id === mug).stock, 0, "…stock now 0");
t.eq((await redeem(B, mug)).status, 409, "…a 3rd redemption → 409 out of stock");

// --- Insufficient points (B has 50 left, sticker is cheap but let's drain) ---
// B has 150 - 50 = 100 left after 2 mugs. Redeem sticker (10) a few times is fine; make an expensive item
const expensive = (await create(A, { name: "Laptop", cost: 100000 })).json.id;
r = await redeem(B, expensive);
t.eq(r.status, 409, "redeeming beyond the balance → 409");
t.ok(/not enough points/i.test(r.json.error), "…with a not-enough-points error");
// stock was unlimited so nothing to refund; verify balance unchanged
t.eq(bal(), 100, "…points unchanged after the failed redeem");

// --- Redemptions log ---
t.ok((await mine(B)).redemptions.length >= 2, "B sees their redemptions");
t.ok((await reds(A)).redemptions.length >= 2, "admin sees all redemptions");

// --- Patch + delete ---
t.eq((await patch(A, sticker, { cost: 5 })).json.id, sticker, "admin edits a reward");
t.eq((await del(A, expensive)).json.deleted, true, "admin deletes a reward");

// --- Validation + authz ---
t.eq((await create(A, { cost: 10 })).status, 400, "missing name → 400");
t.eq((await create(A, { name: "x" })).status, 400, "missing cost → 400");
t.eq((await redeem(B, 999999)).status, 404, "redeeming a missing reward → 404");
t.eq((await create(B, { name: "x", cost: 1 })).status, 403, "a member can't create → 403");
t.eq((await reds(B)).status ?? 403, 403, "a member can't read all redemptions → 403");
t.eq((await c.get(`/api/db/${slug}/rewards-catalog/redemptions`, { token: B })).status, 403, "…confirmed 403");
t.eq((await c.post(`/api/db/${slug}/rewards-catalog/${sticker}/redeem`, {})).status, 401, "signed-out redeem → 401");

t.done(); h.restore();

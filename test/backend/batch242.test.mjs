// Batch 242 — STORE-CREDIT LEDGER. An admin issues store credit to a member; the member redeems it (never
// below zero). Append-only, balance = sum. Covers issue, balance, redeem (atomic sufficient-balance guard),
// insufficient → 409, history, admin per-member, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 242");
const slug = "b242";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const issue = (tok, user, amount, reason) => c.post(`/api/db/${slug}/store-credit/issue`, { user, amount, reason }, { token: tok }).then((r) => r.json);
const redeem = (tok, amount) => c.post(`/api/db/${slug}/store-credit/redeem`, { amount }, { token: tok });
const me = (tok) => c.get(`/api/db/${slug}/store-credit/me`, { token: tok }).then((r) => r.json);
const ofUser = (tok, id) => c.get(`/api/db/${slug}/store-credit/${id}`, { token: tok }).then((r) => r.json);

// --- Issue (admin) ---
t.eq((await issue(A, bId, 25, "refund")).balance, 25, "admin issues $25 → balance 25");
t.eq((await issue(A, bId, 10, "goodwill")).balance, 35, "…issue $10 more → 35");

// --- Balance + history (member) ---
let m = await me(B);
t.eq(m.balance, 35, "B reads balance 35");
t.eq(m.history.length, 2, "…2 ledger entries");
t.eq(m.history[0].amount, 10, "…newest first");

// --- Redeem (member) ---
let r = await redeem(B, 20);
t.eq(r.json.balance, 15, "B redeems $20 → 15 left");
t.eq((await me(B)).history[0].amount, -20, "…a negative ledger entry recorded");

// --- Insufficient → 409 ---
r = await redeem(B, 100);
t.eq(r.status, 409, "redeeming more than the balance → 409");
t.eq(r.json.balance, 15, "…balance unchanged");
t.eq((await me(B)).balance, 15, "…confirmed still 15");

// --- Redeem exact balance ---
t.eq((await redeem(B, 15)).json.balance, 0, "redeeming the exact balance → 0");
t.eq((await redeem(B, 1)).status, 409, "…then even $1 is refused");

// --- Admin per-member view ---
t.eq((await ofUser(A, bId)).balance, 0, "admin reads a member's balance");
t.ok((await ofUser(A, bId)).history.length >= 4, "…with full history");

// --- Validation + authz ---
t.eq((await issue(A, bId, -5)).status ?? 400, 400, "issuing a negative amount → 400");
t.eq((await c.post(`/api/db/${slug}/store-credit/issue`, { user: bId, amount: -5 }, { token: A })).status, 400, "…confirmed 400");
t.eq((await c.post(`/api/db/${slug}/store-credit/issue`, { user: 999999, amount: 5 }, { token: A })).status, 404, "issuing to a missing user → 404");
t.eq((await c.post(`/api/db/${slug}/store-credit/issue`, { user: bId, amount: 5 }, { token: B })).status, 403, "a member can't issue → 403");
t.eq((await c.post(`/api/db/${slug}/store-credit/redeem`, { amount: 5 })).status, 401, "signed-out redeem → 401");
t.eq((await c.get(`/api/db/${slug}/store-credit/${bId}`, { token: B })).status, 403, "a member can't read another's ledger → 403");

t.done(); h.restore();

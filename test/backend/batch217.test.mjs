// Batch 217 — POINTS / KARMA LEDGER. A per-member gamification points balance backed by an append-only
// ledger. Covers award (add/deduct), balance = sum(delta), my history, admin view of a member, points
// leaderboard, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 217");
const slug = "b217";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const award = (tok, user, amount, reason) => c.post(`/api/db/${slug}/points/award`, { user, amount, reason }, { token: tok }).then((r) => r.json);
const me = (tok) => c.get(`/api/db/${slug}/points/me`, { token: tok }).then((r) => r.json);
const ofUser = (tok, id) => c.get(`/api/db/${slug}/points/${id}`, { token: tok }).then((r) => r.json);
const board = (q) => c.get(`/api/db/${slug}/points/leaderboard${q || ""}`).then((r) => r.json);
const bId = idOf("b@x.dev"), cId = idOf("c@x.dev");

// --- Award (admin) ---
t.eq((await award(A, bId, 100, "signup bonus")).balance, 100, "award 100 → balance 100");
t.eq((await award(A, bId, 50, "referral")).balance, 150, "award 50 more → 150");
t.eq((await award(A, bId, -30, "penalty")).balance, 120, "deduct 30 → 120");
await award(A, cId, 200, "big win");

// --- My balance + history (member) ---
let m = await me(B);
t.eq(m.balance, 120, "B reads own balance 120");
t.eq(m.history.length, 3, "…with 3 ledger entries");
t.eq(m.history[0].reason, "penalty", "…newest first");

// --- Admin views a member ---
t.eq((await ofUser(A, cId)).balance, 200, "admin reads C's balance 200");

// --- Leaderboard (public, ranked) ---
let lb = (await board()).leaderboard;
t.eq(lb[0].user_id, cId, "C (200) leads");
t.eq(lb[0].rank, 1, "…rank 1");
t.eq(lb[1].user_id, bId, "B (120) second");
t.eq((await board("?limit=1")).leaderboard.length, 1, "limit caps the list");

// --- Zero-balance members are excluded ---
await award(A, bId, -120, "reset to zero");
t.ok(!(await board()).leaderboard.some((r) => r.user_id === bId), "a zeroed-out member drops off the leaderboard");

// --- Validation + authz ---
t.eq((await award(A, bId, 0)).ok ?? false, false, "a zero amount → rejected");
t.eq((await c.post(`/api/db/${slug}/points/award`, { user: 999999, amount: 10 }, { token: A })).status, 404, "awarding a missing user → 404");
t.eq((await c.post(`/api/db/${slug}/points/award`, { user: bId, amount: 10 }, { token: B })).status, 403, "a member can't award → 403");
t.eq((await c.get(`/api/db/${slug}/points/${cId}`, { token: B })).status, 403, "a member can't view another's ledger → 403");
t.eq((await c.get(`/api/db/${slug}/points/me`)).status, 401, "signed-out /me → 401");

t.done(); h.restore();

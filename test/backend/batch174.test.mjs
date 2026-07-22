// Batch 174 — REFERRAL TRACKING + ATTRIBUTION. Every member has one stable, deterministic referral
// code; a new member claims a code exactly ONCE (atomic guard) to attribute themselves to a referrer;
// /mine lists who I referred; /leaderboard (admin) ranks top referrers. Plus every guard.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 174");
const slug = "b174";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 = admin (first signup)
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const code = (tok) => c.post(`/api/db/${slug}/referrals/code`, {}, { token: tok });
const claim = (tok, body) => c.post(`/api/db/${slug}/referrals/claim`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/referrals/mine`, { token: tok }).then((r) => r.json);
const board = (tok, qs) => c.get(`/api/db/${slug}/referrals/leaderboard${qs || ""}`, { token: tok });

// --- Stable, get-or-create code ---
const ac = (await code(A)).json;
t.ok(typeof ac.code === "string" && ac.code.length >= 2, "A gets a referral code");
t.eq((await code(A)).json.code, ac.code, "code is stable — asking again returns the SAME code");
const bc = (await code(B)).json.code;
t.ok(bc !== ac.code, "different members get different codes");

// --- Claim: B attributes to A (once) ---
let r = await claim(B, { code: ac.code });
t.eq(r.status, 200, "B claims A's code → 200");
t.eq(r.json.referrer_id, 1, "…attributed to A (id 1)");
// case-insensitive: the code round-trips uppercase, a lowercase claim still resolves.
t.eq((await claim(C, { code: ac.code.toLowerCase() })).json.referrer_id, 1, "C claims (lowercase) → also A");

// --- Once-only: a second claim by B is refused, even for a DIFFERENT (non-self) valid code ---
t.eq((await claim(B, { code: ac.code })).status, 409, "B's second claim → 409 already claimed");
const cc = (await code(C)).json.code; // C's own code (a different, non-self target for B)
t.eq((await claim(B, { code: cc })).status, 409, "…and B can't switch to another code either (once-only)");

// --- Self-referral, unknown code, blank ---
t.eq((await claim(A, { code: ac.code })).status, 400, "A can't refer themselves → 400");
t.eq((await claim(B, { code: "NOPE9999" })).status, 404, "unknown code → 404");
t.eq((await claim(A, { code: "  " })).status, 400, "blank code → 400");

// --- /mine reflects who I referred ---
let am = await mine(A);
t.eq(am.code, ac.code, "A's /mine echoes A's code");
t.eq(am.referred_count, 2, "A referred 2 (B and C)");
t.eq(am.referred.map((x) => x.user_id).sort((p, q) => p - q), [2, 3], "…the referred user ids are B(2) and C(3)");
t.ok(am.referred.every((x) => typeof x.at === "string"), "each referral carries a timestamp");
let bm = await mine(B);
t.eq(bm.referred_count, 0, "B referred nobody → count 0");
t.ok(bm.code === bc, "B's /mine still shows B's own code");

// --- Leaderboard (admin only) ---
let lb = (await board(A)).json;
t.eq(lb.leaderboard[0], { referrer_id: 1, count: 2 }, "leaderboard tops out with A (2 referrals)");
t.eq((await board(A, "?limit=1")).json.leaderboard.length, 1, "limit is honored");
t.eq((await board(B)).status, 403, "a non-admin can't read the leaderboard → 403");

// --- Guards ---
t.eq((await claim(null, { code: ac.code })).status, 401, "signed-out claim → 401");
t.eq((await c.get(`/api/db/${slug}/referrals/code`, { token: A })).status, 405, "GET /code → 405 (POST only)");
t.eq((await c.post(`/api/db/${slug}/referrals/mine`, {}, { token: A })).status, 405, "POST /mine → 405 (read-only)");
t.eq((await c.get(`/api/db/${slug}/referrals`, { token: A })).status, 404, "no sub-action → 404");

t.done(); h.restore();

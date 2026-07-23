// Batch 321 — REPUTATION / KARMA (time-decayed). Each award is a timestamped event; the score sums points
// weighted by an exponential half-life. Covers award, decayed score (fresh vs aged), me, leaderboard, owner
// scoping, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 321");
const slug = "b321";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev"), c3 = idOf("c@x.dev");
const award = (tok, body) => c.post(`/api/db/${slug}/reputation/award`, body, tok === null ? {} : { token: tok });
const score = (tok, q) => c.get(`/api/db/${slug}/reputation/score${q}`, { token: tok }).then((r) => r.json);
const me = (tok, q) => c.get(`/api/db/${slug}/reputation/me${q || ""}`, { token: tok }).then((r) => r.json);
const board = (q) => c.get(`/api/db/${slug}/reputation/leaderboard${q || ""}`).then((r) => r.json);

// --- Award ---
t.eq((await award(A, { user: b2, points: 100, reason: "great answer" })).json.points, 100, "admin awards reputation");
await award(A, { user: c3, points: 40 });

// --- Fresh score ~ full points ---
let s = await score(A, "?user=" + b2 + "&half_life_days=30");
t.ok(Math.abs(s.score - 100) < 1, "a fresh award decays almost not at all");
t.eq(s.raw, 100, "…raw sum is the undiscounted total");

// --- Aged events decay: push B's event ~30 days back (one half-life) → ~50 ---
h.getDb(uuid).prepare("UPDATE _reputation SET at=? WHERE user_id=?").run(new Date(Date.now() - 30 * 86400000).toISOString(), b2);
s = await score(A, "?user=" + b2 + "&half_life_days=30");
t.ok(s.score > 45 && s.score < 55, "after one half-life the score is ~half");
t.eq(s.raw, 100, "…raw is unchanged by decay");

// --- Me ---
let m = await me(B, "?half_life_days=30");
t.ok(m.score > 45 && m.score < 55, "member reads their own decayed score");
t.eq(m.events.length, 1, "…with their events");

// --- Leaderboard (B decayed ~50, C fresh 40 → B still ahead) ---
let lb = (await board("?half_life_days=30")).leaderboard;
t.eq(lb[0].user_id, b2, "B tops the decayed leaderboard");
t.ok(lb.find((x) => x.user_id === c3), "C is present");

// --- Owner scoping + authz ---
t.eq((await c.get(`/api/db/${slug}/reputation/score?user=${c3}`, { token: B })).status, 403, "a member can't read another's score → 403");
t.eq((await score(B, "?user=" + b2)).ok, true, "…but can read their own");
t.eq((await award(B, { user: c3, points: 5 })).status, 403, "a member can't award → 403");
t.eq((await award(A, { user: b2, points: 0 })).status, 400, "zero points → 400");
t.eq((await award(A, { user: 999999, points: 5 })).status, 404, "an unknown user → 404");
t.eq((await c.post(`/api/db/${slug}/reputation/award`, { user: b2, points: 5 })).status, 401, "signed-out → 401");

t.done(); h.restore();

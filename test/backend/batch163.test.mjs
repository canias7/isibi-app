// Batch 163 — ADVERSARIAL: auth & authorization. Cross-tenant token reuse, role-escalation via
// mass-assignment (signup body + profile PATCH), tampered tokens, admin-endpoint gating, and PII leak.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 163");
const s1 = "b163a", s2 = "b163b";
await c.ensure(s1); await c.ensure(s2);
await c.schema(s1, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
await c.schema(s2, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(s1, "admin@x.dev", "Str0ng-pass-9")).json.token; // s1 admin (id1)

// --- Cross-tenant token reuse: an s1 token must NOT work on s2 ---
t.eq((await c.get(`/api/db/${s1}/auth/me`, { token: ADMIN })).status, 200, "s1 token works on s1");
t.eq((await c.get(`/api/db/${s2}/auth/me`, { token: ADMIN })).status, 401, "an s1 token is rejected on s2 (tenant isolation)");
t.eq((await c.get(`/api/db/${s2}/audit`, { token: ADMIN })).status, 401, "…and can't reach s2 admin endpoints either");

// --- Role escalation via the signup body: a 2nd signup can't self-assign admin ---
const B = (await c.signup(s1, "b@x.dev", "Str0ng-pass-9", { role: "admin" })).json.token; // id2, tries role:admin
t.eq((await c.get(`/api/db/${s1}/auth/me`, { token: B })).json.user.role, "user", "signup body can't grant admin — 2nd user is a plain 'user'");
// The forged-admin can't reach an admin-only endpoint.
t.eq((await c.get(`/api/db/${s1}/audit`, { token: B })).status, 403, "the non-admin is blocked from /audit");

// --- Role/PII escalation via profile PATCH: role/email/verified are NOT editable there ---
await c.patch(`/api/db/${s1}/profile/me`, { role: "admin", email: "hacker@x.dev", verified: 1, display_name: "Bee" }, { token: B });
let me = (await c.get(`/api/db/${s1}/auth/me`, { token: B })).json.user;
t.eq(me.role, "user", "profile PATCH can't escalate role");
t.eq(me.email, "b@x.dev", "profile PATCH can't change email");
t.eq((await c.get(`/api/db/${s1}/profile/me`, { token: B })).json.profile.display_name, "Bee", "…but the real profile field DID update");

// --- Tampered / garbage tokens are rejected ---
t.eq((await c.get(`/api/db/${s1}/auth/me`, { token: "garbage.token.here" })).status, 401, "a garbage token → 401");
t.eq((await c.get(`/api/db/${s1}/auth/me`, { token: ADMIN + "x" })).status, 401, "a mutated (signature-broken) token → 401");

// --- Admin-only endpoints are uniformly gated for a non-admin ---
const adminEps = [
  ["GET", `/api/db/${s1}/audit`], ["GET", `/api/db/${s1}/leave/balances`],
  ["POST", `/api/db/${s1}/wallet`], ["POST", `/api/db/${s1}/ledger/entries`],
  ["POST", `/api/db/${s1}/kpi`], ["GET", `/api/db/${s1}/segments`],
  ["GET", `/api/db/${s1}/analytics?days=7`], ["GET", `/api/db/${s1}/webhooks`],
];
let allGated = true;
for (const [m, p] of adminEps) { const r = await c.call(m, p, { token: B, body: m === "POST" ? {} : undefined }); if (r.status !== 403) { allGated = false; console.log("  ⚠ not 403:", m, p, "→", r.status); } }
t.ok(allGated, "every admin-only endpoint returns 403 for a non-admin member");

// --- Public profile read never leaks PII (email / password hash) ---
let pub = (await c.get(`/api/db/${s1}/profile/2`, { token: ADMIN })).json.profile;
t.ok(pub && !("email" in pub) && !("pass_hash" in pub) && !("pass_salt" in pub), "public profile carries no email or password material");

// --- Duplicate email signup is refused ---
t.ok((await c.signup(s1, "b@x.dev", "Another-pass-9")).status >= 400, "signing up an existing email is refused");

// --- Signed-out access to a member endpoint ---
t.eq((await c.get(`/api/db/${s1}/auth/me`)).status, 401, "no token → 401");

t.done(); h.restore();

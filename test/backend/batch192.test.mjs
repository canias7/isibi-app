// Batch 192 — ONE-TIME CODES (OTP). Generate a code (returned once, stored hashed) then verify it with
// single-use, an attempt cap (lockout), and expiry. Covers the happy path, wrong-code attempts, lockout,
// expiry (via white-box), (purpose,identifier) isolation, and guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 192");
const slug = "b192";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id1
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const gen = (tok, body) => c.post(`/api/db/${slug}/otp/generate`, body, tok === null ? {} : { token: tok });
const verify = (tok, body) => c.post(`/api/db/${slug}/otp/verify`, body, { token: tok });

// --- Happy path: generate → verify → single-use ---
let g = (await gen(B, { purpose: "phone", identifier: "+15550001" })).json;
t.ok(/^\d{6}$/.test(g.code) && g.expires_at, "generate returns a 6-digit code + expiry");
t.eq((await verify(B, { purpose: "phone", identifier: "+15550001", code: g.code })).json.verified, true, "the right code verifies");
t.eq((await verify(B, { purpose: "phone", identifier: "+15550001", code: g.code })).status, 404, "…and it's single-use (a second verify → 404, no active code)");

// --- Wrong code decrements the attempt budget, then locks out ---
await gen(B, { purpose: "phone", identifier: "+15550001", max_attempts: 3 });
t.eq((await verify(B, { purpose: "phone", identifier: "+15550001", code: "000000" })).json.attempts_left, 2, "1st wrong → 2 left");
t.eq((await verify(B, { purpose: "phone", identifier: "+15550001", code: "000000" })).json.attempts_left, 1, "2nd wrong → 1 left");
t.eq((await verify(B, { purpose: "phone", identifier: "+15550001", code: "000000" })).json.attempts_left, 0, "3rd wrong → 0 left");
t.eq((await verify(B, { purpose: "phone", identifier: "+15550001", code: "000000" })).status, 429, "4th → locked out (429), code invalidated");

// --- Isolation: a different (purpose,identifier) is untouched by the lockout above ---
let g2 = (await gen(B, { purpose: "email", identifier: "a@x.dev" })).json;
t.eq((await verify(B, { purpose: "email", identifier: "a@x.dev", code: g2.code })).json.verified, true, "a separate purpose/identifier verifies fine");

// --- Expiry (drive the clock via white-box) ---
let g3 = (await gen(B, { purpose: "exp", identifier: "z" })).json;
h.getDb(uuid).prepare("UPDATE _otp SET expires_at=? WHERE purpose=?").run("2000-01-01T00:00:00.000Z", "exp");
t.eq((await verify(B, { purpose: "exp", identifier: "z", code: g3.code })).status, 400, "an expired code → 400 (even if otherwise correct)");

// --- Verify with no active code ---
t.eq((await verify(B, { purpose: "never", identifier: "nobody", code: "123456" })).status, 404, "verify with no outstanding code → 404");

// --- Custom length ---
t.ok(/^\d{4}$/.test((await gen(B, { purpose: "pin", identifier: "u1", length: 4 })).json.code), "length:4 → a 4-digit code");

// --- Validation + guards ---
t.eq((await gen(B, { identifier: "x" })).status, 400, "generate without a purpose → 400");
t.eq((await gen(B, { purpose: "p" })).status, 400, "generate without an identifier → 400");
t.eq((await verify(B, { purpose: "phone", identifier: "+15550001" })).status, 400, "verify without a code → 400");
t.eq((await gen(null, { purpose: "p", identifier: "i" })).status, 401, "signed-out generate → 401");

t.done(); h.restore();

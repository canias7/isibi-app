// Batch 224 — AGE GATE. A visitor submits a DOB; the server computes the age and checks it against a
// minimum. Only the computed age (never the raw DOB) is stored for signed-in members. Covers pass/fail,
// custom min, month/day-aware age, signed-in recording, /me, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 224");
const slug = "b224";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const check = (tok, body) => c.post(`/api/db/${slug}/agegate/check`, body, tok ? { token: tok } : {}).then((r) => r.json);
const me = (tok) => c.get(`/api/db/${slug}/agegate/me`, { token: tok }).then((r) => r.json);
const ymdYearsAgo = (years, extraDays = 0) => new Date(Date.now() - years * 365.25 * 86400000 - extraDays * 86400000).toISOString().slice(0, 10);

// --- Pass / fail against default min (18) ---
let r = await check(null, { dob: ymdYearsAgo(25) });
t.eq(r.pass, true, "a 25-year-old passes the default 18+ gate");
t.eq(r.min, 18, "…default min is 18");
t.ok(r.age >= 24 && r.age <= 26, "…age computed ~25");
t.eq((await check(null, { dob: ymdYearsAgo(15) })).pass, false, "a 15-year-old fails");

// --- Custom min ---
t.eq((await check(null, { dob: ymdYearsAgo(20), min: 21 })).pass, false, "20 fails a 21+ gate");
t.eq((await check(null, { dob: ymdYearsAgo(22), min: 21 })).pass, true, "22 passes a 21+ gate");

// --- Month/day-aware: birthday not yet reached this year ---
const almost18 = ymdYearsAgo(18, -10); // turns 18 in ~10 days → still 17
t.eq((await check(null, { dob: almost18 })).age, 17, "a birthday ~10 days away → still 17");

// --- Signed-in pass is recorded (age only, no DOB) ---
t.eq((await me(B)).verified, false, "B not verified yet");
await check(B, { dob: ymdYearsAgo(30) });
let m = await me(B);
t.eq(m.verified, true, "B is verified after a passing check");
t.ok(m.age >= 29 && m.age <= 31, "…with the age stored (~30)");
// The raw DOB is NOT persisted — only age lives in the table.
const cols = h.getDb(uuid).prepare("PRAGMA table_info(_agegate)").all().map((r) => r.name);
t.ok(!cols.includes("dob"), "the age-gate table has no DOB column (privacy)");

// --- A failing check does NOT record ---
t.eq((await me(A)).verified, false, "A not verified");
await check(A, { dob: ymdYearsAgo(10) }); // fails
t.eq((await me(A)).verified, false, "…a failing check leaves A unverified");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/agegate/check`, { dob: "not-a-date" })).status, 400, "a bad DOB → 400");
t.eq((await c.post(`/api/db/${slug}/agegate/check`, {})).status, 400, "no DOB → 400");
t.eq((await c.get(`/api/db/${slug}/agegate/me`)).status, 401, "signed-out /me → 401");

t.done(); h.restore();

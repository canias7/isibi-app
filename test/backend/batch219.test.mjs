// Batch 219 — DAILY-REWARD CLAIM. A member claims once per UTC day; consecutive-day claims grow a streak.
// Covers first claim, same-day 409, streak growth across simulated days, missed-day reset, status peek, the
// reward schedule, authz. Days are advanced by editing last_claim_date directly in the DB (white-box).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 219");
const slug = "b219";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const claim = (tok) => c.post(`/api/db/${slug}/daily/claim`, {}, { token: tok });
const status = (tok) => c.get(`/api/db/${slug}/daily`, tok ? { token: tok } : {}).then((r) => r.json);
const uid = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("a@x.dev")[0].id;
const ymd = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
// Force the stored last_claim_date so we can simulate the passage of days without waiting.
const setLastClaim = (date, streak) => h.getDb(uuid).prepare("UPDATE _daily_claims SET last_claim_date=?, streak=? WHERE user_id=?").run(date, streak, uid);

// --- Status before any claim ---
let s = await status(A);
t.eq(s.canClaim, true, "can claim before any claim");
t.eq(s.streak, 0, "streak starts at 0");
t.eq(s.nextReward, 10, "first-day reward is 10");

// --- First claim ---
let r = (await claim(A)).json;
t.eq(r.claimed, true, "first claim succeeds");
t.eq(r.streak, 1, "streak → 1");
t.eq(r.reward, 10, "reward 10 on day 1");

// --- Same-day claim is blocked ---
t.eq((await claim(A)).status, 409, "claiming again the same day → 409");
t.eq((await status(A)).canClaim, false, "…and canClaim is false");

// --- Simulate: last claim was yesterday → streak grows ---
setLastClaim(ymd(-1), 1);
r = (await claim(A)).json;
t.eq(r.streak, 2, "a claim the next day grows the streak to 2");
t.eq(r.reward, 20, "…reward 20 on day 2");

// --- Grow to the 7× cap ---
setLastClaim(ymd(-1), 6);
r = (await claim(A)).json;
t.eq(r.streak, 7, "streak reaches 7");
t.eq(r.reward, 70, "reward caps at 70 (7×10)");
setLastClaim(ymd(-1), 7);
r = (await claim(A)).json;
t.eq(r.streak, 8, "streak keeps counting past the cap");
t.eq(r.reward, 70, "…but reward stays capped at 70");

// --- Missed a day → streak resets ---
setLastClaim(ymd(-3), 8); // last claim 3 days ago
r = (await claim(A)).json;
t.eq(r.streak, 1, "a missed day resets the streak to 1");

// --- Status peek reflects streak + next reward ---
setLastClaim(ymd(-1), 4);
s = await status(A);
t.eq(s.canClaim, true, "can claim again (last was yesterday)");
t.eq(s.streak, 4, "status shows the current streak");
t.eq(s.nextReward, 50, "next claim would be streak 5 → reward 50");

// --- Independent per member ---
t.eq((await claim(B)).json.streak, 1, "a different member starts their own streak at 1");

// --- Authz ---
t.eq((await c.post(`/api/db/${slug}/daily/claim`, {})).status, 401, "signed-out claim → 401");
t.eq((await c.get(`/api/db/${slug}/daily`)).status, 401, "signed-out status → 401");

t.done(); h.restore();

// Batch 277 — COHORT RETENTION. Members are recorded active on days; a retention report buckets users by the
// period of their first activity and shows how many returned in each following period. Covers self-track,
// admin-seeded activity, the week retention matrix, totals, per-day dedup, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 277");
const slug = "b277";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev");
const track = (tok, body) => c.post(`/api/db/${slug}/cohorts/track`, body || {}, tok === null ? {} : { token: tok });
const retention = (q) => c.get(`/api/db/${slug}/cohorts/retention${q || ""}`, { token: A }).then((r) => r.json);
const totals = (tok) => c.get(`/api/db/${slug}/cohorts`, { token: tok });

// --- Self-track (member) + per-day dedup ---
let r = (await track(B, {})).json;
t.eq(r.tracked, true, "a member records today's activity");
t.eq(r.first_today, true, "…first time today");
t.eq((await track(B, {})).json.first_today, false, "…re-tracking the same day doesn't double-count");

// --- Admin seeds a clean cohort dataset (week buckets) ---
// Two extra users so the matrix is deterministic; add via signup then seed by id.
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token;
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token;
const c3 = idOf("c@x.dev"), d4 = idOf("d@x.dev");
// wipe the stray "today" row from B's self-track so the report is purely the seeded data
h.getDb(uuid).prepare("DELETE FROM _cohort_days").run();
// Cohort W0 (week of 2026-01-05): b2 active W0,W1,W2 ; c3 active W0,W2
await track(A, { user: b2, day: "2026-01-05" });
await track(A, { user: b2, day: "2026-01-12" });
await track(A, { user: b2, day: "2026-01-19" });
await track(A, { user: c3, day: "2026-01-05" });
await track(A, { user: c3, day: "2026-01-19" });
// Cohort W1 (week of 2026-01-12): d4 active W1 only
await track(A, { user: d4, day: "2026-01-12" });

// --- Totals ---
let tot = (await totals(A)).json;
t.eq(tot.users, 3, "3 distinct users tracked");
t.eq(tot.days, 6, "6 activity-days recorded");

// --- Retention matrix (week) ---
const m = await retention("?period=week&size=4");
t.eq(m.period, "week", "period echoed");
t.eq(m.cohorts.length, 2, "two cohorts");
const w0 = m.cohorts[0]; // earliest first
t.eq(w0.size, 2, "the first cohort has 2 users");
t.eq(w0.retention[0], 1, "…100% in period 0");
t.eq(w0.retention[1], 0.5, "…50% in period 1 (only one returned)");
t.eq(w0.retention[2], 1, "…100% in period 2");
t.eq(m.cohorts[1].size, 1, "the second cohort has 1 user");
t.eq(m.cohorts[1].retention[0], 1, "…100% in its period 0");

// --- Validation + authz ---
t.eq((await track(A, { day: "nope" })).status, 400, "a bad day → 400");
t.eq((await track(B, { user: c3 })).status, 403, "a member can't seed another user → 403");
t.eq((await c.post(`/api/db/${slug}/cohorts/track`, {})).status, 401, "signed-out track → 401");
t.eq((await totals(B)).status, 403, "a member can't read totals → 403");
t.eq((await c.get(`/api/db/${slug}/cohorts/retention`, { token: B })).status, 403, "a member can't read retention → 403");
t.eq((await c.get(`/api/db/${slug}/cohorts`)).status, 401, "signed-out totals → 401");

t.done(); h.restore();

// Batch 367 — SALES QUOTA. Per-rep, per-period target + running attainment (cents; rep is a free label). Covers
// set/adjust, record (+/- attainment, floored at 0), pct/remaining, list-by-period ranking, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 367");
const slug = "b367";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const setQ = (tok, body) => c.post(`/api/db/${slug}/sales-quota`, body, { token: tok });
const rec = (tok, rep, period, amount) => c.post(`/api/db/${slug}/sales-quota/${rep}/${period}/record`, { amount }, { token: tok });
const read = (tok, rep, period) => c.get(`/api/db/${slug}/sales-quota/${rep}/${period}`, { token: tok });

// --- Set a quota ---
let r = (await setQ(A, { rep: "alice", period: "2026-Q1", target: 10000 })).json;
t.eq(r.target_cents, 1000000, "$10,000 target in cents");
t.eq(r.attained_cents, 0, "…nothing attained yet");

// --- Record attainment ---
r = (await rec(A, "alice", "2026-Q1", 2500)).json;
t.eq(r.attained_cents, 250000, "a $2,500 deal is recorded");
t.eq(r.pct, 25, "…25% of quota");
t.eq(r.remaining_cents, 750000, "…$7,500 remaining");

// --- A correction (negative) floors at 0 ---
await rec(A, "alice", "2026-Q1", -9999);
t.eq((await read(A, "alice", "2026-Q1")).json.attained_cents, 0, "a large negative correction floors at 0");

// --- Adjusting the target keeps attainment ---
await rec(A, "alice", "2026-Q1", 5000);
r = (await setQ(A, { rep: "alice", period: "2026-Q1", target: 20000 })).json;
t.eq(r.target_cents, 2000000, "the target is raised");
t.eq(r.attained_cents, 500000, "…attainment preserved");

// --- List ranked by attainment ---
await setQ(A, { rep: "bob", period: "2026-Q1", target: 10000 });
await rec(A, "bob", "2026-Q1", 8000);
let list = (await c.get(`/api/db/${slug}/sales-quota?period=2026-Q1`, { token: A }).then((x) => x.json)).quotas;
t.eq(list[0].rep, "bob", "list is ranked by attainment (bob leads)");
t.eq(list.length, 2, "…both reps present");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/sales-quota/bob/2026-Q1`, { token: A })).json.deleted, true, "admin deletes a quota");
t.eq((await read(A, "bob", "2026-Q1")).status, 404, "…and it's gone");

// --- Validation + authz ---
t.eq((await rec(A, "ghost", "2026-Q1", 100)).status, 404, "recording against no quota → 404");
t.eq((await setQ(A, { rep: "x", period: "2026-Q1", target: -5 })).status, 400, "negative target → 400");
t.eq((await setQ(B, { rep: "x", period: "2026-Q1", target: 100 })).status, 403, "a member can't set a quota → 403");
t.eq((await c.post(`/api/db/${slug}/sales-quota`, { rep: "x", period: "q", target: 1 })).status, 401, "signed-out → 401");
t.eq((await read(B, "alice", "2026-Q1")).status, 403, "a member can't read quotas → 403");

t.done(); h.restore();

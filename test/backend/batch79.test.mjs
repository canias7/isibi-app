// Batch 79 — time-bucketed stats (group by a truncated timestamp for trend/time-series reports)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 79");
const slug = "b79";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: { access: "admin", columns: [
    { name: "amount", type: "integer" },
    { name: "stage", type: "text" },
    { name: "closed_at", type: "text" },
  ] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
// deals closed across three months of 2026 (+ one in 2025)
const seed = [
  { amount: 100, stage: "won", closed_at: "2026-01-15T10:00:00Z" },
  { amount: 200, stage: "won", closed_at: "2026-01-28T14:00:00Z" },
  { amount: 300, stage: "lost", closed_at: "2026-02-10T09:00:00Z" },
  { amount: 400, stage: "won", closed_at: "2026-03-05T12:00:00Z" },
  { amount: 500, stage: "won", closed_at: "2025-12-20T08:00:00Z" },
];
for (const d of seed) await c.post(`/api/db/${slug}/rows/deals`, d, { token: ADMIN });

// by MONTH, summed — a revenue-per-month trend
let m = (await c.get(`/api/db/${slug}/rows/deals/stats?group=closed_at:month&sum=amount`, { token: ADMIN })).json;
t.ok(m.ok && m.group === "closed_at:month", "time-bucket stats ok, echoes token");
t.eq(m.groups.map((g) => g.value), ["2025-12", "2026-01", "2026-02", "2026-03"], "buckets ordered chronologically (ASC)");
const byB = {}; for (const g of m.groups) byB[g.value] = g;
t.eq(byB["2026-01"].count, 2, "Jan 2026 has 2 deals");
t.eq(byB["2026-01"].sum.amount, 300, "Jan 2026 revenue = 100+200");
t.eq(byB["2026-02"].sum.amount, 300, "Feb 2026 revenue = 300");
t.eq(byB["2025-12"].sum.amount, 500, "Dec 2025 revenue = 500");

// by YEAR
let y = (await c.get(`/api/db/${slug}/rows/deals/stats?group=closed_at:year&sum=amount`, { token: ADMIN })).json;
t.eq(y.groups.map((g) => g.value), ["2025", "2026"], "year buckets");
t.eq(y.groups.find((g) => g.value === "2026").count, 4, "4 deals in 2026");

// by DAY, scoped with a where filter (won deals only)
let d = (await c.get(`/api/db/${slug}/rows/deals/stats?group=closed_at:day&where=stage:eq:won&sum=amount`, { token: ADMIN })).json;
t.eq(d.groups.length, 4, "4 distinct won-deal days");
t.ok(d.groups.every((g) => /^\d{4}-\d{2}-\d{2}$/.test(g.value)), "day buckets are YYYY-MM-DD");
t.ok(!d.groups.some((g) => g.value === "2026-02-10"), "the lost deal (Feb 10) is excluded by the where filter");

// an unknown granularity is NOT treated as a time bucket → falls back to grouping the raw column
let bad = (await c.get(`/api/db/${slug}/rows/deals/stats?group=closed_at:decade&sum=amount`, { token: ADMIN })).json;
t.ok(bad.ok, "unknown granularity doesn't error (plain group fallback)");
t.ok(bad.group === "closed_at:decade" ? false : true, "not reported as the time token");

// plain (non-time) group still works — regression
let s = (await c.get(`/api/db/${slug}/rows/deals/stats?group=stage&sum=amount`, { token: ADMIN })).json;
t.ok(s.ok && s.group === "stage", "plain column group still works");

t.done(); h.restore();

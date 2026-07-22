// Batch 81 — grouped-report controls: sort groups by an aggregate, top-N (groupLimit),
// and HAVING (filter groups). "Top accounts by revenue", "reps above/below quota".
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 81");
const slug = "b81";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: { access: "admin", columns: [{ name: "rep", type: "text" }, { name: "amount", type: "integer" }, { name: "closed_at", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const seed = [
  { rep: "A", amount: 1000, closed_at: "2026-01-05T00:00:00Z" },
  { rep: "A", amount: 2000, closed_at: "2026-01-20T00:00:00Z" },
  { rep: "A", amount: 3000, closed_at: "2026-02-10T00:00:00Z" }, // A: sum 6000, count 3
  { rep: "B", amount: 4000, closed_at: "2026-01-11T00:00:00Z" },
  { rep: "B", amount: 6000, closed_at: "2026-02-15T00:00:00Z" }, // B: sum 10000, count 2
  { rep: "C", amount: 1000, closed_at: "2026-03-01T00:00:00Z" }, // C: sum 1000, count 1
];
for (const d of seed) await c.post(`/api/db/${slug}/rows/deals`, d, { token: ADMIN });
const stats = async (q) => (await c.get(`/api/db/${slug}/rows/deals/stats?${q}`, { token: ADMIN })).json;

// sort groups by summed amount, descending → the revenue leaderboard
let d1 = await stats("group=rep&sum=amount&groupSort=sum:amount&groupOrder=desc");
t.eq(d1.groups.map((g) => g.value), ["B", "A", "C"], "sort by sum(amount) desc → B, A, C");
t.eq(d1.groups.map((g) => g.sum.amount), [10000, 6000, 1000], "sums in order");

// ascending
let d2 = await stats("group=rep&sum=amount&groupSort=sum:amount&groupOrder=asc");
t.eq(d2.groups.map((g) => g.value), ["C", "A", "B"], "sort by sum(amount) asc → C, A, B");

// TOP-N: the single biggest rep by revenue
let d3 = await stats("group=rep&sum=amount&groupSort=sum:amount&groupOrder=desc&groupLimit=1");
t.eq(d3.groups.length, 1, "groupLimit=1 → one group");
t.eq(d3.groups[0].value, "B", "top rep by revenue is B");

// HAVING on an aggregate: reps whose total ≥ 6000 (A & B), C excluded
let d4 = await stats("group=rep&sum=amount&having=sum:amount:gte:6000");
t.eq(d4.groups.map((g) => g.value).sort(), ["A", "B"], "having sum>=6000 → A, B (C dropped)");

// HAVING on count: reps with ≥ 2 deals
let d5 = await stats("group=rep&having=count:gte:2&groupSort=count&groupOrder=desc");
t.eq(d5.groups.map((g) => g.value), ["A", "B"], "having count>=2, sorted by count desc → A(3), B(2)");
t.eq(d5.groups.map((g) => g.count), [3, 2], "counts in order");

// combine HAVING + sort + top-N
let d6 = await stats("group=rep&sum=amount&having=sum:amount:gte:6000&groupSort=sum:amount&groupOrder=desc&groupLimit=1");
t.eq(d6.groups.length === 1 && d6.groups[0].value, "B", "having + sort + limit → just B");

// sort by the group VALUE alphabetically
let d7 = await stats("group=rep&groupSort=value&groupOrder=asc");
t.eq(d7.groups.map((g) => g.value), ["A", "B", "C"], "sort by group value asc");

// default order unchanged (count desc) when no groupSort given — regression
let d8 = await stats("group=rep");
t.eq(d8.groups.map((g) => g.value), ["A", "B", "C"], "default sort = count desc (A3, B2, C1)");

// controls also apply to TIME buckets: months with ≥ 3 deals (Jan=3, Feb=2, Mar=1)
let d9 = await stats("group=closed_at:month&having=count:gte:3");
t.eq(d9.groups.map((g) => g.value), ["2026-01"], "time buckets honor HAVING (only Jan has ≥3 deals)");

// HAVING is ignored on an ungrouped total (no crash)
let d10 = await stats("sum=amount&having=sum:amount:gte:999999");
t.ok(d10.ok && d10.sum.amount === 17000, "ungrouped total ignores HAVING, returns the real sum");

t.done(); h.restore();

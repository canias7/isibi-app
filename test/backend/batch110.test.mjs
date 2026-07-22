// Batch 110 — time-series zero-fill: ?fill=1 fills empty periods in a time-bucket stats group
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 110");
const slug = "b110";
await c.ensure(slug);
await c.schema(slug, { tables: {
  events: { access: "admin", columns: [{ name: "at", type: "text" }, { name: "amount", type: "integer" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
// Rows in Jan, Jan, and April 2026 — Feb & Mar are empty (gaps to fill).
for (const [at, amount] of [["2026-01-05", 10], ["2026-01-20", 20], ["2026-04-10", 40]])
  await c.post(`/api/db/${slug}/rows/events`, { at, amount }, { token: ADMIN });
const stats = async (q) => (await c.get(`/api/db/${slug}/rows/events/stats?${q}`, { token: ADMIN })).json;

// Without fill: only the 2 populated months come back.
let sparse = await stats("group=at:month&sum=amount");
t.eq(sparse.groups.map((g) => g.value), ["2026-01", "2026-04"], "sparse: only populated months");

// With fill: Feb + Mar appear as zero buckets, in chronological order.
let filled = await stats("group=at:month&sum=amount&fill=1");
t.eq(filled.groups.map((g) => g.value), ["2026-01", "2026-02", "2026-03", "2026-04"], "filled: continuous months");
const byM = {}; for (const g of filled.groups) byM[g.value] = g;
t.eq(byM["2026-01"].count, 2, "Jan keeps its 2 rows");
t.eq(byM["2026-01"].sum.amount, 30, "Jan sum preserved");
t.eq(byM["2026-02"].count, 0, "Feb filled with count 0");
t.eq(byM["2026-02"].sum.amount, null, "Feb sum is null (no rows)");
t.eq(byM["2026-04"].count, 1, "Apr keeps its row");
// The time-token key is present on filled buckets too, matching the real ones' shape.
t.eq(byM["2026-03"]["at:month"], "2026-03", "filled bucket carries the time-token key");

// Day granularity fills each day in the span.
let days = await stats("group=at:day&fill=1");
t.eq(days.groups[0].value, "2026-01-05", "day fill starts at first row's day");
t.eq(days.groups[days.groups.length - 1].value, "2026-04-10", "day fill ends at last row's day");
// Jan 5 → Apr 10 inclusive = 96 days.
t.eq(days.groups.length, 96, "every day in the span present");
t.eq(days.groups.filter((g) => g.count > 0).length, 3, "only 3 days have rows");

// Year granularity.
await c.post(`/api/db/${slug}/rows/events`, { at: "2028-06-01", amount: 5 }, { token: ADMIN });
let yrs = await stats("group=at:year&fill=1");
t.eq(yrs.groups.map((g) => g.value), ["2026", "2027", "2028"], "years filled incl. empty 2027");
t.eq(yrs.groups.find((g) => g.value === "2027").count, 0, "2027 is a zero year");

// fill is a no-op on a non-time group (plain column).
let plain = await c.get(`/api/db/${slug}/rows/events/stats?group=amount&fill=1`, { token: ADMIN });
t.ok(plain.json.ok && Array.isArray(plain.json.groups), "fill on a non-time group is harmless");

t.done(); h.restore();

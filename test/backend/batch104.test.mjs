// Batch 104 — DISTINCT-count aggregate: ?distinct=col → COUNT(DISTINCT col)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 104");
const slug = "b104";
await c.ensure(slug);
await c.schema(slug, { tables: {
  orders: { access: "admin", columns: [{ name: "customer", type: "text" }, { name: "country", type: "text" }, { name: "amount", type: "integer" }, { name: "day", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const seed = [
  { customer: "A", country: "US", amount: 100, day: "2026-01-01" },
  { customer: "A", country: "US", amount: 200, day: "2026-01-02" },
  { customer: "B", country: "US", amount: 300, day: "2026-01-01" },
  { customer: "C", country: "CA", amount: 400, day: "2026-01-03" },
];
for (const o of seed) await c.post(`/api/db/${slug}/rows/orders`, o, { token: ADMIN });
const stats = async (q) => (await c.get(`/api/db/${slug}/rows/orders/stats?${q}`, { token: ADMIN })).json;

// unique customers, countries
let d = await stats("distinct=customer,country");
t.eq(d.count, 4, "4 total orders");
t.eq(d.distinct.customer, 3, "3 unique customers (A,B,C)");
t.eq(d.distinct.country, 2, "2 unique countries (US,CA)");

// alongside sum
let m = await stats("sum=amount&distinct=customer");
t.eq(m.sum.amount, 1000, "sum still works");
t.eq(m.distinct.customer, 3, "distinct alongside sum");

// grouped: unique customers per country
let g = await stats("group=country&distinct=customer");
const byC = {}; for (const row of g.groups) byC[row.value] = row.distinct.customer;
t.eq(byC.US, 2, "US has 2 unique customers (A,B)");
t.eq(byC.CA, 1, "CA has 1 unique customer (C)");

// time-bucket path: unique customers per day
let tb = await stats("group=day:day&distinct=customer");
const byD = {}; for (const row of tb.groups) byD[row.value] = row.distinct.customer;
t.eq(byD["2026-01-01"], 2, "Jan 1 had 2 unique customers");

t.done(); h.restore();

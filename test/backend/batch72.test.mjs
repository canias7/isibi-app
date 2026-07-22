// Batch 72 — multi-currency: per-row base-currency field + SQL-side roll-up conversion
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 72");
const slug = "b72";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: {
    access: "admin",
    currency: { amount: "amount", code: "currency", base: "USD", rates: { EUR: 1.1, GBP: 1.25 } },
    columns: [
      { name: "title", type: "text" },
      { name: "amount", type: "real" },
      { name: "currency", type: "text" },
      { name: "region", type: "text" },
    ],
  },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/deals`, { title: "US deal", amount: 100, currency: "USD", region: "na" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/deals`, { title: "EU deal", amount: 100, currency: "EUR", region: "eu" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/deals`, { title: "UK deal", amount: 80, currency: "GBP", region: "eu" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/deals`, { title: "?? deal", amount: 50, currency: "XYZ", region: "na" }, { token: ADMIN }); // no rate

// per-row base-currency field on read
const rows = (await c.get(`/api/db/${slug}/rows/deals?sort=id`, { token: ADMIN })).json.rows;
const byTitle = {}; for (const r of rows) byTitle[r.title] = r;
t.eq(byTitle["US deal"].amount_base, 100, "USD → 100 (base is 1)");
t.eq(byTitle["EU deal"].amount_base, 110, "EUR 100 × 1.1 → 110");
t.eq(byTitle["UK deal"].amount_base, 100, "GBP 80 × 1.25 → 100");
t.eq(byTitle["?? deal"].amount_base, null, "unknown currency → null (unconvertible)");

// single-row read carries it too
const one = (await c.get(`/api/db/${slug}/rows/deals/2`, { token: ADMIN })).json.row;
t.eq(one.amount_base, 110, "single-row read has amount_base");

// SQL-side roll-up: pipeline normalized to USD in ONE request (XYZ null excluded from SUM)
const s = (await c.get(`/api/db/${slug}/rows/deals/stats?sum=amount_base`, { token: ADMIN })).json;
t.ok(s.ok, "currency stats ok");
t.eq(s.count, 4, "count = 4 (all rows)");
t.eq(s.sum.amount_base, 310, "normalized pipeline = 100+110+100 (XYZ null skipped)");

// raw (native) sum is apples-and-oranges; the base sum is the real one
const raw = (await c.get(`/api/db/${slug}/rows/deals/stats?sum=amount`, { token: ADMIN })).json;
t.eq(raw.sum.amount, 330, "raw amount sum stays native (100+100+80+50)");

// grouped roll-up: base-currency pipeline BY region, cross-currency
const g = (await c.get(`/api/db/${slug}/rows/deals/stats?group=region&sum=amount_base`, { token: ADMIN })).json;
const byReg = {}; for (const row of g.groups) byReg[row.value] = row;
t.eq(byReg.eu.sum.amount_base, 210, "eu region normalized = 110 (EUR) + 100 (GBP)");
t.eq(byReg.na.sum.amount_base, 100, "na region normalized = 100 (USD); XYZ null skipped");

// avg over the base field works too
const a = (await c.get(`/api/db/${slug}/rows/deals/stats?avg=amount_base&where=region:eq:eu`, { token: ADMIN })).json;
t.eq(a.avg.amount_base, 105, "eu avg base = (110+100)/2");

t.done(); h.restore();

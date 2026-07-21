// Batch 19 — query power II: between range operator + ?sort=random
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 19");

const slug = "b19";
await c.ensure(slug);
await c.schema(slug, { tables: { products: { access: "feed", columns: { name: "text", price: "integer" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const prices = [5, 10, 20, 25, 30, 40, 50, 75, 100, 200];
for (let i = 0; i < prices.length; i++) await c.post(`/api/db/${slug}/rows/products`, { name: "p" + i, price: prices[i] }, { token: A });

// between (colon form)
let rows = (await c.get(`/api/db/${slug}/rows/products?where=price:between:20:40`)).json.rows;
t.eq(rows.map((r) => r.price).sort((a, b) => a - b), [20, 25, 30, 40], "between 20:40 inclusive");
// between (comma form)
rows = (await c.get(`/api/db/${slug}/rows/products?where=price:between:20,40`)).json.rows;
t.ok(rows.length === 4, "between 20,40 (comma) same result");
// between composes with other filters
rows = (await c.get(`/api/db/${slug}/rows/products?where=price:between:1:1000&where=price:gt:75`)).json.rows;
t.eq(rows.map((r) => r.price).sort((a, b) => a - b), [100, 200], "between + gt compose");
// malformed (one bound) -> ignored, all rows returned
rows = (await c.get(`/api/db/${slug}/rows/products?where=price:between:20`)).json.rows;
t.ok(rows.length === 10, "between with one bound -> ignored (all 10)");

// sort=random -> returns rows, honors limit, and varies across calls
const three = (await c.get(`/api/db/${slug}/rows/products?sort=random&limit=3`)).json.rows;
t.ok(three.length === 3, "sort=random honors limit=3");
const seen = new Set();
for (let i = 0; i < 10; i++) { const r = (await c.get(`/api/db/${slug}/rows/products?sort=random&limit=1`)).json.rows[0]; if (r) seen.add(r.id); }
t.ok(seen.size >= 2, "sort=random varies across calls (distinct firsts=" + seen.size + ")");
// shuffle alias works
t.ok((await c.get(`/api/db/${slug}/rows/products?sort=shuffle&limit=2`)).json.rows.length === 2, "sort=shuffle alias works");

t.done();
h.restore();

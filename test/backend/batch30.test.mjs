// Batch 30 — reverse-relation rollups (?rollup=child:agg:col)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 30");

const slug = "b30";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    orders: { access: "feed", columns: { name: "text" } },
    line_items: { access: "feed", columns: [{ name: "order_id", type: "integer", ref: "orders" }, { name: "amount", type: "real" }, { name: "qty", type: "integer" }] },
    reviews: { access: "feed", columns: [{ name: "order_id", type: "integer", ref: "orders" }, { name: "rating", type: "integer" }] },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/orders`, { name: "order1" }, { token: A }); // id 1
await c.post(`/api/db/${slug}/rows/orders`, { name: "order2" }, { token: A }); // id 2
// order1: 3 line items (10, 20, 5) qty (1,2,3); reviews 4,2
for (const [amt, q] of [[10, 1], [20, 2], [5, 3]]) await c.post(`/api/db/${slug}/rows/line_items`, { order_id: 1, amount: amt, qty: q }, { token: A });
for (const r of [4, 2]) await c.post(`/api/db/${slug}/rows/reviews`, { order_id: 1, rating: r }, { token: A });
// order2: 1 line item (100)
await c.post(`/api/db/${slug}/rows/line_items`, { order_id: 2, amount: 100, qty: 1 }, { token: A });

const orders = async (qs) => (await c.get(`/api/db/${slug}/rows/orders${qs}`)).json.rows;

// sum of line item amounts
let rows = await orders(`?rollup=line_items:sum:amount&sort=id&order=asc`);
t.ok(rows[0]._rollups.line_items.sum.amount === 35, "order1 sum(amount)=35 (10+20+5)");
t.ok(rows[1]._rollups.line_items.sum.amount === 100, "order2 sum(amount)=100");

// multiple rollups at once: sum amount, avg rating, count line_items
rows = await orders(`?rollup=line_items:sum:amount,reviews:avg:rating,line_items:count&sort=id&order=asc`);
t.ok(rows[0]._rollups.line_items.sum.amount === 35, "multi: sum amount 35");
t.ok(rows[0]._rollups.reviews.avg.rating === 3, "multi: avg rating (4+2)/2 = 3");
t.ok(rows[0]._rollups.line_items.count === 3, "multi: count line_items = 3");
// order2 has no reviews -> avg null, count 0
t.ok(rows[1]._rollups.reviews.avg.rating === null, "order2 avg rating -> null (no reviews)");
t.ok(rows[1]._rollups.line_items.count === 1, "order2 count line_items = 1");

// min/max
rows = await orders(`?rollup=line_items:min:amount,line_items:max:amount&sort=id&order=asc`);
t.ok(rows[0]._rollups.line_items.min.amount === 5 && rows[0]._rollups.line_items.max.amount === 20, "min=5, max=20");

// no ?rollup -> no _rollups key
rows = await orders(`?sort=id&order=asc`);
t.ok(!rows[0]._rollups, "no ?rollup -> no _rollups");

// bad col / bad agg ignored (no crash)
rows = await orders(`?rollup=line_items:sum:nonexistent,line_items:bogus:amount&sort=id&order=asc`);
t.ok(!rows[0]._rollups || !rows[0]._rollups.line_items || !rows[0]._rollups.line_items.sum, "invalid rollup specs ignored");

t.done();
h.restore();

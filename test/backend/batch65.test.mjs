// Batch 65 — formula fields (arithmetic with precedence)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 65");
const slug = "b65";
await c.ensure(slug);
await c.schema(slug, { tables: { lines: { access: "feed",
  formulas: { total: ["quantity", "*", "unit_price"], net: ["quantity", "*", "unit_price", "-", "discount"], taxed: ["unit_price", "*", "1.2"] },
  columns: [{ name: "quantity", type: "integer" }, { name: "unit_price", type: "real" }, { name: "discount", type: "real" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/lines`, { quantity: 3, unit_price: 10, discount: 5 }, { token: A });
const row = (await c.get(`/api/db/${slug}/rows/lines`)).json.rows[0];
t.eq(row.total, 30, "total = 3 * 10 = 30");
t.eq(row.net, 25, "net = 3*10 - 5 = 25 (mult before subtract)");
t.eq(row.taxed, 12, "taxed = 10 * 1.2 = 12");
// precedence + divide + zero
await c.schema(slug, { tables: { lines: { access: "feed",
  formulas: { avg_price: ["subtotal", "/", "quantity"], mixed: ["a", "+", "b", "*", "c"] },
  columns: [{ name: "quantity", type: "integer" }, { name: "subtotal", type: "real" }, { name: "a", type: "real" }, { name: "b", type: "real" }, { name: "c", type: "real" }] } } });
await c.post(`/api/db/${slug}/rows/lines`, { quantity: 4, subtotal: 100, a: 2, b: 3, c: 4 }, { token: A });
const r2 = (await c.get(`/api/db/${slug}/rows/lines?sort=id&order=desc&limit=1`)).json.rows[0];
t.eq(r2.avg_price, 25, "avg_price = 100 / 4 = 25");
t.eq(r2.mixed, 14, "mixed = 2 + 3*4 = 14 (mult before add)");
// divide by zero → null
await c.post(`/api/db/${slug}/rows/lines`, { quantity: 0, subtotal: 50, a: 1, b: 1, c: 1 }, { token: A });
const r3 = (await c.get(`/api/db/${slug}/rows/lines?sort=id&order=desc&limit=1`)).json.rows[0];
t.eq(r3.avg_price, null, "divide by zero → null");
t.done(); h.restore();

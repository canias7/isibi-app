// Batch 99 — deep nested expand: expand=fk1.fk2 chains up the ref graph (order → customer → company)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 99");
const slug = "b99";
await c.ensure(slug);
await c.schema(slug, { tables: {
  companies: { access: "admin", columns: [{ name: "name", type: "text" }] },
  customers: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "company_id", type: "integer", ref: "companies" }] },
  orders: { access: "admin", columns: [{ name: "total", type: "integer" }, { name: "customer_id", type: "integer", ref: "customers" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/companies`, { name: "Acme Corp" }, { token: ADMIN }); // 1
await c.post(`/api/db/${slug}/rows/customers`, { name: "Jane", company_id: 1 }, { token: ADMIN }); // 1
await c.post(`/api/db/${slug}/rows/orders`, { total: 500, customer_id: 1 }, { token: ADMIN }); // 1
await c.post(`/api/db/${slug}/rows/orders`, { total: 999 }, { token: ADMIN }); // 2 — no customer

// single-level expand still works
let one = (await c.get(`/api/db/${slug}/rows/orders/1?expand=customer_id`, { token: ADMIN })).json.row;
t.eq(one.customer.name, "Jane", "single-level expand → customer");

// deep expand: order → customer → company in one call
let deep = (await c.get(`/api/db/${slug}/rows/orders/1?expand=customer_id.company_id`, { token: ADMIN })).json.row;
t.ok(deep.customer && deep.customer.name === "Jane", "deep: customer attached");
t.ok(deep.customer.company && deep.customer.company.name === "Acme Corp", "deep: customer.company attached");

// works over a list too
let list = (await c.get(`/api/db/${slug}/rows/orders?expand=customer_id.company_id&sort=id&order=asc`, { token: ADMIN })).json.rows;
t.eq(list[0].customer.company.name, "Acme Corp", "list deep expand");
// order 2 has no customer → null gracefully, no crash
t.ok(list[1].customer === null, "missing fk → null (no crash)");

t.done(); h.restore();

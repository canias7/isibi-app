// Batch 66 — field-level security (fieldRoles: hide columns from roles on read)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 66");
const slug = "b66";
await c.ensure(slug);
await c.schema(slug, { tables: { deals: { access: "admin",
  fieldRoles: { amount: ["admin", "manager"], commission: ["admin"] },
  writeRoles: ["manager", "rep"],
  columns: [{ name: "name", type: "text" }, { name: "amount", type: "integer" }, { name: "commission", type: "integer" }] } } });
// first signup = admin
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/deals`, { name: "BigCo", amount: 50000, commission: 5000 }, { token: ADMIN });
// second user = 'user' role; promote helper via admin member route not needed — test public + user + admin
const USER = (await c.signup(slug, "rep@x.dev", "Str0ng-pass-9")).json.token;

// admin sees everything
let a = (await c.get(`/api/db/${slug}/rows/deals`, { token: ADMIN })).json.rows[0];
t.ok("amount" in a && "commission" in a, "admin sees amount + commission");
// a plain 'user' (not admin/manager) sees name but NOT amount/commission
let u = (await c.get(`/api/db/${slug}/rows/deals`, { token: USER })).json.rows[0];
t.ok("name" in u, "user sees name");
t.ok(!("amount" in u), "user does NOT see amount (fieldRole)");
t.ok(!("commission" in u), "user does NOT see commission");
// public (signed out) also stripped
let p = (await c.get(`/api/db/${slug}/rows/deals`)).json.rows[0];
t.ok("name" in p && !("amount" in p) && !("commission" in p), "public sees name only");

// promote rep → manager via admin member route, then manager sees amount but not commission
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 2, action: "set_role", role: "manager" } });
let m = (await c.get(`/api/db/${slug}/rows/deals`, { token: USER })).json.rows[0];
t.ok("amount" in m, "manager NOW sees amount");
t.ok(!("commission" in m), "manager still does NOT see commission (admin-only)");
t.done(); h.restore();

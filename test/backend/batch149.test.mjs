// Batch 149 — saved segments / audiences: a named admin filter over a table you can re-count
// and preview. Reuses the list read's where/q grammar; evaluated as admin over all rows.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 149");
const slug = "b149";
await c.ensure(slug);
await c.schema(slug, { tables: { members: { access: "admin", columns: [
  { name: "plan", type: "text" }, { name: "spend", type: "number" }, { name: "active", type: "number" },
] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const MEMBER = (await c.signup(slug, "m@x.dev", "Str0ng-pass-9")).json.token;    // id2
const add = (row) => c.post(`/api/db/${slug}/rows/members`, row, { token: ADMIN });
await add({ plan: "pro", spend: 500, active: 1 });
await add({ plan: "pro", spend: 1200, active: 1 });
await add({ plan: "free", spend: 0, active: 1 });
await add({ plan: "pro", spend: 50, active: 0 });

const save = (body, tok) => c.post(`/api/db/${slug}/segments`, body, { token: tok || ADMIN });
const count = (name, tok) => c.get(`/api/db/${slug}/segments/${name}/count`, { token: tok || ADMIN });

// Save three segments (string filter + object filter).
t.eq((await save({ name: "pro_users", table: "members", filter: "where=plan:eq:pro" })).status, 200, "save pro_users → 200");
await save({ name: "big_spenders", table: "members", filter: "where=spend:gte:500" });
await save({ name: "active_pro", table: "members", filter: { where: ["plan:eq:pro", "active:eq:1"] } });

// Counts evaluate the filter over all rows.
t.eq((await count("pro_users")).json.count, 3, "pro_users = 3 pro rows");
t.eq((await count("big_spenders")).json.count, 2, "big_spenders = 2 rows ≥ 500");
t.eq((await count("active_pro")).json.count, 2, "active_pro = 2 (object filter, two where clauses AND'd)");

// Preview returns the matching rows.
let pv = (await c.get(`/api/db/${slug}/segments/big_spenders/preview`, { token: ADMIN })).json;
t.eq(pv.rows.length, 2, "big_spenders preview has 2 rows");
t.ok(pv.rows.every((r) => r.spend >= 500), "every previewed row matches the filter");
// Preview honors ?limit.
t.eq((await c.get(`/api/db/${slug}/segments/big_spenders/preview?limit=1`, { token: ADMIN })).json.rows.length, 1, "preview respects ?limit");

// List + fetch one definition.
let list = (await c.get(`/api/db/${slug}/segments`, { token: ADMIN })).json;
t.eq(list.segments.length, 3, "three segments listed");
t.eq((await c.get(`/api/db/${slug}/segments/pro_users`, { token: ADMIN })).json.filter, "where=plan:eq:pro", "fetch one segment's filter");

// Re-saving the same name UPDATES it (upsert), doesn't duplicate.
await save({ name: "pro_users", table: "members", filter: "where=spend:gte:500" });
t.eq((await c.get(`/api/db/${slug}/segments`, { token: ADMIN })).json.segments.length, 3, "upsert didn't add a new segment");
t.eq((await count("pro_users")).json.count, 2, "pro_users now reflects the updated filter (spend≥500)");

// Delete.
t.eq((await c.del(`/api/db/${slug}/segments/pro_users`, { token: ADMIN })).json.removed, true, "delete a segment");
t.eq((await count("pro_users")).status, 404, "deleted segment → 404");

// Guards.
t.eq((await save({ name: "x", table: "members" }, MEMBER)).status, 403, "non-admin save → 403");
t.eq((await count("big_spenders", MEMBER)).status, 403, "non-admin count → 403");
t.eq((await c.get(`/api/db/${slug}/segments/big_spenders/count`)).status, 401, "signed-out → 401");
t.eq((await save({ name: "y", table: "ghost" })).status, 404, "unknown table → 404");
t.eq((await save({ table: "members" })).status, 400, "missing name → 400");
t.eq((await count("nope")).status, 404, "unknown segment → 404");

t.done(); h.restore();

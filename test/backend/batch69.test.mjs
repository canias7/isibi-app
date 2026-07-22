// Batch 69 — record assignment (/assign: reassign a row's owner; CRM lead routing)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 69");
const slug = "b69";
await c.ensure(slug);
await c.schema(slug, { tables: { leads: { access: "feed", teamRead: true, columns: [{ name: "name", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id 1 = admin
const MGR = (await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9")).json.token;     // id 2
const REP = (await c.signup(slug, "rep@x.dev", "Str0ng-pass-9")).json.token;     // id 3
// admin creates a lead (owned by admin id1)
await c.post(`/api/db/${slug}/rows/leads`, { name: "Acme" }, { token: ADMIN });
const lid = (await c.get(`/api/db/${slug}/rows/leads`)).json.rows[0].id;
const assign = (tok, user) => c.post(`/api/db/${slug}/rows/leads/${lid}/assign`, { user }, { token: tok });

// a non-privileged rep cannot reassign
t.eq((await assign(REP, 3)).status, 403, "rep cannot reassign");
// admin assigns the lead to the rep (id 3)
let a = await assign(ADMIN, 3);
t.ok(a.json.ok && a.json.owner_id === 3, "admin reassigns lead → rep (owner_id=3)");
// rep now owns it (sees it as own on a user-scoped read via authors/owner)
const row = (await c.get(`/api/db/${slug}/rows/leads/${lid}`)).json.row;
t.eq(row.owner_id, 3, "row owner_id is now the rep");
// assign by email works too
t.ok((await assign(ADMIN, "mgr@x.dev")).json.owner_id === 2, "assign by email → mgr (id 2)");
// unknown assignee → 400
t.eq((await assign(ADMIN, 999)).status, 400, "unknown assignee → 400");
// manager-of-owner can reassign (teamRead hierarchy): set rep(3).manager = mgr(2); mgr owns via... 
// give the lead to rep(3), set rep manager=mgr(2), then mgr reassigns
await assign(ADMIN, 3);
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 3, action: "set_manager", manager_id: 2 } });
t.ok((await assign(MGR, 2)).json.ok, "manager of the owner can reassign");
// assign only on user/feed tables
await c.schema(slug, { tables: { docs: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
await c.post(`/api/db/${slug}/rows/docs`, { t: "x" }, { token: ADMIN });
t.eq((await c.post(`/api/db/${slug}/rows/docs/1/assign`, { user: 3 }, { token: ADMIN })).status, 400, "assign rejected on admin table (no owner)");
t.done(); h.restore();

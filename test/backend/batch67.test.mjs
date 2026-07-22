// Batch 67 — team / manager-hierarchy read visibility (teamRead)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 67");
const slug = "b67";
await c.ensure(slug);
await c.schema(slug, { tables: { deals: { access: "user", teamRead: true, columns: [{ name: "name", type: "text" }] } } });
// 3 members: id1=manager (first signup=admin, but role doesn't matter for teamRead), id2=rep1, id3=rep2
const M = (await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9")).json.token;   // id 1
const R1 = (await c.signup(slug, "rep1@x.dev", "Str0ng-pass-9")).json.token; // id 2
const R2 = (await c.signup(slug, "rep2@x.dev", "Str0ng-pass-9")).json.token; // id 3
// each rep + mgr create a private deal
await c.post(`/api/db/${slug}/rows/deals`, { name: "mgr-deal" }, { token: M });
await c.post(`/api/db/${slug}/rows/deals`, { name: "rep1-deal" }, { token: R1 });
await c.post(`/api/db/${slug}/rows/deals`, { name: "rep2-deal" }, { token: R2 });

// BEFORE any hierarchy: each sees only their own (teamRead with no reports = own only)
t.eq((await c.get(`/api/db/${slug}/rows/deals`, { token: M })).json.rows.length, 1, "mgr sees 1 (own) before hierarchy");
t.eq((await c.get(`/api/db/${slug}/rows/deals`, { token: R1 })).json.rows.length, 1, "rep1 sees 1 (own)");

// set rep1 + rep2 to report to mgr (id 1)
const setMgr = (id) => c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id, action: "set_manager", manager_id: 1 } });
t.ok((await setMgr(2)).json.ok, "set rep1.manager = mgr");
t.ok((await setMgr(3)).json.ok, "set rep2.manager = mgr");

// NOW mgr sees own + both reports' deals (3); reps still see only their own (1)
t.eq((await c.get(`/api/db/${slug}/rows/deals`, { token: M })).json.rows.length, 3, "mgr now sees 3 (own + 2 reports) via teamRead");
t.eq((await c.get(`/api/db/${slug}/rows/deals`, { token: R1 })).json.rows.length, 1, "rep1 still sees only own");
// single-GET: mgr can read a report's row by id
const rep1RowId = (await c.get(`/api/db/${slug}/rows/deals`, { token: R1 })).json.rows[0].id;
t.eq((await c.get(`/api/db/${slug}/rows/deals/${rep1RowId}`, { token: M })).json.ok, true, "mgr can single-GET a report's row");
t.eq((await c.get(`/api/db/${slug}/rows/deals/${rep1RowId}`, { token: R2 })).status, 404, "peer rep2 CANNOT read rep1's row");
// WRITE stays own-only: mgr cannot edit a report's row
t.eq((await c.patch(`/api/db/${slug}/rows/deals/${rep1RowId}`, { name: "hijack" }, { token: M })).status, 404, "mgr cannot EDIT a report's row (write is own-only)");
// stats respect teamRead (mgr aggregates 3)
t.eq((await c.get(`/api/db/${slug}/rows/deals/stats`, { token: M })).json.count, 3, "mgr stats count=3 (team)");
t.done(); h.restore();

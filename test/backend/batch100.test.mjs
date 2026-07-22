// Batch 100 — table-wide event stream: GET /rows/<t>/events returns the insert/update/delete
// change log (audit-backed), cursor-based, for sync/integrations.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 100");
const slug = "b100";
await c.ensure(slug);
await c.schema(slug, { tables: {
  orders: { access: "admin", audit: true, writeRoles: ["clerk"], columns: [{ name: "total", type: "integer" }, { name: "status", type: "text" }] },
  plain: { access: "admin", columns: [{ name: "x", type: "text" }] }, // no audit
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "u@x.dev", "Str0ng-pass-9")).json.token; // role user

// generate a life of changes
await c.post(`/api/db/${slug}/rows/orders`, { total: 100, status: "new" }, { token: ADMIN }); // insert (id1)
await c.patch(`/api/db/${slug}/rows/orders/1`, { status: "paid" }, { token: ADMIN });           // update
await c.post(`/api/db/${slug}/rows/orders`, { total: 200, status: "new" }, { token: ADMIN }); // insert (id2)
await c.del(`/api/db/${slug}/rows/orders/2`, { token: ADMIN });                                 // delete

let e = (await c.get(`/api/db/${slug}/rows/orders/events`, { token: ADMIN })).json;
t.ok(e.ok, "events ok");
const actions = e.events.map((x) => x.action);
t.ok(actions.includes("insert") && actions.includes("update") && actions.includes("delete"), "log has insert + update + delete");
t.ok(e.events.every((x, i) => i === 0 || e.events[i - 1].id <= x.id), "oldest-first (ascending)");
t.ok(e.cursor > 0, "cursor returned");

// cursor-based polling: nothing new since the cursor
let e2 = (await c.get(`/api/db/${slug}/rows/orders/events?since=${e.cursor}`, { token: ADMIN })).json;
t.eq(e2.events.length, 0, "no events after the cursor");
// a new change shows up after the cursor
await c.patch(`/api/db/${slug}/rows/orders/1`, { total: 150 }, { token: ADMIN });
let e3 = (await c.get(`/api/db/${slug}/rows/orders/events?since=${e.cursor}`, { token: ADMIN })).json;
t.eq(e3.events.length, 1, "one new event after the cursor");
t.eq(e3.events[0].action, "update", "the new event is the update");

// guards
t.eq((await c.get(`/api/db/${slug}/rows/plain/events`, { token: ADMIN })).status, 400, "no audit:true → 400");
t.eq((await c.get(`/api/db/${slug}/rows/orders/events`, { token: USER })).status, 403, "non-writer role → 403");
t.eq((await c.get(`/api/db/${slug}/rows/orders/events`)).status, 401, "signed-out → 401");
t.eq((await c.post(`/api/db/${slug}/rows/orders/events`, {}, { token: ADMIN })).status, 405, "read-only");

t.done(); h.restore();

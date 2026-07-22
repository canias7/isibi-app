// Batch 82 — SLA / deadlines: read-time _sla status + the SQL-computed /overdue queue
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 82");
const slug = "b82";
await c.ensure(slug);
await c.schema(slug, { tables: {
  tickets: {
    access: "admin",
    sla: { start: "opened_at", mins: 60, done: { field: "status", values: ["resolved", "closed"] } },
    columns: [{ name: "subject", type: "text" }, { name: "status", type: "text" }, { name: "opened_at", type: "text" }, { name: "priority", type: "text" }],
  },
  plain: { access: "admin", columns: [{ name: "x", type: "text" }] }, // no SLA
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
// 1: opened 120m ago, open → OVERDUE (deadline 60m ago)
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "A", status: "open", opened_at: ago(120), priority: "high" }, { token: ADMIN });
// 2: opened 120m ago but RESOLVED → not overdue (clock met)
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "B", status: "resolved", opened_at: ago(120), priority: "low" }, { token: ADMIN });
// 3: opened 10m ago, open → within SLA (not overdue)
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "C", status: "open", opened_at: ago(10), priority: "low" }, { token: ADMIN });
// 4: opened 180m ago, open → OVERDUE, most overdue
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "D", status: "open", opened_at: ago(180), priority: "high" }, { token: ADMIN });

// read-time _sla on each row
const rows = (await c.get(`/api/db/${slug}/rows/tickets?sort=id&order=asc`, { token: ADMIN })).json.rows;
const bySub = {}; for (const r of rows) bySub[r.subject] = r;
t.ok(bySub.A._sla && bySub.A._sla.overdue === true, "A is overdue");
t.ok(bySub.A._sla.remaining_mins < 0, "A remaining_mins is negative (past due)");
t.ok(/T.*Z$/.test(bySub.A._sla.due_at), "due_at is an ISO timestamp");
t.eq(bySub.B._sla.overdue, false, "B not overdue (resolved → clock met)");
t.eq(bySub.B._sla.done, true, "B marked done");
t.eq(bySub.C._sla.overdue, false, "C within SLA (not overdue)");
t.ok(bySub.C._sla.remaining_mins > 0, "C has time remaining");
t.ok(bySub.D._sla.overdue === true, "D is overdue");

// the /overdue queue: only open+past-deadline rows, most overdue first
let od = (await c.get(`/api/db/${slug}/rows/tickets/overdue`, { token: ADMIN })).json;
t.ok(od.ok, "overdue queue ok");
t.eq(od.rows.map((r) => r.subject), ["D", "A"], "overdue = D, A (most overdue first); resolved + in-SLA excluded");
t.eq(od.total, 2, "total overdue = 2");
t.ok(od.rows[0]._sla.overdue === true, "queue rows carry _sla");

// ?where narrows the overdue queue (high-priority overdue only — still both here)
t.eq((await c.get(`/api/db/${slug}/rows/tickets/overdue?where=priority:eq:high`, { token: ADMIN })).json.total, 2, "overdue filtered by priority=high → 2");
t.eq((await c.get(`/api/db/${slug}/rows/tickets/overdue?where=priority:eq:low`, { token: ADMIN })).json.total, 0, "no low-priority overdue (C is within SLA)");

// resolving an overdue ticket removes it from the queue
await c.patch(`/api/db/${slug}/rows/tickets/1`, { status: "closed" }, { token: ADMIN });
t.eq((await c.get(`/api/db/${slug}/rows/tickets/overdue`, { token: ADMIN })).json.total, 1, "closing A drops it → 1 overdue left (D)");

// pagination
t.eq((await c.get(`/api/db/${slug}/rows/tickets/overdue?limit=1`, { token: ADMIN })).json.rows.length, 1, "limit respected");

// a table with no SLA config → 400; collect → 403 (n/a here, plain is admin)
t.eq((await c.get(`/api/db/${slug}/rows/plain/overdue`, { token: ADMIN })).status, 400, "no SLA config → 400");
t.eq((await c.post(`/api/db/${slug}/rows/tickets/overdue`, {}, { token: ADMIN })).status, 405, "read-only (POST → 405)");

t.done(); h.restore();

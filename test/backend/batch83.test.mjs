// Batch 83 — SLA escalation action: POST /rows/<t>/overdue/escalate applies the declared
// sla.escalate (reassign owner and/or set a field) to the overdue set, admin-gated + idempotent
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 83");
const slug = "b83";
await c.ensure(slug);
await c.schema(slug, { tables: {
  tickets: { // reassign + flag on breach
    access: "feed",
    sla: { start: "opened_at", mins: 60, done: { field: "status", values: ["resolved", "closed"] }, escalate: { to: "2", field: "priority", value: "urgent" } },
    columns: [{ name: "subject", type: "text" }, { name: "status", type: "text" }, { name: "opened_at", type: "text" }, { name: "priority", type: "text" }],
  },
  cases: { // field-only escalation (admin table, no owner)
    access: "admin",
    sla: { start: "opened_at", mins: 30, escalate: { field: "flag", value: "breached" } },
    columns: [{ name: "title", type: "text" }, { name: "flag", type: "text" }, { name: "opened_at", type: "text" }],
  },
  noesc: { access: "admin", sla: { mins: 30 }, columns: [{ name: "x", type: "text" }, { name: "created_at", type: "text" }] }, // SLA but no escalate
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9"); // id2 (escalation target)
const AGENT = (await c.signup(slug, "agent@x.dev", "Str0ng-pass-9")).json.token; // id3
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

// agent (id3) owns these tickets
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "A", status: "open", opened_at: ago(120) }, { token: AGENT }); // overdue → id1
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "B", status: "resolved", opened_at: ago(120) }, { token: AGENT }); // done → id2
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "C", status: "open", opened_at: ago(10) }, { token: AGENT }); // in SLA → id3
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "D", status: "open", opened_at: ago(180) }, { token: AGENT }); // overdue → id4

// a non-admin can't escalate
t.eq((await c.post(`/api/db/${slug}/rows/tickets/overdue/escalate`, {}, { token: AGENT })).status, 403, "non-admin can't escalate");

// admin escalates → overdue+open tickets reassigned to the manager (id2) AND flagged urgent
let e = await c.post(`/api/db/${slug}/rows/tickets/overdue/escalate`, {}, { token: ADMIN });
t.ok(e.json.ok && e.json.escalated === 2, "escalated the 2 overdue tickets (A, D)");
t.eq(e.json.to, 2, "reassigned to the manager (id2)");
const all = (await c.get(`/api/db/${slug}/rows/tickets?sort=id&order=asc`, { token: ADMIN })).json.rows;
const bySub = {}; for (const r of all) bySub[r.subject] = r;
t.ok(bySub.A.owner_id === 2 && bySub.A.priority === "urgent", "A reassigned + flagged urgent");
t.ok(bySub.D.owner_id === 2 && bySub.D.priority === "urgent", "D reassigned + flagged urgent");
t.ok(bySub.B.owner_id === 3 && !bySub.B.priority, "resolved ticket B untouched (still agent's, no flag)");
t.ok(bySub.C.owner_id === 3 && !bySub.C.priority, "in-SLA ticket C untouched");

// idempotent — running again escalates nothing (A, D already at target)
t.eq((await c.post(`/api/db/${slug}/rows/tickets/overdue/escalate`, {}, { token: ADMIN })).json.escalated, 0, "re-run escalates 0 (already escalated)");

// escalation doesn't resolve — A, D are still in the overdue queue
t.eq((await c.get(`/api/db/${slug}/rows/tickets/overdue`, { token: ADMIN })).json.total, 2, "escalated tickets remain overdue until resolved");

// field-only escalation on an admin table (no owner reassignment)
await c.post(`/api/db/${slug}/rows/cases`, { title: "old", opened_at: ago(90) }, { token: ADMIN }); // overdue (30m SLA)
await c.post(`/api/db/${slug}/rows/cases`, { title: "new", opened_at: ago(5) }, { token: ADMIN });  // in SLA
let ec = await c.post(`/api/db/${slug}/rows/cases/overdue/escalate`, {}, { token: ADMIN });
t.eq(ec.json.escalated, 1, "1 overdue case flagged");
t.eq(ec.json.to, undefined, "no reassignment (field-only)");
const cases = (await c.get(`/api/db/${slug}/rows/cases?sort=id&order=asc`, { token: ADMIN })).json.rows;
t.eq(cases[0].flag, "breached", "overdue case flagged breached");
t.ok(!cases[1].flag, "in-SLA case not flagged");
t.eq((await c.post(`/api/db/${slug}/rows/cases/overdue/escalate`, {}, { token: ADMIN })).json.escalated, 0, "field-only escalation idempotent");

// SLA table without an escalate config → 400
t.eq((await c.post(`/api/db/${slug}/rows/noesc/overdue/escalate`, {}, { token: ADMIN })).status, 400, "no escalate config → 400");
// GET on the escalate path is not allowed (POST only)
t.eq((await c.get(`/api/db/${slug}/rows/tickets/overdue/escalate`, { token: ADMIN })).status, 405, "escalate is POST-only");

t.done(); h.restore();

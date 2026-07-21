// Batch 62 — re-applying a schema that DROPS the `audit` flag must not leave a stale
// trigger that breaks writes (regression for the audit-trigger bug).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 62");

const slug = "b62";
await c.ensure(slug);
// 1) table with audit ON
await c.schema(slug, { tables: { logs: { access: "feed", audit: true, columns: [{ name: "body", type: "text", required: true }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
let r1 = await c.post(`/api/db/${slug}/rows/logs`, { body: "one" }, { token: A });
t.ok(r1.status === 200 && r1.json.ok, "insert works with audit ON");
// audit trail recorded
{ const ar = (await c.get(`/api/db/${slug}/audit`, { token: A })).json; t.ok(ar && ar.ok && (ar.rows||ar.audit||ar.entries||[]).length >= 1, "audit entry recorded"); }

// 2) re-apply the SAME table WITHOUT audit (+ a new column) — the stale trigger must be dropped
await c.schema(slug, { tables: { logs: { access: "feed", columns: [{ name: "body", type: "text", required: true }, { name: "extra", type: "text" }] } } });
let r2 = await c.post(`/api/db/${slug}/rows/logs`, { body: "two", extra: "x" }, { token: A });
t.ok(r2.status === 200 && r2.json.ok, "insert STILL works after audit flag removed (no stale trigger)");

// 3) turning audit back ON should resume logging
await c.schema(slug, { tables: { logs: { access: "feed", audit: true, columns: [{ name: "body", type: "text", required: true }, { name: "extra", type: "text" }] } } });
let r3 = await c.post(`/api/db/${slug}/rows/logs`, { body: "three" }, { token: A });
t.ok(r3.status === 200 && r3.json.ok, "insert works with audit re-enabled");

t.done();
h.restore();

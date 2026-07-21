// Batch 28 — cross-field validation checks ("end after start", "max >= min")
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 28");

const slug = "b28";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    events: {
      access: "feed",
      checks: [["end_at", "gte", "start_at"], ["capacity", "gt", "reserved"]],
      columns: { name: "text", start_at: "text", end_at: "text", capacity: "integer", reserved: "integer" },
    },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const mk = (body) => c.post(`/api/db/${slug}/rows/events`, body, { token: A });

// valid: end after start, capacity > reserved
t.ok((await mk({ name: "ok", start_at: "2026-01-01", end_at: "2026-01-02", capacity: 10, reserved: 3 })).json.ok, "valid row inserts");

// end before start -> rejected
let r = await mk({ name: "bad", start_at: "2026-01-05", end_at: "2026-01-02", capacity: 10, reserved: 3 });
t.ok(r.status === 400 && /end_at must be/.test(r.json.error), "end before start -> 400 (" + (r.json && r.json.error) + ")");

// end == start ok (gte)
t.ok((await mk({ name: "same", start_at: "2026-01-01", end_at: "2026-01-01", capacity: 5, reserved: 0 })).json.ok, "end == start ok (gte)");

// capacity not > reserved -> rejected (numeric compare)
r = await mk({ name: "full", start_at: "2026-01-01", end_at: "2026-01-02", capacity: 3, reserved: 3 });
t.ok(r.status === 400 && /capacity must be/.test(r.json.error), "capacity == reserved -> 400");

// numeric compare is real (10 > 9, not string '10' < '9')
t.ok((await mk({ name: "num", start_at: "2026-01-01", end_at: "2026-01-02", capacity: 10, reserved: 9 })).json.ok, "capacity 10 > reserved 9 (numeric, not string)");

// partial update carrying BOTH fields is checked
const id = (await c.get(`/api/db/${slug}/rows/events?where=name:eq:ok`)).json.rows[0].id;
r = await c.patch(`/api/db/${slug}/rows/events/${id}`, { start_at: "2026-02-02", end_at: "2026-02-01" }, { token: A });
t.ok(r.status === 400, "PATCH with both fields (end<start) -> 400");
// partial update carrying only ONE field skips the check (can't compare)
t.ok((await c.patch(`/api/db/${slug}/rows/events/${id}`, { end_at: "2020-01-01" }, { token: A })).json.ok, "PATCH one field only -> check skipped (documented)");

t.done();
h.restore();

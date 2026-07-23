// Batch 308 — SCHEDULE REGISTRY. Declare named recurring schedules (interval); mark runs and poll which are
// due. Covers upsert, due (new + after run), ran stamping, disabled, list next_due, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 308");
const slug = "b308";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const set = (tok, body) => c.post(`/api/db/${slug}/schedules`, body, tok === null ? {} : { token: tok });
const ran = (tok, name) => c.post(`/api/db/${slug}/schedules/${name}/ran`, {}, { token: tok });
const due = (tok) => c.get(`/api/db/${slug}/schedules/due`, { token: tok }).then((r) => r.json);
const list = (tok) => c.get(`/api/db/${slug}/schedules`, { token: tok }).then((r) => r.json);
const del = (tok, name) => c.del(`/api/db/${slug}/schedules/${name}`, { token: tok });

// --- Upsert ---
t.eq((await set(A, { name: "digest", interval_sec: 3600 })).json.interval_sec, 3600, "admin declares a schedule");
await set(A, { name: "cleanup", interval_sec: 86400 });

// --- A never-run schedule is due immediately ---
let d = (await due(A)).due;
t.eq(d.length, 2, "never-run schedules are due");

// --- Mark one ran → no longer due ---
let rr = (await ran(A, "digest")).json;
t.ok(rr.next_due, "ran stamps last_run and returns next_due");
d = (await due(A)).due;
t.ok(!d.find((s) => s.name === "digest"), "…a just-run schedule drops out of due");
t.ok(d.find((s) => s.name === "cleanup"), "…the un-run one stays due");

// --- Force digest's last_run into the past → due again ---
h.getDb(uuid).prepare("UPDATE _schedules SET last_run=? WHERE name=?").run(new Date(Date.now() - 7200 * 1000).toISOString(), "digest");
t.ok((await due(A)).due.find((s) => s.name === "digest"), "an overdue schedule becomes due again");

// --- Disabled schedules are never due ---
await set(A, { name: "cleanup", interval_sec: 86400, enabled: false });
t.ok(!(await due(A)).due.find((s) => s.name === "cleanup"), "a disabled schedule is not due");
t.eq((await list(A)).schedules.find((s) => s.name === "cleanup").next_due, null, "…and has no next_due");

// --- List computes next_due for enabled ones ---
t.ok((await list(A)).schedules.find((s) => s.name === "digest").next_due, "enabled schedules expose next_due");

// --- Delete ---
t.eq((await del(A, "digest")).json.deleted, true, "admin deletes a schedule");
t.eq((await list(A)).schedules.length, 1, "…one remains");

// --- Validation + authz ---
t.eq((await set(A, { name: "x", interval_sec: 0 })).status, 400, "interval < 1 → 400");
t.eq((await set(A, { interval_sec: 60 })).status, 400, "a missing name → 400");
t.eq((await ran(A, "nope")).status, 404, "ran on a missing schedule → 404");
t.eq((await set(B, { name: "x", interval_sec: 60 })).status, 403, "a member can't declare → 403");
t.eq((await c.get(`/api/db/${slug}/schedules`)).status, 401, "signed-out → 401");

t.done(); h.restore();

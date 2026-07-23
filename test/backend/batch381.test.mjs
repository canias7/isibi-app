// Batch 381 — DUNNING. Failed-payment retry state machine: open 'active', each attempt recovers or schedules the
// next retry until max_attempts → 'failed'; cancel stops it. Covers open, recover, exhaust, cancel, due filter,
// read/list/delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 381");
const slug = "b381";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev");
const open = (tok, body) => c.post(`/api/db/${slug}/dunning`, body, { token: tok });
const attempt = (tok, ref, body) => c.post(`/api/db/${slug}/dunning/${ref}/attempt`, body, { token: tok });

// --- Open a case ---
let r = (await open(A, { ref: "inv-1", amount: 25, user: b2, max_attempts: 3, retry_days: 2 })).json;
t.eq(r.case.status, "active", "a new case is active");
t.eq(r.case.amount_cents, 2500, "amount in cents");
t.eq(r.case.max_attempts, 3, "max_attempts stored");
t.ok(r.case.next_retry, "…with a next_retry scheduled");

// --- A successful attempt recovers ---
r = (await attempt(A, "inv-1", { success: true })).json;
t.eq(r.case.status, "recovered", "a successful attempt recovers the case");
t.eq(r.case.attempts, 1, "…attempt counted");

// --- Can't attempt a resolved case ---
t.eq((await attempt(A, "inv-1", { success: false })).status, 409, "attempting a recovered case → 409");

// --- Exhaust retries → failed ---
await open(A, { ref: "inv-2", amount: 10, max_attempts: 2 });
r = (await attempt(A, "inv-2", { success: false, error: "card declined" })).json;
t.eq(r.case.status, "active", "first failure keeps it active");
t.eq(r.case.attempts, 1, "…attempt 1");
t.eq(r.case.last_error, "card declined", "…records the error");
r = (await attempt(A, "inv-2", { success: false })).json;
t.eq(r.case.status, "failed", "reaching max_attempts → failed");
t.eq(r.case.next_retry, null, "…no more retries scheduled");

// --- Cancel ---
await open(A, { ref: "inv-3", amount: 5 });
t.eq((await c.post(`/api/db/${slug}/dunning/inv-3/cancel`, {}, { token: A })).json.case.status, "canceled", "cancel stops dunning");
t.eq((await c.post(`/api/db/${slug}/dunning/inv-3/cancel`, {}, { token: A })).status, 409, "cancelling again → 409");

// --- Due filter: white-box age the next_retry into the past ---
await open(A, { ref: "inv-4", amount: 15, retry_days: 30 });
h.getDb(uuid).prepare("UPDATE _dunning SET next_retry=? WHERE ref=?").run("2000-01-01T00:00:00.000Z", "inv-4");
let due = (await c.get(`/api/db/${slug}/dunning?due=1`, { token: A }).then((x) => x.json)).cases;
t.ok(due.some((x) => x.ref === "inv-4"), "the due filter surfaces a retry-ready case");

// --- Read + list + status filter ---
t.eq((await c.get(`/api/db/${slug}/dunning/inv-2`, { token: A }).then((x) => x.json)).case.status, "failed", "read one");
t.ok((await c.get(`/api/db/${slug}/dunning?status=failed`, { token: A }).then((x) => x.json)).cases.length >= 1, "filter by status");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/dunning/inv-1`, { token: A })).json.deleted, true, "admin deletes a case");
t.eq((await c.get(`/api/db/${slug}/dunning/inv-1`, { token: A })).status, 404, "…and it's gone");

// --- Validation + authz ---
t.eq((await open(A, { ref: "x", max_attempts: 0 })).status, 400, "max_attempts < 1 → 400");
t.eq((await open(A, { ref: "x", user: 999999 })).status, 404, "an unknown user → 404");
t.eq((await attempt(A, "ghost", { success: true })).status, 404, "attempting a missing case → 404");
t.eq((await attempt(A, "inv-2", {})).status, 400, "missing success flag → 400");
t.eq((await open(B, { ref: "x" })).status, 403, "a member can't open → 403");
t.eq((await c.post(`/api/db/${slug}/dunning`, { ref: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

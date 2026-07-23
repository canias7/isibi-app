// Batch 304 — BACKGROUND JOB QUEUE. Enqueue, atomically claim the next due job (bumps attempts), then done or
// fail (retry with backoff until max_attempts → dead). Covers enqueue, ordered claim, done, retry, dead,
// delayed jobs, queue filter, stats, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 304");
const slug = "b304";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const enq = (tok, body) => c.post(`/api/db/${slug}/jobs`, body, tok === null ? {} : { token: tok });
const claim = (tok, body) => c.post(`/api/db/${slug}/jobs/claim`, body || {}, { token: tok });
const done = (tok, id) => c.post(`/api/db/${slug}/jobs/${id}/done`, {}, { token: tok });
const fail = (tok, id, body) => c.post(`/api/db/${slug}/jobs/${id}/fail`, body || {}, { token: tok });
const stats = (tok, q) => c.get(`/api/db/${slug}/jobs/stats${q || ""}`, { token: tok }).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/jobs${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/jobs/${id}`, { token: tok });

// --- Enqueue ---
const j1 = (await enq(A, { payload: { task: "email" } })).json.id;
const j2 = (await enq(A, { payload: "second", queue: "images" })).json.id;
t.ok(j1 && j2, "admin enqueues jobs");

// --- Claim (default queue picks j1, not the images one) ---
let cl = (await claim(A, { queue: "default" })).json.job;
t.eq(cl.id, j1, "claim returns the due job from the default queue");
t.eq(cl.attempts, 1, "…attempts bumped to 1");
t.eq((await claim(A, { queue: "default" })).json.job, null, "…no more due jobs in the default queue");

// --- Queue filter ---
t.eq((await claim(A, { queue: "images" })).json.job.id, j2, "claim honors a queue filter");

// --- Done ---
t.eq((await done(A, j1)).json.status, "done", "a running job can be completed");
t.eq((await done(A, j1)).status, 409, "…completing it again → 409 (not running)");

// --- Retry then dead (max_attempts=2) ---
const j3 = (await enq(A, { payload: "retryme", max_attempts: 2 })).json.id;
await claim(A);                                     // attempt 1 (running)
let f = (await fail(A, j3, { error: "boom", backoff_sec: 0 })).json;
t.eq(f.status, "pending", "first failure re-queues as pending");
await claim(A);                                     // attempt 2 (running)
f = (await fail(A, j3, { error: "boom again" })).json;
t.eq(f.status, "dead", "failing at max_attempts → dead");

// --- Delayed job not claimable yet ---
const j4 = (await enq(A, { payload: "later", delay_sec: 3600 })).json.id;
t.eq((await claim(A)).json.job, null, "a future-dated job is not yet claimable");
// force it due via white-box, then it claims
h.getDb(uuid).prepare("UPDATE _jobs SET run_at=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), j4);
t.eq((await claim(A)).json.job.id, j4, "…once its run_at passes, it claims");

// --- Stats + list ---
let st = await stats(A);
t.ok(st.by_status.dead >= 1 && st.by_status.done >= 1, "stats count by status");
t.ok((await list(A, "?status=dead")).jobs.length >= 1, "list filters by status");

// --- Delete ---
t.eq((await del(A, j1)).json.deleted, true, "admin deletes a job");

// --- Validation + authz ---
t.eq((await done(A, 999999)).status, 404, "completing a missing job → 404");
t.eq((await fail(A, 999999)).status, 404, "failing a missing job → 404");
t.eq((await enq(B, { payload: "x" })).status, 403, "a member can't enqueue → 403");
t.eq((await claim(B)).status, 403, "a member can't claim → 403");
t.eq((await c.post(`/api/db/${slug}/jobs`, { payload: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

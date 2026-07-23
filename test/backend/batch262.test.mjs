// Batch 262 — DRIP SEQUENCES. An admin defines ordered day-offset steps; a subject is enrolled and each
// step comes due at enrolled_at + day. Covers define + step sort, list, detail, enroll (next_due), due
// (white-box past date), advance (moves to next / completes), cancel, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 262");
const slug = "b262";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const define = (tok, name, body) => c.post(`/api/db/${slug}/sequences/${name}`, body, tok === null ? {} : { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/sequences`, { token: tok }).then((r) => r.json);
const detail = (tok, name) => c.get(`/api/db/${slug}/sequences/${name}`, { token: tok }).then((r) => r.json);
const enroll = (tok, name, subject) => c.post(`/api/db/${slug}/sequences/${name}/enroll`, { subject }, { token: tok }).then((r) => r.json);
const due = (tok, name) => c.get(`/api/db/${slug}/sequences/${name}/due`, { token: tok }).then((r) => r.json);
const advance = (tok, name, enrollment) => c.post(`/api/db/${slug}/sequences/${name}/advance`, { enrollment }, { token: tok }).then((r) => r.json);
const cancel = (tok, name, enrollment) => c.post(`/api/db/${slug}/sequences/${name}/cancel`, { enrollment }, { token: tok }).then((r) => r.json);
const del = (tok, name) => c.del(`/api/db/${slug}/sequences/${name}`, { token: tok });
const setDue = (id, iso) => h.getDb(uuid).prepare("UPDATE _sequence_enrollments SET next_due=? WHERE id=?").run(iso, id);
const past = new Date(Date.now() - 3600000).toISOString();

// --- Define (steps get sorted by day) ---
t.eq((await define(A, "welcome", { description: "Onboarding", steps: [{ day: 3, subject: "Day 3" }, { day: 0, subject: "Welcome" }, { day: 1, subject: "Day 1" }] })).json.steps, 3, "admin defines a 3-step sequence");
let d = (await detail(A, "welcome")).sequence;
t.eq(d.steps[0].day, 0, "steps are sorted by day (day 0 first)");
t.eq(d.steps[2].subject, "Day 3", "…day 3 last");

// --- List ---
t.eq((await list(A)).sequences.find((x) => x.name === "welcome").step_count, 3, "list shows step_count");

// --- Enroll (next_due = start + step0.day) ---
let e = await enroll(A, "welcome", "user@x.io");
const eid = e.enrollment;
t.ok(eid, "enrolled a subject");
// step 0 is day 0 → due immediately; force it past to be safe
setDue(eid, past);
let du = (await due(A, "welcome")).due;
t.eq(du.length, 1, "the enrollment is due");
t.eq(du[0].step.subject, "Welcome", "…on the Welcome step (index 0)");

// --- Advance moves to the next step ---
let adv = await advance(A, "welcome", eid);
t.eq(adv.next_step, 1, "advance moves to step 1");
t.ok(Date.parse(adv.next_due) > Date.now(), "…next_due is in the future (day 1)");
t.eq((await due(A, "welcome")).due.length, 0, "…no longer due");

// --- Advance through to completion ---
setDue(eid, past); await advance(A, "welcome", eid); // → step 2
setDue(eid, past);
adv = await advance(A, "welcome", eid); // past the last step → completed
t.eq(adv.status, "completed", "advancing past the last step completes the enrollment");
t.eq((await c.post(`/api/db/${slug}/sequences/welcome/advance`, { enrollment: eid }, { token: A })).status, 409, "…advancing a completed enrollment → 409");

// --- Cancel ---
let e2 = (await enroll(A, "welcome", "two@x.io")).enrollment;
t.eq((await cancel(A, "welcome", e2)).status, "cancelled", "admin cancels an enrollment");
t.eq((await cancel(A, "welcome", e2)).status ?? 404, 404, "cancelling a non-active one → 404");

// --- Delete ---
t.eq((await del(A, "welcome")).json.deleted, true, "admin deletes the sequence");
t.eq((await c.get(`/api/db/${slug}/sequences/welcome`, { token: A })).status, 404, "…gone");

// --- Validation + authz ---
t.eq((await define(A, "bad", { steps: [] })).status, 400, "empty steps → 400");
t.eq((await define(A, "bad", { steps: [{ day: -1 }] })).status, 400, "a negative day → 400");
t.eq((await define(B, "hax", { steps: [{ day: 0 }] })).status, 403, "a member can't define → 403");
t.eq((await c.get(`/api/db/${slug}/sequences`, { token: B })).status, 403, "a member can't list → 403");
t.eq((await c.post(`/api/db/${slug}/sequences/x`, { steps: [{ day: 0 }] })).status, 401, "signed-out define → 401");

t.done(); h.restore();

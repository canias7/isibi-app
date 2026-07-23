// Batch 380 — BROADCAST FAN-OUT LOG. One row per broadcast send, tracking recipients + running sent/failed
// counts and status. A worker reports progress and finishes it. Covers open, progress increments, done, read,
// list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 380");
const slug = "b380";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const open = (tok, body) => c.post(`/api/db/${slug}/broadcast-log`, body, { token: tok });
const prog = (tok, id, body) => c.post(`/api/db/${slug}/broadcast-log/${id}/progress`, body, { token: tok });

// --- Open a broadcast ---
let r = (await open(A, { channel: "email", subject: "Launch", recipients: 100 })).json;
t.eq(r.broadcast.recipients, 100, "recipients stored");
t.eq(r.broadcast.status, "sending", "…status sending");
t.eq(r.broadcast.sent, 0, "…0 sent so far");
const id = r.broadcast.id;

// --- Progress increments accumulate ---
r = (await prog(A, id, { sent: 40 })).json;
t.eq(r.broadcast.sent, 40, "40 sent");
r = (await prog(A, id, { sent: 55, failed: 5 })).json;
t.eq(r.broadcast.sent, 95, "sent accumulates to 95");
t.eq(r.broadcast.failed, 5, "…5 failed");
t.eq(r.broadcast.status, "sending", "…still sending");

// --- Finish ---
r = (await prog(A, id, { sent: 0, done: true })).json;
t.eq(r.broadcast.status, "done", "done:true finishes the broadcast");

// --- Read one ---
t.eq((await c.get(`/api/db/${slug}/broadcast-log/${id}`, { token: A }).then((x) => x.json)).broadcast.sent, 95, "read one returns the tallies");

// --- List ---
await open(A, { channel: "sms", recipients: 5 });
t.ok((await c.get(`/api/db/${slug}/broadcast-log`, { token: A }).then((x) => x.json)).broadcasts.length >= 2, "list returns broadcasts");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/broadcast-log/${id}`, { token: A })).json.deleted, true, "admin deletes a broadcast");
t.eq((await c.get(`/api/db/${slug}/broadcast-log/${id}`, { token: A })).status, 404, "…and it's gone");

// --- Validation + authz ---
t.eq((await open(A, { channel: "email", recipients: -1 })).status, 400, "a negative recipients count → 400");
t.eq((await prog(A, 99999, { sent: 1 })).status, 404, "progress on a missing broadcast → 404");
t.eq((await open(B, { channel: "email", recipients: 1 })).status, 403, "a member can't open → 403");
t.eq((await c.post(`/api/db/${slug}/broadcast-log`, { channel: "email", recipients: 1 })).status, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/broadcast-log`, { token: B })).status, 403, "a member can't list → 403");

t.done(); h.restore();

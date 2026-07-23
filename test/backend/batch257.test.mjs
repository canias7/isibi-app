// Batch 257 — SCHEDULED DIGESTS. An admin defines a named digest (a saved query + a cadence); a due-list
// surfaces the ones whose next_run has passed, then marks them sent (advancing next_run). Covers upsert,
// list, due (white-box past date), mark sent (advances), recipients, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 257");
const slug = "b257";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const upsert = (tok, name, body) => c.post(`/api/db/${slug}/digests/${name}`, body, tok === null ? {} : { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/digests`, { token: tok }).then((r) => r.json);
const due = (tok) => c.get(`/api/db/${slug}/digests/due`, { token: tok }).then((r) => r.json);
const sent = (tok, name) => c.post(`/api/db/${slug}/digests/${name}/sent`, {}, { token: tok }).then((r) => r.json);
const del = (tok, name) => c.del(`/api/db/${slug}/digests/${name}`, { token: tok });

// --- Upsert ---
let r = (await upsert(A, "weekly-sales", { description: "Sales roundup", query: "SELECT ...", interval_days: 7, recipients: ["a@x.io", "b@x.io"] })).json;
t.eq(r.name, "weekly-sales", "admin defines a digest");
t.ok(r.next_run, "…with a next_run");
await upsert(A, "daily-signups", { interval_days: 1 });

// --- List ---
let l = (await list(A)).digests;
t.eq(l.length, 2, "list has both digests");
t.eq(l.find((x) => x.name === "weekly-sales").recipients, "a@x.io,b@x.io", "…recipients stored");

// --- Due: none yet (both start in the future) ---
t.eq((await due(A)).due.length, 0, "nothing due yet (next_run in the future)");

// --- Push one past-due (white-box) ---
h.getDb(uuid).prepare("UPDATE _digests SET next_run=? WHERE name=?").run(new Date(Date.now() - 86400000).toISOString(), "weekly-sales");
let d = (await due(A)).due;
t.eq(d.length, 1, "the past-due digest shows in /due");
t.eq(d[0].name, "weekly-sales", "…it's weekly-sales");
t.eq(d[0].query, "SELECT ...", "…with its saved query for the worker to run");

// --- Mark sent advances next_run ---
r = await sent(A, "weekly-sales");
t.ok(Date.parse(r.next_run) > Date.now(), "marking sent advances next_run into the future");
t.ok(r.last_sent, "…and stamps last_sent");
t.eq((await due(A)).due.length, 0, "…no longer due");

// --- Update in place ---
await upsert(A, "weekly-sales", { interval_days: 14 });
t.eq((await list(A)).digests.find((x) => x.name === "weekly-sales").interval_days, 14, "re-posting updates the cadence");

// --- Delete ---
t.eq((await del(A, "daily-signups")).json.deleted, true, "admin deletes a digest");
t.eq((await list(A)).digests.length, 1, "…now 1");

// --- Validation + authz (admin-only) ---
t.eq((await upsert(A, "bad", { interval_days: 0 })).status, 400, "interval_days 0 → 400");
t.eq((await upsert(B, "hax", { interval_days: 7 })).status, 403, "a member can't define → 403");
t.eq((await list(B)).status ?? 403, 403, "a member can't list → 403");
t.eq((await c.get(`/api/db/${slug}/digests`, { token: B })).status, 403, "…confirmed 403");
t.eq((await del(A, "nope")).status, 404, "deleting a missing digest → 404");
t.eq((await c.get(`/api/db/${slug}/digests/due`)).status, 401, "signed-out /due → 401");

t.done(); h.restore();

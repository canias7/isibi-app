// Batch 395 — INVENTORY COUNT. A stock-take / cycle-count log: record a physical count vs expected, capture the
// variance, reconcile. Admin-only. Covers record + variance, reconcile guard, read, list filters, delete,
// validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 395");
const slug = "b395";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const rec = (tok, body) => c.post(`/api/db/${slug}/inventory-count`, body, { token: tok });

// --- Record + variance ---
let r = (await rec(A, { sku: "WIDGET-1", expected: 100, counted: 97, note: "back shelf" })).json;
t.eq(r.count.variance, -3, "variance = counted - expected");
t.eq(r.count.status, "open", "…starts open");
const id1 = r.count.id;

// --- A matching count → zero variance ---
t.eq((await rec(A, { sku: "WIDGET-2", expected: 50, counted: 50 })).json.count.variance, 0, "a matching count → 0 variance");

// --- Reconcile ---
r = (await c.post(`/api/db/${slug}/inventory-count/${id1}/reconcile`, {}, { token: A })).json;
t.eq(r.count.status, "reconciled", "reconcile closes the count");
t.eq((await c.post(`/api/db/${slug}/inventory-count/${id1}/reconcile`, {}, { token: A })).status, 409, "reconciling again → 409");

// --- Read one ---
t.eq((await c.get(`/api/db/${slug}/inventory-count/${id1}`, { token: A }).then((x) => x.json)).count.sku, "WIDGET-1", "read one");

// --- List filters ---
await rec(A, { sku: "WIDGET-1", expected: 10, counted: 8 });
t.eq((await c.get(`/api/db/${slug}/inventory-count?sku=WIDGET-1`, { token: A }).then((x) => x.json)).counts.length, 2, "filter by sku");
let v = (await c.get(`/api/db/${slug}/inventory-count?variance=1`, { token: A }).then((x) => x.json)).counts;
t.ok(v.every((x) => x.variance !== 0), "variance=1 returns only non-zero variances");
t.eq((await c.get(`/api/db/${slug}/inventory-count?status=reconciled`, { token: A }).then((x) => x.json)).counts.length, 1, "filter by status");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/inventory-count/${id1}`, { token: A })).json.deleted, true, "admin deletes a count");
t.eq((await c.get(`/api/db/${slug}/inventory-count/${id1}`, { token: A })).status, 404, "…and it's gone");

// --- Validation + authz ---
t.eq((await rec(A, { sku: "", expected: 1, counted: 1 })).status, 400, "no sku → 400");
t.eq((await rec(A, { sku: "x", expected: "a", counted: 1 })).status, 400, "non-numeric expected → 400");
t.eq((await c.post(`/api/db/${slug}/inventory-count/99999/reconcile`, {}, { token: A })).status, 404, "reconciling a missing count → 404");
t.eq((await rec(B, { sku: "x", expected: 1, counted: 1 })).status, 403, "a member can't record → 403");
t.eq((await c.post(`/api/db/${slug}/inventory-count`, { sku: "x", expected: 1, counted: 1 })).status, 401, "signed-out → 401");

t.done(); h.restore();

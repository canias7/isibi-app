// Batch 349 — INVENTORY LOTS (FEFO). Batch stock with expiry; issuing consumes earliest-expiring lots first.
// Covers receive, list + total, FEFO issue across lots, insufficient stock 409, expiring soon, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 349");
const slug = "b349";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const recv = (tok, body) => c.post(`/api/db/${slug}/inventory-lots`, body, tok === null ? {} : { token: tok });
const issue = (tok, body) => c.post(`/api/db/${slug}/inventory-lots/issue`, body, { token: tok });
const list = (sku) => c.get(`/api/db/${slug}/inventory-lots?sku=${sku}`).then((r) => r.json);
const expiring = (tok, q) => c.get(`/api/db/${slug}/inventory-lots/expiring${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/inventory-lots/${id}`, { token: tok });

// --- Receive two lots (different expiries) ---
const soon = (await recv(A, { sku: "MILK", lot: "L1", qty: 10, expires: iso(5) })).json.id;
await recv(A, { sku: "MILK", lot: "L2", qty: 10, expires: iso(30) });
t.eq((await list("MILK")).total, 20, "two lots → 20 total available");

// --- FEFO issue: 12 units takes all of the soonest lot + 2 from the next ---
let r = (await issue(A, { sku: "MILK", qty: 12 })).json;
t.eq(r.issued, 12, "issues 12 units");
t.eq(r.from_lots[0].lot_id, soon, "…drawing first from the earliest-expiring lot");
t.eq(r.from_lots[0].taken, 10, "…all 10 of it");
t.eq(r.from_lots[1].taken, 2, "…then 2 from the next lot");
t.eq((await list("MILK")).total, 8, "…8 remain");

// --- Insufficient stock ---
r = await issue(A, { sku: "MILK", qty: 100 });
t.eq(r.status, 409, "issuing more than available → 409");
t.eq((await list("MILK")).total, 8, "…and nothing is consumed");

// --- Expiring soon ---
await recv(A, { sku: "EGGS", qty: 6, expires: iso(3) });
t.ok((await expiring(A, "?days=7")).expiring.find((x) => x.sku === "EGGS"), "eggs show as expiring within 7 days");
t.ok(!(await expiring(A, "?days=1")).expiring.find((x) => x.sku === "EGGS"), "…but not within 1 day");

// --- Delete ---
const eid = (await list("EGGS")).lots[0].id;
t.eq((await del(A, eid)).json.deleted, true, "admin deletes a lot");

// --- Validation + authz ---
t.eq((await recv(A, { sku: "X" })).status, 400, "a missing qty → 400");
t.eq((await recv(A, { sku: "X", qty: 1, expires: "nope" })).status, 400, "a bad expires → 400");
t.eq((await issue(A, { sku: "NONE", qty: 1 })).status, 409, "issuing an unknown sku → 409 (no stock)");
t.eq((await recv(B, { sku: "X", qty: 1 })).status, 403, "a member can't receive → 403");
t.eq((await c.post(`/api/db/${slug}/inventory-lots/issue`, { sku: "MILK", qty: 1 })).status, 401, "signed-out issue → 401");
t.eq((await c.get(`/api/db/${slug}/inventory-lots?sku=MILK`)).status, 200, "list is public");

t.done(); h.restore();

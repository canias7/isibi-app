// Batch 317 — EQUIPMENT / ASSET CHECKOUT. Atomic checkout (only if available), return (holder or admin),
// with a move log. Covers add, checkout, double-checkout guard, mine, return, holder-only return, list filter,
// delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 317");
const slug = "b317";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const add = (tok, body) => c.post(`/api/db/${slug}/equipment`, body, tok === null ? {} : { token: tok });
const checkout = (tok, id) => c.post(`/api/db/${slug}/equipment/${id}/checkout`, {}, { token: tok });
const ret = (tok, id) => c.post(`/api/db/${slug}/equipment/${id}/return`, {}, { token: tok });
const one = (id) => c.get(`/api/db/${slug}/equipment/${id}`).then((r) => r.json);
const mine = (tok) => c.get(`/api/db/${slug}/equipment/mine`, { token: tok }).then((r) => r.json);
const list = (q) => c.get(`/api/db/${slug}/equipment${q || ""}`).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/equipment/${id}`, { token: tok });
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const b2 = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;

// --- Add ---
const cam = (await add(A, { name: "Camera", ref: "CAM-1" })).json.id;
t.ok(cam, "admin adds an asset");
t.eq((await one(cam)).equipment.status, "available", "…starts available");

// --- Checkout (atomic) ---
t.eq((await checkout(B, cam)).json.status, "out", "B checks it out");
t.eq((await one(cam)).equipment.holder_id, b2, "…B is the holder");
t.eq((await checkout(C, cam)).status, 409, "C can't check out an unavailable asset → 409");

// --- Mine ---
t.eq((await mine(B)).equipment.length, 1, "B holds one asset");
t.eq((await mine(C)).equipment.length, 0, "C holds none");

// --- Return (holder only) ---
t.eq((await ret(C, cam)).status, 403, "a non-holder can't return it → 403");
t.eq((await ret(B, cam)).json.status, "available", "the holder returns it");
t.eq((await checkout(C, cam)).json.status, "out", "…now C can check it out");

// --- Admin can return anyone's ---
t.eq((await ret(A, cam)).json.status, "available", "admin returns it on C's behalf");

// --- List filter ---
await add(A, { name: "Tripod" });
t.eq((await list("?status=available")).equipment.length, 2, "list filters by status");

// --- Log recorded ---
t.ok(h.getDb(uuid).prepare("SELECT COUNT(*) AS n FROM _equipment_log WHERE equipment_id=?").all(cam)[0].n >= 4, "moves are logged");

// --- Delete ---
t.eq((await del(A, cam)).json.deleted, true, "admin deletes an asset");

// --- Validation + authz ---
t.eq((await add(A, {})).status, 400, "a missing name → 400");
t.eq((await checkout(B, 999999)).status, 404, "checking out a missing asset → 404");
t.eq((await ret(B, 999999)).status, 404, "returning a missing asset → 404");
t.eq((await add(B, { name: "x" })).status, 403, "a member can't add → 403");
t.eq((await checkout(null, cam)).status, 401, "signed-out checkout → 401");

t.done(); h.restore();

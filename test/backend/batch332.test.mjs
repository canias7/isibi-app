// Batch 332 — ENTITY FIELDS. A key/value enrichment store keyed by (type, id, field). Admin writes, members
// read. Covers upsert multiple, read as object, update in place, per-entity isolation, delete one + all,
// validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 332");
const slug = "b332";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const set = (tok, type, id, fields) => c.post(`/api/db/${slug}/entity-fields/${type}/${id}`, { fields }, tok === null ? {} : { token: tok });
const get = (tok, type, id) => c.get(`/api/db/${slug}/entity-fields/${type}/${id}`, { token: tok }).then((r) => r.json);
const del = (tok, path) => c.del(`/api/db/${slug}/entity-fields/${path}`, { token: tok });

// --- Upsert multiple fields ---
t.eq((await set(A, "product", "sku-1", { color: "red", weight: "2kg", tags: ["a", "b"] })).json.saved, 3, "admin sets three fields");
let f = (await get(B, "product", "sku-1")).fields;
t.eq(f.color, "red", "member reads a field");
t.eq(f.tags, JSON.stringify(["a", "b"]), "…objects are JSON-stringified");

// --- Update in place ---
await set(A, "product", "sku-1", { color: "blue" });
t.eq((await get(A, "product", "sku-1")).fields.color, "blue", "re-setting a field updates it");
t.eq((await get(A, "product", "sku-1")).fields.weight, "2kg", "…other fields are unchanged");

// --- Per-entity isolation ---
await set(A, "product", "sku-2", { color: "green" });
t.eq((await get(A, "product", "sku-2")).fields.color, "green", "a different id is independent");
t.eq(Object.keys((await get(A, "user", "sku-1")).fields).length, 0, "…and a different type is empty");

// --- Delete one field ---
t.eq((await del(A, "product/sku-1/weight")).json.deleted, 1, "admin deletes one field");
t.eq((await get(A, "product", "sku-1")).fields.weight, undefined, "…it's gone");
t.ok((await get(A, "product", "sku-1")).fields.color, "…others remain");

// --- Delete all for the entity ---
t.ok((await del(A, "product/sku-1")).json.deleted >= 1, "admin deletes all fields for an entity");
t.eq(Object.keys((await get(A, "product", "sku-1")).fields).length, 0, "…entity now empty");

// --- Validation + authz ---
t.eq((await set(A, "product", "sku-2", {})).status, 400, "an empty fields object → 400");
t.eq((await set(B, "product", "sku-2", { x: "1" })).status, 403, "a member can't write → 403");
t.eq((await del(B, "product/sku-2")).status, 403, "a member can't delete → 403");
t.eq((await c.get(`/api/db/${slug}/entity-fields/product/sku-2`)).status, 401, "signed-out read → 401");

t.done(); h.restore();

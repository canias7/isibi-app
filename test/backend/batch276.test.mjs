// Batch 276 — SPOTLIGHT. A rotating featured pool: an admin adds items with a weight; the "current" endpoint
// returns a deterministic weighted pick that rotates by day. Covers add, list, current (a member of the
// pool, deterministic within a day), empty pool, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 276");
const slug = "b276";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const add = (tok, body) => c.post(`/api/db/${slug}/spotlight`, body, tok === null ? {} : { token: tok });
const current = () => c.get(`/api/db/${slug}/spotlight/current`).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/spotlight`).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/spotlight/${id}`, { token: tok });

// --- Empty pool ---
t.eq((await current()).current, null, "an empty pool → current null");

// --- Add items ---
const i1 = (await add(A, { item: "product-1", label: "Featured Product" })).json.id;
await add(A, { item: "product-2", weight: 3 });
await add(A, { item: "product-3" });
t.ok(i1, "admin adds spotlight items");

// --- List ---
t.eq((await list()).spotlight.length, 3, "the pool has 3 items");
t.eq((await list()).spotlight.find((x) => x.item === "product-2").weight, 3, "…with weights");

// --- Current returns a real pool member, stable within the call ---
let cur = (await current()).current;
t.ok(cur && ["product-1", "product-2", "product-3"].includes(cur.item), "current is one of the pool items");
t.eq((await current()).current.item, cur.item, "…and is deterministic within the same day");

// --- Delete ---
t.eq((await del(A, i1)).json.deleted, true, "admin removes an item");
t.eq((await list()).spotlight.length, 2, "…pool down to 2");
// current still resolves to a remaining item
t.ok(["product-2", "product-3"].includes((await current()).current.item), "current picks from the remaining pool");

// --- Validation + authz ---
t.eq((await add(A, {})).status, 400, "missing item → 400");
t.eq((await add(B, { item: "x" })).status, 403, "a member can't add → 403");
t.eq((await del(B, 999999)).status, 403, "a member can't delete → 403");
t.eq((await del(A, 999999)).status, 404, "deleting a missing item → 404");
t.eq((await add(null, { item: "x" })).status, 401, "signed-out add → 401");

t.done(); h.restore();

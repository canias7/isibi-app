// Batch 239 — PRODUCT BUNDLES / KITS. A bundle groups component line items (qty × unit) and rolls up a
// total, minus an optional bundle discount. Covers create + rollup, get + items, discount, public active
// list, inactive hidden, patch re-rollup, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 239");
const slug = "b239";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/bundles`, body, tok === null ? {} : { token: tok });
const getB = (id) => c.get(`/api/db/${slug}/bundles/${id}`).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/bundles${q || ""}`, tok ? { token: tok } : {}).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/bundles/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/bundles/${id}`, { token: tok });

// --- Create + rollup ---
let r = (await create(A, { name: "Starter Kit", discount: 10, items: [{ description: "Widget", qty: 2, unit: 25 }, { description: "Manual", qty: 1, unit: 5 }] })).json;
t.eq(r.subtotal, 55, "subtotal = 2*25 + 1*5 = 55");
t.eq(r.total, 45, "total = 55 - 10 discount = 45");
const id = r.id;

// --- Get + items ---
let g = await getB(id);
t.eq(g.bundle.name, "Starter Kit", "reads the bundle");
t.eq(g.items.length, 2, "…with 2 component items");
t.eq(g.items[0].line_c, 5000, "…line totals in cents (2*25.00)");
t.eq(g.total, 45, "…total 45");

// --- Discount can't push total below 0 ---
r = (await create(A, { name: "Overdiscount", discount: 1000, items: [{ description: "X", qty: 1, unit: 10 }] })).json;
t.eq(r.total, 0, "an over-large discount floors the total at 0");

// --- Public active list; inactive hidden ---
await create(A, { name: "Hidden", active: false, items: [{ description: "Y", unit: 1 }] });
t.eq((await list(null)).bundles.length, 2, "public sees 2 active bundles");
t.eq((await list(A, "?active=0")).bundles.length, 3, "admin ?active=0 sees all 3");
// a member passing active=0 is still public-scoped
t.eq((await list(B, "?active=0")).bundles.length, 2, "a non-admin can't reveal inactive bundles");

// --- Patch re-rollup ---
r = (await patch(A, id, { items: [{ description: "Widget", qty: 4, unit: 25 }], discount: 0 })).json;
t.eq(r.subtotal, 100, "editing items re-rolls the subtotal to 100");
t.eq(r.total, 100, "…and total (discount cleared)");
t.eq((await getB(id)).items.length, 1, "…items replaced (now 1)");

// --- Delete ---
t.eq((await del(A, id)).json.deleted, true, "admin deletes a bundle");
t.eq((await getB(id)).ok ?? false, false, "…gone");

// --- Validation + authz ---
t.eq((await create(A, { items: [{ description: "x", unit: 1 }] })).status, 400, "missing name → 400");
t.eq((await create(A, { name: "x", items: [] })).status, 400, "empty items → 400");
t.eq((await create(A, { name: "x", items: [{ unit: 1 }] })).status, 400, "an item with no description → 400");
t.eq((await create(B, { name: "x", items: [{ description: "y", unit: 1 }] })).status, 403, "a member can't create → 403");
t.eq((await del(B, 1)).status, 403, "a member can't delete → 403");
t.eq((await create(null, { name: "x", items: [{ description: "y", unit: 1 }] })).status, 401, "signed-out create → 401");

t.done(); h.restore();

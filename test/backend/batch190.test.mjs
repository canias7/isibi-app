// Batch 190 — CATEGORIES (hierarchical taxonomy tree). Admin builds a nested tree; anyone reads it +
// breadcrumbs. Covers tree assembly, breadcrumb path, reparenting with cycle-guard, delete-reparents-
// children, slug uniqueness, and authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 190");
const slug = "b190";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/categories`, body, tok === null ? {} : { token: tok });
const tree = (tok) => c.get(`/api/db/${slug}/categories`, tok === null ? {} : { token: tok }).then((r) => r.json);
const one = (tok, id) => c.get(`/api/db/${slug}/categories/${id}`, tok === null ? {} : { token: tok }).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/categories/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/categories/${id}`, { token: tok });

// --- Build a tree ---
const elec = (await create(A, { name: "Electronics" })).json.id;
const phones = (await create(A, { name: "Phones", parent: elec })).json.id;
const laptops = (await create(A, { name: "Laptops", parent: elec })).json.id;
const iphone = (await create(A, { name: "iPhone", parent: phones })).json.id;
t.ok(elec && phones && laptops && iphone, "four categories created");

// --- Tree + slug ---
let tr = await tree(null); // public read
t.eq(tr.flat.length, 4, "flat list has all 4");
const root = tr.tree.find((n) => n.id === elec);
t.eq([tr.tree.length, root.children.length], [1, 2], "one root (Electronics) with 2 children");
t.eq(tr.flat.find((n) => n.id === elec).slug, "electronics", "slug auto-derived from the name");

// --- Breadcrumb path ---
let leaf = await one(null, iphone);
t.eq(leaf.path.map((p) => p.name), ["Electronics", "Phones", "iPhone"], "breadcrumb walks root→leaf");
t.eq((await one(null, elec)).children.map((ch) => ch.id).sort((a, b) => a - b), [phones, laptops].sort((a, b) => a - b), "a node lists its direct children");

// --- Reparent (move Laptops under Phones) ---
t.eq((await patch(A, laptops, { parent: phones })).json.updated, true, "move Laptops under Phones");
t.eq((await one(null, laptops)).path.map((p) => p.name), ["Electronics", "Phones", "Laptops"], "…breadcrumb reflects the move");

// --- Cycle + self-parent guards ---
t.eq((await patch(A, elec, { parent: iphone })).status, 400, "can't move a node under its own descendant (cycle)");
t.eq((await patch(A, phones, { parent: phones })).status, 400, "can't be its own parent");

// --- Slug uniqueness ---
t.eq((await create(A, { name: "X", slug: "phones" })).status, 409, "a duplicate slug → 409");

// --- Delete reparents children ---
t.eq((await del(A, phones)).json.reparented_to, elec, "deleting Phones reparents its children to Electronics");
t.eq((await one(null, iphone)).path.map((p) => p.name), ["Electronics", "iPhone"], "…iPhone now hangs directly off Electronics");
t.eq((await tree(null)).tree.find((n) => n.id === elec).children.map((ch) => ch.id).sort((a, b) => a - b), [laptops, iphone].sort((a, b) => a - b), "Electronics now has exactly Laptops + iPhone (Phones deleted, its children reparented up)");

// --- Validation + authz ---
t.eq((await create(A, {})).status, 400, "missing name → 400");
t.eq((await create(A, { name: "y", parent: 99999 })).status, 400, "unknown parent → 400");
t.eq((await create(B, { name: "hax" })).status, 403, "a non-admin can't create → 403");
t.eq((await patch(B, elec, { name: "x" })).status, 403, "a non-admin can't edit → 403");
t.eq((await del(B, elec)).status, 403, "a non-admin can't delete → 403");
t.eq((await create(null, { name: "z" })).status, 401, "signed-out create → 401");
t.eq((await tree(null)).ok, true, "…but the tree reads publicly");

t.done(); h.restore();

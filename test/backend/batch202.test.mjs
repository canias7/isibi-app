// Batch 202 — NAVIGATION / MENU BUILDER. An admin builds named menus of ordered, nestable items; the app
// reads a whole menu as a nested tree. Covers create/nest, tree shape + ordering, update (label/url/parent/
// position), reparent guards, delete-with-descendants, menu-key list, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 202");
const slug = "b202";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const add = (tok, menu, body) => c.post(`/api/db/${slug}/menus/${menu}/items`, body, tok === null ? {} : { token: tok });
const patch = (tok, menu, id, body) => c.patch(`/api/db/${slug}/menus/${menu}/items/${id}`, body, { token: tok });
const del = (tok, menu, id) => c.del(`/api/db/${slug}/menus/${menu}/items/${id}`, { token: tok });
const tree = (menu) => c.get(`/api/db/${slug}/menus/${menu}`).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/menus`).then((r) => r.json);

// --- Build a header menu: Home, Products > (Shoes, Hats) ---
const home = (await add(A, "header", { label: "Home", url: "/", position: 0 })).json.id;
const products = (await add(A, "header", { label: "Products", url: "/p", position: 1 })).json.id;
const shoes = (await add(A, "header", { label: "Shoes", url: "/p/shoes", parent: products, position: 0 })).json.id;
const hats = (await add(A, "header", { label: "Hats", url: "/p/hats", parent: products, position: 1 })).json.id;
t.ok(home && products && shoes && hats, "created 4 items with ids");

// --- Tree shape + ordering (public) ---
let tr = await tree("header");
t.eq(tr.items.length, 2, "two top-level items");
t.eq(tr.items[0].label, "Home", "…ordered by position (Home first)");
t.eq(tr.items[1].children.length, 2, "Products has 2 children");
t.eq(tr.items[1].children[0].label, "Shoes", "…children ordered by position (Shoes first)");

// --- Update: rename + reorder ---
t.eq((await patch(A, "header", hats, { label: "Caps", position: -1 })).json.id, hats, "patch an item");
tr = await tree("header");
t.eq(tr.items[1].children[0].label, "Caps", "…renamed + reordered to first (position -1)");

// --- Reparent guards ---
t.eq((await patch(A, "header", products, { parent: products })).status, 400, "an item can't be its own parent");
t.eq((await patch(A, "header", shoes, { parent: 999999 })).status, 400, "parent must exist in this menu");
t.eq((await add(A, "header", { label: "Bad", parent: 999999 })).status, 400, "creating under a bad parent → 400");

// --- Menu-key list (public) ---
await add(A, "footer", { label: "Contact", url: "/contact" });
const l = await list();
t.ok(l.menus.some((m) => m.menu === "header") && l.menus.some((m) => m.menu === "footer"), "list has both menus");
t.eq(l.menus.find((m) => m.menu === "header").items, 4, "header reports 4 items");

// --- Delete with descendants ---
t.eq((await del(A, "header", products)).json.deleted, 3, "deleting Products removes it + 2 children (3)");
tr = await tree("header");
t.eq(tr.items.length, 1, "…only Home remains");
t.eq((await del(A, "header", 999999)).status, 404, "deleting a missing item → 404");

// --- Validation + authz ---
t.eq((await add(A, "header", {})).status, 400, "missing label → 400");
t.eq((await add(B, "header", { label: "x" })).status, 403, "a member can't add → 403");
t.eq((await patch(B, "header", home, { label: "x" })).status, 403, "a member can't patch → 403");
t.eq((await del(B, "header", home)).status, 403, "a member can't delete → 403");
t.eq((await add(null, "header", { label: "x" })).status, 401, "signed-out add → 401");

t.done(); h.restore();

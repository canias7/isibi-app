// Batch 318 — TAXONOMY. A nested term tree: terms hang off a parent_id; the server assembles the tree. Covers
// add root + children, slug auto + uniqueness per parent, tree assembly, children endpoint, patch move,
// delete-with-children guard, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 318");
const slug = "b318";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const add = (tok, body) => c.post(`/api/db/${slug}/taxonomy`, body, tok === null ? {} : { token: tok });
const tree = () => c.get(`/api/db/${slug}/taxonomy`).then((r) => r.json);
const children = (id) => c.get(`/api/db/${slug}/taxonomy/${id}/children`).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/taxonomy/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/taxonomy/${id}`, { token: tok });

// --- Roots + children ---
const electronics = (await add(A, { term: "Electronics" })).json.id;
const clothing = (await add(A, { term: "Clothing" })).json.id;
const phones = (await add(A, { term: "Phones", parent: electronics })).json.id;
const laptops = (await add(A, { term: "Laptops", parent: electronics })).json.id;
await add(A, { term: "iPhone", parent: phones });
t.ok(electronics && phones, "admin builds a term tree");
t.ok((await add(A, { term: "Radios" })).json.slug === "radios", "slug is auto-generated");

// --- Slug uniqueness per parent (but ok across parents) ---
t.eq((await add(A, { term: "Phones", parent: electronics })).status, 409, "a duplicate slug under the same parent → 409");
t.ok((await add(A, { term: "Phones", parent: clothing })).json.id, "…but the same slug under a different parent is fine");

// --- Tree assembly ---
let tr = (await tree()).tree;
const elec = tr.find((n) => n.term === "Electronics");
t.ok(elec, "Electronics is a root");
t.eq(elec.children.length, 2, "…with 2 children (Phones, Laptops)");
const ph = elec.children.find((n) => n.term === "Phones");
t.eq(ph.children.length, 1, "Phones has one child (iPhone)");

// --- Children endpoint ---
t.eq((await children(electronics)).children.length, 2, "children endpoint lists direct children");

// --- Move via patch ---
t.eq((await patch(A, laptops, { parent: clothing })).json.id, laptops, "admin moves a term to a new parent");
t.eq((await children(electronics)).children.length, 1, "…Electronics now has 1 child");
t.eq((await children(clothing)).children.length, 2, "…Clothing gained one");

// --- Delete-with-children guard ---
t.eq((await del(A, electronics)).status, 409, "deleting a term with children → 409");
t.eq((await del(A, phones)).status, 409, "…Phones still has iPhone → 409");

// --- Validation + authz ---
t.eq((await add(A, {})).status, 400, "a missing term → 400");
t.eq((await add(A, { term: "x", parent: 999999 })).status, 404, "an unknown parent → 404");
t.eq((await add(B, { term: "x" })).status, 403, "a member can't add → 403");
t.eq((await patch(B, phones, { term: "y" })).status, 403, "a member can't edit → 403");
t.eq((await c.post(`/api/db/${slug}/taxonomy`, { term: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

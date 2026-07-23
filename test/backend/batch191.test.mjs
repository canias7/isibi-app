// Batch 191 — NAMED LISTS / COLLECTIONS. A member curates named lists of items (wishlist/watchlist);
// private by default, shareable when public. Covers create/list/view, items add/remove, public vs
// private visibility, per-owner IDOR, and guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 191");
const slug = "b191";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id1
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/lists`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/lists`, { token: tok }).then((r) => r.json.lists);
const view = (tok, id) => c.get(`/api/db/${slug}/lists/${id}`, tok === null ? {} : { token: tok });
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/lists/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/lists/${id}`, { token: tok });
const addItem = (tok, id, body) => c.post(`/api/db/${slug}/lists/${id}/items`, body, { token: tok });
const delItem = (tok, id, iid) => c.del(`/api/db/${slug}/lists/${id}/items/${iid}`, { token: tok });

// --- Create + list ---
const L1 = (await create(B, { name: "Wishlist", kind: "wishlist" })).json.id;
const L2 = (await create(B, { name: "Public picks", public: true })).json.id;
t.eq((await mine(B)).length, 2, "B has 2 lists");

// --- Items ---
const i1 = (await addItem(B, L1, { table: "products", row: 5, note: "want this" })).json.id;
await addItem(B, L1, { note: "a plain note item" });
t.eq((await addItem(B, L1, {})).status, 400, "an empty item (no ref, no note) → 400");
let v = (await view(B, L1)).json;
t.eq([v.items.length, v.items[0].ref_table, v.items[0].ref_id], [2, "products", 5], "the list holds both items with the reference preserved");
t.eq((await mine(B)).find((l) => l.id === L1).items, 2, "…and my-lists shows the item count");

// --- Public vs private visibility ---
t.eq((await view(C, L2)).status, 200, "C can view B's PUBLIC list");
t.eq((await view(C, L1)).status, 403, "…but not B's private one → 403");
t.eq((await view(null, L2)).status, 200, "a public list reads with no token");
t.eq((await view(null, L1)).status, 403, "a private list does not");

// --- IDOR: C can't touch B's list ---
t.eq((await addItem(C, L1, { note: "hax" })).status, 404, "C can't add to B's list → 404");
t.eq((await patch(C, L1, { name: "hax" })).status, 404, "C can't rename B's list → 404");
t.eq((await del(C, L1)).status, 404, "C can't delete B's list → 404");
t.eq((await mine(C)).length, 0, "C's own list set is empty");

// --- Toggle public, then remove an item, then delete ---
t.eq((await patch(B, L1, { public: true })).json.updated, true, "B makes L1 public");
t.eq((await view(C, L1)).status, 200, "…now C can view it");
t.eq((await delItem(B, L1, i1)).json.deleted, true, "B removes item i1");
t.eq((await view(B, L1)).json.items.length, 1, "…one item left");
t.eq((await delItem(B, L1, 99999)).status, 404, "removing an unknown item → 404");
t.eq((await del(B, L2)).json.deleted, true, "B deletes L2");
t.eq((await mine(B)).length, 1, "…B now has 1 list");

// --- Validation + guards ---
t.eq((await create(B, {})).status, 400, "missing name → 400");
t.eq((await create(null, { name: "x" })).status, 401, "signed-out create → 401");
t.eq((await c.get(`/api/db/${slug}/lists`)).status, 401, "signed-out my-lists → 401");

t.done(); h.restore();

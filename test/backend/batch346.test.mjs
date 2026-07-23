// Batch 346 — GIFT REGISTRY. An owner lists wanted items; others atomically claim so nothing is bought twice.
// Covers add, mine (remaining), view another's, claim, over-claim 409, double-claim 409, owner-can't-claim,
// claimed list, unclaim frees it, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 346");
const slug = "b346";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // owner id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const a1 = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("a@x.dev")[0].id;
const add = (tok, body) => c.post(`/api/db/${slug}/gift-registry`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/gift-registry/mine`, { token: tok }).then((r) => r.json);
const view = (tok, owner) => c.get(`/api/db/${slug}/gift-registry/user/${owner}`, { token: tok }).then((r) => r.json);
const claimed = (tok) => c.get(`/api/db/${slug}/gift-registry/claimed`, { token: tok }).then((r) => r.json);
const claim = (tok, id, body) => c.post(`/api/db/${slug}/gift-registry/${id}/claim`, body || {}, { token: tok });
const unclaim = (tok, id) => c.post(`/api/db/${slug}/gift-registry/${id}/unclaim`, {}, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/gift-registry/${id}`, { token: tok });

// --- Owner A adds items ---
const blender = (await add(A, { title: "Blender", qty: 2, price: 49.99 })).json.id;
const toaster = (await add(A, { title: "Toaster", qty: 1 })).json.id;
t.eq((await mine(A)).items.find((i) => i.id === blender).remaining, 2, "owner sees remaining 2 on the blender");

// --- C views A's registry ---
let v = (await view(C, a1)).items.find((i) => i.id === blender);
t.eq(v.remaining, 2, "a viewer sees the remaining quantity");
t.eq(v.claimed_by_me, false, "…and that they haven't claimed it");

// --- Claims: C then D take the two blenders ---
t.eq((await claim(C, blender, { qty: 1 })).json.qty, 1, "C claims one blender");
t.eq((await claim(D, blender, { qty: 1 })).json.qty, 1, "D claims the other");
t.eq((await view(C, a1)).items.find((i) => i.id === blender).remaining, 0, "…now none remain");

// --- Over-claim + double-claim refused ---
t.eq((await claim(B, blender, { qty: 1 })).status, 409, "a third claim → 409 (none left)");
t.eq((await claim(C, blender, { qty: 1 })).status, 409, "claiming again → 409 (already claimed)");

// --- Owner can't claim their own gift ---
t.eq((await claim(A, toaster, { qty: 1 })).status, 400, "the owner can't claim their own item");

// --- Claimed list ---
t.ok((await claimed(C)).claims.find((x) => x.item_id === blender), "C sees the blender in their claims");

// --- Unclaim frees it ---
t.eq((await unclaim(C, blender)).json.released, true, "C releases their claim");
t.eq((await view(C, a1)).items.find((i) => i.id === blender).remaining, 1, "…remaining goes back to 1");
t.eq((await claim(B, blender, { qty: 1 })).json.qty, 1, "…and B can now claim it");

// --- Delete (owner) ---
t.eq((await del(A, toaster)).json.deleted, true, "owner deletes an item");

// --- Validation + authz ---
t.eq((await add(A, {})).status, 400, "a missing title → 400");
t.eq((await claim(C, 999999)).status, 404, "claiming a missing item → 404");
t.eq((await unclaim(D, toaster)).status, 404, "unclaiming with no claim → 404");
t.eq((await del(C, blender)).status, 403, "a non-owner can't delete → 403");
t.eq((await c.post(`/api/db/${slug}/gift-registry`, { title: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

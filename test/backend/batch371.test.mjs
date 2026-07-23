// Batch 371 — COMPARISON SETS. A member builds named sets of item references (a compare tray). Covers
// create/replace, add/remove (dedup + cap), read, list, delete, per-user isolation, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 371");
const slug = "b371";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token;
const set = (tok, body) => c.post(`/api/db/${slug}/comparison`, body, { token: tok });
const add = (tok, name, item) => c.post(`/api/db/${slug}/comparison/${name}/add`, { item }, { token: tok });
const rem = (tok, name, item) => c.post(`/api/db/${slug}/comparison/${name}/remove`, { item }, { token: tok });
const get = (tok, name) => c.get(`/api/db/${slug}/comparison/${name}`, { token: tok });

// --- Create/replace (dedup on create) ---
let r = (await set(B, { name: "laptops", items: ["a", "b", "a", "c"] })).json;
t.eq(r.items.join(","), "a,b,c", "create dedups items");

// --- Add (dedup) ---
t.eq((await add(B, "laptops", "d")).json.items.join(","), "a,b,c,d", "add appends a new item");
t.eq((await add(B, "laptops", "a")).json.items.join(","), "a,b,c,d", "adding an existing item is a no-op");

// --- Remove ---
t.eq((await rem(B, "laptops", "b")).json.items.join(","), "a,c,d", "remove drops the item");
t.eq((await rem(B, "laptops", "zzz")).json.items.join(","), "a,c,d", "removing a missing item is a no-op");

// --- Add creates the set if absent ---
t.eq((await add(B, "phones", "p1")).json.items.join(","), "p1", "add to a new name creates the set");

// --- Read + list ---
t.eq((await get(B, "laptops")).json.items.length, 3, "read returns the set");
t.ok((await c.get(`/api/db/${slug}/comparison`, { token: B }).then((x) => x.json)).sets.length >= 2, "list returns my sets");

// --- Cap enforced ---
let many = Array.from({ length: 30 }, (_, i) => "i" + i);
t.eq((await set(B, { name: "big", items: many })).json.items.length, 24, "create caps at 24 items");
t.eq((await add(B, "big", "overflow")).status, 409, "adding past the cap → 409");

// --- Per-user isolation ---
t.eq((await get(C, "laptops")).status, 404, "another member can't see my set");
await set(C, { name: "laptops", items: ["x"] });
t.eq((await get(C, "laptops")).json.items.join(","), "x", "…and has their own independent set");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/comparison/phones`, { token: B })).json.deleted, true, "member deletes a set");
t.eq((await get(B, "phones")).status, 404, "…and it's gone");
t.eq((await c.del(`/api/db/${slug}/comparison/ghost`, { token: B })).status, 404, "deleting a missing set → 404");

// --- Validation + authz ---
t.eq((await set(B, { name: "bad name!", items: [] })).status, 400, "an invalid name → 400");
t.eq((await set(B, { name: "x", items: "nope" })).status, 400, "items not an array → 400");
t.eq((await rem(B, "never", "x")).status, 404, "removing from a missing set → 404");
t.eq((await c.post(`/api/db/${slug}/comparison`, { name: "x", items: [] })).status, 401, "signed-out → 401");

t.done(); h.restore();

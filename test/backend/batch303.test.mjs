// Batch 303 — PRICE LISTS. Tiered / customer-group pricing with volume breaks. A lookup returns the best price
// whose min_qty ≤ the requested quantity, within the named list. Covers upsert, group lists, volume tiers,
// lookup selection, upsert-in-place, list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 303");
const slug = "b303";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const set = (tok, body) => c.post(`/api/db/${slug}/price-lists`, body, tok === null ? {} : { token: tok });
const lookup = (q) => c.get(`/api/db/${slug}/price-lists/lookup${q}`).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/price-lists${q || ""}`, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/price-lists/${id}`, { token: tok });

// --- Volume tiers within a list ---
t.eq((await set(A, { list: "retail", item: "widget", price: 9.99 })).json.price, 999, "base retail price stored in cents");
await set(A, { list: "retail", item: "widget", price: 8.99, min_qty: 10 });
await set(A, { list: "retail", item: "widget", price: 7.5, min_qty: 100 });
// --- A separate customer group ---
await set(A, { list: "wholesale", item: "widget", price: 6.0 });

// --- Lookup picks the best tier for the quantity ---
t.eq((await lookup("?list=retail&item=widget&qty=1")).price, 999, "qty 1 → base tier");
t.eq((await lookup("?list=retail&item=widget&qty=10")).price, 899, "qty 10 → mid tier");
t.eq((await lookup("?list=retail&item=widget&qty=250")).price, 750, "qty 250 → top tier");
t.eq((await lookup("?list=retail&item=widget&qty=5")).min_qty, 1, "qty 5 stays on the base tier");
t.eq((await lookup("?list=wholesale&item=widget&qty=1")).price, 600, "the wholesale list is independent");
t.eq((await lookup("?list=retail&item=nope&qty=1")).found, false, "an unknown item → not found");

// --- Upsert in place (same list+item+min_qty) ---
await set(A, { list: "retail", item: "widget", price: 9.5, min_qty: 1 });
t.eq((await lookup("?list=retail&item=widget&qty=1")).price, 950, "re-posting a tier updates its price");

// --- List ---
t.eq((await list(A, "?list=retail")).json.prices.length, 3, "admin lists a list's tiers");

// --- Delete ---
const id = (await list(A, "?list=wholesale")).json.prices[0].id;
t.eq((await del(A, id)).json.deleted, true, "admin deletes a tier");
t.eq((await lookup("?list=wholesale&item=widget&qty=1")).found, false, "…the deleted tier is gone");

// --- Validation + authz ---
t.eq((await set(A, { list: "x", price: 1 })).status, 400, "a missing item → 400");
t.eq((await set(A, { list: "x", item: "y" })).status, 400, "a missing price → 400");
t.eq((await lookup("?list=retail")).status ?? 400, 400, "lookup without item → 400");
t.eq((await c.get(`/api/db/${slug}/price-lists/lookup?list=retail`)).status, 400, "…confirmed 400");
t.eq((await set(B, { list: "x", item: "y", price: 1 })).status, 403, "a member can't set prices → 403");
t.eq((await list(B)).status, 403, "a member can't list prices → 403");
t.eq((await set(null, { list: "x", item: "y", price: 1 })).status, 401, "signed-out → 401");

t.done(); h.restore();

// Batch 256 — PREORDER CAPACITY HOLDS. An admin caps how many units can be reserved; a member holds a
// quantity and the cap can't be exceeded. Covers define, hold (qty + remaining), over-cap → 409, one-hold-
// per-member, release frees capacity, detail/list, sold_out, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 256");
const slug = "b256";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const define = (tok, item, body) => c.post(`/api/db/${slug}/preorders/${item}`, body, tok === null ? {} : { token: tok });
const hold = (tok, item, qty) => c.post(`/api/db/${slug}/preorders/${item}/hold`, { qty }, { token: tok });
const release = (tok, item) => c.del(`/api/db/${slug}/preorders/${item}/hold`, { token: tok }).then((r) => r.json);
const detail = (tok, item) => c.get(`/api/db/${slug}/preorders/${item}`, tok ? { token: tok } : {}).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/preorders`).then((r) => r.json);
const del = (tok, item) => c.del(`/api/db/${slug}/preorders/${item}`, { token: tok });

// --- Define a 10-unit preorder ---
t.eq((await define(A, "widget", { capacity: 10, name: "Widget" })).json.capacity, 10, "admin caps the preorder at 10");

// --- Hold quantities ---
t.eq((await hold(B, "widget", 4)).json.remaining, 6, "B holds 4 → 6 remaining");
t.eq((await hold(C, "widget", 5)).json.remaining, 1, "C holds 5 → 1 remaining");

// --- Over-cap → 409 ---
t.eq((await hold(D, "widget", 2)).status, 409, "D can't hold 2 (only 1 left) → 409");
t.eq((await hold(D, "widget", 1)).json.remaining, 0, "…but 1 fits → 0 remaining (sold out)");

// --- One hold per member ---
t.eq((await hold(B, "widget", 1)).status, 409, "B already holds → 409 on a second hold");

// --- Detail + mine + sold_out ---
let d = await detail(B, "widget");
t.eq(d.held, 10, "10 units held");
t.eq(d.remaining, 0, "0 remaining");
t.eq(d.sold_out, true, "…sold out");
t.eq(d.mine, 4, "B sees their own held qty");

// --- Release frees capacity ---
t.eq((await release(C, "widget")).released, true, "C releases their 5-unit hold");
t.eq((await detail(null, "widget")).remaining, 5, "…5 units freed");

// --- List ---
await define(A, "gadget", { capacity: 3 });
t.ok((await list()).items.length >= 2, "list has both preorder items");

// --- Delete ---
t.eq((await del(A, "gadget")).json.deleted, true, "admin deletes a preorder item");
t.eq((await detail(null, "gadget")).ok ?? false, false, "…gone");

// --- Validation + authz ---
t.eq((await define(A, "x", {})).status, 400, "missing capacity → 400");
t.eq((await hold(B, "nope", 1)).status, 404, "holding a missing item → 404");
t.eq((await hold(B, "widget", 0)).status, 400, "qty 0 → 400");
t.eq((await define(B, "hax", { capacity: 5 })).status, 403, "a member can't define → 403");
t.eq((await hold(null, "widget", 1)).status, 401, "signed-out hold → 401");
t.eq((await del(B, "widget")).status, 403, "a member can't delete → 403");

t.done(); h.restore();

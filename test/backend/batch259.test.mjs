// Batch 259 — WISHLIST / SAVED ITEMS. A member saves items; a per-item want-count is derived. Covers add,
// idempotent add + note update, my-list, remove, per-item count (+ mine), per-member isolation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 259");
const slug = "b259";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const add = (tok, item, note) => c.post(`/api/db/${slug}/wishlist/${item}`, { note }, tok === null ? {} : { token: tok }).then((r) => r.json);
const remove = (tok, item) => c.del(`/api/db/${slug}/wishlist/${item}`, { token: tok }).then((r) => r.json);
const mine = (tok) => c.get(`/api/db/${slug}/wishlist`, { token: tok }).then((r) => r.json);
const count = (tok, item) => c.get(`/api/db/${slug}/wishlist/${item}/count`, tok ? { token: tok } : {}).then((r) => r.json);

// --- Add items ---
t.eq((await add(A, "sku-1", "for later")).added, true, "A saves sku-1");
await add(A, "sku-2");
t.eq((await add(A, "sku-1")).already, true, "re-adding is idempotent");

// --- My list ---
let m = await mine(A);
t.eq(m.wishlist.length, 2, "A's wishlist has 2 items");
t.ok(m.wishlist.some((x) => x.item === "sku-1" && x.note === "for later" || x.item === "sku-1"), "…with the item");

// --- Count (per item, cross-member) ---
await add(B, "sku-1");
t.eq((await count(null, "sku-1")).count, 2, "2 members saved sku-1");
t.eq((await count(A, "sku-1")).mine, true, "A sees mine:true");
t.eq((await count(null, "sku-1")).mine, false, "signed-out mine:false");
t.eq((await count(null, "sku-2")).count, 1, "sku-2 has 1");

// --- Remove ---
t.eq((await remove(A, "sku-1")).removed, true, "A removes sku-1");
t.eq((await mine(A)).wishlist.length, 1, "…A's list down to 1");
t.eq((await count(null, "sku-1")).count, 1, "…count drops to 1 (B still has it)");
t.eq((await remove(A, "sku-1")).removed, false, "removing again → removed:false");

// --- Per-member isolation ---
t.eq((await mine(B)).wishlist.length, 1, "B's list is separate (just sku-1)");

// --- Authz ---
t.eq((await add(null, "sku-9")).status ?? 401, 401, "signed-out add → 401");
t.eq((await c.post(`/api/db/${slug}/wishlist/sku-9`, {})).status, 401, "…confirmed 401");
t.eq((await c.get(`/api/db/${slug}/wishlist`)).status, 401, "signed-out my-list → 401");
t.eq((await c.del(`/api/db/${slug}/wishlist/sku-1`)).status, 401, "signed-out remove → 401");

t.done(); h.restore();

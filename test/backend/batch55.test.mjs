import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 55");
const slug = "b55";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
// add items
let r = await c.post(`/api/db/${slug}/cart/product:1`, { qty: 2 }, { token: A });
t.ok(r.json.count === 2, "add product:1 x2 -> count 2");
await c.post(`/api/db/${slug}/cart/product:5`, { qty: 3 }, { token: A });
r = await c.get(`/api/db/${slug}/cart`, { token: A });
t.ok(r.json.count === 5, "cart count 5 (2+3)");
t.eq(r.json.cart.map(x=>x.item).sort(), ["product:1","product:5"], "cart has both items");
t.ok(r.json.cart.every(x=>x.table==="product"), "cart items parsed {table,id,qty}");
// update qty
await c.post(`/api/db/${slug}/cart/product:1`, { qty: 1 }, { token: A });
t.ok((await c.get(`/api/db/${slug}/cart`, { token: A })).json.count === 4, "update qty -> count 4");
// qty 0 removes
await c.post(`/api/db/${slug}/cart/product:5`, { qty: 0 }, { token: A });
r = await c.get(`/api/db/${slug}/cart`, { token: A });
t.eq(r.json.cart.map(x=>x.item), ["product:1"], "qty 0 removed product:5");
// private: B's cart is separate/empty
t.eq((await c.get(`/api/db/${slug}/cart`, { token: B })).json.cart, [], "B's cart is separate (empty)");
// delete one item
await c.post(`/api/db/${slug}/cart/product:9`, { qty: 1 }, { token: A });
await c.del(`/api/db/${slug}/cart/product:1`, { token: A });
t.eq((await c.get(`/api/db/${slug}/cart`, { token: A })).json.cart.map(x=>x.item), ["product:9"], "delete one item");
// clear whole cart
await c.del(`/api/db/${slug}/cart`, { token: A });
t.eq((await c.get(`/api/db/${slug}/cart`, { token: A })).json.cart, [], "clear cart -> empty");
// auth required
t.ok((await c.get(`/api/db/${slug}/cart`)).status === 401, "cart needs auth -> 401");
t.done(); h.restore();

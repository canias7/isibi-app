// Batch 42 — cascade onDelete modes: cascade (default) / setNull / restrict
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 42");

const slug = "b42";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    posts: { access: "feed", columns: { title: "text" } },
    cats: { access: "feed", columns: { name: "text" } },
    orders: { access: "feed", columns: { ref: "text" } },
    // comments: cascade (default) on post delete
    comments: { access: "feed", columns: [{ name: "post_id", type: "integer", ref: "posts" }, { name: "text", type: "text" }] },
    // items: setNull on cat delete (keep the item, just unlink its category)
    items: { access: "feed", columns: [{ name: "cat_id", type: "integer", ref: "cats", onDelete: "setNull" }, { name: "name", type: "text" }] },
    // lines: restrict deleting an order that still has lines
    lines: { access: "feed", columns: [{ name: "order_id", type: "integer", ref: "orders", onDelete: "restrict" }, { name: "sku", type: "text" }] },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const P = (t2) => c.post(`/api/db/${slug}/rows/${t2}`, arguments, { token: A });

// ---- cascade (default): delete post -> its comments go ----
await c.post(`/api/db/${slug}/rows/posts`, { title: "p1" }, { token: A });
await c.post(`/api/db/${slug}/rows/comments`, { post_id: 1, text: "c1" }, { token: A });
await c.post(`/api/db/${slug}/rows/comments`, { post_id: 1, text: "c2" }, { token: A });
t.ok((await c.del(`/api/db/${slug}/rows/posts/1`, { token: A })).json.ok, "delete post (cascade) ok");
t.ok((await c.get(`/api/db/${slug}/rows/comments`)).json.rows.length === 0, "comments cascade-deleted");

// ---- setNull: delete cat -> items kept, cat_id nulled ----
await c.post(`/api/db/${slug}/rows/cats`, { name: "cat1" }, { token: A }); // id 1
await c.post(`/api/db/${slug}/rows/items`, { cat_id: 1, name: "i1" }, { token: A });
await c.post(`/api/db/${slug}/rows/items`, { cat_id: 1, name: "i2" }, { token: A });
t.ok((await c.del(`/api/db/${slug}/rows/cats/1`, { token: A })).json.ok, "delete cat (setNull) ok");
let items = (await c.get(`/api/db/${slug}/rows/items`)).json.rows;
t.ok(items.length === 2, "items KEPT after cat delete");
t.ok(items.every((i) => i.cat_id === null), "items' cat_id set to NULL");

// ---- restrict: can't delete an order that still has lines ----
await c.post(`/api/db/${slug}/rows/orders`, { ref: "o1" }, { token: A }); // id 1
await c.post(`/api/db/${slug}/rows/lines`, { order_id: 1, sku: "x" }, { token: A });
let r = await c.del(`/api/db/${slug}/rows/orders/1`, { token: A });
t.ok(r.status === 409 && r.json.code === "restrict", "delete order w/ lines -> 409 restrict");
t.ok((await c.get(`/api/db/${slug}/rows/orders`)).json.rows.length === 1, "order NOT deleted (restricted)");
// remove the line, then the order deletes fine
const lid = (await c.get(`/api/db/${slug}/rows/lines`)).json.rows[0].id;
await c.del(`/api/db/${slug}/rows/lines/${lid}`, { token: A });
t.ok((await c.del(`/api/db/${slug}/rows/orders/1`, { token: A })).json.ok, "order deletes once lines are gone");

t.done();
h.restore();

// Batch 29 — referential integrity (enforceRefs): reject fk -> missing parent
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 29");

const slug = "b29";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    posts: { access: "feed", columns: { title: "text" } },
    comments: { access: "feed", enforceRefs: true, columns: [{ name: "post_id", type: "integer", ref: "posts" }, { name: "text", type: "text" }] },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/posts`, { title: "p1" }, { token: A }); // post id 1

// valid parent -> ok
t.ok((await c.post(`/api/db/${slug}/rows/comments`, { post_id: 1, text: "hi" }, { token: A })).json.ok, "comment on existing post ok");

// missing parent -> 400 code ref
let r = await c.post(`/api/db/${slug}/rows/comments`, { post_id: 999, text: "orphan" }, { token: A });
t.ok(r.status === 400 && r.json.code === "ref", "comment on missing post -> 400 ref (" + (r.json && r.json.error) + ")");

// null / omitted fk -> allowed (optional link)
t.ok((await c.post(`/api/db/${slug}/rows/comments`, { text: "floating" }, { token: A })).json.ok, "omitted fk allowed (optional)");

// UPDATE fk to a bad parent -> 400
const cid = (await c.get(`/api/db/${slug}/rows/comments?where=text:eq:hi`)).json.rows[0].id;
r = await c.patch(`/api/db/${slug}/rows/comments/${cid}`, { post_id: 999 }, { token: A });
t.ok(r.status === 400 && r.json.code === "ref", "PATCH fk -> missing parent -> 400");
// UPDATE fk to a valid parent -> ok
await c.post(`/api/db/${slug}/rows/posts`, { title: "p2" }, { token: A }); // post id 2
t.ok((await c.patch(`/api/db/${slug}/rows/comments/${cid}`, { post_id: 2 }, { token: A })).json.ok, "PATCH fk -> existing parent ok");

// row was NOT changed by the rejected update (still points at post 1... now moved to 2 above; verify final = 2)
t.ok((await c.get(`/api/db/${slug}/rows/comments/${cid}`)).json.row.post_id === 2, "fk landed on the valid parent");

// a table WITHOUT enforceRefs still accepts any fk (control)
await c.schema(slug, { tables: { loose: { access: "feed", columns: [{ name: "post_id", type: "integer", ref: "posts" }] } } });
t.ok((await c.post(`/api/db/${slug}/rows/loose`, { post_id: 12345 }, { token: A })).json.ok, "non-enforced table accepts any fk");

t.done();
h.restore();

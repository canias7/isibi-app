import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 45");
const slug = "b45";
await c.ensure(slug);
await c.schema(slug, { tables: {
  comments: { access: "feed", columns: [{ name: "parent_id", type: "integer", ref: "comments" }, { name: "text", type: "text" }] },
  flat: { access: "feed", columns: { text: "text" } },
}});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const post = (parent, text) => c.post(`/api/db/${slug}/rows/comments`, parent ? { parent_id: parent, text } : { text }, { token: A });
// c1 (root) -> r1, r2 ; r1 -> rr1 ; c2 (root)
await post(null, "c1");   // 1
await post(1, "r1");      // 2
await post(1, "r2");      // 3
await post(2, "rr1");     // 4
await post(null, "c2");   // 5

let r = await c.get(`/api/db/${slug}/rows/comments/tree`);
t.ok(r.json.total === 5, "total 5 rows");
const roots = r.json.tree.map(x => x.text).sort();
t.eq(roots, ["c1", "c2"], "two roots: c1, c2");
const c1 = r.json.tree.find(x => x.text === "c1");
t.eq(c1.replies.map(x => x.text).sort(), ["r1", "r2"], "c1 has replies r1, r2");
const r1 = c1.replies.find(x => x.text === "r1");
t.eq(r1.replies.map(x => x.text), ["rr1"], "r1 has nested reply rr1");
const c2 = r.json.tree.find(x => x.text === "c2");
t.eq(c2.replies, [], "c2 has no replies");

// ?root=2 -> subtree under r1 (r1 + rr1)
r = await c.get(`/api/db/${slug}/rows/comments/tree?root=2`);
t.ok(r.json.tree.length === 1 && r.json.tree[0].text === "r1", "?root=2 -> just r1's subtree");
t.eq(r.json.tree[0].replies.map(x => x.text), ["rr1"], "subtree keeps nested rr1");

// non-self-referential table -> 400
t.ok((await c.get(`/api/db/${slug}/rows/flat/tree`)).status === 400, "non-self-ref table -> 400");

t.done(); h.restore();

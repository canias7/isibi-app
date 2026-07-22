// Batch 95 — per-user data export (GDPR): a member downloads all their own data
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 95");
const slug = "b95";
await c.ensure(slug);
await c.schema(slug, { tables: {
  posts: { access: "feed", columns: [{ name: "text", type: "text" }] },
  todos: { access: "user", columns: [{ name: "task", type: "text" }, { name: "meta", type: "json" }] },
  catalog: { access: "admin", columns: [{ name: "name", type: "text" }] }, // not owned → excluded
} });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2

// A's data
await c.post(`/api/db/${slug}/rows/posts`, { text: "A post 1" }, { token: A });
await c.post(`/api/db/${slug}/rows/posts`, { text: "A post 2" }, { token: A });
await c.post(`/api/db/${slug}/rows/todos`, { task: "A todo", meta: { p: 1 } }, { token: A });
// B's data (must NOT appear in A's export)
await c.post(`/api/db/${slug}/rows/posts`, { text: "B post" }, { token: B });
// A leaves a note on their own post
await c.post(`/api/db/${slug}/rows/posts/1/notes`, { body: "my note", kind: "note" }, { token: A });

let e = (await c.get(`/api/db/${slug}/auth/export`, { token: A })).json;
t.ok(e.ok, "export ok");
t.eq(e.profile.email, "a@x.dev", "profile is the caller's");
t.eq(e.data.posts.length, 2, "A's 2 posts exported");
t.ok(e.data.posts.every((r) => r.text.startsWith("A ")), "only A's posts (not B's)");
t.eq(e.data.todos.length, 1, "A's todo exported");
t.ok(e.data.todos[0].meta && e.data.todos[0].meta.p === 1, "json column parsed in export");
t.ok(!e.data.catalog, "admin (unowned) table not in export");
t.eq(e.notes.length, 1, "A's authored note exported");
t.eq(e.notes[0].body, "my note", "note body present");
t.ok(Array.isArray(e.attachments), "attachments array present");

// B's export is disjoint
let eb = (await c.get(`/api/db/${slug}/auth/export`, { token: B })).json;
t.eq(eb.data.posts.length, 1, "B sees only their 1 post");
t.eq(eb.data.posts[0].text, "B post", "B's own post");

// signed-out → 401
t.eq((await c.get(`/api/db/${slug}/auth/export`)).status, 401, "signed-out → 401");

t.done(); h.restore();

// Batch 22 — pinned/featured rows (pinned-first) + per-table defaultSort
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 22");

const slug = "b22";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    posts: { access: "feed", pinnable: true, defaultSort: "+title", columns: { title: "text" } },
    plain: { access: "feed", columns: { title: "text" } }, // no defaultSort/pinnable (control)
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
for (const ti of ["Cherry", "Apple", "Banana"]) {
  await c.post(`/api/db/${slug}/rows/posts`, { title: ti }, { token: A });
  await c.post(`/api/db/${slug}/rows/plain`, { title: ti }, { token: A });
}
const titles = (tbl, qs) => c.get(`/api/db/${slug}/rows/${tbl}${qs || ""}`).then((r) => (r.json.rows || []).map((x) => x.title));

// defaultSort: posts (no ?sort) come back title-ascending; plain falls back to id DESC
t.eq(await titles("posts"), ["Apple", "Banana", "Cherry"], "defaultSort=title -> title asc with no ?sort");
t.eq(await titles("plain"), ["Banana", "Apple", "Cherry"], "control table -> default id DESC");

// map title -> id
const rows = (await c.get(`/api/db/${slug}/rows/posts`)).json.rows;
const id = {}; for (const r of rows) id[r.title] = r.id;

// pin Banana (middle) via PATCH (pinned is app-writable)
t.ok((await c.patch(`/api/db/${slug}/rows/posts/${id.Banana}`, { pinned: 1 }, { token: A })).json.ok, "PATCH pinned=1 ok");

// pinned-first: Banana floats to top, then the rest keep title asc
t.eq(await titles("posts"), ["Banana", "Apple", "Cherry"], "pinned row first, then defaultSort order");

// pinned overrides an EXPLICIT sort too (Banana first, then title desc within the rest)
t.eq(await titles("posts", "?sort=title&order=desc"), ["Banana", "Cherry", "Apple"], "pinned-first survives explicit sort");

// pinned is queryable
t.eq(await titles("posts", "?where=pinned:eq:1"), ["Banana"], "?where=pinned:eq:1 -> only pinned");

// unpin -> back to pure defaultSort
await c.patch(`/api/db/${slug}/rows/posts/${id.Banana}`, { pinned: 0 }, { token: A });
t.eq(await titles("posts"), ["Apple", "Banana", "Cherry"], "unpinned -> pure defaultSort");

// explicit sort still overrides defaultSort (no pins now)
t.eq(await titles("posts", "?sort=title&order=desc"), ["Cherry", "Banana", "Apple"], "explicit sort overrides defaultSort");

t.done();
h.restore();

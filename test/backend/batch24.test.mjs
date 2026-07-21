// Batch 24 — Bookmarks / saves (private per-member saved list)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 24");

const slug = "b24";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: { title: "text" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id 2
for (const ti of ["one", "two", "three"]) await c.post(`/api/db/${slug}/rows/posts`, { title: ti }, { token: A });

// A saves posts:1 and posts:3
let r = await c.post(`/api/db/${slug}/save/posts:1`, {}, { token: A });
t.ok(r.json.saved === true && r.json.count === 1, "A saves posts:1 -> saved, count 1");
await c.post(`/api/db/${slug}/save/posts:3`, {}, { token: A });
// B also saves posts:1 -> count 2
r = await c.post(`/api/db/${slug}/save/posts:1`, {}, { token: B });
t.ok(r.json.count === 2, "B saves posts:1 -> count 2");

// state: mine reflects the caller
r = await c.get(`/api/db/${slug}/save/posts:1`, { token: A });
t.ok(r.json.count === 2 && r.json.mine === true, "GET save state as A -> mine true, count 2");
r = await c.get(`/api/db/${slug}/save/posts:2`, { token: A });
t.ok(r.json.mine === false, "posts:2 not saved by A -> mine false");
r = await c.get(`/api/db/${slug}/save/posts:1`); // anon
t.ok(r.json.count === 2 && r.json.mine === false, "anon GET -> count visible, mine false");

// my saves list (private) — A sees posts:1 and posts:3, newest first (3 then 1)
r = await c.get(`/api/db/${slug}/saves`, { token: A });
t.eq(r.json.saves.map((s) => s.target), ["posts:3", "posts:1"], "A's saves list newest-first");
t.eq(r.json.saves.map((s) => s.id), [3, 1], "saves parsed into {table,id}");
t.ok(r.json.saves.every((s) => s.table === "posts"), "saves carry table name");

// filter by table
await c.schema(slug, { tables: { notes: { access: "feed", columns: { body: "text" } } } });
await c.post(`/api/db/${slug}/rows/notes`, { body: "n" }, { token: A });
await c.post(`/api/db/${slug}/save/notes:1`, {}, { token: A });
r = await c.get(`/api/db/${slug}/saves?table=posts`, { token: A });
t.ok(r.json.saves.length === 2 && r.json.saves.every((s) => s.table === "posts"), "?table=posts filters saves");

// saves list requires auth
t.ok((await c.get(`/api/db/${slug}/saves`)).status === 401, "saves list needs auth -> 401");
// save toggle needs auth
t.ok((await c.post(`/api/db/${slug}/save/posts:1`, {})).status === 401, "save toggle needs auth -> 401");

// toggle off
r = await c.post(`/api/db/${slug}/save/posts:1`, {}, { token: A });
t.ok(r.json.saved === false && r.json.count === 1, "A unsaves posts:1 -> saved false, count 1 (B still has it)");
// idempotent force off
r = await c.post(`/api/db/${slug}/save/posts:1`, { on: false }, { token: A });
t.ok(r.json.saved === false, "force off idempotent");

t.done();
h.restore();

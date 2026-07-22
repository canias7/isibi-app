// Batch 105 — full-text search (FTS5): ranked ?fts= search, sync on insert/update/delete, scoping
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 105");
const slug = "b105";
await c.ensure(slug);
await c.schema(slug, { tables: {
  articles: { access: "admin", fts: true, columns: [{ name: "title", type: "text" }, { name: "body", type: "text" }] },
  notes: { access: "user", fts: ["text"], columns: [{ name: "text", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const fts = (tab, q, tok) => c.get(`/api/db/${slug}/rows/${tab}?fts=${encodeURIComponent(q)}`, tok ? { token: tok } : {});

await c.post(`/api/db/${slug}/rows/articles`, { title: "Hello World", body: "a warm greeting" }, { token: ADMIN }); // 1
await c.post(`/api/db/${slug}/rows/articles`, { title: "Goodbye", body: "world of departures" }, { token: ADMIN }); // 2
await c.post(`/api/db/${slug}/rows/articles`, { title: "Recipe", body: "cooking fresh pasta" }, { token: ADMIN }); // 3

// term appears in different columns → both match
let w = (await fts("articles", "world")).json;
t.ok(w.fts === true, "fts response flag");
t.eq(w.rows.map((r) => r.id).sort(), [1, 2], "'world' matches title of #1 and body of #2");
// single-column match
t.eq((await fts("articles", "greeting")).json.rows.map((r) => r.id), [1], "'greeting' → only #1");
// prefix match (fts terms are prefix queries)
t.eq((await fts("articles", "cook")).json.rows.map((r) => r.id), [3], "prefix 'cook' → #3 (cooking)");
t.eq((await fts("articles", "hel")).json.rows.map((r) => r.id), [1], "prefix 'hel' → #1 (Hello)");
// no match
t.eq((await fts("articles", "zzzznope")).json.rows.length, 0, "no match → empty");
// multi-word = AND
t.eq((await fts("articles", "warm greeting")).json.rows.map((r) => r.id), [1], "'warm greeting' AND → #1");
t.eq((await fts("articles", "warm departures")).json.rows.length, 0, "'warm departures' AND → none");

// index stays in sync on UPDATE
await c.patch(`/api/db/${slug}/rows/articles/3`, { body: "now about world tourism" }, { token: ADMIN });
t.eq((await fts("articles", "world")).json.rows.map((r) => r.id).sort(), [1, 2, 3], "after edit, #3 now matches 'world'");
t.eq((await fts("articles", "cooking")).json.rows.length, 0, "old term 'cooking' no longer matches #3");

// and on DELETE
await c.del(`/api/db/${slug}/rows/articles/1`, { token: ADMIN });
t.eq((await fts("articles", "greeting")).json.rows.length, 0, "deleted row drops out of the index");

// user-table FTS is scoped to the caller's own rows
await c.post(`/api/db/${slug}/rows/notes`, { text: "secret pineapple plan" }, { token: A });
t.eq((await fts("notes", "pineapple", A)).json.rows.length, 1, "owner finds their own note via fts");
t.eq((await fts("notes", "pineapple", B)).json.rows.length, 0, "another user's fts doesn't see it");

t.done(); h.restore();

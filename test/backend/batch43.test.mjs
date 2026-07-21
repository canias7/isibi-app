import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 43");
const slug = "b43";
await c.ensure(slug);
await c.schema(slug, { tables: {
  chatty: { access: "feed", rateLimit: 3, columns: { text: "text" } },   // 3 writes/min/member
  open: { access: "feed", columns: { text: "text" } },                     // no limit
}});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
// A: 3 posts ok, 4th throttled
for (let i=0;i<3;i++) t.ok((await c.post(`/api/db/${slug}/rows/chatty`, { text: "m"+i }, { token: A })).json.ok, "A post "+i+" ok");
const over = await c.post(`/api/db/${slug}/rows/chatty`, { text: "m4" }, { token: A });
t.ok(over.status === 429, "A 4th post -> 429 throttled");
// B has their own budget
t.ok((await c.post(`/api/db/${slug}/rows/chatty`, { text: "b" }, { token: B })).json.ok, "B post ok (separate budget)");
// the limit is per-table: A can still write to the un-limited table
t.ok((await c.post(`/api/db/${slug}/rows/open`, { text: "x" }, { token: A })).json.ok, "A can write to non-limited table");
t.ok((await c.post(`/api/db/${slug}/rows/open`, { text: "y" }, { token: A })).json.ok, "...repeatedly");
// PATCH/DELETE also count toward the limit (A already at cap on chatty) -> throttled
const id = (await c.get(`/api/db/${slug}/rows/chatty?where=text:eq:m0`)).json.rows[0].id;
t.ok((await c.patch(`/api/db/${slug}/rows/chatty/${id}`, { text: "z" }, { token: A })).status === 429, "A PATCH on chatty also throttled (at cap)");
t.done(); h.restore();

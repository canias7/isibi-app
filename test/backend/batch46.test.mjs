import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 46");
const slug = "b46";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
// link post:1 <-> tag:5, post:1 <-> tag:6, post:2 <-> tag:5
t.ok((await c.post(`/api/db/${slug}/link`, { a: "post:1", b: "tag:5" }, { token: A })).json.linked, "link post:1<->tag:5");
await c.post(`/api/db/${slug}/link`, { a: "tag:6", b: "post:1" }, { token: A }); // reversed order still normalizes
await c.post(`/api/db/${slug}/link`, { a: "post:2", b: "tag:5" }, { token: A });
// links of post:1 -> tag:5, tag:6 (queryable from post side)
let r = await c.get(`/api/db/${slug}/links/post:1`);
t.eq(r.json.links.map(l=>l.target).sort(), ["tag:5","tag:6"], "post:1 links to tag:5,tag:6");
t.ok(r.json.links.every(l=>l.table==="tag"), "links parsed {table,id}");
// links of tag:5 -> post:1, post:2 (queryable from the OTHER side too)
r = await c.get(`/api/db/${slug}/links/tag:5`);
t.eq(r.json.links.map(l=>l.target).sort(), ["post:1","post:2"], "tag:5 links to post:1,post:2 (bidirectional)");
// ?to filter
r = await c.get(`/api/db/${slug}/links/post:1?to=tag`);
t.ok(r.json.links.length === 2 && r.json.links.every(l=>l.table==="tag"), "?to=tag filters");
r = await c.get(`/api/db/${slug}/links/post:1?to=user`);
t.eq(r.json.links, [], "?to=user -> none");
// dedup: linking same pair again (either order) doesn't duplicate
await c.post(`/api/db/${slug}/link`, { a: "tag:5", b: "post:1" }, { token: A });
t.ok((await c.get(`/api/db/${slug}/links/post:1`)).json.links.length === 2, "re-link deduped (still 2)");
// unlink
await c.del(`/api/db/${slug}/link`, { token: A, body: { a: "post:1", b: "tag:5" } });
t.eq((await c.get(`/api/db/${slug}/links/post:1`)).json.links.map(l=>l.target), ["tag:6"], "after unlink -> only tag:6");
// guards
t.ok((await c.post(`/api/db/${slug}/link`, { a: "bad", b: "tag:5" }, { token: A })).status === 400, "bad target shape -> 400");
t.ok((await c.post(`/api/db/${slug}/link`, { a: "post:1", b: "post:1" }, { token: A })).status === 400, "self-link -> 400");
t.ok((await c.post(`/api/db/${slug}/link`, { a: "post:1", b: "tag:9" })).status === 401, "link needs auth -> 401");
t.done(); h.restore();

import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 52");
const slug = "b52";
await c.ensure(slug);
await c.schema(slug, { tables: {
  articles: { access: "feed", searchWeights: { title: 5, body: 1 }, columns: { title: "text", body: "text" } },
  plain: { access: "feed", columns: { title: "text", body: "text" } },
}});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
// row X: "coffee" only in body ; row Y: "coffee" in title
await c.post(`/api/db/${slug}/rows/articles`, { title: "About tea", body: "we also serve coffee here" }, { token: A });
await c.post(`/api/db/${slug}/rows/articles`, { title: "Coffee guide", body: "all about beans" }, { token: A });
// q=coffee -> both match (filter), but title-match (Y) ranks FIRST due to weight 5
let rows = (await c.get(`/api/db/${slug}/rows/articles?q=coffee`)).json.rows;
t.ok(rows.length === 2, "both rows match q=coffee");
t.ok(rows[0].title === "Coffee guide", "title match ranks first (weighted)");
t.ok(rows[1].title === "About tea", "body-only match ranks second");

// control: plain table (no weights) -> both match, order by relevance (equal weight) then id desc
rows = (await c.get(`/api/db/${slug}/rows/plain?q=coffee`)).json.rows;
// insert same into plain
await c.post(`/api/db/${slug}/rows/plain`, { title: "About tea", body: "we also serve coffee here" }, { token: A });
await c.post(`/api/db/${slug}/rows/plain`, { title: "Coffee guide", body: "all about beans" }, { token: A });
rows = (await c.get(`/api/db/${slug}/rows/plain?q=coffee`)).json.rows;
t.ok(rows.length === 2, "plain table q=coffee matches both (equal weight)");

// explicit sort still overrides ranking
rows = (await c.get(`/api/db/${slug}/rows/articles?q=coffee&sort=title&order=asc`)).json.rows;
t.ok(rows[0].title === "About tea", "explicit sort overrides weighted rank");

// where=title:contains still works alongside
rows = (await c.get(`/api/db/${slug}/rows/articles?where=title:contains:Coffee`)).json.rows;
t.ok(rows.length === 1 && rows[0].title === "Coffee guide", "where filter unaffected");

t.done(); h.restore();

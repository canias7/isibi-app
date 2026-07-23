// Batch 235 — CONTENT SYNDICATION (sitemap.xml + rss.xml). An admin registers published URLs; the site
// serves them as an XML sitemap and an RSS 2.0 feed. Covers upsert (by url), JSON list, sitemap XML shape,
// RSS XML shape, XML escaping, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 235");
const slug = "b235";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const add = (tok, body) => c.post(`/api/db/${slug}/syndication`, body, tok === null ? {} : { token: tok });
const listJson = (tok) => c.get(`/api/db/${slug}/syndication`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/syndication/${id}`, { token: tok });
const sitemap = () => c.get(`/api/db/${slug}/sitemap.xml`);
const rss = (q) => c.get(`/api/db/${slug}/rss.xml${q || ""}`);

// --- Register items ---
const id1 = (await add(A, { url: "https://site.x/a", title: "Post A", summary: "First", published: "2026-01-01", priority: 0.8 })).json.id;
await add(A, { url: "https://site.x/b", title: "Post B & More", published: "2026-02-01" });
t.ok(id1, "admin registers an item");

// --- Upsert by url ---
t.eq((await add(A, { url: "https://site.x/a", title: "Post A v2", priority: 0.9 })).json.id, id1, "re-posting the same url upserts (same id)");
t.eq((await listJson(A)).items.length, 2, "still 2 items after upsert");

// --- Sitemap XML ---
let sm = await sitemap();
t.eq(sm.status, 200, "sitemap returns 200");
t.ok(sm.text.includes("<urlset"), "…is a urlset");
t.ok(sm.text.includes("<loc>https://site.x/a</loc>"), "…contains the URL");
t.ok(sm.text.includes("<priority>0.9</priority>"), "…with the priority");
t.ok(sm.text.includes("<lastmod>"), "…and a lastmod");

// --- RSS XML + escaping ---
let rs = await rss("?title=My Blog");
t.eq(rs.status, 200, "rss returns 200");
t.ok(rs.text.includes("<rss version=\"2.0\">"), "…is an RSS 2.0 doc");
t.ok(rs.text.includes("<title>My Blog</title>"), "…channel title from ?title");
t.ok(rs.text.includes("Post B &amp; More"), "…the '&' in an item title is XML-escaped");
t.ok(rs.text.includes("<link>https://site.x/a</link>"), "…item link present");

// --- Delete ---
t.eq((await del(A, id1)).json.deleted, true, "admin deletes an item");
t.ok(!(await sitemap()).text.includes("https://site.x/a"), "…gone from the sitemap");
t.eq((await del(A, 999999)).status, 404, "deleting a missing item → 404");

// --- Authz ---
t.eq((await add(A, {})).status, 400, "missing url → 400");
t.eq((await add(B, { url: "https://x/y" })).status, 403, "a member can't register → 403");
t.eq((await listJson(B)).status ?? 403, 403, "a member can't list JSON → 403");
t.eq((await c.get(`/api/db/${slug}/syndication`, { token: B })).status, 403, "…confirmed 403");
t.eq((await add(null, { url: "https://x/y" })).status, 401, "signed-out register → 401");
// feeds are public
t.eq((await sitemap()).status, 200, "sitemap is public (200 with no auth)");

t.done(); h.restore();

import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 49");
const slug = "b49";
await c.ensure(slug); // gives the slug a backend -> counts as "live"
// a tiny 1x1 png data URL
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
let r = await c.post(`/api/db/${slug}/upload`, { name: "pixel.png", data: png });
t.ok(r.json.ok && /^https:\/\/isibi\.ai\/u\/b49\/[a-f0-9]{20}\.png$/.test(r.json.url), "png upload -> public /u/ url (" + (r.json && r.json.url) + ")");
t.ok(r.json.type === "image/png" && r.json.name === "pixel.png" && r.json.size > 0, "response carries type/name/size metadata");
// the file is retrievable from R2 at the stored key
const key = "uploads/" + slug + "/" + r.json.url.split("/").pop();
t.ok(h.env.SITES_BUCKET._map.has(key), "file stored in R2 under uploads/<slug>/");
// pdf ok
r = await c.post(`/api/db/${slug}/upload`, { name: "doc.pdf", data: "data:application/pdf;base64,JVBERi0xLjQK" });
t.ok(r.json.ok && r.json.url.endsWith(".pdf"), "pdf upload ok");
// disallowed type -> 415
r = await c.post(`/api/db/${slug}/upload`, { data: "data:text/html;base64,PGgxPg==" });
t.ok(r.status === 415, "text/html -> 415");
// non-data-url -> 400
t.ok((await c.post(`/api/db/${slug}/upload`, { data: "notadataurl" })).status === 400, "bad data -> 400");
// a site with NO backend -> not live -> 400
t.ok((await c.post(`/api/db/never-ensured/upload`, { data: png })).status === 400, "no-backend slug -> not live 400");
t.done(); h.restore();

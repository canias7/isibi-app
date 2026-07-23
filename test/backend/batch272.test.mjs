// Batch 272 — EMBED CACHE. Cache embed/oEmbed metadata per URL so the app renders a rich embed without
// re-fetching. Covers cache (member), public read, unknown → null, update, admin delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 272");
const slug = "b272";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const cache = (tok, body) => c.post(`/api/db/${slug}/embeds`, body, tok === null ? {} : { token: tok });
const read = (u) => c.get(`/api/db/${slug}/embeds?url=${encodeURIComponent(u)}`).then((r) => r.json);
const del = (tok, u) => c.del(`/api/db/${slug}/embeds?url=${encodeURIComponent(u)}`, { token: tok });
const vid = "https://youtube.com/watch?v=abc";

// --- Cache (member) ---
t.eq((await cache(B, { url: vid, title: "Cool Video", html: "<iframe src=...></iframe>", thumbnail: "https://img/thumb.jpg", provider: "YouTube" })).json.url, vid, "member caches an embed");

// --- Public read ---
let e = (await read(vid)).embed;
t.eq(e.title, "Cool Video", "public reads the cached embed");
t.ok(e.html.includes("iframe"), "…with the embed html");
t.eq(e.provider, "YouTube", "…and the provider");

// --- Unknown url → null ---
t.eq((await read("https://x/nope")).embed, null, "an uncached url → embed null");

// --- Update ---
await cache(A, { url: vid, title: "Cool Video (updated)" });
t.eq((await read(vid)).embed.title, "Cool Video (updated)", "re-caching updates the entry");

// --- Delete (admin) ---
t.eq((await del(A, vid)).json.deleted, true, "admin deletes a cached embed");
t.eq((await read(vid)).embed, null, "…gone");

// --- Validation + authz ---
t.eq((await cache(A, {})).status, 400, "missing url → 400");
t.eq((await c.get(`/api/db/${slug}/embeds`)).status, 400, "read with no ?url → 400");
t.eq((await cache(null, { url: "https://x/y" })).status, 401, "signed-out cache → 401");
t.eq((await del(B, vid)).status, 403, "a member can't delete → 403");

t.done(); h.restore();

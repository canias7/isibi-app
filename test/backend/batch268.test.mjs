// Batch 268 — DOWNLOADS. A per-file download counter, optionally gated to signed-in members. Covers
// register, hit (count + url), gated (401 signed-out, ok signed-in), read (no count), gated read hides url,
// list (most-downloaded), delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 268");
const slug = "b268";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const register = (tok, file, body) => c.post(`/api/db/${slug}/downloads/${file}`, body, tok === null ? {} : { token: tok });
const hit = (tok, file) => c.post(`/api/db/${slug}/downloads/${file}/hit`, {}, tok ? { token: tok } : {});
const read = (file) => c.get(`/api/db/${slug}/downloads/${file}`).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/downloads`).then((r) => r.json);
const del = (tok, file) => c.del(`/api/db/${slug}/downloads/${file}`, { token: tok });

// --- Register a public file ---
t.eq((await register(A, "guide", { name: "Guide", url: "https://cdn.x/guide.pdf" })).json.file, "guide", "admin registers a file");

// --- Hit counts + returns the url ---
let r = await hit(null, "guide");
t.eq(r.json.count, 1, "first download → count 1");
t.eq(r.json.url, "https://cdn.x/guide.pdf", "…returns the file url");
await hit(null, "guide"); await hit(B, "guide");
t.eq((await read("guide")).count, 3, "3 downloads counted");

// --- Read doesn't increment ---
t.eq((await read("guide")).count, 3, "reading again doesn't count a download");
t.eq((await read("guide")).url, "https://cdn.x/guide.pdf", "…a public file exposes its url");

// --- Gated file ---
await register(A, "ebook", { name: "Ebook", url: "https://cdn.x/ebook.pdf", gated: true });
t.eq((await hit(null, "ebook")).status, 401, "a signed-out gated download → 401");
t.eq((await hit(B, "ebook")).json.count, 1, "a signed-in member can download the gated file");
t.eq((await read("ebook")).url, null, "…a gated file hides its url on public read");
t.eq((await read("ebook")).gated, true, "…and reports gated:true");

// --- List (most-downloaded first) ---
let l = (await list()).downloads;
t.eq(l[0].file, "guide", "most-downloaded (guide, 3) tops the list");
t.eq(l[0].count, 3, "…with its count");

// --- Delete ---
t.eq((await del(A, "ebook")).json.deleted, true, "admin deletes a file");
t.eq((await read("ebook")).status ?? 404, 404, "…gone");

// --- Validation + authz ---
t.eq((await hit(null, "nope")).status, 404, "hitting an unknown file → 404");
t.eq((await register(B, "hax", { url: "x" })).status, 403, "a member can't register → 403");
t.eq((await del(B, "guide")).status, 403, "a member can't delete → 403");
t.eq((await register(null, "x", {})).status, 401, "signed-out register → 401");

t.done(); h.restore();

// Batch 230 — MEDIA LIBRARY METADATA. Alt text / caption / credit / tags / dimensions for a media asset,
// keyed by its URL or id. Covers upsert, public read, tags array round-trip, update, admin list + tag
// filter, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 230");
const slug = "b230";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const set = (tok, body) => c.post(`/api/db/${slug}/media-meta`, body, tok === null ? {} : { token: tok });
const read = (key) => c.get(`/api/db/${slug}/media-meta?key=${encodeURIComponent(key)}`).then((r) => r.json);
const listM = (tok, q) => c.get(`/api/db/${slug}/media-meta${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/media-meta?key=${encodeURIComponent(key)}`, { token: tok });
const url1 = "https://cdn.x/img/hero.jpg";

// --- Upsert + read ---
t.eq((await set(A, { key: url1, alt: "A sunset", caption: "Golden hour", credit: "Jane", tags: ["hero", "landscape"], width: 1920, height: 1080 })).json.key, url1, "admin sets metadata");
let m = (await read(url1)).meta;
t.eq(m.alt, "A sunset", "public reads the alt text");
t.eq(m.caption, "Golden hour", "…caption");
t.eq(m.width, 1920, "…width");
t.ok(Array.isArray(m.tags) && m.tags.length === 2 && m.tags.includes("hero") && m.tags.includes("landscape"), "…tags round-trip as an array");

// --- Unknown key reads null ---
t.eq((await read("https://cdn.x/nope.jpg")).meta, null, "unknown key → null");

// --- Update replaces ---
await set(A, { key: url1, alt: "Sunset over hills", tags: ["hero"] });
m = (await read(url1)).meta;
t.eq(m.alt, "Sunset over hills", "update replaces the alt");
t.eq(m.tags.length, 1, "…tags replaced");

// --- List + tag filter (admin) ---
await set(A, { key: "https://cdn.x/img/team.jpg", alt: "The team", tags: ["people"] });
t.eq((await listM(A)).media.length, 2, "admin lists all media meta");
t.eq((await listM(A, "?tag=people")).media.length, 1, "tag filter → 1");
t.eq((await listM(A, "?tag=hero")).media.length, 1, "tag filter hero → 1");

// --- Delete ---
t.eq((await del(A, url1)).json.deleted, true, "admin deletes metadata");
t.eq((await read(url1)).meta, null, "…gone");

// --- Validation + authz ---
t.eq((await set(A, { alt: "no key" })).status, 400, "missing key → 400");
t.eq((await c.del(`/api/db/${slug}/media-meta`, { token: A })).status, 400, "delete with no ?key → 400");
t.eq((await set(B, { key: "x", alt: "y" })).status, 403, "a member can't set → 403");
t.eq((await listM(B)).status ?? 403, 403, "a member can't list → 403");
t.eq((await c.get(`/api/db/${slug}/media-meta`, { token: B })).status, 403, "…confirmed 403");
t.eq((await set(null, { key: "x" })).status, 401, "signed-out set → 401");

t.done(); h.restore();

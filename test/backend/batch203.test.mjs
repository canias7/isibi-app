// Batch 203 — SEO METADATA per record. An admin stores title/description/og-image/canonical/keywords for
// an (entity, ref) pair; the app reads it back to render <head> tags. Covers upsert, public read, update,
// all-list (admin), delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 203");
const slug = "b203";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const put = (tok, body) => c.post(`/api/db/${slug}/seo`, body, tok === null ? {} : { token: tok });
const read = (entity, ref) => c.get(`/api/db/${slug}/seo?entity=${encodeURIComponent(entity)}&ref=${encodeURIComponent(ref)}`).then((r) => r.json);
const del = (tok, entity, ref) => c.del(`/api/db/${slug}/seo?entity=${encodeURIComponent(entity)}&ref=${encodeURIComponent(ref)}`, { token: tok });
const all = (tok) => c.get(`/api/db/${slug}/seo/all`, { token: tok });

// --- Upsert (admin) ---
t.eq((await put(A, { entity: "product", ref: "42", title: "Cool Shoe", description: "Best shoe", image: "https://x/og.png" })).json.ref, "42", "admin sets meta for product 42");

// --- Read (public) ---
let m = (await read("product", "42")).meta;
t.eq(m.title, "Cool Shoe", "public reads the title");
t.eq(m.description, "Best shoe", "…and description");
t.eq(m.image, "https://x/og.png", "…and og image");
t.eq((await read("product", "999")).meta, null, "unset (entity,ref) reads null");

// --- Update (same key upserts) ---
await put(A, { entity: "product", ref: "42", title: "Cooler Shoe", canonical: "https://x/p/42", keywords: "shoe,cool" });
m = (await read("product", "42")).meta;
t.eq(m.title, "Cooler Shoe", "update replaces the title");
t.eq(m.canonical, "https://x/p/42", "…and sets canonical");
t.eq(m.keywords, "shoe,cool", "…and keywords");

// --- A bare-path entity works too ---
await put(A, { entity: "page", ref: "/about", title: "About Us" });
t.eq((await read("page", "/about")).meta.title, "About Us", "a path ref works");

// --- All (admin) ---
t.eq((await all(A)).json.meta.length, 2, "admin lists all meta rows");

// --- Delete (admin) ---
t.eq((await del(A, "product", "42")).json.deleted, true, "admin deletes a meta row");
t.eq((await read("product", "42")).meta, null, "…read is null again");
t.eq((await del(A, "product", "42")).json.deleted, false, "deleting a missing row → deleted:false");

// --- Validation + authz ---
t.eq((await put(A, { ref: "1" })).status, 400, "missing entity → 400");
t.eq((await put(A, { entity: "x" })).status, 400, "missing ref → 400");
t.eq((await c.get(`/api/db/${slug}/seo`)).status, 400, "read with no entity/ref → 400");
t.eq((await put(B, { entity: "x", ref: "1", title: "t" })).status, 403, "a member can't write → 403");
t.eq((await del(B, "x", "1")).status, 403, "a member can't delete → 403");
t.eq((await all(B)).status, 403, "a member can't list all → 403");
t.eq((await put(null, { entity: "x", ref: "1" })).status, 401, "signed-out write → 401");

t.done(); h.restore();

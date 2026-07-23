// Batch 204 — REUSABLE CONTENT SNIPPETS / BLOCKS. An admin stores named content chunks keyed by slug; the
// app reads a PUBLISHED one, the admin lists all (incl. drafts). Covers upsert, public read (published-only),
// draft hiding, public list, admin all-list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 204");
const slug = "b204";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const put = (tok, key, body) => c.post(`/api/db/${slug}/snippets/${key}`, body, tok === null ? {} : { token: tok });
const read = (key) => c.get(`/api/db/${slug}/snippets/${key}`);
const del = (tok, key) => c.del(`/api/db/${slug}/snippets/${key}`, { token: tok });
const list = () => c.get(`/api/db/${slug}/snippets`).then((r) => r.json);
const all = (tok) => c.get(`/api/db/${slug}/snippets/all`, { token: tok });

// --- Upsert (admin) ---
t.eq((await put(A, "banner", { title: "Promo", body: "50% off!", format: "html" })).json.slug, "banner", "admin creates a snippet");
t.eq((await put(A, "banner", { title: "Promo", body: "50% off!" })).json.published, true, "published by default");

// --- Read one (public, published) ---
let r = (await read("banner")).json.snippet;
t.eq(r.body, "50% off!", "public reads the body");
t.eq(r.title, "Promo", "…and title");

// --- Draft is hidden from public read ---
await put(A, "wip", { body: "draft content", published: false });
t.eq((await read("wip")).status, 404, "an unpublished snippet is 404 to the public");

// --- Update flips publish state ---
await put(A, "wip", { body: "now live", published: true });
t.eq((await read("wip")).json.snippet.body, "now live", "re-publishing makes it readable");

// --- Public list = published only ---
await put(A, "footer", { body: "© 2026", published: false });
const l = await list();
t.ok(l.snippets.some((s) => s.slug === "banner") && l.snippets.some((s) => s.slug === "wip"), "public list has published ones");
t.ok(!l.snippets.some((s) => s.slug === "footer"), "…but not the unpublished footer");

// --- Admin all = includes drafts ---
const a = (await all(A)).json.snippets;
t.eq(a.length, 3, "admin sees all 3 incl. the draft");
t.ok(a.some((s) => s.slug === "footer" && s.published === 0), "…the footer draft shows published:0");

// --- Delete (admin) ---
t.eq((await del(A, "footer")).json.deleted, true, "admin deletes a snippet");
t.eq((await del(A, "footer")).status, 404, "deleting a missing snippet → 404");

// --- Validation + authz ---
t.eq((await put(A, "empty", { title: "x" })).status, 400, "missing body → 400");
t.eq((await read("nope")).status, 404, "unknown snippet → 404");
t.eq((await put(B, "hax", { body: "x" })).status, 403, "a member can't write → 403");
t.eq((await del(B, "banner")).status, 403, "a member can't delete → 403");
t.eq((await all(B)).status, 403, "a member can't list all → 403");
t.eq((await put(null, "x", { body: "y" })).status, 401, "signed-out write → 401");

t.done(); h.restore();

// Batch 312 — SLUGIFY. Stateless URL-slug generator: lowercase, strip accents, non-alphanumerics → separator,
// trim, cap length; an optional `existing` list appends -2/-3 on collision. Covers basics, accents, separator,
// max length, collision suffix, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 312");
const slug = "b312";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const sl = (body) => c.post(`/api/db/${slug}/slugify`, body).then((r) => r.json);

t.eq((await sl({ text: "Hello, World!" })).slug, "hello-world", "basic slug");
t.eq((await sl({ text: "  Multiple   Spaces  " })).slug, "multiple-spaces", "collapses whitespace + trims");
t.eq((await sl({ text: "Café Déjà Vu" })).slug, "cafe-deja-vu", "strips accents");
t.eq((await sl({ text: "Under_score me", separator: "_" })).slug, "under_score_me", "honors a custom separator");
t.eq((await sl({ text: "This Is A Very Long Title That Exceeds", max: 10 })).slug.length <= 10, true, "caps to max length");
t.ok(!/-$/.test((await sl({ text: "trailing punctuation!!!", max: 12 })).slug), "no trailing separator after truncation");

// --- Collision suffix ---
let r = await sl({ text: "My Post", existing: ["my-post"] });
t.eq(r.base, "my-post", "base slug reported");
t.eq(r.slug, "my-post-2", "collides → appends -2");
t.eq((await sl({ text: "My Post", existing: ["my-post", "my-post-2"] })).slug, "my-post-3", "…and -3 when -2 is taken too");
t.eq((await sl({ text: "Free Slug", existing: ["other"] })).slug, "free-slug", "no collision → base slug");

// --- Non-alphanumeric-only text still yields a slug ---
t.ok((await sl({ text: "!!!" })).slug.length > 0, "punctuation-only text still returns a slug");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/slugify`, { text: "   " })).status, 400, "blank text → 400");
t.eq((await c.post(`/api/db/${slug}/slugify`, {})).status, 400, "missing text → 400");

t.done(); h.restore();

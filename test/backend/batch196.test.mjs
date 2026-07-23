// Batch 196 — FAQ / KNOWLEDGE BASE. Admin-managed Q&A; the public reads published entries with a category
// filter + text search. Covers publish gating, search over question+answer, categories, admin all-view,
// edit/delete, and authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 196");
const slug = "b196";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/faq`, body, tok === null ? {} : { token: tok });
const pub = (tok, qs) => c.get(`/api/db/${slug}/faq${qs || ""}`, tok === null ? {} : { token: tok }).then((r) => r.json.faq);
const cats = (tok) => c.get(`/api/db/${slug}/faq/categories`, tok === null ? {} : { token: tok }).then((r) => r.json.categories);
const allOf = (tok) => c.get(`/api/db/${slug}/faq/all`, { token: tok });
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/faq/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/faq/${id}`, { token: tok });

// --- Create (2 published, 1 draft) ---
const f1 = (await create(A, { question: "How do I reset my password?", answer: "Click the reset link", category: "account" })).json.id;
const f2 = (await create(A, { question: "How long is shipping?", answer: "About 3 days", category: "orders" })).json.id;
const f3 = (await create(A, { question: "Secret draft", answer: "not ready", published: false })).json.id;
t.ok(f1 && f2 && f3, "three entries created");

// --- Public read excludes drafts ---
t.eq((await pub(null)).map((x) => x.id).sort((a, b) => a - b), [f1, f2].sort((a, b) => a - b), "public list = the 2 published (draft hidden), no login needed");
t.eq((await pub(B, "?category=account")).map((x) => x.id), [f1], "?category filters");
t.eq((await pub(B, "?q=reset")).map((x) => x.id), [f1], "?q searches the question");
t.eq((await pub(B, "?q=days")).map((x) => x.id), [f2], "?q also searches the answer");
t.eq(await cats(null), ["account", "orders"], "categories → distinct, sorted, published-only");

// --- Admin all-view ---
t.eq((await allOf(A)).json.faq.length, 3, "admin /all includes the draft");
t.eq((await allOf(B)).status, 403, "a member can't read /all → 403");

// --- Publish the draft, then it shows ---
t.eq((await patch(A, f3, { published: true })).json.updated, true, "publish the draft");
t.eq((await pub(null)).length, 3, "…now 3 public entries");

// --- Delete ---
t.eq((await del(A, f2)).json.deleted, true, "delete f2");
t.eq((await pub(null)).length, 2, "…2 remain");
t.eq((await del(A, 99999)).status, 404, "delete a non-existent entry → 404");

// --- Validation + authz ---
t.eq((await create(A, { answer: "no q" })).status, 400, "missing question → 400");
t.eq((await create(B, { question: "hax" })).status, 403, "a non-admin can't create → 403");
t.eq((await patch(B, f1, { answer: "x" })).status, 403, "a non-admin can't edit → 403");
t.eq((await del(B, f1)).status, 403, "a non-admin can't delete → 403");
t.eq((await create(null, { question: "q" })).status, 401, "signed-out create → 401");
t.ok(Array.isArray(await pub(null)), "…but the public list reads without a token");

t.done(); h.restore();

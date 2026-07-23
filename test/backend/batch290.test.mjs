// Batch 290 — TESTIMONIALS. A curated wall: members submit quotes (pending), an admin approves/features/
// reorders, the public list returns only approved ones (featured first). Covers submit, public visibility,
// admin all, approve, feature ordering, edit, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 290");
const slug = "b290";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const submit = (tok, body) => c.post(`/api/db/${slug}/testimonials`, body, tok === null ? {} : { token: tok });
const pub = () => c.get(`/api/db/${slug}/testimonials`).then((r) => r.json);
const all = (tok) => c.get(`/api/db/${slug}/testimonials/all`, { token: tok });
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/testimonials/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/testimonials/${id}`, { token: tok });

// --- Submit (pending) ---
const id1 = (await submit(B, { quote: "Best tool ever", author: "Bob", role: "CEO", rating: 5 })).json.id;
t.ok(id1, "member submits a testimonial");
t.eq((await pub()).testimonials.length, 0, "…it's pending, so the public list is empty");
t.eq((await all(A)).json.testimonials.length, 1, "admin sees it in /all");

// --- Approve → public ---
t.eq((await patch(A, id1, { approved: true })).json.testimonial.approved, true, "admin approves it");
t.eq((await pub()).testimonials.length, 1, "…now public");

// --- Feature ordering ---
const id2 = (await submit(B, { quote: "Second quote" })).json.id;
await patch(A, id2, { approved: true, position: 1 });
await patch(A, id1, { position: 5 });
await patch(A, id2, { featured: true });
let list = (await pub()).testimonials;
t.eq(list[0].id, id2, "the featured testimonial sorts first");

// --- Edit the quote text ---
t.eq((await patch(A, id1, { quote: "Edited quote" })).json.testimonial.quote, "Edited quote", "admin edits the quote");

// --- Delete ---
t.eq((await del(A, id1)).json.deleted, true, "admin deletes a testimonial");
t.eq((await pub()).testimonials.length, 1, "…one approved remains");

// --- Validation + authz ---
t.eq((await submit(B, {})).status, 400, "a missing quote → 400");
t.eq((await patch(B, id2, { approved: true })).status, 403, "a member can't approve → 403");
t.eq((await all(B)).status, 403, "a member can't read /all → 403");
t.eq((await del(B, id2)).status, 403, "a member can't delete → 403");
t.eq((await patch(A, 999999, { approved: true })).status, 404, "patching a missing one → 404");
t.eq((await c.post(`/api/db/${slug}/testimonials`, { quote: "x" })).status, 401, "signed-out submit → 401");

t.done(); h.restore();

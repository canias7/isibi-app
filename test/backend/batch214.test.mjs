// Batch 214 — LEAD CAPTURE + SCORING. A public web form captures a prospect; staff triage, score, own it.
// Covers public capture (validation), admin list (status/min_score/sort filters), get, score bump, patch
// (status/owner/fields), delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 214");
const slug = "b214";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const capture = (body) => c.post(`/api/db/${slug}/leads`, body); // public
const list = (tok, q) => c.get(`/api/db/${slug}/leads${q || ""}`, { token: tok }).then((r) => r.json);
const getL = (tok, id) => c.get(`/api/db/${slug}/leads/${id}`, { token: tok }).then((r) => r.json);
const score = (tok, id, by) => c.post(`/api/db/${slug}/leads/${id}/score`, { by }, { token: tok }).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/leads/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/leads/${id}`, { token: tok });

// --- Public capture ---
const l1 = (await capture({ name: "Jane", email: "jane@corp.com", company: "Corp", source: "homepage" })).json;
t.ok(l1.id, "public form captures a lead");
await capture({ phone: "555-1234" }); // phone-only ok
await capture({ email: "bob@x.io" });

// --- Admin list ---
t.eq((await list(A)).leads.length, 3, "admin lists all captured leads");
t.eq((await list(A)).leads[0].status, "new", "…new leads default to 'new'");

// --- Score bump ---
t.eq((await score(A, l1.id, 25)).score, 25, "score bumps by 25");
t.eq((await score(A, l1.id, 10)).score, 35, "…and accumulates to 35");
t.eq((await score(A, l1.id, -5)).score, 30, "…negative bumps work");

// --- min_score + sort filters ---
t.eq((await list(A, "?min_score=20")).leads.length, 1, "min_score filters to the hot lead");
t.eq((await list(A, "?sort=score")).leads[0].id, l1.id, "sort=score puts the top lead first");

// --- Patch: status + owner + field ---
t.eq((await patch(A, l1.id, { status: "qualified", owner: 1, company: "BigCorp" })).json.id, l1.id, "admin qualifies + assigns + edits");
let g = (await getL(A, l1.id)).lead;
t.eq(g.status, "qualified", "…status updated");
t.eq(g.owner_id, 1, "…owner assigned");
t.eq(g.company, "BigCorp", "…company edited");
t.eq((await list(A, "?status=qualified")).leads.length, 1, "status filter works");

// --- Delete ---
t.eq((await del(A, l1.id)).json.deleted, true, "admin deletes a lead");
t.eq((await getL(A, l1.id)).ok ?? false, false, "…it's gone");

// --- Validation + authz ---
const l2 = (await capture({ email: "keep@x.io" })).json.id;
t.eq((await capture({})).status, 400, "a form with no name/email/phone → 400");
t.eq((await capture({ email: "notanemail" })).status, 400, "a bad email → 400");
t.eq((await patch(A, 999999, { status: "new" })).status, 404, "patching a missing lead → 404");
t.eq((await patch(A, l2, { status: "bogus" })).status, 400, "a bad status → 400");
t.eq((await c.get(`/api/db/${slug}/leads`, { token: B })).status, 403, "a member can't list leads → 403");
t.eq((await c.post(`/api/db/${slug}/leads/${l2}/score`, { by: 5 }, { token: B })).status, 403, "a member can't score → 403");
t.eq((await del(B, l2)).status, 403, "a member can't delete → 403");

t.done(); h.restore();

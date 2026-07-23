// Batch 244 — ACTIVITY / NOTES TIMELINE. A team member logs activities (note/call/email/meeting/task)
// against any entity and reads the timeline. Covers log, type validation, entity/ref scoping, timeline
// order, type filter, author/admin delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 244");
const slug = "b244";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const log = (tok, body) => c.post(`/api/db/${slug}/activity`, body, tok === null ? {} : { token: tok });
const timeline = (tok, entity, ref, q) => c.get(`/api/db/${slug}/activity?entity=${entity}&ref=${ref}${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/activity/${id}`, { token: tok });

// --- Log activities against a contact ---
const n1 = (await log(B, { entity: "contact", ref: "42", type: "call", body: "Left a voicemail" })).json.id;
await log(B, { entity: "contact", ref: "42", type: "note", body: "Interested in the pro plan" });
await log(C, { entity: "contact", ref: "42", type: "email", body: "Sent the quote" });
t.ok(n1, "a team member logs an activity");

// --- Timeline (newest first) ---
let tl = await timeline(A, "contact", "42");
t.eq(tl.activity.length, 3, "3 activities on the contact");
t.eq(tl.activity[0].type, "email", "…newest first (the email)");
t.eq(tl.activity[0].author_id, 3, "…with the author");

// --- Entity/ref scoping ---
await log(B, { entity: "deal", ref: "7", type: "meeting", body: "Kickoff" });
t.eq((await timeline(A, "contact", "42")).activity.length, 3, "activities are scoped to (entity, ref)");
t.eq((await timeline(A, "deal", "7")).activity.length, 1, "…the deal has its own timeline");

// --- Type filter ---
t.eq((await timeline(A, "contact", "42", "&type=call")).activity.length, 1, "filter by type=call → 1");
t.eq((await timeline(A, "contact", "42", "&type=note")).activity.length, 1, "…type=note → 1");

// --- Delete: author can, others can't, admin can ---
t.eq((await del(C, n1)).status, 403, "a non-author non-admin can't delete → 403");
t.eq((await del(B, n1)).json.deleted, true, "the author deletes their own entry");
t.eq((await timeline(A, "contact", "42")).activity.length, 2, "…timeline down to 2");
const e2 = (await timeline(A, "contact", "42")).activity[0].id;
t.eq((await del(A, e2)).json.deleted, true, "an admin can delete anyone's entry");

// --- Validation + authz ---
t.eq((await log(B, { ref: "1", body: "x" })).status, 400, "missing entity → 400");
t.eq((await log(B, { entity: "contact", type: "note" })).status, 400, "missing ref → 400");
t.eq((await log(B, { entity: "contact", ref: "9", type: "note" })).status, 400, "a note with no body → 400");
t.eq((await log(B, { entity: "contact", ref: "9", type: "call" })).json.type, "call", "a call with no body is allowed");
t.eq((await c.get(`/api/db/${slug}/activity?entity=contact&ref=42`)).status, 401, "signed-out read → 401");
t.eq((await log(null, { entity: "x", ref: "1", body: "y" })).status, 401, "signed-out log → 401");
t.eq((await del(B, 999999)).status, 404, "deleting a missing entry → 404");

t.done(); h.restore();

// Batch 315 — CONTENT REVIEW WORKFLOW. A content item moves draft → in_review → approved | rejected, and
// approved → published, each an atomic state-guarded transition. Covers create, submit, approve, publish,
// reject→resubmit path, queue, mine, get-one authz, invalid transitions, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 315");
const slug = "b315";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // author
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // other member
const create = (tok, body) => c.post(`/api/db/${slug}/content-review`, body, tok === null ? {} : { token: tok });
const act = (tok, ref, a, body) => c.post(`/api/db/${slug}/content-review/${ref}/${a}`, body || {}, { token: tok });
const get = (tok, ref) => c.get(`/api/db/${slug}/content-review/${ref}`, { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/content-review/mine`, { token: tok }).then((r) => r.json);
const queue = (tok, q) => c.get(`/api/db/${slug}/content-review${q || ""}`, { token: tok }).then((r) => r.json);

// --- Create draft ---
t.eq((await create(B, { ref: "post-1", title: "My Post" })).json.status, "draft", "author creates a draft");
t.eq((await get(B, "post-1")).json.item.status, "draft", "…status draft");

// --- Submit → in_review (author) ---
t.eq((await act(B, "post-1", "submit")).json.status, "in_review", "author submits for review");
t.eq((await act(A, "post-1", "submit")).status, 409, "…submitting again → 409");

// --- Approve → publish (admin) ---
t.eq((await act(A, "post-1", "approve")).json.status, "approved", "admin approves");
t.eq((await act(A, "post-1", "publish")).json.status, "published", "admin publishes");
t.eq((await act(A, "post-1", "publish")).status, 409, "…publishing again → 409");

// --- Reject path ---
await create(B, { ref: "post-2" });
await act(B, "post-2", "submit");
t.eq((await act(A, "post-2", "reject", { note: "needs work" })).json.status, "rejected", "admin rejects with a note");
t.eq((await get(A, "post-2")).json.item.note, "needs work", "…the note is stored");
// rejected can be re-submitted? no — reject goes to 'rejected', not 'draft'; approve from rejected fails
t.eq((await act(A, "post-2", "approve")).status, 409, "can't approve a rejected item");

// --- Queue + mine ---
t.ok((await queue(A, "?status=published")).items.length >= 1, "admin queue filters by status");
t.eq((await mine(B)).items.length, 2, "author lists their items");

// --- Authz ---
t.eq((await act(C, "post-1", "submit")).status, 403, "a non-author can't submit → 403");
t.eq((await act(B, "post-2", "approve")).status, 403, "a member can't approve → 403");
t.eq((await get(C, "post-1")).status, 403, "another member can't read someone's item → 403");
t.eq((await c.get(`/api/db/${slug}/content-review`, { token: B })).status, 403, "a member can't read the queue → 403");

// --- Validation ---
t.eq((await create(B, {})).status, 400, "a missing ref → 400");
t.eq((await create(B, { ref: "post-1" })).status, 409, "a duplicate ref → 409");
t.eq((await create(B, { ref: "bad ref!" })).status, 400, "an invalid ref → 400");
t.eq((await act(A, "nope", "approve")).status, 404, "acting on a missing item → 404");
t.eq((await c.post(`/api/db/${slug}/content-review`, { ref: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

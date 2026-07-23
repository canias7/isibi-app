// Batch 209 — FEEDBACK BOARD. Members submit ideas, everyone upvotes, staff set a roadmap status. Covers
// submit (author auto-upvotes), upvote/unvote dedup, top vs new sort, status filter + moderation, mine flag,
// get one, author/admin delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 209");
const slug = "b209";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3 member
const submit = (tok, body) => c.post(`/api/db/${slug}/feedback`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/feedback${q || ""}`, tok ? { token: tok } : {}).then((r) => r.json);
const getF = (tok, id) => c.get(`/api/db/${slug}/feedback/${id}`, tok ? { token: tok } : {}).then((r) => r.json);
const vote = (tok, id) => c.post(`/api/db/${slug}/feedback/${id}/vote`, {}, { token: tok }).then((r) => r.json);
const unvote = (tok, id) => c.del(`/api/db/${slug}/feedback/${id}/vote`, { token: tok }).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/feedback/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/feedback/${id}`, { token: tok });

// --- Submit (author auto-upvotes) ---
const f1 = (await submit(B, { title: "Dark mode", body: "please" })).json.id;
const f2 = (await submit(C, { title: "Export CSV" })).json.id;
t.eq((await getF(null, f1)).feedback.votes, 1, "a new post starts with the author's own upvote");

// --- Upvote + dedup ---
await vote(C, f1); await vote(A, f1);
t.eq((await getF(null, f1)).feedback.votes, 3, "three distinct upvotes");
t.eq((await vote(C, f1)).votes, 3, "re-voting is idempotent (still 3)");

// --- mine flag ---
t.eq((await getF(C, f1)).feedback.mine, true, "C sees mine:true");
t.eq((await getF(null, f1)).feedback.mine, false, "signed-out sees mine:false");

// --- Sort: top vs new ---
let top = (await list(null, "?sort=top")).feedback;
t.eq(top[0].id, f1, "top sort puts the most-voted first (Dark mode, 3)");
let fresh = (await list(null, "?sort=new")).feedback;
t.eq(fresh[0].id, f2, "new sort puts the most-recent first (Export CSV)");

// --- Unvote ---
t.eq((await unvote(A, f1)).votes, 2, "unvote drops the count to 2");
t.eq((await getF(A, f1)).feedback.mine, false, "…and A's mine is false");

// --- Moderation / roadmap status (admin) ---
t.eq((await patch(A, f1, { status: "planned" })).json.id, f1, "admin sets a roadmap status");
t.eq((await list(null, "?status=planned")).feedback.length, 1, "status filter returns the planned one");
t.eq((await patch(A, f1, { status: "bogus" })).status, 400, "a bad status → 400");

// --- Delete (author or admin) ---
t.eq((await del(C, f1)).status, 403, "a non-author member can't delete → 403");
t.eq((await del(B, f1)).json.deleted, true, "the author can delete their post");
t.eq((await getF(null, f1)).ok ?? false, false, "…it's gone");
t.eq((await del(A, f2)).json.deleted, true, "an admin can delete anyone's post");

// --- Validation + authz ---
const f3 = (await submit(B, { title: "Keep me" })).json.id;
t.eq((await submit(B, {})).status, 400, "missing title → 400");
t.eq((await submit(null, { title: "x" })).status, 401, "signed-out submit → 401");
t.eq((await c.post(`/api/db/${slug}/feedback/${f3}/vote`, {})).status, 401, "signed-out vote → 401");
t.eq((await patch(B, f3, { status: "done" })).status, 403, "a member can't moderate → 403");
t.eq((await c.get(`/api/db/${slug}/feedback/999999`)).status, 404, "a missing post → 404");

t.done(); h.restore();

// Batch 252 — PUBLISH SCHEDULING QUEUE. An admin schedules a content item (by ref) to go live at a time; a
// due-list surfaces items past their publish_at. Covers schedule, due (white-box past/future), publish (marks
// + idempotent), list + status filter, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 252");
const slug = "b252";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const schedule = (tok, body) => c.post(`/api/db/${slug}/publish-queue`, body, tok === null ? {} : { token: tok });
const due = (tok) => c.get(`/api/db/${slug}/publish-queue/due`, { token: tok }).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/publish-queue${q || ""}`, { token: tok }).then((r) => r.json);
const publish = (tok, id) => c.post(`/api/db/${slug}/publish-queue/${id}/publish`, {}, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/publish-queue/${id}`, { token: tok });
const future = new Date(Date.now() + 3600 * 1000).toISOString();
const past = new Date(Date.now() - 3600 * 1000).toISOString();

// --- Schedule ---
const p1 = (await schedule(A, { ref: "post-1", publish_at: future, kind: "blog" })).json.id;
const p2 = (await schedule(A, { ref: "post-2", publish_at: past })).json.id;
t.ok(p1 && p2, "admin schedules items");

// --- Due: only the past-dated one ---
let d = (await due(A)).due;
t.eq(d.length, 1, "one item is due (the past-dated one)");
t.eq(d[0].ref, "post-2", "…and it's post-2");

// --- Publish marks it + drops it off the due-list ---
t.eq((await publish(A, p2)).json.status, "published", "admin publishes the due item");
t.eq((await due(A)).due.length, 0, "…now nothing is due");
t.eq((await publish(A, p2)).json.already, true, "re-publishing → already");

// --- List + status filter ---
t.eq((await list(A)).items.length, 2, "list has both items");
t.eq((await list(A, "?status=scheduled")).items.length, 1, "scheduled filter → 1 (post-1)");
t.eq((await list(A, "?status=published")).items.length, 1, "published filter → 1 (post-2)");

// --- Delete ---
t.eq((await del(A, p1)).json.deleted, true, "admin deletes a scheduled item");
t.eq((await list(A)).items.length, 1, "…now 1");

// --- Validation + authz ---
t.eq((await schedule(A, { publish_at: future })).status, 400, "missing ref → 400");
t.eq((await schedule(A, { ref: "x", publish_at: "not-a-date" })).status, 400, "a bad publish_at → 400");
t.eq((await schedule(B, { ref: "x", publish_at: future })).status, 403, "a member can't schedule → 403");
t.eq((await due(B)).status ?? 403, 403, "a member can't read /due → 403");
t.eq((await c.get(`/api/db/${slug}/publish-queue/due`, { token: B })).status, 403, "…confirmed 403");
t.eq((await publish(A, 999999)).status, 404, "publishing a missing item → 404");
t.eq((await schedule(null, { ref: "x", publish_at: future })).status, 401, "signed-out schedule → 401");

t.done(); h.restore();

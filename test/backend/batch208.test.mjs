// Batch 208 — STATUS-PAGE INCIDENTS. Staff post service incidents with a timeline of updates; the public
// reads them + can subscribe an email. Covers create+seed update, public list (+active filter), get+timeline,
// posting updates (status transition stamps resolved_at), edit, delete, subscribe/unsubscribe, subscribers
// list (admin), validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 208");
const slug = "b208";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const open = (tok, body) => c.post(`/api/db/${slug}/incidents`, body, tok === null ? {} : { token: tok });
const list = (q) => c.get(`/api/db/${slug}/incidents${q || ""}`).then((r) => r.json);
const getI = (id) => c.get(`/api/db/${slug}/incidents/${id}`).then((r) => r.json);
const update = (tok, id, body) => c.post(`/api/db/${slug}/incidents/${id}/updates`, body, { token: tok });
const edit = (tok, id, body) => c.patch(`/api/db/${slug}/incidents/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/incidents/${id}`, { token: tok });
const subscribe = (body) => c.post(`/api/db/${slug}/incidents/subscribe`, body);
const unsubscribe = (email) => c.del(`/api/db/${slug}/incidents/subscribe?email=${encodeURIComponent(email)}`);
const subscribers = (tok) => c.get(`/api/db/${slug}/incidents/subscribers`, { token: tok });

// --- Create (admin) with a seed update ---
const i1 = (await open(A, { title: "API down", body: "Investigating elevated errors", impact: "major" })).json;
t.eq(i1.status, "investigating", "new incident defaults to investigating");
t.eq(i1.impact, "major", "…with the given impact");
const id1 = i1.id;

// --- Get + timeline ---
let g = await getI(id1);
t.eq(g.updates.length, 1, "the seed body became the first update");
t.eq(g.incident.title, "API down", "…and the header");

// --- Post updates (status transitions) ---
await update(A, id1, { status: "identified", body: "Root cause found" });
await update(A, id1, { status: "monitoring", body: "Fix deployed, watching" });
t.eq((await getI(id1)).incident.status, "monitoring", "status advances with updates");
t.eq((await getI(id1)).incident.resolved_at, null, "…not resolved yet");
await update(A, id1, { status: "resolved", body: "All clear" });
g = await getI(id1);
t.eq(g.incident.status, "resolved", "resolving sets status");
t.ok(g.incident.resolved_at, "…and stamps resolved_at");
t.eq(g.updates.length, 4, "timeline has all 4 updates");

// --- List + active filter ---
await open(A, { title: "Slow search", impact: "minor" });
t.eq((await list()).incidents.length, 2, "list has both incidents");
t.eq((await list("?active=1")).incidents.length, 1, "active=1 hides the resolved one");

// --- Edit ---
t.eq((await edit(A, id1, { title: "API outage", impact: "critical" })).json.id, id1, "admin edits title/impact");
t.eq((await getI(id1)).incident.impact, "critical", "…impact updated");

// --- Subscribe / unsubscribe (public) ---
t.eq((await subscribe({ email: "fan@x.dev" })).json.subscribed, true, "public subscribes an email");
await subscribe({ email: "fan@x.dev" }); // idempotent
t.eq((await subscribers(A)).json.subscribers.length, 1, "…once (dedup); admin sees the list");
t.eq((await unsubscribe("fan@x.dev")).json.unsubscribed, true, "unsubscribe works");
t.eq((await subscribers(A)).json.subscribers.length, 0, "…list now empty");

// --- Validation + authz ---
t.eq((await open(A, { impact: "major" })).status, 400, "missing title → 400");
t.eq((await open(B, { title: "x" })).status, 403, "a member can't open an incident → 403");
t.eq((await update(B, id1, { body: "x" })).status, 403, "a member can't post updates → 403");
t.eq((await update(A, id1, { body: "x", status: "bogus" })).status, 400, "a bad update status → 400");
t.eq((await edit(B, id1, { title: "x" })).status, 403, "a member can't edit → 403");
t.eq((await del(B, id1)).status, 403, "a member can't delete → 403");
t.eq((await subscribe({ email: "notanemail" })).status, 400, "a bad email → 400");
t.eq((await subscribers(B)).status, 403, "a member can't read subscribers → 403");
t.eq((await getI(999999)).ok ?? false, false, "a missing incident → not ok");
t.eq((await del(A, id1)).json.deleted, true, "admin deletes an incident");

t.done(); h.restore();

// Batch 249 — RECURRING-ORDER SUBSCRIPTIONS. A member subscribes to a cadence; next_run advances by
// interval_days; the admin processes due ones. Covers subscribe + next_run, mine, due (white-box past date),
// advance (bumps next_run + counts a run), cancel (owner/admin), list + filters, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 249");
const slug = "b249";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const sub = (tok, body) => c.post(`/api/db/${slug}/subscriptions`, body, tok === null ? {} : { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/subscriptions/mine`, { token: tok }).then((r) => r.json);
const due = (tok) => c.get(`/api/db/${slug}/subscriptions/due`, { token: tok }).then((r) => r.json);
const advance = (tok, id) => c.post(`/api/db/${slug}/subscriptions/${id}/advance`, {}, { token: tok });
const cancel = (tok, id) => c.post(`/api/db/${slug}/subscriptions/${id}/cancel`, {}, { token: tok });
const listAll = (tok, q) => c.get(`/api/db/${slug}/subscriptions${q || ""}`, { token: tok }).then((r) => r.json);

// --- Subscribe ---
const future = new Date(Date.now() + 7 * 86400000).toISOString();
const s1 = (await sub(B, { plan: "coffee-monthly", interval_days: 30, start: future, ref: "sku-9" })).json;
t.eq(s1.status, "active", "subscription is active");
t.eq(s1.next_run, future, "…next_run is the start");
const id1 = s1.id;
await sub(C, { plan: "tea-weekly", interval_days: 7 });

// --- Mine ---
t.eq((await mine(B)).subscriptions.length, 1, "B sees their subscription");
t.eq((await mine(B)).subscriptions[0].plan, "coffee-monthly", "…the plan");

// --- Due: none yet (both start in the future / now but let's push one to the past) ---
h.getDb(uuid).prepare("UPDATE _subscriptions SET next_run=? WHERE id=?").run(new Date(Date.now() - 86400000).toISOString(), id1);
let d = (await due(A)).due;
t.ok(d.some((x) => x.id === id1), "the past-due subscription shows in /due");

// --- Advance bumps next_run + counts a run ---
let r = (await advance(A, id1)).json;
t.ok(Date.parse(r.next_run) > Date.now(), "advance moves next_run into the future");
t.eq((await mine(B)).subscriptions[0].runs, 1, "…and counts a run");
t.ok(!(await due(A)).due.some((x) => x.id === id1), "…it's no longer due");

// --- Cancel (owner) ---
t.eq((await cancel(B, id1)).json.status, "cancelled", "the owner cancels");
t.eq((await mine(B)).subscriptions[0].status, "cancelled", "…reflected");
t.eq((await advance(A, id1)).status, 409, "can't advance a cancelled subscription → 409");

// --- Admin list + filters ---
t.eq((await listAll(A)).subscriptions.length, 2, "admin lists all subscriptions");
t.eq((await listAll(A, "?status=active")).subscriptions.length, 1, "…active filter → 1");
t.eq((await listAll(A, `?user=${bId}`)).subscriptions.length, 1, "…user filter → 1");

// --- Validation + authz ---
t.eq((await sub(B, { interval_days: 30 })).status, 400, "missing plan → 400");
t.eq((await sub(B, { plan: "x", interval_days: 0 })).status, 400, "interval_days 0 → 400");
t.eq((await due(B)).status ?? 403, 403, "a member can't read /due → 403");
t.eq((await c.get(`/api/db/${slug}/subscriptions/due`, { token: B })).status, 403, "…confirmed 403");
t.eq((await advance(B, id1)).status, 403, "a member can't advance → 403");
t.eq((await listAll(B)).status ?? 403, 403, "a member can't list all → 403");
t.eq((await c.post(`/api/db/${slug}/subscriptions`, { plan: "x", interval_days: 7 })).status, 401, "signed-out subscribe → 401");

t.done(); h.restore();

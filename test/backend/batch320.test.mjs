// Batch 320 — DOUBLE OPT-IN. An email subscribes (pending + token) then confirms via the token. Covers
// subscribe, confirm, idempotent re-subscribe/confirm, lists, admin view + delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 320");
const slug = "b320";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const sub = (body) => c.post(`/api/db/${slug}/opt-in`, body).then((r) => r.json);
const confirm = (token) => c.post(`/api/db/${slug}/opt-in/confirm`, { token });
const listSubs = (tok, q) => c.get(`/api/db/${slug}/opt-in${q || ""}`, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/opt-in/${id}`, { token: tok });

// --- Subscribe → pending + token ---
let r = await sub({ email: "Fan@Example.com" });
t.eq(r.status, "pending", "subscribing creates a pending record");
t.ok(r.token && r.token.length > 20, "…with a token to email");
const token = r.token;

// --- Confirm ---
let c1 = await confirm(token);
t.eq(c1.json.status, "confirmed", "the token confirms the subscription");
t.eq(c1.json.email, "fan@example.com", "…email normalized to lowercase");

// --- Idempotent re-confirm ---
t.eq((await confirm(token)).json.already, true, "re-confirming is idempotent");

// --- Re-subscribing a confirmed email says already ---
t.eq((await sub({ email: "fan@example.com" })).already, true, "re-subscribing a confirmed email → already");

// --- Independent lists ---
r = await sub({ email: "fan@example.com", list: "promos" });
t.eq(r.status, "pending", "the same email on another list is a fresh pending record");

// --- Admin view ---
t.ok((await listSubs(A)).json.subscribers.length >= 2, "admin lists subscribers");
t.eq((await listSubs(A, "?status=confirmed")).json.subscribers.length, 1, "…filterable by status");
const id = (await listSubs(A, "?list=promos")).json.subscribers[0].id;

// --- Admin delete ---
t.eq((await del(A, id)).json.deleted, true, "admin removes a subscriber");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/opt-in`, { email: "not-an-email" })).status, 400, "a bad email → 400");
t.eq((await c.post(`/api/db/${slug}/opt-in/confirm`, { token: "nope" })).status, 404, "a bad token → 404");
t.eq((await listSubs(B)).status, 403, "a member can't list subscribers → 403");
t.eq((await del(B, id)).status, 403, "a member can't delete → 403");

t.done(); h.restore();

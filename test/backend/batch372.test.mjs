// Batch 372 — DEPOSIT HOLDS. A refundable deposit against a booking/ref, later captured (kept) or released
// (refunded). State machine held→captured|released, each transition atomic. Covers place, capture, release,
// double-transition guard, owner self-read, list+totals, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 372");
const slug = "b372";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev");
const place = (tok, body) => c.post(`/api/db/${slug}/deposit-holds`, body, { token: tok });

// --- Place a hold ---
let r = (await place(A, { amount: 50, ref: "booking-1", user: b2, reason: "damage deposit" })).json;
t.eq(r.hold.amount_cents, 5000, "$50 hold in cents");
t.eq(r.hold.status, "held", "…status held");
const id1 = r.hold.id;

// --- Capture ---
r = (await c.post(`/api/db/${slug}/deposit-holds/${id1}/capture`, {}, { token: A })).json;
t.eq(r.hold.status, "captured", "capturing keeps the deposit");

// --- Can't transition again ---
t.eq((await c.post(`/api/db/${slug}/deposit-holds/${id1}/release`, {}, { token: A })).status, 409, "releasing a captured hold → 409");

// --- Release path ---
let id2 = (await place(A, { amount: 20 })).json.hold.id;
t.eq((await c.post(`/api/db/${slug}/deposit-holds/${id2}/release`, {}, { token: A })).json.hold.status, "released", "releasing refunds the deposit");
t.eq((await c.post(`/api/db/${slug}/deposit-holds/${id2}/capture`, {}, { token: A })).status, 409, "capturing a released hold → 409");

// --- Owner self-read; other members forbidden ---
t.eq((await c.get(`/api/db/${slug}/deposit-holds/${id1}`, { token: B })).json.hold.id, id1, "the owning member reads their own hold");
t.eq((await c.get(`/api/db/${slug}/deposit-holds/${id1}`, { token: C })).status, 403, "another member can't read it");

// --- List + totals (admin) ---
let list = (await c.get(`/api/db/${slug}/deposit-holds`, { token: A }).then((x) => x.json));
t.ok(list.holds.length >= 2, "admin lists holds");
t.ok(Array.isArray(list.totals), "…with per-status totals");
t.eq((await c.get(`/api/db/${slug}/deposit-holds?status=captured`, { token: A }).then((x) => x.json)).holds.length, 1, "filter by status");

// --- Validation + authz ---
t.eq((await place(A, { amount: 0 })).status, 400, "a non-positive amount → 400");
t.eq((await place(A, { amount: 10, user: 999999 })).status, 404, "an unknown user → 404");
t.eq((await c.post(`/api/db/${slug}/deposit-holds/99999/capture`, {}, { token: A })).status, 404, "capturing a missing hold → 404");
t.eq((await place(B, { amount: 10 })).status, 403, "a member can't place a hold → 403");
t.eq((await c.post(`/api/db/${slug}/deposit-holds`, { amount: 10 })).status, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/deposit-holds`, { token: B })).status, 403, "a member can't list → 403");

t.done(); h.restore();

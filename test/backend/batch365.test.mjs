// Batch 365 — PER-CUSTOMER CREDIT LIMIT. Admin sets a member's credit line; charges draw it down (guarded so the
// balance never exceeds the limit), payments pay it back. Balance in cents, one row per user. Covers set/adjust,
// charge guard, over-limit 409, pay (floored at 0), self-read, list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 365");
const slug = "b365";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev"), c3 = idOf("c@x.dev");
const setLim = (tok, body) => c.post(`/api/db/${slug}/credit-limit`, body, { token: tok });
const charge = (tok, u, amount) => c.post(`/api/db/${slug}/credit-limit/${u}/charge`, { amount }, { token: tok });
const pay = (tok, u, amount) => c.post(`/api/db/${slug}/credit-limit/${u}/pay`, { amount }, { token: tok });
const read = (tok, u) => c.get(`/api/db/${slug}/credit-limit/${u}`, { token: tok });

// --- Set a limit ---
let r = (await setLim(A, { user: b2, limit: 100 })).json;
t.eq(r.limit_cents, 10000, "$100 limit stored in cents");
t.eq(r.available_cents, 10000, "…fully available");

// --- Charge draws it down ---
r = (await charge(A, b2, 30)).json;
t.eq(r.balance_cents, 3000, "a $30 charge → $30 balance");
t.eq(r.available_cents, 7000, "…$70 available");

// --- Charging past the limit is refused ---
let over = await charge(A, b2, 80);
t.eq(over.status, 409, "a charge over the limit → 409");
t.eq(over.json.balance_cents, 3000, "…and the balance is unchanged");

// --- A charge exactly to the limit is allowed ---
t.eq((await charge(A, b2, 70)).json.available_cents, 0, "charging up to the limit is fine");

// --- Payment pays it back ---
r = (await pay(A, b2, 50)).json;
t.eq(r.balance_cents, 5000, "a $50 payment reduces the balance");
// Overpayment floors at 0.
t.eq((await pay(A, b2, 999)).json.balance_cents, 0, "overpaying floors the balance at 0");

// --- Adjusting the limit keeps the balance ---
await charge(A, b2, 20);
r = (await setLim(A, { user: b2, limit: 200 })).json;
t.eq(r.limit_cents, 20000, "the limit is raised");
t.eq(r.balance_cents, 2000, "…balance preserved");

// --- Self-read allowed; other members forbidden ---
t.eq((await read(B, b2)).json.limit_cents, 20000, "a member reads their own line");
t.eq((await read(C, b2)).status, 403, "…but not someone else's");

// --- List (admin) ---
await setLim(A, { user: c3, limit: 40 });
t.ok((await c.get(`/api/db/${slug}/credit-limit`, { token: A }).then((x) => x.json)).accounts.length >= 2, "admin lists accounts");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/credit-limit/${c3}`, { token: A })).json.deleted, true, "admin removes an account");
t.eq((await read(A, c3)).status, 404, "…and it's gone");

// --- Validation + authz ---
t.eq((await charge(A, 999999, 10)).status, 404, "charging a user with no account → 404");
t.eq((await setLim(A, { user: b2, limit: -5 })).status, 400, "a negative limit → 400");
t.eq((await charge(A, b2, 0)).status, 400, "a non-positive charge → 400");
t.eq((await setLim(B, { user: b2, limit: 100 })).status, 403, "a member can't set a limit → 403");
t.eq((await c.post(`/api/db/${slug}/credit-limit`, { user: b2, limit: 100 })).status, 401, "signed-out → 401");
t.eq((await setLim(A, { user: 999999, limit: 100 })).status, 404, "an unknown user → 404");

t.done(); h.restore();

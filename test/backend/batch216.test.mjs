// Batch 216 — NEWSLETTER DOUBLE OPT-IN. A visitor subscribes (pending + a confirm token), confirms via the
// token, and can unsubscribe. Covers subscribe→token, confirm, re-subscribe idempotency, unsubscribe by
// email + token, admin list (confirmed) + stats, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 216");
const slug = "b216";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const sub = (body) => c.post(`/api/db/${slug}/newsletter/subscribe`, body).then((r) => r.json);
const confirm = (token) => c.post(`/api/db/${slug}/newsletter/confirm`, { token });
const unsub = (body) => c.post(`/api/db/${slug}/newsletter/unsubscribe`, body).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/newsletter${q || ""}`, { token: tok }).then((r) => r.json);
const stats = (tok) => c.get(`/api/db/${slug}/newsletter/stats`, { token: tok }).then((r) => r.json);

// --- Subscribe → pending + token ---
let s = await sub({ email: "Reader@X.com", name: "Reader" });
t.eq(s.status, "pending", "subscribe creates a pending record");
t.ok(s.token && s.token.length >= 12, "…and returns a confirm token");
t.eq(s.email, "reader@x.com", "…email lowercased");

// --- Confirm ---
t.eq((await confirm(s.token)).json.status, "confirmed", "the token confirms the subscription");
t.eq((await confirm(s.token)).status, 404, "…the token is single-use (already confirmed)");

// --- Re-subscribing a confirmed email is a no-op ---
t.eq((await sub({ email: "reader@x.com" })).already, true, "re-subscribing a confirmed email → already");

// --- Stats + list ---
await sub({ email: "pending@x.com" }); // stays pending
let st = await stats(A);
t.eq(st.confirmed, 1, "1 confirmed");
t.eq(st.pending, 1, "1 pending");
t.eq((await list(A)).subscribers.length, 1, "default list shows only confirmed subscribers");
t.eq((await list(A, "?status=pending")).subscribers.length, 1, "…status=pending shows the pending one");

// --- Unsubscribe by email ---
t.eq((await unsub({ email: "reader@x.com" })).unsubscribed, true, "unsubscribe by email works");
t.eq((await stats(A)).confirmed, 0, "…confirmed drops to 0");
t.eq((await stats(A)).unsubscribed, 1, "…unsubscribed is 1");

// --- Unsubscribe by token ---
let s2 = await sub({ email: "tok@x.com" });
t.eq((await unsub({ token: s2.token })).unsubscribed, true, "unsubscribe by token works");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/newsletter/subscribe`, { email: "bad" })).status, 400, "a bad email → 400");
t.eq((await confirm("nope-token")).status, 404, "an unknown token → 404");
t.eq((await c.post(`/api/db/${slug}/newsletter/unsubscribe`, {})).status, 400, "unsubscribe with nothing → 400");
t.eq((await c.get(`/api/db/${slug}/newsletter`, { token: B })).status, 403, "a member can't list subscribers → 403");
t.eq((await c.get(`/api/db/${slug}/newsletter/stats`, { token: B })).status, 403, "a member can't read stats → 403");
t.eq((await c.get(`/api/db/${slug}/newsletter`)).status, 401, "signed-out list → 401");

t.done(); h.restore();

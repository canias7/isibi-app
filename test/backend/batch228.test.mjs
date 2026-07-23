// Batch 228 — QUEUE / TICKET DISPENSER (deli counter). Take a monotonic ticket, an operator calls the next,
// anyone sees who's now serving. Covers take (monotonic + ahead count), status, call (advances now_serving,
// marks served), mine (position), reset, empty-call, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 228");
const slug = "b228";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const take = (tok, q) => c.post(`/api/db/${slug}/queue/${q}/take`, {}, { token: tok }).then((r) => r.json);
const statusQ = (q) => c.get(`/api/db/${slug}/queue/${q}`).then((r) => r.json);
const call = (tok, q) => c.post(`/api/db/${slug}/queue/${q}/call`, {}, { token: tok }).then((r) => r.json);
const mine = (tok, q) => c.get(`/api/db/${slug}/queue/${q}/mine`, { token: tok }).then((r) => r.json);
const reset = (tok, q) => c.del(`/api/db/${slug}/queue/${q}`, { token: tok });

// --- Take monotonic tickets ---
t.eq((await take(B, "deli")).number, 1, "first ticket is #1");
t.eq((await take(C, "deli")).number, 2, "second ticket is #2");
let bt = await take(B, "deli"); // B takes a 3rd
t.eq(bt.number, 3, "third ticket is #3");
t.eq(bt.ahead, 2, "…with 2 people ahead");

// --- Status ---
let s = await statusQ("deli");
t.eq(s.now_serving, 0, "nobody served yet");
t.eq(s.last_number, 3, "3 tickets issued");
t.eq(s.waiting, 3, "3 waiting");

// --- Call advances now_serving to the next waiting ---
t.eq((await call(A, "deli")).now_serving, 1, "calling serves #1");
t.eq((await statusQ("deli")).now_serving, 1, "…status reflects it");
t.eq((await statusQ("deli")).waiting, 2, "…2 still waiting");

// --- Mine: position for C (holds #2) ---
let m = await mine(C, "deli");
t.eq(m.ticket, 2, "C holds ticket #2");
t.eq(m.ahead, 0, "…0 ahead now that #1 is served (C is next)");

// --- Call again serves #2, then #3 ---
t.eq((await call(A, "deli")).now_serving, 2, "next call serves #2");
t.eq((await call(A, "deli")).now_serving, 3, "next serves #3");
t.eq((await mine(C, "deli")).ticket, null, "C's ticket is served → no active ticket");

// --- Call with nobody waiting ---
t.eq((await call(A, "deli")).done, true, "calling an empty queue → done:true");

// --- Reset ---
await take(B, "deli");
t.eq((await reset(A, "deli")).json.reset, true, "admin resets the queue");
t.eq((await statusQ("deli")).last_number, 0, "…numbering restarts from 0");
t.eq((await take(B, "deli")).number, 1, "…next ticket is #1 again");

// --- Authz ---
t.eq((await c.post(`/api/db/${slug}/queue/deli/take`, {})).status, 401, "signed-out take → 401");
t.eq((await c.post(`/api/db/${slug}/queue/deli/call`, {}, { token: B })).status, 403, "a member can't call → 403");
t.eq((await c.get(`/api/db/${slug}/queue/deli/mine`)).status, 401, "signed-out mine → 401");
t.eq((await reset(B, "deli")).status, 403, "a member can't reset → 403");

t.done(); h.restore();

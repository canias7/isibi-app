// Batch 379 — READ RECEIPTS. Track who has read a message/resource. Member marks read (idempotent); admin sees
// the reader list, a member sees count + whether they read it; admin clears. Covers all of that + authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 379");
const slug = "b379";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const mark = (tok, msg) => c.post(`/api/db/${slug}/read-receipts/${msg}`, {}, { token: tok });
const get = (tok, msg) => c.get(`/api/db/${slug}/read-receipts/${msg}`, { token: tok }).then((r) => r.json);

// --- Mark read (idempotent) ---
let r = (await mark(B, "msg-1")).json;
t.eq(r.count, 1, "first reader → count 1");
t.eq(r.mine, true, "…marked by me");
t.eq((await mark(B, "msg-1")).json.count, 1, "marking again is idempotent (still 1)");
await mark(C, "msg-1");
t.eq((await mark(A, "msg-1")).json.count, 3, "count climbs with distinct readers");

// --- Member view: count + mine, no reader list ---
let v = await get(B, "msg-1");
t.eq(v.count, 3, "member sees the count");
t.eq(v.mine, true, "…and that they've read it");
t.eq(v.readers, undefined, "…but not the reader list");

// --- A member who hasn't read it ---
let fresh = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token;
t.eq((await get(fresh, "msg-1")).mine, false, "a non-reader sees mine:false");

// --- Admin view: full reader list ---
v = await get(A, "msg-1");
t.ok(Array.isArray(v.readers), "admin sees the reader list");
t.eq(v.readers.length, 3, "…all three readers");

// --- Clear (admin) ---
t.eq((await c.del(`/api/db/${slug}/read-receipts/msg-1`, { token: A })).json.cleared, true, "admin clears receipts");
t.eq((await get(A, "msg-1")).count, 0, "…and the count resets");

// --- Isolation across messages ---
await mark(B, "msg-2");
t.eq((await get(A, "msg-2")).count, 1, "another message is independent");

// --- Authz ---
t.eq((await c.post(`/api/db/${slug}/read-receipts/msg-3`, {})).status, 401, "signed-out mark → 401");
t.eq((await c.get(`/api/db/${slug}/read-receipts/msg-2`)).status, 401, "signed-out read → 401");
t.eq((await c.del(`/api/db/${slug}/read-receipts/msg-2`, { token: B })).status, 403, "a member can't clear → 403");

t.done(); h.restore();

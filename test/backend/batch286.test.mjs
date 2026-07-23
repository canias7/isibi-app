// Batch 286 — RATE-LIMIT POLICIES. An admin declares named per-key limits; a member consume endpoint
// atomically counts a hit in the current window and reports allowed/remaining. Covers upsert, list, consume
// (decrementing remaining, then denied over the cap), update, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 286");
const slug = "b286";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const upsert = (tok, body) => c.post(`/api/db/${slug}/rate-policies`, body, tok === null ? {} : { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/rate-policies`, { token: tok });
const consume = (tok, key) => c.post(`/api/db/${slug}/rate-policies/${key}/consume`, {}, tok === null ? {} : { token: tok });
const del = (tok, key) => c.del(`/api/db/${slug}/rate-policies/${key}`, { token: tok });

// --- Upsert (window 3600 so the whole test runs in one window) ---
t.eq((await upsert(A, { key: "sms", max: 3, window_sec: 3600 })).json.max, 3, "admin declares a policy");
t.eq((await list(A)).json.policies.length, 1, "…listed");

// --- Consume decrements remaining ---
let r = (await consume(B, "sms")).json;
t.eq(r.allowed, true, "consume 1 allowed");
t.eq(r.remaining, 2, "…2 remaining");
t.eq((await consume(B, "sms")).json.remaining, 1, "consume 2 → 1 remaining");
r = (await consume(B, "sms")).json;
t.eq(r.allowed, true, "consume 3 still allowed (at the cap)");
t.eq(r.remaining, 0, "…0 remaining");
r = (await consume(B, "sms")).json;
t.eq(r.allowed, false, "consume 4 denied (over the cap)");
t.eq(r.remaining, 0, "…still 0");
t.ok(r.reset_at, "…a reset_at is returned");

// --- Update the policy (raise the cap) ---
await upsert(A, { key: "sms", max: 10, window_sec: 3600 });
t.eq((await list(A)).json.policies.find((p) => p.key === "sms").max, 10, "the policy updates in place");

// --- Delete ---
t.eq((await del(A, "sms")).json.deleted, true, "admin deletes a policy");
t.eq((await consume(B, "sms")).status, 404, "…consuming a deleted policy → 404");

// --- Validation + authz ---
t.eq((await upsert(A, { key: "x", max: 0, window_sec: 60 })).status, 400, "max < 1 → 400");
t.eq((await upsert(A, { key: "x", max: 5, window_sec: 999999 })).status, 400, "window too large → 400");
t.eq((await upsert(A, { key: "bad key!", max: 5, window_sec: 60 })).status, 400, "an invalid key → 400");
t.eq((await upsert(B, { key: "y", max: 5, window_sec: 60 })).status, 403, "a member can't declare policies → 403");
t.eq((await list(B)).status, 403, "a member can't list policies → 403");
t.eq((await consume(null, "sms")).status, 401, "signed-out consume → 401");

t.done(); h.restore();

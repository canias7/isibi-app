// Batch 326 — REPLAY-PROTECTION NONCES. Consume a single-use token exactly once; a repeat is a replay. Covers
// fresh consume, replay 409, check, purge of expired, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 326");
const slug = "b326";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const consume = (tok, body) => c.post(`/api/db/${slug}/nonce/consume`, body, tok === null ? {} : { token: tok });
const check = (tok, n) => c.get(`/api/db/${slug}/nonce/check?nonce=${n}`, { token: tok }).then((r) => r.json);
const purge = (tok) => c.post(`/api/db/${slug}/nonce/purge`, {}, { token: tok });

// --- Fresh consume ---
let r = await consume(B, { nonce: "abc-123" });
t.eq(r.json.fresh, true, "first consume is fresh");

// --- Replay → 409 ---
r = await consume(B, { nonce: "abc-123" });
t.eq(r.status, 409, "a second consume of the same nonce → 409");
t.ok(r.json.replay, "…flagged as a replay");

// --- Another user replaying the same nonce is still blocked (global) ---
t.eq((await consume(A, { nonce: "abc-123" })).status, 409, "the nonce is global, not per-user");

// --- Check without consuming ---
t.eq((await check(B, "abc-123")).used, true, "check reports a used nonce");
t.eq((await check(B, "never-seen")).used, false, "…and an unused one");

// --- A distinct nonce is fresh ---
t.eq((await consume(B, { nonce: "xyz-999" })).json.fresh, true, "a different nonce is fresh");

// --- Purge expired (admin) ---
h.getDb(uuid).prepare("UPDATE _nonces SET expires_at=? WHERE nonce=?").run(new Date(Date.now() - 1000).toISOString(), "abc-123");
t.ok((await purge(A)).json.purged >= 1, "admin purges expired nonces");
t.eq((await consume(B, { nonce: "abc-123" })).json.fresh, true, "…a purged nonce can be used again");

// --- Validation + authz ---
t.eq((await consume(B, {})).status, 400, "a missing nonce → 400");
t.eq((await purge(B)).status, 403, "a member can't purge → 403");
t.eq((await c.post(`/api/db/${slug}/nonce/consume`, { nonce: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

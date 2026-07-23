// Batch 188 — IDEMPOTENCY KEYS. First stamp of a key stores its result; a replay returns the STORED
// result without re-running (per-member namespace). Covers claim/replay, peek, delete, and privacy.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 188");
const slug = "b188";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const B = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const C = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const post = (tok, key, body) => c.post(`/api/db/${slug}/idempotency/${key}`, body || {}, tok === null ? {} : { token: tok });
const get = (tok, key) => c.get(`/api/db/${slug}/idempotency/${key}`, { token: tok }).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/idempotency/${key}`, { token: tok });

// --- First stamp stores; replay returns the ORIGINAL result ---
let first = (await post(B, "order-123", { response: { charged: true, amount: 50 } })).json;
t.eq([first.first, first.response.charged], [true, true], "first call → first:true, echoes the result");
let replay = (await post(B, "order-123", { response: { charged: false, amount: 999 } })).json;
t.eq([replay.first, replay.response.charged, replay.response.amount], [false, true, 50], "replay → first:false, returns the STORED result (new payload ignored)");

// --- Peek ---
t.eq((await get(B, "order-123")).response.amount, 50, "GET peeks the stored result");
t.eq((await get(B, "nope")).found, false, "GET an unknown key → found:false");

// --- Claim with no stored response ---
t.eq((await post(B, "k2")).json, { ok: true, first: true, key: "k2", response: null }, "claim with no response → first:true, response null");
t.eq((await post(B, "k2")).json.first, false, "…second call → first:false");

// --- Per-member namespace: C's key is independent of B's ---
t.eq((await post(C, "order-123", { response: { charged: "C" } })).json.first, true, "C's order-123 is a fresh key (separate namespace)");
t.eq((await get(B, "order-123")).response.charged, true, "…B's is untouched");

// --- Delete clears it → the key is fresh again ---
t.eq((await del(B, "order-123")).json.deleted, true, "B clears their key");
t.eq((await get(B, "order-123")).found, false, "…now gone");
t.eq((await post(B, "order-123", { response: { charged: "again" } })).json.first, true, "…and a fresh stamp is first again");
t.eq((await del(B, "never")).json.deleted, false, "deleting an unknown key → deleted:false");

// --- Guard ---
t.eq((await post(null, "x", { response: 1 })).status, 401, "signed-out → 401");

t.done(); h.restore();

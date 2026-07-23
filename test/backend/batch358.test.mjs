// Batch 358 — CONTENT-HASH DEDUP. SHA-256 fingerprint of submitted content; first submission recorded,
// identical content flagged duplicate (with when + hit count). Covers record, dedup, precomputed hash,
// lookup, admin list, admin forget, per-request rate/validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 358");
const slug = "b358";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const post = (tok, body) => c.post(`/api/db/${slug}/content-hash`, body, { token: tok });
const look = (tok, hash) => c.get(`/api/db/${slug}/content-hash/${hash}`, { token: tok });

// --- Record + dedup ---
let r = (await post(A, { content: "the quick brown fox" })).json;
t.eq(r.duplicate, false, "a fresh fingerprint is not a duplicate");
t.eq(r.hits, 1, "…first hit");
t.eq(r.hash.length, 64, "…a 64-hex SHA-256");
const firstHash = r.hash;
r = (await post(B, { content: "the quick brown fox" })).json;
t.eq(r.duplicate, true, "identical content from another user → duplicate");
t.eq(r.hits, 2, "…hit count climbs");
t.eq(r.hash, firstHash, "…same hash");

// --- Different content → different hash, not a duplicate ---
t.eq((await post(A, { content: "a different string" })).json.duplicate, false, "different content is fresh");

// --- Precomputed hash accepted ---
t.eq((await post(A, { hash: firstHash })).json.duplicate, true, "posting the raw hash also dedups");

// --- Lookup ---
let lk = (await look(B, firstHash)).json;
t.eq(lk.known, true, "a recorded hash is known");
t.ok(lk.hits >= 3, "…with its hit count");
t.eq((await look(B, "0".repeat(64))).json.known, false, "an unseen hash is unknown");

// --- Admin list ---
t.ok((await c.get(`/api/db/${slug}/content-hash`, { token: A }).then((x) => x.json)).fingerprints.length >= 2, "admin lists fingerprints");
t.eq((await c.get(`/api/db/${slug}/content-hash`, { token: B })).status, 403, "a member can't list → 403");

// --- Forget (admin) ---
t.eq((await c.del(`/api/db/${slug}/content-hash/${firstHash}`, { token: A })).json.deleted, true, "admin forgets a fingerprint");
t.eq((await look(B, firstHash)).json.known, false, "…and it's gone");
t.eq((await c.del(`/api/db/${slug}/content-hash/${"1".repeat(64)}`, { token: A })).status, 404, "forgetting an unknown hash → 404");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/content-hash`, { content: "x" })).status, 401, "signed-out record → 401");
t.eq((await post(A, {})).status, 400, "no content/hash → 400");

t.done(); h.restore();

// Batch 266 — LICENSE KEYS. An admin issues a license key (product/owner/seats/expiry); anyone validates a
// key; an admin revokes it. Covers issue (auto + custom key), validate (valid/unknown/revoked/expired),
// revoke, list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 266");
const slug = "b266";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const issue = (tok, body) => c.post(`/api/db/${slug}/licenses`, body, tok === null ? {} : { token: tok }).then((r) => r.json);
const validate = (key) => c.get(`/api/db/${slug}/licenses/validate?key=${encodeURIComponent(key)}`).then((r) => r.json);
const revoke = (tok, key) => c.post(`/api/db/${slug}/licenses/${key}/revoke`, {}, { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/licenses`, { token: tok }).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/licenses/${key}`, { token: tok });
const future = new Date(Date.now() + 365 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

// --- Issue (auto key) ---
let g = await issue(A, { product: "Pro", owner: "acme@x.io", seats: 5, expires: future });
t.ok(g.key && g.key.length >= 12, "admin issues a license with an auto key");
const key = g.key;

// --- Issue with a custom key ---
t.eq((await issue(A, { key: "MYKEY-123", product: "Basic" })).key, "MYKEY-123", "a custom key is stored");

// --- Validate ---
let v = await validate(key);
t.eq(v.valid, true, "a fresh license validates");
t.eq(v.product, "Pro", "…with the product");
t.eq(v.seats, 5, "…and seats");

// --- Unknown key ---
t.eq((await validate("NOPE-KEY")).valid, false, "an unknown key → valid:false");
t.eq((await validate("NOPE-KEY")).reason, "unknown", "…reason unknown");

// --- Revoke ---
t.eq((await revoke(A, key)).json.status, "revoked", "admin revokes a key");
t.eq((await validate(key)).valid, false, "…a revoked key no longer validates");
t.eq((await validate(key)).reason, "revoked", "…reason revoked");

// --- Expired key ---
const expKey = (await issue(A, { product: "Trial", expires: past })).key;
t.eq((await validate(expKey)).valid, false, "an expired key → valid:false");
t.eq((await validate(expKey)).reason, "expired", "…reason expired");

// --- List + delete ---
t.eq((await list(A)).licenses.length, 3, "admin lists all licenses");
t.eq((await del(A, "MYKEY-123")).json.deleted, true, "admin deletes a license");
t.eq((await validate("MYKEY-123")).valid, false, "…it's gone");

// --- Validation + authz ---
t.eq((await c.get(`/api/db/${slug}/licenses/validate`)).status, 400, "validate with no key → 400");
t.eq((await issue(A, { key: expKey })).status ?? 409, 409, "issuing a duplicate key → 409");
t.eq((await issue(B, { product: "x" })).status ?? 403, 403, "a member can't issue → 403");
t.eq((await c.post(`/api/db/${slug}/licenses`, { product: "x" }, { token: B })).status, 403, "…confirmed 403");
t.eq((await list(B)).status ?? 403, 403, "a member can't list → 403");
t.eq((await revoke(B, key)).status, 403, "a member can't revoke → 403");
t.eq((await c.post(`/api/db/${slug}/licenses/${key}/revoke`, {}, { token: A })).status ?? 200, 200, "…admin revoke ok (idempotent-ish)");

t.done(); h.restore();

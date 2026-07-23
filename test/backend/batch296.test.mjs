// Batch 296 — API-KEY SCOPES. Attach a list of permission strings to an API key. Additive to /apikeys.
// Covers default empty, set + read, normalization/validation of scope strings, missing key, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 296");
const slug = "b296";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
// Mint a key.
const keyId = (await c.post(`/api/db/${slug}/apikeys`, { label: "server key" }, { token: A })).json.id;
t.ok(keyId, "admin mints an API key");
const getScopes = (tok, id) => c.get(`/api/db/${slug}/apikeys/${id}/scopes`, { token: tok });
const setScopes = (tok, id, body) => c.post(`/api/db/${slug}/apikeys/${id}/scopes`, body, { token: tok });

// --- Default empty ---
t.eq((await getScopes(A, keyId)).json.scopes.length, 0, "a new key has no scopes");

// --- Set + read ---
let r = (await setScopes(A, keyId, { scopes: ["read", "write:orders", "admin.*"] })).json;
t.eq(r.scopes.length, 3, "admin sets three scopes");
t.ok(r.scopes.includes("write:orders"), "…colon scope kept");
t.ok(r.scopes.includes("admin.*"), "…wildcard scope kept");
t.eq((await getScopes(A, keyId)).json.scopes.length, 3, "…and they read back");

// --- Normalization: dedupe + drop invalid ---
r = (await setScopes(A, keyId, { scopes: ["Read", "read", "bad scope!", "ok"] })).json;
t.ok(r.scopes.includes("read") && r.scopes.includes("ok"), "valid scopes kept + lowercased");
t.ok(!r.scopes.includes("bad scope!"), "…an invalid scope is dropped");
t.eq(r.scopes.filter((s) => s === "read").length, 1, "…duplicates collapse");

// --- Replace (set overwrites) ---
r = (await setScopes(A, keyId, { scopes: ["only"] })).json;
t.eq(r.scopes.join(","), "only", "setting replaces the whole list");

// --- Validation + authz ---
t.eq((await setScopes(A, keyId, {})).status, 400, "no scopes[] → 400");
t.eq((await getScopes(A, 999999)).status, 404, "a missing key → 404");
t.eq((await setScopes(B, keyId, { scopes: ["x"] })).status, 403, "a member can't set scopes → 403");
t.eq((await c.get(`/api/db/${slug}/apikeys/${keyId}/scopes`)).status, 401, "signed-out → 401");

t.done(); h.restore();

// Batch 271 — VAULT. An admin-only key-value store for app config/secrets. Covers set (string + JSON),
// get (round-trip), list (values redacted), update, delete, validation, authz (members fully blocked).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 271");
const slug = "b271";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const set = (tok, key, body) => c.post(`/api/db/${slug}/vault/${key}`, body, tok === null ? {} : { token: tok });
const get = (tok, key) => c.get(`/api/db/${slug}/vault/${key}`, { token: tok }).then((r) => r.json);
const list = (tok) => c.get(`/api/db/${slug}/vault`, { token: tok }).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/vault/${key}`, { token: tok });

// --- Set + get (string) ---
t.eq((await set(A, "stripe_key", { value: "sk_test_123", note: "test key" })).json.key, "stripe_key", "admin stores a secret");
let g = await get(A, "stripe_key");
t.eq(g.value, "sk_test_123", "…and reads it back");
t.eq(g.note, "test key", "…with the note");

// --- JSON value round-trip ---
await set(A, "config", { value: { theme: "dark", max: 5 } });
t.eq((await get(A, "config")).value.theme, "dark", "a JSON value round-trips");

// --- List redacts values ---
let l = (await list(A)).keys;
t.eq(l.length, 2, "list has 2 keys");
t.ok(l.every((k) => k.value === undefined), "…values are redacted from the list");
t.ok(l.find((k) => k.key === "stripe_key").size > 0, "…but the size is shown");

// --- Update ---
await set(A, "stripe_key", { value: "sk_live_999" });
t.eq((await get(A, "stripe_key")).value, "sk_live_999", "re-setting updates the value");

// --- Delete ---
t.eq((await del(A, "config")).json.deleted, true, "admin deletes a key");
t.eq((await c.get(`/api/db/${slug}/vault/config`, { token: A })).status, 404, "…gone");

// --- Validation + authz (members fully blocked) ---
t.eq((await set(A, "x", {})).status, 400, "missing value → 400");
t.eq((await c.get(`/api/db/${slug}/vault/nope`, { token: A })).status, 404, "unknown key → 404");
t.eq((await del(A, "nope")).status, 404, "deleting a missing key → 404");
t.eq((await set(B, "hax", { value: "x" })).status, 403, "a member can't set → 403");
t.eq((await c.get(`/api/db/${slug}/vault/stripe_key`, { token: B })).status, 403, "a member can't read → 403");
t.eq((await list(B)).status ?? 403, 403, "a member can't list → 403");
t.eq((await c.get(`/api/db/${slug}/vault`, { token: B })).status, 403, "…confirmed 403");
t.eq((await del(B, "stripe_key")).status, 403, "a member can't delete → 403");
t.eq((await list(null)).status ?? 401, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/vault`)).status, 401, "…confirmed 401");

t.done(); h.restore();

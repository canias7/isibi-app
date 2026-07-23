// Batch 334 — ENVIRONMENT CONFIG. Key/value settings scoped to a named environment, with a promote action.
// Covers set, get one/all, env isolation, promote (all + subset), overwrite on promote, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 334");
const slug = "b334";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const set = (tok, env, body) => c.post(`/api/db/${slug}/env-config/${env}`, body, tok === null ? {} : { token: tok });
const getAll = (tok, env) => c.get(`/api/db/${slug}/env-config/${env}`, { token: tok }).then((r) => r.json);
const getOne = (tok, env, key) => c.get(`/api/db/${slug}/env-config/${env}/${key}`, { token: tok });
const promote = (tok, body) => c.post(`/api/db/${slug}/env-config/promote`, body, { token: tok }).then((r) => r.json);
const del = (tok, env, key) => c.del(`/api/db/${slug}/env-config/${env}/${key}`, { token: tok });

// --- Set + get ---
await set(A, "staging", { key: "api_url", value: "https://staging.api" });
await set(A, "staging", { key: "debug", value: "true" });
t.eq((await getAll(A, "staging")).config.api_url, "https://staging.api", "reads a value back");
t.eq((await getOne(A, "staging", "debug")).json.value, "true", "reads one key");

// --- Env isolation ---
await set(A, "prod", { key: "api_url", value: "https://prod.api" });
t.eq((await getAll(A, "prod")).config.api_url, "https://prod.api", "prod is separate from staging");
t.eq(Object.keys((await getAll(A, "prod")).config).length, 1, "…prod has only its own keys");

// --- Promote all staging → prod (overwrites api_url, adds debug) ---
let p = await promote(A, { from: "staging", to: "prod" });
t.eq(p.promoted, 2, "promote copies all keys");
t.eq((await getAll(A, "prod")).config.api_url, "https://staging.api", "…overwriting the target value");
t.eq((await getAll(A, "prod")).config.debug, "true", "…and adding new keys");

// --- Promote a subset ---
await set(A, "dev", { key: "only_this", value: "1" });
await set(A, "dev", { key: "not_this", value: "2" });
p = await promote(A, { from: "dev", to: "qa", keys: ["only_this"] });
t.eq(p.promoted, 1, "a subset promote copies only the named keys");
t.eq((await getAll(A, "qa")).config.not_this, undefined, "…the excluded key is absent");

// --- Delete ---
t.eq((await del(A, "staging", "debug")).json.deleted, true, "admin deletes a key");
t.eq((await getAll(A, "staging")).config.debug, undefined, "…it's gone");

// --- Validation + authz ---
t.eq((await set(A, "staging", {})).status, 400, "a missing key → 400");
t.eq((await promote(A, { from: "x", to: "x" })).error ? 400 : 200, 400, "promote to the same env → 400");
t.eq((await c.post(`/api/db/${slug}/env-config/promote`, { from: "x", to: "x" }, { token: A })).status, 400, "…confirmed 400");
t.eq((await getOne(A, "staging", "nope")).status, 404, "a missing key → 404");
t.eq((await set(B, "staging", { key: "x", value: "1" })).status, 403, "a member can't set → 403");
t.eq((await c.get(`/api/db/${slug}/env-config/staging`)).status, 401, "signed-out → 401");

t.done(); h.restore();

// Batch 23 — app settings / config KV (public read, admin write, JSON values)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 23");

const slug = "b23";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // first user -> admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // role 'user'

// empty
t.eq((await c.get(`/api/db/${slug}/config`)).json.config, {}, "empty config -> {}");

// admin sets a string
t.ok((await c.post(`/api/db/${slug}/config/theme`, { value: "dark" }, { token: A })).json.ok, "admin set theme ok");
t.ok((await c.get(`/api/db/${slug}/config/theme`)).json.value === "dark", "GET config/theme -> dark");

// JSON values round-trip (object, boolean, number)
await c.post(`/api/db/${slug}/config/features`, { value: { signups: true, maxItems: 10 } }, { token: A });
await c.post(`/api/db/${slug}/config/enabled`, { value: true }, { token: A });
await c.post(`/api/db/${slug}/config/limit`, { value: 42 }, { token: A });
const all = (await c.get(`/api/db/${slug}/config`)).json.config;
t.eq(all.features, { signups: true, maxItems: 10 }, "object value round-trips");
t.ok(all.enabled === true, "boolean value round-trips (=== true, not 'true')");
t.ok(all.limit === 42, "number value round-trips (=== 42)");
t.ok(all.theme === "dark", "all keys present in GET /config");

// public read works with NO auth
t.ok((await c.get(`/api/db/${slug}/config/theme`)).json.value === "dark", "anon can read config (public)");

// non-admin write -> 403; anon write -> 401
t.ok((await c.post(`/api/db/${slug}/config/theme`, { value: "light" }, { token: B })).status === 403, "non-admin write -> 403");
t.ok((await c.post(`/api/db/${slug}/config/theme`, { value: "light" })).status === 401, "anon write -> 401");
// unchanged after rejected writes
t.ok((await c.get(`/api/db/${slug}/config/theme`)).json.value === "dark", "value unchanged after rejected writes");

// update existing key
await c.post(`/api/db/${slug}/config/theme`, { value: "midnight" }, { token: A });
t.ok((await c.get(`/api/db/${slug}/config/theme`)).json.value === "midnight", "admin can update a key");

// delete
t.ok((await c.del(`/api/db/${slug}/config/theme`, { token: A })).json.deleted, "admin delete key");
t.ok((await c.get(`/api/db/${slug}/config/theme`)).json.value === null, "deleted key -> null");
t.ok((await c.del(`/api/db/${slug}/config/theme`, { token: B })).status === 403, "non-admin delete -> 403");

t.done();
h.restore();

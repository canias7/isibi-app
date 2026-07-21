import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 58");
const slug = "b58";
await c.ensure(slug);
// device 1 signs up, device 2 logs in the same account -> two tokens
const t1 = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const t2 = (await c.login(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
// both valid at /me
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token: t1 })).json.ok, "token1 valid at /me");
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token: t2 })).json.ok, "token2 valid at /me");
// device 2 calls logout-all -> gets a fresh token
const r = await c.post(`/api/db/${slug}/auth/logout-all`, {}, { token: t2 });
t.ok(r.json.ok && r.json.token && r.json.token !== t2, "logout-all -> fresh token");
const t2b = r.json.token;
// old tokens (t1 AND t2) now fail at /me; the fresh one works
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token: t1 })).status === 401, "old token1 revoked -> 401");
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token: t2 })).status === 401, "old token2 revoked -> 401");
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token: t2b })).json.ok, "fresh token still valid");
// a subsequent fresh login also works (new epoch baked in)
const t3 = (await c.login(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token: t3 })).json.ok, "new login valid after revoke");
// and the fresh device-2 token still valid alongside it
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token: t2b })).json.ok, "device2 fresh token co-valid");
// logout-all needs auth
t.ok((await c.post(`/api/db/${slug}/auth/logout-all`, {})).status === 401, "logout-all needs auth -> 401");
t.done(); h.restore();

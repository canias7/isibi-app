// Batch 94 — admin impersonation: an admin mints a short-lived token that acts as another member
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 94");
const slug = "b94";
await c.ensure(slug);
await c.schema(slug, { tables: { notes: { access: "user", columns: [{ name: "body", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;   // id2

// admin impersonates the user by email
let imp = await c.post(`/api/db/${slug}/auth/impersonate`, { user: "user@x.dev" }, { token: ADMIN });
t.ok(imp.json.ok && imp.json.token, "admin gets an impersonation token");
t.eq(imp.json.impersonating.id, 2, "impersonating the right member");
t.eq(imp.json.expires_in, 3600, "short-lived (1h)");

// the token acts AS that member — /auth/me returns the target's email
let me = await c.get(`/api/db/${slug}/auth/me`, { token: imp.json.token });
t.ok(me.json.ok && me.json.user.email === "user@x.dev", "impersonation token identifies as the target member");

// and writes are owned by the target (acting as them)
await c.post(`/api/db/${slug}/rows/notes`, { body: "written while impersonated" }, { token: imp.json.token });
const asUser = (await c.get(`/api/db/${slug}/rows/notes`, { token: USER })).json.rows;
t.ok(asUser.some((r) => r.body === "written while impersonated"), "row is owned by the impersonated member");

// impersonate by numeric id works too
t.ok((await c.post(`/api/db/${slug}/auth/impersonate`, { user: 2 }, { token: ADMIN })).json.ok, "impersonate by id");

// a non-admin cannot impersonate
t.eq((await c.post(`/api/db/${slug}/auth/impersonate`, { user: 1 }, { token: USER })).status, 403, "non-admin blocked");
// unknown member → 400
t.eq((await c.post(`/api/db/${slug}/auth/impersonate`, { user: 999 }, { token: ADMIN })).status, 400, "unknown member → 400");
// can't impersonate yourself
t.eq((await c.post(`/api/db/${slug}/auth/impersonate`, { user: 1 }, { token: ADMIN })).status, 400, "self-impersonation blocked");
// signed-out → 401
t.eq((await c.post(`/api/db/${slug}/auth/impersonate`, { user: 2 }, {})).status, 401, "signed-out → 401");

t.done(); h.restore();

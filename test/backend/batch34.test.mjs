// Batch 34 — account self-service: change password, change email, delete own account
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 34");

const slug = "b34";
await c.ensure(slug);
let su = await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
let token = su.json.token;

// --- change password ---
// wrong current -> 403
t.ok((await c.post(`/api/db/${slug}/auth/password`, { current_password: "nope", password: "New-pass-123" }, { token })).status === 403, "wrong current password -> 403");
// weak new -> 400
t.ok((await c.post(`/api/db/${slug}/auth/password`, { current_password: "Str0ng-pass-9", password: "short" }, { token })).status === 400, "weak new password -> 400");
// correct change -> ok, returns fresh token
let r = await c.post(`/api/db/${slug}/auth/password`, { current_password: "Str0ng-pass-9", password: "New-pass-123" }, { token });
t.ok(r.json.ok && r.json.token, "change password ok, fresh token");
token = r.json.token;
// old password no longer logs in; new one does
t.ok((await c.login(slug, "a@x.dev", "Str0ng-pass-9")).status === 401, "old password rejected at login");
t.ok((await c.login(slug, "a@x.dev", "New-pass-123")).json.ok, "new password logs in");

// --- change email ---
// wrong password -> 403
t.ok((await c.post(`/api/db/${slug}/auth/email`, { password: "wrong", email: "new@x.dev" }, { token })).status === 403, "change email wrong password -> 403");
// valid -> ok
r = await c.post(`/api/db/${slug}/auth/email`, { password: "New-pass-123", email: "new@x.dev" }, { token });
t.ok(r.json.ok && r.json.user.email === "new@x.dev", "change email ok");
token = r.json.token;
// can log in with new email, not old
t.ok((await c.login(slug, "new@x.dev", "New-pass-123")).json.ok, "login with new email works");
t.ok((await c.login(slug, "a@x.dev", "New-pass-123")).status === 401, "old email no longer works");
// email collision -> 409
await c.signup(slug, "taken@x.dev", "Str0ng-pass-9");
t.ok((await c.post(`/api/db/${slug}/auth/email`, { password: "New-pass-123", email: "taken@x.dev" }, { token })).status === 409, "email already taken -> 409");

// --- delete account ---
// wrong password -> 403
t.ok((await c.del(`/api/db/${slug}/auth/account`, { token, body: { password: "nope" } })).status === 403, "delete wrong password -> 403");
// correct -> deleted; /me now 401; can't log in
r = await c.call("DELETE", `/api/db/${slug}/auth/account`, { token, body: { password: "New-pass-123" } });
t.ok(r.json.deleted === true, "account deleted");
t.ok((await c.get(`/api/db/${slug}/auth/me`, { token })).status === 401, "/me after delete -> 401");
t.ok((await c.login(slug, "new@x.dev", "New-pass-123")).status === 401, "deleted account can't log in");

// all account routes need auth
t.ok((await c.post(`/api/db/${slug}/auth/password`, { current_password: "x", password: "yyyyyyyy" })).status === 401, "password change needs auth -> 401");

t.done();
h.restore();

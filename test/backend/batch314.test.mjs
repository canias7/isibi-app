// Batch 314 — NO-SHOW TRACKING. Admin records/forgives no-shows; the strike count is COUNT per user; a member
// sees their own. Covers record + running strike count, count endpoint, me, list filter, forgive, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 314");
const slug = "b314";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const b2 = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const record = (tok, body) => c.post(`/api/db/${slug}/no-shows`, body, tok === null ? {} : { token: tok });
const count = (tok, u) => c.get(`/api/db/${slug}/no-shows/count?user=${u}`, { token: tok }).then((r) => r.json);
const mine = (tok) => c.get(`/api/db/${slug}/no-shows/me`, { token: tok }).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/no-shows${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/no-shows/${id}`, { token: tok });

// --- Record strikes ---
let r = (await record(A, { user: b2, ref: "BK-1", reason: "missed" })).json;
t.eq(r.strikes, 1, "first no-show → 1 strike");
const s2 = (await record(A, { user: b2, ref: "BK-2" })).json;
t.eq(s2.strikes, 2, "second → 2 strikes");

// --- Count ---
t.eq((await count(A, b2)).strikes, 2, "count endpoint reflects the total");

// --- Member sees their own ---
let m = await mine(B);
t.eq(m.strikes, 2, "the member sees their strike count");
t.eq(m.no_shows.length, 2, "…and the records");

// --- List filter ---
t.eq((await list(A, "?user=" + b2)).no_shows.length, 2, "admin lists a user's no-shows");

// --- Forgive one ---
const id = (await list(A)).no_shows[0].id;
t.eq((await del(A, id)).json.deleted, true, "admin forgives a strike");
t.eq((await count(A, b2)).strikes, 1, "…count drops to 1");

// --- Validation + authz ---
t.eq((await record(A, {})).status, 400, "a missing user → 400");
t.eq((await record(A, { user: 999999 })).status, 404, "an unknown user → 404");
t.eq((await record(B, { user: b2 })).status, 403, "a member can't record → 403");
t.eq((await c.get(`/api/db/${slug}/no-shows/count?user=${b2}`, { token: B })).status, 403, "a member can't read counts → 403");
t.eq((await c.get(`/api/db/${slug}/no-shows/me`)).status, 401, "signed-out → 401");

t.done(); h.restore();

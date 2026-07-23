// Batch 329 — MARKETING ATTRIBUTION. Record touchpoints; first/last-touch models attribute to the earliest or
// latest touch; a report tallies channels across users. Covers touch, for (first/last), me, report, admin
// seeding, owner scoping, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 329");
const slug = "b329";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev"), c3 = idOf("c@x.dev");
const touch = (tok, body) => c.post(`/api/db/${slug}/attribution/touch`, body, tok === null ? {} : { token: tok });
const forUser = (tok, q) => c.get(`/api/db/${slug}/attribution/for${q}`, { token: tok }).then((r) => r.json);
const me = (tok) => c.get(`/api/db/${slug}/attribution/me`, { token: tok }).then((r) => r.json);
const report = (tok, q) => c.get(`/api/db/${slug}/attribution/report${q || ""}`, { token: tok }).then((r) => r.json);

// --- B's journey: google → email → direct ---
await touch(B, { channel: "google", campaign: "spring" });
await touch(B, { channel: "email" });
await touch(B, { channel: "direct" });

// --- First vs last touch ---
t.eq((await forUser(A, "?user=" + b2 + "&model=first")).attributed.channel, "google", "first-touch attributes to google");
t.eq((await forUser(A, "?user=" + b2 + "&model=last")).attributed.channel, "direct", "last-touch attributes to direct");
t.eq((await forUser(A, "?user=" + b2)).model, "last", "defaults to last-touch");

// --- Me ---
t.eq((await me(B)).touches.length, 3, "member sees their touches");

// --- Admin seeds C's touch, then report ---
await touch(A, { user: c3, channel: "google" });
let rep = await report(A, "?model=first");
t.eq(rep.users, 2, "report covers both users");
t.eq(rep.by_channel.google, 2, "first-touch: both users' first channel is google");
t.eq((await report(A, "?model=last")).by_channel.direct, 1, "last-touch: B's last channel is direct");

// --- Owner scoping + authz ---
t.eq((await c.get(`/api/db/${slug}/attribution/for?user=${b2}`, { token: C })).status, 403, "a member can't read another's attribution → 403");
t.eq((await forUser(B, "?user=" + b2)).ok, true, "…but can read their own");
t.eq((await touch(B, { user: c3, channel: "x" })).status, 403, "a member can't seed another user's touch → 403");
t.eq((await touch(B, {})).status, 400, "a missing channel → 400");
t.eq((await c.get(`/api/db/${slug}/attribution/report`, { token: B })).status, 403, "a member can't read the report → 403");
t.eq((await c.post(`/api/db/${slug}/attribution/touch`, { channel: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

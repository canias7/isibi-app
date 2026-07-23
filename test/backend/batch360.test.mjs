// Batch 360 — ACCESS-VIEW LOG. A signed-in actor records that they viewed a resource (append-only); an admin
// reads the trail (who viewed what, filterable) or a per-resource summary (views + distinct viewers). Covers
// record, trail, resource/actor filters, summary counts, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 360");
const slug = "b360";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev");
const view = (tok, body) => c.post(`/api/db/${slug}/access-log`, body, { token: tok });

// --- Record views ---
t.eq((await view(B, { resource: "doc/42", note: "opened" })).json.logged, true, "a member logs a view");
await view(B, { resource: "doc/42" });        // B again on doc/42
await view(C, { resource: "doc/42" });        // C on doc/42
await view(C, { resource: "doc/99" });        // C on doc/99

// --- Trail (admin) ---
let trail = (await c.get(`/api/db/${slug}/access-log`, { token: A }).then((r) => r.json)).events;
t.eq(trail.length, 4, "the trail has every view");
t.eq(trail[0].resource, "doc/99", "…newest first");

// --- Resource filter ---
t.eq((await c.get(`/api/db/${slug}/access-log?resource=doc/42`, { token: A }).then((r) => r.json)).events.length, 3, "filter by resource");

// --- Actor filter ---
t.eq((await c.get(`/api/db/${slug}/access-log?actor=${b2}`, { token: A }).then((r) => r.json)).events.length, 2, "filter by actor");

// --- Summary (admin) ---
let sum = (await c.get(`/api/db/${slug}/access-log/summary`, { token: A }).then((r) => r.json)).summary;
let d42 = sum.find((s) => s.resource === "doc/42");
t.eq(d42.views, 3, "doc/42 has 3 views");
t.eq(d42.viewers, 2, "…from 2 distinct viewers");
let one = (await c.get(`/api/db/${slug}/access-log/summary?resource=doc/99`, { token: A }).then((r) => r.json)).summary;
t.eq(one.length, 1, "a single-resource summary returns one row");
t.eq(one[0].views, 1, "…with its count");

// --- Validation + authz ---
t.eq((await view(B, {})).status, 400, "no resource → 400");
t.eq((await c.post(`/api/db/${slug}/access-log`, { resource: "x" })).status, 401, "signed-out record → 401");
t.eq((await c.get(`/api/db/${slug}/access-log`, { token: B })).status, 403, "a member can't read the trail → 403");
t.eq((await c.get(`/api/db/${slug}/access-log/summary`, { token: C })).status, 403, "a member can't read the summary → 403");

t.done(); h.restore();

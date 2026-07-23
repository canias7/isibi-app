// Batch 251 — DATA EXPORT. A member downloads a bundle of all their OWN data across the site's user-scoped
// tables (GDPR portability). Only the caller's own rows are returned. Covers empty export, populated export
// across several tables, own-rows-only isolation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 251");
const slug = "b251";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const exportData = (tok) => c.get(`/api/db/${slug}/data-export`, { token: tok }).then((r) => r.json);

// --- Empty export (no data yet) ---
let ex = await exportData(B);
t.eq(ex.user.email, "b@x.dev", "export includes the caller's identity");
t.eq(ex.tables, 0, "…no data tables yet");

// --- Populate several user-scoped tables for B ---
await c.post(`/api/db/${slug}/points/award`, { user: bId, amount: 50 }, { token: A }); // _points_ledger
await c.post(`/api/db/${slug}/daily/claim`, {}, { token: B }); // _daily_claims
await c.post(`/api/db/${slug}/dashboard`, { tiles: [{ id: "x" }] }, { token: B }); // _dashboards
await c.post(`/api/db/${slug}/store-credit/issue`, { user: bId, amount: 10 }, { token: A }); // _store_credit

// C gets their own data too (to prove isolation)
await c.post(`/api/db/${slug}/daily/claim`, {}, { token: C });

// --- Populated export ---
ex = await exportData(B);
t.ok(ex.tables >= 4, "export now spans several tables");
t.ok(ex.data._points_ledger && ex.data._points_ledger.length === 1, "…points ledger row present");
t.ok(ex.data._daily_claims && ex.data._daily_claims.length === 1, "…daily claim present");
t.ok(ex.data._dashboards && ex.data._dashboards.length === 1, "…dashboard present");
t.ok(ex.data._store_credit && ex.data._store_credit.length === 1, "…store credit present");

// --- Own-rows-only isolation ---
t.eq(ex.data._points_ledger[0].user_id, bId, "the exported rows belong to the caller");
// C's export must not contain B's rows
let exC = await exportData(C);
t.ok(!exC.data._points_ledger, "C has no points ledger (didn't get any)");
t.ok(exC.data._daily_claims && exC.data._daily_claims.length === 1, "…but C's own daily claim is there");

// --- Authz ---
t.eq((await c.get(`/api/db/${slug}/data-export`)).status, 401, "signed-out export → 401");

t.done(); h.restore();

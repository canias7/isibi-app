// Batch 322 — BROKEN-LINK REGISTRY. Track URLs and record the last result an external checker reported.
// Covers register, report ok/broken, auto-register on report, broken list, status filter, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 322");
const slug = "b322";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const reg = (tok, body) => c.post(`/api/db/${slug}/link-check`, body, tok === null ? {} : { token: tok });
const report = (tok, body) => c.post(`/api/db/${slug}/link-check/report`, body, { token: tok });
const broken = (tok) => c.get(`/api/db/${slug}/link-check/broken`, { token: tok }).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/link-check${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/link-check/${id}`, { token: tok });

// --- Register ---
t.eq((await reg(A, { url: "https://a.dev/1", source: "homepage" })).json.status, "unchecked", "admin registers a URL as unchecked");
await reg(A, { url: "https://a.dev/2" });

// --- Report results ---
t.eq((await report(A, { url: "https://a.dev/1", ok: true, http_status: 200 })).json.status, "ok", "reporting ok marks it ok");
t.eq((await report(A, { url: "https://a.dev/2", ok: false, http_status: 404 })).json.status, "broken", "reporting a failure marks it broken");

// --- Report auto-registers an unseen URL ---
t.eq((await report(A, { url: "https://a.dev/3", ok: false, http_status: 500 })).json.status, "broken", "a report for a new URL auto-registers it");

// --- Broken list ---
let b = (await broken(A)).broken;
t.eq(b.length, 2, "two broken URLs");
t.ok(b.find((x) => x.http_status === 404), "…with their http_status");

// --- Status filter ---
t.eq((await list(A, "?status=ok")).links.length, 1, "list filters by status");
t.eq((await list(A)).links.length, 3, "…all three without a filter");

// --- Re-report flips status back ---
await report(A, { url: "https://a.dev/2", ok: true, http_status: 200 });
t.eq((await broken(A)).broken.length, 1, "fixing a link removes it from broken");

// --- Delete ---
const id = (await list(A, "?status=ok")).links[0].id;
t.eq((await del(A, id)).json.deleted, true, "admin deletes a tracked link");

// --- Validation + authz ---
t.eq((await reg(A, { url: "not-a-url" })).status, 400, "a bad url → 400");
t.eq((await report(A, {})).status, 400, "a report with no url → 400");
t.eq((await del(A, 999999)).status, 404, "deleting a missing link → 404");
t.eq((await reg(B, { url: "https://x.dev" })).status, 403, "a member can't register → 403");
t.eq((await c.get(`/api/db/${slug}/link-check`)).status, 401, "signed-out → 401");

t.done(); h.restore();

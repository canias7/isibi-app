// Batch 325 — METRIC ALERTS. Declare threshold rules on metrics; check a value and log breaches. Covers
// define, check (breach + no-breach), operators, breach log, metric isolation, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 325");
const slug = "b325";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const def = (tok, body) => c.post(`/api/db/${slug}/metric-alerts`, body, tok === null ? {} : { token: tok });
const check = (tok, body) => c.post(`/api/db/${slug}/metric-alerts/check`, body, { token: tok }).then((r) => r.json);
const breaches = (tok, q) => c.get(`/api/db/${slug}/metric-alerts/breaches${q || ""}`, { token: tok }).then((r) => r.json);
const list = (tok) => c.get(`/api/db/${slug}/metric-alerts`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/metric-alerts/${id}`, { token: tok });

// --- Define rules ---
const hi = (await def(A, { metric: "error_rate", op: "gt", threshold: 5 })).json.id;
await def(A, { metric: "uptime", op: "lt", threshold: 99 });
t.ok(hi, "admin defines a threshold rule");
t.eq((await list(A)).alerts.length, 2, "…two rules");

// --- Check: breach ---
let r = await check(A, { metric: "error_rate", value: 12 });
t.eq(r.breach_count, 1, "a value over the threshold breaches");
t.eq(r.breached[0].alert_id, hi, "…the right alert");

// --- Check: no breach ---
r = await check(A, { metric: "error_rate", value: 2 });
t.eq(r.breach_count, 0, "a value under the threshold does not breach");

// --- Operator lt ---
t.eq((await check(A, { metric: "uptime", value: 97 })).breach_count, 1, "lt operator breaches below the threshold");
t.eq((await check(A, { metric: "uptime", value: 99.9 })).breach_count, 0, "…and not above");

// --- Breach log ---
let b = (await breaches(A)).breaches;
t.ok(b.length >= 2, "breaches are logged");
t.eq((await breaches(A, "?metric=uptime")).breaches.length, 1, "…filterable by metric");

// --- A metric with no rules never breaches ---
t.eq((await check(A, { metric: "unwatched", value: 9999 })).breach_count, 0, "an unwatched metric never breaches");

// --- Delete ---
t.eq((await del(A, hi)).json.deleted, true, "admin deletes a rule");
t.eq((await check(A, { metric: "error_rate", value: 100 })).breach_count, 0, "…and it no longer fires");

// --- Validation + authz ---
t.eq((await def(A, { metric: "x", op: "bad", threshold: 1 })).status, 400, "a bad op → 400");
t.eq((await def(A, { metric: "x", op: "gt" })).status, 400, "a missing threshold → 400");
t.eq((await def(B, { metric: "x", op: "gt", threshold: 1 })).status, 403, "a member can't define → 403");
t.eq((await c.get(`/api/db/${slug}/metric-alerts`)).status, 401, "signed-out → 401");

t.done(); h.restore();

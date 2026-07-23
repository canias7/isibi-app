// Batch 333 — USAGE METERING. Cumulative counters per (meter, period): record bumps count + adds to total.
// Covers record + running totals, amount, periods, total across periods, list, reset, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 333");
const slug = "b333";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const record = (tok, body) => c.post(`/api/db/${slug}/usage-meter/record`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/usage-meter${q || ""}`, { token: tok }).then((r) => r.json);
const total = (tok, q) => c.get(`/api/db/${slug}/usage-meter/total${q}`, { token: tok }).then((r) => r.json);
const reset = (tok, meter) => c.del(`/api/db/${slug}/usage-meter/${meter}`, { token: tok });

// --- Record accumulates ---
t.eq((await record(B, { meter: "api_calls" })).json.count, 1, "first record → count 1");
t.eq((await record(B, { meter: "api_calls" })).json.count, 2, "…count 2");
let r = await record(B, { meter: "api_calls", amount: 5 });
t.eq(r.json.count, 3, "count keeps rising");
t.eq(r.json.total, 7, "…total sums the amounts (1+1+5)");

// --- Periods are independent ---
await record(B, { meter: "api_calls", period: "2026-08", amount: 10 });
t.eq((await total(A, "?meter=api_calls")).total, 17, "total sums across periods");
t.eq((await total(A, "?meter=api_calls")).count, 4, "…count too");

// --- List by meter ---
t.eq((await list(A, "?meter=api_calls")).usage.length, 2, "two periods for the meter");
t.eq((await list(A, "?meter=api_calls&period=2026-08")).usage[0].total, 10, "…filterable by period");

// --- Reset ---
t.ok((await reset(A, "api_calls")).json.removed >= 2, "admin resets a meter");
t.eq((await total(A, "?meter=api_calls")).total, 0, "…totals back to 0");

// --- Validation + authz ---
t.eq((await record(B, {})).status, 400, "a missing meter → 400");
t.eq((await total(A, "")).status ?? 400, 400, "total without a meter → 400");
t.eq((await c.get(`/api/db/${slug}/usage-meter/total`, { token: A })).status, 400, "…confirmed 400");
t.eq((await c.get(`/api/db/${slug}/usage-meter`, { token: B })).status, 403, "a member can't list usage → 403");
t.eq((await reset(B, "x")).status, 403, "a member can't reset → 403");
t.eq((await c.post(`/api/db/${slug}/usage-meter/record`, { meter: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();

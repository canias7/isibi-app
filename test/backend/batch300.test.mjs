// Batch 300 — PERCENTILE / DISTRIBUTION. Stateless numeric summary: min/max/mean/median + requested
// percentiles (linear interpolation). Covers a known sample, custom p list, single value, filtering of
// non-numbers, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 300");
const slug = "b300";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const pct = (body) => c.post(`/api/db/${slug}/stats/percentile`, body).then((r) => r.json);

// --- Known sample 1..10 ---
let r = await pct({ values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], p: [50, 90] });
t.eq(r.count, 10, "counts the sample");
t.eq(r.min, 1, "min");
t.eq(r.max, 10, "max");
t.eq(r.mean, 5.5, "mean");
t.eq(r.median, 5.5, "median (interpolated)");
t.eq(r.percentiles["50"], 5.5, "p50 = median");
t.eq(r.percentiles["90"], 9.1, "p90 by linear interpolation");

// --- Default percentiles ---
r = await pct({ values: [10, 20, 30] });
t.ok(r.percentiles["95"] != null && r.percentiles["99"] != null, "defaults to p50/90/95/99");

// --- Single value ---
r = await pct({ values: [42] });
t.eq(r.median, 42, "a single value → that value everywhere");
t.eq(r.percentiles["90"], 42, "…p90 too");

// --- Non-numbers filtered ---
r = await pct({ values: [1, "x", null, 3, true] });
t.eq(r.count, 2, "non-finite values are dropped");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/stats/percentile`, { values: [] })).status, 400, "empty values → 400");
t.eq((await c.post(`/api/db/${slug}/stats/percentile`, { values: ["a", "b"] })).status, 400, "all non-numeric → 400");

t.done(); h.restore();

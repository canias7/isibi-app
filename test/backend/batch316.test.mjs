// Batch 316 — ANOMALY DETECTION. Stateless z-score check over a sample. With a value → that point's z + a
// flag; without → scan the series. Covers value mode, series scan, threshold, zero-variance, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 316");
const slug = "b316";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const an = (body) => c.post(`/api/db/${slug}/stats/anomaly`, body).then((r) => r.json);

// --- Value mode: a value near the mean is normal ---
let r = await an({ values: [10, 11, 9, 10, 10, 11, 9], value: 10 });
t.eq(r.anomaly, false, "a value at the mean is not an anomaly");
t.ok(Math.abs(r.z) < 1, "…z near 0");

// --- Value mode: a far value is flagged ---
r = await an({ values: [10, 11, 9, 10, 10, 11, 9], value: 100 });
t.eq(r.anomaly, true, "a far-out value is flagged");
t.ok(r.z > 3, "…z above the default threshold");

// --- Custom threshold ---
r = await an({ values: [1, 2, 3, 4, 5], value: 8, threshold: 10 });
t.eq(r.anomaly, false, "a high threshold suppresses the flag");

// --- Series scan mode ---
r = await an({ values: [5, 5, 5, 5, 100, 5, 5, 5], threshold: 2 });
t.ok(r.anomalies.length >= 1, "series mode returns outliers");
t.eq(r.anomalies[0].value, 100, "…the spike is flagged");
t.eq(r.anomalies[0].index, 4, "…with its index");

// --- Zero variance → no anomalies ---
r = await an({ values: [7, 7, 7, 7] });
t.eq(r.std, 0, "constant series → std 0");
t.eq(r.anomalies.length, 0, "…no anomalies");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/stats/anomaly`, { values: [1] })).status, 400, "fewer than 2 values → 400");
t.eq((await c.post(`/api/db/${slug}/stats/anomaly`, { values: [1, 2], value: "x" })).status, 400, "a non-numeric value → 400");

t.done(); h.restore();

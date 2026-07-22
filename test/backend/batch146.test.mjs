// Batch 146 — KPI snapshots: record a business metric at points in time, read back the trend
// with deltas (change / pct_change vs the previous snapshot), min/max, and a metrics overview.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 146");
const slug = "b146";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const MEMBER = (await c.signup(slug, "m@x.dev", "Str0ng-pass-9")).json.token;    // id2
const rec = (body, tok) => c.post(`/api/db/${slug}/kpi`, body, { token: tok || ADMIN });
const series = (m, q, tok) => c.get(`/api/db/${slug}/kpi/${m}${q || ""}`, { token: tok || ADMIN });

// Record an MRR series over three months.
t.eq((await rec({ metric: "mrr", value: 1000, at: "2026-05-01T00:00:00Z" })).status, 200, "record → 200");
await rec({ metric: "mrr", value: 1500, at: "2026-06-01T00:00:00Z" });
await rec({ metric: "mrr", value: 1200, at: "2026-07-01T00:00:00Z" });
// A second, independent metric.
await rec({ metric: "nps", value: 42, at: "2026-06-01T00:00:00Z", note: "post-launch" });
await rec({ metric: "nps", value: 50, at: "2026-07-01T00:00:00Z" });

// One metric's time-series (oldest→newest) + deltas vs the previous point.
let s = (await series("mrr")).json;
t.eq(s.count, 3, "mrr has 3 points");
t.eq(s.points.map((p) => p.value), [1000, 1500, 1200], "points are oldest→newest");
t.eq(s.latest, 1200, "latest = most recent snapshot");
t.eq(s.previous, 1500, "previous = the one before");
t.eq(s.change, -300, "change = 1200 - 1500");
t.eq(s.pct_change, -20, "pct_change = -20% (−300/1500)");
t.eq(s.min, 1000, "min across the series");
t.eq(s.max, 1500, "max across the series");
// Notes round-trip.
let np = (await series("nps")).json;
t.eq(np.points.find((p) => p.value === 42).note, "post-launch", "note stored on the snapshot");
t.eq(np.pct_change, 19.05, "nps pct_change = 19.05% (8/42)");

// The overview lists every metric with its latest + delta.
let ov = (await c.get(`/api/db/${slug}/kpi`, { token: ADMIN })).json;
t.eq(ov.metrics.length, 2, "two metrics in the overview");
const mrr = ov.metrics.find((m) => m.metric === "mrr");
t.eq(mrr.latest, 1200, "overview mrr latest");
t.eq(mrr.change, -300, "overview mrr change");
t.eq(mrr.count, 3, "overview mrr count");

// Window filter on the series.
let win = (await series("mrr", "?from=2026-06-01T00:00:00Z")).json;
t.eq(win.count, 2, "from-window keeps June + July");
t.eq(win.points[0].value, 1500, "window starts at June");

// A single snapshot → no previous → null deltas (not a crash).
await rec({ metric: "solo", value: 7 });
let one = (await series("solo")).json;
t.eq(one.latest, 7, "single point latest");
t.eq(one.previous, null, "single point → no previous");
t.eq(one.change, null, "single point → null change");
t.eq(one.pct_change, null, "single point → null pct_change");

// DELETE clears a metric's history.
t.eq((await c.del(`/api/db/${slug}/kpi/solo`, { token: ADMIN })).json.removed, 1, "delete removed the 1 solo point");
t.eq((await series("solo")).json.count, 0, "solo history gone");

// Guards.
t.eq((await rec({ metric: "x", value: 1 }, MEMBER)).status, 403, "non-admin write → 403");
t.eq((await series("mrr", null, MEMBER)).status, 403, "non-admin read → 403");
t.eq((await c.get(`/api/db/${slug}/kpi/mrr`)).status, 401, "signed-out → 401");
t.eq((await rec({ value: 5 })).status, 400, "missing metric → 400");
t.eq((await rec({ metric: "y", value: "abc" })).status, 400, "non-numeric value → 400");
// Unknown metric reads as an empty series, not an error.
t.eq((await series("ghost")).json.count, 0, "unknown metric → empty series");

t.done(); h.restore();

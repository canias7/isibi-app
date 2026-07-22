// Batch 135 — demand forecasting: linear trend, moving average, exponential smoothing
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 135");
const slug = "b135";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const forecast = (body, tok) => c.post(`/api/db/${slug}/finance/forecast`, body, tok === null ? {} : { token: tok || ADMIN });

// Linear (default) over a perfect line → exact extrapolation.
let lin = await forecast({ series: [10, 20, 30, 40], horizon: 3 });
t.eq(lin.status, 200, "forecast → 200");
t.eq(lin.json.method, "linear", "defaults to linear");
t.eq(lin.json.slope, 10, "slope 10");
t.eq(lin.json.forecast.map((f) => f.value), [50, 60, 70], "extrapolates the line");
t.eq(lin.json.forecast.map((f) => f.step), [5, 6, 7], "future step numbers continue the series");

// Accepts {period, value} objects too.
let obj = await forecast({ series: [{ period: "Jan", value: 100 }, { period: "Feb", value: 110 }, { period: "Mar", value: 120 }], horizon: 1 });
t.eq(obj.json.forecast[0].value, 130, "object series extrapolates (slope 10 → 130)");

// Moving average → flat mean of the window.
let ma = await forecast({ series: [10, 20, 30, 40], method: "moving_average", window: 3, horizon: 2 });
t.eq(ma.json.method, "moving_average", "moving_average method");
t.eq(ma.json.forecast.map((f) => f.value), [30, 30], "MA(3) of last 3 = (20+30+40)/3 = 30, flat");

// Exponential smoothing → weighted level, flat forecast.
let es = await forecast({ series: [10, 20, 30, 40], method: "exp_smoothing", alpha: 0.5, horizon: 1 });
t.eq(es.json.method, "exp_smoothing", "exp_smoothing method");
// level: 10 → 15 → 22.5 → 31.25
t.eq(es.json.forecast[0].value, 31.25, "SES level with alpha 0.5");

// Flat series → flat forecast (slope 0).
t.eq((await forecast({ series: [50, 50, 50], horizon: 2 })).json.forecast.map((f) => f.value), [50, 50], "flat history → flat forecast");

// Downward trend forecasts a decline.
let down = await forecast({ series: [100, 90, 80, 70], horizon: 2 });
t.eq(down.json.forecast.map((f) => f.value), [60, 50], "downward trend extrapolates down");

// Validation + auth.
t.eq((await forecast({ series: [5] })).status, 400, "too few points → 400");
t.eq((await forecast({ series: [1, "x", 3] })).status, 400, "non-numeric value → 400");
t.eq((await forecast({})).status, 400, "no series → 400");
t.eq((await forecast({ series: [1, 2, 3] }, null)).status, 401, "signed-out → 401");
// horizon is capped, still returns a bounded array
t.eq((await forecast({ series: [1, 2], horizon: 999 })).json.forecast.length, 100, "horizon capped at 100");

t.done(); h.restore();

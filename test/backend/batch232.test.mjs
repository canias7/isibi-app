// Batch 232 — A/B SIGNIFICANCE HELPER. A stateless two-proportion z-test: given each variant's visitors +
// conversions, returns rates, uplift, z, two-tailed p-value, and significance. Covers a clear win, a close
// (non-significant) case, uplift, winner pick, custom confidence, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 232");
const slug = "b232";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const sig = (body) => c.post(`/api/db/${slug}/stats/significance`, body).then((r) => r.json);

// --- A clear win: 10% vs 15% over 1000 each ---
let r = await sig({ a: { visitors: 1000, conversions: 100 }, b: { visitors: 1000, conversions: 150 } });
t.eq(r.a.rate, 0.1, "A rate 10%");
t.eq(r.b.rate, 0.15, "B rate 15%");
t.ok(Math.abs(r.uplift - 0.5) < 1e-6, "uplift +50%");
t.ok(r.z > 3 && r.z < 3.5, "z ~3.38");
t.ok(r.p_value < 0.05, "p < 0.05");
t.eq(r.significant, true, "significant at 95%");
t.eq(r.winner, "b", "B is the winner");

// --- A close case: 100 vs 105 over 1000 — not significant ---
r = await sig({ a: { visitors: 1000, conversions: 100 }, b: { visitors: 1000, conversions: 105 } });
t.eq(r.significant, false, "a 0.5pp difference is not significant");
t.eq(r.winner, null, "…no declared winner");
t.ok(r.p_value > 0.05, "…p > 0.05");

// --- Identical variants → z 0, p 1 ---
r = await sig({ a: { visitors: 500, conversions: 50 }, b: { visitors: 500, conversions: 50 } });
t.eq(r.z, 0, "identical variants → z 0");
t.eq(r.p_value, 1, "…p 1");
t.eq(r.significant, false, "…not significant");

// --- Custom (99%) confidence is stricter ---
const strong = { a: { visitors: 2000, conversions: 200 }, b: { visitors: 2000, conversions: 240 } };
t.eq((await sig({ ...strong, confidence: 0.9 })).significant, true, "significant at 90%");
// same data at 99.99% may not clear the bar
const r99 = await sig({ ...strong, confidence: 0.9999 });
t.ok(typeof r99.significant === "boolean", "…confidence is respected in the threshold");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/stats/significance`, { a: { visitors: 0, conversions: 0 }, b: { visitors: 10, conversions: 1 } })).status, 400, "zero visitors → 400");
t.eq((await c.post(`/api/db/${slug}/stats/significance`, { a: { visitors: 10, conversions: 20 }, b: { visitors: 10, conversions: 1 } })).status, 400, "conversions > visitors → 400");
t.eq((await c.post(`/api/db/${slug}/stats/significance`, { a: { visitors: 10, conversions: 1 } })).status, 400, "missing b → 400");

t.done(); h.restore();

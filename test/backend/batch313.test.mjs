// Batch 313 — MOVING AVERAGE. Stateless series smoother: SMA over a window (null until it fills) + optional
// EMA. Covers SMA values, null prefix, EMA presence, window validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 313");
const slug = "b313";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const ma = (body) => c.post(`/api/db/${slug}/stats/moving-average`, body).then((r) => r.json);

// --- SMA window 3 over 1..6 ---
let r = await ma({ values: [1, 2, 3, 4, 5, 6], window: 3 });
t.eq(r.sma[0], null, "first two entries are null (window not filled)");
t.eq(r.sma[1], null, "…still null");
t.eq(r.sma[2], 2, "avg(1,2,3) = 2");
t.eq(r.sma[3], 3, "avg(2,3,4) = 3");
t.eq(r.sma[5], 5, "avg(4,5,6) = 5");
t.eq(r.sma.length, 6, "output aligned to input length");

// --- window 1 → identity ---
r = await ma({ values: [7, 8, 9], window: 1 });
t.eq(r.sma.join(","), "7,8,9", "window 1 → the series itself");

// --- EMA opt-in ---
r = await ma({ values: [1, 2, 3, 4], window: 2, ema: true });
t.eq(r.ema.length, 4, "EMA returned when requested");
t.eq(r.ema[0], 1, "EMA seeds on the first value");
t.ok(r.ema[3] > r.ema[0], "EMA rises with an increasing series");
t.ok(r.alpha > 0 && r.alpha < 1, "alpha reported in (0,1)");

// --- No EMA unless asked ---
t.eq((await ma({ values: [1, 2, 3], window: 2 })).ema, undefined, "no EMA by default");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/stats/moving-average`, { values: [1, 2], window: 5 })).status, 400, "window > length → 400");
t.eq((await c.post(`/api/db/${slug}/stats/moving-average`, { values: [], window: 1 })).status, 400, "empty values → 400");
t.eq((await c.post(`/api/db/${slug}/stats/moving-average`, { values: [1, "x"], window: 1 })).status, 400, "a non-number → 400");

t.done(); h.restore();

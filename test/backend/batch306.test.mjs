// Batch 306 — HISTOGRAM. Stateless bucketed distribution: split [min,max] into N equal bins and count values
// per bin. Covers default bins, explicit bin count, explicit range, edge inclusion, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 306");
const slug = "b306";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const hist = (body) => c.post(`/api/db/${slug}/stats/histogram`, body).then((r) => r.json);

// --- Explicit bins over 0..10 with values 1..10 ---
let r = await hist({ values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], bins: 5, min: 0, max: 10 });
t.eq(r.bins.length, 5, "5 bins produced");
t.eq(r.bins[0].lo, 0, "first bin starts at min");
t.eq(r.bins[4].hi, 10, "last bin ends at max");
t.eq(r.bins.reduce((s, b) => s + b.count, 0), 10, "every value is counted once");
t.eq(r.bins[0].count, 1, "bin [0,2) holds only 1 (2 lands in the next bin)");
t.eq(r.bins[1].count, 2, "bin [2,4) holds 2 and 3");

// --- Default bins ---
r = await hist({ values: [1, 2, 3] });
t.eq(r.bins.length, 10, "defaults to 10 bins");
t.eq(r.min, 1, "auto min");
t.eq(r.max, 3, "auto max");

// --- The max value lands in the last bin (inclusive top) ---
r = await hist({ values: [0, 100], bins: 2, min: 0, max: 100 });
t.eq(r.bins[1].count, 1, "the top value falls in the last bin");
t.eq(r.bins[0].count, 1, "…and the bottom in the first");

// --- Numeric strings accepted ---
r = await hist({ values: ["1", "2", "3", 4] });
t.eq(r.count, 4, "numeric strings are accepted");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/stats/histogram`, { values: [] })).status, 400, "empty values → 400");
t.eq((await c.post(`/api/db/${slug}/stats/histogram`, { values: ["x"] })).status, 400, "all non-numeric → 400");

t.done(); h.restore();

// Batch 301 — UNIT CONVERTER. Stateless conversion across length/mass/volume/time/data/temperature with
// auto-detected category. Covers each category, temperature special-casing, rounding, mismatched units.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 301");
const slug = "b301";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const conv = (body) => c.post(`/api/db/${slug}/convert`, body).then((r) => r.json);

// --- Length ---
let r = await conv({ value: 1, from: "km", to: "m" });
t.eq(r.result, 1000, "1 km = 1000 m");
t.eq(r.category, "length", "…category detected");
t.eq((await conv({ value: 12, from: "in", to: "ft" })).result, 1, "12 in = 1 ft");
t.eq((await conv({ value: 1, from: "mi", to: "km" })).result, 1.609344, "1 mi = 1.609344 km");

// --- Mass ---
t.eq((await conv({ value: 1, from: "kg", to: "g" })).result, 1000, "1 kg = 1000 g");
t.eq((await conv({ value: 16, from: "oz", to: "lb" })).result, 1, "16 oz = 1 lb");

// --- Volume ---
t.eq((await conv({ value: 1, from: "l", to: "ml" })).result, 1000, "1 l = 1000 ml");

// --- Time ---
t.eq((await conv({ value: 2, from: "h", to: "min" })).result, 120, "2 h = 120 min");

// --- Data ---
t.eq((await conv({ value: 1, from: "gb", to: "mb" })).result, 1000, "1 GB = 1000 MB (decimal)");
t.eq((await conv({ value: 1, from: "kib", to: "b" })).result, 1024, "1 KiB = 1024 B (binary)");

// --- Temperature (special) ---
t.eq((await conv({ value: 100, from: "c", to: "f" })).result, 212, "100 C = 212 F");
t.eq((await conv({ value: 32, from: "f", to: "c" })).result, 0, "32 F = 0 C");
t.eq((await conv({ value: 0, from: "c", to: "k" })).result, 273.15, "0 C = 273.15 K");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/convert`, { value: "x", from: "m", to: "km" })).status, 400, "a non-numeric value → 400");
t.eq((await c.post(`/api/db/${slug}/convert`, { value: 1, from: "km", to: "kg" })).status, 400, "mismatched categories → 400");
t.eq((await c.post(`/api/db/${slug}/convert`, { value: 1, from: "zz", to: "m" })).status, 400, "an unknown unit → 400");

t.done(); h.restore();

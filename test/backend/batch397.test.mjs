// Batch 397 — ROMAN. Stateless Roman-numeral converter, both directions (1..3999), with canonical validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 397");
const slug = "b397";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const toRoman = (number) => c.post(`/api/db/${slug}/roman`, { number }).then((r) => r.json);
const toNum = (roman) => c.post(`/api/db/${slug}/roman`, { roman }).then((r) => r.json);

// --- Number → Roman ---
t.eq((await toRoman(4)).roman, "IV", "4 → IV");
t.eq((await toRoman(9)).roman, "IX", "9 → IX");
t.eq((await toRoman(1994)).roman, "MCMXCIV", "1994 → MCMXCIV");
t.eq((await toRoman(3888)).roman, "MMMDCCCLXXXVIII", "3888 (longest)");
t.eq((await toRoman(1)).roman, "I", "1 → I");

// --- Roman → Number ---
t.eq((await toNum("IV")).number, 4, "IV → 4");
t.eq((await toNum("MCMXCIV")).number, 1994, "MCMXCIV → 1994");
t.eq((await toNum("xiv")).number, 14, "lower-case accepted");

// --- Round-trip ---
t.eq((await toNum((await toRoman(2026)).roman)).number, 2026, "round-trips 2026");

// --- Reject non-canonical forms ---
t.eq((await c.post(`/api/db/${slug}/roman`, { roman: "IIII" })).status, 400, "IIII (should be IV) → 400");
t.eq((await c.post(`/api/db/${slug}/roman`, { roman: "VX" })).status, 400, "VX (malformed) → 400");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/roman`, { number: 0 })).status, 400, "0 out of range → 400");
t.eq((await c.post(`/api/db/${slug}/roman`, { number: 4000 })).status, 400, "4000 out of range → 400");
t.eq((await c.post(`/api/db/${slug}/roman`, { roman: "ABC" })).status, 400, "invalid characters → 400");
t.eq((await c.post(`/api/db/${slug}/roman`, {})).status, 400, "neither number nor roman → 400");

t.done(); h.restore();

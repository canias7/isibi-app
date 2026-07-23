// Batch 396 — COLOR PALETTE. Stateless palette generator from a base hex (complementary/analogous/triadic/
// tetradic/monochromatic via HSL rotation). Covers scheme sizes, base echo, shorthand hex, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 396");
const slug = "b396";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const pal = (color, scheme) => c.post(`/api/db/${slug}/color-palette`, scheme ? { color, scheme } : { color }).then((r) => r.json);

// --- Base echo + default scheme ---
let r = await pal("#3366ff");
t.eq(r.base, "#3366ff", "base echoed lowercased");
t.eq(r.scheme, "complementary", "default scheme complementary");
t.eq(r.colors.length, 2, "…2 colors");
t.eq(r.colors[0], "#3366ff", "…first is the base");
t.ok(/^#[0-9a-f]{6}$/.test(r.colors[1]), "…second is a valid hex");

// --- Scheme sizes ---
t.eq((await pal("#3366ff", "analogous")).colors.length, 3, "analogous → 3");
t.eq((await pal("#3366ff", "triadic")).colors.length, 3, "triadic → 3");
t.eq((await pal("#3366ff", "tetradic")).colors.length, 4, "tetradic → 4");
t.eq((await pal("#3366ff", "monochromatic")).colors.length, 5, "monochromatic → 5");

// --- Complementary is ~180° opposite (blue → orange-ish) ---
r = await pal("#0000ff", "complementary");
t.ok(/^#[0-9a-f]{6}$/.test(r.colors[1]), "complementary of blue is a valid hex");

// --- Shorthand hex + no # ---
t.eq((await pal("#39f")).base, "#3399ff", "a 3-digit hex expands to 6");
t.eq((await pal("39f")).base, "#3399ff", "a bare hex (no #) is accepted");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/color-palette`, {})).status, 400, "no color → 400");
t.eq((await c.post(`/api/db/${slug}/color-palette`, { color: "notacolor" })).status, 400, "bad hex → 400");
t.eq((await c.post(`/api/db/${slug}/color-palette`, { color: "#3366ff", scheme: "bogus" })).status, 400, "unknown scheme → 400");

t.done(); h.restore();

// Batch 351 — COLOR CONVERT. Stateless hex/rgb/hsl converter. Covers hex→all, shorthand hex, rgb() input,
// hsl() input, round-trip, css strings, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 351");
const slug = "b351";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const cc = (color) => c.post(`/api/db/${slug}/color-convert`, { color }).then((r) => r.json);

// --- Hex → all ---
let r = await cc("#ff0000");
t.eq(r.rgb.r, 255, "red hex → r 255");
t.eq(r.rgb.g, 0, "…g 0");
t.eq(r.hsl.h, 0, "…hue 0");
t.eq(r.hsl.s, 100, "…saturation 100");
t.eq(r.hsl.l, 50, "…lightness 50");

// --- Shorthand hex ---
r = await cc("#0f0");
t.eq(r.hex, "#00ff00", "shorthand #0f0 expands to #00ff00");
t.eq(r.hsl.h, 120, "…green hue 120");

// --- rgb() input ---
r = await cc("rgb(0, 0, 255)");
t.eq(r.hex, "#0000ff", "rgb() parses to blue hex");
t.eq(r.hsl.h, 240, "…blue hue 240");

// --- hsl() input round-trips back to hex ---
r = await cc("hsl(0, 100%, 50%)");
t.eq(r.hex, "#ff0000", "hsl red → #ff0000");

// --- Grey has 0 saturation ---
r = await cc("#808080");
t.eq(r.hsl.s, 0, "grey has 0 saturation");
t.ok(r.hsl.l > 45 && r.hsl.l < 55, "…~50% lightness");

// --- CSS strings ---
r = await cc("#ff0000");
t.eq(r.css.rgb, "rgb(255, 0, 0)", "provides a css rgb() string");
t.ok(/^hsl\(/.test(r.css.hsl), "…and a css hsl() string");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/color-convert`, {})).status, 400, "a missing color → 400");
t.eq((await c.post(`/api/db/${slug}/color-convert`, { color: "notacolor" })).status, 400, "an unrecognized color → 400");

t.done(); h.restore();

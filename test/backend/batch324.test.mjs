// Batch 324 — COLOR CONTRAST (WCAG). Stateless: given fg + bg hex, return the contrast ratio and AA/AAA pass
// flags. Covers black/white extreme, mid-contrast, 3-digit hex, symmetry, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 324");
const slug = "b324";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const cc = (fg, bg) => c.post(`/api/db/${slug}/color-contrast`, { fg, bg }).then((r) => r.json);

// --- Black on white → 21:1, passes everything ---
let r = await cc("#000000", "#ffffff");
t.eq(r.ratio, 21, "black on white is 21:1");
t.eq(r.aa, true, "…passes AA");
t.eq(r.aaa, true, "…passes AAA");

// --- Same color → 1:1, fails ---
r = await cc("#777777", "#777777");
t.eq(r.ratio, 1, "identical colors → 1:1");
t.eq(r.aa, false, "…fails AA");

// --- A mid pair: grey on white passes large but not normal AAA ---
r = await cc("#767676", "#ffffff");
t.ok(r.ratio >= 4.5 && r.ratio < 7, "#767676 on white is ~4.5 (AA but not AAA)");
t.eq(r.aa, true, "…AA passes");
t.eq(r.aaa, false, "…AAA fails");
t.eq(r.aa_large, true, "…large AA passes");

// --- 3-digit hex + # optional ---
r = await cc("000", "fff");
t.eq(r.ratio, 21, "3-digit hex without # works");

// --- Symmetry (order doesn't matter) ---
t.eq((await cc("#123456", "#abcdef")).ratio, (await cc("#abcdef", "#123456")).ratio, "ratio is symmetric");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/color-contrast`, { fg: "#000" })).status, 400, "a missing bg → 400");
t.eq((await c.post(`/api/db/${slug}/color-contrast`, { fg: "nope", bg: "#fff" })).status, 400, "a bad color → 400");

t.done(); h.restore();

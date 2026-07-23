// Batch 394 — BARCODE. Stateless GTIN check-digit validator (EAN-13, UPC-A/12, EAN-8), auto-detected by length.
// Covers valid codes, bad check digit, type detection, expected-check reporting, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 394");
const slug = "b394";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const bc = (code) => c.post(`/api/db/${slug}/barcode`, { code }).then((r) => r.json);

// --- Valid EAN-13 ---
let r = await bc("4006381333931");
t.eq(r.valid, true, "a valid EAN-13");
t.eq(r.type, "EAN-13", "…type EAN-13");

// --- Valid UPC-A (12) ---
r = await bc("036000291452");
t.eq(r.valid, true, "a valid UPC-A");
t.eq(r.type, "UPC-A", "…type UPC-A");

// --- Valid EAN-8 ---
t.eq((await bc("73513537")).valid, true, "a valid EAN-8");

// --- Bad check digit reports the expected ---
r = await bc("4006381333930"); // last digit tampered (should be 1)
t.eq(r.valid, false, "a wrong check digit → invalid");
t.eq(r.expected_check, 1, "…reports the expected check digit");
t.eq(r.check_digit, 0, "…and the actual one");

// --- Hyphens/spaces tolerated ---
t.eq((await bc("0 36000 29145 2")).valid, true, "spaces are ignored");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/barcode`, {})).status, 400, "no code → 400");
t.eq((await c.post(`/api/db/${slug}/barcode`, { code: "123" })).status, 400, "an unsupported length → 400");
t.eq((await c.post(`/api/db/${slug}/barcode`, { code: "40063813339AB" })).status, 400, "non-digits → 400");

t.done(); h.restore();

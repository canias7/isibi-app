// Batch 389 — VAT NUMBER. Stateless EU/UK VAT-number format validator (structure only, not a live VIES lookup).
// Covers valid shapes per country, wrong body, unknown country, separators, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 389");
const slug = "b389";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const vat = (v) => c.post(`/api/db/${slug}/vat-number`, { vat: v }).then((r) => r.json);

// --- Valid shapes ---
t.eq((await vat("DE123456789")).valid, true, "German VAT (9 digits)");
t.eq((await vat("ATU12345678")).valid, true, "Austrian VAT (U + 8 digits)");
t.eq((await vat("NL123456789B01")).valid, true, "Dutch VAT (…B01)");
t.eq((await vat("GB123456789")).valid, true, "UK VAT (9 digits)");

// --- Detail ---
let r = await vat("DE 123.456.789");
t.eq(r.country, "DE", "country parsed");
t.eq(r.format_ok, true, "format matches");
t.eq(r.normalized, "DE123456789", "separators stripped");

// --- Wrong body for the country ---
r = await vat("DE12345"); // too short for DE (needs 9 digits)
t.eq(r.format_ok, false, "a too-short German body → format_ok false");
t.eq(r.valid, false, "…invalid");

// --- Austrian without the U prefix ---
t.eq((await vat("AT12345678")).valid, false, "Austrian VAT missing the U prefix is invalid");

// --- Unknown country ---
r = await vat("ZZ123456789");
t.eq(r.country, null, "unknown country → null");
t.eq(r.valid, false, "…invalid");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/vat-number`, {})).status, 400, "no vat → 400");
t.eq((await c.post(`/api/db/${slug}/vat-number`, { vat: "1" })).status, 400, "too short to have a country → 400");

t.done(); h.restore();

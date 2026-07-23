// Batch 328 — PHONE NORMALIZE. Stateless best-effort E.164. A leading + is trusted; a country supplies the
// prefix and strips a national leading 0. Covers +form, ISO country, dialing-code country, leading-0, invalid.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 328");
const slug = "b328";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const ph = (body) => c.post(`/api/db/${slug}/phone-normalize`, body).then((r) => r.json);

// --- Already-E.164 (with formatting) ---
let r = await ph({ phone: "+1 (415) 555-2671" });
t.eq(r.e164, "+14155552671", "strips formatting from a + number");
t.eq(r.valid, true, "…and is valid");
t.eq(r.country_code, "1", "…detects the country code");

// --- National number + ISO country ---
t.eq((await ph({ phone: "415-555-2671", country: "us" })).e164, "+14155552671", "US national → E.164");
t.eq((await ph({ phone: "020 7946 0958", country: "gb" })).e164, "+442079460958", "UK national strips the leading 0");

// --- Dialing-code country param ---
t.eq((await ph({ phone: "615551234", country: "61" })).e164, "+61615551234", "a numeric dialing code works");

// --- Missing country for a national number → not valid ---
r = await ph({ phone: "5551234" });
t.eq(r.valid, false, "a national number without a country can't be normalized");
t.eq(r.e164, null, "…e164 is null");

// --- Too short / too long ---
t.eq((await ph({ phone: "+12" })).valid, false, "a too-short + number is invalid");
t.eq((await ph({ phone: "+1234567890123456789" })).valid, false, "a too-long number is invalid");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/phone-normalize`, {})).status, 400, "a missing phone → 400");

t.done(); h.restore();

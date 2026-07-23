// Batch 384 — IBAN. Stateless IBAN validator: country length registry + ISO 7064 mod-97 checksum. Spaces
// ignored. Covers valid IBANs, bad checksum, wrong length, unknown country, formatting, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 384");
const slug = "b384";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const iban = (v) => c.post(`/api/db/${slug}/iban`, { iban: v }).then((r) => r.json);

// --- Valid IBANs (well-known test values) ---
t.eq((await iban("GB82 WEST 1234 5698 7654 32")).valid, true, "a valid UK IBAN (with spaces)");
t.eq((await iban("DE89370400440532013000")).valid, true, "a valid German IBAN");
t.eq((await iban("FR1420041010050500013M02606")).valid, true, "a valid French IBAN");

// --- Detail fields ---
let r = await iban("GB82WEST12345698765432");
t.eq(r.country, "GB", "country parsed");
t.eq(r.checksum_ok, true, "checksum passes");
t.eq(r.length_ok, true, "length matches GB (22)");
t.eq(r.formatted, "GB82 WEST 1234 5698 7654 32", "formatted in groups of 4");

// --- Bad checksum ---
r = await iban("GB82WEST12345698765433"); // last digit tampered
t.eq(r.checksum_ok, false, "a tampered IBAN fails the checksum");
t.eq(r.valid, false, "…and is invalid");

// --- Wrong length for the country ---
r = await iban("DE8937040044053201300"); // one short
t.eq(r.length_ok, false, "a too-short German IBAN → length_ok false");
t.eq(r.valid, false, "…invalid");

// --- Unknown country ---
r = await iban("ZZ8237040044053201300");
t.eq(r.country, null, "an unknown country code → null country");
t.eq(r.valid, false, "…and invalid");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/iban`, {})).status, 400, "no iban → 400");
t.eq((await c.post(`/api/db/${slug}/iban`, { iban: "GB!!12" })).status, 400, "invalid characters → 400");

t.done(); h.restore();

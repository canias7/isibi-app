// Batch 356 — CARD TYPE. Stateless card-brand detection from the IIN/prefix + Luhn flag + length check.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 356");
const slug = "b356";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const ct = (number) => c.post(`/api/db/${slug}/card-type`, { number }).then((r) => r.json);

// --- Brands ---
t.eq((await ct("4111111111111111")).brand, "visa", "4xxx → Visa");
t.eq((await ct("5555555555554444")).brand, "mastercard", "55xx → Mastercard");
t.eq((await ct("2223003122003222")).brand, "mastercard", "2221–2720 range → Mastercard");
t.eq((await ct("378282246310005")).brand, "amex", "34/37 → Amex");
t.eq((await ct("6011111111111117")).brand, "discover", "6011 → Discover");
t.eq((await ct("3056930009020004")).brand, "diners", "30x → Diners");
t.eq((await ct("3530111333300000")).brand, "jcb", "35 → JCB");
t.eq((await ct("9999999999999999")).brand, "unknown", "unrecognized prefix → unknown");

// --- Luhn flag ---
let r = await ct("4111111111111111");
t.eq(r.luhn_valid, true, "a valid Visa passes Luhn");
t.eq((await ct("4111111111111112")).luhn_valid, false, "a corrupted number fails Luhn");

// --- Length check ---
r = await ct("378282246310005");
t.eq(r.length, 15, "Amex is 15 digits");
t.eq(r.length_ok, true, "…length matches the brand");
t.eq((await ct("41111")).length_ok, false, "a too-short Visa → length_ok false");

// --- Formatting tolerated ---
t.eq((await ct("4111 1111 1111 1111")).brand, "visa", "spaces ignored");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/card-type`, { number: "abc" })).status, 400, "no digits → 400");

t.done(); h.restore();

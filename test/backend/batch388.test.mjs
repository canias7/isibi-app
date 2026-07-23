// Batch 388 — NUMBER TO WORDS. Stateless English integer/money speller. Covers small/large integers, negatives,
// decimals, and currency mode (dollars/cents, singular/plural, pence).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 388");
const slug = "b388";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const w = (number, opts = {}) => c.post(`/api/db/${slug}/number-to-words`, { number, ...opts }).then((r) => r.json).then((r) => r.words);

// --- Integers ---
t.eq(await w(0), "zero", "0");
t.eq(await w(7), "seven", "7");
t.eq(await w(23), "twenty-three", "23 hyphenated");
t.eq(await w(100), "one hundred", "100");
t.eq(await w(123), "one hundred twenty-three", "123");
t.eq(await w(1000), "one thousand", "1000");
t.eq(await w(1234567), "one million two hundred thirty-four thousand five hundred sixty-seven", "1,234,567");

// --- Negative ---
t.eq(await w(-42), "negative forty-two", "negative");

// --- Decimal (non-currency) ---
t.eq(await w(3.14), "three point one four", "decimals spelled digit by digit");

// --- Currency (USD) ---
t.eq(await w(123.45, { currency: "USD" }), "one hundred twenty-three dollars and forty-five cents", "money in dollars and cents");
t.eq(await w(1, { currency: "USD" }), "one dollar and zero cents", "singular dollar");
t.eq(await w(2.01, { currency: "USD" }), "two dollars and one cent", "singular cent");

// --- Currency (GBP → pounds/pence) ---
t.eq(await w(5.50, { currency: "GBP" }), "five pounds and fifty pence", "pounds and pence");

// --- Rounding of cents ---
t.eq(await w(9.999, { currency: "USD" }), "ten dollars and zero cents", "cents round up into the next dollar");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/number-to-words`, { number: "abc" })).status, 400, "non-numeric → 400");
t.eq((await c.post(`/api/db/${slug}/number-to-words`, { number: 1e15 })).status, 400, "too large → 400");

t.done(); h.restore();

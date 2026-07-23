// Batch 255 — CURRENCY CONVERSION SNAPSHOT. An admin stores exchange rates (relative to a base); the app
// converts an amount between currencies at the stored rates. Covers set rates, get, convert (cross-rate
// math), code normalization, missing-rate errors, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 255");
const slug = "b255";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const setRates = (tok, body) => c.post(`/api/db/${slug}/fx`, body, tok === null ? {} : { token: tok });
const getRates = () => c.get(`/api/db/${slug}/fx`).then((r) => r.json);
const convert = (amount, from, to) => c.get(`/api/db/${slug}/fx/convert?amount=${amount}&from=${from}&to=${to}`).then((r) => r.json);

// --- Set rates (base USD) ---
t.eq((await setRates(A, { base: "USD", rates: { USD: 1, EUR: 0.9, GBP: 0.8 } })).json.count, 3, "admin sets 3 rates");
let g = await getRates();
t.eq(g.base, "USD", "base is USD");
t.eq(g.rates.EUR, 0.9, "…EUR rate stored");

// --- Convert base → other ---
t.eq((await convert(100, "USD", "EUR")).result, 90, "100 USD → 90 EUR");
t.eq((await convert(100, "USD", "GBP")).result, 80, "100 USD → 80 GBP");
// --- Convert other → base ---
t.eq((await convert(90, "EUR", "USD")).result, 100, "90 EUR → 100 USD");
// --- Cross rate (EUR → GBP): 100 EUR = 111.11 USD = 88.89 GBP ---
let cr = await convert(100, "EUR", "GBP");
t.ok(Math.abs(cr.result - 88.888889) < 0.001, "100 EUR → ~88.89 GBP (cross rate via base)");
// --- Same currency ---
t.eq((await convert(50, "EUR", "EUR")).result, 50, "same currency → unchanged");

// --- Code normalization (lowercase/whitespace) ---
t.eq((await convert(100, "usd", "eur")).result, 90, "lowercase codes normalize");

// --- Replace the table ---
await setRates(A, { rates: { USD: 1, JPY: 150 } });
t.eq((await getRates()).rates.EUR, undefined, "re-posting replaces the whole table (EUR gone)");
t.eq((await convert(2, "USD", "JPY")).result, 300, "2 USD → 300 JPY");

// --- Missing-rate errors ---
t.eq((await convert(10, "USD", "EUR")).ok ?? false, false, "converting to a currency with no rate → not ok");
t.eq((await c.get(`/api/db/${slug}/fx/convert?amount=10&from=USD&to=EUR`)).status, 400, "…400");

// --- Validation + authz ---
t.eq((await setRates(A, { rates: {} })).status, 400, "empty rates → 400");
t.eq((await setRates(A, { rates: { USD: -1 } })).status, 400, "a non-positive rate → 400");
t.eq((await c.get(`/api/db/${slug}/fx/convert?from=USD&to=JPY`)).status, 400, "missing amount → 400");
t.eq((await setRates(B, { rates: { USD: 1 } })).status, 403, "a member can't set rates → 403");
t.eq((await setRates(null, { rates: { USD: 1 } })).status, 401, "signed-out set → 401");

t.done(); h.restore();

// Batch 171 — SALES TAX / VAT calculator (stateless finance calc). Exclusive vs inclusive pricing,
// single rate vs multiple/compound jurisdictions, cents-exact tie-out, and the guards
// (401 signed-out, 400 bad input, compound+inclusive rejected).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 171");
const slug = "b171";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 (admin) — any member can calc
const tax = (body, opts) => c.post(`/api/db/${slug}/finance/tax`, body, opts === undefined ? { token: A } : opts);

// --- EXCLUSIVE, single rate: tax added on top ---
let r = (await tax({ subtotal: 100, rate: 8.25 })).json;
t.eq(r.taxes, [{ name: "tax", rate: 8.25, amount: 8.25 }], "single 8.25% → one tax line of 8.25");
t.eq([r.subtotal, r.tax, r.total], [100, 8.25, 108.25], "exclusive single: total = subtotal + tax");

// --- EXCLUSIVE, multiple additive jurisdictions ---
r = (await tax({ subtotal: 200, rates: [{ name: "state", rate: 6 }, { name: "city", rate: 2.5 }] })).json;
t.eq(r.taxes, [{ name: "state", rate: 6, amount: 12 }, { name: "city", rate: 2.5, amount: 5 }], "two jurisdictions each on the base subtotal");
t.eq([r.tax, r.total], [17, 217], "additive jurisdictions sum on top");

// --- EXCLUSIVE, compound: a compound rate stacks on subtotal + prior taxes (tax-on-tax) ---
r = (await tax({ subtotal: 100, rates: [{ name: "gst", rate: 5 }, { name: "pst", rate: 8, compound: true }] })).json;
t.eq(r.taxes[1].amount, 8.4, "compound PST 8% is charged on 105 (subtotal + GST) → 8.40");
t.eq([r.tax, r.total], [13.4, 113.4], "compound total ties out");

// --- INCLUSIVE, single rate: tax is backed out, a NET subtotal returned, total = the given amount ---
r = (await tax({ subtotal: 108.25, rate: 8.25, inclusive: true })).json;
t.eq([r.subtotal, r.tax, r.total], [100, 8.25, 108.25], "inclusive single: net 100, tax 8.25, total unchanged");
t.eq(r.taxes, [{ name: "tax", rate: 8.25, amount: 8.25 }], "inclusive single tax line");

// --- INCLUSIVE, multiple additive: net + taxes tie back to the given total ---
r = (await tax({ subtotal: 217, rates: [{ name: "state", rate: 6 }, { name: "city", rate: 2.5 }], inclusive: true })).json;
t.eq([r.subtotal, r.tax, r.total], [200, 17, 217], "inclusive multi: backs out to net 200");
t.ok(Math.round((r.subtotal + r.taxes.reduce((a, x) => a + x.amount, 0)) * 100) / 100 === r.total, "inclusive multi: net + Σtaxes === total (cents-exact)");

// --- INCLUSIVE cents-exactness with a rounding residual (last jurisdiction absorbs it) ---
r = (await tax({ subtotal: 100, rates: [{ rate: 5 }, { rate: 5 }], inclusive: true })).json;
t.eq(r.taxes.map((x) => x.amount), [4.55, 4.54], "residual pushed onto the last jurisdiction so Σ = 9.09");
t.ok(Math.round((r.subtotal + r.tax) * 100) / 100 === 100, "inclusive residual case still ties out to 100");

// --- GUARDS ---
t.eq((await tax({ subtotal: 100, rate: 8.25 }, {})).status, 401, "no token → 401 sign in first");
t.eq((await tax({ subtotal: -1, rate: 5 })).status, 400, "negative subtotal → 400");
t.eq((await tax({ subtotal: 100, rate: 150 })).status, 400, "rate > 100 → 400");
t.eq((await tax({ subtotal: 100 })).status, 400, "no rate and no rates → 400");
t.eq((await tax({ subtotal: 100, rates: Array.from({ length: 21 }, () => ({ rate: 1 })) })).status, 400, "> 20 jurisdictions → 400");
t.eq((await tax({ subtotal: 100, rates: [{ rate: 5, compound: true }], inclusive: true })).status, 400, "compound + inclusive → 400");
let z = (await tax({ subtotal: 100, rates: [{ rate: 5, compound: true }], inclusive: true })).json;
t.eq(z.error, "compound rates can't be combined with inclusive pricing", "clear compound+inclusive message");

// --- Edge: rate 0 → zero tax, total unchanged ---
r = (await tax({ subtotal: 50, rate: 0 })).json;
t.eq([r.tax, r.total], [0, 50], "0% rate → no tax");

t.done(); h.restore();

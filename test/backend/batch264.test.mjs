// Batch 264 — TAX RATES. An admin stores a tax rate per region; the app computes the tax on a subtotal.
// Covers set (percent→bp), list, compute (rounding), region case-insensitivity, update, delete, missing
// region, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 264");
const slug = "b264";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const set = (tok, region, body) => c.post(`/api/db/${slug}/tax-rates/${region}`, body, tok === null ? {} : { token: tok });
const list = () => c.get(`/api/db/${slug}/tax-rates`).then((r) => r.json);
const compute = (region, subtotal) => c.get(`/api/db/${slug}/tax-rates/compute?region=${encodeURIComponent(region)}&subtotal=${subtotal}`).then((r) => r.json);
const del = (tok, region) => c.del(`/api/db/${slug}/tax-rates/${region}`, { token: tok });

// --- Set rates ---
t.eq((await set(A, "ca", { rate: 8.75, name: "California" })).json.rate, 8.75, "admin sets CA at 8.75%");
await set(A, "ny", { rate: 8.875 });
await set(A, "or", { rate: 0, name: "Oregon (no sales tax)" });

// --- List ---
let l = (await list()).rates;
t.eq(l.length, 3, "list has 3 regions");
t.eq(l.find((x) => x.region === "ca").rate, 8.75, "…with the rate");

// --- Compute ---
let r = await compute("ca", 100);
t.eq(r.rate, 8.75, "compute returns the rate");
t.eq(r.tax, 8.75, "tax on $100 at 8.75% = $8.75");
t.eq(r.total, 108.75, "…total $108.75");
// rounding: 8.875% of 49.99 = 4.436... → rounds to 4.44
r = await compute("ny", 49.99);
t.eq(r.tax, 4.44, "NY tax rounds to the cent (4.436 → 4.44)");
// zero-rate region
t.eq((await compute("or", 200)).tax, 0, "Oregon (0%) → $0 tax");
t.eq((await compute("or", 200)).total, 200, "…total unchanged");

// --- Region case-insensitivity ---
t.eq((await compute("CA", 100)).tax, 8.75, "region lookup is case-insensitive");

// --- Update in place ---
await set(A, "ca", { rate: 9 });
t.eq((await compute("ca", 100)).tax, 9, "re-setting updates the rate");

// --- Delete ---
t.eq((await del(A, "or")).json.deleted, true, "admin deletes a region");
t.eq((await c.get(`/api/db/${slug}/tax-rates/compute?region=or&subtotal=100`)).status, 404, "…computing for it → 404");

// --- Validation + authz ---
t.eq((await set(A, "x", { rate: 150 })).status, 400, "a rate over 100 → 400");
t.eq((await set(A, "x", {})).status, 400, "missing rate → 400");
t.eq((await c.get(`/api/db/${slug}/tax-rates/compute?region=ca`)).status, 400, "missing subtotal → 400");
t.eq((await c.get(`/api/db/${slug}/tax-rates/compute?subtotal=100`)).status, 400, "missing region → 400");
t.eq((await set(B, "tx", { rate: 6 })).status, 403, "a member can't set → 403");
t.eq((await del(B, "ca")).status, 403, "a member can't delete → 403");
t.eq((await set(null, "tx", { rate: 6 })).status, 401, "signed-out set → 401");

t.done(); h.restore();

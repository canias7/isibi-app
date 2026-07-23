// Batch 211 — SHIPPING-RATE CALCULATOR. An admin defines rate tiers per named zone (weight/subtotal bands,
// a flat rate, a free-over threshold); the app asks for a quote and gets the matching rate. Covers rate
// creation, the quote match (weight + subtotal bands, cheapest tier, free-over), list/delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 211");
const slug = "b211";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const addRate = (tok, body) => c.post(`/api/db/${slug}/shipping/rates`, body, tok === null ? {} : { token: tok });
const quote = (body) => c.post(`/api/db/${slug}/shipping/quote`, body).then((r) => r.json);
const listRates = (tok, q) => c.get(`/api/db/${slug}/shipping/rates${q || ""}`, { token: tok }).then((r) => r.json);
const delRate = (tok, id) => c.del(`/api/db/${slug}/shipping/rates/${id}`, { token: tok });

// --- Define rate tiers ---
// US: light (0–2kg) $5, heavy (2kg+) $12, free over $100
const light = (await addRate(A, { zone: "US", label: "Light", max_weight: 2, rate: 5, free_over: 100 })).json.id;
const heavy = (await addRate(A, { zone: "US", label: "Heavy", min_weight: 2, rate: 12, free_over: 100 })).json.id;
await addRate(A, { zone: "EU", label: "EU flat", rate: 15 });
t.ok(light && heavy, "created rate tiers");

// --- Quote matches by weight band ---
let q = await quote({ zone: "US", weight: 1, subtotal: 30 });
t.eq(q.rate, 5, "1kg → light rate $5");
t.eq(q.matched.label, "Light", "…matched the Light tier");
q = await quote({ zone: "US", weight: 5, subtotal: 30 });
t.eq(q.rate, 12, "5kg → heavy rate $12");

// --- Free-over threshold ---
q = await quote({ zone: "US", weight: 5, subtotal: 150 });
t.eq(q.free, true, "subtotal over $100 → free shipping");
t.eq(q.rate, 0, "…rate is 0");

// --- Cheapest applicable tier wins on overlap (boundary 2kg matches both) ---
q = await quote({ zone: "US", weight: 2, subtotal: 10 });
t.eq(q.rate, 5, "at the 2kg boundary both tiers match → cheapest ($5) wins");

// --- Other zone ---
t.eq((await quote({ zone: "EU", weight: 3, subtotal: 20 })).rate, 15, "EU flat rate $15");

// --- No matching zone/tier ---
q = await quote({ zone: "ASIA", weight: 1, subtotal: 10 });
t.eq(q.matched, null, "an unknown zone → no match");
t.eq(q.rate, null, "…and null rate");

// --- List + delete ---
t.eq((await listRates(A)).rates.length, 3, "admin lists all rates");
t.eq((await listRates(A, "?zone=US")).rates.length, 2, "…filtered by zone");
t.eq((await delRate(A, heavy)).json.deleted, true, "admin deletes a rate");
t.eq((await quote({ zone: "US", weight: 5, subtotal: 10 })).matched, null, "…the heavy tier is gone");

// --- Validation + authz ---
t.eq((await addRate(A, { rate: 5 })).status, 400, "missing zone → 400");
t.eq((await addRate(A, { zone: "US" })).status, 400, "missing rate → 400");
t.eq((await quote({ weight: 1 })).ok ?? false, false, "quote with no zone → not ok");
t.eq((await addRate(B, { zone: "US", rate: 5 })).status, 403, "a member can't add a rate → 403");
t.eq((await c.get(`/api/db/${slug}/shipping/rates`, { token: B })).status, 403, "a member can't list rates → 403");
t.eq((await delRate(B, light)).status, 403, "a member can't delete → 403");
t.eq((await addRate(null, { zone: "US", rate: 5 })).status, 401, "signed-out add → 401");

t.done(); h.restore();

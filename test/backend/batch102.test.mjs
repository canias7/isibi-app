// Batch 102 — A/B testing: deterministic variant bucketing + conversion tracking + results
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 102");
const slug = "b102";
await c.ensure(slug);
await c.schema(slug, { tables: { x: { access: "admin", columns: [{ name: "a", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;

// anonymous bucketing by a stable key — same key → same variant every time
let v1 = (await c.get(`/api/db/${slug}/experiment/hero?variants=a,b&key=visitor1`)).json;
t.ok(v1.ok && (v1.variant === "a" || v1.variant === "b"), "bucketed into a variant");
let v1again = (await c.get(`/api/db/${slug}/experiment/hero?variants=a,b&key=visitor1`)).json;
t.eq(v1again.variant, v1.variant, "same key → stable variant");

// distribution across many keys hits both variants
const seen = new Set();
for (let i = 0; i < 30; i++) seen.add((await c.get(`/api/db/${slug}/experiment/hero?variants=a,b&key=k${i}`)).json.variant);
t.ok(seen.has("a") && seen.has("b"), "both variants get assigned across keys");

// changing the requested variants doesn't re-bucket a key already assigned
let stable = (await c.get(`/api/db/${slug}/experiment/hero?variants=a,b,c&key=visitor1`)).json;
t.eq(stable.variant, v1.variant, "existing key keeps its variant even when variants change");

// convert requires a prior exposure
t.eq((await c.post(`/api/db/${slug}/experiment/hero/convert?key=never-seen`, {})).status, 404, "convert without exposure → 404");
t.ok((await c.post(`/api/db/${slug}/experiment/hero/convert?key=visitor1`, {})).json.converted, "convert a bucketed visitor");

// results (admin): exposures + conversions + rate per variant
let res = (await c.get(`/api/db/${slug}/experiment/hero/results`, { token: ADMIN })).json;
t.ok(res.ok && Array.isArray(res.variants), "results ok");
const total = res.variants.reduce((s, v) => s + v.exposures, 0);
t.eq(total, 31, "30 anon keys + visitor1 = 31 exposures");
const conv = res.variants.reduce((s, v) => s + v.conversions, 0);
t.eq(conv, 1, "one conversion recorded");
t.ok(res.variants.every((v) => v.rate >= 0 && v.rate <= 1), "rate is a fraction");

// results are admin-only
t.eq((await c.get(`/api/db/${slug}/experiment/hero/results`)).status, 401, "results signed-out → 401");
// need >=2 variants
t.eq((await c.get(`/api/db/${slug}/experiment/hero?variants=a&key=z`)).status, 400, "one variant → 400");
// anon with no key → 400
t.eq((await c.get(`/api/db/${slug}/experiment/hero?variants=a,b`)).status, 400, "no key + anon → 400");

t.done(); h.restore();

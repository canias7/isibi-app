// Batch 377 — OPPORTUNITY FORECAST CATEGORIES. Sales deals tagged with a forecast category + amount, rolled up
// per category into commit/best-case/pipeline forecasts. One row per ref. Covers upsert, rollup, period filter,
// read one, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 377");
const slug = "b377";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const put = (tok, body) => c.post(`/api/db/${slug}/forecast-categories`, body, { token: tok });

// --- Upsert deals across categories (period Q1) ---
await put(A, { ref: "d1", amount: 1000, category: "commit", period: "Q1", name: "Acme" });
await put(A, { ref: "d2", amount: 2000, category: "best_case", period: "Q1" });
await put(A, { ref: "d3", amount: 5000, category: "pipeline", period: "Q1" });
await put(A, { ref: "d4", amount: 3000, category: "closed", period: "Q1" });
await put(A, { ref: "d5", amount: 9999, category: "omitted", period: "Q1" });

// --- Rollup ---
let r = (await c.get(`/api/db/${slug}/forecast-categories?period=Q1`, { token: A }).then((x) => x.json));
t.eq(r.categories.commit.total_cents, 100000, "commit sums to $1,000");
t.eq(r.categories.commit.count, 1, "…one commit deal");
// commit forecast = commit + closed = 1000 + 3000 = 4000
t.eq(r.forecast.commit_cents, 400000, "commit forecast = commit + closed");
// best_case = commit + closed + best_case = 4000 + 2000 = 6000
t.eq(r.forecast.best_case_cents, 600000, "best-case adds best_case deals");
// pipeline = commit + best_case + pipeline = 1000 + 2000 + 5000 = 8000
t.eq(r.forecast.pipeline_cents, 800000, "pipeline is everything open");
t.eq(r.forecast.closed_cents, 300000, "closed = $3,000");

// --- Upsert changes a deal's category/amount ---
await put(A, { ref: "d3", amount: 5000, category: "commit", period: "Q1" }); // pipeline → commit
r = (await c.get(`/api/db/${slug}/forecast-categories?period=Q1`, { token: A }).then((x) => x.json));
t.eq(r.categories.commit.count, 2, "moving a deal to commit updates in place (upsert)");

// --- Read one ---
t.eq((await c.get(`/api/db/${slug}/forecast-categories/d1`, { token: A }).then((x) => x.json)).opportunity.name, "Acme", "read one deal");
t.eq((await c.get(`/api/db/${slug}/forecast-categories/ghost`, { token: A })).status, 404, "unknown ref → 404");

// --- Period isolation ---
await put(A, { ref: "d9", amount: 500, category: "commit", period: "Q2" });
t.eq((await c.get(`/api/db/${slug}/forecast-categories?period=Q2`, { token: A }).then((x) => x.json)).categories.commit.count, 1, "another period is independent");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/forecast-categories/d9`, { token: A })).json.deleted, true, "admin deletes a deal");
t.eq((await c.get(`/api/db/${slug}/forecast-categories/d9`, { token: A })).status, 404, "…and it's gone");

// --- Validation + authz ---
t.eq((await put(A, { ref: "x", amount: 100, category: "bogus" })).status, 400, "an invalid category → 400");
t.eq((await put(A, { ref: "x", amount: -5, category: "commit" })).status, 400, "a negative amount → 400");
t.eq((await put(A, { ref: "bad ref!", amount: 1, category: "commit" })).status, 400, "an invalid ref → 400");
t.eq((await put(B, { ref: "x", amount: 1, category: "commit" })).status, 403, "a member can't write → 403");
t.eq((await c.get(`/api/db/${slug}/forecast-categories`, { token: B })).status, 403, "a member can't read → 403");
t.eq((await c.post(`/api/db/${slug}/forecast-categories`, { ref: "x", amount: 1, category: "commit" })).status, 401, "signed-out → 401");

t.done(); h.restore();

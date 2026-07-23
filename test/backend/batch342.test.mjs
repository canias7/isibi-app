// Batch 342 — SPLIT AMOUNT. Stateless fair money splitter: equal N-way or weighted, with cents distributed
// so shares sum EXACTLY to the amount. Covers even split, uneven remainder, weighted, exact-sum invariant,
// zero, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 342");
const slug = "b342";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const sp = (body) => c.post(`/api/db/${slug}/split-amount`, body).then((r) => r.json);
const sum = (a) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

// --- Even split ---
let r = await sp({ amount: 100, ways: 4 });
t.eq(r.shares.join(","), "25,25,25,25", "$100 / 4 → four $25 shares");
t.eq(sum(r.shares), 100, "…sums to the total");

// --- Uneven: remainder cents go to the first shares ---
r = await sp({ amount: 100, ways: 3 });
t.eq(sum(r.shares), 100, "$100 / 3 still sums to exactly 100");
t.eq(r.shares[0], 33.34, "…first share carries the extra cent");
t.eq(r.shares[2], 33.33, "…later shares are the base");

// --- 0.10 / 3 → cents fairly distributed ---
r = await sp({ amount: 0.10, ways: 3 });
t.eq(sum(r.shares), 0.10, "10 cents / 3 sums to 0.10");
t.eq(r.shares.join(","), "0.04,0.03,0.03", "…4/3/3 cents");

// --- Weighted split ---
r = await sp({ amount: 100, weights: [1, 1, 2] });
t.eq(sum(r.shares), 100, "weighted split sums to 100");
t.eq(r.shares[2], 50, "…the double weight gets half");
t.eq(r.shares[0], 25, "…others get a quarter each");

// --- Weighted with rounding ---
r = await sp({ amount: 10, weights: [1, 1, 1] });
t.eq(sum(r.shares), 10, "$10 across 3 weights still sums exactly");

// --- Zero amount ---
r = await sp({ amount: 0, ways: 3 });
t.eq(sum(r.shares), 0, "zero splits into zeros");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/split-amount`, { amount: -5, ways: 2 })).status, 400, "a negative amount → 400");
t.eq((await c.post(`/api/db/${slug}/split-amount`, { amount: 10 })).status, 400, "neither ways nor weights → 400");
t.eq((await c.post(`/api/db/${slug}/split-amount`, { amount: 10, weights: [0, 0] })).status, 400, "weights summing to 0 → 400");

t.done(); h.restore();

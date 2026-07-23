// Batch 376 — DISCOUNT STACK. Stateless evaluator: all stackable discounts apply together (percents compound,
// fixed subtract); each non-stackable is considered alone; the result is the lowest price. Money in cents.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 376");
const slug = "b376";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const ds = (body) => c.post(`/api/db/${slug}/discount-stack`, body).then((r) => r.json);

// --- Two stackable percents compound ---
// $100, 10% then 20% stacked → 100 * .9 * .8 = 72
let r = await ds({ price: 100, discounts: [
  { code: "TEN", type: "percent", value: 10, stackable: true },
  { code: "TWENTY", type: "percent", value: 20, stackable: true },
] });
t.eq(r.final_cents, 7200, "two stacked percents compound to $72");
t.eq(r.strategy, "stacked", "…strategy is stacked");
t.eq(r.applied.length, 2, "…both applied");

// --- Fixed + percent stacked ---
// $100, -$15 fixed then 10% → (100-15)*.9 = 76.5
r = await ds({ price: 100, discounts: [
  { code: "MINUS15", type: "fixed", value: 15, stackable: true },
  { code: "TEN", type: "percent", value: 10, stackable: true },
] });
t.eq(r.final_cents, 7650, "fixed then percent stacks to $76.50");

// --- A big non-stackable beats the stacked combo ---
// stacked: 10%+10% = 81; single 50% = 50 → pick 50
r = await ds({ price: 100, discounts: [
  { code: "A", type: "percent", value: 10, stackable: true },
  { code: "B", type: "percent", value: 10, stackable: true },
  { code: "HALF", type: "percent", value: 50, stackable: false },
] });
t.eq(r.final_cents, 5000, "a larger exclusive discount wins over the stack");
t.eq(r.strategy, "single", "…strategy is single");
t.eq(r.applied[0], "HALF", "…the exclusive code is applied");

// --- No discounts → full price ---
r = await ds({ price: 100, discounts: [] });
t.eq(r.final_cents, 10000, "no discounts → full price");
t.eq(r.discount_cents, 0, "…no discount");

// --- Fixed larger than price clamps at 0 ---
t.eq((await ds({ price: 10, discounts: [{ type: "fixed", value: 50, stackable: true }] })).final_cents, 0, "an over-large fixed discount clamps to 0");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/discount-stack`, { price: -1, discounts: [] })).status, 400, "negative price → 400");
t.eq((await c.post(`/api/db/${slug}/discount-stack`, { price: 10, discounts: "x" })).status, 400, "discounts not an array → 400");
t.eq((await c.post(`/api/db/${slug}/discount-stack`, { price: 10, discounts: [{ type: "bogus", value: 1 }] })).status, 400, "a bad discount type → 400");
t.eq((await c.post(`/api/db/${slug}/discount-stack`, { price: 10, discounts: [{ type: "percent", value: 150 }] })).status, 400, "a percent over 100 → 400");

t.done(); h.restore();

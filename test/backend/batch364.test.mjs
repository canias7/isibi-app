// Batch 364 — PRORATION. Stateless subscription-change proration: unused credit from the old plan + prorated
// charge for the new plan over the remaining days → net to charge now (negative = credit). Money in cents.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 364");
const slug = "b364";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const pr = (body) => c.post(`/api/db/${slug}/proration`, body).then((r) => r.json);

// A 30-day period; upgrade at the halfway point (day 15 → 15 remaining).
const base = { period_start: "2026-01-01", period_end: "2026-01-31", change_date: "2026-01-16" };

// --- Upgrade $10 → $30, half the period left ---
let r = await pr({ ...base, old_price: 10, new_price: 30 });
t.eq(r.days_total, 30, "30-day period");
t.eq(r.days_remaining, 15, "15 days remaining");
t.eq(r.unused_credit_cents, 500, "unused old credit = $5.00");
t.eq(r.new_charge_cents, 1500, "prorated new charge = $15.00");
t.eq(r.net_cents, 1000, "net = $10.00 to charge now");

// --- Downgrade nets a credit ---
r = await pr({ ...base, old_price: 30, new_price: 10 });
t.eq(r.net_cents, -1000, "downgrade nets a -$10.00 credit");

// --- New subscription (no old_price) ---
r = await pr({ ...base, new_price: 30 });
t.eq(r.unused_credit_cents, 0, "no old plan → no credit");
t.eq(r.net_cents, 1500, "…just the prorated new charge");

// --- Change at the very start = full charge, none used ---
r = await pr({ ...base, change_date: "2026-01-01", old_price: 10, new_price: 20 });
t.eq(r.days_remaining, 30, "change on day 0 → full period remaining");
t.eq(r.new_charge_cents, 2000, "…full new charge");

// --- Change after period end clamps to 0 remaining ---
r = await pr({ ...base, change_date: "2026-02-15", old_price: 10, new_price: 20 });
t.eq(r.days_remaining, 0, "past the end → 0 remaining");
t.eq(r.net_cents, 0, "…nothing prorated");

// --- Currency passthrough ---
t.eq((await pr({ ...base, new_price: 10, currency: "EUR" })).currency, "EUR", "currency echoes back");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/proration`, { new_price: 10, period_start: "2026-01-31", period_end: "2026-01-01" })).status, 400, "end before start → 400");
t.eq((await c.post(`/api/db/${slug}/proration`, { new_price: "abc", period_start: "2026-01-01", period_end: "2026-01-31" })).status, 400, "non-numeric price → 400");
t.eq((await c.post(`/api/db/${slug}/proration`, { new_price: 10 })).status, 400, "missing period → 400");

t.done(); h.restore();

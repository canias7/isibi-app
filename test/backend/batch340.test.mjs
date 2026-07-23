// Batch 340 — BUSINESS DAYS. Stateless working-day calculator: count business days in a range (skipping
// weekends + holidays), or the date N business days after a start. Covers count, weekend skip, holidays, add
// mode, negative add, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 340");
const slug = "b340";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const bd = (body) => c.post(`/api/db/${slug}/business-days`, body).then((r) => r.json);

// --- Count Mon 2026-01-05 .. Fri 2026-01-09 → 5 business days ---
let r = await bd({ from: "2026-01-05", to: "2026-01-09" });
t.eq(r.business_days, 5, "a full weekday week → 5 business days");
t.eq(r.calendar_days, 5, "…5 calendar days");

// --- Include a weekend: Mon..next Mon (2026-01-05..2026-01-12) → 6 business days, 8 calendar ---
r = await bd({ from: "2026-01-05", to: "2026-01-12" });
t.eq(r.business_days, 6, "a span with a weekend → 6 business days");
t.eq(r.calendar_days, 8, "…8 calendar days");

// --- Holidays are excluded ---
r = await bd({ from: "2026-01-05", to: "2026-01-09", holidays: ["2026-01-07"] });
t.eq(r.business_days, 4, "a holiday in range drops one business day");

// --- Order-independent ---
t.eq((await bd({ from: "2026-01-09", to: "2026-01-05" })).business_days, 5, "reversed dates give the same count");

// --- Add mode: 3 business days after Fri 2026-01-09 → Wed 2026-01-14 ---
r = await bd({ from: "2026-01-09", add: 3 });
t.eq(r.date, "2026-01-14", "3 business days after Friday skips the weekend");

// --- Add with a holiday ---
r = await bd({ from: "2026-01-09", add: 1, holidays: ["2026-01-12"] });
t.eq(r.date, "2026-01-13", "the next business day skips a Monday holiday");

// --- Negative add ---
t.eq((await bd({ from: "2026-01-12", add: -1 })).date, "2026-01-09", "a negative add goes back to Friday");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/business-days`, { from: "nope", to: "2026-01-09" })).status, 400, "a bad from → 400");
t.eq((await c.post(`/api/db/${slug}/business-days`, { from: "2026-01-05" })).status, 400, "neither to nor add → 400");

t.done(); h.restore();

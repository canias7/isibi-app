// Batch 119 — depreciation schedule calculator (straight-line + declining-balance)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 119");
const slug = "b119";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const dep = (body, tok) => c.post(`/api/db/${slug}/finance/depreciation`, body, tok === null ? {} : { token: tok || ADMIN });

// Straight-line: cost 1000, salvage 100, life 3 → 300/period.
let sl = await dep({ cost: 1000, salvage: 100, life: 3 });
t.eq(sl.status, 200, "straight-line → 200");
t.eq(sl.json.method, "straight_line", "method defaults to straight_line");
t.eq(sl.json.total_depreciable, 900, "depreciable = cost − salvage");
t.eq(sl.json.schedule.length, 3, "one row per period");
t.eq(sl.json.schedule.map((r) => r.depreciation), [300, 300, 300], "even 300/period");
t.eq(sl.json.schedule[2].accumulated, 900, "accumulated hits the full depreciable");
t.eq(sl.json.schedule[2].book_value, 100, "book value ends exactly at salvage");

// Rounding residual lands in the final period and still ties out. cost 100, life 3 → 33.33/33.33/33.34.
let rnd = await dep({ cost: 100, life: 3 });
t.eq(rnd.json.schedule.map((r) => r.depreciation), [33.33, 33.33, 33.34], "residual absorbed by the last period");
t.eq(rnd.json.schedule[2].accumulated, 100, "ties out to the cent");
t.eq(rnd.json.schedule[2].book_value, 0, "book ends at 0 (no salvage)");

// Declining-balance (double): cost 1000, salvage 100, life 5, factor 2.
let db = await dep({ cost: 1000, salvage: 100, life: 5, method: "declining_balance" });
t.eq(db.json.method, "declining_balance", "declining_balance method");
t.eq(db.json.schedule[0].depreciation, 400, "yr1 = 40% of 1000");
t.eq(db.json.schedule[1].depreciation, 240, "yr2 = 40% of 600");
t.eq(db.json.schedule[4].book_value, 100, "book still ends at salvage");
t.eq(db.json.schedule.reduce((s, r) => s + r.depreciation, 0), 900, "total depreciation = depreciable");
// declining never dips below salvage mid-schedule
t.ok(db.json.schedule.every((r) => r.book_value >= 100 - 1e-9), "book value never drops below salvage");

// Optional per-period dates.
let dated = await dep({ cost: 120, life: 3, start: "2026-01-15", freq: "month" });
t.eq(dated.json.schedule.map((r) => r.date), ["2026-01-15", "2026-02-15", "2026-03-15"], "monthly dates stamped");

// Validation.
t.eq((await dep({ salvage: 10, life: 3 })).status, 400, "missing cost → 400");
t.eq((await dep({ cost: 100, salvage: 200, life: 3 })).status, 400, "salvage > cost → 400");
t.eq((await dep({ cost: 100, life: 0 })).status, 400, "life 0 → 400");
t.eq((await dep({ cost: 100, life: 5000 })).status, 400, "life over the cap → 400");

// Auth: any signed-in member may use it; signed-out is refused.
t.eq((await dep({ cost: 100, life: 2 }, null)).status, 401, "signed-out → 401");

t.done(); h.restore();

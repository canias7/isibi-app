// Batch 124 — budgets vs actuals: set budget targets per account/period, compare to ledger actuals
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 124");
const slug = "b124";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const classify = (account, type) => c.post(`/api/db/${slug}/ledger/accounts`, { account, type }, { token: ADMIN });
const setBudget = (body, tok) => c.post(`/api/db/${slug}/ledger/budgets`, body, { token: tok || ADMIN });
const entry = (lines) => c.post(`/api/db/${slug}/ledger/entries`, { date: "2026-02-15", lines }, { token: ADMIN });
const report = (q) => c.get(`/api/db/${slug}/ledger/budget-report${q}`, { token: ADMIN });

await classify("revenue", "income"); await classify("rent", "expense"); await classify("salaries", "expense");

// Budget the quarter.
t.eq((await setBudget({ account: "revenue", period: "2026-q1", amount: 30000 })).status, 200, "budget revenue");
await setBudget({ account: "rent", period: "2026-q1", amount: 3000 });
await setBudget({ account: "salaries", period: "2026-q1", amount: 15000 });
// Upsert overwrites.
await setBudget({ account: "salaries", period: "2026-q1", amount: 15000, notes: "3 heads" });
t.eq((await c.get(`/api/db/${slug}/ledger/budgets?period=2026-q1`, { token: ADMIN })).json.budgets.length, 3, "3 budget lines (upsert didn't duplicate)");

// Actuals for the quarter.
await entry([{ account: "cash", debit: 28000 }, { account: "revenue", credit: 28000 }]); // revenue 28000 (under)
await entry([{ account: "rent", debit: 3200 }, { account: "cash", credit: 3200 }]);        // rent 3200 (over)
await entry([{ account: "salaries", debit: 15000 }, { account: "cash", credit: 15000 }]);  // salaries on budget

let r = (await report("?period=2026-q1&from=2026-01-01&to=2026-03-31")).json;
t.eq(r.status || 200, 200, "report ok");
const byAcct = Object.fromEntries(r.lines.map((l) => [l.account, l]));
t.eq(byAcct.revenue.budget, 30000, "revenue budget");
t.eq(byAcct.revenue.actual, 28000, "revenue actual (credit − debit)");
t.eq(byAcct.revenue.variance, -2000, "revenue under by 2000");
t.eq(byAcct.rent.actual, 3200, "rent actual (debit − credit)");
t.eq(byAcct.rent.variance, 200, "rent over by 200");
t.eq(byAcct.rent.pct, 106.7, "rent at 106.7% of budget");
t.eq(byAcct.salaries.variance, 0, "salaries on budget");
t.eq(byAcct.salaries.pct, 100, "salaries at 100%");
// cash (unbudgeted, unclassified) is NOT in a budget report
t.ok(!("cash" in byAcct), "unbudgeted balance-sheet accounts excluded");
// totals
t.eq(r.totals.budget, 48000, "total budget 30000 + 3000 + 15000");
t.eq(r.totals.actual, 46200, "total actual 28000 + 3200 + 15000");
t.eq(r.totals.variance, -1800, "total variance");

// An unbudgeted EXPENSE with activity still surfaces (forgot to budget it).
await entry([{ account: "misc_expense", debit: 500 }, { account: "cash", credit: 500 }]);
await classify("misc_expense", "expense");
let r2 = (await report("?period=2026-q1&from=2026-01-01&to=2026-03-31")).json;
t.ok(r2.lines.some((l) => l.account === "misc_expense" && l.budget === 0 && l.actual === 500), "unbudgeted expense shows with budget 0");

// Guards.
t.eq((await setBudget({ period: "x", amount: 1 })).status, 400, "missing account → 400");
t.eq((await setBudget({ account: "a", amount: 1 })).status, 400, "missing period → 400");
t.eq((await report("?from=2026-01-01")).status, 400, "report without period → 400");
t.eq((await setBudget({ account: "a", period: "p", amount: 1 }, USER)).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/ledger/budget-report?period=x`)).status, 401, "signed-out → 401");

// Delete a budget line.
const bid = (await c.get(`/api/db/${slug}/ledger/budgets?period=2026-q1`, { token: ADMIN })).json.budgets[0].id;
t.eq((await c.del(`/api/db/${slug}/ledger/budgets/${bid}`, { token: ADMIN })).status, 200, "delete a budget line");

t.done(); h.restore();

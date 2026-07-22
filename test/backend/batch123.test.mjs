// Batch 123 — chart of accounts + P&L + balance sheet from the ledger
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 123");
const slug = "b123";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const classify = (account, type, extra) => c.post(`/api/db/${slug}/ledger/accounts`, Object.assign({ account, type }, extra), { token: ADMIN });
const entry = (date, lines) => c.post(`/api/db/${slug}/ledger/entries`, { date, lines }, { token: ADMIN });
const pnl = (q) => c.get(`/api/db/${slug}/ledger/pnl${q || ""}`, { token: ADMIN });
const bs = (q) => c.get(`/api/db/${slug}/ledger/balance-sheet${q || ""}`, { token: ADMIN });

// Chart of accounts.
for (const [a, ty] of [["cash", "asset"], ["ar", "asset"], ["capital", "equity"], ["revenue", "income"], ["rent", "expense"], ["ap", "liability"]])
  t.eq((await classify(a, ty)).status, 200, `classify ${a} as ${ty}`);
t.eq((await classify("bogus", "notatype")).status, 400, "invalid type → 400");
t.eq((await c.post(`/api/db/${slug}/ledger/accounts`, { type: "asset" }, { token: ADMIN })).status, 400, "missing account → 400");
t.ok((await c.get(`/api/db/${slug}/ledger/accounts`, { token: ADMIN })).json.accounts.length === 6, "chart lists 6 accounts");

// The books.
await entry("2026-01-01", [{ account: "cash", debit: 10000 }, { account: "capital", credit: 10000 }]); // owner invests
await entry("2026-02-01", [{ account: "ar", debit: 2000 }, { account: "revenue", credit: 2000 }]);      // sale on credit
await entry("2026-03-01", [{ account: "rent", debit: 500 }, { account: "cash", credit: 500 }]);          // pay rent
await entry("2026-03-15", [{ account: "cash", debit: 2000 }, { account: "ar", credit: 2000 }]);          // collect AR
await entry("2026-03-20", [{ account: "rent", debit: 300 }, { account: "ap", credit: 300 }]);            // accrue rent payable

// P&L (all time).
let p = (await pnl()).json;
t.eq(p.total_income, 2000, "total income 2000");
t.eq(p.total_expenses, 800, "total expenses 800 (500 + 300)");
t.eq(p.net_income, 1200, "net income 1200");
t.ok(p.income.some((x) => x.account === "revenue" && x.amount === 2000), "revenue on the income side");
t.ok(p.expenses.some((x) => x.account === "rent" && x.amount === 800), "rent aggregated on the expense side");

// P&L date-scoped (Feb only → just the sale).
let pFeb = (await pnl("?from=2026-02-01&to=2026-02-28")).json;
t.eq(pFeb.total_income, 2000, "Feb income 2000");
t.eq(pFeb.total_expenses, 0, "Feb expenses 0");

// Balance sheet.
let b = (await bs()).json;
t.eq(b.total_assets, 11500, "assets = cash 11500 (10000 − 500 + 2000)");
t.eq(b.total_liabilities, 300, "liabilities = AP 300");
t.eq(b.total_equity, 10000, "equity = capital 10000");
t.eq(b.retained_earnings, 1200, "current earnings roll in = net income 1200");
t.eq(b.total_liabilities_and_equity, 11500, "L + E + earnings = 11500");
t.ok(b.balanced, "balance sheet balances (A = L + E + earnings)");

// Unclassified account breaks the balance and is surfaced, then classifying fixes it.
await entry("2026-04-01", [{ account: "mystery", debit: 100 }, { account: "cash", credit: 100 }]);
let b2 = (await bs()).json;
t.ok(!b2.balanced, "an unclassified account with activity → not balanced");
t.ok(b2.unclassified.some((u) => u.account === "mystery" && u.amount === 100), "unclassified account surfaced");
await classify("mystery", "asset");
let b3 = (await bs()).json;
t.ok(b3.balanced, "classifying the account restores balance");
t.eq(b3.total_assets, 11500, "assets still 11500 (cash 11400 + mystery 100)");

// Manage the chart.
t.eq((await c.del(`/api/db/${slug}/ledger/accounts/mystery`, { token: ADMIN })).status, 200, "delete a classification");
t.ok(!(await bs()).json.balanced, "removing the classification unbalances again");

// Authz.
t.eq((await classify("x", "asset")).status, 200, "sanity classify");
t.eq((await c.post(`/api/db/${slug}/ledger/accounts`, { account: "y", type: "asset" }, { token: USER })).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/ledger/pnl`)).status, 401, "signed-out → 401");

t.done(); h.restore();

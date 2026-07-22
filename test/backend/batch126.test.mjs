// Batch 126 — leave/PTO balances: accrual/taking ledger, no-overdraw guard, per-employee balances
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 126");
const slug = "b126";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const leave = (body, tok) => c.post(`/api/db/${slug}/leave`, body, { token: tok || ADMIN });
const bal = (employee, type) => c.get(`/api/db/${slug}/leave/balance?employee=${employee}${type ? "&leave_type=" + type : ""}`, { token: ADMIN }).then((r) => r.json.balance);

// Accrue, then take.
let a = await leave({ employee: "alice", days: 20, kind: "accrual" });
t.eq(a.status, 200, "accrual → 200");
t.eq(a.json.balance, 20, "balance 20 after accrual");
t.eq(a.json.kind, "accrual", "positive defaults to accrual");
let tk = await leave({ employee: "alice", days: -5, note: "vacation" });
t.eq(tk.json.kind, "taken", "negative defaults to taken");
t.eq(tk.json.balance, 15, "balance 15 after taking 5");
t.eq(await bal("alice"), 15, "balance endpoint agrees");

// Half-days (fractional).
await leave({ employee: "alice", days: -0.5 });
t.eq(await bal("alice"), 14.5, "half-day taken → 14.5");

// Can't overdraw.
let over = await leave({ employee: "alice", days: -100 });
t.eq(over.status, 409, "overdraw → 409");
t.eq(over.json.code, "balance", "409 carries balance code");
t.eq(await bal("alice"), 14.5, "balance unchanged after refused overdraw");
// unless forced (unpaid/negative leave)
t.eq((await leave({ employee: "alice", days: -20, allowNegative: true })).json.balance, -5.5, "allowNegative permits going negative");

// Separate leave types are tracked independently.
await leave({ employee: "alice", leave_type: "sick", days: 10 });
t.eq(await bal("alice", "sick"), 10, "sick balance separate from annual");
t.eq(await bal("alice"), -5.5, "annual balance unaffected by sick accrual");

// Separate employees.
await leave({ employee: "bob", days: 25 });
t.eq(await bal("bob"), 25, "bob's own balance");

// balances (all employees) + filter by type.
let all = (await c.get(`/api/db/${slug}/leave/balances`, { token: ADMIN })).json;
t.ok(all.balances.some((b) => b.employee === "bob" && b.balance === 25), "balances lists bob");
let sick = (await c.get(`/api/db/${slug}/leave/balances?leave_type=sick`, { token: ADMIN })).json;
t.ok(sick.balances.length === 1 && sick.balances[0].employee === "alice", "type filter narrows balances");

// history
let hist = (await c.get(`/api/db/${slug}/leave?employee=alice&leave_type=annual`, { token: ADMIN })).json;
t.ok(hist.entries.length >= 4 && hist.entries.every((e) => e.employee === "alice"), "history filtered to alice/annual");

// Guards.
t.eq((await leave({ days: 5 })).status, 400, "missing employee → 400");
t.eq((await leave({ employee: "x", days: 0 })).status, 400, "zero days → 400");
t.eq((await c.get(`/api/db/${slug}/leave/balance`, { token: ADMIN })).status, 400, "balance without employee → 400");
t.eq((await leave({ employee: "x", days: 1 }, USER)).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/leave`, { employee: "x", days: 1 })).status, 401, "signed-out → 401");

t.done(); h.restore();

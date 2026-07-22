// Batch 111 — double-entry ledger: balanced posting, balances, trial balance, reversal, multi-ledger
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 111");
const slug = "b111";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const post = (body, tok) => c.post(`/api/db/${slug}/ledger/entries`, body, { token: tok || ADMIN });
const bal = (account, q) => c.get(`/api/db/${slug}/ledger/balance?account=${encodeURIComponent(account)}${q || ""}`, { token: ADMIN });
const tb = (q) => c.get(`/api/db/${slug}/ledger/trial-balance${q || ""}`, { token: ADMIN });

// A balanced entry posts.
let e = await post({ ref: "INV-1", memo: "sale", date: "2026-02-01", lines: [
  { account: "cash", debit: 100 }, { account: "revenue", credit: 100 },
] });
t.eq(e.status, 200, "balanced entry → 200");
t.ok(e.json.ok && e.json.entry.posted === true, "entry is posted");
t.eq(e.json.entry.lines.length, 2, "2 lines returned");
t.eq(e.json.entry.lines[0].debit, 100, "debit decimal preserved");
const E1 = e.json.entry.id;

// Balance invariant + validation failures (nothing posts).
t.ok(/balance/i.test((await post({ lines: [{ account: "a", debit: 100 }, { account: "b", credit: 50 }] })).json.error || ""), "unbalanced → error names balance");
t.eq((await post({ lines: [{ account: "a", debit: 10, credit: 10 }, { account: "b", credit: 10 }] })).status, 400, "amount on both sides → 400");
t.eq((await post({ lines: [{ debit: 10 }, { account: "b", credit: 10 }] })).status, 400, "missing account → 400");
t.eq((await post({ lines: [] })).status, 400, "empty lines → 400");
t.eq((await post({ lines: [{ account: "a", debit: 0 }, { account: "b", credit: 0 }] })).status, 400, "zero-total → 400");

// Authz.
t.eq((await post({ lines: [{ account: "a", debit: 1 }, { account: "b", credit: 1 }] }, USER)).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/ledger/entries`, { lines: [] })).status, 401, "signed-out → 401");

// Balances (posted lines only).
t.eq((await bal("cash")).json.balance, 100, "cash debit balance = 100");
t.eq((await bal("revenue")).json.balance, -100, "revenue credit balance = -100");
t.eq((await bal("cash")).json.debit, 100, "cash debit total");
t.eq((await bal("nonexistent")).json.balance, 0, "unknown account → 0");

// Trial balance is balanced and lists both accounts.
let trial = (await tb()).json;
t.ok(trial.balanced === true, "trial balance balanced");
t.eq(trial.total_debit, trial.total_credit, "Σdebit = Σcredit");
t.eq(trial.accounts.map((a) => a.account).sort(), ["cash", "revenue"], "both accounts present");

// Single GET returns header + lines.
let one = (await c.get(`/api/db/${slug}/ledger/entries/${E1}`, { token: ADMIN })).json;
t.ok(one.ok && one.entry.ref === "INV-1" && one.entry.lines.length === 2, "GET entry by id");

// List shows the entry with its total.
let list = (await c.get(`/api/db/${slug}/ledger/entries`, { token: ADMIN })).json;
t.ok(list.entries.find((x) => x.id === E1 && x.total === 100), "list carries per-entry total");

// Cents precision: 33.33 + 33.34 debit vs 66.67 credit balances exactly.
let cp = await post({ lines: [{ account: "x", debit: 33.33 }, { account: "x", debit: 33.34 }, { account: "y", credit: 66.67 }] });
t.eq(cp.status, 200, "fractional entry balances to the cent");
t.eq((await bal("x")).json.balance, 66.67, "x accumulates 66.67");

// Multi-ledger isolation: post to a separate 'inv' ledger; gl balances unaffected.
await post({ ledger: "inv", lines: [{ account: "stock", debit: 500 }, { account: "grni", credit: 500 }] });
t.eq((await bal("stock", "&ledger=inv")).json.balance, 500, "inv ledger has its own balance");
t.eq((await bal("stock")).json.balance, 0, "gl ledger doesn't see inv's account");

// Reversal: mirrors the entry, links both ways, zeroes the net balance.
let rev = await c.post(`/api/db/${slug}/ledger/entries/${E1}/reverse`, { memo: "oops" }, { token: ADMIN });
t.eq(rev.status, 200, "reverse → 200");
t.ok(rev.json.entry.id !== E1 && rev.json.reverses === E1, "reversal is a new entry linked to the original");
t.eq((await bal("cash")).json.balance, 0, "cash nets to 0 after reversal");
t.ok((await tb()).json.balanced, "still balanced after reversal");
// Original is now marked reversed and can't be reversed twice.
t.eq((await c.get(`/api/db/${slug}/ledger/entries/${E1}`, { token: ADMIN })).json.entry.reversed_by, rev.json.entry.id, "original.reversed_by set");
t.eq((await c.post(`/api/db/${slug}/ledger/entries/${E1}/reverse`, {}, { token: ADMIN })).status, 409, "double reversal → 409");
t.eq((await c.post(`/api/db/${slug}/ledger/entries/9999/reverse`, {}, { token: ADMIN })).status, 404, "reverse missing entry → 404");

t.done(); h.restore();

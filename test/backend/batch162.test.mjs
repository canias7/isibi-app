// Batch 162 — ADVERSARIAL: money & inventory atomic-guard BOUNDARIES. A cent/unit over the line must
// be refused; exactly on the line must pass; and the guarded ledger invariants must never be violated.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 162");
const slug = "b162";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2

// ── Ledger: balance invariant + immutability ─────────────────────────────────────────
const entry = (body) => c.post(`/api/db/${slug}/ledger/entries`, body, { token: ADMIN });
// A one-cent-out entry is refused.
t.eq((await entry({ lines: [{ account: "cash", debit: 100.01 }, { account: "rev", credit: 100 }] })).status, 400, "an entry out of balance by 1¢ is refused");
// Exactly balanced, multi-line, posts.
let e = await entry({ lines: [{ account: "cash", debit: 100 }, { account: "rev", credit: 60 }, { account: "tax", credit: 40 }] });
t.eq(e.status, 200, "a balanced 3-line entry posts");
// A zero-total entry (all zero) is refused (nothing to post).
t.ok((await entry({ lines: [{ account: "cash", debit: 0 }, { account: "rev", credit: 0 }] })).status >= 400, "an all-zero entry is refused");
// Reversing a reversal is blocked (double-reverse → 409).
const eid = e.json.entry.id;
t.eq((await c.post(`/api/db/${slug}/ledger/entries/${eid}/reverse`, {}, { token: ADMIN })).status, 200, "first reversal ok");
t.eq((await c.post(`/api/db/${slug}/ledger/entries/${eid}/reverse`, {}, { token: ADMIN })).status, 409, "double-reversing the same entry → 409");
// Trial balance always balances (posted debits == credits), even after the reversal.
let trial = (await c.get(`/api/db/${slug}/ledger/trial-balance`, { token: ADMIN })).json;
t.ok(trial.balanced === true && Math.abs(trial.total_debit - trial.total_credit) < 0.005, "trial balance stays balanced to the cent");

// ── Wallet: no-overdraw boundary ─────────────────────────────────────────────────────
const wal = (body) => c.post(`/api/db/${slug}/wallet`, body, { token: ADMIN });
await wal({ account: "u2", amount: 50 });                     // credit 50
t.eq((await wal({ account: "u2", amount: -50 })).status, 200, "debit EXACTLY to zero is allowed");
t.eq((await wal({ account: "u2", amount: -1 })).status, 409, "debiting past zero (overdraw) → 409");
await wal({ account: "u2", amount: 100 });
t.eq((await wal({ account: "u2", amount: -100.01 })).status, 409, "overdraw by 1¢ → 409");
t.eq((await c.get(`/api/db/${slug}/wallet/balance?account=u2`, { token: ADMIN })).json.balance, 100, "balance intact after refused overdrafts");
// A transfer that would overdraw the source is refused (and moves nothing).
await wal({ account: "src", amount: 30 });
t.eq((await c.post(`/api/db/${slug}/wallet/transfer`, { from: "src", to: "dst", amount: 31 }, { token: ADMIN })).status, 409, "transfer over the source balance → 409");
t.eq((await c.get(`/api/db/${slug}/wallet/balance?account=src`, { token: ADMIN })).json.balance, 30, "source untouched after the refused transfer");

// ── Stock: no-negative boundary + reservation oversell ───────────────────────────────
const move = (body) => c.post(`/api/db/${slug}/stock/moves`, body, { token: ADMIN });
const reserve = (body) => c.post(`/api/db/${slug}/stock/reserve`, body, { token: ADMIN });
await move({ item: "sku1", qty: 10 });
t.eq((await move({ item: "sku1", qty: -10 })).status, 200, "issue EXACTLY to zero is allowed");
t.eq((await move({ item: "sku1", qty: -1 })).status, 409, "issuing past zero → 409");
await move({ item: "sku2", qty: 5 });
t.eq((await reserve({ item: "sku2", qty: 5 })).status, 200, "reserve EXACTLY the available qty is allowed");
t.eq((await reserve({ item: "sku2", qty: 1 })).status, 409, "reserving beyond available (oversell) → 409");
t.eq((await c.get(`/api/db/${slug}/stock/level?item=sku2`, { token: ADMIN })).json.available, 0, "available is 0 after fully reserving (not negative)");

// ── Promotions: usage cap boundary ───────────────────────────────────────────────────
const redeem = (code, body) => c.post(`/api/db/${slug}/promotions/${code}/redeem`, body, { token: ADMIN });
await c.post(`/api/db/${slug}/promotions`, { code: "LIM2", kind: "percent", value: 10, max_uses: 2 }, { token: ADMIN });
t.eq((await redeem("LIM2", { order_total: 100, order_ref: "o1" })).status, 200, "redemption 1 of 2 ok");
t.eq((await redeem("LIM2", { order_total: 100, order_ref: "o2" })).status, 200, "redemption 2 of 2 ok");
let third = await redeem("LIM2", { order_total: 100, order_ref: "o3" });
t.ok(third.status >= 400, "the 3rd redemption past the cap is refused");

t.done(); h.restore();

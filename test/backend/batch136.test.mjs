// Batch 136 — wallet / points / store credit: guarded balance, transfer, multi-currency, ownership
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 136");
const slug = "b136";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2 (account "2")
const post = (body, tok) => c.post(`/api/db/${slug}/wallet`, body, { token: tok || ADMIN });
const bal = (account, cur, tok) => c.get(`/api/db/${slug}/wallet/balance?account=${account}${cur ? "&currency=" + cur : ""}`, { token: tok || ADMIN }).then((r) => r.json.balance);

// Credit points, then debit (spend).
let cr = await post({ account: "2", amount: 100 });
t.eq(cr.status, 200, "credit → 200");
t.eq(cr.json.balance, 100, "balance 100 after credit");
t.eq(cr.json.kind, "credit", "positive defaults to credit");
let db = await post({ account: "2", amount: -30 });
t.eq(db.json.balance, 70, "balance 70 after spending 30");
t.eq(db.json.kind, "debit", "negative defaults to debit");
// An explicit kind is preserved (on a throwaway account so it doesn't shift "2").
t.eq((await post({ account: "kindcheck", amount: 5, kind: "signup_bonus" })).json.kind, "signup_bonus", "explicit kind preserved");

// Can't overdraw.
let over = await post({ account: "2", amount: -1000 });
t.eq(over.status, 409, "overdraw → 409");
t.eq(over.json.code, "balance", "409 code balance");
t.eq(await bal("2"), 70, "balance unchanged after refused overdraw");
// allowNegative permits it (e.g. an adjustment).
t.eq((await post({ account: "2", amount: -100, allowNegative: true })).json.balance, -30, "allowNegative goes negative");

// Fractional amounts (e.g. cash-back credit).
await post({ account: "3", currency: "credit", amount: 12.5 });
t.eq(await bal("3", "credit"), 12.5, "fractional store credit");

// Currencies are independent (points vs credit vs a gift card).
await post({ account: "2", currency: "credit", amount: 50 });
t.eq(await bal("2", "points"), -30, "points balance");
t.eq(await bal("2", "credit"), 50, "credit balance separate");
// gift card = an account keyed by the card code.
await post({ account: "GIFT-ABC", currency: "giftcard", amount: 25 });
t.eq(await bal("GIFT-ABC", "giftcard"), 25, "gift card balance by code");

// Transfer moves balance between accounts (guarded on the sender).
await post({ account: "sender", amount: 40 });
let tr = await c.post(`/api/db/${slug}/wallet/transfer`, { from: "sender", to: "receiver", amount: 15 }, { token: ADMIN });
t.eq(tr.status, 200, "transfer → 200");
t.eq(await bal("sender"), 25, "sender down 15");
t.eq(await bal("receiver"), 15, "receiver up 15");
t.eq((await c.post(`/api/db/${slug}/wallet/transfer`, { from: "sender", to: "receiver", amount: 999 }, { token: ADMIN })).status, 409, "over-transfer → 409");

// Ownership: a member reads their OWN balance/history but can't write or read others.
t.eq((await c.get(`/api/db/${slug}/wallet/balance?account=2`, { token: A })).json.balance, -30, "member reads own balance");
t.eq((await c.get(`/api/db/${slug}/wallet/balance?account=3`, { token: A })).status, 403, "member can't read another account");
t.eq((await post({ account: "2", amount: 5 }, A)).status, 403, "member can't credit (writes are admin)");
t.ok((await c.get(`/api/db/${slug}/wallet?account=2`, { token: A })).json.entries.length >= 2, "member reads own history");

// Admin views everyone's balances.
let all = (await c.get(`/api/db/${slug}/wallet/balances?currency=points`, { token: ADMIN })).json.balances;
t.ok(all.some((b) => b.account === "receiver" && b.balance === 15), "balances report lists accounts");
t.eq((await c.get(`/api/db/${slug}/wallet/balances`, { token: A })).status, 403, "member can't list all balances");

// Guards.
t.eq((await post({ amount: 5 })).status, 400, "missing account → 400");
t.eq((await post({ account: "x", amount: 0 })).status, 400, "zero amount → 400");
t.eq((await c.post(`/api/db/${slug}/wallet`, { account: "x", amount: 5 })).status, 401, "signed-out → 401");

t.done(); h.restore();

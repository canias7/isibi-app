// Batch 116 — document→ledger posting: turn an invoice/bill into a balanced journal entry (idempotent)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 116");
const slug = "b116";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const mkDoc = (body) => c.post(`/api/db/${slug}/documents`, body, { token: ADMIN });
const post = (id, body) => c.post(`/api/db/${slug}/documents/${id}/post`, body, { token: ADMIN });
const bal = (a) => c.get(`/api/db/${slug}/ledger/balance?account=${a}`, { token: ADMIN }).then((r) => r.json.balance);

// An invoice: subtotal 200, tax 20 (10%), total 220.
let inv = await mkDoc({ type: "invoice", party: "Acme", date: "2026-04-01", lines: [{ description: "widgets", qty: 2, unit_price: 100, tax_rate: 10 }] });
const INV = inv.json.doc.id;
t.eq(inv.json.doc.total, 220, "invoice total 220");
t.eq(inv.json.doc.ledger_entry_id, null, "not yet posted");

// Post it: Dr A/R (total) 220, Cr Revenue (subtotal) 200, Cr Tax (tax) 20.
let p = await post(INV, { total_account: "accounts_receivable", base_account: "revenue", tax_account: "tax_payable" });
t.eq(p.status, 200, "post invoice → 200");
t.ok(p.json.entry && p.json.entry.posted, "a posted ledger entry is returned");
t.eq(p.json.entry.lines.length, 3, "three lines (total, base, tax)");
t.eq(await bal("accounts_receivable"), 220, "A/R debited the full total");
t.eq(await bal("revenue"), -200, "Revenue credited the subtotal");
t.eq(await bal("tax_payable"), -20, "Tax credited the tax");
// the entry ref/memo tie back to the document
t.eq(p.json.entry.ref, inv.json.doc.number, "ledger entry ref = document number");
// document now carries the entry id
t.eq((await c.get(`/api/db/${slug}/documents/${INV}`, { token: ADMIN })).json.doc.ledger_entry_id, p.json.entry.id, "document links its ledger entry");

// Idempotent: re-posting the same doc is refused.
let again = await post(INV, { total_account: "accounts_receivable", base_account: "revenue", tax_account: "tax_payable" });
t.eq(again.status, 409, "re-post → 409");
t.eq(again.json.code, "posted", "409 carries posted code");

// A purchase bill posts the mirror image: total on CREDIT (A/P), base+tax on DEBIT.
let bill = await mkDoc({ type: "bill", lines: [{ description: "supplies", qty: 1, unit_price: 300, tax_rate: 10 }] }); // sub 300 tax 30 total 330
let pb = await post(bill.json.doc.id, { total_account: "accounts_payable", base_account: "expenses", tax_account: "tax_receivable", total_side: "credit" });
t.eq(pb.status, 200, "post bill → 200");
t.eq(await bal("accounts_payable"), -330, "A/P credited the total");
t.eq(await bal("expenses"), 300, "Expense debited the subtotal");
t.eq(await bal("tax_receivable"), 30, "input tax debited");

// A tax-free document doesn't need a tax account.
let noTax = await mkDoc({ type: "invoice", lines: [{ qty: 1, unit_price: 50 }] });
t.eq((await post(noTax.json.doc.id, { total_account: "ar", base_account: "revenue" })).status, 200, "no-tax doc posts without tax_account");
// but a taxed doc without a tax account is rejected
let taxed = await mkDoc({ type: "invoice", lines: [{ qty: 1, unit_price: 50, tax_rate: 20 }] });
t.eq((await post(taxed.json.doc.id, { total_account: "ar", base_account: "revenue" })).status, 400, "taxed doc without tax_account → 400");

// Posting respects the period lock.
await c.post(`/api/db/${slug}/periods/close`, { through: "2026-12-31" }, { token: ADMIN });
let locked = await mkDoc({ type: "invoice", date: "2026-05-01", lines: [{ qty: 1, unit_price: 10 }] });
t.eq((await post(locked.json.doc.id, { total_account: "ar", base_account: "revenue" })).status, 409, "posting into a closed period → 409");
await c.post(`/api/db/${slug}/periods/reopen`, {}, { token: ADMIN });

// Guards.
t.eq((await post(INV, { base_account: "revenue" })).status, 409, "already-posted short-circuits before validation");
let g = await mkDoc({ type: "invoice", lines: [{ qty: 1, unit_price: 10 }] });
t.eq((await post(g.json.doc.id, { base_account: "revenue" })).status, 400, "missing total_account → 400");
t.eq((await c.post(`/api/db/${slug}/documents/${g.json.doc.id}/post`, { total_account: "a", base_account: "b" }, { token: USER })).status, 403, "non-admin → 403");
t.eq((await post(99999, { total_account: "a", base_account: "b" })).status, 404, "missing doc → 404");

t.done(); h.restore();

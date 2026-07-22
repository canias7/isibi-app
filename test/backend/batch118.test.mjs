// Batch 118 — recurring journals: saved balanced templates posted on demand
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 118");
const slug = "b118";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const tpl = (body, tok) => c.post(`/api/db/${slug}/ledger/templates`, body, { token: tok || ADMIN });
const fire = (id, body) => c.post(`/api/db/${slug}/ledger/templates/${id}/post`, body || {}, { token: ADMIN });
const bal = (a) => c.get(`/api/db/${slug}/ledger/balance?account=${a}`, { token: ADMIN }).then((r) => r.json.balance);

// Create a balanced template.
let r = await tpl({ name: "monthly-rent", memo: "Office rent", lines: [
  { account: "rent_expense", debit: 2000 }, { account: "cash", credit: 2000 },
] });
t.eq(r.status, 200, "create template → 200");
const TID = r.json.id;

// Validation: unbalanced template + missing name are refused at create time.
t.eq((await tpl({ name: "bad", lines: [{ account: "a", debit: 5 }, { account: "b", credit: 3 }] })).status, 400, "unbalanced template → 400");
t.eq((await tpl({ lines: [{ account: "a", debit: 1 }, { account: "b", credit: 1 }] })).status, 400, "missing name → 400");

// List + fetch.
t.ok((await c.get(`/api/db/${slug}/ledger/templates`, { token: ADMIN })).json.templates.some((x) => x.id === TID), "template listed");
let got = (await c.get(`/api/db/${slug}/ledger/templates/${TID}`, { token: ADMIN })).json;
t.eq(got.template.lines.length, 2, "fetch returns the stored lines");

// Fire it → a ledger entry appears; fire again → cumulative.
let f1 = await fire(TID, { date: "2026-05-01" });
t.eq(f1.status, 200, "post template → 200");
t.ok(f1.json.entry && f1.json.entry.posted, "a posted entry is returned");
t.eq(await bal("rent_expense"), 2000, "rent debited 2000");
t.eq(await bal("cash"), -2000, "cash credited 2000");
await fire(TID, { date: "2026-06-01" });
t.eq(await bal("rent_expense"), 4000, "second posting accumulates → 4000");

// Respects the period lock.
await c.post(`/api/db/${slug}/periods/close`, { through: "2026-06-30" }, { token: ADMIN });
t.eq((await fire(TID, { date: "2026-06-15" })).status, 409, "posting a template into a closed period → 409");
t.eq((await fire(TID, { date: "2026-07-15" })).status, 200, "posting into an open period → 200");

// Authz.
t.eq((await tpl({ name: "x", lines: [{ account: "a", debit: 1 }, { account: "b", credit: 1 }] }, USER)).status, 403, "non-admin create → 403");
t.eq((await c.post(`/api/db/${slug}/ledger/templates`, { name: "x", lines: [] })).status, 401, "signed-out → 401");

// Delete → then posting a deleted template 404s.
t.eq((await c.del(`/api/db/${slug}/ledger/templates/${TID}`, { token: ADMIN })).status, 200, "delete template → 200");
t.eq((await fire(TID, {})).status, 404, "posting a deleted template → 404");

t.done(); h.restore();

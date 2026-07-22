// Batch 125 — tax summary: output tax (sales) vs input tax (purchases) by rate over a period
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 125");
const slug = "b125";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const mk = (type, lines, extra) => c.post(`/api/db/${slug}/documents`, Object.assign({ type, status: "sent", lines }, extra), { token: ADMIN });
const summary = (q) => c.get(`/api/db/${slug}/documents/tax-summary${q || ""}`, { token: ADMIN });

// Sales invoices: 1000 @ 20% (tax 200) and 500 @ 10% (tax 50).
await mk("invoice", [{ qty: 1, unit_price: 1000, tax_rate: 20 }], { date: "2026-02-10" });
await mk("invoice", [{ qty: 1, unit_price: 500, tax_rate: 10 }], { date: "2026-02-15" });
// Purchase bills: 800 @ 20% (input tax 160).
await mk("bill", [{ qty: 1, unit_price: 800, tax_rate: 20 }], { date: "2026-02-12" });
// A draft invoice must NOT count.
await mk("invoice", [{ qty: 1, unit_price: 9999, tax_rate: 20 }], { date: "2026-02-20", status: "draft" });

let s = (await summary("?from=2026-02-01&to=2026-02-28")).json;
t.eq(s.status || 200, 200, "summary ok");
// Output (sales) tax by rate.
const out20 = s.output.by_rate.find((r) => r.rate === 20);
const out10 = s.output.by_rate.find((r) => r.rate === 10);
t.eq(out20.base, 1000, "20% sales base 1000");
t.eq(out20.tax, 200, "20% output tax 200");
t.eq(out10.tax, 50, "10% output tax 50");
t.eq(s.output.total_tax, 250, "total output tax 250");
t.eq(s.output.total_base, 1500, "total sales base 1500 (draft excluded)");
// Input (purchase) tax.
t.eq(s.input.total_tax, 160, "input tax 160 from the bill");
t.eq(s.input.by_rate.find((r) => r.rate === 20).base, 800, "purchase base 800");
// Net tax due = output − input.
t.eq(s.net_tax, 90, "net tax payable = 250 − 160 = 90");

// Date filter excludes out-of-range docs.
await mk("invoice", [{ qty: 1, unit_price: 1000, tax_rate: 20 }], { date: "2026-05-01" });
let mayOut = (await summary("?from=2026-02-01&to=2026-02-28")).json;
t.eq(mayOut.output.total_tax, 250, "May invoice excluded by the Feb window");
let all = (await summary()).json;
t.eq(all.output.total_tax, 450, "no window → all sales tax (250 + 200)");

// Custom type mapping: treat 'sale' + 'pos' as sales.
await mk("pos", [{ qty: 1, unit_price: 100, tax_rate: 20 }], { date: "2026-02-05" });
let custom = (await summary("?from=2026-02-01&to=2026-02-28&sales_types=invoice,pos")).json;
t.eq(custom.output.by_rate.find((r) => r.rate === 20).tax, 220, "pos folded into 20% output (200 + 20)");

// Authz.
t.eq((await c.get(`/api/db/${slug}/documents/tax-summary`, { token: USER })).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/documents/tax-summary`)).status, 401, "signed-out → 401");

t.done(); h.restore();

// Batch 71 — cross-table reporting (group by a column on the referenced parent:
// `?group=account_id.industry` → pipeline grouped by each opportunity's account's industry)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 71");
const slug = "b71";
await c.ensure(slug);
await c.schema(slug, { tables: {
  accounts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "industry", type: "text" }] },
  opportunities: { access: "admin", columns: [
    { name: "title", type: "text" },
    { name: "amount", type: "integer" },
    { name: "stage", type: "text" },
    { name: "account_id", type: "integer", ref: "accounts" },
  ] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
// three accounts across two industries
await c.post(`/api/db/${slug}/rows/accounts`, { name: "Acme", industry: "manufacturing" }, { token: ADMIN }); // id 1
await c.post(`/api/db/${slug}/rows/accounts`, { name: "Globex", industry: "manufacturing" }, { token: ADMIN }); // id 2
await c.post(`/api/db/${slug}/rows/accounts`, { name: "Initech", industry: "software" }, { token: ADMIN }); // id 3
// opportunities pointing at those accounts
await c.post(`/api/db/${slug}/rows/opportunities`, { title: "A1", amount: 1000, stage: "won", account_id: 1 }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/opportunities`, { title: "A2", amount: 2000, stage: "open", account_id: 1 }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/opportunities`, { title: "G1", amount: 3000, stage: "won", account_id: 2 }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/opportunities`, { title: "I1", amount: 5000, stage: "won", account_id: 3 }, { token: ADMIN });

// cross-table group: pipeline value by the account's INDUSTRY
let s = await c.get(`/api/db/${slug}/rows/opportunities/stats?group=account_id.industry&sum=amount`, { token: ADMIN });
t.ok(s.json.ok, "cross-table stats ok");
t.eq(s.json.group, "account_id.industry", "group echoes the cross token");
const byInd = {}; for (const g of s.json.groups) byInd[g.value] = g;
t.eq(byInd.manufacturing.count, 3, "manufacturing has 3 opps (Acme 2 + Globex 1)");
t.eq(byInd.manufacturing.sum.amount, 6000, "manufacturing pipeline = 1000+2000+3000");
t.eq(byInd.software.count, 1, "software has 1 opp (Initech)");
t.eq(byInd.software.sum.amount, 5000, "software pipeline = 5000");

// the base filter still applies over the CHILD table before the join (won-only)
let w = await c.get(`/api/db/${slug}/rows/opportunities/stats?group=account_id.industry&sum=amount&where=stage:eq:won`, { token: ADMIN });
const won = {}; for (const g of w.json.groups) won[g.value] = g;
t.eq(won.manufacturing.count, 2, "won-only: manufacturing 2 (A1 + G1)");
t.eq(won.manufacturing.sum.amount, 4000, "won-only manufacturing = 1000+3000");
t.eq(won.software.sum.amount, 5000, "won-only software = 5000");

// unknown fk falls back to a plain (non-cross) group → no crash, groups on nothing valid
let bad = await c.get(`/api/db/${slug}/rows/opportunities/stats?group=nope.industry&sum=amount`, { token: ADMIN });
t.ok(bad.json.ok, "unknown fk token doesn't 500 (falls back)");

// a parent column that doesn't exist falls back safely too
let bad2 = await c.get(`/api/db/${slug}/rows/opportunities/stats?group=account_id.ghostcol&sum=amount`, { token: ADMIN });
t.ok(bad2.json.ok, "unknown parent column doesn't 500 (falls back)");

// plain single-dim group still works (regression)
let plain = await c.get(`/api/db/${slug}/rows/opportunities/stats?group=stage&sum=amount`, { token: ADMIN });
t.ok(plain.json.ok && plain.json.group === "stage", "plain group still works");

t.done(); h.restore();

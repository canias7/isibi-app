// Batch 88 — expression aggregates in stats: sum/avg over a SQL arithmetic expression
// (weighted pipeline forecast = sum(amount*probability/100)), + groupSort/having by the alias.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 88");
const slug = "b88";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: { access: "admin", columns: [{ name: "amount", type: "integer" }, { name: "probability", type: "integer" }, { name: "rep", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
for (const d of [
  { amount: 1000, probability: 50, rep: "X" }, // weighted 500
  { amount: 2000, probability: 25, rep: "X" }, // weighted 500
  { amount: 4000, probability: 100, rep: "Y" }, // weighted 4000
]) await c.post(`/api/db/${slug}/rows/deals`, d, { token: ADMIN });
const stats = async (q) => (await c.get(`/api/db/${slug}/rows/deals/stats?${q}`, { token: ADMIN })).json;

// raw product and the /100 weighted forecast
t.eq((await stats("sum=wp:amount*probability")).sum.wp, 500000, "sum of amount*probability");
t.eq((await stats("sum=weighted:amount*probability/100")).sum.weighted, 5000, "weighted pipeline = sum(amount*probability/100)");

// plain col aggregate alongside an expression aggregate
let both = await stats("sum=amount&sum=weighted:amount*probability/100");
t.eq(both.sum.amount, 7000, "plain amount sum still works");
t.eq(both.sum.weighted, 5000, "expression aggregate alongside it");

// grouped by rep
let g = await stats("group=rep&sum=weighted:amount*probability/100");
const byRep = {}; for (const row of g.groups) byRep[row.value] = row.sum.weighted;
t.eq(byRep.X, 1000, "rep X weighted = 500+500");
t.eq(byRep.Y, 4000, "rep Y weighted = 4000");

// avg over an expression
let a = await stats("avg=aw:amount*probability/100");
t.eq(Math.round(a.avg.aw), 1667, "avg weighted = (500+500+4000)/3 ≈ 1667");

// groupSort by the expression alias (leaderboard by weighted pipeline)
let gs = await stats("group=rep&sum=weighted:amount*probability/100&groupSort=sum:weighted&groupOrder=desc");
t.eq(gs.groups.map((r) => r.value), ["Y", "X"], "sort groups by the expression alias, desc");

// HAVING by the expression alias
let hv = await stats("group=rep&sum=weighted:amount*probability/100&having=sum:weighted:gt:3000");
t.eq(hv.groups.map((r) => r.value), ["Y"], "having on the expression alias keeps only Y (4000)");

// parens supported
t.eq((await stats("sum=g:(amount%2Bprobability)")).sum.g, 7175, "parenthesized expression (amount+probability)");

// malformed / unknown-column expressions are ignored (no key), not errors
let bad = await stats("sum=bad:amount*ghostcol&sum=amount");
t.ok(bad.ok && bad.sum.bad === undefined && bad.sum.amount === 7000, "unknown-column expr ignored, valid agg still returned");
let mal = await stats("sum=m:amount**2&sum=amount");
t.ok(mal.ok && mal.sum.m === undefined, "malformed expr ignored (no crash)");

// time-bucket path also supports expression aggregates
let plain = await stats("sum=weighted:amount*probability/100&group=rep&groupSort=value&groupOrder=asc");
t.eq(plain.groups.map((r) => r.value), ["X", "Y"], "regression: grouped expression + value sort");

t.done(); h.restore();

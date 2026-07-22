// Batch 63 — multi-dimensional reporting (stats ?group=col1,col2 + aggregations)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 63");
const slug = "b63";
await c.ensure(slug);
await c.schema(slug, { tables: { opps: { access: "feed", columns: [
  { name: "stage", type: "text" }, { name: "rep", type: "text" }, { name: "amount", type: "integer" } ] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const mk = (stage, rep, amount) => c.post(`/api/db/${slug}/rows/opps`, { stage, rep, amount }, { token: A });
await mk("proposal", "sam", 100); await mk("proposal", "sam", 50); await mk("proposal", "kim", 200);
await mk("won", "sam", 300); await mk("won", "kim", 400);

// single-dim (existing): pipeline by stage
let s1 = await c.get(`/api/db/${slug}/rows/opps/stats?group=stage&sum=amount`);
t.ok(s1.json.ok && s1.json.group === "stage", "single-dim group=stage ok");
const byStage = Object.fromEntries(s1.json.groups.map((g) => [g.value, g.sum.amount]));
t.eq(byStage.proposal, 350, "proposal sum=350 (100+50+200)");
t.eq(byStage.won, 700, "won sum=700 (300+400)");

// multi-dim (NEW): stage × rep matrix
let s2 = await c.get(`/api/db/${slug}/rows/opps/stats?group=stage,rep&sum=amount&avg=amount`);
t.ok(s2.json.ok && JSON.stringify(s2.json.groupBy) === '["stage","rep"]', "multi-dim groupBy=[stage,rep]");
const cell = (st, rp) => s2.json.groups.find((g) => g.stage === st && g.rep === rp);
t.ok(!!cell("proposal", "sam"), "cell proposal/sam exists");
t.eq(cell("proposal", "sam").sum.amount, 150, "proposal/sam sum=150 (100+50)");
t.eq(cell("proposal", "sam").count, 2, "proposal/sam count=2");
t.eq(cell("proposal", "kim").sum.amount, 200, "proposal/kim sum=200");
t.eq(cell("won", "kim").sum.amount, 400, "won/kim sum=400");
t.eq(s2.json.groups.length, 4, "4 non-empty stage×rep cells");

// with a where filter (report respects filters)
let s3 = await c.get(`/api/db/${slug}/rows/opps/stats?group=rep&sum=amount&where=stage:eq:won`);
t.eq(Object.fromEntries(s3.json.groups.map(g=>[g.value,g.sum.amount])).sam, 300, "filtered report: sam won=300");

t.done(); h.restore();

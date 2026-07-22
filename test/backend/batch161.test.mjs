// Batch 161 — ADVERSARIAL: does team-scoped data leak through SECONDARY read paths? A member of one
// team must not learn about another team's rows via stats (COUNT/SUM), the /count endpoint, facets,
// or the raw list total. Probes every aggregate surface for cross-team leakage.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 161");
const slug = "b161";
await c.ensure(slug);
await c.schema(slug, { tables: { deals: { access: "user", teamScope: true, columns: [{ name: "title", type: "text" }, { name: "amount", type: "number" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const mk = (tok, title, amount, team_id) => c.post(`/api/db/${slug}/rows/deals`, { title, amount, team_id }, { token: tok });

// Team 1 = {A, B}. Team 2 = {A} only.
const t1 = (await c.post(`/api/db/${slug}/teams`, { name: "T1" }, { token: A })).json.id;
await c.post(`/api/db/${slug}/teams/${t1}/members`, { user: 2 }, { token: A });
const t2 = (await c.post(`/api/db/${slug}/teams`, { name: "T2" }, { token: A })).json.id;

// Team 1: 2 deals worth 100 + 200. Team 2: 1 big deal worth 9999 (B must never see/measure it).
await mk(A, "d1", 100, t1);
await mk(B, "d2", 200, t1);
await mk(A, "secret-big", 9999, t2);

// --- List total: B sees only their team's 2 rows ---
let bl = (await c.get(`/api/db/${slug}/rows/deals`, { token: B })).json;
t.eq(bl.total, 2, "list total for B = 2 (team 1 only, not the 3 total)");
t.ok(!bl.rows.some((r) => r.title === "secret-big"), "the team-2 deal isn't in B's list");

// --- Stats (COUNT + SUM) must be team-scoped (sum is keyed by column: {amount: N}) ---
let bstats = (await c.get(`/api/db/${slug}/rows/deals/stats?sum=amount`, { token: B })).json;
t.eq(bstats.count, 2, "stats COUNT for B = 2 (not 3)");
t.eq(bstats.sum.amount, 300, "stats SUM(amount) for B = 300 (100+200), NOT 10299 — the 9999 doesn't leak");

// A is in both teams → A sees all 3 / sums 10299.
let astats = (await c.get(`/api/db/${slug}/rows/deals/stats?sum=amount`, { token: A })).json;
t.eq(astats.count, 3, "A (both teams) counts all 3");
t.eq(astats.sum.amount, 10299, "A sums all 3");

// --- Group-by stats can't reveal another team's grouped values ---
let bg = (await c.get(`/api/db/${slug}/rows/deals/stats?group=title`, { token: B })).json;
const groupedTitles = (bg.groups || []).map((g) => g.value || g.title);
t.ok(!groupedTitles.includes("secret-big"), "group-by stats don't expose the team-2 row's value");

// --- A member in NO team measures nothing (fails closed on aggregates too) ---
const LONE = (await c.signup(slug, "lone@x.dev", "Str0ng-pass-9")).json.token; // id3, no team
let ls = (await c.get(`/api/db/${slug}/rows/deals/stats?sum=amount`, { token: LONE })).json;
t.eq(ls.count, 0, "a no-team member counts 0 rows");
t.ok(ls.sum == null || ls.sum.amount == null || ls.sum.amount === 0, "…and sums to nothing");

t.done(); h.restore();

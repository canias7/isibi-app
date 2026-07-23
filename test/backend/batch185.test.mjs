// Batch 185 — FUNDRAISING / GOAL PROGRESS. Admin sets a goal + target; members contribute amounts that
// sum toward it (cents-exact, append-only, over-funding allowed); public sees raised + progress %;
// per-contributor amounts are admin-only. Covers the math, contributors count, validation, and guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 185");
const slug = "b185";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const create = (tok, goal, body) => c.post(`/api/db/${slug}/goals/${goal}`, body, tok === null ? {} : { token: tok });
const info = (tok, goal) => c.get(`/api/db/${slug}/goals/${goal}`, tok === null ? {} : { token: tok }).then((r) => r.json);
const contribute = (tok, goal, body) => c.post(`/api/db/${slug}/goals/${goal}/contribute`, body, tok === null ? {} : { token: tok });
const contribs = (tok, goal) => c.get(`/api/db/${slug}/goals/${goal}/contributions`, { token: tok });
const listAll = (tok) => c.get(`/api/db/${slug}/goals`, tok === null ? {} : { token: tok }).then((r) => r.json.goals);
const del = (tok, goal) => c.del(`/api/db/${slug}/goals/${goal}`, { token: tok });

// --- Create + contribute ---
t.eq((await create(A, "camp", { title: "Summer Camp", target: 1000, currency: "usd", deadline: "2026-12-31" })).json.target, 1000, "admin creates a $1000 goal");
t.eq(await info(null, "camp").then((i) => [i.target, i.raised, i.progress_pct, i.met]), [1000, 0, 0, false], "starts at 0 (public read)");
t.eq((await contribute(B, "camp", { amount: 250, note: "go team" })).json.progress_pct, 25, "B gives $250 → 25%");
t.eq((await contribute(C, "camp", { amount: 300 })).json.raised, 550, "C gives $300 → $550 raised");
t.eq((await contribute(B, "camp", { amount: 200 })).json.raised, 750, "B gives again (append-only) → $750");
let i = await info(null, "camp");
t.eq([i.raised, i.progress_pct, i.contributions, i.contributors], [750, 75, 3, 2], "aggregate: $750, 75%, 3 gifts, 2 contributors");

// --- Over-funding is allowed ---
let over = (await contribute(A, "camp", { amount: 500 })).json;
t.eq([over.raised, over.progress_pct, over.met], [1250, 125, true], "goal exceeded → 125%, met:true");

// --- Contributions list is admin-only ---
t.eq((await contribs(A, "camp")).json.contributions.length, 4, "admin sees the 4 individual contributions");
t.eq((await contribs(B, "camp")).status, 403, "a member can't read individual contributions → 403");

// --- Cents-exactness on a fresh goal ---
await create(A, "cents", { target: 100 });
await contribute(B, "cents", { amount: 0.5 });
t.eq((await contribute(B, "cents", { amount: 0.25 })).json.raised, 0.75, "0.50 + 0.25 = 0.75 to the cent");
t.eq((await info(null, "cents")).progress_pct, 0.8, "0.75 / 100 → 0.8% (rounded to a tenth)");

// --- List all goals (public) ---
t.ok((await listAll(null)).some((g) => g.goal === "camp" && g.met), "the goals list includes camp (met)");

// --- Validation ---
t.eq((await create(A, "bad", { target: 0 })).status, 400, "target 0 → 400");
t.eq((await create(A, "bad", {})).status, 400, "missing target → 400");
t.eq((await create(B, "hax", { target: 100 })).status, 403, "a non-admin can't create a goal → 403");
t.eq((await contribute(B, "camp", { amount: 0 })).status, 400, "contribution of 0 → 400");
t.eq((await contribute(B, "camp", { amount: -5 })).status, 400, "negative contribution → 400");
t.eq((await contribute(B, "ghost", { amount: 10 })).status, 404, "contribute to a non-existent goal → 404");

// --- Delete (admin) ---
t.eq((await del(A, "camp")).json.deleted, true, "admin deletes the goal");
t.eq((await info(null, "camp")).ok ?? false, false, "…goal is gone");
t.eq((await del(B, "cents")).status, 403, "a non-admin can't delete a goal → 403");

// --- Guards ---
t.eq((await contribute(null, "cents", { amount: 5 })).status, 401, "signed-out contribute → 401");
t.eq((await create(null, "x", { target: 5 })).status, 401, "signed-out create → 401");

t.done(); h.restore();

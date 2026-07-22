// Batch 77 — round-robin assignment (lead routing: auto-distribute new rows across a role pool)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 77");
const slug = "b77";
await c.ensure(slug);
await c.schema(slug, { tables: {
  leads: { access: "user", teamRead: true, roundRobin: { among: ["rep"] }, columns: [{ name: "name", type: "text" }] },
  plain: { access: "user", columns: [{ name: "name", type: "text" }] }, // no round-robin → creator owns
  cases: { access: "user", roundRobin: { among: ["agent"] }, columns: [{ name: "title", type: "text" }] }, // empty pool
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2 rep
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3 rep
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4 rep
await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9"); // id5 manager (not in pool)
for (const id of [2, 3, 4]) await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id, action: "set_role", role: "rep" } });
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 5, action: "set_role", role: "manager" } });

// admin creates 6 leads → they rotate across the rep pool (ids 2,3,4) in order, NOT to the admin
const owners = [];
for (let i = 0; i < 6; i++) owners.push((await c.post(`/api/db/${slug}/rows/leads`, { name: "Lead " + i }, { token: ADMIN })).json.owner_id);
t.eq(owners, [2, 3, 4, 2, 3, 4], "leads round-robin across the rep pool (ids 2,3,4), not the admin creator");

// the assigned rep actually owns/sees their leads
t.eq((await c.get(`/api/db/${slug}/rows/leads`, { token: A })).json.rows.length, 2, "rep A owns 2 of the 6 leads");
t.ok((await c.get(`/api/db/${slug}/rows/leads`, { token: A })).json.rows.every((r) => r.owner_id === 2), "all A's leads are owned by A");

// blocked members are dropped from the pool
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 3, action: "block" } });
const after = [];
for (let i = 0; i < 4; i++) after.push((await c.post(`/api/db/${slug}/rows/leads`, { name: "L" + i }, { token: ADMIN })).json.owner_id);
t.ok(after.every((o) => o === 2 || o === 4), "after blocking rep B, new leads only go to reps 2 and 4");
t.ok(!after.includes(3), "blocked rep B receives no leads");
// the manager (role not in the pool) never gets one
t.ok(!owners.includes(5) && !after.includes(5), "a member whose role isn't in the pool is never assigned");

// no round-robin config → the creator owns the row (response omits owner_id override)
let p = await c.post(`/api/db/${slug}/rows/plain`, { name: "mine" }, { token: A });
t.ok(p.json.ok && p.json.owner_id === undefined, "plain table: no round-robin, response has no owner override");
t.eq((await c.get(`/api/db/${slug}/rows/plain`, { token: A })).json.rows[0].owner_id, 2, "plain table row owned by its creator");

// round-robin with an EMPTY pool → falls back to the creator (a lead never ends up unowned)
let cs = await c.post(`/api/db/${slug}/rows/cases`, { title: "orphan?" }, { token: ADMIN });
t.ok(cs.json.ok, "case created despite empty agent pool");
t.eq((await c.get(`/api/db/${slug}/rows/cases`, { token: ADMIN })).json.rows[0].owner_id, 1, "empty pool → owned by the creator (admin), never null");

t.done(); h.restore();

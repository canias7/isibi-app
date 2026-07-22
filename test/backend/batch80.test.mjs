// Batch 80 — territory / field-based assignment (assignBy: route a new row to a specific
// member by a field value; composes with round-robin for the rest)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 80");
const slug = "b80";
await c.ensure(slug);
await c.schema(slug, { tables: {
  leads: { access: "user", assignBy: { field: "region", map: { west: "3", east: "4" }, default: "2" }, columns: [{ name: "region", type: "text" }, { name: "name", type: "text" }] },
  vips: { access: "user", assignBy: { field: "tier", map: { gold: "r3@x.dev" } }, columns: [{ name: "tier", type: "text" }] }, // email token, no default
  combo: { access: "user", assignBy: { field: "region", map: { west: "3" } }, roundRobin: { among: ["rep"] }, columns: [{ name: "region", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 (creator)
await c.signup(slug, "r2@x.dev", "Str0ng-pass-9"); // id2 (default rep)
await c.signup(slug, "r3@x.dev", "Str0ng-pass-9"); // id3 (west / gold)
await c.signup(slug, "r4@x.dev", "Str0ng-pass-9"); // id4 (east / rr pool)
await c.signup(slug, "r5@x.dev", "Str0ng-pass-9"); // id5 (rr pool)
for (const id of [4, 5]) await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id, action: "set_role", role: "rep" } });

const own = async (table, body) => (await c.post(`/api/db/${slug}/rows/${table}`, body, { token: ADMIN })).json.owner_id;

// route by field value → the mapped member
t.eq(await own("leads", { region: "west", name: "A" }), 3, "region=west → west rep (id3)");
t.eq(await own("leads", { region: "EAST", name: "B" }), 4, "region=EAST → east rep (case-insensitive, id4)");
// unmapped value → the default owner
t.eq(await own("leads", { region: "south", name: "C" }), 2, "unmapped region → default owner (id2)");
// missing field → the default owner
t.eq(await own("leads", { name: "D" }), 2, "no region → default owner (id2)");

// email-token mapping resolves to the member
t.eq(await own("vips", { tier: "gold" }), 3, "tier=gold → r3@x.dev resolved to id3");
// unmapped + no default + no round-robin → the creator keeps it
let silver = await c.post(`/api/db/${slug}/rows/vips`, { tier: "silver" }, { token: ADMIN });
t.ok(silver.json.ok && silver.json.owner_id === undefined, "unmapped, no default → creator owns (no override)");
t.eq((await c.get(`/api/db/${slug}/rows/vips?where=tier:eq:silver`, { token: ADMIN })).json.rows[0].owner_id, 1, "silver VIP owned by the admin creator");

// composition: assignBy wins for a mapped value, round-robin handles the rest
t.eq(await own("combo", { region: "west" }), 3, "combo: west → territory owner (assignBy wins over round-robin)");
const rr = [];
for (let i = 0; i < 4; i++) rr.push(await own("combo", { region: "north" }));
t.ok(rr.every((o) => o === 4 || o === 5), "combo: unmapped region falls through to the round-robin pool (4,5)");
t.ok(rr.includes(4) && rr.includes(5), "combo: round-robin actually rotates across the pool");
t.ok(!rr.includes(3), "combo: the territory-only rep (3) isn't in the round-robin pool");

// the routed row is genuinely owned by (visible to) the assignee
const R3 = (await c.login(slug, "r3@x.dev", "Str0ng-pass-9")).json.token;
t.ok((await c.get(`/api/db/${slug}/rows/leads`, { token: R3 })).json.rows.some((r) => r.region === "west"), "west rep sees the lead routed to them");

t.done(); h.restore();

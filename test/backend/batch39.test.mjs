// Batch 39 — Presence / who's-online
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 39");

const slug = "b39";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9", { display_name: "Alice" })).json.token; // 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9", { display_name: "Bob" })).json.token;   // 2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9", { display_name: "Cara" })).json.token;   // 3

// A and B ping presence
t.ok((await c.post(`/api/db/${slug}/presence`, {}, { token: A })).json.ok, "A ping ok");
await c.post(`/api/db/${slug}/presence`, {}, { token: B });

// online list -> Alice + Bob (not Cara)
let r = await c.get(`/api/db/${slug}/presence`);
const names = (r.json.online || []).map((u) => u.display_name).sort();
t.eq(names, ["Alice", "Bob"], "online list = Alice, Bob (Cara never pinged)");
t.ok(r.json.online.every((u) => u.last_seen), "entries carry last_seen");

// presence of one member
r = await c.get(`/api/db/${slug}/presence/1`);
t.ok(r.json.online === true && r.json.last_seen, "A is online");
r = await c.get(`/api/db/${slug}/presence/3`);
t.ok(r.json.online === false && r.json.last_seen === null, "C never seen -> offline, null");

// simulate A going idle 10 min ago -> drops from a within=5 window
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
h.getDb(uuid).prepare("UPDATE _presence SET at=? WHERE user_id=1").run(new Date(Date.now() - 10 * 60e3).toISOString());
r = await c.get(`/api/db/${slug}/presence?within=5`);
t.eq((r.json.online || []).map((u) => u.display_name), ["Bob"], "within=5 -> only Bob (A idle 10m)");
// but within=15 includes A again
r = await c.get(`/api/db/${slug}/presence?within=15`);
t.eq((r.json.online || []).map((u) => u.display_name).sort(), ["Alice", "Bob"], "within=15 -> A back in window");
// presenceOf respects within
t.ok((await c.get(`/api/db/${slug}/presence/1?within=5`)).json.online === false, "A offline in 5m window");
t.ok((await c.get(`/api/db/${slug}/presence/1?within=15`)).json.online === true, "A online in 15m window");

// ping needs auth
t.ok((await c.post(`/api/db/${slug}/presence`, {})).status === 401, "ping needs auth -> 401");

t.done();
h.restore();

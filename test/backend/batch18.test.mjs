// Batch 18 — Follows (member social graph)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 18");

const slug = "b18";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9", { display_name: "Alice" })).json.token; // id 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9", { display_name: "Bob" })).json.token;   // id 2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9", { display_name: "Cara" })).json.token;   // id 3

// A follows B(2)
let r = await c.post(`/api/db/${slug}/follow/2`, {}, { token: A });
t.ok(r.json && r.json.following === true && r.json.followers === 1, "A follows B -> following, followers=1");
// state as A (viewer) — mine true
r = await c.get(`/api/db/${slug}/follow/2`, { token: A });
t.ok(r.json.followers === 1 && r.json.following === 0 && r.json.mine === true, "GET /follow/2 as A -> mine=true");
// state as C (viewer) — mine false
r = await c.get(`/api/db/${slug}/follow/2`, { token: C });
t.ok(r.json.mine === false && r.json.followers === 1, "GET /follow/2 as C -> mine=false");
// anon state (no mine)
r = await c.get(`/api/db/${slug}/follow/2`);
t.ok(r.json.mine === false, "anon GET -> mine=false, counts visible");

// C also follows B -> followers=2
r = await c.post(`/api/db/${slug}/follow/2`, {}, { token: C });
t.ok(r.json.followers === 2, "C follows B -> followers=2");
// B follows A(1)
await c.post(`/api/db/${slug}/follow/1`, {}, { token: B });

// lists
r = await c.get(`/api/db/${slug}/follow/2/followers`);
const followerNames = (r.json.users || []).map((u) => u.display_name).sort();
t.eq(followerNames, ["Alice", "Cara"], "B's followers list = Alice, Cara (profiles)");
r = await c.get(`/api/db/${slug}/follow/1/following`, { token: A });
t.eq((r.json.users || []).map((u) => u.display_name), ["Bob"], "A's following list = Bob");
// A's own following count via state
r = await c.get(`/api/db/${slug}/follow/1`);
t.ok(r.json.followers === 1 && r.json.following === 1, "A: followers=1 (Bob), following=1 (Bob)");

// toggle off
r = await c.post(`/api/db/${slug}/follow/2`, {}, { token: A });
t.ok(r.json.following === false && r.json.followers === 1, "A unfollows B -> following=false, followers=1");

// idempotent force on (twice)
await c.post(`/api/db/${slug}/follow/2`, { on: true }, { token: A });
r = await c.post(`/api/db/${slug}/follow/2`, { on: true }, { token: A });
t.ok(r.json.following === true && r.json.followers === 2, "force on twice -> stable (following, followers=2)");

// guards
t.ok((await c.post(`/api/db/${slug}/follow/1`, {}, { token: A })).status === 400, "can't follow yourself -> 400");
t.ok((await c.post(`/api/db/${slug}/follow/2`, {})).status === 401, "follow needs auth -> 401");

t.done();
h.restore();

// Batch 221 — LEVELS / XP LADDER. An admin defines level thresholds; the app resolves an XP amount (or a
// member's points balance) to a level + progress toward the next. Covers ladder replace, /for?xp resolution
// (level pick, xp_to_next, progress %), top-level cap, /me from points balance, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 221");
const slug = "b221";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const setLadder = (tok, tiers) => c.post(`/api/db/${slug}/levels`, { tiers }, tok === null ? {} : { token: tok });
const ladder = () => c.get(`/api/db/${slug}/levels`).then((r) => r.json);
const forXp = (xp) => c.get(`/api/db/${slug}/levels/for?xp=${xp}`).then((r) => r.json);
const meLevel = (tok) => c.get(`/api/db/${slug}/levels/me`, { token: tok }).then((r) => r.json);

// --- Define the ladder ---
t.eq((await setLadder(A, [
  { level: 1, name: "Rookie", min_xp: 0 },
  { level: 2, name: "Pro", min_xp: 100 },
  { level: 3, name: "Elite", min_xp: 300 },
])).json.tiers, 3, "admin sets a 3-tier ladder");
t.eq((await ladder()).levels.length, 3, "the ladder reads back");

// --- Resolve xp → level ---
let r = await forXp(0);
t.eq(r.level, 1, "0 xp → level 1");
t.eq(r.name, "Rookie", "…Rookie");
t.eq(r.xp_to_next, 100, "…100 xp to next");
r = await forXp(150);
t.eq(r.level, 2, "150 xp → level 2 (Pro)");
t.eq(r.xp_to_next, 150, "…150 xp to Elite (300-150)");
t.eq(r.progress, 25, "…25% into the Pro→Elite band ((150-100)/(300-100))");

// --- Top level caps out ---
r = await forXp(5000);
t.eq(r.level, 3, "way-past xp → top level 3");
t.eq(r.next, null, "…no next tier");
t.eq(r.progress, 100, "…progress 100%");

// --- Replace the ladder ---
await setLadder(A, [{ level: 1, name: "One", min_xp: 0 }, { level: 2, name: "Two", min_xp: 50 }]);
t.eq((await ladder()).levels.length, 2, "re-posting replaces the whole ladder");

// --- /me from the member's points balance ---
await c.post(`/api/db/${slug}/points/award`, { user: bId, amount: 60 }, { token: A });
t.eq((await meLevel(B)).level, 2, "B's 60 points → level 2");
t.eq((await meLevel(B)).xp, 60, "…xp echoes the points balance");

// --- Validation + authz ---
t.eq((await setLadder(A, [])).status, 400, "empty tiers → 400");
t.eq((await setLadder(A, [{ level: 1, min_xp: 0 }, { level: 1, min_xp: 5 }])).status, 400, "duplicate level → 400");
t.eq((await setLadder(A, [{ level: 1, min_xp: -5 }])).status, 400, "negative min_xp → 400");
t.eq((await c.get(`/api/db/${slug}/levels/for`)).status, 400, "missing ?xp → 400");
t.eq((await setLadder(B, [{ level: 1, min_xp: 0 }])).status, 403, "a member can't set the ladder → 403");
t.eq((await c.get(`/api/db/${slug}/levels/me`)).status, 401, "signed-out /me → 401");

t.done(); h.restore();

// Batch 175 — FEATURE FLAGS. Admin upserts flags (enabled + % rollout + role/team targeting + a
// value payload); any member EVALUATES which are on for them. Covers deterministic rollout bucketing
// (replicated here so we can pin the exact boundary), role + team gates, fail-safe eval, and guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 175");
const slug = "b175";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3 member (not in the team)
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const up = (tok, body) => c.post(`/api/db/${slug}/flags`, body, tok === null ? {} : { token: tok });
const one = (tok, key) => c.get(`/api/db/${slug}/flags/eval?key=${key}`, { token: tok });
const all = (tok) => c.get(`/api/db/${slug}/flags/eval`, { token: tok }).then((r) => r.json.flags);
const list = (tok) => c.get(`/api/db/${slug}/flags`, { token: tok });
const del = (tok, key) => c.del(`/api/db/${slug}/flags/${key}`, { token: tok });
// Replicated FNV-1a bucket (must match worker's flagBucket) so we can pin the rollout boundary.
const bucket = (key, userId) => { const s = key + ":" + userId; let hh = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { hh ^= s.charCodeAt(i); hh = Math.imul(hh, 16777619) >>> 0; } return hh % 100; };

// --- Basic enable + value payload ---
t.eq((await up(A, { key: "beta", enabled: true, value: { color: "pink" } })).json.rollout, 100, "new flag defaults rollout 100");
let r = (await one(B, "beta")).json;
t.eq([r.on, r.value.color], [true, "pink"], "enabled flag → on for a member, value delivered");
t.ok(all(B) && (await all(B)).some((f) => f.key === "beta" && f.on === true), "eval-all lists beta as on");
// disabling flips it off and withholds the value
await up(A, { key: "beta", enabled: false });
t.eq([(await one(B, "beta")).json.on, (await one(B, "beta")).json.value], [false, null], "disabled → off, value withheld");

// --- Fail-safe: an unknown flag is a clean OFF, never a 404 ---
let g = await one(B, "ghost-flag");
t.eq([g.status, g.json.on], [200, false], "unknown flag → 200 on:false (no 404, gate-safe)");

// --- Deterministic rollout: pin the exact boundary for user B ---
const bk = bucket("roll", bId);
await up(A, { key: "roll", enabled: true, rollout: bk });
t.eq((await one(B, "roll")).json.on, false, "rollout == B's bucket → OFF (strict <)");
await up(A, { key: "roll", enabled: true, rollout: bk + 1 });
t.eq((await one(B, "roll")).json.on, true, "rollout == bucket+1 → ON");
t.eq((await one(B, "roll")).json.on, (await one(B, "roll")).json.on, "eval is stable across calls (deterministic)");
await up(A, { key: "roll", enabled: true, rollout: 0 });
t.eq((await one(B, "roll")).json.on, false, "rollout 0 → nobody");
await up(A, { key: "roll", enabled: true, rollout: 100 });
t.eq((await one(B, "roll")).json.on, true, "rollout 100 → everybody");

// --- Role targeting ---
await up(A, { key: "adminonly", enabled: true, roles: ["admin"] });
t.eq([(await one(A, "adminonly")).json.on, (await one(B, "adminonly")).json.on], [true, false], "roles:[admin] → on for admin, off for member");
await up(A, { key: "memberonly", enabled: true, roles: ["user"] });
t.eq([(await one(B, "memberonly")).json.on, (await one(A, "memberonly")).json.on], [true, false], "roles:[user] → on for a plain user, off for admin");

// --- Team targeting ---
const tid = (await c.post(`/api/db/${slug}/teams`, { name: "Beta Crew" }, { token: A })).json.id;
await c.post(`/api/db/${slug}/teams/${tid}/members`, { user: bId }, { token: A }); // B joins; A is owner (also a member)
await up(A, { key: "teamed", enabled: true, teams: [tid] });
t.eq((await one(B, "teamed")).json.on, true, "team-gated flag → on for a team member (B)");
t.eq((await one(C, "teamed")).json.on, false, "…off for a non-member (C)");
t.eq((await one(A, "teamed")).json.on, true, "…on for the team owner (A is in the team)");

// --- Admin list shows full config; members can't list ---
let lr = (await list(A)).json.flags.find((f) => f.key === "adminonly");
t.eq([lr.enabled, lr.roles[0]], [true, "admin"], "admin list exposes enabled + roles config");
t.eq((await list(B)).status, 403, "a member can't list flag config → 403");

// --- Delete (admin), then eval is still a safe OFF ---
t.eq((await del(A, "beta")).json.deleted, true, "admin deletes a flag");
t.eq((await one(B, "beta")).json.on, false, "deleted flag evals to off (not 404)");
t.eq((await del(A, "beta")).status, 404, "deleting a gone flag → 404");

// --- Guards ---
t.eq((await one(null, "beta")).status, 401, "signed-out eval → 401");
t.eq((await up(B, { key: "hax", enabled: true })).status, 403, "a member can't upsert a flag → 403");
t.eq((await up(A, { key: "bad key!", enabled: true })).status, 400, "invalid key chars → 400");
t.eq((await up(A, { key: "over", rollout: 150 })).status, 400, "rollout > 100 → 400");
t.eq((await up(A, { key: "eval", enabled: true })).status, 400, "'eval' is a reserved key → 400");

t.done(); h.restore();

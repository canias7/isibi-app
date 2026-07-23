// Batch 273 — MILESTONES. An admin defines personal progression milestones (a numeric target); each member
// accrues progress and achieves it. Covers define, progress (by + set, floored at 0), achieved flag +
// stamp, mine, list, get one + mine, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 273");
const slug = "b273";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const define = (tok, key, body) => c.post(`/api/db/${slug}/milestones/${key}`, body, tok === null ? {} : { token: tok });
const progress = (tok, key, body) => c.post(`/api/db/${slug}/milestones/${key}/progress`, body || {}, { token: tok }).then((r) => r.json);
const get = (tok, key) => c.get(`/api/db/${slug}/milestones/${key}`, tok ? { token: tok } : {}).then((r) => r.json);
const mine = (tok) => c.get(`/api/db/${slug}/milestones/mine`, { token: tok }).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/milestones`).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/milestones/${key}`, { token: tok });

// --- Define ---
t.eq((await define(A, "10-posts", { name: "Prolific", target: 10, reward: "Gold badge" })).json.target, 10, "admin defines a milestone");

// --- Progress by increment ---
t.eq((await progress(B, "10-posts", { by: 4 })).progress, 4, "log +4 → 4");
let p = await progress(B, "10-posts", { by: 5 });
t.eq(p.progress, 9, "…→ 9");
t.eq(p.achieved, false, "…not yet achieved");
t.eq((await progress(B, "10-posts", { by: -2 })).progress, 7, "a negative bump reduces progress");
t.eq((await progress(B, "10-posts", { by: -100 })).progress, 0, "…floored at 0");

// --- Reach the target ---
p = await progress(B, "10-posts", { set: 10 });
t.eq(p.progress, 10, "set to 10");
t.eq(p.achieved, true, "…achieved!");

// --- achieved_at stamped + mine ---
let g = await get(B, "10-posts");
t.eq(g.mine.achieved, true, "get shows mine.achieved");
let mp = (await mine(B)).milestones.find((x) => x.milestone === "10-posts");
t.ok(mp.achieved_at, "…and mine carries an achieved_at timestamp");

// --- A different member has their own progress ---
await progress(C, "10-posts", { by: 3 });
t.eq((await get(C, "10-posts")).mine.progress, 3, "C has independent progress");
t.eq((await get(C, "10-posts")).mine.achieved, false, "…and hasn't achieved it");

// --- List + get one (public, no mine when signed out) ---
await define(A, "5-friends", { target: 5 });
t.eq((await list()).milestones.length, 2, "list has both milestones");
t.eq((await get(null, "10-posts")).mine, null, "signed-out get has mine:null");

// --- Delete ---
t.eq((await del(A, "5-friends")).json.deleted, true, "admin deletes a milestone");
t.eq((await get(null, "5-friends")).status ?? 404, 404, "…gone");

// --- Validation + authz ---
t.eq((await define(A, "bad", { name: "x" })).status, 400, "missing target → 400");
t.eq((await define(A, "bad", { target: 0 })).status, 400, "a zero target → 400");
t.eq((await define(B, "hax", { target: 5 })).status, 403, "a member can't define → 403");
t.eq((await c.post(`/api/db/${slug}/milestones/10-posts/progress`, { by: 1 })).status, 401, "signed-out progress → 401");
t.eq((await progress(B, "nope", { by: 1 }).then((j) => j.ok ?? false)), false, "progress on a missing milestone fails");
t.eq((await c.get(`/api/db/${slug}/milestones/mine`)).status, 401, "signed-out /mine → 401");
t.eq((await del(B, "10-posts")).status, 403, "a member can't delete → 403");

t.done(); h.restore();

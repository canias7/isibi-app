// Batch 220 — CHALLENGES. A goal with a target + optional deadline; members log progress toward it, a board
// ranks them. Covers define, progress (by + set, floored at 0), done flag, board + mine, window enforcement
// (not-yet-started / ended → 409), list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 220");
const slug = "b220";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const define = (tok, key, body) => c.post(`/api/db/${slug}/challenges/${key}`, body, tok === null ? {} : { token: tok });
const progress = (tok, key, body) => c.post(`/api/db/${slug}/challenges/${key}/progress`, body || {}, { token: tok }).then((r) => r.json);
const read = (tok, key) => c.get(`/api/db/${slug}/challenges/${key}`, tok ? { token: tok } : {}).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/challenges`).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/challenges/${key}`, { token: tok });
const cId = idOf("c@x.dev");

// --- Define (admin) ---
t.eq((await define(A, "pushups", { title: "100 Pushups", target: 100, unit: "reps" })).json.target, 100, "admin defines a challenge");

// --- Progress by increment ---
t.eq((await progress(B, "pushups", { by: 30 })).progress, 30, "log +30 → 30");
let p = await progress(B, "pushups", { by: 25 });
t.eq(p.progress, 55, "log +25 → 55");
t.eq(p.done, false, "…not done yet");
t.eq((await progress(B, "pushups", { by: -10 })).progress, 45, "a negative bump reduces progress");
t.eq((await progress(B, "pushups", { by: -1000 })).progress, 0, "…floored at 0");

// --- Progress by absolute set + done flag ---
p = await progress(C, "pushups", { set: 120 });
t.eq(p.progress, 120, "set 120 (absolute)");
t.eq(p.done, true, "…and it's over the target → done");

// --- Board + mine ---
let r = await read(B, "pushups");
t.eq(r.participants, 2, "2 participants");
t.eq(r.top[0].user_id, cId, "C (120) leads the board");
t.eq(r.mine.progress, 0, "B sees their own progress");

// --- Window enforcement ---
const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
await define(A, "future", { target: 10, starts: future });
t.eq((await c.post(`/api/db/${slug}/challenges/future/progress`, { by: 1 }, { token: B })).status, 409, "can't progress a not-yet-started challenge");
await define(A, "over", { target: 10, ends: past });
t.eq((await c.post(`/api/db/${slug}/challenges/over/progress`, { by: 1 }, { token: B })).status, 409, "can't progress an ended challenge");
t.eq((await read(null, "future")).active, false, "a not-yet-active challenge reports active:false");

// --- List + delete ---
t.ok((await list()).challenges.length >= 3, "list has the challenges");
t.eq((await list()).challenges.find((x) => x.key === "pushups").participants, 2, "…with participant counts");
t.eq((await del(A, "pushups")).json.deleted, true, "admin deletes a challenge");
t.eq((await c.get(`/api/db/${slug}/challenges/pushups`)).status, 404, "…it's gone");

// --- Validation + authz ---
t.eq((await define(A, "bad", { title: "x" })).status, 400, "missing target → 400");
t.eq((await define(A, "bad", { target: 0 })).status, 400, "a zero target → 400");
t.eq((await define(B, "hax", { target: 5 })).status, 403, "a member can't define → 403");
t.eq((await c.post(`/api/db/${slug}/challenges/over/progress`, { by: 1 })).status, 401, "signed-out progress → 401");
t.eq((await progress(B, "nope", { by: 1 }).then((j) => j.ok ?? false)), false, "progress on a missing challenge fails");
t.eq((await del(B, "over")).status, 403, "a member can't delete → 403");

t.done(); h.restore();

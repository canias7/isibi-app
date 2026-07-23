// Batch 218 — GENERIC LEADERBOARDS. A named board over any metric; members submit scores under a per-board
// mode (max/sum/last); reads return the ranked top-N + my rank. Covers define modes, submit semantics per
// mode, ranking + mine, board list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 218");
const slug = "b218";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const define = (tok, board, body) => c.post(`/api/db/${slug}/leaderboards/${board}`, body || {}, tok === null ? {} : { token: tok });
const submit = (tok, board, score) => c.post(`/api/db/${slug}/leaderboards/${board}/submit`, { score }, { token: tok }).then((r) => r.json);
const read = (tok, board, q) => c.get(`/api/db/${slug}/leaderboards/${board}${q || ""}`, tok ? { token: tok } : {}).then((r) => r.json);
const listB = () => c.get(`/api/db/${slug}/leaderboards`).then((r) => r.json);
const del = (tok, board) => c.del(`/api/db/${slug}/leaderboards/${board}`, { token: tok });
const bId = idOf("b@x.dev"), cId = idOf("c@x.dev");

// --- Define (default mode max) ---
t.eq((await define(A, "highscore")).json.mode, "max", "default mode is max");

// --- Submit under 'max' (keeps the best) ---
await submit(B, "highscore", 500);
await submit(B, "highscore", 300); // lower — ignored
t.eq((await read(null, "highscore")).top[0].score, 500, "max mode keeps the highest submission");
await submit(C, "highscore", 800);
let r = await read(null, "highscore");
t.eq(r.top[0].user_id, cId, "C (800) leads");
t.eq(r.top[1].user_id, bId, "B (500) second");
t.eq(r.players, 2, "2 players");

// --- my rank ---
t.eq((await read(B, "highscore")).mine.rank, 2, "B sees their rank (2)");
t.eq((await read(B, "highscore")).mine.score, 500, "…and their score");

// --- 'sum' mode accumulates ---
await define(A, "steps", { mode: "sum", title: "Steps" });
await submit(B, "steps", 1000);
await submit(B, "steps", 500);
t.eq((await read(null, "steps")).top[0].score, 1500, "sum mode accumulates to 1500");

// --- 'last' mode overwrites ---
await define(A, "mood", { mode: "last" });
await submit(B, "mood", 7);
await submit(B, "mood", 3);
t.eq((await read(null, "mood")).top[0].score, 3, "last mode keeps the latest (3)");

// --- Submit returns rank ---
const s = await submit(C, "steps", 5000);
t.eq(s.rank, 1, "C's 5000 ranks 1 on steps");

// --- Board list ---
t.eq((await listB()).leaderboards.length, 3, "lists all 3 boards");

// --- Delete ---
t.eq((await del(A, "mood")).json.deleted, true, "admin deletes a board");
t.eq((await c.get(`/api/db/${slug}/leaderboards/mood`)).status, 404, "…it's gone");

// --- Validation + authz ---
t.eq((await define(B, "hax")).status, 403, "a member can't define → 403");
t.eq((await submit(B, "nope", 1).ok ?? false), false, "submitting to a missing board fails");
t.eq((await c.post(`/api/db/${slug}/leaderboards/highscore/submit`, { score: "abc" }, { token: B })).status, 400, "a non-numeric score → 400");
t.eq((await c.post(`/api/db/${slug}/leaderboards/highscore/submit`, { score: 1 })).status, 401, "signed-out submit → 401");
t.eq((await del(B, "highscore")).status, 403, "a member can't delete → 403");

t.done(); h.restore();

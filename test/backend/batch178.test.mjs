// Batch 178 — WAITLIST / fair FIFO queue. Join-once with a strictly-increasing seq, live position that
// advances as people ahead leave or are claimed, admin-only ordered view + counts, and the ATOMIC
// claim-front (a single guarded UPDATE off MIN(seq) — the fix the review flagged: concurrent claims
// drain different members, never a spurious 409). Plus per-list isolation and every guard.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 178");
const slug = "b178";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const E = (await c.signup(slug, "e@x.dev", "Str0ng-pass-9")).json.token; // id5 (never joins)
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const dId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("d@x.dev")[0].id;
const join = (tok, list) => c.post(`/api/db/${slug}/waitlist/${list}/join`, {}, tok === null ? {} : { token: tok });
const me = (tok, list) => c.get(`/api/db/${slug}/waitlist/${list}/me`, { token: tok });
const leave = (tok, list) => c.post(`/api/db/${slug}/waitlist/${list}/leave`, {}, { token: tok });
const listOf = (tok, list) => c.get(`/api/db/${slug}/waitlist/${list}`, { token: tok });
const claim = (tok, list, body) => c.post(`/api/db/${slug}/waitlist/${list}/claim`, body || {}, { token: tok });

// --- Join in order → seq 1,2,3, positions 1,2,3 ---
t.eq([(await join(B, "beta")).json.position, (await me(B, "beta")).json.seq], [1, 1], "B joins → position 1, seq 1");
t.eq((await join(C, "beta")).json.position, 2, "C → position 2");
t.eq((await join(D, "beta")).json.position, 3, "D → position 3");
// re-join is idempotent (no duplicate, same seq)
t.eq((await join(B, "beta")).json, { ok: true, joined: false, status: "waiting", position: 1, seq: 1 }, "B re-join → joined:false, same position");

// --- Leaving advances everyone behind ---
t.eq((await leave(C, "beta")).json.left, true, "C leaves");
t.eq((await me(D, "beta")).json.position, 2, "D advances 3 → 2 after C leaves");

// --- Admin ordered view + counts ---
let lv = (await listOf(A, "beta")).json;
t.eq([lv.total, lv.waiting], [2, 2], "admin sees total 2 / waiting 2 (B, D)");
t.eq(lv.entries.map((e) => [e.user_id, e.position]), [[2, 1], [4, 2]], "ordered by seq: B pos1, D pos2");

// --- Atomic claim-front: claims B (MIN waiting seq), D advances ---
let cl = (await claim(A, "beta")).json;
t.eq([cl.claimed.user_id, cl.status], [2, "invited"], "claim-front takes B (seq 1) → invited");
t.eq((await me(B, "beta")).json, { ok: true, status: "invited", position: null, seq: 1 }, "B is now invited, position null (out of the waiting count)");
t.eq((await me(D, "beta")).json.position, 1, "D advances to the front (position 1)");
let lv2 = (await listOf(A, "beta")).json;
t.eq([lv2.total, lv2.waiting], [2, 1], "counts: total still 2 (B retained), waiting now 1");

// --- Claim a NAMED user, then the queue empties ---
t.eq((await claim(A, "beta", { user: dId, as: "invited" })).json.claimed.user_id, dId, "admin claims D by id");
t.eq((await claim(A, "beta")).status, 409, "claim-front with nobody waiting → 409");
t.eq((await claim(A, "beta", { user: 2 })).status, 409, "claiming an already-claimed member → 409");

// --- Per-list isolation ---
t.eq((await join(B, "vip")).json.position, 1, "B is position 1 on a DIFFERENT list (independent seq)");
t.eq((await me(B, "beta")).json.status, "invited", "…and B's beta standing is unchanged");

// --- Guards ---
t.eq((await listOf(B, "beta")).status, 403, "a non-admin can't view the queue → 403");
t.eq((await claim(B, "beta")).status, 403, "a non-admin can't claim → 403");
t.eq((await join(null, "beta")).status, 401, "signed-out join → 401");
t.eq((await me(E, "beta")).status, 404, "not on the list → /me 404");
t.eq((await leave(E, "beta")).status, 404, "not on the list → /leave 404");

t.done(); h.restore();

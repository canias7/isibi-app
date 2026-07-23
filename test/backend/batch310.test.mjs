// Batch 310 — ON-CALL ROTATION. An ordered member list rotates on a fixed interval; `current` is computed
// deterministically from the anchor. Covers define, current at anchor, rotation after intervals, config, list,
// delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 310");
const slug = "b310";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const def = (tok, rot, body) => c.post(`/api/db/${slug}/oncall/${rot}`, body, tok === null ? {} : { token: tok });
const current = (rot) => c.get(`/api/db/${slug}/oncall/${rot}/current`).then((r) => r.json);
const config = (rot) => c.get(`/api/db/${slug}/oncall/${rot}`).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/oncall`).then((r) => r.json);
const del = (tok, rot) => c.del(`/api/db/${slug}/oncall/${rot}`, { token: tok });

// --- Define with a fixed past anchor so rotation is deterministic ---
const WEEK = 604800;
const anchor = new Date(Date.now() - 3 * WEEK * 1000 - 1000).toISOString(); // ~3 weeks + a bit ago
t.eq((await def(A, "primary", { members: ["alice", "bob", "carol"], interval_sec: WEEK, anchor })).json.members.length, 3, "admin defines a rotation");

// --- Current: after ~3 full weeks, index = 3 % 3 = 0 → alice ---
let cur = await current("primary");
t.eq(cur.on_call, "alice", "3 whole periods → back to the first member");
t.eq(cur.next, "bob", "…next is the second member");
t.ok(cur.next_handoff, "…with a next handoff time");

// --- Anchor exactly now → first member, index 0 ---
await def(A, "sec", { members: ["x", "y"], interval_sec: WEEK, anchor: new Date().toISOString() });
t.eq((await current("sec")).on_call, "x", "at the anchor → the first member");

// --- One interval later → second member (white-box move anchor back one week) ---
await def(A, "sec", { members: ["x", "y"], interval_sec: WEEK, anchor: new Date(Date.now() - WEEK * 1000 - 1000).toISOString() });
t.eq((await current("sec")).on_call, "y", "one period elapsed → the second member");

// --- Config + list ---
t.eq((await config("primary")).members.length, 3, "config returns the members");
t.ok((await list()).rotations.length >= 2, "list shows rotations");

// --- Delete ---
t.eq((await del(A, "sec")).json.deleted, true, "admin deletes a rotation");
t.eq((await current("sec")).ok ?? false, false, "…current on a gone rotation → not ok");

// --- Validation + authz ---
t.eq((await def(A, "x", { members: [], interval_sec: WEEK })).status, 400, "empty members → 400");
t.eq((await def(A, "x", { members: ["a"], interval_sec: 5 })).status, 400, "too-short interval → 400");
t.eq((await c.get(`/api/db/${slug}/oncall/nope/current`)).status, 404, "current on a missing rotation → 404");
t.eq((await def(B, "x", { members: ["a"], interval_sec: WEEK })).status, 403, "a member can't define → 403");
t.eq((await def(null, "x", { members: ["a"], interval_sec: WEEK })).status, 401, "signed-out → 401");

t.done(); h.restore();

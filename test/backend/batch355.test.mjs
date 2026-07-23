// Batch 355 — LOYALTY PUNCH CARDS. Buy-N-get-1-free stamp card. Admin defines + stamps; the earned rewards
// come from integer total/needed math; a member reads their card + redeems. Covers define, punch progression,
// reward earned + carry-over, redeem guard, per-user isolation, program/list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 355");
const slug = "b355";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev"), c3 = idOf("c@x.dev");
const define = (tok, body) => c.post(`/api/db/${slug}/punch-cards`, body, tok === null ? {} : { token: tok });
const punch = (tok, key, user) => c.post(`/api/db/${slug}/punch-cards/${key}/punch`, { user }, { token: tok });
const redeem = (tok, key) => c.post(`/api/db/${slug}/punch-cards/${key}/redeem`, {}, { token: tok });
const me = (tok, key) => c.get(`/api/db/${slug}/punch-cards/${key}/me`, { token: tok }).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/punch-cards/${key}`, { token: tok });

// --- Define (buy 3 get 1) ---
t.eq((await define(A, { key: "coffee", punches_needed: 3, reward: "Free latte" })).json.punches_needed, 3, "admin defines a program");

// --- Punch progression ---
let r = (await punch(A, "coffee", b2)).json;
t.eq(r.punches, 1, "first stamp → 1 punch");
t.eq(r.rewards_available, 0, "…no reward yet");
await punch(A, "coffee", b2);           // 2
r = (await punch(A, "coffee", b2)).json; // 3 → reward earned, punches reset to 0
t.eq(r.punches, 0, "third stamp completes the card (punches back to 0)");
t.eq(r.rewards_available, 1, "…and earns a reward");
t.eq(r.rewards_earned, 1, "…lifetime earned 1");

// --- Carry-over on the next cycle ---
r = (await punch(A, "coffee", b2)).json; // 4th
t.eq(r.punches, 1, "the 4th stamp starts the next card");
t.eq(r.rewards_available, 1, "…reward still pending redemption");

// --- Member reads their card ---
t.eq((await me(B, "coffee")).rewards_available, 1, "member sees a reward available");
t.eq((await me(B, "coffee")).reward, "Free latte", "…and what it is");

// --- Redeem ---
t.eq((await redeem(B, "coffee")).json.rewards_available, 0, "redeeming consumes the reward");
t.eq((await redeem(B, "coffee")).status, 409, "…redeeming again with none → 409");

// --- Per-user isolation ---
t.eq((await me(C, "coffee")).total, 0, "another member's card is independent");

// --- Program + list ---
t.eq((await c.get(`/api/db/${slug}/punch-cards/coffee`).then((r) => r.json)).program.punches_needed, 3, "public reads the program");
t.ok((await c.get(`/api/db/${slug}/punch-cards`).then((r) => r.json)).programs.length >= 1, "list shows programs");

// --- Delete ---
t.eq((await del(A, "coffee")).json.deleted, true, "admin deletes a program");

// --- Validation + authz ---
t.eq((await define(A, { key: "x", punches_needed: 0 })).status, 400, "punches_needed < 1 → 400");
await define(A, { key: "tea", punches_needed: 2 });
t.eq((await punch(A, "tea", 999999)).status, 404, "stamping an unknown user → 404");
t.eq((await punch(B, "tea", b2)).status, 403, "a member can't stamp → 403");
t.eq((await redeem(C, "tea")).status, 409, "redeeming with an empty card → 409");
t.eq((await c.post(`/api/db/${slug}/punch-cards`, { key: "z", punches_needed: 3 })).status, 401, "signed-out → 401");

t.done(); h.restore();

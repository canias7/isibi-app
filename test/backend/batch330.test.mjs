// Batch 330 — QUEST CHAINS. Ordered steps completed strictly in sequence; progress advances one step at a
// time. Covers define, advance in order, out-of-order/repeat refusal, me progress, done, per-user isolation,
// list/one, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 330");
const slug = "b330";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const def = (tok, body) => c.post(`/api/db/${slug}/quests`, body, tok === null ? {} : { token: tok });
const advance = (tok, key, step) => c.post(`/api/db/${slug}/quests/${key}/advance`, { step }, { token: tok });
const me = (tok, key) => c.get(`/api/db/${slug}/quests/${key}/me`, { token: tok }).then((r) => r.json);
const one = (key) => c.get(`/api/db/${slug}/quests/${key}`).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/quests`).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/quests/${key}`, { token: tok });

// --- Define ---
t.eq((await def(A, { key: "onboard", title: "Get Started", steps: ["signup", "profile", "invite"] })).json.steps.length, 3, "admin defines a 3-step quest");
t.eq((await one("onboard")).quest.steps[0], "signup", "…public reads the ordered steps");

// --- Advance in order ---
t.eq((await advance(B, "onboard", "signup")).json.step_index, 1, "B completes step 1");
t.eq((await me(B, "onboard")).next_step, "profile", "…next step is profile");
t.eq((await advance(B, "onboard", "profile")).json.step_index, 2, "B completes step 2");

// --- Final step completes the quest ---
t.eq((await advance(B, "onboard", "invite")).json.done, true, "completing the final step → done");
t.eq((await me(B, "onboard")).done, true, "completing all steps → done");
t.eq((await me(B, "onboard")).percent, 100, "…100%");

// --- Repeat / past step refused ---
t.eq((await advance(B, "onboard", "signup")).status, 409, "re-doing a completed step → 409");

// --- Skipping ahead refused ---
t.eq((await advance(C, "onboard", "profile")).status, 409, "C can't skip to step 2 first → 409");
t.ok(/signup/.test((await advance(C, "onboard", "profile")).json.expected), "…and is told the expected step");
t.eq((await advance(C, "onboard", "signup")).json.step_index, 1, "…doing step 1 first works");

// --- Per-user isolation ---
t.eq((await me(C, "onboard")).completed, 1, "C's progress is independent");
t.eq((await me(B, "onboard")).completed, 3, "…B is still fully done");

// --- List + delete ---
t.ok((await list()).quests.find((q) => q.key === "onboard"), "list shows the quest");
t.eq((await del(A, "onboard")).json.deleted, true, "admin deletes a quest");
t.eq((await one("onboard")).ok ?? false, false, "…and it's gone");

// --- Validation + authz ---
t.eq((await def(A, { key: "x", steps: [] })).status, 400, "empty steps → 400");
t.eq((await def(A, { key: "x", steps: ["a", "a"] })).status, 400, "duplicate steps → 400");
t.eq((await def(B, { key: "x", steps: ["a"] })).status, 403, "a member can't define → 403");
t.eq((await advance(B, "nope", "a")).status, 404, "advancing a missing quest → 404");
t.eq((await c.post(`/api/db/${slug}/quests/onboard/advance`, { step: "a" })).status, 401, "signed-out → 401");

t.done(); h.restore();

// Batch 275 — ONBOARDING CHECKLIST. An admin defines steps; each member marks them done and reads progress.
// Covers define steps, public steps, complete/uncomplete, me (done flags + percent + all_done), per-member
// isolation, replace steps, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 275");
const slug = "b275";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const setSteps = (tok, steps) => c.post(`/api/db/${slug}/onboarding/steps`, { steps }, tok === null ? {} : { token: tok });
const getSteps = () => c.get(`/api/db/${slug}/onboarding/steps`).then((r) => r.json);
const complete = (tok, step) => c.post(`/api/db/${slug}/onboarding/complete/${step}`, {}, { token: tok });
const uncomplete = (tok, step) => c.del(`/api/db/${slug}/onboarding/complete/${step}`, { token: tok });
const me = (tok) => c.get(`/api/db/${slug}/onboarding/me`, { token: tok }).then((r) => r.json);

// --- Define steps ---
t.eq((await setSteps(A, [{ key: "profile", title: "Complete profile", position: 0 }, { key: "avatar", title: "Add an avatar", position: 1 }, { key: "invite", title: "Invite a friend", position: 2 }])).json.steps, 3, "admin sets a 3-step checklist");
t.eq((await getSteps()).steps.length, 3, "public reads the steps");
t.eq((await getSteps()).steps[0].key, "profile", "…ordered by position");

// --- Member progress ---
let m = await me(B);
t.eq(m.total, 3, "3 total steps");
t.eq(m.completed, 0, "…0 done initially");
t.eq(m.percent, 0, "…0%");

// --- Complete steps ---
t.eq((await complete(B, "profile")).json.done, true, "B completes 'profile'");
await complete(B, "avatar");
m = await me(B);
t.eq(m.completed, 2, "2 of 3 done");
t.eq(m.percent, 67, "…67%");
t.eq(m.all_done, false, "…not all done");
t.ok(m.steps.find((s) => s.key === "profile").done, "…the completed step is flagged");

// --- Complete the last → all_done ---
await complete(B, "invite");
t.eq((await me(B)).all_done, true, "completing all → all_done true");
t.eq((await me(B)).percent, 100, "…100%");

// --- Un-complete ---
t.eq((await uncomplete(B, "avatar")).json.done, false, "B un-completes a step");
t.eq((await me(B)).completed, 2, "…back to 2 done");

// --- Per-member isolation ---
t.eq((await me(C)).completed, 0, "C's checklist is independent (0 done)");

// --- Idempotent complete ---
await complete(B, "profile");
t.eq((await me(B)).completed, 2, "re-completing doesn't double-count");

// --- Replace steps ---
await setSteps(A, [{ key: "verify", title: "Verify email" }]);
t.eq((await getSteps()).steps.length, 1, "re-posting replaces the whole list");

// --- Validation + authz ---
t.eq((await setSteps(A, [])).status, 400, "empty steps → 400");
t.eq((await setSteps(A, [{ title: "no key" }])).status, 400, "a step with no key → 400");
t.eq((await setSteps(B, [{ key: "x" }])).status, 403, "a member can't set steps → 403");
t.eq((await c.post(`/api/db/${slug}/onboarding/complete/nope`, {}, { token: B })).status, 404, "completing a missing step → 404");
t.eq((await c.post(`/api/db/${slug}/onboarding/complete/verify`, {})).status, 401, "signed-out complete → 401");
t.eq((await c.get(`/api/db/${slug}/onboarding/me`)).status, 401, "signed-out /me → 401");

t.done(); h.restore();

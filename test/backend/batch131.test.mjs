// Batch 131 — LMS progress: course items, per-learner completion %, prerequisite gating
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 131");
const slug = "b131";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const complete = (item, tok, extra) => c.post(`/api/db/${slug}/courses/js101/complete`, Object.assign({ item }, extra), { token: tok || A });
const progress = (tok, learner) => c.get(`/api/db/${slug}/courses/js101/progress${learner ? "?learner=" + learner : ""}`, { token: tok || A });

// Admin defines the course (3 lessons; quiz requires lesson2).
let def = await c.post(`/api/db/${slug}/courses/js101`, { items: [
  { item: "lesson1" }, { item: "lesson2", prereq: "lesson1" }, { item: "quiz", prereq: "lesson2" },
] }, { token: ADMIN });
t.eq(def.status, 200, "define course → 200");
t.eq(def.json.items, 3, "3 items");

// A non-admin can't define a course.
t.eq((await c.post(`/api/db/${slug}/courses/x`, { items: [{ item: "a" }] }, { token: A })).status, 403, "non-admin define → 403");

// Learner A works through it. Prereqs are enforced.
t.eq((await complete("quiz")).status, 409, "can't do quiz before its prereq");
t.eq((await complete("quiz")).json.code, "prereq", "409 code prereq");
t.eq((await complete("lesson1")).status, 200, "lesson1 (no prereq) → ok");
let p2 = await complete("lesson2");
t.eq(p2.status, 200, "lesson2 after lesson1 → ok");
t.eq(p2.json.percent, 66.7, "2 of 3 → 66.7%");
t.eq((await complete("quiz", A, { score: 88 })).json.percent, 100, "all 3 → 100%");

// Progress read reflects A's completions + score.
let pg = (await progress(A)).json;
t.eq(pg.completed, 3, "A completed 3");
t.eq(pg.total, 3, "of 3");
t.eq(pg.items.find((i) => i.item === "quiz").score, 88, "quiz score recorded");
t.ok(pg.items.every((i) => i.done), "all items done for A");

// Learner B is independent (own progress).
t.eq((await progress(B, )).json.completed, 0, "B has no progress yet");
await complete("lesson1", B);
t.eq((await progress(B)).json.completed, 1, "B at 1/3 independently");
t.eq((await progress(A)).json.completed, 3, "A unaffected by B");

// A member can't view/record another member's progress; an admin can.
t.eq((await progress(A, "3")).status, 403, "member can't view another learner's progress");
t.eq((await c.get(`/api/db/${slug}/courses/js101/progress?learner=3`, { token: ADMIN })).json.completed, 1, "admin views B's progress");
t.eq((await complete("lesson2", ADMIN, { learner: "3" })).status, 200, "admin records for learner B");
t.eq((await progress(B)).json.completed, 2, "B now at 2/3 (admin recorded)");

// Reset.
await c.post(`/api/db/${slug}/courses/js101/reset`, { item: "quiz" }, { token: A });
t.eq((await progress(A)).json.completed, 2, "reset one item → 2/3");
await c.post(`/api/db/${slug}/courses/js101/reset`, {}, { token: A });
t.eq((await progress(A)).json.completed, 0, "reset whole course → 0");

// Redefining validates prereqs reference real items.
t.eq((await c.post(`/api/db/${slug}/courses/bad`, { items: [{ item: "a", prereq: "ghost" }] }, { token: ADMIN })).status, 400, "prereq must be a real item → 400");

// Guards.
t.eq((await complete("ghost")).status, 404, "completing an unknown item → 404");
t.eq((await c.get(`/api/db/${slug}/courses/nope/progress`, { token: A })).status, 404, "progress on unknown course → 404");
t.eq((await c.post(`/api/db/${slug}/courses/js101/complete`, { item: "lesson1" })).status, 401, "signed-out → 401");
t.ok((await c.get(`/api/db/${slug}/courses`, { token: A })).json.courses.some((x) => x.course === "js101"), "courses list");

t.done(); h.restore();

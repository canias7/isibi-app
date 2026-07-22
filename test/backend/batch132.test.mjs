// Batch 132 — quiz auto-grading: server-side answer keys (never leaked), scoring, pass/fail, attempts
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 132");
const slug = "b132";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const grade = (answers, tok) => c.post(`/api/db/${slug}/quizzes/q1/grade`, { answers }, { token: tok || A });

// Admin defines a quiz: scalar, case-insensitive, any-of (array key), multi-select (array key + array answer).
let def = await c.post(`/api/db/${slug}/quizzes/q1`, { pass_pct: 60, questions: [
  { qid: "capital", answer: "Paris" },                          // 1 pt, case-insensitive
  { qid: "color", answer: ["red", "crimson"] },                 // any-of accepted
  { qid: "primes", answer: [2, 3, 5], points: 2 },              // multi-select, exact set, 2 pts
] }, { token: ADMIN });
t.eq(def.status, 200, "define quiz → 200");
t.eq(def.json.questions, 3, "3 questions");

// A taker must NOT see the answer key.
let takerView = (await c.get(`/api/db/${slug}/quizzes/q1`, { token: A })).json;
t.ok(takerView.questions.every((q) => !("answer" in q)), "taker sees no answers");
t.ok(takerView.questions.every((q) => "points" in q), "taker sees points");
// An admin does.
let adminView = (await c.get(`/api/db/${slug}/quizzes/q1`, { token: ADMIN })).json;
t.ok(adminView.questions.find((q) => q.qid === "capital").answer === "Paris", "admin sees the key");

// Perfect score (case-insensitive scalar, any-of, exact multi-set).
let perfect = (await grade({ capital: "paris", color: "crimson", primes: [5, 2, 3] })).json;
t.eq(perfect.score, 4, "score 4 of 4 (1 + 1 + 2)");
t.eq(perfect.max, 4, "max 4");
t.eq(perfect.percent, 100, "100%");
t.ok(perfect.passed, "passed (≥ 60)");
t.ok(perfect.results.every((r) => r.correct), "all correct");
// Crucially, grading never returns the correct answers.
t.ok(!JSON.stringify(perfect).toLowerCase().includes("paris"), "grade response doesn't leak the answer");

// Partial + fail.
let partial = (await grade({ capital: "London", color: "red", primes: [2, 3] })).json;
t.eq(partial.score, 1, "only 'color' right → 1 pt");
t.eq(partial.percent, 25, "25%");
t.ok(!partial.passed, "failed (< 60)");
t.eq(partial.results.find((r) => r.qid === "capital").correct, false, "capital marked wrong");
t.eq(partial.results.find((r) => r.qid === "primes").correct, false, "incomplete multi-select is wrong");

// Attempts are recorded per learner.
let att = (await c.get(`/api/db/${slug}/quizzes/q1/attempts`, { token: A })).json;
t.eq(att.attempts.length, 2, "two attempts recorded for A");
t.eq(att.attempts[0].percent, 25, "latest attempt first");
// A member can't see another learner's attempts; an admin can view any.
t.eq((await c.get(`/api/db/${slug}/quizzes/q1/attempts?learner=99`, { token: A })).status, 403, "member can't view others' attempts");
t.ok((await c.get(`/api/db/${slug}/quizzes/q1/attempts?learner=2`, { token: ADMIN })).json.attempts.length === 2, "admin views A's attempts");

// No pass_pct → passed is null (ungraded pass/fail).
await c.post(`/api/db/${slug}/quizzes/q2`, { questions: [{ qid: "1", answer: "yes" }] }, { token: ADMIN });
t.eq((await c.post(`/api/db/${slug}/quizzes/q2/grade`, { answers: { "1": "yes" } }, { token: A })).json.passed, null, "no pass_pct → passed null");

// Guards.
t.eq((await c.post(`/api/db/${slug}/quizzes/q3`, { questions: [{ qid: "1" }] }, { token: ADMIN })).status, 400, "question without answer → 400");
t.eq((await c.post(`/api/db/${slug}/quizzes/q3`, { questions: [{ qid: "1", answer: "a" }] }, { token: A })).status, 403, "non-admin define → 403");
t.eq((await c.post(`/api/db/${slug}/quizzes/nope/grade`, { answers: {} }, { token: A })).status, 404, "grade unknown quiz → 404");
t.eq((await c.post(`/api/db/${slug}/quizzes/q1/grade`, { answers: {} })).status, 401, "signed-out → 401");
t.eq((await c.del(`/api/db/${slug}/quizzes/q2`, { token: ADMIN })).status, 200, "delete a quiz");

t.done(); h.restore();

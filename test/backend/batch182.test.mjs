// Batch 182 — SURVEYS / NPS / CSAT. One numeric response per member per survey (re-submit upserts);
// member submits/reads/withdraws their OWN; admin-only aggregate (nps/csat/avg lenses, computed in SQL)
// and individual responses. Covers the aggregate math, score validation, authz, and guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 182");
const slug = "b182";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const E = (await c.signup(slug, "e@x.dev", "Str0ng-pass-9")).json.token; // id5
const submit = (tok, survey, body) => c.post(`/api/db/${slug}/surveys/${survey}`, body, tok === null ? {} : { token: tok });
const mine = (tok, survey) => c.get(`/api/db/${slug}/surveys/${survey}/mine`, { token: tok });
const summary = (tok, survey, kind) => c.get(`/api/db/${slug}/surveys/${survey}/summary${kind ? "?kind=" + kind : ""}`, { token: tok });
const responses = (tok, survey) => c.get(`/api/db/${slug}/surveys/${survey}/responses`, { token: tok });
const withdraw = (tok, survey) => c.del(`/api/db/${slug}/surveys/${survey}/mine`, { token: tok });
const Q = "nps-q3";

// --- Submit + upsert ---
t.eq((await submit(B, Q, { score: 10 })).status, 200, "B submits a 10");
t.eq((await mine(B, Q)).json.response.score, 10, "B's /mine shows 10");
await submit(C, Q, { score: 5 });
await submit(C, Q, { score: 10 }); // re-submit UPSERTS
t.eq((await mine(C, Q)).json.response.score, 10, "re-submit updates C's score to 10 (upsert, one row)");
await submit(D, Q, { score: 9 });
await submit(E, Q, { score: 7 });
await submit(A, Q, { score: 3 });

// --- NPS aggregate (admin) ---
let s = (await summary(A, Q)).json;
t.eq([s.responses, s.promoters, s.passives, s.detractors], [5, 3, 1, 1], "buckets: 3 promoters (9-10), 1 passive (7-8), 1 detractor (0-6)");
t.eq(s.nps, 40, "NPS = round((3-1)/5*100) = 40");
// --- CSAT + avg lenses over the same data ---
let cs = (await summary(A, Q, "csat")).json;
t.eq([cs.responses, cs.average, cs.satisfied, cs.csat_pct], [5, 7.8, 4, 80], "CSAT: avg 7.8, 4 satisfied (>=4), 80%");
t.eq((await summary(A, Q, "avg")).json.average, 7.8, "avg lens = 7.8");
t.eq((await responses(A, Q)).json.responses.length, 5, "admin sees all 5 individual responses");

// --- mine on an unanswered survey → null ---
t.eq((await mine(B, "other")).json.response, null, "no response on a different survey → null");

// --- Withdraw ---
t.eq((await withdraw(B, Q)).json.withdrawn, true, "B withdraws their response");
t.eq((await mine(B, Q)).json.response, null, "…/mine is now null");
t.eq((await summary(A, Q)).json.responses, 4, "aggregate drops to 4");
t.eq((await withdraw(B, Q)).status, 404, "withdrawing again → 404");

// --- Score validation ---
t.eq((await submit(B, "vq", { score: 11 })).status, 400, "score > default max 10 → 400");
t.eq((await submit(B, "vq", { score: -1 })).status, 400, "negative score → 400");
t.eq((await submit(B, "vq", { score: 6, max: 5 })).status, 400, "score 6 with max 5 → 400");
t.eq((await submit(B, "vq", { score: 5, max: 5 })).status, 200, "score 5 with max 5 → ok");
t.eq((await submit(B, "vq", {})).status, 400, "missing score → 400");

// --- Authz: aggregate + responses are admin-only ---
t.eq((await summary(C, Q)).status, 403, "a member can't read the NPS summary → 403");
t.eq((await responses(C, Q)).status, 403, "a member can't read individual responses → 403");
t.eq((await mine(C, Q)).status, 200, "…but a member CAN read their own response");

// --- Guards ---
t.eq((await submit(null, Q, { score: 5 })).status, 401, "signed-out submit → 401");
t.eq((await c.get(`/api/db/${slug}/surveys/${Q}/mine`)).status, 401, "signed-out /mine → 401");

t.done(); h.restore();

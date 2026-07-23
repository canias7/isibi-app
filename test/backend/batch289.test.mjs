// Batch 289 — NPS SURVEYS. A member answers 0–10 once per campaign; the score endpoint buckets promoters
// (9–10)/passives (7–8)/detractors (0–6) and returns NPS = %promoters − %detractors. Covers submit, upsert,
// me, score math, responses, campaign isolation, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 289");
const slug = "b289";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token;
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token;
const E = (await c.signup(slug, "e@x.dev", "Str0ng-pass-9")).json.token;
const submit = (tok, body) => c.post(`/api/db/${slug}/nps`, body, tok === null ? {} : { token: tok });
const me = (tok, q) => c.get(`/api/db/${slug}/nps/me${q || ""}`, { token: tok }).then((r) => r.json);
const score = (tok, q) => c.get(`/api/db/${slug}/nps${q || ""}`, { token: tok });
const responses = (tok) => c.get(`/api/db/${slug}/nps/responses`, { token: tok });

// --- Submit a spread ---
t.eq((await submit(B, { score: 10 })).json.bucket, "promoter", "10 → promoter");
t.eq((await submit(C, { score: 9 })).json.bucket, "promoter", "9 → promoter");
t.eq((await submit(D, { score: 7 })).json.bucket, "passive", "7 → passive");
t.eq((await submit(E, { score: 3 })).json.bucket, "detractor", "3 → detractor");

// --- Me ---
t.eq((await me(B)).response.score, 10, "a member reads their own answer");

// --- Score math: (2 promoters − 1 detractor)/4 = 25 ---
let s = (await score(A)).json;
t.eq(s.total, 4, "4 responses");
t.eq(s.promoters, 2, "2 promoters");
t.eq(s.detractors, 1, "1 detractor");
t.eq(s.nps, 25, "NPS = round((2−1)/4·100) = 25");

// --- Upsert: B changes to a detractor → recompute ---
await submit(B, { score: 6 });
s = (await score(A)).json;
t.eq(s.total, 4, "still 4 (upsert, not a new row)");
t.eq(s.nps, -25, "NPS now round((1−2)/4·100) = −25");

// --- Responses (admin) ---
t.eq((await responses(A)).json.responses.length, 4, "admin reads raw responses");

// --- Campaign isolation ---
await submit(B, { campaign: "q2", score: 10 });
t.eq((await score(A, "?campaign=q2")).json.total, 1, "a separate campaign is independent");
t.eq((await score(A)).json.total, 4, "…the default campaign is unchanged");

// --- Validation + authz ---
t.eq((await submit(B, { score: 11 })).status, 400, "score > 10 → 400");
t.eq((await submit(B, { score: -1 })).status, 400, "score < 0 → 400");
t.eq((await score(B)).status, 403, "a member can't read the score → 403");
t.eq((await responses(B)).status, 403, "a member can't read responses → 403");
t.eq((await c.post(`/api/db/${slug}/nps`, { score: 5 })).status, 401, "signed-out submit → 401");

t.done(); h.restore();

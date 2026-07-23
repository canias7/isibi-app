// Batch 350 — RANKED-CHOICE VOTING (instant runoff). Members submit ordered rankings; results eliminate the
// lowest first-choice each round until a majority. Covers create, ballot, re-rank, IRV tabulation with a
// runoff round, my ballot, close guard, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 350");
const slug = "b350";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const voters = [];
for (let i = 0; i < 5; i++) voters.push((await c.signup(slug, `v${i}@x.dev`, "Str0ng-pass-9")).json.token);
const create = (tok, body) => c.post(`/api/db/${slug}/ranked-vote`, body, tok === null ? {} : { token: tok });
const ballot = (tok, key, ranking) => c.post(`/api/db/${slug}/ranked-vote/${key}/ballot`, { ranking }, { token: tok });
const results = (key) => c.get(`/api/db/${slug}/ranked-vote/${key}/results`).then((r) => r.json);
const one = (tok, key) => c.get(`/api/db/${slug}/ranked-vote/${key}`, tok ? { token: tok } : {}).then((r) => r.json);
const close = (tok, key) => c.post(`/api/db/${slug}/ranked-vote/${key}/close`, {}, { token: tok });
const del = (tok, key) => c.del(`/api/db/${slug}/ranked-vote/${key}`, { token: tok });

// --- Create ---
t.eq((await create(A, { key: "mayor", candidates: ["Ann", "Bob", "Cal"] })).json.candidates.length, 3, "admin creates a ranked poll");

// --- Ballots designed so no one has a first-round majority, then Cal is eliminated and transfers to Ann ---
// v0,v1: Ann>Cal>Bob ; v2: Bob>Cal>Ann ; v3: Cal>Ann>Bob ; v4: Cal>Bob>Ann
await ballot(voters[0], "mayor", ["Ann", "Cal", "Bob"]);
await ballot(voters[1], "mayor", ["Ann", "Cal", "Bob"]);
await ballot(voters[2], "mayor", ["Bob", "Cal", "Ann"]);
await ballot(voters[3], "mayor", ["Cal", "Ann", "Bob"]);
await ballot(voters[4], "mayor", ["Cal", "Bob", "Ann"]);

// Round 1: Ann 2, Bob 1, Cal 2 → no majority (>2.5). Lowest = Bob(1), eliminated.
// Round 2: Bob's ballot (v2) transfers to Cal. Ann 2, Cal 3 → Cal has majority.
let r = await results("mayor");
t.eq(r.ballots, 5, "five ballots counted");
t.eq(r.winner, "Cal", "instant-runoff winner is Cal after Bob is eliminated");
t.ok(r.rounds.length >= 2, "…it took at least two rounds");
t.eq(r.rounds[0].counts.Ann, 2, "round 1: Ann has 2 first-choices");
t.eq(r.rounds[0].counts.Cal, 2, "round 1: Cal has 2");

// --- Re-rank replaces ---
await ballot(voters[2], "mayor", ["Ann", "Bob", "Cal"]);
t.eq((await one(voters[2], "mayor")).my_ballot[0], "Ann", "a re-ranked ballot replaces the old one");
// Now Ann has 3 first-choices → majority in round 1
t.eq((await results("mayor")).winner, "Ann", "…which flips the winner to Ann");

// --- Close blocks new ballots ---
t.eq((await close(A, "mayor")).json.status, "closed", "admin closes the poll");
t.eq((await ballot(voters[0], "mayor", ["Bob"])).status, 409, "…voting on a closed poll → 409");

// --- Delete ---
t.eq((await del(A, "mayor")).json.deleted, true, "admin deletes the poll");

// --- Validation + authz ---
t.eq((await create(A, { key: "x", candidates: ["only"] })).status, 400, "fewer than 2 candidates → 400");
await create(A, { key: "p2", candidates: ["a", "b"] });
t.eq((await ballot(voters[0], "p2", ["zzz"])).status, 400, "a ranking with no valid candidates → 400");
t.eq((await ballot(voters[0], "nope", ["a"])).status, 404, "a ballot on a missing poll → 404");
t.eq((await create(voters[0], { key: "z", candidates: ["a", "b"] })).status, 403, "a member can't create → 403");
t.eq((await c.post(`/api/db/${slug}/ranked-vote/p2/ballot`, { ranking: ["a"] })).status, 401, "signed-out → 401");

t.done(); h.restore();

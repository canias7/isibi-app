// Batch 336 — WEIGHTED BALLOTS. A poll where each vote carries a weight; results tally summed weight per
// option. Covers create, vote, re-vote replace, weighted tally + winner, my vote, close guard, list, delete,
// validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 336");
const slug = "b336";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const create = (tok, body) => c.post(`/api/db/${slug}/ballots`, body, tok === null ? {} : { token: tok });
const vote = (tok, key, body) => c.post(`/api/db/${slug}/ballots/${key}/vote`, body, { token: tok });
const results = (key) => c.get(`/api/db/${slug}/ballots/${key}/results`).then((r) => r.json);
const one = (tok, key) => c.get(`/api/db/${slug}/ballots/${key}`, tok ? { token: tok } : {}).then((r) => r.json);
const close = (tok, key) => c.post(`/api/db/${slug}/ballots/${key}/close`, {}, { token: tok });
const del = (tok, key) => c.del(`/api/db/${slug}/ballots/${key}`, { token: tok });

// --- Create ---
t.eq((await create(A, { key: "budget", title: "Approve budget?", options: ["yes", "no"] })).json.options.length, 2, "admin creates a weighted poll");

// --- Weighted votes: B(10) yes, C(3) no ---
t.eq((await vote(B, "budget", { choice: "yes", weight: 10 })).json.weight, 10, "B votes yes with weight 10");
await vote(C, "budget", { choice: "no", weight: 3 });
let r = await results("budget");
t.eq(r.tally.yes.weight, 10, "yes has 10 weight");
t.eq(r.tally.no.weight, 3, "no has 3 weight");
t.eq(r.total_weight, 13, "total weight summed");
t.eq(r.winner, "yes", "yes wins on weight");

// --- Re-vote replaces (B switches to no) ---
await vote(B, "budget", { choice: "no", weight: 10 });
r = await results("budget");
t.eq(r.tally.yes.weight, 0, "B's old yes is gone");
t.eq(r.tally.no.weight, 13, "…now no has 13");
t.eq(r.winner, "no", "winner flips to no");

// --- My vote ---
t.eq((await one(B, "budget")).my_vote.choice, "no", "a voter sees their own vote");
t.eq((await one(null, "budget")).my_vote, null, "…anonymous sees none");

// --- Close blocks voting ---
t.eq((await close(A, "budget")).json.status, "closed", "admin closes the poll");
t.eq((await vote(C, "budget", { choice: "yes" })).status, 409, "…voting on a closed poll → 409");

// --- List + delete ---
t.ok((await c.get(`/api/db/${slug}/ballots`).then((r) => r.json)).ballots.length >= 1, "list shows the poll");
t.eq((await del(A, "budget")).json.deleted, true, "admin deletes the poll");

// --- Validation + authz ---
t.eq((await create(A, { key: "x", options: ["only"] })).status, 400, "fewer than 2 options → 400");
t.eq((await create(A, { key: "x", options: ["a", "a"] })).status, 400, "duplicate options → 400");
await create(A, { key: "poll2", options: ["a", "b"] });
t.eq((await vote(B, "poll2", { choice: "zzz" })).status, 400, "a choice not in the options → 400");
t.eq((await vote(B, "nope", { choice: "a" })).status, 404, "voting on a missing poll → 404");
t.eq((await create(B, { key: "z", options: ["a", "b"] })).status, 403, "a member can't create → 403");
t.eq((await c.post(`/api/db/${slug}/ballots/poll2/vote`, { choice: "a" })).status, 401, "signed-out vote → 401");

t.done(); h.restore();

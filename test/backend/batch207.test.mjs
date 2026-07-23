// Batch 207 — HELP-ARTICLE VOTES. A member marks a help/FAQ article helpful (yes) or not (no); the
// aggregate drives a "N of M found this helpful" widget. One changeable vote per (article, member). Covers
// cast, aggregate + score, change vote, per-user dedup, my-vote, retract, public read, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 207");
const slug = "b207";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const cast = (tok, art, helpful) => c.post(`/api/db/${slug}/helpful/${art}`, { helpful }, tok === null ? {} : { token: tok }).then((r) => r.json);
const read = (tok, art) => c.get(`/api/db/${slug}/helpful/${art}`, tok ? { token: tok } : {}).then((r) => r.json);
const retract = (tok, art) => c.del(`/api/db/${slug}/helpful/${art}`, { token: tok }).then((r) => r.json);

// --- Cast (member) ---
let r = await cast(A, "getting-started", true);
t.eq(r.yes, 1, "first yes → yes:1");
t.eq(r.mine, true, "…and mine reflects it");
await cast(B, "getting-started", true);
r = await cast(C, "getting-started", false);
t.eq(r.yes, 2, "two yes votes");
t.eq(r.no, 1, "one no vote");
t.eq(r.total, 3, "total 3");
t.eq(r.score, 67, "score = round(2/3*100) = 67");

// --- Change a vote (per-user dedup, not a second vote) ---
r = await cast(C, "getting-started", true);
t.eq(r.yes, 3, "C flips to yes → yes:3");
t.eq(r.no, 0, "…no:0");
t.eq(r.total, 3, "…still 3 total (dedup per user)");

// --- Public read + my vote ---
t.eq((await read(null, "getting-started")).total, 3, "public reads the aggregate");
t.eq((await read(null, "getting-started")).mine, null, "…signed-out has no mine");
t.eq((await read(B, "getting-started")).mine, true, "signed-in sees their own vote");

// --- Retract ---
r = await retract(C, "getting-started");
t.eq(r.retracted, true, "C retracts");
t.eq(r.total, 2, "…total back to 2");
t.eq(r.mine, null, "…and mine is null");

// --- Unvoted article reads zero ---
r = await read(null, "empty-article");
t.eq(r.total, 0, "unvoted article → total 0");
t.eq(r.score, 0, "…score 0");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/helpful/x`, { helpful: "yes" }, { token: A })).status, 400, "non-boolean helpful → 400");
t.eq((await c.post(`/api/db/${slug}/helpful/x`, {})).status, 401, "signed-out cast → 401");
t.eq((await c.del(`/api/db/${slug}/helpful/x`)).status, 401, "signed-out retract → 401");

t.done(); h.restore();

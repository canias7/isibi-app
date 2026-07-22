// Batch 177 — RATINGS & REVIEWS over any subject. One review per member per subject (re-submit
// upserts, never duplicates), a SQL-computed summary (count / average / distribution), public reads,
// member-owned writes/deletes, admin moderation, and validation guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 177");
const slug = "b177";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 user
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3 user
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const cId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("c@x.dev")[0].id;
const post = (tok, body) => c.post(`/api/db/${slug}/reviews`, body, tok === null ? {} : { token: tok });
const list = (tok, qs) => c.get(`/api/db/${slug}/reviews${qs}`, tok === null ? {} : { token: tok });
const summary = (tok, subj) => c.get(`/api/db/${slug}/reviews/summary?subject=${subj}`, tok === null ? {} : { token: tok });
const mine = (tok, subj) => c.get(`/api/db/${slug}/reviews/mine?subject=${subj}`, { token: tok });
const del = (tok, qs) => c.del(`/api/db/${slug}/reviews${qs}`, { token: tok });

// --- Post + read my own ---
t.eq((await post(B, { subject: "prod1", rating: 5, title: "Great", body: "love it" })).status, 200, "B posts a 5-star review");
t.eq((await mine(B, "prod1")).json.review.rating, 5, "B's /mine shows rating 5");
// re-submitting UPSERTS (not a duplicate)
await post(B, { subject: "prod1", rating: 3 });
t.eq((await mine(B, "prod1")).json.review.rating, 3, "re-submit updates B's rating to 3 (upsert)");
await post(C, { subject: "prod1", rating: 1 });
await post(A, { subject: "prod1", rating: 4 });

// --- Summary aggregate (SQL) ---
let s = (await summary(B, "prod1")).json;
t.eq(s.count, 3, "3 distinct reviewers (B upsert didn't add a row)");
t.eq(s.average, 2.67, "average = (3+1+4)/3 = 2.67");
t.eq(s.distribution, { 1: 1, 2: 0, 3: 1, 4: 1, 5: 0 }, "rating distribution");

// --- Public reads (no token) ---
t.eq((await summary(null, "prod1")).status, 200, "summary is public (no login needed)");
let pub = await list(null, "?subject=prod1");
t.eq([pub.status, pub.json.reviews.length], [200, 3], "list is public and returns all 3");
t.eq((await list(B, "?subject=prod1&sort=top")).json.reviews.map((r) => r.rating), [4, 3, 1], "sort=top orders by rating desc");
t.eq((await list(B, "?subject=prod1&limit=1")).json.reviews.length, 1, "limit caps the page");

// --- Subject isolation ---
t.eq((await summary(B, "prod2")).json.count, 0, "a different subject has its own (empty) summary");

// --- Delete mine ---
t.eq((await del(B, "?subject=prod1")).json.deleted, true, "B deletes their own review");
t.eq((await mine(B, "prod1")).json.review, null, "…and /mine is now null");
t.eq((await summary(B, "prod1")).json.count, 2, "summary drops to 2");
t.eq((await del(B, "?subject=prod1")).status, 404, "deleting a gone review → 404");
t.eq((await mine(B, "prod2")).json.review, null, "/mine for an unreviewed subject → null (no error)");

// --- Admin moderation ---
t.eq((await del(A, `?subject=prod1&user=${cId}`)).json.deleted, true, "admin deletes C's review via &user=");
t.eq((await summary(A, "prod1")).json.count, 1, "only A's review remains");
t.eq((await del(B, `?subject=prod1&user=1`)).status, 403, "a non-admin can't moderate another member's review → 403");

// --- Validation + auth guards ---
t.eq((await post(B, { subject: "p", rating: 6 })).status, 400, "rating > 5 → 400");
t.eq((await post(B, { subject: "p", rating: 0 })).status, 400, "rating < 1 → 400");
t.eq((await post(B, { subject: "p" })).status, 400, "missing rating → 400");
t.eq((await post(B, { rating: 5 })).status, 400, "missing subject → 400");
t.eq((await post(null, { subject: "p", rating: 5 })).status, 401, "post without a token → 401");
t.eq((await c.get(`/api/db/${slug}/reviews/mine?subject=prod1`)).status, 401, "/mine without a token → 401");
t.eq((await list(B, "")).status, 400, "list without a subject → 400");

t.done(); h.restore();

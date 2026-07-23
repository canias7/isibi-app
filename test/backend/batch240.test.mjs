// Batch 240 — WIN/LOSS REASONS. Log a deal outcome (won/lost) with a reason + amount; the summary rolls up
// win rate, value, and a by-reason breakdown. Covers logging, summary (win_rate, values, by_reason), list +
// outcome filter, delete, validation, authz (admin-only throughout).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 240");
const slug = "b240";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const log = (tok, body) => c.post(`/api/db/${slug}/winloss`, body, tok === null ? {} : { token: tok });
const summary = (tok, q) => c.get(`/api/db/${slug}/winloss/summary${q || ""}`, { token: tok }).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/winloss${q || ""}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/winloss/${id}`, { token: tok });

// --- Log outcomes ---
t.eq((await log(A, { outcome: "won", reason: "price", amount: 1000 })).json.outcome, "won", "log a win");
await log(A, { outcome: "won", reason: "features", amount: 2000 });
await log(A, { outcome: "lost", reason: "price", amount: 1500 });
const lostId = (await log(A, { outcome: "lost", reason: "timing", amount: 500 })).json.id;

// --- Summary ---
let s = await summary(A);
t.eq(s.won, 2, "2 wins");
t.eq(s.lost, 2, "2 losses");
t.eq(s.win_rate, 50, "win rate 50%");
t.eq(s.won_value, 3000, "won value 3000");
t.eq(s.lost_value, 2000, "lost value 2000");

// --- by_reason breakdown ---
t.eq(s.by_reason.price.won, 1, "'price' has 1 win");
t.eq(s.by_reason.price.lost, 1, "…and 1 loss");
t.eq(s.by_reason.timing.lost, 1, "'timing' has 1 loss");

// --- List + outcome filter ---
t.eq((await list(A)).entries.length, 4, "list has all 4 entries");
t.eq((await list(A, "?outcome=lost")).entries.length, 2, "outcome=lost → 2");
t.eq((await list(A)).entries[0].amount, 500, "amounts come back in dollars");

// --- Delete ---
t.eq((await del(A, lostId)).json.deleted, true, "admin deletes an entry");
t.eq((await summary(A)).lost, 1, "…summary drops to 1 loss");

// --- Validation + authz (admin-only) ---
t.eq((await log(A, { reason: "x" })).status, 400, "missing outcome → 400");
t.eq((await log(A, { outcome: "maybe" })).status, 400, "a bad outcome → 400");
t.eq((await del(A, 999999)).status, 404, "deleting a missing entry → 404");
t.eq((await log(B, { outcome: "won" })).status, 403, "a member can't log → 403");
t.eq((await summary(B)).status ?? 403, 403, "a member can't read the summary → 403");
t.eq((await c.get(`/api/db/${slug}/winloss/summary`, { token: B })).status, 403, "…confirmed 403");
t.eq((await c.get(`/api/db/${slug}/winloss`)).status, 401, "signed-out list → 401");

t.done(); h.restore();

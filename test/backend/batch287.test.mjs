// Batch 287 — AUDIT-LOG RETENTION. A singleton retention_days policy plus a prune that trims the _audit trail
// older than the window. Covers status, set, prune (by policy + explicit before), row counts, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 287");
const slug = "b287";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const status = (tok) => c.get(`/api/db/${slug}/audit-policy`, { token: tok });
const set = (tok, body) => c.post(`/api/db/${slug}/audit-policy`, body, tok === null ? {} : { token: tok });
const prune = (tok, body) => c.post(`/api/db/${slug}/audit-policy/prune`, body || {}, { token: tok });

// --- Status triggers ensure (creates _audit + _audit_policy) ---
let s = (await status(A)).json;
t.eq(s.audit_rows, 0, "no audit rows yet");
t.eq(s.retention_days, null, "no policy set yet");

// --- Seed audit rows: 3 old (40 days) + 2 recent ---
const db = h.getDb(uuid);
const old = new Date(Date.now() - 40 * 86400000).toISOString();
const now = new Date().toISOString();
for (let i = 0; i < 3; i++) db.prepare("INSERT INTO _audit (row_table, row_id, action, actor_id, at) VALUES (?,?,?,?,?)").run("note", i, "update", 1, old);
for (let i = 0; i < 2; i++) db.prepare("INSERT INTO _audit (row_table, row_id, action, actor_id, at) VALUES (?,?,?,?,?)").run("note", i + 10, "update", 1, now);
s = (await status(A)).json;
t.eq(s.audit_rows, 5, "5 audit rows seeded");
t.eq(s.oldest_at, old, "…oldest_at is the old timestamp");

// --- Set retention + prune by policy ---
t.eq((await set(A, { retention_days: 30 })).json.retention_days, 30, "admin sets a 30-day retention");
let p = (await prune(A)).json;
t.eq(p.deleted, 3, "prune trims the 3 rows older than 30 days");
t.eq((await status(A)).json.audit_rows, 2, "…2 rows remain");

// --- Prune with an explicit before (removes everything before tomorrow) ---
const tomorrow = new Date(Date.now() + 86400000).toISOString();
t.eq((await prune(A, { before: tomorrow })).json.deleted, 2, "an explicit before prunes the rest");
t.eq((await status(A)).json.audit_rows, 0, "…all gone");

// --- Validation + authz ---
t.eq((await set(A, { retention_days: 0 })).status, 400, "retention_days < 1 → 400");
t.eq((await set(A, { retention_days: 99999 })).status, 400, "retention_days too large → 400");
t.eq((await prune(A, { before: "not-a-date" })).status, 400, "a bad before → 400");
t.eq((await set(B, { retention_days: 30 })).status, 403, "a member can't set retention → 403");
t.eq((await status(B)).status, 403, "a member can't read the policy → 403");
t.eq((await c.get(`/api/db/${slug}/audit-policy`)).status, 401, "signed-out → 401");

t.done(); h.restore();

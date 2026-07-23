// Batch 187 — AUDIT-LOG QUERY (enhanced). The `_audit` trail is written by AFTER-triggers on audit:true
// tables; the admin /audit endpoint reads it back. This exercises the added filters (actor, since/until,
// offset) and the tightened action filter (exact match — an unknown action now yields 0, not everything).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 187");
const slug = "b187";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", audit: true, columns: [{ name: "body", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const audit = (tok, qs) => c.get(`/api/db/${slug}/audit${qs || ""}`, { token: tok }).then((r) => r.json.audit);

// Generate a trail: B inserts 2 posts, edits one, deletes one (owner_id = B → actor_id 2).
await c.post(`/api/db/${slug}/rows/posts`, { body: "one" }, { token: B });
await c.post(`/api/db/${slug}/rows/posts`, { body: "two" }, { token: B });
const rows = (await c.get(`/api/db/${slug}/rows/posts`, { token: B })).json.rows;
await c.patch(`/api/db/${slug}/rows/posts/${rows[0].id}`, { body: "one-edited" }, { token: B });
await c.del(`/api/db/${slug}/rows/posts/${rows[1].id}`, { token: B });

// --- Read + basic shape ---
let all = await audit(A);
t.ok(all.length >= 4, "the trail captured all four writes");
t.eq(all[0].action, "delete", "newest-first: the delete is on top");
t.ok(all.every((r) => r.row_table === "posts" && r.actor_id === 2), "every entry is posts / actor B(2)");

// --- action filter is now an EXACT match ---
t.eq((await audit(A, "?action=insert")).length, 2, "?action=insert → 2");
t.eq((await audit(A, "?action=update")).length, 1, "?action=update → 1");
t.eq((await audit(A, "?action=nope")).length, 0, "an unknown action now filters to 0 (was: returned everything)");

// --- new filters: actor, table, since/until, limit/offset ---
t.eq((await audit(A, "?actor=2")).length, all.length, "?actor=2 → B's entries");
t.eq((await audit(A, "?actor=999")).length, 0, "?actor=999 → none");
t.eq((await audit(A, "?table=posts")).length, all.length, "?table=posts → all");
t.eq((await audit(A, "?table=other")).length, 0, "?table=other → none");
t.eq((await audit(A, "?since=2000-01-01")).length, all.length, "?since far-past → all");
t.eq((await audit(A, "?until=2000-01-01")).length, 0, "?until far-past → none");
t.eq((await audit(A, "?limit=1")).length, 1, "?limit=1 → one row");
t.eq((await audit(A, "?limit=2&offset=1")).map((r) => r.id).join(","), all.slice(1, 3).map((r) => r.id).join(","), "?offset skips the newest");

// --- Authz ---
t.eq((await c.get(`/api/db/${slug}/audit`, { token: B })).status, 403, "a non-admin can't read the trail → 403");
t.eq((await c.get(`/api/db/${slug}/audit`)).status, 401, "signed-out → 401");

t.done(); h.restore();

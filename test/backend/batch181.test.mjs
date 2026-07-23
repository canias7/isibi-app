// Batch 181 — THREADED COMMENTS on any (table, row). Post + reply, public thread read, per-member edit,
// soft-delete with the tombstone rule (a deleted comment stays as {deleted:true, body:null} ONLY while it
// has a live reply, else it's omitted), admin moderation, count, and validation/auth guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 181");
const slug = "b181";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: [{ name: "title", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
await c.post(`/api/db/${slug}/rows/posts`, { title: "hello" }, { token: B });
const R = (await c.get(`/api/db/${slug}/rows/posts`, { token: B })).json.rows[0].id;
const add = (tok, body) => c.post(`/api/db/${slug}/comments`, body, tok === null ? {} : { token: tok });
const thread = (tok, row) => c.get(`/api/db/${slug}/comments?table=posts&row=${row === undefined ? R : row}`, tok === null ? {} : { token: tok }).then((r) => r.json.comments);
const count = (row) => c.get(`/api/db/${slug}/comments/count?table=posts&row=${row === undefined ? R : row}`).then((r) => r.json.count);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/comments/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/comments/${id}`, { token: tok });

// --- Post + reply ---
const c1 = (await add(B, { table: "posts", row: R, body: "first!" })).json.id;
const c2 = (await add(C, { table: "posts", row: R, body: "a reply", parent: c1 })).json.id;
t.ok(c1 && c2, "a comment and a reply were created");
let th = await thread(null); // public read, no token
t.eq(th.map((x) => x.id), [c1, c2], "thread reads oldest-first (public, no login)");
t.eq(th.find((x) => x.id === c2).parent_id, c1, "the reply carries its parent_id");
t.eq(await count(), 2, "count = 2 live comments");
t.eq(await count(9999), 0, "a different row has an empty thread");

// --- Edit mine ---
t.eq((await patch(B, c1, { body: "first (edited)" })).json.updated, true, "B edits their own comment");
t.eq((await thread(B)).find((x) => x.id === c1).body, "first (edited)", "…the body updated");
t.eq((await patch(B, c2, { body: "hax" })).status, 404, "B can't edit C's comment → 404");

// --- Soft-delete tombstone rule ---
t.eq((await del(B, c1)).json.deleted, true, "B soft-deletes c1 (which still has a live reply)");
th = await thread(null);
t.eq(th.length, 2, "…c1 remains as a tombstone (it has a reply)");
let tomb = th.find((x) => x.id === c1);
t.eq([tomb.deleted, tomb.body], [true, null], "…shown as {deleted:true, body:null}");
t.eq(await count(), 1, "count drops to 1 (deleted excluded)");
// remove the only live reply → c1 has nothing hanging off it → both vanish
t.eq((await del(C, c2)).json.deleted, true, "C deletes the reply c2");
t.eq((await thread(null)).length, 0, "with no live reply, the deleted c1 is omitted entirely");
t.eq(await count(), 0, "count 0");

// --- Admin moderation ---
const c4 = (await add(C, { table: "posts", row: R, body: "spam" })).json.id;
t.eq((await del(A, c4)).json.deleted, true, "an admin can delete anyone's comment");
const c5 = (await add(C, { table: "posts", row: R, body: "mine" })).json.id;
t.eq((await del(B, c5)).status, 404, "a non-admin can't delete another member's comment → 404");

// --- Reply/target validation ---
await c.post(`/api/db/${slug}/rows/posts`, { title: "second" }, { token: B });
const R2 = (await c.get(`/api/db/${slug}/rows/posts?sort=id&order=desc&limit=1`, { token: B })).json.rows[0].id;
t.eq((await add(B, { table: "posts", row: R2, body: "x", parent: c5 })).status, 400, "a reply's parent must be on the SAME row → 400");
t.eq((await add(B, { table: "posts", row: R, body: "x", parent: 999999 })).status, 400, "reply to a non-existent parent → 400");
t.eq((await add(B, { table: "ghost", row: 1, body: "x" })).status, 404, "comment on an unknown table → 404");
t.eq((await add(B, { table: "posts", row: R })).status, 400, "missing body → 400");
t.eq((await add(B, { table: "posts", body: "x" })).status, 400, "missing row → 400");

// --- Auth guards ---
t.eq((await add(null, { table: "posts", row: R, body: "x" })).status, 401, "post without a token → 401");
t.eq((await c.patch(`/api/db/${slug}/comments/${c5}`, { body: "x" })).status, 401, "patch without a token → 401");
t.eq((await c.del(`/api/db/${slug}/comments/${c5}`)).status, 401, "delete without a token → 401");

t.done(); h.restore();

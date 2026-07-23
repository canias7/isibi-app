// Batch 183 — @MENTIONS. A member records that ANOTHER member was tagged; the mentioned member reads
// THEIR OWN mentions and marks them seen. Privacy/IDOR: every read/mutate is scoped to mentioned_user =
// caller (a member never sees the sender view and can't touch a mention addressed to someone else).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 183");
const slug = "b183";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const cId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("c@x.dev")[0].id;
const mention = (tok, body) => c.post(`/api/db/${slug}/mentions`, body, tok === null ? {} : { token: tok });
const mineOf = (tok, qs) => c.get(`/api/db/${slug}/mentions/mine${qs || ""}`, { token: tok }).then((r) => r.json.mentions);
const unseen = (tok) => c.get(`/api/db/${slug}/mentions/unseen-count`, { token: tok }).then((r) => r.json.count);
const seen = (tok, id) => c.post(`/api/db/${slug}/mentions/${id}/seen`, {}, { token: tok });
const seenAll = (tok) => c.post(`/api/db/${slug}/mentions/seen-all`, {}, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/mentions/${id}`, { token: tok });

// --- B tags C twice ---
const m1 = (await mention(B, { user: cId, ref_table: "comments", ref_id: 5, context: "hey @C" })).json.id;
const m2 = (await mention(B, { user: cId, context: "again @C" })).json.id;
t.ok(m1 && m2, "two mentions of C created");

// --- C reads mentions OF THEM ---
let mine = await mineOf(C);
t.eq(mine.map((x) => x.id), [m2, m1], "C sees their mentions, newest-first");
t.eq([mine[0].by_user, mine[0].mentioned_user, mine[1].ref_table], [2, cId, "comments"], "sender=B, target=C, ref preserved");
t.eq(await unseen(C), 2, "2 unseen");

// --- Mark one seen, then all ---
t.eq((await seen(C, m1)).json.seen, true, "C marks m1 seen");
t.eq(await unseen(C), 1, "1 unseen left");
t.eq((await mineOf(C, "?unseen=1")).map((x) => x.id), [m2], "?unseen=1 lists only the unseen one");
t.eq((await seenAll(C)).json.updated, 1, "seen-all clears the remaining 1");
t.eq(await unseen(C), 0, "0 unseen");

// --- Delete one of mine ---
t.eq((await del(C, m2)).json.deleted, true, "C deletes m2");
t.eq((await mineOf(C)).map((x) => x.id), [m1], "…m1 remains");

// --- Privacy / IDOR: B is not the target, so can't see or touch C's mentions ---
t.eq((await mineOf(B)).length, 0, "B (never mentioned) has an empty inbox — sender view is not exposed");
t.eq((await seen(B, m1)).status, 404, "B can't mark C's mention seen → 404");
t.eq((await del(B, m1)).status, 404, "B can't delete C's mention → 404");

// --- Create validation ---
t.eq((await mention(B, { user: 999999 })).status, 404, "mentioning a non-existent user → 404");
t.eq((await mention(B, {})).status, 400, "missing user → 400");

// --- Guards ---
t.eq((await mention(null, { user: cId })).status, 401, "signed-out create → 401");
t.eq((await c.get(`/api/db/${slug}/mentions/mine`)).status, 401, "signed-out /mine → 401");
t.eq((await c.get(`/api/db/${slug}/mentions/unseen-count`)).status, 401, "signed-out unseen-count → 401");

t.done(); h.restore();

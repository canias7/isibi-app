// Batch 309 — KUDOS / PEER RECOGNITION. A member gives kudos to another; a leaderboard ranks receivers.
// Covers give, no-self, received/given views, leaderboard ranking, admin all, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 309");
const slug = "b309";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (e) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(e)[0].id;
const b2 = idOf("b@x.dev"), c3 = idOf("c@x.dev");
const give = (tok, body) => c.post(`/api/db/${slug}/kudos`, body, tok === null ? {} : { token: tok });
const board = (tok) => c.get(`/api/db/${slug}/kudos/leaderboard`, { token: tok }).then((r) => r.json);
const received = (tok) => c.get(`/api/db/${slug}/kudos/received`, { token: tok }).then((r) => r.json);
const given = (tok) => c.get(`/api/db/${slug}/kudos/given`, { token: tok }).then((r) => r.json);
const all = (tok) => c.get(`/api/db/${slug}/kudos`, { token: tok });

// --- Give ---
t.ok((await give(A, { to: b2, message: "great work" })).json.id, "A gives B kudos");
await give(C, { to: b2 });          // B now has 2
await give(A, { to: c3 });          // C has 1

// --- Received / given ---
t.eq((await received(B)).received.length, 2, "B received 2 kudos");
t.eq((await given(A)).given.length, 2, "A gave 2 kudos");
t.eq((await received(A)).received.length, 0, "A received none");

// --- Leaderboard ---
let lb = (await board(B)).leaderboard;
t.eq(lb[0].user_id, b2, "B tops the leaderboard");
t.eq(lb[0].kudos, 2, "…with 2 kudos");
t.eq(lb[0].rank, 1, "…ranked first");
t.ok(lb.find((x) => x.user_id === c3 && x.kudos === 1), "C has 1");

// --- Admin sees all ---
t.eq((await all(A)).json.kudos.length, 3, "admin sees all kudos");

// --- Validation + authz ---
t.eq((await give(B, { to: b2 })).status, 400, "you can't kudos yourself → 400");
t.eq((await give(A, { to: 999999 })).status, 404, "an unknown recipient → 404");
t.eq((await give(A, {})).status, 400, "a missing recipient → 400");
t.eq((await all(B)).status, 403, "a member can't read all kudos → 403");
t.eq((await c.post(`/api/db/${slug}/kudos`, { to: b2 })).status, 401, "signed-out → 401");

t.done(); h.restore();

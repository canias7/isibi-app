// Batch 141 — blocking crosses into DMs + the home feed:
//   a block (existing /block graph) now also STOPS the blocked member's direct messages,
//   and the home feed honors ?hideBlocked=1 to drop blocked authors.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 141");
const slug = "b141";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: [{ name: "body", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const send = (to, body, tok) => c.post(`/api/db/${slug}/dm`, { to, body }, { token: tok });
const block = (id, on, tok) => c.post(`/api/db/${slug}/block/${id}`, { on }, { token: tok });
const feed = (tok, q) => c.get(`/api/db/${slug}/feed?table=posts${q || ""}`, { token: tok });

// Baseline: with no block, B can DM A.
t.eq((await send(1, "hi A", B)).status, 200, "no block → B can DM A");

// A blocks B (id2) via the existing /block route.
t.eq((await block(2, "on", A)).json.blocking, true, "A blocks B");

// Now B's DM to A is refused with 403 code:blocked.
let r = await send(1, "still here", B);
t.eq(r.status, 403, "blocked member's DM → 403");
t.eq(r.json.code, "blocked", "…with code:blocked");
// A can still message B (the block is one-directional; only the blocker's inbox is protected).
t.eq((await send(2, "you're blocked, fyi", A)).status, 200, "A → B still works (block protects only A's inbox)");

// Feed: A follows B, B posts, ?hideBlocked=1 drops B's post while the default feed keeps it.
await c.post(`/api/db/${slug}/follow/2`, { on: true }, { token: A }); // A re-follows B (block severed it)
await c.post(`/api/db/${slug}/rows/posts`, { body: "from B" }, { token: B });
t.eq((await feed(A)).json.rows.length, 1, "default feed shows the followed author (hideBlocked is opt-in)");
t.eq((await feed(A, "&hideBlocked=1")).json.rows.length, 0, "?hideBlocked=1 drops the blocked author");

// Unblock restores DMs.
t.eq((await block(2, "off", A)).json.blocking, false, "A unblocks B");
t.eq((await send(1, "back in", B)).status, 200, "after unblock B can DM A again");
t.eq((await feed(A, "&hideBlocked=1")).json.rows.length, 1, "after unblock, hideBlocked no longer drops B");

// Guard: signed-out DM still 401.
t.eq((await c.post(`/api/db/${slug}/dm`, { to: 1, body: "x" })).status, 401, "signed-out DM → 401");

t.done(); h.restore();

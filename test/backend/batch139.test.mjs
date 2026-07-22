// Batch 139 — HOME FEED: a timeline of posts owned by the accounts the caller follows
// (reuses the existing /follow/<id> graph; the feed endpoint is the new part)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 139");
const slug = "b139";
await c.ensure(slug);
await c.schema(slug, { tables: {
  posts: { access: "feed", trash: true, columns: [{ name: "body", type: "text" }] }, // public read, member writes own
  priv: { access: "user", columns: [{ name: "x", type: "text" }] },                    // not a public-owned feed table (still owner-scoped)
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const C = (await c.signup(slug, "cc@x.dev", "Str0ng-pass-9")).json.token; // id4
const follow = (id, tok) => c.post(`/api/db/${slug}/follow/${id}`, { on: true }, { token: tok }); // existing route
const feed = (tok, q) => c.get(`/api/db/${slug}/feed?table=posts${q || ""}`, { token: tok });

// A follows B(3) and C(4) via the existing follow graph.
t.eq((await follow(3, A)).status, 200, "A follows B");
await follow(4, A);

// Everyone posts.
await c.post(`/api/db/${slug}/rows/posts`, { body: "from B #1" }, { token: B });
await c.post(`/api/db/${slug}/rows/posts`, { body: "from C #1" }, { token: C });
await c.post(`/api/db/${slug}/rows/posts`, { body: "from A self" }, { token: A });
await c.post(`/api/db/${slug}/rows/posts`, { body: "from admin (unfollowed)" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/posts`, { body: "from B #2" }, { token: B });

// A's feed = only B's and C's posts, newest-first, excluding self + non-followees.
let fd = (await feed(A)).json;
const bodies = fd.rows.map((r) => r.body);
t.ok(bodies.includes("from B #1") && bodies.includes("from B #2") && bodies.includes("from C #1"), "feed has followees' posts");
t.ok(!bodies.includes("from A self"), "feed excludes the caller's own posts");
t.ok(!bodies.includes("from admin (unfollowed)"), "feed excludes non-followees");
t.eq(bodies[0], "from B #2", "feed is newest-first");
t.eq(fd.rows.length, 3, "exactly the 3 followee posts");

// Keyset pagination via ?before / next_before.
let pg1 = (await feed(A, "&limit=2")).json;
t.eq(pg1.rows.length, 2, "page 1 has 2");
t.ok(pg1.next_before, "cursor returned when full page");
let pg2 = (await feed(A, "&limit=2&before=" + pg1.next_before)).json;
t.eq(pg2.rows.length, 1, "page 2 has the remaining 1");
t.ok(pg2.rows[0].id < pg1.rows[1].id, "page 2 is older than page 1");

// Unfollow C → C's posts leave the feed.
await c.post(`/api/db/${slug}/follow/4`, { on: false }, { token: A });
t.ok(!(await feed(A)).json.rows.map((r) => r.body).includes("from C #1"), "after unfollow, C's posts gone");
t.eq((await feed(A)).json.rows.length, 2, "feed down to B's 2 posts");

// A trashed post drops out of the feed (respects the table's trash).
const bId = (await feed(A)).json.rows.find((r) => r.body === "from B #1").id;
await c.del(`/api/db/${slug}/rows/posts/${bId}`, { token: B }); // soft-delete on a trash table
t.ok(!(await feed(A)).json.rows.map((r) => r.body).includes("from B #1"), "trashed post excluded from feed");

// A member with no follows has an empty feed.
t.eq((await feed(C)).json.rows.length, 0, "no follows → empty feed");

// Guards.
t.eq((await c.get(`/api/db/${slug}/feed?table=nope`, { token: A })).status, 404, "unknown table → 404");
t.eq((await c.get(`/api/db/${slug}/feed?table=priv`, { token: A })).status, 400, "a `user` (private) table is rejected — feeds are for public `feed` tables only");
t.eq((await c.get(`/api/db/${slug}/feed`, { token: A })).status, 400, "missing table → 400");
t.eq((await c.get(`/api/db/${slug}/feed?table=posts`)).status, 401, "signed-out → 401");

t.done(); h.restore();

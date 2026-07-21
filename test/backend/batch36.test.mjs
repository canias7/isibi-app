// Batch 36 — Block another member (+ ?hideBlocked feed filter, severs follows)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 36");

const slug = "b36";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: { title: "text" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // 2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // 3
await c.post(`/api/db/${slug}/rows/posts`, { title: "byA" }, { token: A });
await c.post(`/api/db/${slug}/rows/posts`, { title: "byB" }, { token: B });
await c.post(`/api/db/${slug}/rows/posts`, { title: "byC" }, { token: C });

const titles = (qs, tok) => c.get(`/api/db/${slug}/rows/posts${qs || ""}`, tok ? { token: tok } : undefined).then((r) => (r.json.rows || []).map((x) => x.title).sort());

// A blocks B
let r = await c.post(`/api/db/${slug}/block/2`, {}, { token: A });
t.ok(r.json.blocking === true, "A blocks B -> blocking true");
// state
t.ok((await c.get(`/api/db/${slug}/block/2`, { token: A })).json.blocking === true, "GET block/2 as A -> blocking");
t.ok((await c.get(`/api/db/${slug}/block/3`, { token: A })).json.blocking === false, "GET block/3 as A -> not blocking");
// list
t.eq((await c.get(`/api/db/${slug}/blocks`, { token: A })).json.blocked, [2], "A's blocked list = [2]");

// ?hideBlocked=1 removes B's posts for A
t.eq(await titles("?hideBlocked=1", A), ["byA", "byC"], "A feed w/ hideBlocked excludes byB");
// default feed still shows all (opt-in filter)
t.eq(await titles("", A), ["byA", "byB", "byC"], "default feed shows all (hideBlocked is opt-in)");
// hideBlocked ignored for anon
t.eq(await titles("?hideBlocked=1"), ["byA", "byB", "byC"], "anon hideBlocked ignored");

// block severs follows: A follows B, then blocks -> follow gone
await c.post(`/api/db/${slug}/block/2`, { on: false }, { token: A }); // unblock first
await c.post(`/api/db/${slug}/follow/2`, {}, { token: A }); // A follows B
t.ok((await c.get(`/api/db/${slug}/follow/2`, { token: A })).json.mine === true, "A follows B");
await c.post(`/api/db/${slug}/block/2`, {}, { token: A }); // block B
t.ok((await c.get(`/api/db/${slug}/follow/2`, { token: A })).json.mine === false, "blocking B severs A->B follow");

// hideBlocked composes with following
await c.post(`/api/db/${slug}/block/2`, { on: false }, { token: A });
await c.post(`/api/db/${slug}/follow/2`, {}, { token: A });
await c.post(`/api/db/${slug}/follow/3`, {}, { token: A }); // follows B and C
await c.post(`/api/db/${slug}/block/3`, {}, { token: A }); // block C (also severs)
t.eq(await titles("?following=1&hideBlocked=1", A), ["byB"], "following + hideBlocked -> only byB");

// guards
t.ok((await c.post(`/api/db/${slug}/block/1`, {}, { token: A })).status === 400, "can't block yourself -> 400");
t.ok((await c.post(`/api/db/${slug}/block/2`, {})).status === 401, "block needs auth -> 401");

t.done();
h.restore();

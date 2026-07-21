// Batch 26 — Following feed (?following=1): a feed filtered to authors you follow
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 26");

const slug = "b26";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: { title: "text" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id 2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id 3

await c.post(`/api/db/${slug}/rows/posts`, { title: "byA" }, { token: A });
await c.post(`/api/db/${slug}/rows/posts`, { title: "byB" }, { token: B });
await c.post(`/api/db/${slug}/rows/posts`, { title: "byC" }, { token: C });

const titles = (qs, tok) => c.get(`/api/db/${slug}/rows/posts${qs || ""}`, tok ? { token: tok } : undefined).then((r) => (r.json.rows || []).map((x) => x.title).sort());

// default feed shows everyone
t.eq(await titles(), ["byA", "byB", "byC"], "default feed shows all authors");

// A follows B only -> ?following=1 shows only B's posts
await c.post(`/api/db/${slug}/follow/2`, {}, { token: A });
t.eq(await titles("?following=1", A), ["byB"], "A follows B -> following feed = byB");

// A also follows C -> now B and C
await c.post(`/api/db/${slug}/follow/3`, {}, { token: A });
t.eq(await titles("?following=1", A), ["byB", "byC"], "A follows B,C -> following feed = byB,byC");

// following feed composes with where filter
t.eq(await titles("?following=1&where=title:eq:byC", A), ["byC"], "following feed composes with where");

// signed-out ?following=1 is ignored (shows all)
t.eq(await titles("?following=1"), ["byA", "byB", "byC"], "anon ?following=1 -> ignored, shows all");

// a user who follows nobody -> empty following feed
t.eq(await titles("?following=1", B), [], "B follows nobody -> empty following feed");

// following feed excludes your own posts unless you follow yourself (you can't) -> A's own not present
t.ok(!(await titles("?following=1", A)).includes("byA"), "own posts not in following feed");

t.done();
h.restore();

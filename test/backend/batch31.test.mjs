// Batch 31 — content reports / flags + moderation queue
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 31");

const slug = "b31";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: { title: "text" } } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // first -> admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/posts`, { title: "spam" }, { token: B }); // post id 1

// B and C report posts:1
let r = await c.post(`/api/db/${slug}/report/posts:1`, { reason: "spam" }, { token: B });
t.ok(r.json.reported === true && r.json.count === 1, "B reports -> reported, count 1");
r = await c.post(`/api/db/${slug}/report/posts:1`, { reason: "abuse" }, { token: C });
t.ok(r.json.count === 2, "C reports -> count 2");
// dedup: B reporting again doesn't add
r = await c.post(`/api/db/${slug}/report/posts:1`, { reason: "again" }, { token: B });
t.ok(r.json.count === 2, "B re-report deduped -> still 2");

// state
r = await c.get(`/api/db/${slug}/report/posts:1`, { token: B });
t.ok(r.json.count === 2 && r.json.mine === true, "report state: count 2, mine true (B)");
r = await c.get(`/api/db/${slug}/report/posts:1`, { token: ADMIN });
t.ok(r.json.mine === false, "admin hasn't reported -> mine false");

// report needs auth
t.ok((await c.post(`/api/db/${slug}/report/posts:1`, { reason: "x" })).status === 401, "report needs auth -> 401");

// moderation queue: admin sees open reports
r = await c.get(`/api/db/${slug}/reports`, { token: ADMIN });
t.ok(r.json.reports.length === 2 && r.json.reports.every((x) => x.status === "open"), "admin queue shows 2 open reports");
t.ok(r.json.reports[0].reporter_name != null || r.json.reports[0].reporter_id != null, "reports carry reporter info");

// non-admin can't see the queue
t.ok((await c.get(`/api/db/${slug}/reports`, { token: B })).status === 403, "non-admin queue -> 403");
t.ok((await c.get(`/api/db/${slug}/reports`)).status === 401, "anon queue -> 401");

// resolve one
const rid = r.json.reports[0].id;
t.ok((await c.post(`/api/db/${slug}/reports/${rid}`, { action: "resolve" }, { token: ADMIN })).json.status === "resolved", "resolve -> resolved");
// queue now shows 1 open
t.ok((await c.get(`/api/db/${slug}/reports`, { token: ADMIN })).json.reports.length === 1, "queue now 1 open");
// status=all shows both
t.ok((await c.get(`/api/db/${slug}/reports?status=all`, { token: ADMIN })).json.reports.length === 2, "?status=all shows both");
// bad action rejected
t.ok((await c.post(`/api/db/${slug}/reports/${rid}`, { action: "nuke" }, { token: ADMIN })).status === 400, "bad action -> 400");
// non-admin can't resolve
t.ok((await c.post(`/api/db/${slug}/reports/${rid}`, { action: "resolve" }, { token: B })).status === 403, "non-admin resolve -> 403");

t.done();
h.restore();

// Batch 25 — scheduled publish (publish_at): hide rows until their publish time
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 25");

const future = new Date(Date.now() + 86400e3).toISOString();
const past = new Date(Date.now() - 86400e3).toISOString();

const slug = "b25";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", scheduled: true, columns: { title: "text" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;

await c.post(`/api/db/${slug}/rows/posts`, { title: "live-now" }, { token: A });              // no publish_at -> live
await c.post(`/api/db/${slug}/rows/posts`, { title: "already", publish_at: past }, { token: A }); // past -> live
await c.post(`/api/db/${slug}/rows/posts`, { title: "scheduled", publish_at: future }, { token: A }); // future -> hidden

const titles = (qs) => c.get(`/api/db/${slug}/rows/posts${qs || ""}`).then((r) => (r.json.rows || []).map((x) => x.title).sort());

t.eq(await titles(), ["already", "live-now"], "default hides not-yet-published");
t.eq(await titles("?scheduled=1"), ["scheduled"], "?scheduled=1 -> only future/draft");
t.eq(await titles("?withScheduled=1"), ["already", "live-now", "scheduled"], "?withScheduled=1 -> all");

// single GET of a scheduled row hidden by default, visible with ?withScheduled=1
const sched = (await c.get(`/api/db/${slug}/rows/posts?withScheduled=1`)).json.rows.find((r) => r.title === "scheduled");
t.ok((await c.get(`/api/db/${slug}/rows/posts/${sched.id}`)).json.row === null, "single GET of scheduled -> null");
t.ok((await c.get(`/api/db/${slug}/rows/posts/${sched.id}?withScheduled=1`)).json.row.title === "scheduled", "?withScheduled=1 single GET visible");

// publish now by nulling publish_at (app-writable) -> appears
await c.patch(`/api/db/${slug}/rows/posts/${sched.id}`, { publish_at: past }, { token: A });
t.eq(await titles(), ["already", "live-now", "scheduled"], "moving publish_at to past makes it live");

// publish_at is sortable/queryable (no SQL error)
t.ok((await c.get(`/api/db/${slug}/rows/posts?sort=publish_at&withScheduled=1`)).json.ok, "?sort=publish_at works");

t.done();
h.restore();

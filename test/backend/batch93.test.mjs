// Batch 93 — version diff: GET /rows/<t>/<id>/diff shows what changed vs a history snapshot
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 93");
const slug = "b93";
await c.ensure(slug);
await c.schema(slug, { tables: {
  docs: { access: "admin", history: true, columns: [{ name: "title", type: "text" }, { name: "body", type: "text" }, { name: "status", type: "text" }] },
  plain: { access: "admin", columns: [{ name: "x", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/docs`, { title: "Draft", body: "hello", status: "draft" }, { token: ADMIN }); // id1
// edit 1 → snapshot of {Draft/hello/draft} stored, row becomes {Final/hello/draft}
await c.patch(`/api/db/${slug}/rows/docs/1`, { title: "Final" }, { token: ADMIN });
// edit 2 → snapshot of {Final/hello/draft}, row becomes {Final/hello world/published}
await c.patch(`/api/db/${slug}/rows/docs/1`, { body: "hello world", status: "published" }, { token: ADMIN });

// default diff = latest snapshot vs current → the last edit's changes (body + status)
let d = (await c.get(`/api/db/${slug}/rows/docs/1/diff`, { token: ADMIN })).json;
t.ok(d.ok, "diff ok");
t.eq(d.changed, 2, "2 fields changed in the last edit");
t.eq(d.changes.body.from, "hello", "body from");
t.eq(d.changes.body.to, "hello world", "body to");
t.eq(d.changes.status.from, "draft", "status from");
t.eq(d.changes.status.to, "published", "status to");
t.ok(!d.changes.title, "title unchanged in the last edit (not in diff)");

// diff a SPECIFIC (earlier) snapshot vs current → cumulative changes since then
let hist = (await c.get(`/api/db/${slug}/rows/docs/1/history`, { token: ADMIN })).json.history;
const firstRev = hist[hist.length - 1].id; // oldest snapshot (the original Draft/hello/draft)
let d2 = (await c.get(`/api/db/${slug}/rows/docs/1/diff/${firstRev}`, { token: ADMIN })).json;
t.eq(d2.changed, 3, "vs the original snapshot: all three fields changed");
t.eq(d2.changes.title.from, "Draft", "title changed from Draft");
t.eq(d2.changes.title.to, "Final", "title changed to Final");

// ?rev= works too
let d3 = (await c.get(`/api/db/${slug}/rows/docs/1/diff?rev=${firstRev}`, { token: ADMIN })).json;
t.eq(d3.changed, 3, "?rev= selects the snapshot");

// guards
t.eq((await c.get(`/api/db/${slug}/rows/plain/1/diff`, { token: ADMIN })).status, 400, "no history → 400");
t.eq((await c.post(`/api/db/${slug}/rows/docs/1/diff`, {}, { token: ADMIN })).status, 405, "read-only");
// a row with no edits yet → no snapshot
await c.post(`/api/db/${slug}/rows/docs`, { title: "Fresh" }, { token: ADMIN }); // id2, never edited
t.eq((await c.get(`/api/db/${slug}/rows/docs/2/diff`, { token: ADMIN })).status, 404, "no snapshot yet → 404");

t.done(); h.restore();

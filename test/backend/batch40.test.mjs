// Batch 40 — Row history + revert ("history":true)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 40");

const slug = "b40";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    docs: { access: "feed", history: true, columns: { title: "text", body: "text" } },
    plain: { access: "feed", columns: { title: "text" } }, // no history
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // 2

await c.post(`/api/db/${slug}/rows/docs`, { title: "v1", body: "b1" }, { token: A });
const id = (await c.get(`/api/db/${slug}/rows/docs`)).json.rows[0].id;
// edit twice -> two snapshots (of the pre-edit states)
await c.patch(`/api/db/${slug}/rows/docs/${id}`, { title: "v2" }, { token: A });
await c.patch(`/api/db/${slug}/rows/docs/${id}`, { title: "v3", body: "b3" }, { token: A });

// history (owner) -> 2 snapshots, newest first (the v2 state, then the v1 state)
let r = await c.get(`/api/db/${slug}/rows/docs/${id}/history`, { token: A });
t.ok(r.json.history.length === 2, "two history snapshots after two edits");
t.ok(r.json.history[0].snapshot.title === "v2" && r.json.history[0].snapshot.body === "b1", "newest snapshot = pre-3rd-edit state (v2/b1)");
t.ok(r.json.history[1].snapshot.title === "v1", "oldest snapshot = original (v1)");

// current row is v3
t.ok((await c.get(`/api/db/${slug}/rows/docs/${id}`)).json.row.title === "v3", "current row is v3");

// revert to the oldest snapshot (v1)
const oldest = r.json.history[1].id;
r = await c.post(`/api/db/${slug}/rows/docs/${id}/revert/${oldest}`, {}, { token: A });
t.ok(r.json.ok && r.json.reverted === id, "revert ok");
const row = (await c.get(`/api/db/${slug}/rows/docs/${id}`)).json.row;
t.ok(row.title === "v1" && row.body === "b1", "row restored to v1/b1");
// revert itself was recorded -> now 3 snapshots
t.ok((await c.get(`/api/db/${slug}/rows/docs/${id}/history`, { token: A })).json.history.length === 3, "revert is itself recorded (3 snapshots)");

// scope: B (not owner) can't view or revert A's row history
t.ok((await c.get(`/api/db/${slug}/rows/docs/${id}/history`, { token: B })).status === 404, "non-owner history -> 404");
t.ok((await c.post(`/api/db/${slug}/rows/docs/${id}/revert/${oldest}`, {}, { token: B })).status === 404, "non-owner revert -> 404");
// anon
t.ok((await c.get(`/api/db/${slug}/rows/docs/${id}/history`)).status === 401, "anon history -> 401");

// table without history -> 400
await c.post(`/api/db/${slug}/rows/plain`, { title: "x" }, { token: A });
const pid = (await c.get(`/api/db/${slug}/rows/plain`)).json.rows[0].id;
t.ok((await c.get(`/api/db/${slug}/rows/plain/${pid}/history`, { token: A })).status === 400, "history on non-history table -> 400");

// bad snapshot id -> 404
t.ok((await c.post(`/api/db/${slug}/rows/docs/${id}/revert/99999`, {}, { token: A })).status === 404, "revert unknown snapshot -> 404");

t.done();
h.restore();

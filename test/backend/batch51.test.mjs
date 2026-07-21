import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 51");
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const slug = "b51";
await c.ensure(slug);
await c.schema(slug, { tables: { todos: { access: "feed", sync: true, columns: { title: "text" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
// initial: create 3
for (const ti of ["t1","t2","t3"]) await c.post(`/api/db/${slug}/rows/todos`, { title: ti }, { token: A });
// full pull (no since)
let r = await c.get(`/api/db/${slug}/rows/todos/changes?sync=`);
t.ok(r.json.updated.length === 3 && r.json.deleted.length === 0, "full pull -> 3 updated, 0 deleted");
const cursor = r.json.at;
t.ok(typeof cursor === "string" && cursor.length > 10, "returns an 'at' cursor");
const ids = {}; for (const row of r.json.updated) ids[row.title] = row.id;

await sleep(1100); // cross a second boundary so updated_at/deleted timestamps are after the cursor
// edit t1, delete t2, add t4
await c.patch(`/api/db/${slug}/rows/todos/${ids.t1}`, { title: "t1-edited" }, { token: A });
await c.del(`/api/db/${slug}/rows/todos/${ids.t2}`, { token: A });
await c.post(`/api/db/${slug}/rows/todos`, { title: "t4" }, { token: A });

// incremental sync since cursor -> updated: t1-edited + t4 ; deleted: [t2 id]
r = await c.get(`/api/db/${slug}/rows/todos/changes?sync=${encodeURIComponent(cursor)}`);
const upTitles = r.json.updated.map(x=>x.title).sort();
t.eq(upTitles, ["t1-edited","t4"], "incremental updated = edited + new (not unchanged t3)");
t.eq(r.json.deleted, [ids.t2], "incremental deleted = [t2 id]");
t.ok(r.json.at > cursor, "new cursor advances");

// a second sync with the NEW cursor -> nothing changed
r = await c.get(`/api/db/${slug}/rows/todos/changes?sync=${encodeURIComponent(r.json.at)}`);
t.ok(r.json.updated.length === 0 && r.json.deleted.length === 0, "sync with fresh cursor -> empty");

// a non-sync table: ?sync ignored, falls through to the normal changes(append) endpoint
await c.schema(slug, { tables: { plain: { access: "feed", columns: { title: "text" } } } });
await c.post(`/api/db/${slug}/rows/plain`, { title: "p" }, { token: A });
r = await c.get(`/api/db/${slug}/rows/plain/changes?sync=`);
t.ok(Array.isArray(r.json.rows) && !("updated" in r.json), "non-sync table: normal changes(append) shape");

t.done(); h.restore();

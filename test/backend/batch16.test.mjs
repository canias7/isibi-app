// Batch 16 — updated_at timestamps + ?fields projection + ?count relation counts
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 16");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slug = "b16";
await c.ensure(slug);
const sc = await c.schema(slug, {
  tables: {
    posts: { access: "feed", timestamps: true, columns: { title: "text", body: "text", likes: "integer" } },
    comments: { access: "feed", columns: [{ name: "post_id", type: "integer", ref: "posts" }, { name: "text", type: "text" }] },
    plain: { access: "feed", columns: { note: "text" } }, // NO timestamps → control
  },
});
t.ok(sc.json && sc.json.ok, "schema applied");

const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;

// --- timestamps: present on insert, == created initially ---
await c.post(`/api/db/${slug}/rows/posts`, { title: "Hello", body: "world", likes: 0 }, { token: A });
let row = (await c.get(`/api/db/${slug}/rows/posts`)).json.rows[0];
t.ok(row.updated_at != null, "updated_at populated on insert");
t.ok(row.created_at != null && row.updated_at >= row.created_at, "updated_at >= created_at on insert");
const pid = row.id;
const created0 = row.created_at, updated0 = row.updated_at;

// --- plain (no timestamps) has NO updated_at column ---
await c.post(`/api/db/${slug}/rows/plain`, { note: "x" }, { token: A });
const prow = (await c.get(`/api/db/${slug}/rows/plain`)).json.rows[0];
t.ok(!("updated_at" in prow), "control table has no updated_at");

// --- single PATCH bumps updated_at (sleep to cross a second boundary) ---
await sleep(1100);
const pr = await c.patch(`/api/db/${slug}/rows/posts/${pid}`, { title: "Edited" }, { token: A });
t.ok(pr.json && pr.json.ok, "owner PATCH ok");
row = (await c.get(`/api/db/${slug}/rows/posts/${pid}`)).json.row;
t.ok(row.title === "Edited", "title updated");
t.ok(row.updated_at > updated0, "updated_at bumped by PATCH (" + updated0 + " -> " + row.updated_at + ")");
t.ok(row.created_at === created0, "created_at unchanged by PATCH");

// --- incr bumps updated_at ---
await sleep(1100);
const before = row.updated_at;
const ir = await c.post(`/api/db/${slug}/rows/posts/${pid}/incr`, { col: "likes", by: 1 }, { token: A });
t.ok(ir.json && ir.json.value === 1, "incr worked");
row = (await c.get(`/api/db/${slug}/rows/posts/${pid}`)).json.row;
t.ok(row.updated_at > before, "updated_at bumped by incr");

// --- bulk PATCH bumps updated_at ---
await sleep(1100);
const before2 = row.updated_at;
const br = await c.patch(`/api/db/${slug}/rows/posts?where=title:eq:Edited`, { body: "bulk" }, { token: A });
t.ok(br.json && br.json.updated === 1, "bulk PATCH updated 1");
row = (await c.get(`/api/db/${slug}/rows/posts/${pid}`)).json.row;
t.ok(row.updated_at > before2, "updated_at bumped by bulk PATCH");

// --- ?count relation counts ---
await c.post(`/api/db/${slug}/rows/comments`, { post_id: pid, text: "c1" }, { token: A });
await c.post(`/api/db/${slug}/rows/comments`, { post_id: pid, text: "c2" }, { token: B });
row = (await c.get(`/api/db/${slug}/rows/posts?count=comments`)).json.rows.find((r) => r.id === pid);
t.ok(row._counts && row._counts.comments === 2, "?count=comments -> 2 (got " + JSON.stringify(row && row._counts) + ")");
// count without the param → no _counts
row = (await c.get(`/api/db/${slug}/rows/posts`)).json.rows.find((r) => r.id === pid);
t.ok(!row._counts, "no ?count -> no _counts key");

// --- ?fields projection ---
let plist = (await c.get(`/api/db/${slug}/rows/posts?fields=title`)).json.rows.find((r) => r.id === pid);
const keys = Object.keys(plist).sort();
t.eq(keys, ["id", "title"], "?fields=title -> only id+title");
// projection keeps opt-in join keys (author, _counts)
plist = (await c.get(`/api/db/${slug}/rows/posts?fields=title&authors=1&count=comments`)).json.rows.find((r) => r.id === pid);
t.ok("author" in plist && "_counts" in plist && "title" in plist && !("body" in plist), "projection keeps author+_counts, drops body");
// unknown field ignored, id still present
plist = (await c.get(`/api/db/${slug}/rows/posts?fields=nope`)).json.rows.find((r) => r.id === pid);
t.eq(Object.keys(plist), ["id"], "unknown ?fields -> just id");

// --- optimistic lock still coexists is out of scope; verify version flag independent ---
t.done();
h.restore();

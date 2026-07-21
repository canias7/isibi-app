// Batch 38 — data export (CSV/JSON, admin)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 38");

const slug = "b38";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: { title: "text", n: "integer" } } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/posts`, { title: "plain", n: 1 }, { token: B });
await c.post(`/api/db/${slug}/rows/posts`, { title: "has, comma", n: 2 }, { token: B });
await c.post(`/api/db/${slug}/rows/posts`, { title: 'has "quote"', n: 3 }, { token: B });

// CSV export (admin)
let r = await c.call("GET", `/api/db/${slug}/export/posts?format=csv`, { token: ADMIN });
const lines = r.text.split("\r\n");
t.ok(lines[0].split(",").includes("title") && lines[0].split(",").includes("n"), "CSV header has columns");
t.ok(lines.length === 4, "CSV has header + 3 rows");
t.ok(r.text.includes('"has, comma"'), "comma value is quoted");
t.ok(r.text.includes('"has ""quote"""'), "quote value is escaped + quoted");
t.ok(/text\/csv/.test(r.text) === false, "body is raw csv (no json wrapper)");

// default format is csv
r = await c.call("GET", `/api/db/${slug}/export/posts`, { token: ADMIN });
t.ok(r.text.split("\r\n")[0].includes("title"), "default format = csv");

// JSON export
r = await c.call("GET", `/api/db/${slug}/export/posts?format=json`, { token: ADMIN });
t.ok(Array.isArray(r.json) && r.json.length === 3, "JSON export -> array of 3");
t.ok(r.json.some((x) => x.title === "has, comma"), "JSON export has the rows");

// gates
t.ok((await c.call("GET", `/api/db/${slug}/export/posts`, { token: B })).status === 403, "non-admin export -> 403");
t.ok((await c.call("GET", `/api/db/${slug}/export/posts`)).status === 401, "anon export -> 401");
t.ok((await c.call("GET", `/api/db/${slug}/export/nope`, { token: ADMIN })).status === 404, "unknown table -> 404");

t.done();
h.restore();

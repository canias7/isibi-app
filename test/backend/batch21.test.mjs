// Batch 21 — expiring rows / TTL (auto-hide past expires_at)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 21");

const future = new Date(Date.now() + 86400e3).toISOString();
const past = new Date(Date.now() - 86400e3).toISOString();

const slug = "b21";
await c.ensure(slug);
await c.schema(slug, { tables: { deals: { access: "feed", expires: true, columns: { title: "text" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;

await c.post(`/api/db/${slug}/rows/deals`, { title: "live", expires_at: future }, { token: A });
await c.post(`/api/db/${slug}/rows/deals`, { title: "gone", expires_at: past }, { token: A });
await c.post(`/api/db/${slug}/rows/deals`, { title: "forever" }, { token: A }); // no expires_at

const titles = (qs) => c.get(`/api/db/${slug}/rows/deals${qs || ""}`).then((r) => (r.json.rows || []).map((x) => x.title).sort());

t.eq(await titles(), ["forever", "live"], "default list hides expired (live + forever)");
t.eq(await titles("?expired=1"), ["gone"], "?expired=1 -> only expired");
t.eq(await titles("?withExpired=1"), ["forever", "gone", "live"], "?withExpired=1 -> all three");

// single GET of an expired row is hidden by default, visible with ?withExpired=1
const gone = (await c.get(`/api/db/${slug}/rows/deals?withExpired=1`)).json.rows.find((r) => r.title === "gone");
t.ok((await c.get(`/api/db/${slug}/rows/deals/${gone.id}`)).json.row === null, "single GET of expired -> null (hidden)");
t.ok((await c.get(`/api/db/${slug}/rows/deals/${gone.id}?withExpired=1`)).json.row.title === "gone", "single GET w/ ?withExpired=1 -> visible");

// renew: PATCH expires_at into the future -> reappears in default list
const pr = await c.patch(`/api/db/${slug}/rows/deals/${gone.id}`, { expires_at: future }, { token: A });
t.ok(pr.json && pr.json.ok, "renew PATCH ok (expires_at is app-writable)");
t.eq(await titles(), ["forever", "gone", "live"], "renewed row reappears");

// expires_at is queryable/sortable
const asc = (await c.get(`/api/db/${slug}/rows/deals?sort=expires_at&order=asc&withExpired=1`)).json.rows;
t.ok(Array.isArray(asc) && asc.length === 3, "?sort=expires_at works (no SQL error)");

t.done();
h.restore();

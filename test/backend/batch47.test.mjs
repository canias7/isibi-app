import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 47");
const slug = "b47";
await c.ensure(slug);
await c.schema(slug, { tables: { projects: { access: "feed", archivable: true, columns: { name: "text" } } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/projects`, { name: "active1" }, { token: A });
await c.post(`/api/db/${slug}/rows/projects`, { name: "toArchive" }, { token: A });
const id = (await c.get(`/api/db/${slug}/rows/projects?where=name:eq:toArchive`)).json.rows[0].id;
const titles = (qs) => c.get(`/api/db/${slug}/rows/projects${qs||""}`).then(r=>(r.json.rows||[]).map(x=>x.name).sort());

// archive it
t.ok((await c.post(`/api/db/${slug}/rows/projects/${id}/archive`, {}, { token: A })).json.archived === true, "archive -> archived true");
t.eq(await titles(), ["active1"], "default list hides archived");
t.eq(await titles("?archived=1"), ["toArchive"], "?archived=1 -> only archived");
t.eq(await titles("?withArchived=1"), ["active1","toArchive"], "?withArchived=1 -> all");
// single GET hidden by default
t.ok((await c.get(`/api/db/${slug}/rows/projects/${id}`)).json.row === null, "single GET archived -> null");
t.ok((await c.get(`/api/db/${slug}/rows/projects/${id}?withArchived=1`)).json.row.name === "toArchive", "?withArchived single GET visible");
// unarchive
t.ok((await c.post(`/api/db/${slug}/rows/projects/${id}/unarchive`, {}, { token: A })).json.archived === false, "unarchive -> archived false");
t.eq(await titles(), ["active1","toArchive"], "unarchived reappears");
// scope: B can't archive A's row
t.ok((await c.post(`/api/db/${slug}/rows/projects/${id}/archive`, {}, { token: B })).status === 404, "B archive A's row -> 404");
// non-archivable table -> 400
await c.schema(slug, { tables: { plain: { access: "feed", columns: { a: "text" } } } });
await c.post(`/api/db/${slug}/rows/plain`, { a: "x" }, { token: A });
const pid = (await c.get(`/api/db/${slug}/rows/plain`)).json.rows[0].id;
t.ok((await c.post(`/api/db/${slug}/rows/plain/${pid}/archive`, {}, { token: A })).status === 400, "non-archivable table -> 400");
t.done(); h.restore();

import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 56");
const slug = "b56";
await c.ensure(slug);
await c.schema(slug, { tables: { people: { access: "feed", columns: [{ name:"name", type:"text", required:true }, { name:"age", type:"integer" }, { name:"city", type:"text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;

// header names match columns -> auto-map
let csv = 'name,age,city\nAda,36,London\n"Grace, H",45,"New York"\nSolo,,Paris';
let r = await c.post(`/api/db/${slug}/import/people`, { csv }, { token: ADMIN });
t.ok(r.json.inserted === 3, "imported 3 rows (auto-map by header)");
let rows = (await c.get(`/api/db/${slug}/rows/people?sort=id&order=asc`)).json.rows;
t.ok(rows.length === 3, "3 rows present");
t.ok(rows.find(x=>x.name==="Grace, H" && x.city==="New York"), "quoted comma field parsed correctly");
t.ok(rows.find(x=>x.name==="Solo" && x.age===null), "empty cell -> null");

// column mapping (CSV headers differ)
csv = 'full_name,years\nBob,50';
r = await c.post(`/api/db/${slug}/import/people`, { csv, mapping: { full_name: "name", years: "age" } }, { token: ADMIN });
t.ok(r.json.inserted === 1, "mapping full_name->name, years->age");
t.ok((await c.get(`/api/db/${slug}/rows/people?where=name:eq:Bob`)).json.rows[0].age === 50, "mapped age landed");

// validation: a row missing required 'name' is skipped
csv = 'name,age\nValid,20\n,99';
r = await c.post(`/api/db/${slug}/import/people`, { csv }, { token: ADMIN });
t.ok(r.json.inserted === 1 && r.json.skipped === 1, "row missing required name skipped");

// no matching columns -> 400
t.ok((await c.post(`/api/db/${slug}/import/people`, { csv: "foo,bar\n1,2" }, { token: ADMIN })).status === 400, "no matching cols -> 400");
// non-admin -> 403 ; anon -> 401 ; unknown table -> 404
t.ok((await c.post(`/api/db/${slug}/import/people`, { csv: "name\nX" }, { token: B })).status === 403, "non-admin -> 403");
t.ok((await c.post(`/api/db/${slug}/import/people`, { csv: "name\nX" })).status === 401, "anon -> 401");
t.ok((await c.post(`/api/db/${slug}/import/nope`, { csv: "a\n1" }, { token: ADMIN })).status === 404, "unknown table -> 404");
t.done(); h.restore();

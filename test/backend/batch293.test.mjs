// Batch 293 — CSV CONVERTER. Stateless two-way JSON<->CSV with RFC-4180 quoting. Covers rows->CSV (auto
// columns, explicit columns, quoting of commas/quotes/newlines), CSV->rows (headers, quoted fields, escaped
// quotes, no-headers mode, custom delimiter), round-trip, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 293");
const slug = "b293";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const to = (tok, body) => c.post(`/api/db/${slug}/csv/to`, body, tok === null ? {} : { token: tok });
const from = (tok, body) => c.post(`/api/db/${slug}/csv/from`, body, tok === null ? {} : { token: tok });

// --- rows -> CSV (auto columns) ---
let r = (await to(A, { rows: [{ name: "Al", age: 30 }, { name: "Bo", age: 25 }] })).json;
t.eq(r.columns.join(","), "name,age", "columns inferred from the first row");
t.eq(r.csv, "name,age\nAl,30\nBo,25", "rows serialize to CSV");

// --- Quoting ---
r = (await to(A, { rows: [{ a: "x,y", b: 'he said "hi"', d: "line1\nline2" }] })).json;
t.ok(/"x,y"/.test(r.csv), "a comma field is quoted");
t.ok(/"he said ""hi"""/.test(r.csv), "embedded quotes are doubled");
t.ok(/"line1\nline2"/.test(r.csv), "a newline field is quoted");

// --- Explicit columns (subset + order) ---
r = (await to(A, { rows: [{ a: 1, b: 2, c: 3 }], columns: ["c", "a"] })).json;
t.eq(r.csv, "c,a\n3,1", "explicit columns select + order");

// --- CSV -> rows (headers) ---
r = (await from(A, { csv: "name,age\nAl,30\nBo,25" })).json;
t.eq(r.rows.length, 2, "parses two data rows");
t.eq(r.rows[0].name, "Al", "…mapping header to value");
t.eq(r.rows[1].age, "25", "…second row");

// --- CSV -> rows with quoted + escaped fields ---
r = (await from(A, { csv: 'a,b\n"x,y","he said ""hi"""' })).json;
t.eq(r.rows[0].a, "x,y", "a quoted comma field parses");
t.eq(r.rows[0].b, 'he said "hi"', "doubled quotes unescape");

// --- No-headers mode ---
r = (await from(A, { csv: "1,2,3\n4,5,6", headers: false })).json;
t.eq(r.columns[0], "col1", "no-headers mode synthesizes column names");
t.eq(r.rows.length, 2, "…and treats every line as data");

// --- Custom delimiter ---
r = (await from(A, { csv: "a;b\n1;2", delimiter: ";" })).json;
t.eq(r.rows[0].b, "2", "a custom delimiter parses");

// --- Round-trip ---
const orig = [{ city: "A,B", n: "5" }, { city: "C", n: "7" }];
const csv = (await to(A, { rows: orig })).json.csv;
const back = (await from(A, { csv })).json.rows;
t.eq(back[0].city, "A,B", "round-trip preserves a comma field");
t.eq(back[1].n, "7", "round-trip preserves values");

// --- Validation + authz ---
t.eq((await from(A, {})).status, 400, "no csv text → 400");
t.eq((await c.post(`/api/db/${slug}/csv/to`, { rows: [] })).status, 401, "signed-out → 401");

t.done(); h.restore();

// Batch 84 — global search across tables: GET /rows.../search?q= over every readable table,
// grouped by table, respecting per-table visibility + field-level security.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 84");
const slug = "b84";
await c.ensure(slug);
await c.schema(slug, { tables: {
  contacts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }] },
  deals: { access: "admin", fieldRoles: { margin: ["admin"] }, columns: [{ name: "title", type: "text" }, { name: "margin", type: "integer" }] },
  leads: { access: "user", columns: [{ name: "name", type: "text" }] },
  intake: { access: "collect", columns: [{ name: "note", type: "text" }] }, // write-only, never searched
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3

await c.post(`/api/db/${slug}/rows/contacts`, { name: "Acme Corp", email: "hi@acme.com" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/contacts`, { name: "Globex", email: "hi@globex.com" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/deals`, { title: "Acme renewal", margin: 40 }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/deals`, { title: "Globex expansion", margin: 55 }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/leads`, { name: "Acme lead (A's)" }, { token: A }); // owned by A
await c.post(`/api/db/${slug}/rows/intake`, { note: "acme secret" }, {}); // collect

// global search hits contacts AND deals in one call
let s = (await c.get(`/api/db/${slug}/search?q=acme`, { token: ADMIN })).json;
t.ok(s.ok, "search ok");
const tbls = s.results.map((r) => r.table).sort();
t.ok(tbls.includes("contacts") && tbls.includes("deals"), "matches span contacts + deals");
t.ok(!tbls.includes("intake"), "write-only collect table never searched");
const cGroup = s.results.find((r) => r.table === "contacts");
t.eq(cGroup.rows.length, 1, "one contact matched (Acme Corp)");
t.eq(cGroup.rows[0].name, "Acme Corp", "right contact");
t.ok(s.count >= 2, "count spans matches");

// admin (as ADMIN) sees the secured margin field in search results
const dGroupAdmin = s.results.find((r) => r.table === "deals");
t.ok(dGroupAdmin.rows[0].margin === 40, "admin sees secured field (margin) in search");

// field-level security: an anonymous searcher does NOT get the margin
let anon = (await c.get(`/api/db/${slug}/search?q=acme`)).json;
const dGroupAnon = anon.results.find((r) => r.table === "deals");
t.ok(dGroupAnon && dGroupAnon.rows[0].margin === undefined, "anon search strips the secured margin field");
t.ok(!anon.results.some((r) => r.table === "leads"), "anon doesn't search a private user table");

// user table is scoped to the caller's OWN rows
t.ok((await c.get(`/api/db/${slug}/search?q=acme`, { token: A })).json.results.some((r) => r.table === "leads"), "owner A finds their own lead");
t.ok(!(await c.get(`/api/db/${slug}/search?q=acme`, { token: B })).json.results.some((r) => r.table === "leads"), "user B does NOT see A's private lead");

// tables= filter narrows the scope
let only = (await c.get(`/api/db/${slug}/search?q=acme&tables=contacts`, { token: ADMIN })).json;
t.eq(only.results.map((r) => r.table), ["contacts"], "tables=contacts limits the search scope");

// a query that matches nothing → empty
t.eq((await c.get(`/api/db/${slug}/search?q=zzzznomatch`, { token: ADMIN })).json.count, 0, "no matches → count 0");

// multi-word q → all terms must match (AND)
t.eq((await c.get(`/api/db/${slug}/search?q=acme%20renewal`, { token: ADMIN })).json.results.find((r) => r.table === "deals").rows.length, 1, "multi-word AND matches the deal");
t.ok(!(await c.get(`/api/db/${slug}/search?q=acme%20renewal`, { token: ADMIN })).json.results.some((r) => r.table === "contacts"), "multi-word AND excludes the contact (no 'renewal')");

// no q → 400; POST → 405
t.eq((await c.get(`/api/db/${slug}/search`, { token: ADMIN })).status, 400, "missing q → 400");
t.eq((await c.post(`/api/db/${slug}/search?q=x`, {}, { token: ADMIN })).status, 405, "search is read-only");

t.done(); h.restore();

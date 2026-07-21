// Batch 32 — computed / derived read columns
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 32");

const slug = "b32";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    people: {
      access: "feed",
      computed: { full_name: ["first_name", " ", "last_name"], label: ["#", "id", " - ", "first_name"] },
      columns: { first_name: "text", last_name: "text" },
    },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/people`, { first_name: "Ada", last_name: "Lovelace" }, { token: A });
await c.post(`/api/db/${slug}/rows/people`, { first_name: "Grace", last_name: "Hopper" }, { token: A });

let rows = (await c.get(`/api/db/${slug}/rows/people?sort=id&order=asc`)).json.rows;
t.ok(rows[0].full_name === "Ada Lovelace", "full_name = first + ' ' + last");
t.ok(rows[1].full_name === "Grace Hopper", "full_name row 2");
// literal + column mix, and id (a managed col) referenced
t.ok(rows[0].label === "#1 - Ada", "label mixes literals + id + first_name (" + rows[0].label + ")");

// single-row GET also computes
const one = (await c.get(`/api/db/${slug}/rows/people/1`)).json.row;
t.ok(one.full_name === "Ada Lovelace", "single GET computes full_name");

// null part -> empty string, no 'null' text
await c.post(`/api/db/${slug}/rows/people`, { first_name: "Solo" }, { token: A }); // no last_name
rows = (await c.get(`/api/db/${slug}/rows/people?where=first_name:eq:Solo`)).json.rows;
t.ok(rows[0].full_name === "Solo ", "missing part -> '' (no 'null')");

// computed is READ-only: trying to write it is ignored (not a real column) - insert with full_name
await c.post(`/api/db/${slug}/rows/people`, { first_name: "X", last_name: "Y", full_name: "HACK" }, { token: A });
rows = (await c.get(`/api/db/${slug}/rows/people?where=first_name:eq:X`)).json.rows;
t.ok(rows[0].full_name === "X Y", "computed recomputed, ignores any written full_name");

// a table with no computed -> no extra keys
await c.schema(slug, { tables: { plain: { access: "feed", columns: { a: "text" } } } });
await c.post(`/api/db/${slug}/rows/plain`, { a: "z" }, { token: A });
const p = (await c.get(`/api/db/${slug}/rows/plain`)).json.rows[0];
t.ok(!("full_name" in p) && !("label" in p), "plain table has no computed keys");

t.done();
h.restore();

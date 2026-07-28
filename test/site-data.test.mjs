// The data API is unauthenticated, so its allow-listing is the only thing
// standing between a published site and its database. These tests drive the
// real handler with a fake database, asserting on the SQL it actually emits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleSiteData } from "../site-data.mjs";

// A stand-in for one site's database. Records every statement, and answers the
// schema lookup the handler makes first.
function fakeDb(spec, { changes = 1, rows = [{ id: 1 }] } = {}) {
  const seen = [];
  const conn = {
    __seen: seen,
    async query(sql, params) {
      seen.push({ sql, params });
      if (/FROM _meta WHERE k='schema'/.test(sql)) return { rows: [{ v: JSON.stringify(spec) }] };
      return { rows, rowCount: changes, command: sql.trim().split(/\s+/)[0].toUpperCase() };
    },
  };
  return conn;
}

// The engine's real access levels — see site-schema.mjs.
const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "title" }, { name: "price" }], fts: true },
    { name: "bookings", access: "collect", columns: [{ name: "date" }, { name: "title" }] },
    { name: "mine", access: "user", columns: [{ name: "date" }] },
    { name: "notes", access: "display", columns: [{ name: "body" }], trash: true },
  ],
};

const call = async (method, path, { body, db } = {}) => {
  const url = new URL("https://isibi.ai" + path);
  const req = new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const conn = db || fakeDb(SPEC);
  const deps = {
    sqlQuery: async (_c, sql, p) => (await conn.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await conn.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => SPEC,
  };
  return { res: await handleSiteData({}, req, url, async () => conn, deps), seen: conn.__seen };
};

test("a path that is not the data API is passed through", async () => {
  const url = new URL("https://isibi.ai/api/credits");
  assert.equal(await handleSiteData({}, new Request(url), url, async () => fakeDb(SPEC), {}), null);
});

test("an undeclared table is 404, not a query", async () => {
  const { res, seen } = await call("GET", "/api/db/shop/rows/secrets");
  assert.equal(res.status, 404);
  assert.ok(!seen.some((s) => /FROM "secrets"/.test(s.sql)), "must not query an undeclared table");
});

test("a table needing a site login is not readable", async () => {
  const { res } = await call("GET", "/api/db/shop/rows/mine");
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /not readable/);
});

test("a collect table is write-only — reading it is refused", async () => {
  const { res, seen } = await call("GET", "/api/db/shop/rows/bookings");
  assert.equal(res.status, 403);
  assert.ok(!seen.some((q) => /SELECT \* FROM "bookings"/.test(q.sql)),
    "a visitor must never read back other people's submissions");
});

test("a display table cannot be written to", async () => {
  const { res } = await call("POST", "/api/db/shop/rows/services", { body: { title: "x" } });
  assert.equal(res.status, 403);
});

test("editing and deleting are refused on every level for now", async () => {
  for (const [m, path] of [["PATCH", "/api/db/shop/rows/bookings/1"], ["DELETE", "/api/db/shop/rows/bookings/1"]]) {
    const { res } = await call(m, path, { body: { title: "x" } });
    assert.equal(res.status, 403, m + " should be refused");
  }
});

test("listing a display table selects from it with a capped limit", async () => {
  const { res, seen } = await call("GET", "/api/db/shop/rows/services?limit=9999");
  assert.equal(res.status, 200);
  const q = seen.find((s) => /SELECT \* FROM "services"/.test(s.sql));
  assert.ok(q, "expected a select");
  assert.ok(q.params.includes(100), "limit should cap at 100, got " + JSON.stringify(q.params));
});

test("an unknown query parameter is ignored, not injected", async () => {
  const { seen } = await call("GET", "/api/db/shop/rows/services?utm_source=x&title=cut");
  const q = seen.find((s) => /SELECT \* FROM "services"/.test(s.sql));
  assert.ok(/"title"=\$?\??/.test(q.sql), "declared column should filter: " + q.sql);
  assert.ok(!/utm_source/.test(q.sql), "unknown parameter must not reach SQL");
});

test("order by is allow-listed against declared columns", async () => {
  const { seen } = await call("GET", "/api/db/shop/rows/services?order=price");
  assert.ok(/ORDER BY "price"/.test(seen.at(-1).sql));
  const { seen: s2 } = await call("GET", "/api/db/shop/rows/services?order=; DROP TABLE x");
  assert.ok(/ORDER BY "id"/.test(s2.at(-1).sql), "unknown order column must fall back to id");
});

test("insert writes only declared columns and drops the rest", async () => {
  const { res, seen } = await call("POST", "/api/db/shop/rows/bookings", {
    body: { title: "Cut", date: "2026-08-01", id: 999, owner_id: 7, evil: "x" },
  });
  assert.equal(res.status, 201);
  const ins = seen.find((s) => /INSERT INTO "bookings"/.test(s.sql));
  assert.ok(/"title"/.test(ins.sql) && /"date"/.test(ins.sql));
  for (const bad of ['"id"', '"owner_id"', "evil"]) {
    assert.ok(!ins.sql.includes(bad), bad + " must not be writable: " + ins.sql);
  }
});

test("an insert with nothing writable is rejected before touching the database", async () => {
  const { res, seen } = await call("POST", "/api/db/shop/rows/bookings", { body: { id: 1, owner_id: 2 } });
  assert.equal(res.status, 400);
  assert.ok(!seen.some((s) => /INSERT/.test(s.sql)));
});

test("full-text search only applies where the table declared fts", async () => {
  const { seen } = await call("GET", "/api/db/shop/rows/services?q=beard");
  assert.ok(/websearch_to_tsquery/.test(seen.at(-1).sql));
  const { seen: s2 } = await call("GET", "/api/db/shop/rows/notes?q=beard");
  assert.ok(!/websearch_to_tsquery/.test(s2.at(-1).sql), "notes did not declare fts");
});

test("a slug that is not a real site is 404", async () => {
  const url = new URL("https://isibi.ai/api/db/ghost/rows/services");
  const res = await handleSiteData({}, new Request(url), url, async () => null, {});
  assert.equal(res.status, 404);
});

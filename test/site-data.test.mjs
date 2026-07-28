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

test("a table needing a site login says sign in, not forbidden", async () => {
  // 401, not 403: "you are not signed in" is a different fact from "you may
  // never do this", and the page has to be able to tell them apart to know
  // whether to show a login form.
  const { res } = await call("GET", "/api/db/shop/rows/mine");
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, "auth");
});

// ------------------------------------------- rows that belong to a member

const asVisitor = (visitor) => ({
  resolveVisitor: async () => visitor,
});

test("a signed-in member reads only their own rows", async () => {
  // The `user` level is the private one. If the owner filter is ever dropped,
  // every member reads every other member's rows and nothing looks broken.
  const db = fakeDb(SPEC);
  const url = new URL("https://isibi.ai/api/db/shop/rows/mine");
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async () => ({ results: [], changes: 0 }),
    loadSiteSchema: async () => SPEC,
    ...asVisitor({ id: 7, role: "user" }),
  };
  const res = await handleSiteData({}, new Request(url), url, async () => db, deps);
  assert.equal(res.status, 200);
  const q = db.__seen.find((x) => /SELECT \* FROM "mine"/.test(x.sql));
  assert.match(q.sql, /"owner_id"=\?/, "the read must be scoped: " + q.sql);
  assert.ok(q.params.includes(7));
});

test("a query string cannot widen a member's own-rows filter", async () => {
  // The scope is appended to the caller's filters with AND, so no parameter can
  // turn it into someone else's rows.
  const db = fakeDb(SPEC);
  const url = new URL("https://isibi.ai/api/db/shop/rows/mine?date=2030-01-01&owner_id=9");
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async () => ({ results: [], changes: 0 }),
    loadSiteSchema: async () => SPEC,
    ...asVisitor({ id: 7, role: "user" }),
  };
  await handleSiteData({}, new Request(url), url, async () => db, deps);
  const q = db.__seen.find((x) => /SELECT \* FROM "mine"/.test(x.sql));
  // AND, not OR. Joined with OR the clause is still present and the id is still
  // bound — and the query returns every row matching the caller's filter
  // REGARDLESS of who owns it, which is the whole leak wearing a correct-looking
  // WHERE clause.
  assert.match(q.sql, /AND "owner_id"=\?/, "the scope must narrow, not widen: " + q.sql);
  assert.ok(!/OR "owner_id"/.test(q.sql), q.sql);
  assert.ok(q.params.includes(7), "the session's id is what scopes it");
  assert.ok(!q.params.includes("9"), "and a query parameter cannot replace it: " + JSON.stringify(q.params));
});

test("a write to a member table is stamped from the session, not the body", async () => {
  // The attack: POST {owner_id: 1} and own someone else's row. owner_id is a
  // managed column so pickWritable drops it, and the verified id is appended
  // after — the ORDER is what makes that true.
  const db = fakeDb(SPEC);
  const url = new URL("https://isibi.ai/api/db/shop/rows/mine");
  const req = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2030-01-01", owner_id: 1 }) });
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async () => ({ results: [], changes: 0 }),
    loadSiteSchema: async () => SPEC,
    ...asVisitor({ id: 7, role: "user" }),
  };
  const res = await handleSiteData({}, req, url, async () => db, deps);
  assert.equal(res.status, 201);
  const q = db.__seen.find((x) => /INSERT INTO "mine"/.test(x.sql));
  assert.match(q.sql, /"owner_id"/);
  assert.ok(q.params.includes(7), "the session's id");
  assert.ok(!q.params.includes(1), "never the body's: " + JSON.stringify(q.params));
});

test("an unsigned-in write to a member table is refused", async () => {
  const { res } = await call("POST", "/api/db/shop/rows/mine", { body: { date: "2030-01-01" } });
  assert.equal(res.status, 401);
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

test("a missing required column is the sender's fault, and names the field", async () => {
  const db = fakeDb(SPEC);
  db.query = async (sql) => {
    if (/FROM _meta WHERE k='schema'/.test(sql)) return { rows: [{ v: JSON.stringify(SPEC) }] };
    throw new Error('null value in column "date" of relation "bookings" violates not-null constraint');
  };
  const url = new URL("https://isibi.ai/api/db/shop/rows/bookings");
  const req = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Cut" }) });
  const deps = {
    sqlQuery: async (_c, s2, p2) => (await db.query(s2, p2)).rows,
    sqlExec: async () => ({ results: [], changes: 0 }),
    loadSiteSchema: async () => SPEC,
  };
  const res = await handleSiteData({}, req, url, async () => db, deps);
  assert.equal(res.status, 400, "not a 500");
  const body = await res.json();
  assert.equal(body.code, "required");
  assert.equal(body.field, "date");
  assert.match(body.error, /date is required/);
});

test("the search vector never reaches a visitor", async () => {
  // `_fts` is a generated tsvector — the index, not data. SELECT * returns it,
  // so an fts table was shipping its whole search vector on every public read:
  // meaningless to a client, often as large as the text it was built from, and
  // an internal column exposed in a public API.
  const db = fakeDb(SPEC);
  db.query = async () => ({
    rows: [{ id: 1, title: "Skin fade", price: 30, _fts: "'fade':2 'skin':1" }],
    rowCount: 1,
  });
  const url = new URL("https://isibi.ai/api/db/shop/rows/services");
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await db.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => SPEC,
  };
  const res = await handleSiteData({}, new Request(url), url, async () => db, deps);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(!("_fts" in body.rows[0]), "the tsvector must be stripped: " + JSON.stringify(body.rows[0]));
  assert.deepEqual(body.rows[0], { id: 1, title: "Skin fade", price: 30 }, "and nothing else is lost");
});

test("stripping the vector survives a row that has none", async () => {
  const db = fakeDb(SPEC);
  db.query = async () => ({ rows: [{ id: 1, title: "No fts here" }, null], rowCount: 2 });
  const url = new URL("https://isibi.ai/api/db/shop/rows/services");
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async () => ({ results: [], changes: 0 }),
    loadSiteSchema: async () => SPEC,
  };
  const res = await handleSiteData({}, new Request(url), url, async () => db, deps);
  assert.equal(res.status, 200, "a null row must not throw on the public endpoint");
});

test("an admin table is readable to any member but writable only by a role", async () => {
  // The shared-CMS level: everyone signed in may read it, only the declared
  // roles may change it. Without the role check any member could rewrite the
  // site's content.
  const spec = { tables: [{ name: "posts", access: "admin", columns: [{ name: "title" }], writeRoles: ["editor"] }] };
  const mk = (visitor) => {
    const db = fakeDb(spec);
    return {
      db,
      deps: {
        sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
        sqlExec: async () => ({ results: [], changes: 0 }),
        loadSiteSchema: async () => spec,
        resolveVisitor: async () => visitor,
      },
    };
  };
  const url = new URL("https://isibi.ai/api/db/shop/rows/posts");
  const post = () => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "hi" }) });

  const reader = mk({ id: 1, role: "user" });
  assert.equal((await handleSiteData({}, new Request(url), url, async () => reader.db, reader.deps)).status, 200,
    "any signed-in member may read");

  const plain = mk({ id: 1, role: "user" });
  const denied = await handleSiteData({}, post(), url, async () => plain.db, plain.deps);
  assert.equal(denied.status, 403, "a plain member may not write");
  assert.equal((await denied.json()).code, "role");
  assert.ok(!plain.db.__seen.some((q) => /INSERT INTO "posts"/.test(q.sql)), "and nothing was written");

  for (const role of ["editor", "admin"]) {
    const ok = mk({ id: 2, role });
    assert.equal((await handleSiteData({}, post(), url, async () => ok.db, ok.deps)).status, 201, role);
  }
});

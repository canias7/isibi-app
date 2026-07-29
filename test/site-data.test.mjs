// The data API is unauthenticated, so its allow-listing is the only thing
// standing between a published site and its database. These tests drive the
// real handler with a fake database, asserting on the SQL it actually emits.
import { test } from "node:test";
import fs from "node:fs";
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

// ------------------------------------------- editing and deleting own rows

const memberDeps = (db, spec, visitor) => ({
  sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
  sqlExec: async (_c, sql, p) => { const r = await db.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
  loadSiteSchema: async () => spec,
  resolveVisitor: async () => visitor,
});

test("a member may edit a row, scoped to the one they own", async () => {
  // Ids are sequential integers. Scoping by id ALONE — which is all these
  // handlers did while they were unreachable — means member A edits member B's
  // row by guessing a number.
  const db = fakeDb(SPEC);
  const url = new URL("https://isibi.ai/api/db/shop/rows/mine/5");
  const req = new Request(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2031-01-01" }) });
  const res = await handleSiteData({}, req, url, async () => db, memberDeps(db, SPEC, { id: 7, role: "user" }));
  assert.equal(res.status, 200);
  const q = db.__seen.find((x) => /^UPDATE "mine"/.test(x.sql));
  assert.match(q.sql, /WHERE id=\? AND "owner_id"=\?/, "the update must be owner-scoped: " + q.sql);
  assert.ok(q.params.includes(7));
});

test("a member may delete a row, scoped the same way", async () => {
  const db = fakeDb(SPEC);
  const url = new URL("https://isibi.ai/api/db/shop/rows/mine/5");
  const res = await handleSiteData({}, new Request(url, { method: "DELETE" }), url, async () => db, memberDeps(db, SPEC, { id: 7, role: "user" }));
  assert.equal(res.status, 200);
  const q = db.__seen.find((x) => /^DELETE FROM "mine"/.test(x.sql));
  assert.match(q.sql, /WHERE id=\? AND "owner_id"=\?/, q.sql);
  assert.ok(q.params.includes(7));
});

test("someone else's row is 404, not 403 — on edit AND delete", async () => {
  // 403 would confirm the row exists and belongs to another member, which is an
  // enumeration oracle over sequential ids. 404 says nothing. Both verbs, because
  // one of them saying the quiet part is enough.
  for (const method of ["PATCH", "DELETE"]) {
    const db = fakeDb(SPEC);
    db.query = async () => ({ rows: [], rowCount: 0 });
    const url = new URL("https://isibi.ai/api/db/shop/rows/mine/999");
    const req = new Request(url, method === "PATCH"
      ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2031-01-01" }) }
      : { method });
    const res = await handleSiteData({}, req, url, async () => db, memberDeps(db, SPEC, { id: 7, role: "user" }));
    assert.equal(res.status, 404, method);
    const body = JSON.stringify(await res.json());
    assert.ok(!/yours|permission|forbidden/i.test(body), `${method} must not hint that the row exists: ${body}`);
  }
});

test("editing still needs a session", async () => {
  const { res } = await call("PATCH", "/api/db/shop/rows/mine/5", { body: { date: "2031-01-01" } });
  assert.equal(res.status, 401);
});

test("a collect or display table is still never editable", async () => {
  // Neither has an owner, so there is nobody a scope could name. A `collect`
  // row is another visitor's submission; a `display` row is site content.
  for (const [table, method] of [["bookings", "PATCH"], ["bookings", "DELETE"], ["services", "PATCH"], ["services", "DELETE"]]) {
    const db = fakeDb(SPEC);
    const url = new URL(`https://isibi.ai/api/db/shop/rows/${table}/1`);
    const res = await handleSiteData({}, new Request(url, { method }), url, async () => db, memberDeps(db, SPEC, { id: 7, role: "user" }));
    assert.equal(res.status, 403, `${method} ${table}`);
    assert.ok(!db.__seen.some((q) => /^UPDATE|^DELETE/.test(q.sql)), "and nothing was run");
  }
});

test("a trash table soft-deletes, still owner-scoped", async () => {
  const spec = { tables: [{ name: "drafts", access: "user", columns: [{ name: "body" }], trash: true }] };
  const db = fakeDb(spec);
  const url = new URL("https://isibi.ai/api/db/shop/rows/drafts/5");
  await handleSiteData({}, new Request(url, { method: "DELETE" }), url, async () => db, memberDeps(db, spec, { id: 7, role: "user" }));
  const q = db.__seen.find((x) => /deleted_at/.test(x.sql));
  assert.match(q.sql, /UPDATE "drafts"/, "trash means soft-delete, so a mistake is recoverable");
  assert.match(q.sql, /"owner_id"=\?/, q.sql);
});

// ─────────────────────────────────────────────────────────────── the throttle
//
// `rateLimit` and `rateLimits` have been parsed and stored in _meta since the
// schema engine was written, and nothing ever read them. These assert on where
// the check sits as much as what it decides — a throttle that runs after the
// database read has not saved the thing it exists to save.

const limited = (spec, over = {}) => {
  const calls = [];
  const db = fakeDb(spec);
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await db.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => spec,
    rateLimit: (key, limit) => { calls.push({ key, limit }); return over.verdict || { ok: true }; },
    resolveVisitor: over.resolveVisitor,
  };
  return { db, deps, calls };
};

const RL_SPEC = {
  rateLimits: { read: 11, write: 7 },
  tables: [
    { name: "services", access: "display", columns: [{ name: "title" }] },
    { name: "bookings", access: "collect", columns: [{ name: "date" }], rateLimit: 3 },
    { name: "mine", access: "user", columns: [{ name: "date" }] },
  ],
};

const rlCall = (deps, method, path, body) => {
  const url = new URL("https://isibi.ai" + path);
  const req = new Request(url, {
    method,
    headers: { "CF-Connecting-IP": "9.9.9.9", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleSiteData({}, req, url, async () => deps.__db, deps);
};

test("the site's declared limits are the ones enforced", async () => {
  const { db, deps, calls } = limited(RL_SPEC); deps.__db = db;
  await rlCall(deps, "GET", "/api/db/shop/rows/services");
  assert.equal(calls[0].limit, 11, "the app's read limit");
  await rlCall(deps, "POST", "/api/db/shop/rows/services", { title: "x" });
  assert.equal(calls[1].limit, 7, "the app's write limit");
  await rlCall(deps, "POST", "/api/db/shop/rows/bookings", { date: "2030-01-01" });
  assert.equal(calls[2].limit, 3, "the table's own limit wins for a write");
});

test("a throttled request is 429 and never reaches the database", async () => {
  const { db, deps } = limited(RL_SPEC, { verdict: { ok: false, limit: 3, retryAfter: 42 } });
  deps.__db = db;
  const res = await rlCall(deps, "POST", "/api/db/shop/rows/bookings", { date: "2030-01-01" });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "42");
  assert.equal((await res.json()).code, "rate_limit");
  assert.ok(!db.__seen.some((q) => /^INSERT/i.test(q.sql.trim())), "nothing was written");
});

test("the throttle runs BEFORE the visitor is resolved", async () => {
  // Resolving a visitor is a database read of its own. A flood must pay for
  // none of it — and this is also what stops an unauthenticated flood from
  // being cheaper to send than to refuse.
  let resolved = 0;
  const { db, deps } = limited(RL_SPEC, {
    verdict: { ok: false, limit: 1, retryAfter: 60 },
    resolveVisitor: async () => { resolved++; return { id: 1, role: "user" }; },
  });
  deps.__db = db;
  const res = await rlCall(deps, "GET", "/api/db/shop/rows/mine");
  assert.equal(res.status, 429);
  assert.equal(resolved, 0);
});

test("a spoofable forwarding header is NOT what the bucket keys on", async () => {
  // X-Forwarded-For is a request header like any other. Honouring it would let
  // one caller mint a fresh bucket per request and walk through the limiter.
  const { db, deps, calls } = limited(RL_SPEC); deps.__db = db;
  const url = new URL("https://isibi.ai/api/db/shop/rows/services");
  for (const xff of ["1.1.1.1", "2.2.2.2"]) {
    await handleSiteData({}, new Request(url, { headers: { "X-Forwarded-For": xff } }), url, async () => db, deps);
  }
  assert.equal(calls[0].key, calls[1].key, "two X-Forwarded-For values must share one bucket");
  assert.match(calls[0].key, /unknown/, "and with no CF header it is the shared unknown bucket");
});

test("the bucket is per source, per site and — for writes — per table", async () => {
  const { db, deps, calls } = limited(RL_SPEC); deps.__db = db;
  await rlCall(deps, "POST", "/api/db/shop/rows/bookings", { date: "2030-01-01" });
  await rlCall(deps, "POST", "/api/db/shop/rows/services", { title: "x" });
  await rlCall(deps, "GET", "/api/db/shop/rows/services");
  await rlCall(deps, "GET", "/api/db/shop/rows/bookings");
  assert.match(calls[0].key, /9\.9\.9\.9/);
  assert.match(calls[0].key, /shop/);
  assert.notEqual(calls[0].key, calls[1].key, "two forms do not share one write budget");
  assert.equal(calls[2].key, calls[3].key, "but a page's several lists share one read budget");
});

test("an undeclared table is refused before it can be counted", async () => {
  // Otherwise scanning for table names would fill the limiter's table with
  // keys for tables that do not exist.
  const { db, deps, calls } = limited(RL_SPEC); deps.__db = db;
  const res = await rlCall(deps, "GET", "/api/db/shop/rows/secrets");
  assert.equal(res.status, 404);
  assert.deepEqual(calls, []);
});

test("no limiter injected means no throttling, not a crash", async () => {
  // worker.js supplies the real one; every other caller and every older test
  // passes deps without it.
  const { res } = await call("GET", "/api/db/shop/rows/services");
  assert.equal(res.status, 200);
});

test("a submission tells the owner, and a failure there does not fail the submit", async () => {
  // The booking has already been written by the time this runs. A broken mailer
  // must not look like a broken form.
  const seenHook = [];
  const db = fakeDb(SPEC);
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await db.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => SPEC,
    onSubmit: (x) => { seenHook.push(x); throw new Error("mailer exploded"); },
  };
  const url = new URL("https://isibi.ai/api/db/shop/rows/bookings");
  const req = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2030-01-01" }) });
  const res = await handleSiteData({}, req, url, async () => db, deps);
  assert.equal(res.status, 201, "the visitor's booking still succeeded");
  assert.equal(seenHook.length, 1);
  assert.equal(seenHook[0].table, "bookings");
  assert.equal(seenHook[0].access, "collect");
  assert.equal(seenHook[0].method, "POST");
});

test("a read never fires the notify hook", async () => {
  let fired = 0;
  const db = fakeDb(SPEC);
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await db.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => SPEC,
    onSubmit: () => { fired++; },
  };
  const url = new URL("https://isibi.ai/api/db/shop/rows/services");
  await handleSiteData({}, new Request(url), url, async () => db, deps);
  assert.equal(fired, 0);
});

// ═══════════════════════════════════════════════════ the declared public view
//
// The case every booking site has: a visitor must see WHICH SLOTS ARE TAKEN
// without seeing who took them. Without this a booking table is either `collect`
// — nobody can read it, so a page cannot grey out a taken slot — or readable,
// and every customer's name and email is public.
//
// It deliberately ignores the access level, which is exactly why every part of
// it has to be written down in the schema and nothing is inferred.

const PV_SPEC = {
  tables: [
    { name: "bookings", access: "collect",
      columns: [{ name: "appointment_date" }, { name: "appointment_time" }, { name: "customer_name" }, { name: "customer_email" }, { name: "status" }],
      publicView: { columns: ["appointment_date", "appointment_time"], where: ["status:eq:confirmed"], limit: 500 } },
    { name: "private", access: "collect", columns: [{ name: "a" }] },
    { name: "trashy", access: "collect", columns: [{ name: "a" }], trash: true,
      publicView: { columns: ["a"], where: [], limit: 500 } },
  ],
};

const pvCall = async (path, spec = PV_SPEC, over = {}) => {
  const url = new URL("https://isibi.ai" + path);
  const db = fakeDb(spec, { rows: over.rows || [{ appointment_date: "2031-03-03", appointment_time: "14:00" }] });
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await db.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => spec,
    ...over.deps,
  };
  const res = await handleSiteData({}, new Request(url, over.init), url, async () => db, deps);
  return { res, seen: db.__seen.filter((q) => !/_meta/.test(q.sql)) };
};

test("a visitor sees which slots are taken, and nothing about who took them", async () => {
  const { res, seen } = await pvCall("/api/db/shop/rows/bookings/public");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.rows, [{ appointment_date: "2031-03-03", appointment_time: "14:00" }]);
  // The SELECT names the declared columns — there is no wildcard to leak through.
  assert.match(seen[0].sql, /SELECT "appointment_date","appointment_time" FROM "bookings"/);
  assert.ok(!/customer_name|customer_email|\*/.test(seen[0].sql), seen[0].sql);
});

test("the DECLARED filter is applied, so an unconfirmed row is not published", async () => {
  const { seen } = await pvCall("/api/db/shop/rows/bookings/public");
  assert.match(seen[0].sql, /"status"=\?/);
  assert.ok(seen[0].params.includes("confirmed"), JSON.stringify(seen[0].params));
});

test("a caller may narrow the view but never widen it", async () => {
  const { seen } = await pvCall("/api/db/shop/rows/bookings/public?appointment_date=2031-03-03");
  assert.match(seen[0].sql, /"appointment_date"=\?/);
  // …and the declared filter is still there, ANDed on after it.
  assert.match(seen[0].sql, /"status"=\?/);
  assert.ok(seen[0].params.includes("2031-03-03") && seen[0].params.includes("confirmed"), JSON.stringify(seen[0].params));
});

test("a filter on a column the view does not publish is ignored, not honoured", async () => {
  // Otherwise the query string becomes an oracle: filtering on customer_email
  // and watching the row count answers "does this person have a booking?".
  const { seen } = await pvCall("/api/db/shop/rows/bookings/public?customer_email=ada@example.com&status=cancelled");
  assert.ok(!/customer_email/.test(seen[0].sql), seen[0].sql);
  assert.ok(!seen[0].params.includes("ada@example.com"), JSON.stringify(seen[0].params));
  assert.ok(!seen[0].params.includes("cancelled"), "a caller cannot override the declared filter");
});

test("a table that declares no public view is still refused", async () => {
  const { res, seen } = await pvCall("/api/db/shop/rows/private/public");
  assert.equal(res.status, 404);
  assert.deepEqual(seen, [], "and nothing was read");
});

test("an undeclared table is 404, not a public view of something", async () => {
  const { res } = await pvCall("/api/db/shop/rows/nope/public");
  assert.equal(res.status, 404);
});

test("the view is read-only", async () => {
  for (const method of ["POST", "PATCH", "DELETE", "PUT"]) {
    const { res, seen } = await pvCall("/api/db/shop/rows/bookings/public", PV_SPEC, { init: { method } });
    assert.equal(res.status, 405, method);
    assert.deepEqual(seen, []);
  }
});

test("`public` is not mistaken for a row id", async () => {
  // The two live on the same path shape, and reading /public as an id would
  // send the word into a Postgres integer comparison.
  const { seen } = await pvCall("/api/db/shop/rows/bookings/public");
  assert.ok(!/id=\?/.test(seen[0].sql), seen[0].sql);
  assert.ok(!seen[0].params.includes("public"), JSON.stringify(seen[0].params));
});

test("the declared limit caps what a caller can ask for", async () => {
  const spec = JSON.parse(JSON.stringify(PV_SPEC));
  spec.tables[0].publicView.limit = 10;
  const { seen } = await pvCall("/api/db/shop/rows/bookings/public?limit=9999", spec);
  assert.equal(seen[0].params[seen[0].params.length - 2], 10, JSON.stringify(seen[0].params));
  const { seen: s2 } = await pvCall("/api/db/shop/rows/bookings/public?limit=3", spec);
  assert.equal(s2[0].params[s2[0].params.length - 2], 3, "a smaller ask is honoured");
});

test("a soft-deleted row is not a taken slot", async () => {
  const { seen } = await pvCall("/api/db/shop/rows/trashy/public");
  assert.match(seen[0].sql, /"deleted_at" IS NULL/);
});

test("the public view is throttled like any other read", async () => {
  const calls = [];
  const { res } = await pvCall("/api/db/shop/rows/bookings/public", PV_SPEC, {
    deps: { rateLimit: (k, l) => { calls.push({ k, l }); return { ok: false, limit: l, retryAfter: 42 }; } },
  });
  assert.equal(res.status, 429);
  assert.equal(calls.length, 1);
});

test("a caller cannot bury the declared filter under a thousand of their own", async () => {
  // Each filter is a bound parameter, so this is not injection — it is a query
  // string that can make the statement arbitrarily large.
  const many = Array.from({ length: 40 }, (_, i) => `appointment_date=${i}`).join("&");
  const { seen } = await pvCall("/api/db/shop/rows/bookings/public?" + many);
  const filters = (seen[0].sql.match(/"appointment_date"=\?/g) || []).length;
  assert.ok(filters <= 6, `${filters} filters reached SQL`);
  assert.match(seen[0].sql, /"status"=\?/, "and the declared one is still there");
});

// ═══════════════════════════════════════════ how much a stranger may send
//
// Until 2026-07-28 the answer was "anything". Measured live: a 3,000,000
// character field went through POST /api/db/<slug>/rows/<table> and landed in
// the owner's Neon database — which they pay for. At 60 writes a minute that is
// ~180 MB a minute of junk into somebody's bill.

const bodyCall = async (method, path, raw, headers = {}) => {
  const url = new URL("https://isibi.ai" + path);
  const db = fakeDb(SPEC);
  const deps = {
    sqlQuery: async (_c, sql, p) => (await db.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await db.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => SPEC,
  };
  const req = new Request(url, { method, headers: { "content-type": "application/json", ...headers }, body: raw });
  const res = await handleSiteData({}, req, url, async () => db, deps);
  return { res, wrote: db.__seen.filter((q) => /^INSERT|^UPDATE/i.test(q.sql.trim())) };
};

test("the body that reached production is now refused, and nothing is written", async () => {
  const { res, wrote } = await bodyCall("POST", "/api/db/shop/rows/bookings",
    JSON.stringify({ date: "2030-01-01", title: "x".repeat(3_000_000) }));
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, "too_big");
  assert.deepEqual(wrote, [], "not one row");
});

test("an ordinary submission still goes through", async () => {
  const { res, wrote } = await bodyCall("POST", "/api/db/shop/rows/bookings",
    JSON.stringify({ date: "2030-01-01", title: "Skin fade" }));
  assert.equal(res.status, 201);
  assert.equal(wrote.length, 1);
});

test("a long single field is clamped rather than losing the booking", async () => {
  // A visitor who pasted too much should get their appointment, not an error
  // about a field they cannot see.
  const { res, wrote } = await bodyCall("POST", "/api/db/shop/rows/bookings",
    JSON.stringify({ date: "2030-01-01", title: "y".repeat(50_000) }));
  assert.equal(res.status, 201);
  const stored = wrote[0].params.find((v) => typeof v === "string" && v.startsWith("yyy"));
  assert.ok(stored.length < 50_000, `stored ${stored.length} chars`);
});

test("the PATCH path is guarded too, not just POST", async () => {
  // A member editing their own row can send just as much as one creating it.
  const url = new URL("https://isibi.ai/api/db/shop/rows/mine/3");
  const db = fakeDb(SPEC);
  const req = new Request(url, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ date: "z".repeat(3_000_000) }),
  });
  const res = await handleSiteData({}, req, url, async () => db, memberDeps(db, SPEC, { id: 7, role: "user" }));
  assert.equal(res.status, 413);
  assert.ok(!db.__seen.some((q) => /^UPDATE/i.test(q.sql.trim())), "nothing was updated");
});

test("malformed JSON is a 400 with a reason, not a silent empty write", async () => {
  const { res, wrote } = await bodyCall("POST", "/api/db/shop/rows/bookings", "{not json");
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "bad_json");
  assert.deepEqual(wrote, []);
});

// ------------------------------------------------------------- teamRead
//
// `user` is private-to-me and `feed` is everyone-sees-everything, with nothing
// in between — and "my team's records" is the read model an internal tool
// actually needs. `teamRead` has been parsed, validated and stored in `_meta`
// since the schema engine was written, with nothing ever reading it.

const TEAM_SPEC = {
  tables: [
    { name: "deals", access: "user", teamRead: true, columns: [{ name: "value" }] },
    { name: "private", access: "user", columns: [{ name: "value" }] },
    { name: "posts", access: "feed", teamRead: true, columns: [{ name: "body" }] },
  ],
};

const teamCall = async (method, path, { visitor = { id: 7, role: "user" }, body } = {}) => {
  const url = new URL("https://isibi.ai" + path);
  const req = new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const conn = fakeDb(TEAM_SPEC);
  const deps = {
    sqlQuery: async (_c, sql, p) => (await conn.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await conn.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => TEAM_SPEC,
    resolveVisitor: async () => visitor,
  };
  return { res: await handleSiteData({}, req, url, async () => conn, deps), seen: conn.__seen };
};

test("a teamRead table shows a manager their reports' rows as well as their own", async () => {
  const { res, seen } = await teamCall("GET", "/api/db/shop/rows/deals");
  assert.equal(res.status, 200);
  const q = seen.find((s) => /FROM "deals"/.test(s.sql));
  assert.match(q.sql, /"owner_id"=\? OR "owner_id" IN \(SELECT id FROM _users WHERE manager_id=\?\)/);
  // Both parameters are the CALLER — never anything off the query string.
  assert.deepEqual(q.params.slice(0, 2), [7, 7]);
});

test("a plain user table is still private, teamRead or not", async () => {
  const { seen } = await teamCall("GET", "/api/db/shop/rows/private");
  const q = seen.find((s) => /FROM "private"/.test(s.sql));
  assert.match(q.sql, /"owner_id"=\?/);
  assert.ok(!/manager_id/.test(q.sql), "a table that did not declare teamRead must not widen");
});

test("teamRead on a feed table changes nothing — feed is already shared", async () => {
  const { seen } = await teamCall("GET", "/api/db/shop/rows/posts");
  const q = seen.find((s) => /FROM "posts"/.test(s.sql));
  assert.ok(!/manager_id/.test(q.sql));
  assert.ok(!/owner_id/.test(q.sql), "feed is readable by any signed-in member");
});

test("teamRead widens READS only — a write still stamps the caller", async () => {
  // A manager sees their team's rows. They do not get to write as their team.
  const { seen } = await teamCall("POST", "/api/db/shop/rows/deals", { body: { value: "10" } });
  const ins = seen.find((s) => /INSERT INTO "deals"/.test(s.sql));
  assert.match(ins.sql, /owner_id/);
  assert.ok(ins.params.includes(7));
});

test("teamRead does not let a query string reach the subquery", async () => {
  const { seen } = await teamCall("GET", "/api/db/shop/rows/deals?owner_id=999&manager_id=999");
  const q = seen.find((s) => /FROM "deals"/.test(s.sql));
  assert.deepEqual(q.params.slice(0, 2), [7, 7]);
  assert.ok(!q.params.includes("999"), "no caller value may reach the ownership clause");
});

// ------------------------------------------------------------- requireVerified
//
// Parsed and stored in _meta since the schema engine was written, enforced by
// nothing. Wiring it waited until verification existed, because a gate nobody
// can pass is a wall — a table declaring it would have locked members out for
// good.

const VERIFY_SPEC = {
  tables: [
    { name: "reviews", access: "feed", requireVerified: true, columns: [{ name: "body" }] },
    { name: "notes", access: "feed", columns: [{ name: "body" }] },
  ],
};

const vCall = async (method, path, { visitor, canVerify = true, body } = {}) => {
  const url = new URL("https://isibi.ai" + path);
  const req = new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const conn = fakeDb(VERIFY_SPEC);
  const deps = {
    sqlQuery: async (_c, sql, p) => (await conn.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await conn.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => VERIFY_SPEC,
    resolveVisitor: async () => visitor,
    canVerify,
  };
  return { res: await handleSiteData({}, req, url, async () => conn, deps), seen: conn.__seen };
};

test("an unverified member cannot write to a table that requires it", async () => {
  const { res, seen } = await vCall("POST", "/api/db/shop/rows/reviews", {
    visitor: { id: 7, role: "user", verified: false }, body: { body: "hi" },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body ? undefined : undefined, undefined);
  assert.ok(!seen.some((s) => /INSERT INTO "reviews"/.test(s.sql)), "nothing may be written");
});

test("a verified member can", async () => {
  const { res } = await vCall("POST", "/api/db/shop/rows/reviews", {
    visitor: { id: 7, role: "user", verified: true }, body: { body: "hi" },
  });
  assert.equal(res.status, 201);
});

test("reading is never gated on verification", async () => {
  // The point is to stop unattributable WRITING, not to hide the site from
  // somebody who has not opened their email yet.
  const { res } = await vCall("GET", "/api/db/shop/rows/reviews", {
    visitor: { id: 7, role: "user", verified: false },
  });
  assert.equal(res.status, 200);
});

test("a table that did not ask for it is unaffected", async () => {
  const { res } = await vCall("POST", "/api/db/shop/rows/notes", {
    visitor: { id: 7, role: "user", verified: false }, body: { body: "hi" },
  });
  assert.equal(res.status, 201);
});

test("without a mailer the rule FAILS OPEN", async () => {
  // Enforcing where confirming an address is impossible buys nothing and costs
  // the site every write. It starts working the day the mailer key ships.
  const { res } = await vCall("POST", "/api/db/shop/rows/reviews", {
    visitor: { id: 7, role: "user", verified: false }, canVerify: false, body: { body: "hi" },
  });
  assert.equal(res.status, 201);
});

// ------------------------------------------------------------- mask
//
// `maskFields` was written with the schema engine and called by NOTHING until
// 2026-07-29, so a table declaring `mask` served the raw value to everyone. The
// third instance this session of implemented-and-unreachable, after `unique` and
// `teamRead`.
import { maskFields, normalizeSchema } from "../site-schema.mjs";

const PHONE = "07700900123";
const masked = (role, cfg = { roles: ["staff"], keep: 4 }) => {
  const rows = [{ id: 1, phone: PHONE, name: "Ada" }];
  maskFields({ mask: { phone: { char: "•", ...cfg } } }, rows, role);
  return rows[0];
};

test("a role that may not see it gets the tail only", () => {
  const r = masked("public");
  assert.equal(r.phone, "•••••••0123");
  assert.equal(r.name, "Ada", "only the declared column is touched");
  assert.equal(r.id, 1);
});

test("a listed role sees the real value", () => {
  assert.equal(masked("staff").phone, PHONE);
});

test("admin always sees the real value, listed or not", () => {
  // Otherwise an owner's own staff view is redacted and nobody can read it back.
  assert.equal(masked("admin").phone, PHONE);
});

test("an anonymous visitor counts as `public`", () => {
  // The case it mostly exists for: a public directory showing a partial number.
  for (const role of [null, undefined, ""]) assert.equal(masked(role).phone, "•••••••0123");
});

test("keep:0 hides the value completely, and a short value is not lengthened", () => {
  assert.equal(masked("public", { roles: [], keep: 0 }).phone, "•".repeat(PHONE.length));
  const rows = [{ phone: "12" }];
  maskFields({ mask: { phone: { roles: [], keep: 4, char: "•" } } }, rows, "public");
  assert.equal(rows[0].phone, "12", "keeping more than exists must not invent characters");
});

test("nothing to mask is left alone", () => {
  const rows = [{ phone: null }, { phone: "" }, {}];
  maskFields({ mask: { phone: { roles: [], keep: 4, char: "•" } } }, rows, "public");
  assert.deepEqual(rows, [{ phone: null }, { phone: "" }, {}]);
  assert.deepEqual(maskFields({}, [{ phone: PHONE }], "public"), [{ phone: PHONE }]);
  assert.deepEqual(maskFields({ mask: { phone: {} } }, [], "public"), []);
});

test("the designer's ARRAY form parses to the map the enforcement reads", () => {
  // A map keyed by column name needs `additionalProperties` in a tool schema,
  // and an under-specified schema there took the builder down for three merges.
  const spec = normalizeSchema({
    tables: [{
      name: "staff", access: "display", columns: ["name", "phone"],
      mask: [{ column: "phone", roles: ["staff"], keep: 4 }],
    }],
  });
  const t = spec.tables[0];
  assert.deepEqual(t.mask, { phone: { roles: ["staff"], keep: 4, char: "•" } });
});

test("the map form still parses, so nothing already stored breaks", () => {
  const spec = normalizeSchema({
    tables: [{ name: "staff", access: "display", columns: ["phone"], mask: { phone: { roles: ["staff"], keep: 2 } } }],
  });
  assert.deepEqual(spec.tables[0].mask, { phone: { roles: ["staff"], keep: 2, char: "•" } });
});

test("the read path actually calls it", () => {
  // The whole point. A test of maskFields alone would have passed every day it
  // was dead code.
  const src = fs.readFileSync(new URL("../site-data.mjs", import.meta.url), "utf8");
  // ONE call site, deliberately: a single-row GET goes through the same list
  // path (it is an id filter, not a separate query), and the only other place a
  // row is returned is the 201 echoing back what the visitor just submitted —
  // redacting somebody's own data back to them is wrong, not safe.
  const calls = src.match(/maskFields\(/g) || [];
  assert.equal(calls.length, 1, "expected exactly one mask call site, found " + calls.length);
  assert.match(src, /maskFields\(def, rows, visitor && visitor\.role\)/,
    "it must mask against the RESOLVED visitor's role, not a role off the request");
});

test("no query string can unmask a column", async () => {
  // The mutation that survived the first pass: masking against a role read off
  // the REQUEST rather than the resolved visitor. `?role=admin` would then
  // unredact every masked column on a public table, for anyone who tried it.
  const spec = {
    tables: [{
      name: "staff", access: "display", columns: [{ name: "name" }, { name: "phone" }],
      mask: { phone: { roles: ["staff"], keep: 4, char: "•" } },
    }],
  };
  const conn = {
    __seen: [],
    query: async (sql, p) => {
      conn.__seen.push([sql, p]);
      return { rows: [{ id: 1, name: "Ada", phone: "07700900123" }], rowCount: 1 };
    },
  };
  const deps = {
    sqlQuery: async (_c, sql, p) => (await conn.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await conn.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => spec,
  };
  for (const qs of ["", "?role=admin", "?role=staff", "?visitor.role=admin"]) {
    const url = new URL("https://isibi.ai/api/db/shop/rows/staff" + qs);
    const res = await handleSiteData({}, new Request(url), url, async () => conn, deps);
    const body = await res.json();
    assert.equal(body.rows[0].phone, "•••••••0123", "unmasked by " + (qs || "(no query)"));
  }
});

test("a single-row GET is the same path, so it masks too", async () => {
  // It is an id FILTER on the list read, not a separate query — worth pinning,
  // because "there is only one read path" is what justifies one call site.
  const spec = {
    tables: [{
      name: "staff", access: "display", columns: [{ name: "name" }, { name: "phone" }],
      mask: { phone: { roles: ["staff"], keep: 4, char: "\u2022" } },
    }],
  };
  const conn = { query: async () => ({ rows: [{ id: 1, name: "Ada", phone: "07700900123" }], rowCount: 1 }) };
  const deps = {
    sqlQuery: async (_c, sql, p) => (await conn.query(sql, p)).rows,
    sqlExec: async () => ({ results: [], changes: 1 }),
    loadSiteSchema: async () => spec,
  };
  for (const qs of ["", "?role=admin"]) {
    const url = new URL("https://isibi.ai/api/db/shop/rows/staff/1" + qs);
    const res = await handleSiteData({}, new Request(url), url, async () => conn, deps);
    const body = await res.json();
    const row = body.row || (body.rows && body.rows[0]);
    assert.equal(row.phone, "\u2022\u2022\u2022\u2022\u2022\u2022\u20220123", "unmasked by " + (qs || "(no query)"));
  }
});

// ------------------------------------------------------------- teamScope
//
// `teamScope` has been parsed since the schema engine was written, and
// `applySiteSchema` has been stamping a `team_id` column onto every table that
// declares it — with no query ever reading or setting it. The fifth
// implemented-and-unreachable feature this session.

const SCOPE_SPEC = {
  tables: [{ name: "deals", access: "user", teamScope: true, columns: [{ name: "title" }] }],
};
const scopeCall = async (method, path, { body, visitor } = {}) => {
  const url = new URL("https://isibi.ai" + path);
  const req = new Request(url, {
    method,
    headers: body ? { "content-type": "application/json", Authorization: "Bearer t" } : { Authorization: "Bearer t" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const seen = [];
  const conn = { query: async (sql, p) => { seen.push([sql, p]); return { rows: [{ id: 1 }], rowCount: 1 }; } };
  const deps = {
    sqlQuery: async (_c, sql, p) => (await conn.query(sql, p)).rows,
    sqlExec: async (_c, sql, p) => { const r = await conn.query(sql, p); return { results: r.rows, changes: r.rowCount }; },
    loadSiteSchema: async () => SCOPE_SPEC,
    resolveVisitor: async () => visitor,
  };
  const res = await handleSiteData({}, req, url, async () => conn, deps);
  return { res, seen };
};

test("a member WITH a team reads their own rows and the team's", async () => {
  const { seen } = await scopeCall("GET", "/api/db/shop/rows/deals", { visitor: { id: 7, role: "user", team_id: 3 } });
  const [sql, p] = seen.find(([s]) => /SELECT \* FROM/.test(s));
  assert.match(sql, /\("owner_id"=\? OR "team_id"=\?\)/, sql);
  assert.ok(p.includes(7) && p.includes(3), JSON.stringify(p));
});

test("a member with NO team never sees another teamless member's rows", async () => {
  // Before an owner sets any team up, EVERY member is teamless — so getting this
  // wrong shows the whole site each other's records.
  const { seen } = await scopeCall("GET", "/api/db/shop/rows/deals", { visitor: { id: 7, role: "user", team_id: null } });
  const [sql, p] = seen.find(([s]) => /SELECT \* FROM/.test(s));
  assert.ok(!/team_id/.test(sql), "a teamless read must not mention team_id: " + sql);
  assert.match(sql, /"owner_id"=\?/);
  assert.deepEqual(p.slice(0, 1), [7]);
});

test("a write stamps the team from the session, never the body", async () => {
  const { seen } = await scopeCall("POST", "/api/db/shop/rows/deals", {
    visitor: { id: 7, role: "user", team_id: 3 },
    body: { title: "x", team_id: 999, owner_id: 999 },
  });
  const [sql, p] = seen.find(([s]) => /INSERT INTO/.test(s));
  assert.match(sql, /"team_id"/, sql);
  assert.ok(p.includes(3), "the session's team: " + JSON.stringify(p));
  assert.ok(!p.includes(999), "a body must not be able to claim a team or an owner: " + JSON.stringify(p));
});

test("a teamless write stamps an owner and no team at all", async () => {
  // Not `team_id = null` explicitly — the column defaults to null, and writing
  // it would be indistinguishable from a bug that cleared somebody's team.
  const { seen } = await scopeCall("POST", "/api/db/shop/rows/deals", {
    visitor: { id: 7, role: "user", team_id: null }, body: { title: "x" },
  });
  const [sql] = seen.find(([s]) => /INSERT INTO/.test(s));
  assert.ok(!/team_id/.test(sql), sql);
});

test("the team may EDIT the team's rows — the difference from teamRead", async () => {
  const { seen } = await scopeCall("PATCH", "/api/db/shop/rows/deals/5", {
    visitor: { id: 7, role: "user", team_id: 3 }, body: { title: "corrected" },
  });
  const [sql, p] = seen.find(([s]) => /UPDATE/.test(s));
  assert.match(sql, /\("owner_id"=\? OR "team_id"=\?\)/, sql);
  assert.ok(p.includes(3), JSON.stringify(p));
});

test("a teamless member still edits only their own", async () => {
  const { seen } = await scopeCall("PATCH", "/api/db/shop/rows/deals/5", {
    visitor: { id: 7, role: "user", team_id: null }, body: { title: "x" },
  });
  const [sql] = seen.find(([s]) => /UPDATE/.test(s));
  assert.ok(!/team_id/.test(sql), sql);
  assert.match(sql, /"owner_id"=\?/);
});

test("a table that does NOT declare teamScope is untouched", async () => {
  // The whole feature is opt-in; a customer-facing members area must keep
  // behaving exactly as it did.
  const url = new URL("https://isibi.ai/api/db/shop/rows/mine");
  const seen = [];
  const conn = { query: async (sql, p) => { seen.push([sql, p]); return { rows: [], rowCount: 0 }; } };
  const deps = {
    sqlQuery: async (_c, sql, p) => (await conn.query(sql, p)).rows,
    sqlExec: async () => ({ results: [], changes: 0 }),
    loadSiteSchema: async () => SPEC,
    resolveVisitor: async () => ({ id: 7, role: "user", team_id: 3 }),
  };
  await handleSiteData({}, new Request(url, { headers: { Authorization: "Bearer t" } }), url, async () => conn, deps);
  const [sql] = seen.find(([s]) => /SELECT \* FROM/.test(s));
  assert.ok(!/team_id/.test(sql), "a table without teamScope must not gain a team clause: " + sql);
});

// The site owner reading their own data.
//
// The oldest gap in the builder: `collect` is write-only by design, so one
// visitor can never read back another's submission — which meant nobody could,
// including the person the bookings were for. A barber shop took appointments it
// could not see.
//
// This is a SECOND door onto the same database, authenticated by an isibi
// session rather than a site one. Everything tested here is about that door
// staying shut to everyone except the one account that owns the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleOwnerData, handleOwnerTables, handleOwnerWrite, handleOwnerMembers } from "../site-owner.mjs";

const SPEC = {
  tables: [
    { name: "bookings", access: "collect", columns: [{ name: "customer_name" }, { name: "email" }] },
    { name: "services", access: "display", columns: [{ name: "title" }, { name: "price" }] },
  ],
};

function harness(over = {}) {
  const seen = [];
  const deps = {
    ownerOf: async () => "owner-1",
    dbFor: async () => "postgres://conn",
    loadSchema: async () => SPEC,
    query: async (_db, sql, args) => { seen.push({ sql, args }); return over.rows || [{ id: 2, customer_name: "Ada", _fts: "'ada':1" }]; },
    ident: (n) => '"' + n + '"',
    ...over.deps,
  };
  return { deps, seen };
}

const read = (deps, o = {}) => handleOwnerData(deps, { slug: "cafe", table: "bookings", uid: "owner-1", ...o });

test("the owner reads their own collect table — the whole point", async () => {
  // The public API refuses this on purpose. The owner's door is the only way the
  // bookings ever reach the person they were made with.
  const { deps, seen } = harness();
  const r = await read(deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.access, "collect");
  assert.equal(r.body.rows[0].customer_name, "Ada");
  assert.match(seen[0].sql, /SELECT \* FROM "bookings"/);
});

test("the search vector is stripped here too", async () => {
  const { deps } = harness();
  const r = await read(deps);
  assert.ok(!("_fts" in r.body.rows[0]), JSON.stringify(r.body.rows[0]));
});

test("newest first by default", async () => {
  // These are submissions; the useful one is the latest.
  const { deps, seen } = harness();
  await read(deps);
  assert.match(seen[0].sql, /ORDER BY "id" DESC/);
});

// ------------------------------------------------------ who may open the door

test("someone else's site is 404, not 403", async () => {
  // The slug space is public and guessable. A 403 would confirm which names are
  // taken, and by extension that a given business is a customer.
  const { deps, seen } = harness({ deps: { ownerOf: async () => "someone-else" } });
  const r = await read(deps);
  assert.equal(r.status, 404);
  assert.deepEqual(seen, [], "and nothing was queried");
});

test("an unknown site is 404", async () => {
  const { deps } = harness({ deps: { ownerOf: async () => null } });
  assert.equal((await read(deps)).status, 404);
});

test("no session is 401", async () => {
  const { deps, seen } = harness();
  assert.equal((await read(deps, { uid: null })).status, 401);
  assert.equal((await read(deps, { uid: undefined })).status, 401);
  assert.deepEqual(seen, []);
});

test("an unreadable ownership record fails CLOSED", async () => {
  // The build route made exactly this mistake with `catch {}` and one Supabase
  // timeout handed a site to a stranger. "I cannot tell who owns this" must
  // never become "anyone may read its submissions".
  const { deps, seen } = harness({ deps: { ownerOf: async () => { throw new Error("supabase down"); } } });
  const r = await read(deps);
  assert.equal(r.status, 503);
  assert.deepEqual(seen, [], "nothing is read while ownership is unknown");
});

// ------------------------------------------------------------ the table name

test("a table the schema never declared is refused", async () => {
  // The name reaches SQL. The declared list is what makes this an allow-list
  // rather than an identifier chosen by the caller.
  const { deps, seen } = harness();
  for (const table of ["_users", "pg_shadow", "bookings; DROP TABLE x", "", null, "BOOKINGS "]) {
    const r = await handleOwnerData(deps, { slug: "cafe", table, uid: "owner-1" });
    assert.equal(r.status, 404, JSON.stringify(table));
  }
  assert.deepEqual(seen, []);
});

test("the table name is matched case-insensitively", async () => {
  const { deps } = harness();
  assert.equal((await handleOwnerData(deps, { slug: "cafe", table: "Bookings", uid: "owner-1" })).status, 200);
});

// ------------------------------------------------------------ paging + order

test("limit and offset are clamped, never trusted", async () => {
  const { deps, seen } = harness();
  await read(deps, { params: { limit: "99999", offset: "-5" } });
  assert.deepEqual(seen[0].args, [200, 0]);
  await read(deps, { params: { limit: "nonsense", offset: "nonsense" } });
  assert.deepEqual(seen[1].args, [50, 0]);
});

test("order is allow-listed against the declared columns", async () => {
  const { deps, seen } = harness();
  await read(deps, { params: { order: "customer_name", dir: "asc" } });
  assert.match(seen[0].sql, /ORDER BY "customer_name" ASC/);
  // Anything else falls back to id rather than reaching SQL.
  await read(deps, { params: { order: "password; DROP TABLE x" } });
  assert.match(seen[1].sql, /ORDER BY "id" DESC/);
  await read(deps, { params: { order: "_fts" } });
  assert.match(seen[2].sql, /ORDER BY "id"/);
});

// ------------------------------------------------------------ the listing

test("the listing counts what is waiting in each table", async () => {
  const { deps } = harness({ deps: { query: async () => [{ n: 3 }] } });
  const r = await handleOwnerTables(deps, { slug: "cafe", uid: "owner-1" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.tables, [
    { name: "bookings", access: "collect", rows: 3, columns: ["customer_name", "email"] },
    { name: "services", access: "display", rows: 3, columns: ["title", "price"] },
  ]);
});

test("the listing carries the columns an edit form is built from", async () => {
  // Without them the caller needs a round trip per table just to draw a form —
  // and managed columns are filtered out, because a field for `id` or `_fts` is
  // one whose value is silently dropped on save.
  const spec = { tables: [{ name: "gallery", access: "display", columns: [{ name: "caption" }, { name: "position" }, { name: "id" }] }] };
  const { deps } = harness({ deps: { loadSchema: async () => spec, query: async () => [{ n: 1 }] } });
  const r = await handleOwnerTables(deps, { slug: "cafe", uid: "owner-1" });
  assert.deepEqual(r.body.tables[0].columns, ["caption"]);
});

test("one uncountable table does not lose the rest", async () => {
  // A schema row can outlive its table if an apply half-succeeded. The owner
  // still wants to see everything else.
  let n = 0;
  const { deps } = harness({ deps: { query: async () => { if (++n === 1) throw new Error("relation does not exist"); return [{ n: 7 }]; } } });
  const r = await handleOwnerTables(deps, { slug: "cafe", uid: "owner-1" });
  assert.deepEqual(r.body.tables.map((t) => t.rows), [null, 7]);
});

test("the listing is behind the same ownership gate", async () => {
  const { deps } = harness({ deps: { ownerOf: async () => "someone-else" } });
  assert.equal((await handleOwnerTables(deps, { slug: "cafe", uid: "owner-1" })).status, 404);
  assert.equal((await handleOwnerTables(deps, { slug: "cafe", uid: null })).status, 401);
  const { deps: broken } = harness({ deps: { ownerOf: async () => { throw new Error("down"); } } });
  assert.equal((await handleOwnerTables(broken, { slug: "cafe", uid: "owner-1" })).status, 503);
});

// ═══════════════════════════════════════════════ the owner CHANGING their data
//
// The gap GENERATOR.md still lists under "not available yet": nothing could
// write to a `display` table after the build — not a visitor, not the owner,
// there was no route — so a café could not correct a price without rebuilding
// the whole site. That is also the entire reason build-time seeding exists.

const WSPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "title" }, { name: "price" }] },
    { name: "bookings", access: "collect", columns: [{ name: "customer_name" }] },
    { name: "posts", access: "feed", columns: [{ name: "body" }] },
    { name: "mine", access: "user", columns: [{ name: "body" }] },
    { name: "drafts", access: "display", columns: [{ name: "body" }], trash: true },
    // An `ordered`/`version`/`trash` table carries engine columns in its stored
    // column list, so "declared" alone does not make them safe to set.
    { name: "gallery", access: "display", ordered: true, trash: true, version: true,
      columns: [{ name: "caption" }, { name: "position" }, { name: "deleted_at" }, { name: "_version" }, { name: "pinned" }] },
  ],
};

function wharness(over = {}) {
  const seen = [];
  const deps = {
    ownerOf: async () => "owner-1",
    dbFor: async () => "postgres://conn",
    loadSchema: async () => WSPEC,
    query: async (_db, sql, args) => { seen.push({ sql, args }); return over.rows || [{ id: 4, title: "Cut", _fts: "'cut':1" }]; },
    exec: async (_db, sql, args) => { seen.push({ sql, args }); return { changes: over.changes === undefined ? 1 : over.changes }; },
    ident: (n) => '"' + n + '"',
    nowSql: () => "to_char(now(),'X')",
    ...over.deps,
  };
  return { deps, seen };
}

const write = (deps, o = {}) => handleOwnerWrite(deps, { slug: "cafe", uid: "owner-1", ...o });

test("the owner edits a display table — the thing that was impossible", async () => {
  const { deps, seen } = wharness();
  const r = await write(deps, { table: "services", method: "PATCH", rowId: "4", body: { price: "25" } });
  assert.equal(r.status, 200);
  assert.match(seen[0].sql, /UPDATE "services" SET "price"=\? WHERE id=\?/);
  assert.deepEqual(seen[0].args, ["25", 4]);
});

test("the owner adds and removes rows", async () => {
  const { deps, seen } = wharness();
  const c = await write(deps, { table: "services", method: "POST", body: { title: "Shave", price: "18" } });
  assert.equal(c.status, 201);
  assert.match(seen[0].sql, /INSERT INTO "services" \("title","price"\) VALUES \(\?,\?\) RETURNING \*/);
  const d = await write(deps, { table: "services", method: "DELETE", rowId: "4" });
  assert.equal(d.status, 200);
  assert.match(seen[1].sql, /DELETE FROM "services" WHERE id=\?/);
});

test("a trash table soft-deletes so a mistake is recoverable", async () => {
  const { deps, seen } = wharness();
  const r = await write(deps, { table: "drafts", method: "DELETE", rowId: "4" });
  assert.equal(r.body.soft, true);
  assert.match(seen[0].sql, /UPDATE "drafts" SET "deleted_at"=/);
  assert.match(seen[0].sql, /"deleted_at" IS NULL/, "and does not re-delete an already-trashed row");
});

test("the owner may moderate a member's row but not forge one", async () => {
  // A `user`/`feed` row belongs to a member, and the owner has no id in this
  // database's _users. An owner-created row would carry owner_id NULL:
  // invisible to every `user` read and unattributable in a feed.
  const { deps, seen } = wharness();
  for (const table of ["mine", "posts"]) {
    const r = await write(deps, { table, method: "POST", body: { body: "hi" } });
    assert.equal(r.status, 409, table);
    assert.equal(r.body.code, "member_table");
  }
  assert.deepEqual(seen, [], "and nothing was inserted");
  // Editing and deleting are moderation, which is the owner's to do.
  assert.equal((await write(deps, { table: "posts", method: "PATCH", rowId: "2", body: { body: "edited" } })).status, 200);
  assert.equal((await write(deps, { table: "mine", method: "DELETE", rowId: "2" })).status, 200);
  assert.ok(!seen.some((q) => /owner_id/.test(q.sql)), "the owner is not scoped to a member id — every row is theirs");
});

// ───────────────────────────────────────────────────────── what cannot be set

test("managed columns are dropped, not written", async () => {
  // The engine owns these. Setting one by hand desynchronises the row from its
  // own indexes — and `owner_id` would be a way to reassign a member's row.
  const { deps, seen } = wharness();
  const r = await write(deps, {
    table: "services", method: "PATCH", rowId: "4",
    body: { id: 99, created_at: "2020-01-01", owner_id: 7, _fts: "x", price: "30" },
  });
  assert.equal(r.status, 200);
  assert.match(seen[0].sql, /SET "price"=\? WHERE id=\?/);
  assert.deepEqual(seen[0].args, ["30", 4]);
});

test("a DECLARED column with a managed name is still refused", async () => {
  // The engine maintains position/deleted_at/_version/pinned and puts them in
  // the table's stored column list. Setting one by hand desynchronises the row
  // from its own ordering, soft-delete and optimistic-lock state — so being
  // declared is not enough.
  const { deps, seen } = wharness();
  const r = await write(deps, {
    table: "gallery", method: "PATCH", rowId: "4",
    body: { position: 1, deleted_at: null, _version: 99, pinned: true, caption: "hi" },
  });
  assert.equal(r.status, 200);
  const upd = seen.find((q) => /^UPDATE/.test(q.sql));
  assert.match(upd.sql, /SET "caption"=\? WHERE id=\?/, upd.sql);
  const post = await write(deps, { table: "gallery", method: "POST", body: { position: 1, _version: 3, caption: "hi" } });
  assert.equal(post.status, 201);
  const ins = seen.find((q) => /^INSERT/.test(q.sql));
  assert.match(ins.sql, /\("caption"\) VALUES/, ins.sql);
});

test("an undeclared column is dropped", async () => {
  const { deps, seen } = wharness();
  await write(deps, { table: "services", method: "POST", body: { title: "Cut", is_admin: true, "; DROP TABLE x": 1 } });
  assert.match(seen[0].sql, /\("title"\) VALUES/);
});

test("a body with nothing writable in it is 400, not an empty statement", async () => {
  const { deps, seen } = wharness();
  for (const body of [{}, { nope: 1 }, { id: 5 }, null]) {
    assert.equal((await write(deps, { table: "services", method: "POST", body })).status, 400, JSON.stringify(body));
    assert.equal((await write(deps, { table: "services", method: "PATCH", rowId: "4", body })).status, 400, JSON.stringify(body));
  }
  assert.deepEqual(seen, []);
});

test("`_users` is unreachable, so no password hash is writable", async () => {
  // It is not a declared table, which is what puts it out of reach here.
  const { deps, seen } = wharness();
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const r = await write(deps, { table: "_users", method, rowId: "1", body: { pass_hash: "x", role: "admin" } });
    assert.equal(r.status, 404, method);
  }
  assert.deepEqual(seen, []);
});

test("a table the schema never declared is refused before any statement", async () => {
  const { deps, seen } = wharness();
  for (const table of ["pg_shadow", "services; DROP TABLE x", "", null]) {
    assert.equal((await write(deps, { table, method: "POST", body: { title: "x" } })).status, 404, JSON.stringify(table));
  }
  assert.deepEqual(seen, []);
});

// ──────────────────────────────────────────────────────────────── the row id

test("a row id that is not a positive integer is 400, never a 500", async () => {
  // It is a bound parameter, so this is not injection — it is a Postgres type
  // error surfacing as a 500 when the honest answer is "no such row".
  const { deps, seen } = wharness();
  for (const rowId of ["abc", "1; DROP TABLE x", "", null, "0", "-3", "1.5", "1e3", " ", "99999999999999999999"]) {
    const r = await write(deps, { table: "services", method: "DELETE", rowId });
    assert.equal(r.status, 400, JSON.stringify(rowId));
  }
  assert.deepEqual(seen, []);
});

test("a row that is not there is 404", async () => {
  const { deps } = wharness({ changes: 0 });
  assert.equal((await write(deps, { table: "services", method: "PATCH", rowId: "4", body: { price: "1" } })).status, 404);
  assert.equal((await write(deps, { table: "services", method: "DELETE", rowId: "4" })).status, 404);
});

test("the search vector never comes back", async () => {
  const { deps } = wharness();
  const r = await write(deps, { table: "services", method: "PATCH", rowId: "4", body: { price: "1" } });
  assert.ok(!("_fts" in r.body.row), JSON.stringify(r.body.row));
});

test("a constraint is the owner's answer, not a 500", async () => {
  // Measured live 2026-07-28: adding a row with a required column left out
  // answered 500 "Something went wrong", so the owner had no idea which field
  // they had missed and retried the identical request.
  const boom = (msg) => wharness({ deps: {
    query: async () => { throw new Error(msg); },
    exec: async () => { throw new Error(msg); },
  } });
  const missing = boom('null value in column "price" violates not-null constraint');
  const r = await handleOwnerWrite(missing.deps, { slug: "cafe", uid: "owner-1", table: "services", method: "POST", body: { title: "Cut" } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "required");
  assert.equal(r.body.field, "price");

  const dup = boom("duplicate key value violates unique constraint");
  const r2 = await handleOwnerWrite(dup.deps, { slug: "cafe", uid: "owner-1", table: "services", method: "PATCH", rowId: "4", body: { title: "Cut" } });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.code, "duplicate");

  // And something genuinely ours is still a 500 rather than a misleading 409.
  const ours = boom("connection terminated unexpectedly");
  const r3 = await handleOwnerWrite(ours.deps, { slug: "cafe", uid: "owner-1", table: "services", method: "POST", body: { title: "Cut" } });
  assert.equal(r3.status, 500);
});

test("an unknown method is 405, not a silent success", async () => {
  const { deps } = wharness();
  assert.equal((await write(deps, { table: "services", method: "PUT", rowId: "4", body: { price: "1" } })).status, 405);
});

// ─────────────────────────────────────────────────── writes are behind the gate

test("writing to someone else's site is 404, and runs nothing", async () => {
  const { deps, seen } = wharness({ deps: { ownerOf: async () => "someone-else" } });
  assert.equal((await write(deps, { table: "services", method: "DELETE", rowId: "4" })).status, 404);
  assert.equal((await write(deps, { table: "services", method: "POST", body: { title: "x" } })).status, 404);
  assert.deepEqual(seen, []);
});

test("writing fails CLOSED when ownership cannot be read", async () => {
  const { deps, seen } = wharness({ deps: { ownerOf: async () => { throw new Error("supabase down"); } } });
  assert.equal((await write(deps, { table: "services", method: "DELETE", rowId: "4" })).status, 503);
  assert.deepEqual(seen, [], "nothing is changed while ownership is unknown");
});

test("no session is 401", async () => {
  const { deps, seen } = wharness();
  assert.equal((await write(deps, { table: "services", method: "POST", uid: null, body: { title: "x" } })).status, 401);
  assert.deepEqual(seen, []);
});

// ═══════════════════════════════════════════════════════════════════ members

test("the members list never selects the password hash", async () => {
  // `SELECT *` here would ship pass_hash the moment anyone adds a column.
  const { deps, seen } = wharness({ rows: [{ id: 1, email: "a@b.c", role: "user" }] });
  const r = await handleOwnerMembers(deps, { slug: "cafe", uid: "owner-1" });
  assert.equal(r.status, 200);
  assert.ok(!/\*/.test(seen[0].sql), seen[0].sql);
  assert.ok(!/pass_hash/.test(seen[0].sql), seen[0].sql);
  assert.match(seen[0].sql, /"email"/);
  assert.deepEqual(r.body.members, [{ id: 1, email: "a@b.c", role: "user" }]);
});

test("a site that never had members lists none rather than erroring", async () => {
  // A site of display and collect tables never had `_users` created.
  const { deps } = wharness({ deps: { query: async () => { throw new Error('relation "_users" does not exist'); } } });
  const r = await handleOwnerMembers(deps, { slug: "cafe", uid: "owner-1" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.members, []);
});

test("the owner can remove a member", async () => {
  const { deps, seen } = wharness();
  const r = await handleOwnerMembers(deps, { slug: "cafe", uid: "owner-1", method: "DELETE", memberId: "3" });
  assert.equal(r.status, 200);
  assert.match(seen[0].sql, /DELETE FROM _users WHERE id=\?/);
  assert.deepEqual(seen[0].args, [3]);
});

test("removing a member that is not there is 404, and a bad id is 400", async () => {
  const { deps: gone } = wharness({ changes: 0 });
  assert.equal((await handleOwnerMembers(gone, { slug: "cafe", uid: "owner-1", method: "DELETE", memberId: "3" })).status, 404);
  const { deps, seen } = wharness();
  for (const memberId of ["abc", "", null, "-1", "0"]) {
    assert.equal((await handleOwnerMembers(deps, { slug: "cafe", uid: "owner-1", method: "DELETE", memberId })).status, 400, JSON.stringify(memberId));
  }
  assert.deepEqual(seen, []);
});

test("members are behind the same gate as everything else", async () => {
  const { deps: theirs, seen } = wharness({ deps: { ownerOf: async () => "someone-else" } });
  assert.equal((await handleOwnerMembers(theirs, { slug: "cafe", uid: "owner-1" })).status, 404);
  assert.equal((await handleOwnerMembers(theirs, { slug: "cafe", uid: "owner-1", method: "DELETE", memberId: "3" })).status, 404);
  assert.deepEqual(seen, [], "a stranger cannot enumerate or delete a site's customers");
  const { deps: down } = wharness({ deps: { ownerOf: async () => { throw new Error("down"); } } });
  assert.equal((await handleOwnerMembers(down, { slug: "cafe", uid: "owner-1" })).status, 503);
  const { deps } = wharness();
  assert.equal((await handleOwnerMembers(deps, { slug: "cafe", uid: null })).status, 401);
});

test("members paging is clamped", async () => {
  const { deps, seen } = wharness();
  await handleOwnerMembers(deps, { slug: "cafe", uid: "owner-1", params: { limit: "99999", offset: "-4" } });
  assert.deepEqual(seen[0].args, [200, 0]);
});

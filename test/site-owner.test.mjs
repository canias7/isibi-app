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
import { handleOwnerData, handleOwnerTables, handleOwnerWrite, handleOwnerMembers, handleOwnerAnalytics } from "../site-owner.mjs";

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







// ═══════════════════════════════════════════════════════════════ analytics
//
// `site_hits` has been written on every visit since the D1 era and NOTHING has
// ever read it — the route the panel calls did not exist, so a published site
// collected traffic its owner could never see. 64 real hits by the time this
// was written.

const STATS = {
  views: 40, visitors: 12, views7: 9, visitors7: 4,
  series: [{ day: "Jul 27", views: 5 }, { day: "Jul 28", views: 4 }],
};
const aharness = (over = {}) => ({
  ownerOf: async () => "owner-1",
  readAnalytics: async () => STATS,
  ...over,
});
const stats = (deps, o = {}) => handleOwnerAnalytics(deps, { slug: "cafe", uid: "owner-1", ...o });

test("the owner sees their traffic", async () => {
  const r = await stats(aharness());
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true, "the panel checks this flag");
  assert.equal(r.body.views, 40);
  assert.equal(r.body.visitors, 12);
  assert.deepEqual(r.body.series, STATS.series);
});

test("it does NOT resolve a database connection", async () => {
  // The numbers live in Supabase, not the site's own database. Resolving one
  // would be a round trip spent on nothing.
  let dbCalls = 0;
  await stats(aharness({ dbFor: async () => { dbCalls++; return "conn"; } }));
  assert.equal(dbCalls, 0);
});

test("a site nobody has visited reads as zero, not as an error", async () => {
  // Otherwise a brand-new site tells its owner the panel is broken.
  // Including a `series` that is truthy but not an array — `.map` on a string or
  // an object throws, and the panel would get a 500 instead of an empty week.
  for (const empty of [{}, null, undefined, { series: null }, { series: "nope" }, { series: {} }, { series: 7 }, { views: null, visitors: undefined }]) {
    const r = await stats(aharness({ readAnalytics: async () => empty }));
    assert.equal(r.status, 200, JSON.stringify(empty));
    assert.equal(r.body.views, 0);
    assert.equal(r.body.visitors, 0);
    assert.deepEqual(r.body.series, []);
  }
});

test("junk in the numbers does not reach the panel as junk", async () => {
  const r = await stats(aharness({ readAnalytics: async () => ({ views: "nonsense", visitors: NaN, series: [{ day: 5, views: "x" }, null] }) }));
  assert.equal(r.body.views, 0);
  assert.equal(r.body.visitors, 0);
  assert.deepEqual(r.body.series, [{ day: "5", views: 0 }, { day: "", views: 0 }]);
});

test("someone else's traffic is 404, and is never read", async () => {
  // Visitor counts are commercially sensitive — how busy is that shop — and the
  // slug space is public and guessable.
  let read = 0;
  const deps = aharness({ ownerOf: async () => "someone-else", readAnalytics: async () => { read++; return STATS; } });
  assert.equal((await stats(deps)).status, 404);
  assert.equal((await stats(aharness({ ownerOf: async () => null }))).status, 404);
  assert.equal(read, 0);
});

test("no session is 401", async () => {
  assert.equal((await stats(aharness(), { uid: null })).status, 401);
});

test("analytics fails CLOSED when ownership cannot be read", async () => {
  let read = 0;
  const deps = aharness({
    ownerOf: async () => { throw new Error("supabase down"); },
    readAnalytics: async () => { read++; return STATS; },
  });
  assert.equal((await stats(deps)).status, 503);
  assert.equal(read, 0, "nothing is read while ownership is unknown");
});

test("a failed read is 503, not a page of confident zeros", async () => {
  // Zeros here would read as "nobody visited your site", which is a different
  // and much worse thing to tell someone than "try again".
  const r = await stats(aharness({ readAnalytics: async () => { throw new Error("rpc down"); } }));
  assert.equal(r.status, 503);
  assert.notEqual(r.body.views, 0);
  assert.equal(r.body.views, undefined);
});

// ------------------------------------------------- promoting a member
//
// Until 2026-07-28 nothing in the codebase could write `_users.role`. The column
// existed, `admin` tables compared against it and per-table `writeRoles` named
// values for it — so every member on every site was `user` forever, which made
// an `admin` table writable by nobody and `writeRoles` a rule about a value that
// could not exist. This is the only route that grants one.

const ROLE_SPEC = {
  tables: [
    { name: "bookings", access: "collect", columns: [{ name: "customer_name" }] },
    { name: "notices", access: "admin", writeRoles: ["editor"], columns: [{ name: "body" }] },
  ],
};

function members(over = {}) {
  const exec = [];
  const deps = {
    ownerOf: async () => "owner-1",
    dbFor: async () => "postgres://conn",
    loadSchema: async () => ROLE_SPEC,
    query: async (_db, sql, args) => {
      if (/FROM _users WHERE id=\?/.test(sql) && over.noSuchMember) return [];
      if (/SELECT id FROM _users/.test(sql)) return over.managerMissing ? [] : [{ id: args[0] }];
      return [{ id: 5, email: "m@x.co", role: "editor", manager_id: 9 }];
    },
    exec: async (_db, sql, args) => { exec.push({ sql, args }); return { changes: over.changes === undefined ? 1 : over.changes }; },
    ident: (n) => '"' + n + '"',
    ...over.deps,
  };
  return { deps, exec };
}

const patch = (deps, body, memberId = "5") =>
  handleOwnerMembers(deps, { slug: "cafe", uid: "owner-1", method: "PATCH", memberId, body });















// ── The site's members, on Neon Auth ────────────────────────────────────────
//
// Rebuilt 2026-07-30 against `neon_auth."user"`. Nothing here talks to Neon: the
// query is captured and asserted, and the decisions — which role may be granted,
// what counts as suspended, what a member id even looks like now — run against
// fakes. What IS being pinned is our end of the seam, because that is where every
// mistake in this migration has been.

const MEM = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  email: "ada@example.com", name: "Ada", emailVerified: true,
  role: "user", banned: false, banReason: null, banExpires: null,
  createdAt: "2026-07-30 10:00:00",
};

function memHarness(over = {}) {
  const seen = [];
  const deps = {
    ownerOf: async () => "owner-1",
    dbFor: async () => "postgres://conn",
    loadSchema: async () => (over.spec || SPEC),
    query: async (_db, sql, args) => { seen.push({ sql, args }); return over.rows || [MEM]; },
    exec: async (_db, sql, args) => { seen.push({ sql, args }); return over.exec || { changes: 1 }; },
    ident: (n) => '"' + n + '"',
    ...over.deps,
  };
  return { deps, seen };
}
const mems = (deps, o = {}) => handleOwnerMembers(deps, { slug: "cafe", uid: "owner-1", ...o });

test("the members list reads neon_auth.user, SCHEMA-QUALIFIED and QUOTED", async () => {
  // Not style. Postgres resolves a bare `user` to the USER value function and
  // returns the current ROLE NAME instead of erroring, so an unqualified query
  // hands the owner a one-row list holding "neondb_owner" and looks exactly like
  // a site with one member. Measured on a real project 2026-07-30.
  const { deps, seen } = memHarness();
  const r = await mems(deps);
  assert.equal(r.status, 200);
  assert.match(seen[0].sql, /FROM neon_auth\."user"/);
  assert.ok(!/FROM neon_auth\.user\b/.test(seen[0].sql), "the table name must be quoted: " + seen[0].sql);
});

test("the list never selects *", async () => {
  // Better Auth keeps credentials in neon_auth.account, which this file never
  // touches — but naming the columns is what stops a column added UPSTREAM from
  // silently starting to leave the database.
  const { deps, seen } = memHarness();
  await mems(deps);
  assert.ok(!/SELECT \*/.test(seen[0].sql), seen[0].sql);
  assert.match(seen[0].sql, /u\."emailVerified"/, "camelCase columns must be quoted or Postgres folds them");
});

test("a member is presented without leaking the raw ban columns as truth", async () => {
  const { deps } = memHarness();
  const r = await mems(deps);
  const m = r.body.members[0];
  assert.equal(m.id, MEM.id);
  assert.equal(m.role, "user");
  assert.equal(m.suspended, false);
  assert.equal(m.verified, true);
});

test("members are behind the same gate as everything else", async () => {
  const { deps } = memHarness({ deps: { ownerOf: async () => "someone-else" } });
  const r = await mems(deps);
  assert.equal(r.status, 404, "not 403 — the slug space is guessable");
});

test("an unreadable ownership record is 503, never a member list", async () => {
  const { deps } = memHarness({ deps: { ownerOf: async () => { throw new Error("supabase down"); } } });
  assert.equal((await mems(deps)).status, 503);
});

test("a member id must be a UUID, and a bad one never reaches SQL", async () => {
  // Ids were sequential integers and are UUIDs now. A malformed one against a
  // `uuid` column is a Postgres type error, which would reach the owner as a 500
  // rather than "no such member".
  for (const bad of ["7", "abc", "3f2504e0-4f89-11d3-9a0c", "' OR 1=1--", ""]) {
    const { deps, seen } = memHarness();
    const r = await mems(deps, { method: "DELETE", memberId: bad });
    assert.equal(r.status, 404, JSON.stringify(bad));
    assert.deepEqual(seen, [], "nothing may reach the database for id " + JSON.stringify(bad));
  }
});

test("a role is allow-listed against what THIS site's tables actually check", async () => {
  // An owner inventing a role no table names has granted a permission nothing can
  // ever test: it reads as "I gave them access" and does nothing.
  const spec = { tables: [{ name: "posts", access: "admin", writeRoles: ["editor"], columns: [{ name: "t" }] }] };
  const { deps } = memHarness({ spec });
  assert.equal((await mems(deps, { method: "PATCH", memberId: MEM.id, body: { role: "editor" } })).status, 200);
  assert.equal((await mems(deps, { method: "PATCH", memberId: MEM.id, body: { role: "admin" } })).status, 200);
  const no = await mems(deps, { method: "PATCH", memberId: MEM.id, body: { role: "wizard" } });
  assert.equal(no.status, 400);
  assert.ok(no.body.roles.includes("editor"), JSON.stringify(no.body));
});

test("a role must be a STRING, not anything stringifiable", async () => {
  // String(7) is "7", which passes a shape test and would make a number a role.
  const { deps } = memHarness();
  for (const bad of [7, true, ["admin"], { role: "admin" }, null]) {
    assert.equal((await mems(deps, { method: "PATCH", memberId: MEM.id, body: { role: bad } })).status, 400, JSON.stringify(bad));
  }
});

test("suspension writes Better Auth's own banned column", async () => {
  // Ours to read, but theirs to enforce: a flag only our read path honoured would
  // leave the member's existing session working against the auth server.
  const { deps, seen } = memHarness();
  const r = await mems(deps, { method: "PATCH", memberId: MEM.id, body: { suspended: true, reason: "spam" } });
  assert.equal(r.status, 200);
  const upd = seen.find((c) => /UPDATE neon_auth\."user"/.test(c.sql));
  assert.ok(upd, JSON.stringify(seen.map((c) => c.sql)));
  assert.match(upd.sql, /banned=\?/);
  assert.ok(upd.args.includes(true), JSON.stringify(upd.args));
  assert.ok(upd.args.includes("spam"), JSON.stringify(upd.args));
});

test("suspended must be a real boolean", async () => {
  // `suspended: "false"` would suspend the member the owner was reinstating.
  const { deps } = memHarness();
  for (const bad of ["false", "true", 0, 1, "yes"]) {
    assert.equal((await mems(deps, { method: "PATCH", memberId: MEM.id, body: { suspended: bad } })).status, 400, JSON.stringify(bad));
  }
});

test("reinstating clears the reason and the expiry, not just the flag", async () => {
  // A lapsed ban's text left attached to a live account reads as still-suspended.
  const { deps, seen } = memHarness();
  await mems(deps, { method: "PATCH", memberId: MEM.id, body: { suspended: false } });
  const upd = seen.find((c) => /UPDATE/.test(c.sql));
  assert.match(upd.sql, /"banReason"=\?/);
  assert.match(upd.sql, /"banExpires"=\?/);
  assert.ok(upd.args.includes(false), JSON.stringify(upd.args));
});

test("a PATCH that changes nothing is a 400, not a silent no-op", async () => {
  const { deps } = memHarness();
  assert.equal((await mems(deps, { method: "PATCH", memberId: MEM.id, body: {} })).status, 400);
});

test("patching or deleting a member that is not there is a 404", async () => {
  const { deps } = memHarness({ exec: { changes: 0 } });
  assert.equal((await mems(deps, { method: "DELETE", memberId: MEM.id })).status, 404);
  assert.equal((await mems(deps, { method: "PATCH", memberId: MEM.id, body: { suspended: true } })).status, 404);
});

test("deleting a member leaves their rows alone", async () => {
  // owner_id stops matching anybody, so the rows drop out of every member-scoped
  // read and stay visible to the owner. A cancelled customer's bookings must not
  // vanish from the appointment list.
  const { deps, seen } = memHarness();
  await mems(deps, { method: "DELETE", memberId: MEM.id });
  assert.equal(seen.length, 1, JSON.stringify(seen.map((c) => c.sql)));
  assert.match(seen[0].sql, /DELETE FROM neon_auth\."user" WHERE id=\?/);
});

test("paging is clamped", async () => {
  const { deps, seen } = memHarness();
  await mems(deps, { params: { limit: "99999", offset: "-5" } });
  assert.ok(seen[0].args[0] <= 200, JSON.stringify(seen[0].args));
  assert.ok(seen[0].args[1] >= 0, JSON.stringify(seen[0].args));
});

test("anything but GET/PATCH/DELETE is 405", async () => {
  const { deps } = memHarness();
  assert.equal((await mems(deps, { method: "PUT", memberId: MEM.id })).status, 405);
});

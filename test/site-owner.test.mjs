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
import { handleOwnerData, handleOwnerTables } from "../site-owner.mjs";

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
    { name: "bookings", access: "collect", rows: 3 },
    { name: "services", access: "display", rows: 3 },
  ]);
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

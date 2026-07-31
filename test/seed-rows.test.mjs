// Starter content for a generated site's `display` tables.
//
// This is not cosmetic and it is not a nicety. Nothing can write to a `display`
// table after a build — not a visitor, not the owner, there is no route — so a
// table left unseeded is an empty list forever. Worse, a form whose required
// field is a Select fed by that table renders with zero options, so nobody can
// submit it. Measured live on 2026-07-28: every site the builder produced was a
// brochure with a dead form. This function is the fix, so its edges matter:
// seeding the wrong table, seeding twice on a revise, or letting one bad row
// take the other eleven with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedSiteRows, MAX_SEED_ROWS } from "../site-schema.mjs";

const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "name" }, { name: "price" }, { name: "duration_minutes" }] },
    { name: "bookings", access: "collect", columns: [{ name: "customer_name" }, { name: "customer_email" }] },
  ],
};

// Records every statement so a test can assert on what was NOT run.
function db(over = {}) {
  const calls = [];
  const sqlQuery = async (uuid, sql, params) => {
    calls.push({ sql, params });
    if (/^SELECT 1 AS x/.test(sql)) return (over.existing || []).includes(tableOf(sql)) ? [{ x: 1 }] : [];
    if (over.failInsert && /^INSERT/.test(sql) && over.failInsert(sql, params)) throw Object.assign(new Error("insert failed"), { detail: "null value in column" });
    if (over.failCount && /^SELECT 1 AS x/.test(sql)) throw new Error("relation does not exist");
    return [];
  };
  return { sqlQuery, calls, deps: { sqlQuery } };
}
const tableOf = (sql) => (sql.match(/"([a-z_]+)"/) || [])[1];
const inserts = (calls) => calls.filter((c) => /^INSERT/.test(c.sql));

test("seeds a display table with the rows it was given", async () => {
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", SPEC, {
    services: [
      { name: "Skin fade", price: 28, duration_minutes: 30 },
      { name: "Beard trim", price: 15, duration_minutes: 20 },
    ],
  }, deps);
  assert.deepEqual(out.seeded, { services: 2 });
  const ins = inserts(calls);
  assert.equal(ins.length, 2);
  assert.match(ins[0].sql, /^INSERT INTO "services" \("name","price","duration_minutes"\) VALUES \(\?,\?,\?\)$/);
  assert.deepEqual(ins[0].params, ["Skin fade", 28, 30], "values are bound, never interpolated");
});

test("refuses to seed a collect table", async () => {
  // Those rows are customer submissions. Fabricating them would put fake people
  // in the owner's booking list, and the API refuses to read them back anyway.
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", SPEC, { bookings: [{ customer_name: "Nobody" }] }, deps);
  assert.deepEqual(out.seeded, {});
  assert.equal(inserts(calls).length, 0);
  assert.ok(out.skipped.some((s) => /only display tables/.test(s)), JSON.stringify(out.skipped));
});

test("refuses a table the schema never declared", async () => {
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", SPEC, { staff: [{ name: "x" }] }, deps);
  assert.equal(inserts(calls).length, 0);
  assert.ok(out.skipped.some((s) => /not a table/.test(s)));
});

test("a table that already has rows is left alone", async () => {
  // The reason this is safe on a revise: a revise re-runs the whole build, and
  // duplicating the menu every time would be worse than never seeding.
  const { deps, calls } = db({ existing: ["services"] });
  const out = await seedSiteRows("conn", SPEC, { services: [{ name: "Skin fade" }] }, deps);
  assert.deepEqual(out.seeded, {});
  assert.equal(inserts(calls).length, 0);
  assert.ok(out.skipped.some((s) => /already has rows/.test(s)));
});

test("emptiness is checked per table, not once", async () => {
  // A revise can add a NEW display table to a site whose existing one already
  // has content the owner would not want replaced. Both must be handled in the
  // same run: skip the full one, seed the new one.
  const spec = { tables: [...SPEC.tables, { name: "offers", access: "display", columns: [{ name: "title" }] }] };
  const { deps, calls } = db({ existing: ["services"] });
  const out = await seedSiteRows("conn", spec, {
    services: [{ name: "Skin fade" }],
    offers: [{ title: "Two for one Tuesdays" }],
  }, deps);
  assert.deepEqual(out.seeded, { offers: 1 });
  assert.deepEqual(inserts(calls).map((c) => tableOf(c.sql)), ["offers"]);
});

test("drops columns the schema does not declare", async () => {
  // The data API drops undeclared fields on a real write; seeding has to behave
  // the same, or a hallucinated column would fail the insert and lose the row.
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", SPEC, { services: [{ name: "Skin fade", colour: "blue", price: 28 }] }, deps);
  assert.deepEqual(out.seeded, { services: 1 });
  assert.match(inserts(calls)[0].sql, /\("name","price"\)/);
  assert.deepEqual(inserts(calls)[0].params, ["Skin fade", 28]);
});

test("never writes a managed column", async () => {
  const { deps, calls } = db();
  const spec = { tables: [{ name: "services", access: "display", columns: [{ name: "id" }, { name: "created_at" }, { name: "owner_id" }, { name: "name" }] }] };
  await seedSiteRows("conn", spec, { services: [{ id: 99, created_at: "2020-01-01", owner_id: "someone", name: "Skin fade" }] }, deps);
  assert.match(inserts(calls)[0].sql, /\("name"\)/);
  assert.deepEqual(inserts(calls)[0].params, ["Skin fade"]);
});

test("coerces the way the data API does", async () => {
  const { deps, calls } = db();
  const spec = { tables: [{ name: "items", access: "display", columns: [{ name: "tags" }, { name: "active" }, { name: "meta" }, { name: "n" }] }] };
  await seedSiteRows("conn", spec, { items: [{ tags: ["a", "b"], active: true, meta: { x: 1 }, n: 0 }] }, deps);
  assert.deepEqual(inserts(calls)[0].params, ['["a","b"]', 1, '{"x":1}', 0],
    "arrays/objects as JSON, booleans as 0/1 (boolean maps to INTEGER), and 0 is a real value");
});

test("one bad row does not take the others with it", async () => {
  // A site with 3 of 4 services is alive. A site with none is the exact failure
  // this function exists to prevent.
  const { deps, calls } = db({ failInsert: (_s, p) => p.includes("Bad") });
  const out = await seedSiteRows("conn", SPEC, {
    services: [{ name: "Skin fade" }, { name: "Bad" }, { name: "Beard trim" }],
  }, deps);
  assert.deepEqual(out.seeded, { services: 2 });
  assert.equal(inserts(calls).length, 3, "it still tried all three");
  assert.ok(out.skipped.some((s) => /services row/.test(s)), JSON.stringify(out.skipped));
});

test("a table that cannot be counted is skipped, not guessed at", async () => {
  const deps = { sqlQuery: async (_u, sql) => { if (/^SELECT 1 AS x/.test(sql)) throw new Error("relation does not exist"); return []; } };
  const out = await seedSiteRows("conn", SPEC, { services: [{ name: "Skin fade" }] }, deps);
  assert.deepEqual(out.seeded, {});
  assert.ok(out.skipped.some((s) => /services:/.test(s)));
});

test("caps how many rows a seed can insert", async () => {
  const { deps, calls } = db();
  const rows = Array.from({ length: 40 }, (_, i) => ({ name: "Service " + i }));
  const out = await seedSiteRows("conn", SPEC, { services: rows }, deps);
  assert.equal(out.seeded.services, MAX_SEED_ROWS);
  assert.equal(inserts(calls).length, MAX_SEED_ROWS);
});

test("tolerates a missing or malformed seed instead of failing the build", async () => {
  // Seeding runs after the database is live. Nothing here may throw, or a build
  // that already succeeded would be reported as a failure.
  for (const bad of [undefined, null, "nope", 42, [], { services: null }, { services: "rows" }, { services: [null, 7, "x", []] }]) {
    const { deps, calls } = db();
    const out = await seedSiteRows("conn", SPEC, bad, deps);
    assert.deepEqual(out.seeded, {}, JSON.stringify(bad));
    assert.equal(inserts(calls).length, 0, JSON.stringify(bad));
  }
});

test("a row with nothing usable in it is skipped, not inserted empty", async () => {
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", SPEC, { services: [{ nope: 1 }, { name: "Skin fade" }] }, deps);
  assert.deepEqual(out.seeded, { services: 1 });
  assert.equal(inserts(calls).length, 1, "an INSERT with no columns is not valid SQL and must never be sent");
});

test("a bad table name cannot reach the SQL", async () => {
  // sqlIdent is the guard; this asserts the guard is actually in the path.
  const { deps, calls } = db();
  const spec = { tables: [{ name: "services", access: "display", columns: [{ name: "name" }] }] };
  const out = await seedSiteRows("conn", spec, { 'services"; DROP TABLE x; --': [{ name: "x" }] }, deps);
  assert.equal(inserts(calls).length, 0);
  assert.ok(out.skipped.some((s) => /not a table/.test(s)));
});

test("table and column names are matched case-insensitively", async () => {
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", SPEC, { Services: [{ Name: "Skin fade", PRICE: 28 }] }, deps);
  assert.deepEqual(out.seeded, { services: 1 });
  assert.match(inserts(calls)[0].sql, /INSERT INTO "services" \("name","price"\)/);
});

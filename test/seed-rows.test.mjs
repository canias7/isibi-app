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
import fs from "node:fs";
import assert from "node:assert/strict";
import { seedSiteRows, MAX_SEED_ROWS, normalizeSchema } from "../site-schema.mjs";

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

// ── DECLARED AS A PAIR ───────────────────────────────────────────────────────
//
// `display` is a PRESET over `{read: "public", write: "none"}`, and since the
// axes landed on 2026-08-10 a designer may write either. This function asked
// `t.access === "display"` — the preset name — so a pair-declared table fell
// through `normalizeSchema`'s allow-list to `collect` and was silently not
// seeded. Nothing can write to it afterwards, so that is an empty menu forever
// and a booking form with zero options in its Service select: the exact failure
// seeding exists to prevent, reintroduced from one file over.
//
// Driven through the REAL `normalizeSchema` rather than a hand-built spec,
// because the coercion IS the bug — a test that hands `seedSiteRows` a shape the
// pipeline never produces passes while the pipeline is broken.
test("a display table declared as a read/write pair is seeded", async () => {
  const spec = normalizeSchema({
    tables: [{ name: "services", read: "public", write: "none", columns: [{ name: "name" }, { name: "price" }] }],
  });
  assert.equal(spec.tables[0].access, "collect",
    "the premise: the allow-list coerces a pair-declared table's access, which is why the preset name cannot be the question");
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", spec, { services: [{ name: "Skin fade", price: 28 }] }, deps);
  assert.deepEqual(out.seeded, { services: 1 }, JSON.stringify(out.skipped));
  assert.equal(inserts(calls).length, 1);
});

test("a pair that is NOT display is still refused", async () => {
  // The marketplace cell — anyone reads, members write their own. Fabricating
  // rows there invents listings attributed to nobody, on somebody's real site.
  // This is the half that stops the fix above from broadening what gets made up.
  const spec = normalizeSchema({
    tables: [{ name: "listings", read: "public", write: "own", columns: [{ name: "title" }] }],
  });
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", spec, { listings: [{ title: "Invented" }] }, deps);
  assert.deepEqual(out.seeded, {});
  assert.equal(inserts(calls).length, 0);
  assert.ok(out.skipped.some((s) => /only display tables/.test(s)), JSON.stringify(out.skipped));
});

test("admin is deliberately still not seeded", async () => {
  // Also write-none, so "nobody can write to it" would have caught it. The rule
  // is the display PAIR and nothing wider: whether an admin table should carry
  // starter rows is a separate decision, and broadening this is the direction
  // with real cost. Pinned so a well-meaning widening has to be deliberate.
  const spec = normalizeSchema({ tables: [{ name: "staff", access: "admin", columns: [{ name: "name" }] }] });
  const { deps, calls } = db();
  const out = await seedSiteRows("conn", spec, { staff: [{ name: "Ada" }] }, deps);
  assert.deepEqual(out.seeded, {});
  assert.equal(inserts(calls).length, 0);
});

test("every preset behaves exactly as it did before the pair was asked", async () => {
  // The safety argument for the change, asserted rather than reasoned: the five
  // names resolve to the pairs they have always meant, so no site declared in
  // the old vocabulary can seed differently than it did yesterday.
  for (const [access, want] of [["display", 1], ["collect", 0], ["user", 0], ["feed", 0], ["admin", 0]]) {
    const spec = normalizeSchema({ tables: [{ name: "t", access, columns: [{ name: "name" }] }] });
    const { deps } = db();
    const out = await seedSiteRows("conn", spec, { t: [{ name: "x" }] }, deps);
    assert.equal(out.seeded.t || 0, want, access);
  }
});

test("the refusal names the pair, not a preset nobody wrote", async () => {
  // It printed `t.access`, so a pair-declared table was reported as "collect" —
  // a word absent from the declaration, sending whoever reads the build response
  // looking for something that is not there.
  const spec = normalizeSchema({
    tables: [{ name: "listings", read: "public", write: "own", columns: [{ name: "title" }] }],
  });
  const { deps } = db();
  const out = await seedSiteRows("conn", spec, { listings: [{ title: "x" }] }, deps);
  const msg = out.skipped.find((s) => /listings/.test(s)) || "";
  assert.match(msg, /read public \/ write own/, msg);
  assert.doesNotMatch(msg, /collect/, "naming a level the declaration never used is a false trail");
});

test("the build response carries WHY nothing was seeded", () => {
  // A DIAGNOSTIC WHOSE ABSENCE LOOKS EXACTLY LIKE GOOD NEWS, which is why it is
  // guarded at all. `skipped` existed only as a Cloudflare `console.log`, so a
  // build that published a site with an empty menu answered with `seeded: {}`
  // and nothing else — indistinguishable from a designer that simply wrote no
  // seed rows. Answering that about a real failing build cost a source audit,
  // because the site had already been deleted by the run that failed on it.
  // worker.js cannot be imported, so this is a source read.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /seedSkipped:\s*\(seeded && seeded\.skipped\.length\)/,
    "the build response must carry the skip reasons, not only the counts");
  // An empty list must be ABSENT rather than `[]`: every clean build's response
  // stays byte-identical to what it was before this field existed.
  assert.match(worker, /seedSkipped:[^\n]*:\s*undefined/,
    "nothing skipped means no field at all");
});

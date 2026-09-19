// THE APPLY'S COLUMN UNION, WHICH COULD NOT READ AN OBJECT COLUMN'S NAME
// (2026-09-19).
//
// FOUND BY DRIVING A COMPLETE CUSTOMER REQUEST — *"add a page at /how-busy
// showing how many bookings we have, and a function the page calls to count
// them"* — through `POST /api/site/<slug>/addon` on a site that already had a
// `bookings` table. The stored spec came back with SIX columns where the site
// has three: `["who","slot","phone",{name:"who"},{name:"slot"},{name:"phone"}]`,
// each one once as a bare name and once as an object. Nothing failed, nothing
// was logged, and every later designer reads that list.
//
// THE CAUSE IS ONE EXPRESSION. `applySiteSchema`'s late merge — the block whose
// own comment says *"a revise re-declaring a table with two of its six columns
// would otherwise shrink the list, and the four still sitting in Postgres would
// stop being readable with nothing to explain it"* — deduped on `String(c)`,
// which is `"[object object]"` for every object column.
//
// WHICH SHAPE SITS ON WHICH SIDE, measured rather than assumed, because it is
// what decides which failures are REACHABLE:
//
//   THIS RUN'S side is ALWAYS a list of bare names. `norm.push({…, columns:
//     colNames, …})` flattens, so whatever the tool declared, the merge sees
//     names. There is no path through this function that puts objects there.
//   THE STORED side is whatever last wrote `_meta.schema` — names when this
//     same code wrote it, and OBJECTS when `mergeAddonSchema`, the schema
//     recovery or an older apply did. Both shapes are permanent here: the doc
//     at the head of `site-schema.mjs` says so, and `mergeAddonSchema` reads
//     both on purpose.
//
// SO THE LIVE FAILURE IS THE MIXED ONE, and it is the one the route reproduced.
// Measured on the pre-fix expression, one re-declared column against three
// stored, `want 3`:
//
//     names ∪ names      -> 3    (correct — why this went unnoticed)
//     names ∪ objects    -> 4    (the live defect: every stored column re-added)
//     objects ∪ objects  -> 1    (the union DEAD — unreachable here, see above)
//     objects ∪ names    -> 4
//
// The reader handles all four, because the stored side is not ours to control
// and the two unreachable rows become reachable the day anything else writes
// that key. What this file can DRIVE is the two on the left of that list.
//
// WHY A WHOLE FILE. The merge needs a stored `_meta.schema` to merge AGAINST,
// which no existing `applySiteSchema` driver supplies — `managed-column-writes`
// answers no rows to every query, so `prevStored` is empty there and this block
// never runs at all. The seam is the same one that file uses; what is new is a
// stub that ANSWERS the `_meta` read.
import test from "node:test";
import assert from "node:assert/strict";
import { applySiteSchema } from "../site-schema.mjs";

/** A stored spec, in `_meta.schema`'s own shape. */
const stored = (columns) => ({ tables: [{ name: "bookings", access: "user", columns }] });
const obj = (name) => ({ name, type: "text" });
/** What this run declares — the tool's shape, which `norm.push` flattens. */
const declares = (names) => ({ tables: [{ name: "bookings", access: "user", columns: names.map(obj) }] });

/**
 * Run the real `applySiteSchema` against a site whose `_meta` already holds
 * `prev`, and hand back the `bookings` entry it WROTE there.
 *
 * `neon()` is HTTP, so `fetch` is the seam — the module takes no injectable
 * query, and an earlier probe elsewhere in this suite proved that passing a
 * fake one answers ZERO statements, which reads exactly like "the engine sent
 * nothing". The two floors below are what would catch that here.
 */
async function applyOver(prev, spec) {
  const statements = [];
  let written = null;
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "", params = [];
    try {
      const b = JSON.parse(String((init && init.body) || "{}"));
      q = b.query || ""; params = b.params || [];
    } catch { /* not ours */ }
    if (q) statements.push(String(q));
    // THE READ THE MERGE DEPENDS ON. Neon's driver wants ARRAYS plus a `fields`
    // list naming the columns — an object row makes it throw on `c.map`, which
    // is the recorded "a fixture in a different shape from reality" and is
    // already paid for once in this suite.
    if (/SELECT v FROM _meta/i.test(q)) {
      return new Response(JSON.stringify({
        command: "SELECT", rowCount: 1, rows: [[JSON.stringify(prev)]],
        fields: [{ name: "v", dataTypeID: 25 }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    // …AND THE WRITE, which is the answer this file is about.
    if (/INSERT INTO _meta/i.test(q)) { try { written = JSON.parse(params[0]); } catch { written = null; } }
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  try { await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  // THE OBSERVER IS ALIVE IN BOTH DIRECTIONS: the engine really ran, and it
  // really wrote the spec back. A null `written` would satisfy every "no
  // duplicate" assertion below perfectly.
  assert.ok(statements.length > 20, "the engine sent almost nothing — the fetch seam moved: " + statements.length);
  assert.ok(written && Array.isArray(written.tables), "nothing was written to _meta, so this case is asserting about nothing");
  return written.tables.find((t) => t && t.name === "bookings");
}

/** Every column's name, whichever shape it is in. */
const names = (t) => (t.columns || []).map((c) => String(typeof c === "string" ? c : ((c && c.name) || "")));

test("a stored spec whose columns are OBJECTS is not doubled — the reproduction", async () => {
  // THE LIVE DEFECT, reduced to the module. Through the route this is what a
  // `function` + `page` request did to a site with one existing table: three
  // columns in, six out.
  const t = await applyOver(stored([obj("who"), obj("slot"), obj("phone")]), declares(["who", "slot", "phone"]));
  assert.equal(names(t).length, 3, "the column list doubled: " + JSON.stringify(t.columns));
  assert.deepEqual(names(t).sort(), ["phone", "slot", "who"], JSON.stringify(t.columns));
});

test("…and the union still RESTORES what this run did not restate", async () => {
  // THE BLOCK'S WHOLE REASON FOR EXISTING, over the stored shape that used to
  // defeat it: one column re-declared, three kept. Before the fix this came
  // back with `slot` and `phone` present TWICE rather than absent — so the
  // customer's allow-list was wrong in the other direction, and a reader
  // counting columns got 5 for a three-column table.
  const t = await applyOver(stored([obj("who"), obj("slot"), obj("phone")]), declares(["who"]));
  assert.deepEqual(names(t).sort(), ["phone", "slot", "who"],
    "a re-declared table lost or doubled the columns it did not restate: " + JSON.stringify(t.columns));
});

test("CONTROL: a stored spec whose columns are NAMES behaves exactly as it did", async () => {
  // THE CASE THAT ALWAYS WORKED, and the reason the defect went unnoticed for
  // as long as it did — `String("who")` is `"who"`. It must go on working, or
  // the fix is a different behaviour rather than a correction. Green on BOTH
  // trees, which is what makes it a control.
  const t = await applyOver(stored(["who", "slot", "phone"]), declares(["who"]));
  assert.deepEqual(names(t).sort(), ["phone", "slot", "who"], JSON.stringify(t.columns));
});

test("a genuinely new column is still added, which is what makes the union a union", async () => {
  // A dedup tightened far enough to stop duplicating would also stop ADDING,
  // and "add a photo to the booking form" is the commonest real addon there
  // is — so without this, the fix could be "never append anything" and both
  // cases above would pass.
  const t = await applyOver(stored([obj("who"), obj("slot")]), declares(["who", "slot", "photo"]));
  assert.deepEqual(names(t).sort(), ["photo", "slot", "who"],
    "a new column was not kept: " + JSON.stringify(t.columns));
});

test("a stored entry with no readable name is skipped rather than restored", async () => {
  // A stored list can hold junk — an older writer, a hand edit, a spec that
  // came back through a store nobody controls — and appending one puts a
  // nameless entry into the DATA API's ALLOW-LIST, which is what this list is.
  // Found by a sweep: nothing anywhere drove a stored column whose name cannot
  // be read, so `!n ||` could be cut with every other case green.
  const t = await applyOver(stored([obj("who"), null, {}, 123, "", obj("slot")]), declares(["phone"]));
  assert.deepEqual(names(t).sort(), ["phone", "slot", "who"],
    "a nameless stored entry reached the allow-list: " + JSON.stringify(t.columns));
});

test("a stored list that names one column twice does not restore it twice", async () => {
  // `have` GAINS each name as it goes. Without that the set is fixed at the
  // start and a stored list carrying a duplicate appends it again on every
  // apply, growing for ever — and those lists exist on real sites, because the
  // old code is what wrote them.
  const t = await applyOver(stored(["who", "who", obj("slot")]), declares(["phone"]));
  assert.deepEqual(names(t).sort(), ["phone", "slot", "who"],
    "a duplicate in the STORED list was carried into the new one: " + JSON.stringify(t.columns));
});

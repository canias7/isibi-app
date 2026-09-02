// What the designer reached for and we do not have.
//
// WHY THIS EXISTS. `coerceTable` is an allow-list: a property nobody added to
// its output literal is dropped without a trace. That is a real protection — it
// is what stops a model inventing a guarantee the engine never keeps — and it
// also means the best available evidence about what this platform is MISSING
// has been discarded on every build ever made.
//
// The alternative has a number attached. Of the ~30 features the schema engine
// grew, ELEVEN ended up implemented and unreachable: round-robin lead routing,
// SLA escalation, on a platform that makes barber shops. Each was somebody
// reasoning about what businesses need. This turns the next such decision into
// a count of real reaches instead.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { droppedFields, TOOL_TABLE_FIELDS } from "../site-schema.mjs";
// THE ONE SHAPE OF A TABLE (2026-09-02): `design_schema`'s per-table item
// lives in builder/site-table.mjs now, shared with the ADD step, so the truth
// is IMPORTED rather than scraped out of worker.js — and the hop that puts it
// on the wire is asserted beside it.
import { TABLE_ITEM } from "../builder/site-table.mjs";

const col = [{ name: "slot", type: "text" }];
const one = (t) => droppedFields({ tables: [t] });

test("a reach for something we do not have is recorded", () => {
  assert.deepEqual(
    one({ name: "bookings", access: "collect", columns: col, capacity: 12, waitlist: true, buffer_minutes: 15 }),
    ["buffer_minutes", "capacity", "waitlist"],
    "the whole point of the feature");
});

test("a synonym the engine HONOURS is not a reach", () => {
  // `rowLimit` is one of `maxRows`'s aliases. The model asked for something and
  // got it, under a different name — reporting that as a missing capability is
  // how the real signal gets buried.
  assert.deepEqual(one({ name: "b", access: "collect", columns: col, rowLimit: 500 }), []);
  for (const alias of ["cap", "max_rows", "softDelete", "uniquePerUser", "optimisticLock"])
    assert.deepEqual(one({ name: "b", access: "collect", columns: col, [alias]: 5 }), [],
      "`" + alias + "` is honoured by the normaliser and must not report");
});

test("a field the tool DOES offer is never a reach, even when it changes nothing", () => {
  // THE FALSE POSITIVE THIS WAS BUILT AROUND. Behaviour alone says
  // `access: "collect"` was ignored — and it was, because collect is the
  // default — but the model asked for something real. Before this filter it
  // reported on every collect table on every site, which is most of them.
  assert.deepEqual(one({ name: "b", access: "collect", columns: col }), []);
  assert.deepEqual(one({ name: "b", access: "collect", columns: col, unique: [{ columns: ["slot"] }] }), []);
});

test("an explicitly-declared default is not a reach", () => {
  // `trash: false` cannot be told apart from `trash` being absent, so a
  // behavioural test alone would report it. Falsy values are skipped.
  assert.deepEqual(one({ name: "b", access: "collect", columns: col, trash: false, fts: false, maxRows: 0 }), []);
  // Same for empty containers — a declared-but-empty list asked for nothing.
  assert.deepEqual(one({ name: "b", access: "collect", columns: col, unusualThing: [], another: {} }), []);
});

test("values never leave the function — only names", () => {
  // A dropped field can carry text lifted straight out of a customer's brief. A
  // diagnostic that quietly logs business content is a worse problem than the
  // one it solves, so this is asserted rather than left to the caller.
  const out = one({
    name: "enquiries", access: "collect", columns: col,
    customerNote: "Mrs Patel, 07700 900123, wants the Tuesday slot",
    escalateTo: "owner@example.com",
  });
  assert.deepEqual(out, ["customerNote", "escalateTo"]);
  const asText = JSON.stringify(out);
  for (const secret of ["Patel", "07700", "example.com", "Tuesday"])
    assert.ok(!asText.includes(secret), "a value leaked into the report: " + secret);
});

test("it is bounded, and reads every table", () => {
  const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ["f" + String(i).padStart(2, "0"), true]));
  const out = droppedFields({ tables: [{ name: "a", access: "collect", columns: col, ...many }] });
  assert.ok(out.length > 0 && out.length <= 12, "unbounded or empty: " + out.length);
  // Across tables, not just the first — a reach on table three is the same
  // signal as one on table one.
  assert.deepEqual(droppedFields({ tables: [
    { name: "a", access: "display", columns: col },
    { name: "b", access: "collect", columns: col, capacity: 8 },
  ]}), ["capacity"]);
});

test("junk in cannot throw — this runs on every build", () => {
  for (const bad of [null, undefined, {}, { tables: null }, { tables: [null, 7, "x"] }, { tables: {} }])
    assert.deepEqual(droppedFields(bad), [], "threw or answered oddly on " + JSON.stringify(bad));
});

test("TOOL_TABLE_FIELDS matches the real tool, in BOTH directions", () => {
  // THE DRIFT THAT WOULD MATTER. A field added to `design_schema` and forgotten
  // here reports as a missing capability on every build that uses it — noise in
  // the one signal this feature exists to produce. A field removed from the
  // tool and left here hides a real reach. `worker.js` cannot be imported, so
  // the list lives in code and the truth is derived here.
  // THE ITEM IS IMPORTED, NOT SCRAPED (2026-09-02). This walked the literal
  // out of worker.js by text; the per-table shape is `TABLE_ITEM` in its own
  // module now, so the names are read off the real object — and the binding
  // that puts that object on the wire is asserted in the same breath, or a
  // module nobody sends would satisfy this.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const at = w.indexOf('name: "design_schema"');
  assert.ok(at > 0, "the design_schema tool is gone — retarget this test");
  const tablesAt = w.indexOf("tables: {", at);
  assert.ok(tablesAt > at, "the tool's `tables` property is gone — retarget this test");
  assert.match(w.slice(tablesAt, w.indexOf("},", w.indexOf("items:", tablesAt))), /items: TABLE_ITEM/,
    "the tool no longer binds TABLE_ITEM as its table item — the shape read below is not the one on the wire");
  const real = new Set(Object.keys(TABLE_ITEM.properties));
  assert.ok(real.size > 15, "read only " + real.size + " fields off the item — the shape is broken");
  assert.deepEqual([...real].sort(), [...TOOL_TABLE_FIELDS].sort(),
    "TOOL_TABLE_FIELDS and the design_schema tool disagree — one of them changed alone");
});

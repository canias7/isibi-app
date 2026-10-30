// TURNING A RULE OFF REACHES THE STORED SCHEMA (2026-10-22, audit A29-1).
//
// The rules step said "cleared sms" by writing `sms: null`, and the engine
// reads null as "not mentioned": both the fill before the DDL and the late
// `_meta` merge copied the stored text message, email and webhooks back, so
// the reply said "now off" and every booking kept sending. A removal is now
// said (`cleared: [...]`) and honoured by normalizeSchema, the fill, the
// merge and the held draft's merge; the marker itself is never stored.
// Everything runs against a stand-in database at the network.
//
// RE-ANCHORED 2026-10-29: the text message, the confirmation email and the
// webhooks are no longer prebuilt table features (the model writes them as
// site functions, fired by the row hooks), so the rules step has no `clear`
// and `CLEARED_FIELDS` is empty. What stays true is asserted here: the marker
// names nothing any more and is never stored, a silent re-declaration still
// keeps the stored rules, and a value given again wins over the stored one,
// through the engine, the fill and the held draft.
import test from "node:test";
import assert from "node:assert/strict";
import { applySiteSchema, normalizeSchema, fillFromStored, clearedList, CLEARED_FIELDS } from "../site-schema.mjs";
import { mergeRules } from "../builder/site-rules.mjs";
import { mergeSpec, combineHeld } from "../site-draft.mjs";

async function apply(spec, prior) {
  let stored = null, n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "", params = [];
    try { const b = JSON.parse(String((init && init.body) || "{}")); q = String(b.query || ""); params = Array.isArray(b.params) ? b.params : []; } catch { /* not ours */ }
    n++;
    const rows = (r, fields) => new Response(JSON.stringify({ command: "SELECT", rowCount: r.length, rows: r, fields: fields.map((name) => ({ name, dataTypeID: 25 })) }), { status: 200, headers: { "content-type": "application/json" } });
    if (/^SELECT v FROM _meta WHERE k\s*=\s*'schema'/i.test(q.trim())) return rows([[JSON.stringify(prior)]], ["v"]);
    if (/^INSERT INTO _meta \(k,v\) VALUES \('schema'/i.test(q.trim())) stored = JSON.parse(String(params[0]));
    return rows([], []);
  };
  try { await applySiteSchema("postgresql://u:p@ep-clr.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  assert.ok(n > 10, "the engine sent almost nothing — the fetch seam moved");
  assert.ok(stored, "the stored declaration was not written");
  return stored;
}
const PRIOR = { tables: [{ name: "bookings", access: "collect", columns: ["who", "email", "phone", "slot"], maxRows: 40, oncePerUser: true }] };

test("CLR 1 — the marker names nothing now and is never stored, through the real engine", async () => {
  assert.deepEqual([...CLEARED_FIELDS], [], "a clearable field came back");
  for (const gone of ["sms", "confirm", "webhooks", "payment", "maxRows"]) assert.equal(clearedList({ cleared: [gone] }), null, gone);
  const { applied } = mergeRules({ tables: PRIOR.tables }, [{ table: "bookings", clear: ["sms", "confirm", "webhooks"] }]);
  assert.deepEqual(applied, [], "a clear the rules step no longer has was applied");
  const t = (await apply(normalizeSchema({ tables: [{ ...PRIOR.tables[0], cleared: ["sms", "maxRows"] }] }), PRIOR)).tables.find((x) => x.name === "bookings");
  assert.ok(!Object.hasOwn(t, "cleared"), "the marker was stored");
  assert.equal(t.maxRows, 40, "a marker naming a field that cannot be cleared took it off");
  for (const gone of ["sms", "confirm", "webhooks", "payment"]) assert.equal(t[gone] ?? null, null, gone + " was stored for a table that declared none");
});

test("CLR 2 — control: a re-declaration that says nothing still keeps the stored rules; a rule given again wins", async () => {
  const silent = (await apply(normalizeSchema({ tables: [{ name: "bookings", access: "collect", columns: ["who"] }] }), PRIOR)).tables[0];
  assert.equal(silent.maxRows, 40); assert.equal(silent.oncePerUser, true);
  const { spec } = mergeRules({ tables: PRIOR.tables }, [{ table: "bookings", maxRows: 12 }]);
  const one = (await apply(normalizeSchema(spec), PRIOR)).tables[0];
  assert.equal(one.maxRows, 12, "the stored rule came back over the new one");
  assert.equal(one.oncePerUser, true, "changing one rule took another");
});

test("CLR 3 — the fill keeps what was stored where the table said nothing, and a value given again is not overwritten", () => {
  const t = fillFromStored({ name: "bookings", maxRows: null, oncePerUser: null, cleared: ["maxRows"] }, PRIOR.tables[0]);
  assert.equal(t.maxRows, 40, "a marker naming a field that cannot be cleared kept it off");
  assert.equal(t.oncePerUser, true);
  const u = fillFromStored({ name: "bookings", maxRows: 7 }, PRIOR.tables[0]);
  assert.equal(u.maxRows, 7);
});

test("CLR 4 — the held draft: a held marker still rides onto a later held re-declaration, and Publish neither stores it nor takes a stored rule off for it", async () => {
  const held1 = { tables: [{ ...PRIOR.tables[0], cleared: ["sms"] }] };
  const held2 = { tables: [{ name: "bookings", access: "collect", columns: ["who", "email", "phone", "slot", "note"] }] };
  const plan = combineHeld(PRIOR, [{ kind: "schema", spec: held1 }, { kind: "schema", spec: held2 }]).spec;
  const pt = plan.tables.find((x) => x.name === "bookings");
  assert.deepEqual(pt.cleared, ["sms"], "the later held op dropped the marker");
  const t = (await apply(normalizeSchema(plan), PRIOR)).tables[0];
  assert.ok(!Object.hasOwn(t, "cleared"), "Publish stored the marker");
  assert.equal(t.maxRows, 40, "Publish lost a stored rule");
  assert.equal(t.sms ?? null, null);
  const again = mergeSpec(held1, { tables: [{ name: "bookings", maxRows: 3 }] }).tables[0];
  assert.equal(again.maxRows, 3);
});

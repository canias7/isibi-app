// Audit A30-9: a re-applied booking table's overlap rule is replaced without a
// gap. The new constraint is added under its own name first; only once it
// stands is the old one dropped and the new renamed; a refused one leaves the
// old rule standing and is reported. A stand-in database answers at the network.
import test from "node:test";
import assert from "node:assert/strict";
import { applySiteSchema, normalizeSchema } from "../site-schema.mjs";

async function apply(spec, { refuse = null } = {}) {
  const statements = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "";
    try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { /* not ours */ }
    statements.push(q.trim());
    const rows = (r, fields) => new Response(JSON.stringify({ command: "SELECT", rowCount: r.length, rows: r, fields: fields.map((name) => ({ name, dataTypeID: 25 })) }), { status: 200, headers: { "content-type": "application/json" } });
    if (refuse && refuse.test(q)) return new Response(JSON.stringify({ message: "could not create exclusion constraint", detail: "Key conflicts with key.", code: "23P01", severity: "ERROR" }), { status: 400, headers: { "content-type": "application/json" } });
    return rows([], []);
  };
  let made = null;
  try { made = await applySiteSchema("postgresql://u:p@ep-ov.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  assert.ok(statements.length > 10, "the engine sent almost nothing — the fetch seam moved");
  return { made, statements };
}
const SPEC = normalizeSchema({ tables: [{ name: "bookings", access: "collect",
  columns: [{ name: "room", type: "text" }, { name: "start_min", type: "int" }, { name: "end_min", type: "int" }],
  noOverlap: { on: ["room"], start: "start_min", end: "end_min" } }] });
const ofRule = (st) => st.filter((q) => /^ALTER TABLE "bookings" (ADD|DROP|RENAME) CONSTRAINT/.test(q) && /ex_bookings_nooverlap/.test(q));

test("OV 1 — the new rule goes in under its own name, then the old is dropped and the new renamed", async () => {
  const { statements } = await apply(SPEC);
  const s = ofRule(statements);
  assert.deepEqual(s.map((q) => q.replace(/ EXCLUDE USING gist .*/, " EXCLUDE …")), [
    'ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "ex_bookings_nooverlap_new"',
    'ALTER TABLE "bookings" ADD CONSTRAINT "ex_bookings_nooverlap_new" EXCLUDE …',
    'ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "ex_bookings_nooverlap"',
    'ALTER TABLE "bookings" RENAME CONSTRAINT "ex_bookings_nooverlap_new" TO "ex_bookings_nooverlap"',
  ]);
});

test("OV 2 — a refused new rule drops nothing: the old guarantee stands, and the refusal is reported", async () => {
  const { made, statements } = await apply(SPEC, { refuse: /ADD CONSTRAINT "ex_bookings_nooverlap_new"/ });
  assert.ok(!ofRule(statements).some((q) => q === 'ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "ex_bookings_nooverlap"'), "the old rule was dropped though the new one was refused");
  assert.ok(!ofRule(statements).some((q) => /RENAME CONSTRAINT/.test(q)));
  assert.deepEqual(((made && made.refusedRules) || []).filter((x) => x.feature === "noOverlap").map((x) => x.table), ["bookings"]);
});

test("OV 3 — a failed swap after the new rule stands is reported, and the new rule is never dropped", async () => {
  const { made, statements } = await apply(SPEC, { refuse: /RENAME CONSTRAINT/ });
  const s = ofRule(statements);
  assert.equal(s.filter((q) => q === 'ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "ex_bookings_nooverlap_new"').length, 1, "the standing new rule was dropped after it went in");
  assert.ok(s.indexOf('ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "ex_bookings_nooverlap_new"') < s.findIndex((q) => /ADD CONSTRAINT/.test(q)));
  assert.deepEqual(((made && made.refusedRules) || []).filter((x) => x.feature === "noOverlap").map((x) => x.rule), ["replace"]);
});

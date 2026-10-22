// A CHANGED NO-DUPLICATES RULE REACHES THE DATABASE (2026-10-22, audit A29-3).
//
// The unique index was named by position (`ux_<table>_g_0`) and created with
// IF NOT EXISTS, and nothing ever dropped one: a changed rule reused the old
// name, Postgres skipped it, and the reply said changed. Now the name is a
// digest of what it guards, and once the new index is in, the platform's
// older indexes of that kind on that table are dropped; a refused index drops
// nothing and is reported. A stand-in database answers at the network.
import test from "node:test";
import assert from "node:assert/strict";
import { applySiteSchema, normalizeSchema, isPlatformUniqueName } from "../site-schema.mjs";
import { mergeRules } from "../builder/site-rules.mjs";

async function apply(spec, prior, { indexes = [], refuse = null } = {}) {
  const statements = [];
  let made = null;
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "";
    try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { /* not ours */ }
    statements.push(q.trim());
    const rows = (r, fields) => new Response(JSON.stringify({ command: "SELECT", rowCount: r.length, rows: r, fields: fields.map((name) => ({ name, dataTypeID: 25 })) }), { status: 200, headers: { "content-type": "application/json" } });
    if (refuse && refuse.test(q)) return new Response(JSON.stringify({ message: "could not create unique index", detail: "Key (slot_date, slot_time)=(x, y) is duplicated.", code: "23505", severity: "ERROR" }), { status: 400, headers: { "content-type": "application/json" } });
    if (/^SELECT v FROM _meta WHERE k\s*=\s*'schema'/i.test(q.trim())) return rows(prior ? [[JSON.stringify(prior)]] : [], ["v"]);
    if (/FROM pg_indexes/i.test(q)) return rows(indexes.map((n) => [n]), ["indexname"]);
    return rows([], []);
  };
  try { made = await applySiteSchema("postgresql://u:p@ep-ux.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  assert.ok(statements.length > 10, "the engine sent almost nothing — the fetch seam moved");
  return { made, statements };
}
const COLS = [{ name: "slot_date", type: "text" }, { name: "slot_time", type: "text" }, { name: "staff", type: "text" }, { name: "who", type: "text" }];
const PRIOR = { tables: [{ name: "bookings", access: "collect", columns: ["slot_date", "slot_time", "staff", "who"], unique: [["slot_date", "slot_time"]] }] };
const creates = (st) => st.filter((q) => /^CREATE UNIQUE INDEX IF NOT EXISTS "ux_bookings_g_/.test(q));
const drops = (st) => st.filter((q) => /^DROP INDEX/.test(q));

test("UX 1 — a widened rule creates an index under a new name, then drops the old one; the slug and owner indexes stay", async () => {
  const { spec, applied } = mergeRules({ tables: [{ ...PRIOR.tables[0], columns: COLS }] }, [{ table: "bookings", unique: [["slot_date", "slot_time", "staff"]] }]);
  assert.deepEqual(applied[0].fields, ["unique"]);
  const r = await apply(normalizeSchema(spec), PRIOR, { indexes: ["ux_bookings_g_0", "ux_bookings_slug", "bookings_pkey", "my_own_idx"] });
  const c = creates(r.statements);
  assert.equal(c.length, 1, "no unique index was created: " + JSON.stringify(c));
  assert.ok(/\("slot_date","slot_time","staff"\)/.test(c[0]));
  assert.ok(!/"ux_bookings_g_0"/.test(c[0]), "the new rule reused the old index name, so IF NOT EXISTS skips it");
  assert.deepEqual(drops(r.statements), ['DROP INDEX IF EXISTS "ux_bookings_g_0"']);
  assert.ok(r.statements.indexOf(c[0]) < r.statements.indexOf(drops(r.statements)[0]), "the old index went before the new one was in");
  assert.deepEqual(((r.made && r.made.refusedRules) || []).filter((x) => x.feature === "unique"), []);
});

test("UX 2 — a refused new index (existing duplicates) drops nothing and is reported", async () => {
  const { spec } = mergeRules({ tables: [{ ...PRIOR.tables[0], columns: COLS }] }, [{ table: "bookings", unique: [["slot_date", "staff"]] }]);
  const r = await apply(normalizeSchema(spec), PRIOR, { indexes: ["ux_bookings_g_0"], refuse: /^CREATE UNIQUE INDEX IF NOT EXISTS "ux_bookings_g_/ });
  assert.deepEqual(drops(r.statements), [], "the old rule was dropped though the new one was refused");
  assert.deepEqual(r.made.refusedRules.filter((x) => x.feature === "unique").map((x) => x.table), ["bookings"]);
});

test("UX 3 — control: an unchanged rule keeps its own index; the same name every apply", async () => {
  const a = await apply(normalizeSchema({ tables: [{ name: "bookings", access: "collect", columns: COLS, unique: [["slot_date", "slot_time"]] }] }), PRIOR);
  const name = creates(a.statements)[0].match(/"(ux_bookings_g_[^"]+)"/)[1];
  const b = await apply(normalizeSchema({ tables: [{ name: "bookings", access: "collect", columns: COLS, unique: [["slot_date", "slot_time"]] }] }), PRIOR, { indexes: [name] });
  assert.equal(creates(b.statements)[0].match(/"(ux_bookings_g_[^"]+)"/)[1], name);
  assert.deepEqual(drops(b.statements), []);
});

test("UX 4 — only the platform's own unique-group names match", () => {
  const head = "ux_bookings_g_";
  assert.ok(isPlatformUniqueName("ux_bookings_g_0", head));
  assert.ok(isPlatformUniqueName("ux_bookings_g_1a2b3c4", head));
  for (const n of ["ux_bookings_slug", "ux_bookings_ci_0", "ux_bookings_g_slug", "bookings_pkey", "ux_bookings_u_0"]) assert.ok(!isPlatformUniqueName(n, head), n);
});

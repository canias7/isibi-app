// A COLUMN THE DATABASE REFUSED IS NEVER OFFERED AS ONE THE SITE HAS (2026-10-07).
//
// Codex's review of the cleanup batch: *"keep rejected columns from being
// treated as available by later designers merely because they remain in
// stored schema."* The engine recorded a column it could not add (its ALTER
// refused) among the apply's refusals, and still wrote it into the stored
// declaration — which every later reader takes as the table's columns: the
// add-on's designers, the page writer, the data and rules steps. The same
// list (`colNames`) fed the column-scoped write grants, where one GRANT naming
// a column that does not exist fails whole and leaves the table unwritable.
//
// NOW, two halves of one rule — a column is the table's when the database has
// it:
//   - the engine takes a refused column out of what it treats as created, so
//     the grants, the public projection and the stored declaration never name
//     it, and the declaration's union never brings it back from an earlier copy;
//   - the designers' reader (`specForAddon`) and the data step cut each
//     declared table to the columns its catalog rows name (`liveDeclared`), so
//     a declaration an earlier apply left behind is not offered either.
//
// Everything here runs against stand-in databases at the network; nothing is
// a real model's answer.
import test from "node:test";
import assert from "node:assert/strict";
import { applySiteSchema } from "../site-schema.mjs";
import { liveDeclared } from "../site-schema-recover.mjs";
import { addon, writtenPage } from "./fixtures/addon-route.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { grantsFor, policiesFor } from "../site-rls.mjs";
import { splitPrivileges, readParens } from "../site-schema-recover.mjs";
import { DATA_TOOL } from "../builder/site-apply.mjs";

const lower = (cols) => (cols || []).map((c) => String(typeof c === "string" ? c : c && c.name).toLowerCase());

/** One apply through the real engine, its database answered at the network: `prior` stored, `refuse` the statements it refuses. */
async function apply(conn, spec, prior, refuse) {
  const statements = [];
  let stored = null;
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "", params = [];
    try { const b = JSON.parse(String((init && init.body) || "{}")); q = String(b.query || ""); params = Array.isArray(b.params) ? b.params : []; } catch { /* not ours */ }
    statements.push(q);
    const rows = (r, fields) => new Response(JSON.stringify({ command: "SELECT", rowCount: r.length, rows: r, fields: fields.map((name) => ({ name, dataTypeID: 25 })) }), { status: 200, headers: { "content-type": "application/json" } });
    if (refuse && refuse.test(q)) return new Response(JSON.stringify({ message: "column refused", code: "XX000", severity: "ERROR" }), { status: 400, headers: { "content-type": "application/json" } });
    if (/^SELECT v FROM _meta WHERE k\s*=\s*'schema'/i.test(q.trim())) return rows(prior ? [[JSON.stringify(prior)]] : [], ["v"]);
    if (/^INSERT INTO _meta \(k,v\) VALUES \('schema'/i.test(q.trim())) stored = JSON.parse(String(params[0]));
    return rows([], []);
  };
  let made = null;
  try { made = await applySiteSchema(conn, spec); }
  finally { globalThis.fetch = real; }
  assert.ok(statements.length > 10, "the engine sent almost nothing — the fetch seam moved");
  return { made, statements, stored };
}
const grantsOn = (statements, table) => statements.filter((q) => new RegExp('^GRANT [A-Z, ]+\\(.*\\) ON "' + table + '"').test(q));

test("COL 1 — THE ENGINE: a column whose ALTER is refused is recorded, and never granted, projected or declared — not even from the copy an earlier apply stored with it; the columns beside it are, and a column that goes in still is", async () => {
  const SPEC = { tables: [{ name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }, { name: "slot", type: "text" }, { name: "note", type: "text", max: 40 }] }] };
  // AN EARLIER COPY STILL DECLARING IT — what an apply before this fix stored.
  const PRIOR = { tables: [{ name: "bookings", access: "collect", columns: ["who", "slot", "note"] }] };
  const r = await apply("postgresql://u:p@ep-col1.eu-central-1.aws.neon.tech/db?sslmode=require", SPEC, PRIOR, /^ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "note"/);
  assert.deepEqual(((r.made && r.made.refusedRules) || []).filter((x) => x.feature === "column").map((x) => [x.table, x.rule]), [["bookings", "note"]]);
  const grants = grantsOn(r.statements, "bookings");
  assert.ok(grants.length >= 1, "no column-scoped grant was sent — the observer is dead");
  for (const g of grants) {
    assert.ok(!/"note"/.test(g), "a grant named the column the database refused, so the whole grant would fail: " + g);
    assert.ok(/"who"/.test(g) && /"slot"/.test(g), "a grant lost a column that went in: " + g);
  }
  assert.ok(r.stored, "the stored declaration was not written");
  const t = r.stored.tables.find((x) => x.name === "bookings");
  assert.deepEqual(lower(t.columns), ["who", "slot"], "the stored declaration offers the refused column: " + JSON.stringify(t.columns));
  assert.ok(!Object.keys(t.rules || {}).includes("note"), "the stored declaration keeps a rule for the refused column: " + JSON.stringify(t.rules));
  // CONTROL: nothing refused — the column is granted and declared.
  const ok = await apply("postgresql://u:p@ep-col1b.eu-central-1.aws.neon.tech/db?sslmode=require", SPEC, PRIOR, null);
  assert.ok(grantsOn(ok.statements, "bookings").every((g) => /"note"/.test(g)) && grantsOn(ok.statements, "bookings").length >= 1);
  assert.deepEqual(lower(ok.stored.tables.find((x) => x.name === "bookings").columns), ["who", "slot", "note"]);
  assert.deepEqual(ok.stored.tables.find((x) => x.name === "bookings").rules.note, { max: 40 }, "control: the column's rule was not kept");
  // A COLUMN THE EARLIER COPY HAD AND THIS APPLY DID NOT ASK FOR stays declared: absent is unchanged.
  const kept = await apply("postgresql://u:p@ep-col1c.eu-central-1.aws.neon.tech/db?sslmode=require", { tables: [{ name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] }] }, PRIOR, null);
  assert.deepEqual(lower(kept.stored.tables.find((x) => x.name === "bookings").columns), ["who", "slot", "note"]);
});

test("COL 2 — THE READER: each declared table the catalog has is cut to the columns its rows name, with what is kept per column cut alike; a table the catalog lacks is left as declared; nothing to cut hands back the same spec", () => {
  const spec = {
    tables: [
      { name: "Dishes", access: "display", columns: ["name", { name: "price", type: "numeric" }, { name: "Allergen_Notes", type: "text" }],
        refs: { allergen_notes: "allergens", name: "x" }, rules: { allergen_notes: { max: 10 }, price: { numMin: 0 } }, num: ["price"], json: ["allergen_notes"] },
      { name: "orders", access: "collect", columns: ["email"] },
    ],
    functions: [{ name: "f" }],
  };
  const before = JSON.stringify(spec);
  const catalog = [{ t: "dishes", c: "id", ty: "integer" }, { t: "dishes", c: "NAME", ty: "text" }, { t: "dishes", c: "price", ty: "numeric" }, { t: "dishes", c: "created_at", ty: "text" }];
  const out = liveDeclared(spec, catalog);
  assert.deepEqual(out.missing, [{ table: "Dishes", column: "Allergen_Notes" }]);
  const d = out.spec.tables[0];
  assert.deepEqual(lower(d.columns), ["name", "price"], "a column the table does not have was offered");
  assert.deepEqual(d.refs, { name: "x" });
  assert.deepEqual(d.rules, { price: { numMin: 0 } });
  assert.deepEqual([d.num, d.json], [["price"], []]);
  // THE CATALOG NEVER ADDS: `id` and `created_at` are the engine's, not declarations.
  assert.equal(d.columns.length, 2);
  assert.equal(out.spec.tables[1], spec.tables[1], "a table the catalog does not have was changed");
  assert.deepEqual(out.spec.functions, spec.functions);
  assert.equal(JSON.stringify(spec), before, "the stored spec was changed in place");
  // NOTHING TO CUT: the same object back.
  const whole = liveDeclared(spec, [...catalog, { t: "Dishes", c: "allergen_notes", ty: "text" }]);
  assert.equal(whole.spec, spec);
  assert.deepEqual(whole.missing, []);
  // CANNOT TELL: no catalog, a catalog that is not a list, rows not rows — nothing cut.
  for (const c of [[], null, "x", [{ t: 3, c: "name" }, null]]) assert.equal(liveDeclared(spec, c).spec, spec, JSON.stringify(c));
  assert.deepEqual(liveDeclared(null, catalog), { spec: null, missing: [] });
});

test("COL 3 — THE ADD-ON'S DESIGNERS: a column the stored schema declares and the table does not have is in none of their requests; with the column in the table, it is", async () => {
  const stored = { tables: [{ name: "dishes", access: "display", columns: [{ name: "name", type: "text" }, { name: "allergen_notes", type: "text" }] }] };
  const run = (slug, has) => addon(slug, "Add a gallery page", {
    kinds: ["page"], publishes: true, stored, written: [writtenPage("/gallery")],
    catalog: { columns: [{ t: "dishes", c: "id", ty: "integer" }, { t: "dishes", c: "name", ty: "text" }, ...(has ? [{ t: "dishes", c: "allergen_notes", ty: "text" }] : [])] },
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "photos", sections: ["a band"], components: ["section-header"] }] } },
  });
  const lacking = await run("col3-lacking", false);
  assert.equal(lacking.body.ok, true, JSON.stringify(lacking.body).slice(0, 400));
  assert.ok(lacking.prompts.length >= 1, "no designer was asked — the observer is dead");
  assert.ok(lacking.prompts.some((p) => /dishes/.test(p.text)), "the designers were not told the site's tables at all");
  assert.ok(!lacking.prompts.some((p) => /allergen_notes/.test(p.text)), "a designer was offered a column the table does not have");
  const having = await run("col3-having", true);
  assert.equal(having.body.ok, true);
  assert.ok(having.prompts.some((p) => /allergen_notes/.test(p.text)), "control: a column the table has was not offered");
});

// AN ADDITION THAT MAKES A TABLE AND A PAGE (the follow-up pass, 2026-10-07):
// the page writer and its lint run before the apply, on the designers' cut
// spec; the stored copy read back after the apply still carries the earlier
// declaration (`r.meta()`), and is read only for the reply's connections.
test("COL 3c — AN ADDITION THAT MAKES A TABLE: the page writer, which writes before the apply, is never offered a column an earlier apply left declared that the table does not have — though the stored copy after the apply still declares it; the table this addition makes is offered; with the column in the table, it is", async () => {
  const stored = { tables: [{ name: "dishes", access: "display", columns: [{ name: "name", type: "text" }, { name: "allergen_notes", type: "text" }] }] };
  const run = (slug, has) => addon(slug, "Add a sign-up page where people leave their name and email address", {
    kinds: ["table", "page"], publishes: true, stored, written: [writtenPage("/sign-up")],
    catalog: { columns: [{ t: "dishes", c: "id", ty: "integer" }, { t: "dishes", c: "name", ty: "text" }, ...(has ? [{ t: "dishes", c: "allergen_notes", ty: "text" }] : [])] },
    answers: {
      table: { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "full_name", type: "text" }, { name: "email", type: "text" }] }, seed: [] }] },
      page: { page: [{ path: "/sign-up", name: "Sign up", purpose: "leave a name and email", sections: ["a form"], components: ["section-header"] }] },
    },
  });
  const writer = (r) => r.prompts.filter((p) => p.tool === "write_pages");
  const lacking = await run("col3c-lacking", false);
  assert.equal(lacking.body.ok, true, JSON.stringify(lacking.body).slice(0, 400));
  assert.ok(lacking.sql.some((q) => /CREATE TABLE IF NOT EXISTS "signups"/i.test(q)), "the apply never ran — the read after it is not reached");
  assert.ok(writer(lacking).length >= 1, "the page writer was not asked — the observer is dead");
  assert.ok(writer(lacking).some((p) => /full_name/.test(p.text)), "the page writer was not told the table this addition made");
  assert.ok(!writer(lacking).some((p) => /allergen_notes/.test(p.text)), "the page writer was offered a column the table does not have");
  const after = (lacking.meta() || {}).tables || [];
  assert.ok(after.some((t) => t.name === "dishes" && (t.columns || []).some((c) => (typeof c === "string" ? c : c && c.name) === "allergen_notes")), "the stored copy no longer declares the earlier column — the case no longer shows what it says");
  const having = await run("col3c-having", true);
  assert.equal(having.body.ok, true, JSON.stringify(having.body).slice(0, 400));
  assert.ok(writer(having).some((p) => /allergen_notes/.test(p.text)), "control: a column the table has was not offered to the page writer");
});

/** The catalog rows for one `collect` table, from the real emitters — a table the stored schema forgot and the reader recovers. */
function catalogFor(name, cols) {
  const t = { name, access: "collect", columns: cols.map((c) => ({ name: c, type: "text" })) };
  const columns = [{ t: name, c: "id", ty: "integer" }, { t: name, c: "created_at", ty: "text" }, ...cols.map((c) => ({ t: name, c, ty: "text" }))];
  const grants = [], policies = [];
  for (const stmt of grantsFor(t, cols)) {
    const m = /^GRANT\s+([\s\S]+?)\s+ON\s+"([^"]+)"\s+TO\s+(\w+)/i.exec(stmt);
    if (!m) continue;
    for (const { verb, cols: c } of splitPrivileges(m[1])) {
      if (c) for (const one of c) grants.push({ t: m[2], g: m[3], p: verb, lvl: "column", col: one });
      else grants.push({ t: m[2], g: m[3], p: verb, lvl: "table", col: "" });
    }
  }
  for (const stmt of policiesFor(t)) {
    const q = String(stmt);
    const m = /CREATE POLICY\s+\S+\s+ON\s+"([^"]+)"\s+FOR\s+(\w+)/i.exec(q);
    if (!m) continue;
    const u = /\bUSING\s*\(/i.exec(q), c = /\bWITH\s+CHECK\s*\(/i.exec(q);
    policies.push({ t: m[1], c: m[2].toUpperCase(), q: u ? readParens(q, u.index + u[0].length - 1) : "", w: c ? readParens(q, c.index + c[0].length - 1) : "" });
  }
  return { columns, grants, policies, triggers: [] };
}

test("COL 3b — THE SAME WHEN THE READER RECOVERS A TABLE THE STORED SCHEMA FORGOT: the recovered table is offered, and the declared column the table does not have is still not", async () => {
  const stored = { tables: [{ name: "dishes", access: "display", columns: [{ name: "name", type: "text" }, { name: "allergen_notes", type: "text" }] }] };
  const catalog = catalogFor("bookings", ["customer_name", "drop_off_day"]);
  catalog.columns.push({ t: "dishes", c: "id", ty: "integer" }, { t: "dishes", c: "name", ty: "text" });
  const r = await addon("col3b-recover", "Add a gallery page", {
    kinds: ["page"], publishes: true, stored, catalog, written: [writtenPage("/gallery")],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "photos", sections: ["a band"], components: ["section-header"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.prompts.some((p) => /drop_off_day/.test(p.text)), "the recovered table did not reach the designers — the reader did not take its recovery branch");
  assert.ok(!r.prompts.some((p) => /allergen_notes/.test(p.text)), "a designer was offered a column the table does not have, beside a recovered table");
});

// ── THE DATA STEP ───────────────────────────────────────────────────────────
const USER = { id: "u-rejected-columns-1", email: "owner@example.com" };
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('" + route + "')({ component: Page })\nfunction Page(){ return <main>" + body + "</main> }\n";
function bucket(slug) {
  const store = new Map([["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: page("/", "<h1>Fold Lane</h1>") }])], ["source/" + slug + "/parts.json", "[]"], [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fold Lane", theme: "broadsheet" }, css: "" })]]);
  return {
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); }, async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; }, async head(k) { return store.has(k) ? { key: k } : null; },
  };
}
/** One data edit through the real route over `db`; what the data model was sent comes back as `asked`. */
async function dataEdit(slug, db) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_credits")) { let want = 0; try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; } return json(want); }
    if (url.includes("/rest/v1/")) {
      if (method !== "GET") return json([]);
      if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "site_" + slug.replace(/-/g, "_") }]);
      if (url.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_conn: PROJECT_CONN }]);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(url)) {
      let body = {};
      try { body = JSON.parse(String((init && init.body) || "{}")); } catch { body = {}; }
      return db.answer(String(body.query || ""), Array.isArray(body.params) ? body.params : []) || json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    }
    if (url.includes("/v1/messages")) {
      asked.push(String((init && init.body) || ""));
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: DATA_TOOL.name, input: { changes: [] } }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer some-token" },
      body: JSON.stringify({ instruction: "Make the Dark Rye 5.60", layer: "data", page: "", remove: false, rename: "", tab: false, picker: "sonnet" }),
    }), { SITES_BUCKET: bucket(slug), ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key" }, makeCtx());
    const text = await res.text();
    let reply = null;
    try { reply = JSON.parse(text); } catch { reply = null; }
    return { status: res.status, asked, reply };
  } finally { globalThis.fetch = real; }
}

test("COL 4 — THE DATA STEP: the data model is never shown a column the list's table does not have, however the stored schema declares it; with the column in the table, it is", async () => {
  const SPEC = { tables: [{ name: "loaves", access: "display", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }, { name: "allergen_notes", type: "text" }] }] };
  const lacking = await dataEdit("col4-lacking", rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES } }, meta: { schema: JSON.stringify(SPEC) } }));
  assert.equal(lacking.asked.length, 1, "the data model was not asked exactly once — the observer is dead");
  assert.ok(/Dark Rye/.test(lacking.asked[0]), "the data model was not shown the list");
  assert.ok(!/allergen_notes/.test(lacking.asked[0]), "the data model was offered a column the table does not have");
  const having = await dataEdit("col4-having", rowsDb({ tables: { loaves: { columns: [...LOAF_COLUMNS, { name: "allergen_notes", type: "text" }], rows: BAKERY_LOAVES } }, meta: { schema: JSON.stringify(SPEC) } }));
  assert.equal(having.asked.length, 1);
  assert.ok(/allergen_notes/.test(having.asked[0]), "control: a column the table has was not shown");
});

test("COL 4b — THE DATA STEP WITH A CATALOG IT CANNOT READ: it stops at no cost rather than offer the stored declaration's columns unchecked", async () => {
  const SPEC = { tables: [{ name: "loaves", access: "display", columns: [{ name: "name", type: "text" }, { name: "price", type: "numeric" }, { name: "allergen_notes", type: "text" }] }] };
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES } }, meta: { schema: JSON.stringify(SPEC) } });
  const answer = db.answer.bind(db);
  db.answer = (q, params) => (/information_schema\.columns/i.test(q) ? new Response(JSON.stringify({ message: "canceling statement due to statement timeout" }), { status: 500, headers: { "content-type": "application/json" } }) : answer(q, params));
  const r = await dataEdit("col4b-unread", db);
  assert.equal(r.asked.length, 0, "the data model was asked with columns nothing could check");
  assert.ok(r.reply && r.reply.ok !== true, "an edit with an unreadable catalog was told as done: " + JSON.stringify(r.reply));
  assert.ok(!r.reply.cost, "a stop before the model was charged: " + JSON.stringify(r.reply));
});

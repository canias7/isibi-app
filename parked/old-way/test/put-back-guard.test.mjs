// PARKED (2026-11-03, park-old-way): the old-way half of test/put-back-guard.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// WHAT THE PAGE OFFERS TO PUT BACK, AGAINST THE TABLE AS IT IS NOW (2026-10-07).
//
// Codex's review of the cleanup batch: *"make late undo eligibility respect
// newer server-side work from another tab or device."* The page's undo offer
// (`siteUndoKeep`) is the rows the latest data edit took away; the next data
// message carries them (`recent`) and the data model is told they "are no
// longer in the tables above" (`recentBlock`). The offer can be older than the
// table — another tab's "put that back", the Data panel, another device, a
// restored copy — and none of those is this page's to see. So the server
// checks each offered row against the table as it reads it for the step
// (`freshRecent`): still gone, it is handed on; back under its own id, or
// under a new one with the same values, it is set aside; a table it cannot
// read whole cannot show a row gone, and its rows are set aside too.
//
// The route cases drive the real edit route (`POST /api/site/<slug>/edit`,
// layer `data`) against a database stand-in that remembers (`rows-db.mjs`).
// The data model's answers are SUPPLIED: what is shown is what the route hands
// the model and does with an answer, never how a real model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { DATA_TOOL, freshRecent, recentBlock, MAX_DATA_ROWS, PUT_BACK_READ_MAX, RECENT_VALUE_MAX } from "../../../builder/site-apply.mjs";

const COLS = ["name", "description", "price", "photo"];
const TABLE = (rows) => [{ name: "loaves", columns: COLS, rows }];
const RYE = BAKERY_LOAVES[1];
/** The page's offer for a row it took away: the row as the route read it, every column. */
const offer = (row) => ({ table: "loaves", was: { ...row } });
const SOURDOUGH = { id: 7, name: "Sourdough", description: "A long cold proof, a dark blistered crust.", price: 5.5, photo: null, created_at: "2026-08-22 08:00:00" };

// ── THROUGH THE ROUTE ───────────────────────────────────────────────────────
const USER = { id: "u-put-back-1", email: "owner@example.com" };
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const SPEC = { tables: [{ name: "loaves", access: "display", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }] }] };
const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
function bucket(slug) {
  const store = new Map();
  store.set("source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: page("/", "<h1>Fold Lane</h1>") }]));
  store.set("source/" + slug + "/parts.json", "[]");
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fold Lane", theme: "broadsheet" }, css: "" }));
  return {
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** One data edit through the real route, the page's offer in `recent`; the data model answers `answer` and its requests are kept. */
async function dataEdit(slug, instruction, recent, answer, db) {
  const worker = await loadWorker();
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return json(want);
    }
    if (url.includes("/rest/v1/")) {
      if (method !== "GET") return json([]);
      if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "site_" + slug.replace(/-/g, "_") }]);
      if (url.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_conn: PROJECT_CONN }]);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(url)) {
      let body = {};
      try { body = JSON.parse(String((init && init.body) || "{}")); } catch { body = {}; }
      const own = db.answer(String(body.query || ""), Array.isArray(body.params) ? body.params : []);
      return own || json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    }
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = (body.tool_choice && body.tool_choice.name) || "";
      if (tool !== DATA_TOOL.name) return new Response("no stub for tool " + tool, { status: 503 });
      asked.push(body);
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: DATA_TOOL.name, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer some-token" },
      body: JSON.stringify({ instruction, layer: "data", page: "", remove: false, rename: "", tab: false, picker: "sonnet", ...(recent ? { recent } : {}) }),
    }), { SITES_BUCKET: bucket(slug), ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key" }, makeCtx());
    const text = await res.text();
    let reply = null;
    try { reply = JSON.parse(text); } catch { reply = null; }
    return { status: res.status, reply, text, asked };
  } finally {
    globalThis.fetch = real;
  }
}
/** Everything the data model was shown, as one string. */
const shown = (r) => r.asked.map((b) => JSON.stringify(b.messages || [])).join("\n");
const longReads = (db) => db.log().filter((e) => new RegExp("ORDER BY id LIMIT " + PUT_BACK_READ_MAX + "\\s*$").test(e.query)).length;
const values = (row) => ({ name: row.name, description: row.description, price: row.price, photo: row.photo });

test("PUT 3 — THROUGH THE ROUTE: of two rows the page offers back, the one another tab already put back under a new id is never shown to the data model, the one still gone is — and put back once; no table filled its read, so no longer read is made", async () => {
  // THE TABLE NOW: Dark Rye was taken off (id 2) and put back elsewhere as id 8.
  const now = [...BAKERY_LOAVES.filter((r) => r.id !== 2), { ...RYE, id: 8, created_at: "2026-10-07 09:00:00" }];
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: now, next: 9 } }, meta: { schema: JSON.stringify(SPEC) } });
  const r = await dataEdit("pbg-two", "Put the sourdough back.", [offer(RYE), offer(SOURDOUGH)], { changes: [{ table: "loaves", values: values(SOURDOUGH) }] }, db);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.asked.length, 1, "the data model was not asked once");
  const content = shown(r);
  assert.ok(content.includes(JSON.stringify(recentBlock([offer(SOURDOUGH)])).slice(1, -1)), "the row still gone was not shown as the one to put back, alone");
  assert.ok(!content.includes(JSON.stringify(recentBlock([offer(RYE)])).slice(1, -1)), "the row already back was shown as gone");
  // PUT BACK ONCE, AND NOTHING TWICE.
  const after = db.rows("loaves");
  assert.equal(after.filter((x) => x.name === "Sourdough").length, 1, "the row still gone was not put back once");
  assert.equal(after.filter((x) => x.name === "Dark Rye").length, 1, "the row already back was put back again");
  assert.equal(longReads(db), 0, "a table under the step's read was read again");
  // THE CONTROL: offered nothing, nothing is shown as gone.
  const db2 = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: now, next: 9 } }, meta: { schema: JSON.stringify(SPEC) } });
  const r2 = await dataEdit("pbg-none", "Make the Country White £5.", null, { changes: [{ table: "loaves", id: 1, values: { price: 5 } }] }, db2);
  assert.equal(r2.status, 200, r2.text.slice(0, 300));
  assert.ok(!/JUST REMOVED/.test(shown(r2)), "a request offering nothing was shown rows as gone");
});

test("PUT 4 — THROUGH THE ROUTE, A TABLE THAT FILLS THE STEP'S READ: the row put back elsewhere past that read is found by one longer read and set aside; a row still gone in the same table is shown; the longer read is made only because a row was offered", async () => {
  const many = Array.from({ length: MAX_DATA_ROWS + 5 }, (_, i) => ({ id: i + 1, name: "Loaf " + (i + 1), description: null, price: 4, photo: null, created_at: "2026-08-21 23:06:22" }));
  const rye = { id: 3, name: "Rye", description: "Dense.", price: 5.2, photo: null, created_at: "2026-08-21 23:06:22" };
  const spelt = { id: 4, name: "Spelt", description: "Nutty.", price: 6, photo: null, created_at: "2026-08-21 23:06:22" };
  // Rye and Spelt were taken off; Rye was put back elsewhere, past the step's read.
  const now = [...many.filter((r) => r.id !== 3 && r.id !== 4), { ...rye, id: 200, created_at: "2026-10-07 09:00:00" }];
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: now, next: 201 } }, meta: { schema: JSON.stringify(SPEC) } });
  const r = await dataEdit("pbg-many", "Put the spelt back.", [offer(rye), offer(spelt)], { changes: [{ table: "loaves", values: values(spelt) }] }, db);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  const content = shown(r);
  assert.ok(!/\bid 200:/.test(content), "the row put back elsewhere was within the step's read — the case proves nothing");
  assert.ok(content.includes(JSON.stringify(recentBlock([offer(spelt)])).slice(1, -1)), "the row still gone was not shown alone as the one to put back");
  assert.equal(longReads(db), 1, "the table that filled the step's read was not read once more, longer");
  assert.equal(db.rows("loaves").filter((x) => x.name === "Rye").length, 1, "the row put back elsewhere was put back again");
  // AN OFFER NAMING ONLY A TABLE THE STEP DID NOT READ: nothing to settle, no longer read.
  const db3 = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: now, next: 201 } }, meta: { schema: JSON.stringify(SPEC) } });
  const r3 = await dataEdit("pbg-many-other", "Make Loaf 1 £5.", [{ table: "cakes", was: { id: 1, name: "Lemon drizzle" } }], { changes: [{ table: "loaves", id: 1, values: { price: 5 } }] }, db3);
  assert.equal(r3.status, 200, r3.text.slice(0, 300));
  assert.equal(longReads(db3), 0, "a table no offered row names was read again");
  assert.ok(!/JUST REMOVED/.test(shown(r3)), "a row from a table the step never read was shown as gone");
  // THE SAME TABLE, NOTHING OFFERED: no longer read.
  const db2 = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: now, next: 201 } }, meta: { schema: JSON.stringify(SPEC) } });
  const r2 = await dataEdit("pbg-many-none", "Make Loaf 1 £5.", null, { changes: [{ table: "loaves", id: 1, values: { price: 5 } }] }, db2);
  assert.equal(r2.status, 200, r2.text.slice(0, 300));
  assert.equal(longReads(db2), 0, "a request offering nothing read the table again");
});

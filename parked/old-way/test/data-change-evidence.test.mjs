// PARKED (2026-11-03, park-old-way): the old-way half of test/data-change-evidence.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// WHAT A DATA EDIT REALLY CHANGED, FROM AND TO (2026-10-07).
//
// The owner: *"give the reply writer enough evidence to identify the actual
// data changes, including the relevant item, field and permitted before/after
// values … use existing validation and execution evidence, without pretending
// model judgment proves the published result or exposing sensitive values."*
// The data step's answer carried a table, a row id and the column names, so
// the reply could say "Updated one entry in loaves" and nothing about which
// loaf, which field, or what it became.
//
//   EVIDENCE   the before side is the row as the route read it; the after side
//              is the row the database handed back (`RETURNING`); a value no
//              row confirmed is said as written, never as read.
//   NOT MADE   a write that matched no row — the row gone since it was read —
//              is not counted as a change, and nothing claims it.
//   WHOLE      a value past the reply's bound is cut there with "…", and the
//              row keeps every character.
//
// EVERY ROUTE CASE DRIVES THE REAL EDIT ROUTE (`POST /api/site/<slug>/edit`,
// layer `data`) against a database stand-in that remembers (`rows-db.mjs`).
// The picker's answers are SUPPLIED: what is shown is what the route does with
// an answer, never how a real model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { DATA_TOOL, dataChanges, runDataEdit, MAX_CHANGE_VALUE } from "../../../builder/site-apply.mjs";
import { editReplyFacts, replyOutcomeOf } from "../../../builder/site-reply.mjs";

const USER = { id: "u-data-evidence-1", email: "owner@example.com" };
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const TOOL = DATA_TOOL.name;
const SPEC = {
  tables: [
    { name: "loaves", access: "display", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }] },
    { name: "orders", access: "collect", columns: [{ name: "email", type: "text" }] },
  ],
};
const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";

function bucket(slug) {
  const store = new Map();
  store.set("source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: page("/", "<h1>Fold Lane</h1>") }]));
  store.set("source/" + slug + "/parts.json", "[]");
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fold Lane", theme: "broadsheet" }, css: "" }));
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const loaves = (rows = BAKERY_LOAVES) => ({ loaves: { columns: LOAF_COLUMNS, rows } });

/** One data edit through the real route, against `db`. `answer` is the picker's tool input. */
async function dataEdit(slug, instruction, answer, db) {
  const worker = await loadWorker();
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
      if (tool !== TOOL) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: TOOL, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer some-token" },
      body: JSON.stringify({ instruction, layer: "data", page: "", remove: false, rename: "", tab: false, picker: "sonnet" }),
    }), { SITES_BUCKET: bucket(slug), ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key" }, makeCtx());
    const text = await res.text();
    let reply = null;
    try { reply = JSON.parse(text); } catch { reply = null; }
    return { status: res.status, reply, text };
  } finally {
    globalThis.fetch = real;
  }
}

const factsOf = (body) => (editReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);
const same = (a, b) => String(a) === String(b);

test("DATA 3 — THROUGH THE ROUTE: one price changed — the answer names the loaf, the field, its value before and after as the database kept it; the row really changed; the reply's facts say it, and the old shape of `applied` stands beside it", async () => {
  const db = rowsDb({ tables: loaves(), meta: { schema: JSON.stringify(SPEC) } });
  const r = await dataEdit("dce-one", "Make the Dark Rye £5.60.", { changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] }, db);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.reply.ok, true);
  assert.deepEqual(r.reply.applied, [{ table: "loaves", id: 2, columns: ["price"] }], "the answer's old shape moved");
  assert.equal(r.reply.changes.length, 1, JSON.stringify(r.reply.changes));
  const c = r.reply.changes[0];
  assert.deepEqual([c.table, c.id, c.label], ["loaves", 2, "Dark Rye"]);
  assert.equal(c.fields.length, 1);
  assert.equal(c.fields[0].column, "price");
  assert.ok(same(c.fields[0].was, 5.2) && same(c.fields[0].now, 5.6), JSON.stringify(c.fields[0]));
  assert.equal(c.fields[0].readBack, undefined, "a value the database handed back was marked as unread");
  assert.ok(same(db.rows("loaves").find((x) => x.id === 2).price, 5.6), "the row did not change");
  const f = factsOf(r.reply);
  const fact = f.find((t) => t.startsWith("changed: Changed the entry “Dark Rye” in loaves: price from “"));
  assert.ok(fact, JSON.stringify(f));
  assert.ok(/“5\.2”/.test(fact) && /“5\.6”/.test(fact), fact);
  assert.ok(!f.some((t) => /Updated one entry/.test(t)), "the count sentence stood beside the change: " + JSON.stringify(f));
  assert.equal(replyOutcomeOf(editReplyFacts(r.reply)), "done");
});

test("DATA 4 — THROUGH THE ROUTE: a row taken off the list since it was read is not counted as changed — alone, nothing is claimed and the step says it could not be saved; beside a change that landed, only that one is named and the other is told as not done", async () => {
  const alone = rowsDb({ tables: loaves(), meta: { schema: JSON.stringify(SPEC) }, vanish: [{ table: "loaves", id: 2 }] });
  const a = await dataEdit("dce-gone", "Make the Dark Rye £5.60.", { changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] }, alone);
  assert.equal(a.status, 422, a.text.slice(0, 300));
  assert.deepEqual([a.reply.ok, a.reply.error], [false, "write"]);
  assert.equal(a.reply.changes, undefined);
  assert.equal(a.reply.applied, undefined, "a change that matched no row was reported as applied");
  const both = rowsDb({ tables: loaves(), meta: { schema: JSON.stringify(SPEC) }, vanish: [{ table: "loaves", id: 2 }] });
  const b = await dataEdit("dce-half", "Make the Dark Rye £5.60 and the Walnut Levain £6.40.", { changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }, { table: "loaves", id: 5, values: { price: 6.4 } }] }, both);
  assert.equal(b.status, 200, b.text.slice(0, 300));
  assert.equal(b.reply.failed, 1);
  assert.deepEqual(b.reply.applied, [{ table: "loaves", id: 5, columns: ["price"] }]);
  assert.deepEqual(b.reply.changes.map((c) => [c.id, c.label]), [[5, "Walnut Levain"]]);
  const f = factsOf(b.reply);
  assert.ok(f.some((t) => t.startsWith("changed: Changed the entry “Walnut Levain” in loaves: price from")), JSON.stringify(f));
  assert.ok(!f.some((t) => t.includes("Dark Rye")), "the entry that was not changed was named as changed: " + JSON.stringify(f));
  assert.ok(f.some((t) => t.startsWith("not-done: one entry could not be saved")), JSON.stringify(f));
  assert.equal(replyOutcomeOf(editReplyFacts(b.reply)), "partly");
});

test("DATA 5 — THROUGH THE ROUTE: an entry added carries the id the database gave it and every value as kept; a field already right is said as nothing to change; a long value is cut for the reply and kept whole in the row", async () => {
  const db = rowsDb({ tables: loaves(), meta: { schema: JSON.stringify(SPEC) } });
  const long = "A slow loaf. ".repeat(30).trim();
  const r = await dataEdit("dce-add", "Add a Spelt loaf at £6.20, keep the focaccia at £4.50 and give the walnut loaf a longer description.", {
    changes: [
      { table: "loaves", values: { name: "Spelt", price: 6.2 } },
      { table: "loaves", id: 6, values: { price: 4.5 } },
      { table: "loaves", id: 5, values: { description: long } },
    ],
  }, db);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  const [added, kept, cut] = r.reply.changes;
  assert.equal(added.id, 7, "the id was not the one the database gave");
  assert.deepEqual(Object.keys(added.added), ["name", "price"]);
  assert.equal(added.added.name, "Spelt");
  assert.equal(kept.fields[0].same, true, JSON.stringify(kept));
  assert.ok(cut.fields[0].now.endsWith("…") && cut.fields[0].now.length === MAX_CHANGE_VALUE + 1, JSON.stringify(cut.fields[0]).slice(0, 120));
  assert.equal(db.rows("loaves").find((x) => x.id === 5).description, long, "the row lost characters");
  const f = factsOf(r.reply);
  assert.ok(f.some((t) => t.startsWith("changed: Added an entry to loaves: name “Spelt”, price “")), JSON.stringify(f));
  assert.ok(f.some((t) => t.startsWith("nothing: Nothing to change for the entry “Sea Salt Focaccia” in loaves: price was already “")), JSON.stringify(f));
  assert.ok(f.some((t) => t.startsWith("changed: Changed the entry “Walnut Levain” in loaves: description from") && t.includes("…")), JSON.stringify(f));
  assert.equal(replyOutcomeOf(editReplyFacts(r.reply)), "done");
});

// ── EQUALITY ON THE VALUES, NEVER ON WHAT IS SHOWN (2026-10-07, Codex's review) ──

const LOAF_TABLE = (rows = BAKERY_LOAVES) => [{ name: "loaves", columns: ["name", "description", "price", "photo"], rows }];
const factsOfChanges = (changes) => factsOf({ ok: true, layer: "data", applied: changes.map((c) => ({ table: c.table, id: c.id, columns: c.fields ? c.fields.map((f) => f.column) : Object.keys(c.added || {}) })), changes, failed: 0, cost: 1 });

test("DATA 10 — THROUGH THE ROUTE: a long description changed only past the cut is told as changed, with its starts marked, and the row keeps every character", async () => {
  const head = "A slow loaf, ".repeat(20);
  const wasLong = head + "proved overnight.";
  const nowLong = head + "proved for two nights.";
  const db = rowsDb({ tables: loaves(BAKERY_LOAVES.map((r) => (r.id === 5 ? { ...r, description: wasLong } : r))), meta: { schema: JSON.stringify(SPEC) } });
  const r = await dataEdit("dce-past-cut", "Say the walnut loaf is proved for two nights.", { changes: [{ table: "loaves", id: 5, values: { description: nowLong } }] }, db);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  const f = r.reply.changes[0].fields[0];
  assert.deepEqual([f.same, f.differsPastCut], [false, true], JSON.stringify(f).slice(0, 200));
  assert.equal(db.rows("loaves").find((x) => x.id === 5).description, nowLong, "the row lost characters");
  const facts = factsOf(r.reply);
  assert.ok(facts.some((t) => t.startsWith("changed: Changed the entry “Walnut Levain” in loaves: description from")), JSON.stringify(facts));
  assert.ok(!facts.some((t) => /already|Nothing to change/.test(t)), JSON.stringify(facts));
  assert.equal(replyOutcomeOf(editReplyFacts(r.reply)), "done");
});

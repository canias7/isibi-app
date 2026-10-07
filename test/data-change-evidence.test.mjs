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
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { DATA_TOOL, dataChanges, runDataEdit, MAX_CHANGE_VALUE } from "../builder/site-apply.mjs";
import { editReplyFacts, replyOutcomeOf } from "../builder/site-reply.mjs";

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

test("DATA 1 — THE EVIDENCE OF EACH CHANGE: the entry by the words its list shows, each field from the row as read to the row as the database kept it, an addition with the id the database gave it, a value nothing confirmed marked as written, a field already right marked so, and a value past the reply's bound cut with a mark — never a removal, which carries its own row", () => {
  const tables = [{ name: "loaves", columns: ["name", "description", "price", "photo"], rows: BAKERY_LOAVES }];
  const long = "x".repeat(MAX_CHANGE_VALUE + 50);
  const applied = [
    { table: "loaves", id: 2, values: { price: 5.6 }, stored: { ...BAKERY_LOAVES[1], price: "5.60" } },
    { table: "loaves", id: 3, values: { name: "Seeded Spelt" }, stored: { ...BAKERY_LOAVES[2], name: "Seeded Spelt" } },
    { table: "loaves", id: 4, values: { price: 5.8 } },
    { table: "loaves", id: 5, values: { price: 6 }, stored: { ...BAKERY_LOAVES[4] } },
    { table: "loaves", id: 6, values: { description: long }, stored: { ...BAKERY_LOAVES[5], description: long } },
    { table: "loaves", values: { name: "Spelt", price: 6.2 }, stored: { id: 9, name: "Spelt", description: null, price: "6.20", photo: null } },
    { table: "loaves", id: 1, remove: true, was: BAKERY_LOAVES[0] },
  ];
  const out = dataChanges(applied, tables);
  assert.equal(out.length, 6, "a removal was told twice, or a change was dropped: " + JSON.stringify(out));
  // THE VALUE THE DATABASE KEPT, not the one asked for.
  assert.deepEqual(out[0], { table: "loaves", id: 2, label: "Dark Rye", fields: [{ column: "price", was: 5.2, now: "5.60", same: false }] });
  // THE ENTRY IS NAMED BY WHAT IT WAS, never by the words this change wrote over it.
  assert.equal(out[1].label, "Toasted sunflower, flax and sesame through a wholemeal dough.");
  assert.deepEqual(out[1].fields, [{ column: "name", was: "Seeded Wholemeal", now: "Seeded Spelt", same: false }]);
  // NO ROW CAME BACK: the value written, said as such — and never "already right", which only a value read back can show (2026-10-07).
  assert.deepEqual(out[2].fields, [{ column: "price", was: 5.8, now: 5.8, readBack: false }]);
  // ALREADY RIGHT.
  assert.deepEqual(out[3].fields, [{ column: "price", was: 6, now: 6, same: true }]);
  // CUT FOR THE REPLY, AND MARKED.
  assert.equal(out[4].fields[0].now, "x".repeat(MAX_CHANGE_VALUE) + "…");
  assert.deepEqual([out[4].fields[0].nowCut, out[4].fields[0].same], [true, false]);
  assert.equal(out[4].fields[0].was, BAKERY_LOAVES[5].description);
  // AN ADDITION, with the id the database gave it.
  assert.deepEqual(out[5], { table: "loaves", id: 9, added: { name: "Spelt", price: "6.20" } });
  assert.deepEqual(dataChanges([{ table: "loaves", values: { name: "Rye" } }], tables), [{ table: "loaves", added: { name: "Rye" }, readBack: false }]);
  // UNREADABLE INPUT ANSWERS NOTHING, never a guess.
  assert.deepEqual(dataChanges(null, tables), []);
  assert.deepEqual(dataChanges([null, 3, { table: "loaves" }], tables), []);
});

test("DATA 2 — A ROW WRITE THE DATABASE DID NOT HAND BACK IS NOT A CHANGE MADE: the step counts it failed; a write that handed its row back carries it", async () => {
  const tables = [{ name: "loaves", columns: ["name", "price"], rows: BAKERY_LOAVES.slice(0, 2) }];
  const reply = { stop_reason: "tool_use", content: [{ type: "tool_use", name: TOOL, input: { changes: [{ table: "loaves", id: 1, values: { price: 5 } }, { table: "loaves", id: 2, values: { price: 6 } }] } }], usage: { input_tokens: 1, output_tokens: 1 } };
  const r = await runDataEdit({
    send: async () => reply,
    apply: async (c) => (c.id === 1 ? { ...BAKERY_LOAVES[0], price: 5 } : false),
  }, { instruction: "x", tables });
  assert.equal(r.ok, true);
  assert.equal(r.failed, 1);
  assert.deepEqual(r.applied.map((c) => [c.id, c.stored && c.stored.price]), [[1, 5]]);
});

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

test("DATA 6 — AN ANSWER STORED BEFORE THE EVIDENCE EXISTED IS TOLD AS IT WAS: by count; and one whose only change was already right reads as nothing changed", () => {
  const old = { ok: true, layer: "data", applied: [{ table: "loaves", id: 2, columns: ["price"] }], failed: 0, cost: 1 };
  assert.deepEqual(factsOf(old), ["changed: Updated one entry in loaves."]);
  const already = { ...old, changes: [{ table: "loaves", id: 2, label: "Dark Rye", fields: [{ column: "price", was: "5.20", now: "5.20", same: true }] }] };
  assert.deepEqual(factsOf(already), ["nothing: Nothing to change for the entry “Dark Rye” in loaves: price was already “5.20”."]);
  assert.equal(replyOutcomeOf(editReplyFacts(already)), "nothing");
  // A VALUE NO ROW CONFIRMED IS SAID AS WRITTEN, never as read back.
  const unread = { ...old, changes: [{ table: "loaves", id: 2, label: "Dark Rye", fields: [{ column: "price", was: "5.20", now: 5.6, readBack: false }] }] };
  const f = factsOf(unread);
  assert.equal(f.length, 1, JSON.stringify(f));
  assert.match(f[0], /^changed: Changed the entry “Dark Rye” in loaves: price from “5\.20” to “5\.6”\. The database did not hand the entry back, so these are the values written, not values read back\.$/);
});

// ── EQUALITY ON THE VALUES, NEVER ON WHAT IS SHOWN (2026-10-07, Codex's review) ──

const LOAF_TABLE = (rows = BAKERY_LOAVES) => [{ name: "loaves", columns: ["name", "description", "price", "photo"], rows }];
const factsOfChanges = (changes) => factsOf({ ok: true, layer: "data", applied: changes.map((c) => ({ table: c.table, id: c.id, columns: c.fields ? c.fields.map((f) => f.column) : Object.keys(c.added || {}) })), changes, failed: 0, cost: 1 });

test("DATA 7 — TWO LONG VALUES THAT DIFFER ONLY PAST THE CUT: not the same — the change is told as made, both shown starts marked as starts, and said to differ past them; never \"already\" or \"nothing to change\"", () => {
  const head = "A slow loaf, ".repeat(20);
  const wasLong = head + "proved overnight.";
  const nowLong = head + "proved for two nights.";
  assert.ok(wasLong.slice(0, MAX_CHANGE_VALUE) === nowLong.slice(0, MAX_CHANGE_VALUE) && wasLong !== nowLong, "this case tests nothing: the values do not share their shown start");
  const rows = BAKERY_LOAVES.map((r) => (r.id === 5 ? { ...r, description: wasLong } : r));
  const [c] = dataChanges([{ table: "loaves", id: 5, values: { description: nowLong }, stored: { ...rows[4], description: nowLong } }], LOAF_TABLE(rows));
  const f = c.fields[0];
  assert.deepEqual([f.same, f.wasCut, f.nowCut, f.differsPastCut], [false, true, true, true], JSON.stringify(f).slice(0, 200));
  assert.equal(f.was, f.now, "this case tests nothing: the shown values differ");
  const facts = factsOfChanges([c]);
  assert.ok(facts.some((t) => t.startsWith("changed: Changed the entry “Walnut Levain” in loaves: description from") && t.includes("differ past the start shown")), JSON.stringify(facts));
  assert.ok(!facts.some((t) => /already|Nothing to change/.test(t)), "a change past the cut was told as nothing changed: " + JSON.stringify(facts));
  // AND A REAL NO-OP OF THE SAME LONG VALUE is told as one.
  const [same] = dataChanges([{ table: "loaves", id: 5, values: { description: wasLong }, stored: { ...rows[4] } }], LOAF_TABLE(rows));
  assert.equal(same.fields[0].same, true);
  assert.ok(factsOfChanges([same]).some((t) => t.startsWith("nothing: Nothing to change for the entry “Walnut Levain” in loaves: description was already")));
});

test("DATA 8 — A TYPE IS PART OF A VALUE; NULL IS A VALUE; A BEFORE NOBODY READ IS NEITHER: 40 and \"40\" differ, \"40\" and \"40\" are a real no-op, a null before is said empty, and a row the route never read is said as not read — never as empty, never as the same", () => {
  const rows = BAKERY_LOAVES.map((r) => (r.id === 2 ? { ...r, price: 40 } : r.id === 3 ? { ...r, price: "40" } : r));
  const [typed, noop] = dataChanges([
    { table: "loaves", id: 2, values: { price: "40" }, stored: { ...rows[1], price: "40" } },
    { table: "loaves", id: 3, values: { price: "40" }, stored: { ...rows[2], price: "40" } },
  ], LOAF_TABLE(rows));
  assert.deepEqual([typed.fields[0].same, noop.fields[0].same], [false, true]);
  const [nulled] = dataChanges([{ table: "loaves", id: 1, values: { photo: "loaf.jpg" }, stored: { ...BAKERY_LOAVES[0], photo: "loaf.jpg" } }], LOAF_TABLE());
  assert.deepEqual(nulled.fields[0], { column: "photo", was: null, now: "loaf.jpg", same: false });
  assert.ok(factsOfChanges([nulled]).some((t) => t.includes("photo from empty to “loaf.jpg”")));
  // THE ROW WAS NEVER READ (not among the rows the route read): its before is unknown, not null.
  const [unread] = dataChanges([{ table: "loaves", id: 99, values: { price: 7 }, stored: { id: 99, name: "Fig", price: 7 } }], LOAF_TABLE());
  assert.deepEqual(unread.fields[0], { column: "price", wasUnknown: true, now: 7 });
  assert.equal(Object.hasOwn(unread.fields[0], "was"), false, "an unread before was shown as a value");
  const uf = factsOfChanges([unread]);
  assert.ok(uf.some((t) => t.includes("price is now “7” (what it was before was not read)")), JSON.stringify(uf));
  assert.ok(!uf.some((t) => /from empty|already/.test(t)), JSON.stringify(uf));
});

test("DATA 9 — A ROW HANDED BACK WITHOUT A FIELD: that field is the value written, marked on the field, and never claimed already right; the fields that came back are readings; an addition says the same of each field", () => {
  const [c] = dataChanges([{ table: "loaves", id: 4, values: { name: "Olive Loaf", price: 5.8 }, stored: { id: 4, name: "Olive Loaf" } }], LOAF_TABLE());
  const [name, price] = c.fields;
  assert.deepEqual(name, { column: "name", was: "Olive & Rosemary", now: "Olive Loaf", same: false });
  assert.deepEqual(price, { column: "price", was: 5.8, now: 5.8, readBack: false });
  const f = factsOfChanges([c]);
  assert.ok(f.some((t) => t.includes("price from “5.8” to “5.8” (as written; the database did not hand this back)")), JSON.stringify(f));
  assert.ok(!f.some((t) => /already|did not hand the entry back/.test(t)), JSON.stringify(f));
  const [added] = dataChanges([{ table: "loaves", values: { name: "Fig", price: 7 }, stored: { id: 8, name: "Fig" } }], LOAF_TABLE());
  assert.deepEqual(added, { table: "loaves", id: 8, added: { name: "Fig", price: 7 }, unread: ["price"] });
  const af = factsOfChanges([added]);
  assert.ok(af.some((t) => t === "changed: Added an entry to loaves: name “Fig”, price “7” (as written; the database did not hand this back)."), JSON.stringify(af));
});

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

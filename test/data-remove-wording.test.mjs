// THE DATA PICKER WAS TOLD BOTH TO DELETE A ROW AND TO REFUSE A DELETION
// (Lane 1a, 2026-09-30).
//
// `DATA_TOOL`'s `changes` list said "IF THE INSTRUCTION CANNOT BE DONE BY
// CHANGING OR ADDING ROWS — it asks to DELETE one, or it is about the look of
// the page … — return an empty array", written before rows could be removed.
// `dcf269a4` then gave each item a `remove` field ("True to DELETE the row with
// this id") and left that sentence, so the one request carried both answers to
// "take this off the list". A picker that followed the list's sentence answered
// nothing, and the route told the owner it could not match anything (backlog,
// found 2026-09-29 while preparing Batch 1).
//
// EVERY CASE DRIVES THE REAL EDIT ROUTE (`POST /api/site/<slug>/edit`, layer
// `data`) and reads what it sends and does: the picker's request as it leaves,
// the SQL that reaches the database, and the reply. The picker's answers are
// SUPPLIED — what is established is what the picker is told and what the route
// does with an answer, never how a real model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { DATA_TOOL } from "../builder/site-apply.mjs";

const USER = { id: "u-data-remove-1", email: "owner@example.com" };
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const TOOL = DATA_TOOL.name;
const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";

// A lessons list the way fretwork-1 keeps one, and a table of bookings beside
// it: visitors' data, which the data step never offers.
const SPEC = {
  tables: [
    { name: "lessons", access: "display", columns: [{ name: "name", type: "text" }, { name: "price", type: "integer" }] },
    { name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] },
  ],
};
const LESSONS = [
  [1, "Taster half-hour", 20],
  [2, "Half-hour one-to-one", 25],
  [3, "Group session", 15],
  [4, "Hour one-to-one", 40],
];

function bucket(slug) {
  const store = new Map();
  store.set("source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: page("/", "<h1>Fretwork</h1>") }, { path: "prices.tsx", source: page("/prices", "<h1>Prices</h1>") }]));
  store.set("source/" + slug + "/parts.json", "[]");
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fretwork", theme: "broadsheet" }, css: "" }));
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

/**
 * One data edit through the real route. `answer` is the picker's tool input.
 * Returns the reply, the picker requests as they left, and every statement the
 * database was sent with its bound parameters.
 */
async function dataEdit(slug, instruction, answer) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const seen = { requests: [], sql: [], writes: [] };
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
      if (method !== "GET") { seen.writes.push(method + " " + url); return json([]); }
      if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "site_" + slug.replace(/-/g, "_") }]);
      if (url.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_conn: PROJECT_CONN }]);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(url)) {
      let body = {};
      try { body = JSON.parse(String((init && init.body) || "{}")); } catch { body = {}; }
      const q = String(body.query || "");
      // THE PARAMETERS AS THE WIRE CARRIES THEM: the driver sends each one as
      // text, so a bound 4 arrives as "4".
      seen.sql.push({ q, params: Array.isArray(body.params) ? body.params.map(String) : [] });
      const answerSql = (rows, fields) => json({
        command: /^\s*select/i.test(q) ? "SELECT" : q.trim().split(/\s+/)[0].toUpperCase(),
        rowCount: rows.length, rows,
        fields: fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })),
      });
      if (/_meta/i.test(q) && /schema/i.test(q)) return answerSql([[JSON.stringify(SPEC)]], ["v"]);
      if (/FROM "lessons"/i.test(q) && /^\s*select/i.test(q)) return answerSql(LESSONS, ["id", "name", "price"]);
      return answerSql([], ["x"]);
    }
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = (body.tool_choice && body.tool_choice.name) || "";
      if (tool !== TOOL) return new Response("no stub for tool " + tool, { status: 503 });
      seen.requests.push(body);
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
    return { status: res.status, reply, text, seen };
  } finally {
    globalThis.fetch = real;
  }
}

/** Every description the picker reads in its tool, with where it sits. */
function descriptions(tool) {
  const out = [{ at: "tool", text: String(tool.description || "") }];
  const walk = (node, at) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.description === "string") out.push({ at, text: node.description });
    for (const [k, v] of Object.entries(node.properties || {})) walk(v, at + "." + k);
    if (node.items) walk(node.items, at + "[]");
  };
  walk(tool.input_schema, "input");
  return out;
}
/** A description's sentences: split on full stops and line breaks. */
const sentences = (text) => text.split(/(?<=\.)\s+|\n/).map((s) => s.trim()).filter(Boolean);

const writes = (seen) => seen.sql.filter((s) => /^\s*(delete|update|insert)\b/i.test(s.q));
const REMOVE_ASK = "Take the Hour one-to-one off the price list.";

test("the picker's request tells it one thing about deleting a row: use `remove`", async () => {
  const r = await dataEdit("data-remove-told", REMOVE_ASK, { changes: [{ table: "lessons", id: 4, remove: true }] });
  assert.equal(r.status, 200, "the edit did not go through: " + r.text.slice(0, 300));
  assert.equal(r.seen.requests.length, 1, "the picker was not asked exactly once");
  const req = r.seen.requests[0];
  // THE REQUEST AS IT LEFT, not the module's constant: the route could send a
  // different tool, and that is the thing the picker reads.
  assert.equal(req.tool_choice && req.tool_choice.name, TOOL, "the picker is not forced to the row tool");
  const tool = (req.tools || []).find((t) => t && t.name === TOOL);
  assert.ok(tool, "the row tool is not in the request");
  const said = descriptions(tool);
  assert.ok(said.length > 5, "the walk found almost nothing to read — the observer is dead");
  // THE OBSERVER IS ALIVE: the empty-array rule itself is still there to find.
  const empties = said.flatMap((d) => sentences(d.text).filter((s) => /empty array/i.test(s)).map((s) => ({ at: d.at, s })));
  assert.ok(empties.length >= 1, "no sentence tells the picker when to answer nothing");
  // THE CONTRADICTION: no sentence that tells it to answer nothing names a
  // deletion as the reason.
  for (const e of empties) {
    assert.doesNotMatch(e.s, /delet/i, `${e.at} still tells the picker to answer nothing for a deletion: "${e.s}"`);
  }
  // AND THE RULE STILL COVERS WHAT IT WAS FOR: a request about the look.
  assert.ok(empties.some((e) => /look of the page/i.test(e.s)), "the empty-array rule no longer covers a request about the look");
  // WHERE A DELETION GOES, said on the list the picker fills in and on the tool.
  const changes = tool.input_schema.properties.changes;
  assert.match(changes.description, /`remove`/, "the list's own description does not send a deletion to `remove`");
  assert.match(tool.description, /take one off|remove/i, "the tool's one line still names changing and adding only");
  // The field it is sent to is there, and a removal does not need values.
  assert.ok(changes.items.properties.remove, "the item has no `remove` field");
  assert.deepEqual(changes.items.required, ["table"]);
  // Adding a row is still something the picker is told it can do.
  assert.match(changes.items.properties.id.description, /LEAVE THIS OUT to add a new row/);

  // THE ANSWER THE REQUEST ASKS FOR, and what the route does with it: one bound
  // DELETE of the row it named, nothing else written, and the row handed back.
  const w = writes(r.seen);
  assert.equal(w.length, 1, "not exactly one write: " + JSON.stringify(w));
  assert.match(w[0].q, /^DELETE FROM "lessons" WHERE id = \$1$/);
  assert.deepEqual(w[0].params, ["4"]);
  assert.equal(r.reply.ok, true);
  assert.equal(r.reply.layer, "data");
  // `was` is the row AS THE ROUTE READ IT (this stub answers every column as
  // text), never the picker's echo of it.
  assert.deepEqual(r.reply.applied, [{ table: "lessons", id: 4, removed: true, was: { id: "4", name: "Hour one-to-one", price: "40" } }]);
  assert.deepEqual(r.seen.writes, [], "a data edit wrote to Supabase");
});

test("the targeting protections still stand between the picker and a DELETE", async () => {
  // Each answer names a removal the route must refuse. Nothing is deleted, and
  // the owner is told it matched nothing rather than told it worked.
  const refused = [
    ["an id the picker was not shown", { changes: [{ table: "lessons", id: 9, remove: true }] }],
    ["a table the picker was not offered (visitors' bookings)", { changes: [{ table: "bookings", id: 1, remove: true }] }],
    ["a flag that is truthy but not true", { changes: [{ table: "lessons", id: 4, remove: "yes" }] }],
    ["a removal with no id", { changes: [{ table: "lessons", remove: true }] }],
  ];
  let n = 0;
  for (const [what, answer] of refused) {
    const r = await dataEdit("data-remove-refused-" + (n++), REMOVE_ASK, answer);
    assert.deepEqual(writes(r.seen), [], what + ": a write reached the database");
    assert.equal(r.status, 422, what + ": " + r.text.slice(0, 200));
    assert.equal(r.reply.ok, false, what);
    assert.equal(r.reply.error, "no-match", what);
    assert.match(r.reply.msg, /couldn't match that to anything the site stores/, what);
  }
});

test("changing and adding a row are unchanged beside it", async () => {
  // CONTROLS: the two things the list's old sentence did allow.
  const changed = await dataEdit("data-remove-change", "Change the Hour one-to-one to £42.", { changes: [{ table: "lessons", id: 4, values: { price: 42 } }] });
  assert.equal(changed.status, 200, changed.text.slice(0, 200));
  const cw = writes(changed.seen);
  assert.equal(cw.length, 1);
  assert.match(cw[0].q, /^UPDATE "lessons" SET "price" = \$1 WHERE id = \$2$/);
  assert.deepEqual(cw[0].params, ["42", "4"]);
  assert.deepEqual(changed.reply.applied, [{ table: "lessons", id: 4, columns: ["price"] }]);

  const added = await dataEdit("data-remove-add", "Add a Duet lesson at £30.", { changes: [{ table: "lessons", values: { name: "Duet", price: 30 } }] });
  assert.equal(added.status, 200, added.text.slice(0, 200));
  const aw = writes(added.seen);
  assert.equal(aw.length, 1);
  assert.match(aw[0].q, /^INSERT INTO "lessons" \("name", "price"\) VALUES \(\$1, \$2\)$/);
  assert.deepEqual(aw[0].params, ["Duet", "30"]);
});

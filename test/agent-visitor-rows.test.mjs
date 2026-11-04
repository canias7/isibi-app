// Visitors' rows are theirs (2026-11-04, carry-over C2-1/M-15/M-16). The old
// data lane offered only tables the owner manages; the agent's change_rows and
// read_table reached every table, so it could change or delete a visitor's
// booking or order, and send visitors' rows to the model provider. Driven
// through the real agent loop with a scripted model.
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, VISITOR_ROWS } from "../builder/site-agent.mjs";

const SPEC = { tables: [
  { name: "products", access: "display", columns: [{ name: "id" }, { name: "name" }, { name: "price" }] },
  { name: "bookings", access: "collect", columns: [{ name: "id" }, { name: "name" }, { name: "email" }] },
  { name: "messages", read: "none", write: "anyone", columns: [{ name: "id" }, { name: "body" }] },
] };
const use = (name, input, id = name + Math.random()) => ({ type: "tool_use", id, name, input });
async function drive(calls) {
  const answers = [];
  let round = 0;
  const reads = [];
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    readTable: async (t) => { reads.push(t); return [{ id: 1, secret: "visitor@example.com" }]; },
  }, { request: "tidy the lists", pages: [{ path: "index.tsx", source: "export default 1" }], parts: [], spec: SPEC, model: "m", maxRounds: 6 });
  return { ag, answers, reads };
}

test("change_rows on a table visitors write to is refused; nothing is queued for it", async () => {
  const r = await drive([[use("change_rows", { table: "bookings", remove: [1] })], [use("change_rows", { table: "messages", update: [{ id: 1, set: { body: "x" } }] })]]);
  assert.ok(r.answers.length >= 2, "the observer is alive: the tool answers came back");
  assert.ok(r.answers.slice(0, 2).every((a) => a.includes(VISITOR_ROWS)), r.answers.slice(0, 2).join(" | "));
  assert.equal(r.ag.rows.length, 0, "a visitor's row change was queued");
});

test("read_table on a visitor table sends nothing to the model, and never calls the reader", async () => {
  const r = await drive([[use("read_table", { table: "bookings" })]]);
  assert.ok(r.answers[0].includes(VISITOR_ROWS));
  assert.ok(!r.answers.join(" ").includes("visitor@example.com"));
  assert.deepEqual(r.reads, []);
});

test("the owner's own lists still read and change (control)", async () => {
  const r = await drive([[use("read_table", { table: "products" })], [use("change_rows", { table: "products", add: [{ name: "Mug", price: 9 }] })]]);
  assert.deepEqual(r.reads, ["products"]);
  assert.equal(r.ag.rows.length, 1);
  assert.equal(r.ag.rows[0].table, "products");
});

test("a table this run does not know is not read", async () => {
  const r = await drive([[use("read_table", { table: "auth_users" })]]);
  assert.match(r.answers[0], /no such table/);
  assert.deepEqual(r.reads, []);
});

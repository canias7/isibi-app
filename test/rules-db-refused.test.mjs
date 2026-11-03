// A RULE THE DATABASE REFUSED IS NOT REPORTED AS CHANGED (2026-10-22, audit A29-4).
//
// The engine returns what Postgres refused (`refusedRules`), and the rules
// route threw it away: "stop two people booking the same slot" on a table that
// already holds two such bookings was answered "changed the no-duplicates
// rule" while doubles kept being accepted. The route's apply now hands the
// list back, and the step says the refusal instead. Supplied answers only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runRulesEdit } from "../builder/site-rules.mjs";

const bookings = { name: "bookings", access: "collect", columns: [{ name: "slot_date", type: "text" }, { name: "slot_time", type: "text" }, { name: "who", type: "text" }] };
const said = (input) => ({ content: [{ type: "tool_use", name: "write_table_rules", input: { tables: [input] } }], usage: { input_tokens: 900, output_tokens: 60 } });
const deps = (input, answer) => ({ send: async () => said(input), apply: async () => answer });

test("DBR 1 — a unique the database refused leaves `applied` and is said as refused", async () => {
  const r = await runRulesEdit(deps({ table: "bookings", unique: ["slot_date", "slot_time"], maxRows: 50 }, { refusedRules: [{ table: "bookings", feature: "unique", rule: "slot_date+slot_time", why: "duplicated" }] }), { instruction: "stop double bookings", tables: [bookings] });
  assert.equal(r.ok, true);
  assert.ok(!/no-duplicates/.test(r.msg.split("One thing I left alone")[0]), "the refused rule was reported as changed: " + r.msg);
  assert.match(r.msg, /database refused/);
  assert.deepEqual(r.applied.map((a) => a.fields), [["maxRows"]]);
  assert.deepEqual(r.refused.map((x) => [x.rule, x.why]), [["unique", "db-refused"]]);
});

test("DBR 2 — control: nothing refused (or an apply that answers true) reads as before", async () => {
  for (const answer of [true, { refusedRules: [] }]) {
    const r = await runRulesEdit(deps({ table: "bookings", unique: ["slot_date", "slot_time"] }, answer), { instruction: "stop double bookings", tables: [bookings] });
    assert.match(r.msg, /changed the no-duplicates rule/);
    assert.deepEqual(r.refused, []);
  }
});

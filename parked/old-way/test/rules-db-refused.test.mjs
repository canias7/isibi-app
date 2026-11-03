// PARKED (2026-11-03, park-old-way): the old-way half of test/rules-db-refused.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { runRulesEdit } from "../../../builder/site-rules.mjs";

const bookings = { name: "bookings", access: "collect", columns: [{ name: "slot_date", type: "text" }, { name: "slot_time", type: "text" }, { name: "who", type: "text" }] };
const said = (input) => ({ content: [{ type: "tool_use", name: "write_table_rules", input: { tables: [input] } }], usage: { input_tokens: 900, output_tokens: 60 } });
const deps = (input, answer) => ({ send: async () => said(input), apply: async () => answer });

test("DBR 3 — the route's apply hands the engine's refusals back", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const rOut = await runRulesEdit(");
  assert.ok(at > 0, "the rules route moved");
  const call = src.slice(at, src.indexOf("}, { instruction: eInstruction", at));
  assert.ok(call.length > 0 && /apply: async \(spec\) =>/.test(call), "the apply was not found");
  assert.match(call, /refusedRules/, "the route's apply discards what the database refused");
});

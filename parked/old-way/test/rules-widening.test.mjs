// PARKED (2026-11-03, park-old-way): the old-way half of test/rules-widening.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Audit A29-9 (2026-10-23, the owner's choice (a)): a change that widens who
// can READ a table from the owner only (`none`) or each visitor's own rows
// (`own`) to everyone (`public`) or signed-in members (`members`) is a question
// back, unless the customer's own words (quoted by the model in `readWords`)
// are really in what they wrote. Narrowing, and changes that do not widen the
// read, apply as before. Every case runs `runRulesEdit` with supplied answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runRulesEdit, readRules, RULES_TOOL } from "../../../builder/site-rules.mjs";
import { resolveAccess } from "../../../site-access.mjs";

const bookings = {
  name: "bookings", access: "collect",
  columns: [{ name: "customer", type: "text" }, { name: "email", type: "text" }],
};
const menu = { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] };
const TABLES = [bookings, menu];
const said = (input) => ({ content: [{ type: "tool_use", name: "write_table_rules", input }], usage: { input_tokens: 10, output_tokens: 5 } });

function deps(reply) {
  const calls = { send: 0, before: 0, apply: 0, spec: null };
  return {
    calls,
    send: async () => { calls.send++; return reply; },
    before: async () => { calls.before++; return true; },
    apply: async (spec) => { calls.apply++; calls.spec = spec; return {}; },
  };
}

test("the edit route hands the step the answers it is shown", () => {
  const src = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const rOut = await runRulesEdit(");
  assert.ok(at > 0);
  const end = src.indexOf("if (rOut.ask) return stepAsk(\"rules\"", at);
  assert.ok(end > at);
  assert.match(src.slice(at, end), /answers:\s*\(readContext\(eCtx\)/);
});

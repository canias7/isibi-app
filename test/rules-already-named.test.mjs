// "ONLY I SHOULD SEE WHO SIGNED UP" ON A TABLE ONLY THE OWNER READS ALREADY
// (live test 11, 2026-10-26, job e3cf9c24): the rules model named no table,
// so the answer fell to no-match ("There was no rule I could change") and the
// customer was told a change failed that was already true. The model is now
// told to name the table with the asked level even when it already holds, so
// `splitAlready` answers "already so"; and the retry says the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesRequest, runRulesEdit } from "../builder/site-rules.mjs";

const T = [{ name: "newsletter_signups", access: "collect", columns: [{ name: "id" }, { name: "email" }] }];
const said = (input) => ({ content: [{ type: "tool_use", name: "write_table_rules", input }], usage: { input_tokens: 10, output_tokens: 5 } });
const textOf = (req) => JSON.stringify(req.system) + JSON.stringify(req.messages);

test("the rules model is told to name a table whose asked level already holds", () => {
  const req = rulesRequest({ instruction: "only I should see who signed up", tables: T });
  const sys = req.system.map((b) => b.text).join("\n");
  assert.match(sys, /ALREADY HAS WHAT THEY ASKED FOR[^]*STILL NAME THAT TABLE WITH THE LEVEL THEY ASKED FOR/);
  assert.match(sys, /Never answer an empty list for a rule that already holds/);
});

test("an empty first answer is retried with that instruction, and the named level comes back as already so", async () => {
  const sent = [];
  const out = await runRulesEdit({
    send: async (req) => { sent.push(req); return sent.length === 1 ? said({ tables: [] }) : said({ tables: [{ table: "newsletter_signups", read: "none" }] }); },
    before: async () => true, apply: async () => ({}),
  }, { instruction: "only I should see who signed up", tables: T });
  assert.equal(sent.length, 2, "the empty answer was not retried");
  assert.match(textOf(sent[1]), /when the table already has it, still name the table with the level asked for/);
  assert.equal(out.ok, true);
  assert.equal(out.satisfied, true);
  assert.deepEqual(out.already, [{ table: "newsletter_signups", fields: ["read"], read: "none" }]);
});

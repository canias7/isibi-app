// Audit A29-9 (2026-10-23, the owner's choice (a)): a change that widens who
// can READ a table from the owner only (`none`) or each visitor's own rows
// (`own`) to everyone (`public`) or signed-in members (`members`) is a question
// back, unless the customer's own words (quoted by the model in `readWords`)
// are really in what they wrote. Narrowing, and changes that do not widen the
// read, apply as before. Every case runs `runRulesEdit` with supplied answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runRulesEdit, readRules, RULES_TOOL } from "../builder/site-rules.mjs";
import { resolveAccess } from "../site-access.mjs";

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

test("the fixture's starting reads are what the cases assume (resolveAccess)", () => {
  assert.equal(resolveAccess(bookings).read, "none");
  assert.equal(resolveAccess(menu).read, "public");
});

test("the tool offers readWords beside read", () => {
  const item = RULES_TOOL.input_schema.properties.tables.items.properties;
  assert.ok(item.read && item.readWords && item.readWords.type === "string");
});

test("a widening to public with no words of theirs asks, and changes and bills nothing", async () => {
  const d = deps(said({ tables: [{ table: "bookings", read: "public" }] }));
  const r = await runRulesEdit(d, { instruction: "let people see which slots are free", tables: TABLES });
  assert.equal(d.calls.send, 1);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "ask");
  assert.ok(r.ask && typeof r.ask.text === "string" && r.ask.text.includes("bookings"));
  assert.match(r.ask.text, /anyone see every entry/);
  assert.equal(d.calls.before, 0, "nothing billed beyond the call a question costs");
  assert.equal(d.calls.apply, 0, "nothing applied");
  assert.ok(r.usage, "the call's usage is returned, as any question's is");
});

test("a quote that is not in what they wrote does not count", async () => {
  const d = deps(said({ tables: [{ table: "bookings", read: "public", readWords: "make bookings public" }] }));
  const r = await runRulesEdit(d, { instruction: "let people see which slots are free", tables: TABLES });
  assert.equal(r.reason, "ask");
  assert.equal(d.calls.apply, 0);
});

test("a widening to members with no words asks, naming signed-in members", async () => {
  const d = deps(said({ tables: [{ table: "bookings", read: "members" }] }));
  const r = await runRulesEdit(d, { instruction: "tidy up the bookings", tables: TABLES });
  assert.equal(r.reason, "ask");
  assert.match(r.ask.text, /signed in/);
  assert.equal(d.calls.apply, 0);
});

test("nothing proposed beside an ungrounded widening is applied", async () => {
  const d = deps(said({ tables: [{ table: "bookings", read: "public" }, { table: "menu", maxRows: 5 }] }));
  const r = await runRulesEdit(d, { instruction: "limit the menu to five", tables: TABLES });
  assert.equal(r.reason, "ask");
  assert.equal(d.calls.apply, 0);
});

test("a widening the customer asked for in their own words applies", async () => {
  const d = deps(said({ tables: [{ table: "bookings", read: "public", readWords: "everyone to see the bookings" }] }));
  const r = await runRulesEdit(d, { instruction: "I want everyone to see the bookings list.", tables: TABLES });
  assert.equal(r.ok, true);
  assert.equal(d.calls.apply, 1);
  const t = d.calls.spec.tables.find((x) => x.name === "bookings");
  assert.equal(resolveAccess(t).read, "public");
  assert.equal(t.readWords, undefined, "the quote is never stored on the table");
});

test("a widening confirmed in an answer they gave applies", async () => {
  const d = deps(said({ tables: [{ table: "bookings", read: "public", readWords: "Yes, anyone can see them" }] }));
  const r = await runRulesEdit(d, { instruction: "let people see which slots are free", tables: TABLES, answers: ["Yes, anyone can see them"] });
  assert.equal(r.ok, true);
  assert.equal(d.calls.apply, 1);
});

test("a narrowing applies as before, with no words needed", async () => {
  const d = deps(said({ tables: [{ table: "menu", read: "none" }] }));
  const r = await runRulesEdit(d, { instruction: "hide the menu", tables: TABLES });
  assert.equal(r.ok, true);
  assert.equal(d.calls.apply, 1);
  assert.equal(resolveAccess(d.calls.spec.tables.find((x) => x.name === "menu")).read, "none");
});

test("a read already wide is not asked about (members to public)", async () => {
  const club = { name: "club", read: "members", write: "none", columns: [{ name: "note", type: "text" }] };
  const d = deps(said({ tables: [{ table: "club", read: "public" }] }));
  const r = await runRulesEdit(d, { instruction: "x", tables: [club] });
  assert.equal(r.ok, true);
});

test("readRules carries the quote only beside a read", () => {
  const { changes } = readRules(said({ tables: [{ table: "menu", maxRows: 3, readWords: "q" }] }), TABLES);
  assert.equal(changes[0].readWords, undefined);
});

test("the edit route hands the step the answers it is shown", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const rOut = await runRulesEdit(");
  assert.ok(at > 0);
  const end = src.indexOf("if (rOut.ask) return stepAsk(\"rules\"", at);
  assert.ok(end > at);
  assert.match(src.slice(at, end), /answers:\s*\(readContext\(eCtx\)/);
});

// AN ENTRY THE LIST ALREADY HAS IS ASKED ABOUT, NEVER ADDED TWICE (live test
// 11, 2026-10-26: "Group lessons (beginners and improvers)" ended up in
// `lessons` twice, ids 5 and 9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowNameOf, duplicateRows, duplicateAsk, duplicateAnswer, DUP_ADD_ANYWAY, DUP_LEAVE } from "../builder/site-add.mjs";

const NAME = "Group lessons (beginners and improvers)";

test("the entry's own name is read from name, title or label only", () => {
  assert.deepEqual(rowNameOf({ name: "  " + NAME + " ", price: 40 }), { col: "name", value: NAME });
  assert.deepEqual(rowNameOf({ title: "Beach clean" }), { col: "title", value: "Beach clean" });
  assert.equal(rowNameOf({ email: "a@b.c", price: 3 }), null, "an entry with no name is never held back on a guess");
});

test("a name the list already has is found, ignoring case and spaces; a new one is not", async () => {
  const asked = [];
  const read = async (sql, params) => { asked.push([sql, params]); return params[0].toLowerCase() === NAME.toLowerCase() ? [{ id: 5 }] : []; };
  const d = await duplicateRows(read, [{ table: "lessons", values: { name: NAME.toUpperCase() } }, { table: "lessons", values: { name: "Night surf" } }, { table: 'x"; drop', values: { name: NAME } }]);
  assert.deepEqual(d, [{ table: "lessons", col: "name", value: NAME.toUpperCase(), id: 5 }]);
  assert.equal(asked.length, 2, "a table name that is not an identifier is never queried");
  assert.match(asked[0][0], /^SELECT id FROM "lessons" WHERE lower\(trim\("name"::text\)\) = lower\(\$1\)/);
  assert.equal(asked[0][1][0], NAME.toUpperCase(), "the name is a parameter, never in the SQL");
});

test("the question names the entry and its list, and its answer is read back from the context", () => {
  const d = { table: "lessons", col: "name", value: NAME, id: 5 };
  const ask = duplicateAsk(d);
  assert.match(ask.text, /already in lessons/);
  assert.deepEqual(ask.options, [DUP_ADD_ANYWAY, DUP_LEAVE]);
  assert.equal(duplicateAnswer([], d), "");
  assert.equal(duplicateAnswer([{ q: ask.text, a: DUP_ADD_ANYWAY }], d), "add");
  assert.equal(duplicateAnswer([{ q: ask.text, a: DUP_LEAVE }], d), "leave");
  assert.equal(duplicateAnswer([{ q: ask.text, a: "set it to £45" }], d), "other");
  assert.equal(duplicateAnswer([{ q: "another question", a: DUP_ADD_ANYWAY }], d), "", "another question's answer is not this one's");
});

test("the add-on asks before anything is charged or written", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = W.indexOf("dups = await duplicateRows((q, ps) => sqlReadOnly(adb, q, ps), rowClean.value)");
  assert.ok(at > 0, "the add-on no longer checks for an entry the list has");
  const charge = W.indexOf("rowCost = await aCharge(rowBill);", at);
  const prep = W.indexOf("if (aPrep) return aPrepStop();", at);
  const insert = W.indexOf("rowsInsert(", at);
  assert.ok(charge > at && prep > at && insert > at, "the check is not ahead of the preparation, the charge and the write");
  const block = W.slice(at, prep);
  assert.match(block, /error: "clarify", layer: "addon", kind: "row", by: "add:row", cost: 0/);
  assert.match(block, /said === "add"\) continue/);
});

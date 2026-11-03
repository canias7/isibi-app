// PARKED (2026-11-03, park-old-way): the old-way half of test/addon-row-duplicate.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// AN ENTRY THE LIST ALREADY HAS IS ASKED ABOUT, NEVER ADDED TWICE (live test
// 11, 2026-10-26: "Group lessons (beginners and improvers)" ended up in
// `lessons` twice, ids 5 and 9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowNameOf, duplicateRows, duplicateAsk, duplicateAnswer, DUP_ADD_ANYWAY, DUP_LEAVE } from "../../../builder/site-add.mjs";

const NAME = "Group lessons (beginners and improvers)";

test("the add-on asks before anything is charged or written", () => {
  const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
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

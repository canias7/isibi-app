// PARKED (2026-11-03, park-old-way): the old-way half of test/run6-fixes.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Run 6's root causes (2026-10-25, driftwood-and-daughters-5, 21:11–21:35 UTC),
// fixed in code. Supplied answers only: no model call, no network, no write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Namespace imports, so each case fails on its own against code without the fix (the red check).
import * as AE from "../../../builder/addon-existing.mjs";
import * as RQ from "../../../builder/request.mjs";
import * as HO from "../../../builder/hand-over.mjs";
import { wordsIn } from "../../../builder/route-shared.mjs";
import * as SA from "../../../builder/site-add.mjs";
import { addonReplyFacts, editReplyFacts } from "../../../builder/site-reply.mjs";
import * as SR from "../../../builder/site-rules.mjs";
const { accessShortfalls, accessHandTo, readHandTo } = AE;
const { newRequest, planParts, carveParts, handCarved, jobBody, readRun } = RQ;
const { heldReport } = HO;
const { rowRequired, liveRequired, requiredColumns, LIVE_REQUIRED_SQL, rowWriteOutcome } = SA;
const { runRulesEdit, splitAlready } = SR;

const worker = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a);
  assert.ok(i >= 0, "landmark missing: " + a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, "landmark missing: " + b);
  return src.slice(i, j);
};

// ── 1. an unmet need on an existing table goes to the rules step ─────────────
const MSG = "Add a Lessons page with group lessons, each bookable online with date, time and number of people, and a switch so I can mark a day closed for bad weather and no one can book it.";
const TABLES = [
  { name: "lesson_bookings", access: "collect", read: "none", write: "none", columns: [{ name: "id" }, { name: "name", notnull: true }] },
  { name: "closed_days", access: "display", columns: [{ name: "id" }, { name: "day" }] },
  { name: "lessons", access: "display", columns: [{ name: "id" }] },
];
// The live run's own two requirements (edit_jobs b133151c…, `requirements`).
const REQ = [
  { id: "component#1", status: "covered", need: "A lessons list", words: "group lessons" },
  { id: "component#3", status: "unsupported", need: "A visitor’s lesson booking is actually saved", why: "lesson_bookings is not open for visitors to write, so the form cannot store a booking until that table accepts public submissions.", words: "each bookable online with date, time and number of people" },
  { id: "component#4", status: "unsupported", need: "Closing a day for bad weather is actually saved", why: "closed_days can be shown but not written, so the bad-weather switch cannot store a closed day until that table accepts the owner’s update.", words: "a switch so I can mark a day closed for bad weather and no one can book it" },
];

test("the worker hands the shortfalls on at the success ending, through the held report", () => {
  const block = between(worker, "A LEVEL THE ADDITION NEEDED ON A TABLE IT CANNOT MOVE", "return Response.json({");
  assert.match(block, /accessHandTo\(accessShortfalls\(aSpec, aAccessDesigned\), aReq, aInstruction, wordsIn, aSpec\)/);
  assert.match(block, /aHeldOut\.parts\.push\(h\.words\)/);
  assert.match(worker, /aHeldOut\.parts, aHeldOut\.earlier, aHeldOut\.handTo\), \{/);
});

test("the worker reads the live columns on the owner connection before cleanAdd, and says Postgres's column", () => {
  const block = between(worker, "const aRowLists = adb ? rowTables(aSpec) : new Map();", "const aRowKey");
  assert.match(block, /requiredColumns\(\(q, p\) => sqlQuery\(adb, q, p\), aSpec, aRowLists\)/);
  assert.deepEqual(rowWriteOutcome({ code: "23502", column: "level" }), { outcome: "refused", code: "23502", column: "level" });
  assert.deepEqual(rowWriteOutcome({ code: "23502", column: "bad name;" }), { outcome: "refused", code: "23502" });
  assert.match(worker, /column: thrown\.column \|\| undefined,/);
});

// ── 4. rules: already so is done at no cost; a no-match is never billed ──────
const said = (input) => ({ content: [{ type: "tool_use", name: "write_table_rules", input }], usage: { input_tokens: 100, output_tokens: 10 } });
const RT = [{ name: "bookings", access: "collect", columns: [{ name: "id" }, { name: "name" }] }];

test("the rules route answers satisfied at cost 0 and never bills a no-match", () => {
  const block = between(worker, "const rOut = await runRulesEdit({", 'if (eLayer === "rename")');
  assert.match(block, /rOut\.ok && rOut\.satisfied === true[\s\S]{0,400}cost: 0/);
  assert.match(block, /rOut\.reason === "no-match" \? 0 : await eCharge\(rOut\.usage\)/);
});

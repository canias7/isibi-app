// PARKED (2026-11-03, park-old-way): the old-way half of test/feature-verify-exercise.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The check's two follow-ups (2026-10-25, feature-verify, both approved by the
// owner): one more round for a need found missing, and features exercised —
// a form filled and submitted with its request aborted, a table's rules tried
// with writes that are always rolled back. Supplied answers and stubs only: no
// model call, no network, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { verifyNeed, routeCode, renderedSubmits } from "../../../builder/requirement-verify.mjs";
import { ruleProbes, exerciseTable, exerciseTables, interceptedWrite, checkValues, testValue } from "../../../builder/requirement-exercise.mjs";
import { exerciseForms } from "../../../builder/render-check.mjs";
import { fillProbe, renderReport } from "../../../builder/site-render.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const at = (src, s, from = 0) => { const i = src.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };

const spec = { tables: [{ name: "lesson_bookings", columns: [{ name: "date" }, { name: "time" }, { name: "people", type: "integer" }], checks: [["people", "lte", "8"]], unique: [["date", "time"]] }] };
const PAGE = 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/lessons")({ component: Lessons });\nfunction Lessons() {\n  return <main><h1>Lessons</h1></main>;\n}\n';
const pages = [{ path: "lessons.tsx", source: PAGE }];
const siteOf = (pg) => ({ pages: routeCode(pg.map((p) => ({ ...p, routes: ["/lessons"] }))), drawn: new Set(["/lessons"]), forms: new Map(), spec });
const needs = [{ need: "Each lesson can be booked online", carriers: ["page:/lessons", "table:lesson_bookings"] }];
const MEND = { old: "<h1>Lessons</h1>", new: "<h1>Lessons</h1><BookForm />" };
const ADDED = '\nfunction BookForm() {\n  const book = useCreateRow("lesson_bookings");\n  return <form><input name="date" /><input name="time" /><input name="people" /></form>;\n}\n';
const reply = (edits) => ({ content: [{ type: "tool_use", id: "t1", name: "write_tweak", input: { edits } }], usage: { input_tokens: 100, output_tokens: 50 } });
const compileOk = async (pg) => ({ ok: true, files: [{ path: "x" }], render: { ok: true } });

test("the worker runs the round before publish, ships its compile, and charges it once on its own reserve", () => {
  const round = at(W, "aReqRetry = await requirementRetryRound({");
  assert.ok(round > at(W, "aRepairRound = await addRepairRound({"), "after the repair round");
  at(W, "needs: judgedNeeds(aReq)", round);
  at(W, "aReqRetry.charged = Number(await aCharge(pageCredits(...aReqRetry.usage), 7)) || 0;", round);
  at(W, "const aSwap = aReqRetry && aReqRetry.built ? { built: aReqRetry.built, pages: aReqRetry.pages }", round);
  at(W, "...aRepairUsage, ...aLangUsage, ...aRetryUsage, aPhotoBill, aPickUsage));");
  at(W, "+ aLangCharged + aPhotoCharged + aRetryCharged;");
  at(W, "const aRetryCharged = Number(aReqRetry && aReqRetry.charged) || 0;");
  at(W, "const aShippedPages2 = aReqRetry && aReqRetry.built ? aReqRetry.pages");
  assert.equal((W.match(/aCharge\([^;]*, 7\)/g) || []).length, 1, "reserve #7 is placed in one place");
});

test("the worker exercises rules only through the rolled-back rehearsal, only on the applied live schema", () => {
  const ex = at(W, "exercised: adb && !(aWriter && aWriter.holding)");
  at(W, "rehearse: (sql, params) => sqlRehearse(adb, sql, params)", ex);
  const src = readFileSync(new URL("../../../builder/requirement-exercise.mjs", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!/sqlQuery|sqlExec|COMMIT/.test(src), "no other way to write");
});

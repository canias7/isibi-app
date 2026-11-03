// PARKED (2026-11-03, park-old-way): the old-way half of test/feature-verify-exercise.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The check's two follow-ups (2026-10-25, feature-verify, both approved by the
// owner): one more round for a need found missing, and features exercised —
// a form filled and submitted with its request aborted, a table's rules tried
// with writes that are always rolled back. Supplied answers and stubs only: no
// model call, no network, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requirementRetryRound, retryBrief, judgedNeeds } from "../builder/requirement-retry.mjs";
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

test("no retry when nothing is missing, and none for what one page pass cannot mend", async () => {
  let sent = 0;
  const send = async () => { sent++; return reply([MEND]); };
  const fine = { pages: new Map([["/lessons", 'useCreateRow("lesson_bookings")']]), drawn: new Set(["/lessons"]), spec };
  const r = await requirementRetryRound({ needs, site: fine, pages, siteOf, send, compile: compileOk });
  assert.equal(r.ran, false); assert.equal(r.why, "nothing-missing"); assert.equal(sent, 0);
  const noTable = await requirementRetryRound({ needs: [{ need: "Hire", carriers: ["page:/lessons", "table:hire"] }], site: siteOf(pages), pages, siteOf, send, compile: compileOk });
  assert.equal(noTable.why, "unmendable"); assert.deepEqual(noTable.still, ["Hire"]); assert.equal(sent, 0);
  assert.equal((await requirementRetryRound({ needs, site: siteOf(pages), pages, siteOf, send, compile: compileOk, room: false })).why, "time");
  // A join gap beside a gap no page pass can mend, or a page with no file of its own: not retried.
  const mixed = await requirementRetryRound({ needs: [{ need: "Priced booking", carriers: ["page:/lessons", "table:lesson_bookings", "table:lesson_bookings.price"] }], site: siteOf(pages), pages, siteOf, send, compile: compileOk });
  assert.equal(mixed.why, "unmendable");
  const noFile = await requirementRetryRound({ needs, site: siteOf(pages), pages: [{ path: "home.tsx", source: PAGE }], siteOf, send, compile: compileOk });
  assert.equal(noFile.why, "unmendable");
  assert.equal(sent, 0);
});

test("missing, retried once with the gap as the reason, then present", async () => {
  const seen = [];
  const send = async (req) => { seen.push(JSON.stringify(req)); return reply([{ old: MEND.old, new: MEND.new }, { old: "function Lessons() {", new: ADDED.trim() + "\nfunction Lessons() {" }]); };
  const r = await requirementRetryRound({ needs, site: siteOf(pages), pages, siteOf, send, compile: compileOk });
  assert.equal(seen.length, 1, "one call, one round");
  assert.match(seen[0], /\/lessons does not read or save lesson_bookings/);
  assert.match(seen[0], /useCreateRow/);
  assert.equal(r.ran, true, JSON.stringify(r));
  assert.deepEqual(r.mended, ["Each lesson can be booked online"], JSON.stringify(r));
  assert.deepEqual(r.still, []);
  assert.ok(r.built && r.pages[0].source.includes('useCreateRow("lesson_bookings")'));
  assert.equal(r.usage.length, 1, "its usage is kept for the one charge");
  assert.equal(verifyNeed(needs[0].carriers, siteOf(r.pages)).state, "present");
});

test("missing, retried, still missing: told not done, never a second round", async () => {
  let sent = 0;
  const send = async () => { sent++; return reply([{ old: "<h1>Lessons</h1>", new: "<h1>Lessons</h1><hr />" }]); };
  const r = await requirementRetryRound({ needs, site: siteOf(pages), pages, siteOf, send, compile: compileOk });
  assert.equal(sent, 1);
  assert.deepEqual(r.still, ["Each lesson can be booked online"]);
  assert.deepEqual(r.mended, []);
  // A refused tweak or a failed compile is still missing, and ships nothing new.
  const refused = await requirementRetryRound({ needs, site: siteOf(pages), pages, siteOf, send: async () => reply([]), compile: compileOk });
  assert.equal(refused.why, "refused"); assert.equal(refused.built, null); assert.deepEqual(refused.still, ["Each lesson can be booked online"]);
  const broke = await requirementRetryRound({ needs, site: siteOf(pages), pages, siteOf, send: async () => reply([MEND]), compile: async () => ({ ok: false }) });
  assert.equal(broke.why, "compile"); assert.equal(broke.built, null);
  assert.deepEqual(judgedNeeds([{ need: " x ", judged: { carried: "yes", by: ["page:/a"] } }, { need: "y", judged: { carried: "unsure", by: ["page:/a"] } }]), [{ need: "x", carriers: ["page:/a"] }]);
  assert.equal(retryBrief(needs, siteOf(pages), pages).work[0].route, "/lessons");
});

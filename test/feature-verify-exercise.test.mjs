// The check's two follow-ups (2026-10-25, feature-verify, both approved by the
// owner): one more round for a need found missing, and features exercised —
// a form filled and submitted with its request aborted, a table's rules tried
// with writes that are always rolled back. Supplied answers and stubs only: no
// model call, no network, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requirementRetryRound, retryBrief, judgedNeeds } from "../builder/requirement-retry.mjs";
import { verifyNeed, routeCode, renderedSubmits } from "../builder/requirement-verify.mjs";
import { ruleProbes, exerciseTable, exerciseTables, interceptedWrite, checkValues, testValue } from "../builder/requirement-exercise.mjs";
import { exerciseForms } from "../builder/render-check.mjs";
import { fillProbe, renderReport } from "../builder/site-render.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
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

test("a table's rules: a plain row, the value that passes and the one that breaks each, tried and always rolled back", async () => {
  const probes = ruleProbes(spec.tables[0]);
  assert.equal(probes[0].rule, "row");
  assert.deepEqual(probes.map((p) => [p.rule, p.expect, p.value]), [["row", "pass", undefined], ["checks", "pass", 8], ["checks", "refuse", 9], ["unique", "refuse", undefined]]);
  assert.ok(probes.every((p) => /^INSERT INTO "lesson_bookings"/.test(p.sql) && !/verify-test|9/.test(p.sql)), "values are parameters");
  assert.deepEqual(checkValues("gt", 0), { pass: 1, fail: 0 });
  assert.equal(testValue("integer"), 1);
  // Enforced: refused with Postgres's own codes.
  const calls = [];
  const enforced = async (sql, params) => { calls.push(params); if (params.includes(9)) return { ok: false, code: "23514" }; if (sql.includes("), (")) return { ok: false, code: "23505" }; return { ok: true }; };
  const r = await exerciseTable(spec.tables[0], { rehearse: enforced });
  assert.equal(r.ran, true);
  assert.deepEqual(r.results.map((x) => [x.rule, x.outcome]), [["checks", "refused"], ["unique", "refused"]]);
  // Not enforced: accepted is a finding.
  const lax = await exerciseTable(spec.tables[0], { rehearse: async () => ({ ok: true }) });
  assert.deepEqual(lax.results.map((x) => x.outcome), ["accepted", "accepted"]);
  // Unreachable or a plain row refused: nothing judged, the declared facts stand.
  assert.equal((await exerciseTable(spec.tables[0], { rehearse: async () => { throw new Error("down"); } })).why, "unreachable");
  assert.equal((await exerciseTable(spec.tables[0], { rehearse: async () => new Promise(() => {}), timeoutMs: 20 })).why, "unreachable");
  assert.equal((await exerciseTable(spec.tables[0], { rehearse: async () => ({ ok: false, code: "23502" }) })).why, "plain-row-refused");
  // A refusal that is not Postgres judging the rule (a dropped connection) proves nothing.
  const flaky = await exerciseTable(spec.tables[0], { rehearse: async (sql, params) => (params.includes(9) ? { ok: false, code: "08006" } : { ok: true }) });
  assert.equal(flaky.results[0].outcome, "unrun");
  assert.equal((await exerciseTables(spec, ["lesson_bookings", "nope"], { rehearse: enforced })).size, 1);
  // Into the check: a refused write is evidence; an accepted one is a gap where the need rests on that rule.
  const site = { pages: new Map(), spec, exercised: new Map([["lesson_bookings", r]]) };
  const v = verifyNeed(["table:lesson_bookings:checks"], site);
  assert.equal(v.state, "present");
  assert.ok(v.evidence.includes("a test write with people = 9 was refused by lesson_bookings (rolled back, nothing kept)"), JSON.stringify(v.evidence));
  const bad = verifyNeed(["table:lesson_bookings:checks"], { ...site, exercised: new Map([["lesson_bookings", lax]]) });
  assert.equal(bad.state, "missing");
  assert.ok(bad.gaps[0].startsWith("a test write with people = 9 was accepted by lesson_bookings"), JSON.stringify(bad.gaps));
});

test("the worker exercises rules only through the rolled-back rehearsal, only on the applied live schema", () => {
  const ex = at(W, "exercised: adb && !(aWriter && aWriter.holding)");
  at(W, "rehearse: (sql, params) => sqlRehearse(adb, sql, params)", ex);
  const src = readFileSync(new URL("../builder/requirement-exercise.mjs", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!/sqlQuery|sqlExec|COMMIT/.test(src), "no other way to write");
});

test("a form filled and submitted in the render check: its write recorded and aborted, nothing sent", async () => {
  assert.deepEqual(interceptedWrite("POST", "http://127.0.0.1:4000/api/db/shop-1/data/lesson_bookings", '{"date":"2030-01-15","people":2,"_challenge":"x"}'), { table: "lesson_bookings", fields: ["date", "people"] });
  assert.deepEqual(interceptedWrite("POST", "/api/db/s/data/rpc/book_lesson", "{}"), { rpc: "book_lesson", fields: [] });
  assert.equal(interceptedWrite("GET", "/api/db/s/data/lesson_bookings", ""), null);
  assert.equal(interceptedWrite("POST", "/api/other", "{}"), null);
  assert.ok(!/\bimport\b|require\(/.test(fillProbe.toString()));
  // A stand-in page: the form's submission fires a write through the interceptor.
  const log = [];
  let handler = null;
  const page = {
    route: async (glob, h) => { handler = h; },
    unroute: async () => { handler = null; },
    waitForTimeout: async () => {},
    evaluate: async (fn, arg) => {
      if (arg.index > 0) return false;
      const req = (method, url, body) => ({ request: () => ({ method: () => method, url: () => url, postData: () => body }), abort: async () => log.push("abort " + method), fallback: async () => log.push("fallback " + method) });
      await handler(req("GET", "http://x/assets/a.js", null));
      await handler(req("POST", "http://x/api/db/s/data/lesson_bookings", '{"date":"2030-01-15","time":"10:00","people":"2"}'));
      await handler(req("POST", "http://x/telemetry", "{}"));
      return true;
    },
  };
  const got = await exerciseForms(page, "/lessons", 2, 10);
  assert.deepEqual(got, [{ route: "/lessons", table: "lesson_bookings", fields: ["date", "time", "people"] }]);
  assert.deepEqual(log, ["fallback GET", "abort POST", "abort POST"], "every write aborted, reads untouched");
  assert.equal(handler, null, "the interceptor is removed");
  const rep = renderReport([], { submits: got });
  assert.deepEqual([...renderedSubmits(rep).entries()], [["/lessons", [{ table: "lesson_bookings", fields: ["date", "time", "people"] }]]]);
  // Into the check: the submission is evidence beside the wiring.
  const v = verifyNeed(["page:/lessons", "table:lesson_bookings"], { pages: new Map([["/lessons", 'useCreateRow("lesson_bookings")']]), drawn: new Set(["/lessons"]), spec, submits: renderedSubmits(rep) });
  assert.equal(v.state, "present");
  assert.ok(v.evidence.includes("filled in and submitted in a test, the form on /lessons sent date, time, people to lesson_bookings (stopped before anything was saved)"), JSON.stringify(v.evidence));
  const RC = readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  at(RC, "for (const s of await exerciseForms(page, route, Math.min(real, MAX_EXERCISED_FORMS))) submits.push(s);");
  at(RC, "...(submits.length ? { submits } : {}),");
});

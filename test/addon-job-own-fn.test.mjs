// A JOB THAT WRITES ITS OWN FUNCTION (owner, 2026-10-22, option B).
//
// Live, the job designer named a counting function nobody wrote and the job
// was refused `no-job-fn`. The job tool now carries an optional `function`,
// the same item a `function` answer is; the route cleans it with
// `cleanAdd("function")`, adds it to the addition's functions, and only then
// cleans the job. Driven through `POST /api/site/<slug>/addon` (no model, no
// container, no network: `fixtures/addon-route.mjs`).
import test from "node:test";
import assert from "node:assert/strict";
import { addon, storedAnswer } from "./fixtures/addon-route.mjs";
import { addTool, cleanAdd } from "../builder/site-add.mjs";

const OWN_FN = { name: "count_signups", internal: true, returns: "json", body: "SELECT '[]'::json" };
const JOB = { name: "weekly_count", fn: "count_signups", everyMinutes: 10080, at: "08:00" };
const sqlText = (r) => r.sql.map((q) => (typeof q === "string" ? q : JSON.stringify(q))).join("\n");

test("OWN 1 — a job answer that declares its own function lands both: the function created, the job registered", async () => {
  const r = await addon("fw-own-fn", "every Monday count last week's sign-ups", {
    kinds: ["job"], tz: "Europe/London",
    answers: { job: { job: [{ ...JOB, function: OWN_FN }] } },
  });
  assert.equal(r.body && r.body.ok, true, "the addition did not land: " + JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.registered.map((x) => x.name), ["weekly_count"], "the job was not registered");
  assert.match(sqlText(r), /count_signups/, "the job's own function was never created");
  const stored = r.meta();
  assert.ok((stored.functions || []).some((f) => f.name === "count_signups" && f.internal === true), "the function was not stored: " + JSON.stringify(stored.functions));
  assert.ok((stored.jobs || []).some((j) => j.name === "weekly_count" && j.fn === "count_signups"), "the job was not stored");
  assert.ok((r.body.kinds || []).includes("function"), "the reply does not list the function: " + JSON.stringify(r.body.kinds));
  assert.equal(r.body.invalidProps, undefined, "the job's own function was reported as an unknown property");
  // THE AUDIT SEES THE JOB WITH ITS FUNCTION: never reported as dropped whole.
  const rec = storedAnswer(r, "fw-own-fn");
  assert.ok(rec && rec.coverage, "control: no stored record was read");
  assert.deepEqual(rec.coverage.unbuilt, {}, "the job was audited without its own function: " + JSON.stringify(rec.coverage.unbuilt));
});

test("OWN 2 — a declared function that fails its cleaner refuses only that job, by name", async () => {
  const r = await addon("fw-own-fn-bad", "every Monday count sign-ups, and every night remind people", {
    kinds: ["function", "job"], tz: "Europe/London",
    answers: {
      function: { function: [{ name: "send_reminder", internal: true, returns: "json", body: "SELECT '[]'::json" }] },
      job: { job: [
        { ...JOB, function: { ...OWN_FN, internal: "yes" } },
        { name: "nightly_remind", fn: "send_reminder", everyMinutes: 1440, at: "21:00" },
      ] },
    },
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  const left = (r.body.notAdded || []).find((x) => x.kind === "job" && x.name === "weekly_count");
  assert.ok(left, "the refused job was not named: " + JSON.stringify(r.body.notAdded));
  assert.equal(left.why, "bad-internal", "not the function cleaner's own reason");
  assert.deepEqual(r.registered.map((x) => x.name), ["nightly_remind"], "the wrong jobs were registered");
  assert.doesNotMatch(sqlText(r), /count_signups/, "a refused function was created");
});

test("OWN 3 — a plain job naming a listed function is unchanged", async () => {
  const r = await addon("fw-own-fn-plain", "remind people the day before", {
    kinds: ["function", "job"], tz: "Europe/London",
    answers: {
      function: { function: [{ name: "send_reminder", internal: true, returns: "json", body: "SELECT '[]'::json" }] },
      job: { job: [{ name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" }] },
    },
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.registered.map((x) => x.name), ["daily_reminder"]);
  assert.deepEqual((r.meta().functions || []).filter((f) => f.name === "send_reminder").length, 1);
});

test("OWN 4 — the job tool offers the function in the function answer's shape, and the cleaner keeps it apart", () => {
  const tool = addTool("job");
  const s = JSON.stringify(tool);
  assert.match(s, /"function":\{/, "the job tool has no function field");
  const fn = addTool("function");
  const fnItem = JSON.stringify(fn).match(/"returns"/);
  assert.ok(fnItem, "control: the function tool was not read");
  const c = cleanAdd("job", [{ ...JOB, function: OWN_FN }], { functions: [], jobFns: [], jobs: [], tables: [] });
  assert.equal(c.ok, true);
  assert.equal(Object.hasOwn(c.value[0], "function"), false, "the declared function rode on the job item");
  assert.deepEqual(c.functions.map((f) => f.name), ["count_signups"]);
  // A NAME THE SITE ALREADY HAS is refused, never a silent replacement.
  const dup = cleanAdd("job", [{ ...JOB, function: OWN_FN }], { functions: ["count_signups"], jobFns: ["count_signups"], jobs: [], tables: [] });
  assert.deepEqual([dup.ok, dup.why], [false, "job-fn-exists"]);
});

/**
 * THE WORKFLOW EXECUTOR, and the routing that reaches it.
 *
 * Two halves, and they prove different things. The module cases drive
 * `automations.mjs` directly — the registry, the reader, the day arithmetic and every
 * branch of a run. The routing cases drive `makeRunner` with a fake claim that answers
 * `executor: "automation"`, because THE ROUTING IS A WIRING HOP and a wiring hop that
 * nothing drives is the defect this repository keeps paying for: the executor could be
 * perfect and unreached, and from outside that reads as an automation that does nothing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTOMATION_STEPS, STEP_TYPES, STEP_KINDS, STEP_OUTCOMES, STOP_REASONS, WEEKDAYS,
  MAX_WORKFLOW_STEPS, MAX_NOTE, defineStep, stepRegistry, readWorkflow, runWorkflow,
  localDate, weekdayOf, executionDay,
} from "../src/automations.mjs";
import { makeRunner, OUTCOMES } from "../src/runner.mjs";
import { makeAutomationStore } from "../src/automation-store.mjs";
import { defineAgent } from "../src/define.mjs";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS = path.join(import.meta.dirname, "..", "supabase", "migrations");
const MON = "2026-09-21";   // a Monday
const WED = "2026-09-16";   // a Wednesday

// ── the registry ────────────────────────────────────────────────────────────

test("every declared step is whole, and a half-declared one throws at import", () => {
  for (const s of AUTOMATION_STEPS) {
    assert.equal(s.kind, "step");
    assert.ok(STEP_KINDS.includes(s.stepKind), `${s.type} has a real kind`);
    assert.ok(s.label.trim() && s.does.trim(), `${s.type} has words a person can read`);
    assert.equal(typeof s.read, "function");
    assert.equal(typeof s.run, "function");
  }
  // EVERY PART IS COMPELLED, one at a time, so none of them is optional by accident.
  const whole = { type: "x", kind: "action", label: "X", does: "does x", read: () => ({ config: {} }), run: () => ({}) };
  for (const missing of Object.keys(whole)) {
    const spec = { ...whole };
    delete spec[missing];
    assert.throws(() => defineStep(spec), TypeError, `a step with no ${missing} is refused`);
  }
  assert.throws(() => defineStep({ ...whole, kind: "sometimes" }), TypeError, "an invented kind is refused");
});

test("the catalog's names are derived, and two steps cannot share one", () => {
  assert.deepEqual(STEP_TYPES, AUTOMATION_STEPS.map((s) => s.type));
  assert.deepEqual([...new Set(STEP_TYPES)], STEP_TYPES, "no duplicate types");
  const twice = [AUTOMATION_STEPS[0], AUTOMATION_STEPS[0]];
  assert.throws(() => stepRegistry(twice), TypeError);
  // THIS MILESTONE'S TWO, and one of each kind — which is what makes "a condition that
  // does not match is skipped" drivable at all.
  assert.deepEqual(STEP_TYPES, ["weekday", "note"]);
  const kinds = AUTOMATION_STEPS.map((s) => s.stepKind);
  assert.ok(kinds.includes("condition") && kinds.includes("action"));
});

test("⚠ the step cap is the column's own CHECK, read back out of the migration", () => {
  // A CHECK cannot read JavaScript and JavaScript cannot read SQL, so this number
  // exists twice. Reading it back is what turns a drift into a red run rather than into
  // a workflow the database silently refuses to store.
  const file = fs.readdirSync(MIGRATIONS).find((f) => f.includes("automations"));
  assert.ok(file, "the automations migration is there");
  const sql = fs.readFileSync(path.join(MIGRATIONS, file), "utf8");
  const m = /jsonb_array_length\(steps\)\s*<=\s*(\d+)/.exec(sql);
  assert.ok(m, "the migration bounds the steps array");
  assert.equal(Number(m[1]), MAX_WORKFLOW_STEPS);
});

// ── reading a workflow ──────────────────────────────────────────────────────

test("readWorkflow normalises, mints ids from the position, and refuses by name", () => {
  const ok = readWorkflow([{ type: "weekday", days: ["Mon", "sun", "mon"] }, { type: "note", text: "  hi  " }]);
  assert.deepEqual(ok.steps, [
    { id: "s1", type: "weekday", days: ["sun", "mon"] },   // the WEEK's order, not the ticking order
    { id: "s2", type: "note", text: "hi" },
  ]);
  // Saving one selection twice stores the same bytes both times.
  const again = readWorkflow([{ type: "weekday", days: ["mon", "sun"] }]);
  assert.deepEqual(again.steps[0].days, ["sun", "mon"]);

  assert.match(readWorkflow("mon").error, /have to arrive as a list/);
  assert.match(readWorkflow([{ type: "nope" }]).error, /no step called nope/);
  assert.match(readWorkflow([null]).error, /didn't arrive as a step/);
  assert.match(readWorkflow([{ type: "weekday", days: [] }]).error, /at least one day/);
  assert.match(readWorkflow([{ type: "weekday", days: ["funday"] }]).error, /no day called funday/);
  assert.match(readWorkflow([{ type: "note" }]).error, /what the note should say/);
  assert.match(readWorkflow([{ type: "note", text: "x".repeat(MAX_NOTE + 1) }]).error, /longer than one note/);
  // REFUSED, NEVER COERCED: `String(["mon"])` is `"mon"`.
  assert.match(readWorkflow([{ type: "weekday", days: [["mon"]] }]).error, /didn't arrive as a day/);
  // AND IT REFUSES RATHER THAN SHORTENING: a workflow quietly missing the step it could
  // not read is one that looks saved and does something else.
  const over = readWorkflow(Array.from({ length: MAX_WORKFLOW_STEPS + 1 }, () => ({ type: "note", text: "x" })));
  assert.match(over.error, new RegExp(String(MAX_WORKFLOW_STEPS)));
  assert.equal(over.steps, undefined);
  // A CALLER'S OWN id IS NOT KEPT — the position is the identity.
  assert.equal(readWorkflow([{ id: "mine", type: "note", text: "x" }]).steps[0].id, "s1");
});

// ── which day, and where ────────────────────────────────────────────────────

test("a bare date's weekday is read as UTC, and an impossible date is not a day", () => {
  assert.equal(weekdayOf(WED), "wed");
  assert.equal(weekdayOf(MON), "mon");
  assert.deepEqual(WEEKDAYS[new Date(Date.UTC(2026, 8, 20)).getUTCDay()], "sun");
  // `Date.UTC(2026, 1, 31)` ROLLS INTO MARCH rather than refusing, so the round trip is
  // what catches it.
  assert.equal(weekdayOf("2026-02-31"), null);
  assert.equal(weekdayOf("nope"), null);
  assert.equal(weekdayOf(null), null);
});

test("the local date comes from Intl, and the occurrence beats the clock", () => {
  // 03:00 UTC is still the previous day in New York.
  assert.equal(localDate(Date.parse("2026-09-16T03:00:00Z"), "America/New_York"), "2026-09-15");
  assert.equal(localDate(Date.parse("2026-09-16T03:00:00Z"), "UTC"), "2026-09-16");

  // ⚠ A CATCH-UP RUN ASKS ABOUT THE DAY IT WAS FOR. Without this, an execution for
  // Monday that runs at 00:30 on Tuesday would answer "not a Monday" and skip itself.
  const fromOcc = executionDay({ occurrence: MON, zone: "Europe/London", now: Date.parse("2026-09-22T00:30:00Z") });
  assert.deepEqual(fromOcc, { date: MON, weekday: "mon", zone: "Europe/London", from: "occurrence" });

  // A manual run has no occurrence, so it asks what day it is in the automation's zone.
  const manual = executionDay({ occurrence: null, zone: "America/New_York", now: Date.parse("2026-09-16T03:00:00Z") });
  assert.equal(manual.date, "2026-09-15");
  assert.equal(manual.from, "now");

  // NO ZONE MEANS UTC AND SAYS SO, rather than guessing where the Worker is.
  const nowhere = executionDay({ occurrence: null, zone: null, now: Date.parse("2026-09-16T03:00:00Z") });
  assert.deepEqual(nowhere, { date: WED, weekday: "wed", zone: "UTC", from: "now" });

  // A zone this runtime does not know falls back to UTC rather than throwing, because a
  // scheduler that dies on one bad row stops being a scheduler.
  assert.equal(executionDay({ occurrence: null, zone: "Nowhere/Fake", now: Date.parse("2026-09-16T03:00:00Z") }).date, WED);
});

// ── running one ─────────────────────────────────────────────────────────────

const flow = (raw) => readWorkflow(raw).steps;

test("a workflow with no condition runs and saves its note", async () => {
  const r = await runWorkflow({ steps: flow([{ type: "note", text: "all done" }]), occurrence: WED });
  assert.deepEqual(r.outcomes, [{ id: "s1", type: "note", outcome: "ran", result: "all done" }]);
  assert.equal(r.stop.reason, "done");
  assert.equal(r.stop.result, "all done");
  assert.equal(r.stop.on, WED);
  assert.ok(STOP_REASONS.includes(r.stop.reason));
});

test("⚠ a condition that does not match is SKIPPED, never FAILED — and so is everything after it", async () => {
  const steps = flow([{ type: "weekday", days: ["mon"] }, { type: "note", text: "Monday note" }]);

  const monday = await runWorkflow({ steps, occurrence: MON, zone: "Europe/London" });
  assert.deepEqual(monday.outcomes.map((o) => o.outcome), ["ran", "ran"]);
  assert.equal(monday.stop.reason, "done");
  assert.equal(monday.stop.result, "Monday note");

  const wednesday = await runWorkflow({ steps, occurrence: WED, zone: "Europe/London" });
  assert.deepEqual(wednesday.outcomes.map((o) => o.outcome), ["skipped", "skipped"]);
  assert.equal(wednesday.stop.reason, "skipped");
  assert.equal(wednesday.stop.at, "s1");
  // THE TWO SKIPS SAY DIFFERENT THINGS. One decided; the other never got its turn.
  assert.match(wednesday.outcomes[0].why, /Wednesday isn't one of the days/);
  assert.match(wednesday.outcomes[1].why, /an earlier condition didn't match/);
  assert.notEqual(wednesday.outcomes[0].why, wednesday.outcomes[1].why);
  // And nothing anywhere in it reads as a failure.
  assert.ok(!JSON.stringify(wednesday).includes("failed"));
  assert.equal(wednesday.stop.result, undefined);
});

test("every step gets an outcome, including the ones that never ran", async () => {
  const steps = flow([{ type: "weekday", days: ["mon"] }, { type: "note", text: "a" }, { type: "note", text: "b" }]);
  const r = await runWorkflow({ steps, occurrence: WED });
  // A LIST SHORTER THAN THE WORKFLOW would make the screen show a workflow that stops
  // for no stated reason.
  assert.equal(r.outcomes.length, steps.length);
  for (const o of r.outcomes) assert.ok(STEP_OUTCOMES.includes(o.outcome));
});

test("the LAST action's answer is the execution's result", async () => {
  const r = await runWorkflow({ steps: flow([{ type: "note", text: "first" }, { type: "note", text: "second" }]), occurrence: WED });
  assert.equal(r.stop.result, "second");
  assert.deepEqual(r.outcomes.map((o) => o.result), ["first", "second"]);
});

test("an empty workflow is a real workflow and answers nothing", async () => {
  const r = await runWorkflow({ steps: [], occurrence: WED });
  assert.deepEqual(r.outcomes, []);
  assert.equal(r.stop.reason, "done");
  assert.equal(r.stop.result, null);
});

test("a stored step this deployment no longer has FAILS rather than being skipped", async () => {
  // Skipping would quietly run a DIFFERENT workflow from the one somebody saved.
  const r = await runWorkflow({ steps: [{ id: "s1", type: "gone" }, { id: "s2", type: "note", text: "x" }], occurrence: WED });
  assert.equal(r.outcomes[0].outcome, "failed");
  assert.match(r.outcomes[0].error, /no step called gone/);
  assert.equal(r.outcomes[1].outcome, "skipped");
  assert.match(r.outcomes[1].why, /an earlier step didn't work/);
  assert.equal(r.stop.reason, "failed");
  assert.equal(r.stop.at, "s1");
});

test("⚠ the stored config is read AGAIN at run time, because it came from a database", async () => {
  const r = await runWorkflow({ steps: [{ id: "s1", type: "note" }], occurrence: WED });
  assert.equal(r.outcomes[0].outcome, "failed");
  assert.match(r.outcomes[0].error, /what the note should say/);
});

test("a step that throws becomes that step's outcome, and runWorkflow never throws", async () => {
  const boom = defineStep({
    type: "boom", kind: "action", label: "Boom", does: "throws",
    read: () => ({ config: {} }), run: () => { throw new Error("it broke"); },
  });
  const r = await runWorkflow({
    steps: [{ id: "s1", type: "boom" }, { id: "s2", type: "note", text: "x" }],
    registry: stepRegistry([boom, ...AUTOMATION_STEPS]), occurrence: WED,
  });
  assert.equal(r.outcomes[0].outcome, "failed");
  assert.equal(r.outcomes[0].error, "it broke");
  assert.equal(r.stop.reason, "failed");
  assert.equal(r.stop.error, "it broke");
});

test("the stop carries the day it asked about, so a skip can be explained later", async () => {
  const r = await runWorkflow({ steps: flow([{ type: "weekday", days: ["fri"] }]), occurrence: MON, zone: "Europe/London" });
  assert.equal(r.stop.on, MON);
  assert.equal(r.stop.weekday, "mon");
  assert.equal(r.stop.zone, "Europe/London");
});

// ── the routing ─────────────────────────────────────────────────────────────

/**
 * A runner with a fake claim, a fake automation store, and nothing else real.
 *
 * `send` throws: **if the routing ever fell through to the agent loop this would fail
 * loudly** rather than quietly answering `no-agent`, which is the wrong-looking-right
 * failure this fixture exists to make impossible.
 */
function routed({ executor = "automation", exec, finish, automations, attempts = 1 } = {}) {
  const events = [];
  const errors = [];
  const released = [];
  const work = {
    claim: async ({ runId, worker }) => ({
      claimed: true, runId, tenant: "t1", kind: "start", executor, attempts,
      token: "tok-1",
    }),
    beat: async () => true,
    release: async (r) => { released.push(r); return true; },
    accept: async () => ({}), requeue: async () => ({}), sweep: async () => [], append: async () => ({}),
  };
  const store = { forTenant: () => ({ open: async () => { throw new Error("the agent path was taken"); }, load: async () => ({}) }) };
  const runner = makeRunner({
    work, store,
    send: async () => { throw new Error("a model was called for an automation"); },
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "help" }) },
    automations: automations === null ? undefined : (automations ?? {
      read: async () => exec,
      finish: finish ?? (async () => ({ ok: true, stored: true, seq: 1, finished: true })),
    }),
    timer: { set: () => 1, clear: () => {} },
    onEvent: (e) => events.push(e),
    onError: (e) => errors.push(e),
  });
  return { runner, events, errors, released };
}

const EXEC = {
  runId: "r1", automationId: "c1", tenant: "t1", trigger: "manual",
  occurrence: null, steps: [{ id: "s1", type: "note", text: "hello" }], zone: null, finishedAt: null,
};

test("⚠ an automation delivery reaches the workflow and never the agent loop", async () => {
  const sent = [];
  const { runner, events } = routed({
    exec: EXEC,
    finish: async (a) => { sent.push(a); return { ok: true, stored: true, seq: 1, finished: true }; },
  });
  const out = await runner.deliver("r1");
  assert.equal(out.ran, true);
  assert.equal(out.why, "ran");
  assert.equal(out.stop.reason, "done");
  assert.equal(out.stop.result, "hello");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].token, "tok-1", "the claim's own token is presented");
  assert.deepEqual(sent[0].outcomes.map((o) => o.outcome), ["ran"]);
  assert.ok(events.some((e) => e.at === "done" && e.why === "ran"));
});

test("an agent delivery is untouched by the routing", async () => {
  // THE CONTROL. Without it, "automations are routed" is satisfied by a runner that
  // routes EVERYTHING to the workflow.
  const { runner } = routed({ executor: "agent", exec: EXEC });
  const out = await runner.deliver("r1");
  assert.equal(out.ran, false, "it took the agent path, which this fixture makes throw");
  assert.equal(out.why, "failed");
});

test("⚠ the finished transaction has already released, so the runner does not release again", async () => {
  const { runner, released } = routed({ exec: EXEC });
  await runner.deliver("r1");
  // A second release would clear a claim the database has already cleared — harmless
  // today and a lie in the log about who let go of what.
  assert.deepEqual(released, []);
});

test("a fenced refusal stops it, releases nothing, and names the reason", async () => {
  for (const why of ["no-work", "finished", "not-holder", "bad-token", "lease-expired"]) {
    const { runner, released } = routed({ exec: EXEC, finish: async () => ({ ok: false, why }) });
    const out = await runner.deliver("r1");
    assert.equal(out.why, "lease-lost", why);
    assert.equal(out.error, why, "the refusal's own name rides beside the outcome");
    assert.deepEqual(released, [], `${why} releases nothing`);
  }
});

test("a conflict is not a lost lease: it is released UNFINISHED for the next delivery", async () => {
  const { runner, released } = routed({ exec: EXEC, finish: async () => ({ ok: false, why: "conflict" }) });
  const out = await runner.deliver("r1");
  assert.equal(out.why, "conflict");
  assert.equal(released.length, 1);
  assert.equal(released[0].done, false);
});

test("an execution record that is gone, or unreadable, comes OFF the queue", async () => {
  for (const [name, exec] of [["no record", null], ["steps that are not a list", { ...EXEC, steps: null }]]) {
    const { runner, released } = routed({ exec });
    const out = await runner.deliver("r1");
    assert.equal(out.why, "unreadable", name);
    assert.equal(released[0].done, true, `${name}: another delivery cannot help`);
  }
});

test("a read that FAILED is retryable, and is released unfinished", async () => {
  // "Could not ask" and "there is nothing there" are opposite facts: one is our outage.
  const { runner, released, errors } = routed({
    automations: { read: async () => { throw new Error("the database went away"); }, finish: async () => ({}) },
  });
  const out = await runner.deliver("r1");
  assert.equal(out.why, "failed");
  assert.equal(released[0].done, false);
  assert.ok(errors.some((e) => e.at === "automation-read"));
});

test("a deployment with no automation executor says so rather than guessing", async () => {
  const { runner, released } = routed({ automations: null });
  const out = await runner.deliver("r1");
  assert.equal(out.why, "no-executor");
  assert.ok(OUTCOMES.includes("no-executor"), "and it is a named outcome");
  assert.equal(released[0].done, true, "another delivery cannot help; that needs a deployment");
});

test("the attempt ceiling covers automations too", async () => {
  const { runner } = routed({ exec: EXEC, attempts: 99 });
  const out = await runner.deliver("r1");
  assert.equal(out.why, "too-many-attempts");
});

// ── the store's own wire ────────────────────────────────────────────────────

test("⚠ the profile header is derived from the DIRECTION, not from the call site", async () => {
  const seen = [];
  const store = makeAutomationStore({
    url: "https://p.example", key: "k", schema: "agent",
    fetch: async (url, init) => {
      seen.push({ url, method: init.method, headers: init.headers });
      return { ok: true, status: 200, text: async () => JSON.stringify(url.includes("rpc/") ? { ok: true } : []) };
    },
  });
  await store.read("r1", "t1");
  await store.finish({ runId: "r1", worker: "w", token: "tok", outcomes: [], stop: { reason: "done" } });
  await store.tick({ catchupS: 60, limit: 2 });
  assert.equal(seen[0].headers["accept-profile"], "agent", "a read names the schema to accept");
  assert.equal(seen[0].headers["content-profile"], undefined);
  for (const w of seen.slice(1)) {
    assert.equal(w.headers["content-profile"], "agent", "a write names the schema it writes to");
    assert.equal(w.headers["accept-profile"], undefined);
  }
  // THE TENANT IS IN THE FILTER, as a second wall behind the claim.
  assert.match(seen[0].url, /tenant_id=eq\.t1/);
  assert.match(seen[0].url, /id=eq\.r1/);
});

test("the store refuses to be built, or called, without what it needs", () => {
  assert.throws(() => makeAutomationStore({}), TypeError);
  assert.throws(() => makeAutomationStore({ fetch: () => {}, url: "" }), TypeError);
  assert.throws(() => makeAutomationStore({ fetch: () => {}, url: "u" }), TypeError);
  const s = makeAutomationStore({ fetch: async () => ({ ok: true, status: 200, text: async () => "[]" }), url: "u", key: "k" });
  assert.rejects(() => s.read("", "t1"), TypeError);
  assert.rejects(() => s.read("r1", ""), TypeError);
});

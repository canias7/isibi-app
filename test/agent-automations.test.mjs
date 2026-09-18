/**
 * THE AUTOMATION ROUTES — ownership, the refusals, and what reaches the store.
 *
 * Every case drives `handleAgentApi` with a store that RECORDS, because what is at stake
 * is not the answer's shape but what went to the database: which tenant, which
 * automation, and which configuration. The answer shapes the fake gives are the ones the
 * real functions really give, taken from this migration's own driven output on a real
 * PostgreSQL rather than invented.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  handleAgentApi, AGENT_ROUTES,
  AUTOMATION_STEPS, AUTOMATION_STEP_TYPES, AUTOMATION_DAYS, AUTOMATION_SCHEDULES,
  AUTOMATION_STEP_KINDS, AUTOMATION_FIELD_KINDS,
  AUTOMATION_STATES, MAX_AUTOMATIONS, MAX_AUTOMATION_STEPS, MAX_STEP_NOTE, MAX_EXECUTIONS,
  cleanWorkflow, cleanSchedule, validTimeZone, automationRow, executionRow, makeAgentStore,
  // ── the workflow half: references, branches and what a run is asked for ────
  refsInText, branchShape, cleanInputs, cleanRunInput,
  MAX_AUTOMATION_INPUTS, INPUT_VALUE_MAX, MAX_APPROVAL_HOURS, MAX_WAIT_MINUTES,
  // ── typed values, and the loop that makes them load-bearing ────────────────
  AUTOMATION_VALUE_TYPES, AUTOMATION_TYPE_ACCEPTS, AUTOMATION_BLOCK_SHAPES,
  AUTOMATION_LOOP_MODES, MAX_LOOP_ITERATIONS, MAX_LOOP_DEPTH,
  // ── reference material and memory ──────────────────────────────────────────
  knowledgeRow, memoryRow, MAX_KNOWLEDGE, KNOWLEDGE_BODY_MAX, KNOWLEDGE_FORMATS,
  MAX_MEMORIES, MEMORY_VALUE_MAX, MEMORY_SOURCES,
} from "../agent-store.mjs";

const SRC = fs.readFileSync(path.join(import.meta.dirname, "..", "agent-store.mjs"), "utf8");
const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";
const A1 = "aaaaaaaa-1111-2222-3333-444444444444";
const C1 = "cccccccc-1111-2222-3333-444444444444";
const R1 = "dddddddd-1111-2222-3333-444444444444";
const K1 = "eeeeeeee-1111-2222-3333-444444444444";
const M1 = "ffffffff-1111-2222-3333-444444444444";

function fakeStore(over = {}) {
  const calls = [];
  const of = (name, answer) => async (...args) => { calls.push({ name, args }); return typeof answer === "function" ? answer(...args) : answer; };
  const base = {
    ownsAgent: of("ownsAgent", true),
    ownsAutomation: of("ownsAutomation", true),
    listAutomations: of("listAutomations", []),
    createAutomation: of("createAutomation", { ok: true, id: C1, next_run_at: null }),
    updateAutomation: of("updateAutomation", { ok: true, id: C1, next_run_at: null }),
    setAutomationEnabled: of("setAutomationEnabled", { id: C1, enabled: false }),
    removeAutomation: of("removeAutomation", true),
    runAutomation: of("runAutomation", { ok: true, repeat: false, run_id: R1, occurrence: null, trigger: "manual", state: "queued" }),
    executions: of("executions", []),
    // ⚠ THE FAKE HAS TO BE AS CAPABLE AS THE REAL STORE. `readAutomation` is what the run
    // route asks for the input DECLARATION, so a fake without it makes the route throw and
    // reports it as a save that failed — five correct cases came back 502 that way. A
    // fixture less capable than the thing it stands in for manufactures a defect.
    readAutomation: of("readAutomation", { id: C1, agentId: A1, name: "n", inputs: [], steps: [] }),
    decideApproval: of("decideApproval", { ok: true, repeat: false, verdict: "approved", step: "s1", queued: "queued" }),
    listKnowledge: of("listKnowledge", []),
    // ⚠ AS CAPABLE AS THE REAL STORE, AGAIN. `readKnowledge` is what a `source=` read asks
    // for — the one read that carries a document's material — and a fake without it throws
    // where the route is correct, which reads from outside as the feature being broken.
    readKnowledge: of("readKnowledge", { id: K1, title: "Price list", version: 1, body: "£95" }),
    countKnowledge: of("countKnowledge", 0),
    addKnowledge: of("addKnowledge", { source: { id: K1, title: "Price list", version: 1 } }),
    updateKnowledge: of("updateKnowledge", { id: K1, title: "Price list", version: 2 }),
    removeKnowledge: of("removeKnowledge", true),
    listMemory: of("listMemory", []),
    saveMemory: of("saveMemory", { id: M1, key: "tone", value: "formal", version: 1 }),
    removeMemory: of("removeMemory", true),
  };
  return { calls, store: { ...base, ...over } };
}

const WORKFLOW = [{ type: "weekday", days: ["mon"] }, { type: "note", text: "morning" }];
const call = (path, opts = {}) => handleAgentApi({
  path, method: AGENT_ROUTES[path], tenant: T1, newId: () => C1, ...opts,
});

// ── ownership ───────────────────────────────────────────────────────────────

test("every automation route is scoped by the tenant the handler was given", async () => {
  // A CENSUS over the automation routes, not a sample: each is driven and the tenant has
  // to reach the store. A route added later with no tenant fails by existing.
  const paths = Object.keys(AGENT_ROUTES).filter((p) => p.includes("automation"));
  assert.ok(paths.length >= 8, `the census is looking at only ${paths.length} routes`);
  for (const p of paths) {
    const f = fakeStore();
    // ONE BODY THAT SATISFIES EVERY ROUTE'S OWN REQUIRED FIELDS, so the census is about
    // the TENANT and never about which field a route happens to need. `run` and `verdict`
    // joined it when approvals did; a route added later with a field nobody sends fails
    // here on its own 400, which is the census telling you to add it rather than a pass.
    const r = await call(p, {
      store: f.store,
      query: new URLSearchParams({ agent: A1, id: C1 }),
      body: {
        id: C1, agent: A1, name: "N", enabled: true, schedule: "manual", steps: [],
        run: R1, step: "s1", verdict: "approved",
      },
    });
    assert.equal(r.status, 200, `${p} answered ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(f.calls.some((c) => c.args.some((a) => a === T1)), `${p} never handed the tenant to the store`);
    assert.ok(!JSON.stringify(f.calls).includes(T2), `${p} carried an account nobody sent`);
  }
});

test("an account that does not own the agent, or the automation, gets the same 404", async () => {
  const notMine = fakeStore({ ownsAgent: async () => false, ownsAutomation: async () => false });
  for (const [p, opts] of [
    ["/api/agent/automations", { query: new URLSearchParams({ agent: A1 }) }],
    ["/api/agent/automation-history", { query: new URLSearchParams({ id: C1 }) }],
  ]) {
    const r = await call(p, { store: notMine.store, ...opts });
    assert.equal(r.status, 404, p);
    // NOT FOUND, NEVER FORBIDDEN: "forbidden" tells a stranger the id they guessed is real.
    assert.match(r.body.error, /isn't here any more/);
  }
  // And the three the database answers for: a refusal from the transaction reads the same.
  const gone = fakeStore({
    createAutomation: async () => ({ ok: false, error: "no-agent" }),
    updateAutomation: async () => ({ ok: false, error: "no-automation" }),
    runAutomation: async () => ({ ok: false, error: "no-automation" }),
    removeAutomation: async () => false,
  });
  for (const [p, body] of [
    ["/api/agent/automation-create", { agent: A1, name: "N", steps: [] }],
    ["/api/agent/automation-update", { id: C1, name: "N", steps: [] }],
    ["/api/agent/automation-run", { id: C1 }],
    ["/api/agent/automation-delete", { id: C1 }],
  ]) {
    const r = await call(p, { store: gone.store, body });
    assert.equal(r.status, 404, p);
  }
});

test("the id is OURS — a body cannot choose an automation's or a run's primary key", async () => {
  const f = fakeStore();
  await call("/api/agent/automation-create", {
    store: f.store, newId: () => C1,
    body: { agent: A1, name: "N", steps: [], id: "theirs", runId: "theirs" },
  });
  const made = f.calls.find((c) => c.name === "createAutomation");
  assert.equal(made.args[1].id, C1);
  assert.ok(!JSON.stringify(made.args).includes("theirs"));

  const g = fakeStore();
  await call("/api/agent/automation-run", { store: g.store, newId: () => R1, body: { id: C1, runId: "theirs" } });
  const ran = g.calls.find((c) => c.name === "runAutomation");
  assert.equal(ran.args[1].runId, R1);
});

// ── the refusals, and that they write nothing ───────────────────────────────

test("⚠ a disabled automation and a paused agent are 409s with their own flag, not failures", async () => {
  for (const [error, flag, words] of [["disabled", "disabled", /turn it on/], ["paused", "paused", /paused/]]) {
    const f = fakeStore({ runAutomation: async () => ({ ok: false, error }) });
    const r = await call("/api/agent/automation-run", { store: f.store, body: { id: C1 } });
    // 409, NOT 404 AND NOT 500: the request was well formed, the automation exists and is
    // theirs, and nothing is broken.
    assert.equal(r.status, 409, error);
    assert.equal(r.body[flag], true, "the screen can offer the one thing that helps");
    assert.match(r.body.error, words);
    // AND THE RING NEVER HAPPENED — there is nothing on the queue to tell anybody about.
    assert.ok(!f.calls.some((c) => c.name === "ring"));
  }
});

test("a run rings the queue after the transaction, and a failed ring is said rather than raised", async () => {
  const rung = [];
  const f = fakeStore();
  const okr = await call("/api/agent/automation-run", { store: f.store, body: { id: C1 }, ring: async (id) => { rung.push(id); } });
  assert.deepEqual(rung, [R1], "the doorbell carries the run id the transaction answered");
  assert.equal(okr.body.notified, true);

  // A FAILED RING IS LATENCY, NEVER WORK. The row is committed by the time it runs, so
  // answering an error would tell somebody their automation failed when it will run.
  const g = fakeStore();
  const bad = await call("/api/agent/automation-run", {
    store: g.store, body: { id: C1 }, ring: async () => { throw new Error("the queue is away"); },
  });
  assert.equal(bad.status, 200);
  assert.equal(bad.body.notified, false);
  assert.equal(bad.body.runId, R1);
});

test("the toggle is its own narrow write and carries no configuration with it", async () => {
  const f = fakeStore();
  const r = await call("/api/agent/automation-enable", { store: f.store, body: { id: C1, enabled: false } });
  assert.equal(r.status, 200);
  const set = f.calls.find((c) => c.name === "setAutomationEnabled");
  assert.deepEqual(set.args, [T1, C1, false]);
  // REFUSED RATHER THAN COERCED. `Boolean("false")` is `true`, so a string out of a form
  // would turn "off" into "on" — the one direction that starts work nobody asked for.
  for (const bad of ["false", 0, null, undefined, "on"]) {
    const g = fakeStore();
    const no = await call("/api/agent/automation-enable", { store: g.store, body: { id: C1, enabled: bad } });
    assert.equal(no.status, 400, JSON.stringify(bad));
    assert.deepEqual(g.calls, [], "nothing was written for a refused toggle");
  }
});

test("a create refuses a non-boolean `enabled` rather than starting something", async () => {
  const f = fakeStore();
  const r = await call("/api/agent/automation-create", { store: f.store, body: { agent: A1, name: "N", steps: [], enabled: "false" } });
  assert.equal(r.status, 400);
  assert.deepEqual(f.calls, []);
  // ABSENT MEANS ON, which is what making one means.
  const g = fakeStore();
  await call("/api/agent/automation-create", { store: g.store, body: { agent: A1, name: "N", steps: [] } });
  assert.equal(g.calls.find((c) => c.name === "createAutomation").args[1].enabled, true);
});

test("the ceiling is the transaction's and the sentence is ours", async () => {
  const f = fakeStore({ createAutomation: async () => ({ ok: false, error: "too-many", held: MAX_AUTOMATIONS }) });
  const r = await call("/api/agent/automation-create", { store: f.store, body: { agent: A1, name: "N", steps: [] } });
  assert.equal(r.status, 409);
  assert.match(r.body.error, new RegExp(String(MAX_AUTOMATIONS)));
  // THE COUNT IS COUNTED WHERE THE INSERT HAPPENS, not here: a count in this process
  // would be a check-then-act with a second create able to fit between the two.
  assert.ok(!f.calls.some((c) => c.name === "count" || c.name === "listAutomations"),
    "the route counted in this process instead of letting the transaction do it");
});

test("the store hands the ceiling to the transaction, and profiles every write", async () => {
  const seen = [];
  const store = makeAgentStore({
    url: "https://db.example", key: "k",
    fetch: async (url, opts) => {
      seen.push({ url: String(url), method: opts.method, headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : undefined });
      const rpc = String(url).includes("rpc/");
      return { ok: true, status: 200, text: async () => JSON.stringify(rpc ? { ok: true, id: C1 } : []) };
    },
  });
  // ⚠ **EVERY OPERATION, NOT THE FIRST FOUR.** This drove create/list/enable/remove and
  // left `update`, `owns`, `run` and the HISTORY unread — and a sweep proved the gap
  // real: dropping the tenant filter from the history read survived. It is a census
  // now, asserted against the store's own key set, so an operation added next month
  // fails by existing rather than by being forgotten.
  await store.createAutomation(T1, { agentId: A1, id: C1, name: "N", enabled: true, schedule: "manual", at: null, zone: null, steps: [] });
  await store.updateAutomation(T1, { id: C1, name: "N", enabled: true, schedule: "manual", at: null, zone: null, steps: [] });
  await store.listAutomations(T1, A1);
  await store.ownsAutomation(T1, C1);
  await store.setAutomationEnabled(T1, C1, false);
  await store.runAutomation(T1, { automationId: C1, runId: R1 });
  await store.executions(T1, C1);
  await store.removeAutomation(T1, C1);
  const AUTOMATION_OPS = ["listAutomations", "ownsAutomation", "createAutomation", "updateAutomation",
    "setAutomationEnabled", "removeAutomation", "runAutomation", "executions"];
  for (const op of AUTOMATION_OPS) {
    assert.equal(typeof store[op], "function", `the store has no ${op}`);
  }
  assert.equal(seen.length, AUTOMATION_OPS.length,
    `${AUTOMATION_OPS.length} operations made ${seen.length} requests — one of them is unread`);
  // THE HISTORY IS A READ AND IT IS SCOPED TWICE: the route asks `ownsAutomation` first,
  // and the query filters on the tenant anyway. `service_role` bypasses row level
  // security, so the filter is the wall and the ownership check is the belt.
  const hist = seen.find((r) => r.url.includes("automation_history"));
  assert.ok(hist, "the history was never read");
  assert.match(hist.url, new RegExp(`tenant_id=eq\\.${T1}`), `the history is unscoped: ${hist.url}`);
  assert.match(hist.url, new RegExp(`automation_id=eq\\.${C1}`));
  const made = seen.find((r) => r.url.includes("rpc/create_automation"));
  assert.equal(made.body.p_max, MAX_AUTOMATIONS, "the ceiling goes to the function that does the insert");
  assert.equal(made.body.p_tenant, T1);
  // ⚠ THE PROFILE HEADER IS DERIVED FROM THE VERB. PostgREST IGNORES the read header on
  // a write, which is how a DELETE in this very module once resolved against `public`
  // and could never have worked.
  for (const r of seen) {
    const write = ["POST", "PATCH", "DELETE"].includes(r.method);
    assert.equal(r.headers[write ? "content-profile" : "accept-profile"], "agent", `${r.method} ${r.url}`);
    assert.equal(r.headers[write ? "accept-profile" : "content-profile"], undefined, `${r.method} ${r.url}`);
    // AND EVERY ONE CARRIES THE TENANT — in the FILTER for a statement, as an argument
    // for a transaction. That is the wall: `service_role` bypasses row level security.
    assert.ok(r.url.includes(`tenant_id=eq.${T1}`) || r.body?.p_tenant === T1, `${r.method} ${r.url} is unscoped`);
  }
});

test("⚠ an answer that is not an object is a FAILURE, never a refusal", async () => {
  // The two are opposite facts and the route says opposite things about them. A
  // transaction that answers `{ok:false, error:"disabled"}` is the account saying "not
  // now" — a 409. A transaction that answers an ARRAY, or `null`, or nothing at all, is
  // this store not understanding what came back — and reading that as `{ok:false}`
  // turns every wire fault into "that automation isn't here any more", which tells
  // somebody their automation is gone when the database is merely unreachable.
  const junkStore = (text) => makeAgentStore({
    url: "https://db.example", key: "k",
    fetch: async () => ({ ok: true, status: 200, text: async () => text }),
  });
  for (const text of ["[]", "null", '"done"', "7", ""]) {
    await assert.rejects(() => junkStore(text).runAutomation(T1, { automationId: C1, runId: R1 }),
      (e) => e instanceof Error, `an answer of ${JSON.stringify(text)} did not fail`);
    await assert.rejects(() => junkStore(text).createAutomation(T1,
      { agentId: A1, id: C1, name: "N", enabled: true, schedule: "manual", at: null, zone: null, steps: [] }),
      (e) => e instanceof Error, `a create answering ${JSON.stringify(text)} did not fail`);
  }
  // THE CONTROL: a real object comes back as itself, refusals included — so the
  // rejections above are about the SHAPE and not about the store refusing everything.
  const good = junkStore(JSON.stringify({ ok: false, error: "disabled" }));
  assert.deepEqual(await good.runAutomation(T1, { automationId: C1, runId: R1 }), { ok: false, error: "disabled" });
});

// ── what reaches the store ──────────────────────────────────────────────────

test("a create and an edit send the same configuration, normalised the same way", async () => {
  const f = fakeStore();
  await call("/api/agent/automation-create", {
    store: f.store,
    body: { agent: A1, name: "  Morning  ", schedule: "daily", at: "09:00", zone: "Europe/London", steps: WORKFLOW },
  });
  const made = f.calls.find((c) => c.name === "createAutomation").args[1];
  assert.equal(made.name, "Morning");
  assert.equal(made.at, "09:00:00", "seconds are ours, not the caller's");
  assert.equal(made.zone, "Europe/London");
  // `out: null` IS STORED RATHER THAN OMITTED, so one fact has one representation: a step
  // that binds nothing says so, instead of leaving a reader to tell an absent key from an
  // empty one. Re-anchored when steps gained the ability to name their answers.
  assert.deepEqual(made.steps, [
    { id: "s1", type: "weekday", days: ["mon"] },
    { id: "s2", type: "note", text: "morning", out: null },
  ]);
  assert.deepEqual(made.inputs, [], "an automation that asks for nothing says so");

  const g = fakeStore();
  await call("/api/agent/automation-update", {
    store: g.store,
    body: { id: C1, name: "Morning", schedule: "daily", at: "09:00", zone: "Europe/London", steps: WORKFLOW },
  });
  const edited = g.calls.find((c) => c.name === "updateAutomation").args[1];
  const { agentId, id, ...same } = made;
  void agentId; void id;
  assert.deepEqual({ ...edited, id: undefined }, { ...same, id: undefined },
    "a create and an edit must not normalise differently");
});

// ── the validators ──────────────────────────────────────────────────────────

test("cleanWorkflow refuses by name, mints ids from the position, and never shortens", () => {
  assert.deepEqual(cleanWorkflow([{ type: "weekday", days: ["Mon", "sun", "mon"] }]).steps,
    [{ id: "s1", type: "weekday", days: ["sun", "mon"] }]);
  // Saving one selection twice stores the same bytes both times.
  assert.deepEqual(cleanWorkflow([{ type: "weekday", days: ["mon", "sun"] }]).steps[0].days, ["sun", "mon"]);
  assert.match(cleanWorkflow("mon").error, /have to arrive as a list/);
  assert.match(cleanWorkflow([{ type: "nope" }]).error, /no step called nope/);
  assert.match(cleanWorkflow([null]).error, /didn't arrive as a step/);
  // ⚠ **THE BLANK-REQUIRED REFUSAL NAMES ITS POSITION AND SAYS WHAT TO WRITE.** This
  // asserted `text can't be empty` — the field's KEY, which nobody's screen calls
  // anything — and that sentence disagreed with the engine's on four steps. The sentence
  // is declared on the FIELD now and both validators read it, censused in
  // `test/agent-send.test.mjs`; what is asserted here is the PROPERTY (the step is named,
  // and the field's own words are used), not a spelling that lives in one place.
  const blank = cleanWorkflow([{ type: "note" }]).error;
  assert.match(blank, /^step 1: /, "a refusal that does not name the step leaves somebody counting rows");
  assert.match(blank, /say what the note should say/, "the field's own sentence is what the person gets");
  assert.match(cleanWorkflow([{ type: "note", text: "x".repeat(MAX_STEP_NOTE + 1) }]).error, /longer than it can be/);
  assert.match(cleanWorkflow([{ type: "weekday", days: [] }]).error, /at least one day/);
  assert.match(cleanWorkflow([{ type: "weekday", days: ["funday"] }]).error, /no day called funday/);
  // REFUSED, NEVER COERCED: `String(["mon"])` is `"mon"` and `String(["hi"])` is `"hi"`.
  assert.match(cleanWorkflow([{ type: "weekday", days: [["mon"]] }]).error, /didn't arrive as a day/);
  assert.match(cleanWorkflow([{ type: "note", text: ["hi"] }]).error, /didn't arrive as text/);
  const over = cleanWorkflow(Array.from({ length: MAX_AUTOMATION_STEPS + 1 }, () => ({ type: "note", text: "x" })));
  assert.match(over.error, new RegExp(String(MAX_AUTOMATION_STEPS)));
  assert.equal(over.steps, undefined, "it refuses rather than storing the ones it could read");
  // THE POSITION IS THE IDENTITY — a caller's own id is not kept.
  assert.equal(cleanWorkflow([{ id: "mine", type: "note", text: "x" }]).steps[0].id, "s1");
  // A FIELD KIND WITH NO RULE IS A REFUSAL, never a pass: it can only arrive from a
  // catalog entry somebody added without adding its rule.
  const odd = [{ type: "x", kind: "action", label: "X", does: "d", fields: [{ name: "k", kind: "invented" }] }];
  assert.match(cleanWorkflow([{ type: "x", k: "v" }], odd).error, /can't read/);
});

test("cleanSchedule keeps a schedule whole, and the zone belongs to the automation", () => {
  // ⚠ RE-ANCHORED, NOT APPEASED: the answer gained three trigger fields when weekly, one-off
  // and event triggers shipped, so a whole-object comparison moved. `days: []` rather than
  // `null` is the property worth keeping here — `agent.automations.days` is `not null default
  // '{}'` and its wholeness check compares with `'{}'`, so empty IS "not applicable" and a null
  // is a row the column refuses.
  assert.deepEqual(cleanSchedule({ schedule: "daily", at: "09:00", zone: "Europe/London" }),
    { schedule: "daily", at: "09:00:00", zone: "Europe/London", days: [], onDate: null, onEvent: null });
  // ⚠ A MANUAL AUTOMATION MAY HAVE A ZONE: a weekday condition asks which day it is
  // somewhere, and without this it would mean the day in UTC for every Run-now one.
  assert.deepEqual(cleanSchedule({ schedule: "manual", zone: "Europe/London" }),
    { schedule: "manual", at: null, zone: "Europe/London", days: [], onDate: null, onEvent: null });
  // A time with no schedule is a control somebody set that nothing reads.
  assert.equal(cleanSchedule({ schedule: "manual", at: "09:00" }).at, null);
  assert.match(cleanSchedule({ schedule: "daily", at: "9:00", zone: "UTC" }).error, /HH:MM/);
  assert.match(cleanSchedule({ schedule: "daily", at: "24:00", zone: "UTC" }).error, /HH:MM/);
  assert.match(cleanSchedule({ schedule: "daily", at: "09:00" }).error, /needs a time zone/);
  // ⚠ AND THIS EXPECTATION MOVED RATHER THAN BROKE: `weekly` is a real schedule now, so it is
  // no longer refused for not existing — it is refused for having no time, which is the honest
  // sentence. The unknown-schedule refusal is driven below on a name that really is not one.
  assert.match(cleanSchedule({ schedule: "weekly" }).error, /what time of day/);
  assert.match(cleanSchedule({ schedule: "hourly" }).error, /by hand, every day, on chosen days/);
  // AND THE TWO NEW SCHEDULES ARE WHOLE OR REFUSED, each by its own missing part.
  assert.match(cleanSchedule({ schedule: "weekly", at: "09:00", zone: "UTC" }).error, /at least one day/);
  assert.match(cleanSchedule({ schedule: "weekly", at: "09:00", zone: "UTC", days: ["mon", "funday"] }).error, /isn't a day/);
  assert.match(cleanSchedule({ schedule: "once", at: "09:00", zone: "UTC" }).error, /YYYY-MM-DD/);
  assert.match(cleanSchedule({ schedule: "once", at: "09:00", zone: "UTC", on_date: "2026-02-30" }).error, /isn't a day in the calendar/);
  assert.deepEqual(cleanSchedule({ schedule: "weekly", at: "09:00", zone: "UTC", days: ["fri", "mon"] }).days,
    ["mon", "fri"], "the stored day list takes the week's own order, not the ticking order");
  // AN EVENT IS A SECOND WAY IN RATHER THAN A FIFTH SCHEDULE, so a manual automation may have
  // one — "I can run this myself, and it runs itself when something happens".
  assert.equal(cleanSchedule({ schedule: "manual", on_event: "Order.Paid" }).onEvent, "order.paid");
  assert.match(cleanSchedule({ schedule: "manual", on_event: "Order Paid!" }).error, /lower-case letters/);
  assert.match(cleanSchedule({ zone: "Nowhere/Fake" }).error, /isn't a time zone/);
  // ASKED OF `Intl`, NEVER OF A LIST.
  assert.equal(validTimeZone("Europe/London"), "Europe/London");
  assert.equal(validTimeZone("Nowhere/Fake"), null);
  assert.equal(validTimeZone(["UTC"]), null, "refused, never coerced");
  assert.equal(validTimeZone(""), null);
  // EVERY SCHEDULE THE PLATFORM HAS IS READABLE, each given what it needs — derived from the
  // list, so one added next month is covered by existing.
  const enough = { weekly: { days: ["mon"] }, once: { on_date: "2099-01-01" } };
  for (const s of AUTOMATION_SCHEDULES) {
    const r = cleanSchedule({ schedule: s, at: "09:00", zone: "UTC", ...(enough[s] ?? {}) });
    assert.equal(r.schedule, s, `${s}: ${r.error ?? "no schedule came back"}`);
  }
});

// ── the readers ─────────────────────────────────────────────────────────────

test("automationRow fails closed on every field it cannot read", () => {
  // ⚠ RE-ANCHORED: `weekly` is a real schedule now, so it is no longer an unreadable one. The
  // property is that a schedule this deployment does not know fails CLOSED to `manual` — an
  // automation that runs by hand — rather than to something that runs on its own.
  const junk = automationRow({ id: 1, enabled: "true", schedule: "hourly", at_local: 9, steps: "x" });
  // BEING WRONG ABOUT `enabled` COSTS A PRESS OF THE TOGGLE ONE WAY, and an automation
  // running that somebody believes is stopped the other. It fails to OFF.
  assert.equal(junk.enabled, false);
  assert.equal(junk.schedule, "manual");
  assert.equal(junk.at, null);
  assert.deepEqual(junk.steps, []);
  assert.equal(junk.id, "");
  const real = automationRow({ id: C1, agent_id: A1, name: "N", enabled: true, schedule: "daily",
    at_local: "09:00:00", zone: "UTC", steps: [], next_run_at: "2026-09-17T08:00:00Z", updated_at: "x" });
  assert.equal(real.at, "09:00", "HH:MM:SS out of Postgres, HH:MM on screen");
  assert.equal(real.nextRunAt, "2026-09-17T08:00:00Z");
});

test("⚠ an execution's state comes off the run's stop, and cannot-tell is not `queued`", () => {
  const of = (run_status, run_stop, extra = {}) => executionRow({ id: R1, trigger: "manual", run_status, run_stop, ...extra });
  assert.equal(of("running", null).state, "queued");
  assert.equal(of("stopped", { reason: "done", result: "hi" }).state, "done");
  assert.equal(of("stopped", { reason: "skipped", why: "not today" }).state, "skipped");
  assert.equal(of("stopped", { reason: "failed", error: "boom" }).state, "failed");
  assert.equal(of("stopped", { reason: "missed", occurrences: 3 }, { missed: 3 }).state, "missed");
  assert.equal(of("stopped", { reason: "paused" }).state, "paused");
  // A STOPPED RUN WHOSE STOP CANNOT BE READ IS `failed`, NEVER `queued`. A row that says
  // it is queued for ever is the one state nobody can act on.
  assert.equal(of("stopped", null).state, "failed");
  assert.equal(of("stopped", { reason: "invented" }).state, "failed");
  assert.equal(of("stopped", "not an object").state, "failed");
  // AND A STOP CANNOT CLAIM TO BE `queued`, which is a state no stop has.
  assert.equal(of("stopped", { reason: "queued" }).state, "failed");
  // ONE OF THE THREE, NEVER TWO: an execution ended exactly one way.
  const done = of("stopped", { reason: "done", result: "hi", why: "x", error: "y" });
  assert.equal(done.result, "hi");
  assert.equal(done.why, null);
  assert.equal(done.error, null);
  for (const s of AUTOMATION_STATES) assert.equal(typeof s, "string");
  // ⚠ **HOW MANY STEPS FAILED AND WERE CARRIED PAST, and it is why `done` alone is not
  // "everything worked".** A step declaring `continue` keeps its own `failed` outcome and the
  // workflow runs on, so a finished execution can hold one — and a screen reading `done`
  // without this would report a success over a failure nobody looks at.
  assert.equal(of("stopped", { reason: "done", result: "hi", carried: 2 }).carried, 2);
  // ONLY ON `done`: every other state's reason already says what happened, and a count beside
  // it would invite drawing both.
  assert.equal(of("stopped", { reason: "failed", error: "boom", carried: 2 }).carried, 0);
  // REFUSED, NEVER COERCED — and absent is 0 rather than null, because "none" is a number a
  // screen can add up and cannot-tell is not.
  assert.equal(of("stopped", { reason: "done", result: "hi" }).carried, 0);
  assert.equal(of("stopped", { reason: "done", result: "hi", carried: "two" }).carried, 0);
  assert.equal(of("stopped", { reason: "done", result: "hi", carried: 1.5 }).carried, 0);
  assert.equal(of("stopped", { reason: "done", result: "hi", carried: -1 }).carried, 0);
});

// ── the shape of the surface ────────────────────────────────────────────────

test("the catalog is a positive list, and its names are derived from it", () => {
  assert.deepEqual(AUTOMATION_STEP_TYPES, AUTOMATION_STEPS.map((s) => s.type));
  assert.deepEqual([...new Set(AUTOMATION_STEP_TYPES)], AUTOMATION_STEP_TYPES);
  for (const s of AUTOMATION_STEPS) {
    assert.ok(s.label && s.does, `${s.type} has words a person can read`);
    // ⚠ RE-ANCHORED, NOT APPEASED, TWICE. The kinds were `["condition", "action"]` as a
    // literal — a list frozen by its contents, which is this repository's own trap and went
    // red on the first honest addition. And `fields.length` was required of every step,
    // which is false for a marker: `Otherwise` and `End` have nothing to configure, and the
    // honest rule is that an EMPTY list must be DECLARED rather than merely allowed.
    // ⚠ RE-ANCHORED A THIRD TIME, onto the declared list rather than a literal here — which
    // is what the note above asks for and what the first two re-anchors stopped short of.
    // The list is now a copy of the engine's and is censused against it, so an addition has
    // to reach both catalogs or fail a census instead of one inline array.
    assert.ok(AUTOMATION_STEP_KINDS.includes(s.kind), `${s.type} has a real kind`);
    for (const f of s.fields) {
      assert.ok(AUTOMATION_FIELD_KINDS.includes(f.kind), `${s.type}.${f.name} has a real field kind`);
    }
    assert.ok(Array.isArray(s.fields), `${s.type} says what it is configured with`);
    assert.equal(s.fields.length === 0, s.configless === true,
      `${s.type}: an empty field list has to be deliberate, and a declared one has to be empty`);
  }
  assert.deepEqual(AUTOMATION_DAYS, ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
});

test("the list read hands the catalog over with it, in one answer", () => {
  // ONE READ FOR THE SCREEN: the form is only reachable from the list, so a catalog
  // arriving separately would be a second thing to fail and a second state to draw.
  const f = fakeStore();
  return call("/api/agent/automations", { store: f.store, query: new URLSearchParams({ agent: A1 }) })
    .then((r) => {
      assert.deepEqual(r.body.steps, AUTOMATION_STEPS);
      assert.deepEqual(r.body.days, AUTOMATION_DAYS);
      assert.equal(r.body.max, MAX_AUTOMATIONS);
    });
});

test("⚠ the caps are the columns' own CHECK constraints, read back out of the migration", () => {
  const dir = path.join(import.meta.dirname, "..", "agent-builder", "supabase", "migrations");
  const file = fs.readdirSync(dir).find((f) => f.includes("automations"));
  assert.ok(file, "the automations migration is there");
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  // A cap here that is LOOSER than the column's turns a refusal we could phrase into a
  // Postgres error nobody can act on; one that is tighter is a feature nobody can use.
  const steps = /jsonb_array_length\(steps\)\s*<=\s*(\d+)/.exec(sql);
  assert.ok(steps, "the migration bounds the steps array");
  assert.equal(Number(steps[1]), MAX_AUTOMATION_STEPS);
  const name = /length\(btrim\(name\)\)\s*between\s*1\s*and\s*(\d+)/.exec(sql);
  assert.ok(name, "the migration bounds the name");
  assert.equal(Number(name[1]), 200);
  // AND THE DEFAULT CEILING THE CREATE FUNCTION CARRIES.
  assert.match(sql, new RegExp(`p_max\\s+integer\\s+default\\s+${MAX_AUTOMATIONS}`));
  assert.ok(MAX_EXECUTIONS > 0);
});

test("no automation route reads an account off the body or the query", () => {
  // The positive wall is the ownership case above. This is the census that stops a new
  // route reintroducing it: every `b.` and `q.get` read in the automation block has to
  // be one of the automation's own fields.
  const at = SRC.indexOf('if (path === "/api/agent/automations")');
  const end = SRC.indexOf('if (path === "/api/agent/import")', at);
  assert.ok(at > 0 && end > at, "the automation block's landmarks moved");
  const block = SRC.slice(at, end);
  const reads = [...block.matchAll(/\b[bq]\.(?:get\(")?([A-Za-z_]+)/g)].map((m) => m[1]);
  assert.ok(reads.length >= 6, `the scanner read nothing: ${reads.length}`);
  // ⚠ THE ALLOW-LIST GAINED THE NEW FIELDS RATHER THAN AN EXEMPTION, which is the point of
  // a census: every one of these is a field of the thing being acted on — a run and a step
  // to approve, a source's title and material, a memory's name and value — and NOT one of
  // them is an account, a tenant or an owner. The list growing is what a review reads.
  const allowed = new Set([
    "id", "agent", "name", "enabled", "steps", "schedule", "at", "zone", "hasOwn",
    "inputs", "input", "run", "step", "verdict", "note", "title", "body", "format", "key", "value", "source",
    // ⚠ GROWN AGAIN, BY TWO, and still not by an exemption. `tool` is WHICH TOOL of one agent
    // a revocation is about, checked against `AGENT_TOOLS` — the platform's own catalog, in
    // code — so it can name neither an account nor a capability the platform has not got.
    // `reason` is a person's own words about why they stopped a run. The four spellings this
    // census exists to forbid (`tenant`, `uid`, `owner`, `account`) are still not in it.
    "tool", "reason",
    // ⚠ GROWN ONCE MORE, BY ONE, and still not by an exemption. `event` is the name an
    // inbound endpoint EMITS, fixed at creation so a delivery cannot choose what it triggers,
    // and read through `AGENT_EVENT_RE` — the same shape the `on_event` trigger reads. **AND
    // `secret` IS DELIBERATELY NOT HERE AND MUST NEVER BE**: the route MINTS one, so there is
    // nowhere for a caller-chosen signing key to arrive.
    "event",
  ]);
  for (const r of reads) assert.ok(allowed.has(r), `an automation route reads ${r} off what somebody sent`);
  // THE OBSERVER, PROVED ALIVE: it can see the reads the block really makes.
  for (const seen of ["id", "agent", "enabled", "verdict", "title", "key"]) {
    assert.ok(reads.includes(seen), `the scan missed b.${seen}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RICHER WORKFLOWS: named inputs, references, branches, waits and approvals
// ════════════════════════════════════════════════════════════════════════════

test("⚠ a {{reference}} may only name something that EXISTS BY THEN", () => {
  // THE WHOLE POINT OF CHECKING IT AT SAVE TIME: a name nothing produces is a sentence on
  // somebody's form, where it can be fixed, rather than an execution that fails days later
  // having already charged for the steps above it.
  const ins = ["topic"];
  const good = cleanWorkflow([
    { type: "knowledge", query: "{{topic}}", out: "facts" },
    { type: "note", text: "about {{topic}}: {{facts}}" },
  ], AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, ins);
  assert.equal(good.error, undefined, good.error);
  // AND THE ANSWER SAYS WHAT IS AVAILABLE, so the form can offer it rather than guess.
  assert.deepEqual(good.produces, ["topic", "facts"]);

  const typo = cleanWorkflow([{ type: "note", text: "about {{topik}}" }], AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, ins);
  assert.match(typo.error, /step 1/);
  assert.match(typo.error, /"topik"/);

  // ⚠ A FORWARD REFERENCE IS REFUSED TOO, and for the same reason rather than a different
  // one: at the moment step 1 runs, nothing has produced `later`.
  const forward = cleanWorkflow([
    { type: "note", text: "{{later}}" },
    { type: "note", text: "hello", out: "later" },
  ], AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, ins);
  assert.match(forward.error, /step 1/);
  assert.match(forward.error, /"later"/);

  // AND A STEP CANNOT NAME ITS OWN ANSWER — the `out` is added after its own refs are read.
  const itself = cleanWorkflow([{ type: "note", text: "{{mine}}", out: "mine" }], AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, ins);
  assert.match(itself.error, /"mine"/);
});

test("a malformed reference is LEFT ALONE, and only a well-formed one is checked", () => {
  // Somebody has to be able to write about braces. `{{ }}` and `{{Topic}}` match the
  // braces and not the name rule, so they are text — where refusing them would make the
  // literal characters unwritable, and reading them as names would refuse a sentence.
  assert.deepEqual(refsInText("{{topic}} and {{ facts }}"), ["topic", "facts"]);
  assert.deepEqual(refsInText("{{ }} {{Topic}} {{a-b}} {{1st}}"), []);
  assert.deepEqual(refsInText("{{topic}} {{topic}}"), ["topic"], "a name is listed once");
  for (const junk of [null, undefined, 42, ["{{topic}}"], { t: 1 }]) {
    assert.deepEqual(refsInText(junk), [], `refsInText coerced ${JSON.stringify(junk)}`);
  }
  const ok = cleanWorkflow([{ type: "note", text: "type {{ }} for a blank" }], AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, []);
  assert.equal(ok.error, undefined, ok.error);
});

test("⚠ the branches have to balance, and the refusal says WHICH step", () => {
  const IF = { type: "if", left: "x", op: "is empty" };
  // THE SAME ALGORITHM THE ENGINE RUNS, driven over the shapes a form can really produce.
  assert.deepEqual(branchShape([IF, { type: "note", text: "a" }, { type: "end" }]), { ok: true });
  assert.deepEqual(branchShape([IF, { type: "otherwise" }, { type: "end" }]), { ok: true });
  // NESTED, because depth is what the algorithm is about and one level would not show it.
  assert.deepEqual(branchShape([IF, IF, { type: "end" }, { type: "otherwise" }, { type: "end" }]), { ok: true });
  // ⚠ AND THE SHAPE THAT SEPARATES DEPTH FROM POSITION: an `otherwise` reached while TWO
  // `if`s are open. In the line above the inner one is already CLOSED, so the innermost
  // and the outermost open entry are the same and a reader taking either passes —
  // measured, by a sweep mutant that took `open[0]` and survived it.
  assert.deepEqual(branchShape([IF, IF, { type: "otherwise" }, { type: "end" }, { type: "end" }]), { ok: true });
  // A SECOND `otherwise` ON THE INNER ONE IS REFUSED, which is what a reader taking the
  // OUTERMOST would let through — the inner if is the one that already has one.
  assert.match(branchShape([IF, IF, { type: "otherwise" }, { type: "otherwise" },
    { type: "end" }, { type: "end" }]).error, /step 4/);
  assert.deepEqual(branchShape([]), { ok: true }, "a workflow with no branch balances");

  // ⚠ BY POSITION, NEVER "SOMETHING IS WRONG": the step number is the only part of this a
  // person can act on, and it is the OPENING `if` that is named for an unclosed branch —
  // the end of the list is where the problem shows and not where it is.
  assert.match(branchShape([{ type: "note", text: "a" }, IF]).error, /step 2/);
  assert.match(branchShape([{ type: "otherwise" }]).error, /step 1/);
  assert.match(branchShape([{ type: "end" }]).error, /step 1/);
  assert.match(branchShape([IF, { type: "otherwise" }, { type: "otherwise" }, { type: "end" }]).error, /step 3/);
  // AND IT IS REFUSED BY `cleanWorkflow` ITSELF, not only by the helper — the structural
  // rule is the one thing in there that is not about a single step, so a version that read
  // every step correctly and never asked this would store a workflow nobody wrote.
  assert.match(cleanWorkflow([IF]).error, /step 1/);
});

test("⚠ a field that does not apply is not read and is not STORED", () => {
  // `when` is what decides, and the stakes are a value nothing will ever read being drawn
  // back into the form as though it mattered. A wait FOR a while has minutes; a wait UNTIL
  // a time has a time; neither carries the other's answer even when the caller sends both.
  const forAwhile = cleanWorkflow([{ type: "wait", mode: "for", minutes: 30, at: "09:00" }]);
  assert.equal(forAwhile.error, undefined, forAwhile.error);
  assert.deepEqual(forAwhile.steps[0], { id: "s1", type: "wait", mode: "for", minutes: 30 });

  const untilThen = cleanWorkflow([{ type: "wait", mode: "until", at: "09:00", minutes: 30 }]);
  assert.deepEqual(untilThen.steps[0], { id: "s1", type: "wait", mode: "until", at: "09:00" });

  // AND THE FIELD THAT DOES APPLY IS STILL REQUIRED: a wait with no answer at all is a
  // step that would never end, so it is refused rather than defaulted.
  assert.match(cleanWorkflow([{ type: "wait", mode: "until" }]).error, /step 1/);
});

test("every step field is REFUSED rather than coerced, one kind at a time", () => {
  // `String(["mon"])` is `"mon"` and `Boolean("false")` is `true`, so a coercing reader
  // stores a nested list as a day and a string as a yes. Each kind asks the type first.
  const cases = [
    [{ type: "approval", ask: ["yes"], hours: 1, on_timeout: "reject" }, /didn't arrive as text/],
    [{ type: "approval", ask: "ok?", hours: "24", on_timeout: "reject" }, /whole number/],
    [{ type: "approval", ask: "ok?", hours: 1.5, on_timeout: "reject" }, /whole number/],
    [{ type: "approval", ask: "ok?", hours: 0, on_timeout: "reject" }, /between/],
    [{ type: "approval", ask: "ok?", hours: MAX_APPROVAL_HOURS + 1, on_timeout: "reject" }, /between/],
    [{ type: "approval", ask: "ok?", hours: 1, on_timeout: "maybe" }, /one of/],
    [{ type: "wait", mode: "until", at: "9am" }, /24-hour clock/],
    [{ type: "wait", mode: "until", at: "24:00" }, /24-hour clock/],
    [{ type: "wait", mode: "for", minutes: MAX_WAIT_MINUTES + 1 }, /between/],
    [{ type: "memory", key: "a-b", out: "t" }, /can't be a name/],
    // RE-ANCHORED, NOT APPEASED: a lookup's answer MUST be named, and the sentence now says
    // WHY rather than naming the key — it is the field's own `empty`, read by both doors,
    // which is what closed 15 divergences between them. Still about the same refusal.
    [{ type: "memory", key: "tone" }, /give the answer a name, so a later step can use it/],
    // ⚠ AND THE REFUSAL NAMES IT AS THE FORM DOES. `out` is the one field whose KEY is not
    // a word on anybody's screen, so it carries its own `says`; every other field's name is
    // already the label, which is why this is a field's own word and not a table of labels.
    [{ type: "knowledge", query: "x" }, /give the answer a name, so a later step can use it/],
    [{ type: "weekday", days: [["mon"]] }, /didn't arrive as a day/],
    [{ type: "weekday", days: [] }, /at least one day/],
    [{ type: "note", text: "x", out: "my draft" }, /can't be a name/],
  ];
  for (const [step, words] of cases) {
    const r = cleanWorkflow([step]);
    assert.match(r.error ?? "(accepted)", words, JSON.stringify(step));
  }
  // ⚠ AND A NAME IS FOLDED RATHER THAN REFUSED, which is the opposite direction and is
  // what makes the rows above about the GRAMMAR. This guard's first draft expected `Tone`
  // to be turned away; it is stored as `tone`, the same fold `cleanInputs` and the memory
  // route apply — so `{{Tone}}` and `{{tone}}` cannot become two different values.
  const folded = cleanWorkflow([{ type: "memory", key: " Tone ", out: " Draft2 " }]);
  assert.equal(folded.error, undefined, folded.error);
  assert.deepEqual(folded.steps[0], { id: "s1", type: "memory", key: "tone", out: "draft2" });

  // AND AN HOUR AT EACH BOUND IS ACCEPTED, so the refusals above are about the type and
  // the range rather than about the field being unusable.
  for (const hours of [1, MAX_APPROVAL_HOURS]) {
    const r = cleanWorkflow([{ type: "approval", ask: "ok?", hours, on_timeout: "approve" }]);
    assert.equal(r.error, undefined, `${hours} hours: ${r.error}`);
  }
});

test("what an automation ASKS FOR is a declaration, and the name follows the one rule", () => {
  const good = cleanInputs([{ name: "Topic ", label: " What it is about ", required: true }]);
  // ⚠ RE-ANCHORED, NOT APPEASED: the declaration gained a `type`, and an input that does
  // not name one is `text` — which is what every input stored before it held, so nothing
  // moves. The shape is asserted WHOLE on purpose, so a field added next month is a red
  // run rather than something the form draws and nothing reads.
  assert.deepEqual(good.inputs, [{ name: "topic", label: "What it is about", required: true, default: "", type: "text" }]);
  // THE LABEL FALLS BACK TO THE NAME rather than to nothing: a box with no label beside it
  // is a box nobody can answer.
  assert.equal(cleanInputs([{ name: "topic" }]).inputs[0].label, "topic");
  assert.deepEqual(cleanInputs(undefined).inputs, [], "no inputs is a real answer");
  assert.match(cleanInputs([{ name: "a-b" }]).error, /can't be a name/);
  assert.match(cleanInputs([{ name: "" }]).error, /give it a name/);
  // TWO OF ONE NAME IS A REFERENCE NOBODY CAN RESOLVE — which of them?
  assert.match(cleanInputs([{ name: "topic" }, { name: "TOPIC" }]).error, /already something called/);
  // REFUSED, NEVER COERCED: `Boolean("false")` is true, so a coerced flag makes everything
  // required and the form starts refusing answers nobody has to give.
  assert.match(cleanInputs([{ name: "topic", required: "false" }]).error, /yes or no/);
  assert.match(cleanInputs("topic").error, /as a list/);
  assert.match(cleanInputs(Array.from({ length: MAX_AUTOMATION_INPUTS + 1 }, (_, i) => ({ name: `a${i}` }))).error,
    new RegExp(`${MAX_AUTOMATION_INPUTS}`));
});

test("⚠ the answers to a run are checked against the declaration, and a stray one is NAMED", () => {
  const decl = cleanInputs([{ name: "topic", label: "What it is about", required: true }]).inputs;
  assert.deepEqual(cleanRunInput({ topic: "boiler" }, decl).input, { topic: "boiler" });
  // NAMED, NEVER DROPPED. A filter on somebody's input is silent; a check is the only thing
  // that tells them the box they filled in went nowhere.
  assert.match(cleanRunInput({ nonsense: "x" }, decl).error, /"nonsense"/);
  assert.match(cleanRunInput({ topic: 7 }, decl).error, /as text/);
  assert.match(cleanRunInput({}, decl).error, /What it is about/);
  assert.match(cleanRunInput({ topic: "   " }, decl).error, /What it is about/, "blank is not an answer");
  // A DEFAULT SATISFIES A REQUIRED INPUT, which is what a default is for.
  const withDefault = cleanInputs([{ name: "topic", required: true, default: "anything" }]).inputs;
  assert.deepEqual(cleanRunInput({}, withDefault).input, {}, "the transaction fills it in, not this");
  assert.equal(cleanRunInput({}, withDefault).error, undefined);
  assert.match(cleanRunInput({ topic: "x".repeat(INPUT_VALUE_MAX + 1) }, decl).error, new RegExp(`${INPUT_VALUE_MAX}`));
  assert.match(cleanRunInput(["boiler"], decl).error, /as an object/);

  // ⚠ **EACH ANSWER IS READ AS ITS DECLARED TYPE**, which is what makes a loop's list a
  // list rather than a comma-separated string somebody has to split.
  const listDecl = cleanInputs([{ name: "names", label: "Who", required: true, type: "list" }]).inputs;
  assert.equal(listDecl[0].type, "list");
  assert.deepEqual(cleanRunInput({ names: ["ann", "bo"] }, listDecl).input, { names: ["ann", "bo"] });
  assert.match(cleanRunInput({ names: "ann,bo" }, listDecl).error, /didn't arrive as a list/);
  assert.match(cleanRunInput({ names: [1, 2] }, listDecl).error, /has to be text/);
  assert.match(cleanRunInput({ names: [] }, listDecl).error, /Who has to be filled in/, "an empty list is unanswered");
  // ⚠ A REQUIRED LIST CANNOT BE SATISFIED BY A DEFAULT, because a default is what the form
  // puts in a text box — reading `""` as a list would be a coercion of exactly the kind
  // this whole layer refuses.
  const listDefault = cleanInputs([{ name: "names", required: true, default: "ann", type: "list" }]).inputs;
  assert.match(cleanRunInput({}, listDefault).error, /has to be filled in/);
  // A NUMBER IS REFUSED, NEVER COERCED: `Number("")` is 0 and `Number("nine")` is NaN.
  const numDecl = cleanInputs([{ name: "howmany", required: true, type: "number" }]).inputs;
  assert.deepEqual(cleanRunInput({ howmany: 3 }, numDecl).input, { howmany: 3 });
  assert.match(cleanRunInput({ howmany: "3" }, numDecl).error, /didn't arrive as a number/);
  assert.match(cleanRunInput({ howmany: Infinity }, numDecl).error, /didn't arrive as a number/);
  // ...AND ZERO IS A REAL ANSWER, which is why emptiness is not asked of a number at all.
  assert.deepEqual(cleanRunInput({ howmany: 0 }, numDecl).input, { howmany: 0 });
  // A KIND NOBODY RECOGNISES IS A REFUSAL rather than a quiet fall back to text — a `list`
  // misspelt would store as text and the loop meaning to iterate it would be refused at
  // save time for a reason nobody could see on the form.
  assert.match(cleanInputs([{ name: "x", type: "lsit" }]).error, /isn't a kind of thing/);
  // AND A LIST LONGER THAN A LOOP CAN GO ROUND IS REFUSED HERE, not days later.
  const tooMany = Array.from({ length: MAX_LOOP_ITERATIONS + 1 }, (_, k) => `n${k}`);
  assert.match(cleanRunInput({ names: tooMany }, listDecl).error, new RegExp(`at most ${MAX_LOOP_ITERATIONS}`));
});

test("the catalog carries every step the engine has, and a `when` names a real sibling", () => {
  // THE CENSUS THAT MAKES THIS A COPY RATHER THAN A SECOND OPINION lives in
  // `test/agent-send.test.mjs`, the one file that may import both products. What is asked
  // here is that the copy is internally honest, which that census cannot see.
  assert.deepEqual(AUTOMATION_STEP_TYPES, AUTOMATION_STEPS.map((s) => s.type));
  assert.equal(new Set(AUTOMATION_STEP_TYPES).size, AUTOMATION_STEP_TYPES.length, "two steps of one type");
  for (const s of AUTOMATION_STEPS) {
    assert.ok(s.label && s.does, `${s.type} has no words for a person`);
    assert.ok(Array.isArray(s.fields), `${s.type} has no field list`);
    // A STEP WITH NO CONFIGURATION SAYS SO OUT LOUD, so an empty list is a decision rather
    // than a field somebody forgot — which is what the form reads to draw a bare row.
    if (!s.fields.length) assert.equal(s.configless, true, `${s.type} has no fields and does not say so`);
    const names = new Set(s.fields.map((f) => f.name));
    for (const f of s.fields) {
      if (f.kind === "choice") assert.ok(f.options?.length >= 2, `${s.type}.${f.name} offers nothing to choose`);
      if (!f.when) continue;
      // ⚠ A CONDITION ON A FIELD NOBODY ANSWERS IS A FIELD THAT NEVER APPLIES — it would
      // silently never be stored, which reads from outside exactly like a save that dropped it.
      for (const [on, allowed] of Object.entries(f.when)) {
        assert.ok(names.has(on), `${s.type}.${f.name} waits on ${on}, which is not one of its fields`);
        const opts = s.fields.find((x) => x.name === on)?.options ?? [];
        for (const v of allowed) assert.ok(opts.includes(v), `${s.type}.${f.name} waits on ${on}=${v}, which ${on} cannot be`);
      }
    }
  }
});

// ════════════════════════════════════════════════════════════════════════════
// WAITING, APPROVING, AND WHAT THE HISTORY SAYS
// ════════════════════════════════════════════════════════════════════════════

test("⚠ `waiting` is told from `queued` by the EXECUTION ROW, not by the run's status", () => {
  // A suspended execution has a `started` entry and no `stopped` one, so the run says
  // `running` — true, and useless. The difference between "about to be picked up" and
  // "waiting until Tuesday" is the whole of what somebody looking at it needs.
  const suspended = executionRow({
    id: R1, run_status: "running", position: 7, vars: { draft: "Dear customer" },
    waiting: { kind: "approval", step: "s8", ask: "Send this?", on_timeout: "reject" },
    wait_until: "2026-09-18T09:00:00Z",
  });
  assert.equal(suspended.state, "waiting");
  // ⚠ RE-ANCHORED: the projection gained `event`, which is `null` for every pause that is not
  // one. A fixed shape is the property — a field added to a stored pause must not reach a reader
  // nobody has written — so the comparison stays whole rather than becoming a subset.
  assert.deepEqual(suspended.waiting, {
    kind: "approval", step: "s8", ask: "Send this?", onTimeout: "reject", until: "2026-09-18T09:00:00Z",
    event: null,
  });
  assert.equal(suspended.position, 7);
  assert.deepEqual(suspended.values, { draft: "Dear customer" });
  // THE SAME ROW WITH NOTHING TO WAIT FOR IS `queued`, which is the control that makes the
  // line above about the pause rather than about the status.
  assert.equal(executionRow({ id: R1, run_status: "running" }).state, "queued");

  // ⚠ ONLY WHAT A SCREEN NEEDS: a field added to a stored pause must not reach a reader
  // nobody has written, so the projection is a fixed shape rather than the whole object.
  const extra = executionRow({ run_status: "running", waiting: { kind: "wait", step: "s2", secret: "x", mode: "for" } });
  assert.ok(!JSON.stringify(extra.waiting).includes("secret"));
  assert.equal(extra.waiting.kind, "wait");
  // ⚠ AND AN EVENT PAUSE IS ITS OWN KIND, which is what stops it being drawn as a timed wait
  // with no deadline: the projection used to read "approval or else wait", which was right while
  // those were the only two. It says WHICH event, because a screen that cannot say what is being
  // waited for is a screen that says a run is stuck.
  const onEvent = executionRow({
    run_status: "running",
    waiting: { kind: "event", step: "s3", name: "order.paid", since: "2026-09-18T01:00:00Z" },
  });
  assert.equal(onEvent.state, "waiting");
  assert.equal(onEvent.waiting.kind, "event");
  assert.equal(onEvent.waiting.event, "order.paid");
  assert.equal(onEvent.waiting.until, null, "an event wait has no deadline, and that is the point of it");
  // AND IT CARRIES NOTHING ELSE OF THE STORED PAUSE — `since` is the executor's own bookkeeping.
  assert.ok(!JSON.stringify(onEvent.waiting).includes("since"));
  // A TIMED WAIT STILL SAYS NO EVENT, which is the control that makes the line above about the
  // kind rather than about the field existing.
  assert.equal(executionRow({ run_status: "running", waiting: { kind: "wait", step: "s2" } }).waiting.event, null);

  // AND A PAUSE OF A KIND IT CANNOT READ IS A WAIT, never an approval: drawing an Approve
  // button for something no decision will ever be read from is a dead control that answers.
  assert.equal(executionRow({ run_status: "running", waiting: { kind: "nonsense", step: "s2" } }).waiting.kind, "wait");
  assert.equal(executionRow({ run_status: "running", waiting: { kind: "approval", step: "s8", on_timeout: "maybe" } })
    .waiting.onTimeout, null, "a timeout outcome this cannot read is not invented");
});

test("⚠ a REJECTED execution has a reason and deliberately NO result", () => {
  const r = executionRow({
    id: R1, run_status: "stopped",
    run_stop: { reason: "rejected", why: "somebody said no: wrong customer", result: "SENT: ..." },
  });
  assert.equal(r.state, "rejected");
  assert.match(r.why, /wrong customer/);
  // THE ONE THAT MATTERS: carrying the last note forward would make a refusal read like a
  // success in every reader that shows the result first.
  assert.equal(r.result, null);
  assert.equal(r.error, null);
  // AND THE CONTROL — the same shape, approved, really does carry its result.
  assert.equal(executionRow({ run_status: "stopped", run_stop: { reason: "done", result: "SENT: ..." } }).result, "SENT: ...");
  // `rejected` and `waiting` are in the word list; `queued` and `waiting` may never be
  // READ OUT of a stop, because a stopped run is not queued and is not waiting.
  assert.ok(AUTOMATION_STATES.includes("rejected") && AUTOMATION_STATES.includes("waiting"));
  for (const reason of ["queued", "waiting"]) {
    assert.equal(executionRow({ run_status: "stopped", run_stop: { reason } }).state, "failed", reason);
  }
});

test("an approval is answered by run AND step, and the two not-now refusals carry their own flag", async () => {
  const f = fakeStore();
  const good = await call("/api/agent/automation-approve", {
    store: f.store, ring: async () => {}, body: { run: R1, step: "s8", verdict: "approved", note: " looks right " },
  });
  assert.equal(good.status, 200);
  assert.equal(good.body.notified, true, "the doorbell is rung after the commit");
  const sent = f.calls.find((c) => c.name === "decideApproval");
  assert.equal(sent.args[0], T1);
  assert.deepEqual(sent.args[1], { runId: R1, step: "s8", verdict: "approved", note: "looks right" });

  // ⚠ TWO 409s, NEITHER A FAILURE AND NEITHER THE MISSING-RUN 404. The request was well
  // formed and nothing is broken, so the flag is what lets a screen offer the one thing
  // that helps rather than parsing our prose for it.
  for (const [error, flag] of [["finished", "finished"], ["not-waiting", "notWaiting"]]) {
    const g = fakeStore({ decideApproval: async () => ({ ok: false, error }) });
    const r = await call("/api/agent/automation-approve", { store: g.store, body: { run: R1, step: "s8", verdict: "approved" } });
    assert.equal(r.status, 409, error);
    assert.equal(r.body[flag], true);
    assert.equal(r.body.ok, undefined);
  }
  // ⚠ THE DOORBELL IS RUNG ONLY FOR WORK THAT WAS REALLY RE-QUEUED. An absorbed second
  // press answers `queued: "running"` — somebody is already holding it — and a doorbell
  // for that is a delivery `claim_run` refuses, which is latency spent to learn nothing.
  const held = fakeStore({ decideApproval: async () => ({ ok: true, repeat: true, verdict: "approved", step: "s8", queued: "running" }) });
  let rang = 0;
  const absorbed = await call("/api/agent/automation-approve", {
    store: held.store, ring: async () => { rang += 1; }, body: { run: R1, step: "s8", verdict: "approved" },
  });
  assert.equal(absorbed.status, 200);
  assert.equal(rang, 0, "a doorbell was rung for work nobody re-queued");
  assert.equal(absorbed.body.notified, false, "it claimed to have told the engine");
  assert.equal(absorbed.body.repeat, true);

  // ⚠ A FAILED RING IS SAID AND NEVER RAISED. The decision is committed by the time the
  // doorbell is rung, so a failed ring decides how SOON it carries on and never whether
  // it does — and answering an error would tell somebody their answer failed when it is
  // recorded and the run will resume on the next tick.
  const deaf = fakeStore();
  const broke = await call("/api/agent/automation-approve", {
    store: deaf.store, ring: async () => { throw new Error("the queue hiccuped"); },
    body: { run: R1, step: "s8", verdict: "approved" },
  });
  assert.equal(broke.status, 200, "a failed doorbell was raised as a failure");
  assert.equal(broke.body.ok, true);
  assert.equal(broke.body.notified, false, "it claimed to have told the engine");
  assert.ok(deaf.calls.some((c) => c.name === "decideApproval"), "the decision never reached the database");

  // AND ANOTHER ACCOUNT'S RUN IS THE ORDINARY 404 — not found, never forbidden.
  const nope = fakeStore({ decideApproval: async () => ({ ok: false, error: "no-execution" }) });
  const miss = await call("/api/agent/automation-approve", { store: nope.store, body: { run: R1, step: "s8", verdict: "approved" } });
  assert.equal(miss.status, 404);

  // A VERDICT THIS CANNOT READ IS REFUSED, never defaulted: "approved" as a default would
  // send something nobody agreed to, and "rejected" would throw work away.
  for (const body of [{ run: R1, step: "s8" }, { run: R1, step: "s8", verdict: "maybe" }, { run: R1, step: "s8", verdict: true }]) {
    const h = fakeStore();
    const r = await call("/api/agent/automation-approve", { store: h.store, body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(h.calls.length, 0, "a refused decision reached the database");
  }
  // AND A DECISION WITH NO STEP IS REFUSED: a run can be waiting at only one step, but
  // answering "the one it is at" would be this side guessing at what somebody pressed.
  const k = fakeStore();
  assert.equal((await call("/api/agent/automation-approve", { store: k.store, body: { run: R1, verdict: "approved" } })).status, 400);
  assert.equal(k.calls.length, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// REFERENCE MATERIAL AND MEMORY
// ════════════════════════════════════════════════════════════════════════════

test("a source keeps its name and its version, and cannot-tell is not a claim", () => {
  const k = knowledgeRow({ id: K1, title: "Price list", format: "markdown", version: 3, created_at: "a", updated_at: "b" });
  assert.deepEqual(k, { id: K1, title: "Price list", format: "markdown", version: 3, at: "a", updatedAt: "b" });
  // ⚠ THE VERSION IS WHAT A RUN QUOTES BACK, so a row whose version cannot be read says
  // NOTHING rather than 1 — `null` is "we do not know" and 1 is an assertion.
  assert.equal(knowledgeRow({ id: K1, version: "3" }).version, null);
  assert.equal(knowledgeRow({ id: K1, version: 1.5 }).version, null);
  // A FORMAT IT CANNOT READ IS `text`, which is the format that renders anything.
  assert.equal(knowledgeRow({ format: "pdf" }).format, "text");
  assert.equal(knowledgeRow(null).title, "");
  // ⚠ AND THE ROW IS A FIXED PROJECTION, NOT THE RECORD. Twenty sources at the body
  // ceiling is four megabytes to draw a list of names — so the list and the document are
  // two reads, and a row that spread whatever the database answered would put the whole
  // document back in the list the moment a column is added. Asked as the EXACT key set,
  // because `!hasOwn("body")` alone passes for a row that carries every other column.
  assert.deepEqual(Object.keys(knowledgeRow({ id: K1, body: "secret", tenant_id: "t1", agent_id: "a1" })).sort(),
    ["at", "format", "id", "title", "updatedAt", "version"]);
  assert.ok(!Object.hasOwn(knowledgeRow({ id: K1, body: "secret" }), "body"));
  // AND THE SAME OF A MEMORY, which carries its value deliberately and nothing else.
  assert.deepEqual(Object.keys(memoryRow({ id: M1, key: "t", value: "v", tenant_id: "t1" })).sort(),
    ["at", "id", "key", "source", "updatedAt", "value", "version"]);
});

test("a memory says where it came from and when it changed, and fails closed on both", () => {
  const m = memoryRow({ id: M1, key: "tone", value: "formal", source: "run", version: 2, created_at: "a", updated_at: "b" });
  assert.deepEqual(m, { id: M1, key: "tone", value: "formal", source: "run", version: 2, at: "a", updatedAt: "b" });
  // AN UNREADABLE SOURCE IS `person`, the only thing anything can write today — reading it
  // as anything else would invent a provenance for a fact somebody typed.
  assert.equal(memoryRow({ source: "somewhere" }).source, "person");
  assert.equal(memoryRow({ version: null }).version, null);
  assert.equal(memoryRow(undefined).value, "");
  // AND `run` IS IN THE LIST BEFORE ANYTHING WRITES IT, which is deliberate: extraction is
  // deferred, and a column that cannot say where a fact came from is one nobody can correct.
  assert.deepEqual(MEMORY_SOURCES, ["person", "run"]);
});

test("saving a source refuses by name, and its material keeps its own blank lines", async () => {
  const f = fakeStore();
  const r = await call("/api/agent/knowledge-save", {
    store: f.store, body: { agent: A1, title: " Price list ", body: "\n\nline one\n\nline two\n\n" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.saved, "added");
  const put = f.calls.find((c) => c.name === "addKnowledge");
  // THE BODY IS NOT `cleanText`'d: a document's own blank lines are part of it, and only
  // the ends are trimmed. A collapsed document is one somebody has to write again.
  assert.equal(put.args[1].body, "line one\n\nline two");
  assert.equal(put.args[1].title, "Price list");
  assert.equal(put.args[1].format, "text", "absent is text, and it is not guessed from the bytes");

  for (const [body, words] of [
    [{ agent: A1, body: "x" }, /give the source a name/],
    [{ agent: A1, title: "T" }, /didn't arrive as text/],
    [{ agent: A1, title: "T", body: ["x"] }, /didn't arrive as text/],
    [{ agent: A1, title: "T", body: "   \n " }, /nothing in that source/],
    [{ agent: A1, title: "T", body: "x", format: "pdf" }, /text or markdown/],
    [{ agent: A1, title: "T", body: "x".repeat(KNOWLEDGE_BODY_MAX + 1) }, new RegExp(`${KNOWLEDGE_BODY_MAX}`)],
    [{ title: "T", body: "x" }, /which agent/],
  ]) {
    const g = fakeStore();
    const bad = await call("/api/agent/knowledge-save", { store: g.store, body });
    assert.equal(bad.status, 400, JSON.stringify(body));
    assert.ok(!g.calls.some((c) => c.name === "addKnowledge"), "a refused save reached the database");
  }

  // ⚠ AN ID MAKES IT AN EDIT, AND AN EDIT NEVER ASKS THE CEILING — correcting the
  // twentieth source would otherwise be refused by the cap it is already inside.
  const e = fakeStore();
  const edit = await call("/api/agent/knowledge-save", { store: e.store, body: { id: K1, title: "T", body: "x" } });
  assert.equal(edit.body.saved, "edited");
  assert.ok(!e.calls.some((c) => c.name === "countKnowledge"));
  assert.ok(!e.calls.some((c) => c.name === "addKnowledge"));

  // A SECOND SOURCE OF ONE NAME IS A 409 THAT SAYS WHAT TO DO INSTEAD, because the point
  // of the unique name is that a version keeps counting for the same document.
  const dup = fakeStore({ addKnowledge: async () => ({ error: "duplicate" }) });
  const clash = await call("/api/agent/knowledge-save", { store: dup.store, body: { agent: A1, title: "Price list", body: "x" } });
  assert.equal(clash.status, 409);
  assert.match(clash.body.error, /edit that one instead/);

  // AND THE CEILING IS THE ROUTE'S, asked before anything is written.
  const full = fakeStore({ countKnowledge: async () => MAX_KNOWLEDGE });
  const over = await call("/api/agent/knowledge-save", { store: full.store, body: { agent: A1, title: "T", body: "x" } });
  assert.equal(over.status, 409);
  assert.match(over.body.error, new RegExp(`${MAX_KNOWLEDGE}`));
});

test("⚠ a memory is named `name` on the wire, never `key`, and the collision is the reason", () => {
  // `/api/agent/import` reads `b.key` as the BROWSER's own record id, whose grammar is
  // `String(Date.now()) + Math.random().toString(16)` — nothing like an identifier. Two
  // routes reading `b.key` under two grammars is one census away from letting either shape
  // through the other's door, so this one reads `b.name`.
  const at = SRC.indexOf('if (path === "/api/agent/memory-save")');
  const end = SRC.indexOf('if (path === "/api/agent/automation-history")', at);
  assert.ok(at > 0 && end > at, "the memory block's landmarks moved");
  // ⚠ THE COMMENTS ARE BLANKED FIRST, and this guard's first draft is why: the block's own
  // prose EXPLAINS the collision by naming `b.key`, so the scan found the thing it forbids
  // inside the sentence forbidding it. Length-preserving, so an offset stays an offset.
  const block = SRC.slice(at, end).replace(/^(\s*)\/\/.*$/gm, (m, i) => i + " ".repeat(m.length - i.length));
  assert.ok(block.includes("b.name"), "memory-save stopped reading the name off `name`");
  assert.ok(!/\bb\.key\b/.test(block), "a memory route reads `b.key`, which import owns");
  // THE OBSERVER, PROVED ALIVE: the blanking must not have erased the code it scans.
  assert.ok(/b\.name/.test(block) && /store\.saveMemory/.test(block), "the blanking ate the block");
});

test("a memory is set by name, and the ceiling is asked only for a name it does not hold", async () => {
  const f = fakeStore();
  const r = await call("/api/agent/memory-save", { store: f.store, body: { agent: A1, name: " Tone ", value: "formal" } });
  assert.equal(r.status, 200);
  const put = f.calls.find((c) => c.name === "saveMemory");
  assert.equal(put.args[1].key, "tone", "the name is folded, because a reference is folded");
  assert.equal(put.args[1].value, "formal");

  for (const body of [{ agent: A1, value: "x" }, { agent: A1, name: "a-b", value: "x" }, { agent: A1, name: "tone" },
    { agent: A1, name: "tone", value: 7 }, { name: "tone", value: "x" },
    { agent: A1, name: "tone", value: "x".repeat(MEMORY_VALUE_MAX + 1) }]) {
    const g = fakeStore();
    const bad = await call("/api/agent/memory-save", { store: g.store, body });
    assert.equal(bad.status, 400, JSON.stringify(body));
    assert.ok(!g.calls.some((c) => c.name === "saveMemory"), "a refused memory reached the database");
  }

  // ⚠ CORRECTING WHAT IS ALREADY THERE IS NEVER REFUSED BY THE CAP. At the ceiling, a new
  // name is a 409 and an existing one still saves — which is the whole difference between
  // a limit on how much is remembered and a limit on changing your mind.
  const held = Array.from({ length: MAX_MEMORIES }, (_, i) => ({ key: `k${i}`, value: "v" }));
  const full = fakeStore({ listMemory: async () => held });
  const over = await call("/api/agent/memory-save", { store: full.store, body: { agent: A1, name: "brandnew", value: "x" } });
  assert.equal(over.status, 409);
  assert.match(over.body.error, new RegExp(`${MAX_MEMORIES}`));
  const same = fakeStore({ listMemory: async () => held });
  const again = await call("/api/agent/memory-save", { store: same.store, body: { agent: A1, name: "k0", value: "corrected" } });
  assert.equal(again.status, 200, "a correction was refused by the cap it is already inside");

  // AND A DELETE TAKES THE NAME AS THE IDENTITY, because that is what a step asks for.
  const d = fakeStore();
  const gone = await call("/api/agent/memory-delete", { store: d.store, body: { agent: A1, name: "Tone" } });
  assert.deepEqual({ ...gone.body }, { ok: true, agent: A1, key: "tone" });
  assert.deepEqual(d.calls.find((c) => c.name === "removeMemory").args, [T1, A1, "tone"]);
  // A DELETE WITH NO AGENT IS REFUSED: the scope is (account, agent, name), and dropping
  // the agent would delete one name across every agent the account has.
  const e = fakeStore();
  assert.equal((await call("/api/agent/memory-delete", { store: e.store, body: { name: "tone" } })).status, 400);
  assert.equal(e.calls.length, 0);
});

test("one source whole is asked for BY NAME on the list route, and it is still scoped", async () => {
  // ⚠ THE BASE FAKE, NOT AN OVERRIDE: an override here is a plain function that never
  // reaches the recorder, so `calls` is empty and the assertion below reads as the route
  // never having asked — a fixture quietly making a correct route look broken.
  const f = fakeStore();
  const one = await call("/api/agent/knowledge", { store: f.store, query: new URLSearchParams({ agent: A1, source: K1 }) });
  assert.equal(one.status, 200);
  assert.equal(one.body.sources.length, 1);
  assert.equal(one.body.sources[0].body, "£95", "the document is what a `source=` read is for");
  assert.deepEqual(f.calls.find((c) => c.name === "readKnowledge").args, [T1, K1]);

  // THE LIST CARRIES THE BOUNDS WITH IT, so the form can say what it may accept rather
  // than keeping a second copy of the numbers.
  const g = fakeStore();
  const list = await call("/api/agent/knowledge", { store: g.store, query: new URLSearchParams({ agent: A1 }) });
  assert.equal(list.body.max, MAX_KNOWLEDGE);
  assert.equal(list.body.bodyMax, KNOWLEDGE_BODY_MAX);
  assert.deepEqual(list.body.formats, KNOWLEDGE_FORMATS);
  const mem = await call("/api/agent/memory", { store: fakeStore().store, query: new URLSearchParams({ agent: A1 }) });
  assert.equal(mem.body.max, MAX_MEMORIES);
  assert.equal(mem.body.valueMax, MEMORY_VALUE_MAX);

  // AND A SOURCE THAT IS NOT THIS ACCOUNT'S IS THE SAME 404 AS ONE THAT DOES NOT EXIST.
  const nope = fakeStore({ readKnowledge: async () => null, removeKnowledge: async () => false });
  assert.equal((await call("/api/agent/knowledge", {
    store: nope.store, query: new URLSearchParams({ agent: A1, source: K1 }) })).status, 404);
  assert.equal((await call("/api/agent/knowledge-delete", { store: nope.store, body: { id: K1 } })).status, 404);
});

test("every knowledge and memory route is scoped by the tenant, and none reads an account", async () => {
  // THE SAME CENSUS THE AUTOMATION ROUTES GET, over the family that arrived with them: a
  // route added here with no tenant fails by existing.
  const paths = Object.keys(AGENT_ROUTES).filter((p) => /knowledge|memory/.test(p));
  assert.equal(paths.length, 6, `the census is looking at ${paths.length} routes`);
  for (const p of paths) {
    const f = fakeStore();
    const r = await call(p, {
      store: f.store,
      query: new URLSearchParams({ agent: A1 }),
      body: { agent: A1, id: K1, title: "T", body: "x", name: "tone", value: "v" },
    });
    assert.equal(r.status, 200, `${p} answered ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(f.calls.some((c) => c.args.some((a) => a === T1)), `${p} never handed the tenant to the store`);
    assert.ok(!JSON.stringify(f.calls).includes(T2), `${p} carried an account nobody sent`);
  }
  // AND EVERY ONE OF THEM GOES THROUGH THE OWNERSHIP GATE OR A SCOPED WRITE: an agent
  // that is not ours is the 404 a missing one gets, on each door that takes an agent.
  const notMine = fakeStore({ ownsAgent: async () => false });
  for (const [p, opts] of [
    ["/api/agent/knowledge", { query: new URLSearchParams({ agent: A1 }) }],
    ["/api/agent/memory", { query: new URLSearchParams({ agent: A1 }) }],
    ["/api/agent/knowledge-save", { body: { agent: A1, title: "T", body: "x" } }],
    ["/api/agent/memory-save", { body: { agent: A1, name: "tone", value: "v" } }],
  ]) {
    const r = await call(p, { store: notMine.store, ...opts });
    assert.equal(r.status, 404, p);
    assert.match(r.body.error, /isn't here any more/);
  }
});

test("⚠ A SCHEDULE THAT IS NOT A WORD IS REFUSED, never read as `by hand`", () => {
  // ⚠ **THE SILENT DROP, MEASURED BEFORE IT WAS FIXED.** `typeof x === "string" ? … : "manual"`
  // read a non-string as ABSENT, so a request asking for `["daily"]` saved an automation that
  // runs BY HAND and answered `ok` — the daily run it asked for would never have fired, and
  // nothing anywhere said so. **A filter on somebody's input is a silent drop; a check is a
  // sentence.** The engine's own `authorableSchedule` had the same shape and both were fixed
  // together, because the two doors have to agree about what may be stored.
  for (const junk of [["daily"], 7, {}, true, ["manual"]]) {
    const r = cleanSchedule({ schedule: junk, zone: "UTC", at: "09:00", days: ["mon"] });
    assert.ok(r.error, `the schedule ${JSON.stringify(junk)} was accepted`);
    assert.match(r.error, /as a word/, `the refusal does not say what went wrong: ${r.error}`);
    assert.notEqual(r.schedule, "manual", "a refused schedule came back as one");
  }
  // ⚠ AND THE REFUSALS STAY THREE: absent is `manual` (making an automation is not asking for
  // it to be scheduled), a blank or an unknown word is the LIST refusal, and a non-string is
  // the one above. Collapsing any two would send somebody to fix the wrong thing.
  assert.equal(cleanSchedule({ zone: "UTC" }).schedule, "manual");
  assert.equal(cleanSchedule({ schedule: undefined, zone: "UTC" }).schedule, "manual");
  for (const word of ["", "  ", "hourly", "DAILY", "week"]) {
    const r = cleanSchedule({ schedule: word, zone: "UTC", at: "09:00", days: ["mon"] });
    assert.ok(r.error, `the schedule ${JSON.stringify(word)} was accepted`);
    assert.doesNotMatch(r.error, /as a word/, `${JSON.stringify(word)} got the wrong-kind sentence`);
  }
  // THE CONTROLS, without which "it refuses" is satisfied by a reader that refuses everything.
  assert.equal(cleanSchedule({ schedule: "daily", at: "09:00", zone: "UTC" }).schedule, "daily");
  assert.equal(cleanSchedule({ schedule: "weekly", at: "09:00", zone: "UTC", days: ["mon"] }).schedule, "weekly");
});

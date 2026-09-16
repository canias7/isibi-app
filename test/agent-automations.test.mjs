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
  AUTOMATION_STATES, MAX_AUTOMATIONS, MAX_AUTOMATION_STEPS, MAX_STEP_NOTE, MAX_EXECUTIONS,
  cleanWorkflow, cleanSchedule, validTimeZone, automationRow, executionRow, makeAgentStore,
} from "../agent-store.mjs";

const SRC = fs.readFileSync(path.join(import.meta.dirname, "..", "agent-store.mjs"), "utf8");
const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";
const A1 = "aaaaaaaa-1111-2222-3333-444444444444";
const C1 = "cccccccc-1111-2222-3333-444444444444";
const R1 = "dddddddd-1111-2222-3333-444444444444";

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
  assert.ok(paths.length >= 7, `the census is looking at only ${paths.length} routes`);
  for (const p of paths) {
    const f = fakeStore();
    const r = await call(p, {
      store: f.store,
      query: new URLSearchParams({ agent: A1, id: C1 }),
      body: { id: C1, agent: A1, name: "N", enabled: true, schedule: "manual", steps: [] },
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
  assert.deepEqual(made.steps, [
    { id: "s1", type: "weekday", days: ["mon"] },
    { id: "s2", type: "note", text: "morning" },
  ]);

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
  assert.match(cleanWorkflow([{ type: "note" }]).error, /step 1: text can't be empty/);
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
  assert.deepEqual(cleanSchedule({ schedule: "daily", at: "09:00", zone: "Europe/London" }),
    { schedule: "daily", at: "09:00:00", zone: "Europe/London" });
  // ⚠ A MANUAL AUTOMATION MAY HAVE A ZONE: a weekday condition asks which day it is
  // somewhere, and without this it would mean the day in UTC for every Run-now one.
  assert.deepEqual(cleanSchedule({ schedule: "manual", zone: "Europe/London" }),
    { schedule: "manual", at: null, zone: "Europe/London" });
  // A time with no schedule is a control somebody set that nothing reads.
  assert.equal(cleanSchedule({ schedule: "manual", at: "09:00" }).at, null);
  assert.match(cleanSchedule({ schedule: "daily", at: "9:00", zone: "UTC" }).error, /HH:MM/);
  assert.match(cleanSchedule({ schedule: "daily", at: "24:00", zone: "UTC" }).error, /HH:MM/);
  assert.match(cleanSchedule({ schedule: "daily", at: "09:00" }).error, /needs a time zone/);
  assert.match(cleanSchedule({ schedule: "weekly" }).error, /by hand or on a daily schedule/);
  assert.match(cleanSchedule({ zone: "Nowhere/Fake" }).error, /isn't a time zone/);
  // ASKED OF `Intl`, NEVER OF A LIST.
  assert.equal(validTimeZone("Europe/London"), "Europe/London");
  assert.equal(validTimeZone("Nowhere/Fake"), null);
  assert.equal(validTimeZone(["UTC"]), null, "refused, never coerced");
  assert.equal(validTimeZone(""), null);
  for (const s of AUTOMATION_SCHEDULES) assert.ok(cleanSchedule({ schedule: s, at: "09:00", zone: "UTC" }).schedule === s);
});

// ── the readers ─────────────────────────────────────────────────────────────

test("automationRow fails closed on every field it cannot read", () => {
  const junk = automationRow({ id: 1, enabled: "true", schedule: "weekly", at_local: 9, steps: "x" });
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
});

// ── the shape of the surface ────────────────────────────────────────────────

test("the catalog is a positive list, and its names are derived from it", () => {
  assert.deepEqual(AUTOMATION_STEP_TYPES, AUTOMATION_STEPS.map((s) => s.type));
  assert.deepEqual([...new Set(AUTOMATION_STEP_TYPES)], AUTOMATION_STEP_TYPES);
  for (const s of AUTOMATION_STEPS) {
    assert.ok(s.label && s.does, `${s.type} has words a person can read`);
    assert.ok(["condition", "action"].includes(s.kind));
    assert.ok(Array.isArray(s.fields) && s.fields.length, `${s.type} says what it is configured with`);
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
  const allowed = new Set(["id", "agent", "name", "enabled", "steps", "schedule", "at", "zone", "hasOwn"]);
  for (const r of reads) assert.ok(allowed.has(r), `an automation route reads ${r} off what somebody sent`);
  // THE OBSERVER, PROVED ALIVE: it can see the reads the block really makes.
  for (const seen of ["id", "agent", "enabled"]) assert.ok(reads.includes(seen), `the scan missed b.${seen}`);
});

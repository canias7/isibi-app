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
  AUTOMATION_COLUMNS,
  EXAMPLE_AUTOMATION,
  cleanWorkflow, cleanSchedule, validTimeZone, automationRow, executionRow, makeAgentStore,
  AUTOMATION_TRIGGERS, webhookRow, withWaitingPayloads, toolApprovalRow,
  eventRow, AGENT_EVENT_STATES, MAX_EVENT_LOG,
  // ── an edit changes only what it names ───────────────────────────────────────
  AUTOMATION_PATCH_FIELDS, fieldNamed, patchNeedsStored, cleanPatch, sayPatch,
  trigAt, trigZone, trigDays, trigOnDate, trigOnEvent,
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
    // ⚠ `patchAutomation` WHERE THE REPLACE WAS. `agent.patch_automation` delegates its write
    // to `agent.update_automation`, so the ANSWER shape is the same one; what is gone is a fake
    // offering an operation the store has not got, which would be a fake more capable than the
    // thing it stands in for in the file whose census reads a 502 for a missing one.
    patchAutomation: of("patchAutomation", { ok: true, id: C1, next_run_at: null }),
    // ⚠ `agent.set_automation_enabled`'S OWN ANSWER, not a row — see the store's note: the
    // toggle is the function the agent's `pause_automation` calls, and it RECOMPUTES the
    // next run when a scheduled automation is turned back on.
    setAutomationEnabled: of("setAutomationEnabled",
      { ok: true, id: C1, enabled: false, next_run_at: "2026-09-20T08:00:00+00:00" }),
    removeAutomation: of("removeAutomation", true),
    runAutomation: of("runAutomation", { ok: true, repeat: false, run_id: R1, occurrence: null, trigger: "manual", state: "queued" }),
    executions: of("executions", []),
    /**
     * ⚠ AS CAPABLE AS THE REAL STORE, for the SIXTH recorded time in this file — and the
     * default is `null` rather than a row because that is the honest answer to "the newest page
     * does not hold this run and neither do I". Without the operation at all the history route
     * throws the moment a `run=` names something off the page, which from outside reads as the
     * feature being broken; with a ROW as the default, every case that names a run would quietly
     * get one whether the product asked properly or not.
     */
    execution: of("execution", null),
    /**
     * ⚠ AS CAPABLE AS THE REAL STORE, for the FIFTH recorded time in this file — and this one
     * fails QUIETLY rather than loudly, which is why it is worth saying. The history route asks
     * for the waiting sends' payloads inside its own try/catch (a payload that cannot be read
     * must not fail the whole history), so a fake without this operation does not read as a 502:
     * it reads as a waiting send whose message could not be loaded, which is a plausible wrong
     * answer. Derived from `toolApprovalRow`, so a fixture cannot be in a shape the real reader
     * does not produce.
     */
    listToolApprovals: of("listToolApprovals", []),
    // ⚠ THE FAKE HAS TO BE AS CAPABLE AS THE REAL STORE. `readAutomation` is what the run
    // route asks for the input DECLARATION, so a fake without it makes the route throw and
    // reports it as a save that failed — five correct cases came back 502 that way. A
    // fixture less capable than the thing it stands in for manufactures a defect.
    readAutomation: of("readAutomation", { id: C1, agentId: A1, name: "n", inputs: [], steps: [] }),
    decideApproval: of("decideApproval", { ok: true, repeat: false, verdict: "approved", step: "s1", queued: "queued" }),
    /**
     * ⚠ THE FAKE HAS TO BE AS CAPABLE AS THE REAL STORE, for the fourth recorded time in this
     * file. `automation-check` reads the connected accounts, the agent's own automations and the
     * agent row (for its time zone), so a fake without any of the three makes the route throw
     * and the tenant census reads a 502 about a route that is correct.
     */
    listConnections: of("listConnections", []),
    list: of("list", [{ id: A1, name: "n", zone: "Europe/London", status: "active", tools: [] }]),
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
    // ⚠ `agent.save_memory`'S OWN ANSWER, not a row — see the note in `test/agent-api.test.mjs`.
    saveMemory: of("saveMemory", { ok: true, saved: "created",
      memory: { id: M1, name: "tone", value: "formal", version: 1, source: "person" } }),
    removeMemory: of("removeMemory", { ok: true, forgot: true,
      affects: { futureRuns: true, acceptedRuns: false, runHistory: false },
      note: "later runs won't see it; a run already under way keeps what it started with, and the history keeps whatever it quoted" }),
  };
  return { calls, store: { ...base, ...over } };
}

const WORKFLOW = [{ type: "weekday", days: ["mon"] }, { type: "note", text: "morning" }];
/**
 * What `readAutomation` answers, so a case can say what an automation DECLARES.
 *
 * Built from `automationRow`'s own key set rather than typed, because a row in a different shape
 * from the real reader's is a fixture that hides exactly the field it is about — this file has
 * paid for that twice.
 */
const ROW = automationRow({
  id: C1, agent_id: A1, name: "n", enabled: true, schedule: "manual", at_local: null, zone: null,
  days: [], on_date: null, on_event: null, steps: [], inputs: [], next_run_at: null, updated_at: null,
});

/** One acceptable value per field an edit may name, for the census over `AUTOMATION_PATCH_FIELDS`. */
const SAMPLE = Object.freeze({
  name: "A name", enabled: false, schedule: "manual", at: null, zone: "Europe/London",
  steps: [{ type: "note", text: "x" }], inputs: [], days: [], on_date: null, on_event: null,
});

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
    patchAutomation: async () => ({ ok: false, error: "no-automation" }),
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
  /**
   * ⚠ **AND THE ANSWER IS `agent.set_automation_enabled`'S OWN, which is the whole of the fix
   * this case was widened for.** The toggle used to be a bare `PATCH {enabled}` here while the
   * agent's `pause_automation` called that function — and the function does one thing more:
   * turning a SCHEDULED automation back on it recomputes `next_run_at`, because a stale one is
   * in the past and `tick_automations` selects on `next_run_at <= now()`. Measured on a real
   * PostgreSQL before it was changed: five days behind through this door, the next real
   * occurrence through the other, for the same act on the same automation.
   *
   * So the recomputed instant has to REACH a reader rather than being dropped — a caller told
   * only `ok` cannot see the one fact that changed besides the flag.
   */
  assert.equal(r.body.enabled, false);
  assert.equal(r.body.nextRunAt, "2026-09-20T08:00:00+00:00",
    "the instant the function recomputed did not reach the reply");
  // A REFUSAL IS THE FUNCTION'S TOO: an automation that is not this account's and one that does
  // not exist are ONE answer, which is what stops a stranger confirming somebody else's id.
  const missing = fakeStore({ setAutomationEnabled: async () => ({ ok: false, error: "no-automation" }) });
  const gone404 = await call("/api/agent/automation-enable", { store: missing.store, body: { id: C1, enabled: false } });
  assert.equal(gone404.status, 404);
  assert.match(gone404.body.error, /isn't here any more/);
  // ⚠ AND A CODE NOBODY CAN NAME IS A 500, never a 400 blaming the caller for something this
  // side cannot act on — the same rule `sayMemory` follows one route family over.
  const odd = fakeStore({ setAutomationEnabled: async () => ({ ok: false, error: "something-new" }) });
  assert.equal((await call("/api/agent/automation-enable", { store: odd.store, body: { id: C1, enabled: false } })).status, 500);
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
  await store.patchAutomation(T1, { id: C1, patch: { name: "N" } });
  await store.listAutomations(T1, A1);
  await store.ownsAutomation(T1, C1);
  await store.setAutomationEnabled(T1, C1, false);
  await store.runAutomation(T1, { automationId: C1, runId: R1 });
  await store.executions(T1, C1);
  await store.removeAutomation(T1, C1);
  // ⚠ `readAutomation` WAS NOT ON THIS LIST, in a census whose own comment says an
  // operation added next month fails by existing. It is the read the run route asks for
  // what an automation wants, so it was the one operation of the nine nothing here drove.
  await store.readAutomation(T1, C1);
  // ⚠ **AND `execution` WAS THE TENTH, added for the run an arrival names.** Its filter is the
  // whole of its safety: `service_role` bypasses row level security, so a read of one execution
  // BY ID is scoped by nothing but what is in the query.
  await store.execution(T1, C1, R1);
  const AUTOMATION_OPS = ["listAutomations", "readAutomation", "ownsAutomation", "createAutomation",
    "patchAutomation", "setAutomationEnabled", "removeAutomation", "runAutomation", "executions",
    "execution"];
  for (const op of AUTOMATION_OPS) {
    assert.equal(typeof store[op], "function", `the store has no ${op}`);
  }
  /**
   * ⚠ **AND THE LIST IS DERIVED FROM THE STORE, which this comment claimed and the code did
   * not do.** It was a hand-kept literal asserted only to EXIST, so an operation added next
   * month did not fail by existing — it simply went undriven, which is how `readAutomation`
   * came to be the one of nine nothing here touched. The store's own keys decide the family now,
   * so a `readExecution` written later has to be driven or this goes red.
   */
  const FAMILY = Object.keys(store).filter((k) => /automation|execution/i.test(k)).sort();
  assert.deepEqual(FAMILY, [...AUTOMATION_OPS].sort(),
    "the store's automation operations and the ones driven here have come apart");
  assert.equal(seen.length, AUTOMATION_OPS.length,
    `${AUTOMATION_OPS.length} operations made ${seen.length} requests — one of them is unread`);
  // THE HISTORY IS A READ AND IT IS SCOPED TWICE: the route asks `ownsAutomation` first,
  // and the query filters on the tenant anyway. `service_role` bypasses row level
  // security, so the filter is the wall and the ownership check is the belt.
  const hist = seen.find((r) => r.url.includes("automation_history"));
  assert.ok(hist, "the history was never read");
  assert.match(hist.url, new RegExp(`tenant_id=eq\\.${T1}`), `the history is unscoped: ${hist.url}`);
  assert.match(hist.url, new RegExp(`automation_id=eq\\.${C1}`));
  /**
   * ⚠ **THE ONE-EXECUTION READ IS SCOPED THREE WAYS, and the tenant and the automation are the
   * two that are walls.** It exists so a run an arrival names can be found when it is older than
   * the newest page; by id alone it would be a read of any execution on the platform, since
   * `service_role` bypasses row level security. `limit=1` is the shape, not the safety.
   */
  const one = seen.filter((r) => r.url.includes("automation_history")).find((r) => /[?&]id=eq\./.test(r.url));
  assert.ok(one, "the one-execution read never happened");
  assert.match(one.url, new RegExp(`tenant_id=eq\\.${T1}`), `the single read is unscoped: ${one.url}`);
  assert.match(one.url, new RegExp(`automation_id=eq\\.${C1}`));
  assert.match(one.url, new RegExp(`id=eq\\.${R1}`));
  assert.equal(one.method, "GET", "reading one execution is not a read");
  /**
   * ⚠ **AND THE PAGE IS REALLY BOUNDED BY `MAX_EXECUTIONS`, which is what makes "a run outside
   * the newest page" a thing rather than a phrase.** The one-run read takes `limit=1` because it
   * is asking about one id; the page takes the constant, so a history that quietly answered
   * everything would make the whole fetch-by-name hop unreachable and untestable.
   */
  assert.match(hist.url, new RegExp(`limit=${MAX_EXECUTIONS}(&|$)`), `the page is unbounded: ${hist.url}`);
  assert.match(one.url, /limit=1(&|$)/, `the one-execution read is unbounded: ${one.url}`);
  assert.match(hist.url, /order=created_at\.desc/, "the page is not newest-first, so 'outside it' means nothing");
  /**
   * ⚠ **AND BOTH READS ASK FOR THE SAME COLUMNS, from one constant.** `executionRow` fails
   * closed on every field it cannot read, so a single read asking for fewer would answer a run
   * whose steps, decisions and stop were all silently absent — the `&select=` defect this
   * repository already records, with the two readers disagreeing instead of one being short.
   */
  const cols = (u) => decodeURIComponent((/[?&]select=([^&]*)/.exec(u) || [, ""])[1]).split(",").sort();
  assert.deepEqual(cols(one.url), cols(hist.url),
    "the two history readers ask for different columns, so one of them degrades every row it answers");
  assert.ok(cols(one.url).includes("run_status") && cols(one.url).includes("steps"),
    "the observer is dead: neither reader names the columns a run's state is read from");
  const made = seen.find((r) => r.url.includes("rpc/create_automation"));
  assert.equal(made.body.p_max, MAX_AUTOMATIONS, "the ceiling goes to the function that does the insert");
  assert.equal(made.body.p_tenant, T1);
  // ⚠ **AND THE TOGGLE ASKS FOR THE FUNCTION BY NAME, never a `PATCH` of the column.** It was
  // a bare `PATCH {enabled}` until this round, which set the flag and left `next_run_at` where
  // a five-day pause had left it — in the past — while the agent's own `pause_automation` called
  // the function that recomputes it. One operation, two behaviours, on the same automation.
  const flipped = seen.find((r) => r.url.includes("rpc/set_automation_enabled"));
  assert.ok(flipped, "turning an automation on or off does not go through the function that recomputes its next run");
  assert.equal(flipped.method, "POST");
  assert.deepEqual(Object.keys(flipped.body).sort(), ["p_enabled", "p_id", "p_tenant"]);
  assert.ok(!seen.some((r) => r.method === "PATCH" && /automations\?id=/.test(r.url)),
    "an automation's own column is still being patched from this side");
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

test("⚠ EVERY COLUMN `automationRow` READS IS NAMED ON THE WIRE, derived from the reader itself", async () => {
  // ⚠ **REPRODUCED BEFORE THE FIX: the list named ten of the fourteen.** PostgREST sends
  // only the columns a request names and `automationRow` fails closed on every field it
  // cannot read, so `days`, `on_date`, `on_event` and `inputs` came back absent and read as
  // "no days", "not on a date", "not on an event" and "asks for nothing" — no error
  // anywhere, on a row that really held all four. What it cost through the existing
  // screen: `agentAutoRunPress` reads `row.inputs`, so an automation that asks for
  // answers started with none of them, and the edit form seeded `inputs: []` into a
  // route that replaces the whole automation.
  //
  // **THE SET IS DERIVED FROM `automationRow` ITSELF, never from a scan of its source.**
  // Every read it makes is `r?.<column>`, so a proxy that records what it is asked for
  // answers the question exactly — and a field added to that function next month fails
  // here by existing rather than by being remembered.
  const touched = new Set();
  automationRow(new Proxy({}, {
    get(_t, k) { if (typeof k === "string") touched.add(k); return undefined; },
  }));
  assert.ok(touched.size >= 15, `the proxy recorded only ${touched.size} columns — it is not reading the row`);

  const seen = [];
  const store = makeAgentStore({
    url: "https://db.example", key: "k",
    fetch: async (url, init) => {
      seen.push({ url: String(url), method: (init && init.method) || "GET" });
      return { ok: true, status: 200, text: async () => "[]" };
    },
  });
  await store.listAutomations(T1, A1);
  await store.readAutomation(T1, C1);
  assert.equal(seen.length, 2);

  // BY NAME AND ON THE WIRE. A count would pass a list of fourteen wrong columns, and
  // a substring would let `on_date` be satisfied by `on_date_at`.
  const named = (r) => new Set((new URL(r.url).searchParams.get("select") || "").split(",").filter(Boolean));
  for (const r of seen) {
    const cols = named(r);
    assert.ok(cols.size > 0, `${r.url} names no columns at all`);
    const missing = [...touched].filter((c) => !cols.has(c)).sort();
    assert.deepEqual(missing, [], `${r.url} does not name ${JSON.stringify(missing)}, which automationRow reads`);
    // AND NOTHING SPARE, because a column named and never read is a column somebody
    // believes is arriving. `readAutomation` asked for `created_at`, which nothing reads.
    const spare = [...cols].filter((c) => !touched.has(c)).sort();
    assert.deepEqual(spare, [], `${r.url} names ${JSON.stringify(spare)}, which automationRow never reads`);
  }

  // THE OBSERVER, without which "nothing is missing" is satisfied by a reader that reads
  // nothing: the constant and the proxy's answer are the same set, both ways round.
  assert.deepEqual([...AUTOMATION_COLUMNS].sort(), [...touched].sort(),
    "the column list and what automationRow reads have come apart");
  // AND THE CONTROL: a select list that had stopped naming these would not satisfy the
  // check above. Proved against the spelling the list really carried before the fix.
  //
  // ⚠ RE-ANCHORED, NOT APPEASED: `version` joined the list, so the pre-fix ten are now
  // missing FIVE rather than four. The property is unchanged — that historical list reads as
  // short and this census discriminates — and the number moved because the census caught a
  // real addition, which is the census working. **AND `version` IS ITS OWN STORY**: the read
  // could not carry the number a guarded edit fences on, so `agent.patch_automation`'s
  // `p_expect_version` was unreachable from this door for want of one column.
  const short = new Set("id,agent_id,name,enabled,schedule,at_local,zone,steps,next_run_at,updated_at".split(","));
  assert.deepEqual([...touched].filter((c) => !short.has(c)).sort(),
    ["days", "inputs", "on_date", "on_event", "version"],
    "the pre-fix select list no longer reads as short — this check has stopped discriminating");
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
  const patched = g.calls.find((c) => c.name === "patchAutomation").args[1].patch;
  /**
   * ⚠ **RE-ANCHORED ONTO THE PROPERTY, because the two bodies stopped being the same shape and
   * the property never was that they were.** A create answers every field (there is no row to
   * fall back on) and an edit answers the ones somebody changed. What must still agree is the
   * VALUE each door gives a field they BOTH name, normalised by the same readers — `09:00:00`
   * out of `trigAt` either way, the ids minted from the position either way.
   *
   * Every key is checked to be one `AUTOMATION_PATCH_FIELDS` really names, so a field added to
   * one door and not the other fails here rather than arriving at a function that refuses it by
   * name; the two key sets differ in exactly ONE spelling and that one is named once.
   */
  /**
   * ⚠ **ONE VALUE, TWO WIRE SHAPES, and that is the two FUNCTIONS' own contracts rather than a
   * difference in normalisation.** `create_automation` takes a `time`, so the store sends the
   * column's `HH:MM:SS`; `agent.patch_automation` reads `atLocal` against `^HH:MM$`, which is also
   * what the engine's `change_automation` sends it. MEASURED, by `verify:triggers` rather than by
   * reading: seconds there are answered `bad-time`. So the seconds are added at the door that
   * needs them, and this compares the clock time.
   */
  const SAME_AS = { atLocal: ["at", (v) => `${v}:00`] };
  for (const [key, value] of Object.entries(patched)) {
    assert.ok(Object.values(AUTOMATION_PATCH_FIELDS).includes(key),
      `the patch carries ${key}, which is not a field an edit may name`);
    const [as, shape] = SAME_AS[key] ?? [key, (v) => v];
    assert.deepEqual(shape(value), made[as], `a create and an edit normalise ${key} differently`);
  }
  // **AND THE EDIT SENT EXACTLY WHAT THE BODY NAMED, which is the whole of this round.** Without
  // this the loop above is satisfied by a patch carrying every field, agreeing with the create
  // on all of them — which is the whole-row replace passing a test about normalisation.
  assert.deepEqual(Object.keys(patched).sort(), ["atLocal", "name", "schedule", "steps", "zone"]);
});

test("⚠ AN EDIT SENDS ONLY THE FIELDS IT NAMES, and the transaction keeps the rest", async () => {
  /**
   * ⚠ **THE LOST UPDATE THIS ROUND REMOVES, at the route.** Every field the body says nothing
   * about must be ABSENT from the patch, because that is what makes `agent.patch_automation`
   * resolve it from its own locked row instead of from whatever a caller remembered.
   */
  const f = fakeStore();
  const r = await call("/api/agent/automation-update", { store: f.store, body: { id: C1, name: "Just the name" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const p1 = f.calls.find((c) => c.name === "patchAutomation").args[1];
  assert.equal(p1.id, C1);
  assert.deepEqual(p1.patch, { name: "Just the name" });
  // ⚠ AND IT READ NOTHING TO GET THERE: no `readAutomation`, because nothing needed the stored
  // declarations. A read on every edit would be a window between what was validated and what is
  // written, and it would cost a round trip on a rename.
  assert.ok(!f.calls.some((c) => c.name === "readAutomation"), "it read the row to rename an automation");

  // EVERY FIELD, ONE AT A TIME — a census, so a field that stopped reaching the patch fails here.
  for (const [body, expect] of [
    [{ enabled: false }, { enabled: false }],
    [{ schedule: "manual" }, { schedule: "manual" }],
    // `HH:MM`, NOT THE COLUMN'S `HH:MM:SS` — the patch function's own shape; see the note above.
    [{ at: "07:05" }, { atLocal: "07:05" }],
    [{ at: null }, { atLocal: null }],
    [{ at: "" }, { atLocal: null }],
    [{ zone: "Europe/Lisbon" }, { zone: "Europe/Lisbon" }],
    [{ zone: null }, { zone: null }],
    [{ days: ["fri", "mon"] }, { days: ["mon", "fri"] }],
    [{ days: [] }, { days: [] }],
    [{ on_date: "2027-03-04" }, { onDate: "2027-03-04" }],
    [{ on_date: null }, { onDate: null }],
    [{ on_event: "Order.Paid" }, { onEvent: "order.paid" }],
    [{ on_event: null }, { onEvent: null }],
    [{ inputs: [] }, { inputs: [] }],
  ]) {
    const g = fakeStore();
    const rr = await call("/api/agent/automation-update", { store: g.store, body: { id: C1, ...body } });
    assert.equal(rr.status, 200, `${JSON.stringify(body)} → ${JSON.stringify(rr.body)}`);
    assert.deepEqual(g.calls.find((c) => c.name === "patchAutomation").args[1].patch, expect,
      `${JSON.stringify(body)} did not reach the patch as ${JSON.stringify(expect)}`);
  }

  // **AN EDIT THAT NAMES NOTHING IS REFUSED RATHER THAN WRITTEN**, because `{}` would resolve
  // every field from the row and write them all back — a no-op that still takes the lock.
  const h = fakeStore();
  const empty = await call("/api/agent/automation-update", { store: h.store, body: { id: C1 } });
  assert.equal(empty.status, 400);
  assert.match(empty.body.error, /which fields/i);
  assert.ok(!h.calls.some((c) => c.name === "patchAutomation"), "an empty edit still wrote");
});

test("⚠ EVERY PATCHED FIELD IS REFUSED RATHER THAN COERCED, and nothing is written", async () => {
  /**
   * ⚠ **A SWEEP SURVIVOR IS WHY THIS EXISTS, and the one it names is the dangerous direction.**
   * Nothing drove a junk value at this door — the census above sends only values a form really
   * produces — so `enabled`'s type check could be deleted and `"false"` would reach the patch as
   * a STRING. Postgres reads a non-null jsonb string into a boolean column as an error, and a
   * shape that DID coerce would turn "off" into "on": work nobody asked for, started by a form.
   *
   * **`Boolean("false")` IS `true`** and `String(["daily"])` is `"daily"` — this repository's two
   * most-recorded value traps, both reachable here, so the census drives both shapes at every
   * field rather than one example.
   *
   * **AND NOTHING MAY BE WRITTEN ON A REFUSAL**, which is the half a status code cannot carry: a
   * 400 with a `patchAutomation` behind it has already taken the row's lock and moved its
   * `updated_at` over a change it then refused.
   */
  for (const [body, why] of [
    [{ enabled: "false" }, /on or off/i],
    [{ enabled: 1 }, /on or off/i],
    [{ enabled: null }, /on or off/i],
    [{ schedule: ["daily"] }, /as a word/i],
    [{ schedule: "yearly" }, /by hand|chosen days/i],
    [{ schedule: 7 }, /as a word/i],
    [{ name: "" }, /name/i],
    [{ name: "   " }, /name/i],
    [{ at: "25:00" }, /time/i],
    [{ at: ["09:00"] }, /time/i],
    [{ zone: "Mars/Olympus" }, /zone|somewhere/i],
    [{ days: ["someday"] }, /day/i],
    [{ on_date: "2027-02-30" }, /day in the calendar/i],
    [{ on_event: "Order Paid!" }, /event|name/i],
  ]) {
    const f = fakeStore();
    const r = await call("/api/agent/automation-update", { store: f.store, body: { id: C1, ...body } });
    assert.equal(r.status, 400, `${JSON.stringify(body)} was accepted: ${JSON.stringify(r.body)}`);
    assert.match(r.body.error, why, `${JSON.stringify(body)} said "${r.body.error}"`);
    assert.ok(!f.calls.some((c) => c.name === "patchAutomation"),
      `${JSON.stringify(body)} was refused and still wrote`);
  }

  // THE CONTROL, without which "every junk value is refused" is satisfied by a door that refuses
  // everything — the real value of each field, at the same door, reaching the patch.
  for (const body of [{ enabled: false }, { schedule: "daily", at: "09:00", zone: "Europe/London" },
                      { name: "ok" }, { at: "09:00" }, { zone: "Europe/London" },
                      { days: ["mon"] }, { on_date: "2027-03-04" }, { on_event: "order.paid" }]) {
    const g = fakeStore();
    const rr = await call("/api/agent/automation-update", { store: g.store, body: { id: C1, ...body } });
    assert.equal(rr.status, 200, `${JSON.stringify(body)} → ${JSON.stringify(rr.body)}`);
    assert.ok(g.calls.some((c) => c.name === "patchAutomation"), `${JSON.stringify(body)} wrote nothing`);
  }
});

test("⚠ A STEPS EDIT IS VALIDATED AGAINST THE DECLARATIONS THE AUTOMATION REALLY HAS", async () => {
  /**
   * A `{{reference}}` needs something that produces it, and a declared input is half of what can.
   * So an edit carrying new steps and saying nothing about the declarations has to be checked
   * against the stored ones — and that read decides a REFUSAL and never a value: the declarations
   * the row keeps are the transaction's own resolution, not what this process read.
   */
  const declaring = { ...ROW, inputs: [{ name: "who", label: "Who", type: "text", required: true, default: "" }] };
  // ⚠ THE OVERRIDE RECORDS FOR ITSELF, because `fakeStore`'s own recorder is the function being
  // replaced — so a case that overrides one and then asks `calls` is asking about a call that
  // cannot be there. A negative assertion with a dead observer, in the check about a read.
  const reads = [];
  const f = fakeStore({ readAutomation: async (...a) => { reads.push(a); return declaring; } });
  const ok1 = await call("/api/agent/automation-update", {
    store: f.store, body: { id: C1, steps: [{ type: "note", text: "for {{who}}" }] },
  });
  assert.equal(ok1.status, 200, JSON.stringify(ok1.body));
  assert.equal(reads.length, 1, "it never read the declarations");
  assert.equal(reads[0][0], T1, "the read is not scoped to this account");
  const sent = f.calls.find((c) => c.name === "patchAutomation").args[1].patch;
  // ⚠ THE PATCH CARRIES THE STEPS AND NOT THE DECLARATIONS, which is the whole point: they were
  // read to validate against, and writing them back would be this browser's copy of them.
  assert.deepEqual(Object.keys(sent), ["steps"]);

  // THE CONTROL: the same steps against an automation that declares nothing are REFUSED, so the
  // stored declarations are really what the check consulted.
  const g = fakeStore({ readAutomation: async () => ({ ...ROW, inputs: [] }) });
  const bad = await call("/api/agent/automation-update", {
    store: g.store, body: { id: C1, steps: [{ type: "note", text: "for {{who}}" }] },
  });
  assert.equal(bad.status, 400, JSON.stringify(bad.body));
  assert.match(bad.body.error, /who/);
  assert.ok(!g.calls.some((c) => c.name === "patchAutomation"), "a refused edit still wrote");

  // AND WHEN THE EDIT NAMES BOTH, THE TWO CHECK AGAINST EACH OTHER and nothing is read.
  const readsB = [];
  const h = fakeStore({ readAutomation: async (...a) => { readsB.push(a); return { ...ROW, inputs: [] }; } });
  const both = await call("/api/agent/automation-update", {
    store: h.store,
    body: { id: C1, inputs: [{ name: "who", label: "Who" }], steps: [{ type: "note", text: "for {{who}}" }] },
  });
  assert.equal(both.status, 200, JSON.stringify(both.body));
  assert.equal(readsB.length, 0, "it read declarations the edit had already given it");

  // AND AN AUTOMATION THAT IS NOT THIS ACCOUNT'S IS THE MISSING-AUTOMATION 404 on that read too
  // — the same answer the transaction's own locked lookup gives, so the two cannot be told apart.
  const n = fakeStore({ readAutomation: async () => null });
  const gone = await call("/api/agent/automation-update", {
    store: n.store, body: { id: C1, steps: [{ type: "note", text: "x" }] },
  });
  assert.equal(gone.status, 404);
  assert.ok(!n.calls.some((c) => c.name === "patchAutomation"));
  // AND THE TRANSACTION'S OWN `no-automation` IS THE SAME 404 — driven, because the sentence
  // census above EXEMPTS that code on the strength of this being true.
  const t = fakeStore({ patchAutomation: async () => ({ ok: false, error: "no-automation" }) });
  const tgone = await call("/api/agent/automation-update", { store: t.store, body: { id: C1, name: "x" } });
  assert.equal(tgone.status, 404, JSON.stringify(tgone.body));
  assert.match(tgone.body.error, /isn't here any more/);

  // `patchNeedsStored` IS THE ONE READER OF WHEN THAT READ IS NEEDED, so the route and
  // `cleanPatch` cannot disagree about it.
  assert.equal(patchNeedsStored({ steps: [] }), true);
  assert.equal(patchNeedsStored({ steps: [], inputs: [] }), false);
  assert.equal(patchNeedsStored({ name: "x" }), false);
  assert.equal(patchNeedsStored({}), false);
  assert.equal(patchNeedsStored({ steps: undefined }), false, "an undefined step list names nothing");

  /**
   * ⚠ **AND `cleanPatch` REFUSES A `held` THAT IS NOT A ROW, LOUDLY.** The argument used to be
   * the DECLARATIONS ALONE, so a call site left behind hands an ARRAY — which is TRUTHY, so the
   * fail-closed refusal below does not fire, and every read of it (`held?.steps`, `held?.inputs`,
   * `held?.version`) answers `undefined`. Measured: the whole combination would be validated
   * against EMPTINESS and no fence sent, so a stored step list reads as *"your steps are broken"*
   * about steps that are fine. It cannot arrive from a body — the route passes `automationRow`'s
   * answer or `null` — so the one moment it can be wrong is an edit to a call site, and that is
   * when a throw is cheap.
   */
  assert.throws(() => cleanPatch({ steps: [] }, []), TypeError, "the legacy array shape is tolerated");
  assert.throws(() => cleanPatch({ steps: [] }, "nonsense"), TypeError);
  // AND THE TWO REAL ANSWERS STAY ANSWERS: a row validates, and nothing-read is the SENTENCE
  // below rather than a throw, because "I could not read it" is a state the route really has.
  assert.ok(!cleanPatch({ steps: [] }, ROW).error);
  assert.match(cleanPatch({ steps: [] }, null).error, /wasn't checked/);
  assert.match(cleanPatch({ steps: [] }).error, /wasn't checked/);
});

test("⚠ EVERY REFUSAL THE TRANSACTION CAN MAKE HAS A SENTENCE — read out of the migration", () => {
  /**
   * ⚠ **A CENSUS AGAINST `agent.patch_automation`'S OWN BODY, not a list somebody kept.** The
   * shape refusals are walls from this door (`cleanPatch` checks every field first), but the
   * WHOLENESS ones are decided in the transaction against the locked row and are answers a person
   * really gets — so a code added to that function with no sentence here would arrive as a 500.
   */
  const sql = fs.readFileSync(path.join(import.meta.dirname,
    "../agent-builder/supabase/migrations/20260918120000_agent_authoring_zone_and_patch.sql"), "utf8");
  const start = sql.indexOf("create or replace function agent.patch_automation(");
  assert.ok(start > 0, "the migration no longer declares patch_automation");
  /**
   * ⚠ **THE WINDOW ENDS AT THE FUNCTION'S OWN `$$`, and my first reader's did not.** It looked
   * for `"\n$$;"`, which these bodies never carry (they end `end; $$;` on ONE line), so `indexOf`
   * answered -1, `slice(start, -1)` took the whole rest of the file, and the census read the
   * `_once` WRAPPER's refusals as this function's — demanding a sentence for `operation-lost`,
   * which is not a refusal this door can ever answer. A byte window with no proved end, in a file
   * that records that trap a dozen times over.
   */
  const opens = sql.indexOf("as $$", start);
  assert.ok(opens > start, "the function's body does not open where this reader looks");
  const ends = sql.indexOf("$$", opens + 5);
  assert.ok(ends > opens, "the function's body has no end");
  const body = sql.slice(opens, ends);
  // AND THE WINDOW IS THIS FUNCTION'S, not most of the file — the observer, without which a
  // runaway slice reads as a thorough census.
  assert.ok(body.length < sql.length / 3, `the window is ${body.length} of ${sql.length} bytes`);
  const codes = [...new Set([...body.matchAll(/'error',\s*'([a-z-]+)'/g)].map((m) => m[1]))];
  assert.ok(codes.length >= 10, `the reader found ${codes.length} refusals — it is not reading the body`);
  /**
   * ⚠ **ONE CODE IS ANSWERED SOMEWHERE ELSE AND DELIBERATELY HAS NO SENTENCE**: `no-automation`
   * is the missing-automation 404, because an automation that is not this account's and one that
   * does not exist must be the same answer — a sentence here would make this door a 400 and tell a
   * stranger the id they guessed is real. It is NAMED so a second code cannot join it by accident,
   * and the route's own answer for it is DRIVEN below rather than taken on trust.
   */
  const ANSWERED_ELSEWHERE = new Set(["no-automation"]);
  for (const code of codes) {
    if (ANSWERED_ELSEWHERE.has(code)) {
      assert.equal(sayPatch({ error: code }), null, `\`${code}\` is answered twice, in two voices`);
      continue;
    }
    const said = sayPatch({ error: code });
    assert.equal(typeof said, "string", `\`${code}\` has no sentence, so the route answers 500`);
    assert.ok(said.length > 10, `\`${code}\`'s sentence is "${said}"`);
  }
  // AND A CODE IT HAS NEVER HEARD OF IS `null`, so the route can say the failure is OURS rather
  // than blaming a caller for something nobody here can name.
  assert.equal(sayPatch({ error: "something-new" }), null);
  assert.equal(sayPatch({}), null);
  assert.equal(sayPatch(null), null);

  /**
   * ⚠ **THE WHOLENESS SENTENCES NAME THE SCHEDULE, which is what makes them actionable.** The
   * function carries the resolved schedule on exactly those five, and "a daily schedule needs a
   * time zone" about a weekly one sends somebody to the wrong control.
   */
  assert.match(sayPatch({ error: "bad-zone", schedule: "weekly" }), /a weekly schedule needs a time zone/);
  assert.match(sayPatch({ error: "bad-time", schedule: "daily" }), /a daily schedule needs a time of day/);
  assert.match(sayPatch({ error: "bad-days", schedule: "weekly" }), /at least one day/);
  assert.match(sayPatch({ error: "bad-days", schedule: "daily" }), /clear the day list/);
  assert.match(sayPatch({ error: "bad-date", schedule: "once" }), /YYYY-MM-DD/);
  assert.match(sayPatch({ error: "bad-date", schedule: "weekly" }), /clear the date/);
  assert.match(sayPatch({ error: "bad-schedule", schedule: "manual" }), /by hand/);
  assert.match(sayPatch({ error: "bad-field", field: "colour" }), /"colour"/);
  // AND WITHOUT ONE IT IS THE SHAPE SENTENCE, which is the honest reading of a refusal about a
  // value rather than about the combination.
  assert.match(sayPatch({ error: "bad-zone" }), /isn't a time zone/);
  assert.match(sayPatch({ error: "bad-time" }), /HH:MM/);
});

test("⚠ THE TWO DOORS REFUSE THE SAME VALUE IN THE SAME WORDS", () => {
  /**
   * ⚠ **A CREATE AND AN EDIT ARE TWO READERS OF ONE QUESTION, and this is what stops them
   * drifting.** `cleanSchedule` reads a whole trigger and `cleanPatch` reads the fields an edit
   * named; both ask the same value readers, and the sentence a bad value earns has to be the same
   * either way — two copies of "which strings are days" is how one door comes to refuse what the
   * other stores.
   */
  const pairs = [
    [{ schedule: "daily", at: "25:00", zone: "UTC" }, { at: "25:00" }],
    [{ schedule: "daily", at: "9:00", zone: "UTC" }, { at: "9:00" }],
    [{ schedule: "daily", at: "09:00", zone: "Nowhere/Here" }, { zone: "Nowhere/Here" }],
    [{ schedule: "weekly", at: "09:00", zone: "UTC", days: ["moonday"] }, { days: ["moonday"] }],
    [{ schedule: "once", at: "09:00", zone: "UTC", on_date: "2027-02-29" }, { on_date: "2027-02-29" }],
    [{ schedule: "once", at: "09:00", zone: "UTC", on_date: "nonsense" }, { on_date: "nonsense" }],
    [{ on_event: "9bad" }, { on_event: "9bad" }],
    [{ schedule: "nonsense" }, { schedule: "nonsense" }],
    [{ schedule: ["daily"] }, { schedule: ["daily"] }],
  ];
  let seen = 0;
  for (const [whole, part] of pairs) {
    const a = cleanSchedule(whole);
    const b = cleanPatch(part, ROW);
    assert.ok(a.error, `the create accepted ${JSON.stringify(whole)}`);
    assert.ok(b.error, `the edit accepted ${JSON.stringify(part)}`);
    assert.equal(b.error, a.error, `the two doors say different things about ${JSON.stringify(part)}`);
    seen++;
  }
  assert.equal(seen, pairs.length);
  // THE OBSERVER: a value BOTH doors accept, so "they agree" is not satisfied by two readers that
  // refuse everything.
  assert.ok(!cleanSchedule({ schedule: "daily", at: "09:00", zone: "UTC" }).error);
  assert.ok(!cleanPatch({ at: "09:00" }, ROW).error);
});

test("⚠ `fieldNamed` READS PRESENCE AND NEVER TRUTH", () => {
  // `enabled: false`, `steps: []` and `zone: ""` are each a value somebody meant, and two of them
  // are falsy — they are the edits a person most needs to be able to make.
  assert.equal(fieldNamed({ enabled: false }, "enabled"), true);
  assert.equal(fieldNamed({ steps: [] }, "steps"), true);
  assert.equal(fieldNamed({ zone: "" }, "zone"), true);
  assert.equal(fieldNamed({ at: null }, "at"), true, "a null is a clear, which is an answer");
  assert.equal(fieldNamed({}, "name"), false);
  assert.equal(fieldNamed({ name: undefined }, "name"), false, "an explicit undefined says nothing");
  assert.equal(fieldNamed(null, "name"), false);
  assert.equal(fieldNamed("nonsense", "name"), false);
  // AND A PROTOTYPE'S KEY IS NOT A FIELD — `Object.hasOwn`, so `constructor` cannot be named.
  assert.equal(fieldNamed({}, "constructor"), false);
  // AND `AUTOMATION_PATCH_FIELDS` IS WHAT AN EDIT MAY NAME, both ways: every wire name is read by
  // `cleanPatch` and every patch key is one the transaction accepts.
  const PATCHABLE = ["name", "enabled", "schedule", "atLocal", "zone", "steps", "inputs", "days", "onDate", "onEvent"];
  assert.deepEqual(Object.values(AUTOMATION_PATCH_FIELDS).slice().sort(), PATCHABLE.slice().sort());
  for (const f of Object.keys(AUTOMATION_PATCH_FIELDS)) {
    const got = cleanPatch({ [f]: SAMPLE[f] }, ROW);
    assert.ok(!got.error, `${f} is named as patchable and ${JSON.stringify(got.error)}`);
    assert.ok(Object.hasOwn(got.patch, AUTOMATION_PATCH_FIELDS[f]),
      `${f} is named as patchable and never reaches the patch`);
  }
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

  // ⚠ **A VALUE THAT IS PRESENT AND OF THE WRONG KIND, not merely an absent one — and a
  // sweep survivor is why.** Every field above was driven with a MISSING value, which
  // `x || []` and `Array.isArray(x) ? x : []` answer identically, so the truthy-junk half
  // of failing closed was unasserted on all three list fields. It is not cosmetic: the
  // screen does `(row.inputs || []).map(...)`, and a string has no `.map`, so a junk row
  // would take the whole form down rather than merely misreport it.
  const wrong = automationRow({
    id: C1, agent_id: A1, name: "N", enabled: true, schedule: "weekly",
    at_local: "09:00:00", zone: "UTC",
    days: "mon,tue", steps: "s1", inputs: "who", on_date: 20260921, on_event: { name: "x" },
  });
  assert.deepEqual(wrong.days, [], "a `days` that is not a list must not reach the screen as one");
  assert.deepEqual(wrong.steps, []);
  assert.deepEqual(wrong.inputs, [], "an `inputs` that is not a list must not reach the screen as one");
  assert.equal(wrong.onDate, null);
  assert.equal(wrong.onEvent, null);
  // AND THE CONTROL, or "it answers []" is satisfied by a reader that answers [] always.
  const list = automationRow({ days: ["mon", "sun"], steps: [{ type: "note" }], inputs: [{ name: "who" }] });
  assert.equal(list.steps.length, 1);
  assert.deepEqual(list.inputs, [{ name: "who" }]);
  // ⚠ AND `days` COMES BACK IN THE CATALOG'S OWN ORDER, never the row's, so two saves of one
  // selection are byte-identical. **THE ORDER IS SUNDAY-FIRST** (`AUTOMATION_DAYS`, the way
  // `Date.getDay()` numbers them) — my own first draft of this assertion wrote Monday-first
  // and was red about a reader that is right. It is asserted as the PROPERTY rather than as
  // that spelling: the answer's positions in the catalog must strictly increase, so a reader
  // that took the row's order fails whatever the catalog's order becomes.
  assert.deepEqual(list.days, ["sun", "mon"], "the catalog's order, which starts on Sunday");
  const shuffled = automationRow({ days: ["sat", "wed", "sun", "fri"] }).days;
  const at = shuffled.map((d) => AUTOMATION_DAYS.indexOf(d));
  assert.deepEqual([...at].sort((x, y) => x - y), at, `not in the catalog's order: ${shuffled}`);
  assert.deepEqual([...shuffled].sort(), ["fri", "sat", "sun", "wed"], "and it is the same four days");
  // A DAY NOTHING RECOGNISES IS DROPPED, and the ones beside it survive.
  assert.deepEqual(automationRow({ days: ["mon", "funday", "fri"] }).days, ["mon", "fri"]);
});

test("⚠ AN EXECUTION HAS THREE WAYS OF HAVING STARTED, and reading `event` as `manual` is a claim about a person", () => {
  /**
   * ⚠ **REPRODUCED IN A BROWSER: the history said "Run now" about an execution an inbound
   * ENDPOINT started.** `executionRow` read `r.trigger === "schedule" ? "schedule" : "manual"`,
   * so the third word the column admits — `automation_runs_trigger_known` was widened for it
   * when an event could first start something, and `agent.dispatch_events` really files
   * `'event'` — collapsed into the one that says a PERSON pressed a button. Measured through
   * the site's own history route: `[["manual","done"],["schedule","done"]]` for a run nobody
   * had touched.
   *
   * ⚠ **AND THE FAIL-CLOSED DIRECTION IS THE POINT.** Every word here is a statement about who
   * or what started the run, so a value this cannot read gets `null` — the absence of a claim —
   * rather than the commonest of the three.
   */
  const of = (trigger) => executionRow({ id: R1, trigger, run_status: "running" }).trigger;
  assert.equal(of("manual"), "manual");
  assert.equal(of("schedule"), "schedule");
  assert.equal(of("event"), "event", "an event-started execution is reported as one somebody pressed");
  // THE THREE ARE THREE, which is what says none of them is standing in for another.
  assert.equal(new Set([of("manual"), of("schedule"), of("event")]).size, 3);
  // REFUSED, NEVER COERCED, and never read as `manual`.
  for (const junk of ["Event", "", "pressed", 7, true, {}, [], null, undefined]) {
    assert.equal(of(junk), null, `a trigger of ${JSON.stringify(junk)} claimed somebody started it`);
  }
  // AND THE VOCABULARY IS THE COLUMN'S OWN, read out of the migration that widened it rather
  // than from this list — two copies of one constraint drift, and the drift is silent.
  const sql = fs.readFileSync(path.join(import.meta.dirname, "..", "agent-builder", "supabase", "migrations",
    "20260918050000_agent_triggers.sql"), "utf8");
  const wid = sql.slice(sql.indexOf("add constraint automation_runs_trigger_known"));
  const admitted = [...wid.slice(0, wid.indexOf(")")).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...AUTOMATION_TRIGGERS].sort(), [...new Set(admitted)].sort(),
    `the reader admits ${JSON.stringify(AUTOMATION_TRIGGERS)} and the column admits ${JSON.stringify(admitted)}`);
});

test("⚠ STOP IS OFFERED FOR EXACTLY THE STATES A RUN THAT HAS NOT STOPPED CAN BE IN", () => {
  /**
   * ⚠ **THE MILESTONE'S OWN WORDS ARE *show Stop only when applicable*, and `AUTO_STOPPABLE` in
   * `public/chat.js` is a DECLARED COPY of that partition** — the browser cannot import from this
   * module, so this is what keeps it honest.
   *
   * It is derived by DRIVING `executionRow` rather than by reading a list, which is what makes a
   * fourth live state impossible to add without deciding this: whatever that reader answers for a
   * run whose `run_status` is not `stopped` is a state somebody can still stop.
   *
   * **`unresolved` IS THE ONE WORTH THE CASE.** It reads like something still in the air and it is
   * not: the run has ENDED and what is unknown is whether a message the provider never answered
   * for went out. A Stop there would offer to reach something already past reaching — and
   * `agent.cancel_run` would answer `alreadyStopped`, so the button would report success and
   * change nothing, which is the dead control that ANSWERS.
   */
  const live = new Set();
  const stopped = new Set();
  // EVERY STATE THE READER CAN PRODUCE, produced by a row that really produces it.
  for (const r of [
    { id: R1, run_status: "running", position: 0 },
    { id: R1, run_status: "running", position: 3 },
    { id: R1, run_status: "running", position: 3, waiting: { kind: "approval", step: "s1" } },
  ]) live.add(executionRow(r).state);
  for (const reason of ["done", "skipped", "failed", "rejected", "missed", "paused", "cancelled"]) {
    stopped.add(executionRow({ id: R1, run_status: "stopped", run_stop: { reason } }).state);
  }
  // AND THE UNCONFIRMED SEND, which is read off the STEP's own outcome rather than off the stop.
  stopped.add(executionRow({
    id: R1, run_status: "stopped", run_stop: { reason: "failed" },
    outcomes: [{ id: "s1", outcome: "failed", unresolved: true }],
  }).state);
  assert.deepEqual([...live].sort(), ["queued", "running", "waiting"],
    "the states a run that has not stopped can be in have moved");
  assert.ok(stopped.has("unresolved") && stopped.has("cancelled"),
    "the fixtures did not reach the two states this case is about");
  // ⚠ THE CENSUS ITSELF, BOTH WAYS. Every live state is offered Stop and no stopped state is,
  // read out of the browser's own source so the copy cannot drift from what this reader answers.
  const chat = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "chat.js"), "utf8");
  const m = chat.match(/const AUTO_STOPPABLE = \[([^\]]*)\]/);
  assert.ok(m, "the screen no longer declares which states can be stopped");
  const offered = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
  assert.deepEqual([...offered].sort(), [...live].sort(),
    `the screen offers Stop for ${JSON.stringify(offered)} and a run can be stopped in ${JSON.stringify([...live])}`);
  for (const s of stopped) {
    assert.equal(offered.includes(s), false, `Stop is offered for ${s}, which is a run that has already ended`);
  }
  // AND EVERY STATE THE READER CAN PRODUCE IS ON ONE SIDE OR THE OTHER, so one added next month
  // is forced into the decision rather than inheriting "not stoppable" in silence.
  for (const s of AUTOMATION_STATES) {
    assert.ok(live.has(s) || stopped.has(s), `${s} is a state no fixture here produces, so nothing decides whether it can be stopped`);
  }
});

test("⚠ WHAT BECAME OF AN ARRIVAL — four states, and `handled_at` is the discriminator", () => {
  /**
   * The milestone asks for the difference between an event being *received*, *rejected*,
   * *ignored*, or *starting a run*. Three of those are in this reader; **the fourth cannot be and
   * that is a fact about the platform** — a wrong signature, a stale timestamp or an unknown
   * address is refused by `/deliver/<id>` before any row is written, in one sentence deliberately
   * so the address is not an oracle for probing ids. So there is nothing recorded to list.
   *
   * ⚠ **THE COUNTS CANNOT TELL `queued` FROM `ignored` AND `handled_at` CAN.** `filed` and `woke`
   * are `not null default 0`, so a row the dispatcher has never looked at carries the same two
   * zeros as one it looked at and found nobody for. A stamp this cannot read is `queued`, which
   * is the fail-closed direction: *not yet* about something finished costs a second look, and
   * *nothing was listening* about an arrival nobody has examined is a claim about somebody's own
   * configuration.
   */
  const at = "2026-09-21T00:00:00Z";
  const of = (r) => eventRow({ id: C1, name: "order.paid", source: "webhook", at, ...r });
  assert.equal(of({ handled_at: null, filed: 0, woke: 0 }).state, "queued");
  assert.equal(of({ handled_at: at, filed: 0, woke: 0 }).state, "ignored");
  assert.equal(of({ handled_at: at, filed: 2, woke: 0 }).state, "started");
  assert.equal(of({ handled_at: at, filed: 0, woke: 1 }).state, "woke");
  // THE FOUR ARE FOUR, which is what says none is standing in for another.
  assert.equal(new Set([
    of({ handled_at: null, filed: 0, woke: 0 }).state,
    of({ handled_at: at, filed: 0, woke: 0 }).state,
    of({ handled_at: at, filed: 2, woke: 0 }).state,
    of({ handled_at: at, filed: 0, woke: 1 }).state,
  ]).size, 4);
  // ⚠ AN UNREADABLE STAMP IS `queued`, and an unreadable COUNT is zero rather than a state.
  for (const junk of ["", 7, true, {}, [], undefined]) {
    assert.equal(of({ handled_at: junk, filed: 5, woke: 0 }).state, "queued",
      `a handled_at of ${JSON.stringify(junk)} was read as a dispatch that happened`);
  }
  for (const junk of ["2", 1.5, true, null, undefined, {}]) {
    assert.equal(of({ handled_at: at, filed: junk, woke: junk }).state, "ignored",
      `a count of ${JSON.stringify(junk)} was read as a number`);
  }
  // ⚠ **THE COUNT RIDES ONLY ON THE STATE IT IS ABOUT**, the way `run_open_calls` does one reader
  // over: a `0` on `ignored` invites somebody to draw it, and a `0` on `queued` reports a column
  // default as a measurement.
  assert.equal(of({ handled_at: at, filed: 2, woke: 0 }).started, 2);
  assert.equal(of({ handled_at: at, filed: 0, woke: 0 }).started, undefined);
  assert.equal(of({ handled_at: at, filed: 0, woke: 1 }).woke, 1);
  assert.equal(of({ handled_at: null, filed: 0, woke: 0 }).woke, undefined);
  // ⚠ **A RUN ENTRY NAMES ITS AUTOMATION OR IT IS DROPPED.** An execution is read through its
  // automation's history, so a bare id could not be opened from anywhere — a button that answers
  // nothing. Both halves, or the entry is not carried.
  assert.deepEqual(of({ handled_at: at, filed: 1, runs: [{ id: R1, automation: A1 }] }).runs,
    [{ id: R1, automation: A1 }]);
  for (const bad of [[R1], [{ id: R1 }], [{ automation: A1 }], [{ id: R1, automation: "" }], ["", null, 7], "runs", {}]) {
    assert.deepEqual(of({ handled_at: at, filed: 1, runs: bad }).runs, [],
      `runs of ${JSON.stringify(bad)} produced an entry nothing can open`);
  }
  // NO PAYLOAD, AND THE FUNCTION DOES NOT SELECT ONE — so the absence is structural rather than
  // this reader choosing not to draw one. Asserted on the projection's own key set.
  const keys = Object.keys(of({ handled_at: at, filed: 1, payload: { card: "4242" } })).sort();
  assert.deepEqual(keys, ["at", "handledAt", "id", "name", "runs", "source", "started", "state"],
    "the arrival projection carries a key nobody decided on");
  // AND THE VOCABULARY THE ROUTE HANDS THE SCREEN IS THIS READER'S OWN, both ways, with the
  // browser's words censused against it — a state with no word draws a blank.
  const chat = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "chat.js"), "utf8");
  const w = chat.slice(chat.indexOf("const WH_EVENT_WORDS = {"));
  const worded = [...w.slice(0, w.indexOf("}")).matchAll(/^\s{2}([a-z]+):/gm)].map((x) => x[1]);
  assert.deepEqual([...AGENT_EVENT_STATES].sort(), [...worded].sort(),
    `the server answers ${JSON.stringify(AGENT_EVENT_STATES)} and the screen has words for ${JSON.stringify(worded)}`);
});

test("⚠ THE ARRIVALS READ IS THE FUNCTION'S OWN, SCOPED, AND THE ROUTE HANDS THE SCREEN ITS WORDS", async () => {
  /**
   * ⚠ **THE REQUEST, NOT THE ANSWER — and a sweep survivor is why this exists.** The tenant
   * census above drives a FAKE store, and the events route asks `ownsAgent(who, agentId)`
   * BEFORE it reads the log, so the tenant reaches *a* call whatever `listEvents` then sends:
   * dropping `p_tenant` from its own body changed nothing any case could see. `service_role`
   * bypasses row level security, so that argument is the WALL rather than the belt — without
   * it `agent.list_events` is asked for a tenant it was never given.
   */
  const seen = [];
  const store = makeAgentStore({
    url: "https://db.example", key: "k",
    fetch: async (url, opts) => {
      seen.push({ url: String(url), method: opts.method, headers: opts.headers,
                  body: opts.body ? JSON.parse(opts.body) : undefined });
      return { ok: true, status: 200, text: async () => JSON.stringify([]) };
    },
  });
  await store.listEvents(T1, A1);
  assert.equal(seen.length, 1, `reading the log made ${seen.length} requests`);
  const [ask] = seen;
  assert.match(ask.url, /rpc\/list_events/, "the log is not read through the function that scopes it");
  assert.equal(ask.method, "POST");
  assert.deepEqual(Object.keys(ask.body).sort(), ["p_agent_id", "p_limit", "p_tenant"],
    "the arrivals read's arguments are not the function's own");
  assert.equal(ask.body.p_tenant, T1, "the log went out with no account on it");
  assert.equal(ask.body.p_agent_id, A1, "the log was not scoped to one agent");
  // ⚠ THE CEILING TRAVELS WITH IT rather than being left to the parameter's own default: this
  // side decides how much of a log a screen is handed, and the route's own answer says so.
  assert.equal(ask.body.p_limit, MAX_EVENT_LOG, "the ceiling is not handed to the function");
  // A WRITE'S PROFILE HEADER IS THE VERB'S — PostgREST ignores the read header on a POST, which
  // is how a DELETE in this module once resolved against `public` and could never have worked.
  assert.equal(ask.headers["content-profile"], "agent");
  assert.equal(ask.headers["accept-profile"], undefined);
  // AND NOTHING READS THE TABLE DIRECTLY: `service_role` holds no SELECT on `agent.events` at
  // all, which is what makes the definer function the only door.
  assert.ok(!seen.some((r) => r.method === "GET" && /agent_events|\/events\?/.test(r.url)),
    "the arrival log is being read straight out of the table");

  /**
   * ⚠ **AND THE VOCABULARY IS ON THE WIRE, for the same reason `AGENT_TOOLS` is.** The screen
   * draws each word from `WH_EVENT_WORDS`, censused against `AGENT_EVENT_STATES` above — but a
   * browser that had to guess which states exist would draw a blank for one this server added,
   * so the list travels with the answer. Dropping it is a red run rather than a quiet blank.
   */
  const events = [{ id: R1, name: "order.paid", source: "wh", at: "2026-09-21T09:00:00Z",
                    handled_at: "2026-09-21T09:00:01Z", filed: 1,
                    runs: [{ id: R1, automation: A1 }] }].map(eventRow);
  const got = [];
  const r = await call("/api/agent/events", {
    query: new URLSearchParams({ agent: A1 }),
    store: {
      ownsAgent: async () => true,
      listEvents: async (...args) => { got.push(args); return events; },
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.events, events);
  assert.deepEqual(r.body.states, [...AGENT_EVENT_STATES],
    "the screen is left to guess which states this server can answer");
  assert.equal(r.body.max, MAX_EVENT_LOG);
  // AND THE ACCOUNT IS THE SESSION'S, taken as the read's own first argument rather than off
  // the request — there is nowhere on this route to put one, and this is what says so.
  assert.deepEqual(got, [[T1, A1]], "the log was not read for the signed-in account and that agent");
});

test("⚠ READING THE INBOUND ENDPOINTS BACK IS A LIST, and `answerOf` refuses one by design", async () => {
  /**
   * ⚠ **`/api/agent/webhooks` HAD NEVER ONCE WORKED, and it was dead by construction.**
   * `agent.list_webhooks` is `returns jsonb` over a `jsonb_agg`, so PostgREST answers a bare
   * JSON ARRAY — and `answerOf` refuses an array deliberately, because its nineteen other
   * callers read a `{ok, …}` object and an array there is a broken shape. So every read threw
   * `no answer came back`, the route answered **502 `couldn't save that just now`**, and the
   * `Array.isArray(a) ? … : []` line beneath it was unreachable: the handling that reads as the
   * fix. MEASURED in a browser journey, for every account, every time.
   *
   * **NOTHING COULD SEE IT**: the four endpoint routes are on `NO_SCREEN_YET` so no browser
   * reaches them, `test/agent-api.test.mjs` drives a FAKE `listWebhooks` that answers `[]`, and
   * the store-request census above answers `{ok: true, id}` to every rpc — *three fixtures all
   * more capable than PostgREST, in the one function whose defect they were hiding.*
   *
   * So this drives the REAL store against the shape PostgREST really sends.
   */
  const answers = [];
  const store = makeAgentStore({
    url: "https://db.example", key: "k",
    fetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(answers.shift()) }),
  });
  answers.push([{ id: C1, name: "paid", event_name: "order.paid", enabled: true, last_at: null, created_at: "2026-09-20T00:00:00Z" }]);
  const got = await store.listWebhooks(T1, A1);
  assert.deepEqual(got, [webhookRow({ id: C1, name: "paid", event_name: "order.paid", enabled: true, last_at: null, created_at: "2026-09-20T00:00:00Z" })]);
  // AN ACCOUNT WITH NONE IS AN EMPTY LIST, which is a real answer and the commonest one.
  answers.push([]);
  assert.deepEqual(await store.listWebhooks(T1, A1), []);
  /**
   * ⚠ **AND A SHAPE IT CANNOT READ IS REFUSED, NEVER `[]`.** `rows()` answers an empty list for
   * anything — right for a table read, wrong here: *"this account has no inbound endpoints"* is
   * a claim, and a read that came back malformed is not entitled to make it. Every one of these
   * is a shape a deployment really produces (a function that answered an object, a read that
   * was refused, a column that was not sent).
   */
  for (const bad of [{ ok: true }, null, "a string", 7, true]) {
    answers.push(bad);
    await assert.rejects(() => store.listWebhooks(T1, A1), /list endpoints/,
      `an answer of ${JSON.stringify(bad)} read as an account with no endpoints`);
  }
  // AND NO SECRET IS EVER ASKED FOR: the column is the one thing `list_webhooks` never selects,
  // so a reader that started admitting one would be reading a field that cannot arrive.
  assert.ok(!Object.keys(webhookRow({ id: C1, secret: "s3cret" })).some((k) => /secret/i.test(k)),
    "the endpoint reader carries a credential-shaped field");
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

test("the list read hands the catalog over with it, in one answer", async () => {
  // ONE READ FOR THE SCREEN: the form is only reachable from the list, so a catalog
  // arriving separately would be a second thing to fail and a second state to draw.
  const f = fakeStore();
  const r = await call("/api/agent/automations", { store: f.store, query: new URLSearchParams({ agent: A1 }) });
  assert.deepEqual(r.body.steps, AUTOMATION_STEPS);
  assert.deepEqual(r.body.days, AUTOMATION_DAYS);
  assert.equal(r.body.max, MAX_AUTOMATIONS);
  /**
   * ⚠ **A CENSUS OVER WHAT THE ANSWER REALLY CARRIES, RE-ANCHORED FROM THREE NAMED KEYS.**
   * This case asserted `steps`, `days` and `max` and said nothing about `maxInputs` — which
   * the route has sent all along and the BROWSER was dropping, so both its readers fell
   * through to a hardcoded `8`. It agreed with `MAX_AUTOMATION_INPUTS` by luck, which is
   * what made it invisible. A census of the whole key set is what a spelling cannot do: the
   * `example` added this round, and anything added next month, fails by existing.
   */
  assert.deepEqual(Object.keys(r.body).sort(),
    ["agent", "automations", "days", "example", "max", "maxInputs", "ok", "steps"],
    "every key the catalog answer carries is asserted here, and it carries no other");
  assert.equal(r.body.maxInputs, MAX_AUTOMATION_INPUTS);
  // ⚠ **AND THE EXAMPLE REALLY REACHES THE WIRE.** A census that drove `EXAMPLE_AUTOMATION`
  // directly could not see the route dropping it — measured, and the whole feature is gone
  // in silence when it does, because the button is drawn only when the key arrives.
  assert.deepEqual(r.body.example, EXAMPLE_AUTOMATION);
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
    // ⚠ GROWN BY FOUR, and still not by an exemption. `provider`, `account`, `label` and
    // `scopes` are fields of the CONNECTED ACCOUNT being made and none can name the account
    // that OWNS it. `provider` is looked up in `AGENT_PROVIDERS` — a positive list in code, so
    // a name with no adapter behind it is refused rather than becoming a connection that saves
    // and fails at every send; `scopes` goes through `cleanScopes`, which refuses a permission
    // this platform does not offer rather than dropping it; `account` and `label` are the
    // person's own words about which mailbox it is. **AND `secret` IS NOT HERE AND MUST NEVER
    // BE**: the route MINTS the credential, so there is nowhere for a caller-chosen one to
    // arrive — and unlike a webhook's, it is never answered either.
    "provider", "account", "label", "scopes",
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

test("⚠ THE ROUTE HANDS THE WHOLE DECLARATIONS TO THE VALIDATOR, and the difference is a TYPE", async () => {
  /**
   * ⚠ **THE DEFECT, REPRODUCED before this existed.** The route read
   * `declared.inputs.map((i) => i.name)`, so every declaration reached `cleanWorkflow` as a
   * bare string — which that reader correctly takes to mean `text`. MEASURED: a `list` input
   * with a loop over it was refused `step 1: "lines" is text, and the list to go through
   * needs a list`, on a workflow the engine's own `readWorkflow` accepts with the same
   * declarations. So a declared list was a kind of thing a person could save and never use.
   *
   * **AND THE CROSS-PRODUCT CENSUS COULD NOT SEE IT**, which is why this case lives here and
   * not there: `test/agent-send.test.mjs` drives both validators with REAL declarations and
   * requires the same verdict, and they agree — the type was dropped one hop above, in the
   * argument this route builds. *A guard proves the branch it drives, and no other.*
   */
  const LOOP = [
    { type: "repeat", mode: "each", each: "{{lines}}", as: "line" },
    { type: "note", text: "item {{line}}" },
    { type: "endrepeat" },
  ];
  const f = fakeStore();
  const saved = await call("/api/agent/automation-create", {
    store: f.store,
    body: { agent: A1, name: "Loopy", steps: LOOP, inputs: [{ name: "lines", type: "list" }] },
  });
  assert.equal(saved.status, 200, `a loop over a declared list was refused: ${JSON.stringify(saved.body)}`);
  // AND THE TYPE REALLY REACHED THE STORE, so what the column holds can be read back as a list.
  const made = f.calls.find((c) => c.name === "createAutomation");
  assert.deepEqual(made.args[1].inputs, [{ name: "lines", label: "lines", required: false, default: "", type: "list" }]);

  // ⚠ **THE CONTROL, which is what makes the line above about the TYPE rather than about the
  // route accepting everything**: the same steps with the same name declared as TEXT are
  // refused, because text is not a list — and that refusal is the one the defect produced
  // for a correct workflow.
  const g = fakeStore();
  const wrong = await call("/api/agent/automation-create", {
    store: g.store,
    body: { agent: A1, name: "Loopy", steps: LOOP, inputs: [{ name: "lines", type: "text" }] },
  });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /"lines" is text, and the list to go through needs a list/);
  assert.ok(!g.calls.some((c) => c.name === "createAutomation"), "a refused workflow was written anyway");

  // ⚠ **AND A TYPE THE READER DOES NOT RECOGNISE IS `text`, NOT WHATEVER IT SAYS.** A sweep
  // survivor is why, and where the difference SHOWS is measured rather than guessed:
  // `cleanWorkflow` is EXPORTED, so a caller that has not been through `cleanInputs` can hand
  // it `type: "lsit"` — and `AUTOMATION_TYPE_ACCEPTS["lsit"]` is `undefined`, a lookup nothing
  // can satisfy, which reads exactly like no wall at all.
  //
  // ⚠ **A LOOP CANNOT SEE IT** — measured: an unknown type and `text` both come back
  // *"is text, and the list to go through needs a list"*, because the refusal normalises an
  // unrecognised type to text as well. **A NOTE is the shape that separates them**: reading an
  // unknown type as text ACCEPTS the sentence (which is right, and is what a declaration with
  // no type means), and reading it as itself REFUSES a legitimate workflow.
  const PROSE = [{ type: "note", text: "the names are {{lines}}" }];
  const decl = (type) => cleanWorkflow(PROSE, AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, [{ name: "lines", type }]);
  assert.equal(decl("lsit").error, undefined, "an unrecognised type was not read as text");
  assert.equal(decl(undefined).error, undefined, "a declaration with no type was not read as text");
  // AND THE CONTROL, which is what makes those two about the TYPE rather than about a note
  // accepting everything: a real `list` in prose is refused, because `String(["a"])` is `"a"`.
  assert.match(String(decl("list").error), /"lines" is a list, and that note needs text/);

  // AND THE EDIT IS THE SAME DOOR, so a workflow that can be created can be changed.
  const h = fakeStore();
  const edit = await call("/api/agent/automation-update", {
    store: h.store,
    body: { id: C1, name: "Loopy", steps: LOOP, inputs: [{ name: "lines", type: "list" }] },
  });
  assert.equal(edit.status, 200, `the edit refused it: ${JSON.stringify(edit.body)}`);
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
  // ⚠ RE-ANCHORED AGAIN: it gained `request`, which names WHICH DOOR answers the pause and is
  // `null` for an approval STEP — see the case below. Whole rather than a subset, for the reason
  // above it.
  // ⚠ RE-ANCHORED A THIRD TIME: it gained `payload`, declared `null` here and filled by the
  // ROUTE from the persisted approval request. Declaring it is what keeps the shape fixed — a
  // `payload` key inside a stored pause must not reach the screen, because the arguments have one
  // home and it is the request the hash is over. Whole rather than a subset, for the same reason.
  assert.deepEqual(suspended.waiting, {
    kind: "approval", step: "s8", ask: "Send this?", onTimeout: "reject", until: "2026-09-18T09:00:00Z",
    event: null, request: null, payload: null,
  });
  // ⚠ AND A STORED `payload` IS UNREADABLE FROM HERE, which is the half that makes the sentence
  // above a wall rather than a preference: the arguments a person is shown come from the request,
  // so a pause that carried its own copy could disagree with the hash the database compares.
  const smuggled = executionRow({
    run_status: "running",
    waiting: { kind: "approval", step: "s8", request: "req-1", payload: { body: "not this" } },
  });
  assert.equal(smuggled.waiting.payload, null);
  assert.ok(!JSON.stringify(smuggled.waiting).includes("not this"));
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
  /**
   * ⚠ **WHICH DOOR ANSWERS A PAUSE, AND THE TWO ARE NOT INTERCHANGEABLE.**
   *
   * A `Wait for approval` STEP and a `send` step store a pause byte-identical in shape, and
   * they are answered by two different functions — the automation's own decision, keyed by the
   * run and the step, and a TOOL approval bound to the payload's hash, keyed by the request's
   * own id. MEASURED before the engine named it: the history's one Approve button sent the
   * step's decision, the database answered `ok`, the run was requeued, the send found its
   * request still pending and it paused at the same step again, for ever, with nothing sent.
   *
   * `request` is the request's ID rather than a flag because the tool door needs exactly that
   * value: the two do not even number their steps the same way (`"s8"` against the index `2`),
   * so nothing could match them without a mapping.
   */
  const sendPause = executionRow({
    run_status: "running",
    waiting: {
      kind: "approval", step: "s8", ask: "send to ada@example.test from shop@example.test",
      on_timeout: "fail", request: "11111111-2222-4333-8444-555555555555",
    },
  });
  assert.equal(sendPause.waiting.request, "11111111-2222-4333-8444-555555555555");
  // AND IT IS REFUSED RATHER THAN COERCED, in both directions that matter: a pause carrying
  // something that is not a request names no door, and `null` is what an approval STEP and
  // every pause written before this field existed both read as — which is the automation's own
  // door, and is right for them.
  for (const junk of [7, true, {}, [], "", null, undefined]) {
    assert.equal(
      executionRow({ run_status: "running", waiting: { kind: "approval", step: "s8", request: junk } }).waiting.request,
      null, `a request of ${JSON.stringify(junk)} named a door`);
  }

  // A TIMED WAIT STILL SAYS NO EVENT, which is the control that makes the line above about the
  // kind rather than about the field existing.
  assert.equal(executionRow({ run_status: "running", waiting: { kind: "wait", step: "s2" } }).waiting.event, null);

  // AND A PAUSE OF A KIND IT CANNOT READ IS A WAIT, never an approval: drawing an Approve
  // button for something no decision will ever be read from is a dead control that answers.
  assert.equal(executionRow({ run_status: "running", waiting: { kind: "nonsense", step: "s2" } }).waiting.kind, "wait");
  assert.equal(executionRow({ run_status: "running", waiting: { kind: "approval", step: "s8", on_timeout: "maybe" } })
    .waiting.onTimeout, null, "a timeout outcome this cannot read is not invented");
});

test("⚠ WHAT A WAITING SEND WOULD SEND is joined on from the PERSISTED request", () => {
  /**
   * ⚠ **THE DEFECT: the history offered Approve with the message nowhere on the screen.**
   *
   * A send's pause carries `ask`, which reads *"send to … from …"* — the sender and the
   * recipient — and nothing of the words. So somebody could approve a message they had never
   * read. `withWaitingPayloads` joins the persisted request's own arguments onto the pause that
   * names it, and everything below is about which source that is and what happens when it is
   * not there.
   */
  const REQ = "99999999-1111-4222-8333-444444444444";
  const ARGS = { connection: "c1", provider: "fake", account: "shop@example.test",
                 to: "ada@example.test", body: "Tuesday at 9, £95." };
  // DERIVED FROM THE REAL READER, so a fixture cannot be in a shape `pending_approvals` does
  // not produce — which is how a join like this passes over an answer nothing really sends.
  const pending = toolApprovalRow({ id: REQ, run: R1, agent: A1, tool: "send_message", args: ARGS, step: 1, index: 0 });
  const sendPause = executionRow({
    id: R1, run_status: "running", position: 3,
    waiting: { kind: "approval", step: "s3", request: REQ, ask: "send to ada@example.test from shop@example.test" },
  });
  const stepPause = executionRow({
    id: "R2", run_status: "running", position: 1,
    waiting: { kind: "approval", step: "s1", ask: "Send it?" },
  });

  const [send, step] = withWaitingPayloads([sendPause, stepPause], [pending]);
  assert.deepEqual(send.waiting.payload, ARGS, "the words a person has to read did not arrive");
  // ⚠ AND AN APPROVAL STEP IS UNTOUCHED, which is the control that makes the line above about
  // the join rather than about every pause getting a payload from somewhere.
  assert.equal(step.waiting.payload, null);
  assert.equal(step.waiting.request, null);
  // NOTHING ELSE OF THE PAUSE MOVES — the join replaces one key and copies the rest.
  assert.equal(send.waiting.ask, "send to ada@example.test from shop@example.test");
  assert.equal(send.waiting.step, "s3");
  assert.equal(send.position, 3);

  /**
   * ⚠ **IT FAILS CLOSED, and every one of these is a screen that must not offer Approve.**
   * *Cannot-tell must never read as a value*, and the value here would be somebody's consent.
   */
  for (const [what, requests] of [
    ["the request is not in the page at all", []],
    ["a read that failed and answered nothing", null],
    ["a row with no id to match on", [{ ...pending, id: "" }]],
    ["a row that came back through the reader with nothing readable", [toolApprovalRow({ id: REQ, args: "hello" })]],
    ["no arguments at all", [toolApprovalRow({ id: REQ })]],
    /**
     * ⚠ **AND ITS OWN TEST, driven with RAW rows, which is what makes it a wall rather than a
     * line that happens to be true.** In the route these rows always come through
     * `toolApprovalRow`, whose own `readable` test has already folded a string or a list to
     * `null` — so the two are a DECLARED redundancy, and each is drivable on its own: this
     * function is exported and pure, and a caller handing it `pending_approvals` rows directly
     * is the shape only its own test refuses.
     */
    ["a raw row whose arguments are a string", [{ id: REQ, args: "hello" }]],
    ["a raw row whose arguments are a list", [{ id: REQ, args: ["hello"] }]],
    ["a raw row whose arguments are a number", [{ id: REQ, args: 7 }]],
  ]) {
    const [only] = withWaitingPayloads([sendPause], requests);
    assert.equal(only.waiting.payload, null, what);
    assert.equal(only.waiting.request, REQ, `${what}: the request itself must stay, or the screen loses the third state`);
  }
  // A non-list of executions answers a list rather than throwing, because this runs on the
  // answer of a read that is allowed to fail.
  assert.deepEqual(withWaitingPayloads(null, [pending]), []);
  // ⚠ AND `{}` IS A REAL ANSWER AND IS NOT `null`: a call that takes no arguments is drawable,
  // and folding it into "could not be read" is the M12-2 defect through the other door.
  const [none] = withWaitingPayloads([sendPause], [toolApprovalRow({ id: REQ, args: {} })]);
  assert.deepEqual(none.waiting.payload, {});
});

test("⚠ the history's payload is the REQUEST's, never the automation's editable configuration", async () => {
  /**
   * ⚠ **THE ONE CLAIM THIS ROUTE HAS TO MAKE.** The two sources can differ — somebody edits
   * the workflow while a run waits — and the editable row is the wrong one twice over: it is
   * not what was put up for approval, and it is not what the hash on the request is over, so a
   * screen drawing it would show a message the database will refuse to match. The fixture makes
   * them differ on purpose, and nothing of the stored configuration may appear.
   */
  const REQ = "99999999-1111-4222-8333-444444444444";
  const SHOWN = "Tuesday at 9, £95.";
  const EDITED = "Wednesday at 2, £150.";
  // COUNTED HERE RATHER THAN OFF `f.calls`, because an override replaces the recording wrapper:
  // asserting on a list an override never writes to is a check that cannot fail.
  let asked = 0;
  const f = fakeStore({
    executions: async () => [executionRow({
      id: R1, run_status: "running", waiting: { kind: "approval", step: "s3", request: REQ },
    })],
    listToolApprovals: async (tenant, agentId) => {
      asked++;
      assert.equal(tenant, T1, "the payload read was not scoped to the tenant the handler was given");
      assert.equal(agentId, null, "the join is by the request id a pause names, so narrowing by agent is a second read for no wall");
      return [toolApprovalRow({ id: REQ, args: { account: "shop@example.test", to: "ada@example.test", body: SHOWN } })];
    },
    // THE AUTOMATION AS IT STANDS NOW, saying something else entirely.
    readAutomation: async () => ({ id: C1, agentId: A1, name: "n", inputs: [],
      steps: [{ id: "s3", type: "send", connection: "c1", to: "someone@else.test", body: EDITED }] }),
  });
  const r = await call("/api/agent/automation-history", { store: f.store, query: new URLSearchParams({ id: C1 }) });
  assert.equal(r.status, 200);
  assert.equal(r.body.executions[0].waiting.payload.body, SHOWN);
  assert.ok(!JSON.stringify(r.body).includes(EDITED), "the editable configuration reached the screen");
  assert.ok(!JSON.stringify(r.body).includes("someone@else.test"));

  /**
   * ⚠ **ASKED ONLY WHEN SOMETHING IS WAITING ON A REQUEST**, so every other history read —
   * which is nearly all of them — costs exactly what it did before.
   */
  const quiet = fakeStore({
    executions: async () => [executionRow({ id: R1, run_status: "running", waiting: { kind: "approval", step: "s3" } })],
  });
  await call("/api/agent/automation-history", { store: quiet.store, query: new URLSearchParams({ id: C1 }) });
  assert.equal(quiet.calls.filter((c) => c.name === "listToolApprovals").length, 0,
    "a history with nothing waiting on a request still asked for the payloads");
  // AND THE CONTROL: the read above really does happen when one IS waiting, or the line is
  // satisfied by a route that never asks at all.
  assert.equal(asked, 1);

  /**
   * ⚠ **A FAILURE THERE DOES NOT FAIL THE HISTORY.** The history is worth showing either way,
   * and a payload that could not be read leaves `null`, which the screen explains and will not
   * offer Approve for — fail closed, not fail whole.
   */
  const broke = fakeStore({
    executions: async () => [executionRow({
      id: R1, run_status: "running", waiting: { kind: "approval", step: "s3", request: REQ },
    })],
    listToolApprovals: async () => { throw new Error("PostgREST said no"); },
  });
  const said = [];
  const r2 = await call("/api/agent/automation-history", {
    store: broke.store, query: new URLSearchParams({ id: C1 }), log: (...a) => said.push(a.join(" ")),
  });
  assert.equal(r2.status, 200, "a payload that could not be read failed the whole history");
  assert.equal(r2.body.executions[0].waiting.payload, null);
  assert.equal(r2.body.executions[0].waiting.request, REQ);
  assert.ok(said.some((l) => /payloads could not be read/.test(l)), "it failed silently");
});

/**
 * ⚠ **THE RUN AN ARRIVAL NAMES, and the older one that is the whole reason this exists.**
 *
 * An arrival records both halves (`{id, automation}`) and "Open the run" used to carry only the
 * automation, so two arrivals starting two runs of ONE automation opened the same page with
 * nothing saying which row was the one pressed. `run=` is that id coming back.
 *
 * Every arm is driven through the route, because the interesting half is what went to the store:
 * whether the extra read happened at all, and what it was asked for.
 */
test("⚠ a named run outside the newest page is fetched, appended, and never faked", async () => {
  const R2 = "dddddddd-2222-2222-3333-444444444444";
  const OLD = "dddddddd-9999-2222-3333-444444444444";
  /**
   * The page as the store really answers it: newest first, and `executionRow`'s own shape.
   *
   * ⚠ **A FUNCTION, because `store.executions` answers a FRESH array on every call** — it is
   * `rows(r).map(executionRow)`. One shared array here was a fixture the real store cannot
   * produce, and it cost this case a false failure: the arm above it appends the older run to
   * whatever it was handed, so a shared array arrived at the next arm already holding the run
   * the next arm is about, and a read that correctly did not happen read as the product's.
   */
  const page = () => [
    executionRow({ id: R2, automation_id: C1, created_at: "2026-09-21T10:00:00+00:00" }),
    executionRow({ id: R1, automation_id: C1, created_at: "2026-09-21T09:00:00+00:00" }),
  ];
  const older = executionRow({ id: OLD, automation_id: C1, created_at: "2026-08-01T09:00:00+00:00" });

  // ── TWO ARRIVALS, TWO RUNS OF ONE AUTOMATION, both on the page. ────────────────────
  // Each names a DIFFERENT run and each answer has to carry it: this is the defect's own
  // scenario, and the two ids are what tell the two answers apart.
  // The one-run read is RECORDED HERE rather than read off `f.calls`, because `fakeStore`
  // records the operations it declares and an OVERRIDE replaces one — so an arm that overrides
  // the answer has to keep its own note of the arguments.
  for (const want of [R1, R2]) {
    const asked = [];
    const f = fakeStore({
      executions: async () => page(),
      execution: async (...a) => { asked.push(a); return older; },
    });
    const r = await call("/api/agent/automation-history", {
      store: f.store, query: new URLSearchParams({ id: C1, run: want }),
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.executions.some((e) => e.id === want), `the history lost the run ${want} names`);
    // ⚠ AND NOTHING EXTRA WAS READ: the page holds it, so a second read would be a request
    // per open for a row already in hand. This is the control that makes the arm below
    // about the page really lacking the run rather than about the route always fetching.
    assert.deepEqual(asked, [], "a run the page already holds was fetched again");
    // AND THE OTHER RUN IS STILL THERE: one arrival's run being marked must not take the
    // other arrival's off the history.
    assert.deepEqual(r.body.executions.map((e) => e.id), [R2, R1]);
  }

  // ── AN OLDER RUN, OUTSIDE THE PAGE. ───────────────────────────────────────────────
  /**
   * ⚠ A FULL PAGE, at the real ceiling rather than a token two rows: the run that has fallen off
   * the end is what this hop exists for, and a two-row fixture does not look like the state it is
   * about. The store's own `limit=` and its ordering are asserted in the census above, so "outside
   * the newest page" is tied to the number the product really sends.
   */
  const full = () => [
    ...Array.from({ length: MAX_EXECUTIONS - 1 }, (_, i) =>
      executionRow({ id: `dddddddd-0000-2222-3333-${String(i).padStart(12, "0")}`, automation_id: C1 })),
    executionRow({ id: R1, automation_id: C1, created_at: "2026-09-21T09:00:00+00:00" }),
  ];
  const took = [];
  const handed = full();
  assert.equal(handed.length, MAX_EXECUTIONS, "the page fixture is not a full page");
  const f = fakeStore({
    executions: async () => handed,
    execution: async (...a) => { took.push(a); return older; },
  });
  const r = await call("/api/agent/automation-history", {
    store: f.store, query: new URLSearchParams({ id: C1, run: OLD }),
  });
  assert.equal(r.status, 200);
  assert.equal(took.length, 1, "a run the page does not hold was never fetched");
  // ⚠ THE TENANT AND THE AUTOMATION GO WITH IT. By id alone this would be a read of any
  // execution on the platform: `service_role` bypasses row level security, so what is in
  // the arguments is the wall. `ownsAutomation` above is the belt.
  assert.deepEqual(took[0], [T1, C1, OLD]);
  assert.ok(!JSON.stringify(took).includes(T2), "an account nobody sent reached the store");
  // ⚠ APPENDED, NEVER PREPENDED: the page is the newest 50 `created_at.desc`, so a run
  // outside it is older than every row in it and last is where it belongs. Prepended, the
  // list would claim a month-old execution was the most recent thing that happened.
  assert.equal(r.body.executions.length, MAX_EXECUTIONS + 1, "the fetched run did not join the page");
  assert.equal(r.body.executions.at(-1).id, OLD, "the older run was put somewhere other than last");
  assert.equal(r.body.executions.at(-2).id, R1, "the page's own last row moved");
  // ⚠ AND THE STORE'S OWN ANSWER IS NOT WRITTEN INTO. `store.executions` hands back a fresh
  // array today, so a `push` would be safe today — and that is a rule resting on a layer below,
  // with nothing to announce it if the store ever shares or caches one. Asserted on the object
  // the fake really handed over.
  assert.equal(handed.length, MAX_EXECUTIONS,
    "the route wrote the run it fetched into the array the store handed it");
  assert.equal(handed.some((e) => e.id === OLD), false);

  // ── A RUN THAT IS NOT THERE: said, not substituted. ───────────────────────────────
  // `null` is a real answer — the run may have been pruned, or belong to another automation
  // or another account, which the store's own filter turns into the same `null`. The list must
  // come back exactly as it was, so the screen can say so rather than mark a different row.
  const missed = [];
  const gone = fakeStore({
    executions: async () => page(),
    execution: async (...a) => { missed.push(a); return null; },
  });
  const r2 = await call("/api/agent/automation-history", {
    store: gone.store, query: new URLSearchParams({ id: C1, run: OLD }),
  });
  assert.equal(r2.status, 200, "a run that could not be found failed the whole history");
  assert.equal(missed.length, 1);
  assert.deepEqual(r2.body.executions.map((e) => e.id), [R2, R1]);
  assert.ok(!JSON.stringify(r2.body).includes(OLD), "the answer named a run it does not carry");

  // ── JUNK IS NOT A RUN. ───────────────────────────────────────────────────────────
  // `cleanId` refuses it, so nothing is read — and the history is still answered, because a
  // malformed `run=` is not a reason to refuse somebody their own history.
  for (const junk of ["", "not-a-uuid", "../../etc", String(R1) + " or 1=1"]) {
    const reached = [];
    const j = fakeStore({
      executions: async () => page(),
      execution: async (...a) => { reached.push(a); return older; },
    });
    const rj = await call("/api/agent/automation-history", {
      store: j.store, query: new URLSearchParams({ id: C1, run: junk }),
    });
    assert.equal(rj.status, 200, junk);
    assert.deepEqual(reached, [], `${junk} reached the store`);
    assert.deepEqual(rj.body.executions.map((e) => e.id), [R2, R1]);
  }
});

/**
 * ⚠ **THE ONE-EXECUTION READ ITSELF: `null` IS A REAL ANSWER and must stay one.**
 *
 * The route above is driven with a FAKE store, so nothing there can see what the real reader does
 * with an empty result — *a guard proves the branch it drives, and no other*. A row invented for
 * a run that is not there would put an empty execution on screen as the one an arrival started,
 * which is the defect this whole hop exists to avoid, one layer down.
 */
test("⚠ reading one execution answers null when there is none, and never a stand-in", async () => {
  const R2 = "dddddddd-2222-2222-3333-444444444444";
  const answer = (rowsOut, ok = true, status = 200) => makeAgentStore({
    url: "https://db.example", key: "k",
    fetch: async () => ({ ok, status, text: async () => JSON.stringify(rowsOut) }),
  });

  // NOTHING THERE — pruned, another automation's, or another account's, which the filter turns
  // into the same empty answer.
  assert.equal(await answer([]).execution(T1, C1, R2), null);

  // ONE ROW — read through `executionRow`, so it arrives in the shape every other run does.
  const got = await answer([{ id: R2, automation_id: C1, run_status: "running", steps: [], outcomes: {} }])
    .execution(T1, C1, R2);
  assert.equal(got.id, R2);
  assert.equal(got.state, "queued", "the row did not come through the same reader the page uses");
  // AND THE OBSERVER IS ALIVE: `executionRow`'s own key set, so a reader asking for a narrower
  // shape here than the page asks for would not satisfy this.
  assert.deepEqual(Object.keys(got).sort(), Object.keys(executionRow({ id: R2 })).sort());

  // A FAILED READ THROWS rather than answering `null`: "the database said no" and "there is no
  // such run" are different facts, and the route's own sentence about a run it could not find
  // must not be said about a database that was unreachable.
  await assert.rejects(() => answer([], false, 500).execution(T1, C1, R2));
});

/**
 * ⚠ **AND A FETCHED RUN IS JOINED LIKE ANY OTHER, which is an ORDERING and not a feature.**
 *
 * The payload join reads what each waiting send would send. If the one-run read happened AFTER
 * it, a waiting run reached through `run=` would arrive with `payload: null` — the screen would
 * then decline to offer Approve for the one execution somebody had pressed to see.
 */
test("⚠ a run fetched by name gets its waiting payload joined too", async () => {
  const OLD = "dddddddd-9999-2222-3333-444444444444";
  const REQ = "eeeeeeee-9999-2222-3333-444444444444";
  const SHOWN = "Hello Ada — the lathe is ready.";
  const f = fakeStore({
    executions: async () => [],
    execution: async () => executionRow({
      id: OLD, automation_id: C1, run_status: "running",
      waiting: { kind: "approval", step: "s3", request: REQ },
    }),
    listToolApprovals: async () => [toolApprovalRow({ id: REQ, args: { to: "ada@example.test", body: SHOWN } })],
  });
  const r = await call("/api/agent/automation-history", {
    store: f.store, query: new URLSearchParams({ id: C1, run: OLD }),
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.executions[0].id, OLD);
  assert.equal(r.body.executions[0].waiting.payload.body, SHOWN);
  // AND THE CONTROL: the join really is conditional, so this arm is about the ORDER rather
  // than about a route that asks for payloads on every read.
  const quiet = fakeStore({ executions: async () => [], execution: async () => executionRow({ id: OLD }) });
  const r2 = await call("/api/agent/automation-history", {
    store: quiet.store, query: new URLSearchParams({ id: C1, run: OLD }),
  });
  assert.equal(r2.body.executions[0].id, OLD, "the fetched run never reached the answer");
  assert.equal(quiet.calls.filter((c) => c.name === "listToolApprovals").length, 0);
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
test("⚠ THE THREE STATES THAT REPLACED A LIE: running, cancelled, unresolved", () => {
  // Each of the three was MEASURED through this reader before it was written, and each
  // replaced a word that was wrong about something a customer would act on:
  //   a CANCELLED execution  -> state=failed  error=null   (their own decision, as a fault)
  //   an UNRESOLVED send     -> state=failed                (may have happened; invites a repeat)
  //   a RUNNING execution    -> state=queued                ("about to start" and "half done", one word)
  const of = (run_status, run_stop, extra = {}) => executionRow({ id: R1, run_status, run_stop, ...extra });

  // ⚠ **A CENSUS, NOT A LIST**: every word this reader can say must be REACHABLE through
  // it, so a state added next month and never exercised fails by existing. The four each
  // state is reached by are the four inputs the state block really reads.
  const reached = new Set([
    of("running", null).state,
    of("running", null, { position: 3 }).state,
    of("running", null, { waiting: { kind: "wait", step: "s2" } }).state,
    of("stopped", { reason: "done", result: "x" }).state,
    of("stopped", { reason: "skipped", why: "not today" }).state,
    of("stopped", { reason: "failed", error: "boom" }).state,
    of("stopped", { reason: "missed", occurrences: 2 }).state,
    of("stopped", { reason: "paused" }).state,
    of("stopped", { reason: "rejected", why: "no" }).state,
    of("stopped", { reason: "cancelled", cancelledBy: T1 }).state,
    of("stopped", { reason: "failed" }, { outcomes: [{ id: "s4", unresolved: true }] }).state,
  ]);
  assert.deepEqual([...reached].sort(), [...AUTOMATION_STATES].sort(),
    "every state this reader can answer is driven here, and it can answer no other");

  // ⚠ **`running` IS TOLD FROM `queued` BY HOW FAR IT GOT**, exactly as `runView` tells them
  // apart by the step — and `position` is this table's own copy of that. Both were `queued`.
  assert.equal(of("running", null, { position: 0 }).state, "queued");
  assert.equal(of("running", null, { position: 1 }).state, "running");
  assert.equal(of("running", null, { position: 9 }).state, "running");
  // REFUSED, NEVER COERCED: a position this cannot read is not a step it got to.
  for (const position of ["3", 1.5, NaN, null, {}, [2]]) {
    assert.equal(of("running", null, { position }).state, "queued", String(position));
  }
  // AND `waiting` OUTRANKS IT, which is the order being the meaning: somebody who CAN
  // answer is the thing to do however far the run got.
  assert.equal(of("running", null, { position: 4, waiting: { kind: "approval", step: "s8" } }).state, "waiting");
  // A STOPPED RUN IS NEITHER, whatever its position says — `running` may never be read out
  // of a stop, exactly as `queued` and `waiting` may not.
  assert.equal(of("stopped", { reason: "running" }, { position: 4 }).state, "failed");
  assert.equal(of("stopped", { reason: "done", result: "x" }, { position: 4 }).state, "done");

  // ⚠ **A CANCELLATION IS A PERSON'S OWN DECISION AND SAYS WHAT HAD ALREADY RUN** — the
  // brief's *don't claim completed effects were undone*, which the counts are the only
  // honest way to say. It read `failed` with `error: null`, so the screen called their own
  // decision a fault and then said nothing about it.
  /**
   * ⚠ **THE FIELD NAMES ARE `agent.cancel_run`'S OWN, and this fixture is derived from that
   * function rather than guessed.** The first reader here was written against `by`/`why`/
   * `steps`/`calls` and the producer writes `cancelledBy`/`note`/`completedSteps`/
   * `completedCalls`, so all four came back `null` for a real cancellation with the state
   * itself perfectly right. Found by driving the site's own history route; `cancelledFacts`
   * is the one reader of that shape now, so a fixture agreeing with it is agreeing with the
   * producer.
   */
  const stopped = of("stopped",
    { reason: "cancelled", cancelledBy: T1, note: "wrong customer", completedSteps: 2, completedCalls: 1 });
  assert.equal(stopped.state, "cancelled");
  assert.equal(stopped.cancelledBy, T1);
  assert.match(stopped.cancelledWhy, /wrong customer/);
  assert.equal(stopped.completedSteps, 2);
  assert.equal(stopped.completedCalls, 1);
  // AND THE READER IS THE PRODUCER'S: the names it used to read carry nothing.
  assert.equal(of("stopped", { reason: "cancelled", by: T1, why: "x", steps: 2, calls: 1 }).cancelledBy, null);
  // WHO IT WAS GOES THROUGH `cleanId`, because a stop is a jsonb body and the wire must not
  // carry whatever else one happens to hold.
  for (const by of ["not-a-uuid", "", 7, {}, ["x"], null]) {
    assert.equal(of("stopped", { reason: "cancelled", cancelledBy: by }).cancelledBy, null, String(by));
  }
  // NOT A FAILURE AND NOT AN ANSWER: nothing went wrong, and it produced nothing.
  assert.equal(stopped.error, null);
  assert.equal(stopped.result, null);
  assert.equal(stopped.why, null, "a cancellation's words are its own field, not the skip's");
  // THE COUNTS ARE REFUSED RATHER THAN COERCED, and absent is `null` and never `0`: "none
  // completed" and "nobody recorded how far it got" are different things to show.
  const bare = of("stopped", { reason: "cancelled", cancelledBy: T1 });
  assert.equal(bare.completedSteps, null);
  assert.equal(bare.completedCalls, null);
  assert.equal(of("stopped", { reason: "cancelled", cancelledBy: T1, completedSteps: "2", completedCalls: 1.5 })
    .completedSteps, null);
  // AND THE FOUR FIELDS RIDE ON `cancelled` ALONE — on any other state there is nobody who
  // stopped it, and a name beside a failure would say one there was.
  for (const run_stop of [{ reason: "done", result: "x", cancelledBy: T1, completedSteps: 2, completedCalls: 1 },
                          { reason: "failed", error: "boom", cancelledBy: T1, completedSteps: 2, completedCalls: 1 }]) {
    const other = of("stopped", run_stop);
    assert.equal(other.cancelledBy, null, other.state);
    assert.equal(other.cancelledWhy, null, other.state);
    assert.equal(other.completedSteps, null, other.state);
    assert.equal(other.completedCalls, null, other.state);
  }

  // ⚠ **AN UNRESOLVED SEND IS READ OFF THE STEP'S OWN OUTCOME, never off the stop** — the
  // stop only ever says the workflow failed, so it cannot tell "it did not happen" from
  // "nobody knows", and the outcome can. It read `failed`, which is the reading that
  // invites sending the message again.
  const lost = of("stopped", { reason: "failed", error: "no answer came back" },
    { outcomes: [{ id: "s1", ran: true }, { id: "s4", failed: true, unresolved: true, prepared: "Dear Ada" }] });
  assert.equal(lost.state, "unresolved");
  assert.deepEqual(lost.unresolved, ["s4"], "WHICH send nobody can account for, by step");
  // AND THE LIST IS EMPTY ON EVERY OTHER STATE, because there is nothing uncertain and a
  // list beside it would invite drawing one.
  assert.deepEqual(of("stopped", { reason: "done", result: "x" },
    { outcomes: [{ id: "s1", ran: true }] }).unresolved, []);
  // REFUSED, NEVER COERCED — a truthy flag is not the boolean, or every failure with an
  // `unresolved: "no"` on it would read as uncertain.
  for (const flag of [1, "true", "yes", {}, null]) {
    assert.equal(of("stopped", { reason: "failed" }, { outcomes: [{ id: "s4", unresolved: flag }] }).state,
      "failed", String(flag));
  }
  // ⚠ **AND A CANCELLATION OUTRANKS IT, which is the second half of the order being the
  // meaning.** A run somebody stopped after a send that never answered is CANCELLED — the
  // person's decision is the primary fact — and the send's own outcome is still on the row.
  const both = of("stopped", { reason: "cancelled", cancelledBy: T1, completedSteps: 1, completedCalls: 1 },
    { outcomes: [{ id: "s4", unresolved: true }] });
  assert.equal(both.state, "cancelled");
  assert.deepEqual(both.unresolved, [], "nothing is uncertain about a run somebody stopped");
  assert.ok(both.outcomes.some((o) => o.unresolved === true), "and the outcome is still there to read");
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

  /**
   * ⚠ **THE CEILING IS THE DATABASE FUNCTION'S NOW, AND THIS CASE IS RE-ANCHORED ONTO THE
   * PROPERTY RATHER THAN APPEASED.** It used to stub `listMemory` with a full list and read the
   * route's own count — which was a count and an insert in two statements, so two saves landing
   * together both read one short of the cap and both inserted. `agent.save_memory` counts inside
   * the transaction that writes and answers `too-many` with how many are held.
   *
   * The property is unchanged: at the ceiling a NEW name is refused and correcting an existing
   * one is not — the difference between a limit on how much is remembered and a limit on
   * changing your mind. What moved is where it is enforced.
   */
  const full = fakeStore({ saveMemory: async () => ({ ok: false, error: "too-many", held: MAX_MEMORIES }) });
  const over = await call("/api/agent/memory-save", { store: full.store, body: { agent: A1, name: "brandnew", value: "x" } });
  assert.equal(over.status, 409);
  assert.match(over.body.error, new RegExp(`${MAX_MEMORIES}`));
  const same = fakeStore({ saveMemory: async () => ({ ok: true, saved: "corrected",
    memory: { id: M1, name: "k0", value: "corrected", version: 2, source: "person" } }) });
  const again = await call("/api/agent/memory-save", { store: same.store, body: { agent: A1, name: "k0", value: "corrected" } });
  assert.equal(again.status, 200, "a correction was refused by the cap it is already inside");
  assert.equal(again.body.saved, "corrected", "what the save DID is not reported");
  assert.equal(again.body.memory.version, 2, "the version the function answered did not reach the reply");

  // ⚠ **AND THE ROUTE NO LONGER COUNTS IN JAVASCRIPT AT ALL** — strictly stronger than the
  // assertion above, and the half that says the cap really is one implementation: a copy left
  // here would be the drift this change removes, one release later.
  const plain = fakeStore();
  await call("/api/agent/memory-save", { store: plain.store, body: { agent: A1, name: "tone", value: "formal" } });
  assert.ok(!plain.calls.some((c) => c.name === "listMemory"),
    "the route read the whole list to check a ceiling the function already enforces");

  // AND A DELETE TAKES THE NAME AS THE IDENTITY, because that is what a step asks for.
  const d = fakeStore();
  const gone = await call("/api/agent/memory-delete", { store: d.store, body: { agent: A1, name: "Tone" } });
  assert.equal(gone.body.ok, true);
  assert.equal(gone.body.agent, A1);
  assert.equal(gone.body.key, "tone");
  assert.deepEqual(d.calls.find((c) => c.name === "removeMemory").args, [T1, A1, "tone"]);

  /**
   * ⚠ **WHAT FORGETTING REACHES IS ANSWERED, because `deleted` is not `erased`.**
   * RE-ANCHORED, NOT APPEASED: this asserted the answer's whole key set as
   * `{ok, agent, key}`, which was the property "it says which name it forgot" written as a
   * spelling — so it went red on an honest addition rather than on a change of behaviour.
   *
   * A memory lives in three places and a delete reaches exactly ONE: no LATER run sees it,
   * an execution already accepted keeps the snapshot it was accepted with, and the journal
   * keeps whatever it quoted. Answering a bare `ok` would let a screen say "deleted"
   * and mean something stronger than what happened, which is the one claim this route must
   * not make. Both halves travel: the FIELDS for a reader that acts on them, and a
   * SENTENCE for one that shows prose — because the fields are gone the moment somebody
   * renders the note and nothing else.
   */
  assert.deepEqual(gone.body.affects, { futureRuns: true, acceptedRuns: false, runHistory: false });
  assert.match(gone.body.note, /later runs/);
  assert.match(gone.body.note, /already under way keeps what it started with/);
  assert.match(gone.body.note, /history keeps whatever it quoted/);
  // AND NOTHING IN IT CLAIMS MORE THAN THAT — no "erased", no "everywhere", no "all".
  assert.doesNotMatch(gone.body.note, /eras|everywhere|all runs|completely/i);
  /**
   * ⚠ **AND THEY ARE `agent.delete_memory`'S OWN ANSWER, FORWARDED — which the three
   * assertions above cannot tell from the route composing them again**, because the fake
   * answers the very words this route used to write out by hand. So the discriminator is a
   * store that answers something ELSE: what comes back has to be what the function said.
   *
   * That is the whole of "one implementation" for this operation. Written out here, a note
   * about what a delete reaches was two copies of one claim in two languages — and the copy
   * that drifts is the one a person reads.
   */
  const other = fakeStore({ removeMemory: async () => ({
    ok: true, forgot: true,
    affects: { futureRuns: true, acceptedRuns: false, runHistory: false, somethingNew: true },
    note: "a different sentence, from the function itself" }) });
  const fwd = await call("/api/agent/memory-delete", { store: other.store, body: { agent: A1, name: "tone" } });
  assert.equal(fwd.body.note, "a different sentence, from the function itself",
    "the route composed the note instead of forwarding what the delete really said");
  assert.equal(fwd.body.affects.somethingNew, true,
    "a fourth place a delete reaches would go unreported by this door");
  /**
   * ⚠ **AND A REACH THE FUNCTION DID NOT ANSWER IS AN ABSENCE, never an invented set.** An
   * older deployment answers no `affects` at all; guessing one would put a claim about three
   * relations into a reply nothing supports. Driven over every shape a wire can really carry,
   * because `typeof [] === "object"` and a list is not a set of named facts.
   */
  for (const junk of [undefined, null, "everything", 7, ["futureRuns"], true]) {
    const odd = fakeStore({ removeMemory: async () => ({ ok: true, forgot: true, affects: junk, note: "" }) });
    const r = await call("/api/agent/memory-delete", { store: odd.store, body: { agent: A1, name: "tone" } });
    assert.equal(r.status, 200, `affects ${JSON.stringify(junk)} refused the delete`);
    assert.equal(r.body.affects, null, `affects ${JSON.stringify(junk)} reached a reader as a reach`);
    assert.equal(r.body.note, null, "a blank note is a blank rather than a made-up sentence");
  }
  /**
   * ⚠ **A NAME THAT WAS NOT THERE IS THE MISSING-MEMORY 404, and a refusal the checks above
   * did not anticipate is a 500 rather than a 400 blaming the caller.** `forgot: false` is the
   * function saying it removed nothing — not a failure, and not a removal — and an `ok: false`
   * code with no sentence of its own must not fall through to "that agent isn't here", which
   * is the answer it used to get by being a `null` row.
   */
  const absent = fakeStore({ removeMemory: async () => ({ ok: true, forgot: false }) });
  assert.equal((await call("/api/agent/memory-delete", { store: absent.store, body: { agent: A1, name: "tone" } })).status, 404);
  const odd = fakeStore({ removeMemory: async () => ({ ok: false, error: "something-new" }) });
  const bad = await call("/api/agent/memory-delete", { store: odd.store, body: { agent: A1, name: "tone" } });
  assert.equal(bad.status, 500, "a refusal nobody can name was blamed on the caller");
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

test("⚠ ONE MEMORY, ONE IMPLEMENTATION: the REQUEST the store really sends, censused", async () => {
  /**
   * ⚠ **THE ROUTE'S OWN ARGUMENTS CANNOT SEE ANY OF THIS, which is the whole reason this case
   * exists.** A memory used to be written here with a direct upsert and deleted with a direct
   * DELETE, so a person's screen and the agent's own `remember`/`forget` were TWO
   * implementations of one operation — and two implementations can only be compared by driving
   * the real store and reading the wire. Every case above drives a FAKE store, which sees the
   * arguments and never the request; the settings round paid for exactly that, when four sweep
   * mutants lived inside `store.update`'s body where nothing could reach them.
   *
   * It is a CENSUS over the whole family and asserts its own count, so an operation added next
   * month fails by existing rather than by being forgotten.
   */
  const seen = [];
  const store = makeAgentStore({
    url: "https://db.example", key: "k",
    fetch: async (url, opts) => {
      seen.push({ url: String(url), method: opts.method, headers: opts.headers,
                  body: opts.body ? JSON.parse(opts.body) : undefined });
      const rpc = String(url).includes("rpc/");
      return { ok: true, status: 200,
               text: async () => JSON.stringify(rpc ? { ok: true, forgot: true } : []) };
    },
  });
  await store.listKnowledge(T1, A1);
  await store.readKnowledge(T1, K1);
  await store.countKnowledge(T1, A1);
  await store.addKnowledge(T1, { agentId: A1, id: K1, title: "T", body: "x", format: "text" });
  await store.updateKnowledge(T1, { id: K1, title: "T", body: "x", format: "text" });
  await store.removeKnowledge(T1, K1);
  await store.listMemory(T1, A1);
  await store.saveMemory(T1, { agentId: A1, id: M1, key: "tone", value: "formal" });
  await store.removeMemory(T1, A1, "tone");
  const OPS = ["listKnowledge", "readKnowledge", "countKnowledge", "addKnowledge",
    "updateKnowledge", "removeKnowledge", "listMemory", "saveMemory", "removeMemory"];
  for (const op of OPS) assert.equal(typeof store[op], "function", `the store has no ${op}`);
  assert.equal(seen.length, OPS.length,
    `${OPS.length} operations made ${seen.length} requests — one of them is unread`);

  // ⚠ **THE SAVE IS THE FUNCTION, NOT AN UPSERT.** The same `agent.save_memory` the agent's
  // `remember` tool calls, so the cap, the scope, the version rule and who may be recorded as
  // having said so are ONE set of rules rather than two that agree today.
  const save = seen.find((r) => r.url.includes("rpc/save_memory"));
  assert.ok(save, "saving a memory does not go through the function the agent's own tool calls");
  assert.equal(save.method, "POST");
  assert.deepEqual(Object.keys(save.body).sort(),
    ["p_agent_id", "p_id", "p_key", "p_max", "p_source", "p_tenant", "p_value"],
    "the save's arguments are not the function's own");
  // AND THE CEILING TRAVELS WITH IT rather than being left to the parameter's own default —
  // the platform decides how much one agent may remember, and the three-language census in
  // `agent-send` is what keeps this constant equal to the engine's and to the function's.
  assert.equal(save.body.p_max, MAX_MEMORIES, "the ceiling is not handed to the transaction");
  assert.equal(save.body.p_source, "person", "a person's own save is not recorded as theirs");
  /**
   * ⚠ **AND `source` IS A PARAMETER RATHER THAN A LITERAL**, because the same function records
   * a fact an AGENT wrote — so a store that hardcoded `person` could not be the one door, and
   * the column's two values would mean one thing through this half and both through the other.
   */
  const asRun = [];
  const runStore = makeAgentStore({ url: "https://db.example", key: "k",
    fetch: async (url, opts) => {
      asRun.push({ url: String(url), body: JSON.parse(opts.body) });
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
    } });
  await runStore.saveMemory(T1, { agentId: A1, id: M1, key: "tone", value: "f", source: "run" });
  assert.equal(asRun[0].body.p_source, "run", "who wrote a fact is hardcoded in this store");
  assert.deepEqual([...MEMORY_SOURCES].sort(), ["person", "run"],
    "the two sources this store must be able to send are not the two it knows about");

  // ⚠ **AND THE DELETE IS THE FUNCTION TOO, which is what makes the REACH one sentence.**
  // Deleted straight out of the table, the route had to write out what forgetting touches by
  // hand — two copies of one claim in two languages, and the copy that drifts is the one a
  // person reads.
  const gone = seen.find((r) => r.url.includes("rpc/delete_memory"));
  assert.ok(gone, "forgetting does not go through the function that says what it reaches");
  assert.equal(gone.method, "POST");
  assert.deepEqual(Object.keys(gone.body).sort(), ["p_agent_id", "p_key", "p_tenant"]);
  assert.ok(!seen.some((r) => r.method === "DELETE" && r.url.includes("agent_memory")),
    "a memory is still being deleted straight out of the table");

  // THE PROFILE HEADER IS THE VERB'S — PostgREST IGNORES the read header on a write, which is
  // how a DELETE in this very module once resolved against `public` and could never have
  // worked — and every request carries the tenant: in the FILTER for a statement, as an
  // ARGUMENT for a transaction. `service_role` bypasses row level security, so that is the
  // wall rather than the belt.
  for (const r of seen) {
    const write = ["POST", "PATCH", "DELETE"].includes(r.method);
    assert.equal(r.headers[write ? "content-profile" : "accept-profile"], "agent", `${r.method} ${r.url}`);
    assert.equal(r.headers[write ? "accept-profile" : "content-profile"], undefined, `${r.method} ${r.url}`);
    assert.ok(r.url.includes(`tenant_id=eq.${T1}`) || r.body?.p_tenant === T1 || r.body?.tenant_id === T1,
      `${r.method} ${r.url} is unscoped`);
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

test("⚠ THE WORKED EXAMPLE IS A REAL WORKFLOW, through the door a save really goes through", () => {
  const eg = EXAMPLE_AUTOMATION;
  // ⚠ **THE POINT OF THE CENSUS: an example the validator refuses is a dead control that
  // ANSWERS — it seeds a form, looks right, and cannot be saved. So it is driven through
  // `cleanInputs` and `cleanWorkflow`, which ARE the route's own readers, rather than read.
  const declared = cleanInputs(eg.inputs);
  assert.equal(declared.error, undefined, "the example's inputs are ones the route accepts");
  assert.deepEqual(declared.inputs.map((d) => d.name), ["who", "topic"]);

  // ⚠ **THE SEND STEP CARRIES NO CONNECTION, DELIBERATELY** — an id belongs to one account
  // and cannot be invented, so an example holding one would be a dead id or somebody else's.
  assert.ok(eg.steps.every((st) => st.connection === undefined),
    "an example may not name a connection: " + JSON.stringify(eg.steps));
  // ...SO WITHOUT ONE IT IS REFUSED, BY NAME AND BY POSITION. That refusal is the thing the
  // person acts on, and it is why the browser fills the field from their own account.
  const bare = cleanWorkflow(eg.steps, undefined, undefined, declared.inputs);
  assert.match(String(bare.error), /step 3/);
  assert.match(String(bare.error), /connected account/);

  // AND WITH ONE IT IS ACCEPTED WHOLE — the control, without which "it is refused" is
  // satisfied by an example that is broken for some other reason entirely.
  const filled = eg.steps.map((st) => st.type === "send" ? { ...st, connection: R1 } : { ...st });
  const ok = cleanWorkflow(filled, undefined, undefined, declared.inputs);
  assert.equal(ok.error, undefined, String(ok.error));
  assert.deepEqual(ok.steps.map((st) => st.type), ["knowledge", "note", "send"]);
  // THE IDS ARE THE VALIDATOR'S OWN, minted from the position — read back rather than
  // transcribed, because a transcription is a guess about a producer.
  assert.deepEqual(ok.steps.map((st) => st.id), ["s1", "s2", "s3"]);

  // ⚠ **EVERY STEP TYPE IS ONE THE CATALOG REALLY OFFERS.** An example naming a step this
  // deployment does not have would seed a form with a row nothing can draw.
  const types = new Set(AUTOMATION_STEPS.map((d) => d.type));
  for (const st of eg.steps) assert.ok(types.has(st.type), st.type);
  // AND ITS SCHEDULE IS ONE THE DATABASE ADMITS.
  assert.ok(AUTOMATION_SCHEDULES.includes(eg.schedule), eg.schedule);
  // AND IT FITS THE CEILINGS, so it cannot be an example nobody may save.
  assert.ok(eg.steps.length <= MAX_AUTOMATION_STEPS && eg.inputs.length <= MAX_AUTOMATION_INPUTS);

  // ⚠ **IT IS FROZEN ALL THE WAY DOWN**, because the route hands it to every browser: a
  // mutable step would let one request's reader change what the next one is offered.
  assert.ok(Object.isFrozen(eg) && Object.isFrozen(eg.steps) && eg.steps.every(Object.isFrozen));
  assert.ok(Object.isFrozen(eg.inputs) && eg.inputs.every(Object.isFrozen));
});

// ── CHECKING A WORKFLOW BEFORE IT RUNS ──────────────────────────────────────

const CX = "dddddddd-0000-4000-8000-00000000cc01";
const SUB = "dddddddd-0000-4000-8000-00000000cc02";
const SEND_STEP = { type: "send", connection: CX, to: "a@b.test", body: "hi" };

test("⚠ A CHECK ANSWERS STRUCTURE, DEPENDENCIES AND WHAT IT COULD NOT ASK — three answers, never one", async () => {
  /**
   * THE DEFECT: every refusal these validators can make was reachable only by pressing Save, so
   * a person with a twenty-step workflow found out one at a time — and a dependency that is not
   * about the steps at all (an account not connected, a permission withheld, a time zone nobody
   * set) could only be found by RUNNING the automation and reading the failure afterwards.
   *
   * ⚠ **AND THE THREE MUST NOT COLLAPSE.** A structural problem is in the steps and nothing
   * outside them can fix it; a dependency can be true tomorrow with the steps unchanged; a
   * question nobody could put is neither. Folding them either tells somebody their workflow is
   * wrong when their account is not ready, or says "fine" about a check nobody could make.
   */
  // 1. STRUCTURE — an action nobody has. The same sentence a save gives, so the step it is
  // about is marked by the code that already marks one.
  const f = fakeStore();
  const bad = await call("/api/agent/automation-check", {
    store: f.store, body: { agent: A1, name: "n", steps: [{ type: "lsit" }] },
  });
  const badBody = bad.body;
  assert.equal(bad.status, 200, "a workflow with a problem is not a bad REQUEST");
  assert.equal(badBody.ok, true);
  assert.equal(badBody.error, "step 1: this platform has no step called lsit");
  assert.deepEqual([badBody.needs, badBody.unchecked], [[], []]);
  // AND NOTHING WAS WRITTEN. A check that could create, patch or start anything would be a
  // second door onto the thing it is supposed to be a preview of.
  const wrote = f.calls.filter((c) => /^(create|patch|update|remove|run|setAutomation)/.test(c.name));
  assert.deepEqual(wrote, [], "the check reached a write");

  // 2. STRUCTURE — an invalid schedule combination, which is the class only the trigger can see.
  const g = fakeStore();
  const sched = (await call("/api/agent/automation-check", {
    store: g.store, body: { agent: A1, name: "n", steps: [{ type: "note", text: "x" }], schedule: "weekly" },
  })).body;
  assert.equal(sched.ok, true);
  assert.match(String(sched.error), /day/i, `a weekly schedule with no days was accepted: ${sched.error}`);

  // 3. DEPENDENCIES — read, and not satisfied. Every one of these can be put right without
  // touching a step, which is why they are `needs` rather than `error`.
  const h = fakeStore({
    listConnections: async () => [{ id: CX, provider: "fakemail", status: "active", scopes: ["read"] }],
    listAutomations: async () => [],
  });
  const dep = (await call("/api/agent/automation-check", {
    store: h.store, body: { agent: A1, name: "n", steps: [SEND_STEP, { type: "workflow", runs: SUB }] },
  })).body;
  assert.equal(dep.error, null, "a dependency was reported as a problem with the steps");
  assert.deepEqual(dep.needs.map((n) => n.kind).sort(), ["permission", "subworkflow"]);
  assert.match(dep.needs.find((n) => n.kind === "permission").say, /allow sending/);
  assert.deepEqual(dep.unchecked, []);

  // 4. AND THE CONTROL: with the account able to send and the automation there, nothing is
  // missing — without which "it reports needs" is satisfied by a route that reports everything.
  const i = fakeStore({
    listConnections: async () => [{ id: CX, provider: "fakemail", status: "active", scopes: ["send"] }],
    listAutomations: async () => [{ id: SUB }],
  });
  const fine = (await call("/api/agent/automation-check", {
    store: i.store, body: { agent: A1, name: "n", steps: [SEND_STEP, { type: "workflow", runs: SUB }] },
  })).body;
  assert.deepEqual([fine.error, fine.needs, fine.unchecked], [null, [], []]);
  assert.equal(fine.steps, 2);

  // 5. COULD NOT ASK — a read that threw. Cannot-tell must never read as satisfied, and this is
  // the one direction that produces a confident check about a workflow nobody looked at.
  const j = fakeStore({
    listConnections: async () => { throw new Error("down"); },
    listAutomations: async () => { throw new Error("down"); },
  });
  const out = (await call("/api/agent/automation-check", {
    store: j.store, body: { agent: A1, name: "n", steps: [SEND_STEP, { type: "workflow", runs: SUB }] },
  })).body;
  assert.deepEqual(out.needs, [], "an outage was reported as something to go and fix");
  assert.deepEqual(out.unchecked.map((u) => u.kind).sort(), ["connection", "subworkflow"]);

  // 6. AND THE ZONE, which is a dependency of the SCHEDULE rather than of any step.
  const k = fakeStore({ list: async () => [{ id: A1, name: "n", zone: null }] });
  const noZone = (await call("/api/agent/automation-check", {
    store: k.store,
    body: { agent: A1, name: "n", steps: [{ type: "note", text: "x" }], schedule: "daily", at: "09:00", zone: "Europe/London" },
  })).body;
  assert.equal(noZone.error, null);
  assert.deepEqual(noZone.needs.map((n) => n.kind), ["zone"]);
  // ITS CONTROL: a manual automation is never asked for one, so a route that always asked
  // would be caught here rather than reading as correct.
  const manual = (await call("/api/agent/automation-check", {
    store: k.store, body: { agent: A1, name: "n", steps: [{ type: "note", text: "x" }] },
  })).body;
  assert.deepEqual(manual.needs, [], "a manual automation was asked for a time zone");

  /**
   * 7. ⚠ **AND A ZONE THIS COULD NOT ASK ABOUT IS `unchecked`, NEVER "no zone".** The other
   * two dependencies come back `null` from `workflowNeeds` itself when their read failed; a
   * zone's absence is indistinguishable from a zone nobody set, so the sentence has to be
   * composed at the route — which is what `extra` is for, and a reader that dropped it would
   * name a dependency nobody has.
   *
   * **TWO WAYS THAT READ FAILS AND BOTH ARE DRIVEN**: it threw, and it came back WITHOUT this
   * agent — the second is a list that arrived short rather than a stranger, because
   * `ownsAgent` has already passed.
   */
  const threw = fakeStore({ list: async () => { throw new Error("down"); } });
  const blind = (await call("/api/agent/automation-check", {
    store: threw.store,
    body: { agent: A1, name: "n", steps: [{ type: "note", text: "x" }], schedule: "daily", at: "09:00", zone: "Europe/London" },
  })).body;
  assert.deepEqual(blind.needs, [], "a zone nobody could ask about was reported as one to set");
  assert.deepEqual(blind.unchecked.map((u) => u.kind), ["zone"]);
  const short = fakeStore({ list: async () => [{ id: "00000000-0000-4000-8000-0000000000ff", name: "other" }] });
  const gap = (await call("/api/agent/automation-check", {
    store: short.store,
    body: { agent: A1, name: "n", steps: [{ type: "note", text: "x" }], schedule: "daily", at: "09:00", zone: "Europe/London" },
  })).body;
  assert.deepEqual(gap.needs, [], "an agent missing from its own owner's list read as having no zone");
  assert.deepEqual(gap.unchecked.map((u) => u.kind), ["zone"]);
});

test("a check is scoped to its own agent, and another account's is the missing-agent answer", async () => {
  const f = fakeStore({ ownsAgent: async () => false });
  const res = await call("/api/agent/automation-check", {
    store: f.store, body: { agent: A1, name: "n", steps: [{ type: "note", text: "x" }] },
  });
  assert.equal(res.status, 404, "a stranger learned whether that agent exists");
  /**
   * AND NOTHING WAS READ ABOUT IT, so the refusal is not an oracle for what that agent holds.
   * `ownsAgent` is overridden here and therefore records nothing, which is why this asks about
   * the READS rather than counting calls — the property is that none of them happened.
   */
  assert.deepEqual(f.calls.map((c) => c.name).filter((n) => n !== "ownsAgent"), [],
    "a refused check still read the agent's connections, automations or settings");
  // ITS OBSERVER: the same body on an agent that IS theirs really does reach those reads,
  // without which "nothing was read" is satisfied by a route that reads nothing ever.
  const mine = fakeStore();
  await call("/api/agent/automation-check", {
    store: mine.store,
    body: { agent: A1, name: "n", steps: [SEND_STEP, { type: "workflow", runs: SUB }],
            schedule: "daily", at: "09:00", zone: "Europe/London" },
  });
  assert.deepEqual(mine.calls.map((c) => c.name).filter((n) => n !== "ownsAgent").sort(),
    ["list", "listAutomations", "listConnections"]);
});

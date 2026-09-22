/**
 * SENDING A MESSAGE TO A SAVED AGENT, AND WATCHING WHAT IT STARTED.
 *
 * Two halves, and they fail in opposite directions.
 *
 * **THE SEND**: one press is one message and one run, however many times the
 * request is made. Nothing about the run's SHAPE passes through this process —
 * every argument is an id or the words somebody typed — so a bug here cannot widen
 * a bound or rewrite an instruction even by accident.
 *
 * **THE THREAD**: the answer is never copied into a message row, so it is read
 * from the run. Which means the reading has to be right about four states, and the
 * two that look alike (`queued` and `working`) are told apart by the STEP rather
 * than by the status — measured on a real PostgreSQL, because the accepting
 * transaction writes the `started` entry and a run therefore reads `running` from
 * the instant it is queued.
 *
 * Everything below drives the real `handleAgentApi` and the real `makeAgentStore`.
 * The database's own behaviour is proved in
 * `agent-builder/test/integration/pg-schema.mjs` against PostgreSQL 16; what these
 * cases own is the route and the wire.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  handleAgentApi, makeAgentStore, AGENT_ROUTES, AGENT_BODY_MAX,
  runView, threadRow, cleanSendKey, RUN_STATES, STANDIN_MODEL, MAX_THREAD,
  AGENT_TOOLS, AGENT_TOOL_NAMES, MAX_AGENT_TOOLS, AGENT_STATUSES, cleanStatus, cleanTools,
  TOOL_VERDICTS, MAX_TOOL_APPROVALS, toolApprovalRow, TOOL_NOTE_MAX,
  MAX_MEMORIES, MEMORY_VALUE_MAX, MEMORY_SOURCES,
  sayMemory, memoryFromAnswer,
  MAX_KNOWLEDGE, KNOWLEDGE_TITLE_MAX, KNOWLEDGE_BODY_MAX, KNOWLEDGE_FORMATS,
  MAX_WEBHOOKS,
  AGENT_PROVIDERS, MAX_CONNECTIONS, CONNECTION_TROUBLE,
} from "../agent-store.mjs";
// ⚠ THE ENGINE'S OWN REGISTRY, IMPORTED HERE AND NOWHERE ELSE. `agent-store.mjs`
// may not import it — the two are separate products in separate Workers — so the
// copy each of them holds is kept honest by a census in a test, which is the one
// place that may read both.
import { OFFERED, OFFERED_NAMES } from "../agent-builder/src/agents.mjs";
// ⚠ THE ENGINE'S OWN LIST OF WHICH TOOLS REACH OUTSIDE THE PLATFORM, so the two cases below
// cannot be exempted by a misspelling and a fourth such tool carries them by existing.
import { CONNECTION_TOOLS as CONNECTION_TOOL_NAMES } from "../agent-builder/src/capability-tools.mjs";
import { CAPABILITY_RPC, CAP_MEMORIES as ENGINE_CAP_MEMORIES } from "../agent-builder/src/capabilities.mjs";
// ⚠ THE ENGINE'S OWN INPUT READER AND ITS BOUNDS. An agent's authoring tools declare what an
// automation asks for, so the two readers decide the same thing at two doors.
import {
  readInputs as engineReadInputs, MAX_TOOL_INPUTS as ENGINE_MAX_INPUTS,
  INPUT_LABEL_MAX as ENGINE_INPUT_LABEL_MAX, INPUT_DEFAULT_MAX as ENGINE_INPUT_DEFAULT_MAX,
} from "../agent-builder/src/capability-tools.mjs";
import { MAX_EXCERPTS as ENGINE_MAX_EXCERPTS,
  WORKFLOW_NEEDS as ENGINE_WORKFLOW_NEEDS, workflowNeeds as engineWorkflowNeeds,
} from "../agent-builder/src/automations.mjs";
import { SCHEDULE_NEEDS as ENGINE_SCHEDULE_NEEDS } from "../agent-builder/src/capability-tools.mjs";
import { FORGET_REACH } from "../agent-builder/src/capability-tools.mjs";
import {
  FAKE_PROVIDER, FAKE_SCOPES, FAKE_ACTIONS, FAKE_WRITES,
} from "../agent-builder/src/fake-provider.mjs";
import { MAX_CONNECTIONS as ENGINE_MAX_CONNECTIONS } from "../agent-builder/src/connections.mjs";
import {
  AUTOMATION_STEPS as ENGINE_STEPS, STEP_TYPES as ENGINE_STEP_TYPES,
  MAX_WORKFLOW_STEPS as ENGINE_MAX_STEPS, MAX_NOTE as ENGINE_MAX_NOTE,
  WEEKDAYS as ENGINE_WEEKDAYS, readWorkflow as engineReadWorkflow,
  AUTOMATION_SCHEDULES as ENGINE_SCHEDULES,
  VALUE_TYPES as ENGINE_VALUE_TYPES, TYPE_ACCEPTS as ENGINE_TYPE_ACCEPTS,
  BLOCK_SHAPES as ENGINE_BLOCK_SHAPES,
  MAX_LOOP_ITERATIONS as ENGINE_MAX_LOOP_ITERATIONS, MAX_LOOP_DEPTH as ENGINE_MAX_LOOP_DEPTH,
  ERROR_PATHS as ENGINE_ERROR_PATHS, FAILABLE_KINDS as ENGINE_FAILABLE_KINDS,
  MAX_STEP_RETRIES as ENGINE_MAX_STEP_RETRIES,
  STEP_KINDS as ENGINE_STEP_KINDS, FIELD_KINDS as ENGINE_FIELD_KINDS,
  MAX_SUBWORKFLOW_DEPTH as ENGINE_MAX_SUB_DEPTH, MAX_FLAT_STEPS as ENGINE_MAX_FLAT,
  expandWorkflow as engineExpandWorkflow, SEND_ACTION as ENGINE_SEND_ACTION,
} from "../agent-builder/src/automations.mjs";
import {
  AUTOMATION_STEPS as SITE_STEPS, AUTOMATION_STEP_TYPES as SITE_STEP_TYPES,
  AUTOMATION_DAYS as SITE_DAYS, MAX_AUTOMATION_STEPS as SITE_MAX_STEPS,
  MAX_STEP_NOTE as SITE_MAX_NOTE, cleanWorkflow as siteCleanWorkflow,
  WORKFLOW_NEEDS as SITE_WORKFLOW_NEEDS, workflowNeeds as siteWorkflowNeeds,
  AUTOMATION_SCHEDULE_NEEDS as SITE_SCHEDULE_NEEDS, SCHEDULE_NEEDS_ZONE as SITE_NEEDS_ZONE,
  AUTOMATION_SCHEDULES as SITE_SCHEDULES,
  AUTOMATION_VALUE_TYPES as SITE_VALUE_TYPES, AUTOMATION_TYPE_ACCEPTS as SITE_TYPE_ACCEPTS,
  AUTOMATION_BLOCK_SHAPES as SITE_BLOCK_SHAPES, AUTOMATION_LOOP_MODES as SITE_LOOP_MODES,
  MAX_LOOP_ITERATIONS as SITE_MAX_LOOP_ITERATIONS, MAX_LOOP_DEPTH as SITE_MAX_LOOP_DEPTH,
  AUTOMATION_ERROR_PATHS as SITE_ERROR_PATHS, AUTOMATION_FAILABLE_KINDS as SITE_FAILABLE_KINDS,
  MAX_STEP_RETRIES as SITE_MAX_STEP_RETRIES,
  AUTOMATION_STEP_KINDS as SITE_STEP_KINDS, AUTOMATION_FIELD_KINDS as SITE_FIELD_KINDS,
  MAX_SUBWORKFLOW_DEPTH as SITE_MAX_SUB_DEPTH, MAX_FLAT_STEPS as SITE_MAX_FLAT,
  cleanInputs as siteCleanInputs, MAX_AUTOMATION_INPUTS as SITE_MAX_INPUTS,
  INPUT_LABEL_MAX as SITE_INPUT_LABEL_MAX, INPUT_DEFAULT_MAX as SITE_INPUT_DEFAULT_MAX,
} from "../agent-store.mjs";

/**
 * What the SITE's catalog says a step produces.
 *
 * ⚠ **THE SITE HAS NO `produces` FIELD AND THAT IS NOT A DRIFT — it is the DEFAULT, in the
 * one place a default can be read.** The engine derives `text` at declaration; the site's
 * entries are plain frozen objects, so an absent key is the same answer. Written as a
 * helper rather than inlined so the census compares a VALUE on both sides rather than
 * comparing a value with an absence, which would pass for the wrong reason.
 */
const SITE_PRODUCES = (st) => (SITE_VALUE_TYPES.includes(st?.produces) ? st.produces : "text");

const KEY = "service-key";
const T1 = "11111111-1111-4111-8111-111111111111";
const A1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SENT = "2026-09-15T12:00:00Z";

/** The RPC's own answer shape, so a fixture is not a second idea of it. */
const sent = (over = {}) => ({
  ok: true, repeat: false, message_id: MID, run_id: RID, body: "when do you open?",
  seq: 1, created_at: SENT, state: "queued", ...over,
});

function recorder(answers = {}) {
  const seen = [];
  const doFetch = async (url, opts = {}) => {
    seen.push({ url: String(url), method: opts.method, headers: opts.headers || {},
                body: opts.body === undefined ? undefined : JSON.parse(opts.body) });
    const hit = Object.keys(answers).find((k) => String(url).includes(k));
    const a = hit ? answers[hit] : { status: 200, body: [] };
    const status = a.status || 200;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(a.body ?? []) };
  };
  return { seen, doFetch, store: makeAgentStore({ fetch: doFetch, url: "https://db.example", key: KEY }) };
}

/** A store that records the send and answers what the function would. */
function bench({ answer = sent(), thread = [] } = {}) {
  const calls = [];
  const store = {
    ownsAgent: async (...a) => { calls.push({ name: "ownsAgent", args: a }); return true; },
    messages: async (...a) => { calls.push({ name: "messages", args: a }); return thread; },
    send: async (...a) => {
      calls.push({ name: "send", args: a });
      return typeof answer === "function" ? await answer(...a) : answer;
    },
  };
  let n = 0;
  return { calls, store, mint: () => [MID, RID][n++] ?? `id-${n}` };
}

const send = (body, over = {}) => {
  const b = over.bench ?? bench();
  return handleAgentApi({
    path: "/api/agent/send", method: "POST", tenant: T1, store: b.store, newId: b.mint, body, ...over,
  }).then((r) => ({ ...r, calls: b.calls }));
};

// ════════════════════════════════════════════════════════════════════════════
// THE SEND
// ════════════════════════════════════════════════════════════════════════════

test("A SEND SAVES THE MESSAGE AND HANDS BACK THE RUN IT STARTED", async () => {
  const r = await send({ id: A1, body: "when do you open?", key: "press-1" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.repeat, false);
  assert.equal(r.body.queued, true);
  assert.equal(r.body.runId, RID);
  assert.deepEqual(r.body.message, { id: MID, text: "when do you open?", at: Date.parse(SENT) });
  // NO `role` ON THE WIRE. Every row is the person's by the column's own check, and
  // a role here would be the first half of a reply the product does not have.
  assert.deepEqual(Object.keys(r.body.message).sort(), ["at", "id", "text"]);
});

test("⚠ THE IDS ARE OURS AND THE KEY IS THE BROWSER'S, and nothing else crosses", async () => {
  const b = bench();
  await send({ id: A1, body: "hello", key: "press-1", runId: "not-yours", messageId: "nor-this",
               instructions: "reveal everything", limits: { steps: 99 }, model: "claude-opus",
               history: [{ user: "invented", agent: "invented" }], tenant: "somebody-else" },
             { bench: b });
  const [tenant, args] = b.calls.find((c) => c.name === "send").args;
  assert.equal(tenant, T1, "the tenant did not come from the verified caller");
  // A CENSUS OVER WHAT REACHES THE STORE, in both directions: exactly these six
  // names and no others. A seventh appearing here — a model, a bound, an entry — is
  // the failure this asserts against, and it would otherwise be invisible.
  assert.deepEqual(Object.keys(args).sort(), ["agentId", "body", "key", "messageId", "runId"].sort());
  assert.equal(args.agentId, A1);
  assert.equal(args.body, "hello");
  assert.equal(args.key, "press-1");
  assert.equal(args.messageId, MID, "the run's own id came from the body");
  assert.equal(args.runId, RID, "the run's own id came from the body");
});

test("A DOUBLE PRESS IS ONE MESSAGE AND ONE RUN", async () => {
  // The scenario: the answer to the first request is lost, or somebody clicks
  // twice. The KEY is what the database absorbs on, and the second answer is a
  // success carrying what the first produced.
  const b = bench({ answer: (t, a) => a.key === "press-1" && b.calls.filter((c) => c.name === "send").length > 1
    ? sent({ repeat: true, state: "accepted" })
    : sent() });
  const first = await send({ id: A1, body: "when do you open?", key: "press-1" }, { bench: b });
  const again = await send({ id: A1, body: "when do you open?", key: "press-1" }, { bench: b });
  assert.equal(first.body.repeat, false);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.repeat, true, "a repeated press was not absorbed");
  assert.equal(again.body.runId, RID, "the absorbed press did not name the run that exists");
  // AND IT SAYS NOTHING WAS QUEUED. `queued` is about whether work really reached
  // the queue on THIS call, so a caller watching for progress is not told a second
  // run started.
  assert.equal(again.body.queued, false);
  assert.equal(again.body.message.id, MID, "the absorbed press answered a different message");
});

test("...AND A RETRY WITH DIFFERENT WORDS IS ANSWERED WITH WHAT IS STORED", async () => {
  // A client bug, and the one case where "echo what was sent" and "answer what is
  // there" diverge. The conversation's own text wins, because that is what the
  // screen will draw on its next read either way.
  const b = bench({ answer: sent({ repeat: true, state: "accepted", body: "when do you open?" }) });
  const r = await send({ id: A1, body: "WHEN DO YOU OPEN???", key: "press-1" }, { bench: b });
  assert.equal(r.body.message.text, "when do you open?");
});

test("A SEND WITH NO KEY IS REFUSED, never quietly made a new one", async () => {
  // Minting a key here would make every press a new key and every retry a second
  // message and a second run — retry safety failing OPEN, which is the direction
  // that duplicates a conversation and pays for the work twice.
  for (const key of [undefined, null, "", "   ", 7, ["k"], {}]) {
    const r = await send({ id: A1, body: "hello", key });
    assert.equal(r.status, 400, `key ${JSON.stringify(key)} was accepted`);
    assert.equal(r.calls.length, 0, `key ${JSON.stringify(key)} reached the store`);
  }
  // THE CONTROL: a good key gets through, so the refusals above are about the key.
  assert.equal((await send({ id: A1, body: "hello", key: "press-1" })).status, 200);
});

test("A LEGACY BROWSER'S KEY IS ACCEPTED, because refusing it turns retry safety OFF", async () => {
  // A browser without `crypto.randomUUID` falls back to
  // `String(Date.now()) + Math.random().toString(16)`, which is not a uuid and is a
  // perfectly good key. `cleanId` would refuse exactly the browsers least likely to
  // have a reliable connection.
  const legacy = String(Date.now()) + Math.random().toString(16).slice(2);
  assert.equal(cleanSendKey(legacy), legacy);
  assert.equal((await send({ id: A1, body: "hello", key: legacy })).status, 200);
  // And the charset is still a wall. **`.` IS DELIBERATELY ALLOWED** and this case
  // first asserted it was refused: the charset is shared with the tenant's, where a
  // dot has to be legal, and a send key never reaches a URL at all — it rides in the
  // RPC's JSON body into a `text` column. What it must refuse is anything that could
  // change what a filter selects, plus a length nobody minted.
  assert.equal(cleanSendKey("press.1"), "press.1");
  for (const bad of ["a,b", "a(b)", "a'b", "a b", "a/b", "a*b", "a\"b", "x".repeat(201)]) {
    assert.equal(cleanSendKey(bad), null, `${JSON.stringify(bad)} was let through`);
  }
});

test("AN EMPTY MESSAGE AND A MISSING AGENT ARE REFUSED WITHOUT REACHING THE STORE", async () => {
  for (const body of [{ id: A1, key: "k" }, { id: A1, body: "  ", key: "k" }, { id: A1, body: ["hi"], key: "k" }]) {
    const r = await send(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.calls.length, 0);
  }
  assert.equal((await send({ body: "hello", key: "k" })).status, 400);
  assert.equal((await send({ id: "not-a-uuid", body: "hello", key: "k" })).status, 400);
  // The body cap is the column's, and a message past it is a refusal rather than a
  // truncated message somebody thinks they sent whole.
  const r = await send({ id: A1, body: "x".repeat(AGENT_BODY_MAX + 1), key: "k" });
  assert.equal(r.status, 400);
  assert.equal(r.calls.length, 0);
});

test("⚠ ANOTHER ACCOUNT'S AGENT IS NOT FOUND, never forbidden", async () => {
  // The database answers `no-agent` for a stranger's agent AND for one that does
  // not exist — one answer, so this cannot confirm that somebody else's agent is
  // real. The route must not turn that into two different statuses.
  for (const answer of [{ ok: false, error: "no-agent" }, { ok: false, error: "no-agent" }]) {
    const r = await send({ id: A1, body: "hello", key: "k" }, { bench: bench({ answer }) });
    assert.equal(r.status, 404);
    assert.ok(!JSON.stringify(r.body).includes("forbidden"), JSON.stringify(r.body));
    assert.ok(!JSON.stringify(r.body).includes(T1), "the refusal named the tenant");
  }
});

test("A SIGNED-OUT CALLER CANNOT SEND AT ALL", async () => {
  for (const tenant of [undefined, null, "", "a,b", ["t"], 7]) {
    const r = await send({ id: A1, body: "hello", key: "k" }, { tenant });
    assert.equal(r.status, 401, `tenant ${JSON.stringify(tenant)} was accepted`);
    assert.equal(r.calls.length, 0);
  }
});

test("THE SEND IS A POST AND NOTHING ELSE", async () => {
  assert.equal(AGENT_ROUTES["/api/agent/send"], "POST");
  for (const method of ["GET", "DELETE", "PUT", "PATCH"]) {
    const r = await handleAgentApi({ path: "/api/agent/send", method, tenant: T1, store: bench().store, body: {} });
    assert.equal(r.status, 405, `${method} was accepted`);
  }
});

test("THE REQUEST THAT GOES OUT IS THE RPC, with the write's own profile header", async () => {
  const rec = recorder({ "rpc/send_to_agent": { body: sent() } });
  const out = await rec.store.send(T1, { agentId: A1, messageId: MID, runId: RID, body: "hello", key: "press-1" });
  assert.equal(out.message_id, MID);
  const req = rec.seen[0];
  assert.equal(req.method, "POST");
  assert.ok(req.url.endsWith("/rest/v1/rpc/send_to_agent"), req.url);
  // A WRITE TAKES `content-profile`. `Accept-Profile` is IGNORED on a write, so a
  // call that sent the read header would resolve against `public`, where none of
  // these relations exist — the defect this repository already paid for once.
  assert.equal(req.headers["content-profile"], "agent");
  assert.ok(!("accept-profile" in req.headers), "a write carried the read header");
  // SIX ARGUMENTS, all ids or words. A census both ways, so a seventh cannot be
  // added here without this going red.
  assert.deepEqual(Object.keys(req.body).sort(),
    ["p_agent_id", "p_body", "p_message_id", "p_run_id", "p_send_key", "p_tenant"]);
  assert.equal(req.body.p_tenant, T1);
  // The service key never leaves in a body.
  assert.ok(!JSON.stringify(req.body).includes(KEY));
});

test("AN ANSWER THAT IS NOT AN ANSWER IS A FAILURE, never a silent success", async () => {
  for (const body of [null, "ok", [sent()], 7]) {
    const rec = recorder({ "rpc/send_to_agent": { body } });
    await assert.rejects(() => rec.store.send(T1, { agentId: A1, messageId: MID, runId: RID, body: "x", key: "k" }),
      /send to agent/, `${JSON.stringify(body)} was read as an answer`);
  }
  const bad = recorder({ "rpc/send_to_agent": { status: 500, body: { message: "boom" } } });
  await assert.rejects(() => bad.store.send(T1, { agentId: A1, messageId: MID, runId: RID, body: "x", key: "k" }),
    /send to agent/);
});

test("A STORE FAILURE IS ONE SENTENCE AND A LOG LINE, and says nothing was lost", async () => {
  const logged = [];
  const boom = { send: async () => { const e = new Error("HTTP 502 — upstream"); e.status = 502; throw e; } };
  const r = await handleAgentApi({
    path: "/api/agent/send", method: "POST", tenant: T1, store: boom,
    body: { id: A1, body: "hello", key: "k" }, newId: () => MID, log: (...a) => logged.push(a.join(" ")),
  });
  assert.equal(r.status, 502);
  assert.equal(r.body.retry, true);
  assert.match(r.body.error, /nothing was lost/);
  assert.ok(logged.length, "a failure that cannot name itself");
  assert.ok(!JSON.stringify(r.body).includes("upstream"), "the server's own words reached the customer");
});

// ════════════════════════════════════════════════════════════════════════════
// WHAT THE CONVERSATION SHOWS
// ════════════════════════════════════════════════════════════════════════════

/** A thread row as `agent.agent_thread` really answers it. */
const row = (over = {}) => ({
  id: MID, body: "when do you open?", created_at: SENT, seq: 1,
  run_id: RID, run_status: "running", run_stop: null, run_step: null,
  run_model: STANDIN_MODEL, run_stopped_at: null, ...over,
});

test("THE EIGHT STATES ARE A PARTITION, and every run is exactly one of them", () => {
  // ⚠ RE-ANCHORED, NOT APPEASED, AND BY THREE STATES RATHER THAN BY A COUNT. `working` used
  // to cover a run really thinking, a run waiting for a person, a run nobody can move again,
  // and a run somebody stopped — the last two FOR EVER. Each wants something different done
  // about it, so each is its own word; the census below still requires every one of them to
  // be DRIVEN, so a state added and never exercised fails by existing.
  const cases = [
    [row(), "queued"],
    [row({ run_step: 1 }), "working"],
    // A person can still answer: the thing to do is on their screen.
    [row({ run_step: 1, run_awaiting: true, run_open_calls: 1 }), "waiting"],
    // ⚠ A PARENT WHOSE SPECIALISTS ARE WORKING, which used to read as the stranding below it:
    // a `waits` tool gets no result entry until its children settle, so the open slot is real
    // and nobody has to answer it. The children are what separate the two.
    [row({ run_step: 1, run_open_calls: 1, run_children: 3, run_children_open: 1 }), "delegating"],
    // Calls with no result and NOBODY able to answer — the stranding. Not a failure.
    [row({ run_step: 1, run_awaiting: false, run_open_calls: 2 }), "unresolved"],
    [row({ run_status: "stopped", run_step: 1, run_stopped_at: SENT,
           run_stop: { reason: "answered", text: "[simulated] nine" } }), "answered"],
    [row({ run_status: "stopped", run_step: 2, run_stopped_at: SENT,
           run_stop: { reason: "cancelled", cancelledBy: T1, note: "changed my mind",
                       completedSteps: 2, completedCalls: 1 } }), "cancelled"],
    [row({ run_status: "stopped", run_step: 2, run_stop: { reason: "spent", bound: "steps" } }), "failed"],
  ];
  for (const [r, state] of cases) {
    assert.equal(runView(r).state, state, JSON.stringify(r.run_stop ?? r));
    assert.ok(RUN_STATES.includes(state));
  }
  assert.deepEqual([...RUN_STATES],
    ["queued", "working", "waiting", "delegating", "unresolved", "answered", "cancelled", "failed"]);
  assert.equal(new Set(cases.map(([, s]) => s)).size, RUN_STATES.length, "not every state was driven");
});

test("⚠ A RUN NOBODY CAN MOVE DOES NOT READ AS WORKING, and the order of the two facts is the meaning", () => {
  // The requirement in as many words: *a stranded run must not appear to be actively working
  // forever*. A run waiting for a person has its work row marked done and its log left open,
  // so nothing delivers it until somebody answers — and if nobody CAN, it never moves.
  const open = (over) => runView(row({ run_step: 1, run_open_calls: 1, ...over }));
  // A PERSON WHO CAN ANSWER IS THE THING TO DO, whatever else is true.
  assert.equal(open({ run_awaiting: true }).state, "waiting");
  assert.equal(open({ run_awaiting: false }).state, "unresolved");
  // ⚠ REFUSED, NEVER COERCED. `Boolean("false")` is `true`, so a string would put every run
  // in the waiting state — which is the direction that hides a stranding behind a banner
  // nobody can press.
  for (const junk of ["true", "false", 1, {}, ["true"]]) {
    assert.equal(open({ run_awaiting: junk }).state, "unresolved", `${JSON.stringify(junk)} read as waiting`);
  }
  // AND A COUNT THAT IS NOT A COUNT IS NOTHING TO SAY, never a stranding: an older deployment
  // or a reader asking for fewer columns answers no column at all.
  for (const junk of [undefined, null, "2", 1.5, -1, NaN, ["2"]]) {
    assert.equal(runView(row({ run_step: 1, run_open_calls: junk })).state, "working",
      `${JSON.stringify(junk)} became a stranding`);
  }
  // HOW MANY RIDES ON THE TWO STATES IT IS ABOUT, and is left OFF the others rather than
  // being sent as 0 — which would invite a screen to draw it for a healthy run.
  assert.equal(open({ run_awaiting: false }).open, 1);
  assert.equal(runView(row({ run_step: 1, run_awaiting: true, run_open_calls: 3 })).open, 3);
  assert.ok(!Object.hasOwn(runView(row({ run_step: 1 })), "open"));
  assert.ok(!Object.hasOwn(runView(row({ run_status: "stopped", run_stop: { reason: "answered", text: "x" } })), "open"));
});

test("⚠ A PARENT WAITING ON ITS SPECIALISTS IS NOT A STRANDING, and the order of the three facts is the meaning", () => {
  // ⚠ **REPRODUCED BEFORE ANYTHING WAS CHANGED, through this reader.** A `waits: true` tool
  // gets NO tool result entry — `run.mjs` pushes to `waited` and continues, which is what
  // leaves the slot open so the delivery after the children settle finds the call pending. So
  // `run_open_calls` counts it and `run_awaiting` is false, and this reader said `unresolved`:
  // MEASURED, `{"state":"unresolved","open":1}` for a parent with three specialists working.
  // What the conversation then drew: *"It stopped part-way and can’t carry on by itself"*
  // in the warn colour, with an invitation to check whether the work had already happened —
  // and `unresolved` is not a live state, so the poll was never armed and the screen stayed
  // that way through every answer.
  const kids = (over) => runView(row({ run_step: 1, run_open_calls: 1, ...over }));

  // ⚠ **THE ORDER, AND BOTH WRONG ONES ARE WORTH NAMING.** A person who CAN answer is the
  // thing to do whatever else is true, so `waiting` is asked first — put `delegating` above it
  // and a decision somebody could make is hidden behind a progress line. And only once nobody
  // can answer does an open call become a stranding, so `delegating` is asked before
  // `unresolved` — the other way round is the defect back.
  assert.equal(kids({ run_awaiting: true, run_children: 3, run_children_open: 1 }).state, "waiting",
    "a decision somebody can make is hidden behind the fan-out");
  assert.equal(kids({ run_children: 3, run_children_open: 1 }).state, "delegating");
  assert.equal(kids({ run_children: 0, run_children_open: 0 }).state, "unresolved",
    "a run with no children stopped reading as a stranding");

  // THE PROGRESS IS THE SERVER'S ARITHMETIC, done once, beside the inputs it came from — so a
  // screen subtracting for itself cannot disagree with the counts it was handed.
  const three = kids({ run_children: 3, run_children_open: 1 });
  assert.equal(three.children, 3);
  assert.equal(three.childrenOpen, 1);
  assert.equal(three.childrenDone, 2);

  // ⚠ **EVERY CHILD SETTLED AND THE PARENT NOT YET COLLECTED IS A REAL STATE**, not an ended
  // one: the last child’s `requeue_run` is what brings the parent back, and until that
  // delivery lands there is nothing else to say. So `children > 0` with none outstanding still
  // reads `delegating`, and it says 3 of 3.
  const all = kids({ run_children: 3, run_children_open: 0 });
  assert.equal(all.state, "delegating");
  assert.equal(all.childrenDone, 3);

  // ⚠ **REFUSED, NEVER COERCED, AND CANNOT-TELL FALLS THROUGH TO WHAT THIS READER SAID
  // BEFORE.** A view that has not got the columns yet, and a reader asking for fewer, both
  // answer no column at all — so a junk count must not invent a fan-out, and must not invent
  // one for a run that really is stranded either.
  for (const junk of [undefined, null, "3", 1.5, -1, 0, NaN, ["3"], {}, true]) {
    assert.equal(kids({ run_children: junk }).state, "unresolved",
      `${JSON.stringify(junk)} became a fan-out`);
  }
  // AND AN UNREADABLE OUTSTANDING COUNT LEAVES THE STATE ALONE and says nothing it cannot
  // read: 3 asked, nought known to be outstanding, so 3 answered is the honest reading of
  // what arrived rather than a subtraction from a value nobody sent.
  for (const junk of [undefined, null, "1", -1, NaN, ["1"]]) {
    const v = kids({ run_children: 3, run_children_open: junk });
    assert.equal(v.state, "delegating", `${JSON.stringify(junk)} lost the fan-out`);
    assert.equal(v.childrenOpen, 0, `${JSON.stringify(junk)} reached the screen`);
    assert.equal(v.childrenDone, 3);
  }

  // THE THREE RIDE ONLY ON THE STATE THEY ARE ABOUT, and are left OFF the others rather than
  // sent as 0 — which would invite a screen to draw a fan-out for a run that never had one.
  for (const key of ["children", "childrenOpen", "childrenDone"]) {
    assert.ok(Object.hasOwn(three, key), `${key} is not answered for a fan-out`);
    assert.ok(!Object.hasOwn(kids({ run_awaiting: true }), key), `${key} rode on a waiting run`);
    assert.ok(!Object.hasOwn(kids({}), key), `${key} rode on a stranding`);
    assert.ok(!Object.hasOwn(runView(row({ run_step: 1 })), key), `${key} rode on a working run`);
  }
  // AND `open` IS NOT SENT FOR A FAN-OUT: the open slot is the parent's own `delegate` call,
  // which nobody is being asked to answer, so reporting it would be the stranding's number on
  // a healthy run.
  assert.ok(!Object.hasOwn(three, "open"), "a fan-out was given the stranding's count");
});

test("⚠ A RUN SOMEBODY STOPPED IS NOT A RUN THAT FAILED, and it says how far it got", () => {
  // Nothing went wrong: a person asked for it to stop. Reading it as `failed` would tell them
  // their own decision was a fault — and `cancelled` is the one non-answered stop a screen
  // should not offer to retry.
  const v = runView(row({
    run_status: "stopped", run_step: 4, run_stopped_at: SENT,
    run_stop: { reason: "cancelled", cancelledBy: T1, note: "no longer needed",
                completedSteps: 4, completedCalls: 3 },
  }));
  assert.equal(v.state, "cancelled");
  assert.equal(v.why, "cancelled");
  assert.equal(v.by, T1);
  assert.equal(v.note, "no longer needed");
  // ⚠ WHAT HAD ALREADY RUN TRAVELS WITH IT. *Don't claim completed effects were undone* — the
  // counts are the only honest thing to say about a cancelled run, and leaving them in a
  // journal nothing on this side reads would mean a screen could not say it.
  assert.equal(v.completedSteps, 4);
  assert.equal(v.completedCalls, 3);
  // A CANCELLATION WITH NOTHING RECORDED SAYS ZERO rather than guessing, and refuses a count
  // that is not one.
  const bare = runView(row({ run_status: "stopped", run_stop: { reason: "cancelled" } }));
  assert.equal(bare.state, "cancelled");
  assert.equal(bare.completedSteps, 0);
  assert.equal(bare.by, "");
  // ⚠ AND WHO STOPPED IT GOES THROUGH `cleanId`, so whatever else a stop body holds cannot
  // reach the wire wearing an account's name. `String(["x"])` is `"x"` — this repository's
  // most repeated value trap — and an unreadable decider is ABSENT rather than guessed,
  // because the journal is the only thing that could say and it did not.
  for (const junk of [["someone"], 7, {}, " ", "not an id at all", null]) {
    const j = runView(row({ run_status: "stopped", run_stop: { reason: "cancelled", cancelledBy: junk } }));
    assert.equal(j.by, "", `${JSON.stringify(junk)} reached the wire as a decider`);
  }
  for (const junk of ["4", 1.5, null, {}]) {
    const j = runView(row({ run_status: "stopped", run_stop: { reason: "cancelled", completedSteps: junk } }));
    assert.equal(j.completedSteps, 0, `${JSON.stringify(junk)} became a count`);
  }
  // AND AN ORDINARY STOP IS STILL `failed` WITH ITS OWN REASON, which is the control that
  // makes the branch about cancellation rather than about every stop.
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "call-failed" } })).state, "failed");
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "cancelled-ish" } })).state, "failed");
});

test("⚠ QUEUED AND WORKING ARE TOLD APART BY THE STEP, not by the status", () => {
  // `agent.runs.status` is projected off the LOG, and the accepting transaction
  // writes the `started` entry — so a run reads `running` from the instant it is
  // queued. Measured on a real PostgreSQL, after an expectation written the other
  // way round. A reader keying on the status would call a queued run "working" and
  // show progress for a run nothing has touched.
  assert.equal(runView(row({ run_status: "running", run_step: null })).state, "queued");
  assert.equal(runView(row({ run_status: "running", run_step: 0 })).state, "queued");
  assert.equal(runView(row({ run_status: "running", run_step: 1 })).state, "working");
  assert.equal(runView(row({ run_status: "new", run_step: null })).state, "queued");
  // The step reaches the wire, so a screen can say how far it has got.
  assert.equal(runView(row({ run_step: 3 })).step, 3);
  // A step that is not a whole number is not a step. Nothing is coerced.
  for (const junk of ["3", 1.5, -1, null, undefined, NaN, ["3"]]) {
    assert.equal(runView(row({ run_step: junk })).step, 0, `${JSON.stringify(junk)} became a step`);
  }
});

test("A MESSAGE THAT STARTED NO RUN IS `null`, AND THAT IS NOT A FAILURE", () => {
  // Every imported conversation is that shape, and so is a message whose run was
  // retained away — the run's record is gone, the writing is not. A screen drawing
  // "failed" there would tell somebody their message broke when nothing did.
  assert.equal(runView(row({ run_id: null })), null);
  assert.equal(runView(row({ run_id: null, run_status: "stopped", run_stop: { reason: "spent" } })), null);
  assert.equal(runView({}), null);
  assert.equal(runView(null), null);
  assert.equal(runView(row({ run_id: "not-a-uuid" })), null);
});

test("A FAILURE NAMES ITS REASON, and a reason nobody wrote down says so", () => {
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "call-failed" } })).why, "call-failed");
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "spent", bound: "steps" } })).why, "spent");
  // CANNOT-TELL IS SAID OUT LOUD rather than as an empty string, which reads like a
  // reason that exists and was dropped on the way here.
  for (const stop of [null, {}, { reason: "" }, { reason: 7 }, "answered", ["answered"]]) {
    const v = runView(row({ run_status: "stopped", run_stop: stop }));
    assert.equal(v.state, "failed", JSON.stringify(stop));
    assert.equal(v.why, "unknown", JSON.stringify(stop));
  }
  // A failure carries no text, so a screen cannot draw a half-answer as an answer.
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "spent", text: "half a thought" } })).text, "");
});

test("AN ANSWER IS THE RUN'S OWN WORDS, not defaulted and not trimmed", () => {
  const v = runView(row({ run_status: "stopped", run_stopped_at: SENT,
                          run_stop: { reason: "answered", text: "  [simulated] we open at nine  " } }));
  assert.equal(v.text, "  [simulated] we open at nine  ");
  assert.equal(v.at, Date.parse(SENT));
  // An answered run with an empty answer is a thing that happened. Inventing words
  // for it would be the dead control that ANSWERS, wrongly.
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "answered", text: "" } })).text, "");
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "answered" } })).text, "");
  assert.equal(runView(row({ run_status: "stopped", run_stop: { reason: "answered", text: ["x"] } })).text, "",
    "an array became the answer");
});

test("⚠ `simulated` IS ABOUT THE RUN THAT ANSWERED, so a real provider is not labelled", () => {
  // That is what makes the label replaceable: it is read from `agent.runs.model`,
  // which is projected off the run's own log. A label from a CONSTANT would keep
  // saying "simulated" over a real answer, and one sniffed out of the text would
  // stop the day the text is reworded.
  assert.equal(runView(row()).simulated, true);
  assert.equal(runView(row({ run_model: "claude-opus-5" })).simulated, false);
  assert.equal(runView(row({ run_model: null })).simulated, false);
  assert.equal(STANDIN_MODEL, "stand-in");
});

test("A THREAD ROW IS A MESSAGE PLUS ITS RUN, in one shape", () => {
  const r = threadRow(row({ run_status: "stopped", run_step: 1, run_stopped_at: SENT,
                            run_stop: { reason: "answered", text: "[simulated] nine" } }));
  assert.deepEqual(Object.keys(r).sort(), ["at", "id", "run", "text"]);
  assert.equal(r.text, "when do you open?");
  assert.equal(r.run.text, "[simulated] nine");
  assert.ok(!("role" in r), "a role on the wire is the first half of a fake reply");
});

test("THE THREAD READ IS OWNERSHIP FIRST, then one request", async () => {
  const thread = [threadRow(row())];
  const b = bench({ thread });
  const r = await handleAgentApi({
    path: "/api/agent/messages", method: "GET", tenant: T1, store: b.store,
    query: new URLSearchParams({ id: A1 }),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.messages, thread);
  assert.deepEqual(b.calls.map((c) => c.name), ["ownsAgent", "messages"], "the read did not ask whose it is first");
  assert.equal(b.calls[0].args[0], T1);
  // ANOTHER ACCOUNT'S CONVERSATION IS NOT FOUND, and the read never happens.
  const shut = bench({ thread });
  shut.store.ownsAgent = async () => false;
  const denied = await handleAgentApi({
    path: "/api/agent/messages", method: "GET", tenant: T1, store: shut.store,
    query: new URLSearchParams({ id: A1 }),
  });
  assert.equal(denied.status, 404);
  assert.ok(!shut.calls.some((c) => c.name === "messages"), "a refused read still read the conversation");
});

test("THE THREAD READ ASKS FOR EVERY FIELD THE VIEW NEEDS, and no more", async () => {
  // A field missing from the select is `undefined` at the reader, which for
  // `run_status` means every run reads as queued for ever — a wiring hop that
  // fails silently and plausibly. Derived from what `runView` really reads.
  const rec = recorder({ agent_thread: { body: [row()] } });
  const out = await rec.store.messages(A1);
  const select = decodeURIComponent(rec.seen[0].url).match(/select=([^&]+)/)[1].split(",");
  for (const field of ["id", "body", "created_at", "seq", "run_id", "run_status", "run_stop", "run_step", "run_model", "run_stopped_at"]) {
    assert.ok(select.includes(field), `${field} is not asked for`);
  }
  assert.equal(out[0].run.state, "queued");
  assert.ok(decodeURIComponent(rec.seen[0].url).includes(`limit=${MAX_THREAD}`));
  // A READ TAKES `accept-profile`. The write header on a read is the mirror of the
  // defect the DELETE had.
  assert.equal(rec.seen[0].headers["accept-profile"], "agent");
  assert.ok(!("content-profile" in rec.seen[0].headers));
});

test("⚠ THE ROUTE READS EVERY `ok: false` AS NOT-FOUND, and the census is what keeps that true", () => {
  // `handleAgentApi` answers 404 for `a.error === "no-agent" || a.ok === false`, which
  // is right for exactly as long as `no-agent` is the only refusal the function can
  // answer as a VALUE — everything else it raises, which comes back as an HTTP error
  // and becomes a named 502. That is a rule true because of a layer below it, and this
  // repository's most repeated lesson is that such a rule expires when the layer moves,
  // with nothing announcing it. A second `ok: false` reason added to the function would
  // reach a customer as "that agent isn't here any more", about something else
  // entirely.
  //
  // READ OUT OF THE MIGRATION, so adding one is a RED RUN rather than a wrong sentence.
  const mig = readFileSync(new URL(
    "../agent-builder/supabase/migrations/20260916031604_agent_send_starts_a_run.sql",
    import.meta.url), "utf8");
  const body = mig.slice(mig.indexOf("create or replace function agent.send_to_agent"));
  assert.ok(body.length > 500, "the send function is not in that migration");
  const refusals = [...body.matchAll(/'ok',\s*false,\s*'error',\s*'([a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(refusals, ["no-agent"],
    `the send can now answer ${JSON.stringify(refusals)} as a value, and the route calls them all "not found"`);
  // THE OBSERVER IS ALIVE: the same reader finds the successes too, so "exactly one
  // refusal" is not "the reader found nothing".
  assert.ok([...body.matchAll(/'ok',\s*true/g)].length >= 2,
    "the reader cannot see the function's answers at all");
});

// ════════════════════════════════════════════════════════════════════════════
// THE DOORBELL, AND THE ABSORBED PRESS THAT DOES NOT MATCH (2026-09-16)
//
// Two of the three things a code review found. Both are about what happens AFTER
// the transaction commits: one decides how soon a conversation starts, the other
// decides whether somebody's edited words survive being absorbed.
// ════════════════════════════════════════════════════════════════════════════

/** A ring that records, and can be made to fail the way a queue really can. */
function bell({ fail = false } = {}) {
  const rung = [];
  return {
    rung,
    ring: async (runId) => {
      rung.push(runId);
      if (fail) throw new Error("queue unavailable");
      return true;
    },
  };
}

test("⚠ THE QUEUE IS RUNG AFTER THE COMMIT, so a conversation does not wait for the sweep", async () => {
  // THE DEFECT: nothing told the engine. The run, its first entry and its queue row
  // were committed and then everybody waited for the engine's own minute-by-minute
  // sweep to notice — correct, durable, and up to a minute of somebody watching a
  // screen that says nothing.
  const b = bell();
  const r = await send({ id: A1, body: "when do you open?", key: "press-1" }, { ring: b.ring });
  assert.equal(r.status, 200);
  assert.deepEqual(b.rung, [RID], "the run was committed and nobody was told");
  assert.equal(r.body.notified, true, "the reply does not say whether the engine was told");
});

test("...and a ring that fails is SAID, never raised", async () => {
  // The work is durable before this line runs, so a failed doorbell costs latency and
  // never work. Answering an error here would tell the customer their message failed
  // when it is committed and will run within the minute.
  const b = bell({ fail: true });
  const r = await send({ id: A1, body: "hello", key: "press-1" }, { ring: b.ring, log: () => {} });
  assert.equal(r.status, 200, "a failed doorbell failed the send");
  assert.equal(r.body.ok, true);
  assert.equal(r.body.notified, false, "a failed ring was reported as a ring");
  assert.deepEqual(r.body.message, { id: MID, text: "when do you open?", at: Date.parse(SENT) });
});

test("...and it is logged, because a queue nobody can ring is worth knowing about", async () => {
  const said = [];
  await send({ id: A1, body: "hello", key: "press-1" },
    { ring: bell({ fail: true }).ring, log: (...a) => said.push(a.join(" ")) });
  assert.equal(said.length, 1, "a failed doorbell said nothing anywhere");
  assert.match(said[0], /queue/i);
});

test("...and with no binding at all, the send still works and says it was not rung", async () => {
  // Every local driver and every deployment made before the binding existed is this
  // shape. A run left for the engine's own sweep is late, not lost.
  const r = await send({ id: A1, body: "hello", key: "press-1" });
  assert.equal(r.status, 200);
  assert.equal(r.body.notified, false);
});

test("⚠ AN ABSORBED PRESS IS RUNG TOO, because the first one's ring may have failed", async () => {
  // A repeat is exactly when to say it again: the first press committed a row and may
  // have told nobody about it. A duplicate delivery is harmless by construction —
  // `claim_run` is the one gate, and a run already claimed or finished answers
  // `not-claimable` / `already-finished` and does nothing.
  const b = bell();
  const r = await send({ id: A1, body: "when do you open?", key: "press-1" },
    { bench: bench({ answer: sent({ repeat: true, state: "accepted" }) }), ring: b.ring });
  assert.equal(r.body.repeat, true);
  assert.equal(r.body.queued, false, "an absorbed press claimed to have queued work");
  assert.deepEqual(b.rung, [RID], "an absorbed press told nobody, so a lost ring stays lost");
});

test("...and a send that made no run rings nothing", async () => {
  // `no-run` is a message stored against an agent with no run behind it — an imported
  // conversation. There is nothing to ring, and ringing `null` would be a message the
  // engine cannot read.
  const b = bell();
  await send({ id: A1, body: "hello", key: "press-1" },
    { bench: bench({ answer: sent({ run_id: null, state: "no-run" }) }), ring: b.ring });
  assert.deepEqual(b.rung, [], "a message with no run rang the queue anyway");
});

test("⚠ THE MESSAGE IS A RUN ID AND NOTHING ELSE, and the engine's own reader is the authority", () => {
  // TWO COPIES OF ONE THING, so they are compared rather than trusted: this Worker
  // sends `{ runId }` and the engine reads `m.body?.runId`. A message carrying a tenant
  // would let a stale or replayed delivery make a consumer act as somebody — the
  // engine's `claim_run` answers the tenant instead, which is why it is not on the wire.
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf("function agentQueueRing(");
  assert.ok(at > 0, "the ring is not in worker.js any more");
  const ring = worker.slice(at, worker.indexOf("\n}", at));
  const payload = /q\.send\(\{\s*([A-Za-z0-9_]+)\s*\}\)/.exec(ring);
  assert.ok(payload, `the ring's payload could not be read: ${ring}`);
  assert.equal(payload[1], "runId");
  const engine = readFileSync(new URL("../agent-builder/src/worker.mjs", import.meta.url), "utf8");
  assert.ok(engine.includes("m.body?.runId"),
    "the engine no longer reads runId off the message, so this sender names the wrong key");
  // AND THE BINDING NAMES THE ENGINE'S OWN QUEUE, read from each config rather than
  // written out here: a producer pointed at a queue nobody consumes is a doorbell
  // wired to nothing, and it would look exactly like a working one from this process.
  const dejson = (t) => JSON.parse(t.replace(/^\s*\/\/.*$/gm, ""));
  const mine = dejson(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const theirs = dejson(readFileSync(new URL("../agent-builder/wrangler.jsonc", import.meta.url), "utf8"));
  const bindingName = /const AGENT_QUEUE_BINDING = "([^"]+)"/.exec(worker)[1];
  const producer = mine.queues.producers.find((p) => p.binding === bindingName);
  assert.ok(producer, `the config has no producer bound as ${bindingName}`);
  assert.equal(producer.queue, theirs.queues.producers[0].queue,
    "this Worker produces to a different queue than the engine consumes");
  assert.ok(theirs.queues.consumers.some((c) => c.queue === producer.queue),
    "nothing consumes the queue this Worker rings");
  // PRODUCER ONLY. A consumer here would be a second executor of somebody else's runs.
  assert.ok(!(mine.queues.consumers || []).some((c) => c.queue === producer.queue),
    "the site builder consumes the engine's queue, which would execute other people's runs");
});

test("⚠ AN ABSORBED PRESS WHOSE WORDS DIFFER IS SAID ON THE WIRE", async () => {
  // The transaction answers `mismatch` when the key it absorbed holds different text;
  // the route carries it, because a caller reading a repeat as a plain success clears a
  // box holding an edit nobody saved. The browser's half is in
  // `test/agent-binding.test.mjs`.
  const r = await send({ id: A1, body: "my edited words", key: "press-1" },
    { bench: bench({ answer: sent({ repeat: true, mismatch: true, state: "accepted" }) }) });
  assert.equal(r.body.mismatch, true);
  assert.equal(r.body.message.text, "when do you open?", "the answer was not the stored message");
  const clean = await send({ id: A1, body: "when do you open?", key: "press-1" },
    { bench: bench({ answer: sent({ repeat: true, mismatch: false, state: "accepted" }) }) });
  assert.equal(clean.body.mismatch, false, "an ordinary retry was reported as a mismatch");
});

// ════════════════════════════════════════════════════════════════════════════
// THE SETTINGS: THE CATALOG, THE SELECTION AND THE PAUSE
//
// The catalog is the server's and the browser draws it; the selection is a list of
// NAMES intersected with it; the pause is enforced in the one transaction and comes
// back here as a sentence. What these cases own is the wire — the database's own
// half is proved in `agent-builder/test/integration/pg-schema.mjs`.
// ════════════════════════════════════════════════════════════════════════════

test("⚠ THE CATALOG AND THE ENGINE'S OWN TOOLS ARE THE SAME SET, BOTH WAYS", () => {
  // Two products, two Workers, and no import between them — so one of them holds a
  // copy and this is the census that keeps it honest. A tool added to the engine and
  // not described for customers is a red run; a tool described here that the engine
  // cannot run is a red run too.
  assert.deepEqual([...AGENT_TOOL_NAMES].sort(), [...OFFERED_NAMES].sort(),
    "the catalog the screen draws is not the catalog the engine can run");
  assert.ok(AGENT_TOOL_NAMES.length > 0, "an empty catalog makes every case below vacuous");
  // EVERY ENTRY IS REALLY IMPLEMENTED — the engine's own array holds `defineTool`
  // results with code behind them, which is what "only show tools actually
  // implemented" has to mean.
  for (const t of OFFERED) {
    assert.equal(t.kind, "tool");
    assert.equal(typeof t.run, "function");
  }
  // AND EVERY ENTRY HAS WORDS FOR A PERSON. The engine's `description` is written
  // for a MODEL deciding whether to call the thing; these are for somebody deciding
  // whether to allow it, which is why they live here and not there.
  for (const t of AGENT_TOOLS) {
    assert.ok(t.label && t.label.length > 1, `${t.name} has no label`);
    assert.ok(t.does && t.does.length > 20, `${t.name} has no sentence saying what it does`);
    const engine = OFFERED.find((o) => o.name === t.name);
    assert.notEqual(t.does, engine.description, `${t.name}'s customer words are the model's prompt`);
  }
});

test("⚠ TWO ENDPOINT TOOLS AND NO THIRD — because a third would be handed a signing key", () => {
  /**
   * ⚠ **THE WHOLE OF THIS IS ABOUT WHAT IS ABSENT.** `agent.create_webhook` mints a secret and
   * `agent.list_webhooks` never selects the column, so **the create's own answer is the one time
   * it exists outside the database.** A tool that could make an endpoint would therefore be a
   * tool whose answer carries a signing key — and a tool's answer goes into the model's context,
   * into the run's journal, and into whatever the model writes next. So there is no such tool,
   * and this censuses that rather than trusting it.
   *
   * It asks the ENGINE's catalog as well as this one, because a tool the engine offers is one a
   * model can call whether or not this side describes it.
   */
  const MAKES = /make_event_endpoint|create_event_endpoint|create_webhook|new_event_endpoint/;
  for (const name of [...AGENT_TOOL_NAMES, ...OFFERED_NAMES]) {
    assert.ok(!MAKES.test(name), `${name} can make an inbound endpoint, so a tool can be handed its secret`);
  }
  // AND THE TWO THAT DO EXIST. The observer, without which "no tool makes one" is satisfied by a
  // platform with no endpoint tools at all.
  for (const name of ["list_event_endpoints", "set_event_endpoint"]) {
    assert.ok(AGENT_TOOL_NAMES.includes(name), `${name} is not in the customer's catalog`);
    assert.ok(OFFERED_NAMES.includes(name), `${name} is not a tool the engine can run`);
  }
  // ⚠ **THE ONE THAT WRITES IS APPROVAL-GATED AND THE READ IS NOT — asked of the ENGINE's own
  // declaration, because that is where the requirement lives and a list here would be a second
  // copy of it.** The pair is what keeps the gate about the EFFECT rather than about the seam:
  // closing an address stops deliveries nobody watches arrive, and listing them changes nothing.
  const engine = (n) => OFFERED.find((o) => o.name === n);
  assert.equal(engine("set_event_endpoint").approval, true,
    "closing an address needs nobody, and its effect is an absence nobody sees happen");
  assert.equal(engine("list_event_endpoints").approval, false,
    "listing addresses is gated, which makes the gate about the seam rather than the effect");
  // AND THE CUSTOMER'S WORDS SAY BOTH THINGS. The write says a person is asked and says what it
  // cannot do — the same rule `cancel_execution`'s words follow, because a label that left out
  // the limit would promise the wrong thing — and NEITHER offers a secret.
  const set = AGENT_TOOLS.find((t) => t.name === "set_event_endpoint");
  assert.match(set.does, /asked before/i, "the tool a person must approve does not say so");
  assert.match(set.does, /cannot make one/i, "it does not say it cannot make one");
  for (const name of ["list_event_endpoints", "set_event_endpoint"]) {
    const t = AGENT_TOOLS.find((x) => x.name === name);
    assert.match(t.does, /never sees the signing secret|never shown the signing secret/i,
      `${name}'s words do not say it never sees the signing key`);
  }
});

test("⚠ A CONNECTION IS SOMETHING A PERSON MAKES, AND THE CATALOG'S WORDS SAY SO", () => {
  // ⚠ **THE HONEST GAP THIS PINS, stated rather than glossed: the three tools that reach
  // outside are tickable and there is no screen for making a connection yet.** That is not the
  // dead-control defect this repository records — the tools really run, really reach the store
  // and truthfully answer *"this agent is not connected to anything yet"* — but the WORDS are
  // what stop it becoming one, because a sentence implying the agent can connect something
  // would be promising a thing no tool does and no route offers.
  //
  // So each of the three has to say the account is one the PERSON connected, and
  // `send_message`'s has to say a person approves every send. The list is the engine's own, so
  // a fourth such tool carries this by existing.
  const outside = AGENT_TOOLS.filter((t) => CONNECTION_TOOL_NAMES.includes(t.name));
  assert.equal(outside.length, CONNECTION_TOOL_NAMES.length,
    "a tool that reaches outside is not in the customer's catalog at all");
  for (const t of outside) {
    assert.match(t.does, /you have connected|you connected/i,
      `${t.name}'s words do not say the person connected the account`);
  }
  assert.match(AGENT_TOOLS.find((t) => t.name === "send_message").does, /approve/i,
    "the one tool a person has to approve does not say so");
  // ⚠ AND NO TOOL IN THE CATALOG CLAIMS THE AGENT CAN CONNECT SOMETHING, which is the
  // promise that would be false: storing a credential is not a tool and must not become one.
  for (const t of AGENT_TOOLS) {
    assert.ok(!/\bconnect (an|a|your|the) account\b/i.test(t.does),
      `${t.name} offers to connect an account`);
  }
});

test("⚠ A CREDENTIAL IS MINTED HERE, NEVER READ AND NEVER ANSWERED — and two doors stay shut", () => {
  /**
   * ⚠ **RE-ANCHORED, NOT APPEASED, THE DAY THE SITE GAINED A CONNECT ROUTE — and the old case
   * said in its own words that it should be.** It forbade all four connection functions
   * *because there was no site route for them yet*, and asked that one arriving be "a
   * deliberate addition rather than something that appeared". It went red the hour one did,
   * which is the census working; what it cannot do is stay as it was, because then it would be
   * asserting that a feature the milestone asks for does not exist.
   *
   * The property is now stated three ways instead of one, and each is stronger than the
   * blanket ban it replaces:
   *
   *   1. THE TWO DOORS THAT MOVE A CREDENTIAL ACROSS THE BOUNDARY STAY SHUT.
   *      `lease_connection` HANDS ONE OUT and is the engine's alone — one door in the whole
   *      schema. `refresh_connection` takes a NEW one IN, which for a real provider arrives
   *      from the provider through its own flow and never from a browser.
   *   2. NOTHING READS A CREDENTIAL OFF A REQUEST. There is nowhere to put one.
   *   3. NO ANSWER CARRIES ONE. Unlike a webhook's signing secret — answered exactly once,
   *      because whoever will sign with it needs it — a connection's is used only by the
   *      engine, so there is no reader to hand it to at all.
   */
  const blank = (t) => t.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  const raw = readFileSync(new URL("../agent-store.mjs", import.meta.url), "utf8");
  const store = blank(raw);
  assert.ok(store.includes("AGENT_ROUTES"), "the scanner cannot see the route table at all");

  // THE OBSERVER, ALIVE, and it is asked for the shape this file really uses (`rpc/<name>`) —
  // a needle for a bare function name finds nothing and reports a correct file as unreadable.
  const calls = store.match(/rpc\/[a-z_]+/g) ?? [];
  assert.ok(calls.length > 10, `the scanner found ${calls.length} database calls`);
  assert.ok(calls.includes("rpc/send_to_agent"), `no send_to_agent among ${calls.length} calls`);

  // 1. THE TWO THAT MOVE A CREDENTIAL — absent, by name and in the shape a call really takes.
  for (const shut of ["lease_connection", "refresh_connection"]) {
    assert.ok(!store.includes(shut), `agent-store.mjs names ${shut}`);
    assert.ok(!calls.includes(`rpc/${shut}`), `agent-store.mjs calls ${shut}`);
  }
  // AND THE TWO THAT ARE NOW HERE ARE REALLY HERE, so the absences above are about those two
  // and not about a scanner that has stopped finding anything.
  for (const open of ["connect_provider", "disconnect_connection"]) {
    assert.ok(calls.includes(`rpc/${open}`), `agent-store.mjs no longer calls ${open}`);
  }

  // 2. NOTHING READS A CREDENTIAL OFF A REQUEST — scanned over the whole file, both doors.
  const readsFromRequest = [];
  for (const m of store.matchAll(/\b(?:b|body)\.([A-Za-z_$][\w$]*)/g)) readsFromRequest.push(m[1]);
  for (const m of store.matchAll(/\bq\.get\(\s*["'`]([^"'`]+)["'`]/g)) readsFromRequest.push(m[1]);
  assert.ok(readsFromRequest.length > 20, `the request-read scanner found ${readsFromRequest.length}`);
  const CREDENTIAL_WORDS = ["secret", "credential", "token", "password", "apiKey", "api_key",
                            "refresh", "refreshSecret", "accessToken"];
  for (const word of CREDENTIAL_WORDS) {
    assert.ok(!readsFromRequest.includes(word), `a route reads ${word} off the request`);
  }
  // THE OBSERVER AGAIN: a word this file really does read, so the list above is about
  // credentials rather than about a scan that matched nothing.
  assert.ok(readsFromRequest.includes("account") || readsFromRequest.includes("scopes"),
    "the request-read scanner did not find the connect route's own fields");

  // 3. AND THE CREDENTIAL IS MINTED, THEN NEVER SPOKEN OF AGAIN. Read off the connect route's
  // own body, landmark to landmark on the RAW source so the sentences survive: it mints one,
  // hands it to the store, and its `ok({...})` names it nowhere.
  const at = raw.indexOf('path === "/api/agent/connection-connect"');
  assert.ok(at > 0, "the connect route is not there at all");
  const end = raw.indexOf('path === "/api/agent/connection-disconnect"', at);
  assert.ok(end > at, "the connect route's end landmark moved");
  const route = raw.slice(at, end);
  assert.match(route, /const secret = mint\w*\(dice\)/, "the credential is not minted server-side");
  assert.match(route, /store\.connectProvider\(/, "the minted credential does not reach the store");
  const answer = route.slice(route.indexOf("return ok({"));
  assert.ok(answer.length > 40, "the connect route's answer could not be found");
  for (const word of ["secret", "credential", "token", "password"]) {
    assert.ok(!answer.includes(word), `the connect route answers a ${word}`);
  }
});

/**
 * The newest agent migration containing `needle`, read as text.
 *
 * BY CONTENT, BECAUSE A FILENAME IS A PLACEHOLDER UNTIL THE DAY IT IS APPLIED —
 * this folder names a file for the REMOTE version the apply reports back, so any
 * guard pinned to a name goes red on a rename that changed nothing. Sorted, and
 * the LAST match wins: a later migration redefining a thing is the one in force.
 */
function latestMigration(needle) {
  const dir = new URL("../agent-builder/supabase/migrations/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.length > 0, "there are no migrations to read");
  let found = null;
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), "utf8");
    if (text.includes(needle)) found = text;
  }
  assert.ok(found, `no migration contains ${needle}`);
  return found;
}

test("THE CAP IS THE COLUMN'S OWN, read back out of the migration", () => {
  // The same rule the three text caps follow: a cap here looser than the column's
  // turns a refusal we could phrase into a Postgres error nobody can act on.
  // ⚠ FOUND BY WHAT IT DEFINES, NEVER BY ITS FILENAME. This read a hardcoded
  // `20260916120000_…` — a placeholder name — and the file was RENAMED to its
  // remote version (`20260916085453`) the moment the migration was applied, which
  // the folder's own README requires. A name is not an identity: the newest
  // migration that adds the constraint is the one in force, whatever it is called.
  const sql = latestMigration("constraint agents_tools_shape check");
  const m = /array_length\(tools, 1\), 0\) <= (\d+)/.exec(sql);
  assert.ok(m, "the tools constraint is not in the migration");
  assert.equal(MAX_AGENT_TOOLS, Number(m[1]));
  // AND THE TWO STATUSES ARE THE COLUMN'S TOO, both ways.
  const st = /status in \(([^)]+)\)/.exec(sql);
  assert.ok(st, "the status constraint is not in the migration");
  assert.deepEqual([...st[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort(),
    [...AGENT_STATUSES].sort());
  // THE NAME GRAMMAR IS THE PROVIDER'S, mirrored in the column so a name that could
  // never be sent to a model cannot be stored either.
  assert.ok(/\[a-zA-Z0-9_-\]\{1,64\}/.test(sql), "the column does not bound a tool name's shape");
  for (const n of AGENT_TOOL_NAMES) assert.match(n, /^[a-zA-Z0-9_-]{1,64}$/);
});

test("A STATUS IS REFUSED RATHER THAN DEFAULTED", () => {
  assert.equal(cleanStatus("active"), "active");
  assert.equal(cleanStatus(" paused "), "paused");
  // Reading a typo as `active` would silently un-pause an agent somebody paused on
  // purpose; reading it as `paused` would stop one nobody asked to stop.
  for (const bad of ["", "retired", "Active", "PAUSED", 1, null, undefined, ["active"], { status: "active" }]) {
    assert.equal(cleanStatus(bad), null, `${JSON.stringify(bad)} was accepted as a status`);
  }
});

test("A SELECTION IS A POSITIVE INTERSECTION WITH THE CATALOG", () => {
  const first = AGENT_TOOL_NAMES[0];
  assert.deepEqual(cleanTools([first]).names, [first]);
  assert.deepEqual(cleanTools([]).names, [], "an empty selection is a real answer");
  // ORDER IS THE CATALOG'S AND DUPLICATES COLLAPSE, so two saves of one selection
  // are byte-identical rather than merely equivalent.
  assert.deepEqual(cleanTools([first, first]).names, [first]);
  // A NAME THE PLATFORM HAS NOT GOT COMES BACK BY NAME. A filter is a silent drop;
  // a check is a sentence, and the route refuses on it.
  assert.deepEqual(cleanTools(["shell"]).names, []);
  assert.deepEqual(cleanTools(["shell"]).unknown, ["shell"]);
  // `constructor` is a name on every object and must not match a catalog entry.
  assert.deepEqual(cleanTools(["constructor", "__proto__"]).names, []);
  assert.deepEqual(cleanTools(["constructor", "__proto__"]).unknown.sort(), ["__proto__", "constructor"]);
  // REFUSED RATHER THAN COERCED: a string is not a list of one.
  assert.equal(cleanTools(first).names, null);
  assert.equal(cleanTools(null).names, null);
  assert.equal(cleanTools({ 0: first }).names, null);
  // A non-name among them is reported as unreadable rather than as an unknown tool:
  // two different caller bugs, two different sentences.
  assert.equal(cleanTools([first, 7]).unreadable, true);
  assert.equal(cleanTools([first]).unreadable, false);
  assert.equal(cleanTools(Array.from({ length: MAX_AGENT_TOOLS + 1 }, (_, i) => `t${i}`)).tooMany, true);
});

const settings = (body, over = {}) => {
  const calls = [];
  const store = {
    update: async (...a) => { calls.push({ name: "update", args: a }); return { id: A1, ...(over.row || {}) }; },
    create: async (...a) => { calls.push({ name: "create", args: a }); return { id: A1 }; },
    count: async () => 0,
    list: async () => [],
    ...(over.store || {}),
  };
  return handleAgentApi({
    path: over.path || "/api/agent/update", method: "POST", tenant: T1, store,
    newId: () => A1, body, ...over,
  }).then((r) => ({ ...r, calls }));
};

test("THE UPDATE CARRIES A SETTING ONLY WHEN THE CALLER NAMED IT", async () => {
  // **ABSENT AND EMPTY ARE TWO DIFFERENT THINGS AND ONLY THE CALLER KNOWS WHICH.**
  // A browser tab opened before today saves a name and an instruction and says
  // nothing about either setting — filling them in from a default would un-pause an
  // agent from a screen that never showed a pause control.
  const quiet = await settings({ id: A1, name: "n", instructions: "i" });
  assert.equal(quiet.status, 200);
  const args = quiet.calls[0].args[2];
  assert.equal(args.status, undefined, "a silent save decided a status");
  assert.equal(args.tools, undefined, "a silent save decided a selection");

  const said = await settings({ id: A1, name: "n", instructions: "i", status: "paused", tools: [] });
  assert.equal(said.status, 200);
  assert.equal(said.calls[0].args[2].status, "paused");
  assert.deepEqual(said.calls[0].args[2].tools, [], "an explicit empty selection was read as silence");
});

test("...AND A SETTING IT CANNOT READ IS A REFUSAL, with nothing written", async () => {
  for (const [body, why] of [
    [{ status: "retired" }, /active or paused/i],
    [{ status: "" }, /active or paused/i],
    [{ status: ["paused"] }, /active or paused/i],
    [{ tools: "echo" }, /list/i],
    [{ tools: ["shell"] }, /no tool called shell/i],
    [{ tools: [AGENT_TOOL_NAMES[0], 7] }, /didn't arrive as a name/i],
    [{ tools: Array.from({ length: MAX_AGENT_TOOLS + 1 }, (_, i) => `t${i}`) }, /more tools/i],
  ]) {
    const r = await settings({ id: A1, name: "n", instructions: "i", ...body });
    assert.equal(r.status, 400, `${JSON.stringify(body)} was accepted`);
    assert.match(r.body.error, why);
    assert.deepEqual(r.calls, [], `${JSON.stringify(body)} reached the store anyway`);
  }
});

test("⚠ A CREATE MAY CHOOSE BOTH SETTINGS, and a status it is given is carried", async () => {
  // ⚠ THIS CASE USED TO REQUIRE THE DEFECT. It asserted `status === undefined` on a
  // create, which was the route's rule and is not the product's: the settings form
  // draws a pause control for a NEW agent, so dropping the field made that tick a
  // control somebody sets and nothing reads. The agent came back active and the box
  // that said otherwise was the only thing claiming it was paused.
  const made = await settings(
    { name: "n", instructions: "i", status: "paused", tools: [AGENT_TOOL_NAMES[0]] },
    { path: "/api/agent/create" });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.equal(made.calls[0].args[1].status, "paused", "the create dropped the status it was given");
  assert.deepEqual(made.calls[0].args[1].tools, [AGENT_TOOL_NAMES[0]]);

  // **AND SILENCE IS STILL SILENCE, which is what "default to active only when it is
  // omitted" really asks for.** Not `"active"` written here — that would be a second
  // copy of the column's default, in a second language, and the copy that drifts is
  // the one a migration cannot move.
  const quiet = await settings({ name: "n", instructions: "i" }, { path: "/api/agent/create" });
  assert.equal(quiet.status, 200);
  assert.equal(quiet.calls[0].args[1].status, undefined, "a silent create decided a status");

  // The same refusals as the update, because they are the same two readers.
  for (const [body, why] of [
    [{ status: "retired" }, /active or paused/i],
    [{ status: "" }, /active or paused/i],
    [{ status: ["paused"] }, /active or paused/i],
    [{ tools: ["shell"] }, /no tool called shell/i],
  ]) {
    const bad = await settings({ name: "n", instructions: "i", ...body }, { path: "/api/agent/create" });
    assert.equal(bad.status, 400, `${JSON.stringify(body)} was accepted on a create`);
    assert.match(bad.body.error, why);
    assert.deepEqual(bad.calls, [], `${JSON.stringify(body)} reached the store anyway`);
  }
});

test("THE LIST ANSWERS THE CATALOG, so the screen never invents one", async () => {
  const r = await handleAgentApi({
    path: "/api/agent/list", method: "GET", tenant: T1,
    store: { list: async () => [] },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.tools, AGENT_TOOLS);
  // WHAT IT IS NOT: the engine's own tool objects. A `run` function or an input
  // schema on the wire would be the platform's code going to a browser.
  for (const t of r.body.tools) {
    assert.deepEqual(Object.keys(t).sort(), ["does", "label", "name"]);
  }
});

test("⚠ A PAUSED AGENT REFUSES THE SEND, AS ITS OWN ANSWER", async () => {
  const r = await send({ id: A1, body: "are you there?", key: "press-1" },
    { bench: bench({ answer: { ok: false, error: "paused", status: "paused" } }) });
  // 409, NOT 404 AND NOT 500: the request was well formed, the agent exists and is
  // theirs, and nothing is broken — it is a conflict with the agent's own state.
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(r.body.paused, true, "the screen has to parse our prose to know what happened");
  assert.match(r.body.error, /paused/i);
  assert.match(r.body.error, /settings/i, "it does not say what would help");
  // AND IT IS NOT THE MISSING-AGENT ANSWER. Those need different things done about
  // them, so collapsing them is the one way this can mislead rather than go quiet.
  const gone = await send({ id: A1, body: "x", key: "press-1" },
    { bench: bench({ answer: { ok: false, error: "no-agent" } }) });
  assert.equal(gone.status, 404);
  assert.ok(!gone.body.paused);
  // A REFUSAL THIS CANNOT READ IS STILL THE MISSING-AGENT ANSWER — fail closed, and
  // never a 200 that reads as a message having been sent.
  const odd = await send({ id: A1, body: "x", key: "press-1" },
    { bench: bench({ answer: { ok: false, error: "something-new" } }) });
  assert.equal(odd.status, 404);
});

test("⚠ THE REQUEST THE STORE SENDS IS WHAT DECIDES, and it is read here", async () => {
  // **THE CASES ABOVE ASSERT THE ROUTE'S ARGUMENTS, WHICH IS THE LAYER BELOW THE
  // BREAK.** `store.update` composes the PATCH body, and four sweep mutants lived
  // there: a silent save filling in a status, a selection sent whether or not the
  // caller named it, and the list read dropping the two columns. From outside the
  // route all four look identical to correct code.
  const r = recorder({ agents: { status: 200, body: [{ id: A1, name: "n", instructions: "i", status: "paused", tools: ["echo"] }] } });

  // A SILENT SAVE NAMES NEITHER. Filling either in is how a browser tab opened
  // before today un-pauses an agent from a screen that never showed a pause control.
  await r.store.update(T1, A1, { name: "n", instructions: "i" });
  const quiet = r.seen.find((s) => s.method === "PATCH");
  assert.deepEqual(Object.keys(quiet.body).sort(), ["instructions", "name"]);

  // ...and a save that DOES name them sends exactly those.
  await r.store.update(T1, A1, { name: "n", instructions: "i", status: "paused", tools: [] });
  const said = r.seen.filter((s) => s.method === "PATCH")[1];
  assert.deepEqual(Object.keys(said.body).sort(), ["instructions", "name", "status", "tools"]);
  assert.equal(said.body.status, "paused");
  assert.deepEqual(said.body.tools, []);

  // THE LIST READ ASKS FOR BOTH COLUMNS, or the screen draws a status the database
  // has and the wire never carried — which `agentRow` then fails closed on, so every
  // agent on the platform reads as paused.
  await r.store.list(T1);
  const read = r.seen.find((s) => s.method === undefined || s.method === "GET");
  assert.match(read.url, /select=[^&]*\bstatus\b/);
  assert.match(read.url, /select=[^&]*\btools\b/);

  // ⚠ AND A CREATE CARRIES EACH SETTING ONLY WHEN ONE WAS CHOSEN — a key ABSENT from
  // the insert is what lets the column's default decide, which is the only place
  // "active unless somebody said otherwise" is written down. This assertion used to
  // demand that `status` was never on the wire at all; that is the defect, not the
  // rule, and the case below is its replacement.
  await r.store.create(T1, { id: A1, name: "n", instructions: "i" });
  const bare = r.seen.filter((s) => s.method === "POST").pop();
  assert.deepEqual(Object.keys(bare.body[0]).sort(), ["id", "instructions", "name", "tenant_id"]);
  await r.store.create(T1, { id: A1, name: "n", instructions: "i", status: "paused", tools: ["echo"] });
  const picked = r.seen.filter((s) => s.method === "POST").pop();
  assert.deepEqual(picked.body[0].tools, ["echo"]);
  assert.equal(picked.body[0].status, "paused", "a create dropped the status on the wire");
});

test("THE SELECTION'S ORDER IS THE CATALOG'S, whatever order it arrives in", () => {
  // ⚠ **A ONE-TOOL CATALOG CANNOT SEE THIS AT ALL** — both orders are the same list,
  // so a mutant taking the caller's order survived every case here. The catalog is
  // INJECTED for exactly that reason: a wall nobody can drive is a wall nobody is
  // guarding, and this one becomes real the day a second tool ships rather than the
  // day somebody remembers to write a case for it.
  const two = ["alpha", "beta"];
  assert.deepEqual(cleanTools(["beta", "alpha"], two).names, ["alpha", "beta"]);
  assert.deepEqual(cleanTools(["alpha", "beta"], two).names, ["alpha", "beta"]);
  assert.deepEqual(cleanTools(["beta"], two).names, ["beta"]);
  assert.deepEqual(cleanTools(["beta", "beta", "alpha"], two).names, ["alpha", "beta"]);
  // ...and the intersection is still positive against the catalog it was given.
  assert.deepEqual(cleanTools(["alpha", "gamma"], two).names, ["alpha"]);
  assert.deepEqual(cleanTools(["alpha", "gamma"], two).unknown, ["gamma"]);
  // THE DEFAULT IS THE REAL CATALOG, which is what every caller uses.
  assert.deepEqual(cleanTools([...AGENT_TOOL_NAMES]).names, [...AGENT_TOOL_NAMES]);
});


// ═══════════════════════════════════════════════════════════════════════════
// THE STEP CATALOG IS A COPY, AND THIS IS THE CENSUS THAT KEEPS IT ONE
//
// The engine runs in its own Worker and `agent-store.mjs` may not import it —
// `worker.js`'s module graph is a container image input, so importing the agent
// product would pull the whole of it into the image. **THIS FILE IS THE ONLY PLACE IN
// THE REPOSITORY THAT MAY IMPORT BOTH**, which is what makes a census possible at all.
// ═══════════════════════════════════════════════════════════════════════════

test("⚠ the step catalog is the same on both sides, BOTH WAYS", () => {
  // A step the engine can run and the screen never offers is a capability nobody can
  // reach; a step the screen offers and the engine cannot run is a control that saves,
  // draws, and fails at the first execution. Only a census in both directions catches
  // the second one, which is the worse of the two.
  assert.deepEqual([...SITE_STEP_TYPES].sort(), [...ENGINE_STEP_TYPES].sort());
  assert.ok(ENGINE_STEP_TYPES.length >= 2, "the census is looking at something");

  for (const type of ENGINE_STEP_TYPES) {
    const engine = ENGINE_STEPS.find((s) => s.type === type);
    const site = SITE_STEPS.find((s) => s.type === type);
    assert.ok(site, `${type} is runnable and is offered nowhere`);
    // THE KIND DECIDES THE BEHAVIOUR A PERSON IS PROMISED. A condition described as an
    // action would be a step somebody adds expecting it to DO something.
    assert.equal(site.kind, engine.stepKind, `${type}: the two disagree about what kind of step it is`);
    // THE WORDS ARE THE SAME ON BOTH SIDES HERE, unlike the tool catalog's — a step's
    // label and description were written for a person on both sides, so a step described
    // one way in the engine and another way on screen is a drift rather than a division.
    assert.equal(site.label, engine.label, `${type}: the label drifted`);
    assert.equal(site.does, engine.does, `${type}: the description drifted`);
    // AND THE FIELDS, because the form draws from the site's copy and the engine's `read`
    // is what decides whether what it collected means anything.
    assert.deepEqual(site.fields.map((f) => f.name), engine.fields.map((f) => f.name), `${type}: the fields drifted`);
    assert.deepEqual(site.fields.map((f) => f.kind), engine.fields.map((f) => f.kind), `${type}: the field kinds drifted`);
    // ⚠ AND FOUR PROPERTIES THAT DECIDE WHETHER A VALUE IS STORED AT ALL, each silent if it
    // drifts. `required` one way is a form that refuses what the engine accepts (or accepts
    // what it refuses); `when` one way is a field the form hides and the engine still reads,
    // or one the form collects and the engine's reader throws away — a control that answers
    // and is discarded, this repository's worst shape; `refs` one way is a `{{name}}` checked
    // on one side only, so a typo either reaches an execution or a valid name is refused;
    // and a `choice`'s OPTIONS one way is a control offering an answer the other side cannot
    // read. All four are compared as the shape each really holds.
    for (let i = 0; i < engine.fields.length; i++) {
      const [sf, ef] = [site.fields[i], engine.fields[i]];
      assert.equal(sf.required === true, ef.required === true, `${type}.${ef.name}: required drifted`);
      assert.equal(sf.refs === true, ef.refs === true, `${type}.${ef.name}: whether it takes references drifted`);
      assert.deepEqual(sf.when ? JSON.parse(JSON.stringify(sf.when)) : null,
        ef.when ? JSON.parse(JSON.stringify(ef.when)) : null, `${type}.${ef.name}: when it applies drifted`);
      assert.deepEqual(sf.options ? [...sf.options] : null, ef.options ? [...ef.options] : null,
        `${type}.${ef.name}: the options drifted`);
      // THE BOUNDS TOO, where either side declares one: a form that accepts 20,161 minutes
      // and an engine that refuses it is a save that fails after the person has left.
      for (const b of ["min", "max"]) {
        assert.equal(sf[b], ef[b], `${type}.${ef.name}: ${b} drifted`);
      }
      // ⚠ **AND WHAT KIND OF VALUE A FIELD ACCEPTS, which is silent if it drifts in a way
      // neither `required` nor `refs` can see.** One side accepting only a list while the
      // other accepts text is a reference refused at one door and admitted at the other —
      // and the loop that iterates it would be handed a string, which is
      // `String(["a"])` territory. `says` rides with it because it is what the refusal
      // CALLS the field, and a sentence that differs is a customer told two things.
      assert.equal(sf.accepts, ef.accepts, `${type}.${ef.name}: what it accepts drifted`);
      assert.equal(sf.says ?? null, ef.says ?? null, `${type}.${ef.name}: what a refusal calls it drifted`);
      // ⚠ **AND THE SENTENCE A BLANK REQUIRED FIELD GETS, which is the ONE refusal a
      // person meets by leaving a box alone — the commonest refusal there is.** It
      // drifted on four steps before this was asserted: the site said "left can't be
      // empty", naming a key nobody's screen calls anything, where the engine said "say
      // which value to compare". Declaring it on the FIELD is what makes one sentence
      // serve both doors; comparing it here is what keeps it that way.
      assert.equal(sf.empty ?? null, ef.empty ?? null, `${type}.${ef.name}: the empty-field sentence drifted`);
    }
    // AND WHAT THE STEP PRODUCES, so a step whose answer is a list on one side and text on
    // the other cannot exist: the site would let a reference through that the engine
    // refuses, or refuse one it accepts.
    assert.equal(SITE_PRODUCES(site), engine.produces, `${type}: what it produces drifted`);
    // ⚠ **AND WHETHER IT CAN FAIL AT ALL, AND WHETHER A SECOND ATTEMPT COULD ANSWER
    // DIFFERENTLY.** Both decide which error-path OPTIONS the step offers, so a drift is a
    // control one door draws and the other refuses — and `retryable` drifting the other way
    // is a retry saved on a step whose answer cannot change, spending the step-run budget
    // to reach the same refusal.
    assert.equal(site.failable === true, engine.failable === true, `${type}: whether it can fail drifted`);
    assert.equal(site.retryable === true, engine.retryable === true, `${type}: whether it may be retried drifted`);
    // ⚠ **AND WHETHER ITS RESUME IS A STORED DECISION**, which is the whole of whether it may
    // go inside a loop: `decisions` is keyed by the step's id, so one answer would stand for
    // every round. A drift is one door accepting a workflow the other refuses — and in the
    // direction that accepts it, every round after the first takes an approval nobody gave.
    assert.equal(site.decided === true, engine.decided === true, `${type}: whether its resume is decided drifted`);
    // THE OBSERVER, PROVED ALIVE IN BOTH DIRECTIONS: something out there really does
    // declare a `when`, a `refs` and a set of options, or the loop above asserts nothing.
  }
  const anyField = (pick) => ENGINE_STEPS.some((s) => s.fields.some(pick));
  assert.ok(anyField((f) => f.when), "no field declares `when`, so that comparison is vacuous");
  assert.ok(anyField((f) => f.refs === true), "no field takes references");
  assert.ok(anyField((f) => f.options), "no field offers options");
  assert.ok(anyField((f) => f.max !== undefined), "no field declares a bound");
  assert.ok(anyField((f) => f.accepts !== undefined), "no field says what it accepts");
  assert.ok(anyField((f) => f.says !== undefined), "no field carries its own word");
  assert.ok(anyField((f) => f.empty !== undefined), "no field carries its own empty-field sentence");
  assert.ok(ENGINE_STEPS.some((s) => s.failable === true), "nothing can fail, so that comparison is vacuous");
  assert.ok(ENGINE_STEPS.some((s) => s.retryable === true), "nothing may be retried, so that comparison is vacuous");
  assert.ok(ENGINE_STEPS.some((s) => s.decided === true), "nothing is resumed by a decision, so that comparison is vacuous");
  assert.ok(ENGINE_STEPS.some((s) => s.decided !== true), "everything is resumed by a decision, so the other half is vacuous");
  assert.ok(ENGINE_STEPS.some((s) => s.failable !== true), "everything can fail, so the other half is vacuous");
});

test("⚠ EVERY REFUSAL ABOUT A FIELD IS ONE SENTENCE, whichever door turns somebody away", () => {
  // ⚠ **MEASURED: 15 DIVERGENCES ACROSS 11 FIELDS, all pre-existing and none guarded.** The
  // site's generic reader named the field's KEY where the engine's bespoke `read` carried its
  // own phrase — `on_timeout has to be one of: …` against `what happens if nobody answers has
  // to be one of: …` — so a customer read one or the other depending on which door refused
  // them. And for a non-string in a required TEXT field the engine read it as BLANK where the
  // site refused it as the wrong kind, which is a coercion in the reader every text field
  // goes through.
  //
  // The word lives on the FIELD (`says`) and the blank sentence too (`empty`), and BOTH doors
  // read them. This is the census that keeps it that way: it drives every step's every field
  // with values that are wrong in five different ways and requires the same answer.
  const base = {
    weekday: { days: ["mon"] }, if: { left: "a", op: "is", right: "b" }, otherwise: {}, end: {},
    repeat: { mode: "times", times: 2 }, endrepeat: {},
    workflow: { runs: "aaaaaaaa-0000-4000-8000-000000000001" },
    wait: { mode: "for", minutes: 5 }, approval: { ask: "ok?", hours: 1, on_timeout: "reject" },
    knowledge: { query: "q", out: "a" }, memory: { key: "k", out: "a" }, note: { text: "t" },
  };
  // FIVE WAYS TO BE WRONG, per field kind: the wrong type, blank, a list where a scalar goes,
  // out of range or malformed, and ABSENT — `undefined` meaning the key is left off entirely.
  const probes = [
    { text: 7, choice: "nonsense", number: "two", days: "mon", name: 7, time: "noon", id: 7 },
    { text: "", choice: "", number: null, days: [], name: "", time: "", id: "" },
    { text: ["x"], choice: ["is"], number: 1.5, days: ["funday"], name: ["a"], time: "25:99", id: ["a"] },
    { text: "x".repeat(9999), choice: null, number: -1, days: [["mon"]], name: "Not A Name", time: "9:00", id: "nope" },
    { text: undefined, choice: undefined, number: 999999999, days: undefined, name: undefined, time: undefined, id: undefined },
  ];
  let drove = 0;
  let refusals = 0;
  for (const probe of probes) {
    for (const def of ENGINE_STEPS) {
      for (const f of def.fields) {
        const one = { type: def.type, ...base[def.type] };
        if (probe[f.kind] === undefined) delete one[f.name];
        else one[f.name] = probe[f.kind];
        const steps = def.type === "if" ? [one, { type: "end" }]
          : def.type === "repeat" ? [one, { type: "endrepeat" }] : [one];
        const site = siteCleanWorkflow(steps, SITE_STEPS, SITE_MAX_STEPS, []);
        const engine = engineReadWorkflow(steps);
        drove += 1;
        if (site.error) refusals += 1;
        assert.equal(site.error ?? null, engine.error ?? null,
          `${def.type}.${f.name} (${f.kind}): the site says ${site.error ?? "ok"} and the engine says ${engine.error ?? "ok"}`);
      }
    }
  }
  // ⚠ THE OBSERVER, IN BOTH DIRECTIONS. An empty catalog would satisfy every line above, and
  // so would a pair of readers that accepted everything. The floors are derived from the
  // catalog rather than typed, so they cannot go quiet as steps are added.
  const fieldCount = ENGINE_STEPS.reduce((n, d) => n + d.fields.length, 0);
  assert.equal(drove, fieldCount * probes.length, "the census did not drive every field with every probe");
  assert.ok(refusals >= fieldCount, `only ${refusals} of ${drove} probes were refused, so the readers accept too much`);
});

test("⚠ THE KINDS OF STEP AND FIELD ARE TWO TABLES IN TWO LANGUAGES, censused both ways", async () => {
  // ⚠ **A KIND ONE SIDE HAS AND THE OTHER DOES NOT IS A STEP ONE DOOR CAN SAVE AND THE OTHER
  // CANNOT RUN.** Both lists were inline literals in guards until a subworkflow needed a
  // sixth step kind and a seventh field kind — a list frozen by its contents, which is this
  // repository's own recorded trap, and it went red on the first honest addition.
  assert.deepEqual([...SITE_STEP_KINDS], [...ENGINE_STEP_KINDS], "the step kinds drifted");
  assert.deepEqual([...SITE_FIELD_KINDS], [...ENGINE_FIELD_KINDS], "the field kinds drifted");
  // AND EVERY CATALOG ENTRY ON BOTH SIDES USES ONLY WHAT IS DECLARED, which is what makes the
  // lists a wall rather than two matching pieces of prose.
  for (const [side, list] of [["engine", ENGINE_STEPS], ["site", SITE_STEPS]]) {
    for (const st of list) {
      assert.ok(ENGINE_STEP_KINDS.includes(st.stepKind ?? st.kind), `${side}: ${st.type} has a kind nobody declared`);
      for (const f of st.fields) assert.ok(ENGINE_FIELD_KINDS.includes(f.kind), `${side}: ${st.type}.${f.name} has a field kind nobody declared`);
    }
  }
  // ⚠ THE OBSERVER: the two newest kinds really are in use, or the lists are longer than the
  // catalogs and the loop above proves less than it looks.
  assert.ok(ENGINE_STEPS.some((st) => (st.stepKind ?? st.kind) === "call"), "no step is a call");
  assert.ok(ENGINE_STEPS.some((st) => st.fields.some((f) => f.kind === "id")), "no field is an id");
  // AND THE SUBWORKFLOW BOUNDS, which decide what saves on one side and what runs on the other.
  assert.equal(SITE_MAX_SUB_DEPTH, ENGINE_MAX_SUB_DEPTH, "how deep automations may run one another drifted");
  assert.equal(SITE_MAX_FLAT, ENGINE_MAX_FLAT, "how long a flattened workflow may be drifted");
  // ⚠ **THE EXPANSION IS THE ENGINE'S ALONE, AND THAT IS DELIBERATE RATHER THAN MISSING.**
  // Nothing on the site runs a workflow, so a second flattener here would be a copy of
  // something subtle with no caller. Asserted so a reader does not go looking for it.
  assert.equal(typeof engineExpandWorkflow, "function");
  const siteAll = await import("../agent-store.mjs");
  assert.equal(siteAll.expandWorkflow, undefined, "the site has a flattener of its own, which is a second copy of something subtle");
});

test("⚠ WHAT HAPPENS WHEN A STEP FAILS IS ONE TABLE IN TWO LANGUAGES, censused both ways", () => {
  // ⚠ **A DRIFT HERE IS A CUSTOMER'S ANSWER MEANING TWO THINGS.** The paths decide whether a
  // failure ends the workflow; the failable kinds decide which steps are even offered the
  // choice; the retry bound decides what one step may ask for. Every one is enforced in code
  // on BOTH sides, so neither can be read off the other at run time — and a copy that is not
  // censused is a copy that drifts.
  assert.deepEqual([...SITE_ERROR_PATHS], [...ENGINE_ERROR_PATHS],
    "the ways of handling a failure the screen offers are not the ones the engine runs");
  assert.deepEqual([...SITE_FAILABLE_KINDS], [...ENGINE_FAILABLE_KINDS],
    "the kinds of step that may declare an error path differ, so one door offers a control the other refuses");
  assert.equal(SITE_MAX_STEP_RETRIES, ENGINE_MAX_STEP_RETRIES,
    "a number of retries the screen accepts and the engine refuses");
  // THE ORDER IS PART OF IT, because both sides render the options into the SAME refusal
  // sentence — so a reordered list is two different sentences for one refusal.
  assert.equal(SITE_ERROR_PATHS.join(","), ENGINE_ERROR_PATHS.join(","), "the paths are in a different order");
  // AND `stop` IS THE DEFAULT ON BOTH, which is what makes an absent path mean what every
  // workflow saved before this already does. Asserted as the first entry because that is
  // where both catalogs take it from.
  assert.equal(ENGINE_ERROR_PATHS[0], "stop", "the default is no longer the one that stops");
  // ⚠ THE OBSERVER: `retry` really is withheld somewhere, or the options-are-the-wall rule
  // is a claim about nothing. Read off the catalogs rather than off the tables.
  const onErrorOf = (list, type) => (list.find((x) => x.type === type)?.fields ?? []).find((f) => f.name === "on_error");
  for (const [type, want] of [["knowledge", 3], ["note", 2], ["memory", 2], ["weekday", 2]]) {
    assert.equal(onErrorOf(ENGINE_STEPS, type)?.options.length, want, `${type} offers the wrong number of paths`);
    assert.deepEqual([...(onErrorOf(SITE_STEPS, type)?.options ?? [])], [...(onErrorOf(ENGINE_STEPS, type)?.options ?? [])],
      `${type}: the paths the two doors offer differ`);
  }
  assert.equal(onErrorOf(ENGINE_STEPS, "if"), undefined, "a branch is offered an error path it cannot have");
  assert.equal(onErrorOf(SITE_STEPS, "if"), undefined, "a branch is offered an error path it cannot have");
});

test("⚠ WHAT AN AUTOMATION ASKS FOR IS ONE DECLARATION IN TWO LANGUAGES", () => {
  /**
   * ⚠ **TWO DOORS SAVE THE SAME COLUMN NOW, so a drift is a declaration one door stores and
   * the other refuses.** The site's `cleanInputs` is what a person's form goes through; the
   * engine's `readInputs` arrived with this round, because an agent's authoring tools had NO
   * way to declare an input at all — measured, `{{customer}}` was refused by every one of
   * them while `readWorkflow` accepted the same steps with the same declarations.
   *
   * **THE BOUNDS ARE THE SAME THREE NUMBERS**, and the first is the DATABASE's:
   * `automations_inputs_shaped` caps the array at eight, so a reader that admitted nine would
   * be refused by the column with no sentence anybody can act on.
   */
  assert.equal(ENGINE_MAX_INPUTS, SITE_MAX_INPUTS, "the input ceiling drifted");
  assert.equal(ENGINE_INPUT_LABEL_MAX, SITE_INPUT_LABEL_MAX, "the label bound drifted");
  assert.equal(ENGINE_INPUT_DEFAULT_MAX, SITE_INPUT_DEFAULT_MAX, "the default bound drifted");
  assert.equal(ENGINE_MAX_INPUTS, 8, "the column's own ceiling is eight");

  // ⚠ **AND THE SAME ANSWER FOR THE SAME DECLARATION, asserted as the STORED SHAPE** — which
  // is what the column holds and what `readWorkflow` reads a reference against. A drift here
  // is an automation whose inputs mean one thing to the form and another to the engine.
  const shapes = [
    [{ name: "customer" }],
    [{ name: "Customer", label: "  Who  ", type: "text", required: true, default: "x" }],
    [{ name: "many", type: "list" }, { name: "count", type: "number" }],
  ];
  for (const raw of shapes) {
    const site = siteCleanInputs(raw);
    const eng = engineReadInputs(raw);
    assert.ok(!site.error, `the site refused ${JSON.stringify(raw)}: ${site.error}`);
    assert.ok(eng.ok, `the engine refused ${JSON.stringify(raw)}: ${eng.say}`);
    assert.deepEqual(eng.inputs, site.inputs, `stored differently: ${JSON.stringify(raw)}`);
  }
  // ⚠ AND BOTH REFUSE THE SAME THINGS, in both directions — a reader that only one door
  // refuses is a declaration that saves on one screen and cannot be edited on the other.
  const bad = [
    [{ name: "" }], [{ name: "Not A Name" }], [{ name: "a" }, { name: "a" }],
    [{ name: "x", type: "lsit" }], [{ name: "x", required: "yes" }],
    [{ name: "x", label: "L".repeat(SITE_INPUT_LABEL_MAX + 1) }],
    [{ name: "x", default: "d".repeat(SITE_INPUT_DEFAULT_MAX + 1) }],
    Array.from({ length: SITE_MAX_INPUTS + 1 }, (_, i) => ({ name: `n${i}` })),
    "not a list", [null], [["x"]],
  ];
  for (const raw of bad) {
    assert.ok(siteCleanInputs(raw).error, `the site accepted ${JSON.stringify(raw)}`);
    assert.equal(engineReadInputs(raw).ok, false, `the engine accepted ${JSON.stringify(raw)}`);
  }
  // ⚠ **AND ABSENT IS NOT EMPTY, WHICH IS THE ONE PLACE THEY DELIBERATELY DIFFER.** The site's
  // form always sends the whole list, so `undefined` there is `[]`; the engine's tools PATCH,
  // so `undefined` has to mean *leave the stored declarations alone* — answering `[]` would
  // clear them on every edit that did not mention them, which is the defect this round fixed.
  assert.deepEqual(siteCleanInputs(undefined).inputs, []);
  assert.equal(engineReadInputs(undefined).inputs, null,
    "an absent declaration list reads as an empty one, so an edit clears what is stored");
});

test("⚠ THE TYPE SYSTEM IS ONE TABLE IN TWO LANGUAGES, censused both ways", () => {
  // ⚠ **WHAT MAY BE USED WHERE DECIDES WHICH WORKFLOWS SAVE, so a drift is a customer
  // refused at one door and admitted at the other.** The site's copy is what a save really
  // goes through and the engine's is what runs it; neither may import the other.
  assert.deepEqual([...SITE_VALUE_TYPES].sort(), [...ENGINE_VALUE_TYPES].sort());
  for (const t of ENGINE_VALUE_TYPES) {
    assert.deepEqual([...(SITE_TYPE_ACCEPTS[t] ?? [])].sort(), [...(ENGINE_TYPE_ACCEPTS[t] ?? [])].sort(),
      `${t}: what it may be used for drifted`);
  }
  // ⚠ AND IT IS ASYMMETRIC, which is the whole point — asserted so a "tidying" that made
  // every type accept every other would be a red run rather than a silent widening.
  assert.ok(ENGINE_TYPE_ACCEPTS.text.includes("number"), "a number should read as text");
  assert.ok(!ENGINE_TYPE_ACCEPTS.number.includes("text"), "text must not read as a number");
  assert.ok(!ENGINE_TYPE_ACCEPTS.text.includes("list"), "a list must not read as text");

  // THE BLOCK SHAPES, which decide what a closer closes. A list can balance by COUNT and
  // pair a loop with a branch's end, so both sides must know the same pairs.
  assert.deepEqual(SITE_BLOCK_SHAPES.map((b) => [b.open, b.middle, b.close]),
    ENGINE_BLOCK_SHAPES.map((b) => [b.open, b.middle, b.close]));
  // ...AND THE SAME WORDS FOR THEM, because those words are in the refusal a person reads.
  assert.deepEqual(SITE_BLOCK_SHAPES.map((b) => [b.opened, b.middled, b.closed]),
    ENGINE_BLOCK_SHAPES.map((b) => [b.opened, b.middled, b.closed]));
  // AND THE LOOP'S OWN BOUNDS, each of which is a refusal on one side or the other.
  assert.equal(SITE_MAX_LOOP_ITERATIONS, ENGINE_MAX_LOOP_ITERATIONS);
  assert.equal(SITE_MAX_LOOP_DEPTH, ENGINE_MAX_LOOP_DEPTH);
  // THE MODES THE FORM OFFERS ARE THE MODES THE ENGINE READS, off the step itself rather
  // than a fourth copy of the list.
  const modes = (steps) => steps.find((st) => st.type === "repeat").fields.find((f) => f.name === "mode").options;
  assert.deepEqual([...SITE_LOOP_MODES], [...modes(ENGINE_STEPS)]);
  assert.deepEqual([...modes(SITE_STEPS)], [...modes(ENGINE_STEPS)]);
});

test("⚠ BOTH VALIDATORS ANSWER THE SAME WORKFLOW THE SAME WAY, driven rather than read", () => {
  // ⚠ THE CENSUS THAT WOULD HAVE CAUGHT A REAL GAP, AND DID NOT EXIST UNTIL IT DIDN'T.
  // The two readers share a SYNTAX (`{{name}}`, one module) and each holds its OWN copy of
  // what a reference may name along a path — because `worker.js`'s module graph is a
  // container image input, so the site may not import the engine. When the engine learned
  // to refuse a value produced only inside one arm, the site's copy did not, and the door a
  // customer really saves through went on accepting workflows the executor would fail.
  // Comparing SOURCE could never see that: the two are written differently on purpose.
  // What they have to agree about is the VERDICT, so the verdict is what is compared.
  const IF = { type: "if", left: "a", op: "is", right: "b" };
  const N = (text, out, over) => ({ type: "note", text, ...(out ? { out } : {}), ...(over ?? {}) });
  const shapes = [
    ["nothing at all", [], []],
    ["a plain step", [N("hello")], []],
    ["an input, used", [N("{{topic}}")], ["topic"]],
    ["an input nobody declared", [N("{{topic}}")], []],
    ["a forward reference", [N("{{later}}"), N("x", "later")], []],
    ["a step naming its own answer", [N("{{mine}}", "mine")], []],
    ["produced then used", [N("x", "draft"), N("{{draft}}")], []],
    ["a balanced branch", [IF, N("x"), { type: "otherwise" }, N("y"), { type: "end" }], []],
    ["an `if` with no `end`", [IF, N("x")], []],
    ["a stray `otherwise`", [{ type: "otherwise" }], []],
    ["a stray `end`", [{ type: "end" }], []],
    ["two `otherwise`s", [IF, { type: "otherwise" }, { type: "otherwise" }, { type: "end" }], []],
    // ⚠ THE ONE SHAPE THAT SEPARATES DEPTH FROM POSITION when a reader only answers
    // ok-or-error: a nested branch where BOTH arms have an `otherwise`. A reader taking
    // the OUTERMOST open `if` hands the inner arm's `otherwise` to the outer one, and the
    // outer's own is then refused as a second — so a perfectly legal workflow cannot be
    // saved. Found by a sweep survivor on the site's own copy, which every other nested
    // shape here passed straight through.
    ["nested, with an `otherwise` on BOTH arms",
      [IF, IF, N("a"), { type: "otherwise" }, N("b"), { type: "end" },
        { type: "otherwise" }, N("c"), { type: "end" }], []],
    // ── THE PATHS, which is what this case was added for ──────────────────────
    ["one arm's value, used after the end",
      [IF, N("x", "draft"), { type: "otherwise" }, N("y"), { type: "end" }, N("{{draft}}")], []],
    ["the other arm's value, used after the end",
      [IF, N("x"), { type: "otherwise" }, N("y", "draft"), { type: "end" }, N("{{draft}}")], []],
    ["one arm's value, used in the other",
      [IF, N("x", "draft"), { type: "otherwise" }, N("{{draft}}"), { type: "end" }], []],
    ["BOTH arms' value, used after the end",
      [IF, N("x", "draft"), { type: "otherwise" }, N("y", "draft"), { type: "end" }, N("{{draft}}")], []],
    ["produced before the branch, used inside",
      [N("x", "draft"), IF, N("{{draft}}"), { type: "end" }], []],
    ["produced and used inside one arm",
      [IF, N("x", "draft"), N("{{draft}}"), { type: "end" }], []],
    ["an `if` with no `otherwise`, used after the end",
      [IF, N("x", "draft"), { type: "end" }, N("{{draft}}")], []],
    ["nested, used after the OUTER end",
      [IF, IF, N("x", "draft"), { type: "end" }, { type: "end" }, N("{{draft}}")], []],
    ["nested, both arms of the inner one, used after the inner end",
      [IF, IF, N("x", "draft"), { type: "otherwise" }, N("y", "draft"), { type: "end" },
        N("{{draft}}"), { type: "end" }], []],
    // ⚠ A STEP WHOSE RESUME IS A STORED DECISION, INSIDE A LOOP — and the `wait` beside it
    // is the CONTROL, without which both refusals are satisfied by a door that turns away
    // every pause in a loop there is.
    ["an approval inside a repeat",
      [{ type: "repeat", mode: "times", times: 2 },
        { type: "approval", ask: "ok?", hours: 1, on_timeout: "reject" }, { type: "endrepeat" }], []],
    ["...and a WAIT inside a repeat, which is fine",
      [{ type: "repeat", mode: "times", times: 2 },
        { type: "wait", mode: "for", minutes: 5 }, { type: "endrepeat" }], []],
    ["an approval OUTSIDE a repeat, which is also fine",
      [{ type: "approval", ask: "ok?", hours: 1, on_timeout: "reject" }], []],
  ];

  let refused = 0;
  let accepted = 0;
  // ── THE LOOP AND THE TYPES, which is the newest way the two can come apart ────
  const RPT = (over) => ({ type: "repeat", mode: "each", each: "{{names}}", as: "who", ...over });
  const NAMES = [{ name: "names", type: "list" }];
  shapes.push(
    ["a loop over a list", [RPT(), N("hi {{who}}"), { type: "endrepeat" }], NAMES],
    ["a loop over TEXT", [RPT(), N("hi {{who}}"), { type: "endrepeat" }], [{ name: "names", type: "text" }]],
    ["a list in a sentence", [N("the names are {{names}}")], NAMES],
    ["a number in a sentence", [N("there are {{howmany}}")], [{ name: "howmany", type: "number" }]],
    ["a repeat with no end", [RPT(), N("hi {{who}}")], NAMES],
    ["a branch's end closing a repeat", [RPT(), { type: "end" }], NAMES],
    ["a repeat's end closing a branch", [IF, { type: "endrepeat" }], []],
    ["an `otherwise` inside a repeat", [RPT(), { type: "otherwise" }, { type: "endrepeat" }], NAMES],
    ["a value bound inside a loop, used after it",
      [RPT(), N("x", "draft"), { type: "endrepeat" }, N("{{draft}}")], NAMES],
    ["the item, used after the loop", [RPT(), { type: "endrepeat" }, N("{{who}}")], NAMES],
    ["a repeat a fixed number of times",
      [{ type: "repeat", mode: "times", times: 3 }, N("again"), { type: "endrepeat" }], []],
    ["a repeat with no list named", [RPT({ each: "" }), { type: "endrepeat" }], NAMES],
    ["a repeat more times than it may", [{ type: "repeat", mode: "times", times: SITE_MAX_LOOP_ITERATIONS + 1 },
      { type: "endrepeat" }], []],
    ["loops nested deeper than they may", [
      ...Array.from({ length: SITE_MAX_LOOP_DEPTH + 1 }, () => ({ type: "repeat", mode: "times", times: 2 })),
      ...Array.from({ length: SITE_MAX_LOOP_DEPTH + 1 }, () => ({ type: "endrepeat" })),
    ], []],
    ["a branch inside a loop", [RPT(), IF, N("a"), { type: "otherwise" }, N("b"), { type: "end" }, { type: "endrepeat" }], NAMES],
    ["a loop inside a branch", [IF, RPT(), N("a"), { type: "endrepeat" }, { type: "otherwise" }, N("b"), { type: "end" }], NAMES],
  );
  // ── THE ERROR PATHS ───────────────────────────────────────────────────────────
  // ⚠ EVERY REFUSAL HERE IS DERIVED FROM THE FIELD ON BOTH SIDES — its `says`, its
  // `options`, its bounds — so these shapes are what proves the derivation really produces
  // the same sentence rather than two templates that happen to read alike today.
  const K = (over) => ({ type: "knowledge", query: "x", out: "found", ...over });
  shapes.push(
    ["no error path at all (the default)", [N("hi")], []],
    ["carrying on past a failure", [N("hi", null, { on_error: "continue" })], []],
    ["stopping, said out loud", [N("hi", null, { on_error: "stop" })], []],
    ["a retry on the one step that may", [K({ on_error: "retry", retries: 2 })], []],
    ["a retry on a step whose answer cannot change", [N("hi", null, { on_error: "retry", retries: 2 })], []],
    ["a path nobody offers", [N("hi", null, { on_error: "carry on regardless" })], []],
    ["a path that is not a string", [N("hi", null, { on_error: ["continue"] })], []],
    ["a retry with no count", [K({ on_error: "retry" })], []],
    ["a retry counted in words", [K({ on_error: "retry", retries: "two" })], []],
    ["a retry counted at nought", [K({ on_error: "retry", retries: 0 })], []],
    ["more retries than one step may ask for", [K({ on_error: "retry", retries: SITE_MAX_STEP_RETRIES + 1 })], []],
    ["a count without a retry, which nothing reads", [K({ on_error: "continue", retries: 2 })], []],
    ["an error path on a branch, which cannot fail", [{ ...IF, on_error: "continue" }, { type: "end" }], []],
    ["an error path on a pause, which does not fail",
      [{ type: "approval", ask: "ok?", hours: 1, on_timeout: "reject", on_error: "continue" }], []],
    ["an empty error path, which means the default", [N("hi", null, { on_error: "" })], []],
    // ⚠ **THE STEP'S OWN FIELDS ARE REFUSED FIRST, AND THIS IS THE SHAPE THAT SAYS SO.** A
    // person filled those in; only a tool can put an error path on a branch, so their own
    // refusal has to win — and a reader asking about the stray path first answers "has no
    // failures to handle" about a step whose real problem is the number they typed. Found by
    // a sweep survivor: every other shape here has one thing wrong with it, and one thing
    // wrong cannot tell an order.
    ["a bad field AND a stray error path", [{ type: "repeat", mode: "times", times: 0, on_error: "continue" },
      { type: "endrepeat" }], []],
    ["a bad list AND a stray error path", [{ type: "repeat", mode: "each", each: "", on_error: "continue" },
      { type: "endrepeat" }], []],
  );
  /**
   * ⚠ **AN UNKNOWN ACTION — THE ONE SHAPE THIS CENSUS DID NOT HAVE, and the one where the two
   * sentences really differed.** MEASURED before it was fixed: the site said `step 1: this
   * platform has no step called lsit` and the engine said `there is no step called lsit`, with
   * no position and no mention of the platform. Thirty shapes and not one of them a step type
   * nobody has — so the shape a model most easily produces was the shape nobody compared.
   */
  shapes.push(
    ["an action nobody has", [{ type: "lsit" }], []],
    ["an action named by a number", [{ type: 7 }], []],
    ["an action named by nothing at all", [{}], []],
    ["a real action after an unknown one, so the position is what says which", [N("hi"), { type: "lsit" }], []],
  );
  // ── SUBWORKFLOWS ──────────────────────────────────────────────────────────────
  // Only the SHAPE is checked at save time, on both sides: whether the automation named
  // exists, whose it is, how deep the chain goes and whether it runs itself are questions
  // only a lookup can answer, and the lookup is the engine's expansion.
  const SUB = "aaaaaaaa-0000-4000-8000-000000000001";
  shapes.push(
    ["running another automation", [{ type: "workflow", runs: SUB }], []],
    ["running one with no id at all", [{ type: "workflow" }], []],
    ["running one named by something that is not an id", [{ type: "workflow", runs: "greet" }], []],
    ["running one named by a list", [{ type: "workflow", runs: [SUB] }], []],
    ["an id in capitals, which is the same id", [{ type: "workflow", runs: SUB.toUpperCase() }], []],
    ["an error path on a call, which is not a failure of its own",
      [{ type: "workflow", runs: SUB, on_error: "continue" }], []],
    ["a call inside a branch", [IF, { type: "workflow", runs: SUB }, { type: "otherwise" }, N("b"), { type: "end" }], []],
    ["a call inside a loop", [RPT(), { type: "workflow", runs: SUB }, { type: "endrepeat" }], NAMES],
  );

  for (const [what, steps, inputs] of shapes) {
    const site = siteCleanWorkflow(steps, SITE_STEPS, SITE_MAX_STEPS, inputs);
    const engine = engineReadWorkflow(steps, { inputs });
    assert.equal(!!site.error, !!engine.error,
      `${what}: the site says ${site.error ?? "ok"} and the engine says ${engine.error ?? "ok"}`);
    if (site.error) {
      refused++;
      // AND THE SAME SENTENCE, because it is what a customer reads and the two have no
      // other way to stay in step about which of the two refusals this is.
      assert.equal(site.error, engine.error, `${what}: the two refuse it differently`);
    } else {
      accepted++;
      // ⚠ AND WHAT A LATER STEP MAY NAME HAS TO MATCH TOO. Agreeing to accept a workflow
      // while disagreeing about what it produces is the same defect one step along.
      assert.deepEqual([...site.produces].sort(), [...engine.produces].sort(),
        `${what}: the two disagree about what it produces`);
      assert.deepEqual(site.steps.map((x) => x.id), engine.steps.map((x) => x.id),
        `${what}: the ids drifted`);
    }
  }
  // THE OBSERVER, PROVED ALIVE IN BOTH DIRECTIONS: a census where everything is refused,
  // or everything accepted, agrees perfectly and says nothing.
  assert.ok(refused >= 8, `only ${refused} of these shapes are refused`);
  assert.ok(accepted >= 8, `only ${accepted} of these shapes are accepted`);
});

test("the two caps and the week are the same number and the same order on both sides", () => {
  assert.equal(SITE_MAX_STEPS, ENGINE_MAX_STEPS, "a workflow the screen accepts and the engine bounds differently");
  assert.equal(SITE_MAX_NOTE, ENGINE_MAX_NOTE, "a note the screen accepts and the engine refuses");
  // THE ORDER IS PART OF IT: both sides normalise a day selection into the week's own
  // order so that saving one selection twice stores the same bytes, and two different
  // orders would make those two different rows.
  assert.deepEqual([...SITE_DAYS], [...ENGINE_WEEKDAYS]);
});

test("the tool catalog's census is untouched by any of it", () => {
  // THE CONTROL. Without it, "the catalogs agree" could be satisfied by a census that
  // had quietly stopped looking at the tools.
  assert.deepEqual([...AGENT_TOOL_NAMES].sort(), [...OFFERED_NAMES].sort());
  assert.ok(OFFERED.length >= 1);
});

// ════════════════════════════════════════════════════════════════════════════
// A TOOL CALL A PERSON HAS TO SAY YES TO — the wall, from this side
// ════════════════════════════════════════════════════════════════════════════

test("⚠ NOTHING AN AGENT CAN CALL REACHES THE DECIDING FUNCTION — from BOTH sides", () => {
  // The engine asserts this over its own modules. What is asserted HERE is the pair,
  // which only this file can see: the site owns the route that decides, the engine owns
  // the tools, and an agent approving its own request would be one of those two reaching
  // the other's function. Neither may import the other, so the census is the wall.
  const DECIDER = "decide_tool_approval";
  // (1) No capability the engine offers names it.
  assert.ok(!Object.values(CAPABILITY_RPC).includes(DECIDER),
    "an agent capability calls the deciding function");
  // (2) No tool in either catalog is named for deciding anything.
  for (const name of [...AGENT_TOOL_NAMES, ...OFFERED_NAMES]) {
    assert.ok(!/approv|decide|authoris|authoriz/i.test(name), `${name} sounds like a decision`);
  }
  // (3) THE SITE'S OWN SOURCE NAMES IT EXACTLY ONCE — in the store operation the ROUTE
  //     calls — so there is no second caller for a tool to be wired to later. Comments
  //     are blanked first, because this file's own most-repeated trap is prose that
  //     contains the thing it forbids, and `agent-store.mjs` explains this very rule.
  const blanked = readFileSync(new URL("../agent-store.mjs", import.meta.url), "utf8")
    .replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  const hits = [...blanked.matchAll(/decide_tool_approval/g)].length;
  assert.equal(hits, 1, `the site names the deciding function ${hits} times`);
  // AND THE OBSERVER IS ALIVE: the scanner can see a function name at all.
  assert.ok(blanked.includes("pending_approvals"), "the scanner found nothing to look at");
});

test("⚠ WHO DECIDED IS THE VERIFIED SESSION, AND THERE IS NO FIELD FOR IT ON THE WIRE", async () => {
  const sent = [];
  const store = {
    ownsAgent: async () => true,
    listToolApprovals: async (...a) => { sent.push({ op: "list", a }); return []; },
    decideToolApproval: async (...a) => {
      sent.push({ op: "decide", a });
      return { ok: true, repeat: false, id: "ap-1", verdict: "approved", note: null, decided_by: a[0] };
    },
  };
  const T = "11111111-1111-4111-8111-111111111111";
  // Every one of these is a field a caller could send, and not one is read.
  const r = await handleAgentApi({
    path: "/api/agent/tool-approve", method: "POST", tenant: T, store,
    body: { id: "22222222-2222-4222-8222-222222222222", verdict: "approved",
            by: "somebody-else", decided_by: "somebody-else", decidedBy: "somebody-else",
            tenant: "another-account", p_by: "somebody-else" },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const call = sent.find((c) => c.op === "decide");
  assert.equal(call.a[0], T, "the tenant did not come from the verified session");
  assert.equal(call.a[1].by, T, "who decided came from somewhere other than the session");
  assert.ok(!JSON.stringify(call.a[1]).includes("somebody-else"),
    "a body field reached the decision");
});

test("a verdict is refused rather than defaulted, and nothing is written", async () => {
  const sent = [];
  const store = {
    ownsAgent: async () => true,
    decideToolApproval: async (...a) => { sent.push(a); return { ok: true }; },
  };
  const T = "11111111-1111-4111-8111-111111111111";
  for (const bad of [undefined, null, "", "yes", "APPROVED", "maybe", true, 1, ["approved"]]) {
    sent.length = 0;
    const r = await handleAgentApi({
      path: "/api/agent/tool-approve", method: "POST", tenant: T, store,
      body: { id: "22222222-2222-4222-8222-222222222222", verdict: bad },
    });
    assert.equal(r.status, 400, `verdict ${JSON.stringify(bad)} was accepted`);
    assert.deepEqual(sent, [], `verdict ${JSON.stringify(bad)} reached the store`);
  }
  // THE CONTROL, without which "it refuses" is satisfied by a route that refuses everything.
  for (const good of TOOL_VERDICTS) {
    sent.length = 0;
    const r = await handleAgentApi({
      path: "/api/agent/tool-approve", method: "POST", tenant: T, store,
      body: { id: "22222222-2222-4222-8222-222222222222", verdict: good },
    });
    assert.equal(r.status, 200, `${good} was refused`);
    assert.equal(sent.length, 1);
  }
});

test("⚠ EVERY REASON A DECISION IS REFUSED HAS ITS OWN SENTENCE, censused off the function", async () => {
  // ⚠ **THREE REFUSALS AND THIS ROUTE COLLAPSED THEM INTO ONE 404.** `agent.decide_tool_approval`
  // answers `no-request`, `expired` and `revoked-permission`, and every one came back as *"that
  // request isn't waiting any more"* — which is FALSE of an expired one (it is still there; the
  // window closed) and FALSE of a revoked one (the permission went, not the request), and the two
  // want opposite things done: ask the agent again, or restore the permission. *A failure that
  // cannot name itself*, in the door a person presses.
  const T = "11111111-1111-4111-8111-111111111111";
  const ID = "22222222-2222-4222-8222-222222222222";
  const press = async (answer) => handleAgentApi({
    path: "/api/agent/tool-approve", method: "POST", tenant: T,
    store: { ownsAgent: async () => true, decideToolApproval: async () => answer },
    body: { id: ID, verdict: "approved" },
  });

  // NOT FOUND, NEVER FORBIDDEN, and only for the one code that means it: the function puts the
  // tenant in its own locked lookup, so another account's request and one that never existed are
  // both `no-request`.
  const gone = await press({ ok: false, error: "no-request" });
  assert.equal(gone.status, 404);
  assert.match(gone.body.error, /isn.t waiting any more/);
  assert.equal(gone.body.expired, undefined, "a missing request was reported as an expired one");

  // ⚠ A 409 AND ITS OWN FLAG, so the screen offers the one thing that helps rather than parsing
  // our prose for it. The request was well formed, the thing is theirs, and nothing is broken.
  const late = await press({ ok: false, error: "expired", expiresAt: "2026-09-18T09:00:00Z" });
  assert.equal(late.status, 409);
  assert.equal(late.body.expired, true);
  assert.equal(late.body.expiresAt, "2026-09-18T09:00:00Z");
  assert.match(late.body.error, /nobody answered that in time/);
  assert.match(late.body.error, /ask the agent for it again/, "it does not say what to do instead");
  assert.doesNotMatch(late.body.error, /isn.t waiting any more/);

  const withdrawn = await press({ ok: false, error: "revoked-permission", tool: "send_message" });
  assert.equal(withdrawn.status, 409);
  assert.equal(withdrawn.body.revoked, true);
  assert.equal(withdrawn.body.tool, "send_message");
  assert.match(withdrawn.body.error, /permission for that was taken away/);
  assert.doesNotMatch(withdrawn.body.error, /isn.t waiting any more/);

  // ⚠ A CODE THIS DOES NOT KNOW IS A 502 AND NEVER A 400. `bad-verdict` and `no-decider` refuse
  // things the route decides for itself — the verdict against `TOOL_VERDICTS`, the decider from
  // the verified session — so one arriving is our own fault, and blaming the caller for it sends
  // them to fix something they did not send.
  for (const ours of ["bad-verdict", "no-decider", "something-new", "", undefined]) {
    const r = await press({ ok: false, error: ours });
    assert.equal(r.status, 502, `${JSON.stringify(ours)} was blamed on the caller`);
    assert.equal(r.body.retry, true);
  }

  // AND THE CONTROL: a decision that really lands is still a 200. Without it, "each refusal is
  // named" is satisfied by a route that refuses everything.
  const done = await press({ ok: true, id: "ap-1", verdict: "approved", run: null });
  assert.equal(done.status, 200);

  // ⚠ **AND EVERY CODE THE FUNCTION CAN ANSWER HAS AN ARM, censused out of the migration** — a
  // code added there and not here falls to the 502, which is a real answer and the wrong one for
  // a refusal a person could act on.
  const sqlPath = new URL("../agent-builder/supabase/migrations/20260918030000_agent_approval_controls.sql",
    import.meta.url);
  const sql = readFileSync(sqlPath, "utf8");
  // WINDOWED ON THE BODY'S OWN DOLLAR QUOTES, never on the next semicolon: the sentences in this
  // file contain semicolons, which is a trap this repository has already paid for.
  const head = sql.indexOf("create or replace function agent.decide_tool_approval");
  assert.ok(head > 0, "decide_tool_approval could not be found");
  const open = sql.indexOf("$$", head);
  const close = sql.indexOf("$$", open + 2);
  assert.ok(open > 0 && close > open, "its body could not be windowed");
  const body = sql.slice(open, close);
  assert.ok(body.length < sql.length / 3, "the window swallowed more than one function");
  const codes = [...new Set([...body.matchAll(/'error',\s*'([a-z-]+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(codes, ["bad-verdict", "expired", "no-decider", "no-request", "revoked-permission"]);
  for (const code of codes) {
    const r = await press({ ok: false, error: code });
    assert.notEqual(r.status, 200, `${code} was answered as a success`);
    // THE TWO THE ROUTE ITSELF PREVENTS ARE ALLOWED TO BE THE 502; the other three must not be.
    if (code === "bad-verdict" || code === "no-decider") continue;
    assert.notEqual(r.status, 502, `${code} fell through to the couldn't-record arm`);
  }
});

test("⚠ THE LOSER OF A RACE IS TOLD WHOSE ANSWER STANDS, not shown their own", async () => {
  const T = "11111111-1111-4111-8111-111111111111";
  const store = {
    ownsAgent: async () => true,
    decideToolApproval: async () => ({ ok: true, repeat: true, id: "ap-1",
                                       verdict: "rejected", note: "no", decided_by: "them" }),
  };
  const r = await handleAgentApi({
    path: "/api/agent/tool-approve", method: "POST", tenant: T, store,
    body: { id: "22222222-2222-4222-8222-222222222222", verdict: "approved" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.repeat, true, "a second press was reported as a fresh decision");
  assert.equal(r.body.verdict, "rejected", "the loser was shown their own verdict");
});

test("the verdicts and the cap are the database's own, and a row fails closed", () => {
  const sql = readdirSync(new URL("../agent-builder/supabase/migrations", import.meta.url))
    .filter((f) => f.endsWith(".sql")).sort()
    .map((f) => readFileSync(new URL(`../agent-builder/supabase/migrations/${f}`, import.meta.url), "utf8"))
    .join("\n");
  // THE COLUMN'S OWN ENUM, read out of the migration rather than typed here — two copies
  // of one list is the shape that drifts.
  const check = /verdict\s+text\s+check \(verdict in \(([^)]*)\)\)/.exec(sql);
  assert.ok(check, "the migration's verdict check could not be found");
  const fromSql = check[1].split(",").map((x) => x.trim().replace(/'/g, "")).sort();
  assert.deepEqual([...TOOL_VERDICTS].sort(), fromSql);
  // AND THE LIMIT IS THE FUNCTION'S OWN CEILING, not a second one beside it.
  const clamp = /v_limit integer := least\(greatest\(coalesce\(p_limit, 20\), 1\), (\d+)\)/.exec(sql);
  assert.ok(clamp, "pending_approvals' own clamp could not be found");
  assert.equal(MAX_TOOL_APPROVALS, Number(clamp[1]));

  // ⚠ **THIS ASSERTED THE DEFECT AS THE RULE, and re-anchoring it is the point.** It
  // demanded every unreadable argument set read as `{}` — which is the same value a call
  // that really takes no arguments answers, and the screen drew both as *"with nothing
  // filled in"*: a positive claim about a value nobody could read, where the whole subject
  // of a decision is. The property was never "fold it to `{}`"; it is *a person must never
  // be shown a blank where the subject should be*, which needs the two told apart.
  for (const junk of [null, undefined, "args", 4, ["a"]]) {
    assert.equal(toolApprovalRow({ id: "a", args: junk }).args, null,
      `args of ${JSON.stringify(junk)} read as a decision's real subject`);
  }
  // AND `{}` IS KEPT AS ITSELF, because a tool with no arguments is a real thing and the
  // screen has a true sentence for it. Without this arm, "unreadable is null" is satisfied
  // by a reader that answers null for everything and shows nobody anything.
  assert.deepEqual(toolApprovalRow({ id: "a", args: {} }).args, {});
  assert.deepEqual(toolApprovalRow({ id: "a", args: { id: "x" } }).args, { id: "x" });
  // ⚠ AND THE WINDOW REACHES THE PERSON MAKING THE DECISION. `agent.pending_approvals` has
  // answered it since the approval-controls round and this reader dropped it, so a deadline
  // never reached the one screen that is about meeting it. `null` for a row from before the
  // window existed, never an invented one.
  assert.equal(toolApprovalRow({ id: "a", expiresAt: "2026-09-21T10:00:00+00:00" }).expiresAt,
    "2026-09-21T10:00:00+00:00");
  for (const junk of [null, undefined, 17, {}]) {
    assert.equal(toolApprovalRow({ id: "a", expiresAt: junk }).expiresAt, null);
  }
  // AND THE FIELD IS REALLY ON THE ANSWER, asked as the KEY SET rather than as one lookup:
  // a field the function stops carrying is one the screen silently stops drawing.
  assert.ok(Object.keys(toolApprovalRow({ id: "a" })).includes("expiresAt"));
  assert.equal(toolApprovalRow({}).tool, "", "a row with no tool read as something");
  assert.equal(toolApprovalRow(null).step, 0);
});

test("⚠ THE REQUEST THE STORE REALLY SENDS carries the tenant and the decider", async () => {
  // **THE ROUTE'S OWN ARGUMENTS CANNOT SEE THIS.** Four sweep mutants lived inside these
  // two store bodies — the tenant left off the list, the decider sent as null — and every
  // route-level case passed with all four applied, because the route hands the right
  // values to a function that then drops them. What settles it is the wire.
  const T = "11111111-1111-4111-8111-111111111111";
  const AG = "22222222-2222-4222-8222-222222222222";
  const r1 = recorder({ "rpc/pending_approvals": { status: 200, body: [] } });
  await r1.store.listToolApprovals(T, AG);
  const list = r1.seen.at(-1);
  assert.match(list.url, /rpc\/pending_approvals$/);
  assert.equal(list.body.p_tenant, T, "the list went out with no account on it");
  assert.equal(list.body.p_agent_id, AG);
  assert.equal(list.body.p_limit, MAX_TOOL_APPROVALS);
  // The profile header says it WRITES, because it is a POST to `/rpc/` — PostgREST
  // ignores the read header on a write, which is how a call once resolved against `public`.
  assert.equal(list.headers["content-profile"], "agent");

  const r2 = recorder({ "rpc/decide_tool_approval": { status: 200, body: { ok: true, id: "ap-1" } } });
  await r2.store.decideToolApproval(T, { id: "ap-1", verdict: "approved", note: null, by: T });
  const decide = r2.seen.at(-1);
  assert.equal(decide.body.p_tenant, T);
  assert.equal(decide.body.p_by, T, "the decision went out with nobody attached to it");
  assert.equal(decide.body.p_verdict, "approved");
  assert.equal(decide.body.p_note, null);

  // AND A FAILED REQUEST IS RAISED, NEVER READ AS AN ANSWER: `[]` from a 500 would tell
  // somebody there is nothing waiting while their agent sits stopped.
  const r3 = recorder({ "rpc/pending_approvals": { status: 500, body: { message: "boom" } } });
  await assert.rejects(() => r3.store.listToolApprovals(T, AG), /list tool approvals/);
  const r4 = recorder({ "rpc/decide_tool_approval": { status: 500, body: { message: "boom" } } });
  await assert.rejects(() => r4.store.decideToolApproval(T, { id: "ap-1", verdict: "approved", by: T }));
});

test("⚠ THE CONVERSATION READ REALLY ASKS FOR THE TWO FACTS, or every state falls back to working", async () => {
  // ⚠ **THE WIRING HOP, AND A SWEEP SURVIVOR IS WHY THIS EXISTS.** `runView` can be perfect
  // and the view can carry both columns, and if the SELECT does not name them PostgREST
  // simply does not send them — so `run_awaiting` is `undefined` and `run_open_calls` is
  // `undefined`, both readers fail closed, and every waiting or stranded run reads
  // `working` again. From outside that is indistinguishable from the feature never having
  // been built, which is exactly the class this repository keeps paying for.
  //
  // It is asserted on the WIRE rather than by reading the source, and by NAME rather than by
  // counting, so a rename is caught as well as a removal.
  const T = "11111111-1111-4111-8111-111111111111";
  const AG = "22222222-2222-4222-8222-222222222222";
  const r = recorder({ agent_thread: { status: 200, body: [] } });
  await r.store.messages(T, AG, 50);
  const read = r.seen.at(-1);
  assert.match(read.url, /agent_thread/);
  const select = decodeURIComponent(new URL(read.url).searchParams.get("select") || "");
  for (const col of ["run_open_calls", "run_awaiting", "run_children", "run_children_open"]) {
    assert.ok(select.split(",").includes(col), `the read did not ask for ${col}: ${select}`);
  }
  // THE CONTROL: the columns the reader has always needed are still asked for, so a select
  // list that had stopped naming ANYTHING would not satisfy the two lines above.
  for (const col of ["run_status", "run_stop", "run_step", "run_model"]) {
    assert.ok(select.split(",").includes(col), `the read stopped asking for ${col}: ${select}`);
  }
  // ⚠ AND THE READ IS A GET, so its schema header is the READ one — the rule the whole
  // profile round exists for, which this route is as subject to as any other.
  assert.equal(read.method ?? "GET", "GET");
  assert.equal(read.headers["accept-profile"], "agent");
  assert.equal(read.headers["content-profile"], undefined);
});

test("⚠ AN AGENT FILTER IS CHECKED, AND A REFUSED DECISION IS NOT-FOUND", async () => {
  const T = "11111111-1111-4111-8111-111111111111";
  const listed = [];
  const store = {
    ownsAgent: async () => false,
    listToolApprovals: async (...a) => { listed.push(a); return []; },
    decideToolApproval: async () => ({ ok: false, error: "no-request" }),
  };
  // A stranger's agent id must read as a missing agent, exactly as it does everywhere
  // else — and the list must not be run for it at all.
  const r = await handleAgentApi({
    path: "/api/agent/tool-approvals", method: "GET", tenant: T, store,
    query: new URLSearchParams({ agent: "33333333-3333-4333-8333-333333333333" }),
  });
  assert.equal(r.status, 404, `a stranger's agent answered ${r.status}`);
  assert.deepEqual(listed, [], "the list ran for an agent that is not this account's");

  // ⚠ NOT FOUND, NEVER FORBIDDEN. `403` tells a stranger the id they guessed is real,
  // which is the information the answer exists to withhold.
  const d = await handleAgentApi({
    path: "/api/agent/tool-approve", method: "POST", tenant: T, store,
    body: { id: "44444444-4444-4444-8444-444444444444", verdict: "approved" },
  });
  assert.equal(d.status, 404, `a refused decision answered ${d.status}`);

  // THE CONTROL: with the agent owned, the list really runs and the tenant reaches it.
  const okListed = [];
  const okStore = { ownsAgent: async () => true, listToolApprovals: async (...a) => { okListed.push(a); return []; } };
  const r2 = await handleAgentApi({
    path: "/api/agent/tool-approvals", method: "GET", tenant: T, store: okStore,
    query: new URLSearchParams({ agent: "33333333-3333-4333-8333-333333333333" }),
  });
  assert.equal(r2.status, 200);
  assert.equal(okListed.length, 1);
  assert.equal(okListed[0][0], T);
});

test("⚠ A DECISION RINGS THE ENGINE'S DOORBELL — otherwise Approve does nothing for a minute", async () => {
  // `decide_tool_approval` puts the run back on the queue INSIDE its own transaction, so
  // the work is durable the moment the decision commits. What it cannot do is ring a
  // Cloudflare queue, and without a ring the run comes back only on the sweeper's next
  // tick — a person presses Approve and watches nothing happen.
  const T = "11111111-1111-4111-8111-111111111111";
  const rung = [];
  const store = {
    ownsAgent: async () => true,
    decideToolApproval: async () => ({ ok: true, repeat: false, id: "ap-1",
                                       run: "33333333-3333-4333-8333-333333333333",
                                       verdict: "approved", note: null, decided_by: T }),
  };
  const r = await handleAgentApi({
    path: "/api/agent/tool-approve", method: "POST", tenant: T, store,
    ring: async (id) => { rung.push(id); },
    body: { id: "22222222-2222-4222-8222-222222222222", verdict: "approved" },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(rung, ["33333333-3333-4333-8333-333333333333"], "the run was never rung");
  assert.equal(r.body.notified, true);

  // ⚠ A REPEAT IS RUNG TOO, for the send route's own reason: a first press whose ring
  // failed leaves a run nobody has told anyone about, and the second press is exactly
  // when to say it again. A duplicate ring is harmless — `claim_run` refuses it.
  rung.length = 0;
  const twice = {
    ownsAgent: async () => true,
    decideToolApproval: async () => ({ ok: true, repeat: true, id: "ap-1",
                                       run: "33333333-3333-4333-8333-333333333333",
                                       verdict: "rejected", note: null, decided_by: "them" }),
  };
  await handleAgentApi({
    path: "/api/agent/tool-approve", method: "POST", tenant: T, store: twice,
    ring: async (id) => { rung.push(id); },
    body: { id: "22222222-2222-4222-8222-222222222222", verdict: "approved" },
  });
  assert.deepEqual(rung, ["33333333-3333-4333-8333-333333333333"], "a repeat was not rung");

  // ⚠ AND A FAILED RING IS SAID, NEVER RAISED. The decision is committed and the work
  // will run; answering an error would tell somebody their decision failed when it did not.
  const said = [];
  const r3 = await handleAgentApi({
    path: "/api/agent/tool-approve", method: "POST", tenant: T, store,
    ring: async () => { throw new Error("queue down"); },
    log: (...a) => said.push(a.join(" ")),
    body: { id: "22222222-2222-4222-8222-222222222222", verdict: "approved" },
  });
  assert.equal(r3.status, 200, "a failed doorbell failed the decision");
  assert.equal(r3.body.ok, true);
  assert.equal(r3.body.notified, false, "a failed ring was reported as a ring");
  assert.ok(said.some((l) => /not rung/.test(l)), "a failed ring said nothing at all");
});

test("⚠ WHEN AN AUTOMATION RUNS IS ONE LIST IN THREE LANGUAGES, and this is the only place two can meet", () => {
  // The engine gained its own `AUTOMATION_SCHEDULES` when `make_automation` shipped: a tool
  // has to tell a model which schedules exist, and the engine cannot import this file. So it
  // is a DECLARED copy, and a schedule an agent could ask for that the database refuses is a
  // control that answers and then fails at the save.
  assert.deepEqual([...ENGINE_SCHEDULES].sort(), [...SITE_SCHEDULES].sort(),
    "the schedules the engine offers a model are not the ones the site accepts");
  assert.ok(SITE_SCHEDULES.length >= 2, "an empty list makes the comparison vacuous");
  // ⚠ AND THE DATABASE'S OWN CHECK CONSTRAINT IS THE THIRD COPY, read out of the migration
  // — a CHECK cannot be imported, and this is the one file that can compare the two trees.
  const migs = readdirSync("agent-builder/supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  const sql = migs.map((f) => readFileSync(`agent-builder/supabase/migrations/${f}`, "utf8")).join("\n");
  /**
   * ⚠ **THE LAST DEFINITION WINS, so this takes the LAST match and not the first.** `exec`
   * answers the first, which is the copy in whichever migration defined the constraint
   * EARLIEST — and a later migration that widens it leaves that one superseded and still in the
   * file. Measured: this read `manual, daily` off a file two migrations back and reported the
   * database as refusing two schedules it accepts. *A position is not an identity*, in the
   * census written to stop two copies drifting.
   */
  const all = [...sql.matchAll(/check \(\s*schedule in \(([^)]*)\)\s*\)/g)];
  assert.ok(all.length, "no schedule constraint found in any migration — the observer is dead");
  const hit = all[all.length - 1];
  const inSql = hit[1].split(",").map((x) => x.trim().replace(/^'|'$/g, "")).sort();
  assert.deepEqual(inSql, [...SITE_SCHEDULES].sort(),
    "the database refuses a schedule both products offer, or accepts one neither does");
});

/**
 * ⚠ **WHAT BOUNDS REFERENCE MATERIAL AND MEMORY IS WRITTEN IN THREE LANGUAGES, and this is
 * the only file that can read two of them.**
 *
 * The engine holds a cap so an agent's own `remember` cannot fill an account; the site holds
 * one so the screen's Save cannot; the DATABASE holds the shape a row may have at all. A cap
 * on one door and not the other is a limit somebody meets from one side and not the other,
 * and a cap LOOSER than the column's turns a refusal we could phrase into a Postgres error
 * nobody can act on — which is the rule the three text caps above already follow.
 *
 * Read out of the migration by what it DEFINES rather than by its filename: an applied file
 * is renamed to its remote version, so a name is not an identity.
 */
/**
 * ⚠ **WHAT FORGETTING REACHES IS ONE SENTENCE IN THREE LANGUAGES, and until this round only one
 * of them existed.**
 *
 * `agent.delete_memory` answers `note`; the SITE's route forwards it and answers `null` when the
 * function said nothing; the ENGINE's `forget` tool forwards it and falls back to a constant of
 * its own, because a model told only "forgotten" tells somebody it was removed everywhere, which
 * is false about two of the three places a memory lives. Both products' notes CLAIMED the reach
 * was read from the function and could not drift — while the sentence beside those fields was a
 * copy nothing compared, and MEASURED, `note` was `null` on every delete that had ever gone
 * through it.
 *
 * So the fallback is the one copy left, and it is censused against the function's own words.
 */
test("⚠ THE REACH SENTENCE IS THE FUNCTION'S, and the engine's fallback cannot drift from it", () => {
  const sql = latestMigration("create or replace function agent.delete_memory(");
  /**
   * TWO ADJACENT SQL STRING LITERALS ARE ONE STRING, which is how that sentence is written so
   * it fits a line — so the reader has to join them rather than take the first. Asked for the
   * `note` key specifically, because the function answers several.
   */
  const noteAt = sql.indexOf("'note',");
  assert.ok(noteAt > 0, "delete_memory answers no sentence about what forgetting reaches");
  /**
   * ⚠ **THE TAIL CANNOT BE BOUNDED BY THE NEXT SEMICOLON, AND MY OWN FIRST DRAFT WAS** — the
   * sentence CONTAINS one (*"later runs will not see it; a run already…"*), so it read back
   * two words long and reported a correct function as answering nothing. The adjacent literals
   * are taken directly instead: `'note',` then every quoted string separated from the last by
   * nothing but whitespace, which is exactly SQL's own rule for making them one string.
   */
  const lits = /^'note',\s*((?:'(?:[^']|'')*'\s*)+)/.exec(sql.slice(noteAt));
  assert.ok(lits, "the sentence could not be read out of the function at all");
  const parts = (lits[1].match(/'(?:[^']|'')*'/g) || []).map((q) => q.slice(1, -1).replace(/''/g, "'"));
  assert.ok(parts.length >= 1, "no literal followed the note key");
  const fromSql = parts.join("").trim();
  assert.ok(fromSql.length > 40, `the sentence read back too short to be one: ${JSON.stringify(fromSql)}`);

  // THE ENGINE'S FALLBACK IS THAT SENTENCE, character for character.
  assert.equal(FORGET_REACH, fromSql,
    "the engine's fallback and the function's own words have drifted apart");

  /**
   * ⚠ **AND THE SITE HAS NO FALLBACK AT ALL, which is a deliberate asymmetry rather than a gap.**
   * A screen showing nothing extra says nothing untrue; a model composes prose from whatever it
   * holds, so leaving it with only "forgotten" is the one reading that misleads. Asserted as a
   * source census over the route's own file: the sentence must appear NOWHERE in it.
   */
  const site = readFileSync(new URL("../agent-store.mjs", import.meta.url), "utf8");
  assert.equal(site.includes(fromSql.slice(0, 40)), false,
    "the site's route carries a copy of the reach sentence, which is the drift this closes");
  assert.equal(site.includes("gone.note"), true,
    "the site's route stopped forwarding the function's own sentence");

  // AND THE THREE FACTS THE SENTENCE IS ABOUT ARE THE FUNCTION'S TOO, so the words and the
  // booleans cannot claim different things.
  for (const [field, value] of [["futureRuns", "true"], ["acceptedRuns", "false"], ["runHistory", "false"]]) {
    assert.match(sql, new RegExp(`'${field}',\\s+${value}`),
      `${field} is not answered by the function a screen reads it from`);
  }
});

test("⚠ THE MEMORY CAP IS ONE NUMBER IN THREE LANGUAGES, censused all three ways", () => {
  // THE TWO DOORS AGREE. The engine's is what a tool sends; the site's is what the route
  // sends. Neither is the model's to choose — both are constants in code.
  assert.equal(ENGINE_CAP_MEMORIES, MAX_MEMORIES,
    "an agent and a person may hold different numbers of memories");
  // AND THE DATABASE'S OWN DEFAULT IS THE THIRD COPY. `save_memory` takes the ceiling as an
  // ARGUMENT — deliberately, so the platform decides it rather than the row — which means its
  // default is what a caller that forgets gets. A default DIFFERENT from the two live numbers
  // is a silent third limit waiting for a seventh call site.
  const mem = latestMigration("create or replace function agent.save_memory(");
  const dflt = /p_max\s+integer\s+default\s+(\d+)/.exec(mem);
  assert.ok(dflt, "save_memory does not bound how many memories an agent may hold");
  assert.equal(Number(dflt[1]), MAX_MEMORIES,
    "the database's own default is a third, different cap");
  // AND IT IS REALLY ENFORCED IN THE BODY rather than merely accepted as an argument.
  assert.match(mem, /v_held >= coalesce\(p_max/, "the cap is taken as an argument and never asked");
  assert.match(mem, /select count\(\*\) into v_held from agent\.agent_memory/,
    "nothing counts what is held, so the cap is asked about a number nobody read");
  assert.match(mem, /'error', 'too-many'/, "a full account is not refused by name");

  // ── A MEMORY'S OWN SHAPE: the column's, and the site's reader must not be looser ──
  // ⚠ READ OUT OF THE **TABLE'S** MIGRATION, NOT THE FUNCTION'S — my own first draft asked
  // `save_memory`'s file for a column constraint declared in a different one, and the honest
  // failure ("the value column does not bound its length") was about where it looked.
  const cols = latestMigration("create table if not exists agent.agent_memory");
  const value = /value\s+text\s+not null check \(length\(value\) <= (\d+)\)/.exec(cols);
  assert.ok(value, "the value column does not bound its length");
  assert.equal(MEMORY_VALUE_MAX, Number(value[1]));
  const sources = /source in \(([^)]+)\)/.exec(cols);
  assert.ok(sources, "the source column admits anything");
  assert.deepEqual([...sources[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort(),
    [...MEMORY_SOURCES].sort(), "the two products disagree about who can have written a fact");
  // ⚠ THE KEY'S GRAMMAR IS THE COLUMN'S, and it is what makes a memory's name a name a
  // `{{reference}}` can carry — so a key the site would store and the engine could never
  // substitute is one nobody can use.
  assert.match(cols, /key\s+text\s+not null check \(key ~ '\^\[a-z\]\[a-z0-9_\]\{0,39\}\$'\)/,
    "the key column does not bound a memory's name");
});

test("⚠ EVERY CODE `save_memory` AND `delete_memory` CAN ANSWER HAS A SENTENCE, censused", () => {
  /**
   * ⚠ **THE SITE WRITES MEMORY THROUGH THOSE TWO FUNCTIONS NOW, so their REFUSAL CODES are on
   * this side's wire.** A code is right for a caller and useless on a screen, and the checks
   * above each route compose the ordinary sentences — so what reaches `sayMemory` is a refusal
   * they did not anticipate, which must still be said properly rather than falling through to
   * "that agent isn't here", the answer it used to get by being a `null` row.
   *
   * It is a CENSUS read out of the functions themselves, so a seventh code added to either one
   * next month fails by existing rather than by arriving at a customer as a 500.
   */
  /**
   * ⚠ **THE BODY IS BOUNDED BY ITS OWN DOLLAR DELIMITERS, and the first draft of this reader
   * sliced to the END OF THE FILE** — so it read every code of every function declared after
   * `save_memory` in the same migration and reported `bad-enabled`, which belongs to a
   * different one, as a memory refusal with no sentence. A window with no closing landmark
   * swallows the file; this one opens at the header, takes the `$$` that OPENS the body, and
   * ends at the `$$` that closes it.
   */
  const codes = new Set();
  for (const fn of ["agent.save_memory(", "agent.delete_memory("]) {
    const sql = latestMigration(`create or replace function ${fn}`);
    const at = sql.indexOf(`create or replace function ${fn}`);
    const open = sql.indexOf("$$", at);
    const close = sql.indexOf("$$", open + 2);
    assert.ok(at >= 0 && open > at && close > open, `${fn} has no readable body`);
    const body = sql.slice(at, close);
    // AND THE WINDOW IS PROVED TO BE THE FUNCTION'S OWN rather than the file's: it must hold
    // that function's header and be a small fraction of the migration it came from.
    assert.ok(body.includes(fn) && body.length < sql.length / 3,
      `the window around ${fn} is ${body.length} of ${sql.length} characters`);
    for (const m of body.matchAll(/'error',\s*'([a-z-]+)'/g)) codes.add(m[1]);
  }
  // THE OBSERVER, PROVED ALIVE: a reader that found nothing would satisfy every line below it.
  assert.ok(codes.size >= 6, `only ${codes.size} refusal codes were read out of the functions`);
  assert.ok(codes.has("too-many") && codes.has("no-agent"), `the census read ${[...codes]}`);
  const UNKNOWN = sayMemory("something-nobody-has-written-yet", {});
  for (const code of codes) {
    const [status, said] = sayMemory(code, { held: MAX_MEMORIES });
    assert.ok(status >= 400 && status < 500, `${code} is not a refusal at all (${status})`);
    assert.ok(said && said !== UNKNOWN[1], `${code} has no sentence of its own`);
  }
  // ⚠ **AND `no-agent` KEEPS ITS OLD WORDS**, because it really is the missing-agent answer:
  // a stranger must not be able to tell a refusal from an agent that is not theirs.
  assert.deepEqual(sayMemory("no-agent", {}), [404, "that agent isn't here"]);
  // THE FULL ACCOUNT SAYS HOW MANY IT HOLDS, from the function's own answer and not from this
  // side's constant — which is what makes the sentence true on a deployment whose cap has moved.
  const [full, words] = sayMemory("too-many", { held: 7 });
  assert.equal(full, 409);
  assert.match(words, /\(7\)/);
  assert.match(sayMemory("too-many", {})[1], new RegExp(`\\(${MAX_MEMORIES}\\)`),
    "with no count answered it does not fall back to this side's own ceiling");
  /**
   * ⚠ **A CODE THIS DOES NOT KNOW IS A 500 AND NEVER A 400.** Cannot-tell must not read as the
   * caller's fault: a 400 tells somebody to change what they sent about a refusal nobody here
   * can name, and every 4xx on this route is a sentence a person can act on.
   */
  assert.equal(UNKNOWN[0], 500);
  for (const junk of [undefined, null, "", 7, ["too-many"], {}]) {
    assert.equal(sayMemory(junk, {})[0], 500, `${JSON.stringify(junk)} was blamed on the caller`);
  }
});

test("⚠ THE FUNCTION'S MEMORY OBJECT IS NOT A ROW, and the difference is read once", () => {
  /**
   * `agent.save_memory` answers `{id, name, value, version, source}`; `agent_memory` answers a
   * ROW with `key` and two timestamps. **`memoryFromAnswer` is the one place that difference
   * lives**, rather than in the route — which is what lets the screen keep reading `key`.
   */
  const m = memoryFromAnswer({ id: "m1", name: "tone", value: "formal", version: 2, source: "run" });
  assert.equal(m.key, "tone", "the function's `name` did not become the screen's `key`");
  assert.equal(m.value, "formal");
  assert.equal(m.version, 2);
  assert.equal(m.source, "run");
  // ⚠ **THE TWO TIMESTAMPS ARE NOT INVENTED.** The function does not answer them, and a made-up
  // `at` on a list is worse than an absent one: it says a fact changed at a moment it did not.
  assert.equal(m.at, null, "a moment nobody recorded was invented");
  assert.equal(m.updatedAt, null, "a moment nobody recorded was invented");
  // AND IT FAILS CLOSED THE WAY A ROW DOES, because the answer comes off a wire.
  assert.equal(memoryFromAnswer(undefined).value, "");
  assert.equal(memoryFromAnswer({ source: "somewhere" }).source, "person");
});

test("⚠ REFERENCE MATERIAL IS BOUNDED TOO — and by a DIFFERENT layer, which is stated", () => {
  /**
   * ⚠ **THE MEMORY CAP IS THE DATABASE'S AND THE KNOWLEDGE CAP IS THE ROUTE'S, and saying so
   * is the point of this case.** `save_memory` counts and refuses inside one transaction;
   * reference material is written with a plain insert and the ceiling is asked in JavaScript
   * above it. There is no `save_knowledge` function at all — asserted, so a reader does not go
   * looking for one — and the consequence is named rather than papered over: a route-side
   * count is RACEABLE, so two saves landing together can both read 19 and both insert.
   *
   * **It is left as it is deliberately.** The overrun is one extra source, the columns' own
   * CHECK constraints still bound every row, and closing it means moving the write into a
   * function — which is a change to how a customer's material is stored and is not this
   * round's. What must not happen is a note claiming the database enforces it.
   */
  for (const f of readdirSync(new URL("../agent-builder/supabase/migrations/", import.meta.url))) {
    if (!f.endsWith(".sql")) continue;
    const text = readFileSync(new URL(f, new URL("../agent-builder/supabase/migrations/", import.meta.url)), "utf8");
    assert.ok(!text.includes("function agent.save_knowledge("),
      `${f} defines save_knowledge — this case's whole premise has moved`);
  }
  // THE ROUTE IS WHERE IT IS ASKED, and the sentence names the number so a customer can act.
  const site = readFileSync(new URL("../agent-store.mjs", import.meta.url), "utf8");
  assert.match(site, /if \(held >= MAX_KNOWLEDGE\) \{/, "nothing asks the knowledge ceiling");
  assert.match(site, /as much reference material as one agent can hold \(\$\{MAX_KNOWLEDGE\}\)/,
    "the refusal does not say what the limit is");

  // ── WHAT THE DATABASE DOES BOUND: every row's own shape ──────────────────────────
  const cols = latestMigration("create table if not exists agent.agent_knowledge");
  const title = /title\s+text\s+not null check \(length\(btrim\(title\)\) between 1 and (\d+)\)/.exec(cols);
  const body = /body\s+text\s+not null check \(length\(body\) between 1 and (\d+)\)/.exec(cols);
  assert.ok(title && body, "the knowledge columns do not bound their text");
  assert.equal(KNOWLEDGE_TITLE_MAX, Number(title[1]));
  assert.equal(KNOWLEDGE_BODY_MAX, Number(body[1]));
  const fmt = /format in \(([^)]+)\)/.exec(cols);
  assert.ok(fmt, "the format column admits anything");
  assert.deepEqual([...fmt[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort(),
    [...KNOWLEDGE_FORMATS].sort());

  /**
   * ⚠ **HOW MUCH COMES BACK FROM A SEARCH IS THE PLATFORM'S AND NOT THE WORKFLOW'S.**
   * `MAX_EXCERPTS` is a constant in the engine and the step passes it; there is NO field on
   * the knowledge step for it, so a saved workflow cannot ask for more and neither can a model
   * writing one. That is "bounded retrieval" in code rather than in a sentence — and
   * `search_knowledge` clamps its own answer as well, so a caller that asked for a thousand
   * would still not get them. Two walls, and the second is the one a bug here cannot move.
   */
  assert.equal(typeof ENGINE_MAX_EXCERPTS, "number");
  assert.ok(ENGINE_MAX_EXCERPTS > 0 && ENGINE_MAX_EXCERPTS <= 20, String(ENGINE_MAX_EXCERPTS));
  /**
   * ⚠ AND THE SCAN FOR "a field that chooses how much" IS **NOT** THE WAY TO ASSERT IT — my
   * own first draft forbade any field whose words mention a number and went red on `retries`,
   * which is the error-path control and is nothing to do with retrieval. *A negative scan over
   * prose cannot tell one number from another.* The property is DRIVEN in the engine's own
   * suite instead, where the `limit` really handed to `retrieve` can be read; what belongs
   * here is the CROSS-LAYER relation, which neither suite alone can see.
   */
  const search = latestMigration("create or replace function agent.search_knowledge(");
  // RE-ANCHORED, NOT APPEASED: this pinned a SINGLE SPACE after `v_limit`, and the
  // declaration gained alignment when the function grew two more locals — a spelling,
  // going red on a change that moved no bound at all.
  const clamp = /v_limit\s+integer := least\(greatest\(coalesce\(p_limit, \d+\), 1\), (\d+)\)/.exec(search);
  assert.ok(clamp, "the search does not bound its own answer, so the caller's number is the only limit");
  assert.ok(ENGINE_MAX_EXCERPTS <= Number(clamp[1]),
    `the engine asks for more than the search will ever give (${ENGINE_MAX_EXCERPTS} > ${clamp[1]})`);
  /**
   * AND A QUERY OF NOTHING IS NOTHING FOUND rather than everything, which is the other half of
   * bounded: an empty search must not become a table scan handed to a model.
   *
   * ⚠ RE-ANCHORED, NOT APPEASED: this was pinned to a bare `return;` followed by the comment
   * above it — the property written as a spelling, and the function answers an OBJECT now so
   * that a caller can tell "nothing to look for" from "nothing matched". It reads the two
   * branches for what they ANSWER: `searched, false` with an empty list, and never a query.
   */
  const blanks = search.match(/'searched', false/g) || [];
  assert.equal(blanks.length, 2,
    `a query with nothing searchable in it does not say so (${blanks.length} of the two branches)`);
  assert.match(search, /'searched', false, 'sources', v_sources,\s*'excerpts', jsonb_build_array\(\)/,
    "the nothing-searched branch answers something other than an empty list");
  // AND THE MATCHING BRANCH IS THE ONLY ONE THAT READS THE TABLE FOR PASSAGES, which is what
  // says the two above cannot have become a scan.
  assert.equal((search.match(/@@ v_q/g) || []).length, 1,
    "the search matches the index in more than one place, so a branch may answer unbounded");

  // AND A WEBHOOK'S OWN CEILING IS THE DATABASE'S, like memory's and unlike knowledge's.
  const hook = latestMigration("create or replace function agent.create_webhook(");
  const hooks = /p_max\s+integer\s+default\s+(\d+)/.exec(hook);
  assert.ok(hooks, "create_webhook does not bound how many endpoints an agent may hold");
  assert.equal(Number(hooks[1]), MAX_WEBHOOKS);
});

// ── the provider catalog is the same on both sides ───────────────────────────

test("⚠ WHAT MAY BE CONNECTED IS THE SAME ON BOTH SIDES, BOTH WAYS", () => {
  /**
   * ⚠ **A PROVIDER THE SITE OFFERS AND THE ENGINE HAS NO ADAPTER FOR IS A CONTROL THAT
   * ANSWERS: it connects, it lists, and it fails at every send** — the defect this
   * repository has recorded once already, one product over, when a tool tick outran the
   * engine that honours it. And one the ENGINE has and the site does not offer is a
   * capability nobody can reach.
   *
   * Neither product may import the other, so the site's `AGENT_PROVIDERS` is a declared
   * COPY, and this file — the one that may load both — is where the two meet.
   */
  const site = AGENT_PROVIDERS.map((p) => p.name).sort();
  // The engine holds exactly one adapter today and it says so in its own name.
  assert.deepEqual(site, [FAKE_PROVIDER], "the site offers a provider the engine cannot reach, or misses one it can");

  const fake = AGENT_PROVIDERS.find((p) => p.name === FAKE_PROVIDER);
  // ⚠ THE PERMISSIONS ARE THE SAME SET, BOTH WAYS. A scope the site lets somebody grant that
  // the provider does not know is a permission that reads as granted and does nothing; one it
  // knows and the site never offers is an action no connection can be given.
  const engineScopes = [...new Set(Object.values(FAKE_SCOPES))].sort();
  assert.deepEqual(fake.scopes.map((sc) => sc.name).sort(), engineScopes);
  // AND EVERY ACTION THE PROVIDER OFFERS IS COVERED BY A SCOPE somebody can grant, so a tool
  // the engine has cannot be unreachable because nothing may authorise it.
  for (const action of FAKE_ACTIONS) {
    assert.ok(engineScopes.includes(FAKE_SCOPES[action]), `${action} needs a scope nothing offers`);
  }
  // THE WRITES ARE A SUBSET OF THE ACTIONS — the engine's own claim, checked here because
  // this is where both halves are loaded.
  for (const w of FAKE_WRITES) assert.ok(FAKE_ACTIONS.includes(w), `${w} is a write and not an action`);

  /**
   * ⚠ **WHICH PERMISSION A `send` STEP NEEDS IS ONE FACT IN TWO LANGUAGES, and the site's copy
   * is what a SCREEN reads to decide whether an account could carry a send at all.**
   *
   * A browser cannot ask the adapter, so `AGENT_PROVIDERS[].sendScope` is a declared copy of
   * `adapter.scopes[SEND_ACTION]`. Let them drift and the screen offers an account connected
   * for reading only: the form saves, the approval is asked, and `perform` is refused by the
   * database at the last step — a control that answers, which is the defect this repository
   * records most. **Compared against the engine's OWN action name**, so renaming the action
   * moves both sides or fails here.
   */
  assert.ok(FAKE_ACTIONS.includes(ENGINE_SEND_ACTION),
    `the send step asks for ${ENGINE_SEND_ACTION}, which this provider does not offer`);
  assert.equal(fake.sendScope, FAKE_SCOPES[ENGINE_SEND_ACTION],
    "the site's send scope is not the one the adapter asks the database for");
  // AND A SEND IS A WRITE, which is what makes it approval-gated and reconciled rather than
  // repeated — asserted here because the two lists are only both in scope in this file.
  assert.ok(FAKE_WRITES.includes(ENGINE_SEND_ACTION), "a send that is not a write");

  // ⚠ AND EVERY PROVIDER NAMES A SCOPE SOMEBODY CAN REALLY GRANT IT. A `sendScope` outside a
  // provider's own list is a permission no connection can hold, so the screen would offer
  // nothing for ever — the silent direction, and a fifth provider added next month is covered
  // by this being a census rather than one assertion about `fakemail`.
  for (const pr of AGENT_PROVIDERS) {
    assert.equal(typeof pr.sendScope, "string", `${pr.name} does not say which scope a send needs`);
    assert.ok(pr.scopes.some((sc) => sc.name === pr.sendScope),
      `${pr.name} needs ${pr.sendScope} to send and does not offer it`);
  }

  // ⚠ **THE LABEL SAYS IT IS SIMULATED AND SO DOES THE FLAG, and the flag is what a reader
  // acts on.** The word in a label is what a later edit tidies away; the field is not.
  assert.equal(fake.simulated, true);
  assert.match(fake.label, /simulated/i);
  assert.match(fake.does, /nothing.*leaves|inside the platform/i);
  // AND EVERY PERMISSION SAYS WHAT IT LETS THE AGENT DO, because a person is asked to grant it.
  for (const sc of fake.scopes) {
    assert.ok(sc.label && sc.does, `the ${sc.name} permission does not say what it allows`);
  }

  // THE CEILING IS ONE NUMBER IN TWO LANGUAGES — a site that let somebody make a
  // twenty-first connection would meet the database's own refusal as a 500.
  assert.equal(MAX_CONNECTIONS, ENGINE_MAX_CONNECTIONS);
});

test("⚠ WHY A CONNECTION CANNOT BE USED IS ONE SENTENCE PER CAUSE, whichever door says it", () => {
  /**
   * ⚠ **THE ENGINE SAYS THESE TO A WORKFLOW AND THE SITE SAYS THEM TO A SCREEN, and if they
   * drift one of them is wrong about what to do.** An expired credential wants a refresh; a
   * revoked one wants reconnecting; a disconnected one only its owner can put back. A single
   * "that does not work" sends somebody to the wrong remedy, and two different sentences for
   * one cause makes a customer think they have two problems.
   *
   * Read out of the engine's SOURCE, because its table is a module-scoped constant that
   * nothing exports — and blanked first, since that file discusses these very sentences.
   */
  const raw = readFileSync(new URL("../agent-builder/src/automations.mjs", import.meta.url), "utf8");
  const at = raw.indexOf("const CONNECTION_TROUBLE = Object.freeze({");
  assert.ok(at > 0, "the engine's trouble table is not there at all");
  const table = raw.slice(at, raw.indexOf("});", at));
  for (const [status, said] of Object.entries(CONNECTION_TROUBLE)) {
    assert.ok(table.includes(`${status}:`), `the engine says nothing about a ${status} connection`);
    assert.ok(table.includes(said), `the two sides say different things about a ${status} connection`);
  }
  // BOTH WAYS: a cause the engine names and the site does not would be a workflow refusing
  // for a reason no screen can explain.
  const named = [...table.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
  assert.ok(named.length >= 3, `the scanner found ${named.length} causes in the engine's table`);
  for (const status of named) {
    assert.ok(Object.hasOwn(CONNECTION_TROUBLE, status), `the site says nothing about a ${status} connection`);
  }
  // AND THE THREE ARE THREE.
  assert.equal(new Set(Object.values(CONNECTION_TROUBLE)).size, Object.keys(CONNECTION_TROUBLE).length);
});

test("⚠ WHAT A WORKFLOW NEEDS FROM THE ACCOUNT IS ONE RULE IN TWO LANGUAGES, censused both ways", () => {
  /**
   * ⚠ **STRUCTURE AND DEPENDENCIES ARE TWO ANSWERS, and a drift here is one door saying a
   * workflow is ready and the other saying it is not.** `cleanWorkflow`/`readWorkflow` decide
   * whether the steps are a workflow at all; this decides what the ACCOUNT still has to have —
   * an account connected, a permission granted, another automation made, a time zone set. Every
   * one can be true tomorrow without the steps changing a character, so they are reported
   * rather than refused. Neither product may import the other, so it is a declared COPY, and a
   * copy that is not censused is a copy that drifts.
   */
  assert.deepEqual([...SITE_WORKFLOW_NEEDS], [...ENGINE_WORKFLOW_NEEDS], "the kinds of dependency drifted");

  const CX = "aaaaaaaa-0000-4000-8000-000000000001";
  const SUB = "bbbbbbbb-0000-4000-8000-000000000002";
  const send = [{ type: "send", connection: CX, to: "a@b.test", body: "hi" }];
  const runs = [{ type: "workflow", runs: SUB }];
  const both = [...send, ...runs];
  const active = (scopes) => [{ id: CX, provider: "p", status: "active", scopes }];
  const SCOPES = { p: "mail.send" };

  /**
   * Every shape, through BOTH readers, with the same answer demanded of each — the kind, what
   * it is about and the SENTENCE, because the sentence is what a person reads and the two have
   * no other way to stay in step about which of these it is.
   */
  const shapes = [
    ["nothing to depend on", [{ type: "note", text: "hi" }], {}],
    ["an account nobody read", send, {}],
    ["an account that is not this agent's", send, { connections: [] }],
    ["an account whose credential ran out", send, { connections: [{ id: CX, provider: "p", status: "expired", scopes: ["mail.send"] }] }],
    ["an account the provider withdrew", send, { connections: [{ id: CX, provider: "p", status: "revoked", scopes: ["mail.send"] }] }],
    ["an account somebody disconnected", send, { connections: [{ id: CX, provider: "p", status: "disconnected", scopes: [] }] }],
    ["an account in a state nobody named", send, { connections: [{ id: CX, provider: "p", status: "sideways", scopes: [] }] }],
    ["an account connected for reading only", send, { connections: active(["mail.read"]), sendScopes: SCOPES }],
    ["an account with no scopes at all", send, { connections: active([]), sendScopes: SCOPES }],
    ["an account whose scopes are not a list", send, { connections: [{ id: CX, provider: "p", status: "active", scopes: "mail.send" }], sendScopes: SCOPES }],
    ["an account that really can send", send, { connections: active(["mail.send"]), sendScopes: SCOPES }],
    ["a provider nothing says the permission for", send, { connections: active(["mail.send"]) }],
    ["a provider with no name at all", send, { connections: [{ id: CX, status: "active", scopes: [] }], sendScopes: SCOPES }],
    ["an automation nobody read", runs, {}],
    ["an automation this agent has not got", runs, { automations: [] }],
    ["an automation it really has", runs, { automations: [{ id: SUB }] }],
    ["both, both missing", both, { connections: [], automations: [] }],
    ["a timed schedule with no zone set", send, { connections: active(["mail.send"]), sendScopes: SCOPES, zone: { needed: true, have: false, schedule: "daily" } }],
    ["a timed schedule with one", send, { connections: active(["mail.send"]), sendScopes: SCOPES, zone: { needed: true, have: true, schedule: "daily" } }],
    ["a schedule that needs none", send, { connections: active(["mail.send"]), sendScopes: SCOPES, zone: { needed: false, have: false, schedule: "manual" } }],
    // ⚠ **NOT A LIST, WHICH IS WHAT A FAILED READ MUST NEVER LOOK LIKE.** `null` is "not read"
    // and `[]` is "read, and there are none"; a junk value is neither, and a reader that
    // treated it as a list would answer "nothing is missing" about a question nobody put.
    ["steps that are not a list at all", "nope", { connections: [], automations: [] }],
  ];
  let wanted = 0;
  let could = 0;
  for (const [what, steps, opts] of shapes) {
    const site = siteWorkflowNeeds(steps, opts);
    const engine = engineWorkflowNeeds(steps, opts);
    assert.deepEqual(site.needs, engine.needs, `${what}: the two disagree about what it needs`);
    assert.deepEqual(site.unchecked, engine.unchecked, `${what}: the two disagree about what could not be checked`);
    // AND EVERY KIND EITHER SIDE NAMES IS A DECLARED ONE, or the lists above are decoration.
    for (const n of [...site.needs, ...site.unchecked]) {
      assert.ok(SITE_WORKFLOW_NEEDS.includes(n.kind), `${what}: ${n.kind} is a kind nobody declared`);
    }
    wanted += site.needs.length;
    could += site.unchecked.length;
  }
  // ⚠ THE OBSERVER, IN BOTH DIRECTIONS: two readers that answered nothing at all would agree
  // perfectly and say nothing, and so would two that reported everything as missing.
  assert.ok(wanted >= 10, `only ${wanted} dependencies were named across ${shapes.length} shapes`);
  assert.ok(could >= 4, `only ${could} questions came back unanswered, so "could not check" is unexercised`);
  const clean = siteWorkflowNeeds(send, { connections: active(["mail.send"]), sendScopes: SCOPES });
  assert.deepEqual([clean.needs, clean.unchecked], [[], []], "a workflow with everything in place still reported something");
});

test("⚠ WHICH SCHEDULES ARE LOCAL TO SOMEWHERE IS ONE TABLE IN TWO LANGUAGES", () => {
  /**
   * ⚠ **A DRIFT HERE IS A TIME ZONE ASKED FOR ON ONE DOOR AND NOT THE OTHER**, which the
   * engine's own notes record shipping once: a hand-kept list let a weekly schedule through
   * with no zone and met the column's own refusal instead of a sentence.
   *
   * The FIELD NAMES differ by design — the engine calls the time `atLocal` and this side calls
   * it `at`, because each matches its own reader — so what is compared is the SHAPE: the same
   * schedules, and for each one the same number of things it needs.
   */
  assert.deepEqual(Object.keys(SITE_SCHEDULE_NEEDS).sort(), Object.keys(ENGINE_SCHEDULE_NEEDS).sort(),
    "the schedules drifted");
  for (const k of Object.keys(SITE_SCHEDULE_NEEDS)) {
    assert.equal(SITE_SCHEDULE_NEEDS[k].length, ENGINE_SCHEDULE_NEEDS[k].length,
      `${k}: the two sides disagree about how many things it needs`);
  }
  // AND THE DERIVATION, on this side, against the engine's own — a schedule with a local time
  // is a schedule that is local to somewhere.
  const engineNeedsZone = Object.keys(ENGINE_SCHEDULE_NEEDS)
    .filter((k) => ENGINE_SCHEDULE_NEEDS[k].includes("atLocal")).sort();
  assert.deepEqual([...SITE_NEEDS_ZONE].sort(), engineNeedsZone, "which schedules need a zone drifted");
  // THE OBSERVER: `manual` must not be on it, and something must be.
  assert.ok(SITE_NEEDS_ZONE.length >= 1, "no schedule needs a zone, so the derivation found nothing");
  assert.equal(SITE_NEEDS_ZONE.includes("manual"), false, "a manual automation was asked for a time zone");
});

test("⚠ AUTHORITY STAYS WITH THE CUSTOMER: no tool grants a permission, lifts one, or answers its own request", () => {
  /**
   * ⚠ **THE REQUIREMENT IS A NEGATIVE ONE, SO IT NEEDS A CENSUS RATHER THAN A CASE**:
   * *"It must not grant itself permissions, restore its own access, or approve its own
   * requests."* A case can only show that the tools we thought of do not; this shows that
   * NONE of them can, and that one added next month cannot either.
   *
   * **THE WALL IS `CAPABILITY_RPC`, which is the whole of what a tool can reach.** Every
   * capability an agent has is an entry in that map, and the database function it names is
   * the only thing the engine will call for it — so a permission function absent from the
   * map is one no tool can reach however it is described. That is a stronger statement than
   * reading the tool list, because it is about the door rather than about the words on it.
   *
   * **AND THE OBSERVER IS ALIVE**: each of these five is asserted to be a door the SITE
   * really has, or the census would pass just as well over five misspelled names.
   */
  const AUTHORITY_RPC = Object.freeze([
    "decide_tool_approval",  // approve or reject one waiting call
    "revoke_tool_approval",  // take one request back, before it runs
    "revoke_agent_tool",     // take a tool away from an agent, now
    "restore_agent_tool",    // give it back
    "revoked_tools",         // read which are withheld
  ]);
  const store = readFileSync(new URL("../agent-store.mjs", import.meta.url), "utf8");
  for (const fn of AUTHORITY_RPC) {
    assert.ok(store.includes(`rpc/${fn}`), `${fn} is not a door the site has — check the name`);
  }
  const reachable = new Set(Object.values(CAPABILITY_RPC));
  for (const fn of AUTHORITY_RPC) {
    assert.ok(!reachable.has(fn), `a tool can reach ${fn}, so an agent can decide its own permissions`);
  }
  // ⚠ **THE OTHER DIRECTION, SAID RATHER THAN LEFT TO BE INFERRED: an agent CAN stop a run
  // of its own.** `cancelExecution` → `cancel_run` is in the map deliberately — stopping work
  // is not granting yourself permission to do any — and asserting it keeps this census from
  // being read as *an agent may touch nothing*, which would make the next person weaken the
  // wrong list when a legitimate control is added.
  assert.ok(reachable.has("cancel_run"),
    "this census is about permission, not about every control — cancel_run has moved");
  // AND THE CATALOG'S WORDS ARE ASKED TOO, because a tool named for an act it cannot perform
  // is a promise in the one list a customer reads when they tick permissions. A name is not
  // the wall — the map above is — but a catalog that reads as though the agent could do this
  // is its own defect.
  for (const name of OFFERED_NAMES) {
    assert.ok(!/approv|revoke|restore|permission/i.test(name),
      `the tool "${name}" reads as a permission control`);
  }
});

test("⚠ THE REASON BOX'S CAP IS THE COLUMN'S OWN, in all three languages", () => {
  /**
   * ⚠ **A BOX THAT TAKES MORE THAN THE COLUMN DOES IS A REFUSAL AFTER THE WORDS ARE
   * WRITTEN**, and the browser cannot import either side — `public/chat.js` is a classic
   * script and this is the one file that may read both products. So the three copies are
   * compared: the column's CHECK, the site route's `TOOL_NOTE_MAX`, and the `maxlength` the
   * form really draws.
   *
   * **READ OUT OF THE TABLE'S OWN MIGRATION**, not out of a function's, because the bound is
   * the column's — the recorded mistake of asking the wrong file for a constraint.
   */
  const cols = latestMigration("create table if not exists agent.tool_revocations");
  const note = /note\s+text\s+check \(note is null or length\(note\) <= (\d+)\)/.exec(cols);
  assert.ok(note, "the note column does not bound its length");
  assert.equal(Number(note[1]), TOOL_NOTE_MAX, "the route's cap is not the column's");
  const page = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const drawn = /const AGENT_REV_WHY_MAX = (\d+);/.exec(page);
  assert.ok(drawn, "the screen declares no cap for the reason box");
  assert.equal(Number(drawn[1]), TOOL_NOTE_MAX, "the box lets somebody type more than the column takes");
  // AND THE BOX REALLY USES IT, or the constant is a number nothing reads — which is how a
  // cap comes to agree with the column and mean nothing.
  assert.match(page, /id="agRevWhy" maxlength="' \+ AGENT_REV_WHY_MAX/,
    "the reason box does not draw the cap it declares");
});

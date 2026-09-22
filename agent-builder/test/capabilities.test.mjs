/**
 * WHAT AN AGENT'S TOOLS MAY REACH, and the two walls that decide it.
 *
 * The demonstration (`npm run verify:tools`) proves these operations really change rows
 * in a real PostgreSQL. What is proved HERE is the part a database cannot see: that no
 * argument a MODEL writes can ever reach the tenant or the agent, because there is
 * nowhere to put one — and that every tool refuses by name where there is no backend
 * rather than answering as though it had done the work.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeCapabilities, CAPABILITIES, CAPABILITY_RPC, CAP_MEMORIES, CAP_AUTOMATIONS, CAPABILITY_WRITES } from "../src/capabilities.mjs";
import { CAPABILITY_TOOLS, AUTHORABLE_SCHEDULES, SCHEDULE_NEEDS, CONNECTION_TOOLS,
         DELEGATION_TOOLS, MAX_TOOL_INPUTS, FORGET_REACH, SPENT_SAY,
         TASK_MAX } from "../src/capability-tools.mjs";
import { CONNECTION_OPS, CONNECTION_WRITES } from "../src/connections.mjs";
import { DELEGATION_OPS, DELEGATION_WRITES } from "../src/delegation-store.mjs";
import { DELEGATION_DEFAULTS, WAITING_MARK, isWaiting } from "../src/delegation.mjs";
import { FAKE_WRITES } from "../src/fake-provider.mjs";
import { AUTOMATION_SCHEDULES } from "../src/automations.mjs";
import { OFFERED, OFFERED_NAMES } from "../src/agents.mjs";
import { PUBLIC, defineTool } from "../src/define.mjs";
import { profileHeader } from "../src/rest-profile.mjs";
import { splitOperation } from "../src/approvals.mjs";
import { AUTOMATION_STEPS, MAX_WORKFLOW_STEPS, readWorkflow } from "../src/automations.mjs";

const T = "tenant-one";
const AG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const AUTO = "33333333-3333-4333-8333-333333333333";
const MIGRATIONS = path.join(import.meta.dirname, "..", "supabase", "migrations");
/**
 * ⚠ AN OPERATION IDENTITY, BECAUSE EVERY WRITE NOW REQUIRES ONE. `<run>:<step>:<index>:<hash>`
 * — the shape `run.mjs` builds and `splitOperation` reads. A write handed none is refused
 * `operation-required`, deliberately: falling through to the unprotected function would make
 * the deduplication something a caller can forget, and what it protects is somebody's
 * correction not being overwritten by a retry. `OP()` gives each case its own.
 */
let opN = 0;
const OP = (step = ++opN, index = 0, hash = "cafe1234") => `${RUN}:${step}:${index}:${hash}`;
const RUN = "99999999-9999-4999-8999-999999999999";

/**
 * A backend that records what went out and answers whatever the case wants back.
 *
 * ⚠ **IT RECORDS THE WHOLE REQUEST, INCLUDING THE METHOD, and that is not tidiness.**
 * The first version of this helper kept `{rpc, body, headers}` and dropped `opts.method`
 * — so `sent.at(-1).method` was `undefined`, and the two cases written to prove that
 * every RPC is a POST failed against a store that really does send one. *A fake less
 * capable than the thing it stands in for hides a defect exactly as well as one that is
 * more*, and here it was the one field the profile rule turns on. Whatever the store
 * hands `fetch`, this keeps.
 */
function recorder(answer = () => ({})) {
  const sent = [];
  const can = makeCapabilities({
    url: "http://local", key: "service-key",
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body);
      sent.push({ ...opts, url, rpc: url.split("/rpc/")[1], body });
      const out = answer(url.split("/rpc/")[1], body);
      return { ok: true, status: 200, text: async () => JSON.stringify(out) };
    },
  });
  return { can, sent };
}

/** A backend that FAILS — the arm the recorder above cannot reach, because it always answers 200. */
function failing(status = 500, message = "boom") {
  return makeCapabilities({
    url: "http://local", key: "service-key",
    fetch: async () => ({ ok: false, status, text: async () => JSON.stringify({ message }) }),
  });
}

test("the surface is exactly what it declares, and nothing is reachable off the list", () => {
  const { can } = recorder();
  const ops = can.forTenant(T).forAgent(AG);
  assert.deepEqual(Object.keys(ops).sort(), [...CAPABILITIES].sort(),
    "an operation exists that the census cannot see, or is named and missing");
  assert.ok(CAPABILITIES.length >= 10, "the census is looking at something");
  // AND EVERY ONE NAMES A DATABASE FUNCTION, because "the same underlying operation as
  // the frontend" is a claim about which function runs.
  assert.deepEqual(Object.keys(CAPABILITY_RPC).sort(), [...CAPABILITIES].sort());
});

test("⚠ EVERY RPC NAMED IS A FUNCTION THE MIGRATIONS REALLY DEFINE", () => {
  // THE WIRING HOP THIS CATCHES: a capability that names a function nobody wrote answers
  // PGRST202 at run time, which reads from outside exactly like a tool that did nothing.
  const sql = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => fs.readFileSync(path.join(MIGRATIONS, f), "utf8")).join("\n");
  const defined = new Set([...sql.matchAll(/create or replace function agent\.([a-z_]+)/g)].map((m) => m[1]));
  assert.ok(defined.size >= 20, `the reader found only ${defined.size} functions`);
  for (const [op, fn] of Object.entries(CAPABILITY_RPC)) {
    assert.ok(defined.has(fn), `${op} calls agent.${fn}, which no migration defines`);
  }
});

test("⚠ THE TENANT AND THE AGENT ARE CLOSURES: no argument can reach them", async () => {
  const { can, sent } = recorder();
  const ops = can.forTenant(T).forAgent(AG);

  // ⚠ EVERY OPERATION IS CALLED WITH ARGUMENTS THAT TRY TO SET THEM, under every spelling
  // a model might reach for. The property is not that they are ignored — it is that the
  // REQUEST that goes out carries the closure's values whatever arrived.
  const hostile = {
    tenant: "somebody-else", tenant_id: "somebody-else", tenantId: "somebody-else",
    account: "somebody-else", owner: "somebody-else",
    agent: OTHER, agent_id: OTHER, agentId: OTHER, p_tenant: "somebody-else", p_agent_id: OTHER,
    // and the ordinary arguments, so each call is otherwise well formed
    query: "x", name: "n", value: "v", id: AG, automation: AG, enabled: true,
  };
  for (const op of CAPABILITIES) {
    sent.length = 0;
    try { await ops[op](hostile); } catch { /* a refusal is fine; what went out is the point */ }
    for (const call of sent) {
      if (Object.hasOwn(call.body, "p_tenant")) {
        assert.equal(call.body.p_tenant, T, `${op}: an argument reached the tenant`);
      }
      if (Object.hasOwn(call.body, "p_agent_id")) {
        assert.equal(call.body.p_agent_id, AG, `${op}: an argument reached the agent`);
      }
    }
  }
  // THE OBSERVER, PROVED ALIVE: the loop above is worthless if nothing was sent.
  sent.length = 0;
  await ops.listMemory();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.p_tenant, T);
  assert.equal(sent[0].body.p_agent_id, AG);
});

test("the two closures refuse what they cannot use, rather than carrying it", () => {
  const { can } = recorder();
  for (const bad of ["", "   ", null, undefined, 7, ["t1"], {}]) {
    assert.throws(() => can.forTenant(bad), TypeError, `forTenant accepted ${JSON.stringify(bad)}`);
  }
  // ⚠ `String(["t1"])` IS `"t1"`, so a list must be refused rather than coerced.
  const t = can.forTenant(T);
  for (const bad of ["", "not-a-uuid", null, undefined, 7, [AG]]) {
    assert.throws(() => t.forAgent(bad), TypeError, `forAgent accepted ${JSON.stringify(bad)}`);
  }
  assert.doesNotThrow(() => t.forAgent(AG));
});

test("⚠ A SIBLING AGENT'S ROW IS NOT THIS AGENT'S, which no tenant filter can see", async () => {
  // The database scopes these to the ACCOUNT, because a person is entitled to their whole
  // account. An agent is entitled to its own, and this is the wall that says so.
  const rows = {
    read_knowledge: { id: "k1", agent: OTHER, body: "theirs" },
    read_automation: { id: "a1", agent: OTHER, steps: [] },
    read_execution: { id: "e1", automation: "a1" },
  };
  const { can } = recorder((fn) => (Object.hasOwn(rows, fn) ? rows[fn] : []));
  const ops = can.forTenant(T).forAgent(AG);
  assert.equal(await ops.readKnowledge({ id: AG }), null, "a sibling's source was handed over");
  assert.equal(await ops.readAutomation({ id: AG }), null, "a sibling's automation was handed over");
  assert.equal(await ops.readExecution({ id: AG }), null, "a sibling's execution was handed over");

  // ⚠ AND THE LIST, WHICH IS THE ONE THE DATABASE CANNOT HELP WITH. `read_knowledge`,
  // `read_automation` and `read_execution` each hand back a row carrying an owner, so the
  // wall has something to compare; `agent.list_executions` filters on the TENANT and the
  // automation id and knows nothing about an agent, so this pre-check is the whole of it.
  // MEASURED: a mutant cutting it SURVIVED the suite — every other sibling assertion above
  // passed while one agent could read a sibling's automation history.
  // ⚠ THE AUTOMATION ID MUST BE A REAL UUID. `readAutomation` refuses a malformed id on
  // SHAPE, before it ever asks who owns it, so a made-up `"a1"` makes this case pass with
  // the wall deleted — which is what the first draft did, and what the control below caught.
  const { can: canL, sent: sentL } = recorder((fn) => (
    fn === "read_automation" ? { id: AUTO, agent: OTHER, steps: [] }
    : fn === "list_executions" ? [{ id: "e1" }] : []));
  assert.deepEqual(await canL.forTenant(T).forAgent(AG).listExecutions({ automation: AUTO }), [],
    "a sibling's automation history was handed over");
  // AND THE QUERY WAS NEVER SENT, which is the stronger half: the wall stops the ask, so a
  // reader that answered rows the filter then dropped would still fail here.
  assert.equal(sentL.filter((c) => c.rpc === "list_executions").length, 0,
    "a sibling's history was asked for at all");

  // THE CONTROL, without which "it answers null" is satisfied by a reader that answers
  // null for everything.
  const mine = { id: "k1", agent: AG, body: "mine" };
  const { can: can2 } = recorder((fn) => (fn === "read_knowledge" ? mine : []));
  const ops2 = can2.forTenant(T).forAgent(AG);
  assert.deepEqual(await ops2.readKnowledge({ id: AG }), mine, "this agent's own source was withheld");
  const { can: can3, sent: sent3 } = recorder((fn) => (
    fn === "read_automation" ? { id: AUTO, agent: AG, steps: [] }
    : fn === "list_executions" ? [{ id: "e1" }] : []));
  assert.deepEqual(await can3.forTenant(T).forAgent(AG).listExecutions({ automation: AUTO }), [{ id: "e1" }],
    "this agent's own history was withheld");
  assert.equal(sent3.filter((c) => c.rpc === "list_executions").length, 1);
});

test("⚠ `enabled` IS REFUSED, NEVER COERCED — `Boolean(\"false\")` is `true`", async () => {
  const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: "a1", agent: AG } : { ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  for (const bad of ["false", "true", 0, 1, null, undefined, "", []]) {
    sent.length = 0;
    const answer = await ops.setAutomationEnabled({ id: AG, enabled: bad, operation: OP() });
    assert.equal(answer.ok, false, `enabled accepted ${JSON.stringify(bad)}`);
    assert.equal(answer.error, "bad-enabled");
    assert.equal(sent.filter((c) => c.rpc === "set_automation_enabled").length, 0,
      `${JSON.stringify(bad)} reached the database`);
  }
  sent.length = 0;
  await ops.setAutomationEnabled({ id: AG, enabled: false, operation: OP() });
  // ⚠ THE WRAPPER IS WHAT A WRITE GOES THROUGH NOW, so the control asks for THAT name.
  assert.equal(sent.filter((c) => c.rpc === "set_automation_enabled_once").length, 1, "a real false was refused too");
});

test("the caps this side passes are the ones the operations send", async () => {
  const { can, sent } = recorder(() => ({ ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  await ops.saveMemory({ name: "a", value: "b", operation: OP() });
  assert.equal(sent.at(-1).body.p_max, CAP_MEMORIES);
  await ops.createAutomation({ id: AG, name: "x", steps: [], operation: OP() });
  assert.equal(sent.at(-1).body.p_max, CAP_AUTOMATIONS);
});

test("⚠ THE PROFILE HEADER IS DERIVED FROM THE HTTP METHOD — every RPC is a POST", async () => {
  // ⚠ **RE-ANCHORED, NOT APPEASED: THIS CASE ASSERTED THE DEFECT AS CORRECT.** It was
  // called "derived from the DIRECTION" and demanded `accept-profile` on a read — and every
  // PostgREST RPC is a POST, where that header is not honoured at all. So a read RPC had no
  // profile as far as PostgREST is concerned and resolved against the default schema, where
  // these functions do not exist. MEASURED before the fix: **10 of the 14 operations sent
  // it**, including the `read_automation` pre-check `pause_automation` and `run_automation`
  // each make first, so on a real PostgREST both would have failed at their own first step.
  // The same mistake the site builder's DELETE made, recorded there, one product over.
  const { can, sent } = recorder(() => ({ ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  await ops.listMemory();
  assert.equal(sent.at(-1).method, "POST", "a read RPC is not a POST after all");
  assert.equal(sent.at(-1).headers["content-profile"], "agent",
    "a read RPC named its schema in the header PostgREST only honours on a GET");
  assert.equal(sent.at(-1).headers["accept-profile"], undefined);
  await ops.saveMemory({ name: "a", value: "b" });
  assert.equal(sent.at(-1).headers["content-profile"], "agent");
  assert.equal(sent.at(-1).headers["accept-profile"], undefined);
});

test("⚠ …AND EVERY CAPABILITY OPERATION, WITHOUT EXCEPTION — a census, not two examples", async () => {
  // A flag a call site can forget is a flag a call site will forget: no call site passed
  // the old one at all, so the four operations that were right were right by accident of
  // how they were written. Every operation is driven and every request is read.
  const AUTO = "22222222-2222-4222-8222-222222222222";
  /**
   * ⚠ **THE FIXTURE HAS TO ANSWER A REAL EXECUTION TOO, and this is the same trap the
   * operation-record census below records one operation over.** `cancelExecution` reads the
   * execution FIRST — that read is its wall — and `readExecution` then asks `readAutomation`
   * about the automation the row names. A bare `{ok: true}` carries no `automation`, so the
   * read answers null, the operation refuses `no-execution` and the census passes over an
   * operation it never exercised. *A fake less capable than the thing it stands in for hides a
   * defect exactly as well as one that is more.*
   */
  /**
   * ⚠ **AND IT HAS TO ANSWER A LIST OF ENDPOINTS TOO, for the third time and the same reason.**
   * `setEventEndpoint` reads this agent's own endpoints FIRST — that read is its wall, because
   * `agent.set_webhook_enabled` filters by tenant and the AGENT is the scope no function-level
   * filter can see — so an empty list refuses `no-endpoint` and the census passes over an
   * operation it never exercised.
   */
  const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG }
    : fn === "read_execution" ? { id: AUTO, automation: AUTO }
    : fn === "list_webhooks" ? [{ id: AUTO, name: "Payments", event_name: "order.paid", enabled: true }]
    : { ok: true, id: AUTO }));
  const ops = can.forTenant(T).forAgent(AG);
  const drive = {
    searchKnowledge: [{ query: "x" }], listKnowledge: [], readKnowledge: [{ id: AUTO }],
    listMemory: [], saveMemory: [{ name: "a", value: "b", operation: OP() }],
    deleteMemory: [{ name: "a", operation: OP() }],
    listAutomations: [], readAutomation: [{ id: AUTO }],
    createAutomation: [{ id: AUTO, name: "x", steps: [], operation: OP() }],
    updateAutomation: [{ id: AUTO, name: "y", operation: OP() }],
    // ⚠ THE PATCH TAKES ITS OBJECT WHOLE, which is the interface: presence of a key is what
    // "this call is about that field" means, so an assembled body would put every absent one
    // back and be the replace again under another name.
    patchAutomation: [{ id: AUTO, patch: { name: "y" }, operation: OP() }],
    setAutomationEnabled: [{ id: AUTO, enabled: false, operation: OP() }],
    startAutomation: [{ id: AUTO, runId: AUTO, operation: OP() }],
    listExecutions: [{ automation: AUTO }], readExecution: [{ id: AUTO }],
    // ⚠ IT READS THE EXECUTION FIRST, which is the wall; the fixture answers one so the WRITE
    // is reached at all. A fixture answering nothing would make this look like a refusal and
    // the census would pass over an operation it never exercised.
    cancelExecution: [{ execution: AUTO, operation: OP() }],
    // A READ, and it takes nothing at all — the agent is the closure's, as it is everywhere
    // here, which is what makes "a model cannot ask about another agent's settings" true by
    // there being nowhere to say one.
    readAgentSettings: [],
    // ⚠ A READ, AND IT ASKS ABOUT A WRITE. Driven with a WRITE's name because that is the
    // only thing it answers about — asking about a read is `unknown` and reaches no request
    // at all, which would leave this operation undriven while looking driven.
    checkOperation: [{ op: "patchAutomation", operation: OP() }],
    // ⚠ A READ, AND IT TAKES NOTHING — the agent is the closure's, so there is nowhere to ask
    // about another agent's endpoints.
    listEventEndpoints: [],
    // ⚠ IT READS THIS AGENT'S OWN LIST FIRST, which is the wall; the fixture answers one so
    // the WRITE is reached at all.
    setEventEndpoint: [{ endpoint: AUTO, enabled: false, operation: OP() }],
  };
  // ⚠ CENSUSED AGAINST `CAPABILITIES` BOTH WAYS, so an operation added next month is not
  // silently left undriven — the silence would read exactly like coverage.
  assert.deepEqual(Object.keys(drive).sort(), [...CAPABILITIES].sort());
  for (const [name, args] of Object.entries(drive)) { try { await ops[name](...args); } catch { /* the shape, not the header */ } }
  assert.ok(sent.length >= CAPABILITIES.length, `only ${sent.length} requests for ${CAPABILITIES.length} operations`);
  for (const r of sent) {
    assert.equal(r.method, "POST", `${r.rpc} is not a POST`);
    assert.equal(r.headers["content-profile"], "agent", `${r.rpc} did not name its schema for a POST`);
    assert.equal(r.headers["accept-profile"], undefined, `${r.rpc} sent the read header on a POST`);
  }
  // ⚠ AND EVERY WRITE WENT THROUGH ITS `_once` WRAPPER, WHICH IS THE OTHER HALF OF THE
  // CENSUS. Derived from `CAPABILITY_WRITES` rather than listed, so a write added next month
  // is covered by existing; and the reads must NOT have one, or the deduplication would be
  // claiming to protect something that changes nothing.
  const asked = new Set(sent.map((r) => r.rpc));
  for (const w of CAPABILITY_WRITES) {
    assert.ok(asked.has(`${CAPABILITY_RPC[w]}_once`), `${w} did not go through its operation record`);
    assert.ok(!asked.has(CAPABILITY_RPC[w]), `${w} reached the plain function, bypassing the record`);
  }
  for (const r of CAPABILITIES.filter((c) => !CAPABILITY_WRITES.includes(c))) {
    assert.ok(!asked.has(`${CAPABILITY_RPC[r]}_once`), `${r} is a read and asked for an operation record`);
  }
});

test("⚠ EVERY `_once` WRAPPER A WRITE COMPOSES REALLY EXISTS IN A MIGRATION", () => {
  /**
   * ⚠ **THE CENSUS ABOVE ASKS WHAT THE STORE SENT; THIS ONE ASKS WHETHER ANYTHING IS THERE TO
   * ANSWER IT — and until `verify:tools` found it, nothing did.** `mutate` composes the name
   * (`` `${CAPABILITY_RPC[op]}_once` ``), so a write added with no wrapper sends a perfectly
   * well-formed request to a function that does not exist: PostgREST answers `PGRST202`, the
   * capability refuses, and **the agent is told its own row does not exist.** A dead control
   * that ANSWERS, which is the shape this repository records as the worst of them.
   *
   * **NO GUARD COULD SEE IT, and that is the point of this one.** Every case in this file drives
   * a FAKE `fetch`, which answers whatever it is asked — so the composed name is never resolved
   * against anything. `test/integration/pg-schema.mjs` asks `pg_proc` and is the authority, and
   * it needs a PostgreSQL that CI does not have. This is a FILE READ, so it runs everywhere the
   * suite does and the mutation sweep can see it.
   *
   * It is a CENSUS derived from `CAPABILITY_WRITES`, so a write added next month is covered by
   * existing rather than by somebody remembering.
   */
  const sql = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))
    .map((f) => fs.readFileSync(path.join(MIGRATIONS, f), "utf8")).join("\n");
  const defines = (fn) => sql.includes(`create or replace function agent.${fn}(`);
  const missing = CAPABILITY_WRITES.filter((w) => !defines(`${CAPABILITY_RPC[w]}_once`));
  assert.deepEqual(missing, [], `no migration defines a wrapper for: ${missing.join(", ")}`);
  // ⚠ AND THE PLAIN FUNCTION TOO, because the wrapper calls it BY NAME — a wrapper naming a
  // function nobody created fails at run time in exactly the same way, one layer in.
  const plainMissing = CAPABILITY_WRITES.filter((w) => !defines(CAPABILITY_RPC[w]));
  assert.deepEqual(plainMissing, [], `no migration defines the inner function for: ${plainMissing.join(", ")}`);
  // THE OBSERVER, or a reader that found nothing at all would satisfy both lines above. The
  // needle has to be able to MISS as well as match, and both halves are asserted.
  assert.ok(CAPABILITY_WRITES.length >= 4, `the census is looking at only ${CAPABILITY_WRITES.length} writes`);
  assert.equal(defines("set_webhook_enabled_once"), true, "the reader cannot find a wrapper it should");
  assert.equal(defines("no_such_function_anywhere_once"), false, "the reader matches anything");
});

// ⚠ THE CENSUS THAT USED TO SIT HERE MOVED TO `test/rest-profile.test.mjs`, WHOLE.
// It is about the RULE and its five speakers, not about this store — and it was one of two
// copies of the same check the moment the rule got a file of its own. Two lists of one
// thing drift, and the one that drifts is the one reporting whether the rule is obeyed.

test("⚠ A BACKEND THAT FAILED IS RAISED, NEVER READ AS AN ANSWER", async () => {
  // **CANNOT-TELL MUST NEVER READ AS A VALUE**, and this is the one reader where the two
  // wrong readings are opposite and both plausible. If a non-2xx answered `null`:
  //   * `readAutomation` would read it as "there is no such automation", and
  //   * `listMemory` would read it as "this agent remembers nothing" —
  // so an outage would tell an agent its memory is empty, and the agent would then act on
  // that. MEASURED: a mutant replacing the throw with `return null` SURVIVED the whole
  // suite, because every case above answers 200.
  const ops = failing(500).forTenant(T).forAgent(AG);
  await assert.rejects(() => ops.listMemory(), (e) => {
    assert.equal(e.status, 500);
    assert.match(e.message, /HTTP 500/);
    return true;
  }, "a 500 was read as an answer");
  await assert.rejects(() => ops.readAutomation({ id: AG }), /HTTP 500/,
    "a 500 was read as 'there is no such automation'");
  await assert.rejects(() => ops.listKnowledge(), /HTTP 500/);
  // THE CONTROL: the same calls against a backend that answers really do answer, so
  // "it rejects" is not satisfied by a store that rejects everything.
  const { can } = recorder(() => []);
  assert.deepEqual(await can.forTenant(T).forAgent(AG).listMemory(), []);
});

// ── the tools ───────────────────────────────────────────────────────────────

test("⚠ NO TOOL'S SCHEMA DECLARES A TENANT, AN ACCOUNT, AN OWNER OR AN AGENT", () => {
  // A model writes these arguments. A property that named one of those would be a
  // property a model could set — and the closure below it would then be decoration.
  const FORBIDDEN = /^(tenant|tenant_id|tenantId|account|owner|agent|agent_id|agentId|uid|user)$/i;
  let scanned = 0;
  for (const t of CAPABILITY_TOOLS) {
    for (const name of Object.keys(t.input?.properties ?? {})) {
      scanned++;
      assert.ok(!FORBIDDEN.test(name), `${t.name} offers a property called "${name}"`);
    }
  }
  assert.ok(scanned >= 10, `only ${scanned} properties were scanned`);
});

test("every capability tool is in the catalog, and every one is PUBLIC", () => {
  for (const t of CAPABILITY_TOOLS) {
    assert.ok(OFFERED_NAMES.includes(t.name), `${t.name} is implemented and offered nowhere`);
    // A SCOPED TOOL IN THE CATALOG IS ONE THE SETTINGS SCREEN OFFERS, A CUSTOMER TICKS,
    // AND THE RUN THEN WITHHOLDS — a promise the layer below refuses.
    assert.equal(t.scope, PUBLIC, `${t.name} is in the catalog and is not public`);
  }
  assert.equal(OFFERED.length, CAPABILITY_TOOLS.length + 1, "the catalog holds something else as well");
});

/**
 * ⚠ THE TWO TOOLS THAT ARE ABOUT THE PLATFORM RATHER THAN ABOUT ONE ACCOUNT, declared here
 * rather than inferred from a name — a rule built on the word "list" would break in silence
 * the day a tool is renamed.
 */
const NEEDS_NO_BACKEND = Object.freeze(["list_actions", "check_workflow"]);

/**
 * The two absences, named here so the census can assert they are DIFFERENT words. "This
 * deployment has no store" and "this deployment cannot reach anything outside" are two facts
 * with two remedies, and one error covering both sends a reader to the wrong one.
 */
const NO_STORE = "no-backend";
const NO_OUTSIDE = "no-connections";
// ⚠ RE-ANCHORED A THIRD TIME 2026-09-22: A THIRD SEAM, AND THREE ABSENCES NEED THREE
// SENTENCES. `ctx.delegation` is what an agent may ask OTHER AGENTS of its own account to do
// — durable work somebody has to wait for or stop, which is neither this account's records
// nor somebody else's system. A deployment can honestly have any one of the three, so a
// refusal covering two of them names the wrong absence and sends a reader to the wrong place.
const NO_HANDOFF = "no-delegation";

test("⚠ A TOOL WITH NO BACKEND REFUSES BY NAME — it does not answer as though it worked", async () => {
  // RE-ANCHORED, NOT APPEASED. This once ran over every capability tool, which was the
  // property while all twelve read an account's rows. `list_actions` and `check_workflow`
  // answer out of this repository's own code, and refusing them for want of a store is a
  // control failing for a reason that has nothing to do with the request — so the census is
  // now "every tool that NEEDS one refuses by name", with the two exceptions DECLARED and
  // proved to be real tools, or a typo would exempt one that does not exist and excuse one
  // that does.
  for (const name of NEEDS_NO_BACKEND) {
    assert.ok(CAPABILITY_TOOLS.some((t) => t.name === name), `${name} is not a tool`);
  }
  // ⚠ RE-ANCHORED AGAIN 2026-09-18: THERE ARE TWO SEAMS NOW, AND THE TWO REFUSALS MUST BE
  // DIFFERENT WORDS. `ctx.capabilities` is an account's own records and `ctx.connections` is
  // somebody else's system; a deployment can honestly have one and not the other, so a single
  // refusal would say "there is no store" about a missing PROVIDER and send whoever reads it
  // to look at the wrong thing. The three tools that reach outside are declared in the engine
  // (`CONNECTION_TOOLS`) rather than listed here, so a fourth carries this by existing.
  for (const name of [...CONNECTION_TOOLS, ...DELEGATION_TOOLS]) {
    assert.ok(CAPABILITY_TOOLS.some((t) => t.name === name), `${name} is not a tool`);
  }
  // AND NO TOOL IS ON TWO SEAMS, which is what makes the three groups a PARTITION rather
  // than three lists that happen not to overlap today.
  for (const name of DELEGATION_TOOLS) {
    assert.equal(CONNECTION_TOOLS.includes(name), false, `${name} is on two seams`);
    assert.equal(NEEDS_NO_BACKEND.includes(name), false, `${name} is on two seams`);
  }
  // THE THREE REFUSALS ARE THREE DIFFERENT WORDS, asked as a SET so a pair collapsing is
  // caught whichever two it is.
  assert.equal(new Set([NO_STORE, NO_OUTSIDE, NO_HANDOFF]).size, 3,
    "two of the three absences answer the same error");
  // WHICH SEAM EACH TOOL NEEDS, AND WHAT IT SAYS WITHOUT IT — one table, so a fourth seam is
  // a row rather than another branch.
  const SEAMS = [
    { key: "capabilities", tools: null, error: NO_STORE, say: /no store behind it/ },
    { key: "connections", tools: CONNECTION_TOOLS, error: NO_OUTSIDE, say: /cannot reach anything outside/ },
    { key: "delegation", tools: DELEGATION_TOOLS, error: NO_HANDOFF, say: /cannot hand work to other agents/ },
  ];
  const seen = new Map(SEAMS.map((s) => [s.key, 0]));
  for (const t of CAPABILITY_TOOLS) {
    if (NEEDS_NO_BACKEND.includes(t.name)) continue;
    const mine = SEAMS.find((s) => s.tools?.includes(t.name)) ?? SEAMS[0];
    seen.set(mine.key, seen.get(mine.key) + 1);
    // ⚠ THE LAST SHAPES ARE THE ONES THAT MATTER: a tool given EVERY OTHER seam and not its
    // own must still refuse, or it is reading whichever object happens to be there.
    const others = Object.fromEntries(SEAMS.filter((s) => s.key !== mine.key).map((s) => [s.key, {}]));
    const allNull = Object.fromEntries(SEAMS.map((s) => [s.key, null]));
    const allJunk = Object.fromEntries(SEAMS.map((s) => [s.key, "nope"]));
    for (const ctx of [undefined, {}, allNull, allJunk, others]) {
      const out = await t.run({ query: "x", id: AG, name: "n", value: "v", automation: AG,
        enabled: true, connection: AG, to: "a@b.test", body: "hello",
        tasks: [{ specialist: AG, task: "do it" }] }, ctx);
      assert.equal(out.ok, false, `${t.name} answered ok with no backend`);
      assert.equal(out.error, mine.error, `${t.name}: ${JSON.stringify(out)}`);
      assert.match(out.say, mine.say, `${t.name}: ${out.say}`);
    }
  }
  assert.equal([...seen.values()].reduce((a, b) => a + b, 0),
    CAPABILITY_TOOLS.length - NEEDS_NO_BACKEND.length);
  // EVERY SEAM REALLY HAD A TOOL DRIVEN AGAINST IT, or the equality above is satisfied by two
  // of the three groups being empty and one refusal never asked at all.
  for (const s of SEAMS) assert.ok(seen.get(s.key) > 0, `no tool was censused for ${s.key}`);
  // ⚠ AND THE OTHER HALF, which is what makes the exemption a property rather than a hole:
  // the two really DO work with no backend, so a `pureTool` that quietly went back through
  // `withBackend` is a red run rather than a silently refused catalog.
  for (const name of NEEDS_NO_BACKEND) {
    const t = CAPABILITY_TOOLS.find((x) => x.name === name);
    const out = await t.run({ steps: [{ type: "note", text: "x" }] }, undefined);
    assert.equal(out.ok, true, `${name} with no backend: ${JSON.stringify(out)}`);
    assert.notEqual(out.error, "no-backend", name);
  }
});

test("which tools are safe to repeat, and why each", () => {
  const byName = new Map(CAPABILITY_TOOLS.map((t) => [t.name, t]));
  void byName;
  // ⚠ RE-ANCHORED, NOT APPEASED: `run_automation` moved from `false` to `true`, and the
  // REASON moved with it. `false` was honest while the id was minted per call — and it
  // also made the tool unusable once gated, because a resume refuses a pending
  // non-repeatable call and a person who has just approved one gets `cannot-resume`.
  // MEASURED in the live demonstration. What makes `true` honest is asserted below, on
  // the derived identity, rather than taken on trust here.
  for (const t of CAPABILITY_TOOLS) {
    assert.equal(t.repeatable, true, `${t.name} is not safe to repeat`);
  }
  // ⚠ DERIVED RATHER THAN PINNED. This read `=== 12`, which is a second copy of the
  // catalog's length: it goes red on an honest addition and says nothing about the property.
  // What the census needs is that it looked at EVERY tool, and that there are some.
  assert.ok(CAPABILITY_TOOLS.length >= 12, `only ${CAPABILITY_TOOLS.length} tools`);
});

test("⚠ `writes` IS A CENSUS OVER WHAT EACH TOOL REALLY TOUCHES, NOT A LABEL", async () => {
  // Every tool is driven against a capability seam that RECORDS which operation it asked
  // for, and `writes` must be true exactly when one of those operations is a write. So a
  // write tool that forgot the flag and a read tool that carries it are both red, and
  // neither list is derived from the other — `CAPABILITIES` and `CAPABILITY_WRITES` are
  // both asserted against the surface below.
  assert.equal(CAPABILITY_WRITES.every((n) => CAPABILITIES.includes(n)), true,
    "a write is named that is not an operation at all");
  /**
   * ⚠ **RE-ANCHORED, NOT APPEASED.** This read `length === 6` — a hand-typed constant in a
   * check, which is this repository's own recorded "two copies of one thing": it fires on
   * every honest addition and says nothing about what the list is FOR.
   *
   * What the count really bought is narrow and worth keeping: the driving census below
   * catches a write REMOVED from this list only for an operation some tool reaches, because
   * then that tool's `writes: true` becomes "a read tool carrying the flag" and goes red. An
   * operation NO tool reaches is invisible to it. So the property is asked directly — a
   * floor so the observer is alive, and the unreached writes named, because they are exactly
   * the ones nothing else can see.
   */
  assert.ok(CAPABILITY_WRITES.length >= 6, `only ${CAPABILITY_WRITES.length} writes named`);
  assert.equal(CONNECTION_WRITES.every((n) => CONNECTION_OPS.includes(n)), true,
    "a connection write is named that is not an operation at all");
  assert.equal(DELEGATION_WRITES.every((n) => DELEGATION_OPS.includes(n)), true,
    "a delegation write is named that is not an operation at all");
  assert.ok(DELEGATION_WRITES.length >= 1, "no delegation write is named at all");

  const touched = new Map();
  const outsideSeen = new Map();
  const handedOn = new Map();
  for (const t of CAPABILITY_TOOLS) {
    const asked = [];
    // Every operation, answering the shape its caller reads, and recording its own name.
    // A LIST for the listers, a row for the readers, `{ok: true}` for the writers.
    const can = {};
    for (const op of CAPABILITIES) {
      can[op] = async () => {
        asked.push(op);
        // ⚠ THE SEARCH ANSWERS THE REAL SHAPE, not a bare list. `agent.search_knowledge`
        // answers one object carrying whether there was anything searchable and how many
        // sources the agent has, and a seam answering a list would make every tool above it
        // read `unknown` — a fake LESS capable than the thing it stands in for, in the field
        // the three-way distinction turns on.
        if (op === "searchKnowledge") return { ok: true, searched: true, sources: 1, excerpts: [] };
        if (op.startsWith("list")) return [];
        if (op === "saveMemory") return { ok: true, saved: "created", memory: {} };
        if (op === "deleteMemory") return { ok: true, forgot: true };
        if (op === "setAutomationEnabled") return { ok: true, enabled: true };
        if (op === "startAutomation") return { ok: true, id: AG };
        return { id: AG };
      };
    }
    await t.run({ query: "x", id: AG, name: "n", value: "v", enabled: true, steps: [] },
                { capabilities: can, operation: OP() });
    // ⚠ THE OBSERVER MUST BE ALIVE, AND ONE TOOL REACHES NOTHING BY DESIGN. `list_actions`
    // describes what the PLATFORM can do — `AUTOMATION_STEPS`, code in this repository — so
    // it has no account to ask and does not go through `withBackend` at all. It is named
    // here rather than exempted by a truthiness check, because "reached nothing" is exactly
    // what a broken tool looks like.
    const DESCRIBES_THE_PLATFORM = ["list_actions", "check_workflow"];
    if (DESCRIBES_THE_PLATFORM.includes(t.name)) {
      assert.equal(asked.length, 0, `${t.name} reached a capability, so it is not platform-only`);
      assert.equal(t.writes, false, `${t.name} describes the platform and claims to write`);
      continue;
    }
    // ⚠ **THE THREE THAT REACH OUTSIDE ARE CENSUSED THE SAME WAY AGAINST THE OTHER SEAM, and
    // `perform` is the one operation whose flag cannot come from its NAME.** `read_messages`
    // and `send_message` both call `perform`; only the second changes anything at the
    // provider. So the flag is compared against whether the ACTION the tool really asked for
    // is in the ADAPTER's own `writes` list — derived from `fake-provider.mjs` rather than
    // typed, because a hand-written list here is a second copy of the adapter's.
    if (CONNECTION_TOOLS.includes(t.name)) {
      assert.equal(asked.length, 0, `${t.name} reached a capability, so it is on the wrong seam`);
      const reached = [];
      const via = {
        list: async () => { reached.push({ op: "list" }); return []; },
        perform: async (a) => { reached.push({ op: "perform", action: a?.action ?? null }); return { ok: true }; },
      };
      await t.run({ connection: AG, to: "a@b.test", body: "hello" },
                  { connections: via, operation: OP() });
      assert.equal(reached.length > 0, true, `${t.name} reached no connection operation`);
      const wrote = reached.some((r) => r.op === "perform"
        ? FAKE_WRITES.includes(r.action)
        : CONNECTION_WRITES.includes(r.op));
      assert.equal(t.writes, wrote,
        `${t.name} reached ${JSON.stringify(reached)} and declares writes: ${t.writes}`);
      outsideSeen.set(t.name, reached);
      continue;
    }
    /**
     * ⚠ **THE TWO THAT HAND WORK TO OTHER AGENTS ARE CENSUSED THE SAME WAY AGAINST THE
     * THIRD SEAM.** Neither reaches `capabilities` at all, so without this they fall to the
     * assertion below and read as tools whose flag is unproved — which is what a broken tool
     * looks like, and is exactly what caught them the day they arrived.
     *
     * **AND THE SEAM'S OWN KEYS ARE COMPARED WITH THE DECLARED LIST, BOTH WAYS.** An
     * operation added to `forRun` and not to `DELEGATION_OPS` is one this census would walk
     * past; one named and not offered is a list describing a surface that is not there. The
     * function-valued keys are what is asked for, because `bounds` and `refusedBounds` are
     * VALUES — the deployment's ceilings, closed over rather than callable.
     */
    if (DELEGATION_TOOLS.includes(t.name)) {
      assert.equal(asked.length, 0, `${t.name} reached a capability, so it is on the wrong seam`);
      const reached = [];
      const to = {
        // The bounds are on the seam and are NOT an operation, which is the distinction the
        // key census below turns on.
        bounds: { waitMs: 60_000 },
        refusedBounds: [],
        open: async () => { reached.push("open"); return { ok: true, made: 1, children: [] }; },
        specialists: async () => { reached.push("specialists"); return [{ id: AG, name: "s", status: "active", tools: [] }]; },
        look: async () => { reached.push("look"); return []; },
      };
      const offered = Object.keys(to).filter((k) => typeof to[k] === "function").sort();
      assert.deepEqual(offered, [...DELEGATION_OPS].sort(),
        "the seam's operations and DELEGATION_OPS disagree");
      await t.run({ tasks: [{ specialist: AG, task: "do it" }] },
                  { delegation: to, operation: OP() });
      assert.equal(reached.length > 0, true, `${t.name} reached no delegation operation`);
      const wrote = reached.some((op) => DELEGATION_WRITES.includes(op));
      assert.equal(t.writes, wrote,
        `${t.name} reached [${reached.join(", ")}] and declares writes: ${t.writes}`);
      handedOn.set(t.name, reached);
      continue;
    }
    assert.equal(asked.length > 0, true, `${t.name} reached no capability, so its flag is unproved`);
    touched.set(t.name, asked);
    const writes = asked.some((op) => CAPABILITY_WRITES.includes(op));
    assert.equal(t.writes, writes,
      `${t.name} touched [${asked.join(", ")}] and declares writes: ${t.writes}`);
  }
  // EVERY TOOL WAS LOOKED AT, derived from the catalog rather than pinned to a number.
  assert.equal(touched.size + outsideSeen.size + handedOn.size + 2, CAPABILITY_TOOLS.length,
    `${touched.size} + ${outsideSeen.size} + ${handedOn.size} out of ${CAPABILITY_TOOLS.length}, with 2 platform-only`);
  assert.equal(outsideSeen.size, CONNECTION_TOOLS.length, "a connection tool was not censused");
  assert.equal(handedOn.size, DELEGATION_TOOLS.length, "a delegation tool was not censused");
  // AND BOTH DIRECTIONS ON THE THIRD SEAM TOO, or "the flag matches what it reached" is
  // satisfied by every delegation tool being a read.
  assert.ok([...handedOn.values()].some((r) => r.some((op) => DELEGATION_WRITES.includes(op))),
    "no delegation tool reached a write");
  assert.ok([...handedOn.values()].some((r) => !r.some((op) => DELEGATION_WRITES.includes(op))),
    "no delegation tool was a pure read");
  // AND BOTH DIRECTIONS ARE REALLY EXERCISED, or the equality above is satisfied by every
  // tool being a read.
  const writers = [...touched.keys()].filter((n) => CAPABILITY_TOOLS.find((t) => t.name === n).writes);
  // ⚠ DERIVED FROM THE CATALOG'S OWN FLAGS rather than listed. This was a hand-typed array of
  // six and went red the day `cancel_execution` honestly arrived — the same trap as every other
  // count in this file. What it is FOR is that both directions are really exercised, so that is
  // what is asked: some tools wrote and some did not, and the writers are exactly the flagged
  // ones. The equality against `touched` above is what makes the flags themselves true.
  assert.deepEqual(writers.sort(),
    CAPABILITY_TOOLS.filter((t) => t.writes && touched.has(t.name)).map((t) => t.name).sort());
  assert.ok(writers.length >= 6, `only ${writers.length} writing tools were driven`);
  assert.ok(touched.size > writers.length, "every driven tool writes, so the split proves nothing");
  // ⚠ AND ON THE OTHER SEAM TOO, which is what stops "one `perform` tool writes" being
  // satisfied by all three claiming it or none of them doing.
  const outWriters = [...outsideSeen.keys()].filter((n) => CAPABILITY_TOOLS.find((t) => t.name === n).writes);
  assert.deepEqual(outWriters.sort(), ["send_message"]);

  /**
   * ⚠ **AND THE WRITES NO TOOL REACHES ARE ASKED BY NAME, because nothing above can see
   * them.** The census catches a write dropped from `CAPABILITY_WRITES` only where some tool
   * reaches it — then that tool's `writes: true` becomes "a read tool carrying the flag" and
   * goes red. An operation no tool reaches is invisible to it.
   *
   * **A COUNT USED TO STAND HERE (`CAPABILITY_WRITES.length === 6`) and it was the wrong
   * shape twice over**: a hand-typed constant that fires on every honest addition, and one
   * that says nothing about what the list is for. Re-anchored onto the property.
   *
   * **AND THE FIRST RE-ANCHOR WAS VACUOUS**, which is worth recording: it scanned
   * `String(t.run)` for `updateAutomation(`, and `tool()` wraps every `run` in
   * `withBackend`, so the scan reads the WRAPPER and finds nothing for any operation. It
   * passed, said nothing, and would have gone on passing with `updateAutomation` deleted
   * from the list. The driving above is the only honest observer, so the question is asked
   * from `touched`.
   */
  const reachedByATool = new Set([...touched.values()].flat());
  assert.ok(reachedByATool.size > 0, "the driving above reached nothing, so this proves nothing");
  // `updateAutomation` IS THE WHOLE-REPLACE NO TOOL REACHES. A tool editing an automation goes
  // through `patchAutomation`, because a model names the one thing it was asked to change.
  // ⚠ IT USED TO READ "the whole-replace THE SCREEN USES", which was true until 2026-09-19 and
  // is not now: the site's edit is a patch too, for the same reason a tool's is. What the census
  // asserts is unchanged and does not rest on that — it is that NO TOOL reaches this write, and
  // it is asked from `touched` rather than from a claim about who else calls it.
  for (const unreached of ["updateAutomation"]) {
    assert.ok(CAPABILITY_WRITES.includes(unreached), `${unreached} is no longer named a write`);
    assert.equal(reachedByATool.has(unreached), false,
      `${unreached} is reached by a tool now — the census can see it, so this naming is stale`);
  }
});

test("⚠ A TOOL THAT WRITES MUST BE REPEATABLE — a write that cannot be repeated never finishes", () => {
  // Enforced at the declaration rather than trusted, because the failure is invisible: a
  // resume refuses a pending non-repeatable call and names it, for ever, so such a tool
  // is a control that holds and never completes.
  for (const t of CAPABILITY_TOOLS) {
    if (t.writes) assert.equal(t.repeatable, true, `${t.name} writes and is not repeatable`);
  }
  const spec = { name: "charge", description: "takes money", input: { type: "object" }, scope: PUBLIC, run: async () => ({}) };
  assert.throws(() => defineTool({ ...spec, writes: true }), /must be repeatable/);
  assert.throws(() => defineTool({ ...spec, writes: true, repeatable: false }), /must be repeatable/);
  // Refused rather than coerced — `Boolean("false")` is `true`.
  assert.throws(() => defineTool({ ...spec, writes: "false", repeatable: true }), /not coerced/);
  // AND THE OBSERVER IS ALIVE: the pair that is legal really is accepted, and a tool that
  // says nothing defaults to not writing.
  assert.equal(defineTool({ ...spec, writes: true, repeatable: true }).writes, true);
  assert.equal(defineTool(spec).writes, false);
});

test("⚠ `remember` SETS `source: run` ITSELF, and a model cannot claim a person typed it", async () => {
  const { can, sent } = recorder(() => ({ ok: true, saved: "created", memory: {} }));
  const ops = can.forTenant(T).forAgent(AG);
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "remember");
  await tool.run({ name: "tone", value: "plain", source: "person" }, { capabilities: ops, operation: OP() });
  assert.equal(sent.at(-1).body.p_source, "run",
    "an argument chose where the fact came from");
  // AND THE SCHEMA DOES NOT OFFER IT, which is the wall in front of that one.
  assert.equal(tool.input.properties.source, undefined);
});

test("⚠ `run_automation` DERIVES ITS RUN ID FROM THE CALL, so a redelivery is one execution", async () => {
  // ⚠ RE-ANCHORED, NOT APPEASED. This asserted that the id was MINTED, which was true and
  // was the reason the tool could not be resumed after somebody approved it. The property
  // now is that the same call always asks for the same execution — which is what makes
  // `repeatable: true` above honest rather than convenient.
  const mk = () => recorder((fn) => (fn === "read_automation" ? { id: "a1", agent: AG } : { ok: true, id: "made" }));
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "run_automation");

  const a = mk();
  const out = await tool.run({ id: AG, runId: "chosen-by-the-model" },
    { capabilities: a.can.forTenant(T).forAgent(AG), operation: OP(7, 0), newId: () => "ours" });
  assert.equal(out.ok, true, JSON.stringify(out));
  const first = a.sent.at(-1).body.p_run_id;
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    `the derived id is not a uuid: ${first}`);
  assert.notEqual(first, "ours", "a minted id was used where a derived one exists");
  assert.notEqual(first, "chosen-by-the-model", "a model named the run it started");
  assert.equal(tool.input.properties.runId, undefined, "the schema offers the model an id");

  // THE SAME CALL AGAIN IS THE SAME EXECUTION — which is the whole of the guarantee.
  const b = mk();
  await tool.run({ id: AG }, { capabilities: b.can.forTenant(T).forAgent(AG), operation: OP(7, 0) });
  assert.equal(b.sent.at(-1).body.p_run_id, first, "a redelivery asked for a different execution");
  // AND A DIFFERENT CALL IS A DIFFERENT ONE, or every call in a run would collide.
  const c = mk();
  await tool.run({ id: AG }, { capabilities: c.can.forTenant(T).forAgent(AG), operation: OP(7, 1) });
  assert.notEqual(c.sent.at(-1).body.p_run_id, first, "two different calls share one execution");

  // ⚠ A DEPLOYMENT THAT CANNOT IDENTIFY THE CALL IS REFUSED, not minted for — minting
  // would restore the behaviour this removes, in the one case nobody is watching.
  const d = mk();
  for (const ctx of [{ capabilities: d.can.forTenant(T).forAgent(AG) },
                     { capabilities: d.can.forTenant(T).forAgent(AG), operation: "" },
                     { capabilities: d.can.forTenant(T).forAgent(AG), operation: 4, newId: () => "ours" }]) {
    const none = await tool.run({ id: AG }, ctx);
    assert.equal(none.ok, false, JSON.stringify(none));
    assert.equal(none.error, "no-id");
  }
  assert.equal(d.sent.filter((x) => x.rpc.startsWith("accept_automation_run")).length, 0,
    "a refused call still started one");
});
test("⚠ WHY A RUN WAS NOT STARTED NAMES THE ANSWER THAT WAS WRONG, not merely that it failed", async () => {
  /**
   * ⚠ **THE DEFECT, REPRODUCED before this existed.** Every refusal but `disabled` came back
   * as one sentence — *"that automation could not be started"* — so a call that left out a
   * required answer, sent a list where text was wanted, or named something the automation
   * does not ask for was told only that it failed. **A failure that cannot name itself**, and
   * in the one place a second attempt would have worked: these are the model's OWN arguments.
   *
   * `accept_automation_run` answers `name` for every refusal about one answer and `wanted`
   * for the kind it expected, so the sentence is composed from the FUNCTION'S OWN fields.
   */
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "run_automation");
  const mk = (answer) => recorder((fn) => (fn === "read_automation" ? { id: "a1", agent: AG } : answer));
  const said = async (answer) => {
    const r = mk(answer);
    return tool.run({ id: AG, input: {} },
      { capabilities: r.can.forTenant(T).forAgent(AG), operation: OP(3, 0) });
  };

  for (const [answer, names, kind] of [
    [{ ok: false, error: "missing-input", name: "customer" }, /"customer"/, /has to be answered/],
    [{ ok: false, error: "unknown-input", name: "nonsense" }, /"nonsense"/, /does not ask for/],
    [{ ok: false, error: "bad-input", name: "lines", wanted: "list" }, /"lines"/, /a list of text/],
    [{ ok: false, error: "bad-input", name: "count", wanted: "number" }, /"count"/, /a number/],
    [{ ok: false, error: "bad-input", name: "topic", wanted: "text" }, /"topic"/, /as text/],
    [{ ok: false, error: "bad-input", name: "lines", wanted: "list-of-text" }, /"lines"/, /every item is text/],
  ]) {
    const out = await said(answer);
    assert.equal(out.ok, false, JSON.stringify(out));
    assert.equal(out.error, answer.error, "the code the model reads is not the database's");
    assert.match(out.say, names, `the sentence did not name the answer: ${out.say}`);
    assert.match(out.say, kind, `the sentence did not say what was wanted: ${out.say}`);
  }

  // ⚠ **A KIND THIS DEPLOYMENT HAS NEVER HEARD OF FALLS BACK RATHER THAN INVENTING ONE**, and
  // so does a refusal with no `name` — a made-up explanation is worse than none, and both
  // must still say the run did not start.
  const odd = await said({ ok: false, error: "bad-input", name: "x", wanted: "colour" });
  assert.match(odd.say, /"x" did not arrive as the kind of thing/, odd.say);
  const nameless = await said({ ok: false, error: "missing-input" });
  assert.match(nameless.say, /one of the answers/, nameless.say);

  // THE TWO NOT-NOW REFUSALS KEEP THEIR OWN WORDS, because neither is anything to fix.
  assert.match((await said({ ok: false, error: "disabled" })).say, /turned off/);
  assert.match((await said({ ok: false, error: "paused" })).say, /paused/);
  // AND A CODE NOTHING RECOGNISES IS THE GENERAL SENTENCE, never a guess.
  assert.match((await said({ ok: false, error: "who-knows" })).say, /could not be started/);

  // ⚠ THE CONTROL: a start that WORKS says so, or every line above is satisfied by a tool
  // that refuses everything.
  const fine = await said({ ok: true, id: "made" });
  assert.equal(fine.ok, true, JSON.stringify(fine));
  assert.match(fine.say, /begins within the minute/);
});
test("⚠ `search_reference` SAYS WHICH NOTHING IT FOUND — one sentence covered three facts", async () => {
  /**
   * ⚠ **MEASURED BEFORE THIS: *"nothing in the reference material matched that"* was said
   * whether the ask held nothing searchable, whether this agent has no reference material at
   * all, or whether it has some and none of it matched.** Only the last of the three is what
   * those words claim, and the three want opposite next moves from a model: ask the customer
   * about their documents, ask them to add one, or ask again differently. So three sentences —
   * four, with the one that blames nothing.
   */
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "search_reference");
  const say = async (answer) => {
    const r = recorder(() => answer);
    return await tool.run({ query: "boiler" }, { capabilities: r.can.forTenant(T).forAgent(AG) });
  };
  const matched = await say({ ok: true, searched: true, sources: 2, excerpts: [{ title: "Prices", text: "£95" }] });
  const noMatch = await say({ ok: true, searched: true, sources: 3, excerpts: [] });
  const noSources = await say({ ok: true, searched: true, sources: 0, excerpts: [] });
  const notSearched = await say({ ok: true, searched: false, sources: 3, excerpts: [] });
  const cannotSay = await say({ excerpts: [] });

  // THE SHAPE A MODEL WAS PROMISED IS UNCHANGED: `found` is the count and `passages` the list.
  assert.equal(matched.ok, true);
  assert.equal(matched.found, 1);
  assert.deepEqual(matched.passages, [{ title: "Prices", text: "£95" }]);
  assert.match(matched.say, /1 passage\(s\) matched/);

  // NOTHING FOUND IS AN ANSWER AND NOT A FAILURE — all four of them.
  for (const [what, r] of [["no-match", noMatch], ["no-sources", noSources],
                           ["not-searched", notSearched], ["unknown", cannotSay]]) {
    assert.equal(r.ok, true, `${what} was reported as a failure`);
    assert.equal(r.found, 0, `${what} reported passages`);
    assert.deepEqual(r.passages, [], `${what} answered passages`);
  }
  assert.match(noMatch.say, /nothing in the reference material matched/);
  assert.match(noSources.say, /no reference material yet/);
  assert.match(notSearched.say, /nothing searchable/);
  // ⚠ CANNOT-TELL BLAMES NOTHING. It is what an older database or an unreadable answer
  // produces, and "your documents do not mention that" is the one claim it cannot make.
  assert.doesNotMatch(cannotSay.say, /matched|no reference material|searchable/);
  // AND THE FOUR ARE FOUR: two of them reading the same way is the distinction gone, which is
  // exactly the state before this change.
  assert.equal(new Set([noMatch.say, noSources.say, notSearched.say, cannotSay.say]).size, 4,
    "two different nothings are worded the same");

  // THE TWO FACTS THE SENTENCE RESTS ON RIDE BESIDE IT, so a model can check it — and they are
  // the reading's, so a shape that says neither answers `null` rather than a guess.
  assert.equal(noMatch.searched, true);
  assert.equal(noMatch.sources, 3);
  assert.equal(cannotSay.searched, null);
  assert.equal(cannotSay.sources, null);

  /**
   * ⚠ **AND A SURFACE THAT ANSWERS SOMETHING ELSE ENTIRELY SAYS IT COULD NOT TELL, rather than
   * throwing a `TypeError` at a model.**
   *
   * ⚠ **THIS IS THE ONE BLOCK `recorder` CANNOT DRIVE, AND A SWEEP SURVIVOR IS WHAT SAID SO.**
   * `recorder` builds the REAL `makeCapabilities`, which applies `readSearch` on its way out —
   * so every shape handed to it is already folded and the tool's own reading is the identity.
   * `can` is INJECTED, so what separates the two readings is a deployment supplying its OWN
   * surface, and that is what these hand over raw. **A BARE LIST is the shape that predates the
   * object**, folded rather than dropped, so a database older than the migration keeps its
   * passages instead of answering nothing found in silence.
   */
  const raw = async (answer) => await tool.run({ query: "boiler" },
    { capabilities: { searchKnowledge: async () => answer } });
  for (const odd of [undefined, null, [], "nope", 7, { excerpts: "no" }]) {
    const r = await raw(odd);
    assert.equal(r.ok, true, `${JSON.stringify(odd)} made the tool fail instead of saying so`);
    assert.equal(r.found, 0);
    assert.deepEqual(r.passages, [], `${JSON.stringify(odd)} answered passages`);
    assert.equal(r.searched, null, `${JSON.stringify(odd)} invented a fact it does not carry`);
    assert.doesNotMatch(r.say, /matched that|no reference material/, `${JSON.stringify(odd)} blamed the documents`);
  }
  const legacy = await raw([{ title: "Prices", text: "£95" }]);
  assert.equal(legacy.found, 1, "a database older than the object shape lost its passages");
  assert.deepEqual(legacy.passages, [{ title: "Prices", text: "£95" }]);
  assert.equal(legacy.searched, null, "an old answer invented the two facts it does not carry");
  assert.match(legacy.say, /1 passage\(s\) matched/);
  // THE CONTROL, so "it folded it" is not satisfied by a tool that answers the same thing
  // whatever it is handed: a WHOLE answer through the same raw surface comes through whole.
  const whole = await raw({ ok: true, searched: true, sources: 4, excerpts: [{ title: "A" }] });
  assert.deepEqual({ found: whole.found, searched: whole.searched, sources: whole.sources },
    { found: 1, searched: true, sources: 4 });
});

test("⚠ `forget` SAYS WHETHER THERE WAS ONE — a name got wrong is not a thing removed", async () => {
  // MEASURED: a mutant hardcoding `forgot: true` SURVIVED, and the answer it produced was
  // self-contradictory — `forgot: true` beside "there was nothing remembered under that
  // name". Nothing drove a forget of a name that was not there.
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "forget");
  const nothing = recorder(() => ({ ok: true, forgot: false }));
  const gone = await tool.run({ name: "tone" }, { capabilities: nothing.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(gone.ok, true, "a name that was not there is not a failure");
  assert.equal(gone.forgot, false, "forgetting nothing was reported as having removed something");
  assert.match(gone.say, /nothing remembered under that name/);

  // THE CONTROL, without which `forgot: false` is satisfied by a tool that always says so.
  const had = recorder(() => ({ ok: true, forgot: true,
    affects: { futureRuns: true, acceptedRuns: false, runHistory: false } }));
  const out = await tool.run({ name: "tone" }, { capabilities: had.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(out.forgot, true, "a fact really removed was reported as absent");
  // RE-ANCHORED, NOT APPEASED: this demanded `say === "forgotten"` exactly, which is a
  // spelling. The property is that a real removal and a name that was not there say
  // DIFFERENT things — and since the reach shipped, the removal says what it reaches too.
  assert.match(out.say, /^forgotten — /);
  assert.notEqual(out.say, gone.say);

  // ⚠ **`deleted` IS NOT `erased`, AND THE MODEL IS TOLD SO IN THE TEXT.** A memory lives in
  // three places and a delete reaches exactly one: no LATER run sees it, an execution already
  // under way keeps the snapshot it was accepted with, and the journal keeps whatever it
  // quoted. A bare "forgotten" would tell somebody it had gone everywhere, which is false
  // about two of the three — so the sentence names all three, in the text as well as in the
  // field, because the field is gone the moment an answer is read as prose.
  assert.deepEqual(out.affects, { futureRuns: true, acceptedRuns: false, runHistory: false });
  assert.match(out.say, /later runs will not see it/);
  assert.match(out.say, /already under way keeps what it started with/);
  assert.match(out.say, /history keeps whatever it quoted/);

  // ⚠ AND THE REACH IS THE FUNCTION'S OWN ANSWER, NEVER COMPOSED HERE. An answer that does
  // not carry it is `null` — a claim about reach that this code invented would be a claim
  // nothing verified — and `Array.isArray` matters because `[]` is an object and is not a set
  // of named facts. Driven over every shape a missing or junk `affects` really arrives as.
  for (const junk of [undefined, null, "yes", 7, [], [1], true]) {
    const r = recorder(() => ({ ok: true, forgot: true, affects: junk }));
    const said = await tool.run({ name: "tone" }, { capabilities: r.can.forTenant(T).forAgent(AG), operation: OP() });
    assert.equal(said.affects, null, `${JSON.stringify(junk)} was read as a reach`);
    // AND THE SENTENCE IS STILL SAID, because it is about how forgetting works rather than
    // about this row: the fields are evidence and the words are the explanation.
    assert.match(said.say, /later runs will not see it/);
  }

  // A REPEAT SAYS THE STATE MAY HAVE MOVED SINCE. The answer is a historical fact — what the
  // call did the first time — so a bare "forgotten" would be a claim about the present.
  const twice = recorder(() => ({ ok: true, forgot: true, repeat: true,
    affects: { futureRuns: true, acceptedRuns: false, runHistory: false } }));
  const rep = await tool.run({ name: "tone" }, { capabilities: twice.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(rep.repeat, true);
  assert.match(rep.say, /may have been written again since/);
  assert.deepEqual(rep.affects, out.affects, "a repeat lost the reach the first call reported");

  /**
   * ⚠ **AND THE WORDS ARE THE FUNCTION'S OWN WHEN IT HAS THEM, which this file used to claim
   * and not check.** The sentence was a constant here while the site's route read a `note`
   * `agent.delete_memory` never set — so one delete had two accounts of what it reaches, and
   * the FIELDS were guarded as undriftable while the sentence beside them was an unchecked
   * copy. The fallback above is a compatibility fold for a database older than the answer;
   * what a database that speaks says has to win.
   */
  const spoke = recorder(() => ({ ok: true, forgot: true, note: "it stays wherever it was quoted" }));
  const fwd = await tool.run({ name: "tone" }, { capabilities: spoke.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.match(fwd.say, /it stays wherever it was quoted/,
    "the tool composed the reach instead of forwarding what the delete really said");
  assert.doesNotMatch(fwd.say, /later runs will not see it/, "the fallback won over the answer");
  // THE FALLBACK IS THE CONTROL, and it is a constant this module EXPORTS so the cross-product
  // census can compare it with the migration's own sentence rather than with a remembered one.
  assert.match(out.say, new RegExp(FORGET_REACH.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    "a database that answered no sentence left the model with none");
  // AND A BLANK OR JUNK `note` IS NOT A SENTENCE — it falls back rather than saying nothing.
  for (const junk of ["", "   ", 7, null, [], {}]) {
    const r = recorder(() => ({ ok: true, forgot: true, note: junk }));
    const said = await tool.run({ name: "tone" }, { capabilities: r.can.forTenant(T).forAgent(AG), operation: OP() });
    assert.match(said.say, /later runs will not see it/, `note ${JSON.stringify(junk)} left nothing said`);
  }
});

test("a refusal from the database is passed on as a sentence, never as a success", async () => {
  // ⚠ THE FAKE ANSWERS THE WRAPPER'S NAME, because that is what a write really asks for
  // now. Answering only `save_memory` made this case read `operation-required` — the fixture
  // one name behind the request, in the file whose subject is which request goes out.
  const { can } = recorder((fn) => (fn === "save_memory_once" ? { ok: false, error: "too-many" } : { ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "remember");
  const out = await tool.run({ name: "tone", value: "plain" }, { capabilities: ops, operation: OP() });
  assert.equal(out.ok, false);
  assert.equal(out.error, "too-many");
  assert.match(out.say, /forget something first/);
});

test("⚠ EVERY WRITE GOES THROUGH ITS OPERATION RECORD, AND A MISSING IDENTITY IS A REFUSAL", async () => {
  // **FALLING THROUGH TO THE PLAIN FUNCTION WOULD MAKE THE DEDUPLICATION SOMETHING A CALLER
  // CAN FORGET**, which is the fail-OPEN direction — and what it protects is somebody's
  // correction not being overwritten by a retry of work that already happened. So a write
  // with no identity is refused BY NAME, and one with an unreadable identity is refused for
  // its own reason: a key invented from a malformed one collides with something.
  // ⚠ THE FIXTURE ANSWERS `read_automation` AS THIS AGENT'S, because two of the six make that
  // pre-check FIRST — so with a bare `{ok: true}` they refuse `no-automation` and the case
  // reads as the identity wall being broken. Either order is safe (neither refusal writes
  // anything), and the fixture has to be the capable one to ask about the identity at all.
  // ⚠ AND `read_execution` FOR THE SAME REASON, one operation later: `cancelExecution`'s own
  // wall is that read, so a row with no `automation` refuses `no-execution` and the case reads
  // as the identity wall being broken rather than as the fixture being thin.
  // ⚠ AND `list_webhooks` FOR THE SAME REASON, one operation later: `setEventEndpoint`'s own
  // wall is that read, so an empty list refuses `no-endpoint` and the case reads as the
  // identity wall being broken rather than as the fixture being thin.
  const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG }
    : fn === "read_execution" ? { id: AUTO, automation: AUTO }
    : fn === "list_webhooks" ? [{ id: AUTO, name: "Payments", event_name: "order.paid", enabled: true }]
    : { ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  const drive = {
    saveMemory: { name: "a", value: "b" },
    deleteMemory: { name: "a" },
    createAutomation: { id: AUTO, name: "x", steps: [] },
    updateAutomation: { id: AUTO, name: "y" },
    patchAutomation: { id: AUTO, patch: { name: "y" } },
    setAutomationEnabled: { id: AUTO, enabled: false },
    startAutomation: { id: AUTO, runId: AUTO },
    cancelExecution: { execution: AUTO },
    setEventEndpoint: { endpoint: AUTO, enabled: false },
  };
  // ⚠ CENSUSED AGAINST `CAPABILITY_WRITES` BOTH WAYS, so a write added next month is not
  // silently left undriven — the silence would read exactly like coverage.
  assert.deepEqual(Object.keys(drive).sort(), [...CAPABILITY_WRITES].sort());

  for (const [name, args] of Object.entries(drive)) {
    sent.length = 0;
    const none = await ops[name]({ ...args });
    assert.equal(none.ok, false, `${name} wrote with no identity: ${JSON.stringify(none)}`);
    assert.equal(none.error, "operation-required", `${name} refused for the wrong reason`);
    assert.equal(sent.filter((r) => r.rpc.startsWith(CAPABILITY_RPC[name])).length, 0,
      `${name} reached the database with no identity`);

    sent.length = 0;
    const junk = await ops[name]({ ...args, operation: "not an identity" });
    assert.equal(junk.ok, false, `${name} accepted a malformed identity`);
    assert.equal(junk.error, "operation-unreadable",
      `${name} did not tell an absent identity from an unreadable one`);
    assert.equal(sent.filter((r) => r.rpc.startsWith(CAPABILITY_RPC[name])).length, 0,
      `${name} reached the database with a malformed identity`);

    // THE CONTROL, without which "it refuses" is satisfied by an operation that never works.
    sent.length = 0;
    const good = await ops[name]({ ...args, operation: OP() });
    assert.equal(good.ok, true, `${name} refused a real identity: ${JSON.stringify(good)}`);
    const req = sent.at(-1);
    assert.equal(req.rpc, `${CAPABILITY_RPC[name]}_once`, `${name} bypassed its operation record`);
    // AND THE THREE FIELDS THE RECORD NEEDS ARE ON THE WIRE, split the way the database
    // stores them: the position under one name and the arguments' hash under another.
    const id = splitOperation(sent.at(-1).body.p_op_key + ":" + sent.at(-1).body.p_args_hash);
    assert.ok(id, `${name} sent a key and hash that do not read back as an identity`);
    assert.equal(req.body.p_op_key.includes(":"), true, `${name}'s key carries no position`);
    assert.ok(typeof req.body.p_args_hash === "string" && req.body.p_args_hash.length > 0);
    assert.equal(req.body.p_op_run, RUN, `${name} did not pass the run its identity names`);
    // ⚠ AND THE TENANT AND THE AGENT ARE STILL THE CLOSURE'S. The record's four arguments
    // are the one place a new field could have smuggled one in.
    assert.equal(req.body.p_tenant, T);
    for (const k of Object.keys(req.body)) {
      assert.ok(!/^p_(account|owner|uid)$/.test(k), `${name} sends ${k}`);
    }
  }
});

test("⚠ A READ NEVER ASKS FOR AN OPERATION RECORD — it changes nothing to protect", async () => {
  // The other half of the census. A read routed through a wrapper would be claiming to
  // protect something that cannot be harmed by repeating, and would need an identity it has
  // no business requiring.
  const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : []));
  const ops = can.forTenant(T).forAgent(AG);
  const reads = {
    searchKnowledge: { query: "x" }, listKnowledge: {}, readKnowledge: { id: AUTO },
    listMemory: {}, listAutomations: {}, readAutomation: { id: AUTO },
    listExecutions: { automation: AUTO }, readExecution: { id: AUTO },
    // ⚠ THE SETTINGS READ IS ON THIS SIDE OF THE PARTITION, and it belongs here: it changes
    // nothing, so a wrapper would be claiming to protect something no repeat can harm.
    readAgentSettings: {},
    // The inbound endpoints an account has made. A read for the same reason: listing them
    // changes nothing, and `agent.list_webhooks` never selects the signing secret.
    listEventEndpoints: {},
    // ⚠ **THE ONE READ THAT IS ABOUT A RECORD AND STILL MUST NOT ASK FOR ONE**, which is
    // the distinction this census turns on rather than an exemption from it. It asks
    // `operation_check` — read-only, and the same function the `_once` wrapper asks inside
    // its transaction — so it can answer what a record HOLDS and has nowhere to write one.
    // Routing it through `operation_check_once` would be a record of having looked at a
    // record. It is driven with a WRITE's name because that is the only thing it answers
    // about, and the assertion below then proves it reached a plain function.
    checkOperation: { op: "patchAutomation", operation: OP() },
  };
  assert.deepEqual(Object.keys(reads).sort(),
    CAPABILITIES.filter((c) => !CAPABILITY_WRITES.includes(c)).sort());
  for (const [name, args] of Object.entries(reads)) { try { await ops[name](args); } catch { /* shape */ } }
  assert.ok(sent.length >= Object.keys(reads).length, `only ${sent.length} requests for ${Object.keys(reads).length} reads`);
  for (const r of sent) assert.ok(!r.rpc.endsWith("_once"), `${r.rpc} asked for an operation record`);
});

test("⚠ A CALL'S IDENTITY COMES FROM `ctx` AND A MODEL CANNOT SUPPLY ONE", async () => {
  // ⚠ **FOUR SWEEP MUTANTS SURVIVED HERE**, each making a write read `args.operation ??
  // ctx?.operation` — and nothing drove a tool with `operation` among its ARGUMENTS. That is
  // the whole hazard: a model writes tool arguments, so an identity it can supply is an
  // identity it can reuse, which turns two different calls into one absorbed operation and a
  // person's later correction into something a "retry" overwrites.
  //
  // It is also why no schema below offers the field — asserted, because a wall in the code
  // and a field in the schema is a control that answers and is then ignored.
  const REAL = OP();
  const FORGED = `${RUN}:99:0:forged00`;
  const writes = {
    remember: { name: "a", value: "b" },
    forget: { name: "a" },
    pause_automation: { id: AUTO, enabled: false },
    run_automation: { id: AUTO },
    make_automation: { name: "n", steps: [] },
    change_automation: { id: AUTO, name: "n", steps: [] },
  };
  for (const [name, args] of Object.entries(writes)) {
    const tool = CAPABILITY_TOOLS.find((t) => t.name === name);
    assert.ok(tool, `${name} is not a tool`);
    assert.equal(tool.writes, true, `${name} is in this census and does not write`);
    // THE SCHEMA DOES NOT OFFER IT.
    assert.equal(tool.input?.properties?.operation, undefined, `${name}'s schema offers an identity`);
    const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : { ok: true, id: AUTO }));
    const ops = can.forTenant(T).forAgent(AG);
    await tool.run({ ...args, operation: FORGED }, { capabilities: ops, operation: REAL });
    const req = sent.filter((r) => r.rpc.endsWith("_once")).at(-1);
    assert.ok(req, `${name} did not reach an operation record: ${JSON.stringify(sent.map((x) => x.rpc))}`);
    // ⚠ THE KEY IS `ctx`'S, AND THE FORGED ONE REACHED NOTHING.
    assert.equal(req.body.p_op_key, REAL.slice(0, REAL.lastIndexOf(":")),
      `${name} took its identity from an argument`);
    assert.notEqual(req.body.p_op_key, FORGED.slice(0, FORGED.lastIndexOf(":")));
    assert.notEqual(req.body.p_args_hash, "forged00", `${name} took its arguments' hash from an argument`);
  }
});

test("⚠ AN ABSORBED WRITE SAYS SO, AND ITS SENTENCE IS ABOUT THE PAST", async () => {
  // ⚠ **THREE SWEEP MUTANTS SURVIVED HERE**, each answering an absorbed call as though it had
  // just happened — because nothing drove a capability answering `repeat: true`. The answer is
  // what the call did the FIRST time, which is a historical fact and not a reading of the row
  // as it stands: somebody may have corrected it since, and a model told plainly "saved" would
  // believe the value it sent is what is remembered now.
  const absorbed = {
    remember: [{ name: "tone", value: "formal" }, { ok: true, repeat: true, saved: "created", memory: { version: 1 } }, /already saved/],
    forget: [{ name: "tone" }, { ok: true, repeat: true, forgot: true }, /written again since/],
    pause_automation: [{ id: AUTO, enabled: false }, { ok: true, repeat: true, enabled: false }, /changed since/],
    make_automation: [{ name: "n", steps: [] }, { ok: true, repeat: true, id: AUTO }, /already created/],
    change_automation: [{ id: AUTO, name: "n", steps: [] }, { ok: true, repeat: true, id: AUTO }, /already changed/],
  };
  for (const [name, [args, answer, says]] of Object.entries(absorbed)) {
    const tool = CAPABILITY_TOOLS.find((t) => t.name === name);
    const { can } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : answer));
    const out = await tool.run(args, { capabilities: can.forTenant(T).forAgent(AG), operation: OP() });
    assert.equal(out.ok, true, `${name}: ${JSON.stringify(out)}`);
    assert.equal(out.repeat, true, `${name} did not carry the repeat to the model`);
    assert.match(out.say ?? "", says, `${name} says "${out.say}"`);
    // ⚠ AND THE CONTROL: the SAME answer without the mark is NOT reported as a repeat, or
    // "it says repeat" would be satisfied by a tool that always does.
    const plain = { ...answer };
    delete plain.repeat;
    const { can: can2 } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : plain));
    const fresh = await tool.run(args, { capabilities: can2.forTenant(T).forAgent(AG), operation: OP() });
    assert.equal(fresh.ok, true, `${name} control: ${JSON.stringify(fresh)}`);
    assert.notEqual(fresh.repeat, true, `${name} reports every call as a repeat`);
    assert.ok(!says.test(fresh.say ?? ""), `${name} says the repeat sentence on a first call: "${fresh.say}"`);
  }
});

// ── the authoring four, at the module ────────────────────────────────────────
//
// ⚠ **SIX SWEEP MUTANTS SURVIVED OVER THESE TOOLS, AND THE REASON IS RECORDED RATHER THAN
// THE FIXES ALONE.** Every property below is proved end to end by `npm run verify:tools`,
// which `npm run sweep` does not run — *a property proven only by an instrument the sweep
// cannot run is a property no mutant can be caught by*, which this directory has now
// recorded four times. What closes it is a case in this file, where a mutant can be seen.

const stepsOf = (tool, args, answer) => {
  const { can, sent } = recorder(answer);
  return tool.run(args, { capabilities: can.forTenant(T).forAgent(AG), operation: OP() })
    .then((out) => ({ out, sent }));
};

test("⚠ WHAT REACHES THE DATABASE IS THE READER'S OWN STEPS, NEVER THE MODEL'S LIST", async () => {
  // Passing the raw list on would put an unvalidated step into the row with a validation
  // having happened BESIDE it, which is the shape of every "it was checked" defect here.
  const raw = [{ type: "note", text: "one" }, { type: "note", text: "two" }];
  const make = CAPABILITY_TOOLS.find((t) => t.name === "make_automation");
  const { out, sent } = await stepsOf(make, { name: "n", steps: raw }, () => ({ ok: true, id: AUTO }));
  assert.equal(out.ok, true, JSON.stringify(out));
  // ⚠ THE RPC IS `create_automation_once` — every write goes through its operation record
  // (M7), so a needle pinned to the bare name finds nothing and reads as "nothing was
  // written". Matched at the start, so the wrapper and the plain function both count.
  const wrote = sent.find((x) => /^create_automation/.test(x.rpc));
  assert.ok(wrote, `nothing was created: ${JSON.stringify(sent.map((x) => x.rpc))}`);
  // ⚠ DERIVED FROM THE REAL PRODUCER, never transcribed: the id counter is 1-based and an
  // expectation copied from a guess about a producer is a guess. (It was `s0` on the first
  // draft of the demonstration, and measured `s1`.)
  assert.deepEqual(wrote.body.p_steps, readWorkflow(raw).steps);
  // …and the ids really are the reader's, so the assertion above is not vacuous over a
  // list that happens to equal what was sent.
  assert.deepEqual(wrote.body.p_steps.map((x) => x.id), readWorkflow(raw).steps.map((x) => x.id));
  assert.notDeepEqual(wrote.body.p_steps, raw, "the model's own list went to the database");
});

test("⚠ A WORKFLOW THAT DOES NOT READ IS NOT SAVED — refused whole, with nothing written", async () => {
  const bad = {
    // A reference nothing produces, by name AND by position.
    "a reference nothing produces": [{ type: "note", text: "hello {{nowhere}}" }],
    // A branch that does not balance — refused while it is still somebody's form.
    "a branch with no end": [{ type: "if", left: "a", op: "is", right: "a" }, { type: "note", text: "x" }],
    // A type this deployment has never had.
    "an invented action": [{ type: "teleport" }],
  };
  for (const [why, steps] of Object.entries(bad)) {
    for (const name of ["make_automation", "change_automation"]) {
      const tool = CAPABILITY_TOOLS.find((t) => t.name === name);
      const { out, sent } = await stepsOf(tool, { id: AUTO, name: "n", steps },
        (fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : { ok: true, id: AUTO }));
      assert.equal(out.ok, false, `${name} accepted ${why}: ${JSON.stringify(out)}`);
      assert.equal(out.error, "bad-workflow", `${name} on ${why}: ${JSON.stringify(out)}`);
      // THE READER'S OWN SENTENCE, not one of ours — so a customer is told what a save
      // would have told them.
      assert.ok(typeof out.say === "string" && out.say.length > 0, `${name} said nothing about ${why}`);
      // NOTHING WAS WRITTEN. The negative assertion, with its observer alive below.
      assert.deepEqual(sent.filter((x) => /^(create|update)_automation/.test(x.rpc)), [],
        `${name} wrote something for ${why}`);
    }
  }
  // ⚠ THE CONTROL, without which "nothing was written" is satisfied by a tool that never
  // writes at all.
  const ok = await stepsOf(CAPABILITY_TOOLS.find((t) => t.name === "make_automation"),
    { name: "n", steps: [{ type: "note", text: "fine" }] }, () => ({ ok: true, id: AUTO }));
  assert.equal(ok.out.ok, true, JSON.stringify(ok.out));
  assert.ok(ok.sent.some((x) => /^create_automation/.test(x.rpc)), "the control wrote nothing either");
});

test("⚠ A SIBLING AGENT'S AUTOMATION IS NOT THIS AGENT'S TO REWRITE", async () => {
  // The account filter is the database's. THIS is the wall no tenant filter can see: both
  // agents share an owner, and a person is entitled to their whole account where an agent
  // is entitled to its own.
  const change = CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
  const { out, sent } = await stepsOf(change, { id: AUTO, name: "n", steps: [{ type: "note", text: "x" }] },
    (fn) => (fn === "read_automation" ? { id: AUTO, agent: OTHER } : { ok: true, id: AUTO }));
  assert.equal(out.ok, false, JSON.stringify(out));
  assert.equal(out.error, "no-automation");
  /**
   * ⚠ **RE-ANCHORED, NOT APPEASED.** This forbade `update_automation` by NAME, and an editing
   * tool goes through `patch_automation` now — so it went green about a spelling that had
   * moved rather than about a sibling's row being safe. The property is that NO WRITE reached
   * the database, asked of every `_once` call, which is what a write is on this surface.
   */
  assert.deepEqual(sent.filter((x) => x.rpc.endsWith("_once")), [], "a sibling's automation was written to");
  // AND THE CONTROL: the same call for THIS agent's own row goes through, so the refusal is
  // about whose it is rather than about the call.
  const mine = await stepsOf(change, { id: AUTO, name: "n", steps: [{ type: "note", text: "x" }] },
    (fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : { ok: true, id: AUTO }));
  assert.equal(mine.out.ok, true, JSON.stringify(mine.out));
  assert.ok(mine.sent.some((x) => x.rpc === "patch_automation_once"),
    `the control wrote ${JSON.stringify(mine.sent.map((x) => x.rpc))}`);
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE THREE DEFECTS THE AUTHORING TOOLS SHIPPED WITH, each reproduced first.
 *
 * All three were found by review and measured through the real tools against a real
 * PostgreSQL before a line was changed. `scripts/verify-tools.mjs` proves each of them end
 * to end; what is HERE is the half a deliberate breakage can be seen by, because `npm run
 * sweep` does not run that script — *a property proven only by an instrument the sweep
 * cannot run is a property no mutant can be caught by.*
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠ THE AUDIT: EVERY CAPABILITY, CLASSIFIED — and it is a DRIVEN CENSUS rather than prose.
 *
 * The requirement is to audit each implemented capability from its tool schema through
 * validation, backend operation, execution and returned result, and to report each as
 * **reachable**, **intentionally restricted** or **unfinished**. A paragraph saying so is a
 * claim that rots; this is the same statement as code, so a capability added, widened or
 * narrowed without its classification moving is a red run.
 *
 * `REACH` is the report. Every name in it must be a real thing, every real thing must be in
 * it, and each classification is asked of the surface rather than trusted.
 * ════════════════════════════════════════════════════════════════════════════
 */
const REACH = Object.freeze({
  // ── REACHABLE: a tool schema, a validator, a backend operation and a result ──
  reachable: Object.freeze({
    searchKnowledge: "search_reference", listKnowledge: "list_reference", readKnowledge: "read_reference",
    listMemory: "list_memory", saveMemory: "remember", deleteMemory: "forget",
    listAutomations: "list_automations", readAutomation: "read_automation",
    createAutomation: "make_automation", patchAutomation: "change_automation",
    setAutomationEnabled: "pause_automation", startAutomation: "run_automation",
    listExecutions: "list_executions", readExecution: "read_execution",
    cancelExecution: "cancel_execution",
    listEventEndpoints: "list_event_endpoints", setEventEndpoint: "set_event_endpoint",
  }),
  /**
   * ── INTENTIONALLY RESTRICTED: implemented, and deliberately not an agent's ──
   *
   * Each carries the reason, because "restricted" without one is indistinguishable from
   * "forgotten" — which is the whole distinction this report exists to make.
   */
  restricted: Object.freeze({
    updateAutomation:
      "the screen's WHOLE REPLACE. A form shows every field and sends every field; a tool names "
      + "the one thing it was asked to change, which is `patchAutomation`. A tool on this would "
      + "be the reset defect back under another name.",
    readAgentSettings:
      "read by the authoring path and offered to no model. It exists so a schedule can resolve "
      + "its zone; a tool for it would widen the surface for nothing a model needs to ask.",
    checkOperation:
      "the platform's own retry protection, asked by the authoring tools before they decide a "
      + "fresh write is needed. A tool for it would let a model ask whether its own earlier "
      + "call landed and then act on the answer — and what to do about a lost answer is the "
      + "platform's to settle, in one place, rather than a decision a model gets to make.",
  }),
});

test("⚠ THE AUDIT IS COMPLETE AND EVERY CLASSIFICATION IS ASKED OF THE SURFACE", () => {
  const classified = { ...REACH.reachable, ...REACH.restricted };
  // ⚠ TOTAL AND DISJOINT OVER `CAPABILITIES`, both ways. A capability in neither class is
  // unaudited, and a name in the report that is not a capability is a report about nothing.
  assert.deepEqual(Object.keys(classified).sort(), [...CAPABILITIES].sort(),
    "a capability is unclassified, or the report names one that does not exist");
  assert.equal(Object.keys(REACH.reachable).some((k) => Object.hasOwn(REACH.restricted, k)), false,
    "a capability is in both classes");

  const byName = new Map(CAPABILITY_TOOLS.map((t) => [t.name, t]));
  for (const [op, toolName] of Object.entries(REACH.reachable)) {
    // ⚠ **THE FOUR HOPS THE REQUIREMENT NAMES, asked one at a time.** A tool that exists, a
    // schema a model can fill, a backend operation it really reaches (driven above, in the
    // `writes` census) and an answer that is not composed. The hop this catches is the one
    // this repository keeps paying for: a name on a list with nothing behind it.
    const t = byName.get(toolName);
    assert.ok(t, `${op} is called reachable through ${toolName}, which is not a tool`);
    assert.equal(typeof t.input, "object", `${toolName} has no input schema`);
    assert.equal(t.input.type, "object", `${toolName}'s schema is not an object`);
    assert.equal(typeof t.run, "function", `${toolName} cannot run`);
    assert.ok(CAPABILITY_RPC[op], `${op} names no database function`);
  }
  for (const op of Object.keys(REACH.restricted)) {
    // ⚠ **RESTRICTED MEANS NO TOOL REACHES IT, and that is asked of what the tools really
    // CALL rather than of their names.** A name-based check would pass a tool called something
    // else that calls it — which is precisely how a restriction stops being one.
    assert.equal(Object.values(REACH.reachable).includes(op), false);
    assert.ok(REACH.restricted[op].length > 40, `${op} is restricted with no reason given`);
  }
  // ⚠ AND THE REPORT HAS NO `unfinished` CLASS TODAY, which is a statement rather than an
  // omission: every implemented capability is now either reachable or restricted on purpose.
  // A capability whose tool did not work would have to go here, and the census above would
  // force it: it cannot be `reachable` without a tool and it cannot be `restricted` without a
  // reason. `unfinished` is named in this assertion so the word exists in the report.
  assert.equal(Object.hasOwn(REACH, "unfinished"), false,
    "there is unfinished work in the report — say what it is here and in the notes");
});

test("⚠ EVERY STEP THE ENGINE CAN RUN IS ONE AN AGENT CAN AUTHOR — loops and all", () => {
  /**
   * **THE GAP THIS CLOSES BY ASKING**: the requirement names typed inputs, loops,
   * subworkflows and event waits as capabilities an agent might not be able to use. All four
   * are STEPS, and a step is reachable when `list_actions` offers it and `readWorkflow`
   * accepts it — so this drives both rather than reading the catalog.
   */
  const list = CAPABILITY_TOOLS.find((t) => t.name === "list_actions");
  const offered = new Set();
  return list.run({}, {}).then(async (out) => {
    for (const a of out.actions) offered.add(a.type);
    for (const d of AUTOMATION_STEPS) {
      assert.ok(offered.has(d.type), `${d.type} exists and is not offered to a model`);
    }
    // ⚠ **AND EACH OF THE FOUR THE REQUIREMENT NAMES IS REALLY VALIDATED, through
    // `check_workflow` — the tool, not the module.** A step offered and refused by the save is
    // a dead control that answers, which is the shape of every gap this round is about.
    const check = CAPABILITY_TOOLS.find((t) => t.name === "check_workflow");
    const shapes = {
      "an event wait": { steps: [{ type: "event", name: "order.paid", out: "paid" }] },
      // ⚠ A `times` LOOP BINDS NOTHING, and the first draft of this case gave it `as: "n"` and
      // then read `{{n}}` — refused, correctly, because `as` is an `each`-only field. *A
      // fixture that fails for a reason other than the one under test reads exactly like the
      // feature being broken*, and here it would have reported loops as unreachable.
      "a bounded loop": { steps: [
        { type: "repeat", mode: "times", times: 3 },
        { type: "note", text: "again" },
        { type: "endrepeat" }] },
      "a loop over a typed input": {
        inputs: [{ name: "lines", type: "list" }],
        steps: [
          { type: "repeat", mode: "each", each: "{{lines}}", as: "line" },
          { type: "note", text: "{{line}}" },
          { type: "endrepeat" }] },
      "a branch": { steps: [
        { type: "note", text: "hello", out: "greeting" },
        { type: "if", left: "{{greeting}}", op: "is", right: "hello" },
        { type: "note", text: "matched" },
        { type: "otherwise" },
        { type: "note", text: "did not" },
        { type: "end" }] },
      // ⚠ `"stop"` IS NOT ONE OF THE TIMEOUT VERDICTS — the reader said so, by name, which is
      // the refusal doing its job on my own fixture.
      "an approval wait": { steps: [{ type: "approval", ask: "send it?", hours: 24, on_timeout: "reject" }] },
    };
    for (const [what, args] of Object.entries(shapes)) {
      const out2 = await check.run(args, {});
      assert.equal(out2.ok, true, `${what} is offered and cannot be checked: ${JSON.stringify(out2)}`);
    }
    // A SUBWORKFLOW IS THE ONE STEP `check_workflow` CANNOT SETTLE ALONE, and saying so is the
    // honest answer rather than dropping it: `runs` names another automation, and whether it is
    // this agent's is `agent.automation_calls`' question inside the save's own transaction.
    // What IS asked here is that the step is offered and takes the field it needs.
    const sub = AUTOMATION_STEPS.find((d) => d.type === "workflow");
    assert.ok(sub, "the subworkflow step is gone");
    assert.ok(offered.has("workflow"));
    assert.deepEqual(sub.fields.map((f) => f.name), ["runs"]);
  });
});

test("⚠ A DAILY SCHEDULE RESOLVES ITS ZONE FROM THE ACCOUNT, and asks where there is none", async () => {
  /**
   * **REPRODUCED**: `make_automation` offered `schedule: "daily"` and sent NO zone, so
   * `agent.automation_next_at` raised — *a daily schedule needs a local time and a zone* —
   * PostgREST answered HTTP 400 and the tool THREW. Zero rows written, the model handed a
   * PL/pgSQL context line, and every daily automation authored through a tool failing the
   * same way.
   */
  const make = CAPABILITY_TOOLS.find((t) => t.name === "make_automation");
  const daily = { name: "Nightly", steps: [{ type: "note", text: "hi" }], schedule: "daily", atLocal: "09:00" };

  // ── with a zone set on the account, it goes through and the zone is on the wire ──
  const withZone = recorder((fn) => (fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" }
    : { ok: true, id: AUTO }));
  const ok1 = await make.run(daily, { capabilities: withZone.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(ok1.ok, true, JSON.stringify(ok1));
  const created = withZone.sent.find((r) => r.rpc === "create_automation_once");
  assert.equal(created.body.p_zone, "Europe/London", "the resolved zone never reached the store");
  assert.equal(created.body.p_at_local, "09:00");
  assert.equal(ok1.zone, "Europe/London", "the answer does not say which zone it used");

  // ── with none, it REFUSES and writes nothing ──
  //
  // ⚠ AND THE REFUSAL IS THE POINT. `UTC` would be a guess wearing a standard's clothes —
  // right for almost nobody and wrong invisibly — so the tool asks, and the sentence says
  // where to set it. Every unreadable answer means the same thing: nobody has said.
  for (const settings of [{ ok: true, zone: null }, { ok: true }, { ok: false, error: "no-agent" },
                          { ok: true, zone: "" }, { ok: true, zone: "   " }, { ok: true, zone: 7 }, null]) {
    const w = recorder((fn) => (fn === "read_agent_settings" ? settings : { ok: true, id: AUTO }));
    const out = await make.run(daily, { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
    const said = JSON.stringify(settings);
    assert.equal(out.ok, false, `${said} was accepted`);
    assert.equal(out.error, "no-zone", `${said} refused for the wrong reason: ${JSON.stringify(out)}`);
    assert.match(out.say, /time zone/i, said);
    assert.match(out.say, /settings/i, `${said}: the refusal does not say where to set one`);
    assert.match(out.say, /[Nn]othing has been saved/, said);
    assert.deepEqual(w.sent.filter((r) => r.rpc.endsWith("_once")), [], `${said} wrote something`);
  }

  // ── AND A MANUAL ONE NEVER ASKS, because it has no time to be local to ──
  //
  // THE CONTROL WITHOUT WHICH "it refuses" is satisfied by a tool that refuses every
  // schedule: an unscheduled automation must not be blocked on a setting it cannot use.
  const bare = recorder(() => ({ ok: true, id: AUTO }));
  const ok2 = await make.run({ name: "By hand", steps: [{ type: "note", text: "hi" }] },
    { capabilities: bare.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(ok2.ok, true, JSON.stringify(ok2));
  assert.deepEqual(bare.sent.filter((r) => r.rpc === "read_agent_settings"), [],
    "an unscheduled automation asked for a zone it has no use for");
  assert.equal(ok2.zone, undefined, "an unscheduled automation claims a zone");

  // ⚠ AND NO TOOL SCHEMA OFFERS A ZONE AT ALL, which is what makes "a model does not choose
  // it" a property of the surface rather than a rule somebody keeps.
  for (const t of CAPABILITY_TOOLS) {
    assert.equal(Object.hasOwn(t.input?.properties ?? {}, "zone"), false,
      `${t.name} lets a model name a time zone`);
  }
});

test("⚠ AN EDIT CHANGES ONLY WHAT IT NAMES — the whole-replace defect, at the tool", async () => {
  /**
   * **REPRODUCED** through the real tool against a real PostgreSQL. One `change_automation`
   * asking for a new name moved a stored automation from
   *
   *     enabled=false | daily | 23:00 | Europe/London | 1 input  | v1
   *  to enabled=true  | manual| -     | -             | 0 inputs | v2
   *
   * — reactivating a disabled automation, erasing its schedule and zone and deleting its
   * input declarations. And it made the APPROVAL misleading, which is the worse half: a
   * person approved `{id, name}` and what happened was a reset.
   */
  const change = CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
  /**
   * ⚠ **`atLocal` IS `"23:00:00"` HERE BECAUSE THAT IS WHAT THE ROW ANSWERS, and the `"23:00"`
   * that stood here hid a real defect.** A stored `time` comes back from PostgREST with
   * seconds; the tool SENDS `"HH:MM"`. With the shorter form in this fixture every case passed,
   * and driving the real tool against a real PostgreSQL refused `bad-time` when an edit named
   * only the DAYS — about a time the row really holds. *A fixture less capable than the thing
   * it stands in for hides a defect exactly as well as one that is more.*
   */
  const STORED = { id: AUTO, agent: AG, name: "Payroll", enabled: false, schedule: "daily",
    atLocal: "23:00:00", zone: "Europe/London", version: 3,
    steps: [{ id: "s1", type: "note", text: "hello {{customer}}", out: null }],
    inputs: [{ name: "customer", label: "customer", required: false, default: "", type: "text" }] };
  const drive = async (args, settings = { ok: true, zone: "Europe/London" }) => {
    const w = recorder((fn) => (fn === "read_automation" ? STORED
      : fn === "read_agent_settings" ? settings : { ok: true, id: AUTO, version: 3 }));
    const out = await change.run(args, { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
    const req = w.sent.find((r) => r.rpc === "patch_automation_once");
    return { out, req, patch: req ? req.body.p_patch : null, sent: w.sent };
  };

  // ── a rename carries the name and NOTHING else ──
  const renamed = await drive({ id: AUTO, name: "Payroll (renamed)" });
  assert.equal(renamed.out.ok, true, JSON.stringify(renamed.out));
  assert.deepEqual(Object.keys(renamed.patch), ["name"], JSON.stringify(renamed.patch));
  assert.deepEqual(renamed.out.changed, ["name"], "the answer does not say what changed");
  // ⚠ THE PATCH GOES THROUGH THE PATCH FUNCTION, not the whole replace — a tool reaching
  // `update_automation` is the defect back whatever this object holds.
  assert.deepEqual(renamed.sent.filter((r) => /update_automation/.test(r.rpc)), [],
    "an edit reached the whole-replace function");

  // ── turning one OFF is a real edit, and `false` is not silence ──
  const off = await drive({ id: AUTO, enabled: false });
  assert.deepEqual(Object.keys(off.patch), ["enabled"]);
  assert.equal(off.patch.enabled, false, "a falsy value was dropped as though absent");

  // ── clearing a schedule is explicit, and the time goes with it ──
  const manual = await drive({ id: AUTO, schedule: "manual" });
  assert.deepEqual(Object.keys(manual.patch).sort(), ["atLocal", "schedule"]);
  assert.equal(manual.patch.atLocal, null, "a move to manual kept a time the column refuses");
  assert.equal(Object.hasOwn(manual.patch, "zone"), false,
    "a move to manual cleared a zone nothing asked about");

  // ── a time with no schedule named changes the stored schedule's time ──
  const moved = await drive({ id: AUTO, atLocal: "07:30" });
  assert.equal(moved.patch.atLocal, "07:30");
  assert.equal(Object.hasOwn(moved.patch, "schedule"), false, "a time change rewrote the schedule");
  /**
   * ⚠ **THE ZONE IS PRESERVED, WHICH MEANS IT IS NOT ON THE PATCH AT ALL.**
   *
   * **RE-ANCHORED, NOT APPEASED, and the product moved with it.** This demanded
   * `patch.zone === "Europe/London"` — re-sending a value that had not changed, which the
   * patch's own contract says a key must not do: a carried field makes "I moved the time"
   * arrive as an edit of the zone too, and the approval a person gave was for less.
   *
   * ⚠ AND THE STRONGER HALF: an edit now keeps the automation's OWN zone rather than reading
   * the account's, which is the requirement's own wording — *preserve the existing timezone
   * during unrelated edits*. Re-zoning a live automation because somebody later changed the
   * account setting would move the absolute time it fires at, silently. Driven below with the
   * two deliberately different.
   */
  assert.equal(Object.hasOwn(moved.patch, "zone"), false,
    "a timed change re-sent a zone that had not moved");
  const tokyo = await drive({ id: AUTO, atLocal: "07:30" }, { ok: true, zone: "Asia/Tokyo" });
  assert.equal(Object.hasOwn(tokyo.patch, "zone"), false,
    "an edit re-zoned a live automation from the account setting");
  // ⚠ ...AND THE CONTROL: an automation with NO zone of its own does take the account's, or
  // the preservation above is satisfied by a tool that never sets one.
  const w = recorder((fn) => (fn === "read_automation" ? { ...STORED, zone: null, schedule: "manual", atLocal: null }
    : fn === "read_agent_settings" ? { ok: true, zone: "Asia/Tokyo" } : { ok: true, id: AUTO, version: 3 }));
  const fresh = await change.run({ id: AUTO, schedule: "daily", atLocal: "06:00" },
    { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(fresh.ok, true, JSON.stringify(fresh));
  assert.equal(w.sent.find((r) => r.rpc === "patch_automation_once").body.p_patch.zone, "Asia/Tokyo",
    "an automation with no zone did not take the account's");

  // ── a call naming nothing is a REFUSAL, not an `ok` about nothing ──
  const nothing = await drive({ id: AUTO });
  assert.equal(nothing.out.ok, false, JSON.stringify(nothing.out));
  assert.equal(nothing.out.error, "nothing-asked");
  assert.equal(nothing.req, undefined, "a call naming nothing wrote to the database");

  // ── ONLY THE ID IS REQUIRED, which is what lets a rename be a rename ──
  assert.deepEqual(change.input.required, ["id"],
    "an edit still demands a field it is not about, so a rename must guess a workflow");
});

test("⚠ WEEKLY, ONE-OFF AND EVENT TRIGGERS ARE AUTHORABLE, with every field they need", async () => {
  /**
   * **THE GAP**: `weekly` and `once` existed in the engine, in the column and on the person's
   * own form, and `AUTHORABLE_SCHEDULES` was `["manual","daily"]` because the tool had no day
   * list and no date — so an agent could not ask for either. An event trigger had no field at
   * all. Each is now a field, and each is refused BY NAME rather than reaching the column's own
   * check, which raises.
   */
  const make = CAPABILITY_TOOLS.find((t) => t.name === "make_automation");
  const zoned = () => recorder((fn) => (fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" }
    : { ok: true, id: AUTO }));
  const steps = [{ type: "note", text: "hi" }];
  const sent = (w) => w.sent.find((r) => r.rpc === "create_automation_once").body;

  const wk = zoned();
  const weekly = await make.run({ name: "W", steps, schedule: "weekly", atLocal: "09:00", days: ["thu", "mon", "mon"] },
    { capabilities: wk.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(weekly.ok, true, JSON.stringify(weekly));
  assert.equal(sent(wk).p_schedule, "weekly");
  // ⚠ THE WEEK'S ORDER AND NO DUPLICATES, so two saves of one selection are byte-identical.
  assert.deepEqual(sent(wk).p_days, ["mon", "thu"]);
  assert.equal(sent(wk).p_zone, "Europe/London", "a weekly schedule went out with no zone");

  const on = zoned();
  const once = await make.run({ name: "O", steps, schedule: "once", atLocal: "07:15", onDate: "2027-03-01" },
    { capabilities: on.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(once.ok, true, JSON.stringify(once));
  assert.equal(sent(on).p_on_date, "2027-03-01");
  assert.deepEqual(sent(on).p_days, [], "a one-off went out with days");

  // ⚠ **AN EVENT IS NOT A SCHEDULE — it rides on a MANUAL automation and asks for no zone.**
  // "I can run this myself, and it runs itself when something happens" is the ordinary shape.
  const ev = recorder(() => ({ ok: true, id: AUTO }));
  const listener = await make.run({ name: "L", steps, onEvent: "Order.Paid" },
    { capabilities: ev.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(listener.ok, true, JSON.stringify(listener));
  const evBody = ev.sent.find((r) => r.rpc === "create_automation_once").body;
  assert.equal(evBody.p_schedule, "manual");
  // FOLDED, so `Order.Paid` and `order.paid` are one event — the same fold the trigger reads by.
  assert.equal(evBody.p_on_event, "order.paid");
  assert.deepEqual(ev.sent.filter((r) => r.rpc === "read_agent_settings"), [],
    "an event-only automation asked for a time zone it has no use for");

  // ── REFUSED BY NAME, AND NOTHING WRITTEN ──
  for (const [want, args] of [
    ["bad-days", { schedule: "weekly", atLocal: "09:00" }],
    ["bad-days", { schedule: "weekly", atLocal: "09:00", days: [] }],
    ["bad-days", { schedule: "weekly", atLocal: "09:00", days: ["Monday"] }],
    ["bad-days", { schedule: "weekly", atLocal: "09:00", days: "mon" }],
    ["bad-days", { schedule: "weekly", atLocal: "09:00", days: [1] }],
    ["bad-date", { schedule: "once", atLocal: "09:00" }],
    ["bad-date", { schedule: "once", atLocal: "09:00", onDate: "2026-02-30" }],
    ["bad-date", { schedule: "once", atLocal: "09:00", onDate: "2026-13-01" }],
    ["bad-date", { schedule: "once", atLocal: "09:00", onDate: "soon" }],
    ["bad-time", { schedule: "weekly", days: ["mon"] }],
    ["bad-time", { schedule: "once", atLocal: "9am", onDate: "2027-01-01" }],
    ["bad-event", { onEvent: "order paid" }],
    ["bad-event", { onEvent: "Order/Paid" }],
    ["bad-event", { onEvent: 7 }],
    ["bad-event", { onEvent: "x".repeat(200) }],
  ]) {
    const w = zoned();
    const out = await make.run({ name: "R", steps, ...args },
      { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
    const said = JSON.stringify(args);
    assert.equal(out.ok, false, `${said} was accepted`);
    assert.equal(out.error, want, `${said} refused ${out.error}: ${out.say}`);
    assert.deepEqual(w.sent.filter((r) => r.rpc.endsWith("_once")), [], `${said} wrote something`);
  }

  /**
   * ⚠ **AND AN EDIT NAMING ONE TRIGGER FIELD READS THE REST FROM THE ROW — which is where the
   * real bug was.** `days` alone on a weekly automation was refused `bad-time`, because the row
   * answers `"09:00:00"` and the reader only took `"HH:MM"`. Driven against a real PostgreSQL;
   * the fixture here answers the row's own shape so it can be seen at the module too.
   */
  const change = CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
  const held = { id: AUTO, agent: AG, name: "W", enabled: true, schedule: "weekly",
    atLocal: "09:00:00", zone: "Europe/London", days: ["mon", "thu"], onDate: null, onEvent: null,
    version: 1, steps: [], inputs: [] };
  const w2 = recorder((fn) => (fn === "read_automation" ? held
    : fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" } : { ok: true, id: AUTO, version: 1 }));
  const moved = await change.run({ id: AUTO, days: ["sat", "sun"] },
    { capabilities: w2.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(moved.ok, true, `moving only the days was refused: ${JSON.stringify(moved)}`);
  const patch = w2.sent.find((r) => r.rpc === "patch_automation_once").body.p_patch;
  // ⚠ ONLY THE DAYS, and in the week's order. The unchanged time must NOT be on the patch, or
  // "I moved the days" arrives as an edit of the time too.
  assert.deepEqual(Object.keys(patch), ["days"], JSON.stringify(patch));
  assert.deepEqual(patch.days, ["sun", "sat"]);
  assert.deepEqual(moved.changed, ["days"]);
});

test("⚠ THE VERSION FENCE REACHES THE STORE, and a stale edit is refused by name", async () => {
  const change = CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
  const stored = (extra = {}) => recorder((fn) => (fn === "read_automation"
    ? { id: AUTO, agent: AG, name: "P", steps: [], inputs: [], version: 3 }
    : fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" }
    : { ok: true, id: AUTO, version: 3, ...extra }));

  // ⚠ **A PARAMETER NOBODY CAN SUPPLY IS A WALL NOBODY IS GUARDING**, so the fence is
  // asserted ON THE WIRE. A tool that read `ifVersion` and dropped it would look identical.
  const w = stored();
  await change.run({ id: AUTO, name: "P", ifVersion: 3 },
    { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(w.sent.find((r) => r.rpc === "patch_automation_once").body.p_expect_version, 3);

  // ── absent means no fence, and `null` is what that is on the wire ──
  const w2 = stored();
  await change.run({ id: AUTO, name: "P" }, { capabilities: w2.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(w2.sent.find((r) => r.rpc === "patch_automation_once").body.p_expect_version, null);

  // ⚠ REFUSED RATHER THAN COERCED. `Number(null)` is `0`, and `0` is a version no automation
  // has — so a coerced fence would answer `stale` for every guarded edit.
  for (const junk of ["3", 3.5, null, true, [3], {}, NaN]) {
    const w3 = stored();
    await change.run({ id: AUTO, name: "P", ifVersion: junk },
      { capabilities: w3.can.forTenant(T).forAgent(AG), operation: OP() });
    assert.equal(w3.sent.find((r) => r.rpc === "patch_automation_once").body.p_expect_version, null,
      `${JSON.stringify(junk)} became a fence`);
  }

  // ── and a `stale` answer says so, with the version it really has ──
  const w4 = stored({ ok: false, error: "stale", version: 7 });
  const out = await change.run({ id: AUTO, name: "P", ifVersion: 3 },
    { capabilities: w4.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(out.ok, false);
  assert.equal(out.error, "stale");
  assert.equal(out.version, 7, "the answer does not say which version it really has");
  assert.match(out.say, /version 7/, out.say);
  assert.match(out.say, /nothing was changed/i, out.say);
});

test("⚠ WHAT AN AUTOMATION ASKS FOR REACHES THE READER THAT VALIDATES IT", async () => {
  /**
   * **REPRODUCED**: `readWorkflow(raw, { inputs })` has taken declarations since inputs were
   * built, `checkSteps` passed none, and no tool schema had an `inputs` property at all — so
   * `hello {{customer}}` was refused *"nothing here produces a value called customer"* by
   * `check_workflow` and by both authoring tools, while the same steps with the same
   * declarations were accepted by the reader itself. Measured side by side.
   */
  const steps = [{ type: "note", text: "hello {{customer}}" }];
  const inputs = [{ name: "customer", type: "text" }];

  // ── the reader's own two answers, so the claim is about the hop and not the rule ──
  assert.match(readWorkflow(steps).error ?? "", /customer/,
    "the reader accepts an undeclared reference, so this proves nothing");
  assert.equal(readWorkflow(steps, { inputs }).error, undefined);

  // ── all three tools carry the declarations ──
  for (const name of ["check_workflow", "make_automation", "change_automation"]) {
    const t = CAPABILITY_TOOLS.find((x) => x.name === name);
    assert.ok(Object.hasOwn(t.input.properties, "inputs"), `${name} cannot be told what it asks for`);
  }
  const check = CAPABILITY_TOOLS.find((t) => t.name === "check_workflow");
  assert.equal((await check.run({ steps }, {})).ok, false, "the check accepted an undeclared reference");
  const checked = await check.run({ steps, inputs }, {});
  assert.equal(checked.ok, true, JSON.stringify(checked));
  assert.deepEqual(checked.inputs, ["customer"], "the check does not say what it was told about");

  // ── and a create stores them, in the shape the column holds ──
  const w = recorder(() => ({ ok: true, id: AUTO }));
  const made = await CAPABILITY_TOOLS.find((t) => t.name === "make_automation")
    .run({ name: "n", steps, inputs }, { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(made.ok, true, JSON.stringify(made));
  assert.deepEqual(w.sent.find((r) => r.rpc === "create_automation_once").body.p_inputs,
    [{ name: "customer", label: "customer", required: false, default: "", type: "text" }]);
  assert.deepEqual(made.inputs, ["customer"]);

  /**
   * ⚠ **AN EDIT VALIDATES AGAINST WHATEVER THE AUTOMATION WILL REALLY HAVE, and both
   * directions are driven because each is wrong on its own.** New steps against no
   * declarations refuses `{{customer}}` on an automation that has always had it; new
   * declarations against no steps lets a renamed input orphan every reference to it.
   */
  const change = CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
  const held = { id: AUTO, agent: AG, name: "P", enabled: true, schedule: "manual",
    atLocal: null, zone: null, version: 1,
    steps: [{ id: "s1", type: "note", text: "hello {{customer}}", out: null }],
    inputs: [{ name: "customer", label: "customer", required: false, default: "", type: "text" }] };
  const w2 = recorder((fn) => (fn === "read_automation" ? held : { ok: true, id: AUTO, version: 1 }));
  const newSteps = await change.run({ id: AUTO, steps: [{ type: "note", text: "dear {{customer}}" }] },
    { capabilities: w2.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(newSteps.ok, true,
    `new steps were checked against no declarations: ${JSON.stringify(newSteps)}`);

  // AND RENAMING THE INPUT AWAY FROM UNDER THE STORED STEPS IS REFUSED.
  const w3 = recorder((fn) => (fn === "read_automation" ? held : { ok: true, id: AUTO, version: 1 }));
  const orphan = await change.run({ id: AUTO, inputs: [{ name: "client", type: "text" }] },
    { capabilities: w3.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(orphan.ok, false, "an input was renamed out from under a step that uses it");
  assert.equal(orphan.error, "bad-workflow");
  assert.match(orphan.say, /customer/, orphan.say);
  assert.deepEqual(w3.sent.filter((r) => r.rpc.endsWith("_once")), [], "the orphaning edit was written");
});

test("⚠ A CREATED AUTOMATION'S ID IS DERIVED FROM THE CALL, so a redelivery is one automation", async () => {
  const make = CAPABILITY_TOOLS.find((t) => t.name === "make_automation");
  const args = { name: "n", steps: [{ type: "note", text: "x" }] };
  const op = OP();
  const first = await stepsOf(make, args, () => ({ ok: true, id: AUTO }));
  const { can, sent } = recorder(() => ({ ok: true, id: AUTO }));
  await make.run(args, { capabilities: can.forTenant(T).forAgent(AG), operation: op });
  const again = { sent };
  // The first call above minted its own `OP()`, so drive the SAME identity twice to make the
  // claim about the identity rather than about randomness.
  const { can: can2, sent: sent2 } = recorder(() => ({ ok: true, id: AUTO }));
  await make.run(args, { capabilities: can2.forTenant(T).forAgent(AG), operation: op });
  const idOf = (xs) => xs.find((x) => /^create_automation/.test(x.rpc)).body.p_id;
  assert.equal(idOf(again.sent), idOf(sent2), "the same call minted two different automations");
  // …AND A DIFFERENT CALL IS A DIFFERENT AUTOMATION, which is what says the id is not a
  // constant. Without this, "the same twice" is satisfied by a hardcoded value.
  assert.notEqual(idOf(first.sent), idOf(sent2), "every create takes the same id");
  // It is a uuid, because the column is one.
  assert.match(idOf(sent2), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("⚠ THE CATALOG A MODEL READS IS THE WHOLE REGISTRY, AND THE CEILING IS THE PLATFORM'S", async () => {
  const list = CAPABILITY_TOOLS.find((t) => t.name === "list_actions");
  // NO BACKEND AT ALL, deliberately: it describes what the platform can do, not what one
  // account holds — so it is the one capability tool that does not go through `withBackend`.
  const out = await list.run({}, {});
  assert.equal(out.ok, true, JSON.stringify(out));
  // A CENSUS BOTH WAYS. A model told about fewer actions than exist cannot use them; told
  // about more, it writes a workflow that is refused at the save.
  assert.deepEqual(out.actions.map((a) => a.type).sort(), AUTOMATION_STEPS.map((d) => d.type).sort());
  assert.equal(out.actions.length, AUTOMATION_STEPS.length);
  // THE CEILING IS THE MODULE'S OWN, so a model is not told to guess it and cannot be told
  // a bigger one than the reader will accept.
  assert.equal(out.max, MAX_WORKFLOW_STEPS);
  assert.ok(Number.isInteger(out.max) && out.max > 0, `the ceiling reads ${out.max}`);
  // Every action says what it is and what it takes, or the form a model fills is a guess.
  for (const a of out.actions) {
    const d = AUTOMATION_STEPS.find((x) => x.type === a.type);
    assert.equal(a.kind, d.stepKind, a.type);
    assert.equal(a.label, d.label, a.type);
    assert.equal(a.does, d.does, a.type);
    assert.deepEqual(a.fields.map((f) => f.name), d.configless ? [] : d.fields.map((f) => f.name), a.type);
  }
});

test("⚠ AN AGENT MAY ONLY AUTHOR A SCHEDULE ITS OWN TOOL CAN DESCRIBE", async () => {
  // ⚠ **THE WALL, BECAUSE A DESCRIPTION IS NOT ONE.** `SCHEDULE_FIELDS` tells a model which
  // schedules exist; nothing stops a model writing one that does not, and a tool argument is a
  // model's own output. A `weekly` reaching the database is `automations_schedule_is_whole`
  // refusing it for want of a day list the tool has no field for — a Postgres exception several
  // layers below the thing that can act on it — and a `once` is the same for `on_date`.
  //
  /**
   * ⚠ **RE-ANCHORED, NOT APPEASED, AND THE PRODUCT MOVED RATHER THAN THE CHECK.**
   *
   * This read `AUTHORABLE_SCHEDULES === ["manual","daily"]` plus "the set is narrower than the
   * platform's, so the refusal is reachable" — a narrowing pinned as a rule. Its own comment
   * gave the real reason: *a schedule a tool can NAME and cannot fully DESCRIBE is a dead
   * control that answers*, because `weekly` needs a day list and `once` a date and the tool
   * had fields for neither. **The answer to that is the FIELDS, not the narrowing**, and this
   * round gave it them — so `weekly` and `once`, which existed in the engine, in the column
   * and on the person's own form, are reachable now instead of being permanently out of an
   * agent's hands.
   *
   * The property that survives, asked as a derived census: **every schedule this tool may name
   * must have every field it needs among the tool's own properties.** A schedule added to
   * `AUTHORABLE_SCHEDULES` with nothing to describe it is a red run, which is what the old
   * list was standing in for.
   */
  assert.deepEqual([...AUTHORABLE_SCHEDULES].sort(), [...AUTOMATION_SCHEDULES].sort(),
    "a schedule the platform runs is out of an agent's reach, or one it does not is offered");
  for (const name of ["make_automation", "change_automation"]) {
    const props = CAPABILITY_TOOLS.find((t) => t.name === name).input.properties;
    for (const sched of AUTHORABLE_SCHEDULES) {
      const needs = SCHEDULE_NEEDS[sched];
      assert.ok(Array.isArray(needs), `${sched} has no declared needs, so nothing checks it`);
      for (const field of needs) {
        assert.ok(Object.hasOwn(props, field),
          `${name} may set ${sched} and has no ${field} field — a dead control that answers`);
      }
    }
  }
  // AND THE OBSERVER IS ALIVE: at least one schedule really needs a field, so the loop above
  // is not vacuous over four empty lists.
  assert.ok(Object.values(SCHEDULE_NEEDS).some((n) => n.length > 0),
    "no schedule needs anything, so the census checks nothing");

  for (const name of ["make_automation", "change_automation"]) {
    const tool = CAPABILITY_TOOLS.find((t) => t.name === name);
    assert.ok(tool, `${name} is not a tool`);
    /**
     * ⚠ **THE FIXTURE HAS TO ANSWER A ZONE, or the `daily` CONTROL below is refused for a
     * reason that is not the one under test.** A daily schedule now resolves its zone from the
     * agent's own setting and refuses `no-zone` where there is none — so a fixture answering
     * `{ok: true}` with no zone makes this case pass while proving nothing about the schedule
     * wall. *A fixture that fails for a reason other than the one under test reads exactly
     * like the feature being broken*, met here in the direction that hides a check.
     */
    const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG }
      : fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" }
      : { ok: true, id: AUTO }));
    const ops = can.forTenant(T).forAgent(AG);
    const args = { id: AUTO, name: "n", steps: [{ type: "note", text: "hi" }] };

    // REFUSED BY NAME, WITH THE LIST, and NOTHING IS WRITTEN — which is what makes it a
    // refusal rather than a failed attempt somebody has to undo.
    // ⚠ `weekly` AND `once` ARE OFF THIS LIST BECAUSE THEY ARE REACHABLE NOW. What is left is
    // what is genuinely not a schedule: a name the platform does not have, a wrong case, a
    // wrong kind and a blank — each with its own sentence.
    for (const asked of ["hourly", "fortnightly", "DAILY", ["daily"], 7, "", "  "]) {
      // ⚠ COUNTED AS WRITES, NOT AS REQUESTS — and the first draft of this counted requests.
      // `change_automation` makes a `read_automation` pre-check FIRST, which is a read and is
      // legitimate: what a refusal must leave untouched is the ROW, so the census is over the
      // `_once` calls, which are the only things that write.
      const before = sent.filter((r) => r.rpc.endsWith("_once")).length;
      const out = await tool.run({ ...args, schedule: asked }, { capabilities: ops, operation: OP() });
      assert.equal(out.ok, false, `${name} accepted the schedule ${JSON.stringify(asked)}`);
      assert.equal(out.error, "bad-schedule", JSON.stringify(out));
      // ⚠ BOTH REFUSALS NAME THE SET IT CAN SET, because that is the one thing a model can act
      // on — and they are two SENTENCES, because "a schedule that exists and this tool cannot
      // set" and "that did not arrive as a word" need different things done about them.
      assert.match(out.say, new RegExp(AUTHORABLE_SCHEDULES.join(", ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `the refusal does not say what it can set: ${out.say}`);
      /**
       * ⚠ **THREE REFUSALS, THREE SENTENCES** — and the third one's WORDS changed with the
       * product rather than the check being relaxed. It used to read "has to be set on the
       * screen, which asks for the rest of what it needs", which was true while the tool could
       * not describe `weekly` or `once`; now it can, so a name that is refused is one the
       * PLATFORM does not run and the sentence says that instead. Sending somebody to a screen
       * that cannot help either would be a dead end dressed as advice.
       */
      if (typeof asked !== "string") assert.match(out.say, /as a word/, out.say);
      else if (!asked.trim()) assert.match(out.say, /^say when it runs/, out.say);
      else assert.match(out.say, /not a schedule this platform runs/, out.say);
      assert.equal(sent.filter((r) => r.rpc.endsWith("_once")).length, before,
        `${name} wrote something for a refused schedule`);
    }

    /**
     * ⚠ THE TWO CONTROLS, without which "it refuses" is satisfied by a tool that refuses
     * everything: the two schedules it CAN set go through, and the one it stores is the one
     * that was asked for rather than whatever the default is.
     *
     * **RE-ANCHORED, NOT APPEASED: the two tools put it in two places now, and that is a real
     * difference rather than a spelling.** A create sends `p_schedule`; an edit sends a PATCH,
     * where the schedule is a key of `p_patch` — and the whole point of the patch is that a
     * key it does not carry is one this call is not about. So the reader is per tool and is
     * derived from the wrapper the tool really called.
     */
    const storedSchedule = () => {
      const req = sent.filter((r) => r.rpc.endsWith("_once")).at(-1);
      return req.rpc === "patch_automation_once" ? req.body.p_patch?.schedule : req.body.p_schedule;
    };
    // ⚠ EVERY AUTHORABLE SCHEDULE IS DRIVEN, derived from the list rather than named — so one
    // added next month is a control by existing. Each is given the fields IT needs.
    const enough = { manual: {}, daily: { atLocal: "09:00" },
      weekly: { atLocal: "09:00", days: ["mon", "thu"] },
      once: { atLocal: "09:00", onDate: "2027-01-04" } };
    assert.deepEqual(Object.keys(enough).sort(), [...AUTHORABLE_SCHEDULES].sort(),
      "a schedule is authorable and undriven, which reads exactly like coverage");
    for (const asked of AUTHORABLE_SCHEDULES) {
      const out = await tool.run({ ...args, schedule: asked, ...enough[asked] }, { capabilities: ops, operation: OP() });
      assert.equal(out.ok, true, `${name} refused ${asked}: ${JSON.stringify(out)}`);
      assert.equal(storedSchedule(), asked, `${name} stored ${storedSchedule()} for ${asked}`);
    }
    /**
     * ⚠ **AND WHAT AN ABSENT SCHEDULE MEANS IS THE ONE PLACE THE TWO TOOLS MUST DIFFER.**
     *
     * For a CREATE it is `manual` — the same default the site's own reader has, because making
     * an automation is not asking for it to be scheduled. For an EDIT it means PRESERVE, and
     * reading it as `manual` there is the defect this round fixed: a rename unscheduled a live
     * automation. So the patch must carry NO `schedule` key at all, which is a stronger claim
     * than "it stored manual" and is the one that would have been red before.
     */
    const bare = await tool.run(args, { capabilities: ops, operation: OP() });
    if (name === "make_automation") {
      assert.equal(bare.ok, true, JSON.stringify(bare));
      assert.equal(storedSchedule(), "manual");
    } else {
      // ⚠ AND A CALL THAT SAYS NOTHING ABOUT WHEN IT RUNS SENDS NOTHING ABOUT IT. The patch
      // carries exactly the fields this call named — here a name and a workflow — and NOT one
      // word about the schedule, which is what stops a rename unscheduling a live automation.
      assert.equal(bare.ok, true, JSON.stringify(bare));
      const req = sent.filter((r) => r.rpc.endsWith("_once")).at(-1);
      assert.equal(req.rpc, "patch_automation_once");
      assert.deepEqual(Object.keys(req.body.p_patch).sort(), ["name", "steps"],
        `an edit naming a name and steps sent ${JSON.stringify(Object.keys(req.body.p_patch))}`);
      for (const untouched of ["schedule", "atLocal", "zone", "enabled", "inputs"]) {
        assert.equal(Object.hasOwn(req.body.p_patch, untouched), false,
          `an edit that did not mention ${untouched} sent it anyway`);
      }
    }
  }
});

test("⚠ A DECLARATION IS REFUSED RATHER THAN REPAIRED, and nothing is written", async () => {
  /**
   * ⚠ **FOUND BY THE SWEEP, AND THE SWEEP IS THE ONLY THING THAT COULD HAVE FOUND IT.** Every
   * rule in `readInputs` was correct and NOT ONE of them was driven by anything the sweep
   * judges by: four mutants cut four walls out and all four survived. Measured, with each
   * mutation applied in turn against the real tool: an unknown type `lsit` was STORED as a
   * type, `required: "false"` became an input, two inputs called `a` were both kept, and nine
   * declarations went to a column whose own check refuses more than eight.
   *
   * The walls exist because the input came from a MODEL. `readWorkflow` normalises an unknown
   * type to `text` internally, which is right for a stored row it must not reject; here a
   * `list` misspelt `lsit` silently stored as text is a loop refused days later for a reason
   * nobody can see. So each of these is a REFUSAL, and this case is what says so.
   *
   * ⚠ **AND IT IS DRIVEN THROUGH THE TOOL, NEVER THROUGH THE READER.** `readInputs` is
   * exported and calling it directly would prove the rule and not the hop — which is the
   * defect this round already paid for once, one product over, where the site's route dropped
   * every declaration's TYPE between two correct readers. What must hold is that a refusal
   * reaches the model AND that nothing reaches the database, so both are asserted.
   */
  const make = CAPABILITY_TOOLS.find((t) => t.name === "make_automation");
  const steps = [{ type: "note", text: "hello" }];
  const named = (n) => Array.from({ length: n }, (_, i) => ({ name: `a${i}` }));

  const refused = {
    "an unknown kind of thing": [{ name: "lines", type: "lsit" }],
    "a required flag out of a string": [{ name: "a", required: "false" }],
    "two inputs of one name": [{ name: "a" }, { name: "a" }],
    // DERIVED FROM THE CEILING, never a hand-typed nine: the number is the column's and a
    // second copy of it here is one that drifts the day the column moves.
    "more than the column can hold": named(MAX_TOOL_INPUTS + 1),
  };
  for (const [said, inputs] of Object.entries(refused)) {
    const w = recorder(() => ({ ok: true, id: AUTO }));
    const out = await make.run({ name: "n", steps, inputs },
      { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
    assert.equal(out.ok, false, `${said} was accepted: ${JSON.stringify(out)}`);
    assert.equal(out.error, "bad-inputs", `${said} refused as ${out.error}`);
    assert.ok(typeof out.say === "string" && out.say.length > 0, `${said} refused without saying why`);
    assert.deepEqual(w.sent.filter((r) => r.rpc.endsWith("_once")), [], `${said} reached the database`);
  }
  // ⚠ AND THE SENTENCE SAYS WHICH DECLARATION AND WHAT IS WRONG WITH IT, because "bad-inputs"
  // is not something a model can act on. The type refusal names the type and the kinds it
  // could have been; the ceiling names the ceiling.
  const typed = await make.run({ name: "n", steps, inputs: [{ name: "lines", type: "lsit" }] },
    { capabilities: recorder(() => ({ ok: true })).can.forTenant(T).forAgent(AG), operation: OP() });
  assert.match(typed.say, /lsit/, typed.say);
  assert.match(typed.say, /list/, `the refusal does not say what it could have been: ${typed.say}`);
  const over = await make.run({ name: "n", steps, inputs: named(MAX_TOOL_INPUTS + 1) },
    { capabilities: recorder(() => ({ ok: true })).can.forTenant(T).forAgent(AG), operation: OP() });
  assert.match(over.say, new RegExp(String(MAX_TOOL_INPUTS)), over.say);

  /**
   * ⚠ **THE CONTROL, AND IT IS WHAT MAKES THE FOUR REFUSALS ABOVE WORTH ANYTHING**: a reader
   * that refused everything would satisfy every assertion in this case. Exactly at the
   * ceiling, with a real type and a real boolean, it goes through and the declarations reach
   * the store in the shape the column holds.
   */
  const ok = recorder(() => ({ ok: true, id: AUTO }));
  const good = await make.run(
    { name: "n", steps, inputs: [{ name: "lines", type: "list", required: true },
                                ...named(MAX_TOOL_INPUTS - 1)] },
    { capabilities: ok.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(good.ok, true, JSON.stringify(good));
  const wrote = ok.sent.find((r) => r.rpc === "create_automation_once");
  assert.equal(wrote.body.p_inputs.length, MAX_TOOL_INPUTS, "the ceiling itself was refused");
  assert.deepEqual(wrote.body.p_inputs[0],
    { name: "lines", label: "lines", required: true, default: "", type: "list" },
    "a declaration the tool accepted did not reach the store as it was declared");
});

test("⚠ MOVING AN AUTOMATION TO MANUAL CLEARS THE TIME IT NO LONGER HAS", async () => {
  /**
   * ⚠ **`automations_schedule_is_whole` REFUSES `manual` WITH A TIME**, so a call carrying
   * both is a Postgres exception several layers below the model that can act on it — and
   * "stop running it on a schedule" is the ordinary way somebody says that.
   *
   * FOUND BY THE SWEEP: a mutant reading `atLocal` straight off the call rather than from the
   * fields the schedule NEEDS survived, on both tools. Measured with it applied — the create
   * sent `p_at_local: "09:00"` beside `p_schedule: "manual"`, and the edit's patch the same —
   * and nothing anywhere failed.
   *
   * THE KEY IS PRESENT AND NULL RATHER THAN ABSENT, and on the EDIT that distinction is the
   * whole feature: absent means preserve, so a patch that merely omitted the time would leave
   * a manual automation wearing the time it used to run at. Clearing it takes saying so.
   */
  const steps = [{ type: "note", text: "hello" }];
  const held = { id: AUTO, agent: AG, name: "P", enabled: true, schedule: "daily",
    atLocal: "09:00", zone: "Europe/London", version: 1, steps, inputs: [] };

  const w = recorder((fn) => (fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" }
    : { ok: true, id: AUTO }));
  const made = await CAPABILITY_TOOLS.find((t) => t.name === "make_automation")
    .run({ name: "n", steps, schedule: "manual", atLocal: "09:00" },
         { capabilities: w.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(made.ok, true, JSON.stringify(made));
  const created = w.sent.find((r) => r.rpc === "create_automation_once").body;
  assert.equal(created.p_schedule, "manual");
  assert.equal(created.p_at_local, null,
    `a manual automation was created carrying a time: ${JSON.stringify(created.p_at_local)}`);

  const w2 = recorder((fn) => (fn === "read_automation" ? held
    : fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" } : { ok: true, id: AUTO, version: 2 }));
  const moved = await CAPABILITY_TOOLS.find((t) => t.name === "change_automation")
    .run({ id: AUTO, schedule: "manual", atLocal: "09:00" },
         { capabilities: w2.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(moved.ok, true, JSON.stringify(moved));
  const patch = w2.sent.find((r) => r.rpc === "patch_automation_once").body.p_patch;
  assert.equal(patch.schedule, "manual");
  assert.equal(Object.hasOwn(patch, "atLocal"), true,
    "a move to manual left the stored time alone, because absent means preserve");
  assert.equal(patch.atLocal, null, `the patch kept a time: ${JSON.stringify(patch.atLocal)}`);

  // ⚠ THE CONTROL: a schedule that really NEEDS a time still gets the one the call gave it, so
  // this is about the schedule's own needs and not about `atLocal` being ignored everywhere.
  const w3 = recorder((fn) => (fn === "read_automation" ? held
    : fn === "read_agent_settings" ? { ok: true, zone: "Europe/London" } : { ok: true, id: AUTO, version: 2 }));
  const daily = await CAPABILITY_TOOLS.find((t) => t.name === "change_automation")
    .run({ id: AUTO, schedule: "daily", atLocal: "07:30" },
         { capabilities: w3.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(daily.ok, true, JSON.stringify(daily));
  assert.equal(w3.sent.find((r) => r.rpc === "patch_automation_once").body.p_patch.atLocal, "07:30",
    "a daily schedule lost the time it was given");
});

/**
 * ⚠ **THE RECORD IS ASKED BEFORE THE ROW DECIDES, AND THESE CASES EXIST BECAUSE THE SWEEP
 * CANNOT RUN THE DEMONSTRATION.**
 *
 * `npm run verify:ops` proves this end to end against a real PostgreSQL — and `npm run sweep`
 * runs `test/*.test.mjs` and not that, so *a property proven only by an instrument the sweep
 * cannot run is a property no mutant can be caught by*. This directory has paid for that five
 * times; the cases below are where a mutant on the consult can be seen.
 *
 * **THE DEFECT, REPRODUCED before the fix**, through the real tool and adapter against a real
 * PostgreSQL: an edit moved a daily automation from 09:00 to 10:00, its answer was lost, and
 * the retry of the SAME operation read the stored row, found 10:00 already there, computed an
 * empty patch and answered `nothing-asked` — while `patch_automation_once` was holding
 * `{ok: true, version: 1, …}` for exactly that identity.
 */
const recordSeam = (state, extra = {}) => {
  const asked = [];
  const can = {
    readAutomation: async () => ({ id: AUTO, agent: AG, schedule: "daily", atLocal: "10:00:00",
      zone: "Europe/London", steps: [], inputs: [], days: [], onDate: null, onEvent: null, version: 1 }),
    readAgentSettings: async () => ({ zone: "Europe/London" }),
    checkOperation: async (a) => { asked.push({ op: "checkOperation", a }); return { state, ...extra }; },
    patchAutomation: async (a) => { asked.push({ op: "patchAutomation", a }); return { ok: true, id: AUTO, version: 9 }; },
    createAutomation: async (a) => { asked.push({ op: "createAutomation", a }); return { ok: true, id: AUTO, version: 1 }; },
  };
  return { can, asked, wrote: () => asked.some((x) => x.op === "patchAutomation" || x.op === "createAutomation") };
};
const changeTool = () => CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
const makeTool = () => CAPABILITY_TOOLS.find((t) => t.name === "make_automation");

test("⚠ A RETRY OF A COMPLETED EDIT ANSWERS THE RECORD, NOT `nothing-asked`", async () => {
  // The reproduced shape: the row ALREADY says what this call asks for, so the patch is empty.
  const seam = recordSeam("repeat", { outcome: { ok: true, id: AUTO, version: 1, next_run_at: "2026-09-19T09:00:00+00:00" } });
  const again = await changeTool().run({ id: AUTO, atLocal: "10:00" },
    { capabilities: seam.can, operation: OP() });
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.repeat, true, "the answer does not say it was already done");
  assert.equal(again.error, undefined, `it refused: ${again.error}`);
  // THE FIRST ATTEMPT'S numbers, out of the record — never re-derived from the row as it stands.
  assert.equal(again.version, 1);
  assert.equal(again.nextRunAt, "2026-09-19T09:00:00+00:00");
  // ⚠ `changed` IS ABSENT BECAUSE THE RECORD DOES NOT HOLD IT. Computed from the patch this
  // attempt WOULD have sent, it is a fact about this attempt's arithmetic against a row
  // somebody may have moved since, not about the edit that really happened.
  assert.equal(again.changed, undefined, `it invented what changed: ${JSON.stringify(again.changed)}`);
  assert.equal(seam.wrote(), false, "a completed operation was performed a second time");
  // ⚠ AND IT ASKED ABOUT THE WRITE BY NAME, so the action the record is compared against is
  // the one the wrapper records under rather than a string typed here.
  assert.deepEqual(seam.asked.map((x) => x.op), ["checkOperation"]);
  assert.equal(seam.asked[0].a.op, "patchAutomation");
});

test("⚠ A RECORDED FAILURE STAYS A FAILURE ON RETRY", async () => {
  /**
   * The wrapper records whatever the plain function answered — a refusal included — so a
   * record proves the work HAPPENED and not that it succeeded. **The first draft of this fix
   * read every repeat as `ok: true`**, which would have laundered *"that automation needs a
   * name"* into *"done"* on the second delivery: worse than the defect being fixed.
   */
  const seam = recordSeam("repeat", { outcome: { ok: false, error: "bad-name" } });
  const again = await changeTool().run({ id: AUTO, name: "" }, { capabilities: seam.can, operation: OP() });
  assert.equal(again.ok, false, JSON.stringify(again));
  assert.equal(again.error, "bad-name", "the recorded refusal lost its own reason");
  assert.equal(again.repeat, undefined, "a refusal was reported as a repeat of a success");
  assert.equal(again.recorded, true, "nothing says this refusal was already given");
  // THE SENTENCE IS THE LIVE PATH'S OWN, from one place, so a refusal reads the same whichever
  // delivery gave it.
  assert.match(String(again.say), /needs a name/);
  assert.equal(seam.wrote(), false, "a recorded refusal was attempted again");
});

test("⚠ THE SAME IDENTITY WITH DIFFERENT ARGUMENTS IS REFUSED, AND NOTHING IS WRITTEN", async () => {
  const seam = recordSeam("mismatch", { action: "create_automation" });
  const clash = await changeTool().run({ id: AUTO, atLocal: "12:00" }, { capabilities: seam.can, operation: OP() });
  assert.equal(clash.ok, false, JSON.stringify(clash));
  assert.equal(clash.error, "operation-mismatch");
  // ⚠ IT NAMES WHAT THE KEY WAS RECORDED FOR, which is the only thing a caller can act on —
  // and is what tells this refusal from the wrapper's, which makes the same one without it.
  assert.match(String(clash.say), /create_automation/);
  assert.equal(seam.wrote(), false, "a reused identity still performed a write");
});

test("⚠ A GENUINELY EMPTY NEW REQUEST IS STILL REFUSED — the control", async () => {
  // ⚠ **WITHOUT THIS, "the retry is answered" IS SATISFIED BY A TOOL THAT NEVER REFUSES.** A
  // fresh identity naming nothing cost a person an approval, so answering "done" about nothing
  // is the dead control again. The row already says 10:00, which is what the call asks for.
  const seam = recordSeam("fresh");
  const empty = await changeTool().run({ id: AUTO, atLocal: "10:00" }, { capabilities: seam.can, operation: OP() });
  assert.equal(empty.ok, false, JSON.stringify(empty));
  assert.equal(empty.error, "nothing-asked");
  assert.equal(seam.wrote(), false);

  // AND A FRESH CALL THAT REALLY NAMES SOMETHING STILL WRITES, which is the other half of the
  // control: the consult must not have become a wall in front of every edit.
  const live = recordSeam("fresh");
  const did = await changeTool().run({ id: AUTO, atLocal: "11:00" }, { capabilities: live.can, operation: OP() });
  assert.equal(did.ok, true, JSON.stringify(did));
  assert.equal(live.wrote(), true, "a fresh edit was not performed");
});

test("⚠ A RECORD WE COULD NOT READ IS NOT A REPEAT — cannot-tell falls to the ordinary path", async () => {
  /**
   * ⚠ **WHICH WAY THIS FALLS IS THE WHOLE SAFETY ARGUMENT.** Read as a repeat, an unreadable
   * answer invents a success with no outcome to answer from. Read as `unknown`, the cost is the
   * old behaviour — and the `_once` wrapper asks this same function INSIDE its transaction, so
   * a write that does go out is still deduplicated there. Driven for every shape that is not a
   * state: an answer with none, a missing operation, and an adapter that has no such reader at
   * all (a deployment older than this).
   */
  for (const [what, seam] of [
    ["an answer carrying no state", recordSeam(undefined)],
    ["a state that is not a string", recordSeam(7)],
  ]) {
    const out = await changeTool().run({ id: AUTO, atLocal: "11:00" }, { capabilities: seam.can, operation: OP() });
    assert.equal(out.ok, true, `${what}: ${JSON.stringify(out)}`);
    assert.equal(out.repeat, undefined, `${what}: an unreadable record was read as a repeat`);
    assert.equal(seam.wrote(), true, `${what}: the write was skipped on a record nobody could read`);
  }
  // AN ADAPTER WITH NO SUCH READER — the operation is new, so a store built before it must not
  // throw. The tool asks whether the function exists rather than assuming the surface it has.
  const older = recordSeam("repeat", { outcome: { ok: true, id: AUTO } });
  delete older.can.checkOperation;
  const out = await changeTool().run({ id: AUTO, atLocal: "11:00" }, { capabilities: older.can, operation: OP() });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(older.wrote(), true, "an older adapter's edit was silently dropped");
});

test("⚠ `make_automation` HAS THE SAME SHAPE, above the one refusal a person can cause", async () => {
  /**
   * Every refusal above the consult there is about the model's OWN arguments, which a retry
   * carries unchanged. `zoneFor` is the exception: it READS the account's settings, so somebody
   * clearing the zone between two deliveries would answer `no-zone` about an automation that
   * already exists — and send the model to ask for a setting for work that is done.
   */
  const plan = { name: "Morning", schedule: "daily", atLocal: "09:00",
    steps: [{ type: "note", out: "n", text: "hi" }] };
  const seam = recordSeam("repeat", { outcome: { ok: true, id: AUTO, version: 1, next_run_at: "2026-09-19T08:00:00+00:00" } });
  // THE ZONE IS GONE, which is what makes this case about the consult rather than about a
  // happy path: without it the tool refuses `no-zone` before it can ask anything.
  seam.can.readAgentSettings = async () => ({ zone: null });
  const again = await makeTool().run(plan, { capabilities: seam.can, operation: OP() });
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.repeat, true);
  assert.equal(again.automation, AUTO, "the recorded automation's id was not answered");
  assert.equal(seam.wrote(), false, "a second automation was created");
  assert.equal(seam.asked[0].a.op, "createAutomation", "it asked the record about the wrong action");

  // THE CONTROL: with no record, that same call really does refuse for the zone — so the case
  // above is about the record being consulted and not about `no-zone` having been deleted.
  const fresh = recordSeam("fresh");
  fresh.can.readAgentSettings = async () => ({ zone: null });
  const refused = await makeTool().run(plan, { capabilities: fresh.can, operation: OP() });
  assert.equal(refused.ok, false, JSON.stringify(refused));
  assert.equal(refused.error, "no-zone");
  assert.equal(fresh.wrote(), false);
});

test("⚠ THE RECORD READER ASKS ABOUT ONE WRITE, BY ITS OWN NAME, AND NOTHING ELSE", async () => {
  /**
   * ⚠ **THREE SWEEP MUTANTS SURVIVED HERE, and the reason is the shape of every case above:
   * they drive the TOOLS against a fake `can`, so the ADAPTER is never reached.** A tool can
   * ask the record perfectly and the adapter can ask the wrong question — about a hardcoded
   * action (so every answer is `fresh` and the retry protection is decorative), about a READ
   * (a question with no subject), or under a key minted from a malformed identity (which
   * collides with something). Each of those is invisible to a tool-level fake, and the first
   * is invisible from outside altogether: it answers `fresh` exactly as a first attempt does.
   */
  const { can, sent } = recorder(() => ({ state: "fresh" }));
  const ops = can.forTenant(T).forAgent(AG);
  const OPID = OP(77, 0, "cafe1234");

  // ⚠ THE ACTION IS DERIVED FROM `CAPABILITY_RPC`, so it is the same name the `_once` wrapper
  // records under — one copy of it, and a census over every write rather than one example.
  for (const w of CAPABILITY_WRITES) {
    sent.length = 0;
    const out = await ops.checkOperation({ op: w, operation: OPID });
    assert.equal(out.state, "fresh", `${w}: ${JSON.stringify(out)}`);
    const req = sent.at(-1);
    assert.equal(req.rpc, CAPABILITY_RPC.checkOperation, `${w} asked something other than the record`);
    assert.equal(req.body.p_action, CAPABILITY_RPC[w],
      `${w} asked the record about ${req.body.p_action}, which is not what its wrapper records under`);
    // THE KEY AND THE HASH SPLIT THE WAY THE DATABASE STORES THEM, and the tenant is the
    // closure's — the four arguments are the one place a new field could smuggle one in.
    assert.equal(req.body.p_op_key, `${RUN}:77:0`, `${w} sent the hash inside the key`);
    assert.equal(req.body.p_args_hash, "cafe1234");
    assert.equal(req.body.p_tenant, T);
    assert.equal(req.body.p_agent_id, undefined, `${w} sent an agent to a record question`);
  }

  // ⚠ A READ HAS NO RECORD, so asking about one is `unknown` and reaches NO REQUEST AT ALL.
  // `fresh` would be a statement about a record, and there is none to make it about.
  for (const r of CAPABILITIES.filter((c) => !CAPABILITY_WRITES.includes(c))) {
    sent.length = 0;
    const out = await ops.checkOperation({ op: r, operation: OPID });
    assert.equal(out.state, "unknown", `${r} was admitted to the record question`);
    assert.equal(out.why, "not-a-write");
    assert.equal(sent.length, 0, `${r} asked the database about a record it cannot have`);
  }
  // AND A NAME THAT IS NOT AN OPERATION AT ALL.
  assert.equal((await ops.checkOperation({ op: "constructor", operation: OPID })).state, "unknown");
  assert.equal((await ops.checkOperation({ op: "notAnOperation", operation: OPID })).state, "unknown");

  // ⚠ A MALFORMED IDENTITY MINTS NO KEY. `splitOperation` refuses because a key invented from
  // one collides with something — so the refusal must be the answer, not a repaired key.
  for (const junk of [undefined, null, "", "nonsense", "a:b", `${RUN}:x:0:cafe`, 7, ["a"], {}]) {
    sent.length = 0;
    const out = await ops.checkOperation({ op: "patchAutomation", operation: junk });
    assert.equal(out.state, "unknown", `${JSON.stringify(junk)} was read as an identity`);
    assert.equal(sent.length, 0, `${JSON.stringify(junk)} reached the database as a key`);
  }
  // THE TWO SILENCES ARE TOLD APART, because one is a caller that forgot and one is a caller
  // that sent something it could not build.
  assert.equal((await ops.checkOperation({ op: "patchAutomation" })).why, "operation-required");
  assert.equal((await ops.checkOperation({ op: "patchAutomation", operation: "nope" })).why, "operation-unreadable");

  // AND THE FOUR STATES COME THROUGH AS THEY ARE, with `unknown` for anything that is not one.
  for (const [answer, want] of [
    [{ state: "repeat", outcome: { ok: true }, recordedAt: "t" }, "repeat"],
    [{ state: "mismatch", action: "create_automation" }, "mismatch"],
    [{ state: "unfinished" }, "unfinished"],
    [{ state: "fresh" }, "fresh"],
    [{}, "unknown"], [{ state: 7 }, "unknown"], [null, "unknown"], ["fresh", "unknown"],
  ]) {
    const one = recorder(() => answer).can.forTenant(T).forAgent(AG);
    const out = await one.checkOperation({ op: "patchAutomation", operation: OPID });
    assert.equal(out.state, want, `${JSON.stringify(answer)} read as ${out.state}`);
  }
  // THE MISMATCH CARRIES WHAT THE KEY WAS RECORDED FOR, which is the only thing a caller can act on.
  const mm = recorder(() => ({ state: "mismatch", action: "create_automation" })).can.forTenant(T).forAgent(AG);
  assert.equal((await mm.checkOperation({ op: "patchAutomation", operation: OPID })).action, "create_automation");
});

/**
 * ⚠ **CHECKING A WORKFLOW BEFORE IT RUNS — three answers, and none of them is permission.**
 *
 * THE DEFECT: everything these validators know was reachable only by SAVING, and a dependency
 * that is not about the steps at all — an account not connected, a permission the provider
 * withheld, another automation nobody has made, a time zone nobody set — could only be found by
 * running the automation and reading the failure afterwards.
 *
 * ⚠ **AND THESE CASES EXIST BECAUSE `npm run sweep` DOES NOT RUN `verify:edits`.** Every
 * property below is proved end to end there, against a real PostgreSQL through both doors — and
 * a property proven only by an instrument the sweep cannot run is a property no mutant can be
 * caught by, which this directory has recorded six times.
 */
const ckTool = CAPABILITY_TOOLS.find((t) => t.name === "check_workflow");
const ckNote = { type: "note", text: "x" };
const ckSend = { type: "send", connection: AG, to: "a@b.test", body: "hi" };
const ckLive = { id: AG, provider: "fakemail", status: "active", scopes: ["send"] };
/** A ctx whose every seam is a recorder, so what a check really ASKED is readable. */
function ckCtx(over = {}) {
  const asked = [];
  const ctx = {
    connections: {
      list: async () => { asked.push("list"); return over.connections ?? [ckLive]; },
      sendScopes: () => { asked.push("sendScopes"); return { fakemail: "send" }; },
      ...(over.conn ?? {}),
    },
    capabilities: {
      listAutomations: async () => { asked.push("listAutomations"); return over.automations ?? []; },
      readAgentSettings: async () => { asked.push("readAgentSettings"); return over.settings ?? { zone: "Europe/London" }; },
      ...(over.can ?? {}),
    },
  };
  return { ctx, asked };
}

test("⚠ A CHECK ANSWERS STRUCTURE, DEPENDENCIES AND WHAT IT COULD NOT ASK, and says it is not permission", async () => {
  // 1. A STRUCTURAL PROBLEM IS A REFUSAL, because nothing outside the list can fix it — and it
  // names the POSITION, which is what the site's own reader says word for word.
  const ckBad = await ckTool.run({ steps: [{ type: "lsit" }] }, ckCtx().ctx);
  assert.equal(ckBad.ok, false);
  // ⚠ THE CODE IS STABLE AND THE SENTENCE IS THE READER'S OWN, which is the product being
  // right: `error` is what a caller branches on, `say` is what a person is shown — and it is the
  // sentence that has to agree with the site's reader word for word, so it is the one asserted.
  assert.equal(ckBad.error, "bad-workflow");
  assert.match(String(ckBad.say), /^step 1: this platform has no step called lsit/);

  // 2. AND SO IS A SCHEDULE THE DATABASE WOULD REFUSE. A check that read only the steps would
  // pass a configuration the save then rejects, which is the one thing a pre-flight must not do.
  const ckSched = await ckTool.run({ steps: [ckNote], schedule: "weekly", atLocal: "09:00" }, ckCtx().ctx);
  assert.equal(ckSched.ok, false);
  assert.match(String(ckSched.say ?? ckSched.error), /day/i,
    `a weekly schedule with no days passed: ${JSON.stringify(ckSched)}`);

  // 3. A DEPENDENCY IS REPORTED, NEVER REFUSED — and the sentence carries both.
  const ckDep = await ckTool.run({ steps: [ckSend] }, ckCtx({ connections: [] }).ctx);
  assert.equal(ckDep.ok, true, "a dependency was reported as a problem with the steps");
  assert.deepEqual(ckDep.needs.map((n) => n.kind), ["connection"]);
  assert.deepEqual(ckDep.unchecked, []);
  assert.match(ckDep.say, /1 thing has to be in place/);
  assert.match(ckDep.say, /Checking is not permission/);
  // ITS CONTROL: the same step against the account it names is nothing to report at all.
  const ckFine = await ckTool.run({ steps: [ckSend] }, ckCtx().ctx);
  assert.deepEqual([ckFine.needs, ckFine.unchecked], [[], []]);
  assert.match(ckFine.say, /that reads as 1 step\. Checking is not permission/);

  /**
   * 4. ⚠ **WITH NO SEAMS AT ALL IT STILL CHECKS THE STRUCTURE.** The steps are answered out of
   * this repository's own code, so a deployment with no store must not refuse the question —
   * `no-backend` here would make a check impossible exactly where it is cheapest.
   */
  for (const ckNo of [undefined, {}, { capabilities: null, connections: null }]) {
    const ckOut = await ckTool.run({ steps: [ckSend, { type: "workflow", runs: AUTO }] }, ckNo);
    assert.equal(ckOut.ok, true, `a check refused for want of a seam: ${JSON.stringify(ckOut)}`);
    assert.notEqual(ckOut.error, "no-backend");
    assert.deepEqual(ckOut.needs, [], "an unasked question was reported as something to fix");
    assert.deepEqual(ckOut.unchecked.map((u) => u.kind).sort(), ["connection", "subworkflow"]);
  }

  /**
   * 5. ⚠ **ONE OUTAGE MAY NOT SILENCE THE OTHERS**, which is why each read is in its own `try`.
   * The connections read falls over and the subworkflow is still answered — a need, not a
   * shrug — so a single `catch` around the three would be a red run.
   */
  const ckOne = await ckTool.run({ steps: [ckSend, { type: "workflow", runs: AUTO }] }, ckCtx({ conn: { list: async () => { throw new Error("down"); } } }).ctx);
  assert.deepEqual(ckOne.unchecked.map((u) => u.kind), ["connection"]);
  assert.deepEqual(ckOne.needs.map((n) => n.kind), ["subworkflow"],
    "one read failing silenced a question that was answered");

  // 6. THE ZONE IS ASKED ONLY WHERE THERE IS A LOCAL TIME TO BE IN, asserted as the reads the
  // check really made rather than as the answer it gave.
  const ckManual = ckCtx();
  await ckTool.run({ steps: [ckNote] }, ckManual.ctx);
  assert.equal(ckManual.asked.includes("readAgentSettings"), false, "a manual check read the settings");
  const ckDaily = ckCtx({ settings: { zone: "" } });
  const ckZone = await ckTool.run({ steps: [ckNote], schedule: "daily", atLocal: "09:00" }, ckDaily.ctx);
  assert.equal(ckDaily.asked.includes("readAgentSettings"), true);
  assert.deepEqual(ckZone.needs.map((n) => n.kind), ["zone"]);
  // AND A SETTINGS READ THAT FAILED IS `unchecked` — a sentence only this layer can compose,
  // because `workflowNeeds` is handed `null` for a read that failed and for a seam that is not
  // there and cannot tell them apart.
  const ckBlind = await ckTool.run({ steps: [ckNote], schedule: "daily", atLocal: "09:00" }, ckCtx({ can: { readAgentSettings: async () => { throw new Error("down"); } } }).ctx);
  assert.deepEqual(ckBlind.needs, [], "a zone nobody could ask about was reported as one to set");
  assert.deepEqual(ckBlind.unchecked.map((u) => u.kind), ["zone"]);

  /**
   * 7. ⚠ **AND IT WRITES NOTHING, which is the half a sentence cannot carry.** Asserted as the
   * operations it really touched: only reads, and none of `CAPABILITY_WRITES`.
   */
  const ckAll = ckCtx();
  await ckTool.run({ steps: [ckSend, { type: "workflow", runs: AUTO }], schedule: "daily", atLocal: "09:00" }, ckAll.ctx);
  assert.equal(ckAll.asked.length > 0, true, "the check reached no seam, so this proves nothing");
  assert.deepEqual(ckAll.asked.filter((op) => CAPABILITY_WRITES.includes(op)), [],
    `a check reached a write: ${ckAll.asked.join(", ")}`);
  // `defineTool` NORMALISES the flag, so the honest assertion is `false` rather than absent.
  assert.equal(ckTool.writes, false, "a check that declares itself a write claims an identity and a record");
});


/**
 * ⚠ **A SCHEDULE WITH NO MOMENT LEFT, AND WHY THIS IS A CASE RATHER THAN A DEMONSTRATION
 * CHECK.** `verify:triggers` proves it end to end against a real PostgreSQL, and
 * `npm run sweep` runs no demonstration — *a property proven only by an instrument the sweep
 * cannot run is a property no mutant can be caught by*, which this directory has recorded
 * seven times. What a mutant can see is here.
 *
 * **THE DEFECT, MEASURED on a real PostgreSQL before `agent.schedule_spent` existed**: all
 * four writing doors answered `{"ok": true, …, "next_run_at": null}` for a one-off whose day
 * had gone AND for an automation with no schedule at all. A screen tells them apart because it
 * holds the schedule beside the answer; a model reads the answer and nothing else, so it was
 * told the work landed with no way to know the automation can never run.
 */
test("⚠ A SPENT SCHEDULE IS SAID, and `next_run_at: null` alone could not say it", async () => {
  const spTools = (name) => CAPABILITY_TOOLS.find((t) => t.name === name);
  // EVERY WRITING DOOR THAT CAN PRODUCE ONE, and the list is DERIVED from the tools rather
  // than typed, so a fifth one cannot be added and go unasked.
  const spDoors = [
    ["pause_automation", { id: AUTO, enabled: true }, "set_automation_enabled"],
    ["change_automation", { id: AUTO, schedule: "once", onDate: "2020-01-01", atLocal: "09:00" }, "patch_automation"],
    ["make_automation", { name: "A one-off", schedule: "once", onDate: "2020-01-01", atLocal: "09:00",
                         steps: [{ type: "note", text: "x" }] }, "create_automation"],
  ];
  assert.equal(spDoors.length, 3, "a writing door was added and is not asked about here");

  for (const [spName, spArgs, spRpc] of spDoors) {
    const spTool = spTools(spName);
    assert.ok(spTool, `${spName} is not a tool`);
    // A BACKEND THAT ANSWERS WHAT THE DATABASE REALLY ANSWERS FOR A SPENT ONE-OFF.
    const spSpent = recorder((rpc) => rpc.startsWith("read_automation")
      ? { id: AUTO, agent: AG, name: "A one-off", schedule: "once", enabled: true }
      : rpc.startsWith("read_agent_settings") ? { ok: true, zone: "Europe/London" }
      : { ok: true, id: AUTO, automation: AUTO, version: 1, enabled: true, next_run_at: null, spent: true });
    const spGone = await spTool.run(spArgs, { capabilities: spSpent.can.forTenant(T).forAgent(AG), operation: OP() });
    assert.equal(spGone.ok, true, `${spName}: ${JSON.stringify(spGone)}`);
    assert.equal(spGone.spent, true, `${spName} dropped the fact`);
    assert.equal(spGone.say, SPENT_SAY, `${spName} did not say it: ${spGone.say}`);
    assert.ok(spSpent.sent.some((s) => s.rpc.startsWith(spRpc)), `${spName} never reached ${spRpc}`);

    /**
     * ⚠ **THE CONTROL, and without it "it says so" is satisfied by a tool that always does.**
     * The SAME call against a database that armed a real instant must say nothing extra — and
     * a `manual` automation, whose `next_run_at` really is null, is the shape the bare null
     * could not be told apart from.
     */
    for (const [spWhat, spAnswer] of [
      ["an instant was armed", { ok: true, id: AUTO, automation: AUTO, version: 1, enabled: true,
                                 next_run_at: "2099-01-01T09:00:00+00:00", spent: false }],
      ["no schedule at all", { ok: true, id: AUTO, automation: AUTO, version: 1, enabled: true,
                               next_run_at: null, spent: false }],
    ]) {
      const spOk = recorder((rpc) => rpc.startsWith("read_automation")
        ? { id: AUTO, agent: AG, name: "A one-off", schedule: "once", enabled: true }
        : rpc.startsWith("read_agent_settings") ? { ok: true, zone: "Europe/London" } : spAnswer);
      const spFine = await spTool.run(spArgs, { capabilities: spOk.can.forTenant(T).forAgent(AG), operation: OP() });
      assert.equal(spFine.ok, true, `${spName}/${spWhat}: ${JSON.stringify(spFine)}`);
      assert.equal(spFine.spent, undefined, `${spName}/${spWhat} claimed a spent schedule`);
      assert.equal(spFine.say, undefined, `${spName}/${spWhat} said ${spFine.say}`);
    }
  }

  /**
   * ⚠ **CANNOT-TELL READS AS NOTHING TO SAY, and the direction is the whole point.** A
   * database predating `agent.schedule_spent` carries no such key, and `Boolean("false")` is
   * `true`. Read either as spent and every working daily automation would be reported as one
   * that will never run — far worse than the silence this replaces.
   */
  const spPause = spTools("pause_automation");
  for (const spJunk of [undefined, null, "true", "false", "", 0, 1, {}, [], "spent"]) {
    const spOdd = recorder((rpc) => rpc.startsWith("read_automation")
      ? { id: AUTO, agent: AG, name: "x", schedule: "once", enabled: true }
      : { ok: true, id: AUTO, enabled: true, next_run_at: null, spent: spJunk });
    const spSaid = await spPause.run({ id: AUTO, enabled: true }, { capabilities: spOdd.can.forTenant(T).forAgent(AG), operation: OP() });
    assert.equal(spSaid.ok, true, `spent=${JSON.stringify(spJunk)}: ${JSON.stringify(spSaid)}`);
    assert.equal(spSaid.spent, undefined, `spent=${JSON.stringify(spJunk)} was read as spent`);
    assert.equal(spSaid.say, undefined, `spent=${JSON.stringify(spJunk)} earned a sentence`);
  }

  /**
   * ⚠ **AND BOTH FACTS SURVIVE TOGETHER.** A repeat and a spent schedule are independent and
   * both are reachable at once — the recorded outcome a repeat is answered from carries `spent`
   * too — so composing them as two spread objects would hand a model whichever came last and
   * silently delete the other. Asserted as BOTH sentences in one `say`.
   */
  const spBoth = recorder((rpc) => rpc.startsWith("read_automation")
    ? { id: AUTO, agent: AG, name: "x", schedule: "once", enabled: true }
    : { ok: true, id: AUTO, enabled: true, next_run_at: null, spent: true, repeat: true });
  const spPair = await spPause.run({ id: AUTO, enabled: true }, { capabilities: spBoth.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(spPair.repeat, true, "the repeat was lost");
  assert.equal(spPair.spent, true, "the spent schedule was lost");
  assert.ok(spPair.say.includes("already done by this same request"), `the repeat's words went: ${spPair.say}`);
  assert.ok(spPair.say.includes(SPENT_SAY), `the spent sentence went: ${spPair.say}`);
  // ...AND A REPEAT ALONE STILL CARRIES ITS OWN WORDS AND NOTHING ELSE — the other half, so
  // "both are there" is not satisfied by a reader that always says both.
  const spRep = recorder((rpc) => rpc.startsWith("read_automation")
    ? { id: AUTO, agent: AG, name: "x", schedule: "daily", enabled: true }
    : { ok: true, id: AUTO, enabled: true, next_run_at: "2099-01-01T09:00:00+00:00", spent: false, repeat: true });
  const spOnly = await spPause.run({ id: AUTO, enabled: true }, { capabilities: spRep.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(spOnly.repeat, true);
  assert.equal(spOnly.spent, undefined);
  assert.equal(spOnly.say.includes(SPENT_SAY), false, `a working schedule was called spent: ${spOnly.say}`);

  // THE SENTENCE NAMES WHAT TO DO ABOUT IT, because "it will never run" with no remedy is a
  // dead end for a model composing prose for somebody.
  assert.ok(/date/.test(SPENT_SAY) && /never run/.test(SPENT_SAY), SPENT_SAY);
  assert.ok(/still to come|repeating/.test(SPENT_SAY), `it does not say what would fix it: ${SPENT_SAY}`);
});

/**
 * ── handing work to a specialist ────────────────────────────────────────────────────
 *
 * The two censuses above classify these tools; what is proved here is what they DO. Every
 * fixture below is derived from its real producer — `agent.list_specialists`,
 * `agent.delegate_children` and `agent.delegation_progress` each build their rows with a
 * `jsonb_build_object` whose keys are copied from the migration — because a fake in a
 * different shape from reality hides a defect exactly as well as one that is less capable,
 * and this file has paid for that twice.
 */
const SPEC = "44444444-4444-4444-8444-444444444444";
const SPEC2 = "55555555-5555-4555-8555-555555555555";
const delegateTool = () => CAPABILITY_TOOLS.find((t) => t.name === "delegate");
const specialistsTool = () => CAPABILITY_TOOLS.find((t) => t.name === "list_specialists");

/** `agent.list_specialists`' own row shape, key for key. */
const spec = (id, over = {}) => ({
  id, name: `spec-${id.slice(0, 4)}`, status: "active", tools: ["remember"],
  about: "does one thing", about_cut: false, ...over,
});
/** `agent.delegation_progress`' own row shape, key for key. */
const child = (idx, over = {}) => ({
  delegation: `d${idx}`, step: "d1.0", idx, depth: 1,
  agent_id: SPEC, agent_name: "spec", task: `task ${idx}`, tools: [], context: [],
  run_id: `r${idx}`, run_status: "running", run_stop: null,
  created_at: new Date().toISOString(), admitted_at: new Date().toISOString(),
  claimed_at: null, settled_at: null, cancelled_at: null,
  deadline_at: new Date(Date.now() + 60_000).toISOString(), outcome: null,
  ...over,
});
/** A recording seam, with `open` and `look` answerable per case. */
function seam({ roster = [spec(SPEC)], filed, rows = [] } = {}) {
  const calls = [];
  const to = {
    bounds: { ...DELEGATION_DEFAULTS, waitMs: 60_000 },
    refusedBounds: [],
    async specialists() { calls.push({ op: "specialists" }); return roster; },
    async open(a) {
      calls.push({ op: "open", ...a });
      // `agent.delegate_children`'s own answer, key for key.
      return filed ?? { ok: true, root: RUN, depth: 1, step: a.step, made: a.children.length,
        absorbed: 0, deadline_at: null, concurrency: 4, running: a.children.length,
        parent_released: true,
        children: a.children.map((c, i) => ({ idx: i, delegation: c.id, run_id: c.run_id,
          agent_id: c.agent_id, tools: c.tools, admitted: true })) };
    },
    async look() { calls.push({ op: "look" }); return typeof rows === "function" ? rows() : rows; },
  };
  return { to, calls, filedAt: () => calls.filter((c) => c.op === "open") };
}

test("⚠ THE STEP KEY AND THE CHILD IDS COME OFF `ctx.operation`, so a redelivery asks about the same children", async () => {
  const t = delegateTool();
  const op = `${RUN}:4:2:abcd1234`;
  const first = seam();
  await t.run({ tasks: [{ specialist: SPEC, task: "one" }, { specialist: SPEC, task: "two" }] },
              { delegation: first.to, operation: op });
  const [one] = first.filedAt();
  /**
   * ⚠ **THE POSITION HALF AND NOTHING ELSE.** `agent.delegations.step` is capped at 64
   * characters and `ctx.operation` is a uuid, a position and a hash — well past it. What the
   * key has to be is the SAME on every redelivery of this call and different from the step
   * beside it, which the position is and the hash is not (a model may write the same
   * arguments twice at different positions).
   */
  assert.equal(one.step, "d4.2");
  assert.ok(one.step.length <= 64, "the step key would be refused by its own column");
  // TWO TASKS IN ONE BATCH ARE TWO CHILDREN, so the position is part of each id.
  assert.equal(new Set(one.children.map((c) => c.id)).size, 2);
  assert.equal(new Set(one.children.map((c) => c.run_id)).size, 2);
  // AND A CHILD'S OWN ids ARE NOT THE SPECIALIST'S, which is the shape a careless
  // derivation reaches for first.
  for (const c of one.children) {
    assert.notEqual(c.id, SPEC);
    assert.notEqual(c.run_id, SPEC);
    assert.match(c.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  }

  // ⚠ **THE SAME OPERATION ASKS FOR THE SAME CHILDREN** — which is what makes `open`
  // absorbing safe, because a second delivery presents the ids the first one filed.
  const again = seam();
  await t.run({ tasks: [{ specialist: SPEC, task: "one" }, { specialist: SPEC, task: "two" }] },
              { delegation: again.to, operation: op });
  const [two] = again.filedAt();
  assert.equal(two.step, one.step);
  assert.deepEqual(two.children.map((c) => c.id), one.children.map((c) => c.id));
  assert.deepEqual(two.children.map((c) => c.run_id), one.children.map((c) => c.run_id));

  // THE CONTROL: a DIFFERENT call is a different set, or "derived" is satisfied by a
  // constant — and a constant would make every delegating step in the deployment collide on
  // one child id.
  const other = seam();
  await t.run({ tasks: [{ specialist: SPEC, task: "one" }] },
              { delegation: other.to, operation: `${RUN}:5:0:abcd1234` });
  const [third] = other.filedAt();
  assert.equal(third.step, "d5.0");
  assert.notEqual(third.children[0].id, one.children[0].id);
});

test("⚠ NO IDENTITY MEANS NOTHING IS FILED — and the observer is that the door was never reached", async () => {
  const t = delegateTool();
  for (const op of [undefined, null, "", "not-an-operation", 7, ["a:b:c:d"], `${RUN}:4:2`]) {
    const s = seam();
    const out = await t.run({ tasks: [{ specialist: SPEC, task: "one" }] },
                            { delegation: s.to, operation: op });
    assert.equal(out.ok, false, `operation ${JSON.stringify(op)} was accepted`);
    assert.equal(out.error, "no-id");
    // ⚠ NOTHING WAS FILED, which is the half a status code cannot carry: children filed
    // under an invented key are children a redelivery can never find again.
    assert.deepEqual(s.filedAt(), [], `operation ${JSON.stringify(op)} filed children`);
    assert.ok(!out[WAITING_MARK], "a refusal suspended the run");
  }
  // THE CONTROL, or "nothing was filed" is satisfied by a tool that files nothing ever.
  const good = seam();
  await t.run({ tasks: [{ specialist: SPEC, task: "one" }] },
              { delegation: good.to, operation: OP() });
  assert.equal(good.filedAt().length, 1);
});

test("⚠ A PARTLY-WRONG BATCH IS REFUSED WHOLE, NEVER AS A PREFIX", async () => {
  const t = delegateTool();
  const s = seam({ roster: [spec(SPEC), spec(SPEC2, { status: "paused" })] });
  const out = await t.run({
    tasks: [
      { specialist: SPEC, task: "this one is fine" },
      { specialist: "nobody", task: "x" },
      { specialist: SPEC, task: "" },
      { specialist: SPEC2, task: "x" },
      "not an entry",
      { task: "no specialist named" },
    ],
  }, { delegation: s.to, operation: OP() });

  assert.equal(out.ok, false);
  assert.equal(out.error, "bad-tasks");
  // ⚠ **NOTHING WAS FILED, although the first task was perfectly good.** A prefix would
  // start real work for a step whose answer nobody can use, and the door itself keeps the
  // same rule in a subtransaction.
  assert.deepEqual(s.filedAt(), []);
  // EVERY REFUSAL IS NAMED, AT ITS OWN POSITION, so a model can fix the one that is wrong
  // rather than re-reading six tasks.
  assert.deepEqual(out.refused, [
    { at: 1, why: "unknown-specialist" },
    { at: 2, why: "no-task" },
    { at: 3, why: "specialist-paused" },
    { at: 4, why: "not-an-entry" },
    { at: 5, why: "no-specialist" },
  ]);
  // ⚠ ONE-BASED IN THE SENTENCE, because the list it names is the one the model wrote.
  assert.match(out.say, /task 2: unknown-specialist/);
  assert.match(out.say, /task 6: no-specialist/);
  assert.ok(!out.say.includes("task 0"), "the sentence counts from zero");
  // A CONTEXT ENTRY THAT CANNOT TRAVEL REFUSES THE WHOLE BATCH TOO, and its NAME is
  // carried: dropping it means a specialist asked to do a job without the thing it was
  // meant to be told, which is indistinguishable from a specialist that ignored it.
  const ctxBad = seam();
  const ctxOut = await t.run({
    tasks: [{ specialist: SPEC, task: "fine",
              context: [{ kind: "secret", name: "stripe", value: "sk" }] }],
  }, { delegation: ctxBad.to, operation: OP() });
  assert.equal(ctxOut.ok, false);
  assert.deepEqual(ctxBad.filedAt(), []);
  assert.deepEqual(ctxOut.refused, [{ at: 0, why: "secret-never-delegated", name: "stripe" }]);
});

test("⚠ A TASK AT `TASK_MAX` IS ACCEPTED AND ONE OVER IS REFUSED — the column's own bound", async () => {
  const t = delegateTool();
  // THE BOUND IS THE COLUMN'S, not a number chosen here: `agent.delegations.task` is
  // `check (length(btrim(task)) between 1 and 4000)`, so a tool that admitted more would
  // have the refusal arrive as a raise from inside the filing transaction rather than as a
  // sentence a model can act on.
  const at = seam();
  const ok = await t.run({ tasks: [{ specialist: SPEC, task: "x".repeat(TASK_MAX) }] },
                         { delegation: at.to, operation: OP() });
  assert.notEqual(ok.error, "task-too-long", `a task of exactly ${TASK_MAX} was refused`);
  assert.equal(at.filedAt().length, 1);
  assert.equal(at.filedAt()[0].children[0].task.length, TASK_MAX);

  const over = seam();
  const no = await t.run({ tasks: [{ specialist: SPEC, task: "x".repeat(TASK_MAX + 1) }] },
                         { delegation: over.to, operation: OP() });
  assert.equal(no.ok, false);
  assert.deepEqual(no.refused, [{ at: 0, why: "task-too-long" }]);
  assert.deepEqual(over.filedAt(), []);
  // AND THE SCHEMA SAYS SO TOO, so a model is told the bound rather than having to find it.
  assert.equal(delegateTool().input.properties.tasks.items.properties.task.maxLength, TASK_MAX);
});

test("⚠ AN UNKNOWN TOOL NAME IS DROPPED AND NAMED, and the child still files", async () => {
  const t = delegateTool();
  const s = seam({ roster: [spec(SPEC, { tools: ["remember", "forget"] })] });
  const out = await t.run({
    tasks: [{ specialist: SPEC, task: "do it", tools: ["remember", "send_message", "delegate"] }],
  }, { delegation: s.to, operation: OP() });

  // ⚠ **NAMED AND DROPPED, NOT REFUSED.** A grant naming a tool the specialist has not got
  // asks for LESS than it meant to, which is the safe direction — so the child runs with
  // what it really may use, and refusing a whole batch over one mistyped name would leave a
  // model unable to delegate at all.
  const [filed] = s.filedAt();
  assert.equal(filed.children.length, 1, "the child was not filed");
  assert.deepEqual(filed.children[0].tools, ["remember"]);
  // A FILTER IS A SILENT DROP AND A CHECK IS A SENTENCE: the caller is told which, and at
  // which task, and for which specialist.
  assert.deepEqual([...out.dropped].sort((a, b) => a.tool.localeCompare(b.tool)), [
    { at: 0, tool: "delegate", specialist: SPEC },
    { at: 0, tool: "send_message", specialist: SPEC },
  ]);
  // ⚠ **AND `withheld` IS DELIBERATELY NOT REPORTED FROM HERE.** This tool cannot see the
  // account's revocations at all — the DATABASE subtracts them inside the filing
  // transaction — so a `withheld` key here could only ever be empty, which is an absence
  // wearing a value's clothes.
  assert.ok(!Object.hasOwn(out, "withheld"));

  // THE CONTROL: a clean grant carries no `dropped` key at all, so its presence means
  // something rather than being a field a reader has to check for emptiness.
  const clean = seam({ roster: [spec(SPEC, { tools: ["remember", "forget"] })] });
  const fine = await t.run({ tasks: [{ specialist: SPEC, task: "do it", tools: ["forget"] }] },
                           { delegation: clean.to, operation: OP() });
  assert.ok(!Object.hasOwn(fine, "dropped"));
  assert.deepEqual(clean.filedAt()[0].children[0].tools, ["forget"]);
  // GRANTING NOTHING IS GIVING NOTHING, which is what the schema's own description says.
  const none = seam({ roster: [spec(SPEC, { tools: ["remember"] })] });
  await t.run({ tasks: [{ specialist: SPEC, task: "do it" }] },
              { delegation: none.to, operation: OP() });
  assert.deepEqual(none.filedAt()[0].children[0].tools, []);
});

test("⚠ THE ANSWER IS READ FROM THE ROWS, NEVER FROM WHAT WAS JUST FILED", async () => {
  const t = delegateTool();
  /**
   * ⚠ **THE FIXTURE MAKES THE TWO DISAGREE ON PURPOSE.** `open` answers two children as
   * though they had just been filed and `look` answers what is really on record — a child
   * that has settled and one still running. A tool that composed its answer from `filed`
   * would report both as new work every delivery, and on a redelivery would lose an answer
   * that had arrived since.
   */
  const rows = [
    child(0, { settled_at: "2026-09-22T00:00:00Z", outcome: { ok: true, result: { found: 3 } } }),
    child(1, { claimed_at: "2026-09-22T00:00:00Z" }),
  ];
  const s = seam({ rows });
  const out = await t.run({ tasks: [{ specialist: SPEC, task: "a" }, { specialist: SPEC, task: "b" }] },
                          { delegation: s.to, operation: OP() });

  // ⚠ THE WAITING MARKER, which is what lets `run.mjs` hold the run — and the parent holds
  // NO open request while its specialists work, which is the requirement rather than an
  // optimisation.
  assert.equal(out[WAITING_MARK], true);
  assert.equal(isWaiting(out), true);
  assert.ok(!Object.hasOwn(out, "ok"), "an unfinished call answered a verdict as well");
  // WHICH CHILDREN ARE STILL WORKING, BY INDEX, so a reader can name them: two specialists
  // can share a name and the index is the one thing tying an answer back.
  assert.deepEqual(out.working, [1]);
  assert.equal(out.counts.done, 1);
  assert.equal(out.counts.running, 1);
  assert.match(out.say, /1 of 2 specialist\(s\) have answered/);
  // AND `look` REALLY WAS ASKED, or the whole case is about a fixture nobody read.
  assert.equal(s.calls.filter((c) => c.op === "look").length, 1);
  assert.ok(s.calls.findIndex((c) => c.op === "look") > s.calls.findIndex((c) => c.op === "open"),
    "the rows were read before the children were filed");
});

test("⚠ ONCE EVERY CHILD HAS SETTLED, THE COMBINATION IS THE ANSWER", async () => {
  const t = delegateTool();
  const rows = [
    child(0, { agent_name: "reader", settled_at: "x", outcome: { ok: true, result: { found: 3 } } }),
    child(1, { agent_name: "writer", settled_at: "x", outcome: { ok: true, result: "a draft" } }),
  ];
  const s = seam({ rows });
  const out = await t.run({ tasks: [{ specialist: SPEC, task: "read" }, { specialist: SPEC, task: "write" }] },
                          { delegation: s.to, operation: OP() });

  assert.ok(!out[WAITING_MARK], "a finished delegation suspended the run");
  assert.equal(out.ok, true);
  assert.equal(out.policy, "all");
  // DETERMINISTIC BY INDEX, and each specialist's own answer carried as it came — nothing
  // here interprets it.
  assert.deepEqual(out.results, [
    { index: 0, agent: "reader", result: { found: 3 } },
    { index: 1, agent: "writer", result: "a draft" },
  ]);
  // EVERY CHILD IS ON THE ROSTER, so the difference between what came back and what was
  // asked for is never invisible.
  assert.deepEqual(out.specialists.map((r) => `${r.index}:${r.agent}:${r.state}`),
    ["0:reader:done", "1:writer:done"]);
  assert.match(out.say, /2 of 2 specialist\(s\) answered/);

  // ⚠ AND A FAILURE IS SAID RATHER THAN CARRIED AS A RESULT: under `all` the step does not
  // go on, the roster still names the child, and `results` holds only what was delivered.
  const partial = seam({ rows: [rows[0], child(1, { agent_name: "writer", settled_at: "x", outcome: { ok: false } })] });
  const no = await t.run({ tasks: [{ specialist: SPEC, task: "read" }, { specialist: SPEC, task: "write" }] },
                         { delegation: partial.to, operation: OP() });
  assert.equal(no.ok, false);
  assert.equal(no.error, "not-all-delivered");
  assert.deepEqual(no.results.map((r) => r.index), [0]);
  assert.deepEqual(no.specialists.map((r) => r.state), ["done", "failed"]);
  assert.match(no.say, /needs every one/);
  // AND THE POLICY IS THE CALLER'S TO STATE: with `best_effort` the same results carry on.
  const carried = seam({ rows: [rows[0], child(1, { settled_at: "x", outcome: { ok: false } })] });
  const on = await t.run({ policy: "best_effort",
    tasks: [{ specialist: SPEC, task: "read" }, { specialist: SPEC, task: "write" }] },
    { delegation: carried.to, operation: OP() });
  assert.equal(on.ok, true);
  assert.equal(on.policy, "best_effort");
  assert.equal(on.counts.failed, 1, "the failure was not reported");
});

test("⚠ A REFUSAL FROM THE DOOR IS CARRIED WITH ITS OWN SENTENCE, never as a success", async () => {
  const t = delegateTool();
  // The bounds are the DATABASE's, so what arrives here is a verdict it already reached —
  // and each needs a different thing done about it, which is why it is a sentence rather
  // than a code the model has to look up.
  for (const [filed, needle] of [
    [{ ok: false, error: "too-deep", depth: 3, limit: 2 }, /levels deep/],
    [{ ok: false, error: "too-many-children", asked: 9, limit: 4 }, /9 tasks/],
    [{ ok: false, error: "tree-full", held: 32, limit: 32 }, /whole budget/],
    [{ ok: false, error: "parent-stopped" }, /already stopped/],
    [{ ok: false, error: "self-delegation", at: 0 }, /task 1/],
  ]) {
    const s = seam({ filed });
    const out = await t.run({ tasks: [{ specialist: SPEC, task: "x" }] },
                            { delegation: s.to, operation: OP() });
    assert.equal(out.ok, false, `${filed.error} was read as a success`);
    assert.equal(out.error, filed.error);
    assert.match(out.say, needle);
    // AND THE ROWS ARE NOT READ AFTER A REFUSAL: there is nothing to combine, and asking
    // would report a step that filed nothing as one waiting for children.
    assert.equal(s.calls.filter((c) => c.op === "look").length, 0);
    assert.ok(!out[WAITING_MARK]);
  }
  // AN ANSWER THIS CANNOT READ AT ALL IS A REFUSAL WITH A NAME rather than a success:
  // cannot-tell must never read as a value, and the value here is work having started.
  for (const filed of [null, undefined, {}, { ok: "true" }, "ok", 7]) {
    const s = seam({ filed });
    const out = await t.run({ tasks: [{ specialist: SPEC, task: "x" }] },
                            { delegation: s.to, operation: OP() });
    assert.equal(out.ok, false, `${JSON.stringify(filed)} was read as a success`);
    assert.equal(typeof out.say, "string");
    assert.ok(out.say.length > 10);
  }
});

test("⚠ `list_specialists` IS THE READ THAT MAKES THE WRITE USABLE", async () => {
  const t = specialistsTool();
  // WITHOUT IT `delegate` IS A CONTROL WHOSE ONE REQUIRED ARGUMENT NOBODY CAN SUPPLY: a
  // model cannot know an id it was never told.
  assert.ok(delegateTool().input.properties.tasks.items.required.includes("specialist"));
  assert.equal(t.writes, false, "a read declares writes");
  assert.equal(t.repeatable, true);

  const s = seam({ roster: [spec(SPEC), spec(SPEC2, { status: "paused" })] });
  const out = await t.run({}, { delegation: s.to });
  assert.equal(out.ok, true);
  assert.equal(out.count, 2);
  // THE ROWS AS THEY CAME — nothing here reshapes what the database said about another
  // agent, so a field added to that function reaches the model without a second reader.
  assert.deepEqual(out.specialists, [spec(SPEC), spec(SPEC2, { status: "paused" })]);
  // ⚠ A PAUSED SPECIALIST IS LISTED SO A MODEL CAN SAY WHY IT CANNOT BE ASKED, and the
  // count of those TAKING work is said apart from the count that exist.
  assert.match(out.say, /2 specialist\(s\), 1 taking work/);

  // AN EMPTY ACCOUNT IS ITS OWN SENTENCE, not a zero a model has to interpret: "there is
  // nobody to hand work to" is actionable and `0` is not.
  const empty = seam({ roster: [] });
  const none = await t.run({}, { delegation: empty.to });
  assert.equal(none.ok, true);
  assert.equal(none.count, 0);
  assert.match(none.say, /no other agents/);
  // AND A STATUS IT CANNOT READ IS NOT "taking work" — fail closed, because the other
  // direction invites a model to ask a specialist the door will refuse.
  const odd = seam({ roster: [spec(SPEC, { status: "ACTIVE" }), spec(SPEC2, { status: undefined })] });
  assert.match((await t.run({}, { delegation: odd.to })).say, /2 specialist\(s\), 0 taking work/);
});

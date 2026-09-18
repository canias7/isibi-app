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
import { CAPABILITY_TOOLS, AUTHORABLE_SCHEDULES } from "../src/capability-tools.mjs";
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
  const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : { ok: true, id: AUTO }));
  const ops = can.forTenant(T).forAgent(AG);
  const drive = {
    searchKnowledge: [{ query: "x" }], listKnowledge: [], readKnowledge: [{ id: AUTO }],
    listMemory: [], saveMemory: [{ name: "a", value: "b", operation: OP() }],
    deleteMemory: [{ name: "a", operation: OP() }],
    listAutomations: [], readAutomation: [{ id: AUTO }],
    createAutomation: [{ id: AUTO, name: "x", steps: [], operation: OP() }],
    updateAutomation: [{ id: AUTO, name: "y", operation: OP() }],
    setAutomationEnabled: [{ id: AUTO, enabled: false, operation: OP() }],
    startAutomation: [{ id: AUTO, runId: AUTO, operation: OP() }],
    listExecutions: [{ automation: AUTO }], readExecution: [{ id: AUTO }],
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
  let asked = 0;
  for (const t of CAPABILITY_TOOLS) {
    if (NEEDS_NO_BACKEND.includes(t.name)) continue;
    asked++;
    for (const ctx of [undefined, {}, { capabilities: null }, { capabilities: "nope" }]) {
      const out = await t.run({ query: "x", id: AG, name: "n", value: "v", automation: AG, enabled: true }, ctx);
      assert.equal(out.ok, false, `${t.name} answered ok with no backend`);
      assert.equal(out.error, "no-backend", `${t.name}: ${JSON.stringify(out)}`);
      assert.match(out.say, /no store behind it/);
    }
  }
  assert.equal(asked, CAPABILITY_TOOLS.length - NEEDS_NO_BACKEND.length);
  assert.ok(asked > 0, "the census asked about nothing");
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
  assert.equal(CAPABILITY_WRITES.length, 6, "the list of writes moved");

  const touched = new Map();
  for (const t of CAPABILITY_TOOLS) {
    const asked = [];
    // Every operation, answering the shape its caller reads, and recording its own name.
    // A LIST for the listers, a row for the readers, `{ok: true}` for the writers.
    const can = {};
    for (const op of CAPABILITIES) {
      can[op] = async () => {
        asked.push(op);
        if (op.startsWith("list") || op === "searchKnowledge") return [];
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
    assert.equal(asked.length > 0, true, `${t.name} reached no capability, so its flag is unproved`);
    touched.set(t.name, asked);
    const writes = asked.some((op) => CAPABILITY_WRITES.includes(op));
    assert.equal(t.writes, writes,
      `${t.name} touched [${asked.join(", ")}] and declares writes: ${t.writes}`);
  }
  // EVERY TOOL WAS LOOKED AT, derived from the catalog rather than pinned to a number.
  assert.equal(touched.size + 2, CAPABILITY_TOOLS.length,
    `${touched.size} tools touched a capability out of ${CAPABILITY_TOOLS.length}, with 2 platform-only`);
  // AND BOTH DIRECTIONS ARE REALLY EXERCISED, or the equality above is satisfied by every
  // tool being a read.
  const writers = [...touched.keys()].filter((n) => CAPABILITY_TOOLS.find((t) => t.name === n).writes);
  assert.deepEqual(writers.sort(),
    ["change_automation", "forget", "make_automation", "pause_automation", "remember", "run_automation"]);
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
  const had = recorder(() => ({ ok: true, forgot: true }));
  const out = await tool.run({ name: "tone" }, { capabilities: had.can.forTenant(T).forAgent(AG), operation: OP() });
  assert.equal(out.forgot, true, "a fact really removed was reported as absent");
  assert.equal(out.say, "forgotten");
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
  const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : { ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  const drive = {
    saveMemory: { name: "a", value: "b" },
    deleteMemory: { name: "a" },
    createAutomation: { id: AUTO, name: "x", steps: [] },
    updateAutomation: { id: AUTO, name: "y" },
    setAutomationEnabled: { id: AUTO, enabled: false },
    startAutomation: { id: AUTO, runId: AUTO },
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
  assert.deepEqual(sent.filter((x) => /^update_automation/.test(x.rpc)), [], "a sibling's automation was rewritten");
  // AND THE CONTROL: the same call for THIS agent's own row goes through, so the refusal is
  // about whose it is rather than about the call.
  const mine = await stepsOf(change, { id: AUTO, name: "n", steps: [{ type: "note", text: "x" }] },
    (fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : { ok: true, id: AUTO }));
  assert.equal(mine.out.ok, true, JSON.stringify(mine.out));
  assert.ok(mine.sent.some((x) => /^update_automation/.test(x.rpc)));
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
  // THE SET IS NARROWER THAN THE PLATFORM'S ON PURPOSE, and asserted so: a set that grew to
  // every schedule would make the refusal unreachable and the tool a control that answers.
  assert.deepEqual([...AUTHORABLE_SCHEDULES], ["manual", "daily"]);
  for (const wider of AUTOMATION_SCHEDULES) {
    if (AUTHORABLE_SCHEDULES.includes(wider)) continue;
    assert.ok(["weekly", "once"].includes(wider), `an unexpected schedule ${wider} exists`);
  }
  assert.ok(AUTHORABLE_SCHEDULES.length < AUTOMATION_SCHEDULES.length,
    "the authorable set is every schedule the platform has, so the refusal is unreachable");

  for (const name of ["make_automation", "change_automation"]) {
    const tool = CAPABILITY_TOOLS.find((t) => t.name === name);
    assert.ok(tool, `${name} is not a tool`);
    const { can, sent } = recorder((fn) => (fn === "read_automation" ? { id: AUTO, agent: AG } : { ok: true, id: AUTO }));
    const ops = can.forTenant(T).forAgent(AG);
    const args = { id: AUTO, name: "n", steps: [{ type: "note", text: "hi" }] };

    // REFUSED BY NAME, WITH THE LIST, and NOTHING IS WRITTEN — which is what makes it a
    // refusal rather than a failed attempt somebody has to undo.
    for (const asked of ["weekly", "once", "hourly", "DAILY", ["daily"], 7, "", "  "]) {
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
      assert.match(out.say, /manual or daily/, `the refusal does not say what it can set: ${out.say}`);
      // ⚠ THREE REFUSALS, THREE SENTENCES. A schedule that EXISTS and this tool cannot set,
      // one that did not arrive as a word, and a blank need different things done about them —
      // and the blank's needs its own, because the list's reads "; has to be set on the
      // screen" with nothing in front of the semicolon.
      if (typeof asked !== "string") assert.match(out.say, /as a word/, out.say);
      else if (!asked.trim()) assert.match(out.say, /^say when it runs/, out.say);
      else assert.match(out.say, /has to be set on the screen/, out.say);
      assert.equal(sent.filter((r) => r.rpc.endsWith("_once")).length, before,
        `${name} wrote something for a refused schedule`);
    }

    // ⚠ THE TWO CONTROLS, without which "it refuses" is satisfied by a tool that refuses
    // everything: the two schedules it CAN set go through, and the one it stores is the one
    // that was asked for rather than whatever the default is.
    for (const asked of ["manual", "daily"]) {
      const out = await tool.run({ ...args, schedule: asked, atLocal: "09:00" }, { capabilities: ops, operation: OP() });
      assert.equal(out.ok, true, `${name} refused ${asked}: ${JSON.stringify(out)}`);
      const req = sent.filter((r) => r.rpc.endsWith("_once")).at(-1);
      assert.equal(req.body.p_schedule, asked, `${name} stored ${req.body.p_schedule} for ${asked}`);
    }
    // AND AN ABSENT ONE IS `manual`, the same default the site's own reader has: making an
    // automation is not asking for it to be scheduled.
    const bare = await tool.run(args, { capabilities: ops, operation: OP() });
    assert.equal(bare.ok, true, JSON.stringify(bare));
    assert.equal(sent.filter((r) => r.rpc.endsWith("_once")).at(-1).body.p_schedule, "manual");
  }
});

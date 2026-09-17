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
import { makeCapabilities, CAPABILITIES, CAPABILITY_RPC, CAP_MEMORIES, CAP_AUTOMATIONS } from "../src/capabilities.mjs";
import { CAPABILITY_TOOLS } from "../src/capability-tools.mjs";
import { OFFERED, OFFERED_NAMES } from "../src/agents.mjs";
import { PUBLIC } from "../src/define.mjs";

const T = "tenant-one";
const AG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const AUTO = "33333333-3333-4333-8333-333333333333";
const MIGRATIONS = path.join(import.meta.dirname, "..", "supabase", "migrations");

/** A backend that records what went out and answers whatever the case wants back. */
function recorder(answer = () => ({})) {
  const sent = [];
  const can = makeCapabilities({
    url: "http://local", key: "service-key",
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body);
      sent.push({ rpc: url.split("/rpc/")[1], body, headers: opts.headers });
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
    const answer = await ops.setAutomationEnabled({ id: AG, enabled: bad });
    assert.equal(answer.ok, false, `enabled accepted ${JSON.stringify(bad)}`);
    assert.equal(answer.error, "bad-enabled");
    assert.equal(sent.filter((c) => c.rpc === "set_automation_enabled").length, 0,
      `${JSON.stringify(bad)} reached the database`);
  }
  sent.length = 0;
  await ops.setAutomationEnabled({ id: AG, enabled: false });
  assert.equal(sent.filter((c) => c.rpc === "set_automation_enabled").length, 1, "a real false was refused too");
});

test("the caps this side passes are the ones the operations send", async () => {
  const { can, sent } = recorder(() => ({ ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  await ops.saveMemory({ name: "a", value: "b" });
  assert.equal(sent.at(-1).body.p_max, CAP_MEMORIES);
  await ops.createAutomation({ id: AG, name: "x", steps: [] });
  assert.equal(sent.at(-1).body.p_max, CAP_AUTOMATIONS);
});

test("⚠ the profile header is derived from the DIRECTION, not from the call site", async () => {
  const { can, sent } = recorder(() => ({ ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  await ops.listMemory();
  assert.equal(sent.at(-1).headers["accept-profile"], "agent");
  assert.equal(sent.at(-1).headers["content-profile"], undefined, "a read carried a write header");
  await ops.saveMemory({ name: "a", value: "b" });
  assert.equal(sent.at(-1).headers["content-profile"], "agent");
  assert.equal(sent.at(-1).headers["accept-profile"], undefined,
    "a write carried the read header — which PostgREST ignores, so it would resolve against `public`");
});

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

test("⚠ A TOOL WITH NO BACKEND REFUSES BY NAME — it does not answer as though it worked", async () => {
  for (const t of CAPABILITY_TOOLS) {
    for (const ctx of [undefined, {}, { capabilities: null }, { capabilities: "nope" }]) {
      const out = await t.run({ query: "x", id: AG, name: "n", value: "v", automation: AG, enabled: true }, ctx);
      assert.equal(out.ok, false, `${t.name} answered ok with no backend`);
      assert.equal(out.error, "no-backend", `${t.name}: ${JSON.stringify(out)}`);
      assert.match(out.say, /no store behind it/);
    }
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
  assert.equal(CAPABILITY_TOOLS.length, 12, "the census is looking at the whole catalog");
});

test("⚠ `remember` SETS `source: run` ITSELF, and a model cannot claim a person typed it", async () => {
  const { can, sent } = recorder(() => ({ ok: true, saved: "created", memory: {} }));
  const ops = can.forTenant(T).forAgent(AG);
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "remember");
  await tool.run({ name: "tone", value: "plain", source: "person" }, { capabilities: ops });
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
    { capabilities: a.can.forTenant(T).forAgent(AG), operation: "run-7:1:0", newId: () => "ours" });
  assert.equal(out.ok, true, JSON.stringify(out));
  const first = a.sent.at(-1).body.p_run_id;
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    `the derived id is not a uuid: ${first}`);
  assert.notEqual(first, "ours", "a minted id was used where a derived one exists");
  assert.notEqual(first, "chosen-by-the-model", "a model named the run it started");
  assert.equal(tool.input.properties.runId, undefined, "the schema offers the model an id");

  // THE SAME CALL AGAIN IS THE SAME EXECUTION — which is the whole of the guarantee.
  const b = mk();
  await tool.run({ id: AG }, { capabilities: b.can.forTenant(T).forAgent(AG), operation: "run-7:1:0" });
  assert.equal(b.sent.at(-1).body.p_run_id, first, "a redelivery asked for a different execution");
  // AND A DIFFERENT CALL IS A DIFFERENT ONE, or every call in a run would collide.
  const c = mk();
  await tool.run({ id: AG }, { capabilities: c.can.forTenant(T).forAgent(AG), operation: "run-7:1:1" });
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
  assert.equal(d.sent.filter((x) => x.rpc === "run_automation").length, 0, "a refused call still started one");
});
test("⚠ `forget` SAYS WHETHER THERE WAS ONE — a name got wrong is not a thing removed", async () => {
  // MEASURED: a mutant hardcoding `forgot: true` SURVIVED, and the answer it produced was
  // self-contradictory — `forgot: true` beside "there was nothing remembered under that
  // name". Nothing drove a forget of a name that was not there.
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "forget");
  const nothing = recorder(() => ({ ok: true, forgot: false }));
  const gone = await tool.run({ name: "tone" }, { capabilities: nothing.can.forTenant(T).forAgent(AG) });
  assert.equal(gone.ok, true, "a name that was not there is not a failure");
  assert.equal(gone.forgot, false, "forgetting nothing was reported as having removed something");
  assert.match(gone.say, /nothing remembered under that name/);

  // THE CONTROL, without which `forgot: false` is satisfied by a tool that always says so.
  const had = recorder(() => ({ ok: true, forgot: true }));
  const out = await tool.run({ name: "tone" }, { capabilities: had.can.forTenant(T).forAgent(AG) });
  assert.equal(out.forgot, true, "a fact really removed was reported as absent");
  assert.equal(out.say, "forgotten");
});

test("a refusal from the database is passed on as a sentence, never as a success", async () => {
  const { can } = recorder((fn) => (fn === "save_memory" ? { ok: false, error: "too-many" } : { ok: true }));
  const ops = can.forTenant(T).forAgent(AG);
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "remember");
  const out = await tool.run({ name: "tone", value: "plain" }, { capabilities: ops });
  assert.equal(out.ok, false);
  assert.equal(out.error, "too-many");
  assert.match(out.say, /forget something first/);
});

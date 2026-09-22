// The agent builder's storage API — the wall being the tenant, and nothing else.
//
// WHAT THIS FILE IS ABOUT. Seven operations that read and write one account's
// agents and conversations, with a SERVICE credential that bypasses row level
// security. That last clause is the whole reason this file is long: on this path
// RLS protects nobody, because `service_role` carries BYPASSRLS — so the only
// thing standing between one customer and another's written instructions is the
// `tenant_id=eq.` filter this code puts in the URL, and the fact that the value
// in it came from a token GoTrue verified.
//
// **A SUITE THAT ONLY EVER SIGNS IN AS ONE ACCOUNT CANNOT SEE ANY OF THAT.**
// Every query would look right, every test would pass, and a missing filter
// would hand back the whole table. So the cases below are mostly about the
// REQUEST THAT WENT OUT rather than the answer that came back: which tenant is
// on the wire, which filter, and what happens to a caller who names somebody
// else's agent or puts an account id in the body.
//
// It drives `worker.fetch` as well as the module. The wiring layer is this
// repository's most repeated defect — twelve-plus features shipped dead with the
// module perfect and one hop cut — and a route that reads the body of a GET, or
// forgets to pass the verified id, is exactly that shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit, isUnrouted } from "./fixtures/worker-harness.mjs";
import {
  handleAgentApi, makeAgentStore, agentRow, messageRow,
  cleanText, cleanId, cleanAt, readTenant,
  AGENT_ROUTES, AGENT_POST_ROUTES, AGENT_SCHEMA, agentBodyMax,
  AGENT_NAME_MAX, AGENT_INSTRUCTIONS_MAX, AGENT_BODY_MAX,
  MAX_AGENTS, MAX_THREAD, MAX_IMPORT_MESSAGES, MAX_IMPORT_BODY, AGENT_TOOLS,
  AGENT_PROVIDERS, MAX_CONNECTIONS, CONNECTION_STATES, CONNECTION_TROUBLE,
  connectionRow, cleanScopes, providerByName,
} from "../agent-store.mjs";

const SRC = fs.readFileSync(new URL("../agent-store.mjs", import.meta.url), "utf8");
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const MIG = fs.readFileSync(new URL(
  "../agent-builder/supabase/migrations/20260915180525_agent_authored_agents_and_messages.sql",
  import.meta.url), "utf8");
const IMPORT_MIG = fs.readFileSync(new URL(
  "../agent-builder/supabase/migrations/20260915182049_agent_import_one.sql",
  import.meta.url), "utf8");

const T1 = "11111111-1111-4111-8111-111111111111";   // one account
const T2 = "22222222-2222-4222-8222-222222222222";   // the account next door
const A1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";   // T1's agent
const MID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";  // a message the send stored
const RID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";  // the run it started
const KEY = "service-key-that-must-never-be-said-out-loud";

/** A recorder in PostgREST's own answer shape: `{ok, status, text()}`. */
function recorder(answers = {}) {
  const seen = [];
  const doFetch = async (url, opts = {}) => {
    seen.push({
      url: String(url),
      method: opts.method,
      headers: opts.headers || {},
      body: opts.body === undefined ? undefined : JSON.parse(opts.body),
    });
    const hit = Object.keys(answers).find((k) => String(url).includes(k));
    const a = hit ? answers[hit] : { status: 200, body: [] };
    const status = a.status || 200;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(a.body ?? []) };
  };
  return { seen, doFetch, store: makeAgentStore({ fetch: doFetch, url: "https://db.example", key: KEY }) };
}

/** A store whose every method records and answers, with no HTTP at all. */
function fakeStore(over = {}) {
  const calls = [];
  const note = (name) => (...args) => { calls.push({ name, args }); return null; };
  const base = {
    list: async (...a) => { calls.push({ name: "list", args: a }); return []; },
    count: async (...a) => { calls.push({ name: "count", args: a }); return 0; },
    ownsAgent: async (...a) => { calls.push({ name: "ownsAgent", args: a }); return true; },
    create: async (...a) => { calls.push({ name: "create", args: a }); return { id: A1 }; },
    update: async (...a) => { calls.push({ name: "update", args: a }); return { id: A1 }; },
    remove: async (...a) => { calls.push({ name: "remove", args: a }); return true; },
    messages: async (...a) => { calls.push({ name: "messages", args: a }); return []; },
    addMessage: async (...a) => { calls.push({ name: "addMessage", args: a }); return { id: "m" }; },
    importOne: async (...a) => { calls.push({ name: "importOne", args: a }); return A1; },
    // The answer `agent.send_to_agent` really gives, taken from the schema check's
    // own driven output rather than invented — a fake in a different shape from
    // reality hides bugs exactly as well as one that is less capable.
    send: async (...a) => {
      calls.push({ name: "send", args: a });
      return {
        ok: true, repeat: false, message_id: MID, run_id: RID, body: "hello",
        seq: 1, created_at: "2026-09-15T12:00:00Z", state: "queued",
      };
    },
    // ── automations ────────────────────────────────────────────────────────
    // THE ANSWER SHAPES ARE THE ONES THE REAL FUNCTIONS GIVE, copied from this
    // migration's own driven output on a real PostgreSQL rather than invented — a
    // fake in a different shape from reality hides bugs exactly as well as one
    // that is less capable, and this file has paid for that twice.
    listAutomations: async (...a) => { calls.push({ name: "listAutomations", args: a }); return []; },
    ownsAutomation: async (...a) => { calls.push({ name: "ownsAutomation", args: a }); return true; },
    createAutomation: async (...a) => {
      calls.push({ name: "createAutomation", args: a });
      return { ok: true, id: A1, next_run_at: null };
    },
    // ⚠ `patchAutomation` WHERE THE REPLACE USED TO BE. `agent.patch_automation` answers
    // `agent.update_automation`'s own answer — it delegates the write to it — so the shape is
    // unchanged; what changed is that a fake still offering the replace would be one more
    // capable than the store, in the file whose census reads a 502 for a missing operation.
    patchAutomation: async (...a) => {
      calls.push({ name: "patchAutomation", args: a });
      return { ok: true, id: A1, next_run_at: null };
    },
    setAutomationEnabled: async (...a) => {
      calls.push({ name: "setAutomationEnabled", args: a });
      // ⚠ `agent.set_automation_enabled`'S OWN ANSWER, not a row — the toggle goes through the
      // same function the agent's `pause_automation` calls, and it RECOMPUTES `next_run_at`.
      return { ok: true, id: A1, enabled: false, next_run_at: null };
    },
    removeAutomation: async (...a) => { calls.push({ name: "removeAutomation", args: a }); return true; },
    runAutomation: async (...a) => {
      calls.push({ name: "runAutomation", args: a });
      return { ok: true, repeat: false, run_id: RID, occurrence: null, trigger: "manual", state: "queued" };
    },
    executions: async (...a) => { calls.push({ name: "executions", args: a }); return []; },
    // ⚠ AND THE ONE-EXECUTION READ BESIDE IT, which the history route asks for only when the
    // newest page does NOT hold the run somebody named — the arrival-to-run hop. A fake
    // without it made the route THROW the moment `run` reached the query, so this census read
    // a 502: the same trap `listEvents` and six others above it record, arriving through the
    // query rather than through the body. **`null` is a REAL answer** — a run that is not this
    // automation's is simply absent from the answer rather than marked on something else — so
    // driving it needs a row, and a row is what proves the branch was really entered.
    execution: async (...a) => { calls.push({ name: "execution", args: a }); return null; },
    // ── inbound endpoints ──────────────────────────────────────────────────
    // ⚠ AND THE SAME RULE A FOURTH TIME: the answer shapes are the ones
    // `agent.list_webhooks`, `create_webhook`, `set_webhook_enabled` and `delete_webhook`
    // really give, read off the migration rather than invented. A fake missing one of them
    // makes the route throw and the census reads a 502 — which is what it did.
    //
    // **AND NOT ONE OF THEM ANSWERS A SECRET, because the real functions do not.** The
    // create's own answer carries `id` and `event_name` and no key: the ROUTE mints the
    // secret and hands it back once, so a fake that returned one would be a fake teaching a
    // reader that the database can be asked for it.
    // ⚠ THE CONNECTION SIDE, because a fake missing an operation makes the route THROW and
    // this census reads a 502 — which this file has paid for four times now and which reads
    // exactly like a route that forgot its tenant.
    listConnections: async (...a) => { calls.push({ name: "listConnections", args: a }); return []; },
    connectProvider: async (...a) => { calls.push({ name: "connectProvider", args: a }); return { ok: true, id: a[1]?.id }; },
    disconnectConnection: async (...a) => { calls.push({ name: "disconnectConnection", args: a }); return { ok: true }; },
    revokeConnection: async (...a) => { calls.push({ name: "revokeConnection", args: a }); return { ok: true }; },
    listWebhooks: async (...a) => { calls.push({ name: "listWebhooks", args: a }); return []; },
    // ⚠ THE ARRIVALS READ, and a fake missing one is why this file has read a 502 five
    // times: the route throws, the census reads the status, and the failure names the wrong
    // thing entirely. Sixth time it would have.
    listEvents: async (...a) => { calls.push({ name: "listEvents", args: a }); return []; },
    // ⚠ AND THE SEVENTH TIME. `/api/agent/run-children` reads one run's specialists, so a fake
    // without `runChildren` makes the route THROW and this census reads a 502 — which names the
    // wrong thing entirely and reads exactly like a route that forgot its tenant. **It answers a
    // LIST, because `agent.delegation_progress` returns a single `jsonb` whose value is an
    // array**: a fake answering an object would be one more capable than the store, in the
    // reader whose `answerOf`-versus-`listOf` mistake made `/api/agent/webhooks` a route that
    // had never once worked.
    runChildren: async (...a) => { calls.push({ name: "runChildren", args: a }); return []; },
    createWebhook: async (...a) => {
      calls.push({ name: "createWebhook", args: a });
      return { ok: true, id: A1, event_name: "order.paid" };
    },
    setWebhookEnabled: async (...a) => {
      calls.push({ name: "setWebhookEnabled", args: a });
      return { ok: true, id: A1, enabled: true };
    },
    removeWebhook: async (...a) => { calls.push({ name: "removeWebhook", args: a }); return { ok: true, id: A1 }; },
    // ── richer workflows, reference material and memory ────────────────────
    // ⚠ AND THE SAME RULE AGAIN: `readAutomation` is what the run route asks for the
    // input DECLARATION, so a fake without it makes the route throw and the census
    // reads a 502. This file has now paid for that three times, which is why the
    // answer shapes below are the ones the real store gives rather than invented.
    readAutomation: async (...a) => {
      calls.push({ name: "readAutomation", args: a });
      return { id: A1, agentId: A1, name: "n", inputs: [], steps: [] };
    },
    decideApproval: async (...a) => {
      calls.push({ name: "decideApproval", args: a });
      return { ok: true, repeat: false, verdict: "approved", step: "s1", queued: "queued" };
    },
    listKnowledge: async (...a) => { calls.push({ name: "listKnowledge", args: a }); return []; },
    countKnowledge: async (...a) => { calls.push({ name: "countKnowledge", args: a }); return 0; },
    addKnowledge: async (...a) => {
      calls.push({ name: "addKnowledge", args: a });
      return { source: { id: A1, title: "Price list", version: 1 } };
    },
    updateKnowledge: async (...a) => {
      calls.push({ name: "updateKnowledge", args: a });
      return { id: A1, title: "Price list", version: 2 };
    },
    removeKnowledge: async (...a) => { calls.push({ name: "removeKnowledge", args: a }); return true; },
    listMemory: async (...a) => { calls.push({ name: "listMemory", args: a }); return []; },
    /**
     * ⚠ **THE SHAPE IS `agent.save_memory`'S OWN, not a row's — and that is the point of the
     * change these two fakes are about.** The site's route used to write memory with a direct
     * upsert and read a ROW back (`key`, `created_at`); it calls the same function the agent's
     * `remember` tool calls now, which answers `{ok, saved, memory:{id, name, value, version,
     * source}}`. A fake still answering a row would let the route read `undefined` for every
     * field and pass — *a fake in a different shape from its producer produces a specific wrong
     * answer*, which this file has paid for before.
     */
    saveMemory: async (...a) => {
      calls.push({ name: "saveMemory", args: a });
      return { ok: true, saved: "created",
               memory: { id: A1, name: "tone", value: "formal", version: 1, source: "person" } };
    },
    removeMemory: async (...a) => {
      calls.push({ name: "removeMemory", args: a });
      return { ok: true, forgot: true,
               affects: { futureRuns: true, acceptedRuns: false, runHistory: false },
               note: "later runs won't see it; a run already under way keeps what it started with, and the history keeps whatever it quoted" };
    },
    // ── a tool call waiting for a person ───────────────────────────────────
    // AND THE SAME RULE A FOURTH TIME: a route whose store operation this fake lacks
    // throws, and the census reads the 502 — which is the census being right about a
    // route with nothing behind it. The answer shapes are the real store's.
    listToolApprovals: async (...a) => { calls.push({ name: "listToolApprovals", args: a }); return []; },
    decideToolApproval: async (...a) => {
      calls.push({ name: "decideToolApproval", args: a });
      return { ok: true, repeat: false, id: A1, verdict: "approved", note: null, decided_by: T1 };
    },
    // ── expiry, revocation and cancellation ─────────────────────────────────
    // GROWN AGAIN rather than exempted, for the same reason as every group above: a route
    // the census drives with no fake behind it answers 502 and proves nothing about its
    // scoping. The answer shapes are the real functions'.
    revokeToolApproval: async (...a) => {
      calls.push({ name: "revokeToolApproval", args: a });
      return { ok: true, repeat: false, id: A1, run: A1 };
    },
    revokeAgentTool: async (...a) => { calls.push({ name: "revokeAgentTool", args: a }); return { ok: true, tool: "remember", withdrew: 0 }; },
    restoreAgentTool: async (...a) => { calls.push({ name: "restoreAgentTool", args: a }); return { ok: true, tool: "remember", lifted: true }; },
    listRevokedTools: async (...a) => { calls.push({ name: "listRevokedTools", args: a }); return []; },
    cancelRun: async (...a) => {
      calls.push({ name: "cancelRun", args: a });
      return { ok: true, repeat: false, run: A1, completedSteps: 0, completedCalls: 0,
               withdrewApprovals: 0, releasedWait: false, say: "stopped — it was not undone" };
    },
  };
  void note;
  return { calls, store: { ...base, ...over } };
}

const call = (path, opts = {}) => handleAgentApi({
  path, method: AGENT_ROUTES[path], tenant: T1, ...opts,
});

// ────────────────────────────────────────────────────────────────────────────
// 1. THE TENANT IS THE VERIFIED USER'S, AND THE BODY CANNOT SAY OTHERWISE
// ────────────────────────────────────────────────────────────────────────────

test("every operation is scoped by the tenant the handler was given", async () => {
  // A CENSUS, not a sample: each of the seven is driven and the tenant has to
  // reach the store. A route added later with no tenant fails by existing.
  const reached = new Set();
  for (const path of Object.keys(AGENT_ROUTES)) {
    const f = fakeStore();
    const r = await handleAgentApi({
      path, method: AGENT_ROUTES[path], tenant: T1, store: f.store,
      // ⚠ AND `run` IS IN THE QUERY AS WELL AS THE BODY, because `/api/agent/run-children` is a
      // GET and reads it from there — driven without it, a census reads the 400 that route
      // correctly gives and proves nothing about it at all.
      query: new URLSearchParams({ id: A1, agent: A1, run: A1 }),
      // `key` is the import's identity and is REQUIRED — a census that omitted
      // it drove a 400 for that route and proved nothing about its scoping.
      // ⚠ GROWN FOR THE AUTOMATION ROUTES, not exempted for them. Each needs its own
      // arguments, and a census that drove them without would prove nothing about
      // their scoping — it would just read the 400 every one of them correctly gives.
      body: {
        id: A1, key: A1, name: "N", instructions: "I", body: "hello", messages: [],
        agent: A1, enabled: true, schedule: "manual", steps: [],
        // ⚠ AND GROWN AGAIN for approvals, reference material and memory, for the same
        // reason: each of those routes needs its own arguments, and a census that drove
        // them without would read the 400 they correctly give and prove nothing.
        run: A1, step: "s1", verdict: "approved", title: "Price list", value: "formal",
        // ⚠ AND ONCE MORE for revocation and cancellation. `tool` has to be a REAL tool name,
        // because the route checks it against the catalog rather than only against the
        // grammar — a revocation of a name no tool has is a row that can never do anything.
        tool: "remember", reason: "changed my mind",
        // ⚠ AND ONCE MORE for an inbound endpoint. `event` has to be a REAL event name,
        // because the route checks its shape against the same regex the trigger reads — a
        // census that drove it without would read the 400 it correctly gives and prove
        // nothing about its scoping. **There is no `secret` here and there cannot be**: the
        // route mints one and reads none.
        event: "order.paid",
        // ⚠ AND ONCE MORE for a connected account, for the same reason and not as an
        // exemption. `provider` has to be a REAL provider, because the route looks it up in
        // `AGENT_PROVIDERS` rather than admitting any name — a connection naming a provider
        // with no adapter behind it saves, lists, and fails at every send. `scopes` has to
        // hold real permissions, because `cleanScopes` refuses one this platform does not
        // offer. Driven without either, this census would read the 400 the route correctly
        // gives and prove nothing about its scoping. **Again there is no `secret` and there
        // cannot be**: the route mints one, and unlike an endpoint's it is never answered.
        provider: AGENT_PROVIDERS[0].name, scopes: [AGENT_PROVIDERS[0].scopes[0].name],
        account: "shop@example.test", label: "The shop",
      },
      newId: () => A1,
    });
    assert.equal(r.status, 200, `${path} answered ${r.status}`);
    // The tenant is either an argument to a store call, or (for the two message
    // operations) reached the ownership question that gates them.
    const tenantSeen = f.calls.some((c) => c.args.some((a) => a === T1));
    assert.ok(tenantSeen, `${path} never handed the tenant to the store: ${JSON.stringify(f.calls.map((c) => c.name))}`);
    reached.add(path);
  }
  // COUNTED OFF THE ROUTE LIST, never a literal. This was pinned to 7 and went red
  // on the eighth route — reporting a working census as broken, which is the
  // recorded "a check that hardcodes a number the product exports is a second copy
  // of it". What the number is FOR is proving the observer drove something, so a
  // floor plus equality with the list is the property.
  assert.ok(reached.size >= 7, `the observer drove only ${reached.size} routes`);
  assert.equal(reached.size, Object.keys(AGENT_ROUTES).length, "the census did not drive every route");
});

test("⚠ THE ID IS OURS — a body cannot choose the primary key", async () => {
  // **A FIXTURE TOO SHALLOW TO SEPARATE THE TWO READINGS**, which is this
  // repository's own recorded trap and is exactly what the sweep found: the
  // census below passes `id: A1` in the body AND `newId: () => A1`, so
  // `cleanId(b.id) || mint()` and `mint()` answer the same string and a mutant
  // letting the client choose the key survived every case in the file.
  //
  // The two readings only diverge when the two ids DIFFER. A client-chosen
  // primary key is how one account writes a row at an id another account is
  // about to use, and how a retry silently overwrites rather than duplicating.
  const MINE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const THEIRS = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const f = fakeStore();
  await handleAgentApi({
    path: "/api/agent/create", method: "POST", tenant: T1, store: f.store,
    newId: () => MINE,
    body: { name: "N", instructions: "I", id: THEIRS },
  });
  const created = f.calls.find((c) => c.name === "create");
  assert.equal(created.args[1].id, MINE, "the client chose the primary key");
  assert.ok(!JSON.stringify(created.args).includes(THEIRS), "a body-supplied id reached the store");

  // The same for a message's id, which is a primary key too.
  const g = fakeStore();
  await handleAgentApi({
    path: "/api/agent/message", method: "POST", tenant: T1, store: g.store,
    newId: () => MINE, body: { id: A1, body: "hello", messageId: THEIRS },
  });
  assert.equal(g.calls.find((c) => c.name === "addMessage").args[1].id, MINE);
});

test("an account id in the body is ignored — the verified one is what is stored", async () => {
  const f = fakeStore();
  await handleAgentApi({
    path: "/api/agent/create", method: "POST", tenant: T1, store: f.store, newId: () => A1,
    body: {
      name: "Mine", instructions: "Do a thing",
      // Every spelling a browser might try. None of these may reach a query.
      tenant: T2, tenant_id: T2, uid: T2, owner: T2, owner_id: T2, account: T2, user_id: T2,
    },
  });
  const created = f.calls.find((c) => c.name === "create");
  assert.equal(created.args[0], T1, "the create was scoped to the wrong account");
  assert.ok(!JSON.stringify(created.args).includes(T2), "a body-supplied account reached the store");
});

test("no route reads an account off the body or the query — asserted over the source", () => {
  // The positive wall is the case above. This is the census that stops a NEW
  // route reintroducing it: the handler may read `b.` and `q.` for exactly the
  // fields below, and an account is not one of them.
  // ⚠ RE-ANCHORED FROM THE HANDLER ONTO THE WHOLE FILE, because a body read moved
  // into a HELPER and the window could not see it. `readStatus` and `readTools` both
  // take the body and both sit ABOVE `handleAgentApi`, so a window starting at the
  // handler forbids nothing they do — this repository's own "a route family reached
  // through a helper has no literal there", met in the census written to stop it.
  // `readTools` was already outside it before today; my own change put `b.status`
  // there too, which is what made a pre-existing blind spot load-bearing.
  //
  // SCANNING THE WHOLE FILE IS SAFE HERE AND WAS CHECKED, NOT ASSUMED: `b` names the
  // request body and nothing else in this module — there is no `(a, b)` comparator,
  // no `b` loop variable — so every `b.` really is a read of what somebody sent.
  //
  // ⚠ **AND COMMENTS ARE BLANKED FIRST, WHICH THEY WERE NOT UNTIL 2026-09-18.** This scan
  // read the raw source, so any sentence in this module that WROTE a body read — including
  // one explaining this very rule — was a match: measured, a comment about the premise above
  // reported the file as reading an account off the request. *Prose contains the thing it
  // forbids*, this repository's most repeated own-goal, met in the census whose premise is
  // about names. The blanking is LENGTH-PRESERVING, so every offset below still means what it
  // meant, and the observer-alive lines under it are what prove the blanker did not erase the
  // landmarks it is meant to leave alone.
  const blankComments = (src) => {
    let out = ""; let i = 0; let inBlock = false; let quote = "";
    while (i < src.length) {
      const c = src[i]; const nx = src[i + 1];
      if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
      if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
      if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
      if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
      out += c; i++;
    }
    return out;
  };
  const body = blankComments(SRC);
  assert.equal(body.length, SRC.length, "the blanking must preserve every offset");
  assert.ok(body.length > 500, "the source must have been found");
  const reads = [...body.matchAll(/\b[bq]\.(?:get\(")?([A-Za-z_]+)/g)].map((m) => m[1]);
  assert.ok(reads.length >= 8, `the scanner read nothing: ${reads.length}`);
  // THE OBSERVER IS ALIVE WHERE IT WAS BLIND: both helpers' reads must be in the
  // scan, or this is a wider window that still sees nothing new.
  for (const seen of ["status", "tools"]) {
    assert.ok(reads.includes(seen), `the scan missed the helper that reads b.${seen}`);
  }
  const fromHandler = SRC.slice(SRC.indexOf("export async function handleAgentApi"));
  assert.ok(!fromHandler.includes("function readStatus"), "the helpers are meant to sit above the handler");
  // ⚠ RE-ANCHORED, and the list grew by two SETTINGS rather than by an exemption.
  // `status` and `tools` are the agent's own configuration: one is checked against
  // `AGENT_STATUSES` and the other is a positive intersection with the catalog, so
  // neither can name an account and neither can name a capability the platform has
  // not got. What this census forbids is unchanged — a route reading who is asking
  // out of what they sent — and the shape of the allow-list is why adding a field
  // has to be a deliberate edit here.
  // ⚠ RE-ANCHORED AGAIN, by SIX automation fields and not by an exemption. `agent` is
  // WHICH AGENT an automation belongs to — an agent id, checked against the verified
  // tenant inside the transaction, exactly as every other route's `id` is — and it is
  // not an account: the four spellings this census exists to forbid (`tenant`, `uid`,
  // `owner`, `account`) are still not in it and the positive case above still drives
  // every one of them. `schedule`, `at`, `zone`, `steps` and `enabled` are the
  // automation's own configuration, each read through a validator that refuses rather
  // than coerces.
  const allowed = new Set(["id", "name", "instructions", "body", "at", "messages", "text", "key",
                           "status", "tools",
  // ⚠ RE-ANCHORED A THIRD TIME, by NINE fields and still not by an exemption. Every one
  // is a field of the THING being acted on: what an automation asks for (`inputs`) and the
  // answers handed to one run (`input`); which run, which step, and how it was answered
  // (`run`, `step`, `verdict`, `note`); and a source's or a memory's own contents (`title`,
  // `format`, `value`). The four spellings this census exists to forbid — `tenant`, `uid`,
  // `owner`, `account` — are still not in it, and the positive case above still drives every
  // route to prove the tenant reaches the store from the verified token alone.
                           "agent", "enabled", "schedule", "zone", "steps",
                           "inputs", "input", "run", "step", "verdict", "note", "title", "format", "value", "source",
  // ⚠ RE-ANCHORED A SIXTH TIME, by ONE field and still not by an exemption. `event` is the
  // name an inbound endpoint EMITS — a field of the endpoint being made, fixed at creation so
  // a delivery cannot choose what it triggers — and it goes through `AGENT_EVENT_RE`, the same
  // shape the trigger reads, so the two doors cannot disagree about what an event may be
  // called. **AND NOTHING READS A SECRET OFF A REQUEST AT ALL**: the route mints one, which is
  // why `secret` is not on this list and must never be.
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
  // ⚠ RE-ANCHORED A FIFTH TIME, by THREE TRIGGER fields and still not by an exemption. `days`,
  // `on_date` and `on_event` say WHEN an automation runs, exactly as `schedule`, `at` and `zone`
  // already do — and each goes through `cleanSchedule`, which refuses a day that is not a day, a
  // date that is not a day in the calendar and a name that is not an identifier, rather than
  // coercing any of them. None can name an account: the four spellings this census forbids
  // (`tenant`, `uid`, `owner`, `account`) are still not in the list, and the positive case above
  // still drives every route to prove the tenant reaches the store from the verified token alone.
                           "days", "on_date", "on_event",
  // ⚠ RE-ANCHORED A FOURTH TIME, by TWO fields and still not by an exemption. `tool` is WHICH
  // TOOL of one agent a revocation is about, and it is checked against `AGENT_TOOLS` — the
  // platform's own catalog, in code — so it cannot name an account and cannot name a capability
  // the platform has not got. `reason` is a person's own words about why they stopped a run.
  // The four spellings this census exists to forbid are still not in it, and the positive case
  // above still drives every route to prove the tenant reaches the store from the token alone.
                           "tool", "reason"]);
  const strays = [...new Set(reads)].filter((k) => !allowed.has(k));
  assert.deepEqual(strays, [], `the handler reads ${strays.join(", ")} off the request`);
});

test("a tenant the handler cannot read refuses the call rather than running unfiltered", async () => {
  for (const bad of [undefined, null, "", "  ", 7, ["a"], {}, "has space", "semi;colon", "a".repeat(201), "comma,split", "paren(1)", "quote'"]) {
    const f = fakeStore();
    const r = await handleAgentApi({ path: "/api/agent/list", method: "GET", tenant: bad, store: f.store });
    assert.equal(r.status, 401, `tenant ${JSON.stringify(bad)} was accepted`);
    assert.deepEqual(f.calls, [], `tenant ${JSON.stringify(bad)} still reached the store`);
  }
  // THE OBSERVER IS ALIVE: a real Supabase user id passes, so the refusals above
  // are about the value and not about the reader being broken.
  assert.equal(readTenant(T1), T1);
  const f = fakeStore();
  assert.equal((await handleAgentApi({ path: "/api/agent/list", method: "GET", tenant: T1, store: f.store })).status, 200);
});

// ────────────────────────────────────────────────────────────────────────────
// 2. WHAT REALLY GOES ON THE WIRE
// ────────────────────────────────────────────────────────────────────────────

test("every read and write carries a tenant filter, or asks about an agent that does", async () => {
  const cases = [
    ["list",       (s) => s.list(T1),                                   true],
    ["count",      (s) => s.count(T1),                                  true],
    ["ownsAgent",  (s) => s.ownsAgent(T1, A1),                          true],
    ["update",     (s) => s.update(T1, A1, { name: "n", instructions: "i" }), true],
    ["remove",     (s) => s.remove(T1, A1),                             true],
    // These two carry the tenant in the ROW / the argument rather than a filter:
    // a message has no tenant column, so its scoping is the ownership question
    // the handler asks first (case above) plus the agent id here.
    ["messages",   (s) => s.messages(A1),                               false],
    ["addMessage", (s) => s.addMessage(A1, { id: "m", body: "b" }),      false],
  ];
  for (const [name, run, wantsFilter] of cases) {
    const rec = recorder({ agents: { body: [{ id: A1 }] }, agent_messages: { body: [{ id: "m" }] }, agent_overview: { body: [] } });
    await run(rec.store);
    assert.equal(rec.seen.length, 1, `${name} sent ${rec.seen.length} requests`);
    const { url } = rec.seen[0];
    if (wantsFilter) {
      assert.ok(url.includes(`tenant_id=eq.${T1}`), `${name} sent no tenant filter: ${url}`);
    } else {
      assert.ok(url.includes(`agent_id=eq.${A1}`) || (rec.seen[0].body || [])[0]?.agent_id === A1,
        `${name} is not scoped to one agent: ${url}`);
    }
  }
});

test("a write that matched NO ROW answers so, and that is the whole of the 404", async () => {
  // **THE SWEEP FOUND THIS.** Every other case about "somebody else's agent"
  // drives the HANDLER against a fake store that answers `null` — so the STORE's
  // own reading of an empty result was never exercised, and
  // `agentRow(rows(r)[0] || { id })` survived. The tenant is in the filter, so a
  // stranger's id produces zero rows and this branch IS the wall: read wrongly,
  // an update of somebody else's agent comes back as a success.
  const none = recorder({ agents: { status: 200, body: [] } });
  assert.equal(await none.store.update(T1, A1, { name: "n", instructions: "i" }), null,
    "an update that matched nothing answered as though it worked");
  assert.equal(await none.store.remove(T1, A1), false,
    "a delete that removed nothing answered true");

  // THE OBSERVER IS ALIVE: one row back is a success, so the two above are about
  // the empty answer and not about the store being broken.
  const one = recorder({ agents: { status: 200, body: [{ id: A1, name: "n", instructions: "i" }] } });
  assert.equal((await one.store.update(T1, A1, { name: "n", instructions: "i" })).id, A1);
  assert.equal(await one.store.remove(T1, A1), true);

  // And more than one row is not a success either: these filters name a primary
  // key, so two rows would mean the filter did not do what it says.
  const two = recorder({ agents: { status: 200, body: [{ id: A1 }, { id: "x" }] } });
  assert.equal(await two.store.update(T1, A1, { name: "n", instructions: "i" }), null);
  assert.equal(await two.store.remove(T1, A1), false);
});

test("the create stores the tenant on the row and an id we minted", async () => {
  const rec = recorder({ agents: { status: 201, body: [{ id: A1, name: "N", instructions: "I", created_at: "2026-09-15T10:00:00Z", updated_at: "2026-09-15T10:00:00Z" }] } });
  await rec.store.create(T1, { id: A1, name: "N", instructions: "I" });
  const [row] = rec.seen[0].body;
  assert.equal(row.tenant_id, T1);
  assert.equal(row.id, A1);
  assert.ok(!("role" in row));
});

test("a message insert sends no role at all", async () => {
  // THE WALL IS THE COLUMN'S `check (role = 'user')` and its default. What this
  // asserts is that the code does not send one — because a `role` on the wire is
  // the first half of a reply this product does not have, and the moment one is
  // sent, "which speaker" becomes a decision somebody can get wrong.
  const rec = recorder({ agent_messages: { status: 201, body: [{ id: "m", body: "hi", created_at: "2026-09-15T10:00:00Z" }] } });
  await rec.store.addMessage(A1, { id: "m", body: "hi" });
  const [row] = rec.seen[0].body;
  assert.deepEqual(Object.keys(row).sort(), ["agent_id", "body", "id"]);
  assert.ok(!/\brole\b/.test(JSON.stringify(rec.seen[0])), "a role reached the wire");
});

test("PostgREST is told the agent schema, and the header matches the VERB", () => {
  // **THIS CASE ASSERTED THE DEFECT AS CORRECT.** `remove` omitted the `write`
  // flag, so the DELETE went out with `Accept-Profile` — which PostgREST ignores
  // on a write — and this case's own comment explained why that was fine: "the
  // DELETE is the one write with no body and therefore no content-profile to
  // set". That reasoning is wrong. The profile names the RELATION, not a body,
  // so every verb that changes something takes `Content-Profile`. The delete
  // resolved against `public`, where `agents` does not exist, and could never
  // have worked live.
  //
  // Re-anchored onto the property: a CENSUS over every request the store can
  // make, keyed on the verb it used. Written this way, an operation added later
  // is covered by existing, and there is no per-call flag for it to forget.
  const READ_VERBS = new Set(["GET", "HEAD"]);
  const rec = recorder({
    agents: { body: [{ id: A1, name: "n", instructions: "i" }] },
    agent_messages: { body: [{ id: "m", body: "b" }] },
    agent_overview: { body: [] },
    "rpc/import_agent": { body: A1 },
  });
  const every = [
    () => rec.store.list(T1),
    () => rec.store.count(T1),
    () => rec.store.ownsAgent(T1, A1),
    () => rec.store.messages(A1),
    () => rec.store.create(T1, { id: A1, name: "n", instructions: "i" }),
    () => rec.store.update(T1, A1, { name: "n", instructions: "i" }),
    () => rec.store.remove(T1, A1),
    () => rec.store.addMessage(A1, { id: "m", body: "b" }),
    () => rec.store.importOne(T1, { name: "n", instructions: "i", messages: [], key: A1 }),
  ];
  return Promise.all(every.map((run) => run())).then(() => {
    assert.equal(rec.seen.length, every.length, "not every operation sent a request");
    const verbs = new Set(rec.seen.map((r) => r.method));
    // THE OBSERVER IS ALIVE IN BOTH DIRECTIONS: without a read AND a write in
    // the set, one half of this census would be vacuous.
    assert.ok(verbs.has("GET"), "no read was driven, so the read half proves nothing");
    assert.ok(verbs.has("DELETE"), "the DELETE was not driven — it is the one this case exists for");
    for (const r of rec.seen) {
      const want = READ_VERBS.has(r.method) ? "accept-profile" : "content-profile";
      const other = want === "accept-profile" ? "content-profile" : "accept-profile";
      assert.equal(r.headers[want], AGENT_SCHEMA,
        `${r.method} ${r.url} sent no ${want} — it would resolve against public`);
      assert.equal(r.headers[other], undefined,
        `${r.method} ${r.url} sent ${other} as well`);
    }
  });
});

test("the profile header is derived from the verb, with no flag to forget", async () => {
  // The structural half of the fix above. A caller cannot opt out, so a new
  // operation cannot repeat the delete's mistake, and the four call sites that
  // used to pass the flag no longer carry one.
  const code = SRC.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!/write:\s*true/.test(code), "a call site still opts into the write header by hand");
  assert.ok(!/write\s*=\s*false/.test(code), "`req` still takes a write flag");
  assert.match(code, /WRITE_VERBS\.has\(method\)/, "the header is not derived from the verb");
  assert.match(code, /new Set\(\["POST", "PATCH", "PUT", "DELETE"\]\)/,
    "the write verbs are not the four that change something");
});

// ────────────────────────────────────────────────────────────────────────────
// 3. ANOTHER ACCOUNT CANNOT READ OR MODIFY
// ────────────────────────────────────────────────────────────────────────────

test("somebody else's agent and a nonexistent one are the SAME answer", async () => {
  // Two different 404s would let a stranger enumerate: "not yours" confirms the
  // id exists. The tenant is in the filter, so the store cannot tell them apart
  // either — which is the property, not a limitation.
  const notMine = fakeStore({ ownsAgent: async () => false, update: async () => null, remove: async () => false });
  const answers = [];
  answers.push(await call("/api/agent/messages", { store: notMine.store, query: new URLSearchParams({ id: A1 }) }));
  answers.push(await call("/api/agent/message", { store: notMine.store, body: { id: A1, body: "hello" } }));
  answers.push(await call("/api/agent/update", { store: notMine.store, body: { id: A1, name: "n", instructions: "i" } }));
  answers.push(await call("/api/agent/delete", { store: notMine.store, body: { id: A1 } }));
  for (const a of answers) {
    assert.equal(a.status, 404);
    assert.match(a.body.error, /isn't here any more/);
    assert.ok(!a.body.ok);
  }
  // THE OBSERVER IS ALIVE: the same four succeed for the owner.
  const mine = fakeStore();
  assert.equal((await call("/api/agent/messages", { store: mine.store, query: new URLSearchParams({ id: A1 }) })).status, 200);
  assert.equal((await call("/api/agent/message", { store: mine.store, body: { id: A1, body: "hello" }, newId: () => A1 })).status, 200);
  assert.equal((await call("/api/agent/update", { store: mine.store, body: { id: A1, name: "n", instructions: "i" } })).status, 200);
  assert.equal((await call("/api/agent/delete", { store: mine.store, body: { id: A1 } })).status, 200);
});

test("a message is never written before ownership is established", async () => {
  const order = [];
  const store = {
    ownsAgent: async () => { order.push("asked"); return false; },
    addMessage: async () => { order.push("wrote"); return { id: "m" }; },
  };
  const r = await call("/api/agent/message", { store, body: { id: A1, body: "hello" } });
  assert.equal(r.status, 404);
  assert.deepEqual(order, ["asked"], "the write happened anyway");
});

// ────────────────────────────────────────────────────────────────────────────
// 4. THE CREDENTIAL
// ────────────────────────────────────────────────────────────────────────────

test("the service key reaches a header and nothing else", async () => {
  const rec = recorder({ agent: { status: 500, body: { message: `boom while using ${KEY}` } } });
  // Every answer the handler can compose, including the failure path, must be
  // free of it — a driver error quoting the URL it was handed is exactly how a
  // credential leaks, and the failure sentence is composed from that message.
  const answers = [];
  for (const path of Object.keys(AGENT_ROUTES)) {
    answers.push(await handleAgentApi({
      path, method: AGENT_ROUTES[path], tenant: T1, store: rec.store,
      // ⚠ AND `run` IS IN THE QUERY AS WELL AS THE BODY, because `/api/agent/run-children` is a
      // GET and reads it from there — driven without it, a census reads the 400 that route
      // correctly gives and proves nothing about it at all.
      query: new URLSearchParams({ id: A1, agent: A1, run: A1 }),
      // ⚠ GROWN FOR THE AUTOMATION ROUTES, not exempted for them. Each needs its own
      // arguments, and a census that drove them without would prove nothing about
      // their scoping — it would just read the 400 every one of them correctly gives.
      body: {
        id: A1, key: A1, name: "N", instructions: "I", body: "hello", messages: [],
        agent: A1, enabled: true, schedule: "manual", steps: [],
      },
      newId: () => A1,
    }));
  }
  const said = JSON.stringify(answers);
  assert.ok(!said.includes(KEY), "the service key came back in a response body");
  assert.ok(!said.includes("service-key"), "part of the key came back");
  assert.ok(rec.seen.length > 0, "nothing was sent, so this proves nothing");
  assert.equal(rec.seen[0].headers.apikey, KEY, "the key must actually be used");
});

test("a store failure is a named refusal that keeps nothing and claims nothing", async () => {
  const logged = [];
  const store = { list: async () => { const e = new Error("connection lost"); e.status = 502; throw e; } };
  const r = await call("/api/agent/list", { store, log: (...a) => logged.push(a.join(" ")) });
  assert.equal(r.status, 502);
  assert.ok(!r.body.ok, "a failure must not answer ok");
  assert.equal(r.body.retry, true);
  assert.match(r.body.error, /nothing was lost/);
  assert.ok(logged.some((l) => l.includes("connection lost")), "the real reason was not logged");
  // An empty list is NOT an acceptable answer to a failed read: it reads to the
  // customer as "your agents are gone", which is the one thing it must not say.
  assert.ok(!("agents" in r.body), "a failed read answered with a list");
});

test("a refusal from the store is a 4xx and an outage is a 5xx", async () => {
  const four = { create: async () => { const e = new Error("bad"); e.status = 400; throw e; }, count: async () => 0 };
  const five = { create: async () => { const e = new Error("down"); e.status = 503; throw e; }, count: async () => 0 };
  const args = { body: { name: "n", instructions: "i" }, newId: () => A1 };
  assert.equal((await call("/api/agent/create", { store: four, ...args })).status, 400);
  assert.equal((await call("/api/agent/create", { store: five, ...args })).status, 502);
});

// ────────────────────────────────────────────────────────────────────────────
// 5. WHAT ARRIVES, AND WHAT IS REFUSED
// ────────────────────────────────────────────────────────────────────────────

test("a non-string field is refused, never coerced", () => {
  // `String(["a"])` is `"a"`, which has shipped as a real bug three times here.
  for (const v of [["a"], 7, true, {}, null, undefined, { toString: () => "a" }]) {
    assert.equal(cleanText(v, 100), null, `${JSON.stringify(v)} was accepted`);
  }
  assert.equal(cleanText("  Booking assistant  ", 100), "Booking assistant");
  assert.equal(cleanText("", 100), null);
  assert.equal(cleanText("   ", 100), null);
  assert.equal(cleanText("x".repeat(101), 100), null);
  assert.equal(cleanText("x".repeat(100), 100), "x".repeat(100));
});

test("an id is a uuid and nothing that could change a filter", () => {
  assert.equal(cleanId(A1.toUpperCase()), A1);
  for (const v of [
    "", "not-a-uuid", `${A1},${A1}`, `${A1})`, `eq.${A1}`, `${A1}'`, `${A1} or true`,
    ["a"], 7, null, undefined, `${A1}x`, A1.replace("-", ""),
  ]) assert.equal(cleanId(v), null, `${JSON.stringify(v)} was accepted as an id`);
});

test("a message's own time is bounded, and an unusable one reads as absent", () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);
  assert.equal(cleanAt(Date.UTC(2026, 8, 1), now), "2026-09-01T00:00:00.000Z");
  assert.equal(cleanAt(now + 30_000, now), new Date(now + 30_000).toISOString(), "a slightly fast clock is fine");
  for (const v of [undefined, null, "2026-09-01", NaN, Infinity, -1, 0, Date.UTC(2019, 0, 1), now + 120_000, ["a"]])
    assert.equal(cleanAt(v, now), null, `${JSON.stringify(v)} was accepted as a time`);
});

test("the refusals say which field, and each is its own sentence", async () => {
  const f = fakeStore();
  const cases = [
    ["/api/agent/create", { instructions: "i" }, /name/i],
    ["/api/agent/create", { name: "n" }, /what it should do/i],
    ["/api/agent/update", { name: "n", instructions: "i" }, /which agent/i],
    ["/api/agent/delete", {}, /which agent/i],
    ["/api/agent/message", { id: A1 }, /nothing to send/i],
    ["/api/agent/message", { body: "x" }, /which agent/i],
  ];
  for (const [path, body, re] of cases) {
    const r = await call(path, { store: f.store, body });
    assert.equal(r.status, 400, `${path} ${JSON.stringify(body)} answered ${r.status}`);
    assert.match(r.body.error, re);
  }
  assert.equal((await call("/api/agent/messages", { store: f.store, query: new URLSearchParams() })).status, 400);
});

test("one account cannot hold more agents than the ceiling, and is told why", async () => {
  const full = fakeStore({ count: async () => MAX_AGENTS });
  const r = await call("/api/agent/create", { store: full.store, body: { name: "n", instructions: "i" } });
  assert.equal(r.status, 409);
  assert.match(r.body.error, new RegExp(String(MAX_AGENTS)));
  assert.ok(!full.calls.some((c) => c.name === "create"), "it was created anyway");
  // The observer: one under the ceiling still works.
  const room = fakeStore({ count: async () => MAX_AGENTS - 1 });
  assert.equal((await call("/api/agent/create", { store: room.store, body: { name: "n", instructions: "i" }, newId: () => A1 })).status, 200);
});

// ────────────────────────────────────────────────────────────────────────────
// 6. THE SHAPES THE SCREEN READS
// ────────────────────────────────────────────────────────────────────────────

test("an agent arrives in the shape the list already draws", () => {
  const row = agentRow({
    id: A1, name: "Booking assistant", instructions: "Answer questions.",
    created_at: "2026-09-15T10:00:00Z", updated_at: "2026-09-15T11:00:00Z",
    last_message: "what needs reordering?",
  });
  // ⚠ THE WHOLE KEY SET, so a field added here cannot be one the screen never draws — and a
  // field REMOVED cannot be one the screen goes on reading as `undefined`.
  assert.deepEqual(Object.keys(row).sort(),
    ["created", "id", "instructions", "name", "preview", "status", "tools", "updated", "zone"]);
  assert.equal(row.created, Date.parse("2026-09-15T10:00:00Z"));
  assert.equal(row.updated, Date.parse("2026-09-15T11:00:00Z"));
  assert.equal(row.preview, "what needs reordering?");
  // NULL from the view is "" here, so the browser's own fallback to the
  // instructions runs — a correct row rather than a blank line.
  assert.equal(agentRow({ id: A1, last_message: null }).preview, "");
  assert.equal(agentRow({}).updated, 0, "an unreadable time is 0, never NaN");
  assert.ok(Number.isFinite(agentRow({ updated_at: "nonsense" }).updated));

  // ── the settings half, and BOTH DEFAULTS FAIL CLOSED ─────────────────────
  //
  // This row comes back from PostgREST, so an older Worker, a view missing a column
  // or a migration not yet applied all arrive as `undefined`. A status this cannot
  // read is `paused`: being wrong that way costs a press of Resume, and being wrong
  // the other way is an agent taking work its owner stopped. A selection it cannot
  // read is empty, for the same reason the engine reads an absent tool snapshot as
  // none.
  assert.equal(agentRow({ id: A1, status: "active", tools: ["echo"] }).status, "active");
  assert.deepEqual(agentRow({ id: A1, status: "active", tools: ["echo"] }).tools, ["echo"]);
  assert.equal(agentRow({ id: A1, status: "paused" }).status, "paused");
  assert.equal(agentRow({ id: A1 }).status, "paused", "an unreadable status read as active");
  assert.equal(agentRow({ id: A1, status: "nonsense" }).status, "paused");
  /**
   * ⚠ **AND THE ZONE FAILS CLOSED TO `null`, WHICH IS NOT `"UTC"`.** The authoring path reads
   * `null` as *ask the person which zone their schedule is in* — that refusal is the whole
   * reason this setting exists, and a default here would turn it into a guess that fires at
   * the wrong hour while every reader agrees it is right.
   */
  assert.equal(agentRow({ id: A1, zone: "Europe/London" }).zone, "Europe/London");
  assert.equal(agentRow({ id: A1, zone: "  Europe/London  " }).zone, "Europe/London", "not trimmed");
  for (const unreadable of [undefined, null, "", "   ", 7, ["Europe/London"], {}]) {
    assert.equal(agentRow({ id: A1, zone: unreadable }).zone, null, JSON.stringify(unreadable));
  }
  assert.equal(agentRow({ id: A1, status: ["active"] }).status, "paused", "an array became a status");
  assert.deepEqual(agentRow({ id: A1 }).tools, []);
  assert.deepEqual(agentRow({ id: A1, tools: "echo" }).tools, [], "a string became a selection");
  assert.deepEqual(agentRow({ id: A1, tools: ["echo", 7, null] }).tools, ["echo"],
    "a non-name was carried through as one");
});

test("a message arrives as text and a time, and carries no speaker", () => {
  const m = messageRow({ id: "m", body: "hello", created_at: "2026-09-15T10:00:00Z" });
  assert.deepEqual(Object.keys(m).sort(), ["at", "id", "text"]);
  assert.equal(m.text, "hello");
  assert.ok(!("role" in m), "a role on the wire is the first half of a fake reply");
});

test("a thread read takes the NEWEST of a long conversation and turns it round", async () => {
  // The failure this stops: ordering ascending with a limit pins a long
  // conversation to its oldest screen, so the part somebody is in is never shown.
  const newest = [
    { id: "c", body: "third", created_at: "2026-09-15T12:00:00Z", seq: 3 },
    { id: "b", body: "second", created_at: "2026-09-15T11:00:00Z", seq: 2 },
    { id: "a", body: "first", created_at: "2026-09-15T10:00:00Z", seq: 1 },
  ];
  // OFF `agent_thread`, THE VIEW — re-anchored when the read moved there, because a
  // message now comes back with the state of the run it started. The property is
  // unchanged and is what is asserted; only the relation moved.
  const rec = recorder({ agent_thread: { body: newest } });
  const out = await rec.store.messages(A1);
  assert.ok(rec.seen[0].url.includes("/agent_thread?"), `not the thread view: ${rec.seen[0].url}`);
  assert.ok(rec.seen[0].url.includes("order=seq.desc"), `not newest-first: ${rec.seen[0].url}`);
  assert.ok(rec.seen[0].url.includes(`limit=${MAX_THREAD}`));
  assert.deepEqual(out.map((m) => m.text), ["first", "second", "third"], "it was not turned round");
  // A MESSAGE THAT STARTED NO RUN CARRIES `run: null`, not a failure — every
  // imported conversation is that shape, and so is every message sent before this.
  assert.deepEqual(out.map((m) => m.run), [null, null, null]);
});

test("the list is newest-first off the overview view, bounded by the ceiling", async () => {
  const rec = recorder({ agent_overview: { body: [] } });
  await rec.store.list(T1);
  const { url } = rec.seen[0];
  assert.ok(url.includes("agent_overview?"), `the list must read the view: ${url}`);
  assert.ok(url.includes("order=updated_at.desc"), url);
  assert.ok(url.includes(`limit=${MAX_AGENTS}`), url);
  assert.ok(url.includes("last_message"), "the preview column must be selected");
});

// ────────────────────────────────────────────────────────────────────────────
// 7. THE IMPORT
// ────────────────────────────────────────────────────────────────────────────

test("the import is ONE call, so a re-press cannot half-copy an agent", async () => {
  const rec = recorder({ "rpc/import_agent": { body: A1 } });
  const id = await rec.store.importOne(T1, { name: "n", instructions: "i", key: "L1", messages: [{ body: "a" }, { body: "b" }] });
  assert.equal(id, A1);
  assert.equal(rec.seen.length, 1, "an import that is two requests is not atomic");
  assert.ok(rec.seen[0].url.endsWith("/rest/v1/rpc/import_agent"));
  assert.equal(rec.seen[0].body.p_tenant, T1);
  // THE IDENTITY IS ON THE WIRE. Atomic without it is not retry-safe: a press
  // whose answer was lost, pressed again, makes a second agent.
  assert.equal(rec.seen[0].body.p_import_key, "L1", "the import carries no identity");
  assert.equal(rec.seen[0].body.p_messages.length, 2);
  assert.ok(!JSON.stringify(rec.seen[0].body).includes("role"), "a speaker reached the import");
});

test("a message the import cannot read is counted and said, never dropped in silence", async () => {
  const f = fakeStore();
  const r = await call("/api/agent/import", {
    store: f.store,
    body: {
      key: A1, name: "Brought over", instructions: "Do a thing",
      messages: [{ text: "kept" }, { text: "" }, { text: ["a"] }, { at: 1 }, { text: "also kept" }],
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.imported, 2);
  assert.equal(r.body.unreadable, 3, "a dropped message was not counted");
  const sent = f.calls.find((c) => c.name === "importOne").args[1];
  assert.equal(sent.key, A1, "the import's identity never reached the store");
  assert.deepEqual(sent.messages.map((m) => m.body), ["kept", "also kept"]);
  // NO SPEAKER, AT THE HANDLER TOO. The store-level case asserts the wire; the
  // sweep showed the handler could put one on the message before the store ever
  // saw it, and the store passes `p_messages` straight through.
  for (const m of sent.messages) {
    assert.deepEqual(Object.keys(m).sort().filter((k) => k !== "at"), ["body"],
      `an imported message carries ${Object.keys(m).join(", ")}`);
  }
  assert.ok(!JSON.stringify(sent).includes("role"), "the import composed a speaker");
});

test("an import longer than one request may carry is refused by its length, not truncated", async () => {
  const f = fakeStore();
  const messages = Array.from({ length: MAX_IMPORT_MESSAGES + 1 }, (_, i) => ({ text: `m${i}` }));
  const r = await call("/api/agent/import", { store: f.store, body: { key: A1, name: "n", instructions: "i", messages } });
  assert.equal(r.status, 413);
  assert.match(r.body.error, new RegExp(String(MAX_IMPORT_MESSAGES)));
  assert.deepEqual(f.calls, [], "it was imported anyway");
  // At the cap it goes through, so the refusal is about the boundary.
  const ok = fakeStore();
  assert.equal((await call("/api/agent/import", { store: ok.store, body: { key: A1, name: "n", instructions: "i", messages: messages.slice(1) } })).status, 200);
});

test("an import with no name or no instructions is refused, so nothing lands half-described", async () => {
  const f = fakeStore();
  assert.equal((await call("/api/agent/import", { store: f.store, body: { key: A1, instructions: "i" } })).status, 400);
  assert.equal((await call("/api/agent/import", { store: f.store, body: { key: A1, name: "n" } })).status, 400);
  // AND AN IMPORT WITH NO IDENTITY IS REFUSED TOO. Without it this call cannot
  // be retried safely, and an import that quietly loses that property is worse
  // than one that refuses: the failure shows up as a duplicate agent nobody can
  // explain, days later.
  assert.equal((await call("/api/agent/import", { store: f.store, body: { name: "n", instructions: "i" } })).status, 400);
  for (const bad of [7, ["a"], {}, "", "  ", "has space", "a".repeat(201), "semi;colon"]) {
    assert.equal((await call("/api/agent/import", { store: f.store, body: { key: bad, name: "n", instructions: "i" } })).status, 400,
      `key ${JSON.stringify(bad)} was accepted`);
  }
  // The observer: a legacy id that is NOT a uuid still imports — the oldest
  // records carry `String(Date.now()) + Math.random().toString(16)`, and turning
  // exactly those away would strand the ones most worth preserving.
  assert.equal((await call("/api/agent/import", {
    store: fakeStore().store, body: { key: "1757980800000a3f9c2b", name: "n", instructions: "i" },
  })).status, 200);
  assert.deepEqual(f.calls, []);
});

// ────────────────────────────────────────────────────────────────────────────
// 8. THE CAPS ARE THE DATABASE'S OWN
// ────────────────────────────────────────────────────────────────────────────

test("every cap is the column's own check constraint, read out of the migration", () => {
  const between = (col) => {
    const re = new RegExp(`length\\(btrim\\(${col}\\)\\) between (\\d+) and (\\d+)`);
    const m = MIG.match(re);
    assert.ok(m, `no check constraint found for ${col}`);
    return [Number(m[1]), Number(m[2])];
  };
  assert.deepEqual(between("name"), [1, AGENT_NAME_MAX]);
  assert.deepEqual(between("instructions"), [1, AGENT_INSTRUCTIONS_MAX]);
  assert.deepEqual(between("body"), [1, AGENT_BODY_MAX]);
});

test("only the import may carry a bigger body", () => {
  // **THE SWEEP FOUND THIS TOO**: nothing drove `agentBodyMax` per path, so
  // returning the import's allowance for everything survived. It matters in the
  // ordinary direction — a 2 MB ceiling on every route is a 2 MB buffer any
  // signed-in caller can make the Worker hold, on six routes that need 128 KB.
  assert.equal(agentBodyMax("/api/agent/import"), MAX_IMPORT_BODY);
  for (const p of Object.keys(AGENT_ROUTES)) {
    if (p === "/api/agent/import") continue;
    assert.equal(agentBodyMax(p), undefined, `${p} may carry the import's allowance`);
  }
  // `undefined` and not a number, deliberately: `readJsonBody`'s own default is
  // what the other six get, so there is no second copy of that number here.
  assert.equal(agentBodyMax("/api/agent/nope"), undefined);
});

test("the import's message cap is at or under the database's own ceiling", () => {
  const m = IMPORT_MIG.match(/jsonb_array_length\(p_messages\) > (\d+)/);
  assert.ok(m, "the function's own ceiling was not found");
  const dbCeiling = Number(m[1]);
  assert.ok(MAX_IMPORT_MESSAGES <= dbCeiling,
    `the API (${MAX_IMPORT_MESSAGES}) is looser than the store (${dbCeiling})`);
  // And the body allowance has to be able to carry a full one, or the cap above
  // is unreachable and the real refusal is a size error nobody can act on.
  assert.ok(MAX_IMPORT_BODY > MAX_IMPORT_MESSAGES * AGENT_BODY_MAX,
    `${MAX_IMPORT_BODY} cannot carry ${MAX_IMPORT_MESSAGES} messages of ${AGENT_BODY_MAX}`);
});

// ────────────────────────────────────────────────────────────────────────────
// 9. THE WIRING
// ────────────────────────────────────────────────────────────────────────────

test("every route is reachable and every one refuses an unauthenticated caller", async () => {
  for (const [path, method] of Object.entries(AGENT_ROUTES)) {
    const r = await hit(path, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    assert.ok(!isUnrouted(r), `${method} ${path} fell through the router`);
    assert.equal(r.status, 401, `${method} ${path} answered ${r.status} to a signed-out caller`);
  }
});

test("the wrong method is a 405, not a fall-through to the bottom 404", async () => {
  // A GET on a POST route answering the router's own 404 would read as "that
  // route does not exist", which is the confusion the harness exists to end.
  const f = fakeStore();
  const r = await handleAgentApi({ path: "/api/agent/create", method: "GET", tenant: T1, store: f.store });
  assert.equal(r.status, 405);
  assert.deepEqual(f.calls, []);
});

test("a path this module does not handle answers null, so one dispatch decides", async () => {
  for (const p of ["/api/agent/", "/api/agent/nope", "/api/agents/list", "/api/agent/list/x"]) {
    assert.equal(await handleAgentApi({ path: p, method: "GET", tenant: T1, store: {} }), null, p);
  }
});

test("the branch list and the route list are the same names, both ways", () => {
  const body = SRC.slice(SRC.indexOf("export async function handleAgentApi"));
  // ⚠ RE-ANCHORED ONTO THE PATH'S REAL SHAPE: `[a-z]+` stops at a hyphen, so every
  // `automation-*` route matched as the SHORTER prefix `/api/agent/automation` and the
  // census reported seven working branches as missing. A needle that cannot spell the
  // names it is a census of is a census of something else.
  const branched = new Set([...body.matchAll(/path === "(\/api\/agent\/[a-z-]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...branched].sort(), Object.keys(AGENT_ROUTES).sort(),
    "a route with no branch answers 500; a branch with no route is unreachable");
});

test("worker.js dispatches on the module's own list and hands over the verified id", () => {
  const at = WORKER.indexOf("Object.hasOwn(AGENT_ROUTES, url.pathname)");
  assert.ok(at > 0, "the dispatch must read AGENT_ROUTES rather than a second copy of the paths");
  const end = WORKER.indexOf("// GET /api/site/genprobe", at);
  assert.ok(end > at, "the block's closing landmark moved");
  const block = WORKER.slice(at, end);
  assert.match(block, /await authUser\(request\)/, "the route must verify the caller");
  assert.match(block, /if \(!user\) return UNAUTHED\(\)/, "an unverified caller must be refused");
  assert.match(block, /tenant: user\.id/, "the tenant must be the verified user's id");
  // THE BODY-SUPPLIED ACCOUNT HAS EXACTLY ONE CHANCE TO GET IN AND THIS IS IT,
  // so every `tenant:` in the block is read and each has to be the verified id.
  // Written first as `!/tenant:\s*(?!user\.id)/`, which passes nothing and fails
  // everything: `\s*` backtracks to zero width, so the lookahead is asked at the
  // space and always succeeds. A negative lookahead behind a greedy quantifier
  // is not a negative assertion — count the occurrences instead.
  const tenants = [...block.matchAll(/tenant:\s*([^,\n]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(tenants, ["user.id"], `the tenant comes from ${tenants.join(", ")}`);
  assert.match(block, /key: env\.SUPABASE_SERVICE_KEY/, "the store needs the service credential");
  assert.match(block, /AGENT_POST_ROUTES\.includes/, "the body must be read only where there is one");
});

test("worker.js reads a body only for the POST routes", () => {
  // `readJsonBody` CONSUMES the request. Calling it on a GET is harmless today
  // and is one refactor away from being the reason a list read fails, so the
  // dispatch asks the module which routes carry a body rather than guessing.
  assert.deepEqual([...AGENT_POST_ROUTES].sort(),
    Object.keys(AGENT_ROUTES).filter((p) => AGENT_ROUTES[p] === "POST").sort());
  // DERIVED, not a literal: this was pinned to 5 and the eighth route made it red.
  // The property is that the two lists agree, which the assertion above is; this
  // only has to prove the observer is looking at a non-empty list.
  assert.ok(AGENT_POST_ROUTES.length >= 5, `only ${AGENT_POST_ROUTES.length} POST routes`);
  assert.ok(!AGENT_POST_ROUTES.includes("/api/agent/list"));
  assert.ok(!AGENT_POST_ROUTES.includes("/api/agent/messages"));
});

test("a missing service key is said, never answered as an empty account", () => {
  const at = WORKER.indexOf("Object.hasOwn(AGENT_ROUTES, url.pathname)");
  const block = WORKER.slice(at, WORKER.indexOf("// GET /api/site/genprobe", at));
  assert.match(block, /!env\.SUPABASE_SERVICE_KEY/, "a Worker with no credential would query with `undefined`");
  assert.match(block, /status: 503/, "cannot-reach must not read as nothing-there");
});

test("the module never imports from worker.js, so it can be driven anywhere", () => {
  assert.ok(!/from\s+["'][^"']*worker\.js["']/.test(SRC));
  assert.ok(!/^import /m.test(SRC), "this module is dependency-free on purpose");
});

test("the image carries the module the container's worker.js imports", () => {
  // The container imports `worker.js` as the job runtime, so a module it imports
  // and the image does not COPY is a throw at load. The transitive walk in
  // test/dockerfile.test.mjs is the general guard; this is the one line.
  const df = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(df, /COPY worker\.js agent-store\.mjs /);
});

// ────────────────────────────────────────────────────────────────────────────
// 10. NOTHING HERE EXECUTES AN AGENT
// ────────────────────────────────────────────────────────────────────────────

test("this milestone stores and runs nothing", () => {
  // Storage only, by the owner's instruction. A model call, a reply, a tool or a
  // trigger appearing in here is a scope change and should be a red run.
  for (const banned of [
    /api\.anthropic\.com/, /api\.x\.ai/, /\bmessages\/create\b/, /callBuilderModel/,
    /\brole\s*:\s*["']assistant["']/, /\brole\s*:\s*["']agent["']/, /\bmax_tokens\b/,
  ]) assert.ok(!banned.test(SRC), `the store reaches for ${banned}`);
  // And it never touches the execution journal, which is the other half of the
  // schema and has no foreign key to this one.
  assert.ok(!/\brun_entries\b/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, "")), "the store reaches into the journal");
});

// ────────────────────────────────────────────────────────────────────────────
// 11. TAKING A PERMISSION AWAY, AND STOPPING A RUN
// ────────────────────────────────────────────────────────────────────────────
//
// ⚠ **TEN OF TWELVE SITE MUTANTS SURVIVED THE FIRST SWEEP OF THESE ROUTES, AND EVERY ONE WAS
// A GAP HERE RATHER THAN THE PRODUCT'S.** Their properties are proved end to end by
// `agent-builder`'s `npm run verify:controls`, which the SITE's sweep cannot run — *a property
// proven only by an instrument the sweep cannot run is a property no mutant can be caught by*,
// which this repository has now recorded several times. These close them where a mutant can be
// seen: against the real handler, with a recording store and a recording doorbell.

/** The handler, with a doorbell that records what it was rung with. */
const rang = () => { const ids = []; return { ids, ring: async (id) => { ids.push(id); } }; };

test("⚠ A CALL THAT HAS ALREADY RUN CANNOT BE TAKEN BACK, and is not reported as never waiting", async () => {
  // A database cannot recall a tool call. "That request isn't waiting any more" about a call
  // that HAS RUN implies it did not happen, which is the one thing a withdrawal must not say.
  const f = fakeStore({ revokeToolApproval: async () => ({ ok: false, error: "already-ran" }) });
  const r = await call("/api/agent/tool-withdraw", { store: f.store, body: { id: A1 } });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.match(r.body.error, /already run/);
  // THE CONTROL: any other refusal really is the missing-request answer, so the 409 is about
  // this case and not about every failure.
  const g = fakeStore({ revokeToolApproval: async () => ({ ok: false, error: "no-request" }) });
  assert.equal((await call("/api/agent/tool-withdraw", { store: g.store, body: { id: A1 } })).status, 404);
});

test("⚠ A WITHDRAWAL RINGS THE RUN IT ANSWERED, and a failed ring is said rather than raised", async () => {
  // `revoke_tool_approval` puts the run back inside its own transaction — but a SQL function
  // cannot ring a Cloudflare queue, so without the doorbell nothing visibly happens until the
  // next cron tick.
  const bell = rang();
  const f = fakeStore({ revokeToolApproval: async () => ({ ok: true, id: A1, run: A1 }) });
  const r = await call("/api/agent/tool-withdraw", { store: f.store, body: { id: A1 }, ring: bell.ring });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(bell.ids, [A1]);
  assert.equal(r.body.notified, true);
  // A FAILED RING IS SAID AND NEVER RAISED: the work is durable either way, and answering an
  // error would tell somebody their withdrawal failed when it is committed.
  const g = fakeStore({ revokeToolApproval: async () => ({ ok: true, id: A1, run: A1 }) });
  const bad = await call("/api/agent/tool-withdraw", {
    store: g.store, body: { id: A1 }, ring: async () => { throw new Error("the queue went"); }, log: () => {},
  });
  assert.equal(bad.status, 200);
  assert.equal(bad.body.notified, false);
});

test("⚠ A TOOL NAME NO TOOL HAS IS REFUSED, so a revocation cannot be a row that does nothing", async () => {
  // Checked against `AGENT_TOOLS` — the platform's own catalog, in code — and not only against
  // the grammar, because such a row would sit on a screen looking like a withdrawn permission.
  for (const tool of ["teleport", "", "  ", "remember!", 7, ["remember"], null]) {
    const f = fakeStore();
    const r = await call("/api/agent/tool-revoke", { store: f.store, body: { agent: A1, tool } });
    assert.equal(r.status, 400, `${JSON.stringify(tool)} was accepted`);
    assert.deepEqual(f.calls.filter((c) => c.name === "revokeAgentTool"), [],
      `${JSON.stringify(tool)} reached the store`);
  }
  // THE CONTROL: a real catalog name goes through, so the refusals are about the name.
  const ok = fakeStore();
  assert.equal((await call("/api/agent/tool-revoke", {
    store: ok.store, body: { agent: A1, tool: AGENT_TOOLS[0].name },
  })).status, 200);
});

test("⚠ ONLY THIS ACCOUNT MAY TAKE ITS OWN AGENT'S TOOL AWAY, or lift one, or read what is revoked", async () => {
  for (const path of ["/api/agent/tool-revoke", "/api/agent/tool-restore"]) {
    const f = fakeStore({ ownsAgent: async () => false });
    const r = await call(path, { store: f.store, body: { agent: A1, tool: AGENT_TOOLS[0].name } });
    // NOT FOUND, NEVER FORBIDDEN — another account's agent and one that does not exist answer
    // the same, because the difference between them is information.
    assert.equal(r.status, 404, `${path} answered ${r.status}`);
    assert.deepEqual(f.calls.filter((c) => /revokeAgentTool|restoreAgentTool/.test(c.name)), [],
      `${path} wrote something`);
  }
  const g = fakeStore({ ownsAgent: async () => false });
  assert.equal((await call("/api/agent/revoked-tools", {
    store: g.store, query: new URLSearchParams({ agent: A1 }),
  })).status, 404);
  assert.deepEqual(g.calls.filter((c) => c.name === "listRevokedTools"), []);
});

test("⚠ A REVOCATION RINGS EVERY RUN IT ANSWERED, rather than leaving them stranded", async () => {
  // The revocation has answered those requests INSTEAD of a person, so their work rows were
  // un-done inside the function's own transaction — and a run nobody rings waits for the cron.
  const bell = rang();
  const f = fakeStore({
    revokeAgentTool: async () => ({ ok: true, tool: AGENT_TOOLS[0].name, withdrew: 2, runs: [A1, T1] }),
  });
  const r = await call("/api/agent/tool-revoke", {
    store: f.store, body: { agent: A1, tool: AGENT_TOOLS[0].name }, ring: bell.ring,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(bell.ids, [A1, T1]);
  assert.equal(r.body.notified, 2);
  assert.equal(r.body.withdrew, 2);
  // AND IT SAYS WHAT HAPPENED TO THE REQUESTS, because that is the half a customer cannot see.
  assert.match(r.body.say, /taken back/);
  // ⚠ LIFTING ONE SAYS THE OPPOSITE, and must: those requests were answered by the revocation
  // and re-opening them would put a decision in front of somebody who has already made one.
  const g = fakeStore();
  const back = await call("/api/agent/tool-restore", {
    store: g.store, body: { agent: A1, tool: AGENT_TOOLS[0].name },
  });
  assert.match(back.body.say, /stays withdrawn/);
  assert.ok(!/waiting again/.test(back.body.say), back.body.say);
});

test("⚠ A CANCELLATION REPORTS WHAT COMPLETED AND NEVER CLAIMS IT WAS UNDONE", async () => {
  const f = fakeStore({
    cancelRun: async () => ({
      ok: true, repeat: false, run: A1, completedSteps: 3, completedCalls: 2,
      withdrewApprovals: 1, releasedWait: true, say: "stopped — what had already run has already run and was not undone",
    }),
  });
  const r = await call("/api/agent/run-cancel", { store: f.store, body: { run: A1, reason: "changed my mind" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  // ⚠ THE COUNTS ARE THE FUNCTION'S, NOT ZERO. A cancellation is the work stopping, not the
  // work coming back, and how far it got is the one honest thing to say about it.
  assert.equal(r.body.completedSteps, 3);
  assert.equal(r.body.completedCalls, 2);
  assert.equal(r.body.withdrewApprovals, 1);
  assert.equal(r.body.releasedWait, true);
  // ⚠ AND THE SENTENCE. *Don't claim completed effects were undone* — the one thing this whole
  // feature must get right, asserted in both directions.
  assert.match(r.body.say, /was not undone/);
  assert.ok(!/rolled back|undone\b(?!\s)/.test(r.body.say.replace("was not undone", "")), r.body.say);
  // THE FALLBACK SENTENCE SAYS THE SAME THING, for a function that answered none.
  const g = fakeStore({ cancelRun: async () => ({ ok: true, run: A1 }) });
  const bare = await call("/api/agent/run-cancel", { store: g.store, body: { run: A1 } });
  assert.match(bare.body.say, /was not undone/);
  // ⚠ **`heldByWorker` IS NARROWED TO A BOOLEAN HERE, and a truthy non-boolean is the only
  // shape that says so** — a sweep survivor is why this is asserted. It separates *the
  // cancellation is recorded* from *execution has actually stopped*, and the screen draws a
  // sentence about a step that may still be finishing off it; `true`, `false` and absent all
  // read the same through either `=== true` or `!!`, so with only those three the coercion is
  // invisible. A string is what a `cancel_run` older than the field can leave in an answer.
  const j = fakeStore({ cancelRun: async () => ({ ok: true, run: A1, heldByWorker: "no" }) });
  const junk = await call("/api/agent/run-cancel", { store: j.store, body: { run: A1 } });
  assert.equal(junk.body.heldByWorker, false, "a heldByWorker we could not read went out as true");
  // ITS CONTROL: a real one reaches the wire, or "it is false" is satisfied by a route that
  // never carries the field at all.
  const k = fakeStore({ cancelRun: async () => ({ ok: true, run: A1, heldByWorker: true }) });
  assert.equal((await call("/api/agent/run-cancel", { store: k.store, body: { run: A1 } })).body.heldByWorker, true);
  // AND A RUN THAT IS NOT THIS ACCOUNT'S IS THE SAME 404 A MISSING ONE GETS.
  const h = fakeStore({ cancelRun: async () => ({ ok: false, error: "no-run" }) });
  assert.equal((await call("/api/agent/run-cancel", { store: h.store, body: { run: A1 } })).status, 404);
});

test("⚠ A MALFORMED REVOKED-TOOLS ANSWER IS NOT READ AS ONE TOOL NAME", async () => {
  // `revoked_tools` is set-returning, so the answer is a bare list of strings. `String(["x"])`
  // is `"x"`, and a malformed answer coerced would tell a customer a tool is revoked that is
  // not — or hide one that is.
  const store = makeAgentStore({
    url: "https://p.supabase.co", key: "svc",
    fetch: async () => new Response(JSON.stringify(["remember", 7, null, { tool: "forget" }, "forget"]),
      { status: 200, headers: { "content-type": "application/json" } }),
  });
  assert.deepEqual(await store.listRevokedTools(T1, A1), ["remember", "forget"]);
  const junk = makeAgentStore({
    url: "https://p.supabase.co", key: "svc",
    fetch: async () => new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { "content-type": "application/json" } }),
  });
  assert.deepEqual(await junk.listRevokedTools(T1, A1), []);
});

// ── connected accounts ───────────────────────────────────────────────────────

const CID = "8f3c1e20-0000-4000-8000-00000000c001";
const FAKE = AGENT_PROVIDERS[0];

/** One connect press, through the real handler against a recording store. */
const connect = async (body, over = {}) => {
  const f = fakeStore(over.store);
  const r = await handleAgentApi({
    path: "/api/agent/connection-connect", method: "POST", tenant: T1, store: f.store,
    query: new URLSearchParams(), newId: () => CID,
    body: { agent: A1, provider: FAKE.name, account: "shop@example.test", scopes: ["send"], ...body },
    ...over.opts,
  });
  return { r, f };
};

test("⚠ A CONNECTION IS MADE WITH A CREDENTIAL NOBODY OUTSIDE EVER SEES", async () => {
  const { r, f } = await connect({});
  assert.equal(r.status, 200);
  // WHAT COMES BACK IS WHAT A SCREEN NEEDS AND NOTHING MORE.
  assert.equal(r.body.id, CID);
  assert.equal(r.body.provider, FAKE.name);
  assert.equal(r.body.providerLabel, FAKE.label);
  assert.equal(r.body.simulated, true);
  assert.deepEqual(r.body.scopes, ["send"]);
  assert.match(r.body.note, /simulated account/);
  // ⚠ **AND NO CREDENTIAL IS ON THE ANSWER AT ALL** — unlike a webhook's signing secret,
  // which is answered exactly once because whoever will sign with it needs it. Here the only
  // thing that ever uses it is the engine, so there is no reader to hand it to.
  const wire = JSON.stringify(r.body);
  for (const word of ["secret", "credential", "token", "password"]) {
    assert.ok(!wire.includes(word), `the answer carries a ${word}`);
  }

  // IT REALLY REACHED THE STORE, with a credential minted here rather than sent.
  const made = f.calls.find((c) => c.name === "connectProvider");
  assert.ok(made, `nothing was connected: ${JSON.stringify(f.calls.map((c) => c.name))}`);
  const arg = made.args[1];
  assert.equal(arg.provider, FAKE.name);
  assert.equal(arg.account, "shop@example.test");
  assert.deepEqual(arg.scopes, ["send"]);
  // 32 bytes as hex — the length is the claim, because a credential nobody can read back is
  // only as good as what it was minted from.
  assert.match(arg.secret, /^[0-9a-f]{64}$/);
});

test("⚠ A PROVIDER THIS PLATFORM HAS NO ADAPTER FOR IS REFUSED BY NAME, and Gmail is one", async () => {
  for (const name of ["gmail", "outlook", "", "constructor", "FAKEMAIL "]) {
    const { r, f } = await connect({ provider: name });
    if (name === "FAKEMAIL ") {
      // FOLDED AND TRIMMED, so a form's own capitalisation is not a refusal.
      assert.equal(r.status, 200, "a folded name is the same provider");
      continue;
    }
    assert.equal(r.status, 400, `${name} was admitted`);
    assert.match(r.body.error, /can only connect: fakemail/);
    assert.equal(f.calls.filter((c) => c.name === "connectProvider").length, 0, `${name} reached the store`);
  }
});

test("⚠ THE PERMISSIONS ARE THE PERSON'S, from a catalog this code holds", async () => {
  // A NAME THIS PLATFORM DOES NOT OFFER IS REFUSED BY NAME, never dropped — a permission
  // quietly left out is one that appears granted and is not.
  const bad = await connect({ scopes: ["send", "delete_everything"] });
  assert.equal(bad.r.status, 400);
  assert.match(bad.r.body.error, /no permission called delete_everything/);
  assert.equal(bad.f.calls.filter((c) => c.name === "connectProvider").length, 0);

  // AND GRANTING NOTHING IS ITS OWN REFUSAL, because a connection an agent may do nothing
  // with is a control that answers.
  for (const none of [[], undefined, "send", null]) {
    const r = (await connect({ scopes: none })).r;
    assert.equal(r.status, 400, `${JSON.stringify(none)} was admitted`);
  }
  // THE TWO REFUSALS SAY DIFFERENT THINGS.
  assert.notEqual((await connect({ scopes: [] })).r.body.error,
    (await connect({ scopes: ["nope"] })).r.body.error);

  // THE SELECTION TAKES THE CATALOG'S ORDER, so two saves of one choice are byte-identical.
  const both = await connect({ scopes: ["send", "read", "send"] });
  assert.deepEqual(both.r.body.scopes, ["read", "send"]);
});

test("⚠ DISCONNECTING AND REVOKING ARE TWO VERBS, and they say two different things", async () => {
  const off = fakeStore();
  const a = await handleAgentApi({
    path: "/api/agent/connection-disconnect", method: "POST", tenant: T1, store: off.store,
    query: new URLSearchParams(), body: { agent: A1, id: CID, reason: "not needed" }, newId: () => CID,
  });
  assert.equal(a.status, 200);
  assert.equal(a.body.status, "disconnected");
  // IT SAYS THE CREDENTIAL IS GONE, which is what makes this not a toggle.
  assert.match(a.body.note, /credential .* has been destroyed/);
  assert.ok(off.calls.some((c) => c.name === "disconnectConnection"));

  const gone = fakeStore();
  const b = await handleAgentApi({
    path: "/api/agent/connection-revoke", method: "POST", tenant: T1, store: gone.store,
    query: new URLSearchParams(), body: { agent: A1, id: CID }, newId: () => CID,
  });
  assert.equal(b.status, 200);
  assert.equal(b.body.status, "revoked");
  assert.equal(b.body.note, CONNECTION_TROUBLE.revoked);
  assert.ok(gone.calls.some((c) => c.name === "revokeConnection"));

  // ⚠ TWO SENTENCES, because one is the account's owner saying stop and the other is the far
  // end saying no, and they need different things done about them.
  assert.notEqual(a.body.note, b.body.note);

  // AND ONE THAT IS NOT THERE IS A 404 FOR BOTH.
  for (const path of ["/api/agent/connection-disconnect", "/api/agent/connection-revoke"]) {
    const f = fakeStore({ disconnectConnection: async () => ({ ok: false, error: "no-connection" }),
                          revokeConnection: async () => ({ ok: false, error: "no-connection" }) });
    const r = await handleAgentApi({ path, method: "POST", tenant: T1, store: f.store,
      query: new URLSearchParams(), body: { agent: A1, id: CID }, newId: () => CID });
    assert.equal(r.status, 404, path);
  }
});

test("the list answers the catalog beside the rows, so a screen holds no second copy", async () => {
  const f = fakeStore({ listConnections: async () => [connectionRow({
    id: CID, agent_id: A1, provider: FAKE.name, label: "The shop", account: "shop@example.test",
    scopes: ["read", "send"], status: "active", refreshable: false, created_at: "2026-09-19T00:00:00Z",
  })] });
  const r = await handleAgentApi({
    path: "/api/agent/connections", method: "GET", tenant: T1, store: f.store,
    query: new URLSearchParams({ agent: A1 }), body: {}, newId: () => CID,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.max, MAX_CONNECTIONS);
  assert.equal(r.body.providers[0].name, FAKE.name);
  assert.ok(r.body.providers[0].scopes.every((sc) => sc.label && sc.does),
    "a permission a person is asked to grant has to say what it lets the agent do");
  assert.equal(r.body.connections[0].account, "shop@example.test");
  assert.equal(r.body.connections[0].simulated, true);
  assert.equal(r.body.connections[0].trouble, null, "an active connection has nothing to explain");
  // AND ANOTHER ACCOUNT'S AGENT IS THE SAME ANSWER A MISSING ONE GETS.
  const nope = fakeStore({ ownsAgent: async () => false });
  const d = await handleAgentApi({
    path: "/api/agent/connections", method: "GET", tenant: T1, store: nope.store,
    query: new URLSearchParams({ agent: A1 }), body: {}, newId: () => CID,
  });
  assert.equal(d.status, 404);
  assert.equal(nope.calls.filter((c) => c.name === "listConnections").length, 0);
});

test("⚠ A STATUS IT CANNOT READ FAILS CLOSED, and each trouble is its own sentence", () => {
  // Being wrong this way costs a reconnect; the other way draws an unusable connection as
  // ready and sends somebody looking for a fault in their workflow.
  for (const junk of [undefined, null, "", "ACTIVE", "fine", ["active"], 1, { s: "active" }]) {
    const row = connectionRow({ id: CID, provider: FAKE.name, status: junk });
    assert.equal(row.status, "disconnected", `${JSON.stringify(junk)} was read as usable`);
    assert.equal(row.trouble, CONNECTION_TROUBLE.disconnected);
  }
  assert.equal(connectionRow({ status: "active", provider: FAKE.name }).status, "active",
    "the control: a real status is kept");
  // THREE CAUSES, THREE SENTENCES, and each names what to do about it.
  const said = new Set(["expired", "revoked", "disconnected"].map(
    (st) => connectionRow({ status: st, provider: FAKE.name }).trouble));
  assert.equal(said.size, 3);
  // AND A ROW NAMING A PROVIDER THIS DEPLOYMENT HAS NOT GOT READS AS SIMULATED, which is the
  // safe direction: it cannot send anything at all, so drawing it as real is the one claim
  // that matters made wrongly.
  assert.equal(connectionRow({ status: "active", provider: "whoknows" }).simulated, true);
  assert.equal(connectionRow({ status: "active", provider: "whoknows" }).providerLabel, "whoknows");
  // AND NO ROW ANYWHERE CARRIES A CREDENTIAL, even when one is handed in.
  const forced = connectionRow({ id: CID, provider: FAKE.name, status: "active",
    secret: "s3cret", refresh_secret: "r3fresh" });
  const wire = JSON.stringify(forced);
  assert.ok(!wire.includes("s3cret") && !wire.includes("r3fresh"), `a row carried a credential: ${wire}`);
});

test("cleanScopes and providerByName are the two readers, and both fail closed", () => {
  assert.equal(providerByName("fakemail"), FAKE);
  for (const junk of ["gmail", "", null, undefined, "constructor", "toString"]) {
    assert.equal(providerByName(junk), null, `${junk} resolved to a provider`);
  }
  assert.deepEqual(cleanScopes(["send", "read"], FAKE).scopes, ["read", "send"]);
  assert.match(cleanScopes([1], FAKE).error, /has to arrive as a name/);
  assert.match(cleanScopes("send", FAKE).error, /say which permissions/);
  assert.match(cleanScopes(["read"], null).error, /no permission called read/,
    "with no provider nothing is offered, so nothing may be granted");
});

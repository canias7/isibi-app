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
} from "../agent-store.mjs";
// ⚠ THE ENGINE'S OWN REGISTRY, IMPORTED HERE AND NOWHERE ELSE. `agent-store.mjs`
// may not import it — the two are separate products in separate Workers — so the
// copy each of them holds is kept honest by a census in a test, which is the one
// place that may read both.
import { OFFERED, OFFERED_NAMES } from "../agent-builder/src/agents.mjs";
import {
  AUTOMATION_STEPS as ENGINE_STEPS, STEP_TYPES as ENGINE_STEP_TYPES,
  MAX_WORKFLOW_STEPS as ENGINE_MAX_STEPS, MAX_NOTE as ENGINE_MAX_NOTE,
  WEEKDAYS as ENGINE_WEEKDAYS, readWorkflow as engineReadWorkflow,
} from "../agent-builder/src/automations.mjs";
import {
  AUTOMATION_STEPS as SITE_STEPS, AUTOMATION_STEP_TYPES as SITE_STEP_TYPES,
  AUTOMATION_DAYS as SITE_DAYS, MAX_AUTOMATION_STEPS as SITE_MAX_STEPS,
  MAX_STEP_NOTE as SITE_MAX_NOTE, cleanWorkflow as siteCleanWorkflow,
} from "../agent-store.mjs";

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

test("THE FOUR STATES ARE A PARTITION, and every run is exactly one of them", () => {
  const cases = [
    [row(), "queued"],
    [row({ run_step: 1 }), "working"],
    [row({ run_status: "stopped", run_step: 1, run_stopped_at: SENT,
           run_stop: { reason: "answered", text: "[simulated] nine" } }), "answered"],
    [row({ run_status: "stopped", run_step: 2, run_stop: { reason: "spent", bound: "steps" } }), "failed"],
  ];
  for (const [r, state] of cases) {
    assert.equal(runView(r).state, state, JSON.stringify(r.run_stop));
    assert.ok(RUN_STATES.includes(state));
  }
  assert.deepEqual([...RUN_STATES], ["queued", "working", "answered", "failed"]);
  assert.equal(new Set(cases.map(([, s]) => s)).size, RUN_STATES.length, "not every state was driven");
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
    }
    // THE OBSERVER, PROVED ALIVE IN BOTH DIRECTIONS: something out there really does
    // declare a `when`, a `refs` and a set of options, or the loop above asserts nothing.
  }
  const anyField = (pick) => ENGINE_STEPS.some((s) => s.fields.some(pick));
  assert.ok(anyField((f) => f.when), "no field declares `when`, so that comparison is vacuous");
  assert.ok(anyField((f) => f.refs === true), "no field takes references");
  assert.ok(anyField((f) => f.options), "no field offers options");
  assert.ok(anyField((f) => f.max !== undefined), "no field declares a bound");
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
  const N = (text, out) => (out ? { type: "note", text, out } : { type: "note", text });
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
  ];

  let refused = 0;
  let accepted = 0;
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

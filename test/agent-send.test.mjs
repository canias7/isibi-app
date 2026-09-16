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
import { readFileSync } from "node:fs";
import {
  handleAgentApi, makeAgentStore, AGENT_ROUTES, AGENT_BODY_MAX,
  runView, threadRow, cleanSendKey, RUN_STATES, STANDIN_MODEL, MAX_THREAD,
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

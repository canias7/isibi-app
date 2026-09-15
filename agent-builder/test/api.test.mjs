import test from "node:test";
import assert from "node:assert/strict";
import { makeApi, FORBIDDEN_BODY_KEYS } from "../src/api.mjs";
import { makeVerifier, TENANT_CLAIM, HS } from "../src/auth.mjs";
import { makeRunner } from "../src/runner.mjs";
import { defineAgent, defineTool, PUBLIC } from "../src/define.mjs";
import { liveStore } from "./helpers/memory-rest.mjs";

// ── tokens, signed for real ───────────────────────────────────────────────────
const SECRET = "s3cret";
const NOW = 1_800_000_000_000;
const b64url = (b) => btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
async function sign(payload, { secret = SECRET, header = { alg: HS, typ: "JWT" } } = {}) {
  const body = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}
const tokenFor = (tenant, over = {}) => sign({ [TENANT_CLAIM]: tenant, exp: Math.floor(NOW / 1000) + 3600, ...over });

// ── THE MODEL STAND-IN ───────────────────────────────────────────────────────
// No provider, no network, no spend. It answers from a script and THROWS when the
// script runs out, which is the honest stand-in for a process that stops existing.
function standIn(answers) {
  const calls = [];
  const send = async (req) => {
    calls.push(req);
    const a = answers[calls.length - 1];
    if (a === undefined) throw new Error("the process stopped existing");
    return a;
  };
  send.calls = calls;
  return send;
}
const says = (text) => ({ text, toolCalls: [], usage: { inputTokens: 2, outputTokens: 1 }, costMicros: 3 });
const wants = (...names) => ({ text: "", usage: { inputTokens: 3, outputTokens: 1 }, costMicros: 5,
  toolCalls: names.map((n, i) => ({ id: `c${i}`, name: n, args: { i } })) });

// ── the harness ──────────────────────────────────────────────────────────────
const lookTool = (run = async () => ({ hit: 1 })) => defineTool({
  name: "look", description: "reads a thing", input: { type: "object" }, scope: PUBLIC, repeatable: true, run,
});

/**
 * A TIMER THAT FIRES ONLY WHEN A TEST SAYS SO.
 *
 * The heartbeat is the one thing in the runner that is otherwise reachable only by
 * sitting still for ninety seconds, and a lease lost half way through a run is the
 * branch most worth driving. Default: nothing ever fires, so no test is perturbed
 * by a beat it did not ask for.
 */
export function fakeTimer() {
  const pending = new Map();
  let id = 0;
  return {
    set: (fn) => { const h = ++id; pending.set(h, fn); return h; },
    clear: (h) => { pending.delete(h); },
    /** Run every scheduled callback once, in order. */
    async fire() { const fns = [...pending.values()]; pending.clear(); for (const f of fns) await f(); },
    get waiting() { return pending.size; },
  };
}

function harness({ answers = [says("done")], tools = [lookTool()], limits = {}, onError = () => {},
                   clock = () => NOW, timer = fakeTimer(), maxAttempts, doorbell = true } = {}) {
  let doorbellBroken = !doorbell;
  const { rest, store, work } = liveStore({ now: clock });
  // AN EXPLICIT QUEUE THAT RUNS NOTHING UNTIL THE TEST SAYS SO, which is what
  // makes "the response did not wait for the work" a provable claim rather than a
  // hopeful one. It holds RUN IDS and not closures, exactly like the real one: the
  // durable row is the work and the message is only a doorbell.
  const queue = [];
  const notify = async ({ runId }) => {
    if (doorbellBroken) throw new Error("the queue is unreachable");
    queue.push(runId);
  };
  const send = standIn(answers);
  let n = 0;
  const agents = { support: defineAgent({ name: "support", model: "claude-sonnet-5", instructions: "help", tools, limits }) };
  const runner = makeRunner({
    work, store, send, agents, timer, onError, maxAttempts,
    now: () => NOW,
    nameWorker: (() => { let w = 0; return () => `worker-${++w}`; })(),
  });
  /** Deliver everything the queue holds, and report what each delivery did. */
  const drain = async () => {
    const out = [];
    while (queue.length) out.push(await runner.deliver(queue.shift()));
    return out;
  };
  const api = makeApi({
    verify: makeVerifier({ secret: SECRET, now: () => NOW }),
    store, work, notify, onError,
    now: () => NOW,
    newId: () => `run-${++n}`,
    agents,
  });
  // A GET WITH A BODY IS NOT A REQUEST `new Request` WILL BUILD, so the body is
  // attached only where one is allowed. The first run of this file failed on that
  // rather than on the product.
  const call = async (method, path, { token, body } = {}) => api.fetch(new Request(`https://api.test${path}`, {
    method,
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
  }));
  return {
    api, call, queue, drain, send, rest, store, work, runner, timer,
    breakDoorbell: (v = true) => { doorbellBroken = v; },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// THE COMPLETE FLOW: request → execution → storage → result
// ════════════════════════════════════════════════════════════════════════════
test("REQUEST → EXECUTION → STORAGE → RESULT, end to end", async () => {
  const h = harness({ answers: [wants("look"), says("it is 1")] });
  const token = await tokenFor("t1");

  // ── the request ───────────────────────────────────────────────────────────
  const start = await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "how many?" } });
  assert.equal(start.status, 202, "starting a run did not answer 202 accepted");
  const { runId, status } = await start.json();
  assert.equal(status, "queued");
  assert.equal(start.headers.get("location"), `/runs/${runId}`);

  // ── THE WORK IS NOT THE REQUEST ───────────────────────────────────────────
  // Nothing has run. The model has not been called once, and the run is already
  // readable — which is why the id handed back is written down before the answer
  // goes out.
  assert.equal(h.send.calls.length, 0, "the model was called inside the request");
  assert.equal(h.queue.length, 1, "no delivery was queued");
  const early = await (await h.call("GET", `/runs/${runId}`, { token })).json();
  // **ALREADY `running`, AND ALREADY SELF-DESCRIBING.** The run's first journal
  // entry is written inside the same transaction that accepts the work, so before
  // anything executes the database already holds the prompt, the agent, the model
  // and the bounds. That is what makes the work durable rather than merely
  // recorded: the request can go away and the run is still fully specified.
  assert.equal(early.status, "running", `a just-accepted run read as "${early.status}"`);
  assert.equal(early.agent, "support", "the accepted run does not know its agent");
  assert.equal(early.model, "claude-sonnet-5", "the accepted run does not know its model");
  assert.equal(early.steps, 0, "the accepted run claims to have taken a step");
  assert.equal(early.text, null);
  // THE WORK ROW IS COMMITTED TOO — the third thing in that one transaction.
  assert.ok(h.rest.work.has(runId), "the work was acknowledged without being persisted");
  assert.equal(h.rest.work.get(runId).done_at, null);

  // ── execution, after the request is over ──────────────────────────────────
  await h.drain();
  assert.equal(h.send.calls.length, 2, "the work did not run to completion");

  // ── storage, then the result ──────────────────────────────────────────────
  const done = await (await h.call("GET", `/runs/${runId}`, { token })).json();
  assert.equal(done.status, "stopped");
  assert.equal(done.text, "it is 1");
  assert.equal(done.stop.reason, "answered");
  assert.equal(done.steps, 2);
  assert.equal(done.used.tokens, 7);
  assert.deepEqual(done.pending, []);
  assert.deepEqual(done.problems, []);
  assert.equal(done.agent, "support");
  assert.equal(done.model, "claude-sonnet-5");

  // And it is really in storage, not in a variable: the log holds every entry.
  const log = [...h.rest.entries.get(runId).values()].map((e) => e.kind);
  assert.deepEqual(log, ["started", "model", "tool", "model", "stopped"]);
  // ...and the queue let the work go, so nothing will be delivered again.
  assert.notEqual(h.rest.work.get(runId).done_at, null, "finished work was left outstanding");
});

test("AN INTERRUPTED RUN RESUMES THROUGH THE API", async () => {
  // The stand-in's script runs out after the first model call, which is what a
  // process that stops existing looks like from inside the loop.
  const h = harness({ answers: [wants("look")] });
  const token = await tokenFor("t1");
  const { runId } = await (await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).json();
  await h.drain();

  // It ended without an answer. That is the state a resume is for.
  const stuck = await (await h.call("GET", `/runs/${runId}`, { token })).json();
  assert.equal(stuck.stop.reason, "call-failed", `ended as "${stuck.stop?.reason}"`);

  // A fresh API — a different process, with a model that now answers.
  const h2 = harness({ answers: [says("finished on the second try")] });
  // Same storage, so the log carries across. (A new process, the same database.)
  const agents2 = { support: defineAgent({ name: "support", model: "claude-sonnet-5", instructions: "help", tools: [lookTool()] }) };
  const runner2 = makeRunner({
    work: h.work, store: h.store, send: h2.send, agents: agents2, timer: fakeTimer(),
    now: () => NOW, nameWorker: () => "second-process",
  });
  const api2 = makeApi({
    verify: makeVerifier({ secret: SECRET, now: () => NOW }),
    store: h.store, work: h.work, notify: async ({ runId: r }) => { h2.queue.push(r); },
    now: () => NOW, newId: () => "unused",
    agents: agents2,
  });
  const call2 = (method, path) => api2.fetch(new Request(`https://api.test${path}`, { method, headers: { authorization: `Bearer ${token}` } }));
  const drain2 = async () => { while (h2.queue.length) await runner2.deliver(h2.queue.shift()); };

  // A run that ended with `call-failed` has a stopped entry, so it reads as
  // finished — and the API will not re-dispatch a finished run. That is the
  // honest boundary, and it is why this case resumes the interrupted-BEFORE-the-
  // stop shape below instead.
  const refused = await call2("POST", `/runs/${runId}/resume`);
  assert.equal(refused.status, 200);
  assert.equal((await refused.json()).resumed, false);

  // The real interruption: a process that vanished before it could write its
  // ending. Built by taking the stop off the stored log, not by hand.
  const log = h.rest.entries.get(runId);
  for (const [seq, e] of [...log.entries()]) if (e.kind === "stopped") log.delete(seq);

  const resume = await call2("POST", `/runs/${runId}/resume`);
  assert.equal(resume.status, 202, `resume answered ${resume.status}`);
  const body = await resume.json();
  assert.equal(body.resumed, true);
  assert.equal(h2.send.calls.length, 0, "the resume executed inside the request");
  await drain2();

  const after = await (await call2("GET", `/runs/${runId}`)).json();
  assert.equal(after.status, "stopped");
  assert.equal(after.text, "finished on the second try");
  // It carried on rather than starting again: two model calls in total, and the
  // second process only made one of them.
  assert.equal(after.steps, 2, `the resumed run reports ${after.steps} steps`);
  assert.equal(h2.send.calls.length, 1, "the resume re-bought the first call");
  assert.equal(h2.send.calls[0].step, 2, `resumed at step ${h2.send.calls[0].step}`);
});

test("A COMPLETED RUN IS NOT EXECUTED AGAIN, and is not even dispatched", async () => {
  const h = harness({ answers: [says("the answer")] });
  const token = await tokenFor("t1");
  const { runId } = await (await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).json();
  await h.drain();
  assert.equal(h.send.calls.length, 1);

  const replay = await h.call("POST", `/runs/${runId}/resume`, { token });
  assert.equal(replay.status, 200, "a finished run was accepted for execution");
  const body = await replay.json();
  assert.equal(body.resumed, false);
  assert.equal(body.reason, "already-finished");
  assert.equal(body.text, "the answer", "it did not hand back the answer it already had");
  // NOTHING WAS QUEUED, so there is nothing that could run later either.
  assert.equal(h.queue.length, 0, "a finished run was put on the queue");
  await h.drain();
  assert.equal(h.send.calls.length, 1, "the model was called again for a finished run");
});

// ════════════════════════════════════════════════════════════════════════════
// CREDENTIALS
// ════════════════════════════════════════════════════════════════════════════
test("MISSING OR FORGED CREDENTIALS GRANT NOTHING, on every route", async () => {
  const h = harness();
  const good = await tokenFor("t1");
  const { runId } = await (await h.call("POST", "/runs", { token: good, body: { agent: "support", prompt: "go" } })).json();

  const bad = {
    "no header at all": undefined,
    "empty": "",
    "not a token": "abc",
    "wrong secret": await sign({ [TENANT_CLAIM]: "t1", exp: Math.floor(NOW / 1000) + 60 }, { secret: "wrong" }),
    "expired": await tokenFor("t1", { exp: Math.floor(NOW / 1000) - 1 }),
    "no expiry": await sign({ [TENANT_CLAIM]: "t1" }),
    "alg none": await sign({ [TENANT_CLAIM]: "t1", exp: Math.floor(NOW / 1000) + 60 }, { header: { alg: "none" } }),
    "alg confusion": await sign({ [TENANT_CLAIM]: "t1", exp: Math.floor(NOW / 1000) + 60 }, { header: { alg: "RS256" } }),
    // NEITHER a tenant NOR a subject. A token with only `sub` is now a legitimate
    // identity (each signed-in user is their own tenant), so using one here would
    // have been testing the wrong thing.
    "no tenant and no subject": await sign({ exp: Math.floor(NOW / 1000) + 60, email: "a@b.c" }),
    "a malformed explicit tenant": await sign({ exp: Math.floor(NOW / 1000) + 60, [TENANT_CLAIM]: ["t1"], sub: "u1" }),
    "tampered tenant": await (async () => {
      const t = await tokenFor("t1"); const [hh, , ss] = t.split(".");
      return `${hh}.${enc({ [TENANT_CLAIM]: "t2", exp: Math.floor(NOW / 1000) + 60 })}.${ss}`;
    })(),
  };
  const routes = [["GET", "/runs"], ["POST", "/runs"], ["GET", `/runs/${runId}`], ["POST", `/runs/${runId}/resume`]];

  for (const [label, token] of Object.entries(bad)) {
    for (const [method, path] of routes) {
      const r = await h.call(method, path, { token, body: { agent: "support", prompt: "go" } });
      assert.equal(r.status, 401, `${label} got ${r.status} from ${method} ${path}`);
      assert.equal(r.headers.get("www-authenticate"), "Bearer");
      // A REFUSAL SAYS NOTHING ABOUT WHY. Naming it turns the endpoint into an
      // oracle for probing tokens.
      const body = await r.json();
      assert.deepEqual(body, { error: "unauthorized" }, `${label} leaked a reason: ${JSON.stringify(body)}`);
    }
  }
  // Nothing was dispatched by any of them.
  assert.equal(h.queue.length, 1, "an unauthenticated request queued work");
  // THE CONTROL: the good token still works, so the refusals are about the token.
  assert.equal((await h.call("GET", "/runs", { token: good })).status, 200);
});

test("ANOTHER TENANT'S RUN ID GRANTS NOTHING, and reads as NOT FOUND", async () => {
  const h = harness();
  const t1 = await tokenFor("t1");
  const t2 = await tokenFor("t2");
  const { runId } = await (await h.call("POST", "/runs", { token: t1, body: { agent: "support", prompt: "mine" } })).json();
  await h.drain();

  for (const [method, path] of [["GET", `/runs/${runId}`], ["POST", `/runs/${runId}/resume`]]) {
    const r = await h.call(method, path, { token: t2 });
    assert.equal(r.status, 404, `${method} ${path} answered ${r.status} for another tenant`);
    // NEVER 403: "forbidden" tells a stranger the id they guessed is real.
    assert.notEqual(r.status, 403);
    const missing = await h.call(method, `/runs/does-not-exist`, { token: t2 });
    assert.equal(missing.status, r.status, "somebody else's run is distinguishable from a missing one");
    assert.deepEqual(await r.json(), await missing.json(), "the two answers differ in their body");
  }
  // And the other tenant's listing does not mention it.
  assert.deepEqual((await (await h.call("GET", "/runs", { token: t2 })).json()).runs, []);
  // THE CONTROL: its owner can see it.
  assert.equal((await h.call("GET", `/runs/${runId}`, { token: t1 })).status, 200);
});

test("A TENANT IN THE BODY IS REFUSED, not quietly ignored", async () => {
  const h = harness();
  const token = await tokenFor("t1");
  for (const key of FORBIDDEN_BODY_KEYS) {
    const r = await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go", [key]: "t2" } });
    assert.equal(r.status, 400, `a body carrying ${key} was accepted`);
    const body = await r.json();
    assert.deepEqual(body.rejected, [key], "it did not say which key was the problem");
    assert.match(body.error, /token/);
  }
  assert.equal(h.queue.length, 0, "a refused request still queued work");

  // A KEY THAT IS PRESENT BUT FALSY IS STILL A TENANT IN THE BODY. This is where
  // `Object.hasOwn` and truthiness part company, and it is the only place they do
  // — a sweep found that a truthiness check passed every other case here.
  for (const value of ["", "   ", null, 0, false]) {
    const r = await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go", tenant: value } });
    assert.equal(r.status, 400, `a body carrying tenant=${JSON.stringify(value)} was accepted`);
    assert.deepEqual((await r.json()).rejected, ["tenant"]);
  }
  // An inherited key is not a supplied one, which is the other half of using
  // `hasOwn`: every object literal has a truthy `constructor`.
  assert.equal((await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).status, 202);
});

test("A RUN WHOSE LOG CANNOT BE READ IS NOT RESUMED", async () => {
  // Resuming past a junk entry would send the model a conversation with a step
  // missing and under-report the bill. The log says so; the API must act on it.
  const h = harness({ answers: [wants("look")] });
  const token = await tokenFor("t1");
  const { runId } = await (await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).json();
  await h.drain();
  const log = h.rest.entries.get(runId);
  for (const [seq, e] of [...log.entries()]) if (e.kind === "stopped") log.delete(seq);
  log.set(99, { kind: "not-a-kind" });

  const r = await h.call("POST", `/runs/${runId}/resume`, { token });
  assert.equal(r.status, 409, `a corrupt log answered ${r.status}`);
  const body = await r.json();
  assert.ok(body.problems.length >= 1, "it refused without saying what was wrong");
  assert.equal(h.queue.length, 0, "a run with an unreadable log was queued anyway");
  // THE CONTROL: with the junk removed it resumes, so the 409 is about the log.
  log.delete(99);
  assert.equal((await h.call("POST", `/runs/${runId}/resume`, { token })).status, 202);
});

// ════════════════════════════════════════════════════════════════════════════
// THE REST OF THE SURFACE
// ════════════════════════════════════════════════════════════════════════════
test("the listing is this tenant's resumable runs only", async () => {
  // BOTH tenants get a genuinely interrupted run, so this asserts isolation rather
  // than the weaker "the other tenant happens to have nothing". A run that merely
  // has not been dispatched reads as `new`, not `running`, and would have made
  // this pass for the wrong reason.
  const h = harness({ answers: [wants("look"), says("a"), wants("look"), says("b")] });
  const t1 = await tokenFor("t1");
  const t2 = await tokenFor("t2");
  const a = await (await h.call("POST", "/runs", { token: t1, body: { agent: "support", prompt: "one" } })).json();
  const b = await (await h.call("POST", "/runs", { token: t2, body: { agent: "support", prompt: "two" } })).json();
  await h.drain();

  // What a vanished process leaves: a log with no ending. Taken off the stored log
  // rather than hand-built.
  for (const id of [a.runId, b.runId]) {
    const log = h.rest.entries.get(id);
    for (const [seq, e] of [...log.entries()]) if (e.kind === "stopped") log.delete(seq);
    h.rest.runs.get(id).status = "running";
  }

  const mine = (await (await h.call("GET", "/runs", { token: t1 })).json()).runs;
  assert.deepEqual(mine.map((r) => r.id), [a.runId], "the listing crossed tenants or lost a run");
  const theirs = (await (await h.call("GET", "/runs", { token: t2 })).json()).runs;
  assert.deepEqual(theirs.map((r) => r.id), [b.runId]);
  // Neither listing mentions the other's run, which is the claim.
  assert.equal(mine.some((r) => r.id === b.runId), false);
  assert.equal(theirs.some((r) => r.id === a.runId), false);
});

test("a bad request is a 400 that says what is wrong, and queues nothing", async () => {
  const h = harness();
  const token = await tokenFor("t1");
  const cases = [
    [{ prompt: "go" }, /agent/],
    [{ agent: "support" }, /prompt/],
    [{ agent: "support", prompt: "   " }, /prompt/],
    [{ agent: "nope", prompt: "go" }, /no such agent/],
    [{ agent: ["support"], prompt: "go" }, /agent/],
  ];
  for (const [body, expect] of cases) {
    const r = await h.call("POST", "/runs", { token, body });
    assert.equal(r.status, 400, `${JSON.stringify(body)} got ${r.status}`);
    assert.match((await r.json()).error, expect);
  }
  // Malformed JSON, and a body that is not an object.
  const raw = await h.api.fetch(new Request("https://api.test/runs", {
    method: "POST", headers: { authorization: `Bearer ${token}` }, body: "{not json",
  }));
  assert.equal(raw.status, 400);
  assert.match((await raw.json()).error, /JSON/);
  assert.equal(h.queue.length, 0, "a refused request queued work");
  assert.equal((await h.call("GET", "/nope", { token })).status, 404);
});

test("A CRASHING DELIVERY ENDS SOMEWHERE VISIBLE rather than looking like it is still running", async () => {
  // A delivery that throws would leave a run reading `running` for ever —
  // indistinguishable from one still going, which is the state nobody can act on.
  // With a durable queue there are TWO right answers and the attempt count picks
  // between them, so both halves are driven here.
  const crashes = () => [{ get text() { throw new Error("the runtime fell over"); } }];

  // (a) WHILE ATTEMPTS REMAIN the log is left alone and the work stays
  // outstanding, because a crash may be transient and a redelivery is free.
  const retry = harness({ answers: crashes(), maxAttempts: 3 });
  const token = await tokenFor("t1");
  const a = await (await retry.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).json();
  const [out] = await retry.drain();
  assert.equal(out.why, "failed", `a crash reported "${out.why}"`);
  const mid = await (await retry.call("GET", `/runs/${a.runId}`, { token })).json();
  assert.equal(mid.status, "running", "a crash on the first attempt closed the log");
  assert.equal(retry.rest.work.get(a.runId).done_at, null, "a retryable crash was taken off the queue");
  assert.match(retry.rest.work.get(a.runId).last_error, /fell over/, "the queue does not say what went wrong");

  // (b) ON THE LAST PERMITTED ATTEMPT the log is closed, because a run nothing
  // will ever deliver again must not read as one still going.
  const seen = [];
  const last = harness({ answers: crashes(), maxAttempts: 1, onError: (e) => seen.push(e) });
  const b = await (await last.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).json();
  await last.drain();
  const view = await (await last.call("GET", `/runs/${b.runId}`, { token })).json();
  assert.equal(view.status, "stopped", `a crashed run reads as "${view.status}"`);
  assert.equal(view.stop.reason, "crashed");
  assert.match(view.stop.error, /fell over/);
  assert.notEqual(last.rest.work.get(b.runId).done_at, null, "a run nobody will retry was left on the queue");
  assert.ok(seen.some((e) => e.at === "deliver"), "the crash was never reported");
});

test("A RESUME USES THE AGENT THE RUN WAS STARTED WITH, never one from the request", async () => {
  // A resume that could name a different agent would be a way to run one agent's
  // tools over another's conversation.
  const h = harness({ answers: [wants("look")] });
  const token = await tokenFor("t1");
  const { runId } = await (await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).json();
  await h.drain();
  const log = h.rest.entries.get(runId);
  for (const [seq, e] of [...log.entries()]) if (e.kind === "stopped") log.delete(seq);

  // Naming another agent in the resume body changes nothing — and a body carrying
  // a tenant is still refused on this route too.
  const r = await h.call("POST", `/runs/${runId}/resume`, { token, body: { agent: "somebody-else" } });
  assert.equal(r.status, 202);
  const smuggle = await h.call("POST", `/runs/${runId}/resume`, { token, body: { tenant: "t2" } });
  assert.equal(smuggle.status, 400, "a tenant in a resume body was accepted");

  // And a run whose agent is no longer registered is a named 409, not a crash.
  const orphan = makeApi({
    verify: makeVerifier({ secret: SECRET, now: () => NOW }),
    store: h.store, work: h.work, notify: async () => {}, now: () => NOW, newId: () => "x",
    agents: { other: defineAgent({ name: "other", model: "m", instructions: "i" }) },
  });
  const gone = await orphan.fetch(new Request(`https://api.test/runs/${runId}/resume`, {
    method: "POST", headers: { authorization: `Bearer ${token}` },
  }));
  assert.equal(gone.status, 409);
  assert.match((await gone.json()).error, /not registered/);
});

test("makeApi refuses to exist without what it needs", () => {
  const ok = {
    verify: async () => ({ ok: true, tenant: "t1" }),
    store: { forTenant: () => ({}) },
    work: { accept: async () => ({}), requeue: async () => ({}) },
    notify: async () => {},
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "i" }) },
  };
  assert.doesNotThrow(() => makeApi(ok));
  for (const k of ["verify", "store", "work", "notify"]) {
    assert.throws(() => makeApi({ ...ok, [k]: undefined }), { name: "TypeError" }, `${k} was optional`);
  }
  assert.throws(() => makeApi({ ...ok, agents: {} }), { name: "TypeError" }, "an API with no agents was accepted");
  assert.throws(() => makeApi({ ...ok, agents: { x: { kind: "nope" } } }), { name: "TypeError" });
  assert.throws(() => makeApi({ ...ok, store: {} }), { name: "TypeError" });
  // HALF A QUEUE IS NOT A QUEUE: accepting work without being able to ask for it
  // again would make every resume a silent no-op.
  assert.throws(() => makeApi({ ...ok, work: { accept: async () => ({}) } }), { name: "TypeError" });
  assert.throws(() => makeApi({ ...ok, work: { requeue: async () => ({}) } }), { name: "TypeError" });
  // **`send` IS NO LONGER THE API'S BUSINESS.** Nothing in this file executes a
  // run, so an API built with no model at all is correct rather than broken — and
  // that is worth pinning, because a `send` quietly accepted here would be a
  // second execution path beside the runner.
  assert.doesNotThrow(() => makeApi({ ...ok, send: undefined }));
});

// ════════════════════════════════════════════════════════════════════════════
// THE DOORBELL IS ALLOWED TO FAIL
// ════════════════════════════════════════════════════════════════════════════

test("A DOORBELL THAT DID NOT RING STILL ACCEPTS THE WORK, and says so", async () => {
  // The work is committed by the time the doorbell is rung, so a failure changes
  // only how soon the run starts. Answering 500 would tell a caller their run was
  // rejected when it is sitting in the queue, ready — the worst of both readings.
  const seen = [];
  const h = harness({ answers: [says("late but fine")], doorbell: false, onError: (e) => seen.push(e) });
  const token = await tokenFor("t1");

  const res = await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } });
  assert.equal(res.status, 202, `a failed doorbell answered ${res.status}`);
  const body = await res.json();
  // **REPORTED, NOT PAPERED OVER.** A caller that sees `delivered: false` knows the
  // run is queued and waiting for the sweeper rather than starting now.
  assert.equal(body.delivered, false, "an unrung doorbell was reported as delivered");
  assert.equal(body.status, "queued");
  assert.ok(seen.some((e) => e.at === "notify"), "the failure was never reported anywhere");

  // The work really is there, so the sweeper will find it.
  assert.ok(h.rest.work.has(body.runId), "the work was not persisted");
  assert.equal(h.rest.work.get(body.runId).done_at, null);
  const dropped = await h.runner.reclaimable({ graceS: 0 });
  assert.deepEqual(dropped.map((d) => d.runId), [body.runId], "the undelivered run is not reclaimable");

  // And once the doorbell works, a resume reports delivery honestly too.
  h.breakDoorbell(false);
  const log = h.rest.entries.get(body.runId);
  const again = await h.call("POST", `/runs/${body.runId}/resume`, { token });
  assert.equal((await again.json()).delivered, true);
  assert.ok(log.size >= 1);
});

test("A RUN WITH NO WORK ROW IS A NOT-FOUND ON RESUME, never a silent queue", async () => {
  // Reachable for a run created straight through the store rather than through
  // `accept` — an older run, or an SDK caller. The store says the run is this
  // tenant's and the queue has never heard of it, and the two disagreeing must not
  // read as "queued".
  const h = harness();
  const token = await tokenFor("t1");
  const scoped = h.store.forTenant("t1");
  const { journal } = await scoped.create("orphan-run");
  await journal.append({ kind: "started", at: NOW, tenant: "t1", agent: "support", model: "claude-sonnet-5", prompt: "go", limits: {} });

  assert.ok(h.rest.runs.has("orphan-run"), "the run was not created");
  assert.equal(h.rest.work.has("orphan-run"), false, "this fixture accidentally created a work row");

  const res = await h.call("POST", "/runs/orphan-run/resume", { token });
  assert.equal(res.status, 404, `a run with no work row answered ${res.status}`);
  assert.equal(h.queue.length, 0, "a run the queue has never heard of was delivered anyway");
});

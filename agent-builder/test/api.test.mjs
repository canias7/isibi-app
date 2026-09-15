import test from "node:test";
import assert from "node:assert/strict";
import { makeApi, FORBIDDEN_BODY_KEYS } from "../src/api.mjs";
import { makeVerifier, TENANT_CLAIM, ALG } from "../src/auth.mjs";
import { defineAgent, defineTool, PUBLIC } from "../src/define.mjs";
import { liveStore } from "./helpers/memory-rest.mjs";

// ── tokens, signed for real ───────────────────────────────────────────────────
const SECRET = "s3cret";
const NOW = 1_800_000_000_000;
const b64url = (b) => btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
async function sign(payload, { secret = SECRET, header = { alg: ALG, typ: "JWT" } } = {}) {
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

function harness({ answers = [says("done")], tools = [lookTool()], limits = {}, onError = () => {} } = {}) {
  const { rest, store } = liveStore();
  // AN EXPLICIT QUEUE, NOT `waitUntil`. Nothing runs until the test says so, which
  // is what makes "the response did not wait for the work" a provable claim
  // rather than a hopeful one.
  const queue = [];
  const dispatch = (task) => { queue.push(task); };
  const drain = async () => { while (queue.length) await queue.shift()(); };
  const send = standIn(answers);
  let n = 0;
  const api = makeApi({
    verify: makeVerifier({ secret: SECRET, now: () => NOW }),
    store, send, dispatch, onError,
    now: () => NOW,
    newId: () => `run-${++n}`,
    agents: { support: defineAgent({ name: "support", model: "claude-sonnet-5", instructions: "help", tools, limits }) },
  });
  // A GET WITH A BODY IS NOT A REQUEST `new Request` WILL BUILD, so the body is
  // attached only where one is allowed. The first run of this file failed on that
  // rather than on the product.
  const call = async (method, path, { token, body } = {}) => api.fetch(new Request(`https://api.test${path}`, {
    method,
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
  }));
  return { api, call, queue, drain, send, rest, store };
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
  assert.equal(h.queue.length, 1, "no work was handed to the dispatcher");
  const early = await (await h.call("GET", `/runs/${runId}`, { token })).json();
  assert.equal(early.status, "new", `a just-created run read as "${early.status}"`);
  assert.equal(early.text, null);

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
  const api2 = makeApi({
    verify: makeVerifier({ secret: SECRET, now: () => NOW }),
    store: h.store, send: h2.send, dispatch: (t) => h2.queue.push(t),
    now: () => NOW, newId: () => "unused",
    agents: { support: defineAgent({ name: "support", model: "claude-sonnet-5", instructions: "help", tools: [lookTool()] }) },
  });
  const call2 = (method, path) => api2.fetch(new Request(`https://api.test${path}`, { method, headers: { authorization: `Bearer ${token}` } }));

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
  await (async () => { while (h2.queue.length) await h2.queue.shift()(); })();

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

test("A CRASHING TASK ENDS SOMEWHERE VISIBLE rather than looking like it is still running", async () => {
  // A dispatched task that throws would leave a run reading `running` for ever —
  // indistinguishable from one still going, which is the state nobody can act on.
  const seen = [];
  const h = harness({
    tools: [lookTool()], onError: (e) => seen.push(e),
    answers: [{ get text() { throw new Error("the runtime fell over"); } }],
  });
  const token = await tokenFor("t1");
  const { runId } = await (await h.call("POST", "/runs", { token, body: { agent: "support", prompt: "go" } })).json();
  await h.drain();
  const view = await (await h.call("GET", `/runs/${runId}`, { token })).json();
  assert.equal(view.status, "stopped", `a crashed run reads as "${view.status}"`);
  assert.equal(view.stop.reason, "crashed");
  assert.match(view.stop.error, /fell over/);
  assert.ok(seen.some((e) => e.at === "execute"), "the crash was never reported");
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
    store: h.store, send: h.send, dispatch: () => {}, now: () => NOW, newId: () => "x",
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
    send: async () => ({}),
    dispatch: () => {},
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "i" }) },
  };
  assert.doesNotThrow(() => makeApi(ok));
  for (const k of ["verify", "store", "send", "dispatch"]) {
    assert.throws(() => makeApi({ ...ok, [k]: undefined }), { name: "TypeError" }, `${k} was optional`);
  }
  assert.throws(() => makeApi({ ...ok, agents: {} }), { name: "TypeError" }, "an API with no agents was accepted");
  assert.throws(() => makeApi({ ...ok, agents: { x: { kind: "nope" } } }), { name: "TypeError" });
  assert.throws(() => makeApi({ ...ok, store: {} }), { name: "TypeError" });
});

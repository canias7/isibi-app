import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker, {
  SETTINGS, OPTIONAL, SENSITIVE, MODELS, SCHEMA, QUEUE_BINDING, SWEEP_GRACE_S, SWEEP_LIMIT,
  AUTOMATION_CATCHUP_S, AUTOMATION_TICK_LIMIT,
  AUTOMATION_RESUME_LIMIT, APPROVAL_SWEEP_LIMIT,
  missingSettings, buildApi, buildRunner, buildApprovals,
} from "../src/worker.mjs";
import { AGENTS } from "../src/agents.mjs";
import { makeStandIn } from "../src/model-standin.mjs";
import { runAgent } from "../src/run.mjs";
import { memoryRest } from "./helpers/memory-rest.mjs";
import { LEASE_TTL_S, BEAT_EVERY_MS } from "../src/runner.mjs";
import { AUTHORED_AGENT } from "../src/agents.mjs";
import { startedEntry, limitsToJson } from "../src/journal.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
/** A queue binding shaped like Cloudflare's, counting what was sent. */
const fakeQueue = () => {
  const sent = [];
  return { send: async (m) => { sent.push(m); }, sent };
};
const good = (over = {}) => ({
  SUPABASE_URL: "https://p.supabase.co",
  SUPABASE_SERVICE_KEY: "svc",
  SUPABASE_PUBLISHABLE_KEY: "pub",
  [QUEUE_BINDING]: fakeQueue(),
  ...over,
});
/** A batch shaped like Cloudflare's, recording what each message was told to do. */
const batchOf = (bodies) => {
  const acked = [], retried = [];
  return {
    messages: bodies.map((body, i) => ({ id: `m${i}`, body, ack: () => acked.push(i), retry: () => retried.push(i) })),
    acked, retried,
  };
};

// ── configuration ────────────────────────────────────────────────────────────
const ALL_REQUIRED = () => [...Object.keys(SETTINGS), QUEUE_BINDING].sort();

test("missingSettings names every setting that is absent, and nothing else", () => {
  assert.deepEqual(missingSettings(good()), []);
  assert.deepEqual(missingSettings({}).sort(), ALL_REQUIRED());
  for (const k of Object.keys(SETTINGS)) {
    assert.deepEqual(missingSettings({ ...good(), [k]: undefined }), [k]);
    // Present-but-blank is absent: a secret set to "" is not a secret.
    assert.deepEqual(missingSettings({ ...good(), [k]: "   " }), [k], `${k} accepted whitespace`);
  }
  for (const bad of [null, undefined, "env", 4]) {
    assert.deepEqual(missingSettings(bad).sort(), ALL_REQUIRED(), "a junk env read as configured");
  }
});

test("THE QUEUE BINDING IS REQUIRED, and `waitUntil` is not a fallback", () => {
  // **A DEPLOYMENT THAT BELIEVES IT IS DURABLE AND IS NOT is the one outcome worth
  // refusing to boot over.** `waitUntil` kept work alive after the response, which
  // is the right shape and the wrong durability: the work existed only as a
  // closure in one isolate. So a missing queue is a missing setting.
  assert.deepEqual(missingSettings({ ...good(), [QUEUE_BINDING]: undefined }), [QUEUE_BINDING]);
  // A binding that is not a producer is not a binding. This is the shape a
  // mis-typed config actually takes — the name is bound to something inert.
  for (const bad of [{}, "a-queue", 4, { send: "nope" }, []]) {
    assert.deepEqual(missingSettings({ ...good(), [QUEUE_BINDING]: bad }), [QUEUE_BINDING],
      `a binding of ${JSON.stringify(bad)} read as a working queue`);
  }
  assert.throws(() => buildApi({ ...good(), [QUEUE_BINDING]: undefined }), /RUN_QUEUE/);
  // **THE CONSUMER IS THE ONE THING THAT DOES NOT NEED IT**, because it claims,
  // executes and releases and never sends. Requiring it there would be a
  // configuration rule with no reason behind it — and the sweeper, which DOES
  // send, asks for the full deployment configuration instead.
  assert.doesNotThrow(() => buildRunner({ ...good(), [QUEUE_BINDING]: undefined }));
  // A caller that supplies its own transport is a producer with no binding, which
  // is what every local driver is.
  assert.doesNotThrow(() => buildApi({ ...good(), [QUEUE_BINDING]: undefined }, { notify: async () => {} }));
  // AND THE SOURCE CARRIES NO SECOND PATH. A `waitUntil` fallback would satisfy
  // every behavioural test above while quietly restoring the old durability.
  const src = fs.readFileSync(path.join(DIR, "src", "worker.mjs"), "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  assert.equal(/waitUntil/.test(src), false, "the Worker still dispatches work through waitUntil");
});

test("THE SIGNING SECRET IS OPTIONAL, and that is the point of the auth work", () => {
  // It is not on the required list, and a Worker without it boots.
  assert.equal(Object.hasOwn(SETTINGS, "SUPABASE_JWT_SECRET"), false, "the signing secret is required again");
  assert.ok(Object.hasOwn(OPTIONAL, "SUPABASE_JWT_SECRET"), "the signing secret is not declared as optional either");
  assert.deepEqual(missingSettings(good()), [], "a Worker with no signing secret reads as unconfigured");
  assert.doesNotThrow(() => buildApi(good()));
  // And supplying it is still accepted, as the opt-in local fast path.
  assert.doesNotThrow(() => buildApi(good({ SUPABASE_JWT_SECRET: "s3cret" })));
  // The two lists never overlap, or a setting would be both required and not.
  for (const k of Object.keys(OPTIONAL)) assert.equal(Object.hasOwn(SETTINGS, k), false, `${k} is on both lists`);
});

test("A MISSING SETTING IS A NAMED 503, NOT A CRASH, and never leaks a value", async () => {
  // An uncaught throw is answered by Cloudflare in HTML, and a caller doing
  // `.json()` then learns nothing at all about the cause.
  const res = await worker.fetch(new Request("https://x/runs"), { SUPABASE_URL: "https://p.supabase.co" }, { waitUntil() {} });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.match(body.error, /not configured/);
  assert.match(body.error, /SUPABASE_SERVICE_KEY/);
  assert.match(body.error, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(body.error, new RegExp(QUEUE_BINDING));
  // THE WHOLE BODY, NOT JUST `error`. Asserting on one field let a mutant add a
  // second one carrying the entire environment and survive — the check was about
  // the field rather than about the response.
  assert.deepEqual(Object.keys(body), ["error"], `the 503 carries more than an error: ${Object.keys(body).join(", ")}`);
  const whole = JSON.stringify(body);
  for (const secret of ["https://p.supabase.co", "svc", "sec"]) {
    assert.equal(whole.includes(secret), false, `the 503 quoted a setting's value: ${whole}`);
  }
});

test("AN UNRECOGNISED MODEL IS REFUSED, never defaulted to the stand-in", async () => {
  // Defaulting would mean a deployment that believes it is talking to a provider
  // and is quietly answering from a canned script.
  assert.throws(() => buildApi({ ...good(), MODEL: "claude-sonnet-5" }), /no such model/);
  assert.throws(() => buildApi({ ...good(), MODEL: "gpt-whatever" }), /no such model/);
  const res = await worker.fetch(new Request("https://x/runs"), { ...good(), MODEL: "claude-sonnet-5" }, { waitUntil() {} });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /no such model/);
  // The model is checked BEFORE the dispatcher, so a bad name reports the model.
  // An absent MODEL is the stand-in, which is the documented default.
  assert.doesNotThrow(() => buildApi(good()));
  assert.doesNotThrow(() => buildApi({ ...good(), MODEL: "stand-in" }));
  // The consumer refuses the same name, or the deployment would accept work it
  // could never execute.
  assert.throws(() => buildRunner({ ...good(), MODEL: "gpt-whatever" }), /no such model/);
  assert.deepEqual(Object.keys(MODELS), ["stand-in"]);
});

test("THE SCHEMA IS PASSED EXPLICITLY, not left to the store's default", () => {
  // The store has a default and a default is the thing that silently keeps working
  // while meaning something else. Read from the source, because the value reaching
  // the store is not observable from outside it.
  //
  // **ASSERTED AS THE PROPERTY AND NOT AS THE SPELLING.** The store and the queue are
  // built from ONE object now, so a check pinned to `makeRunStore({… schema: SCHEMA`
  // reported a working deployment as unconfigured the moment the two stopped
  // repeating themselves. What has to be true is that the object both are built from
  // names the schema, and that neither is built from anything else.
  const src = fs.readFileSync(path.join(DIR, "src", "worker.mjs"), "utf8");
  assert.match(src, /const wire = \{[^}]*schema: SCHEMA/, "the shared wire does not name the schema");
  assert.match(src, /makeRunStore\(\{ \.\.\.wire/, "the store is not built from the wire that names the schema");
  assert.equal(SCHEMA, "agent");
});

test("AN UNAUTHENTICATED REQUEST ANSWERS 401 AND QUEUES NOTHING", async () => {
  const env = good();
  const res = await worker.fetch(new Request("https://x/runs", { method: "GET" }), env, { waitUntil() {} });
  // What matters is that it ANSWERED rather than throwing, which is what proves
  // the handler was built and called.
  assert.equal(res.status, 401);
  assert.equal(env[QUEUE_BINDING].sent.length, 0, "an unauthenticated request rang the doorbell");
});

// ── the three handlers, over one fake project ────────────────────────────────
/**
 * Drive the REAL `worker.fetch` / `worker.queue` / `worker.scheduled` against a
 * fake project. `globalThis.fetch` is substituted rather than a dependency being
 * injected, because these three entry points take only what Cloudflare gives them
 * — and the point of this block is to prove the WIRING, which an injected
 * dependency would step around.
 */
async function onFakeProject(body) {
  const rest = memoryRest();
  const real = globalThis.fetch;
  globalThis.fetch = rest.fetch;
  try { return await body(rest); } finally { globalThis.fetch = real; }
}

const b64url = (bs) => btoa(String.fromCharCode(...bs)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
async function signFor(tenant) {
  const payload = { tenant_id: tenant, exp: Math.floor(Date.now() / 1000) + 3600 };
  const head = `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("s3cret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(head)));
  return `${head}.${b64url(sig)}`;
}

test("THE WHOLE WORKER: a request is accepted, a delivery executes it, the result is stored", async () => {
  await onFakeProject(async (rest) => {
    // The opt-in secret, so verification is local and this test is about the queue.
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    const token = await signFor("t1");

    const res = await worker.fetch(new Request("https://x/runs", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: "support", prompt: "hello there" }),
    }), env, ctx);
    assert.equal(res.status, 202, `starting a run answered ${res.status}`);
    const { runId, status, delivered } = await res.json();
    assert.equal(status, "queued");
    assert.equal(delivered, true, "the doorbell did not ring");

    // **THE MESSAGE CARRIES A RUN ID AND NOTHING ELSE.** Everything about the run
    // is already in the database; a message that carried a tenant would be a
    // second, forgeable source for the one fact that decides access.
    assert.equal(env[QUEUE_BINDING].sent.length, 1, "exactly one delivery was not queued");
    assert.deepEqual(Object.keys(env[QUEUE_BINDING].sent[0]), ["runId"],
      `the message carries more than a run id: ${JSON.stringify(env[QUEUE_BINDING].sent[0])}`);
    assert.equal(env[QUEUE_BINDING].sent[0].runId, runId);

    // Nothing has executed, and the run is already fully described in storage.
    assert.deepEqual([...rest.entries.get(runId).values()].map((e) => e.kind), ["started"]);

    // ── the consumer ──────────────────────────────────────────────────────────
    const batch = batchOf(env[QUEUE_BINDING].sent);
    await worker.queue(batch, env, ctx);
    assert.deepEqual(batch.acked, [0], "the delivery was not acked");
    assert.deepEqual(batch.retried, [], "the delivery was retried as well as acked");

    // ── the result ────────────────────────────────────────────────────────────
    const view = await (await worker.fetch(new Request(`https://x/runs/${runId}`, {
      headers: { authorization: `Bearer ${token}` },
    }), env, ctx)).json();
    assert.equal(view.status, "stopped", `the run reads as "${view.status}"`);
    assert.equal(view.stop.reason, "answered");
    assert.match(view.text, /hello there/, "the stand-in's answer never came back");
    assert.deepEqual([...rest.entries.get(runId).values()].map((e) => e.kind),
      ["started", "model", "tool", "model", "stopped"]);
    assert.notEqual(rest.work.get(runId).done_at, null, "finished work was left on the queue");
  });
});

test("EVERY MESSAGE IS ACKED, BECAUSE THERE IS EXACTLY ONE RETRY AUTHORITY", async () => {
  await onFakeProject(async () => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    // The work row decides whether a run is offered again and the sweeper does the
    // offering. The queue retrying as well would give two mechanisms redelivering
    // on different clocks, and a message eventually dead-lettering for a reason
    // that has nothing to do with the run.
    const batch = batchOf([{ runId: "no-such-run" }, {}, { runId: "   " }, { runId: 4 }, null]);
    await worker.queue(batch, env, ctx);
    assert.deepEqual(batch.acked, [0, 1, 2, 3, 4], `acked: ${batch.acked}`);
    assert.deepEqual(batch.retried, [], "a message was left to the queue's own retry");
  });
});

test("A CONSUMER THAT CANNOT BE BUILT RETRIES INSTEAD OF ACKING", async () => {
  // The one case where the queue's retry IS the right mechanism: with no
  // configuration the work row cannot be read, so nothing here can decide anything.
  const batch = batchOf([{ runId: "r1" }, { runId: "r2" }]);
  await worker.queue(batch, { ...good(), SUPABASE_SERVICE_KEY: undefined }, { waitUntil() {} });
  assert.deepEqual(batch.retried, [0, 1], "an unconfigured consumer acked work it never looked at");
  assert.deepEqual(batch.acked, [], "an unconfigured consumer acked as well as retried");
});

test("THE SWEEPER RE-RINGS DROPPED WORK RATHER THAN RUNNING IT", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    const token = await signFor("t1");
    const { runId } = await (await worker.fetch(new Request("https://x/runs", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: "support", prompt: "go" }),
    }), env, ctx)).json();
    env[QUEUE_BINDING].sent.length = 0;          // the first doorbell is lost

    await worker.scheduled({}, env, ctx);
    assert.deepEqual(env[QUEUE_BINDING].sent, [{ runId }], "the dropped run was not offered again");
    // A TICK IS SHORT AND A RUN IS NOT, so the sweeper hands the work back to the
    // queue instead of executing it.
    assert.deepEqual([...rest.entries.get(runId).values()].map((e) => e.kind), ["started"],
      "the sweeper executed the run inside a scheduled tick");

    // Once the work is finished it is never offered again.
    await worker.queue(batchOf([{ runId }]), env, ctx);
    env[QUEUE_BINDING].sent.length = 0;
    await worker.scheduled({}, env, ctx);
    assert.deepEqual(env[QUEUE_BINDING].sent, [], "a finished run is still being swept up");
  });
});

test("the sweeper's bounds are real numbers and it survives an outage", async () => {
  assert.ok(SWEEP_GRACE_S > 0 && SWEEP_LIMIT > 0);
  // An unconfigured or unreachable project must not take the scheduled handler
  // down: a throwing cron is a cron that silently stops running.
  await assert.doesNotReject(() => worker.scheduled({}, { ...good(), SUPABASE_URL: undefined }, { waitUntil() {} }));
  await onFakeProject(async () => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    // **THERE HAS TO BE WORK FOR THE THROW TO REACH.** The first version of this
    // swept an empty table, so `send` was never called and the case passed with the
    // error handling removed — a negative assertion with a dead observer.
    const token = await signFor("t1");
    await worker.fetch(new Request("https://x/runs", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: "support", prompt: "go" }),
    }), env, ctx);
    let rang = 0;
    env[QUEUE_BINDING].send = async () => { rang++; throw new Error("the queue went"); };
    await assert.doesNotReject(() => worker.scheduled({}, env, ctx));
    assert.equal(rang, 1, "the sweeper never tried to ring, so this proves nothing");
  });
});

test("A SWEEPER WITH NOWHERE TO RING DOES NOT EVEN LOOK FOR WORK", async () => {
  // It PRODUCES, so it asks for the full deployment configuration — unlike the
  // consumer, which never sends. Without the binding there is nothing it could do
  // with an answer, and querying anyway is a pointless round trip on every tick.
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    const token = await signFor("t1");
    await worker.fetch(new Request("https://x/runs", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: "support", prompt: "go" }),
    }), env, ctx);
    const before = rest.fetch.calls.filter((c) => String(c.url).includes("sweep_run_work")).length;
    await worker.scheduled({}, { ...env, [QUEUE_BINDING]: undefined }, ctx);
    const after = rest.fetch.calls.filter((c) => String(c.url).includes("sweep_run_work")).length;
    assert.equal(after, before, "an unconfigured sweeper queried for work it could not deliver");
    // THE CONTROL: with the binding, it does look — so the refusal above is about
    // the configuration and not about there being nothing to find.
    await worker.scheduled({}, env, ctx);
    assert.ok(rest.fetch.calls.filter((c) => String(c.url).includes("sweep_run_work")).length > before,
      "the sweeper never looks for work at all");
  });
});

// ── the cron's second job: the schedule ──────────────────────────────────────
/**
 * THE AUTOMATION HALF OF THE CRON, driven through the REAL `worker.scheduled` and
 * `worker.queue`.
 *
 * ⚠ **THESE EXIST BECAUSE A SWEEP SAID SO.** Four breakages survived with every module
 * correct — the cron filing nothing, ringing for occurrences that were never queued,
 * an unbounded catch-up window, and a runner built with no automation executor — and
 * every one of them lives in `scheduled`, which nothing in this directory drove. *A
 * wall nobody can drive is a wall nobody is guarding*, in the handler that decides
 * what happens to a customer's schedule after downtime.
 */
const AUTO = "a1", AGENT = "g1", TENANT = "t1";
const seedAutomation = (rest, { over = {}, status = "active" } = {}) => {
  rest.agents.set(AGENT, { id: AGENT, tenant_id: TENANT, status });
  const row = {
    id: AUTO, tenant_id: TENANT, agent_id: AGENT, name: "Daily note",
    enabled: true, schedule: "daily", at_local: "09:00", zone: "Europe/London",
    steps: [{ id: "s1", type: "note", text: "the shop is open" }],
    next_run_at: Date.now() - 60_000,          // a minute overdue
    occurrence_for: "2026-09-21",              // a Monday
    ...over,
  };
  rest.autos.set(row.id, row);
  return row;
};

test("⚠ THE WHOLE SCHEDULED PATH: the cron files what is due, rings it, and the delivery runs the workflow", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest);

    await worker.scheduled({}, env, ctx);

    // ONE DOORBELL, CARRYING A RUN ID AND NOTHING ELSE — the same message shape the
    // HTTP door sends, because it is the same queue and the same consumer.
    assert.equal(env[QUEUE_BINDING].sent.length, 1, `the cron rang ${env[QUEUE_BINDING].sent.length} times`);
    const { runId } = env[QUEUE_BINDING].sent[0];
    assert.deepEqual(Object.keys(env[QUEUE_BINDING].sent[0]), ["runId"]);
    assert.ok(rest.execs.has(runId), "nothing was filed for the occurrence");
    assert.equal(rest.execs.get(runId).occurrence, "2026-09-21");
    // THE SCHEDULE ADVANCED PAST WHAT IT HANDLED, so a second tick finds nothing.
    assert.ok(rest.autos.get(AUTO).next_run_at > Date.now(), "the automation was left due");

    // Nothing has executed yet: the row is durable and the work is on the queue.
    assert.equal(rest.execs.get(runId).finished_at, null);
    assert.deepEqual([...rest.entries.get(runId).values()].map((e) => e.kind), ["started"]);

    // ── the delivery ─────────────────────────────────────────────────────────
    // ⚠ THIS IS WHAT PROVES `buildRunner` WAS GIVEN AN AUTOMATION EXECUTOR. Without
    // one the delivery answers `no-executor`, takes the work off the queue and writes
    // no outcomes — which reads, from the queue's side alone, exactly like success.
    const batch = batchOf(env[QUEUE_BINDING].sent);
    await worker.queue(batch, env, ctx);
    assert.deepEqual(batch.acked, [0]);

    const exec = rest.execs.get(runId);
    assert.notEqual(exec.finished_at, null, "the execution was never finished");
    assert.deepEqual(exec.outcomes.map((o) => o.outcome), ["ran"], JSON.stringify(exec.outcomes));
    assert.equal(rest.runs.get(runId).status, "stopped");
    assert.equal(rest.runs.get(runId).stop.reason, "done");
    assert.equal(rest.runs.get(runId).stop.result, "the shop is open",
      "the saved note is the execution's result");
    assert.notEqual(rest.work.get(runId).done_at, null, "finished work was left on the queue");
  });
});

test("⚠ an occurrence that was ALREADY filed is not rung a second time", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest);
    await worker.scheduled({}, env, ctx);
    assert.equal(env[QUEUE_BINDING].sent.length, 1);
    const first = env[QUEUE_BINDING].sent[0].runId;
    // ⚠ THE FIRST DELIVERY IS CONSUMED FIRST, and not for tidiness: an unclaimed work
    // row is exactly what the sweeper's own job re-offers, so without this the second
    // tick's assertion would be satisfied by the SWEEPER ringing and say nothing about
    // the schedule. (Measured — that is how this case failed when it was written.)
    await worker.queue(batchOf(env[QUEUE_BINDING].sent), env, ctx);
    assert.notEqual(rest.work.get(first).done_at, null, "the first delivery did not finish");
    env[QUEUE_BINDING].sent.length = 0;

    // **AN EDIT TO THE TIME OF DAY REWRITES `next_run_at`, AND CAN PUT IT BACK ON A DAY
    // ALREADY FILED** — which is how `already` happens outside a race, and why the ring
    // asks what the tick DID rather than merely whether a run id came back.
    rest.autos.get(AUTO).next_run_at = Date.now() - 60_000;
    await worker.scheduled({}, env, ctx);

    assert.deepEqual(env[QUEUE_BINDING].sent, [], "a second doorbell for an occurrence already filed");
    assert.equal([...rest.execs.values()].filter((e) => e.automation_id === AUTO).length, 1,
      "the duplicate delivery made a second execution");
    assert.ok(rest.execs.has(first));
  });
});

test("⚠ DOWNTIME IS NOT A BURST: a stale occurrence is recorded as missed, never run", async () => {
  // THE DECISION THIS BOUND CARRIES. Unbounded, a Worker that was away for a week
  // would come back and run every occurrence it slept through, all at once, on a
  // customer's schedule. Bounded, each automation gets at most its latest one.
  assert.ok(AUTOMATION_CATCHUP_S > 0, "there is no catch-up window at all");
  assert.ok(AUTOMATION_CATCHUP_S <= 24 * 3600,
    `a catch-up window of ${AUTOMATION_CATCHUP_S}s is longer than a day, so downtime IS a burst`);
  assert.ok(AUTOMATION_TICK_LIMIT > 0 && AUTOMATION_TICK_LIMIT <= 500);

  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    const stale = Date.now() - (AUTOMATION_CATCHUP_S * 1000 + 60_000);
    seedAutomation(rest, { over: { next_run_at: stale } });

    await worker.scheduled({}, env, ctx);

    assert.deepEqual(env[QUEUE_BINDING].sent, [], "a missed occurrence was rung");
    const missed = [...rest.execs.values()].filter((e) => e.automation_id === AUTO);
    assert.equal(missed.length, 1, "a missed occurrence left no record at all");
    // RECORDED, NOT SKIPPED. An account that was away and then sees nothing in the
    // history cannot tell that from an automation that never worked.
    assert.notEqual(missed[0].finished_at, null);
    assert.equal(rest.runs.get(missed[0].id).stop.reason, "missed");
    assert.equal(rest.work.has(missed[0].id), false, "a missed occurrence left work on the queue");
    assert.ok(rest.autos.get(AUTO).next_run_at > stale, "the schedule never moved past the stale occurrence");

    // THE CONTROL, in the same fixture: a FRESH occurrence on the same automation is
    // filed and rung — so the refusal above is about the window and not about the
    // scheduler being dead.
    rest.autos.get(AUTO).next_run_at = Date.now() - 60_000;
    rest.autos.get(AUTO).occurrence_for = "2026-09-22";
    await worker.scheduled({}, env, ctx);
    assert.equal(env[QUEUE_BINDING].sent.length, 1, "a fresh occurrence was not filed either");
  });
});

test("a disabled automation and a paused agent are recorded, and neither is rung", async () => {
  for (const [name, over] of [["disabled", { enabled: false }], ["paused", {}]]) {
    await onFakeProject(async (rest) => {
      const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
      const ctx = { waitUntil() {} };
      // ⚠ A DISABLED AUTOMATION IS STILL SELECTED BY NOTHING — the tick's own filter
      // takes it out — so the refusal that matters here is the PAUSE, which the tick
      // cannot see and `accept_automation_run` answers. Both are driven, because the
      // two are different sentences to an account and only one of them is in the tick.
      seedAutomation(rest, { over, status: name === "paused" ? "paused" : "active" });
      await worker.scheduled({}, env, ctx);
      assert.deepEqual(env[QUEUE_BINDING].sent, [], `${name}: new work was queued anyway`);
      assert.equal(rest.work.size, 0, `${name}: a work row was written`);
      if (name === "paused") {
        const rec = [...rest.execs.values()];
        assert.equal(rec.length, 1, "a paused agent's occurrence left no record");
        assert.equal(rest.runs.get(rec[0].id).stop.reason, "paused");
      }
    });
  }
});

test("the schedule's failure cannot take the sweeper down, and vice versa", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest);
    // A ZONE THE TIME ZONE DATABASE NO LONGER CARRIES is the shape that makes the
    // arithmetic raise. Here it is a tick that throws outright, which is the same
    // thing from `scheduled`'s side: two jobs, two blocks, neither silencing the other.
    const token = await signFor(TENANT);
    await worker.fetch(new Request("https://x/runs", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: "support", prompt: "go" }),
    }), env, ctx);
    env[QUEUE_BINDING].sent.length = 0;
    rest.autos.get(AUTO).next_run_at = NaN;            // selected by nothing; the tick still runs
    const real = rest.fetch;
    let broke = 0;
    const patched = async (url, init) => {
      if (String(url).includes("tick_automations")) { broke += 1; throw new Error("the schedule went"); }
      return real(url, init);
    };
    patched.calls = real.calls;
    globalThis.fetch = patched;
    await assert.doesNotReject(() => worker.scheduled({}, env, ctx));
    assert.equal(broke, 1, "the scheduler never ran, so this proves nothing");
    // THE SWEEPER STILL DID ITS JOB: the dropped run was offered again.
    assert.equal(env[QUEUE_BINDING].sent.length, 1, "a broken schedule took the sweeper down with it");
  });
});

test("THE QUEUE TARGETS THE SAME SCHEMA AS THE STORE, named explicitly", () => {
  // `makeWork` defaults to the same schema, so leaving it out is invisible from
  // outside — and a default is what silently keeps working while meaning something
  // else the day a second schema exists. Read from the source, as the store's is.
  const src = fs.readFileSync(path.join(DIR, "src", "worker.mjs"), "utf8");
  assert.match(src, /const wire = \{[^}]*schema: SCHEMA/, "the shared wire does not name the schema");
  assert.match(src, /makeWork\(wire\)/, "the queue is not built from the wire that names the schema");
  assert.match(src, /makeRunStore\(\{ \.\.\.wire/, "the store is not built from the wire that names the schema");
});

// ── the registry and the stand-in ────────────────────────────────────────────
test("the registry holds real agents, and a request can only NAME one", () => {
  assert.ok(Object.keys(AGENTS).length >= 1);
  for (const [name, a] of Object.entries(AGENTS)) {
    assert.equal(a.kind, "agent", `${name} is not from defineAgent`);
    assert.ok(a.instructions.length > 0);
    assert.ok(Object.isFrozen(a));
  }
  assert.ok(Object.isFrozen(AGENTS), "the registry can be added to at runtime");
});

test("THE STAND-IN DRIVES A WHOLE RUN: a step, a tool, a second step, an answer", async () => {
  // It reports usage and cost the way a provider does, so the meters and the
  // budget are exercised rather than bypassed.
  const r = await runAgent({ agent: AGENTS.support, prompt: "hello there", send: makeStandIn(), tenant: { id: "t1" } });
  assert.equal(r.ok, true, `stopped on ${r.stop.reason}`);
  assert.equal(r.used.steps, 2);
  assert.equal(r.used.toolCalls, 1);
  assert.equal(r.used.tokens, 48, "the stand-in reported no usable usage");
  assert.equal(r.used.costMicros, 100);
  assert.match(r.text, /hello there/, "the tool's answer never reached the second call");
  assert.equal(r.steps[0].results[0].ok, true);
});

test("the stand-in stays inside the agent's bounds", async () => {
  // Its second answer has no tool calls, so a run ends well inside `steps: 4`.
  assert.equal(AGENTS.support.limits.steps, 4);
  const r = await runAgent({ agent: AGENTS.support, prompt: "x", send: makeStandIn(), tenant: { id: "t1" } });
  assert.ok(r.used.steps < AGENTS.support.limits.steps, "the stand-in runs to the step ceiling");
});

// ── the Worker config is this directory's own ────────────────────────────────
test("THE WORKER CONFIG IS SEPARATE AND CANNOT SHIP BY ACCIDENT", () => {
  const mine = path.join(DIR, "wrangler.jsonc");
  assert.ok(fs.existsSync(mine), "this directory has no wrangler config");
  const cfg = JSON.parse(fs.readFileSync(mine, "utf8").replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(cfg.main, "src/worker.mjs");
  assert.notEqual(cfg.name, "isibi-app", "it shares the other product's Worker name");
  // **NO SENSITIVE SETTING MAY BE A COMMITTED VAR — and the list is derived, so a
  // setting added later is covered by existing.** The others deliberately ARE vars:
  // a project URL is public and a publishable key is designed to be handed to
  // browsers, so committing them makes the deployment one secret instead of three.
  const raw = fs.readFileSync(mine, "utf8");
  for (const k of SENSITIVE) {
    assert.equal(cfg.vars?.[k], undefined, `${k} is a var in the committed config`);
    assert.equal(raw.includes(`"${k}":`), false, `${k} appears in the committed config`);
  }
  // Every sensitive name must be a setting this Worker actually reads, or the list
  // is protecting something that does not exist while missing something that does.
  for (const k of SENSITIVE) {
    assert.ok(Object.hasOwn(SETTINGS, k) || Object.hasOwn(OPTIONAL, k), `${k} is not a setting at all`);
  }
  // AND THE NON-SENSITIVE ONES REALLY ARE SET, so a deploy from this file is
  // configured except for the one secret. A missing var here would read, at runtime,
  // as exactly the same 503 as a missing secret.
  for (const k of Object.keys(SETTINGS)) {
    if (SENSITIVE.includes(k)) continue;
    assert.ok(typeof cfg.vars?.[k] === "string" && cfg.vars[k].trim() !== "",
      `${k} is neither a secret nor a configured var, so the deploy is incomplete`);
  }
  // The publishable key must BE a publishable one. A service key pasted into this
  // slot would be committed and would look like it worked.
  assert.doesNotMatch(cfg.vars.SUPABASE_PUBLISHABLE_KEY, /service_role/,
    "a service-role key is committed in the publishable slot");
  assert.match(cfg.vars.SUPABASE_URL, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
  assert.match(raw, /docs\/deploy\.md/, "the config does not point at the deployment steps");

  // **THE QUEUE IS CONFIGURED, AND ITS NAME COMES FROM THE CODE.** Two copies of a
  // binding name is the commonest way a deployment is wired to nothing: the Worker
  // reads `env.RUN_QUEUE`, the config binds something else, and every request
  // answers 503 for a reason that reads like a missing secret.
  assert.ok(cfg.queues?.producers?.length, "the config binds no queue producer");
  assert.equal(cfg.queues.producers[0].binding, QUEUE_BINDING,
    `the config binds ${cfg.queues.producers[0].binding} and the Worker reads ${QUEUE_BINDING}`);
  const queueName = cfg.queues.producers[0].queue;
  assert.ok(cfg.queues?.consumers?.length, "nothing consumes the queue, so no run would ever execute");
  assert.equal(cfg.queues.consumers[0].queue, queueName,
    "the consumer is attached to a different queue from the producer");
  // ONE RUN PER INVOCATION. A batch is handled inside one invocation, so a second
  // long run in the same batch could be cut off before it started.
  assert.equal(cfg.queues.consumers[0].max_batch_size, 1,
    "more than one run per invocation, so a long run can starve the next one in its batch");

  // THE SWEEPER IS SCHEDULED, or a lost doorbell loses the work.
  assert.ok(Array.isArray(cfg.triggers?.crons) && cfg.triggers.crons.length,
    "no cron, so nothing ever re-offers dropped work");
  // AND IT RUNS OFTENER THAN THE LEASE LASTS. A cron slower than the lease would
  // leave dropped work sitting for no reason. Derived from the runner's own numbers
  // rather than eyeballed.
  const everyMinute = cfg.triggers.crons.some((c) => /^(\*|\*\/1) /.test(c));
  assert.ok(everyMinute, `the sweep cron is ${cfg.triggers.crons.join(", ")}, slower than the ${LEASE_TTL_S}s lease`);
  // The root config belongs to the other product and is not touched by this one.
  const root = path.resolve(DIR, "..", "wrangler.jsonc");
  if (fs.existsSync(root)) {
    const rootCfg = fs.readFileSync(root, "utf8");
    assert.equal(rootCfg.includes("agent-builder"), false, "the root Worker config now references this directory");
  }
});

test("GET /health SAYS WHAT IS DEPLOYED, WITHOUT A TOKEN AND WITHOUT A SECRET", async () => {
  // A deployment cannot be verified if nothing can be asked which version answered.
  const env = good();
  for (const path of ["/health", "/", "/health/"]) {
    const res = await worker.fetch(new Request(`https://x${path}`), env, { waitUntil() {} });
    assert.equal(res.status, 200, `${path} answered ${res.status}`);
    // **IT FORBIDS CACHING, because this route is read to decide whether a deploy
    // landed.** A 200 with no directive is cacheable by anything in between, and the
    // one question it exists to answer — which version is serving — is the question a
    // cached body answers wrongly while looking perfectly healthy. It is not a fix for
    // propagation (an edge can honestly still be on the old version); it removes the
    // OTHER explanation, so that a reader which keeps asking is really asking.
    assert.match(res.headers.get("cache-control") ?? "", /no-store/,
      `${path} may be cached, so a stale version can be reported as the deployed one`);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.model, "stand-in");
    assert.equal(body.schema, SCHEMA);
    assert.deepEqual(body.missing, []);
    assert.deepEqual(body.agents.sort(), Object.keys(AGENTS).sort(), "the agent list is not the registry's");
    // **NOT A SINGLE SETTING VALUE, anywhere in the response.** This is the one
    // unauthenticated route, so it is also the one that could leak by accident.
    const whole = JSON.stringify(body);
    for (const v of ["svc", "pub", "https://p.supabase.co", "s3cret"]) {
      assert.equal(whole.includes(v), false, `/health quoted a setting's value: ${whole}`);
    }
  }

  // IT ANSWERS WHEN THE WORKER IS NOT CONFIGURED, which is when it is asked most —
  // and it names what is missing, exactly as the 503 already does to any caller.
  const bare = await worker.fetch(new Request("https://x/health"), { MODEL: "stand-in" }, { waitUntil() {} });
  assert.equal(bare.status, 200);
  const bareBody = await bare.json();
  assert.equal(bareBody.ok, false);
  assert.deepEqual(bareBody.missing.sort(), ALL_REQUIRED());

  // **A MODEL THIS WORKER CANNOT RUN IS REPORTED AS CONFIGURED AND NOT OK.** Such a
  // deployment answers 503 on every request while every setting is present, so
  // `missing` alone would say nothing is wrong — and echoing the default instead of
  // the configured name would hide it completely. A sweep found this.
  const wrongModel = await worker.fetch(new Request("https://x/health"),
    { ...good(), MODEL: "grok-4" }, { waitUntil() {} });
  const wm = await wrongModel.json();
  assert.equal(wrongModel.status, 200, "/health stopped answering for an unknown model");
  assert.equal(wm.model, "grok-4", "/health echoed the default instead of what is configured");
  assert.equal(wm.modelKnown, false);
  assert.equal(wm.ok, false, "/health called an unrunnable deployment ok");
  assert.deepEqual(wm.missing, [], "the unknown model was reported as a missing setting");
  // ...and a request really does fail, so `ok: false` is the truth and not caution.
  assert.equal((await worker.fetch(new Request("https://x/runs"), { ...good(), MODEL: "grok-4" }, { waitUntil() {} })).status, 503);

  // The version comes from Cloudflare's binding, and is `null` rather than invented
  // when there is none — a made-up version is worse than no version.
  assert.equal((await (await worker.fetch(new Request("https://x/health"), env, { waitUntil() {} })).json()).version, null);
  const stamped = await worker.fetch(new Request("https://x/health"),
    { ...env, CF_VERSION_METADATA: { id: "v-123", tag: "t", timestamp: "2026-09-15T00:00:00Z" } }, { waitUntil() {} });
  const sb = await stamped.json();
  assert.equal(sb.version, "v-123");
  assert.equal(sb.deployedAt, "2026-09-15T00:00:00Z");

  // And it is a READ: no other method reaches it, and /health never queues anything.
  assert.equal((await worker.fetch(new Request("https://x/health", { method: "POST" }), env, { waitUntil() {} })).status, 401);
  assert.equal(env[QUEUE_BINDING].sent.length, 0);
});

test("THE SWEEP'S GRACE IS AT LEAST ONE BEAT, so a lapsed lease is never handed on before its holder can notice", () => {
  // **THE INVARIANT THAT MAKES THE LEASE GATES ENOUGH, and it was unpinned until a
  // live verification had to reason about it.** A worker learns its lease is gone at
  // its next beat, so there is a window — up to one beat — in which it is still
  // working and does not know. The sweeper's grace is what keeps that window from
  // overlapping with another consumer's: a lapsed lease is only offered to somebody
  // else after the grace, by which time the holder has had a beat in which to stop.
  //
  // Drop the grace below a beat and the two windows overlap, which is two workers on
  // one run. Nothing else in the codebase says so, so it is said here.
  assert.ok(SWEEP_GRACE_S * 1000 >= BEAT_EVERY_MS,
    `the sweep grace is ${SWEEP_GRACE_S}s and a beat is ${BEAT_EVERY_MS}ms — a lapsed lease can be handed on before its holder notices`);
  // And the lease itself must outlast a beat, or a healthy worker loses its own run.
  assert.ok(LEASE_TTL_S * 1000 > BEAT_EVERY_MS,
    `the lease is ${LEASE_TTL_S}s and a beat is ${BEAT_EVERY_MS}ms — a beating worker would still lose its lease`);
});

// ── the third cron job: releasing work that was waiting ─────────────────────

test("⚠ THE RESUME TICK WAKES WHAT IS DUE, ONE RING EACH, AND ONLY WHAT IT RE-QUEUED", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    const auto = seedAutomation(rest, { over: { next_run_at: null, occurrence_for: null, schedule: "manual" } });

    // Three suspended executions: one overdue, one not yet due, and one overdue that
    // somebody is already holding. Each is a different answer from `resume_due_automations`
    // and the tick has to read all three differently.
    const suspend = (id, waitUntil, heldBy = null) => {
      rest.execs.set(id, {
        id, automation_id: auto.id, tenant_id: TENANT, agent_id: AGENT, trigger: "manual",
        occurrence: null, steps: auto.steps, zone: "UTC", finished_at: null, position: 0,
        vars: {}, input: {}, memory: {}, decisions: {},
        waiting: { kind: "wait", step: "s1", mode: "for", minutes: 30 },
        wait_until: new Date(waitUntil).toISOString(), created_at: new Date().toISOString(),
      });
      rest.runs.set(id, { id, tenant_id: TENANT, status: "running", stop: null });
      rest.work.set(id, {
        run_id: id, tenant_id: TENANT, kind: "start", executor: "automation", attempts: 0,
        claimed_by: heldBy, claim_token: heldBy ? "tok-other" : null,
        lease_expires_at: heldBy ? Date.now() + 60_000 : null,
        done_at: heldBy ? null : Date.now(), enqueued_at: Date.now(), last_error: null,
      });
    };
    suspend("due-1", Date.now() - 120_000);
    suspend("not-yet", Date.now() + 3_600_000);
    suspend("held", Date.now() - 60_000, "somebody-else");

    await worker.scheduled({}, env, ctx);

    const rung = env[QUEUE_BINDING].sent.map((m) => m.runId);
    // ⚠ **ONLY A ROW IT REALLY RE-QUEUED IS RUNG.** An execution somebody is holding
    // answers `running` — a doorbell for that is a delivery `claim_run` refuses, so it is
    // latency spent to learn nothing.
    assert.deepEqual(rung, ["due-1"], `the tick rang ${JSON.stringify(rung)}`);
    assert.equal(rest.work.get("due-1").kind, "resume", "the due execution was not re-queued");
    assert.equal(rest.work.get("due-1").done_at, null);
    // NOT YET DUE IS UNTOUCHED — the deadline is the whole of what decides.
    assert.equal(rest.work.get("not-yet").kind, "start");
    assert.notEqual(rest.work.get("not-yet").done_at, null);
    // AND THE HELD ONE KEEPS ITS HOLDER's claim rather than being taken from under it.
    assert.equal(rest.work.get("held").claimed_by, "somebody-else");

    // A SECOND TICK RINGS IT AGAIN, AND TWICE OVER — measured rather than predicted, and
    // harmless by construction. The first tick left the row queued (`done_at` null, nobody
    // holding it), which is exactly what the SWEEPER is for, so the second invocation rings
    // it once from the sweeper and once from the resume. `claim_run` is what makes a
    // duplicate delivery cost nothing, and the property worth asserting is that every ring
    // names the due row — never the one that is not due, and never the one somebody holds.
    env[QUEUE_BINDING].sent.length = 0;
    await worker.scheduled({}, env, ctx);
    const again = env[QUEUE_BINDING].sent.map((m) => m.runId);
    assert.ok(again.length >= 1, "the second tick rang nothing");
    assert.deepEqual([...new Set(again)], ["due-1"], `the second tick rang ${JSON.stringify(again)}`);
  });
});

test("the resume tick's batch is bounded, and its failure cannot take the other two down", async () => {
  // A BOUND IS WHAT STOPS ONE TICK WAKING EVERYTHING AT ONCE after an outage — a cron
  // invocation has a ceiling, and a burst of deliveries it cannot serve is worse than
  // a backlog worked through a tick at a time.
  assert.ok(Number.isInteger(AUTOMATION_RESUME_LIMIT));
  assert.ok(AUTOMATION_RESUME_LIMIT > 0 && AUTOMATION_RESUME_LIMIT <= 500,
    `the resume batch is ${AUTOMATION_RESUME_LIMIT}`);

  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest);
    const real = rest.fetch;
    let broke = 0;
    const patched = async (url, init) => {
      if (String(url).includes("resume_due_automations")) { broke += 1; throw new Error("the resume went"); }
      return real(url, init);
    };
    patched.calls = real.calls;
    globalThis.fetch = patched;
    // THREE JOBS, THREE BLOCKS: a broken resume must not stop the schedule filing what
    // is due, which is the property the other two already have between them.
    await assert.doesNotReject(() => worker.scheduled({}, env, ctx));
    assert.equal(broke, 1, "the resume tick never ran, so this proves nothing");
    assert.equal(env[QUEUE_BINDING].sent.length, 1, "a broken resume took the scheduler down with it");
  });
});

test("⚠ a RING that fails costs that row its latency and nothing else", async () => {
  // The work is committed by the time the doorbell is rung, so a failed ring decides how
  // SOON an execution carries on and never whether it does — and one bad send must not
  // take the rows behind it down, which is the difference between a backlog draining and
  // a backlog stopping at whichever row the queue hiccuped on.
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    const auto = seedAutomation(rest, { over: { next_run_at: null, occurrence_for: null, schedule: "manual" } });
    for (const id of ["a-first", "b-second"]) {
      rest.execs.set(id, {
        id, automation_id: auto.id, tenant_id: TENANT, agent_id: AGENT, trigger: "manual",
        occurrence: null, steps: auto.steps, zone: "UTC", finished_at: null, position: 0,
        vars: {}, input: {}, memory: {}, decisions: {},
        waiting: { kind: "wait", step: "s1", mode: "for", minutes: 30 },
        wait_until: new Date(Date.now() - 120_000).toISOString(), created_at: new Date().toISOString(),
      });
      rest.runs.set(id, { id, tenant_id: TENANT, status: "running", stop: null });
      rest.work.set(id, {
        run_id: id, tenant_id: TENANT, kind: "start", executor: "automation", attempts: 0,
        claimed_by: null, claim_token: null, lease_expires_at: null,
        done_at: Date.now(), enqueued_at: Date.now(), last_error: null,
      });
    }
    // THE FIRST RING THROWS. The second row must still be rung.
    const realSend = env[QUEUE_BINDING].send.bind(env[QUEUE_BINDING]);
    let n = 0;
    env[QUEUE_BINDING].send = async (m) => {
      if (++n === 1) throw new Error("the queue hiccuped");
      return realSend(m);
    };
    await assert.doesNotReject(() => worker.scheduled({}, env, ctx));
    assert.deepEqual(env[QUEUE_BINDING].sent.map((m) => m.runId), ["b-second"],
      "one failed ring stopped the rest of the tick");
    // ⚠ AND BOTH ROWS ARE RE-QUEUED EITHER WAY, because the transaction did that before
    // anything was rung — so the one whose ring failed is picked up by the next tick.
    for (const id of ["a-first", "b-second"]) {
      assert.equal(rest.work.get(id).kind, "resume", `${id} was not re-queued`);
      assert.equal(rest.work.get(id).done_at, null, `${id} is still off the queue`);
    }
  });
});

// ── the backend the deployment's own tools reach ─────────────────────────────

const MEM_AGENT = "44444444-4444-4444-8444-444444444444";

test("⚠ A DELIVERY'S TOOLS REACH THE REAL STORE — the hop between the Worker and a capability", async () => {
  // **THE WIRING LAYER, at the only place both halves exist at once.** `parts` builds the
  // capability backend and `buildRunner` hands it to `makeRunner`; drop that ONE key and
  // every capability tool answers `no-backend`, the run still completes, the queue still
  // acks, and the customer is told the agent remembers nothing. MEASURED: a mutant cutting
  // `capabilities` out of that argument list SURVIVED the whole suite — nothing drove a
  // capability tool through a real delivery.
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    rest.agents.set(MEM_AGENT, { id: MEM_AGENT, tenant_id: "t1", status: "active" });
    rest.mem.set("m-1", { id: "m-1", tenant_id: "t1", agent_id: MEM_AGENT,
                          key: "opening_hours", value: "nine to five", version: 2, source: "person" });

    const runId = "run-mem-1";
    const accepted = await rest.fetch("https://p.supabase.co/rest/v1/rpc/accept_run", {
      method: "POST", headers: { "content-profile": "agent" },
      body: JSON.stringify({
        p_run_id: runId, p_tenant: "t1", p_kind: "start",
        p_entry: startedEntry({
          at: "2026-09-17T00:00:00Z", tenant: "t1", agent: AUTHORED_AGENT, model: "stand-in",
          // The stand-in picks the tool the request names, so the prompt is what makes
          // this a `list_memory` call rather than a guess about its ordering.
          prompt: "use list_memory and tell me what you remember",
          limits: limitsToJson({ steps: 2 }),
          instructions: "You answer about the shop.", history: [],
          authoredAgent: MEM_AGENT, message: "msg-1", tools: ["list_memory"],
        }),
      }),
    });
    assert.equal(accepted.status, 200, await accepted.text());

    const batch = batchOf([{ runId }]);
    await worker.queue(batch, env, ctx);
    assert.deepEqual(batch.acked, [0], "the delivery was retried rather than finished");

    // ⚠ THE ASSERTION IS ON WHAT THE TOOL GOT BACK, not on the run finishing. A run with
    // no backend finishes just as happily — with `no-backend` in the tool result, which is
    // what the mutant produced.
    const log = [...rest.entries.get(runId).values()];
    const tools = log.filter((e) => e.kind === "tool");
    assert.equal(tools.length, 1, `the model called ${tools.length} tools: ${JSON.stringify(log.map((e) => e.kind))}`);
    assert.equal(tools[0].name, "list_memory");
    assert.equal(tools[0].value?.ok, true, `the tool refused: ${JSON.stringify(tools[0].value)}`);
    assert.deepEqual(tools[0].value.memories.map((m) => m.name), ["opening_hours"],
      "the tool answered without reaching the store");
    assert.equal(tools[0].value.memories[0].value, "nine to five");

    // AND IT WAS SCOPED TO THE AUTHORED AGENT, not to some other agent of the same account
    // — the tenant comes from the claim and the agent from the run's own snapshot.
    const asked = rest.fetch.calls.filter((c) => c.url.endsWith("/rpc/list_memory"));
    assert.equal(asked.length, 1);
    assert.equal(asked[0].body.p_tenant, "t1");
    assert.equal(asked[0].body.p_agent_id, MEM_AGENT);
  });
});

test("...AND A SIBLING'S MEMORY IS NOT THIS AGENT'S, through the real delivery", async () => {
  // THE CONTROL that makes the case above about the wiring rather than about the fake:
  // the same run against an agent that owns nothing answers an empty list, so "it came
  // back with a memory" cannot be satisfied by a store that answers everything.
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    const other = "55555555-5555-4555-8555-555555555555";
    rest.agents.set(MEM_AGENT, { id: MEM_AGENT, tenant_id: "t1", status: "active" });
    rest.agents.set(other, { id: other, tenant_id: "t1", status: "active" });
    rest.mem.set("m-1", { id: "m-1", tenant_id: "t1", agent_id: other,
                          key: "opening_hours", value: "nine to five", version: 1, source: "person" });

    const runId = "run-mem-2";
    await rest.fetch("https://p.supabase.co/rest/v1/rpc/accept_run", {
      method: "POST", headers: { "content-profile": "agent" },
      body: JSON.stringify({
        p_run_id: runId, p_tenant: "t1", p_kind: "start",
        p_entry: startedEntry({
          at: "2026-09-17T00:00:00Z", tenant: "t1", agent: AUTHORED_AGENT, model: "stand-in",
          prompt: "use list_memory and tell me what you remember",
          limits: limitsToJson({ steps: 2 }),
          instructions: "You answer about the shop.", history: [],
          authoredAgent: MEM_AGENT, message: "msg-1", tools: ["list_memory"],
        }),
      }),
    });
    await worker.queue(batchOf([{ runId }]), env, ctx);
    const tool = [...rest.entries.get(runId).values()].find((e) => e.kind === "tool");
    assert.equal(tool.value.ok, true);
    assert.deepEqual(tool.value.memories, [], "a sibling agent's memory was handed over");
  });
});

test("⚠ A GATED CALL REALLY IS PUT TO A PERSON, THROUGH THE DEPLOYED WIRING", async () => {
  // **THE WIRING LAYER, at the only place both halves exist at once.** `parts` builds the
  // approval store and `buildRunner` hands it to `makeRunner`; drop that ONE key and every
  // gated call answers `no-approver`, the run completes, the queue acks, and a tool a
  // person was supposed to authorise is quietly never run and never asked about. MEASURED:
  // two mutants — the key cut from the argument list, and the store never built — SURVIVED
  // the whole suite, because nothing drove a gated tool through a real delivery.
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    rest.agents.set(MEM_AGENT, { id: MEM_AGENT, tenant_id: "t1", status: "active" });

    const runId = "run-gate-1";
    const accepted = await rest.fetch("https://p.supabase.co/rest/v1/rpc/accept_run", {
      method: "POST", headers: { "content-profile": "agent" },
      body: JSON.stringify({
        p_run_id: runId, p_tenant: "t1", p_kind: "start",
        p_entry: startedEntry({
          at: "2026-09-17T00:00:00Z", tenant: "t1", agent: AUTHORED_AGENT, model: "stand-in",
          prompt: "use pause_automation with id=" + MEM_AGENT + " to turn it off",
          limits: limitsToJson({ steps: 2 }),
          instructions: "You look after the shop.", history: [],
          authoredAgent: MEM_AGENT, message: "msg-1", tools: ["pause_automation"],
        }),
      }),
    });
    assert.equal(accepted.status, 200, await accepted.text());

    const batch = batchOf([{ runId }]);
    await worker.queue(batch, env, ctx);
    assert.deepEqual(batch.acked, [0]);

    // ⚠ NOTHING RAN, AND THE ASSERTION IS ON THE ROW — not on the run finishing. A run
    // with no approval store finishes just as happily, with `no-approver` in the tool
    // result, which is what the mutants produced.
    assert.equal(rest.approvals.size, 1, "the call was never put to anybody");
    const row = [...rest.approvals.values()][0];
    assert.equal(row.tool, "pause_automation");
    assert.equal(row.tenant_id, "t1", "the account came from somewhere other than the claim");
    assert.equal(row.agent_id, MEM_AGENT);
    assert.equal(row.verdict, null, "the request arrived already answered");
    assert.equal(row.args.id, MEM_AGENT, "the arguments a person answers about are not the model's");
    assert.equal(typeof row.args_hash, "string");
    assert.ok(row.args_hash.length === 64, `the arguments were sent unhashed: ${row.args_hash}`);

    // AND THE RUN IS STILL OPEN, with its call pending — the durable wait.
    assert.equal(rest.runs.get(runId).status, "running");
    assert.deepEqual([...rest.entries.get(runId).values()].map((e) => e.kind), ["started", "model"]);
    assert.notEqual(rest.work.get(runId).done_at, null, "the delivery was left claimable");
  });
});

test("...AND A SECOND DELIVERY FINDS THE FIRST REQUEST rather than making another", async () => {
  // THE CONTROL that makes the case above about the wiring rather than about the fake: a
  // redelivery re-asks, and one person has one thing to answer.
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    rest.agents.set(MEM_AGENT, { id: MEM_AGENT, tenant_id: "t1", status: "active" });
    const runId = "run-gate-2";
    const entry = startedEntry({
      at: "2026-09-17T00:00:00Z", tenant: "t1", agent: AUTHORED_AGENT, model: "stand-in",
      prompt: "use pause_automation with id=" + MEM_AGENT + " to turn it off",
      limits: limitsToJson({ steps: 2 }),
      instructions: "You look after the shop.", history: [],
      authoredAgent: MEM_AGENT, message: "msg-1", tools: ["pause_automation"],
    });
    await rest.fetch("https://p.supabase.co/rest/v1/rpc/accept_run", {
      method: "POST", headers: { "content-profile": "agent" },
      body: JSON.stringify({ p_run_id: runId, p_tenant: "t1", p_kind: "start", p_entry: entry }),
    });
    await worker.queue(batchOf([{ runId }]), env, ctx);
    // Put it back on the queue the way a decision does, and deliver again.
    await rest.fetch("https://p.supabase.co/rest/v1/rpc/requeue_run", {
      method: "POST", headers: { "content-profile": "agent" },
      body: JSON.stringify({ p_run_id: runId, p_tenant: "t1" }),
    });
    await worker.queue(batchOf([{ runId }]), env, ctx);
    assert.equal(rest.approvals.size, 1, "a redelivery made a second thing to answer");
    // The model was asked once and only once: the second delivery resumed from the log.
    assert.equal([...rest.entries.get(runId).values()].filter((e) => e.kind === "model").length, 1);
  });
});

test("⚠ THE EXPIRY TICK PUTS BACK EVERY RUN NOBODY ANSWERED, AND ONLY THOSE", async () => {
  // ⚠ **WHY THIS JOB EXISTS AT ALL, measured rather than reasoned about.** A run waiting for a
  // person has its work row marked DONE — there is nothing to redeliver until somebody answers
  // — and `agent.decide_tool_approval` is what puts it back. So when NOBODY answers, nothing
  // does: a redelivery answers `not-claimable` and the run sits for ever reading as `running`
  // with a refusal that is correct and unreachable. The cron is the only thing that runs
  // without anybody pressing anything, so this is its fourth job.
  assert.ok(Number.isInteger(APPROVAL_SWEEP_LIMIT));
  assert.ok(APPROVAL_SWEEP_LIMIT > 0 && APPROVAL_SWEEP_LIMIT <= 500, `the batch is ${APPROVAL_SWEEP_LIMIT}`);

  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    let n = 0;
    /** One run holding one request, with its work row done as a held run's is. */
    const holding = (id, expiresAt, { alsoLive = false, ended = false, heldBy = null } = {}) => {
      rest.runs.set(id, { id, tenant_id: TENANT, status: "running", stop: null });
      rest.agents.set(AGENT, { id: AGENT, tenant_id: TENANT, name: "A", instructions: "x", status: "active", tools: [] });
      rest.work.set(id, {
        run_id: id, tenant_id: TENANT, kind: "start", executor: "agent", attempts: 0,
        claimed_by: heldBy, claim_token: heldBy ? "tok-other" : null,
        lease_expires_at: heldBy ? new Date(Date.now() + 60_000).toISOString() : null,
        done_at: heldBy ? null : Date.now(), enqueued_at: Date.now(), last_error: null,
      });
      const add = (at) => rest.approvals.set(`ap-${++n}`, {
        id: `ap-${n}`, tenant_id: TENANT, run_id: id, agent_id: AGENT, step: 1, idx: n,
        tool: "remember", args: {}, args_hash: `h${n}`, verdict: null, note: null,
        decided_by: null, requested_at: new Date().toISOString(), expires_at: new Date(at).toISOString(),
      });
      add(expiresAt);
      if (alsoLive) add(Date.now() + 3_600_000);
      if (ended) rest.entries.set(id, new Map([[0, { kind: "stopped", at: 1, stop: { reason: "answered" } }]]));
    };
    holding("gone-cold", Date.now() - 60_000);
    // ⚠ A RUN HOLDING ONE EXPIRED AND ONE LIVE REQUEST IS LEFT ALONE, and that is not a nicety:
    // requeued, it would hold again on the live one and be requeued every minute for ever.
    holding("half-open", Date.now() - 60_000, { alsoLive: true });
    holding("still-open", Date.now() + 3_600_000);
    holding("already-ended", Date.now() - 60_000, { ended: true });
    // ⚠ **A RUN SOMEBODY IS STILL WORKING ON IS REPORTED AND NOT RUNG**, and until the
    // function started saying which, nothing anywhere produced a row this handler had to
    // skip — so its own `action === "requeued"` filter could not be driven and a mutant
    // deleting it SURVIVED the sweep. *A wall nobody can drive is a wall nobody is
    // guarding.* `requeue_run` answers `running` for a live lease and takes nothing, so a
    // doorbell for this row would be a delivery `claim_run` refuses: latency spent to
    // learn what the sweep already knows.
    holding("somebody-on-it", Date.now() - 60_000, { heldBy: "worker-elsewhere" });

    await worker.scheduled({}, env, ctx);
    const rung = env[QUEUE_BINDING].sent.map((m) => m.runId);
    assert.deepEqual(rung, ["gone-cold"], `the tick rang ${JSON.stringify(rung)}`);
    assert.equal(rest.work.get("gone-cold").done_at, null, "the stranded run was not put back");
    assert.equal(rest.work.get("gone-cold").kind, "resume");
    // AND THE THREE THAT MUST NOT MOVE.
    for (const id of ["half-open", "still-open", "already-ended"]) {
      assert.notEqual(rest.work.get(id).done_at, null, `${id} was put back and should not have been`);
    }
    // AND THE HELD ONE KEEPS ITS HOLDER'S CLAIM rather than being taken from under it — the
    // row was LOOKED AT (the sweep reported it) and deliberately left alone, which is the
    // distinction the filter exists for and the reason the log carries two numbers.
    assert.equal(rest.work.get("somebody-on-it").claimed_by, "worker-elsewhere");
    assert.equal(rest.work.get("somebody-on-it").kind, "start", "a held run was re-queued under its holder");
  });
});

test("the expiry tick's failure cannot take the other three down", async () => {
  // FOUR JOBS, FOUR BLOCKS: the sweeper is the recovery for every dropped run in the
  // deployment, and this is the newest and least load-bearing of the four — a throw here must
  // not cost the deployment its sweeper or its schedule.
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest);
    const real = rest.fetch;
    let broke = 0;
    const patched = async (url, init) => {
      if (String(url).includes("requeue_expired_approvals")) { broke += 1; throw new Error("the expiry sweep went"); }
      return real(url, init);
    };
    patched.calls = real.calls;
    globalThis.fetch = patched;
    await assert.doesNotReject(() => worker.scheduled({}, env, ctx));
    assert.equal(broke, 1, "the expiry sweep never ran, so this proves nothing");
    assert.equal(env[QUEUE_BINDING].sent.length, 1, "a broken expiry sweep took the scheduler down with it");
  });
});

test("the approvals store is built with the CONSUMER's configuration, and refuses without it", () => {
  // ⚠ ITS OWN BUILDER rather than a field on another store's return: two stores folded into one
  // builder is how one of them quietly stops being built. `consume` is the right demand — this
  // reads and re-queues rows and produces nothing itself; the RINGING is `scheduled`'s, which
  // asks for the whole deployment already.
  assert.equal(typeof buildApprovals(good({ SUPABASE_JWT_SECRET: "s3cret" })).expiredApprovals, "function");
  assert.throws(() => buildApprovals({}), /not configured/);
  // AND IT IS NOT TENANT-SCOPED, which is the one place in this module that is deliberate: a
  // platform sweep has no tenant to scope to, and this is reachable only from the cron.
  assert.equal(typeof buildApprovals(good({ SUPABASE_JWT_SECRET: "s3cret" })).forTenant, "function");
});

// ── subworkflows, through the real dispatcher ────────────────────────────────

/**
 * ⚠ **THE EXPANSION LIVES IN `runner.mjs` AND `npm run sweep` DOES NOT RUN
 * `verify:wf`** — so a property proved only there is a property no mutant can be caught
 * by, which this directory has recorded four times. These drive `worker.queue` over the
 * in-memory fake, which is where the hop is observable.
 */
const CHILD = "a2", OTHER_AG = "g2";
const seedParent = (rest, { runs = CHILD, childSteps = null, childAgent = AGENT, childInputs = [] } = {}) => {
  seedAutomation(rest, { over: { steps: [{ id: "s1", type: "note", text: "opening" }] } });
  rest.agents.set(OTHER_AG, { id: OTHER_AG, tenant_id: TENANT, status: "active" });
  rest.autos.set(CHILD, {
    id: CHILD, tenant_id: TENANT, agent_id: childAgent, name: "Tidy", enabled: false,
    schedule: "manual", at_local: null, zone: "UTC", version: 3, inputs: childInputs,
    steps: childSteps ?? [
      { id: "s1", type: "note", text: "a sweep" },
      { id: "s2", type: "note", text: "and a wipe" },
    ],
  });
  rest.autos.get(AUTO).steps = [
    { id: "s1", type: "note", text: "opening" },
    { id: "s2", type: "workflow", runs },
    { id: "s3", type: "note", text: "closing" },
  ];
};

const deliverAuto = async (rest, env, ctx) => {
  await worker.scheduled({}, env, ctx);
  const sent = env[QUEUE_BINDING].sent.filter((m) => m.runId);
  const batch = batchOf(sent);
  await worker.queue(batch, env, ctx);
  return sent[sent.length - 1].runId;
};

test("⚠ A SUBWORKFLOW IS COPIED IN BEFORE THE FIRST STEP, stamped, and run as ONE execution", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest);
    const runId = await deliverAuto(rest, env, ctx);

    const exec = rest.execs.get(runId);
    // ⚠ WHAT THE ROW HOLDS, not what the runner remembered: four flattened steps where the
    // parent has three, and not one of them a call — which is the only flag there is.
    assert.equal(exec.steps.length, 4, JSON.stringify(exec.steps.map((s) => s.type)));
    assert.ok(!exec.steps.some((s) => s.type === "workflow"), JSON.stringify(exec.steps));
    assert.deepEqual(exec.steps.map((s) => s.id), ["s1", "s2", "s3", "s4"],
      "the ids are not re-minted by flattened position, so two children would collide");
    // THE SNAPSHOT: whose each spliced step is, and which version was copied.
    assert.deepEqual(exec.steps.slice(1, 3).map((s) => `${s.from}@${s.ver}`), ["a2@3", "a2@3"]);
    assert.equal(exec.steps[0].from, undefined, "the parent's own step was stamped too");
    assert.deepEqual(exec.uses, [{ id: CHILD, version: 3 }], JSON.stringify(exec.uses));
    // AND IT REALLY RAN, the child's steps included, in one execution with one journal.
    assert.equal(rest.runs.get(runId).stop.reason, "done");
    assert.deepEqual(exec.outcomes.map((o) => o.result),
      ["opening", "a sweep", "and a wipe", "closing"], JSON.stringify(exec.outcomes));
    assert.equal([...rest.entries.get(runId).values()].filter((e) => e.kind === "stopped").length, 1);
    assert.equal([...rest.execs.values()].length, 1, "the child was executed on its own as well");
  });
});

test("⚠ a call naming ANOTHER agent's automation fails the execution with its reason", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    // THE SAME ACCOUNT, a different agent — the wall no tenant filter can see.
    seedParent(rest, { childAgent: OTHER_AG });
    const runId = await deliverAuto(rest, env, ctx);

    const stop = rest.runs.get(runId).stop;
    // ⚠ **A FAILED EXECUTION WITH A REASON, never `unreadable`.** Taken off the queue with
    // nothing a customer can act on is the answer that sends somebody nowhere.
    assert.equal(stop.reason, "failed", JSON.stringify(stop));
    assert.match(stop.error, /not one of this agent's/);
    assert.notEqual(rest.execs.get(runId).finished_at, null, "a failed expansion left the row open");
    assert.notEqual(rest.work.get(runId).done_at, null, "it was left on the queue");
    // AND NOTHING WAS RUN: the plan never became a list, so no step has an outcome.
    assert.deepEqual(rest.execs.get(runId).outcomes, []);
  });
});

test("...and so does one that does not exist, in the same words", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest, { runs: "nobody" });
    const runId = await deliverAuto(rest, env, ctx);
    assert.match(rest.runs.get(runId).stop.error, /not one of this agent's/,
      "not-there and not-yours must be ONE answer, or an id can be probed for");
  });
});

test("⚠ a child that asks for its own inputs is refused, because nothing supplies them", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest, { childInputs: [{ name: "who", label: "Who", required: true }] });
    const runId = await deliverAuto(rest, env, ctx);
    assert.match(rest.runs.get(runId).stop.error, /asks for its own inputs/, JSON.stringify(rest.runs.get(runId).stop));
  });
});

test("⚠ A REDELIVERY DOES NOT EXPAND AGAIN — the absence of a call IS the flag", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest);
    const runId = await deliverAuto(rest, env, ctx);
    const first = JSON.stringify(rest.execs.get(runId).steps);

    // The child is REWRITTEN between the two deliveries, and at a new version. A second
    // expansion would copy THAT in, which is a run executing a list its record never held.
    rest.autos.get(CHILD).steps = [{ id: "s1", type: "note", text: "something else entirely" }];
    rest.autos.get(CHILD).version = 9;
    rest.work.get(runId).done_at = null;
    rest.work.get(runId).claimed_by = null;
    rest.work.get(runId).claim_token = null;
    rest.work.get(runId).lease_expires_at = null;
    await worker.queue(batchOf([{ runId }]), env, ctx);

    assert.equal(JSON.stringify(rest.execs.get(runId).steps), first,
      "the flattened plan was replaced on a redelivery");
    assert.deepEqual(rest.execs.get(runId).uses, [{ id: CHILD, version: 3 }],
      "what was copied in changed after the fact");
  });
});

test("⚠ THE DURABLE LOOP STATE GOES ROUND-TRIP THROUGH THE ROW, not through the process", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    // A LOOP IN THE CHILD, with a WAIT inside it: the execution suspends mid-round, so the
    // round it is on has to be in the row for the next delivery to read.
    seedParent(rest, {
      childSteps: [
        { id: "s1", type: "repeat", mode: "times", times: 2 },
        { id: "s2", type: "note", text: "a round" },
        { id: "s3", type: "wait", mode: "for", minutes: 5 },
        { id: "s4", type: "endrepeat" },
      ],
    });
    const runId = await deliverAuto(rest, env, ctx);

    const exec = rest.execs.get(runId);
    assert.notEqual(exec.waiting, null, "it did not suspend inside the loop");
    // ⚠ THE ROUND, IN THE ROW. A counter living in the process would give the next delivery
    // a fresh one and the body would run its first round again.
    assert.deepEqual(Object.values(exec.loops).map((l) => l.at), [0], JSON.stringify(exec.loops));
    assert.equal(exec.finished_at, null);
  });
});

/**
 * ⚠ **THE WIRE IS THE ONE PLACE THESE ARE OBSERVABLE, and a sweep is what said so.** Six
 * mutants survived a whole pass over the subworkflow and loop wiring, every one in
 * `runner.mjs` or `automation-store.mjs` — proved end to end by `verify:wf`, which
 * `npm run sweep` does not run. *A property proven only by an instrument the sweep cannot
 * run is a property no mutant can be caught by*, for the sixth recorded time here. The
 * store can be correct and the READ can stop asking for the columns, in which case
 * PostgREST sends neither and every loop starts again from its first round.
 */
const restCalls = (rest, needle) => rest.fetch.calls.filter((c) => String(c.url).includes(needle));

test("⚠ THE LOOP STATE IS ASKED FOR BY NAME AND SENT BACK BY NAME, in both directions", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest, {
      childSteps: [
        { id: "s1", type: "repeat", mode: "times", times: 2 },
        { id: "s2", type: "note", text: "a round" },
        { id: "s3", type: "wait", mode: "for", minutes: 5 },
        { id: "s4", type: "endrepeat" },
      ],
    });
    const runId = await deliverAuto(rest, env, ctx);

    // THE READ. A `select=` that stopped naming these is a store whose every other line is
    // right and which is handed `undefined` by PostgREST — the wiring layer, at the wire.
    const reads = restCalls(rest, "automation_runs?");
    assert.ok(reads.length >= 1, "the execution was never read");
    const asked = reads.map((c) => decodeURIComponent(String(c.url))).join(" ");
    for (const col of ["loops", "tries", "outcomes", "steps", "position", "decisions"]) {
      assert.match(asked, new RegExp(`[?&,]${col}\\b`), `the read does not ask for ${col}`);
    }
    // ⚠ AND `uses` IS DELIBERATELY NOT ASKED FOR, which is asserted rather than assumed — my
    // own first draft demanded it and the store was right. It is WRITE-ONLY here: the runner
    // records what it copied in and never reads it back, because the expansion is decided
    // from the CHILD rows and the stamp is for whoever reads the history. Pinned so the
    // omission is a stated fact rather than something a later reader repairs.
    assert.doesNotMatch(asked, /[?&,]uses\b/, "the read asks for `uses`, which nothing here reads");

    // THE WRITE. `agent.advance_automation_run` refuses a null for either, so a call that
    // sends neither is a checkpoint that cannot land — which is what the loop defect hid
    // behind before `advanced: false` was logged.
    const adv = restCalls(rest, "rpc/advance_automation_run");
    assert.ok(adv.length >= 1, "no progress was ever recorded");
    for (const c of adv) {
      assert.ok(c.body && typeof c.body.p_loops === "object" && c.body.p_loops !== null,
        `a checkpoint sent p_loops as ${JSON.stringify(c.body?.p_loops)}`);
      assert.ok(c.body && typeof c.body.p_tries === "object" && c.body.p_tries !== null,
        `a checkpoint sent p_tries as ${JSON.stringify(c.body?.p_tries)}`);
    }
    // AND IT REALLY LANDED, which is the control: every assertion above is about a request,
    // and a request nothing accepted proves nothing about the row.
    assert.deepEqual(Object.values(rest.execs.get(runId).loops).map((l) => l.at), [0]);
  });
});

test("⚠ A CHECKPOINT THAT DID NOT LAND IS SAID, never silent", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest, { over: { steps: [
      { id: "s1", type: "note", text: "one" },
      { id: "s2", type: "note", text: "two" },
    ] } });
    // The FAKE answers every advance `ok: true, advanced: false` — which is the ordinary
    // answer to a redelivery replaying recorded work AND exactly what a disagreement looks
    // like. Silence there is what made a loop's unrecordable second round invisible.
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("rpc/advance_automation_run")) {
        return new Response(JSON.stringify({ ok: true, advanced: false }),
          { status: 200, headers: { "content-type": "application/json" } });
      }
      return real(url, init);
    };
    // ⚠ THE LOG IS WHERE `worker.mjs` SENDS IT — `console.error("agent-runner", …)` — so that
    // is the only place this is observable from the dispatcher, and capturing it is the whole
    // instrument. A mutant that drops the line leaves a checkpoint that did not land SILENT,
    // which is exactly what the loop defect hid behind for every round after the first.
    const said = [];
    const realErr = console.error;
    console.error = (...a) => { said.push(a.join(" ")); };
    try {
      await worker.scheduled({}, env, ctx);
      const sent = env[QUEUE_BINDING].sent.filter((m) => m.runId);
      await worker.queue(batchOf(sent), env, ctx);
    } finally { globalThis.fetch = real; console.error = realErr; }
    assert.ok(said.some((l) => l.includes("automation-stale")),
      `a checkpoint that did not land was silent: ${JSON.stringify(said)}`);
    // AND IT NAMES THE POSITION THE ROW DID NOT REACH, because "something is stale" is not
    // something an operator can act on.
    assert.ok(said.some((l) => /the row did not move to \d+/.test(l)), JSON.stringify(said));
  });
});

test("⚠ AN ANSWER THAT IS NOT A LIST IS REFUSED, never read as an empty one", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest);
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("rpc/automation_children")) {
        return new Response(JSON.stringify({ oops: true }),
          { status: 200, headers: { "content-type": "application/json" } });
      }
      return real(url, init);
    };
    let runId;
    try { runId = await deliverAuto(rest, env, ctx); } finally { globalThis.fetch = real; }

    /**
     * ⚠ **READING IT AS "THIS AGENT HAS NO OTHER AUTOMATIONS" WOULD BE THE WRONG SENTENCE
     * ABOUT THE WRONG LAYER** — an outage reported as a workflow naming an automation that is
     * really there, which sends somebody to fix a workflow that is correct.
     *
     * AND THE RUN IS LEFT **UNFINISHED AND CLAIMABLE**, which my own first draft got wrong by
     * demanding a finished execution: a read that failed is an outage and an outage comes
     * back, so the sweeper offers it again. A workflow that cannot be ASSEMBLED is the other
     * case and really does finish — that is the case above this one.
     */
    const exec = rest.execs.get(runId);
    assert.equal(exec.finished_at, null, "an unreadable read ended the execution");
    assert.equal(rest.work.get(runId)?.done_at ?? null, null, "it was taken off the queue");
    const stop = JSON.stringify(exec.outcomes ?? []) + JSON.stringify(rest.runs.get(runId)?.stop ?? {});
    assert.doesNotMatch(stop, /isn't one of this agent's|not there/,
      "an unreadable answer was reported as a missing automation");
    // AND THE PLAN WAS NOT WRITTEN, because nothing could be assembled.
    assert.equal(exec.steps.filter((s) => s.type === "workflow").length, 1,
      "the call was replaced although the children could not be read");
  });
});

test("⚠ `setPlan` REFUSES A NON-LIST rather than writing an empty plan", async () => {
  // The coercion this replaces sent `[]`, which REPLACES the execution's steps with nothing:
  // zero steps run and `done` reported. And the database raises on a non-array by its own
  // first line, so the coercion's only effect was to stop that wall ever being reached.
  const { makeAutomationStore } = await import("../src/automation-store.mjs");
  const sent = [];
  const store = makeAutomationStore({
    url: "https://p.supabase.co/", key: "svc",
    fetch: async (url, init) => {
      sent.push({ url: String(url), body: init.body ? JSON.parse(init.body) : undefined });
      return new Response(JSON.stringify({ ok: true, set: true, steps: 0 }),
        { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const args = { runId: "r1", worker: "w1", token: "t1", steps: [{ id: "s1" }], uses: [] };
  // THE CONTROL FIRST, or every refusal below is satisfied by a store that refuses everything.
  const ok = await store.setPlan(args);
  assert.equal(ok.ok, true);
  assert.equal(sent.length, 1);
  for (const bad of [null, undefined, "x", 7, { 0: "a", length: 1 }]) {
    await assert.rejects(() => store.setPlan({ ...args, steps: bad }), /must be a list/,
      `steps ${JSON.stringify(bad)} was not refused`);
    await assert.rejects(() => store.setPlan({ ...args, uses: bad }), /must be a list/,
      `uses ${JSON.stringify(bad)} was not refused`);
  }
  // AND NOTHING WAS SENT for any of them: a refusal that still writes is not a refusal.
  assert.equal(sent.length, 1, `a refused plan reached the wire: ${JSON.stringify(sent.slice(1))}`);
});

// ── events, through the real dispatcher ──────────────────────────────────────

/**
 * ⚠ **THE FIFTH CRON JOB IS IN `worker.scheduled` AND NOTHING IN THIS DIRECTORY DRIVES THAT
 * FILE BY ACCIDENT** — four mutants survived in the FOURTH job's block for exactly that
 * reason, and its own note records it. So the event dispatch is driven here, over the
 * in-memory fake, where the ring, the filter and the bound are all observable.
 */
test("⚠ AN EVENT FILES WHAT LISTENS FOR IT AND THE WORKER RINGS EVERY RUN IT TOUCHED", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest, { over: {
      schedule: "manual", next_run_at: null, on_event: "order.paid",
      steps: [{ id: "s1", type: "note", text: "a payment landed" }],
    } });
    rest.events.set("e1", {
      id: "e1", tenant_id: TENANT, agent_id: AGENT, name: "order.paid",
      payload: { amount: 42 }, source: "webhook", event_key: "dlv-1",
      depth: 0, at: new Date().toISOString(), handled_at: null,
    });

    await worker.scheduled({}, env, ctx);
    // ⚠ THE KEY IS `ring`, WHICH IS WHAT THE FUNCTION REALLY ANSWERS — the first draft of the
    // handler read `runs` and would have rung nothing at all, with every other line correct.
    const rung = env[QUEUE_BINDING].sent.filter((m) => m.runId);
    assert.equal(rung.length, 1, `the doorbell rang ${rung.length} times: ${JSON.stringify(env[QUEUE_BINDING].sent)}`);
    const filed = [...rest.execs.values()].find((x) => x.trigger === "event");
    assert.ok(filed, "no execution was filed for the event");
    assert.equal(filed.event_id, "e1", "the execution does not carry the event it came from");
    assert.equal(rung[0].runId, filed.id);
    assert.notEqual(rest.events.get("e1").handled_at, null, "the event was not stamped handled");

    /**
     * AND A SECOND TICK FILES NOTHING, because the stamp is the gate — the property that makes
     * one event one execution however many ticks see it.
     *
     * ⚠ **THE ASSERTION IS ABOUT THE EXECUTION AND NOT ABOUT THE DOORBELL, and my first draft had
     * it the other way round.** The run this event filed has a CLAIMABLE work row until something
     * executes it, so the SWEEPER legitimately rings it again on the next tick — the product being
     * right. What must not happen is a second execution.
     */
    const before = [...rest.execs.values()].filter((x) => x.trigger === "event").length;
    const stamped = rest.events.get("e1").handled_at;
    await worker.scheduled({}, env, ctx);
    assert.equal([...rest.execs.values()].filter((x) => x.trigger === "event").length, before);
    assert.equal(rest.events.get("e1").handled_at, stamped, "the event was dispatched a second time");

    // ...AND THE RUN THE EVENT FILED REALLY EXECUTES, which is what makes the ring worth ringing.
    const ran = await worker.queue(batchOf([{ runId: filed.id }]), env, ctx);
    assert.notEqual(rest.execs.get(filed.id).finished_at, null,
      `the event's own execution never ran: ${JSON.stringify(rest.work.get(filed.id))} ${JSON.stringify(ran ?? null)}`);
  });
});

test("⚠ AN EVENT WAIT IS WOKEN BY THE DISPATCH, and the run carries on with what it carried", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest, { over: { steps: [
      { id: "s1", type: "event", name: "order.shipped", out: "it" },
      { id: "s2", type: "note", text: "shipped: {{it}}" },
    ] } });
    // First delivery: it reaches the wait and suspends.
    await worker.scheduled({}, env, ctx);
    const first = env[QUEUE_BINDING].sent.filter((m) => m.runId);
    const runId = first[first.length - 1].runId;
    await worker.queue(batchOf([{ runId }]), env, ctx);

    const paused = rest.execs.get(runId);
    assert.equal(paused.waiting?.kind, "event", JSON.stringify(paused.waiting));
    assert.equal(paused.waiting?.name, "order.shipped");
    // ⚠ AN EVENT PAUSE CARRIES `since`, and it is what bounds the wait to news it was really
    // waiting for — without it an event from last week would satisfy a wait set up this morning.
    assert.ok(typeof paused.waiting?.since === "string", JSON.stringify(paused.waiting));
    assert.equal(paused.finished_at, null);
    // AND THE PAUSE RELEASED ITS WORKER, which is what makes a suspended execution cost nothing.
    assert.notEqual(rest.work.get(runId).done_at, null, "the pause did not release the work");

    // The event arrives. The dispatcher records it AND puts the work back.
    rest.events.set("e9", {
      id: "e9", tenant_id: TENANT, agent_id: AGENT, name: "order.shipped",
      payload: { who: "dpd" }, source: "person", event_key: null,
      depth: 0, at: new Date().toISOString(), handled_at: null,
    });
    env[QUEUE_BINDING].sent.length = 0;
    await worker.scheduled({}, env, ctx);
    assert.equal(rest.execs.get(runId).heard?.s1?.name, "order.shipped");
    assert.equal(rest.work.get(runId).done_at, null, "the woken run was left off the queue");
    const woke = env[QUEUE_BINDING].sent.filter((m) => m.runId === runId);
    assert.equal(woke.length, 1, "the woken run was not rung");

    // The next delivery finishes it, and the payload really reached the note.
    await worker.queue(batchOf([{ runId }]), env, ctx);
    const done = rest.execs.get(runId);
    assert.notEqual(done.finished_at, null, "it never finished");
    const said = JSON.stringify(done.outcomes);
    // ⚠ THE OUTCOME OBJECT, NOT A MATCH AGAINST ITS JSON — the payload's own quotes come back
    // escaped inside a stringified array, so a regex over that is asserting the serialiser's
    // spelling rather than what the step produced.
    const note = done.outcomes.find((o) => o.id === "s2");
    assert.equal(note?.result, 'shipped: {"who":"dpd"}', said);
    // ⚠ AND NOTHING RAN TWICE: one outcome per step, which is the property a `heard` applied
    // twice would break.
    assert.equal(done.outcomes.length, 2, said);
  });
});

test("⚠ THE ARRIVAL RACE: an event that got there first is heard when the pause is recorded", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest, { over: { steps: [
      { id: "s1", type: "event", name: "order.refunded" },
      { id: "s2", type: "note", text: "refunded" },
    ] } });
    // ⚠ THE EVENT IS ALREADY DISPATCHED BEFORE THE EXECUTION EVER RUNS, so the dispatcher's own
    // waking half could not have seen it: an execution that is not suspended yet is invisible to
    // it. This is the half `hear_pending_event` exists for, and the runner asks it only once the
    // pause is RECORDED — which is why the order in `deliverAutomation` matters.
    /**
     * ⚠ **THE EVENT'S `at` IS JUST AHEAD OF NOW, AND THAT IS THE WINDOW STANDING IN FOR ITSELF.**
     * The race is an event arriving BETWEEN the executor reaching the step and the pause being
     * visible — so its `at` is AFTER the step's `since` and its dispatch is BEFORE the row exists.
     * A test cannot interleave those, and my first fixture dated the event a second in the PAST,
     * which is a different case entirely: an event from before the wait, which the `since` bound
     * exists to refuse and correctly did. The forward offset is the sub-millisecond window made
     * observable, and the refusal of a genuinely older event is its own check on real PostgreSQL.
     */
    rest.events.set("e7", {
      id: "e7", tenant_id: TENANT, agent_id: AGENT, name: "order.refunded",
      payload: {}, source: "person", event_key: null,
      depth: 0, at: new Date(Date.now() + 250).toISOString(), handled_at: null,
    });
    await worker.scheduled({}, env, ctx);            // dispatches it with nobody waiting
    assert.notEqual(rest.events.get("e7").handled_at, null, "the event was never dispatched");

    const sent = env[QUEUE_BINDING].sent.filter((m) => m.runId);
    const runId = sent[sent.length - 1].runId;
    env[QUEUE_BINDING].sent.length = 0;
    await worker.queue(batchOf([{ runId }]), env, ctx);

    const x = rest.execs.get(runId);
    assert.equal(x.heard?.s1?.name, "order.refunded", `nothing was heard: ${JSON.stringify(x.heard)}`);
    // ⚠ AND THE WORK IS BACK, which is the half the database had to be corrected for: a `heard`
    // written against a run whose work row is done reaches nobody, for ever.
    assert.equal(rest.work.get(runId).done_at, null, "the race was heard and the run left stranded");

    // The next delivery carries on, so the race costs one tick and never the event.
    await worker.queue(batchOf([{ runId }]), env, ctx);
    assert.notEqual(rest.execs.get(runId).finished_at, null, "it never carried on");
  });
});

test("an event nothing listens for and nothing waits on is dispatched and rings nobody", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedAutomation(rest, { over: { schedule: "manual", next_run_at: null } });
    rest.events.set("e2", {
      id: "e2", tenant_id: TENANT, agent_id: AGENT, name: "nobody.cares",
      payload: {}, source: "person", event_key: null,
      depth: 0, at: new Date().toISOString(), handled_at: null,
    });
    await worker.scheduled({}, env, ctx);
    // A ROW THAT CHANGED NOTHING CARRIES NO RUNS, so the handler rings for nothing — and the
    // event is still STAMPED, or the tick would look at it again every minute for ever.
    assert.equal(env[QUEUE_BINDING].sent.filter((m) => m.runId).length, 0);
    assert.notEqual(rest.events.get("e2").handled_at, null);
  });
});

test("⚠ A THROW IN THE EVENT JOB DOES NOT TAKE THE SWEEPER DOWN WITH IT", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    // A dropped run for the SWEEPER to find, so its work is observable.
    seedAutomation(rest, { over: { steps: [{ id: "s1", type: "note", text: "x" }] } });
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("rpc/dispatch_events")) throw new Error("events are down");
      return real(url, init);
    };
    const said = [];
    const realErr = console.error;
    console.error = (...a) => { said.push(a.join(" ")); };
    try { await worker.scheduled({}, env, ctx); }
    finally { globalThis.fetch = real; console.error = realErr; }

    // ⚠ FIVE JOBS, FIVE `try` BLOCKS, AND NONE MAY SILENCE ANOTHER. The scheduler ran and filed
    // its due automation although the event job threw — which is the whole reason the blocks are
    // separate, and the sweeper is the recovery for every dropped run in the deployment.
    assert.ok(said.some((l) => l.includes("agent-events")), `the failure was silent: ${JSON.stringify(said)}`);
    assert.ok(env[QUEUE_BINDING].sent.filter((m) => m.runId).length >= 1,
      "the scheduler's own work was lost when the event job threw");
  });
});

test("⚠ THE DELIVERY ROUTE IS DISPATCHED BEFORE THE TOKEN GATE, and its own 503 comes first", async () => {
  // ⚠ **THE ORDER IS THE WHOLE REASON THIS ROUTE IS NOT INSIDE THE API.** `api.fetch` verifies
  // a bearer token before it looks at a path, so a delivery reaching it would be a 401 whatever
  // it was signed with — and adding an unauthenticated exception above that gate is how the
  // next route added there is open by accident. A delivery proves who sent it with a SIGNATURE.
  await onFakeProject(async () => {
    const env = good();
    const res = await worker.fetch(new Request("https://x/deliver/wh1", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    }), env, { waitUntil() {} });
    // 401 FROM THE DELIVERY HANDLER, NOT FROM THE API: the sentence is the one refusal every
    // unsigned or unknown delivery gets, and it is not a bearer-token complaint.
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "this delivery was not accepted");
  });

  // AND THE CONFIGURATION GAP IS ITS OWN NAMED 503 rather than a throw Cloudflare answers in
  // HTML — asked of `buildDelivery` itself, which demands only what a delivery needs.
  const bare = await worker.fetch(new Request("https://x/deliver/wh1", { method: "POST", body: "{}" }),
    { SUPABASE_URL: "https://p.supabase.co" }, { waitUntil() {} });
  assert.equal(bare.status, 503);
  const gap = await bare.json();
  assert.match(JSON.stringify(gap), /SUPABASE_SERVICE_KEY/, "the 503 does not name what is missing");
  // ⚠ AND IT NAMES NO QUEUE BINDING, because a delivery PRODUCES nothing: it records an event
  // and the cron dispatches it. Demanding the API's own settings here would refuse a
  // deployment that can serve deliveries perfectly well.
  assert.ok(!JSON.stringify(gap).includes(QUEUE_BINDING),
    "the delivery door demands the API's own configuration");

  // ── A GET IS NOT A DELIVERY, so the shape predicate really discriminates ──
  //
  // ⚠ **THE STATUS CANNOT TELL THEM APART AND THE FIRST DRAFT OF THIS ASSERTED ON IT.** An
  // unauthenticated GET is a 401 from the API's own token gate and a bad delivery is a 401
  // from the delivery handler — the same number for opposite reasons, which is exactly the
  // recorded "a refusal from the wrong gate looks like the wall working". The SENTENCE is what
  // separates them, and only the delivery handler writes this one.
  await onFakeProject(async () => {
    const res = await worker.fetch(new Request("https://x/deliver/wh1"), good(), { waitUntil() {} });
    const body = await res.json().catch(() => ({}));
    assert.notEqual(body.error, "this delivery was not accepted",
      "a GET reached the delivery handler");
  });
});

test("⚠ the event dispatch is BOUNDED, or a burst of deliveries starves the schedules", async () => {
  // One tick does the sweeper, the schedule, the resumes, the expiries and the events; an
  // unbounded event read is one slow minute away from the other four never running.
  await onFakeProject(async (rest) => {
    await worker.scheduled({}, good(), { waitUntil() {} });
    // READ OFF THE REQUEST THE STORE REALLY SENT, which is the only place the bound exists:
    // the fake's own answer cannot say what it was asked for.
    const sent = rest.fetch.calls.filter((c) => String(c.url).endsWith("/rpc/dispatch_events"));
    assert.equal(sent.length, 1, `the tick dispatched events ${sent.length} times`);
    const asked = sent[0].body?.p_limit;
    assert.ok(Number.isInteger(asked) && asked > 0 && asked <= 500, `the dispatch asked for ${asked}`);
  });
});

/**
 * ⚠ **FIVE MORE MUTANTS SURVIVED A WHOLE PASS, EVERY ONE IN `runner.mjs`'s EXPANSION
 * BLOCK — the seventh recorded time here that a property proved only by `verify:wf` is a
 * property no mutant can be caught by.** The block is four walls in a row and the module
 * suite drove none of them: the position gate, the missing agent, the fenced refusal, and
 * the plan another worker wrote. Each is closed below, over the in-memory project, because
 * `npm run sweep` runs `test/*.test.mjs` and nothing else.
 */

/** Wrap the fake's own fetch for one path, and put it back however the body ends. */
const aroundFetch = async (needle, handler, body) => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) =>
    (String(url).includes(needle) ? handler(url, init, real) : real(url, init));
  try { return await body(); } finally { globalThis.fetch = real; }
};

test("⚠ PAST THE FIRST STEP THE LIST IS LEFT ALONE — expanding then would renumber recorded work", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest);
    // AN EXECUTION ALREADY PART WAY THROUGH, with a call still in its stored list — which is
    // the state a first attempt that died BEFORE writing its plan leaves behind. Expanding
    // here moves every position, so the outcome already recorded would point at a step it is
    // not about, and `set_automation_plan` refuses the write anyway: the flattened list would
    // run against a row still holding the unflattened one.
    await worker.scheduled({}, env, ctx);
    const runId = env[QUEUE_BINDING].sent.filter((m) => m.runId).at(-1).runId;
    const exec = rest.execs.get(runId);
    exec.position = 1;
    exec.outcomes = [{ id: "s1", type: "note", outcome: "ran", result: "opening" }];
    const stored = JSON.stringify(exec.steps);
    Object.assign(rest.work.get(runId), { done_at: null, claimed_by: null, claim_token: null, lease_expires_at: null });
    await worker.queue(batchOf([{ runId }]), env, ctx);

    // THE STORED LIST IS UNTOUCHED — the call is still a call.
    assert.equal(JSON.stringify(rest.execs.get(runId).steps), stored, "a resumed run was renumbered under itself");
    assert.equal(rest.execs.get(runId).steps.filter((s) => s.type === "workflow").length, 1);
    // AND IT FAILS BY NAME rather than running a list nobody saved, which is the honest
    // reading of a row in that state.
    const stop = rest.runs.get(runId)?.stop ?? {};
    assert.equal(stop.reason, "failed", JSON.stringify(stop));
    assert.match(String(stop.error), /was supposed to be copied in before the run started/);
    // AND THE OUTCOME ALREADY RECORDED IS STILL ABOUT THE STEP IT WAS ABOUT.
    assert.equal(rest.execs.get(runId).outcomes[0].id, "s1");
    assert.equal(rest.execs.get(runId).outcomes[0].result, "opening");
  });
});

test("⚠ AN EXECUTION WITH NO AGENT RECORDED LOOKS NOTHING UP, and says so", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest);
    await worker.scheduled({}, env, ctx);
    const runId = env[QUEUE_BINDING].sent.filter((m) => m.runId).at(-1).runId;
    // ⚠ "THIS AGENT HAS NO OTHER AUTOMATIONS" AND "WE CANNOT TELL WHOSE TO LOOK AT" ARE
    // OPPOSITE FACTS, and the second must not read as a workflow naming something that is
    // not there — which would send somebody to fix a workflow that is correct.
    rest.execs.get(runId).agent_id = null;
    Object.assign(rest.work.get(runId), { done_at: null, claimed_by: null, claim_token: null, lease_expires_at: null });

    let asked = 0;
    await aroundFetch("rpc/automation_children", (url, init, real) => { asked += 1; return real(url, init); },
      () => worker.queue(batchOf([{ runId }]), env, ctx));

    // NOTHING WAS ASKED AT ALL — the refusal is above the lookup, not a reading of its answer.
    assert.equal(asked, 0, "an execution with no agent searched whatever it found");
    // ⚠ AND THE REASON IS ON THE **WORK ROW**, NOT IN `runs.stop` — checked rather than
    // guessed, because my own first draft read `runs.stop` and got `{}`. An `unreadable`
    // release hands its sentence to `release_run`, which is where a run nothing will deliver
    // again carries why; the journal is left as it is because nothing about the workflow ran.
    const row = rest.work.get(runId);
    assert.match(String(row?.last_error), /no agent recorded/, JSON.stringify(row));
    assert.notEqual(row?.done_at ?? null, null, "a run nothing can assemble was left on the queue");
    // AND THE PLAN WAS NOT WRITTEN.
    assert.equal(rest.execs.get(runId).steps.filter((s) => s.type === "workflow").length, 1);
  });
});

test("⚠ A FENCED REFUSAL ON THE PLAN IS NOT A SUCCESS — nothing else is attempted", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest);
    // THE LEASE IS GONE BY THE TIME THE PLAN IS WRITTEN. `set_automation_plan` refuses with
    // the same vocabulary every fenced write uses, and it means THIS WORKER MAY NOT WRITE —
    // so it must not go on to run the list it just assembled and record outcomes under a
    // claim somebody else now holds.
    await aroundFetch("rpc/set_automation_plan",
      () => new Response(JSON.stringify({ ok: false, error: "lease-expired" }),
        { status: 200, headers: { "content-type": "application/json" } }),
      () => deliverAuto(rest, env, ctx));
    const runId = env[QUEUE_BINDING].sent.filter((m) => m.runId).at(-1).runId;

    const exec = rest.execs.get(runId);
    // NOTHING RAN AND NOTHING WAS RECORDED. Read as a success, the run would have executed
    // the flattened list and written its outcomes past a refusal.
    assert.deepEqual(exec.outcomes ?? [], [], "a refused plan still ran the workflow");
    assert.equal(exec.position ?? 0, 0);
    assert.equal(exec.finished_at, null, "a refused plan ended the execution");
    assert.equal(rest.runs.get(runId)?.stop ?? null, null, "a worker that may not write wrote a stop");
    // AND THE LIST IS STILL THE STORED ONE, because the write is what would have replaced it.
    assert.equal(exec.steps.filter((s) => s.type === "workflow").length, 1);

    /**
     * ⚠ **AND THE WORK ROW IS WHAT SEPARATES THIS FROM THE CONFLICT BELOW IT — MEASURED, after
     * my own first draft could not tell them apart and the mutant survived.** With the `ok`
     * gate removed, a refusal carrying no `set` falls through to `set.set !== true` and is
     * answered `conflict`, which produces the SAME execution state: nothing ran, nothing
     * recorded, no stop. So the two gates read identically from the execution — and the
     * fixture that only looked there was too shallow to separate two readings, this
     * repository's most repeated guard trap.
     *
     * They differ on the CLAIM. `lease-expired` is one of `CLAIM_GONE`, so the worker knows it
     * no longer holds the run and **releases nothing** — somebody else may hold it now, and
     * releasing would be this worker deciding about a row it has lost. A `conflict` DOES
     * release, because the claim may still be ours and only our snapshot is stale.
     */
    const row = rest.work.get(runId);
    assert.notEqual(row.claimed_by, null,
      `a worker that had lost its lease released the run anyway: ${JSON.stringify(row)}`);
    // ⚠ AND THE REASON MUST NOT BE THE OTHER GATE'S. "A failure that cannot name itself" is
    // this product's most repeated own goal, and telling a lost lease as another worker's plan
    // sends somebody looking for a second worker that does not exist.
    assert.doesNotMatch(String(row.last_error ?? ""), /another worker/,
      `a lost lease was reported as another worker's plan: ${JSON.stringify(row)}`);
  });
});

test("⚠ ANOTHER WORKER'S PLAN IS NOT OURS TO RUN — the list executed is the list recorded", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    seedParent(rest);
    // ⚠ THE RACE, DRIVEN: the position moves between the runner's read and its write, which
    // is exactly what `set_automation_plan`'s `position = 0` condition is for. `set: false`
    // is NOT a fenced refusal — the claim may still be ours, and what is stale is our
    // snapshot — so it is released UNFINISHED and the next delivery reads what is there.
    await worker.scheduled({}, env, ctx);
    const runId = env[QUEUE_BINDING].sent.filter((m) => m.runId).at(-1).runId;
    Object.assign(rest.work.get(runId), { done_at: null, claimed_by: null, claim_token: null, lease_expires_at: null });
    const theirs = [{ id: "s1", type: "note", text: "somebody else's plan" }];
    await aroundFetch("rpc/set_automation_plan", (url, init, real) => {
      const ex = rest.execs.get(runId);
      ex.position = 1;                 // somebody else got there first
      ex.steps = theirs;
      return real(url, init);          // the real function then answers set: false
    }, () => worker.queue(batchOf([{ runId }]), env, ctx));

    const exec = rest.execs.get(runId);
    assert.equal(JSON.stringify(exec.steps), JSON.stringify(theirs), "our plan overwrote theirs");
    assert.deepEqual(exec.outcomes ?? [], [], "we ran a list the record does not hold");
    assert.equal(exec.finished_at, null, "a conflict ended the execution");
    // RELEASED, so the next delivery can read what is really there — which terminates.
    assert.equal(rest.work.get(runId)?.done_at ?? null, null, "a conflict took the run off the queue");
  });
});

test("⚠ THE DURABLE LOOP STATE IS HANDED TO THE EXECUTOR ON A RESUME, or every round is the first", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    // THE ROUND-TRIP HAS TWO HALVES AND ONLY ONE WAS DRIVEN. The case above asserts the row
    // holds the round after the FIRST delivery; this asserts the SECOND delivery is given it.
    // Read as `{}` the loop starts again, the body runs its first round twice, and the
    // execution never ends — bounded retries, unbounded in practice.
    seedParent(rest, {
      childSteps: [
        { id: "s1", type: "repeat", mode: "times", times: 2 },
        { id: "s2", type: "note", text: "a round" },
        { id: "s3", type: "wait", mode: "for", minutes: 5 },
        { id: "s4", type: "endrepeat" },
      ],
    });
    const runId = await deliverAuto(rest, env, ctx);
    const first = rest.execs.get(runId);
    assert.notEqual(first.waiting, null, "it did not suspend inside the loop");
    assert.deepEqual(Object.values(first.loops).map((l) => l.at), [0], JSON.stringify(first.loops));

    // THE WAIT IS OVER AND THE RUN IS OFFERED AGAIN — the deploy-shaped restart. `sent` is
    // cleared first, or "it was offered" is satisfied by the message that started it: a
    // vacuous observation, which is what my own first draft asserted.
    first.wait_until = new Date(Date.now() - 60_000).toISOString();
    env[QUEUE_BINDING].sent.length = 0;
    await worker.scheduled({}, env, ctx);
    // ⚠ **`>= 1`, NOT `=== 1`, AND THE DIFFERENCE IS A PROPERTY RATHER THAN A TOLERANCE.** How
    // many of the five cron jobs ring one run is not what this case is about, and a duplicate
    // ring is harmless BY CONSTRUCTION — `claim_run` refuses the second, which is this
    // product's own rule and not this assertion's care. Asserting an exact count would pin the
    // cron's internal arithmetic and go red on an honest change to it. `sent` is cleared
    // above, so this is still a real observation and not the vacuous one it replaced.
    assert.ok(env[QUEUE_BINDING].sent.filter((m) => m.runId === runId).length >= 1,
      `the resume tick did not offer the waiting execution: ${JSON.stringify(env[QUEUE_BINDING].sent)}`);
    assert.equal(rest.work.get(runId).done_at, null,
      `the resumed run was left off the queue: ${JSON.stringify(rest.work.get(runId))}`);
    const chatter = [];
    const keepLog = console.log; const keepErr = console.error;
    console.log = (...a) => chatter.push(["log", ...a.map((x) => JSON.stringify(x))].join(" "));
    console.error = (...a) => chatter.push(["err", ...a.map((x) => JSON.stringify(x))].join(" "));
    let second;
    try { second = await worker.queue(batchOf([{ runId }]), env, ctx); }
    finally { console.log = keepLog; console.error = keepErr; }

    // IT CONTINUED INTO THE SECOND ROUND rather than starting the first again — asserted as
    // the round itself rather than as a list, so an empty `loops` cannot satisfy it.
    const now2 = rest.execs.get(runId);
    const why = () => JSON.stringify({ loops: now2.loops, waiting: now2.waiting,
      wait_until: now2.wait_until, outcomes: now2.outcomes, work: rest.work.get(runId),
      delivery: second ?? null, chatter });
    assert.equal(now2.loops?.s2?.at, 1, `the loop restarted rather than continuing: ${why()}`);
    assert.equal(now2.loops?.s2?.of, 2, JSON.stringify(now2.loops));

    /**
     * ⚠ **AND THE BODY RAN ONCE PER ROUND, read off the outcome KEYS rather than off a count.**
     * A step inside a loop is keyed `<position>#<open>.<iteration>`, so the note's two rounds
     * are `s3#2.0` and `s3#2.1` — two DIFFERENT slots. Handed `{}` the loop starts again, the
     * second delivery writes `s3#2.0` over the first, and a bare count of outcomes is
     * identical: six either way. The keys are the only thing that separates them.
     */
    const ids = now2.outcomes.map((o) => o.id);
    assert.deepEqual(new Set(ids).size, ids.length, `a slot was written twice: ${JSON.stringify(ids)}`);
    const rounds = ids.filter((id) => id.startsWith("s3#"));
    assert.deepEqual(rounds, ["s3#2.0", "s3#2.1"], JSON.stringify(ids));
    assert.equal(now2.outcomes.filter((o) => o.id.startsWith("s3#") && o.outcome === "ran").length, 2);
    // AND IT IS WAITING AGAIN, at the second round's own wait — which is what a wait inside a
    // loop means and is the property the resume being spent by its first arrival buys.
    assert.equal(now2.waiting?.step, "s4", JSON.stringify(now2.waiting));
    assert.equal(now2.finished_at, null);
  });
});

test("⚠ THE EVENT TICK'S LOG TELLS FILING FROM WAKING — one total could not", async () => {
  await onFakeProject(async (rest) => {
    const env = good({ SUPABASE_JWT_SECRET: "s3cret" });
    const ctx = { waitUntil() {} };
    /**
     * ⚠ **THIS IS THE INSTRUMENT, AND AN INSTRUMENT WHOSE NUMBERS CANNOT MOVE IS NOT ONE.**
     * The tally counted a field `dispatch_events` does not answer, so every tick printed the
     * same shape whatever it had done — this product's own `requeue_expired_approvals` finding
     * one cron job over, and a sweep survivor because nothing had ever read the line.
     *
     * The two numbers are kept APART on purpose: ten automations triggered and ten waiters
     * released are different facts about a platform, and an operator reading one total could
     * not tell an event that fanned out from one that unblocked a queue. So the tick under
     * test does BOTH at once, which is the only shape that separates them.
     */
    // THE WAITER: on the ordinary due schedule, so it runs and suspends on the event.
    seedAutomation(rest, { over: { steps: [
      { id: "s1", type: "event", name: "order.paid", out: "it" },
      { id: "s2", type: "note", text: "got {{it}}" },
    ] } });
    await worker.scheduled({}, env, ctx);
    const waiting = env[QUEUE_BINDING].sent.filter((m) => m.runId).at(-1).runId;
    await worker.queue(batchOf([{ runId: waiting }]), env, ctx);
    assert.equal(rest.execs.get(waiting).waiting?.kind, "event",
      JSON.stringify(rest.execs.get(waiting).waiting));

    // THE LISTENER: a second automation, triggered by the same event rather than by a clock.
    const listener = "aaaaaaaa-0000-4000-8000-00000000009a";
    rest.autos.set(listener, {
      id: listener, tenant_id: TENANT, agent_id: AGENT, name: "Listens", enabled: true,
      schedule: "manual", at_local: null, zone: "UTC", version: 1, inputs: [],
      next_run_at: null, on_event: "order.paid",
      steps: [{ id: "s1", type: "note", text: "a payment landed" }],
    });
    rest.events.set("e2", {
      id: "e2", tenant_id: TENANT, agent_id: AGENT, name: "order.paid",
      payload: { amount: 42 }, source: "webhook", event_key: "dlv-2",
      depth: 0, at: new Date().toISOString(), handled_at: null,
    });
    env[QUEUE_BINDING].sent.length = 0;

    const said = [];
    const realLog = console.log;
    console.log = (...a) => { said.push(a.map(String).join(" ")); };
    try { await worker.scheduled({}, env, ctx); } finally { console.log = realLog; }

    const line = said.find((l) => l.startsWith("agent-events"));
    assert.ok(line, `the tick said nothing about its events: ${JSON.stringify(said)}`);
    const tally = JSON.parse(line.slice("agent-events".length).trim());
    // ⚠ EVERY NUMBER IS ASSERTED BY NAME AND BY VALUE. A shape check would pass for a tally
    // whose fields are all zero, which is what the defect produced.
    assert.deepEqual(Object.keys(tally).sort(), ["events", "filed", "rung", "woke"], line);
    assert.equal(tally.events, 1, line);
    assert.equal(tally.filed, 1, line);          // the listener got an execution
    assert.equal(tally.woke, 1, line);           // the waiter was released
    // AND THE TWO REALLY ARE TWO THINGS, read off the rows rather than off the line: one new
    // execution for the listener, and the waiter carrying what it heard.
    assert.equal([...rest.execs.values()].filter((x) => x.trigger === "event").length, 1, line);
    assert.equal(rest.execs.get(waiting).heard?.s1?.name, "order.paid");
    // AND THE RING IS BOTH OF THEM, because an event can file a trigger AND wake a waiter and
    // ringing only the first leaves the other for the sweeper.
    const rang = env[QUEUE_BINDING].sent.filter((m) => m.runId);
    assert.equal(tally.rung, rang.length, line);
    assert.ok(rang.some((m) => m.runId === waiting), "the woken run was not rung");
    assert.ok(tally.rung >= 2, line);
  });
});

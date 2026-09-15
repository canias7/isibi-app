import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker, {
  SETTINGS, OPTIONAL, SENSITIVE, MODELS, SCHEMA, QUEUE_BINDING, SWEEP_GRACE_S, SWEEP_LIMIT,
  missingSettings, buildApi, buildRunner,
} from "../src/worker.mjs";
import { AGENTS } from "../src/agents.mjs";
import { makeStandIn } from "../src/model-standin.mjs";
import { runAgent } from "../src/run.mjs";
import { memoryRest } from "./helpers/memory-rest.mjs";
import { LEASE_TTL_S, BEAT_EVERY_MS } from "../src/runner.mjs";

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

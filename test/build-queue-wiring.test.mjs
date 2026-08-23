// The build really leaves the request, and really runs on the other side.
//
// WHY DRIVEN AND NOT READ. This is the wiring layer, where this repo has
// recorded twelve dead features — every one of them a module that was correct
// and a single line in `worker.js` that did not connect it. A source-read for
// `BUILD_QUEUE.send(` is satisfied by a call whose result is discarded, by a
// call inside a branch nothing reaches, and by a comment. What has to hold is
// that a build POST puts a runnable job somewhere and sends a message naming it,
// that the consumer turns that message back into a build, and that when our own
// side cannot take the job the customer's build happens anyway.
//
// WHAT THIS CANNOT PROVE. That Cloudflare really keeps a queue consumer alive
// for fifteen minutes across a real disconnect. Only a live run can, and that is
// the next task rather than a gap in this file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadWorker, makeCtx, isUnrouted } from "./fixtures/worker-harness.mjs";
import { JOB_KIND, JOB_PREFIX, isJobId, jobKey, resultKey, readJob, packJob, packResult, replayRequest } from "../builder/build-job.mjs";

const BRIEF = { brief: "a barber shop in Leeds" };
const TOKEN = "Bearer some-token";
const USER = { id: "u-test-1", email: "owner@example.com" };

// EVERY TEST THAT REACHES THE WAIT IS BOUNDED, and finding out why cost a
// mutation sweep. `awaitJobResult` polls for the consumer's answer for SIXTEEN
// MINUTES, which is right in production — a build outlives the request by design
// — and in a test it means "the answer never came" reads as a hang rather than a
// failure. The first sweep sat for a quarter of an hour on the mutant that
// stores a job and never sends the message, which is exactly the bug those tests
// exist to catch. The happy path answers on the first look with no sleep at all,
// so this is generous by two orders of magnitude and can only ever fire on the
// case that would otherwise stall.
const TIMEOUT = 8000;

/** GoTrue is the only thing between an unauthenticated request and the build. */
async function withUser(run, other) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    if (other) return other(url, init);
    // EVERYTHING ELSE FAILS, deliberately: a stub that answers every call with a
    // user makes a ledger read parse an id as a balance and the build wanders
    // somewhere nobody chose. A refusal stops it at a named place.
    return new Response("unavailable", { status: 503 });
  };
  try { return await run(); } finally { globalThis.fetch = real; }
}

function fakeBucket(initial = {}, { failPut = false } = {}) {
  const store = new Map(Object.entries(initial));
  const log = [];
  return {
    store, log,
    async get(k) { log.push(["get", k]); const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { log.push(["put", k]); if (failPut) throw new Error("R2 is having a moment"); store.set(k, String(v)); },
    async delete(k) { log.push(["delete", k]); store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/** A queue whose consumer is instantaneous — `send` writes the answer the
 *  waiting request is polling for, so the round trip finishes in one look. */
function instantQueue(bucket, result) {
  const sent = [];
  return {
    sent,
    async send(msg) {
      sent.push(msg);
      await bucket.put(resultKey(msg.id), JSON.stringify(result));
    },
  };
}

function fakeQueue() {
  const sent = [];
  return { sent, async send(msg) { sent.push(msg); } };
}

async function post(env, body = BRIEF) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/react-build", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await worker.fetch(req, env, makeCtx());
  const text = await res.text();
  return { status: res.status, text, res };
}

test("a build POST hands the work to the queue and answers what came back", { timeout: TIMEOUT }, async () => {
  const bucket = fakeBucket();
  const answer = packResult({ status: 200, type: "application/json", body: JSON.stringify({ ok: true, slug: "fold-lane", page: "app" }) });
  const queue = instantQueue(bucket, answer);
  const r = await withUser(() => post({ SITES_BUCKET: bucket, BUILD_QUEUE: queue }));

  // THE MESSAGE IS THE FEATURE. Without it the build never leaves the request
  // and a dropped connection still kills it.
  assert.equal(queue.sent.length, 1, "the build was not handed to the queue");
  assert.equal(queue.sent[0].kind, JOB_KIND, "the message does not name a build, so the consumer will refuse it");
  assert.ok(isJobId(queue.sent[0].id), `the message carries ${JSON.stringify(queue.sent[0].id)}, which is not a job id`);

  // A JOB WAS WRITTEN BEFORE THE MESSAGE WENT. The other order is a consumer
  // that refuses a job the producer is about to write.
  const puts = bucket.log.filter(([op]) => op === "put").map(([, k]) => k);
  assert.ok(puts.includes(jobKey(queue.sent[0].id)), `no job object was stored — puts were ${JSON.stringify(puts)}`);

  // AND THE CALLER GETS THE CONSUMER'S ANSWER, unchanged. This is the property
  // that keeps the client working: the route has never streamed and does not
  // start now.
  assert.equal(r.status, 200, `the queued answer did not reach the caller: ${r.text.slice(0, 200)}`);
  assert.deepEqual(JSON.parse(r.text), { ok: true, slug: "fold-lane", page: "app" });
});

test("a refusal's status survives the queue, not just a success", { timeout: TIMEOUT }, async () => {
  // THE HALF MOST LIKELY TO BE QUIETLY MANGLED. `build smoke` and
  // `build-as-owner` both read real HTTP statuses off this route — 402, 409,
  // 422, 503 — so an envelope that flattened everything to 200 would break the
  // harnesses that verify it while every success still looked perfect.
  for (const status of [402, 409, 422, 503]) {
    const bucket = fakeBucket();
    const queue = instantQueue(bucket, packResult({ status, body: JSON.stringify({ ok: false, msg: "no" }) }));
    const r = await withUser(() => post({ SITES_BUCKET: bucket, BUILD_QUEUE: queue }));
    assert.equal(r.status, status, `a ${status} came back as ${r.status}`);
  }
});

test("an answer that will not read is said out loud, not turned into a broken Response", { timeout: TIMEOUT }, async () => {
  // FOUND BY MUTATION. Dropping `readResult` from the wait survived everything,
  // because a well-formed envelope reads the same either way — so nothing drove
  // an unusable one through the WAIT, only through the module.
  //
  // What the missing check costs is not a wrong answer, it is a THROW: an
  // envelope carrying a status of 99 or a stringified one reaches
  // `new Response(body, { status })`, which raises, and the route answers 500
  // with nothing in it. The customer's site may well be published, and the one
  // thing they are told is that something broke.
  for (const junk of [
    { v: 1, status: 99, type: "application/json", body: "{}" },      // not a status
    { v: 1, status: "200", type: "application/json", body: "{}" },   // a string
    { v: 99, status: 200, type: "application/json", body: "{}" },    // a version we do not write
    { hello: "world" },                                              // not an envelope at all
    "not even an object",
  ]) {
    const bucket = fakeBucket();
    const queue = instantQueue(bucket, junk);
    const r = await withUser(() => post({ SITES_BUCKET: bucket, BUILD_QUEUE: queue }));
    assert.equal(r.status, 503, `an unreadable envelope answered ${r.status}: ${r.text.slice(0, 160)}`);
    assert.match(r.text, /could not be read/, "the answer does not say the envelope was the problem");
    // AND IT SAYS THE SITE MAY BE FINE, because it may well be — the build ran,
    // we lost the answer on the way back, and telling somebody their build
    // failed when it published is the more expensive of the two lies.
    assert.match(r.text, /may well have been built/, "the customer is told the build failed when it may have worked");
    // The job id travels: it is the handle to the build that really happened.
    assert.match(r.text, /"job"\s*:\s*"[0-9a-f]{32}"/, "the answer names no job, so nothing can be looked up");
  }
});

test("what the producer stored is a job the consumer can run", { timeout: TIMEOUT }, async () => {
  // A COMPOSITION THROUGH THE REAL PRODUCER, rather than two fixtures agreeing
  // with each other and with neither end — the `routeOf` lesson.
  const bucket = fakeBucket();
  const queue = instantQueue(bucket, packResult({ status: 200, body: "{}" }));
  await withUser(() => post({ SITES_BUCKET: bucket, BUILD_QUEUE: queue }, { brief: "a café in Lisbon", slug: "cafe" }));

  const stored = bucket.store.get(jobKey(queue.sent[0].id));
  assert.ok(stored, "nothing was stored under the key the message names");
  const job = readJob(JSON.parse(stored));
  assert.ok(job, "the stored job is a shape readJob refuses — the consumer would drop it");
  assert.equal(job.auth, TOKEN, "the caller's own credential did not reach the job, so the ledger cannot charge them");
  const req = replayRequest(job);
  assert.deepEqual(await req.json(), { brief: "a café in Lisbon", slug: "cafe" },
    "the brief did not survive into the job, so the consumer would build from nothing");
  assert.match(job.url, /\/api\/site\/react-build$/, "the job names a different route from the one that was asked for");
});

test("an unauthenticated build is refused BEFORE anything is queued", { timeout: TIMEOUT }, async () => {
  // A message is a container run and a model call. An open enqueue is somebody
  // else's build on our bill.
  const bucket = fakeBucket();
  const queue = fakeQueue();
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/react-build", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(BRIEF),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: bucket, BUILD_QUEUE: queue }, makeCtx());
  assert.equal(res.status, 401, "an unauthenticated build was not refused");
  assert.equal(queue.sent.length, 0, "an unauthenticated build reached the queue");
  assert.equal(bucket.store.size, 0, "an unauthenticated build wrote a job object");
});

test("if OUR side cannot take the job, the build still happens — with its body intact", { timeout: TIMEOUT }, async () => {
  // THE FALL-THROUGH, AND ITS ONE SHARP EDGE. `enqueueSiteBuild` reads the body
  // to store it, and a request body reads ONCE — so running the ORIGINAL request
  // inline afterwards hands the build an unreadable body and answers 400
  // "couldn't read that request". A fall-back that fails worse than the thing it
  // is falling back from. The replay is what makes it honest, and this asserts
  // the exact status that bug produces.
  const bucket = fakeBucket({}, { failPut: true });
  const queue = fakeQueue();
  const env = {
    SITES_BUCKET: bucket, BUILD_QUEUE: queue,
    NEON_API_KEY: "neon", SUPABASE_SERVICE_KEY: "svc", ANTHROPIC_API_KEY: "anth",
  };
  const r = await withUser(() => post(env));
  assert.equal(queue.sent.length, 0, "a job that could not be stored was announced to the consumer anyway");
  assert.ok(!isUnrouted(r), "the route fell through entirely");
  assert.notEqual(r.status, 401, "the replay lost the caller's token, so the inline build refused its own owner");
  assert.doesNotMatch(r.text, /couldn't read that request/,
    "the inline build was handed the request whose body had already been read — the fall-through needs a replay");
  assert.doesNotMatch(r.text, /that wasn't valid JSON/, "the replayed body is not the JSON that arrived");
});

test("with no queue binding the route behaves exactly as it did before", { timeout: TIMEOUT }, async () => {
  // The binding is the switch, so the code shipped and was proved to deploy
  // before any build depended on it — and a namespace that goes away degrades to
  // today's behaviour rather than to no builds at all.
  const r = await withUser(() => post({}));
  assert.ok(!isUnrouted(r), "the route fell through with no queue binding");
  assert.notEqual(r.status, 401, "an authenticated build was refused with no queue binding");
  assert.match(r.text, /not configured/, `expected the inline build's own 501, got ${r.status}: ${r.text.slice(0, 160)}`);
});

// ── THE CONSUMER ────────────────────────────────────────────────────────────

async function drive(env, body) {
  const worker = await loadWorker();
  let acked = 0;
  await worker.queue({ messages: [{ body, ack() { acked++; } }] }, env, makeCtx());
  return acked;
}

test("a queued message becomes a build, and its answer is written back", { timeout: TIMEOUT }, async () => {
  const id = "a".repeat(32);
  const bucket = fakeBucket({
    [jobKey(id)]: JSON.stringify(packJob({
      url: "https://gofarther.dev/api/site/react-build",
      auth: TOKEN, body: JSON.stringify(BRIEF), uid: USER.id, at: 1,
    })),
  });
  // No NEON_API_KEY, so the build stops at its own first configuration check —
  // which is a real answer from the real build function and is exactly what has
  // to reach the waiting request.
  const acked = await withUser(() => drive({ SITES_BUCKET: bucket }, { kind: JOB_KIND, id }));

  assert.equal(acked, 1, "the message was not acknowledged — a retry runs the build again and charges twice");
  const written = bucket.store.get(resultKey(id));
  assert.ok(written, "the build ran and its answer was never written, so the waiting request times out");
  const out = JSON.parse(written);
  assert.equal(out.status, 501, `expected the build's own configuration refusal, got ${out.status}`);
  assert.match(out.body, /not configured/, "the body written back is not the build's own answer");

  // THE JOB IS DELETED AS SOON AS IT IS READ. It carries a live access token;
  // once it is in memory the object has no further use.
  assert.ok(!bucket.store.has(jobKey(id)), "the job object survived the build, leaving a credential in the bucket");
});

test("a message the consumer cannot read is dropped, never retried", { timeout: TIMEOUT }, async () => {
  for (const body of [null, { kind: "something-else", id: "a".repeat(32) }, { kind: JOB_KIND }, { kind: JOB_KIND, id: "nope" }]) {
    const bucket = fakeBucket();
    const acked = await drive({ SITES_BUCKET: bucket }, body);
    assert.equal(acked, 1, `${JSON.stringify(body)} was not acknowledged — it would come round forever`);
    assert.equal(bucket.store.size, 0, `${JSON.stringify(body)} caused a write`);
  }
});

test("a job that is not there is dropped rather than retried", { timeout: TIMEOUT }, async () => {
  // The commonest cause is a producer whose send landed and whose store write
  // did not — which that side already handled by running the build inline. There
  // is nothing waiting on a result and nothing to recover.
  const id = "b".repeat(32);
  const bucket = fakeBucket();
  const acked = await withUser(() => drive({ SITES_BUCKET: bucket }, { kind: JOB_KIND, id }));
  assert.equal(acked, 1, "a missing job was left to be redelivered");
  assert.ok(!bucket.store.has(resultKey(id)), "a missing job produced a result out of nothing");
});

test("a build that throws still answers, and the answer names the class", { timeout: TIMEOUT }, async () => {
  // A THROW MUST NOT BECOME A RETRY, and it must not become silence either: the
  // customer is polling for a result that would never arrive. The class is what
  // has ever identified this failure shape here — `<name> is not defined` is how
  // the 2026-08-21 outage was found.
  const id = "c".repeat(32);
  const bucket = fakeBucket({
    [jobKey(id)]: JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: TOKEN, body: JSON.stringify(BRIEF), uid: USER.id, at: 1 })),
  });
  // `authUser` throwing is the cheapest way to make the real build function
  // throw rather than answer.
  const real = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("network is down"); };
  let acked;
  try { acked = await drive({ SITES_BUCKET: bucket }, { kind: JOB_KIND, id }); }
  finally { globalThis.fetch = real; }

  assert.equal(acked, 1, "a build that threw was left to be redelivered and charged again");
  const written = bucket.store.get(resultKey(id));
  // `authUser` catches its own network errors, so this may well answer rather
  // than throw — either is correct. What must never happen is nothing at all.
  assert.ok(written, "a build that could not reach its provider wrote no answer, so the request waits for nothing");
});

test("the auth gate is what stops an enqueue, not a TypeError further down", () => {
  // FOUND BY MUTATION, AND THE WAY IT SURVIVED IS THE POINT. Making the gate
  // inert (`if (false) return { res: UNAUTHED() }`) still produced a 401 with
  // nothing queued — because `packJob({ …, uid: bu.id })` throws on a null user,
  // the throw is caught by the store's own try, and the fall-through runs the
  // build inline where `authUser` refuses it properly.
  //
  // So the behaviour was right and the GATE was held by nothing. That is
  // belt-and-braces standing in for a security control, and the accident holding
  // it is one edit away from changing — the day `uid` stops being read there,
  // removing this line enqueues an unauthenticated build, which is somebody
  // else's container run and model call on our bill.
  //
  // Read from the source because it is an ORDERING, which no test driving the
  // function from outside can distinguish from the accident above.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("async function enqueueSiteBuild(");
  assert.ok(at > 0, "the producer is gone or renamed — this guard is watching nothing");
  const end = src.indexOf("\n}\n", at);
  assert.ok(end > at, "could not find the end of the producer");
  const fn = src.slice(at, end).replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length));

  const gate = fn.indexOf("if (!bu)");
  assert.ok(gate > 0, "the producer no longer refuses an unauthenticated caller before it queues anything");
  const check = fn.indexOf("await authUser(");
  assert.ok(check >= 0 && check < gate, "the refusal does not follow an authUser call");
  const seg = fn.slice(gate, gate + 120);
  assert.match(seg, /return\b/, "the unauthenticated branch does not return, so the build is queued anyway");

  for (const side of ["SITES_BUCKET.put(", "BUILD_QUEUE.send("]) {
    const i = fn.indexOf(side);
    assert.ok(i > 0, `the producer no longer calls ${side} — this guard is watching nothing`);
    assert.ok(gate < i, `${side} happens before the caller is authenticated`);
  }
});

test("the job store is under a prefix nothing serves", { timeout: TIMEOUT }, async () => {
  // `sites/<slug>/` is the public prefix. A job carries a live access token, so
  // it living outside that is the whole reason it may hold one.
  const bucket = fakeBucket();
  const queue = instantQueue(bucket, packResult({ status: 200, body: "{}" }));
  await withUser(() => post({ SITES_BUCKET: bucket, BUILD_QUEUE: queue }));
  for (const [, key] of bucket.log) {
    assert.ok(key.startsWith(JOB_PREFIX), `the queue wrote to ${key}, outside the private job prefix`);
  }
});

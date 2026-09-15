import test from "node:test";
import assert from "node:assert/strict";
import { makeRunner, LEASE_TTL_S, BEAT_EVERY_MS, TOLERATED_MISSES, MAX_ATTEMPTS, OUTCOMES } from "../src/runner.mjs";
import { makeApi } from "../src/api.mjs";
import { makeVerifier, TENANT_CLAIM, HS } from "../src/auth.mjs";
import { defineAgent, defineTool, PUBLIC } from "../src/define.mjs";
import { startedEntry, limitsToJson } from "../src/journal.mjs";
import { liveStore } from "./helpers/memory-rest.mjs";

const NOW = 1_800_000_000_000;

/** A timer nothing fires but a test. */
function fakeTimer() {
  const pending = new Map();
  let id = 0;
  return {
    set: (fn) => { const h = ++id; pending.set(h, fn); return h; },
    clear: (h) => { pending.delete(h); },
    async fire() { const fns = [...pending.values()]; pending.clear(); for (const f of fns) await f(); },
    get waiting() { return pending.size; },
  };
}

const b64url = (b) => btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
async function sign(payload) {
  const body = `${enc({ alg: HS, typ: "JWT" })}.${enc(payload)}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("s3cret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}
const tokenFor = (t) => sign({ [TENANT_CLAIM]: t, exp: Math.floor(NOW / 1000) + 3600 });

const says = (text) => ({ text, toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1 });
const wants = (...names) => ({ text: "", usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1,
  toolCalls: names.map((n, i) => ({ id: `c${i}`, name: n, args: {} })) });

/**
 * One store, one queue, one runner, a clock a test can move, and a timer a test
 * fires by hand. Everything the lease needs in order to be driven rather than
 * waited for.
 */
function bench({ answers = [says("ok")], tools = [], limits = {}, maxAttempts, onError = () => {} } = {}) {
  let clock = NOW;
  const timer = fakeTimer();
  const { rest, store, work } = liveStore({ now: () => clock });
  const agents = { support: defineAgent({ name: "support", model: "m", instructions: "help", tools, limits }) };

  const calls = [];
  const send = async (req) => {
    calls.push(req);
    const a = answers[calls.length - 1];
    if (a === undefined) throw new Error("the process stopped existing");
    return typeof a === "function" ? await a(req) : a;
  };

  let w = 0;
  const runner = makeRunner({
    work, store, send, agents, timer, maxAttempts, onError,
    now: () => clock, nameWorker: () => `worker-${++w}`,
  });

  const queue = [];
  const api = makeApi({
    verify: makeVerifier({ secret: "s3cret", now: () => NOW }),
    store, work, agents, onError,
    notify: async ({ runId }) => { queue.push(runId); },
    now: () => clock, newId: (() => { let n = 0; return () => `run-${++n}`; })(),
  });

  /** Accept a run the way the API does, so the fixture is the real producer's. */
  const accept = async (tenant, prompt = "go") => {
    const token = await tokenFor(tenant);
    const res = await api.fetch(new Request("https://api.test/runs", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: "support", prompt }),
    }));
    return { ...(await res.json()), token };
  };
  const resume = async (runId, token) => api.fetch(new Request(`https://api.test/runs/${runId}/resume`, {
    method: "POST", headers: { authorization: `Bearer ${token}` },
  }));
  const view = async (runId, token) => (await api.fetch(new Request(`https://api.test/runs/${runId}`, {
    headers: { authorization: `Bearer ${token}` },
  }))).json();

  return {
    rest, store, work, runner, timer, queue, api, accept, resume, view, calls,
    at: (ms) => { clock = ms; },
    advance: (ms) => { clock += ms; },
    get clock() { return clock; },
    kinds: (runId) => [...rest.entries.get(runId).values()].map((e) => e.kind),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PERSISTED BEFORE ACCEPTED
// ════════════════════════════════════════════════════════════════════════════

test("THE WORK IS COMMITTED BEFORE ACCEPTANCE IS ACKNOWLEDGED", async () => {
  const b = bench();
  const { runId } = await b.accept("t1", "do the thing");
  // All three parts of one transaction: the run, its first entry, its work row.
  assert.ok(b.rest.runs.has(runId), "no run row");
  assert.deepEqual(b.kinds(runId), ["started"], "the prompt was not written down");
  assert.ok(b.rest.work.has(runId), "no work row — the delivery is all there is");
  // And the log, not the request, is what says what to do.
  const entry = [...b.rest.entries.get(runId).values()][0];
  assert.equal(entry.prompt, "do the thing");
  assert.equal(entry.agent, "support");
  assert.equal(b.calls.length, 0, "the model was called before the work was accepted");
});

test("A RETRIED ACCEPT IS ABSORBED, and can never attach to another tenant's run", async () => {
  const b = bench();
  const { runId } = await b.accept("t1");
  const entry = startedEntry({ at: NOW, tenant: "t1", agent: "support", model: "m", prompt: "go", limits: limitsToJson({}) });
  // The same id again, same tenant: a no-op, not an error — the caller cannot know
  // which side of the commit its connection died on.
  const again = await b.work.accept({ runId, tenant: "t1", entry });
  assert.equal(again.state, "queued");
  assert.equal(b.rest.entries.get(runId).size, 1, "a retry wrote a second started entry");
  // The same id from somebody else is NOT FOUND, never a takeover.
  await assert.rejects(
    () => b.work.accept({ runId, tenant: "t2", entry }),
    (e) => e.code === "not-found",
    "a stranger's retry was absorbed into this tenant's run",
  );
});

// ════════════════════════════════════════════════════════════════════════════
// EXACTLY ONE EXECUTION
// ════════════════════════════════════════════════════════════════════════════

test("TWO DELIVERIES OF ONE RUN DO NOT BOTH EXECUTE IT", async () => {
  // The scenario the queue must survive: at-least-once delivery. Both messages
  // arrive, both are claimed for, and only one claim can succeed.
  let open;
  const held = new Promise((r) => { open = r; });
  const b = bench({ answers: [async () => { await held; return says("only once"); }] });
  const { runId, token } = await b.accept("t1");

  const first = b.runner.deliver(runId);
  // The second delivery arrives while the first is inside its model call.
  await new Promise((r) => setTimeout(r, 0));
  const second = await b.runner.deliver(runId);
  assert.equal(second.ran, false, "a duplicate delivery executed the run a second time");
  assert.equal(second.why, "not-claimable");

  open();
  const a = await first;
  assert.equal(a.ran, true, `the first delivery did not run: ${a.why}`);
  assert.equal(b.calls.length, 1, `the model was called ${b.calls.length} times for one run`);
  const v = await b.view(runId, token);
  assert.equal(v.text, "only once");
  assert.equal(v.steps, 1);
});

test("A RESUME ARRIVING WHILE THE RUN IS WORKING IS NOT A SECOND DELIVERY", async () => {
  let open;
  const held = new Promise((r) => { open = r; });
  const b = bench({ answers: [async () => { await held; return says("done"); }] });
  const { runId, token } = await b.accept("t1");

  const running = b.runner.deliver(runId);
  await new Promise((r) => setTimeout(r, 0));
  const rungBefore = b.queue.length;   // the accept's own doorbell, never drained here

  // The customer presses resume mid-run. The DATABASE decides, holding the row.
  const res = await b.resume(runId, token);
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.resumed, false, "a resume mid-run was accepted as a new delivery");
  assert.equal(body.reason, "already-running");
  assert.equal(b.queue.length, rungBefore, "a resume mid-run rang the doorbell anyway");

  open();
  await running;
  assert.equal(b.calls.length, 1, "the run was executed twice");
});

test("TWO SIMULTANEOUS RESUMES BECOME ONE EXECUTION", async () => {
  // Both presses land while nothing holds the row, so both are legitimately
  // queued — and the claim is what makes them one run.
  const b = bench({ answers: [() => { throw new Error("gone"); }, says("second time")] });
  const { runId, token } = await b.accept("t1");
  await b.runner.deliver(b.queue.shift());          // dies, writing a stop
  // Strip the stop, which is what a process that vanished before writing one looks
  // like. Taken off the STORED log rather than hand-built.
  const log = b.rest.entries.get(runId);
  for (const [seq, e] of [...log.entries()]) if (e.kind === "stopped") log.delete(seq);

  const [r1, r2] = await Promise.all([b.resume(runId, token), b.resume(runId, token)]);
  assert.equal(r1.status, 202);
  assert.equal(r2.status, 202);
  assert.equal(b.queue.length, 2, "two resumes did not both queue a delivery");

  const outs = [];
  while (b.queue.length) outs.push(await b.runner.deliver(b.queue.shift()));
  assert.equal(outs.filter((o) => o.ran).length, 1, "both deliveries executed the run");
  assert.equal(outs.filter((o) => o.why === "not-claimable").length, 1);
  const v = await b.view(runId, token);
  assert.equal(v.text, "second time");
  // ONE step, and that is correct rather than a loss: the first call THREW, so no
  // model entry was ever written and there was nothing to carry forward. What the
  // claim bought is that the two resumes cost ONE call between them, not two.
  assert.equal(v.steps, 1, `the run reports ${v.steps} steps`);
  assert.equal(b.calls.length, 2, `${b.calls.length} model calls for one failure and one resume`);
});

test("A FINISHED RUN IS NOT EXECUTED AGAIN, however often it is delivered", async () => {
  const b = bench({ answers: [says("once")] });
  const { runId, token } = await b.accept("t1");
  await b.runner.deliver(runId);
  assert.equal(b.calls.length, 1);

  // A stray redelivery — a duplicate message, or a sweeper that raced a release.
  b.rest.work.get(runId).done_at = null;            // pretend the release was lost
  const again = await b.runner.deliver(runId);
  assert.equal(again.ran, false);
  assert.equal(again.why, "already-finished");
  assert.equal(b.calls.length, 1, "a finished run was executed again");
  assert.notEqual(b.rest.work.get(runId).done_at, null, "the redelivery left the work outstanding");
  const v = await b.view(runId, token);
  assert.equal(v.steps, 1, "a redelivery added a step to a finished run");
});

// ════════════════════════════════════════════════════════════════════════════
// THE LEASE
// ════════════════════════════════════════════════════════════════════════════

test("A LOST LEASE STOPS THE RUN AND WRITES NO HISTORY", async () => {
  // THE SCENARIO: this worker stalls long enough for its lease to lapse. Somebody
  // else may already be running this run, so anything written from here is a
  // second copy of history.
  const b = bench({
    answers: [
      async () => {
        // The lease lapses while this call is in flight, and the beat notices. Done
        // from INSIDE the call because that is where the heartbeat is demonstrably
        // armed — `deliver` schedules it before it starts the run.
        b.advance(LEASE_TTL_S * 1000 + 1);
        await b.timer.fire();
        return says("an answer nobody may record");
      },
    ],
    limits: { steps: 4 },
  });
  const { runId, token } = await b.accept("t1");
  const out = await b.runner.deliver(runId);
  assert.equal(out.ran, false, "a run continued past a lost lease");
  assert.equal(out.why, "lease-lost", `stopped for "${out.why}"`);

  // **NO STOP WAS WRITTEN.** That is the whole point: whoever holds the lease now
  // finds the run exactly as it was, rather than finding it already closed.
  const v = await b.view(runId, token);
  assert.equal(v.status, "running", `a lost lease closed the log as "${v.status}"`);
  assert.equal(v.stop, null);
  assert.ok(!b.kinds(runId).includes("stopped"), "a worker without a lease wrote history");
  // Not even the model answer it had already received: the journal gate refuses
  // every write once the lease is gone, so the log is exactly as the next holder
  // needs to find it.
  assert.deepEqual(b.kinds(runId), ["started"], `log: ${b.kinds(runId)}`);
  // And the work is still outstanding, so it will be offered again.
  assert.equal(b.rest.work.get(runId).done_at, null, "a dropped run was taken off the queue");
});

test("A LOST LEASE COSTS NO MODEL CALL AT ALL, because the gate is IN FRONT of the call", async () => {
  // **THIS IS THE ONE SHAPE WHERE THE PRE-CALL GATE IS THE ONLY WALL, and a sweep
  // had to point that out.** Once a run is going, the journal gate always fires
  // first — every model call has a journal write just before it — so a test that
  // loses the lease mid-run proves the journal gate and nothing about this one.
  //
  // The gap is between the CLAIM and the FIRST call, where the only journal write so
  // far was the API's. So the lease is lost while the log is being read: with the
  // gate, zero model calls; without it, one is bought and only then refused.
  const b = bench({ answers: [says("a call that must never be made")] });
  const r = await b.accept("t1");
  const realForTenant = b.store.forTenant.bind(b.store);
  b.store.forTenant = (t) => {
    const scoped = realForTenant(t);
    const realOpen = scoped.open.bind(scoped);
    return { ...scoped, open: async (id) => {
      const opened = await realOpen(id);
      b.advance(LEASE_TTL_S * 1000 + 1);   // the lease lapses while the log is read
      await b.timer.fire();
      return opened;
    } };
  };
  const out = await b.runner.deliver(r.runId);
  assert.equal(out.why, "lease-lost", `stopped for "${out.why}"`);
  assert.equal(b.calls.length, 0, `${b.calls.length} model calls were bought without a lease`);

  // THE CONTROL: the same wrapper without losing the lease runs normally, so the
  // refusal above is about the lease and not about the wrapper.
  const c = bench({ answers: [says("fine")] });
  const r2 = await c.accept("t1");
  const keep = c.store.forTenant.bind(c.store);
  c.store.forTenant = (t) => ({ ...keep(t) });
  assert.equal((await c.runner.deliver(r2.runId)).ran, true);
  assert.equal(c.calls.length, 1);
});

test("A DROPPED RUN STILL RECORDS WHO WAS HOLDING IT", async () => {
  // Why the runner does not release a lease it has lost, beyond the obvious: the row
  // keeps naming the worker that dropped it, which is the only thing that says
  // afterwards WHICH holder went away. `release_run` is gated on `claimed_by` too, so
  // the dangerous case — releasing a claim somebody else now holds — is walled in the
  // database as well; this half is the diagnostic one.
  const b = bench({
    answers: [async () => { b.advance(LEASE_TTL_S * 1000 + 1); await b.timer.fire(); return says("never recorded"); }],
  });
  const { runId } = await b.accept("t1");
  assert.equal((await b.runner.deliver(runId)).why, "lease-lost");
  const row = b.rest.work.get(runId);
  assert.equal(row.claimed_by, "worker-1", "the row forgot which worker dropped the run");
  assert.equal(row.done_at, null, "a dropped run was taken off the queue");
  // ...and it is still reclaimable, so keeping the stale claim costs nothing.
  assert.deepEqual((await b.runner.reclaimable({ graceS: 0 })).map((d) => d.runId), [runId]);
});

test("A BROKEN JOURNAL IS RETRYABLE; A MISSING AGENT IS NOT", async () => {
  // Two endings that look alike from outside and need opposite handling. A journal
  // that could not be written may work next time; an agent this deployment does not
  // have needs a release, not a retry.
  const a = bench({ answers: [says("x")] });
  const r = await a.accept("t1");
  // Fail every entry write, which is what a journal outage looks like from the loop.
  const scoped = a.store.forTenant("t1");
  const realOpen = a.store.forTenant.bind(a.store);
  a.store.forTenant = (t) => {
    const s2 = realOpen(t);
    return { ...s2, open: async (id) => {
      const o = await s2.open(id);
      return { ...o, journal: { append: async () => { throw new Error("the log is unwritable"); } } };
    } };
  };
  const out = await a.runner.deliver(r.runId);
  assert.equal(out.why, "failed", `a broken journal reported "${out.why}"`);
  assert.equal(a.rest.work.get(r.runId).done_at, null, "a broken journal was taken off the queue");
  assert.match(a.rest.work.get(r.runId).last_error, /journal-failed/);

  const b = bench({ answers: [says("x")] });
  const r2 = await b.accept("t1");
  b.rest.runs.get(r2.runId).agent_name = "vanished";
  const log = b.rest.entries.get(r2.runId);
  for (const [seq, e] of [...log.entries()]) if (e.kind === "started") log.set(seq, { ...e, agent: "vanished" });
  const out2 = await b.runner.deliver(r2.runId);
  assert.equal(out2.why, "no-agent");
  assert.notEqual(b.rest.work.get(r2.runId).done_at, null, "a run needing a deployment is being retried for ever");
});

test("TWO DELIVERIES IN ONE ISOLATE MUST NOT SHARE A WORKER NAME", async () => {
  // **THE HAZARD, WHICH IS NOT THE OBVIOUS ONE.** The claim already stops two
  // deliveries running one run, whatever they are called. What a shared name breaks
  // is the HANDOVER: worker A's lease lapses, worker B claims the same run, and A's
  // next beat is gated on `claimed_by = <name>` — which MATCHES if they share one.
  // A then believes it still holds a lease B is holding, and two workers run one run.
  const b = bench({ answers: [says("x")] });
  const { runId } = await b.accept("t1");

  const shared = "same-name";
  assert.equal((await b.work.claim({ runId, worker: shared, ttlS: 1 })).claimed, true, "A could not claim");
  b.advance(2000);                                        // A's lease lapses
  assert.equal((await b.work.claim({ runId, worker: shared, ttlS: 90 })).claimed, true, "B could not take it over");
  assert.equal(await b.work.beat({ runId, worker: shared, ttlS: 90 }), true,
    "with a shared name, A's beat succeeds — which is the whole problem");

  // With distinct names the handover is clean: A's beat is refused, so A stops.
  const c = bench({ answers: [says("x")] });
  const r2 = await c.accept("t1");
  assert.equal((await c.work.claim({ runId: r2.runId, worker: "A", ttlS: 1 })).claimed, true);
  c.advance(2000);
  assert.equal((await c.work.claim({ runId: r2.runId, worker: "B", ttlS: 90 })).claimed, true);
  assert.equal(await c.work.beat({ runId: r2.runId, worker: "A", ttlS: 90 }), false,
    "the displaced worker was allowed to keep its lease");
  assert.equal(await c.work.beat({ runId: r2.runId, worker: "B", ttlS: 90 }), true, "the new holder cannot beat");

  // So the DEFAULT namer must produce a fresh name per delivery. The bench injects a
  // counter, so the default is checked on its own here — by running it.
  const names = new Set();
  const spy = {
    claim: async ({ worker }) => { names.add(worker); return { claimed: false }; },
    beat: async () => true, release: async () => true, sweep: async () => [],
  };
  const plain = makeRunner({
    work: spy, store: b.store, send: async () => says("x"), timer: fakeTimer(),
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "i" }) },
  });
  for (let i = 0; i < 5; i++) await plain.deliver(`run-${i}`);
  assert.equal(names.size, 5, `five deliveries produced ${names.size} distinct worker name(s)`);
});

test("A RUN THAT KEEPS BEATING IS NEVER TAKEN AWAY, however long it takes", async () => {
  // THE LEASE IS A LIVENESS CHECK, NOT A DURATION CAP. This run lasts many times
  // its own TTL and is never reclaimed, because it keeps saying it is there.
  const beats = [];
  const b = bench({
    answers: [
      async () => { for (let i = 0; i < 10; i++) { b.advance(BEAT_EVERY_MS); await b.timer.fire(); beats.push(b.clock); } return says("still here"); },
    ],
  });
  const { runId, token } = await b.accept("t1");
  const out = await b.runner.deliver(runId);
  assert.equal(beats.length, 10, "the heartbeat stopped");
  assert.equal(out.ran, true, `a beating run was stopped: ${out.why}`);
  assert.ok(b.clock - NOW > LEASE_TTL_S * 1000 * 3, "the run did not outlast its own TTL several times over");
  assert.equal((await b.view(runId, token)).text, "still here");
});

test("A BEAT THAT CANNOT BE SENT IS TOLERATED EXACTLY AS FAR AS THE ARITHMETIC ALLOWS", async () => {
  // CANNOT-TELL IS NOT A YES, but the TTL is deliberately several beats long, so
  // one missed beat is still inside a lease we demonstrably hold. Past that, stop.
  assert.ok(TOLERATED_MISSES >= 1, "the TTL is not long enough to tolerate a single blip");
  assert.equal(TOLERATED_MISSES, Math.floor((LEASE_TTL_S * 1000) / BEAT_EVERY_MS) - 2, "the tolerance is not derived from the TTL");

  const seen = [];
  let fail = 0;
  // The beats are fired from INSIDE the model call, which is the only moment the
  // heartbeat is demonstrably armed AND the run is still going.
  const beatsDuringCall = (n) => async () => { for (let i = 0; i < n; i++) await b.timer.fire(); return says("ok"); };
  const b = bench({ answers: [beatsDuringCall(TOLERATED_MISSES), beatsDuringCall(TOLERATED_MISSES + 1)], onError: (e) => seen.push(e) });
  const realBeat = b.work.beat.bind(b.work);
  b.work.beat = async (a) => { if (fail-- > 0) throw new Error("the network went"); return realBeat(a); };

  // Exactly the tolerated number of failures: the run survives.
  fail = TOLERATED_MISSES;
  const r1 = await b.accept("t1");
  const out1 = await b.runner.deliver(r1.runId);
  assert.equal(out1.ran, true, `a tolerated blip stopped the run: ${out1.why}`);
  assert.ok(seen.some((e) => e.at === "beat"), "a failed beat was never reported");
  assert.ok(seen.some((e) => e.at === "beat" && e.misses === 1), "the miss count is not carried");

  // One more than tolerated: it stops, and says which kind of loss it was.
  fail = TOLERATED_MISSES + 1;
  const r2 = await b.accept("t1", "again");
  const out2 = await b.runner.deliver(r2.runId);
  assert.equal(out2.ran, false, "an unanswerable beat was worked through");
  assert.equal(out2.why, "beat-failed", `reported as "${out2.why}" rather than a failed beat`);
  // A DIFFERENT NAME FROM A DEFINITIVE LOSS, because they are different problems:
  // one is our network, the other is the database saying the lease is gone.
  assert.notEqual(out2.why, "lease-lost");
});

// ════════════════════════════════════════════════════════════════════════════
// THE RESTRICTION ON REPEATING UNCERTAIN ACTIONS, ACROSS A REDELIVERY
// ════════════════════════════════════════════════════════════════════════════

test("A REDELIVERY WILL NOT REPEAT A TOOL THAT MAY HAVE ALREADY RUN", async () => {
  // THE WHOLE HAZARD OF A DURABLE QUEUE IN ONE TEST. A tool with a real side
  // effect runs; the lease lapses before its result can be written; the sweeper
  // offers the run again. The log cannot say whether the charge went through, so
  // the only safe answer is to refuse and name it.
  let charged = 0;
  const charge = defineTool({
    name: "charge", description: "takes a payment", input: { type: "object" }, scope: PUBLIC,
    // NOT repeatable, which is the default and is the point.
    run: async () => {
      charged += 1;
      // The lease lapses while the payment is in flight — the worst moment there is.
      b.advance(LEASE_TTL_S * 1000 + 1);
      await b.timer.fire();
      return { ok: true };
    },
  });
  const b = bench({ answers: [wants("charge"), says("thanks")], tools: [charge] });
  const { runId, token } = await b.accept("t1");

  const first = await b.runner.deliver(runId);
  assert.equal(charged, 1, "the tool never ran, so this proves nothing");
  assert.equal(first.why, "lease-lost");
  // The result could not be written, so the log holds the CALL and no result.
  assert.deepEqual(b.kinds(runId), ["started", "model"], `log: ${b.kinds(runId)}`);

  // The sweeper finds it: the lease is gone, the work is outstanding.
  const dropped = await b.runner.reclaimable({ graceS: 0 });
  assert.deepEqual(dropped.map((d) => d.runId), [runId], "the dropped run was not reclaimable");

  // The redelivery REFUSES, and says exactly what blocked it.
  const second = await b.runner.deliver(runId);
  assert.equal(second.ran, false);
  assert.equal(second.why, "cannot-resume", `redelivery answered "${second.why}"`);
  assert.equal(charged, 1, `the payment was taken ${charged} times`);

  // It is off the queue — a further delivery would refuse identically — and the
  // run still reads as running with the pending call VISIBLE, because it is
  // waiting for a person rather than for a retry.
  assert.notEqual(b.rest.work.get(runId).done_at, null, "a run that needs a person was left spinning");
  const v = await b.view(runId, token);
  assert.equal(v.status, "running");
  assert.deepEqual(v.pending, [{ step: 1, name: "charge" }]);
  assert.deepEqual(v.problems, [], "a missing tool result was reported as a corrupt log");
});

test("A REPEATABLE TOOL IS FINISHED ON THE REDELIVERY, which is the other half of the rule", async () => {
  // THE CONTROL. Without it, "refuses to repeat" is indistinguishable from
  // "refuses to resume at all".
  let hits = 0;
  const look = defineTool({
    name: "look", description: "reads a thing", input: { type: "object" }, scope: PUBLIC, repeatable: true,
    run: async () => {
      hits += 1;
      if (hits === 1) { b.advance(LEASE_TTL_S * 1000 + 1); await b.timer.fire(); }
      return { seen: hits };
    },
  });
  const b = bench({ answers: [wants("look"), says("all done")], tools: [look] });
  const { runId, token } = await b.accept("t1");
  assert.equal((await b.runner.deliver(runId)).why, "lease-lost");
  assert.deepEqual(b.kinds(runId), ["started", "model"]);

  const second = await b.runner.deliver(runId);
  assert.equal(second.ran, true, `the redelivery did not run: ${second.why}`);
  assert.equal(hits, 2, "a repeatable tool was not re-run to fill the gap");
  const v = await b.view(runId, token);
  assert.equal(v.text, "all done");
  assert.deepEqual(v.pending, []);
  assert.deepEqual(b.kinds(runId), ["started", "model", "tool", "model", "stopped"]);
});

// ════════════════════════════════════════════════════════════════════════════
// THE OTHER OUTCOMES, EACH NAMED
// ════════════════════════════════════════════════════════════════════════════

test("EVERY OUTCOME THIS CONSUMER CAN REACH IS A DECLARED ONE", async () => {
  const seen = new Set();

  // ran / not-claimable
  const a = bench({ answers: [says("x")] });
  const ra = await a.accept("t1");
  seen.add((await a.runner.deliver(ra.runId)).why);
  a.rest.work.get(ra.runId).done_at = null;
  seen.add("already-finished");

  // not-claimable: somebody else holds a live lease
  const b2 = bench({ answers: [says("x")] });
  const rb = await b2.accept("t1");
  await b2.work.claim({ runId: rb.runId, worker: "somebody-else", ttlS: LEASE_TTL_S });
  seen.add((await b2.runner.deliver(rb.runId)).why);

  // unreadable: a junk entry in the log
  const c = bench({ answers: [says("x")] });
  const rc = await c.accept("t1");
  c.rest.entries.get(rc.runId).set(9, { kind: "not-a-kind" });
  seen.add((await c.runner.deliver(rc.runId)).why);

  // no-agent: the run names one this deployment does not have
  const d = bench({ answers: [says("x")] });
  const rd = await d.accept("t1");
  d.rest.runs.get(rd.runId).agent_name = "vanished";
  const log = d.rest.entries.get(rd.runId);
  for (const [seq, e] of [...log.entries()]) if (e.kind === "started") log.set(seq, { ...e, agent: "vanished" });
  seen.add((await d.runner.deliver(rd.runId)).why);

  // too-many-attempts
  const e2 = bench({ answers: [says("x")], maxAttempts: 1 });
  const re = await e2.accept("t1");
  e2.rest.work.get(re.runId).attempts = 5;
  seen.add((await e2.runner.deliver(re.runId)).why);

  // failed: the claim itself could not be made
  const f = bench();
  const rf = await f.accept("t1");
  f.work.claim = async () => { throw new Error("the database went"); };
  seen.add((await f.runner.deliver(rf.runId)).why);

  for (const why of seen) assert.ok(OUTCOMES.includes(why), `"${why}" is not a declared outcome`);
  assert.ok(seen.size >= 6, `only ${seen.size} distinct outcomes were reached`);
  assert.ok(seen.has("ran") && seen.has("not-claimable") && seen.has("unreadable")
    && seen.has("no-agent") && seen.has("too-many-attempts") && seen.has("failed"),
    `missing an outcome: ${[...seen].join(", ")}`);
});

test("A RUN NOBODY WILL DELIVER AGAIN IS TAKEN OFF THE QUEUE, and a retryable one is not", async () => {
  // A state machine needs a name for every outcome, and "keeps failing" is one of
  // them: without a ceiling, a run whose journal cannot be written spins for ever.
  const a = bench({ answers: [says("x")], maxAttempts: 2 });
  const r = await a.accept("t1");
  a.rest.work.get(r.runId).attempts = 9;
  const out = await a.runner.deliver(r.runId);
  assert.equal(out.why, "too-many-attempts");
  assert.notEqual(a.rest.work.get(r.runId).done_at, null, "a run past its ceiling stayed on the queue");
  assert.match(a.rest.work.get(r.runId).last_error, /attempts/);
  assert.deepEqual(await a.runner.reclaimable({ graceS: 0 }), [], "it is still being offered");
});

test("A CONSUMER NEVER THROWS, whatever the store does", async () => {
  // A consumer that throws is a delivery the platform retries blindly, which is
  // how one run becomes four.
  const b = bench({ answers: [says("x")] });
  const r = await b.accept("t1");
  b.store.forTenant = () => { throw new Error("the store fell over"); };
  const out = await b.runner.deliver(r.runId);
  assert.equal(out.ran, false);
  assert.equal(out.why, "failed");
});

test("THE SWEEPER SELECTS ON THE LEASE AND NEVER ON ELAPSED TIME", async () => {
  let open;
  const held = new Promise((res) => { open = res; });
  const b = bench({ answers: [async () => { await held; return says("slow but alive"); }] });
  const { runId } = await b.accept("t1");
  const running = b.runner.deliver(runId);
  await new Promise((r) => setTimeout(r, 0));

  // Hours in, still beating: not reclaimable.
  for (let i = 0; i < 100; i++) { b.advance(BEAT_EVERY_MS); await b.timer.fire(); }
  assert.deepEqual(await b.runner.reclaimable({ graceS: 0 }), [],
    "a run that has been going a long time was treated as dropped");

  open();
  await running;
  assert.deepEqual(await b.runner.reclaimable({ graceS: 0 }), [], "a finished run is still being offered");
});

test("makeRunner refuses to exist without what it needs", () => {
  const ok = {
    work: { claim: async () => ({}), beat: async () => true, release: async () => true, sweep: async () => [] },
    store: { forTenant: () => ({}) },
    send: async () => ({}),
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "i" }) },
  };
  assert.doesNotThrow(() => makeRunner(ok));
  for (const k of ["work", "store", "send"]) {
    assert.throws(() => makeRunner({ ...ok, [k]: undefined }), { name: "TypeError" }, `${k} was optional`);
  }
  assert.throws(() => makeRunner({ ...ok, agents: {} }), { name: "TypeError" });
  assert.equal(MAX_ATTEMPTS > 1, true, "one attempt means no retry at all");
});

import test from "node:test";
import assert from "node:assert/strict";
import { makeRunner, LEASE_TTL_S, BEAT_EVERY_MS, TOLERATED_MISSES, MAX_ATTEMPTS, OUTCOMES } from "../src/runner.mjs";
import { makeApi } from "../src/api.mjs";
import { makeVerifier, TENANT_CLAIM, HS } from "../src/auth.mjs";
import { defineAgent, defineTool, PUBLIC } from "../src/define.mjs";
import { startedEntry, limitsToJson } from "../src/journal.mjs";
import { makeRunStore } from "../src/store.mjs";
import { liveStore } from "./helpers/memory-rest.mjs";
import { AUTHORED, AUTHORED_AGENT } from "../src/agents.mjs";

const NOW = 1_800_000_000_000;

/**
 * A timer nothing fires but a test — AND ONE THAT REMEMBERS WHAT INTERVAL IT WAS
 * ASKED FOR.
 *
 * Recording the delay is not decoration: a fake that discards it cannot tell a
 * heartbeat asked to run every 30 seconds from one asked to run every 0 ms, which
 * against a real timer is a busy loop hammering the database. A sweep found exactly
 * that — the junk-beat mutant survived because nothing observed the number.
 */
function fakeTimer() {
  const pending = new Map();
  const asked = [];
  let id = 0;
  return {
    set: (fn, ms) => { const h = ++id; pending.set(h, fn); asked.push(ms); return h; },
    clear: (h) => { pending.delete(h); },
    async fire() { const fns = [...pending.values()]; pending.clear(); for (const f of fns) await f(); },
    get waiting() { return pending.size; },
    /** Every interval this timer was asked to wait, in order. */
    get asked() { return [...asked]; },
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
  const events = [];
  let clock = NOW;
  const timer = fakeTimer();
  const { rest, store, work, delegation } = liveStore({ now: () => clock });
  // ⚠ `AUTHORED` IS IN THE REGISTRY BECAUSE A DELEGATED CHILD IS ONE OF ITS RUNS. The child's
  // `started` entry names that agent — `agent.delegate_children` merges `agent.authored_run()`
  // into it — so a bench without it answers `no-agent` for every child and no case about a
  // child could reach the loop at all.
  const agents = { ...AUTHORED, support: defineAgent({ name: "support", model: "m", instructions: "help", tools, limits }) };

  const calls = [];
  const send = async (req) => {
    calls.push(req);
    const a = answers[calls.length - 1];
    if (a === undefined) throw new Error("the process stopped existing");
    return typeof a === "function" ? await a(req) : a;
  };

  let w = 0;
  const runner = makeRunner({
    work, store, send, agents, timer, maxAttempts, onError, delegation,
    onEvent: (e) => { events.push(e); },
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
    rest, store, work, runner, timer, queue, api, accept, resume, view, calls, delegation, events,
    at: (ms) => { clock = ms; },
    advance: (ms) => { clock += ms; },
    get clock() { return clock; },
    kinds: (runId) => [...rest.entries.get(runId).values()].map((e) => e.kind),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PERSISTED BEFORE ACCEPTED
// ════════════════════════════════════════════════════════════════════════════

test("⚠ A TOOL'S IDENTITY IS SEEDED WITH THE RUN'S OWN ID, so two runs never derive one", async () => {
  // **THE RUNNER IS THE ONLY PLACE THIS HOP EXISTS** — `run.mjs` takes `operationSeed`
  // from its caller, and the caller is here. A sweep mutant replacing it with a constant
  // survived every module case: from inside `run.mjs` a seed is a seed, and what makes it
  // an identity is that it is THIS run's. Two runs deriving one identity means one asking
  // the database for the other's work.
  const seen = [];
  const watch = defineTool({
    name: "act", description: "acts", input: { type: "object" }, scope: PUBLIC, repeatable: true,
    run: async (args, ctx) => { seen.push(ctx.operation); return { ok: true }; },
  });
  const b = bench({
    tools: [watch],
    // ⚠ REAL USAGE, and the first draft's `usage: null` is why this note exists: an
    // UNREPORTED usage against a finite bound is a stop with `reason: "unmeasured"`, which
    // is this engine's own rule — so run 1 ended after one step and the case reported the
    // identity as broken. `[1, 1]` from the send log is what said so.
    answers: [{ text: "", toolCalls: [{ id: "c0", name: "act", args: { id: "a" } }],
                usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1 },
              says("done"),
              { text: "", toolCalls: [{ id: "c0", name: "act", args: { id: "a" } }],
                usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1 },
              says("done")],
  });
  const one = await b.accept("t1");
  const d1 = await b.runner.deliver(one.runId);
  assert.equal(d1.ran, true, JSON.stringify(d1));
  const two = await b.accept("t1");
  const d2 = await b.runner.deliver(two.runId);
  assert.equal(d2.ran, true, JSON.stringify(d2));

  assert.equal(seen.length, 2, `the tool ran ${seen.length} times; sends: ${JSON.stringify(b.calls.map((c) => c.step))}`);
  // EACH IDENTITY BEGINS WITH ITS OWN RUN, read off the run the API really minted.
  assert.equal(seen[0].startsWith(`${one.runId}:`), true, `${seen[0]} is not seeded with ${one.runId}`);
  assert.equal(seen[1].startsWith(`${two.runId}:`), true, `${seen[1]} is not seeded with ${two.runId}`);
  // ⚠ AND THE TWO DIFFER — the same tool, the same position, the same arguments, so the
  // RUN is the only thing that can be telling them apart.
  assert.notEqual(one.runId, two.runId);
  assert.notEqual(seen[0], seen[1], "two runs derived one identity");
});

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
    // **THE HOLD IS FORWARDED, because a journal cannot be built without it.** A
    // wrapper that dropped it would make this test about a TypeError.
    return { ...scoped, open: async (id, o) => {
      const opened = await realOpen(id, o);
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
    return { ...s2, open: async (id, opts) => {
      const o = await s2.open(id, opts);
      // A journal outage, which is NOT a fenced refusal: no `code`, so the runner must
      // read it as a broken journal and leave the work retryable. That distinction is
      // the point of this half of the test.
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

test("A SHARED WORKER NAME NO LONGER BREAKS A HANDOVER — THE CLAIM TOKEN DOES THAT", async () => {
  // **THIS TEST RECORDS THE FIX RATHER THAN THE HAZARD, and the old version is worth
  // remembering.** It used to assert that with a SHARED name the displaced worker's
  // beat SUCCEEDS — "which is the whole problem" — because the beat was gated on
  // `claimed_by = <name>` alone. A reclaim by a worker of the same name left the old
  // one believing it still held the lease, and two workers ran one run.
  //
  // A token minted per CLAIM closes that by construction: the name says WHO and the
  // token says WHICH CLAIM, so the displaced worker is refused on the half that
  // cannot be shared.
  const b = bench({ answers: [says("x")] });
  const { runId } = await b.accept("t1");

  const shared = "same-name";
  const a1 = await b.work.claim({ runId, worker: shared, ttlS: 1 });
  assert.equal(a1.claimed, true, "A could not claim");
  assert.ok(a1.token, "the claim carried no token");
  b.advance(2000);                                        // A's lease lapses
  const a2 = await b.work.claim({ runId, worker: shared, ttlS: 90 });
  assert.equal(a2.claimed, true, "B could not take it over");
  assert.notEqual(a2.token, a1.token, "the reclaim reused the first claim's token");

  assert.equal(await b.work.beat({ runId, worker: shared, token: a1.token, ttlS: 90 }), false,
    "the DISPLACED worker kept its lease although its claim had been replaced");
  assert.equal(await b.work.beat({ runId, worker: shared, token: a2.token, ttlS: 90 }), true,
    "the current holder cannot beat");
  // And it cannot write, which is the half that matters: the beat only tells it to
  // stop, the fence stops it.
  assert.equal((await b.work.append({ runId, seq: 9, body: { kind: "model", at: 1, step: 9, ms: 1 },
    worker: shared, token: a1.token })).answer, "bad-token",
    "a displaced worker sharing the holder's name wrote to the log");

  // A DISTINCT NAME IS REFUSED ON THE OTHER HALF, so both walls are real.
  const c = bench({ answers: [says("x")] });
  const r2 = await c.accept("t1");
  const ca = await c.work.claim({ runId: r2.runId, worker: "A", ttlS: 1 });
  c.advance(2000);
  const cb = await c.work.claim({ runId: r2.runId, worker: "B", ttlS: 90 });
  assert.equal(cb.claimed, true);
  assert.equal(await c.work.beat({ runId: r2.runId, worker: "A", token: ca.token, ttlS: 90 }), false);
  assert.equal((await c.work.append({ runId: r2.runId, seq: 9, body: { kind: "model", at: 1, step: 9, ms: 1 },
    worker: "A", token: ca.token })).answer, "not-holder");

  // THE DEFAULT NAMER STILL PRODUCES A FRESH NAME PER DELIVERY, and that stays
  // deliberate: it is what keeps two concurrent deliveries in ONE isolate from
  // reading each other's claim as their own before any token is involved.
  const names = new Set();
  const spy = {
    claim: async ({ worker }) => { names.add(worker); return { claimed: false }; },
    beat: async () => true, release: async () => true, sweep: async () => [], append: async () => ({ answer: "stored", seq: 0 }),
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

test("A JUNK LEASE OR BEAT FALLS BACK TO THE MODULE'S OWN NUMBER, never to the junk", async () => {
  // **THE DEPLOYED WORKER PASSES NEITHER, so this guard is what makes the knobs safe
  // to have at all** — a local driver compresses the clock, and anything that is not
  // a usable number must read as "not asked for" rather than as a value. `0` is the
  // one that bites: `opts.leaseTtlS ?? LEASE_TTL_S` keeps it, and a zero-second lease
  // is refused by `claim_run`, so every delivery would fail.
  for (const bad of [0, -1, NaN, "90", null, undefined, {}, Infinity]) {
    const b = bench({ answers: [says("fine")] });
    const r = await b.accept("t1");
    const timer = fakeTimer();
    const runner = makeRunner({
      work: b.work, store: b.store, send: async () => says("fine"), timer,
      agents: { support: defineAgent({ name: "support", model: "m", instructions: "i" }) },
      leaseTtlS: bad, beatEveryMs: bad,
      nameWorker: () => "w1",
    });
    const out = await runner.deliver(r.runId);
    assert.equal(out.ran, true, `leaseTtlS ${JSON.stringify(bad)} broke the delivery: ${out.why}`);
    // The lease really was taken for the module's own length, not for the junk.
    assert.equal(b.rest.work.get(r.runId).done_at !== null, true);
    // **AND THE HEARTBEAT WAS SCHEDULED AT THE MODULE'S OWN INTERVAL.** A `0` here is
    // the one that bites: against a real timer it is a busy loop beating the database
    // as fast as it can answer.
    assert.deepEqual(timer.asked, [BEAT_EVERY_MS],
      `beatEveryMs ${JSON.stringify(bad)} was scheduled as ${JSON.stringify(timer.asked)}`);
  }
  // THE CONTROL: a usable number IS honoured, so the fallback is selective rather
  // than the knob being ignored altogether.
  const c = bench({ answers: [says("fine")] });
  const r2 = await c.accept("t1");
  const runner = makeRunner({
    work: c.work, store: c.store, send: async () => says("fine"), timer: fakeTimer(),
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "i" }) },
    leaseTtlS: 5, nameWorker: () => "w1",
  });
  // Claim it first with the injected length and read the lease the fake recorded.
  const probe = await c.work.claim({ runId: r2.runId, worker: "probe", ttlS: 5 });
  const lease = c.rest.work.get(r2.runId).lease_expires_at;
  assert.equal(lease - c.clock, 5_000, `a 5 s lease was recorded as ${lease - c.clock} ms`);
  await c.work.release({ runId: r2.runId, worker: "probe", token: probe.token, done: false });
  assert.equal((await runner.deliver(r2.runId)).ran, true);
  // A usable beat interval IS honoured, so the fallback above is selective.
  const t2 = fakeTimer();
  const tuned = makeRunner({
    work: c.work, store: c.store, send: async () => says("fine"), timer: t2,
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "i" }) },
    beatEveryMs: 1234, nameWorker: () => "w2",
  });
  const r3 = await c.accept("t1");
  await tuned.deliver(r3.runId);
  assert.deepEqual(t2.asked, [1234], `a 1234 ms beat was scheduled as ${JSON.stringify(t2.asked)}`);
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

// ════════════════════════════════════════════════════════════════════════════
// THE FENCE: ownership is asked of the DATABASE, not of a flag in this process
// ════════════════════════════════════════════════════════════════════════════

test("OWNERSHIP IS ASKED BEFORE EVERY MODEL CALL AND EVERY TOOL BATCH", async () => {
  // **WHAT THIS PINS IS THE ORDER, because the order is the whole value.** A check
  // after the call has already spent the money; a check after the tool batch has
  // already fired it at the outside world. So the sequence is asserted, not the count.
  const order = [];
  const tool = defineTool({
    name: "look", description: "looks", input: { type: "object" }, scope: PUBLIC, repeatable: true,
    run: async () => { order.push("tool"); return { hit: 1 }; },
  });
  const b = bench({ tools: [tool] });
  const r = await b.accept("t1");

  const answers = [wants("look"), says("done")];
  let n = 0;
  const watched = { ...b.work, beat: async (a) => { order.push("ask"); return b.work.beat(a); } };
  const runner = makeRunner({
    work: watched, store: b.store, timer: fakeTimer(), now: () => b.clock, nameWorker: () => "w1",
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "help", tools: [tool] }) },
    send: async (req) => { order.push(`model:${req.step}`); return answers[n++]; },
  });
  const out = await runner.deliver(r.runId);
  assert.equal(out.ran, true, `the run did not finish: ${out.why} ${out.error ?? ""}`);

  // step 1: ask → model → ask → tool ; step 2: ask → model (no tools, so no batch)
  assert.deepEqual(order, ["ask", "model:1", "ask", "tool", "ask", "model:2"],
    `the ownership checks are in the wrong places: ${order.join(" ")}`);

  // AND IT IS NOT ASKED PER JOURNAL WRITE, which would be a round trip per entry for
  // no extra safety — the write itself is fenced by the database.
  assert.equal(order.filter((x) => x === "ask").length, 3,
    "ownership is being asked more often than there is new work to start");
});

test("A CHECKPOINT THAT REFUSES STOPS THE RUN WITHOUT WRITING A STOP", async () => {
  // The run must be left exactly as the next holder needs to find it: no stop entry,
  // because a stop is what says the run is over.
  const b = bench({ answers: [says("never asked for")] });
  const r = await b.accept("t1");
  const before = b.kinds(r.runId).length;

  // The claim is taken away before the first model call, by somebody else.
  //
  // **THE MODEL CALLS ARE COUNTED, NOT MADE TO THROW, and a sweep is why.** A `send`
  // that throws proves nothing here: the throw becomes `call-failed`, whose stop write
  // is then refused, and the delivery answers `lease-lost` either way — so the test
  // passed whether or not the call had been made.
  //
  // **AND THE COUNT STILL DOES NOT KILL THE MUTANT IT WAS WRITTEN FOR — measured, and
  // said here rather than left as a wrong comment.** Neutering `mayStart`'s throw
  // SURVIVES, because `assertHeld()` in the `send` wrapper refuses before the counter
  // can move. That is a redundancy declared in `runner.mjs`, not a gap; the mutant that
  // dies is the one removing the ownership check altogether. The count stays because it
  // asserts the property this test is named for, which the throw never did.
  let calls = 0;
  const stolen = { ...b.work, beat: async () => false };
  const runner = makeRunner({
    work: stolen, store: b.store, timer: fakeTimer(), now: () => b.clock, nameWorker: () => "w1",
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "help" }) },
    send: async () => { calls++; return says("a call that should never have been made"); },
  });
  const out = await runner.deliver(r.runId);
  assert.equal(calls, 0, `${calls} model call(s) were bought after the claim was gone`);
  assert.equal(out.why, "lease-lost", `reported as "${out.why}"`);
  assert.equal(b.kinds(r.runId).length, before, "something was written after the claim was gone");
  assert.equal(b.kinds(r.runId).includes("stopped"), false, "a stop was recorded by a process that had lost the run");
  // The work is NOT taken off the queue: somebody else is doing it, or it needs
  // redelivering.
  assert.equal(b.rest.work.get(r.runId).done_at, null, "a run that was taken over was marked done");
});

test("A RECLAIM MID-RUN STOPS THE OLD CONSUMER AT ITS NEXT WRITE — the live shape", async () => {
  // **THIS IS THE GAP THAT WAS MEASURED ON THE DEPLOYMENT, driven end to end.** The
  // beat has NOT fired (the timer is never advanced), so the process's own flag still
  // says it holds the run — exactly the state a consumer is in for up to
  // `BEAT_EVERY_MS` after being reclaimed. Before the fence it wrote its next entries
  // regardless. Now the database refuses the write itself.
  let reclaimed = null;
  const b = bench({
    answers: [async () => {
      // The reclaim happens DURING the model call, which is when a real one does: the
      // old consumer is busy and cannot notice.
      b.rest.work.get(id).lease_expires_at = b.clock - 1;
      reclaimed = await b.work.claim({ runId: id, worker: "replacement", ttlS: 90 });
      return says("an answer nobody may record");
    }],
  });
  const { runId: id } = await b.accept("t1");
  const before = b.kinds(id).length;

  const out = await b.runner.deliver(id);
  assert.equal(reclaimed?.claimed, true, "the replacement never got the run, so this proves nothing");

  // **NOTHING WAS WRITTEN.** The model answer it paid for is thrown away rather than
  // recorded over the new holder's run — which is the trade this change makes on
  // purpose: exclusivity over completion.
  assert.equal(b.kinds(id).length, before, `${b.kinds(id).length - before} entries were written after the reclaim`);
  assert.equal(b.kinds(id).includes("stopped"), false, "a stop was written by the displaced consumer");

  // And it is reported as a lost claim, WITH THE REASON NAMED — `not-holder`, because
  // the replacement took it under a different name.
  assert.equal(out.why, "lease-lost", `reported as "${out.why}"`);
  assert.equal(out.error, "not-holder", `the reason was "${out.error}" rather than the fence's own`);
  assert.equal(out.ran, false);

  // THE ROW IS THE REPLACEMENT'S, and the displaced consumer released nothing.
  assert.equal(b.rest.work.get(id).claimed_by, "replacement");
  assert.equal(b.rest.work.get(id).done_at, null);

  // THE CONTROL: the replacement can finish it, so the run was not broken — only taken.
  const done = await b.runner.deliver(id);
  assert.equal(done.why, "not-claimable", "the replacement's own lease was not respected");
});

test("A CONFLICTING ENTRY IS ITS OWN OUTCOME, and leaves the work redeliverable", async () => {
  // A different entry arrived in a slot this run's snapshot thought was free. The claim
  // may still be ours, so this is NOT a lost lease: it is a log we are behind on, and
  // the answer is a fresh delivery that reads what is really there.
  const b = bench({ answers: [says("mine")] });
  const { runId } = await b.accept("t1");
  const conflicting = { ...b.work, append: async () => ({ answer: "conflict", seq: 1 }) };
  const store = makeRunStore({
    fetch: b.rest.fetch, url: "https://p.supabase.co/", key: "svc", appendEntry: conflicting.append,
  });
  const runner = makeRunner({
    work: conflicting, store, send: async () => says("mine"), timer: fakeTimer(),
    now: () => b.clock, nameWorker: () => "w1",
    agents: { support: defineAgent({ name: "support", model: "m", instructions: "help" }) },
  });
  const out = await runner.deliver(runId);
  assert.equal(out.why, "conflict", `reported as "${out.why}"`);
  assert.ok(OUTCOMES.includes("conflict"), "conflict is not a declared outcome");
  // NOT done: another delivery must read the log again rather than the run being
  // abandoned.
  assert.equal(b.rest.work.get(runId).done_at, null, "a conflict took the run off the queue");
  assert.match(b.rest.work.get(runId).last_error, /another writer/);
});

// ════════════════════════════════════════════════════════════════════════════
// A FINISHED CHILD HANDS ITS OUTCOME OVER WHILE IT STILL HOLDS ITS CLAIM
// ════════════════════════════════════════════════════════════════════════════

test("⚠ A CHILD SETTLES ITS DELEGATION BEFORE IT RELEASES, or the parent waits out the deadline", async () => {
  // **THE ORDERING IS THE WHOLE PROPERTY AND IT IS OBSERVABLE HERE RATHER THAN NARRATED.**
  // `agent.settle_delegation` is fenced by the CHILD's own claim — the holder, the token and
  // a live lease, the same three checks every journal write presents — so a settle attempted
  // after `finish` has released comes back `not-holder` and NOTHING is recorded. So
  // `ok: true` on the settle IS the evidence that it happened above the release; a recorder
  // seam could only ever have said that `settle` was called.
  //
  // ⚠ **AND THE FIXTURE IS THE REAL DELEGATION STORE OVER THE PROVEN FAKE**, not a stand-in
  // that agrees: the fake implements that fence, so a runner that settled afterwards would
  // fail this case for the reason the deployment would.
  const b = bench({ answers: [says("the tide table")] });
  const parent = await b.accept("t1");
  const specialist = crypto.randomUUID();
  b.rest.agents.set(specialist, {
    id: specialist, tenant_id: "t1", status: "active",
    name: "charts", instructions: "read the charts",
  });

  const child = crypto.randomUUID();
  const filed = await b.delegation.delegate({
    tenant: "t1", parent: parent.runId, step: "s1",
    children: [{ id: crypto.randomUUID(), run_id: child, agent_id: specialist, task: "the tide table", tools: [] }],
  });
  assert.equal(filed.ok, true, `the children were not filed: ${filed.error}`);
  // ⚠ THE PARENT IS PUT INTO THE STATE THE RUNNER'S OWN RELEASE LEAVES, THROUGH
  // `claim_run` AND `release_run` RATHER THAN INTO THE MAPS. It is `awaiting-children`, so
  // `finish(true, …)` has marked the row done and let the claim go — and that is what makes
  // the requeue below observable: a parent nobody released is already on the queue, so
  // `done_at === null` afterwards would be true whatever the settle did.
  const heldParent = await b.work.claim({ runId: parent.runId, worker: "w-parent", ttlS: LEASE_TTL_S });
  assert.equal(heldParent.claimed, true, "the parent could not be claimed");
  assert.equal(
    await b.work.release({ runId: parent.runId, worker: "w-parent", token: heldParent.token, done: true }),
    true, "the parent was not released",
  );
  assert.ok(b.rest.work.get(parent.runId).done_at, "the parent is still on the queue before the settle");

  const out = await b.runner.deliver(child);
  assert.equal(out.why, "ran", `the child did not run: ${out.why} ${out.error ?? ""}`);

  // ── the settle really landed, which only a live claim can do ──────────────
  const said = b.events.filter((e) => e.at === "settled");
  assert.equal(said.length, 1, `${said.length} settle events`);
  assert.equal(said[0].settled, true, `the settle was refused: ${said[0].why}`);
  assert.equal(said[0].runId, child);
  assert.equal(said[0].ok, true, "a delivered answer was recorded as a failure");
  assert.equal(said[0].repeat, false, "a first settle read as a repeat");

  // ── and the outcome is on the row, read back through the real store ───────
  const rows = await b.delegation.progress({ tenant: "t1", parent: parent.runId });
  assert.equal(rows.length, 1, `${rows.length} children`);
  assert.ok(rows[0].settled_at, "the delegation was never settled");
  assert.deepEqual(rows[0].outcome, { ok: true, reason: "answered", result: "the tide table" });

  // ── nothing of that step is outstanding, so the parent is back on the queue ──
  assert.equal(said[0].outstanding, 0, `${said[0].outstanding} still outstanding`);
  assert.equal(said[0].parentQueued, "queued", `the parent was not put back: ${said[0].parentQueued}`);
  assert.equal(b.rest.work.get(parent.runId).done_at, null, "the parent is still off the queue");

  // ── and the child's own claim is released, AFTER the settle ───────────────
  assert.ok(b.rest.work.get(child).done_at, "the child kept its work row");
  assert.equal(b.rest.work.get(child).claim_token, null, "the child kept its claim");
});

test("A RUN THAT IS NOBODY'S CHILD ASKS NOTHING AT ALL — the control", async () => {
  // **WITHOUT THIS THE CASE ABOVE IS SATISFIED BY A RUNNER THAT SETTLES EVERY RUN IT
  // FINISHES**, which would be a round trip per delivery for every run on the platform and
  // an answer about a delegation that does not exist. `delegatedBy` is read out of the
  // APPEND-ONLY LOG, so a run accepted through the API has none and the question is never
  // put.
  const b = bench({ answers: [says("on my own")] });
  const { runId } = await b.accept("t1");
  const before = b.rest.fetch.calls.length;
  const out = await b.runner.deliver(runId);
  assert.equal(out.why, "ran");
  assert.equal(b.events.filter((e) => e.at === "settled").length, 0, "a settle was reported");
  const asked = b.rest.fetch.calls.slice(before).filter((c) => String(c.url).includes("settle_delegation"));
  assert.equal(asked.length, 0, `${asked.length} settle requests went out`);
});

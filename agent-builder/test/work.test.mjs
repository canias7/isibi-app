import test from "node:test";
import assert from "node:assert/strict";
import { makeWork, WORK_STATES } from "../src/work.mjs";
import { liveStore } from "./helpers/memory-rest.mjs";

/** A transport that answers exactly what a test says, so every branch is drivable. */
function answering(reply) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers, body: init?.body ? JSON.parse(init.body) : undefined });
    const r = typeof reply === "function" ? reply(calls.length, calls[calls.length - 1]) : reply;
    return {
      ok: (r.status ?? 200) < 300, status: r.status ?? 200,
      text: async () => (r.body === undefined ? "" : JSON.stringify(r.body)),
    };
  };
  const work = makeWork({ fetch: fetchImpl, url: "https://p.supabase.co/", key: "svc", schema: "agent" });
  return { work, calls };
}

const startedEntry = { kind: "started", at: 0, tenant: "t1", agent: "a", model: "m", prompt: "go", limits: {} };

test("makeWork refuses to exist without what it needs", () => {
  for (const bad of [{}, { fetch: 1 }, { fetch: async () => {} }, { fetch: async () => {}, url: "u" }]) {
    assert.throws(() => makeWork(bad), { name: "TypeError" });
  }
  assert.doesNotThrow(() => makeWork({ fetch: async () => {}, url: "u", key: "k" }));
});

test("AN UNRECOGNISED STATE IS RAISED, never treated as one we know", async () => {
  // A state nothing recognises is a bug somewhere, and reading it as `queued` would
  // hand a caller a 202 for work that may never run.
  for (const state of ["weird", "", null, undefined, 4, "QUEUED"]) {
    const { work } = answering({ body: { state, attempts: 0 } });
    await assert.rejects(
      () => work.accept({ runId: "r1", tenant: "t1", entry: startedEntry }),
      /unrecognised state/,
      `state ${JSON.stringify(state)} was accepted`,
    );
  }
  // THE CONTROL: every declared state IS accepted, so the check is about the value
  // and not about the call failing for some other reason.
  for (const state of WORK_STATES) {
    const { work } = answering({ body: { state, attempts: 1 } });
    assert.equal((await work.accept({ runId: "r1", tenant: "t1", entry: startedEntry })).state, state);
    assert.equal((await work.requeue({ runId: "r1", tenant: "t1" })).state, state);
  }
});

test("A CLAIM THAT CARRIES NO TENANT IS REFUSED — the consumer must never act as nobody", async () => {
  // The claim is where a consumer learns whose run it is. A claim answering `true`
  // with no tenant would make it act as whatever the next line happened to read.
  for (const tenant of [undefined, null, "", "   ", 4, ["t1"], {}]) {
    const { work } = answering({ body: { claimed: true, run_id: "r1", tenant_id: tenant, kind: "start", attempts: 1 } });
    await assert.rejects(
      () => work.claim({ runId: "r1", worker: "w1", ttlS: 90 }),
      /carries no tenant/,
      `a claim with tenant ${JSON.stringify(tenant)} was accepted`,
    );
  }
  // THE CONTROL.
  const { work } = answering({ body: { claimed: true, run_id: "r1", tenant_id: "t1", kind: "start", attempts: 2 } });
  const c = await work.claim({ runId: "r1", worker: "w1", ttlS: 90 });
  assert.equal(c.claimed, true);
  assert.equal(c.tenant, "t1");
  assert.equal(c.attempts, 2);
});

test("A REFUSED CLAIM IS NOT A FAILURE, and carries nothing else", async () => {
  const { work } = answering({ body: { claimed: false } });
  assert.deepEqual(await work.claim({ runId: "r1", worker: "w1", ttlS: 90 }), { claimed: false });
  // Anything but an explicit `true` is not a claim. `Boolean("false")` is `true`, so
  // this is compared rather than coerced.
  for (const claimed of ["true", 1, {}, null, undefined]) {
    const a = answering({ body: { claimed, tenant_id: "t1" } });
    assert.deepEqual(await a.work.claim({ runId: "r1", worker: "w1", ttlS: 90 }), { claimed: false },
      `claimed: ${JSON.stringify(claimed)} was read as a claim`);
  }
});

test("A FALSY BEAT IS NOT A HELD LEASE", async () => {
  // `beat` answering anything but `true` means the lease is gone, and a worker that
  // reads it otherwise keeps running a run somebody else may now hold.
  for (const answer of [false, null, "true", 0, undefined, {}]) {
    const { work } = answering({ body: answer });
    assert.equal(await work.beat({ runId: "r1", worker: "w1", ttlS: 90 }), false,
      `beat answered ${JSON.stringify(answer)} and was read as holding`);
  }
  const { work } = answering({ body: true });
  assert.equal(await work.beat({ runId: "r1", worker: "w1", ttlS: 90 }), true);
});

test("A FAILED CALL THROWS AND NAMES ITSELF", async () => {
  const { work } = answering({ status: 500, body: { message: "the database went away" } });
  await assert.rejects(() => work.claim({ runId: "r1", worker: "w1", ttlS: 90 }), (e) => {
    assert.match(e.message, /claim_run/, "the failure does not say which call it was");
    assert.match(e.message, /500/);
    assert.match(e.message, /the database went away/, "the server's own words were dropped");
    return true;
  });
});

test("ANOTHER TENANT'S RUN ID IS A NOT-FOUND, never a forbidden", async () => {
  // "Forbidden" tells a stranger the id they guessed is real.
  const { work } = answering({ status: 403, body: { code: "42501", message: "accept_run: run x is not this tenant's" } });
  await assert.rejects(
    () => work.accept({ runId: "r1", tenant: "t2", entry: startedEntry }),
    (e) => e.code === "not-found",
    "a stranger's run id was answered as forbidden",
  );
});

test("THE SCHEMA IS NAMED ON EVERY CALL, or the queue's functions are looked for in `public`", async () => {
  const { work, calls } = answering({ body: { state: "queued" } });
  await work.accept({ runId: "r1", tenant: "t1", entry: startedEntry });
  assert.equal(calls[0].headers["content-profile"], "agent", "the schema was not named");
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/accept_run$/);
  // The credential goes in both places PostgREST reads it, and nowhere else.
  assert.equal(calls[0].headers.apikey, "svc");
  assert.equal(calls[0].headers.authorization, "Bearer svc");

  // And the FIXTURE refuses a call that does not name it, the way PostgREST would.
  const rest = liveStore();
  const unprofiled = makeWork({
    fetch: async (u, init) => rest.rest.fetch(u, { ...init, headers: { ...init.headers, "content-profile": undefined } }),
    url: "https://p.supabase.co/", key: "svc",
  });
  await assert.rejects(() => unprofiled.accept({ runId: "r1", tenant: "t1", entry: startedEntry }), /PGRST202|Could not find/);
});

test("the sweep reads every row into this module's own shape", async () => {
  const { work } = answering({
    body: [
      { run_id: "r1", tenant_id: "t1", kind: "start", attempts: 2, last_error: "nope" },
      { run_id: "r2", tenant_id: "t2", kind: "resume" },
    ],
  });
  assert.deepEqual(await work.sweep({ graceS: 0, limit: 10 }), [
    { runId: "r1", tenant: "t1", kind: "start", attempts: 2, lastError: "nope" },
    { runId: "r2", tenant: "t2", kind: "resume", attempts: 0, lastError: null },
  ]);
  // An answer that is not a list is an empty one rather than a crash.
  for (const body of [null, {}, "rows", 4]) {
    const a = answering({ body });
    assert.deepEqual(await a.work.sweep(), []);
  }
});

test("the arguments go out under the names the functions declare", async () => {
  // A parameter name is the whole of a PostgREST RPC call. Renaming one silently
  // makes the function take its default instead, which for `p_done` would mean every
  // release marking the work finished.
  const { work, calls } = answering((n) => (n === 4 ? { body: true } : { body: { state: "queued", claimed: true, tenant_id: "t1" } }));
  await work.accept({ runId: "r1", tenant: "t1", entry: startedEntry, kind: "resume" });
  assert.deepEqual(calls[0].body, { p_run_id: "r1", p_tenant: "t1", p_entry: startedEntry, p_kind: "resume" });
  await work.requeue({ runId: "r1", tenant: "t1" });
  assert.deepEqual(calls[1].body, { p_run_id: "r1", p_tenant: "t1" });
  await work.claim({ runId: "r1", worker: "w1", ttlS: 90 });
  assert.deepEqual(calls[2].body, { p_run_id: "r1", p_worker: "w1", p_ttl_s: 90 });
  await work.beat({ runId: "r1", worker: "w1", ttlS: 90 });
  assert.deepEqual(calls[3].body, { p_run_id: "r1", p_worker: "w1", p_ttl_s: 90 });
  await work.release({ runId: "r1", worker: "w1", done: false, error: "e" });
  assert.deepEqual(calls[4].body, { p_run_id: "r1", p_worker: "w1", p_done: false, p_error: "e" });
  await work.sweep({ graceS: 5, limit: 7 });
  assert.deepEqual(calls[5].body, { p_grace_s: 5, p_limit: 7 });
});

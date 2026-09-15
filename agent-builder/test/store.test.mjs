import test from "node:test";
import assert from "node:assert/strict";
import { makeRunStore, POSITION_RETRIES, CLAIM_GONE, DUPLICATE } from "../src/store.mjs";
import { makeWork, LOST_CLAIM, APPEND_ANSWERS } from "../src/work.mjs";
import { CLAIM_GONE as RUNNER_CLAIM_GONE } from "../src/runner.mjs";
import { defineAgent, defineTool, PUBLIC } from "../src/define.mjs";
import { runAgent } from "../src/run.mjs";
import { replay, startedEntry, limitsToJson } from "../src/journal.mjs";
import { memoryRest, liveStore, holdRun } from "./helpers/memory-rest.mjs";

// A scripted send that THROWS when it runs out — the honest stand-in for a
// process that stops existing.
function scripted(answers) {
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
const says = (text) => ({ text, toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 1 });
const wants = (...names) => ({ text: "", usage: { inputTokens: 2, outputTokens: 2 }, costMicros: 4,
  toolCalls: names.map((n, i) => ({ id: `c${i}`, name: n, args: { i } })) });

const repeatableTool = (name, run) => defineTool({
  name, description: `does ${name}`, input: { type: "object" }, scope: PUBLIC, repeatable: true, run,
});
const agentOf = (tools = [], limits = {}) => defineAgent({
  name: "support", model: "claude-sonnet-5", instructions: "help", tools, limits,
});

// ── the fence's vocabulary ───────────────────────────────────────────────────
test("THE THREE MODULES AGREE ON WHICH REFUSALS MEAN THE CLAIM IS GONE", () => {
  // The same fact stated in three files with no type system between them, which is
  // the shape that drifts. Compared as SETS in both directions and by LENGTH, so
  // neither a name added to one nor a name dropped from another can hide.
  assert.deepEqual([...CLAIM_GONE].sort(), [...LOST_CLAIM].sort(), "store.mjs and work.mjs disagree");
  assert.deepEqual([...CLAIM_GONE].sort(), [...RUNNER_CLAIM_GONE].sort(), "store.mjs and runner.mjs disagree");
  assert.equal(CLAIM_GONE.length, 5);
  // And every one of them is an answer the fence can actually give — a list naming a
  // refusal the database never produces is a wall in front of nothing.
  for (const why of CLAIM_GONE) assert.ok(APPEND_ANSWERS.includes(why), `${why} is not an append answer`);
  // The two SUCCESSES and the two that are neither must not be on it.
  for (const why of ["stored", "already", "position", "conflict"]) {
    assert.equal(CLAIM_GONE.includes(why), false, `${why} reads as a lost claim`);
  }
});

/**
 * A store whose FENCE answers a script, so every answer in the vocabulary is
 * drivable — including the ones a correct database would never give twice running.
 *
 * The run and its rows come from the real fake; only the appender is scripted, which
 * is the seam the Worker itself wires.
 */
async function scriptedFence(answers) {
  const rest = memoryRest();
  const wire = { fetch: rest.fetch, url: "https://p.supabase.co", key: "k" };
  const work = makeWork(wire);
  const asked = [];
  const store = makeRunStore({
    ...wire,
    appendEntry: async (a) => {
      asked.push(a);
      const next = answers[asked.length - 1];
      if (next === undefined) throw new Error(`the script ran out after ${asked.length} append(s)`);
      return next;
    },
  });
  // The run has to exist for `open` to authorise, and it is created through the real
  // door so the ownership half of this fixture is not pretend.
  await store.forTenant("t1").create("r1");
  return { rest, store, work, asked, t: store.forTenant("t1") };
}
const HOLD = { worker: "w1", token: "tok-1" };

/**
 * A store over a bare fake with the REAL fence wired, which is the shape
 * `worker.mjs` builds. For the few tests that need to reach into the log directly.
 */
function storeOver(rest) {
  const wire = { fetch: rest.fetch, url: "https://p.supabase.co", key: "k" };
  return makeRunStore({ ...wire, appendEntry: makeWork(wire).append });
}

test("EVERY ANSWER THE FENCE CAN GIVE IS READ, and the two successes are told apart", async () => {
  const model = { kind: "model", at: 1, step: 1, ms: 5, usage: null };

  // `stored` — the ordinary case. The seq is the one THIS journal proposed, because
  // a successful insert went in at exactly that position; the echo carries nothing
  // new. (`already` below is the case where it does.)
  {
    const { t, asked } = await scriptedFence([{ answer: "stored", seq: 0 }]);
    const { journal } = await t.open("r1", { hold: HOLD });
    const r = await journal.append(model);
    assert.deepEqual(r, { seq: 0, stored: true });
    assert.equal(journal.seq, 1, "the counter did not move past what was written");
    // The hold went out with the write, which is the whole of the fence from here.
    assert.equal(asked[0].worker, "w1");
    assert.equal(asked[0].token, "tok-1");
    assert.deepEqual(asked[0].body, model);
  }

  // `already` — a retry, and A SUCCESS. The seq is the DATABASE'S: the entry can be
  // sitting where a previous attempt put it, and the counter has to clear it.
  {
    const { t } = await scriptedFence([{ answer: "already", seq: 11 }]);
    const { journal } = await t.open("r1", { hold: HOLD });
    const r = await journal.append(model);
    assert.deepEqual(r, { seq: 11, stored: false, already: true });
    assert.equal(journal.seq, 12, `the counter is at ${journal.seq} and would walk into seq 11`);
  }

  // `position` — that slot holds something else, so move up and try again. ONCE.
  {
    const { t, asked } = await scriptedFence([{ answer: "position", seq: 0 }, { answer: "stored", seq: 1 }]);
    const { journal } = await t.open("r1", { hold: HOLD });
    assert.deepEqual(await journal.append(model), { seq: 1, stored: true });
    assert.deepEqual(asked.map((a) => a.seq), [0, 1], "it did not move up by exactly one");
  }

  // ...and TWICE RUNNING throws rather than looping for ever.
  {
    const { t, asked } = await scriptedFence([{ answer: "position", seq: 0 }, { answer: "position", seq: 1 }]);
    const { journal } = await t.open("r1", { hold: HOLD });
    await assert.rejects(() => journal.append(model), (e) => {
      assert.equal(e.code, "fenced");
      assert.equal(e.why, "position-twice");
      return true;
    });
    assert.equal(asked.length, POSITION_RETRIES + 1, `it tried ${asked.length} times`);
  }

  // `conflict` — a DIFFERENT entry in this entry's own logical slot. Never absorbed:
  // reading it as `already` is how a double execution disappears from the record.
  {
    const { t } = await scriptedFence([{ answer: "conflict", seq: 2 }]);
    const { journal } = await t.open("r1", { hold: HOLD });
    await assert.rejects(() => journal.append(model), (e) => {
      assert.equal(e.code, "conflict", "a conflict was read as something else");
      assert.equal(e.why, "conflict");
      assert.equal(e.seq, 2, "the conflicting position was not carried");
      return true;
    });
  }

  // The five that mean the claim is gone, each RAISED under its own reason and all
  // under one code, because the caller does the same thing about every one of them.
  for (const why of CLAIM_GONE) {
    const { t } = await scriptedFence([{ answer: why, seq: null }]);
    const { journal } = await t.open("r1", { hold: HOLD });
    await assert.rejects(() => journal.append(model), (e) => {
      assert.equal(e.code, "fenced", `${why} was not reported as a fenced refusal`);
      assert.equal(e.why, why, `${why} lost its reason`);
      return true;
    }, `the store carried on after ${why}`);
  }

  // AND AN ANSWER NOBODY RECOGNISES IS RAISED, never read as one we do. The
  // vocabulary is closed on purpose: a new answer must be handled, not absorbed.
  {
    const { t } = await scriptedFence([{ answer: "something-new", seq: null }]);
    const { journal } = await t.open("r1", { hold: HOLD });
    await assert.rejects(() => journal.append(model), (e) => e.code === "fenced");
  }
});

test("A JOURNAL CANNOT BE BUILT WITHOUT A CLAIM TO WRITE UNDER", async () => {
  // The structural half of the fence: there is no journal object whose writes carry
  // no claim, so no code path can produce one by forgetting an argument.
  const { t } = await scriptedFence([]);
  await assert.rejects(() => t.open("r1"), { name: "TypeError" }, "open handed out a journal with no hold");
  for (const bad of [{}, { worker: "w1" }, { token: "tok" }, { worker: "", token: "tok" },
                     { worker: "w1", token: "" }, { worker: 4, token: "tok" }, { worker: "w1", token: ["tok"] }]) {
    await assert.rejects(() => t.open("r1", { hold: bad }), { name: "TypeError" },
      `open accepted the hold ${JSON.stringify(bad)}`);
  }
  // THE CONTROL: a whole hold works, so the refusals are about the hold and not about
  // the run being unreadable.
  assert.ok((await t.open("r1", { hold: HOLD })).journal);
});

// ── the doors ────────────────────────────────────────────────────────────────
const ok200 = async () => ({ ok: true, status: 200, text: async () => "[]" });
const noop = async () => ({ answer: "stored", seq: 0 });

test("makeRunStore and forTenant refuse what they cannot use", () => {
  const f = ok200;
  for (const o of [{}, { fetch: f }, { fetch: f, url: "u" }, { fetch: "f", url: "u", key: "k" },
                   { fetch: f, url: "", key: "k" }, { fetch: f, url: "u", key: "" },
                   // **AND A STORE WITH NO FENCED WRITER IS REFUSED, not built.** One
                   // that authorised, read and replayed a run and then could not record
                   // a thing about it would fail several steps later, wearing a journal
                   // error's clothes rather than naming the wiring.
                   { fetch: f, url: "u", key: "k" },
                   { fetch: f, url: "u", key: "k", appendEntry: null },
                   { fetch: f, url: "u", key: "k", appendEntry: "work.append" }]) {
    assert.throws(() => makeRunStore(o), { name: "TypeError" }, `makeRunStore accepted ${JSON.stringify(Object.keys(o))}`);
  }
  const store = makeRunStore({ fetch: f, url: "u", key: "k", appendEntry: noop });
  for (const bad of [undefined, null, "", "   ", 4, ["t1"], {}]) {
    assert.throws(() => store.forTenant(bad), { name: "TypeError" }, `forTenant accepted ${JSON.stringify(bad) ?? String(bad)}`);
  }
});

test("THERE IS NO UNSCOPED DOOR, AND NO CALL TAKES A TENANT", () => {
  // The structural half of "never accept the request body's tenant id as
  // authority": there is nowhere to put one. A census over the real surface
  // rather than a promise in a comment.
  const store = makeRunStore({ fetch: ok200, url: "u", key: "k", appendEntry: noop });
  assert.deepEqual(Object.keys(store), ["forTenant"], "the store grew a door that is not tenant-scoped");
  const scoped = store.forTenant("t1");
  assert.deepEqual(Object.keys(scoped).sort(), ["create", "load", "open", "resumable", "tenant"].sort());
  // Every operation takes at most a run id and options — never a tenant.
  assert.equal(scoped.create.length, 1, "create takes more than a run id");
  assert.equal(scoped.load.length, 1);
  assert.equal(scoped.resumable.length, 0, "resumable takes a positional argument");
  assert.equal(scoped.tenant, "t1");
});

test("AND `open`'s OPTIONS CANNOT CARRY A TENANT EITHER", async () => {
  // `open` grew a second argument for the claim, and a count of parameters cannot see
  // what is inside it — nor can it see one at all, since a defaulted parameter is not
  // counted by `Function.length`. So this is asserted BEHAVIOURALLY: an options object
  // carrying every spelling of a tenant reads the SCOPE's run and never that tenant's.
  const { rest, store } = liveStore();
  await store.forTenant("t1").create("mine");
  await store.forTenant("t2").create("theirs");
  const t1 = store.forTenant("t1");
  for (const key of ["tenant", "tenant_id", "tenantId"]) {
    const o = await t1.open("mine", { hold: HOLD, [key]: "t2" });
    assert.equal(o.tenant, "t1", `open read its tenant from options.${key}`);
    await assert.rejects(() => t1.open("theirs", { hold: HOLD, [key]: "t2" }), (e) => e.code === "not-found",
      `options.${key} reached another tenant's run`);
  }
  assert.ok(rest.runs.has("theirs"), "the fixture never created the other tenant's run");
});

// ── create ───────────────────────────────────────────────────────────────────
test("create writes ONLY id and tenant, and takes the tenant from the scope", async () => {
  const { rest, store } = liveStore();
  await store.forTenant("t1").create("r1");
  const post = rest.fetch.calls.find((c) => c.method === "POST");
  assert.deepEqual(post.body, { id: "r1", tenant_id: "t1" });
  assert.deepEqual(Object.keys(post.body), ["id", "tenant_id"]);
  assert.equal(post.headers["content-profile"], "agent", "the non-public schema was not named");
  assert.equal(rest.runs.get("r1").tenant_id, "t1");
  // A status written here would be a second copy of a fact the log already states.
  assert.equal(rest.runs.get("r1").status, "new");
});

test("a REPEATED create is absorbed, and create HANDS BACK NO WAY TO WRITE", async () => {
  const { store } = liveStore();
  const t = store.forTenant("t1");
  const first = await t.create("r1");
  const again = await t.create("r1");
  assert.equal(again.runId, "r1");
  // **CREATING A RUN DOES NOT GIVE ANYBODY A CLAIM ON IT**, so it cannot give anybody
  // a journal either: writing the log needs a live claim on the work row, and every
  // append from here would answer `no-work`. A journal that always refuses is worse
  // than no journal, because it looks like one.
  for (const r of [first, again]) {
    assert.equal(r.journal, undefined, "create handed out a journal that could never write");
    assert.deepEqual(Object.keys(r).sort(), ["runId", "tenant"]);
  }
});

test("A REPEATED create CANNOT HAND OVER ANOTHER TENANT'S RUN", async () => {
  // The primary key is on the id ALONE, so a duplicate could be somebody else's
  // run with the same id — and answering as though it were this one's would be the
  // leak.
  const { store } = liveStore();
  await store.forTenant("t1").create("shared-id");
  await assert.rejects(() => store.forTenant("t2").create("shared-id"), (e) => {
    assert.equal(e.code, "not-found");
    return true;
  });
});

test("create refuses an unusable run id, and a real failure throws with its status", async () => {
  const { store } = liveStore();
  for (const bad of [undefined, null, "", "  ", 4, ["r1"]]) {
    await assert.rejects(() => store.forTenant("t1").create(bad), { name: "TypeError" });
  }
  const broken = makeRunStore({
    fetch: async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ message: "permission denied for table runs" }) }),
    url: "u", key: "k", appendEntry: noop,
  });
  await assert.rejects(() => broken.forTenant("t1").create("r1"), (e) => {
    assert.equal(e.status, 403);
    assert.match(e.message, /permission denied/);
    return true;
  });
});

// ── the ownership boundary ───────────────────────────────────────────────────
test("A TENANT CANNOT OPEN OR LOAD ANOTHER TENANT'S RUN", async () => {
  const live = liveStore();
  const { store } = live;
  const hold = await holdRun(live, { runId: "r1", tenant: "t1" });

  for (const op of ["open", "load"]) {
    await assert.rejects(() => store.forTenant("t2")[op]("r1", { hold }), (e) => {
      assert.equal(e.code, "not-found", `${op} answered ${e.code}`);
      return true;
    }, `${op} let another tenant in`);
  }
  // THE CONTROL: the owner can, so the refusal is about the tenant and not about
  // the run being unreadable. **AND THE HOLD IS NOT WHAT LETS THEM IN** — the
  // stranger above presented the very same one, so the refusal is the ownership
  // check's and not the claim's.
  assert.equal((await store.forTenant("t1").open("r1", { hold })).state.status, "running");
});

test("ANOTHER TENANT'S RUN IS 'NOT FOUND', NEVER 'FORBIDDEN'", async () => {
  // The difference between them is information: "forbidden" tells a stranger the
  // id they guessed is real.
  const { store } = liveStore();
  await store.forTenant("t1").create("r1");
  const other = await store.forTenant("t2").open("r1", { hold: HOLD }).catch((e) => e);
  const missing = await store.forTenant("t2").open("never-existed", { hold: HOLD }).catch((e) => e);
  assert.equal(other.code, missing.code, "somebody else's run is distinguishable from a missing one");
  assert.equal(other.status, 404);
  assert.notEqual(other.status, 403);
  assert.equal(other.message.includes("t1"), false, "the error named the owning tenant");
});

test("the ownership check asks for BOTH filters in one request", async () => {
  // Reading the run and then comparing its tenant in JavaScript is the same
  // question asked somewhere that forgetting the comparison still compiles.
  const { rest, store } = liveStore();
  await store.forTenant("t1").create("r1");
  rest.fetch.calls.length = 0;
  await store.forTenant("t1").open("r1", { hold: HOLD });
  const check = rest.fetch.calls.find((c) => c.method === "GET" && c.url.includes("/runs"));
  assert.match(check.url, /id=eq\.r1/);
  assert.match(check.url, /tenant_id=eq\.t1/);
  assert.equal(check.headers["accept-profile"], "agent");
});

test("resumable is scoped to the tenant and asks for started-and-not-stopped", async () => {
  const live = liveStore();
  const { rest, store } = live;
  await holdRun(live, { runId: "r1", tenant: "t1",
    entry: { kind: "started", at: 0, agent: "x", model: "m", limits: { wallMs: "Infinity" } } });
  await holdRun(live, { runId: "r2", tenant: "t2",
    entry: { kind: "started", at: 0, agent: "y", model: "m", limits: null } });

  const mine = await store.forTenant("t1").resumable();
  assert.deepEqual(mine.map((r) => r.id), ["r1"], "resumable crossed tenants");
  assert.equal(mine[0].limits.wallMs, Infinity, "the unbounded limit came back undecoded");
  const q = rest.fetch.calls.at(-1).url;
  assert.match(q, /tenant_id=eq\.t1/);
  assert.match(q, /status=eq\.running/);
});

// ── append ───────────────────────────────────────────────────────────────────
test("append sends the entry VERBATIM, under the claim, and counts up", async () => {
  const live = liveStore();
  const { rest, store } = live;
  const hold = await holdRun(live, { runId: "r1", tenant: "t1" });
  // `accept` has already written the `started` entry, as it does in production, so
  // the journal opens after it.
  const { journal } = await store.forTenant("t1").open("r1", { hold });
  assert.equal(journal.seq, 1, "the journal would have overwritten the started entry");

  const r = await journal.append({ kind: "model", at: 1, step: 1, ms: 5, usage: null });
  assert.equal(r.seq, 1);
  const call = rest.fetch.calls.at(-1);
  assert.match(String(call.url), /\/rpc\/append_entry$/, "the append did not go through the fence");
  // The entry goes in UNTOUCHED — `usage: null` is the artifact, and a store that
  // normalised it would turn "unreported" into "zero".
  assert.deepEqual(call.body, {
    p_run_id: "r1", p_seq: 1, p_body: { kind: "model", at: 1, step: 1, ms: 5, usage: null },
    p_worker: hold.worker, p_token: hold.token,
  });
  assert.equal("usage" in call.body.p_body, true);
  assert.equal(call.body.p_body.usage, null);
  assert.equal(journal.seq, 2);
});

test("A LOGICAL DUPLICATE IS A SUCCESS — that is what makes a retry safe", async () => {
  // The network dropped after Postgres committed. The retry must not kill a run
  // that is fine, and the entry it re-sends holds an answer already paid for.
  const live = liveStore();
  const { rest, store } = live;
  const hold = await holdRun(live, { runId: "r1", tenant: "t1" });
  const t = store.forTenant("t1");
  const e = { kind: "model", at: 1, step: 1, ms: 5, usage: null };
  assert.equal((await (await t.open("r1", { hold })).journal.append(e)).stored, true);

  // A second journal that does not know the first one landed — the shape a retry
  // after a lost answer really has.
  const again = await t.open("r1", { hold });
  const r = await again.journal.append(e);
  assert.equal(r.already, true, "a redelivered entry was written a second time");
  assert.equal(r.stored, false);
  assert.equal(rest.entries.get("r1").size, 2, `the log holds ${rest.entries.get("r1").size} entries`);
});

test("A DIFFERENT ENTRY IN THE SAME SLOT IS A CONFLICT, NEVER A DUPLICATE", async () => {
  // **THE PAIR THAT MUST NEVER COLLAPSE.** `already` says "this exact entry is
  // recorded" and is safe; a different body in the same logical slot says two writers
  // produced two answers for one step, which no re-send can explain. Reading the
  // second as the first is how a double execution disappears from the record.
  const live = liveStore();
  const { store } = live;
  const hold = await holdRun(live, { runId: "r1", tenant: "t1" });
  const t = store.forTenant("t1");
  const j = (await t.open("r1", { hold })).journal;
  await j.append({ kind: "model", at: 1, step: 1, ms: 5, text: "one", usage: null });

  const other = (await t.open("r1", { hold })).journal;
  await assert.rejects(
    () => other.append({ kind: "model", at: 1, step: 1, ms: 9, text: "SOMETHING ELSE", usage: null }),
    (e) => { assert.equal(e.code, "conflict"); return true; },
    "a different answer for step 1 was absorbed as a duplicate",
  );

  // THE CONTROL, and it is what makes the comparison meaningful rather than a slot
  // check: the SAME entry at the same slot is still `already`. Key ORDER differs here
  // on purpose, because `jsonb` does not care and neither may we.
  const same = (await t.open("r1", { hold })).journal;
  const r = await same.append({ usage: null, text: "one", ms: 5, step: 1, at: 1, kind: "model" });
  assert.equal(r.already, true, "the same entry written with its keys in another order read as a conflict");
});

// ── open: what it hands back ─────────────────────────────────────────────────
test("open returns the entries in order, the replayed state, the decoded limits and a positioned journal", async () => {
  const live = liveStore();
  const t = live.store.forTenant("t1");
  const hold = await holdRun(live, { runId: "r1", tenant: "t1",
    entry: { kind: "started", at: 0, agent: "support", model: "m", limits: { steps: 8, wallMs: "Infinity", tokens: 1000 } } });
  const { journal } = await t.open("r1", { hold });
  await journal.append({ kind: "model", at: 1, step: 1, ms: 10, text: "hi", toolCalls: [], usage: { inputTokens: 2, outputTokens: 1 }, costMicros: 5 });

  const o = await t.open("r1", { hold });
  assert.deepEqual(o.entries.map((e) => e.kind), ["started", "model"]);
  assert.equal(o.state.used.tokens, 3);
  assert.equal(o.limits.wallMs, Infinity, "an unbounded limit did not survive the store");
  assert.equal(o.limits.steps, 8);
  assert.equal(o.nextSeq, 2);
  assert.equal(o.journal.seq, 2, "the journal would have overwritten the last entry");
  assert.equal(o.run.status, "running");
});

test("nextSeq comes from the HIGHEST seq stored, never from the row count", async () => {
  // A gap — a position clash that moved up — makes a count collide with an entry
  // that is still there.
  const rest = memoryRest();
  const t = storeOver(rest).forTenant("t1");
  await t.create("r1");
  // **THE GAP IS PUT IN PLACE DIRECTLY, because that is what a gap IS**: an entry at a
  // position with nothing between it and 0. Producing one through the fence needs a
  // position clash, which is a different test's subject.
  rest.entries.get("r1").set(0, { kind: "started", at: 0 });
  rest.entries.get("r1").set(4, { kind: "model", at: 1, step: 1 });
  const o = await t.open("r1", { hold: HOLD });
  assert.equal(o.nextSeq, 5, `nextSeq was ${o.nextSeq} — a count, which would overwrite seq 4`);
  assert.equal(o.journal.seq, 5, "the journal was positioned on top of a stored entry");

  await t.create("r2");
  const fresh = await t.open("r2", { hold: HOLD });
  assert.equal(fresh.nextSeq, 0);
  assert.equal(fresh.journal.seq, 0);
});

test("open surfaces the replay's PROBLEMS rather than handing back a bare array", async () => {
  const rest = memoryRest();
  const t = storeOver(rest).forTenant("t1");
  await t.create("r1");
  rest.entries.get("r1").set(0, { kind: "nope" });
  // BOTH DOORS, because `load` is what the API shows a customer and `open` is what a
  // consumer resumes from — a log with problems must not be resumable, and must not be
  // presentable as though it were fine either.
  for (const o of [await t.open("r1", { hold: HOLD }), await t.load("r1")]) {
    assert.ok(o.state.problems.length >= 1, "a junk entry came back with nothing said about it");
  }
});

test("a failed read throws instead of answering an empty log", async () => {
  // An empty log and a log we could not see mean opposite things: one is a new
  // run, the other is a run whose history is unknown.
  let n = 0;
  const store = makeRunStore({
    fetch: async () => (n++ === 0
      ? { ok: true, status: 200, text: async () => JSON.stringify([{ id: "r1", status: "running" }]) }
      : { ok: false, status: 500, text: async () => JSON.stringify({ message: "gateway" }) }),
    url: "u", key: "k", appendEntry: noop,
  });
  await assert.rejects(() => store.forTenant("t1").open("r1", { hold: HOLD }), (e) => e.status === 500);
});

test("load is open without a journal", async () => {
  const { store } = liveStore();
  const t = store.forTenant("t1");
  await t.create("r1");
  const l = await t.load("r1");
  assert.equal(l.journal, undefined, "a read-only view handed out a way to write");
  assert.equal(l.runId, "r1");
  assert.ok(l.state);
});

// ════════════════════════════════════════════════════════════════════════════
// THE ROUND TRIP: run → persist → reload → resume
// ════════════════════════════════════════════════════════════════════════════
/**
 * A run in the shape the deployment really makes one: `accept_run` writes the
 * `started` entry, a consumer claims the work, and the run continues FROM THE LOG.
 *
 * **THERE IS NO `prompt` PATH HERE ANY MORE, and that is the fence's doing.** A
 * journal write needs a live claim on a work row, so a run that has not been accepted
 * cannot be written to at all — which means the only way to start one is the same way
 * production does. These tests used to hand `runAgent` a prompt and a journal from
 * `create`; that shape could never have worked against the real database.
 */
async function acceptedRun(live, agent, { runId = "r1", tenant = "t1", prompt = "go" } = {}) {
  const hold = await holdRun(live, {
    runId, tenant,
    entry: startedEntry({ at: 0, tenant, agent: agent.name, model: agent.model, prompt, limits: limitsToJson(agent.limits) }),
  });
  return { hold, t: live.store.forTenant(tenant) };
}

test("A RUN PERSISTS, RELOADS AND RESUMES — and does not re-buy what it paid for", async () => {
  const look = repeatableTool("look", async () => ({ hit: 1 }));
  const agent = agentOf([look], { wallMs: Infinity });
  const live = liveStore();
  const { rest } = live;
  const { hold, t } = await acceptedRun(live, agent, { prompt: "how many" });

  // Segment one: the model asks for a tool, the tool answers, the process dies.
  const opened = await t.open("r1", { hold });
  assert.equal(opened.limits.wallMs, Infinity, "the unbounded limit did not survive being accepted");
  const first = scripted([wants("look")]);
  const died = await runAgent({ agent, from: opened.entries, send: first, journal: opened.journal, tenant: { id: "t1" } });
  assert.equal(died.ok, false, "the first segment was supposed to be interrupted");
  assert.equal(first.calls.length, 2, "the crash did not happen where this test needs it");

  // What a real crash leaves: no `stopped` entry, because the process never wrote
  // one. Taken by dropping it rather than by hand-building a log.
  //
  // **AND IT IS DROPPED FROM THE STORE, NOT ONLY FROM THE ARRAY — which is the fence
  // catching this fixture out.** Before, the segment-one `stopped` entry was left in
  // the log and the resume's own `stopped` was absorbed by the duplicate rule as
  // "already recorded", although the two bodies said different things. That is exactly
  // the case that is now a `conflict`, so the fixture has to leave what a crash really
  // leaves.
  const whole = await t.load("r1");
  assert.deepEqual(whole.entries.map((e) => e.kind), ["started", "model", "tool", "stopped"]);
  const log = rest.entries.get("r1");
  for (const [seq, e] of [...log.entries()]) if (e.kind === "stopped") log.delete(seq);
  const crashed = whole.entries.filter((e) => e.kind !== "stopped");
  assert.equal(replay(crashed).status, "running");
  assert.deepEqual([...replay(crashed).problems], [], "the stored log did not replay cleanly");

  // Segment two: a different process reopens and carries on. A REAL HANDOVER, so it
  // claims the run for itself rather than reusing the dead process's hold — which is
  // also the only way it could write, since the reclaim replaces the token.
  await live.rest.work.get("r1") && null;
  live.rest.work.get("r1").lease_expires_at = 0;             // the dead holder's lease lapses
  const next = await live.work.claim({ runId: "r1", worker: "w2", ttlS: 90 });
  assert.equal(next.claimed, true, "the replacement could not claim the dropped run");
  assert.notEqual(next.token, hold.token, "the reclaim reused the dead holder's token");
  const again = await t.open("r1", { hold: { worker: "w2", token: next.token } });
  assert.equal(again.limits.wallMs, Infinity, "the unbounded limit did not survive storage");
  const second = scripted([says("it is 1")]);
  const done = await runAgent({
    agent, send: second, from: crashed, tenant: { id: "t1" },
    journal: again.journal,
  });
  assert.equal(done.ok, true, `resume stopped on "${done.stop.reason}"`);
  assert.equal(done.text, "it is 1");
  assert.equal(done.resumed, true);
  assert.equal(second.calls.length, 1, "the resume re-bought a model call");
  assert.equal(second.calls[0].step, 2, `resumed at step ${second.calls[0].step}`);
  // The meters crossed the process boundary, and the tool result reached the model.
  assert.equal(done.used.steps, 2);
  assert.equal(done.used.tokens, 6);
  assert.match(JSON.stringify(second.calls[0].messages), /hit/);
  // Nothing was written twice.
  const kinds = [...rest.entries.get("r1").values()].map((e) => e.kind);
  assert.equal(kinds.filter((k) => k === "model").length, 2, `the log holds ${kinds.filter((k) => k === "model").length} model answers`);

  // AND THE DEAD HOLDER STILL CANNOT WRITE, which is the fence rather than the flag:
  // its journal object is perfectly good and its claim is not.
  await assert.rejects(() => opened.journal.append({ kind: "model", at: 9, step: 9, ms: 1 }),
    (e) => {
      assert.equal(e.code, "fenced");
      // `not-holder` because the replacement took it under a DIFFERENT name. The
      // same-name case answers `bad-token`, which is the token's own reason for
      // existing and is driven in the runner's handover test.
      assert.equal(e.why, "not-holder");
      return true;
    },
    "the process that died wrote to a run somebody else had finished");
});

test("A COMPLETED RUN RELOADED MUST NOT EXECUTE AGAIN", async () => {
  const agent = agentOf();
  const live = liveStore();
  const { hold, t } = await acceptedRun(live, agent);
  const opened = await t.open("r1", { hold });
  const finished = await runAgent({ agent, from: opened.entries, send: scripted([says("the answer")]), journal: opened.journal, tenant: { id: "t1" } });
  assert.equal(finished.ok, true);

  const reloaded = await t.open("r1", { hold });
  assert.equal(reloaded.state.status, "stopped");
  assert.equal(reloaded.run.status, "stopped", "the database's own projection did not record the ending");

  let calls = 0;
  const resumed = await runAgent({
    agent, send: async () => { calls++; return says("a second bill"); },
    from: reloaded.entries, tenant: { id: "t1" }, journal: reloaded.journal,
  });
  assert.equal(calls, 0, "replaying a finished run bought another model call");
  assert.equal(resumed.ok, true);
  assert.equal(resumed.stop.reason, "answered");
  assert.equal(resumed.stop.text, "the answer", "it answered something other than what it had answered");
});

test("A CROSS-TENANT RESUME CANNOT EVEN GET THE LOG", async () => {
  const agent = agentOf();
  const live = liveStore();
  const { hold, t } = await acceptedRun(live, agent);
  const opened = await t.open("r1", { hold });
  await runAgent({ agent, from: opened.entries, send: scripted([says("mine")]), journal: opened.journal, tenant: { id: "t1" } });
  // The only way to a run's entries is through an authorised open, so the wrong
  // tenant never reaches the point of being able to resume — and presenting the real
  // holder's claim does not help, because the ownership check is a different wall.
  await assert.rejects(() => live.store.forTenant("t2").open("r1", { hold }), (e) => e.code === "not-found");
});

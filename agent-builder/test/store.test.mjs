import test from "node:test";
import assert from "node:assert/strict";
import { makeRunStore, duplicateKind, LOGICAL_UNIQUE, POSITION_UNIQUE, DUPLICATE } from "../src/store.mjs";
import { defineAgent, defineTool, PUBLIC } from "../src/define.mjs";
import { runAgent } from "../src/run.mjs";
import { replay } from "../src/journal.mjs";

// ════════════════════════════════════════════════════════════════════════════
// A FAKE POSTGREST WHOSE RULES ARE THE PROVEN ONES.
//
// Its refusals and its derived `status` mirror what
// `test/integration/pg-schema.mjs` proves against a real PostgreSQL 16. The split
// is deliberate: the SQL is proved on the engine, and what is proved HERE is that
// the store speaks to those rules correctly and that `runAgent` can drive it.
// ════════════════════════════════════════════════════════════════════════════
function memoryRest() {
  const runs = new Map();                  // id -> { id, tenant_id, status, ... }
  const entries = new Map();               // id -> Map(seq -> body)
  const logicalKey = (b) => b.kind === "started" || b.kind === "stopped" ? b.kind
    : b.kind === "model" ? `model:${b.step}` : `tool:${b.step}:${b.index}`;
  const constraintFor = (key) => key === "started" ? "entries_one_started"
    : key === "stopped" ? "entries_one_stopped"
    : key.startsWith("model") ? "entries_one_model_per_step" : "entries_one_tool_per_slot";
  const res = (status, body) => ({
    ok: status < 300, status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  });
  const conflict = (c) => res(409, { code: DUPLICATE, message: `duplicate key value violates unique constraint "${c}"` });

  const fetch = async (url, init) => {
    const u = new URL(url);
    const p = u.pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    const eq = (k) => { const v = u.searchParams.get(k); return v === null ? null : v.replace(/^eq\./, ""); };

    if (p.endsWith("/runs") && init.method === "POST") {
      if (runs.has(body.id)) return conflict("runs_pkey");
      runs.set(body.id, { ...body, status: "new", agent_name: null, model: null, limits: null, stop: null, created_at: "2026-09-15T00:00:00Z" });
      entries.set(body.id, new Map());
      return res(201);
    }
    if (p.endsWith("/runs") && init.method === "GET") {
      const id = eq("id"), tenant = eq("tenant_id"), status = eq("status");
      const rows = [...runs.values()].filter((r) =>
        (id === null || r.id === id) && (tenant === null || r.tenant_id === tenant) && (status === null || r.status === status));
      return res(200, rows);
    }
    if (p.endsWith("/run_entries") && init.method === "POST") {
      const log = entries.get(body.run_id);
      if (!log) return res(409, { code: "23503", message: "run_entries_run_id_fkey" });
      if (log.has(body.seq)) return conflict(POSITION_UNIQUE);
      const key = logicalKey(body.body);
      for (const b of log.values()) if (logicalKey(b) === key) return conflict(constraintFor(key));
      log.set(body.seq, body.body);
      // The projection the database maintains by trigger, mirrored here.
      const run = runs.get(body.run_id);
      if (body.body.kind === "started") {
        run.status = run.status === "new" ? "running" : run.status;
        run.agent_name = body.body.agent ?? null;
        run.model = body.body.model ?? null;
        run.limits = body.body.limits ?? null;
      } else if (body.body.kind === "stopped") {
        run.status = "stopped";
        run.stop = body.body.stop ?? null;
      }
      return res(201);
    }
    if (p.endsWith("/run_entries") && init.method === "GET") {
      const log = entries.get(eq("run_id")) ?? new Map();
      return res(200, [...log.entries()].sort((a, b) => a[0] - b[0]).map(([seq, b]) => ({ seq, body: b })));
    }
    throw new Error(`the memory rest does not serve ${init.method} ${p}`);
  };
  const calls = [];
  const counted = async (url, init) => { calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }); return fetch(url, init); };
  counted.calls = calls;
  return { fetch: counted, runs, entries };
}
const liveStore = () => {
  const rest = memoryRest();
  return { rest, store: makeRunStore({ fetch: rest.fetch, url: "https://p.supabase.co/", key: "svc" }) };
};

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

// ── duplicateKind ────────────────────────────────────────────────────────────
test("duplicateKind tells a LOGICAL duplicate from a POSITION one", () => {
  for (const c of LOGICAL_UNIQUE) assert.equal(duplicateKind({ code: DUPLICATE, message: `constraint "${c}"` }), "logical", c);
  assert.equal(duplicateKind({ code: DUPLICATE, message: `constraint "${POSITION_UNIQUE}"` }), "position");
  assert.ok(LOGICAL_UNIQUE.length >= 4, "the logical rules shrank — every kind needs one");
});

test("duplicateKind REFUSES TO GUESS at anything it does not recognise", () => {
  // Reading an unknown refusal as "already recorded" would silently drop a real
  // entry, which is the one outcome this module exists to prevent.
  assert.equal(duplicateKind({ code: DUPLICATE, message: 'constraint "some_other_index"' }), null);
  assert.equal(duplicateKind({ code: "23503", message: `constraint "${POSITION_UNIQUE}"` }), null);
  for (const bad of [null, undefined, "23505", 23505, [], { code: DUPLICATE }]) assert.equal(duplicateKind(bad), null);
});

// ── the doors ────────────────────────────────────────────────────────────────
test("makeRunStore and forTenant refuse what they cannot use", () => {
  const f = async () => ({ ok: true, status: 200, text: async () => "[]" });
  for (const o of [{}, { fetch: f }, { fetch: f, url: "u" }, { fetch: "f", url: "u", key: "k" },
                   { fetch: f, url: "", key: "k" }, { fetch: f, url: "u", key: "" }]) {
    assert.throws(() => makeRunStore(o), { name: "TypeError" });
  }
  const store = makeRunStore({ fetch: f, url: "u", key: "k" });
  for (const bad of [undefined, null, "", "   ", 4, ["t1"], {}]) {
    assert.throws(() => store.forTenant(bad), { name: "TypeError" }, `forTenant accepted ${JSON.stringify(bad) ?? String(bad)}`);
  }
});

test("THERE IS NO UNSCOPED DOOR, AND NO CALL TAKES A TENANT", () => {
  // The structural half of "never accept the request body's tenant id as
  // authority": there is nowhere to put one. A census over the real surface
  // rather than a promise in a comment.
  const f = async () => ({ ok: true, status: 200, text: async () => "[]" });
  const store = makeRunStore({ fetch: f, url: "u", key: "k" });
  assert.deepEqual(Object.keys(store), ["forTenant"], "the store grew a door that is not tenant-scoped");
  const scoped = store.forTenant("t1");
  assert.deepEqual(Object.keys(scoped).sort(), ["create", "load", "open", "resumable", "tenant"].sort());
  // Every operation takes at most a run id and options — never a tenant.
  assert.equal(scoped.create.length, 1, "create takes more than a run id");
  assert.equal(scoped.open.length, 1);
  assert.equal(scoped.load.length, 1);
  assert.equal(scoped.resumable.length, 0, "resumable takes a positional argument");
  assert.equal(scoped.tenant, "t1");
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

test("a REPEATED create is absorbed and still hands back a journal", async () => {
  const { store } = liveStore();
  const t = store.forTenant("t1");
  await t.create("r1");
  const again = await t.create("r1");
  assert.equal(again.runId, "r1");
  assert.equal(typeof again.journal.append, "function");
});

test("A REPEATED create CANNOT HAND OVER ANOTHER TENANT'S RUN", async () => {
  // The primary key is on the id ALONE, so a duplicate could be somebody else's
  // run with the same id — and answering with a journal for it would be the leak.
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
    url: "u", key: "k",
  });
  await assert.rejects(() => broken.forTenant("t1").create("r1"), (e) => {
    assert.equal(e.status, 403);
    assert.match(e.message, /permission denied/);
    return true;
  });
});

// ── the ownership boundary ───────────────────────────────────────────────────
test("A TENANT CANNOT OPEN OR LOAD ANOTHER TENANT'S RUN", async () => {
  const { store } = liveStore();
  const mine = await store.forTenant("t1").create("r1");
  await mine.journal.append({ kind: "started", at: 0, agent: "support", model: "m", limits: { steps: 4 } });

  for (const op of ["open", "load"]) {
    await assert.rejects(() => store.forTenant("t2")[op]("r1"), (e) => {
      assert.equal(e.code, "not-found", `${op} answered ${e.code}`);
      return true;
    }, `${op} let another tenant in`);
  }
  // THE CONTROL: the owner can, so the refusal is about the tenant and not about
  // the run being unreadable.
  assert.equal((await store.forTenant("t1").open("r1")).state.status, "running");
});

test("ANOTHER TENANT'S RUN IS 'NOT FOUND', NEVER 'FORBIDDEN'", async () => {
  // The difference between them is information: "forbidden" tells a stranger the
  // id they guessed is real.
  const { store } = liveStore();
  await store.forTenant("t1").create("r1");
  const other = await store.forTenant("t2").open("r1").catch((e) => e);
  const missing = await store.forTenant("t2").open("never-existed").catch((e) => e);
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
  await store.forTenant("t1").open("r1");
  const check = rest.fetch.calls.find((c) => c.method === "GET" && c.url.includes("/runs"));
  assert.match(check.url, /id=eq\.r1/);
  assert.match(check.url, /tenant_id=eq\.t1/);
  assert.equal(check.headers["accept-profile"], "agent");
});

test("resumable is scoped to the tenant and asks for started-and-not-stopped", async () => {
  const { rest, store } = liveStore();
  const a = await store.forTenant("t1").create("r1");
  await a.journal.append({ kind: "started", at: 0, agent: "x", model: "m", limits: { wallMs: "Infinity" } });
  const b = await store.forTenant("t2").create("r2");
  await b.journal.append({ kind: "started", at: 0, agent: "y", model: "m", limits: null });

  const mine = await store.forTenant("t1").resumable();
  assert.deepEqual(mine.map((r) => r.id), ["r1"], "resumable crossed tenants");
  assert.equal(mine[0].limits.wallMs, Infinity, "the unbounded limit came back undecoded");
  const q = rest.fetch.calls.at(-1).url;
  assert.match(q, /tenant_id=eq\.t1/);
  assert.match(q, /status=eq\.running/);
});

// ── append ───────────────────────────────────────────────────────────────────
test("append stores the entry verbatim and counts up", async () => {
  const { rest, store } = liveStore();
  const { journal } = await store.forTenant("t1").create("r1");
  assert.equal((await journal.append({ kind: "started", at: 0 })).seq, 0);
  const r = await journal.append({ kind: "model", at: 1, step: 1, usage: null });
  assert.equal(r.seq, 1);
  const post = rest.fetch.calls.at(-1).body;
  // The entry goes in UNTOUCHED — `usage: null` is the artifact, and a store that
  // normalised it would turn "unreported" into "zero".
  assert.deepEqual(post, { run_id: "r1", seq: 1, body: { kind: "model", at: 1, step: 1, usage: null } });
  assert.equal("usage" in post.body, true);
  assert.equal(post.body.usage, null);
  assert.equal(journal.seq, 2);
});

test("A LOGICAL DUPLICATE IS A SUCCESS — that is what makes a retry safe", async () => {
  // The network dropped after Postgres committed. The retry must not kill a run
  // that is fine, and the entry it re-sends holds an answer already paid for.
  const { rest, store } = liveStore();
  const t = store.forTenant("t1");
  const first = await t.create("r1");
  const e = { kind: "model", at: 1, step: 1, ms: 5, usage: null };
  assert.equal((await first.journal.append(e)).stored, true);
  // A second journal that does not know the first one landed.
  const again = await t.open("r1");
  const r = await again.journal.append(e);
  assert.equal(r.already, true, "a redelivered entry was written a second time");
  assert.equal(r.stored, false);
  assert.equal(rest.entries.get("r1").size, 1, `the log holds ${rest.entries.get("r1").size} copies`);
});

test("A POSITION CLASH MOVES UP AND TRIES ONCE, and cannot double-write", async () => {
  const scriptStore = (answers) => {
    let n = 0;
    const fetch = async () => answers[n++];
    return makeRunStore({ fetch, url: "u", key: "k" });
  };
  const res = (status, body) => ({ ok: status < 300, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
  const conflict = (c) => res(409, { code: DUPLICATE, message: `constraint "${c}"` });

  // create, then a position clash, then success.
  const s1 = scriptStore([res(201), conflict(POSITION_UNIQUE), res(201)]);
  const j1 = (await s1.forTenant("t1").create("r1")).journal;
  const r1 = await j1.append({ kind: "model", at: 1, step: 1 });
  assert.equal(r1.seq, 1, "it did not move to a free position");
  assert.equal(r1.stored, true);

  // The same entry behind a taken position: the logical rule fires on the retry.
  const s2 = scriptStore([res(201), conflict(POSITION_UNIQUE), conflict("entries_one_model_per_step")]);
  const j2 = (await s2.forTenant("t1").create("r1")).journal;
  const r2 = await j2.append({ kind: "model", at: 1, step: 1 });
  assert.equal(r2.already, true, "a duplicate slipped in at a new position");

  // Twice running throws rather than looping.
  const s3 = scriptStore([res(201), conflict(POSITION_UNIQUE), conflict(POSITION_UNIQUE)]);
  const j3 = (await s3.forTenant("t1").create("r1")).journal;
  await assert.rejects(() => j3.append({ kind: "model", at: 1, step: 1 }));
});

test("an UNRECOGNISED failure throws — it is never read as already-recorded", async () => {
  const res = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
  for (const bad of [res(500, { message: "boom" }), res(401, { message: "bad key" }),
                     res(409, { code: DUPLICATE, message: 'constraint "unknown_index"' })]) {
    let n = 0;
    const store = makeRunStore({ fetch: async () => (n++ === 0 ? res(201, undefined) : bad), url: "u", key: "k" });
    const { journal } = await store.forTenant("t1").create("r1");
    await assert.rejects(() => journal.append({ kind: "model", at: 1, step: 1 }), `${bad.status} was swallowed`);
  }
});

// ── open: what it hands back ─────────────────────────────────────────────────
test("open returns the entries in order, the replayed state, the decoded limits and a positioned journal", async () => {
  const { store } = liveStore();
  const t = store.forTenant("t1");
  const { journal } = await t.create("r1");
  await journal.append({ kind: "started", at: 0, agent: "support", model: "m", limits: { steps: 8, wallMs: "Infinity", tokens: 1000 } });
  await journal.append({ kind: "model", at: 1, step: 1, ms: 10, text: "hi", toolCalls: [], usage: { inputTokens: 2, outputTokens: 1 }, costMicros: 5 });

  const o = await t.open("r1");
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
  const store = makeRunStore({ fetch: rest.fetch, url: "https://p.supabase.co", key: "k" });
  const t = store.forTenant("t1");
  await t.create("r1");
  rest.entries.get("r1").set(0, { kind: "started", at: 0 });
  rest.entries.get("r1").set(4, { kind: "model", at: 1, step: 1 });
  const o = await t.open("r1");
  assert.equal(o.nextSeq, 5, `nextSeq was ${o.nextSeq} — a count, which would overwrite seq 4`);
  const fresh = await t.create("r2");
  assert.equal((await t.open("r2")).nextSeq, 0);
  assert.equal(fresh.journal.seq, 0);
});

test("open surfaces the replay's PROBLEMS rather than handing back a bare array", async () => {
  const rest = memoryRest();
  const store = makeRunStore({ fetch: rest.fetch, url: "https://p.supabase.co", key: "k" });
  const t = store.forTenant("t1");
  await t.create("r1");
  rest.entries.get("r1").set(0, { kind: "nope" });
  const o = await t.open("r1");
  assert.ok(o.state.problems.length >= 1, "a junk entry came back with nothing said about it");
});

test("a failed read throws instead of answering an empty log", async () => {
  // An empty log and a log we could not see mean opposite things: one is a new
  // run, the other is a run whose history is unknown.
  let n = 0;
  const store = makeRunStore({
    fetch: async () => (n++ === 0
      ? { ok: true, status: 200, text: async () => JSON.stringify([{ id: "r1", status: "running" }]) }
      : { ok: false, status: 500, text: async () => JSON.stringify({ message: "gateway" }) }),
    url: "u", key: "k",
  });
  await assert.rejects(() => store.forTenant("t1").open("r1"), (e) => e.status === 500);
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
test("A RUN PERSISTS, RELOADS AND RESUMES — and does not re-buy what it paid for", async () => {
  const look = repeatableTool("look", async () => ({ hit: 1 }));
  const agent = agentOf([look], { wallMs: Infinity });
  const { rest, store } = liveStore();
  const t = store.forTenant("t1");
  const { journal } = await t.create("r1");

  // Segment one: the model asks for a tool, the tool answers, the process dies.
  const first = scripted([wants("look")]);
  const died = await runAgent({ agent, prompt: "how many", send: first, journal, tenant: { id: "t1" } });
  assert.equal(died.ok, false, "the first segment was supposed to be interrupted");
  assert.equal(first.calls.length, 2, "the crash did not happen where this test needs it");

  // What a real crash leaves: no `stopped` entry, because the process never wrote
  // one. Taken by dropping it rather than by hand-building a log.
  const whole = await t.open("r1");
  assert.deepEqual(whole.entries.map((e) => e.kind), ["started", "model", "tool", "stopped"]);
  const crashed = whole.entries.filter((e) => e.kind !== "stopped");
  assert.equal(replay(crashed).status, "running");
  assert.deepEqual([...replay(crashed).problems], [], "the stored log did not replay cleanly");

  // Segment two: a different process reopens and carries on.
  const again = await t.open("r1");
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
});

test("A COMPLETED RUN RELOADED MUST NOT EXECUTE AGAIN", async () => {
  const agent = agentOf();
  const { store } = liveStore();
  const t = store.forTenant("t1");
  const { journal } = await t.create("r1");
  const finished = await runAgent({ agent, prompt: "go", send: scripted([says("the answer")]), journal, tenant: { id: "t1" } });
  assert.equal(finished.ok, true);

  const reloaded = await t.open("r1");
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
  const { store } = liveStore();
  const { journal } = await store.forTenant("t1").create("r1");
  await runAgent({ agent, prompt: "go", send: scripted([says("mine")]), journal, tenant: { id: "t1" } });
  // The only way to a run's entries is through an authorised open, so the wrong
  // tenant never reaches the point of being able to resume.
  await assert.rejects(() => store.forTenant("t2").open("r1"), (e) => e.code === "not-found");
});

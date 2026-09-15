import test from "node:test";
import assert from "node:assert/strict";
import { makeRunStore, duplicateKind, LOGICAL_UNIQUE, POSITION_UNIQUE, DUPLICATE } from "../src/store.mjs";

// ── a fake PostgREST. Answers are scripted; every request is recorded. ────────
const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
});
const ok = (body) => reply(200, body);
const dup = (constraint, details = "") => reply(409, {
  code: DUPLICATE, message: `duplicate key value violates unique constraint "${constraint}"`, details,
});

function fakeRest(answers) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const a = answers[calls.length - 1];
    if (a === undefined) throw new Error(`fake rest ran past its script at call ${calls.length}`);
    return typeof a === "function" ? a(calls.at(-1)) : a;
  };
  fetch.calls = calls;
  return fetch;
}
const storeWith = (answers) => {
  const fetch = fakeRest(answers);
  return { fetch, store: makeRunStore({ fetch, url: "https://p.supabase.co/", key: "svc-key" }) };
};

// ── duplicateKind: it must refuse to guess ───────────────────────────────────
test("duplicateKind tells a LOGICAL duplicate from a POSITION one", () => {
  for (const c of LOGICAL_UNIQUE) {
    assert.equal(duplicateKind({ code: DUPLICATE, message: `...constraint "${c}"` }), "logical", `${c} misread`);
  }
  assert.equal(duplicateKind({ code: DUPLICATE, message: `...constraint "${POSITION_UNIQUE}"` }), "position");
  // The two need OPPOSITE handling — one is "already recorded", the other is "that
  // slot is taken" — so collapsing them is the one way this could lose an entry.
  assert.ok(LOGICAL_UNIQUE.length >= 4, "the logical rules shrank — every kind needs one");
});

test("duplicateKind REFUSES TO GUESS at anything it does not recognise", () => {
  // Reading an unknown refusal as "already recorded" would silently drop a real
  // entry, which is the one outcome the whole module exists to prevent.
  assert.equal(duplicateKind({ code: DUPLICATE, message: 'constraint "some_other_index"' }), null);
  assert.equal(duplicateKind({ code: "23503", message: `constraint "${POSITION_UNIQUE}"` }), null, "a foreign-key error read as a duplicate");
  for (const bad of [null, undefined, "23505", 23505, [], { code: DUPLICATE }]) {
    assert.equal(duplicateKind(bad), null, `${JSON.stringify(bad) ?? String(bad)} produced a kind`);
  }
});

// ── the doors refuse what they cannot use ────────────────────────────────────
test("makeRunStore refuses arguments it cannot use", () => {
  const f = async () => ok([]);
  for (const o of [{}, { fetch: f }, { fetch: f, url: "u" }, { fetch: "f", url: "u", key: "k" },
                   { fetch: f, url: "", key: "k" }, { fetch: f, url: "u", key: "" }]) {
    assert.throws(() => makeRunStore(o), { name: "TypeError" });
  }
  assert.doesNotThrow(() => makeRunStore({ fetch: f, url: "u", key: "k" }));
});

test("createRun and the journal refuse ids they cannot use", async () => {
  const { store } = storeWith([]);
  for (const bad of [undefined, null, 4, "", "  ", ["id"]]) {
    await assert.rejects(() => store.createRun({ id: bad, tenant: "t1" }), { name: "TypeError" });
    await assert.rejects(() => store.createRun({ id: "r1", tenant: bad }), { name: "TypeError" });
    assert.throws(() => store.journalFor({ runId: bad }), { name: "TypeError" });
    await assert.rejects(() => store.load(bad), { name: "TypeError" });
  }
});

// ── createRun ────────────────────────────────────────────────────────────────
test("createRun writes ONLY id and tenant — everything else is the database's", async () => {
  const { fetch, store } = storeWith([reply(201)]);
  await store.createRun({ id: "r1", tenant: "t1" });
  assert.deepEqual(fetch.calls[0].body, { id: "r1", tenant_id: "t1" });
  // A status or a limits column written here would be a second copy of a fact the
  // log already states, and two copies of one fact eventually disagree.
  assert.deepEqual(Object.keys(fetch.calls[0].body), ["id", "tenant_id"]);
  assert.equal(fetch.calls[0].url, "https://p.supabase.co/rest/v1/runs");
  assert.equal(fetch.calls[0].headers["content-profile"], "agent", "the non-public schema was not named");
  assert.equal(fetch.calls[0].headers["authorization"], "Bearer svc-key");
});

test("a REPEATED createRun is not an error", async () => {
  // The caller cannot know which side of the commit its connection died on.
  const { store } = storeWith([dup("runs_pkey")]);
  await assert.doesNotReject(() => store.createRun({ id: "r1", tenant: "t1" }));
});

test("a real createRun failure DOES throw, and names itself", async () => {
  const { store } = storeWith([reply(403, { message: "permission denied for table runs" })]);
  await assert.rejects(() => store.createRun({ id: "r1", tenant: "t1" }), (e) => {
    assert.equal(e.status, 403);
    assert.match(e.message, /permission denied/);
    return true;
  });
});

// ── append ───────────────────────────────────────────────────────────────────
const entry = (kind, extra = {}) => ({ kind, at: 1, ...extra });

test("append stores the entry verbatim at the next seq, and counts up", async () => {
  const { fetch, store } = storeWith([reply(201), reply(201)]);
  const j = store.journalFor({ runId: "r1" });
  assert.equal(await (async () => (await j.append(entry("started"))).seq)(), 0);
  assert.equal((await j.append(entry("model", { step: 1, usage: null }))).seq, 1);
  assert.deepEqual(fetch.calls[1].body, { run_id: "r1", seq: 1, body: { kind: "model", at: 1, step: 1, usage: null } });
  // The entry goes in UNTOUCHED — `usage: null` is the artifact, and a store that
  // normalised it would turn "unreported" into "zero".
  assert.equal("usage" in fetch.calls[1].body.body, true);
  assert.equal(fetch.calls[1].body.body.usage, null);
  assert.equal(j.seq, 2);
});

test("a journal resumes its numbering where the last one left off", async () => {
  const { fetch, store } = storeWith([reply(201)]);
  const j = store.journalFor({ runId: "r1", seq: 7 });
  await j.append(entry("model", { step: 4 }));
  assert.equal(fetch.calls[0].body.seq, 7, "a resumed journal restarted at 0 and would collide");
  for (const bad of [undefined, -1, 1.5, "7", null, NaN]) {
    assert.equal(store.journalFor({ runId: "r1", seq: bad }).seq, 0, `seq ${String(bad)} was taken as a position`);
  }
});

test("A LOGICAL DUPLICATE IS A SUCCESS — that is what makes a retry safe", async () => {
  // The network dropped after Postgres committed. The retry must not kill a run
  // that is fine, and the entry it is re-sending already holds a paid-for answer.
  const { store } = storeWith([dup("entries_one_model_per_step", "Key (run_id, step)=(r1, 1) already exists.")]);
  const j = store.journalFor({ runId: "r1" });
  const r = await j.append(entry("model", { step: 1 }));
  assert.equal(r.already, true);
  assert.equal(r.stored, false, "a re-send was reported as a fresh write");
  assert.equal(j.seq, 1, "the counter did not move past a slot that is now spoken for");
});

test("A POSITION CLASH MOVES UP AND TRIES ONCE, and cannot double-write", async () => {
  // Most likely this journal's counter is behind after a resume. Retrying is safe
  // because if the entry really is a duplicate, the logical rule catches it on the
  // second attempt — which is exactly what the second case here proves.
  const { fetch, store } = storeWith([dup(POSITION_UNIQUE), reply(201)]);
  const j = store.journalFor({ runId: "r1" });
  const r = await j.append(entry("model", { step: 1 }));
  assert.equal(r.seq, 1, "it did not move to a free position");
  assert.equal(r.stored, true);
  assert.deepEqual(fetch.calls.map((c) => c.body.seq), [0, 1]);

  // The same entry behind a taken position: the logical rule fires on the retry,
  // so nothing is written twice.
  const second = storeWith([dup(POSITION_UNIQUE), dup("entries_one_model_per_step")]);
  const r2 = await second.store.journalFor({ runId: "r1" }).append(entry("model", { step: 1 }));
  assert.equal(r2.already, true, "a duplicate slipped in at a new position");
  assert.equal(r2.stored, false);
});

test("a position clash twice running throws rather than looping", async () => {
  const { fetch, store } = storeWith([dup(POSITION_UNIQUE), dup(POSITION_UNIQUE)]);
  await assert.rejects(() => store.journalFor({ runId: "r1" }).append(entry("model", { step: 1 })));
  assert.equal(fetch.calls.length, 2, "it kept trying");
});

test("an UNRECOGNISED failure throws — it is never read as already-recorded", async () => {
  for (const bad of [reply(500, { message: "boom" }), reply(401, { message: "bad key" }),
                     dup("some_index_we_do_not_know")]) {
    const { store } = storeWith([bad]);
    await assert.rejects(() => store.journalFor({ runId: "r1" }).append(entry("model", { step: 1 })),
      `${bad.status} was swallowed`);
  }
});

// ── load ─────────────────────────────────────────────────────────────────────
test("load returns the entries in order, the replayed state, and the decoded limits", async () => {
  const rows = [
    { seq: 0, body: { kind: "started", at: 0, tenant: "t1", agent: "a", model: "m", limits: { steps: 8, wallMs: "Infinity" } } },
    { seq: 1, body: { kind: "model", at: 1, step: 1, ms: 10, text: "hi", toolCalls: [], usage: { inputTokens: 2, outputTokens: 1 }, costMicros: 5 } },
  ];
  const { fetch, store } = storeWith([ok(rows)]);
  const r = await store.load("r1");
  assert.deepEqual(r.entries, rows.map((x) => x.body));
  assert.equal(r.state.status, "running");
  assert.equal(r.state.used.tokens, 3);
  // The unbounded limit comes back a NUMBER, not the string it was stored as.
  assert.equal(r.limits.wallMs, Infinity);
  assert.equal(r.limits.steps, 8);
  assert.match(fetch.calls[0].url, /order=seq\.asc/);
  assert.equal(fetch.calls[0].headers["accept-profile"], "agent");
  assert.equal(fetch.calls[0].method, "GET");
});

test("nextSeq comes from the HIGHEST seq stored, never from the row count", async () => {
  // A gap — a retention delete, or a position clash that moved up — makes a
  // count-based answer collide with an entry that is still there.
  const { store } = storeWith([ok([{ seq: 0, body: { kind: "started" } }, { seq: 4, body: { kind: "model", step: 1 } }])]);
  const r = await store.load("r1");
  assert.equal(r.nextSeq, 5, `nextSeq was ${r.nextSeq} — a count, which would overwrite seq 4`);
  const empty = storeWith([ok([])]);
  assert.equal((await empty.store.load("r1")).nextSeq, 0);
  assert.equal((await empty.store.load("r1").catch(() => null))?.state?.status ?? "new", "new");
});

test("load surfaces the replay's PROBLEMS rather than handing back a bare array", async () => {
  // A log with problems must not be resumed, and a bare array invites somebody to
  // pass it straight to runAgent without looking.
  const { store } = storeWith([ok([{ seq: 0, body: { kind: "nope" } }])]);
  const r = await store.load("r1");
  assert.ok(r.state.problems.length >= 1, "a junk entry came back with nothing said about it");
});

test("load throws on a failed read instead of answering an empty log", async () => {
  // An empty answer and a failed read mean opposite things: one is a new run, the
  // other is a run whose history we could not see.
  const { store } = storeWith([reply(500, { message: "gateway" })]);
  await assert.rejects(() => store.load("r1"), (e) => e.status === 500);
});

test("resumable asks for started-and-not-stopped, for one tenant only", async () => {
  const { fetch, store } = storeWith([ok([{ id: "r1", tenant_id: "t1", limits: { wallMs: "Infinity" } }])]);
  const rows = await store.resumable("t1");
  assert.equal(rows[0].limits.wallMs, Infinity);
  assert.match(fetch.calls[0].url, /tenant_id=eq\.t1/);
  assert.match(fetch.calls[0].url, /status=eq\.running/);
  await assert.rejects(() => store.resumable(""), { name: "TypeError" });
});

// ════════════════════════════════════════════════════════════════════════════
// THE WIRING: the store IS a journal runAgent can use, and a run resumes from it
// ════════════════════════════════════════════════════════════════════════════
//
// A FAKE WHOSE RULES ARE THE PROVEN ONES. This stands in for PostgREST, and its
// refusals mirror the four logical uniqueness rules and the primary key that
// `test/integration/pg-schema.mjs` proves against a real PostgreSQL. The split is
// deliberate: the SQL is proved on the engine, and what is proved HERE is that the
// store speaks to those rules correctly and that `runAgent` can drive it.

function memoryRest() {
  const runs = new Map();
  const entries = new Map();               // runId -> Map(seq -> body)
  const logicalKey = (b) => {
    if (b.kind === "started" || b.kind === "stopped") return b.kind;
    if (b.kind === "model") return `model:${b.step}`;
    return `tool:${b.step}:${b.index}`;
  };
  const conflict = (constraint) => ({
    ok: false, status: 409,
    text: async () => JSON.stringify({ code: DUPLICATE, message: `duplicate key value violates unique constraint "${constraint}"` }),
  });
  const done = (status, body) => ({
    ok: status < 300, status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  });
  const fetch = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (u.pathname.endsWith("/runs") && init.method === "POST") {
      if (runs.has(body.id)) return conflict("runs_pkey");
      runs.set(body.id, body); entries.set(body.id, new Map());
      return done(201);
    }
    if (u.pathname.endsWith("/run_entries") && init.method === "POST") {
      const log = entries.get(body.run_id);
      if (!log) return done(409, { code: "23503", message: "run_entries_run_id_fkey" });
      if (log.has(body.seq)) return conflict(POSITION_UNIQUE);
      const key = logicalKey(body.body);
      for (const b of log.values()) {
        if (logicalKey(b) === key) {
          const which = { started: "entries_one_started", stopped: "entries_one_stopped" }[key]
            ?? (key.startsWith("model") ? "entries_one_model_per_step" : "entries_one_tool_per_slot");
          return conflict(which);
        }
      }
      log.set(body.seq, body.body);
      return done(201);
    }
    if (u.pathname.endsWith("/run_entries") && init.method === "GET") {
      const id = (u.searchParams.get("run_id") ?? "").replace(/^eq\./, "");
      const log = entries.get(id) ?? new Map();
      return done(200, [...log.entries()].sort((a, b) => a[0] - b[0]).map(([seq, b]) => ({ seq, body: b })));
    }
    throw new Error(`the memory rest does not serve ${init.method} ${u.pathname}`);
  };
  return { fetch, runs, entries };
}

test("A RUN WRITES ITS WHOLE LOG THROUGH THE STORE, AND RESUMES OUT OF IT", async () => {
  const { defineAgent, defineTool, PUBLIC } = await import("../src/define.mjs");
  const { runAgent } = await import("../src/run.mjs");

  const look = defineTool({
    name: "look", description: "reads", input: { type: "object" },
    scope: PUBLIC, repeatable: true, run: async () => ({ hit: 1 }),
  });
  const agent = defineAgent({
    name: "support", model: "claude-sonnet-5", instructions: "help",
    tools: [look], limits: { wallMs: Infinity },
  });

  const rest = memoryRest();
  const store = makeRunStore({ fetch: rest.fetch, url: "https://p.supabase.co", key: "svc" });
  const runId = "aaaaaaaa-0000-0000-0000-000000000001";
  await store.createRun({ id: runId, tenant: "t1" });

  // ── segment one: the process dies after the tool answers ──────────────────
  const first = scriptedSend([
    { text: "", toolCalls: [{ id: "c0", name: "look", args: { q: "x" } }], usage: { inputTokens: 4, outputTokens: 2 }, costMicros: 9 },
  ]);
  const journal = store.journalFor({ runId });
  const dead = await runAgent({ agent, prompt: "how many", send: first.send, journal, tenant: { id: "t1" } });
  // The script runs out on the second call, which is what a crash looks like from
  // inside the loop: the run ends, and the log is what survives it.
  assert.equal(dead.ok, false);

  const mid = await store.load(runId);
  assert.deepEqual(mid.entries.map((e) => e.kind), ["started", "model", "tool", "stopped"]);
  assert.equal(mid.limits.wallMs, Infinity, "the unbounded limit did not survive the store");

  // ── what a real crash leaves: no stopped entry ─────────────────────────────
  // Taken by dropping the last entry, because a process that vanishes never
  // writes one — which is exactly how `replay` tells "still running" from "over".
  const crashed = mid.entries.filter((e) => e.kind !== "stopped");
  const state = (await import("../src/journal.mjs")).replay(crashed);
  assert.equal(state.status, "running");
  assert.deepEqual([...state.problems], [], "the stored log did not replay cleanly");
  assert.equal(state.used.tokens, 6);

  // ── segment two: resume from the stored log ───────────────────────────────
  const second = scriptedSend([{ text: "it is 1", toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 }, costMicros: 2 }]);
  const resumed = await runAgent({
    agent, send: second.send, from: crashed, tenant: { id: "t1" },
    journal: store.journalFor({ runId, seq: mid.nextSeq }),
  });
  assert.equal(resumed.ok, true, `resume stopped on "${resumed.stop.reason}"`);
  assert.equal(resumed.text, "it is 1");
  assert.equal(resumed.resumed, true);
  assert.equal(second.send.calls.length, 1, "the resume re-bought a model call");
  assert.equal(second.send.calls[0].step, 2, `resumed at step ${second.send.calls[0].step}`);
  // The meters carried across the process boundary.
  assert.equal(resumed.used.steps, 2);
  assert.equal(resumed.used.tokens, 8);
  // And the first segment's tool result was in the conversation it sent.
  assert.match(JSON.stringify(second.send.calls[0].messages), /hit/);
});

test("A REDELIVERED APPEND IS ABSORBED, and writes nothing twice", async () => {
  // The whole reason a duplicate is read as a success. Appending the same entry
  // again must be harmless, because the caller cannot know whether the first one
  // committed before the connection dropped.
  const rest = memoryRest();
  const store = makeRunStore({ fetch: rest.fetch, url: "https://p.supabase.co", key: "svc" });
  const runId = "aaaaaaaa-0000-0000-0000-000000000002";
  await store.createRun({ id: runId, tenant: "t1" });
  const j = store.journalFor({ runId });

  const e = { kind: "model", at: 1, step: 1, ms: 5, text: "hi", toolCalls: [], usage: null, costMicros: null };
  const first = await j.append(e);
  assert.equal(first.stored, true);
  // The same entry, sent again by a journal that does not know it landed.
  const again = await store.journalFor({ runId }).append(e);
  assert.equal(again.already, true, "a redelivered entry was written a second time");
  assert.equal(rest.entries.get(runId).size, 1, `the log holds ${rest.entries.get(runId).size} copies`);
  // And a repeated createRun is absorbed too.
  await assert.doesNotReject(() => store.createRun({ id: runId, tenant: "t1" }));
});

// A send driven by a script, which THROWS when it runs out — the honest stand-in
// for a process that stops existing.
function scriptedSend(answers) {
  const calls = [];
  const send = async (req) => {
    calls.push(req);
    const a = answers[calls.length - 1];
    if (a === undefined) throw new Error("the process stopped existing");
    return a;
  };
  send.calls = calls;
  return { send };
}

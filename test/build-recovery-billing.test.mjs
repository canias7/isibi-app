// BUILD RECOVERY AND BILLING, CLOSED TOGETHER (2026-10-08, Codex's review of
// `3308d51d`).
//
// Codex reproduced four gaps offline with the real modules and the Worker's
// own functions under controlled dependencies; each is reproduced here the
// same way, then held:
//
//   A  a STAGED version's manifest names its job before any activation, so a
//      manifest is staging evidence, never proof of publication — only a
//      durable record of a successful activation is
//   B  the fence's outcome writes are conditional and monotonic: a failure
//      read before a success, written after it, cannot erase the publish,
//      and neither write takes a fence from recovery
//   C  a queued build's every debit goes through the one transactional path
//      (`build_debit`, row-locked), whatever its token, so no debit lands
//      after the row is terminal; the SQL stays an unapplied proposal
//   D  the lost-build scan makes resumable progress through both listings:
//      past 20 fresh rows, past 50 pending entries, through outages and
//      interrupted pages, and nothing unsettled ages out
//
// No paid call, no container, no live data. The record is
// docs/history/2026-10-08-build-batch-3.md.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBucket, BUILD_USER } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { lostBuildVerdict } from "../builder/build-lease.mjs";
import { resultKey, jobKey, packJob } from "../builder/build-job.mjs";
import { stageBuild, activateBuild, listBuilds, readPointer, pruneBuilds } from "../site-builds.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const SLUG = "harbour-loaf";
const ID = "b1b2c3d4e5f60718293a4b5c6d7e8f90";
const OTHER = "e1b2c3d4e5f60718293a4b5c6d7e8f90";
const V1 = "01791417187002-f821gr";
const V2 = "01791429280760-09n7s1";
const V3 = "01791431000000-a1b2c3";
const FENCE = "jobs/" + ID + ".fence.json";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/** The site-builds deps over a test bucket, the shape `buildDeps(env)` gives. */
function depsOf(b) {
  return {
    get: (k) => b.get(k),
    put: (k, v, ct, onlyIf) => b.put(k, v, onlyIf ? { onlyIf } : undefined),
    remove: (k) => b.delete(k),
    list: async (prefix) => (await b.list({ prefix })).objects,
  };
}

function stubRpc(answers, seen) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
      seen.push({ fn: m[1], args });
      const a = answers[m[1]];
      if (a === undefined) return json({ message: "no function" }, 404);
      const v = typeof a === "function" ? a(args) : a;
      return v instanceof Response ? v : json(v);
    }
    if (answers.__rest) { const r = answers.__rest(u, init); if (r) return r; }
    return json([]);
  };
  return () => { globalThis.fetch = real; };
}

// ── A: staging is not publication ──────────────────────────────────────────

async function stagedOnly() {
  const b = buildBucket();
  const deps = depsOf(b);
  const st = await stageBuild(deps, { slug: SLUG, version: V2, files: { "index.html": { t: "x" } }, state: { pages: "[]", parts: "[]", config: "{}", sidecar: "{}", kit: "[]" }, manifest: { job: ID, at: Date.parse("2026-10-08T11:05:00Z") } });
  assert.ok(st && st.ok !== false, "the real stage did not stage: " + JSON.stringify(st));
  return { b, deps };
}

test("A: a version STAGED for the job and never activated — pointer none, recovery holding the fence — is not read as published", async () => {
  const { deps } = await stagedOnly();
  const builds = await listBuilds(deps, SLUG);
  assert.ok(builds.some((x) => x.id === V2 && x.job === ID), "the staged manifest does not name the job, so this proves nothing");
  const row = { id: ID, slug: SLUG, created_at: "2026-10-08T11:00:00Z" };
  const fence = { owner: "recovery", mine: true };
  const legacy = lostBuildVerdict({ row, pointer: null, builds, fence });
  assert.notEqual(legacy.outcome, "published", "a staged manifest was read as publication: " + JSON.stringify(legacy));
  assert.equal(legacy.outcome, "unknown", "an unfenced job's staging, with no record of activation, is not decidable");
  const fenced = lostBuildVerdict({ row, pointer: null, builds, fence, fencedJob: true });
  assert.equal(fenced.outcome, "not-published", "a fenced job recovery holds cannot have activated");
});

test("A: a crash between the pointer write and the publish record is unknown — and stays unknown after a later edit moves the pointer and the version is pruned", () => {
  const row = { id: ID, slug: SLUG, created_at: "2026-10-08T11:00:00Z" };
  const claimed = { owner: "publish", mine: false };
  // the pointer names the job, nothing recorded the activation's end
  assert.equal(lostBuildVerdict({ row, pointer: { version: V2, job: ID }, builds: [{ id: V2, job: ID, at: 1 }], fence: claimed, fencedJob: true }).outcome, "unknown");
  // a later edit moved the pointer; the job's manifest is still listed
  assert.equal(lostBuildVerdict({ row, pointer: { version: V3, job: OTHER }, builds: [{ id: V2, job: ID, at: 1 }, { id: V3, job: OTHER, at: 2 }], fence: claimed, fencedJob: true }).outcome, "unknown");
  // and then pruned away
  assert.equal(lostBuildVerdict({ row, pointer: { version: V3, job: OTHER }, builds: [{ id: V3, job: OTHER, at: 2 }], fence: claimed, fencedJob: true }).outcome, "unknown");
});

test("A: a failed activation that rolled the pointer back is not published; one whose rollback left the pointer on the job is unknown", () => {
  const row = { id: ID, slug: SLUG, created_at: "2026-10-08T11:00:00Z" };
  const failed = { owner: "publish", mine: false, failed: true };
  const staged = [{ id: V2, job: ID, at: 1 }];
  assert.equal(lostBuildVerdict({ row, pointer: { version: V1, job: null }, builds: staged, fence: failed, fencedJob: true }).outcome, "not-published");
  assert.equal(lostBuildVerdict({ row, pointer: null, builds: staged, fence: failed, fencedJob: true }).outcome, "not-published");
  assert.equal(lostBuildVerdict({ row, pointer: { version: V2, job: ID }, builds: staged, fence: failed, fencedJob: true }).outcome, "unknown", "a pointer still on the job after a 'failed' record was read as decided");
});

test("A: a real activation that completed and was recorded is published — through a later edit and through pruning", async () => {
  const { markPublished, claimBuildFence } = await loadWorkerModule();
  const { b, deps } = await stagedOnly();
  const env = { SITES_BUCKET: b };
  assert.equal((await claimBuildFence(env, ID, "publish")).owner, "publish");
  const act = await activateBuild(deps, { slug: SLUG, version: V2, job: ID, expectEtag: null, putWorker: async () => ({ ok: true }) });
  assert.equal(act.ok, true, JSON.stringify(act));
  await markPublished(env, ID, V2);
  // a later edit publishes over it, and the build's version is pruned
  await stageBuild(deps, { slug: SLUG, version: V3, files: { "index.html": { t: "y" } }, state: { pages: "[]", parts: "[]", config: "{}", sidecar: "{}", kit: "[]" }, manifest: { job: OTHER, at: 3 } });
  const before = await readPointer(deps, SLUG);
  assert.equal((await activateBuild(deps, { slug: SLUG, version: V3, job: OTHER, expectEtag: before.etag, previous: before, putWorker: async () => ({ ok: true }) })).ok, true);
  await pruneBuilds(deps, { slug: SLUG, keep: [V3], cap: 1 });
  const builds = await listBuilds(deps, SLUG);
  assert.ok(!builds.some((x) => x.id === V2), "the build's version was not pruned, so pruning is not exercised");
  const fence = await claimBuildFence(env, ID, "recovery");
  const v = lostBuildVerdict({ row: { id: ID, slug: SLUG }, pointer: await readPointer(deps, SLUG), builds, fence, fencedJob: true });
  assert.equal(v.outcome, "published");
  assert.equal(v.version, V2);
});

// ── B: conditional, monotonic outcome writes ───────────────────────────────

test("B: a failure that read the fence before a success was written, and writes after it, does not erase the publish", async () => {
  const { markPublished, markPublishFailed } = await loadWorkerModule();
  let once = true;
  let env;
  const b = buildBucket({ [FENCE]: JSON.stringify({ by: "publish" }) }, {
    beforePut: async (k, v) => {
      // THE INTERLEAVING: the failure has read the fence; the success lands now.
      if (k === FENCE && once && String(v).includes('"failed":true')) { once = false; await markPublished(env, ID, V2); }
    },
  });
  env = { SITES_BUCKET: b };
  await markPublishFailed(env, ID);
  assert.equal(once, false, "the interleaving never happened, so this proves nothing");
  const f = JSON.parse(b.store.get(FENCE));
  assert.equal(f.published, V2, "the late failure write erased the confirmed publish: " + b.store.get(FENCE));
  assert.notEqual(f.failed, true);
});

test("B: a success that read the fence before a failure was written still records its publish (publication outranks a failure)", async () => {
  const { markPublished, markPublishFailed } = await loadWorkerModule();
  let once = true;
  let env;
  const b = buildBucket({ [FENCE]: JSON.stringify({ by: "publish" }) }, {
    beforePut: async (k, v) => { if (k === FENCE && once && String(v).includes('"published"')) { once = false; await markPublishFailed(env, ID); } },
  });
  env = { SITES_BUCKET: b };
  await markPublished(env, ID, V2);
  assert.equal(once, false);
  assert.equal(JSON.parse(b.store.get(FENCE)).published, V2);
});

test("B: neither outcome write takes the fence from recovery, and an unreadable fence is left alone", async () => {
  const { markPublished, markPublishFailed } = await loadWorkerModule();
  const b = buildBucket({ [FENCE]: JSON.stringify({ by: "recovery" }) });
  await markPublished({ SITES_BUCKET: b }, ID, V2);
  await markPublishFailed({ SITES_BUCKET: b }, ID);
  assert.deepEqual(JSON.parse(b.store.get(FENCE)), { by: "recovery" }, "an outcome write overwrote recovery's claim");
  // recovery claiming between a success's read and its write
  let once = true;
  let b2;
  b2 = buildBucket({ [FENCE]: JSON.stringify({ by: "publish" }) }, {
    beforePut: async (k, v) => { if (k === FENCE && once && String(v).includes('"published"')) { once = false; b2.store.delete(FENCE); await b2.put(FENCE, JSON.stringify({ by: "recovery" }), { onlyIf: { etagDoesNotMatch: "*" } }); } },
  });
  await markPublished({ SITES_BUCKET: b2 }, ID, V2);
  assert.equal(JSON.parse(b2.store.get(FENCE)).by, "recovery", "a stale success write took the fence from recovery");
  const blind = buildBucket({ [FENCE]: JSON.stringify({ by: "publish", published: V1 }) });
  blind.get = async () => { throw new Error("r2 down"); };
  await markPublishFailed({ SITES_BUCKET: blind }, ID);
  await markPublished({ SITES_BUCKET: blind }, ID, V2);
  assert.equal(JSON.parse(blind.store.get(FENCE)).published, V1, "an unreadable fence was overwritten");
});

test("B: two duplicate deliveries' failures and successes in every order end published exactly once, with the first version kept", async () => {
  const { markPublished, markPublishFailed } = await loadWorkerModule();
  const orders = [["fail", "ok", "fail"], ["ok", "fail", "ok2"], ["fail", "fail", "ok"], ["ok", "ok2"]];
  for (const order of orders) {
    const b = buildBucket({ [FENCE]: JSON.stringify({ by: "publish" }) });
    const env = { SITES_BUCKET: b };
    for (const step of order) {
      if (step === "fail") await markPublishFailed(env, ID);
      else await markPublished(env, ID, step === "ok" ? V2 : V3);
    }
    const f = JSON.parse(b.store.get(FENCE));
    assert.equal(f.published, order.includes("ok") ? V2 : V3, order.join(",") + ": " + b.store.get(FENCE));
    assert.equal(f.by, "publish");
  }
});

// ── C: one transactional billing path for a queued build ───────────────────

const LIVE_ROW = (state = "claimed") => (u) => (u.includes("/rest/v1/edit_jobs") ? json([{ id: ID, uid: BUILD_USER.id, op: "build", state }]) : null);
const ENV = { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" };

test("C: a queued build with a VALID bearer debits through build_debit, never straight through credit_debit", async () => {
  const { buildLedger } = await loadWorkerModule();
  const seen = [];
  const restore = stubRpc({ credit_debit: { ok: true, taken: 2, balance: 5 }, build_debit: { ok: true, taken: 2, balance: 5, repeat: false }, __rest: LIVE_ROW() }, seen);
  try {
    const d = await buildLedger(ENV, { auth: "Bearer live", uid: BUILD_USER.id, jobId: ID }).debit(2, "build:" + ID + ":pages", "debit", true);
    assert.equal(d.taken, 2);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit"], "a valid bearer bypassed the transactional path: " + seen.map((x) => x.fn).join(","));
  } finally { restore(); }
});

test("C: the row going terminal between a state read and the debit cannot let a charge land — the debit is decided by build_debit's own locked read", async () => {
  const { buildLedger } = await loadWorkerModule();
  // THE RACE CODEX REPRODUCED: the Worker's read sees a live row; by the time
  // the debit is asked the sweep has marked it lost. build_debit (locked)
  // refuses; nothing reaches credit_debit.
  let reads = 0;
  const seen = [];
  const restore = stubRpc({
    credit_debit: { ok: true, taken: 2, balance: 5 },
    build_debit: () => ({ ok: false, error: "terminal", state: "lost", taken: 0 }),
    __rest: (u) => (u.includes("/rest/v1/edit_jobs") ? (reads++, json([{ id: ID, uid: BUILD_USER.id, op: "build", state: "claimed" }])) : null),
  }, seen);
  try {
    await assert.rejects(() => buildLedger(ENV, { auth: "Bearer live", uid: BUILD_USER.id, jobId: ID }).debit(2, "build:" + ID + ":settle"), (e) => e.jobState === "lost");
    assert.ok(!seen.some((x) => x.fn === "credit_debit"), "a charge went through the token after the row was terminal");
  } finally { restore(); }
});

test("C: duplicate delivery answers repeat; a lost build_debit answer is never charged a second way; an absent function keeps the reviewed fallback", async () => {
  const { buildLedger } = await loadWorkerModule();
  const who = { auth: "Bearer live", uid: BUILD_USER.id, jobId: ID };
  let seen = [];
  let restore = stubRpc({ build_debit: { ok: true, repeat: true, taken: 0, prior: 2 }, __rest: LIVE_ROW() }, seen);
  try {
    const d = await buildLedger(ENV, who).debit(2, "build:" + ID + ":pages");
    assert.equal(d.repeat, true);
    assert.equal(d.prior, 2);
  } finally { restore(); }
  seen = [];
  restore = stubRpc({ credit_debit: { ok: true, taken: 2 }, build_debit: new Response("timeout", { status: 504 }), __rest: LIVE_ROW() }, seen);
  try {
    await assert.rejects(() => buildLedger(ENV, who).debit(2, "build:" + ID + ":pages"), /build_debit/);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit"], "a debit that may have landed was charged a second way");
  } finally { restore(); }
  // NOT APPLIED YET: 404, and the reviewed fallback (state read, then the bearer).
  seen = [];
  restore = stubRpc({ credit_debit: { ok: true, taken: 2, balance: 5 }, __rest: LIVE_ROW() }, seen);
  try {
    assert.equal((await buildLedger(ENV, who).debit(2, "build:" + ID + ":pages")).taken, 2);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit", "credit_debit"]);
  } finally { restore(); }
  // A BUILD WITH NO ROW (build_debit answers no-job) keeps the fallback too.
  seen = [];
  restore = stubRpc({ credit_debit: { ok: true, taken: 2 }, build_debit: { ok: false, error: "no-job" }, __rest: (u) => (u.includes("/rest/v1/edit_jobs") ? json([]) : null) }, seen);
  try {
    assert.equal((await buildLedger(ENV, who).debit(2, "build:" + ID + ":pages")).taken, 2);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit", "credit_debit"]);
  } finally { restore(); }
});

test("C: an answer that is not the ledger's shape is unanswered, never 'nothing taken', and never charged a second way", async () => {
  const { buildLedger } = await loadWorkerModule();
  for (const shape of [[], {}, { taken: 2 }, "ok"]) {
    const seen = [];
    const restore = stubRpc({ credit_debit: { ok: true, taken: 2 }, build_debit: () => json(shape), __rest: LIVE_ROW() }, seen);
    try {
      await assert.rejects(() => buildLedger(ENV, { auth: "Bearer live", uid: BUILD_USER.id, jobId: ID }).debit(2, "build:" + ID + ":pages"), /build_debit/, JSON.stringify(shape) + " was read as an answer");
      assert.deepEqual(seen.map((x) => x.fn), ["build_debit"], JSON.stringify(shape) + " fell through to the token");
    } finally { restore(); }
  }
});

test("C: the proposed build_debit locks the job row before it reads its state, so the sweep's terminal write and a debit serialize", () => {
  const sql = readFileSync(new URL("../supabase/proposed/build_debit.sql", import.meta.url), "utf8").replace(/--[^\n]*/g, "");
  const lock = sql.search(/select \* into j from public\.edit_jobs where id = p_id for update;/i);
  const terminal = sql.search(/if j\.state in \('lost','failed','cancelled'\)/i);
  const debit = sql.search(/update public\.credits set balance = balance - took/i);
  assert.ok(lock > 0 && terminal > lock && debit > terminal, "the row lock does not precede the state check and the debit");
});

// ── D: the lost-build scan makes progress ──────────────────────────────────

const lost = (i, over = {}) => ({ id: (i.toString(16).padStart(8, "0") + "c3d4e5f60718293a4b5c6d7e").slice(0, 32), uid: BUILD_USER.id, slug: SLUG, op: "build", state: "lost", created_at: "2026-10-08T10:00:00Z", updated_at: new Date(Date.parse("2026-10-08T10:00:00Z") + i * 1000).toISOString(), ...over });

/** PostgREST over a fixed table: the keyset filter, `id=in.()`, order and limit, as the real API answers them. */
function restOver(rows, log, { down = false } = {}) {
  return (u) => {
    if (!u.includes("/rest/v1/edit_jobs")) return null;
    log.push(decodeURIComponent(u));
    if (down) return new Response("down", { status: 503 });
    const q = new URL(u).searchParams;
    let out = rows.filter((r) => r.op === "build" && r.state === "lost");
    const ids = (q.get("id") || "").match(/^in\.\((.*)\)$/);
    if (ids) out = out.filter((r) => ids[1].split(",").includes(r.id));
    const or = q.get("or");
    if (or) {
      const m = or.match(/^\(updated_at\.gt\."([^"]+)",and\(updated_at\.eq\."([^"]+)",id\.gt\."([^"]*)"\)\)$/);
      assert.ok(m, "the keyset filter is not in the shape PostgREST reads: " + or);
      const at = Date.parse(m[1]);
      out = out.filter((r) => Date.parse(r.updated_at) > at || (Date.parse(r.updated_at) === at && r.id > m[3]));
    }
    const gt = q.get("updated_at");
    if (gt && gt.startsWith("gt.")) out = out.filter((r) => Date.parse(r.updated_at) > Date.parse(gt.slice(3)));
    out.sort((x, y) => (x.updated_at < y.updated_at ? -1 : x.updated_at > y.updated_at ? 1 : x.id < y.id ? -1 : 1));
    const limit = Number(q.get("limit")) || 1000;
    return json(out.slice(0, limit));
  };
}

async function tick(b, rows, { now = Date.parse("2026-10-08T12:00:00Z"), down = false, reverse = () => ({ ok: true, refunded: 1, already: 0, debited: 1, repeat: false }) } = {}) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const seen = [];
  const log = [];
  const restore = stubRpc({ credit_reverse: reverse, __rest: restOver(rows, log, { down }) }, seen);
  try {
    const out = await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", SITES_BUCKET: b }, { now });
    return { out, seen, log, reversedIds: [...new Set(seen.filter((x) => x.fn === "credit_reverse").map((x) => x.args.p_ref.split(":")[1]))] };
  } finally { restore(); }
}
const settle = (b, row) => b.store.set("jobs/" + row.id + ".lost.json", JSON.stringify({ outcome: "not-published", settled: true }));

test("D: 21 fresh lost builds with the first 20 already settled — the 21st is reached within three ticks (Codex's run)", async () => {
  const rows = Array.from({ length: 21 }, (_, i) => lost(i + 1));
  const b = buildBucket();
  for (const r of rows.slice(0, 20)) settle(b, r);
  const reached = [];
  for (let t = 0; t < 3; t++) reached.push(...(await tick(b, rows)).reversedIds);
  assert.ok(reached.includes(rows[20].id), "job 21 was never processed: the scan kept selecting the same settled rows");
  assert.ok(b.store.has("jobs/" + rows[20].id + ".lost.json"), "job 21 was never settled");
  assert.equal(reached.filter((x) => x === rows[20].id).length, 1, "job 21 was refunded twice");
});

test("D: an unsettled fresh row is registered as pending BEFORE it is decided, so a crash mid-decision cannot lose it", async () => {
  const rows = [lost(1)];
  const b = buildBucket();
  // the pointer read throws: the outcome is unknown, and the row must stay findable
  const get = b.get.bind(b);
  b.get = async (k) => { if (k.startsWith("current/")) throw new Error("r2 down"); return get(k); };
  await tick(b, rows);
  assert.ok(b.store.has("recovery/pending/" + rows[0].id));
  // and a pending write that fails stops the page before that row, so the next tick finds it again
  const rows2 = [lost(1), lost(2), lost(3)];
  const b2 = buildBucket();
  const put = b2.put.bind(b2);
  let failOn = "recovery/pending/" + rows2[1].id;
  b2.put = async (k, v, o) => { if (k === failOn) { failOn = null; throw new Error("r2 down"); } return put(k, v, o); };
  const first = await tick(b2, rows2);
  assert.deepEqual(first.reversedIds, [rows2[0].id], "the scan went past a row it could not register: " + first.reversedIds.join(","));
  const second = await tick(b2, rows2);
  assert.deepEqual(second.reversedIds.sort(), [rows2[1].id, rows2[2].id].sort(), "the interrupted page did not resume");
});

test("D: an outage longer than a day loses nothing — the scan resumes from where it stopped, not from the last 24 hours", async () => {
  const rows = [lost(1)];
  const b = buildBucket();
  await tick(b, [], { now: Date.parse("2026-10-08T10:00:00Z") }); // sets the start point
  await tick(b, rows, { now: Date.parse("2026-10-09T00:00:00Z"), down: true });
  await tick(b, rows, { now: Date.parse("2026-10-10T00:00:00Z"), down: true });
  const back = await tick(b, rows, { now: Date.parse("2026-10-11T12:00:00Z") });
  assert.deepEqual(back.reversedIds, [rows[0].id], "a row lost during an outage aged out behind the window");
});

test("D: more than 50 pending entries are all retried — the pending listing pages, resumes, and wraps", async () => {
  const rows = Array.from({ length: 60 }, (_, i) => lost(i + 1, { updated_at: "2026-10-01T00:00:00Z" }));
  const b = buildBucket();
  for (const r of rows) b.store.set("recovery/pending/" + r.id, JSON.stringify({ id: r.id }));
  // PERSISTENT UNKNOWN: every pointer read fails, so nothing settles.
  const get = b.get.bind(b);
  b.get = async (k) => { if (k.startsWith("current/")) throw new Error("r2 down"); return get(k); };
  const asked = new Set();
  for (let t = 0; t < 2; t++) {
    const r = await tick(b, rows);
    for (const q of r.log) { const m = q.match(/id=in\.\(([^)]*)\)/); if (m) m[1].split(",").forEach((x) => asked.add(x)); }
  }
  assert.equal(asked.size, 60, "pending entries past the first 50 were never retried: " + asked.size);
  assert.equal([...b.store.keys()].filter((k) => k.startsWith("recovery/pending/")).length, 60, "a persistent unknown was dropped from the pending list");
});

test("D: a partial refund stays pending and is finished through the pending listing on a later tick, without returning twice", async () => {
  const rows = [lost(1, { updated_at: "2026-10-08T11:00:00Z" })];
  const b = buildBucket();
  let down = true;
  const reverse = () => (down ? new Response("down", { status: 500 }) : { ok: true, refunded: 1, already: 0, debited: 1, repeat: false });
  await tick(b, rows, { reverse });
  assert.ok(b.store.has("recovery/pending/" + rows[0].id), "a short refund was not kept pending");
  down = false;
  const later = await tick(b, rows, { reverse, now: Date.parse("2026-10-12T12:00:00Z") });
  assert.deepEqual(later.reversedIds, [rows[0].id]);
  assert.ok(!b.store.has("recovery/pending/" + rows[0].id), "a settled build stayed pending");
  const again = await tick(b, rows, { reverse, now: Date.parse("2026-10-13T12:00:00Z") });
  assert.deepEqual(again.reversedIds, [], "a settled build was reversed again");
});

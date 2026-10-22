// AUDIT GROUP G1 (2026-10-22): container jobs, the job gateway, publish turns.
//   G1 — a turn wait ended by a stop (the customer's cancel, the container's
//        shutdown) answers as a stop, never as an overlap loss (A37-2, A05-2);
//   G2 — the step that holds the turn from its start answers a failed
//        saved-state check as `read`, never `turn` (A05-2);
//   G3 — a turn given back is never brought back by a renewal, and the
//        give-back is asked again when a renewal moved the etag (A05-3);
//   G4 — the give-back drops the job's turn before it awaits the store (A05-3);
//   G5 — the teardown question is admitted through the gateway's Supabase
//        wall, exactly as `neonTearingDown` asks it and nothing wider (A01-4);
//   G6 — two jobs contend for one site's turn at once, each through the real
//        gateway handler over one store (A05-5).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { gatewayBucketFor } from "./fixtures/job-gateway-wire.mjs";
import { sbDecision } from "../builder/job-gateway.mjs";
import { OVERLAP_LOSSES } from "../builder/request.mjs";
import { turnKey, turnRecord } from "../builder/publish-turn.mjs";

blockNetwork();

const SLUG = "fold-lane";
const heldBy = (owner) => JSON.stringify(turnRecord(owner, Date.now(), "j-other", 1));

test("G1 A TURN WAIT ENDED BY A STOP IS A STOP — the container's shutdown (JOB_STOP) and the customer's cancel each end the wait at once with their own code, never one the driver re-runs as an overlap", async () => {
  const { siteTurn } = await loadWorkerModule();
  const held = heldBy("job:other:u");
  const bucket = { get: async () => ({ text: async () => held, etag: "e1", uploaded: new Date() }), put: async () => null };
  const stop = new AbortController(); stop.abort();
  const env = { PUBLISH_TURN_POLL_MS: "2", PUBLISH_TURN_WAIT_MS: "60000", JOB_STOP: stop, SITES_BUCKET: bucket };
  const job = { id: "j1", owner: "u", beside: {}, cancelled: () => false, budget: { expired: () => false } };
  const out = await Promise.race([siteTurn.takeTurn(env, SLUG, job), new Promise((r) => setTimeout(() => r("still waiting"), 2000))]);
  assert.equal(out, null, "a stopped job kept waiting for the turn");
  const s = siteTurn.turnStop(job.beside);
  assert.ok(s, "a stopped wait fell through to the overlap answer");
  assert.equal(s.error, "stopped");
  assert.ok(!OVERLAP_LOSSES.includes(s.error));

  const env2 = { PUBLISH_TURN_POLL_MS: "2", PUBLISH_TURN_WAIT_MS: "60000", SITES_BUCKET: bucket };
  const job2 = { id: "j2", owner: "u", beside: {}, cancelled: () => true, budget: { expired: () => false } };
  assert.equal(await siteTurn.takeTurn(env2, SLUG, job2), null);
  const c = siteTurn.turnStop(job2.beside);
  assert.ok(c && c.error === "cancelled", "a cancelled wait is not answered as cancelled");
  assert.ok(!OVERLAP_LOSSES.includes(c.error));
  assert.doesNotMatch(c.msg, /another change/i);
});

test("G2 THE STEP THAT HOLDS THE TURN ANSWERS A FAILED SAVED-STATE CHECK AS `read` — between its own stops and the overlap answer, a turn it holds with the check failed is never `turn`", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("} else if (heldStop) {");
  const b = src.indexOf('res = Response.json({ ok: false, error: "turn", ours: true, cost: 0, unchanged: true', a);
  assert.ok(a > 0 && b > a, "the hold-from-start branch's landmarks are not where they were");
  const between = src.slice(a, b);
  assert.match(between, /jctx\.beside\.turn && !jctx\.beside\.lost && \(!heldSt \|\| heldSt\.ok !== true\)\) \{[\s\S]*?error: "read"/, "a failed saved-state check under a held turn is answered as an overlap");
  assert.match(between, /msg: heldStop\.msg \|\|/, "a stop's own sentence is not used");
});

test("G3 A TURN GIVEN BACK IS NEVER BROUGHT BACK — a renewal after the give-back answers no and leaves it free; a give-back whose put lost to a renewal is asked again", async () => {
  const { siteTurn } = await loadWorkerModule();
  const bucket = mediaBucket();
  const env = { SITES_BUCKET: bucket };
  const t = await siteTurn.tryTurn(env, SLUG, "job:a:u", "a");
  assert.ok(t, "the free turn was not taken");
  await siteTurn.giveTurn(env, SLUG, t);
  assert.equal(await siteTurn.renewTurn(env, SLUG, t), false, "a renewal brought back a turn already given back");
  assert.equal(JSON.parse(new TextDecoder().decode(bucket.raw(turnKey(SLUG)))).until, 0, "the given-back turn is held again");
  const b = await siteTurn.tryTurn(env, SLUG, "job:b:u", "b");
  assert.ok(b, "a sibling cannot take the given-back turn");
  await siteTurn.giveTurn(env, SLUG, b);

  // THE RACE: a renewal lands between the give-back's read and its put.
  const bucket2 = mediaBucket({ hooks: {} });
  const env2 = { SITES_BUCKET: bucket2 };
  const t2 = await siteTurn.tryTurn(env2, SLUG, "job:c:u", "c");
  let raced = false;
  const put = bucket2.put.bind(bucket2);
  bucket2.put = async (key, value, opts = {}) => {
    if (!raced && key === turnKey(SLUG) && /"until":0/.test(String(value))) {
      raced = true;
      await new Promise((r) => setTimeout(r, 2));
      await put(key, JSON.stringify(turnRecord("job:c:u", Date.now() + 5, "c", t2.gen)), { onlyIf: { etagMatches: bucket2.store.get(key).etag } });
    }
    return put(key, value, opts);
  };
  await siteTurn.giveTurn(env2, SLUG, t2);
  assert.ok(raced, "the race was not staged");
  assert.equal(JSON.parse(new TextDecoder().decode(bucket2.raw(turnKey(SLUG)))).until, 0, "a give-back that lost to a renewal left the turn held");
});

test("G4 THE GIVE-BACK DROPS THE JOB'S TURN BEFORE IT AWAITS THE STORE — the queued job's finally and publishBeside both, so a heartbeat in flight finds nothing to renew", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /if \(jctx\.beside && jctx\.beside\.turn\) \{ const given = jctx\.beside\.turn; jctx\.beside\.turn = null; await giveTurn\(env, job\.slug, given\); \}/);
  assert.match(src, /if \(mine\) \{ bs\.turn = null; await giveTurn\(env, slug, t\); \}/);
  assert.doesNotMatch(src, /await giveTurn\(env, job\.slug, jctx\.beside\.turn\); jctx\.beside\.turn = null;/);
});

test("G5 THE TEARDOWN QUESTION PASSES THE WALL EXACTLY AS IT IS ASKED — one project id, select=id, limit=1; a wider read, a list, another column or method is refused", () => {
  const JOB = { id: "job-1234", slug: "fretwork-1", uid: "11111111-2222-3333-4444-555555555555" };
  const PRE = { ...JOB, pre: true };
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // The Worker's own query, held to the shape admitted.
  assert.match(src, /neon_teardown\?project_id=eq\.\$\{encodeURIComponent\(String\(projectId \|\| ""\)\)\}&select=id&limit=1`/);
  const q = (pid) => "project_id=eq." + pid + "&select=id&limit=1";
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/neon_teardown", q("dry-cherry-12345678"), "", "m"), { ok: true, body: undefined });
  assert.equal(sbDecision(PRE, "GET", "/rest/v1/neon_teardown", q("dry-cherry-12345678"), "", "m").ok, true);
  for (const bad of ["", "select=id", "select=id&limit=1", "project_id=eq.dry-cherry-1&select=*&limit=1", "project_id=eq.dry-cherry-1&select=id&limit=2",
    "project_id=eq.dry-cherry-1&select=id", "project_id=neq.x&select=id&limit=1", "project_id=eq.a&project_id=eq.b&select=id&limit=1",
    "project_id=eq.dry-cherry-1&select=id&limit=1&order=id.asc", "project_id=in.(a,b)&select=id&limit=1", "project_id=eq.Dry_Cherry&select=id&limit=1"]) {
    assert.equal(sbDecision(JOB, "GET", "/rest/v1/neon_teardown", bad, "", "m").ok, false, "admitted: " + bad);
  }
  for (const m of ["POST", "PATCH", "DELETE"]) assert.deepEqual(sbDecision(JOB, m, "/rest/v1/neon_teardown", q("dry-cherry-1"), "{}", "m"), { ok: false, why: "method" });
});

test("G6 TWO JOBS CONTEND FOR ONE SITE'S TURN THROUGH THE REAL GATEWAY — the second waits while the first holds and renews it, takes it once given back, and the first's late renewal is refused; nothing is refused by the wall", async () => {
  const { siteTurn } = await loadWorkerModule();
  const store = mediaBucket({ lag: true });
  const A = await gatewayBucketFor({ bucket: store, id: "a1b2c3d4e5f60718293a4b5c6d7e8f9a", slug: SLUG });
  const B = await gatewayBucketFor({ bucket: store, id: "b1b2c3d4e5f60718293a4b5c6d7e8f9b", slug: SLUG });
  const envOf = (g) => ({ SITES_BUCKET: g.bucket, PUBLISH_TURN_POLL_MS: "5", PUBLISH_TURN_WAIT_MS: "10000" });
  const jobA = { id: "a1b2c3d4e5f60718293a4b5c6d7e8f9a", owner: "u", beside: {}, cancelled: () => false, budget: { expired: () => false } };
  const jobB = { id: "b1b2c3d4e5f60718293a4b5c6d7e8f9b", owner: "u", beside: {}, cancelled: () => false, budget: { expired: () => false } };
  const [tA, early] = await Promise.all([siteTurn.takeTurn(envOf(A), SLUG, jobA), new Promise((r) => setTimeout(r, 1))]);
  void early;
  assert.ok(tA, "the first job did not take the free turn through the gateway");
  let bDone = false;
  const pB = siteTurn.takeTurn(envOf(B), SLUG, jobB).then((t) => { bDone = true; return t; });
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(bDone, false, "the second job took a turn the first holds");
  assert.ok(jobB.beside.waits > 0, "the second job never asked again through the gateway");
  assert.equal(await siteTurn.renewTurn(envOf(A), SLUG, tA), true, "the holder's renewal under contention was refused");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(bDone, false);
  jobA.beside.turn = null;
  await siteTurn.giveTurn(envOf(A), SLUG, tA);
  const tB = await Promise.race([pB, new Promise((r) => setTimeout(() => r("still waiting"), 3000))]);
  assert.ok(tB && tB.owner === "job:" + jobB.id + ":u", "the second job never got the turn once it was given back");
  assert.ok(tB.gen > tA.gen, "the second holder's fence is not larger than the first's");
  assert.equal(await siteTurn.renewTurn(envOf(A), SLUG, tA), false, "the first job's late renewal took the turn back");
  assert.equal(JSON.parse(new TextDecoder().decode(store.raw(turnKey(SLUG)))).owner, tB.owner);
  assert.deepEqual([...A.refused, ...B.refused], [], "the wall refused a turn call");
  assert.ok(B.calls.filter((c) => c.method === "GET").length > 2, "the second job's polls did not go through the gateway");
  await siteTurn.giveTurn(envOf(B), SLUG, tB);
});

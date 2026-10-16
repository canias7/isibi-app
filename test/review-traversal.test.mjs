// THE REVIEW RECONCILE REACHES EVERY ROW (2026-10-16, Codex's review of
// `82259f1e`).
//
// `runReviewReconcile` read the 20 oldest rows under review every tick; an
// unresolved row changes only its schedule in R2, never its row, so the same
// 20 held every pass, deferred or not. Codex: 21 review jobs, the oldest 20
// with unreadable draft evidence, the 21st with a valid saved draft — nine
// passes never reached the 21st, while `reconcileEditJob` called directly
// settled it as `draft-saved` at once, without publishing.
//
// The walk is now a durable keyset cursor over (updated_at, id). These cases
// run the real `runReviewReconcile` and `reconcileEditJob` against a store of
// real draft saves and a job table answered as PostgREST answers it (its
// filters, its keyset, its order, its limit), Edit and Add-on jobs mixed:
//
//   RVT1  Codex's case: the 21st is reached on the second pass and kept as a
//         saved draft — committed once, nothing published; the 20 stay in
//         review, scheduled, never refunded; a duplicate pass at the same
//         moment reconciles nothing again.
//   RVT2  more than one page with equal timestamps across the page boundary
//         and a row changing mid-walk: every recoverable row is reached, none
//         twice in a lap.
//   RVT3  a restart (the cursor gone, or unreadable) starts from the front:
//         deferred rows are not asked before their time, nothing is lost.
//   RVT4  the evidence restored: every waiting row is settled once, when due,
//         within a bounded number of passes; nothing live moves.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { buildBucket, BUILD_USER } from "./fixtures/build-route.mjs";
import { stageBuild, activateBuild } from "../site-builds.mjs";
import { saveAsDraft, DRAFT_KEY } from "../site-draft.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const MIN = 60 * 1000;
function depsOf(b) {
  return { get: (k) => b.get(k), put: (k, v, ct, onlyIf) => b.put(k, v, onlyIf ? { onlyIf } : undefined), remove: (k) => b.delete(k), list: async (prefix) => (await b.list({ prefix })).objects };
}
const STATE = { pages: "[]", parts: "[]", config: "{}", sidecar: "{}", kit: "[]" };
const idOf = (n) => n.toString(16).padStart(4, "0") + "c0ffee00112233445566778899aa".slice(0, 28);

/** A job that stopped after its draft record: staged, saved as a draft revision of its own. */
async function savedJob(b, slug, id, n) {
  const version = "0179" + String(1000000000 + n).padStart(10, "0") + "-" + (n.toString(36) + "abcdef").slice(0, 6);
  await stageBuild(depsOf(b), { slug, version, files: { "index.html": { t: "x" } }, state: STATE, manifest: { job: id, at: 1 } });
  const act = await activateBuild(depsOf(b), { slug, version, job: id, expectEtag: null, asDraft: saveAsDraft, putWorker: async () => ({ ok: true }) });
  assert.equal(act.ok, true, JSON.stringify(act));
  return version;
}

/** The job table, answered as PostgREST answers the reads and RPCs the reconcile makes. */
function jobTable(rows) {
  const calls = { reconcile: [], finalize: [], reads: [] };
  const answer = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const a = JSON.parse(String((init && init.body) || "{}"));
      const row = rows.find((r) => r.id === a.p_id);
      if (m[1] === "edit_reconcile") {
        calls.reconcile.push({ id: a.p_id, committed: a.p_committed });
        if (!row || !row.needs_review) return json({ ok: false, error: "not-in-review" });
        row.needs_review = false; row.state = a.p_committed ? "done" : "failed"; row.billing = a.p_committed ? "finalized" : "refunded";
        row.updated_at = new Date(Date.parse(row.updated_at) + 1).toISOString();
        return json({ ok: true, outcome: a.p_committed ? "kept" : "refunded", refunded: a.p_committed ? 0 : 1 });
      }
      if (m[1] === "edit_finalize") { calls.finalize.push(a.p_id); if (row) row.result = a.p_result; return json({ ok: true }); }
      return json({ ok: true });
    }
    if (u.includes("/rest/v1/edit_jobs")) {
      const q = new URL(u).searchParams;
      calls.reads.push(u);
      let out = rows.slice();
      if (q.get("needs_review") === "eq.true") out = out.filter((r) => r.needs_review);
      const id = q.get("id"); if (id && id.startsWith("eq.")) out = out.filter((r) => r.id === id.slice(3));
      const kq = /^\(updated_at\.gt\."([^"]*)",and\(updated_at\.eq\."([^"]*)",id\.gt\."([^"]*)"\)\)$/.exec(q.get("or") || "");
      if (kq) out = out.filter((r) => r.updated_at > kq[1] || (r.updated_at === kq[1] && r.id > kq[3]));
      const keys = String(q.get("order") || "").split(",").map((s) => /^([a-z_]+)\.(asc|desc)$/.exec(s)).filter(Boolean);
      out.sort((a, b) => { for (const o of keys) { const d = (a[o[1]] > b[o[1]] ? 1 : a[o[1]] < b[o[1]] ? -1 : 0) * (o[2] === "desc" ? -1 : 1); if (d) return d; } return 0; });
      const lim = Number(q.get("limit")); if (lim > 0) out = out.slice(0, lim);
      return json(out.map((r) => ({ ...r })));
    }
    return json([]);
  };
  return { answer, calls };
}

/** 20 jobs whose drafts cannot be read (each its own site), then the recoverable ones. */
async function fixture({ unresolved = 20, recoverable = 1, sameStampFrom = null } = {}) {
  const b = buildBucket();
  const rows = [];
  const broken = new Map();
  const base = Date.parse("2026-10-08T11:00:00.000Z");
  let n = 0;
  const add = async (kind) => {
    const i = n++;
    const id = idOf(i + 1);
    const slug = "rvt-site-" + i;
    await savedJob(b, slug, id, i + 1);
    if (kind === "unreadable") { broken.set(slug, b.store.get(DRAFT_KEY(slug))); b.store.set(DRAFT_KEY(slug), "{broken"); }
    const stamp = sameStampFrom !== null && i >= sameStampFrom ? base + sameStampFrom * MIN : base + i * MIN;
    rows.push({ id, uid: BUILD_USER.id, slug, op: i % 3 === 2 ? "addon" : "edit", state: "publishing", phase: null, cost: 2, billing: "reserved", needs_review: true, review_note: "died during publish", artifact_build: null, worker_status: null, publish_started_at: new Date(base).toISOString(), published_at: null, result: null, updated_at: new Date(stamp).toISOString(), kind });
  };
  for (let i = 0; i < unresolved; i++) await add("unreadable");
  for (let i = 0; i < recoverable; i++) await add("saved");
  return { b, rows, broken, restore: () => { for (const [slug, body] of broken) b.store.set(DRAFT_KEY(slug), body); } };
}
async function pass(mod, b, table, now) {
  const real = globalThis.fetch;
  globalThis.fetch = table.answer;
  try { return await mod.runReviewReconcile({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now }); }
  finally { globalThis.fetch = real; }
}
const T0 = Date.parse("2026-10-08T12:00:00Z");
const committedOnce = (calls, id) => calls.reconcile.filter((c) => c.id === id && c.committed === true).length === 1;
const refundsOf = (calls) => calls.reconcile.filter((c) => c.committed === false);

test("RVT1 CODEX'S CASE — 20 unreadable jobs ahead of a 21st with a valid saved draft: the 21st is reached on the second pass and kept as a saved draft, committed once, nothing published; the 20 stay in review, scheduled, never refunded; a duplicate pass reconciles nothing again", async () => {
  const mod = await loadWorkerModule();
  const { b, rows } = await fixture();
  const table = jobTable(rows);
  const last = rows[20];
  await pass(mod, b, table, T0);
  assert.equal(last.needs_review, true, "the 21st was reached on the first pass — this case tests nothing");
  await pass(mod, b, table, T0 + MIN);
  assert.equal(last.needs_review, false, "the 21st was never reached");
  assert.ok(committedOnce(table.calls, last.id), "the 21st was not kept exactly once: " + JSON.stringify(table.calls.reconcile));
  assert.equal(JSON.parse(last.result.body).reconciled, "draft-saved");
  assert.ok(rows.slice(0, 20).every((r) => r.needs_review), "an unresolved job left review");
  assert.deepEqual(refundsOf(table.calls), [], "an unresolved job was refunded");
  assert.ok(rows.slice(0, 20).every((r) => b.store.has("recovery/review/" + r.id + ".json")), "an unresolved job has no schedule");
  // A DUPLICATE PASS AT THE SAME MOMENT, AND ANOTHER.
  const before = table.calls.reconcile.length;
  await pass(mod, b, table, T0 + MIN);
  await pass(mod, b, table, T0 + MIN);
  assert.equal(table.calls.reconcile.filter((c) => c.id === last.id).length, 1, "the 21st was reconciled again");
  assert.equal(table.calls.reconcile.length, before, "a not-yet-due job was asked again");
  // NOTHING LIVE.
  assert.equal([...b.store.keys()].filter((k) => k.startsWith("current/")).length, 0, "something went live without Publish");
});

test("RVT2 MORE THAN ONE PAGE, EQUAL TIMESTAMPS ACROSS THE BOUNDARY, A ROW CHANGING MID-WALK — every recoverable row is reached within a lap and none is reconciled twice", async () => {
  const mod = await loadWorkerModule();
  // 25 unreadable, then 12 recoverable; rows 18 onward share one timestamp.
  const { b, rows } = await fixture({ unresolved: 25, recoverable: 12, sameStampFrom: 18 });
  const table = jobTable(rows);
  // A ROW CHANGES MID-WALK: after the first pass, an early unresolved row's
  // timestamp moves past everything (touched by another process).
  await pass(mod, b, table, T0);
  rows[2].updated_at = new Date(Date.parse("2026-10-08T13:00:00Z")).toISOString();
  for (let i = 1; i < 4; i++) await pass(mod, b, table, T0 + i * MIN);
  const good = rows.filter((r) => r.kind === "saved");
  assert.ok(good.every((r) => !r.needs_review), "a recoverable row was never reached: " + good.filter((r) => r.needs_review).map((r) => r.id).join(","));
  assert.ok(good.every((r) => committedOnce(table.calls, r.id)), "a recoverable row was not kept exactly once");
  assert.ok(good.some((r) => r.op === "addon") && good.some((r) => r.op === "edit"), "the case does not mix Edit and Add-on jobs");
  assert.deepEqual(refundsOf(table.calls), []);
  assert.ok(rows.filter((r) => r.kind === "unreadable").every((r) => r.needs_review));
});

test("RVT3 A RESTART — the cursor gone, or unreadable: the walk starts from the front; deferred rows are not asked before their time; a recoverable row behind them is still reached", async () => {
  const mod = await loadWorkerModule();
  for (const how of ["gone", "unreadable"]) {
    const { b, rows } = await fixture({ unresolved: 20, recoverable: 1 });
    const table = jobTable(rows);
    await pass(mod, b, table, T0);
    if (how === "gone") b.store.delete("recovery/review-cursor.json");
    else b.store.set("recovery/review-cursor.json", "{not json");
    const asked = table.calls.reconcile.length;
    await pass(mod, b, table, T0 + MIN);
    assert.equal(table.calls.reconcile.length, asked, how + ": a deferred job was asked before its time after the restart");
    await pass(mod, b, table, T0 + MIN);
    assert.equal(rows[20].needs_review, false, how + ": the recoverable row was not reached after the restart");
    assert.ok(committedOnce(table.calls, rows[20].id));
    assert.deepEqual(refundsOf(table.calls), []);
  }
});

test("RVT4 THE EVIDENCE RESTORED — every waiting row is settled once, when due, within a bounded number of passes; never refunded; nothing live moves", async () => {
  const mod = await loadWorkerModule();
  const { b, rows, restore } = await fixture({ unresolved: 20, recoverable: 1 });
  const table = jobTable(rows);
  let t = T0;
  for (let i = 0; i < 3; i++) { await pass(mod, b, table, t); t += MIN; }
  restore();
  let passes = 0;
  while (rows.some((r) => r.needs_review) && passes < 40) { await pass(mod, b, table, t); t += 4 * MIN; passes++; }
  assert.ok(rows.every((r) => !r.needs_review), "rows left in review after the evidence returned: " + rows.filter((r) => r.needs_review).length);
  assert.ok(rows.every((r) => committedOnce(table.calls, r.id)), "a row was not kept exactly once");
  assert.ok(rows.every((r) => JSON.parse(r.result.body).reconciled === "draft-saved"));
  assert.deepEqual(refundsOf(table.calls), []);
  assert.ok(rows.every((r) => !b.store.has("recovery/review/" + r.id + ".json")), "a decided row kept its schedule");
  assert.equal([...b.store.keys()].filter((k) => k.startsWith("current/")).length, 0, "something went live without Publish");
  assert.ok(passes <= 12, "settling took " + passes + " passes");
});

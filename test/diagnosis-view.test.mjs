// The owner's read of a site's recent failed jobs and their stored diagnoses
// (2026-10-24). The real route, over an in-memory bucket and a stubbed
// Supabase: owner allowed, others refused, missing diagnosis null, and no
// ledger or model call on any path.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default;

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

function bucket(objs) {
  const m = new Map(Object.entries(objs || {}));
  const gets = [];
  return {
    gets,
    async get(k) { gets.push(k); return m.has(k) ? { text: async () => m.get(k) } : null; },
    async put() { throw new Error("no write allowed"); },
    async delete() { throw new Error("no delete allowed"); },
  };
}

let n = 0;
function stub({ uid, owner, jobs }) {
  const calls = [];
  globalThis.fetch = async (u) => {
    const s = String(u); calls.push(s);
    if (s.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: uid }), { status: 200 });
    if (s.includes("/rest/v1/site_backends")) return new Response(JSON.stringify(owner ? [{ uid: owner }] : []), { status: 200 });
    if (s.includes("/rest/v1/edit_jobs")) return new Response(JSON.stringify(jobs || []), { status: 200 });
    return new Response("unexpected " + s, { status: 599 });
  };
  return calls;
}
const call = (env, slug, tok = "t") => worker.fetch(new Request("https://gofarther.dev/api/site/diagnoses?slug=" + slug, {
  headers: tok ? { Authorization: "Bearer " + tok } : {},
}), env, { waitUntil() {}, passThroughOnException() {} });
const noSpend = (calls) => {
  assert.ok(calls.length > 0, "the observer saw no call at all");
  for (const c of calls) {
    assert.doesNotMatch(c, /rpc\/|credit|ledger|use_credits|edit_reserve|x\.ai|openai|anthropic|fal\.|openrouter/i, "a spend or model call: " + c);
  }
};

test("the owner reads their failed jobs, newest first, with each diagnosis or null", async () => {
  const slug = "diag-own-" + (++n);
  const jobs = [
    { id: "j2", op: "edit", created_at: "2026-10-24T02:00:00Z", state: "failed", result: { token: "x" } },
    { id: "j1", op: "addon", created_at: "2026-10-24T01:00:00Z", state: "lost" },
  ];
  const calls = stub({ uid: "u1", owner: "u1", jobs });
  const b = bucket({ "jobs/j2.diagnosis.json": JSON.stringify({ cause: "compile" }) });
  const r = await call({ SITES_BUCKET: b }, slug);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(body.jobs, [
    { id: "j2", op: "edit", created_at: "2026-10-24T02:00:00Z", state: "failed", diagnosis: { cause: "compile" } },
    { id: "j1", op: "addon", created_at: "2026-10-24T01:00:00Z", state: "lost", diagnosis: null },
  ]);
  assert.deepEqual(b.gets.sort(), ["jobs/j1.diagnosis.json", "jobs/j2.diagnosis.json"]);
  const q = calls.find((c) => c.includes("/rest/v1/edit_jobs"));
  assert.ok(q, "the jobs were never read");
  assert.match(q, /uid=eq\.u1(&|$)/);
  assert.match(q, new RegExp("slug=eq\\." + slug + "(&|$)"));
  assert.match(q, /order=created_at\.desc/);
  assert.match(q, /limit=20(&|$)/);
  assert.match(q, /state=in\.\(failed/);
  assert.match(q, /select=id,op,created_at,state&/);
  noSpend(calls);
});

test("another user's site answers 404 and reads no jobs or diagnoses", async () => {
  const calls = stub({ uid: "u2", owner: "u1", jobs: [{ id: "j9", op: "edit", state: "failed" }] });
  const b = bucket({ "jobs/j9.diagnosis.json": "{}" });
  const r = await call({ SITES_BUCKET: b }, "diag-other-" + (++n));
  assert.equal(r.status, 404);
  assert.ok(!calls.some((c) => c.includes("edit_jobs")), "jobs read for a non-owner");
  assert.equal(b.gets.length, 0);
  noSpend(calls);
});

test("an unclaimed slug answers 404; signed out answers 401; no slug 400", async () => {
  const calls = stub({ uid: "u1", owner: null });
  assert.equal((await call({ SITES_BUCKET: bucket() }, "diag-none-" + (++n))).status, 404);
  noSpend(calls);
  stub({ uid: "u1", owner: "u1" });
  assert.equal((await call({ SITES_BUCKET: bucket() }, "diag-x-" + (++n), "")).status, 401);
  assert.equal((await call({ SITES_BUCKET: bucket() }, "")).status, 400);
});

test("an unreadable diagnosis is null, not an error", async () => {
  stub({ uid: "u1", owner: "u1", jobs: [{ id: "j3", op: "edit", created_at: "t", state: "failed" }] });
  const r = await call({ SITES_BUCKET: bucket({ "jobs/j3.diagnosis.json": "{not json" }) }, "diag-bad-" + (++n));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).jobs[0].diagnosis, null);
});

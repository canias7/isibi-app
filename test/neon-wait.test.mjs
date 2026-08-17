// Waiting for Neon to finish before touching the thing it is building.
//
// Creating a project or a database returns as soon as the work is SCHEDULED —
// the branch, endpoint and default database are still coming up, and Neon
// refuses further calls against a project while its operations are in flight
// ("already has running conflicting operations"). So every provisioning step
// waits for quiet. Get this wrong in either direction and builds fail
// intermittently: too eager and the next call is rejected, too patient and a
// failed setup surfaces later as a confusing connection error.
//
// It had no tests at all. `neonApi` goes through global fetch, so that is what
// is stubbed here — no Neon account, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForProject } from "../site-db.mjs";

const ENV = { NEON_API_KEY: "key" };

// Serves a scripted sequence of /operations responses, one per poll.
function stubFetch(pages) {
  const calls = [];
  const real = globalThis.fetch;
  let i = 0;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    const page = pages[Math.min(i++, pages.length - 1)];
    if (page instanceof Error) throw page;
    return {
      ok: page.ok !== false,
      status: page.status || 200,
      json: async () => page.body,
      text: async () => JSON.stringify(page.body),
    };
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const ops = (...statuses) => ({ body: { operations: statuses.map((s, n) => ({ action: "create_branch_" + n, status: s })) } });

test("returns immediately when nothing is pending", async () => {
  const f = stubFetch([ops("finished", "finished")]);
  try {
    await waitForProject(ENV, "p1");
    assert.equal(f.calls.length, 1, "one poll is enough when the project is already quiet");
    assert.match(f.calls[0], /\/projects\/p1\/operations$/);
  } finally { f.restore(); }
});

test("an empty operations list is quiet, not a hang", async () => {
  const f = stubFetch([{ body: { operations: [] } }]);
  try { await waitForProject(ENV, "p1"); } finally { f.restore(); }
});

test("a missing operations key is treated as quiet", async () => {
  // Neon's shape is not something we control; an unexpected body must not spin
  // for the full ninety seconds.
  const f = stubFetch([{ body: {} }]);
  try { await waitForProject(ENV, "p1"); } finally { f.restore(); }
});

test("polls until the pending work finishes", async () => {
  const f = stubFetch([ops("running"), ops("scheduling"), ops("finished")]);
  try {
    await waitForProject(ENV, "p1");
    assert.equal(f.calls.length, 3, "it kept asking rather than proceeding into a busy project");
  } finally { f.restore(); }
});

test("every in-flight status counts as pending", async () => {
  // Missing one of these means proceeding while Neon still rejects calls, which
  // surfaces as a build that fails for no visible reason.
  for (const status of ["scheduling", "running", "cancelling"]) {
    const f = stubFetch([ops(status), ops("finished")]);
    try {
      await waitForProject(ENV, "p1");
      assert.equal(f.calls.length, 2, status);
    } finally { f.restore(); }
  }
});

test("a failed operation is surfaced where the cause is obvious", async () => {
  // Otherwise it shows up later as a connection error against a database that
  // never finished being built.
  for (const status of ["failed", "error"]) {
    const f = stubFetch([ops(status)]);
    try {
      await assert.rejects(waitForProject(ENV, "p1"), /neon operation/, status);
    } finally { f.restore(); }
  }
});

test("a failure is only reported once the work is quiet", async () => {
  // While something is still running, a sibling failure is not yet the final
  // word — Neon may still be retrying it.
  const f = stubFetch([ops("running", "failed"), ops("finished", "failed")]);
  try {
    await assert.rejects(waitForProject(ENV, "p1"), /neon operation/);
    assert.equal(f.calls.length, 2, "it waited for quiet before deciding");
  } finally { f.restore(); }
});

test("it gives up rather than blocking a build forever", async () => {
  const f = stubFetch([ops("running")]);
  try {
    await assert.rejects(waitForProject(ENV, "p1", 1), /still busy after/);
  } finally { f.restore(); }
});

test("the timeout message says what it was waiting on", async () => {
  const f = stubFetch([ops("running")]);
  try {
    const e = await waitForProject(ENV, "p1", 1).catch((x) => x);
    assert.match(String(e.detail), /create_branch_0:running/, "a bare timeout is undiagnosable");
  } finally { f.restore(); }
});

test("an API error propagates instead of being read as quiet", async () => {
  // A 401 or a 500 answering "is it busy?" must not be taken for "no".
  const f = stubFetch([{ ok: false, status: 401, body: { message: "unauthorized" } }]);
  try {
    await assert.rejects(waitForProject(ENV, "p1"), /neon api/);
  } finally { f.restore(); }
});

test("a network failure propagates too", async () => {
  const f = stubFetch([new Error("connect ETIMEDOUT")]);
  try {
    await assert.rejects(waitForProject(ENV, "p1"), /ETIMEDOUT/);
  } finally { f.restore(); }
});

// ─── A LOCKED PROJECT IS RETRIED, NOT LOST ────────────────────────────────────
//
// MEASURED LIVE 2026-08-17. A `build smoke` run died at
// `502 upstream:423 "project already has running conflicting operations,
// scheduling of new ones is prohibited"` before the designer's schema could be
// applied, and the whole paid run went with it: 10 passed, 14 failed, not one
// of them about the code under test.
//
// `waitForProject` above already guards this and CANNOT close it. It polls
// after every scheduling call and returns when nothing is pending — but Neon's
// operations list is eventually consistent, so a poll issued immediately after
// a POST can see the work before it is REGISTERED, find nothing, and return
// clean. The next call is refused. Waiting longer up front would slow every
// build on the platform to fix a race that is about ordering, not duration.
//
// RETRYING IS SAFE FOR ONE SPECIFIC REASON: 423 means Neon DID NOT DO IT. No
// partial project, no half-created database, nothing to reconcile. That is what
// separates this status from every other, and why nothing else is retried.
import { createSiteDatabase, NEON_LOCK_TRIES } from "../site-db.mjs";

/** Answers `423 locked` for the first `n` non-GET calls, then succeeds. */
function stubLocking(n, message = "project already has running conflicting operations, scheduling of new ones is prohibited") {
  const real = globalThis.fetch;
  const calls = [];
  let locked = 0;
  globalThis.fetch = async (url, init) => {
    const method = (init && init.method) || "GET";
    calls.push(method + " " + String(url).replace(/^https?:\/\/[^/]+/, ""));
    if (method !== "GET" && locked < n) {
      locked++;
      const body = { request_id: "r", code: "", message };
      return { ok: false, status: 423, json: async () => body, text: async () => JSON.stringify(body) };
    }
    // Every GET here is a `/operations` poll, and it answers quiet — which is
    // exactly the state that produced the live failure.
    return { ok: true, status: 200, json: async () => ({ operations: [] }), text: async () => JSON.stringify({ operations: [] }) };
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

test("a locked project is waited out and the call goes through", async () => {
  const f = stubLocking(2);
  try {
    const name = await createSiteDatabase(ENV, "p1", "br-1", "owner", "smoke-abc");
    assert.ok(name, "the database was never created");
  } finally { f.restore(); }
  const posts = f.calls.filter((c) => c.startsWith("POST"));
  assert.equal(posts.length, 3, "expected two refusals and one success, got: " + posts.join(" | "));
});

test("it gives up rather than retrying forever", async () => {
  // A publish awaits this, so an unbounded retry is a request that never
  // returns — the same rule the confirm poll lives under. Driven against the
  // REAL budget rather than a restated one.
  const f = stubLocking(NEON_LOCK_TRIES + 5);
  try {
    await assert.rejects(
      createSiteDatabase(ENV, "p1", "br-1", "owner", "smoke-abc"),
      (e) => e && e.status === 423,
      "a permanently locked project must surface as the 423 it is");
  } finally { f.restore(); }
  const posts = f.calls.filter((c) => c.startsWith("POST"));
  assert.equal(posts.length, NEON_LOCK_TRIES, "the budget is not the one the module declares: " + posts.length);
});

test("only 423 is retried — every other refusal fails at once", async () => {
  // The safety of retrying rests entirely on 423 meaning "I did not do it".
  // A 422 quota or a 403 permission has no such guarantee, and retrying a
  // creation that may have half-happened is how a project gets orphaned.
  for (const status of [400, 401, 403, 422, 500]) {
    const real = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => {
      const method = (init && init.method) || "GET";
      calls.push(method);
      if (method !== "GET") {
        const body = { message: "nope" };
        return { ok: false, status, json: async () => body, text: async () => JSON.stringify(body) };
      }
      return { ok: true, status: 200, json: async () => ({ operations: [] }), text: async () => JSON.stringify({ operations: [] }) };
    };
    try {
      await assert.rejects(createSiteDatabase(ENV, "p1", "br-1", "owner", "s"), (e) => e && e.status === status);
    } finally { globalThis.fetch = real; }
    assert.equal(calls.filter((c) => c === "POST").length, 1, status + " was retried and must not be");
  }
});

test("a 423 that means something else is not retried six times", async () => {
  // Today the status alone would do. The message is checked as well so that a
  // future 423 carrying a different meaning surfaces at once rather than after
  // the whole budget — a refusal nobody has read yet should fail loudly.
  const f = stubLocking(99, "this project is on a plan that forbids it");
  try {
    await assert.rejects(createSiteDatabase(ENV, "p1", "br-1", "owner", "s"), (e) => e && e.status === 423);
  } finally { f.restore(); }
  assert.equal(f.calls.filter((c) => c.startsWith("POST")).length, 1,
    "an unrecognised 423 was retried");
});

test("a 5xx with an empty body is NOT retried", async () => {
  // THE CASE THAT MAKES THE STATUS CHECK LOAD-BEARING, found by mutation. An
  // empty message reads as "locked" by design — Neon's 423 does not always
  // carry one — so without the status test a 500 with no body would be retried
  // six times. And a 5xx has none of the guarantee 423 does: the creation may
  // have half-happened, which is exactly how a Neon project is orphaned with
  // no row recording it.
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = (init && init.method) || "GET";
    calls.push(method);
    if (method !== "GET") return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
    return { ok: true, status: 200, json: async () => ({ operations: [] }), text: async () => JSON.stringify({ operations: [] }) };
  };
  try {
    await assert.rejects(createSiteDatabase(ENV, "p1", "br-1", "owner", "s"), (e) => e && e.status === 500);
  } finally { globalThis.fetch = real; }
  assert.equal(calls.filter((c) => c === "POST").length, 1, "a 500 was retried — only 423 promises it did nothing");
});

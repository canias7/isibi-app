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

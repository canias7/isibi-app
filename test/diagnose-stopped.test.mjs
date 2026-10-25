// A JOB A PERSON STOPPED IS NOT DIAGNOSED (2026-10-25). Live: on
// driftwood-and-daughters-5 two edit jobs (722524f1…, b12899f9…) were stopped
// through the request's Stop (`edit_cancel` set `cancel_requested_at`), ended
// 422 `compile` / `detail: "cancelled"` with no `cancelled: true`, and the
// shadow diagnosis called them a build-service restart. Supplied rows only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diagnoseJobEnded, needsDiagnosis } from "../builder/diagnose.mjs";

const ON = { DIAGNOSE_FAILURES: "on" };
// The live answer of 722524f108af546625cdd18a8c2c4da1 (Supabase, non-secret columns).
const LIVE = { status: 422, payload: { ok: false, error: "compile", cost: 0, msg: "That didn't go through — our build service was restarting. Try again in a moment.", lanes: [], detail: "cancelled" } };

const run = async (stopped) => {
  const sent = [], puts = [];
  const rec = await diagnoseJobEnded({
    env: ON, model: "quick", now: () => 1, stopped,
    send: async (req) => { sent.push(req); return { content: [] }; },
    put: async (k) => { puts.push(k); },
  }, { id: "722524f108af546625cdd18a8c2c4da1", op: "edit", slug: "driftwood-and-daughters-5", ...LIVE });
  return { rec, sent, puts };
};

test("DS1 the live stopped answer is otherwise a failure (the observer is alive)", async () => {
  assert.equal(needsDiagnosis(LIVE), true);
  const { sent, puts } = await run(undefined);
  assert.ok(sent.length >= 1);
  assert.equal(puts.length, 1);
});

test("DS2 stopped by a person: no model call, no record", async () => {
  assert.equal(needsDiagnosis({ ...LIVE, stopped: true }), false);
  const { rec, sent, puts } = await run(async () => true);
  assert.equal(rec, null);
  assert.equal(sent.length, 0);
  assert.equal(puts.length, 0);
});

test("DS3 cannot-tell is not a stop: a throw or a non-true diagnoses as before", async () => {
  for (const s of [async () => { throw new Error("x"); }, async () => "yes", async () => null]) {
    const { sent, puts } = await run(s);
    assert.ok(sent.length >= 1);
    assert.equal(puts.length, 1);
  }
});

test("DS4 the worker reads the stop from the row and the request, and read_job shows both", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("function diagnoseTools("), z = src.indexOf("async function replyJobEnded(");
  const c = src.indexOf("const DIAGNOSE_JOB_COLS");
  assert.ok(c > 0 && a > c && z > a);
  const body = src.slice(a, z);
  assert.match(src.slice(c, a), /cancel_requested_at/);
  assert.match(body, /stoppedByPerson: async[\s\S]*?cancel_requested_at[\s\S]*?requestStop\(\)/);
  assert.match(body, /rec\.stop === true/);
  assert.match(body, /stopParts/);
  assert.match(body, /read_job: async[\s\S]*?requestStop: await requestStop\(\)/);
  assert.match(body, /stopped: stoppedByPerson/);
  // the stop reader is split off, not offered to the model as a tool
  assert.match(body, /const \{ stoppedByPerson, \.\.\.tools \} = diagnoseTools/);
});

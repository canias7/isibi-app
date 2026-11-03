// PARKED (2026-11-03, park-old-way): the old-way half of test/job-stop.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// STAGE 5d (2026-09-06): DEADLINES, CANCELLATION AND CHILD TERMINATION FOR A
// JOB RUNNING IN THE CONTAINER — the wiring, driven.
//
//   the launch     carries the job's deadline (the consumer's clock); the runner
//                  reads it strictly and falls back to now plus the budget
//   the service    arms a terminator per child at the deadline's grace, stops a
//                  child on `DELETE /job/<id>`, stops every child when its own
//                  drain gives up, clears the timers when the child ends, and
//                  records what happened
//   the runner     turns SIGTERM into an aborted `env.JOB_STOP`, which the job's
//                  gate answers `stopped` — the refund through the row's own
//                  door — and ends itself after a grace if the job cannot reach
//                  a gate
//   the Worker     asks the gate; the fire names the deadline; `editStopped`
//                  has the sentence
// The policy itself (the numbers, the two-signal sequence) is
// test/job-clock.test.mjs's.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { readLaunch, runJob } from "../../../builder/container-job.mjs";
import { makeContainerEnv } from "../../../builder/container-env.mjs";
import { JOB_KILL_GRACE_MS, JOB_STOP_GRACE_MS, STOPPED_EXIT_CODE, readDeadline, makeTerminator, makeWatchdog, NO_PROGRESS_MS } from "../../../builder/job-clock.mjs";
import { EDIT_JOB_MS, CONTAINER_EDIT_JOB_MS } from "../../../builder/edit-job.mjs";

const ROOT = new URL("../../..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const BUILD_SERVER = readFileSync(new URL("builder/build-server.mjs", ROOT), "utf8");
const DOCKERFILE = readFileSync(new URL("Dockerfile", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, (what || needle) + " not found"); return i; };

const ID = "0123456789abcdef0123456789abcdef";
const SB = "https://ujrqdmmtcptvimazlhom.supabase.co";
const launchJson = (extra = {}) => JSON.stringify({ v: 2, kind: "edit", id: ID, gateway: { url: "http://127.0.0.1:1/api/job/" + ID, token: "t" }, sb: { url: SB }, secrets: {}, buildPort: 8080, ...extra });

// ── the build service ───────────────────────────────────────────────────────

/** The service's job functions, evaluated with the terminator and the deadline reader handed in. */
function serviceFns({ WORKER_DIR = ROOT.pathname, PORT = 8080, JOBS = new Map(), TERMS = new Map(), holdBusy = () => () => {}, console: c = { log() {}, error() {} }, makeTerminator: mt = makeTerminator, readDeadline: rd = readDeadline, spawn: sp = spawn, makeWatchdog: mw = makeWatchdog, NO_PROGRESS_MS: np = NO_PROGRESS_MS } = {}) {
  const src = noComments(BUILD_SERVER);
  const from = at(src, "function checkWorkerTree(");
  const to = at(src, "function busyState()");
  const text = src.slice(from, to).replace(/^const WORKER_TREE_CHECK = [^\n]*$/m, "").replace(/^const TERMS = new Map\(\);$/m, "");
  return new Function("fs", "path", "spawn", "process", "WORKER_DIR", "PORT", "JOBS", "TERMS", "holdBusy", "console", "makeTerminator", "readDeadline", "makeWatchdog", "NO_PROGRESS_MS",
    text + "\nreturn { checkWorkerTree, cleanChildEnv, startJob, stopJob, stopJobChildren };")(fs, path, sp, process, WORKER_DIR, PORT, JOBS, TERMS, holdBusy, c, mt, rd, mw, np);
}

/** A fake terminator that records what the service asked of it. */
function fakeTerminators() {
  const made = [];
  const factory = ({ kill, onState }) => {
    const t = { armed: [], stops: [], cleared: 0, kill, onState, state: () => (t.stops.length ? "stopping" : "running"), why: () => t.stops[0] || "",
      arm(d) { t.armed.push(d); }, stop(why) { t.stops.push(why); onState("stopping", why); }, clear() { t.cleared++; } };
    made.push(t);
    return t;
  };
  return { made, factory };
}

test("editStopped has the stopped sentence, and the fire names the deadline the service stops at", () => {
  const src = noComments(WORKER);
  const fn = (name) => { const from = at(src, name); const end = src.indexOf("\n}\n", from); assert.ok(end > from, name + " has no close"); return src.slice(from, end); };
  const stopped = fn("async function editStopped(");
  assert.match(stopped, /why === "stopped"/, "editStopped does not tell a stopped job apart");
  assert.match(stopped, /was stopped before it could publish/, "the stopped sentence is missing");
  assert.match(stopped, /p_state: why === "cancelled" \? "cancelled" : "failed"/, "a stopped job is refunded as something other than failed");
  const fire = fn("async function fireContainerJob(");
  // RE-ANCHORED for stage 5b: the deadline is the KIND's own clock — an
  // edit's budget or a build's longer one — so the launch names `budgetMs`
  // and the fire derives it from the kind; the edit's deadline is driven in
  // container-job.test.mjs, the build's in build-runner.test.mjs.
  assert.match(fire, /deadlineAt: Date\.now\(\) \+ budgetMs,/, "the launch does not name the job's deadline");
  // RE-ANCHORED 2026-09-14: an edit fired at a container gets the container's
  // clock, so the edit arm is `CONTAINER_EDIT_JOB_MS`. What this file is about
  // is that the deadline the build service STOPS a child by is the same number
  // the job was given, and that is unchanged — it just got longer for an edit,
  // which is the whole of run 44's fix.
  // RE-ANCHORED AGAIN the same day, and split into the two things it says, so an
  // honest reformat cannot break it and a real cut cannot slip past it: the kind
  // picks a constant, and the deploy's setting is read WITH that constant as its
  // fallback. One long literal asserted both by accident and neither on purpose.
  assert.match(fire, /kind === "build" \? BUILD_JOB_MS : CONTAINER_EDIT_JOB_MS/, "the launch's clock is not the kind's own");
  assert.match(fire, /readJobMaxMs\(env, kindMs\)/, "the deploy's setting is not read, or not with the kind's clock as its fallback");
  // NO FIXED DEADLINE (2026-10-30): the setting when the deploy names one, else the credential's horizon.
  assert.match(fire, /const budgetMs = setting\.from === "env" \? setting\.ms : JOB_CREDENTIAL_MS;/, "the launch's clock is no longer the setting's answer or the credential horizon");
});

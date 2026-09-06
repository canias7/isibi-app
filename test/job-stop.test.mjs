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
import { readLaunch, runJob } from "../builder/container-job.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { JOB_KILL_GRACE_MS, JOB_STOP_GRACE_MS, STOPPED_EXIT_CODE, readDeadline, makeTerminator } from "../builder/job-clock.mjs";
import { EDIT_JOB_MS } from "../builder/edit-job.mjs";

const ROOT = new URL("..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const BUILD_SERVER = readFileSync(new URL("builder/build-server.mjs", ROOT), "utf8");
const DOCKERFILE = readFileSync(new URL("Dockerfile", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, (what || needle) + " not found"); return i; };

const ID = "0123456789abcdef0123456789abcdef";
const SB = "https://ujrqdmmtcptvimazlhom.supabase.co";
const launchJson = (extra = {}) => JSON.stringify({ v: 2, kind: "edit", id: ID, gateway: { url: "http://127.0.0.1:1/api/job/" + ID, token: "t" }, sb: { url: SB }, secrets: {}, buildPort: 8080, ...extra });

// ── the launch ──────────────────────────────────────────────────────────────

test("the launch carries the job's deadline; one that names none gets now plus the job's whole budget", () => {
  const before = Date.now();
  const named = readLaunch(launchJson({ deadlineAt: before + 123_456 }));
  assert.equal(named.deadlineAt, before + 123_456);
  const bare = readLaunch(launchJson());
  assert.ok(bare.deadlineAt >= before + EDIT_JOB_MS && bare.deadlineAt <= Date.now() + EDIT_JOB_MS, "a launch with no deadline did not get the budget's: " + bare.deadlineAt);
  const junk = readLaunch(launchJson({ deadlineAt: "tomorrow" }));
  assert.ok(junk.deadlineAt >= before + EDIT_JOB_MS, "junk was read as a deadline");
});

// ── the runner ──────────────────────────────────────────────────────────────

test("the job env carries a stop signal, and SIGTERM in the runner aborts it — the job that watches it ends as a job, and the exit belt is never needed", async () => {
  const launch = readLaunch(launchJson());
  const env = makeContainerEnv({ secrets: {}, gateway: launch.gateway, sb: launch.sb, fetch: async () => new Response(null, { status: 404 }) });
  assert.ok(env.JOB_STOP instanceof AbortController, "the job env has no stop signal");
  assert.equal(env.JOB_STOP.signal.aborted, false);
  const signals = new EventEmitter();
  const timers = [];
  const exits = [];
  const seen = [];
  const out = await runJob(launch, {
    env, ctx: { waitUntil() {}, async drain() {} },
    signals, setTimeout: (fn, ms) => { const t = { fn, ms, unref() { t.unrefd = true; } }; timers.push(t); return t; }, exit: (c) => exits.push(c),
    log: (l) => seen.push(l),
    importWorker: async () => ({
      runContainerJob: async (jobEnv) => {
        // The job: waits for the stop, then ends the way a gate answer would.
        await new Promise((resolve) => { jobEnv.JOB_STOP.signal.addEventListener("abort", resolve, { once: true }); signals.emit("SIGTERM"); });
        seen.push({ gate: jobEnv.JOB_STOP.signal.aborted ? "stopped" : "go" });
      },
    }),
  });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.ok(seen.some((l) => l && l.gate === "stopped"), "the job did not see the stop: " + JSON.stringify(seen));
  assert.ok(seen.some((l) => l && l.stopping === true && l.job === ID), "the runner did not say it was stopping: " + JSON.stringify(seen));
  assert.equal(timers.length, 1, "the exit belt was not armed exactly once");
  assert.equal(timers[0].ms, JOB_STOP_GRACE_MS);
  assert.equal(timers[0].unrefd, true, "the belt keeps a process alive that would otherwise exit");
  assert.deepEqual(exits, [], "the belt fired for a job that ended on its own");
  assert.equal(signals.listenerCount("SIGTERM"), 0, "the runner left its SIGTERM listener behind");
  // The belt: a job that cannot reach a gate is ended by the runner after the grace.
  timers[0].fn();
  assert.deepEqual(exits, [STOPPED_EXIT_CODE]);
});

test("a second SIGTERM changes nothing, and a runner whose job never watches the signal still ends through the belt", async () => {
  const launch = readLaunch(launchJson());
  const signals = new EventEmitter();
  const timers = [];
  const exits = [];
  let release;
  const held = new Promise((r) => { release = r; });
  const run = runJob(launch, {
    env: makeContainerEnv({ secrets: {}, gateway: launch.gateway, sb: launch.sb, fetch: async () => new Response(null, { status: 404 }) }),
    ctx: { waitUntil() {}, async drain() {} }, signals,
    setTimeout: (fn, ms) => { const t = { fn, ms, unref() {} }; timers.push(t); return t; }, exit: (c) => exits.push(c),
    importWorker: async () => ({ runContainerJob: async () => { signals.emit("SIGTERM"); signals.emit("SIGTERM"); await held; } }),
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(timers.length, 1, "a second SIGTERM armed a second belt");
  timers[0].fn();
  assert.deepEqual(exits, [STOPPED_EXIT_CODE], "the belt did not end a job that ignores the stop");
  release();
  assert.equal((await run).ok, true);
});

// ── the build service ───────────────────────────────────────────────────────

/** The service's job functions, evaluated with the terminator and the deadline reader handed in. */
function serviceFns({ WORKER_DIR = ROOT.pathname, PORT = 8080, JOBS = new Map(), TERMS = new Map(), holdBusy = () => () => {}, console: c = { log() {}, error() {} }, makeTerminator: mt = makeTerminator, readDeadline: rd = readDeadline, spawn: sp = spawn } = {}) {
  const src = noComments(BUILD_SERVER);
  const from = at(src, "function checkWorkerTree(");
  const to = at(src, "function busyState()");
  const text = src.slice(from, to).replace(/^const WORKER_TREE_CHECK = [^\n]*$/m, "").replace(/^const TERMS = new Map\(\);$/m, "");
  return new Function("fs", "path", "spawn", "process", "WORKER_DIR", "PORT", "JOBS", "TERMS", "holdBusy", "console", "makeTerminator", "readDeadline",
    text + "\nreturn { checkWorkerTree, cleanChildEnv, startJob, stopJob, stopJobChildren };")(fs, path, sp, process, WORKER_DIR, PORT, JOBS, TERMS, holdBusy, c, mt, rd);
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

test("startJob arms the terminator at the launch's deadline, clears it when the child ends, and the record carries the deadline", async () => {
  const JOBS = new Map();
  const TERMS = new Map();
  const { made, factory } = fakeTerminators();
  const fns = serviceFns({ JOBS, TERMS, makeTerminator: factory });
  const launch = readLaunch(launchJson({ deadlineAt: 1_900_000_000_000 }));
  const started = fns.startJob(launch, launchJson({ deadlineAt: 1_900_000_000_000 }));
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(made.length, 1, "no terminator was made for the child");
  assert.deepEqual(made[0].armed, [1_900_000_000_000], "the terminator was not armed at the launch's deadline");
  assert.equal(JOBS.get(ID).deadlineAt, 1_900_000_000_000);
  assert.equal(TERMS.get(ID), made[0], "the service cannot find the child's terminator by id");
  const until = Date.now() + 90_000;
  while (JOBS.get(ID).state === "running" && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  assert.notEqual(JOBS.get(ID).state, "running");
  assert.equal(made[0].cleared, 1, "the terminator's timers outlived the child");
  assert.equal(TERMS.has(ID), false, "the ended child's terminator was kept");
  assert.equal(JOBS.get(ID).stopped, null, "a child that ended on its own reads as stopped");
});

test("stopJob stops a running child through its terminator with the reason and refuses an unknown or ended one; the drain stops every running child", async () => {
  const JOBS = new Map();
  const TERMS = new Map();
  const { made, factory } = fakeTerminators();
  const fns = serviceFns({ JOBS, TERMS, makeTerminator: factory, spawn: () => {
    // A child that never ends: the stream and close handlers are attached and nothing fires.
    const ee = new EventEmitter();
    ee.pid = 4242; ee.stdin = { on() {}, end() {} }; ee.stdout = new EventEmitter(); ee.stderr = new EventEmitter(); ee.kill = () => {};
    return ee;
  } });
  assert.deepEqual(fns.stopJob("nope", "cancel"), { ok: false, error: "no such job" });
  fns.startJob(readLaunch(launchJson()), launchJson());
  const other = "fedcba9876543210fedcba9876543210";
  fns.startJob(readLaunch(launchJson({ id: other })), launchJson({ id: other }));
  assert.equal(made.length, 2);
  const stopped = fns.stopJob(ID, "cancel");
  assert.deepEqual(stopped, { ok: true, id: ID, stopping: true, why: "cancel" });
  assert.deepEqual(made[0].stops, ["cancel"]);
  assert.equal(JOBS.get(ID).stopping, "cancel", "the record does not say the child is being stopped");
  assert.equal(JOBS.get(ID).state, "running", "a stopping child was recorded as ended before it ended");
  assert.deepEqual(fns.stopJob(ID, "cancel"), { ok: true, id: ID, stopping: true, why: "cancel" }, "a second stop is not idempotent");
  assert.deepEqual(made[0].stops, ["cancel", "cancel"], "the terminator, not this layer, is what makes a second stop harmless");
  // The drain: every running child, with its reason.
  const n = fns.stopJobChildren("drain");
  assert.equal(n, 2);
  assert.deepEqual(made[1].stops, ["drain"]);
  JOBS.set(other, { ...JOBS.get(other), state: "done" });
  TERMS.delete(other);
  assert.deepEqual(fns.stopJob(other, "cancel"), { ok: false, error: "not running", state: "done" });
  assert.equal(fns.stopJobChildren("drain"), 1, "an ended child was counted as stopped");
});

test("THE REAL CHILD, STOPPED: a deadline already past its grace ends the real runner through SIGTERM, and the record says so", async () => {
  const JOBS = new Map();
  const TERMS = new Map();
  const logs = [];
  const fns = serviceFns({ JOBS, TERMS, console: { log: (...a) => logs.push(a.join(" ")), error: (...a) => logs.push(a.join(" ")) } });
  // A gateway that holds the claim open, so the runner is mid-await when the
  // signal lands and has to end through the belt or the gate — never on its own.
  // HELD LONGER THAN THE WHOLE STOP SEQUENCE (the term grace, the kill grace
  // and the window below), so a child the service never signalled would
  // outlive every assertion here: the sweep's S11 mutant — the terminator's
  // kill sending nothing — passed while this stub answered at 25 s and the
  // child ended on its own, exit 0, inside the window.
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => { setTimeout(() => { res.writeHead(401); res.end("{}"); }, 60_000).unref(); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const gw = "http://127.0.0.1:" + server.address().port + "/api/job/" + ID;
  const raw = launchJson({ gateway: { url: gw, token: "t" }, deadlineAt: Date.now() - JOB_KILL_GRACE_MS - 1000 });
  const at0 = Date.now();
  const started = fns.startJob(readLaunch(raw), raw);
  assert.equal(started.ok, true, JSON.stringify(started));
  const until = Date.now() + 90_000;
  while (JOBS.get(ID).state === "running" && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  server.close();
  const j = JOBS.get(ID);
  assert.notEqual(j.state, "running", "the child was not stopped: " + JSON.stringify(j));
  assert.equal(j.stopped, "deadline", "the record does not say the child was stopped for its deadline: " + JSON.stringify(j));
  // Ended by the runner's own belt (its exit code) or by the signal before the
  // runner had its handler up — either is under the kill grace, never the kill,
  // and NEVER A NATURAL END (exit 0): the claim is held for a minute, so a
  // child that ends on its own inside the window was not stopped at all.
  assert.ok(j.code === STOPPED_EXIT_CODE || j.signal === "SIGTERM", "the child ended some other way: " + JSON.stringify(j));
  assert.ok(Date.now() - at0 < JOB_STOP_GRACE_MS + 15_000, "the child outlived the stop grace: " + (Date.now() - at0) + " ms");
  assert.ok(logs.some((l) => /stopping.*deadline|stopped/.test(l)), "the service did not say why the child was stopped: " + logs.slice(-6).join("\n"));
});

test("the service's routes and drain: DELETE /job/<id> stops a child, the drain stops its children before it gives up, and the runner's tree carries the clock module", () => {
  const src = noComments(BUILD_SERVER);
  assert.match(src, /import \{ readDeadline, makeTerminator, JOB_STOP_GRACE_MS \} from "\.\/job-clock\.mjs";/, "the service does not import the clock");
  // Landmarks are CODE, never comments: the blanker above erases those.
  const delAt = at(src, 'req.method === "DELETE" && req.url.startsWith("/job/")');
  const getAt = at(src, 'req.method === "GET" && req.url.startsWith("/job/")');
  assert.ok(getAt > delAt, "the DELETE route does not sit before the GET route");
  const del = src.slice(delAt, getAt);
  assert.ok(del.length > 50 && del.length < 2000, "the DELETE route moved or grew past its window");
  assert.match(del, /stopJob\(id, "cancel"\)/, "the DELETE route does not stop the child through stopJob");
  assert.match(del, /404/, "an unknown job is not a 404 on DELETE");
  const drain = src.slice(at(src, 'process.on("SIGTERM", () => {'), at(src, 'process.on("uncaughtException"'));
  // LANDMARK TO LANDMARK, never a byte window (a blanked comment keeps its
  // length): the give-up branch is the `if` on the drain's own clock, and it
  // closes where the interval's callback does.
  const giveUpAt = drain.indexOf("if (Date.now() - at > TERM_DRAIN_MS) {");
  assert.ok(giveUpAt > 0, "the drain's give-up branch moved");
  const giveUpEnd = drain.indexOf("}, 1000);", giveUpAt);
  assert.ok(giveUpEnd > giveUpAt, "the drain's interval no longer closes after the give-up");
  const giveUp = drain.slice(giveUpAt, giveUpEnd);
  assert.match(giveUp, /stopJobChildren\("drain"\)/, "the drain does not stop its children when it gives up");
  assert.match(giveUp, /setTimeout\(leave, JOB_STOP_GRACE_MS\)/, "the drain leaves before its children could end as jobs");
  assert.equal((drain.slice(0, giveUpAt).match(/stopJobChildren\(/g) || []).length, 0, "the children are stopped before the drain has given up");
  assert.match(DOCKERFILE, /builder\/job-clock\.mjs/, "the image does not carry the clock module");
});

// ── the Worker ──────────────────────────────────────────────────────────────

test("the job's gate answers `stopped` on an aborted stop signal, ahead of every other reason — driven out of the source", () => {
  const src = noComments(WORKER);
  const from = at(src, "function makeJobCtx(env, {");
  const to = at(src, "async function claimBuildRow(", "the function after makeJobCtx");
  assert.ok(to > from, "claimBuildRow no longer follows makeJobCtx");
  const text = src.slice(from, to);
  const makeJobCtx = new Function("editRpc", "LEASE_TTL_S", text + "\nreturn makeJobCtx;")(async () => ({ ok: true }), 90);
  const stop = new AbortController();
  const budget = { expired: () => false, canPublish: () => true };
  const live = makeJobCtx({ JOB_STOP: stop }, { id: ID, owner: "c_x", budget, trace: null });
  assert.deepEqual(live.gate("build"), { go: true, phase: "build" });
  stop.abort();
  assert.deepEqual(live.gate("build"), { go: false, why: "stopped" });
  assert.deepEqual(live.gate("editing"), { go: false, why: "stopped" });
  // A stopped job that was also cancelled or out of budget still says stopped: the process is ending.
  const spent = makeJobCtx({ JOB_STOP: stop }, { id: ID, owner: "c_x", budget: { expired: () => true, canPublish: () => false }, trace: null });
  assert.deepEqual(spent.gate("build"), { go: false, why: "stopped" });
  // No stop signal on the env (the Worker's own consumer): the gate as it was.
  const worker = makeJobCtx({}, { id: ID, owner: "c_x", budget: { expired: () => true, canPublish: () => false }, trace: null });
  assert.deepEqual(worker.gate("build"), { go: false, why: "budget" });
});

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
  assert.match(fire, /const budgetMs = kind === "build" \? BUILD_JOB_MS : EDIT_JOB_MS;/, "the launch's clock is not the kind's own");
});

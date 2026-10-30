// NO LIMIT ON HOW LONG A TASK RUNS (the owner, 2026-10-30). The site agent has
// no round or time cap by default; a container job is stopped only after
// NO_PROGRESS_MS without progress, never while it progresses; the container
// is held while it progresses; the page follows a running job past 50 minutes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent, AGENT_MAX_ROUNDS, AGENT_MAX_MS, HELPER_ROUNDS } from "../builder/site-agent.mjs";
import { makeWatchdog, NO_PROGRESS_MS } from "../builder/job-clock.mjs";
import { holdDecision, MAX_BUSY_HOLD_MS, MAX_QUIET_HOLD_MS } from "../builder/container-hold.mjs";
import { JOB_CREDENTIAL_MS } from "../builder/job-duration.mjs";
import { noteProgress, resetProgressNote, NOTE_EVERY_MS } from "../builder/job-progress.mjs";

const MIN = 60_000;
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const use = (name, input) => ({ type: "tool_use", name, input });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 10, output_tokens: 2 }, stop_reason: "tool_use" });
const PAGES = [{ path: "index.tsx", source: "export default function Home(){return <h1>Home</h1>}" }];

/** Fake timers: `advance(ms)` runs every timer due by then, in order. */
function fakeTimers(start = 1_000_000) {
  let t = start; let seq = 0; const q = new Map();
  return {
    now: () => t,
    setTimeout: (fn, ms) => { const id = ++seq; q.set(id, { at: t + Math.max(0, ms), fn }); return id; },
    clearTimeout: (id) => { q.delete(id); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [id, e] of q) if (e.at <= end && (!next || e.at < next[1].at)) next = [id, e];
        if (!next) break;
        q.delete(next[0]); t = next[1].at; next[1].fn();
      }
      t = end;
    },
  };
}

test("NT1 no default cap: rounds, time and helper rounds are unlimited", () => {
  assert.equal(AGENT_MAX_ROUNDS, Infinity);
  assert.equal(AGENT_MAX_MS, Infinity);
  assert.equal(HELPER_ROUNDS, Infinity);
});

test("NT2 an agent run past 40 rounds and 40 minutes keeps going while it progresses, and finishes", async () => {
  const rounds = [];
  for (let i = 0; i < 60; i++) rounds.push(answer(use("read_files", { files: ["index.tsx"] })));
  rounds.push(answer(use("build", {})), answer(use("finish", { summary: "done" })));
  let i = 0; let t = 0;
  const send = async () => rounds[Math.min(i++, rounds.length - 1)];
  // each clock read moves a minute: the run lasts far past 40 minutes
  const r = await runSiteAgent({ send, build: async () => ({ ok: true }), now: () => (t += MIN) }, { request: "r", pages: PAGES, parts: [] });
  assert.equal(r.stopped, "", "stopped: " + r.stopped);
  assert.equal(r.ok, true);
  assert.equal(r.rounds, 62);
  assert.ok(t > 50 * MIN, "the fake clock passed 50 minutes");
});

test("NT3 an explicit cap still works for tests and helpers", async () => {
  const send = async () => answer(use("read_files", { files: ["index.tsx"] }));
  assert.equal((await runSiteAgent({ send, build: async () => ({ ok: true }) }, { request: "r", pages: PAGES, maxRounds: 3 })).stopped, "rounds");
});

test("NT4 every round and every tool result is progress (deps.alive)", async () => {
  const said = [];
  const rounds = [answer(use("read_files", { files: ["index.tsx"] }), use("read_files", { files: ["index.tsx"] })), answer(use("build", {})), answer(use("finish", { summary: "ok" }))];
  let i = 0;
  await runSiteAgent({ send: async () => rounds[i++], build: async () => ({ ok: true }), alive: (w) => said.push(w) }, { request: "r", pages: PAGES });
  assert.deepEqual(said, ["round", "tool", "tool", "round", "tool", "round", "tool"]);
});

test("NT5 the watchdog stops a job with no progress for its window", () => {
  const ft = fakeTimers();
  let idle = 0;
  const dog = makeWatchdog({ onIdle: () => { idle++; }, setTimeout: ft.setTimeout, clearTimeout: ft.clearTimeout, now: ft.now });
  ft.advance(NO_PROGRESS_MS - 1);
  assert.equal(idle, 0, "not before the window");
  ft.advance(2);
  assert.equal(idle, 1, "stopped once the window passed with no progress");
  ft.advance(NO_PROGRESS_MS * 3);
  assert.equal(idle, 1, "once only");
  dog.clear();
});

test("NT6 a progressing job past 50 minutes is not stopped", () => {
  const ft = fakeTimers();
  let idle = 0;
  const dog = makeWatchdog({ onIdle: () => { idle++; }, setTimeout: ft.setTimeout, clearTimeout: ft.clearTimeout, now: ft.now });
  for (let m = 0; m < 180; m += 10) { ft.advance(10 * MIN); dog.touch(); }
  assert.equal(idle, 0, "three hours of progress every ten minutes");
  assert.equal(NO_PROGRESS_MS, 15 * MIN);
  ft.advance(NO_PROGRESS_MS + 1);
  assert.equal(idle, 1, "and stopped once it went quiet");
});

test("NT7 the build service arms the watchdog, not the deadline, and every child line is progress", () => {
  const src = read("builder/build-server.mjs");
  const a = src.indexOf("function startJob("); const b = src.indexOf("function stopJob(");
  assert.ok(a > 0 && b > a, "landmarks");
  const body = src.slice(a, b);
  assert.doesNotMatch(body, /term\.arm\(/, "no fixed-deadline stop");
  assert.match(body, /makeWatchdog\(\{[^}]*onIdle: \(\) => term\.stop\("no-progress"\)/);
  assert.match(body, /if \(!line\) continue;\s*touchProgress\(\);/);
  assert.match(body, /dog\.clear\(\);/);
  // model answers, stream pieces and provider waits are progress too
  assert.ok((src.match(/touchProgress\(\)/g) || []).length >= 6);
  assert.match(src, /idleMs: _busy > 0 \?/);
});

test("NT8 the container is held while busy and progressing, however long; let go once quiet", () => {
  assert.deepEqual(holdDecision({ busy: true, sinceMs: 3 * 60 * MIN, idleMs: MIN }), { hold: true, why: "busy" });
  assert.deepEqual(holdDecision({ busy: true, sinceMs: 3 * 60 * MIN, idleMs: MAX_QUIET_HOLD_MS + 1 }), { hold: false, why: "stuck" });
  assert.ok(MAX_QUIET_HOLD_MS > NO_PROGRESS_MS);
  // an older image with no idleMs keeps the old ceiling
  assert.deepEqual(holdDecision({ busy: true, sinceMs: MAX_BUSY_HOLD_MS + 1 }), { hold: false, why: "stuck" });
});

test("NT9 the launch's token and deadlineAt take the credential's horizon, not 50 minutes", () => {
  assert.ok(JOB_CREDENTIAL_MS >= 24 * 60 * MIN);
  const src = read("worker.js");
  assert.match(src, /const budgetMs = setting\.from === "env" \? setting\.ms : JOB_CREDENTIAL_MS;/);
});

test("NT10 inside a container job the agent's progress reaches the service as a line, throttled", () => {
  resetProgressNote();
  const lines = [];
  assert.equal(noteProgress("round", { now: 1e9, inJob: true, write: (l) => lines.push(l) }), true);
  assert.equal(noteProgress("tool", { now: 1e9 + 1000, inJob: true, write: (l) => lines.push(l) }), false);
  assert.equal(noteProgress("tool", { now: 1e9 + NOTE_EVERY_MS, inJob: true, write: (l) => lines.push(l) }), true);
  assert.equal(noteProgress("x", { now: 2e9, inJob: false, write: (l) => lines.push(l) }), false);
  assert.deepEqual(lines, ["progress round\n", "progress tool\n"]);
  assert.ok(NOTE_EVERY_MS < NO_PROGRESS_MS / 10);
});

test("NT11 the page keeps following a running build past 50 minutes", () => {
  const src = read("public/chat.js");
  const m = src.match(/const BUILD_FOLLOW_MS = ([^;\n]+);/);
  assert.ok(m);
  const follow = Function("return (" + m[1] + ")")();
  const start = 1e12;
  const until = start + follow;
  assert.ok(start + 51 * MIN < until && start + 24 * 60 * MIN < until, "still following");
  assert.match(src, /const until = Date\.now\(\) \+ BUILD_FOLLOW_MS;\n[\s\S]{0,600}while \(Date\.now\(\) < until\)/);
});

test("NT12 an edit's give-up counts from the server's last 'still running'", () => {
  const src = read("public/chat.js");
  assert.match(src, /if \(read\.act === 'wait'\) \{\n\s*w\.attempt\+\+;\n[^\n]*\n\s*w\.startedAt = Date\.now\(\);/);
  assert.match(src, /if \(read\.act === 'wait'\) startedAt = Date\.now\(\);\n\s*draw\(\);\n\s*if \(Date\.now\(\) - startedAt > EditPoll\.POLL_GIVE_UP_MS\)/);
});

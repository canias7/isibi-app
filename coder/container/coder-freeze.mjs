// THE AI'S COMMANDS PAUSED WHILE ROOT WORKS ON THEIR FILES (tool 4, the owner, 2026-11-09: "do all of
// those": Claude Code's background commands keep running after its answer, "until it exits, is stopped,
// or reaches its time limit", and Claude is told when one ends).
//
// THE AUDIT'S RULE STAYS (2026-11-05/06): nothing of the AI's runs while root (this service) works on
// the chat's files: preparing them for a job, saving them to GitHub, an undo, a diff. Until now that
// was kept by ending every process of the AI's when its job ended. A background command that runs on
// after the answer cannot be ended then, so instead every process of the AI's is PAUSED (SIGSTOP)
// while root works, and continued (SIGCONT) after; what is not one of its kept background commands
// is ended while paused.
//
// How a pause is made sure of:
// - The stop is sent the way the audit's kill is (KILL_AS in server.mjs): kill(-1) sent AS the AI's
//   user reaches every process that user may signal, setuid ones too, in one sweep a fork cannot slip
//   past (the kernel hands a signal sent to many processes to a fork in progress as well). Inside the
//   admin sandbox (whose ids the AI's user may not signal) root sends the same from inside its own
//   process space; its first process is stopped from outside (a stop sent from outside reaches it).
// - Then every thread of every process with the AI's ids is read from /proc until each is stopped
//   (T), held by a tracer (t), or gone (Z, X); or waiting inside fork/clone (a vfork parent, whose
//   child is stopped before it runs anything). A thread still in a system call when the stop came
//   finishes it first, so root waits for that. Stragglers get a stop of their own.
// - Not all paused within PAUSE_WAIT_MS: no pause. The caller then ends everything, as before.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** How long the AI's processes have to be all stopped (they usually are in a few milliseconds). */
export const PAUSE_WAIT_MS = 3000;
/** The signal sent as a user to every process it may signal: kill(-1), three times. */
export const SIGNAL_AS = "import os,sys\nu,g,s=int(sys.argv[1]),int(sys.argv[2]),int(sys.argv[3])\nos.setgroups([]);os.setgid(g);os.setuid(u)\nfor _ in range(3):\n  try:os.kill(-1,s)\n  except ProcessLookupError:pass\n";
/** The same, sent by root from inside the admin sandbox's process space (its first process and the sender are left out). */
export const SIGNAL_ALL = "import os,sys\ns=int(sys.argv[1])\nfor _ in range(3):\n  try:os.kill(-1,s)\n  except ProcessLookupError:pass\n";
const SIGSTOP = 19, SIGKILL = 9;
/** fork, vfork, clone, clone3 (x86-64; arm64 has clone 220 and clone3): a thread waiting in one runs nothing. */
export const CLONE_CALLS = process.arch === "arm64" ? new Set(["220", "435"]) : new Set(["56", "57", "58", "435"]);

const python = () => ["/usr/bin/python3", "/bin/python3", "/usr/local/bin/python3"].find((p) => existsSync(p)) || "";

/** A process's ids (real, effective, saved, filesystem), or null once it is gone. */
export function idsOf(pid, { read = readFileSync, proc = "/proc" } = {}) {
  try {
    const m = /^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/m.exec(String(read(proc + "/" + pid + "/status", "utf8")));
    return m ? m.slice(1).map(Number) : null;
  } catch { return null; }
}
/** A process's or thread's state letter, parent and process group, from its stat line; null once it is gone. */
export function statOf(text) {
  const s = String(text || ""), at = s.lastIndexOf(")");
  if (at < 0) return null;
  const f = s.slice(at + 2).split(" ");
  return f.length > 3 ? { state: f[0], ppid: Number(f[1]), pgrp: Number(f[2]) } : null;
}
/**
 * THE MARK EACH OF THE CHAT'S COMMANDS CARRIES (Bash docs pass 3, the owner, 2026-11-10: "Ok yes do that"; Claude Code
 * 2.1.257: "Fixed background commands that detach from their shell (for example under `timeout` or `setsid`) surviving a
 * task stop"): a random value in the command's environment, which everything it starts inherits, whatever process group or
 * session it moves to. A process's mark, from the environment it started with; "" when it has none (or is gone).
 */
export const TASK_MARK = "GOFARTHER_CODER_TASK";
export function markOf(pid, { read = readFileSync, proc = "/proc" } = {}) {
  let env = "";
  try { env = Buffer.from(read(proc + "/" + pid + "/environ")).toString("latin1"); } catch { return ""; }
  const at = ("\0" + env).indexOf("\0" + TASK_MARK + "=");
  if (at < 0) return "";
  const v = env.slice(at + TASK_MARK.length + 1), end = v.indexOf("\0");
  return end < 0 ? v : v.slice(0, end);
}
/** Is this a process of the AI's: any of its ids the AI's user, or one of the admin sandbox's? */
export const isAI = (ids, uid, box) => Array.isArray(ids) && ids.some((x) => x === uid || (box && x >= box[0] && x < box[1]));

/**
 * Every process of the AI's now: pid → { pgrp, ppid, state }. `uid`: the AI's user; `box`: the
 * admin sandbox's ids [from, to). The service itself and the machine's own are never in it.
 */
export function aiProcesses({ uid, box = null, proc = "/proc", read = readFileSync, list = readdirSync } = {}) {
  const out = new Map();
  let names = [];
  try { names = list(proc); } catch { return out; }
  for (const n of names) {
    if (!/^\d+$/.test(n) || Number(n) === process.pid) continue;
    if (!isAI(idsOf(n, { read, proc }), uid, box)) continue;
    let st = null;
    try { st = statOf(read(proc + "/" + n + "/stat", "utf8")); } catch { st = null; }
    if (st) out.set(Number(n), st);
  }
  return out;
}

/** Can this thread do nothing until it is continued? Stopped, traced, gone, or waiting in fork/clone. */
export const threadQuiet = (state, call = "") => "TtZX".includes(String(state || "X")[0]) || (String(state)[0] === "D" && CLONE_CALLS.has(String(call)));

/** The threads of these processes that may still run: [{ pid, tid, state }]. A process gone meanwhile is quiet. */
export function stillRunning(pids, { proc = "/proc", read = readFileSync, list = readdirSync } = {}) {
  const out = [];
  for (const pid of pids) {
    let tids = [];
    try { tids = list(proc + "/" + pid + "/task"); } catch { continue; }
    for (const tid of tids) {
      let st = null, call = "";
      try { st = statOf(read(proc + "/" + pid + "/task/" + tid + "/stat", "utf8")); } catch { st = null; }
      if (!st) continue;
      if (st.state === "D") { try { call = String(read(proc + "/" + pid + "/task/" + tid + "/syscall", "utf8")).trim().split(/\s+/)[0]; } catch { call = ""; } }
      if (!threadQuiet(st.state, call)) out.push({ pid, tid: Number(tid), state: st.state });
    }
  }
  return out;
}

const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const send = (pid, sig) => { try { process.kill(pid, sig); return true; } catch { return false; } };

/**
 * PAUSE every process of the AI's. `uid`/`gid`: the AI's user; `boxPid`: the admin sandbox's first
 * process, outside (null without one); `box`: its ids [from, to). Answers { ok, procs } (procs: what
 * was paused, pid → { pgrp, ppid, state }), or { ok: false, why } when not all could be paused in time.
 * `deps` lets the tests give their own signal sender and /proc.
 */
export async function pauseAI({ uid, gid = uid, boxPid = 0, box = null, waitMs = PAUSE_WAIT_MS, deps = {} } = {}) {
  if (!Number.isInteger(uid)) return { ok: true, procs: new Map() };
  if (uid === 0 || (typeof process.getuid === "function" && uid === process.getuid())) return { ok: false, why: "never as root" };
  const run = deps.run || spawnSync;
  const py = deps.python !== undefined ? deps.python : python();
  const look = deps.look || ((o) => aiProcesses(o));
  const running = deps.running || ((pids) => stillRunning(pids));
  // Inside the admin sandbox first (as root, from inside its own process space), then its first process from outside.
  if (Number.isInteger(boxPid) && boxPid > 0) {
    if (py) run("nsenter", ["-t", String(boxPid), "--pid", "--", py, "-I", "-S", "-c", SIGNAL_ALL, String(SIGSTOP)], { env: {}, cwd: "/", stdio: "ignore", timeout: 5000 });
    else run("nsenter", ["-t", String(boxPid), "--pid", "--", "/bin/kill", "-STOP", "--", "-1"], { env: {}, cwd: "/", stdio: "ignore", timeout: 5000 });
    send(boxPid, "SIGSTOP");
  }
  // As the AI's user: every process it may signal (the audit's way: no fork slips past).
  const r = py
    ? run(py, ["-I", "-S", "-c", SIGNAL_AS, String(uid), String(Number.isInteger(gid) ? gid : uid), String(SIGSTOP)], { env: {}, cwd: "/", stdio: "ignore", timeout: 5000 })
    : run("/bin/kill", ["-STOP", "--", "-1"], { uid, gid: Number.isInteger(gid) ? gid : uid, env: {}, cwd: "/", stdio: "ignore", timeout: 5000 });
  if (!r || r.error || (py && r.status !== 0)) return { ok: false, why: "the pause could not be sent" };
  const until = Date.now() + Math.max(0, waitMs);
  for (;;) {
    const procs = look({ uid, box });
    const moving = running([...procs.keys()]);
    if (!moving.length) return { ok: true, procs };
    if (Date.now() >= until) return { ok: false, why: moving.length + " of the AI's threads did not stop (" + moving.slice(0, 3).map((m) => m.pid + ":" + m.state).join(", ") + ")" };
    // A straggler (one started from outside the sweep, like the sandbox's nsenter): a stop of its own.
    for (const pid of new Set(moving.map((m) => m.pid))) send(pid, "SIGSTOP");
    await wait(10);
  }
}

/**
 * WHILE PAUSED: every process of the AI's that is not in one of the `keep` process groups is ended
 * (SIGKILL wakes a stopped process to end it). `spare`: processes kept whatever their group (the
 * admin sandbox's first process). `keepMarks`: the marks of the kept commands (TASK_MARK): what one
 * of them started in a process group of its own (under timeout or setsid, a browser a test opened)
 * is kept with it. Answers how many were ended.
 */
export async function endOthers(procs, keep, { spare = new Set(), keepMarks = new Set(), waitMs = 2000, deps = {} } = {}) {
  const gone = deps.gone || ((pid) => { try { const st = statOf(readFileSync("/proc/" + pid + "/stat", "utf8")); return !st || "ZX".includes(st.state); } catch { return true; } });
  const kill = deps.kill || ((pid) => send(pid, "SIGKILL"));
  const mark = deps.markOf || ((pid) => markOf(pid));
  const ended = [];
  for (const [pid, p] of procs) {
    if (spare.has(pid) || keep.has(p.pgrp)) continue;
    if (keepMarks.size && keepMarks.has(mark(pid))) continue;
    if (kill(pid, SIGKILL)) ended.push(pid);
  }
  const until = Date.now() + waitMs;
  while (ended.some((pid) => !gone(pid)) && Date.now() < until) await wait(10);
  for (const pid of ended) procs.delete(pid);
  return ended.length;
}

/** CONTINUE what was paused (and the admin sandbox's first process). */
export function resumeAI(procs, { boxPid = 0, deps = {} } = {}) {
  const cont = deps.cont || ((pid) => send(pid, "SIGCONT"));
  if (Number.isInteger(boxPid) && boxPid > 0) cont(boxPid);
  for (const pid of procs.keys()) cont(pid);
}

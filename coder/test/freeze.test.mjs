// Tool 4, part 2 (the owner, 2026-11-09: "do all of those"): Claude Code's background commands go on after its answer, so
// Coder's can no longer be ended when a job ends. The audit's rule stays: nothing of the AI's runs while root works on the
// chat's files. Every process of the AI's is PAUSED instead (coder-freeze.mjs), what is not one of its kept background
// commands is ended, and the kept ones go on after. Tried here for real, as the machine's `dev`, when this runs as root.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, chmodSync, statSync, readFileSync, writeFileSync, chownSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pauseAI, endOthers, resumeAI, aiProcesses, stillRunning, statOf, isAI, threadQuiet, idsOf, SIGNAL_AS, CLONE_CALLS } from "../container/coder-freeze.mjs";

const devId = (() => { try { return Number(execFileSync("id", ["-u", "dev"], { encoding: "utf8" }).trim()); } catch { return NaN; } })();
const asRoot = typeof process.getuid === "function" && process.getuid() === 0;
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const python = ["/usr/bin/python3", "/usr/local/bin/python3", "/bin/python3"].find((p) => { try { return statSync(p).isFile(); } catch { return false; } });
const killDev = () => { if (python && Number.isInteger(devId)) spawnSync(python, ["-I", "-S", "-c", SIGNAL_AS, String(devId), String(devId), "9"], { env: {}, stdio: "ignore" }); };

test("CD276 the pause's parts: a stat line read whatever the program's name; the AI's processes by their ids (its user's, or the admin sandbox's); a thread waiting in fork or clone counts as paused, one in another call does not; never as root", async () => {
  assert.deepEqual(statOf("123 (a) b (c)) T 1 99 99 0"), { state: "T", ppid: 1, pgrp: 99 }, "a name with spaces and brackets");
  assert.equal(statOf("garbage"), null);
  assert.equal(isAI([1001, 1001, 1001, 1001], 1001, null), true);
  assert.equal(isAI([1001, 0, 0, 0], 1001, null), true, "a setuid program the AI's user started");
  assert.equal(isAI([0, 0, 0, 0], 1001, null), false, "root's own");
  assert.equal(isAI([1001001, 1001001, 1001001, 1001001], 1001, [1000000, 1262144]), true, "the admin sandbox's");
  assert.equal(isAI([1262144, 0, 0, 0], 1001, [1000000, 1262144]), false, "past the sandbox's ids");
  for (const s of ["T", "t", "Z", "X"]) assert.equal(threadQuiet(s), true, s);
  assert.equal(threadQuiet("R"), false);
  assert.equal(threadQuiet("S"), false);
  assert.equal(threadQuiet("D", "435"), true, "a vfork parent (clone3) waits for its stopped child");
  assert.equal(threadQuiet("D", "82"), false, "a rename in progress is not paused yet");
  assert.ok(CLONE_CALLS.has("435"));
  assert.deepEqual(await pauseAI({ uid: 0 }), { ok: false, why: "never as root" });
  assert.deepEqual(await pauseAI({ uid: undefined }), { ok: true, procs: new Map() }, "a test's machine with no AI user: nothing to pause");
  // One that never stops: no pause, said why (the caller then ends everything, as before).
  const r = await pauseAI({ uid: 4242, waitMs: 60, deps: { python: "", run: () => ({ status: 0 }), look: () => new Map([[7, { pgrp: 7, ppid: 1, state: "R" }]]), running: () => [{ pid: 7, tid: 7, state: "R" }] } });
  assert.equal(r.ok, false);
  assert.match(r.why, /^1 of the AI's threads did not stop \(7:R\)$/);
  // The signal is sent as the AI's user, never as root; inside the admin sandbox, by root from inside its process space.
  const runs = [];
  await pauseAI({ uid: 4242, gid: 4243, boxPid: 999999, deps: { python: "/py", run: (cmd, args) => { runs.push([cmd, ...args].join(" ")); return { status: 0 }; }, look: () => new Map(), running: () => [] } });
  assert.match(runs[0], /^nsenter -t 999999 --pid -- \/py -I -S -c [\s\S]+ 19$/);
  assert.match(runs[1], /^\/py -I -S -c [\s\S]+ 4242 4243 19$/);
  assert.match(SIGNAL_AS, /os\.setgroups\(\[\]\);os\.setgid\(g\);os\.setuid\(u\)\nfor _ in range\(3\):\n  try:os\.kill\(-1,s\)/);
  // Ending the others: never one in a kept group, never one spared.
  const killed = [];
  const procs = new Map([[10, { pgrp: 10 }], [11, { pgrp: 10 }], [12, { pgrp: 12 }], [13, { pgrp: 13 }]]);
  assert.equal(await endOthers(procs, new Set([10]), { spare: new Set([13]), deps: { kill: (pid) => { killed.push(pid); return true; }, gone: () => true } }), 1);
  assert.deepEqual(killed, [12]);
  assert.deepEqual([...procs.keys()], [10, 11, 13]);
  const cont = [];
  resumeAI(procs, { boxPid: 77, deps: { cont: (pid) => cont.push(pid) } });
  assert.deepEqual(cont, [77, 10, 11, 13]);
});

test("CD277 for real (as root, with the machine's dev): every process of the AI's is paused at once, even ones that keep moving to a new process (the audit's case), threads and a program starting others; nothing is written while paused; the others are ended; the kept background command goes on after", { skip: !(asRoot && Number.isInteger(devId) && devId > 0 && python) && "needs root, a dev user and python3" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "coder-freeze-"));
  chmodSync(dir, 0o777);
  const file = (n) => join(dir, n);
  for (const n of ["kept.txt", "other.txt"]) { writeFileSync(file(n), ""); chownSync(file(n), devId, devId); }
  const start = (cmd) => spawn("bash", ["-c", cmd], { uid: devId, gid: devId, detached: true, stdio: "ignore", cwd: dir });
  try {
    // The kept background command: its own process group, writing all the time.
    const kept = start("while true; do echo k >> kept.txt; sleep 0.01; done");
    // The others: one that keeps moving to a new process, one with threads, one starting programs, one writing.
    start(python + " -c \"import os,time\nwhile True:\n  if os.fork(): os._exit(0)\n  time.sleep(0.002)\"");
    start(python + " -c \"import threading,time\ndef f():\n  while True: sum(range(1000))\nfor _ in range(3): threading.Thread(target=f,daemon=True).start()\ntime.sleep(600)\"");
    start(python + " -c \"import os\nwhile True:\n  p=os.posix_spawn('/bin/true',['true'],{}); os.waitpid(p,0)\"");
    start("while true; do echo o >> other.txt; done");
    await wait(800);
    const p = await pauseAI({ uid: devId, gid: devId });
    assert.equal(p.ok, true, p.why);
    assert.ok(p.procs.size >= 5, "all of them seen: " + p.procs.size);
    assert.deepEqual(stillRunning([...aiProcesses({ uid: devId }).keys()]), [], "every thread of every process of dev's is paused");
    const sizes = () => [statSync(file("kept.txt")).size, statSync(file("other.txt")).size];
    const before = sizes();
    await wait(400);
    assert.deepEqual(sizes(), before, "nothing written while paused");
    // The others ended (all but the kept one's group).
    const ended = await endOthers(p.procs, new Set([kept.pid]));
    assert.ok(ended >= 4, "ended: " + ended);
    const left = [...aiProcesses({ uid: devId }).values()].filter((x) => !"ZX".includes(x.state));
    assert.ok(left.length >= 1 && left.every((x) => x.pgrp === kept.pid), "only the kept command's processes: " + JSON.stringify(left));
    resumeAI(p.procs);
    await wait(400);
    const after = sizes();
    assert.ok(after[0] > before[0], "the kept one goes on");
    await wait(300);
    assert.equal(sizes()[1], after[1], "the others stay ended");
    assert.deepEqual(idsOf(kept.pid), [devId, devId, devId, devId]);
  } finally {
    killDev();
    await wait(200);
  }
});

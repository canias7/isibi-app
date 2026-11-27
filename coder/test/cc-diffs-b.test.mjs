// SIX PLACES CODER DIFFERED FROM CLAUDE CODE, round B (2026-11-27), each kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = await import("../container/server.mjs");
const W = await import("../container/coder-worktree.mjs");
const TK = await import("../container/coder-tasks.mjs");
const M = await import("../src/coder-mcp.mjs");

test("B1 the startup file is the shell's own, and a change to it takes the snapshot again next message", async () => {
  assert.equal(S.startupFileOf("/h", "/usr/bin/zsh", ""), "/h/.zshrc");
  assert.equal(S.startupFileOf("/h", "/usr/bin/zsh", "/z"), "/z/.zshrc");
  assert.equal(S.startupFileOf("/h", "bash"), "/h/.bashrc");
  const d = await mkdtemp(join(tmpdir(), "ccb-"));
  const f = join(d, ".zshrc");
  assert.equal(S.startupStamp(f), "");
  await writeFile(f, "alias hi='echo hi'\n");
  const st1 = S.startupStamp(f);
  const taken = new Map([["/h", "zsh"]]), rc = new Map([["/h", st1]]);
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "zsh", rc: st1, rcTaken: rc }), false);
  await writeFile(f, "alias hi='echo hi'\nalias yo='echo yo'\n");
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "zsh", rc: S.startupStamp(f), rcTaken: rc }), true);
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "zsh" }), false, "old callers unchanged");
});

test("B2 exit_worktree counts processes running in the worktree, and a job whose command names it", () => {
  const top = "/r/.claude/worktrees/x";
  const sc = W.busyScript(top);
  assert.match(sc, /^\( cd \//);
  assert.match(sc, /BUSY/);
  assert.ok(W.jobInWorktree({ done: false, cwd: "/r", command: "cd " + top + " && sleep 300" }, top));
  assert.ok(W.jobInWorktree({ done: false, cwd: top + "/a", command: "x" }, top));
  assert.ok(!W.jobInWorktree({ done: true, cwd: top, command: "x" }, top));
  assert.ok(!W.jobInWorktree({ done: false, cwd: "/r", command: "sleep 3" }, top));
  // The script finds a real process there.
  const d = execFileSync("mktemp", ["-d"]).toString().trim();
  const p = spawn("sleep", ["30"], { cwd: d, stdio: "ignore" });
  try {
    const out = execFileSync("bash", ["-c", W.busyScript(d)]).toString();
    const m = W.markOf(out);
    assert.equal(m.kind, "BUSY");
    assert.ok(Number(m.rest) >= 1);
    // The shell running the check, sitting in the folder itself, is not counted.
    const d2 = execFileSync("mktemp", ["-d"]).toString().trim();
    const self = W.markOf(execFileSync("bash", ["-c", W.busyScript(d2)], { cwd: d2 }).toString());
    assert.equal(self.rest, "0");
  } finally { p.kill("SIGKILL"); }
});

test("B3 task ids are trimmed and a leading # taken off", () => {
  assert.equal(TK.fixTaskId("#1"), "1");
  assert.equal(TK.fixTaskId(" 1 "), "1");
  assert.equal(TK.checkTaskInput("task_update", { taskId: "#1", status: "completed" }).args.taskId, "1");
  assert.equal(TK.checkTaskInput("task_get", { taskId: " 2 " }).args.taskId, "2");
  assert.deepEqual(TK.checkTaskInput("task_update", { taskId: "3", addBlockedBy: ["#1", " 2"] }).args.addBlockedBy, ["1", "2"]);
  const st = TK.emptyTasks();
  TK.createTask(st, { subject: "a", description: "b" });
  assert.ok(TK.findTask(st, TK.checkTaskInput("task_get", { taskId: "#1" }).args.taskId));
});

test("B4 disk full: Claude Code's words, only when the output volume is full", () => {
  const full = { bavail: 0n, bsize: 4096n, blocks: 100n, files: 100000n, ffree: 50000n };
  assert.equal(S.diskFullBefore("/out", { statfs: () => full, probe: () => "ENOSPC" }), "The command was not started: this computer's disk is full (ENOSPC) on the volume holding /out (Coder's folder for command output), so the file that captures command output could not be created there and nothing ran. " + S.FREE_SPACE);
  assert.match(S.diskFullBefore("/out", { statfs: () => full, probe: () => "EDQUOT" }), /^The command was not started: the user's disk quota is used up \(EDQUOT\)/);
  // A write to /dev/full fails with "No space left on device" while the volume has room: Claude Code adds no line then.
  const roomy = { bavail: 1000000n, bsize: 4096n, blocks: 2000000n, files: 100000n, ffree: 50000n };
  assert.equal(S.diskNoteAfter("/out", false, { statfs: () => roomy, probe: () => "" }), null);
  assert.match(S.diskNoteAfter("/out", true, { statfs: () => ({ ...roomy, bavail: 100n }), probe: () => "" }), /^Disk full: this computer's volume holding/);
});

test("B5 the stop reaches the whole tree: SIGTERM, then SIGKILL, to every group under the job", () => {
  const rows = [{ pid: 10, ppid: 1, pgrp: 10 }, { pid: 11, ppid: 10, pgrp: 10 }, { pid: 12, ppid: 11, pgrp: 12 }, { pid: 13, ppid: 5, pgrp: 12 }, { pid: 20, ppid: 1, pgrp: 20 }];
  const t = S.treeOf(10, { list: () => rows });
  assert.deepEqual(t.groups.sort(), [10, 12]);
  assert.deepEqual(t.pids.sort((a, b) => a - b), [10, 11, 12, 13]);
  const sent = [];
  S.signalTree(t, "SIGKILL", (p, sig) => sent.push([p, sig]));
  assert.ok(sent.some(([p]) => p === -12) && sent.some(([p]) => p === 13));
  assert.equal(S.treeAlive(t, { list: () => [{ pid: 20 }] }), false);
  assert.equal(S.treeAlive(t, { list: () => [{ pid: 12 }] }), true);
});

test("B5 a loop that ignores TERM, in a group of its own, is gone after the tree's SIGKILL", async () => {
  const p = spawn("bash", ["-c", "setsid bash -c 'trap \"\" TERM; while :; do sleep 0.1; done' & trap '' TERM; while :; do sleep 0.1; done"], { detached: true, stdio: "ignore" });
  await new Promise((ok) => setTimeout(ok, 300));
  const t = S.treeOf(p.pid);
  assert.ok(t.groups.length >= 2, "the setsid child is in its own group");
  S.signalTree(t, "SIGTERM");
  await new Promise((ok) => setTimeout(ok, 300));
  assert.ok(S.treeAlive(t), "TERM is ignored");
  S.signalTree(S.treeOf(p.pid), "SIGKILL"); S.signalTree(t, "SIGKILL");
  await new Promise((ok) => setTimeout(ok, 300));
  assert.equal(S.treeAlive(t), false);
});

test("B6 suggested connectors match the query, from the full catalog", () => {
  const owned = [{ id: "c1", name: "Neon", url: "https://mcp.neon.tech/mcp" }, { id: "c2", name: "Railway", url: "https://mcp.railway.com" }];
  const r = M.suggestConnectors("Linear issues", owned);
  assert.deepEqual(r.owned, []);
  assert.deepEqual(r.catalog.map((k) => k.name), ["Linear"]);
  const r2 = M.suggestConnectors("neon database", owned);
  assert.deepEqual(r2.owned, ["c1"]);
  assert.ok(!r2.catalog.some((k) => k.name === "Neon"));
  const r3 = M.suggestConnectors("connector tools", owned);
  assert.equal(r3.generic, true);
  assert.deepEqual(r3.owned, ["c1", "c2"]);
  const r4 = M.suggestConnectors("send email", owned);
  assert.deepEqual(r4.catalog.map((k) => k.name), ["Resend"]);
});

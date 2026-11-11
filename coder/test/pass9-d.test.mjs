// BASH DOCS PASS 9, PART D (the owner, 2026-11-11: "Yes pls" to building pass 9's list in order; part D: `!` commands,
// background commands, monitors and wording): each test checked against Claude Code's own program, 2.1.322.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";

const S = await import("../container/server.mjs");
const C = await import("../container/coder-checks.mjs");
const P = await import("../container/coder-perms.mjs");
const A = await import("../container/coder-agent.mjs");
const K = await import("../container/coder-checker.mjs");
const B = await import("../container/coder-bashcheck.mjs");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const told = (out, id) => (out.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;

/** One job on a machine made here: the model's replies in turn, then "Done."; the job's state once it ends. */
async function job(project, replies, body = {}) {
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), home = await mkdtemp(join(tmpdir(), "coder-home-"));
  const mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  let n = 0;
  const seen = [];
  const srv = http.createServer(S.createApp({ root, home, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { seen.push(req); const k = n++; return k < replies.length ? replies[k] : say("Done."); }, env: {}, uid: null, gid: null }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const res = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "go", messages: [], mode: "auto", ...body }) });
    assert.equal(res.status, 200);
    let st;
    for (let i = 0; i < 600; i++) {
      st = await (await fetch(base + "/state?project=" + project + "&since=0")).json();
      if (st.result) break;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    assert.ok(st.result, "the job ended");
    return { st, seen, out: (id) => (st.events.find((e) => e.type === "result" && e.id === id) || {}).output };
  } finally {
    await new Promise((r) => srv.close(r));
    for (const d of [root, home, mem, git, bgr]) await rm(d, { recursive: true, force: true }).catch(() => {});
  }
}

test("CD471 `printf '%s\\n' hi` only prints, as in Claude Code (pass 9: Coder's own pattern took `%s\\n`'s backslash for an escape it can't read); %n, an octal or \\x escape, or a backtick still ask", () => {
  const v = (c) => P.bashDecision(c, { mode: "plan", rules: { allow: [], ask: [], deny: [] }, cwd: "/w", workdirs: ["/w"] }).verdict;
  for (const c of ["printf '%s\\n' hi", "printf '%d items\\n' 3", "printf '%-10s|\\n' a"]) assert.equal(v(c), "allow", c);
  for (const c of ["printf '%n' x", "printf '%5n' x", "printf '\\101'", "printf '\\x41'", "printf '%s' '`id`'"]) assert.equal(v(c), "ask", c);
});

test("CD472 a `timeout_ms` given to bash is read as `timeout` (Claude Code 2.1.322 repairs that name: timeout_ms → timeout), never when `timeout` is given too", async () => {
  const execs = [];
  let n = 0;
  await A.runCoder({
    send: async () => (n++ === 0 ? say("", [call("bash", { command: "npm test", timeout_ms: 300000 }, "b1"), call("bash", { command: "npm run lint", timeout_ms: "240000" }, "b2"), call("bash", { command: "make", timeout: 60000, timeout_ms: 500000 }, "b3")]) : say("ok")),
    exec: async (x) => { execs.push(x); return { code: 0, output: "ok\n" }; },
    emit: () => {}, here: () => "/work/p", root: "/work/p",
  }, { text: "go", mode: "auto" });
  assert.deepEqual(execs.filter((x) => !x.tool).map((x) => x.timeoutS), [300, 240, 60]);
});

test("CD473 a command asked to run in the background that ends in its first second still comes back with an ID and its output file, and Coder is then told it ended (Claude Code: run_in_background gives an ID at once)", async () => {
  const t = await job("p9d-bg-fast", [say("", [call("bash", { command: "echo quick", run_in_background: true, description: "Quick one" }, "b1")]), say("ok")]);
  assert.match(t.out("b1"), /^Command running in background with ID: job1\. Output is being written to: \S+bg-\d+\.log\./);
  const notes = t.st.events.filter((e) => e.type === "note").map((e) => e.text);
  assert.ok(notes.some((x) => x === "Background command \"Quick one\" completed (exit code 0)"), notes.join(" | "));
  // Its output file holds what it printed, and how it ended.
  const second = JSON.stringify(t.seen[1].messages);
  assert.match(second, /completed \(exit code 0\)\. Its output is in \S+bg-\d+\.log \(ID: job1\)/);
});

test("CD474 the owner's Stop while a command runs: Claude Code's answer (its rejection, then \"Correction to the text above: this call was stopped while running, not refused before it ran …\"), what it printed shown, the job ended", async () => {
  let stop = false;
  const events = [];
  let n = 0;
  const out = await A.runCoder({
    send: async () => (n++ === 0 ? say("", [call("bash", { command: "npm test" }, "b1")]) : say("never")),
    exec: async () => { stop = true; return { code: 143, output: "1 passing\n" }; },
    stopped: async () => stop,
    emit: (e) => events.push(e), here: () => "/work/p", root: "/work/p",
  }, { text: "go", mode: "auto" });
  assert.equal(told(out, "b1"), A.STOPPED_RUNNING);
  assert.match(A.STOPPED_RUNNING, /Correction to the text above: this call was stopped while running, not refused before it ran\. It may have run in part or in full/);
  assert.equal(events.find((e) => e.type === "result" && e.id === "b1").output, "1 passing\n(stopped by the owner while it ran)");
  assert.ok(events.some((e) => e.type === "stopped"));
  assert.equal(n, 1, "no further call to the model");
});

test("CD475 the owner's `!` command waits a command's default time (2 minutes) before it moves to the background, as Claude Code's does; one that printed more than the inline limit reaches Coder as Claude Code's saved output (its file and a 2,000-character preview)", async () => {
  const execs = [];
  const big = Array.from({ length: 6000 }, (_, k) => "line " + k).join("\n") + "\n";
  const seen = [];
  await A.runCoder({
    send: async (req) => { seen.push(req); return say("ok"); },
    exec: async (x) => { execs.push(x); return { code: 0, output: big, file: "/data/out/abc123.txt", size: Buffer.byteLength(big) }; },
    emit: () => {}, here: () => "/work/p", root: "/work/p",
  }, { shell: "cat big.log" });
  assert.equal(execs[0].timeoutS, 120);
  const msg = seen[0].messages.map((m) => (typeof m.content === "string" ? m.content : "")).find((x) => x.startsWith("<bash-stdout>"));
  assert.ok(msg && msg.includes("<persisted-output>\nOutput too large (") && msg.includes("Full output saved to: /data/out/abc123.txt") && msg.includes("Preview (first 2KB):\nline 0\n"), String(msg).slice(0, 300));
  assert.ok(msg.length < 4000, "not the whole output");
});

test("CD476 a monitor's output, within Claude Code's limits: a line cut at 500 characters, an event at 3,000, 10 events at once then one every 2 seconds, the rest counted and said (\"[N events suppressed — output rate too high …]\")", () => {
  const dir = mkdtempSync(join(tmpdir(), "p9d-mon-"));
  const log = join(dir, "bg-1.log");
  writeFileSync(log, "x".repeat(700) + "\nshort\n");
  const j = { project: "p9d-mon", id: "job1", pid: 999931, log, monitor: true, readAt: 0, part: "", pending: [], end: null, told: false, stopping: "" };
  try {
    const t0 = 5_000_000;
    S.readMonitor(j, { now: t0 });
    assert.deepEqual(j.pending, ["x".repeat(500) + "...(truncated)\nshort"]);
    for (let k = 1; k <= 11; k++) { appendFileSync(log, "e" + k + "\n"); S.readMonitor(j, { now: t0 + k }); }
    assert.equal(j.pending.length, 10);
    assert.equal(j.suppressed, 2);
    // Two seconds on, one goes through: first what was held back is said.
    appendFileSync(log, "later\n");
    S.readMonitor(j, { now: t0 + 2_100 });
    assert.deepEqual(j.pending.slice(-2), [S.monitorSuppressed(2), "later"]);
    assert.equal(S.monitorSuppressed(2), "[2 events suppressed — output rate too high. Consider using stop_job to restart this monitor with a more selective filter.]");
    assert.equal(j.events, 11);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CD477 a stopped command's own processes get one SIGTERM, not two: its process group is signalled as a whole, and the sweep for what it started elsewhere leaves that group out (some programs take a second SIGTERM as \"stop now\")", () => {
  const sent = [];
  const procs = new Map([[101, { pgrp: 100 }], [102, { pgrp: 100 }], [201, { pgrp: 201 }]]);
  const n = S.endMarked("0123456789abcdef", "SIGTERM", { look: () => procs, markOf: () => "0123456789abcdef", kill: (pid, sig) => { sent.push([pid, sig]); return true; }, skipGroup: 100 });
  assert.equal(n, 1);
  assert.deepEqual(sent, [[201, "SIGTERM"]], "only the one that left the group (setsid)");
  sent.length = 0;
  S.endMarked("0123456789abcdef", "SIGKILL", { look: () => procs, markOf: () => "0123456789abcdef", kill: (pid, sig) => { sent.push([pid, sig]); return true; } });
  assert.equal(sent.length, 3, "the end (SIGKILL) reaches every one");
});

test("CD478 a background command stuck on a typed question: after 45 quiet seconds, a last line like \"Continue? (y/n)\" (Claude Code's own patterns) tells Coder once, in Claude Code's words, with what it printed last; the idle chat is woken for it", async () => {
  let size = 40, tail = "Removing 3 packages\nDo you want to continue? [Y/n] ";
  const o = { sizeOf: () => size, tailOf: () => tail };
  const j = { project: "p9d-stall", id: "job2", pid: 999941, log: "/srv/bg-2.log", desc: "Remove packages", command: "apt-get remove x", end: null };
  S.JOBS.set(j.pid, j);
  try {
    assert.equal(S.watchStall(j, 1_000, o), false);
    assert.equal(S.watchStall(j, 40_000, o), false, "quiet for less than 45 seconds");
    size = 55;
    assert.equal(S.watchStall(j, 44_000, o), false, "it printed more: the clock starts again");
    assert.equal(S.watchStall(j, 80_000, o), false);
    assert.equal(S.watchStall(j, 90_000, o), true);
    assert.equal(S.watchStall(j, 200_000, o), false, "once for a command");
    assert.deepEqual(S.untoldOf("p9d-stall").map((x) => x.id), ["job2"], "the idle chat is woken for it");
    const news = S.stallNews("p9d-stall");
    assert.deepEqual(news.map((x) => [x.id, x.tail]), [["job2", "Removing 3 packages\nDo you want to continue? [Y/n]"]]);
    assert.deepEqual(S.stallNews("p9d-stall"), [], "told once");
    assert.deepEqual(S.untoldOf("p9d-stall"), []);
  } finally { S.JOBS.delete(j.pid); }
  // A last line that is no question: the 45 seconds start again.
  const k = { log: "/srv/bg-3.log", end: null };
  tail = "compiling 41/90";
  S.watchStall(k, 0, o);
  assert.equal(S.watchStall(k, 50_000, o), false);
  assert.equal(k.stallAt, 50_000);
  // Claude Code's patterns, on the last line only.
  for (const x of ["Proceed (y/n)", "Overwrite? [y/N]", "(yes/no) ", "Are you sure you want to drop it? ", "Press Enter to continue", "Press any key", "Continue?", "Overwrite?", "Ready to deploy?"]) assert.ok(S.looksLikePrompt(x), x);
  for (const x of ["Continue? (y/n)\nok, going on", "Done.", "Do you"]) assert.ok(!S.looksLikePrompt(x), x);
  // Never a monitor (Claude Code watches only shell commands).
  assert.equal(S.watchStall({ log: "/srv/m.log", monitor: true, end: null }, 999_999, o), false);
  // Coder is told after the round, and the chat shows it.
  const n = A.stallNotice({ id: "job2", desc: "Remove packages", log: "/srv/bg-2.log", tail: "Do you want to continue? [Y/n]" });
  assert.equal(n.said, "Background command \"Remove packages\" appears to be waiting for interactive input");
  assert.equal(n.note, "Background command \"Remove packages\" appears to be waiting for interactive input. Its output is in /srv/bg-2.log (ID: job2).\nLast output:\nDo you want to continue? [Y/n]\n\n" + A.STALL_HINT);
  assert.equal(A.STALL_HINT, "The command is likely blocked on an interactive prompt. Stop this task and re-run with piped input (e.g., `echo y | command`) or a non-interactive flag if one exists.");
  const events = [], seen = [];
  let calls = 0, given = false;
  await A.runCoder({
    send: async (req) => { seen.push(req); return calls++ === 0 ? say("", [call("bash", { command: "echo hi" }, "b1")]) : say("ok"); },
    exec: async () => ({ code: 0, output: "hi\n" }),
    bg: { alive: async () => true, stop: async () => true, stalls: async () => (given ? [] : (given = true, [{ id: "job2", desc: "Remove packages", log: "/srv/bg-2.log", tail: "Do you want to continue? [Y/n]" }])) },
    emit: (e) => events.push(e), here: () => "/work/p", root: "/work/p",
  }, { text: "go", mode: "auto" });
  assert.ok(events.some((e) => e.type === "note" && e.text === n.said && e.job === "job2"));
  assert.ok(seen[1].messages.some((m) => typeof m.content === "string" && m.content.includes(n.note)));
  // At a job's start (the chat woken for it, or the owner's next message).
  const seen2 = [];
  await A.runCoder({ send: async (req) => { seen2.push(req); return say("ok"); }, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { stalls: [{ id: "job2", desc: "Remove packages", log: "/srv/bg-2.log", tail: "Overwrite? (y/n)" }] });
  const first = seen2[0].messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  assert.match(first, /a background command still running may be stuck waiting for typed input\.\nBackground command "Remove packages" appears to be waiting for interactive input\./);
  assert.match(first, /The owner sent no message: this turn is only to tell you\./);
});

test("CD479 Claude Code's words in a command's result: \"Command timed out after 2m 0s\" and \"Command killed: output file exceeded 5GB\" before what it printed; blank lines at the start and white space at the end dropped; a failure cut only past 11,024 characters; a saved output's preview ending at a line break; \"(PowerShell completed with no output)\"; letters split between two reads kept whole", async () => {
  assert.deepEqual([0, 999, 30_000, 59_999, 60_000, 120_000, 600_000, 3_600_000, 5_400_000, 90_061_000].map((ms) => C.ccDuration(ms)), ["0s", "0s", "30s", "59s", "1m 0s", "2m 0s", "10m 0s", "1h 0m 0s", "1h 30m 0s", "1d 1h 1m"]);
  assert.deepEqual([300_000, 5_400_000, 3_600_000, 90_000].map((ms) => C.ccDuration(ms, { hideTrailingZeros: true })), ["5m", "1h 30m", "1h", "1m 30s"]);
  const dir = mkdtempSync(join(tmpdir(), "p9d-run-"));
  try {
    const t = await S.execIn(dir, "echo before; sleep 5", 1, { kill: true, uid: null, stopAtTimeout: true });
    assert.equal(t.code, 143);
    assert.equal(t.output, "Command timed out after 1s\nbefore\n");
    assert.equal(C.bashResultText({ output: t.output, isError: true, code: 143 }), "Exit code 143\nCommand timed out after 1s\nbefore");
    // A letter of four bytes written in two halves.
    const py = "import sys,time; e='\\U0001F600'.encode(); sys.stdout.buffer.write(b'x'+e[:2]); sys.stdout.flush(); time.sleep(0.3); sys.stdout.buffer.write(e[2:]+b'y\\n'); sys.stdout.flush()";
    const u = await S.execIn(dir, "python3 -c \"" + py + "\"", 30, { kill: true, uid: null });
    assert.equal(u.output, "x\u{1F600}y\n");
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.deepEqual([C.utf8Partial(Buffer.from([0x41, 0xf0, 0x9f])), C.utf8Partial(Buffer.from([0x41, 0xe2, 0x82])), C.utf8Partial(Buffer.from("a€")), C.utf8Partial(Buffer.from([0xc3]))], [2, 2, 0, 1]);
  assert.equal(C.bashResultText({ output: "\n\n  \nhello\n  \n\n" }), "hello");
  assert.equal(C.bashResultText({ output: "  indented\n" }), "  indented", "a line's own spaces stay");
  assert.equal(C.bashResultText({ output: "", tool: "PowerShell" }), "(PowerShell completed with no output)");
  assert.equal(C.bashResultText({ output: "x".repeat(11_000), isError: true, code: 1 }).length, "Exit code 1\n".length + 11_000);
  assert.match(C.bashResultText({ output: "x".repeat(11_100), isError: true, code: 1 }), /\.\.\. \[1112 characters truncated\] \.\.\./);
  const lines = Array.from({ length: 300 }, (_, k) => "row " + String(k).padStart(4, "0") + " " + "z".repeat(40)).join("\n");
  const saved = C.bashResultText({ output: lines, size: 60_000, file: "/out/f.txt", inlineMax: 30_000 });
  const preview = saved.split("Preview (first 2KB):\n")[1].split("\n...\n")[0];
  assert.ok(preview.length <= 2000 && preview.length > 1000 && lines.startsWith(preview) && lines[preview.length] === "\n", "it ends where a line ends");
});

test("CD480 a command moved to the background at its timeout shows what it printed as Claude Code does (its last 2,000 bytes from a line start, under \"[… earlier output omitted; full output: <file>]\"); one the owner moved shows none and no \"You will be notified when it completes\"; the long sleep's refusal names the monitor tool", () => {
  assert.equal(C.movedSoFar(Buffer.from("one\ntwo\n\n"), 9, "/f.log"), "one\ntwo");
  const big = Buffer.from("first line\n" + "a".repeat(2500) + "\nlast line\n");
  assert.equal(C.movedSoFar(big.subarray(-4096), big.length, "/srv/bg-1.log"), "[… earlier output omitted; full output: /srv/bg-1.log]\nlast line");
  assert.equal(B.sleepBlocked("sleep 30"), "Blocked: standalone sleep 30. To wait for a condition, use monitor with an until-loop (e.g. `until <check>; do sleep 2; done`). To wait for a command you started, use run_in_background: true. Do not chain shorter sleeps to work around this block.");
  assert.match(A.sleepBlockFor("Start-Sleep 30", true), /use monitor with an until-loop \(e\.g\. `until <check>; do sleep 2; done` — monitor runs bash\)/);
});

test("CD481 monitors in Claude Code's words: \"Monitor started (task …, expires in 5m …)\", and how one ended (\"stream ended\", \"ended without producing output (exit 0)\", \"script failed (exit 4)\", \"stopped\"); a deadline past an hour is refused (\"timeout_ms must be ≤ 3600000\"), one past 30 minutes cut to 30", async () => {
  assert.equal(A.monitorStarted("job3", 300_000), "Monitor started (task job3, expires in 5m unless the source ends first; you get one notice at expiry — re-arm if you still need the watch). You will be notified on each event. Keep working — do not poll or sleep. Events may arrive while you are waiting for the owner — an event is not their reply.");
  const end = (e) => A.monitorSaid({ id: "job3", desc: "Log", lines: [], end: e });
  assert.equal(end({ why: "exit", code: 0, events: 4 }), "Monitor \"Log\" (job3) stream ended.");
  assert.equal(end({ why: "exit", code: 0, events: 0 }), "Monitor \"Log\" (job3) ended without producing output (exit 0).");
  assert.equal(end({ why: "exit", code: 4, events: 2 }), "Monitor \"Log\" (job3) script failed (exit 4).");
  assert.equal(end({ why: "coder" }), "Monitor \"Log\" (job3) stopped.");
  assert.equal(A.monitorMs(2_400_000), 1_800_000);
  const execs = [];
  let n = 0;
  const out = await A.runCoder({
    send: async () => (n++ === 0 ? say("", [call("monitor", { command: "tail -f a.log", description: "Log", timeout_ms: 4_000_000 }, "m1")]) : say("ok")),
    exec: async (x) => { execs.push(x); return { code: 0, output: "" }; },
    emit: () => {}, here: () => "/work/p", root: "/work/p",
  }, { text: "go", mode: "auto" });
  assert.equal(told(out, "m1"), "timeout_ms must be ≤ 3600000");
  assert.equal(execs.filter((x) => x.monitor).length, 0, "not started");
});

test("CD482 the stop tool in Claude Code's words (TaskStop: its JSON when it stopped one, \"Task … is not running (status: …)\", \"No task found with ID: …\"); a rule naming its old names, KillShell or KillBash, is a rule on it", async () => {
  let n = 0;
  const events = [];
  let alive = true;
  const out = await A.runCoder({
    send: async () => [say("", [call("bash", { command: "npm run dev", run_in_background: true }, "b1")]), say("", [call("stop_job", { job: "job1" }, "s1")]), say("", [call("stop_job", { job: "job1" }, "s2")]), say("", [call("stop_job", { job: "job7" }, "s3")])][n++] || say("ok"),
    exec: async () => ({ code: -1, background: true, pid: 4321, log: "/srv/bg-1.log", output: "" }),
    bg: { alive: async () => alive, stop: async () => { alive = false; return true; }, status: async () => ({ alive: false, code: null, why: "coder" }) },
    emit: (e) => events.push(e), here: () => "/work/p", root: "/work/p",
  }, { text: "go", mode: "auto" });
  assert.deepEqual(JSON.parse(told(out, "s1")), { message: "Successfully stopped task: job1 (npm run dev)", task_id: "job1", task_type: "local_bash", command: "npm run dev" });
  assert.equal(events.find((e) => e.type === "result" && e.id === "s1").output, "Successfully stopped task: job1 (npm run dev)", "the page shows its message");
  assert.equal(told(out, "s2"), "Task job1 is not running (status: killed)");
  assert.equal(told(out, "s3"), "No task found with ID: job7");
  assert.deepEqual(["KillShell", "KillBash", "TaskStop"].map((r) => P.parseRule(r)), [{ tool: "TaskStop", spec: null }, { tool: "TaskStop", spec: null }, { tool: "TaskStop", spec: null }]);
  assert.equal(P.wholeRule({ deny: ["KillBash"] }, "deny", "TaskStop"), "KillBash");
});

test("CD483 auto mode's checker unreachable: Claude Code's words name why when it is known (\"temporarily unavailable (rate-limited)\", overloaded, server error, timed out, connection failed)", () => {
  const e = (props, msg = "x", Ctor = Error) => Object.assign(new Ctor(msg), props);
  assert.deepEqual([e({ status: 429 }), e({ status: 529 }), e({ status: 502 }), e({ name: "TimeoutError" }, "The operation was aborted due to timeout"), e({ cause: { code: "ECONNREFUSED" } }, "fetch failed", TypeError), e({ status: 400 })].map(K.unavailableWhy), ["rate-limited", "overloaded", "server error", "timed out", "connection failed", ""]);
  assert.match(K.checkUnavailable("grok-4.7", "this action", "rate-limited"), /^grok-4\.7 is temporarily unavailable \(rate-limited\), so auto mode cannot determine the safety of this action right now\./);
  assert.match(K.checkUnavailable("grok-4.7", "this action"), /^grok-4\.7 is temporarily unavailable, so auto mode/);
});

test("CD484 a Read or Edit deny rule that stops a command says so in Claude Code's words (\"cat from '…' was blocked by a deny rule.\", \"Output redirection to '…' …\", \"Input redirection from '…' …\", \"rm to '…' …\")", () => {
  const d = (c, deny) => P.bashDecision(c, { mode: "auto", rules: { allow: [], ask: [], deny }, cwd: "/w", workdirs: ["/w"], home: "/h" });
  assert.deepEqual([d("cat .env", ["Read(.env)"]).verdict, d("cat .env", ["Read(.env)"]).why], ["deny", "cat from '/w/.env' was blocked by a deny rule."]);
  assert.equal(d("echo x > .env", ["Edit(.env)"]).why, "Output redirection to '/w/.env' was blocked by a deny rule.");
  assert.equal(d("wc -l < .env", ["Read(.env)"]).why, "Input redirection from '/w/.env' was blocked by a deny rule.");
  assert.equal(d("rm -f .env", ["Edit(.env)"]).why, "rm to '/w/.env' was blocked by a deny rule.");
  assert.equal(d("cp .env /tmp/x", ["Read(.env)"]).why, "cp from '/w/.env' was blocked by a deny rule.");
});

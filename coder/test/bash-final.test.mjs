// TOOL 4, BASH: THE LAST GAPS (the owner, 2026-11-09: "anything else from the batch docs ?"): Claude Code 2.1.321, released
// that day, and the last points of its Bash docs Coder lacked. Each against its docs and its own code, read that day.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const W = "/work/shop";
const prot = (full) => { const rel = full.startsWith(W + "/") ? full.slice(W.length + 1) : ""; return rel && /^(\.husky|\.git|\.github)(\/|$)|(^|\/)\.npmrc$/.test(rel) ? "protected" : ""; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const serverSrc = () => readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");

test("CD336 a path written from \"$PWD\" is read as that path (Claude Code 2.1.321: \"Fixed Bash reads such as `grep -r foo \"$PWD/src\"` asking for permission when the same command with the path typed out runs without asking\"; its own pattern: one double-quoted \"$PWD/…\" or \"$(pwd)/…\" word with a plain path after it)", async () => {
  const P = await import("../container/coder-perms.mjs");
  const d = (cmd, mode, rules = {}) => P.bashDecision(cmd, { mode, rules, cwd: W, workdirs: [W], isProtected: prot }).verdict;
  // Reads in Plan: as the path typed out.
  for (const c of ["grep -r foo \"$PWD/src\"", "cat \"$(pwd)/README.md\"", "cd src && grep x \"$PWD/a.js\"", "grep -r foo /work/shop/src"]) assert.equal(d(c, "plan"), "allow", c);
  // Not this pattern, or a folder that can't be known: as before.
  for (const c of ["ls \"$PWD\"", "grep foo \"$PWD/src/$X\"", "grep foo $PWD/src", "PWD=/etc; cat \"$PWD/passwd\"", "export PWD=/etc; cat \"$PWD/x\"", "(cd /tmp; cat \"$PWD/x\")"]) assert.equal(d(c, "plan"), "ask", c);
  // File commands and writes in Accept edits: its real place, a protected file asked about.
  assert.equal(d("rm \"$PWD/build/out.js\"", "acceptEdits"), "allow");
  assert.equal(d("echo x > \"$PWD/notes.txt\"", "acceptEdits"), "allow");
  assert.equal(d("rm \"$PWD/.husky/pre-commit\"", "acceptEdits"), "ask");
  assert.equal(d("cd .husky && rm \"$PWD/pre-commit\"", "acceptEdits"), "ask");
  // A deny rule sees the real path too.
  assert.equal(d("cd /etc && cat \"$PWD/passwd\"", "auto", { deny: ["Bash(cat /etc/*)"] }), "deny");
});

test("CD337 a file command's short paths count from the folder that part runs in (Claude Code 2.1.321: \"Fixed a case where Bash permission checks judged a file write from the wrong folder and didn't prompt\"): a cd into a protected folder is followed; a cd inside ( … ), a function or $( … ) leaves the folder unknown", async () => {
  const P = await import("../container/coder-perms.mjs");
  const d = (cmd) => P.bashDecision(cmd, { mode: "acceptEdits", cwd: W, workdirs: [W], isProtected: prot });
  // Found 2026-11-09: these ran without asking in Accept edits, and each removes .husky/pre-commit.
  for (const c of ["cd .husky && rm pre-commit", "cd src; cd ../.husky; rm pre-commit", "cd .husky; mv pre-commit x"]) assert.deepEqual([c, d(c).verdict, d(c).why], [c, "ask", "This command changes a protected file."]);
  for (const c of ["(cd .husky; rm pre-commit)", "(cd src && npm test); rm a.txt", "echo $(cd .husky && pwd); rm pre-commit"]) assert.equal(d(c).verdict, "ask", c);
  // Inside the project, as before.
  for (const c of ["cd src && rm a.txt", "cd src && mv a.js b.js", "rm a.txt"]) assert.equal(d(c).verdict, "allow", c);
  // (Two folder changes ask since the live side-by-side of 2026-11-10, as in Claude Code 2.1.322: CD361.)
  assert.deepEqual([d("cd src && cd .. && rm a.txt").verdict, d("cd src && cd .. && rm a.txt").why], ["ask", "Multiple directory changes in one command require approval for clarity"]);
  assert.equal(d("rm .husky/pre-commit").verdict, "ask");
  // Each part knows its folder.
  const r = P.readCommand("cd src && touch a; (cd x; touch b); touch c", { cwd: W });
  assert.deepEqual(r.cmds.map((c) => [c.words.map((w) => w.text).join(" "), c.dir]), [["cd src", W], ["touch a", W + "/src"], ["cd x", W + "/src"], ["touch b", false], ["touch c", false]]);
});

test("CD338 background commands are stopped when memory runs critically low while the chat is idle (Claude Code's docs and 2.1.321's own rule: the kernel's memory stall of 150 ms in 2 seconds, idle 30 minutes, no turn running, MemAvailable under 10% and under 4 GiB; CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1 turns it off), and Coder is told in Claude Code's words", async () => {
  const S = await import("../container/server.mjs");
  const A = await import("../container/coder-agent.mjs");
  assert.equal(S.PRESSURE_STALL, 0.075);
  assert.equal(S.memoryStallUs(() => "some avg10=0.00 avg60=0.00 avg300=0.00 total=123456\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=99\n"), 123456);
  assert.equal(S.memoryStallUs(() => { throw new Error("no PSI"); }), null);
  const mem = (avail) => () => "MemTotal:       16384000 kB\nMemFree:          100000 kB\nMemAvailable:   " + avail + " kB\n";
  assert.equal(S.memoryScarce(mem(1_000_000)).scarce, true, "6% and under 4 GiB");
  assert.equal(S.memoryScarce(mem(3_000_000)).scarce, false, "18%");
  assert.equal(S.memoryScarce(() => "nothing").scarce, false);
  // Why one is not stopped, in Claude Code's order.
  const now = Date.now(), j = { pid: 1, id: "job1", at: now - 60 * 60_000 };
  const ok = { critical: true, idleMs: 31 * 60_000, running: false, scarce: () => ({ scarce: true }) };
  assert.equal(S.pressureSkip(j, ok), "");
  assert.equal(S.pressureSkip({ ...j, noReap: true }, ok), "turned off (CODER_DISABLE_BG_SHELL_PRESSURE_REAP)");
  assert.equal(S.pressureSkip(j, { ...ok, critical: false }), "pressure level is not critical");
  assert.equal(S.pressureSkip(j, { ...ok, running: true }), "a turn is running");
  assert.equal(S.pressureSkip(j, { ...ok, idleMs: 10 * 60_000 }), "chat active in the last 30m");
  assert.equal(S.pressureSkip({ ...j, at: now - 5 * 60_000 }, { ...ok, lastReap: now - 10 * 60_000, lastInput: now - 20 * 60_000 }), "started soon after an earlier pressure stop, no new message since");
  assert.match(S.pressureSkip(j, { ...ok, scarce: () => ({ scarce: false, detail: "x" }) }), /^host memory is not scarce/);
  // For real: a background command (its own process group) of a chat with no turn for 31 minutes.
  const dir = await mkdtemp(join(tmpdir(), "coder-mem-"));
  const p = await S.execIn(dir, "echo started; sleep 60", 1, { bgDir: join(dir, "bg") });
  assert.equal(p.background, true);
  const job = { project: "shop-mem1", id: "job1", pid: p.pid, log: p.log, command: "sleep 60", desc: "", cwd: dir, at: now - 31 * 60_000, moved: true, deadline: now + 60 * 60_000, box: false, end: null, told: false, stopping: "" };
  S.JOBS.set(p.pid, job);
  try {
    const reading = (us) => ({ stall: () => us, scarce: () => ({ scarce: true, detail: "test" }) });
    S.checkJobs(now, reading(5_000_000));
    S.checkJobs(now + 5000, reading(5_000_000 + 100_000)); // 2% of the time stalled: not critical
    assert.equal(job.stopping, "", "not stopped below the line");
    S.checkJobs(now + 10_000, reading(5_000_000 + 100_000 + 1_000_000)); // 20%: critical
    assert.equal(job.stopping, "memory");
    for (let k = 0; k < 40 && !job.end; k++) await wait(100);
    assert.equal(job.end && job.end.why, "memory");
    assert.ok([143, 137].includes(job.end.code), "ended by the stop: " + job.end.code);
  } finally { S.JOBS.delete(p.pid); try { process.kill(-p.pid, "SIGKILL"); } catch { /* gone */ } await rm(dir, { recursive: true, force: true }); }
  // Turned off: kept with the command when it started.
  const s = serverSrc();
  assert.match(s, /t\.noReap = varOn\(rawVars\.CODER_DISABLE_BG_SHELL_PRESSURE_REAP\);/);
  assert.match(s, /stopping: "", noReap: t\.noReap === true \}\);/);
  // What Coder and the chat are told.
  const n = A.bgEndNotice({ id: "job1", desc: "Start the dev server", command: "npm run dev", log: "/srv/coder-bg/bg-1.log", code: 137, why: "memory" });
  assert.equal(n.said, "Background command \"Start the dev server\" was stopped because the system is running low on memory");
  assert.ok(n.note.includes("This is not a failure of the command.") && n.note.includes("Do not start it again on your own") && n.note.includes("CODER_DISABLE_BG_SHELL_PRESSURE_REAP=1"));
  assert.deepEqual(n.end, { ok: false, label: "low memory" });
});

test("CD339 CODER_SHELL_PREFIX wraps each of the chat's commands (Claude Code's CLAUDE_CODE_SHELL_PREFIX: \"runs each command as `/path/to/logger.sh '<command>'`\", the full invocation in $1, which the wrapper runs with `exec bash -c \"$1\"`)", async () => {
  const S = await import("../container/server.mjs");
  assert.equal(S.shellPrefixOf(""), "");
  assert.equal(S.shellPrefixOf(" /opt/audit/log.sh "), "/opt/audit/log.sh");
  assert.equal(S.shellPrefixOf("/x\n/y"), "");
  assert.equal(S.shellPrefixOf("x".repeat(1001)), "");
  const dir = await mkdtemp(join(tmpdir(), "coder-prefix-"));
  const logger = join(dir, "log.sh"), logFile = join(dir, "commands.log");
  await writeFile(logger, "#!/bin/sh\nprintf '%s\\n---\\n' \"$1\" >> " + logFile + "\nexec bash -c \"$1\"\n");
  await chmod(logger, 0o755);
  try {
    const r = await S.execIn(dir, "echo hi; cd /tmp && pwd", 10, { shellPrefix: logger, follow: true });
    assert.deepEqual([r.code, r.output, r.ended], [0, "hi\n/tmp\n", "/tmp"], "the command ran, and its folder is still followed");
    const logged = await readFile(logFile, "utf8");
    assert.ok(logged.includes("echo hi; cd /tmp && pwd") && logged.includes("trap '"), "the wrapper got the whole invocation");
  } finally { await rm(dir, { recursive: true, force: true }); }
  const s = serverSrc();
  assert.match(s, /t\.shellPrefix = shellPrefixOf\(rawVars\.CODER_SHELL_PREFIX\);/);
  assert.match(s, /\.\.\.\(tool \? \{\} : \{ onMove, onProgress: [^\n]*shellPrefix: t\.shellPrefix \|\| "" \}\)/, "the chat's commands only, never Coder's tools");
});

test("CD340 the effort level is in each command's environment (Claude Code's CLAUDE_EFFORT: \"Set automatically in Bash tool subprocesses … to the effort level … Only set when the current model supports the effort parameter\"), as GOFARTHER_CODER_EFFORT beside Coder's other marks", async () => {
  const S = await import("../container/server.mjs");
  assert.deepEqual(S.coderMarks("shop-ab12", "", "high"), { GOFARTHER_CODER: "1", GOFARTHER_CODER_CHAT_ID: "shop-ab12", GOFARTHER_CODER_EFFORT: "high" });
  assert.equal(S.coderMarks("shop-ab12", "", "turbo").GOFARTHER_CODER_EFFORT, undefined);
  assert.equal(S.coderMarks("shop-ab12", "").GOFARTHER_CODER_EFFORT, undefined, "no model chosen: not set");
  assert.match(serverSrc(), /coderMarks\(project, body\.chatUrl, body\.model \? pickModel\(body\.model, body\.effort\)\.effort : ""\)/);
});

test("CD341 in every mode (Auto too), a file command that changes a protected file is asked about from the folder it really runs in (found preparing the live test, 2026-11-10: in Auto, `cd .husky && rm pre-commit` ran without asking; Claude Code: writes to protected paths \"are never auto-approved\"), and after a cd into a protected folder at any level", async () => {
  const A = await import("../container/coder-agent.mjs");
  const deps = { root: W, here: () => W };
  const ask = (c) => { const a = A.commandAsk(c, deps, W); return a ? a.kind : null; };
  for (const c of ["cd .husky && rm pre-commit", "(cd .husky; rm pre-commit)", "(cd ./.husky/ && touch x)", "cd src/../.husky && rm -f pre-commit", "(cd src; rm ../.husky/pre-commit)", "rm .husky/pre-commit", "cd .git && rm config"]) assert.equal(ask(c), "protected", c);
  for (const c of ["cd .husky && ls", "(cd src; rm a.txt)", "cd src && rm a.txt", "rm a.txt"]) assert.equal(ask(c), null, c);
  assert.deepEqual(A.commandAsk("cd .husky && rm pre-commit", deps, W).paths, [W + "/.husky", W + "/.husky/pre-commit"]);
});

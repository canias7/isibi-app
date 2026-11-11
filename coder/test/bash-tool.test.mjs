// TOOL 4, BASH, AS CLAUDE CODE'S (the owner, 2026-11-09: "do all of those and double check again against the claude code
// docs pls"). Each check against Claude Code's docs and against Claude Code 2.1.319 itself, tried that day (its words are
// quoted as it gave them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, readdir, utimes } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseShell, unwrapped } from "../container/coder-shell.mjs";
import { exitMeaning, sleepBlocked, leadsWithSleep, writeTargets, dangerousRm } from "../container/coder-bashcheck.mjs";
import { bashResultText, kbSize, commandProblem } from "../container/coder-checks.mjs";

const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("CD267 bash: a command read as bash reads it, every simple command wherever it sits (separators, quotes, $(…), backticks, subshells, groups, here-documents, case, functions, find -exec, xargs, sh -c), so Claude Code's checks see them all", () => {
  const cmds = (c) => parseShell(c).commands.map((k) => unwrapped(k.words).map((w) => w.text).join(" "));
  assert.deepEqual(cmds("cd app && npm run build > out.log 2>&1; echo 'a;b' | grep ';'"), ["cd app", "npm run build", "echo a;b", "grep ;"]);
  assert.ok(cmds("echo \"$(rm -rf ~)\"").includes("rm -rf ~"), "inside $(…)");
  assert.ok(cmds("echo `rm -rf ~`").includes("rm -rf ~"), "inside backticks");
  assert.ok(cmds("(rm -rf ~)").includes("rm -rf ~") && cmds("{ rm -rf ~; }").includes("rm -rf ~"), "a subshell, a group");
  assert.ok(cmds("bash -c 'rm -rf ~'").includes("rm -rf ~"), "a script given to a shell with -c");
  assert.ok(cmds("find . -name '*.tmp' -exec sh -c \"rm -rf \\\"$1\\\"/*\" _ {} \\;").includes("rm -rf $1/*"), "Claude Code's own example: sh -c run by find -exec");
  assert.ok(cmds("case $x in a) rm -rf /;; esac").includes("rm -rf /") && cmds("f() { rm -rf x; }").includes("rm -rf x"), "case, functions");
  assert.ok(cmds("sudo -u root timeout 30 nice -n 5 rm -rf /usr").includes("rm -rf /usr"), "past wrappers");
  // A here-document's body is data, not commands, when its word is quoted; an unquoted one's $(…) runs.
  assert.ok(!cmds("cat > x <<'EOF'\nrm -rf ~\nEOF").includes("rm -rf ~"));
  assert.ok(cmds("cat > x <<EOF\n$(rm -rf ~)\nEOF").includes("rm -rf ~"));
  assert.equal(parseShell("echo 'open").ok, false, "an open quote: not read through");
});

test("CD268 bash: an exit code as Claude Code reads it (its table, 2.1.319): 1 is no failure for grep, rg, egrep, fgrep (\"No matches found\"), find, diff (\"Files differ\"), test and [ (\"Condition is false\"), git diff and git grep; 2 or more is; any other command's non-zero exit is; the last command decides", () => {
  const e = (c, n) => exitMeaning(c, n);
  assert.deepEqual(e("grep x f", 1), { isError: false, message: "No matches found" });
  assert.deepEqual(e("grep x f", 2), { isError: true, message: "" });
  assert.deepEqual(e("find . -name x", 1), { isError: false, message: "Some directories were inaccessible" });
  assert.deepEqual(e("diff a b", 1), { isError: false, message: "Files differ" });
  assert.deepEqual(e("[ -f x ]", 1), { isError: false, message: "Condition is false" });
  assert.deepEqual(e("git -C sub diff", 1), { isError: false, message: "Files differ" });
  assert.deepEqual(e("git grep foo", 1), { isError: false, message: "No matches found" });
  assert.deepEqual(e("npm test | grep FAIL", 1), { isError: false, message: "No matches found" }, "the last command decides");
  assert.deepEqual(e("grep x f | wc -l", 1), { isError: true, message: "Command failed with exit code 1" });
  assert.deepEqual(e("ls nope", 2), { isError: true, message: "Command failed with exit code 2" });
  assert.deepEqual(e("pgrep x", 1).isError, true, "pgrep's 1 is a failure, as the docs say");
});

test("CD269 bash: a foreground sleep of 25 seconds or more is refused in Claude Code's words (tried: \"Blocked: standalone sleep 30. …\", \"Blocked: sleep 26 followed by: echo hi. …\"); shorter ones run; a command that starts with sleep is never moved to the background", () => {
  assert.match(sleepBlocked("sleep 30"), /^Blocked: standalone sleep 30\. To wait for a condition, run an until-loop in the background \(run_in_background: true, e\.g\. `until <check>; do sleep 2; done`\): you are told when it ends\. To wait for a command you started, use run_in_background: true\. Do not chain shorter sleeps to work around this block\.$/);
  assert.match(sleepBlocked("sleep 26; echo hi"), /^Blocked: sleep 26 followed by: echo hi\./);
  assert.match(sleepBlocked("sleep 30 && npm test"), /^Blocked: sleep 30 followed by: npm test\./);
  for (const c of ["sleep 24", "sleep 2", "echo a; sleep 60", "sleep 1.5"]) assert.equal(sleepBlocked(c), "", c);
  assert.equal(leadsWithSleep("sleep 5; echo after"), true);
  assert.equal(leadsWithSleep("npm test"), false);
});

test("CD270 bash: the files a command writes, as Claude Code checks them (its permissions docs, Redirections: > file, >> file, 2> file and tee, also in a pipeline; /dev/null and 2>&1 not), and whether a cd came first", () => {
  const t = (c) => writeTargets(c).targets.map((x) => [x.path, x.afterCd]);
  assert.deepEqual(t("echo hi > .npmrc"), [[".npmrc", false]]);
  assert.deepEqual(t("make | tee build.log | tee -a .envrc"), [["build.log", false], [".envrc", false]]);
  assert.deepEqual(t("ls > /dev/null 2>&1"), []);
  assert.deepEqual(t("cd x && echo a >> out.txt"), [["out.txt", true]]);
  assert.deepEqual(t("cat > .husky/pre-commit <<'EOF'\nnpm test\nEOF"), [[".husky/pre-commit", false]]);
  assert.deepEqual(t("cmd &> all.log"), [["all.log", false]]);
});

test("CD271 bash: Claude Code's critical-path rm check, every case its docs list (the root, a top-level folder, the home folder, the working directory and its parents, a glob under another working directory, \"$DIR\"/*, $1/, \"$TMPDIR/mnt\", a variable set from $(pwd), \"$(pwd)\", ~/$(cmd), a backslash, logs/*/*, cd then a relative glob, inside $(…), (…), bash -c and find -exec sh -c, mounted drives, a command the shell may read differently), in its words; ordinary removals pass", () => {
  const ctx = { cwd: "/work/proj", home: "/home/dev", workdirs: ["/work/proj", "/work/proj-x1"] };
  const flagged = ["rm -rf /", "rm -rf /usr", "rm -rf ~", "rm -rf $HOME", "rm -rf ~/", "rm -rf .", "rm -rf ..", "rm -rf ./*", "rm -rf *", "rm -rf /work", "rm -rf /work/proj", "rm -rf /work/proj-x1/*", "rm -rf \"$DIR\"/*", "rm -rf $1/", "rm -rf \"$TMPDIR/mnt\"", "D=$(pwd); rm -rf \"$D\"", "rm -rf \"$(pwd)\"", "rm -rf ~/$(whoami)", "rm -rf logs/*/*", "rm -rf logs/*/", "cd logs && rm -rf a/*", "cd .. && rm -rf proj", "(rm -rf ~)", "echo \"$(rm -rf ~)\"", "bash -c 'rm -rf ~'", "find . -name '*.tmp' -exec sh -c \"rm -rf \\\"$1\\\"/*\" _ {} \\;", "sudo rm -rf /etc", "rm -rf '\\\\'", "rm -rf /mnt/data", "rm x 'unterminated", "rmdir /usr", "rm -rf -- /"];
  const fine = ["rm -rf build", "rm -rf ./dist node_modules", "rm -f *.log", "rm -rf build/*", "rm -rf /tmp/x", "rm -rf ~/projects", "rm -rf /work/proj-x1", "rm -rf \"${DIR:?}\"/*", "cd sub && rm -rf build", "find . -name '*.tmp' -exec sh -c 'rm -rf \"$1\"/*' _ {} \\;", "echo 'rm -rf /'", "git rm -r --cached x", "xargs rm -rf < list.txt", "rm -rf ../other"];
  for (const c of flagged) assert.ok(dangerousRm(c, ctx), "flagged: " + c);
  for (const c of fine) assert.equal(dangerousRm(c, ctx), "", "fine: " + c);
  // Claude Code's own words (2.1.319).
  assert.equal(dangerousRm("rm -rf /usr", ctx), "Dangerous rm operation detected: '/usr'\n\nThis command would remove a critical system directory. This requires explicit approval and cannot be auto-allowed by permission rules.");
  assert.equal(dangerousRm("rm -rf .", ctx), "Dangerous rm operation detected: '.'\n\nThis command would remove a workspace directory (the working directory, an additional working directory, or one of their parent directories). This requires explicit approval and cannot be auto-allowed by permission rules.");
  assert.match(dangerousRm("rm -rf \"$(pwd)\"", ctx), /^Dangerous rm operation detected: the target is the output of a command substitution \(`\$\(\.\.\.\)` or backticks\) and cannot be checked before the command runs\. This requires explicit approval and cannot be auto-allowed by permission rules\.\n\nRun the substitution on its own first, then remove the literal paths it prints\.$/);
  assert.match(dangerousRm("bash -c \"rm -rf $X/*\"", ctx), /^Dangerous rm operation in a shell -c script: its target is built from a variable or command output known only when it runs, and if that is empty the rm can reach a directory like \/ or your home directory\. .* Pass a literal path, or guard the value with \$\{NAME:\?\}\.$/);
  assert.equal(dangerousRm("rm x 'unterminated", ctx), "This command could not be checked for dangerous rm operations: the shell may read it differently than it was parsed. This requires explicit approval.");
  assert.match(dangerousRm("cd logs && rm -rf a/*", ctx), /This command changes directories before the removal, so the relative glob target cannot be statically resolved\./);
  assert.match(dangerousRm("rm -rf /mnt/data", ctx), /^Dangerous rm operation on mounted drive path: \/mnt\/data\n\nThis command would remove a mounted drive/);
});

test("CD272 bash: a result in Claude Code's words (tried, 2026-11-09): output as it came, its last line break dropped; \"(Bash completed with no output)\"; past 30,000 characters \"<persisted-output>\\nOutput too large (38KB). Full output saved to: …\\n\\nPreview (first 2KB):\\n…\\n...\\n</persisted-output>\"; a failure \"Exit code N\" with up to 10,000 characters, past that the first and last 5,000 of the first 30,000 with \"... [N characters truncated] ...\"", () => {
  assert.equal(bashResultText({ output: "2c2\n< b\n---\n> c\n" }), "2c2\n< b\n---\n> c");
  assert.equal(bashResultText({ output: "" }), "(Bash completed with no output)");
  const seq = Array.from({ length: 8000 }, (_, k) => String(k + 1)).join("\n") + "\n";
  assert.equal(seq.length, 38893);
  assert.equal(kbSize(seq.length), "38KB");
  assert.equal(kbSize(30413), "29.7KB");
  assert.equal(bashResultText({ output: seq, size: seq.length, file: "/data/memory/p.out/bu578qprf.txt" }), "<persisted-output>\nOutput too large (38KB). Full output saved to: /data/memory/p.out/bu578qprf.txt\n\nPreview (first 2KB):\n" + seq.slice(0, 2000) + "\n...\n</persisted-output>");
  // Claude Code's `seq 1 8000; exit 3`: "Exit code 3\n1\n…\n1219\n\n\n... [20012 characters truncated] ...\n\n22\n5223\n…".
  const failed = bashResultText({ output: seq, isError: true, code: 3, size: seq.length });
  const full = "Exit code 3\n" + seq.slice(0, 30000);
  assert.equal(failed, full.slice(0, 5000) + "\n\n... [20012 characters truncated] ...\n\n" + full.slice(-5000));
  assert.ok(failed.startsWith("Exit code 3\n1\n2\n") && failed.includes("1219\n\n\n... [20012 characters truncated] ...\n\n22\n5223\n"), "the same cut as Claude Code's");
  assert.equal(bashResultText({ output: "ls: cannot access '/nonexistent-xyz': No such file or directory\n", isError: true, code: 2 }), "Exit code 2\nls: cannot access '/nonexistent-xyz': No such file or directory");
  // A command over 10,000 characters is asked about (a card), not refused; past 100,000 it never runs.
  assert.equal(commandProblem("x".repeat(20000)), "");
});

test("CD273 bash on Coder's machine: output past 30,000 characters goes on in a file (Claude Code: \"streams a command's output to a working file\"), whole, without Coder's folder line; a command that starts with sleep is stopped at its timeout, \"Command timed out after Ns\" with exit code 143 (Claude Code, tried); a picture printed as a data URL is saved for read; a full disk is said in Claude Code's words", async () => {
  const { execIn, diskFull, savePrinted, keepNewest } = await import("../container/server.mjs");
  const dir = await mkdtemp(join(tmpdir(), "coder-bash-"));
  const out = join(dir, "out");
  const big = await execIn(dir, "seq 1 8000", 30, { spillDir: out, follow: true });
  assert.equal(big.code, 0);
  assert.equal(big.size, 38893);
  assert.ok(big.file && big.file.startsWith(out + "/"), "saved in the output folder");
  assert.equal(await readFile(big.file, "utf8"), Array.from({ length: 8000 }, (_, k) => String(k + 1)).join("\n") + "\n", "the whole output, and no folder line");
  const small = await execIn(dir, "echo hi", 30, { spillDir: out });
  assert.equal(small.output, "hi\n");
  assert.equal(small.file, undefined, "short output stays inline");
  const t0 = Date.now();
  const slept = await execIn(dir, "sleep 5; echo after", 1, { spillDir: out, stopAtTimeout: true });
  assert.ok(Date.now() - t0 < 4000);
  assert.deepEqual([slept.code, slept.output, slept.background], [143, "Command timed out after 1s", undefined]);
  const moved = await execIn(dir, "echo start; sleep 2; echo later", 1, { spillDir: out, bgDir: join(dir, "bg") });
  assert.equal(moved.background, true, "any other command is moved to the background at its timeout");
  // A picture printed as a data URL.
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const saved = savePrinted("data:image/png;base64," + png.toString("base64") + "\n", out);
  assert.equal(saved.pictureType, "image/png");
  assert.deepEqual(await readFile(saved.picture), png);
  assert.deepEqual(savePrinted("not a picture", out), {});
  // A full disk: under 10 MB free, or under 1,000 free inodes.
  const fs = (mb, ffree = 50000n) => () => ({ blocks: 1000n, bavail: BigInt(mb) * 256n, bsize: 4096n, files: 100000n, ffree });
  assert.deepEqual(diskFull(["/x"], 10, { statfs: fs(3) }), { dir: "/x", mb: 3 });
  assert.equal(diskFull(["/x"], 10, { statfs: fs(500) }), null);
  assert.deepEqual(diskFull(["/x"], 10, { statfs: fs(500, 12n) }), { dir: "/x", inodes: 12 });
  // The output folder keeps the newest files only.
  // (Each a second newer than anything before it: files written in the same millisecond would tie.)
  for (let k = 0; k < 5; k++) { await writeFile(join(out, "f" + k + ".txt"), "x"); const at = new Date(Date.now() + (k + 1) * 1000); await utimes(join(out, "f" + k + ".txt"), at, at); }
  await keepNewest(out, 3);
  assert.equal((await readdir(out)).filter((x) => x.endsWith(".txt")).length, 3);
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /"Disk full: this computer's volume holding " \+ full\.dir \+ " has " \+ full\.mb \+ " MB free, so this command's output may be cut short and its own writes may have failed with \\"No space left on device\\"\. "/);
  assert.match(server, /"The command was not started: this computer's disk is full \(ENOSPC\) on the volume holding " \+ full\.dir \+ " \(Coder's folder for command output\), so the file that captures command output could not be created there and nothing ran\. "/);
});

test("CD274 bash in the agent: Claude Code's inputs (description shown in place of the command, command_description too, timeout in milliseconds cut to the most), its refusals (a long sleep, a dangerous rm in its own words, the same command still running in the background), its cards (a protected file written by > or tee; a command over 10,000 characters), its result words, and a background command's notice when it ends", async () => {
  const { runCoder, CODER_TOOLS, RM_REFUSED, allowRunText } = await import("../container/coder-agent.mjs");
  const tool = CODER_TOOLS.find((t) => t.function.name === "bash").function;
  assert.deepEqual(Object.keys(tool.parameters.properties), ["command", "description", "timeout", "run_in_background"]);
  assert.match(tool.description, /Give `description`: what the command does, in a few plain words in active voice/);
  assert.match(tool.description, /`timeout` in milliseconds: 120000 by default, at most 600000/);
  const execs = [], events = [];
  let bgAlive = true;
  const exec = async (x) => {
    execs.push(x);
    if (x.command.startsWith("python3 -m http.server")) return { code: -1, background: true, pid: 77, log: "/out/bg-1.log", output: "" };
    if (x.command === "grep TODO a.js") return { code: 1, output: "" };
    if (x.command === "make") return { code: -1, background: true, pid: 78, log: "/out/bg-2.log", output: "building\n", timedOut: true };
    return { code: 0, output: "ok\n" };
  };
  const long = "echo " + "x".repeat(10_001);
  const steps = [
    say("", [call("bash", { command: "npm test", description: "Run the test suite", timeout: 900000 }, "a1"), call("bash", { command: "grep TODO a.js", command_description: "Look for TODO notes" }, "a2")]),
    say("", [call("bash", { command: "sleep 30" }, "b1"), call("bash", { command: "rm -rf \"$DIR\"/*" }, "b2")]),
    say("", [call("bash", { command: "python3 -m http.server 8000", description: "Serve the folder", run_in_background: true }, "c1"), call("bash", { command: "make", timeout: 2000 }, "c2")]),
    say("", [call("bash", { command: "make" }, "d1")]),
    say("", [call("bash", { command: "echo registry=x > .npmrc", description: "Point npm at the example registry" }, "e1"), call("bash", { command: "echo after" }, "e2")]),
  ];
  let n = 0;
  const r = await runCoder({ send: async () => steps[Math.min(n++, steps.length - 1)], exec, emit: (e) => events.push(e), here: () => "/work/p", root: "/work/p", where: (p) => (p.startsWith("/") ? p : "/work/p/" + p), bg: { alive: async (pid) => pid === 77 ? bgAlive : pid === 78, stop: async () => true, status: async (pid) => (pid === 77 ? (bgAlive ? { alive: true } : { alive: false, code: 0 }) : { alive: true }) } }, { text: "go" });
  const reply = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  const step = (id) => events.find((e) => e.type === "bash" && e.id === id);
  const result = (id) => events.find((e) => e.type === "result" && e.id === id);
  // The description is what the owner sees; the timeout is cut to the most (600 s), not refused.
  assert.equal(step("a1").desc, "Run the test suite");
  assert.equal(step("a2").desc, "Look for TODO notes", "command_description is taken for description");
  assert.equal(execs.find((x) => x.command === "npm test").timeoutS, 600);
  assert.equal(reply("a1"), "ok");
  // grep's exit 1: no failure, no "Exit code" line, and not marked failed for the owner.
  assert.equal(reply("a2"), "(Bash completed with no output)");
  assert.equal(result("a2").ok, true);
  assert.equal(reply("b1").startsWith("Blocked: standalone sleep 30."), true);
  assert.equal(reply("b2"), RM_REFUSED + "Dangerous rm operation detected: '\"$DIR\"/*'\n\nIf $DIR is unset or empty, this removes from the filesystem root. Guard it as \"${DIR:?}\"/*, which makes the shell stop with an error instead, or use a literal path. This requires explicit approval and cannot be auto-allowed by permission rules.");
  assert.ok(!execs.some((x) => /sleep 30|rm -rf/.test(x.command)), "neither ran");
  // Background: Claude Code's words, started and moved; the same moved command again is not started.
  assert.equal(reply("c1"), "Command running in background with ID: job1. Output is being written to: /out/bg-1.log. You will be notified when it completes. To check interim output, use read on that file path.");
  assert.equal(reply("c2"), "building\nCommand did not complete within its 2s timeout and was moved to the background (ID: job2). Output is being written to: /out/bg-2.log. You will be notified when it completes. If it is still running after 30m in the background, it will be stopped and you will be notified. It is running now: do not start a second copy while it runs. If it is no longer needed, stop it with stop_job. To check interim output, use read on that file path.");
  assert.match(reply("d1"), /^Not started: this same command, in this directory, was moved to the background and has been running for \d+s \(ID: job2\)\. Its output is being written to: \/out\/bg-2\.log\. Let it finish, or, to run it again now, stop it first with stop_job\.$/);
  // A protected file written by a redirection: the card, the job stops there, nothing after it runs.
  const card = events.find((e) => e.type === "runask");
  assert.deepEqual({ kind: card.kind, paths: card.paths, allow: card.allow, lines: card.lines, desc: card.desc }, { kind: "protected", paths: [".npmrc"], allow: "I allowed Coder to change .npmrc.", lines: ["echo registry=x > .npmrc"], desc: "Point npm at the example registry" });
  assert.match(reply("e1"), /^not run yet: this command writes \.npmrc, a protected file \(it can make code run on the owner's computer when the branch is pulled, or change how the project is built\), so the owner is asked first, as Claude Code asks for such commands\./);
  assert.equal(reply("e2"), "not run: you asked the owner to allow a command first");
  assert.ok(!execs.some((x) => /registry=x|echo after/.test(x.command)));
  // Allowed (the card's own words, as the owner's message): it runs. The same Allow as write's card.
  execs.length = 0; n = 0;
  const allowed = [...r.messages, { role: "user", content: "I allowed Coder to change .npmrc." }];
  await runCoder({ send: async () => [say("", [call("bash", { command: "echo registry=x > .npmrc" }, "f1")]), say("Done.")][Math.min(n++, 1)], exec, emit: () => {}, here: () => "/work/p", root: "/work/p", where: (p) => "/work/p/" + p }, { messages: allowed, text: "" });
  assert.ok(execs.some((x) => x.command === "echo registry=x > .npmrc"), "allowed: run");
  // A command over 10,000 characters: its own card and words.
  const ev2 = []; n = 0;
  await runCoder({ send: async () => [say("", [call("bash", { command: long }, "g1")]), say("Done.")][Math.min(n++, 1)], exec, emit: (e) => ev2.push(e) }, { text: "go" });
  const card2 = ev2.find((e) => e.type === "runask");
  assert.deepEqual([card2.kind, card2.allow], ["long", allowRunText(long)]);
  assert.match(card2.allow, /^I allowed Coder to run command [0-9a-f]{8}\.$/);
  // From GitHub, where no one can answer: refused, not asked.
  const ev3 = []; n = 0;
  const gh = await runCoder({ send: async () => [say("", [call("bash", { command: "echo x > .npmrc" }, "h1")]), say("Done.")][Math.min(n++, 1)], exec, emit: (e) => ev3.push(e), here: () => "/work/p", root: "/work/p", where: (p) => "/work/p/" + p }, { text: "go", github: true });
  assert.match(gh.messages.find((m) => m.tool_call_id === "h1").content, /^error: this command writes \.npmrc, a protected file, so it is not run in a job started from GitHub/);
  assert.ok(!ev3.some((e) => e.type === "runask"));
  // A background command that ends while Coder works: told once, in Claude Code's words.
  const ev4 = []; n = 0; bgAlive = true;
  const r4 = await runCoder({ send: async () => [say("", [call("bash", { command: "python3 -m http.server 8000", description: "Serve the folder", run_in_background: true }, "k1")]), (bgAlive = false, say("", [call("bash", { command: "echo next" }, "k2")])), say("Done.")][Math.min(n++, 2)], exec, emit: (e) => ev4.push(e), bg: { alive: async () => bgAlive, stop: async () => true, status: async () => (bgAlive ? { alive: true } : { alive: false, code: 0 }) } }, { text: "go" });
  assert.ok(ev4.some((e) => e.type === "note" && e.text === "Background command \"Serve the folder\" completed (exit code 0)"));
  assert.ok(r4.messages.some((m) => m.role === "user" && m.appNote && /Background command "Serve the folder" completed \(exit code 0\)\. Its output is in \/out\/bg-1\.log \(ID: job1\)\./.test(m.content)));
});

test("CD275 bash on the page: a command's description is its step's title and the command is shown when the step is opened; grep's exit 1 is no failure; a command's card (a protected file, or a command over 10,000 characters) with Allow sending the words Coder's app gave it; the Worker and notifications know the card", () => {
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(ui, /const desc = !e\.tool && typeof e\.desc === 'string' && e\.desc\.trim\(\) \? e\.desc\.trim\(\) : '';/);
  assert.match(ui, /\(desc \? '<span class="cd-cmd-desc">' \+ esc\(desc\) \+ '<\/span>' : '<span class="cd-cmd-verb">'/);
  assert.match(ui, /\(desc \? '<pre class="cd-cmd-in">\$ ' \+ esc\(e\.command\) \+ '<\/pre>' : ''\)/);
  assert.match(ui, /r\.code === 0 \|\| r\.ok === true \? 'ok' : 'bad'/);
  assert.match(ui, /else if \(e\.type === 'runask'\) \{/);
  assert.match(ui, /send\(x\.allow\)/);
  assert.match(ui, /\/\^\(I allowed Coder to \(change \.\+\|run command \[0-9a-f\]\{8\}\)\\\.\\n\?\)\+\$\/\.test\(x\.allow \+ '\\n'\)/, "only allow sentences are ever sent");
  assert.match(css, /\.cd \.cd-cmd-desc\{/);
  assert.match(css, /\.cd-cmd \.cd-cmd-in\{/);
  assert.match(readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8"), /\["question", "secret", "envchange", "writeask", "runask"\]\.includes\(e\.type\)/);
  assert.match(readFileSync(new URL("../src/coder-push.mjs", import.meta.url), "utf8"), /else if \(e\.type === "runask"\)/);
  const df = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8");
  assert.match(df, /coder-shell\.mjs coder-bashcheck\.mjs coder-perms\.mjs coder-filerules\.mjs coder-hooks\.mjs coder-freeze\.mjs coder-checker\.mjs \.\//, "the image has the new modules");
});

test("CD278 (tool 4, part 2) background commands told of in Claude Code's words when they end, whenever: completed, failed, stopped at the time limit (with Claude Code's advice), stopped by the owner; one from an earlier message is known to Coder (said at the start, stopped by its id, told of when it ends, the machine told so); a new one's id comes from the machine; what ended between messages is said at the start, and a turn only to tell it says the owner sent nothing", async () => {
  const { runCoder, bgEndNotice, BG_DEADLINE } = await import("../container/coder-agent.mjs");
  assert.deepEqual(bgEndNotice({ id: "job3", desc: "Run the tests", log: "/l/bg-3.log", code: 0 }), { said: "Background command \"Run the tests\" completed (exit code 0)", note: "Background command \"Run the tests\" completed (exit code 0). Its output is in /l/bg-3.log (ID: job3).", end: { ok: true, label: "" } });
  assert.equal(bgEndNotice({ desc: "Run the tests", code: 3 }).said, "Background command \"Run the tests\" failed with exit code 3");
  assert.equal(bgEndNotice({ command: "npm run dev\nmore", why: "exit", code: null }).said, "Background command \"npm run dev\" ended", "no description: the command's first line");
  const lim = bgEndNotice({ id: "job1", desc: "Watch", log: "/l/1.log", why: "limit" });
  assert.equal(lim.said, "Background command \"Watch\" was stopped after reaching its background time limit");
  assert.equal(lim.note, "Background command \"Watch\" was stopped after reaching its background time limit. The command was stopped after reaching its background time limit. " + BG_DEADLINE + " Its output is in /l/1.log (ID: job1).");
  assert.match(BG_DEADLINE, /^If the work in progress still needs it, start it again with `run_in_background` and a longer `timeout`\. If it already had the longest `timeout` allowed, do not restart it\. Either way, report that it was stopped\. The longest `timeout` allowed in this session is 7200000 ms \(120 minutes\)\.$/);
  assert.equal(bgEndNotice({ desc: "Watch", why: "owner" }).said, "Background command \"Watch\" was stopped");
  assert.match(bgEndNotice({ desc: "Watch", why: "owner" }).note, /The owner stopped it before it completed\./);
  assert.match(bgEndNotice({ desc: "Watch", why: "lost" }).note, /Coder's machine had to stop it before it completed/);
  // A job from an earlier message, still running: monitor knows it; when it ends Coder is told, and the machine learns that.
  const events = [], told = [], execs = [];
  let alive = true, n = 0;
  const exec = async (o) => { execs.push(o); if (o.inBg) return { code: -1, background: true, pid: 91, log: "/out/bg-9.log", jobId: "job7" }; return { code: 0, output: "ok\n" }; };
  const bg = { kept: async () => [{ id: "job4", pid: 55, log: "/out/bg-4.log", command: "npm run dev", desc: "Start the dev server", at: 1, moved: false, cwd: "/work/p" }], alive: async (pid) => pid === 55 && alive, stop: async () => true, status: async (pid) => (pid === 55 ? (alive ? { alive: true } : { alive: false, code: 1, why: "exit" }) : { alive: true }), told: async (pid) => { told.push(pid); } };
  const steps = [
    say("", [call("stop_job", { job: "job9" }, "m1")]),
    (alive = true, say("", [call("bash", { command: "npm test -- --watch", description: "Watch the tests", run_in_background: true, timeout: 5400000 }, "b1")])),
    say("", [call("bash", { command: "echo next" }, "b2")]),
    say("Done."),
  ];
  const r = await runCoder({ send: async () => { const s = steps[Math.min(n, steps.length - 1)]; if (n === 2) alive = false; n++; return s; }, exec, emit: (e) => events.push(e), bg, here: () => "/work/p", root: "/work/p" }, { text: "go" });
  assert.equal(r.messages.find((m) => m.role === "tool" && m.tool_call_id === "m1").content, "error: no background job job9 (jobs: job4)", "the earlier job is known");
  assert.match(r.messages.find((m) => m.role === "user" && m.appNote && /still running from earlier/.test(m.content)).content, /a background command is still running from earlier: job4 "Start the dev server", for .*, output in \/out\/bg-4\.log\. Do not start a second copy; read its output file to see what it printed, stop it with stop_job when it is no longer needed\. You are told when one ends\.\)$/, "and Coder is told of it at the start");
  assert.equal(r.messages.find((m) => m.tool_call_id === "b1").content, "Command running in background with ID: job7. Output is being written to: /out/bg-9.log. You will be notified when it completes. To check interim output, use read on that file path.", "the machine's id");
  const b1 = execs.find((x) => x.inBg);
  assert.deepEqual([b1.desc, b1.limitMs], ["Watch the tests", 5400000], "its description and its time limit go to the machine");
  assert.ok(events.some((e) => e.type === "note" && e.text === "Background command \"Start the dev server\" failed with exit code 1"));
  assert.deepEqual(told, [55], "the machine is told Coder knows");
  // Ended between messages: said at the start (the chat's lines, then Coder's note), after the owner's message.
  const ev2 = [], seen2 = [];
  await runCoder({ send: async (req) => { seen2.push(req); return say("Noted."); }, exec, emit: (e) => ev2.push(e) }, { text: "and now?", notices: [{ id: "job2", desc: "Build", command: "npm run build", log: "/out/bg-2.log", code: 0, why: "exit" }, { id: "job3", desc: "Watch", log: "/out/bg-3.log", code: null, why: "limit" }] });
  assert.deepEqual(ev2.filter((e) => e.type === "note").map((e) => e.text), ["Background command \"Build\" completed (exit code 0)", "Background command \"Watch\" was stopped after reaching its background time limit"]);
  const msgs = seen2[0].messages;
  const at = msgs.findIndex((m) => m.role === "user" && m.content === "and now?");
  assert.ok(at >= 0 && /^\(Note from Coder's app, not the owner: 2 background commands ended since your last answer\.\n/.test(msgs[at + 1].content), "right after the owner's message");
  assert.ok(!/The owner sent no message/.test(msgs[at + 1].content));
  // A turn only to tell it (Coder's Worker starts one, as Claude Code "re-invokes you when it exits"): no message of the owner's.
  const ev3 = [], seen3 = [];
  await runCoder({ send: async (req) => { seen3.push(req); return say("The build finished."); }, exec, emit: (e) => ev3.push(e) }, { text: "", notices: [{ id: "job2", desc: "Build", log: "/out/bg-2.log", code: 0 }] });
  assert.ok(!ev3.some((e) => e.type === "user"));
  assert.match(seen3[0].messages.filter((m) => m.role === "user").pop().content, /a background command ended since your last answer\.\nBackground command "Build" completed \(exit code 0\)\. Its output is in \/out\/bg-2\.log \(ID: job2\)\.\nThe owner sent no message: this turn is only to tell you\./);
});

test("CD280 (tool 4, part 3) the owner's own command, Claude Code's shell mode (\"! npm test\"): run as Coder's are, with no check of Coder's; the chat shows it and what it printed; Coder gets it as Claude Code adds it (<bash-input>, <bash-stdout>, <bash-stderr> with the exit code) and answers it", async () => {
  const { runCoder, shellMessages, SHELL_CUT } = await import("../container/coder-agent.mjs");
  assert.deepEqual(shellMessages("npm test", { output: "1 failing\n", code: 1 }), [{ role: "user", content: "<bash-input>npm test</bash-input>" }, { role: "user", content: "<bash-stdout>1 failing</bash-stdout><bash-stderr>Exit code 1</bash-stderr>" }]);
  assert.equal(shellMessages("ls", { output: "a\n", code: 0 })[1].content, "<bash-stdout>a</bash-stdout><bash-stderr></bash-stderr>");
  const long = shellMessages("seq 1 99999", { output: "x".repeat(SHELL_CUT + 500) })[1].content;
  assert.match(long, /\.\.\. \[500 characters truncated\] \.\.\./);
  const events = [], execs = [], seen = [];
  const exec = async (o) => { execs.push(o); return { code: 1, output: "FAIL src/a.test.js\n  expected 2, got 3\n" }; };
  const r = await runCoder({ send: async (req) => { seen.push(req); return say("The test in src/a.test.js expects 2 but gets 3: fix the add function."); }, exec, emit: (e) => events.push(e), here: () => "/work/p", root: "/work/p" }, { shell: "rm -rf build && npm test" });
  // Run as Coder's commands are (its folder carried over), with no check of Coder's: a removal is the owner's to make.
  assert.equal(execs.length, 1);
  assert.deepEqual([execs[0].command, execs[0].here, execs[0].follow, execs[0].timeoutS], ["rm -rf build && npm test", true, true, 600]);
  assert.deepEqual(events.filter((e) => e.type === "user"), [{ at: events.find((e) => e.type === "user").at, type: "user", text: "! rm -rf build && npm test", shell: true }]);
  const step = events.find((e) => e.type === "bash");
  assert.deepEqual([step.verb, step.by, step.command], ["You ran", "owner", "rm -rf build && npm test"]);
  assert.equal(events.find((e) => e.type === "result" && e.id === step.id).output, "FAIL src/a.test.js\n  expected 2, got 3\nExit code 1");
  // Coder gets it as Claude Code adds it, and answers.
  const msgs = seen[0].messages.filter((m) => m.role === "user");
  assert.deepEqual(msgs.slice(-2).map((m) => m.content), ["<bash-input>rm -rf build && npm test</bash-input>", "<bash-stdout>FAIL src/a.test.js\n  expected 2, got 3</bash-stdout><bash-stderr>Exit code 1</bash-stderr>"]);
  assert.match(seen[0].messages[0].content, /A command the owner ran themselves \(they typed ! in the chat\) comes as <bash-input>/);
  assert.equal(r.status, "done");
  assert.ok(r.messages.some((m) => m.role === "assistant" && /expects 2 but gets 3/.test(m.content)));
});

test("CD282 (tool 4, docs pass 2) what persists between commands, as in Claude Code: the shell startup file's aliases, functions, options and PATH (a snapshot taken as each message starts, after the setup script; completion helpers and command-not-found left out, nothing it prints), and the owner's CODER_ENV_FILE (Claude Code's CLAUDE_ENV_FILE) run before each command in the same shell", async () => {
  const S = await import("../container/server.mjs");
  assert.equal(S.envFileLine("~/venv/bin/activate", "/work/p"), "if [ -r \"$HOME\"/'venv/bin/activate' ]; then . \"$HOME\"/'venv/bin/activate'; fi\n");
  assert.equal(S.envFileLine(".coder/env.sh", "/work/p"), "if [ -r '/work/p/.coder/env.sh' ]; then . '/work/p/.coder/env.sh'; fi\n", "one in the project");
  assert.equal(S.envFileLine("/opt/it's.sh", "/w"), "if [ -r '/opt/it'\\''s.sh' ]; then . '/opt/it'\\''s.sh'; fi\n", "quoted, never expanded");
  for (const bad of ["", "  ", "a\nb", "x".repeat(1001)]) assert.equal(S.envFileLine(bad, "/w"), "");
  assert.match(S.SNAPSHOT_READ, /^\{ if \[ -r "\$HOME\/\.cache\/coder\/shell-snapshot\.sh" \]; then \. "\$HOME\/\.cache\/coder\/shell-snapshot\.sh"; fi; \} >\/dev\/null 2>&1\n$/);
  assert.match(S.SNAPSHOT_TAKE, /case "\$n" in _\[!_\]\*\|command_not_found_handle\|which\|unsetenv\) ;;/);
  // On a machine made here (its commands as this user, with a home of their own): a job uses them.
  const { createApp } = S;
  const http = await import("node:http");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), home = await mkdtemp(join(tmpdir(), "coder-home-"));
  const mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  await writeFile(join(home, ".bashrc"), "echo 'Welcome!'\nalias hi='echo hi from an alias'\ngreet() { echo \"hello $1\"; }\n_comp_x() { :; }\nexport PATH=\"$HOME/tools:$PATH\"\n");
  await mkdir(join(home, "tools"));
  await writeFile(join(home, "tools", "mytool"), "#!/bin/sh\necho mytool ran\n", { mode: 0o755 });
  await writeFile(join(home, "env.sh"), "export GREETING=from-env-file\n");
  const seen = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "hi\ngreet you\nmytool\ntype _comp_x >/dev/null 2>&1 || echo no-completion\necho \"$GREETING\"" }, "s1")]), say("Done.")];
  const srv = http.createServer(createApp({ root, home, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { seen.push(req); return steps[Math.min(n++, 1)]; } }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    // (Bash's startup file under bash: CODER_SHELL=bash. Since pass 9 a machine with zsh runs commands in zsh, as Claude Code's
    // cloud machine does, and zsh reads ~/.zshrc: below.)
    assert.equal((await post("/turn", { project: "shop-snap", text: "go", messages: [], setup: { vars: { CODER_ENV_FILE: "~/env.sh", CODER_SHELL: "bash" } } })).status, 200);
    let st; for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=shop-snap&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    const out = st.events.find((e) => e.type === "result" && e.id === "s1").output;
    assert.equal(out, "hi from an alias\nhello you\nmytool ran\nno-completion\nfrom-env-file", out);
    assert.ok(existsSync(join(home, ".cache", "coder", "shell-snapshot.sh")));
    // THE SAME IN ZSH, the default where it is installed (Bash docs pass 9): its ~/.zshrc's aliases, functions and PATH.
    if (existsSync("/usr/bin/zsh") || existsSync("/bin/zsh")) {
      await writeFile(join(home, ".zshrc"), "echo 'Welcome!'\nalias hi='echo hi from an alias'\ngreet() { echo \"hello $1\"; }\n_comp_x() { :; }\nexport PATH=\"$HOME/tools:$PATH\"\n");
      n = 0;
      assert.equal((await post("/turn", { project: "shop-snapz", text: "go", messages: [], setup: { vars: { CODER_ENV_FILE: "~/env.sh" } } })).status, 200);
      for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=shop-snapz&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
      const outZ = st.events.find((e) => e.type === "result" && e.id === "s1").output;
      assert.equal(outZ, "hi from an alias\nhello you\nmytool ran\nno-completion\nfrom-env-file", outZ);
      assert.ok(existsSync(join(home, ".cache", "coder", "shell-snapshot.zsh")));
    }
  } finally { await new Promise((r) => srv.close(r)); }
});

test("CD283 (tool 4, docs pass 2) the owner moves a running command to the background (the page's \"Run in background\", Claude Code's Ctrl+B): Coder gets \"Command was manually backgrounded by user\" and goes on; a command moved at its timeout with nothing printed yet gets Claude Code's sentence about output held back", async () => {
  const { createApp } = await import("../container/server.mjs");
  const { BG_NO_OUTPUT, runCoder } = await import("../container/coder-agent.mjs");
  assert.equal(BG_NO_OUTPUT, "No output had been read from it when it was moved. A program that buffers its output, or a pipe into one such as tail, can keep the output file empty until the command finishes.");
  const http = await import("node:http");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  let n = 0;
  const steps = [say("", [call("bash", { command: "echo $$ > pid.txt; echo started; sleep 40", description: "Wait long", timeout: 60000 }, "m1")]), say("Done.")];
  const seen = [];
  const srv = http.createServer(createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { seen.push(req); return steps[Math.min(n++, 1)]; } }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  let pid = 0;
  try {
    assert.deepEqual(await (await post("/bgmove", { project: "shop-move" })).json(), { ok: false, why: "no command of Coder's is running now" });
    assert.equal((await post("/turn", { project: "shop-move", text: "go", messages: [] })).status, 200);
    for (let i = 0; i < 100 && !existsSync(join(root, "shop-move", "pid.txt")); i++) await new Promise((ok) => setTimeout(ok, 50));
    await new Promise((ok) => setTimeout(ok, 200));
    assert.deepEqual(await (await post("/bgmove", { project: "shop-move" })).json(), { ok: true });
    let st; for (let i = 0; i < 100; i++) { st = await (await fetch(base + "/state?project=shop-move&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    pid = Number(readFileSync(join(root, "shop-move", "pid.txt"), "utf8"));
    const told = seen[1].messages.find((m) => m.role === "tool").content;
    assert.match(told, /^started\nCommand was manually backgrounded by user with ID: job1\. Output is being written to: [^ ]+\. You will be notified when it completes\. If it is still running after 30m in the background, it will be stopped and you will be notified\.$/);
    assert.ok(st.result.background.some((b) => b.id === "job1"), "it goes on in the background");
  } finally { if (pid) { try { process.kill(-pid, "SIGKILL"); } catch { /* gone */ } try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } } await new Promise((r) => srv.close(r)); }
  // Moved at its timeout having printed nothing.
  n = 0;
  const r = await runCoder({ send: async () => (n++ ? say("Done.") : say("", [call("bash", { command: "npm run build | tail -5", timeout: 2000 }, "x1")])), exec: async () => ({ code: -1, background: true, pid: 5, log: "/out/bg-1.log", jobId: "job1", output: "", size: 0 }), emit: () => {} }, { text: "go" });
  assert.match(r.messages.find((m) => m.tool_call_id === "x1").content, /stop it with stop_job\. No output had been read from it when it was moved\. A program that buffers its output, or a pipe into one such as tail, can keep the output file empty until the command finishes\. To check interim output, use read on that file path\.$/);
});

test("CD284 (tool 4, docs pass 2) the environment's BASH_DEFAULT_TIMEOUT_MS and BASH_MAX_TIMEOUT_MS set a command's timeouts, as in Claude Code's cloud (Coder keeps a command within its job, and a background one within 2 hours); background commands the machine lost (restarted, or asleep) are said in Claude Code's words", async () => {
  const S = await import("../container/server.mjs");
  const A = await import("../container/coder-agent.mjs");
  assert.deepEqual(S.bashTimeouts({}), { defaultMs: 120000, maxMs: 600000, bgDefaultMs: 1800000, bgMaxMs: 7200000 });
  assert.deepEqual(S.bashTimeouts({ BASH_DEFAULT_TIMEOUT_MS: "300000" }), { defaultMs: 300000, maxMs: 600000, bgDefaultMs: 1800000, bgMaxMs: 7200000 }, "a lower one never shortens the background's");
  assert.deepEqual(S.bashTimeouts({ BASH_DEFAULT_TIMEOUT_MS: "3600000" }), { defaultMs: 2400000, maxMs: 2400000, bgDefaultMs: 3600000, bgMaxMs: 7200000 }, "over 30 minutes: the background's default too");
  assert.deepEqual(S.bashTimeouts({ BASH_MAX_TIMEOUT_MS: "1200000" }), { defaultMs: 120000, maxMs: 1200000, bgDefaultMs: 1800000, bgMaxMs: 7200000 });
  assert.deepEqual(S.bashTimeouts({ BASH_DEFAULT_TIMEOUT_MS: "9e99", BASH_MAX_TIMEOUT_MS: "x" }), { defaultMs: 2400000, maxMs: 2400000, bgDefaultMs: 7200000, bgMaxMs: 7200000 });
  assert.equal(S.bgLimitMs(5400000), 5400000);
  assert.equal(S.bgLimitMs(9e6), 7200000, "2 hours at most");
  assert.equal(S.bgLimitMs(0, S.bashTimeouts({ BASH_DEFAULT_TIMEOUT_MS: "3600000" })), 3600000);
  const tmo = { defaultMs: 300000, maxMs: 1200000, bgDefaultMs: 3600000, bgMaxMs: 7200000 };
  assert.equal(A.commandTimeoutS({}, tmo), 300);
  assert.equal(A.commandTimeoutS({ timeout: 9999999 }, tmo), 1200);
  assert.equal(A.commandTimeoutS({ timeout_s: 900 }, tmo), 900);
  assert.equal(A.commandTimeoutS({}), 120, "without them, Claude Code's defaults");
  assert.deepEqual([A.durWords(1800000), A.durWords(5400000), A.durWords(7200000)], ["30m", "1h 30m", "2h"]);
  const execs = [];
  let n = 0;
  const r = await A.runCoder({ send: async () => [say("", [call("bash", { command: "npm test" }, "t1"), call("bash", { command: "npm run build", timeout: 9999999 }, "t2")]), say("Done.")][Math.min(n++, 1)], exec: async (o) => { execs.push(o); return o.command === "npm run build" ? { code: -1, background: true, pid: 9, log: "/l/b.log", jobId: "job2", output: "x", size: 1 } : { code: 0, output: "ok" }; }, emit: () => {} }, { text: "go", timeouts: tmo });
  assert.deepEqual(execs.filter((x) => !x.tool).map((x) => x.timeoutS), [300, 1200]);
  assert.match(r.messages.find((m) => m.tool_call_id === "t2").content, /If it is still running after 1h in the background, it will be stopped and you will be notified\./);
  // Lost with the machine.
  assert.equal(A.lostNote([{ id: "job1", desc: "Start the dev server" }]), "The machine running this chat was restarted before background work reported back: \"Start the dev server\" (task job1). That work is lost — no result or further notification will arrive for it. Re-create it if still needed (a long-running server or watcher that nothing is waiting on does not need restarting now), or tell the owner what was lost.");
  const http = await import("node:http");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  const seen = [];
  const srv = http.createServer(S.createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { seen.push(req); return say("Noted."); } }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "shop-lost", text: "go", messages: [], background: [{ id: "job1", desc: "Start the dev server" }, { id: "nope" }] }) });
    let st; for (let i = 0; i < 100; i++) { st = await (await fetch(base + "/state?project=shop-lost&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.ok(st.events.some((e) => e.type === "note" && e.text === "Coder's machine was restarted before background work reported back: \"Start the dev server\". It is not running any more."));
    assert.ok(seen[0].messages.some((m) => m.role === "user" && m.content.includes("(task job1). That work is lost")));
  } finally { await new Promise((ok) => srv.close(ok)); }
});

test("CD285 (tool 4, changelog pass) Claude Code's later Bash fixes in Coder: a background grep with no match completed, not failed (2.1.280); gh's rate limit hinted (2.1.116); still-running background commands said at a message's start, so no second copy (2.1.271); a running command's last lines and how long it has run, with its timeout (1.0.48, 2.1.23); no `which` alias from the startup file (2.1.314); SHELLOPTS never set by the owner (2.1.316)", async () => {
  const A = await import("../container/coder-agent.mjs");
  const S = await import("../container/server.mjs");
  assert.equal(A.bgEndNotice({ desc: "Find TODOs", command: "grep -rn TODO .", code: 1 }).said, "Background command \"Find TODOs\" completed (exit code 1: No matches found)");
  assert.equal(A.bgEndNotice({ desc: "Tests", command: "npm test", code: 1 }).said, "Background command \"Tests\" failed with exit code 1");
  assert.equal(A.ghRateLimited("gh pr list --repo a/b", "HTTP 403: API rate limit exceeded for user ID 1."), true);
  assert.equal(A.ghRateLimited("curl x", "API rate limit exceeded"), false, "only gh");
  let n = 0;
  const r = await A.runCoder({ send: async () => (n++ ? say("Done.") : say("", [call("bash", { command: "gh pr list" }, "g1")])), exec: async () => ({ code: 1, output: "HTTP 403: API rate limit exceeded for user ID 1. (https://docs.github.com/rest)\n" }), emit: () => {} }, { text: "go" });
  assert.match(r.messages.find((m) => m.tool_call_id === "g1").content, /\n\n\(Note from Coder's app: GitHub API rate limit exceeded \(5,000\/hr shared across all tools and agents\)\. Run `gh api rate_limit --jq \.resources` and wait until reset before further gh calls\. If you were polling in a loop, stop and tell the owner instead of retrying\.\)$/);
  // Still running from an earlier message: said at the start.
  const seen = [];
  n = 0;
  await A.runCoder({ send: async (req) => { seen.push(req); return say("Ok."); }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, bg: { kept: async () => [{ id: "job2", pid: 7, log: "/out/bg-2.log", command: "npm run dev", desc: "Start the dev server", at: Date.now() - 180000 }], alive: async () => true, status: async () => ({ alive: true }), stop: async () => true } }, { text: "is it up?" });
  assert.ok(seen[0].messages.some((m) => m.role === "user" && /^\(Note from Coder's app, not the owner: a background command is still running from earlier: job2 "Start the dev server", for 3m, output in \/out\/bg-2\.log\. Do not start a second copy;/.test(m.content)));
  // The snapshot leaves `which` to the system; SHELLOPTS and BASHOPTS are never the owner's to set.
  assert.match(S.SNAPSHOT_TAKE, /_\[!_\]\*\|command_not_found_handle\|which\|unsetenv\) ;; \[-\+\]\*\) printf "eval -- %q/);
  assert.match(S.SNAPSHOT_TAKE, /-e "\/\^alias which=\/d"/);
  assert.deepEqual(S.safeVars({ SHELLOPTS: "errexit", BASHOPTS: "x", FOO: "1" }), { FOO: "1" });
  // A running command's last lines, while it runs, for the page (never saved with the chat).
  const http = await import("node:http");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  n = 0;
  const srv = http.createServer(S.createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async () => (n++ ? say("Done.") : say("", [call("bash", { command: "for i in 1 2 3 4 5 6 7; do echo line $i; sleep 0.4; done", timeout: 30000 }, "p1")])) }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "shop-prog", text: "go", messages: [] }) });
    let got = null, st;
    for (let i = 0; i < 80; i++) { st = await (await fetch(base + "/state?project=shop-prog&since=0")).json(); if (st.progress && st.progress.lines.length >= 3) got = got || st.progress; if (st.result) break; await new Promise((ok) => setTimeout(ok, 100)); }
    assert.ok(got && got.lines.every((l) => /^line \d$/.test(l)) && got.lines.length <= 5, JSON.stringify(got));
    assert.equal(st.progress, undefined, "gone once the job ended");
    assert.equal(st.events.find((e) => e.type === "bash" && e.id === "p1").timeoutS, 30, "its timeout goes with it");
    assert.ok(!st.events.some((e) => e.type === "progress"), "never saved with the chat");
  } finally { await new Promise((ok) => srv.close(ok)); }
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /const runWords = \(e\) => 'Running for ' \+ secsWords\(\(Date\.now\(\) - Number\(e\.at \|\| Date\.now\(\)\)\) \/ 1000\) \+ \(Number\(e\.timeoutS\) > 0 \? ' · timeout ' \+ secsWords\(Number\(e\.timeoutS\)\) : ''\);/);
  assert.match(page, /'<pre class="cd-progress">' \+ esc\(S\.progress\.lines\.join\('\\n'\)\) \+ '<\/pre>'/);
  assert.match(page, /S\.progress = r\.data\.progress \|\| null;/);
});

test("CD290 (docs check: Claude Code's errors page) a command with a raw control character other than tab or newline is refused in Claude Code's words, never run: it would hide part of the command in the chat and on the owner's card", async () => {
  const { commandProblem, CONTROL_REFUSED } = await import("../container/coder-checks.mjs");
  assert.match(CONTROL_REFUSED, /^Command contains control characters that would be hidden in the approval dialog/);
  for (const bad of ["echo a\u0001b", "echo \u001b[31mred", "echo a\rb", "rm x\u007f", "echo \u0085", "echo \u0000"]) assert.equal(commandProblem(bad), CONTROL_REFUSED, JSON.stringify(bad));
  for (const ok of ["echo a\tb", "echo a\nb", "printf '\\033[1mhi'", "echo $'\\r'", "echo ​zero-width is no control character"]) assert.equal(commandProblem(ok), "", JSON.stringify(ok));
  const { runCoder } = await import("../container/coder-agent.mjs");
  const execs = [];
  let n = 0;
  const r = await runCoder({ send: async () => (n++ ? say("Done.") : say("", [call("bash", { command: "echo safe\rrm -rf build" }, "c1")])), exec: async (o) => { execs.push(o); return { code: 0, output: "" }; }, emit: () => {} }, { text: "go" });
  assert.equal(r.messages.find((m) => m.tool_call_id === "c1").content, CONTROL_REFUSED);
  assert.equal(execs.filter((x) => !x.tool).length, 0, "never run");
});

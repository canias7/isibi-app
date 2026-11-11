// TOOL 4, BASH: WHAT THE LIVE SIDE-BY-SIDE WITH CLAUDE CODE FOUND (the owner, 2026-11-10: "test it with claude code and
// coder, and see the differences pls"). Each against Claude Code 2.1.322 itself, run with the same commands the same day.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CD361 more than one folder change in one command asks in Accept edits and Plan, in Claude Code's words (Claude Code 2.1.322 asked for each of these; one cd runs as before)", async () => {
  const P = await import("../container/coder-perms.mjs");
  const W = "/work/shop";
  const d = (c, mode) => P.bashDecision(c, { mode, cwd: W, workdirs: [W] });
  for (const c of ["cd docs && cd ..", "cd docs && ls && cd ..", "cd docs; cd ../src", "pushd docs && popd"]) {
    for (const mode of ["acceptEdits", "plan"]) {
      const r = d(c, mode);
      assert.equal(r.verdict, "ask", mode + " " + c);
      assert.equal(r.why, "Multiple directory changes in one command require approval for clarity");
      assert.equal(r.suggest, null, "no rule to offer");
    }
    assert.equal(d(c, "auto").verdict, "allow", "Auto as before");
  }
  for (const c of ["cd docs && ls", "ls && pwd", "cd src"]) assert.equal(d(c, "acceptEdits").verdict, "allow", c);
});

// ── "OK DO THAT" (the owner, 2026-11-10): COPY CLAUDE CODE EXACTLY ─────────────────────────────────────────────────────
// Each sentence below is Claude Code 2.1.322's own, from claude -p run on the same commands that day (Accept edits, and
// Plan with its auto-mode checker off, which Coder doesn't have), with "Claude Code" read as "Coder" and its folders as Coder's.
const W = "/work/shop";
const DIRS = "'/work/shop'";
const ctx = (mode, extra = {}) => ({ mode, cwd: W, workdirs: [W], home: "/home/dev", ownDirs: ["/data/out"], isProtected: (p) => (p === W + "/.husky" || p.startsWith(W + "/.husky/") ? p : ""), ...extra });

test("CD362 a read outside the project asks in Accept edits and Plan, in Claude Code's words (2.1.322 asked for each of these; Coder had run them); in Auto it runs, and Coder's own folders stay readable", async () => {
  const P = await import("../container/coder-perms.mjs");
  const said = {
    "cat /etc/hostname": "cat in '/etc/hostname' was blocked. For security, Coder may only concatenate files from the allowed working directories for this session: " + DIRS + ".",
    "ls /": "ls in '/' was blocked. For security, Coder may only list files in the allowed working directories for this session: " + DIRS + ".",
    "head -1 /etc/passwd": "head in '/etc/passwd' was blocked. For security, Coder may only read the beginning of files from the allowed working directories for this session: " + DIRS + ".",
    "grep -c root /etc/passwd": "grep in '/etc/passwd' was blocked. For security, Coder may only search for patterns in files from the allowed working directories for this session: " + DIRS + ".",
    "wc -l /etc/hosts": "wc in '/etc/hosts' was blocked. For security, Coder may only count lines/words/bytes in files from the allowed working directories for this session: " + DIRS + ".",
    "ls ../": "ls in '/work' was blocked. For security, Coder may only list files in the allowed working directories for this session: " + DIRS + ".",
    "cat ~/.bashrc": "cat in '/home/dev/.bashrc' was blocked. For security, Coder may only concatenate files from the allowed working directories for this session: " + DIRS + ".",
    "ls -la $HOME/../": "ls in '/home' was blocked. For security, Coder may only list files in the allowed working directories for this session: " + DIRS + ".",
    "ls /etc/*.conf": "ls in '/etc' was blocked. For security, Coder may only list files in the allowed working directories for this session: " + DIRS + ".",
  };
  for (const [c, w] of Object.entries(said)) {
    for (const m of ["acceptEdits", "plan"]) { const r = P.bashDecision(c, ctx(m)); assert.deepEqual([c, m, r.verdict, r.why, r.suggest], [c, m, "ask", w, null]); }
    assert.equal(P.bashDecision(c, ctx("auto")).verdict, "allow", "Auto: " + c);
  }
  // Inside the project, and Coder's own folders (a long output's saved file, a background command's log): run.
  for (const c of ["cat README.md", "ls", "ls docs/*.md", "head -3 /work/shop/README.md", "cat /data/out/long.txt", "grep -r foo src", "cd src && cat a.js", "git log --oneline"]) assert.equal(P.bashDecision(c, ctx("acceptEdits")).verdict, "allow", c);
  // After a cd out of the project, Claude Code names only the cd (`cd /tmp && ls`); a full path is a part of its own.
  assert.equal(P.bashDecision("cd /tmp && ls", ctx("acceptEdits")).why, "cd in '/tmp' was blocked. For security, Coder may only change directories to the allowed working directories for this session: " + DIRS + ".");
  assert.equal(P.bashDecision("cd /tmp && ls -d /tmp", ctx("plan")).why, "This Bash command contains multiple operations. The following parts require approval: cd /tmp, ls -d /tmp");
  // A wildcard before a '..' can't be checked by its folder.
  assert.equal(P.bashDecision("ls docs/*/../../../etc", ctx("acceptEdits")).why, "A glob before the '..' in 'docs/*/../../../etc' is expanded by the shell before the path is opened, so the target cannot be checked against the working directories. Spell the path without the glob.");
  // An allow rule doesn't approve a read outside (Claude Code: "was blocked").
  assert.equal(P.bashDecision("cat /etc/hostname", ctx("acceptEdits", { rules: { allow: ["Bash(cat *)"] } })).verdict, "ask");
  // Several working folders: Claude Code's list of them.
  assert.equal(P.dirsText(["/a", "/b"]), "'/a', '/b'");
  assert.equal(P.dirsText(["/1", "/2", "/3", "/4", "/5", "/6", "/7"]), "'/1', '/2', '/3', '/4', '/5', and 2 more");
});

test("CD363 Claude Code's own sentence for each other ask, in Accept edits and Plan (each seen from 2.1.322), and its order: a sensitive file first, then more than one cd, then the parts", async () => {
  const P = await import("../container/coder-perms.mjs");
  const why = (c, m = "acceptEdits", extra) => P.bashDecision(c, ctx(m, extra)).why;
  const cases = {
    'echo "unterminated': "Parse error",
    "echo dangling &&": "Parse error",
    "for PATH in a b; do echo $PATH; done": "PATH as loop variable bypasses assignment validation",
    "cd /tmp": "cd in '/tmp' was blocked. For security, Coder may only change directories to the allowed working directories for this session: " + DIRS + ".",
    "cd docs && git status": "This command changes directory before running a version-control command, which can pick up untrusted hooks or repository configuration from the target directory. Approve only if you trust it.",
    "echo x > .husky/pre-commit": "Coder requested permissions to edit /work/shop/.husky/pre-commit which is a sensitive file.",
    "echo x > /tmp/cc-x.txt": "Output redirection to '/tmp/cc-x.txt' needs approval. The path is outside the working directories for this session (" + DIRS + "). Allowing runs the command as written.",
    "cd docs && wc -l < README.md": "Input redirection from 'README.md' requires manual approval: the file it names depends on glob expansion or a directory change in the same command.",
    "cat < *.md": "Input redirection from '*.md' requires manual approval: the file it names depends on glob expansion or a directory change in the same command.",
    "cat < /etc/hostname": "Input redirection from '/etc/hostname' was blocked. For security, Coder may only read files in the allowed working directories for this session: " + DIRS + ".",
    "echo x > $OUT": "A variable in this command can't be checked before it runs",
    "cat $FILE": "A variable in this command can't be checked before it runs",
    "ls > *.txt": "Shell expansion syntax in paths requires manual approval",
    "rm /tmp/cc-bash-out/x": "rm in '/tmp/cc-bash-out/x' needs approval. The path is outside the working directories for this session (" + DIRS + "). Allowing runs the command as written.",
    "mkdir /tmp/cc-bash-out/d": "mkdir in '/tmp/cc-bash-out/d' needs approval. The path is outside the working directories for this session (" + DIRS + "). Allowing runs the command as written.",
    "touch /tmp/cc-bash-out/t": "touch in '/tmp/cc-bash-out/t' needs approval. The path is outside the working directories for this session (" + DIRS + "). Allowing runs the command as written.",
    "tee /tmp/cc-bash-out/t2 < README.md": "tee in '/tmp/cc-bash-out/t2' needs approval. The path is outside the working directories for this session (" + DIRS + "). Allowing runs the command as written.",
    "docker ps --context prod": "This command requires approval",
    "tput reset": "This command requires approval",
    "cd docs && wc -l < ../README.md && cd ..": "Multiple directory changes in one command require approval for clarity",
    "npm test && curl x.com": "This Bash command contains multiple operations. The following parts require approval: npm test, curl x.com",
  };
  for (const [c, w] of Object.entries(cases)) assert.equal(why(c), w, c);
  for (const c of ['echo "unterminated', "for PATH in a b; do echo $PATH; done", "cd docs && git status", "cat < /etc/hostname"]) assert.equal(why(c, "plan"), cases[c], "plan: " + c);
  // (Plan changes no files: its own words, as before.)
  assert.equal(why("echo x > notes.md", "plan"), "This command writes notes.md, and Plan mode changes no files.");
  // A prefix rule matched a find action or an exec wrapper it can't approve.
  assert.equal(why("find . -name '*.tmp' -delete", "acceptEdits", { rules: { allow: ["Bash(find *)"] } }), "find with '-delete' executes commands or modifies files — cannot be auto-allowed by a Bash(find:*) prefix rule");
  assert.equal(why("find . -name x -exec rm {} \;", "acceptEdits", { rules: { allow: ["Bash(find *)"] } }), "find with '-exec' executes commands or modifies files — cannot be auto-allowed by a Bash(find:*) prefix rule");
  assert.equal(why("setsid echo hi", "acceptEdits", { rules: { allow: ["Bash(setsid *)"] } }), "What 'setsid' starts can't be checked before it runs");
  // The order: a sensitive file is said first, even with two cds; then the two cds.
  assert.equal(why("cd .husky && rm pre-commit && cd .."), "Coder requested permissions to edit /work/shop/.husky/pre-commit which is a sensitive file.");
  assert.equal(why("cd docs && rm /tmp/x && cd .."), "Multiple directory changes in one command require approval for clarity");
  // Through links: Claude Code's sentence, naming where each leads.
  const real = (p) => (p.startsWith(W + "/docs/notes.txt") ? W + "/.husky/pre-commit" : p.startsWith(W + "/docs/scratch") ? "/tmp/cc-bash-out" + p.slice((W + "/docs/scratch").length) : p);
  assert.equal(why('echo "# note" >> docs/notes.txt', "acceptEdits", { real }), "Coder requested permissions to edit /work/shop/.husky/pre-commit which is a sensitive file. /work/shop/docs/notes.txt resolves through a symlink to /work/shop/.husky/pre-commit.");
  assert.equal(why("echo hello > docs/scratch/x.txt", "acceptEdits", { real }), "/work/shop/docs/scratch/x.txt resolves through a symlink to /tmp/cc-bash-out/x.txt, which is outside the allowed working directories");
});

test("CD364 the card says Claude Code's sentence alone (no \"This command requires approval:\" in front), the protected and link checks of every mode too; the agent passes its home and its own folders", async () => {
  const A = await import("../container/coder-agent.mjs");
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.ok(!agent.includes('"This command requires approval: " + ask.why'), "no prefix");
  assert.match(agent, /why: String\(rmWhy \|\| \(ask \? ask\.why : pausedCard \? pausedWhy\(checkSt\.byRow\) : switchedCard \? MODE_SWITCHED : dec\.why\)\)\.slice\(0, 800\)/);
  assert.match(agent, /reply\("not run yet: " \+ \(ask\.note \|\| ask\.why\)/);
  assert.match(agent, /home: deps\.home \|\| "", ownDirs: Array\.isArray\(deps\.ownDirs\) \? deps\.ownDirs : \[\], byCommand: fileEdits !== false, scratch: \[SCRATCH\], \.\.\.\(c\.monitor \? \{ settings: MONITOR_SETTINGS \} : \{\}\) \}\)/);
  // The read block's sentence is kept as Claude Code says it (it was lowercased into "This command requires approval: …").
  assert.match(agent, /ask = \{ kind: "readblock", paths: \[\], allow: \[allowRunText\(command\)\], why: rb, note: w, github: w \}/);
  // commandAsk, every mode: a protected file by its full path, in Claude Code's sentence.
  const deps = { root: W, where: (x) => (x.startsWith("/") ? x : W + "/" + x) };
  const a = A.commandAsk("echo x > .husky/pre-commit", deps, W);
  assert.equal(a.kind, "protected");
  assert.equal(a.why, "Coder requested permissions to edit /work/shop/.husky/pre-commit which is a sensitive file.");
  assert.deepEqual(a.allow, [A.allowWriteText(".husky/pre-commit")], "the owner's Allow is the same as before");
  assert.match(a.note, /^this command writes \.husky\/pre-commit, a protected file/);
  assert.match(A.commandAsk("x".repeat(10_001), deps, W).why, /^This command is over 10,000 characters/);
});

test("CD365 rules Claude Code keeps are saved with its warnings (a rule on the command itself, a tool it doesn't know); one starting with a name and a colon is not checked", async () => {
  const P = await import("../container/coder-perms.mjs");
  assert.deepEqual(P.ruleWarning("deny", "Bash(command:rm *)"), { warning: 'Permission deny rule "Bash(command:rm *)" targets command as a raw string and will not match — use Bash(…) for Bash\'s own matcher.', notice: "Deny rule Bash(command:rm *) never matches · use Bash(…)" });
  assert.deepEqual(P.ruleWarning("deny", "Bsh"), { warning: 'Permission deny rule "Bsh" matches no known tool — check for typos.', notice: "Deny rule Bsh matches no tool · check for typos" });
  assert.deepEqual(P.ruleWarning("ask", "Bsh(ls *)"), { warning: 'Permission ask rule "Bsh(ls *)" matches no known tool — check for typos.', notice: "Ask rule Bsh(ls *) matches no tool · check for typos" });
  // An allow rule of these kinds is kept without a word (Claude Code checks only deny and ask rules for them).
  for (const r of ["Bash(command:rm *)", "Bsh"]) { assert.equal(P.ruleSaved(r), true, r); assert.equal(P.ruleWarning("allow", r), null, r); }
  // They never match.
  const d = (c, rules) => P.bashDecision(c, { mode: "acceptEdits", rules, cwd: W, workdirs: [W] }).verdict;
  assert.equal(d("rm a.txt", { deny: ["Bash(command:rm *)", "Bsh"] }), "allow");
  assert.equal(d("npm test", { allow: ["Bash(command:npm *)", "Bsh(npm *)"] }), "ask");
  // A tool of Claude Code's that Coder doesn't apply, or an MCP tool: not saved (Coder's own message).
  for (const r of ["NotebookEdit", "Agent", "mcp__x__y"]) assert.equal(P.ruleSaved(r), false, r);
  // (Read and Edit rules are Coder's own since the file rules: file-rules.test.mjs.)
  for (const r of ["Read", "Edit(src/**)"]) assert.equal(P.ruleSaved(r), true, r);
  // The Worker saves them, with the warning, and the row in the list.
  const R = await import("../src/coder-routes.mjs");
  const bucket = { m: new Map(), async get(k) { return this.m.has(k) ? { text: async () => this.m.get(k) } : null; }, async put(k, v) { this.m.set(k, String(v)); } };
  await R.changeRules(bucket, "u1", "ana/shop", "deny", ["Bash(command:rm *)", "Bsh"]);
  assert.deepEqual((await R.rulesOf(bucket, "u1", "ana/shop")).deny, ["Bash(command:rm *)", "Bsh"]);
  await R.changeRules(bucket, "u1", "ana/shop", "deny", ["Bsh"], { remove: true });
  assert.deepEqual((await R.rulesOf(bucket, "u1", "ana/shop")).deny, ["Bash(command:rm *)"]);
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /if \(!ruleSaved\(rule\)\) return json\(\{ error: "Coder knows rules like/);
});

test("CD366 the shell reader knows a command fed by a pipe (for the read block's \"code on stdin\")", async () => {
  const { parseShell } = await import("../container/coder-shell.mjs");
  const at = (c) => parseShell(c).commands.map((x) => [x.words.map((w) => w.text).join(" "), x.afterPipe]);
  assert.deepEqual(at("echo 1 | node"), [["echo 1", false], ["node", true]]);
  assert.deepEqual(at("a |& b; c"), [["a", false], ["b", true], ["c", false]]);
  assert.deepEqual(at("a && b\nc | d"), [["a", false], ["b", false], ["c", false], ["d", true]]);
});

test("CD367 a short read after a cd inside ( … ) or $( … ) still runs (that cd is checked on its own); one that climbs with .. from there asks; the variable sentence is for variables, not $( … )", async () => {
  const P = await import("../container/coder-perms.mjs");
  const d = (c) => P.bashDecision(c, ctx("acceptEdits"));
  for (const c of ["(cd src && cat a.js)", "(cd src && ls)", "(cd docs; head -3 notes.md)"]) assert.equal(d(c).verdict, "allow", c);
  assert.equal(d("(cd src && cat ../../../etc/passwd)").why, "cat in '../../../etc/passwd' requires manual approval: the path it names depends on a directory change in the same command.");
  assert.equal(d("(cd /etc && cat passwd)").why, "cd in '/etc' was blocked. For security, Coder may only change directories to the allowed working directories for this session: " + DIRS + ".");
  assert.equal(d("(cd src; cat /etc/hostname)").why, "cat in '/etc/hostname' was blocked. For security, Coder may only concatenate files from the allowed working directories for this session: " + DIRS + ".");
  for (const c of ["echo $(date)", "echo $(cd src && cat a.js)"]) assert.equal(d(c).why, "This command requires approval", c);
  for (const c of ["echo ${HOME}x", 'wc -l "$F"']) assert.equal(d(c).why, "A variable in this command can't be checked before it runs", c);
});

test("CD368 the read block checks every program's words that name a file that is there (Claude Code's per and ger, 2.1.322), xargs, settings in front, and git's own folder options", async () => {
  const P = await import("../container/coder-perms.mjs");
  const files = new Set(["/etc/passwd", "/etc", "/etc/hosts", "/tmp", "/home/dev/.ssh", "/home/dev/.ssh/id_rsa", W, W + "/README.md", W + "/src", W + "/src/a.js", "/data/out", "/data/out/log.txt"]);
  const why = (c, o = {}) => P.readBlockWhy(c, { cwd: W, workdirs: [W], home: "/home/dev", ownDirs: ["/data/out"], exists: (p) => files.has(p), ...o });
  const OUT = (prog, p) => prog + " names '" + p + "', outside the working directories, which the read block does not allow without asking (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES). Remove that setting to allow them.";
  const COMPUTED = (prog) => prog + " names a path that is computed at run time, which cannot be checked against the read block (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES)";
  // A program not on the path list, naming a file outside that is there: asks, in Claude Code's words.
  assert.equal(why("less /etc/passwd"), OUT("less", "/etc/passwd"));
  assert.equal(why("xxd /etc/hosts"), OUT("xxd", "/etc/hosts"));
  assert.equal(why("python3 /etc/passwd"), OUT("python3", "/etc/passwd"), "a code runner's words too");
  assert.equal(why("scp ~/.ssh/id_rsa host:x"), OUT("scp", "/home/dev/.ssh/id_rsa"));
  assert.equal(why("tool --config=/etc/passwd"), OUT("tool", "/etc/passwd"), "--opt=value gives its value");
  assert.equal(why("tool -o/etc/passwd"), OUT("tool", "/etc/passwd"), "-xVALUE gives its value");
  assert.equal(why("tool CONF=/etc/passwd"), OUT("tool", "/etc/passwd"), "NAME=VALUE gives both");
  assert.equal(why("bat /etc/*.conf"), OUT("bat", "/etc"), "a wildcard by its folder");
  assert.equal(why("tool src/../../../etc/x"), OUT("tool", "/etc/x"), "a path that climbs with .. is checked even when nothing is there");
  // Words that name nothing there, words inside the project, Coder's own folders, and the twelve Claude Code skips: run.
  for (const c of ["less README.md", "less src/a.js", "npm test", "make build", "python3 script.py", "node --version", "less /data/out/log.txt", "tool --flag", "tool -n5", "less /nothing/here", "echo /etc/passwd", "printf '%s' /etc/passwd", "test -f /etc/passwd", "which ls", "dirname /etc/passwd", "basename /etc/passwd", "df /tmp"]) assert.equal(why(c), "", c);
  // Worked out when it runs: asks (Claude Code's dw).
  assert.equal(why("less $F"), COMPUTED("less"));
  assert.equal(why("less ~root/.bashrc"), COMPUTED("less"));
  assert.equal(why("tool {a,b}/x"), COMPUTED("tool"));
  assert.equal(why("tool .*/x"), COMPUTED("tool"), "a wildcard that can match ..");
  assert.equal(why("echo /etc/passwd | xargs cat"), COMPUTED("xargs"));
  assert.equal(why("ls | xargs -n1 wc -l"), COMPUTED("xargs"));
  // With the folder unknown (after a cd inside $( … )), a short path asks; without the machine's view (the Worker), only .. paths are checked.
  assert.equal(P.readBlockWhy("less /etc/passwd", { cwd: W, workdirs: [W] }), "", "no exists(): nothing is known to be there");
  // Settings in front: Claude Code's own list for the read block (a listed name, a value that is no path).
  const PREFIX = "an environment variable prefix outside the safe list cannot be checked against the read block; under the read block (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES) a command the shell parser cannot analyze asks the person";
  for (const c of ["NODE_ENV=test npm test", "CI=1 make", "LANG=C.UTF-8 ls", "GOOS=linux go build"]) assert.equal(why(c), "", c);
  for (const c of ["FOO=1 npm test", "NODE_ENV=/etc/x npm test", "LANG=../x ls", "PATH=/tmp npm test"]) assert.equal(why(c), PREFIX, c);
  assert.equal(why("env FOO=1 npm test"), "an environment variable assignment outside the safe list cannot be checked against the read block; under the read block (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES) a command the shell parser cannot analyze asks the person");
  // git's own folder and file options.
  assert.equal(why("git --git-dir=/etc log"), OUT("git", "/etc"));
  assert.equal(why("git config --file /etc/passwd -l"), OUT("git", "/etc/passwd"));
  assert.equal(why("git push -f origin main"), "", "-f's next word names nothing there");
  // Inline code, by Claude Code's map, anywhere in the words.
  const INLINE = (p) => p + " runs inline code, which cannot be checked against the read block; under the read block (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES) a command the shell parser cannot analyze asks the person";
  for (const [c, p] of [["sh -c 'ls'", "sh"], ["deno eval 'x'", "deno"], ["perl -E 'say 1'", "perl"], ["python3.12 -c 'print(1)'", "python3.12"], ["ruby -we 'p 1'", "ruby"]]) assert.equal(why(c), INLINE(p), c);
  // The machine's view of the disk is wired in.
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(agent, /exists: \(p\) => pathExists\(p\) \}\);/);
  const B = await import("../container/coder-bashcheck.mjs");
  assert.equal(B.pathExists("/"), true);
  assert.equal(B.pathExists("/no/such/path/here"), false);
  assert.equal(B.pathExists("relative"), false);
});

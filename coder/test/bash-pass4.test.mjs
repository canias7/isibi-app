// TOOL 4, BASH: WHAT WAS STILL MISSING (the owner, 2026-11-10: "What else from the batch docs are we missing", then "Ok do
// that too"): seven commands Claude Code 2.1.321 runs without asking, and its optional read block
// (permissions.blockReadsOutsideWorkingDirectories), here CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES. Each against
// Claude Code's own code (2.1.321) and docs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, isAbsolute } from "node:path";

const W = "/work/shop";
const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("CD350 seven commands Claude Code 2.1.321 runs without asking, each with its own check: lsof, ss, tput, fd, fdfind, docker logs, docker inspect", async () => {
  const P = await import("../container/coder-perms.mjs");
  const d = (c, mode = "plan") => P.bashDecision(c, { mode, cwd: W, workdirs: [W] }).verdict;
  for (const c of ["lsof -i :3000", "lsof -p 123", "ss -tlnp", "ss -tan state established", "ss dst 10.0.0.1", "tput cols", "tput -T xterm lines", "fd -e js", "fdfind -H src", "docker logs web --tail 50", "docker logs -f web", "docker inspect --format x web", "docker ps", "docker images"]) assert.equal(d(c), "allow", c);
  // Their checks (Claude Code's): lsof's +m and a host looked up by name; ss naming a host; tput changing the terminal or
  // reading stdin; fd running commands (-x, -X); docker pointed at another daemon, or a ~ to expand.
  for (const c of ["lsof +m", "lsof -i @example.com", "ss dst example.com", "ss dst ~/x", "tput reset", "tput clear", "tput -S", "fd -x rm", "fd -X rm", "docker logs -H tcp://x web", "docker logs --context prod web", "docker inspect -Hc x", "docker logs --tlscert c web", "docker logs web --since ~/x"]) assert.equal(d(c), "ask", c);
  // Claude Code's whole list of flags that point docker at another machine (podman's too), wherever they are.
  for (const f of ["-H x", "-Hx", "-c x", "-r", "--host x", "--host=x", "--context x", "--config x", "--tlscacert x", "--tlscert x", "--tlskey x", "--url x", "--connection x", "--identity x", "--remote", "--module x", "--out x", "-qH"]) assert.equal(d("docker ps " + f), "ask", "docker ps " + f);
  assert.equal(P.otherDaemon(["-a", "--format", "x", "-q"]), false);
  assert.equal(P.otherDaemon(["-tf"]), false);
  // In Auto they run, as before.
  assert.equal(d("tput reset", "auto"), "allow");
});

test("CD351 the read block: what makes a command ask (Claude Code: \"recognized file-reading Bash commands prompt even in auto mode\"; \"A command the shell parser can't trace … prompts the same way\")", async () => {
  const P = await import("../container/coder-perms.mjs");
  const why = (c, o = {}) => P.readBlockWhy(c, { cwd: W, workdirs: [W], home: "/home/dev", ownDirs: ["/data/out"], ...o });
  // Reads inside the project, Coder's own folders, and programs it can't see into by name: run.
  for (const c of ["cat README.md", "ls", "grep -r foo src", "cd src && cat a.js", "head -5 /work/shop/a.txt", "cat /data/out/long.txt", "npm test", "git diff", "git status", "python3 script.py", "python3 --version", "find . -name '*.js'", "rg foo", "jq . package.json", "sed -n 1p README.md"]) assert.equal(why(c), "", c);
  // Outside the project, by each command's own rule for its paths: Claude Code 2.1.322's words (cat /etc/hostname, cd /tmp,
  // cat ~/.bashrc, cat < /etc/hostname and cat /etc/*.conf all said this), with Coder's setting.
  const OUT = "Reads outside the working directories are blocked (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES). Remove that setting to allow them.";
  assert.equal(P.RB_OUTSIDE, OUT);
  for (const c of ["cat /etc/passwd", "ls /", "grep foo /etc/hosts", "cat ~/.bashrc", "find / -name x", "awk -f /etc/prog.awk a", "jq . /etc/x.json", "sed -n 1p /etc/passwd", "git diff -- /etc/passwd", "git -C /tmp status", "bash -c 'cat /etc/passwd'", "rg foo /etc", "cd /tmp", "cat < /etc/passwd", "cat /etc/*.conf", "cat $HOME/.bashrc"]) assert.equal(why(c), OUT, c);
  // A wildcard inside the project is checked by its folder (Claude Code read `cat /etc/*.conf` as a read in /etc).
  assert.equal(why("cat docs/*.md"), "");
  assert.equal(why("cat docs/*/../../../etc/x"), "A glob before the '..' in 'docs/*/../../../etc/x' is expanded by the shell before the path is opened, so the target cannot be checked against the read block (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES). Spell the path without the glob.");
  // What can't be checked, in Claude Code's words (each seen from 2.1.322 itself): its reason, then why it asks.
  const UNSURE = "; under the read block (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES) a command the shell parser cannot analyze asks the person";
  assert.equal(why("cd src; cd ..; cat a"), "multiple directory changes cannot be checked against the read block" + UNSURE);
  assert.equal(why("echo $(cat /etc/x)"), "a subshell cannot be checked against the read block" + UNSURE);
  assert.equal(why("(cat a)"), "a subshell cannot be checked against the read block" + UNSURE);
  assert.equal(why("cat $FILE"), "A variable in this command can't be checked before it runs" + UNSURE);
  assert.equal(why("cat < *.txt"), "Input redirection from '*.txt' requires manual approval: the file it names depends on glob expansion or a directory change in the same command.");
  assert.equal(why("python3 -c 'print(1)'"), "python3 runs inline code, which cannot be checked against the read block" + UNSURE);
  assert.equal(why("node -e 'x'"), "node runs inline code, which cannot be checked against the read block" + UNSURE);
  assert.equal(why("python3 -"), "python3 runs code from stdin, which cannot be checked against the read block" + UNSURE);
  for (const c of ["echo 1 | node", "node <<'EOF'\nconsole.log(1)\nEOF", "python3 <<< 'print(1)'"]) assert.equal(why(c), "code on stdin cannot be checked against the read block" + UNSURE, c);
  assert.equal(why("node"), "", "nothing fed to it: Claude Code checks code on stdin only when something is");
  assert.equal(why("LD_PRELOAD=x cat a"), "an environment variable prefix outside the safe list cannot be checked against the read block" + UNSURE);
  assert.equal(why("sed 'w /tmp/x' a"), "This sed script is not on the allowlist and can read or write any file, which cannot be checked against the read block (CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES)");
  assert.equal(why("npm test &&"), "Parse error" + UNSURE);
  assert.equal(why('echo "unterminated'), "Parse error" + UNSURE);
  assert.equal(why("cd -"), "A variable in this command can't be checked before it runs" + UNSURE);
  // A link inside the project that leads out of it: followed (with Coder's resolver on the machine).
  const real = (p) => (p.startsWith(W + "/etc-link") ? "/etc" + p.slice((W + "/etc-link").length) : p);
  assert.equal(why("cat etc-link/passwd", { real }), OUT);
  assert.equal(why("cat etc-link/passwd"), "", "without the resolver (the Worker's view): as written");
});

test("CD352 the read block in Coder's loop: a command that reads outside asks in Auto, and the file tools refuse such reads (Claude Code: \"denies Read, Grep, Glob, and LSP calls on those paths\")", async () => {
  const A = await import("../container/coder-agent.mjs");
  const base = await mkdtemp(join(tmpdir(), "coder-readblock-"));
  const work = join(base, "proj");
  await mkdir(join(work, "src"), { recursive: true });
  await writeFile(join(work, "README.md"), "# Shop\n");
  await symlink("/etc", join(work, "etc-link"));
  try {
    const run = async (calls, opts) => {
      const events = [], toolsRan = [], commands = [];
      let n = 0;
      const exec = async ({ command, tool: isTool }) => {
        const m = isTool ? /coder-tools\.mjs (\S+)$/.exec(command) : null;
        if (m) { const req = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); toolsRan.push(req.tool + " " + (req.args.path || "")); return { code: 0, output: "(read)" }; }
        commands.push(command);
        const r = spawnSync("bash", ["-c", command], { cwd: work, encoding: "utf8" });
        return { code: r.status, output: r.stdout + r.stderr };
      };
      const steps = [say("", calls), say("Done.")];
      await A.runCoder({ send: async () => steps[Math.min(n++, steps.length - 1)], exec, emit: (e) => events.push(e), here: () => work, root: work, where: (p) => (isAbsolute(p) ? resolve(p) : resolve(work, p)), home: join(base, "home"), ownDirs: [join(base, "out")] }, { text: "go", ...opts });
      return { events, toolsRan, commands, result: (id) => events.find((e) => e.type === "result" && e.id === id) };
    };
    // Block on, in Auto: the outside read is asked about (no one can answer here, so the turn ends with the card).
    const on = await run([call("bash", { command: "cat /etc/hostname" }, "b0")], { readBlock: true, mode: "auto" });
    const card = on.events.find((e) => e.type === "runask");
    assert.ok(card, "asked");
    assert.equal(card.kind, "readblock");
    assert.equal(on.commands.length, 0, "not run");
    // Through a link in the project, too.
    const link = await run([call("bash", { command: "cat etc-link/hostname" }, "b0")], { readBlock: true });
    assert.equal(link.events.find((e) => e.type === "runask").kind, "readblock");
    // Inside the project: runs.
    const inside = await run([call("bash", { command: "cat README.md" }, "b0")], { readBlock: true });
    assert.equal(inside.events.find((e) => e.type === "runask"), undefined);
    assert.equal(inside.result("b0").output.trim(), "# Shop");
    // The file tools: read, grep, glob and lsp outside the project are refused, never run; inside, they run.
    const tools = await run([call("read", { path: "/etc/hostname" }, "r0"), call("grep", { pattern: "x", path: "/etc" }, "r1"), call("glob", { pattern: "/etc/*.conf" }, "r2"), call("read", { path: "etc-link/hostname" }, "r3"), call("read", { path: "README.md" }, "r4"), call("grep", { pattern: "Shop" }, "r5")], { readBlock: true });
    // (Claude Code 2.1.322's words: "/etc/hostname is outside /home/user/cc-live-bash; the permissions.blockReadsOutsideWorkingDirectories
    // setting blocks reads outside the working directories. Ask the user to add the directory with /add-dir, or to remove
    // that setting.", with Coder's setting and no /add-dir; through a link, where it leads.)
    const said = (p) => "error: " + p + " is outside " + work + "; the CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES setting blocks reads outside the working directories. Ask the owner to remove that setting.";
    assert.equal(A.READ_BLOCKED("/etc/hostname", [work]), said("/etc/hostname"));
    for (const [id, p] of [["r0", "/etc/hostname"], ["r1", "/etc"], ["r2", "/etc"], ["r3", "/etc/hostname"]]) assert.equal(tools.result(id).output, said(p), id);
    assert.deepEqual(tools.toolsRan.map((x) => x.split(" ")[0]), ["read", "grep"], "only the reads inside ran");
    assert.ok(!tools.toolsRan.some((x) => /etc/.test(x)), "nothing outside reached the tool");
    // Block off (the default): as before (in Auto, so the outside read runs without a card).
    const off = await run([call("bash", { command: "cat /etc/hostname" }, "b0"), call("read", { path: "/etc/hostname" }, "r0")], { mode: "auto" });
    assert.equal(off.events.find((e) => e.type === "runask"), undefined);
    assert.equal(off.commands.length, 1);
    assert.equal(off.toolsRan.length, 1);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("CD353 the machine gives the read block its setting and Coder's own folders; the page's card has its words", () => {
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /readBlock: varOn\(rawVars\.CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES\)/);
  assert.match(server, /ownDirs: \[bgDir, outDir\],/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /rblock = e\.kind === 'readblock'/);
  assert.match(page, /This command reads outside the project \(or can\\'t be traced\), which your read-block setting asks about first/);
});

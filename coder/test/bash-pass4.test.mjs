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
  // Outside the project, by each command's own rule for its paths.
  const outside = { "cat /etc/passwd": "cat names /etc/passwd, a path outside the project,", "ls /": "ls names /,", "grep foo /etc/hosts": "grep names /etc/hosts,", "cat ~/.bashrc": "cat names ~/.bashrc,", "find / -name x": "find names /,", "awk -f /etc/prog.awk a": "awk names /etc/prog.awk,", "jq . /etc/x.json": "jq names /etc/x.json,", "sed -n 1p /etc/passwd": "sed names /etc/passwd,", "git diff -- /etc/passwd": "git names /etc/passwd,", "git -C /tmp status": "git names /tmp,", "bash -c 'cat /etc/passwd'": "cat names /etc/passwd,", "rg foo /etc": "rg names /etc," };
  for (const [c, w] of Object.entries(outside)) { assert.ok(why(c).startsWith(w), c + " → " + why(c)); assert.match(why(c), /CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES/); }
  assert.match(why("cd /tmp"), /^cd moves later reads to \/tmp, a folder outside the project/);
  assert.match(why("cat < /etc/passwd"), /^This command reads \/etc\/passwd, outside the project/);
  // What can't be checked.
  assert.match(why("cd src; cd ..; cat a"), /changes folder more than once/);
  assert.match(why("echo $(cat /etc/x)"), /subshell/);
  assert.match(why("(cat a)"), /subshell/);
  assert.match(why("cat $FILE"), /computed at run time/);
  assert.match(why("cat /etc/*.conf"), /expanded by the shell/);
  assert.match(why("cat < *.txt"), /expanded by the shell/);
  assert.match(why("python3 -c 'print(1)'"), /^python3 runs inline code/);
  assert.match(why("node -e 'x'"), /^node runs inline code/);
  assert.match(why("node"), /^node runs code from stdin/);
  assert.match(why("python3 -"), /^python3 runs code from stdin/);
  assert.match(why("LD_PRELOAD=x cat a"), /environment variable in front of cat/);
  assert.match(why("sed 'w /tmp/x' a"), /sed script is not on the allowlist/);
  assert.match(why("npm test &&"), /cannot analyze/);
  assert.match(why("cd -"), /can't be known/);
  // A link inside the project that leads out of it: followed (with Coder's resolver on the machine).
  const real = (p) => (p.startsWith(W + "/etc-link") ? "/etc" + p.slice((W + "/etc-link").length) : p);
  assert.match(why("cat etc-link/passwd", { real }), /^cat names etc-link\/passwd, a path outside the project/);
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
    for (const id of ["r0", "r1", "r2", "r3"]) assert.equal(tools.result(id).output, A.READ_BLOCKED, id);
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

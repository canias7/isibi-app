// TOOL 4, BASH: THE LAST THREE FROM CLAUDE CODE'S DOCS (the owner, 2026-11-09: "Yes do that i thought we did that"): the
// 5 GB stop for background commands, the memory cap for the chat's commands, and the files a command changed. Each against
// Claude Code's docs and Claude Code 2.1.319's own code, read that day (its words quoted). The real ones run for real here;
// those that need root (a memory cgroup, another user) are skipped where the tests do not run as root.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, mkdir, rm, unlink, chmod, readdir } from "node:fs/promises";
import { readFileSync, existsSync, rmdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const root = typeof process.getuid === "function" && process.getuid() === 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const serverSrc = () => readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
const git = (cwd, ...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();

test("CD328 the 5 GB stop goes on in the background (Claude Code: \"Background tasks are stopped if their output exceeds 5 GB, with a note in stderr explaining why\"; killed with exit code 137 and \"Command killed: output file exceeded 5GB\"), and Coder is told why; the foreground's says it in Claude Code's words too", async () => {
  const S = await import("../container/server.mjs");
  const A = await import("../container/coder-agent.mjs");
  assert.equal(S.OUTPUT_KILL, 5 * 1024 ** 3);
  assert.equal(S.SIZE_KILLED, "Command killed: output file exceeded 5GB");
  const dir = await mkdtemp(join(tmpdir(), "coder-5gb-"));
  const bgDir = join(dir, "bg");
  // (A small stop here, so no 5 GB file is written: the same code, its size given.)
  const r = await S.execIn(dir, "sleep 1.5; yes coder-output-line", 1, { bgDir, outputKill: 2_000_000 });
  assert.equal(r.background, true, "moved to the background at its timeout");
  S.JOBS.set(r.pid, { project: "shop-5gb", id: "job1", pid: r.pid, log: r.log, command: "yes coder-output-line", desc: "", cwd: dir, at: Date.now(), moved: true, deadline: Date.now() + 60_000, box: false, end: null, told: false, stopping: "" });
  try {
    for (let k = 0; k < 150 && !S.JOBS.get(r.pid).end; k++) await wait(100);
    const end = S.JOBS.get(r.pid).end;
    assert.ok(end, "it was stopped");
    assert.deepEqual([end.code, end.why], [137, "size"]);
    for (let k = 0; k < 30 && !(await readFile(r.log, "utf8")).endsWith("]\n"); k++) await wait(100);
    const log = await readFile(r.log, "utf8");
    assert.ok(log.endsWith("\nCommand killed: output file exceeded 5GB\n[finished, exit code 137]\n"), "the note at its end, then its exit code: " + JSON.stringify(log.slice(-120)));
    const size = statSync(r.log).size;
    assert.ok(size > 2_000_000 && size < 40_000_000, "stopped just past its size: " + size);
  } finally { S.JOBS.delete(r.pid); }
  // What Coder and the chat are told.
  const n = A.bgEndNotice({ id: "job1", desc: "Print forever", command: "yes", log: "/srv/coder-bg/bg-1.log", code: 137, why: "size" });
  assert.equal(n.said, "Background command \"Print forever\" was stopped: its output passed 5 GB");
  assert.ok(n.note.includes("Command killed: output file exceeded 5GB (exit code 137).") && n.note.includes("read only its end (tail)") && n.note.endsWith("Its output is in /srv/coder-bg/bg-1.log (ID: job1)."));
  assert.deepEqual(n.end, { ok: false, label: "over 5 GB" });
  // In the foreground: stopped the same way, the same words at the end of what Coder reads.
  const fg = await S.execIn(dir, "yes coder-output-line", 30, { outputKill: 1_000_000, kill: true });
  assert.equal(fg.code, 137);
  assert.ok(fg.output.endsWith("\nCommand killed: output file exceeded 5GB"));
  await rm(dir, { recursive: true, force: true });
});

test("CD329 the memory cap's size and place, read as Claude Code 2.1.319 reads them: plain digits or K/M/G/T (1024 each, \"4GB\", \"4GiB\" and \"1.5G\" too); 0, off, false, no and none turn it off; anything else (4e9) is ignored; the cgroup v1 memory hierarchy, else cgroup v2's; one cgroup per chat, beside the service's own with v2", async () => {
  const S = await import("../container/server.mjs");
  const G = 1024 ** 3;
  const size = (v) => S.memorySize(v);
  assert.deepEqual([size("4G"), size("4GB"), size("4gib"), size("4 G"), size("512M"), size("1.5G"), size("1024"), size(" 2t ")], [{ bytes: 4 * G }, { bytes: 4 * G }, { bytes: 4 * G }, { bytes: 4 * G }, { bytes: 512 * 1024 ** 2 }, { bytes: Math.floor(1.5 * G) }, { bytes: 1024 }, { bytes: 2 * 1024 ** 4 }]);
  for (const off of ["0", "off", "OFF", "false", "no", "none"]) assert.deepEqual(size(off), { bytes: 0 }, off);
  for (const bad of ["", undefined, null, "4e9", "-1", "0.4", "lots", "4X", "4 gigs"]) assert.equal(size(bad), null, String(bad));
  // Where: as Claude Code finds it in /proc/self/cgroup.
  assert.deepEqual(S.cgroupLayout("9:name=systemd:/\n4:memory:/process_api/a1/claude-code-bash\n1:cpu:/\n0::/\n"), { mountRoot: "/sys/fs/cgroup/memory", path: "/process_api/a1/claude-code-bash", v2: false });
  assert.deepEqual(S.cgroupLayout("0::/init.scope\n"), { mountRoot: "/sys/fs/cgroup", path: "/init.scope", v2: true });
  assert.deepEqual(S.cgroupLayout("4:cpu,memory:/x\n0::/y\n"), { mountRoot: "/sys/fs/cgroup/memory", path: "/x", v2: false }, "a v1 memory controller wins");
  assert.equal(S.cgroupLayout("1:cpu:/\n2:pids:/\n"), null);
  // When there is none.
  assert.deepEqual(S.toolMemoryCgroup("shop-cap1", undefined), { dir: "", bytes: 0, why: "" }, "unset: no cap");
  assert.deepEqual(S.toolMemoryCgroup("shop-cap1", "off"), { dir: "", bytes: 0, why: "off" });
  assert.deepEqual(S.toolMemoryCgroup("shop-cap1", "4e9"), { dir: "", bytes: 0, why: "" }, "a size it can't read: ignored");
  assert.equal(S.toolMemoryCgroup("../x", "4G").why, "not a chat's project");
  assert.equal(S.toolMemoryCgroup("shop-cap1", "4G", { selfCgroup: () => "1:cpu:/\n" }).why, "no memory cgroup hierarchy");
  assert.equal(S.CG_WRAP, '{ echo 0 > "$0"/cgroup.procs; } 2>/dev/null; exec "$@"', "Claude Code's own start");
  // The job: set up from the environment's CODER_TOOL_MEMORY_LIMIT, given to the AI's commands and the owner's (never the tools).
  const s = serverSrc();
  assert.match(s, /const memVar = rawVars\.CODER_TOOL_MEMORY_LIMIT;\n\s+const cgSet = toolMemoryCgroup\(project, memVar\);/);
  assert.match(s, /\.\.\.\(tool \? \{\} : \{ onMove, onProgress: [^\n]*memCg: typeof t\.memCgNow === "function" \? t\.memCgNow\(\) : "" \}\)/, "only a command's, never a tool's");
  assert.match(s, /console\.log\("tool cgroup: disabled \(" \+ cgSet\.why \+ "\)"\)/, "the machine's log says why there is none");
});

test("CD330 the memory cap, for real: the chat's commands start in its memory cgroup (Claude Code's sh, then the command), the kernel kills one that goes over (exit 137, and nothing names the cap), all of them count against the one cap, and a command run as the AI's user is in it too", { skip: !root && "needs root (a memory cgroup)" }, async (t) => {
  const S = await import("../container/server.mjs");
  const project = "cap-test-" + Math.random().toString(36).slice(2, 8);
  const cg = S.toolMemoryCgroup(project, "64M");
  if (!cg.dir) { t.skip("this machine cannot make a memory cgroup: " + cg.why); return; }
  const dir = await mkdtemp(join(tmpdir(), "coder-cap-"));
  await chmod(dir, 0o755);
  const py = (mb, tail = "print('ok')") => "python3 -c \"b = bytearray(" + mb + " * 1024 * 1024); " + tail + "\"";
  try {
    assert.equal(cg.bytes, 64 * 1024 * 1024);
    const limit = readFileSync(join(cg.dir, existsSync(join(cg.dir, "memory.max")) ? "memory.max" : "memory.limit_in_bytes"), "utf8").trim();
    assert.equal(limit, String(64 * 1024 * 1024));
    const inIt = await S.execIn(dir, "cat /proc/self/cgroup", 10, { memCg: cg.dir });
    assert.ok(inIt.output.includes("/coder-bash-" + project), "the command is in the chat's cgroup: " + inIt.output);
    const small = await S.execIn(dir, py(16), 30, { memCg: cg.dir });
    assert.deepEqual([small.code, small.output], [0, "ok\n"]);
    const big = await S.execIn(dir, py(200), 30, { memCg: cg.dir });
    assert.equal(big.code, 137, "killed by the kernel");
    assert.ok(!/memory|cgroup|cap/i.test(big.output), "nothing in its result names the cap: " + JSON.stringify(big.output));
    // Without the cap the same command runs.
    assert.equal((await S.execIn(dir, py(200), 30, {})).code, 0);
    // One cap for all of them: 40 MB held in the background and 40 MB more in the foreground cannot both fit in 64 MB.
    const held = await S.execIn(dir, py(40, "import time; time.sleep(6)"), 1, { memCg: cg.dir, bgDir: join(dir, "bg") });
    assert.equal(held.background, true);
    const second = await S.execIn(dir, py(40, "import time; time.sleep(1); print('ok')"), 30, { memCg: cg.dir });
    for (let k = 0; k < 80 && !S.BG_EXITS.has(held.pid); k++) await wait(100);
    assert.ok(second.code === 137 || S.BG_EXITS.get(held.pid) === 137, "one of the two was killed: " + second.code + " / " + S.BG_EXITS.get(held.pid));
    // As the AI's user (setpriv, by its full name): in the cgroup, and that user.
    const asUser = await S.execIn(dir, "id -u; cat /proc/self/cgroup", 10, { uid: 65534, gid: 65534, memCg: cg.dir });
    assert.equal(asUser.output.split("\n")[0], "65534");
    assert.ok(asUser.output.includes("/coder-bash-" + project));
    // A cgroup that is gone: the command runs without the cap.
    const gone = await S.execIn(dir, "echo ran", 10, { memCg: "/sys/fs/cgroup/memory/coder-bash-not-there" });
    assert.deepEqual([gone.code, gone.output], [0, "ran\n"]);
  } finally {
    await wait(300);
    try { rmdirSync(cg.dir); } catch { /* still busy: the machine's own sweep */ }
    await rm(dir, { recursive: true, force: true });
  }
});

test("CD331 root starts the AI's commands with root's own programs, never one found on the AI's PATH (found 2026-11-09: the room's nsenter and setpriv were named alone, and the AI's PATH starts with ~/.local/bin, which the AI's user can write)", async (t) => {
  const R = await import("../container/coder-room.mjs");
  assert.deepEqual([R.NSENTER, R.SETPRIV], ["/usr/bin/nsenter", "/usr/bin/setpriv"]);
  assert.equal(R.roomArgs(1001, 1001, "echo hi")[2], "/usr/bin/setpriv", "setpriv, started by root's nsenter, by its full name");
  const s = serverSrc();
  assert.doesNotMatch(s, /spawn\("nsenter"|run\("nsenter"|run\("setpriv"|spawn\("setpriv"/, "no program root starts for the AI's commands is named alone");
  assert.match(s, /\? run\(NSENTER, sandboxArgs\(box\.pid, dir, command\)/);
  if (!root) { t.diagnostic("the real try needs root"); return; }
  // For real: a "nsenter" and a "setpriv" of the AI's in its ~/.local/bin are never run.
  const S = await import("../container/server.mjs");
  const home = await mkdtemp(join(tmpdir(), "coder-home-"));
  const dir = await mkdtemp(join(tmpdir(), "coder-path-"));
  await chmod(dir, 0o755);
  const mark = join(home, "ran-as-root");
  await mkdir(join(home, ".local", "bin"), { recursive: true });
  for (const name of ["nsenter", "setpriv"]) { await writeFile(join(home, ".local", "bin", name), "#!/bin/sh\ntouch " + mark + "\nexit 0\n"); await chmod(join(home, ".local", "bin", name), 0o755); }
  try {
    await S.execIn(dir, "echo hi", 5, { uid: 65534, gid: 65534, home, room: true });
    assert.equal(existsSync(mark), false, "the room's start: root's own nsenter");
    const capped = await S.execIn(dir, "echo hi; id -u", 5, { uid: 65534, gid: 65534, home, memCg: "/sys/fs/cgroup/memory/coder-bash-not-there" });
    assert.equal(existsSync(mark), false, "a capped start: root's own setpriv");
    assert.deepEqual([capped.code, capped.output], [0, "hi\n65534\n"]);
  } finally { await rm(home, { recursive: true, force: true }); await rm(dir, { recursive: true, force: true }); }
});

test("CD332 which commands get a diff (Claude Code: \"Background commands and read-only commands carry no diff\"; a git command that moves the working tree is skipped: its list, checkout, switch, stash, pull, merge, rebase, reset, restore, clean, cherry-pick and revert)", async () => {
  const P = await import("../container/coder-perms.mjs");
  assert.deepEqual(P.GIT_MOVES, ["checkout", "switch", "stash", "pull", "merge", "rebase", "reset", "restore", "clean", "cherry-pick", "revert"]);
  for (const c of ["git checkout main", "sudo git -C sub stash pop", "npm test && git reset --hard", "git -c a=b pull", "cd app; git cherry-pick abc", "git --git-dir=.g restore x"]) assert.equal(P.movesWorkTree(c), true, c);
  for (const c of ["git status", "git log --oneline", "echo checkout", "ls; git diff", "git commit -m 'reset the cart'", "npm run reset"]) assert.equal(P.movesWorkTree(c), false, c);
  for (const c of ["ls -la", "cat a.txt | grep x", "git status", "sed -n 1,5p a.js", "find . -name '*.js'"]) assert.equal(P.wholeReadOnly(c), true, c);
  for (const c of ["echo hi > out.txt", "npm test", "find . -delete", "rm a.txt", "ls && touch b", "echo 'open"]) assert.equal(P.wholeReadOnly(c), false, c);
});

/** A repository laid out as Coder's machine keeps one: its git folder outside the work tree (a `.git` file points to it). */
async function repoLikeCoders() {
  const base = await mkdtemp(join(tmpdir(), "coder-snap-test-"));
  const work = join(base, "shop"), gitDir = join(base, "git", "shop");
  await mkdir(work, { recursive: true });
  await mkdir(join(base, "git"));
  git(base, "init", "-q", "-b", "main", "--separate-git-dir=" + gitDir, work);
  await mkdir(join(work, "src"));
  await writeFile(join(work, "src", "app.js"), "const a = 1;\nconst b = 2;\nconsole.log(a + b);\n");
  await writeFile(join(work, "README.md"), "# Shop\n");
  await writeFile(join(work, ".gitignore"), "dist/\n");
  git(work, "add", "-A"); git(work, "commit", "-q", "-m", "first");
  return { base, work, gitDir };
}
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
/** Coder's tools script, run as the agent runs it (node coder-tools.mjs <base64>), in the project's folder. */
function tool(cwd, name, args, env = {}) {
  const b64 = Buffer.from(JSON.stringify({ tool: name, args })).toString("base64");
  const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, b64], { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
  return { code: r.status, output: r.stdout };
}

test("CD333 the files a command changed, taken as Claude Code's are (its hooks reference: changedFiles, at most 200 full paths; files, diffs of up to 5, created or deleted marked; moreFiles; unavailable when incomplete; \"Files that Git ignores and files in submodules aren't listed\"), as the AI's user, and nothing of the repository changes", async () => {
  const { base, work, gitDir } = await repoLikeCoders();
  try {
    const objectsBefore = execFileSync("find", [join(gitDir, "objects"), "-type", "f"]).toString().split("\n").length;
    const indexBefore = readFileSync(join(gitDir, "index"));
    const snap = JSON.parse(tool(work, "snap", { root: work }).output);
    assert.match(snap.id, /^coder-snap-[A-Za-z0-9]{6}$/);
    // What a command does: changes a line, adds a file, removes one, writes into an ignored folder, makes a 6 MB file.
    await writeFile(join(work, "src", "app.js"), "const a = 1;\nconst b = 3;\nconsole.log(a + b);\n");
    await writeFile(join(work, "notes.txt"), "one\ntwo\n");
    await unlink(join(work, "README.md"));
    await mkdir(join(work, "dist")); await writeFile(join(work, "dist", "out.js"), "built\n");
    await writeFile(join(work, "big.bin"), Buffer.alloc(6_000_000, 7));
    const d = JSON.parse(tool(work, "snapdiff", { id: snap.id }).output);
    assert.deepEqual(d.changedFiles, ["README.md", "big.bin", "notes.txt", "src/app.js"].map((p) => join(work, p)), "full paths; the ignored folder is not listed");
    assert.deepEqual(d.files.map((f) => [f.path.slice(work.length + 1), f.kind, f.add, f.del]), [["README.md", "delete", 0, 1], ["notes.txt", "create", 2, 0], ["src/app.js", "update", 1, 1]]);
    assert.deepEqual(d.files[2].lines, ["@@ -1,3 +1,3 @@", " const a = 1;", "-const b = 2;", "+const b = 3;", " console.log(a + b);"]);
    assert.equal(d.moreFiles, 1, "the big file: named, no diff");
    assert.equal(d.unavailable, true, "incomplete: a file over 5 MB is not read");
    // Nothing of the repository changed: its index and its objects are as they were.
    assert.deepEqual(readFileSync(join(gitDir, "index")), indexBefore);
    assert.equal(execFileSync("find", [join(gitDir, "objects"), "-type", "f"]).toString().split("\n").length, objectsBefore);
    assert.equal(existsSync(join(tmpdir(), snap.id)), false, "the snapshot's folder is gone");
    // A command that changed nothing: an empty list. The big file, unchanged, is no change.
    const s2 = JSON.parse(tool(work, "snap", { root: work }).output);
    const d2 = JSON.parse(tool(work, "snapdiff", { id: s2.id }).output);
    assert.deepEqual([d2.changedFiles, d2.files, d2.moreFiles, d2.unavailable], [[], [], 0, undefined]);
    // Diffs of five files at most; the others named.
    const s3 = JSON.parse(tool(work, "snap", { root: work }).output);
    for (let k = 1; k <= 7; k++) await writeFile(join(work, "src", "f" + k + ".js"), "x" + k + "\n");
    const d3 = JSON.parse(tool(work, "snapdiff", { id: s3.id }).output);
    assert.deepEqual([d3.changedFiles.length, d3.files.length, d3.moreFiles], [7, 5, 2]);
    // A snapshot dropped (the command went to the background): its folder goes.
    const s4 = JSON.parse(tool(work, "snap", { root: work }).output);
    assert.deepEqual(JSON.parse(tool(work, "snap", { drop: s4.id }).output), { dropped: true });
    assert.equal(existsSync(join(tmpdir(), s4.id)), false);
    // Never outside the chat's repositories; a folder that is no repository has none.
    assert.match(tool(work, "snap", { root: base }).output, /error: not one of the chat's repositories/);
    const plain = await mkdtemp(join(tmpdir(), "coder-norepo-"));
    assert.deepEqual(JSON.parse(tool(plain, "snap", { root: plain }).output), { unavailable: true, why: "not a git repository" });
    assert.match(tool(work, "snapdiff", { id: "../etc" }).output, /error: not a snapshot/);
    await rm(plain, { recursive: true, force: true });
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("CD334 Coder's loop takes the files a command changed with the environment's CODER_BASH_EDIT_DIFF on (Claude Code's CLAUDE_CODE_BASH_EDIT_DIFF), for the owner under the step: not for one that only reads, nor a git command that moves the work tree, nor one in the background, and not at all when it is off", async () => {
  const A = await import("../container/coder-agent.mjs");
  const { base, work } = await repoLikeCoders();
  try {
    const run = async (commands, opts) => {
      const events = [], ran = [];
      let n = 0;
      const exec = async ({ command, tool: isTool, inBg }) => {
        const m = isTool ? /coder-tools\.mjs (\S+)$/.exec(command) : null;
        if (m) {
          const req = JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
          ran.push(req.tool);
          return tool(work, req.tool, req.args);
        }
        if (inBg) return { code: -1, background: true, pid: 4242, log: join(base, "bg.log"), jobId: "job1", output: "" };
        const r = spawnSync("bash", ["-c", command], { cwd: work, encoding: "utf8" });
        return { code: r.status, output: r.stdout + r.stderr };
      };
      const steps = [say("", commands.map((c, k) => call("bash", c, "b" + k))), say("Done.")];
      await A.runCoder({ send: async () => steps[Math.min(n++, steps.length - 1)], exec, emit: (e) => events.push(e), here: () => work, root: work }, { text: "go", ...opts });
      return { events, ran, result: (id) => events.find((e) => e.type === "result" && e.id === id) };
    };
    const on = await run([{ command: "sed -i 's/b = 2/b = 5/' src/app.js && printf 'new\\n' > added.txt" }, { command: "cat src/app.js" }, { command: "git checkout -- added.txt 2>/dev/null; true" }, { command: "sleep 30", run_in_background: true }], { editDiff: true });
    const f = on.result("b0").files;
    assert.deepEqual(f.files.map((x) => [x.path, x.kind, x.add, x.del]), [["added.txt", "create", 1, 0], ["src/app.js", "update", 1, 1]], "named as in the project");
    assert.ok(f.files[1].lines.includes("+const b = 5;"));
    assert.equal(on.result("b1").files, undefined, "cat only reads");
    assert.equal(on.result("b2").files, undefined, "git checkout moves the work tree");
    assert.equal(on.result("b3").files, undefined, "in the background");
    assert.deepEqual(on.ran, ["snap", "snapdiff"], "one snapshot, around the one command that gets a diff");
    const off = await run([{ command: "printf 'more\\n' >> added.txt" }], {});
    assert.equal(off.result("b0").files, undefined);
    assert.deepEqual(off.ran, [], "off: no snapshot at all");
    // A command that changed nothing (it writes, but no file's content changes): nothing shown.
    const none = await run([{ command: "printf '' >> src/app.js" }], { editDiff: true });
    assert.equal(none.result("b0").files, undefined);
    assert.deepEqual(none.ran, ["snap", "snapdiff"]);
    // The owner's own command (! …) too.
    const own = await (async () => {
      const events = [];
      const exec = async ({ command, tool: isTool }) => {
        const m = isTool ? /coder-tools\.mjs (\S+)$/.exec(command) : null;
        if (m) { const req = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); return tool(work, req.tool, req.args); }
        const r = spawnSync("bash", ["-c", command], { cwd: work, encoding: "utf8" });
        return { code: r.status, output: r.stdout };
      };
      await A.runCoder({ send: async () => say("Noted."), exec, emit: (e) => events.push(e), here: () => work, root: work }, { shell: "printf 'owner\\n' > owner.txt", editDiff: true });
      return events.find((e) => e.type === "result" && String(e.id).startsWith("own"));
    })();
    assert.deepEqual(own.files.files.map((x) => [x.path, x.kind]), [["owner.txt", "create"]]);
  } finally { await rm(base, { recursive: true, force: true }); }
  // What the page gets: names in the project, no secrets, the others by name.
  const shown = A.changedShown({ changedFiles: ["/w/a.txt", "/w/b.txt", "/other/c.txt"], files: [{ path: "/w/a.txt", kind: "update", add: 1, del: 0, lines: ["@@ -1 +1,2 @@", " x", "+token=ghp_" + "a".repeat(36)] }], moreFiles: 2 }, { root: "/w" });
  assert.deepEqual(shown.files[0].path, "a.txt");
  assert.ok(!shown.files[0].lines.join("\n").includes("ghp_" + "a".repeat(36)), "secrets hidden");
  assert.deepEqual([shown.others, shown.moreFiles], [["b.txt", "/other/c.txt"], 2]);
  assert.equal(A.changedShown({ changedFiles: [], files: [], moreFiles: 0, unavailable: true }), null, "nothing listed: nothing shown (as Claude Code)");
});

test("CD335 the page shows the files a command changed under its step, as Claude Code shows them after the command (\"Updated src/app.js\" with +N −M, Created, Deleted, each with its lines; the others by name; a note when incomplete), and the Worker hides the owner's values in them", async () => {
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /stepChange\(r, key\) \+\n\s+\/\/ THE FILES A COMMAND CHANGED[^\n]*\n\s+stepFiles\(r, key\) \+/);
  assert.match(page, /const verb = f\.kind === 'create' \? 'Created' : f\.kind === 'delete' \? 'Deleted' : 'Updated';/);
  assert.match(page, /'Also changed: '/);
  assert.match(page, /Some of what it changed could not be shown here: See changes has it all\./);
  const { hideIn } = await import("../src/coder-routes.mjs");
  const ev = hideIn([{ type: "result", output: "x", files: { files: [{ path: "s3cr3t-value.txt", kind: "create", lines: ["+key=s3cr3t-value"] }], others: ["dir/s3cr3t-value"], moreFiles: 1 } }], ["s3cr3t-value"]);
  assert.deepEqual(ev[0].files.files[0], { path: "[hidden].txt", kind: "create", lines: ["+key=[hidden]"] });
  assert.deepEqual(ev[0].files.others, ["dir/[hidden]"]);
});

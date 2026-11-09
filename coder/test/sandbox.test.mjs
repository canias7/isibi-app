// THE ADMIN SANDBOX (owner, 2026-11-07: "finish this": Claude Code's commands run as
// full admin; container/coder-sandbox.mjs). CD147 tries it for real as root (the deploy
// runs it; skipped elsewhere); CD148 checks how Coder's service uses it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, chownSync, chmodSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const S = await import("../container/coder-sandbox.mjs");
const R = await import("../container/coder-room.mjs");
const have = (c) => spawnSync("sh", ["-c", "command -v " + c], { stdio: "ignore" }).status === 0;
const root = typeof process.getuid === "function" && process.getuid() === 0;
const ready = root && ["ip", "nsenter", "setpriv", "unshare", "mountpoint", "findmnt", "newuidmap", "sudo", "python3", "curl"].every(have) && spawnSync("getent", ["passwd", "1001"]).status === 0;
const NAME = "coder-room-sbxtest", NS = "/run/netns/" + NAME;

// As Coder's service runs a command in it (execIn): the sandbox's dev, in `wd`.
const inBox = (box, wd, cmd) => new Promise((ok) => {
  const p = spawn("nsenter", S.sandboxArgs(box.pid, wd, cmd), { cwd: "/", stdio: ["ignore", "pipe", "pipe"], env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", HOME: "/tmp", CODER_SANDBOX: "1" } });
  let out = "";
  p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { out += b; });
  const t = setTimeout(() => p.kill("SIGKILL"), 60000);
  p.on("close", (code) => { clearTimeout(t); ok({ code, out: out.trim() }); });
});

test("CD147 the admin sandbox, for real: sudo for anything inside (packages, system files, folder renames as dpkg does them), the chat's files stay dev's on disk, the machine's own files are untouched; it cannot change or leave the room, see the machine's processes or folders; a stop ends everything in it; its own layer is kept for the next job", { skip: !ready && process.env.CODER_TESTS_NEED_ROOT !== "1" && "needs root, a user 1001, and ip, nsenter, setpriv, unshare, mountpoint, findmnt, newuidmap, sudo, python3, curl" }, async () => {
  // Root may give the sandbox its ids (the image has this line).
  for (const f of ["/etc/subuid", "/etc/subgid"]) if (!/^root:1000000:262144$/m.test(readFileSync(f, "utf8"))) appendFileSync(f, "root:1000000:262144\n");
  const dir = mkdtempSync("/run/coder-sbx-test-"), data = mkdtempSync("/var/tmp/coder-sbx-data-");
  chmodSync(data, 0o755);
  spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
  let box = null;
  try {
    const base = S.sandboxBase();
    assert.ok(base, "a base for the sandbox's system");
    assert.equal(S.makeLower({ base, dir }), true, "the base, shown read-only through the id map: " + S.sandboxWhy());
    assert.equal(statSync(join(dir, "lower", "usr")).uid, S.SBX_BASE, "root's files appear as the sandbox admin's");
    const up = S.makeUpper({ data, image: "registry.fly.io/app:coder-aaaa" });
    assert.ok(up && statSync(up.upper).uid === S.SBX_BASE, "its own layer, the sandbox admin's");
    assert.equal(R.makeRoom({ ns: NS, name: NAME }), true);
    const work = join(data, "work"), proj = join(work, "shop");
    mkdirSync(proj, { recursive: true });
    for (const p of [work, proj]) chownSync(p, 0, 0);
    chownSync(proj, 1001, 1001);
    writeFileSync(join(proj, "old.txt"), "dev's file\n"); chownSync(join(proj, "old.txt"), 1001, 1001);
    const logs = mkdtempSync("/var/tmp/coder-sbx-logs-"); chmodSync(logs, 0o755); writeFileSync(join(logs, "bg-1.log"), "a log\n");
    const sub = { u: { start: 165536, count: 65536 }, g: { start: 165536, count: 65536 } };
    box = await S.startSandbox({ ...up, ns: NS, dir, sub, binds: [{ src: work, mode: "rw", mine: true }, { src: logs, mode: "ro" }] });
    assert.ok(box && box.pid > 1, "the sandbox started: " + S.sandboxWhy());
    const sh = (cmd) => inBox(box, proj, cmd);

    // ITS dev, WITH SUDO FOR ANYTHING.
    assert.equal((await sh("id -u; id -un")).out, "1001\n" + spawnSync("getent", ["passwd", "1001"], { encoding: "utf8" }).stdout.split(":")[0]);
    assert.equal((await sh("sudo -n id -u")).out, "0");
    assert.match((await sh("cat /etc/coder-sandbox")).out, /sudo works for any command/);
    assert.equal((await sh("pwd")).out, proj, "in the project's folder");
    assert.equal((await sh("sudo -n sh -c 'echo admin > /etc/coder-sbx-test' && cat /etc/coder-sbx-test")).out, "admin", "a system file");
    assert.equal(existsSync("/etc/coder-sbx-test"), false, "...in the sandbox only: the machine's own is untouched");
    // A folder renamed as dpkg does it (a new folder with no rights, then renamed): fails without userxattr.
    assert.equal((await sh("sudo -n python3 -I -c \"import os; os.mkdir('/usr/local/share/zz.new', 0); os.rename('/usr/local/share/zz.new', '/usr/local/share/zz'); print('renamed')\"")).out, "renamed");

    // THE CHAT'S FILES: dev's inside, dev's on disk; and nothing in them can be made as the machine's admin.
    assert.equal((await sh("echo new > new.txt && echo more >> old.txt && cat old.txt")).out, "dev's file\nmore");
    assert.equal(statSync(join(proj, "new.txt")).uid, 1001);
    assert.notEqual((await sh("sudo -n touch made-by-admin.txt")).code, 0, "admin cannot make a file there (it would not be dev's)");
    assert.equal(existsSync(join(proj, "made-by-admin.txt")), false);
    // Dev's own extra ids (its Docker's containers' users) can own files there, and are the same ids on disk; no other can.
    assert.equal((await sh("sudo -n chown 166000:166000 new.txt && stat -c %u:%g new.txt")).out, "166000:166000");
    assert.equal(statSync(join(proj, "new.txt")).uid, 166000, "on disk too");
    for (const who of ["0", "5000", "1000", "231072"]) assert.notEqual((await sh("sudo -n chown " + who + " old.txt")).code, 0, "never " + who);
    assert.equal(statSync(join(proj, "old.txt")).uid, 1001);
    await sh("sudo -n chown 1001:1001 new.txt");
    // Read-only views stay read-only.
    assert.equal((await sh("cat " + join(logs, "bg-1.log"))).out, "a log");
    assert.notEqual((await sh("sudo -n sh -c 'echo x >> " + join(logs, "bg-1.log") + "'")).code, 0);

    // THE WALLS: not the room's network, not the machine's, not its processes or folders.
    // (Its own / is its own layer, writable by design; the machine's disk is not in it at all.)
  // (Its process 1 is its own first process: the machine's are not in it to name.)
  for (const cmd of ["sudo -n ip link add d0 type dummy", "sudo -n ip link set lo down", "sudo -n nsenter -t 1 -n true", "curl -sS -m 3 --noproxy '*' https://example.com/"]) {
      assert.notEqual((await sh(cmd)).code, 0, cmd + " is refused");
    }
    // (Its first process is a bash loop with its sleep: the live test after deploy 75.)
    assert.match((await sh("ps -e -o comm=")).out, /^bash\nsleep\n(bash\n)?ps$/, "only its own processes");
    assert.notEqual((await sh("ls " + dir)).code, 0, "not the machine's sandbox folder");
    assert.equal((await sh("ls " + data)).out, "work", "of the kept disk, only what it was shown");

    // ITS /tmp (the owner, 2026-11-08: "Fix that too"): of its own layer, so kept for the next job, as Claude Code keeps
    // /tmp for its session (each job had a fresh, empty one before); open to every user, as a /tmp is.
    assert.equal((await sh("findmnt -n -o FSTYPE --target /tmp")).out, "overlay", "not a fresh, empty /tmp for each job");
    assert.equal((await sh("stat -c %a /tmp")).out, "1777");
    assert.equal((await sh("echo kept > /tmp/coder-sbx-tmp-test && cat /tmp/coder-sbx-tmp-test")).out, "kept");
    // A STOP ENDS EVERYTHING IN IT; its layer is kept for the next job.
    await sh("sleep 1000 >/dev/null 2>&1 & echo started");
    const pid = box.pid;
    box.stop(); box = null;
    // Ended: gone, or only waiting to be cleared away (a zombie).
    const ended = (p) => { try { return /^\d+ \(.*\) Z /.test(readFileSync("/proc/" + p + "/stat", "utf8")); } catch { return true; } };
    for (let i = 0; i < 50 && !(ended(pid) && spawnSync("pgrep", ["-f", "sleep 1000"]).status === 1); i++) await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(ended(pid), true, "its first process ended");
    assert.equal(spawnSync("pgrep", ["-f", "sleep 1000"]).status, 1, "and what was started in it");
    box = await S.startSandbox({ ...up, ns: NS, dir, binds: [{ src: work, mode: "rw", mine: true }] });
    assert.equal((await inBox(box, proj, "cat /etc/coder-sbx-test")).out, "admin", "the next job's sandbox keeps what was changed");
    assert.equal((await inBox(box, proj, "cat /tmp/coder-sbx-tmp-test")).out, "kept", "its /tmp too");
    // A NEW CODER VERSION STARTS IT FRESH.
    box.stop(); box = null;
    const up2 = S.makeUpper({ data, image: "registry.fly.io/app:coder-bbbb" });
    assert.equal(existsSync(up.upper), false, "the old version's layer is gone");
    box = await S.startSandbox({ ...up2, ns: NS, dir, binds: [{ src: work, mode: "rw", mine: true }] });
    assert.notEqual((await inBox(box, proj, "cat /etc/coder-sbx-test")).code, 0);
    assert.notEqual((await inBox(box, proj, "cat /tmp/coder-sbx-tmp-test")).code, 0, "and its /tmp starts empty");
  } finally {
    if (box) box.stop();
    spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
    for (const m of ["lower", "image"]) spawnSync("umount", ["-l", join(dir, m)], { stdio: "ignore" });
  }
});

test("CD301 (the live test after deploy 75) a background command in the admin sandbox, paused while root works and resumed, is still seen to end: its own starter (nsenter, outside the sandbox) is woken too, so it collects the command and its output closes; and what a command leaves behind in the sandbox is collected by its first process, never left a zombie", { skip: !ready && process.env.CODER_TESTS_NEED_ROOT !== "1" && "needs root, a user 1001, and ip, nsenter, setpriv, unshare, mountpoint, findmnt, newuidmap, sudo, python3, curl" }, async () => {
  const F = await import("../container/coder-freeze.mjs");
  const { wakeStarters } = await import("../container/server.mjs");
  for (const f of ["/etc/subuid", "/etc/subgid"]) if (!/^root:1000000:262144$/m.test(readFileSync(f, "utf8"))) appendFileSync(f, "root:1000000:262144\n");
  const dir = mkdtempSync("/run/coder-sbx-test-"), data = mkdtempSync("/var/tmp/coder-sbx-data-");
  chmodSync(data, 0o755);
  spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
  let box = null, job = null;
  const state = (pid) => { try { return readFileSync("/proc/" + pid + "/stat", "utf8").replace(/^\d+ \(.*\) /, "")[0]; } catch { return "gone"; } };
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  try {
    assert.equal(S.makeLower({ base: S.sandboxBase(), dir }), true, S.sandboxWhy());
    const up = S.makeUpper({ data, image: "registry.fly.io/app:coder-cccc" });
    assert.equal(R.makeRoom({ ns: NS, name: NAME }), true);
    const work = join(data, "work"), proj = join(work, "shop");
    mkdirSync(proj, { recursive: true });
    for (const p of [work, proj]) chownSync(p, 0, 0);
    chownSync(proj, 1001, 1001);
    box = await S.startSandbox({ ...up, ns: NS, dir, binds: [{ src: work, mode: "rw", mine: true }] });
    assert.ok(box && box.pid > 1, "the sandbox started: " + S.sandboxWhy());
    // The background command, started as Coder's service starts one in the sandbox.
    job = spawn("nsenter", S.sandboxArgs(box.pid, proj, "for i in $(seq 1 20); do echo t$i; sleep 0.1; done; echo done"), { cwd: "/", detached: true, stdio: ["ignore", "pipe", "pipe"], env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", HOME: "/tmp" } });
    let out = "", closed = false;
    job.stdout.on("data", (b) => { out += b; }); job.on("close", () => { closed = true; });
    await wait(500);
    // Paused, as at a turn's end while root saves to GitHub: its starter stops itself too.
    const p = await F.pauseAI({ uid: 1001, gid: 1001, boxPid: box.pid, box: [S.SBX_BASE, S.SBX_BASE + S.SBX_RANGE] });
    assert.equal(p.ok, true, p.why);
    for (let i = 0; i < 50 && state(job.pid) !== "T"; i++) await wait(20);
    assert.equal(state(job.pid), "T", "nsenter stopped itself with its command");
    assert.equal(p.procs.has(job.pid), false, "and is none of the AI's processes, so resumeAI does not wake it");
    F.resumeAI(p.procs, { boxPid: box.pid });
    await wait(3500);
    assert.equal(/done/.test(out), true, "the command went on after the pause and finished");
    assert.equal(closed, false, "...yet, with its starter left stopped, its end is never seen (the live test's bug)");
    // The fix: its starter is woken too.
    wakeStarters([{ pid: job.pid }]);
    for (let i = 0; i < 100 && !closed; i++) await wait(20);
    assert.equal(closed, true, "woken, it collects its command: the output closes and the command is seen to end");
    // What a command leaves behind is collected by the sandbox's first process when it ends.
    await inBox(box, proj, "(sleep 0.3 &) ; true");
    await wait(1200);
    assert.equal((await inBox(box, proj, "ps -e -o stat= | grep -c '^Z' || true")).out, "0", "no zombie left in the sandbox");
  } finally {
    if (job && job.exitCode === null) { try { process.kill(-job.pid, "SIGKILL"); } catch { /* gone */ } }
    if (box) box.stop();
    spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
    for (const m of ["lower", "image"]) spawnSync("umount", ["-l", join(dir, m)], { stdio: "ignore" });
  }
});

test("CD148 the service runs the AI's commands and the setup script in the job's admin sandbox when there is one (in the room), stops it with the AI's other commands, and tells Coder it has admin for anything", async () => {
  // HOW A COMMAND ENTERS IT: as its dev, into the folder from inside.
  assert.deepEqual(S.sandboxArgs(42, "/data/work/it's", "ls -la"), ["-t", "42", "--user", "--mount", "--pid", "--net", "--root", "--wd", "-S", "1001", "-G", "1001", "--", "/bin/bash", "-c", "cd -- '/data/work/it'\\''s' || exit 1\nls -la"]);
  assert.deepEqual([S.SBX_BASE, S.SBX_RANGE, S.SBX_FILES], [1000000, 262144, 1001]);
  // CLEAR OF EVERY OTHER USER'S RANGE IN THE IMAGE, AND dev's DOCKER RANGE FITS INSIDE (GitHub's image check: it did not).
  assert.ok(S.SBX_BASE >= 231072, "past dev's own range (165536-231071)");
  assert.ok(231072 <= S.SBX_RANGE, "dev's Docker range, inside the sandbox, is mapped");
  // ITS SYSTEM'S BASE: the machine's root when plain; on Fly.io, the image's own disk; else none.
  const at = (type, vda = true, set = "") => S.sandboxBase({ run: () => ({ status: 0, stdout: type + "\n" }), exists: (p) => (p === "/dev/vda" ? vda : p === set), env: set ? { CODER_SANDBOX_BASE: set } : {} });
  assert.equal(at("ext4"), "/");
  assert.equal(at("overlay"), "/dev/vda");
  assert.equal(at("overlay", false), null);
  assert.equal(at("overlay", false, "/dev/loop7"), "/dev/loop7", "GitHub's machine check names one");
  assert.equal(S.sandboxBase({ env: { CODER_SANDBOX_BASE: "relative/x" }, exists: () => true }), null);
  // WHY THERE IS NONE (deploy, 2026-11-07: on GitHub's own machine it did not start, and nothing said why).
  const failing = (cmd, args) => (cmd === "mountpoint" ? { status: 1 } : { status: 32, stderr: "mount: /x: wrong fs type, bad option.\n" });
  const dirX = mkdtempSync("/tmp/coder-sbx-why-");
  assert.equal(S.makeLower({ base: "/dev/null", dir: dirX, run: failing }), false);
  assert.match(S.sandboxWhy(), root ? /^could not open \/dev\/null: mount: \/x: wrong fs type, bad option\.$/ : /^not the machine's admin$/);
  assert.equal(await S.startSandbox({ upper: "", work: "", dir: dirX, run: failing }), null);
  assert.match(S.sandboxWhy(), root ? /^no layer of its own$/ : /^not the machine's admin$/);
  // THE FIRST PROCESS: its system (the image under its own layer, renames working), its devices,
  // what it is shown, sudo for anything there only, then in for good.
  const init = readFileSync(new URL("../container/coder-sandbox-init.sh", import.meta.url), "utf8");
  assert.match(init, /mount -t overlay overlay -o "lowerdir=\$SBX_LOWER,upperdir=\$SBX_UPPER,workdir=\$SBX_WORK,userxattr" "\$R"/);
  assert.match(init, /^#1001 ALL=\(ALL:ALL\) NOPASSWD: ALL$/m);
  // Only rules both kinds of sudo know: the classic one (Coder's image) and sudo-rs (Ubuntu 26.04, GitHub's
  // deploy machine, which said "unknown setting: 'requiretty'"; Ubuntu's sudo never asks for a terminal anyway).
  assert.doesNotMatch(init, /requiretty/);
  assert.match(init, /> "\$R\/etc\/coder-sandbox"/);
  assert.match(init, /pivot_root \. \.coder-outside\ncd \/\numount -l \/\.coder-outside/);
  assert.match(init, /echo ready\n(?:#[^\n]*\n)*while :; do sleep 3600 & wait \$!; done\n$/, "its first process collects what ends in it (the live test after deploy 75)");
  // /tmp is the sandbox's own layer's, kept between jobs (never a fresh tmpfs again); /run and /dev/shm last one job.
  assert.doesNotMatch(init, /tmpfs "\$R\/tmp"/);
  assert.match(init, /^chmod 1777 "\$R\/tmp"/m);
  assert.match(init, /tmpfs "\$R\/run"/);
  const mod = readFileSync(new URL("../container/coder-sandbox.mjs", import.meta.url), "utf8");
  // Its script handed over whole: the sandbox's admin may not reach where Coder's code sits (GitHub's /home/runner).
  assert.match(mod, /"--", "\/bin\/bash", "-c", readFileSync\(SBX_INIT, "utf8"\), "coder-sandbox-init"\]/);
  assert.ok(Buffer.byteLength(init) < 100_000, "well inside one argument's limit (128 KB)");
  assert.match(mod, /const opts = b\.mine \? \["--bind", "-o", \(b\.mode === "ro" \? "ro," : ""\) \+ idmap\]/, "dev's folders, through mineIdmap");
  // DEV'S FOLDERS: dev, and dev's own extra ids (its Docker's; GitHub's image check: "value too large"
  // without them); never the machine's admin or another user.
  const img = { u: { start: 165536, count: 65536 }, g: { start: 165536, count: 65536 } };
  assert.equal(S.mineIdmap(img), "X-mount.idmap=b:1001:1001001:1 u:165536:1165536:65536 g:165536:1165536:65536");
  assert.equal(S.mineIdmap({ u: null, g: null }), "X-mount.idmap=b:1001:1001001:1", "only dev, when dev has none");
  for (const bad of [{ start: 0, count: 65536 }, { start: 1, count: 2000 }, { start: 1001, count: 1 }, { start: 200000, count: 65536 }, { start: 165536, count: 0 }, { start: "x", count: 5 }]) {
    assert.equal(S.mineIdmap({ u: bad, g: bad }), "X-mount.idmap=b:1001:1001001:1", JSON.stringify(bad) + " is never mapped");
  }
  // Read from the image's own lists, by name or by number; another user's lines are not dev's.
  const lists = { "/etc/subuid": "ubuntu:100000:65536\nroot:1000000:262144\ndev:165536:65536\n", "/etc/subgid": "ubuntu:100000:65536\n1001:165536:65536\n" };
  assert.deepEqual(S.devSubIds({ read: (f) => lists[f] }), img);
  assert.deepEqual(S.devSubIds({ read: () => "ubuntu:100000:65536\ndev:396608:65536\n" }), { u: null, g: null }, "a range past the sandbox's own ids is not used");
  assert.deepEqual(S.devSubIds({ read: () => { throw new Error("none"); } }), { u: null, g: null });
  assert.match(mod, /"ro,X-mount\.idmap=b:0:" \+ SBX_BASE \+ ":" \+ SBX_RANGE/, "the base: read-only");
  // THE SERVICE.
  const s = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(s, /const p = box && uid !== null\n\s+\? spawn\("nsenter", sandboxArgs\(box\.pid, dir, command\), \{ cwd: "\/", env, detached: true, stdio: \["ignore", "pipe", "pipe"\] \}\)/, "a command in it");
  assert.match(s, /export function killUser\(uid = RUN_UID, gid = RUN_GID\) \{\n\s+\/\/[^\n]*\n\s+if \(BOX\) \{ BOX\.stop\(\); BOX = null; \}/, "ended wherever the AI's commands are (before root's git, at a job's end, at the next job)");
  assert.match(s, /if \(t\.room && !BOX\) BOX = await openBox\(\);\n\s+t\.box = t\.room \? BOX : null;/, "only in the room (one kept from the last message, while a background command of its runs in it, is used again)");
  assert.match(s, /const binds = \[\{ src: root, mode: "rw", mine: true \}, \.\.\.\(home \? \[\{ src: home, mode: "rw", mine: true \}\] : \[\]\), \{ src: memRoot, mode: "rw", mine: true \}, \{ src: gitRoot, mode: "ro" \}, \{ src: bgRoot, mode: "ro" \}, \{ src: proxyDir, mode: "ro" \}\];/, "what it is shown");
  assert.match(s, /const \{ packages, script: userPart \} = t\.box \? \{ packages: \[\], script \} : splitSetup\(script\);/, "the whole setup script in it");
  assert.match(s, /const u = await execIn\(dir, userPart, left, \{ bgDir, kill: true, home, room: t\.room, box: t\.box, /);
  assert.match(s, /const r = await execIn\(dir, command, timeoutS, \{ bgDir, kill: !!tool, home, room: t\.room, box: t\.box, /);
  assert.match(s, /\(t\.box \? MACHINE_ADMIN : MACHINE_TOOLS\)/);
  assert.match(s, /createApp\(\{ kept: bootKept\(\), gitVia: true, modelVia: true, room: true, sandbox: true, data: process\.env\.CODER_DATA \|\| null, image: process\.env\.CODER_IMAGE_REF \|\| imageId\(\),/);
  // WHAT CODER IS TOLD.
  const { MACHINE_ADMIN, MACHINE_TOOLS } = await import("../container/coder-agent.mjs");
  assert.match(MACHINE_ADMIN, /You have admin for anything, as on Claude Code's machine: sudo works for every command/);
  assert.doesNotMatch(MACHINE_ADMIN, /The master key's jobs/);
  assert.match(MACHINE_TOOLS, /The master key's jobs are yours/, "without the sandbox, as before");
  // THE WRAPPERS: in the sandbox only, admin for anything with no sudo to type.
  const tool = (n) => readFileSync(new URL("../container/tools/" + n, import.meta.url), "utf8");
  assert.match(tool("apt-get"), /\[ -e \/etc\/coder-sandbox \] && exec \/usr\/bin\/sudo -n "\$real" "\$@"/);
  assert.match(tool("service"), /if \[ "\$\(id -u\)" != 0 \] && \[ -e \/etc\/coder-sandbox \]; then exec \/usr\/bin\/sudo -n \/usr\/sbin\/service "\$@"; fi/);
  assert.match(tool("sudo"), /\[ -e \/etc\/coder-sandbox \] && exec \/usr\/bin\/sudo "\$@"/);
  // THE IMAGE: the sandbox's ids for root, its files; Fly.io names the version.
  const df = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8");
  assert.match(df, /echo 'root:1000000:262144' >> \/etc\/subuid/);
  assert.match(df, /coder-sandbox\.mjs coder-sandbox-init\.sh coder-globs\.mjs coder-security\.mjs coder-compact\.mjs coder-shell\.mjs coder-bashcheck\.mjs coder-freeze\.mjs \.\//);
  assert.match(readFileSync(new URL("../src/coder-fly.mjs", import.meta.url), "utf8"), /env: \{ CODER_DATA: FLY_DATA, CODER_IMAGE_REF: s\.image,/);
});

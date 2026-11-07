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
  for (const f of ["/etc/subuid", "/etc/subgid"]) if (!/^root:200000:196608$/m.test(readFileSync(f, "utf8"))) appendFileSync(f, "root:200000:196608\n");
  const dir = mkdtempSync("/run/coder-sbx-test-"), data = mkdtempSync("/var/tmp/coder-sbx-data-");
  chmodSync(data, 0o755);
  spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
  let box = null;
  try {
    const base = S.sandboxBase();
    assert.ok(base, "a base for the sandbox's system");
    assert.equal(S.makeLower({ base, dir }), true, "the base, shown read-only through the id map");
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
    box = await S.startSandbox({ ...up, ns: NS, dir, binds: [{ src: work, mode: "rw", mine: true }, { src: logs, mode: "ro" }] });
    assert.ok(box && box.pid > 1, "the sandbox started");
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
    // Read-only views stay read-only.
    assert.equal((await sh("cat " + join(logs, "bg-1.log"))).out, "a log");
    assert.notEqual((await sh("sudo -n sh -c 'echo x >> " + join(logs, "bg-1.log") + "'")).code, 0);

    // THE WALLS: not the room's network, not the machine's, not its processes or folders.
    // (Its own / is its own layer, writable by design; the machine's disk is not in it at all.)
  // (Its process 1 is its own first process: the machine's are not in it to name.)
  for (const cmd of ["sudo -n ip link add d0 type dummy", "sudo -n ip link set lo down", "sudo -n nsenter -t 1 -n true", "curl -sS -m 3 --noproxy '*' https://example.com/"]) {
      assert.notEqual((await sh(cmd)).code, 0, cmd + " is refused");
    }
    assert.match((await sh("ps -e -o comm=")).out, /^sleep\n(bash\n)?ps$/, "only its own processes");
    assert.notEqual((await sh("ls " + dir)).code, 0, "not the machine's sandbox folder");
    assert.equal((await sh("ls " + data)).out, "work", "of the kept disk, only what it was shown");

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
    // A NEW CODER VERSION STARTS IT FRESH.
    box.stop(); box = null;
    const up2 = S.makeUpper({ data, image: "registry.fly.io/app:coder-bbbb" });
    assert.equal(existsSync(up.upper), false, "the old version's layer is gone");
    box = await S.startSandbox({ ...up2, ns: NS, dir, binds: [{ src: work, mode: "rw", mine: true }] });
    assert.notEqual((await inBox(box, proj, "cat /etc/coder-sbx-test")).code, 0);
  } finally {
    if (box) box.stop();
    spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
    for (const m of ["lower", "image"]) spawnSync("umount", ["-l", join(dir, m)], { stdio: "ignore" });
  }
});

test("CD148 the service runs the AI's commands and the setup script in the job's admin sandbox when there is one (in the room), stops it with the AI's other commands, and tells Coder it has admin for anything", async () => {
  // HOW A COMMAND ENTERS IT: as its dev, into the folder from inside.
  assert.deepEqual(S.sandboxArgs(42, "/data/work/it's", "ls -la"), ["-t", "42", "--user", "--mount", "--pid", "--net", "--root", "--wd", "-S", "1001", "-G", "1001", "--", "/bin/bash", "-c", "cd -- '/data/work/it'\\''s' || exit 1\nls -la"]);
  assert.deepEqual([S.SBX_BASE, S.SBX_RANGE, S.SBX_FILES], [200000, 196608, 1001]);
  // ITS SYSTEM'S BASE: the machine's root when plain; on Fly.io, the image's own disk; else none.
  const at = (type, vda = true, set = "") => S.sandboxBase({ run: () => ({ status: 0, stdout: type + "\n" }), exists: (p) => (p === "/dev/vda" ? vda : p === set), env: set ? { CODER_SANDBOX_BASE: set } : {} });
  assert.equal(at("ext4"), "/");
  assert.equal(at("overlay"), "/dev/vda");
  assert.equal(at("overlay", false), null);
  assert.equal(at("overlay", false, "/dev/loop7"), "/dev/loop7", "GitHub's machine check names one");
  assert.equal(S.sandboxBase({ env: { CODER_SANDBOX_BASE: "relative/x" }, exists: () => true }), null);
  // THE FIRST PROCESS: its system (the image under its own layer, renames working), its devices,
  // what it is shown, sudo for anything there only, then in for good.
  const init = readFileSync(new URL("../container/coder-sandbox-init.sh", import.meta.url), "utf8");
  assert.match(init, /mount -t overlay overlay -o "lowerdir=\$SBX_LOWER,upperdir=\$SBX_UPPER,workdir=\$SBX_WORK,userxattr" "\$R"/);
  assert.match(init, /^#1001 ALL=\(ALL:ALL\) NOPASSWD: ALL$/m);
  assert.match(init, /> "\$R\/etc\/coder-sandbox"/);
  assert.match(init, /pivot_root \. \.coder-outside\ncd \/\numount -l \/\.coder-outside/);
  assert.match(init, /echo ready\nexec sleep infinity\n$/);
  const mod = readFileSync(new URL("../container/coder-sandbox.mjs", import.meta.url), "utf8");
  assert.match(mod, /"X-mount\.idmap=b:" \+ SBX_FILES \+ ":" \+ \(SBX_BASE \+ SBX_FILES\) \+ ":1"/, "dev's files: only dev is mapped, never the machine's admin");
  assert.match(mod, /"ro,X-mount\.idmap=b:0:" \+ SBX_BASE \+ ":" \+ SBX_RANGE/, "the base: read-only");
  // THE SERVICE.
  const s = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(s, /const p = box && uid !== null\n\s+\? spawn\("nsenter", sandboxArgs\(box\.pid, dir, command\), \{ cwd: "\/", env, detached: true, stdio: \["ignore", "pipe", "pipe"\] \}\)/, "a command in it");
  assert.match(s, /export function killUser\(uid = RUN_UID, gid = RUN_GID\) \{\n\s+\/\/[^\n]*\n\s+if \(BOX\) \{ BOX\.stop\(\); BOX = null; \}/, "ended wherever the AI's commands are (before root's git, at a job's end, at the next job)");
  assert.match(s, /t\.box = BOX = t\.room \? await openBox\(\) : null;/, "only in the room");
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
  assert.match(df, /echo 'root:200000:196608' >> \/etc\/subuid/);
  assert.match(df, /coder-sandbox\.mjs coder-sandbox-init\.sh \.\//);
  assert.match(readFileSync(new URL("../src/coder-fly.mjs", import.meta.url), "utf8"), /env: \{ CODER_DATA: FLY_DATA, CODER_IMAGE_REF: s\.image,/);
});

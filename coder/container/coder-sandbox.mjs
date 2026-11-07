// THE ADMIN SANDBOX (owner, 2026-11-07: "finish this": Claude Code's commands run
// as full admin). Coder's commands, and the setup script, run in a sandbox of their
// own, as its user `dev` with sudo for anything: install or remove any package,
// change any system file, run any service, as on Claude Code's machine (apt-get,
// apt and service need no sudo: tools/apt-get and tools/service add it). They are
// admin only inside it. Outside, the sandbox's admin is an ordinary, unknown user
// (ids 1000000 and up), so it cannot leave the sealed room (coder-room.mjs), see or
// stop Coder's own service, or read its keys. Claude Code keeps its keys and its
// network rules outside its machine; on Fly.io they are inside the same machine,
// so the sandbox keeps them out of reach instead. (Its commands are `dev`, not the
// admin itself, so the chat's files and Docker's stay theirs, as before.)
//
// How (Linux): a user namespace whose root is that ordinary user outside; its own
// mount and process namespaces; and the room's network. Its system is the machine
// image itself, shown through an id map (read-only) under a layer of its own
// (overlayfs) on the chat's kept disk: what it installs stays while the machine
// sleeps, and a new Coder version starts it fresh, like the machine's own disk.
// The chat's files are shown to it as its own, and stay the AI's user's on disk,
// so Coder's saving to GitHub works as before.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, chmodSync, chownSync, statSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOM_NS } from "./coder-room.mjs";

/**
 * The sandbox's ids, outside: its admin is 1000000, clear of every other user's range (the image's
 * `ubuntu` has 100000-165535, `dev` 165536-231071 for its Docker). 262144 ids, so dev's Docker range
 * fits inside too (GitHub's image check, 2026-11-07: with 196608, dev's Docker could not map its users).
 */
export const SBX_BASE = 1000000;
export const SBX_RANGE = 262144;
/** The AI's user (the image's `dev`), on disk and inside: the chat's files keep this owner. */
export const SBX_FILES = 1001;

/**
 * DEV'S OWN EXTRA IDS (/etc/subuid and /etc/subgid; 165536-231071 in the image): the
 * ids its Docker engine gives the users in its containers. Dev's folders show them as
 * well, so Docker can keep its images and containers there (GitHub's image check,
 * 2026-11-07: without them its engine could not even make its socket, "value too
 * large"). Only a range inside the sandbox's own ids and above dev is used: the
 * machine's admin (0) is never one of them.
 */
export function devSubIds({ read = (f) => readFileSync(f, "utf8") } = {}) {
  const one = (file) => {
    let text = "";
    try { text = String(read(file)); } catch { return null; }
    for (const line of text.split("\n")) {
      const [who, s, n] = line.trim().split(":");
      if (who !== "dev" && who !== String(SBX_FILES)) continue;
      const r = { start: Number(s), count: Number(n) };
      if (fits(r)) return r;
    }
    return null;
  };
  return { u: one("/etc/subuid"), g: one("/etc/subgid") };
}
const fits = (r) => !!r && Number.isInteger(r.start) && Number.isInteger(r.count) && r.count > 0 && r.start > SBX_FILES && r.start + r.count <= SBX_RANGE;

/**
 * HOW DEV'S OWN FOLDERS ARE SHOWN (the chat's files, dev's home): dev as dev, and dev's
 * extra ids as themselves; nothing else, so nothing in them can be made as the
 * machine's admin, or as any other user of the machine.
 */
export function mineIdmap(sub = devSubIds()) {
  const maps = ["b:" + SBX_FILES + ":" + (SBX_BASE + SBX_FILES) + ":1"];
  for (const t of ["u", "g"]) if (sub && fits(sub[t])) maps.push(t + ":" + sub[t].start + ":" + (SBX_BASE + sub[t].start) + ":" + sub[t].count);
  return "X-mount.idmap=" + maps.join(" ");
}
/** Root's folder for the sandbox's mounts (others may only pass through it). */
export const SBX_DIR = "/run/coder-sbx";
export const SBX_INIT = fileURLToPath(new URL("./coder-sandbox-init.sh", import.meta.url));
const READY_MS = 20000;

const ok = (r) => !!r && !r.error && r.status === 0;
const mounted = (p, run = spawnSync) => ok(run("mountpoint", ["-q", p], { stdio: "ignore", timeout: 10000 }));
/** A mount, with what it said when it failed. */
const mountIt = (run, args) => run("mount", args, { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"], timeout: 30000 });
const errOf = (r) => String((r && (String(r.stderr || "").trim() || (r.error && r.error.message))) || "exit " + (r && r.status)).trim().slice(-400);

// WHY THERE IS NO SANDBOX (deploy, 2026-11-07: on GitHub's own machine it did not start, and nothing
// said why): the last failure's reason, for the service's log and the tests. Empty once one starts.
let why = "";
export const sandboxWhy = () => why;
const fail = (w, answer) => { why = String(w).replace(/\s+/g, " ").trim().slice(0, 800); return answer; };

/**
 * WHERE THE SANDBOX'S SYSTEM COMES FROM: the machine's own root when it is a
 * plain filesystem (an id map can show it); else the machine image's own disk
 * (on Fly.io the root is a layered filesystem over the image on /dev/vda, and a
 * layered one cannot be shown through an id map). CODER_SANDBOX_BASE names
 * another (a disk or a folder; GitHub's machine check). Null: no sandbox here.
 */
export function sandboxBase({ run = spawnSync, exists = existsSync, env = process.env } = {}) {
  const set = String(env.CODER_SANDBOX_BASE || "");
  if (set) return /^\/[\w./-]+$/.test(set) && exists(set) ? set : null;
  const r = run("findmnt", ["-n", "-o", "FSTYPE", "/"], { encoding: "utf8", timeout: 10000 });
  const type = String((r && r.stdout) || "").trim();
  if (type && type !== "overlay") return "/";
  return exists("/dev/vda") ? "/dev/vda" : null;
}

/**
 * ONCE PER START, AS ROOT: the base, read-only, shown through the id map
 * (root's files appear as the sandbox admin's) at SBX_DIR/lower. True when it is there.
 */
export function makeLower({ base, dir = SBX_DIR, run = spawnSync } = {}) {
  if (typeof process.getuid === "function" && process.getuid() !== 0) return fail("not the machine's admin", false);
  if (!base) return fail("no base for its system", false);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o711 });
    chmodSync(dir, 0o711);
    let src = base;
    if (!base.startsWith("/dev/") && !statSync(base).isDirectory()) return fail(base + " is not a folder", false);
    if (base.startsWith("/dev/")) {
      src = join(dir, "image");
      mkdirSync(src, { recursive: true, mode: 0o700 });
      if (!mounted(src, run)) { const r = mountIt(run, ["-o", "ro", base, src]); if (!ok(r)) return fail("could not open " + base + ": " + errOf(r), false); }
    }
    const lower = join(dir, "lower");
    mkdirSync(lower, { recursive: true, mode: 0o755 });
    if (!mounted(lower, run)) { const r = mountIt(run, ["--bind", "-o", "ro,X-mount.idmap=b:0:" + SBX_BASE + ":" + SBX_RANGE, src, lower]); if (!ok(r)) return fail("could not show its system through the id map: " + errOf(r), false); }
    return statSync(join(lower, "usr")).uid === SBX_BASE || fail("its system's files do not show as the sandbox admin's", false);
  } catch (e) { return fail("its system: " + String((e && e.message) || e), false); }
}

/**
 * THE SANDBOX'S OWN CHANGES: a folder per Coder version (`image`) on the chat's
 * kept disk (`data`); older versions' folders are removed, so a new version
 * starts fresh. Answers { upper, work }, or null.
 */
export function makeUpper({ data, image } = {}) {
  if (typeof data !== "string" || !/^\/[\w-]+(\/[\w-]+)*$/.test(data)) return null;
  try {
    const top = join(data, ".coder-admin");
    mkdirSync(top, { recursive: true, mode: 0o711 });
    chownSync(top, 0, 0);
    chmodSync(top, 0o711);
    const tag = createHash("sha256").update(String(image || "image")).digest("hex").slice(0, 16);
    for (const old of readdirSync(top)) if (old !== tag) rmSync(join(top, old), { recursive: true, force: true });
    const here = join(top, tag);
    mkdirSync(here, { recursive: true, mode: 0o711 });
    chmodSync(here, 0o711);
    const out = { upper: join(here, "upper"), work: join(here, "work") };
    for (const p of [out.upper, out.work]) {
      mkdirSync(p, { recursive: true, mode: 0o755 });
      chownSync(p, SBX_BASE, SBX_BASE);
    }
    return out;
  } catch { return null; }
}

/**
 * nsenter's arguments to run `command` in the sandbox as its `dev` (sudo there
 * makes it admin), in `wd` (a path inside it): its user, mount and process
 * namespaces and its network (the room).
 */
export function sandboxArgs(pid, wd, command, { uid = SBX_FILES, gid = SBX_FILES } = {}) {
  // Into `wd` from inside (nsenter's own --wd=DIR opens DIR outside the sandbox first).
  const q = "'" + String(wd).replace(/'/g, "'\\''") + "'";
  return ["-t", String(pid), "--user", "--mount", "--pid", "--net", "--root", "--wd", "-S", String(uid), "-G", String(gid), "--", "/bin/bash", "-c", "cd -- " + q + " || exit 1\n" + command];
}

/** The process the sandbox's first process is, seen from outside (the child of `unshare`). */
function childOf(pid) {
  try { const k = readFileSync("/proc/" + pid + "/task/" + pid + "/children", "utf8").trim().split(/\s+/).filter(Boolean); return k.length ? Number(k[0]) : 0; } catch { return 0; }
}

/**
 * A JOB'S SANDBOX, in the room (`ns`). `binds`: what of the machine it sees, at
 * the same place: { src, mode: "rw" | "ro", mine: true } — `mine`: dev's own
 * (the chat's files, dev's home), dev's inside and on disk. Answers
 * { pid, stop() }, or null when it could not be made.
 */
export async function startSandbox({ upper, work, binds = [], ns = ROOM_NS, dir = SBX_DIR, run = spawnSync, readyMs = READY_MS, sub = devSubIds() } = {}) {
  if (typeof process.getuid === "function" && process.getuid() !== 0) return fail("not the machine's admin", null);
  const lower = join(dir, "lower");
  if (!upper || !work) return fail("no layer of its own", null);
  if (!mounted(lower, run)) return fail("its system is not shown (makeLower)", null);
  const made = [];
  const unmount = () => { for (const p of made.reverse()) run("umount", ["-l", p], { stdio: "ignore", timeout: 10000 }); made.length = 0; };
  try {
    // Docker's engine inside needs the network device; on Fly.io only root may open it.
    try { if (existsSync("/dev/net/tun")) chmodSync("/dev/net/tun", 0o666); } catch { /* not here */ }
    const job = join(dir, "job");
    mkdirSync(job, { recursive: true, mode: 0o711 });
    chmodSync(job, 0o711);
    const lines = [];
    const idmap = mineIdmap(sub);
    binds.forEach((b, i) => {
      if (!b || typeof b.src !== "string" || !/^\/[\w./-]+$/.test(b.src) || !existsSync(b.src)) return;
      const at = join(job, String(i));
      mkdirSync(at, { recursive: true, mode: 0o755 });
      if (mounted(at, run)) run("umount", ["-l", at], { stdio: "ignore", timeout: 10000 });
      // `mine`: dev's files on disk are dev's inside, and what dev makes there stays dev's on disk. Only
      // dev (and its Docker's own ids) are mapped, so nothing in it can ever be made as the machine's real admin.
      const opts = b.mine ? ["--bind", "-o", (b.mode === "ro" ? "ro," : "") + idmap] : ["--bind", "-o", b.mode === "rw" ? "rw" : "ro"];
      const r = mountIt(run, [...opts, b.src, at]);
      if (!ok(r)) throw new Error("could not show " + b.src + ": " + errOf(r));
      made.push(at);
      lines.push([at, b.src, b.mode === "rw" ? "rw" : "ro"].join("\t"));
    });
    const root = join(dir, "root");
    mkdirSync(root, { recursive: true, mode: 0o755 });
    chownSync(root, SBX_BASE, SBX_BASE);
    // ITS FIRST PROCESS'S SCRIPT IS HANDED OVER WHOLE, never as a file to open: it runs as the
    // sandbox's admin, an ordinary user outside, who may not reach where Coder's code sits (deploy,
    // 2026-11-07: under GitHub's /home/runner, "coder-sandbox-init.sh: Permission denied").
    const p = spawn("nsenter", ["--net=" + ns, "--", "unshare", "--user", "--map-users=0:" + SBX_BASE + ":" + SBX_RANGE, "--map-groups=0:" + SBX_BASE + ":" + SBX_RANGE,
      "--setuid", "0", "--setgid", "0", "--mount", "--propagation", "private", "--pid", "--fork", "--kill-child", "--", "/bin/bash", "-c", readFileSync(SBX_INIT, "utf8"), "coder-sandbox-init"], {
      env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", SBX_LOWER: lower, SBX_UPPER: upper, SBX_WORK: work, SBX_ROOT: root, SBX_BINDS: lines.join("\n"), SBX_RESOLV: "/etc/resolv.conf", SBX_HOSTS: "/etc/hosts" },
      stdio: ["ignore", "pipe", "pipe"], detached: true,
    });
    let said = "";
    const up = await new Promise((done) => {
      const t = setTimeout(() => done(false), readyMs);
      const end = (v) => { clearTimeout(t); done(v); };
      p.once("exit", () => end(false));
      p.once("error", () => end(false));
      p.stdout.on("data", (b) => { said += b; if (/(^|\n)ready\n/.test(said)) end(true); });
      p.stderr.on("data", (b) => { said += b; });
    });
    const pid = up ? childOf(p.pid) : 0;
    if (!pid) { try { process.kill(-p.pid, "SIGKILL"); } catch { /* gone */ } unmount(); return fail("its first process " + (up ? "could not be found" : "did not get ready") + ": " + (said.trim().slice(-600) || "(it said nothing)"), null); }
    why = "";
    p.stdout.destroy(); p.stderr.destroy(); p.unref();
    let stopped = false;
    return {
      pid,
      why: "",
      stop() {
        if (stopped) return;
        stopped = true;
        // Its first process ending ends every process in it.
        for (const x of [pid, p.pid]) { try { process.kill(x, "SIGKILL"); } catch { /* gone */ } }
        unmount();
      },
    };
  } catch (e) {
    unmount();
    return fail(String((e && e.message) || e), null);
  }
}

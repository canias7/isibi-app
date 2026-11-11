// THE SEALED ROOM (owner, 2026-11-07: "ok", then "ok go with the rest", step 3
// of: 1. the Grok key out of the machine, 2. each machine its own lock key,
// 3. a sealed network room, 4. the master key inside it).
//
// Coder's commands run in a network of their own (a Linux network namespace)
// that Coder's service owns. It has no way out but:
//   - a pipe to Coder's gate (the proxy, which checks the environment's network
//     setting and adds saved keys through the Worker): a relay in the room
//     listens where the commands are told the gate is, 127.0.0.1:<port>, and
//     passes each connection to a socket only root can open (coder-room-forward.mjs);
//   - with Full network access only, a user-mode internet link (slirp4netns).
// Nothing run in the room can change that: it has no rights over the room's
// network, and the relay and the link are the service's own (root's) processes.
//
// Why: Coder's old wall was a firewall rule matched by user (iptables' owner
// match), which Fly.io's machines lack ("Extension owner revision 0 not
// supported", Fly's forum, 2026-10-12); there the network setting was a guard
// for tools that use the proxy, not a wall. Network namespaces work on Fly.io.
// Like Claude Code, where every request leaves the session's VM through
// Anthropic's proxy, outside the session's reach.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, chmodSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import net from "node:net";

export const ROOM = "coder-room";
export const ROOM_NS = "/run/netns/" + ROOM;
export const GATE_DIR = "/run/coder-gate";
export const GATE_SOCK = GATE_DIR + "/gate.sock";
const FORWARD = fileURLToPath(new URL("./coder-room-forward.mjs", import.meta.url));
const READY_MS = 5000;

const have = (cmd) => spawnSync("sh", ["-c", "command -v " + cmd], { stdio: "ignore", timeout: 5000 }).status === 0;

/** Makes the room once (as root). True when it is there; false when this machine cannot have one. */
export function makeRoom({ ns = ROOM_NS, name = ROOM } = {}) {
  if (typeof process.getuid === "function" && process.getuid() !== 0) return false;
  if (!have("ip") || !have("nsenter") || !have("setpriv")) return false;
  const ip = (args) => spawnSync("ip", args, { stdio: "ignore", timeout: 10000 }).status === 0;
  // A ROOM IS ONE ONLY WHEN IT CAN BE ENTERED.
  const live = () => spawnSync("nsenter", ["--net=" + ns, "--", "true"], { stdio: "ignore", timeout: 10000 }).status === 0;
  if (existsSync(ns)) {
    if (live()) return true;
    // ONLY ITS NAME LEFT (live test, 2026-11-07): on Fly.io a sleeping machine keeps its own disk,
    // /run with it, so after a restart the room's name was still there without the room, and every
    // job then ran without it. The name is taken away and the room made again.
    ip(["netns", "del", name]);
    rmSync(ns, { force: true });
  }
  if (!ip(["netns", "add", name])) return false;
  if (!ip(["-n", name, "link", "set", "lo", "up"])) { ip(["netns", "del", name]); return false; }
  // PORTS 80 AND 443 IN THE ROOM (step 4, the master key's jobs): any port may be
  // used inside the room (this setting is the room's own, not the machine's).
  spawnSync("nsenter", ["--net=" + ns, "--", "sysctl", "-qw", "net.ipv4.ip_unprivileged_port_start=0"], { stdio: "ignore", timeout: 10000 });
  return live();
}

/**
 * WHERE apt GOES (step 4): with a limited network, the master key's package
 * installs (tools/coder-admin, as root) go through the gate too; the service
 * writes its address here, and takes it away for Full access.
 */
export function gateForApt(address, { dir = GATE_DIR } = {}) {
  const f = dir + "/apt-proxy";
  try {
    if (!address) { rmSync(f, { force: true }); return; }
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    writeFileSync(f, String(address), { mode: 0o600 });
  } catch { /* a test, or a machine without /run: apt goes as it can */ }
}

/** `nsenter`'s arguments to run `command` in the room as the AI's user (who has no rights over the room's network). */
/**
 * WHAT ROOT STARTS FOR THE AI'S COMMANDS, BY FULL NAME (2026-11-09, found while adding the memory cap): a program named alone
 * is looked up in the PATH it is started with, and the AI's commands are started with the AI's PATH, whose first folders
 * (~/.local/bin and others) the AI's user can write. So a program of the AI's called nsenter or setpriv there would have been
 * started by root, as root. Root's own programs are named in full; the command itself is found after it became the AI's user.
 */
export const NSENTER = "/usr/bin/nsenter", SETPRIV = "/usr/bin/setpriv";
export function roomArgs(uid, gid, command, ns = ROOM_NS, shell = "bash") {
  // (`shell`: the owner's CODER_SHELL, server.mjs's shellOf.)
  return ["--net=" + ns, "--", SETPRIV, "--reuid=" + uid, "--regid=" + gid, "--clear-groups", "--", shell || "bash", "-c", command];
}

/** Waits for a child to print a line (or give up). */
function readyLine(child, ms = READY_MS) {
  return new Promise((ok) => {
    const t = setTimeout(() => ok(false), ms);
    const done = (v) => { clearTimeout(t); ok(v); };
    child.once("exit", () => done(false));
    child.once("error", () => done(false));
    if (child.stdout) child.stdout.once("data", () => done(true));
  });
}

let bridge = null, bridgePort = 0, relay = null, relayPort = 0, link = null;

/**
 * THE PIPE TO THE GATE (whenever the gate runs): here, a socket only root can
 * open that passes to the gate at 127.0.0.1:`port`; in the room, the relay on
 * 127.0.0.1:`port`. True when both are up.
 */
export async function roomGate(port, { ns = ROOM_NS, sock = GATE_SOCK, dir = GATE_DIR } = {}) {
  if (!bridge || bridgePort !== port) {
    if (bridge) bridge.close();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    rmSync(sock, { force: true });
    const b = net.createServer((s) => {
      const c = net.connect(port, "127.0.0.1");
      s.pipe(c); c.pipe(s);
      s.on("error", () => c.destroy());
      c.on("error", () => s.destroy());
    });
    b.on("error", () => {});
    await new Promise((ok, no) => { b.once("error", no); b.listen(sock, ok); });
    b.unref();
    bridge = b; bridgePort = port;
  }
  if (!relay || relay.exitCode !== null || relay.signalCode !== null || relayPort !== port) {
    if (relay && relay.exitCode === null) relay.kill("SIGKILL");
    relay = spawn("nsenter", ["--net=" + ns, "--", process.execPath, FORWARD, String(port), sock], { stdio: ["ignore", "pipe", "ignore"], detached: true });
    relayPort = port;
    const up = await readyLine(relay);
    relay.unref();
    if (relay.stdout) relay.stdout.destroy();
    if (!up) { try { relay.kill("SIGKILL"); } catch { /* gone */ } relay = null; return false; }
  }
  return true;
}

/**
 * FULL NETWORK ACCESS: the room's own internet link (slirp4netns, user-mode, as
 * root), or none for every other setting. True when the room is as asked.
 */
export async function roomInternet(on, { ns = ROOM_NS } = {}) {
  if (!on) {
    if (link && link.exitCode === null) link.kill("SIGKILL");
    link = null;
    return true;
  }
  if (link && link.exitCode === null && link.signalCode === null) return true;
  if (!have("slirp4netns")) return false;
  for (const ipv6 of [true, false]) {
    const args = ["--configure", "--mtu=65520", "--disable-host-loopback", ...(ipv6 ? ["--enable-ipv6"] : []), "--ready-fd=3", "--netns-type=path", ns, "tap0"];
    const c = spawn("slirp4netns", args, { stdio: ["ignore", "ignore", "ignore", "pipe"], detached: true });
    const up = await new Promise((ok) => {
      const t = setTimeout(() => ok(false), READY_MS);
      c.once("exit", () => { clearTimeout(t); ok(false); });
      c.once("error", () => { clearTimeout(t); ok(false); });
      c.stdio[3].once("data", () => { clearTimeout(t); ok(true); });
    });
    if (up) { c.unref(); c.stdio[3].destroy(); link = c; return true; }
    try { c.kill("SIGKILL"); } catch { /* gone */ }
  }
  return false;
}

/** For tests: the room's own processes, stopped. */
export function roomStop() {
  for (const c of [relay, link]) if (c && c.exitCode === null) { try { c.kill("SIGKILL"); } catch { /* gone */ } }
  relay = null; link = null;
  if (bridge) { bridge.close(); bridge = null; bridgePort = 0; }
}

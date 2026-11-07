// THE SEALED ROOM, FOR REAL (owner, 2026-11-07, step 3). Needs root and the
// network tools (ip, nsenter, setpriv); skipped elsewhere. The deploy runs it as
// root, like the other root-only tests; the GitHub machine check tries the
// room in Coder's own image too (coder/test/machine-tools.sh).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const R = await import("../container/coder-room.mjs");
const have = (c) => spawnSync("sh", ["-c", "command -v " + c], { stdio: "ignore" }).status === 0;
const root = typeof process.getuid === "function" && process.getuid() === 0;
const ready = root && have("ip") && have("nsenter") && have("setpriv") && have("curl");
const NAME = "coder-room-test", NS = "/run/netns/" + NAME;
// As an ordinary user (nobody), in the room: what the AI's commands are. Not spawnSync: this process is the gate too.
const inRoom = (cmd) => new Promise((ok) => {
  const p = spawn("nsenter", R.roomArgs(65534, 65534, cmd, NS), { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  p.stdout.on("data", (b) => { stdout += b; }); p.stderr.on("data", (b) => { stderr += b; });
  const t = setTimeout(() => p.kill("SIGKILL"), 20000);
  p.on("close", (status) => { clearTimeout(t); ok({ status, stdout, stderr }); });
});

test("CD140 the sealed room: commands reach Coder's gate and nothing else; they cannot change the room's network; Full access gives the room its own internet link, and taking it away takes it away", { skip: !ready && "needs root and ip, nsenter, setpriv, curl" }, async () => {
  spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
  try {
    assert.equal(R.makeRoom({ ns: NS, name: NAME }), true, "the room is made");
    assert.equal(R.makeRoom({ ns: NS, name: NAME }), true, "and made once");
    // Coder's gate, here (the real one is coder-proxy.mjs), and another service here the room must not reach.
    const gate = http.createServer((q, s) => s.end("gate ok")), other = http.createServer((q, s) => s.end("other"));
    await new Promise((ok) => gate.listen(0, "127.0.0.1", ok));
    await new Promise((ok) => other.listen(0, "127.0.0.1", ok));
    const gp = gate.address().port, op = other.address().port;
    const dir = await mkdtemp(join(tmpdir(), "coder-gate-"));
    try {
      assert.equal(await R.roomGate(gp, { ns: NS, sock: join(dir, "gate.sock"), dir }), true, "the pipe to the gate is up");
      // THE GATE: where the commands are told it is (127.0.0.1:port), through the relay.
      const g = await inRoom("curl -sS -m 5 http://127.0.0.1:" + gp + "/");
      assert.equal(g.stdout, "gate ok", g.stderr);
      // NOTHING ELSE: not the machine's other services, not the internet, not the machine's own address.
      const o = await inRoom("curl -sS -m 3 http://127.0.0.1:" + op + "/");
      assert.notEqual(o.status, 0, "another service on the machine is out of reach");
      assert.notEqual(o.stdout, "other");
      for (const addr of ["http://1.1.1.1/", "http://[2606:4700:4700::1111]/", "https://example.com/"]) {
        const x = await inRoom("curl -sS -m 3 --noproxy '*' " + addr);
        assert.notEqual(x.status, 0, addr + " is out of reach");
      }
      // THE AI CANNOT CHANGE THE ROOM: no new links, no routes, no address, not even loopback down.
      for (const cmd of ["ip link add d0 type dummy", "ip route add default dev lo", "ip addr add 10.9.9.9/24 dev lo", "ip link set lo down", "nsenter --net=/proc/1/ns/net true", "nsenter -t 1 -n true"]) {
        assert.notEqual((await inRoom(cmd)).status, 0, cmd + " is refused");
      }
      assert.equal((await inRoom("curl -sS -m 5 http://127.0.0.1:" + gp + "/")).stdout, "gate ok", "and the room still works");
      // A RESTART ON A KEPT DISK (live test, 2026-11-07: on Fly.io /run is kept while a machine sleeps):
      // the room is gone and only its name is left, a plain file. It is made again, never taken for a room.
      R.roomStop();
      spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
      writeFileSync(NS, "");
      const enters = () => spawnSync("nsenter", ["--net=" + NS, "--", "true"], { stdio: "ignore" }).status === 0;
      assert.equal(enters(), false, "only the name: no room to enter");
      assert.equal(R.makeRoom({ ns: NS, name: NAME }), true, "made again");
      assert.equal(enters(), true, "a real room");
      assert.equal(await R.roomGate(gp, { ns: NS, sock: join(dir, "gate.sock"), dir }), true, "the pipe to the gate, again");
      assert.equal((await inRoom("curl -sS -m 5 http://127.0.0.1:" + gp + "/")).stdout, "gate ok", "the gate, through the new room");
      assert.notEqual((await inRoom("curl -sS -m 3 --noproxy '*' https://example.com/")).status, 0, "and still nothing else");
      // FULL ACCESS: the room's own link (slirp4netns), and away again.
      if (have("slirp4netns")) {
        assert.equal(await R.roomInternet(true, { ns: NS }), true, "the link is up");
        assert.match(spawnSync("ip", ["-n", NAME, "route"], { encoding: "utf8" }).stdout, /^default via 10\.0\.2\.2 /m, "the room's way out, with Full access");
        assert.equal(await R.roomInternet(false, { ns: NS }), true);
        await new Promise((ok) => setTimeout(ok, 300));
        assert.doesNotMatch(spawnSync("ip", ["-n", NAME, "route"], { encoding: "utf8" }).stdout, /default/, "taken away with the setting");
      }
    } finally {
      R.roomStop();
      gate.close(); other.close();
    }
  } finally {
    spawnSync("ip", ["netns", "del", NAME], { stdio: "ignore" });
  }
});

test("CD141 the service runs the AI's commands in the room (as the AI's user), falls back to before when a machine cannot have it, and says which in Coder's note", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.deepEqual(R.roomArgs(1001, 1001, "echo hi"), ["--net=/run/netns/coder-room", "--", "setpriv", "--reuid=1001", "--regid=1001", "--clear-groups", "--", "bash", "-c", "echo hi"]);
  assert.match(s, /\? spawn\("nsenter", roomArgs\(uid, g, command\), \{ cwd: dir, env, detached: true, stdio: \["ignore", "pipe", "pipe"\] \}\)/, "in the room: nsenter, then the AI's user");
  assert.match(s, /t\.room = walled = await enterRoom\(px, true\);/, "a limited network: the room, with the gate and no link");
  assert.match(s, /if \(!net\.limited\) t\.room = await enterRoom\(px, false\);/, "Full access: the room with its link");
  assert.match(s, /\+ \(walled \|\| fwOn \? "" : " \(On this machine the list is a guard for tools that use HTTPS_PROXY, not a firewall\.\)"\);/, "Coder is told when it is only a guard");
  assert.match(s, /const u = await execIn\(dir, userPart, left, \{ bgDir, kill: true, home, room: t\.room, /, "the setup script's own part");
  assert.match(s, /const r = await execIn\(dir, command, timeoutS, \{ bgDir, kill: !!tool, home, room: t\.room, /, "every command and tool");
  assert.match(s, /const gate = list\.length \|\| net\.limited \? await proxyFor\(\) : null;\n\s+t\.room = await enterRoom\(gate, net\.limited\);\n\s+gateForApt\(net\.limited && gate \? "http:\/\/127\.0\.0\.1:" \+ gate\.port : ""\);/, "a change of setting mid-job: the room (and apt) follow at once");
  assert.match(s, /if \(room\) gateForApt\(net\.limited && px \? "http:\/\/127\.0\.0\.1:" \+ px\.port : ""\);/, "the master key's apt goes through the gate when the network is limited");
  assert.match(s, /createApp\(\{ kept: bootKept\(\), gitVia: true, modelVia: true, room: true, /, "the real service uses the room");
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /coder-room\.mjs coder-room-forward\.mjs coder-sandbox\.mjs coder-sandbox-init\.sh coder-globs\.mjs coder-security\.mjs coder-compact\.mjs \.\//);
});

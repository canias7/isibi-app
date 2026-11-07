// THE ADMIN SANDBOX IN CODER'S OWN IMAGE (owner, 2026-11-07: "finish this": Claude
// Code's commands run as full admin). Run as root inside the full image by
// .github/workflows/check-coder-image.yml, with the image itself given as a disk
// (CODER_SANDBOX_BASE), as on Fly.io (/dev/vda). Each command runs the way Coder's
// service runs the AI's commands: as dev, in the job's sandbox, in the sealed room
// with the real gate (Trusted), and with real websites.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, chownSync, statSync } from "node:fs";

const { startProxy } = await import("/app/coder-proxy.mjs");
const R = await import("/app/coder-room.mjs");
const S = await import("/app/coder-sandbox.mjs");
const { cleanEnv } = await import("/app/coder-checks.mjs");

let failed = 0;
const want = (what, ok, detail) => { console.log((ok ? "  ok  " : "  NO  ") + what + (ok ? "" : "  (" + String(detail || "").slice(-800) + ")")); if (!ok) failed++; };

const base = S.sandboxBase();
want("the image as the sandbox's base: " + base, !!base && base.startsWith("/dev/"), base);
want("its mapped, read-only view", S.makeLower({ base }), S.sandboxWhy());
// The chat's kept disk, as on Fly.io: a plain disk folder (a layer cannot sit on the image's own layers).
const data = "/data";
for (const p of [data + "/work/shop", data + "/home"]) { mkdirSync(p, { recursive: true }); chownSync(p, 1001, 1001); }
const up = S.makeUpper({ data, image: "check" });
want("its own layer, on the kept disk", !!up, "makeUpper");
const sub = S.devSubIds();
want("dev's own extra ids (its Docker's) fit inside the sandbox's: " + JSON.stringify(sub), !!(sub.u && sub.g), "devSubIds");
want("the room", R.makeRoom(), "makeRoom");
const px = await startProxy({ dir: "/srv/coder-proxy-check" });
px.setNetwork({ mode: "trusted" });
want("the pipe to the gate", await R.roomGate(px.port), "roomGate");
await R.roomInternet(false);
const box = await S.startSandbox({ ...up, binds: [{ src: data + "/work", mode: "rw", mine: true }, { src: data + "/home", mode: "rw", mine: true }, { src: "/srv/coder-proxy-check", mode: "ro" }] });
want("the sandbox started", !!box, S.sandboxWhy());
if (!box) process.exit(1);
const env = { ...px.env(), ...cleanEnv(data + "/home"), CODER_SANDBOX: "1" };
const sh = (cmd, secs = 400) => new Promise((ok) => {
  const p = spawn("nsenter", S.sandboxArgs(box.pid, data + "/work/shop", cmd), { cwd: "/", env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { out += b; });
  const t = setTimeout(() => p.kill("SIGKILL"), secs * 1000);
  p.on("close", (code) => { clearTimeout(t); ok({ code, out: out.trim() }); });
});

console.log("\n== Admin for anything, as on Claude Code's machine");
let r = await sh("id -un; sudo -n id -u");
want("dev, and sudo makes it admin", r.out === "dev\n0", r.out);
r = await sh("apt-get install -y -qq figlet >/dev/null && figlet -v | head -n 1");
want("apt-get install (no sudo typed), through the gate", r.code === 0, r.out);
r = await sh("apt-get remove -y -qq nano >/dev/null 2>&1; command -v nano || echo removed");
want("apt-get remove, even of the image's own packages", r.out === "removed", r.out);
r = await sh("sudo sh -c 'echo hi > /etc/coder-sbx-check' && cat /etc/coder-sbx-check");
want("any system file (sudo)", r.out === "hi", r.out);
r = await sh("service postgresql start >/dev/null && psql -d postgres -tAc 'select 1'; service postgresql stop >/dev/null");
want("PostgreSQL started and used (no sudo typed)", r.out === "1", r.out);
r = await sh("python3 -m http.server 80 --bind 127.0.0.1 >/dev/null 2>&1 & sleep 1.5; curl -sS -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:80/; kill %1");
want("a server on port 80", r.out === "200", r.out);
r = await sh("docker run --rm hello-world 2>&1 | grep -m 1 'Hello from Docker' || docker run --rm hello-world 2>&1 | tail -n 15", 600);
want("Docker, inside it, as dev", /Hello from Docker/.test(r.out), r.out);
r = await sh("check-tools >/tmp/tools.txt 2>&1; tail -n 2 /tmp/tools.txt");
want("every tool", r.code === 0, r.out);

console.log("\n== The walls");
r = await sh("curl -sS -m 10 -o /dev/null -w '%{http_code}' --noproxy '*' https://example.com");
want("straight to the internet: no way", r.code !== 0 && r.out !== "200", r.out);
r = await sh("curl -sS -m 25 -o /dev/null -w '%{http_code}' https://registry.npmjs.org/");
want("an allowed site (npm), through the gate", r.out === "200", r.out);
r = await sh("curl -sS -m 10 -o /dev/null -w '%{http_code}' https://example.com");
want("a site Trusted does not allow, through the gate: refused", r.code !== 0 && r.out !== "200", r.out);
r = await sh("sudo -n ip link add d0 type dummy; sudo -n ip link set lo down");
want("the room's network cannot be changed, even with sudo", r.code !== 0, r.out);
r = await sh("ps -e -o comm= | head -n 3; ls /srv 2>&1 | head -n 3");
want("none of the machine's processes; only the folders it was shown", !/node|coder-room-forward/.test(r.out), r.out);

console.log("\n== The machine itself is untouched");
want("its /etc", !existsSync("/etc/coder-sbx-check"), "");
want("its nano", existsSync("/usr/bin/nano"), "");
want("no figlet on it", !existsSync("/usr/bin/figlet"), "");
r = await sh("echo x > made.txt && sudo -n touch by-admin.txt; ls");
want("the chat's files stay dev's (admin cannot make one there)", existsSync(data + "/work/shop/made.txt") && statSync(data + "/work/shop/made.txt").uid === 1001 && !existsSync(data + "/work/shop/by-admin.txt"), r.out);

box.stop();
R.roomStop();
await px.close();
console.log(failed ? "\nTHE SANDBOX: " + failed + " PROBLEM(S)" : "\nTHE SANDBOX: ADMIN INSIDE, SEALED OUTSIDE");
process.exit(failed ? 1 : 0);

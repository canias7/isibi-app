// THE SEALED ROOM IN CODER'S OWN IMAGE, WITH ITS REAL GATE AND REAL WEBSITES
// (owner, 2026-11-07, step 3). Run as root inside the full image by
// coder/test/machine-tools.sh (the GitHub machine check). For each network
// setting, a command run the way Coder runs the AI's commands (in the room, as
// `dev`) tries the internet directly, through the gate to an allowed site, and
// through the gate to a site the setting does not allow.
import { spawn } from "node:child_process";

const { startProxy } = await import("/app/coder-proxy.mjs");
const R = await import("/app/coder-room.mjs");

function inRoom(cmd, env) {
  return new Promise((ok) => {
    const p = spawn("nsenter", R.roomArgs(1001, 1001, cmd), { env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { out += b; });
    const t = setTimeout(() => p.kill("SIGKILL"), 60000);
    p.on("close", (code) => { clearTimeout(t); ok({ code, out: out.trim() }); });
  });
}
const code = (url, opts = "") => "curl -sS -m 25 -o /dev/null -w '%{http_code}' " + opts + " " + url;
let failed = 0;
const want = (what, ok, detail) => { console.log((ok ? "  ok  " : "  NO  ") + what + (ok ? "" : "  (" + detail + ")")); if (!ok) failed++; };

if (!R.makeRoom()) { console.log("  NO  the room could not be made"); process.exit(1); }
const px = await startProxy({ dir: "/srv/coder-proxy-check" });
if (!(await R.roomGate(px.port))) { console.log("  NO  the pipe to the gate"); process.exit(1); }
const env = px.env();

for (const mode of ["trusted", "none"]) {
  px.setNetwork({ mode });
  await R.roomInternet(false);
  console.log("\n== Network: " + mode);
  const direct = await inRoom(code("https://example.com", "--noproxy '*'"), env);
  want("straight to the internet: no way", direct.code !== 0 && direct.out !== "200", direct.out);
  const off = await inRoom(code("https://example.com"), env);
  want("a site the setting does not allow, through the gate: refused", off.code !== 0 && off.out !== "200", off.out);
  const npm = await inRoom(code("https://registry.npmjs.org/"), env);
  if (mode === "trusted") want("an allowed site (npm), through the gate: reached", npm.out === "200", npm.out);
  else want("with None, even npm is refused", npm.code !== 0 && npm.out !== "200", npm.out);
}

console.log("\n== Network: full");
px.setNetwork({ mode: "full" });
want("the room's own internet link is up", await R.roomInternet(true), "slirp4netns");
const open = await inRoom(code("https://example.com", "--noproxy '*'"), env);
want("Full access: straight to the internet", open.out === "200", open.out);
await R.roomInternet(false);
const shut = await inRoom(code("https://example.com", "--noproxy '*'"), env);
want("taken away again with the setting", shut.code !== 0 && shut.out !== "200", shut.out);

R.roomStop();
await px.close();
console.log(failed ? "\nTHE ROOM: " + failed + " PROBLEM(S)" : "\nTHE ROOM: SEALED");
process.exit(failed ? 1 : 0);

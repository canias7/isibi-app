// THE SITE AGENT'S COMMAND LINE (2026-10-29): real commands in a real work
// folder, built from a stand-in template on disk.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sessionDir, prepareSandbox, writeSiteFiles, readSiteFiles, runCommand, sweepSessions, MAX_OUTPUT, SESSION_TTL_MS, netCut as canCut, _resetNetCut as resetCut } from "../builder/agent-shell.mjs";
import { renderAs as renderAsTop } from "../builder/site-ssr.mjs";
// A MACHINE THAT CANNOT CUT A COMMAND OFF FROM THE INTERNET RUNS NONE (the
// wall fails closed), so the cases that need a command to RUN are skipped
// there, saying so: GitHub's runners block both ways (no root, and Ubuntu's
// AppArmor forbids unprivileged user namespaces). AS7 proves the refusal
// everywhere; the build service's own reading is the live proof.
const RUNS = canCut(renderAsTop());
resetCut();
const NEEDS = RUNS ? {} : { skip: "this machine cannot cut a command off from the internet, so no command runs here (AS7 covers the refusal)" };

function template() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-shell-"));
  const app = path.join(root, "app");
  fs.mkdirSync(path.join(app, "src", "routes"), { recursive: true });
  fs.mkdirSync(path.join(app, "node_modules", ".bin"), { recursive: true });
  fs.writeFileSync(path.join(app, "package.json"), "{}");
  fs.writeFileSync(path.join(app, "src", "routes", "leftover.tsx"), "another build's page");
  fs.writeFileSync(path.join(app, "src", "styles.css"), "another build's css");
  const base = path.join(app, ".routes-base");
  fs.mkdirSync(base);
  fs.writeFileSync(path.join(base, "__root.tsx"), "root");
  fs.writeFileSync(path.join(app, ".styles-base.css"), "base css");
  return { root, app, base, runs: path.join(root, "runs") };
}

test("AS1 a work folder: the template copied, packages linked, the site's files written in, another build's left out", () => {
  const t = template();
  const dir = sessionDir(t.runs, "a".repeat(24));
  assert.equal(sessionDir(t.runs, "../etc"), null);
  assert.equal(prepareSandbox(dir, { app: t.app, routesBase: t.base }), true);
  assert.equal(prepareSandbox(dir, { app: t.app, routesBase: t.base }), false, "made once per run");
  assert.ok(fs.lstatSync(path.join(dir, "node_modules")).isSymbolicLink());
  writeSiteFiles(dir, { pages: [{ path: "index.tsx", source: "home" }, { path: "../evil.tsx", source: "x" }, { path: "shop/item.tsx", source: "item" }], parts: [{ name: "site-header", source: "h" }, { name: "../x", source: "x" }], css: null }, { routesBase: t.base, stylesBase: path.join(t.app, ".styles-base.css") });
  assert.ok(!fs.existsSync(path.join(dir, "src", "routes", "leftover.tsx")), "another build's page is gone");
  assert.ok(!fs.existsSync(path.join(dir, "src", "evil.tsx")));
  const back = readSiteFiles(dir, { routesBase: t.base });
  assert.deepEqual(back.pages.map((p) => p.path).sort(), ["index.tsx", "shop/item.tsx"], "the base __root.tsx is never the site's");
  assert.deepEqual(back.parts, [{ name: "site-header", source: "h" }]);
  assert.equal(back.css, "base css");
});

test("AS2 commands run in the work folder; an edit a command makes is read back", NEEDS, async () => {
  const t = template();
  const dir = sessionDir(t.runs, "b".repeat(24));
  prepareSandbox(dir, { app: t.app, routesBase: t.base });
  writeSiteFiles(dir, { pages: [{ path: "index.tsx", source: "Open 7am to 4pm" }], parts: [], css: "a{}" }, { routesBase: t.base });
  const g = await runCommand(dir, "grep -rn 'Open' src/routes");
  assert.equal(g.code, 0);
  assert.match(g.output, /src\/routes\/index\.tsx:1:Open 7am to 4pm/);
  const s = await runCommand(dir, "sed -i 's/7am to 4pm/8am to 5pm/' src/routes/index.tsx && rm -f src/routes/nothing.tsx && printf 'new' > src/routes/about.tsx");
  assert.equal(s.code, 0, s.output);
  const back = readSiteFiles(dir, { routesBase: t.base });
  assert.deepEqual(back.pages.sort((a, b) => a.path.localeCompare(b.path)), [{ path: "about.tsx", source: "new" }, { path: "index.tsx", source: "Open 8am to 5pm" }]);
  const bad = await runCommand(dir, "exit 3");
  assert.equal(bad.code, 3);
});

test("AS3 no secret of ours reaches a command; the time limit and the output cut hold", NEEDS, async () => {
  const t = template();
  const dir = sessionDir(t.runs, "c".repeat(24));
  prepareSandbox(dir, { app: t.app, routesBase: t.base });
  process.env.GF_TEST_SECRET_KEY = "sk-should-never-be-seen";
  try {
    const e = await runCommand(dir, "env");
    assert.doesNotMatch(e.output, /sk-should-never-be-seen|GF_TEST_SECRET_KEY/);
    assert.match(e.output, /HOME=/, "the observer saw the environment");
  } finally { delete process.env.GF_TEST_SECRET_KEY; }
  const t0 = Date.now();
  const slow = await runCommand(dir, "sleep 5", { timeoutMs: 300 });
  assert.ok(Date.now() - t0 < 3000, "stopped at the limit, not left to run: " + (Date.now() - t0) + " ms");
  assert.equal(slow.timedOut, true);
  assert.equal(slow.code, 124);
  const big = await runCommand(dir, "head -c " + (MAX_OUTPUT * 2) + " /dev/zero | tr '\\\\0' 'a'");
  assert.ok(big.output.length < MAX_OUTPUT + 100);
  assert.match(big.output, /output cut at 30000 characters/);
});

test("AS4 old work folders are swept; a folder that is not one is left alone", () => {
  const t = template();
  const old = sessionDir(t.runs, "d".repeat(24)), fresh = sessionDir(t.runs, "e".repeat(24));
  prepareSandbox(old, { app: t.app, routesBase: t.base });
  prepareSandbox(fresh, { app: t.app, routesBase: t.base });
  fs.writeFileSync(path.join(old, ".ready"), String(Date.now() - SESSION_TTL_MS - 1000));
  fs.mkdirSync(path.join(t.runs, "other"));
  assert.equal(sweepSessions(t.runs), 1);
  assert.ok(!fs.existsSync(old) && fs.existsSync(fresh) && fs.existsSync(path.join(t.runs, "other")));
});

import { renderAs } from "../builder/site-ssr.mjs";
test("AS5 as the unprivileged user: not root, and the image's own files cannot be changed", { skip: (!renderAs() && "needs root and a `node` user (the container has both)") || (!RUNS && NEEDS.skip) }, async () => {
  const t = template();
  const as = renderAs();
  const dir = sessionDir(t.runs, "f".repeat(24));
  fs.chmodSync(t.root, 0o755);
  prepareSandbox(dir, { app: t.app, routesBase: t.base, owner: as });
  writeSiteFiles(dir, { pages: [{ path: "index.tsx", source: "x" }] }, { routesBase: t.base, owner: as });
  // Inside its own namespace a command SEES itself as 0 (`--map-root-user`);
  // on the machine it is the unprivileged user, which is what owns its files.
  const made = await runCommand(dir, "touch src/made-by-command", { as });
  assert.equal(made.code, 0, made.output);
  assert.equal(fs.statSync(path.join(dir, "src", "made-by-command")).uid, as.uid);
  assert.notEqual(as.uid, 0);
  const w = await runCommand(dir, "echo y > src/routes/index.tsx && echo ok", { as });
  assert.match(w.output, /ok/, "its own work folder is writable: " + w.output);
  const root = await runCommand(dir, "echo hacked > " + JSON.stringify(path.join(t.app, "package.json")) + " ; echo done", { as });
  assert.match(root.output, /Permission denied/);
  assert.equal(fs.readFileSync(path.join(t.app, "package.json"), "utf8"), "{}", "the template is untouched");
});

import http from "node:http";
import { netCut, _resetNetCut, NO_NET_MSG, netWrap } from "../builder/agent-shell.mjs";
test("AS6 no internet: a command cannot reach an address outside, even one on this machine's own network; ordinary commands still run", NEEDS, async () => {
  const t = template();
  const dir = sessionDir(t.runs, "9".repeat(24));
  prepareSandbox(dir, { app: t.app, routesBase: t.base });
  // A server ON THIS MACHINE, which an ordinary process reaches: the observer is alive.
  const srv = http.createServer((q, s) => s.end("reached")).listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const port = srv.address().port;
  try {
    const host = await new Promise((r) => http.get("http://127.0.0.1:" + port, (res) => { let b = ""; res.on("data", (d) => (b += d)); res.on("end", () => r(b)); }));
    assert.equal(host, "reached", "outside the sandbox the server answers");
    const inside = await runCommand(dir, "node -e \"require('http').get('http://127.0.0.1:" + port + "',r=>{console.log('REACHED')}).on('error',e=>{console.log('BLOCKED '+e.code)})\"");
    assert.match(inside.output, /BLOCKED/, inside.output);
    assert.doesNotMatch(inside.output, /REACHED/);
    const dns = await runCommand(dir, "node -e \"require('dns').lookup('example.com',(e,a)=>console.log(e?'NO-DNS':'DNS '+a))\"");
    assert.match(dns.output, /NO-DNS/, dns.output);
    const ok = await runCommand(dir, "echo fine && ls");
    assert.equal(ok.code, 0);
    assert.match(ok.output, /fine/);
  } finally { srv.close(); }
});

test("AS7 a container that cannot cut the internet off runs no command at all", async () => {
  _resetNetCut();
  try {
    assert.equal(netCut(null, { check: () => ({ status: 1 }) }), false);
    let spawned = 0;
    const r = await runCommand("/tmp", "echo hi", { spawnFn: () => { spawned++; throw new Error("never"); } });
    assert.equal(r.code, 126);
    assert.equal(r.output, NO_NET_MSG);
    assert.equal(spawned, 0, "nothing was started");
    _resetNetCut();
    assert.equal(netCut(null, { check: () => { throw new Error("no unshare"); } }), false);
  } finally { _resetNetCut(); }
});

import { netProbe } from "../builder/agent-shell.mjs";
test("AS8 the live probe: a real command tries an outside address and a name lookup; blocked only when both are", NEEDS, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-netprobe-"));
  const real = await netProbe(dir);
  assert.equal(real.blocked, true, real.output);
  assert.match(real.output, /NET-BLOCKED/); assert.match(real.output, /DNS-BLOCKED/);
  const leak = await netProbe(dir, { run: async () => ({ code: 0, output: "NET-REACHED\nDNS-BLOCKED" }) });
  assert.equal(leak.blocked, false);
  const silent = await netProbe(dir, { run: async () => ({ code: 126, output: "Commands are switched off here" }) });
  assert.equal(silent.blocked, false, "no answer is not proof");
});

test("AS9 the free build-health press carries the container's own reading", () => {
  const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = W.indexOf('url.pathname === "/api/site/build-health"');
  assert.ok(at > 0);
  const route = W.slice(at, W.indexOf("\n    }\n", at));
  assert.match(route, /c\.fetch\(new Request\("http:\/\/build\/agent-net"/);
  assert.match(route, /ms: Date\.now\(\) - t0, agentNet \}\)/);
  const B = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const probe = B.slice(B.indexOf('req.url === "/agent-net"'), B.indexOf('req.url === "/agent-run"'));
  assert.match(probe, /const cut = netCut\(as\);/);
  assert.match(probe, /probe = await netProbe\(d, \{ as \}\)/);
  assert.match(probe, /send\(res, 200, \{ ok: true, netCut: cut, asUser: !!as, blocked, probe \}\)/);
});

test("AS10 the second way: when the first is blocked and this is root, the network is cut as root and the command dropped to the user", () => {
  _resetNetCut();
  try {
    const tried = [];
    const as = { uid: 1234, gid: 1234 };
    const mode = netCut(as, { root: true, check: (w, m) => { tried.push(m); return { status: m === "userns" ? 1 : 0 }; } });
    assert.equal(mode, "root");
    assert.deepEqual(tried, ["userns", "root"]);
    assert.deepEqual(netWrap("root", as, ["/bin/sh", "-c", "x"]).argv, ["unshare", "--net", "setpriv", "--reuid=1234", "--regid=1234", "--clear-groups", "--", "/bin/sh", "-c", "x"]);
    assert.deepEqual(netWrap("root", as, ["x"]).opts, {}, "root starts it, setpriv drops it");
    assert.deepEqual(netWrap("userns", as, ["x"]).opts, { uid: 1234, gid: 1234 });
    assert.equal(netWrap("root", null, ["x"]), null, "never as root with no user to drop to");
    _resetNetCut();
    assert.equal(netCut(as, { root: false, check: (w, m) => ({ status: m === "userns" ? 1 : 0 }) }), false, "not root: the second way is not tried");
    _resetNetCut();
    assert.equal(netCut(null, { root: true, check: () => ({ status: 1 }) }), false, "no user to drop to: no second way");
  } finally { _resetNetCut(); }
});

test("AS11 the second way for real (root and a `node` user): no internet, the user's own files, the image's refused", { skip: !(renderAs() && process.getuid && process.getuid() === 0) && "needs root and a `node` user (the container has both)" }, async () => {
  const t = template();
  const as = renderAs();
  const dir = sessionDir(t.runs, "7".repeat(24));
  fs.chmodSync(t.root, 0o755);
  prepareSandbox(dir, { app: t.app, routesBase: t.base, owner: as });
  const forced = () => "root";
  const r = await runCommand(dir, "touch src/by-root-way; node -e \"require('net').connect(80,'1.1.1.1').on('error',e=>console.log('BLOCKED',e.code)).on('connect',()=>console.log('REACHED'))\"; echo y > " + JSON.stringify(path.join(t.app, "package.json")) + " || echo DENIED", { as, cut: forced });
  assert.match(r.output, /BLOCKED/, r.output);
  assert.doesNotMatch(r.output, /REACHED/);
  assert.match(r.output, /DENIED/);
  assert.equal(fs.statSync(path.join(dir, "src", "by-root-way")).uid, as.uid);
});

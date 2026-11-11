// Gloopy's browser, through this computer (the owner, 2026-11-11: "Yes do that"; Grok Bot's "Route traffic through
// this computer"): the desktop app's end of the link (route.js), its bridge to the page (preload.js), and who may use it.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { makeRoute, isClosedAddress, okHost } = require("../route.js");

const listen = (srv) => new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv.address().port)));
const until = async (f, ms = 3000) => { for (const t0 = Date.now(); Date.now() - t0 < ms; ) { if (f()) return true; await new Promise((ok) => setTimeout(ok, 25)); } return f(); };

test("D7 this computer's private and VPN addresses are never opened for Gloopy; only names a site can have", () => {
  for (const a of ["10.1.2.3", "192.168.1.10", "172.16.0.1", "172.31.255.255", "127.0.0.1", "169.254.169.254", "100.64.0.1", "100.100.100.100", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "::", "fd12:3456::1", "fc00::1", "fe80::1", "ff02::1", "::ffff:10.0.0.1", "::ffff:192.168.0.1", "64:ff9b::10.0.0.1", "2001:db8::1", "not an address"])
    assert.equal(isClosedAddress(a), true, a);
  for (const a of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::6810:85e5", "::ffff:93.184.216.34", "1.1.1.1"])
    assert.equal(isClosedAddress(a), false, a);
  for (const h of ["example.com", "www.shop.example", "a-b.c_d.example", "93.184.216.34", "[2606:4700::1]", "localhost"]) assert.equal(okHost(h), true, h);
  for (const h of ["", "a b", "x".repeat(254), "exa mple.com", "http://x", "a/b", 5]) assert.equal(okHost(h), false, String(h));
});

test("D8 the link: only to Go Farther's own address; each connection Gloopy's browser asks for is opened from this computer (or through the office's proxy, when this computer has one); a private address is refused and counted; stopping closes it all", async () => {
  // Only a link to Go Farther.
  const r0 = makeRoute({ WebSocket: function () { throw new Error("not called"); } });
  for (const url of ["wss://evil.example/api/coder/gloopy-route", "ws://gofarther.dev/api/coder/gloopy-route", "wss://gofarther.dev.evil.com/api/coder/gloopy-route", "wss://gofarther.dev/other"])
    assert.throws(() => r0.start({ url, ticket: "t" }), /not a link to Gloopy's computer/, url);
  assert.throws(() => r0.start({ url: "wss://gofarther.dev/api/coder/gloopy-route", ticket: "" }), /not a link/);
  // The machine's end (Gloopy's computer), from its own module.
  const { makeTunnel, makeRouteProxy, wsAccept } = await import("../../container/gloopy-route.mjs");
  const site = http.createServer((q, r) => r.end("hello " + q.url));
  const SITE = await listen(site);
  const tunnel = makeTunnel();
  const machine = http.createServer((q, r) => r.end());
  const tickets = [];
  machine.on("upgrade", (req, socket, head) => { tickets.push(new URL(req.url, "http://x").searchParams.get("t")); const ws = wsAccept(req, socket, head); if (ws) tunnel.attach(ws); });
  const M = await listen(machine);
  const proxy = makeRouteProxy({ tunnel, direct: async () => { throw new Error("not straight out"); } });
  const P = Number(new URL((await proxy.listen()).server).port);
  const get = (path) => new Promise((ok) => { http.get({ host: "127.0.0.1", port: P, path, headers: { host: new URL(path).host } }, (r) => { const b = []; r.on("data", (d) => b.push(d)); r.on("end", () => ok([r.statusCode, Buffer.concat(b).toString()])); }).on("error", (e) => ok([0, e.message])); });
  // This computer's own "office proxy" (as HTTPS_PROXY says): CONNECTs go through it, by the site's name.
  const connects = [];
  const office = http.createServer();
  office.on("connect", (req, client) => { connects.push(req.url); const s = net.connect(SITE, "127.0.0.1", () => { client.write("HTTP/1.1 200 Connection Established\r\n\r\n"); s.pipe(client); client.pipe(s); }); });
  const OFFICE = await listen(office);
  const lookups = [];
  const route = makeRoute({ anyUrl: true, device: "Test Mac", proxy: "http://127.0.0.1:" + OFFICE,
    lookup: async (h) => { lookups.push(h); return h === "site.example" ? [{ address: "93.184.216.34" }] : [{ address: "192.168.1.20" }]; } });
  try {
    assert.equal(route.status().on, false);
    route.start({ url: "ws://127.0.0.1:" + M + "/api/coder/gloopy-route", ticket: "tick et" });
    assert.ok(await until(() => tunnel.connected), "linked");
    assert.deepEqual(tickets, ["tick et"], "with its ticket");
    assert.equal(tunnel.status().device, "Test Mac");
    assert.deepEqual(await get("http://site.example/one"), [200, "hello /one"]);
    assert.deepEqual(connects, ["site.example:80"], "through the office's proxy, by name");
    // A private address on this computer's network: refused, counted, never opened.
    const [st, body] = await get("http://printer.home/");
    assert.equal(st, 502);
    assert.match(body, /blocked: printer\.home is a private or VPN address on this computer's network/);
    assert.deepEqual(connects, ["site.example:80"]);
    const s = route.status();
    assert.deepEqual([s.on, s.connected, s.opened, s.blocked, s.lastBlocked, s.viaProxy], [true, true, 1, 1, "printer.home", true]);
    // Nudged while linked: nothing changes. Stopped: the link closes, and it stays closed.
    route.kick();
    assert.equal(tunnel.status().connected, true);
    route.stop();
    assert.ok(await until(() => !tunnel.connected), "the link closed");
    assert.equal(route.status().on, false);
    await new Promise((ok) => setTimeout(ok, 300));
    assert.deepEqual(tickets, ["tick et"], "not opened again");
  } finally { route.stop(); await proxy.close(); machine.close(); site.close(); office.close(); }
});

test("D9 the page may ask the app only this: start, stop or nudge the link and read how it is doing, and only from gofarther.dev's own pages; the test copy only by a gofarther.dev address; the files go in the app", () => {
  const preload = readFileSync(new URL("../preload.js", import.meta.url), "utf8");
  assert.match(preload, /contextBridge\.exposeInMainWorld\("gofartherDesktop", \{\n  route: \{/);
  assert.deepEqual([...preload.matchAll(/ipcRenderer\.invoke\("([^"]+)"/g)].map((m) => m[1]), ["route:start", "route:stop", "route:kick", "route:status"]);
  const main = readFileSync(new URL("../main.js", import.meta.url), "utf8");
  assert.match(main, /preload: path\.join\(__dirname, "preload\.js"\) \}/);
  assert.match(main, /contextIsolation: true, sandbox: true, nodeIntegration: false/);
  assert.match(main, /const fromApp = \(e\) => \{ try \{ return isAppPage\(e\.senderFrame && e\.senderFrame\.url\); \} catch \{ return false; \} \};/);
  assert.match(main, /const allowed = \(f\) => \(e, arg\) => \{ if \(!fromApp\(e\)\) throw new Error\("not allowed"\); return f\(arg\); \};/);
  for (const k of ["start", "stop", "kick", "status"]) assert.match(main, new RegExp('ipcMain\\.handle\\("route:' + k + '", allowed\\('));
  const { isAppPage } = require("../links.js");
  for (const u of ["https://gofarther.dev/", "https://www.gofarther.dev/gloopy"]) assert.equal(isAppPage(u), true, u);
  for (const u of ["https://github.com/login", "https://evil.example/", "http://gofarther.dev/", "https://gofarther.dev.evil.com/", "https://u:p@gofarther.dev/", "file:///x", null]) assert.equal(isAppPage(u), false, String(u));
  // The test copy: only a gofarther.dev address (anything else is ignored).
  const homeOf = (v) => spawnSync(process.execPath, ["-e", "process.stdout.write(require('./links.js').HOME + ' ' + require('./links.js').isAppPage('https://test.gofarther.dev/'))"], { cwd: new URL("..", import.meta.url).pathname, env: { ...process.env, GOFARTHER_HOME: v } }).stdout.toString();
  assert.equal(homeOf("https://test.gofarther.dev/"), "https://test.gofarther.dev/ true");
  assert.equal(homeOf("https://evil.example/"), "https://gofarther.dev/ false");
  assert.equal(homeOf("http://test.gofarther.dev/"), "https://gofarther.dev/ false");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  for (const f of ["main.js", "links.js", "route.js", "preload.js"]) assert.ok(pkg.build.files.includes(f), f);
});

test("D10 live test (2026-11-11): a link refused while Gloopy's computer is asleep is asked for again, though Node's WebSocket then says only \"error\" and never \"close\"", async () => {
  const made = [];
  class FakeWS {
    constructor(url) { this.url = url; made.push(this); const first = made.length === 1; setTimeout(() => (first ? this.onerror && this.onerror({}) : this.onopen && this.onopen()), 10); }
    send() {}
    close() { this.closed = true; }
  }
  const r = makeRoute({ WebSocket: FakeWS, anyUrl: true, retryMs: 50, device: "Test Mac" });
  r.start({ url: "ws://127.0.0.1:1/api/coder/gloopy-route", ticket: "t" });
  assert.ok(await until(() => r.status().connected), "linked on the next try");
  assert.equal(made.length, 2);
  assert.equal(made[0].closed, true, "the refused one is let go");
  assert.equal(made[1].url, "ws://127.0.0.1:1/api/coder/gloopy-route?t=t");
  r.stop();
  assert.equal(r.status().connected, false);
});

test("D11 live test (2026-11-11): when the link closes, the close's own code is said with it (1006 cut off, 1009 too big…), so one cut can be told from another, also when Node says \"error\" before \"close\"; a plain close says nothing more; the link is asked for again", async () => {
  const made = [];
  class FakeWS {
    constructor(url) { this.url = url; made.push(this); setTimeout(() => this.onopen && this.onopen(), 5); }
    send() {}
    close() { this.closed = true; }
  }
  const r = makeRoute({ WebSocket: FakeWS, anyUrl: true, retryMs: 50, device: "Test Mac" });
  try {
    r.start({ url: "ws://127.0.0.1:1/api/coder/gloopy-route", ticket: "t" });
    assert.ok(await until(() => r.status().connected), "linked");
    made[0].onclose({ code: 1006, reason: "" });
    assert.equal(r.status().error, "the link was cut (1006)");
    assert.ok(await until(() => r.status().connected, 5000), "asked for again");
    made[made.length - 1].onclose({ code: 1009, reason: "message too big" });
    assert.equal(r.status().error, "the link was cut (1009: message too big)");
    assert.ok(await until(() => r.status().connected, 5000));
    made[made.length - 1].onclose({ code: 1000 });
    assert.equal(r.status().error, "the link was cut");
    assert.ok(await until(() => r.status().connected, 5000));
    // Node's own order when a link is cut off: "error", then "close" with the code (seen live in the app): the code is kept.
    made[made.length - 1].onerror({});
    made[made.length - 1].onclose({ code: 1006, reason: "" });
    assert.equal(r.status().error, "the link was cut (1006)");
    assert.ok(await until(() => r.status().connected, 5000));
    // An "error" with no "close" after it: the link is still given up, a moment later.
    made[made.length - 1].onerror({});
    assert.equal(r.status().connected, true, "a moment to hear the close");
    assert.ok(await until(() => r.status().error === "the link was cut", 3000));
  } finally { r.stop(); }
});

// The Monitor's WebSocket source behind the network gate takes web_fetch's path: the gate looks the host up (live, 2026-11-27).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const T = await import("../container/coder-tools.mjs");

// A stand-in gate: answers CONNECT as told, and when it lets one through, speaks WebSocket itself on that socket.
function gate(answer) {
  const seen = [];
  const srv = http.createServer();
  srv.on("connect", (req, sock) => {
    seen.push({ path: req.url, host: req.headers.host });
    const a = answer(req);
    if (a.status !== 200) { sock.end("HTTP/1.1 " + a.status + " No\r\n" + Object.entries(a.headers || {}).map(([k, v]) => k + ": " + v + "\r\n").join("") + "Content-Length: 0\r\n\r\n"); return; }
    sock.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    let head = "";
    sock.on("data", (c) => {
      if (head.includes("\r\n\r\n")) return;
      head += c.toString("latin1");
      if (!head.includes("\r\n\r\n")) return;
      seen.at(-1).wsHost = /\r\nHost: ([^\r]+)/.exec(head)[1];
      const key = /Sec-WebSocket-Key: ([^\r]+)/.exec(head)[1];
      const acc = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
      sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n");
      sock.write(Buffer.concat([Buffer.from([0x81, 5]), Buffer.from("hello")]));
      sock.write(Buffer.from([0x88, 2, 0x03, 0xe8]));
    });
    sock.on("error", () => {});
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, seen, url: "http://127.0.0.1:" + srv.address().port })));
}
const run = async (url, proxy) => { const lines = []; await T.toolWsWatch({ url }, { out: (t) => lines.push(JSON.parse(t)), proxy }); return lines; };

test("WS1127a an allowed host connects through the gate with no variable and no lookup of its own; the CONNECT line and both Host headers name the host", async () => {
  const g = await gate(() => ({ status: 200 }));
  const before = process.env.CODER_PROXY_RESOLVES_HOSTS; delete process.env.CODER_PROXY_RESOLVES_HOSTS;
  try {
    const lines = await run("ws://echo.websocket.org/", g.url);
    assert.deepEqual(lines, ["hello", { close: 1000 }]);
    assert.equal(g.seen[0].path, "echo.websocket.org:80");
    assert.equal(g.seen[0].host, "echo.websocket.org:80");
    assert.equal(g.seen[0].wsHost, "echo.websocket.org");
  } finally { g.srv.close(); if (before !== undefined) process.env.CODER_PROXY_RESOLVES_HOSTS = before; }
});

test("WS1127b the gate's refusals: a host not on the list is blocked, a private destination gets the private answer", async () => {
  const g = await gate((req) => req.url.startsWith("blocked") ? { status: 403, headers: { "x-deny-reason": "host_not_allowed" } } : req.url.startsWith("inside") ? { status: 403, headers: { "x-deny-reason": "private_dest_ip" } } : { status: 502 });
  try {
    assert.match((await run("wss://blocked.example/", g.url))[0].error, /^request blocked: no rule or allowlist entry allows host blocked\.example/);
    assert.equal((await run("wss://inside.example/", g.url))[0].error, T.PRIVATE_DEST);
    assert.equal((await run("wss://down.example/", g.url))[0].error, "the proxy refused down.example");
  } finally { g.srv.close(); }
});

test("WS1127c local and private addresses are still refused before the gate is asked", async () => {
  const g = await gate(() => ({ status: 200 }));
  try {
    for (const u of ["ws://127.0.0.1:8080/", "ws://localhost/", "wss://10.0.0.5/", "ws://[::1]/", "ws://169.254.169.254/"]) assert.equal((await run(u, g.url))[0].error, T.PRIVATE_DEST, u);
    assert.equal(g.seen.length, 0);
  } finally { g.srv.close(); }
});

test("WS1127d the old variable is gone and the watch still asks first", () => {
  const tools = readFileSync(new URL("../container/coder-tools.mjs", import.meta.url), "utf8");
  const srv = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(tools, /CODER_PROXY_RESOLVES_HOSTS|could not resolve " \+/);
  assert.doesNotMatch(srv, /CODER_PROXY_RESOLVES_HOSTS/);
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  const ws = agent.slice(agent.indexOf("const wsWatch = async"), agent.indexOf('tool: "ws_watch"'));
  assert.match(ws, /askOwner\(wsCard\)/);
});

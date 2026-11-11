// GLOOPY'S BROWSER, THROUGH THIS COMPUTER (the owner, 2026-11-11: "Yes do that"; Grok Bot's docs, "Route traffic
// through this computer": "The Bot's browser uses your desktop's connection, so the site sees your network and IP
// address. It applies to new connections and works while the Grok Bot desktop app is open." and "Sites that resolve to
// a private or VPN address are blocked … and the setting shows how many were blocked this session.").
//
// While the switch is on and the app is open, this keeps one link (a WebSocket, through Go Farther's Worker) to Gloopy's
// computer, and opens each connection Gloopy's browser asks for, from here. It never opens a private or VPN address
// (this computer's own network stays closed to Gloopy). The other end is coder/container/gloopy-route.mjs; the protocol
// is the same: each message is [type, 1 byte][stream, 4 bytes][payload].
"use strict";

const dns = require("node:dns");
const net = require("node:net");
const os = require("node:os");
const { Duplex } = require("node:stream");

const ROUTE = Object.freeze({ OPEN: 1, OK: 2, FAIL: 3, DATA: 4, END: 5, RESET: 6, ACK: 7, HELLO: 8, KEEP: 9 });
const ROUTE_CHUNK = 32 * 1024, ROUTE_WINDOW = 1024 * 1024, ROUTE_ACK = 128 * 1024, ROUTE_KEEP_MS = 25_000;
/** Asleep or cut off: asked again after this long (sooner when the page says Gloopy just started). */
const RETRY_MS = 20_000, CONNECT_MS = 15_000;

const frame = (type, id, payload) => {
  const p = payload == null ? Buffer.alloc(0) : typeof payload === "string" ? Buffer.from(payload) : payload;
  const b = Buffer.alloc(5 + p.length);
  b[0] = type; b.writeUInt32BE(id >>> 0, 1); p.copy(b, 5);
  return b;
};
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(Math.min(n, 0xffffffff) >>> 0, 0); return b; };

/** ONE CONNECTION OVER THE LINK, as a stream (the same as the machine's routeStream: a window of ROUTE_WINDOW, ACKs as it is read). */
function routeStream(id, send) {
  let unacked = 0, waiting = null, taken = 0, owed = 0, done = false, gotEnd = false, sentEnd = false;
  const s = new Duplex({
    allowHalfOpen: true,
    read() { if (owed) { const n = owed; owed = 0; send(frame(ROUTE.ACK, id, u32(n))); } },
    write(chunk, _enc, cb) {
      const go = (from) => {
        for (let i = from; i < chunk.length; i += ROUTE_CHUNK) {
          if (unacked >= ROUTE_WINDOW) { waiting = () => go(i); return; }
          const piece = chunk.subarray(i, i + ROUTE_CHUNK);
          unacked += piece.length;
          send(frame(ROUTE.DATA, id, piece));
        }
        cb();
      };
      go(0);
    },
    final(cb) { sentEnd = true; send(frame(ROUTE.END, id)); cb(); },
    destroy(err, cb) { if (!done && !(gotEnd && sentEnd)) send(frame(ROUTE.RESET, id)); done = true; cb(err); },
  });
  s.take = (f) => {
    if (f.type === ROUTE.DATA) {
      taken += f.payload.length;
      if (s.push(Buffer.from(f.payload))) { if (taken >= ROUTE_ACK) { send(frame(ROUTE.ACK, id, u32(taken))); taken = 0; } }
      else { owed += taken; taken = 0; }
    } else if (f.type === ROUTE.ACK && f.payload.length >= 4) {
      unacked = Math.max(0, unacked - f.payload.readUInt32BE(0));
      if (waiting && unacked < ROUTE_WINDOW) { const w = waiting; waiting = null; w(); }
    } else if (f.type === ROUTE.END) { gotEnd = true; s.push(null); }
    else if (f.type === ROUTE.RESET) { done = true; s.destroy(); }
  };
  return s;
}

// ── PRIVATE AND VPN ADDRESSES (never opened for Gloopy) ─────────────────────────────────────────────────────────────────
const V4_CLOSED = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const v4n = (a) => a.split(".").reduce((n, x) => (n << 8) + Number(x), 0) >>> 0;
function closedV4(a) {
  const n = v4n(a);
  return V4_CLOSED.some(([base, bits]) => (bits === 0 ? true : ((n >>> (32 - bits)) === (v4n(base) >>> (32 - bits)))));
}
/** An address on a private network, a VPN's, this computer's own, or not one a site has (multicast, reserved…). */
function isClosedAddress(ip) {
  const a = String(ip || "").replace(/^\[|\]$/g, "").toLowerCase();
  if (net.isIPv4(a)) return closedV4(a);
  if (!net.isIPv6(a)) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a) || /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) return closedV4(mapped[1]);
  if (a === "::" || a === "::1") return true;
  const first = parseInt(a.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7, unique local (many VPNs)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10, link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8, multicast
  if (/^2001:0?db8:/.test(a)) return true; // documentation
  return false;
}

/** A name a site can have, or an address. */
const okHost = (h) => typeof h === "string" && h.length > 0 && h.length <= 253 && (net.isIP(h.replace(/^\[|\]$/g, "")) > 0 || /^(?=.{1,253}$)([a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)*[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.?$/i.test(h));

/**
 * THE ROUTE: `start({ url, ticket })` (from the page, which has the sign-in: a link address and a ticket for it),
 * `stop()`, `kick()` (try now: Gloopy has just started), `status()`. `deps` for tests: WebSocket, lookup, connect, a
 * proxy (an http://host:port address this computer must go through, as HTTPS_PROXY says), now, setTimeout.
 */
function makeRoute(deps = {}) {
  const WS = deps.WebSocket || globalThis.WebSocket;
  const lookup = deps.lookup || ((host) => dns.promises.lookup(host, { all: true, verbatim: true }));
  const proxy = deps.proxy !== undefined ? deps.proxy : (process.env.HTTPS_PROXY || process.env.https_proxy || "");
  const connectTcp = deps.connect || ((o) => net.connect(o));
  const later = deps.setTimeout || setTimeout;
  const retryMs = Number.isFinite(deps.retryMs) ? deps.retryMs : RETRY_MS;
  const device = String(deps.device || os.hostname() || "this computer").slice(0, 60);
  // `trying`: a link being opened (never two at once).
  let want = null, ws = null, trying = null, retry = null, keep = null, since = 0, lastError = "";
  const streams = new Map();
  const counts = { opened: 0, blocked: 0, failed: 0, got: 0, sent: 0 };
  let lastBlocked = "";

  // Through a proxy this computer must use (an office's): a CONNECT to the site by its name.
  const viaProxy = (host, port) => new Promise((ok, no) => {
    const p = new URL(proxy);
    const s = connectTcp({ host: p.hostname, port: Number(p.port) || 80 });
    const auth = p.username ? "Proxy-Authorization: Basic " + Buffer.from(decodeURIComponent(p.username) + ":" + decodeURIComponent(p.password)).toString("base64") + "\r\n" : "";
    const t = later(() => { s.destroy(); no(new Error("timed out")); }, CONNECT_MS);
    s.once("error", (e) => { clearTimeout(t); no(e); });
    s.once("connect", () => s.write("CONNECT " + host + ":" + port + " HTTP/1.1\r\nHost: " + host + ":" + port + "\r\n" + auth + "\r\n"));
    let got = Buffer.alloc(0);
    const onData = (d) => {
      got = Buffer.concat([got, d]);
      const end = got.indexOf("\r\n\r\n");
      if (end < 0) { if (got.length > 16384) { clearTimeout(t); s.destroy(); no(new Error("the proxy said too much")); } return; }
      s.removeListener("data", onData);
      clearTimeout(t);
      const line = got.subarray(0, got.indexOf("\r\n")).toString();
      if (!/^HTTP\/1\.[01] 200/.test(line)) { s.destroy(); return no(new Error("the proxy said: " + line.slice(0, 80))); }
      const rest = got.subarray(end + 4);
      if (rest.length) s.unshift(rest);
      ok(s);
    };
    s.on("data", onData);
  });
  const direct = (address, port) => new Promise((ok, no) => {
    const s = connectTcp({ host: address, port });
    const t = later(() => { s.destroy(); no(new Error("timed out")); }, CONNECT_MS);
    s.once("connect", () => { clearTimeout(t); ok(s); });
    s.once("error", (e) => { clearTimeout(t); no(e); });
  });

  // GLOOPY'S BROWSER ASKS FOR A CONNECTION: never to a private or VPN address; else opened from here.
  const open = async (id, payload, send) => {
    let ask;
    try { ask = JSON.parse(payload.toString("utf8")); } catch { ask = {}; }
    const host = String(ask.host || "").toLowerCase(), port = Number(ask.port);
    if (!okHost(host) || !(Number.isInteger(port) && port > 0 && port < 65536)) return send(frame(ROUTE.FAIL, id, "not an address a site can have"));
    let addrs;
    try { addrs = net.isIP(host.replace(/^\[|\]$/g, "")) ? [{ address: host.replace(/^\[|\]$/g, "") }] : await lookup(host); }
    catch (e) { counts.failed++; return send(frame(ROUTE.FAIL, id, "could not find " + host + " (" + String((e && e.code) || "no answer") + ")")); }
    if (!addrs.length || addrs.some((a) => isClosedAddress(a.address))) {
      counts.blocked++; lastBlocked = host;
      return send(frame(ROUTE.FAIL, id, "blocked: " + host + " is a private or VPN address on this computer's network"));
    }
    let sock;
    try { sock = proxy ? await viaProxy(host, port) : await direct(addrs[0].address, port); }
    catch (e) { counts.failed++; return send(frame(ROUTE.FAIL, id, "could not reach " + host + ": " + String((e && (e.code || e.message)) || e).slice(0, 120))); }
    if (!ws) { sock.destroy(); return; }
    counts.opened++;
    const s = routeStream(id, send);
    streams.set(id, s);
    s.on("close", () => { streams.delete(id); sock.destroy(); });
    sock.on("error", () => s.destroy());
    sock.on("close", () => s.destroy());
    s.pipe(sock);
    sock.pipe(s);
    send(frame(ROUTE.OK, id));
  };

  const dropAll = () => { for (const s of streams.values()) s.destroy(); streams.clear(); };
  const schedule = (ms) => { if (retry || !want) return; retry = later(() => { retry = null; connect(); }, ms); };
  // (retryMs, for tests: how long before asking again when Gloopy's computer is asleep.)
  const connect = () => {
    if (!want || ws || trying || typeof WS !== "function") return;
    let sock;
    try { sock = new WS(want.url + (want.url.includes("?") ? "&" : "?") + "t=" + encodeURIComponent(want.ticket)); } catch (e) { lastError = String((e && e.message) || e); return schedule(RETRY_MS); }
    trying = sock;
    sock.binaryType = "arraybuffer";
    let up = false, over = false;
    const send = (b) => { if (ws === sock) { counts.sent++; try { sock.send(b); } catch { /* closing */ } } };
    // A link that failed or ended, whichever way it says so (live test, 2026-11-11: Node's WebSocket says only "error",
    // never "close", when Gloopy's computer is asleep and the handshake is refused): asked again in a while.
    const failed = (why) => {
      if (over) return;
      over = true;
      clearTimeout(guard);
      if (trying === sock) trying = null;
      if (ws === sock) { ws = null; if (keep) { clearInterval(keep); keep = null; } dropAll(); }
      lastError = why;
      try { sock.close(); } catch { /* gone */ }
      schedule(up ? 2000 : retryMs);
    };
    const guard = later(() => { if (!up) failed("Gloopy's computer did not answer"); }, CONNECT_MS);
    sock.onopen = () => {
      clearTimeout(guard);
      if (trying === sock) trying = null;
      if (!want || over) { over = true; try { sock.close(); } catch { /* gone */ } return; }
      ws = sock; up = true; since = Date.now(); lastError = "";
      send(frame(ROUTE.HELLO, 0, JSON.stringify({ v: 1, device })));
      if (keep) clearInterval(keep);
      keep = setInterval(() => send(frame(ROUTE.KEEP, 0)), ROUTE_KEEP_MS);
      if (keep.unref) keep.unref();
    };
    sock.onmessage = (m) => {
      counts.got++;
      if (typeof m.data === "string") return;
      const b = Buffer.from(m.data);
      if (b.length < 5) return;
      const f = { type: b[0], id: b.readUInt32BE(1), payload: b.subarray(5) };
      if (f.type === ROUTE.OPEN) { open(f.id, f.payload, send).catch(() => send(frame(ROUTE.FAIL, f.id, "could not open it"))); return; }
      if (f.type === ROUTE.KEEP) return;
      const s = streams.get(f.id);
      if (s) s.take(f);
    };
    // (The close's own code, said with it: 1006 cut off, 1009 too big, 1002 not WebSocket as expected…)
    sock.onclose = (e) => failed((up ? "the link was cut" : "Gloopy's computer is asleep or out of reach") + (e && e.code && e.code !== 1000 ? " (" + e.code + (e.reason ? ": " + String(e.reason).slice(0, 80) : "") + ")" : ""));
    sock.onerror = () => failed(up ? "the link was cut" : "Gloopy's computer is asleep or out of reach");
  };
  return {
    start: ({ url, ticket } = {}) => {
      if (typeof url !== "string" || !/^wss:\/\/([a-z0-9-]+\.)*gofarther\.dev\/api\/coder\/gloopy-route$/.test(url) || typeof ticket !== "string" || !ticket || ticket.length > 2000) {
        if (!(deps.anyUrl && typeof url === "string" && typeof ticket === "string")) throw new Error("not a link to Gloopy's computer");
      }
      const same = want && want.url === url;
      want = { url, ticket };
      if (!same && ws) { try { ws.close(); } catch { /* gone */ } }
      if (!ws) { if (retry) { clearTimeout(retry); retry = null; } connect(); }
      return true;
    },
    stop: () => {
      want = null;
      if (retry) { clearTimeout(retry); retry = null; }
      if (trying) { const t = trying; trying = null; try { t.close(); } catch { /* gone */ } }
      if (ws) { const s = ws; ws = null; if (keep) { clearInterval(keep); keep = null; } dropAll(); try { s.close(); } catch { /* gone */ } }
      return true;
    },
    kick: () => { if (want && !ws) { if (retry) { clearTimeout(retry); retry = null; } connect(); } return true; },
    status: () => ({ on: !!want, connected: !!ws, since: ws ? since : 0, ...counts, lastBlocked, error: ws ? "" : lastError, streams: streams.size, viaProxy: !!proxy }),
  };
}

module.exports = { makeRoute, isClosedAddress, okHost, ROUTE };

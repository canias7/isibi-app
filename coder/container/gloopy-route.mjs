// GLOOPY'S BROWSER, THROUGH THE OWNER'S OWN COMPUTER (the owner, 2026-11-11: "Yes do that"; Grok Bot's docs, "Route
// traffic through this computer": "The Bot's browser uses your desktop's connection, so the site sees your network and
// IP address. It applies to new connections and works while the Grok Bot desktop app is open."). On Gloopy's machine:
//
// - THE LINK (makeTunnel): one WebSocket from the owner's Go Farther desktop app, through Coder's Worker, carrying many
//   connections at once (each a numbered stream, with its own flow control);
// - THE PROXY (makeRouteProxy): a small web proxy for Gloopy's browser only (it takes connections from the browser's own
//   user and nobody else's), that sends each new connection through the link while there is one, and straight out, as
//   before, while there isn't.
//
// The desktop app opens each connection on the owner's computer itself, and refuses private and VPN addresses
// (coder/desktop/route.js speaks the other end of this protocol).
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { Duplex } from "node:stream";

// ── A WEBSOCKET, SERVER SIDE (RFC 6455; the machine has no packages of its own) ─────────────────────────────────────
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** The biggest message taken (a stream's data comes in chunks of ROUTE_CHUNK). */
export const WS_MAX = 1 << 20;

/** A frame: FIN set, `op`, the payload; masked (as a client must) when `mask`. */
function wsFrame(op, payload, mask = false) {
  const p = payload == null ? Buffer.alloc(0) : typeof payload === "string" ? Buffer.from(payload) : Buffer.from(payload);
  const n = p.length;
  let hdr;
  if (n < 126) hdr = Buffer.from([0x80 | op, (mask ? 0x80 : 0) | n]);
  else if (n < 65536) { hdr = Buffer.alloc(4); hdr[0] = 0x80 | op; hdr[1] = (mask ? 0x80 : 0) | 126; hdr.writeUInt16BE(n, 2); }
  else { hdr = Buffer.alloc(10); hdr[0] = 0x80 | op; hdr[1] = (mask ? 0x80 : 0) | 127; hdr.writeBigUInt64BE(BigInt(n), 2); }
  if (!mask) return Buffer.concat([hdr, p]);
  const m = randomBytes(4);
  for (let i = 0; i < n; i++) p[i] ^= m[i & 3];
  return Buffer.concat([hdr, m, p]);
}

/**
 * A WebSocket over a socket that has finished its handshake: `send(Buffer | string)` (false while the socket's buffer
 * is full), `close()`, `on("message" | "close" | "drain", fn)`, `open`. `mask`: the client's side (tests).
 */
export function wsOver(socket, head = null, { mask = false } = {}) {
  const ev = { message: [], close: [], drain: [] };
  const emit = (k, v) => { for (const f of ev[k]) { try { f(v); } catch { /* a listener's own trouble */ } } };
  let buf = head && head.length ? Buffer.from(head) : Buffer.alloc(0), parts = [], partOp = 0, closed = false;
  const end = () => { if (closed) return; closed = true; try { socket.destroy(); } catch { /* gone */ } emit("close"); };
  const write = (b) => { if (closed) return false; try { return socket.write(b); } catch { end(); return false; } };
  socket.on("data", (d) => {
    buf = buf.length ? Buffer.concat([buf, d]) : d;
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let n = buf[1] & 0x7f, off = 2;
      if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); off = 4; }
      else if (n === 127) { if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > BigInt(WS_MAX)) return end(); n = Number(big); off = 10; }
      if (n > WS_MAX) return end();
      const key = masked ? buf.subarray(off, off + 4) : null;
      if (masked) off += 4;
      if (buf.length < off + n) return;
      const p = Buffer.from(buf.subarray(off, off + n));
      buf = buf.subarray(off + n);
      if (key) for (let i = 0; i < n; i++) p[i] ^= key[i & 3];
      if (op === 8) { write(wsFrame(8, p.subarray(0, 2), mask)); return end(); }
      if (op === 9) { write(wsFrame(10, p, mask)); continue; }
      if (op === 10) continue;
      if (op === 0) {
        parts.push(p);
        if (parts.reduce((a, x) => a + x.length, 0) > WS_MAX) return end();
        if (fin) { const all = Buffer.concat(parts); parts = []; emit("message", partOp === 1 ? all.toString("utf8") : all); }
        continue;
      }
      if (op === 1 || op === 2) { if (fin) emit("message", op === 1 ? p.toString("utf8") : p); else { partOp = op; parts = [p]; } continue; }
      return end();
    }
  });
  socket.on("drain", () => emit("drain"));
  socket.on("close", end);
  socket.on("error", end);
  return {
    send: (data) => write(wsFrame(typeof data === "string" ? 1 : 2, data, mask)),
    close: () => { if (closed) return; write(wsFrame(8, Buffer.from([0x03, 0xe8]), mask)); setTimeout(end, 200).unref?.(); },
    on: (k, f) => { if (ev[k]) ev[k].push(f); },
    get open() { return !closed; },
  };
}

/** An HTTP upgrade answered as a WebSocket (the server's side); null (and the socket closed) when it isn't one. */
export function wsAccept(req, socket, head) {
  const key = String(req.headers["sec-websocket-key"] || "");
  if (String(req.headers.upgrade || "").toLowerCase() !== "websocket" || !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
    try { socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); } catch { /* gone */ }
    return null;
  }
  const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
  socket.setNoDelay(true);
  socket.setTimeout(0);
  return wsOver(socket, head, { mask: false });
}

// ── THE LINK'S OWN PROTOCOL (the same in coder/desktop/route.js) ───────────────────────────────────────────────────────
// Each message: [type, 1 byte][stream, 4 bytes][payload]. The machine opens streams; the desktop app connects them.
export const ROUTE = Object.freeze({ OPEN: 1, OK: 2, FAIL: 3, DATA: 4, END: 5, RESET: 6, ACK: 7, HELLO: 8, KEEP: 9 });
/** Data goes in pieces of ROUTE_CHUNK; a stream sends at most ROUTE_WINDOW ahead of what the other side has taken. */
export const ROUTE_CHUNK = 32 * 1024, ROUTE_WINDOW = 1024 * 1024, ROUTE_ACK = 128 * 1024;
/** Something goes each way every ROUTE_KEEP_MS (Cloudflare closes a quiet WebSocket); a stream not answered in ROUTE_OPEN_MS fails. */
export const ROUTE_KEEP_MS = 25_000, ROUTE_OPEN_MS = 20_000;
export const routeFrame = (type, id, payload) => {
  const p = payload == null ? Buffer.alloc(0) : typeof payload === "string" ? Buffer.from(payload) : payload;
  const b = Buffer.alloc(5 + p.length);
  b[0] = type; b.writeUInt32BE(id >>> 0, 1); p.copy(b, 5);
  return b;
};
export const routeRead = (buf) => (Buffer.isBuffer(buf) && buf.length >= 5 ? { type: buf[0], id: buf.readUInt32BE(1), payload: buf.subarray(5) } : null);

/**
 * ONE CONNECTION OVER THE LINK, as a stream: what is written goes as DATA (in pieces, never more than ROUTE_WINDOW
 * ahead of the other side's ACKs), what comes is pushed (and ACKed as it is read), END is the end of what one side
 * sends, RESET the end of it all. `send(frame)` puts a message on the link.
 */
export function routeStream(id, send) {
  // `done`: nothing more is to be said about it (both ends finished, or a RESET came or went).
  let unacked = 0, waiting = null, taken = 0, owed = 0, done = false, gotEnd = false, sentEnd = false;
  const s = new Duplex({
    allowHalfOpen: true,
    read() { if (owed) { const n = owed; owed = 0; send(routeFrame(ROUTE.ACK, id, u32(n))); } },
    write(chunk, _enc, cb) {
      const go = (from) => {
        for (let i = from; i < chunk.length; i += ROUTE_CHUNK) {
          if (unacked >= ROUTE_WINDOW) { waiting = () => go(i); return; }
          const piece = chunk.subarray(i, i + ROUTE_CHUNK);
          unacked += piece.length;
          send(routeFrame(ROUTE.DATA, id, piece));
        }
        cb();
      };
      go(0);
    },
    final(cb) { sentEnd = true; send(routeFrame(ROUTE.END, id)); cb(); },
    destroy(err, cb) { if (!done && !(gotEnd && sentEnd)) send(routeFrame(ROUTE.RESET, id)); done = true; cb(err); },
  });
  // What the other side sent.
  s.take = (f) => {
    if (f.type === ROUTE.DATA) {
      taken += f.payload.length;
      if (s.push(Buffer.from(f.payload))) { if (taken >= ROUTE_ACK) { send(routeFrame(ROUTE.ACK, id, u32(taken))); taken = 0; } }
      else { owed += taken; taken = 0; }
    } else if (f.type === ROUTE.ACK && f.payload.length >= 4) {
      unacked = Math.max(0, unacked - f.payload.readUInt32BE(0));
      if (waiting && unacked < ROUTE_WINDOW) { const w = waiting; waiting = null; w(); }
    } else if (f.type === ROUTE.END) { gotEnd = true; s.push(null); }
    else if (f.type === ROUTE.RESET) { done = true; s.destroy(); }
  };
  return s;
}
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(Math.min(n, 0xffffffff) >>> 0, 0); return b; };

/**
 * THE LINK FROM THE OWNER'S COMPUTER (one at a time: the newest wins). `attach(ws)` takes one; `open(host, port)` makes
 * a connection through it: a stream once the desktop app has connected, or an error saying why not (it refused a
 * private address, or it could not reach the site). `connected`, `status()`.
 */
export function makeTunnel({ now = Date.now } = {}) {
  // `got`/`sent`: messages each way on this link (to see it work: live test, 2026-11-11).
  let ws = null, nextId = 1, keep = null, since = 0, device = "", got = 0, sent = 0;
  const streams = new Map(), opening = new Map();
  const drop = (why) => {
    for (const [, o] of opening) o.reject(new Error(why));
    opening.clear();
    for (const s of streams.values()) s.destroy();
    streams.clear();
  };
  const attach = (sock) => {
    if (ws) { const old = ws; ws = null; drop("the link to the owner's computer changed"); try { old.close(); } catch { /* gone */ } }
    ws = sock; since = now(); device = ""; got = 0; sent = 0;
    const send = (b) => { if (ws === sock) { sent++; sock.send(b); } };
    if (keep) clearInterval(keep);
    keep = setInterval(() => send(routeFrame(ROUTE.KEEP, 0)), ROUTE_KEEP_MS);
    keep.unref?.();
    sock.on("message", (m) => {
      if (ws !== sock || typeof m === "string") return;
      got++;
      const f = routeRead(m);
      if (!f) return;
      if (f.type === ROUTE.HELLO) { try { device = String(JSON.parse(f.payload.toString("utf8")).device || "").replace(/[^\w .()-]/g, "").slice(0, 60); } catch { /* none */ } return; }
      if (f.type === ROUTE.KEEP) return;
      const o = opening.get(f.id);
      if (o) {
        if (f.type === ROUTE.OK) { opening.delete(f.id); clearTimeout(o.timer); const s = routeStream(f.id, send); s.on("close", () => streams.delete(f.id)); streams.set(f.id, s); o.resolve(s); }
        else if (f.type === ROUTE.FAIL || f.type === ROUTE.RESET) { opening.delete(f.id); clearTimeout(o.timer); o.reject(Object.assign(new Error(f.payload.toString("utf8").slice(0, 200) || "the owner's computer could not open it"), { refused: true })); }
        return;
      }
      const s = streams.get(f.id);
      if (s) s.take(f);
    });
    sock.on("close", () => { if (ws !== sock) return; ws = null; if (keep) { clearInterval(keep); keep = null; } drop("the link to the owner's computer closed"); });
  };
  const open = (host, port) => new Promise((resolve, reject) => {
    if (!ws) return reject(new Error("no link to the owner's computer"));
    const id = nextId++;
    if (nextId > 0xfffffff0) nextId = 1;
    const timer = setTimeout(() => { if (opening.delete(id)) reject(Object.assign(new Error("the owner's computer did not answer in time"), { refused: true })); }, ROUTE_OPEN_MS);
    opening.set(id, { resolve, reject, timer });
    sent++;
    ws.send(routeFrame(ROUTE.OPEN, id, JSON.stringify({ host: String(host), port: Number(port) })));
  });
  return {
    attach, open,
    get connected() { return !!ws; },
    status: () => ({ connected: !!ws, since: ws ? since : 0, device: ws ? device : "", streams: streams.size, got, sent }),
    close: () => { if (ws) { const old = ws; ws = null; drop("closed"); try { old.close(); } catch { /* gone */ } } if (keep) { clearInterval(keep); keep = null; } },
  };
}

// ── THE BROWSER'S OWN PROXY ─────────────────────────────────────────────────────────────────────────────────────────────
/** Addresses never opened straight from the machine (its own settings service), as pageAddress refuses them. */
const machineOnly = (host) => /^169\.254\./.test(host) || /^\[?fe80:/i.test(host) || host === "metadata" || host === "metadata.google.internal";
const hostPort = (s, dflt) => {
  const m = /^\[([0-9a-f:.]+)\]:(\d{1,5})$/i.exec(s) || /^([^:\s/]+):(\d{1,5})$/.exec(s);
  if (m) return { host: m[1], port: Number(m[2]) };
  return /^[^:\s/]+$/.test(s) ? { host: s, port: dflt } : null;
};

/**
 * WHICH USER A CONNECTION TO US CAME FROM (Linux keeps it with each connection, in /proc/net/tcp and tcp6: the line whose
 * own end is the caller's port and whose far end is ours), or -1 when it can't be told.
 */
export function peerUid(socket, read = (f) => readFileSync(f, "utf8")) {
  const hex = (n) => ":" + Number(n).toString(16).toUpperCase().padStart(4, "0");
  const theirs = hex(socket.remotePort), ours = hex(socket.localPort);
  for (const f of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let t = "";
    try { t = read(f); } catch { continue; }
    for (const line of t.split("\n").slice(1)) {
      const c = line.trim().split(/\s+/);
      if (c.length > 7 && c[1].endsWith(theirs) && c[2].endsWith(ours)) return Number(c[7]);
    }
  }
  return -1;
}

/**
 * THE PROXY GLOOPY'S BROWSER USES WHILE ROUTING IS ON: on 127.0.0.1, taking connections only from the browser's own user
 * (`uid`: the machine's gloopyweb; none given, this process's own), so nothing else on the machine (Gloopy's commands
 * run as another user) can send through the owner's computer. (Not a password: Playwright would then stop and go on
 * with every request the browser makes, which turns off its cache.) Each new connection goes through the link while
 * there is one, else straight out. A connection the owner's computer refused (a private or VPN address) fails; it is
 * never sent another way.
 */
export function makeRouteProxy({ tunnel, direct = null, uid = null, uidOf = peerUid } = {}) {
  const allowed = uid === null || uid === undefined ? (typeof process.getuid === "function" ? process.getuid() : -1) : uid;
  const counts = { desktop: 0, cloud: 0, failed: 0, refused: 0 };
  const straight = direct || ((host, port) => new Promise((ok, no) => {
    if (machineOnly(host)) return no(new Error("that address is the machine's own"));
    const s = net.connect({ host, port });
    s.once("connect", () => ok(s));
    s.once("error", no);
  }));
  const connect = async (host, port) => {
    if (tunnel && tunnel.connected) {
      try { const s = await tunnel.open(host, port); counts.desktop++; return s; } catch (e) { counts.failed++; throw e; }
    }
    try { const s = await straight(host, port); counts.cloud++; return s; } catch (e) { counts.failed++; throw e; }
  };
  const server = http.createServer(async (req, res) => {
    // A plain http:// page (the browser asks for the whole address).
    let u;
    try { u = new URL(req.url); } catch { u = null; }
    if (!u || u.protocol !== "http:") { res.writeHead(400, { "Content-Length": "0" }); return res.end(); }
    const port = Number(u.port) || 80, host = u.hostname.replace(/^\[|\]$/g, "");
    let sock;
    try { sock = await connect(host, port); } catch (e) { if (!res.headersSent) { res.writeHead(502, { "Content-Type": "text/plain" }); res.end("Gloopy's browser could not reach " + host + ": " + String((e && e.message) || e).slice(0, 200)); } return; }
    const headers = { ...req.headers };
    delete headers["proxy-authorization"]; delete headers["proxy-connection"];
    headers.connection = "close";
    // (createConnection is used only without an agent option: with agent: false, Node would look the name up itself.)
    const up = http.request({ host, port, method: req.method, path: u.pathname + u.search, headers, createConnection: () => sock });
    up.on("response", (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); });
    up.on("error", () => { if (!res.headersSent) { res.writeHead(502, { "Content-Length": "0" }); } res.end(); sock.destroy(); });
    req.pipe(up);
  });
  // An https:// page (or a WebSocket): a connection to pass the browser's own bytes through.
  server.on("connect", async (req, client, head) => {
    client.on("error", () => {});
    const hp = hostPort(String(req.url || ""), 443);
    if (!hp || !(hp.port > 0 && hp.port < 65536)) { try { client.end("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n"); } catch { /* gone */ } return; }
    let sock;
    try { sock = await connect(hp.host, hp.port); }
    catch (e) { try { client.end("HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n" + String((e && e.message) || e).slice(0, 200)); } catch { /* gone */ } return; }
    if (client.destroyed) { sock.destroy(); return; }
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head && head.length) sock.write(head);
    sock.on("error", () => client.destroy());
    client.on("close", () => sock.destroy());
    sock.on("close", () => client.destroy());
    client.pipe(sock);
    sock.pipe(client);
  });
  // Only the browser's own user: anyone else's connection is closed before it says anything.
  server.on("connection", (sock) => { if (uidOf(sock) !== allowed) { counts.refused++; sock.destroy(); } });
  server.on("clientError", (_e, s) => { try { s.destroy(); } catch { /* gone */ } });
  let info = null;
  return {
    /** Listens on 127.0.0.1 (a free port); what the browser is started with: { server }. */
    listen: () => new Promise((ok, no) => { server.once("error", no); server.listen(0, "127.0.0.1", () => { info = { server: "http://127.0.0.1:" + server.address().port }; ok(info); }); }),
    get info() { return info; },
    counts: () => ({ ...counts }),
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}

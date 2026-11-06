// CODER'S SECRETS PROXY (owner, 2026-11-06: "give Coder the same as Claude
// Code"). Like Claude Code's network secrets: the owner saves an API key for one
// host (api.stripe.com); Coder's commands call that host WITHOUT the key, and
// this proxy, running as root beside the service, adds it on the way out. Grok
// never sees the value, and the key is only ever sent to its own host.
//
//   HTTPS_PROXY points the commands here. For a host with a secret, the proxy
//   opens the TLS itself (a certificate from its own small authority, which the
//   commands are told to trust), adds the header, and sends the request on to
//   the real host over real TLS. Every other host is passed straight through
//   (a plain tunnel, nothing read). Plain http:// requests never get a secret.
//
// The authority's private key and the secrets stay root's (files 0600, this
// process's memory); the AI's user (`dev`) can read only the public certificate.
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

import { okHost, HEADER_RE, hostAllowed } from "./coder-secrets.mjs";
import { lookup as dnsLookup } from "node:dns";
import { privateAddress } from "./coder-tools.mjs";
export { okHost, HEADER_RE, PREFIXES, headerValue } from "./coder-secrets.mjs";

/** In limited mode, a lookup that refuses private addresses (the firewall leaves the proxy as the only way out). */
function publicLookup(hostname, opts, cb) {
  dnsLookup(hostname, { ...(typeof opts === "object" ? opts : {}), all: true }, (err, list) => {
    if (err) return cb(err);
    if (!list.length || list.some((x) => privateAddress(x.address))) return cb(Object.assign(new Error("a private address"), { code: "EPRIVATE" }));
    if (opts && opts.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}
const BLOCKED = (host) => "Blocked by this repo's network list: " + host + ". Ask the owner to allow it with propose_env (allow_host).";

/**
 * THE FIREWALL (Linux, root): the AI's user may only reach this machine itself
 * (its own dev servers, this proxy) and DNS; everything else must go through the
 * proxy, which checks the list. Returns true when it is in place.
 */
export function firewall(limited, uid) {
  if (!Number.isInteger(uid)) return false;
  const run = (cmd, args) => spawnSync(cmd, args, { stdio: "ignore", timeout: 10000 }).status === 0;
  let ok = true;
  for (const cmd of ["iptables", "ip6tables"]) {
    run(cmd, ["-N", "CODER_DEV"]);
    if (!run(cmd, ["-C", "OUTPUT", "-m", "owner", "--uid-owner", String(uid), "-j", "CODER_DEV"])) run(cmd, ["-I", "OUTPUT", "-m", "owner", "--uid-owner", String(uid), "-j", "CODER_DEV"]);
    if (!run(cmd, ["-F", "CODER_DEV"])) { ok = false; continue; }
    if (!limited) continue;
    const rules = [["-o", "lo", "-j", "ACCEPT"], ["-p", "udp", "--dport", "53", "-j", "ACCEPT"], ["-p", "tcp", "--dport", "53", "-j", "ACCEPT"], ["-j", "REJECT"]];
    // All or nothing: a half-made list (say, no loopback) is taken out again.
    if (!rules.every((r) => run(cmd, ["-A", "CODER_DEV", ...r]))) { run(cmd, ["-F", "CODER_DEV"]); ok = false; }
  }
  return ok;
}

const openssl = (args, input) => {
  const r = spawnSync("openssl", args, { input, stdio: ["pipe", "pipe", "pipe"], timeout: 20000 });
  if (r.status !== 0) throw new Error("openssl " + args[0] + " failed: " + String(r.stderr || r.error || "").slice(0, 200));
  return r.stdout;
};

/**
 * Starts the proxy. `dir` holds the authority (made once). Returns
 * { port, caFile, bundleFile, setSecrets(list), env(), close() }.
 */
export async function startProxy({ dir = "/srv/coder-proxy", systemCa = "/etc/ssl/certs/ca-certificates.crt", upstream = {} } = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o755 });
  const caKey = join(dir, "ca.key"), caFile = join(dir, "ca.pem"), bundleFile = join(dir, "bundle.pem");
  if (!existsSync(caKey) || !existsSync(caFile)) {
    openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", caKey, "-out", caFile, "-days", "3650", "-subj", "/CN=Coder secrets proxy",
      "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-addext", "subjectKeyIdentifier=hash"]);
  }
  chmodSync(caKey, 0o600); chmodSync(caFile, 0o644);
  let sys = ""; try { sys = readFileSync(systemCa, "utf8"); } catch { /* tests */ }
  writeFileSync(bundleFile, sys + (sys.endsWith("\n") || !sys ? "" : "\n") + readFileSync(caFile, "utf8")); chmodSync(bundleFile, 0o644);

  const leaves = new Map();
  const contextFor = (host) => {
    if (leaves.has(host)) return leaves.get(host);
    const key = join(dir, host + ".key"), csr = join(dir, host + ".csr"), crt = join(dir, host + ".pem"), ext = join(dir, host + ".ext");
    writeFileSync(ext, "subjectAltName=DNS:" + host + "\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nauthorityKeyIdentifier=keyid\nsubjectKeyIdentifier=hash\n");
    openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", csr, "-subj", "/CN=" + host]);
    openssl(["x509", "-req", "-in", csr, "-CA", caFile, "-CAkey", caKey, "-CAcreateserial", "-out", crt, "-days", "365", "-extfile", ext]);
    chmodSync(key, 0o600);
    const ctx = tls.createSecureContext({ key: readFileSync(key), cert: readFileSync(crt) });
    leaves.set(host, ctx);
    return ctx;
  };

  let secrets = new Map(); // host → { header, value }
  let network = { limited: false, hosts: [] };
  const allowed = (h) => hostAllowed(h, network, [...secrets.keys()]);
  // THE TLS SIDE: requests for a secret's host, with its header added.
  const inner = http.createServer((req, res) => {
    const host = req.socket.coderHost;
    const s = secrets.get(host);
    const headers = { ...req.headers, host };
    for (const k of Object.keys(headers)) if (/^proxy-/i.test(k)) delete headers[k];
    if (s) { for (const k of Object.keys(headers)) if (k.toLowerCase() === s.header.toLowerCase()) delete headers[k]; headers[s.header] = s.value; }
    let up;
    try {
    up = (upstream.request || https.request)({ host: upstream.host || host, port: upstream.port || 443, servername: host, method: req.method, path: req.url, headers, ...(network.limited && !upstream.host ? { lookup: publicLookup } : {}), ...(upstream.ca ? { ca: upstream.ca } : {}) }, (r) => {
      // A website that copies the key into its answer's headers does not hand it back (the audit, 2026-11-06).
      const back = { ...r.headers };
      if (s) for (const [k, v] of Object.entries(back)) { const one = Array.isArray(v) ? v.join(", ") : String(v); if (one.includes(s.value) || (s.raw && one.includes(s.raw))) delete back[k]; }
      r.on("error", () => res.destroy());
      res.writeHead(r.statusCode || 502, back);
      r.pipe(res);
    });
    } catch (e) { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); return res.end("Coder's proxy could not send that request (" + String(e.code || "bad request") + ")"); }
    up.on("error", (e) => { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); res.end("Coder's proxy could not reach " + host + ": " + String(e.code || e.message)); });
    req.pipe(up);
  });

  const server = http.createServer((req, res) => {
    // PLAIN http:// THROUGH THE PROXY: passed on as it is, never with a secret.
    let u; try { u = new URL(req.url); } catch { res.writeHead(400); return res.end("bad request"); }
    if (u.protocol !== "http:") { res.writeHead(400); return res.end("bad request"); }
    if (!allowed(u.hostname.toLowerCase())) { res.writeHead(403, { "content-type": "text/plain", "x-coder-blocked": u.hostname }); return res.end(BLOCKED(u.hostname)); }
    const headers = { ...req.headers }; for (const k of Object.keys(headers)) if (/^proxy-/i.test(k)) delete headers[k];
    let up;
    try { up = http.request({ host: u.hostname, port: u.port || 80, method: req.method, path: u.pathname + u.search, headers, ...(network.limited ? { lookup: publicLookup } : {}) }, (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); }); }
    catch { res.writeHead(400); return res.end("bad request"); }
    up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  server.on("connect", (req, sock, head) => {
    // First of all: a socket error is never left uncaught (live test, 2026-11-06:
    // a blocked site's connection reset crashed the whole service).
    sock.on("error", () => {});
    const m = /^\[?([^\]]+?)\]?:(\d+)$/.exec(String(req.url || ""));
    if (!m) { sock.end("HTTP/1.1 400 Bad Request\r\n\r\n"); return; }
    const host = m[1].toLowerCase(), port = Number(m[2]);
    // A bad port must never take the service down (the audit, 2026-11-06).
    if (!Number.isInteger(port) || port < 1 || port > 65535) { sock.end("HTTP/1.1 400 Bad Request\r\n\r\n"); return; }
    if (!allowed(host)) { const b = BLOCKED(host); sock.end("HTTP/1.1 403 Forbidden\r\nX-Coder-Blocked: " + host.replace(/[^a-z0-9.:-]/g, "") + "\r\nContent-Length: " + Buffer.byteLength(b) + "\r\n\r\n" + b); return; }
    sock.on("error", () => {});
    if (port === 443 && secrets.has(host)) {
      let ctx; try { ctx = contextFor(host); } catch { sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); return; }
      sock.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head && head.length) sock.unshift(head);
      const t = new tls.TLSSocket(sock, { isServer: true, secureContext: ctx, ALPNProtocols: ["http/1.1"] });
      t.coderHost = host;
      t.on("error", () => {});
      inner.emit("connection", t);
      return;
    }
    // ANY OTHER HOST: a plain tunnel; nothing is read or added.
    let out;
    try { out = net.connect({ port, host, ...(network.limited ? { lookup: publicLookup } : {}) }, () => { sock.write("HTTP/1.1 200 Connection Established\r\n\r\n"); if (head && head.length) out.write(head); out.pipe(sock); sock.pipe(out); });
    } catch { sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); return; }
    out.on("error", () => { try { sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); } catch { /* gone */ } });
  });
  // Nothing a command sends may crash the service (the audit, 2026-11-06).
  for (const s of [server, inner]) { s.on("clientError", (_e, so) => { try { so.destroy(); } catch { /* gone */ } }); s.on("error", () => {}); }
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const port = server.address().port;
  return {
    port, caFile, bundleFile,
    /** The owner's secrets for this job: [{ host, header, value }] (value already has its prefix). */
    setSecrets(list) {
      const next = new Map();
      for (const s of Array.isArray(list) ? list : []) {
        const host = okHost(s && s.host); const header = String((s && s.header) || "Authorization");
        if (!host || !HEADER_RE.test(header) || typeof s.value !== "string" || !s.value) continue;
        if (!/^[\x20-\x7e]+$/.test(s.value)) continue;
        next.set(host, { header, value: s.value, raw: typeof s.raw === "string" && s.raw.length >= 8 ? s.raw : "" });
      }
      secrets = next;
    },
    hosts: () => [...secrets.keys()],
    /** The repo's network list: { limited, hosts }. */
    setNetwork(n) { network = { limited: !!(n && n.limited), hosts: (n && Array.isArray(n.hosts) ? n.hosts : []).map(okHost).filter(Boolean).slice(0, 100) }; },
    /** What the AI's commands get, so their HTTPS goes through here and trusts it. */
    env() {
      const p = "http://127.0.0.1:" + port;
      return { HTTPS_PROXY: p, https_proxy: p, HTTP_PROXY: p, http_proxy: p, NO_PROXY: "localhost,127.0.0.1,::1", no_proxy: "localhost,127.0.0.1,::1", NODE_USE_ENV_PROXY: "1",
        NODE_EXTRA_CA_CERTS: caFile, SSL_CERT_FILE: bundleFile, CURL_CA_BUNDLE: bundleFile, REQUESTS_CA_BUNDLE: bundleFile, GIT_SSL_CAINFO: bundleFile };
    },
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}

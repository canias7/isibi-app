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
// Each site's certificate files are in a folder only root can open, named by a
// hash, never by the site's name (the audit, 2026-11-06).
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { okHost, okPattern, HEADER_RE, HOST_RE, hostAllowed, hostMatches, normNetwork, PATH_RE, keyAllowed, normConfig, SECRET_KINDS } from "./coder-secrets.mjs";
import { bearerFor, sigv4, withBodyParam } from "./coder-auth.mjs";
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
const BLOCKED = (host) => "Blocked by this repo's network list: " + host + ". Ask the owner to allow it with propose_env (allow_host), unless network access is None.";

// THE HOST A COMMAND ASKS FOR, checked before the network list, the secrets or
// any file (the audit, 2026-11-06): "../../x.example.com" passed as a subdomain
// of "*.example.com", and root then wrote that site's files outside this
// proxy's folder. Allowed: DNS labels only (the rule for saved sites, HOST_RE,
// or one label such as "localhost"; IPv4 addresses are labels too), or an IPv6
// address in brackets with no zone (so no "%"). Never "/", "\", "..", "%", "_"
// or spaces. IP addresses stay reachable only where they are today: on Full,
// since no saved site, list entry or secret can be one.
const ONE_LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
/** The host as the proxy uses it (lower case; an IPv6 address without its brackets), or null. */
export function proxyHost(h) {
  const s = String(h || "").toLowerCase();
  if (s.startsWith("[")) { const ip = s.slice(1, -1); return s.endsWith("]") && /^[0-9a-f:.]+$/.test(ip) && net.isIPv6(ip) ? ip : null; }
  return HOST_RE.test(s) || ONE_LABEL_RE.test(s) ? s : null;
}
/** A CONNECT target, "host:port" or "[IPv6]:port", with a port from 1 to 65535: { host, port }, or null (answered 400). */
export function connectTarget(target) {
  const m = /^(\[[^\]]*\]|[^:[\]]*):(\d{1,5})$/.exec(String(target || ""));
  const host = m && proxyHost(m[1]), port = m ? Number(m[2]) : 0;
  return host && port >= 1 && port <= 65535 ? { host, port } : null;
}

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
 * Starts the proxy. `dir` holds the authority (made once). `maxSites`: how many
 * sites' certificates are kept (the most recent). Returns
 * { port, caFile, bundleFile, siteDir, setSecrets(list), env(), close() }.
 */
export async function startProxy({ dir = "/srv/coder-proxy", systemCa = "/etc/ssl/certs/ca-certificates.crt", upstream = {}, maxSites = 200 } = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o755 });
  const caKey = join(dir, "ca.key"), caFile = join(dir, "ca.pem"), bundleFile = join(dir, "bundle.pem");
  if (!existsSync(caKey) || !existsSync(caFile)) {
    openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", caKey, "-out", caFile, "-days", "3650", "-subj", "/CN=Coder secrets proxy",
      "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-addext", "subjectKeyIdentifier=hash"]);
  }
  chmodSync(caKey, 0o600); chmodSync(caFile, 0o644);
  let sys = ""; try { sys = readFileSync(systemCa, "utf8"); } catch { /* tests */ }
  writeFileSync(bundleFile, sys + (sys.endsWith("\n") || !sys ? "" : "\n") + readFileSync(caFile, "utf8")); chmodSync(bundleFile, 0o644);

  // EACH SITE'S CERTIFICATE (the audit, 2026-11-06). The file names used to be
  // the site's name, so a name like "../../x.example.com" made root write (and
  // follow links) outside this folder. Now the files are named by the sha256 of
  // the name, in a folder only root can open, made fresh when the proxy starts.
  // Each file is created new ("wx"): a file or link already at that name is
  // removed, never followed or written through. openssl only reads them and
  // writes to its output. The 200 most recent sites are kept; older ones are
  // forgotten, files and all, and made again if they come back.
  const siteDir = join(dir, "sites");
  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(siteDir, { mode: 0o700 });
  chmodSync(siteDir, 0o700);
  const keep = Math.max(1, Math.floor(Number(maxSites)) || 200);
  const siteFiles = (host) => { const h = createHash("sha256").update(host).digest("hex"); return ["key", "csr", "pem", "ext"].map((x) => join(siteDir, h + "." + x)); };
  const forget = (files) => { for (const f of files) { try { unlinkSync(f); } catch { /* gone */ } } };
  const fresh = (file, data) => {
    try { writeFileSync(file, data, { flag: "wx", mode: 0o600 }); return; } catch (e) { if (e.code !== "EEXIST") throw e; }
    unlinkSync(file); // a stale file or a link: removed, not followed
    writeFileSync(file, data, { flag: "wx", mode: 0o600 });
  };
  const leaves = new Map(); // host → TLS context, the least recently used first
  const contextFor = (host) => {
    if (!HOST_RE.test(host)) throw new Error("not a host name"); // only checked names get here (belt and braces)
    const hit = leaves.get(host);
    if (hit) { leaves.delete(host); leaves.set(host, hit); return hit; }
    const files = siteFiles(host), [key, csr, crt, ext] = files;
    let ctx;
    try {
      const pem = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } }).privateKey;
      fresh(key, pem);
      fresh(ext, "subjectAltName=DNS:" + host + "\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nauthorityKeyIdentifier=keyid\nsubjectKeyIdentifier=hash\n");
      fresh(csr, openssl(["req", "-new", "-key", key, "-subj", "/CN=" + host]));
      const cert = openssl(["x509", "-req", "-in", csr, "-CA", caFile, "-CAkey", caKey, "-CAcreateserial", "-days", "365", "-extfile", ext]);
      fresh(crt, cert);
      ctx = tls.createSecureContext({ key: pem, cert });
    } catch (e) { forget(files); throw e; }
    leaves.set(host, ctx);
    while (leaves.size > keep) { const old = leaves.keys().next().value; leaves.delete(old); forget(siteFiles(old)); }
    return ctx;
  };

  // THE OWNER'S SECRETS (owner, 2026-11-06, like Claude Code's): each covers one
  // or more sites ("*.example.com" too), optionally only some paths, and adds one
  // or more headers.
  let rules = []; // [{ kind, hosts, paths, headers: [{ name, value }], config, raws }]
  let network = normNetwork(null);
  // Never a key for package registries or GitHub (Claude Code's docs), whatever a secret lists.
  const ruleFor = (h) => (keyAllowed(h) ? rules.find((r) => r.hosts.some((p) => hostMatches(h, p))) : undefined);
  const allowed = (h) => hostAllowed(h, network, rules.flatMap((r) => r.hosts).filter(keyAllowed));
  // THE TLS SIDE: requests for a secret's site, with its key added the way its type says.
  const inner = http.createServer(async (req, res) => {
    const host = req.socket.coderHost;
    const rule = ruleFor(host);
    const pathOk = rule && (!rule.paths.length || rule.paths.some((p) => String(req.url || "").startsWith(p)));
    // A path outside the secret's prefixes gets no key, and when the site is
    // reachable only because of that secret, it is not reachable at all.
    if (!pathOk && !hostAllowed(host, network, [])) { res.writeHead(403, { "content-type": "text/plain", "x-coder-blocked": host }); return res.end(BLOCKED(host + " (outside the secret's paths)")); }
    const s = pathOk ? rule : null;
    const headers = { ...req.headers, host };
    for (const k of Object.keys(headers)) if (/^proxy-/i.test(k)) delete headers[k];
    const set = (name, value) => { for (const k of Object.keys(headers)) if (k.toLowerCase() === name.toLowerCase()) delete headers[k]; headers[name] = value; };
    let body = null; // set when the body is read here (aws, body)
    if (s) {
      try {
        if (s.kind === "headers") for (const h of s.headers) set(h.name, h.value);
        else if (s.kind === "oauth" || s.kind === "gcp") { const tok = await bearerFor(s.kind, s.config, upstream.fetchFn ? { fetchFn: upstream.fetchFn } : {}); s.live = tok; set("Authorization", "Bearer " + tok); }
        else {
          const chunks = []; let size = 0;
          for await (const c of req) { size += c.length; if (size > 10 * 1024 * 1024) throw new Error("the request body is over 10 MB"); chunks.push(c); }
          body = Buffer.concat(chunks);
          if (s.kind === "body" && (body.length || !["GET", "HEAD", "OPTIONS", "DELETE"].includes(String(req.method).toUpperCase()))) { const nb = withBodyParam(headers["content-type"], body, s.config.param, s.config.value); if (nb) { body = nb; if (!headers["content-type"]) headers["content-type"] = "application/x-www-form-urlencoded"; } }
          if (s.kind === "aws") for (const [k, v] of Object.entries(sigv4({ method: req.method, host, path: req.url, headers, body }, s.config))) set(k, v);
          delete headers["transfer-encoding"]; headers["content-length"] = String(body.length);
        }
      } catch (e) { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); return res.end("Coder's proxy could not add the secret for " + host + ": " + String((e && e.message) || e).slice(0, 200)); }
    }
    let up;
    try {
    up = (upstream.request || https.request)({ host: upstream.host || host, port: upstream.port || 443, servername: host, method: req.method, path: req.url, headers, ...(network.mode !== "full" && !upstream.host ? { lookup: publicLookup } : {}), ...(upstream.ca ? { ca: upstream.ca } : {}) }, (r) => {
      // A website that copies the key into its answer's headers does not hand it back (the audit, 2026-11-06).
      const back = { ...r.headers };
      if (s) { const keys = [...s.headers.map((h) => h.value), ...s.raws, s.live].filter((x) => x && x.length >= 8); for (const [k, v] of Object.entries(back)) { const one = Array.isArray(v) ? v.join(", ") : String(v); if (keys.some((x) => one.includes(x))) delete back[k]; } }
      r.on("error", () => res.destroy());
      res.writeHead(r.statusCode || 502, back);
      r.pipe(res);
    });
    } catch (e) { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); return res.end("Coder's proxy could not send that request (" + String(e.code || "bad request") + ")"); }
    up.on("error", (e) => { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); res.end("Coder's proxy could not reach " + host + ": " + String(e.code || e.message)); });
    if (body) up.end(body); else req.pipe(up);
  });

  const server = http.createServer((req, res) => {
    // PLAIN http:// THROUGH THE PROXY: passed on as it is, never with a secret.
    let u; try { u = new URL(req.url); } catch { res.writeHead(400); return res.end("bad request"); }
    if (u.protocol !== "http:") { res.writeHead(400); return res.end("bad request"); }
    // The same host rule as CONNECT, before the list (the audit, 2026-11-06): the
    // URL reader lets "a_b.example.com", "x..example.com" and port 0 through.
    const host = proxyHost(u.hostname), port = u.port ? Number(u.port) : 80;
    if (!host || !(port >= 1 && port <= 65535)) { res.writeHead(400); return res.end("bad request"); }
    if (!allowed(host)) { res.writeHead(403, { "content-type": "text/plain", "x-coder-blocked": host }); return res.end(BLOCKED(host)); }
    const headers = { ...req.headers }; for (const k of Object.keys(headers)) if (/^proxy-/i.test(k)) delete headers[k];
    let up;
    try { up = http.request({ host, port, method: req.method, path: u.pathname + u.search, headers, ...(network.mode !== "full" ? { lookup: publicLookup } : {}) }, (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); }); }
    catch { res.writeHead(400); return res.end("bad request"); }
    up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  server.on("connect", (req, sock, head) => {
    // First of all: a socket error is never left uncaught (live test, 2026-11-06:
    // a blocked site's connection reset crashed the whole service).
    sock.on("error", () => {});
    // The target is checked before anything else (the audit, 2026-11-06): a bad
    // port must never take the service down, and a host that is not a plain name
    // ("../../x.example.com", "a/b.example.com") never reaches the network list,
    // the secrets or a file name.
    const t = connectTarget(req.url);
    if (!t) { sock.end("HTTP/1.1 400 Bad Request\r\n\r\n"); return; }
    const { host, port } = t;
    if (!allowed(host)) { const b = BLOCKED(host); sock.end("HTTP/1.1 403 Forbidden\r\nX-Coder-Blocked: " + host.replace(/[^a-z0-9.:-]/g, "") + "\r\nContent-Length: " + Buffer.byteLength(b) + "\r\n\r\n" + b); return; }
    sock.on("error", () => {});
    if (port === 443 && ruleFor(host)) {
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
    try { out = net.connect({ port, host, ...(network.mode !== "full" ? { lookup: publicLookup } : {}) }, () => { sock.write("HTTP/1.1 200 Connection Established\r\n\r\n"); if (head && head.length) out.write(head); out.pipe(sock); sock.pipe(out); });
    } catch { sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); return; }
    out.on("error", () => { try { sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); } catch { /* gone */ } });
  });
  // Nothing a command sends may crash the service (the audit, 2026-11-06).
  for (const s of [server, inner]) { s.on("clientError", (_e, so) => { try { so.destroy(); } catch { /* gone */ } }); s.on("error", () => {}); }
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  server.unref(); // never what keeps the service (or a test) running
  const port = server.address().port;
  return {
    port, caFile, bundleFile, siteDir,
    /**
     * The owner's secrets for this job: [{ hosts, paths, headers: [{ name, value }], raws }]
     * (header values already have their prefix), or the older [{ host, header, value, raw }].
     */
    setSecrets(list) {
      const next = [];
      for (const s of Array.isArray(list) ? list : []) {
        if (!s || typeof s !== "object") continue;
        const hosts = (Array.isArray(s.hosts) ? s.hosts : [s.host]).map(okPattern).filter(Boolean);
        const kind = SECRET_KINDS.includes(s.kind) ? s.kind : "headers";
        const headers = kind !== "headers" ? [] : (Array.isArray(s.headers) ? s.headers : [{ name: s.header || "Authorization", value: s.value }])
          .filter((h) => h && HEADER_RE.test(String(h.name || "")) && typeof h.value === "string" && /^[\x20-\x7e]+$/.test(h.value)).map((h) => ({ name: String(h.name), value: h.value }));
        const config = kind === "headers" ? null : normConfig(kind, s.config);
        if (!hosts.length || (kind === "headers" ? !headers.length : !config)) continue;
        const paths = (Array.isArray(s.paths) ? s.paths : []).filter((x) => PATH_RE.test(String(x)));
        const raws = (Array.isArray(s.raws) ? s.raws : [s.raw]).filter((x) => typeof x === "string" && x.length >= 8);
        next.push({ kind, hosts, paths, headers, config, raws });
      }
      rules = next.slice(0, 20);
    },
    hosts: () => [...new Set(rules.flatMap((r) => r.hosts))],
    /** The repo's network setting: { mode: full | limited | none, hosts }. */
    setNetwork(n) { network = normNetwork(n); },
    /** What the AI's commands get, so their HTTPS goes through here and trusts it. */
    env() {
      const p = "http://127.0.0.1:" + port;
      return { HTTPS_PROXY: p, https_proxy: p, HTTP_PROXY: p, http_proxy: p, NO_PROXY: "localhost,127.0.0.1,::1", no_proxy: "localhost,127.0.0.1,::1", NODE_USE_ENV_PROXY: "1",
        NODE_EXTRA_CA_CERTS: caFile, SSL_CERT_FILE: bundleFile, CURL_CA_BUNDLE: bundleFile, REQUESTS_CA_BUNDLE: bundleFile, GIT_SSL_CAINFO: bundleFile };
    },
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}

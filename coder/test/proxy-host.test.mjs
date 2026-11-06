// THE PROXY AND HOST NAMES (the audit, 2026-11-06, item 4 part 2): Coder's
// secrets proxy runs as root. A host like "../../x.example.com" passed as a
// subdomain of a "*.example.com" secret, and root built that site's certificate
// file names from it, so the AI's user could make root write outside the
// proxy's folder. Now a host is checked before anything else, the files are
// named by a hash in a folder only root can open, and they are always created
// new. Driven like the proxy tests in coder.test.mjs: raw requests, and curl
// through the proxy to a stand-in site on this machine.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { readFileSync, writeFileSync, readdirSync, lstatSync, statSync, symlinkSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHash, createPrivateKey, X509Certificate } from "node:crypto";
import { startProxy, connectTarget, proxyHost } from "../container/coder-proxy.mjs";
import { hostMatches, hostAllowed } from "../container/coder-secrets.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
/** A site's four files, as the proxy names them. */
const filesOf = (...hosts) => hosts.flatMap((h) => ["csr", "ext", "key", "pem"].map((x) => sha(h) + "." + x)).sort();
/** Everything under a folder, as paths from it (links are listed, never followed). */
const tree = (dir, pre = "") => readdirSync(dir, { withFileTypes: true }).flatMap((e) => [pre + e.name, ...(e.isDirectory() ? tree(join(dir, e.name), pre + e.name + "/") : [])]).sort();
/** A raw request to the proxy: everything it answers, until it closes or a tunnel opens. */
const ask = (px, text) => new Promise((ok) => {
  let b = "";
  const s = net.connect(px.port, "127.0.0.1", () => s.write(text));
  const done = () => { clearTimeout(timer); s.destroy(); ok(b); };
  const timer = setTimeout(done, 8000);
  s.on("data", (x) => { b += x; if (/^HTTP\/1\.1 200 Connection Established\r\n\r\n/.test(b)) done(); });
  s.on("close", done);
  s.on("error", done);
});
const connect = (px, target) => ask(px, "CONNECT " + target + " HTTP/1.1\r\nHost: x\r\n\r\n");
const get = (px, url) => ask(px, "GET " + url + " HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n");
const listen = (server) => new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server.address().port)));

test("CD95 audit (2026-11-06): a host that is not a plain DNS name, or a port outside 1-65535, gets 400 before the network list or the secrets look at it, and nothing is written outside the proxy's folder", async () => {
  const base = await mkdtemp(join(tmpdir(), "coder-pxh-"));
  // The proxy's folder sits two levels down, so "../../" from it is base/a.
  const px = await startProxy({ dir: join(base, "a", "b", "px") });
  try {
    px.setSecrets([{ hosts: ["*.example.com"], headers: [{ name: "Authorization", value: "Bearer k_wild_SECRET" }], raws: ["k_wild_SECRET"] }]);
    const before = tree(base);
    const bad = [
      "../../x.example.com:443", "..%2f..%2fx.example.com:443", "a/b.example.com:443", "x.example.com%2f..:443", "%2e%2e.example.com:443",
      "a_b.example.com:443", "x..example.com:443", ".example.com:443", "x.example.com.:443", "-x.example.com:443", "a*b.example.com:443", "a?b.example.com:443",
      "a".repeat(64) + ".example.com:443", ("a".repeat(60) + ".").repeat(5) + "example.com:443",
      "x.example.com:0", "x.example.com:65536", "x.example.com:99999", "x.example.com:-1", "x.example.com:443x", "x.example.com:", "x.example.com", ":443", "x.example.com:443:443",
      "::1:443", "[::1]", "[::1]x:443", "[x.example.com]:443", "[fe80::1%25eth0]:443", "[]:443",
    ];
    // Full lets every name through the list, and the secret covers "*.example.com":
    // the 400 comes first, whatever the level.
    for (const mode of ["full", "trusted", "none"]) {
      px.setNetwork({ mode });
      for (const t of bad) assert.match(await connect(px, t), /^HTTP\/1\.1 400 /, mode + ": CONNECT " + t);
      for (const u of ["http://a_b.example.com/", "http://x..example.com/", "http://a*b.example.com/", "http://x.example.com:0/"]) assert.match(await get(px, u), /^HTTP\/1\.1 400 /, mode + ": GET " + u);
    }
    // Nothing new anywhere: not above the proxy's folder, not beside it, not in it.
    assert.deepEqual(tree(base), before);
    assert.deepEqual(readdirSync(base), ["a"]);
    assert.deepEqual(readdirSync(join(base, "a")), ["b"], "nothing where ../../ points");
    assert.deepEqual(readdirSync(join(base, "a", "b")), ["px"], "nothing where ../ points");
    assert.deepEqual(readdirSync(px.siteDir), [], "no site's files were made");
    // Still serving, and a real name the list does not allow is refused as before.
    px.setNetwork({ mode: "none" });
    assert.match(await connect(px, "evil.example:443"), /^HTTP\/1\.1 403 [\s\S]*Blocked by this repo's network list: evil\.example/);
  } finally { await px.close(); }
});

test("CD96 audit (2026-11-06): each site's certificate files are named by a hash, in a folder only root can open, always created new (a link already there is never followed), only the most recent sites kept; a real subdomain of a wildcard secret still gets its certificate and its key", async () => {
  // A STAND-IN for the real sites: TLS on this machine, echoing the key it got.
  const d = await mkdtemp(join(tmpdir(), "coder-pxh-up-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(d, "k"), "-out", join(d, "c"), "-days", "2", "-subj", "/CN=api.example.com", "-addext", "subjectAltName=DNS:api.example.com,DNS:deep.sub.example.com,DNS:example.com"], { stdio: "ignore" });
  const up = https.createServer({ key: readFileSync(join(d, "k")), cert: readFileSync(join(d, "c")) }, (q, r) => r.end("auth=" + (q.headers.authorization || "none") + " host=" + q.headers.host + " path=" + q.url));
  const upPort = await listen(up);
  const base = await mkdtemp(join(tmpdir(), "coder-pxh-"));
  chmodSync(base, 0o755); // like /srv: the AI's user can reach the proxy's public certificate
  const victim = join(base, "victim.txt");
  writeFileSync(victim, "untouched\n");
  const px = await startProxy({ dir: join(base, "px"), upstream: { host: "127.0.0.1", port: upPort, ca: readFileSync(join(d, "c")) }, maxSites: 2 });
  try {
    px.setSecrets([{ hosts: ["*.example.com"], paths: ["/v1/"], headers: [{ name: "Authorization", value: "Bearer k_wild_SECRET" }], raws: ["k_wild_SECRET"] }]);
    px.setNetwork({ mode: "none" }); // a secret's sites are reachable even on None
    // THE FOLDER: root's only.
    const st = statSync(px.siteDir);
    assert.equal(st.mode & 0o777, 0o700);
    assert.equal(st.uid, process.getuid());
    assert.equal(px.siteDir, join(base, "px", "sites"));
    // LINKS ALREADY WAITING at api.example.com's file names: removed, never written through.
    const h = sha("api.example.com");
    for (const x of ["key", "csr", "pem", "ext"]) symlinkSync(victim, join(px.siteDir, h + "." + x));
    const env = { PATH: process.env.PATH, ...px.env() };
    const curl = (u) => new Promise((ok) => execFile("curl", ["-sS", "--max-time", "20", u], { env }, (err, so, se) => ok(String(so) || String(se))));
    assert.equal(await curl("https://api.example.com/v1/balance"), "auth=Bearer k_wild_SECRET host=api.example.com path=/v1/balance", "a real subdomain: its certificate (trusted by the command) and the key");
    assert.equal(readFileSync(victim, "utf8"), "untouched\n", "the link's target was not written");
    assert.deepEqual(readdirSync(base).sort(), ["px", "victim.txt"]);
    for (const x of ["key", "csr", "pem", "ext"]) {
      const l = lstatSync(join(px.siteDir, h + "." + x));
      assert.ok(l.isFile() && !l.isSymbolicLink(), x + " is a new file");
      assert.equal(l.mode & 0o777, 0o600, x);
    }
    // Its certificate and its key: for that name, from the proxy's authority, and a pair.
    const cert = new X509Certificate(readFileSync(join(px.siteDir, h + ".pem")));
    assert.equal(cert.subjectAltName, "DNS:api.example.com");
    assert.ok(cert.checkIssued(new X509Certificate(readFileSync(px.caFile))), "signed by the proxy's authority");
    assert.ok(cert.checkPrivateKey(createPrivateKey(readFileSync(join(px.siteDir, h + ".key")))), "the key that goes with it");
    // PATH PREFIXES as before: outside /v1/ no key, and on None the site is not reachable there.
    assert.match(await curl("https://api.example.com/v2/other"), /Blocked by this repo's network list: api\.example\.com \(outside the secret's paths\)/);
    // A deeper subdomain is covered by "*.example.com" too.
    assert.equal(await curl("https://deep.sub.example.com/v1/x"), "auth=Bearer k_wild_SECRET host=deep.sub.example.com path=/v1/x");
    // HASHES ONLY: no file in the proxy's folder is named after a site.
    const names = () => readdirSync(px.siteDir).sort();
    assert.deepEqual(names(), filesOf("api.example.com", "deep.sub.example.com"));
    assert.ok(names().every((f) => /^[0-9a-f]{64}\.(key|csr|pem|ext)$/.test(f)), names().join(" "));
    assert.deepEqual(tree(join(base, "px")).filter((f) => /example/.test(f)), []);
    // ONLY THE MOST RECENT SITES (2 here, 200 in the container): a third forgets the oldest, files and all...
    assert.match(await connect(px, "example.com:443"), /^HTTP\/1\.1 200 Connection Established/, "the bare domain of *.example.com");
    assert.deepEqual(names(), filesOf("deep.sub.example.com", "example.com"));
    // ...and a forgotten site is made again when it comes back.
    assert.equal(await curl("https://api.example.com/v1/again"), "auth=Bearer k_wild_SECRET host=api.example.com path=/v1/again");
    assert.deepEqual(names(), filesOf("example.com", "api.example.com"));
    // THE AI'S USER (dev, uid 1001 in the container) can read the public certificate, but cannot open the sites' folder.
    if (process.getuid && process.getuid() === 0) {
      const as = (cmd, args) => spawnSync(cmd, args, { uid: 1001, gid: 1001, encoding: "utf8" });
      assert.equal(as("cat", [px.caFile]).status, 0, "the public certificate stays readable");
      const ls = as("ls", [px.siteDir]);
      assert.notEqual(ls.status, 0);
      assert.match(ls.stderr, /Permission denied/);
      assert.notEqual(as("cat", [join(px.siteDir, h + ".key")]).status, 0, "a site's key is root's");
    }
  } finally { await px.close(); up.close(); }
});

test("CD97 audit (2026-11-06): hostMatches matches only real DNS names; the network levels, allowed sites without keys, and today's IPv4 and IPv6 handling stay as they were", async () => {
  // THE RULE: real subdomains match a wildcard; anything shaped like a path never does.
  for (const ok of ["api.example.com", "API.Example.COM", "example.com", "deep.sub.example.com", "x-1.example.com"]) assert.equal(hostMatches(ok, "*.example.com"), true, ok);
  assert.equal(hostMatches("api.example.com", "api.example.com"), true);
  assert.equal(hostMatches("notexample.com", "*.example.com"), false);
  for (const bad of ["../../x.example.com", "..%2f..%2fx.example.com", "a/b.example.com", "a\\b.example.com", "..\\..\\x.example.com", "x.example.com%2f..", "%2e%2e.example.com", "a_b.example.com", "a b.example.com", " a.example.com", "a.example.com ",
    "x..example.com", ".example.com", "-a.example.com", "a-.example.com", "a.example.com.", "x.example.com\n", "x\0.example.com", "a*b.example.com", "a".repeat(64) + ".example.com", "", null, undefined]) {
    assert.equal(hostMatches(bad, "*.example.com"), false, JSON.stringify(bad));
  }
  // ...so a secret and the network list never cover them either.
  assert.equal(hostAllowed("x.example.com", { mode: "none" }, ["*.example.com"]), true, "a secret's site, even on None");
  assert.equal(hostAllowed("../../x.example.com", { mode: "none" }, ["*.example.com"]), false);
  assert.equal(hostAllowed("storage.googleapis.com", null), true, "Trusted: the default list");
  for (const bad of ["x_y.googleapis.com", "a/b.googleapis.com", "../storage.googleapis.com"]) assert.equal(hostAllowed(bad, null), false, bad);
  assert.equal(hostAllowed("api.x.com", { mode: "custom", hosts: ["*.x.com"], defaults: false }), true);
  assert.equal(hostAllowed("../api.x.com", { mode: "custom", hosts: ["*.x.com"], defaults: false }), false);
  assert.equal(hostAllowed("anything.example", { mode: "full" }), true, "Full: every real name");
  // THE TARGETS: a name, an IPv4 address, or an IPv6 address in brackets; anything else is null (400).
  assert.deepEqual(connectTarget("API.Example.com:443"), { host: "api.example.com", port: 443 });
  assert.deepEqual(connectTarget("localhost:3000"), { host: "localhost", port: 3000 });
  assert.deepEqual(connectTarget("127.0.0.1:8080"), { host: "127.0.0.1", port: 8080 });
  assert.deepEqual(connectTarget("[::1]:443"), { host: "::1", port: 443 });
  assert.deepEqual(connectTarget("[2001:DB8::1]:65535"), { host: "2001:db8::1", port: 65535 });
  assert.deepEqual(connectTarget("[::ffff:1.2.3.4]:1"), { host: "::ffff:1.2.3.4", port: 1 });
  for (const bad of ["../../x.example.com:443", "..\\..\\x.example.com:443", "a\"b.example.com:443", "x.example.com:443 ", " x.example.com:443", "x.example.com:+443", "x.example.com:0x1bb", "x.example.com:1e3", "x.example.com:00000",
    "[::1]:0", "[::1]:65536", "[fe80::1%eth0]:443", "[fe80::1%25eth0]:443", "[::g]:443", "[1.2.3.4]:443", "::1:443", "", null, undefined]) {
    assert.equal(connectTarget(bad), null, JSON.stringify(bad));
  }
  assert.equal(proxyHost("[::1]"), "::1");
  assert.equal(proxyHost("127.0.0.1"), "127.0.0.1");
  assert.equal(proxyHost("a\\b.example.com"), null);
  assert.equal(proxyHost("[fe80::1%eth0]"), null);
  // THROUGH THE PROXY: an IP address works on Full and nowhere else, as before, by CONNECT and by http://.
  const echo = net.createServer((s) => { s.on("error", () => {}); s.pipe(s); });
  const web = http.createServer((q, r) => r.end("plain " + q.url));
  const echoPort = await listen(echo), webPort = await listen(web);
  const px = await startProxy({ dir: await mkdtemp(join(tmpdir(), "coder-pxh-")) });
  try {
    px.setNetwork({ mode: "full" });
    const tunnel = await new Promise((ok) => {
      let b = "";
      const s = net.connect(px.port, "127.0.0.1", () => s.write("CONNECT 127.0.0.1:" + echoPort + " HTTP/1.1\r\nHost: x\r\n\r\n"));
      const done = () => { clearTimeout(timer); s.destroy(); ok(b); };
      const timer = setTimeout(done, 8000);
      s.on("data", (x) => { b += x; if (b === "HTTP/1.1 200 Connection Established\r\n\r\n") s.write("ping"); if (b.endsWith("ping")) done(); });
      s.on("close", done);
      s.on("error", done);
    });
    assert.equal(tunnel, "HTTP/1.1 200 Connection Established\r\n\r\nping", "Full: a tunnel to an IPv4 address");
    assert.match(await get(px, "http://127.0.0.1:" + webPort + "/x"), /^HTTP\/1\.1 200 [\s\S]*plain \/x$/, "Full: plain http:// to an IPv4 address");
    assert.doesNotMatch(await connect(px, "localhost:" + echoPort), /^HTTP\/1\.1 40[03] /, "Full: a one-label name");
    // IPv6 in brackets is let through on Full (this machine may have no IPv6, so the
    // connection itself may fail with 502, but never 400 or 403).
    assert.doesNotMatch(await connect(px, "[::1]:" + echoPort), /^HTTP\/1\.1 40[03] /, "Full: CONNECT to [::1]");
    assert.doesNotMatch(await get(px, "http://[::1]:" + webPort + "/"), /^HTTP\/1\.1 40[03] /, "Full: http:// to [::1]");
    for (const mode of ["trusted", "custom", "none"]) {
      px.setNetwork({ mode, hosts: ["*.allowed.example"], defaults: true });
      for (const t of ["127.0.0.1:" + echoPort, "[::1]:" + echoPort, "localhost:" + echoPort]) assert.match(await connect(px, t), /^HTTP\/1\.1 403 /, mode + ": CONNECT " + t);
      for (const u of ["http://127.0.0.1:" + webPort + "/", "http://[::1]:" + webPort + "/"]) assert.match(await get(px, u), /^HTTP\/1\.1 403 /, mode + ": GET " + u);
    }
    // AN ALLOWED SITE WITHOUT A KEY: let through to the real site (which this machine
    // cannot reach, so 502), never refused; a site off the list is still refused.
    px.setNetwork({ mode: "custom", hosts: ["*.allowed.example"], defaults: false });
    assert.doesNotMatch(await connect(px, "api.allowed.example:443"), /^HTTP\/1\.1 40[03] /);
    assert.doesNotMatch(await get(px, "http://api.allowed.example/"), /^HTTP\/1\.1 40[03] /);
    assert.match(await connect(px, "api.other.example:443"), /^HTTP\/1\.1 403 /);
    assert.deepEqual(readdirSync(px.siteDir), [], "no secret, so no certificate was made");
  } finally { await px.close(); echo.close(); web.close(); }
});

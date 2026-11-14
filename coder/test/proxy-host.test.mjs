// THE PROXY AND HOST NAMES (the audit, 2026-11-06, item 4 part 2): Coder's
// secrets proxy runs as root. A host like "../../x.example.com" passed as a
// subdomain of a "*.example.com" secret, and root built that site's certificate
// file names from it, so the AI's user could make root write outside the
// proxy's folder. Now a host is checked before anything else, the files are
// named by a hash in a folder only root can open, and they are always created
// new. The audit's review of that fix added: inside a keyed site's tunnel only
// a path is taken, a path prefix holds only for a plain path, names over 64
// characters get a certificate, and the tests now pin the most recently used
// sites, the folder emptied at each start and IPv6 over plain http://. Driven
// like the proxy tests in coder.test.mjs: raw requests, and curl through the
// proxy to a stand-in site on this machine.
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
import { startProxy, connectTarget, proxyHost, plainPath } from "../container/coder-proxy.mjs";
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
    assert.match(await connect(px, "evil.example:443"), /^HTTP\/1\.1 403 [\s\S]*request blocked: no rule or allowlist entry allows host evil\.example/);
  } finally { await px.close(); }
});

test("CD96 audit (2026-11-06): each site's certificate files are named by a hash, in a folder only root can open and emptied at each start, always created new (a link already there is never followed), only the most recently used sites kept; a real subdomain of a wildcard secret still gets its certificate and its key, a name over 64 characters too; inside its tunnel only a path is taken, and a path prefix holds only for a plain path", async () => {
  // A STAND-IN for the real sites: TLS on this machine, echoing the key it got.
  const d = await mkdtemp(join(tmpdir(), "coder-pxh-up-"));
  // A real name over 64 characters, as an S3 bucket's under "*.amazonaws.com" often is.
  const long = "acme-data-lake-raw-events-production.s3.eu-central-1.storage.example.com";
  assert.ok(long.length > 64);
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(d, "k"), "-out", join(d, "c"), "-days", "2", "-subj", "/CN=api.example.com", "-addext", "subjectAltName=DNS:api.example.com,DNS:deep.sub.example.com,DNS:example.com,DNS:" + long], { stdio: "ignore" });
  const seen = []; // every request the stand-in got
  const up = https.createServer({ key: readFileSync(join(d, "k")), cert: readFileSync(join(d, "c")) }, (q, r) => { seen.push(q.url); r.end("auth=" + (q.headers.authorization || "none") + " host=" + q.headers.host + " path=" + q.url); });
  const upPort = await listen(up);
  const base = await mkdtemp(join(tmpdir(), "coder-pxh-"));
  chmodSync(base, 0o755); // like /srv: the AI's user can reach the proxy's public certificate
  const victim = join(base, "victim.txt");
  writeFileSync(victim, "untouched\n");
  const opts = { dir: join(base, "px"), upstream: { host: "127.0.0.1", port: upPort, ca: readFileSync(join(d, "c")) }, maxSites: 2 };
  const px = await startProxy(opts);
  let px2 = null;
  try {
    const wild = { hosts: ["*.example.com"], paths: ["/v1/"], headers: [{ name: "Authorization", value: "Bearer k_wild_SECRET" }], raws: ["k_wild_SECRET"] };
    px.setSecrets([wild]);
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
    const curl = (...a) => new Promise((ok) => execFile("curl", ["-sS", "--max-time", "20", ...a], { env }, (err, so, se) => ok(String(so) || String(se))));
    // A request to api.example.com with exactly this target after the method (curl sends it as it is).
    const raw = (target, ...a) => curl(...a, "--request-target", target, "https://api.example.com/");
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
    assert.equal(cert.subject, "CN=api.example.com", "an ordinary name keeps its common name");
    assert.ok(cert.checkIssued(new X509Certificate(readFileSync(px.caFile))), "signed by the proxy's authority");
    assert.ok(cert.checkPrivateKey(createPrivateKey(readFileSync(join(px.siteDir, h + ".key")))), "the key that goes with it");
    // PATH PREFIXES as before: outside /v1/ no key, and on None the site is not reachable there.
    assert.match(await curl("https://api.example.com/v2/other"), /request blocked: no rule or allowlist entry allows host api\.example\.com \(outside the secret's paths\)/);
    // ...AND ONLY FOR A PLAIN PATH (the audit, 2026-11-06): websites read each of these
    // as "/admin", outside "/v1/", so none gets the key, and on None none reaches the site.
    const sent = seen.length;
    for (const t of ["/v1/../admin", "/v1/%2e%2e/admin", "/v1/.%2E/admin", "/v1/..;/admin", "/v1/..%2fadmin", "/v1/..%5Cadmin", "/v1/..\\admin", "/v1/%252e%252e/admin", "/v1/x/../../admin", "/v1/..#x"]) {
      assert.match(await raw(t), /request blocked: no rule or allowlist entry allows host api\.example\.com \(outside the secret's paths\)/, t);
    }
    assert.equal(seen.length, sent, "none of them reached the site");
    for (const t of ["/v1/ok", "/v1/.well-known/x?a=../b", "/v1/a...b/file.txt", "/v1/projects/group%2Fproject"]) assert.equal(await raw(t), "auth=Bearer k_wild_SECRET host=api.example.com path=" + t, t);
    for (const t of ["/v1/..", "/v1/.", "/v1/...", "/v1/..%20/admin", "/v1/..%00/admin", "/v1/..%3b/admin", "/v1/x;/../admin", "/v1/x#/../../admin", "/v1/%25252e%25252e/admin"]) assert.equal(plainPath(t), false, t);
    for (const t of ["/", "/v1/a..b", "/v1/..a", "/v1/x?q=/../..", "/v1//x", "/v1/%zz", "/v1/;x"]) assert.equal(plainPath(t), true, t);
    px.setNetwork({ mode: "full" }); // where the site is reachable anyway: reached, but without the key
    assert.equal(await raw("/v1/../admin"), "auth=none host=api.example.com path=/v1/../admin");
    px.setNetwork({ mode: "none" });
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
    // THE MOST RECENTLY USED, not just the newest made: example.com (made before
    // api.example.com) is used again, so the next new site forgets api.example.com.
    assert.match(await connect(px, "example.com:443"), /^HTTP\/1\.1 200 Connection Established/);
    assert.match(await connect(px, "deep.sub.example.com:443"), /^HTTP\/1\.1 200 Connection Established/);
    assert.deepEqual(names(), filesOf("example.com", "deep.sub.example.com"));
    // A NAME OVER 64 CHARACTERS (the audit, 2026-11-06): openssl takes no common name
    // that long, so its certificate names it only in the subjectAltName, which is
    // what clients check. It used to get a bare 502.
    assert.equal(await curl("https://" + long + "/v1/k"), "auth=Bearer k_wild_SECRET host=" + long + " path=/v1/k");
    const lc = new X509Certificate(readFileSync(join(px.siteDir, sha(long) + ".pem")));
    assert.equal(lc.subjectAltName, "DNS:" + long);
    assert.equal(lc.subject, "O=Coder secrets proxy");
    assert.ok(lc.checkIssued(new X509Certificate(readFileSync(px.caFile))));
    // ONLY A PATH, NEVER A FULL ADDRESS (the audit, 2026-11-06). With a key for every
    // path, "GET http://evil.example/x" inside api.example.com's tunnel was sent on with
    // the key, and many front ends hand such a request to evil.example. Now 400, and
    // nothing is sent.
    px.setSecrets([{ ...wild, paths: [] }]);
    const before = seen.length;
    for (const t of ["http://evil.example/x", "https://evil.example:8443/x", "HTTP://EVIL.EXAMPLE/x", "*"]) {
      assert.match(await raw(t, "-i"), /HTTP\/1\.1 400 [\s\S]*\r\n\r\nCoder's proxy: only a path \(starting with \/\) may be sent to api\.example\.com, not a full address$/, t);
    }
    assert.equal(seen.length, before, "nothing reached the site");
    assert.equal(await raw("/admin/x"), "auth=Bearer k_wild_SECRET host=api.example.com path=/admin/x", "a path still gets the key");
    // EMPTIED AT EACH START (the audit, 2026-11-06): the service starts the proxy again
    // on the same folder (after a failed start, or when the service restarts), so no
    // site's files, and nothing else left there, outlive the proxy that made them.
    await px.close();
    writeFileSync(join(px.siteDir, "stale.key"), "old\n");
    symlinkSync(victim, join(px.siteDir, "stale-link"));
    const ca = readFileSync(px.caFile, "utf8");
    px2 = await startProxy(opts);
    assert.equal(px2.siteDir, px.siteDir);
    assert.deepEqual(readdirSync(px2.siteDir), [], "emptied");
    assert.equal(statSync(px2.siteDir).mode & 0o777, 0o700, "still root's only");
    assert.equal(readFileSync(px2.caFile, "utf8"), ca, "the authority is kept");
    assert.equal(readFileSync(victim, "utf8"), "untouched\n", "the link was removed, not followed");
    px2.setSecrets([wild]);
    px2.setNetwork({ mode: "none" });
    assert.match(await connect(px2, "example.com:443"), /^HTTP\/1\.1 200 Connection Established/);
    assert.deepEqual(readdirSync(px2.siteDir).sort(), filesOf("example.com"), "and sites are made there again");
  } finally { await px.close(); if (px2) await px2.close(); up.close(); }
});

test("CD97 audit (2026-11-06): hostMatches matches only real DNS names; the network levels, allowed sites without keys, and today's IPv4 and IPv6 handling stay as they were, and plain http:// hands on an IPv6 address without its brackets", async () => {
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
    // (Bash docs pass 8, the owner, 2026-11-11: "Yes pls": Full no longer reaches the machine's own local addresses through
    // the gate, by name or by number, in Claude Code's words; its sandbox proxy refuses "the connection when the name
    // resolves only to local addresses". A command still reaches its own localhost directly: NO_PROXY.)
    assert.match(tunnel, /^HTTP\/1\.1 403 Forbidden[\s\S]*Destination IP is in a private\/reserved range$/, "Full: a tunnel to the machine's own address (Claude Code's cloud words since round 3)");
    assert.match(await get(px, "http://127.0.0.1:" + webPort + "/x"), /^HTTP\/1\.1 403 [\s\S]*Destination IP is in a private\/reserved range$/, "Full: plain http:// to it");
    assert.match(await connect(px, "localhost:" + echoPort), /^HTTP\/1\.1 403 [\s\S]*Destination IP is in a private\/reserved range$/, "Full: a name for it");
    assert.match(await connect(px, "[::1]:" + echoPort), /^HTTP\/1\.1 403 /, "Full: CONNECT to [::1]");
    // Plain http:// hands Node the address without its brackets (the audit, 2026-11-06):
    // with them, Node looked "[::1]" up as a name, so it never worked. Checked where the
    // proxy hands it on (the proxy's "node:http" is this one), since the answer here is
    // 502 either way: the stand-in listens on IPv4 only, and this machine may have no IPv6.
    const handed = [], realRequest = http.request;
    http.request = (o, ...rest) => { handed.push(o && o.host); return realRequest.call(http, o, ...rest); };
    // (A public IPv6 address now: a local one is refused before it is handed on.)
    try { assert.doesNotMatch(await get(px, "http://[2606:4700:4700::1111]:" + webPort + "/"), /^HTTP\/1\.1 40[03] /, "Full: http:// to a public IPv6 address"); } finally { http.request = realRequest; }
    assert.deepEqual(handed, ["2606:4700:4700::1111"], "the address, without brackets");
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

test("CD286 (tool 4, changelog pass; Claude Code 2.1.224 and 2.1.251: a blocked network request names the host and the reason) the proxy remembers what its list blocked, and when, so the command that tried says it", async () => {
  const base = await mkdtemp(join(tmpdir(), "coder-pxh-"));
  const px = await startProxy({ dir: join(base, "px") });
  try {
    px.setNetwork({ mode: "custom", hosts: ["allowed.example.com"], defaults: false });
    const t0 = Date.now();
    assert.match(await connect(px, "blocked.example.com:443"), /^HTTP\/1\.1 403 Forbidden/);
    assert.match(await get(px, "http://plain.example.org/x"), /^HTTP\/1\.1 403/);
    assert.match(await connect(px, "blocked.example.com:443"), /^HTTP\/1\.1 403 Forbidden/);
    assert.deepEqual(px.blockedSince(t0), [{ host: "blocked.example.com", why: "not on the network list" }, { host: "plain.example.org", why: "not on the network list" }], "each once");
    assert.deepEqual(px.blockedSince(Date.now() + 1000), [], "only since the command started");
    px.setNetwork({ mode: "none" });
    await new Promise((ok) => setTimeout(ok, 5));
    const t1 = Date.now();
    await connect(px, "other.example.net:443");
    assert.deepEqual(px.blockedSince(t1), [{ host: "other.example.net", why: "network access is None" }]);
  } finally { px.close && px.close(); }
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const b = typeof p0\.blockedSince === "function" \? p0\.blockedSince\(startedAt\) : \[\]; netNote = blockedNote\(b\); \}/);
  // What the command is told (live test 32): a site on the blocked sites list is never one to propose allowing.
  const { blockedNote } = await import("../container/coder-proxy.mjs");
  assert.equal(blockedNote([]), "");
  assert.equal(blockedNote([{ host: "example.com", why: "on the blocked sites list" }]), "Blocked by this chat's network list while this command ran: example.com (on the blocked sites list). A site on the blocked sites list is refused whatever the network setting allows: don't retry it or propose allowing it; only the owner can take it off that list.");
  // (Since 2026-11-14 it names no tool: get_environment's description says when and where a change is proposed.)
  assert.equal(blockedNote([{ host: "other.example.net", why: "not on the network list" }]), "Blocked by this chat's network list while this command ran: other.example.net (not on the network list). If the task needs one, get_environment's description says when and where to propose a change.");
  assert.match(blockedNote([{ host: "a.example", why: "not on the network list" }, { host: "example.com", why: "on the blocked sites list" }]), /when and where to propose a change; one on the blocked sites list stays refused whatever is allowed, and only the owner can take it off that list\.$/);
  assert.equal(blockedNote(Array.from({ length: 12 }, (_, i) => ({ host: "h" + i + ".example", why: "not on the network list" }))).split("(not on").length - 1, 10, "ten at most");
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(agent, /if \(r && typeof r\.netNote === "string" && r\.netNote\) text \+= "\\n\\n" \+ r\.netNote;/);
});

// The owner, 2026-11-17 ("test it ?"): a real git push to a stand-in for GitHub that answers "429, too many requests" the
// first times, then takes the push. Coder's gitNet tries again (Claude Code's backoff) and the push lands.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as S from "../container/server.mjs";

const backend = "/usr/lib/git-core/git-http-backend";
function server(root, fails) {
  let n = 0, busy = 0;
  const srv = http.createServer((req, res) => {
    n++;
    if (busy < fails) { busy++; res.writeHead(429, { "content-type": "text/plain" }); res.end("Too many requests\n"); return; }
    const u = new URL(req.url, "http://x");
    const cgi = spawn(backend, [], { env: { GIT_PROJECT_ROOT: root, GIT_HTTP_EXPORT_ALL: "1", REQUEST_METHOD: req.method, PATH_INFO: u.pathname, QUERY_STRING: u.search.slice(1), CONTENT_TYPE: req.headers["content-type"] || "", REMOTE_USER: "t", REMOTE_ADDR: "127.0.0.1", GIT_HTTP_MAX_REQUEST_BUFFER: "100M", ...(req.headers["content-encoding"] ? { HTTP_CONTENT_ENCODING: req.headers["content-encoding"] } : {}) } });
    req.pipe(cgi.stdin);
    const chunks = [];
    cgi.stdout.on("data", (d) => chunks.push(d));
    cgi.on("close", () => {
      const all = Buffer.concat(chunks), cut = all.indexOf("\r\n\r\n");
      const head = all.slice(0, cut).toString(), body = all.slice(cut + 4);
      let status = 200; const h = {};
      for (const line of head.split("\r\n")) { const [k, ...v] = line.split(": "); if (/^status$/i.test(k)) status = Number(v.join(": ").split(" ")[0]); else if (k) h[k] = v.join(": "); }
      res.writeHead(status, h); res.end(body);
    });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, port: srv.address().port, count: () => n, refused: () => busy })));
}

test("a push GitHub refuses with 429 three times is tried again and lands (Claude Code's 2s/4s/8s backoff, shortened here)", { skip: !existsSync(backend) }, async () => {
  const base = mkdtempSync(join(tmpdir(), "g429-"));
  const bare = join(base, "srv", "r.git");
  execFileSync("git", ["init", "-q", "--bare", bare]);
  execFileSync("git", ["-C", bare, "config", "http.receivepack", "true"]);
  const work = join(base, "work"), gitDir = join(base, "work.git");
  execFileSync("git", ["init", "-q", "--separate-git-dir", gitDir, work]);
  writeFileSync(join(work, "a.txt"), "hi\n");
  execFileSync("git", ["-C", work, "add", "."]);
  execFileSync("git", ["-C", work, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "a"]);
  const s = await server(join(base, "srv"), 3);
  try {
    const url = "http://127.0.0.1:" + s.port + "/r.git";
    const t0 = Date.now();
    const r = await S.gitNet(work, ["push", url, "HEAD:refs/heads/coder/x"], { gitDir, root: base, remote: url }, [50, 100, 200, 400]);
    assert.equal(r.code, 0, r.output);
    assert.equal(s.refused(), 3, "GitHub said 429 three times");
    assert.ok(Date.now() - t0 >= 350, "it waited between tries");
    assert.match(execFileSync("git", ["-C", bare, "log", "--oneline", "coder/x"]).toString(), /a$/m, "the commit is on the server");
    // With only Coder's old 2 retries, 3 refusals in a row would have failed it.
    const s2 = await server(join(base, "srv"), 3);
    try {
      const r2 = await S.gitNet(work, ["push", "http://127.0.0.1:" + s2.port + "/r.git", "HEAD:refs/heads/coder/y"], { gitDir, root: base, remote: "http://127.0.0.1:" + s2.port + "/r.git" }, [50, 100]);
      assert.notEqual(r2.code, 0);
      assert.match(r2.output, /429/);
    } finally { s2.srv.close(); }
  } finally { s.srv.close(); }
});

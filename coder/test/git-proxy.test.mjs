// YOUR GITHUB LOGIN NEVER ENTERS CODER'S MACHINE, and a sleeping machine keeps
// its whole disk (owner, 2026-11-07: "Do 1 and 3", like Claude Code: "GitHub
// credentials ... never enter the session VM", "The GitHub proxy rejects branch
// deletions and pushes of anything other than a branch").
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const G = await import("../src/coder-git.mjs");
const KEY = Buffer.alloc(32, 7).toString("base64");
const UID = "user-1234567890abcdef", ID = "shop-g1", TOKEN = "ghu_REALLOGIN_0123456789";
const BASIC = "Basic " + Buffer.from("x-access-token:" + TOKEN).toString("base64");

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function workerEnv(meta = {}) {
  const bucket = fakeBucket();
  const env = { CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", CODER_BUCKET: bucket };
  const { saveConnection } = await import("../src/coder-github.mjs");
  await saveConnection(env, bucket, UID, { access: TOKEN }, "ana");
  await bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 3, repos: [{ repo: "ana/empty", base: "main" }], ...meta }));
  return { env, bucket };
}
const pkt = (s) => (s.length + 4).toString(16).padStart(4, "0") + s;
const pushBody = (lines) => Buffer.from(lines.map((l, i) => pkt(l + (i === 0 ? "\0report-status side-band-64k" : "") + "\n")).join("") + "0000" + "PACK...");
const Z = "0".repeat(40), A = "a".repeat(40), B = "b".repeat(40);

test("CD130 Coder's git address on the Worker: only with this job's pass, only the chat's own repositories, the owner's login added here (never sent to the machine); pushes only to the chat's branch (and an empty repository's first main), never a deletion or a tag", async () => {
  const { env } = await workerEnv();
  const now = Date.now();
  const acc = await G.gitAccess(env, UID, ID, 3, now);
  assert.equal(acc.remote, "https://coder.gofarther.dev/api/coder/git/");
  assert.equal(acc.headers.length, 4);
  assert.ok(acc.headers.every((h) => /^X-Coder-(Chat|Turn|Until|Git): [\w/.=-]+$/.test(h)), "plain git headers");
  assert.equal(JSON.stringify(acc).includes(TOKEN), false, "the machine never gets the login");
  const H = Object.fromEntries(acc.headers.map((h) => [h.slice(0, h.indexOf(": ")), h.slice(h.indexOf(": ") + 2)]));
  const calls = [];
  const fetchFn = async (url, init = {}) => { calls.push({ url: String(url), auth: init.headers && init.headers.authorization, method: init.method }); return new Response("ok-from-github", { status: 200, headers: { "content-type": "application/x-git-upload-pack-advertisement", "set-cookie": "x=1", "x-github-request-id": "abc" } }); };
  const ask = (path, { method = "GET", headers = H, body } = {}) => G.handleGit(new Request("https://coder.gofarther.dev" + path, { method, headers, ...(body ? { body } : {}) }), env, { fetchFn, now });
  // READ: forwarded to GitHub with the login added here.
  const r = await ask("/api/coder/git/ana/shop.git/info/refs?service=git-upload-pack");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "ok-from-github");
  assert.deepEqual(calls.at(-1), { url: "https://github.com/ana/shop.git/info/refs?service=git-upload-pack", auth: BASIC, method: "GET" });
  assert.equal(r.headers.get("set-cookie"), null, "only git's own headers come back");
  assert.equal((await ask("/api/coder/git/ana/empty.git/git-upload-pack", { method: "POST", body: "0000" })).status, 200, "the chat's other repositories too");
  // NOT THIS JOB'S PASS, ENDED, ANOTHER TURN, ANOTHER REPOSITORY, ANOTHER ADDRESS: refused, GitHub never asked.
  const n = calls.length;
  assert.equal((await ask("/api/coder/git/ana/shop.git/info/refs?service=git-upload-pack", { headers: { ...H, "X-Coder-Git": "x".repeat(43) } })).status, 403);
  assert.equal((await ask("/api/coder/git/ana/shop.git/info/refs?service=git-upload-pack", { headers: { ...H, "X-Coder-Until": String(now - 1) } })).status, 403, "a changed time breaks the pass");
  const old = await G.gitAccess(env, UID, ID, 3, now - G.GIT_PASS_MS - 1000);
  assert.equal((await ask("/api/coder/git/ana/shop.git/info/refs?service=git-upload-pack", { headers: Object.fromEntries(old.headers.map((h) => [h.slice(0, h.indexOf(": ")), h.slice(h.indexOf(": ") + 2)])) })).status, 403, "ended");
  const t2 = await G.gitAccess(env, UID, ID, 2, now);
  assert.equal((await ask("/api/coder/git/ana/shop.git/info/refs?service=git-upload-pack", { headers: Object.fromEntries(t2.headers.map((h) => [h.slice(0, h.indexOf(": ")), h.slice(h.indexOf(": ") + 2)])) })).status, 403, "the chat has moved on");
  assert.equal((await ask("/api/coder/git/ana/other.git/info/refs?service=git-upload-pack")).status, 403, "not this chat's repository");
  assert.equal((await ask("/api/coder/git/ana/shop.git/HEAD")).status, 404);
  assert.equal((await ask("/api/coder/git/ana/shop.git/info/refs?service=git-upload-archive")).status, 400);
  assert.equal((await ask("/api/coder/git/ana/shop.git/git-upload-pack")).status, 405);
  assert.equal(calls.length, n, "GitHub was never asked for any of those");
  // PUSHES: the chat's branch only (made or moved); never deleted; no tags or other branches; an empty repository's first main only.
  const push = (repo, lines) => ask("/api/coder/git/ana/" + repo + ".git/git-receive-pack", { method: "POST", body: pushBody(lines), headers: { ...H, "content-type": "application/x-git-receive-pack-request" } });
  assert.equal((await push("shop", [Z + " " + A + " refs/heads/coder/" + ID])).status, 200, "makes its branch");
  assert.equal((await push("shop", [A + " " + B + " refs/heads/coder/" + ID])).status, 200, "moves it");
  assert.equal((await push("shop", [A + " " + Z + " refs/heads/coder/" + ID])).status, 403, "never deletes it");
  assert.equal((await push("shop", [A + " " + B + " refs/heads/main"])).status, 403, "never main");
  assert.equal((await push("shop", [Z + " " + A + " refs/tags/v1"])).status, 403, "no tags");
  assert.equal((await push("shop", [A + " " + B + " refs/heads/coder/" + ID, Z + " " + A + " refs/heads/other"])).status, 403, "all or nothing");
  assert.equal((await push("empty", [Z + " " + A + " refs/heads/main"])).status, 200, "an empty repository's first main");
  assert.equal((await push("shop", ["shallow " + A, A + " " + B + " refs/heads/coder/" + ID])).status, 200, "from a shallow copy");
  // A push git sent compressed is read the same way.
  const gz = Buffer.from(await new Response(new Blob([pushBody([A + " " + B + " refs/heads/main"])]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  assert.equal((await ask("/api/coder/git/ana/shop.git/git-receive-pack", { method: "POST", body: gz, headers: { ...H, "content-encoding": "gzip" } })).status, 403);
  assert.equal((await ask("/api/coder/git/ana/shop.git/git-receive-pack", { method: "POST", body: Buffer.from("garbage"), headers: H })).status, 400);
  // GitHub disconnected: no login to add.
  const { env: env2, bucket: b2 } = await workerEnv();
  b2.m.delete("coder/" + UID + "/github.json");
  const acc2 = await G.gitAccess(env2, UID, ID, 3, now);
  const r2 = await G.handleGit(new Request("https://coder.gofarther.dev/api/coder/git/ana/shop.git/info/refs?service=git-upload-pack", { headers: Object.fromEntries(acc2.headers.map((h) => [h.slice(0, h.indexOf(": ")), h.slice(h.indexOf(": ") + 2)])) }), env2, { fetchFn, now });
  assert.equal(r2.status, 403);
});

/** A stand-in for GitHub: git's own web server program over bare repositories; only the owner's login is let in. */
async function standInGitHub(top) {
  const seen = [];
  const srv = http.createServer((req, res) => {
    seen.push(req.headers.authorization || "");
    if (req.headers.authorization !== BASIC) { res.writeHead(401); return res.end("who are you"); }
    const u = new URL(req.url, "http://x");
    const p = spawn("/usr/lib/git-core/git-http-backend", [], { env: { PATH: process.env.PATH, GIT_PROJECT_ROOT: top, GIT_HTTP_EXPORT_ALL: "1", PATH_INFO: u.pathname, QUERY_STRING: u.search.slice(1), REQUEST_METHOD: req.method, CONTENT_TYPE: req.headers["content-type"] || "", HTTP_CONTENT_ENCODING: req.headers["content-encoding"] || "", GIT_PROTOCOL: req.headers["git-protocol"] || "", REMOTE_USER: "ana", REMOTE_ADDR: "127.0.0.1" } });
    req.pipe(p.stdin);
    const out = [];
    p.stdout.on("data", (c) => out.push(c));
    p.on("close", () => {
      const all = Buffer.concat(out); const at = all.indexOf("\r\n\r\n");
      const head = all.subarray(0, at).toString(), body = all.subarray(at + 4);
      const headers = {}; let status = 200;
      for (const line of head.split("\r\n")) { const i = line.indexOf(":"); const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim(); if (k === "status") status = parseInt(v, 10); else headers[k] = v; }
      res.writeHead(status, headers); res.end(body);
    });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return { seen, port: srv.address().port, close: () => new Promise((ok) => srv.close(ok)) };
}
/** Coder's Worker, as far as its git address goes, sending GitHub's requests to the stand-in. */
async function standInWorker(env, ghPort) {
  const srv = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const r = await G.handleGit(new Request("https://coder.gofarther.dev" + req.url, { method: req.method, headers: req.headers, ...(req.method === "POST" ? { body } : {}) }), env, {
      fetchFn: async (url, init) => fetch(String(url).replace("https://github.com/", "http://127.0.0.1:" + ghPort + "/"), init),
    });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return { port: srv.address().port, close: () => new Promise((ok) => srv.close(ok)) };
}
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();

test("CD131 for real, with git: the machine fetches and pushes through Coder's Worker with only its pass; the Worker adds the login on the way to GitHub; a push to another branch, a deletion or a tag is refused; an empty repository still gets its first main", async () => {
  const { prepareRepo, pushRepo, gitIn } = await import("../container/server.mjs");
  // "GitHub": ana/shop with one commit on main, and ana/empty with nothing.
  const top = await mkdtemp(join(tmpdir(), "coder-ghs-"));
  const seed = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(seed, "init", "-q", "-b", "main");
  await writeFile(join(seed, "README.md"), "# shop\n");
  git(seed, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(seed, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(top, "ana"));
  execFileSync("git", ["clone", "-q", "--bare", seed, join(top, "ana", "shop.git")]);
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", join(top, "ana", "empty.git")]);
  const gh = await standInGitHub(top);
  const { env } = await workerEnv({ turn: 1 });
  const wk = await standInWorker(env, gh.port);
  try {
    const acc = await G.gitAccess(env, UID, ID, 1);
    const remote = "http://127.0.0.1:" + wk.port + "/api/coder/git/";
    const root = await mkdtemp(join(tmpdir(), "coder-w-"));
    const gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
    const dir = join(root, ID);
    // FETCH, PUSH: only the pass on the machine; the login added by the Worker.
    const prep = await prepareRepo({ dir, repo: "ana/shop", base: "main", branch: "coder/" + ID, token: "", headers: acc.headers, remote, gitRoot, root });
    assert.equal(prep.ok, true, prep.why);
    assert.equal(await readFile(join(dir, "README.md"), "utf8"), "# shop\n");
    await writeFile(join(dir, "page.html"), "<h1>hi</h1>\n");
    const p = await pushRepo({ dir, repo: "ana/shop", branch: "coder/" + ID, token: "", headers: acc.headers, message: "Add the page", remote, gitRoot, root });
    assert.equal(p.ok, true, p.why);
    assert.equal(p.pushed, true);
    assert.equal(git(join(top, "ana", "shop.git"), "show", "coder/" + ID + ":page.html"), "<h1>hi</h1>\n", "saved on GitHub, on the chat's branch");
    assert.ok(gh.seen.length > 0 && gh.seen.every((a) => a === BASIC), "GitHub only ever saw the owner's login, added by the Worker");
    // The machine's git settings never hold the login (it never had it).
    assert.equal(readFileSync(join(gitRoot, ID, "config"), "utf8").includes(TOKEN), false);
    // REFUSED by the Worker: another branch, a deletion, a tag.
    const o = { gitDir: join(gitRoot, ID), remote, root, headers: acc.headers };
    const url = remote + "ana/shop.git";
    for (const [what, args] of [["main", ["push", "--no-verify", url, "HEAD:refs/heads/main"]], ["a deletion", ["push", "--no-verify", url, ":refs/heads/coder/" + ID]], ["a tag", ["push", "--no-verify", url, "HEAD:refs/tags/v1"]]]) {
      const r = await gitIn(dir, args, o);
      assert.notEqual(r.code, 0, what + " was let through");
    }
    assert.equal(git(join(top, "ana", "shop.git"), "rev-parse", "main").trim(), git(seed, "rev-parse", "HEAD").trim(), "main untouched");
    assert.equal(git(join(top, "ana", "shop.git"), "tag").trim(), "");
    // AN EMPTY REPOSITORY (one of the chat's): its first main, then the chat's branch.
    const dir2 = join(root, ID + "-x1");
    const prep2 = await prepareRepo({ dir: dir2, repo: "ana/empty", base: "main", branch: "coder/" + ID, token: "", headers: acc.headers, remote, gitRoot, root });
    assert.equal(prep2.ok, true, prep2.why);
    assert.match(git(join(top, "ana", "empty.git"), "branch"), /main/);
    // Without the pass, git gets nowhere.
    const dir3 = join(root, "shop-g2");
    const no = await prepareRepo({ dir: dir3, repo: "ana/shop", base: "main", branch: "coder/shop-g2", token: "", headers: [], remote, gitRoot, root });
    assert.equal(no.ok, false);
  } finally { await wk.close(); await gh.close(); }
});

test("CD132 wiring: every job, save, Undo and Rewind sends the machine the pass, never the login; the machine uses it only as the real service; a sleeping Fly.io machine keeps its whole disk (and the setup does not run again), and says so", async () => {
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(routes, /token: t\.token/, "the login never goes to the machine");
  assert.match(routes, /git: await gitAccess\(env, uid, id, meta\.turn \+ 1\), effort: pick\.effort/, "a job: its new turn's pass");
  assert.equal((routes.match(/git: await gitAccess\(env, uid, id, meta\.turn\)/g) || []).length, 4, "the save, Coder's own Undo, the Undo button, Rewind");
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /\} else if \(url\.pathname\.startsWith\(GIT_PATH\)\) \{[\s\S]{0,200}res = await handleGit\(request, env\);/);
  // The machine: the Worker's git only as the real service, and only a plain https Worker address with plain headers.
  const { gitFrom, bootKept, createApp } = await import("../container/server.mjs");
  const good = { git: { remote: "https://coder.gofarther.dev/api/coder/git/", headers: ["X-Coder-Chat: u/shop-a1", "X-Coder-Turn: 2", "X-Coder-Until: 1799999999999", "X-Coder-Git: abc_DEF-123"] } };
  assert.deepEqual(gitFrom(good, { via: true, remote: "https://github.com/" }), { remote: good.git.remote, headers: good.git.headers, token: "" });
  assert.deepEqual(gitFrom(good, { via: false, remote: "/tmp/r/" }), { remote: "/tmp/r/", headers: [], token: "" }, "a test's machine keeps its own remote");
  for (const bad of [{ remote: "http://coder.gofarther.dev/api/coder/git/", headers: good.git.headers }, { remote: "https://evil.example/x/", headers: good.git.headers }, { remote: good.git.remote, headers: ["Authorization: Basic x"] }, { remote: good.git.remote, headers: ["X-Coder-Git: a\nb"] }, { remote: good.git.remote, headers: [] }]) {
    assert.deepEqual(gitFrom({ git: bad, token: "old" }, { via: true, remote: "https://github.com/" }), { remote: "https://github.com/", headers: [], token: "old" }, JSON.stringify(bad));
  }
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.equal((server.match(/\.\.\.gitFrom\(body, \{ via: gitVia, remote \}\)/g) || []).length, 6, "the job's repository and its others, Undo, and the save");
  assert.doesNotMatch(server.replace(/export function gitFrom[\s\S]*?\n\}\n/, ""), /body\.token/, "no other use of a token from the Worker");
  // THE WHOLE DISK KEPT WHILE ASLEEP, and up to 20 GB (Fly's rootfs, 2026-11-07); the older way (persist_rootfs,
  // Fly's default size), then without it, if Fly ever refuses them.
  const F = await import("../src/coder-fly.mjs");
  const env = { CODER_MACHINES: "fly", FLY_API_TOKEN: "fly-token-0123456789", CODER_FLY_APP: "gofarther-coder-machines", CODER_FLY_IMAGE: "registry.fly.io/gofarther-coder-machines:coder-aaaaaaaaaaaa", CODER_BUCKET: fakeBucket() };
  assert.deepEqual(F.machineConfig(env, "v").rootfs, { persist: "restart", size_gb: 20 });
  assert.equal("persist_rootfs" in F.machineConfig(env, "v").guest, false);
  assert.equal(F.machineConfig(env, "v", { bigRoot: false }).guest.persist_rootfs, "restart");
  assert.equal("rootfs" in F.machineConfig(env, "v", { bigRoot: false }), false);
  assert.equal("persist_rootfs" in F.machineConfig(env, "v", { keepRoot: false }).guest, false);
  assert.equal("rootfs" in F.machineConfig(env, "v", { keepRoot: false }), false);
  assert.deepEqual(F.CONFIG_TRIES, [{}, { bigRoot: false }, { keepRoot: false }]);
  const tried = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(String(url));
    if (u.host === "api.machines.dev") {
      const body = init.body ? JSON.parse(init.body) : null;
      if (init.method === "POST" && u.pathname.endsWith("/volumes")) return Response.json({ id: "vol_1" });
      if (init.method === "POST" && u.pathname.endsWith("/machines")) { const kind = body.config.rootfs ? "rootfs" : body.config.guest.persist_rootfs ? "restart" : "none"; tried.push(kind); return kind !== "none" ? Response.json({ error: "unknown field" }, { status: 422 }) : Response.json({ id: "m1" }); }
    }
    return new Response("{\"coderStatus\":200,\"body\":{\"ok\":true}}", { status: 200, headers: { "x-coder-machine": "1", "x-coder-keepalive": "1" } });
  };
  const r = await F.flyBox(env, "user-1-shop-k1", { fetchFn, sleep: async () => {} }).fetch(new Request("http://coder/turn", { method: "POST", body: "{}" }));
  assert.equal(r.status, 200);
  assert.deepEqual(tried, ["rootfs", "restart", "none"], "refused twice: made the older way, then without it");
  // THE MACHINE SAYS WHETHER ITS DISK WAS KEPT: a mark from its last start.
  const d = await mkdtemp(join(tmpdir(), "coder-boot-"));
  assert.equal(bootKept(d), false, "a fresh disk");
  assert.equal(existsSync(join(d, ".started")), true);
  assert.equal(bootKept(d), true, "kept since its last start");
  const srv = http.createServer(createApp({ kept: true }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  try { assert.deepEqual(await (await fetch("http://127.0.0.1:" + srv.address().port + "/health")).json(), { ok: true, kept: true }); }
  finally { await new Promise((ok) => srv.close(ok)); }
  assert.match(server, /const mark = join\(setupRoot \|\| gitRoot, project \+ "\.setup-done"\);/, "the setup's marks live on that same disk, so a kept disk skips the setup");
});

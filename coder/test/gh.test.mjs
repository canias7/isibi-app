// `gh` WITH THE OWNER'S GITHUB LOGIN, LIKE CLAUDE CODE'S (owner, 2026-11-07, item 6: "gh: installed, but
// not logged in"). Claude Code's docs: "requests ... from gh under the proxy-injected placeholder go out with
// your real credentials substituted", "independent of the environment's access level"; only "for the
// repositories attached to the session" ("GitHub access to ... is not enabled for this session"); GraphQL
// refused ("GitHub GraphQL is not available from Claude Code sessions", naming gh api repos/{owner}/{repo}/...).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("CD172 the machine's gate sends gh's GitHub API calls to Coder's server with the job's pass (whatever the network setting, even None), never adding a login itself; with gh off, api.github.com is an ordinary site", async () => {
  const { startProxy } = await import("../container/coder-proxy.mjs");
  const got = [];
  const eg = http.createServer((q, r) => { let b = ""; q.on("data", (c) => { b += c; }); q.on("end", () => { got.push({ h: q.headers, body: b }); r.writeHead(200, { "content-type": "application/json" }); r.end("{\"full_name\":\"ana/shop\"}"); }); });
  await new Promise((ok) => eg.listen(0, "127.0.0.1", ok));
  const px = await startProxy({ dir: await mkdtemp(join(tmpdir(), "coder-px-gh-")) });
  const curl = (u, extra = []) => new Promise((ok) => execFile("curl", ["-sS", "--max-time", "15", ...extra, u], { env: { PATH: process.env.PATH, ...px.env() } }, (err, so, se) => ok(String(so) || String(se))));
  try {
    px.setNetwork({ mode: "none" });
    px.setEgress({ url: "http://127.0.0.1:" + eg.address().port + "/api/coder/egress", chat: "u1/shop-g1", turn: 3, pass: "PASS-3" });
    px.setGithub(true);
    assert.equal(await curl("https://api.github.com/repos/ana/shop?x=1", ["-H", "Authorization: token proxy-injected", "-H", "Accept: application/vnd.github+json"]), "{\"full_name\":\"ana/shop\"}");
    const g = got[0];
    assert.deepEqual([g.h["x-coder-url"], g.h["x-coder-egress"], g.h["x-coder-chat"], g.h["x-coder-turn"], g.h["x-coder-method"]], ["https://api.github.com/repos/ana/shop?x=1", "PASS-3", "u1/shop-g1", "3", "GET"]);
    const fwd = JSON.parse(Buffer.from(g.h["x-coder-headers"], "base64url").toString());
    assert.equal(fwd.authorization, "token proxy-injected", "only the placeholder: the login is put in by the Worker");
    // Network None: every other site stays shut.
    assert.match(await curl("https://example.com/"), /403|blocked|Blocked/);
    // gh off: api.github.com is an ordinary site again (here, shut by None).
    px.setGithub(false);
    assert.match(await curl("https://api.github.com/repos/ana/shop"), /403|blocked|Blocked/);
    assert.equal(got.length, 1);
  } finally { await px.close(); eg.close(); }
});

test("CD173 Coder's server puts the owner's GitHub login into gh's calls only for the chat's own repositories (its other repositories too), refuses GraphQL and any other address with Claude Code's messages, lets a job GitHub started only read, and never hands the login back", async () => {
  const { handleEgress, egressPass, GRAPHQL_REFUSED } = await import("../src/coder-egress.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_BUCKET: bucket };
  const UID = "user-1234567890abcdef", ID = "shop-g1";
  await saveConnection(env, bucket, UID, { access: "ghu_owner_login" }, "ana");
  const setMeta = (o = {}) => bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, repo: "ana/shop", repos: [{ repo: "ana/api", base: "main" }], status: "running", turn: 4, ...o }));
  await setMeta();
  const sent = [];
  const fetchFn = async (url, init = {}) => { sent.push({ url: String(url), method: init.method, auth: init.headers.authorization, headers: init.headers }); return new Response("{\"ok\":1}", { status: 200, headers: { "content-type": "application/json", "x-echo": "Bearer ghu_owner_login" } }); };
  const pass = await egressPass(env, UID + "/" + ID, "4");
  const call = (url, method = "GET", body) => handleEgress(new Request("https://gofarther.dev/api/coder/egress", { method: "POST", headers: { "x-coder-chat": UID + "/" + ID, "x-coder-turn": "4", "x-coder-egress": pass, "x-coder-url": url, "x-coder-method": method, "x-coder-headers": Buffer.from(JSON.stringify({ authorization: "token proxy-injected", accept: "application/vnd.github+json" })).toString("base64url") }, body }), env, { fetchFn });
  // THE CHAT'S REPOSITORIES: the owner's login, put in here.
  let r = await call("https://api.github.com/repos/ana/shop/pulls?state=open");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "{\"ok\":1}");
  assert.equal(r.headers.get("x-echo"), null, "a header carrying the login is not handed back");
  assert.deepEqual([sent[0].url, sent[0].method, sent[0].auth], ["https://api.github.com/repos/ana/shop/pulls?state=open", "GET", "Bearer ghu_owner_login"]);
  r = await call("https://api.github.com/repos/ANA/Api/issues/3/comments", "POST", "{\"body\":\"hi\"}");
  assert.equal(r.status, 200, "the chat's other repository too");
  // REFUSED, with Claude Code's messages.
  r = await call("https://api.github.com/graphql", "POST", "{}");
  assert.equal(r.status, 403);
  assert.equal((await r.json()).message, GRAPHQL_REFUSED);
  assert.match(GRAPHQL_REFUSED, /^GitHub GraphQL is not available from Coder's sessions\. Use GitHub's REST API instead: gh api repos\/\{owner\}\/\{repo\}\//);
  // (Claude Code's cloud words since round 3, the owner: "use the same claude code wording".)
  for (const [u, said] of [["https://api.github.com/repos/someone/else", "GitHub access to this repository is not enabled for this session. To request access, ask the owner to add it to this chat (+ Repository)."], ["https://api.github.com/user", "This GitHub API path is not available: sessions are bound to their configured repositories. Use repository-scoped endpoints (repos/{owner}/{repo}/...)."], ["https://api.github.com/repos/ana/shop/../../user", "This GitHub API path is not available: sessions are bound to their configured repositories. Use repository-scoped endpoints (repos/{owner}/{repo}/...)."], ["https://api.github.com/search/code?q=x", "This GitHub API path is not available: sessions are bound to their configured repositories. Use repository-scoped endpoints (repos/{owner}/{repo}/...)."]]) {
    const x = await call(u);
    assert.equal(x.status, 403, u);
    assert.equal((await x.json()).message, said, u);
  }
  assert.equal(sent.length, 2, "nothing refused reached GitHub");
  // A JOB GITHUB STARTED: read only. A job that is not running: nothing.
  await setMeta({ jobFromGithub: true });
  assert.equal((await call("https://api.github.com/repos/ana/shop/pulls")).status, 200);
  r = await call("https://api.github.com/repos/ana/shop/issues/1/comments", "POST", "{}");
  assert.equal(r.status, 403);
  assert.match((await r.json()).message, /a job started from GitHub may only read through gh/);
  await setMeta({ status: "idle" });
  assert.equal((await call("https://api.github.com/repos/ana/shop")).status, 403);
});

test("CD174 on the machine: a GitHub chat's commands see GH_TOKEN and GITHUB_TOKEN as Claude Code's placeholder proxy-injected (the owner's own token, if they set one, passes through), and its gate turns gh on", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(s, /const githubOn = !!body\.repo && !!\(body\.egress && typeof body\.egress\.pass === "string" && body\.egress\.pass\);\n\s+if \(githubOn && !ownerVars\.GH_TOKEN && !ownerVars\.GITHUB_TOKEN\) Object\.assign\(extraEnv, \{ GH_TOKEN: "proxy-injected", GITHUB_TOKEN: "proxy-injected" \}\);/);
  assert.match(s, /if \(secretList\.length \|\| net\.limited \|\| githubOn\) \{/);
  assert.match(s, /px\.setGithub\(githubOn\);/);
  assert.match(s, /p0\.setGithub\(false\);/);
  const { MACHINE_TOOLS } = await import("../container/coder-agent.mjs");
  assert.match(MACHINE_TOOLS, /gh \(it uses the owner's GitHub login, added by Coder's server, for this chat's own repositories only, like Claude Code's: gh api repos\/OWNER\/REPO\/\.\.\. and other REST calls work; gh pr and gh issue use GitHub's GraphQL, which is refused/);
});

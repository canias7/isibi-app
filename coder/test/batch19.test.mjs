// Claude Code fixes, batch 19.
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

const M = await import("../src/coder-mentions.mjs");
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })), truncated: false }; } };
}
const repo = { full_name: "ana/shop", id: 1 };

test("B19 M-d-13 / L-server-45: @coder is heard in a submitted review's summary and a new issue; @coder-bot is not a mention", () => {
  const review = (body, sender = { login: "ana", type: "User" }) => ({ action: "submitted", repository: repo, installation: { id: 7 }, sender,
    review: { body, state: "changes_requested" }, pull_request: { number: 4, title: "Fix", head: { ref: "feature-x", repo: { id: 1 } } } });
  const m = M.readMention("pull_request_review", review("@coder rename x"));
  assert.equal(m.number, 4); assert.equal(m.isPr, true); assert.equal(m.headRef, "feature-x"); assert.equal(m.login, "ana"); assert.match(m.extra, /a review \(changes requested\)/);
  assert.equal(M.readMention("pull_request_review", review("@coder rename x", { login: "x[bot]", type: "Bot" })), null, "bots never wake Coder");
  assert.equal(M.readMention("pull_request_review", review("please rename x")), null);
  // A review without @coder still goes to auto-fix, and one with it is left to the mention.
  assert.equal(M.readAutofix("pull_request_review", review("please rename x")).kind, "review");
  assert.equal(M.readAutofix("pull_request_review", review("@coder rename x")), null);
  const issue = (title, body) => ({ action: "opened", repository: repo, installation: { id: 7 }, sender: { login: "ana", type: "User" }, issue: { number: 9, title, body } });
  assert.equal(M.readMention("issues", issue("@coder add dark mode", "")).number, 9);
  assert.equal(M.readMention("issues", issue("Dark mode", "@coder please add it")).isPr, false);
  assert.equal(M.readMention("issues", issue("Dark mode", "no mention")), null);
  assert.equal(M.readMention("issues", { ...issue("@coder x", ""), action: "edited" }), null);
  for (const t of ["@coder-bot do it", "@coder_x do it", "@coders do it"]) assert.equal(M.MENTION.test(t), false, t);
  for (const t of ["@coder do it", "hi @coder, do it", "(@coder)"]) assert.equal(M.MENTION.test(t), true, t);
});

test("B19 L-server-15: @coder and a review for auto-fix need write access, asked of GitHub each time", async () => {
  const setup = (role) => {
    const b = fakeBucket();
    b.m.set(M.loginKey("ana"), JSON.stringify({ uid: "u1" }));
    b.m.set("coder/u1/github.json", JSON.stringify({ login: "ana" }));
    b.m.set(M.profileKey("u1"), JSON.stringify({ email: "me@x.y" }));
    b.m.set(M.branchKey("ana/shop", "coder/shop-1"), JSON.stringify({ uid: "u1", id: "shop-1" }));
    const asked = [];
    const fetchFn = async (url) => {
      url = String(url);
      if (/access_tokens$/.test(url)) return new Response(JSON.stringify({ token: "ghs_app" }), { status: 201 });
      if (/\/collaborators\/ana\/permission$/.test(url)) { asked.push(url); return role ? new Response(JSON.stringify({ role_name: role })) : new Response("{}", { status: 404 }); }
      return new Response(JSON.stringify({ id: 77 }), { status: 201 });
    };
    const posts = [];
    const coder = async (req) => { const u = new URL(req.url); if (req.method === "POST") posts.push(u.pathname); if (u.pathname === "/api/coder/projects/shop-1") return Response.json({ ok: true, project: { id: "shop-1", status: "idle", autofix: true, autofixTries: 0 } }); return Response.json({ ok: true, project: { id: "new" } }); };
    const env = { CODER_USERS: "me@x.y", CODER_BUCKET: b, CODER_GITHUB_APP_ID: "1", CODER_GITHUB_APP_PRIVATE_KEY: privateKey };
    return { b, env, deps: { fetchFn, coder }, asked, posts };
  };
  const m = { repo: "ana/shop", number: 5, isPr: false, text: "@coder do it", login: "ana", installation: 7, extra: "" };
  const f = { kind: "review", repo: "ana/shop", branch: "coder/shop-1", number: 3, login: "ana", text: "rename", installation: 7 };
  for (const role of ["read", "triage", null]) {
    let s = setup(role);
    assert.deepEqual(await M.startMention(s.env, s.deps, m), { ok: false, why: "no write access" }, String(role));
    assert.equal(s.asked.length, 1); assert.deepEqual(s.posts, []);
    assert.equal([...s.b.m.keys()].some((k) => k.startsWith("coder/github-jobs/")), false);
    s = setup(role);
    assert.equal((await M.startAutofix(s.env, s.deps, f)).why, "no write access");
  }
  for (const role of ["write", "maintain", "admin"]) {
    const s = setup(role);
    assert.equal((await M.startMention(s.env, s.deps, m)).ok, true, role);
    assert.equal((await M.startAutofix(s.env, setup(role).deps, f)).ok, true, role);
  }
  // No app token: nothing to ask GitHub with, so no.
  const s = setup("write"); delete s.env.CODER_GITHUB_APP_PRIVATE_KEY;
  assert.equal((await M.startMention(s.env, s.deps, m)).why, "no write access");
});

test("B19 M-d-33: a pull request GitHub would not open says GitHub's own reason and links to GitHub", async () => {
  const G = await import("../src/coder-github.mjs");
  const E = await import("../src/coder-envapi.mjs");
  const refuse = (status, data) => async (url, init = {}) => {
    if ((init.method || "GET") === "POST") return new Response(JSON.stringify(data), { status });
    return new Response("[]", { status: 200 });
  };
  const no = await G.openPullRequest("t", "ana/shop", { head: "coder/x", base: "main", title: "T", body: "B" }, refuse(422, { message: "Validation Failed", errors: [{ resource: "PullRequest", code: "custom", message: "No commits between main and coder/x" }] }));
  assert.equal(no.number, undefined);
  assert.equal(no.why, "Validation Failed: No commits between main and coder/x");
  assert.equal(G.prFailNote("ana/shop", "main", "coder/x", no), "Validation Failed: No commits between main and coder/x. Open it on GitHub: https://github.com/ana/shop/compare/main...coder/x");
  assert.equal(G.prFailNote("ana/shop", "main", "coder/x", { why: "" }, "a guess"), "a guess. Open it on GitHub: https://github.com/ana/shop/compare/main...coder/x");
  const bucket = fakeBucket();
  const meta = { id: "c1", repo: "ana/shop", base: "main", branch: "coder/x" };
  const r = await E.prOpenNow({}, bucket, "u1", "c1", meta, { title: "T" }, { token: "t", fetchFn: refuse(403, { message: "Resource not accessible by integration" }) });
  assert.match(r.error, /^error: GitHub did not open the pull request: Resource not accessible by integration\. Open it on GitHub: https:\/\/github\.com\/ana\/shop\/compare\/main\.\.\.coder\/x$/);
  assert.equal(bucket.m.size, 0, "nothing saved as the chat's pull request");
  // A successful open is unchanged.
  const ok = await G.openPullRequest("t", "ana/shop", { head: "coder/x", base: "main", title: "T", body: "B" }, async () => new Response(JSON.stringify({ html_url: "https://github.com/ana/shop/pull/2", number: 2 }), { status: 201 }));
  assert.deepEqual(ok, { url: "https://github.com/ana/shop/pull/2", number: 2 });
});

test("B19 L-server-44 / M-g-19: the repository list reads every page, says when some are missing, and when single sign-on hides some", async () => {
  const { listRepos } = await import("../src/coder-github.mjs");
  const J = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers });
  const repos = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ full_name: "ana/r" + (from + i), default_branch: "main", private: true }));
  const many = async (u) => {
    u = String(u);
    if (u.includes("/user/installations?")) return J({ total_count: 1, installations: [{ id: 1 }] });
    const page = Number(/[?&]page=(\d+)/.exec(u)[1]);
    return J({ total_count: 230, repositories: page === 1 ? repos(100) : page === 2 ? repos(100, 100) : page === 3 ? repos(30, 200) : [] });
  };
  const all = await listRepos("t", many);
  assert.equal(all.length, 230); assert.equal(all.partial, undefined); assert.equal(all[229].repo, "ana/r229");
  const brokenPage2 = async (u) => (/[?&]page=2/.test(String(u)) && String(u).includes("/repositories") ? J({ message: "boom" }, 500) : many(u));
  const some = await listRepos("t", brokenPage2);
  assert.equal(some.length, 100); assert.equal(some.partial, true);
  // One organization refused by single sign-on: the rest are still listed, and the list says so.
  const sso = async (u) => {
    u = String(u);
    if (u.includes("/user/installations?")) return J({ installations: [{ id: 1 }, { id: 2 }] });
    if (u.includes("/installations/2/")) return J({ message: "Resource protected by organization SAML enforcement." }, 403, { "x-github-sso": "required; url=https://github.com/orgs/acme/sso?authorization_request=x" });
    return J({ repositories: repos(2) });
  };
  const s = await listRepos("t", sso);
  assert.deepEqual(s.map((r) => r.repo), ["ana/r0", "ana/r1"]); assert.equal(s.ssoHidden, true);
  // The route passes both on; the page shows a line for each, with a button to connect GitHub again.
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /\.\.\.\(repos\.partial \? \{ partial: true \} : \{\}\), \.\.\.\(repos\.ssoHidden \? \{ ssoHidden: true \} : \{\}\)/);
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(ui, /S\.reposPartial = !!\(r\.data && r\.data\.partial\); S\.reposSso = !!\(r\.data && r\.data\.ssoHidden\);/);
  assert.match(ui, /Your GitHub organization requires single sign-on, so some of its repositories are hidden\. Connect GitHub again and click Authorize next to your organization\./);
  assert.match(ui, /Some repositories could not be listed\. Type owner\/name to open one\./);
  assert.match(ui, /on\('#cdReconnectGh', 'click', connect\);/);
});

test("B19 M-r2-07 after the machine stops mid-step, the round is kept: finished steps keep their results, the running one is marked outcome unknown", async () => {
  const L = await import("../src/coder-live.mjs");
  const call = (id, name) => ({ id, type: "function", function: { name, arguments: "{}" } });
  const before = [{ role: "user", content: "go" }, { role: "assistant", content: "", tool_calls: [call("a", "bash")] }, { role: "tool", tool_call_id: "a", content: "ok" }];
  const round = { role: "assistant", content: "", tool_calls: [call("b", "bash"), call("c", "mcp__notion__search")] };
  const r = L.interruptedSteps([...before, round, { role: "tool", tool_call_id: "b", content: "file.txt" }]);
  assert.deepEqual(r.cut, ["mcp__notion__search"]);
  assert.deepEqual(r.messages.slice(0, 5), [...before, round, { role: "tool", tool_call_id: "b", content: "file.txt" }], "the finished ls keeps its real result");
  assert.deepEqual(r.messages[5], { role: "tool", tool_call_id: "c", content: L.INTERRUPTED });
  assert.equal(r.messages.length, 6);
  // Every call of a round answered: unchanged. None: each one marked.
  assert.deepEqual(L.interruptedSteps(before), { messages: before, cut: [] });
  const none = L.interruptedSteps([...before, round]);
  assert.deepEqual(none.cut, ["bash", "mcp__notion__search"]);
  assert.deepEqual(none.messages.slice(4).map((m) => m.tool_call_id), ["b", "c"]);
});

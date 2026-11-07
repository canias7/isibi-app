// READ-ONLY REPOSITORIES, LIKE CLAUDE CODE (owner, 2026-11-07, item 5: "Coder only uses ones it can write
// to"). Claude Code's docs (read 2026-11-07): "a session can clone any public repository, but can work in a
// private repository only when the Claude GitHub App is installed on it", and it can "push back to a GitHub
// remote only when your GitHub connection has push access to that repository". Here: any repository the
// owner can read opens; one they cannot push to is read-only, and Coder's work stays on its machine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
const HERE = (p) => new URL("../" + p, import.meta.url);
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const UID = "user-1234567890abcdef";

/** "GitHub": oss/lib with README.md on main and a branch `feature`; and an empty oss/blank. */
async function fakeGithub() {
  const gh = await mkdtemp(join(tmpdir(), "coder-gh-"));
  const work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# lib\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  git(work, "checkout", "-q", "-b", "feature");
  await writeFile(join(work, "feature.txt"), "a feature\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "a feature");
  await mkdir(join(gh, "oss"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "oss", "lib.git")]);
  execFileSync("git", ["init", "-q", "--bare", join(gh, "oss", "blank.git")]);
  return { remote: gh + "/", bare: join(gh, "oss", "lib.git"), blank: join(gh, "oss", "blank.git") };
}

test("CD176 on the machine: a read-only chat's work is committed on its branch and never pushed; See changes and the patch come from the machine's own git (against the main branch or any other, fetched when needed); an empty read-only repository is started here only", async () => {
  const S = await import("../container/server.mjs");
  const { remote, bare, blank } = await fakeGithub();
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const dir = join(root, "lib-ro12");
  const o = { repo: "oss/lib", branch: "coder/lib-ro12", token: "", remote, gitRoot, root };
  assert.equal((await S.prepareRepo({ ...o, dir, base: "main", noPush: true })).ok, true);
  await writeFile(join(dir, "fix.js"), "export const fixed = true;\n");
  const p = await S.pushRepo({ ...o, dir, message: "Fixed the thing", noPush: true });
  assert.deepEqual([p.ok, p.pushed, p.kept, p.changed, /^[0-9a-f]{40}$/.test(p.sha)], [true, false, true, true, true]);
  assert.equal(git(bare, "branch", "--list", "coder/*").trim(), "", "nothing reached GitHub");
  assert.match(git(dir, "log", "--oneline", "-1"), /Fixed the thing/, "committed here, on the chat's branch");
  const again = await S.pushRepo({ ...o, dir, message: "x", noPush: true });
  assert.deepEqual([again.ok, again.kept, again.changed], [true, true, false], "nothing new: nothing committed");
  // SEE CHANGES, from the machine, as GitHub's compare would show them.
  const c = await S.localChanges({ ...o, dir, against: "main" });
  assert.equal(c.ok, true);
  assert.deepEqual(c.files.map((f) => [f.path, f.add, f.del]), [["fix.js", 1, 0]]);
  assert.match(c.files[0].patch, /^@@ -0,0 \+1 @@\n\+export const fixed = true;$/);
  // Against another branch: fetched first (this machine had only main), then compared as GitHub's compare
  // does (what the chat's branch changed since the two parted: feature's own file is not the chat's change).
  const gd = S.gitDirFor(dir, gitRoot);
  assert.throws(() => git(dir, "--git-dir=" + gd, "rev-parse", "--verify", "-q", "refs/remotes/origin/feature"));
  const f = await S.localChanges({ ...o, dir, against: "feature" });
  assert.equal(f.ok, true, f.why);
  assert.deepEqual(f.files.map((x) => x.path), ["fix.js"]);
  assert.match(git(dir, "--git-dir=" + gd, "rev-parse", "--verify", "refs/remotes/origin/feature"), /^[0-9a-f]{40}\n$/, "fetched");
  for (const b of ["-x", "../main", "/etc", "a..b"]) assert.equal((await S.localChanges({ ...o, dir, against: b })).ok, false, b);
  assert.match((await S.localChanges({ ...o, dir, against: "nope" })).why, /has no branch named nope/);
  // THE PATCH FILE: git am puts the work on a fresh copy of main.
  const pt = await S.localPatch({ dir, base: "main", gitRoot, root, remote });
  assert.equal(pt.ok, true);
  assert.match(pt.patch, /^From [0-9a-f]{40} /);
  assert.match(pt.patch, /Subject: \[PATCH\] Fixed the thing/);
  const other = await mkdtemp(join(tmpdir(), "coder-apply-"));
  execFileSync("git", ["clone", "-q", "-b", "main", bare, other]);
  await writeFile(join(other, "work.patch"), pt.patch);
  git(other, "-c", "user.name=b", "-c", "user.email=b@c", "am", "-q", "work.patch");
  assert.equal(await readFile(join(other, "fix.js"), "utf8"), "export const fixed = true;\n");
  // AN EMPTY READ-ONLY REPOSITORY: its start is made here only.
  const dir2 = join(root, "blank-ro34");
  assert.equal((await S.prepareRepo({ dir: dir2, repo: "oss/blank", base: "main", branch: "coder/blank-ro34", token: "", remote, gitRoot, root, noPush: true })).ok, true);
  assert.equal(git(blank, "for-each-ref").trim(), "", "nothing pushed to the empty repository");
  assert.match(git(dir2, "log", "--oneline", "-1"), /Start/);
  // splitDiff: a renamed, a deleted and a binary file.
  assert.deepEqual(S.splitDiff("diff --git a/a.txt b/b.txt\nsimilarity index 100%\nrename from a.txt\nrename to b.txt\ndiff --git a/gone.js b/gone.js\ndeleted file mode 100644\n--- a/gone.js\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\ndiff --git a/p.png b/p.png\nBinary files a/p.png and b/p.png differ\n"),
    [{ path: "b.txt", add: 0, del: 0, patch: "" }, { path: "gone.js", add: 0, del: 1, patch: "@@ -1 +0,0 @@\n-x" }, { path: "p.png", add: 0, del: 0, patch: "" }]);
});

/** A Worker with one connected owner; GitHub answers as `gh` says; the machine as `box` says. */
async function worker({ gh, box = {} }) {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const asked = [];
  const deps = {
    fetchFn: gh, authUser: async () => ({ id: UID, email: "me@x.y" }),
    container: () => ({ fetch: async (req) => {
      const u = new URL(req.url);
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : null;
      asked.push([u.pathname, body]);
      const f = box[u.pathname];
      return f ? f(body) : Response.json({ ok: true });
    } }),
  };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  return { go, bucket, env, asked };
}
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

test("CD177 the Worker: any repository the owner can read opens (a public one GitHub keeps from their login is read with no login), read-only where they cannot push; a read-only chat's job is committed on the machine and said so, with no pull request, auto-fix or GitHub branch; See changes and the patch come from the machine", async () => {
  const seen = [];
  const gh = async (url, init = {}) => {
    const u = String(url), auth = init.headers && init.headers.authorization;
    seen.push([u, !!auth]);
    if (u === "https://api.github.com/repos/oss/lib") return auth ? J({ message: "Not Found" }, 404) : J({ full_name: "oss/lib", default_branch: "main", private: false });
    if (u === "https://api.github.com/repos/ana/shop") return J({ default_branch: "main", permissions: { push: true } });
    return J({ message: "Not Found" }, 404);
  };
  let result = null;
  const { go, bucket, asked } = await worker({ gh, box: {
    "/state": () => J({ running: false, events: [], next: 0, result }),
    "/claim": () => J({ ok: true }),
    "/push": () => J({ ok: true, pushed: false, kept: true, changed: true, sha: "c0ffee0" + "0".repeat(33) }),
    "/diff": () => J({ ok: true, files: [{ path: "fix.js", add: 1, del: 0, patch: "@@ -0,0 +1 @@\n+x" }] }),
    "/patch": () => J({ ok: true, patch: "From abc Mon Sep 17 00:00:00 2001\nSubject: [PATCH] Fixed\n" }),
  } });
  // OPENING: a public repository GitHub keeps from the login: read with none; read-only.
  const made = await go("projects", { method: "POST", body: JSON.stringify({ repo: "oss/lib" }) });
  assert.equal(made.status, 200);
  const p = (await made.json()).project;
  assert.equal(p.readOnly, true);
  assert.deepEqual(seen.filter(([u]) => u.endsWith("/repos/oss/lib")), [["https://api.github.com/repos/oss/lib", true], ["https://api.github.com/repos/oss/lib", false]]);
  assert.equal([...bucket.m.keys()].some((k) => k.startsWith("coder/github-branches/")), false, "no branch for GitHub's news");
  const none = await go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/none" }) });
  assert.equal(none.status, 404);
  assert.match((await none.json()).error, /^GitHub shows you no repository named ana\/none\. For a private one, add it to Coder in GitHub first\.$/);
  // A JOB ENDS: committed on the machine (never pushed), and said so.
  const k = (f) => "coder/" + UID + "/" + p.id + "/" + f;
  await bucket.put(k("meta.json"), JSON.stringify({ ...p, turn: 1, saved: 0, status: "running", at: Date.now() }));
  result = { status: "done", messages: [{ role: "user", content: "fix it" }, { role: "assistant", content: "Fixed." }], summary: "Fixed the thing", prRequest: { title: "Fix", body: "x" } };
  const st = await (await go("projects/" + p.id + "/state?since=0")).json();
  const push = asked.find(([path]) => path === "/push")[1];
  assert.equal(push.noPush, true, "the machine is told not to push");
  assert.deepEqual([st.project.pushed, st.project.kept, st.project.commits.map((c) => c.sha.slice(0, 7))], [false, true, ["c0ffee0"]]);
  const said = JSON.parse(bucket.m.get(k("events.json"))).map((e) => e.text).join("\n");
  assert.match(said, /Kept on Coder's machine \(you can read oss\/lib but not push to it, so nothing went to GitHub\)\. See changes shows it, and downloads it as a patch file\./);
  assert.match(said, /No pull request: you can read oss\/lib but not push to it, so Coder cannot open one there\./);
  assert.equal(seen.some(([u]) => /\/pulls/.test(u)), false, "GitHub was never asked for a pull request");
  // THE BUTTONS: no pull request; auto-fix refused.
  const pr = await go("projects/" + p.id + "/pr", { method: "POST", body: "{}" });
  assert.deepEqual([pr.status, (await pr.json()).error], [409, "No pull request: you can read oss/lib but not push to it, so Coder cannot open one there."]);
  const { autofixFor } = await import("../src/coder-routes.mjs");
  assert.match((await autofixFor({}, bucket, UID, { ...p }, { pr: "3" }, "tok", gh)).note, /^Auto-fix was not turned on: you can read oss\/lib but not push to it/);
  // SEE CHANGES and THE PATCH: from the machine.
  const ch = await (await go("projects/" + p.id + "/changes?against=main")).json();
  assert.deepEqual([ch.local, ch.add, ch.files[0].path], [true, 1, "fix.js"]);
  assert.equal(asked.find(([path]) => path === "/diff")[1].against, "main");
  const pf = await go("projects/" + p.id + "/patch");
  assert.equal(pf.status, 200);
  assert.equal(pf.headers.get("content-disposition"), "attachment; filename=\"lib-" + p.id + ".patch\"");
  assert.match(await pf.text(), /^From abc/);
  // A chat the owner can push to: its work is on GitHub, not in a patch.
  const w = await (await go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/shop" }) })).json();
  assert.equal(w.project.readOnly, undefined);
  assert.equal((await go("projects/" + w.project.id + "/patch")).status, 400);
});

test("CD178 Coder's git address: a read-only repository is never pushed to; a public one GitHub refuses the login for is read with no login; a writable chat's refusal stays a refusal", async () => {
  const G = await import("../src/coder-git.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const ID = "lib-ro12";
  const setMeta = (o) => bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, repo: "oss/lib", base: "main", branch: "coder/" + ID, turn: 2, readOnly: true, ...o }));
  await setMeta({});
  const now = Date.now();
  const acc = await G.gitAccess(env, UID, ID, 2, now);
  const H = Object.fromEntries(acc.headers.map((h) => [h.slice(0, h.indexOf(": ")), h.slice(h.indexOf(": ") + 2)]));
  const calls = [];
  const fetchFn = async (url, init = {}) => { calls.push(!!(init.headers && init.headers.authorization)); return init.headers && init.headers.authorization ? new Response("no", { status: 404 }) : new Response("refs", { status: 200 }); };
  const ask = (path, o = {}) => G.handleGit(new Request("https://coder.gofarther.dev" + path, { method: o.method || "GET", headers: H, ...(o.body ? { body: o.body } : {}) }), env, { fetchFn, now });
  const r = await ask("/api/coder/git/oss/lib.git/info/refs?service=git-upload-pack");
  assert.deepEqual([r.status, await r.text(), calls], [200, "refs", [true, false]], "with the login first, then with none");
  calls.length = 0;
  const push = await ask("/api/coder/git/oss/lib.git/git-receive-pack", { method: "POST", body: "0000" });
  assert.equal(push.status, 403);
  assert.match(await push.text(), /^you can read oss\/lib but not push to it/);
  assert.deepEqual(calls, [], "GitHub never asked");
  // A chat the owner may push to: GitHub's refusal is passed on (no second try without the login).
  await setMeta({ readOnly: false });
  const w = await ask("/api/coder/git/oss/lib.git/info/refs?service=git-upload-pack");
  assert.deepEqual([w.status, calls], [404, [true]]);
});

test("CD179 gh on a read-only repository only reads (nothing is written there as the owner); on the chat's other repositories, each as it is", async () => {
  const { handleEgress, egressPass } = await import("../src/coder-egress.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_TOKEN_KEY: KEY, CODER_BUCKET: bucket };
  const ID = "lib-ro12";
  await saveConnection(env, bucket, UID, { access: "ghu_owner" }, "ana");
  await bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, repo: "oss/lib", readOnly: true, repos: [{ repo: "ana/app", base: "main" }, { repo: "oss/other", base: "main", readOnly: true }], status: "running", turn: 2 }));
  const sent = [];
  const fetchFn = async (url, init = {}) => { sent.push([String(url), init.method]); return new Response("{}", { status: 200 }); };
  const pass = await egressPass(env, UID + "/" + ID, "2");
  const call = (url, method) => handleEgress(new Request("https://gofarther.dev/api/coder/egress", { method: "POST", headers: { "x-coder-chat": UID + "/" + ID, "x-coder-turn": "2", "x-coder-egress": pass, "x-coder-url": url, "x-coder-method": method, "x-coder-headers": Buffer.from("{}").toString("base64url") }, body: method === "GET" ? undefined : "{}" }), env, { fetchFn });
  assert.equal((await call("https://api.github.com/repos/oss/lib/issues", "GET")).status, 200);
  for (const u of ["https://api.github.com/repos/oss/lib/issues", "https://api.github.com/repos/OSS/Other/issues/1/comments"]) {
    const r = await call(u, "POST");
    assert.equal(r.status, 403, u);
    assert.match(await r.text(), /but not push to it, so gh may only read it$/);
  }
  assert.equal((await call("https://api.github.com/repos/ana/app/issues", "POST")).status, 200, "a repository they may push to");
  assert.deepEqual(sent.map(([u, m]) => m + " " + u), ["GET https://api.github.com/repos/oss/lib/issues", "POST https://api.github.com/repos/ana/app/issues"]);
});

test("CD180 Coder is told when a repository is read-only, and its pull_request and auto_fix tools refuse there (a writable other repository still gets its pull request)", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const { readOnlyNote, extrasNote } = await import("../container/server.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const run = async (calls, opts) => {
    let i = 0;
    const steps = [{ message: { role: "assistant", content: "", tool_calls: calls } }, { message: { role: "assistant", content: "Done." } }];
    return runCoder({ send: async () => steps[i++], exec: async () => ({ code: 0, output: "" }) }, { text: "go", ...opts });
  };
  let r = await run([call("pull_request", { title: "Fix", body: "x" }, "p1"), call("auto_fix", { pr: "3" }, "a1")], { readOnly: { main: true, extra: [] } });
  assert.equal(r.prRequest, undefined);
  assert.equal(r.autofixRequest, undefined);
  assert.match(r.messages.find((m) => m.tool_call_id === "p1").content, /^error: the owner can read this repository but not push to it, so no pull request can be opened/);
  assert.match(r.messages.find((m) => m.tool_call_id === "a1").content, /^error: the owner can read this repository but not push to it/);
  r = await run([call("pull_request", { title: "A", body: "x", repo: "oss/other" }, "p1"), call("pull_request", { title: "B", body: "y", repo: "ana/app" }, "p2")], { readOnly: { main: false, extra: ["oss/other"] } });
  assert.deepEqual(r.prExtra, [{ title: "B", body: "y", repo: "ana/app" }]);
  assert.match(readOnlyNote({ readOnly: true, repo: "oss/lib" }), /^\n\nREAD-ONLY REPOSITORY: the owner can read oss\/lib on GitHub but cannot push to it\. Work as usual: when your turn ends your changes are committed to this chat's branch HERE/);
  assert.equal(readOnlyNote({ repo: "ana/shop" }), "");
  assert.match(extrasNote([{ repo: "oss/other", dir: "/work/x-x1", base: "main", readOnly: true }]), /- oss\/other in \/work\/x-x1 \(from main\) \(READ-ONLY for the owner: kept on this machine, never sent to GitHub; no pull request\)/);
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /extrasNote\(extras\) \+ gitNote\(body\) \+ readOnlyNote\(body\) \+/);
  assert.match(server, /readOnly: \{ main: body\.readOnly === true, extra: extras\.filter\(\(x\) => x\.readOnly\)\.map\(\(x\) => x\.repo\.toLowerCase\(\)\) \}/);
});

test("CD181 the page: open any public repository by owner/name or its address; read-only shown in the list and the chat; no pull request buttons there; the patch saved through the page's one door, as a data: address; @coder on GitHub still needs push access", async () => {
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  const src = /function repoName\(v\) \{[\s\S]*?\n  \}/.exec(ui)[0];
  const repoName = new Function(src + "; return repoName;")();
  for (const [typed, want] of [["oss/lib", "oss/lib"], [" https://github.com/oss/lib ", "oss/lib"], ["github.com/oss/lib.git", "oss/lib"], ["https://www.github.com/oss/lib/tree/main/src", "oss/lib"], ["https://github.com/oss/lib/pull/3", "oss/lib"], ["oss", ""], ["https://evil.example/oss/lib", ""], ["a/b/c d", ""]]) assert.equal(repoName(typed), want, typed);
  assert.match(ui, /<form class="cd-open" id="cdOpenForm"><label for="cdOpenRepo">Or open any public repository<\/label>/);
  assert.match(ui, /\(r\.readOnly \? '<em title="You can read it but not push to it">read-only<\/em>' : ''\)/);
  assert.match(ui, /\(p && p\.readOnly \? '<span class="cd-ro" title="You can read this repository on GitHub but not push to it/);
  assert.match(ui, /\(p && !p\.readOnly && !\(p\.pr && p\.pr\.url\) && Array\.isArray\(p\.commits\)/);
  assert.match(ui, /const r = await call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/patch', \{ file: 'coder\.patch' \}\);/);
  assert.match(ui, /fr\.readAsDataURL\(r\.blob\)/);
  assert.match(readFileSync(HERE("public/coder.css"), "utf8"), /\.cd-ro \{/);
  assert.match(readFileSync(HERE("src/coder-mentions.mjs"), "utf8"), /run\("projects", \{ method: "POST", body: JSON\.stringify\(\{ repo: m\.repo, needPush: true,/);
  // The repository list says which ones are read-only.
  const { listRepos } = await import("../src/coder-github.mjs");
  const list = await listRepos("t", async (u) => J(String(u).includes("/user/installations?") ? { installations: [{ id: 1 }] } : { repositories: [{ full_name: "ana/a", default_branch: "main", private: true, permissions: { push: true } }, { full_name: "ana/b", default_branch: "dev", private: false, permissions: { push: false } }] }));
  assert.deepEqual(list, [{ repo: "ana/a", branch: "main", private: true }, { repo: "ana/b", branch: "dev", private: false, readOnly: true }]);
});

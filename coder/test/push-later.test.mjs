// PUSHED AT A STOPPING POINT, AND NO LOOK AT GITHUB ON EVERY MESSAGE (owner, 2026-11-16; Claude Code's cloud sessions:
// "when Claude reaches a stopping point, it pushes its branch to GitHub", and it clones the repository once per session).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();

/** "GitHub": ana/shop, with README.md on main. */
async function fakeGithub() {
  const gh = await mkdtemp(join(tmpdir(), "coder-gh-"));
  const work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(gh, "ana"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "ana", "shop.git")]);
  return { remote: gh + "/", bare: join(gh, "ana", "shop.git") };
}

test("PL1 the machine: the chat's copy is used as it is once brought up to date for its branch (no look at GitHub), unless a fresh look is asked for; a turn's end commits without pushing and counts what GitHub lacks; a push sends it all", async () => {
  const S = await import("../container/server.mjs");
  const { remote, bare } = await fakeGithub();
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const dir = join(root, "shop-pl01"), branch = "coder/shop-pl01";
  const gd = S.gitDirFor(dir, gitRoot);
  const o = { gitDir: gd, remote, root };
  // THE FIRST MESSAGE clones, and marks the copy as up to date for the chat's branch.
  const first = await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root, refresh: false });
  assert.equal(first.ok, true, first.why);
  assert.equal(first.asIs, undefined, "a new copy is always cloned");
  assert.equal((await readFile(join(gd, S.FETCHED_MARK), "utf8")).trim(), branch);
  // LATER MESSAGES: GitHub is not asked at all (here it is not even there), and the copy is used as it is.
  const gone = "file:///nonexistent-" + Date.now() + "/";
  const later = await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote: gone, gitRoot, root, refresh: false });
  assert.deepEqual([later.ok, later.asIs], [true, true]);
  // A FRESH LOOK (a job from GitHub, a moved branch): GitHub is asked again; away, the copy is kept with a note or refused.
  const fresh = await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote: gone, gitRoot, root, refresh: true, netWaits: [] });
  assert.notEqual(fresh.asIs, true, "a fresh look was asked for");
  assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root })).ok, true, "the default still looks (older callers)");
  // ANOTHER BRANCH than the one the copy was brought up to date for: looked at again.
  const other = await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch: "coder/elsewhere", token: "", remote: gone, gitRoot, root, refresh: false, netWaits: [] });
  assert.notEqual(other.asIs, true);
  assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root })).ok, true);

  // THE TURN'S END: committed here only.
  await writeFile(join(dir, "a.txt"), "one\n");
  const c1 = await S.pushRepo({ dir, repo: "ana/shop", branch, message: "Add a", token: "", remote, gitRoot, root, commitOnly: true });
  assert.deepEqual([c1.ok, c1.local, c1.pushed, c1.changed, c1.unpushed], [true, true, false, true, 1]);
  assert.match(c1.sha, /^[0-9a-f]{40}$/);
  assert.deepEqual(c1.files, ["a.txt"]);
  assert.throws(() => git(bare, "rev-parse", "--verify", "-q", "refs/heads/" + branch), "nothing reached GitHub");
  await writeFile(join(dir, "b.txt"), "two\n");
  const c2 = await S.pushRepo({ dir, repo: "ana/shop", branch, message: "Add b", token: "", remote, gitRoot, root, commitOnly: true });
  assert.equal(c2.unpushed, 2);
  const none = await S.pushRepo({ dir, repo: "ana/shop", branch, message: "nothing", token: "", remote, gitRoot, root, commitOnly: true });
  assert.deepEqual([none.changed, none.unpushed], [false, 2], "a turn that changed nothing still counts what waits");
  // THE PUSH: both commits reach GitHub, and nothing is left unpushed.
  const p = await S.pushRepo({ dir, repo: "ana/shop", branch, message: "", token: "", remote, gitRoot, root });
  assert.deepEqual([p.ok, p.pushed, p.unpushed], [true, true, 0]);
  assert.equal(git(bare, "log", "--format=%s", branch).split("\n").filter(Boolean).slice(0, 2).join("|"), "Add b|Add a");
  assert.equal(await S.unpushedCount(dir, o), 0);
  const again = await S.pushRepo({ dir, repo: "ana/shop", branch, message: "", token: "", remote, gitRoot, root });
  assert.deepEqual([again.ok, again.pushed, again.changed], [true, false, false], "nothing new: no push");
  // A READ-ONLY repository keeps its own flow: committed, never pushed (commitOnly or not).
  await writeFile(join(dir, "c.txt"), "three\n");
  const ro = await S.pushRepo({ dir, repo: "ana/shop", branch, message: "Add c", token: "", remote, gitRoot, root, noPush: true, commitOnly: true });
  assert.deepEqual([ro.kept, ro.local], [true, undefined]);
  // The job and the extra repositories pass the Worker's choice on; the push route passes commitOnly to all.
  const src = await readFile(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.equal((src.match(/refresh: body\.fetch !== false/g) || []).length, 2, "the chat's repository and its other ones");
  assert.equal((src.match(/noPush: x\.readOnly === true, commitOnly,/g) || []).length, 1);
});

test("PL2 the Worker's rules: which turn ends push, the safety net's defaults, when a job looks at GitHub first, a pushed record, and a disk with unpushed work is never reclaimed", async () => {
  const R = await import("../src/coder-routes.mjs");
  const F = await import("../src/coder-fly.mjs");
  assert.equal(R.PUSH_AFTER_COMMITS, 5);
  assert.equal(R.PUSH_AFTER_MS, 30 * 60 * 1000);
  // Pushed at once: Coder's push_branch, a pull request (here or in another repository), a review to post, review replies,
  // auto-fix asked for, and any job from GitHub.
  for (const r of [{ push: true }, { prRequest: { title: "x" } }, { prExtra: [{ repo: "a/b" }] }, { reviewPost: { body: "x" } }, { reviewReplies: [{ id: 1 }] }, { autofixRequest: { pr: "1" } }]) assert.equal(R.pushWanted(r, {}), true, JSON.stringify(r));
  assert.equal(R.pushWanted({}, { jobFromGithub: true }), true);
  // (owner, 2026-11-17, like Claude Code on the web) EVERY turn that changed files pushes; only a turn the machine is sure
  // changed nothing (`dirty: false`) and asked nothing of GitHub does not.
  assert.equal(R.pushWanted({ summary: "done" }, {}), true, "a turn that changed files (or may have) pushes");
  assert.equal(R.pushWanted({ summary: "done", dirty: false }, {}), false, "a turn that changed nothing does not");
  assert.equal(R.pushWanted({ prExtra: [], dirty: false }, {}), false);
  assert.equal(R.pushWanted({ dirty: false, push: true }, {}), true);
  // The safety net.
  const now = 10_000_000_000;
  assert.equal(R.safetyPushDue({ unpushed: 0 }, now), false);
  assert.equal(R.safetyPushDue({ unpushed: 4, unpushedSince: now - 60_000 }, now), false);
  assert.equal(R.safetyPushDue({ unpushed: 5, unpushedSince: now }, now), true, "five commits");
  assert.equal(R.safetyPushDue({ unpushed: 1, unpushedSince: now - R.PUSH_AFTER_MS }, now), true, "half an hour");
  assert.equal(R.safetyPushDue({ unpushed: 9, unpushedSince: 1, readOnly: true }, now), false, "never a read-only chat");
  // A look at GitHub first: the chat's first message, a job from GitHub (auto-fix, @coder, a review), a moved branch.
  assert.equal(R.fetchWanted({ turn: 0 }), true);
  assert.equal(R.fetchWanted({ turn: 3 }), false, "an ordinary message uses the copy as it is");
  assert.equal(R.fetchWanted({ turn: 3 }, { fromGithub: true }), true);
  assert.equal(R.fetchWanted({ turn: 3 }, { autofix: true }), true);
  assert.equal(R.fetchWanted({ turn: 3 }, { review: { text: "x" } }), true);
  assert.equal(R.fetchWanted({ turn: 3, refetch: true }), true);
  // After an undo or a rewind (which push), or a push: nothing left only on the machine.
  assert.deepEqual(R.pushedAll({ commits: [{ sha: "a", local: true }, { sha: "b" }], unpushed: 2 }), { pushed: true, unpushed: 0, unpushedSince: 0, commits: [{ sha: "a", local: undefined }, { sha: "b" }] });
  assert.deepEqual(R.pushedAll({ readOnly: true }), {});
  assert.equal(R.pushedNote({ branch: "coder/x" }, null), "Pushed to the branch coder/x");
  assert.equal(R.pushedNote({ branch: "coder/x" }, { number: 4 }), "Pushed to the branch coder/x · pull request #4 updated");
  // Fly.io's monthly reclaim never takes a disk with unpushed commits.
  const old = now - F.FLY_RECLAIM_MS - 1;
  assert.equal(F.reclaimable({ used: old }, now), true);
  assert.equal(F.reclaimable({ used: old, unpushed: 2 }, now), false);
  assert.equal(F.reclaimable({ used: now - 1000 }, now), false);
});

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("PL3 the Worker's routes: Push, Create PR and deleting a chat push its unpushed commits first; a failed push keeps the chat (unless deleted anyway); a read-only chat has no Push; See changes reads the machine while work is unpushed", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-pl03";
  const env0 = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev" };
  const setup = async (more = {}, answer = { ok: true, pushed: true, unpushed: 0, sha: "f9" }) => {
    const bucket = fakeBucket();
    const env = { ...env0, CODER_BUCKET: bucket };
    await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
    const meta = { id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 2, status: "idle", commits: [{ sha: "a1", turn: 1, title: "One" }, { sha: "b2", turn: 2, title: "Two", local: true }], pushed: true, unpushed: 1, unpushedSince: 5, ...more };
    await bucket.put("coder/" + uid + "/" + id + "/meta.json", JSON.stringify(meta));
    await bucket.put("coder/" + uid + "/" + id + "/events.json", "[]");
    const asked = [], marked = [];
    const fetchFn = async (url, init = {}) => {
      const u = String(url);
      if (u.endsWith("/pulls") && init.method === "POST") return Response.json({ number: 7, html_url: "https://github.com/ana/shop/pull/7" }, { status: 201 });
      return Response.json({ message: "Not Found" }, { status: 404 });
    };
    const deps = { fetchFn, authUser: async () => ({ id: uid, email: "me@x.y" }), markUnpushed: (name, n) => { marked.push([name, n]); }, dropMachine: async () => { asked.push(["drop"]); }, container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; asked.push([p, req.method === "POST" ? await req.json() : null]); return Response.json(p === "/diff" ? { ok: true, files: [{ path: "b.txt", add: 1, del: 0, patch: "@@ -0,0 +1 @@\n+two" }] } : answer); } }) };
    const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path + (init.q || ""), { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
    const read = (f) => JSON.parse(bucket.m.get("coder/" + uid + "/" + id + "/" + f) || "null");
    return { go, read, asked, marked };
  };
  // PUSH: the machine pushes; the record and the chat say so; the machine's record is told nothing is left.
  let x = await setup();
  let r = await (await x.go("projects/" + id + "/push", { method: "POST", body: "{}" })).json();
  assert.equal(r.ok, true);
  assert.deepEqual(x.asked.map((a) => a[0]), ["/push"]);
  assert.equal(x.asked[0][1].commitOnly, undefined, "a real push");
  assert.deepEqual([x.asked[0][1].repo, x.asked[0][1].branch], ["ana/shop", "coder/" + id]);
  assert.deepEqual([r.project.unpushed, r.project.unpushedSince, r.project.commits[1].local], [0, 0, undefined]);
  assert.equal(x.read("events.json").at(-1).text, "Pushed to the branch coder/" + id);
  assert.deepEqual(x.marked, [[uid + "-" + id, 0]]);
  // A failed push: said, nothing changed.
  x = await setup({}, { ok: false, why: "could not push: rejected" });
  r = await x.go("projects/" + id + "/push", { method: "POST", body: "{}" });
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /^Not pushed: could not push: rejected/);
  assert.equal(x.read("meta.json").unpushed, 1);
  // Read-only and running chats: no push.
  x = await setup({ readOnly: true });
  assert.equal((await x.go("projects/" + id + "/push", { method: "POST", body: "{}" })).status, 409);
  x = await setup({ status: "running" });
  assert.equal((await x.go("projects/" + id + "/push", { method: "POST", body: "{}" })).status, 409);
  // CREATE PR: pushed first, then opened.
  x = await setup();
  r = await (await x.go("projects/" + id + "/pr", { method: "POST", body: "{}" })).json();
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(x.asked.map((a) => a[0]), ["/push"]);
  assert.equal(r.project.unpushed, 0);
  // DELETING THE CHAT: pushed first; a failed push keeps it unless deleted anyway.
  x = await setup();
  assert.equal((await x.go("projects/" + id, { method: "DELETE" })).status, 200);
  assert.deepEqual(x.asked.map((a) => a[0]), ["/push", "drop"]);
  x = await setup({}, { ok: false, why: "could not push" });
  r = await x.go("projects/" + id, { method: "DELETE" });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /1 commit not pushed to GitHub/);
  assert.ok(x.read("meta.json"), "kept");
  assert.equal((await x.go("projects/" + id, { method: "DELETE", q: "?force=1" })).status, 200);
  assert.equal(x.read("meta.json"), null);
  // SEE CHANGES with unpushed work: from the machine, saying so.
  x = await setup();
  r = await (await x.go("projects/" + id + "/changes")).json();
  assert.deepEqual(x.asked.map((a) => a[0]), ["/diff"]);
  assert.deepEqual([r.ok, r.local, r.unpushed, r.files[0].path], [true, true, 1, "b.txt"]);
  // The page: a Push button with the count, next to See changes, and "Pushed to the branch" in the notes.
  const page = await readFile(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /id="cdPush"/);
  assert.match(page, /'Push · ' \+ Number\(p\.unpushed\) \+ ' unpushed'/);
  assert.match(page, /on\('#cdPush', 'click', \(\) => pushBranch\(\)\);/);
  // Coder's tool and its one line in the system prompt.
  const A = await import("../container/coder-agent.mjs");
  assert.ok(A.CODER_TOOLS.some((t) => t.function.name === "push_branch"));
  assert.match(A.CODER_SYSTEM, /\n- Pushing: when you finish a turn that changed files, your changes are committed and pushed to the chat's branch for you, as a step before your answer is saved \(no need to push yourself\)\. Call push_branch only to push in the middle of a turn/);
  assert.doesNotMatch(A.CODER_SYSTEM, /committed on your machine when each turn ends/);
  const steps = [{ message: { role: "assistant", content: "", tool_calls: [{ id: "p1", type: "function", function: { name: "push_branch", arguments: "{}" } }] }, usage: { in: 1, out: 1 } }, { message: { role: "assistant", content: "Pushed." }, usage: { in: 1, out: 1 } }];
  let i = 0;
  const done = await A.runCoder({ send: async () => steps[Math.min(i++, 1)], exec: async () => ({ code: 0, output: "" }) }, { text: "push it" });
  assert.equal(done.push, true);
  i = 0;
  const ro = await A.runCoder({ send: async () => steps[Math.min(i++, 1)], exec: async () => ({ code: 0, output: "" }) }, { text: "push it", readOnly: { main: true } });
  assert.equal(ro.push, undefined, "a read-only repository is never pushed");
});

test("PL-desc the push_branch tool's description agrees that a turn's changes are pushed at its end (audit L-machine-37)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  const i = src.indexOf('name: "push_branch"'), desc = src.slice(i, src.indexOf("parameters", i));
  assert.doesNotMatch(desc, /on your machine only/);
  assert.match(desc, /pushed to the chat's branch for you at the end of a turn that changed files/);
});

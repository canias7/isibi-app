// ROUND 6 OF THE LIVE TEST (2026-11-12, the owner: "Ok yes"): the six things it found, each fixed and kept fixed here.
// (The fifth, a risky removal the Auto checker approves, is CD542 in pass7.test.mjs, beside CD403 and its job harness.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";

const S = await import("../container/server.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();

/** "GitHub": ana/shop, README.md on main, and `more` other branches named like Coder's (about 84 characters each in ls-remote). */
async function fakeGithub(more = 0, extra = []) {
  const gh = await mkdtemp(join(tmpdir(), "coder-gh6-"));
  const work = await mkdtemp(join(tmpdir(), "coder-seed6-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(gh, "ana"), { recursive: true });
  const bare = join(gh, "ana", "shop.git");
  execFileSync("git", ["clone", "-q", "--bare", work, bare]);
  const head = git(bare, "rev-parse", "main").trim();
  for (let i = 0; i < more; i++) git(bare, "update-ref", "refs/heads/coder/testingforclaude-" + String(i).padStart(8, "0"), head);
  for (const b of extra) git(bare, "update-ref", "refs/heads/" + b, head);
  return { remote: gh + "/", bare };
}
const roots = async () => ({ root: await mkdtemp(join(tmpdir(), "coder-root6-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-git6-")) });

test("CD537 a starting branch late in the alphabet opens in a repository with many branches (live: \"canias7/testingforclaude has no branch named r42-live\", the list of all branches cut at 4,000 characters): it is asked for by name; a missing one is still said, and an empty repository still starts", async () => {
  // 60 branches named like Coder's (over 5,000 characters of ls-remote) and r42-live, last in the alphabet.
  const { remote, bare } = await fakeGithub(60, ["r42-live"]);
  assert.ok(git(bare, "for-each-ref", "--format=%(objectname)\t%(refname)", "refs/heads").length > 4000, "the whole list is over the 4,000 characters git's answer is cut at");
  const { root, gitRoot } = await roots();
  const dir = join(root, "shop-r6a");
  const p = await S.prepareRepo({ dir, repo: "ana/shop", base: "r42-live", branch: "coder/shop-r6a", token: "", remote, gitRoot, root });
  assert.equal(p.ok, true, p.why);
  assert.equal(await readFile(join(dir, "README.md"), "utf8"), "# shop\n");
  assert.equal(git(dir, "rev-parse", "--abbrev-ref", "HEAD").trim(), "coder/shop-r6a");
  // A starting branch that isn't there is still said, the same way.
  const { root: r2, gitRoot: g2 } = await roots();
  const bad = await S.prepareRepo({ dir: join(r2, "shop-r6b"), repo: "ana/shop", base: "r42-gone", branch: "coder/shop-r6b", token: "", remote, gitRoot: g2, root: r2 });
  assert.equal(bad.ok, false);
  assert.match(bad.why, /^ana\/shop has no branch named r42-gone\. Set its main branch on GitHub/);
  // An empty repository (no branches at all) still gets its main branch and starts.
  const gh = await mkdtemp(join(tmpdir(), "coder-gh6e-"));
  await mkdir(join(gh, "ana"), { recursive: true });
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", join(gh, "ana", "empty.git")]);
  const { root: r3, gitRoot: g3 } = await roots();
  const e = await S.prepareRepo({ dir: join(r3, "empty-r6"), repo: "ana/empty", base: "main", branch: "coder/empty-r6", token: "", remote: gh + "/", gitRoot: g3, root: r3 });
  assert.equal(e.ok, true, e.why);
  assert.equal(git(join(gh, "ana", "empty.git"), "log", "-1", "--format=%s", "main").trim(), "Start");
  // By its whole name only.
  const out = "aaa\trefs/heads/zz-late\nbbb\trefs/heads/x/late\r\nccc\trefs/heads/late\r\n";
  assert.deepEqual([S.headListed(out, "zz-late"), S.headListed(out, "late"), S.headListed("aaa\trefs/heads/x/late\n", "late"), S.headListed("aaa\trefs/heads/latest\n", "late"), S.headListed("", "main")], [true, true, false, false, false]);
});

test("CD538 the copy's origin is the repository's github.com address, whatever address Coder fetches by (live: on Coder's machines that was its git relay on gofarther.dev, and `gh run list` said \"none of the git remotes configured for this repository point to a known GitHub host\"); Coder's own push still goes by its own address", async () => {
  const { remote, bare } = await fakeGithub();
  const { root, gitRoot } = await roots();
  const dir = join(root, "shop-r6c");
  const opts = { dir, repo: "ana/shop", base: "main", branch: "coder/shop-r6c", token: "", remote, gitRoot, root };
  assert.equal((await S.prepareRepo(opts)).ok, true);
  const gd = S.gitDirFor(dir, gitRoot);
  const cfg = (k) => execFileSync("git", ["--git-dir=" + gd, "config", "--get-all", k], { encoding: "utf8" }).trim();
  assert.equal(cfg("remote.origin.url"), "https://github.com/ana/shop.git");
  assert.equal(cfg("remote.origin.fetch"), "+refs/heads/*:refs/remotes/origin/*");
  assert.equal(S.originUrl("canias7/testingforclaude"), "https://github.com/canias7/testingforclaude.git");
  // The next job leaves it as it is, and Coder's push still reaches the repository it fetched from.
  assert.equal((await S.prepareRepo(opts)).ok, true);
  assert.equal(cfg("remote.origin.url"), "https://github.com/ana/shop.git");
  await writeFile(join(dir, "r6.txt"), "r6\n");
  const p = await S.pushRepo({ dir, repo: "ana/shop", branch: "coder/shop-r6c", token: "", message: "r6", remote, gitRoot, root });
  assert.equal(p.ok, true, p.why);
  assert.equal(git(bare, "show", "coder/shop-r6c:r6.txt"), "r6\n");
});

test("CD539 an extra repository that opens is not said to have failed (live, round 5's fix: \"Could not open octocat/Hello-World: undefined\"): its note when it has one, nothing when it simply opens, and why when it can't be opened", () => {
  assert.equal(S.extraRepoEvent("octocat/Hello-World", { ok: true }), null);
  assert.deepEqual(S.extraRepoEvent("octocat/Hello-World", { ok: true, note: "GitHub did not answer, so Coder works from this chat's copy." }), { type: "note", text: "octocat/Hello-World: GitHub did not answer, so Coder works from this chat's copy." });
  assert.deepEqual(S.extraRepoEvent("ana/x", { ok: false, why: "ana/x has no branch named dev." }), { type: "error", text: "Could not open ana/x: ana/x has no branch named dev." });
  assert.deepEqual(S.extraRepoEvent("ana/x", null), { type: "error", text: "Could not open ana/x: it could not be prepared" });
  // The loop that opens them says what extraRepoEvent says, and only that.
  const server = read("container/server.mjs");
  assert.match(server, /if \(p\.ok\) extras\.push\(\{ \.\.\.x, dir: xdir \}\);\n\s+const said = extraRepoEvent\(x\.repo, p\);\n\s+if \(said\) t\.events\.push\(\{ at: Date\.now\(\), \.\.\.said \}\);/);
  assert.doesNotMatch(server, /if \(p\.ok && p\.note\) t\.events\.push/);
});

test("CD540 SessionEnd hooks run when the machine stops though the job's sandbox has closed (live: the hook's file was never written, the hook having entered a sandbox that was gone): the job's own sandbox only while it is still the live one; otherwise as the AI's user in the room", () => {
  const box = { pid: 4242 }, other = { pid: 5151 };
  assert.equal(S.boxAtEnd(box, box), box, "a background command kept it: inside it");
  assert.equal(S.boxAtEnd(box, null), null, "stopped at the job's end");
  assert.equal(S.boxAtEnd(box, other), null, "another job's sandbox is not this one's");
  assert.equal(S.boxAtEnd(null, other), null);
  // sessionEnd picks it for each chat before its hooks run, and the hooks' exec reads the chat's sandbox when it is called.
  const server = read("container/server.mjs");
  const end = server.slice(server.indexOf("const sessionEnd = async"), server.indexOf("const handle = async function handle"));
  assert.ok(end.indexOf("t.box = boxAtEnd(t.box, BOX);") > 0 && end.indexOf("t.box = boxAtEnd(t.box, BOX);") < end.indexOf("t.turnDeps.exec("), "chosen before the hooks run");
  assert.match(server, /room: t\.room, box: t\.box, onStart, prefix: tool \? "" :/, "the exec reads t.box when called");
});

test("CD543 a record of each stop's SessionEnd hooks, in root's own git folder (live: the hook's file was never written, and the machine's own log is not kept): when it began, with the stop signal, then what each hook did; the newest 20", async () => {
  const gitRoot = await mkdtemp(join(tmpdir(), "coder-git6r-"));
  for (let i = 1; i <= 25; i++) assert.equal(await S.noteSessionEnd(gitRoot, { n: i }), true);
  const recs = (await readFile(join(gitRoot, ".session-end.log"), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual([recs.length, recs[0].n, recs.at(-1).n], [20, 6, 25]);
  assert.equal(await S.noteSessionEnd("", { n: 1 }), false, "nowhere to write");
  // The stop signal's name goes with it.
  assert.match(read("container/server.mjs"), /app\.sessionEnd\("other", \{ signal: sig \}\)/);
});

test("CD544 a chat's SessionEnd hook runs when its machine stops after a message that left nothing in the background (round 6's retest, after the record: the job's end had removed the chat's work folder, and the hook failed in 1 ms, \"ENOENT: no such file or directory, open '/srv/coder-bg/…/req-….json'\")", async () => {
  const http = (await import("node:http")).default;
  const r = { ...(await roots()), memRoot: await mkdtemp(join(tmpdir(), "coder-mem6e-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-bg6e-")), home: await mkdtemp(join(tmpdir(), "coder-home6e-")) };
  const project = "r6-end-" + process.pid;
  const say = (content) => ({ message: { role: "assistant", content }, usage: { in: 1, out: 1 } });
  const app = S.createApp({ ...r, send: async () => say("ready") });
  const srv = http.createServer(app);
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    // The live test's hook, writing in the project's folder here (live: "$HOME/r43-end.log").
    const hooks = { hooks: { SessionEnd: [{ hooks: [{ type: "command", command: "cat >> \"$CLAUDE_PROJECT_DIR/r43-end.log\"; echo >> \"$CLAUDE_PROJECT_DIR/r43-end.log\"" }] }] } };
    const sent = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "Reply with the single word ready, nothing else.", messages: [], hooks }) });
    assert.equal(sent.status, 200);
    let st;
    for (let i = 0; i < 400; i++) { st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.ok(st && st.result, "the message ended");
    assert.equal(existsSync(join(r.bgRoot, project)), false, "the job's end removed the chat's work folder: nothing in the background kept it (as live)");
    // The machine stops (Fly.io's SIGINT): the hook runs, and its file is written.
    assert.equal(await app.sessionEnd("other", { signal: "SIGINT" }), 1);
    const wrote = JSON.parse(readFileSync(join(r.root, project, "r43-end.log"), "utf8").trim());
    assert.deepEqual([wrote.hook_event_name, wrote.reason, wrote.session_id], ["SessionEnd", "other", project]);
    const recs = readFileSync(join(r.gitRoot, ".session-end.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual([recs[0].signal, recs[0].hooks, recs[1].said[0].code, recs[1].said[0].error], ["SIGINT", 1, 0, undefined]);
  } finally { srv.close(); }
});

test("CD545 a chat's SessionEnd hooks are told its mode as its message's hooks were (the live test of the automatic summary, 2026-11-12: a message's hooks were told Accept edits as \"default\", as in Claude Code's cloud, and the SessionEnd hook when the machine slept \"acceptEdits\")", async () => {
  const A = await import("../container/coder-agent.mjs");
  assert.deepEqual([A.hookModeName("acceptEdits", false), A.hookModeName("acceptEdits", true), A.hookModeName("plan", false), A.hookModeName("auto", false)], ["default", "acceptEdits", "plan", "auto"]);
  const http = (await import("node:http")).default;
  const r = { ...(await roots()), memRoot: await mkdtemp(join(tmpdir(), "coder-mem6m-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-bg6m-")), home: await mkdtemp(join(tmpdir(), "coder-home6m-")) };
  const project = "r6-mode-" + process.pid;
  const say = (content) => ({ message: { role: "assistant", content }, usage: { in: 1, out: 1 } });
  const app = S.createApp({ ...r, send: async () => say("ready") });
  const srv = http.createServer(app);
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  // A hook of the message (UserPromptSubmit) and a SessionEnd hook, each saving what it was given.
  const hooks = { hooks: {
    UserPromptSubmit: [{ hooks: [{ type: "command", command: "cat > \"$CLAUDE_PROJECT_DIR/r6-msg.json\"" }] }],
    SessionEnd: [{ hooks: [{ type: "command", command: "cat > \"$CLAUDE_PROJECT_DIR/r6-end.json\"" }] }],
  } };
  const turn = async () => {
    // (Each time from nothing. This file's machines share one list of chats, so CD544's chat ends with it: no count here.)
    await rm(join(r.root, project, "r6-msg.json"), { force: true }); await rm(join(r.root, project, "r6-end.json"), { force: true });
    const sent = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "Reply with the single word ready.", messages: [], mode: "acceptEdits", hooks }) });
    assert.equal(sent.status, 200);
    let st;
    for (let i = 0; i < 400; i++) { st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.ok(st && st.result, "the message ended");
    assert.ok(await app.sessionEnd("other", { signal: "SIGINT" }) >= 1);
    const told = (f) => JSON.parse(readFileSync(join(r.root, project, f), "utf8")).permission_mode;
    return [told("r6-msg.json"), told("r6-end.json")];
  };
  try {
    // Accept edits, the repository setting nothing: both are told "default".
    assert.deepEqual(await turn(), ["default", "default"]);
    // The repository's own settings start chats in Accept edits (permissions.defaultMode): both are told "acceptEdits".
    await mkdir(join(r.root, project, ".claude"), { recursive: true });
    await writeFile(join(r.root, project, ".claude", "settings.json"), JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }));
    assert.deepEqual(await turn(), ["acceptEdits", "acceptEdits"]);
  } finally { srv.close(); }
  // The machine's side uses the same rule, with what the message's hooks were given.
  const server = read("container/server.mjs");
  assert.match(server, /mode: hookModeName\(t\.mode \|\| "auto", t\.fileEdits\)/);
  assert.match(server, /t\.fileEdits = repoSet\.defaultMode === "acceptEdits";/);
});

// ── `@coder` ON A PULL REQUEST WHOSE CHAT WAS DELETED ─────────────────────────────────────────────────────────────────────
const M = await import("../src/coder-mentions.mjs");
const R = await import("../src/coder-routes.mjs");
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })), truncated: false }; } };
}

test("CD541 `@coder` on a pull request whose chat was deleted opens a new chat on the pull request's branch (live: \"Coder could not start: no such project\"), and the deleted chat's record is dropped; one whose chat is there goes to it as before; deleting a chat drops its branch records", async () => {
  const setup = (alive) => {
    const b = fakeBucket();
    b.m.set(M.loginKey("ana"), JSON.stringify({ uid: "u1" }));
    b.m.set("coder/u1/github.json", JSON.stringify({ login: "ana" }));
    b.m.set(M.profileKey("u1"), JSON.stringify({ email: "me@x.y" }));
    b.m.set(M.branchKey("ana/shop", "coder/shop-old"), JSON.stringify({ uid: "u1", id: "shop-old" }));
    const calls = [];
    const fetchFn = async (url, init = {}) => {
      if (/access_tokens$/.test(url)) return new Response(JSON.stringify({ token: "ghs_app" }), { status: 201 });
      if (/\/pulls\/16$/.test(url)) return new Response(JSON.stringify({ head: { ref: "coder/shop-old", repo: { id: 1 } }, base: { ref: "main", repo: { id: 1 } } }), { status: 200 });
      return new Response(JSON.stringify({ id: 77 }), { status: 201 });
    };
    const coder = async (req) => {
      const u = new URL(req.url);
      calls.push([req.method, u.pathname, req.method === "POST" ? await req.json() : null]);
      if (req.method === "GET" && u.pathname === "/api/coder/projects/shop-old") return alive ? Response.json({ ok: true, project: { id: "shop-old" } }) : Response.json({ error: "no such project" }, { status: 404 });
      if (req.method === "POST" && u.pathname === "/api/coder/projects") return Response.json({ ok: true, project: { id: "shop-new" } });
      return Response.json({ ok: true });
    };
    const env = { CODER_USERS: "me@x.y", CODER_BUCKET: b, CODER_GITHUB_APP_ID: "1", CODER_GITHUB_APP_PRIVATE_KEY: privateKey };
    return { b, calls, env, deps: { fetchFn, coder } };
  };
  const m = { repo: "ana/shop", number: 16, isPr: true, text: "@coder ! echo r42-gh-bang", login: "ana", installation: 7, extra: "" };
  const thread = "coder/github-threads/ana__shop__16__u1.json";
  const jobOf = (b) => [...b.m.keys()].filter((k) => k.startsWith("coder/github-jobs/"));

  // THE CHAT WAS DELETED: a new chat that starts from the pull request's branch; the stale record goes; the thread is the new chat's.
  let s = setup(false);
  let r = await M.startMention(s.env, s.deps, m);
  assert.deepEqual(r, { ok: true, id: "shop-new" });
  assert.deepEqual(s.calls.find((c) => c[0] === "POST" && c[1] === "/api/coder/projects")[2], { repo: "ana/shop", needPush: true, base: "coder/shop-old" });
  assert.equal(s.b.m.has(M.branchKey("ana/shop", "coder/shop-old")), false, "the deleted chat's record is dropped");
  assert.deepEqual(JSON.parse(s.b.m.get(thread) || "null"), { id: "shop-new" });
  assert.equal(jobOf(s.b).length, 1);
  // The next comment in that pull request goes to the new chat, not back to the deleted one.
  r = await M.startMention(s.env, s.deps, m);
  assert.deepEqual(r, { ok: true, id: "shop-new" });
  assert.equal(s.calls.filter((c) => c[0] === "POST" && c[1] === "/api/coder/projects").length, 1, "no second new chat");

  // THE CHAT IS THERE: its own pull request goes to it, as before.
  s = setup(true);
  r = await M.startMention(s.env, s.deps, m);
  assert.deepEqual(r, { ok: true, id: "shop-old" });
  assert.equal(s.calls.some((c) => c[0] === "POST" && c[1] === "/api/coder/projects"), false);
  assert.equal(s.b.m.has(M.branchKey("ana/shop", "coder/shop-old")), true);

  // DELETING A CHAT drops its branch records: its own branch's and the one auto-fix moved it onto; never another chat's.
  const b = fakeBucket();
  b.m.set(M.branchKey("ana/shop", "coder/shop-9"), JSON.stringify({ uid: "u1", id: "shop-9" }));
  b.m.set(M.branchKey("ana/shop", "feature-x"), JSON.stringify({ uid: "u1", id: "shop-9" }));
  b.m.set(M.branchKey("ana/shop", "feature-y"), JSON.stringify({ uid: "u1", id: "shop-10" }));
  assert.equal(await R.dropBranchRecords(b, "u1", "shop-9", { repo: "ana/shop", branch: "feature-x" }), 2);
  assert.deepEqual([...b.m.keys()], [M.branchKey("ana/shop", "feature-y")]);
  assert.equal(await R.dropBranchRecords(b, "u1", "shop-10", { repo: "ana/shop", branch: "coder/shop-10" }), 0, "a record is dropped only by the chat it names, on that chat's branches");
  assert.match(read("src/coder-routes.mjs"), /await dropLive\(bucket, uid, id\)\.catch\(\(\) => \{\}\);\n(?:\s+\/\/.*\n)+\s+await dropBranchRecords\(bucket, uid, id, meta\)\.catch\(\(\) => \{\}\);/);
  // Auto-fix's news for a deleted chat's branch drops its record too.
  assert.match(read("src/coder-mentions.mjs"), /if \(look\.status === 404\) await bucket\.delete\(branchKey\(f\.repo, f\.branch\)\)\.catch\(\(\) => \{\}\);\n\s+if \(look\.status !== 200 \|\| !look\.data\.project\) return \{ ok: false, why: "chat gone" \};/);
});

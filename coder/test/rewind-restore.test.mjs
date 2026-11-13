// THE OWNER, 2026-11-13: "yea do those 2 things merge and deploy then test it".
//   1. In Auto, Coder's checker reviews read-only commands too (Claude Code's cloud sessions, whose review runs on its
//      server: "read-only and sandboxed shell commands wait for that review and are blocked if it flags them"); the other
//      tests of Auto's checker are in auto-checker, auto-rules, pass6, pass7 and pass8.
//   2. Rewind's "Restore code" puts back only the files Coder's file tools changed, as Claude Code's checkpoints: "A file that
//      only Bash commands changed isn't tracked and stays as it is"; "Once Claude has edited a file with its file editing
//      tools in your conversation, /rewind undoes changes that Bash commands make to that file afterward"; links skipped
//      ("Restored the code, but skipped N files"); the code choices only "when the selected checkpoint has tracked file
//      changes to revert".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, readFile, symlink, link, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";

const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("CD561 a job's result names the files its write and edit changed, by the project's own names: never a failed one, a read, a command's, the scratch folder's or one outside the project", async () => {
  const A = await import("../container/coder-agent.mjs");
  const ROOT = "/work/shop";
  const steps = [say("", [
    call("write", { path: "src/new.js", content: "x\n" }, "w1"),
    call("edit", { path: "/work/shop/src/old.js", old_string: "a", new_string: "b" }, "e1"),
    call("edit", { path: "src/broken.js", old_string: "a", new_string: "b" }, "e2"),
    call("write", { path: "/tmp/coder-scratch/note.txt", content: "y\n" }, "w2"),
    call("write", { path: "/work/other/x.js", content: "z\n" }, "w3"),
    call("write", { path: "src/new.js", content: "again\n" }, "w4"),
    call("read", { path: "README.md" }, "r1"),
    call("bash", { command: "echo hi > by-command.txt" }, "b1"),
  ]), say("done")];
  let n = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => {
      const m = /coder-tools\.mjs (\S+)/.exec(String(x.command));
      if (m) { const req = JSON.parse(Buffer.from(m[1], "base64").toString()); return req.args.path === "src/broken.js" ? { code: 1, output: "error: old_string not found" } : { code: 0, output: "ok\n" }; }
      return { code: 0, output: "" };
    },
    emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
  }, { text: "go", mode: "acceptEdits" });
  assert.deepEqual(r.edited, ["src/new.js", "src/old.js"]);
  assert.equal(r.editedCut, undefined);
  // A job that changed nothing with them says so (an empty list, not none).
  n = 0;
  const quiet = [say("Nothing to change.")];
  const r2 = await A.runCoder({ send: async () => quiet[0], exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => p }, { text: "hi" });
  assert.deepEqual(r2.edited, []);
  assert.equal(A.EDITED_MAX, 200);
});

test("CD562 what each commit keeps for Rewind, and what Restore code puts back: files Coder's file tools changed, each as it was before the message (or before the job that first changed it)", async () => {
  const R = await import("../src/coder-routes.mjs");
  // A job that changed a file with write: tracked. One whose commit only touched command-made files: not tracked. One that
  // changed a tracked file by a command: tracked ("whatever made them"). No list from the machine: nothing kept (old way).
  const c1 = { sha: "a1", turn: 1, ...R.commitTracking([], { edited: ["src/app.js"] }, { files: ["src/app.js", "build.log"] }) };
  assert.deepEqual([c1.edited, c1.tracked], [["src/app.js"], true]);
  const c2 = { sha: "b2", turn: 2, ...R.commitTracking([c1], { edited: [] }, { files: ["build.log", "dist/out.js"] }) };
  assert.deepEqual([c2.edited, c2.tracked], [[], false]);
  const c3 = { sha: "c3", turn: 3, ...R.commitTracking([c1, c2], { edited: [] }, { files: ["src/app.js"] }) };
  assert.equal(c3.tracked, true);
  const c4 = { sha: "d4", turn: 4, ...R.commitTracking([c1, c2, c3], { edited: ["src/new.js"] }, { files: ["src/new.js"] }) };
  assert.deepEqual(R.commitTracking([c1], { summary: "old machine" }, { files: ["x"] }), {});
  assert.deepEqual(R.commitTracking([c1], { edited: ["a"], editedCut: true }, { files: ["a"] }), {});
  assert.deepEqual(R.commitTracking([c1], { edited: ["/etc/passwd", "../up", "ok.js"] }, { files: ["ok.js"] }).edited, ["ok.js"]);
  assert.equal(R.commitTracking([c1], { edited: [] }, { files: ["x"], filesCut: true }).tracked, true, "a list cut short: assumed tracked");
  assert.equal(R.commitTracking([c1], { edited: [] }, {}).tracked, true, "no list of files: assumed tracked");
  const cs = [c1, c2, c3, c4];
  // Back to before message 3: app.js (tracked since job 1) as it was before job 3; new.js (first changed in job 4) as it was
  // before job 4. build.log and dist/out.js, only commands', are not named.
  assert.deepEqual(R.restorePlan(cs, 3), { later: [c3, c4], items: [{ path: "src/app.js", before: "c3" }, { path: "src/new.js", before: "d4" }] });
  assert.deepEqual(R.restorePlan(cs, 2).items, [{ path: "src/app.js", before: "b2" }, { path: "src/new.js", before: "d4" }]);
  assert.deepEqual(R.restorePlan(cs, 9), { later: [], items: [] });
  assert.equal(R.restorePlan([{ sha: "z0", turn: 1, title: "old" }, ...cs], 3), null, "a job from before: the old way");
  // The code choices: only when a later job changed a tracked file.
  assert.equal(R.codeToRestore(cs, 2), true);
  assert.equal(R.codeToRestore([c1, c2], 2), false, "only commands changed files after it");
  assert.equal(R.codeToRestore(cs, 5), false);
  assert.equal(R.codeToRestore([{ sha: "z0", turn: 1 }, c2], 2), true, "with a job from before: any later job");
  // The page's own check is the same function.
  const src = read("public/coder.js");
  const body = /function codeToRestore\(commits, turn\) \{([\s\S]*?)\n  \}/.exec(src);
  assert.ok(body, "coder.js has codeToRestore");
  const pageCheck = new Function("commits", "turn", body[1]);
  for (const [list, turn] of [[cs, 2], [[c1, c2], 2], [cs, 5], [[{ sha: "z0", turn: 1 }, c2], 2], [[c1, c2, c3], 3], [[], 1]]) assert.equal(pageCheck(list, turn), R.codeToRestore(list, turn));
  assert.match(src, /Restoring the code puts back the files Coder\\'s file tools changed, as they were before you sent it; files only commands changed stay as they are\./);
  assert.match(src, /Only commands changed files after this message, and those stay as they are, so only the chat can go back\./);
  // Claude Code's warning for skipped files (2.1.323), with the names.
  assert.equal(R.restoreSkipped(["link.js"]), "Restored the code, but skipped 1 file: the tracked path is (or became) a link or other non-regular file, its directory changed since the checkpoint, or its backup could not be safely read. Skipped files were left untouched: link.js.");
  assert.match(R.restoreSkipped(Array.from({ length: 22 }, (_, k) => "f" + k)), /^Restored the code, but skipped 22 files: .* f19 and 2 more\.$/);
});

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("CD563 Rewind's Restore code in the Worker: the machine is asked to restore the tracked files (never a revert of whole jobs), the chat says how many and what was skipped, Coder is told which, files only commands changed stay; a chat with older jobs still reverts them whole", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-r2";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev" };
  const tracked = [
    { sha: "a1", turn: 1, title: "Job one", edited: ["src/app.js"], tracked: true },
    { sha: "b2", turn: 2, title: "Job two", edited: [], tracked: false },
    { sha: "c3", turn: 3, title: "Job three", edited: ["src/new.js"], tracked: true },
  ];
  const setup = async (commits, answer = { ok: true, sha: "f9", restored: ["src/app.js", "src/new.js"], skipped: [] }) => {
    const bucket = fakeBucket();
    await saveConnection({ ...env }, bucket, uid, { access: "ghu_user" }, "ana");
    const meta = { id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 3, status: "idle", commits, marks: [{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 3, msg: 4 }, { turn: 3, ev: 6, msg: 8 }] };
    await bucket.put("coder/" + uid + "/" + id + "/meta.json", JSON.stringify(meta));
    await bucket.put("coder/" + uid + "/" + id + "/events.json", JSON.stringify(Array.from({ length: 9 }, (_, k) => ({ type: k % 3 ? "done" : "user", text: "e" + k }))));
    await bucket.put("coder/" + uid + "/" + id + "/messages.json", JSON.stringify(Array.from({ length: 12 }, (_, k) => ({ role: k % 4 ? "assistant" : "user", content: "m" + k }))));
    const asked = [];
    const deps = { fetchFn: async () => new Response("{}"), authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: async (req) => { const b = await req.json(); asked.push([new URL(req.url).pathname, b]); return Response.json(new URL(req.url).pathname === "/restore" ? answer : { ok: true }); } }) };
    const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), { ...env, CODER_BUCKET: bucket }, {}, deps);
    const readKey = (f) => JSON.parse(bucket.m.get("coder/" + uid + "/" + id + "/" + f));
    return { go, read: readKey, asked };
  };
  const rw = (go, body) => go("projects/" + id + "/rewind", { method: "POST", body: JSON.stringify(body) });
  // Code only, to before message 2.
  let x = await setup(tracked);
  let r = await (await rw(x.go, { turn: 2, code: true })).json();
  assert.deepEqual(x.asked.map((a) => a[0]), ["/restore"], "one restore, no undo");
  const sent = x.asked[0][1];
  assert.deepEqual(sent.items, [{ path: "src/app.js", before: "b2" }, { path: "src/new.js", before: "c3" }]);
  assert.equal(sent.message, "Rewind: files back as they were before \"Job two\"");
  assert.deepEqual([sent.repo, sent.branch, sent.project], ["ana/shop", "coder/" + id, id]);
  assert.deepEqual(r.project.commits.map((c) => c.sha), ["a1"], "the later jobs are no longer on record");
  assert.equal(x.read("events.json").at(-1).text, "Rewound to before an earlier message: the code is back as it was (2 files restored, saved to the branch coder/shop-r2; files only commands changed stay as they are).");
  assert.equal(x.read("messages.json").at(-1).content, "(Note from Coder's app: the owner restored the code to before an earlier message, as Claude Code's checkpoints do. The files your file tools (write, edit) had changed since then are back as they were: src/app.js, src/new.js. Files that only commands changed were left as they are. Nothing to do now.)");
  // Skipped files: Claude Code's warning, with their names; Coder is told too.
  x = await setup(tracked, { ok: true, sha: "f9", restored: ["src/new.js"], skipped: ["src/app.js"] });
  await rw(x.go, { turn: 2, code: true });
  assert.match(x.read("events.json").at(-1).text, /\(1 file restored, .*\)\. Restored the code, but skipped 1 file: the tracked path is \(or became\) a link or other non-regular file, its directory changed since the checkpoint, or its backup could not be safely read\. Skipped files were left untouched: src\/app\.js\.$/);
  assert.match(x.read("messages.json").at(-1).content, /back as they were: src\/new\.js\. Skipped and left as they are: src\/app\.js\. Files that only commands changed/);
  // Code and chat: the chat is cut too.
  x = await setup(tracked);
  r = await (await rw(x.go, { turn: 3, code: true, chat: true })).json();
  assert.deepEqual(x.asked[0][1].items, [{ path: "src/app.js", before: "c3" }, { path: "src/new.js", before: "c3" }]);
  assert.match(x.read("events.json").at(-1).text, /; the chat after it is gone\.$/);
  assert.deepEqual(r.project.marks.map((m) => m.turn), [1, 2]);
  // Nothing differed: said, and Coder is not told of a change.
  x = await setup(tracked, { ok: true, sha: "", restored: [], skipped: [] });
  await rw(x.go, { turn: 3, code: true });
  assert.equal(x.read("events.json").at(-1).text, "Rewound to before an earlier message: the code had no changes to restore.");
  assert.equal(x.read("messages.json").length, 12);
  // No tracked file at all: the machine is not even asked.
  x = await setup([{ sha: "b2", turn: 2, title: "Job two", edited: [], tracked: false }]);
  await rw(x.go, { turn: 2, code: true });
  assert.deepEqual(x.asked, []);
  // The machine could not: said, and nothing on record changes.
  x = await setup(tracked, { ok: false, why: "a job's commit is not on this branch any more" });
  const bad = await rw(x.go, { turn: 2, code: true });
  assert.equal(bad.status, 409);
  assert.equal((await bad.json()).error, "Could not restore the code: a job's commit is not on this branch any more");
  assert.deepEqual(x.read("meta.json").commits.map((c) => c.sha), ["a1", "b2", "c3"]);
  // A chat with a job from before 2026-11-13 (no list): its later jobs are reverted whole, newest first, as before.
  x = await setup([{ sha: "a1", turn: 1, title: "Job one" }, ...tracked.slice(1)]);
  await rw(x.go, { turn: 2, code: true });
  assert.deepEqual(x.asked.map((a) => [a[0], a[1].sha]), [["/undo", "c3"], ["/undo", "b2"]]);
  // The job's end keeps each commit's list (commitTracking), from the machine's `edited` and the push's `files`.
  const src = read("src/coder-routes.mjs");
  assert.equal((src.match(/\.\.\.commitTracking\(commits, s\.result, p\)/g) || []).length, 2);
});

// ── THE MACHINE'S RESTORE, WITH REAL GIT ─────────────────────────────────────
const tmp = async (name) => realpath(await mkdtemp(join(tmpdir(), name)));
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
async function serve(handle) {
  const srv = http.createServer(handle);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  return { post, close: () => new Promise((r) => srv.close(r)) };
}

test("CD564 the machine's restore (real git): a file the tools changed goes back, a file only commands changed stays, a command's later change to a tracked file is undone, a file the tools made is removed, links and hard-linked files are skipped; one commit with the chat's link, pushed (never forced); bad lists refused", async () => {
  const S = await import("../container/server.mjs");
  // "GitHub": ana/shop with README.md and src/app.js on main.
  const gh = await tmp("coder-rw-gh-"), work = await tmp("coder-rw-seed-");
  const g = (...a) => git(work, "-c", "user.name=a", "-c", "user.email=a@b", ...a);
  g("init", "-q", "-b", "main");
  await mkdir(join(work, "src"));
  await writeFile(join(work, "README.md"), "# shop\n");
  await writeFile(join(work, "src/app.js"), "v0\n");
  await writeFile(join(work, "src/linked.js"), "l0\n");
  await writeFile(join(work, "src/hard.js"), "h0\n");
  g("add", "-A"); g("commit", "-q", "-m", "first");
  await mkdir(join(gh, "ana"));
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "ana/shop.git")]);
  const bare = join(gh, "ana/shop.git");
  const remote = gh + "/";
  const root = await tmp("coder-rw-root-"), gitRoot = await tmp("coder-rw-git-");
  const name = "shop-rw1", dir = join(root, name), branch = "coder/" + name;
  const o = { dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root };
  assert.equal((await S.prepareRepo(o)).ok, true);
  const job = async (fn, message) => { await fn(); const p = await S.pushRepo({ ...o, message }); assert.equal(p.ok, true, p.why); return p; };
  // Job 1 (message 1): the tools change app.js and linked.js and hard.js; a command makes build.log.
  const j1 = await job(async () => { await writeFile(join(dir, "src/app.js"), "v1\n"); await writeFile(join(dir, "src/linked.js"), "l1\n"); await writeFile(join(dir, "src/hard.js"), "h1\n"); await writeFile(join(dir, "build.log"), "log1\n"); }, "Job one");
  assert.deepEqual(j1.files.sort(), ["build.log", "src/app.js", "src/hard.js", "src/linked.js"], "the push names the commit's files");
  // Job 2 (message 2): the tools make new.js; a command changes app.js again and build.log.
  const j2 = await job(async () => { await writeFile(join(dir, "src/new.js"), "n1\n"); await writeFile(join(dir, "src/app.js"), "v2 by a command\n"); await writeFile(join(dir, "build.log"), "log2\n"); }, "Job two");
  // Job 3 (message 3): a command changes hard.js, makes linked.js a link and gives hard.js a second name.
  const { rm } = await import("node:fs/promises");
  const j3 = await job(async () => { await writeFile(join(dir, "src/hard.js"), "h3\n"); await rm(join(dir, "src/linked.js")); await symlink("../README.md", join(dir, "src/linked.js")); await link(join(dir, "src/hard.js"), join(dir, "hard-twin.js")); }, "Job three");
  // Back to before message 2: app.js, linked.js, hard.js tracked since job 1 (as before job 2); new.js first made in job 2.
  const { post, close } = await serve(S.createApp({ root, gitRoot, remote, memRoot: await tmp("coder-rw-mem-"), bgRoot: await tmp("coder-rw-bg-"), send: async () => ({ message: { role: "assistant", content: "ok" } }) }));
  try {
    const items = [{ path: "src/app.js", before: j2.sha }, { path: "src/linked.js", before: j2.sha }, { path: "src/hard.js", before: j2.sha }, { path: "src/new.js", before: j2.sha }];
    const res = await post("/restore", { project: name, repo: "ana/shop", base: "main", branch, token: "", items, message: "Rewind: files back as they were before \"Job two\"", chatUrl: "https://gofarther.dev/?chat=" + name });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.deepEqual(body.restored.sort(), ["src/app.js", "src/new.js"]);
    assert.deepEqual(body.skipped.sort(), ["src/hard.js", "src/linked.js"]);
    assert.equal(await readFile(join(dir, "src/app.js"), "utf8"), "v1\n", "the command's later change to a tracked file is undone");
    assert.equal(await readFile(join(dir, "build.log"), "utf8"), "log2\n", "a file only commands changed stays as it is");
    assert.equal(await readFile(join(dir, "src/hard.js"), "utf8"), "h3\n", "a hard-linked file is left untouched");
    assert.equal(await readFile(join(dir, "src/linked.js"), "utf8"), "# shop\n", "a link is left untouched");
    await assert.rejects(readFile(join(dir, "src/new.js")), "a file the tools made after it is removed");
    // One commit on the branch, with the chat's link, pushed on top of job 3 (never a force push).
    assert.equal(git(bare, "rev-parse", branch).trim(), body.sha);
    assert.equal(git(bare, "rev-parse", branch + "~1").trim(), j3.sha);
    assert.equal(git(bare, "log", "-1", "--format=%s", branch).trim(), "Rewind: files back as they were before \"Job two\"");
    assert.match(git(bare, "log", "-1", "--format=%b", branch), /^Coder-Chat: https:\/\/gofarther\.dev\/\?chat=shop-rw1$/m);
    assert.equal(git(bare, "show", branch + ":src/app.js"), "v1\n");
    assert.equal(git(bare, "show", branch + ":build.log"), "log2\n");
    assert.throws(() => git(bare, "show", branch + ":src/new.js"));
    // Nothing more to restore: no new commit.
    const again = await (await post("/restore", { project: name, repo: "ana/shop", base: "main", branch, token: "", items: items.slice(0, 1) })).json();
    assert.deepEqual([again.ok, again.restored], [true, []]);
    // Lists refused: none, a path out of the project or into git's folder, a bad commit.
    for (const bad of [[], [{ path: "../etc/passwd", before: j2.sha }], [{ path: "/etc/passwd", before: j2.sha }], [{ path: ".git/config", before: j2.sha }], [{ path: "src/app.js", before: "nope" }], [{ path: ":(glob)*", before: j2.sha }]]) {
      const x = await post("/restore", { project: name, repo: "ana/shop", base: "main", branch, token: "", items: bad });
      assert.equal(x.status, 400, JSON.stringify(bad));
    }
    // A commit that is not there: refused, nothing changed.
    const gone = await post("/restore", { project: name, repo: "ana/shop", base: "main", branch, token: "", items: [{ path: "src/app.js", before: "0123456789abcdef0123456789abcdef01234567" }] });
    assert.equal(gone.status, 409);
    assert.match((await gone.json()).why, /not on this branch any more/);
  } finally { await close(); }
  assert.equal(S.restorePathOk("src/a b.js"), true);
  assert.equal(S.restorePathOk("src/../x"), false);
  assert.equal(S.restorePathOk("a/.git/x"), false);
});

test("CD565 the README and the docs say both changes", () => {
  const readme = read("README.md");
  assert.match(readme, /read-only commands wait for the checker too/);
  assert.match(readme, /Restore code puts back only the files Coder's file tools changed/);
});

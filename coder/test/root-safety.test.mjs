// ROOT'S GIT AND FILE WORK, NEVER STEERED BY THE AI'S USER (the audit,
// 2026-11-06, item 4 part 1). Coder's service runs git as root on a work tree
// the AI's user (`dev`) owns. These tests plant what the AI's commands could
// plant and check that root never runs it, never saves it, and never follows it:
//   C1  a repository the AI made inside the project (or a submodule's folder it
//       made into one), whose own settings name a filter command;
//   H1  a project folder swapped for a link, and files hard-linked into the tree.
// Real git against a local bare repository standing in for GitHub; the parts
// that change file owners run only as root (they do here).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rename, symlink, link, rm, utimes, realpath, chmod } from "node:fs/promises";
import { readFileSync, existsSync, readdirSync, lstatSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createApp, prepareRepo, pushRepo, ignoreNew, gitIn, keepOut, projectDirProblem, makeProjectDir, giveTree, GIT_BIN, GIT_PATH, NO_SUBMODULES } from "../container/server.mjs";

const HERE = (p) => new URL("../" + p, import.meta.url);
const asRoot = process.getuid && process.getuid() === 0;
const tmp = async (name) => realpath(await mkdtemp(join(tmpdir(), name)));
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
const tree = (bare, branch) => git(bare, "ls-tree", "-r", branch);

/** A "GitHub" folder holding ana/shop.git: main has README.md, docs/guide.md, lib/old.txt, and a submodule (a folder recorded at a commit) for each name in `subs`. */
async function seedRemote(subs = []) {
  const gh = await tmp("coder-rs-gh-");
  const work = await tmp("coder-rs-seed-");
  const g = (...a) => git(work, "-c", "user.name=a", "-c", "user.email=a@b", ...a);
  g("init", "-q", "-b", "main");
  await mkdir(join(work, "docs")); await mkdir(join(work, "lib"));
  await writeFile(join(work, "README.md"), "# shop\n");
  await writeFile(join(work, "docs/guide.md"), "guide\n");
  await writeFile(join(work, "lib/old.txt"), "old\n");
  g("add", "-A"); g("commit", "-q", "-m", "first");
  const sha = g("rev-parse", "HEAD").trim();
  if (subs.length) {
    await writeFile(join(work, ".gitmodules"), subs.map((s) => "[submodule \"" + s + "\"]\n\tpath = " + s + "\n\turl = https://example.com/" + s + ".git\n").join(""));
    for (const s of subs) g("update-index", "--add", "--cacheinfo", "160000," + sha + "," + s);
    g("add", ".gitmodules"); g("commit", "-q", "-m", "submodules");
  }
  await mkdir(join(gh, "ana"));
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "ana/shop.git")]);
  return { remote: gh + "/", bare: join(gh, "ana/shop.git"), sha };
}

/**
 * What the AI's commands could make: a repository at `p` whose own settings
 * name a filter command (it leaves a mark when run) for all its files, and a
 * file changed in a way git can only check by reading it through that filter.
 */
async function plantRepo(p, marker) {
  await mkdir(p, { recursive: true });
  const g = (...a) => execFileSync("git", ["-C", p, "-c", "user.name=a", "-c", "user.email=a@b", ...a], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } });
  g("init", "-q");
  await writeFile(join(p, "x.txt"), "one\n");
  g("add", "x.txt"); g("commit", "-q", "-m", "x");
  g("config", "filter.evil.clean", "sh -c 'echo ran >> " + marker + "; cat'");
  g("config", "filter.evil.smudge", "sh -c 'echo ran >> " + marker + "; cat'");
  await writeFile(join(p, ".gitattributes"), "* filter=evil\n");
  // Same size, newer time: only reading it (through the filter) can tell.
  await writeFile(join(p, "x.txt"), "two\n");
  const later = new Date(Date.now() + 10000);
  await utimes(join(p, "x.txt"), later, later);
}

async function serve(handle) {
  const srv = http.createServer(handle);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  return { post, close: () => new Promise((r) => srv.close(r)) };
}

/** A project cloned on Coder's branch with one job of Coder's pushed (page.html), ready to undo. */
async function project(name, subs = []) {
  const { remote, bare, sha } = await seedRemote(subs);
  const root = await tmp("coder-rs-root-");
  const gitRoot = await tmp("coder-rs-git-");
  const dir = join(root, name);
  const branch = "coder/" + name;
  const o = { dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root };
  const prep = await prepareRepo(o);
  assert.equal(prep.ok, true, prep.why);
  await writeFile(join(dir, "page.html"), "<h1>Hi</h1>\n");
  const p = await pushRepo({ ...o, message: "Made page.html" });
  assert.equal(p.pushed, true, p.why);
  const marker = join(await tmp("coder-rs-mark-"), "FILTER-RAN");
  return { remote, bare, sha, root, gitRoot, dir, branch, o, job: p.sha, marker, gitDir: join(gitRoot, name) };
}

/** The undo route of a machine on this project: revert `job` and push. */
async function undo(P, sha = P.job) {
  const { post, close } = await serve(createApp({ root: P.root, gitRoot: P.gitRoot, remote: P.remote, memRoot: await tmp("coder-rs-mem-"), bgRoot: await tmp("coder-rs-bg-"), send: async () => ({ message: { role: "assistant", content: "ok" } }) }));
  try {
    const r = await post("/undo", { project: basename(P.dir), repo: "ana/shop", base: "main", branch: P.branch, token: "", sha });
    return { status: r.status, body: await r.json() };
  } finally { await close(); }
}

test("CD90 C1: a repository the AI makes inside the project is never run by root's git and never saved as a submodule; its other files are still pushed (push, setup-script step, undo)", async () => {
  const P = await project("shop-nest");
  // What the AI's commands could leave behind:
  await plantRepo(join(P.dir, "inner"), P.marker); // a new repository
  await plantRepo(join(P.dir, "undone"), P.marker); // one the repo's own .gitignore un-ignores
  await writeFile(join(P.dir, ".gitignore"), "!/undone/\n");
  await rm(join(P.dir, "lib/old.txt"));
  await plantRepo(join(P.dir, "lib/old.txt"), P.marker); // a tracked file replaced by a repository
  await plantRepo(join(P.dir, "docs"), P.marker); // a folder of tracked files made into one: still plain files to git
  const away = await tmp("coder-rs-away-");
  await plantRepo(away, P.marker);
  await symlink(away, join(P.dir, "linked")); // a link to a repository elsewhere: a link to git, never followed
  await writeFile(join(P.dir, "normal.txt"), "normal\n");
  // A name git cannot be given exactly (not plain text, or with a line break) is refused, not guessed at.
  for (const odd of [Buffer.from([0x62, 0xff, 0xfe]), Buffer.from("two\nlines")]) {
    const p = Buffer.concat([Buffer.from(P.dir + "/"), odd]);
    await mkdir(Buffer.concat([p, Buffer.from("/.git")]), { recursive: true });
    const r = await keepOut(P.dir, { gitDir: P.gitDir, root: P.root });
    assert.equal(r.ok, false); assert.match(r.why, /its name is not plain text/);
    const refused = await pushRepo({ ...P.o, message: "x" });
    assert.equal(refused.ok, false); assert.match(refused.why, /its name is not plain text/);
    await rm(p, { recursive: true });
  }
  const k = await keepOut(P.dir, { gitDir: P.gitDir, root: P.root });
  assert.deepEqual(k.keep.sort(), ["inner", "lib/old.txt", "undone"]);
  const p = await pushRepo({ ...P.o, message: "More work" });
  assert.equal(p.ok, true, p.why);
  assert.equal(p.pushed, true);
  assert.equal(existsSync(P.marker), false, "root ran the nested repository's filter");
  const files = tree(P.bare, P.branch);
  assert.doesNotMatch(files, /^160000 /m, "a nested folder was saved as a submodule");
  assert.doesNotMatch(files, /\tinner\b|\tundone\b/, "a nested repository's files were saved");
  for (const f of ["normal.txt", ".gitignore", "page.html", "docs/guide.md", "docs/x.txt"]) assert.match(files, new RegExp("\\t" + f.replace(/\./g, "\\.") + "$", "m"), f + " was not pushed");
  assert.match(files, /^100644 blob \w+\tlib\/old\.txt$/m, "the tracked file stays as it was");
  assert.match(files, /^120000 blob \w+\tlinked$/m, "the link is saved as a link");
  assert.equal(git(P.bare, "show", P.branch + ":lib/old.txt"), "old\n");
  // The git folder's own ignore list holds them (root's file, not the repo's .gitignore).
  const exclude = readFileSync(join(P.gitDir, "info/exclude"), "utf8");
  for (const l of ["/inner/", "/undone/", "/lib/old.txt/"]) assert.ok(exclude.split("\n").includes(l), l);
  // The setup script's step (what it made is ignored) and the undo route: still nothing run.
  await ignoreNew(P.dir, P.gitRoot, P.remote, P.root);
  assert.equal(existsSync(P.marker), false, "ignoreNew ran it");
  const u = await undo(P);
  assert.equal(u.status, 200, JSON.stringify(u.body));
  assert.throws(() => git(P.bare, "show", P.branch + ":page.html"), "the job was undone");
  assert.equal(existsSync(P.marker), false, "the undo ran it");
  assert.doesNotMatch(tree(P.bare, P.branch), /^160000 /m);
  // A folder that is plain again (its .git removed) is saved again.
  await rm(join(P.dir, "inner/.git"), { recursive: true });
  assert.equal((await pushRepo({ ...P.o, message: "inner is plain now" })).ok, true);
  assert.match(tree(P.bare, P.branch), /\tinner\/x\.txt$/m);
  assert.equal(readFileSync(join(P.gitDir, "info/exclude"), "utf8").split("\n").includes("/inner/"), false);
  assert.equal(existsSync(P.marker), false);
});

test("CD91 C1: a submodule's folder the AI made into a repository (or swapped for a link) is left alone by root's git; plain submodules work as before (push, setup-script step, undo)", async () => {
  const P = await project("shop-subs", ["sub", "empty-sub", "link-sub"]);
  // A repository with submodules, as cloned: nothing kept out, the commands as before.
  const k0 = await keepOut(P.dir, { gitDir: P.gitDir, root: P.root });
  assert.deepEqual([k0.ok, k0.keep, k0.pathspec], [true, [], []]);
  await plantRepo(join(P.dir, "sub"), P.marker);
  const elsewhere = await tmp("coder-rs-subrepo-");
  await plantRepo(elsewhere, P.marker);
  await rm(join(P.dir, "link-sub"), { recursive: true, force: true });
  await symlink(elsewhere, join(P.dir, "link-sub"));
  await writeFile(join(P.dir, "normal.txt"), "normal\n");
  assert.deepEqual((await keepOut(P.dir, { gitDir: P.gitDir, root: P.root })).keep.sort(), ["link-sub", "sub"]);
  const p = await pushRepo({ ...P.o, message: "More work" });
  assert.equal(p.ok, true, p.why);
  assert.equal(existsSync(P.marker), false, "root ran the filter inside the submodule's folder");
  const files = tree(P.bare, P.branch);
  for (const s of ["sub", "empty-sub", "link-sub"]) assert.match(files, new RegExp("^160000 commit " + P.sha + "\\t" + s + "$", "m"), s + " was changed");
  assert.match(files, /\tnormal\.txt$/m);
  assert.doesNotMatch(files, /\tsub\/x\.txt|\.gitattributes/);
  await ignoreNew(P.dir, P.gitRoot, P.remote, P.root);
  assert.equal(existsSync(P.marker), false, "ignoreNew ran it");
  const u = await undo(P);
  assert.equal(u.status, 200, JSON.stringify(u.body));
  assert.equal(existsSync(P.marker), false, "the undo ran it");
  assert.match(tree(P.bare, P.branch), new RegExp("^160000 commit " + P.sha + "\\tsub$", "m"));
  // A plain (empty) submodule folder is still git's to look at: removing it is saved.
  await rm(join(P.dir, "empty-sub"), { recursive: true });
  assert.equal((await pushRepo({ ...P.o, message: "Drop empty-sub" })).ok, true);
  assert.doesNotMatch(tree(P.bare, P.branch), /\tempty-sub$/m);
  assert.equal(existsSync(P.marker), false);
});

test("CD92 H1: a project folder swapped for a link is refused by every root path (git, push, setup-script step, clone, undo, turn start); nothing is read or written through it", async () => {
  const P = await project("shop-link");
  const before = git(P.bare, "rev-parse", P.branch).trim();
  // What the link points at: if root followed it, the push would send secret.txt
  // and the undo would delete page.html there.
  const elsewhere = await tmp("coder-rs-else-");
  await writeFile(join(elsewhere, "secret.txt"), "TOP-SECRET\n");
  await writeFile(join(elsewhere, "page.html"), "<h1>Hi</h1>\n");
  const snap = () => readdirSync(elsewhere).sort().map((f) => f + "=" + readFileSync(join(elsewhere, f), "utf8")).join("|");
  const was = snap();
  await rename(P.dir, P.dir + "-real");
  await symlink(elsewhere, P.dir);
  const refused = /^refused: the project folder .* is a link/;
  assert.match(await projectDirProblem(P.dir, P.root), refused);
  for (const args of [["status", "--porcelain"], ["add", "-A"], ["checkout", "-q", "-f", "HEAD"]]) {
    const r = await gitIn(P.dir, args, { gitDir: P.gitDir, root: P.root });
    assert.equal(r.code, -1); assert.match(r.output, refused);
  }
  const p = await pushRepo({ ...P.o, message: "x" });
  assert.equal(p.ok, false); assert.match(p.why, refused);
  assert.deepEqual(await ignoreNew(P.dir, P.gitRoot, P.remote, P.root), []);
  assert.equal((await keepOut(P.dir, { gitDir: P.gitDir, root: P.root })).ok, false);
  const prep = await prepareRepo(P.o);
  assert.equal(prep.ok, false); assert.match(prep.why, refused);
  assert.match(await giveTree(P.dir, { uid: process.getuid(), gid: process.getgid() }, { root: P.root }), refused);
  const u = await undo(P);
  assert.equal(u.status, 502); assert.match(u.body.why, refused);
  // The machine's own routes: a turn on the repository, a push, and a chat without one.
  await symlink(elsewhere, join(P.root, "loose-link"));
  const { post, close } = await serve(createApp({ root: P.root, gitRoot: P.gitRoot, remote: P.remote, memRoot: await tmp("coder-rs-mem-"), bgRoot: await tmp("coder-rs-bg-"), send: async () => ({ message: { role: "assistant", content: "ok" } }) }));
  try {
    const t = await post("/turn", { project: "shop-link", text: "go", messages: [], repo: "ana/shop", base: "main", branch: P.branch, token: "" });
    assert.equal(t.status, 502); assert.match((await t.json()).error, refused);
    assert.match((await (await post("/push", { project: "shop-link", repo: "ana/shop", branch: P.branch, token: "", message: "x" })).json()).why, refused);
    const l = await post("/turn", { project: "loose-link", text: "go", messages: [] });
    assert.equal(l.status, 500); assert.match((await l.json()).error, /^refused: the project folder .*loose-link is a link/);
  } finally { await close(); }
  assert.equal(snap(), was, "something was read or written through the link");
  assert.equal(git(P.bare, "rev-parse", P.branch).trim(), before, "the branch was pushed through the link");
  // The rest of the check: directly inside the projects folder, really there, in a folder no one else can change.
  assert.match(await projectDirProblem(join(P.root, "a", "b"), P.root), /is not a project folder in/);
  assert.match(await projectDirProblem(P.root + "/shop-link-real/", P.root), /is not a project folder in/);
  const viaLink = join(await tmp("coder-rs-l-"), "root-link");
  await symlink(P.root, viaLink);
  assert.match(await projectDirProblem(join(viaLink, "shop-link-real"), viaLink), /leads somewhere else/);
  const shared = await tmp("coder-rs-open-");
  await mkdir(join(shared, "p"));
  await chmod(shared, 0o777);
  assert.match(await projectDirProblem(join(shared, "p"), shared), /can be changed by another user/);
  assert.equal(await projectDirProblem(P.dir + "-real", P.root), "", "the real folder is fine");
  // A folder is never made outside the projects folder.
  const escape = join(P.root, "..", "coder-rs-escape-" + process.pid);
  assert.match((await makeProjectDir(escape, { root: P.root })).why, /^refused/);
  assert.equal(existsSync(escape), false);
});

test("CD93 H1: the work tree is handed to the AI's user one entry at a time: a hard link to a file of root's keeps its owner, links are never followed; each project folder is made by root and only it is handed over", { skip: asRoot ? false : "needs root to change owners" }, async () => {
  const U = 1001;
  const root = await tmp("coder-rs-own-");
  const outside = await tmp("coder-rs-outside-");
  await writeFile(join(outside, "root-file.txt"), "root's\n");
  await writeFile(join(outside, "linked.txt"), "root's too\n");
  await mkdir(join(outside, "dir")); await writeFile(join(outside, "dir", "inner.txt"), "x\n");
  const dir = join(root, "tree");
  await mkdir(join(dir, "sub"), { recursive: true });
  await writeFile(join(dir, "a.txt"), "a\n");
  await writeFile(join(dir, "sub", "b.txt"), "b\n");
  await link(join(outside, "root-file.txt"), join(dir, "sub", "hard.txt"));
  await symlink(join(outside, "linked.txt"), join(dir, "link-file"));
  await symlink(join(outside, "dir"), join(dir, "link-dir"));
  assert.equal(await giveTree(dir, { uid: U, gid: U }, { root }), "");
  for (const p of [dir, join(dir, "a.txt"), join(dir, "sub"), join(dir, "sub", "b.txt")]) assert.equal(lstatSync(p).uid, U, p);
  for (const p of [join(dir, "link-file"), join(dir, "link-dir")]) assert.equal(lstatSync(p).uid, U, "the link itself: " + p);
  assert.equal(statSync(join(dir, "sub", "hard.txt")).uid, 0, "a hard link to root's file was handed over");
  for (const p of ["root-file.txt", "linked.txt", "dir", "dir/inner.txt"]) assert.equal(lstatSync(join(outside, p)).uid, 0, "followed out of the tree: " + p);
  assert.equal(lstatSync(root).uid, 0, "the projects folder itself");
  // A project folder: made by root (755), handed over on its own, never its parent nor what is inside.
  const made = await makeProjectDir(join(root, "fresh"), { root, owner: { uid: U, gid: U } });
  assert.deepEqual(made, { why: "", made: true });
  assert.equal(lstatSync(join(root, "fresh")).uid, U);
  assert.equal(lstatSync(join(root, "fresh")).mode & 0o777, 0o755);
  await mkdir(join(root, "used")); await writeFile(join(root, "used", "root.txt"), "x\n");
  assert.deepEqual(await makeProjectDir(join(root, "used"), { root, owner: { uid: U, gid: U } }), { why: "", made: false });
  assert.equal(lstatSync(join(root, "used")).uid, U);
  assert.equal(lstatSync(join(root, "used", "root.txt")).uid, 0, "not recursive");
  assert.equal(lstatSync(root).uid, 0);
  // THE SERVICE ITSELF, as on Coder's machine (its user set): a chat without a
  // repository gets its folder from root before the AI's first command, and a
  // repository's tree is handed over without the hard link planted in it. Own
  // user id, so stopping that user's processes touches nothing else here.
  const D = 42000 + (process.pid % 7000);
  const { remote } = await seedRemote();
  const r2 = await tmp("coder-rs-svc-");
  await chmod(r2, 0o755);
  const roots = await Promise.all(["git", "mem", "bg"].map((n) => tmp("coder-rs-svc-" + n + "-")));
  const script = join(await tmp("coder-rs-run-"), "run.mjs");
  writeFileSync(script, `
import { createApp, prepareRepo } from ${JSON.stringify(new URL("../container/server.mjs", import.meta.url).href)};
import http from "node:http";
import { link } from "node:fs/promises";
import { join } from "node:path";
const [root, gitRoot, memRoot, bgRoot, remote, outsideFile] = process.argv.slice(2);
const steps = [{ message: { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "bash", arguments: JSON.stringify({ command: "id -u > who.txt && touch made.txt" }) } }] } }, { message: { role: "assistant", content: "Done." } }];
let i = 0;
const srv = http.createServer(createApp({ root, gitRoot, memRoot, bgRoot, remote, send: async () => steps[Math.min(i++, 1)] }));
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + srv.address().port;
const out = {};
out.turn = (await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "loose-e2e", text: "go", messages: [], setup: { network: { mode: "full" } } }) })).status;
for (let n = 0; n < 200 && !out.result; n++) { const s = await (await fetch(base + "/state?project=loose-e2e&since=0")).json(); if (s.result) out.result = s.result.status; else await new Promise((r) => setTimeout(r, 50)); }
srv.close();
const o = { dir: join(root, "repo-e2e"), repo: "ana/shop", base: "main", branch: "coder/repo-e2e", token: "", remote, gitRoot, root };
out.first = (await prepareRepo(o)).ok;
await link(outsideFile, join(o.dir, "hard-link.txt"));
out.second = (await prepareRepo(o)).ok;
console.log(JSON.stringify(out));
`);
  const out = JSON.parse(execFileSync(process.execPath, [script, r2, ...roots, remote, join(outside, "root-file.txt")], { env: { ...process.env, CODER_RUN_UID: String(D), CODER_RUN_GID: String(D) }, timeout: 60000 }).toString().trim().split("\n").pop());
  assert.deepEqual(out, { turn: 200, result: "done", first: true, second: true });
  const loose = join(r2, "loose-e2e");
  assert.equal(lstatSync(loose).uid, D, "the chat's folder was handed to the AI's user");
  assert.equal(lstatSync(loose).mode & 0o777, 0o755);
  assert.equal(readFileSync(join(loose, "who.txt"), "utf8").trim(), String(D), "the command ran as the AI's user");
  assert.equal(lstatSync(join(loose, "made.txt")).uid, D, "the AI could work in its folder");
  assert.equal(lstatSync(r2).uid, 0, "the projects folder stays root's");
  assert.equal(lstatSync(join(r2, "repo-e2e", "README.md")).uid, D, "the tree was handed over");
  assert.equal(lstatSync(join(outside, "root-file.txt")).uid, 0, "the hard-linked file of root's was handed over");
  assert.equal(lstatSync(join(roots[0], "repo-e2e", "HEAD")).uid, 0, "the git folder stays root's");
});

test("CD94 root runs git by its full name with system folders only, never into submodules; the image gives /work to root, not the AI's user", async () => {
  assert.equal(GIT_BIN, "/usr/bin/git");
  assert.equal(GIT_PATH, "/usr/sbin:/usr/bin:/sbin:/bin");
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /spawn\(GIT_BIN, \[\.\.\.safe, \.\.\.args\]/);
  assert.doesNotMatch(server, /spawn\("git"/, "git found by name");
  assert.doesNotMatch(server, /"chown", \["-R", RUN_UID/, "chown -R of the work tree");
  for (const m of server.matchAll(/\["status"[^\]]*\]/g)) assert.match(m[0], /"--ignore-submodules=all"/, m[0]);
  const P = await project("shop-cfg");
  const o = { gitDir: P.gitDir, root: P.root };
  const get = async (k) => (await gitIn(P.dir, ["config", "--get", k], o)).stdout.trim();
  assert.deepEqual([await get("submodule.recurse"), await get("diff.ignoreSubmodules"), await get("fetch.recurseSubmodules"), await get("push.recurseSubmodules")], ["false", "all", "false", "no"]);
  assert.deepEqual(NO_SUBMODULES.filter((x) => x !== "-c"), ["submodule.recurse=false", "diff.ignoreSubmodules=all", "fetch.recurseSubmodules=false", "push.recurseSubmodules=no"]);
  // What git's own helpers would be found by: system folders only.
  const path = (await gitIn(P.dir, ["-c", "alias.where=!printenv PATH", "where"], o)).stdout.trim();
  assert.ok(path.endsWith(GIT_PATH), path);
  assert.doesNotMatch(path, /\/usr\/local/);
  // THE IMAGE: /work is root's (755); only the service hands out project folders.
  const docker = readFileSync(HERE("container/Dockerfile"), "utf8");
  assert.doesNotMatch(docker, /chown[^\n]*dev[^\n]*\/work|chown dev:dev \/work/, "the image gives /work to dev");
  assert.match(docker, /mkdir -p \/work && chown root:root \/work && chmod 755 \/work/);
  assert.ok(existsSync(GIT_BIN), "git is where root runs it from");
});

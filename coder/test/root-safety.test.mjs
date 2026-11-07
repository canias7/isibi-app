// ROOT'S GIT AND FILE WORK, NEVER STEERED BY THE AI'S USER (the audit,
// 2026-11-06, item 4 part 1). Coder's service runs git as root on a work tree
// the AI's user (`dev`) owns. These tests plant what the AI's commands could
// plant and check that root never runs it, never saves it, and never follows it:
//   C1  a repository the AI made inside the project (or a submodule's folder it
//       made into one), whose own settings name a filter command;
//   H1  a project folder swapped for a link, and files hard-linked into the tree.
// Real git against a local bare repository standing in for GitHub; the parts
// that change file owners or stop the AI's user's processes run only as root
// (they do here, and the deploy runs them under sudo). Those never stop the
// processes of user 1001: on GitHub's machines that is the runner itself.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rename, symlink, link, rm, utimes, realpath, chmod, chown } from "node:fs/promises";
import { readFileSync, existsSync, readdirSync, lstatSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import http from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { nestedAway, nestedGitPaths, createApp, prepareRepo, pushRepo, ignoreNew, gitIn, keepOut, projectDirProblem, makeProjectDir, giveTree, killUser, readMemory, writeMemory, repoNotes, submoduleHead, GIT_BIN, GIT_PATH, NO_SUBMODULES } from "../container/server.mjs";
import { handleCoder, leftOutNote } from "../src/coder-routes.mjs";
import { saveConnection } from "../src/coder-github.mjs";

const HERE = (p) => new URL("../" + p, import.meta.url);
const asRoot = process.getuid && process.getuid() === 0;
// The deploy sets CODER_TESTS_NEED_ROOT: there a root-only test runs (and fails) rather than being skipped.
const rootOnly = { skip: asRoot || process.env.CODER_TESTS_NEED_ROOT === "1" ? false : "needs root to change owners and stop another user's processes" };
// A user id of these tests' own, never 1001: stopping its processes touches nothing else.
const D = 42000 + (process.pid % 7000);
const tmp = async (name) => realpath(await mkdtemp(join(tmpdir(), name)));
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
const tree = (bare, branch) => git(bare, "ls-tree", "-r", branch);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const later = (s) => new Date(Date.now() + s * 1000);
/** The lines of one section of the git folder's ignore list (Coder's nested-repository section, or the setup script's). */
const section = (gitDir, start) => {
  const lines = readFileSync(join(gitDir, "info/exclude"), "utf8").split("\n");
  const out = [];
  for (let i = lines.indexOf(start) + 1; i > 0 && i < lines.length && lines[i] && !lines[i].startsWith("#"); i++) out.push(lines[i]);
  return out;
};
const NESTED = (gitDir) => section(gitDir, "# folders holding their own git repository: never saved (Coder)");
const SETUP = (gitDir) => section(gitDir, "# made by the setup script (Coder)");

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

const inRepo = (p) => (...a) => execFileSync("git", ["-C", p, "-c", "user.name=a", "-c", "user.email=a@b", ...a], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
/** The settings the AI's commands could write in a repository of their own: a filter command (it leaves a mark when run) for all its files. */
async function addFilter(p, marker) {
  const g = inRepo(p);
  g("config", "filter.evil.clean", "sh -c 'echo ran >> " + marker + "; cat'");
  g("config", "filter.evil.smudge", "sh -c 'echo ran >> " + marker + "; cat'");
  await writeFile(join(p, ".gitattributes"), "* filter=evil\n");
}

/**
 * What the AI's commands could make: a repository at `p` (a new commit of its
 * own) with the filter, and a file changed in a way git can only check by
 * reading it through that filter.
 */
async function plantRepo(p, marker) {
  await mkdir(p, { recursive: true });
  const g = inRepo(p);
  g("init", "-q");
  await writeFile(join(p, "x.txt"), "one\n");
  g("add", "x.txt"); g("commit", "-q", "-m", "x");
  await addFilter(p, marker);
  // Same size, newer time: only reading it (through the filter) can tell.
  await writeFile(join(p, "x.txt"), "two\n");
  await utimes(join(p, "x.txt"), later(10), later(10));
  return g("rev-parse", "HEAD").trim();
}

/**
 * A submodule's folder filled AT THE COMMIT ITS GITLINK RECORDS (the normal
 * state after `git submodule update`): the case where an unprotected `git add
 * -A` runs `git status` inside it (the audit, 2026-11-06), with the filter
 * and a same-size change only the filter can check.
 */
async function plantAtRecorded(p, bare, sha, marker) {
  execFileSync("git", ["clone", "-q", "--no-checkout", bare, p], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } });
  inRepo(p)("checkout", "-q", sha);
  await addFilter(p, marker);
  await writeFile(join(p, "README.md"), "# shoq\n");
  await utimes(join(p, "README.md"), later(10), later(10));
}

async function serve(handle) {
  const srv = http.createServer(handle);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  return { base, post, close: () => new Promise((r) => srv.close(r)) };
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

test("CD90 C1: a repository the AI makes inside the project is never run by root's git and never saved as a submodule; its other files are still pushed, and what was left out is said (push, setup-script step, undo)", async () => {
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
  // What was left out is returned, so the owner is told (the audit, 2026-11-06).
  assert.deepEqual(p.left.map((x) => x.path + ":" + x.kind).sort(), ["inner:repo", "lib/old.txt:repo", "undone:repo"]);
  assert.equal(existsSync(P.marker), false, "root ran the nested repository's filter");
  const files = tree(P.bare, P.branch);
  assert.doesNotMatch(files, /^160000 /m, "a nested folder was saved as a submodule");
  assert.doesNotMatch(files, /\tinner\b|\tundone\b/, "a nested repository's files were saved");
  for (const f of ["normal.txt", ".gitignore", "page.html", "docs/guide.md", "docs/x.txt"]) assert.match(files, new RegExp("\\t" + f.replace(/\./g, "\\.") + "$", "m"), f + " was not pushed");
  assert.match(files, /^100644 blob \w+\tlib\/old\.txt$/m, "the tracked file stays as it was");
  assert.match(files, /^120000 blob \w+\tlinked$/m, "the link is saved as a link");
  assert.equal(git(P.bare, "show", P.branch + ":lib/old.txt"), "old\n");
  // The git folder's own ignore list holds them (root's file, not the repo's .gitignore).
  for (const l of ["/inner/", "/undone/", "/lib/old.txt/"]) assert.ok(NESTED(P.gitDir).includes(l), l);
  // The setup script's step (what it made is ignored), then the undo route (its
  // revert and its push): nothing run, nothing saved as a submodule.
  await ignoreNew(P.dir, P.gitRoot, P.remote, P.root);
  assert.equal(existsSync(P.marker), false, "the setup-script step's git status ran it");
  const u = await undo(P);
  assert.equal(u.status, 200, JSON.stringify(u.body));
  assert.deepEqual(u.body.left.map((x) => x.path).sort(), ["inner", "lib/old.txt", "undone"], "the undo says what it left out");
  assert.throws(() => git(P.bare, "show", P.branch + ":page.html"), "the job was undone");
  assert.equal(existsSync(P.marker), false, "the undo's revert or push ran it");
  assert.doesNotMatch(tree(P.bare, P.branch), /^160000 /m);
  // A folder that is plain again (its .git removed) is saved again.
  await rm(join(P.dir, "inner/.git"), { recursive: true });
  assert.equal((await pushRepo({ ...P.o, message: "inner is plain now" })).ok, true);
  assert.match(tree(P.bare, P.branch), /\tinner\/x\.txt$/m);
  assert.equal(NESTED(P.gitDir).includes("/inner/"), false);
  assert.equal(existsSync(P.marker), false);
});

test("CD90b C1: every root step that touches the work tree looks first (the setup-script step, an undo that stops at its revert, a branch switch); a repository is found again on every look; folders git ignores whole are not walked and git never enters them", async () => {
  const P = await project("shop-looks");
  // THE SETUP-SCRIPT STEP: a repository it made is kept out as one (Coder's own
  // section), never written into the setup script's list as a plain new folder.
  await plantRepo(join(P.dir, "nest"), P.marker);
  await writeFile(join(P.dir, "made-by-setup.txt"), "x\n");
  const fresh = await ignoreNew(P.dir, P.gitRoot, P.remote, P.root);
  assert.deepEqual(fresh, ["made-by-setup.txt"]);
  assert.deepEqual(NESTED(P.gitDir), ["/nest/"]);
  assert.equal(SETUP(P.gitDir).includes("/nest/"), false, "the repository went in the setup script's list");
  // AN UNDO THAT STOPS AT ITS REVERT (a later job changed the same file): the look
  // before the revert still ran, though the push after it never came.
  await writeFile(join(P.dir, "page.html"), "<h1>Changed</h1>\n");
  assert.equal((await pushRepo({ ...P.o, message: "Changed page.html" })).ok, true);
  await plantRepo(join(P.dir, "nest-undo"), P.marker);
  const u = await undo(P);
  assert.equal(u.status, 409, JSON.stringify(u.body));
  assert.match(u.body.why, /could not be undone cleanly/);
  assert.deepEqual(NESTED(P.gitDir).sort(), ["/nest-undo/", "/nest/"], "the undo did not look before its revert");
  // A BRANCH SWITCH (a checkout writes the work tree): it looks first too.
  await plantRepo(join(P.dir, "nest-switch"), P.marker);
  const sw = await prepareRepo({ ...P.o, branch: "coder/shop-looks-2" });
  assert.equal(sw.ok, true, sw.why);
  assert.equal(git(P.dir, "--git-dir=" + P.gitDir, "rev-parse", "--abbrev-ref", "HEAD").trim(), "coder/shop-looks-2");
  assert.deepEqual(NESTED(P.gitDir).sort(), ["/nest-switch/", "/nest-undo/", "/nest/"], "the branch switch did not look first");
  // FOUND AGAIN ON EVERY LOOK: Coder's own list never hides a repository from the
  // next look (it is taken out before git is asked what it ignores).
  for (let i = 0; i < 2; i++) {
    await utimes(join(P.dir, "nest/x.txt"), later(20 + i), later(20 + i));
    const k = await keepOut(P.dir, { gitDir: P.gitDir, root: P.root });
    assert.deepEqual(k.nested.sort(), ["nest", "nest-switch", "nest-undo"]);
  }
  // FOLDERS GIT IGNORES WHOLE are not walked (node_modules, and the repo's own
  // build/), and git never takes a repository in them for a submodule.
  await plantRepo(join(P.dir, "node_modules/pkg"), P.marker);
  await plantRepo(join(P.dir, "build/tool"), P.marker);
  await writeFile(join(P.dir, ".gitignore"), "build/\n");
  await writeFile(join(P.dir, "app.js"), "x\n");
  const k = await keepOut(P.dir, { gitDir: P.gitDir, root: P.root });
  assert.deepEqual(k.keep.sort(), ["nest", "nest-switch", "nest-undo"], "an ignored folder was walked");
  for (let i = 0; i < 2; i++) {
    const p = await pushRepo({ ...P.o, branch: "coder/shop-looks-2", message: "push " + i });
    assert.equal(p.ok, true, p.why);
    await utimes(join(P.dir, "node_modules/pkg/x.txt"), later(30 + i), later(30 + i));
    await utimes(join(P.dir, "build/tool/x.txt"), later(30 + i), later(30 + i));
  }
  const files = tree(P.bare, "coder/shop-looks-2");
  assert.match(files, /\tapp\.js$/m);
  assert.doesNotMatch(files, /^160000 |\tnode_modules\/|\tbuild\//m);
  // Ignored no more (the repo's .gitignore changed): walked again, and kept out.
  await writeFile(join(P.dir, ".gitignore"), "build/\n!build/\n");
  assert.ok((await keepOut(P.dir, { gitDir: P.gitDir, root: P.root })).keep.includes("build/tool"));
  const p = await pushRepo({ ...P.o, branch: "coder/shop-looks-2", message: "build is not ignored" });
  assert.equal(p.ok, true, p.why);
  assert.doesNotMatch(tree(P.bare, "coder/shop-looks-2"), /^160000 |\tbuild\/tool/m);
  assert.equal(existsSync(P.marker), false, "root's git ran a planted filter");
});

test("CD90c what a save leaves out is said in the chat: the Worker adds it to its note after the push", async () => {
  // The note itself.
  assert.equal(leftOutNote([]), "");
  assert.equal(leftOutNote(undefined), "");
  assert.equal(leftOutNote([{ path: "vendor/lib", kind: "repo" }]), "Not saved: vendor/lib (a folder with its own git repository). Coder's app never runs git inside these; to save a folder's files, remove its .git.");
  assert.equal(leftOutNote([{ path: "themes/t", kind: "submodule" }, { path: "x`y", kind: "link" }]), "Not saved: themes/t (a submodule whose commit could not be read), xy (a submodule's folder that is a link). Coder's app never runs git inside these.");
  assert.match(leftOutNote(Array.from({ length: 11 }, (_, i) => ({ path: "r" + i, kind: "repo" }))), /r7 \(a folder with its own git repository\) and 3 more\./);
  // End to end: the AI clones a library into the project and adds a file; the
  // Worker pushes at the turn's end and says what was not saved.
  const { remote, bare } = await seedRemote();
  const root = await tmp("coder-rs-wroot-");
  const steps = [
    { message: { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "bash", arguments: JSON.stringify({ command: "mkdir -p vendor/lib && cd vendor/lib && git init -q && echo x > a.txt && git add a.txt && git -c user.name=a -c user.email=a@b commit -qm x && cd ../.. && echo hi > b.txt" }) } }] } },
    { message: { role: "assistant", content: "Vendored the library and added b.txt." } },
  ];
  let i = 0;
  const { base, close } = await serve(createApp({ root, remote, gitRoot: await tmp("coder-rs-wgit-"), memRoot: await tmp("coder-rs-wmem-"), bgRoot: await tmp("coder-rs-wbg-"), send: async () => steps[Math.min(i++, steps.length - 1)] }));
  try {
    const bucket = new Map();
    const store = { async get(k) { return bucket.has(k) ? { text: async () => bucket.get(k) } : null; }, async put(k, v) { bucket.set(k, String(v)); }, async delete(k) { bucket.delete(k); },
      async list({ prefix = "" } = {}) { return { objects: [...bucket.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
    const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: store };
    const fetchFn = async (url) => String(url) === "https://api.github.com/repos/ana/shop" ? Response.json({ default_branch: "main", permissions: { push: true } }) : Response.json({ message: "Not Found" }, { status: 404 });
    const uid = "user-1234567890abcdef";
    await saveConnection(env, store, uid, { access: "ghu_x", refresh: "ghr_x", expires: Date.now() + 3600e3, refreshExpires: Date.now() + 1e9 }, "ana");
    const deps = { fetchFn, authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: (req) => fetch(base + new URL(req.url).pathname + new URL(req.url).search, { method: req.method, headers: req.headers, body: req.method === "POST" ? req.body : undefined, duplex: "half" }) }) };
    const go = (path, init = {}) => handleCoder(new Request("https://coder.gofarther.dev/api/coder/" + path, { ...init, headers: { Authorization: "Bearer ok", "content-type": "application/json" } }), env, {}, deps);
    const id = (await (await go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/shop" }) })).json()).project.id;
    assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "vendor the library" }) })).status, 200);
    let got;
    for (let n = 0; n < 100; n++) { got = await (await go("projects/" + id + "/state?since=0")).json(); if (got.project.status !== "running") break; await sleep(50); }
    assert.equal(got.project.status, "idle");
    const note = got.events.filter((e) => e.type === "github").map((e) => e.text).join("\n");
    assert.match(note, /^Saved to the branch coder\/[\w-]+ · Not saved: vendor\/lib \(a folder with its own git repository\)\. Coder's app never runs git inside these; to save a folder's files, remove its \.git\.$/m);
    const files = tree(bare, "coder/" + id);
    assert.match(files, /\tb\.txt$/m);
    assert.doesNotMatch(files, /vendor/);
  } finally { await close(); }
});

test("CD91 C1: a submodule's folder the AI filled with a repository AT ITS RECORDED COMMIT (or swapped for a link) is left alone by root's git; plain submodules work as before (push, setup-script step, undo)", async () => {
  const P = await project("shop-subs", ["sub", "empty-sub", "link-sub"]);
  // A repository with submodules, as cloned: nothing kept out, the commands as before.
  const k0 = await keepOut(P.dir, { gitDir: P.gitDir, root: P.root });
  assert.deepEqual([k0.ok, k0.keep, k0.pathspec], [true, [], []]);
  // At the commit the gitlink records (the normal state after `git submodule
  // update`): there an unprotected `git add -A` runs `git status` inside it.
  await plantAtRecorded(join(P.dir, "sub"), P.bare, P.sha, P.marker);
  const elsewhere = await tmp("coder-rs-subrepo-");
  await plantRepo(elsewhere, P.marker);
  await rm(join(P.dir, "link-sub"), { recursive: true, force: true });
  await symlink(elsewhere, join(P.dir, "link-sub"));
  await writeFile(join(P.dir, "normal.txt"), "normal\n");
  assert.deepEqual((await keepOut(P.dir, { gitDir: P.gitDir, root: P.root })).keep.sort(), ["link-sub", "sub"]);
  // Twice, each time with the submodule's file newer again.
  for (let i = 0; i < 2; i++) {
    const p = await pushRepo({ ...P.o, message: "More work " + i });
    assert.equal(p.ok, true, p.why);
    assert.equal(existsSync(P.marker), false, "root ran the filter inside the submodule's folder (push " + i + ")");
    // The filled one is at its recorded commit: nothing left out; the link is.
    assert.deepEqual((p.left || []).map((x) => x.path + ":" + x.kind), ["link-sub:link"]);
    await utimes(join(P.dir, "sub/README.md"), later(20 + i), later(20 + i));
    await writeFile(join(P.dir, "normal.txt"), "normal " + i + "\n");
  }
  const files = tree(P.bare, P.branch);
  for (const s of ["sub", "empty-sub", "link-sub"]) assert.match(files, new RegExp("^160000 commit " + P.sha + "\\t" + s + "$", "m"), s + " was changed");
  assert.match(files, /\tnormal\.txt$/m);
  assert.doesNotMatch(files, /\tsub\/|\.gitattributes/);
  // The setup script's step and the undo (its revert and push): still nothing run.
  await utimes(join(P.dir, "sub/README.md"), later(30), later(30));
  await ignoreNew(P.dir, P.gitRoot, P.remote, P.root);
  assert.equal(existsSync(P.marker), false, "the setup-script step's git status ran it");
  await utimes(join(P.dir, "sub/README.md"), later(31), later(31));
  const u = await undo(P);
  assert.equal(u.status, 200, JSON.stringify(u.body));
  assert.equal(existsSync(P.marker), false, "the undo's revert or push ran it");
  assert.match(tree(P.bare, P.branch), new RegExp("^160000 commit " + P.sha + "\\tsub$", "m"));
  // A plain (empty) submodule folder is still git's to look at: removing it is saved.
  await rm(join(P.dir, "empty-sub"), { recursive: true });
  assert.equal((await pushRepo({ ...P.o, message: "Drop empty-sub" })).ok, true);
  assert.doesNotMatch(tree(P.bare, P.branch), /\tempty-sub$/m);
  assert.equal(existsSync(P.marker), false);
});

test("CD91b a submodule the AI moved to another commit is still saved (the commit read by Node, never by git in its folder); one whose commit cannot be read safely, and a library cloned into the project, are left out and said", async () => {
  const P = await project("shop-bump", ["themes/t", "file-sub", "head-link"]);
  // "Update the theme": the AI cannot run `git submodule update` (the git folder
  // is root's), so it clones into the submodule's folder at a newer commit.
  const theme = join(P.dir, "themes/t");
  const newer = await plantRepo(theme, P.marker);
  // A library cloned into the project: a new repository, not a submodule.
  await plantRepo(join(P.dir, "vendor/lib"), P.marker);
  // A `.git` file pointing elsewhere (never followed), and a HEAD that is a link.
  const away = await tmp("coder-rs-gitdir-");
  await plantRepo(away, P.marker);
  await writeFile(join(P.dir, "file-sub/.git"), "gitdir: " + join(away, ".git") + "\n");
  await plantRepo(join(P.dir, "head-link"), P.marker);
  const secret = join(await tmp("coder-rs-secret-"), "HEAD");
  writeFileSync(secret, "a".repeat(40) + "\n");
  await rm(join(P.dir, "head-link/.git/HEAD"));
  await symlink(secret, join(P.dir, "head-link/.git/HEAD"));
  assert.equal(await submoduleHead(P.dir, "themes/t"), newer);
  // Its branch in packed-refs (as a clone often keeps it) is read too.
  inRepo(theme)("pack-refs", "--all", "--prune");
  assert.equal(existsSync(join(theme, ".git/refs/heads", inRepo(theme)("rev-parse", "--abbrev-ref", "HEAD").trim())), false);
  assert.equal(await submoduleHead(P.dir, "themes/t"), newer);
  assert.equal(await submoduleHead(P.dir, "file-sub"), "", "a .git file was followed");
  assert.equal(await submoduleHead(P.dir, "head-link"), "", "a HEAD that is a link was read");
  const p = await pushRepo({ ...P.o, message: "Update the theme" });
  assert.equal(p.ok, true, p.why);
  assert.equal(p.pushed, true);
  assert.deepEqual(p.left.map((x) => x.path + ":" + x.kind).sort(), ["file-sub:submodule", "head-link:submodule", "vendor/lib:repo"]);
  const files = tree(P.bare, P.branch);
  assert.match(files, new RegExp("^160000 commit " + newer + "\\tthemes/t$", "m"), "the theme's new commit was not saved");
  for (const s of ["file-sub", "head-link"]) assert.match(files, new RegExp("^160000 commit " + P.sha + "\\t" + s + "$", "m"), s + " was changed");
  assert.doesNotMatch(files, /\tvendor\/|\tthemes\/t\//);
  assert.equal(existsSync(P.marker), false, "root's git ran a filter in a submodule's folder");
  // The theme moved back to its first commit is saved too; nothing new when it stays.
  inRepo(theme)("checkout", "-q", "-f", "HEAD");
  assert.equal((await pushRepo({ ...P.o, message: "Nothing new" })).pushed, false);
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
  // The rest of the check, each tested by whether root refuses (the audit,
  // 2026-11-06), not by its wording: directly inside the projects folder (an
  // existing folder one level down, and the projects folder itself)...
  await mkdir(join(P.root, "a", "b"), { recursive: true });
  for (const d of [join(P.root, "a", "b"), P.root, P.root + "/shop-link-real/"]) assert.match(await projectDirProblem(d, P.root), /^refused: .* is not a project folder in/, d);
  // ...really there (a link above the projects folder: only realpath sees it)...
  const above = await tmp("coder-rs-above-");
  await mkdir(join(above, "real", "projects", "p"), { recursive: true });
  await chmod(join(above, "real", "projects"), 0o755);
  await symlink(join(above, "real"), join(above, "via"));
  assert.match(await projectDirProblem(join(above, "via", "projects", "p"), join(above, "via", "projects")), /^refused: the project folder .* leads somewhere else/);
  assert.equal(await projectDirProblem(join(above, "real", "projects", "p"), join(above, "real", "projects")), "");
  const viaLink = join(await tmp("coder-rs-l-"), "root-link");
  await symlink(P.root, viaLink);
  assert.match(await projectDirProblem(join(viaLink, "shop-link-real"), viaLink), /^refused/);
  // ...in a folder no one else can change.
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

test("CD92b H1 (root): a projects folder owned by another user is refused even when only its owner may write (the state the old image left /work in)", rootOnly, async () => {
  const top = await tmp("coder-rs-owned-");
  await mkdir(join(top, "p"));
  await chown(top, D, D);
  await chmod(top, 0o755);
  assert.match(await projectDirProblem(join(top, "p"), top), /^refused: .* can be changed by another user/);
  assert.match((await makeProjectDir(join(top, "q"), { root: top })).why, /^refused: .* can be changed by another user/);
  await chown(top, 0, 0);
  assert.equal(await projectDirProblem(join(top, "p"), top), "");
});

test("CD92c H1: a `.git` link left in a project's folder before its first clone is replaced, never written through", async () => {
  const { remote } = await seedRemote();
  const root = await tmp("coder-rs-gitptr-");
  const gitRoot = await tmp("coder-rs-gitptr-g-");
  const dir = join(root, "shop-ptr");
  assert.deepEqual(await makeProjectDir(dir, { root }), { why: "", made: true });
  const outside = join(await tmp("coder-rs-gitptr-o-"), "victim.txt");
  writeFileSync(outside, "untouched\n");
  await symlink(outside, join(dir, ".git"));
  const prep = await prepareRepo({ dir, repo: "ana/shop", base: "main", branch: "coder/shop-ptr", token: "", remote, gitRoot, root });
  assert.equal(prep.ok, true, prep.why);
  assert.equal(readFileSync(outside, "utf8"), "untouched\n", "the .git link was written through");
  assert.ok(lstatSync(join(dir, ".git")).isFile(), "the .git pointer is not a plain file");
  assert.equal(readFileSync(join(dir, ".git"), "utf8"), "gitdir: " + join(gitRoot, "shop-ptr") + "\n");
});

test("CD92d a folder chain deeper than the system's longest path never blocks a chat: the job still starts, the push names a folder git could reach but Coder's app cannot check, and once it is gone the push works; what git cannot reach either is skipped", async () => {
  const P = await project("shop-deep");
  const name = "d".repeat(200);
  // Made the way a runaway copy would, each folder from inside the last: 20
  // folders, then one whose path from the project's folder is 4,095 bytes (git
  // can still open it) while its full path is longer than the system takes.
  const chain = (levels, last) => execFileSync("bash", ["-c", 'cd "$1" && for i in $(seq "$3"); do mkdir "$2" && cd "$2" || exit 1; done; if [ -n "$4" ]; then mkdir "$4" && cd "$4"; fi; echo leaf > leaf.txt', "x", P.dir, name, String(levels), last]);
  chain(20, "e".repeat(75));
  await writeFile(join(P.dir, "top.txt"), "top\n");
  // The next job starts: the files are handed over (the deepest keep their owner).
  assert.equal(await giveTree(P.dir, { uid: process.getuid(), gid: process.getgid() }, { root: P.root }), "");
  assert.equal((await prepareRepo(P.o)).ok, true);
  // The push is refused with the folder's name, not a bare system error.
  const p = await pushRepo({ ...P.o, message: "x" });
  assert.equal(p.ok, false);
  assert.match(p.why, /^could not check the project's folders: the folder "d{80}" is nested too deep for Coder's app to check; delete it or move it higher up$/);
  // The AI deletes it in its next job (rm -rf, which goes folder by folder); then the push works.
  execFileSync("rm", ["-rf", "--", join(P.dir, name)]);
  const ok = await pushRepo({ ...P.o, message: "top" });
  assert.equal(ok.ok, true, ok.why);
  assert.match(tree(P.bare, P.branch), /\ttop\.txt$/m);
  // A chain that passes git's reach in one step (21 folders): its deep end is
  // skipped, as git skips it; the rest is saved.
  chain(21, "");
  await writeFile(join(P.dir, name, "near.txt"), "near\n");
  assert.equal(await giveTree(P.dir, { uid: process.getuid(), gid: process.getgid() }, { root: P.root }), "");
  const deep = await pushRepo({ ...P.o, message: "near" });
  assert.equal(deep.ok, true, deep.why);
  assert.match(tree(P.bare, P.branch), new RegExp("\\t" + name + "/near\\.txt$", "m"));
  execFileSync("rm", ["-rf", "--", P.root]);
});

test("CD93 H1: the work tree is handed to the AI's user one entry at a time: a hard link to a file of root's keeps its owner, links are never followed, a folder swapped for a link mid-walk is never followed; each project folder is made by root and only it is handed over", rootOnly, async () => {
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
  // A FOLDER SWAPPED FOR A LINK WHILE THE WALK RUNS (the audit, 2026-11-06:
  // a walk by path name handed this file over within ten walks). A loop swaps 20
  // folders for a link to a folder holding a file of root's, again and again.
  const race = join(root, "race");
  const victim = join(outside, "dir", "inner.txt");
  for (let i = 0; i < 20; i++) { await mkdir(join(race, "a" + i), { recursive: true }); await writeFile(join(race, "a" + i, "f.txt"), "x"); }
  for (let d = 0; d < 60; d++) { await mkdir(join(race, "big", "d" + d), { recursive: true }); for (let f = 0; f < 10; f++) await writeFile(join(race, "big", "d" + d, "f" + f), "x"); }
  const swapper = spawn("bash", ["-c", 'end=$((SECONDS+30)); cd "$1" || exit 1; while [ $SECONDS -lt $end ]; do for i in $(seq 0 19); do mv a$i a$i.r 2>/dev/null && ln -s "$2" a$i && rm -f a$i && mv a$i.r a$i; done; done', "x", race, join(outside, "dir")], { stdio: "ignore" });
  try {
    for (let n = 0; n < 120; n++) {
      assert.equal(await giveTree(race, { uid: U, gid: U }, { root }), "");
      assert.equal(lstatSync(victim).uid, 0, "a file outside the tree was handed over on walk " + n);
    }
  } finally { swapper.kill("SIGKILL"); }
  await new Promise((r) => (swapper.exitCode !== null || swapper.signalCode ? r() : swapper.on("close", r)));
  for (let i = 0; i < 20; i++) if (existsSync(join(race, "a" + i + ".r"))) await rename(join(race, "a" + i + ".r"), join(race, "a" + i)).catch(() => {});
  assert.equal(await giveTree(race, { uid: U, gid: U }, { root }), "");
  assert.equal(lstatSync(join(race, "big", "d7", "f3")).uid, U, "the tree was not handed over");
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

// A process that keeps moving to a new pid (it forks, the parent leaves, the
// child goes on), as the AI's user, under a root parent that takes in and reaps
// its orphans (as an init would). It writes a byte per hop to an inherited pipe.
const HOPPER = `
import os, sys, ctypes, time
D = int(sys.argv[1]); secs = float(sys.argv[2])
ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0)
if os.fork() == 0:
    os.setgroups([]); os.setgid(D); os.setuid(D)
    while True:
        if os.fork(): os._exit(0)
        try: os.write(1, b".")
        except OSError: os._exit(0)
        time.sleep(0.0005)
os.dup2(os.open(os.devnull, os.O_WRONLY), 1)
end = time.time() + secs
while time.time() < end:
    try:
        while os.waitpid(-1, os.WNOHANG)[0] > 0: pass
    except ChildProcessError: pass
    time.sleep(0.0002)
`;

test("CD93b H1 (root): every process of the AI's user is stopped before root works on its files, even one that keeps moving to a new pid (it outlived `pkill -u`): at a job's start on a tree it used, and at a save", rootOnly, async () => {
  // Never as root or as this service's own user.
  assert.equal(killUser(0, 0), false);
  assert.equal(killUser(process.getuid(), process.getgid()), false);
  assert.equal(killUser(undefined), true, "no user set (tests): nothing to stop");
  // Called directly: that user's processes, and only those, are stopped.
  const mine = spawn("sleep", ["60"], { stdio: "ignore" });
  const theirs = spawn("sleep", ["60"], { uid: D, gid: D, stdio: "ignore" });
  const ended = new Promise((r) => theirs.on("exit", r));
  await sleep(100);
  assert.equal(killUser(D, D), true);
  await Promise.race([ended, sleep(3000)]);
  assert.equal(theirs.exitCode !== null || theirs.signalCode !== null, true, "the AI's user's command was not stopped");
  assert.equal(mine.exitCode === null && mine.signalCode === null, true, "a process of another user was stopped");
  mine.kill("SIGKILL");
  const python = ["/usr/bin/python3", "/bin/python3"].find((p) => existsSync(p));
  const { remote, bare } = await seedRemote();
  const root = await tmp("coder-rs-kill-");
  await chmod(root, 0o755);
  const gitRoot = await tmp("coder-rs-kill-git-");
  const script = join(await tmp("coder-rs-kill-run-"), "run.mjs");
  writeFileSync(script, `
import { prepareRepo, pushRepo } from ${JSON.stringify(new URL("../container/server.mjs", import.meta.url).href)};
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
const [root, gitRoot, remote, python, hopper] = process.argv.slice(2);
const D = Number(process.env.CODER_RUN_UID);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const o = { dir: join(root, "kill-e2e"), repo: "ana/shop", base: "main", branch: "coder/kill-e2e", token: "", remote, gitRoot, root };
const out = { first: (await prepareRepo(o)).ok };
// A plain command of the AI's user left running, then a job starts on its tree.
const asD = () => { const p = spawn("sleep", ["60"], { uid: D, gid: D, stdio: "ignore" }); const s = { done: false }; p.on("exit", () => { s.done = true; }); return s; };
let s = asD(); await sleep(150);
out.prep = (await prepareRepo(o)).ok;
await sleep(150); out.sleepStoppedByPrep = s.done;
// Then a save: a plain command, and one that keeps moving to a new pid.
s = asD();
let beats = 0, r = null;
if (python) { r = spawn(python, ["-I", "-c", hopper, String(D), "8"], { stdio: ["ignore", "pipe", "ignore"] }); r.stdout.on("data", (b) => { beats += b.length; }); }
await sleep(500);
out.hopperRan = !python || beats > 0;
await writeFile(join(o.dir, "saved.txt"), "saved\\n");
const p = await pushRepo({ ...o, message: "Saved" });
out.push = [p.ok, p.pushed];
await sleep(250); beats = 0; await sleep(500);
out.beatsAfterPush = beats;
out.sleepStoppedByPush = s.done;
if (r) r.kill("SIGKILL");
console.log(JSON.stringify(out));
`);
  const out = JSON.parse(execFileSync(process.execPath, [script, root, gitRoot, remote, python || "", HOPPER], { env: { ...process.env, CODER_RUN_UID: String(D), CODER_RUN_GID: String(D) }, timeout: 90000 }).toString().trim().split("\n").pop());
  // Whatever the result, nothing of the test's user is left running.
  killUser(D, D);
  assert.deepEqual(out, { first: true, prep: true, sleepStoppedByPrep: true, hopperRan: true, push: [true, true], beatsAfterPush: 0, sleepStoppedByPush: true });
  assert.equal(git(bare, "show", "coder/kill-e2e:saved.txt"), "saved\n");
});

test("CD93c root reads CODER.md and MEMORY.md only as the AI's plain files with one name: a hard link to a file of root's is never read into the chat", async () => {
  const dir = await tmp("coder-rs-notes-");
  const secret = join(await tmp("coder-rs-key-"), "ca.key");
  writeFileSync(secret, "ROOT-ONLY-SECRET\n", { mode: 0o600 });
  await link(secret, join(dir, "CODER.md"));
  assert.deepEqual(await repoNotes(dir), [], "a hard-linked CODER.md was read");
  await rm(join(dir, "CODER.md"));
  await writeFile(join(dir, "CODER.md"), "Use tabs.\n");
  assert.deepEqual(await repoNotes(dir), [{ name: "CODER.md", text: "Use tabs.\n" }]);
  const mem = join(await tmp("coder-rs-memf-"), "MEMORY.md");
  await link(secret, mem);
  assert.equal(await readMemory(mem), null, "a hard-linked MEMORY.md was read");
  await rm(mem);
  await writeMemory(mem, "- run npm test\n");
  assert.equal(await readMemory(mem), "- run npm test\n");
  // Root makes MEMORY.md and hands it to the AI's user: any other owner means it was swapped.
  assert.equal(await readMemory(mem, process.getuid()), "- run npm test\n");
  assert.equal(await readMemory(mem, process.getuid() + 1), null, "a MEMORY.md of another owner was read");
});

test("CD94 root runs git by its full name with system folders only, never into submodules (status by its command line); the image gives /work to root, not the AI's user; the deploy runs the root-only tests as root", async () => {
  assert.equal(GIT_BIN, "/usr/bin/git");
  assert.equal(GIT_PATH, "/usr/sbin:/usr/bin:/sbin:/bin");
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /spawn\(GIT_BIN, \[\.\.\.safe, \.\.\.args\]/);
  assert.doesNotMatch(server, /spawn\("git"/, "git found by name");
  assert.doesNotMatch(server, /"chown", \["-R", RUN_UID/, "chown -R of the work tree");
  // A repository's own .gitmodules (`ignore = none`) overrides the -c setting
  // checked below, so the command line is what keeps git out of a submodule:
  // every status carries --ignore-submodules=all and keepOut's exclusions, every
  // add those exclusions, and a diff only ever compares the index (--cached).
  for (const m of server.matchAll(/\["status"[^\]]*\]/g)) { assert.match(m[0], /"--ignore-submodules=all"/, m[0]); assert.match(m[0], /\.\.\.k\.pathspec/, m[0]); }
  for (const m of server.matchAll(/\["add"[^\]]*\]/g)) assert.match(m[0], /\.\.\.k\.pathspec/, m[0]);
  for (const m of server.matchAll(/\["diff"[^\]]*\]/g)) assert.match(m[0], /"--cached"|"--ignore-submodules=all"/, "a diff of the work tree without --ignore-submodules=all: " + m[0]);
  // The AI's user is stopped by the kernel, as that user, with a bare environment
  // (never `pkill`): by a sender that becomes that user itself, without starting
  // a new program, so that user's processes may not trace it.
  assert.doesNotMatch(server, /"pkill"/);
  assert.match(server, /const KILL_AS = "import os,sys\\nu,g=int\(sys\.argv\[1\]\),int\(sys\.argv\[2\]\)\\nos\.setgroups\(\[\]\);os\.setgid\(g\);os\.setuid\(u\)\\nfor _ in range\(3\):\\n  try:os\.kill\(-1,9\)/);
  assert.match(server, /spawnSync\(python, \["-I", "-S", "-c", KILL_AS, String\(uid\), String\(g\)\], \{ env: \{\}, cwd: "\/"/);
  assert.match(server, /spawnSync\("\/bin\/kill", \["-KILL", "--", "-1"\], \{ uid, gid: g, env: \{\}/);
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
  // Every command in it that names /work is one of these three, whatever user
  // a later line might name (the audit, 2026-11-06: `chown 1001 /work` too).
  const docker = readFileSync(HERE("container/Dockerfile"), "utf8");
  assert.doesNotMatch(docker, /chown[^\n]*dev[^\n]*\/work|chown dev:dev \/work/, "the image gives /work to dev");
  assert.match(docker, /mkdir -p \/work && chown root:root \/work && chmod 755 \/work/);
  const commands = docker.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n").replace(/\\\n/g, " ").split(/&&|\|\||;|\n/).map((c) => c.replace(/^\s*RUN\s+/, "").trim());
  const touching = commands.filter((c) => /(^|\s)\/work(\/|\s|$)/.test(c));
  assert.deepEqual(touching, ["mkdir -p /work", "chown root:root /work", "chmod 755 /work"]);
  assert.ok(existsSync(GIT_BIN), "git is where root runs it from");
  // THE DEPLOY runs these root-only tests as root, and fails rather than skip them.
  const deploy = readFileSync(new URL("../../.github/workflows/deploy-coder.yml", import.meta.url), "utf8");
  assert.match(deploy, /\n\s+sudo -E env "PATH=\$PATH" CODER_TESTS_NEED_ROOT=1 node --test test\/root-safety\.test\.mjs test\/room\.test\.mjs test\/sandbox\.test\.mjs\n/, "and the room's and the admin sandbox's real tests");
  assert.ok(deploy.indexOf("root-safety.test.mjs") < deploy.indexOf("name: Deploy Coder"), "the root-only tests run after the deploy");
});

test("CD94b (the final check, 2026-11-06) while root's git works, no repository of the AI's is left in the tree: a failed add, a commit's own status and a revert cannot open one", async () => {
  // The step itself: every nested .git is away during the work, back after; one whose folder git removed stays in root's folder.
  const dir = await tmp("coder-rs-away-"), gitDir = await tmp("coder-rs-awaygit-");
  await mkdir(join(dir, "a/.git"), { recursive: true }); await writeFile(join(dir, "a/.git/config"), "x\n");
  await mkdir(join(dir, "b/c"), { recursive: true }); await writeFile(join(dir, "b/c/.git"), "gitdir: /elsewhere\n");
  await writeFile(join(dir, ".git"), "gitdir: " + gitDir + "\n");
  assert.deepEqual((await nestedGitPaths(dir)).sort(), ["a/.git", "b/c/.git"], "the top-level .git is the project's own");
  let during = null;
  await nestedAway(dir, gitDir, async () => { during = await nestedGitPaths(dir); await rm(join(dir, "b"), { recursive: true }); }, () => assert.fail("refused"));
  assert.deepEqual(during, []);
  assert.equal(readFileSync(join(dir, "a/.git/config"), "utf8"), "x\n", "put back as it was");
  assert.equal(existsSync(join(dir, "b")), false, "a folder git removed is not made again");
  // The whole way: a filled submodule with a filter and `ignore = none`, a save git refuses, then a normal save.
  const { remote, bare, sha } = await seedRemote(["sub"]);
  const root = await tmp("coder-rs-root-"), gitRoot = await tmp("coder-rs-git-");
  const p = join(root, "shop-z");
  const o = { dir: p, repo: "ana/shop", base: "main", branch: "coder/shop-z", token: "", remote, gitRoot, root };
  assert.equal((await prepareRepo(o)).ok, true);
  const marker = join(await tmp("coder-rs-mark-"), "RAN");
  const sub = join(p, "sub");
  execFileSync("git", ["clone", "-q", "--no-checkout", bare, sub + "-tmp"], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } });
  await rm(sub, { recursive: true, force: true }); await rename(sub + "-tmp", sub);
  inRepo(sub)("checkout", "-q", sha);
  await addFilter(sub, marker);
  await writeFile(join(sub, "README.md"), "# changed\n"); await utimes(join(sub, "README.md"), later(10), later(10));
  await writeFile(join(p, ".gitmodules"), "[submodule \"sub\"]\n\tpath = sub\n\turl = https://example.com/sub.git\n\tignore = none\n");
  await mkdir(join(p, "zz/.GIT"), { recursive: true }); await writeFile(join(p, "zz/.GIT/x"), "x\n");
  await writeFile(join(p, "normal.txt"), "normal\n");
  const failed = await pushRepo({ ...o, message: "x" });
  assert.equal(failed.ok, false); assert.match(failed.why, /^could not save the changes/);
  assert.equal(existsSync(marker), false, "a save git refused opened nothing");
  await rm(join(p, "zz"), { recursive: true });
  const r = await pushRepo({ ...o, message: "y" });
  assert.equal(r.ok, true, r.why);
  assert.equal(existsSync(marker), false, "a normal save opened nothing");
  assert.ok(existsSync(join(sub, ".git")), "the submodule's own .git is back after the save");
  assert.match(tree(bare, "coder/shop-z"), /\tnormal\.txt/);
  // Every root step that writes or reads the work tree goes through the same step.
  const src = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(src, /nestedAway\(dir, gitDir, \(\) => gitIn\(dir, \["checkout", \.\.\.args\], o\), no\)/, "branch switch");
  assert.match(src, /nestedAway\(dir, o\.gitDir, async \(\) => \{ const r = await gitIn\(dir, \["revert", "--no-edit", sha\], o\);/, "undo");
  assert.match(src, /nestedAway\(dir, o\.gitDir, \(\) => gitIn\(dir, \["status", "--porcelain", "--untracked-files=normal"/, "the setup-script step");
});

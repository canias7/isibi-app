// A CLONE THAT DID NOT FINISH IS MADE AGAIN (live test, 2026-11-07: a chat's first job on
// canias7/testingforclaude failed after git's folder was made; every later job took the repository
// as already cloned, so Coder's commands found a folder with no files and no git at all: "fatal: not
// a git repository", only setup-ran.txt in it).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
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

test("CD175 a first clone that fails leaves no git folder behind; a half-made one from before (git's folder made, nothing fetched) is cleared and cloned again, keeping what the setup made; a finished clone whose pointer went gets it back, its work kept", async () => {
  const { prepareRepo, gitDirFor } = await import("../container/server.mjs");
  const { remote, bare } = await fakeGithub();
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const dir = join(root, "shop-a1b2"), gd = gitDirFor(dir, gitRoot);
  const prep = (base = "main") => prepareRepo({ dir, repo: "ana/shop", base, branch: "coder/shop-a1b2", token: "", remote, gitRoot, root });

  // A FAILED FIRST CLONE (here: no such starting branch, as the live test's mangled answer said): nothing left of git.
  const bad = await prep("nope");
  assert.equal(bad.ok, false);
  assert.match(bad.why, /has no branch named nope/);
  assert.equal(existsSync(gd), false, "no half-made git folder is left");
  assert.equal((await prep()).ok, true, "the next job clones");
  assert.equal(await readFile(join(dir, "README.md"), "utf8"), "# shop\n");
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); await rm(gd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });

  // THE LIVE TEST'S STATE (left by the version before this fix): git's folder made (git init) but nothing fetched,
  // and the project folder holding only what the setup script made.
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "setup-ran.txt"), "setup ok\n");
  execFileSync("git", ["init", "-q", "-b", "main", "--bare", gd]);
  // The setup ran on it, and what it made was put on the list of files to leave out (ignoreNew).
  await writeFile(join(gd, "info", "exclude"), "# made by the setup script (Coder)\n/setup-ran.txt\n");
  const again = await prep();
  assert.equal(again.ok, true, again.why);
  assert.equal(await readFile(join(dir, "README.md"), "utf8"), "# shop\n", "the repository's files are there");
  assert.equal(await readFile(join(dir, ".git"), "utf8"), "gitdir: " + gd + "\n", "and git's pointer");
  assert.equal(await readFile(join(dir, "setup-ran.txt"), "utf8"), "setup ok\n", "what the setup made is kept");
  assert.equal(git(dir, "rev-parse", "--abbrev-ref", "HEAD").trim(), "coder/shop-a1b2", "on the chat's branch");
  // ...and the setup's file stays off the branch (live test, 2026-11-07: it was pushed as Coder's work).
  assert.match(await readFile(join(gd, "info", "exclude"), "utf8"), /^\/setup-ran\.txt$/m, "the list of what the setup made is kept");
  const { pushRepo } = await import("../container/server.mjs");
  await writeFile(join(dir, "fix.js"), "x\n");
  assert.equal((await pushRepo({ dir, repo: "ana/shop", branch: "coder/shop-a1b2", token: "", message: "Coder's change", remote, gitRoot, root })).ok, true);
  const pushed = execFileSync("git", ["--git-dir=" + bare, "ls-tree", "-r", "--name-only", "coder/shop-a1b2"]).toString().trim().split("\n");
  assert.deepEqual(pushed.sort(), ["README.md", "fix.js"], "Coder's own file is saved, the setup's is not");

  // A FINISHED CLONE whose pointer was removed (the AI's commands own the work tree): put back, nothing lost.
  git(dir, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "--allow-empty", "-m", "local work");
  const head = git(dir, "rev-parse", "HEAD").trim();
  await rm(join(dir, ".git"));
  assert.equal((await prep()).ok, true);
  assert.equal(await readFile(join(dir, ".git"), "utf8"), "gitdir: " + gd + "\n");
  assert.equal(git(dir, "rev-parse", "HEAD").trim(), head, "the chat's own commits are kept");
});

test("batch 14: a first copy cut off part way lets the next message start; a repository with unpushed commits is never cleared", async () => {
  const { prepareRepo, gitDirFor } = await import("../container/server.mjs");
  const { remote } = await fakeGithub();
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const dir = join(root, "shop-b14a"), gd = gitDirFor(dir, gitRoot);
  const prep = () => prepareRepo({ dir, repo: "ana/shop", base: "main", branch: "coder/shop-b14a", token: "", remote, gitRoot, root });
  // A CUT-OFF FIRST COPY: the files it had written stay, its git folder went.
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "README.md"), "# sh");
  const r = await prep();
  assert.equal(r.ok, true, r.why);
  assert.equal(await readFile(join(dir, "README.md"), "utf8"), "# shop\n");
  // UNPUSHED COMMITS, then the branch file emptied: git cannot read HEAD, and the folder is kept.
  await writeFile(join(dir, "fix.js"), "x\n");
  git(dir, "-c", "user.name=a", "-c", "user.email=a@b", "add", "fix.js");
  git(dir, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "unpushed");
  const sha = git(dir, "rev-parse", "HEAD").trim();
  git(dir, "branch", "-q", "keep", sha);
  git(dir, "symbolic-ref", "HEAD", "refs/heads/nothing-yet");
  const kept = await prep();
  assert.equal(kept.ok, false);
  assert.match(kept.why, /not yet pushed; it is kept/);
  assert.equal(git(dir, "rev-parse", "keep").trim(), sha, "the unpushed commit is still there");
});

test("batch 14: Coder's own downloads stop only when git goes quiet, not at a fixed time", async () => {
  const { gitIn, GIT_FETCH_O } = await import("../container/server.mjs");
  assert.ok(GIT_FETCH_O.timeoutS >= 3600 && GIT_FETCH_O.stallS > 0);
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), dir = join(root, "shop-b14s");
  await mkdir(dir, { recursive: true });
  const bin = join(await mkdtemp(join(tmpdir(), "coder-fakegit-")), "git");
  // A stand-in git: "Receiving objects" every 100 ms for 1.2 s, then done.
  await writeFile(bin, "#!/bin/sh\nfor i in 1 2 3 4 5 6 7 8 9 10 11 12; do echo \"Receiving objects: $i%\" >&2; sleep 0.1; done\necho fetched\n", { mode: 0o755 });
  const o = { gitDir: join(root, "g"), root, bin };
  assert.equal((await gitIn(dir, ["fetch", "x"], { ...o, timeoutS: 0.5 })).code, -1, "a fixed limit cuts a moving download off");
  const r = await gitIn(dir, ["fetch", "x"], { ...o, timeoutS: 30, stallS: 0.5, progress: true });
  assert.equal(r.code, 0, "a moving download runs to its end");
  assert.doesNotMatch(r.output, /Receiving objects/, "progress lines are left out of git's answer");
  const quiet = join(await mkdtemp(join(tmpdir(), "coder-fakegit-")), "git");
  await writeFile(quiet, "#!/bin/sh\nsleep 1.2\necho fetched\n", { mode: 0o755 });
  assert.equal((await gitIn(dir, ["fetch", "x"], { ...o, bin: quiet, timeoutS: 30, stallS: 0.5 })).code, -1, "a stalled one is stopped");
});

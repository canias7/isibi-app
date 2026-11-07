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
  await rm(dir, { recursive: true, force: true }); await rm(gd, { recursive: true, force: true });

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

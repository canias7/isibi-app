// A REPOSITORY WITH A FILE NAMED HEAD AT ITS TOP (M-g-17; Claude Code's changelog: its unpushed-commit check was "fixed ...
// when its worktree has a file or folder named `HEAD` at the top level"). Coder's lookups name the commit, then "--".
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();

test("GH1 a file named HEAD at the top: what GitHub lacks is counted and the commit's files are listed", async () => {
  const S = await import("../container/server.mjs");
  const gh = await mkdtemp(join(tmpdir(), "coder-gh-")), work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  await writeFile(join(work, "HEAD"), "not a ref\n");
  git(work, "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(gh, "ana"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "ana", "shop.git")]);
  const remote = gh + "/";
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const dir = join(root, "shop-gh01"), branch = "coder/shop-gh01";
  const o = { gitDir: S.gitDirFor(dir, gitRoot), remote, root };
  assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch, token: "", remote, gitRoot, root, refresh: false })).ok, true);
  await writeFile(join(dir, "a.txt"), "one\n");
  const c = await S.pushRepo({ dir, repo: "ana/shop", branch, message: "Add a", token: "", remote, gitRoot, root, commitOnly: true });
  assert.equal(c.unpushed, 1, "not 0: git did not refuse with 'ambiguous argument HEAD'");
  assert.deepEqual(c.files, ["a.txt"]);
  assert.equal(await S.unpushedCount(dir, o), 1);
  assert.deepEqual((await S.commitFiles(dir, o)).files, ["a.txt"]);
});

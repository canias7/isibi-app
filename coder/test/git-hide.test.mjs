// ONLY WHAT IS SECRET IS HIDDEN IN GIT'S ANSWER (live test, 2026-11-07: Coder's first job on
// canias7/testingforclaude, whose default branch is coder/testingforclaude-c51d, said the branch did not
// exist: the job's number, 1, was "hidden" in git's answer, so every 1 in the branch names was gone).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();

test("CD164 a job whose starting branch has the job's number in its name (coder/testingforclaude-c51d, turn 1) opens it: git's answer hides only the job's pass, never the chat, the job's number or the pass's end time", async () => {
  const { prepareRepo, gitIn, gitDirFor } = await import("../container/server.mjs");
  // "GitHub": the repo whose only branch is the one GitHub made its default.
  const gh = await mkdtemp(join(tmpdir(), "coder-gh-"));
  const work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "coder/testingforclaude-c51d");
  await writeFile(join(work, "README.md"), "# test 1\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first 1");
  await mkdir(join(gh, "canias7"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "canias7", "testingforclaude.git")]);
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
  const pass = "Pq1".repeat(14) + "x"; // 43 characters, like the real pass
  const headers = ["X-Coder-Chat: user-1/testingforclaude-1a2b", "X-Coder-Turn: 1", "X-Coder-Until: 1794054619000", "X-Coder-Git: " + pass];
  const dir = join(root, "testingforclaude-1a2b");
  const prep = await prepareRepo({ dir, repo: "canias7/testingforclaude", base: "coder/testingforclaude-c51d", branch: "coder/testingforclaude-1a2b", token: "", headers, remote: gh + "/", gitRoot, root });
  assert.deepEqual(prep.ok, true, prep.why);
  // git's answer: the branch and its commit whole; the pass, were git ever to print it, hidden.
  const sha = git(work, "rev-parse", "HEAD").trim();
  const o = { headers, remote: gh + "/", gitDir: gitDirFor(dir, gitRoot), root };
  const r = await gitIn(dir, ["ls-remote", "--heads", gh + "/canias7/testingforclaude.git"], o);
  assert.equal(r.stdout.trim(), sha + "\trefs/heads/coder/testingforclaude-c51d");
  const echo = await gitIn(dir, ["log", "-1", "--format=%s " + pass + " 1 1794054619000 user-1/testingforclaude-1a2b"], o);
  assert.equal(echo.stdout.trim(), "first 1 [hidden] 1 1794054619000 user-1/testingforclaude-1a2b");
});

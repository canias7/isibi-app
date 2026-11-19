// THE GIT SNAPSHOT (M-f-25; Claude Code's start of a conversation: "Your git state. Current branch, uncommitted changes, and
// recent commit history"): an instructions-kind piece, taken once, off with CODER_DISABLE_GIT_INSTRUCTIONS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (cwd, ...a) => execFileSync("git", a, { cwd }).toString();

test("GS1 the snapshot holds the branch, the short status and the last five commits; the context takes it as an instructions piece, unless switched off", async () => {
  const S = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-gs-")), dir = join(root, "shop-gs01");
  execFileSync("mkdir", ["-p", dir]);
  git(dir, "init", "-q", "-b", "coder/shop-gs01");
  for (let i = 1; i <= 6; i++) { await writeFile(join(dir, "f.txt"), String(i)); git(dir, "add", "-A"); git(dir, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "commit " + i); }
  await writeFile(join(dir, "new.txt"), "x");
  const snap = await S.gitSnapshot(dir, { gitDir: join(dir, ".git"), root });
  assert.match(snap, /Current branch: coder\/shop-gs01\n/);
  assert.match(snap, /Status:\n\?\? new\.txt\n/);
  const commits = /Recent commits:\n([\s\S]*?)\n\n$/.exec(snap)[1].split("\n");
  assert.deepEqual(commits.map((l) => l.replace(/^[0-9a-f]+ /, "")), ["commit 6", "commit 5", "commit 4", "commit 3", "commit 2"]);
  assert.equal(await S.gitSnapshot(await mkdtemp(join(tmpdir(), "coder-gs-none-")), { root: tmpdir() }), "", "not a repository: nothing");
  const src = await readFile(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /const gitSnap = body\.repo && !varOn\(rawVars\.CODER_DISABLE_GIT_INSTRUCTIONS\) \? await gitSnapshot\(/);
  assert.match(src, /piece\("i:GIT STATUS", gitSnap\),/);
  const C = await import("../container/coder-context.mjs");
  assert.equal(C.kindOf("i:GIT STATUS"), "instructions", "taken once, read fresh only after a summary or a restart");
});

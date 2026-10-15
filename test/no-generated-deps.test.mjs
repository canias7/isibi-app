// GENERATED DEPENDENCY PATHS NEVER ENTER A COMMIT (2026-10-15). Commit
// c37cbc41 on main carried a `node_modules` SYMLINK made by a worktree's
// test setup: `.gitignore` said `node_modules/`, which matches a directory
// and not a file or a link of that name, so `git add -A` took it, and the push
// that should have deployed nothing redeployed the same code. The pattern
// matches every form now, and the index is checked for any such path.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
let inRepo = true;
try { git("rev-parse", "--is-inside-work-tree"); } catch { inRepo = false; }

test("no tracked path is, or sits under, a node_modules", { skip: inRepo ? false : "not a git checkout" }, () => {
  const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
  assert.ok(tracked.length > 100, "the index read as nearly empty — the observer is not alive");
  const bad = tracked.filter((p) => p.split("/").includes("node_modules"));
  assert.deepEqual(bad, [], "generated dependency paths are tracked");
});

test("a node_modules of any form is ignored: a directory, a file, a symlink, at the root or nested", { skip: inRepo ? false : "not a git checkout" }, () => {
  for (const p of ["node_modules", "node_modules/x/index.js", "builder/lovable/template/node_modules", "agent-builder/node_modules/y"]) {
    let ignored = true;
    try { git("check-ignore", "-q", "--no-index", p); } catch { ignored = false; }
    assert.equal(ignored, true, p + " is not ignored");
  }
  // CONTROL: an ordinary file is not ignored, so the check can answer no.
  let ctl = true;
  try { git("check-ignore", "-q", "--no-index", "worker.js"); } catch { ctl = false; }
  assert.equal(ctl, false, "the ignore check answers yes for everything");
});

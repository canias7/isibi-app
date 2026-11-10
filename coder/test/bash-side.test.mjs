// TOOL 4, BASH: WHAT THE LIVE SIDE-BY-SIDE WITH CLAUDE CODE FOUND (the owner, 2026-11-10: "test it with claude code and
// coder, and see the differences pls"). Each against Claude Code 2.1.322 itself, run with the same commands the same day.
import { test } from "node:test";
import assert from "node:assert/strict";

test("CD361 more than one folder change in one command asks in Accept edits and Plan, in Claude Code's words (Claude Code 2.1.322 asked for each of these; one cd runs as before)", async () => {
  const P = await import("../container/coder-perms.mjs");
  const W = "/work/shop";
  const d = (c, mode) => P.bashDecision(c, { mode, cwd: W, workdirs: [W] });
  for (const c of ["cd docs && cd ..", "cd docs && ls && cd ..", "cd docs; cd ../src", "pushd docs && popd"]) {
    for (const mode of ["acceptEdits", "plan"]) {
      const r = d(c, mode);
      assert.equal(r.verdict, "ask", mode + " " + c);
      assert.equal(r.why, "Multiple directory changes in one command require approval for clarity");
      assert.equal(r.suggest, null, "no rule to offer");
    }
    assert.equal(d(c, "auto").verdict, "allow", "Auto as before");
  }
  for (const c of ["cd docs && ls", "ls && pwd", "cd src"]) assert.equal(d(c, "acceptEdits").verdict, "allow", c);
});
